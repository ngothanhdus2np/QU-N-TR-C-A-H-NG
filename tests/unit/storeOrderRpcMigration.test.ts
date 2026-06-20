import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase_migrations/014_store_order_inventory_integrity.sql'),
  'utf8'
);
const storeRoute = readFileSync(resolve(process.cwd(), 'routes/store.ts'), 'utf8');

describe('store-order inventory integrity migration', () => {
  it('uses the website override price rather than a client-supplied price', () => {
    expect(migration).toContain('COALESCE(spv.website_price_override, p.sale_price) AS website_price');
    expect(migration).toContain("'price', v_product.website_price");
  });

  it('aggregates duplicate cart lines before stock is checked and deducted', () => {
    expect(migration).toMatch(/SUM\(\(item->>'quantity'\)::INTEGER\)::INTEGER AS quantity/);
    expect(migration).toMatch(/GROUP BY \(item->>'pos_product_id'\)::UUID/);
    expect(migration).toContain('jsonb_array_elements(v_items_json)');
  });

  it('calculates and persists website shipping from the server-side subtotal', () => {
    expect(migration).toContain('v_shipping_fee := CASE WHEN v_subtotal < 800000 THEN 30000 ELSE 0 END;');
    expect(migration).toContain('v_total := v_subtotal + v_shipping_fee;');
    expect(migration).toContain('items, shipping_fee, total_amount, final_amount, status,');
    expect(migration).toContain("'subtotal', v_subtotal");
    expect(migration).toContain("'shipping_fee', v_shipping_fee");
  });

  it('returns server-calculated shipping totals from create and lookup APIs', () => {
    expect(storeRoute).toContain('subtotal: data.subtotal');
    expect(storeRoute).toContain('shipping_fee: data.shipping_fee');
    expect(storeRoute).toContain(".select('id, order_code, date, customer_id, customer_name, items, shipping_fee, total_amount");
    expect(storeRoute).toContain('shipping_fee: order.shipping_fee ?? 0');
    expect(storeRoute).toContain('total_amount: order.total_amount');
  });

  it('allows only one terminal restock and aggregates legacy duplicate order lines', () => {
    expect(migration).toContain("IF v_current_status = p_new_status THEN");
    expect(migration).toContain("v_current_status = 'return_requested' AND p_new_status = 'returned'");
    expect(migration).toMatch(/WITH restocks AS \([\s\S]*GROUP BY \(item->>'productId'\)::UUID/);
    expect(migration).toContain("'restocked', FALSE");
  });
});
