import React, { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { AppData } from '../../types';
import { AiInsightPanel } from '../shared';
import { hashData, getCachedAiResult, setCachedAiResult } from '../../services/aiCache';

interface Props {
  data: AppData;
}

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 0 });
const fmtBig = (n: number) => {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + ' tỷ';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + ' triệu';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'N';
  return fmt(n);
};

type SegmentKey = 'loyal' | 'close' | 'potential' | 'atrisk' | 'churn';

interface Segment {
  key: SegmentKey;
  label: string;
  color: string;
  bgColor: string;
  description: string;
}

const SEGMENTS: Segment[] = [
  {
    key: 'loyal',
    label: 'Trung thành',
    color: '#f59e0b',
    bgColor: '#fef3c7',
    description:
      'Các khách hàng thường xuyên ghé thăm cửa hàng, đã mua hàng nhiều lần với mức chi tiêu lớn. Họ đóng góp nhiều vào doanh thu của cửa hàng.',
  },
  {
    key: 'close',
    label: 'Thân thiết',
    color: '#3b82f6',
    bgColor: '#dbeafe',
    description:
      'Các khách hàng có tần suất trung bình hoặc mới mua gần đây với mức chi tiêu đáng kể. Có tiềm năng phát triển thành nhóm Trung thành.',
  },
  {
    key: 'potential',
    label: 'Tiềm năng',
    color: '#14b8a6',
    bgColor: '#ccfbf1',
    description:
      'Các khách hàng mới mua gần đây với mức chi tiêu trung bình. Có triển vọng trong việc tiếp cận và tạo sự gắn kết.',
  },
  {
    key: 'atrisk',
    label: 'Cần quan tâm',
    color: '#ef4444',
    bgColor: '#fee2e2',
    description:
      'Các khách hàng đã từng mua đều đặn, nhưng không quay lại mua hàng trong thời gian gần đây.',
  },
  {
    key: 'churn',
    label: 'Sắp rời bỏ',
    color: '#94a3b8',
    bgColor: '#f1f5f9',
    description: 'Các khách hàng có tần suất thấp và đã rất lâu không quay lại mua hàng.',
  },
];

interface CustomerStats {
  id: string;
  frequency: number;
  recency: number;
  monetary: number;
  returnValue: number;
  segment: SegmentKey;
  monthlyOrders: number[];
}

function classifySegment(frequency: number, recency: number): SegmentKey {
  if (frequency >= 5 && recency <= 30) return 'loyal';
  if (frequency >= 3 && recency <= 60) return 'close';
  if (recency > 120) return 'churn';
  if (frequency >= 2 && recency > 60) return 'atrisk';
  return 'potential';
}

