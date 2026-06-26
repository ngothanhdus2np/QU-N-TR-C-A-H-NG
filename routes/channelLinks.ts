import { Router, RequestHandler } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';

// Route này dùng admin supabase client (service role) để bypass RLS
// Frontend không thể insert trực tiếp vào shopee_products / store_products vì RLS

export function createChannelLinksRouter(
  supabase: SupabaseClient,
  requireAuth: RequestHandler,
) {
  const router = Router();

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

  async function ensureStoreProduct(productId: string, productName: string, productSku: string, parentId?: string): Promise<string> {
    const lookupId = parentId ?? productId;
    const { data: byParent } = await supabase
      .from('store_product_variants')
      .select('store_product_id')
      .eq('pos_product_id', lookupId)
      .limit(1)
      .maybeSingle();
    if (byParent?.store_product_id) return byParent.store_product_id;

    if (parentId) {
      const { data: siblings } = await supabase
        .from('pos_products')
        .select('id')
        .eq('parent_id', parentId)
        .neq('id', productId)
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

    const slug = `${slugify(productSku || productName)}-${Date.now()}`;
    const { data, error } = await supabase
      .from('store_products')
      .insert({ name: productName, slug, is_published: true })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    return data.id;
  }

  async function ensureShopeeProduct(productId: string, productName: string, parentId?: string, shopId?: string): Promise<string> {
    const lookupId = parentId ?? productId;

    // Lấy tất cả shopee_product_id đang link với product
    const { data: linkedVariants } = await supabase
      .from('shopee_product_variants')
      .select('shopee_product_id')
      .eq('pos_product_id', lookupId);
    const linkedIds = [...new Set((linkedVariants ?? []).map((v: { shopee_product_id: string }) => v.shopee_product_id))];

    if (linkedIds.length > 0) {
      if (shopId) {
        // Tìm shopee_product thuộc đúng shop này
        const { data: match } = await supabase
          .from('shopee_products')
          .select('id')
          .in('id', linkedIds)
          .eq('shop_id', shopId)
          .limit(1)
          .maybeSingle();
        if (match?.id) return match.id;
      } else {
        // Fallback: trả về bất kỳ product nào đã link
        return linkedIds[0];
      }
    }

    if (parentId) {
      const { data: siblings } = await supabase
        .from('pos_products')
        .select('id')
        .eq('parent_id', parentId)
        .neq('id', productId)
        .limit(50);
      if (siblings && siblings.length > 0) {
        const { data: siblingVariants } = await supabase
          .from('shopee_product_variants')
          .select('shopee_product_id')
          .in('pos_product_id', siblings.map((s: { id: string }) => s.id));
        const siblingIds = [...new Set((siblingVariants ?? []).map((v: { shopee_product_id: string }) => v.shopee_product_id))];
        if (siblingIds.length > 0) {
          if (shopId) {
            const { data: match } = await supabase
              .from('shopee_products')
              .select('id')
              .in('id', siblingIds)
              .eq('shop_id', shopId)
              .limit(1)
              .maybeSingle();
            if (match?.id) return match.id;
          } else {
            return siblingIds[0];
          }
        }
      }
    }

    const { data, error } = await supabase
      .from('shopee_products')
      .insert({ name: productName, is_published: true, ...(shopId ? { shop_id: shopId } : {}) })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    return data.id;
  }

  // GET /api/channel-links/shopee-catalog
  // Trả về: mỗi pos_product cha → { name, shopee_entries: [{ shopee_product_id, shop_id, ... }] }
  router.get('/api/channel-links/shopee-catalog', requireAuth, async (_req, res) => {
    try {
      const [varRes, shopsRes] = await Promise.all([
        supabase.from('shopee_product_variants')
          .select('id, pos_product_id, shopee_product_id, sku, size, color_name, shopee_price_override, is_published, display_order')
          .order('display_order', { ascending: true }),
        supabase.from('shopee_shops').select('id, name, slug'),
      ]);
      if (varRes.error) throw new Error(varRes.error.message);

      type VarRow = { id: string; pos_product_id: string; shopee_product_id: string; sku: string; size: string | null; color_name: string | null; shopee_price_override: number | null; is_published: boolean; display_order: number };
      type SpRow = { id: string; shopee_item_id: string | null; is_published: boolean; shop_id: string | null; cover_image_url: string | null; display_order: number };
      type PosRow = { id: string; name: string; sku: string; parent_id: string | null };

      const variants = (varRes.data ?? []) as VarRow[];
      const allShopeeIds = [...new Set(variants.map(v => v.shopee_product_id))];
      const allPosIds   = [...new Set(variants.map(v => v.pos_product_id))];

      const [spRes, posRes] = await Promise.all([
        allShopeeIds.length > 0
          ? supabase.from('shopee_products').select('id, shopee_item_id, is_published, shop_id, cover_image_url, display_order').in('id', allShopeeIds)
          : Promise.resolve({ data: [], error: null }),
        allPosIds.length > 0
          ? supabase.from('pos_products').select('id, name, sku, parent_id').in('id', allPosIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (spRes.error) throw new Error(spRes.error.message);
      if (posRes.error) throw new Error(posRes.error.message);

      const spMap  = new Map((spRes.data  ?? []).map((p: SpRow)  => [p.id, p]));
      const posMap = new Map((posRes.data ?? []).map((p: PosRow) => [p.id, p]));

      const parentIds = [...new Set((posRes.data ?? []).map((p: PosRow) => p.parent_id).filter(Boolean))] as string[];
      let parentMap = new Map<string, PosRow>();
      if (parentIds.length > 0) {
        const { data: parents } = await supabase.from('pos_products').select('id, name, sku, parent_id').in('id', parentIds);
        parentMap = new Map((parents ?? []).map((p: PosRow) => [p.id, p]));
      }

      type ShopEntry = {
        id: string; shop_id: string | null; shopee_item_id: string | null;
        is_published: boolean; cover_image_url: string | null; display_order: number;
        shopee_product_variants: { id: string; sku: string; size: string | null; color_name: string | null; shopee_price_override: number | null; pos_product_id: string; is_published: boolean; display_order: number }[];
      };
      type ProductEntry = { pos_product_id: string; name: string; shopee_entries: ShopEntry[] };

      // Gom theo pos_product cha: mỗi pos_product cha → list shopee_entries (một per shop)
      const productMap = new Map<string, ProductEntry>();

      for (const v of variants) {
        const pos    = posMap.get(v.pos_product_id) as PosRow | undefined;
        const parent = pos?.parent_id ? parentMap.get(pos.parent_id) : undefined;
        // Key nhóm = parent pos_product_id nếu có, else chính nó
        const groupKey  = pos?.parent_id ?? v.pos_product_id;
        const groupName = parent?.name ?? pos?.name ?? '';

        if (!productMap.has(groupKey)) {
          productMap.set(groupKey, { pos_product_id: groupKey, name: groupName, shopee_entries: [] });
        }
        const product = productMap.get(groupKey)!;

        // Tìm hoặc tạo shopee_entry cho shopee_product_id này
        let entry = product.shopee_entries.find(e => e.id === v.shopee_product_id);
        if (!entry) {
          const sp = spMap.get(v.shopee_product_id);
          entry = {
            id: v.shopee_product_id,
            shop_id: sp?.shop_id ?? null,
            shopee_item_id: sp?.shopee_item_id ?? null,
            is_published: sp?.is_published ?? false,
            cover_image_url: sp?.cover_image_url ?? null,
            display_order: sp?.display_order ?? 0,
            shopee_product_variants: [],
          };
          product.shopee_entries.push(entry);
        }
        entry.shopee_product_variants.push({
          id: v.id, sku: v.sku, size: v.size, color_name: v.color_name,
          shopee_price_override: v.shopee_price_override, pos_product_id: v.pos_product_id,
          is_published: v.is_published, display_order: v.display_order,
        });
      }

      res.json({ ok: true, products: Array.from(productMap.values()), shops: shopsRes.data ?? [] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  // GET /api/channel-links/catalog-links — trả về tất cả pos_product_id đã link (cả website lẫn shopee)
  router.get('/api/channel-links/catalog-links', requireAuth, async (_req, res) => {
    try {
      const [wsRes, spRes] = await Promise.all([
        supabase.from('store_product_variants').select('pos_product_id').eq('is_published', true),
        supabase.from('shopee_product_variants').select('pos_product_id').eq('is_published', true),
      ]);
      res.json({
        ok: true,
        website: (wsRes.data ?? []).map((r: { pos_product_id: string }) => r.pos_product_id),
        shopee: (spRes.data ?? []).map((r: { pos_product_id: string }) => r.pos_product_id),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  // GET /api/channel-links/shopee-shops-status?productId=X&isParent=true
  // Trả về trạng thái link Shopee per-shop cho 1 sản phẩm
  router.get('/api/channel-links/shopee-shops-status', requireAuth, async (req, res) => {
    try {
      const { productId, isParent } = req.query as { productId?: string; isParent?: string };
      if (!productId) { res.status(400).json({ ok: false, error: 'Thiếu productId' }); return; }

      const { data: shopsData } = await supabase.from('shopee_shops').select('id, name, slug');
      const shops = shopsData ?? [];

      // Lấy tất cả pos_product_id liên quan (chính nó hoặc children nếu là parent)
      let posIds: string[] = [productId];
      if (isParent === 'true') {
        const { data: children } = await supabase.from('pos_products').select('id').eq('parent_id', productId).eq('status', 'Active');
        posIds = (children ?? []).map((c: { id: string }) => c.id);
      }

      if (posIds.length === 0) {
        res.json({ ok: true, shops: shops.map((s: { id: string; name: string; slug: string }) => ({ id: s.id, name: s.name, linked: false })) });
        return;
      }

      // Lấy shopee_products đang link với product này
      const { data: variants } = await supabase
        .from('shopee_product_variants')
        .select('shopee_product_id')
        .in('pos_product_id', posIds);
      const linkedProductIds = [...new Set((variants ?? []).map((v: { shopee_product_id: string }) => v.shopee_product_id))];

      let shopeeProducts: { id: string; shop_id: string | null }[] = [];
      if (linkedProductIds.length > 0) {
        const { data: spData } = await supabase.from('shopee_products').select('id, shop_id').in('id', linkedProductIds);
        shopeeProducts = spData ?? [];
      }
      const linkedShopIds = new Set(shopeeProducts.map(p => p.shop_id).filter(Boolean));

      res.json({
        ok: true,
        shops: shops.map((s: { id: string; name: string; slug: string }) => ({
          id: s.id,
          name: s.name,
          linked: linkedShopIds.has(s.id),
        })),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  // GET /api/channel-links/status?productId=...&isParent=true
  router.get('/api/channel-links/status', requireAuth, async (req, res) => {
    try {
      const { productId, isParent } = req.query as { productId?: string; isParent?: string };
      if (!productId) {
        res.status(400).json({ ok: false, error: 'Thiếu productId' });
        return;
      }

      if (isParent !== 'true') {
        const [wsRes, spRes] = await Promise.all([
          supabase.from('store_product_variants').select('id, store_product_id, is_published').eq('pos_product_id', productId).maybeSingle(),
          supabase.from('shopee_product_variants').select('id, shopee_product_id, is_published').eq('pos_product_id', productId).maybeSingle(),
        ]);
        res.json({
          ok: true,
          website: wsRes.data
            ? { linked: wsRes.data.is_published ?? true, variantId: wsRes.data.id, storeProductId: wsRes.data.store_product_id }
            : { linked: false },
          shopee: spRes.data
            ? { linked: spRes.data.is_published ?? true, variantId: spRes.data.id, storeProductId: spRes.data.shopee_product_id }
            : { linked: false },
        });
      } else {
        const { data: children } = await supabase.from('pos_products').select('id').eq('parent_id', productId).eq('status', 'Active');
        const childIds = (children ?? []).map((c: { id: string }) => c.id);
        const total = childIds.length;

        if (total === 0) {
          res.json({ ok: true, website: { linked: false }, shopee: { linked: false }, childCount: { website: 0, shopee: 0, total: 0 } });
          return;
        }

        const [wsRes, spRes] = await Promise.all([
          supabase.from('store_product_variants').select('id, store_product_id').in('pos_product_id', childIds).eq('is_published', true),
          supabase.from('shopee_product_variants').select('id, shopee_product_id').in('pos_product_id', childIds).eq('is_published', true),
        ]);

        const wsCount = (wsRes.data ?? []).length;
        const spCount = (spRes.data ?? []).length;
        res.json({
          ok: true,
          website: { linked: wsCount > 0, storeProductId: (wsRes.data ?? [])[0]?.store_product_id },
          shopee: { linked: spCount > 0, storeProductId: (spRes.data ?? [])[0]?.shopee_product_id },
          childCount: { website: wsCount, shopee: spCount, total },
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  // POST /api/channel-links/toggle
  // Body: { channel: 'website'|'shopee', action: 'link'|'unlink', product: POSProduct, childIds?: string[] }
  router.post('/api/channel-links/toggle', requireAuth, async (req, res) => {
    try {
      const { channel, action, product, childIds, variantId, shopId } = req.body as {
        channel: 'website' | 'shopee';
        action: 'link' | 'unlink';
        product: { id: string; name: string; sku: string; parentId?: string; isParent?: boolean };
        childIds?: { id: string; sku: string }[];
        variantId?: string;
        shopId?: string;
      };

      if (!channel || !action || !product) {
        res.status(400).json({ ok: false, error: 'Thiếu tham số channel/action/product' });
        return;
      }

      // Website publishing is content management, not a generic catalog toggle.
      // Enforce this on the server so hiding the frontend control is never the
      // only protection. Legacy owner/manager accounts retain admin access.
      if (channel === 'website') {
        const authHeader = req.headers.authorization;
        const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!jwt) {
          res.status(401).json({ ok: false, error: 'Cần đăng nhập để quản lý Website' });
          return;
        }
        const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
        const role = String(user?.user_metadata?.role ?? '').toLowerCase();
        const canManageWebsite = ['admin', 'owner', 'manager', 'content_manager'].includes(role);
        if (authError || !canManageWebsite) {
          res.status(403).json({ ok: false, error: 'Chỉ admin hoặc content_manager được thay đổi xuất bản Website' });
          return;
        }
      }

      if (channel === 'website') {
        if (action === 'unlink') {
          if (childIds && childIds.length > 0) {
            const { error } = await supabase.from('store_product_variants').delete().in('pos_product_id', childIds.map(c => c.id));
            if (error) throw new Error(`[store_product_variants] delete: ${error.message}`);
          } else if (variantId) {
            const { error } = await supabase.from('store_product_variants').delete().eq('id', variantId);
            if (error) throw new Error(`[store_product_variants] delete: ${error.message}`);
          } else {
            const { error } = await supabase.from('store_product_variants').delete().eq('pos_product_id', product.id);
            if (error) throw new Error(`[store_product_variants] delete: ${error.message}`);
          }
        } else {
          const storeProductId = await ensureStoreProduct(product.id, product.name, product.sku, product.parentId);
          if (childIds && childIds.length > 0) {
            const { error: e1 } = await supabase.from('store_product_variants').delete().in('pos_product_id', childIds.map(c => c.id));
            if (e1) throw new Error(`[store_product_variants] delete: ${e1.message}`);
            const { error: e2 } = await supabase.from('store_product_variants').insert(childIds.map(c => ({ store_product_id: storeProductId, pos_product_id: c.id, sku: c.sku, is_published: true })));
            if (e2) throw new Error(`[store_product_variants] insert: ${e2.message}`);
          } else {
            const { error: e1 } = await supabase.from('store_product_variants').delete().eq('pos_product_id', product.id);
            if (e1) throw new Error(`[store_product_variants] delete: ${e1.message}`);
            const { error: e2 } = await supabase.from('store_product_variants').insert({ store_product_id: storeProductId, pos_product_id: product.id, sku: product.sku, is_published: true });
            if (e2) throw new Error(`[store_product_variants] insert: ${e2.message}`);
          }
        }
      } else {
        if (action === 'unlink') {
          if (shopId) {
            // Unlink chỉ shop này: tìm shopee_product thuộc shop đó rồi xóa variant tương ứng
            const posIds = childIds ? childIds.map(c => c.id) : [product.id];
            const { data: variants } = await supabase
              .from('shopee_product_variants')
              .select('id, shopee_product_id')
              .in('pos_product_id', posIds);
            const spIds = [...new Set((variants ?? []).map((v: { shopee_product_id: string }) => v.shopee_product_id))];
            if (spIds.length > 0) {
              const { data: spForShop } = await supabase.from('shopee_products').select('id').in('id', spIds).eq('shop_id', shopId);
              const idsToRemove = (spForShop ?? []).map((s: { id: string }) => s.id);
              if (idsToRemove.length > 0) {
                const { error } = await supabase.from('shopee_product_variants')
                  .delete()
                  .in('pos_product_id', posIds)
                  .in('shopee_product_id', idsToRemove);
                if (error) throw new Error(`[shopee_product_variants] delete by shop: ${error.message}`);
              }
            }
          } else if (childIds && childIds.length > 0) {
            const { error } = await supabase.from('shopee_product_variants').delete().in('pos_product_id', childIds.map(c => c.id));
            if (error) throw new Error(`[shopee_product_variants] delete: ${error.message}`);
          } else if (variantId) {
            const { error } = await supabase.from('shopee_product_variants').delete().eq('id', variantId);
            if (error) throw new Error(`[shopee_product_variants] delete: ${error.message}`);
          } else {
            const { error } = await supabase.from('shopee_product_variants').delete().eq('pos_product_id', product.id);
            if (error) throw new Error(`[shopee_product_variants] delete: ${error.message}`);
          }
        } else {
          const shopeeProductId = await ensureShopeeProduct(product.id, product.name, product.parentId, shopId);
          if (childIds && childIds.length > 0) {
            if (shopId) {
              // Link per-shop: chỉ insert những child chưa có link với shop này
              const { data: existing } = await supabase
                .from('shopee_product_variants')
                .select('pos_product_id')
                .in('pos_product_id', childIds.map(c => c.id))
                .eq('shopee_product_id', shopeeProductId);
              const existingIds = new Set((existing ?? []).map((e: { pos_product_id: string }) => e.pos_product_id));
              const toInsert = childIds.filter(c => !existingIds.has(c.id));
              if (toInsert.length > 0) {
                const { error } = await supabase.from('shopee_product_variants').insert(toInsert.map(c => ({ shopee_product_id: shopeeProductId, pos_product_id: c.id, sku: c.sku, is_published: true })));
                if (error) throw new Error(`[shopee_product_variants] insert by shop: ${error.message}`);
              }
            } else {
              const { error: e1 } = await supabase.from('shopee_product_variants').delete().in('pos_product_id', childIds.map(c => c.id));
              if (e1) throw new Error(`[shopee_product_variants] delete: ${e1.message}`);
              const { error: e2 } = await supabase.from('shopee_product_variants').insert(childIds.map(c => ({ shopee_product_id: shopeeProductId, pos_product_id: c.id, sku: c.sku, is_published: true })));
              if (e2) throw new Error(`[shopee_product_variants] insert: ${e2.message}`);
            }
          } else {
            if (shopId) {
              // Link per-shop: chỉ insert nếu chưa tồn tại link với shop này
              const { data: existing } = await supabase
                .from('shopee_product_variants')
                .select('id')
                .eq('pos_product_id', product.id)
                .eq('shopee_product_id', shopeeProductId)
                .maybeSingle();
              if (!existing) {
                const { error } = await supabase.from('shopee_product_variants').insert({ shopee_product_id: shopeeProductId, pos_product_id: product.id, sku: product.sku, is_published: true });
                if (error) throw new Error(`[shopee_product_variants] insert by shop: ${error.message}`);
              }
            } else {
              const { error: e1 } = await supabase.from('shopee_product_variants').delete().eq('pos_product_id', product.id);
              if (e1) throw new Error(`[shopee_product_variants] delete: ${e1.message}`);
              const { error: e2 } = await supabase.from('shopee_product_variants').insert({ shopee_product_id: shopeeProductId, pos_product_id: product.id, sku: product.sku, is_published: true });
              if (e2) throw new Error(`[shopee_product_variants] insert: ${e2.message}`);
            }
          }
        }
      }

      res.json({ ok: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  return router;
}
