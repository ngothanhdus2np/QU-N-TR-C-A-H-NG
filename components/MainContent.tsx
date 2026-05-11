
import React, { useTransition } from 'react';
import Dashboard from './Dashboard';
import ChatInterface from './ChatInterface';
import RevenueManager from './RevenueManager';
import ExpenseManager from './ExpenseManager';
import PayrollManager from './PayrollManager';
import StaffManager from './StaffManager';
import ProductGroupManager from './ProductGroupManager';
import KnowledgeManager from './KnowledgeManager';
import PromotionManager from './PromotionManager';
import MarketingManager from './marketing/MarketingManager';
import BrandManager from './marketing/BrandManager';
import POSComputer from './pos/POSComputer';
import GoodsInventory from './pos/GoodsInventory';
import OrderHistory from './pos/OrderHistory';
import CustomerPoints from './pos/CustomerPoints';
import SupplierManager from './pos/SupplierManager';
import { AppData, BrandProfile, ChatMessage, DiagnosisRange } from '../types';
import { CardSkeleton, TableSkeleton } from './ui/Skeleton';
import ErrorBoundary from './ui/ErrorBoundary';
import { processPlaceOrder, processReturnOrder } from '../services/posOrderService';

interface MainContentProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  data: AppData;
  brandProfile: BrandProfile;
  setBrandProfile: (profile: BrandProfile) => void;
  chatMessages: ChatMessage[];
  setChatMessages: (messages: ChatMessage[]) => void;
  showResigned: boolean;
  setShowResigned: (show: boolean) => void;
  diagnosisRange: DiagnosisRange;
  setDiagnosisRange: (range: DiagnosisRange) => void;
  diagStartDate: string;
  setDiagStartDate: (date: string) => void;
  diagEndDate: string;
  setDiagEndDate: (date: string) => void;
  suggestedFocusProducts: any;
  breakEvenAnalysis: any;
  updateData: (key: keyof AppData, newList: any, idToRemove?: string) => Promise<void>;
  updateSurgical: (updates: { key: keyof AppData, item: any, isDelete?: boolean }[]) => Promise<void>;
  pushBatch: (key: keyof AppData, items: any[]) => Promise<void>;
  offlinePendingCount?: number;
  isDraining?: boolean;
}

