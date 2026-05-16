import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TopNav from './components/TopNav';
import MainContent from './components/MainContent';
import OfflineIndicator from './components/OfflineIndicator';
import DevQRCode from './components/DevQRCode';
import { useAppData } from './hooks/useAppData';
import { useTheme } from './hooks/useTheme';
import { SIDEBAR_SECTIONS } from './constants/navigation';
import { registerServiceWorker } from './registerServiceWorker';
import type { AppAlert } from './types';

const App: React.FC = () => {
  // Register Service Worker
  useEffect(() => {
    registerServiceWorker({
      onSuccess: registration => {
        console.log('✅ PWA ready to work offline!');
      },
      onUpdate: registration => {
        console.log('🔄 New version available!');
      },
      onOffline: () => {
        console.log('📴 Working offline');
      },
      onOnline: () => {
        console.log('🌐 Back online, syncing data...');
      },
    });
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

  useEffect(() => {
    const handleOnline = () => silentSync();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [silentSync]);

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

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      <OfflineIndicator />
      <DevQRCode />
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
        className={`flex-1 overflow-y-auto no-scrollbar relative transition-[padding] duration-150 ${activeTab === 'pos' ? 'p-0' : 'pb-8 px-4 md:px-8'}`}
      >
        <MainContent
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          data={data}
          brandProfile={brandProfile}
          setBrandProfile={setBrandProfile}
          chatMessages={chatMessages}
          setChatMessages={setChatMessages}
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
          isDraining={isDraining}
        />
      </main>
    </div>
  );
};

export default App;
