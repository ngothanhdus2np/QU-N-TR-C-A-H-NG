import React, { useState, useEffect, useCallback } from 'react';
import { Globe, ShoppingBag, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { POSProduct } from '../../types';
import { toggleChannelBackend } from '../../services/channelLinkService';

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
  const activeBg = color === 'indigo' ? '#4f46e5' : '#f97316';
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        position: 'relative',
        display: 'inline-block',
        width: 56,
        height: 28,
        borderRadius: 9999,
        backgroundColor: checked ? activeBg : '#cbd5e1',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'background-color 0.2s ease',
        flexShrink: 0,
        outline: 'none',
        padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 4,
          left: checked ? 'calc(100% - 24px)' : 4,
          width: 20,
          height: 20,
          borderRadius: '50%',
          backgroundColor: '#ffffff',
          boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
          transition: 'left 0.2s ease',
          pointerEvents: 'none',
          display: 'block',
        }}
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
  const [websitePending, setWebsitePending] = useState(false);
  const [shopeePending, setShopeePending] = useState(false);

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

  const toggleAllShopee = async () => {
    if (shopeePending || shopeeShops.length === 0) return;
    const shopeeLinked = shopeeShops.some(s => s.linked);
    const action: 'link' | 'unlink' = shopeeLinked ? 'unlink' : 'link';
    setShopeeShops(prev => prev.map(s => ({ ...s, linked: !shopeeLinked })));
    setShopeePending(true);
    setError(null);
    try {
      let children: { id: string; sku: string }[] | null = null;
      if (product.isParent) {
        const { data, error: childErr } = await supabase
          .from('pos_products')
          .select('id, sku')
          .eq('parent_id', product.id)
          .eq('status', 'Active');
        if (childErr) throw new Error(childErr.message);
        if (!data || data.length === 0) throw new Error('Sản phẩm cha không có biến thể con nào đang hoạt động');
        children = data as { id: string; sku: string }[];
      }
      for (const shop of shopeeShops) {
        if (product.isParent) {
          await toggleChannelBackend({
            channel: 'shopee', action,
            product: { id: product.id, name: product.name, sku: product.sku, isParent: true },
            childIds: children!,
            shopId: shop.id,
          });
        } else {
          await toggleChannelBackend({
            channel: 'shopee', action,
            product: { id: product.id, name: product.name, sku: product.sku, parentId: product.parentId },
            shopId: shop.id,
          });
        }
      }
    } catch (e: unknown) {
      loadStatus();
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setShopeePending(false);
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

      {/* Shopee — combined toggle */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        {shopeeShops.length === 0 ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
              <ShoppingBag className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">Shopee</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Chưa có shop nào. Vào <span className="font-medium">Cài đặt → Tích hợp</span> để thêm.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                <ShoppingBag className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">Shopee</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {(() => {
                    const linkedCount = shopeeShops.filter(s => s.linked).length;
                    if (linkedCount === 0) return 'Chưa đăng bán shop nào';
                    if (linkedCount === shopeeShops.length) return `Đang bán trên ${linkedCount} shop`;
                    return `Đang bán trên ${linkedCount}/${shopeeShops.length} shop`;
                  })()}
                </p>
              </div>
            </div>
            <ToggleSwitch
              checked={shopeeShops.some(s => s.linked)}
              onChange={toggleAllShopee}
              disabled={shopeePending}
              color="orange"
              aria-label={shopeeShops.some(s => s.linked) ? 'Tắt bán Shopee' : 'Bật bán Shopee'}
            />
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 px-1">
        Sau khi bật, sản phẩm sẽ hiện trong trang Catalog Online và có thể bán hàng trên kênh tương ứng.
      </p>
    </div>
  );
}
