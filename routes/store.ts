import { Router, Request, Response } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';

// Các trường pos_products được phép đọc — KHÔNG BAO GIỜ thêm import_price vào đây
const SAFE_POS_FIELDS = 'id, stock, sale_price, status' as const;

type PosProductSafe = {
  id: string;
  stock: number;
  sale_price: number;
  status: string;
};

type RawVariant = {
  id: string;
  sku: string;
  size: string | null;
  color_name: string | null;
  color_hex: string | null;
  website_price_override: number | null;
  compare_at_price: number | null;
  is_published: boolean;
  display_order: number;
  pos_product_id: string;
};

function mapVariant(v: RawVariant, stockMap: Record<string, PosProductSafe>) {
  const pos = stockMap[v.pos_product_id] ?? { stock: 0, sale_price: 0, status: 'Inactive' };
  return {
    id: v.id,
    sku: v.sku,
    size: v.size,
    color_name: v.color_name,
    color_hex: v.color_hex,
    price: v.website_price_override ?? pos.sale_price,
    compare_at_price: v.compare_at_price,
    in_stock: pos.status === 'Active' && pos.stock > 0,
    pos_product_id: v.pos_product_id,
  };
}

async function fetchStockMap(
  supabase: SupabaseClient,
  posProductIds: string[]
): Promise<Record<string, PosProductSafe>> {
  if (posProductIds.length === 0) return {};
  const { data } = await supabase
    .from('pos_products')
    .select(SAFE_POS_FIELDS)
    .in('id', posProductIds);
  const map: Record<string, PosProductSafe> = {};
  for (const p of data ?? []) map[p.id] = p;
  return map;
}

// UUID v4 regex
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(s: string): boolean { return UUID_RE.test(s); }

// Chuẩn hoá số điện thoại Việt Nam → 10 chữ số bắt đầu bằng 0
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('84') && digits.length === 11) return '0' + digits.slice(2);
  if (digits.startsWith('0') && digits.length === 10) return digits;
  return null;
}

