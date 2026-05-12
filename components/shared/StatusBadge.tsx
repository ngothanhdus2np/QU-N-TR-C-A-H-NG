import React from 'react';

interface StatusConfig {
  label: string;
  bg: string;
  text: string;
}

type StatusConfigMap = Record<string, StatusConfig>;

interface StatusBadgeProps {
  status?: string;
  configMap: StatusConfigMap;
  defaultStatus: string;
}

/**
 * Generic status badge component
 * Used by: Suppliers, Audit, Purchase Orders
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  configMap,
  defaultStatus,
}) => {
  const s = status || defaultStatus;
  const config = configMap[s] || configMap[defaultStatus];

  return (
    <span
      className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${config.bg} ${config.text}`}
    >
      {config.label}
    </span>
  );
};

// Predefined config maps for common use cases
export const SUPPLIER_STATUS_CONFIG: StatusConfigMap = {
  active: { label: 'Đang hoạt động', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  inactive: { label: 'Ngừng hoạt động', bg: 'bg-slate-100', text: 'text-slate-500' },
};

export const AUDIT_STATUS_CONFIG: StatusConfigMap = {
  draft: { label: 'Phiếu tạm', bg: 'bg-amber-100', text: 'text-amber-700' },
  balanced: { label: 'Đã cân bằng', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  cancelled: { label: 'Đã hủy', bg: 'bg-slate-100', text: 'text-slate-500' },
};

export const PURCHASE_STATUS_CONFIG: StatusConfigMap = {
  draft: { label: 'Phiếu tạm', bg: 'bg-amber-100', text: 'text-amber-700' },
  completed: { label: 'Đã nhập hàng', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  cancelled: { label: 'Đã hủy', bg: 'bg-slate-100', text: 'text-slate-500' },
};
