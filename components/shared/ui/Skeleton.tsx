import React from 'react';

export interface SkeletonProps {
  className?: string;
  /** Số lượng skeleton rows (default 1) */
  count?: number;
}

/** Skeleton block dùng CSS animation — không cần framer-motion */
export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  count = 1,
}) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className={`animate-pulse bg-slate-200 rounded-lg ${className}`}
      />
    ))}
  </>
);

/** Skeleton cho 1 row trong table (icon + 2 text lines) */
export const TableRowSkeleton: React.FC<{ cols?: number }> = ({
  cols = 5,
}) => (
  <tr className="border-b border-slate-100">
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <Skeleton className="h-4 w-full" />
      </td>
    ))}
  </tr>
);

/** Skeleton cho bảng danh sách (header + n rows) */
export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 8,
  cols = 5,
}) => (
  <table className="w-full">
    <thead>
      <tr className="border-b border-slate-200 bg-slate-50">
        {Array.from({ length: cols }).map((_, i) => (
          <th key={i} className="px-4 py-3">
            <Skeleton className="h-3 w-3/4" />
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} cols={cols} />
      ))}
    </tbody>
  </table>
);

/** Skeleton cho card KPI / dashboard */
export const CardSkeleton: React.FC = () => (
  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-card space-y-3">
    <div className="flex items-center gap-3">
      <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
      <Skeleton className="h-3 w-24" />
    </div>
    <Skeleton className="h-7 w-32" />
    <Skeleton className="h-3 w-20" />
  </div>
);