export function createStoreRouter(supabase: SupabaseClient) {
  const router = Router();

  /**
   * GET /api/store/products
   * Danh sách sản phẩm đã xuất bản cho website.
   * Hỗ trợ query: ?collection=<slug>&featured=true&new=true&best_seller=true
   */
  router.get('/api/store/products', async (req, res) => {
    try {
      let query = supabase
        .from('store_products')
        .select(`
          id, name, slug, short_description,
          cover_image_url, gallery,
          is_featured, is_new, is_best_seller, display_order,
          store_product_variants (
            id, sku, size, color_name, color_hex,
            website_price_override, compare_at_price,
            is_published, display_order, pos_product_id
          )
        `)
        .eq('is_published', true)
        .is('deleted_at', null)
        .order('display_order', { ascending: true });

      if (req.query.featured === 'true') query = query.eq('is_featured', true);
      if (req.query.new === 'true') query = query.eq('is_new', true);
      if (req.query.best_seller === 'true') query = query.eq('is_best_seller', true);

      const { data: products, error } = await query;
      if (error) throw error;

      // Lọc theo collection nếu có
      let filtered = products ?? [];
      if (req.query.collection) {
        const collectionSlug = String(req.query.collection);
        const { data: col } = await supabase
          .from('store_collections')
          .select('id')
          .eq('slug', collectionSlug)
          .eq('is_published', true)
          .single();
        if (col) {
          const { data: links } = await supabase
            .from('store_product_collections')
            .select('store_product_id')
            .eq('collection_id', col.id);
          const ids = new Set((links ?? []).map((l: { store_product_id: string }) => l.store_product_id));
          filtered = filtered.filter(p => ids.has(p.id));
        } else {
          filtered = [];
        }
      }

      const posProductIds = filtered.flatMap(p =>
        (p.store_product_variants as RawVariant[])
          .filter(v => v.is_published)
          .map(v => v.pos_product_id)
      );
      const stockMap = await fetchStockMap(supabase, posProductIds);

      const result = filtered.map(p => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        short_description: p.short_description,
        cover_image_url: p.cover_image_url,
        gallery: p.gallery,
        is_featured: p.is_featured,
        is_new: p.is_new,
        is_best_seller: p.is_best_seller,
        display_order: p.display_order,
        variants: (p.store_product_variants as RawVariant[])
          .filter(v => v.is_published)
          .sort((a, b) => a.display_order - b.display_order)
          .map(v => mapVariant(v, stockMap)),
      }));

      return res.json({ data: result, total: result.length });
    } catch (err) {
      console.error('[Store] GET /api/store/products error:', err);
      return res.status(500).json({ error: 'Lỗi tải danh sách sản phẩm' });
    }
  });

  /**
   * GET /api/store/products/:slug
   * Chi tiết sản phẩm theo slug, bao gồm mô tả, chất liệu, SEO.
   */
  router.get('/api/store/products/:slug', async (req, res) => {
    const { slug } = req.params;
    if (!slug || typeof slug !== 'string') {
      return res.status(400).json({ error: 'Slug không hợp lệ' });
    }

    try {
      const { data: product, error } = await supabase
        .from('store_products')
        .select(`
          id, name, slug, short_description, description,
          material, sole_material, origin, care_instructions, size_guide,
          cover_image_url, gallery, video_url,
          seo_title, seo_description, og_image_url,
          is_featured, is_new, is_best_seller,
          store_product_variants (
            id, sku, size, color_name, color_hex,
            website_price_override, compare_at_price,
            is_published, display_order, pos_product_id
          )
        `)
        .eq('slug', slug)
        .eq('is_published', true)
        .is('deleted_at', null)
        .single();

      if (error || !product) {
        return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
      }

      const posProductIds = (product.store_product_variants as RawVariant[])
        .filter(v => v.is_published)
        .map(v => v.pos_product_id);
      const stockMap = await fetchStockMap(supabase, posProductIds);

      const result = {
        id: product.id,
        name: product.name,
        slug: product.slug,
        short_description: product.short_description,
        description: product.description,
        material: product.material,
        sole_material: product.sole_material,
        origin: product.origin,
        care_instructions: product.care_instructions,
        size_guide: product.size_guide,
        cover_image_url: product.cover_image_url,
        gallery: product.gallery,
        video_url: product.video_url,
        seo_title: product.seo_title,
        seo_description: product.seo_description,
        og_image_url: product.og_image_url,
        is_featured: product.is_featured,
        is_new: product.is_new,
        is_best_seller: product.is_best_seller,
        variants: (product.store_product_variants as RawVariant[])
          .filter(v => v.is_published)
          .sort((a, b) => a.display_order - b.display_order)
          .map(v => mapVariant(v, stockMap)),
      };

      return res.json({ data: result });
    } catch (err) {
      console.error('[Store] GET /api/store/products/:slug error:', err);
      return res.status(500).json({ error: 'Lỗi tải chi tiết sản phẩm' });
    }
  });

  /**
   * POST /api/store/orders
   * Tạo đơn hàng từ website. Gọi PostgreSQL function create_store_order để:
   * - Lock rows pos_products (FOR UPDATE) tránh bán vượt tồn khi 2 khách cùng lúc
   * - Kiểm tra sản phẩm published, tồn kho, tính lại giá server-side
   * - Tạo pos_orders (channel='website'), store_order_addresses, trừ tồn ngay, ghi audit_log
   */
  router.post('/api/store/orders', async (req: Request, res: Response) => {
    const { customer, shippingAddress, paymentMethod, note, items } = req.body ?? {};

    // --- Validate payload ---
    if (!customer || typeof customer !== 'object') {
      return res.status(400).json({ error: 'Thiếu thông tin khách hàng' });
    }
    if (!customer.name || typeof customer.name !== 'string' || !customer.name.trim()) {
      return res.status(400).json({ error: 'Thiếu tên khách hàng' });
    }
    const phone = normalizePhone(String(customer.phone ?? ''));
    if (!phone) {
      return res.status(400).json({ error: 'Số điện thoại không hợp lệ (cần 10 chữ số, bắt đầu 0)' });
    }
    if (!shippingAddress || typeof shippingAddress !== 'object') {
      return res.status(400).json({ error: 'Thiếu địa chỉ giao hàng' });
    }
    if (!shippingAddress.addressLine?.trim()) {
      return res.status(400).json({ error: 'Thiếu địa chỉ cụ thể' });
    }
    if (!shippingAddress.district?.trim()) {
      return res.status(400).json({ error: 'Thiếu quận/huyện' });
    }
    if (!shippingAddress.province?.trim()) {
      return res.status(400).json({ error: 'Thiếu tỉnh/thành phố' });
    }
    if (paymentMethod !== 'cod' && paymentMethod !== 'bank') {
      return res.status(400).json({ error: 'Phương thức thanh toán không hợp lệ (cod hoặc bank)' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Giỏ hàng trống' });
    }
    for (const item of items) {
      if (!item.posProductId || !isValidUUID(String(item.posProductId))) {
        return res.status(400).json({ error: 'ID sản phẩm không hợp lệ' });
      }
      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty < 1 || qty > 100) {
        return res.status(400).json({ error: 'Số lượng không hợp lệ (1-100)' });
      }
    }

    // --- Gọi PostgreSQL function (atomic transaction) ---
    try {
      const { data, error } = await supabase.rpc('create_store_order', {
        p_customer_name: customer.name.trim().slice(0, 100),
        p_customer_phone: phone,
        p_customer_email: customer.email ? String(customer.email).trim().slice(0, 200) : null,
        p_address_line: shippingAddress.addressLine.trim().slice(0, 300),
        p_ward: shippingAddress.ward ? String(shippingAddress.ward).trim().slice(0, 100) : null,
        p_district: shippingAddress.district.trim().slice(0, 100),
        p_province: shippingAddress.province.trim().slice(0, 100),
        p_payment_method: paymentMethod,
        p_note: note ? String(note).trim().slice(0, 500) : null,
        p_items: items.map((item: { posProductId: string; quantity: number }) => ({
          pos_product_id: item.posProductId,
          quantity: Number(item.quantity),
        })),
      });

      if (error) {
        console.error('[Store] create_store_order RPC error:', error);
        return res.status(500).json({ error: 'Lỗi hệ thống, vui lòng thử lại' });
      }

      // Function trả về {error: '...'} cho lỗi nghiệp vụ
      if (data?.error) {
        return res.status(400).json({ error: data.error });
      }

      return res.status(201).json({
        order_code: data.order_code,
        subtotal: data.subtotal,
        shipping_fee: data.shipping_fee,
        total_amount: data.total_amount,
      });
    } catch (err) {
      console.error('[Store] POST /api/store/orders error:', err);
      return res.status(500).json({ error: 'Lỗi hệ thống, vui lòng thử lại' });
    }
  });

  /**
   * POST /api/store/preorders
   * Đặt trước khi hết hàng — CHỈ thu thông tin, KHÔNG tạo đơn thật.
   * Nhân viên sẽ liên hệ khách khi có hàng lại.
   */
  router.post('/api/store/preorders', async (req: Request, res: Response) => {
    const { customerName, phone: rawPhone, posProductId, sku, size, note } = req.body ?? {};

    if (!customerName || typeof customerName !== 'string' || !customerName.trim()) {
      return res.status(400).json({ error: 'Thiếu tên khách hàng' });
    }
    const phone = normalizePhone(String(rawPhone ?? ''));
    if (!phone) {
      return res.status(400).json({ error: 'Số điện thoại không hợp lệ' });
    }
    if (posProductId && !isValidUUID(String(posProductId))) {
      return res.status(400).json({ error: 'ID sản phẩm không hợp lệ' });
    }

    try {
      const { error } = await supabase.from('store_preorder_requests').insert({
        customer_name: customerName.trim().slice(0, 100),
        phone,
        pos_product_id: posProductId ?? null,
        sku: sku ? String(sku).trim().slice(0, 50) : null,
        size: size ? String(size).trim().slice(0, 20) : null,
        note: note ? String(note).trim().slice(0, 300) : null,
        status: 'waiting',
      });

      if (error) {
        console.error('[Store] POST /api/store/preorders error:', error);
        return res.status(500).json({ error: 'Lỗi hệ thống, vui lòng thử lại' });
      }

      return res.status(201).json({ ok: true, message: 'Đã nhận thông tin đặt trước' });
    } catch (err) {
      console.error('[Store] POST /api/store/preorders error:', err);
      return res.status(500).json({ error: 'Lỗi hệ thống, vui lòng thử lại' });
    }
  });

  /**
   * POST /api/store/orders/lookup
   * Tra cứu đơn hàng website theo mã đơn + số điện thoại.
   * Bắt buộc cả hai — không cho tra chỉ bằng mã đơn (tránh liệt kê đơn).
   */
  router.post('/api/store/orders/lookup', async (req: Request, res: Response) => {
    const { orderCode, phone: rawPhone } = req.body ?? {};

    if (!orderCode || typeof orderCode !== 'string' || !orderCode.trim()) {
      return res.status(400).json({ error: 'Thiếu mã đơn hàng' });
    }
    const phone = normalizePhone(String(rawPhone ?? ''));
    if (!phone) {
      return res.status(400).json({ error: 'Số điện thoại không hợp lệ' });
    }

    try {
      // Tìm đơn theo order_code, chỉ lấy đơn channel='website'
      const { data: order, error: orderError } = await supabase
        .from('pos_orders')
        .select('id, order_code, date, customer_id, customer_name, items, shipping_fee, total_amount, final_amount, status, payment_method, created_at')
        .eq('order_code', orderCode.trim().toUpperCase())
        .eq('channel', 'website')
        .single();

      if (orderError || !order) {
        // Trả cùng một lỗi dù sai mã hay sai SĐT — không để đoán được field nào sai
        return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
      }

      // Xác minh số điện thoại khớp với khách hàng
      if (order.customer_id) {
        const { data: customer } = await supabase
          .from('pos_customers')
          .select('phone')
          .eq('id', order.customer_id)
          .single();

        if (!customer || customer.phone !== phone) {
          return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
        }
      }

      // Lấy địa chỉ giao hàng (bảng mới — graceful fallback nếu PostgREST chưa reload)
      let address: Record<string, unknown> | null = null;
      try {
        const { data: addr } = await supabase
          .from('store_order_addresses')
          .select('recipient_name, phone, address_line, ward, district, province')
          .eq('order_id', order.id)
          .single();
        address = addr;
      } catch { /* PostgREST chưa biết bảng, trả null */ }

      // Lấy vận đơn mới nhất (bảng mới — graceful fallback)
      let shipment: Record<string, unknown> | null = null;
      try {
        const { data: ship } = await supabase
          .from('shipments')
          .select('tracking_code, provider, status, shipped_at, delivered_at')
          .eq('order_id', order.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        shipment = ship;
      } catch { /* PostgREST chưa biết bảng, trả null */ }

      // Rút gọn items — chỉ trả thông tin hiển thị cho khách
      const safeItems = Array.isArray(order.items)
        ? (order.items as Record<string, unknown>[]).map(item => ({
            productName: item['productName'],
            sku: item['sku'],
            size: item['size'],
            color: item['color'],
            quantity: item['quantity'],
            price: item['price'],
            subtotal: item['subtotal'],
          }))
        : [];

      return res.json({
        data: {
          order_code: order.order_code,
          date: order.date,
          created_at: order.created_at,
          status: order.status,
          payment_method: order.payment_method,
          shipping_fee: order.shipping_fee ?? 0,
          total_amount: order.total_amount,
          items: safeItems,
          shipping_address: address,
          shipment: shipment
            ? {
                tracking_code: shipment['tracking_code'],
                provider: shipment['provider'],
                status: shipment['status'],
                shipped_at: shipment['shipped_at'],
                delivered_at: shipment['delivered_at'],
              }
            : null,
        },
      });
    } catch (err) {
      console.error('[Store] POST /api/store/orders/lookup error:', err);
      return res.status(500).json({ error: 'Lỗi hệ thống, vui lòng thử lại' });
    }
  });

  return router;
}
