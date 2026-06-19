import React, { useState, useMemo } from 'react';
import { Download, Eye, PackageOpen, Plus, Printer, Search, Save, Trash2, X } from 'lucide-react';
import { AppData, InventoryTransaction } from '../../types';
import { useToast } from '../ui/Toast';
import { exportToExcel, printToPDF } from '../../services/exportService';
import {
  FilterDateRange,
  FilterSection,
  ListPageLayout,
  ListPageToolbar,
} from '../shared';

interface GoodsInternalUseProps {
  products: AppData['posProducts'];
  data: AppData;
  onUpdateSurgical: (updates: any[]) => Promise<void>;
}

interface InternalUseItem {
  productId: string;
  productName: string;
  quantity: number;
  currentStock: number;
}

export default function GoodsInternalUse({ products, data, onUpdateSurgical }: GoodsInternalUseProps) {
  const { showToast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [staffId, setStaffId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [items, setItems] = useState<InternalUseItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [listSearch, setListSearch] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [staffFilter, setStaffFilter] = useState('');
  const [purposeFilter, setPurposeFilter] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<InventoryTransaction | null>(null);

  const internalUseTransactions = useMemo(() => {
    const query = listSearch.trim().toLowerCase();
    return (data.inventoryTransactions || [])
      .filter(t => t.type === 'internal_use')
      .filter(t => {
        if (dateRange.start && t.date < dateRange.start) return false;
        if (dateRange.end && t.date > dateRange.end) return false;
        if (staffFilter.trim() && !(t.staffId || '').toLowerCase().includes(staffFilter.trim().toLowerCase())) {
          return false;
        }
        if (purposeFilter.trim() && !(t.note || '').toLowerCase().includes(purposeFilter.trim().toLowerCase())) {
          return false;
        }
        if (!query) return true;
        return (
          t.id.toLowerCase().includes(query) ||
          (t.staffId || '').toLowerCase().includes(query) ||
          (t.note || '').toLowerCase().includes(query) ||
          t.items.some(item =>
            [item.sku, item.name, item.productName, item.productId]
              .filter(Boolean)
              .join(' ')
              .toLowerCase()
              .includes(query)
          )
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data.inventoryTransactions, dateRange.end, dateRange.start, listSearch, purposeFilter, staffFilter]);

  const hasActiveFilters =
    !!dateRange.start ||
    !!dateRange.end ||
    !!staffFilter.trim() ||
    !!purposeFilter.trim() ||
    !!listSearch.trim();

  const availableProducts = useMemo(() => {
    return products
      .filter(p => !p.isParent && (p.stock || 0) > 0)
      .filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [products, searchTerm]);

  const handleAddItem = (product: AppData['posProducts'][0]) => {
    if (items.find(i => i.productId === product.id)) {
      showToast('Sản phẩm đã được thêm vào danh sách', 'warning');
      return;
    }

    setItems([...items, {
      productId: product.id,
      productName: product.name,
      quantity: 1,
      currentStock: product.stock || 0
    }]);
    setSearchTerm('');
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    setItems(items.map(item => 
      item.productId === productId 
        ? { ...item, quantity: Math.min(Math.max(1, quantity), item.currentStock) }
        : item
    ));
  };

  const handleRemoveItem = (productId: string) => {
    setItems(items.filter(item => item.productId !== productId));
  };

  const buildExportRows = (rows: InventoryTransaction[]) =>
    rows.flatMap(transaction =>
      transaction.items.map(item => ({
        'Mã phiếu': transaction.id,
        Ngày: new Date(transaction.date).toLocaleString('vi-VN'),
        'Người nhận': transaction.staffId || '',
        'Mục đích': transaction.note || '',
        SKU: item.sku || '',
        'Tên hàng': item.name || item.productName || item.productId,
        'Số lượng': Math.abs(item.quantity || 0),
      }))
    );

  const handleExport = (rows: InventoryTransaction[]) => {
    if (rows.length === 0) {
      showToast('Chưa có phiếu xuất dùng nội bộ để xuất', 'warning');
      return;
    }
    exportToExcel(buildExportRows(rows), 'Phieu_Xuat_Dung_Noi_Bo', 'Chi tiết xuất dùng');
  };

  const handlePrint = (transaction: InventoryTransaction) => {
    const rows = transaction.items
      .map(
        item => `<tr>
          <td>${item.sku || ''}</td>
          <td>${item.name || item.productName || item.productId}</td>
          <td class="text-right">${Math.abs(item.quantity || 0)}</td>
        </tr>`
      )
      .join('');
    printToPDF(
      `Phiếu xuất dùng nội bộ ${transaction.id}`,
      `<h1>Phiếu xuất dùng nội bộ ${transaction.id}</h1>
       <p class="subtitle">Ngày xuất: ${new Date(transaction.date).toLocaleString('vi-VN')} | Người nhận: ${transaction.staffId || ''}</p>
       <p>Mục đích: ${transaction.note || ''}</p>
       <table>
        <thead><tr><th>SKU</th><th>Tên hàng</th><th class="text-right">Số lượng</th></tr></thead>
        <tbody>${rows}</tbody>
       </table>`
    );
  };

  const handleDelete = async (transaction: InventoryTransaction) => {
    if (!window.confirm(`Xóa phiếu xuất dùng nội bộ ${transaction.id}? Tồn kho sẽ được hoàn lại.`)) {
      return;
    }
    try {
      const rollbackProducts = transaction.items
        .map(item => {
          const product = products.find(p => p.id === item.productId);
          return product
            ? { ...product, stock: (product.stock || 0) + Math.abs(item.quantity || 0) }
            : null;
        })
        .filter((product): product is (typeof products)[number] => product !== null);

      await onUpdateSurgical([
        { key: 'inventoryTransactions', item: { id: transaction.id }, isDelete: true },
        ...rollbackProducts.map(product => ({ key: 'posProducts', item: product, isDelete: false })),
      ]);
      setSelectedDetail(null);
      showToast('Đã xóa phiếu xuất dùng nội bộ', 'success');
    } catch (error) {
      console.error('Error deleting internal use:', error);
      showToast('Xóa phiếu thất bại. Vui lòng thử lại.', 'error');
    }
  };

  const handleSave = async () => {
    if (items.length === 0) {
      showToast('Vui lòng thêm ít nhất 1 sản phẩm', 'warning');
      return;
    }

    if (!purpose.trim()) {
      showToast('Vui lòng nhập mục đích sử dụng', 'warning');
      return;
    }

    // Validate lại tồn kho thực tế trước khi ghi (snapshot trong form có thể lỗi thời)
    const insufficientItem = items.find(item => {
      const product = products.find(p => p.id === item.productId);
      return product && item.quantity > (product.stock || 0);
    });
    if (insufficientItem) {
      const product = products.find(p => p.id === insufficientItem.productId);
      showToast(
        `Không đủ tồn kho: "${insufficientItem.productName}" (tồn hiện tại: ${product?.stock ?? 0}, cần xuất: ${insufficientItem.quantity})`,
        'error'
      );
      return;
    }

    setIsSaving(true);

    try {
      const updates: any[] = [];

      // Update product stock
      for (const item of items) {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          updates.push({
            key: 'posProducts',
            item: {
              ...product,
              stock: Math.max(0, (product.stock || 0) - item.quantity)
            },
            isDelete: false
          });
        }
      }

      // Create internal use transaction
      const transaction = {
        id: crypto.randomUUID(),
        date: selectedDate,
        type: 'internal_use' as const,
        items: items.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          price: 0
        })),
        note: purpose,
        staffId: staffId || 'N/A',
        totalAmount: 0,
        status: 'completed'
      };

      updates.push({
        key: 'inventoryTransactions',
        item: transaction,
        isDelete: false
      });

      await onUpdateSurgical(updates);

      showToast('Đã tạo phiếu xuất dùng nội bộ thành công!', 'success');
      
      // Reset form
      setIsCreating(false);
      setItems([]);
      setPurpose('');
      setStaffId('');
      setSelectedDate(new Date().toISOString().split('T')[0]);
      setSelectedDetail(transaction as InventoryTransaction);
    } catch (error) {
      console.error('Error creating internal use:', error);
      showToast('Có lỗi xảy ra. Vui lòng thử lại.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const resetCreateForm = () => {
    setIsCreating(false);
    setItems([]);
    setPurpose('');
    setStaffId('');
    setSearchTerm('');
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const sidebar = (
    <div className="flex h-full flex-col overflow-y-auto">
      <FilterSection title="Thời gian">
        <button
          onClick={() => setDateRange({ start: '', end: '' })}
          className="mb-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition-all hover:border-indigo-300 hover:bg-slate-50"
        >
          Toàn thời gian
        </button>
        <FilterDateRange
          startDate={dateRange.start}
          endDate={dateRange.end}
          onStartDateChange={date => setDateRange(prev => ({ ...prev, start: date }))}
          onEndDateChange={date => setDateRange(prev => ({ ...prev, end: date }))}
        />
      </FilterSection>

      <FilterSection title="Người nhận">
        <input
          value={staffFilter}
          onChange={event => setStaffFilter(event.target.value)}
          placeholder="Tìm người nhận"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-400"
        />
      </FilterSection>

      <FilterSection title="Mục đích">
        <input
          value={purposeFilter}
          onChange={event => setPurposeFilter(event.target.value)}
          placeholder="Tìm theo mục đích"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-400"
        />
      </FilterSection>
    </div>
  );

  const toolbar = (
    <ListPageToolbar
      searchTerm={listSearch}
      onSearchChange={value => setListSearch(value)}
      searchPlaceholder="Tìm mã phiếu, người nhận, mục đích, hàng hóa..."
      leftActions={
        <div className="flex items-center gap-2 text-slate-700">
          <PackageOpen className="h-4 w-4 text-indigo-600" />
          <span className="text-sm font-semibold uppercase tracking-wide">Xuất dùng nội bộ</span>
        </div>
      }
      rightActions={
        <>
          <button
            onClick={() => handleExport(internalUseTransactions)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Xuất file
          </button>
          <button
            onClick={() => {
              setSelectedDetail(null);
              setIsCreating(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-normal text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Tạo phiếu xuất
          </button>
        </>
      }
      filterSummary={
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{internalUseTransactions.length} phiếu xuất dùng nội bộ</span>
          {selectedDetail && <span>Đang xem: {selectedDetail.id}</span>}
        </div>
      }
    />
  );

  const detailPanel = selectedDetail ? (
    <aside className="w-[360px] shrink-0 border-l border-slate-100 bg-white">
      <div className="flex items-start justify-between border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <p className="text-2xs font-semibold uppercase tracking-widest text-slate-400">
            Chi tiết phiếu
          </p>
          <h3 className="mt-1 truncate text-sm font-semibold text-slate-900">{selectedDetail.id}</h3>
        </div>
        <button
          onClick={() => setSelectedDetail(null)}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-4 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-400">Ngày xuất</p>
            <p className="mt-1 text-xs font-bold text-slate-900">
              {new Date(selectedDetail.date).toLocaleDateString('vi-VN')}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-400">Người nhận</p>
            <p className="mt-1 text-xs font-bold text-slate-900">{selectedDetail.staffId || 'N/A'}</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-100">
          {selectedDetail.items.map(item => (
            <div
              key={`${item.productId}-${item.sku || item.productName || item.name}`}
              className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-3 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-slate-900">
                  {item.name || item.productName || item.productId}
                </p>
                <p className="mt-1 text-xs text-slate-400">{item.sku || item.productId}</p>
              </div>
              <span className="shrink-0 rounded-lg bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-600">
                {Math.abs(item.quantity || 0)}
              </span>
            </div>
          ))}
        </div>
        {selectedDetail.note && (
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-400">Mục đích</p>
            <p className="mt-1 text-xs text-slate-700">{selectedDetail.note}</p>
          </div>
        )}
      </div>
      <div className="flex gap-2 border-t border-slate-100 bg-slate-50 p-3">
        <button
          onClick={() => handleExport([selectedDetail])}
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          Xuất file
        </button>
        <button
          onClick={() => handlePrint(selectedDetail)}
          className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700"
        >
          In phiếu
        </button>
      </div>
    </aside>
  ) : null;

  return (
    <ListPageLayout
      sidebarTitle="Bộ lọc"
      sidebar={sidebar}
      toolbar={toolbar}
      hasActiveFilters={hasActiveFilters}
      onClearFilters={() => {
        setDateRange({ start: '', end: '' });
        setStaffFilter('');
        setPurposeFilter('');
        setListSearch('');
      }}
    >
      {isCreating ? (
        <div className="h-full overflow-y-auto bg-slate-50 p-5">
          <div className="mx-auto max-w-5xl rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Tạo phiếu xuất dùng nội bộ</h2>
                <p className="mt-1 text-xs text-slate-500">Chọn hàng hóa và nhập mục đích sử dụng nội bộ.</p>
              </div>
              <button
                onClick={resetCreateForm}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-3">
              <label className="space-y-1.5">
                <span className="text-xs font-bold text-slate-600">Ngày xuất</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={event => setSelectedDate(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-bold text-slate-600">Người nhận</span>
                <input
                  value={staffId}
                  onChange={event => setStaffId(event.target.value)}
                  placeholder="Tên nhân viên"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-400"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-bold text-slate-600">Mục đích</span>
                <input
                  value={purpose}
                  onChange={event => setPurpose(event.target.value)}
                  placeholder="VD: Dùng cho văn phòng"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-400"
                />
              </label>
            </div>

            <div className="border-t border-slate-100 p-5">
              <label className="mb-2 block text-xs font-bold text-slate-600">Tìm sản phẩm</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchTerm}
                  onChange={event => setSearchTerm(event.target.value)}
                  placeholder="Tìm theo tên hoặc SKU..."
                  className="w-full rounded-lg border border-slate-200 py-2 pl-10 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-400"
                />
              </div>
              {searchTerm && availableProducts.length > 0 && (
                <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-slate-100 bg-white">
                  {availableProducts.map(product => (
                    <button
                      key={product.id}
                      onClick={() => handleAddItem(product)}
                      className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 last:border-b-0"
                    >
                      <span>
                        <span className="block text-sm font-bold text-slate-800">{product.name}</span>
                        <span className="mt-1 block text-xs text-slate-400">
                          SKU: {product.sku || '-'} • Tồn: {product.stock || 0}
                        </span>
                      </span>
                      <Plus className="h-4 w-4 text-indigo-600" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 p-5">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Sản phẩm xuất
              </h3>
              {items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
                  <PackageOpen className="mx-auto mb-2 h-10 w-10 text-slate-300" />
                  Chưa có sản phẩm nào
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-100">
                  {items.map(item => (
                    <div
                      key={item.productId}
                      className="flex items-center gap-4 border-b border-slate-100 px-4 py-3 last:border-b-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-800">{item.productName}</p>
                        <p className="mt-1 text-xs text-slate-400">Tồn kho: {item.currentStock}</p>
                      </div>
                      <input
                        type="number"
                        min="1"
                        max={item.currentStock}
                        value={item.quantity}
                        onChange={event => handleUpdateQuantity(item.productId, Number(event.target.value))}
                        className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-right text-sm outline-none focus:border-indigo-400"
                      />
                      <button
                        onClick={() => handleRemoveItem(item.productId)}
                        className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4">
              <button
                onClick={resetCreateForm}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || items.length === 0 || !purpose.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Đang lưu...' : 'Lưu phiếu xuất'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex h-full min-h-0">
          <div className="min-w-0 flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-bold">Mã phiếu</th>
                  <th className="px-4 py-3 text-left font-bold">Ngày</th>
                  <th className="px-4 py-3 text-left font-bold">Người nhận</th>
                  <th className="px-4 py-3 text-left font-bold">Mục đích</th>
                  <th className="px-4 py-3 text-right font-bold">Số SP</th>
                  <th className="px-4 py-3 text-right font-bold">Tổng SL</th>
                  <th className="px-4 py-3 text-right font-bold"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {internalUseTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center text-sm text-slate-400">
                      <PackageOpen className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                      Chưa có phiếu xuất nào
                    </td>
                  </tr>
                ) : (
                  internalUseTransactions.map(transaction => {
                    const totalQty = transaction.items?.reduce((sum, item) => sum + Math.abs(item.quantity || 0), 0) || 0;
                    return (
                      <tr
                        key={transaction.id}
                        onClick={() => setSelectedDetail(transaction)}
                        className={`cursor-pointer hover:bg-slate-50 ${selectedDetail?.id === transaction.id ? 'bg-indigo-50/50' : ''}`}
                      >
                        <td className="px-4 py-3 text-xs font-bold text-indigo-600">
                          {transaction.id.slice(0, 12)}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {new Date(transaction.date).toLocaleDateString('vi-VN')}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{transaction.staffId || 'N/A'}</td>
                        <td className="px-4 py-3 text-slate-600">{transaction.note || '-'}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{transaction.items?.length || 0}</td>
                        <td className="px-4 py-3 text-right font-bold text-indigo-600">{totalQty}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={event => {
                                event.stopPropagation();
                                setSelectedDetail(transaction);
                              }}
                              className="rounded-lg border border-slate-200 p-2 text-indigo-600 hover:bg-indigo-50"
                              title="Xem chi tiết"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={event => {
                                event.stopPropagation();
                                handlePrint(transaction);
                              }}
                              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                              title="In phiếu"
                            >
                              <Printer className="h-4 w-4" />
                            </button>
                            <button
                              onClick={event => {
                                event.stopPropagation();
                                handleDelete(transaction);
                              }}
                              className="rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50"
                              title="Xóa phiếu"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {detailPanel}
        </div>
      )}
    </ListPageLayout>
  );
}
