import React, { useEffect, useMemo, useState } from 'react';
import { usePosOrders } from '../../hooks/usePosOrders';
import {
  FileText,
} from 'lucide-react';
import type { Employee, POSOrder } from '../../types';
import {
  getChannelReportRows,
  getReportTotals,
  type ChannelReportRow,
} from '../../src/lib/reportCalculations';
import ReportRangeTimeFilter from './ReportRangeTimeFilter';
import ReportDropdownFilter, { getReportDropdownOptions } from './ReportDropdownFilter';
import { getLatestOrderDate, getWeekRange, hasOrdersInDateRange } from './reportDateDefaults';
import { formatReportNumber as formatNumber, formatReportDate as formatDate } from '../../src/lib/formatCurrency';

interface ChannelReportPageProps {
  orders: POSOrder[];
  employees: Employee[];
  storeName?: string;
}

type ChannelRow = ChannelReportRow;

type ViewMode = 'chart' | 'report';
type DateMode = 'week' | 'custom';

const CHART_COLORS = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#0891b2', '#be185d', '#059669'];


const ChannelReportPage: React.FC<ChannelReportPageProps> = ({
  orders: bootstrapOrders,
  employees,
  storeName = 'Chi nhánh trung tâm',
}) => {
  const weekRange = useMemo(() => getWeekRange(), []);
  const [viewMode, setViewMode] = useState<ViewMode>('chart');
  const [dateMode, setDateMode] = useState<DateMode>('week');
  const [startDate, setStartDate] = useState(weekRange.start);
  const [endDate, setEndDate] = useState(weekRange.end);
  const [staffQuery, setStaffQuery] = useState('');
  const [channelQuery, setChannelQuery] = useState('');
  const { orders, isLoading: ordersLoading } = usePosOrders(bootstrapOrders, startDate, endDate);
  useEffect(() => {
    if (dateMode === 'custom') return;
    if (orders.length === 0 || hasOrdersInDateRange(orders, startDate, endDate)) return;
    const latestDate = getLatestOrderDate(orders);
    if (!latestDate) return;
    const nextRange = getWeekRange(new Date(`${latestDate}T00:00:00`));
    setStartDate(nextRange.start);
    setEndDate(nextRange.end);
    setDateMode('week');
  }, [endDate, orders, startDate]);
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

  const rows = useMemo<ChannelRow[]>(
    () =>
      getChannelReportRows(orders, employees, { startDate, endDate }, { staffQuery, channelQuery }),
    [channelQuery, employees, endDate, orders, staffQuery, startDate]
  );

  const totals = useMemo(() => getReportTotals(rows), [rows]);
  const staffOptions = useMemo(
    () => getReportDropdownOptions([...employees.map(employee => employee.name), ...orders.map(order => order.createdBy || order.staffId)]),
    [employees, orders]
  );
  const channelOptions = useMemo(
    () => getReportDropdownOptions(orders.map(order => order.channelName || order.channel)),
    [orders]
  );

  const primaryRow = rows[0];
  const primaryPercent =
    primaryRow && totals.netRevenue > 0 ? (primaryRow.netRevenue / totals.netRevenue) * 100 : 0;

  const handleDownload = () => {
    const header = ['Kênh bán hàng', 'Doanh thu', 'Giá trị trả', 'Doanh thu thuần'];
    const csvRows = [
      header.join(','),
      ...rows.map(row =>
        [row.channelName, row.revenue, row.returned, row.netRevenue].join(',')
      ),
      ['Tổng', totals.revenue, totals.returned, totals.netRevenue].join(','),
    ];
    const blob = new Blob(['﻿' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bao-cao-kenh-ban-${startDate}-${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const R = 110;
  const CX = 160;
  const CY = 160;
  const circ = 2 * Math.PI * R;
  let cumulativeArc = 0;
  const chartSegments = rows.map((row, i) => {
    const fraction = totals.netRevenue > 0 ? Math.max(0, row.netRevenue) / totals.netRevenue : 0;
    const arc = fraction * circ;
    const seg = { key: row.key, channelName: row.channelName, fraction, arc, offset: cumulativeArc, color: CHART_COLORS[i % CHART_COLORS.length] };
    cumulativeArc += arc;
    return seg;
  });

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
              value="sales"
              placeholder="Bán hàng"
              options={[{ value: 'sales', label: 'Bán hàng' }]}
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
              <label className="block text-sm font-bold">Người bán</label>
              <ReportDropdownFilter
                value={staffQuery}
                placeholder="Chọn người bán"
                options={staffOptions}
                onChange={setStaffQuery}
              />
            </div>

            <div className="mt-6">
              <label className="block text-sm font-bold">Kênh bán</label>
              <ReportDropdownFilter
                value={channelQuery}
                placeholder="Chọn kênh bán"
                options={channelOptions}
                onChange={setChannelQuery}
              />
            </div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <h1 className="mb-5 flex items-center gap-3 text-2xl font-bold">
            Báo cáo kênh bán hàng
            {ordersLoading && <span className="text-sm font-normal text-slate-400">Đang tải...</span>}
          </h1>
          {viewMode === 'chart' ? (
            <div className="min-h-0 flex-1 bg-white px-6 py-5">
              <h2 className="text-center text-lg font-medium text-slate-700">
                Doanh thu kênh bán hàng
              </h2>
              <div className="flex min-h-[500px] flex-col items-center justify-center">
                {rows.length === 0 || totals.netRevenue <= 0 ? (
                  <div className="text-sm text-slate-400">Không có dữ liệu trong khoảng thời gian đã chọn</div>
                ) : (
                  <div className="flex flex-col items-center gap-6">
                    <svg viewBox="0 0 320 320" className="h-72 w-72">
                      <g transform={`rotate(-90 ${CX} ${CY})`}>
                        {chartSegments.map(seg => (
                          <circle
                            key={seg.key}
                            cx={CX}
                            cy={CY}
                            r={R}
                            fill="none"
                            stroke={seg.color}
                            strokeWidth={40}
                            strokeDasharray={`${seg.arc} ${circ - seg.arc}`}
                            strokeDashoffset={-seg.offset}
                          />
                        ))}
                      </g>
                      <text x={CX} y={CY - 8} textAnchor="middle" className="text-sm" fontSize={13} fill="#475569">
                        Doanh thu thuần
                      </text>
                      <text x={CX} y={CY + 14} textAnchor="middle" fontWeight="bold" fontSize={15} fill="#1e293b">
                        {formatNumber(totals.netRevenue)}
                      </text>
                    </svg>
                    <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
                      {chartSegments.map(seg => (
                        <div key={seg.key} className="flex items-center gap-1.5 text-sm text-slate-700">
                          <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: seg.color }} />
                          <span>{seg.channelName}</span>
                          <span className="text-slate-500">({(seg.fraction * 100).toFixed(1)}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <div className="mb-5 text-center">
                <div className="mb-1 text-xs text-slate-400">Ngày lập: {createdAt}</div>
                <h2 className="text-xl font-bold text-slate-800">Báo cáo bán hàng theo kênh</h2>
                <div className="mt-2 space-y-0.5 text-sm text-slate-500">
                  <p>Từ ngày {formatDate(startDate)} đến ngày {formatDate(endDate)}</p>
                  <p>Chi nhánh: {storeName}</p>
                </div>
              </div>

                  <table className="mt-10 w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-[#a9dff3] text-slate-800">
                        <th className="border border-[#a7bac5] px-3 py-3 text-left font-bold">
                          Kênh bán hàng
                        </th>
                        <th className="border border-[#a7bac5] px-3 py-3 text-right font-bold">
                          Doanh thu
                        </th>
                        <th className="border border-[#a7bac5] px-3 py-3 text-right font-bold">
                          Giá trị trả
                        </th>
                        <th className="border border-[#a7bac5] px-3 py-3 text-right font-bold">
                          Doanh thu thuần
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr className="bg-[#f5f0cf]">
                          <td
                            colSpan={4}
                            className="border border-[#c3c4ba] px-3 py-4 text-center italic text-slate-700"
                          >
                            Báo cáo không có dữ liệu
                          </td>
                        </tr>
                      ) : (
                        <>
                          <tr className="bg-[#f5f0cf] font-bold text-slate-800">
                            <td className="border border-[#c3c4ba] px-3 py-3">
                              SL Kênh bán hàng: {rows.length}
                            </td>
                            <td className="border border-[#c3c4ba] px-3 py-3 text-right">
                              {formatNumber(totals.revenue)}
                            </td>
                            <td className="border border-[#c3c4ba] px-3 py-3 text-right">
                              {totals.returned > 0 ? `-${formatNumber(totals.returned)}` : '0'}
                            </td>
                            <td className="border border-[#c3c4ba] px-3 py-3 text-right text-blue-700">
                              {formatNumber(totals.netRevenue)}
                            </td>
                          </tr>
                          {rows.map(row => (
                            <tr key={row.key} className="font-semibold text-slate-800">
                              <td className="border-b border-slate-300 px-3 py-3 text-blue-700">
                                <span className="mr-2 inline-flex h-4 w-4 items-center justify-center border border-slate-800 text-xs leading-none text-slate-800">
                                  +
                                </span>
                                {row.channelName}
                              </td>
                              <td className="border-b border-slate-300 px-3 py-3 text-right">
                                {formatNumber(row.revenue)}
                              </td>
                              <td className="border-b border-slate-300 px-3 py-3 text-right">
                                {row.returned > 0 ? `-${formatNumber(row.returned)}` : '0'}
                              </td>
                              <td className="border-b border-slate-300 px-3 py-3 text-right">
                                {formatNumber(row.netRevenue)}
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

export default ChannelReportPage;
