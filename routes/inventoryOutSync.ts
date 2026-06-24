import { Router, RequestHandler } from 'express';
import axios from 'axios';
import { SupabaseClient } from '@supabase/supabase-js';

const SHOP_BOTS = [
  { port: 3001, platform: 'Shopee 1' },
  { port: 3002, platform: 'Shopee 2' },
];

// Bot trả status bằng tiếng Việt (scrape từ UI Shopee)
const STATUS_MAP: Record<string, string> = {
  'Đã giao': 'OK',
  'Đã giao hàng': 'OK',
  'Đã nhận được hàng': 'OK',
  'Đã hủy': 'CANCEL',
  'Đã hủy đơn': 'CANCEL',
  'Hủy': 'CANCEL',
  'Đang hoàn': 'RETURN',
  'Hoàn hàng': 'RETURN',
  'Đang giao': 'SHIPPING',
  'Đã giao cho ĐVVC': 'SHIPPING',
  'Chờ lấy hàng': 'PENDING',
  'Chờ xác nhận': 'PENDING',
};

interface BotOrder {
  order_sn: string;
  status: string;
  cancel_reason: string | null;
  product_sku: string;
  variation: string;
  product_name: string;
  product_price: number;
  quantity: number;
  buyer_paid: number;
  escrow_amount: number;
  commission_fee: number;
  service_fee: number;
  transaction_fee: number;
  piship_fee: number;
  vat_tax: number;
  pit_tax: number;
  province: string;
  shipping_carrier: string;
  order_date: string;
  paid_to_seller_at: string | null;
  return_completed_at: string | null;
  shopIdx: number;
}

// Chuẩn hóa tên ĐVVC từ Shopee sang tên viết tắt
const SHIPPING_UNIT_MAP: [string, string][] = [
  ['giao hang nhanh', 'GHN'],
  ['giao hàng nhanh', 'GHN'],
  ['giao hang tiet kiem', 'GHTK'],
  ['giao hàng tiết kiệm', 'GHTK'],
  ['spx', 'SPX'],
  ['j&t', 'J&T'],
  ['ninja van', 'NJV'],
  ['ninjavan', 'NJV'],
];

function normalizeShippingUnit(raw: string): string {
  if (!raw) return 'SPX';
  const lower = raw.toLowerCase().trim();
  for (const [key, val] of SHIPPING_UNIT_MAP) {
    if (lower.includes(key)) return val;
  }
  return raw;
}

