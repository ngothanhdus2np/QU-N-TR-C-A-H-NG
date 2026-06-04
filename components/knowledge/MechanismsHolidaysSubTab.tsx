import React from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  CalendarCheck as DateIcon,
} from 'lucide-react';
import type { Holiday } from '../../types';

interface MechanismsHolidaysSubTabProps {
  holidays: Holiday[];
  onUpdate: (holidays: Holiday[]) => void;
}

const MONTH_NAMES = [
  'Tháng 1',
  'Tháng 2',
  'Tháng 3',
  'Tháng 4',
  'Tháng 5',
  'Tháng 6',
  'Tháng 7',
  'Tháng 8',
  'Tháng 9',
  'Tháng 10',
  'Tháng 11',
  'Tháng 12',
];

const splitAnnualDate = (value: string) => {
  const [month = '01', day = '01'] = String(value || '01-01').split('-');
  return {
    month: Math.min(Math.max(Number(month) || 1, 1), 12),
    day: Math.min(Math.max(Number(day) || 1, 1), 31),
  };
};

const toAnnualDateValue = (month: number, day: number) =>
  `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const toDisplayAnnualDate = (value: string) => {
  const { month, day } = splitAnnualDate(value);
  return `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}`;
};

const getMonthDays = (monthIndex: number) => {
  const year = 2024; // Leap year so 29/02 can be configured for annual holidays.
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const leadingBlanks = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const cells: Array<{ day: number; inMonth: boolean }> = [];

  for (let index = 0; index < leadingBlanks; index++) cells.push({ day: 0, inMonth: false });
  for (let day = 1; day <= daysInMonth; day++) cells.push({ day, inMonth: true });
  while (cells.length % 7 !== 0) cells.push({ day: 0, inMonth: false });

  return cells;
};

interface AnnualHolidayDatePickerProps {
  value: string;
  onChange: (value: string) => void;
}

const AnnualHolidayDatePicker: React.FC<AnnualHolidayDatePickerProps> = ({ value, onChange }) => {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = React.useState(false);
  const [viewMonth, setViewMonth] = React.useState(() => splitAnnualDate(value).month - 1);
  const [popupPosition, setPopupPosition] = React.useState({ top: 0, left: 0 });
  const selected = splitAnnualDate(value);

  const updatePopupPosition = React.useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const popupWidth = 292;
    const left = Math.min(
      Math.max(16, rect.left),
      Math.max(16, window.innerWidth - popupWidth - 16)
    );
    setPopupPosition({ top: rect.bottom + 8, left });
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('resize', updatePopupPosition);
    window.addEventListener('scroll', updatePopupPosition, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('resize', updatePopupPosition);
      window.removeEventListener('scroll', updatePopupPosition, true);
    };
  }, [isOpen, updatePopupPosition]);

  const openPicker = () => {
    setViewMonth(splitAnnualDate(value).month - 1);
    updatePopupPosition();
    setIsOpen(open => !open);
  };

  const moveMonth = (amount: number) => {
    setViewMonth(month => (month + amount + 12) % 12);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={openPicker}
        className="flex w-28 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-xs font-normal text-slate-700 outline-none transition-colors hover:border-indigo-400"
      >
        <span>{toDisplayAnnualDate(value)}</span>
        <Calendar className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {isOpen && (
        <div
          className="fixed z-toast w-[292px] rounded-xl border border-slate-200 bg-white p-3 shadow-2xl"
          style={{ top: popupPosition.top, left: popupPosition.left }}
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="rounded-lg px-3 py-2 text-sm font-normal text-slate-800">
              {MONTH_NAMES[viewMonth]}
            </div>
            <button
              type="button"
              onClick={() => moveMonth(1)}
              className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 border-t border-slate-100 pt-3">
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-normal text-slate-400">
              {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(day => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-1">
              {getMonthDays(viewMonth).map((cell, index) => {
                const isSelected =
                  cell.inMonth && selected.month === viewMonth + 1 && selected.day === cell.day;
                return cell.inMonth ? (
                  <button
                    key={`${viewMonth}-${cell.day}`}
                    type="button"
                    onClick={() => {
                      onChange(toAnnualDateValue(viewMonth + 1, cell.day));
                      setIsOpen(false);
                    }}
                    className={`h-8 rounded-full text-xs font-normal transition ${
                      isSelected
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-800 hover:bg-indigo-50 hover:text-indigo-600'
                    }`}
                  >
                    {cell.day}
                  </button>
                ) : (
                  <span key={`blank-${viewMonth}-${index}`} className="h-8" />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const MechanismsHolidaysSubTab: React.FC<MechanismsHolidaysSubTabProps> = ({
  holidays,
  onUpdate,
}) => {
  const handleAddHoliday = () => {
    const newHoliday: Holiday = {
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `holiday-${Date.now()}`,
      date: '01-01',
      name: 'Mới',
    };
    onUpdate([newHoliday, ...holidays]);
  };

  const handleUpdateHoliday = (id: string, field: keyof Holiday, value: string) => {
    onUpdate(holidays.map(item => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const handleRemoveHoliday = (id: string) => {
    onUpdate(holidays.filter(item => item.id !== id));
  };

  return (
    <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-rose-500 text-white rounded-2xl shadow-lg">
            <DateIcon className="w-6 h-6" />
          </div>
          <h4 className="text-xl font-semibold text-slate-900 uppercase tracking-tight">
            Ngày Lễ (x2 Lương)
          </h4>
        </div>
        <button
          type="button"
          onClick={handleAddHoliday}
          className="p-3 bg-slate-900 text-white rounded-xl shadow-lg hover:bg-indigo-600 transition-colors"
          title="Thêm ngày lễ"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
      <div className="space-y-4">
        {holidays.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
            Chưa có ngày lễ. Bấm nút + để thêm ngày lễ mới.
          </div>
        )}
        {holidays.map(h => (
          <div
            key={h.id}
            className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 group"
          >
            <AnnualHolidayDatePicker
              value={h.date}
              onChange={date => handleUpdateHoliday(h.id, 'date', date)}
            />
            <input
              type="text"
              value={h.name}
              placeholder="Tên ngày lễ..."
              onChange={e => handleUpdateHoliday(h.id, 'name', e.target.value)}
              className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl font-normal text-sm outline-none focus:border-indigo-500"
            />
            <button
              onClick={() => handleRemoveHoliday(h.id)}
              className="p-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default React.memo(MechanismsHolidaysSubTab);
