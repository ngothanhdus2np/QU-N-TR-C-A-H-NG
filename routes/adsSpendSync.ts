import { Router, RequestHandler } from 'express';
import axios from 'axios';
import { SupabaseClient } from '@supabase/supabase-js';
import { calcShopeeNetProfit } from '../src/lib/shopeeProfit';

const SHOP_BOTS = [
  { port: 3001, platform: 'Shopee 1' },
  { port: 3002, platform: 'Shopee 2' },
];

// Đơn "hiệu quả" = đã giao hoặc đang giao — khớp đúng tiêu chí đã chốt trong
// components/revenue/useShopeeInventoryOut.ts (isEffectiveOrder). Trước đây dùng
// shopee_ads_fee > 0 nhưng field đó đồng bộ trễ vài ngày do Shopee quyết toán chậm,
// khiến các ngày gần nhất luôn không phân bổ được gì.
const EFFECTIVE_STATUSES = ['OK', 'SHIPPING'];

// Thuế QC = 8% tiền QC — User chốt 2026-07-10, khớp với ADS_TAX_RATE trong
// components/revenue/useShopeeInventoryOut.ts (frontend).
const ADS_TAX_RATE = 0.08;

interface AdsWalletTransaction {
  transactionId: string;
  txDate: string;
  amount: number;
  transactionGroup: string | null;
  transactionType: string | null;
}

interface AdsSpendBotResult {
  ok: boolean;
  transactions?: AdsWalletTransaction[];
  error?: string;
}

interface AdsHistoryDay { cost_vnd: number; }

interface InventoryOutRow {
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

// Lợi nhuận — công thức chuẩn dùng chung với UI và các đường ghi frontend
// (src/lib/shopeeProfit.ts, audit 2026-07-11 mục A) — chỉ map snake_case → camelCase.
function calcNetProfit(r: InventoryOutRow, importPrice: number, newAdsCost: number, newAdsTax: number, handlingFee: number): number {
  return calcShopeeNetProfit(
    r.status,
    {
      salePrice: r.sale_price || 0,
      platformFee: r.platform_fee || 0,
      paymentFee: r.payment_fee || 0,
      freeshipExtra: r.freeship_extra || 0,
      affiliateFee: r.affiliate_fee || 0,
      pishipFee: r.piship_fee || 0,
      vatTax: r.vat_tax || 0,
      personalIncomeTax: r.personal_income_tax || 0,
      shopeeAdsFee: r.shopee_ads_fee || 0,
    },
    { importPrice, adsCost: newAdsCost, adsTax: newAdsTax, handlingFee }
  );
}

// Trigger bot lấy dữ liệu ví quảng cáo rồi poll kết quả — chỉ dùng để lưu lại giao
// dịch ví gốc (audit trail), không dùng để phân bổ (xem fetchAdsHistory bên dưới).
async function triggerAndPollWallet(port: number): Promise<AdsSpendBotResult> {
  await axios.post(`http://localhost:${port}/api/ads-spend/sync`, {}, { timeout: 10_000 });

  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2000));
    const { data } = await axios.get(`http://localhost:${port}/api/ads-spend/status`, { timeout: 10_000 });
    if (!data.running && data.result) return data.result;
  }
  return { ok: false, error: 'Timeout chờ bot lấy dữ liệu ví quảng cáo' };
}

// Lịch sử chi phí quảng cáo theo ngày (đã lưu sẵn trên bot, không cần scrape lại) —
// nguồn dữ liệu chính xác để phân bổ, xem bots/adsHistoryBot.js (repo shopee-monitor).
async function fetchAdsHistory(port: number): Promise<Record<string, AdsHistoryDay> | null> {
  const { data } = await axios.get(`http://localhost:${port}/api/ads-report/history`, { timeout: 10_000 });
  return data.ok ? data.data : null;
}

