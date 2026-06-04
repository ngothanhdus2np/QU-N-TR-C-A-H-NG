import React from 'react';
import { SalaryPolicy } from '../../types';
import {
  Plus,
  ChevronRight,
  Save,
  Trash2,
  Settings,
  Layers,
  CalendarCheck,
  Sparkles,
  ShieldCheck as ResponsibilityIcon,
  Info,
  HeartHandshake,
  Home,
  Utensils,
  Timer,
  Shield,
  Banknote,
} from 'lucide-react';

interface Props {
  policies: SalaryPolicy[];
  selectedPolicyId: string | null;
  setSelectedPolicyId: (id: string | null) => void;
  policyForm: Partial<SalaryPolicy>;
  setPolicyForm: (form: Partial<SalaryPolicy>) => void;
  onSavePolicy: () => void;
  onRemovePolicy: (id: string) => void;
  onAddNewPolicy: () => void;
}

const AllowanceInput = ({
  icon: Icon,
  label,
  value,
  onChange,
  color = 'text-emerald-600',
}: any) => (
  <div className="bg-white p-4 rounded-2xl border border-slate-100 focus-within:border-indigo-200 transition-all shadow-sm flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className="p-2 bg-slate-50 rounded-xl shadow-sm">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
      </div>
      <span className="text-[9px] font-normal text-slate-500 uppercase tracking-tighter">
        {label}
      </span>
    </div>
    <input
      type="number"
      value={value || 0}
      onChange={e => onChange(Number(e.target.value))}
      className="w-32 bg-transparent border-none outline-none font-normal text-slate-800 text-right text-sm"
    />
  </div>
);

const AllowanceRow = ({ icon: Icon, label, value, color = 'text-slate-400' }: any) => (
  <div className="flex items-center justify-between py-1 border-b border-slate-50/50 last:border-none">
    <div className="flex items-center gap-2.5">
      <Icon className={`w-3 h-3 ${color}`} />
      <span className="text-2xs font-normal text-slate-500 uppercase tracking-tight">{label}</span>
    </div>
    <span className="text-xs font-normal text-slate-700">{(value || 0).toLocaleString()}đ</span>
  </div>
);

