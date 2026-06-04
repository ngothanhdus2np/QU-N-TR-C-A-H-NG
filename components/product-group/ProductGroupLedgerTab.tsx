import React from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  DollarSign,
  FileSpreadsheet,
  Hash,
  Layers,
  Percent,
  Plus,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import { ProductGroup, ProductGroupRevenue } from '../../types';
import { InputWrapper } from './ProductGroupSharedUI';
import ProductGroupTreePicker from '../shared/ProductGroupTreePicker';

interface SeasonalRow {
  month: string;
  fullPath: string;
  displayName: string;
  level: number;
  quantity: number;
  net: number;
  cogs: number;
  profit: number;
  margin: number;
  hasChildren: boolean;
}

interface GroupFormData {
  date: string;
  groupId: string;
  amount: string;
  quantity: string;
  netRevenue: string;
  returnsQuantity: string;
  returnsValue: string;
  cogs: string;
}

interface ProductGroupLedgerTabProps {
  effectiveGroups: ProductGroup[];
  groupRevenue: ProductGroupRevenue[];
  groupFormData: GroupFormData;
  visibleLedgerRows: SeasonalRow[];
  expandedLedgerRows: Set<string>;
  filterStartDate: string;
  filterEndDate: string;
  formatNumber: (value: number) => string;
  onSubmitGroupRevenue: (event: React.FormEvent) => void;
  onSetGroupFormData: React.Dispatch<React.SetStateAction<GroupFormData>>;
  onSetFilterStartDate: (value: string) => void;
  onSetFilterEndDate: (value: string) => void;
  onToggleLedgerRow: (month: string, fullPath: string) => void;
  onUpdateGroupRevenue: (newList: ProductGroupRevenue[]) => void;
}

