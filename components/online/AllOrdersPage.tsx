import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  Globe,
  Package,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingCart,
  Truck,
} from 'lucide-react';
import { adminStoreRequest } from '../../services/adminStoreApi';

// ─── Shopee ───────────────────────────────────────────────────────────────────

// Đi qua proxy backend (routes/shopeeSync.ts) — bot monitor chỉ nghe localhost
// trên server, gọi thẳng localhost:3001/3002 chỉ chạy được trên chính máy đó.
const SHOPS = [
  { id: 1, api: '/api/shopee-orders/1', label: 'Giày Dép Da Phúc Sang',      badgeClass: 'bg-indigo-50 text-indigo-700',  dotClass: 'bg-indigo-400' },
  { id: 2, api: '/api/shopee-orders/2', label: 'Phúc Sang_Đồ Da Cao Cấp 93', badgeClass: 'bg-violet-50 text-violet-700', dotClass: 'bg-violet-400' },
];

interface ShopeeOrderItemRaw {
  product_name?: string;
  product_sku?: string;
  quantity?: number;
}

interface ShopeeOrderRaw {
  order_sn?: string;
  status?: string;
  created_at?: string;
  first_delivered_at?: string | null;
  buyer_name?: string;
  buyer_phone?: string;
  product_name?: string;
  product_sku?: string;
  variation?: string;
  buyer_paid?: number;
  province?: string;
  shipping_carrier?: string;
  items?: ShopeeOrderItemRaw[];
}

const SHOPEE_STATUS_MAP: Record<string, DisplayStatus> = {
  UNPAID: 'other', PROCESSED: 'other',
  READY_TO_SHIP: 'pending', RETRY_SHIP: 'pending',
  SHIPPED: 'shipping', TO_CONFIRM_RECEIVE: 'shipping',
  COMPLETED: 'delivered', CANCELLED: 'cancelled', IN_CANCEL: 'cancelled',
  TO_RETURN: 'return',
};

function shopeeToDisplay(status: string): DisplayStatus {
  if (SHOPEE_STATUS_MAP[status]) return SHOPEE_STATUS_MAP[status];
  if (status.includes('Chờ xác nhận')) return 'waiting_confirm';
  if (status.includes('Chờ lấy hàng')) return 'pending';
  if (status.includes('Đã giao cho ĐVVC') || status.includes('Đang giao')) return 'shipping';
  if (status.includes('Đã nhận được hàng') || status.includes('Đã giao')) return 'delivered';
  if (status.includes('Trả hàng') || status.includes('Hoàn tiền') || status.includes('hoàn trả')) return 'return';
  if (status.toLowerCase().includes('hủy')) return 'cancelled';
  return 'other';
}

// ─── Website ──────────────────────────────────────────────────────────────────

const WEBSITE_STATUS_MAP: Record<string, DisplayStatus> = {
  pending: 'waiting_confirm', confirmed: 'waiting_confirm',
  packing: 'pending', ready_to_ship: 'pending',
  shipping: 'shipping', completed: 'delivered',
  cancelled: 'cancelled', return_requested: 'return', returned: 'return',
};

const WEBSITE_STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận',
  packing: 'Đang đóng gói', ready_to_ship: 'Sẵn sàng giao',
  shipping: 'Đang giao', completed: 'Hoàn thành',
  cancelled: 'Đã hủy', return_requested: 'Đang hoàn hàng', returned: 'Đã hoàn hàng',
};

// ─── Unified types ────────────────────────────────────────────────────────────

type DisplayStatus = 'waiting_confirm' | 'pending' | 'shipping' | 'delivered' | 'cancelled' | 'return' | 'other';
type FilterStatus = 'all' | DisplayStatus;
type Platform = 'shopee' | 'website';

interface UnifiedOrder {
  key: string;
  platform: Platform;
  shopLabel?: string;
  shopBadgeClass?: string;
  shopDotClass?: string;
  date_ts: number;
  order_id: string;
  customer_name: string;
  customer_phone: string;
  product_summary: string;
  sku_summary: string;
  items: { name: string; sku: string }[];
  amount: number;
  location: string;
  carrier: string;
  display_status: DisplayStatus;
  status_label: string;
}

