import React from 'react';
import { Search, X } from 'lucide-react';

interface ListPageToolbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  leftActions?: React.ReactNode;
  rightActions?: React.ReactNode;
  selectedCount?: number;
  onClearSelection?: () => void;
  bulkActions?: React.ReactNode;
  filterSummary?: React.ReactNode;
}

/**
 * Generic toolbar component for list pages
 * Features: Search, bulk actions, custom actions
 */
export const ListPageToolbar: React.FC<ListPageToolbarProps> = ({
  searchTerm,
  onSearchChange,
  searchPlaceholder = 'Tìm kiếm...',
  leftActions,
  rightActions,
  selectedCount = 0,
  onClearSelection,
  bulkActions,
  filterSummary,
}) => {
  const [searchFocused, setSearchFocused] = React.useState(false);

  return (
    <div className="shrink-0 border-b border-slate-100">
      {/* Main Toolbar Row */}
      <div className="px-4 min-h-[52px] flex items-center gap-3">
        {/* Left Actions */}
        {leftActions && <div className="flex items-center gap-2">{leftActions}</div>}

        {/* Search */}
        <div className="flex-1 max-w-md">
          <div
            className={`flex items-center bg-white border ${searchFocused ? 'border-indigo-500 shadow-[0_0_0_2px_rgba(99,102,241,0.1)]' : 'border-slate-200'} rounded-xl px-3 py-2 transition-all`}
          >
            <Search className="h-4 w-4 text-slate-400 mr-2 shrink-0" />
            <input
              className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-slate-400"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={e => onSearchChange(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            {searchTerm && (
              <button
                onClick={() => onSearchChange('')}
                className="ml-2 p-1 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-3.5 w-3.5 text-slate-400" />
              </button>
            )}
          </div>
        </div>

        {/* Right Actions */}
        {rightActions && <div className="flex items-center gap-2 ml-auto">{rightActions}</div>}
      </div>

      {/* Bulk Actions Bar (when items selected) */}
      {selectedCount > 0 && (
        <div className="px-4 py-2.5 bg-indigo-50 border-t border-indigo-100 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-indigo-900">
              Đã chọn {selectedCount} mục
            </span>
            {onClearSelection && (
              <button
                onClick={onClearSelection}
                className="text-xs text-indigo-600 font-semibold hover:underline"
              >
                Bỏ chọn
              </button>
            )}
          </div>
          {bulkActions && <div className="flex items-center gap-2 ml-4">{bulkActions}</div>}
        </div>
      )}

      {/* Filter Summary */}
      {filterSummary && (
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100">
          {filterSummary}
        </div>
      )}
    </div>
  );
};
