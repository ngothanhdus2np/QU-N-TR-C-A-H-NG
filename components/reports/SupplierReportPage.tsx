import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  FileText,
} from 'lucide-react';
import type { InventoryTransaction, Supplier } from '../../types';
import {
  getSupplierReportRows,
  type SupplierReportRow,
} from '../../src/lib/reportCalculations';
import ReportRangeTimeFilter from './ReportRangeTimeFilter';
import ReportDropdownFilter, { getReportDropdownOptions } from './ReportDropdownFilter';
import {
  getLatestDatedItemDate,
  getWeekRange,
  hasDatedItemsInDateRange,
} from './reportDateDefaults';

interface SupplierReportPageProps {
  transactions: InventoryTransaction[];
  suppliers: Supplier[];
  storeName?: string;
}

type SupplierRow = SupplierReportRow;

type ViewMode = 'chart' | 'report';
type DateMode = 'week' | 'custom';

const formatNumber = (value: number) => value.toLocaleString('vi-VN');

const formatDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

const formatAxis = (value: number) => {
  if (value >= 1_000_000_000) return `${Number((value / 1_000_000_000).toFixed(1))} tỷ`;
  if (value >= 1_000_000) return `${Number((value / 1_000_000).toFixed(1))} tr`;
  if (value >= 1000) return `${Math.round(value / 1000)}k`;
  return String(value);
};


const SelectButton: React.FC<{ children: React.ReactNode; active?: boolean; onClick?: () => void }> = ({
  children,
  active,
  onClick,
}) => (
  <button
    onClick={onClick}
    className={`flex h-9 w-full items-center justify-between rounded-md border bg-white px-3 text-left text-sm text-slate-700 ${
      active ? 'border-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,0.25)]' : 'border-slate-200'
    }`}
  >
    <span>{children}</span>
    <ChevronDown className="h-4 w-4 text-slate-500" />
  </button>
);

