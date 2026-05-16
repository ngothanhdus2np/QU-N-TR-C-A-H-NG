import React from 'react';
import {
  ShopeeInventoryOutRecord, ShopeeSourceItem, ShopeeCostConfig,
} from '../../types';
import {
  Upload, TrendingUp, DollarSign, Plus, Pencil, Save, Trash2,
  Check, X, ArrowUpFromLine, ArrowDownToLine,
} from 'lucide-react';

interface ShopeeTotals {
  profitMargin: number;
  adsRatio: number;
  platformFeeRatio: number;
  paymentFeeRatio: number;
  freeshipExtraRatio: number;
  affiliateFeeRatio: number;
}

interface Props {
  shopeeInventoryOut: ShopeeInventoryOutRecord[];
  shopeeSourceData: ShopeeSourceItem[];
  shopeeCosts: ShopeeCostConfig | undefined;
  dailyAdsConfig: Record<string, number>;
  selectedAdsDate: string;
  setSelectedAdsDate: (date: string) => void;
  inventoryOutForm: Partial<ShopeeInventoryOutRecord>;
  setInventoryOutForm: (form: Partial<ShopeeInventoryOutRecord>) => void;
  editingInventoryOutId: string | null;
  setEditingInventoryOutId: (id: string | null) => void;
  deleteConfirmId: string | null;
  setDeleteConfirmId: (id: string | null) => void;
  clearAllConfirm: boolean;
  setClearAllConfirm: (v: boolean) => void;
  handleAddInventoryOut: () => void;
  handleEditInventoryOut: (item: ShopeeInventoryOutRecord) => void;
  handleRemoveInventoryOut: (id: string) => Promise<void>;
  handleClearAllInventoryOut: () => Promise<void>;
  handleShopeeFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDistributeAdsCost: (totalAds: number, date: string) => void;
  shopeeFileInputRef: React.RefObject<HTMLInputElement>;
  totalVariableCosts: number;
  formatNumber: (num: number) => string;
  dynamicTitle: string;
  shopeeTotals: ShopeeTotals;
  onUpdateShopeeCosts: ((costs: ShopeeCostConfig) => Promise<void>) | undefined;
}