const ProductGroupLedgerTab: React.FC<ProductGroupLedgerTabProps> = ({
  effectiveGroups,
  groupRevenue,
  groupFormData,
  visibleLedgerRows,
  expandedLedgerRows,
  filterStartDate,
  filterEndDate,
  formatNumber,
  onSubmitGroupRevenue,
  onSetGroupFormData,
  onSetFilterStartDate,
  onSetFilterEndDate,
  onToggleLedgerRow,
  onUpdateGroupRevenue,
}) => (
  <div className="space-y-8 animate-in slide-in-from-bottom-4">
    <div className="grid grid-cols-1 gap-6">
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl">
        <h3 className="text-xs font-semibold text-slate-900 mb-6 flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg text-white">
            <Plus className="w-3.5 h-3.5" />
          </div>{' '}
          NHẬP NHANH CHỈ SỐ
        </h3>
        <form onSubmit={onSubmitGroupRevenue} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <InputWrapper label="Ngày" icon={Calendar}>
              <input
                type="date"
                required
                value={groupFormData.date}
                onChange={e => onSetGroupFormData({ ...groupFormData, date: e.target.value })}
                className="input-field py-2.5 font-normal text-2xs border-none"
              />
            </InputWrapper>
            <InputWrapper label="SL bán" icon={Hash}>
              <input
                type="number"
                required
                placeholder="0"
                value={groupFormData.quantity}
                onChange={e => onSetGroupFormData({ ...groupFormData, quantity: e.target.value })}
                className="input-field py-2.5 font-normal text-2xs border-none"
              />
            </InputWrapper>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <InputWrapper label="Doanh thu" icon={DollarSign} color="text-blue-600">
              <input
                type="number"
                required
                placeholder="0"
                value={groupFormData.amount}
                onChange={e => onSetGroupFormData({ ...groupFormData, amount: e.target.value })}
                className="input-field py-2.5 font-normal text-2xs border-none"
              />
            </InputWrapper>
            <InputWrapper label="Giá vốn" icon={ShoppingCart} color="text-slate-600">
              <input
                type="number"
                placeholder="0"
                value={groupFormData.cogs}
                onChange={e => onSetGroupFormData({ ...groupFormData, cogs: e.target.value })}
                className="input-field py-2.5 font-normal text-2xs border-none"
              />
            </InputWrapper>
          </div>
          <InputWrapper label="Nhóm Hàng" icon={Layers}>
            <ProductGroupTreePicker
              groups={effectiveGroups}
              selectedPaths={(() => {
                const selectedGroup = effectiveGroups.find(
                  group => group.id === groupFormData.groupId
                );
                return selectedGroup ? [selectedGroup.name] : [];
              })()}
              onSelectionChange={paths => {
                const selectedPath = paths[paths.length - 1] || '';
                const selectedGroup = effectiveGroups.find(group => group.name === selectedPath);
                onSetGroupFormData({ ...groupFormData, groupId: selectedGroup?.id || '' });
              }}
              placeholder="Chọn nhóm..."
            />
          </InputWrapper>
          <button
            type="submit"
            className="w-full bg-slate-900 hover:bg-black text-white py-3.5 rounded-xl font-normal text-[9px] uppercase tracking-widest transition-colors shadow-xl"
          >
            GHI NHẬN CHỈ SỐ
          </button>
        </form>
      </div>
    </div>

    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
      <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-tight">
            Sổ Cái Nhóm Hàng Chi Tiết
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 p-1.5 rounded-xl shadow-sm">
            <input
              type="date"
              value={filterStartDate}
              onChange={e => onSetFilterStartDate(e.target.value)}
              className="bg-transparent text-2xs font-normal text-slate-600 outline-none"
            />
            <input
              type="date"
              value={filterEndDate}
              onChange={e => onSetFilterEndDate(e.target.value)}
              className="bg-transparent text-2xs font-normal text-slate-600 outline-none ml-2"
            />
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest bg-white border-b border-slate-100">
              <th className="px-8 py-6 w-[220px]">Thời gian / Nhóm</th>
              <th className="px-4 py-6 text-right">SL bán</th>
              <th className="px-4 py-6 text-right text-blue-600">Doanh thu thuần</th>
              <th className="px-4 py-6 text-right text-rose-600">Giá vốn</th>
              <th className="px-4 py-6 text-right font-semibold bg-emerald-50 text-emerald-800">
                Lợi nhuận gộp
              </th>
              <th className="px-4 py-6 text-center text-indigo-600 font-semibold w-[100px]">
                Tỉ suất LN
              </th>
              <th className="px-4 py-6 text-center w-[60px]">Xóa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 tabular-nums text-2xs font-normal">
            {visibleLedgerRows.map(row => {
              const isExp = expandedLedgerRows.has(`${row.month}_${row.fullPath}`);
              const marginColor =
                row.margin > 30
                  ? 'text-emerald-600 bg-emerald-50'
                  : row.margin >= 15
                    ? 'text-indigo-600 bg-indigo-50'
                    : 'text-rose-600 bg-rose-50';

              return (
                <tr
                  key={`${row.month}_${row.fullPath}`}
                  className="group hover:bg-slate-50 transition-colors"
                >
                  <td className="px-8 py-4" style={{ paddingLeft: `${row.level * 20}px` }}>
                    <div className="flex items-center gap-2">
                      {row.hasChildren && (
                        <button
                          onClick={() => onToggleLedgerRow(row.month, row.fullPath)}
                          className="p-1 rounded bg-slate-100 text-slate-500"
                        >
                          {isExp ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronRight className="w-3 h-3" />
                          )}
                        </button>
                      )}
                      <div>
                        {row.level === 1 && (
                          <p className="text-[8px] font-normal text-slate-400 mb-0.5">
                            {String(row.month)}
                          </p>
                        )}
                        <p
                          className={`uppercase ${row.level === 1 ? 'text-slate-900' : 'text-slate-500 font-normal'}`}
                        >
                          {String(row.displayName)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">{String(row.quantity)}</td>
                  <td className="px-4 py-4 text-right text-blue-900 bg-blue-50/20">
                    {formatNumber(row.net)}
                  </td>
                  <td className="px-4 py-4 text-right text-rose-500">
                    {formatNumber(Math.abs(row.cogs))}
                  </td>
                  <td className="px-4 py-4 text-right font-normal text-emerald-700 bg-emerald-50/20">
                    {formatNumber(row.profit)}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-normal text-2xs ${marginColor}`}
                    >
                      <Percent className="w-3 h-3" />
                      {row.margin.toFixed(1)}%
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <button
                      onClick={() =>
                        onUpdateGroupRevenue(
                          groupRevenue.filter(
                            r => !(r.date.startsWith(row.month) && r.groupName === row.fullPath)
                          )
                        )
                      }
                      className="text-slate-200 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

export default ProductGroupLedgerTab;
