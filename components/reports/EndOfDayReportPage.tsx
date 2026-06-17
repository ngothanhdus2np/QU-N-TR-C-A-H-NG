import React from 'react';
import type { Employee, POSOrder, SalesRecord } from '../../types';
import EndOfDayReport from '../pos/EndOfDayReport';

interface EndOfDayReportPageProps {
  orders: POSOrder[];
  employees?: Employee[];
  sales?: SalesRecord[];
  onUpdateSales?: (records: SalesRecord[]) => void;
  storeName?: string;
}

const EndOfDayReportPage: React.FC<EndOfDayReportPageProps> = ({
  orders,
  employees = [],
  storeName,
}) => (
  <div className="h-full min-h-0 overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
    <EndOfDayReport
      embedded
      orders={orders}
      employees={employees}
      storeName={storeName}
      onClose={() => {}}
    />
  </div>
);

export default EndOfDayReportPage;
