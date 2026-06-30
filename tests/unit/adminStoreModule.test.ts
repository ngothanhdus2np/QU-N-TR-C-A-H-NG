import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const router = readFileSync(resolve(process.cwd(), 'routes/adminStore.ts'), 'utf8');
const migration = readFileSync(resolve(process.cwd(), 'supabase_migrations/018_store_admin_module.sql'), 'utf8');
const productsPage = readFileSync(resolve(process.cwd(), 'components/website/WebsiteProductsPage.tsx'), 'utf8');
const ordersPage = readFileSync(resolve(process.cwd(), 'components/website/WebsiteOrdersPage.tsx'), 'utf8');

describe('Website admin module', () => {
  it('enforces role checks in the server-side Admin Store API', () => {
    expect(router).toContain("const CONTENT_ROLES: StoreRole[] = ['admin', 'content_manager'];");
    expect(router).toContain("const ORDER_ROLES: StoreRole[] = ['admin', 'order_staff'];");
    expect(router).toContain("router.post('/api/admin/store/products', ...requireRole(CONTENT_ROLES)");
    expect(router).toContain("router.post('/api/admin/store/orders/:id/status', ...requireRole(ORDER_ROLES)");
  });

  it('records product publication, pricing/content updates and order status changes in audit logs', () => {
    expect(router).toContain("'publish'");
    expect(router).toContain("'website_status_update'");
    expect(router).toContain("'store_products'");
    expect(router).toContain('variants: req.body?.variants ?? req.body?.variantDrafts ?? []');
    expect(router).toContain('await writeAudit');
  });

  it('creates the Website-only settings and media storage layer while blocking direct authenticated writes', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS store_settings');
    expect(migration).toContain("'store-media'");
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS store_media_assets');
    expect(migration).toContain('DROP POLICY IF EXISTS "store_products_authenticated" ON store_products;');
  });

  it('uses authenticated Admin Store API calls from the existing product and order screens', () => {
    expect(productsPage).toContain("adminStoreRequest('/api/admin/store/products'");
    expect(productsPage).toContain('adminStoreRequest(`/api/admin/store/products/${product.id}`');
    expect(ordersPage).toContain("adminStoreRequest<{ data: WebsiteOrder[] }>('/api/admin/store/orders')");
    expect(ordersPage).toContain('`/api/admin/store/orders/${order.id}/status`');
  });
});
