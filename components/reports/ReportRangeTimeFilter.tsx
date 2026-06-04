import React, { useState } from 'react';
import TimeFilter from '../TimeFilter';
import type { DiagnosisRange } from '../../types';

interface ReportRangeTimeFilterProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onCustomMode?: () => void;
}

const ReportRangeTimeFilter: React.FC<ReportRangeTimeFilterProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onCustomMode,
}) => {
  const [range, setRange] = useState<DiagnosisRange>('custom');

  const handleRangeChange = (nextRange: DiagnosisRange) => {
    setRange(nextRange);
    onCustomMode?.();
  };

  const handleStartChange = (date: string) => {
    onStartDateChange(date);
    onCustomMode?.();
  };

  const handleEndChange = (date: string) => {
    onEndDateChange(date);
    onCustomMode?.();
  };

  return (
    <TimeFilter
      diagnosisRange={range}
      setDiagnosisRange={handleRangeChange}
      diagStartDate={startDate}
      setDiagStartDate={handleStartChange}
      diagEndDate={endDate}
      setDiagEndDate={handleEndChange}
      variant="range"
      confirmLabel="Tạo báo cáo"
    />
  );
};

export default ReportRangeTimeFilter;
