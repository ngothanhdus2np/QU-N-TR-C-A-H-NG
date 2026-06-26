import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  } catch {
    throw new Error(`Lỗi server (HTTP ${res.status}) — server có thể chưa restart sau cập nhật`);
  }
  if (!json.ok) throw new Error(json.error ?? 'Lỗi không xác định');
}

function ToggleSwitch({
  checked,
  onChange,
  disabled,
  color,
  'aria-label': ariaLabel,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  color: 'indigo' | 'orange';
  'aria-label': string;
}) {
  const activeClass = color === 'indigo' ? 'bg-indigo-600' : 'bg-orange-500';
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none disabled:cursor-not-allowed ${
        checked ? activeClass : 'bg-slate-200'
      }`}
    >
      <span
        className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-6' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export function GoodsChannelLinksTab({ product }: Props) {
  const [website, setWebsite] = useState<ChannelStatus | null>(null);
  const [shopeeShops, setShopeeShops] = useState<ShopeeShopStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [childCount, setChildCount] = useState<{ website: number; shopee: number; total: number } | null>(null);
  // track which shops are mid-flight to prevent double-click
  const pendingShops = useRef<Set<string>>(new Set());
  const [websitePending, setWebsitePending] = useState(false);

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
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [product.id, product.isParent]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const toggleWebsite = async () => {
    if (websitePending || !website) return;
    const wasLinked = website.linked;
    // optimistic update
    setWebsite(prev => prev ? { ...prev, linked: !prev.linked } : prev);
    setWebsitePending(true);
    setError(null);
    try {
      if (!product.isParent) {
        await toggleChannelBackend({
          channel: 'website',
          action: wasLinked ? 'unlink' : 'link',
          product: { id: product.id, name: product.name, sku: product.sku, parentId: product.parentId },
          variantId: website.variantId,
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
          action: wasLinked ? 'unlink' : 'link',
          product: { id: product.id, name: product.name, sku: product.sku, isParent: true },
          childIds: children as { id: string; sku: string }[],
        });
      }
    } catch (e: unknown) {
      // rollback
      setWebsite(prev => prev ? { ...prev, linked: wasLinked } : prev);
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setWebsitePending(false);
    }
  };

  const toggleShopeeShop = async (shop: ShopeeShopStatus) => {
    if (pendingShops.current.has(shop.id)) return;
    const wasLinked = shop.linked;
    // optimistic update
    setShopeeShops(prev => prev.map(s => s.id === shop.id ? { ...s, linked: !s.linked } : s));
    pendingShops.current.add(shop.id);
    setError(null);
    try {
      if (!product.isParent) {
        await toggleChannelBackend({
          channel: 'shopee',
          action: wasLinked ? 'unlink' : 'link',
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
          action: wasLinked ? 'unlink' : 'link',
          product: { id: product.id, name: product.name, sku: product.sku, isParent: true },
          childIds: children as { id: string; sku: string }[],
          shopId: shop.id,
        });
      }
    } catch (e: unknown) {
      // rollback
      setShopeeShops(prev => prev.map(s => s.id === shop.id ? { ...s, linked: wasLinked } : s));
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      pendingShops.current.delete(shop.id);
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
          <ToggleSwitch
            checked={!!website?.linked}
            onChange={toggleWebsite}
            disabled={websitePending}
            color="indigo"
            aria-label={website?.linked ? 'Tắt bán Website' : 'Bật bán Website'}
          />
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
            {shopeeShops.map(shop => (
              <div key={shop.id} className="flex items-center justify-between px-4 py-3.5">
                <div>
                  <p className="text-sm text-slate-700">{shop.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {shop.linked ? 'Đang bán trên shop này' : 'Chưa đăng bán'}
                  </p>
                </div>
                <ToggleSwitch
                  checked={shop.linked}
                  onChange={() => toggleShopeeShop(shop)}
                  color="orange"
                  aria-label={shop.linked ? `Tắt bán shop ${shop.name}` : `Bật bán shop ${shop.name}`}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 px-1">
        Sau khi bật, sản phẩm sẽ hiện trong trang Catalog Online và có thể bán hàng trên kênh tương ứng.
      </p>
    </div>
  );
}
