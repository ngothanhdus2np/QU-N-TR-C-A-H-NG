import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { SupabaseClient } from '@supabase/supabase-js';
import { createDataRouter } from './data';

// Test TẦNG HTTP thật cho createDataRouter (audit 2026-07-11 mục E: logic bên dưới có
// test nhưng lớp wiring Express — auth, validate, mapping lỗi — trước đây 0 test).
// Không dùng supertest (tránh thêm dependency): app.listen(0) + global fetch của Node.

interface MockUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}

function makeSupabaseMock(opts: { userByJwt?: Record<string, MockUser>; rpcShouldError?: boolean } = {}) {
  const upsertCalls: { table: string; payload: unknown; options: unknown }[] = [];
  const deleteCalls: { table: string; id: string }[] = [];
  const auditInserts: Record<string, unknown>[] = [];
  const rpcCalls: { fn: string; params: Record<string, unknown> }[] = [];

  const client = {
    auth: {
      getUser: (jwt: string) => {
        const user = opts.userByJwt?.[jwt];
        return Promise.resolve(
          user ? { data: { user }, error: null } : { data: { user: null }, error: { message: 'invalid jwt' } }
        );
      },
    },
    rpc: (fn: string, params: Record<string, unknown>) => {
      rpcCalls.push({ fn, params });
      return Promise.resolve({ error: opts.rpcShouldError ? { message: 'rpc failed' } : null });
    },
    from: (table: string) => {
      if (table === 'audit_logs') {
        return {
          insert: (row: Record<string, unknown>) => {
            auditInserts.push(row);
            return Promise.resolve({ error: null });
          },
        };
      }
      return {
        upsert: (payload: unknown, options: unknown) => {
          upsertCalls.push({ table, payload, options });
          return Promise.resolve({ error: null });
        },
        select: () => ({
          eq: () => ({ single: () => Promise.resolve({ data: { id: 'snap' }, error: null }) }),
        }),
        delete: () => ({
          eq: (_col: string, id: string) => {
            deleteCalls.push({ table, id });
            return Promise.resolve({ error: null });
          },
          neq: (_col: string, id: string) => {
            deleteCalls.push({ table, id: `neq:${id}` });
            return Promise.resolve({ error: null });
          },
        }),
      };
    },
  } as unknown as SupabaseClient;

  return { client, upsertCalls, deleteCalls, auditInserts, rpcCalls };
}

// requireAuth giả lập đúng contract thật: chặn 401 trừ khi request có header x-test-auth —
// để test khẳng định các route mutate THẬT SỰ đi qua middleware được truyền vào.
const requireAuthStub: express.RequestHandler = (req, res, next) => {
  if (req.headers['x-test-auth'] === 'yes') return next();
  res.status(401).json({ error: 'Unauthorized' });
};

