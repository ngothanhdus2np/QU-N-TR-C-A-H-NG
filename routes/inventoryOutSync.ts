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

interface BotOrderItem {
  product_name: string;
  product_sku: string;
  quantity: number;
  price: number;
  variation: string;
}

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
  items?: BotOrderItem[];
  escrow_amount: number;
  commission_fee: number;
  service_fee: number;
  transaction_fee: number;
  piship_fee: number;
  ams_commission_fee: number;
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

// 1 đơn Shopee có thể có nhiều sản phẩm khác nhau (items[]) — tách thành nhiều
// dòng trong shopee_inventory_out (1 dòng/sản phẩm, khớp key order_id+sku).
// Phí cấp đơn (hoa hồng/vận chuyển/thuế...) không tách theo sản phẩm ở nguồn Shopee
// → chia theo TỶ TRỌNG GIÁ TRỊ (subtotal = price*quantity) từng sản phẩm trong đơn.
function mapOrderToRows(o: BotOrder) {
  const items: BotOrderItem[] = (o.items && o.items.length > 0)
    ? o.items
    : [{ product_name: o.product_name ?? '', product_sku: o.product_sku ?? '', quantity: o.quantity ?? 1, price: o.product_price ?? 0, variation: o.variation ?? '' }];

  const subtotals = items.map(it => (it.price || 0) * (it.quantity || 1));
  const totalSubtotal = subtotals.reduce((a, b) => a + b, 0);
  const equalShare = 1 / items.length;

  const baseStatus = STATUS_MAP[o.status] ?? 'PENDING';
  // Hoàn đã xong → RETURNED (số lượng sẽ = 0, không tính tồn kho)
  let mappedStatus = baseStatus === 'RETURN' && o.return_completed_at ? 'RETURNED' : baseStatus;
  // Đơn huỷ do giao hàng thất bại (khách không nhận) → FAILED, khác với CANCEL (huỷ trước khi giao)
  if (mappedStatus === 'CANCEL' && o.cancel_reason?.toLowerCase().includes('giao hàng thất bại')) {
    mappedStatus = 'FAILED';
  }
  const date     = parseOrderDate(o.order_date);
  const platform = SHOP_BOTS[o.shopIdx]?.platform ?? 'Shopee 1';

  return items.map((it, idx) => {
    const itemSubtotal = subtotals[idx];
    const share = totalSubtotal > 0 ? itemSubtotal / totalSubtotal : equalShare;
    const prorate = (val: number) => Math.round((val || 0) * share);
    const variation = it.variation ? it.variation.replace(',', '-') : '';
    const sku       = variation ? `${it.product_sku}-${variation}` : (it.product_sku ?? '');

    // Giá trị hàng: ưu tiên o.product_price (MERCHANDISE_SUBTOTAL lấy trực tiếp từ
    // API tính phí của Shopee — khớp đúng với escrow_amount thật) hơn itemSubtotal
    // (giá cào từ trang danh sách đơn, có thể lệch so với giá Shopee dùng để tính
    // tiền trả về). Chỉ dùng itemSubtotal khi product_price chưa có (đơn chưa fetch
    // income xong). Xác minh 2026-07-08: lệch tới 30-329k đ/đơn nếu dùng sai nguồn.
    const hasOrderLevelPrice = (o.product_price ?? 0) > 0;

    return {
      order_id:            o.order_sn,
      tracking_number:     o.order_sn,
      date,
      ship_date:           date,
      status:              mappedStatus,
      sku,
      product_name:        it.product_name ?? '',
      quantity:            it.quantity ?? 1,
      sale_price:          hasOrderLevelPrice ? prorate(o.product_price) : (itemSubtotal > 0 ? itemSubtotal : prorate(o.buyer_paid ?? 0)),
      customer_paid:       prorate(o.buyer_paid ?? 0),
      platform_fee:        Math.abs(prorate(o.commission_fee  ?? 0)),
      freeship_extra:      Math.abs(prorate(o.service_fee     ?? 0)),
      payment_fee:         Math.abs(prorate(o.transaction_fee ?? 0)),
      piship_fee:          Math.abs(prorate(o.piship_fee      ?? 0)),
      shopee_ads_fee:      Math.abs(prorate(o.ams_commission_fee ?? 0)),
      vat_tax:             Math.abs(prorate(o.vat_tax         ?? 0)),
      personal_income_tax: Math.abs(prorate(o.pit_tax         ?? 0)),
      affiliate_fee:       0,
      handling_fee:        0,
      ads_cost:            0,
      ads_tax:             0,
      net_profit:          0,
      address:             o.province ?? '',
      shipping_unit:       normalizeShippingUnit(o.shipping_carrier ?? ''),
      platform,
      profit_status:       (mappedStatus === 'CANCEL' || mappedStatus === 'FAILED') ? 'HỦY' : 'CHƯA TÍNH',
      cancel_reason:       o.cancel_reason ?? null,
    };
  });
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

  // 3. Tách thành 2 nhóm: dòng (đơn+sku) mới và dòng cần cập nhật — 1 đơn nhiều
  // sản phẩm sẽ ra nhiều dòng ở đây (mapOrderToRows), mỗi dòng 1 sku riêng.
  const seenInBatch = new Set<string>();
  const newRows: ReturnType<typeof mapOrderToRows> = [];
  const toUpdateRows: ReturnType<typeof mapOrderToRows> = [];
  let totalRowsSeen = 0;

  for (const o of allOrders) {
    if (!o.order_sn) continue;
    const rows = mapOrderToRows(o);
    totalRowsSeen += rows.length;
    for (const row of rows) {
      const batchKey = `${row.order_id}||${row.sku ?? ''}`;
      if (seenInBatch.has(batchKey)) continue;
      seenInBatch.add(batchKey);

      if (!existingMap.has(batchKey)) {
        newRows.push(row);
      } else {
        // Luôn update lại — để ghi đúng fee từ bot API vào những đơn trước đây bị ghi sai
        toUpdateRows.push(row);
      }
    }
  }

  // 4. Insert dòng mới — dùng upsert ignoreDuplicates để an toàn khi 2 sync chạy đồng thời (AUDIT-019)
  let inserted = 0;
  if (newRows.length > 0) {
    const { error } = await supabase
      .from('shopee_inventory_out')
      .upsert(newRows, { onConflict: 'order_id,sku', ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    inserted = newRows.length;
  }

  // 5. Cập nhật fee fields — batch upsert thay vì serial loop (AUDIT-015)
  // QUAN TRỌNG: KHÔNG ghi đè 4 cột phái sinh (handling_fee/ads_cost/ads_tax/net_profit) —
  // đó là kết quả do job phân bổ QC (routes/adsSpendSync.ts) tính, không phải dữ liệu gốc
  // từ bot. mapOrderToRows khởi tạo chúng = 0; nếu upsert cả 4 cột này thì cứ mỗi lần sync
  // (10 phút/lần) sẽ xoá sạch phân bổ QC + phí vận hành. Bỏ 4 cột khỏi payload update →
  // PostgREST chỉ SET các cột còn lại, 4 cột derived giữ nguyên giá trị đang có.
  let updated = 0;
  if (toUpdateRows.length > 0) {
    const toUpdatePayload = toUpdateRows.map((row) => {
      const copy: Record<string, unknown> = { ...row };
      delete copy.handling_fee;
      delete copy.ads_cost;
      delete copy.ads_tax;
      delete copy.net_profit;
      return copy;
    });
    const { error: updateError } = await supabase
      .from('shopee_inventory_out')
      .upsert(toUpdatePayload, { onConflict: 'order_id,sku', ignoreDuplicates: false });
    if (updateError) throw new Error(updateError.message);
    updated = toUpdateRows.length;
  }

  return { inserted, updated, skipped: totalRowsSeen - inserted - updated, botErrors };
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
