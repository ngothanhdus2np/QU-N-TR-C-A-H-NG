import { describe, expect, it, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { SupabaseClient } from '@supabase/supabase-js';
import { runAdsSpendSync } from './adsSpendSync';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

// Mock Supabase tối giản, chỉ hỗ trợ đúng các lời gọi mà runAdsSpendSync dùng (audit
// 2026-07-10 mục N: routes/ trước đây 0% coverage, đặc biệt job phân bổ QC mới).
interface InventoryOutRowFixture {
  id: string;
  date: string;
  sku: string;
  quantity: number;
  status: string;
  sale_price: number;
  platform_fee: number;
  payment_fee: number;
  freeship_extra: number;
  affiliate_fee: number;
  handling_fee: number;
  ads_cost: number;
  piship_fee: number;
  vat_tax: number;
  personal_income_tax: number;
  shopee_ads_fee: number;
  net_profit: number;
}

function makeSupabaseMock(opts: {
  sourceRows?: { sku: string; import_price: number }[];
  variableCosts?: { quantity: number; unitPrice: number }[];
  rowsByPlatform?: Record<string, InventoryOutRowFixture[]>;
  updateShouldError?: boolean;
}) {
  const updateCalls: { table: string; fields: Record<string, unknown>; id: string }[] = [];
  const auditInserts: Record<string, unknown>[] = [];

  const from = vi.fn((table: string) => {
    if (table === 'shopee_source_data') {
      return { select: () => Promise.resolve({ data: opts.sourceRows ?? [], error: null }) };
    }
    if (table === 'system_configs') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: opts.variableCosts ? { value: { variableCosts: opts.variableCosts } } : null,
                error: null,
              }),
          }),
        }),
      };
    }
    if (table === 'shopee_ads_wallet_transactions') {
      return { upsert: () => Promise.resolve({ error: null }) };
    }
    if (table === 'shopee_inventory_out') {
      return {
        select: () => ({
          eq: (_col: string, platform: string) => ({
            range: (from: number, to: number) => {
              const rows = opts.rowsByPlatform?.[platform] ?? [];
              return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
            },
          }),
        }),
        update: (fields: Record<string, unknown>) => ({
          eq: (_col: string, id: string) => {
            updateCalls.push({ table, fields, id });
            return Promise.resolve({ error: opts.updateShouldError ? { message: 'update failed' } : null });
          },
        }),
      };
    }
    if (table === 'audit_logs') {
      return {
        insert: (row: Record<string, unknown>) => {
          auditInserts.push(row);
          return Promise.resolve({ error: null });
        },
      };
    }
    throw new Error(`Unhandled table in mock: ${table}`);
  });

  return { client: { from } as unknown as SupabaseClient, updateCalls, auditInserts };
}

// axios.post (trigger ví) reject ngay → triggerAndPollWallet throw trước vòng poll 2s,
// rơi vào catch best-effort của bước 1 — tránh chờ thật 2s/bot trong test.
function mockWalletTriggerFails() {
  mockedAxios.post.mockRejectedValue(new Error('wallet bot unavailable'));
}

function mockAdsHistory(byPort: Record<number, Record<string, { cost_vnd: number }> | null>) {
  mockedAxios.get.mockImplementation((url: string) => {
    const match = url.match(/localhost:(\d+)/);
    const port = match ? Number(match[1]) : -1;
    const history = byPort[port];
    return Promise.resolve({ data: history ? { ok: true, data: history } : { ok: false } });
  });
}

const baseRow = (overrides: Partial<InventoryOutRowFixture>): InventoryOutRowFixture => ({
  id: 'row-1',
  date: '2026-07-09',
  sku: 'SKU-A',
  quantity: 1,
  status: 'OK',
  sale_price: 100000,
  platform_fee: 0,
  payment_fee: 0,
  freeship_extra: 0,
  affiliate_fee: 0,
  handling_fee: 0,
  ads_cost: 0,
  piship_fee: 0,
  vat_tax: 0,
  personal_income_tax: 0,
  shopee_ads_fee: 0,
  net_profit: 0,
  ...overrides,
});

