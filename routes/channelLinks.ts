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

      const variants = ((varRes.data ?? []) as VarRow[]).filter(v => v.pos_product_id && v.shopee_product_id);
      const allShopeeIds = [...new Set(variants.map(v => v.shopee_product_id))];
      const allPosIds   = [...new Set(variants.map(v => v.pos_product_id))];

      // Batch helper: tránh URI too long khi .in() có quá nhiều ID
      // UUID = 36 ký tự; 100 UUID × 37 ≈ 3700 chars → an toàn dưới 8KB URL limit
      const BATCH = 100;
      const inBatches = async <T>(table: string, select: string, ids: string[]): Promise<T[]> => {
        const results: T[] = [];
        for (let i = 0; i < ids.length; i += BATCH) {
          const { data, error } = await supabase.from(table).select(select).in('id', ids.slice(i, i + BATCH));
          if (error) throw new Error(error.message);
          if (data) results.push(...(data as T[]));
        }
        return results;
      };

      const [spData, posData] = await Promise.all([
        allShopeeIds.length > 0 ? inBatches<SpRow>('shopee_products', 'id, shopee_item_id, is_published, shop_id, cover_image_url, display_order', allShopeeIds) : [],
        allPosIds.length > 0   ? inBatches<PosRow>('pos_products', 'id, name, sku, parent_id', allPosIds) : [],
      ]);

      const spMap  = new Map(spData.map(p => [p.id, p]));
      const posMap = new Map(posData.map(p => [p.id, p]));

      const parentIds = [...new Set(posData.map(p => p.parent_id).filter(Boolean))] as string[];
      let parentMap = new Map<string, PosRow>();
      if (parentIds.length > 0) {
        const parents = await inBatches<PosRow>('pos_products', 'id, name, sku, parent_id', parentIds);
        parentMap = new Map(parents.map(p => [p.id, p]));
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
        website: (wsRes.data ?? []).map((r: { pos_product_id: string }) => r.pos_product_id).filter(Boolean),
        shopee: (spRes.data ?? []).map((r: { pos_product_id: string }) => r.pos_product_id).filter(Boolean),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  // GET /api/channel-links/platforms — danh sách nền tảng + tập pos_product_id đã liên kết
  // Trả về root product IDs (không phải variant IDs) để khớp với filteredProducts trong frontend
  router.get('/api/channel-links/platforms', requireAuth, async (_req, res) => {
    try {
      const [shopsRes, wsRes, spvRes] = await Promise.all([
        supabase.from('shopee_shops').select('id, name'),
        supabase.from('store_product_variants').select('pos_product_id').eq('is_published', true),
        supabase.from('shopee_product_variants').select('pos_product_id, shopee_product_id').eq('is_published', true),
      ]);
      const shops: { id: string; name: string }[] = shopsRes.data ?? [];
      const rawWebsiteIds: string[] = (wsRes.data ?? []).map((r: { pos_product_id: string }) => r.pos_product_id);
      const spVariants: { pos_product_id: string; shopee_product_id: string }[] = spvRes.data ?? [];

      // Resolve tất cả variant IDs → root parent IDs bằng cách query pos_products
      const allLinkedIds = [...new Set([...rawWebsiteIds, ...spVariants.map(v => v.pos_product_id)])];
      const parentIdMap = new Map<string, string>(); // variantId -> rootId
      if (allLinkedIds.length > 0) {
        // Batch query theo chunks 500 để tránh URL quá dài
        for (let i = 0; i < allLinkedIds.length; i += 500) {
          const chunk = allLinkedIds.slice(i, i + 500);
          const { data: rows } = await supabase
            .from('pos_products')
            .select('id, parent_id')
            .in('id', chunk);
          for (const row of rows ?? []) {
            parentIdMap.set(row.id, row.parent_id ?? row.id);
          }
        }
      }

      // Website: dùng root ID
      const websiteIds: string[] = [...new Set(rawWebsiteIds.map(id => parentIdMap.get(id) ?? id))];

      // Lấy shopee_products để biết shop_id
      const spProductIds = [...new Set(spVariants.map(v => v.shopee_product_id))];
      let shopeeProductShopMap: Map<string, string> = new Map();
      if (spProductIds.length > 0) {
        const { data: spData } = await supabase.from('shopee_products').select('id, shop_id').in('id', spProductIds);
        for (const sp of spData ?? []) {
          if (sp.shop_id) shopeeProductShopMap.set(sp.id, sp.shop_id);
        }
      }

      // Map shopId -> root pos_product_id[]
      const shopeeByShop: Record<string, string[]> = {};
      for (const v of spVariants) {
        const shopId = shopeeProductShopMap.get(v.shopee_product_id);
        if (!shopId) continue;
        const rootId = parentIdMap.get(v.pos_product_id) ?? v.pos_product_id;
        if (!shopeeByShop[shopId]) shopeeByShop[shopId] = [];
        shopeeByShop[shopId].push(rootId);
      }
      // Deduplicate
      for (const k of Object.keys(shopeeByShop)) {
        shopeeByShop[k] = [...new Set(shopeeByShop[k])];
      }

      res.json({ ok: true, shops, websiteIds, shopeeByShop });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  // GET /api/channel-links/bulk-status?ids=id1,id2,...
  // Trả về trạng thái link hiện tại của danh sách root product IDs
  router.get('/api/channel-links/bulk-status', requireAuth, async (req, res) => {
    try {
      const ids = String(req.query.ids ?? '').split(',').map(s => s.trim()).filter(Boolean);
      if (!ids.length) { res.json({ ok: true, website: false, shopee: {} }); return; }

      // Fetch children for these roots
      const { data: children } = await supabase
        .from('pos_products')
        .select('id, parent_id')
        .in('parent_id', ids);
      const childMap = new Map<string, string[]>(); // parentId → [childIds]
      for (const c of (children ?? [])) {
        if (!childMap.has(c.parent_id)) childMap.set(c.parent_id, []);
        childMap.get(c.parent_id)!.push(c.id);
      }

      // Build all leaf IDs per root
      const leafsByRoot = new Map<string, string[]>();
      for (const rootId of ids) {
        const leaves = childMap.get(rootId);
        leafsByRoot.set(rootId, leaves && leaves.length > 0 ? leaves : [rootId]);
      }
      const allLeafIds = [...leafsByRoot.values()].flat();

      // Check website links
      const { data: wsLinks } = await supabase
        .from('store_product_variants')
        .select('pos_product_id')
        .in('pos_product_id', allLeafIds);
      const wsLinkedLeafs = new Set((wsLinks ?? []).map((r: { pos_product_id: string }) => r.pos_product_id));
      // Root is linked if ALL its leaves are linked
      const websiteLinkedRoots = ids.filter(rootId =>
        leafsByRoot.get(rootId)!.every(leafId => wsLinkedLeafs.has(leafId))
      );
      const websiteAll = websiteLinkedRoots.length === ids.length;

      // Check shopee links per shop
      const { data: shopsData } = await supabase.from('shopee_shops').select('id').order('display_order');
      const shopIds = (shopsData ?? []).map((s: { id: string }) => s.id);

      const { data: spvLinks } = await supabase
        .from('shopee_product_variants')
        .select('pos_product_id, shopee_product_id')
        .in('pos_product_id', allLeafIds);

      const spvRows = spvLinks ?? [];
      const shopeeProductIds = [...new Set(spvRows.map((r: { shopee_product_id: string }) => r.shopee_product_id))];

      // Map shopee_product_id → shop_id
      const shopeeByProduct = new Map<string, string>();
      if (shopeeProductIds.length > 0) {
        const { data: spRows } = await supabase
          .from('shopee_products')
          .select('id, shop_id')
          .in('id', shopeeProductIds);
        for (const sp of (spRows ?? [])) shopeeByProduct.set(sp.id, sp.shop_id);
      }

      // For each shop: which leaf IDs are linked?
      const shopeeResult: Record<string, boolean> = {};
      for (const shopId of shopIds) {
        const linkedLeafs = new Set(
          spvRows
            .filter((r: { shopee_product_id: string }) => shopeeByProduct.get(r.shopee_product_id) === shopId)
            .map((r: { pos_product_id: string }) => r.pos_product_id)
        );
        const linkedRoots = ids.filter(rootId =>
          leafsByRoot.get(rootId)!.every(leafId => linkedLeafs.has(leafId))
        );
        shopeeResult[shopId] = linkedRoots.length === ids.length;
      }

      res.json({ ok: true, website: websiteAll, shopee: shopeeResult });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  // GET /api/channel-links/shopee-shops — danh sách tất cả shops (cho modal bulk)
  router.get('/api/channel-links/shopee-shops', requireAuth, async (_req, res) => {
    try {
      const { data, error } = await supabase
        .from('shopee_shops')
        .select('id, name')
        .order('display_order');
      if (error) throw new Error(error.message);
      res.json({ ok: true, shops: data ?? [] });
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

      // Website publishing requires role check in production.
      // Dev mode bypasses this (same as requireAuth) since there's no real Supabase session.
      if (channel === 'website' && process.env.NODE_ENV === 'production') {
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

  // POST /api/channel-links/bulk-toggle
  // Body: { operations: [{channel, action, shopId?}], posProductIds: string[] }
  router.post('/api/channel-links/bulk-toggle', requireAuth, async (req, res) => {
    try {
      const { operations, posProductIds } = req.body as {
        operations: Array<{ channel: 'website' | 'shopee'; action: 'link' | 'unlink'; shopId?: string }>;
        posProductIds: string[];
      };

      if (!operations?.length || !posProductIds?.length) {
        res.status(400).json({ ok: false, error: 'Thiếu tham số operations hoặc posProductIds' });
        return;
      }

      // Fetch root products
      const { data: rootProducts, error: rootErr } = await supabase
        .from('pos_products')
        .select('id, name, sku, parent_id')
        .in('id', posProductIds);
      if (rootErr) throw new Error(rootErr.message);
      if (!rootProducts?.length) { res.json({ ok: true }); return; }

      // Fetch all active children for these roots
      const { data: allChildren } = await supabase
        .from('pos_products')
        .select('id, name, sku, parent_id')
        .in('parent_id', rootProducts.map(p => p.id))
        .eq('status', 'Active');

      const childrenByParent = new Map<string, Array<{ id: string; sku: string }>>();
      for (const child of (allChildren ?? [])) {
        if (!childrenByParent.has(child.parent_id)) childrenByParent.set(child.parent_id, []);
        childrenByParent.get(child.parent_id)!.push({ id: child.id, sku: child.sku });
      }

      // Build groups: each root with its leaves
      type Group = { root: { id: string; name: string; sku: string }; leaves: Array<{ id: string; sku: string }> };
      const groups: Group[] = rootProducts.map(root => {
        const children = childrenByParent.get(root.id) ?? [];
        return {
          root: { id: root.id, name: root.name, sku: root.sku },
          leaves: children.length > 0 ? children : [{ id: root.id, sku: root.sku }],
        };
      });

      const allLeafIds = groups.flatMap(g => g.leaves.map(l => l.id));

      for (const op of operations) {
        if (op.channel === 'website') {
          if (op.action === 'unlink') {
            const { error } = await supabase
              .from('store_product_variants')
              .delete()
              .in('pos_product_id', allLeafIds);
            if (error) throw new Error(`[store_product_variants] bulk delete: ${error.message}`);
          } else {
            for (const { root, leaves } of groups) {
              const storeProductId = await ensureStoreProduct(root.id, root.name, root.sku);
              const { error: e1 } = await supabase
                .from('store_product_variants')
                .delete()
                .in('pos_product_id', leaves.map(l => l.id));
              if (e1) throw new Error(`[store_product_variants] delete: ${e1.message}`);
              const { error: e2 } = await supabase
                .from('store_product_variants')
                .insert(leaves.map(l => ({ store_product_id: storeProductId, pos_product_id: l.id, sku: l.sku, is_published: true })));
              if (e2) throw new Error(`[store_product_variants] insert: ${e2.message}`);
            }
          }
        } else {
          // shopee
          if (op.action === 'unlink') {
            if (op.shopId) {
              const { data: variants } = await supabase
                .from('shopee_product_variants')
                .select('shopee_product_id')
                .in('pos_product_id', allLeafIds);
              const spIds = [...new Set((variants ?? []).map((v: { shopee_product_id: string }) => v.shopee_product_id))];
              if (spIds.length > 0) {
                const { data: spForShop } = await supabase
                  .from('shopee_products')
                  .select('id')
                  .in('id', spIds)
                  .eq('shop_id', op.shopId);
                const idsToRemove = (spForShop ?? []).map((s: { id: string }) => s.id);
                if (idsToRemove.length > 0) {
                  const { error } = await supabase
                    .from('shopee_product_variants')
                    .delete()
                    .in('pos_product_id', allLeafIds)
                    .in('shopee_product_id', idsToRemove);
                  if (error) throw new Error(`[shopee_product_variants] bulk delete by shop: ${error.message}`);
                }
              }
            } else {
              const { error } = await supabase
                .from('shopee_product_variants')
                .delete()
                .in('pos_product_id', allLeafIds);
              if (error) throw new Error(`[shopee_product_variants] bulk delete: ${error.message}`);
            }
          } else {
            for (const { root, leaves } of groups) {
              const shopeeProductId = await ensureShopeeProduct(root.id, root.name, undefined, op.shopId);
              const { data: existing } = await supabase
                .from('shopee_product_variants')
                .select('pos_product_id')
                .in('pos_product_id', leaves.map(l => l.id))
                .eq('shopee_product_id', shopeeProductId);
              const existingIds = new Set((existing ?? []).map((e: { pos_product_id: string }) => e.pos_product_id));
              const toInsert = leaves.filter(l => !existingIds.has(l.id));
              if (toInsert.length > 0) {
                const { error } = await supabase
                  .from('shopee_product_variants')
                  .insert(toInsert.map(l => ({ shopee_product_id: shopeeProductId, pos_product_id: l.id, sku: l.sku, is_published: true })));
                if (error) throw new Error(`[shopee_product_variants] bulk insert shopee: ${error.message}`);
              }
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
