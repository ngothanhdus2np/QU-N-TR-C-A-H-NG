import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { DiagnosisRange } from '../types';

interface TimeFilterProps {
  diagnosisRange: DiagnosisRange;
  setDiagnosisRange: (range: DiagnosisRange) => void;
  diagStartDate: string;
  setDiagStartDate: (date: string) => void;
  diagEndDate: string;
  setDiagEndDate: (date: string) => void;
  confirmLabel?: string;
  variant?: 'analysis' | 'range';
  transformRange?: (range: { start: string; end: string }) => { start: string; end: string };
}

type PickerMode = 'week' | 'month' | 'quarter' | 'year';
type QuickPreset = {
  label: string;
  range?: DiagnosisRange;
  resolve?: () => { start: string; end: string };
};

const toDateString = (date: Date) => date.toLocaleDateString('sv-SE');
const formatDisplayDate = (date: string) => date.split('-').reverse().join('/');
const parseDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};
const getMonthEnd = (year: number, monthIndex: number) =>
  toDateString(new Date(year, monthIndex + 1, 0));
const monthLabel = (date: Date) => `Tháng ${date.getMonth() + 1} ${date.getFullYear()}`;
const addMonths = (date: Date, amount: number) =>
  new Date(date.getFullYear(), date.getMonth() + amount, 1);
const getWeekRange = (date: Date, offset = 0) => {
  const start = new Date(date);
  const day = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - day + offset * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: toDateString(start), end: toDateString(end) };
};
const getQuarterRange = (date: Date, offset = 0) => {
  const quarter = Math.floor(date.getMonth() / 3) + offset;
  const startMonth = quarter * 3;
  const start = new Date(date.getFullYear(), startMonth, 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 3, 0);
  return { start: toDateString(start), end: toDateString(end) };
};
const getYearRange = (date: Date, offset = 0) => {
  const year = date.getFullYear() + offset;
  return {
    start: toDateString(new Date(year, 0, 1)),
    end: toDateString(new Date(year, 11, 31)),
  };
};
const getRangeForDiagnosis = (range: DiagnosisRange, baseDate: Date) => {
  const yesterday = new Date(baseDate);
  yesterday.setDate(baseDate.getDate() - 1);
  const last7 = new Date(baseDate);
  last7.setDate(baseDate.getDate() - 6);
  const thisMonthStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const lastMonthStart = new Date(baseDate.getFullYear(), baseDate.getMonth() - 1, 1);
  const lastMonthEnd = new Date(baseDate.getFullYear(), baseDate.getMonth(), 0);
  const thisYearStart = new Date(baseDate.getFullYear(), 0, 1);

  switch (range) {
    case 'today':
      return { start: toDateString(baseDate), end: toDateString(baseDate) };
    case 'yesterday':
      return { start: toDateString(yesterday), end: toDateString(yesterday) };
    case 'last7':
      return { start: toDateString(last7), end: toDateString(baseDate) };
    case 'thisMonth':
      return { start: toDateString(thisMonthStart), end: toDateString(baseDate) };
    case 'lastMonth':
      return { start: toDateString(lastMonthStart), end: toDateString(lastMonthEnd) };
    case 'thisYear':
      return { start: toDateString(thisYearStart), end: toDateString(baseDate) };
    case 'all':
      return { start: '', end: '' };
    case 'custom':
      return { start: '', end: '' };
  }
};

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

