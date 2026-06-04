import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, FileDown, Plus, Star } from 'lucide-react';
import { ShopeeInventoryInRecord, ShopeeSourceItem, Supplier } from '../../types';
import { ListPageToolbar, ListPagePagination, DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../shared';
import ShopeeInventoryInForm from './ShopeeInventoryInForm';

interface Props {
  shopeeInventoryIn: ShopeeInventoryInRecord[];
  shopeeSourceData?: ShopeeSourceItem[];
  suppliers?: Supplier[];
  formatNumber: (num: number) => string;
  onUpdate?: (newList: ShopeeInventoryInRecord[]) => Promise<void>;
  onUpdateSourceData?: (newList: ShopeeSourceItem[]) => Promise<void>;
  onFormToggle?: (open: boolean) => void;
}

interface PurchaseOrder {
  purchaseOrderId: string;
  date: string;
  supplierName?: string;
  items: ShopeeInventoryInRecord[];
  totalAmount: number;
  totalQty: number;
}

const groupIntoOrders = (records: ShopeeInventoryInRecord[]): PurchaseOrder[] => {
  const map = new Map<string, ShopeeInventoryInRecord[]>();
  const noOrderItems: ShopeeInventoryInRecord[] = [];

  for (const r of records) {
    if (r.purchaseOrderId) {
      if (!map.has(r.purchaseOrderId)) map.set(r.purchaseOrderId, []);
      map.get(r.purchaseOrderId)!.push(r);
    } else {
      noOrderItems.push(r);
    }
  }

  const orders: PurchaseOrder[] = [];

  // Nhóm có purchaseOrderId
  for (const [id, items] of map.entries()) {
    orders.push({
      purchaseOrderId: id,
      date: items[0].date,
      supplierName: items[0].supplierName,
      items,
      totalAmount: items.reduce((s, i) => s + i.quantity * i.importPrice, 0),
      totalQty: items.reduce((s, i) => s + i.quantity, 0),
    });
  }

  // Dòng cũ không có purchaseOrderId → gom tất cả vào 1 phiếu
  if (noOrderItems.length > 0) {
    orders.push({
      purchaseOrderId: '__legacy__',
      date: noOrderItems[0].date,
      supplierName: undefined,
      items: noOrderItems,
      totalAmount: noOrderItems.reduce((s, i) => s + i.quantity * i.importPrice, 0),
      totalQty: noOrderItems.reduce((s, i) => s + i.quantity, 0),
    });
  }

  return orders.sort((a, b) => b.date.localeCompare(a.date));
};

const InventoryInTab: React.FC<Props> = ({
  shopeeInventoryIn,
  shopeeSourceData = [],
  suppliers = [],
  formatNumber,
  onUpdate,
  onUpdateSourceData,
  onFormToggle,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [starred, setStarred] = useState<Set<string>>(new Set());

  const openForm = () => { setShowForm(true); onFormToggle?.(true); };
  const closeForm = () => { setShowForm(false); onFormToggle?.(false); };

  const toggleExpand = (id: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleStar = (id: string) => {
    setStarred(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allOrders = useMemo(() => groupIntoOrders(shopeeInventoryIn), [shopeeInventoryIn]);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return allOrders;
    const q = searchTerm.toLowerCase();
    return allOrders.filter(o =>
      o.items.some(i => i.sku.toLowerCase().includes(q)) ||
      (o.supplierName || '').toLowerCase().includes(q)
    );
  }, [allOrders, searchTerm]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toolbar = (
    <ListPageToolbar
      searchTerm={searchTerm}
      onSearchChange={v => { setSearchTerm(v); setCurrentPage(1); }}
      searchPlaceholder="Tìm theo SKU hoặc nhà cung cấp..."
      rightActions={
        <>
          <button onClick={openForm} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-normal hover:bg-indigo-700 transition-colors shadow-sm">
            <Plus className="h-4 w-4" /> Tạo phiếu nhập
          </button>
          <button className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl text-sm font-normal text-slate-700 hover:bg-slate-50 transition-colors">
            <FileDown className="h-4 w-4" /> Xuất file
          </button>
        </>
      }
    />
  );

  return (
    <>
      {showForm && (
        <div className="absolute inset-0 z-20 bg-slate-50">
          <ShopeeInventoryInForm
            shopeeSourceData={shopeeSourceData}
            shopeeInventoryIn={shopeeInventoryIn}
            suppliers={suppliers}
            onClose={closeForm}
            onAddSku={onUpdateSourceData ? async (item) => {
              await onUpdateSourceData([...shopeeSourceData, item]);
            } : undefined}
            onComplete={async (records) => {
              if (!onUpdate) return;
              const newRecords: ShopeeInventoryInRecord[] = records.map(r => ({ ...r, id: crypto.randomUUID() }));
              await onUpdate([...shopeeInventoryIn, ...newRecords]);
              closeForm();
            }}
          />
        </div>
      )}

      <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="shrink-0">{toolbar}</div>
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full min-w-[700px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                <th className="w-8 px-3 py-3" />
                <th className="w-8 px-3 py-3" />
                <th className="px-4 py-3">Mã phiếu</th>
                <th className="px-4 py-3">Ngày nhập</th>
                <th className="px-4 py-3">Nhà cung cấp</th>
                <th className="px-4 py-3 text-center">Số SKU</th>
                <th className="px-4 py-3 text-center">Tổng SL</th>
                <th className="px-4 py-3 text-right">Tổng tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.length > 0 ? paginated.map(order => {
                const isExpanded = expandedOrders.has(order.purchaseOrderId);
                const isStarred = starred.has(order.purchaseOrderId);
                const orderCode = order.items[0]?.purchaseOrderCode
                  || (order.purchaseOrderId === '__legacy__' ? 'DỮ LIỆU CŨ' : `PNOL-${order.purchaseOrderId.slice(0, 6).toUpperCase()}`);

                return (
                  <React.Fragment key={order.purchaseOrderId}>
                    {/* Hàng phiếu */}
                    <tr
                      className="cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => toggleExpand(order.purchaseOrderId)}
                    >
                      <td className="px-3 py-3 text-center">
                        <button onClick={e => { e.stopPropagation(); toggleStar(order.purchaseOrderId); }}>
                          <Star className={`h-4 w-4 ${isStarred ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                        </button>
                      </td>
                      <td className="px-3 py-3 text-center text-slate-400">
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4" />
                          : <ChevronRight className="h-4 w-4" />
                        }
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-indigo-600 font-semibold">{orderCode}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{order.date.split('-').reverse().join('/')}</td>
                      <td className="px-4 py-3 text-slate-700 text-xs">{order.supplierName || <span className="italic text-slate-400">—</span>}</td>
                      <td className="px-4 py-3 text-center text-xs font-semibold text-slate-700">{order.items.length}</td>
                      <td className="px-4 py-3 text-center text-xs font-semibold text-blue-600">{order.totalQty.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-xs font-semibold text-slate-900 tabular-nums">{formatNumber(order.totalAmount)}đ</td>
                    </tr>

                    {/* Chi tiết SKU */}
                    {isExpanded && order.items.map(item => (
                      <tr key={item.id} className="bg-slate-50/60 border-b border-slate-100">
                        <td colSpan={2} />
                        <td className="px-4 py-2 font-mono text-xs text-slate-500 uppercase">{item.sku}</td>
                        <td className="px-4 py-2 text-xs text-slate-400">{item.date.split('-').reverse().join('/')}</td>
                        <td className="px-4 py-2 text-xs text-slate-400">{item.note || '—'}</td>
                        <td className="px-4 py-2 text-center text-xs text-slate-500">—</td>
                        <td className="px-4 py-2 text-center text-xs text-blue-600 font-semibold">{item.quantity}</td>
                        <td className="px-4 py-2 text-right text-xs text-rose-600 tabular-nums">{formatNumber(item.importPrice)}đ/sp</td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              }) : (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-sm text-slate-400">
                    {searchTerm ? 'Không tìm thấy phiếu nhập phù hợp' : 'Chưa có lịch sử nhập kho'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 shrink-0">
          <ListPagePagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filtered.length}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageChange={setCurrentPage}
            onPageSizeChange={size => { setPageSize(size); setCurrentPage(1); }}
          />
        </div>
      </div>
    </>
  );
};

export default InventoryInTab;
