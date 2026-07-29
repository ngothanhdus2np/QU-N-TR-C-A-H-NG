import React from 'react';
import { Grid3X3 } from 'lucide-react';

type GoodsColumn = {
  key: string;
  label: string;
  defaultVisible: boolean;
};

interface GoodsColumnSettingsProps {
  columns: GoodsColumn[];
  defaultVisibleColumns: string[];
  visibleColumns: string[];
  setVisibleColumns: React.Dispatch<React.SetStateAction<string[]>>;
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  popupPos: { top: number; left: number; width: number };
  setPopupPos: React.Dispatch<React.SetStateAction<{ top: number; left: number; width: number }>>;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

export const GoodsColumnSettings: React.FC<GoodsColumnSettingsProps> = ({
  columns,
  defaultVisibleColumns,
  visibleColumns,
  setVisibleColumns,
  isOpen,
  setIsOpen,
  popupPos,
  setPopupPos,
  triggerRef,
}) => (
  <>
    <button
      ref={triggerRef}
      title="Cài đặt cột hiển thị"
      onClick={() => {
        if (isOpen) {
          setIsOpen(false);
          return;
        }
        if (triggerRef.current) {
          const rect = triggerRef.current.getBoundingClientRect();
          setPopupPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 340), width: 340 });
        }
        setIsOpen(true);
      }}
      className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl font-normal text-2xs uppercase tracking-wide transition-colors shadow-sm ${isOpen ? 'bg-indigo-50 border-indigo-400 text-indigo-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
    >
      <Grid3X3 className="h-3.5 w-3.5" />
    </button>

    {isOpen && (
      <div
        id="column-visibility-popup"
        style={{ position: 'fixed', top: popupPos.top, left: popupPos.left, width: popupPos.width, zIndex: 9999 }}
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl py-2 overflow-hidden"
      >
        <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
          <span className="text-2xs font-normal uppercase tracking-widest text-slate-600">Chọn cột hiển thị</span>
          <button
            onClick={() => setVisibleColumns(defaultVisibleColumns)}
            className="text-2xs text-indigo-600 font-normal hover:underline"
          >
            Đặt lại mặc định
          </button>
        </div>
        <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
          {['Mã hàng', 'Tên hàng'].map(label => (
            <label key={label} className="flex items-center gap-2 cursor-not-allowed opacity-50 select-none">
              <input type="checkbox" checked readOnly className="rounded border-slate-300 text-indigo-600 pointer-events-none" />
              <span className="text-xs font-normal text-slate-600">{label}</span>
            </label>
          ))}
          {columns.map(col => (
            <label key={col.key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={visibleColumns.includes(col.key)}
                onChange={(e) => setVisibleColumns(e.target.checked
                  ? [...visibleColumns, col.key]
                  : visibleColumns.filter(c => c !== col.key)
                )}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs font-normal text-slate-600">{col.label}</span>
            </label>
          ))}
        </div>
      </div>
    )}
  </>
);
