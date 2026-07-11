import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { SupabaseClient } from '@supabase/supabase-js';
import { createStoreRouter } from './store';

// Test TẦNG HTTP thật cho 3 endpoint storefront public (audit 2026-07-11 lần 3:
// đây là bề mặt tấn công lớn nhất — không auth — nhưng trước đây 0 test tầng HTTP).
// Cùng pattern routes/data.test.ts: app.listen(0) + global fetch, KHÔNG thêm supertest.

type ChainResult = { data: unknown; error: { message: string } | null };

interface QueryChain {
  select: (...args: unknown[]) => QueryChain;
  eq: (...args: unknown[]) => QueryChain;
  order: (...args: unknown[]) => QueryChain;
  limit: (...args: unknown[]) => QueryChain;
  single: () => Promise<ChainResult>;
  maybeSingle: () => Promise<ChainResult>;
}

interface MockOpts {
  /** Kết quả RPC create_store_order — mặc định đơn tạo thành công. */
  rpcResult?: { data: unknown; error: { message: string } | null };
  preorderInsertError?: { message: string } | null;
  /** Dòng pos_orders trả về cho lookup — null = không tìm thấy. */
  orderRow?: Record<string, unknown> | null;
  /** SĐT của pos_customers gắn với đơn — dùng test khớp/không khớp. */
  customerPhone?: string | null;
}

function makeSupabaseMock(opts: MockOpts = {}) {
  const rpcCalls: { fn: string; params: Record<string, unknown> }[] = [];
  const preorderInserts: Record<string, unknown>[] = [];

  const client = {
    rpc: (fn: string, params: Record<string, unknown>) => {
      rpcCalls.push({ fn, params });
      return Promise.resolve(
        opts.rpcResult ?? {
          data: { order_code: 'WEB-2607-001', subtotal: 299000, shipping_fee: 30000, total_amount: 329000 },
          error: null,
        }
      );
    },
    from: (table: string) => {
      if (table === 'store_preorder_requests') {
        return {
          insert: (row: Record<string, unknown>) => {
            preorderInserts.push(row);
            return Promise.resolve({ error: opts.preorderInsertError ?? null });
          },
        };
      }
      const result: ChainResult = (() => {
        if (table === 'pos_orders') {
          return opts.orderRow
            ? { data: opts.orderRow, error: null }
            : { data: null, error: { message: 'not found' } };
        }
        if (table === 'pos_customers') {
          return opts.customerPhone
            ? { data: { phone: opts.customerPhone }, error: null }
            : { data: null, error: { message: 'not found' } };
        }
        // store_order_addresses / shipments — bảng phụ, graceful fallback → null
        return { data: null, error: null };
      })();
      const chain: QueryChain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        single: () => Promise.resolve(result),
        maybeSingle: () => Promise.resolve(result),
      };
      return chain;
    },
  } as unknown as SupabaseClient;

  return { client, rpcCalls, preorderInserts };
}