const TimeFilter: React.FC<TimeFilterProps> = ({
  diagnosisRange,
  setDiagnosisRange,
  diagStartDate,
  setDiagStartDate,
  diagEndDate,
  setDiagEndDate,
  confirmLabel = 'Áp dụng',
  variant = 'analysis',
  transformRange,
}) => {
  const today = useMemo(() => new Date(), []);
  const [isOpen, setIsOpen] = useState(false);
  const [isQuickOpen, setIsQuickOpen] = useState(false);
  const [quickLabel, setQuickLabel] = useState('');
  const [pickerMode, setPickerMode] = useState<PickerMode>('month');
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [draftStart, setDraftStart] = useState('');
  const [draftEnd, setDraftEnd] = useState('');
  const [leftMonth, setLeftMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [rightMonth, setRightMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [leftPanelMode, setLeftPanelMode] = useState<'days' | 'months'>('days');
  const [rightPanelMode, setRightPanelMode] = useState<'days' | 'months'>('days');
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const quickButtonRef = useRef<HTMLButtonElement>(null);
  const [rangePopupPosition, setRangePopupPosition] = useState({ top: 16, left: 16 });
  const [quickPopupPosition, setQuickPopupPosition] = useState({ top: 16, left: 16 });

  const currentRange = useMemo(() => {
    const resolved =
      diagnosisRange === 'custom'
        ? { start: diagStartDate, end: diagEndDate }
        : getRangeForDiagnosis(diagnosisRange, new Date());
    return transformRange ? transformRange(resolved) : resolved;
  }, [diagnosisRange, diagStartDate, diagEndDate, transformRange]);

  const displayLabel =
    diagnosisRange === 'all' || (!currentRange.start && !currentRange.end)
      ? 'Toàn thời gian'
      : currentRange.start && currentRange.end
        ? `${formatDisplayDate(currentRange.start)} - ${formatDisplayDate(currentRange.end)}`
        : currentRange.start
          ? `Từ ${formatDisplayDate(currentRange.start)}`
          : `Đến ${formatDisplayDate(currentRange.end)}`;

  const rangeLabel =
    quickLabel ||
    ({
      today: 'Hôm nay',
      yesterday: 'Hôm qua',
      last7: '7 ngày qua',
      thisMonth: 'Tháng này',
      lastMonth: 'Tháng trước',
      thisYear: 'Năm nay',
      all: 'Toàn thời gian',
      custom: 'Tùy chỉnh',
    } satisfies Record<DiagnosisRange, string>)[diagnosisRange];

  const quickGroups = useMemo(() => {
    const todayStart = toDateString(today);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const last7 = new Date(today);
    last7.setDate(today.getDate() - 6);
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    const rolling30 = new Date(today);
    rolling30.setDate(today.getDate() - 29);
    const lastYear = getYearRange(today, -1);

    return [
      {
        title: 'Theo ngày',
        presets: [
          { label: 'Hôm nay', range: 'today' as DiagnosisRange },
          { label: 'Hôm qua', range: 'yesterday' as DiagnosisRange },
        ],
      },
      {
        title: 'Theo tuần',
        presets: [
          { label: 'Tuần này', resolve: () => getWeekRange(today) },
          { label: 'Tuần trước', resolve: () => getWeekRange(today, -1) },
          { label: '7 ngày qua', range: 'last7' as DiagnosisRange, resolve: () => ({ start: toDateString(last7), end: todayStart }) },
        ],
      },
      {
        title: 'Theo tháng',
        presets: [
          { label: 'Tháng này', range: 'thisMonth' as DiagnosisRange },
          { label: 'Tháng trước', range: 'lastMonth' as DiagnosisRange },
          { label: 'Tháng này (âm lịch)', resolve: () => ({ start: toDateString(thisMonthStart), end: todayStart }) },
          { label: 'Tháng trước (âm lịch)', resolve: () => ({ start: toDateString(lastMonthStart), end: toDateString(lastMonthEnd) }) },
          { label: '30 ngày qua', resolve: () => ({ start: toDateString(rolling30), end: todayStart }) },
        ],
      },
      {
        title: 'Theo quý',
        presets: [
          { label: 'Quý này', resolve: () => getQuarterRange(today) },
          { label: 'Quý trước', resolve: () => getQuarterRange(today, -1) },
        ],
      },
      {
        title: 'Theo năm',
        presets: [
          { label: 'Năm nay', range: 'thisYear' as DiagnosisRange },
          { label: 'Năm trước', resolve: () => lastYear },
          { label: 'Năm nay (âm lịch)', resolve: () => getYearRange(today) },
          { label: 'Năm trước (âm lịch)', resolve: () => lastYear },
        ],
      },
    ];
  }, [today]);

  useEffect(() => {
    if (!isOpen && !isQuickOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setIsQuickOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen, isQuickOpen]);

  const positionRangePopup = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect || typeof window === 'undefined') return;

    const popupWidth = Math.min(580, window.innerWidth - 32);
    const popupHeight = Math.min(430, window.innerHeight - 32);
    const preferredLeft = rect.right + 8;
    const left =
      preferredLeft + popupWidth <= window.innerWidth - 16
        ? preferredLeft
        : Math.max(16, rect.left - popupWidth - 8);
    const preferredTop = rect.top;
    const top = Math.min(
      Math.max(16, preferredTop),
      Math.max(16, window.innerHeight - popupHeight - 16)
    );

    setRangePopupPosition({ top, left });
  };

  const positionQuickPopup = () => {
    const rect = quickButtonRef.current?.getBoundingClientRect();
    if (!rect || typeof window === 'undefined') return;

    const popupWidth = Math.min(700, window.innerWidth - 32);
    const popupHeight = Math.min(360, window.innerHeight - 32);
    const preferredLeft = rect.right + 8;
    const left =
      preferredLeft + popupWidth <= window.innerWidth - 16
        ? preferredLeft
        : Math.max(16, rect.left - popupWidth - 8);
    const preferredTop = rect.top;
    const top = Math.min(
      Math.max(16, preferredTop),
      Math.max(16, window.innerHeight - popupHeight - 16)
    );

    setQuickPopupPosition({ top, left });
  };

  useLayoutEffect(() => {
    if (isOpen) positionRangePopup();
  }, [isOpen]);

  useLayoutEffect(() => {
    if (isQuickOpen) positionQuickPopup();
  }, [isQuickOpen]);

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('resize', positionRangePopup);
    window.addEventListener('scroll', positionRangePopup, true);
    return () => {
      window.removeEventListener('resize', positionRangePopup);
      window.removeEventListener('scroll', positionRangePopup, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isQuickOpen) return;
    window.addEventListener('resize', positionQuickPopup);
    window.addEventListener('scroll', positionQuickPopup, true);
    return () => {
      window.removeEventListener('resize', positionQuickPopup);
      window.removeEventListener('scroll', positionQuickPopup, true);
    };
  }, [isQuickOpen]);

  const openPicker = () => {
    const start = currentRange.start || toDateString(today);
    const end = currentRange.end || start;
    setDraftStart(start);
    setDraftEnd(end);
    setLeftMonth(new Date(parseDate(start).getFullYear(), parseDate(start).getMonth(), 1));
    setRightMonth(new Date(parseDate(end).getFullYear(), parseDate(end).getMonth(), 1));
    setLeftPanelMode('days');
    setRightPanelMode('days');
    setIsQuickOpen(false);
    setIsOpen(open => !open);
  };

  const openQuickPicker = () => {
    setIsOpen(false);
    setIsQuickOpen(open => !open);
  };

  const applyRange = (range: DiagnosisRange) => {
    setQuickLabel('');
    if (range !== 'custom') {
      const resolved = transformRange ? transformRange(getRangeForDiagnosis(range, today)) : getRangeForDiagnosis(range, today);
      setDiagStartDate(resolved.start);
      setDiagEndDate(resolved.end);
    }
    setDiagnosisRange(range);
    if (range !== 'custom') setIsOpen(false);
  };

  const applyQuickPreset = (preset: QuickPreset) => {
    setQuickLabel(preset.label);
    if (preset.range && !preset.resolve) {
      const resolved = transformRange
        ? transformRange(getRangeForDiagnosis(preset.range, today))
        : getRangeForDiagnosis(preset.range, today);
      setDiagStartDate(resolved.start);
      setDiagEndDate(resolved.end);
      setDiagnosisRange(preset.range);
      setIsQuickOpen(false);
      return;
    }

    const rawResolved = preset.resolve?.();
    const resolved = rawResolved && transformRange ? transformRange(rawResolved) : rawResolved;
    if (resolved) {
      setDiagStartDate(resolved.start);
      setDiagEndDate(resolved.end);
      setDiagnosisRange(preset.range ?? 'custom');
    } else if (preset.range) {
      setDiagnosisRange(preset.range);
    }
    setIsQuickOpen(false);
  };

  const applyRollingDays = (days: number) => {
    setQuickLabel('');
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    setDiagStartDate(toDateString(start));
    setDiagEndDate(toDateString(end));
    setDiagnosisRange('custom');
    setIsOpen(false);
  };

  const applyMonth = (monthIndex: number) => {
    setQuickLabel('');
    setDiagStartDate(toDateString(new Date(viewYear, monthIndex, 1)));
    setDiagEndDate(getMonthEnd(viewYear, monthIndex));
    setDiagnosisRange('custom');
    setIsOpen(false);
  };

  const applyQuarter = (quarterIndex: number) => {
    setQuickLabel('');
    const startMonth = quarterIndex * 3;
    setDiagStartDate(toDateString(new Date(viewYear, startMonth, 1)));
    setDiagEndDate(getMonthEnd(viewYear, startMonth + 2));
    setDiagnosisRange('custom');
    setIsOpen(false);
  };

  const applyYear = () => {
    setQuickLabel('');
    setDiagStartDate(toDateString(new Date(viewYear, 0, 1)));
    setDiagEndDate(toDateString(new Date(viewYear, 11, 31)));
    setDiagnosisRange('custom');
    setIsOpen(false);
  };

  const handleSelectDate = (date: Date) => {
    const selected = toDateString(date);
    if (!draftStart || (draftStart && draftEnd)) {
      setDraftStart(selected);
      setDraftEnd('');
      return;
    }
    if (selected < draftStart) {
      setDraftEnd(draftStart);
      setDraftStart(selected);
    } else {
      setDraftEnd(selected);
    }
  };

  const handleSelectStartDate = (date: Date) => {
    const selected = toDateString(date);
    setDraftStart(selected);
    if (!draftEnd || selected > draftEnd) setDraftEnd(selected);
  };

  const handleSelectEndDate = (date: Date) => {
    const selected = toDateString(date);
    setDraftEnd(selected);
    if (!draftStart || selected < draftStart) setDraftStart(selected);
  };

  const applyToday = () => {
    const todayStr = toDateString(today);
    setDraftStart(todayStr);
    setDraftEnd(todayStr);
    setLeftMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setRightMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setLeftPanelMode('days');
    setRightPanelMode('days');
  };

  const applyDraft = () => {
    const start = draftStart || toDateString(today);
    const end = draftEnd || start;
    setDiagStartDate(start);
    setDiagEndDate(end);
    setQuickLabel('');
    setDiagnosisRange('custom');
    setIsOpen(false);
  };

  const nowYear = today.getFullYear();
  const nowMonth = today.getMonth();
  const isFuture = (date: Date) => toDateString(date) > toDateString(today);
  const isSelectedMonth = (monthIndex: number) =>
    diagnosisRange === 'custom' &&
    diagStartDate === toDateString(new Date(viewYear, monthIndex, 1)) &&
    diagEndDate === getMonthEnd(viewYear, monthIndex);
  const isSelected = (date: Date) => {
    const key = toDateString(date);
    return key === draftStart || key === draftEnd;
  };
  const isStartSelected = (date: Date) => toDateString(date) === draftStart;
  const isEndSelected = (date: Date) => toDateString(date) === draftEnd;
  const isInRange = (date: Date) => {
    if (!draftStart || !draftEnd) return false;
    const key = toDateString(date);
    return key > draftStart && key < draftEnd;
  };

  const CalendarPanel: React.FC<{
    month: Date;
    onMonthChange: (month: Date) => void;
    mode: 'days' | 'months';
    onModeChange: (mode: 'days' | 'months') => void;
    selection?: 'any' | 'start' | 'end';
  }> = ({
    month,
    onMonthChange,
    mode,
    onModeChange,
    selection = 'any',
  }) => (
    <div className="flex-1 px-3 py-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() =>
            onMonthChange(
              mode === 'months'
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
          onClick={() => onModeChange(mode === 'days' ? 'months' : 'days')}
          className="rounded-lg px-3 py-2 text-sm font-normal text-slate-800 transition hover:bg-slate-50 hover:text-blue-600"
        >
          {mode === 'months' ? month.getFullYear() : monthLabel(month)}
        </button>
        <button
          type="button"
          onClick={() =>
            onMonthChange(
              mode === 'months'
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
        {mode === 'months' ? (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 12 }).map((_, monthIndex) => {
              const monthDate = new Date(month.getFullYear(), monthIndex, 1);
              const isFutureMonth =
                monthDate.getFullYear() > today.getFullYear() ||
                (monthDate.getFullYear() === today.getFullYear() && monthIndex > today.getMonth());
              const selectedMonthDate =
                selection === 'end'
                  ? parseDate(draftEnd || draftStart || toDateString(today))
                  : parseDate(draftStart || toDateString(today));
              const selected =
                selectedMonthDate.getFullYear() === monthDate.getFullYear() &&
                selectedMonthDate.getMonth() === monthDate.getMonth();
              return (
                <button
                  key={monthIndex}
                  type="button"
                  disabled={isFutureMonth}
                  onClick={() => {
                    onMonthChange(monthDate);
                    onModeChange('days');
                  }}
                  className={`h-10 rounded-lg text-xs font-normal transition ${
                    selected
                      ? 'bg-indigo-600 text-white'
                      : isFutureMonth
                        ? 'text-slate-300'
                        : 'text-slate-700 hover:bg-blue-50 hover:text-blue-600'
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
              {getMonthDays(month).map((cell, index) => {
                const disabled = isFuture(cell.date);
                const selected =
                  selection === 'start'
                    ? isStartSelected(cell.date)
                    : selection === 'end'
                      ? isEndSelected(cell.date)
                      : isSelected(cell.date);
                const inRange = selection === 'any' ? isInRange(cell.date) : false;
                const onSelect =
                  selection === 'start'
                    ? handleSelectStartDate
                    : selection === 'end'
                      ? handleSelectEndDate
                      : handleSelectDate;
                return (
                  <button
                    key={`${toDateString(cell.date)}-${index}`}
                    type="button"
                    disabled={disabled}
                    onClick={() => onSelect(cell.date)}
                    className={`h-8 rounded-full text-xs font-normal transition ${
                      selected
                        ? 'bg-indigo-600 text-white'
                        : inRange
                          ? 'bg-blue-50 text-blue-600'
                          : disabled
                            ? 'text-slate-200'
                            : cell.inMonth
                              ? 'text-slate-800 hover:bg-blue-50 hover:text-blue-600'
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
    </div>
  );

  return (
    <div ref={rootRef} className="relative flex w-full flex-col gap-2">
      <button
        ref={quickButtonRef}
        type="button"
        onClick={openQuickPicker}
        className="inline-flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-slate-300"
      >
        <span className="min-w-0 truncate">{rangeLabel}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
      </button>

      <button
        ref={buttonRef}
        type="button"
        onClick={openPicker}
        className="inline-flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-slate-300"
      >
        <span className="min-w-0 truncate">{displayLabel}</span>
        <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </button>

      {isQuickOpen && (
        <div
          className="fixed z-modal w-[min(700px,calc(100vw-32px))] rounded-xl border border-slate-200 bg-white p-4 shadow-2xl"
          style={{ top: quickPopupPosition.top, left: quickPopupPosition.left }}
        >
          <div className="grid grid-cols-5 gap-6">
            {quickGroups.map(group => (
              <div key={group.title}>
                <h3 className="text-sm font-normal text-slate-900">{group.title}</h3>
                <div className="mt-3 flex flex-col gap-2">
                  {group.presets.map(preset => {
                    const active = rangeLabel === preset.label;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => applyQuickPreset(preset)}
                        className={`rounded-full border px-3 py-2 text-sm font-normal transition ${
                          active
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-600'
                        }`}
                      >
                        {preset.label === 'Năm nay (âm lịch)' ? (
                          <span className="flex flex-col leading-tight">
                            <span>Năm nay</span>
                            <span>(âm lịch)</span>
                          </span>
                        ) : (
                          preset.label
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isOpen && variant === 'analysis' && (
        <div className="fixed z-modal flex w-[580px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl" style={{ top: rangePopupPosition.top, left: rangePopupPosition.left }}>
          <div className="w-[220px] border-r border-slate-100 p-2">
            <button type="button" onClick={() => applyRange('last7')} className="w-full rounded-lg px-3 py-2 text-left text-xs font-normal text-slate-700 hover:bg-slate-50">
              Trong 7 ngày qua
            </button>
            <button type="button" onClick={() => applyRollingDays(30)} className="w-full rounded-lg px-3 py-2 text-left text-xs font-normal text-slate-700 hover:bg-slate-50">
              Trong 30 ngày qua
            </button>
            <div className="my-2 border-t border-slate-100" />
            {[
              { id: 'week' as const, label: 'Theo tuần' },
              { id: 'month' as const, label: 'Theo tháng' },
              { id: 'quarter' as const, label: 'Theo quý' },
              { id: 'year' as const, label: 'Theo năm' },
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPickerMode(item.id)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-normal transition ${
                  pickerMode === item.id ? 'bg-blue-50 text-blue-600' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{item.label}</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>

          <div className="flex-1">
            <div className="flex h-12 items-center justify-between border-b border-slate-100 px-4">
              <button type="button" onClick={() => setViewYear(year => year - 1)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-normal text-slate-800">{viewYear}</span>
              <button type="button" onClick={() => setViewYear(year => year + 1)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="p-3">
              {pickerMode === 'month' && (
                <div className="grid grid-cols-3 gap-1.5">
                  {Array.from({ length: 12 }).map((_, monthIndex) => {
                    const isFutureMonth = viewYear > nowYear || (viewYear === nowYear && monthIndex > nowMonth);
                    const selected = isSelectedMonth(monthIndex);
                    return (
                      <button
                        key={monthIndex}
                        type="button"
                        disabled={isFutureMonth}
                        onClick={() => applyMonth(monthIndex)}
                        className={`h-10 rounded-lg text-xs font-normal transition ${
                          selected
                            ? 'bg-indigo-600 text-white'
                            : isFutureMonth
                              ? 'text-slate-300'
                              : 'text-slate-700 hover:bg-blue-50 hover:text-blue-600'
                        }`}
                      >
                        Tháng {monthIndex + 1}
                      </button>
                    );
                  })}
                </div>
              )}
              {pickerMode === 'quarter' && (
                <div className="grid grid-cols-2 gap-2">
                  {[0, 1, 2, 3].map(quarterIndex => (
                    <button key={quarterIndex} type="button" onClick={() => applyQuarter(quarterIndex)} className="h-11 rounded-lg text-xs font-normal text-slate-700 transition hover:bg-blue-50 hover:text-blue-600">
                      Quý {quarterIndex + 1}
                    </button>
                  ))}
                </div>
              )}
              {pickerMode === 'year' && (
                <button type="button" onClick={applyYear} className="h-12 w-full rounded-lg bg-blue-50 text-sm font-normal text-blue-600 transition hover:bg-indigo-600 hover:text-white">
                  Chọn cả năm {viewYear}
                </button>
              )}
              {pickerMode === 'week' && (
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => applyRange('last7')} className="h-11 rounded-lg text-xs font-normal text-slate-700 transition hover:bg-blue-50 hover:text-blue-600">
                    7 ngày qua
                  </button>
                  <button type="button" onClick={() => applyRollingDays(14)} className="h-11 rounded-lg text-xs font-normal text-slate-700 transition hover:bg-blue-50 hover:text-blue-600">
                    14 ngày qua
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isOpen && variant === 'range' && (
        <div
          className="fixed z-modal max-h-[calc(100vh-32px)] w-[min(580px,calc(100vw-32px))] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl"
          style={{ top: rangePopupPosition.top, left: rangePopupPosition.left }}
        >
          <div className="px-4 py-3 text-xs text-slate-500">
            Từ ngày: <span className="font-normal text-slate-900">{formatDisplayDate(draftStart || toDateString(today))}</span>
            <span className="mx-2">-</span>
            Đến ngày: <span className="font-normal text-slate-900">{formatDisplayDate(draftEnd || draftStart || toDateString(today))}</span>
          </div>
          <div className="grid grid-cols-2 border-t border-slate-100">
            <CalendarPanel
              month={leftMonth}
              onMonthChange={setLeftMonth}
              mode={leftPanelMode}
              onModeChange={setLeftPanelMode}
              selection="start"
            />
            <CalendarPanel
              month={rightMonth}
              onMonthChange={setRightMonth}
              mode={rightPanelMode}
              onModeChange={setRightPanelMode}
              selection="end"
            />
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <div className="flex items-center gap-3">
              <button type="button" onClick={applyToday} className="text-sm font-normal text-blue-600 hover:text-blue-700">
                Hôm nay
              </button>
              <button
                type="button"
                onClick={() => {
                  setDiagStartDate('');
                  setDiagEndDate('');
                  setDiagnosisRange('all');
                  setIsOpen(false);
                }}
                className="text-sm font-normal text-slate-400 hover:text-red-500"
              >
                Đặt lại
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-normal text-slate-600 hover:bg-slate-50">
                Bỏ qua
              </button>
              <button type="button" onClick={applyDraft} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-normal text-white hover:bg-indigo-700">
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeFilter;
