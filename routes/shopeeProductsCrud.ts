import { Router, RequestHandler } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';

export function createShopeeProductsCrudRouter(
  supabase: SupabaseClient,
  requireAuth: RequestHandler,
) {
  const router = Router();

  // GET /api/shopee-products
  router.get('/api/shopee-products', requireAuth, async (_req, res) => {
    try {
      // Thử query đầy đủ (bao gồm shopee_price_override)
      let result = await supabase
        .from('shopee_products')
        .select(`
          id, name, cover_image_url, shopee_item_id, is_published, display_order, shop_id,
          shopee_product_variants (
            id, sku, size, color_name, shopee_price_override, pos_product_id, is_published, display_order
          )
        `)
        .is('deleted_at', null)
        .order('display_order', { ascending: true });

      // Nếu lỗi do cột shopee_price_override chưa tồn tại → thử lại không có cột đó
      if (result.error && result.error.message.includes('shopee_price_override')) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result = (await supabase
          .from('shopee_products')
          .select(`
            id, name, cover_image_url, shopee_item_id, is_published, display_order, shop_id,
            shopee_product_variants (
              id, sku, size, color_name, pos_product_id, is_published, display_order
            )
          `)
          .is('deleted_at', null)
          .order('display_order', { ascending: true })) as any;
      }

      if (result.error) {
        console.error('[shopee-products GET] query error:', result.error);
        throw new Error(result.error.message);
      }

      const { data: shops, error: shopsErr } = await supabase
        .from('shopee_shops')
        .select('id, name, slug');
      if (shopsErr) console.warn('[shopee-products GET] shops error:', shopsErr);

      res.json({ ok: true, products: result.data ?? [], shops: shops ?? [] });
    } catch (err: unknown) {
      console.error('[shopee-products GET] caught:', err);
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/shopee-products
  router.post('/api/shopee-products', requireAuth, async (req, res) => {
    try {
      const { name, cover_image_url, shopee_item_id, is_published, display_order, shop_id, variantDrafts } = req.body;
      if (!name?.trim()) { res.status(400).json({ ok: false, error: 'Thiếu tên sản phẩm' }); return; }

      const { data, error } = await supabase
        .from('shopee_products')
        .insert({ name: name.trim(), cover_image_url: cover_image_url || null, shopee_item_id: shopee_item_id || null, is_published: !!is_published, display_order: display_order ?? 0, shop_id: shop_id || null })
        .select('id')
        .single();
      if (error) throw new Error(error.message);

      if (variantDrafts && variantDrafts.length > 0) {
        const rows = variantDrafts.map((v: { pos_product_id: string; sku: string; size: string; color_name: string; shopee_price_override: string }, i: number) => ({
          shopee_product_id: data.id,
          pos_product_id: v.pos_product_id,
          sku: v.sku,
          size: v.size || null,
          color_name: v.color_name || null,
          ...(v.shopee_price_override ? { shopee_price_override: Number(v.shopee_price_override) } : {}),
          is_published: true,
          display_order: i,
        }));
        const { error: vErr } = await supabase.from('shopee_product_variants').insert(rows);
        if (vErr) throw new Error(vErr.message);
      }

      res.json({ ok: true, id: data.id });
    } catch (err: unknown) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  // PUT /api/shopee-products/:id
  router.put('/api/shopee-products/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, cover_image_url, shopee_item_id, is_published, display_order, shop_id, other_images, variantDrafts } = req.body;

      const updatePayload: Record<string, unknown> = {
        cover_image_url: cover_image_url || null,
        shopee_item_id: shopee_item_id || null,
        is_published: !!is_published,
        display_order: display_order ?? 0,
        shop_id: shop_id || null,
        description: description ?? null,
        gallery: Array.isArray(other_images) ? other_images : [],
        updated_at: new Date().toISOString(),
      };
      if (name?.trim()) updatePayload.name = name.trim();

      const { error } = await supabase
        .from('shopee_products')
        .update(updatePayload)
        .eq('id', id);
      if (error) throw new Error(error.message);

      await supabase.from('shopee_product_variants').delete().eq('shopee_product_id', id);
      if (variantDrafts && variantDrafts.length > 0) {
        const rows = variantDrafts.map((v: { pos_product_id: string; sku: string; size: string; color_name: string; shopee_price_override: string }, i: number) => ({
          shopee_product_id: id,
          pos_product_id: v.pos_product_id,
          sku: v.sku,
          size: v.size || null,
          color_name: v.color_name || null,
          ...(v.shopee_price_override ? { shopee_price_override: Number(v.shopee_price_override) } : {}),
          is_published: true,
          display_order: i,
        }));
        const { error: vErr } = await supabase.from('shopee_product_variants').insert(rows);
        if (vErr) throw new Error(vErr.message);
      }

      res.json({ ok: true });
    } catch (err: unknown) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  // PATCH /api/shopee-products/:id/publish — toggle is_published nhanh
  router.patch('/api/shopee-products/:id/publish', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { is_published } = req.body;
      const { error } = await supabase
        .from('shopee_products')
        .update({ is_published: !!is_published, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw new Error(error.message);
      res.json({ ok: true });
    } catch (err: unknown) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/shopee-products/sku-match — ghép catalog products với Shopee data theo SKU
  router.post('/api/shopee-products/sku-match', requireAuth, async (req, res) => {
    try {
      const preview = req.query.preview === 'true';

      // Lấy tất cả sản phẩm đã sync từ Shopee (có shopee_item_id) — kèm shop_id để tránh match chéo shop
      const { data: syncedProducts, error: syncedErr } = await supabase
        .from('shopee_products')
        .select('id, name, shop_id, shopee_item_id, cover_image_url, gallery, description, shopee_product_variants(sku)')
        .not('shopee_item_id', 'is', null)
        .is('deleted_at', null);
      if (syncedErr) throw new Error(syncedErr.message);

      // Lấy tất cả catalog products (không có shopee_item_id) — kèm shop_id
      const { data: catalogProducts, error: catalogErr } = await supabase
        .from('shopee_products')
        .select('id, name, shop_id, shopee_product_variants(sku)')
        .is('shopee_item_id', null)
        .is('deleted_at', null);
      if (catalogErr) throw new Error(catalogErr.message);

      // Build map: "${shop_id}|${sku}" → synced product (tránh match chéo shop)
      type SyncedProduct = { id: string; name: string; shop_id: string | null; shopee_item_id: string; cover_image_url: string | null; gallery: string[] | null; description: string | null; shopee_product_variants: { sku: string | null }[] };
      const skuToSynced = new Map<string, SyncedProduct>();
      for (const sp of (syncedProducts ?? []) as SyncedProduct[]) {
        for (const v of sp.shopee_product_variants ?? []) {
          if (v.sku) skuToSynced.set(`${sp.shop_id ?? ''}|${v.sku}`, sp);
        }
      }

      // Tìm matches — chỉ ghép cùng shop
      type CatalogProduct = { id: string; name: string; shop_id: string | null; shopee_product_variants: { sku: string | null }[] };
      const matches: Array<{ catalogId: string; catalogName: string; syncedId: string; syncedName: string; matchedSku: string; shopee_item_id: string; cover_image_url: string | null }> = [];
      for (const cp of (catalogProducts ?? []) as CatalogProduct[]) {
        for (const v of cp.shopee_product_variants ?? []) {
          const key = `${cp.shop_id ?? ''}|${v.sku}`;
          if (v.sku && skuToSynced.has(key)) {
            const synced = skuToSynced.get(key)!;
            if (!matches.find(m => m.catalogId === cp.id)) {
              matches.push({
                catalogId: cp.id,
                catalogName: cp.name,
                syncedId: synced.id,
                syncedName: synced.name,
                matchedSku: v.sku,
                shopee_item_id: synced.shopee_item_id,
                cover_image_url: synced.cover_image_url,
              });
            }
            break;
          }
        }
      }

      if (preview) {
        // Debug: sample data để kiểm tra shop_id + sku thực tế
        type SyncedProduct = { id: string; name: string; shop_id: string | null; shopee_item_id: string; cover_image_url: string | null; gallery: string[] | null; description: string | null; shopee_product_variants: { sku: string | null }[] };
        type CatalogProduct = { id: string; name: string; shop_id: string | null; shopee_product_variants: { sku: string | null }[] };
        const sampleSynced = ((syncedProducts ?? []) as SyncedProduct[]).slice(0, 3).map(sp => ({
          name: sp.name, shop_id: sp.shop_id,
          skus: sp.shopee_product_variants.slice(0, 3).map(v => v.sku),
        }));
        const sampleCatalog = ((catalogProducts ?? []) as CatalogProduct[]).slice(0, 3).map(cp => ({
          name: cp.name, shop_id: cp.shop_id,
          skus: cp.shopee_product_variants.slice(0, 3).map(v => v.sku),
        }));
        return res.json({
          ok: true, preview: true, matches, total: matches.length,
          debug: {
            syncedCount: (syncedProducts ?? []).length,
            catalogCount: (catalogProducts ?? []).length,
            sampleSynced,
            sampleCatalog,
          },
        });
      }

      // Cập nhật catalog products — copy name + ảnh + mô tả từ Shopee
      let updated = 0;
      for (const m of matches) {
        const synced = skuToSynced.get(
          [...skuToSynced.entries()].find(([, v]) => v.id === m.syncedId)?.[0] ?? ''
        )!;
        if (!synced) continue;
        const updatePayload: Record<string, unknown> = {
          shopee_item_id: synced.shopee_item_id,
          name: synced.name,
          updated_at: new Date().toISOString(),
        };
        if (synced.cover_image_url) updatePayload.cover_image_url = synced.cover_image_url;
        if (synced.gallery && synced.gallery.length > 0) updatePayload.gallery = synced.gallery;
        if (synced.description) updatePayload.description = synced.description;

        const { error: upErr } = await supabase
          .from('shopee_products')
          .update(updatePayload)
          .eq('id', m.catalogId);
        if (!upErr) updated++;
      }

      res.json({ ok: true, updated, total: matches.length });
    } catch (err: unknown) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  // DELETE /api/shopee-products/:id — soft delete
  router.delete('/api/shopee-products/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { error } = await supabase
        .from('shopee_products')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw new Error(error.message);
      res.json({ ok: true });
    } catch (err: unknown) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}
