import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  Package,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingBag,
  Truck,
  Wifi,
  WifiOff,
} from 'lucide-react';

const SHOPS = [
  {
    id: 1,
    label: 'Giày Dép Da Phúc Sang',
    api: 'http://localhost:3001/api/orders',
    refreshApi: 'http://localhost:3001/api/orders/refresh',
    ws: 'ws://localhost:3001/ws',
    badgeClass: 'bg-indigo-50 text-indigo-700',
    dotClass: 'bg-indigo-400',
    connDotClass: 'bg-indigo-500',
  },
  {
    id: 2,
    label: 'Phúc Sang_Đồ Da Cao Cấp 93',
    api: 'http://localhost:3002/api/orders',
    refreshApi: 'http://localhost:3002/api/orders/refresh',
    ws: 'ws://localhost:3002/ws',
    badgeClass: 'bg-violet-50 text-violet-700',
    dotClass: 'bg-violet-400',
    connDotClass: 'bg-violet-500',
  },
];

const RECONNECT_MS = 5000;
const NUM_SHOPS = SHOPS.length;

interface ShopeeOrder {
  order_sn: string;
  status: string;
  created_at: string;
  first_delivered_at: string | null;
  buyer_name: string;
  buyer_phone: string;
  product_name: string;
  product_sku: string;
  variation: string;
  quantity: number;
  buyer_paid: number;
  escrow_amount: number;
  province: string;
  shipping_carrier: string;
  order_date: string;
  paid_to_seller_at: string | null;
  return_completed_at: string | null;
  shopIdx: number;
}

type DisplayStatus = 'waiting_confirm' | 'pending' | 'shipping' | 'delivered' | 'cancelled' | 'return' | 'other';

// Thứ tự ưu tiên khi dedup: số càng cao càng "tiên tiến" hơn
const STATUS_RANK: Record<string, number> = {
  'Đã nhận được hàng': 6,
  'Đã giao': 5,
  'Đang giao': 4,
  'Đã giao cho ĐVVC': 4,
  'Đang hoàn': 3,
  'Hoàn hàng': 3,
  'Đã hủy': 2,
  'Đã hủy đơn': 2,
  'Chờ lấy hàng': 1,
  'Chờ xác nhận': 0,
};

const STATUS_MAP: Record<string, DisplayStatus> = {
  UNPAID: 'other',
  PROCESSED: 'other',
  READY_TO_SHIP: 'pending',
  RETRY_SHIP: 'pending',
  SHIPPED: 'shipping',
  TO_CONFIRM_RECEIVE: 'shipping',
  COMPLETED: 'delivered',
  CANCELLED: 'cancelled',
  IN_CANCEL: 'cancelled',
  TO_RETURN: 'return',
};

