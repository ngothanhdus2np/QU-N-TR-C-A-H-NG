import React from 'react';
import {
  AlertCircle,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  Edit2,
  Gift,
  Info,
  Percent,
  Plus,
  Tag,
  Ticket,
  Trash2,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { GiftTier, PromotionPlan } from '../../types';
import { SingleDatePicker } from '../shared';

interface PromotionSetupPanelProps {
  promotions: PromotionPlan[];
  editingId: string | null;
  formData: Partial<PromotionPlan>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<PromotionPlan>>>;
  setEditingId: React.Dispatch<React.SetStateAction<string | null>>;
  suggestedTarget: number;
  formatCurrency: (val: number | undefined) => string;
  parseCurrency: (val: string) => number;
  handleApplySuggestion: () => void;
  handleSave: () => void;
  handleEdit: (promotion: PromotionPlan) => void;
  handleDelete: (id: string) => void;
  addGiftTier: () => void;
  updateGiftTier: (id: string, updates: Partial<GiftTier>) => void;
  removeGiftTier: (id: string) => void;
}

const createEmptyPromotionForm = (): Partial<PromotionPlan> => ({
  name: '',
  startDate: new Date().toISOString().split('T')[0],
  endDate: new Date().toISOString().split('T')[0],
  type: 'Gift',
  budget: 0,
  targetRevenue: 0,
  description: '',
  status: 'Planned',
  giftTiers: [],
});

const getStatusBadge = (status: PromotionPlan['status']) => {
  switch (status) {
    case 'Planned':
      return <span className="flex items-center gap-1 text-xs font-normal text-blue-600 bg-blue-50 px-2 py-1 rounded-full"><Clock className="w-3 h-3" /> Dự kiến</span>;
    case 'Active':
      return <span className="flex items-center gap-1 text-xs font-normal text-green-600 bg-green-50 px-2 py-1 rounded-full"><AlertCircle className="w-3 h-3" /> Đang chạy</span>;
    case 'Completed':
      return <span className="flex items-center gap-1 text-xs font-normal text-slate-600 bg-slate-100 px-2 py-1 rounded-full"><CheckCircle2 className="w-3 h-3" /> Hoàn thành</span>;
    case 'Cancelled':
      return <span className="flex items-center gap-1 text-xs font-normal text-rose-600 bg-rose-50 px-2 py-1 rounded-full"><XCircle className="w-3 h-3" /> Đã hủy</span>;
  }
};

const getTypeIcon = (type: PromotionPlan['type']) => {
  switch (type) {
    case 'Discount': return <Percent className="w-4 h-4" />;
    case 'Buy1Get1': return <Plus className="w-4 h-4" />;
    case 'Voucher': return <Ticket className="w-4 h-4" />;
    case 'Gift': return <Gift className="w-4 h-4" />;
    default: return <Tag className="w-4 h-4" />;
  }
};

const PromotionSetupPanel: React.FC<PromotionSetupPanelProps> = ({
  promotions,
  editingId,
  formData,
  setFormData,
  setEditingId,
  suggestedTarget,
  formatCurrency,
  parseCurrency,
  handleApplySuggestion,
  handleSave,
  handleEdit,
  handleDelete,
  addGiftTier,
  updateGiftTier,
  removeGiftTier,
}) => (
  <>
    <>
    <div className="flex justify-between items-center mb-6">
      <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
        <Calendar className="text-indigo-600 w-6 h-6" /> Kế Hoạch Khuyến Mãi Năm
      </h2>
    </div>

    <div className="bg-white p-6 rounded-2xl border-2 border-indigo-100 shadow-xl mb-10">
      <div className="flex justify-between items-start mb-6">
        <h3 className="text-lg font-semibold text-slate-900">{editingId ? 'Chỉnh Sửa Chương Trình' : 'Thêm Chương Trình Mới'}</h3>
        {suggestedTarget > 0 && (
          <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 flex items-center gap-3">
            <div className="flex flex-col">
              <span className="text-2xs font-normal text-indigo-400 uppercase tracking-widest">Gợi ý từ năm ngoái</span>
              <span className="text-sm font-normal text-indigo-700">{suggestedTarget.toLocaleString()}đ</span>
            </div>
            <button
              onClick={handleApplySuggestion}
              className="bg-indigo-600 text-white text-2xs font-normal px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors uppercase"
            >
              Áp dụng
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-normal text-slate-500 uppercase mb-1 tracking-widest">Tên chương trình *</label>
            <input
              type="text"
              className="input-field"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="VD: Sale Hè Rực Rỡ"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-normal text-slate-500 uppercase mb-1 tracking-widest">Ngày bắt đầu *</label>
              <SingleDatePicker
                value={formData.startDate || ''}
                onChange={(date) => setFormData({ ...formData, startDate: date })}
              />
            </div>
            <div>
              <label className="block text-xs font-normal text-slate-500 uppercase mb-1 tracking-widest">Ngày kết thúc *</label>
              <SingleDatePicker
                value={formData.endDate || ''}
                onChange={(date) => setFormData({ ...formData, endDate: date })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-normal text-slate-500 uppercase mb-1 tracking-widest">Mục tiêu doanh thu (đ)</label>
              <div className="relative">
                <input
                  type="text"
                  className="input-field pr-10"
                  value={formatCurrency(formData.targetRevenue)}
                  onChange={(e) => setFormData({ ...formData, targetRevenue: parseCurrency(e.target.value) })}
                />
                <TrendingUp className="absolute right-3 top-2.5 w-4 h-4 text-slate-300" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-normal text-slate-500 uppercase mb-1 tracking-widest">Ngân sách dự kiến (đ)</label>
              <div className="relative">
                <input
                  type="text"
                  className="input-field pr-10"
                  value={formatCurrency(formData.budget)}
                  onChange={(e) => setFormData({ ...formData, budget: parseCurrency(e.target.value) })}
                />
                <DollarSign className="absolute right-3 top-2.5 w-4 h-4 text-slate-300" />
              </div>
              {formData.targetRevenue && formData.budget ? (
                <p className={`text-2xs mt-1 font-normal ${formData.budget / formData.targetRevenue >= 0.05 && formData.budget / formData.targetRevenue <= 0.1 ? 'text-emerald-500' : 'text-amber-500'}`}>
                  Tỷ lệ: {((formData.budget / formData.targetRevenue) * 100).toFixed(1)}% (Chuẩn: 5-10%)
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-normal text-slate-500 uppercase mb-1 tracking-widest">Loại khuyến mãi</label>
            <select
              className="input-field"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as PromotionPlan['type'] })}
            >
              <option value="Gift">Tặng quà theo mốc hóa đơn</option>
              <option value="Discount">Giảm giá trực tiếp</option>
              <option value="Buy1Get1">Mua 1 tặng 1</option>
              <option value="Voucher">Voucher / Coupon</option>
              <option value="Other">Khác</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-normal text-slate-500 uppercase mb-1 tracking-widest">Mô tả chi tiết</label>
            <textarea
              className="input-field h-32"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Nội dung chương trình, điều kiện áp dụng..."
            />
          </div>
        </div>
      </div>

      {(formData.status === 'Active' || formData.status === 'Completed') && (
        <div className="mb-8 p-6 bg-emerald-50 rounded-2xl border border-emerald-100">
          <h4 className="text-sm font-semibold text-emerald-900 uppercase tracking-widest flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-emerald-600" /> Kết quả thực tế (Tùy chọn ghi đè)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-normal text-emerald-700 uppercase mb-1 tracking-widest">Doanh thu thực tế đạt được (đ)</label>
              <input
                type="text"
                className="input-field border-emerald-200 focus:border-emerald-500"
                value={formatCurrency(formData.actualRevenue)}
                onChange={(e) => setFormData({ ...formData, actualRevenue: parseCurrency(e.target.value) })}
                placeholder="Để trống để hệ thống tự tính"
              />
            </div>
            <div>
              <label className="block text-xs font-normal text-emerald-700 uppercase mb-1 tracking-widest">Chi phí thực tế đã chi (đ)</label>
              <input
                type="text"
                className="input-field border-emerald-200 focus:border-emerald-500"
                value={formatCurrency(formData.actualCost)}
                onChange={(e) => setFormData({ ...formData, actualCost: parseCurrency(e.target.value) })}
                placeholder="Để trống để hệ thống tự tính"
              />
            </div>
          </div>
        </div>
      )}

      {formData.type === 'Gift' && (
        <div className="mb-8 p-6 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <Gift className="w-4 h-4 text-indigo-600" /> Danh sách mốc quà tặng
            </h4>
            <button
              onClick={addGiftTier}
              className="text-xs font-normal text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Thêm mốc
            </button>
          </div>

          <div className="space-y-3">
            {formData.giftTiers?.map((tier) => (
              <div key={tier.id} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div>
                  <label className="block text-2xs font-normal text-slate-400 uppercase mb-1 tracking-widest">Mốc hóa đơn (đ)</label>
                  <input
                    type="text"
                    className="input-field"
                    value={formatCurrency(tier.minInvoiceValue)}
                    onChange={(e) => updateGiftTier(tier.id, { minInvoiceValue: parseCurrency(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-2xs font-normal text-slate-400 uppercase mb-1 tracking-widest">Tên quà tặng</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="VD: Bình nước"
                    value={tier.giftName}
                    onChange={(e) => updateGiftTier(tier.id, { giftName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-2xs font-normal text-slate-400 uppercase mb-1 tracking-widest">Giá trị quà gợi ý</label>
                  <div className="input-field bg-slate-50 text-slate-500 font-normal flex items-center h-[38px]">
                    {tier.minInvoiceValue > 0
                      ? `${Math.round(tier.minInvoiceValue * 0.05).toLocaleString()} - ${Math.round(tier.minInvoiceValue * 0.1).toLocaleString()}đ`
                      : '0đ'}
                  </div>
                </div>
                <div>
                  <label className="block text-2xs font-normal text-slate-400 uppercase mb-1 tracking-widest">Giá trị quà (đ)</label>
                  <input
                    type="text"
                    className="input-field"
                    value={formatCurrency(tier.giftValue)}
                    onChange={(e) => updateGiftTier(tier.id, { giftValue: parseCurrency(e.target.value) })}
                  />
                  {tier.minInvoiceValue > 0 && tier.giftValue > 0 && (
                    <p className={`text-[9px] mt-1 font-normal ${tier.giftValue / tier.minInvoiceValue >= 0.05 && tier.giftValue / tier.minInvoiceValue <= 0.1 ? 'text-emerald-500' : 'text-amber-500'}`}>
                      Tỷ lệ: {((tier.giftValue / tier.minInvoiceValue) * 100).toFixed(1)}% (Chuẩn: 5-10%)
                    </p>
                  )}
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => removeGiftTier(tier.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {(!formData.giftTiers || formData.giftTiers.length === 0) && (
              <div className="text-center py-8 text-slate-400 text-xs italic bg-white rounded-xl border border-dashed border-slate-300">
                Chưa có mốc quà tặng nào. Nhấn "Thêm mốc" để bắt đầu.
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center pt-6 border-t border-slate-100">
        <div>
          <label className="block text-xs font-normal text-slate-500 uppercase mb-1 tracking-widest">Trạng thái</label>
          <select
            className="input-field w-40"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as PromotionPlan['status'] })}
          >
            <option value="Planned">Dự kiến</option>
            <option value="Active">Đang chạy</option>
            <option value="Completed">Hoàn thành</option>
            <option value="Cancelled">Đã hủy</option>
          </select>
        </div>
        <div className="flex gap-3">
          {editingId && (
            <button
              onClick={() => {
                setEditingId(null);
                setFormData(createEmptyPromotionForm());
              }}
              className="px-6 py-2.5 text-sm font-normal text-slate-500 hover:text-slate-700 uppercase tracking-widest"
            >
              Hủy chỉnh sửa
            </button>
          )}
          <button
            onClick={handleSave}
            className="btn-primary px-8"
          >
            <CheckCircle2 className="w-4 h-4" /> {editingId ? 'Cập Nhật Kế Hoạch' : 'Lưu Kế Hoạch'}
          </button>
        </div>
      </div>
    </div>
    </>

    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-2xs font-semibold text-slate-400 uppercase tracking-widest">Chương Trình</th>
              <th className="px-6 py-4 text-2xs font-semibold text-slate-400 uppercase tracking-widest">Thời Gian</th>
              <th className="px-6 py-4 text-2xs font-semibold text-slate-400 uppercase tracking-widest">Loại & Trạng Thái</th>
              <th className="px-6 py-4 text-2xs font-semibold text-slate-400 uppercase tracking-widest text-right">Ngân Sách</th>
              <th className="px-6 py-4 text-2xs font-semibold text-slate-400 uppercase tracking-widest text-right">Mục Tiêu</th>
              <th className="px-6 py-4 text-2xs font-semibold text-slate-400 uppercase tracking-widest text-right">ROI</th>
              <th className="px-6 py-4 text-2xs font-semibold text-slate-400 uppercase tracking-widest text-center">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {promotions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">
                  Chưa có kế hoạch khuyến mãi nào được lập.
                </td>
              </tr>
            ) : (
              [...promotions].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()).map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-normal text-slate-900">{p.name}</span>
                      <div className="flex items-center gap-1 mt-1">
                        <Info className="w-3 h-3 text-slate-400" />
                        <span className="text-2xs text-slate-500 line-clamp-1">{p.description || 'Không có mô tả'}</span>
                      </div>
                      {p.giftTiers && p.giftTiers.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {p.giftTiers.map((t) => (
                            <span key={t.id} className="text-[9px] font-normal bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                              {`>${t.minInvoiceValue / 1000}k`}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col text-xs font-normal text-slate-600">
                      <span>{new Date(p.startDate).toLocaleDateString('vi-VN')}</span>
                      <ChevronRight className="w-3 h-3 text-slate-300 my-0.5" />
                      <span>{new Date(p.endDate).toLocaleDateString('vi-VN')}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-normal text-indigo-600 uppercase">
                        {getTypeIcon(p.type)} {p.type === 'Gift' ? 'Tặng quà' : p.type}
                      </div>
                      {getStatusBadge(p.status)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-normal text-slate-900">{p.budget.toLocaleString()}đ</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-normal text-emerald-600">{p.targetRevenue.toLocaleString()}đ</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-xs font-normal text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100">
                      {p.budget > 0 ? (p.targetRevenue / p.budget).toFixed(1) : '0'}x
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEdit(p)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  </>
);

export default PromotionSetupPanel;
