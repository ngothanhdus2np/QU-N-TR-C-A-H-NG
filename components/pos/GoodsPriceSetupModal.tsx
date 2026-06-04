import React from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Download,
  FileUp,
  Grid2X2,
  HelpCircle,
  Minus,
  Plus,
  Search,
  Settings,
  X,
} from 'lucide-react';
import { POSProduct, ProductGroup } from '../../types';
import ProductGroupTreePicker from '../shared/ProductGroupTreePicker';

interface GoodsPriceSetupModalProps {
  isOpen: boolean;
  products: POSProduct[];
  productGroups: ProductGroup[];
  currentProduct: Partial<POSProduct>;
  editingProduct: POSProduct | null;
  mode?: 'modal' | 'page';
  onClose: () => void;
  onApplyPrice: (price: number) => void;
}

type StockFilter = 'all' | 'in_stock' | 'out_of_stock';
type PriceListModalTab = 'info' | 'scope';

const ITEMS_PER_PAGE = 15;
const DEFAULT_PRICE_LIST = 'Bảng giá chung';

const normalizeText = (value: string | undefined) => (value || '').toLowerCase().trim();

const splitCategoryPath = (value: string) =>
  String(value || '')
    .split(/\s*(?:>>|>|\/)\s*/g)
    .map(part => part.trim())
    .filter(Boolean);

const normalizeCategoryPath = (value: string) => splitCategoryPath(value).join(' >> ');

const productMatchesCategory = (product: POSProduct, categoryPath: string) => {
  if (!categoryPath) return true;
  const productPath = normalizeCategoryPath(product.categoryPath || product.categoryId || '');
  return productPath === categoryPath || productPath.startsWith(`${categoryPath} >> `);
};

const formatMoney = (value: number | undefined) => Number(value || 0).toLocaleString('vi-VN');

const parseMoneyInput = (value: string) => Number(value.replace(/[^\d]/g, '')) || 0;

const toDateTimeLocalValue = (date: Date) => {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
};

