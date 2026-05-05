
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import { useAppData } from './hooks/useAppData';
import { SIDEBAR_SECTIONS } from './constants/navigation';

const App: React.FC = () => {
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
    updateData,
    updateSurgical,
    pushBatch,
    syncErrors,
    lastSyncTime
  } = useAppData();

  const getActiveTitle = () => {
    const allItems = SIDEBAR_SECTIONS.flatMap(s => s.items);
    const activeItem = allItems.find(i => i.id === activeTab);
    return activeItem ? activeItem.label : '';
  };

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
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {activeTab !== 'pos' && (
        <Sidebar 
          sections={SIDEBAR_SECTIONS} 
          activeId={activeTab} 
          onSelect={(id: any) => setActiveTab(id)} 
          isCloudConnected={isCloudConnected} 
          isSyncing={isSyncing} 
          onRefresh={() => fetchData(true)} 
          brandLogo={brandProfile.logo}
        />
      )}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {activeTab !== 'pos' && (
          <Header 
            activeTitle={getActiveTitle()} 
            syncErrors={syncErrors} 
            isSyncing={isSyncing} 
            isCloudConnected={isCloudConnected} 
            lastSyncTime={lastSyncTime} 
            onRefresh={() => fetchData(true)}
          />
        )}
        <main className={`flex-1 overflow-y-auto no-scrollbar ${activeTab === 'pos' ? 'p-0' : 'pb-8 px-4 md:px-8'}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="h-full"
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
              />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default App;
