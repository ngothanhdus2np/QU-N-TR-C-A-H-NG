/**
 * Tìm và xóa store_products có tên KHÔNG phải là mã SKU (tên tự đặt, không lấy từ pos_products)
 *
 * Bước 1 — Xem danh sách:   npx tsx --env-file=.env.local scripts/delete-wrong-store-products.ts
 * Bước 2 — Xóa thật:        npx tsx --env-file=.env.local scripts/delete-wrong-store-products.ts --delete
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '';
const DRY_RUN = !process.argv.includes('--delete');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  // Lấy tất cả store_products
  const { data: storeProducts, error: spErr } = await supabase
    .from('store_products')
    .select('id, name, slug');
  if (spErr) throw new Error(spErr.message);

  // Lấy tất cả pos_product_id → tên cha để so sánh
  const { data: variants } = await supabase
    .from('store_product_variants')
    .select('store_product_id, pos_product_id, sku');

  const { data: posProducts } = await supabase
    .from('pos_products')
    .select('id, name, sku, parent_id');

  const posMap = new Map<string, { name: string; sku: string; parent_id: string | null }>();
  for (const p of posProducts ?? []) posMap.set(p.id, p);

  // Xây map: store_product_id → tên đúng từ pos_products
  const correctNameMap = new Map<string, string>();
  for (const v of variants ?? []) {
    if (correctNameMap.has(v.store_product_id)) continue;
    const pos = posMap.get(v.pos_product_id);
    if (!pos) continue;
    const parent = pos.parent_id ? posMap.get(pos.parent_id) : null;
    const correctName = (parent?.name || pos.name || parent?.sku || pos.sku || v.sku || '').trim();
    if (correctName) correctNameMap.set(v.store_product_id, correctName);
  }

  // Tìm store_products có tên khác với tên đúng từ pos_products
  const wrongOnes = (storeProducts ?? []).filter(sp => {
    const correct = correctNameMap.get(sp.id);
    if (!correct) return false; // không có link → bỏ qua
    return sp.name !== correct;
  });

  if (wrongOnes.length === 0) {
    console.log('✅  Không tìm thấy sản phẩm nào có tên sai.');
    return;
  }

  console.log(`\n🔍  Tìm thấy ${wrongOnes.length} sản phẩm có tên sai:\n`);
  for (const sp of wrongOnes) {
    const correct = correctNameMap.get(sp.id)!;
    console.log(`  ID:      ${sp.id}`);
    console.log(`  Tên sai: "${sp.name}"`);
    console.log(`  Tên đúng: "${correct}"`);
    console.log('');
  }

  if (DRY_RUN) {
    console.log('⚠️   Đây là chế độ xem trước (dry run). Để XÓA thật, chạy lại với flag --delete:');
    console.log('     npx tsx --env-file=.env.local scripts/delete-wrong-store-products.ts --delete\n');
    return;
  }

  // Xóa thật
  const ids = wrongOnes.map(sp => sp.id);

  // Xóa variants trước (foreign key)
  const { error: vDelErr } = await supabase
    .from('store_product_variants')
    .delete()
    .in('store_product_id', ids);
  if (vDelErr) throw new Error(`Xóa variants lỗi: ${vDelErr.message}`);

  // Xóa store_products
  const { error: spDelErr } = await supabase
    .from('store_products')
    .delete()
    .in('id', ids);
  if (spDelErr) throw new Error(`Xóa store_products lỗi: ${spDelErr.message}`);

  console.log(`✅  Đã xóa ${ids.length} sản phẩm và toàn bộ variants liên quan.`);
}

main().catch(e => {
  console.error('❌  Script lỗi:', e);
  process.exit(1);
});
