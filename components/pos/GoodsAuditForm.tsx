import React from 'react';
import {
  ArrowLeft,
  Check,
  FileSpreadsheet,
  Pencil,
  Save,
  Search,
  X,
} from 'lucide-react';
import { POSProduct, InventoryTransaction, ProductGroup } from '../../types';
import ProductGroupTreePicker from '../shared/ProductGroupTreePicker';

export interface AuditItem {
  productId: string;
  currentStock: number;
  actualStock: number;
  note: string;
  damagedQty?: number;
}

export type GoodsAuditMode = 'actual' | 'damaged';

const splitCategoryPath = (value: string) =>
  String(value || '')
    .split(/\s*(?:>>|>|\/)\s*/g)
    .map(part => part.trim())
    .filter(Boolean);

const normalizeCategoryPath = (value: string) => splitCategoryPath(value).join(' >> ');

// --- Lịch sử kiểm kho (tab 'kho') ---

interface GoodsKhoHistoryProps {
  transactions: InventoryTransaction[];
}

export const GoodsKhoHistory: React.FC<GoodsKhoHistoryProps> = ({ transactions }) => (
  <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
    <table className="w-full text-sm">
      <thead className="bg-[#fff9f0] border-b font-semibold uppercase text-2xs">
        <tr>
          <th className="p-4 text-left">Mã phiếu</th>
          <th className="p-4 text-left">Ngày</th>
          <th className="p-4 text-right">Lệch</th>
          <th className="p-4 text-center">Trạng thái</th>
        </tr>
      </thead>
      <tbody>
        {transactions
          .filter(t => t.type === 'Check')
          .map(t => (
            <tr key={t.id} className="border-b">
              <td className="p-4 text-indigo-600 font-normal">#{t.id.slice(0, 8)}</td>
              <td className="p-4 text-slate-500">{new Date(t.date).toLocaleDateString()}</td>
              <td className="p-4 text-right font-normal">
                {(t.items || []).reduce((s, i) => s + i.quantity, 0)}
              </td>
              <td className="p-4 text-center">
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[9px] font-normal uppercase">
                  Đã cân bằng
                </span>
              </td>
            </tr>
          ))}
      </tbody>
    </table>
  </div>
);

// --- Form kiểm kê thực tế (tab 'audit_form') ---

interface GoodsAuditFormProps {
  products: POSProduct[];
  lowStockProducts: POSProduct[];
  transactions: InventoryTransaction[];
  productGroups?: ProductGroup[];
  auditItems: AuditItem[];
  setAuditItems: React.Dispatch<React.SetStateAction<AuditItem[]>>;
  auditSearchTerm: string;
  setAuditSearchTerm: (v: string) => void;
  auditMode?: GoodsAuditMode;
  onConfirmAudit: (note?: string) => void;
  onCancel: () => void;
  recentTransactionType?: InventoryTransaction['type'];
  labels?: {
    title?: string;
    actorLabel?: string;
    codeLabel?: string;
    actualTotalLabel?: string;
    diffTotalLabel?: string;
    valueDiffLabel?: string;
    recentTitle?: string;
    recentEmpty?: string;
    notePlaceholder?: string;
    emptyTitle?: string;
  };
}

