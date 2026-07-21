import { Router, Request, Response, RequestHandler } from 'express';
import { SupabaseClient, User } from '@supabase/supabase-js';
import { isR2Configured, uploadToR2, deleteFromR2 } from '../services/r2';

type StoreRole = 'admin' | 'content_manager' | 'order_staff' | 'viewer';
type VariantInput = {
  pos_product_id: string; sku: string; size?: string | null; color_name?: string | null;
  color_hex?: string | null; website_price_override?: number | null; compare_at_price?: number | null;
  is_published?: boolean; display_order?: number;
};

const CONTENT_ROLES: StoreRole[] = ['admin', 'content_manager'];
const ORDER_ROLES: StoreRole[] = ['admin', 'order_staff'];
const VIEW_ROLES: StoreRole[] = ['admin', 'content_manager', 'order_staff', 'viewer'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const text = (value: unknown, max = 5000) =>
  typeof value === 'string'
    ? value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
    : '';

const nullableText = (value: unknown, max?: number) => text(value, max) || null;

function normalizedRole(user: User): StoreRole {
  const role = String(user.user_metadata?.role ?? 'viewer').toLowerCase();
  if (role === 'admin' || role === 'owner' || role === 'manager') return 'admin';
  if (role === 'content_manager' || role === 'order_staff' || role === 'viewer') return role;
  return 'viewer';
}

function toNumber(value: unknown, fallback: number | null = null) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function writeAudit(
  supabase: SupabaseClient,
  user: User,
  table: string,
  recordId: string,
  action: string,
  snapshot: Record<string, unknown>
) {
  const { error } = await supabase.from('audit_logs').insert({
    table_name: table,
    record_id: recordId,
    action,
    snapshot: { ...snapshot, actor_id: user.id, actor_role: normalizedRole(user) },
  });
  if (error) console.error('[Admin Store] audit error:', error.message);
}

export function createAdminStoreRouter(supabase: SupabaseClient, requireAuth: RequestHandler) {
  const router = Router();

  const requireRole = (roles: StoreRole[]): RequestHandler[] => [
    requireAuth,
    async (req, res, next) => {
      const auth = req.headers.authorization;
      const jwt = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
      if (!jwt) {
        // Dev mode: requireAuth đã cho qua (trusted localhost), gán admin mặc định
        res.locals.storeUser = { id: 'dev-user', user_metadata: { role: 'admin' } } as unknown as User;
        res.locals.storeRole = 'admin' as StoreRole;
        return next();
      }
      const { data: { user }, error } = await supabase.auth.getUser(jwt);
      if (error || !user) return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ' });
      const role = normalizedRole(user);
      if (!roles.includes(role)) return res.status(403).json({ error: 'Bạn không có quyền thực hiện thao tác này' });
      res.locals.storeUser = user;
      res.locals.storeRole = role;
      return next();
    },
  ];

  const productPayload = (body: Record<string, unknown>) => ({
    name: text(body.name, 160),
    slug: text(body.slug, 160).toLowerCase(),
    short_description: nullableText(body.short_description, 600),
    description: nullableText(body.description, 12000),
    material: nullableText(body.material, 300),
    sole_material: nullableText(body.sole_material, 300),
    origin: nullableText(body.origin, 300),
    care_instructions: nullableText(body.care_instructions, 3000),
    size_guide: nullableText(body.size_guide, 6000),
    cover_image_url: nullableText(body.cover_image_url, 1000),
    gallery: Array.isArray(body.gallery) ? body.gallery.filter(v => typeof v === 'string').map(v => text(v, 1000)).filter(Boolean) : [],
    video_url: nullableText(body.video_url, 1000),
    seo_title: nullableText(body.seo_title, 200),
    seo_description: nullableText(body.seo_description, 400),
    og_image_url: nullableText(body.og_image_url, 1000),
    is_featured: Boolean(body.is_featured), is_new: Boolean(body.is_new),
    is_best_seller: Boolean(body.is_best_seller), is_published: Boolean(body.is_published),
    display_order: Math.max(0, Math.trunc(toNumber(body.display_order, 0) ?? 0)),
    updated_at: new Date().toISOString(),
  });

  const saveVariants = async (productId: string, rawVariants: unknown) => {
    if (!Array.isArray(rawVariants)) return;
    const variants = rawVariants.map((raw, index) => {
      const v = raw as VariantInput;
      const override = toNumber(v.website_price_override);
      const compare = toNumber(v.compare_at_price);
      if (!v?.pos_product_id || !text(v.sku, 100)) throw new Error('Biến thể thiếu SKU hoặc liên kết POS');
      if ((override !== null && override < 0) || (compare !== null && compare < 0)) throw new Error('Giá Website không hợp lệ');
      return {
        store_product_id: productId, pos_product_id: String(v.pos_product_id), sku: text(v.sku, 100),
        size: nullableText(v.size, 50), color_name: nullableText(v.color_name, 80), color_hex: nullableText(v.color_hex, 20),
        website_price_override: override, compare_at_price: compare,
        is_published: v.is_published !== false, display_order: Math.max(0, Math.trunc(toNumber(v.display_order, index) ?? index)),
      };
    });
    const { error: deleteError } = await supabase.from('store_product_variants').delete().eq('store_product_id', productId);
    if (deleteError) throw deleteError;
    if (variants.length) {
      const { error } = await supabase.from('store_product_variants').insert(variants);
      if (error) throw error;
    }
  };

  router.get('/api/admin/store/products', ...requireRole(VIEW_ROLES), async (_req, res) => {
    const { data, error } = await supabase.from('store_products').select(`
      id, name, slug, short_description, description, material, sole_material, origin, care_instructions, size_guide,
      cover_image_url, gallery, video_url, seo_title, seo_description, og_image_url,
      is_featured, is_new, is_best_seller, is_published, display_order, created_at, updated_at,
      store_product_variants (id, pos_product_id, sku, size, color_name, color_hex, website_price_override, compare_at_price, is_published, display_order)
    `).is('deleted_at', null).order('display_order').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ data });
  });

  router.post('/api/admin/store/products', ...requireRole(CONTENT_ROLES), async (req, res) => {
    const payload = productPayload(req.body ?? {});
    if (!payload.name || !payload.slug) return res.status(400).json({ error: 'Tên và slug là bắt buộc' });
    try {
      const { data, error } = await supabase.from('store_products').insert(payload).select('id').single();
      if (error) throw error;
      await saveVariants(data.id, req.body?.variants ?? req.body?.variantDrafts ?? []);
      await writeAudit(supabase, res.locals.storeUser, 'store_products', data.id, 'create', { ...payload, variants: req.body?.variants ?? req.body?.variantDrafts ?? [] });
      return res.status(201).json({ id: data.id });
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : 'Không thể tạo sản phẩm' });
    }
  });

  router.patch('/api/admin/store/products/:id', ...requireRole(CONTENT_ROLES), async (req, res) => {
    const payload = productPayload(req.body ?? {});
    if (!payload.name || !payload.slug) return res.status(400).json({ error: 'Tên và slug là bắt buộc' });
    try {
      const { error } = await supabase.from('store_products').update(payload).eq('id', req.params.id);
      if (error) throw error;
      if (Array.isArray(req.body?.variants) || Array.isArray(req.body?.variantDrafts)) await saveVariants(String(req.params.id), req.body.variants ?? req.body.variantDrafts);
      await writeAudit(supabase, res.locals.storeUser, 'store_products', String(req.params.id), 'update', { ...payload, variants: req.body?.variants ?? req.body?.variantDrafts ?? [] });
      return res.json({ ok: true });
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : 'Không thể cập nhật sản phẩm' });
    }
  });

  router.post('/api/admin/store/products/:id/publish', ...requireRole(CONTENT_ROLES), async (req, res) => {
    if (typeof req.body?.is_published !== 'boolean') return res.status(400).json({ error: 'Thiếu trạng thái xuất bản' });
    const { error } = await supabase.from('store_products').update({ is_published: req.body.is_published, updated_at: new Date().toISOString() }).eq('id', req.params.id);
    if (error) return res.status(400).json({ error: error.message });
    await writeAudit(supabase, res.locals.storeUser, 'store_products', String(req.params.id), 'publish', { is_published: req.body.is_published });
    return res.json({ ok: true });
  });

  router.post('/api/admin/store/media', ...requireRole(CONTENT_ROLES), async (req, res) => {
    const filename = text(req.body?.filename, 140).replace(/[^a-zA-Z0-9._-]/g, '-');
    const contentType = text(req.body?.contentType, 100);
    const altText = text(req.body?.altText, 240);
    const encoded = typeof req.body?.dataBase64 === 'string' ? req.body.dataBase64 : '';
    if (!filename || !['image/webp', 'image/jpeg', 'image/png', 'image/avif'].includes(contentType) || !encoded) {
      return res.status(400).json({ error: 'Tệp ảnh không hợp lệ' });
    }
    const data = Buffer.from(encoded.replace(/^data:[^;]+;base64,/, ''), 'base64');
    if (!data.length || data.length > 10 * 1024 * 1024) return res.status(400).json({ error: 'Ảnh phải nhỏ hơn 10MB' });

    // R2 (ưu tiên) — ảnh storefront lưu trên Cloudflare R2 để web + app dùng chung 1 nguồn.
    // Fallback Supabase Storage nếu R2 chưa cấu hình (tránh vỡ khi thiếu R2_* env).
    let path: string;
    let publicUrl: string;
    if (isR2Configured()) {
      path = `store-media/${Date.now()}-${filename}`;
      try {
        ({ url: publicUrl } = await uploadToR2(path, data, contentType));
      } catch (e) {
        return res.status(500).json({ error: 'Upload R2 thất bại: ' + (e as Error).message });
      }
    } else {
      path = `products/${Date.now()}-${filename}`;
      const { error } = await supabase.storage.from('store-media').upload(path, data, { contentType, upsert: false });
      if (error) return res.status(400).json({ error: error.message });
      publicUrl = supabase.storage.from('store-media').getPublicUrl(path).data.publicUrl;
    }
    await supabase.from('store_media_assets').insert({ path, public_url: publicUrl, alt_text: altText, created_by: res.locals.storeUser.id });
    await writeAudit(supabase, res.locals.storeUser, 'store_media', path, 'upload', { content_type: contentType });
    return res.status(201).json({ path, url: publicUrl });
  });

  router.delete('/api/admin/store/media', ...requireRole(CONTENT_ROLES), async (req, res) => {
    const path = text(req.body?.path, 500);
    if (!path || path.includes('..')) return res.status(400).json({ error: 'Đường dẫn ảnh không hợp lệ' });
    // Key R2 mới có prefix 'store-media/'; ảnh Supabase cũ có prefix 'products/'.
    if (isR2Configured() && path.startsWith('store-media/')) {
      try {
        await deleteFromR2(path);
      } catch (e) {
        return res.status(400).json({ error: 'Xóa R2 thất bại: ' + (e as Error).message });
      }
    } else {
      const { error } = await supabase.storage.from('store-media').remove([path]);
      if (error) return res.status(400).json({ error: error.message });
    }
    await supabase.from('store_media_assets').delete().eq('path', path);
    await writeAudit(supabase, res.locals.storeUser, 'store_media', path, 'delete', {});
    return res.json({ ok: true });
  });

  router.get('/api/admin/store/orders', ...requireRole([...ORDER_ROLES, 'viewer']), async (_req, res) => {
    const { data, error } = await supabase.from('pos_orders').select(`
      id, order_code, customer_name, customer_phone, customer_email, payment_method, status, note, total_amount, created_at, items,
      store_order_addresses (address_line, ward, district, province),
      shipments (id, provider, tracking_code, shipping_fee, cod_amount, status, shipped_at, created_at)
    `).eq('channel', 'website').order('created_at', { ascending: false }).limit(500);
    return error ? res.status(500).json({ error: error.message }) : res.json({ data });
  });

  router.post('/api/admin/store/orders/:id/status', ...requireRole(ORDER_ROLES), async (req, res) => {
    const newStatus = text(req.body?.status, 40);
    const shipment = req.body?.shipment && typeof req.body.shipment === 'object' ? req.body.shipment : null;
    const { data, error } = await supabase.rpc('update_website_order_status', {
      p_order_id: req.params.id, p_new_status: newStatus, p_shipment: shipment,
    });
    if (error || data?.error) return res.status(400).json({ error: data?.error ?? error?.message });
    await writeAudit(supabase, res.locals.storeUser, 'pos_orders', String(req.params.id), 'website_status_update', { status: newStatus });
    return res.json(data);
  });

  router.put('/api/admin/store/orders/:id/shipment', ...requireRole(ORDER_ROLES), async (req, res) => {
    const { provider, tracking_code, shipping_fee, cod_amount, status } = req.body ?? {};
    const { data, error } = await supabase.rpc('upsert_website_shipment', {
      p_order_id: req.params.id, p_provider: text(provider, 100) || 'SPX', p_tracking_code: nullableText(tracking_code, 150),
      p_shipping_fee: toNumber(shipping_fee, 0), p_cod_amount: toNumber(cod_amount, 0), p_status: text(status, 100) || 'ready_to_ship',
    });
    if (error || data?.error) return res.status(400).json({ error: data?.error ?? error?.message });
    await writeAudit(supabase, res.locals.storeUser, 'shipments', String(req.params.id), 'upsert', { provider, tracking_code, shipping_fee, cod_amount, status });
    return res.json(data);
  });

  const statusEndpoint = (table: 'store_preorder_requests' | 'store_contacts', statuses: string[], roles: StoreRole[]) => {
    router.patch(`/api/admin/store/${table}/:id`, ...requireRole(roles), async (req, res) => {
      const status = text(req.body?.status, 40);
      if (!statuses.includes(status)) return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
      const { error } = await supabase.from(table).update({ status }).eq('id', req.params.id);
      if (error) return res.status(400).json({ error: error.message });
      await writeAudit(supabase, res.locals.storeUser, table, String(req.params.id), 'status_update', { status });
      return res.json({ ok: true });
    });
  };

  router.get('/api/admin/store/preorders', ...requireRole([...ORDER_ROLES, 'viewer']), async (_req, res) => {
    const { data, error } = await supabase.from('store_preorder_requests').select('*').order('created_at', { ascending: false }).limit(500);
    return error ? res.status(500).json({ error: error.message }) : res.json({ data });
  });
  statusEndpoint('store_preorder_requests', ['waiting', 'notified', 'converted', 'cancelled'], ORDER_ROLES);

  router.get('/api/admin/store/contacts', ...requireRole([...CONTENT_ROLES, ...ORDER_ROLES, 'viewer']), async (_req, res) => {
    const { data, error } = await supabase.from('store_contacts').select('*').order('created_at', { ascending: false }).limit(500);
    return error ? res.status(500).json({ error: error.message }) : res.json({ data });
  });
  statusEndpoint('store_contacts', ['new', 'in_progress', 'resolved'], [...CONTENT_ROLES, ...ORDER_ROLES]);

  router.get('/api/admin/store/newsletter', ...requireRole([...CONTENT_ROLES, 'viewer']), async (req, res) => {
    const q = text(req.query.q, 254).toLowerCase();
    let query = supabase.from('newsletter_subscribers').select('*').order('subscribed_at', { ascending: false }).limit(1000);
    if (q) query = query.ilike('email', `%${q}%`);
    const { data, error } = await query;
    return error ? res.status(500).json({ error: error.message }) : res.json({ data });
  });
  router.patch('/api/admin/store/newsletter/:id', ...requireRole(CONTENT_ROLES), async (req, res) => {
    const status = text(req.body?.status, 30);
    if (!['active', 'unsubscribed'].includes(status)) return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
    const { error } = await supabase.from('newsletter_subscribers').update({ status, unsubscribed_at: status === 'unsubscribed' ? new Date().toISOString() : null }).eq('id', req.params.id);
    if (error) return res.status(400).json({ error: error.message });
    await writeAudit(supabase, res.locals.storeUser, 'newsletter_subscribers', String(req.params.id), 'status_update', { status });
    return res.json({ ok: true });
  });
  router.get('/api/admin/store/newsletter.csv', ...requireRole([...CONTENT_ROLES, 'viewer']), async (_req, res) => {
    const { data, error } = await supabase.from('newsletter_subscribers').select('email,status,source,subscribed_at,unsubscribed_at').order('subscribed_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    const csv = ['email,status,source,subscribed_at,unsubscribed_at', ...(data ?? []).map(row => [row.email, row.status, row.source, row.subscribed_at, row.unsubscribed_at ?? ''].map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="website-newsletter.csv"');
    return res.send(`\uFEFF${csv}`);
  });

  router.get('/api/admin/store/settings', ...requireRole(VIEW_ROLES), async (_req, res) => {
    const { data, error } = await supabase.from('store_settings').select('key,value,updated_at').eq('key', 'website').maybeSingle();
    return error ? res.status(500).json({ error: error.message }) : res.json({ data: data?.value ?? {} });
  });
  router.put('/api/admin/store/settings', ...requireRole(['admin']), async (req, res) => {
    const value = req.body?.value;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return res.status(400).json({ error: 'Cấu hình không hợp lệ' });
    const { error } = await supabase.from('store_settings').upsert({ key: 'website', value, updated_at: new Date().toISOString() });
    if (error) return res.status(400).json({ error: error.message });
    await writeAudit(supabase, res.locals.storeUser, 'store_settings', 'website', 'update', { value });
    return res.json({ ok: true });
  });

  return router;
}
