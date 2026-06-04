import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TopNav from './components/TopNav';
import MainContent from './components/MainContent';
import FloatingCFOChat from './components/FloatingCFOChat';
import OfflineIndicator from './components/OfflineIndicator';
import { useAppData } from './hooks/useAppData';
import { useTheme } from './hooks/useTheme';
import { SIDEBAR_SECTIONS } from './constants/navigation';
import { registerServiceWorker } from './registerServiceWorker';
import type { AppAlert } from './types';

const App: React.FC = () => {
  // Register Service Worker — chỉ bật trong production
  // Dev mode: service worker cache hàng trăm Vite module → block browser thread → trang treo
  useEffect(() => {
    if (import.meta.env.PROD) {
      registerServiceWorker({
        onSuccess: () => {
          console.log('✅ PWA ready to work offline!');
        },
        onUpdate: () => {
          console.log('🔄 New version available!');
        },
        onOffline: () => {
          console.log('📴 Working offline');
        },
        onOnline: () => {
          console.log('🌐 Back online, syncing data...');
        },
      });
    }
  }, []);
  const {
    data,
    activeTab,
    setActiveTab,
    brandProfile,
    setBrandProfile,
    chatMessages,
    setChatMessages,
    isSyncing,
    isCloudConnected,
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
    fetchData,
    silentSync,
    updateData,
    updateSurgical,
    pushBatch,
    syncErrors,
    lastSyncTime,
    pendingCount,
    offlinePendingCount,
    offlineOrderPendingCount,
    drainQueue,
    isDraining,
  } = useAppData();

  const { themeId, setThemeId } = useTheme();
  const [alerts, setAlerts] = useState<AppAlert[]>([]);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts');
      if (res.ok) setAlerts(await res.json());
    } catch {
      /* non-critical */
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    // Re-check every 10 minutes
    const id = setInterval(fetchAlerts, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchAlerts]);

  // Dùng ref để listener không bị add/remove mỗi khi silentSync đổi reference
  const silentSyncRef = React.useRef(silentSync);
  useEffect(() => { silentSyncRef.current = silentSync; });
  useEffect(() => {
    const handleOnline = () => silentSyncRef.current();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key) - 1;
        const allItems = SIDEBAR_SECTIONS.flatMap(s => s.items);
        if (allItems[index]) {
          setActiveTab(allItems[index].id);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTab]);

  const isFixedViewportTab =
    activeTab === 'staff' ||
    activeTab === 'staff-ledger' ||
    activeTab === 'payroll' ||
    activeTab.startsWith('payroll-') ||
    activeTab === 'shopee-revenue' ||
    activeTab === 'delivery-partners' ||
    activeTab === 'shipping-orders';

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      <OfflineIndicator />
      <AnimatePresence initial={false}>
        {activeTab !== 'pos' && (
          <motion.div
            key="top-nav"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.12 }}
            className="shrink-0"
          >
            <TopNav
              sections={SIDEBAR_SECTIONS}
              activeId={activeTab}
              onSelect={(id: string) => setActiveTab(id)}
              isCloudConnected={isCloudConnected}
              isSyncing={isSyncing || isDraining}
              syncErrors={syncErrors}
              lastSyncTime={lastSyncTime}
              onRefresh={() => fetchData(true)}
              onImportRefresh={() => fetchData(false, true)}
              alerts={alerts}
              pendingCount={pendingCount}
              offlinePendingCount={offlinePendingCount}
              onDrainOfflineQueue={drainQueue}
              activeThemeId={themeId}
              onThemeChange={setThemeId}
              brandProfile={brandProfile}
              onUpdateBrand={setBrandProfile}
              products={data.posProducts || []}
              paymentSettings={data.posPaymentSettings}
              onUpdatePaymentSettings={settings => updateData('posPaymentSettings', settings)}
              inventorySettings={data.posInventorySettings}
              onUpdateInventorySettings={settings => updateData('posInventorySettings', settings)}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <main
        className={`relative z-0 ${
          activeTab === 'pos' || isFixedViewportTab
            ? 'flex-1 flex flex-col overflow-hidden min-h-0 px-4 md:px-8'
            : 'flex-1 overflow-y-auto no-scrollbar px-4 md:px-8'
        }`}
        style={
          activeTab === 'pos' || isFixedViewportTab
            ? {
                flex: '1 1 0',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                minHeight: 0,
              }
            : { flex: '1 1 0', overflowY: 'auto' }
        }
      >
        <MainContent
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          data={data}
          brandProfile={brandProfile}
          setBrandProfile={setBrandProfile}
          showResigned={showResigned}
          setShowResigned={setShowResigned}
          diagnosisRange={diagnosisRange}
          setDiagnosisRange={setDiagnosisRange}
          diagStartDate={diagStartDate}
          setDiagStartDate={setDiagStartDate}
          diagEndDate={diagEndDate}
          setDiagEndDate={setDiagEndDate}
          suggestedFocusProducts={suggestedFocusProducts}
          breakEvenAnalysis={breakEvenAnalysis}
          updateData={updateData}
          updateSurgical={updateSurgical}
          pushBatch={pushBatch}
          offlinePendingCount={offlinePendingCount}
          offlineOrderPendingCount={offlineOrderPendingCount}
          isDraining={isDraining}
          onDrainOfflineQueue={drainQueue}
        />
      </main>
      <FloatingCFOChat data={data} messages={chatMessages} setMessages={setChatMessages} />
    </div>
  );
};

export default App;
