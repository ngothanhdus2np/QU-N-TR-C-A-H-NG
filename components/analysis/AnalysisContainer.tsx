import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  Package,
  Users,
  Gauge,
} from 'lucide-react';
import type { AppData } from '../../types';
import ProductGroupManager from '../ProductGroupManager';
import AnalysisBusinessPage from './AnalysisBusinessPage';
import AnalysisBusinessProfitPage from './AnalysisBusinessProfitPage';
import AnalysisGoodsOverviewPage from './AnalysisGoodsOverviewPage';
import AnalysisGoodsStockPage from './AnalysisGoodsStockPage';
import AnalysisCustomersOverviewPage from './AnalysisCustomersOverviewPage';
import AnalysisCustomersClassifyPage from './AnalysisCustomersClassifyPage';

type SectionId = 'business' | 'goods' | 'customers' | 'efficiency';

type SubItemId =
  | 'business-overview'
  | 'business-profit'
  | 'goods-overview'
  | 'goods-stock'
  | 'goods-classify'
  | 'goods-groups'
  | 'customers-overview'
  | 'customers-classify'
  | 'efficiency-overview';

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
  efficiency: 'efficiency-overview',
};

interface Props {
  data: AppData;
  initialSection: SectionId;
  onUpdate?: <K extends keyof AppData>(key: K, value: AppData[K]) => void;
}

const Placeholder: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
    <div className="text-5xl">🚧</div>
    <p className="text-base font-medium text-slate-500">Đang xây dựng</p>
    <p className="text-sm">Tính năng này sẽ sớm ra mắt.</p>
  </div>
);

const AnalysisContainer: React.FC<Props> = ({ data, initialSection, onUpdate }) => {
  const [activeItem, setActiveItem] = useState<SubItemId>(SECTION_DEFAULT[initialSection]);
  const [expandedSections, setExpandedSections] = useState<Set<SectionId>>(
    new Set([initialSection])
  );
  const [collapsed, setCollapsed] = useState(false);

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
        return <AnalysisBusinessPage data={data} />;
      case 'business-profit':
        return <AnalysisBusinessProfitPage data={data} />;
      case 'goods-overview':
        return <AnalysisGoodsOverviewPage data={data} />;
      case 'goods-stock':
        return <AnalysisGoodsStockPage data={data} />;
      case 'goods-groups':
        return (
          <ProductGroupManager
            productGroups={data.productGroups || []}
            products={data.posProducts || []}
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
      default:
        return <Placeholder />;
    }
  };

  return (
    <div className="flex h-full min-h-0 bg-slate-50">
      {/* Sidebar */}
      {!collapsed ? (
        <div className="w-[200px] shrink-0 bg-white border-r border-slate-100 flex flex-col">
          <div className="flex items-center justify-between px-4 h-11 border-b border-slate-100 shrink-0">
            <span className="text-sm font-medium text-slate-700">Phân tích</span>
            <button
              onClick={() => setCollapsed(true)}
              className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-1">
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
                    <span className="text-[13px] text-slate-600 flex-1 text-left">
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
                          className={`w-full text-left pl-10 pr-4 py-[7px] text-[13px] transition-colors ${
                            isActive
                              ? 'bg-blue-50 text-blue-600 font-medium'
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
      ) : (
        <button
          onClick={() => setCollapsed(false)}
          className="w-8 shrink-0 bg-white border-r border-slate-100 flex items-start pt-3 justify-center text-slate-400 hover:text-slate-600 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0 overflow-hidden">{renderContent()}</div>
    </div>
  );
};

export default AnalysisContainer;
