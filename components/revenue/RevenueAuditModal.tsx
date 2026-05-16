import React from 'react';
import { AlertTriangle, ShieldAlert, X } from 'lucide-react';
import { RevenueAuditConflict } from '../../types';

interface RevenueAuditModalProps {
  auditConflicts: RevenueAuditConflict[];
  setAuditConflicts: (conflicts: RevenueAuditConflict[]) => void;
  onClose: () => void;
  onResolveConflicts: () => void;
  formatNumber: (num: number) => string;
}

export const RevenueAuditModal: React.FC<RevenueAuditModalProps> = ({
  auditConflicts,
  setAuditConflicts,
  onClose,
  onResolveConflicts,
  formatNumber,
}) => (
  <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
    <div className="relative bg-white w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col">
      <div className="p-8 border-b border-slate-100 bg-rose-50 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-rose-600 text-white rounded-2xl shadow-lg">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
              Đối Soát Sai Lệch
            </h3>
          </div>
        </div>
        <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-600">
          <X className="w-6 h-6" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
        <div className="mb-6 p-4 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-4">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-800 font-normal">
            Phát hiện dữ liệu khác biệt. Vui lòng chọn phương án cập nhật.
          </p>
        </div>
        <div className="rounded-3xl border border-slate-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase border-b border-slate-200">
                <th className="px-6 py-4">Ngày tháng</th>
                <th className="px-6 py-4">Hạng mục</th>
                <th className="px-6 py-4 text-right">App</th>
                <th className="px-6 py-4 text-right">File</th>
                <th className="px-6 py-4 text-center">Phương án</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs font-normal">
              {auditConflicts.map((conflict, idx) => (
                <tr
                  key={`${conflict.date}-${conflict.columnKey}`}
                  className={`hover:bg-slate-50 ${conflict.resolution === 'update' ? 'bg-rose-50/30' : ''}`}
                >
                  <td className="px-6 py-4">{conflict.date.split('-').reverse().join('/')}</td>
                  <td className="px-6 py-4 uppercase text-slate-500">{conflict.columnLabel}</td>
                  <td className="px-6 py-4 text-right">{formatNumber(conflict.currentValue)}</td>
                  <td className="px-6 py-4 text-right text-rose-600">
                    {formatNumber(conflict.newValue)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => {
                        const next = [...auditConflicts];
                        next[idx].resolution = 'keep';
                        setAuditConflicts(next);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-normal uppercase mr-2 ${conflict.resolution === 'keep' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}
                    >
                      Giữ
                    </button>
                    <button
                      onClick={() => {
                        const next = [...auditConflicts];
                        next[idx].resolution = 'update';
                        setAuditConflicts(next);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-normal uppercase ${conflict.resolution === 'update' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-400'}`}
                    >
                      Sửa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="p-8 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
        <button
          onClick={() =>
            setAuditConflicts(auditConflicts.map(c => ({ ...c, resolution: 'update' })))
          }
          className="text-xs font-normal text-rose-600 uppercase"
        >
          Cập nhật tất cả
        </button>
        <button
          onClick={onResolveConflicts}
          className="px-12 py-4 bg-slate-900 text-white rounded-2xl font-normal text-[10px] uppercase shadow-xl"
        >
          XÁC NHẬN ĐỐI SOÁT
        </button>
      </div>
    </div>
  </div>
);
