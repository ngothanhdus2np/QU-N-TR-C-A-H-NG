import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase_migrations/017_website_order_fulfillment_and_shipments.sql'),
  'utf8'
);
const page = readFileSync(resolve(process.cwd(), 'components/website/WebsiteOrdersPage.tsx'), 'utf8');
const storeRoute = readFileSync(resolve(process.cwd(), 'routes/store.ts'), 'utf8');

describe('website order fulfilment', () => {
  it('enforces every fulfilment transition server-side without altering restock triggers', () => {
    expect(migration).toContain("v_current_status = 'confirmed' AND p_new_status IN ('packing', 'cancelled')");
    expect(migration).toContain("v_current_status = 'packing' AND p_new_status IN ('ready_to_ship', 'cancelled')");
    expect(migration).toContain("v_current_status = 'ready_to_ship' AND p_new_status IN ('shipping', 'cancelled')");
    expect(migration).toContain("IF p_new_status IN ('cancelled', 'returned') THEN");
  });

  it('requires tracking data and atomically stores the shipment before shipping', () => {
    expect(migration).toContain("DROP FUNCTION IF EXISTS update_website_order_status(UUID, TEXT);");
    expect(migration).toContain("p_new_status = 'shipping'");
    expect(migration).toContain("'Cần có mã vận đơn trước khi chuyển sang đang giao'");
    expect(migration).toContain('SELECT upsert_website_shipment(');
    expect(migration).toContain('shipping_fee NUMERIC NOT NULL DEFAULT 0');
    expect(migration).toContain('cod_amount NUMERIC NOT NULL DEFAULT 0');
  });

  it('shows the extra statuses and SPX shipment fields in the website order UI', () => {
    expect(page).toContain("packing: { label: 'Đang đóng gói'");
    expect(page).toContain("ready_to_ship: { label: 'Sẵn sàng giao'");
    expect(page).toContain('`/api/admin/store/orders/${order.id}/shipment`');
    expect(page).toContain('`/api/admin/store/orders/${order.id}/status`');
  });

  it('returns the newest shipment fields from the public order lookup', () => {
    expect(storeRoute).toContain('shipping_fee, cod_amount, status, shipped_at, delivered_at, updated_at');
    expect(storeRoute).toContain("shipping_fee: shipment['shipping_fee'] ?? 0");
    expect(storeRoute).toContain("cod_amount: shipment['cod_amount'] ?? 0");
  });
});
