import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronRight } from 'lucide-react';

interface FilterCheckboxGroupProps {
  label: string;
  options: { value: string; label: string; count?: number }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  searchable?: boolean;
  placeholder?: string;
  maxHeight?: string;
}

/**
 * Checkbox group filter with popup on the right (like GoodsFilterSidebar)
 */
export const FilterCheckboxGroup: React.FC<FilterCheckboxGroupProps> = ({
  label,
  options,
  selected,
  onChange,
  searchable = true,
  placeholder = 'Tìm kiếm...',
  maxHeight = 'max-h-64',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [pendingSelected, setPendingSelected] = useState<string[]>([]);
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  // Close popup when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const popup = document.getElementById(`filter-popup-${label}`);
      const trigger = triggerRef.current;
      if (
        popup &&
        !popup.contains(e.target as Node) &&
        trigger &&
        !trigger.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, label]);

  const filteredOptions = searchable
    ? options.filter(opt => opt.label.toLowerCase().includes(searchTerm.toLowerCase()))
    : options;

  const handleToggle = (value: string) => {
    if (pendingSelected.includes(value)) {
      setPendingSelected(pendingSelected.filter(v => v !== value));
    } else {
      setPendingSelected([...pendingSelected, value]);
    }
  };

  const handleToggleAll = () => {
    if (pendingSelected.length === options.length) {
      setPendingSelected([]);
    } else {
      setPendingSelected(options.map(opt => opt.value));
    }
  };

  const handleOpen = () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPopupPos({ top: rect.top, left: rect.right + 8, width: 320 });
    }
    setPendingSelected([...selected]);
    setSearchTerm('');
    setIsOpen(true);
  };

  const handleApply = () => {
    onChange(pendingSelected);
    setIsOpen(false);
  };

  return (
    <>
      {/* Popup */}
      {isOpen && (
        <div
          id={`filter-popup-${label}`}
          style={{
            position: 'fixed',
            top: popupPos.top,
            left: popupPos.left,
            width: popupPos.width,
            zIndex: 9999,
          }}
          className="bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden max-h-[80vh]"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
            <span className="text-sm font-normal text-slate-800">{label}</span>
          </div>
          
          {searchable && (
            <div className="px-3 py-2 border-b border-slate-100 shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  autoFocus
                  type="text"
                  placeholder={placeholder}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-indigo-400 rounded-lg outline-none bg-white"
                />
              </div>
            </div>
          )}
          
          <div className={`overflow-y-auto ${maxHeight} flex-1`}>
            {filteredOptions.map(opt => (
              <label
                key={opt.value}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-b-0"
              >
                <input
                  type="checkbox"
                  checked={pendingSelected.includes(opt.value)}
                  onChange={() => handleToggle(opt.value)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <span className="flex-1 text-sm text-slate-700">{opt.label}</span>
                {opt.count !== undefined && (
                  <span className="text-xs text-slate-400 tabular-nums">({opt.count})</span>
                )}
              </label>
            ))}
            {filteredOptions.length === 0 && (
              <p className="px-4 py-6 text-sm text-slate-400 text-center">Không tìm thấy</p>
            )}
          </div>
          
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/60 gap-3 shrink-0">
            <button
              onClick={handleToggleAll}
              className="text-sm text-indigo-600 font-normal hover:underline whitespace-normal text-left"
            >
              {pendingSelected.length === options.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </button>
            <button
              onClick={handleApply}
              className="px-5 py-1.5 bg-indigo-600 text-white text-sm font-normal rounded-xl hover:bg-indigo-700 transition-colors shrink-0"
            >
              Áp dụng
            </button>
          </div>
        </div>
      )}

      {/* Trigger */}
      <div
        ref={triggerRef}
        onClick={handleOpen}
        className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-indigo-400 transition-all flex items-center justify-between"
      >
        <span className={selected.length > 0 ? 'text-slate-700 font-normal' : 'text-slate-400'}>
          {selected.length === 0
            ? `Chọn ${label.toLowerCase()}`
            : selected.length === 1
              ? options.find(o => o.value === selected[0])?.label
              : `${selected.length} ${label.toLowerCase()} đã chọn`}
        </span>
        <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
      </div>
    </>
  );
};
