import React, { useState, useEffect, useCallback } from 'react';
import { ShoppingBag, RefreshCw, Search, ChevronDown, ChevronUp, Phone, MapPin, Package, Truck } from 'lucide-react';
import { adminStoreRequest } from '../../services/adminStoreApi';
import { useToast } from '../ui/Toast';

interface OrderAddress {
  address_line: string | null;
  ward: string | null;
  district: string | null;
  province: string | null;
}

// Khớp đúng field do RPC create_store_order ghi vào pos_orders.items (JSONB) — không phải bảng riêng
interface OrderItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  price: number;
  subtotal: number;
}

interface Shipment {
  id: string;
  provider: string | null;
  tracking_code: string | null;
  shipping_fee: number | null;
  cod_amount: number | null;
  status: string | null;
  shipped_at: string | null;
  created_at: string;
}

interface ShipmentDraft {
  provider: string;
  trackingCode: string;
  shippingFee: string;
  codAmount: string;
  status: string;
}

interface WebsiteOrder {
  id: string;
  order_code: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  payment_method: string;
  status: string;
  note: string | null;
  total_amount: number;
  created_at: string;
  store_order_addresses: OrderAddress[];
  shipments: Shipment[];
  items: OrderItem[];
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Chờ xác nhận', color: 'bg-yellow-100 text-yellow-700' },
  confirmed: { label: 'Đã xác nhận', color: 'bg-blue-100 text-blue-700' },
  packing: { label: 'Đang đóng gói', color: 'bg-indigo-100 text-indigo-700' },
  ready_to_ship: { label: 'Sẵn sàng giao', color: 'bg-cyan-100 text-cyan-700' },
  shipping: { label: 'Đang giao', color: 'bg-purple-100 text-purple-700' },
  completed: { label: 'Hoàn thành', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Đã hủy', color: 'bg-red-100 text-red-700' },
  return_requested: { label: 'Đang hoàn hàng', color: 'bg-orange-100 text-orange-700' },
  returned: { label: 'Đã hoàn hàng', color: 'bg-slate-200 text-slate-600' },
};

const STATUS_ORDER: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['packing', 'cancelled'],
  packing: ['ready_to_ship', 'cancelled'],
  ready_to_ship: ['shipping', 'cancelled'],
  // Đã giao ĐVVC — không huỷ trực tiếp nữa, chỉ có thể yêu cầu hoàn hàng (chưa cộng tồn, chờ hàng về)
  shipping: ['completed', 'return_requested'],
  completed: ['return_requested'],
  // Nhân viên xác nhận đã nhận lại hàng hoàn về kho — lúc này mới cộng tồn
  return_requested: ['returned'],
  returned: [],
  cancelled: [],
};

