import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface GoodsPaginationProps {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  totalItems: number;
  totalSkuItems: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  onItemsPerPageChange: (itemsPerPage: number) => void;
}

const PAGE_SIZE_OPTIONS = [15, 30, 50, 100];

export const GoodsPagination: React.FC<GoodsPaginationProps> = ({
  currentPage,
  totalPages,
  itemsPerPage,
  totalItems,
  totalSkuItems,
  setCurrentPage,
  onItemsPerPageChange,
}) => {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);
  const isFirstPage = currentPage <= 1;
  const isLastPage = totalPages <= 1 || currentPage >= totalPages;

  return (
    <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-sm text-slate-700">
        <span className="font-normal">Hiển thị</span>
        <select
          value={itemsPerPage}
          onChange={event => onItemsPerPageChange(Number(event.target.value))}
          className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        >
          {PAGE_SIZE_OPTIONS.map(size => (
            <option key={size} value={size}>
              {size} dòng
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={isFirstPage}
            className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Trang đầu"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={isFirstPage}
            className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Trang trước"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-10 h-8 px-3 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-sm font-normal text-slate-700">
            {totalPages === 0 ? 0 : currentPage}
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={isLastPage}
            className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Trang sau"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={isLastPage}
            className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Trang cuối"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>

        <span className="text-sm text-slate-600 font-normal whitespace-nowrap">
          {startItem} - {endItem} trong {totalItems.toLocaleString('vi-VN')} hàng hóa (
          {totalSkuItems.toLocaleString('vi-VN')} mã hàng)
        </span>
      </div>
    </div>
  );
};