// Chuẩn hóa ngày từ nhiều format: "23:15:39 17/6/2026", "16/06/2026", "2026-06-17"
function parseOrderDate(raw: string): string {
  if (!raw) return new Date().toISOString().slice(0, 10);
  // Format "HH:MM:SS DD/M/YYYY" hoặc "DD/MM/YYYY"
  const withTime = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (withTime) {
    const [, d, m, y] = withTime;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Format "YYYY-MM-DD" đã đúng
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

async function fetchAllBotOrders(port: number, shopIdx: number): Promise<BotOrder[]> {
  const PAGE_SIZE = 200;
  const results: BotOrder[] = [];
  let offset = 0;
  while (true) {
    const resp = await axios.get(
      `http://localhost:${port}/api/orders?limit=${PAGE_SIZE}&offset=${offset}`,
      { timeout: 10_000 }
    );
    const page: BotOrder[] = resp.data?.data ?? [];
    if (page.length === 0) break;
    results.push(...page.map(o => ({ ...o, shopIdx })));
    if (page.length < PAGE_SIZE) break;
    offset += page.length;
  }
  return results;
}

function mapToRow(o: BotOrder) {
  const baseStatus = STATUS_MAP[o.status] ?? 'PENDING';
  // Hoàn đã xong → RETURNED (số lượng sẽ = 0, không tính tồn kho)
  let mappedStatus = baseStatus === 'RETURN' && o.return_completed_at ? 'RETURNED' : baseStatus;
  // Đơn huỷ do giao hàng thất bại (khách không nhận) → FAILED, khác với CANCEL (huỷ trước khi giao)
  if (mappedStatus === 'CANCEL' && o.cancel_reason?.toLowerCase().includes('giao hàng thất bại')) {
    mappedStatus = 'FAILED';
  }
  const date         = parseOrderDate(o.order_date);
  const platform     = SHOP_BOTS[o.shopIdx]?.platform ?? 'Shopee 1';
  const variation    = o.variation ? o.variation.replace(',', '-') : '';
  const sku          = variation ? `${o.product_sku}-${variation}` : (o.product_sku ?? '');

  return {
    order_id:            o.order_sn,
    tracking_number:     o.order_sn,
    date,
    ship_date:           date,
    status:              mappedStatus,
    sku,
    product_name:        o.product_name ?? '',
    quantity:            o.quantity ?? 1,
    sale_price:          o.product_price ?? o.buyer_paid ?? 0,
    customer_paid:       o.buyer_paid ?? 0,
    platform_fee:        Math.abs(o.commission_fee  ?? 0),
    freeship_extra:      Math.abs(o.service_fee     ?? 0),
    payment_fee:         Math.abs(o.transaction_fee ?? 0),
    piship_fee:          Math.abs(o.piship_fee      ?? 0),
    vat_tax:             Math.abs(o.vat_tax         ?? 0),
    personal_income_tax: Math.abs(o.pit_tax         ?? 0),
    affiliate_fee:       0,
    handling_fee:        0,
    ads_cost:            0,
    ads_tax:             0,
    net_profit:          0,
    address:             o.province ?? '',
    shipping_unit:       normalizeShippingUnit(o.shipping_carrier ?? ''),
    platform,
    profit_status:       (mappedStatus === 'CANCEL' || mappedStatus === 'FAILED') ? 'HỦY' : 'CHƯA TÍNH',
  };
}

export async function runInventoryOutSync(supabase: SupabaseClient): Promise<{
  inserted: number; updated: number; skipped: number; botErrors: string[];
}> {
  // 1. Fetch toàn bộ đơn từ cả 2 bot
  const allOrders: BotOrder[] = [];
  const botErrors: string[] = [];

  for (let i = 0; i < SHOP_BOTS.length; i++) {
    const bot = SHOP_BOTS[i];
    try {
      const orders = await fetchAllBotOrders(bot.port, i);
      allOrders.push(...orders);
    } catch {
      botErrors.push(`Bot ${bot.platform} (port ${bot.port}) không phản hồi`);
    }
  }

  if (allOrders.length === 0) {
    return { inserted: 0, updated: 0, skipped: 0, botErrors };
  }

  // 2. Lấy danh sách (order_id, sku) + status đang có trong Supabase
  const allExisting: { order_id: string; sku: string; status: string }[] = [];
  const PAGE = 1000;
  let exOffset = 0;
  while (true) {
    const { data: page } = await supabase
      .from('shopee_inventory_out')
      .select('order_id, sku, status')
      .not('order_id', 'is', null)
      .order('id', { ascending: true })
      .range(exOffset, exOffset + PAGE - 1);
    if (!page || page.length === 0) break;
    allExisting.push(...page);
    if (page.length < PAGE) break;
    exOffset += page.length;
  }

  // Key: "order_id||sku" để xử lý đúng đơn nhiều SKU
  const existingMap = new Map<string, string>(
    allExisting.map((r) => [`${r.order_id}||${r.sku ?? ''}`, r.status])
  );

  // 3. Tách thành 2 nhóm: đơn mới và đơn cần cập nhật
  const seenInBatch = new Set<string>();
  const newOrders: BotOrder[] = [];
  const toUpdate: BotOrder[] = [];

  for (const o of allOrders) {
    if (!o.order_sn) continue;
    const row = mapToRow(o);
    const batchKey = `${o.order_sn}||${row.sku ?? ''}`;
    if (seenInBatch.has(batchKey)) continue;
    seenInBatch.add(batchKey);

    if (!existingMap.has(batchKey)) {
      newOrders.push(o);
    } else {
      // Luôn update lại — để ghi đúng fee từ bot API vào những đơn trước đây bị ghi sai
      toUpdate.push(o);
    }
  }

  // 4. Insert đơn mới — dùng upsert ignoreDuplicates để an toàn khi 2 sync chạy đồng thời (AUDIT-019)
  let inserted = 0;
  if (newOrders.length > 0) {
    const rows = newOrders.map(mapToRow);
    const { error } = await supabase
      .from('shopee_inventory_out')
      .upsert(rows, { onConflict: 'order_id,sku', ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    inserted = rows.length;
  }

  // 5. Cập nhật fee fields — batch upsert thay vì serial loop (AUDIT-015)
  let updated = 0;
  if (toUpdate.length > 0) {
    const updateRows = toUpdate.map(mapToRow);
    const { error: updateError } = await supabase
      .from('shopee_inventory_out')
      .upsert(updateRows, { onConflict: 'order_id,sku', ignoreDuplicates: false });
    if (updateError) throw new Error(updateError.message);
    updated = updateRows.length;
  }

  return { inserted, updated, skipped: allOrders.length - inserted - updated, botErrors };
}

export function createInventoryOutSyncRouter(supabase: SupabaseClient, requireAuth: RequestHandler) {
  const router = Router();

  router.post('/api/inventory-out/sync-from-bot', requireAuth, async (req, res) => {
    try {
      const result = await runInventoryOutSync(supabase);
      if (result.inserted === 0 && result.updated === 0 && result.botErrors.length === SHOP_BOTS.length) {
        res.status(503).json({ ok: false, error: `Không lấy được đơn hàng. ${result.botErrors.join('; ')}` });
        return;
      }
      res.json({
        ok: true,
        inserted: result.inserted,
        updated: result.updated,
        skipped: result.skipped,
        botErrors: result.botErrors.length > 0 ? result.botErrors : undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ ok: false, error: msg });
    }
  });

  return router;
}
