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
  shopIdx: number;
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
  const mappedStatus = STATUS_MAP[o.status] ?? 'PENDING';
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
    shipping_unit:       o.shipping_carrier ?? 'SPX',
    platform,
    profit_status:       'CHƯA TÍNH',
  };
}

export function createInventoryOutSyncRouter(supabase: SupabaseClient, requireAuth: RequestHandler) {
  const router = Router();

  router.post('/api/inventory-out/sync-from-bot', requireAuth, async (req, res) => {
    // 1. Fetch toàn bộ đơn từ cả 2 bot (tất cả pages)
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
      res.status(503).json({ ok: false, error: `Không lấy được đơn hàng. ${botErrors.join('; ')}` });
      return;
    }

    // 2. Lấy danh sách order_id + status đang có trong Supabase (paginate để không bị limit)
    const allExisting: { order_id: string; status: string }[] = [];
    const PAGE = 1000;
    let exOffset = 0;
    while (true) {
      const { data: page } = await supabase
        .from('shopee_inventory_out')
        .select('order_id, status')
        .not('order_id', 'is', null)
        .range(exOffset, exOffset + PAGE - 1);
      if (!page || page.length === 0) break;
      allExisting.push(...page);
      if (page.length < PAGE) break;
      exOffset += page.length;
    }

    const existingMap = new Map<string, string>(
      allExisting.map((r) => [r.order_id, r.status])
    );

    // 3. Tách thành 2 nhóm: đơn mới và đơn cần cập nhật status
    const newOrders: BotOrder[] = [];
    const toUpdate: { order_id: string; status: string }[] = [];

    for (const o of allOrders) {
      if (!o.order_sn) continue;
      const newStatus = STATUS_MAP[o.status] ?? 'PENDING';
      if (!existingMap.has(o.order_sn)) {
        newOrders.push(o);
      } else if (existingMap.get(o.order_sn) !== newStatus) {
        toUpdate.push({ order_id: o.order_sn, status: newStatus });
      }
    }

    // 4. Insert đơn mới
    let inserted = 0;
    if (newOrders.length > 0) {
      const rows = newOrders.map(mapToRow);
      const { error } = await supabase.from('shopee_inventory_out').insert(rows);
      if (error) {
        res.status(500).json({ ok: false, error: error.message });
        return;
      }
      inserted = rows.length;
    }

    // 5. Cập nhật status cho đơn đã có (chỉ update status, giữ nguyên giá vốn và dữ liệu tay nhập)
    let updated = 0;
    for (const { order_id, status } of toUpdate) {
      await supabase
        .from('shopee_inventory_out')
        .update({ status })
        .eq('order_id', order_id);
      updated++;
    }

    res.json({
      ok: true,
      inserted,
      updated,
      skipped: allOrders.length - inserted - updated,
      botErrors: botErrors.length > 0 ? botErrors : undefined,
    });
  });

  return router;
}