describe('runAdsSpendSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWalletTriggerFails();
  });

  it('chia đều tiền QC CHỈ cho đơn hiệu quả (OK/SHIPPING), đơn CANCEL nhận 0', async () => {
    mockAdsHistory({
      3001: { '2026-07-09': { cost_vnd: 100000 } },
      3002: {},
    });
    const { client, updateCalls } = makeSupabaseMock({
      sourceRows: [{ sku: 'SKU-A', import_price: 50000 }],
      rowsByPlatform: {
        'Shopee 1': [
          baseRow({ id: 'row-ok', status: 'OK' }),
          // Đơn CANCEL đã ở đúng trạng thái 0 sẵn (ads_cost/net_profit mặc định của
          // baseRow) → job coi là "unchanged", không gọi update — đúng tối ưu tránh
          // ghi Supabase thừa (xem test "bỏ qua update khi kết quả không đổi").
          baseRow({ id: 'row-cancel', status: 'CANCEL', sale_price: 0 }),
        ],
      },
    });

    const result = await runAdsSpendSync(client);

    expect(result.errors).toEqual([]);
    expect(updateCalls).toHaveLength(1);
    const okUpdate = updateCalls.find(c => c.id === 'row-ok')!;
    // Chỉ 1 đơn hiệu quả trong ngày → gánh toàn bộ 100.000đ QC
    expect(okUpdate.fields.ads_cost).toBe(100000);
    expect(okUpdate.fields.ads_tax).toBeCloseTo(100000 * 0.08);
    expect(updateCalls.find(c => c.id === 'row-cancel')).toBeUndefined();
  });

  it('bỏ qua ngày có tổng QC không hợp lệ (âm/NaN) từ bot, không ghi ads_cost rác', async () => {
    mockAdsHistory({
      3001: { '2026-07-09': { cost_vnd: -500 } },
      3002: {},
    });
    const { client, updateCalls } = makeSupabaseMock({
      rowsByPlatform: {
        'Shopee 1': [baseRow({ id: 'row-1', status: 'OK' })],
      },
    });

    const result = await runAdsSpendSync(client);

    expect(updateCalls).toHaveLength(0);
    expect(result.errors[0]).toMatch(/không hợp lệ/);
  });

  it('bỏ qua update khi kết quả không đổi (unchanged) — tránh ghi Supabase thừa', async () => {
    mockAdsHistory({
      3001: { '2026-07-09': { cost_vnd: 8000 } },
      3002: {},
    });
    // Đơn đã có sẵn đúng ads_cost/net_profit khớp kết quả tính lại → unchanged, skip update
    const { client, updateCalls } = makeSupabaseMock({
      rowsByPlatform: {
        'Shopee 1': [
          baseRow({
            id: 'row-1',
            status: 'OK',
            sale_price: 8000,
            ads_cost: 8000,
            net_profit: 8000 - 8000 - 8000 * 0.08,
          }),
        ],
      },
    });

    const result = await runAdsSpendSync(client);

    expect(updateCalls).toHaveLength(0);
    expect(result.updatedOrders).toBe(0);
  });

  it('ghi 1 dòng audit_logs tổng hợp khi có đơn được cập nhật', async () => {
    mockAdsHistory({
      3001: { '2026-07-09': { cost_vnd: 50000 } },
      3002: {},
    });
    const { client, auditInserts } = makeSupabaseMock({
      rowsByPlatform: { 'Shopee 1': [baseRow({ id: 'row-1', status: 'OK' })] },
    });

    await runAdsSpendSync(client);

    expect(auditInserts).toHaveLength(1);
    expect(auditInserts[0]).toMatchObject({ table_name: 'shopee_inventory_out', action: 'update' });
  });
});
