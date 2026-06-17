import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronUp, ChevronDown } from 'lucide-react';
import { Supplier } from '../../types';
import { useToast } from '../ui/Toast';

interface SupplierFormProps {
  supplier: Supplier | null;
  groupOptions?: string[];
  cityOptions?: string[];
  wardOptions?: string[];
  onSave: (supplier: Supplier) => void | Promise<void>;
  onCancel: () => void;
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const Section: React.FC<SectionProps> = ({ title, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors"
      >
        <span className="text-sm font-semibold text-slate-800">{title}</span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>
      {open && <div className="px-4 pb-4 pt-1 space-y-3 bg-white">{children}</div>}
    </div>
  );
};

const inputCls =
  'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-colors placeholder:text-slate-400';

const SupplierForm: React.FC<SupplierFormProps> = ({
  supplier,
  groupOptions = [],
  cityOptions = [],
  wardOptions = [],
  onSave,
  onCancel,
}) => {
  const { showToast } = useToast();
  const isEditMode = supplier !== null;
  const [isSaving, setIsSaving] = useState(false);
  const mountedRef = useRef(true);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [ward, setWard] = useState('');
  const [group, setGroup] = useState('');
  const [notes, setNotes] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [taxCode, setTaxCode] = useState('');

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (supplier) {
      setName(supplier.name);
      setCode(supplier.code || '');
      setPhone(supplier.phone || '');
      setEmail(supplier.email || '');
      const addressParts = (supplier.address || '')
        .split(',')
        .map(part => part.trim())
        .filter(Boolean);
      setStreetAddress(addressParts.length > 2 ? addressParts.slice(0, -2).join(', ') : '');
      setWard(addressParts.length > 1 ? addressParts[addressParts.length - 2] : '');
      setCity(addressParts.length > 0 ? addressParts[addressParts.length - 1] : '');
      setGroup(supplier.group || '');
      setNotes(supplier.notes || '');
      setCompanyName(supplier.companyName || '');
      setTaxCode(supplier.taxCode || '');
    } else {
      setName('');
      setCode('');
      setPhone('');
      setEmail('');
      setStreetAddress('');
      setCity('');
      setWard('');
      setGroup('');
      setNotes('');
      setCompanyName('');
      setTaxCode('');
    }
  }, [supplier]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    if (!name.trim()) {
      showToast('Vui lòng nhập tên nhà cung cấp', 'warning');
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      showToast('Email nhà cung cấp không hợp lệ', 'warning');
      return;
    }
    if (phone.trim() && !/^[0-9+\-\s().]{8,20}$/.test(phone.trim())) {
      showToast('Số điện thoại nhà cung cấp không hợp lệ', 'warning');
      return;
    }

    const combinedAddress = [streetAddress, ward, city].map(s => s.trim()).filter(Boolean).join(', ');

    const supplierData: Supplier = {
      id: supplier?.id || '',
      name: name.trim(),
      code: code.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      address: combinedAddress || undefined,
      group: group.trim() || undefined,
      status: supplier?.status || 'active',
      notes: notes.trim() || undefined,
      companyName: companyName.trim() || undefined,
      taxCode: taxCode.trim() || undefined,
      invoiceCompanyName: supplier?.invoiceCompanyName,
      invoiceTaxCode: supplier?.invoiceTaxCode,
      invoicePhone: supplier?.invoicePhone,
      invoiceAddress: supplier?.invoiceAddress,
    };

    try {
      setIsSaving(true);
      await onSave(supplierData);
    } finally {
      if (mountedRef.current) setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-modal flex items-start justify-center bg-slate-950/60 px-4 pb-4 backdrop-blur-sm overflow-y-auto"
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="mt-[116px] bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[calc(100vh-132px)] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <h2 className="text-base font-semibold text-slate-900">
            {isEditMode ? 'Sửa nhà cung cấp' : 'Tạo nhà cung cấp'}
          </h2>
          <button onClick={onCancel} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-3">
          {/* Top fields — no section header */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Tên nhà cung cấp</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Bắt buộc"
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Mã nhà cung cấp</label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="Tự động"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Điện thoại</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder=""
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="email@gmail.com"
                className={inputCls}
              />
            </div>
          </div>

          {/* Địa chỉ */}
          <Section title="Địa chỉ">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Địa chỉ</label>
              <input
                type="text"
                value={streetAddress}
                onChange={e => setStreetAddress(e.target.value)}
                placeholder="Nhập địa chỉ"
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Khu vực</label>
                <input
                  type="text"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  placeholder="Chọn Tỉnh/Thành phố"
                  list="supplier-city-options"
                  className={inputCls}
                />
                <datalist id="supplier-city-options">
                  {cityOptions.map(option => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Phường/Xã</label>
                <input
                  type="text"
                  value={ward}
                  onChange={e => setWard(e.target.value)}
                  placeholder="Chọn Phường/Xã"
                  list="supplier-ward-options"
                  className={inputCls}
                />
                <datalist id="supplier-ward-options">
                  {wardOptions.map(option => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </div>
            </div>
          </Section>

          {/* Nhóm & Ghi chú */}
          <Section title="Nhóm nhà cung cấp, ghi chú">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Nhóm nhà cung cấp</label>
              <input
                type="text"
                value={group}
                onChange={e => setGroup(e.target.value)}
                placeholder="Chọn nhóm nhà cung cấp"
                list="supplier-group-options"
                className={inputCls}
              />
              <datalist id="supplier-group-options">
                {groupOptions.map(option => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Ghi chú</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Nhập ghi chú"
                rows={3}
                className={`${inputCls} resize-none`}
              />
            </div>
          </Section>

          {/* Thông tin xuất hóa đơn */}
          <Section title="Thông tin xuất hóa đơn" defaultOpen={false}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Tên công ty</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="Nhập tên công ty"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Mã số thuế</label>
                <input
                  type="text"
                  value={taxCode}
                  onChange={e => setTaxCode(e.target.value)}
                  placeholder="Nhập mã số thuế"
                  className={inputCls}
                />
              </div>
            </div>
          </Section>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl border border-slate-200 text-sm font-normal text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Bỏ qua
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-normal hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300 transition-colors"
          >
            {isSaving ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SupplierForm;
