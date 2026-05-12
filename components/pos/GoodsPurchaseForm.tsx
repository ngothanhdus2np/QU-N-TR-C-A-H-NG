import React, { useState } from 'react';
import {
  ArrowLeft, Search, Plus, Minus, Trash2, Info,
  User, ChevronRight, ChevronLeft, History, Upload,
} from 'lucide-react';
import { POSProduct, InventoryTransaction } from '../../types';

export interface PurchaseItem {
  productId: string;
  quantity: number;
  price: number;
  name: string;
  discount: number;
}

interface GoodsPurchaseFormProps {
  showPurchaseForm: boolean;
  setShowPurchaseForm: (v: boolean) => void;
  purchaseItems: PurchaseItem[];
  purchaseSupplier: string;
  setPurchaseSupplier: (v: string) => void;
  purchaseNote: string;
  setPurchaseNote: (v: string) => void;
  products: POSProduct[];
  transactions: InventoryTransaction[];
  onClickFileInput: () => void;
  onOpenQuickAddProduct: () => void;
  onOpenQuickAddSupplier?: () => void;
  onAddProductToPurchase: (p: POSProduct) => void;
  onUpdatePurchaseItem: (id: string, updates: Partial<{ quantity: number; price: number; discount: number }>) => void;
  onRemovePurchaseItem: (id: string) => void;
  onCompletePurchase: () => void;
  onSaveDraft?: () => void;
  onDownloadTemplate: () => void;
  staffLabel?: string;
}

