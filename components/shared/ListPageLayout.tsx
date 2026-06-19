import React, { useState } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface ListPageLayoutProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  toolbar: React.ReactNode;
  pagination?: React.ReactNode;
  sidebarTitle?: string;
  onClearFilters?: () => void;
  hasActiveFilters?: boolean;
}

/**
 * Generic layout component for list/management pages
 * Used by: Goods, Purchase Orders, Suppliers, etc.
 * 
 * Layout structure:
 * [Collapsible Sidebar] [Main Content: Toolbar + Table + Pagination]
 */
export const ListPageLayout: React.FC<ListPageLayoutProps> = ({
  children,
  sidebar,
  toolbar,
  pagination,
  sidebarTitle = 'Bộ lọc',
  onClearFilters,
  hasActiveFilters = false,
}) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-full min-h-0 gap-4">
      {/* Collapsible Sidebar */}
      {isSidebarCollapsed ? (
        <button
          onClick={() => setIsSidebarCollapsed(false)}
          className="h-full w-10 shrink-0 rounded-2xl border border-slate-100 bg-white text-slate-400 shadow-sm hover:text-indigo-600 hover:border-indigo-200 transition-colors flex items-start justify-center pt-4"
          title="Hiện bộ lọc"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      ) : (
        <aside className="w-64 shrink-0 h-full min-h-0 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
          {/* Sidebar Header */}
          <div className="px-4 min-h-[60px] border-b border-slate-100 shrink-0 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-widest">
              {sidebarTitle}
            </h2>
            <div className="flex items-center gap-2">
              {hasActiveFilters && onClearFilters && (
                <button
                  onClick={onClearFilters}
                  className="text-2xs text-indigo-600 font-normal hover:underline"
                >
                  Xóa lọc
                </button>
              )}
              <button
                onClick={() => setIsSidebarCollapsed(true)}
                className="h-7 w-7 rounded-lg border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 flex items-center justify-center transition-colors"
                title="Ẩn bộ lọc"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            {sidebar}
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="shrink-0">
          {toolbar}
        </div>

        {/* Table/Content */}
        <div className="flex-1 min-h-0 overflow-auto">
          {children}
        </div>

        {/* Pagination */}
        {pagination && (
          <div className="border-t border-slate-100 shrink-0">
            {pagination}
          </div>
        )}
      </div>
    </div>
  );
};
