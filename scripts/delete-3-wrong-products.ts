/**
 * Xóa 3 store_products có tên dài sai từ Shopee
 * Chạy: npx tsx --env-file=.env.local scripts/delete-3-wrong-products.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  // Tìm theo tên chứa chuỗi đặc trưng
  const { data: targets, error } = await supabase
    .from('store_products')
    .select('id, name, slug')
    .ilike('name', 'Dép da cao cấp cho nam giới%');

  if (error) throw new Error(error.message);
  if (!targets || targets.length === 0) {
    console.log('✅  Không tìm thấy sản phẩm nào cần xóa.');
    return;
  }

  console.log(`🔍  Tìm thấy ${targets.length} sản phẩm:\n`);
  for (const t of targets) {
    console.log(`  - "${t.name}"`);
    console.log(`    slug: ${t.slug}`);
  }

  const ids = targets.map(t => t.id);

  // Xóa variants trước
  const { error: vErr } = await supabase
    .from('store_product_variants')
    .delete()
    .in('store_product_id', ids);
  if (vErr) throw new Error(`Xóa variants lỗi: ${vErr.message}`);

  // Xóa store_products
  const { error: pErr } = await supabase
    .from('store_products')
    .delete()
    .in('id', ids);
  if (pErr) throw new Error(`Xóa store_products lỗi: ${pErr.message}`);

  console.log(`\n✅  Đã xóa ${ids.length} sản phẩm.`);
}

main().catch(e => {
  console.error('❌  Script lỗi:', e);
  process.exit(1);
});