const PAYMENT_LABELS: Record<string, string> = {
  cod: 'COD',
  bank: 'Chuyển khoản',
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatVND(n: number) {
  return n.toLocaleString('vi-VN') + 'đ';
}

function shipmentDraft(shipment?: Shipment): ShipmentDraft {
  return {
    provider: shipment?.provider || 'SPX',
    trackingCode: shipment?.tracking_code || '',
    shippingFee: String(shipment?.shipping_fee ?? 0),
    codAmount: String(shipment?.cod_amount ?? 0),
    status: shipment?.status || 'ready_to_ship',
  };
}

interface Props {
  navigationSlot?: React.ReactNode;
}

export default function WebsiteOrdersPage({ navigationSlot }: Props) {
  const { showToast } = useToast();
  const [orders, setOrders] = useState<WebsiteOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [shipmentDrafts, setShipmentDrafts] = useState<Record<string, ShipmentDraft>>({});

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminStoreRequest<{ data: WebsiteOrder[] }>('/api/admin/store/orders');
      setOrders((result.data ?? []).filter(order => !statusFilter || order.status === statusFilter));
    } catch {
      showToast('Lỗi tải đơn hàng website', 'error');
    }
    setLoading(false);
  }, [showToast, statusFilter]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const getLatestShipment = (order: WebsiteOrder) =>
    [...(order.shipments ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

  const getDraft = (order: WebsiteOrder) => shipmentDrafts[order.id] ?? shipmentDraft(getLatestShipment(order));

  const updateShipmentDraft = (order: WebsiteOrder, patch: Partial<ShipmentDraft>) => {
    setShipmentDrafts(prev => ({
      ...prev,
      [order.id]: { ...(prev[order.id] ?? shipmentDraft(getLatestShipment(order))), ...patch },
    }));
  };

  const validateShipmentDraft = (draft: ShipmentDraft, requireTrackingCode: boolean) => {
    if (!draft.provider.trim()) return 'Thiếu đơn vị vận chuyển';
    if (requireTrackingCode && !draft.trackingCode.trim()) return 'Cần nhập mã vận đơn trước khi chuyển sang Đang giao';
    const shippingFee = Number(draft.shippingFee || 0);
    const codAmount = Number(draft.codAmount || 0);
    if (!Number.isFinite(shippingFee) || shippingFee < 0) return 'Phí vận chuyển không hợp lệ';
    if (!Number.isFinite(codAmount) || codAmount < 0) return 'Tiền COD không hợp lệ';
    return null;
  };

  const toShipmentPayload = (draft: ShipmentDraft) => ({
    provider: draft.provider.trim() || 'SPX',
    tracking_code: draft.trackingCode.trim() || null,
    shipping_fee: Number(draft.shippingFee || 0),
    cod_amount: Number(draft.codAmount || 0),
    status: draft.status.trim() || 'ready_to_ship',
  });

  const saveShipment = async (order: WebsiteOrder) => {
    const draft = getDraft(order);
    const validationError = validateShipmentDraft(draft, order.status === 'shipping');
    if (validationError) return showToast(validationError, 'error');

    setUpdatingId(order.id);
    try {
      await adminStoreRequest(`/api/admin/store/orders/${order.id}/shipment`, { method: 'PUT', body: JSON.stringify(toShipmentPayload(draft)) });
      showToast('Đã lưu vận đơn SPX', 'success');
      await loadOrders();
    } catch (error) { showToast(`Lỗi lưu vận đơn: ${error instanceof Error ? error.message : String(error)}`, 'error'); }
    setUpdatingId(null);
  };

  const updateStatus = async (order: WebsiteOrder, newStatus: string) => {
    const draft = getDraft(order);
    if (newStatus === 'shipping') {
      const validationError = validateShipmentDraft(draft, true);
      if (validationError) return showToast(validationError, 'error');
    }
    setUpdatingId(order.id);
    // RPC atomic: đổi status + tự cộng lại tồn kho nếu chuyển sang cancelled/returned
    try {
      const data = await adminStoreRequest<{ restocked?: boolean }>(`/api/admin/store/orders/${order.id}/status`, {
        method: 'POST', body: JSON.stringify({ status: newStatus, shipment: newStatus === 'shipping' ? toShipmentPayload({ ...draft, status: 'shipping' }) : null }),
      });
      showToast(
        data?.restocked
          ? `Đã chuyển sang "${STATUS_LABELS[newStatus]?.label}" — đã cộng lại tồn kho`
          : `Đã chuyển sang "${STATUS_LABELS[newStatus]?.label}"`,
        'success'
      );
      await loadOrders();
    } catch (error) { showToast(`Lỗi cập nhật trạng thái: ${error instanceof Error ? error.message : String(error)}`, 'error'); }
    setUpdatingId(null);
  };

  const filtered = orders.filter(o => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.order_code.toLowerCase().includes(q) ||
      o.customer_name.toLowerCase().includes(q) ||
      o.customer_phone.includes(q)
    );
  });

  const pendingCount = orders.filter(o => o.status === 'pending').length;

  return (
    <div className="grid h-full min-h-0 grid-cols-[280px_minmax(0,1fr)] gap-4 overflow-hidden bg-slate-50 px-4 pb-5 pt-10">
      {/* Sidebar */}
      <aside className="flex h-full min-h-0 flex-col gap-4">
        {navigationSlot}
      </aside>

      {/* Main */}
      <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Đơn hàng website</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {orders.length} đơn
            {pendingCount > 0 && (
              <span className="ml-2 bg-yellow-100 text-yellow-700 text-xs font-medium px-2 py-0.5 rounded-full">
                {pendingCount} chờ xác nhận
              </span>
            )}
          </p>
        </div>
        <button
          onClick={loadOrders}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Filters */}
      <div className="shrink-0 px-6 py-3 bg-white border-b border-slate-100 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm mã đơn, tên, SĐT..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-700"
        >
          <option value="">Tất cả trạng thái</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto px-6 py-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Đang tải...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400">
            <ShoppingBag size={32} className="mb-2 opacity-40" />
            <p className="text-sm">{search || statusFilter ? 'Không tìm thấy đơn hàng phù hợp' : 'Chưa có đơn hàng từ website'}</p>
          </div>
        ) : (
          filtered.map(order => {
            const isExpanded = expandedId === order.id;
            const statusInfo = STATUS_LABELS[order.status] ?? { label: order.status, color: 'bg-slate-100 text-slate-600' };
            const nextStatuses = STATUS_ORDER[order.status] ?? [];
            const addr = order.store_order_addresses?.[0];
            const latestShipment = getLatestShipment(order);
            const draft = getDraft(order);

            return (
              <div key={order.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Order header row */}
                <button
                  className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-semibold text-slate-800">{order.order_code}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                      <span className="text-xs text-slate-400">{PAYMENT_LABELS[order.payment_method] ?? order.payment_method}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-600">
                      <span className="font-medium">{order.customer_name}</span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <Phone size={12} />
                        {order.customer_phone}
                      </span>
                      {latestShipment && (
                        <span className="flex items-center gap-1 text-slate-400">
                          <Truck size={12} />
                          {latestShipment.provider || 'SPX'}
                          {latestShipment.tracking_code ? ` · ${latestShipment.tracking_code}` : ''}
                          {latestShipment.status ? ` · ${latestShipment.status}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-slate-800">{formatVND(order.total_amount)}</p>
                    <p className="text-xs text-slate-400">{formatDate(order.created_at)}</p>
                  </div>
                  {isExpanded ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-slate-100 px-5 py-4 space-y-4">
                    {/* Address */}
                    {addr && (
                      <div className="flex items-start gap-2 text-sm text-slate-600">
                        <MapPin size={14} className="text-slate-400 mt-0.5 shrink-0" />
                        <span>
                          {[addr.address_line, addr.ward, addr.district, addr.province]
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                      </div>
                    )}

                    {/* Note */}
                    {order.note && (
                      <p className="text-sm text-slate-500 italic">Ghi chú: {order.note}</p>
                    )}

                    {/* Items */}
                    {order.items?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
                          <Package size={12} />
                          Sản phẩm ({order.items.length} dòng)
                        </p>
                        <div className="border border-slate-100 rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">SKU</th>
                                <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Tên</th>
                                <th className="text-center px-3 py-2 text-xs font-medium text-slate-500">SL</th>
                                <th className="text-right px-3 py-2 text-xs font-medium text-slate-500">Đơn giá</th>
                                <th className="text-right px-3 py-2 text-xs font-medium text-slate-500">Thành tiền</th>
                              </tr>
                            </thead>
                            <tbody>
                              {order.items.map((item, i) => (
                                <tr key={i} className="border-b border-slate-50 last:border-0">
                                  <td className="px-3 py-2 text-xs text-slate-600">{item.sku}</td>
                                  <td className="px-3 py-2 text-slate-700">{item.productName}</td>
                                  <td className="px-3 py-2 text-center text-slate-600">{item.quantity}</td>
                                  <td className="px-3 py-2 text-right text-slate-600">{formatVND(item.price)}</td>
                                  <td className="px-3 py-2 text-right font-medium text-slate-800">{formatVND(item.subtotal)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* SPX shipment */}
                    <div className="border border-cyan-100 rounded-lg bg-cyan-50/40 p-4">
                      <p className="text-xs font-semibold text-cyan-800 mb-3 flex items-center gap-1.5">
                        <Truck size={14} /> Vận đơn
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        <label className="text-xs text-slate-500">
                          Đơn vị giao
                          <input
                            value={draft.provider}
                            onChange={e => updateShipmentDraft(order, { provider: e.target.value })}
                            placeholder="SPX"
                            className="mt-1 w-full px-2.5 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                          />
                        </label>
                        <label className="text-xs text-slate-500">
                          Mã vận đơn{nextStatuses.includes('shipping') ? <span className="text-red-500"> *</span> : ''}
                          <input
                            value={draft.trackingCode}
                            onChange={e => updateShipmentDraft(order, { trackingCode: e.target.value })}
                            placeholder="Mã SPX"
                            className="mt-1 w-full px-2.5 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                          />
                        </label>
                        <label className="text-xs text-slate-500">
                          Phí giao hàng
                          <input
                            type="number"
                            min="0"
                            value={draft.shippingFee}
                            onChange={e => updateShipmentDraft(order, { shippingFee: e.target.value })}
                            className="mt-1 w-full px-2.5 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                          />
                        </label>
                        <label className="text-xs text-slate-500">
                          Tiền COD
                          <input
                            type="number"
                            min="0"
                            value={draft.codAmount}
                            onChange={e => updateShipmentDraft(order, { codAmount: e.target.value })}
                            className="mt-1 w-full px-2.5 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                          />
                        </label>
                        <label className="text-xs text-slate-500">
                          Trạng thái vận đơn
                          <select
                            value={draft.status}
                            onChange={e => updateShipmentDraft(order, { status: e.target.value })}
                            className="mt-1 w-full px-2.5 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                          >
                            <option value="ready_to_ship">Sẵn sàng giao</option>
                            <option value="shipping">Đang giao</option>
                            <option value="delivered">Đã giao</option>
                            <option value="returned">Hoàn về</option>
                            <option value="cancelled">Đã hủy</option>
                          </select>
                        </label>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="text-xs text-cyan-700">Mã vận đơn là bắt buộc trước khi chuyển đơn sang “Đang giao”.</p>
                        <button
                          onClick={() => saveShipment(order)}
                          disabled={updatingId === order.id}
                          className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border border-cyan-200 text-cyan-700 bg-white hover:bg-cyan-100 disabled:opacity-50"
                        >
                          {updatingId === order.id ? 'Đang lưu...' : 'Lưu vận đơn'}
                        </button>
                      </div>
                    </div>

                    {/* Status actions */}
                    {nextStatuses.length > 0 && (
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-xs text-slate-400">Chuyển sang:</span>
                        {nextStatuses.map(s => (
                          <button
                            key={s}
                            onClick={() => updateStatus(order, s)}
                            disabled={updatingId === order.id}
                            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50
                              ${s === 'cancelled'
                                ? 'border-red-200 text-red-600 hover:bg-red-50'
                                : s === 'return_requested'
                                  ? 'border-orange-200 text-orange-600 hover:bg-orange-50'
                                  : s === 'returned'
                                    ? 'border-slate-300 text-slate-600 hover:bg-slate-50'
                                    : 'border-blue-200 text-blue-600 hover:bg-blue-50'
                              }`}
                          >
                            {updatingId === order.id ? '...' : STATUS_LABELS[s]?.label ?? s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      </div>
    </div>
  );
}