const AnalysisCustomersClassifyPage: React.FC<Props> = ({ data }) => {
  const today = new Date().toLocaleDateString('sv-SE');
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  const { segmentMap, segmentRevenue, segmentReturn, segmentCount, totalCustomers } =
    useMemo(() => {
      const now = new Date();

      // Last 6 months keys e.g. ['2026-05', '2026-04', ...]
      const last6Months: string[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        last6Months.push(d.toLocaleDateString('sv-SE').slice(0, 7));
      }

      const orders = data.posOrders || [];

      // Per-customer stats
      const cusMap = new Map<
        string,
        {
          frequency: number;
          lastDate: string;
          monetary: number;
          returnValue: number;
          monthOrders: Map<string, number>;
        }
      >();

      orders.forEach(o => {
        if (!o.customerId) return;
        if (!cusMap.has(o.customerId)) {
          cusMap.set(o.customerId, {
            frequency: 0,
            lastDate: '1970-01-01',
            monetary: 0,
            returnValue: 0,
            monthOrders: new Map(),
          });
        }
        const c = cusMap.get(o.customerId)!;
        const month = o.date.slice(0, 7);

        if (o.isReturn) {
          c.returnValue += Math.abs(o.finalAmount);
        } else {
          c.frequency++;
          c.monetary += o.finalAmount;
          if (o.date > c.lastDate) c.lastDate = o.date;
          c.monthOrders.set(month, (c.monthOrders.get(month) || 0) + 1);
        }
      });

      const segMap = new Map<SegmentKey, CustomerStats[]>();
      SEGMENTS.forEach(s => segMap.set(s.key, []));

      cusMap.forEach((c, id) => {
        const recency = Math.floor(
          (new Date(today).getTime() - new Date(c.lastDate).getTime()) / 86400_000
        );
        const seg = classifySegment(c.frequency, recency);
        const monthlyOrders = last6Months.map(m => c.monthOrders.get(m) || 0);

        segMap.get(seg)!.push({
          id,
          frequency: c.frequency,
          recency,
          monetary: c.monetary,
          returnValue: c.returnValue,
          segment: seg,
          monthlyOrders,
        });
      });

      // Aggregate per segment
      const segRevenue = new Map<SegmentKey, number>();
      const segReturn = new Map<SegmentKey, number>();
      const segCount = new Map<SegmentKey, number>();
      SEGMENTS.forEach(s => {
        const members = segMap.get(s.key) || [];
        segCount.set(s.key, members.length);
        segRevenue.set(
          s.key,
          members.reduce((sum, c) => sum + c.monetary, 0)
        );
        segReturn.set(
          s.key,
          members.reduce((sum, c) => sum + c.returnValue, 0)
        );
      });

      // Average monthly orders per segment for sparkline
      const segSparkline = new Map<SegmentKey, number[]>();
      SEGMENTS.forEach(s => {
        const members = segMap.get(s.key) || [];
        if (members.length === 0) {
          segSparkline.set(s.key, Array(6).fill(0));
          return;
        }
        const totals = Array(6).fill(0);
        members.forEach(c => c.monthlyOrders.forEach((v, i) => (totals[i] += v)));
        segSparkline.set(s.key, totals);
      });

      const total = Array.from(segCount.values()).reduce((a, b) => a + b, 0);

      return {
        segmentMap: segSparkline,
        segmentRevenue: segRevenue,
        segmentReturn: segReturn,
        segmentCount: segCount,
        totalCustomers: total,
      };
    }, [data.posOrders, today]);

  const handleAiRun = async () => {
    const contextData = {
      totalCustomers,
      segments: SEGMENTS.map(s => ({
        key: s.key,
        label: s.label,
        count: segmentCount.get(s.key) || 0,
        revenue: segmentRevenue.get(s.key) || 0,
        returnValue: segmentReturn.get(s.key) || 0,
      })),
    };
    const hash = hashData(contextData);
    const cached = getCachedAiResult('customers-classify', hash);
    if (cached) { setAiResult(cached); setFromCache(true); return; }
    setAiLoading(true); setFromCache(false);
    try {
      const res = await fetch('/api/ai/customers-classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contextData),
      });
      const json = await res.json();
      const result = json.result || json.error || 'Không có kết quả';
      setAiResult(result);
      setCachedAiResult('customers-classify', hash, result);
    } catch {
      setAiResult('Lỗi kết nối đến AI.');
    } finally {
      setAiLoading(false);
    }
  };

  // Treemap data — compute % for display
  const treemapData = SEGMENTS.map(s => ({
    ...s,
    count: segmentCount.get(s.key) || 0,
    pct: totalCustomers > 0 ? ((segmentCount.get(s.key) || 0) / totalCustomers) * 100 : 0,
  })).sort((a, b) => b.count - a.count);

  // Bar chart data
  const revenueBarData = SEGMENTS.map(s => ({
    name: s.label,
    value: segmentRevenue.get(s.key) || 0,
    color: s.color,
  }));
  const returnBarData = SEGMENTS.map(s => ({
    name: s.label,
    value: segmentReturn.get(s.key) || 0,
    color: s.color,
  }));

  // Biggest 2 get their own blocks, rest share
  const [first, second, ...rest] = treemapData;

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50">
      {/* Title bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-100 shrink-0">
        <div>
          <h1 className="text-base font-semibold text-slate-800">Phân loại khách hàng</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Dữ liệu được tổng hợp trên danh sách khách hàng và các giao dịch từ tất cả thời gian
          </p>
        </div>
      </div>

      <div className="flex-1 p-6 flex flex-col gap-5">
        {/* Nhóm khách hàng */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">Nhóm khách hàng</span>
          </div>
          <div className="p-5 flex gap-5">
            {/* Treemap */}
            <div className="flex gap-1.5 shrink-0" style={{ width: 320, height: 180 }}>
              {/* Left: biggest segment */}
              {first && (
                <div
                  className="rounded-lg flex flex-col justify-end p-3 shrink-0"
                  style={{
                    background: first.color,
                    width: `${Math.max(first.pct, 10)}%`,
                    flex: 'none',
                    minWidth: 80,
                  }}
                >
                  <span className="text-white text-2xs leading-tight">{first.label}</span>
                  <span className="text-white text-xs font-bold">{first.pct.toFixed(1)}%</span>
                </div>
              )}
              {/* Right column */}
              <div className="flex-1 flex flex-col gap-1.5">
                {second && (
                  <div
                    className="rounded-lg flex flex-col justify-end p-3"
                    style={{ background: second.color, flex: second.pct }}
                  >
                    <span className="text-white text-2xs leading-tight">{second.label}</span>
                    <span className="text-white text-xs font-bold">
                      {second.pct.toFixed(1)}%
                    </span>
                  </div>
                )}
                {rest.length > 0 && (
                  <div
                    className="flex gap-1.5"
                    style={{ flex: rest.reduce((s, r) => s + r.pct, 0) }}
                  >
                    {rest.map(seg => (
                      <div
                        key={seg.key}
                        className="rounded-lg flex flex-col justify-end p-2 flex-1"
                        style={{ background: seg.color, minWidth: 30 }}
                      >
                        {seg.pct >= 8 && (
                          <>
                            <span className="text-white text-[9px] leading-tight truncate">
                              {seg.label}
                            </span>
                            <span className="text-white text-2xs font-bold">
                              {seg.pct.toFixed(1)}%
                            </span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Segment table */}
            <div className="flex-1 flex flex-col divide-y divide-slate-50">
              {SEGMENTS.map(seg => {
                const count = segmentCount.get(seg.key) || 0;
                const sparkData = (segmentMap.get(seg.key) || Array(6).fill(0)).map((v, i) => ({
                  i,
                  v,
                }));
                return (
                  <div key={seg.key} className="flex items-center gap-3 py-2.5">
                    <div className="flex items-center gap-2 w-28 shrink-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: seg.color }}
                      />
                      <span className="text-sm text-slate-700 font-medium">{seg.label}</span>
                    </div>
                    <span className="text-sm text-slate-800 font-semibold w-6 text-center shrink-0">
                      {count}
                    </span>
                    {/* Sparkline */}
                    <div className="w-20 shrink-0" style={{ height: 28 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={sparkData}
                          margin={{ top: 2, right: 0, left: 0, bottom: 2 }}
                        >
                          <Line
                            type="monotone"
                            dataKey="v"
                            stroke={seg.color}
                            strokeWidth={1.5}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-xs text-slate-500 flex-1 leading-relaxed">
                      {seg.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 2 horizontal bar charts */}
        <div className="grid grid-cols-2 gap-4">
          <HBarCard title="Doanh thu" data={revenueBarData} formatValue={fmtBig} unit="đ" />
          <HBarCard title="Trả hàng" data={returnBarData} formatValue={fmtBig} unit="đ" />
        </div>

        <AiInsightPanel isLoading={aiLoading} result={aiResult} onRun={handleAiRun} fromCache={fromCache} />
      </div>
    </div>
  );
};

interface HBarDatum {
  name: string;
  value: number;
  color: string;
}

interface HBarCardProps {
  title: string;
  data: HBarDatum[];
  formatValue: (n: number) => string;
  unit: string;
}

const HBarCard: React.FC<HBarCardProps> = ({ title, data, formatValue }) => {
  const maxVal = Math.max(...data.map(d => d.value), 1);

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100">
        <span className="text-sm font-semibold text-slate-700">{title}</span>
      </div>
      <div className="px-4 py-4" style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 60, left: 8, bottom: 0 }}
            barSize={14}
          >
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}Tr` : String(v))}
              domain={[0, maxVal * 1.1]}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 12, fill: '#475569' }}
              tickLine={false}
              axisLine={false}
              width={72}
            />
            <Tooltip
              formatter={(v: number) => [formatValue(v), title]}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
            <Bar dataKey="value" radius={[0, 3, 3, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default AnalysisCustomersClassifyPage;