function startApp(client: SupabaseClient): Promise<{ server: Server; baseUrl: string }> {
  const app = express();
  app.use(express.json());
  app.use(createDataRouter(client, requireAuthStub));
  return new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

async function post(baseUrl: string, path: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-test-auth': 'yes', ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

describe('createDataRouter (tầng HTTP)', () => {
  const OWNER_JWT = 'jwt-owner';
  const CASHIER_JWT = 'jwt-cashier';
  let mock: ReturnType<typeof makeSupabaseMock>;
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    mock = makeSupabaseMock({
      userByJwt: {
        [OWNER_JWT]: { id: 'u-1', email: 'chu@cfobrain.local', user_metadata: { display_name: 'Chủ cửa hàng', role: 'owner' } },
        [CASHIER_JWT]: { id: 'u-2', email: 'nv@cfobrain.local', user_metadata: { role: 'cashier' } },
      },
    });
    ({ server, baseUrl } = await startApp(mock.client));
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    mock.upsertCalls.length = 0;
    mock.deleteCalls.length = 0;
    mock.auditInserts.length = 0;
    mock.rpcCalls.length = 0;
  });

  it('route mutate chặn request không qua requireAuth (401)', async () => {
    const res = await fetch(`${baseUrl}/api/data/upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, // KHÔNG có x-test-auth
      body: JSON.stringify({ key: 'posProducts', payload: { id: 'p1' }, recordId: 'p1' }),
    });
    expect(res.status).toBe(401);
    expect(mock.upsertCalls).toHaveLength(0);
  });

  it('upsert: key không nằm trong TABLE_MAP → 400, không ghi gì', async () => {
    const res = await post(baseUrl, '/api/data/upsert', {
      key: 'bangKhongTonTai',
      payload: { id: 'x' },
      recordId: 'x',
    });
    expect(res.status).toBe(400);
    expect(mock.upsertCalls).toHaveLength(0);
  });

  it('upsert: payload chứa NaN (kể cả lồng sâu) → 400', async () => {
    // JSON không serialize được NaN → gửi qua chuỗi thô như client lỗi thật có thể tạo ra
    const res = await fetch(`${baseUrl}/api/data/upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-auth': 'yes' },
      body: '{"key":"posProducts","recordId":"p1","payload":{"id":"p1","items":[{"price":null},{"price":NaN}]}}'
        .replace('NaN', '1e999'), // 1e999 parse thành Infinity
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/số không hợp lệ/);
    expect(mock.upsertCalls).toHaveLength(0);
  });

  it('upsert: pos_products giá bán âm → 400 với thông báo tiếng Việt', async () => {
    const res = await post(baseUrl, '/api/data/upsert', {
      key: 'posProducts',
      payload: { id: 'p1', sale_price: -5000 },
      recordId: 'p1',
    });
    expect(res.status).toBe(400);
    expect(String(res.json.error)).toMatch(/không được âm/);
    expect(mock.upsertCalls).toHaveLength(0);
  });

  it('upsert hợp lệ: 200, upsert onConflict id + audit_logs kèm actor từ JWT', async () => {
    const res = await post(
      baseUrl,
      '/api/data/upsert',
      { key: 'posProducts', payload: { id: 'p1', sale_price: 100000 }, recordId: 'p1' },
      { Authorization: `Bearer ${OWNER_JWT}` }
    );
    expect(res.status).toBe(200);
    expect(res.json.ok).toBe(true);
    expect(mock.upsertCalls).toHaveLength(1);
    expect(mock.upsertCalls[0].table).toBe('pos_products');
    expect(mock.upsertCalls[0].options).toMatchObject({ onConflict: 'id' });
    // pos_products thuộc AUDITED_TABLES → phải có audit log, actor lấy từ JWT (không tin client)
    expect(mock.auditInserts).toHaveLength(1);
    expect(mock.auditInserts[0]).toMatchObject({ table_name: 'pos_products', action: 'upsert' });
    expect((mock.auditInserts[0].snapshot as Record<string, unknown>).actorName).toBe('Chủ cửa hàng');
  });

  it('upsert-many: 1 dòng lỗi → 400 chỉ rõ dòng, KHÔNG ghi dòng nào (validate trước khi ghi)', async () => {
    const res = await post(baseUrl, '/api/data/upsert-many', {
      key: 'posProducts',
      payload: [
        { id: 'p1', sale_price: 1000 },
        { id: 'p2', sale_price: -1 },
      ],
    });
    expect(res.status).toBe(400);
    expect(String(res.json.error)).toMatch(/^Dòng 1:/);
    expect(mock.upsertCalls).toHaveLength(0);
  });

  it('delete: thiếu id → 400; đủ → 200 + xóa đúng bảng đúng id', async () => {
    const bad = await post(baseUrl, '/api/data/delete', { key: 'posProducts' });
    expect(bad.status).toBe(400);

    const ok = await post(baseUrl, '/api/data/delete', { key: 'posProducts', id: 'p9' });
    expect(ok.status).toBe(200);
    expect(mock.deleteCalls).toEqual([{ table: 'pos_products', id: 'p9' }]);
  });

  it('clear: không JWT hoặc role không phải admin → 403, KHÔNG xóa bảng', async () => {
    const noJwt = await post(baseUrl, '/api/data/clear', { key: 'posProducts' });
    expect(noJwt.status).toBe(403);

    const cashier = await post(
      baseUrl,
      '/api/data/clear',
      { key: 'posProducts' },
      { Authorization: `Bearer ${CASHIER_JWT}` }
    );
    expect(cashier.status).toBe(403);
    expect(mock.deleteCalls).toHaveLength(0);
  });

  it('place-tx: thiếu order.id → 400; hợp lệ (không JWT) → gọi RPC với actor null', async () => {
    const bad = await post(baseUrl, '/api/data/pos-orders/place-tx', { order: { total: 1 } });
    expect(bad.status).toBe(400);
    expect(mock.rpcCalls).toHaveLength(0);

    const ok = await post(baseUrl, '/api/data/pos-orders/place-tx', {
      order: { id: 'o1', total: 100000 },
      allowSellOutOfStock: false,
    });
    expect(ok.status).toBe(200);
    expect(mock.rpcCalls).toHaveLength(1);
    expect(mock.rpcCalls[0].fn).toBe('place_pos_order_tx');
    expect(mock.rpcCalls[0].params).toMatchObject({ p_actor_id: null, p_allow_sell_out_of_stock: false });
  });

  it('place-tx: RPC lỗi → 500 (không nuốt lỗi thành 200)', async () => {
    const failing = makeSupabaseMock({ rpcShouldError: true });
    const { server: s2, baseUrl: url2 } = await startApp(failing.client);
    try {
      const res = await post(url2, '/api/data/pos-orders/place-tx', { order: { id: 'o1' } });
      expect(res.status).toBe(500);
    } finally {
      s2.close();
    }
  });
});