const MechanismsSalarySubTab: React.FC<Props> = ({
  policies,
  selectedPolicyId,
  setSelectedPolicyId,
  policyForm,
  setPolicyForm,
  onSavePolicy,
  onRemovePolicy,
  onAddNewPolicy,
}) => {
  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20">
        {policies.map(p => {
          const totalFixedIncome =
            (p.baseSalary || 0) +
            (p.attendanceAllowance || 0) +
            (p.cleaningAllowance || 0) +
            (p.customerServiceAllowance || 0) +
            (p.housingAllowance || 0) +
            (p.responsibilityAllowance || 0);
          return (
            <div
              key={p.id}
              onClick={() => {
                setSelectedPolicyId(p.id);
                setTimeout(
                  () =>
                    document
                      .getElementById('policy-editor')
                      ?.scrollIntoView({ behavior: 'smooth' }),
                  100
                );
              }}
              className={`group p-8 rounded-[3.5rem] border-2 transition-all duration-500 min-h-[880px] cursor-pointer relative flex flex-col ${selectedPolicyId === p.id ? 'bg-white border-indigo-600 shadow-2xl ring-8 ring-indigo-50 translate-y-[-8px]' : 'bg-white border-slate-100 shadow-lg hover:border-slate-200'}`}
            >
              <div className="flex items-start justify-between mb-8 relative z-10">
                <div
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl ${selectedPolicyId === p.id ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'}`}
                >
                  <Layers className="w-8 h-8" />
                </div>
                <div className="text-right">
                  <span className="block px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-normal uppercase tracking-widest mb-1">
                    {p.salaryType === 'monthly' ? 'Lương Tháng' : 'Lương Ngày'}
                  </span>
                  <span className="block text-2xs font-normal text-slate-400 uppercase">
                    ID: {p.id}
                  </span>
                </div>
              </div>
              <h4 className="font-semibold text-xl mb-4 text-slate-900 uppercase tracking-tight break-words">
                {p.name}
              </h4>

              <div className="p-5 bg-indigo-600 rounded-[2rem] mb-6 shadow-xl shadow-indigo-200 border border-indigo-500 group-hover:scale-[1.02] transition-transform">
                <div className="flex items-center gap-2 mb-1">
                  <Banknote className="w-4 h-4 text-indigo-200" />
                  <p className="text-[9px] font-normal text-indigo-100 uppercase tracking-widest">
                    Gói thu nhập cố định
                  </p>
                </div>
                <p className="text-2xl font-normal text-white tabular-nums">
                  {totalFixedIncome.toLocaleString()}đ
                </p>
                <p className="text-[8px] text-indigo-200 font-normal uppercase mt-1 italic">
                  * Chưa gồm Hoa hồng, Ăn tối, OT
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl mb-6 border border-slate-100/50">
                <p className="text-2xs font-normal text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Timer className="w-3 h-3" /> Khoảng thâm niên nhảy bậc
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-[8px] font-normal text-slate-400 uppercase">Bắt đầu</p>
                    <p className="text-sm font-normal text-indigo-700">
                      {p.startThreshold} ngày
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-indigo-300" />
                  <div className="flex-1">
                    <p className="text-[8px] font-normal text-slate-400 uppercase">
                      Kết thúc
                    </p>
                    <p className="text-sm font-normal text-indigo-700">
                      {p.endThreshold === 0 ? '∞ (Vô cực)' : `${p.endThreshold} ngày`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 flex-1">
                <div className="flex justify-between items-center">
                  <span className="text-2xs text-slate-400 font-normal uppercase">
                    Lương Cơ Bản
                  </span>
                  <span className="text-lg font-normal text-slate-900 tabular-nums">
                    {(p.baseSalary || 0).toLocaleString()}đ
                  </span>
                </div>

                <div className="space-y-2 mt-4">
                  <p className="text-[9px] font-normal text-slate-400 uppercase tracking-[0.2em] mb-3">
                    CHI TIẾT PHỤ CẤP
                  </p>
                  <AllowanceRow
                    icon={CalendarCheck}
                    label="Chuyên cần"
                    value={p.attendanceAllowance}
                  />
                  <AllowanceRow
                    icon={Sparkles}
                    label="Vệ sinh"
                    value={p.cleaningAllowance}
                  />
                  <AllowanceRow
                    icon={HeartHandshake}
                    label="CSKH"
                    value={p.customerServiceAllowance}
                  />
                  <AllowanceRow
                    icon={Utensils}
                    label="Ăn tối (ngày)"
                    value={p.dinnerAllowance}
                  />
                  <AllowanceRow icon={Home} label="Hỗ trợ ở" value={p.housingAllowance} />
                  <AllowanceRow
                    icon={Shield}
                    label="Trách nhiệm"
                    value={p.responsibilityAllowance}
                    color="text-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-6 border-t border-slate-50 mt-auto">
                  <div>
                    <p className="text-[8px] font-normal text-emerald-500 uppercase">
                      Hoa Hồng
                    </p>
                    <p className="text-sm font-normal">{p.commissionRate || 0}%</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-normal text-amber-500 uppercase">
                      Đơn giá OT
                    </p>
                    <p className="text-sm font-normal">
                      {(p.otRate || 0).toLocaleString()}đ
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-between items-center pt-6 border-t border-slate-50">
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onRemovePolicy(p.id);
                  }}
                  className="p-3 text-slate-300 hover:text-rose-500 transition-all"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <div className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-2xl text-2xs font-normal uppercase group-hover:bg-indigo-600 group-hover:text-white transition-all">
                  Sửa Cơ Chế
                </div>
              </div>
            </div>
          );
        })}
        <button
          onClick={onAddNewPolicy}
          className="p-10 rounded-[3.5rem] border-4 border-dashed border-slate-200 hover:border-indigo-400 text-slate-400 flex flex-col items-center justify-center gap-6 min-h-[880px] transition-all"
        >
          <Plus className="w-16 h-16" />
          <span className="text-xs font-normal uppercase tracking-widest">
            Thêm Nhóm Lương
          </span>
        </button>
      </div>

      {selectedPolicyId && (
        <div
          id="policy-editor"
          className="bg-white rounded-[3.5rem] border border-slate-200 shadow-2xl p-10 space-y-12 animate-in slide-in-from-top-4 duration-500 scroll-mt-20"
        >
          <div className="flex items-center justify-between border-b border-slate-50 pb-8">
            <div className="flex items-center gap-5">
              <div className="p-4 bg-indigo-600 text-white rounded-3xl shadow-xl">
                <Settings className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-3xl font-semibold text-slate-900 uppercase tracking-tight">
                  Cấu hình: {policyForm.name}
                </h4>
                <p className="text-2xs font-normal text-slate-400 uppercase tracking-widest mt-1">
                  Chỉnh sửa điều kiện nhảy bậc và phụ cấp
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setSelectedPolicyId(null)}
                className="px-8 py-5 rounded-2xl font-normal text-xs text-slate-400 uppercase"
              >
                Hủy bỏ
              </button>
              <button
                onClick={onSavePolicy}
                className="bg-indigo-600 text-white px-12 py-5 rounded-2xl font-normal text-xs shadow-xl flex items-center gap-4 uppercase tracking-widest hover:bg-black transition-all"
              >
                <Save className="w-6 h-6" /> Lưu Cơ Chế
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-16">
            <div className="xl:col-span-2 space-y-12">
              <div className="p-8 bg-indigo-50 rounded-[2.5rem] border border-indigo-100 space-y-8">
                <div className="flex items-center gap-3 border-b border-indigo-200 pb-4">
                  <Timer className="w-6 h-6 text-indigo-600" />
                  <h5 className="text-xs font-semibold text-indigo-900 uppercase tracking-widest">
                    ĐIỀU KIỆN THỜI GIAN (NHẢY BẬC TỰ ĐỘNG)
                  </h5>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-4">
                    <label className="text-2xs font-normal text-slate-500 uppercase ml-1">
                      Mốc Bắt Đầu (Ngày công tác)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={policyForm.startThreshold || 0}
                        onChange={e =>
                          setPolicyForm({
                            ...policyForm,
                            startThreshold: Number(e.target.value),
                          })
                        }
                        className="w-full px-8 py-5 bg-white border-2 border-indigo-200 rounded-[2rem] text-xl font-normal text-indigo-900 outline-none focus:border-indigo-500 transition-all shadow-inner"
                      />
                      <span className="absolute right-8 top-1/2 -translate-y-1/2 text-2xs font-normal text-slate-300 uppercase tracking-widest">
                        Ngày
                      </span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="text-2xs font-normal text-slate-500 uppercase ml-1">
                      Mốc Kết Thúc (0 = Vô cực)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={policyForm.endThreshold || 0}
                        onChange={e =>
                          setPolicyForm({
                            ...policyForm,
                            endThreshold: Number(e.target.value),
                          })
                        }
                        className="w-full px-8 py-5 bg-white border-2 border-indigo-200 rounded-[2rem] text-xl font-normal text-indigo-900 outline-none focus:border-indigo-500 transition-all shadow-inner"
                      />
                      <div className="absolute right-8 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        {policyForm.endThreshold === 0 && (
                          <span className="text-2xl font-normal text-indigo-400">∞</span>
                        )}
                        <span className="text-2xs font-normal text-slate-300 uppercase tracking-widest">
                          {policyForm.endThreshold === 0 ? 'TRỞ ĐI' : 'NGÀY'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 bg-indigo-100/50 rounded-2xl border border-indigo-200/50">
                  <Info className="w-5 h-5 text-indigo-600 mt-1" />
                  <p className="text-xs text-indigo-800 font-normal leading-relaxed italic">
                    Gợi ý: Hệ thống sẽ tự động gán bậc lương dựa trên số ngày nhân viên đã
                    làm việc. Nếu mốc Kết thúc là 0, bậc này sẽ kéo dài mãi mãi cho đến khi
                    có bậc cao hơn.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-2">
                  <label className="text-2xs font-normal text-slate-400 uppercase tracking-widest ml-1">
                    Tên Nhóm
                  </label>
                  <input
                    type="text"
                    value={policyForm.name || ''}
                    onChange={e => setPolicyForm({ ...policyForm, name: e.target.value })}
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-base font-normal outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-2xs font-normal text-slate-400 uppercase tracking-widest ml-1">
                    Lương Gốc (đ)
                  </label>
                  <input
                    type="number"
                    value={policyForm.baseSalary || 0}
                    onChange={e =>
                      setPolicyForm({ ...policyForm, baseSalary: Number(e.target.value) })
                    }
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-base font-normal outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-2xs font-normal text-slate-400 uppercase tracking-widest ml-1">
                    Đơn giá OT (đ/h)
                  </label>
                  <input
                    type="number"
                    value={policyForm.otRate || 0}
                    onChange={e =>
                      setPolicyForm({ ...policyForm, otRate: Number(e.target.value) })
                    }
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-base font-normal outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-2xs font-normal text-slate-400 uppercase tracking-widest ml-1">
                    Hoa Hồng (%)
                  </label>
                  <input
                    type="number"
                    value={policyForm.commissionRate || 0}
                    onChange={e =>
                      setPolicyForm({
                        ...policyForm,
                        commissionRate: Number(e.target.value),
                      })
                    }
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-base font-normal outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-8 bg-slate-50 p-8 rounded-[3rem] border border-slate-100 shadow-inner">
              <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                <Sparkles className="w-6 h-6 text-emerald-500" />
                <h5 className="text-xs font-semibold text-slate-800 uppercase tracking-widest">
                  Phụ cấp Cố định
                </h5>
              </div>
              <div className="space-y-5">
                <AllowanceInput
                  icon={CalendarCheck}
                  label="Chuyên cần"
                  value={policyForm.attendanceAllowance}
                  onChange={(v: number) =>
                    setPolicyForm({ ...policyForm, attendanceAllowance: v })
                  }
                />
                <AllowanceInput
                  icon={Sparkles}
                  label="Vệ sinh"
                  value={policyForm.cleaningAllowance}
                  onChange={(v: number) =>
                    setPolicyForm({ ...policyForm, cleaningAllowance: v })
                  }
                />
                <AllowanceInput
                  icon={HeartHandshake}
                  label="CSKH"
                  value={policyForm.customerServiceAllowance}
                  onChange={(v: number) =>
                    setPolicyForm({ ...policyForm, customerServiceAllowance: v })
                  }
                />
                <AllowanceInput
                  icon={Utensils}
                  label="Ăn tối"
                  value={policyForm.dinnerAllowance}
                  onChange={(v: number) =>
                    setPolicyForm({ ...policyForm, dinnerAllowance: v })
                  }
                />
                <AllowanceInput
                  icon={Home}
                  label="Hỗ trợ Ở"
                  value={policyForm.housingAllowance}
                  onChange={(v: number) =>
                    setPolicyForm({ ...policyForm, housingAllowance: v })
                  }
                />
                <AllowanceInput
                  icon={ResponsibilityIcon}
                  label="Trách nhiệm"
                  value={policyForm.responsibilityAllowance}
                  onChange={(v: number) =>
                    setPolicyForm({ ...policyForm, responsibilityAllowance: v })
                  }
                  color="text-rose-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(MechanismsSalarySubTab);
