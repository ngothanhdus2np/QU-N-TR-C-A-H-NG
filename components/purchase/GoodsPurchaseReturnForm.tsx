import React, { useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Info,
  Minus,
  Plus,
  Search,
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import { InventoryTransaction, POSProduct, Supplier } from '../../types';
import { PurchaseDiscountType, PurchaseItem } from '../pos/GoodsPurchaseForm';

interface GoodsPurchaseReturnFormProps {
  showReturnForm: boolean;
  setShowReturnForm: (value: boolean) => void;
  returnItems: PurchaseItem[];
  returnSupplier: string;
  setReturnSupplier: (value: string) => void;
  returnNote: string;
  setReturnNote: (value: string) => void;
  returnDiscountValue: number;
  returnDiscountType: PurchaseDiscountType;
  setReturnDiscountValue: (value: number) => void;
  setReturnDiscountType: (value: PurchaseDiscountType) => void;
  supplierPaidAmount: number;
  setSupplierPaidAmount: (value: number) => void;
  applySupplierDebt: boolean;
  setApplySupplierDebt: (value: boolean) => void;
  products: POSProduct[];
  suppliers: Supplier[];
  transactions: InventoryTransaction[];
  onClickFileInput: () => void;
  onOpenQuickAddProduct: () => void;
  onOpenQuickAddSupplier?: () => void;
  onAddProductToReturn: (product: POSProduct) => void;
  onUpdateReturnItem: (
    id: string,
    updates: Partial<{ quantity: number; price: number; discount: number }>
  ) => void;
  onRemoveReturnItem: (id: string) => void;
  returnReferenceId: string;
  setReturnReferenceId: (value: string) => void;
  onCompleteReturn: () => void;
  onSaveDraft: () => void;
  onDownloadTemplate: () => void;
  staffLabel?: string;
}

const GoodsPurchaseReturnForm: React.FC<GoodsPurchaseReturnFormProps> = ({
  showReturnForm,
  setShowReturnForm,
  returnItems,
  returnSupplier,
  setReturnSupplier,
  returnNote,
  setReturnNote,
  returnDiscountValue,
  returnDiscountType,
  setReturnDiscountValue,
  setReturnDiscountType,
  supplierPaidAmount,
  setSupplierPaidAmount,
  applySupplierDebt,
  setApplySupplierDebt,
  products,
  suppliers,
  onClickFileInput,
  onOpenQuickAddProduct,
  onOpenQuickAddSupplier,
  onAddProductToReturn,
  onUpdateReturnItem,
  onRemoveReturnItem,
  returnReferenceId,
  setReturnReferenceId,
  onCompleteReturn,
  onSaveDraft,
  onDownloadTemplate,
  staffLabel = 'unknown',
}) => {
  const [searchFocused, setSearchFocused] = useState(false);
  const [returnSearchTerm, setReturnSearchTerm] = useState('');
  const [supplierSearchFocused, setSupplierSearchFocused] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const goodsTotal = returnItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const lineDiscountTotal = returnItems.reduce((sum, item) => sum + item.discount, 0);
  const beforeBillDiscount = Math.max(0, goodsTotal - lineDiscountTotal);
  const billDiscountAmount =
    returnDiscountType === 'percent'
      ? Math.min(beforeBillDiscount, Math.round((beforeBillDiscount * returnDiscountValue) / 100))
      : Math.min(beforeBillDiscount, returnDiscountValue);
  const supplierMustPay = Math.max(0, beforeBillDiscount - billDiscountAmount);
  const remainingDebt = Math.max(0, supplierMustPay - supplierPaidAmount);
  const supplierSearchTerm = returnSupplier.trim().toLowerCase();
  const filteredSuppliers = supplierSearchTerm
    ? suppliers
        .filter(supplier => {
          const haystack = [
            supplier.name,
            supplier.code,
            supplier.phone,
            supplier.email,
            supplier.group,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return haystack.includes(supplierSearchTerm);
        })
        .slice(0, 8)
    : suppliers.filter(supplier => supplier.status !== 'inactive').slice(0, 8);

  if (!showReturnForm) return null;

  return (
    <div className="h-full flex flex-col -m-6 bg-[#f8fafc]">
      <div className="flex h-screen overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
          <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-4 z-10">
            <button
              onClick={() => setShowReturnForm(false)}
              className="p-2 rounded-full text-slate-600 hover:bg-slate-100"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-semibold text-slate-900 whitespace-nowrap">Trả hàng nhập</h1>

            <div className="flex-1 max-w-2xl relative">
              <div
                className={`flex items-center bg-white border ${searchFocused ? 'border-indigo-500 shadow-[0_0_0_2px_rgba(99,102,241,0.1)]' : 'border-slate-200'} rounded-xl px-3 py-1.5 transition-all`}
              >
                <Search className="h-4 w-4 text-slate-400 mr-2" />
                <input
                  className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-slate-400"
                  placeholder="Tìm hàng hóa theo mã hoặc tên (F3)"
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  value={returnSearchTerm}
                  onChange={event => setReturnSearchTerm(event.target.value)}
                />
                <div className="flex items-center gap-1.5 ml-2 border-l pl-2 border-slate-100">
                  <Plus
                    className="h-4 w-4 text-slate-400 cursor-pointer hover:text-indigo-600"
                    onClick={onOpenQuickAddProduct}
                  />
                </div>
              </div>

              {returnSearchTerm && searchFocused && (
                <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 shadow-xl rounded-b-xl mt-1 z-50 max-h-[400px] overflow-y-auto">
                  {products
                    .filter(
                      product =>
                        !product.isParent &&
                        (product.name.toLowerCase().includes(returnSearchTerm.toLowerCase()) ||
                          product.sku.toLowerCase().includes(returnSearchTerm.toLowerCase()))
                    )
                    .map(product => (
                      <div
                        key={product.id}
                        onMouseDown={event => {
                          event.preventDefault();
                          onAddProductToReturn(product);
                          setReturnSearchTerm('');
                        }}
                        className="p-3 hover:bg-indigo-50 cursor-pointer flex justify-between items-center border-b border-slate-100 last:border-0"
                      >
                        <div>
                          <div className="text-sm font-normal text-slate-800">{product.name}</div>
                          <div className="text-xs text-slate-500">
                            {product.sku} | Tồn:{' '}
                            <span className="font-normal text-indigo-600">{product.stock}</span>
                          </div>
                        </div>
                        <div className="text-sm font-normal text-slate-900">
                          {product.importPrice.toLocaleString()}đ
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-white relative">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr className="border-b border-slate-200">
                  <th className="px-3 py-3 text-center font-normal text-xs uppercase tracking-widest text-slate-700 w-10 border-r border-slate-100"></th>
                  <th className="px-3 py-3 text-left font-normal text-xs uppercase tracking-widest text-slate-700 w-12 border-r border-slate-100">
                    STT
                  </th>
                  <th className="px-3 py-3 text-left font-normal text-xs uppercase tracking-widest text-slate-700 w-32 border-r border-slate-100">
                    Mã hàng
                  </th>
                  <th className="px-3 py-3 text-left font-normal text-xs uppercase tracking-widest text-slate-700 border-r border-slate-100">
                    Tên hàng
                  </th>
                  <th className="px-3 py-3 text-left font-normal text-xs uppercase tracking-widest text-slate-700 w-24 border-r border-slate-100">
                    ĐVT
                  </th>
                  <th className="px-3 py-3 text-center font-normal text-xs uppercase tracking-widest text-slate-700 w-28 border-r border-slate-100">
                    Số lượng
                  </th>
                  <th className="px-3 py-3 text-right font-normal text-xs uppercase tracking-widest text-slate-700 w-32 border-r border-slate-100">
                    Giá nhập
                  </th>
                  <th className="px-3 py-3 text-right font-normal text-xs uppercase tracking-widest text-slate-700 w-32">
                    Thành tiền
                  </th>
                </tr>
              </thead>
              <tbody>
                {returnItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-20 text-center">
                      <div className="flex flex-col items-center justify-center space-y-4">
                        <h3 className="text-xl font-semibold text-slate-800">Thêm sản phẩm từ file excel</h3>
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
                          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-normal transition-all hover:bg-indigo-700 shadow-sm"
                        >
                          <Upload className="h-5 w-5" />
                          Chọn file dữ liệu
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  returnItems.map((item, index) => {
                    const product = products.find(current => current.id === item.productId);
                    return (
                      <tr key={item.productId} className="border-b border-slate-100 hover:bg-slate-50 group">
                        <td className="px-3 py-2 text-center border-r border-slate-50">
                          <button
                            onClick={() => onRemoveReturnItem(item.productId)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                        <td className="px-3 py-2 text-slate-500 border-r border-slate-50 text-center">
                          {index + 1}
                        </td>
                        <td className="px-3 py-2 text-indigo-600 border-r border-slate-50">
                          {product?.sku}
                        </td>
                        <td className="px-3 py-2 font-normal text-slate-800 border-r border-slate-50">
                          {item.name}
                          {product && (
                            <div className="text-xs text-slate-400 mt-0.5">Tồn hiện tại: {product.stock}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 border-r border-slate-50">{product?.unit || 'Cái'}</td>
                        <td className="px-3 py-2 border-r border-slate-50">
                          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
                            <button
                              onClick={() =>
                                onUpdateReturnItem(item.productId, {
                                  quantity: Math.max(1, item.quantity - 1),
                                })
                              }
                              className="px-2 py-1 hover:bg-slate-100"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={product?.stock}
                              className="w-full text-center py-1 outline-none font-normal"
                              value={item.quantity}
                              onChange={event =>
                                onUpdateReturnItem(item.productId, {
                                  quantity: Math.max(1, Number(event.target.value) || 1),
                                })
                              }
                            />
                            <button
                              onClick={() =>
                                onUpdateReturnItem(item.productId, {
                                  quantity: Math.min(product?.stock ?? item.quantity + 1, item.quantity + 1),
                                })
                              }
                              className="px-2 py-1 hover:bg-slate-100"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2 border-r border-slate-50">
                          <input
                            type="number"
                            className="w-full text-right outline-none bg-transparent font-normal"
                            value={item.price}
                            onChange={event =>
                              onUpdateReturnItem(item.productId, {
                                price: Math.max(0, Number(event.target.value) || 0),
                              })
                            }
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-normal text-indigo-600">
                          {(item.quantity * item.price - item.discount).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-20 bg-white border border-slate-200 shadow-md rounded-full p-1.5 hover:bg-indigo-50 transition-all text-indigo-600"
          >
            {isSidebarOpen ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>
        </div>

        <div
          className={`${isSidebarOpen ? 'w-[360px]' : 'w-0'} bg-white border-l border-slate-200 transition-all duration-300 flex flex-col h-full overflow-hidden`}
        >
          <div className="p-4 flex-1 overflow-y-auto space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
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

            <div className="relative">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 transition-all"
                    placeholder="Tìm nhà cung cấp"
                    value={returnSupplier}
                    onChange={event => setReturnSupplier(event.target.value)}
                    onFocus={() => setSupplierSearchFocused(true)}
                    onBlur={() => setSupplierSearchFocused(false)}
                  />
                  {supplierSearchFocused && filteredSuppliers.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                      {filteredSuppliers.map(supplier => (
                        <button
                          key={supplier.id}
                          type="button"
                          onMouseDown={event => {
                            event.preventDefault();
                            setReturnSupplier(supplier.name);
                            setSupplierSearchFocused(false);
                          }}
                          className="flex w-full flex-col gap-0.5 border-b border-slate-100 px-3 py-2 text-left last:border-0 hover:bg-indigo-50"
                        >
                          <span className="text-sm font-normal text-slate-800">
                            {supplier.name}
                          </span>
                          <span className="text-xs text-slate-500">
                            {[supplier.code, supplier.phone, supplier.group]
                              .filter(Boolean)
                              .join(' • ') || 'Nhà cung cấp'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={onOpenQuickAddSupplier}
                  className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-indigo-600 transition-all"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-normal text-slate-600">Mã trả hàng nhập</span>
                <input
                  className="text-right text-sm border-b border-dashed border-slate-300 outline-none focus:border-indigo-500 font-normal"
                  placeholder="Mã phiếu tự động"
                  value={returnReferenceId}
                  onChange={event => setReturnReferenceId(event.target.value)}
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-normal text-slate-600">Trạng thái</span>
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-normal">
                  Đang trả hàng
                </span>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-6 space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5 text-sm font-normal text-slate-700">
                  Tổng tiền hàng <Info className="h-3.5 w-3.5 text-slate-400" />
                </div>
                <span className="text-lg font-normal text-slate-900">{goodsTotal.toLocaleString()}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm font-normal text-slate-700">Giảm giá</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={returnDiscountType === 'percent' ? 100 : undefined}
                    className="text-right text-base font-normal bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 w-32 outline-none focus:border-indigo-500 transition-all"
                    value={returnDiscountValue || ''}
                    onChange={event => {
                      const nextValue = Number(event.target.value) || 0;
                      setReturnDiscountValue(
                        returnDiscountType === 'percent'
                          ? Math.min(100, Math.max(0, nextValue))
                          : Math.max(0, nextValue)
                      );
                    }}
                    placeholder="0"
                  />
                  <div className="flex w-24 bg-slate-100 rounded-xl p-0.5">
                    <button
                      type="button"
                      onMouseDown={event => {
                        event.preventDefault();
                        setReturnDiscountType('fixed');
                      }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-normal transition-all ${
                        returnDiscountType === 'fixed'
                          ? 'bg-white shadow-sm text-indigo-600'
                          : 'text-slate-400'
                      }`}
                    >
                      VNĐ
                    </button>
                    <button
                      type="button"
                      onMouseDown={event => {
                        event.preventDefault();
                        setReturnDiscountType('percent');
                      }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-normal transition-all ${
                        returnDiscountType === 'percent'
                          ? 'bg-white shadow-sm text-indigo-600'
                          : 'text-slate-400'
                      }`}
                    >
                      %
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <span className="text-sm font-normal text-slate-700">Nhà cung cấp cần trả</span>
                <span className="text-xl font-normal text-indigo-600">{supplierMustPay.toLocaleString()}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm font-normal text-slate-700">Tiền nhà cung cấp trả</span>
                <input
                  type="number"
                  min={0}
                  className="text-right text-base font-normal bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 w-32 outline-none focus:border-indigo-500 transition-all"
                  value={supplierPaidAmount || ''}
                  onChange={event => setSupplierPaidAmount(Math.max(0, Number(event.target.value) || 0))}
                  placeholder="0"
                />
              </div>

              <label className="flex items-center justify-between gap-3 text-sm text-slate-700 cursor-pointer">
                <span>Tính vào công nợ</span>
                <input
                  type="checkbox"
                  checked={applySupplierDebt}
                  onChange={event => setApplySupplierDebt(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
              </label>
              {applySupplierDebt && remainingDebt > 0 && (
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Còn ghi nhận công nợ</span>
                  <span className="font-normal text-slate-700">{remainingDebt.toLocaleString()}đ</span>
                </div>
              )}
            </div>

            <div className="pt-4">
              <textarea
                className="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white focus:border-indigo-500 transition-all min-h-[120px] outline-none"
                placeholder="Ghi chú"
                value={returnNote}
                onChange={event => setReturnNote(event.target.value)}
              />
            </div>
          </div>

          <div className="p-4 border-t border-slate-100 bg-white flex gap-3">
            <button
              onClick={onSaveDraft}
              className="flex-1 py-3 rounded-xl border border-indigo-200 text-indigo-600 font-normal hover:bg-indigo-50 transition-all"
            >
              Lưu tạm
            </button>
            <button
              onClick={onCompleteReturn}
              className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-normal hover:bg-indigo-700 transition-all shadow-sm"
            >
              Hoàn thành
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoodsPurchaseReturnForm;
