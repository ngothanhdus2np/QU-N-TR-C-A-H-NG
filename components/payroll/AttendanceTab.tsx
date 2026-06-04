import React from 'react';
import { Employee } from '../../types';
import { ListChecks } from 'lucide-react';
import { isStaffActive } from '../../src/lib';

interface Props {
  employees: Employee[];
  daysArray: number[];
  selectedMonth: string;
  isHoliday: (day: number) => boolean;
  getAttendanceCellValue: (employeeId: string, day: number) => string;
  handleAttendanceInputChange: (emp: Employee, day: number, value: string) => void;
  calculateTotalHours: (employeeId: string) => number;
}

interface AttendanceCellProps {
  employee: Employee;
  day: number;
  value: string;
  isHolidayDay: boolean;
  onChange: (emp: Employee, day: number, value: string) => void;
}

const ATTENDANCE_OPTIONS = ['11', 'CP', 'KP'];

const isShortWorkday = (value: string) => {
  const normalizedValue = value.trim().replace(',', '.');
  if (!normalizedValue || Number.isNaN(Number(normalizedValue))) return false;
  return Number(normalizedValue) < 11;
};

const AttendanceCell: React.FC<AttendanceCellProps> = ({
  employee,
  day,
  value,
  isHolidayDay,
  onChange,
}) => {
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const popupRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = React.useState(false);
  const [draftValue, setDraftValue] = React.useState(value);
  const [popupPosition, setPopupPosition] = React.useState({ top: 0, left: 0, width: 42 });

  const updatePopupPosition = React.useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPopupPosition({ top: rect.bottom, left: rect.left, width: rect.width });
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !popupRef.current?.contains(target)) {
        setIsOpen(false);
      }
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

  React.useEffect(() => {
    if (!isOpen) return;
    setDraftValue(value);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [isOpen, value]);

  const commitValue = (nextValue: string) => {
    const normalizedNextValue = nextValue.trim();
    if (!normalizedNextValue) {
      setIsOpen(false);
      return;
    }
    onChange(employee, day, normalizedNextValue);
    setIsOpen(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          updatePopupPosition();
          setIsOpen(prev => !prev);
        }}
        className={`h-full w-full bg-transparent text-center text-xs font-normal outline-none transition-colors focus:bg-white ${
          isShortWorkday(value) ? 'text-red-600 font-bold' : 'text-slate-700'
        }`}
      >
        {value}
      </button>
      {isOpen && (
        <div
          ref={popupRef}
          style={{
            position: 'fixed',
            top: popupPosition.top,
            left: popupPosition.left,
            width: popupPosition.width,
            zIndex: 9999,
          }}
          className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
        >
          <input
            ref={inputRef}
            value={draftValue}
            onChange={event => setDraftValue(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') commitValue(draftValue);
              if (event.key === 'Escape') setIsOpen(false);
            }}
            onBlur={() => commitValue(draftValue)}
            className={`h-8 w-full border-b border-slate-100 bg-white px-1 text-center text-xs font-semibold outline-none focus:bg-indigo-50 ${
              isShortWorkday(draftValue) ? 'text-red-600' : 'text-slate-800'
            }`}
          />
          {ATTENDANCE_OPTIONS.map(option => (
            <button
              key={option}
              type="button"
              onMouseDown={event => event.preventDefault()}
              onClick={() => {
                commitValue(option);
              }}
              className={`block h-8 w-full text-center text-xs font-semibold transition-colors hover:bg-indigo-50 hover:text-indigo-700 ${
                value === option ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'
              } ${isHolidayDay ? 'bg-amber-50/30' : ''}`}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </>
  );
};

const AttendanceTab: React.FC<Props> = ({
  employees, daysArray, selectedMonth, isHoliday,
  getAttendanceCellValue, handleAttendanceInputChange, calculateTotalHours,
}) => (
  <div className="animate-in fade-in duration-300 space-y-4">
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><ListChecks className="w-5 h-5" /></div>
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tighter">Bảng Chấm Công Tháng {selectedMonth}</h3>
      </div>
    </div>
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 pt-3">
        <div className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-600">
          <span className="font-bold text-slate-700">Chú thích:</span>
          <span><b className="text-slate-900">11</b> = đi làm đủ</span>
          <span><b className="text-slate-900">CP</b> = nghỉ có phép</span>
          <span><b className="text-slate-900">KP</b> = nghỉ không phép</span>
        </div>
      </div>
      <div className="overflow-x-auto max-h-[70vh]">
        <table className="w-full text-left border-collapse table-fixed">
          <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-30 backdrop-blur-sm bg-slate-50/90">
            <tr>
              <th className="px-6 py-4 text-2xs font-semibold text-slate-500 uppercase sticky left-0 top-0 bg-slate-50 z-40 border-r border-slate-100 w-[200px]">Nhân viên</th>
              {daysArray.map(day => (
                <th key={day} className={`px-1 py-4 text-center text-2xs font-semibold w-[42px] border-r border-slate-100/50 ${isHoliday(day) ? 'bg-amber-50 text-amber-600' : 'text-slate-400'}`}>{day}</th>
              ))}
              <th className="px-3 py-4 text-center text-2xs font-semibold text-indigo-600 uppercase bg-indigo-50 sticky right-0 top-0 z-40 border-l border-slate-200 w-[60px] shadow-[-2px_0_5_rgba(0,0,0,0.02)]">Tổng</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {employees.map(emp => {
              return (
                <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-3 sticky left-0 bg-white z-10 border-r border-slate-100 shadow-[2px_0_5_rgba(0,0,0,0.02)]">
                    <p className={`text-sm font-normal truncate ${isStaffActive(emp) ? 'text-slate-800' : 'text-slate-400'}`}>{emp.name}</p>
                    <p className="text-2xs text-slate-400 truncate">{emp.position}</p>
                  </td>
                  {daysArray.map(day => (
                    <td key={day} className={`p-0 text-center border-r border-slate-100/50 h-12 ${isHoliday(day) ? 'bg-amber-50/30' : ''}`}>
                      <AttendanceCell
                        employee={emp}
                        day={day}
                        value={getAttendanceCellValue(emp.id, day)}
                        isHolidayDay={isHoliday(day)}
                        onChange={handleAttendanceInputChange}
                      />
                    </td>
                  ))}
                  <td className="bg-indigo-50 text-center font-normal text-indigo-700 text-xs border-l border-slate-200 sticky right-0 z-10 shadow-[-2px_0_5_rgba(0,0,0,0.02)]">{calculateTotalHours(emp.id)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

export default AttendanceTab;
