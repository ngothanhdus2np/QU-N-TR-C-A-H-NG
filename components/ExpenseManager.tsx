
import React, { useState, useEffect, useRef } from 'react';
import { ExpenseRecord, ExpenseCategory, RevenueRecord, PayrollRecord, RecurringExpense, ProductGroupRevenue, DiagnosisRange, AppDataSurgicalUpdate } from '../types';
import TimeFilter from './TimeFilter';
import { ExpenseTabs } from './expense/ExpenseTabs';
import { useExpenseRecurring } from './expense/useExpenseRecurring';
import { ExpenseRecurringTab } from './expense/ExpenseRecurringTab';
import { useExpenseAnalytics } from './expense/useExpenseAnalytics';
import { ExpenseLedgerTab } from './expense/ExpenseLedgerTab';
import { useToast } from './ui/Toast';

interface Props {
  list: ExpenseRecord[];
  categories: ExpenseCategory[];
  revenueList: RevenueRecord[];
  shopeeProductGroupRevenue?: ProductGroupRevenue[];
  payrolls: PayrollRecord[];
  recurringExpenses: RecurringExpense[];
  onUpdate: (newList: ExpenseRecord[], idToRemove?: string) => void;
  onUpdateSurgical?: (updates: AppDataSurgicalUpdate[]) => Promise<void>;
  onUpdateCategories: (newCats: ExpenseCategory[]) => void;
  onUpdateRecurringExpenses: (newList: RecurringExpense[]) => void;
  diagnosisRange: DiagnosisRange;
  setDiagnosisRange: (range: DiagnosisRange) => void;
  diagStartDate: string;
  setDiagStartDate: (date: string) => void;
  diagEndDate: string;
  setDiagEndDate: (date: string) => void;
}