// Mỗi startApp = router MỚI = rate-limiter đếm lại từ 0 — mỗi describe dùng app riêng
// để số request của nhóm test này không làm nhóm khác dính 429 oan.
function startApp(client: SupabaseClient): Promise<{ server: Server; baseUrl: string }> {
  const app = express();
  app.use(express.json());
  app.use(createStoreRouter(client));
  return new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

async function post(baseUrl: string, path: string, body: unknown) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

const VALID_UUID = '123e4567-e89b-42d3-a456-426614174000';

const validOrderBody = {
  customer: { name: 'Chị Hoa', phone: '0912345678' },
  shippingAddress: { addressLine: '12 Lê Lợi', district: 'Ninh Kiều', province: 'Cần Thơ' },
  paymentMethod: 'cod',
  items: [{ posProductId: VALID_UUID, quantity: 2 }],
};

describe('POST /api/store/orders (tầng HTTP)', () => {
  const mock = makeSupabaseMock();
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    ({ server, baseUrl } = await startApp(mock.client));
  });
  afterAll(() => server.close());

  it('400 khi thiếu thông tin khách hàng', async () => {
    const r = await post(baseUrl, '/api/store/orders', { ...validOrderBody, customer: undefined });
    expect(r.status).toBe(400);
    expect(r.json.error).toBe('Thiếu thông tin khách hàng');
  });

  it('400 khi SĐT không hợp lệ (không phải 10 số bắt đầu 0)', async () => {
    const r = await post(baseUrl, '/api/store/orders', {
      ...validOrderBody, customer: { name: 'A', phone: '12345' },
    });
    expect(r.status).toBe(400);
    expect(String(r.json.error)).toContain('Số điện thoại không hợp lệ');
  });

  it('400 khi thiếu địa chỉ cụ thể', async () => {
    const r = await post(baseUrl, '/api/store/orders', {
      ...validOrderBody, shippingAddress: { district: 'NK', province: 'CT' },
    });
    expect(r.status).toBe(400);
    expect(r.json.error).toBe('Thiếu địa chỉ cụ thể');
  });

  it('400 khi phương thức thanh toán lạ', async () => {
    const r = await post(baseUrl, '/api/store/orders', { ...validOrderBody, paymentMethod: 'momo' });
    expect(r.status).toBe(400);
  });

  it('400 khi giỏ hàng trống', async () => {
    const r = await post(baseUrl, '/api/store/orders', { ...validOrderBody, items: [] });
    expect(r.status).toBe(400);
    expect(r.json.error).toBe('Giỏ hàng trống');
  });

  it('400 khi posProductId không phải UUID (chặn injection qua id)', async () => {
    const r = await post(baseUrl, '/api/store/orders', {
      ...validOrderBody, items: [{ posProductId: "1; DROP TABLE pos_products;--", quantity: 1 }],
    });
    expect(r.status).toBe(400);
    expect(r.json.error).toBe('ID sản phẩm không hợp lệ');
  });

  it('400 khi quantity ngoài biên 1-100 hoặc không nguyên', async () => {
    for (const quantity of [0, 101, 1.5, -1]) {
      const r = await post(baseUrl, '/api/store/orders', {
        ...validOrderBody, items: [{ posProductId: VALID_UUID, quantity }],
      });
      expect(r.status).toBe(400);
      expect(r.json.error).toBe('Số lượng không hợp lệ (1-100)');
    }
  });

  it('201 happy path: gọi đúng RPC create_store_order, giá tính server-side, phone chuẩn hoá', async () => {
    const r = await post(baseUrl, '/api/store/orders', {
      ...validOrderBody,
      customer: { name: '  Chị Hoa  ', phone: '84912345678' }, // dạng 84xxx → 0xxx
    });
    expect(r.status).toBe(201);
    expect(r.json.order_code).toBe('WEB-2607-001');
    expect(r.json.total_amount).toBe(329000);

    const call = mock.rpcCalls.at(-1)!;
    expect(call.fn).toBe('create_store_order');
    expect(call.params.p_customer_phone).toBe('0912345678');
    expect(call.params.p_customer_name).toBe('Chị Hoa');
    // Client KHÔNG gửi được giá — items chỉ còn id + quantity, giá tính trong RPC
    expect(call.params.p_items).toEqual([{ pos_product_id: VALID_UUID, quantity: 2 }]);
  });
});

describe('POST /api/store/orders — lỗi từ RPC', () => {
  it('400 + message nguyên văn khi RPC trả lỗi nghiệp vụ (vd hết hàng)', async () => {
    const mock = makeSupabaseMock({
      rpcResult: { data: { error: 'Sản phẩm "Dép quai ngang" không đủ tồn kho' }, error: null },
    });
    const { server, baseUrl } = await startApp(mock.client);
    try {
      const r = await post(baseUrl, '/api/store/orders', validOrderBody);
      expect(r.status).toBe(400);
      expect(r.json.error).toBe('Sản phẩm "Dép quai ngang" không đủ tồn kho');
    } finally { server.close(); }
  });

  it('500 + message tiếng Việt chung khi RPC lỗi hệ thống (không lộ chi tiết kỹ thuật)', async () => {
    const mock = makeSupabaseMock({
      rpcResult: { data: null, error: { message: 'connection refused to 192.168.1.6' } },
    });
    const { server, baseUrl } = await startApp(mock.client);
    try {
      const r = await post(baseUrl, '/api/store/orders', validOrderBody);
      expect(r.status).toBe(500);
      expect(r.json.error).toBe('Lỗi hệ thống, vui lòng thử lại');
      expect(JSON.stringify(r.json)).not.toContain('192.168');
    } finally { server.close(); }
  });
});

describe('POST /api/store/preorders (tầng HTTP)', () => {
  const mock = makeSupabaseMock();
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    ({ server, baseUrl } = await startApp(mock.client));
  });
  afterAll(() => server.close());

  it('400 khi thiếu tên khách', async () => {
    const r = await post(baseUrl, '/api/store/preorders', { phone: '0912345678' });
    expect(r.status).toBe(400);
    expect(r.json.error).toBe('Thiếu tên khách hàng');
  });

  it('400 khi SĐT sai', async () => {
    const r = await post(baseUrl, '/api/store/preorders', { customerName: 'A', phone: 'abc' });
    expect(r.status).toBe(400);
  });

  it('400 khi posProductId không phải UUID', async () => {
    const r = await post(baseUrl, '/api/store/preorders', {
      customerName: 'A', phone: '0912345678', posProductId: 'not-a-uuid',
    });
    expect(r.status).toBe(400);
    expect(r.json.error).toBe('ID sản phẩm không hợp lệ');
  });

  it('201 happy path: insert store_preorder_requests đúng payload, status waiting', async () => {
    const r = await post(baseUrl, '/api/store/preorders', {
      customerName: '  Anh Tùng  ', phone: '84987654321', sku: 'DQND25', size: '40',
    });
    expect(r.status).toBe(201);
    const row = mock.preorderInserts.at(-1)!;
    expect(row.customer_name).toBe('Anh Tùng');
    expect(row.phone).toBe('0987654321');
    expect(row.sku).toBe('DQND25');
    expect(row.pos_product_id).toBeNull();
    expect(row.status).toBe('waiting');
  });

  it('500 khi insert lỗi — message tiếng Việt chung', async () => {
    const failing = makeSupabaseMock({ preorderInsertError: { message: 'db down' } });
    const { server: s2, baseUrl: b2 } = await startApp(failing.client);
    try {
      const r = await post(b2, '/api/store/preorders', { customerName: 'A', phone: '0912345678' });
      expect(r.status).toBe(500);
      expect(r.json.error).toBe('Lỗi hệ thống, vui lòng thử lại');
    } finally { s2.close(); }
  });
});

