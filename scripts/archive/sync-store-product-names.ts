/**
 * Script một lần: đồng bộ tên store_products từ pos_products (tên sản phẩm cha)
 * Update TẤT CẢ store_products — dùng sku làm fallback nếu name rỗng
 *
 * Chạy: npx tsx --env-file=.env.local scripts/sync-store-product-names.ts
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
  // 1. Lấy tất cả store_product_variants
  const { data: variants, error: vErr } = await supabase
    .from('store_product_variants')
    .select('store_product_id, pos_product_id, sku');
  if (vErr) throw new Error(vErr.message);

  const allPosIds = [...new Set((variants ?? []).map((v: { pos_product_id: string }) => v.pos_product_id))];
  console.log(`🔍  ${variants?.length} variants, ${allPosIds.length} pos_products duy nhất`);

  // 2. Fetch tất cả pos_products liên quan
  const { data: posProducts, error: pErr } = await supabase
    .from('pos_products')
    .select('id, name, sku, parent_id')
    .in('id', allPosIds);
  if (pErr) throw new Error(pErr.message);

  const posMap = new Map<string, { id: string; name: string; sku: string; parent_id: string | null }>();
  for (const p of posProducts ?? []) posMap.set(p.id, p);

  // 3. Fetch cha của các biến thể con chưa có trong posMap
  const parentIds = [...new Set(
    (posProducts ?? [])
      .map(p => p.parent_id)
      .filter((id): id is string => !!id && !posMap.has(id))
  )];
  if (parentIds.length > 0) {
    const { data: parents } = await supabase
      .from('pos_products')
      .select('id, name, sku, parent_id')
      .in('id', parentIds);
    for (const p of parents ?? []) posMap.set(p.id, p);
  }

  // 4. Xây map: store_product_id → tên lấy từ cha (fallback: tên bản thân, fallback: sku)
  const storeNameMap = new Map<string, string>();
  for (const v of variants ?? []) {
    const pos = posMap.get(v.pos_product_id);
    if (!pos) continue;

    // Luôn ưu tiên tên sản phẩm cha
    const parent = pos.parent_id ? posMap.get(pos.parent_id) : null;
    const name = (parent?.name || pos.name || parent?.sku || pos.sku || v.sku || '').trim();

    if (name && !storeNameMap.has(v.store_product_id)) {
      storeNameMap.set(v.store_product_id, name);
    }
  }

  console.log(`📝  Sẽ update ${storeNameMap.size} store_products`);

  // 5. Update tất cả
  let success = 0;
  let errors = 0;

  for (const [storeProductId, name] of storeNameMap.entries()) {
    const { error } = await supabase
      .from('store_products')
      .update({ name })
      .eq('id', storeProductId);
    if (error) {
      console.error(`   ❌  ${storeProductId}: ${error.message}`);
      errors++;
    } else {
      console.log(`   ✅  "${name}"`);
      success++;
    }
  }

  console.log(`\n📊  Kết quả: ${success} cập nhật, ${errors} lỗi`);
}

main().catch(e => {
  console.error('❌  Script lỗi:', e);
  process.exit(1);
});
