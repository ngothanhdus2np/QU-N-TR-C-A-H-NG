import React, { useState } from 'react';
import { ExpenseRecord, ExpenseCategory, RevenueRecord, PayrollRecord, ProductGroupRevenue, DiagnosisRange } from '../../types';
import TimeFilter from '../TimeFilter';
import { useExpenseAnalytics } from './useExpenseAnalytics';
import { ExpenseEfficiencyTab } from './ExpenseEfficiencyTab';

interface Props {
  list: ExpenseRecord[];
  categories: ExpenseCategory[];
  revenueList: RevenueRecord[];
  shopeeProductGroupRevenue: ProductGroupRevenue[];
  payrolls: PayrollRecord[];
}

const ExpenseOverviewPage: React.FC<Props> = ({
  list, categories, revenueList, shopeeProductGroupRevenue, payrolls,
}) => {
  const today = new Date().toLocaleDateString('sv-SE');
  const [diagnosisRange, setDiagnosisRange] = useState<DiagnosisRange>('thisMonth');
  const [diagStartDate, setDiagStartDate] = useState(today);
  const [diagEndDate, setDiagEndDate] = useState(today);

  const { timeContext, efficiencyData, misMetrics } = useExpenseAnalytics({
    list,
    categories,
    revenueList,
    shopeeProductGroupRevenue,
    payrolls,
    diagnosisRange,
    diagStartDate,
    diagEndDate,
  });

  const formatNumber = (num: number) => Math.round(num || 0).toLocaleString('vi-VN');

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50">
      <div className="flex min-h-[58px] items-center justify-end border-b border-slate-100 bg-slate-50 px-4 shrink-0">
        <TimeFilter
          diagnosisRange={diagnosisRange}
          setDiagnosisRange={setDiagnosisRange}
          diagStartDate={diagStartDate}
          setDiagStartDate={setDiagStartDate}
          diagEndDate={diagEndDate}
          setDiagEndDate={setDiagEndDate}
          variant="range"
        />
      </div>
      <div className="flex-1 p-6">
        <ExpenseEfficiencyTab
          timeContext={timeContext}
          efficiencyData={efficiencyData}
          misMetrics={misMetrics}
          formatNumber={formatNumber}
        />
      </div>
    </div>
  );
};

export default ExpenseOverviewPage;
