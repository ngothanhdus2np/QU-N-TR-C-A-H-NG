import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  Package,
  Users,
  Gauge,
  Wallet,
  Activity,
} from 'lucide-react';
import type {
  AppData,
  ExpenseRecord,
  ExpenseCategory,
  DailyBreakEvenConfig,
  DashboardBreakEvenAnalysis,
  DiagnosisRange,
} from '../../types';

import ProductGroupManager from '../ProductGroupManager';
import AnalysisBusinessPage from './AnalysisBusinessPage';
import AnalysisFinancialMatrixPage from './AnalysisFinancialMatrixPage';
import AnalysisBusinessProfitPage from './AnalysisBusinessProfitPage';
import AnalysisGoodsOverviewPage from './AnalysisGoodsOverviewPage';
import AnalysisGoodsStockPage from './AnalysisGoodsStockPage';
import AnalysisCustomersOverviewPage from './AnalysisCustomersOverviewPage';
import AnalysisCustomersClassifyPage from './AnalysisCustomersClassifyPage';
import ExpenseOverviewPage from '../expense/ExpenseOverviewPage';
import ExpenseCategoriesPage from '../expense/ExpenseCategoriesPage';
import AnalysisEfficiencyPage from './AnalysisEfficiencyPage';
import AnalysisGoodsClassifyPage from './AnalysisGoodsClassifyPage';
import AnalysisStaffPage from './AnalysisStaffPage';

type SectionId = 'business' | 'goods' | 'customers' | 'staff' | 'efficiency' | 'expenses';

type SubItemId =
  | 'business-overview'
  | 'business-financial-matrix'
  | 'business-profit'
  | 'goods-overview'
  | 'goods-stock'
  | 'goods-classify'
  | 'goods-groups'
  | 'customers-overview'
  | 'customers-classify'
  | 'staff-performance'
  | 'efficiency-overview'
  | 'expense-overview'
  | 'expense-categories-page';

interface NavSection {
  id: SectionId;
  label: string;
  Icon: React.ElementType;
  items: { id: SubItemId; label: string }[];
}

const SECTIONS: NavSection[] = [
  {
    id: 'business',
    label: 'Kinh doanh',
    Icon: TrendingUp,
    items: [
      { id: 'business-overview', label: 'Tổng quan' },
      { id: 'business-financial-matrix', label: 'Ma trận tài chính' },
      { id: 'business-profit', label: 'Chi phí - Lợi nhuận' },
    ],
  },
  {
    id: 'goods',
    label: 'Hàng hóa',
    Icon: Package,
    items: [
      { id: 'goods-overview', label: 'Tổng quan' },
      { id: 'goods-stock', label: 'Tồn kho' },
      { id: 'goods-classify', label: 'Phân loại hàng hóa' },
      { id: 'goods-groups', label: 'Nhóm hàng' },
    ],
  },
  {
    id: 'customers',
    label: 'Khách hàng',
    Icon: Users,
    items: [
      { id: 'customers-overview', label: 'Tổng quan' },
      { id: 'customers-classify', label: 'Phân loại khách hàng' },
    ],
  },
  {
    id: 'staff',
    label: 'Nhân sự',
    Icon: Activity,
    items: [{ id: 'staff-performance', label: 'Hiệu năng nhân sự' }],
  },
  {
    id: 'expenses',
    label: 'Chi phí',
    Icon: Wallet,
    items: [
      { id: 'expense-overview', label: 'Tổng quát' },
      { id: 'expense-categories-page', label: 'Danh mục chi phí' },
    ],
  },
  {
    id: 'efficiency',
    label: 'Hiệu quả',
    Icon: Gauge,
    items: [{ id: 'efficiency-overview', label: 'Tổng quan' }],
  },
];

const SECTION_DEFAULT: Record<SectionId, SubItemId> = {
  business: 'business-overview',
  goods: 'goods-overview',
  customers: 'customers-overview',
  staff: 'staff-performance',
  expenses: 'expense-overview',
  efficiency: 'efficiency-overview',
};

const ACTIVE_ITEM_TITLES: Record<SubItemId, string> = {
  'business-overview': 'Phân tích kinh doanh tổng quan',
  'business-financial-matrix': 'Ma trận tài chính',
  'business-profit': 'Chi phí - Lợi nhuận',
  'goods-overview': 'Tổng quan hàng hóa',
  'goods-stock': 'Tồn kho',
  'goods-classify': 'Phân loại hàng hóa',
  'goods-groups': 'Nhóm hàng',
  'customers-overview': 'Tổng quan khách hàng',
  'customers-classify': 'Phân loại khách hàng',
  'staff-performance': 'Hiệu năng nhân sự',
  'efficiency-overview': 'Tổng quan hiệu quả',
  'expense-overview': 'Tổng quát chi phí',
  'expense-categories-page': 'Danh mục chi phí',
};

interface Props {
  data: AppData;
  initialSection: SectionId;
  onUpdate?: <K extends keyof AppData>(key: K, value: AppData[K]) => void;
  breakEvenAnalysis?: DashboardBreakEvenAnalysis;
  onUpdateData?: (key: 'dailyBreakEvenConfig', newList: DailyBreakEvenConfig) => void;
  diagnosisRange?: DiagnosisRange;
  setDiagnosisRange?: (range: DiagnosisRange) => void;
  diagStartDate?: string;
  setDiagStartDate?: (date: string) => void;
  diagEndDate?: string;
  setDiagEndDate?: (date: string) => void;
}

