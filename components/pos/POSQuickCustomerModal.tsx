import React from 'react';
import { CalendarDays, User, UserCircle, X } from 'lucide-react';

export type QuickCustomerForm = {
  code: string;
  name: string;
  phone: string;
  group: string;
  birthday: string;
  gender: '' | 'male' | 'female';
  address: string;
  area: string;
  ward: string;
  taxCode: string;
  email: string;
  facebook: string;
  notes: string;
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

  const updateField = <K extends keyof QuickCustomerForm>(key: K, value: QuickCustomerForm[K]) => {
    onChange({ ...form, [key]: value });
  };

  const inputClass =
    'w-full border-0 border-b border-slate-300 bg-transparent px-0 py-2 text-[15px] font-normal text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-0';

  const labelClass = 'text-[15px] font-normal text-slate-900';

  const field = (
    label: string,
    children: React.ReactNode,
    className = ''
  ) => (
    <label className={`grid grid-cols-[180px_minmax(0,1fr)] items-center gap-8 ${className}`}>
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );

  return (
    <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-[110] animate-in fade-in duration-200 p-2">
      <div className="bg-white rounded-[1.75rem] shadow-2xl w-[min(1280px,calc(100vw-24px))] min-h-[650px] max-h-[calc(100vh-24px)] overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
        <div className="h-20 px-10 flex items-center justify-between border-b border-slate-200 shrink-0">
          <div className="flex items-baseline gap-4 min-w-0">
            <h2 className="text-[21px] font-black text-slate-950 whitespace-nowrap">Thêm khách hàng</h2>
            <span className="h-6 w-px bg-slate-300" />
            <p className="text-lg font-normal text-slate-500 truncate">
              Chi nhánh tạo: Chi nhánh trung tâm
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-11 w-11 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            title="Đóng"
          >
            <X className="h-8 w-8" />
          </button>
        </div>

        <div className="h-16 px-14 flex items-end gap-14 border-b border-slate-300 shrink-0">
          <button className="h-16 border-b-2 border-blue-600 px-2 text-lg font-normal text-blue-600">
            Thông tin chung
          </button>
          <button className="h-16 px-2 text-lg font-normal text-slate-500">Thông tin xuất hóa đơn</button>
        </div>

        <div className="flex-1 overflow-y-auto px-10 py-8">
          <div className="grid grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)] gap-8">
            <div className="pt-1 flex flex-col items-center">
              <div className="h-32 w-32 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                <User className="h-14 w-14 fill-slate-600 stroke-slate-600" />
              </div>
              <button
                type="button"
                className="mt-8 h-11 w-32 rounded-xl border border-blue-600 bg-white text-base font-normal text-blue-600 hover:bg-blue-50 transition-colors"
              >
                Chọn ảnh
              </button>
            </div>

            <div className="space-y-5">
              {field(
                'Mã khách hàng',
                <input
                  value={form.code}
                  onChange={e => updateField('code', e.target.value)}
                  className={inputClass}
                  placeholder="Mã mặc định"
                />
              )}
              {field(
                'Tên khách hàng',
                <div className="relative">
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => updateField('name', e.target.value)}
                    className={`${inputClass} pr-9 border-blue-600`}
                    placeholder="Bắt buộc"
                  />
                  <UserCircle className="absolute right-1 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-900" />
                </div>
              )}
              {field(
                'Điện thoại',
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => updateField('phone', e.target.value)}
                  className={inputClass}
                  placeholder="Bắt buộc"
                />
              )}
              <div className="h-10 border-b border-slate-300" />
              {field(
                'Địa chỉ',
                <input
                  value={form.address}
                  onChange={e => updateField('address', e.target.value)}
                  className={inputClass}
                  placeholder="Số nhà, tòa nhà, ngõ, đường"
                />,
                'mt-3'
              )}
              {field(
                'Khu vực',
                <input
                  value={form.area}
                  onChange={e => updateField('area', e.target.value)}
                  className={inputClass}
                  placeholder="Chọn Tỉnh/TP - Quận/Huyện"
                />
              )}
              {field(
                'Phường xã',
                <input
                  value={form.ward}
                  onChange={e => updateField('ward', e.target.value)}
                  className={inputClass}
                  placeholder="Chọn Phường/Xã"
                />
              )}
            </div>

            <div className="space-y-5">
              {field(
                'Nhóm',
                <input
                  value={form.group}
                  onChange={e => updateField('group', e.target.value)}
                  className={inputClass}
                  placeholder=""
                />
              )}
              {field(
                'Ngày sinh',
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-7">
                  <div className="relative">
                    <input
                      value={form.birthday}
                      onChange={e => updateField('birthday', e.target.value)}
                      className={`${inputClass} pr-9`}
                    />
                    <CalendarDays className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-700" />
                  </div>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-3 text-lg font-normal text-slate-900">
                      <input
                        type="radio"
                        checked={form.gender === 'male'}
                        onChange={() => updateField('gender', 'male')}
                        className="h-5 w-5 border-slate-400 text-blue-600 focus:ring-blue-500"
                      />
                      Nam
                    </label>
                    <label className="flex items-center gap-3 text-lg font-normal text-slate-900">
                      <input
                        type="radio"
                        checked={form.gender === 'female'}
                        onChange={() => updateField('gender', 'female')}
                        className="h-5 w-5 border-slate-400 text-blue-600 focus:ring-blue-500"
                      />
                      Nữ
                    </label>
                  </div>
                </div>
              )}
              {field(
                'Email',
                <input
                  type="email"
                  value={form.email}
                  onChange={e => updateField('email', e.target.value)}
                  className={inputClass}
                />
              )}
              {field(
                'Facebook',
                <input
                  value={form.facebook}
                  onChange={e => updateField('facebook', e.target.value)}
                  className={inputClass}
                />
              )}
              {field(
                'Ghi chú',
                <textarea
                  value={form.notes}
                  onChange={e => updateField('notes', e.target.value)}
                  rows={3}
                  className={`${inputClass} resize-none`}
                />
              )}
            </div>
          </div>
        </div>

        <div className="h-24 px-10 flex items-center justify-end gap-5 shrink-0">
          <button
            onClick={onClose}
            className="h-12 w-32 rounded-xl border border-blue-600 bg-white text-lg font-normal text-blue-600 hover:bg-blue-50 transition-colors"
          >
            Bỏ qua
          </button>
          <button
            onClick={onSave}
            className="h-12 w-32 rounded-xl bg-blue-600 text-lg font-normal text-white hover:bg-blue-700 transition-colors"
          >
            Lưu
          </button>
        </div>
      </div>
    </div>
  );
};

export default POSQuickCustomerModal;
