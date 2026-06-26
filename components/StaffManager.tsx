import React, { useMemo, useState } from 'react';
import { Employee, SalaryPolicy, AppData, StaffPerformanceRecord } from '../types';
import {
  Plus,
  Trash2,
  User,
  UserPlus,
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
  Search,
  Activity,
  Clock,
  Gavel,
  ListChecks,
  // Fix: Missing Trophy import
  Trophy,
} from 'lucide-react';
import {
  calculateSeniority,
  determineCurrentPolicy,
  calculateStaffProductivity,
  calculateMarketingPerformance,
  generateId,
} from '../src/lib';
import { buildStaffPerformanceLedger } from '../src/lib/staffPerformanceLedger';
import { Tooltip, ResponsiveContainer, Cell, PieChart as RePieChart, Pie } from 'recharts';
import { useStaffManagerState } from '../hooks/useStaffManagerState';
import { useToast } from './ui/Toast';
import { FilterSection } from './shared';

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
      <p className="text-2xs font-normal text-slate-400 uppercase tracking-widest mb-1">
        {title}
      </p>
      <h4 className="text-2xl font-normal text-slate-900 tabular-nums">{value}</h4>
      <p className="text-[9px] text-slate-400 font-normal mt-3 uppercase tracking-tighter leading-relaxed">
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
    <label className="text-[9px] font-normal text-slate-400 uppercase tracking-widest ml-1">
      {label}
    </label>
    <div className="relative group">
      <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="..."
        className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 rounded-2xl text-sm font-normal text-slate-800 outline-none transition-all shadow-sm"
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
  onSelectMainTab?: (tab: string) => void;
}

const STAFF_NAV_ITEMS = [
  { id: 'staff', label: 'Danh sách nhân sự', icon: UserPlus },
  { id: 'staff-ledger', label: 'Sổ cái hiệu năng', icon: LayoutList },
];

const PAYROLL_NAV_ITEMS = [
  { id: 'payroll-attendance', label: 'Chấm công', icon: ListChecks },
  { id: 'payroll-overtime', label: 'Tăng ca', icon: Clock },
  { id: 'payroll-sales', label: 'Doanh số', icon: TrendingUp },
  { id: 'payroll-penalties', label: 'Các khoản khấu trừ', icon: Gavel },
  { id: 'payroll-summary', label: 'Bảng lương', icon: Activity },
  { id: 'payroll-ledger', label: 'Sổ cái lương', icon: Landmark },
];

