import React, { useState, useMemo, useEffect } from 'react';
import {
  Employee,
  SalaryPolicy,
  AppData,
  StaffPerformanceRecord,
} from '../types';
import {
  Plus,
  Trash2,
  User,
  Calendar,
  UserCircle2,
  TrendingUp,
  X,
  Phone,
  MapPin,
  CreditCard,
  Cake,
  Save,
  Landmark,
  PieChart,
  Users,
  Target,
  Camera,
  QrCode,
  Edit3,
  Fingerprint,
  Award,
  Globe,
  Mail,
  Timer,
  LayoutList,
  // Fix: Missing Trophy import
  Trophy,
} from 'lucide-react';
import {
  calculateSeniority,
  determineCurrentPolicy,
  calculateStaffProductivity,
  calculateMarketingPerformance,
  generateId,
} from '../businessLogic';
import {
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart as RePieChart,
  Pie,
} from 'recharts';

const AnalyticsCard: React.FC<{
  title: string;
  value: string;
  icon: any;
  color: string;
  desc: string;
}> = ({ title, value, icon: Icon, color, desc }) => {
  const colorMap: any = {
    emerald: 'bg-emerald-50 text-emerald-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    blue: 'bg-blue-50 text-blue-600',
  };
  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl transition-all hover:scale-105">
      <div className={`p-4 rounded-2xl ${colorMap[color]} w-fit mb-6 shadow-sm`}>
        <Icon className="w-6 h-6" />
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
        {title}
      </p>
      <h4 className="text-2xl font-black text-slate-900 tabular-nums">{value}</h4>
      <p className="text-[9px] text-slate-400 font-bold mt-3 uppercase tracking-tighter leading-relaxed">
        {desc}
      </p>
    </div>
  );
};

const DetailInput: React.FC<{
  icon: any;
  label: string;
  type: string;
  value: string;
  onChange: (val: string) => void;
}> = ({ icon: Icon, label, type, value, onChange }) => (
  <div className="space-y-2">
    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
      {label}
    </label>
    <div className="relative group">
      <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="..."
        className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 rounded-2xl text-sm font-bold text-slate-800 outline-none transition-all shadow-sm"
      />
    </div>
  </div>
);

interface Props {
  list: Employee[];
  policies: SalaryPolicy[];
  onUpdate: (newList: Employee[], idToRemove?: string) => void;
  onUpdatePerformance?: (newList: StaffPerformanceRecord[]) => void;
  allData?: AppData;
  showResigned: boolean;
  setShowResigned: (val: boolean) => void;
  requestedTab?: 'list' | 'performance' | 'ledger';
}

