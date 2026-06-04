import React, { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface SingleDatePickerProps {
  value: string;
  onChange: (date: string) => void;
  className?: string;
}

const today = () => new Date().toISOString().split('T')[0];
const toDateString = (date: Date) => date.toLocaleDateString('sv-SE');
const formatDisplayDate = (date: string) => (date ? date.split('-').reverse().join('/') : '');
const parseDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};
const monthLabel = (date: Date) => `Tháng ${date.getMonth() + 1} ${date.getFullYear()}`;
const addMonths = (date: Date, amount: number) =>
  new Date(date.getFullYear(), date.getMonth() + amount, 1);

const getMonthDays = (monthDate: Date) => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = (new Date(year, month, 1).getDay() + 6) % 7;
  const prevMonthDays = new Date(year, month, 0).getDate();
  const cells: { date: Date; day: number; inMonth: boolean }[] = [];

  for (let index = leadingBlanks; index > 0; index--) {
    cells.push({
      date: new Date(year, month - 1, prevMonthDays - index + 1),
      day: prevMonthDays - index + 1,
      inMonth: false,
    });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: new Date(year, month, day), day, inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const nextDay = cells.length - leadingBlanks - daysInMonth + 1;
    cells.push({ date: new Date(year, month + 1, nextDay), day: nextDay, inMonth: false });
  }

  return cells;
};

export const SingleDatePicker: React.FC<SingleDatePickerProps> = ({
  value,
  onChange,
  className = '',
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const selectedDate = parseDate(value || today());
  const [isOpen, setIsOpen] = useState(false);
  const [pickerView, setPickerView] = useState<'days' | 'months'>('days');
  const [viewMonth, setViewMonth] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  );
  const [popupPosition, setPopupPosition] = useState({ top: 16, left: 16 });

  const positionPopup = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect || typeof window === 'undefined') return;
    const popupWidth = 292;
    const popupHeight = 360;
    const left = Math.min(Math.max(16, rect.left), Math.max(16, window.innerWidth - popupWidth - 16));
    const preferredTop = rect.top - popupHeight - 8;
    const top =
      preferredTop >= 16
        ? preferredTop
        : Math.min(rect.bottom + 8, Math.max(16, window.innerHeight - popupHeight - 16));
    setPopupPosition({ top, left });
  };

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    positionPopup();
    window.addEventListener('resize', positionPopup);
    window.addEventListener('scroll', positionPopup, true);
    return () => {
      window.removeEventListener('resize', positionPopup);
      window.removeEventListener('scroll', positionPopup, true);
    };
  }, [isOpen]);

  const openPicker = () => {
    const base = parseDate(value || today());
    setViewMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    setPickerView('days');
    positionPopup();
    setIsOpen(open => !open);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={openPicker}
        className={`flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 transition hover:border-indigo-300 hover:bg-slate-50 ${className}`}
      >
        <span>{formatDisplayDate(value || today())}</span>
        <Calendar className="h-4 w-4 text-slate-400" />
      </button>

      {isOpen && (
        <div
          className="fixed z-modal w-[292px] rounded-xl border border-slate-200 bg-white p-3 shadow-2xl"
          style={{ top: popupPosition.top, left: popupPosition.left }}
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                setViewMonth(month =>
                  pickerView === 'months'
                    ? new Date(month.getFullYear() - 1, month.getMonth(), 1)
                    : addMonths(month, -1)
                )
              }
              className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setPickerView(view => (view === 'days' ? 'months' : 'days'))}
              className="rounded-lg px-3 py-2 text-sm font-normal text-slate-800 transition hover:bg-slate-50 hover:text-indigo-600"
            >
              {pickerView === 'months' ? viewMonth.getFullYear() : monthLabel(viewMonth)}
            </button>
            <button
              type="button"
              onClick={() =>
                setViewMonth(month =>
                  pickerView === 'months'
                    ? new Date(month.getFullYear() + 1, month.getMonth(), 1)
                    : addMonths(month, 1)
                )
              }
              className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 border-t border-slate-100 pt-3">
            {pickerView === 'months' ? (
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 12 }).map((_, monthIndex) => {
                  const selected =
                    viewMonth.getFullYear() === selectedDate.getFullYear() &&
                    monthIndex === selectedDate.getMonth();
                  return (
                    <button
                      key={monthIndex}
                      type="button"
                      onClick={() => {
                        setViewMonth(new Date(viewMonth.getFullYear(), monthIndex, 1));
                        setPickerView('days');
                      }}
                      className={`h-10 rounded-lg text-xs font-normal transition ${
                        selected
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-600'
                      }`}
                    >
                      Tháng {monthIndex + 1}
                    </button>
                  );
                })}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-7 gap-1 text-center text-xs font-normal text-slate-400">
                  {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(day => (
                    <span key={day}>{day}</span>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-7 gap-1">
                  {getMonthDays(viewMonth).map((cell, index) => {
                    const key = toDateString(cell.date);
                    const selected = key === value;
                    return (
                      <button
                        key={`${key}-${index}`}
                        type="button"
                        onClick={() => {
                          onChange(key);
                          setIsOpen(false);
                        }}
                        className={`h-8 rounded-full text-xs font-normal transition ${
                          selected
                            ? 'bg-indigo-600 text-white'
                            : cell.inMonth
                              ? 'text-slate-800 hover:bg-indigo-50 hover:text-indigo-600'
                              : 'text-slate-400 hover:bg-slate-50'
                        }`}
                      >
                        {cell.day}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => {
                const todayValue = today();
                onChange(todayValue);
                const parsedToday = parseDate(todayValue);
                setViewMonth(new Date(parsedToday.getFullYear(), parsedToday.getMonth(), 1));
                setIsOpen(false);
              }}
              className="text-sm font-normal text-indigo-600 hover:text-indigo-700"
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-normal text-slate-600 hover:bg-slate-50"
            >
              Bỏ qua
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
