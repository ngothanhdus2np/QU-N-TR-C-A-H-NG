import React, { useState, useEffect } from 'react';
import { Globe, ShoppingBag, X, Loader2 } from 'lucide-react';
import { POSProduct } from '../../types';

interface Shop {
  id: string;
  name: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: string[];
  products: POSProduct[];
  onSuccess?: () => void;
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none disabled:cursor-not-allowed shrink-0 ${
        checked ? 'bg-indigo-600' : 'bg-slate-200'
      }`}
    >
      <span
        className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? 'translate-x-6' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export function BulkChannelLinkModal({ isOpen, onClose, selectedIds, products, onSuccess }: Props) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [websiteOn, setWebsiteOn] = useState(false);
  const [shopeeOn, setShopeeOn] = useState<Record<string, boolean>>({});
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Chỉ gửi root product IDs lên server
  const rootProductIds = React.useMemo(() => {
    return selectedIds.filter(id => {
      const p = products.find(x => x.id === id);
      return p && !p.parentId;
    });
  }, [selectedIds, products]);

  useEffect(() => {
    if (!isOpen || rootProductIds.length === 0) return;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch('/api/channel-links/shopee-shops', { credentials: 'include' }).then(r => r.json()),
      fetch(`/api/channel-links/bulk-status?ids=${rootProductIds.join(',')}`, { credentials: 'include' }).then(r => r.json()),
    ]).then(([shopsJson, statusJson]) => {
      const shopList: Shop[] = shopsJson.ok ? shopsJson.shops : [];
      setShops(shopList);
      if (statusJson.ok) {
        setWebsiteOn(statusJson.website ?? false);
        const shopeeState: Record<string, boolean> = {};
        for (const s of shopList) {
          shopeeState[s.id] = statusJson.shopee?.[s.id] ?? false;
        }
        setShopeeOn(shopeeState);
      } else {
        setShopeeOn(Object.fromEntries(shopList.map(s => [s.id, false])));
      }
    }).catch(() => {
      setShops([]);
      setWebsiteOn(false);
      setShopeeOn({});
    }).finally(() => setLoading(false));
  }, [isOpen, rootProductIds.join(',')]);

  const handleApply = async () => {
    if (rootProductIds.length === 0) return;
    setProcessing(true);
    setError(null);

    // Sync trạng thái: ON = link, OFF = unlink
    const operations: Array<{ channel: 'website' | 'shopee'; action: 'link' | 'unlink'; shopId?: string }> = [
      { channel: 'website', action: websiteOn ? 'link' : 'unlink' },
      ...Object.entries(shopeeOn).map(([shopId, on]) => ({
        channel: 'shopee' as const,
        action: (on ? 'link' : 'unlink') as 'link' | 'unlink',
        shopId,
      })),
    ];

    try {
      const res = await fetch('/api/channel-links/bulk-toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ operations, posProductIds: rootProductIds }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Lỗi không xác định');
      onSuccess?.();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Liên kết kênh bán hàng</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {rootProductIds.length} sản phẩm đã chọn
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Channel list */}
        <div className="px-5 py-3 space-y-1">
          {error && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700 mb-2">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={18} className="animate-spin text-slate-300" />
            </div>
          ) : (
            <>
              {/* Website */}
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                    <Globe size={15} className="text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">Website PHÚC SANG</p>
                    <p className="text-xs text-slate-400">{websiteOn ? 'Đang bật bán' : 'Chưa liên kết'}</p>
                  </div>
                </div>
                <Toggle checked={websiteOn} onChange={() => setWebsiteOn(v => !v)} />
              </div>

              {/* Shopee shops */}
              {shops.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Chưa có shop Shopee nào</p>
              ) : shops.map((shop, idx) => (
                <div key={shop.id} className="flex items-center justify-between py-3 border-t border-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                      <ShoppingBag size={15} className="text-orange-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{shop.name}</p>
                      <p className="text-xs text-slate-400">
                        {shopeeOn[shop.id] ? 'Đang bật bán' : 'Chưa liên kết'} · Shop {idx + 1}
                      </p>
                    </div>
                  </div>
                  <Toggle
                    checked={shopeeOn[shop.id] ?? false}
                    onChange={() => setShopeeOn(prev => ({ ...prev, [shop.id]: !prev[shop.id] }))}
                  />
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            disabled={processing}
            className="px-3.5 py-2 rounded-lg text-xs text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Huỷ
          </button>
          <button
            onClick={handleApply}
            disabled={loading || processing || rootProductIds.length === 0}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
          >
            {processing && <Loader2 size={13} className="animate-spin" />}
            Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  );
}
