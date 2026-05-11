import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface GoodsPaginationProps {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  totalItems: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
}

export const GoodsPagination: React.FC<GoodsPaginationProps> = ({
  currentPage,
  totalPages,
  itemsPerPage,
  totalItems,
  setCurrentPage,
}) => {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
      <span className="text-xs text-slate-400 font-bold">
        {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, totalItems)} / {totalItems}
      </span>
      <div className="flex items-center gap-1">
        <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
          <ChevronLeft className="h-4 w-4" />
        </button>
        {[...Array(Math.min(5, totalPages))].map((_, i) => {
          const pageNum = currentPage <= 3 ? i + 1 : currentPage >= totalPages - 2 ? totalPages - 4 + i : currentPage - 2 + i;
          if (pageNum < 1 || pageNum > totalPages) return null;
          return (
            <button key={pageNum} onClick={() => setCurrentPage(pageNum)} className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-black transition-all ${currentPage === pageNum ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-white border border-slate-200 text-slate-400 hover:text-indigo-600'}`}>
              {pageNum}
            </button>
          );
        })}
        <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
