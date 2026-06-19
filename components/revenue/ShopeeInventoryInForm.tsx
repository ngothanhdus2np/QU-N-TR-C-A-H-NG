import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  ArrowLeft, ChevronLeft, ChevronRight, FileCheck, FileMinus, FileX,
  Info, Minus, Plus, Search, Trash2, User,
} from 'lucide-react';
import { ShopeeInventoryInRecord, ShopeeSourceItem, Supplier } from '../../types';
import SourceAddModal from './SourceAddModal';

interface PurchaseItem {
  sku: string;
  name: string;
  quantity: number;
  price: number;
  discount: number;
}

type DiscountType = 'fixed' | 'percent';
type InvoiceStatus = 'full' | 'partial' | 'none';

interface Props {
  shopeeSourceData: ShopeeSourceItem[];
  shopeeInventoryIn?: ShopeeInventoryInRecord[];
  suppliers?: Supplier[];
  onClose: () => void;
  onComplete: (records: Omit<ShopeeInventoryInRecord, 'id'>[]) => Promise<void>;
  onAddSku?: (item: ShopeeSourceItem) => Promise<void>;
}

const ShopeeInventoryInForm: React.FC<Props> = ({ shopeeSourceData, shopeeInventoryIn = [], suppliers = [], onClose, onComplete, onAddSku }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [supplier, setSupplier] = useState('');
  const [supplierFocused, setSupplierFocused] = useState(false);

  const filteredSuppliers = useMemo(() => {
    const active = suppliers.filter(s => s.status !== 'inactive');
    if (!supplier.trim()) return active.slice(0, 8);
    const q = supplier.toLowerCase();
    return active.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.code || '').toLowerCase().includes(q) ||
      (s.phone || '').includes(q)
    ).slice(0, 8);
  }, [suppliers, supplier]);
  const [note, setNote] = useState('');
  const [discountValue, setDiscountValue] = useState(0);
  const [discountType, setDiscountType] = useState<DiscountType>('fixed');
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatus>('none');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(new Date().toLocaleDateString('sv-SE'));

  // Tính mã phiếu tiếp theo: PNOL0001, PNOL0002...
  const nextOrderCode = useMemo(() => {
    const existingCodes = shopeeInventoryIn
      .map(r => r.purchaseOrderCode)
      .filter((c): c is string => !!c && c.startsWith('PNOL'));
    const maxNum = existingCodes.reduce((max, code) => {
      const num = parseInt(code.replace('PNOL', ''), 10);
      return isNaN(num) ? max : Math.max(max, num);
    }, 0);
    return `PNOL${String(maxNum + 1).padStart(4, '0')}`;
  }, [shopeeInventoryIn]);
  const [showAddSku, setShowAddSku] = useState(false);

  const filteredSKUs = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const q = searchTerm.toLowerCase();
    return shopeeSourceData.filter(s =>
      s.sku.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [shopeeSourceData, searchTerm]);

  const addItem = (source: ShopeeSourceItem) => {
    setItems(prev => {
      const exists = prev.find(i => i.sku === source.sku);
      if (exists) return prev.map(i => i.sku === source.sku ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { sku: source.sku, name: source.name, quantity: 1, price: source.importPrice, discount: 0 }];
    });
    setSearchTerm('');
  };

  const updateItem = (sku: string, updates: Partial<PurchaseItem>) =>
    setItems(prev => prev.map(i => i.sku === sku ? { ...i, ...updates } : i));

  const removeItem = (sku: string) => setItems(prev => prev.filter(i => i.sku !== sku));

  const goodsTotal = items.reduce((s, i) => s + i.quantity * i.price, 0);
  const lineDiscountTotal = items.reduce((s, i) => s + i.discount, 0);
  const beforeBillDiscount = Math.max(0, goodsTotal - lineDiscountTotal);
  const billDiscountAmount = discountType === 'percent'
    ? Math.min(beforeBillDiscount, Math.round(beforeBillDiscount * discountValue / 100))
    : Math.min(beforeBillDiscount, discountValue);
  const payableAmount = Math.max(0, beforeBillDiscount - billDiscountAmount);

  const handleComplete = async () => {
    if (items.length === 0) return;
    setSaving(true);
    try {
      const purchaseOrderId = crypto.randomUUID();
      await onComplete(items.map(i => ({
        date,
        sku: i.sku,
        quantity: i.quantity,
        importPrice: i.price,
        note: note || undefined,
        purchaseOrderId,
        purchaseOrderCode: nextOrderCode,
        supplierName: supplier || undefined,
      })));
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <>
    {showAddSku && (
      <SourceAddModal
        onClose={() => setShowAddSku(false)}
        onSave={async (item) => {
          await onAddSku?.(item);
          setShowAddSku(false);
          addItem(item);
        }}
      />
    )}
    <div className="flex h-full min-h-0 gap-3">
      {/* Main panel */}
      <div className="flex flex-1 min-w-0 min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {/* Header */}
        <div className="shrink-0 flex items-center gap-3 border-b border-slate-100 px-4 py-3">
          <button onClick={onClose} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Quay lại
          </button>
          <span className="text-slate-300">|</span>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-900">Phiếu nhập hàng</h2>

          {/* Search + Thêm SKU */}
          <div className="relative ml-4 flex flex-1 items-center gap-2">
            <div className={`flex flex-1 items-center rounded-xl border ${searchFocused ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200'} bg-slate-50 px-3 py-2 transition-colors`}>
              <Search className="h-4 w-4 text-slate-400 mr-2 shrink-0" />
              <input
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                placeholder="Tìm SKU hoặc tên sản phẩm..."
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          <button
              onClick={() => setShowAddSku(true)}
              className="shrink-0 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-indigo-600 hover:bg-indigo-50 transition-colors shadow-sm"
              title="Thêm SKU mới"
            >
              <Plus className="h-4 w-4" />
            </button>
            {searchFocused && searchTerm.trim() && (
              <div className="absolute top-full left-0 right-[44px] mt-1 z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                {filteredSKUs.length > 0 ? filteredSKUs.map(s => (
                  <div key={s.id} onMouseDown={e => { e.preventDefault(); addItem(s); }}
                    className="flex cursor-pointer items-center justify-between border-b border-slate-100 px-4 py-2.5 last:border-0 hover:bg-indigo-50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{s.name}</p>
                      <p className="text-xs text-slate-400">{s.sku}</p>
                    </div>
                    {s.importPrice > 0 && (
                      <span className="text-sm font-semibold text-rose-600">{s.importPrice.toLocaleString()}đ</span>
                    )}
                  </div>
                )) : (
                  <div className="px-4 py-6 text-center text-sm text-slate-400">Không tìm thấy SKU</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                <th className="w-10 px-3 py-3 border-r border-slate-100" />
                <th className="w-10 px-3 py-3 border-r border-slate-100 text-center">STT</th>
                <th className="w-32 px-3 py-3 border-r border-slate-100 text-left">Mã hàng</th>
                <th className="px-3 py-3 border-r border-slate-100 text-left">Tên hàng</th>
                <th className="w-28 px-3 py-3 border-r border-slate-100 text-center">Số lượng</th>
                <th className="w-32 px-3 py-3 border-r border-slate-100 text-right">Đơn giá</th>
                <th className="w-28 px-3 py-3 border-r border-slate-100 text-right">Giảm giá</th>
                <th className="w-32 px-3 py-3 text-right">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center">
                    <p className="text-base font-semibold text-slate-700">Tìm và thêm sản phẩm</p>
                    <p className="mt-1 text-sm text-slate-400">Dùng thanh tìm kiếm phía trên để thêm SKU vào phiếu nhập</p>
                  </td>
                </tr>
              ) : items.map((item, idx) => (
                <tr key={item.sku} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 border-r border-slate-100 text-center">
                    <button onClick={() => removeItem(item.sku)} className="p-1 rounded text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                  <td className="px-3 py-2 border-r border-slate-100 text-center text-xs text-slate-400">{idx + 1}</td>
                  <td className="px-3 py-2 border-r border-slate-100 text-xs text-indigo-600">{item.sku}</td>
                  <td className="px-3 py-2 border-r border-slate-100 text-sm text-slate-700">{item.name}</td>
                  <td className="px-3 py-2 border-r border-slate-100">
                    <div className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 overflow-hidden">
                      <button onClick={() => updateItem(item.sku, { quantity: Math.max(1, item.quantity - 1) })} className="px-2 py-1.5 hover:bg-slate-100"><Minus className="h-3 w-3" /></button>
                      <input type="number" className="w-12 text-center text-sm outline-none bg-transparent font-semibold" value={item.quantity} onChange={e => updateItem(item.sku, { quantity: Number(e.target.value) })} />
                      <button onClick={() => updateItem(item.sku, { quantity: item.quantity + 1 })} className="px-2 py-1.5 hover:bg-slate-100"><Plus className="h-3 w-3" /></button>
                    </div>
                  </td>
                  <td className="px-3 py-2 border-r border-slate-100">
                    <input type="number" className="w-full text-right text-sm outline-none bg-transparent tabular-nums" value={item.price} onChange={e => updateItem(item.sku, { price: Number(e.target.value) })} />
                  </td>
                  <td className="px-3 py-2 border-r border-slate-100">
                    <input type="number" className="w-full text-right text-sm outline-none bg-transparent tabular-nums" value={item.discount} onChange={e => updateItem(item.sku, { discount: Number(e.target.value) })} />
                  </td>
                  <td className="px-3 py-2 text-right text-sm font-semibold text-indigo-600 tabular-nums">
                    {(item.quantity * item.price - item.discount).toLocaleString()}đ
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sidebar toggle */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="self-center flex h-8 w-5 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-indigo-600 shadow-sm transition-colors shrink-0"
      >
        {isSidebarOpen ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>

      {/* Right sidebar */}
      {isSidebarOpen && (
        <div className="w-80 shrink-0 flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          {/* Header */}
          <div className="shrink-0 border-b border-slate-100 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center">
                <User className="h-4 w-4 text-indigo-600" />
              </div>
              <span className="text-sm font-semibold text-slate-700">Admin CFO</span>
            </div>
            <span className="text-xs font-semibold text-slate-600">
              {date.split('-').reverse().join('/')}
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            {/* Nhà cung cấp */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-indigo-400 bg-slate-50 focus:bg-white transition-colors"
                  placeholder="Tìm nhà cung cấp"
                  value={supplier}
                  onChange={e => setSupplier(e.target.value)}
                  onFocus={() => setSupplierFocused(true)}
                  onBlur={() => setTimeout(() => setSupplierFocused(false), 150)}
                />
                {supplierFocused && filteredSuppliers.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
                    {filteredSuppliers.map(s => (
                      <button key={s.id} type="button"
                        onMouseDown={e => { e.preventDefault(); setSupplier(s.name); setSupplierFocused(false); }}
                        className="flex w-full flex-col gap-0.5 border-b border-slate-100 px-3 py-2 text-left last:border-0 hover:bg-indigo-50 transition-colors"
                      >
                        <span className="text-sm font-semibold text-slate-800">{s.name}</span>
                        <span className="text-xs text-slate-400">
                          {[s.code, s.phone, s.group].filter(Boolean).join(' • ') || 'Nhà cung cấp'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-indigo-600 shrink-0">
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Mã phiếu + trạng thái */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Mã phiếu nhập</span>
                <span className="text-xs font-semibold text-indigo-600">{nextOrderCode}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Trạng thái</span>
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">Phiếu tạm</span>
              </div>
            </div>

            {/* Chứng từ */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-2xs font-semibold uppercase tracking-widest text-slate-400 mb-2">Chứng từ đầu vào</p>
              <div className="space-y-1.5">
                {([
                  { value: 'full', label: 'Có hóa đơn đầy đủ', Icon: FileCheck, color: 'text-emerald-600' },
                  { value: 'partial', label: 'Hóa đơn một phần', Icon: FileMinus, color: 'text-amber-600' },
                  { value: 'none', label: 'Không có chứng từ', Icon: FileX, color: 'text-rose-500' },
                ] as const).map(({ value, label, Icon, color }) => (
                  <label key={value} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="invoiceStatus" value={value} checked={invoiceStatus === value} onChange={() => setInvoiceStatus(value)} className="accent-indigo-600" />
                    <Icon className={`w-3.5 h-3.5 ${color}`} />
                    <span className="text-xs text-slate-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Tổng tiền */}
            <div className="space-y-3 border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  Tổng tiền hàng <Info className="h-3 w-3" />
                </div>
                <span className="text-sm font-semibold tabular-nums text-slate-900">{goodsTotal.toLocaleString()}đ</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500 shrink-0">Giảm giá</span>
                <div className="flex items-center gap-1.5">
                  <input type="number" min={0}
                    className="w-24 text-right text-sm rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 outline-none focus:border-indigo-400 tabular-nums"
                    value={discountValue || ''}
                    onChange={e => setDiscountValue(Number(e.target.value) || 0)}
                    placeholder="0"
                  />
                  <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs">
                    {(['fixed', 'percent'] as const).map(t => (
                      <button key={t} type="button" onMouseDown={e => { e.preventDefault(); setDiscountType(t); }}
                        className={`px-2 py-1 rounded-md transition-colors ${discountType === t ? 'bg-white shadow text-indigo-600 font-semibold' : 'text-slate-400'}`}
                      >{t === 'fixed' ? 'đ' : '%'}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-indigo-50 px-3 py-2">
                <span className="text-xs font-semibold text-indigo-700">Cần trả nhà cung cấp</span>
                <span className="text-base font-semibold text-indigo-700 tabular-nums">{payableAmount.toLocaleString()}đ</span>
              </div>
            </div>

            {/* Ghi chú */}
            <textarea
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-indigo-400 focus:bg-white transition-colors resize-none"
              rows={3}
              placeholder="Ghi chú..."
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>

          {/* Footer */}
          <div className="shrink-0 grid grid-cols-2 gap-2 border-t border-slate-100 p-3">
            <button className="rounded-xl border-2 border-indigo-600 py-2.5 text-xs font-semibold uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 transition-colors">
              Lưu tạm
            </button>
            <button onClick={handleComplete} disabled={items.length === 0 || saving}
              className="rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold uppercase tracking-widest text-white hover:bg-indigo-700 shadow transition-colors disabled:opacity-50"
            >
              {saving ? 'Đang lưu...' : 'Hoàn thành'}
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default ShopeeInventoryInForm;
