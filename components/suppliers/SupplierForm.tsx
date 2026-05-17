import React, { useState, useEffect } from 'react';
import { X, Save, Truck } from 'lucide-react';
import { Supplier } from '../../types';
import { useToast } from '../ui/Toast';

interface SupplierFormProps {
  supplier: Supplier | null; // null = create mode, non-null = edit mode
  onSave: (supplier: Supplier) => void | Promise<void>;
  onCancel: () => void;
}

const SupplierForm: React.FC<SupplierFormProps> = ({ supplier, onSave, onCancel }) => {
  const { showToast } = useToast();
  const isEditMode = supplier !== null;

  const [formData, setFormData] = useState<Omit<Supplier, 'id' | 'totalPurchase' | 'currentDebt'>>({
    name: '',
    code: '',
    phone: '',
    email: '',
    address: '',
    group: '',
    status: 'active',
    notes: '',
  });

  useEffect(() => {
    if (supplier) {
      setFormData({
        name: supplier.name,
        code: supplier.code || '',
        phone: supplier.phone || '',
        email: supplier.email || '',
        address: supplier.address || '',
        group: supplier.group || '',
        status: supplier.status || 'active',
        notes: supplier.notes || '',
      });
    }
  }, [supplier]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      showToast('Vui lòng nhập tên nhà cung cấp', 'warning');
      return;
    }
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      showToast('Email nhà cung cấp không hợp lệ', 'warning');
      return;
    }
    if (formData.phone.trim() && !/^[0-9+\-\s().]{8,20}$/.test(formData.phone.trim())) {
      showToast('Số điện thoại nhà cung cấp không hợp lệ', 'warning');
      return;
    }

    const supplierData: Supplier = {
      id: supplier?.id || '', // Will be generated in container
      name: formData.name.trim(),
      code: formData.code?.trim() || undefined,
      phone: formData.phone?.trim() || undefined,
      email: formData.email?.trim() || undefined,
      address: formData.address?.trim() || undefined,
      group: formData.group?.trim() || undefined,
      status: formData.status,
      notes: formData.notes?.trim() || undefined,
    };

    onSave(supplierData);
  };

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm pt-20">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Truck className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">
                {isEditMode ? 'Sửa nhà cung cấp' : 'Thêm nhà cung cấp mới'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isEditMode ? 'Cập nhật thông tin nhà cung cấp' : 'Nhập thông tin nhà cung cấp mới'}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Thông tin cơ bản */}
            <div>
              <h3 className="text-sm font-black text-slate-700 uppercase tracking-wide mb-4">
                Thông tin cơ bản
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-normal text-slate-700 mb-2">
                    Tên nhà cung cấp <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => handleChange('name', e.target.value)}
                    placeholder="VD: Công ty TNHH ABC"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-normal text-slate-700 mb-2">
                    Mã nhà cung cấp
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={e => handleChange('code', e.target.value)}
                    placeholder="VD: NCC001 (tự động nếu để trống)"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-normal text-slate-700 mb-2">
                    Nhóm
                  </label>
                  <input
                    type="text"
                    value={formData.group}
                    onChange={e => handleChange('group', e.target.value)}
                    placeholder="VD: Giày dép, Phụ kiện"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Liên hệ */}
            <div>
              <h3 className="text-sm font-black text-slate-700 uppercase tracking-wide mb-4">
                Thông tin liên hệ
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-normal text-slate-700 mb-2">
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={e => handleChange('phone', e.target.value)}
                    placeholder="VD: 0901234567"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-normal text-slate-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => handleChange('email', e.target.value)}
                    placeholder="VD: contact@abc.com"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-normal text-slate-700 mb-2">
                    Địa chỉ
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={e => handleChange('address', e.target.value)}
                    placeholder="VD: 123 Đường ABC, Quận 1, TP.HCM"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Trạng thái */}
            <div>
              <h3 className="text-sm font-black text-slate-700 uppercase tracking-wide mb-4">
                Trạng thái
              </h3>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value="active"
                    checked={formData.status === 'active'}
                    onChange={e => handleChange('status', e.target.value)}
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-normal text-slate-700">Đang hoạt động</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value="inactive"
                    checked={formData.status === 'inactive'}
                    onChange={e => handleChange('status', e.target.value)}
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-normal text-slate-700">Ngừng hoạt động</span>
                </label>
              </div>
            </div>

            {/* Ghi chú */}
            <div>
              <h3 className="text-sm font-black text-slate-700 uppercase tracking-wide mb-4">
                Ghi chú
              </h3>
              <textarea
                value={formData.notes}
                onChange={e => handleChange('notes', e.target.value)}
                placeholder="Ghi chú thêm về nhà cung cấp..."
                rows={4}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 bg-slate-100 rounded-xl font-normal text-xs uppercase text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Hủy
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-normal text-xs uppercase tracking-wide shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors"
          >
            <Save className="h-4 w-4" />
            {isEditMode ? 'Cập nhật' : 'Thêm mới'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SupplierForm;