export const GoodsAuditForm: React.FC<GoodsAuditFormProps> = ({
  products,
  transactions,
  productGroups = [],
  auditItems,
  setAuditItems,
  auditSearchTerm,
  setAuditSearchTerm,
  auditMode = 'actual',
  onConfirmAudit,
  onCancel,
  recentTransactionType = 'Check',
  labels = {},
}) => {
  const [statusFilter, setStatusFilter] = React.useState<
    'all' | 'matched' | 'mismatched' | 'unchecked'
  >('all');
  const [note, setNote] = React.useState('');
  const [draftSavedAt, setDraftSavedAt] = React.useState<Date | null>(null);
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>([]);
  const now = React.useMemo(() => new Date(), []);
  const activeProducts = React.useMemo(
    () => products.filter(p => p.status !== 'Inactive'),
    [products]
  );
  const productsById = React.useMemo(
    () => new Map(products.map(product => [product.id, product])),
    [products]
  );
  
  // Build product count by category path for tree picker
  const productCountByPath = React.useMemo(() => {
    const countMap = new Map<string, number>();
    activeProducts.forEach(product => {
      if (product.isParent) return;
      const rawPath = product.categoryPath || product.categoryId || '';
      if (!rawPath) return;
      
      const parts = splitCategoryPath(rawPath);
      let currentPath = '';
      parts.forEach(part => {
        currentPath = currentPath ? `${currentPath} >> ${part}` : part;
        countMap.set(currentPath, (countMap.get(currentPath) || 0) + 1);
      });
    });
    return countMap;
  }, [activeProducts]);
  
  const searchableProducts = React.useMemo(() => {
    const selected = new Set(selectedCategories);
    return activeProducts.filter(product => {
      if (product.isParent) return false;
      if (selected.size === 0) return true;
      
      // Get product's category (could be simple or hierarchical)
      const productPath = normalizeCategoryPath(product.categoryPath || product.categoryId || '');
      
      return Array.from(selected).some(selectedPath => {
        const normalizedSelectedPath = normalizeCategoryPath(selectedPath);
        // Exact match
        if (productPath === normalizedSelectedPath) return true;
        
        // Hierarchical match (product is child of selected)
        if (productPath.startsWith(normalizedSelectedPath + ' >> ')) return true;
        
        // Reverse match: if selected is "GIÀY >> GIÀY CAO GÓT" and product has "GIÀY CAO GÓT"
        const selectedParts = splitCategoryPath(normalizedSelectedPath);
        const lastPart = selectedParts[selectedParts.length - 1];
        if (productPath === lastPart) return true;
        
        return false;
      });
    });
  }, [activeProducts, selectedCategories]);

  React.useEffect(() => {
    if (auditMode !== 'actual' || selectedCategories.length === 0) return;
    setAuditItems(prev => {
      const previousById = new Map(prev.map(item => [item.productId, item]));
      return searchableProducts.map(product => {
        const existing = previousById.get(product.id);
        return {
          productId: product.id,
          currentStock: product.stock,
          actualStock: existing?.actualStock ?? 0,
          note: existing?.note ?? '',
        };
      });
    });
  }, [auditMode, searchableProducts, selectedCategories.length, setAuditItems]);

  const mismatchCount = auditItems.filter(i => i.actualStock !== i.currentStock).length;
  const matchedCount = auditItems.length - mismatchCount;
  const totalActualQty = auditItems.reduce((sum, item) => sum + item.actualStock, 0);
  const totalDiffQty = auditItems.reduce(
    (sum, item) => sum + (item.actualStock - item.currentStock),
    0
  );
  const totalDiffValue = auditItems.reduce((sum, item) => {
    const product = productsById.get(item.productId);
    return sum + (item.actualStock - item.currentStock) * (product?.importPrice || 0);
  }, 0);
  const totalDamagedQty = auditItems.reduce((sum, item) => sum + (item.damagedQty || 0), 0);
  const displayedDiffQty = auditMode === 'damaged' ? Math.abs(totalDiffQty) : totalDiffQty;
  const displayedDiffValue = auditMode === 'damaged' ? Math.abs(totalDiffValue) : totalDiffValue;
  const recentChecks = React.useMemo(
    () =>
      transactions
        .filter(transaction => transaction.type === recentTransactionType)
        .slice()
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 6),
    [recentTransactionType, transactions]
  );

  const visibleAuditItems = React.useMemo(() => {
    switch (statusFilter) {
      case 'matched':
        return auditItems.filter(item => item.actualStock === item.currentStock);
      case 'mismatched':
        return auditItems.filter(item => item.actualStock !== item.currentStock);
      case 'unchecked':
        return [];
      default:
        return auditItems;
    }
  }, [auditItems, statusFilter]);

  const addMatchingProduct = (value: string) => {
    setAuditSearchTerm(value);
    const term = value.trim().toLowerCase();
    if (term.length < 2) return;
    const product = searchableProducts.find(
      p =>
        p.name.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term) ||
        (p.barcode || '').toLowerCase().includes(term)
    );
    if (!product) return;
    setAuditItems(prev => {
      const existingIndex = prev.findIndex(item => item.productId === product.id);
      if (auditMode === 'damaged') {
        if (existingIndex !== -1) {
          return prev.map((item, index) => {
            if (index !== existingIndex) return item;
            const damagedQty = Math.min(item.currentStock, (item.damagedQty || 0) + 1);
            return {
              ...item,
              damagedQty,
              actualStock: Math.max(0, item.currentStock - damagedQty),
            };
          });
        }
        const damagedQty = Math.min(product.stock, 1);
        return [
          ...prev,
          {
            productId: product.id,
            currentStock: product.stock,
            actualStock: Math.max(0, product.stock - damagedQty),
            damagedQty,
            note: 'Hàng lỗi/hư',
          },
        ];
      }
      if (existingIndex !== -1) {
        return prev.map((item, index) =>
          index === existingIndex
            ? { ...item, actualStock: item.actualStock + 1, damagedQty: undefined }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          currentStock: product.stock,
          actualStock: selectedCategories.length > 0 ? 1 : product.stock,
          note: '',
        },
      ];
    });
    setAuditSearchTerm('');
  };

  const statusTabs = [
    { key: 'all' as const, label: 'Tất cả', count: auditItems.length },
    { key: 'matched' as const, label: 'Khớp', count: matchedCount },
    { key: 'mismatched' as const, label: 'Lệch', count: mismatchCount },
    { key: 'unchecked' as const, label: 'Chưa kiểm', count: 0 },
  ];

  return (
    <div className="animate-in fade-in duration-300">
      <div className="grid min-h-[calc(100vh-190px)] gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-4 lg:flex-row lg:items-center">
            <div className="flex items-center gap-3">
              <button
                onClick={onCancel}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                title="Quay lại"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-slate-900">
                  {labels.title ||
                    (auditMode === 'damaged' ? 'Phiếu trừ hàng lỗi/hư' : 'Phiếu kiểm kho')}
                </h3>
                <p className="text-xs font-normal text-slate-400">
                  {now.toLocaleDateString('vi-VN', {
                    weekday: 'long',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>

            <div className="relative min-w-[240px] flex-1 lg:max-w-xl">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-normal text-slate-700 outline-none transition-all placeholder:text-slate-300 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                placeholder={
                  auditMode === 'damaged'
                    ? 'Quét mã hàng lỗi/hư để trừ tồn'
                    : selectedCategories.length > 0
                      ? 'Quét mã hàng trong nhóm để cộng vào SL thực tế'
                    : 'Tìm hàng hóa theo mã hoặc tên'
                }
                value={auditSearchTerm}
                onChange={e => addMatchingProduct(e.target.value)}
              />
            </div>

            <ProductGroupTreePicker
              groups={productGroups}
              selectedPaths={selectedCategories}
              onSelectionChange={setSelectedCategories}
              productCountByPath={productCountByPath}
              placeholder="Chọn nhóm hàng"
              className="shrink-0"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 px-4">
            {statusTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`border-b-2 px-5 py-3 text-sm font-normal transition-colors ${
                  statusFilter === tab.key
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          <div className="min-h-[560px] overflow-x-auto">
            <table className="w-full min-w-[1020px] text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-700">
                <tr>
                  <th className="w-16 border-b border-slate-200 px-4 py-3 text-center">STT</th>
                  <th className="w-36 border-b border-slate-200 px-4 py-3 text-left">Mã hàng</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left">Tên hàng</th>
                  <th className="w-24 border-b border-slate-200 px-4 py-3 text-center">ĐVT</th>
                  <th className="w-24 border-b border-slate-200 px-4 py-3 text-right">Tồn kho</th>
                  <th className="w-28 border-b border-slate-200 px-4 py-3 text-center">Thực tế</th>
                  {auditMode === 'damaged' && (
                    <th className="w-28 border-b border-slate-200 px-4 py-3 text-center">
                      SL lỗi/hư
                    </th>
                  )}
                  <th className="w-24 border-b border-slate-200 px-4 py-3 text-right">SL lệch</th>
                  <th className="w-32 border-b border-slate-200 px-4 py-3 text-right">
                    Giá trị lệch
                  </th>
                  <th className="w-12 border-b border-slate-200 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {visibleAuditItems.map((item, idx) => {
                  const product = productsById.get(item.productId);
                  const diff = item.actualStock - item.currentStock;
                  const diffValue = diff * (product?.importPrice || 0);
                  return (
                    <tr key={item.productId} className={diff !== 0 ? 'bg-amber-50/50' : 'bg-white'}>
                      <td className="border-b border-slate-100 px-4 py-3 text-center font-normal text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="border-b border-slate-100 px-4 py-3 text-xs font-normal text-indigo-600">
                        {product?.sku || item.productId}
                      </td>
                      <td className="border-b border-slate-100 px-4 py-3">
                        <div className="font-normal text-slate-900">
                          {product?.name || item.productId}
                        </div>
                        <input
                          className="mt-1 w-full rounded-lg border border-transparent bg-transparent px-0 py-1 text-xs font-normal text-slate-400 outline-none transition-colors placeholder:text-slate-300 focus:border-slate-200 focus:bg-white focus:px-2"
                          placeholder="Ghi chú dòng"
                          value={item.note}
                          onChange={e => {
                            const nextItems = [...auditItems];
                            const originalIndex = auditItems.findIndex(
                              auditItem => auditItem.productId === item.productId
                            );
                            if (originalIndex === -1) return;
                            nextItems[originalIndex] = {
                              ...nextItems[originalIndex],
                              note: e.target.value,
                            };
                            setAuditItems(nextItems);
                          }}
                        />
                      </td>
                      <td className="border-b border-slate-100 px-4 py-3 text-center font-normal text-slate-500">
                        {product?.unit || 'Cái'}
                      </td>
                      <td className="border-b border-slate-100 px-4 py-3 text-right font-normal text-slate-700">
                        {item.currentStock}
                      </td>
                      <td className="border-b border-slate-100 px-4 py-3 text-center">
                        {auditMode === 'damaged' ? (
                          <span className="inline-flex h-9 w-24 items-center justify-center rounded-xl bg-slate-100 font-normal text-slate-700">
                            {item.actualStock}
                          </span>
                        ) : (
                          <input
                            type="number"
                            className="h-9 w-24 rounded-xl border border-slate-200 bg-white text-center font-normal text-slate-900 outline-none transition-all focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                            value={item.actualStock}
                            onChange={e => {
                              const nextItems = [...auditItems];
                              const originalIndex = auditItems.findIndex(
                                auditItem => auditItem.productId === item.productId
                              );
                              if (originalIndex === -1) return;
                              nextItems[originalIndex] = {
                                ...nextItems[originalIndex],
                                actualStock: Number(e.target.value),
                                damagedQty: undefined,
                              };
                              setAuditItems(nextItems);
                            }}
                          />
                        )}
                      </td>
                      {auditMode === 'damaged' && (
                        <td className="border-b border-slate-100 px-4 py-3 text-center">
                          <input
                            type="number"
                            min={0}
                            max={item.currentStock}
                            className="h-9 w-24 rounded-xl border border-rose-200 bg-white text-center font-normal text-rose-600 outline-none transition-all focus:border-rose-400 focus:ring-4 focus:ring-rose-50"
                            value={item.damagedQty || 0}
                            onChange={e => {
                              const nextItems = [...auditItems];
                              const originalIndex = auditItems.findIndex(
                                auditItem => auditItem.productId === item.productId
                              );
                              if (originalIndex === -1) return;
                              const damagedQty = Math.max(
                                0,
                                Math.min(item.currentStock, Number(e.target.value) || 0)
                              );
                              nextItems[originalIndex] = {
                                ...nextItems[originalIndex],
                                damagedQty,
                                actualStock: Math.max(0, item.currentStock - damagedQty),
                              };
                              setAuditItems(nextItems);
                            }}
                          />
                        </td>
                      )}
                      <td
                        className={`border-b border-slate-100 px-4 py-3 text-right font-normal ${
                          diff > 0
                            ? 'text-emerald-600'
                            : diff < 0
                              ? 'text-rose-600'
                              : 'text-slate-300'
                        }`}
                      >
                        {diff === 0 ? '0' : `${diff > 0 ? '+' : ''}${diff}`}
                      </td>
                      <td
                        className={`border-b border-slate-100 px-4 py-3 text-right font-normal ${
                          diffValue > 0
                            ? 'text-emerald-600'
                            : diffValue < 0
                              ? 'text-rose-600'
                              : 'text-slate-300'
                        }`}
                      >
                        {diffValue.toLocaleString('vi-VN')}đ
                      </td>
                      <td className="border-b border-slate-100 px-4 py-3 text-center">
                        <button
                          onClick={() =>
                            setAuditItems(
                              auditItems.filter(auditItem => auditItem.productId !== item.productId)
                            )
                          }
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-600"
                          title="Xóa khỏi phiếu"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {visibleAuditItems.length === 0 && (
              <div className="flex min-h-[460px] flex-col items-center justify-center px-6 text-center">
                <FileSpreadsheet className="mb-4 h-12 w-12 text-slate-200" />
                <p className="text-lg font-normal text-slate-800">
                  {labels.emptyTitle || 'Thêm sản phẩm vào phiếu kiểm'}
                </p>
                <p className="mt-2 max-w-md text-sm font-normal text-slate-400">
                  {selectedCategories.length > 0
                    ? 'Tất cả hàng trong nhóm đã chọn sẽ hiện trong bảng. Quét mã để cộng số lượng thực tế, hoặc nhập tay vào cột Thực tế.'
                    : auditMode === 'damaged'
                      ? 'Quét từng mã hàng lỗi/hư. Mỗi lần quét sẽ trừ 1 khỏi tồn kho thực tế.'
                      : 'Chọn nhóm hàng để giới hạn phạm vi tìm kiếm, hoặc gõ mã hàng để tìm nhanh.'}
                </p>
              </div>
            )}
          </div>
        </div>

        <aside className="flex min-h-[620px] flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="space-y-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-normal uppercase tracking-wide text-slate-400">
                  {labels.actorLabel || 'Người kiểm'}
                </p>
                <p className="mt-1 font-normal text-slate-900">Nhân viên hiện tại</p>
              </div>
              <div className="rounded-xl border border-slate-200 px-3 py-2 text-right text-sm font-normal text-slate-500">
                {now.toLocaleDateString('vi-VN')}{' '}
                {now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            <div className="grid grid-cols-[110px_1fr] gap-y-4 text-sm">
              <span className="font-normal text-slate-500">
                {labels.codeLabel || 'Mã kiểm kho'}
              </span>
              <div className="rounded-xl border border-slate-200 px-3 py-2 font-normal text-slate-400">
                Mã phiếu tự động
              </div>
              <span className="font-normal text-slate-500">Trạng thái</span>
              <span className="font-normal text-slate-900">
                {draftSavedAt ? 'Đã lưu tạm' : 'Phiếu tạm'}
              </span>
              <span className="font-normal text-slate-500">
                {labels.actualTotalLabel || 'Tổng SL thực tế'}
              </span>
              <span className="font-normal text-slate-900">
                {totalActualQty.toLocaleString('vi-VN')}
              </span>
              <span className="font-normal text-slate-500">
                {labels.diffTotalLabel || 'Tổng SL lệch'}
              </span>
              <span
                className={`font-normal ${totalDiffQty < 0 ? 'text-rose-600' : 'text-emerald-600'}`}
              >
                {auditMode !== 'damaged' && totalDiffQty > 0 ? '+' : ''}
                {displayedDiffQty.toLocaleString('vi-VN')}
              </span>
              <span className="font-normal text-slate-500">
                {labels.valueDiffLabel || 'Giá trị lệch'}
              </span>
              <span
                className={`font-normal ${totalDiffValue < 0 ? 'text-rose-600' : 'text-emerald-600'}`}
              >
                {displayedDiffValue.toLocaleString('vi-VN')}đ
              </span>
              {auditMode === 'damaged' && (
                <>
                  <span className="font-normal text-slate-500">SL lỗi/hư</span>
                  <span className="font-normal text-rose-600">
                    {totalDamagedQty.toLocaleString('vi-VN')}
                  </span>
                </>
              )}
            </div>

            <div className="relative">
              <Pencil className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-normal outline-none transition-all placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                placeholder={labels.notePlaceholder || 'Ghi chú'}
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </div>
          </div>

          <div className="mx-5 flex-1 overflow-hidden rounded-xl border border-slate-200">
            <div className="border-b border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-normal text-slate-900">
              {labels.recentTitle || 'Kiểm gần đây'}
            </div>
            <div className="h-full divide-y divide-slate-100 overflow-auto">
              {recentChecks.length === 0 ? (
                <div className="flex h-44 items-center justify-center px-5 text-center text-sm font-normal text-slate-300">
                  {labels.recentEmpty || 'Chưa có phiếu kiểm gần đây'}
                </div>
              ) : (
                recentChecks.map(transaction => {
                  const diff = (transaction.items || []).reduce((sum, item) => sum + item.quantity, 0);
                  return (
                    <div key={transaction.id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-normal text-indigo-600">
                          #{transaction.id.slice(0, 8)}
                        </span>
                        <span className="text-xs font-normal text-slate-400">
                          {new Date(transaction.date).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs">
                        <span className="font-normal text-slate-500">
                          {transaction.items.length} mặt hàng
                        </span>
                        <span
                          className={
                            diff < 0 ? 'font-normal text-rose-600' : 'font-normal text-emerald-600'
                          }
                        >
                          {diff > 0 ? '+' : ''}
                          {diff}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-slate-200 p-5">
            {draftSavedAt && (
              <div className="col-span-2 text-center text-xs font-normal text-slate-400">
                Lưu tạm lúc{' '}
                {draftSavedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
            <button
              onClick={() => {
                setNote(note.trim());
                setDraftSavedAt(new Date());
              }}
              className="flex h-14 items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-normal text-white shadow-md shadow-indigo-100 transition-colors hover:bg-indigo-700"
            >
              <Save className="h-4 w-4" />
              Lưu tạm
            </button>
            <button
              onClick={() => onConfirmAudit(note)}
              disabled={auditItems.length === 0}
              className="flex h-14 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-normal text-white shadow-md shadow-emerald-100 transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Check className="h-4 w-4" />
              {auditMode === 'actual' ? 'Cân bằng kho' : 'Hoàn thành'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};
