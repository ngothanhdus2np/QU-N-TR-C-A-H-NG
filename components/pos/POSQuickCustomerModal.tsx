import React from 'react';
import { Plus, X } from 'lucide-react';

export type QuickCustomerForm = {
  name: string;
  phone: string;
  group: string;
  address: string;
  taxCode: string;
  email: string;
};

interface POSQuickCustomerModalProps {
  isOpen: boolean;
  form: QuickCustomerForm;
  onChange: (form: QuickCustomerForm) => void;
  onClose: () => void;
  onSave: () => void;
}

const POSQuickCustomerModal: React.FC<POSQuickCustomerModalProps> = ({
  isOpen,
  form,
  onChange,
  onClose,
  onSave,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[110] animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-[800px] max-w-[90vw] overflow-hidden animate-in slide-in-from-bottom-8 zoom-in-95 duration-300">
        <div className="flex justify-between items-center px-6 py-4 bg-indigo-600">
          <h2 className="text-lg font-black text-white">Thêm Khách Hàng Mới</h2>
          <button onClick={onClose} className="h-10 w-10 flex items-center justify-center hover:bg-white rounded-2xl hover:text-rose-500 transition-all shadow-sm border border-transparent hover:border-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 bg-slate-50">
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Tên khách hàng <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => onChange({ ...form, name: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-medium text-slate-900"
                    placeholder="Nguyễn Văn A"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Số điện thoại <span className="text-rose-500">*</span></label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => onChange({ ...form, phone: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-medium text-slate-900"
                    placeholder="09..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Nhóm khách hàng</label>
                  <select
                    value={form.group || 'Khách lẻ'}
                    onChange={(e) => onChange({ ...form, group: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-medium text-slate-900 appearance-none"
                  >
                    <option value="Khách lẻ">Khách lẻ</option>
                    <option value="Khách VIP">Khách VIP</option>
                    <option value="Khách buôn">Khách buôn</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Địa chỉ</label>
                  <input
                    type="text"
                    value={form.address || ''}
                    onChange={(e) => onChange({ ...form, address: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-medium text-slate-900"
                    placeholder="Số nhà, đường, quận/huyện..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Mã số thuế</label>
                  <input
                    type="text"
                    value={form.taxCode || ''}
                    onChange={(e) => onChange({ ...form, taxCode: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-medium text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={form.email || ''}
                    onChange={(e) => onChange({ ...form, email: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-medium text-slate-900"
                    placeholder="email@example.com"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 bg-slate-100 transition-colors"
            >
              Bỏ qua
            </button>
            <button
              onClick={onSave}
              className="px-6 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-colors flex items-center gap-2"
            >
              <Plus className="h-5 w-5" />
              Lưu khách hàng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default POSQuickCustomerModal;