const ExpenseManager: React.FC<Props> = ({ 
  list, categories, revenueList, shopeeProductGroupRevenue = [], payrolls, recurringExpenses = [], 
  onUpdate, onUpdateSurgical, onUpdateCategories, onUpdateRecurringExpenses,
  diagnosisRange,
  setDiagnosisRange,
  diagStartDate,
  setDiagStartDate,
  diagEndDate,
  setDiagEndDate
}) => {
  const { showToast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState<'ledger' | 'recurring'>('ledger');

  const localTodayStr = new Date().toLocaleDateString('sv-SE');

  // AI Analysis States
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{ 
    level1Id: string, 
    level2Name: string, 
    level3Name: string,
    level1Name: string
  } | null>(null);

  const [formData, setFormData] = useState({
    date: localTodayStr,
    category: '', 
    amount: '',
    description: ''
  });

  const {
    recurringForm,
    setRecurringForm,
    pendingRecurring,
    handlePostRecurring,
    handleAddRecurring,
    handleRemoveRecurring,
    toggleRecurringActive
  } = useExpenseRecurring({ list, recurringExpenses, onUpdate, onUpdateSurgical, onUpdateRecurringExpenses });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    parentCategories,
    timeContext,
    processedList,
  } = useExpenseAnalytics({
    list,
    categories,
    revenueList,
    shopeeProductGroupRevenue,
    payrolls,
    diagnosisRange,
    diagStartDate,
    diagEndDate
  });

  const formatNumber = (num: number) => Math.round(num || 0).toLocaleString('vi-VN');

  // Initial Default Category
  useEffect(() => {
    if (!formData.category && categories.length > 0) {
      const firstChild = categories.find(c => !!c.parentId);
      const initialCat = firstChild ? firstChild.name : (categories[0]?.name || '');
      setFormData(prev => ({ ...prev, category: initialCat }));
    }
  }, [categories]);

  // AI Logic: Manual trigger handled by button
  const triggerAIAnalysis = () => {
    if (formData.description.trim().length >= 5) {
      handleAIDescriptionAnalysis();
    } else {
      showToast("Vui lòng nhập mô tả chi tiết hơn (tối thiểu 5 ký tự) để AI phân tích.", 'warning');
    }
  };

  const handleAIDescriptionAnalysis = async () => {
    if (parentCategories.length === 0) return;
    setIsAnalyzing(true);
    try {
      const contextData = `
        NHIỆM VỤ: Phân tích mô tả chi phí và phân loại vào hệ thống MIS 3 cấp.
        MÔ TẢ CHI PHÍ: "${formData.description}"

        CẤU TRÚC 3 CẤP:
        Cấp 1: Cố định (Fixed) hoặc Biến đổi (Variable).
        Cấp 2: Nhóm chi phí (Ví dụ: Nhân sự, Mặt bằng, Marketing, Điện nước...).
        Cấp 3: Tiểu mục chi tiết (Ví dụ: Lương cơ bản, Tiền thuê nhà, FB Ads, Tiền điện...).

        DANH SÁCH CẤP 1 HIỆN TẠI:
        ${parentCategories.map(p => `- ID: ${p.id}, Tên: ${p.name}`).join('\n')}

        Trả về JSON: {"level1Id":"ID_CẤP_1","level1Name":"Tên Cấp 1","level2Name":"Tên Nhóm Cấp 2","level3Name":"Tên Tiểu Mục Cấp 3"}
      `;
      const response = await fetch('/api/ai/expense-classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextData }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'AI service error');
      const result = JSON.parse(data.result || "null");
      if (result && result.level1Id && result.level2Name && result.level3Name) {
        setAiSuggestion(result);
      }
    } catch (error) {
      console.error("AI Analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applyAISuggestion = () => {
    if (!aiSuggestion) return;
    
    const newCategories = [...categories];
    let level2Id = '';
    let level3Id = '';

    // Find or create Level 2
    const existingL2 = categories.find(c => c.name === aiSuggestion.level2Name && c.parentId === aiSuggestion.level1Id);
    if (existingL2) {
      level2Id = existingL2.id;
    } else {
      level2Id = `cat-l2-${Date.now()}`;
      newCategories.push({ id: level2Id, name: aiSuggestion.level2Name, parentId: aiSuggestion.level1Id });
    }

    // Find or create Level 3
    const existingL3 = categories.find(c => c.name === aiSuggestion.level3Name && c.parentId === level2Id);
    if (existingL3) {
      level3Id = existingL3.id;
    } else {
      level3Id = `cat-l3-${Date.now() + 1}`;
      newCategories.push({ id: level3Id, name: aiSuggestion.level3Name, parentId: level2Id });
    }

    if (newCategories.length > categories.length) {
      onUpdateCategories(newCategories);
    }

    setFormData(prev => ({ ...prev, category: aiSuggestion.level3Name }));
    setAiSuggestion(null);
  };

  const handleAddRecord = (e: React.FormEvent) => {
    e.preventDefault();
    const newRecord: ExpenseRecord = { id: crypto.randomUUID(), date: formData.date, category: formData.category, amount: Number(formData.amount) || 0, description: formData.description };
    if (onUpdateSurgical) {
      onUpdateSurgical([{ key: 'expenses', item: newRecord }]);
    } else {
      onUpdate([newRecord, ...list]);
    }
    setFormData(prev => ({ ...prev, amount: '', description: '' }));
    setAiSuggestion(null);
  };

  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-20 animate-in fade-in duration-500">
      
      {/* GLOBAL TIME INTELLIGENCE FILTER BAR */}
      <TimeFilter 
        diagnosisRange={diagnosisRange}
        setDiagnosisRange={setDiagnosisRange}
        diagStartDate={diagStartDate}
        setDiagStartDate={setDiagStartDate}
        diagEndDate={diagEndDate}
        setDiagEndDate={setDiagEndDate}
      />

      <ExpenseTabs
        activeSubTab={activeSubTab}
        setActiveSubTab={setActiveSubTab}
        pendingRecurringCount={pendingRecurring.length}
      />

      {activeSubTab === 'ledger' && (
        <ExpenseLedgerTab
          pendingRecurringCount={pendingRecurring.length}
          onOpenRecurring={() => setActiveSubTab('recurring')}
          aiSuggestion={aiSuggestion}
          setAiSuggestion={setAiSuggestion}
          onApplyAISuggestion={applyAISuggestion}
          fileInputRef={fileInputRef}
          isAnalyzing={isAnalyzing}
          formData={formData}
          setFormData={setFormData}
          parentCategories={parentCategories}
          categories={categories}
          onTriggerAIAnalysis={triggerAIAnalysis}
          onAddRecord={handleAddRecord}
          timeContext={timeContext}
          processedList={processedList}
          sourceList={list}
          onUpdate={onUpdate}
          onUpdateSurgical={onUpdateSurgical}
          formatNumber={formatNumber}
        />
      )}

      {activeSubTab === 'recurring' && (
        <ExpenseRecurringTab
          pendingRecurring={pendingRecurring}
          recurringExpenses={recurringExpenses}
          recurringForm={recurringForm}
          setRecurringForm={setRecurringForm}
          categories={categories}
          formatNumber={formatNumber}
          onPostRecurring={handlePostRecurring}
          onAddRecurring={handleAddRecurring}
          onToggleRecurringActive={toggleRecurringActive}
          onRemoveRecurring={handleRemoveRecurring}
        />
      )}
    </div>
  );
};

export default ExpenseManager;