const StaffManager: React.FC<Props> = ({
  list,
  policies,
  onUpdate,
  onUpdatePerformance,
  allData,
  requestedTab,
  onSelectMainTab,
}) => {
  const {
    activeTab,
    setActiveTab,
    formData,
    setFormData,
    editingEmployee,
    setEditingEmployee,
    resetForm,
    loadEmployeeForEdit,
  } = useStaffManagerState({ requestedTab });
  const { showToast } = useToast();
  const [staffSearch, setStaffSearch] = useState('');
  const [staffStatusFilter, setStaffStatusFilter] = useState<'active' | 'resigned' | 'all'>(
    'active'
  );
  const [positionFilter, setPositionFilter] = useState('all');
  const [policyFilter, setPolicyFilter] = useState('all');
  const [debtFilter, setDebtFilter] = useState<'all' | 'hasDebt' | 'noDebt'>('all');
  const [staffViewMode, setStaffViewMode] = useState<'table' | 'card'>('table');
  const [showCreateModal, setShowCreateModal] = useState(false);

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

  const performanceLedger = useMemo(() => buildStaffPerformanceLedger(allData), [allData]);

  const positionOptions = useMemo(
    () => Array.from(new Set(list.map(emp => emp.position).filter(Boolean))).sort(),
    [list]
  );

  const filteredStaff = useMemo(() => {
    const query = staffSearch.trim().toLowerCase();
    return list
      .filter(emp => {
        const isResigned = isResignedStrict(emp);
        if (staffStatusFilter === 'active' && isResigned) return false;
        if (staffStatusFilter === 'resigned' && !isResigned) return false;
        if (positionFilter !== 'all' && emp.position !== positionFilter) return false;
        if (policyFilter !== 'all' && (emp.assignedPolicyId || '') !== policyFilter) return false;
        const hasDebt = (emp.carryForwardDebt || 0) > 0;
        if (debtFilter === 'hasDebt' && !hasDebt) return false;
        if (debtFilter === 'noDebt' && hasDebt) return false;
        if (!query) return true;
        const haystack = [emp.id, emp.name, emp.position, emp.phone, emp.email, emp.address]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => {
        const aResigned = isResignedStrict(a);
        const bResigned = isResignedStrict(b);
        if (aResigned !== bResigned) return aResigned ? 1 : -1;
        return (b.joinDate || '').localeCompare(a.joinDate || '');
      });
  }, [debtFilter, list, policyFilter, positionFilter, staffSearch, staffStatusFilter]);

  const hasActiveStaffFilters =
    staffSearch.trim() ||
    staffStatusFilter !== 'active' ||
    positionFilter !== 'all' ||
    policyFilter !== 'all' ||
    debtFilter !== 'all';

  const clearStaffFilters = () => {
    setStaffSearch('');
    setStaffStatusFilter('active');
    setPositionFilter('all');
    setPolicyFilter('all');
    setDebtFilter('all');
  };

  const staffNavigationPanel = (
    <div className="shrink-0 rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
      <div className="px-4 min-h-[58px] border-b border-slate-100 flex flex-col justify-center">
        <h2 className="line-clamp-2 text-sm font-medium leading-5 text-slate-700">
          {activeTab === 'ledger' ? 'Sổ cái hiệu năng' : 'Danh sách nhân sự'}
        </h2>
        <p className="text-xs text-slate-400">Nhân sự</p>
      </div>
      <div className="p-3 space-y-5">
        <div className="space-y-2">
          <p className="px-1 text-sm font-normal text-slate-600">Nhân sự</p>
          <div className="space-y-1">
            {STAFF_NAV_ITEMS.map(item => {
              const Icon = item.icon;
              const isActive =
                (item.id === 'staff' && activeTab === 'list') ||
                (item.id === 'staff-ledger' && activeTab === 'ledger');
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectMainTab?.(item.id)}
                  className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-normal transition-all ${
                    isActive
                      ? 'border-indigo-100 bg-indigo-50 text-indigo-700 shadow-sm'
                      : 'border-transparent text-slate-500 hover:border-slate-100 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-2">
          <p className="px-1 text-sm font-normal text-slate-600">Lương & Thưởng</p>
          <div className="space-y-1">
            {PAYROLL_NAV_ITEMS.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectMainTab?.(item.id)}
                  className="flex w-full items-center gap-2 rounded-xl border border-transparent px-3 py-2.5 text-left text-sm font-normal text-slate-500 transition-all hover:border-slate-100 hover:bg-slate-50 hover:text-slate-900"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  const staffFilterPanel = (
    <div className="flex-1 min-h-0 flex flex-col rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
      <div className="px-4 min-h-[52px] border-b border-slate-100 flex items-center justify-between shrink-0">
        <h3 className="line-clamp-2 text-sm font-medium leading-5 text-slate-700">Bộ lọc</h3>
        {hasActiveStaffFilters && (
          <button
            onClick={clearStaffFilters}
            className="text-2xs text-indigo-600 font-normal hover:underline"
          >
            Xóa lọc
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar overscroll-contain">
        <FilterSection title="Trạng thái">
          <div className="space-y-1.5">
            {[
              { value: 'active', label: 'Đang làm' },
              { value: 'resigned', label: 'Đã nghỉ' },
              { value: 'all', label: 'Tất cả' },
            ].map(option => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
              >
                <input
                  type="radio"
                  name="staffStatus"
                  checked={staffStatusFilter === option.value}
                  onChange={() => setStaffStatusFilter(option.value as typeof staffStatusFilter)}
                  className="accent-emerald-600"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Chức vụ">
          <select
            value={positionFilter}
            onChange={event => setPositionFilter(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-emerald-300"
          >
            <option value="all">Tất cả chức vụ</option>
            {positionOptions.map(position => (
              <option key={position} value={position}>
                {position}
              </option>
            ))}
          </select>
        </FilterSection>

        <FilterSection title="Nhóm lương">
          <select
            value={policyFilter}
            onChange={event => setPolicyFilter(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-emerald-300"
          >
            <option value="all">Tất cả nhóm lương</option>
            <option value="">Tự động theo thâm niên</option>
            {policies.map(policy => (
              <option key={policy.id} value={policy.id}>
                {policy.name}
              </option>
            ))}
          </select>
        </FilterSection>

        <FilterSection title="Nợ lương">
          <div className="flex gap-1.5">
            {[
              { value: 'all', label: 'Tất cả' },
              { value: 'hasDebt', label: 'Có' },
              { value: 'noDebt', label: 'Không' },
            ].map(option => (
              <button
                key={option.value}
                onClick={() => setDebtFilter(option.value as typeof debtFilter)}
                className={`flex-1 rounded-lg border py-1 text-xs transition-colors ${
                  debtFilter === option.value
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </FilterSection>
      </div>
    </div>
  );

  const staffSidebarPanel = (
    <aside className="w-64 shrink-0 h-full min-h-0 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 shrink-0">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-widest">Danh sách nhân sự</h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">Quản lý thông tin và hiệu suất nhân viên</p>
          </div>
          {hasActiveStaffFilters && (
            <button
              onClick={clearStaffFilters}
              className="text-2xs text-indigo-600 font-bold hover:underline shrink-0 ml-2"
            >
              Xóa lọc
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar overscroll-contain">
        <div className="px-4 py-3 border-b border-slate-100">
          <span className="text-xs font-bold text-slate-700 mb-2 block">Chức năng</span>
          <div className="space-y-1">
            {STAFF_NAV_ITEMS.map(item => {
              const Icon = item.icon;
              const isActive =
                (item.id === 'staff' && activeTab === 'list') ||
                (item.id === 'staff-ledger' && activeTab === 'ledger');
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectMainTab?.(item.id)}
                  className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-all ${
                    isActive
                      ? 'border-indigo-100 bg-indigo-50 text-indigo-700 font-semibold'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:text-slate-800'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-4 py-3 border-b border-slate-100">
          <span className="text-xs font-bold text-slate-700 mb-2 block">Lương & Thưởng</span>
          <div className="space-y-1">
            {PAYROLL_NAV_ITEMS.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectMainTab?.(item.id)}
                  className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-500 transition-all hover:border-indigo-300 hover:text-slate-800"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {activeTab === 'list' ? (
          <>
            <div className="px-4 py-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-700 mb-2 block">Trạng thái</span>
              <div className="space-y-1.5">
                {[
                  { value: 'active', label: 'Đang làm' },
                  { value: 'resigned', label: 'Đã nghỉ' },
                  { value: 'all', label: 'Tất cả' },
                ].map(option => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
                  >
                    <input
                      type="radio"
                      name="staffStatus"
                      checked={staffStatusFilter === option.value}
                      onChange={() =>
                        setStaffStatusFilter(option.value as typeof staffStatusFilter)
                      }
                      className="accent-indigo-600"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="px-4 py-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-700 mb-2 block">Chức vụ</span>
              <select
                value={positionFilter}
                onChange={event => setPositionFilter(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400"
              >
                <option value="all">Tất cả chức vụ</option>
                {positionOptions.map(position => (
                  <option key={position} value={position}>
                    {position}
                  </option>
                ))}
              </select>
            </div>

            <div className="px-4 py-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-700 mb-2 block">Nhóm lương</span>
              <select
                value={policyFilter}
                onChange={event => setPolicyFilter(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400"
              >
                <option value="all">Tất cả nhóm lương</option>
                <option value="">Tự động theo thâm niên</option>
                {policies.map(policy => (
                  <option key={policy.id} value={policy.id}>
                    {policy.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="px-4 py-3">
              <span className="text-xs font-bold text-slate-700 mb-2 block">Nợ lương</span>
              <div className="flex gap-1.5">
                {[
                  { value: 'all', label: 'Tất cả' },
                  { value: 'hasDebt', label: 'Có' },
                  { value: 'noDebt', label: 'Không' },
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => setDebtFilter(option.value as typeof debtFilter)}
                    className={`flex-1 rounded-lg border py-1 text-xs transition-colors ${
                      debtFilter === option.value
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="px-4 py-3 text-xs leading-5 text-slate-400">
            Trang này chưa có bộ lọc riêng.
          </div>
        )}
      </div>
    </aside>
  );

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const isFixedPosition =
      formData.position === 'Nhân viên thời vụ' || formData.position === 'Quản lý';
    if (isFixedPosition && !formData.assignedPolicyId) {
      showToast(`Vui lòng chọn Nhóm lương cố định cho chức vụ ${formData.position}!`, 'warning');
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
    setShowCreateModal(false);
  };

  const handleUpdateEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    const isFixedPosition =
      editingEmployee.position === 'Nhân viên thời vụ' || editingEmployee.position === 'Quản lý';
    if (isFixedPosition && !editingEmployee.assignedPolicyId) {
      showToast(
        `Chức vụ ${editingEmployee.position} bắt buộc phải gán một nhóm lương cụ thể.`,
        'warning'
      );
      return;
    }
    onUpdate(list.map(emp => (emp.id === editingEmployee.id ? editingEmployee : emp)));
    setEditingEmployee(null);
  };

  const CardField = ({ label, value, icon: Icon }: any) => (
    <div className="flex items-center text-xs">
      <div className="w-32 font-normal text-slate-400 uppercase tracking-[0.05em] flex items-center gap-2">
        {Icon && <Icon className="w-3.5 h-3.5 text-emerald-600" />}
        {label}
      </div>
      <div className="w-6 text-slate-300 font-normal">:</div>
      <div className="flex-1 font-normal text-slate-700 truncate tracking-tight">
        {value || 'N/A'}
      </div>
    </div>
  );

  const StaffCard: React.FC<{ emp: Employee }> = ({ emp }) => {
    const isResigned = isResignedStrict(emp);
    const seniorityDays = calculateSeniority(emp.joinDate);
    const { policy: currentPolicy } = determineCurrentPolicy(emp, policies, seniorityDays);
    const hasDebt = (emp.carryForwardDebt || 0) > 0;

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
            <h2 className="text-3xl font-semibold text-slate-900 uppercase tracking-tighter leading-tight mb-2">
              {emp.name}
            </h2>
            <div className="flex flex-col items-center gap-1.5">
              <div className="inline-block px-8 py-1.5 bg-emerald-600 text-white rounded-full text-2xs font-normal uppercase tracking-widest shadow-lg shadow-emerald-600/20">
                {emp.position}
              </div>
              <div className="text-xs font-normal text-emerald-700 uppercase tracking-wider">
                {currentPolicy?.name || 'Chưa xác định'}
              </div>
              {hasDebt && (
                <div className="mt-1 bg-amber-500 text-white px-3 py-0.5 rounded-full text-[8px] font-normal uppercase tracking-widest">
                  NỢ LƯƠNG: {(emp.carryForwardDebt || 0).toLocaleString()}đ
                </div>
              )}
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
            <span className="text-2xs font-normal text-emerald-400 tracking-[0.2em]">
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
            <div className="bg-rose-600 text-white px-10 py-5 rounded-[2.5rem] font-normal uppercase text-sm tracking-[0.4em] shadow-2xl rotate-[-12deg] border-4 border-white animate-pulse">
              NGỪNG HOẠT ĐỘNG
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={
        activeTab === 'list'
          ? 'h-full min-h-0 w-full animate-in fade-in duration-700'
          : 'flex h-full min-h-0 w-full gap-3 animate-in fade-in duration-700'
      }
    >
      {activeTab !== 'list' && (
        <aside className="w-64 shrink-0 h-full min-h-0 flex flex-col gap-4 overflow-y-auto custom-scrollbar overscroll-contain">
          {staffNavigationPanel}
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="px-4 min-h-[52px] border-b border-slate-100 flex items-center">
              <h3 className="line-clamp-2 text-sm font-medium leading-5 text-slate-700">Bộ lọc</h3>
            </div>
            <div className="p-4 text-xs leading-5 text-slate-400">
              Trang này chưa có bộ lọc riêng.
            </div>
          </div>
        </aside>
      )}

      {activeTab === 'performance' && (
        <div className="flex-1 min-w-0 min-h-0 overflow-auto custom-scrollbar space-y-10 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm animate-in slide-in-from-bottom-4 duration-700">
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
              <h3 className="text-xl font-semibold text-slate-900 mb-8 uppercase flex items-center gap-4">
                <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg">
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
              <h3 className="text-xl font-semibold text-slate-900 mb-8 uppercase flex items-center gap-4">
                <div className="p-3 bg-emerald-600 rounded-2xl text-white shadow-lg">
                  <Target className="w-5 h-5" />
                </div>{' '}
                THƯỚC ĐO HIỆU NĂNG CÁ NHÂN
              </h3>
              <div className="space-y-8 max-h-[400px] overflow-y-auto custom-scrollbar pr-4">
                {marketingPerf?.staffPerformance.map((perf: any) => (
                  <div key={perf.id} className="space-y-2 group/staff">
                    <div className="flex justify-between items-end">
                      <div>
                        <span className="text-sm font-normal text-slate-800 uppercase">
                          {perf.name}
                        </span>
                        <p className="text-2xs text-slate-400 font-normal">
                          Thực đạt: {formatNumber(perf.amount)}đ
                        </p>
                      </div>
                      <div className="text-right">
                        {perf.status === 'Elite' && (
                          <span className="px-3 py-1 bg-emerald-100 text-emerald-600 rounded-lg text-[9px] font-normal uppercase tracking-widest">
                            Elite Player
                          </span>
                        )}
                        {perf.status === 'Under' && (
                          <span className="px-3 py-1 bg-rose-100 text-rose-600 rounded-lg text-[9px] font-normal uppercase tracking-widest">
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
        <div className="flex-1 min-w-0 min-h-0 overflow-auto custom-scrollbar space-y-8 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm animate-in slide-in-from-bottom-4 duration-700">
          <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl overflow-hidden">
            <div className="flex items-center gap-5 mb-10 border-b border-slate-50 pb-8">
              <div className="p-4 bg-emerald-600 text-white rounded-[1.5rem] shadow-lg">
                <LayoutList className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-2xl font-semibold text-slate-900 uppercase tracking-tight">
                  Sổ Cái Hiệu Năng Nhân Sự
                </h3>
                <p className="text-2xs text-emerald-600 font-normal uppercase tracking-widest mt-1">
                  Lịch sử snapshot doanh số & thu nhập nhân sự theo tháng
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-2xs font-semibold text-slate-400 uppercase tracking-widest border-b border-slate-200">
                    <th className="px-8 py-5">Tháng</th>
                    <th className="px-8 py-5">Nhân viên</th>
                    <th className="px-8 py-5 text-right">Doanh số (Sales)</th>
                    <th className="px-8 py-5 text-right">Lương + ứng</th>
                    <th className="px-8 py-5 text-center">MIS ROI</th>
                    <th className="px-8 py-5 text-center">Rank</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums text-xs font-normal">
                  {performanceLedger.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-20 text-center opacity-40 uppercase text-xs font-normal tracking-widest text-slate-400 italic"
                      >
                        Chưa có bảng lương đã chốt để tính hiệu năng.
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
                              <span className="font-normal text-slate-900">#{pf.rank}</span>
                            </div>
                          ) : (
                            'N/A'
                          )}
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
        <div className="flex h-full min-h-0 w-full gap-4">
          <aside className="w-64 shrink-0 h-full min-h-0 flex flex-col gap-4">
            {staffNavigationPanel}
            {staffFilterPanel}
          </aside>
          <section className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="px-4 min-h-[52px] border-b border-slate-100 flex items-center gap-3 shrink-0">
              <div className="flex-1 relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm tên, SĐT, email, mã NV..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-emerald-400 focus:bg-white transition-all placeholder:text-slate-300"
                  value={staffSearch}
                  onChange={event => setStaffSearch(event.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden shrink-0">
                  <button
                    onClick={() => setStaffViewMode('table')}
                    className={`flex h-8 items-center justify-center px-3 text-2xs font-semibold uppercase transition-all ${
                      staffViewMode === 'table'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-white text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    Bảng
                  </button>
                  <button
                    onClick={() => setStaffViewMode('card')}
                    className={`flex h-8 items-center justify-center border-l border-slate-200 px-3 text-2xs font-semibold uppercase transition-all ${
                      staffViewMode === 'card'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-white text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    Thẻ
                  </button>
                </div>
                <button
                  onClick={() => {
                    resetForm();
                    setShowCreateModal(true);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl font-semibold text-2xs uppercase tracking-wide shadow-md shadow-emerald-200 hover:bg-emerald-700 transition-all"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Tạo mới
                </button>
              </div>
            </div>

            <div className="px-4 py-2 bg-slate-50/60 border-b border-slate-100 flex items-center gap-2 flex-wrap shrink-0">
              <span className="text-2xs font-bold text-slate-500">
                Hiển thị <span className="font-semibold text-slate-800">{filteredStaff.length}</span> /{' '}
                {list.length} nhân sự
              </span>
              {staffStatusFilter !== 'active' && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-semibold text-[9px]">
                  {staffStatusFilter === 'all' ? 'Tất cả trạng thái' : 'Đã nghỉ'}
                  <button onClick={() => setStaffStatusFilter('active')}>
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              )}
              {positionFilter !== 'all' && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-semibold text-[9px]">
                  {positionFilter}
                  <button onClick={() => setPositionFilter('all')}>
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              )}
              {policyFilter !== 'all' && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-semibold text-[9px]">
                  {policies.find(policy => policy.id === policyFilter)?.name ||
                    'Tự động theo thâm niên'}
                  <button onClick={() => setPolicyFilter('all')}>
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              )}
              {debtFilter !== 'all' && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-semibold text-[9px]">
                  {debtFilter === 'hasDebt' ? 'Có nợ lương' : 'Không nợ lương'}
                  <button onClick={() => setDebtFilter('all')}>
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              )}
              {staffSearch.trim() && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full font-semibold text-[9px]">
                  {staffSearch.trim()}
                  <button onClick={() => setStaffSearch('')}>
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              )}
            </div>
            <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
              {staffViewMode === 'card' ? (
                <div className="min-h-full bg-slate-50 p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 justify-items-center">
                    {filteredStaff.map(emp => (
                      <StaffCard key={emp.id} emp={emp} />
                    ))}
                    {filteredStaff.length === 0 && (
                      <div className="col-span-full w-full py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200 text-center">
                        <p className="text-sm font-normal text-slate-400 uppercase tracking-widest">
                          Không có nhân sự phù hợp bộ lọc
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="min-h-full bg-slate-50">
                  <table className="w-full text-left">
                    <thead className="sticky top-0 z-10 bg-slate-50">
                      <tr className="border-b border-slate-200 text-2xs font-semibold uppercase tracking-widest text-slate-400">
                        <th className="px-5 py-3">Nhân sự</th>
                        <th className="px-4 py-3">Chức vụ</th>
                        <th className="px-4 py-3">Nhóm lương</th>
                        <th className="px-4 py-3">Ngày vào</th>
                        <th className="px-4 py-3 text-right">Thâm niên</th>
                        <th className="px-4 py-3">Liên hệ</th>
                        <th className="px-4 py-3 text-center">Trạng thái</th>
                        <th className="px-5 py-3 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredStaff.length === 0 ? (
                        <tr>
                          <td
                            colSpan={8}
                            className="py-20 text-center text-xs font-normal uppercase tracking-widest text-slate-400"
                          >
                            Không có nhân sự phù hợp bộ lọc
                          </td>
                        </tr>
                      ) : (
                        filteredStaff.map(emp => {
                          const isResigned = isResignedStrict(emp);
                          const seniorityDays = calculateSeniority(emp.joinDate);
                          const { policy: currentPolicy } = determineCurrentPolicy(
                            emp,
                            policies,
                            seniorityDays
                          );
                          return (
                            <tr key={emp.id} className="transition-colors hover:bg-slate-50">
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-semibold">
                                    {emp.photoUrl ? (
                                      <img
                                        src={emp.photoUrl}
                                        alt={emp.name}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      emp.name.charAt(0).toUpperCase()
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-900">
                                      {emp.name}
                                    </p>
                                    <p className="text-2xs font-bold uppercase tracking-wide text-slate-400">
                                      {emp.id.slice(0, 8).toUpperCase()}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-xs font-bold text-slate-600">
                                {emp.position}
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-500">
                                {currentPolicy?.name || 'Tự động'}
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                                {emp.joinDate?.split('-').reverse().join('/') || 'N/A'}
                              </td>
                              <td className="px-4 py-3 text-right text-xs font-bold tabular-nums text-slate-700">
                                {seniorityDays} ngày
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-500">
                                <div className="max-w-[180px] truncate">
                                  {emp.phone || emp.email || 'N/A'}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-2xs font-semibold uppercase tracking-wide ${
                                    isResigned
                                      ? 'bg-rose-50 text-rose-600'
                                      : 'bg-emerald-50 text-emerald-600'
                                  }`}
                                >
                                  {isResigned ? 'Đã nghỉ' : 'Đang làm'}
                                </span>
                              </td>
                              <td className="px-5 py-3">
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => setEditingEmployee(emp)}
                                    className="rounded-lg border border-slate-200 p-2 text-slate-400 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600"
                                  >
                                    <Edit3 className="h-4 w-4" />
                                  </button>
                                  {!isResigned && (
                                    <button
                                      onClick={() => {
                                        if (confirm(`Xóa nhân sự ${emp.name}?`)) {
                                          onUpdate(
                                            list.filter(item => item.id !== emp.id),
                                            emp.id
                                          );
                                        }
                                      }}
                                      className="rounded-lg border border-slate-200 p-2 text-slate-400 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            onClick={() => setShowCreateModal(false)}
          ></div>
          <div className="relative bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[2rem] shadow-2xl p-8 no-scrollbar animate-in zoom-in-95 duration-300">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute right-6 top-6 rounded-xl bg-slate-100 p-2.5 text-slate-400 shadow-sm transition-all hover:bg-rose-50 hover:text-rose-500"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="mb-8 flex items-center gap-4 border-b border-slate-100 pb-6">
              <div className="rounded-2xl bg-emerald-600 p-3 text-white shadow-lg">
                <UserCircle2 className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-xl font-semibold uppercase tracking-tight text-slate-900">
                  Thêm nhân sự mới
                </h3>
                <p className="mt-1 text-2xs font-bold uppercase tracking-widest text-emerald-600">
                  Hồ sơ cơ bản và nhóm lương
                </p>
              </div>
            </div>

            <form onSubmit={handleAdd} className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <label className="ml-1 text-2xs font-normal uppercase text-slate-400">
                  Họ và tên
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="input-field border-none bg-slate-50 py-4 font-normal"
                  placeholder="Họ tên..."
                />
              </div>
              <div className="space-y-2">
                <label className="ml-1 text-2xs font-normal uppercase text-slate-400">
                  Chức vụ
                </label>
                <select
                  value={formData.position}
                  onChange={e => setFormData({ ...formData, position: e.target.value })}
                  className="input-field appearance-none border-none bg-slate-50 py-4 font-normal"
                >
                  <option value="Nhân viên">Nhân viên</option>
                  <option value="Quản lý">Quản lý</option>
                  <option value="Nhân viên thời vụ">Nhân viên thời vụ</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="ml-1 text-2xs font-normal uppercase text-slate-400">
                  Ngày vào làm
                </label>
                <input
                  type="date"
                  value={formData.joinDate}
                  onChange={e => setFormData({ ...formData, joinDate: e.target.value })}
                  className="input-field border-none bg-slate-50 py-4 font-normal"
                />
              </div>
              <div className="space-y-2">
                <label className="ml-1 text-2xs font-normal uppercase text-slate-400">
                  Gán nhóm lương
                </label>
                <select
                  value={formData.assignedPolicyId}
                  onChange={e => setFormData({ ...formData, assignedPolicyId: e.target.value })}
                  className="input-field appearance-none border-none bg-slate-50 py-4 font-normal"
                >
                  <option value="">Tự động theo thâm niên</option>
                  {policies.map(policy => (
                    <option key={policy.id} value={policy.id}>
                      {policy.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="ml-1 text-2xs font-normal uppercase text-slate-400">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="input-field border-none bg-slate-50 py-4 font-normal"
                  placeholder="email@company.com"
                />
              </div>
              <div className="space-y-2">
                <label className="ml-1 text-2xs font-normal uppercase text-slate-400">
                  Ngày sinh
                </label>
                <input
                  type="date"
                  value={formData.dob}
                  onChange={e => setFormData({ ...formData, dob: e.target.value })}
                  className="input-field border-none bg-slate-50 py-4 font-normal"
                />
              </div>
              <div className="md:col-span-2 flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-xs font-semibold uppercase text-slate-500 transition hover:bg-slate-50"
                >
                  Bỏ qua
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-xs font-semibold uppercase text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700"
                >
                  <Plus className="h-4 w-4" />
                  Thêm nhân sự
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingEmployee && (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
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
                className={`w-24 h-24 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white text-4xl font-normal shadow-xl overflow-hidden`}
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
                <h3 className="text-3xl font-semibold text-slate-900 uppercase tracking-tight">
                  {editingEmployee.name}
                </h3>
              </div>
            </div>
            <form onSubmit={handleUpdateEmployee} className="space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-8">
                  <div className="flex items-center gap-3 text-emerald-600">
                    <User className="w-5 h-5" />
                    <h4 className="text-xs font-semibold uppercase tracking-[0.2em]">
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
                    <h4 className="text-xs font-semibold uppercase tracking-[0.2em]">
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
                  className="bg-slate-900 hover:bg-black text-white px-12 py-5 rounded-2xl font-normal text-xs shadow-xl flex items-center gap-3 uppercase tracking-widest"
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
