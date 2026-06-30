import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import TopNav from './components/TopNav';
import MainContent from './components/MainContent';
import FloatingCFOChat from './components/FloatingCFOChat';
import { BotProgressBar } from './components/shared/BotProgressBar';
import OfflineIndicator from './components/OfflineIndicator';
import AuthGate from './components/AuthGate';
import { useAppData } from './hooks/useAppData';
import { useRealtimeSync } from './hooks/useRealtimeSync';
import { useTheme } from './hooks/useTheme';
import { SIDEBAR_SECTIONS } from './constants/navigation';
import { registerServiceWorker } from './registerServiceWorker';
import { getCurrentSession, signOut } from './services/auth';
import { supabase } from './services/supabase';
import { INVENTORY_COST_METHOD_STORAGE_KEY } from './src/lib/businessLogic.inventory';
import type { AppAlert } from './types';

const SettingsCenter = lazy(() => import('./components/settings/SettingsCenter'));

// Tự động thêm Supabase Bearer token cho request API cùng origin.
// Không dùng VITE_INTERNAL_API_KEY ở client vì biến VITE_* nằm trong bundle public.
const _nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : String(input));
  if (url.startsWith('/api')) {
    const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined));
    if (!headers.has('Authorization')) {
      const session = await getCurrentSession().catch(() => null);
      if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);
    }
    return _nativeFetch(input, { ...init, headers });
  }
  return _nativeFetch(input, init);
};

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
    applyRevenueDelta,
    mergeRemoteUpdate,
    loadInventoryOut,
    pushBatch,
    syncErrors,
    lastSyncTime,
    pendingCount,
    offlinePendingCount,
    offlineOrderPendingCount,
    drainQueue,
    isDraining,
    isDataReady,
  } = useAppData();

  useRealtimeSync(mergeRemoteUpdate);

  const { themeId, setThemeId } = useTheme();
  const [alerts, setAlerts] = useState<AppAlert[]>([]);
  const [userRole, setUserRole] = useState<string>('owner');
  const [managerUnlocked, setManagerUnlocked] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // activeTab dẫn xuất trực tiếp từ URL — không cần state riêng
  const rawPath = location.pathname.replace(/^\//, '').trim();
  const activeTab = rawPath === 'dashboard' ? 'overview' : (rawPath || 'pos');

  // Đọc role từ session Supabase
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const meta = session?.user?.user_metadata || {};
      setUserRole(meta.role || 'owner');
    });
  }, []);

  // Thu ngân: nếu không phải /pos và chưa được unlock → redirect về /pos
  useEffect(() => {
    if (userRole === 'cashier' && !managerUnlocked && activeTab !== 'pos') {
      navigate('/pos', { replace: true });
    }
    // Khi vào /pos → reset unlock
    if (activeTab === 'pos') {
      setManagerUnlocked(false);
    }
  }, [userRole, activeTab, managerUnlocked, navigate]);

  // Chỉ gọi navigate — URL là nguồn sự thật duy nhất
  const handleSetActiveTab = useCallback((id: string) => {
    const normalized = id === 'dashboard' ? 'overview' : id;
    if (userRole === 'cashier' && !managerUnlocked && normalized !== 'pos') return;
    navigate(`/${normalized}`);
  }, [navigate, userRole, managerUnlocked]);

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

  // AUDIT-002: Sync costMethod từ Supabase xuống localStorage ngay khi data load.
  // Đảm bảo getInventoryCostMethod() fallback đúng khi posInventorySettings chưa được propagate.
  useEffect(() => {
    const cm = data.posInventorySettings?.costMethod;
    if (cm === 'fixed' || cm === 'average') {
      localStorage.setItem(INVENTORY_COST_METHOD_STORAGE_KEY, cm);
    }
  }, [data.posInventorySettings?.costMethod]);

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
          handleSetActiveTab(allItems[index].id);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSetActiveTab]);

  const isSettingsTab = activeTab === 'settings';

  const isFixedViewportTab =
    activeTab === 'staff' ||
    activeTab === 'staff-ledger' ||
    activeTab === 'payroll' ||
    activeTab.startsWith('payroll-') ||
    activeTab === 'shopee-revenue' ||
    activeTab === 'delivery-partners' ||
    activeTab === 'shipping-orders';

  return (
    <AuthGate>
    <div className="flex flex-col h-screen overflow-hidden" style={{ backgroundColor: 'var(--app-bg)' }}>
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
              sections={SIDEBAR_SECTIONS.filter(s => {
                if (!('hidden' in s && s.hidden)) return true;
                // Chỉ ẩn trên production (app.phucsang.com.vn), hiện trên localhost
                return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
              })}
              activeId={activeTab}
              onSelect={(id: string) => handleSetActiveTab(id)}
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
              onSignOut={() => signOut()}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <main
        className={`relative ${
          activeTab === 'pos' || isFixedViewportTab
            ? 'flex-1 flex flex-col overflow-hidden min-h-0 px-4 md:px-8'
            : isSettingsTab
              ? 'flex-1 flex flex-col overflow-hidden min-h-0'
              : 'flex-1 overflow-y-auto no-scrollbar px-4 md:px-8'
        }`}
        style={
          activeTab === 'pos' || isFixedViewportTab || isSettingsTab
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
        {isSettingsTab ? (
          <Suspense fallback={null}>
            <SettingsCenter
              onNavigate={handleSetActiveTab}
              activeThemeId={themeId}
              onThemeChange={setThemeId}
              isCloudConnected={isCloudConnected}
              isSyncing={isSyncing || isDraining}
              syncErrors={syncErrors}
              lastSyncTime={lastSyncTime}
              pendingCount={pendingCount}
              offlinePendingCount={offlinePendingCount}
              onRefresh={() => fetchData(true)}
              onImportRefresh={() => fetchData(false, true)}
              onDrainOfflineQueue={drainQueue}
              brandProfile={brandProfile}
              onUpdateBrand={setBrandProfile}
              products={data.posProducts || []}
              paymentSettings={data.posPaymentSettings}
              onUpdatePaymentSettings={settings => updateData('posPaymentSettings', settings)}
              inventorySettings={data.posInventorySettings}
              onUpdateInventorySettings={settings => updateData('posInventorySettings', settings)}
            />
          </Suspense>
        ) : (
          <MainContent
            activeTab={activeTab}
            setActiveTab={handleSetActiveTab}
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
            isSyncing={isSyncing}
            updateData={updateData}
            updateSurgical={updateSurgical}
            applyRevenueDelta={applyRevenueDelta}
            pushBatch={pushBatch}
            loadInventoryOut={loadInventoryOut}
            offlinePendingCount={offlinePendingCount}
            offlineOrderPendingCount={offlineOrderPendingCount}
            isDraining={isDraining}
            onDrainOfflineQueue={drainQueue}
            isDataReady={isDataReady}
            onRefreshData={() => fetchData(true)}
            userRole={userRole}
            activeThemeId={themeId}
            onThemeChange={setThemeId}
            onManagerUnlocked={() => {
              setManagerUnlocked(true);
              navigate('/overview');
            }}
          />
        )}
      </main>
      <BotProgressBar />
      <FloatingCFOChat data={data} messages={chatMessages} setMessages={setChatMessages} />
    </div>
    </AuthGate>
  );
};

export default App;
