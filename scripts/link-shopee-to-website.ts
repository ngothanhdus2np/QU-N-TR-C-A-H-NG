/**
 * Script một lần: link tất cả sản phẩm đang bán Shopee → cũng bán Website
 *
 * Chạy: npx tsx --env-file=.env.local scripts/link-shopee-to-website.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
    .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
    .replace(/[ìíịỉĩ]/g, 'i')
    .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
    .replace(/[ùúụủũưừứựửữ]/g, 'u')
    .replace(/[ỳýỵỷỹ]/g, 'y')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function ensureStoreProduct(posProductId: string, productName: string, productSku: string, parentId?: string): Promise<string> {
  const lookupId = parentId ?? posProductId;

  // Tìm store_product_id qua chính sản phẩm này
  const { data: byDirect } = await supabase
    .from('store_product_variants')
    .select('store_product_id')
    .eq('pos_product_id', lookupId)
    .limit(1)
    .maybeSingle();
  if (byDirect?.store_product_id) return byDirect.store_product_id;

  // Tìm qua anh em (cùng cha)
  if (parentId) {
    const { data: siblings } = await supabase
      .from('pos_products')
      .select('id')
      .eq('parent_id', parentId)
      .neq('id', posProductId)
      .limit(50);
    if (siblings && siblings.length > 0) {
      const { data: bySibling } = await supabase
        .from('store_product_variants')
        .select('store_product_id')
        .in('pos_product_id', siblings.map((s: { id: string }) => s.id))
        .limit(1)
        .maybeSingle();
      if (bySibling?.store_product_id) return bySibling.store_product_id;
    }
  }

  // Tạo mới store_product
  const slug = `${slugify(productSku || productName)}-${Date.now()}`;
  const { data, error } = await supabase
    .from('store_products')
    .insert({ name: productName, slug, is_published: true })
    .select('id')
    .single();
  if (error) throw new Error(`Tạo store_product thất bại: ${error.message}`);
  return data.id;
}

async function main() {
  console.log('🔍  Đọc danh sách sản phẩm đang bán Shopee...');

  // 1. Lấy tất cả shopee_product_variants is_published=true
  const { data: shopeeVariants, error: spErr } = await supabase
    .from('shopee_product_variants')
    .select('pos_product_id, sku')
    .eq('is_published', true);
  if (spErr) throw new Error(spErr.message);

  const shopeeIds = (shopeeVariants ?? []).map((r: { pos_product_id: string }) => r.pos_product_id);
  console.log(`   → Tìm thấy ${shopeeIds.length} sản phẩm/biến thể đang bán Shopee`);

  if (shopeeIds.length === 0) {
    console.log('✅  Không có sản phẩm nào cần link.');
    return;
  }

  // 2. Kiểm tra cái nào đã có store_product_variants rồi
  const { data: existingWs } = await supabase
    .from('store_product_variants')
    .select('pos_product_id')
    .in('pos_product_id', shopeeIds);
  const alreadyLinked = new Set((existingWs ?? []).map((r: { pos_product_id: string }) => r.pos_product_id));
  const toLink = shopeeIds.filter(id => !alreadyLinked.has(id));

  console.log(`   → Đã link website: ${alreadyLinked.size} | Cần link thêm: ${toLink.length}`);
  if (toLink.length === 0) {
    console.log('✅  Tất cả sản phẩm Shopee đã được link website rồi.');
    return;
  }

  // 3. Fetch thông tin pos_products cho những cái cần link
  const { data: posProducts, error: posErr } = await supabase
    .from('pos_products')
    .select('id, name, sku, parent_id, is_parent')
    .in('id', toLink);
  if (posErr) throw new Error(posErr.message);

  const posMap = new Map<string, { id: string; name: string; sku: string; parent_id: string | null; is_parent: boolean }>();
  for (const p of posProducts ?? []) posMap.set(p.id, p);

  // 4. Shopee sku map để dùng khi pos_products thiếu sku
  const shopeeSkuMap = new Map<string, string>();
  for (const r of shopeeVariants ?? []) shopeeSkuMap.set(r.pos_product_id, r.sku);

  // 5. Link từng sản phẩm
  let successCount = 0;
  let errorCount = 0;

  for (const posId of toLink) {
    const product = posMap.get(posId);
    if (!product) {
      console.warn(`   ⚠️  Không tìm thấy pos_product id=${posId}, bỏ qua`);
      continue;
    }

    const sku = product.sku || shopeeSkuMap.get(posId) || posId;
    try {
      const storeProductId = await ensureStoreProduct(posId, product.name, sku, product.parent_id ?? undefined);
      const { error: insertErr } = await supabase
        .from('store_product_variants')
        .insert({ store_product_id: storeProductId, pos_product_id: posId, sku, is_published: true });
      if (insertErr) throw new Error(insertErr.message);
      console.log(`   ✅  ${product.name} (${sku})`);
      successCount++;
    } catch (e) {
      console.error(`   ❌  ${product.name} (${sku}): ${e instanceof Error ? e.message : String(e)}`);
      errorCount++;
    }
  }

  console.log(`\n📊  Kết quả: ${successCount} thành công, ${errorCount} lỗi, ${alreadyLinked.size} đã có sẵn`);
}

main().catch(e => {
  console.error('❌  Script lỗi:', e);
  process.exit(1);
});