const MainContent: React.FC<MainContentProps> = ({
  activeTab,
  setActiveTab,
  data,
  brandProfile,
  setBrandProfile,
  chatMessages,
  setChatMessages,
  showResigned,
  setShowResigned,
  diagnosisRange,
  setDiagnosisRange,
  diagStartDate,
  setDiagStartDate,
  diagEndDate,
  setDiagEndDate,
  suggestedFocusProducts,
  breakEvenAnalysis,
  updateData,
  updateSurgical,
  pushBatch,
  offlinePendingCount,
  isDraining
}) => {
  const [isPending, startTransition] = useTransition();

  const handleSetActiveTab = (tab: string) => {
    startTransition(() => {
      setActiveTab(tab);
    });
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard 
            data={data} 
            breakEvenAnalysis={breakEvenAnalysis} 
            onUpdateData={updateData}
            diagnosisRange={diagnosisRange}
            setDiagnosisRange={setDiagnosisRange}
            diagStartDate={diagStartDate}
            setDiagStartDate={setDiagStartDate}
            diagEndDate={diagEndDate}
            setDiagEndDate={setDiagEndDate}
          />
        );
      case 'pos':
        return (
          <POSComputer
            products={data.posProducts || []}
            customers={data.posCustomers || []}
            orders={data.posOrders || []}
            brandProfile={brandProfile}
            currentStaffName={brandProfile?.name || 'Quản lý'}
            onGoToManagement={() => handleSetActiveTab('dashboard')}
            offlinePendingCount={offlinePendingCount}
            isDraining={isDraining}
            onAddCustomer={(customer) => {
              const updatedCustomers = [...(data.posCustomers || []), customer];
              updateData('posCustomers', updatedCustomers);
            }}
            onPlaceOrder={(order, updatedProducts, updatedCustomer) => {
              processPlaceOrder({ data, order, updatedProducts, updatedCustomer, pushBatch, updateSurgical });
            }}
            onReturnOrder={(returnOrder, updatedProducts, returnedItems, exchangeItems) => {
              processReturnOrder({ data, returnOrder, updatedProducts, returnedItems, exchangeItems, pushBatch, updateSurgical });
            }}
          />
        );
      case 'goods':
        return (
          <GoodsInventory 
            products={data.posProducts || []} 
            transactions={data.inventoryTransactions || []} 
            onUpdateProducts={(newList) => updateData('posProducts', newList)} 
            onUpdateSurgical={updateSurgical}
            onPushBatch={pushBatch}
            onAddTransaction={(t) => pushBatch('inventoryTransactions', [t])}
          />
        );
      case 'orders':
        return <OrderHistory orders={data.posOrders || []} storeName={brandProfile.name} />;
      case 'customers':
        return (
          <CustomerPoints
            customers={data.posCustomers || []}
            orders={data.posOrders || []}
            onUpdateCustomers={(newList) => updateData('posCustomers', newList)}
            onUpdateSurgical={updateSurgical}
          />
        );
      case 'suppliers':
        return (
          <SupplierManager
            suppliers={data.suppliers || []}
            supplierDebts={data.supplierDebts || []}
            onUpdateSuppliers={(newList) => updateData('suppliers', newList)}
            onUpdateSurgical={updateSurgical}
          />
        );
      case 'product-groups':
        return (
          <ProductGroupManager 
            productGroups={data.productGroups || []} 
            groupRevenue={data.productGroupRevenue || []} 
            onUpdateGroups={(newList) => updateData('productGroups', newList)} 
            onUpdateGroupRevenue={(newList) => updateData('productGroupRevenue', newList)} 
            list={data.revenue} 
            onUpdateRevenue={(newList) => updateData('revenue', newList)} 
          />
        );
      case 'store-revenue':
        return (
          <RevenueManager 
            list={data.revenue} 
            productGroups={data.productGroups || []} 
            groupRevenue={data.productGroupRevenue || []} 
            onUpdate={(newList, idToRem) => updateData('revenue', newList, idToRem)} 
            onUpdateSurgical={updateSurgical}
            onUpdateGroupRevenue={(newList) => updateData('productGroupRevenue', newList)} 
            onUpdateGroups={(newList) => updateData('productGroups', newList)} 
            diagnosisRange={diagnosisRange}
            setDiagnosisRange={setDiagnosisRange}
            diagStartDate={diagStartDate}
            setDiagStartDate={setDiagStartDate}
            diagEndDate={diagEndDate}
            setDiagEndDate={setDiagEndDate}
          />
        );
      case 'shopee-revenue':
        return (
          <RevenueManager 
            list={data.shopeeRevenue || []} 
            productGroups={data.productGroups || []} 
            groupRevenue={data.shopeeProductGroupRevenue || []} 
            shopeeSourceData={data.shopeeSourceData || []}
            shopeeCosts={data.shopeeCosts}
            shopeeInventoryIn={data.shopeeInventoryIn || []}
            shopeeInventoryOut={data.shopeeInventoryOut || []}
            dailyAdsConfig={data.dailyAdsConfig || {}}
            onUpdate={(newList, idToRem) => updateData('shopeeRevenue', newList, idToRem)} 
            onUpdateSurgical={updateSurgical}
            onUpdateGroupRevenue={(newList) => updateData('shopeeProductGroupRevenue', newList)} 
            onUpdateGroups={(newList) => updateData('productGroups', newList)} 
            onUpdateShopeeSource={(newList) => updateData('shopeeSourceData', newList)}
            onUpdateShopeeCosts={(newConfig) => updateData('shopeeCosts', newConfig)}
            onUpdateShopeeInventoryIn={(newList) => updateData('shopeeInventoryIn', newList)}
            onUpdateShopeeInventoryOut={(newList) => updateData('shopeeInventoryOut', newList)}
            onUpdateDailyAdsConfig={(newConfig) => updateData('dailyAdsConfig', newConfig)}
            isShopee={true}
            diagnosisRange={diagnosisRange}
            setDiagnosisRange={setDiagnosisRange}
            diagStartDate={diagStartDate}
            setDiagStartDate={setDiagStartDate}
            diagEndDate={diagEndDate}
            setDiagEndDate={setDiagEndDate}
          />
        );
      case 'expenses':
        return (
          <ExpenseManager 
            list={data.expenses} 
            categories={data.expenseCategories || []} 
            revenueList={data.revenue} 
            shopeeProductGroupRevenue={data.shopeeProductGroupRevenue || []}
            payrolls={data.payroll} 
            recurringExpenses={data.recurringExpenses || []}
            onUpdate={(newList, idToRem) => updateData('expenses', newList, idToRem)} 
            onUpdateSurgical={updateSurgical}
            onUpdateCategories={(newCats) => updateData('expenseCategories', newCats)} 
            onUpdateRecurringExpenses={(newList) => updateData('recurringExpenses', newList)}
            diagnosisRange={diagnosisRange}
            setDiagnosisRange={setDiagnosisRange}
            diagStartDate={diagStartDate}
            setDiagStartDate={setDiagStartDate}
            diagEndDate={diagEndDate}
            setDiagEndDate={setDiagEndDate}
          />
        );
      case 'promotions':
        return (
          <PromotionManager 
            promotions={data.promotions || []} 
            revenue={data.revenue} 
            expenses={data.expenses} 
            onUpdate={(newList, idToRem) => updateData('promotions', newList, idToRem)} 
          />
        );
      case 'marketing':
        return (
          <MarketingManager 
            brandProfile={brandProfile} 
            onUpdateBrand={setBrandProfile} 
            suggestedFocusProducts={suggestedFocusProducts} 
          />
        );
      case 'brand':
        return <BrandManager brandProfile={brandProfile} onUpdate={setBrandProfile} />;
      case 'staff':
        return (
          <StaffManager 
            list={data.employees} 
            policies={data.salaryPolicies} 
            allData={data} 
            onUpdate={(newList, idToRem) => updateData('employees', newList, idToRem)} 
            showResigned={showResigned} 
            setShowResigned={setShowResigned} 
            onUpdatePerformance={(newList) => updateData('staffPerformance', newList)} 
          />
        );
      case 'payroll':
        return (
          <PayrollManager 
            data={data} 
            onUpdateData={updateData} 
            onUpdateSurgical={updateSurgical} 
            showResigned={showResigned} 
            setShowResigned={setShowResigned} 
          />
        );
      case 'sop':
        return <KnowledgeManager data={data} onUpdateData={updateData} />;
      case 'chat':
        return (
          <ChatInterface 
            data={data} 
            messages={chatMessages} 
            setMessages={setChatMessages} 
            isCFOReady={true} 
          />
        );
      default:
        return null;
    }
  };

  const content = renderContent();
  
  return (
    <div className="h-full">
      {isPending ? (
        <div className="space-y-8 pt-4">
          <CardSkeleton />
          <TableSkeleton />
        </div>
      ) : (
        <ErrorBoundary key={activeTab} moduleName={activeTab}>
          <div className={activeTab === 'pos' ? 'h-full' : activeTab === 'dashboard' ? '' : 'pt-4 md:pt-8'}>
            {content}
          </div>
        </ErrorBoundary>
      )}
    </div>
  );
};

export default MainContent;