export const GoodsPriceSetupModal: React.FC<GoodsPriceSetupModalProps> = ({
  isOpen,
  products,
  productGroups,
  currentProduct,
  editingProduct,
  mode = 'modal',
  onClose,
  onApplyPrice,
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [priceLists, setPriceLists] = React.useState<string[]>([DEFAULT_PRICE_LIST]);
  const [selectedPriceList, setSelectedPriceList] = React.useState(DEFAULT_PRICE_LIST);
  const [categoryFilter, setCategoryFilter] = React.useState('');
  const [stockFilter, setStockFilter] = React.useState<StockFilter>('all');
  const [priceCondition, setPriceCondition] = React.useState('');
  const [comparePrice, setComparePrice] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [draftPrices, setDraftPrices] = React.useState<Record<string, number>>({});
  const [showCreatePriceListModal, setShowCreatePriceListModal] = React.useState(false);
  const [showPriceInfoModal, setShowPriceInfoModal] = React.useState(false);
  const [createPriceListTab, setCreatePriceListTab] = React.useState<PriceListModalTab>('info');
  const [newPriceListName, setNewPriceListName] = React.useState('');
  const [newPriceListFrom, setNewPriceListFrom] = React.useState(() => toDateTimeLocalValue(new Date()));
  const [newPriceListTo, setNewPriceListTo] = React.useState(() => {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    return toDateTimeLocalValue(nextYear);
  });
  const [newPriceListActive, setNewPriceListActive] = React.useState(true);
  const [formulaBase, setFormulaBase] = React.useState(DEFAULT_PRICE_LIST);
  const [formulaOperator, setFormulaOperator] = React.useState<'plus' | 'minus'>('plus');
  const [formulaValue, setFormulaValue] = React.useState('');
  const [formulaUnit, setFormulaUnit] = React.useState<'VND' | '%'>('VND');
  const [cashierProductMode, setCashierProductMode] = React.useState<'allow_missing' | 'only_in_list'>(
    'allow_missing'
  );
  const [warnWhenMissing, setWarnWhenMissing] = React.useState(false);
  const [branchScope, setBranchScope] = React.useState<'all' | 'specific'>('all');
  const [customerGroupScope, setCustomerGroupScope] = React.useState<'all' | 'specific'>('all');
  const [creatorScope, setCreatorScope] = React.useState<'all' | 'specific'>('all');

  React.useEffect(() => {
    if (isOpen) {
      setDraftPrices({});
      setPage(1);
    }
  }, [isOpen]);

  const currentRow = React.useMemo<POSProduct | null>(() => {
    if (!currentProduct.name && !currentProduct.sku) return null;
    return {
      id: editingProduct?.id || '__current_product__',
      sku: currentProduct.sku || 'Tự động',
      name: currentProduct.name || 'Hàng đang tạo',
      categoryId: currentProduct.categoryId || 'Chưa phân loại',
      categoryPath: currentProduct.categoryPath || currentProduct.categoryId || '',
      importPrice: currentProduct.importPrice || 0,
      salePrice: currentProduct.salePrice || 0,
      stock: currentProduct.stock || 0,
      minStock: currentProduct.minStock || 0,
      unit: currentProduct.unit || 'Cái',
      status: currentProduct.status || 'Active',
      brand: currentProduct.brand,
      location: currentProduct.location,
    };
  }, [currentProduct, editingProduct?.id]);

  const displayProducts = React.useMemo(() => {
    const rows = products.filter(product => !product.isParent);
    if (!currentRow) return rows;
    const exists = rows.some(product => product.id === currentRow.id);
    return exists
      ? rows.map(product => (product.id === currentRow.id ? { ...product, ...currentRow } : product))
      : [currentRow, ...rows];
  }, [currentRow, products]);

  const categoryGroups = React.useMemo<ProductGroup[]>(() => {
    const paths = new Set<string>();
    productGroups.forEach(group => {
      splitCategoryPath(group.name).forEach((_, index, parts) => {
        paths.add(parts.slice(0, index + 1).join(' >> '));
      });
    });
    displayProducts.forEach(product => {
      const parts = splitCategoryPath(product.categoryPath || product.categoryId || '');
      let currentPath = '';
      parts.forEach(part => {
        currentPath = currentPath ? `${currentPath} >> ${part}` : part;
        paths.add(currentPath);
      });
    });
    return Array.from(paths)
      .sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }))
      .map(path => ({ id: path, name: path }));
  }, [displayProducts, productGroups]);

  const productCountByPath = React.useMemo(() => {
    const counts = new Map<string, number>();
    displayProducts.forEach(product => {
      const parts = splitCategoryPath(product.categoryPath || product.categoryId || '');
      let currentPath = '';
      parts.forEach(part => {
        currentPath = currentPath ? `${currentPath} >> ${part}` : part;
        counts.set(currentPath, (counts.get(currentPath) || 0) + 1);
      });
    });
    return counts;
  }, [displayProducts]);

  const filteredProducts = React.useMemo(() => {
    const query = normalizeText(searchTerm);
    return displayProducts.filter(product => {
      const matchesSearch =
        !query ||
        normalizeText(product.sku).includes(query) ||
        normalizeText(product.name).includes(query);
      const matchesCategory = productMatchesCategory(product, categoryFilter);
      const matchesStock =
        stockFilter === 'all' ||
        (stockFilter === 'in_stock' && product.stock > 0) ||
        (stockFilter === 'out_of_stock' && product.stock <= 0);
      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [categoryFilter, displayProducts, searchTerm, stockFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE));
  const visibleProducts = filteredProducts.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handlePriceChange = (product: POSProduct, value: string) => {
    const nextPrice = parseMoneyInput(value);
    setDraftPrices(prev => ({ ...prev, [product.id]: nextPrice }));
    if (product.id === currentRow?.id) {
      onApplyPrice(nextPrice);
    }
  };

  const openCreatePriceListModal = () => {
    setCreatePriceListTab('info');
    setShowCreatePriceListModal(true);
  };

  const closeCreatePriceListModal = () => {
    setShowCreatePriceListModal(false);
  };

  const handleSavePriceList = () => {
    const trimmedName = newPriceListName.trim();
    if (!trimmedName) return;

    setPriceLists(prev => (prev.includes(trimmedName) ? prev : [...prev, trimmedName]));
    setSelectedPriceList(trimmedName);
    setFormulaBase(trimmedName);
    setNewPriceListName('');
    setCreatePriceListTab('info');
    setShowCreatePriceListModal(false);
  };

  const activePrice = currentRow
    ? draftPrices[currentRow.id] ?? currentProduct.salePrice ?? currentRow.salePrice
    : currentProduct.salePrice || 0;

  const canSavePriceList = newPriceListName.trim().length > 0;

  if (!isOpen) {
    return null;
  }

  const content = (
    <>
      {mode === 'modal' && (
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Thiết lập giá</h2>
            <p className="text-xs text-slate-500">
              Chỉnh giá bán chung cho hàng hóa trong bảng giá hiện tại.
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            aria-label="Đóng thiết lập giá"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className={`flex min-h-0 flex-1 gap-4 ${mode === 'modal' ? 'p-4' : ''}`}>
        <aside
          className={
            mode === 'page'
              ? 'w-64 shrink-0 h-full min-h-0 flex flex-col overflow-y-auto overscroll-contain rounded-2xl border border-slate-100 bg-white shadow-sm'
              : 'hidden w-72 shrink-0 flex-col rounded-lg border border-slate-200 bg-white lg:flex'
          }
        >
          {mode === 'page' && (
            <div className="flex min-h-[58px] flex-col justify-center border-b border-slate-100 px-4">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-900">
                Thiết lập giá
              </h2>
              <p className="text-2xs uppercase tracking-wide text-slate-400">Hàng hóa</p>
            </div>
          )}
          <div className={`${mode === 'page' ? 'border-b border-slate-100' : 'border-b border-slate-200'} p-4`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Bảng giá</h3>
              <button
                onClick={openCreatePriceListModal}
                className="text-xs text-indigo-600 hover:text-indigo-700"
              >
                Tạo mới
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {priceLists.map(priceList => (
                <button
                  key={priceList}
                  onClick={() => setSelectedPriceList(priceList)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                    selectedPriceList === priceList
                      ? 'bg-indigo-600 text-white'
                      : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                  }`}
                >
                  {priceList}
                  {selectedPriceList === priceList && priceList !== DEFAULT_PRICE_LIST && (
                    <X className="h-4 w-4 text-white/80" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-5 p-4">
            <div>
              <label className="mb-2 block text-sm text-slate-800">Nhóm hàng</label>
              <ProductGroupTreePicker
                groups={categoryGroups}
                selectedPaths={categoryFilter ? [categoryFilter] : []}
                onSelectionChange={paths => {
                  setCategoryFilter(paths[paths.length - 1] || '');
                  setPage(1);
                }}
                productCountByPath={productCountByPath}
                placeholder="Chọn nhóm hàng"
                popupPlacement="right"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-800">Tồn kho</label>
              <select
                value={stockFilter}
                onChange={event => {
                  setStockFilter(event.target.value as StockFilter);
                  setPage(1);
                }}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-500"
              >
                <option value="all">Tất cả</option>
                <option value="in_stock">Còn hàng</option>
                <option value="out_of_stock">Hết hàng</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-800">Giá bán</label>
              <select
                value={priceCondition}
                onChange={event => setPriceCondition(event.target.value)}
                className="mb-2 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-500"
              >
                <option value="">Chọn điều kiện</option>
                <option value="gt">Lớn hơn</option>
                <option value="lt">Nhỏ hơn</option>
                <option value="eq">Bằng</option>
              </select>
              <select
                value={comparePrice}
                onChange={event => setComparePrice(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-500"
              >
                <option value="">Chọn giá so sánh</option>
                <option value="importPrice">Giá vốn</option>
                <option value="salePrice">Bảng giá chung</option>
              </select>
            </div>
          </div>
        </aside>

        <main
          className={
            mode === 'page'
              ? 'flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm'
              : 'flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white'
          }
        >
          <div className="flex flex-col gap-3 border-b border-slate-200 p-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative max-w-xl flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={event => {
                  setSearchTerm(event.target.value);
                  setPage(1);
                }}
                placeholder="Theo mã, tên hàng"
                className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={openCreatePriceListModal}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-indigo-300 px-3 text-sm text-indigo-600 transition-colors hover:bg-indigo-50"
              >
                <Plus className="h-4 w-4" />
                Bảng giá
              </button>
              <button className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm text-slate-700 transition-colors hover:bg-slate-50">
                <FileUp className="h-4 w-4" />
                Import
              </button>
              <button className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm text-slate-700 transition-colors hover:bg-slate-50">
                <Download className="h-4 w-4" />
                Xuất file
              </button>
              {[Grid2X2, Settings].map((Icon, idx) => (
                <button
                  key={idx}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition-colors hover:bg-slate-50"
                  aria-label="Công cụ bảng giá"
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
              <button
                onClick={() => setShowPriceInfoModal(true)}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition-colors hover:bg-slate-50"
                aria-label="Thông tin thiết lập giá"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="sticky top-0 z-10 bg-indigo-50 text-left text-xs font-bold uppercase tracking-wide text-slate-700">
                <tr>
                  <th className="w-44 border-b border-indigo-100 px-4 py-3">Mã hàng</th>
                  <th className="border-b border-indigo-100 px-4 py-3">Tên hàng</th>
                  <th className="w-36 border-b border-indigo-100 px-4 py-3 text-right">Giá vốn</th>
                  <th className="w-40 border-b border-indigo-100 px-4 py-3 text-right">
                    Giá nhập cuối
                  </th>
                  <th className="w-44 border-b border-indigo-100 px-4 py-3 text-right">
                    Bảng giá chung
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="bg-white">
                  <td className="px-4 py-2">
                    <input
                      value={searchTerm}
                      onChange={event => {
                        setSearchTerm(event.target.value);
                        setPage(1);
                      }}
                      placeholder="Tìm mã hàng"
                      className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={searchTerm}
                      onChange={event => {
                        setSearchTerm(event.target.value);
                        setPage(1);
                      }}
                      placeholder="Tìm tên hàng"
                      className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500"
                    />
                  </td>
                  <td className="px-4 py-2" />
                  <td className="px-4 py-2" />
                  <td className="px-4 py-2" />
                </tr>

                {visibleProducts.map(product => {
                  const isCurrent = product.id === currentRow?.id;
                  const price = draftPrices[product.id] ?? product.salePrice;
                  return (
                    <tr
                      key={product.id}
                      className={`transition-colors hover:bg-slate-50 ${
                        isCurrent ? 'bg-indigo-50/70' : 'bg-white'
                      }`}
                    >
                      <td className="px-4 py-3 text-slate-700">{product.sku}</td>
                      <td className="px-4 py-3 text-slate-800">{product.name}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                        {formatMoney(product.importPrice)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                        {formatMoney(product.importPrice)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          value={formatMoney(price)}
                          onChange={event => handlePriceChange(product, event.target.value)}
                          className="h-9 w-full rounded-lg border border-slate-300 px-3 text-right tabular-nums text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-slate-700">
              Hiển thị{' '}
              <span className="tabular-nums">
                {filteredProducts.length === 0 ? 0 : (page - 1) * ITEMS_PER_PAGE + 1} -{' '}
                {Math.min(page * ITEMS_PER_PAGE, filteredProducts.length)}
              </span>{' '}
              trong <span className="tabular-nums">{filteredProducts.length}</span> hàng hóa
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                disabled={page === 1}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex h-9 min-w-12 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm tabular-nums text-slate-800">
                {page}
              </div>
              <button
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                disabled={page === totalPages}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4 rotate-180" />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </main>
      </div>

      {mode === 'modal' && (
        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-5 py-3">
          <div className="text-sm text-slate-600">
            Giá áp dụng cho hàng hiện tại:{' '}
            <span className="text-slate-900 tabular-nums">{formatMoney(activePrice)}đ</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="h-10 rounded-lg border border-slate-300 px-4 text-sm text-slate-700 transition-colors hover:bg-slate-50"
            >
              Bỏ qua
            </button>
            <button
              onClick={() => {
                onApplyPrice(activePrice);
                onClose();
              }}
              className="h-10 rounded-lg bg-indigo-600 px-5 text-sm text-white transition-colors hover:bg-indigo-700"
            >
              Áp dụng
            </button>
          </div>
        </div>
      )}

      {showCreatePriceListModal && (
        <div
          className="fixed inset-x-0 bottom-0 top-0 z-modal flex items-start justify-center overflow-y-auto bg-slate-950/45 px-4 py-5"
          onClick={closeCreatePriceListModal}
        >
          <div
            className="flex max-h-[calc(100vh-8.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-center justify-between px-7 py-5">
              <h3 className="text-xl font-bold text-slate-900">Tạo bảng giá</h3>
              <button
                onClick={closeCreatePriceListModal}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                aria-label="Đóng tạo bảng giá"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-slate-200 px-7">
              <div className="flex gap-8">
                {[
                  ['info', 'Thông tin'],
                  ['scope', 'Phạm vi áp dụng'],
                ].map(([tab, label]) => (
                  <button
                    key={tab}
                    onClick={() => setCreatePriceListTab(tab as PriceListModalTab)}
                    className={`border-b-2 px-0 pb-3 text-sm transition-colors ${
                      createPriceListTab === tab
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-7 py-5">
              {createPriceListTab === 'info' ? (
                <div className="space-y-5">
                  <div>
                    <label className="mb-2 block text-sm text-slate-800">Tên bảng giá</label>
                    <input
                      value={newPriceListName}
                      onChange={event => setNewPriceListName(event.target.value)}
                      autoFocus
                      placeholder="Nhập tên bảng giá"
                      className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>

                  <section className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-900">Hiệu lực</h4>
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    </div>
                    <div className="grid gap-4 lg:grid-cols-[6rem_1fr] lg:items-center">
                      <span className="text-sm text-slate-700">Hiệu lực</span>
                      <div className="flex flex-col gap-3 md:flex-row md:items-center">
                        <label className="relative flex-1">
                          <input
                            type="datetime-local"
                            value={newPriceListFrom}
                            onChange={event => setNewPriceListFrom(event.target.value)}
                            className="h-10 w-full rounded-lg border border-slate-300 px-3 pr-16 text-sm text-slate-800 outline-none focus:border-indigo-500"
                          />
                          <Calendar className="pointer-events-none absolute right-9 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Clock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        </label>
                        <span className="text-sm text-slate-700">đến</span>
                        <label className="relative flex-1">
                          <input
                            type="datetime-local"
                            value={newPriceListTo}
                            onChange={event => setNewPriceListTo(event.target.value)}
                            className="h-10 w-full rounded-lg border border-slate-300 px-3 pr-16 text-sm text-slate-800 outline-none focus:border-indigo-500"
                          />
                          <Calendar className="pointer-events-none absolute right-9 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Clock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        </label>
                      </div>

                      <span className="text-sm text-slate-700">Trạng thái</span>
                      <div className="flex flex-wrap gap-5">
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
                          <input
                            type="radio"
                            checked={newPriceListActive}
                            onChange={() => setNewPriceListActive(true)}
                            className="h-4 w-4 accent-indigo-600"
                          />
                          Áp dụng
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
                          <input
                            type="radio"
                            checked={!newPriceListActive}
                            onChange={() => setNewPriceListActive(false)}
                            className="h-4 w-4 accent-indigo-600"
                          />
                          Chưa áp dụng
                        </label>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">Công thức giá</h4>
                        <p className="mt-1 text-xs text-slate-500">
                          Tạo công thức dựa trên giá vốn, giá nhập hoặc giá bán ở các bảng giá khác
                        </p>
                      </div>
                      <ChevronDown className="mt-0.5 h-4 w-4 text-slate-500" />
                    </div>
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                      <span className="text-sm text-slate-700">Giá mới =</span>
                      <select
                        value={formulaBase}
                        onChange={event => setFormulaBase(event.target.value)}
                        className="h-10 min-w-64 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-500"
                      >
                        <option value="Giá vốn">Giá vốn</option>
                        <option value="Giá nhập cuối">Giá nhập cuối</option>
                        {priceLists.map(priceList => (
                          <option key={priceList} value={priceList}>
                            {priceList}
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setFormulaOperator('plus')}
                          className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
                            formulaOperator === 'plus'
                              ? 'border-indigo-300 bg-indigo-50 text-indigo-600'
                              : 'border-slate-300 text-slate-500 hover:bg-slate-50'
                          }`}
                          aria-label="Cộng vào công thức giá"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setFormulaOperator('minus')}
                          className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
                            formulaOperator === 'minus'
                              ? 'border-indigo-300 bg-indigo-50 text-indigo-600'
                              : 'border-slate-300 text-slate-500 hover:bg-slate-50'
                          }`}
                          aria-label="Trừ khỏi công thức giá"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex h-10 min-w-64 items-center rounded-lg border border-slate-300 bg-slate-50 px-3 focus-within:border-indigo-500 focus-within:bg-white">
                        <input
                          value={formulaValue}
                          onChange={event => setFormulaValue(event.target.value.replace(/[^\d]/g, ''))}
                          placeholder="0"
                          className="min-w-0 flex-1 bg-transparent text-right text-sm tabular-nums text-slate-800 outline-none placeholder:text-slate-500"
                        />
                        <button
                          onClick={() => setFormulaUnit('VND')}
                          className={`ml-3 text-xs ${
                            formulaUnit === 'VND' ? 'text-indigo-600' : 'text-slate-400'
                          }`}
                        >
                          VND
                        </button>
                        <button
                          onClick={() => setFormulaUnit('%')}
                          className={`ml-3 text-xs ${
                            formulaUnit === '%' ? 'text-indigo-600' : 'text-slate-400'
                          }`}
                        >
                          %
                        </button>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-900">
                        Khi thu ngân lên đơn với bảng giá này
                      </h4>
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    </div>
                    <div className="space-y-3">
                      <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-800">
                        <input
                          type="radio"
                          checked={cashierProductMode === 'allow_missing'}
                          onChange={() => setCashierProductMode('allow_missing')}
                          className="mt-0.5 h-4 w-4 accent-indigo-600"
                        />
                        Được phép thêm hàng hóa không có trong bảng giá
                      </label>
                      <label className="ml-6 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={warnWhenMissing}
                          onChange={event => setWarnWhenMissing(event.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                        />
                        Gửi cảnh báo khi thêm hàng hóa không có trong bảng giá
                      </label>
                      <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-800">
                        <input
                          type="radio"
                          checked={cashierProductMode === 'only_in_list'}
                          onChange={() => setCashierProductMode('only_in_list')}
                          className="mt-0.5 h-4 w-4 accent-indigo-600"
                        />
                        Chỉ được thêm hàng hóa có trong bảng giá này
                      </label>
                    </div>
                  </section>
                </div>
              ) : (
                <div className="space-y-5">
                  <section className="rounded-lg border border-slate-200 bg-white p-4">
                    <h4 className="text-sm font-bold text-slate-900">Chi nhánh</h4>
                    <div className="mt-4 space-y-4">
                      <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-800">
                        <input
                          type="radio"
                          checked={branchScope === 'all'}
                          onChange={() => setBranchScope('all')}
                          className="h-4 w-4 accent-indigo-600"
                        />
                        Toàn hệ thống
                      </label>
                      <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-800">
                        <input
                          type="radio"
                          checked={branchScope === 'specific'}
                          onChange={() => setBranchScope('specific')}
                          className="h-4 w-4 accent-indigo-600"
                        />
                        Chi nhánh cụ thể
                      </label>
                    </div>
                  </section>

                  <section className="rounded-lg border border-slate-200 bg-white p-4">
                    <h4 className="text-sm font-bold text-slate-900">Nhóm khách hàng</h4>
                    <div className="mt-4 space-y-4">
                      <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-800">
                        <input
                          type="radio"
                          checked={customerGroupScope === 'all'}
                          onChange={() => setCustomerGroupScope('all')}
                          className="h-4 w-4 accent-indigo-600"
                        />
                        Tất cả
                      </label>
                      <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-800">
                        <input
                          type="radio"
                          checked={customerGroupScope === 'specific'}
                          onChange={() => setCustomerGroupScope('specific')}
                          className="h-4 w-4 accent-indigo-600"
                        />
                        Nhóm khách hàng cụ thể
                      </label>
                    </div>
                  </section>

                  <section className="rounded-lg border border-slate-200 bg-white p-4">
                    <h4 className="text-sm font-bold text-slate-900">Người tạo giao dịch</h4>
                    <div className="mt-4 space-y-4">
                      <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-800">
                        <input
                          type="radio"
                          checked={creatorScope === 'all'}
                          onChange={() => setCreatorScope('all')}
                          className="h-4 w-4 accent-indigo-600"
                        />
                        Tất cả
                      </label>
                      <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-800">
                        <input
                          type="radio"
                          checked={creatorScope === 'specific'}
                          onChange={() => setCreatorScope('specific')}
                          className="h-4 w-4 accent-indigo-600"
                        />
                        Người tạo giao dịch cụ thể
                      </label>
                    </div>
                  </section>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-7 py-4">
              <button
                onClick={closeCreatePriceListModal}
                className="h-10 rounded-lg border border-slate-300 bg-white px-5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
              >
                Bỏ qua
              </button>
              <button
                onClick={handleSavePriceList}
                disabled={!canSavePriceList}
                className="h-10 rounded-lg bg-indigo-600 px-6 text-sm text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {showPriceInfoModal && (
        <div
          className="fixed inset-x-0 bottom-0 top-0 z-modal flex items-start justify-center overflow-y-auto bg-slate-950/45 px-4 py-5"
          onClick={() => setShowPriceInfoModal(false)}
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h3 className="text-lg font-bold text-slate-900">Thông tin thiết lập giá</h3>
              <button
                onClick={() => setShowPriceInfoModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                aria-label="Đóng thông tin thiết lập giá"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4 text-sm text-slate-700">
              <section>
                <h4 className="font-bold text-slate-900">Thiết lập giá dùng để làm gì</h4>
                <p className="mt-2">
                  Trang này dùng để xem danh sách hàng hóa và chỉnh giá bán theo bảng giá đang chọn.
                  Giá trong cột bảng giá có thể nhập trực tiếp cho từng hàng hóa.
                </p>
              </section>

              <section>
                <h4 className="font-bold text-slate-900">Thao tác chính</h4>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Tìm hàng hóa theo mã hoặc tên hàng.</li>
                  <li>Lọc theo bảng giá, nhóm hàng, tồn kho và điều kiện giá bán.</li>
                  <li>Bấm `Bảng giá` hoặc `Tạo mới` để mở popup tạo bảng giá mới.</li>
                  <li>Dùng `Import` và `Xuất file` cho thao tác dữ liệu bảng giá khi có luồng dữ liệu thật.</li>
                </ul>
              </section>

              <section>
                <h4 className="font-bold text-slate-900">Lưu ý nghiệp vụ</h4>
                <p className="mt-2">
                  Hiện phần tạo bảng giá mới đang lưu trong giao diện để kiểm tra layout và quy trình.
                  Muốn bảng giá lưu thật, áp dụng cho POS hoặc phân quyền theo phạm vi áp dụng thì cần
                  bổ sung schema/API trước.
                </p>
              </section>
            </div>

            <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-4">
              <button
                onClick={() => setShowPriceInfoModal(false)}
                className="h-10 rounded-lg bg-indigo-600 px-5 text-sm text-white transition-colors hover:bg-indigo-700"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (mode === 'page') {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-modal bg-slate-950/45 p-4" onClick={onClose}>
      <div
        className="mx-auto flex h-[calc(100vh-2rem)] max-w-7xl flex-col overflow-hidden rounded-lg bg-slate-50 shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        {content}
      </div>
    </div>
  );
};