const InventoryOutTab: React.FC<Props> = ({
  shopeeInventoryOut, shopeeSourceData, shopeeCosts, dailyAdsConfig,
  selectedAdsDate, setSelectedAdsDate,
  inventoryOutForm, setInventoryOutForm,
  editingInventoryOutId, setEditingInventoryOutId,
  deleteConfirmId, setDeleteConfirmId,
  clearAllConfirm, setClearAllConfirm,
  handleAddInventoryOut, handleEditInventoryOut, handleRemoveInventoryOut, handleClearAllInventoryOut,
  handleShopeeFileUpload, handleDistributeAdsCost,
  shopeeFileInputRef, totalVariableCosts, formatNumber, dynamicTitle, shopeeTotals, onUpdateShopeeCosts,
}) => {
  const localTodayStr = new Date().toLocaleDateString('sv-SE');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center border-dashed border-2 hover:border-rose-300 transition-all group cursor-pointer"
             onClick={() => shopeeFileInputRef.current?.click()}>
          <input type="file" ref={shopeeFileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleShopeeFileUpload} />
          <div className="w-10 h-10 bg-rose-50 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <Upload className="w-5 h-5 text-rose-600" />
          </div>
          <h4 className="text-[11px] font-black text-slate-900 uppercase">Tải file Shopee</h4>
          <p className="text-[8px] text-slate-400 font-normal uppercase mt-1 text-center">Tự động phân tích đơn hàng</p>
        </div>

        <div className="md:col-span-9 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="flex items-center gap-2 min-w-[150px]">
                <div className="p-2 bg-rose-100 rounded-lg text-rose-600"><TrendingUp className="w-4 h-4" /></div>
                <h4 className="text-[11px] font-black text-slate-900 uppercase">Quảng cáo ngày</h4>
              </div>
              <div className="flex-1 flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100 w-full">
                <input type="date" value={selectedAdsDate} onChange={(e) => setSelectedAdsDate(e.target.value)} className="bg-transparent border-none outline-none text-[11px] font-normal text-slate-600 w-32" />
                <div className="h-6 w-[1px] bg-slate-200"></div>
                <div className="flex-1 flex items-center gap-2">
                  <DollarSign className="w-3.5 h-3.5 text-rose-600" />
                  <input type="number" value={dailyAdsConfig[selectedAdsDate] || 0} onChange={(e) => handleDistributeAdsCost(Number(e.target.value), selectedAdsDate)} className="bg-transparent border-none outline-none text-slate-900 font-normal text-xs w-full" placeholder="Nhập tổng tiền QC của ngày..." />
                </div>
              </div>
            </div>
          </div>

          <div className={`bg-white p-5 rounded-2xl border ${editingInventoryOutId ? 'border-indigo-500 shadow-indigo-100 ring-2 ring-indigo-500/20' : 'border-slate-200'} shadow-sm transition-all`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 ${editingInventoryOutId ? 'bg-indigo-600' : 'bg-slate-900'} rounded-lg text-white shadow-md transition-colors`}>
                  {editingInventoryOutId ? <Pencil className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                </div>
                <div>
                  <h4 className="text-[11px] font-black text-slate-900 uppercase">{editingInventoryOutId ? 'Cập nhật đơn hàng' : 'Nhập đơn hàng mới'}</h4>
                  {editingInventoryOutId && (
                    <p className="text-[8px] font-normal text-indigo-600 uppercase tracking-widest mt-0.5">Đang sửa bản ghi: {shopeeInventoryOut.find(r => r.id === editingInventoryOutId)?.trackingNumber}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {editingInventoryOutId && (
                  <button
                    onClick={() => {
                      setEditingInventoryOutId(null);
                      setInventoryOutForm({ date: localTodayStr, status: 'OK', platform: 'Shopee 2', quantity: 1, salePrice: 0, customerPaid: 0, platformFee: 0, paymentFee: 0, freeshipExtra: 0, affiliateFee: 0, shippingUnit: 'GHN', profitStatus: 'LÃI 2' });
                    }}
                    className="text-[9px] font-normal text-slate-400 hover:text-rose-600 uppercase tracking-widest px-3 py-1 bg-slate-100 rounded-full transition-colors"
                  >
                    Hủy sửa
                  </button>
                )}
                <span className="text-[9px] font-normal text-slate-400 uppercase italic">* Nhập nhanh đơn hàng lẻ</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-normal text-slate-400 uppercase ml-1">Ngày gửi</label>
                  <input type="date" value={inventoryOutForm.date} onChange={e => setInventoryOutForm({...inventoryOutForm, date: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[10px] font-normal focus:outline-none focus:ring-1 focus:ring-rose-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-normal text-slate-400 uppercase ml-1">Mã Vận Đơn</label>
                  <input type="text" placeholder="Mã vận đơn..." value={inventoryOutForm.orderId || ''} onChange={e => setInventoryOutForm({...inventoryOutForm, orderId: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[10px] font-normal focus:outline-none focus:ring-1 focus:ring-rose-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-normal text-slate-400 uppercase ml-1">SKU</label>
                  <select
                    value={inventoryOutForm.sku || ''}
                    onChange={e => {
                      const sku = e.target.value;
                      const skuData = shopeeSourceData.find(s => s.sku === sku);
                      setInventoryOutForm({ ...inventoryOutForm, sku, salePrice: skuData?.salePrice || 0, customerPaid: skuData?.salePrice || 0 });
                    }}
                    className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[10px] font-normal focus:outline-none focus:ring-1 focus:ring-rose-500"
                  >
                    <option value="">Chọn SKU</option>
                    {shopeeSourceData.map(s => <option key={s.id} value={s.sku}>{s.sku}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-normal text-slate-400 uppercase ml-1">Số lượng</label>
                  <input type="number" value={inventoryOutForm.quantity || 0} onChange={e => setInventoryOutForm({...inventoryOutForm, quantity: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[10px] font-normal focus:outline-none focus:ring-1 focus:ring-rose-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-normal text-slate-400 uppercase ml-1">Giá bán</label>
                  <input type="number" value={inventoryOutForm.salePrice || 0} onChange={e => setInventoryOutForm({...inventoryOutForm, salePrice: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[10px] font-normal focus:outline-none focus:ring-1 focus:ring-rose-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-normal text-slate-400 uppercase ml-1">Khách trả</label>
                  <input type="number" value={inventoryOutForm.customerPaid || 0} onChange={e => setInventoryOutForm({...inventoryOutForm, customerPaid: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[10px] font-normal focus:outline-none focus:ring-1 focus:ring-rose-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-normal text-slate-400 uppercase ml-1">Phí sàn (đ)</label>
                  <input type="number" value={inventoryOutForm.platformFee ?? 0} onChange={e => setInventoryOutForm({...inventoryOutForm, platformFee: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[10px] font-normal focus:outline-none focus:ring-1 focus:ring-rose-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-normal text-slate-400 uppercase ml-1">Phí thanh toán (đ)</label>
                  <input type="number" value={inventoryOutForm.paymentFee ?? 0} onChange={e => setInventoryOutForm({...inventoryOutForm, paymentFee: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[10px] font-normal focus:outline-none focus:ring-1 focus:ring-rose-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-normal text-slate-400 uppercase ml-1">Freeship Extra (đ)</label>
                  <input type="number" value={inventoryOutForm.freeshipExtra ?? 0} onChange={e => setInventoryOutForm({...inventoryOutForm, freeshipExtra: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[10px] font-normal focus:outline-none focus:ring-1 focus:ring-rose-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-normal text-slate-400 uppercase ml-1">Phí Affiliate (đ)</label>
                  <input type="number" value={inventoryOutForm.affiliateFee ?? 0} onChange={e => setInventoryOutForm({...inventoryOutForm, affiliateFee: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[10px] font-normal focus:outline-none focus:ring-1 focus:ring-rose-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-normal text-slate-400 uppercase ml-1">Nền tảng</label>
                  <select value={inventoryOutForm.platform || 'Shopee 2'} onChange={e => setInventoryOutForm({...inventoryOutForm, platform: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[10px] font-normal focus:outline-none focus:ring-1 focus:ring-rose-500">
                    <option value="Shopee 1">Shopee 1</option>
                    <option value="Shopee 2">Shopee 2</option>
                    <option value="Lazada">Lazada</option>
                    <option value="TikTok">TikTok</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-normal text-slate-400 uppercase ml-1">ĐVVC</label>
                  <select value={inventoryOutForm.shippingUnit || 'GHN'} onChange={e => setInventoryOutForm({...inventoryOutForm, shippingUnit: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[10px] font-normal focus:outline-none focus:ring-1 focus:ring-rose-500">
                    <option value="GHN">GHN</option>
                    <option value="SPX">SPX</option>
                    <option value="GHTK">GHTK</option>
                    <option value="J&T">J&T</option>
                  </select>
                </div>
                <div className="lg:col-span-3 space-y-1">
                  <label className="text-[9px] font-normal text-slate-400 uppercase ml-1">Địa chỉ (Tỉnh/Thành)</label>
                  <input type="text" placeholder="VD: ĐÀ NẴNG" value={inventoryOutForm.address || ''} onChange={e => setInventoryOutForm({...inventoryOutForm, address: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[10px] font-normal focus:outline-none focus:ring-1 focus:ring-rose-500" />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleAddInventoryOut}
                    className={`w-full ${editingInventoryOutId ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-rose-600 hover:bg-rose-700'} text-white py-2 rounded-lg font-normal text-[9px] uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2`}
                  >
                    <Save className="w-3.5 h-3.5" /> {editingInventoryOutId ? 'Cập nhật' : 'Ghi nhận'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-0 border border-slate-200 shadow-xl overflow-hidden bg-white rounded-2xl">
        <div className="overflow-x-auto overflow-y-auto max-h-[800px] no-scrollbar relative flex flex-col">
          <table className="w-full text-left border-collapse min-w-[2200px] text-[11px] relative">
            <thead className="sticky top-0 z-30">
              <tr className="bg-rose-600 text-white font-black tabular-nums border-b border-rose-500">
                <td colSpan={8} className="p-4 border-r border-white/20">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <ArrowUpFromLine className="w-5 h-5" />
                      <h3 className="text-lg font-black uppercase tracking-tighter">THEO DÕI ĐƠN HÀNG {dynamicTitle}</h3>
                    </div>
                    {clearAllConfirm ? (
                      <div className="flex items-center gap-2">
                        <button onClick={handleClearAllInventoryOut} className="bg-rose-500 hover:bg-rose-600 text-white text-[10px] px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all shadow-lg animate-pulse">
                          <Check className="w-3.5 h-3.5" /> XÁC NHẬN XOÁ HẾT
                        </button>
                        <button onClick={() => setClearAllConfirm(false)} className="bg-slate-500 hover:bg-slate-600 text-white text-[10px] px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all">
                          <X className="w-3.5 h-3.5" /> HUỶ
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setClearAllConfirm(true)} className="bg-white/10 hover:bg-white/30 text-[10px] px-4 py-2 rounded-xl flex items-center gap-2 transition-all border border-white/20 group cursor-pointer">
                        <Trash2 className="w-4 h-4 text-white" />
                        <span>XOÁ TOÀN BỘ</span>
                      </button>
                    )}
                  </div>
                </td>
                <td className="p-2 border-r border-white/20 text-center">{shopeeInventoryOut.reduce((sum, i) => sum + i.quantity, 0)}</td>
                <td className="p-2 border-r border-white/20 text-right">{formatNumber(shopeeInventoryOut.reduce((sum, i) => sum + i.salePrice, 0))} đ</td>
                <td className="p-2 border-r border-white/20 text-right">{formatNumber(shopeeInventoryOut.reduce((sum, i) => sum + i.customerPaid, 0))} đ</td>
                <td className="p-2 border-r border-white/20 text-right">{formatNumber(shopeeInventoryOut.reduce((sum, i) => sum + i.platformFee, 0))} đ</td>
                <td className="p-2 border-r border-white/20 text-right">{formatNumber(shopeeInventoryOut.reduce((sum, i) => sum + i.paymentFee, 0))} đ</td>
                <td className="p-2 border-r border-white/20 text-right">{formatNumber(shopeeInventoryOut.reduce((sum, i) => sum + i.freeshipExtra, 0))} đ</td>
                <td className="p-2 border-r border-white/20 text-right">{formatNumber(shopeeInventoryOut.reduce((sum, i) => sum + i.affiliateFee, 0))} đ</td>
                <td className="p-2 border-r border-white/20 text-right">{formatNumber(shopeeInventoryOut.reduce((sum, i) => sum + (i.salePrice - i.platformFee - i.paymentFee - i.freeshipExtra - i.affiliateFee), 0))} đ</td>
                <td className="p-2 border-r border-white/20 text-right">{formatNumber(shopeeInventoryOut.reduce((sum, i) => sum + i.handlingFee, 0))} đ</td>
                <td className="p-2 border-r border-white/20 text-right">{formatNumber(shopeeInventoryOut.reduce((sum, i) => sum + i.adsCost, 0))} đ</td>
                <td className="p-2 border-r border-white/20 text-right">{formatNumber(shopeeInventoryOut.reduce((sum, i) => sum + i.adsTax, 0))} đ</td>
                <td className="p-2 border-r border-white/20 text-right">{formatNumber(shopeeInventoryOut.reduce((sum, i) => sum + i.personalIncomeTax, 0))} đ</td>
                <td className="p-2 border-r border-white/20 text-right">{formatNumber(shopeeInventoryOut.reduce((sum, i) => sum + i.netProfit, 0))} đ</td>
                <td className="p-2 border-r border-white/20"></td>
                <td className="p-2 border-r border-white/20"></td>
                <td className="p-2 border-r border-white/20"></td>
                <td className="p-2 border-r border-white/20"></td>
                <td className="p-2 border-r border-white/20"></td>
              </tr>
              <tr className="bg-white border-b border-slate-200 font-bold text-rose-500 tabular-nums text-[10px]">
                <td className="p-2 border-r border-slate-200 bg-slate-50"></td>
                <td className="p-2 border-r border-slate-200"></td>
                <td className="p-2 border-r border-slate-200"></td>
                <td className="p-2 border-r border-slate-200"></td>
                <td className="p-2 border-r border-slate-200"></td>
                <td className="p-2 border-r border-slate-200"></td>
                <td className="p-2 border-r border-slate-200"></td>
                <td className="p-2 border-r border-slate-200"></td>
                <td className="p-2 border-r border-slate-200"></td>
                <td className="p-2 border-r border-slate-200"></td>
                <td className="p-2 border-r border-slate-200"></td>
                <td className="p-2 border-r border-slate-200 text-center">{shopeeTotals.platformFeeRatio.toFixed(1)}%</td>
                <td className="p-2 border-r border-slate-200 text-center bg-blue-50 border-2 border-blue-500">{shopeeTotals.paymentFeeRatio.toFixed(1)}%</td>
                <td className="p-2 border-r border-slate-200 text-center">{shopeeTotals.freeshipExtraRatio.toFixed(1)}%</td>
                <td className="p-2 border-r border-slate-200 text-center">{shopeeTotals.affiliateFeeRatio.toFixed(1)}%</td>
                <td className="p-2 border-r border-slate-200 text-center">{(100 - ((shopeeCosts?.platformFeePercent || 0) + (shopeeCosts?.paymentFeePercent || 0) + (shopeeCosts?.freeshipExtraPercent || 0) + (shopeeCosts?.affiliateFeePercent || 0))).toFixed(1)}%</td>
                <td className="p-2 border-r border-slate-200 text-center">{formatNumber(totalVariableCosts)} đ</td>
                <td className="p-2 border-r border-slate-200 text-center">{shopeeTotals.adsRatio.toFixed(1)}%</td>
                <td className="p-2 border-r border-slate-200 text-center">
                  <input type="number" value={shopeeCosts?.adsTaxPercent || 0} onChange={e => onUpdateShopeeCosts?.({...shopeeCosts!, adsTaxPercent: Number(e.target.value)})} className="w-8 bg-slate-50 text-center focus:outline-none focus:ring-1 focus:ring-rose-500 rounded" />%
                </td>
                <td className="p-2 border-r border-slate-200 text-center">
                  <input type="number" value={shopeeCosts?.taxPercent || 0} onChange={e => onUpdateShopeeCosts?.({...shopeeCosts!, taxPercent: Number(e.target.value)})} className="w-8 bg-slate-50 text-center focus:outline-none focus:ring-1 focus:ring-rose-500 rounded" />%
                </td>
                <td className="p-2 border-r border-slate-200 text-center">{shopeeTotals.profitMargin.toFixed(1)}%</td>
                <td className="p-2 border-r border-slate-200"></td>
                <td className="p-2 border-r border-slate-200"></td>
                <td className="p-2 border-r border-slate-200"></td>
                <td className="p-2 border-r border-slate-200"></td>
              </tr>
              <tr className="bg-yellow-400 text-black font-bold border-b border-slate-300 sticky top-[calc(100%)]">
                <th className="p-3 border-r border-slate-300 w-12 text-center">STT</th>
                <th className="p-3 border-r border-slate-300 w-40 text-center">Tình Trạng</th>
                <th className="p-3 border-r border-slate-300 w-32 text-center">Ngày gửi</th>
                <th className="p-3 border-r border-slate-300 w-32 text-center">Số đơn/ngày</th>
                <th className="p-3 border-r border-slate-300 w-32 text-center">Nền tảng</th>
                <th className="p-3 border-r border-slate-300 w-48 text-center">Mã Vận Đơn</th>
                <th className="p-3 border-r border-slate-300 w-40 text-center">SKU Biến Thể</th>
                <th className="p-3 border-r border-slate-300 w-60 text-center">Tên Sản Phẩm</th>
                <th className="p-3 border-r border-slate-300 w-20 text-center">Số lượng</th>
                <th className="p-3 border-r border-slate-300 w-32 text-center">Giá trị hàng</th>
                <th className="p-3 border-r border-slate-300 w-32 text-center">Khách Thanh Toán</th>
                <th className="p-3 border-r border-slate-300 w-32 text-center">Phí Sàn</th>
                <th className="p-3 border-r border-slate-300 w-32 text-center">Phí thanh toán</th>
                <th className="p-3 border-r border-slate-300 w-32 text-center">Freeship Extra</th>
                <th className="p-3 border-r border-slate-300 w-32 text-center">Phi Affiliate</th>
                <th className="p-3 border-r border-slate-300 w-32 text-center">Sàn Thanh Toán</th>
                <th className="p-3 border-r border-slate-300 w-32 text-center">Phí vận hành</th>
                <th className="p-3 border-r border-slate-300 w-32 text-center">Quảng cáo</th>
                <th className="p-3 border-r border-slate-300 w-32 text-center">Thuế QC</th>
                <th className="p-3 border-r border-slate-300 w-32 text-center">Thuế TNCN</th>
                <th className="p-3 border-r border-slate-300 w-32 text-center">Lợi Nhuận</th>
                <th className="p-3 border-r border-slate-300 w-40 text-center">Địa chỉ</th>
                <th className="p-3 border-r border-slate-300 w-32 text-center">ĐVVC</th>
                <th className="p-3 border-r border-slate-300 w-32 text-center">LÃI/LỖ</th>
                <th className="p-3 border-r border-slate-300 w-32 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 tabular-nums">
              {shopeeInventoryOut.length > 0 ? shopeeInventoryOut.map((item, idx) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-all group border-b border-slate-200">
                  <td className="p-2 border-r border-slate-200 text-center font-normal text-slate-500">{idx + 1}</td>
                  <td className="p-2 border-r border-slate-200">
                    <div className="flex items-center gap-1 bg-emerald-700 text-white px-2 py-1 rounded-md text-[10px] font-normal cursor-pointer">
                      <span>{item.status === 'OK' ? 'OK' : item.status}</span>
                      <ArrowDownToLine className="w-3 h-3 rotate-180" />
                    </div>
                  </td>
                  <td className="p-2 border-r border-slate-200 text-center">{(item.shipDate || item.date).split('-').reverse().join('/')}</td>
                  <td className="p-2 border-r border-slate-200 text-center font-normal">{item.dailyOrderIndex || 1}</td>
                  <td className="p-2 border-r border-slate-200">
                    <div className="flex items-center justify-between bg-orange-200 text-orange-800 px-2 py-1 rounded-md text-[10px] font-normal cursor-pointer">
                      <span>{item.platform || 'Shopee 2'}</span>
                      <ArrowDownToLine className="w-3 h-3 rotate-180" />
                    </div>
                  </td>
                  <td className="p-2 border-r border-slate-200 font-mono text-indigo-600">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-normal text-slate-500 uppercase tracking-tighter text-indigo-400">Vận Đơn</span>
                      <span className="truncate max-w-[150px]">{item.trackingNumber || '-'}</span>
                    </div>
                  </td>
                  <td className="p-2 border-r border-slate-200">
                    <div className="flex items-center justify-between bg-slate-100 text-slate-800 px-2 py-1 rounded-md text-[10px] font-normal cursor-pointer">
                      <span>{item.sku}</span>
                      <ArrowDownToLine className="w-3 h-3 rotate-180" />
                    </div>
                  </td>
                  <td className="p-2 border-r border-slate-200 text-slate-500 truncate max-w-[200px]">{item.productName || '-'}</td>
                  <td className="p-2 border-r border-slate-200 text-center font-normal">{item.quantity}</td>
                  <td className="p-2 border-r border-slate-200 text-right font-normal">{formatNumber(item.salePrice)} đ</td>
                  <td className="p-2 border-r border-slate-200 text-right font-normal">{formatNumber(item.customerPaid)} đ</td>
                  <td className="p-2 border-r border-slate-200 text-right text-slate-500">{formatNumber(item.platformFee)} đ</td>
                  <td className="p-2 border-r border-slate-200 text-right text-slate-500">{formatNumber(item.paymentFee)} đ</td>
                  <td className="p-2 border-r border-slate-200 text-right text-slate-500">{formatNumber(item.freeshipExtra)} đ</td>
                  <td className="p-2 border-r border-slate-200 text-right text-slate-500">{formatNumber(item.affiliateFee)} đ</td>
                  <td className="p-2 border-r border-slate-200 text-right font-normal text-slate-700 bg-slate-50">{formatNumber(item.salePrice - item.platformFee - item.paymentFee - item.freeshipExtra - item.affiliateFee)} đ</td>
                  <td className="p-2 border-r border-slate-200 text-right text-slate-500">{formatNumber(item.handlingFee)} đ</td>
                  <td className="p-2 border-r border-slate-200 text-right text-slate-500">{formatNumber(item.adsCost)} đ</td>
                  <td className="p-2 border-r border-slate-200 text-right text-slate-500">{formatNumber(item.adsTax)} đ</td>
                  <td className="p-2 border-r border-slate-200 text-right text-slate-500">{formatNumber(item.personalIncomeTax)} đ</td>
                  <td className={`p-2 border-r border-slate-200 text-right font-normal ${item.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{formatNumber(item.netProfit)} đ</td>
                  <td className="p-2 border-r border-slate-200 text-slate-500 uppercase">{item.address || '-'}</td>
                  <td className="p-2 border-r border-slate-200">
                    <div className="flex items-center justify-between bg-slate-100 text-slate-800 px-2 py-1 rounded-md text-[10px] font-normal cursor-pointer">
                      <span>{item.shippingUnit || 'GHN'}</span>
                      <ArrowDownToLine className="w-3 h-3 rotate-180" />
                    </div>
                  </td>
                  <td className="p-2 border-r border-slate-200">
                    <div className={`flex items-center justify-between px-2 py-1 rounded-md text-[10px] font-normal cursor-pointer ${item.netProfit >= 0 ? 'bg-emerald-700 text-white' : 'bg-rose-700 text-white'}`}>
                      <span>{item.profitStatus || (item.netProfit >= 0 ? 'LÃI 2' : 'LỖ 1')}</span>
                      <ArrowDownToLine className="w-3 h-3 rotate-180" />
                    </div>
                  </td>
                  <td className="p-2 border-r border-slate-200">
                    <div className="flex items-center justify-center gap-2">
                      {deleteConfirmId === item.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleRemoveInventoryOut(item.id)} className="p-1 bg-rose-600 text-white rounded hover:bg-rose-700 transition-colors shadow-sm" title="Xác nhận xoá"><Check className="w-3 h-3" /></button>
                          <button onClick={() => setDeleteConfirmId(null)} className="p-1 bg-slate-400 text-white rounded hover:bg-slate-500 transition-colors shadow-sm" title="Huỷ"><X className="w-3 h-3" /></button>
                        </div>
                      ) : (
                        <>
                          <button onClick={() => handleEditInventoryOut(item)} className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-600 hover:text-white transition-all shadow-sm cursor-pointer" title="Sửa"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setDeleteConfirmId(item.id)} className="p-1.5 bg-rose-50 text-rose-600 rounded-md hover:bg-rose-600 hover:text-white transition-all shadow-sm cursor-pointer" title="Xoá"><Trash2 className="w-3.5 h-3.5" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={24} className="p-20 text-center text-slate-400 font-normal uppercase tracking-widest">Chưa có dữ liệu xuất kho</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InventoryOutTab;
