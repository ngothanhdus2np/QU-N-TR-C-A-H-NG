import React, { useState, useRef } from 'react';
import {
  ArrowLeft,
  Search,
  Plus,
  Minus,
  Trash2,
  Info,
  User,
  ChevronRight,
  ChevronLeft,
  History,
  Upload,
  FileCheck,
  FileMinus,
  FileText,
  FileX,
} from 'lucide-react';
import { POSProduct, InventoryTransaction } from '../../types';
import { InvoiceStatus } from '../../services/invoiceService';

export interface PurchaseItem {
  productId: string;
  quantity: number;
  price: number;
  name: string;
  discount: number;
}

export type PurchaseDiscountType = 'fixed' | 'percent';

interface GoodsPurchaseFormProps {
  showPurchaseForm: boolean;
  setShowPurchaseForm: (v: boolean) => void;
  purchaseItems: PurchaseItem[];
  purchaseSupplier: string;
  setPurchaseSupplier: (v: string) => void;
  purchaseNote: string;
  setPurchaseNote: (v: string) => void;
  purchaseDiscountValue: number;
  purchaseDiscountType: PurchaseDiscountType;
  setPurchaseDiscountValue: (v: number) => void;
  setPurchaseDiscountType: (v: PurchaseDiscountType) => void;
  products: POSProduct[];
  transactions: InventoryTransaction[];
  onClickFileInput: () => void;
  onOpenQuickAddProduct: () => void;
  onOpenQuickAddSupplier?: () => void;
  onAddProductToPurchase: (p: POSProduct) => void;
  onUpdatePurchaseItem: (
    id: string,
    updates: Partial<{ quantity: number; price: number; discount: number }>
  ) => void;
  onRemovePurchaseItem: (id: string) => void;
  onCompletePurchase: () => void;
  onSaveDraft?: () => void;
  onDownloadTemplate: () => void;
  staffLabel?: string;
  invoiceStatus?: InvoiceStatus;
  setInvoiceStatus?: (v: InvoiceStatus) => void;
  invoiceFile?: File | null;
  setInvoiceFile?: (f: File | null) => void;
}

