import React, { useState, useEffect, useCallback } from 'react';
import { Globe, ShoppingBag, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { POSProduct } from '../../types';

interface ChannelStatus {
  linked: boolean;
  variantId?: string;
  storeProductId?: string;
}

interface ShopeeShopStatus {
  id: string;
  name: string;
  linked: boolean;
}

interface Props {
  product: POSProduct;
}

async function toggleChannelBackend(payload: {
  channel: 'website' | 'shopee';
  action: 'link' | 'unlink';
  product: { id: string; name: string; sku: string; parentId?: string; isParent?: boolean };
  childIds?: { id: string; sku: string }[];
  variantId?: string;
  shopId?: string;
}): Promise<void> {
  const res = await fetch('/api/channel-links/toggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  let json: { ok: boolean; error?: string };
  try {
    json = await res.json();
  } catch (parseErr) {
    throw new Error(`Lỗi server (HTTP ${res.status}) — server có thể chưa restart sau cập nhật`);
  }
  if (!json.ok) throw new Error(json.error ?? 'Lỗi không xác định');
}

export function GoodsChannelLinksTab({ product }: Props) {
  const [website, setWebsite] = useState<ChannelStatus | null>(null);
  const [shopeeShops, setShopeeShops] = useState<ShopeeShopStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingChannel, setSavingChannel] = useState<'website' | null>(null);
  const [togglingShop, setTogglingShop] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [childCount, setChildCount] = useState<{ website: number; shopee: number; total: number } | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ productId: product.id, isParent: product.isParent ? 'true' : 'false' });

      const [statusRes, shopsRes] = await Promise.all([
        fetch(`/api/channel-links/status?${params}`, { credentials: 'include' }),
        fetch(`/api/channel-links/shopee-shops-status?${params}`, { credentials: 'include' }),
      ]);

      const statusJson: {
        ok: boolean;
        error?: string;
        website: ChannelStatus;
        shopee: ChannelStatus;
        childCount?: { website: number; shopee: number; total: number };
      } = await statusRes.json();
      if (!statusJson.ok) throw new Error(statusJson.error ?? 'Lỗi tải trạng thái kênh');
      setWebsite(statusJson.website);
      if (statusJson.childCount) setChildCount(statusJson.childCount);

      const shopsJson: { ok: boolean; error?: string; shops: ShopeeShopStatus[] } = await shopsRes.json();
      if (shopsJson.ok) setShopeeShops(shopsJson.shops);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [product.id, product.isParent]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const toggleWebsite = async () => {
    setSavingChannel('website');
    setError(null);
    try {
      if (!product.isParent) {
        await toggleChannelBackend({
          channel: 'website',
          action: website?.linked ? 'unlink' : 'link',
          product: { id: product.id, name: product.name, sku: product.sku, parentId: product.parentId },
          variantId: website?.variantId,
        });
      } else {
        const { data: children, error: childErr } = await supabase
          .from('pos_products')
          .select('id, sku')
          .eq('parent_id', product.id)
          .eq('status', 'Active');
        if (childErr) throw new Error(childErr.message);
        if (!children || children.length === 0) throw new Error('Sản phẩm cha không có biến thể con nào đang hoạt động');
        await toggleChannelBackend({
          channel: 'website',
          action: website?.linked ? 'unlink' : 'link',
          product: { id: product.id, name: product.name, sku: product.sku, isParent: true },
          childIds: children as { id: string; sku: string }[],
        });
      }
      await loadStatus();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? String(e);
      setError(msg);
    } finally {
      setSavingChannel(null);
    }
  };

  const toggleShopeeShop = async (shop: ShopeeShopStatus) => {
    setTogglingShop(shop.id);
    setError(null);
    try {
      if (!product.isParent) {
        await toggleChannelBackend({
          channel: 'shopee',
          action: shop.linked ? 'unlink' : 'link',
          product: { id: product.id, name: product.name, sku: product.sku, parentId: product.parentId },
          shopId: shop.id,
        });
      } else {
        const { data: children, error: childErr } = await supabase
          .from('pos_products')
          .select('id, sku')
          .eq('parent_id', product.id)
          .eq('status', 'Active');
        if (childErr) throw new Error(childErr.message);
        if (!children || children.length === 0) throw new Error('Sản phẩm cha không có biến thể con nào đang hoạt động');
        await toggleChannelBackend({
          channel: 'shopee',
          action: shop.linked ? 'unlink' : 'link',
          product: { id: product.id, name: product.name, sku: product.sku, isParent: true },
          childIds: children as { id: string; sku: string }[],
          shopId: shop.id,
        });
      }
      await loadStatus();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? String(e);
      setError(msg);
    } finally {
      setTogglingShop(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {product.isParent && childCount && (
        <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-3 text-sm text-indigo-700">
          Đây là sản phẩm cha có <strong>{childCount.total} biến thể</strong>. Bật/tắt kênh sẽ áp dụng cho tất cả biến thể con.
        </div>
      )}

      {/* Website */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
              <Globe className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">Website PHÚC SANG</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {product.isParent && childCount
                  ? childCount.website > 0
                    ? `${childCount.website}/${childCount.total} biến thể đang bán`
                    : 'Chưa liên kết kênh nào'
                  : website?.linked
                    ? 'Đang bán'
                    : 'Chưa liên kết'}
              </p>
            </div>
          </div>
          <button
            onClick={toggleWebsite}
            disabled={savingChannel !== null || togglingShop !== null}
            className={`relative w-12 h-6 rounded-full transition-colors focus:outline-none disabled:opacity-60 ${
              website?.linked ? 'bg-indigo-600' : 'bg-slate-200'
            }`}
            aria-label={website?.linked ? 'Tắt bán Website' : 'Bật bán Website'}
          >
            {savingChannel === 'website' ? (
              <Loader2 className="absolute inset-0 m-auto h-4 w-4 animate-spin text-white" />
            ) : (
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  website?.linked ? 'left-7' : 'left-1'
                }`}
              />
            )}
          </button>
        </div>
      </div>

      {/* Shopee — per-shop toggles */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
            <ShoppingBag className="h-4 w-4 text-orange-500" />
          </div>
          <span className="text-sm font-medium text-slate-900">Shopee</span>
        </div>

        {shopeeShops.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-slate-400">
            Chưa có shop Shopee nào được kết nối.<br />
            Vào <span className="font-medium">Cài đặt → Tích hợp</span> để thêm shop.
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {shopeeShops.map(shop => {
              const isToggling = togglingShop === shop.id;
              return (
                <div key={shop.id} className="flex items-center justify-between px-4 py-3.5">
                  <div>
                    <p className="text-sm text-slate-700">{shop.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {shop.linked ? 'Đang bán trên shop này' : 'Chưa đăng bán'}
                    </p>
                  </div>
                  <button
                    disabled={isToggling || savingChannel !== null || (togglingShop !== null && togglingShop !== shop.id)}
                    onClick={() => toggleShopeeShop(shop)}
                    className={`relative w-12 h-6 rounded-full transition-colors focus:outline-none disabled:opacity-60 ${
                      shop.linked ? 'bg-orange-500' : 'bg-slate-200'
                    }`}
                    aria-label={shop.linked ? `Tắt bán shop ${shop.name}` : `Bật bán shop ${shop.name}`}
                  >
                    {isToggling ? (
                      <Loader2 className="absolute inset-0 m-auto h-4 w-4 animate-spin text-white" />
                    ) : (
                      <span
                        className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                          shop.linked ? 'left-7' : 'left-1'
                        }`}
                      />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 px-1">
        Sau khi bật, sản phẩm sẽ hiện trong trang Catalog Online và có thể bán hàng trên kênh tương ứng.
      </p>
    </div>
  );
}
