import React from 'react';
import { Search } from 'lucide-react';
import { FilterDateRange } from '../../shared';
import type { TabKey, PurchasePeriodScope, PurchaseInvoicesProps } from './types';
import { TAB_CONFIG } from './types';

type PurchaseInvoicesSidebarProps = {
  purchasePeriodScope: PurchasePeriodScope;
  onPeriodScopeChange: (scope: PurchasePeriodScope) => void;
  activeTab: TabKey;
  onActiveTabChange: (tab: TabKey) => void;
  statusFilterOpen?: boolean;
  onStatusFilterOpenChange?: (open: boolean) => void;
  tabCounts: Record<TabKey, number>;
  dateRange: { start: string; end: string };
  displayDateRange?: { start: string; end: string };
  transformDateRange?: (range: { start: string; end: string }) => { start: string; end: string };
  onDateRangeChange: React.Dispatch<React.SetStateAction<{ start: string; end: string }>>;
  supplierSearch: string;
  onSupplierSearchChange: (value: string) => void;
  supplierFilter: string;
  onSupplierFilterChange: (id: string) => void;
  suppliers: PurchaseInvoicesProps['suppliers'];
};

export default function PurchaseInvoicesSidebar({
  purchasePeriodScope,
  onPeriodScopeChange,
  activeTab,
  onActiveTabChange,
  tabCounts,
  dateRange,
  displayDateRange,
  transformDateRange,
  onDateRangeChange,
  supplierSearch,
  onSupplierSearchChange,
  supplierFilter,
  onSupplierFilterChange,
  suppliers,
}: PurchaseInvoicesSidebarProps) {
  const shownDateRange = displayDateRange || dateRange;
  const matchingSuppliers = supplierSearch.trim()
    ? suppliers.filter(s => s.name.toLowerCase().includes(supplierSearch.toLowerCase()))
    : [];

  return (
    <div className="w-64 shrink-0 flex flex-col bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-widest">
          Hóa đơn đầu vào
        </h2>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">Quản lý hóa đơn mua hàng từ NCC</p>
      </div>

      <div className="space-y-2 border-b border-slate-100 px-3 py-3">
        <button
          type="button"
          onClick={() => onPeriodScopeChange('all')}
          className={`w-full rounded-xl border px-3 py-2 text-center text-xs font-normal transition-all ${
            purchasePeriodScope === 'all'
              ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
              : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
          }`}
        >
          Tất cả
        </button>
        <div className="space-y-2">
          {[
            { key: 'pre' as PurchasePeriodScope, label: 'Trước ngày chốt' },
            { key: 'post' as PurchasePeriodScope, label: 'Sau ngày chốt' },
          ].map(option => (
            <button
              key={option.key}
              type="button"
              onClick={() => onPeriodScopeChange(option.key)}
              className={`w-full rounded-xl border px-3 py-2 text-center text-xs font-normal transition-all ${
                purchasePeriodScope === option.key
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-3 py-3 border-b border-slate-100">
        <div className="text-2xs font-normal text-slate-400 uppercase tracking-wide mb-2">
          Thời gian
        </div>
        <FilterDateRange
          key={`${purchasePeriodScope}:${shownDateRange.start}:${shownDateRange.end}`}
          startDate={shownDateRange.start}
          endDate={shownDateRange.end}
          onStartDateChange={date => onDateRangeChange(prev => ({ ...prev, start: date }))}
          onEndDateChange={date => onDateRangeChange(prev => ({ ...prev, end: date }))}
          transformRange={transformDateRange}
        />
      </div>

      <div className="space-y-2 border-b border-slate-100 px-3 py-3">
        <div className="text-2xs font-normal text-slate-400 uppercase tracking-wide">
          Trạng thái
        </div>
        {TAB_CONFIG.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => onActiveTabChange(key)}
            className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-xs font-normal transition-all ${
              activeTab === key
                ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
            }`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="truncate">{label}</span>
            </span>
            <span className={`ml-2 rounded-full px-1.5 py-0.5 text-2xs font-normal ${
              activeTab === key ? 'bg-indigo-100 text-indigo-700' : 'bg-white text-slate-400'
            }`}>
              {tabCounts[key]}
            </span>
          </button>
        ))}
      </div>

      <div className="px-3 py-3 flex flex-col flex-1 min-h-0 border-t border-slate-100">
        <div className="text-2xs font-normal text-slate-400 uppercase tracking-wide mb-2">
          Nhà cung cấp
        </div>
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm nhà cung cấp..."
            value={supplierSearch}
            onChange={e => onSupplierSearchChange(e.target.value)}
            className="w-full pl-7 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-normal outline-none focus:border-indigo-400 focus:bg-white transition-all placeholder:text-slate-300"
          />
        </div>
        <div className="space-y-0.5 overflow-y-auto flex-1 min-h-0">
          {matchingSuppliers.map(s => (
              <button
                key={s.id}
                onClick={() => onSupplierFilterChange(supplierFilter === s.id ? 'all' : s.id)}
                className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs transition-all truncate ${
                  supplierFilter === s.id
                    ? 'bg-indigo-50 text-indigo-700 font-normal'
                    : 'text-slate-600 hover:bg-slate-50 font-normal'
                }`}
              >
                {s.name}
              </button>
            ))}
          {supplierSearch.trim() && matchingSuppliers.length === 0 && (
              <p className="px-2.5 py-2 text-2xs text-slate-300 font-medium italic">
                Không tìm thấy NCC
              </p>
          )}
        </div>
      </div>
    </div>
  );
}