export const GoodsPurchaseForm: React.FC<GoodsPurchaseFormProps> = ({
  showPurchaseForm,
  setShowPurchaseForm,
  purchaseItems,
  purchaseSupplier,
  setPurchaseSupplier,
  purchaseNote,
  setPurchaseNote,
  purchaseDiscountValue,
  purchaseDiscountType,
  setPurchaseDiscountValue,
  setPurchaseDiscountType,
  products,
  transactions,
  onClickFileInput,
  onOpenQuickAddProduct,
  onOpenQuickAddSupplier,
  onAddProductToPurchase,
  onUpdatePurchaseItem,
  onRemovePurchaseItem,
  onCompletePurchase,
  onSaveDraft,
  onDownloadTemplate,
  staffLabel = 'unknown',
  invoiceStatus = 'none',
  setInvoiceStatus,
  invoiceFile,
  setInvoiceFile,
}) => {
  const invoiceFileInputRef = useRef<HTMLInputElement>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [purchaseSearchTerm, setPurchaseSearchTerm] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const goodsTotal = purchaseItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const lineDiscountTotal = purchaseItems.reduce((sum, item) => sum + item.discount, 0);
  const beforeBillDiscount = Math.max(0, goodsTotal - lineDiscountTotal);
  const billDiscountAmount =
    purchaseDiscountType === 'percent'
      ? Math.min(beforeBillDiscount, Math.round((beforeBillDiscount * purchaseDiscountValue) / 100))
      : Math.min(beforeBillDiscount, purchaseDiscountValue);
  const payableAmount = Math.max(0, beforeBillDiscount - billDiscountAmount);

  return (
    <div className="h-full flex flex-col -m-6 bg-[#f0f2f5]">
      {showPurchaseForm ? (
        <div className="flex h-screen overflow-hidden">
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
            {/* Purchase Header */}
            <div className="bg-white border-b px-4 py-2 flex items-center gap-4 z-10">
              <button
                onClick={() => setShowPurchaseForm(false)}
                className="p-2 hover:bg-slate-100 rounded-full"
              >
                <ArrowLeft className="h-5 w-5 text-slate-600" />
              </button>
              <h1 className="text-xl font-bold whitespace-nowrap">Phiếu nhập hàng</h1>

              <div className="flex-1 max-w-2xl relative">
                <div
                  className={`flex items-center bg-white border ${searchFocused ? 'border-indigo-500 shadow-[0_0_0_2px_rgba(99,102,241,0.1)]' : 'border-slate-200'} rounded-md px-3 py-1.5 transition-all`}
                >
                  <Search className="h-4 w-4 text-slate-400 mr-2" />
                  <input
                    className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-slate-400"
                    placeholder="Tìm hàng hóa theo mã hoặc tên (F3)"
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                    value={purchaseSearchTerm}
                    onChange={e => setPurchaseSearchTerm(e.target.value)}
                  />
                  <div className="flex items-center gap-1.5 ml-2 border-l pl-2 border-slate-100">
                    <Plus
                      className="h-4 w-4 text-slate-400 cursor-pointer hover:text-indigo-600"
                      onClick={onOpenQuickAddProduct}
                    />
                  </div>
                </div>

                {purchaseSearchTerm && searchFocused && (
                  <div className="absolute top-full left-0 right-0 bg-white border shadow-xl rounded-b-lg mt-1 z-50 max-h-[400px] overflow-y-auto">
                    {products
                      .filter(
                        p =>
                          p.name.toLowerCase().includes(purchaseSearchTerm.toLowerCase()) ||
                          p.sku.toLowerCase().includes(purchaseSearchTerm.toLowerCase())
                      )
                      .map(p => (
                        <div
                          key={p.id}
                          onMouseDown={e => {
                            e.preventDefault();
                            onAddProductToPurchase(p);
                            setPurchaseSearchTerm('');
                          }}
                          className="p-3 hover:bg-indigo-50 cursor-pointer flex justify-between items-center border-b last:border-0"
                        >
                          <div>
                            <div className="text-sm font-normal text-slate-800">{p.name}</div>
                            <div className="text-xs text-slate-500">
                              {p.sku} | Tồn:{' '}
                              <span className="font-normal text-indigo-600">{p.stock}</span>
                            </div>
                          </div>
                          <div className="text-sm font-normal text-slate-900">
                            {p.importPrice.toLocaleString()}đ
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Purchase Table */}
            <div className="flex-1 overflow-auto bg-white relative">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-[#f0f7ff] sticky top-0 z-10">
                  <tr className="border-b">
                    <th className="px-3 py-2 text-center font-semibold text-slate-700 w-10 border-r"></th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700 w-12 border-r">
                      STT
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700 w-32 border-r">
                      Mã hàng
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700 border-r">
                      Tên hàng
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700 w-24 border-r">
                      ĐVT
                    </th>
                    <th className="px-3 py-2 text-center font-semibold text-slate-700 w-28 border-r">
                      Số lượng
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-700 w-32 border-r">
                      Đơn giá
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-700 w-28 border-r">
                      Giảm giá
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-700 w-32">
                      Thành tiền
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-20 text-center">
                        <div className="flex flex-col items-center justify-center space-y-4">
                          <h3 className="text-xl font-bold text-slate-800">
                            Thêm sản phẩm từ file excel
                          </h3>
                          <p className="text-sm text-slate-500">
                            (Tải về file mẫu:{' '}
                            <span
                              onClick={onDownloadTemplate}
                              className="text-indigo-600 cursor-pointer hover:underline"
                            >
                              Excel file
                            </span>
                            )
                          </p>
                          <button
                            onClick={onClickFileInput}
                            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-md font-normal transition-all hover:bg-indigo-700 shadow-md"
                          >
                            <Upload className="h-5 w-5" />
                            Chọn file dữ liệu
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    purchaseItems.map((item, idx) => (
                      <tr key={item.productId} className="border-b hover:bg-slate-50 group">
                        <td className="px-3 py-2 text-center border-r">
                          <button
                            onClick={() => onRemovePurchaseItem(item.productId)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                        <td className="px-3 py-2 text-slate-500 border-r text-center">{idx + 1}</td>
                        <td className="px-3 py-2 font-mono text-indigo-600 border-r">
                          {products.find(p => p.id === item.productId)?.sku}
                        </td>
                        <td className="px-3 py-2 font-normal border-r">{item.name}</td>
                        <td className="px-3 py-2 border-r">
                          {products.find(p => p.id === item.productId)?.unit || 'Cái'}
                        </td>
                        <td className="px-3 py-2 border-r">
                          <div className="flex items-center border rounded overflow-hidden">
                            <button
                              onClick={() =>
                                onUpdatePurchaseItem(item.productId, {
                                  quantity: Math.max(1, item.quantity - 1),
                                })
                              }
                              className="px-2 py-1 hover:bg-slate-100"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <input
                              type="number"
                              className="w-full text-center py-1 outline-none font-normal"
                              value={item.quantity}
                              onChange={e =>
                                onUpdatePurchaseItem(item.productId, {
                                  quantity: Number(e.target.value),
                                })
                              }
                            />
                            <button
                              onClick={() =>
                                onUpdatePurchaseItem(item.productId, {
                                  quantity: item.quantity + 1,
                                })
                              }
                              className="px-2 py-1 hover:bg-slate-100"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2 border-r">
                          <input
                            type="number"
                            className="w-full text-right outline-none bg-transparent font-normal"
                            value={item.price}
                            onChange={e =>
                              onUpdatePurchaseItem(item.productId, {
                                price: Number(e.target.value),
                              })
                            }
                          />
                        </td>
                        <td className="px-3 py-2 border-r">
                          <input
                            type="number"
                            className="w-full text-right outline-none bg-transparent"
                            value={item.discount}
                            onChange={e =>
                              onUpdatePurchaseItem(item.productId, {
                                discount: Number(e.target.value),
                              })
                            }
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-normal text-indigo-600">
                          {(item.quantity * item.price - item.discount).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Sidebar Toggle */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-20 bg-white border shadow-md rounded-full p-1.5 hover:bg-indigo-50 transition-all text-indigo-600"
            >
              {isSidebarOpen ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <ChevronLeft className="h-5 w-5" />
              )}
            </button>
          </div>

          {/* Right Sidebar */}
          <div
            className={`${isSidebarOpen ? 'w-[360px]' : 'w-0'} bg-white border-l transition-all duration-300 flex flex-col h-full overflow-hidden`}
          >
            <div className="p-4 flex-1 overflow-y-auto space-y-6">
              {/* User Info */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border rounded-lg cursor-pointer hover:bg-slate-100 transition-all">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                    <User className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-normal truncate max-w-[120px]">{staffLabel}</span>
                  <ChevronRight className="h-4 w-4 text-slate-400 ml-auto" />
                </div>
                <div className="text-right">
                  <div className="text-sm font-normal text-slate-700">
                    {new Date().toLocaleDateString('vi-VN')}
                  </div>
                  <div className="text-xs text-slate-500 font-normal">
                    {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>

              {/* Supplier */}
              <div className="relative">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      className="w-full pl-10 pr-4 py-2 border rounded-md text-sm outline-none focus:border-indigo-500 transition-all"
                      placeholder="Tìm nhà cung cấp"
                      value={purchaseSupplier}
                      onChange={e => setPurchaseSupplier(e.target.value)}
                    />
                  </div>
                  <button
                    onClick={onOpenQuickAddSupplier}
                    className="p-2 border rounded-md hover:bg-slate-50 text-indigo-600 transition-all"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Order Details */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-normal text-slate-600">Mã phiếu nhập</span>
                  <input
                    className="text-right text-sm border-b border-dashed outline-none focus:border-indigo-500 font-normal"
                    placeholder="Mã phiếu tự động"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-normal text-slate-600">Mã đặt hàng nhập</span>
                  <input
                    className="text-right text-sm border-b border-dashed outline-none focus:border-indigo-500 font-normal"
                    placeholder="Nhập mã đặt hàng"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-normal text-slate-600">Trạng thái</span>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-normal">
                    Phiếu tạm
                  </span>
                </div>
              </div>

              {/* Chứng từ đầu vào */}
              <div className="pt-4">
                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                    Chứng từ đầu vào
                  </p>
                  <div className="space-y-1.5">
                    {(
                      [
                        {
                          value: 'full',
                          label: 'Có hóa đơn đầy đủ',
                          Icon: FileCheck,
                          color: 'text-green-600',
                        },
                        {
                          value: 'partial',
                          label: 'Hóa đơn một phần',
                          Icon: FileMinus,
                          color: 'text-yellow-600',
                        },
                        {
                          value: 'memo_only',
                          label: 'Bảng kê không có HĐ',
                          Icon: FileText,
                          color: 'text-blue-600',
                        },
                        {
                          value: 'none',
                          label: 'Không có chứng từ',
                          Icon: FileX,
                          color: 'text-red-500',
                        },
                      ] as const
                    ).map(({ value, label, Icon, color }) => (
                      <label key={value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="invoiceStatus"
                          value={value}
                          checked={invoiceStatus === value}
                          onChange={() => setInvoiceStatus?.(value)}
                          className="accent-indigo-600"
                        />
                        <Icon className={`w-3.5 h-3.5 ${color}`} />
                        <span className="text-xs">{label}</span>
                      </label>
                    ))}
                  </div>
                  {invoiceStatus !== 'none' && (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => invoiceFileInputRef.current?.click()}
                        className="flex items-center gap-2 w-full px-3 py-2 text-xs border-2 border-dashed border-indigo-300 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-all"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {invoiceFile ? invoiceFile.name : 'Đính kèm file HĐ (PDF/XML/ảnh)'}
                      </button>
                      <input
                        ref={invoiceFileInputRef}
                        type="file"
                        accept=".pdf,.xml,.jpg,.jpeg,.png"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) setInvoiceFile?.(file);
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t pt-6 space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5 text-sm font-normal text-slate-700">
                    Tổng tiền hàng <Info className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                  <span className="text-lg font-normal text-slate-900">
                    {goodsTotal.toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-normal text-slate-700">Giảm giá</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={purchaseDiscountType === 'percent' ? 100 : undefined}
                      className="text-right text-base font-normal bg-slate-50 border rounded px-3 py-1.5 w-32 outline-none focus:border-indigo-500 transition-all"
                      value={purchaseDiscountValue || ''}
                      onChange={e => {
                        const nextValue = Number(e.target.value) || 0;
                        setPurchaseDiscountValue(
                          purchaseDiscountType === 'percent'
                            ? Math.min(100, Math.max(0, nextValue))
                            : Math.max(0, nextValue)
                        );
                      }}
                      placeholder="0"
                    />
                    <div className="flex w-24 bg-slate-100 rounded-xl p-0.5">
                      <button
                        type="button"
                        onMouseDown={e => {
                          e.preventDefault();
                          setPurchaseDiscountType('fixed');
                        }}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-normal transition-all ${
                          purchaseDiscountType === 'fixed'
                            ? 'bg-white shadow-sm text-indigo-600'
                            : 'text-slate-400'
                        }`}
                      >
                        VNĐ
                      </button>
                      <button
                        type="button"
                        onMouseDown={e => {
                          e.preventDefault();
                          setPurchaseDiscountType('percent');
                        }}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-normal transition-all ${
                          purchaseDiscountType === 'percent'
                            ? 'bg-white shadow-sm text-indigo-600'
                            : 'text-slate-400'
                        }`}
                      >
                        %
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t mt-4">
                  <span className="text-sm font-normal text-slate-700">Cần trả nhà cung cấp</span>
                  <span className="text-xl font-normal text-indigo-600">
                    {payableAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="pt-4">
                <textarea
                  className="w-full p-3 border rounded-lg text-sm bg-slate-50 focus:bg-white focus:border-indigo-500 transition-all min-h-[100px] outline-none"
                  placeholder="Ghi chú"
                  value={purchaseNote}
                  onChange={e => setPurchaseNote(e.target.value)}
                />
              </div>
            </div>

            <div className="p-4 bg-white border-t mt-auto grid grid-cols-2 gap-3">
              <button
                onClick={onSaveDraft}
                disabled={!onSaveDraft}
                className="py-3 border-2 border-indigo-600 text-indigo-600 rounded-lg font-normal uppercase text-sm hover:bg-indigo-50 transition-all"
              >
                Lưu tạm
              </button>
              <button
                onClick={onCompletePurchase}
                className="py-3 bg-indigo-600 text-white rounded-lg font-normal uppercase text-sm hover:bg-indigo-700 shadow-md transition-all"
              >
                Hoàn thành
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Purchase History */
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center bg-slate-50/50">
            <h3 className="text-sm font-black uppercase flex items-center gap-2">
              <History className="h-4 w-4 text-indigo-500" /> Lịch sử nhập hàng
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f8fafc] border-b font-black text-[11px] uppercase text-slate-700">
                <tr>
                  <th className="p-4 text-left">Mã đơn</th>
                  <th className="p-4 text-left">Ngày nhập</th>
                  <th className="p-4 text-left">Nhà cung cấp</th>
                  <th className="p-4 text-right">Giá trị</th>
                  <th className="p-4 text-left">Chứng từ</th>
                  <th className="p-4 text-left">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {transactions
                  .filter(t => t.type === 'Import')
                  .map(t => {
                    const badges = {
                      full: { label: '✅ Đủ HĐ', cls: 'bg-green-100 text-green-700' },
                      partial: { label: '⚠️ Một phần', cls: 'bg-yellow-100 text-yellow-700' },
                      memo_only: { label: '📋 Bảng kê', cls: 'bg-blue-100 text-blue-700' },
                      none: { label: '🔴 Thiếu CT', cls: 'bg-red-100 text-red-600' },
                    };
                    const badge = badges[t.invoiceStatus as keyof typeof badges] ?? badges.none;
                    return (
                      <tr key={t.id} className="border-b transition-colors hover:bg-slate-50">
                        <td className="p-4 font-mono font-normal text-indigo-600">
                          {t.id.slice(0, 8)}
                        </td>
                        <td className="p-4 text-slate-500">
                          {new Date(t.date).toLocaleString('vi-VN')}
                        </td>
                        <td className="p-4 font-normal">{t.note?.split('từ ')[1] || '---'}</td>
                        <td className="p-4 text-right font-normal text-emerald-600">
                          {(
                            t.totalAmount ||
                            t.items.reduce((s, i) => s + i.quantity * (i.price || 0), 0)
                          ).toLocaleString()}
                          đ
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-normal ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="p-4 text-slate-400 text-xs italic">{t.note}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
