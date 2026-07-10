import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, RefreshCw, LogIn, Trash2, CheckCircle2, XCircle,
  AlertTriangle, Loader2, ShoppingBag, ExternalLink, X, Clock,
  Link2, Activity, Globe, Package,
} from 'lucide-react';
import { adminStoreRequest } from '../../services/adminStoreApi';
import { translateError } from '../../services/errorMessages';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShopeeChannel {
  type: 'shopee';
  id: string;
  name: string;
  slug: string;
  shop_url: string | null;
  port: number | null;
  display_order: number;
  last_sync_at: string | null;
  liveStatus: 'running' | 'stopped' | 'login_required' | 'no_port' | 'auto_retrying';
  orders?: number;
}

interface WebsiteChannel {
  type: 'website';
  id: 'website';
  name: string;
  slug: string;
  shop_url: string;
  liveStatus: 'running';
  totalProducts: number;
  publishedProducts: number;
}

type Channel = ShopeeChannel | WebsiteChannel;

interface PageProps {
  navigationSlot?: React.ReactNode;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiGet<T>(url: string): Promise<T> {
  return adminStoreRequest<T>(url);
}

async function apiPost<T>(url: string, body: unknown = {}): Promise<T> {
  return adminStoreRequest<T>(url, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

async function apiDel<T>(url: string): Promise<T> {
  return adminStoreRequest<T>(url, { method: 'DELETE' });
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Channel['liveStatus'] }) {
  if (status === 'running')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-normal text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="h-3 w-3" />
        Hoạt động
      </span>
    );
  if (status === 'auto_retrying')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-normal text-blue-600 border border-blue-200">
        <Loader2 className="h-3 w-3 animate-spin" />
        Đang tự đăng nhập...
      </span>
    );
  if (status === 'login_required')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-normal text-amber-700 border border-amber-200">
        <AlertTriangle className="h-3 w-3" />
        Cần đăng nhập
      </span>
    );
  if (status === 'no_port')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-normal text-slate-500 border border-slate-200">
        <XCircle className="h-3 w-3" />
        Chưa cấu hình
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-normal text-slate-500 border border-slate-200">
      <XCircle className="h-3 w-3" />
      Bot dừng
    </span>
  );
}

// ─── Add channel modal ────────────────────────────────────────────────────────

function AddChannelModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [name, setName]       = useState('');
  const [slug, setSlug]       = useState('');
  const [shopUrl, setShopUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await apiPost('/api/channels', { name: name.trim(), slug: slug.trim(), shop_url: shopUrl.trim() || undefined });
      onAdded();
      onClose();
    } catch (err: unknown) {
      setError(translateError(err, 'Không thêm được kênh'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-slate-800">Thêm gian hàng Shopee</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-normal text-slate-600 mb-1.5">Tên gian hàng</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="VD: Phúc Sang Shop 3"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-normal text-slate-600 mb-1.5">Slug (không dấu, không space)</label>
            <input
              type="text"
              value={slug}
              onChange={e => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              placeholder="VD: phucsang-shop3"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-normal text-slate-600 mb-1.5">URL gian hàng Shopee (tuỳ chọn)</label>
            <input
              type="url"
              value={shopUrl}
              onChange={e => setShopUrl(e.target.value)}
              placeholder="https://shopee.vn/shop/..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
            <p className="text-xs text-amber-700 font-normal">
              Sau khi thêm, Chrome sẽ mở trên iMac để bạn đăng nhập Shopee Seller Center lần đầu.
              Sau đó bot tự chạy ngầm và đồng bộ đơn hàng về app.
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-normal text-slate-600 hover:bg-slate-50 transition-colors">
              Huỷ
            </button>
            <button type="submit" disabled={loading || !name.trim() || !slug.trim()}
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-normal hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {loading ? 'Đang tạo...' : 'Thêm gian hàng'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Relogin modal ────────────────────────────────────────────────────────────

function ReloginModal({ channel, onClose, onDone }: { channel: ShopeeChannel; onClose: () => void; onDone: () => void }) {
  const [step, setStep]       = useState<'confirm' | 'waiting' | 'done'>('confirm');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const handleOpenChrome = async () => {
    setLoading(true);
    setError(null);
    try {
      await apiPost(`/api/channels/${channel.id}/relogin`);
      setStep('waiting');
    } catch (err: unknown) {
      setError(translateError(err, 'Không đăng nhập lại được kênh'));
    } finally {
      setLoading(false);
    }
  };

  const handleDone = async () => {
    setLoading(true);
    try {
      await apiPost(`/api/channels/${channel.id}/relogin-done`);
      setStep('done');
      setTimeout(() => { onDone(); onClose(); }, 1500);
    } catch {
      onDone(); onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-slate-800">Đăng nhập lại — {channel.name}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === 'confirm' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Bấm bên dưới để mở Chrome trên iMac. Đăng nhập Shopee Seller Center bình thường (nhập OTP nếu có).
            </p>
            {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <button onClick={handleOpenChrome} disabled={loading}
              className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-normal hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Mở Chrome để đăng nhập
            </button>
          </div>
        )}

        {step === 'waiting' && (
          <div className="space-y-4">
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3">
              <p className="text-sm text-indigo-700 font-normal">Chrome đã mở trên iMac.</p>
              <p className="text-xs text-indigo-600 mt-1">
                Đăng nhập → nhập OTP → vào được trang chủ Seller Center → bấm Hoàn thành.
              </p>
            </div>
            <button onClick={handleDone} disabled={loading}
              className="w-full px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-normal hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Hoàn thành, đã đăng nhập xong
            </button>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center py-4">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
            <p className="text-sm font-normal text-slate-700">Bot đang khởi động lại...</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shopee channel row ───────────────────────────────────────────────────────

function ShopeeRow({
  channel,
  onSync,
  onRelogin,
  onDelete,
  syncingId,
  deleteConfirm,
  onDeleteConfirmChange,
}: {
  channel: ShopeeChannel;
  onSync: (id: string) => void;
  onRelogin: (ch: ShopeeChannel) => void;
  onDelete: (id: string) => void;
  syncingId: string | null;
  deleteConfirm: string | null;
  onDeleteConfirmChange: (id: string | null) => void;
}) {
  const syncing    = syncingId === channel.id;
  const confirming = deleteConfirm === channel.id;

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
            <ShoppingBag className="h-4 w-4 text-orange-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{channel.name}</p>
            <p className="text-xs text-slate-400">Shopee · {channel.slug}</p>
          </div>
        </div>
      </td>

      <td className="px-4 py-3.5">
        <StatusBadge status={channel.liveStatus} />
      </td>

      <td className="px-4 py-3.5 text-center">
        {channel.orders !== undefined ? (
          <span className="text-sm font-medium text-slate-700">{channel.orders.toLocaleString('vi-VN')}</span>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )}
      </td>

      <td className="px-4 py-3.5">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Clock className="h-3 w-3 shrink-0" />
          {channel.last_sync_at
            ? new Date(channel.last_sync_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
            : 'Chưa sync'}
        </div>
      </td>

      <td className="px-4 py-3.5">
        {channel.shop_url ? (
          <a href={channel.shop_url} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 hover:underline">
            <ExternalLink className="h-3 w-3" />
            Xem Shopee
          </a>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )}
      </td>

      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2 justify-end">
          {channel.liveStatus === 'auto_retrying' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-normal text-blue-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Đang thử...
            </span>
          )}
          {channel.liveStatus === 'login_required' && (
            <button onClick={() => onRelogin(channel)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-normal hover:bg-amber-600 transition-colors">
              <LogIn className="h-3 w-3" />
              Đăng nhập lại
            </button>
          )}
          <button onClick={() => onSync(channel.id)}
            disabled={syncing || channel.liveStatus !== 'running'}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-normal text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Sync
          </button>
          {confirming ? (
            <div className="flex items-center gap-1">
              <button onClick={() => onDelete(channel.id)}
                className="px-2.5 py-1.5 bg-red-500 text-white rounded-lg text-xs font-normal hover:bg-red-600 transition-colors">
                Xác nhận xóa
              </button>
              <button onClick={() => onDeleteConfirmChange(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button onClick={() => onDeleteConfirmChange(channel.id)}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Website channel row ──────────────────────────────────────────────────────

function WebsiteRow({ channel }: { channel: WebsiteChannel }) {
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
            <Globe className="h-4 w-4 text-blue-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800">{channel.name}</p>
            <p className="text-xs text-slate-400">Website · {channel.slug}</p>
          </div>
        </div>
      </td>

      <td className="px-4 py-3.5">
        <StatusBadge status="running" />
      </td>

      <td className="px-4 py-3.5 text-center">
        <div className="inline-flex items-center gap-1">
          <Package className="h-3 w-3 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">{channel.publishedProducts}</span>
          <span className="text-xs text-slate-400">/ {channel.totalProducts} SP</span>
        </div>
      </td>

      <td className="px-4 py-3.5">
        <span className="text-xs text-slate-400">Website tĩnh · không cần sync</span>
      </td>

      <td className="px-4 py-3.5">
        <a href={channel.shop_url} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 hover:underline">
          <ExternalLink className="h-3 w-3" />
          Xem website
        </a>
      </td>

      <td className="px-4 py-3.5">
        {/* Website không có action quản lý bot */}
      </td>
    </tr>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WebsiteChannelLinksPage({ navigationSlot }: PageProps) {
  const [channels, setChannels]         = useState<Channel[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [syncingId, setSyncingId]       = useState<string | null>(null);
  const [showAdd, setShowAdd]           = useState(false);
  const [reloginChannel, setReloginChannel] = useState<ShopeeChannel | null>(null);
  const [deleteConfirm, setDeleteConfirm]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<{ ok: boolean; channels: Channel[] }>('/api/channels');
      setChannels(res.channels ?? []);
    } catch (err: unknown) {
      setError(translateError(err, 'Không tải được danh sách kênh'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  const handleSync = async (id: string) => {
    setSyncingId(id);
    try {
      await apiPost(`/api/channels/${id}/sync`);
      await load();
    } catch {
      /* ignore */
    } finally {
      setSyncingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteConfirm(null);
    try {
      await apiDel(`/api/channels/${id}`);
      await load();
    } catch { /* ignore */ }
  };

  const shopeeChannels    = channels.filter((c): c is ShopeeChannel => c.type === 'shopee');
  const loginRequired     = shopeeChannels.filter(c => c.liveStatus === 'login_required').length;
  const autoRetrying      = shopeeChannels.filter(c => c.liveStatus === 'auto_retrying').length;
  const runningShopee     = shopeeChannels.filter(c => c.liveStatus === 'running').length;
  const websiteChannel    = channels.find((c): c is WebsiteChannel => c.type === 'website');

  return (
    <div className="grid h-full min-h-0 grid-cols-[280px_minmax(0,1fr)] gap-4 overflow-hidden bg-slate-50 px-4 pb-5 pt-10">
      {/* Left sidebar */}
      <aside className="flex h-full min-h-0 flex-col gap-4">
        {navigationSlot}
      </aside>

      {/* Main content */}
      <div className="flex flex-col h-full min-h-0 bg-white rounded-xl border border-slate-200 overflow-hidden">

        {/* Toolbar */}
        <div className="shrink-0 px-5 py-3.5 border-b border-slate-200 flex items-center gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Link2 className="h-4 w-4 text-slate-400 shrink-0" />
            <span className="text-sm font-semibold text-slate-700">Kênh bán liên kết</span>
            {channels.length > 0 && (
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {channels.length} kênh
              </span>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {channels.length > 0 && (
              <div className="flex items-center gap-1.5 mr-2">
                <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
                  <Activity className="h-3 w-3" />
                  {runningShopee + (websiteChannel ? 1 : 0)} hoạt động
                </span>
                {autoRetrying > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 border border-blue-200 px-2 py-1 rounded-full">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {autoRetrying} đang tự đăng nhập
                  </span>
                )}
                {loginRequired > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
                    <AlertTriangle className="h-3 w-3" />
                    {loginRequired} cần đăng nhập
                  </span>
                )}
              </div>
            )}
            <button onClick={load} title="Tải lại"
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <RefreshCw className="h-4 w-4" />
            </button>
            <button onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-normal hover:bg-indigo-700 transition-colors">
              <Plus className="h-4 w-4" />
              Thêm Shopee
            </button>
          </div>
        </div>

        {/* Alert — chỉ hiển thị khi cần user can thiệp thực sự */}
        {loginRequired > 0 && (
          <div className="shrink-0 mx-5 mt-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700">
              <span className="font-medium">{loginRequired} gian hàng Shopee</span> cần đăng nhập thủ công (có thể cần nhập OTP).
              Bấm <span className="font-medium">Đăng nhập lại</span> trên từng dòng để khắc phục.
            </p>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40 gap-2 text-slate-400 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Đang tải...
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <p className="text-sm text-red-500">{error}</p>
              <button onClick={load} className="text-xs text-indigo-500 hover:underline flex items-center gap-1">
                <RefreshCw className="h-3 w-3" /> Thử lại
              </button>
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Kênh bán</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Trạng thái</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Dữ liệu</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Sync</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Link</th>
                  <th className="px-4 py-3 w-52" />
                </tr>
              </thead>
              <tbody>
                {/* Website channel luôn đứng đầu */}
                {websiteChannel && <WebsiteRow channel={websiteChannel} />}

                {/* Shopee channels */}
                {shopeeChannels.map(ch => (
                  <ShopeeRow
                    key={ch.id}
                    channel={ch}
                    onSync={handleSync}
                    onRelogin={setReloginChannel}
                    onDelete={handleDelete}
                    syncingId={syncingId}
                    deleteConfirm={deleteConfirm}
                    onDeleteConfirmChange={setDeleteConfirm}
                  />
                ))}

                {channels.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-20 text-center text-sm text-slate-400">
                      Chưa có kênh nào — đây không nên xảy ra, hãy tải lại trang.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modals */}
      {showAdd && (
        <AddChannelModal onClose={() => setShowAdd(false)} onAdded={load} />
      )}
      {reloginChannel && (
        <ReloginModal
          channel={reloginChannel}
          onClose={() => setReloginChannel(null)}
          onDone={load}
        />
      )}
    </div>
  );
}
