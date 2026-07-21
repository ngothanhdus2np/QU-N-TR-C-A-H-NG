// import-excel-to-supabase.mjs
// Đọc file Excel XUAT KHO → upsert vào shopee_inventory_out theo order_id
//
// Chạy: node scripts/import-excel-to-supabase.mjs

import { createClient } from '/Users/apple/phucsang app/QU-N-TR-C-A-H-NG/node_modules/@supabase/supabase-js/dist/index.mjs';
import { readFileSync }  from 'fs';
import { read as xlsxRead, utils as xlsxUtils } from '/Users/apple/phucsang app/QU-N-TR-C-A-H-NG/node_modules/xlsx/xlsx.mjs';
import { fileURLToPath } from 'url';
import { dirname, join }  from 'path';

// Đọc .env.local thủ công (không cần dotenv)
const __dir  = dirname(fileURLToPath(import.meta.url));
const envRaw = readFileSync(join(__dir, '..', '.env.local'), 'utf8');
const env    = Object.fromEntries(
  envRaw.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);

const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const EXCEL_PATH   = '/Users/apple/Downloads/Đơn Hàng Shopee/DonHang_TatCa_2024_2026.xlsx';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
console.log('✅ Supabase:', SUPABASE_URL);

// ========================
// HELPERS
// ========================

function excelDateToStr(val) {
  if (!val) return null;
  // JS Date object (từ cellDates: true)
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  // Serial number cũ
  if (typeof val === 'number') {
    const d = new Date(Date.UTC(1899, 11, 30) + val * 86400000);
    return d.toISOString().slice(0, 10);
  }
  // Chuỗi dạng "dd/mm/yyyy" hoặc "yyyy-mm-dd"
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  return null;
}

const STATUS_MAP = {
  'OK': 'OK', 'ĐÃ GIAO': 'OK',
  'HỦY': 'CANCEL', 'ĐÃ HỦY': 'CANCEL',
  'HOÀN': 'RETURN', 'HOÀN HÀNG': 'RETURN', 'ĐANG HOÀN': 'RETURN',
  'SHIPPING': 'SHIPPING', 'ĐANG VẬN CHUYỂN': 'SHIPPING', 'ĐANG GIAO': 'SHIPPING',
};
function mapStatus(raw) {
  if (!raw) return 'PENDING';
  return STATUS_MAP[String(raw).trim().toUpperCase()] ?? 'PENDING';
}

function mapPlatform(raw) {
  return String(raw ?? '').includes('2') ? 'Shopee 2' : 'Shopee 1';
}

function isShopeeOrderSn(code) {
  return /^\d{6}[A-Z0-9]{6,}$/.test(String(code).trim());
}

// ========================
// ĐỌC EXCEL
// ========================

console.log('📖 Đọc file Excel...');
// raw: false để xlsx evaluate công thức (Khách TT, Phí sàn... là formula cells)
// cellDates: true để ngày trả về JS Date object thay vì serial number
const wb   = xlsxRead(readFileSync(EXCEL_PATH), { cellFormula: false, cellDates: true });
const ws   = wb.Sheets['XUAT KHO'];
// raw: false + defval: null để formula cells được tính
const rows = xlsxUtils.sheet_to_json(ws, { header: 1, raw: false, defval: null });

// Phí (platform_fee, payment_fee, freeship_extra, personal_income_tax...) KHÔNG tính theo công thức.
// Các giá trị này do bot Shopee lấy từ API income breakdown — để 0, bot sẽ tự điền khi sync.

const records = [];
let skipped = 0;

