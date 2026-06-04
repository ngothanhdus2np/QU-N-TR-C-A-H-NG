import React, { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface ReportDropdownOption {
  value: string;
  label: string;
}

interface ReportDropdownFilterProps {
  value: string;
  placeholder: string;
  options: ReportDropdownOption[];
  onChange: (value: string) => void;
  allowAll?: boolean;
}

export const getReportDropdownOptions = (values: Array<string | undefined | null>) =>
  Array.from(new Set(values.map(value => value?.trim()).filter(Boolean) as string[]))
    .sort((a, b) => a.localeCompare(b, 'vi'))
    .map(value => ({ value, label: value }));

const ReportDropdownFilter: React.FC<ReportDropdownFilterProps> = ({
  value,
  placeholder,
  options,
  onChange,
  allowAll = true,
}) => {
  const [open, setOpen] = useState(false);
  const visibleOptions = useMemo(
    () => (allowAll && options.length > 0 ? [{ value: '', label: 'Tất cả' }, ...options] : options),
    [allowAll, options]
  );
  const selectedLabel = options.find(option => option.value === value)?.label || placeholder;

  return (
    <div className="relative mt-2">
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        className={`flex h-9 w-full items-center justify-between rounded-md border bg-white px-3 text-left text-sm transition ${
          open ? 'border-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,0.25)]' : 'border-slate-200'
        } ${value ? 'text-slate-700' : 'text-slate-400'}`}
      >
        <span className="truncate">{value ? selectedLabel : placeholder}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-30 max-h-56 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg">
          {visibleOptions.length > 0 ? (
            visibleOptions.map(option => (
              <button
                key={option.value || 'all'}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center px-3 py-2 text-left transition hover:bg-blue-50 ${
                  option.value === value ? 'font-semibold text-blue-600' : 'text-slate-700'
                }`}
              >
                {option.label}
              </button>
            ))
          ) : (
            <div className="px-3 py-3 text-sm text-slate-400">Chưa có dữ liệu</div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReportDropdownFilter;
