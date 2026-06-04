import React, { useEffect, useState } from 'react'; // useEffect for ward fetch
import { CalendarDays, User, UserCircle, X } from 'lucide-react';
import {
  AddressWard,
  fetchDistricts,
  fetchProvinces,
  fetchWards,
} from '../../services/vietnamAddressService';

export type QuickCustomerForm = {
  code: string;
  name: string;
  phone: string;
  group: string;
  birthday: string;
  gender: '' | 'male' | 'female';
  address: string;
  province: string;
  district: string;
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
  title?: string;
}

const POSQuickCustomerModal: React.FC<POSQuickCustomerModalProps> = ({
  isOpen,
  form,
  onChange,
  onClose,
  onSave,
  title = 'Thêm khách hàng',
}) => {
  const [wards, setWards] = useState<AddressWard[]>([]);
  const [loadingWards, setLoadingWards] = useState(false);
  const DEFAULT_GROUPS = ['Standard', 'Silver', 'Gold', 'Diamond'];
  const [customGroups, setCustomGroups] = useState<string[]>([]);
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const allGroups = [...DEFAULT_GROUPS, ...customGroups];

  const provinces = fetchProvinces();
  const districts = form.province ? fetchDistricts(form.province) : [];

  useEffect(() => {
    if (!form.province || !form.district) {
      setWards([]);
      return;
    }
    setLoadingWards(true);
    fetchWards(form.province, form.district)
      .then(setWards)
      .catch(() => setWards([]))
      .finally(() => setLoadingWards(false));
  }, [form.province, form.district]);

  if (!isOpen) return null;

  const handleBirthdayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) {
      formatted = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4);
    } else if (digits.length > 2) {
      formatted = digits.slice(0, 2) + '/' + digits.slice(2);
    }
    updateField('birthday', formatted);
  };

  const updateField = <K extends keyof QuickCustomerForm>(key: K, value: QuickCustomerForm[K]) => {
    onChange({ ...form, [key]: value });
  };

  const handleAddGroup = () => {
    const trimmed = newGroupName.trim();
    if (trimmed && !allGroups.includes(trimmed)) {
      setCustomGroups(prev => [...prev, trimmed]);
      updateField('group', trimmed);
    } else if (trimmed && allGroups.includes(trimmed)) {
      updateField('group', trimmed);
    }
    setNewGroupName('');
    setAddingGroup(false);
  };

  const inputClass =
    'w-full border-0 border-b border-slate-300 bg-transparent px-0 py-2 text-[15px] font-normal text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-600 focus:ring-0';

  const selectClass =
    'w-full border-0 border-b border-slate-300 bg-transparent px-0 py-2 text-[15px] font-normal text-slate-900 outline-none focus:border-indigo-600 focus:ring-0 cursor-pointer disabled:text-slate-400 disabled:cursor-not-allowed';

  const labelClass = 'text-[15px] font-normal text-slate-900';

  const field = (label: string, children: React.ReactNode, className = '') => (
    <label className={`grid grid-cols-[180px_minmax(0,1fr)] items-center gap-8 ${className}`}>
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );

  return (
    <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-modal animate-in fade-in duration-200 p-2">
      <div className="bg-white rounded-[1.75rem] shadow-2xl w-[min(1280px,calc(100vw-24px))] min-h-[650px] max-h-[calc(100vh-24px)] overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
        <div className="h-20 px-10 flex items-center justify-between border-b border-slate-200 shrink-0">
          <div className="flex items-baseline gap-4 min-w-0">
            <h2 className="text-[21px] font-semibold text-slate-950 whitespace-nowrap">{title}</h2>
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
          <button className="h-16 border-b-2 border-indigo-600 px-2 text-lg font-normal text-blue-600">
            Thông tin chung
          </button>
          <button className="h-16 px-2 text-lg font-normal text-slate-500">
            Thông tin xuất hóa đơn
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-10 py-8">
          <div className="grid grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)] gap-8">
            <div className="pt-1 flex flex-col items-center">
              <div className="h-32 w-32 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                <User className="h-14 w-14 fill-slate-600 stroke-slate-600" />
              </div>
              <button
                type="button"
                className="mt-8 h-11 w-32 rounded-xl border border-indigo-600 bg-white text-base font-normal text-blue-600 hover:bg-blue-50 transition-colors"
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
                    className={`${inputClass} pr-9 border-indigo-600`}
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
                'Tỉnh/Thành phố',
                <select
                  value={form.province}
                  onChange={e => {
                    onChange({ ...form, province: e.target.value, district: '', ward: '' });
                  }}
                  className={selectClass}
                >
                  <option value="">-- Chọn Tỉnh/TP --</option>
                  {provinces.map(p => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
              {field(
                'Quận/Huyện',
                <select
                  value={form.district}
                  onChange={e => {
                    onChange({ ...form, district: e.target.value, ward: '' });
                  }}
                  disabled={!form.province}
                  className={selectClass}
                >
                  <option value="">-- Chọn Quận/Huyện --</option>
                  {districts.map(d => (
                    <option key={d.name} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              )}
              {field(
                'Phường/Xã',
                <select
                  value={form.ward}
                  onChange={e => updateField('ward', e.target.value)}
                  disabled={!form.district || loadingWards}
                  className={selectClass}
                >
                  <option value="">
                    {loadingWards ? 'Đang tải...' : '-- Chọn Phường/Xã --'}
                  </option>
                  {wards.map(w => (
                    <option key={w.name} value={w.name}>
                      {w.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-[180px_minmax(0,1fr)] items-center gap-8">
                <span className={labelClass}>Nhóm</span>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setAddingGroup(true)}
                    className="absolute -top-5 right-0 text-xs text-blue-600 hover:text-blue-700 font-normal"
                  >
                    + Thêm mới
                  </button>
                  <select
                    value={form.group}
                    onChange={e => updateField('group', e.target.value)}
                    className={selectClass}
                  >
                    <option value="">-- Chọn nhóm --</option>
                    {allGroups.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                  {addingGroup && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-3 z-20 flex gap-2">
                      <input
                        autoFocus
                        value={newGroupName}
                        onChange={e => setNewGroupName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleAddGroup();
                          if (e.key === 'Escape') { setAddingGroup(false); setNewGroupName(''); }
                        }}
                        className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-[14px] outline-none focus:border-blue-500"
                        placeholder="Tên nhóm mới"
                      />
                      <button
                        onClick={handleAddGroup}
                        className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
                      >
                        OK
                      </button>
                      <button
                        onClick={() => { setAddingGroup(false); setNewGroupName(''); }}
                        className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm hover:bg-slate-50"
                      >
                        Hủy
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {field(
                'Ngày sinh',
                <div className="relative">
                  <input
                    value={form.birthday}
                    onChange={handleBirthdayChange}
                    className={`${inputClass} pr-9`}
                    placeholder="DD/MM/YYYY"
                    maxLength={10}
                    inputMode="numeric"
                  />
                  <CalendarDays className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-700" />
                </div>
              )}
              {field(
                'Giới tính',
                <div className="flex items-center gap-8 py-2">
                  <label className="flex items-center gap-3 text-[15px] font-normal text-slate-900 cursor-pointer">
                    <input
                      type="radio"
                      checked={form.gender === 'male'}
                      onChange={() => updateField('gender', 'male')}
                      className="h-4 w-4 border-slate-400 text-blue-600 focus:ring-blue-500"
                    />
                    Nam
                  </label>
                  <label className="flex items-center gap-3 text-[15px] font-normal text-slate-900 cursor-pointer">
                    <input
                      type="radio"
                      checked={form.gender === 'female'}
                      onChange={() => updateField('gender', 'female')}
                      className="h-4 w-4 border-slate-400 text-blue-600 focus:ring-blue-500"
                    />
                    Nữ
                  </label>
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
            className="h-12 w-32 rounded-xl border border-indigo-600 bg-white text-lg font-normal text-blue-600 hover:bg-blue-50 transition-colors"
          >
            Bỏ qua
          </button>
          <button
            onClick={onSave}
            className="h-12 w-32 rounded-xl bg-indigo-600 text-lg font-normal text-white hover:bg-indigo-700 transition-colors"
          >
            Lưu
          </button>
        </div>
      </div>
    </div>
  );
};

export default POSQuickCustomerModal;
