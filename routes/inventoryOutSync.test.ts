import { describe, expect, it, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { SupabaseClient } from '@supabase/supabase-js';
import { runInventoryOutSync } from './inventoryOutSync';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

interface ExistingRow { order_id: string; sku: string; status: string }

// Mock Supabase tối giản cho đúng các lời gọi runInventoryOutSync dùng (audit
// 2026-07-10 mục N: routes/ 0% coverage — mapOrderToRows/prorate/status-map chưa test).
function makeSupabaseMock(opts: { existingRows?: ExistingRow[] }) {
  const upsertCalls: { table: string; rows: Record<string, unknown>[]; options: Record<string, unknown> }[] = [];

  const from = vi.fn((table: string) => {
    if (table === 'shopee_inventory_out') {
      return {
        select: () => ({
          not: () => ({
            order: () => ({
              range: (from: number, to: number) => {
                const rows = opts.existingRows ?? [];
                return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
              },
            }),
          }),
        }),
        upsert: (rows: Record<string, unknown>[], options: Record<string, unknown>) => {
          upsertCalls.push({ table, rows, options });
          return Promise.resolve({ error: null });
        },
      };
    }
    throw new Error(`Unhandled table in mock: ${table}`);
  });

  return { client: { from } as unknown as SupabaseClient, upsertCalls };
}

// Đơn thô kiểu bot trả về (scrape Shopee) — field tối thiểu mapOrderToRows dùng.
function mockBotOrders(byPort: Record<number, unknown[]>) {
  mockedAxios.get.mockImplementation((url: string) => {
    const match = url.match(/localhost:(\d+)\/api\/orders\?limit=\d+&offset=(\d+)/);
    if (!match) return Promise.resolve({ data: { data: [] } });
    const port = Number(match[1]);
    const offset = Number(match[2]);
    const all = byPort[port] ?? [];
    // 1 trang duy nhất (offset=0) trả hết, các trang sau rỗng — khớp PAGE_SIZE=200 > số đơn test
    return Promise.resolve({ data: { data: offset === 0 ? all : [] } });
  });
}

const baseBotOrder = (overrides: Record<string, unknown>) => ({
  order_sn: 'ORDER-1',
  status: 'Đã giao',
  cancel_reason: null,
  product_sku: 'SKU-A',
  variation: '',
  product_name: 'Sản phẩm test',
  product_price: 100000,
  quantity: 1,
  buyer_paid: 100000,
  escrow_amount: 90000,
  commission_fee: 5000,
  service_fee: 0,
  transaction_fee: 1000,
  piship_fee: 0,
  ams_commission_fee: 0,
  vat_tax: 0,
  pit_tax: 0,
  province: 'HCM',
  shipping_carrier: 'Giao hàng nhanh',
  order_date: '2026-07-09',
  paid_to_seller_at: null,
  return_completed_at: null,
  ...overrides,
});

describe('runInventoryOutSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('map đơn mới đúng platform/status/fee và insert qua upsert ignoreDuplicates=true', async () => {
    mockBotOrders({
      3001: [baseBotOrder({})],
      3002: [],
    });
    const { client, upsertCalls } = makeSupabaseMock({ existingRows: [] });

    const result = await runInventoryOutSync(client);

    expect(result.inserted).toBe(1);
    expect(result.updated).toBe(0);
    expect(upsertCalls).toHaveLength(1);
    const [{ rows, options }] = upsertCalls;
    expect(options).toMatchObject({ onConflict: 'order_id,sku', ignoreDuplicates: true });
    expect(rows[0]).toMatchObject({
      order_id: 'ORDER-1',
      sku: 'SKU-A',
      status: 'OK', // "Đã giao" → OK theo STATUS_MAP
      platform: 'Shopee 1', // đơn từ bot port 3001
      date: '2026-07-09',
      shipping_unit: 'GHN', // "Giao hàng nhanh" → GHN theo SHIPPING_UNIT_MAP
      platform_fee: 5000, // 1 item duy nhất → share = 100%, prorate giữ nguyên
    });
  });

  it('đơn đã tồn tại (order_id+sku) → update qua upsert ignoreDuplicates=false, KHÔNG đụng 4 cột derived', async () => {
    mockBotOrders({ 3001: [baseBotOrder({})], 3002: [] });
    const { client, upsertCalls } = makeSupabaseMock({
      existingRows: [{ order_id: 'ORDER-1', sku: 'SKU-A', status: 'OK' }],
    });

    const result = await runInventoryOutSync(client);

    expect(result.inserted).toBe(0);
    expect(result.updated).toBe(1);
    const [{ rows, options }] = upsertCalls;
    expect(options).toMatchObject({ onConflict: 'order_id,sku', ignoreDuplicates: false });
    // Không được ghi đè 4 cột phái sinh do job phân bổ QC tính (AUDIT-015 comment trong source)
    expect(rows[0]).not.toHaveProperty('handling_fee');
    expect(rows[0]).not.toHaveProperty('ads_cost');
    expect(rows[0]).not.toHaveProperty('ads_tax');
    expect(rows[0]).not.toHaveProperty('net_profit');
  });

  it('đơn huỷ do giao hàng thất bại → FAILED (khác CANCEL thường)', async () => {
    mockBotOrders({
      3001: [
        baseBotOrder({
          order_sn: 'ORDER-FAILED',
          status: 'Đã hủy',
          cancel_reason: 'Giao hàng thất bại 3 lần',
        }),
      ],
      3002: [],
    });
    const { client, upsertCalls } = makeSupabaseMock({ existingRows: [] });

    await runInventoryOutSync(client);

    expect(upsertCalls[0].rows[0]).toMatchObject({ status: 'FAILED' });
  });

  it('bot 1 shop không phản hồi vẫn xử lý được shop còn lại, ghi nhận lỗi', async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('localhost:3001')) return Promise.reject(new Error('bot down'));
      return Promise.resolve({ data: { data: [baseBotOrder({ order_sn: 'ORDER-2' })] } });
    });
    const { client, upsertCalls } = makeSupabaseMock({ existingRows: [] });

    const result = await runInventoryOutSync(client);

    expect(result.botErrors).toHaveLength(1);
    expect(result.botErrors[0]).toMatch(/Shopee 1/);
    expect(result.inserted).toBe(1);
    expect(upsertCalls[0].rows[0]).toMatchObject({ order_id: 'ORDER-2', platform: 'Shopee 2' });
  });
});
