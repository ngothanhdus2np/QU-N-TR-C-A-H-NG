import React from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

type MetricColor = 'indigo' | 'rose' | 'emerald' | 'amber' | 'sky';

interface MetricCardProps {
  title: string;
  value: React.ReactNode;
  icon: LucideIcon;
  color: MetricColor;
  desc: React.ReactNode;
}

interface InputWrapperProps {
  label: string;
  icon: LucideIcon;
  children: React.ReactNode;
  color?: string;
}

export const MetricCard = ({ title, value, icon: Icon, color, desc }: MetricCardProps) => {
  const colorMap: Record<MetricColor, string> = { indigo: 'bg-indigo-50 text-indigo-600', rose: 'bg-rose-50 text-rose-600', emerald: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600', sky: 'bg-sky-50 text-sky-600' };
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col justify-between transition-all hover:scale-[1.02] active:scale-95 duration-300"
    >
      <div>
        <div className={`p-4 rounded-2xl ${colorMap[color]} w-fit mb-6 shadow-sm`}><Icon className="w-6 h-6" /></div>
        <p className="text-[9px] font-normal text-slate-400 uppercase tracking-widest mb-1">{title}</p>
        <h4 className="text-xl font-normal text-slate-900 tabular-nums">{value}</h4>
      </div>
      <p className="text-[8px] font-normal text-slate-400 uppercase tracking-tighter mt-4 pt-4 border-t border-slate-50 leading-relaxed">{desc}</p>
    </motion.div>
  );
};

export const InputWrapper = ({ label, icon: Icon, children, color = "text-slate-400" }: InputWrapperProps) => (
  <div className="space-y-1.5">
    <label className="text-[9px] font-normal text-slate-400 uppercase tracking-widest ml-1">{label}</label>
    <div className="relative bg-slate-50 border border-slate-100 focus-within:bg-white focus-within:border-blue-500 rounded-xl transition-all shadow-inner overflow-hidden flex items-center">
      <Icon className={`absolute left-3 w-3.5 h-3.5 ${color}`} />
      <div className="pl-9 w-full">{children}</div>
    </div>
  </div>
);

/**
 * Tách SKU Shopee thành mã cha / màu / kích cỡ.
 *
 * Gộp 30/08/2026: trước đó `SourceTab.tsx` và `SourceDetailPage.tsx` mỗi file
 * một bản, và hai bản ĐÃ LỆCH — bản ở SourceDetailPage thiếu `parentCode`.
 * Bản giữ lại là bản đầy đủ của SourceTab; SourceDetailPage vốn chỉ destructure
 * `{ color, size }` nên không đổi hành vi.
 *
 * Quy ước: phần sau dấu '-' thứ hai trở đi đều thuộc về size, vì tên size thật
 * có thể chứa dấu '-' (vd "36-37").
 */
export const parseSku = (sku: string) => {
  const parts = sku.split('-');
  if (parts.length === 1) return { parentCode: sku, color: null, size: null };
  if (parts.length === 2) return { parentCode: parts[0], color: parts[1], size: null };
  return { parentCode: parts[0], color: parts[1], size: parts.slice(2).join('-') };
};

/** Bucket Supabase Storage chứa ảnh sản phẩm Shopee. */
export const BUCKET = 'shopee-products';
