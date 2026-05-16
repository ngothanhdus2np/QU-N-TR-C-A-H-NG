import React from 'react';
import { Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';
import { ContentStrategy, ProductLine, StrategicAdvice } from '../../types';
import { STRATEGY_COLORS } from '../../constants/marketing';
import { getMonthlyStrategicAdvice } from '../../services/marketingClaudeService';

interface MarketingSettingsTabProps {
  strategies: ContentStrategy[];
  setStrategies: React.Dispatch<React.SetStateAction<ContentStrategy[]>>;
  focusProducts: ProductLine[];
  setFocusProducts: React.Dispatch<React.SetStateAction<ProductLine[]>>;
  aiAdvice: StrategicAdvice | null;
  setAiAdvice: React.Dispatch<React.SetStateAction<StrategicAdvice | null>>;
  adviceLoading: boolean;
  setAdviceLoading: React.Dispatch<React.SetStateAction<boolean>>;
  viewDate: Date;
  onApplyAdvice: () => void;
}

const MarketingSettingsTab: React.FC<MarketingSettingsTabProps> = ({
  strategies,
  setStrategies,
  focusProducts,
  setFocusProducts,
  aiAdvice,
  setAiAdvice,
  adviceLoading,
  setAdviceLoading,
  viewDate,
  onApplyAdvice,
}) => {
  const totalPercentage = strategies.reduce((sum, s) => sum + s.percentage, 0);

  const handleRunAdvice = async () => {
    setAdviceLoading(true);
    setAiAdvice(await getMonthlyStrategicAdvice(viewDate.getMonth() + 1, viewDate.getFullYear(), strategies));
    setAdviceLoading(false);
  };

  return (
    <div className="p-6 flex flex-col gap-4 h-full overflow-hidden">
      <div className="flex flex-col md:flex-row gap-4 flex-[2] min-h-0">
        <div className="w-full md:w-[40%] flex flex-col border rounded-[2rem] overflow-hidden bg-slate-50/30">
          <div className="p-4 bg-white border-b flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-xs font-normal uppercase text-slate-800">Tỉ lệ bài đăng</span>
              <div className="flex items-center gap-2 mt-0.5">
                <div className={`w-1.5 h-1.5 rounded-full ${totalPercentage === 100 ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`}></div>
                <span className={`text-[9px] font-normal uppercase ${totalPercentage === 100 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  Tổng: {totalPercentage}%
                </span>
              </div>
            </div>
            <button onClick={() => setStrategies(prev => [...prev, { id: Date.now().toString(), name: 'Tuyến mới', percentage: 0, description: '', color: 'blue' }])} className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-md"><Plus size={14} /></button>
          </div>
          <div className="p-4 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner border border-slate-200">
              {strategies.map((s) => (
                <div
                  key={s.id}
                  style={{ width: `${s.percentage}%`, backgroundColor: (STRATEGY_COLORS[s.color as keyof typeof STRATEGY_COLORS] || STRATEGY_COLORS.blue).hex }}
                  className="h-full transition-all duration-500 ease-out border-r border-white/20 last:border-r-0"
                  title={`${s.name}: ${s.percentage}%`}
                />
              ))}
            </div>

            <div className="space-y-2">
              {(strategies || []).map(s => (
                <div key={s.id} className="group bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all duration-200">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 mr-3">
                      <input
                        value={s.name}
                        onChange={e => setStrategies(prev => prev.map(x => x.id === s.id ? { ...x, name: e.target.value } : x))}
                        className="w-full font-normal text-[10px] uppercase outline-none border-b border-transparent focus:border-indigo-400 bg-transparent py-0.5 transition-colors"
                        placeholder="Tên tuyến..."
                      />
                      <div className="mt-1 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, s.percentage)}%`,
                            backgroundColor: (STRATEGY_COLORS[s.color as keyof typeof STRATEGY_COLORS] || STRATEGY_COLORS.blue).hex
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center bg-slate-50 rounded-lg px-2 py-1 border border-slate-100 group-hover:border-indigo-100 transition-colors">
                        <input
                          type="number"
                          value={s.percentage}
                          onChange={e => setStrategies(prev => prev.map(x => x.id === s.id ? { ...x, percentage: parseInt(e.target.value) || 0 } : x))}
                          className="w-8 text-right text-[10px] font-normal outline-none bg-transparent text-indigo-900"
                        />
                        <span className="ml-0.5 text-[8px] font-normal text-slate-400">%</span>
                      </div>
                      <button
                        onClick={() => setStrategies(prev => prev.filter(x => x.id !== s.id))}
                        className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {Object.entries(STRATEGY_COLORS).map(([colorName, colorValue]) => (
                      <button
                        key={colorName}
                        onClick={() => setStrategies(prev => prev.map(x => x.id === s.id ? { ...x, color: colorName } : x))}
                        className={`w-3 h-3 rounded-full border transition-transform hover:scale-125 ${s.color === colorName ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: colorValue.hex }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="w-full md:w-[60%] flex flex-col border rounded-[2rem] overflow-hidden bg-slate-50/30">
          <div className="p-3 bg-white border-b flex justify-between items-center">
            <span className="text-[10px] font-normal uppercase text-red-600">Sản phẩm trọng tâm</span>
            <button
              onClick={() => {
                const name = window.prompt("Nhập tên sản phẩm trọng tâm mới:");
                if (name) {
                  setFocusProducts(prev => [...prev, { id: Date.now().toString(), name, target: 'Khách hàng mục tiêu', highlights: 'Đặc điểm nổi bật', isSelected: true }]);
                }
              }}
              className="p-1 bg-red-600 text-white rounded-md shadow-md hover:bg-red-700 transition-colors"
            >
              <Plus size={12} />
            </button>
          </div>
          <div className="p-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 overflow-y-auto flex-1 custom-scrollbar">
            {(focusProducts || []).map(p => (
              <div key={p.id} className={`bg-white px-2 py-1 rounded-lg border border-l-2 ${p.isSelected !== false ? 'border-l-red-500' : 'border-l-slate-300 opacity-60'} shadow-sm flex justify-between items-center gap-2 hover:shadow-md transition-all group h-fit`}>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <input
                    type="checkbox"
                    checked={p.isSelected !== false}
                    onChange={() => setFocusProducts(prev => prev.map(x => x.id === p.id ? { ...x, isSelected: !(x.isSelected !== false) } : x))}
                    className="w-3 h-3 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                  />
                  <span className={`font-normal text-xs uppercase truncate ${p.isSelected !== false ? 'text-slate-800' : 'text-slate-400'}`}>
                    {p.name}
                  </span>
                </div>
                <button onClick={() => setFocusProducts(prev => prev.filter(x => x.id !== p.id))} className="text-slate-200 hover:text-red-500 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-indigo-900 rounded-[2rem] p-5 text-white flex flex-col md:flex-row justify-between items-center gap-5 flex-shrink-0">
        <div className="flex flex-col gap-2 text-center md:text-left flex-1">
          <div className="flex items-center gap-2 bg-indigo-800 w-fit px-2 py-0.5 rounded-md text-[8px] font-normal uppercase mx-auto md:mx-0"><Sparkles size={12} className="text-yellow-400" /> Phân tích AI</div>
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-black uppercase tracking-tight">Tháng {viewDate.getMonth() + 1} / {viewDate.getFullYear()}</h2>
            <div className="flex gap-2">
              {adviceLoading ? <Loader2 className="animate-spin" size={16} /> : <button onClick={handleRunAdvice} className="bg-white text-indigo-900 px-4 py-1.5 rounded-lg font-normal text-[9px] uppercase shadow-md hover:scale-105 transition-all">Phân tích mới</button>}
              {aiAdvice && <button onClick={onApplyAdvice} className="bg-indigo-700 text-white border border-indigo-500 px-4 py-1.5 rounded-lg font-normal text-[9px] uppercase hover:bg-indigo-600 transition-all">Áp dụng tỉ lệ</button>}
            </div>
          </div>
          <p className="text-indigo-200 text-[10px] max-w-3xl line-clamp-2 font-normal italic">{aiAdvice?.marketInsight || "Hãy chạy phân tích để nhận lời khuyên thị trường..."}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full md:w-auto">
          {(aiAdvice?.holidays || []).slice(0, 4).map((h, i) => <div key={i} className="bg-white/10 p-2 rounded-lg border border-white/5 text-[8px] font-normal uppercase text-center whitespace-nowrap">{h}</div>)}
        </div>
      </div>
    </div>
  );
};

export default MarketingSettingsTab;
