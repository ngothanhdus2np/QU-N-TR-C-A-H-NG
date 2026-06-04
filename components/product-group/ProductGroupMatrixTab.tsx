import React from 'react';
import { ArrowUpDown, Boxes, ChevronDown, ChevronRight, DollarSign } from 'lucide-react';

type ViewMode = 'revenue' | 'quantity';

interface MatrixRow {
  id: unknown;
  name: string;
  displayName: unknown;
  level: number;
  isParent: boolean;
  yearValues: Record<string, number>;
  totalAllYearsMetric: number;
}

interface ProductGroupMatrixTabProps {
  selectedMonthNum: number;
  viewMode: ViewMode;
  years: string[];
  matrixData: MatrixRow[];
  expandedNodes: Set<string>;
  formatNumber: (value: number) => string;
  getHeatmapColor: (value: number) => string;
  onToggleNode: (fullPath: string) => void;
}

const ProductGroupMatrixTab: React.FC<ProductGroupMatrixTabProps> = ({
  selectedMonthNum,
  viewMode,
  years,
  matrixData,
  expandedNodes,
  formatNumber,
  getHeatmapColor,
  onToggleNode,
}) => (
  <div className="bg-white rounded-[3.5rem] p-8 md:p-12 border border-slate-200 shadow-xl flex flex-col gap-10">
    <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-slate-100 pb-10">
      <div className="flex items-center gap-5">
        <div className={`p-4 ${viewMode === 'revenue' ? 'bg-emerald-600' : 'bg-indigo-600'} rounded-[1.5rem] text-white shadow-lg transition-colors`}>
          {viewMode === 'revenue' ? <DollarSign className="w-6 h-6" /> : <Boxes className="w-6 h-6" />}
        </div>
        <div>
          <h3 className="text-2xl font-semibold text-slate-900 uppercase tracking-tight">Ma Trận Đối Soát: Tháng {selectedMonthNum} Qua Các Năm</h3>
          <p className="text-2xs text-indigo-600 font-normal uppercase tracking-widest mt-1">Tự động sắp xếp nhóm hàng từ cao xuống thấp.</p>
        </div>
      </div>
      <div className="px-6 py-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
        <div className="flex flex-col items-end">
          <span className="text-[9px] font-normal text-slate-400 uppercase tracking-widest">Tiêu chí hiển thị</span>
          <span className={`text-xs font-normal uppercase ${viewMode === 'revenue' ? 'text-emerald-600' : 'text-indigo-600'}`}>{viewMode === 'revenue' ? 'Doanh thu (đ)' : 'Số lượng (đv)'}</span>
        </div>
        <ArrowUpDown className="w-4 h-4 text-slate-300" />
      </div>
    </div>

    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-x-auto no-scrollbar">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-widest">
            <th className="p-6 text-left min-w-[280px] sticky left-0 bg-slate-50 z-20 border-r border-slate-200">Nhóm Hàng (Xếp hạng)</th>
            {years.map(y => <th key={y} className="p-6 text-center w-[180px] border-r border-slate-100">Tháng {selectedMonthNum}/{y}</th>)}
            <th className="p-6 text-center w-[180px] bg-slate-100 font-semibold text-slate-900 border-l border-slate-200">Tổng Chu Kỳ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {matrixData.map((row, idx) => {
            const isExpanded = expandedNodes.has(row.name);
            return (
              <tr key={String(row.id)} className="group hover:bg-slate-50 transition-colors">
                <td className="p-5 sticky left-0 z-10 border-r border-slate-100 bg-white group-hover:bg-slate-50" style={{ paddingLeft: `${row.level * 20}px` }}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xs font-normal text-slate-300">#{idx + 1}</span>
                    {row.isParent && (
                      <button onClick={() => onToggleNode(row.name)} className="p-1 rounded bg-slate-100 text-slate-500">
                        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      </button>
                    )}
                    <span className={`text-xs uppercase ${row.level === 1 ? 'font-normal text-slate-900' : 'font-normal text-slate-500'}`}>{String(row.displayName)}</span>
                  </div>
                </td>
                {years.map(y => {
                  const val = row.yearValues[y] || 0;
                  return <td key={y} className={`p-5 text-center tabular-nums text-xs border-r border-slate-50 ${getHeatmapColor(val)}`}>{val > 0 ? formatNumber(val) : '0'}</td>;
                })}
                <td className="p-5 text-center tabular-nums text-xs font-normal bg-slate-50 border-l border-slate-100">
                  {formatNumber(row.totalAllYearsMetric)}
                  <span className="ml-1 opacity-40">{viewMode === 'revenue' ? 'đ' : 'đv'}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

export default ProductGroupMatrixTab;
