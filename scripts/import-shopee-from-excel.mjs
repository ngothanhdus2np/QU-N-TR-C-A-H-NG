/**
 * Script tự động import sản phẩm Shopee từ file Excel XUAT KHO
 * Output: scripts/shopee_import.sql — chạy trực tiếp trên Supabase SQL Editor
 * Chạy: node scripts/import-shopee-from-excel.mjs
 */

import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { writeFileSync } from 'fs';

const SUPABASE_URL = 'https://app.phucsang.com.vn';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzgwNjc3OTMxLCJleHAiOjIwOTYwMzc5MzF9.HwLgWn3LgxZHUTTVLr1dAglqpDw4c2Fb7MMHqsxj6RE';
const EXCEL_PATH = '/Users/apple/Downloads/DonHang_TatCa_2024_2026.xlsx';
const OUTPUT_SQL = '/Users/apple/phucsang app/QU-N-TR-C-A-H-NG/scripts/shopee_import.sql';

// Shop IDs lấy từ Supabase dashboard (SELECT id, name FROM shopee_shops)
const SHOP_MAP = {
  'Shopee 1': { id: '2fbe976a-338e-4550-a7a4-bc0d6da35d7e', name: 'Giày Dép Da Phúc Sang' },
  'Shopee 2': { id: '5c9bf8e3-082d-48da-a4f5-fe92e334bf30', name: 'Phúc Sang_Đồ Da Cao Cấp 93' },
};

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Bước 1: Đọc Excel ───────────────────────────────────────────────────────
function readExcelSkusByShop() {
  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets['XUAT KHO'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const header = rows[2]; // dòng header thực sự ở row index 2
  const skuIdx = header.indexOf('Mã SP');
  const platformIdx = header.indexOf('Nền tảng');

  const skusByShop = { 'Shopee 1': new Set(), 'Shopee 2': new Set() };

  for (const row of rows.slice(3)) {
    const sku = row[skuIdx];
    const platform = row[platformIdx];
    if (!sku || sku === 'nan' || !platform) continue;
    if (skusByShop[platform]) skusByShop[platform].add(String(sku).trim());
  }

  return {
    'Shopee 1': Array.from(skusByShop['Shopee 1']),
    'Shopee 2': Array.from(skusByShop['Shopee 2']),
  };
}

// ─── Bước 2: Load tất cả pos_products từ Supabase ────────────────────────────
async function loadAllPosProducts() {
  const allProducts = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('pos_products')
      .select('id, sku, name, parent_id, is_parent, status')
      .eq('status', 'Active')
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;
    allProducts.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  console.log(`✅ Loaded ${allProducts.length} pos_products`);
  return allProducts;
}

// ─── Bước 3: Xây dựng mapping SKU → pos_product ──────────────────────────────
function buildSkuMap(posProducts) {
  const bySkuExact = new Map();
  const bySkuLower = new Map();

  for (const p of posProducts) {
    if (!p.sku) continue;
    bySkuExact.set(p.sku.trim(), p);
    bySkuLower.set(p.sku.trim().toLowerCase(), p);
  }

  return { bySkuExact, bySkuLower };
}

// ─── Bước 4: Từ SKU → tìm parent group ───────────────────────────────────────
function resolveParentGroups(skus, skuMaps, posProducts) {
  const { bySkuExact, bySkuLower } = skuMaps;

  const parentToChildren = new Map();
  for (const p of posProducts) {
    if (p.parent_id) {
      if (!parentToChildren.has(p.parent_id)) parentToChildren.set(p.parent_id, []);
      parentToChildren.get(p.parent_id).push(p);
    }
  }

  const groups = new Map();
  const notFound = [];

  for (const sku of skus) {
    let product = bySkuExact.get(sku) || bySkuLower.get(sku.toLowerCase());

    if (!product) {
      notFound.push(sku);
      continue;
    }

    if (product.is_parent) {
      const children = parentToChildren.get(product.id) || [];
      groups.set(product.id, { parent: product, children });
    } else if (product.parent_id) {
      if (!groups.has(product.parent_id)) {
        const parentProduct = posProducts.find(p => p.id === product.parent_id);
        const children = parentToChildren.get(product.parent_id) || [];
        if (parentProduct) {
          groups.set(product.parent_id, { parent: parentProduct, children });
        }
      }
    } else {
      groups.set(product.id, { parent: product, children: [] });
    }
  }

  return { groups, notFound };
}

// ─── Bước 5: Tạo SQL INSERT statements ───────────────────────────────────────
function sqlStr(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

function generateSQL(skusByShop, posProducts) {
  const skuMaps = buildSkuMap(posProducts);
  const lines = [];
  let totalProducts = 0;
  let totalVariants = 0;

  lines.push('-- Auto-generated: import shopee products from Excel');
  lines.push(`-- Generated at: ${new Date().toISOString()}`);
  lines.push('-- Chạy file này trên Supabase SQL Editor (copy toàn bộ rồi paste vào)');
  lines.push('');
  lines.push('BEGIN;');
  lines.push('');

  for (const [shopeeLabel, skus] of Object.entries(skusByShop)) {
    const shop = SHOP_MAP[shopeeLabel];
    if (!shop) continue;

    const { groups, notFound } = resolveParentGroups(skus, skuMaps, posProducts);
    lines.push(`-- ────────────────────────────────────────────`);
    lines.push(`-- ${shopeeLabel}: ${shop.name}`);
    lines.push(`-- ${groups.size} sản phẩm, ${notFound.length} SKU không tìm thấy`);
    if (notFound.length > 0) {
      lines.push(`-- SKU không tìm thấy: ${notFound.slice(0, 20).join(', ')}${notFound.length > 20 ? '...' : ''}`);
    }
    lines.push(`-- ────────────────────────────────────────────`);
    lines.push('');

    for (const [, { parent, children }] of groups) {
      const spId = randomUUID();
      const variantsToLink = children.length > 0 ? children : [parent];
      const skuLabel = parent.sku || parent.name;

      lines.push(`-- ${skuLabel} (${variantsToLink.length} variants)`);
      lines.push(`INSERT INTO shopee_products (id, name, shop_id, is_published, display_order)`);
      lines.push(`VALUES ('${spId}', ${sqlStr(skuLabel)}, '${shop.id}', true, 0);`);

      const varRows = variantsToLink.map((v, i) =>
        `  ('${randomUUID()}', '${spId}', '${v.id}', ${sqlStr(v.sku || '')}, true, ${i})`
      );
      lines.push(`INSERT INTO shopee_product_variants (id, shopee_product_id, pos_product_id, sku, is_published, display_order) VALUES`);
      lines.push(varRows.join(',\n') + ';');
      lines.push('');

      totalProducts++;
      totalVariants += variantsToLink.length;
    }
  }

  lines.push('COMMIT;');
  lines.push('');
  lines.push(`-- TỔNG KẾT: ${totalProducts} shopee_products, ${totalVariants} shopee_product_variants`);

  return { sql: lines.join('\n'), totalProducts, totalVariants };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Bắt đầu tạo SQL import Shopee products từ Excel...\n');

  console.log('📖 Đọc file Excel...');
  const skusByShop = readExcelSkusByShop();
  console.log(`  Shopee 1: ${skusByShop['Shopee 1'].length} SKU`);
  console.log(`  Shopee 2: ${skusByShop['Shopee 2'].length} SKU`);

  console.log('\n🔌 Load pos_products từ Supabase...');
  const posProducts = await loadAllPosProducts();

  console.log('\n📝 Tạo SQL...');
  const { sql, totalProducts, totalVariants } = generateSQL(skusByShop, posProducts);

  writeFileSync(OUTPUT_SQL, sql, 'utf-8');

  console.log(`\n✅ Hoàn tất!`);
  console.log(`   File SQL: ${OUTPUT_SQL}`);
  console.log(`   Sẽ tạo: ${totalProducts} shopee_products`);
  console.log(`   Sẽ tạo: ${totalVariants} shopee_product_variants`);
  console.log(`\n👉 Mở Supabase SQL Editor, copy nội dung file trên rồi paste vào và chạy.`);
}

main().catch(err => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
