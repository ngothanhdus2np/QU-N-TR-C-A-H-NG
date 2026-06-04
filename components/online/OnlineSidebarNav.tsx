import React from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Bike,
  ClipboardList,
  Database,
  FileText,
  Settings,
  ShoppingCart,
} from 'lucide-react';
import type { RevenueSubTab } from '../../types';

interface Props {
  activeTab: string;
  activeShopeeSubTab?: RevenueSubTab;
  onSelectMainTab: (tab: string) => void;
  onSelectShopeeSubTab?: (tab: RevenueSubTab) => void;
}

const shopeeItems: { id: RevenueSubTab; label: string; icon: React.ElementType; desc: string }[] = [
  { id: 'source', label: 'Dữ liệu nguồn', icon: Database, desc: 'Dữ liệu đơn hàng thô từ Shopee' },
  { id: 'costs', label: 'Chi phí', icon: Settings, desc: 'Định phí, biến phí theo từng đơn hàng' },
  { id: 'inventory_in', label: 'Nhập kho', icon: ArrowDownToLine, desc: 'Theo dõi hàng nhập về kho Shopee' },
  { id: 'inventory_out', label: 'Xuất kho', icon: ArrowUpFromLine, desc: 'Đơn đã xuất — doanh thu & phí thực tế' },
  { id: 'report', label: 'Báo cáo', icon: ClipboardList, desc: 'Tổng hợp lợi nhuận theo kỳ' },
];

const mainItems = [
  { id: 'shopee-revenue', label: 'Doanh Thu Shopee', icon: ShoppingCart },
  { id: 'delivery-partners', label: 'Đối tác giao hàng', icon: Bike },
  { id: 'shipping-orders', label: 'Vận đơn', icon: FileText },
];

export default function OnlineSidebarNav({
  activeTab,
  activeShopeeSubTab,
  onSelectMainTab,
  onSelectShopeeSubTab,
}: Props) {
  const activeMainItem = mainItems.find(item => item.id === activeTab) ?? mainItems[0];
  const activeShopeeItem = shopeeItems.find(item => item.id === activeShopeeSubTab);
  const activeHeaderItem =
    activeTab === 'shopee-revenue' && activeShopeeItem ? activeShopeeItem : activeMainItem;
  const ActiveIcon = activeHeaderItem.icon;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex min-h-[61px] items-center gap-2 border-b border-slate-200 px-4 py-3">
        <ActiveIcon className="h-4 w-4 text-slate-500" />
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase text-slate-900">{activeHeaderItem.label}</p>
          <p className="text-xs text-slate-500">
            {activeTab === 'shopee-revenue' && activeShopeeItem ? activeShopeeItem.desc : 'Online'}
          </p>
        </div>
      </div>
      <div className="space-y-1 p-3">
        {mainItems.map(item => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <div key={item.id}>
              <button
                onClick={() => onSelectMainTab(item.id)}
                className={`flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm font-normal transition-colors ${
                  active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="min-w-0 truncate">{item.label}</span>
              </button>
              {item.id === 'shopee-revenue' && active && onSelectShopeeSubTab && (
                <div className="ml-4 mt-1 space-y-1 border-l border-slate-200 pl-2">
                  {shopeeItems.map(subItem => {
                    const SubIcon = subItem.icon;
                    const subActive = activeShopeeSubTab === subItem.id;
                    return (
                      <button
                        key={subItem.id}
                        onClick={() => onSelectShopeeSubTab(subItem.id)}
                        className={`flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs font-normal transition-colors ${
                          subActive
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                        }`}
                      >
                        <SubIcon className="h-3.5 w-3.5" />
                        <span className="min-w-0 truncate">{subItem.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