for (let i = 3; i < rows.length; i++) {
  const r = rows[i];
  if (!r || !r[5]) continue;
  const orderSn = String(r[5]).trim();
  if (!isShopeeOrderSn(orderSn)) { skipped++; continue; }

  const toNum = (v) => {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'number') return v;
    // Xóa mọi ký tự không phải số và dấu chấm (kể cả "đ", ",", " ")
    const cleaned = String(v).replace(/[^0-9.]/g, '');
    return cleaned ? Number(cleaned) : 0;
  };
  const buyerPaid    = toNum(r[10]);
  const productPrice = toNum(r[9]);
  const sku          = (r[6] && String(r[6]).trim() !== 'nan') ? String(r[6]).trim() : '';
  const date         = excelDateToStr(r[2]) ?? new Date().toISOString().slice(0, 10);

  records.push({
    order_id:            orderSn,
    tracking_number:     orderSn,
    date,
    ship_date:           date,
    status:              mapStatus(r[1]),
    sku,
    product_name:        r[7] ? String(r[7]).trim() : '',
    quantity:            toNum(r[8]) || 1,
    sale_price:          productPrice,
    customer_paid:       buyerPaid,
    // Các fee fields để 0 — bot Shopee sẽ điền giá trị thực từ API income breakdown khi sync
    platform_fee:        0,
    payment_fee:         0,
    freeship_extra:      0,
    personal_income_tax: 0,
    affiliate_fee:       0,
    handling_fee:        0,
    ads_cost:            toNum(r[17]),
    ads_tax:             0,
    net_profit:          0,
    address:             r[21] ? String(r[21]).trim() : '',
    shipping_unit:       r[22] ? String(r[22]).trim() : '',
    platform:            mapPlatform(r[4]),
    profit_status:       r[23] ? String(r[23]).trim() : 'CHƯA TÍNH',
  });
}

// Dedup theo order_id + sku: giữ hàng có customer_paid cao nhất (dữ liệu đầy đủ hơn)
const dedupMap = new Map();
for (const rec of records) {
  const key = `${rec.order_id}||${rec.sku}`;
  const existing = dedupMap.get(key);
  if (!existing || rec.customer_paid > existing.customer_paid) {
    dedupMap.set(key, rec);
  }
}
const dedupedRecords = Array.from(dedupMap.values());
console.log(`✅ ${dedupedRecords.length} đơn sau khi dedup (từ ${records.length} hàng), bỏ qua ${skipped} (tracking number / không rõ)`);

// ========================
// UPSERT VÀO SUPABASE
// ========================

const BATCH = 200;
let inserted = 0, updated = 0, errors = 0;
console.log(`\n🚀 Upsert ${dedupedRecords.length} đơn vào Supabase...\n`);

for (let i = 0; i < dedupedRecords.length; i += BATCH) {
  const batch = dedupedRecords.slice(i, i + BATCH);
  const ids   = batch.map(r => r.order_id);

  // Lấy danh sách đơn đã có
  const { data: existing } = await supabase
    .from('shopee_inventory_out')
    .select('order_id, sku')
    .in('order_id', ids);

  const existingKeys = new Set((existing || []).map(r => `${r.order_id}||${r.sku ?? ''}`));

  const toInsert = batch.filter(r => !existingKeys.has(`${r.order_id}||${r.sku}`));
  const toUpdate = batch.filter(r =>  existingKeys.has(`${r.order_id}||${r.sku}`));

  if (toInsert.length > 0) {
    const { error } = await supabase.from('shopee_inventory_out').insert(toInsert);
    if (error) { console.error('\n❌ Insert lỗi:', error.message); errors += toInsert.length; }
    else inserted += toInsert.length;
  }

  for (const rec of toUpdate) {
    // CHỈ cập nhật các field mà Excel biết — KHÔNG đụng vào fee fields (bot Shopee giữ dữ liệu đúng)
    const update = {};
    if (rec.status)        update.status        = rec.status;
    if (rec.date)          update.date          = rec.date;
    if (rec.sku)           update.sku           = rec.sku;
    if (rec.product_name)  update.product_name  = rec.product_name;
    if (rec.quantity)      update.quantity      = rec.quantity;
    if (rec.sale_price)    update.sale_price    = rec.sale_price;
    if (rec.customer_paid) update.customer_paid = rec.customer_paid;
    if (rec.address)       update.address       = rec.address;
    if (rec.shipping_unit) update.shipping_unit = rec.shipping_unit;
    update.platform      = rec.platform;
    update.profit_status = rec.profit_status;

    const { error } = await supabase
      .from('shopee_inventory_out')
      .update(update)
      .eq('order_id', rec.order_id)
      .eq('sku', rec.sku);
    if (error) errors++;
    else updated++;
  }

  const done = Math.min(i + BATCH, dedupedRecords.length);
  process.stdout.write(`\r  ${done}/${records.length} — insert: ${inserted}, update: ${updated}, lỗi: ${errors}  `);
}

console.log(`\n\n📊 Kết quả:`);
console.log(`   ➕ Insert mới : ${inserted}`);
console.log(`   ✏️  Cập nhật  : ${updated}`);
console.log(`   ❌ Lỗi       : ${errors}`);
console.log(`   ⏭️  Bỏ qua   : ${skipped} (tracking number)`);
