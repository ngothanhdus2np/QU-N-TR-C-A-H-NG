import React from 'react';
import { POSProduct } from '../../types';

interface GoodsCreateProductTextTabProps {
  formData: Partial<POSProduct>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<POSProduct>>>;
  field: 'description' | 'warranty';
  label: string;
  placeholder: string;
}

export const GoodsCreateProductTextTab: React.FC<GoodsCreateProductTextTabProps> = ({
  formData,
  setFormData,
  field,
  label,
  placeholder,
}) => (
  <div>
    <label className="text-sm font-normal text-slate-700 mb-2 block">{label}</label>
    <textarea
      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500 min-h-[200px]"
      value={formData[field] || ''}
      onChange={e => setFormData({ ...formData, [field]: e.target.value })}
      placeholder={placeholder}
    />
  </div>
);
