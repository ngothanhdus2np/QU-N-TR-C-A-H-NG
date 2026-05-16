import React from 'react';

interface FilterSectionProps {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}

/**
 * Generic filter section wrapper
 * Used in sidebar filters
 */
export const FilterSection: React.FC<FilterSectionProps> = ({ title, children, action }) => {
  return (
    <div className="px-4 py-3 border-b border-slate-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-normal text-slate-700">{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
};