const StaffManager: React.FC<Props> = ({
  list,
  policies,
  onUpdate,
  onUpdatePerformance,
  allData,
  requestedTab,
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'performance' | 'ledger'>('performance');

  const [formData, setFormData] = useState({
    name: '',
    position: 'Nhân viên',
    joinDate: new Date().toISOString().split('T')[0],
    assignedPolicyId: '',
    photoUrl: '',
    email: '',
    dob: '',
  });

  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    if (requestedTab) setActiveTab(requestedTab);
  }, [requestedTab]);

  const formatNumber = (num: number) => (num || 0).toLocaleString('vi-VN');

  const isResignedStrict = (emp: Employee) => {
    const resignedDate = emp.resignedDate;
    return !!(resignedDate && String(resignedDate).trim() !== '');
  };

  const { activeEmployees } = useMemo(() => {
    const active = list
      .filter(e => !isResignedStrict(e))
      .sort((a, b) => (b.joinDate || '').localeCompare(a.joinDate || ''));
    const resigned = list
      .filter(e => isResignedStrict(e))
      .sort((a, b) => {
        const dateA = a.resignedDate || '';
        const dateB = b.resignedDate || '';
        return dateB.localeCompare(dateA);
      });
    return { activeEmployees: active, resignedEmployees: resigned };
  }, [list]);

  const staffAnalytics = useMemo(() => {
    if (!allData) return null;
    return calculateStaffProductivity(activeEmployees, allData.revenue || []);
  }, [activeEmployees, allData]);

  const marketingPerf = useMemo(() => {
    if (!allData) return null;
    const filteredData = { ...allData, employees: activeEmployees };
    return calculateMarketingPerformance(filteredData);
  }, [activeEmployees, allData]);

  const funnelData = useMemo(() => {
    if (!marketingPerf) return [];
    return [
      {
        name: 'Doanh số tư vấn (B)',
        value: marketingPerf.activeRPE * (activeEmployees.length || 1),
        color: '#6366f1',
      },
      { name: 'Khách tự mua (GAP)', value: marketingPerf.selfServiceGap, color: '#f1f5f9' },
    ];
  }, [marketingPerf, activeEmployees]);

  const performanceLedger = useMemo(() => {
    return (allData?.staffPerformance || []).sort((a, b) => b.month.localeCompare(a.month));
  }, [allData?.staffPerformance]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const isFixedPosition =
      formData.position === 'Nhân viên thời vụ' || formData.position === 'Quản lý';
    if (isFixedPosition && !formData.assignedPolicyId) {
      alert(`Vui lòng chọn Nhóm lương cố định cho chức vụ ${formData.position}!`);
      return;
    }

    const newEmployee: Employee = {
      id: generateId(),
      name: formData.name,
      position: formData.position,
      joinDate: formData.joinDate,
      assignedPolicyId: isFixedPosition ? formData.assignedPolicyId : undefined,
      photoUrl: formData.photoUrl || undefined,
      email: formData.email,
      dob: formData.dob,
    };
    onUpdate([newEmployee, ...list]);
    setFormData({
      ...formData,
      name: '',
      position: 'Nhân viên',
      assignedPolicyId: '',
      photoUrl: '',
      email: '',
      dob: '',
    });
  };

  const handleUpdateEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    const isFixedPosition =
      editingEmployee.position === 'Nhân viên thời vụ' || editingEmployee.position === 'Quản lý';
    if (isFixedPosition && !editingEmployee.assignedPolicyId) {
      alert(`Chức vụ ${editingEmployee.position} bắt buộc phải gán một nhóm lương cụ thể.`);
      return;
    }
    onUpdate(list.map(emp => (emp.id === editingEmployee.id ? editingEmployee : emp)));
    setEditingEmployee(null);
  };

  const CardField = ({ label, value, icon: Icon }: any) => (
    <div className="flex items-center text-[12px]">
      <div className="w-32 font-black text-slate-400 uppercase tracking-[0.05em] flex items-center gap-2">
        {Icon && <Icon className="w-3.5 h-3.5 text-emerald-600" />}
        {label}
      </div>
      <div className="w-6 text-slate-300 font-black">:</div>
      <div className="flex-1 font-bold text-slate-700 truncate tracking-tight">
        {value || 'N/A'}
      </div>
    </div>
  );

  const StaffCard: React.FC<{ emp: Employee }> = ({ emp }) => {
    const isResigned = isResignedStrict(emp);
    const seniorityDays = calculateSeniority(emp.joinDate);
    const { policy: currentPolicy } = determineCurrentPolicy(emp, policies, seniorityDays);

    const displayEmail = emp.email || `${emp.name.toLowerCase().replace(/\s/g, '.')}@company.com`;

    return (
      <div
        className={`relative w-full max-w-[442px] h-[660px] bg-white rounded-[3.5rem] shadow-2xl border border-slate-100 overflow-hidden flex flex-col group transition-all duration-500 hover:scale-[1.02] hover:shadow-emerald-900/10 ${isResigned ? 'grayscale opacity-80' : ''}`}
      >
        {/* Header with Elegant Green Stripes */}
        <div className="absolute top-0 left-0 w-full h-52 overflow-hidden z-0">
          <div
            className="absolute inset-0 bg-emerald-900"
            style={{ clipPath: 'polygon(0 0, 100% 0, 100% 35%, 0 85%)' }}
          ></div>
          <div
            className="absolute inset-0 bg-emerald-700 opacity-40"
            style={{ clipPath: 'polygon(0 0, 100% 0, 100% 15%, 0 65%)' }}
          ></div>
        </div>

        {/* Action Buttons */}
        <div className="absolute top-8 right-8 z-50 flex flex-col gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setEditingEmployee(emp)}
            className="p-3.5 bg-white/20 backdrop-blur-xl text-white rounded-2xl hover:bg-white hover:text-emerald-900 transition-all shadow-xl border border-white/20"
          >
            <Edit3 className="w-5 h-5" />
          </button>
          {!isResigned && (
            <button
              onClick={() => {
                if (confirm(`Xóa nhân sự ${emp.name}?`))
                  onUpdate(
                    list.filter(i => i.id !== emp.id),
                    emp.id
                  );
              }}
              className="p-3.5 bg-rose-500/20 backdrop-blur-xl text-rose-200 rounded-2xl hover:bg-rose-500 hover:text-white transition-all shadow-xl border border-white/20"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Circular Avatar Section */}
        <div className="relative flex flex-col items-center mt-12 z-10">
          <div className="w-48 h-48 rounded-full border-[7px] border-white shadow-2xl overflow-hidden bg-slate-100 ring-4 ring-emerald-900/5 transition-transform duration-500 group-hover:scale-105">
            {emp.photoUrl ? (
              <img src={emp.photoUrl} alt={emp.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-emerald-50">
                <User className="w-20 h-20 text-emerald-200" />
              </div>
            )}
          </div>

          <div className="mt-6 text-center px-10">
            <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-tight mb-2">
              {emp.name}
            </h2>
            <div className="flex flex-col items-center gap-1.5">
              <div className="inline-block px-8 py-1.5 bg-emerald-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-600/20">
                {emp.position}
              </div>
              <div className="text-[11px] font-black text-emerald-700 uppercase tracking-wider">
                {currentPolicy?.name || 'Chưa xác định'}
              </div>
            </div>
          </div>
        </div>

        {/* Detail Data Grid - Vietnamese MIS Labels */}
        <div className="mt-10 px-14 flex-1 space-y-4">
          <CardField
            label="MÃ NHÂN VIÊN"
            value={emp.id.slice(0, 8).toUpperCase()}
            icon={Fingerprint}
          />
          <CardField
            label="NGÀY SINH"
            value={emp.dob ? emp.dob.split('-').reverse().join('/') : 'N/A'}
            icon={Cake}
          />
          <CardField
            label="NGÀY VÀO LÀM"
            value={emp.joinDate.split('-').reverse().join('/')}
            icon={Calendar}
          />
          <CardField label="SỐ NGÀY LÀM" value={`${seniorityDays} ngày`} icon={Timer} />
          <CardField label="ĐIỆN THOẠI" value={emp.phone || 'N/A'} icon={Phone} />
          <CardField label="EMAIL" value={displayEmail} icon={Mail} />
        </div>

        {/* Card Footer */}
        <div className="mt-auto h-24 bg-emerald-900 flex items-center justify-between px-14 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-emerald-400 opacity-20"></div>
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-emerald-800 rounded-xl">
              <Globe className="w-4.5 h-4.5 text-emerald-400" />
            </div>
            <span className="text-[10px] font-black text-emerald-400 tracking-[0.2em]">
              WWW.COMPANY.MIS
            </span>
          </div>
          <div className="p-2.5 bg-white rounded-xl shadow-sm">
            <QrCode className="w-9 h-9 text-emerald-900" />
          </div>
        </div>

        {/* Resigned Overlay Effect */}
        {isResigned && (
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px] pointer-events-none flex items-center justify-center">
            <div className="bg-rose-600 text-white px-10 py-5 rounded-[2.5rem] font-black uppercase text-sm tracking-[0.4em] shadow-2xl rotate-[-12deg] border-4 border-white animate-pulse">
              NGỪNG HOẠT ĐỘNG
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-10 max-w-full mx-auto pb-20 animate-in fade-in duration-700">
      {activeTab === 'performance' && (
        <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-700">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <AnalyticsCard
              title="Năng suất RPE"
              value={formatNumber(Math.round(staffAnalytics?.currentRPE || 0)) + ' đ'}
              icon={TrendingUp}
              color="emerald"
              desc="Trung bình doanh thu / Nhân viên"
            />
            <AnalyticsCard
              title="Tỷ lệ Bao phủ"
              value={(marketingPerf?.coverageRatio || 0).toFixed(1) + '%'}
              icon={Fingerprint}
              color="blue"
              desc="Doanh số có nhân viên tư vấn"
            />
            <AnalyticsCard
              title="KPI Chiến Thần (Max)"
              value={formatNumber(Math.round(marketingPerf?.kpiMax || 0)) + ' đ'}
              icon={Award}
              color="indigo"
              desc="Mục tiêu bùng nổ của Top 20%"
            />
            <AnalyticsCard
              title="Headcount"
              value={activeEmployees.length.toString()}
              icon={Users}
              color="amber"
              desc="Tổng quy mô nhân sự hệ thống"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
            <div className="lg:col-span-4 bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl flex flex-col">
              <h3 className="text-xl font-black text-slate-900 mb-8 uppercase flex items-center gap-4">
                <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg">
                  <PieChart className="w-5 h-5" />
                </div>{' '}
                ĐỐI SOÁT TƯ VẤN
              </h3>
              <div className="h-64 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={funnelData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {funnelData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatNumber(v) + 'đ'} />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-6 bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl">
              <h3 className="text-xl font-black text-slate-900 mb-8 uppercase flex items-center gap-4">
                <div className="p-3 bg-emerald-600 rounded-2xl text-white shadow-lg">
                  <Target className="w-5 h-5" />
                </div>{' '}
                THƯỚC ĐO HIỆU NĂNG CÁ NHÂN
              </h3>
              <div className="space-y-8 max-h-[400px] overflow-y-auto pr-4 no-scrollbar">
                {marketingPerf?.staffPerformance.map((perf: any) => (
                  <div key={perf.id} className="space-y-2 group/staff">
                    <div className="flex justify-between items-end">
                      <div>
                        <span className="text-sm font-black text-slate-800 uppercase">
                          {perf.name}
                        </span>
                        <p className="text-[10px] text-slate-400 font-bold">
                          Thực đạt: {formatNumber(perf.amount)}đ
                        </p>
                      </div>
                      <div className="text-right">
                        {perf.status === 'Elite' && (
                          <span className="px-3 py-1 bg-emerald-100 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-widest">
                            Elite Player
                          </span>
                        )}
                        {perf.status === 'Under' && (
                          <span className="px-3 py-1 bg-rose-100 text-rose-600 rounded-lg text-[9px] font-black uppercase tracking-widest">
                            Action Needed
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="relative w-full h-4 bg-slate-100 rounded-full overflow-hidden flex">
                      <div
                        className={`h-full transition-all duration-1000 ${perf.amount < (marketingPerf?.kpiMin || 0) ? 'bg-rose-50' : 'bg-emerald-50'}`}
                        style={{
                          width: `${Math.min((perf.amount / (marketingPerf?.kpiMax || 1)) * 100, 100)}%`,
                        }}
                      ></div>
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-slate-400"
                        style={{
                          left: `${((marketingPerf?.kpiMin || 0) / (marketingPerf?.kpiMax || 1)) * 100}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ledger' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
          <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl overflow-hidden">
            <div className="flex items-center gap-5 mb-10 border-b border-slate-50 pb-8">
              <div className="p-4 bg-emerald-600 text-white rounded-[1.5rem] shadow-lg">
                <LayoutList className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                  Sổ Cái Hiệu Năng Nhân Sự
                </h3>
                <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest mt-1">
                  Lịch sử snapshot doanh số & thu nhập nhân sự theo tháng
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                    <th className="px-8 py-5">Tháng</th>
                    <th className="px-8 py-5">Nhân viên</th>
                    <th className="px-8 py-5 text-right">Doanh số (Sales)</th>
                    <th className="px-8 py-5 text-right">Thu nhập (Income)</th>
                    <th className="px-8 py-5 text-center">MIS ROI</th>
                    <th className="px-8 py-5 text-center">Rank</th>
                    <th className="px-8 py-5 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums text-[11px] font-bold">
                  {performanceLedger.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-20 text-center opacity-40 uppercase text-xs font-black tracking-widest text-slate-400 italic"
                      >
                        Chưa có bản ghi hiệu năng. Hãy bấm "Chốt lương" để tạo snapshot.
                      </td>
                    </tr>
                  ) : (
                    performanceLedger.map(pf => (
                      <tr key={pf.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-5 text-indigo-600">
                          {pf.month.split('-').reverse().join('/')}
                        </td>
                        <td className="px-8 py-5 text-slate-900 uppercase">{pf.employeeName}</td>
                        <td className="px-8 py-5 text-right text-emerald-600">
                          {formatNumber(pf.totalSales)}đ
                        </td>
                        <td className="px-8 py-5 text-right text-rose-600">
                          {formatNumber(pf.totalIncome)}đ
                        </td>
                        <td className="px-8 py-5 text-center">
                          <span
                            className={`px-4 py-1 rounded-full text-white ${pf.roi > 5 ? 'bg-emerald-500' : pf.roi > 2 ? 'bg-blue-500' : 'bg-rose-500'}`}
                          >
                            x{pf.roi.toFixed(1)}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-center">
                          {pf.rank ? (
                            <div className="flex items-center justify-center gap-1">
                              <Trophy className="w-3.5 h-3.5 text-amber-500" />
                              <span className="font-black text-slate-900">#{pf.rank}</span>
                            </div>
                          ) : (
                            'N/A'
                          )}
                        </td>
                        <td className="px-8 py-5 text-center">
                          <button
                            onClick={() =>
                              onUpdatePerformance?.(performanceLedger.filter(p => p.id !== pf.id))
                            }
                            className="p-2 text-slate-300 hover:text-rose-500 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'list' && (
        <div className="space-y-12 animate-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white p-8 md:p-12 rounded-[3rem] border border-slate-200 shadow-xl relative overflow-hidden">
            <div className="flex items-center gap-4 mb-10 relative z-10">
              <div className="p-3 bg-emerald-600 rounded-2xl text-white shadow-lg">
                <UserCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                  Thêm Nhân Sự Mới
                </h3>
              </div>
            </div>

            <form
              onSubmit={handleAdd}
              className="grid grid-cols-1 md:grid-cols-5 gap-8 relative z-10"
            >
              <div className="md:col-span-1 space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">
                  Họ và tên
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="input-field py-4 font-bold border-none bg-slate-50"
                  placeholder="Họ tên..."
                />
              </div>
              <div className="md:col-span-1 space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">
                  Chức vụ
                </label>
                <select
                  value={formData.position}
                  onChange={e => setFormData({ ...formData, position: e.target.value })}
                  className="input-field py-4 font-bold border-none bg-slate-50 appearance-none"
                >
                  <option value="Nhân viên">Nhân viên</option>
                  <option value="Quản lý">Quản lý</option>
                  <option value="Nhân viên thời vụ">Nhân viên thời vụ</option>
                </select>
              </div>
              <div className="md:col-span-1 space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">
                  Ngày vào làm
                </label>
                <input
                  type="date"
                  value={formData.joinDate}
                  onChange={e => setFormData({ ...formData, joinDate: e.target.value })}
                  className="input-field py-4 font-bold border-none bg-slate-50"
                />
              </div>
              <div className="md:col-span-1 space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">
                  Gán Nhóm Lương
                </label>
                <select
                  value={formData.assignedPolicyId}
                  onChange={e => setFormData({ ...formData, assignedPolicyId: e.target.value })}
                  className="input-field py-4 font-bold border-none bg-slate-50 appearance-none"
                >
                  <option value="">Tự động theo thâm niên</option>
                  {policies.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full bg-slate-900 hover:bg-black text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" /> THÊM NHÂN SỰ
                </button>
              </div>
            </form>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-4 px-2 border-b border-slate-200 pb-4">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl shadow-sm">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                Danh sách thẻ nhân viên
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-12 justify-items-center">
              {activeEmployees.map(emp => (
                <StaffCard key={emp.id} emp={emp} />
              ))}
              {activeEmployees.length === 0 && (
                <div className="col-span-full py-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-200 text-center opacity-40">
                  <p className="text-sm font-black text-slate-400 uppercase tracking-widest">
                    Chưa có nhân sự đang làm việc
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {editingEmployee && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            onClick={() => setEditingEmployee(null)}
          ></div>
          <div className="relative bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[3.5rem] shadow-2xl p-12 no-scrollbar animate-in zoom-in-95 duration-300">
            <button
              onClick={() => setEditingEmployee(null)}
              className="absolute top-8 right-8 p-3 bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-2xl transition-all shadow-sm"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="flex flex-col md:flex-row items-center gap-8 mb-12 border-b border-slate-50 pb-10">
              <div
                className={`w-24 h-24 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white text-4xl font-black shadow-xl overflow-hidden`}
              >
                {editingEmployee.photoUrl ? (
                  <img
                    src={editingEmployee.photoUrl}
                    alt={editingEmployee.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  editingEmployee.name.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight">
                  {editingEmployee.name}
                </h3>
              </div>
            </div>
            <form onSubmit={handleUpdateEmployee} className="space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-8">
                  <div className="flex items-center gap-3 text-emerald-600">
                    <User className="w-5 h-5" />
                    <h4 className="text-[11px] font-black uppercase tracking-[0.2em]">
                      Thông tin cơ bản
                    </h4>
                  </div>
                  <div className="space-y-6">
                    <DetailInput
                      icon={User}
                      label="Họ và tên"
                      type="text"
                      value={editingEmployee.name}
                      onChange={v => setEditingEmployee({ ...editingEmployee, name: v })}
                    />
                    <DetailInput
                      icon={Camera}
                      label="Link ảnh chân dung (URL)"
                      type="text"
                      value={editingEmployee.photoUrl || ''}
                      onChange={v => setEditingEmployee({ ...editingEmployee, photoUrl: v })}
                    />
                    <DetailInput
                      icon={Mail}
                      label="Địa chỉ Email"
                      type="email"
                      value={editingEmployee.email || ''}
                      onChange={v => setEditingEmployee({ ...editingEmployee, email: v })}
                    />
                    <DetailInput
                      icon={Cake}
                      label="Ngày sinh / DOB"
                      type="date"
                      value={editingEmployee.dob || ''}
                      onChange={v => setEditingEmployee({ ...editingEmployee, dob: v })}
                    />
                    <DetailInput
                      icon={Phone}
                      label="Số điện thoại"
                      type="tel"
                      value={editingEmployee.phone || ''}
                      onChange={v => setEditingEmployee({ ...editingEmployee, phone: v })}
                    />
                    <DetailInput
                      icon={MapPin}
                      label="Địa chỉ thường trú"
                      type="text"
                      value={editingEmployee.address || ''}
                      onChange={v => setEditingEmployee({ ...editingEmployee, address: v })}
                    />
                  </div>
                </div>
                <div className="space-y-8">
                  <div className="flex items-center gap-3 text-indigo-600">
                    <Landmark className="w-5 h-5" />
                    <h4 className="text-[11px] font-black uppercase tracking-[0.2em]">
                      Thanh toán & Hợp đồng
                    </h4>
                  </div>
                  <div className="space-y-6">
                    <DetailInput
                      icon={Calendar}
                      label="Ngày vào làm chính thức"
                      type="date"
                      value={editingEmployee.joinDate}
                      onChange={v => setEditingEmployee({ ...editingEmployee, joinDate: v })}
                    />
                    <DetailInput
                      icon={CreditCard}
                      label="Số tài khoản ngân hàng"
                      type="text"
                      value={editingEmployee.bankAccountNumber || ''}
                      onChange={v =>
                        setEditingEmployee({ ...editingEmployee, bankAccountNumber: v })
                      }
                    />
                    <DetailInput
                      icon={Landmark}
                      label="Tên Ngân hàng"
                      type="text"
                      value={editingEmployee.bankName || ''}
                      onChange={v => setEditingEmployee({ ...editingEmployee, bankName: v })}
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-4 pt-4 border-t border-slate-50">
                <button
                  type="submit"
                  className="bg-slate-900 hover:bg-black text-white px-12 py-5 rounded-2xl font-black text-xs shadow-xl flex items-center gap-3 uppercase tracking-widest"
                >
                  <Save className="w-5 h-5" /> CẬP NHẬT HỒ SƠ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManager;