const Placeholder: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
    <div className="text-5xl">🚧</div>
    <p className="text-base font-medium text-slate-500">Đang xây dựng</p>
    <p className="text-sm">Tính năng này sẽ sớm ra mắt.</p>
  </div>
);

const AnalysisContainer: React.FC<Props> = ({
  data,
  initialSection,
  onUpdate,
  breakEvenAnalysis,
  onUpdateData,
  diagnosisRange,
  setDiagnosisRange,
  diagStartDate,
  setDiagStartDate,
  diagEndDate,
  setDiagEndDate,
}) => {
  const [activeItem, setActiveItem] = useState<SubItemId>(SECTION_DEFAULT[initialSection]);
  const [expandedSections, setExpandedSections] = useState<Set<SectionId>>(
    new Set([initialSection])
  );
  const [collapsed, setCollapsed] = useState(false);
  const activeTitle = ACTIVE_ITEM_TITLES[activeItem];

  const toggleSection = (id: SectionId) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderContent = () => {
    switch (activeItem) {
      case 'business-overview':
        return (
          <AnalysisBusinessPage
            data={data}
            breakEvenAnalysis={breakEvenAnalysis}
            onUpdateData={onUpdateData ?? (() => {})}
            diagnosisRange={diagnosisRange ?? 'thisMonth'}
            setDiagnosisRange={setDiagnosisRange ?? (() => {})}
            diagStartDate={diagStartDate ?? ''}
            setDiagStartDate={setDiagStartDate ?? (() => {})}
            diagEndDate={diagEndDate ?? ''}
            setDiagEndDate={setDiagEndDate ?? (() => {})}
          />
        );
      case 'business-financial-matrix':
        return <AnalysisFinancialMatrixPage data={data} />;
      case 'business-profit':
        return <AnalysisBusinessProfitPage data={data} />;
      case 'goods-overview':
        return <AnalysisGoodsOverviewPage data={data} />;
      case 'goods-stock':
        return <AnalysisGoodsStockPage data={data} />;
      case 'goods-classify':
        return <AnalysisGoodsClassifyPage data={data} />;
      case 'goods-groups':
        return (
          <ProductGroupManager
            productGroups={data.productGroups || []}
            products={data.posProducts || []}
            orders={data.posOrders || []}
            groupRevenue={data.productGroupRevenue || []}
            list={data.revenue || []}
            onUpdateGroups={list => onUpdate?.('productGroups', list)}
            onUpdateGroupRevenue={list => onUpdate?.('productGroupRevenue', list)}
            onUpdateRevenue={list => onUpdate?.('revenue', list)}
          />
        );
      case 'customers-overview':
        return <AnalysisCustomersOverviewPage data={data} />;
      case 'customers-classify':
        return <AnalysisCustomersClassifyPage data={data} />;
      case 'staff-performance':
        return <AnalysisStaffPage data={data} />;
      case 'expense-overview':
        return (
          <ExpenseOverviewPage
            list={data.expenses || []}
            categories={data.expenseCategories || []}
            revenueList={data.revenue || []}
            shopeeProductGroupRevenue={data.shopeeProductGroupRevenue || []}
            payrolls={data.payroll || []}
          />
        );
      case 'expense-categories-page':
        return (
          <ExpenseCategoriesPage
            list={data.expenses || []}
            categories={data.expenseCategories || []}
            revenueList={data.revenue || []}
            shopeeProductGroupRevenue={data.shopeeProductGroupRevenue || []}
            payrolls={data.payroll || []}
            onUpdate={(newList: ExpenseRecord[]) => onUpdate?.('expenses', newList)}
            onUpdateCategories={(newCats: ExpenseCategory[]) => onUpdate?.('expenseCategories', newCats)}
          />
        );
      case 'efficiency-overview':
        return <AnalysisEfficiencyPage data={data} />;
      default:
        return <Placeholder />;
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full gap-4">
      {!collapsed ? (
        <aside className="w-64 shrink-0 h-full min-h-0 flex flex-col">
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="flex min-h-[58px] items-center justify-between gap-3 border-b border-slate-100 px-4 shrink-0">
              <span className="line-clamp-2 text-sm font-semibold uppercase leading-5 text-slate-800">
                {activeTitle}
              </span>
              <button
                onClick={() => setCollapsed(true)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded-lg hover:bg-slate-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              {SECTIONS.map(section => {
                const isExpanded = expandedSections.has(section.id);
                const SIcon = section.Icon;
                return (
                  <div key={section.id}>
                    <button
                      onClick={() => toggleSection(section.id)}
                      className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50 transition-colors"
                    >
                      <SIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-sm text-slate-600 flex-1 text-left">
                        {section.label}
                      </span>
                      <ChevronDown
                        className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {isExpanded &&
                      section.items.map(item => {
                        const isActive = activeItem === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => setActiveItem(item.id)}
                            className={`w-full text-left pl-10 pr-4 py-[7px] text-sm transition-colors ${
                              isActive
                                ? 'bg-indigo-50 text-indigo-700 font-medium'
                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      ) : (
        <button
          onClick={() => setCollapsed(false)}
          className="w-10 shrink-0 rounded-2xl border border-slate-100 bg-white shadow-sm flex items-start pt-3 justify-center text-slate-400 hover:text-slate-600 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      <section className="flex-1 min-w-0 min-h-0 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {renderContent()}
      </section>
    </div>
  );
};

export default AnalysisContainer;
