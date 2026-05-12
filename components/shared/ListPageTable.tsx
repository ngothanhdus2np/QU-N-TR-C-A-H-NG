import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export interface TableColumn<T = Record<string, unknown>> {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  render?: (item: T, index: number) => React.ReactNode;
  headerRender?: () => React.ReactNode;
}

interface ListPageTableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  onRowClick?: (item: T, index: number) => void;
  emptyState?: React.ReactNode;
  rowClassName?: (item: T, index: number) => string;
  stickyHeader?: boolean;
}

/**
 * Generic table component for list pages
 * Features: Sorting, custom rendering, row selection
 */
export function ListPageTable<T>({
  columns,
  data,
  keyExtractor,
  sortKey,
  sortDirection,
  onSort,
  onRowClick,
  emptyState,
  rowClassName,
  stickyHeader = true,
}: ListPageTableProps<T>) {
  const getValue = (item: T, key: string) => {
    if (item && typeof item === 'object' && key in item) {
      return (item as Record<string, unknown>)[key] as React.ReactNode;
    }
    return null;
  };

  const getSortIcon = (columnKey: string) => {
    if (sortKey !== columnKey) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-slate-300" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5 text-indigo-600" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-indigo-600" />
    );
  };

  return (
    <table className="w-full border-collapse text-sm">
      <thead className={`bg-slate-50 border-b border-slate-200 ${stickyHeader ? 'sticky top-0 z-10' : ''}`}>
        <tr>
          {columns.map(col => (
            <th
              key={col.key}
              className={`px-4 py-3 font-bold text-[11px] uppercase tracking-widest text-slate-700 border-r border-slate-100 last:border-r-0 ${
                col.align === 'center'
                  ? 'text-center'
                  : col.align === 'right'
                    ? 'text-right'
                    : 'text-left'
              } ${col.width ? col.width : ''}`}
            >
              {col.headerRender ? (
                col.headerRender()
              ) : col.sortable && onSort ? (
                <button
                  onClick={() => onSort(col.key)}
                  className="flex items-center gap-2 hover:text-indigo-600 transition-colors w-full"
                >
                  <span className="flex-1">{col.label}</span>
                  {getSortIcon(col.key)}
                </button>
              ) : (
                col.label
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className="py-20 text-center">
              {emptyState || (
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                    <span className="text-3xl text-slate-300">📋</span>
                  </div>
                  <p className="text-sm font-bold text-slate-400">Không có dữ liệu</p>
                </div>
              )}
            </td>
          </tr>
        ) : (
          data.map((item, index) => (
            <tr
              key={keyExtractor(item, index)}
              onClick={event => {
                const target = event.target as HTMLElement;
                if (target.closest('button,input,a,select,textarea,label')) return;
                onRowClick?.(item, index);
              }}
              className={`border-b border-slate-100 transition-colors ${
                onRowClick ? 'cursor-pointer hover:bg-slate-50' : ''
              } ${rowClassName ? rowClassName(item, index) : ''}`}
            >
              {columns.map(col => (
                <td
                  key={col.key}
                  className={`px-4 py-3 border-r border-slate-50 last:border-r-0 ${
                    col.align === 'center'
                      ? 'text-center'
                      : col.align === 'right'
                        ? 'text-right'
                        : 'text-left'
                  }`}
                >
                  {col.render ? col.render(item, index) : getValue(item, col.key)}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