const STATUS_META: Record<DisplayStatus, { label: string; dot: string; badge: string }> = {
  waiting_confirm: { label: 'Chờ xác nhận', dot: 'bg-orange-400', badge: 'bg-orange-50 text-orange-700' },
  pending: { label: 'Chờ lấy hàng', dot: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700' },
  shipping: { label: 'Đang giao', dot: 'bg-blue-400', badge: 'bg-blue-50 text-blue-700' },
  delivered: { label: 'Đã giao', dot: 'bg-emerald-400', badge: 'bg-emerald-50 text-emerald-700' },
  cancelled: { label: 'Đã hủy', dot: 'bg-slate-300', badge: 'bg-slate-100 text-slate-500' },
  return: { label: 'Hoàn hàng', dot: 'bg-rose-400', badge: 'bg-rose-50 text-rose-700' },
  other: { label: 'Khác', dot: 'bg-purple-300', badge: 'bg-purple-50 text-purple-700' },
};

function toDisplay(shopeeStatus: string): DisplayStatus {
  // English Shopee API codes
  if (STATUS_MAP[shopeeStatus]) return STATUS_MAP[shopeeStatus];
  // Vietnamese strings từ monitor bot — "Đã giao cho ĐVVC" phải check TRƯỚC "Đã giao"
  if (shopeeStatus.includes('Chờ xác nhận')) return 'waiting_confirm';
  if (shopeeStatus.includes('Chờ lấy hàng')) return 'pending';
  if (shopeeStatus.includes('Đã giao cho ĐVVC') || shopeeStatus.includes('Đang giao')) return 'shipping';
  if (shopeeStatus.includes('Đã nhận được hàng') || shopeeStatus.includes('Đã giao')) return 'delivered';
  if (shopeeStatus.includes('Trả hàng') || shopeeStatus.includes('Hoàn tiền') || shopeeStatus.includes('hoàn trả')) return 'return';
  if (shopeeStatus.toLowerCase().includes('hủy')) return 'cancelled';
  return 'other';
}

interface Toast {
  id: string;
  orderSn: string;
  product: string;
  buyer: string;
  shopLabel: string;
  shopIdx: number;
}

const RETURN_WINDOW_MS = 15 * 24 * 60 * 60 * 1000;
const ORDER_DISPLAY_WINDOW_MS = 25 * 24 * 60 * 60 * 1000;

const formatMoney = (value: number) => (value ? `${value.toLocaleString('vi-VN')}đ` : '-');

const parseDateTime = (value: string): { time: string; date: string } | null => {
  if (!value) return null;
  // Shopee format: "HH:mm:ss DD/M/YYYY"
  const shopeeMatch = value.match(/^(\d{2}:\d{2}):\d{2}\s+(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (shopeeMatch) {
    const [, time, day, month, year] = shopeeMatch;
    return { time, date: `${day.padStart(2,'0')}/${month.padStart(2,'0')}/${year}` };
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return {
    time: d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    date: d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
  };
};

type ConnState = 'connecting' | 'connected' | 'session_expired' | 'disconnected';
type FilterStatus = 'all' | DisplayStatus;

interface Props {
  navigationSlot?: React.ReactNode;
}

export default function ShippingOrders({ navigationSlot }: Props) {
  // Per-shop orders
  const [ordersByShop, setOrdersByShop] = useState<ShopeeOrder[][]>(
    () => Array.from({ length: NUM_SHOPS }, () => [])
  );
  // Per-shop connection state
  const [connStates, setConnStates] = useState<ConnState[]>(
    () => Array(NUM_SHOPS).fill('connecting') as ConnState[]
  );
  // Per-shop loading flag
  const [loadings, setLoadings] = useState<boolean[]>(
    () => Array(NUM_SHOPS).fill(true)
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Refs cho mỗi shop
  const wsRefs = useRef<(WebSocket | null)[]>(Array(NUM_SHOPS).fill(null));
  const reconnectRefs = useRef<(ReturnType<typeof setTimeout> | null)[]>(Array(NUM_SHOPS).fill(null));

  const addToast = useCallback(
    (order: Partial<ShopeeOrder> & { orderSn?: string }, shopIdx: number) => {
      const shop = SHOPS[shopIdx];
      const toast: Toast = {
        id: crypto.randomUUID(),
        orderSn: order.order_sn ?? order.orderSn ?? '',
        product: order.product_name ?? '',
        buyer: order.buyer_name ?? '',
        shopLabel: shop.label,
        shopIdx,
      };
      setToasts(prev => [toast, ...prev].slice(0, 5));
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== toast.id)), 6000);
    },
    []
  );

  const fetchOrders = useCallback(async (shopIdx: number) => {
    const shop = SHOPS[shopIdx];
    const PAGE_SIZE = 200;
    try {
      const allData: Omit<ShopeeOrder, 'shopIdx'>[] = [];
      let offset = 0;

      while (true) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`${shop.api}?limit=${PAGE_SIZE}&offset=${offset}`, { signal: controller.signal });
        clearTimeout(timeout);
        const json = await res.json();
        if (!json.ok || !Array.isArray(json.data) || json.data.length === 0) break;
        allData.push(...json.data);
        // Nếu trang trả về ít hơn PAGE_SIZE hoặc đã lấy đủ total → dừng
        if (json.data.length < PAGE_SIZE || allData.length >= (json.total ?? allData.length)) break;
        offset += json.data.length;
      }

      if (allData.length > 0) {
        const withShop: ShopeeOrder[] = allData.map((o: Omit<ShopeeOrder, 'shopIdx'>) => ({
          ...o,
          shopIdx,
        }));
        setOrdersByShop(prev => {
          const next = [...prev];
          next[shopIdx] = withShop;
          return next;
        });
      }
    } catch {
      // monitor chưa chạy hoặc timeout
    } finally {
      setLoadings(prev => {
        const next = [...prev];
        next[shopIdx] = false;
        return next;
      });
    }
  }, []);

  const connect = useCallback(
    (shopIdx: number) => {
      const currentWs = wsRefs.current[shopIdx];
      if (
        currentWs &&
        (currentWs.readyState === WebSocket.OPEN ||
          currentWs.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }

      const shop = SHOPS[shopIdx];

      setConnStates(prev => {
        const next = [...prev];
        next[shopIdx] = 'connecting';
        return next;
      });

      const ws = new WebSocket(shop.ws);
      wsRefs.current[shopIdx] = ws;

      ws.onopen = () => {
        if (reconnectRefs.current[shopIdx]) clearTimeout(reconnectRefs.current[shopIdx]!);
        // Trạng thái sẽ được set khi nhận message CONNECTED (có sessionExpired)
      };

      ws.onmessage = evt => {
        try {
          const msg = JSON.parse(evt.data as string);

          if (msg.type === 'CONNECTED') {
            setConnStates(prev => {
              const next = [...prev];
              next[shopIdx] = msg.sessionExpired ? 'session_expired' : 'connected';
              return next;
            });
            // Bot vừa khởi động — fetch lại để có đơn mới nhất
            fetchOrders(shopIdx);
          }

          if (msg.type === 'LOGIN_EXPIRED') {
            setConnStates(prev => {
              const next = [...prev];
              next[shopIdx] = 'session_expired';
              return next;
            });
          }

          if (msg.type === 'LOGIN_SUCCESS') {
            setConnStates(prev => {
              const next = [...prev];
              next[shopIdx] = 'connected';
              return next;
            });
          }

          if (msg.type === 'NEW_ORDER') {
            setOrdersByShop(prev => {
              const shopOrders = prev[shopIdx];
              if (shopOrders.some(o => o.order_sn === msg.orderSn)) return prev;
              const newOrder: ShopeeOrder = {
                order_sn: msg.orderSn ?? '',
                status: msg.status ?? 'Chờ xác nhận',
                created_at: msg.createdAt ?? new Date().toISOString(),
                buyer_name: msg.buyerName ?? '',
                buyer_phone: msg.buyerPhone ?? '',
                product_name: msg.productName ?? '',
                product_sku: msg.productSku ?? '',
                variation: msg.variation ?? '',
                quantity: msg.quantity ?? 1,
                buyer_paid: msg.buyerPaid ?? 0,
                escrow_amount: msg.escrowAmount ?? 0,
                province: msg.province ?? '',
                shipping_carrier: msg.shippingCarrier ?? '',
                order_date: '',
                first_delivered_at: null,
                paid_to_seller_at: null,
                return_completed_at: null,
                shopIdx,
              };
              const next = [...prev];
              next[shopIdx] = [newOrder, ...shopOrders];
              return next;
            });
            addToast(
              {
                order_sn: msg.orderSn,
                product_name: msg.productName,
                buyer_name: msg.buyerName,
              },
              shopIdx
            );
          }

          if (
            ['ORDER_READY', 'ORDER_CANCELLED', 'ORDER_DELIVERED', 'ORDER_RETURN_REQUEST'].includes(
              msg.type
            )
          ) {
            const statusMap: Record<string, string> = {
              ORDER_READY: 'READY_TO_SHIP',
              ORDER_CANCELLED: 'CANCELLED',
              ORDER_DELIVERED: 'COMPLETED',
              ORDER_RETURN_REQUEST: 'TO_RETURN',
            };
            const newStatus = statusMap[msg.type];
            if (newStatus) {
              setOrdersByShop(prev => {
                const next = [...prev];
                next[shopIdx] = prev[shopIdx].map(o =>
                  o.order_sn === msg.orderSn ? { ...o, status: newStatus } : o
                );
                return next;
              });
            }
          }
        } catch {
          // bỏ qua message lỗi
        }
      };

      ws.onclose = () => {
        setConnStates(prev => {
          const next = [...prev];
          next[shopIdx] = 'disconnected';
          return next;
        });
        reconnectRefs.current[shopIdx] = setTimeout(() => connect(shopIdx), RECONNECT_MS);
      };

      ws.onerror = () => {
        ws.close();
      };
    },
    [addToast]
  );

  // Kết nối tất cả shop khi mount
  useEffect(() => {
    for (let i = 0; i < NUM_SHOPS; i++) {
      fetchOrders(i);
      connect(i);
    }
    return () => {
      for (let i = 0; i < NUM_SHOPS; i++) {
        const ws = wsRefs.current[i];
        if (ws) {
          ws.onopen = null;
          ws.onmessage = null;
          ws.onclose = null;
          ws.onerror = null;
          ws.close();
          wsRefs.current[i] = null;
        }
        if (reconnectRefs.current[i]) {
          clearTimeout(reconnectRefs.current[i]!);
          reconnectRefs.current[i] = null;
        }
      }
    };
  }, [fetchOrders, connect]);

  // Tất cả đơn raw (dùng để tính stats)
  // Dedup theo order_sn — giữ bản có status tiên tiến nhất (tránh đơn trùng do bot nhầm shop)
  const rawOrders = useMemo(() => {
    const all = ordersByShop.flat();
    const map = new Map<string, ShopeeOrder>();
    for (const o of all) {
      const existing = map.get(o.order_sn);
      if (!existing || (STATUS_RANK[o.status] ?? -1) > (STATUS_RANK[existing.status] ?? -1)) {
        map.set(o.order_sn, o);
      }
    }
    return Array.from(map.values());
  }, [ordersByShop]);

  // Parse ngày thực từ 6 ký tự đầu order_sn: YYMMDD → timestamp
  // Fallback về created_at nếu không parse được
  const snToTimestamp = (sn: string, createdAt: string): number => {
    const m = sn.match(/^(\d{2})(\d{2})(\d{2})/);
    if (m) {
      const ts = Date.parse(`20${m[1]}-${m[2]}-${m[3]}`);
      if (!isNaN(ts)) return ts;
    }
    return new Date(createdAt).getTime();
  };

  // Trang vận đơn = chỉ đơn "tiền chưa về ví người bán"
  // Ẩn: đã hủy | "Đã nhận được hàng" qua 15 ngày cửa sổ hoàn | hoàn hàng đã hoàn tất
  const allOrders = useMemo(() => {
    const now = Date.now();
    return rawOrders
      .filter(o => {
        // Chỉ hiện đơn trong 25 ngày gần nhất (3-4 ngày ship + 15 ngày hoàn hàng + buffer)
        const orderTs = snToTimestamp(o.order_sn, o.created_at);
        if (now - orderTs > ORDER_DISPLAY_WINDOW_MS) return false;

        const display = toDisplay(o.status);
        if (display === 'cancelled') return false;
        // "Đã nhận được hàng": ẩn nếu đã qua 15 ngày kể từ khi giao
        if (o.status === 'Đã nhận được hàng') {
          if (!o.first_delivered_at) return true;
          return now - new Date(o.first_delivered_at).getTime() <= RETURN_WINDOW_MS;
        }
        if (display === 'return' && o.return_completed_at) return false;
        return true;
      })
      .sort((a, b) => snToTimestamp(b.order_sn, b.created_at) - snToTimestamp(a.order_sn, a.created_at));
  }, [rawOrders]);

  const filteredOrders = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return allOrders
      .filter(order => {
        if (statusFilter === 'all') return true;
        return toDisplay(order.status) === statusFilter;
      })
      .filter(order => {
        if (!q) return true;
        return [
          order.order_sn,
          order.buyer_name,
          order.buyer_phone,
          order.product_name,
          order.product_sku,
          order.province,
          order.shipping_carrier,
          SHOPS[order.shopIdx]?.label ?? '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(q);
      });
  }, [allOrders, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    const returnOrders = rawOrders.filter(o => toDisplay(o.status) === 'return');
    return {
      pending:          allOrders.filter(o => toDisplay(o.status) === 'pending').length,
      shipping:         allOrders.filter(o => toDisplay(o.status) === 'shipping').length,
      delivered:        allOrders.filter(o => toDisplay(o.status) === 'delivered').length,
      cancelled:        rawOrders.filter(o => toDisplay(o.status) === 'cancelled').length,
      returning:        returnOrders.filter(o => !o.return_completed_at).length,
      refundTotal:      returnOrders.length,
      refundCompleted:  returnOrders.filter(o => !!o.return_completed_at).length,
      total:            allOrders.length,
    };
  }, [allOrders, rawOrders]);

  const isAllLoading = loadings.every(Boolean);
  const isAllDisconnected = connStates.every(s => s === 'disconnected');

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-4 overflow-hidden bg-slate-50 px-4 pb-5 pt-10 lg:grid-cols-[280px_minmax(0,1fr)]">
      {/* Toast notifications */}
      <div className="fixed bottom-6 right-6 z-modal flex pointer-events-none flex-col gap-2">
        {toasts.map(toast => {
          const shop = SHOPS[toast.shopIdx];
          return (
            <div
              key={toast.id}
              className="pointer-events-auto flex items-start gap-3 rounded-lg border border-emerald-200 bg-white px-4 py-3 shadow-lg"
            >
              <ShoppingBag className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Đơn mới —{' '}
                  <span className={`rounded px-1.5 py-0.5 text-xs ${shop.badgeClass}`}>
                    {toast.shopLabel}
                  </span>
                </p>
                <p className="text-xs text-slate-500">
                  {toast.orderSn} · {toast.buyer || 'Khách'}
                </p>
                {toast.product && (
                  <p className="mt-0.5 max-w-[220px] truncate text-xs text-slate-400">
                    {toast.product}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sidebar */}
      <aside className="flex h-full min-h-0 flex-col gap-4">
        {navigationSlot}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">

          {/* Header */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <FileText className="h-5 w-5" />
            </div>
            <h1 className="text-base font-semibold text-slate-900">Vận đơn Shopee</h1>
            <p className="mt-1 text-sm text-slate-500">
              Theo dõi đơn hàng cập nhật từ Shopee Monitor.
            </p>
          </div>

          {/* Kết nối — per shop */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <label className="text-xs font-semibold uppercase text-slate-500">Kết nối Monitor</label>
            <div className="mt-3 space-y-2">
              {SHOPS.map((shop, idx) => {
                const state = connStates[idx];
                const dotColor =
                  state === 'connected'
                    ? shop.connDotClass
                    : state === 'session_expired'
                    ? 'bg-amber-400'
                    : state === 'connecting'
                    ? 'bg-amber-400'
                    : 'bg-rose-400';
                const stateLabel =
                  state === 'connected'
                    ? 'Đã kết nối'
                    : state === 'session_expired'
                    ? 'Session hết hạn'
                    : state === 'connecting'
                    ? 'Đang kết nối...'
                    : 'Mất kết nối';
                return (
                  <div key={shop.id} className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${dotColor} ${state === 'connecting' ? 'animate-pulse' : ''}`}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-700">{shop.label}</p>
                        <p className="text-xs text-slate-400">{stateLabel}</p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        // Trigger bot quét đơn ngay, sau 3 giây fetch lại
                        try {
                          await fetch(shop.refreshApi, { method: 'POST' });
                        } catch {
                          // bot chưa chạy → chỉ fetchOrders thông thường
                        }
                        setTimeout(() => fetchOrders(idx), 3000);
                        if (wsRefs.current[idx]) wsRefs.current[idx]!.close();
                      }}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100"
                      title={`Quét đơn ngay — ${shop.label}`}
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${state === 'connecting' ? 'animate-spin' : ''}`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tìm kiếm */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <label className="text-xs font-semibold uppercase text-slate-500">Tìm kiếm</label>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Mã đơn, người mua, sản phẩm..."
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-indigo-400"
              />
            </div>
          </div>

          {/* Filter trạng thái */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <label className="text-xs font-semibold uppercase text-slate-500">Trạng thái</label>
            <select
              value={statusFilter}
              onChange={event => setStatusFilter(event.target.value as FilterStatus)}
              className="mt-3 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="pending">Chờ lấy hàng</option>
              <option value="shipping">Đang giao</option>
              <option value="delivered">Đã giao</option>
              <option value="cancelled">Đã hủy</option>
              <option value="return">Hoàn hàng</option>
              <option value="other">Khác</option>
            </select>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            {[
              { label: 'Chờ lấy hàng', value: stats.pending, Icon: Package, filter: 'pending' as FilterStatus },
              { label: 'Đang giao', value: stats.shipping, Icon: Truck, filter: 'shipping' as FilterStatus },
              { label: 'Đã giao', value: stats.delivered, Icon: CheckCircle, filter: 'delivered' as FilterStatus },
              { label: 'Tổng đơn', value: stats.total, Icon: FileText, filter: 'all' as FilterStatus },
            ].map(({ label, value, Icon, filter }) => (
              <button
                key={label}
                onClick={() => setStatusFilter(prev => (prev === filter ? 'all' : filter))}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  statusFilter === filter
                    ? 'border-indigo-300 bg-indigo-50'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
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

        {/* Stat cards — hàng 1: 3 ô | hàng 2: Huỷ + Trả hàng + Hoàn tiền + Tổng */}
        <div className="border-b border-slate-200 p-4 space-y-3">
          {/* Hàng 1 */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Chờ lấy hàng', value: stats.pending, Icon: Package, filter: 'pending' as FilterStatus, iconCls: 'text-amber-400', activeCls: 'border-amber-300 bg-amber-50' },
              { label: 'Đang giao',    value: stats.shipping, Icon: Truck,   filter: 'shipping' as FilterStatus, iconCls: 'text-blue-400',  activeCls: 'border-blue-300 bg-blue-50' },
              { label: 'Đã giao',      value: stats.delivered, Icon: CheckCircle, filter: 'delivered' as FilterStatus, iconCls: 'text-emerald-400', activeCls: 'border-emerald-300 bg-emerald-50' },
            ].map(({ label, value, Icon, filter, iconCls, activeCls }) => (
              <button
                key={label}
                onClick={() => setStatusFilter(prev => (prev === filter ? 'all' : filter))}
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

          {/* Hàng 2 */}
          <div className="grid grid-cols-4 gap-3">
            {/* Huỷ — chỉ hiện số, không hiện trong danh sách */}
            <button
              onClick={() => setStatusFilter(prev => (prev === 'cancelled' ? 'all' : 'cancelled'))}
              className={`rounded-lg border p-3 text-left transition-colors ${statusFilter === 'cancelled' ? 'border-slate-300 bg-slate-100' : 'border-slate-200 bg-slate-50 hover:bg-white'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium leading-tight text-slate-500">Huỷ</p>
                <AlertCircle className="h-4 w-4 shrink-0 text-slate-400" />
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{stats.cancelled}</p>
            </button>

            {/* Trả hàng — đơn đang chờ hàng về */}
            <button
              onClick={() => setStatusFilter(prev => (prev === 'return' ? 'all' : 'return'))}
              className={`rounded-lg border p-3 text-left transition-colors ${statusFilter === 'return' ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-slate-50 hover:bg-white'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium leading-tight text-slate-500">Trả hàng</p>
                <RotateCcw className="h-4 w-4 shrink-0 text-rose-400" />
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
                {stats.refundCompleted}
                <span className="text-sm font-normal text-slate-400">/{stats.refundTotal}</span>
              </p>
            </button>

            {/* Hoàn tiền — hiện dạng đã hoàn / tổng */}
            <button
              onClick={() => setStatusFilter(prev => (prev === 'return' ? 'all' : 'return'))}
              className={`rounded-lg border p-3 text-left transition-colors ${statusFilter === 'return' ? 'border-orange-300 bg-orange-50' : 'border-slate-200 bg-slate-50 hover:bg-white'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium leading-tight text-slate-500">Hoàn tiền</p>
                <AlertCircle className="h-4 w-4 shrink-0 text-orange-400" />
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
                {stats.refundCompleted}
                <span className="text-sm font-normal text-slate-400">/{stats.refundTotal}</span>
              </p>
            </button>

            {/* Tổng đơn */}
            <button
              onClick={() => setStatusFilter(prev => (prev === 'all' ? 'all' : 'all'))}
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

        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Danh sách vận đơn — Tất cả gian hàng
            </h2>
            <p className="text-xs text-slate-500">{filteredOrders.length} kết quả</p>
          </div>
          {/* Pill hiển thị trạng thái kết nối tổng quan */}
          <div className="flex items-center gap-2">
            {SHOPS.map((shop, idx) => {
              const state = connStates[idx];
              return state === 'connected' ? (
                <span
                  key={shop.id}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700"
                >
                  <Wifi className="h-3 w-3" />
                  {shop.label}
                </span>
              ) : state === 'connecting' ? (
                <span
                  key={shop.id}
                  className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700"
                >
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  {shop.label}
                </span>
              ) : (
                <span
                  key={shop.id}
                  className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700"
                >
                  <WifiOff className="h-3 w-3" />
                  {shop.label}
                </span>
              );
            })}
          </div>
        </div>

        {isAllLoading ? (
          <div className="flex h-48 items-center justify-center text-slate-400">
            <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
            <span className="text-sm">Đang tải đơn hàng...</span>
          </div>
        ) : isAllDisconnected && allOrders.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-3 text-slate-400">
            <AlertCircle className="h-10 w-10 text-slate-300" />
            <p className="text-sm font-semibold text-slate-500">
              Không kết nối được với Shopee Monitor
            </p>
            <p className="text-xs text-slate-400">Kiểm tra PM2: pm2 status</p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[1080px] border-collapse text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                  <th className="px-4 py-3 text-left">Ngày đặt</th>
                  <th className="px-4 py-3 text-left">Shop</th>
                  <th className="px-4 py-3 text-left">Mã đơn</th>
                  <th className="px-4 py-3 text-left">Người mua</th>
                  <th className="px-4 py-3 text-left">Sản phẩm</th>
                  <th className="px-4 py-3 text-left">Tỉnh / ĐVVC</th>
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
                ) : (
                  filteredOrders.map(order => {
                    const ds = toDisplay(order.status);
                    const meta = STATUS_META[ds];
                    const shop = SHOPS[order.shopIdx];
                    return (
                      <tr key={`${order.shopIdx}-${order.order_sn}`} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-xs">
                          {(() => {
                            const dt = order.order_date ? parseDateTime(order.order_date) : null;
                            if (dt) return (
                              <>
                                <div className="font-medium text-slate-700">{dt.time}</div>
                                <div className="text-slate-400">{dt.date}</div>
                              </>
                            );
                            const m = order.order_sn.match(/^(\d{2})(\d{2})(\d{2})/);
                            if (m) return <div className="text-slate-500">{`${m[3]}/${m[2]}/20${m[1]}`}</div>;
                            const fb = parseDateTime(order.created_at);
                            if (fb) return (
                              <>
                                <div className="font-medium text-slate-700">{fb.time}</div>
                                <div className="text-slate-400">{fb.date}</div>
                              </>
                            );
                            return <span className="text-slate-400">-</span>;
                          })()}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${shop.badgeClass}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${shop.dotClass}`} />
                            {shop.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-indigo-600">
                          {order.order_sn}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{order.buyer_name || '-'}</p>
                          {order.buyer_phone && (
                            <p className="text-xs text-slate-500">{order.buyer_phone}</p>
                          )}
                          {order.quantity > 1 && (
                            <p className="text-xs text-slate-400">x{order.quantity}</p>
                          )}
                        </td>
                        <td className="max-w-[240px] px-4 py-3">
                          <p className="truncate text-slate-800">{order.product_name || '-'}</p>
                          {order.product_sku && (
                            <p className="text-xs text-slate-400">
                              {order.product_sku}
                              {order.variation ? ` - ${order.variation}` : ''}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          <p>{order.province || '-'}</p>
                          {order.shipping_carrier && (
                            <p className="text-xs text-slate-400">{order.shipping_carrier}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-800">
                          {formatMoney(order.buyer_paid)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.badge}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                              {meta.label}
                            </span>
                            {order.paid_to_seller_at && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-2xs font-semibold text-emerald-700">
                                💳 Đã thanh toán
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