export const GoodsPurchaseForm: React.FC<GoodsPurchaseFormProps> = ({
  showPurchaseForm,
  setShowPurchaseForm,
  purchaseItems,
  purchaseSupplier,
  setPurchaseSupplier,
  purchaseNote,
  setPurchaseNote,
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
}) => {
  const [searchFocused, setSearchFocused] = useState(false);
  const [purchaseSearchTerm, setPurchaseSearchTerm] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="h-full flex flex-col -m-6 bg-[#f0f2f5]">
      {showPurchaseForm ? (
        <div className="flex h-screen overflow-hidden">
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
            {/* Purchase Header */}
            <div className="bg-white border-b px-4 py-2 flex items-center gap-4 z-10">
              <button onClick={() => setShowPurchaseForm(false)} className="p-2 hover:bg-slate-100 rounded-full">
                <ArrowLeft className="h-5 w-5 text-slate-600" />
              </button>
              <h1 className="text-xl font-bold whitespace-nowrap">Nhập hàng</h1>

              <div className="flex-1 max-w-2xl relative">
                <div className={`flex items-center bg-white border ${searchFocused ? 'border-indigo-500 shadow-[0_0_0_2px_rgba(99,102,241,0.1)]' : 'border-slate-200'} rounded-md px-3 py-1.5 transition-all`}>
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
                      .filter(p => p.name.toLowerCase().includes(purchaseSearchTerm.toLowerCase()) || p.sku.toLowerCase().includes(purchaseSearchTerm.toLowerCase()))
                      .map(p => (
                        <div
                          key={p.id}
                          onMouseDown={(e) => { e.preventDefault(); onAddProductToPurchase(p); setPurchaseSearchTerm(''); }}
                          className="p-3 hover:bg-indigo-50 cursor-pointer flex justify-between items-center border-b last:border-0"
                        >
                          <div>
                            <div className="text-sm font-bold text-slate-800">{p.name}</div>
                            <div className="text-xs text-slate-500">{p.sku} | Tồn: <span className="font-bold text-indigo-600">{p.stock}</span></div>
                          </div>
                          <div className="text-sm font-black text-slate-900">{p.importPrice.toLocaleString()}đ</div>
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
                    <th className="px-3 py-2 text-left font-semibold text-slate-700 w-12 border-r">STT</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700 w-32 border-r">Mã hàng</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700 border-r">Tên hàng</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700 w-24 border-r">ĐVT</th>
                    <th className="px-3 py-2 text-center font-semibold text-slate-700 w-28 border-r">Số lượng</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-700 w-32 border-r">Đơn giá</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-700 w-28 border-r">Giảm giá</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-700 w-32">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-20 text-center">
                        <div className="flex flex-col items-center justify-center space-y-4">
                          <h3 className="text-xl font-bold text-slate-800">Thêm sản phẩm từ file excel</h3>
                          <p className="text-sm text-slate-500">
                            (Tải về file mẫu: <span onClick={onDownloadTemplate} className="text-indigo-600 cursor-pointer hover:underline">Excel file</span>)
                          </p>
                          <button
                            onClick={onClickFileInput}
                            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-md font-bold transition-all hover:bg-indigo-700 shadow-md"
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
                        <td className="px-3 py-2 font-mono text-indigo-600 border-r">{products.find(p => p.id === item.productId)?.sku}</td>
                        <td className="px-3 py-2 font-medium border-r">{item.name}</td>
                        <td className="px-3 py-2 border-r">{products.find(p => p.id === item.productId)?.unit || 'Cái'}</td>
                        <td className="px-3 py-2 border-r">
                          <div className="flex items-center border rounded overflow-hidden">
                            <button onClick={() => onUpdatePurchaseItem(item.productId, { quantity: Math.max(1, item.quantity - 1) })} className="px-2 py-1 hover:bg-slate-100">
                              <Minus className="h-3 w-3" />
                            </button>
                            <input
                              type="number"
                              className="w-full text-center py-1 outline-none font-bold"
                              value={item.quantity}
                              onChange={e => onUpdatePurchaseItem(item.productId, { quantity: Number(e.target.value) })}
                            />
                            <button onClick={() => onUpdatePurchaseItem(item.productId, { quantity: item.quantity + 1 })} className="px-2 py-1 hover:bg-slate-100">
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2 border-r">
                          <input
                            type="number"
                            className="w-full text-right outline-none bg-transparent font-bold"
                            value={item.price}
                            onChange={e => onUpdatePurchaseItem(item.productId, { price: Number(e.target.value) })}
                          />
                        </td>
                        <td className="px-3 py-2 border-r">
                          <input
                            type="number"
                            className="w-full text-right outline-none bg-transparent"
                            value={item.discount}
                            onChange={e => onUpdatePurchaseItem(item.productId, { discount: Number(e.target.value) })}
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-black text-indigo-600">
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
              {isSidebarOpen ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            </button>
          </div>

          {/* Right Sidebar */}
          <div className={`${isSidebarOpen ? 'w-[360px]' : 'w-0'} bg-white border-l transition-all duration-300 flex flex-col h-full overflow-hidden`}>
            <div className="p-4 flex-1 overflow-y-auto space-y-6">
              {/* User Info */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border rounded-lg cursor-pointer hover:bg-slate-100 transition-all">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                    <User className="h-5 w-5" />
                  </div>
	                  <span className="text-sm font-bold truncate max-w-[120px]">{staffLabel}</span>
                  <ChevronRight className="h-4 w-4 text-slate-400 ml-auto" />
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-slate-700">{new Date().toLocaleDateString('vi-VN')}</div>
                  <div className="text-xs text-slate-500 font-medium">{new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div>
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
                  <span className="text-sm font-medium text-slate-600">Mã phiếu nhập</span>
                  <input className="text-right text-sm border-b border-dashed outline-none focus:border-indigo-500 font-medium" placeholder="Mã phiếu tự động" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-600">Mã đặt hàng nhập</span>
                  <input className="text-right text-sm border-b border-dashed outline-none focus:border-indigo-500 font-medium" placeholder="Nhập mã đặt hàng" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-600">Trạng thái</span>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">Phiếu tạm</span>
                </div>
              </div>

              <div className="border-t pt-6 space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
                    Tổng tiền hàng <Info className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                  <span className="text-lg font-black text-slate-900">
                    {purchaseItems.reduce((s, i) => s + i.quantity * i.price, 0).toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-700">Chiết khấu phiếu</span>
                  <input
                    type="number"
                    className="text-right text-base font-bold bg-slate-50 border rounded px-3 py-1.5 w-32 outline-none focus:border-indigo-500 transition-all"
                    defaultValue={0}
                  />
                </div>

                <div className="flex justify-between items-center pt-2 border-t mt-4">
                  <span className="text-sm font-bold text-slate-700">Cần trả nhà cung cấp</span>
                  <span className="text-xl font-black text-indigo-600">
                    {purchaseItems.reduce((s, i) => s + (i.quantity * i.price - i.discount), 0).toLocaleString()}
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
                className="py-3 border-2 border-indigo-600 text-indigo-600 rounded-lg font-black uppercase text-sm hover:bg-indigo-50 transition-all"
              >
                Lưu tạm
              </button>
              <button
                onClick={onCompletePurchase}
                className="py-3 bg-indigo-600 text-white rounded-lg font-black uppercase text-sm hover:bg-indigo-700 shadow-md transition-all"
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
                  <th className="p-4 text-left">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {transactions.filter(t => t.type === 'Import').map(t => (
                  <tr key={t.id} className="border-b transition-colors hover:bg-slate-50">
                    <td className="p-4 font-mono font-bold text-indigo-600">{t.id.slice(0, 8)}</td>
                    <td className="p-4 text-slate-500">{new Date(t.date).toLocaleString('vi-VN')}</td>
                    <td className="p-4 font-bold">{t.note?.split('từ ')[1] || '---'}</td>
                    <td className="p-4 text-right font-black text-emerald-600">
	                      {(
	                        t.totalAmount ||
	                        t.items.reduce((s, i) => s + i.quantity * (i.price || 0), 0)
	                      ).toLocaleString()}đ
                    </td>
                    <td className="p-4 text-slate-400 text-xs italic">{t.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