const STATUS_META: Record<DisplayStatus, { label: string; dot: string; badge: string }> = {
  waiting_confirm: { label: 'Chờ xác nhận', dot: 'bg-orange-400', badge: 'bg-orange-50 text-orange-700' },
  pending:         { label: 'Chờ lấy hàng', dot: 'bg-amber-400',  badge: 'bg-amber-50 text-amber-700' },
  shipping:        { label: 'Đang giao',     dot: 'bg-blue-400',   badge: 'bg-blue-50 text-blue-700' },
  delivered:       { label: 'Đã giao',       dot: 'bg-emerald-400',badge: 'bg-emerald-50 text-emerald-700' },
  cancelled:       { label: 'Đã hủy',        dot: 'bg-slate-300',  badge: 'bg-slate-100 text-slate-500' },
  return:          { label: 'Hoàn hàng',     dot: 'bg-rose-400',   badge: 'bg-rose-50 text-rose-700' },
  other:           { label: 'Khác',          dot: 'bg-purple-300', badge: 'bg-purple-50 text-purple-700' },
};

const ORDER_DISPLAY_WINDOW_MS = 25 * 24 * 60 * 60 * 1000;
const RETURN_WINDOW_MS = 15 * 24 * 60 * 60 * 1000;

const formatMoney = (v: number) => (v ? `${v.toLocaleString('vi-VN')}đ` : '—');

function snToTimestamp(sn: string, fallback: string): number {
  const m = sn.match(/^(\d{2})(\d{2})(\d{2})/);
  if (m) {
    const ts = Date.parse(`20${m[1]}-${m[2]}-${m[3]}`);
    if (!isNaN(ts)) return ts;
  }
  return new Date(fallback).getTime();
}

