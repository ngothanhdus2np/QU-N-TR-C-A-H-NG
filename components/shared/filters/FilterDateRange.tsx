import React, { useState } from 'react';
import TimeFilter from '../../TimeFilter';
import type { DiagnosisRange } from '../../../types';

interface FilterDateRangeProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  presets?: { label: string; value: () => { start: string; end: string } }[];
  confirmLabel?: string;
  transformRange?: (range: { start: string; end: string }) => { start: string; end: string };
}

/**
 * Date range filter component
 */
export const FilterDateRange: React.FC<FilterDateRangeProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  confirmLabel = 'Áp dụng',
  transformRange,
}) => {
  const [range, setRange] = useState<DiagnosisRange>('custom');

  const handleRangeChange = (nextRange: DiagnosisRange) => {
    setRange(nextRange);
  };

  return (
    <TimeFilter
      diagnosisRange={range}
      setDiagnosisRange={handleRangeChange}
      diagStartDate={startDate}
      setDiagStartDate={onStartDateChange}
      diagEndDate={endDate}
      setDiagEndDate={onEndDateChange}
      variant="range"
      confirmLabel={confirmLabel}
      transformRange={transformRange}
    />
  );
};