export async function runAdsSpendSync(supabase: SupabaseClient): Promise<{
  updatedDays: number; updatedOrders: number; transactionsSaved: number; errors: string[];
}> {
  const errors: string[] = [];
  let updatedDays = 0;
  let updatedOrders = 0;
  let transactionsSaved = 0;

  // Giá vốn theo SKU — cần để tính lại lợi nhuận mỗi khi ads_cost đổi (dùng chung
  // cho cả 2 shop, bảng shopee_source_data không tách theo platform).
  const { data: sourceRows, error: sourceError } = await supabase
    .from('shopee_source_data')
    .select('sku, import_price');
  if (sourceError) {
    return { updatedDays: 0, updatedOrders: 0, transactionsSaved: 0, errors: [`Lỗi đọc giá vốn: ${sourceError.message}`] };
  }
  const importPriceBySku = new Map((sourceRows || []).map(r => [r.sku, Number(r.import_price) || 0]));

  // Phí Vận Hành/đơn = tổng "Chi phí biến đổi" đã cấu hình (Chi phí > Biến đổi) —
  // User chốt 2026-07-10: dùng tổng variableCosts, KHÔNG dùng field handlingFeePerOrder
  // (field đó không được cập nhật/dùng ở đâu khác, có vẻ là giá trị cũ không còn đúng).
  let totalVariableCosts = 0;
  const { data: costsConfig, error: costsError } = await supabase
    .from('system_configs')
    .select('value')
    .eq('key', 'shopee_costs')
    .maybeSingle();
  if (!costsError && costsConfig?.value?.variableCosts) {
    totalVariableCosts = (costsConfig.value.variableCosts as { quantity: number; unitPrice: number }[])
      .reduce((sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0);
  }

  for (const bot of SHOP_BOTS) {
    // 1. Lưu giao dịch ví (audit trail) — best-effort, lỗi không chặn bước phân bổ
    try {
      const walletResult = await triggerAndPollWallet(bot.port);
      if (walletResult.ok && walletResult.transactions && walletResult.transactions.length > 0) {
        const rows = walletResult.transactions.map(tx => ({
          platform: bot.platform,
          transaction_id: tx.transactionId,
          tx_date: tx.txDate,
          amount: tx.amount,
          transaction_group: tx.transactionGroup,
          transaction_type: tx.transactionType,
        }));
        const { error: txError } = await supabase
          .from('shopee_ads_wallet_transactions')
          .upsert(rows, { onConflict: 'platform,transaction_id', ignoreDuplicates: true });
        if (!txError) transactionsSaved += rows.length;
      }
    } catch {
      // Ví quảng cáo không lấy được không sao — vẫn tiếp tục phân bổ theo report/history bên dưới
    }

    // 2. Lấy lịch sử chi phí quảng cáo theo ngày
    let history: Record<string, AdsHistoryDay> | null;
    try {
      history = await fetchAdsHistory(bot.port);
    } catch {
      errors.push(`Bot ${bot.platform} (port ${bot.port}) không phản hồi khi lấy lịch sử QC`);
      continue;
    }
    if (!history) {
      errors.push(`${bot.platform}: không lấy được lịch sử quảng cáo`);
      continue;
    }

    // 3. Lấy toàn bộ đơn của shop này, gộp theo ngày để phân bổ — PHẢI phân trang vì
    // Supabase REST mặc định giới hạn 1000 dòng/query (thiếu các đơn gần nhất nếu bỏ qua).
    const PAGE_SIZE = 1000;
    const rows: InventoryOutRow[] = [];
    let rowsError: { message: string } | null = null;
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data: page, error: pageError } = await supabase
        .from('shopee_inventory_out')
        .select('id, date, sku, quantity, status, sale_price, platform_fee, payment_fee, freeship_extra, affiliate_fee, handling_fee, ads_cost, piship_fee, vat_tax, personal_income_tax, shopee_ads_fee, net_profit')
        .eq('platform', bot.platform)
        .range(from, from + PAGE_SIZE - 1);
      if (pageError) { rowsError = pageError; break; }
      if (!page || page.length === 0) break;
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }

    if (rowsError) {
      errors.push(`${bot.platform}: lỗi đọc đơn hàng — ${rowsError.message}`);
      continue;
    }
    if (!rows || rows.length === 0) continue;

    const byDate = new Map<string, typeof rows>();
    for (const r of rows) {
      if (!byDate.has(r.date)) byDate.set(r.date, []);
      byDate.get(r.date)!.push(r);
    }

    for (const [date, dateRows] of byDate) {
      const rawAds = history[date]?.cost_vnd;
      // Bỏ qua ngày có số liệu QC bất thường từ bot (NaN/Infinity/âm) — không ghi
      // ads_cost/net_profit rác vào Supabase. Ngày không có dữ liệu (undefined) = 0 (hữu cơ).
      if (rawAds != null && (!Number.isFinite(rawAds) || rawAds < 0)) {
        errors.push(`${bot.platform} ${date}: tổng QC không hợp lệ (${rawAds}) — bỏ qua`);
        continue;
      }
      const totalAds = Number.isFinite(rawAds) && (rawAds as number) >= 0 ? (rawAds as number) : 0;
      const effectiveRows = dateRows.filter(r => EFFECTIVE_STATUSES.includes(r.status));
      const adsPerOrder = effectiveRows.length > 0 ? totalAds / effectiveRows.length : 0;

      // Gom mọi đơn cần đổi của ngày rồi upsert 1 request (audit 2026-07-11 mục D) —
      // trước đây update từng dòng, lỗi giữa chừng để ngày ở trạng thái nửa cập nhật.
      // Payload kèm `date` (cột NOT NULL duy nhất không default) cho nhánh insert của
      // upsert; onConflict id → thực tế luôn là UPDATE các cột có trong payload.
      const updates: { id: string; date: string; ads_cost: number; ads_tax: number; handling_fee: number; net_profit: number }[] = [];
      for (const r of dateRows) {
        const isEffective = EFFECTIVE_STATUSES.includes(r.status);
        const newAdsCost = isEffective ? adsPerOrder : 0;
        const newAdsTax = newAdsCost * ADS_TAX_RATE;
        const importPrice = (importPriceBySku.get(r.sku) || 0) * (r.quantity || 1);
        const netProfit = calcNetProfit(r, importPrice, newAdsCost, newAdsTax, totalVariableCosts);

        // So cả kết quả net_profit (không chỉ input ads_cost/handling_fee) — để lần sửa
        // công thức này (thêm PiShip/VAT/TNCN/Ads Shopee) áp dụng lại cho đơn cũ dù
        // ads_cost/handling_fee của đơn đó vốn đã đúng từ trước.
        const unchanged =
          Math.abs((r.ads_cost || 0) - newAdsCost) < 1 &&
          Math.abs((r.handling_fee || 0) - totalVariableCosts) < 1 &&
          Math.abs((r.net_profit || 0) - netProfit) < 1;
        if (unchanged) continue;

        updates.push({
          id: r.id,
          date: r.date,
          ads_cost: newAdsCost,
          ads_tax: newAdsTax,
          handling_fee: totalVariableCosts,
          net_profit: netProfit,
        });
      }
      if (updates.length === 0) continue;

      const { error: updError } = await supabase
        .from('shopee_inventory_out')
        .upsert(updates, { onConflict: 'id' });
      if (updError) {
        errors.push(`${bot.platform} ${date}: lỗi cập nhật ${updates.length} đơn — ${updError.message}`);
      } else {
        updatedOrders += updates.length;
        updatedDays++;
      }
    }
  }

  // Audit trail (best-effort): job tự động ghi đè số liệu tài chính (ads_cost/ads_tax/
  // net_profit) của nhiều đơn — ghi 1 dòng TỔNG HỢP mỗi lần chạy (không ghi từng đơn để
  // tránh phình audit_logs vì job chạy mỗi ~30 phút). Lỗi ghi audit không chặn kết quả sync.
  if (updatedOrders > 0) {
    try {
      await supabase.from('audit_logs').insert({
        table_name: 'shopee_inventory_out',
        record_id: `ads-spend-sync:${new Date().toISOString().slice(0, 10)}`,
        action: 'update',
        snapshot: {
          job: 'runAdsSpendSync',
          updatedDays,
          updatedOrders,
          transactionsSaved,
          errorCount: errors.length,
          at: new Date().toISOString(),
        },
      });
    } catch {
      // audit_logs có thể chưa tồn tại ở DB cũ — không chặn job.
    }
  }

  return { updatedDays, updatedOrders, transactionsSaved, errors };
}

export function createAdsSpendSyncRouter(supabase: SupabaseClient, requireAuth: RequestHandler) {
  const router = Router();

  // POST /api/ads-spend/sync-from-bot — chạy lại phân bổ QC ngay (dùng khi người
  // dùng mở trang Xuất kho, hoặc bấm nút thủ công) — cùng logic với job tự động
  // chạy nền mỗi 30 phút trong server.ts.
  router.post('/api/ads-spend/sync-from-bot', requireAuth, async (req, res) => {
    try {
      const result = await runAdsSpendSync(supabase);
      if (result.updatedDays === 0 && result.errors.length === SHOP_BOTS.length) {
        res.status(503).json({ ok: false, error: `Không lấy được dữ liệu quảng cáo. ${result.errors.join('; ')}` });
        return;
      }
      res.json({ ok: true, ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ ok: false, error: msg });
    }
  });

  return router;
}