function formatDate(ts: number) {
  const d = new Date(ts);
  return {
    time: d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    date: d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
  };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  navigationSlot?: React.ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AllOrdersPage({ navigationSlot }: Props) {
  const [shopeeOrders, setShopeeOrders] = useState<UnifiedOrder[]>([]);
  const [websiteOrders, setWebsiteOrders] = useState<UnifiedOrder[]>([]);
  const [shopeeOffline, setShopeeOffline] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');

  const loadShopee = useCallback(async () => {
    const PAGE_SIZE = 200;
    const results: UnifiedOrder[] = [];
    const offline: string[] = [];
    for (const shop of SHOPS) {
      try {
        let offset = 0;
        while (true) {
          const json = await adminStoreRequest<{ ok: boolean; data?: ShopeeOrderRaw[]; total?: number }>(
            `${shop.api}?limit=${PAGE_SIZE}&offset=${offset}`
          );
          if (!json.ok || !Array.isArray(json.data) || json.data.length === 0) break;
          for (const o of json.data) {
            const ts = snToTimestamp(o.order_sn ?? '', o.created_at ?? '');
            const now = Date.now();
            if (now - ts > ORDER_DISPLAY_WINDOW_MS) continue;
            const ds = shopeeToDisplay(o.status ?? '');
            if (ds === 'cancelled') continue;
            if (o.status === 'Đã nhận được hàng' && o.first_delivered_at) {
              if (now - new Date(o.first_delivered_at).getTime() > RETURN_WINDOW_MS) continue;
            }
            const shopeeItems = o.items ?? [];
            const itemsList = shopeeItems.length > 0
              ? shopeeItems.map((it, idx) => ({
                  name: it.product_name || '',
                  sku: idx === 0 ? [it.product_sku, o.variation].filter(Boolean).join(' · ') : (it.product_sku || ''),
                }))
              : [{ name: o.product_name ?? '', sku: [o.product_sku, o.variation].filter(Boolean).join(' · ') }];
            results.push({
              key: `shopee-${shop.id}-${o.order_sn}`,
              platform: 'shopee',
              shopLabel: shop.label,
              shopBadgeClass: shop.badgeClass,
              shopDotClass: shop.dotClass,
              date_ts: ts,
              order_id: o.order_sn ?? '',
              customer_name: o.buyer_name ?? '',
              customer_phone: o.buyer_phone ?? '',
              product_summary: itemsList.map(it => it.name).join(', '),
              sku_summary: itemsList.map(it => it.sku).filter(Boolean).join(', '),
              items: itemsList,
              amount: o.buyer_paid ?? 0,
              location: o.province ?? '',
              carrier: o.shipping_carrier ?? '',
              display_status: ds,
              status_label: STATUS_META[ds]?.label ?? o.status,
            });
          }
          if (json.data.length < PAGE_SIZE || results.length >= (json.total ?? results.length)) break;
          offset += json.data.length;
        }
      } catch {
        // monitor chưa chạy / bot offline (proxy trả 503) → đánh dấu để báo UI
        offline.push(shop.label);
      }
    }
    setShopeeOrders(results);
    setShopeeOffline(offline);
  }, []);

  const loadWebsite = useCallback(async () => {
    try {
      const result = await adminStoreRequest<{ data: WebsiteOrderRaw[] }>('/api/admin/store/orders');
      const rows = (result.data ?? []).map((o): UnifiedOrder => {
        const ds: DisplayStatus = WEBSITE_STATUS_MAP[o.status] ?? 'other';
        const addr = o.store_order_addresses?.[0];
        const shipment = o.shipments?.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
        const itemsList = (o.items ?? []).map(it => ({ name: it.productName, sku: it.sku }));
        const location = [addr?.district, addr?.province].filter(Boolean).join(', ');
        return {
          key: `website-${o.id}`,
          platform: 'website',
          date_ts: new Date(o.created_at).getTime(),
          order_id: o.order_code,
          customer_name: o.customer_name,
          customer_phone: o.customer_phone,
          product_summary: itemsList.map(it => it.name).join(', '),
          sku_summary: itemsList.map(it => it.sku).filter(Boolean).join(', '),
          items: itemsList,
          amount: o.total_amount,
          location,
          carrier: shipment?.provider ?? '',
          display_status: ds,
          status_label: WEBSITE_STATUS_LABELS[o.status] ?? o.status,
        };
      });
      setWebsiteOrders(rows);
    } catch {
      // lỗi load website
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadShopee(), loadWebsite()]);
    setLoading(false);
  }, [loadShopee, loadWebsite]);

  useEffect(() => { load(); }, [load]);

  const allOrders = useMemo(
    () => [...shopeeOrders, ...websiteOrders].sort((a, b) => b.date_ts - a.date_ts),
    [shopeeOrders, websiteOrders]
  );

  const filteredOrders = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return allOrders.filter(o => {
      if (statusFilter !== 'all' && o.display_status !== statusFilter) return false;
      if (!q) return true;
      return [o.order_id, o.customer_name, o.customer_phone, o.product_summary, o.sku_summary, o.location, o.carrier, o.shopLabel ?? '']
        .join(' ').toLowerCase().includes(q);
    });
  }, [allOrders, statusFilter, searchTerm]);

  const stats = useMemo(() => ({
    waiting: allOrders.filter(o => o.display_status === 'waiting_confirm').length,
    pending:  allOrders.filter(o => o.display_status === 'pending').length,
    shipping: allOrders.filter(o => o.display_status === 'shipping').length,
    delivered:allOrders.filter(o => o.display_status === 'delivered').length,
    cancelled:allOrders.filter(o => o.display_status === 'cancelled').length,
    returning:allOrders.filter(o => o.display_status === 'return').length,
    shopee:   shopeeOrders.length,
    website:  websiteOrders.length,
    total:    allOrders.length,
  }), [allOrders, shopeeOrders, websiteOrders]);

  useEffect(() => {
    try {
      localStorage.setItem('online_pending_count', String(stats.pending));
      window.dispatchEvent(new Event('online_pending_count_changed'));
    } catch {}
  }, [stats.pending]);

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-4 overflow-hidden bg-slate-50 px-4 pb-5 pt-10 lg:grid-cols-[280px_minmax(0,1fr)]">
      {/* Sidebar */}
      <aside className="flex h-full min-h-0 flex-col gap-4">
        {navigationSlot}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">

          {/* Header */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
              <FileText className="h-5 w-5" />
            </div>
            <h1 className="text-base font-semibold text-slate-900">Tất cả đơn hàng</h1>
            <p className="mt-1 text-sm text-slate-500">Tổng hợp từ Shopee và Website. Chỉ xem, xử lý tại từng kênh.</p>
          </div>

          {/* Nguồn dữ liệu */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <label className="text-xs font-semibold uppercase text-slate-500">Nguồn dữ liệu</label>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs text-slate-600">
                  <ShoppingCart className="h-3.5 w-3.5 text-orange-400" /> Shopee
                </span>
                <span className="text-xs font-semibold text-slate-700">{stats.shopee} đơn</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs text-slate-600">
                  <Globe className="h-3.5 w-3.5 text-indigo-400" /> Website
                </span>
                <span className="text-xs font-semibold text-slate-700">{stats.website} đơn</span>
              </div>
            </div>
            <button
              onClick={load}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              Tải lại
            </button>
          </div>

          {/* Tìm kiếm */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <label className="text-xs font-semibold uppercase text-slate-500">Tìm kiếm</label>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Mã đơn, khách hàng, sản phẩm..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-indigo-400"
              />
            </div>
          </div>

          {/* Filter trạng thái */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <label className="text-xs font-semibold uppercase text-slate-500">Trạng thái</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as FilterStatus)}
              className="mt-3 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="waiting_confirm">Chờ xác nhận</option>
              <option value="pending">Chờ lấy hàng / Chuẩn bị</option>
              <option value="shipping">Đang giao</option>
              <option value="delivered">Đã giao</option>
              <option value="cancelled">Đã hủy</option>
              <option value="return">Hoàn hàng</option>
            </select>
          </div>

          {/* Stats sidebar */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            {([
              { label: 'Chờ xác nhận', value: stats.waiting,  Icon: Clock,        filter: 'waiting_confirm' as FilterStatus },
              { label: 'Đang giao',    value: stats.shipping,  Icon: Truck,        filter: 'shipping'        as FilterStatus },
              { label: 'Đã giao',      value: stats.delivered, Icon: CheckCircle,  filter: 'delivered'       as FilterStatus },
              { label: 'Tổng đơn',     value: stats.total,     Icon: FileText,     filter: 'all'             as FilterStatus },
            ] as const).map(({ label, value, Icon, filter }) => (
              <button
                key={label}
                onClick={() => setStatusFilter(prev => prev === filter ? 'all' : filter)}
                className={`rounded-lg border p-4 text-left transition-colors ${statusFilter === filter ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
                  <Icon className="h-4 w-4 text-indigo-400" />
                </div>
                <p className="mt-3 text-xl font-semibold tabular-nums text-slate-900">{value}</p>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Main table */}
      <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">

        {/* Stat cards header */}
        <div className="border-b border-slate-200 p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {([
              { label: 'Chờ lấy hàng',   value: stats.pending,   Icon: Package,      filter: 'pending'   as FilterStatus, iconCls: 'text-amber-400',   activeCls: 'border-amber-300 bg-amber-50' },
              { label: 'Đang giao',       value: stats.shipping,  Icon: Truck,        filter: 'shipping'  as FilterStatus, iconCls: 'text-blue-400',    activeCls: 'border-blue-300 bg-blue-50' },
              { label: 'Đã giao',         value: stats.delivered, Icon: CheckCircle,  filter: 'delivered' as FilterStatus, iconCls: 'text-emerald-400', activeCls: 'border-emerald-300 bg-emerald-50' },
            ] as const).map(({ label, value, Icon, filter, iconCls, activeCls }) => (
              <button
                key={label}
                onClick={() => setStatusFilter(prev => prev === filter ? 'all' : filter)}
                className={`rounded-lg border p-3 text-left transition-colors ${statusFilter === filter ? activeCls : 'border-slate-200 bg-slate-50 hover:bg-white'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium leading-tight text-slate-500">{label}</p>
                  <Icon className={`h-4 w-4 shrink-0 ${iconCls}`} />
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-3">
            <button
              onClick={() => setStatusFilter(prev => prev === 'waiting_confirm' ? 'all' : 'waiting_confirm')}
              className={`rounded-lg border p-3 text-left transition-colors ${statusFilter === 'waiting_confirm' ? 'border-orange-300 bg-orange-50' : 'border-slate-200 bg-slate-50 hover:bg-white'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium leading-tight text-slate-500">Chờ xác nhận</p>
                <Clock className="h-4 w-4 shrink-0 text-orange-400" />
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{stats.waiting}</p>
            </button>
            <button
              onClick={() => setStatusFilter(prev => prev === 'return' ? 'all' : 'return')}
              className={`rounded-lg border p-3 text-left transition-colors ${statusFilter === 'return' ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-slate-50 hover:bg-white'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium leading-tight text-slate-500">Hoàn hàng</p>
                <RotateCcw className="h-4 w-4 shrink-0 text-rose-400" />
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{stats.returning}</p>
            </button>
            <button
              onClick={() => setStatusFilter(prev => prev === 'cancelled' ? 'all' : 'cancelled')}
              className={`rounded-lg border p-3 text-left transition-colors ${statusFilter === 'cancelled' ? 'border-slate-300 bg-slate-100' : 'border-slate-200 bg-slate-50 hover:bg-white'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium leading-tight text-slate-500">Đã hủy</p>
                <AlertCircle className="h-4 w-4 shrink-0 text-slate-400" />
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{stats.cancelled}</p>
            </button>
            <button
              onClick={() => setStatusFilter('all')}
              className={`rounded-lg border p-3 text-left transition-colors ${statusFilter === 'all' ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-slate-50 hover:bg-white'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium leading-tight text-slate-500">Tổng đơn</p>
                <FileText className="h-4 w-4 shrink-0 text-slate-400" />
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{stats.total}</p>
            </button>
          </div>
        </div>

        {/* Cảnh báo bot Shopee offline */}
        {shopeeOffline.length > 0 && (
          <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div>
              <p className="font-semibold">Không kết nối được bot Shopee — đơn Shopee tạm thời không hiển thị</p>
              <p className="mt-0.5 text-amber-700">
                Shop offline: {shopeeOffline.join(', ')}. Kiểm tra bot monitor trên iMac
                (SSH tunnel / pm2). Đơn Website vẫn hiển thị bình thường.
              </p>
            </div>
          </div>
        )}

        {/* Table header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Tất cả đơn hàng Online</h2>
            <p className="text-xs text-slate-500">{filteredOrders.length} kết quả · chỉ xem</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700">
              <ShoppingCart className="h-3 w-3" /> Shopee {stats.shopee}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
              <Globe className="h-3 w-3" /> Website {stats.website}
            </span>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex h-48 items-center justify-center text-slate-400">
            <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
            <span className="text-sm">Đang tải đơn hàng...</span>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[1080px] border-collapse text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                  <th className="px-4 py-3 text-left">Ngày đặt</th>
                  <th className="px-4 py-3 text-left">Kênh</th>
                  <th className="px-4 py-3 text-left">Mã đơn</th>
                  <th className="px-4 py-3 text-left">Khách hàng</th>
                  <th className="px-4 py-3 text-left">Sản phẩm</th>
                  <th className="px-4 py-3 text-left">Địa điểm / ĐVVC</th>
                  <th className="px-4 py-3 text-right">Thanh toán</th>
                  <th className="px-4 py-3 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center text-slate-400">
                      <FileText className="mx-auto mb-3 h-10 w-10 text-slate-200" />
                      <p className="text-sm font-semibold">Không có đơn nào</p>
                    </td>
                  </tr>
                ) : filteredOrders.map(order => {
                  const meta = STATUS_META[order.display_status];
                  const { time, date } = formatDate(order.date_ts);
                  return (
                    <tr key={order.key} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-xs">
                        <div className="font-medium text-slate-700">{time}</div>
                        <div className="text-slate-400">{date}</div>
                      </td>
                      <td className="px-4 py-3">
                        {order.platform === 'shopee' ? (
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${order.shopBadgeClass}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${order.shopDotClass}`} />
                            {order.shopLabel}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                            <Globe className="h-3 w-3" />
                            Website
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-indigo-600">
                        {order.order_id}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{order.customer_name || '—'}</p>
                        {order.customer_phone && (
                          <p className="text-xs text-slate-500">{order.customer_phone}</p>
                        )}
                      </td>
                      <td className="max-w-[220px] px-4 py-3">
                        {order.items.length > 0 ? (
                          <div className="space-y-1">
                            {order.items.map((it, idx) => (
                              <div key={idx}>
                                <p className="truncate text-slate-800" title={it.name}>{it.name || '—'}</p>
                                {it.sku && <p className="text-xs text-slate-400 truncate">{it.sku}</p>}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="truncate text-slate-800">—</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <p>{order.location || '—'}</p>
                        {order.carrier && (
                          <p className="text-xs text-slate-400">{order.carrier}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-800">
                        {formatMoney(order.amount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                          {order.status_label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Website order raw types ──────────────────────────────────────────────────

interface WebsiteOrderRaw {
  id: string;
  order_code: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  total_amount: number;
  created_at: string;
  store_order_addresses: { district: string | null; province: string | null }[];
  shipments: { provider: string | null; created_at: string }[];
  items: { productName: string; sku: string }[];
}
