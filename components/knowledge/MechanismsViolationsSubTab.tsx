import React from 'react';
import { Plus, Save, Trash2, Gavel, AlertTriangle } from 'lucide-react';
import type { ViolationType } from '../../types';

interface MechanismsViolationsSubTabProps {
  localViolations: ViolationType[];
  setLocalViolations: (violations: ViolationType[]) => void;
  hasUnsaved: boolean;
  onSave: () => void;
}

const MechanismsViolationsSubTab: React.FC<MechanismsViolationsSubTabProps> = ({
  localViolations,
  setLocalViolations,
  hasUnsaved,
  onSave,
}) => {
  const handleUpdateLocalViolation = (id: string, field: keyof ViolationType, value: string) => {
    setLocalViolations(localViolations.map(v => (v.id === id ? { ...v, [field]: value } : v)));
  };

  const handleAddLocalViolation = () => {
    const newViolation: ViolationType = {
      id: crypto.randomUUID(),
      name: '',
      fine1: '',
      fine2: '',
      fine3: '',
    };
    setLocalViolations([...localViolations, newViolation]);
  };

  const handleRemoveLocalViolation = (id: string) => {
    setLocalViolations(localViolations.filter(v => v.id !== id));
  };

  return (
    <div className="bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-xl max-w-6xl mx-auto space-y-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-rose-600 text-white rounded-2xl shadow-lg">
            <Gavel className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-xl font-semibold text-slate-900 uppercase tracking-tight">
              Ma trận Kỷ luật & Khấu trừ
            </h4>
            {hasUnsaved && (
              <span className="flex items-center gap-1.5 text-rose-500 font-normal text-2xs uppercase mt-1 animate-pulse">
                <AlertTriangle className="w-3 h-3" /> Có thay đổi chưa lưu
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleAddLocalViolation}
            className="px-6 py-3 bg-slate-100 text-slate-900 rounded-xl font-normal text-2xs uppercase tracking-widest flex items-center gap-2 hover:bg-slate-200 transition-colors"
          >
            <Plus className="w-4 h-4" /> Thêm lỗi mới
          </button>
          <button
            onClick={onSave}
            disabled={!hasUnsaved}
            className={`px-8 py-3 rounded-xl font-normal text-2xs uppercase tracking-widest shadow-lg flex items-center gap-2 transition-colors ${hasUnsaved ? 'bg-indigo-600 text-white hover:bg-black' : 'bg-slate-50 text-slate-300 cursor-not-allowed'}`}
          >
            <Save className="w-4 h-4" /> Lưu cấu hình
          </button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-3xl border border-slate-100">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white text-2xs font-semibold uppercase tracking-widest">
              <th className="px-6 py-5">Lỗi vi phạm</th>
              <th className="px-6 py-5">Lần 1</th>
              <th className="px-6 py-5">Lần 2</th>
              <th className="px-6 py-5">Lần 3</th>
              <th className="px-6 py-5 text-center">Xóa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {localViolations.map(v => (
              <tr key={v.id} className="hover:bg-slate-50/50">
                <td className="px-6 py-4 align-top">
                  <textarea
                    value={v.name}
                    onChange={e => handleUpdateLocalViolation(v.id, 'name', e.target.value)}
                    className="w-full bg-transparent border-none outline-none font-normal text-xs resize-none overflow-hidden min-h-[40px]"
                    rows={2}
                    onInput={(e: React.FormEvent<HTMLTextAreaElement>) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = target.scrollHeight + 'px';
                    }}
                  />
                </td>
                <td className="px-6 py-4 align-top">
                  <input
                    type="text"
                    value={v.fine1}
                    onChange={e => handleUpdateLocalViolation(v.id, 'fine1', e.target.value)}
                    className="w-full bg-transparent border-none outline-none text-xs"
                    placeholder="VD: Nhắc nhở"
                  />
                </td>
                <td className="px-6 py-4 align-top">
                  <input
                    type="text"
                    value={v.fine2}
                    onChange={e => handleUpdateLocalViolation(v.id, 'fine2', e.target.value)}
                    className="w-full bg-transparent border-none outline-none text-xs"
                    placeholder="VD: 50.000đ"
                  />
                </td>
                <td className="px-6 py-4 align-top">
                  <input
                    type="text"
                    value={v.fine3}
                    onChange={e => handleUpdateLocalViolation(v.id, 'fine3', e.target.value)}
                    className="w-full bg-transparent border-none outline-none text-xs"
                    placeholder="VD: Mất phụ cấp"
                  />
                </td>
                <td className="px-6 py-4 text-center align-top">
                  <button
                    onClick={() => handleRemoveLocalViolation(v.id)}
                    className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {localViolations.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="py-12 text-center text-slate-400 italic font-normal"
                >
                  Chưa có danh mục khấu trừ. Bấm "Thêm lỗi mới" để bắt đầu.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default React.memo(MechanismsViolationsSubTab);