const SupplierReportPage: React.FC<SupplierReportPageProps> = ({
  transactions,
  suppliers,
  storeName = 'Chi nhánh trung tâm',
}) => {
  const weekRange = useMemo(() => getWeekRange(), []);
  const [viewMode, setViewMode] = useState<ViewMode>('chart');
  const [dateMode, setDateMode] = useState<DateMode>('week');
  const [startDate, setStartDate] = useState(weekRange.start);
  const [endDate, setEndDate] = useState(weekRange.end);
  const [supplierQuery, setSupplierQuery] = useState('');
  useEffect(() => {
    if (dateMode === 'custom') return;
    if (transactions.length === 0 || hasDatedItemsInDateRange(transactions, startDate, endDate)) return;
    const latestDate = getLatestDatedItemDate(transactions);
    if (!latestDate) return;
    const nextRange = getWeekRange(new Date(`${latestDate}T00:00:00`));
    setStartDate(nextRange.start);
    setEndDate(nextRange.end);
    setDateMode('week');
  }, [endDate, startDate, transactions]);
  const createdAt = useMemo(
    () =>
      new Date().toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    []
  );

  const rows = useMemo<SupplierRow[]>(
    () => getSupplierReportRows(transactions, suppliers, { startDate, endDate }, supplierQuery),
    [endDate, startDate, supplierQuery, suppliers, transactions]
  );

  const totals = useMemo(
    () =>
      rows.reduce(
        (sum, row) => ({
          importValue: sum.importValue + row.importValue,
          returnValue: sum.returnValue + row.returnValue,
          netValue: sum.netValue + row.netValue,
        }),
        { importValue: 0, returnValue: 0, netValue: 0 }
      ),
    [rows]
  );
  const supplierOptions = useMemo(
    () => getReportDropdownOptions(suppliers.map(supplier => supplier.name || supplier.code)),
    [suppliers]
  );

  const topRows = rows.slice(0, 10);
  const maxValue = Math.max(...topRows.map(row => row.netValue), 0);
  const axisMax = maxValue > 0 ? Math.ceil(maxValue / 1_000_000) * 1_000_000 : 0;
  const ticks = axisMax > 0 ? Array.from({ length: 6 }, (_, index) => (axisMax / 5) * index) : [];

  const applyWeek = () => {
    setDateMode('week');
    setStartDate(weekRange.start);
    setEndDate(weekRange.end);
  };


  const handleDownload = () => {
    const header = ['Mã nhà cung cấp', 'Tên nhà cung cấp', 'Giá trị nhập', 'Giá trị trả', 'Giá trị thuần'];
    const csvRows = [
      header.join(','),
      ...rows.map(r =>
        [`"${r.supplierCode}"`, `"${r.supplierName}"`, r.importValue, r.returnValue, r.netValue].join(',')
      ),
    ];
    const blob = new Blob(['﻿' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bao-cao-nha-cung-cap-${startDate}-${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full min-h-0 text-slate-900">
      <div className="flex h-full min-h-0 w-full gap-4 overflow-hidden">
        <aside className="w-64 shrink-0 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="h-full overflow-y-auto px-4 py-4">
            {viewMode === 'report' && (
              <button onClick={handleDownload} className="mb-5 flex h-9 w-full items-center gap-2 rounded-md border border-slate-200 px-3 text-left text-sm font-bold text-slate-700">
                <FileText className="h-4 w-4" />
                Xuất tất cả
              </button>
            )}

            <h2 className="text-base font-bold">Kiểu hiển thị</h2>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setViewMode('chart')}
                className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                  viewMode === 'chart'
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                Biểu đồ
              </button>
              <button
                onClick={() => setViewMode('report')}
                className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                  viewMode === 'report'
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                Báo cáo
              </button>
            </div>

            <div className="my-5 h-px bg-slate-200" />

            {viewMode === 'report' && (
              <div className="mb-6">
                <ReportDropdownFilter
                  value="vertical"
                  placeholder="Hiển thị dọc"
                  options={[{ value: 'vertical', label: 'Hiển thị dọc' }]}
                  onChange={() => undefined}
                  allowAll={false}
                />
              </div>
            )}

            <label className="block text-sm font-bold">Mối quan tâm</label>
            <ReportDropdownFilter
              value="purchase"
              placeholder="Nhập hàng"
              options={[{ value: 'purchase', label: 'Nhập hàng' }]}
              onChange={() => undefined}
              allowAll={false}
            />

            <label className="mt-6 block text-sm font-bold">Thời gian</label>
            <div className="mt-2">
              <ReportRangeTimeFilter
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                onCustomMode={() => setDateMode('custom')}
              />
            </div>

            <div className="mt-6">
              <label className="block text-sm font-bold">Nhà cung cấp</label>
              <ReportDropdownFilter
                value={supplierQuery}
                placeholder="Theo mã, tên, số điện thoại"
                options={supplierOptions}
                onChange={setSupplierQuery}
              />
            </div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <h1 className="mb-5 text-2xl font-bold">Báo cáo nhà cung cấp</h1>
          {viewMode === 'chart' ? (
            <div className="min-h-0 flex-1 bg-white px-6 py-5">
              <h2 className="text-center text-lg font-medium text-slate-700">
                Top 10 nhà cung cấp nhập hàng nhiều nhất (đã trừ trả hàng)
              </h2>
              <div className="mt-4 grid min-h-[500px] grid-cols-[220px_1fr]">
                <div className="flex flex-col justify-around gap-2 pr-3 text-right text-sm text-slate-700">
                  {topRows.map(row => (
                    <div key={row.key} className="truncate" title={row.supplierName}>
                      {row.supplierName}
                    </div>
                  ))}
                </div>
                <div className="relative border-b border-l border-r border-slate-300">
                  {ticks.map(tick => (
                    <div
                      key={tick}
                      className="absolute bottom-0 top-0 border-l border-slate-200"
                      style={{ left: axisMax > 0 ? `${(tick / axisMax) * 100}%` : 0 }}
                    />
                  ))}
                  {topRows.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                      Không có dữ liệu trong khoảng thời gian đã chọn
                    </div>
                  ) : (
                    <div className="relative z-10 flex h-full flex-col justify-around gap-2 py-2">
                      {topRows.map(row => (
                        <div key={row.key} className="h-8">
                          <div
                            className="h-full bg-indigo-600"
                            style={{
                              width:
                                axisMax > 0
                                  ? `${Math.max((row.netValue / axisMax) * 100, 1)}%`
                                  : 0,
                            }}
                            title={`${row.supplierName}: ${formatNumber(row.netValue)}`}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="ml-[220px] flex justify-between text-xs text-slate-600">
                {ticks.length > 0 ? ticks.map(tick => <span key={tick}>{formatAxis(tick)}</span>) : <span>0</span>}
              </div>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <div className="mb-5 text-center">
                <div className="mb-1 text-xs text-slate-400">Ngày lập: {createdAt}</div>
                <h2 className="text-xl font-bold text-slate-800">Báo cáo nhập hàng theo nhà cung cấp</h2>
                <div className="mt-2 space-y-0.5 text-sm text-slate-500">
                  <p>Từ ngày {formatDate(startDate)} đến ngày {formatDate(endDate)}</p>
                  <p>Chi nhánh: {storeName}</p>
                </div>
              </div>

                  <table className="mt-10 w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-[#a9dff3] text-slate-800">
                        <th className="border border-[#a7bac5] px-3 py-3 text-left font-bold">
                          Mã nhà cung cấp
                        </th>
                        <th className="border border-[#a7bac5] px-3 py-3 text-left font-bold">
                          Tên nhà cung cấp
                        </th>
                        <th className="border border-[#a7bac5] px-3 py-3 text-right font-bold">
                          Giá trị nhập
                        </th>
                        <th className="border border-[#a7bac5] px-3 py-3 text-right font-bold">
                          Giá trị trả
                        </th>
                        <th className="border border-[#a7bac5] px-3 py-3 text-right font-bold">
                          Giá trị (thuần)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr className="bg-[#f5f0cf]">
                          <td
                            colSpan={5}
                            className="border border-[#c3c4ba] px-3 py-4 text-center italic text-slate-700"
                          >
                            Báo cáo không có dữ liệu
                          </td>
                        </tr>
                      ) : (
                        <>
                          <tr className="bg-[#f5f0cf] font-bold text-slate-800">
                            <td className="border border-[#c3c4ba] px-3 py-3" colSpan={2}>
                              SL nhà cung cấp: {rows.length}
                            </td>
                            <td className="border border-[#c3c4ba] px-3 py-3 text-right">
                              {formatNumber(totals.importValue)}
                            </td>
                            <td className="border border-[#c3c4ba] px-3 py-3 text-right">
                              {formatNumber(totals.returnValue)}
                            </td>
                            <td className="border border-[#c3c4ba] px-3 py-3 text-right text-blue-700">
                              {formatNumber(totals.netValue)}
                            </td>
                          </tr>
                          {rows.map(row => (
                            <tr key={row.key} className="font-semibold text-slate-800">
                              <td className="border-b border-slate-300 px-3 py-3 text-blue-700">
                                {row.supplierCode}
                              </td>
                              <td className="border-b border-slate-300 px-3 py-3">
                                {row.supplierName}
                              </td>
                              <td className="border-b border-slate-300 px-3 py-3 text-right">
                                {formatNumber(row.importValue)}
                              </td>
                              <td className="border-b border-slate-300 px-3 py-3 text-right">
                                {formatNumber(row.returnValue)}
                              </td>
                              <td className="border-b border-slate-300 px-3 py-3 text-right">
                                {formatNumber(row.netValue)}
                              </td>
                            </tr>
                          ))}
                        </>
                      )}
                    </tbody>
                  </table>
                
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default SupplierReportPage;
