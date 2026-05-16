import React from 'react';
import { Plus, Trash2, CalendarCheck as DateIcon } from 'lucide-react';
import type { Holiday } from '../../types';

interface MechanismsHolidaysSubTabProps {
  holidays: Holiday[];
  onUpdate: (holidays: Holiday[]) => void;
}

const MechanismsHolidaysSubTab: React.FC<MechanismsHolidaysSubTabProps> = ({
  holidays,
  onUpdate,
}) => {
  const handleAddHoliday = () => {
    onUpdate([...holidays, { id: crypto.randomUUID(), date: '01-01', name: 'Mới' }]);
  };

  const handleUpdateHoliday = (id: string, field: keyof Holiday, value: string) => {
    onUpdate(holidays.map(item => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const handleRemoveHoliday = (id: string) => {
    onUpdate(holidays.filter(item => item.id !== id));
  };

  return (
    <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-rose-500 text-white rounded-2xl shadow-lg">
            <DateIcon className="w-6 h-6" />
          </div>
          <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight">
            Ngày Lễ (x2 Lương)
          </h4>
        </div>
        <button
          onClick={handleAddHoliday}
          className="p-3 bg-slate-900 text-white rounded-xl shadow-lg"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
      <div className="space-y-4">
        {holidays.map(h => (
          <div
            key={h.id}
            className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 group"
          >
            <input
              type="text"
              value={h.date}
              placeholder="MM-DD"
              onChange={e => handleUpdateHoliday(h.id, 'date', e.target.value)}
              className="w-24 px-4 py-2 bg-white border border-slate-200 rounded-xl font-normal text-xs text-center outline-none focus:border-indigo-500"
            />
            <input
              type="text"
              value={h.name}
              placeholder="Tên ngày lễ..."
              onChange={e => handleUpdateHoliday(h.id, 'name', e.target.value)}
              className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl font-normal text-sm outline-none focus:border-indigo-500"
            />
            <button
              onClick={() => handleRemoveHoliday(h.id)}
              className="p-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default React.memo(MechanismsHolidaysSubTab);