describe('POST /api/store/orders/lookup (tầng HTTP)', () => {
  const orderRow = {
    id: 'ord-1',
    order_code: 'WEB-2607-001',
    date: '2026-07-11',
    customer_id: 'cus-1',
    customer_name: 'Chị Hoa', // KHÔNG được lộ ra response
    items: [{ productName: 'Dép quai ngang', sku: 'DQND25', size: '40', color: 'Đen', quantity: 1, price: 299000, subtotal: 299000, costPrice: 150000 }],
    shipping_fee: 30000,
    total_amount: 329000,
    final_amount: 329000,
    status: 'completed',
    payment_method: 'cod',
    created_at: '2026-07-11T09:00:00Z',
  };

  it('400 khi thiếu mã đơn', async () => {
    const mock = makeSupabaseMock();
    const { server, baseUrl } = await startApp(mock.client);
    try {
      const r = await post(baseUrl, '/api/store/orders/lookup', { phone: '0912345678' });
      expect(r.status).toBe(400);
      expect(r.json.error).toBe('Thiếu mã đơn hàng');
    } finally { server.close(); }
  });

  it('404 khi không tìm thấy đơn', async () => {
    const mock = makeSupabaseMock({ orderRow: null });
    const { server, baseUrl } = await startApp(mock.client);
    try {
      const r = await post(baseUrl, '/api/store/orders/lookup', { orderCode: 'WEB-KHONG-CO', phone: '0912345678' });
      expect(r.status).toBe(404);
      expect(r.json.error).toBe('Không tìm thấy đơn hàng');
    } finally { server.close(); }
  });

  it('404 khi SĐT không khớp khách của đơn — cùng message với sai mã (chống dò đơn)', async () => {
    const mock = makeSupabaseMock({ orderRow, customerPhone: '0999999999' });
    const { server, baseUrl } = await startApp(mock.client);
    try {
      const r = await post(baseUrl, '/api/store/orders/lookup', { orderCode: 'WEB-2607-001', phone: '0912345678' });
      expect(r.status).toBe(404);
      expect(r.json.error).toBe('Không tìm thấy đơn hàng');
    } finally { server.close(); }
  });

  it('200 happy path: chỉ trả field an toàn, items rút gọn (không lộ giá vốn/id nội bộ)', async () => {
    const mock = makeSupabaseMock({ orderRow, customerPhone: '0912345678' });
    const { server, baseUrl } = await startApp(mock.client);
    try {
      const r = await post(baseUrl, '/api/store/orders/lookup', { orderCode: 'web-2607-001', phone: '0912345678' });
      expect(r.status).toBe(200);
      const data = r.json.data as Record<string, unknown>;
      expect(data.order_code).toBe('WEB-2607-001');
      expect(data.total_amount).toBe(329000);
      const items = data.items as Record<string, unknown>[];
      expect(items[0].productName).toBe('Dép quai ngang');
      // Field nội bộ không được lộ ra ngoài
      expect(items[0]).not.toHaveProperty('costPrice');
      expect(data).not.toHaveProperty('customer_id');
      expect(data).not.toHaveProperty('customer_name');
      expect(data).not.toHaveProperty('id');
    } finally { server.close(); }
  });
});

describe('Rate-limit storefront (fix AUDIT-0711-B chạy thật)', () => {
  it('preorders: request thứ 11 trong cửa sổ 15 phút bị 429 + message tiếng Việt', async () => {
    const mock = makeSupabaseMock();
    const { server, baseUrl } = await startApp(mock.client); // limiter mới, đếm từ 0
    try {
      for (let i = 1; i <= 10; i++) {
        const r = await post(baseUrl, '/api/store/preorders', { customerName: `Khách ${i}`, phone: '0912345678' });
        expect(r.status).toBe(201);
      }
      const r11 = await post(baseUrl, '/api/store/preorders', { customerName: 'Khách 11', phone: '0912345678' });
      expect(r11.status).toBe(429);
      expect(String(r11.json.error)).toContain('đặt trước');
    } finally { server.close(); }
  });
});
