
import React, { useState, useEffect, useRef } from 'react';
import { ExpenseRecord, ExpenseCategory, RevenueRecord, PayrollRecord, RecurringExpense, ProductGroupRevenue, DiagnosisRange } from '../types';
import { ArrowRight, Sparkles, X } from 'lucide-react';
import TimeFilter from './TimeFilter';
import { ExpenseTabs } from './expense/ExpenseTabs';
import { useExpenseRecurring } from './expense/useExpenseRecurring';
import { ExpenseRecurringTab } from './expense/ExpenseRecurringTab';
import { useExpenseAnalytics } from './expense/useExpenseAnalytics';
import { ExpenseEfficiencyTab } from './expense/ExpenseEfficiencyTab';
import { ExpenseLedgerTab } from './expense/ExpenseLedgerTab';
import { ExpenseCategoriesTab } from './expense/ExpenseCategoriesTab';

interface Props {
  list: ExpenseRecord[];
  categories: ExpenseCategory[];
  revenueList: RevenueRecord[];
  shopeeProductGroupRevenue?: ProductGroupRevenue[];
  payrolls: PayrollRecord[];
  recurringExpenses: RecurringExpense[];
  onUpdate: (newList: ExpenseRecord[], idToRemove?: string) => void;
  onUpdateSurgical?: (updates: { key: any, item: any, isDelete?: boolean }[]) => Promise<void>;
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
  const [activeSubTab, setActiveSubTab] = useState<'efficiency' | 'categories' | 'ledger' | 'recurring'>('efficiency');
  
  const localTodayStr = new Date().toLocaleDateString('sv-SE');

  // States for Category Management (Manual)
  const [manualChildName, setManualChildName] = useState('');
  const [activeParentId, setActiveParentId] = useState<string | undefined>(undefined);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  
  // Bottom Parent Creation State
  const [isAddingParentAtBottom, setIsAddingParentAtBottom] = useState(false);
  const [bottomParentName, setBottomParentName] = useState('');
  const [bottomParentId, setBottomParentId] = useState<string | undefined>(undefined);
  
  // Smart Scan States
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<{ originalId: string, duplicateId: string, originalName: string, duplicateName: string }[] | null>(null);

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
    efficiencyData,
    misMetrics,
    processedList,
    categoryTotals,
    fixedParent,
    variableParent,
    depreciationParent,
    interestParent,
    otherParents
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
      alert("Vui lòng nhập mô tả chi tiết hơn (tối thiểu 5 ký tự) để AI phân tích.");
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
    
    let newCategories = [...categories];
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

  const handleSmartScan = async () => {
    if (categories.length < 2) return;
    setIsScanning(true);
    try {
      const contextData = `
        NHIỆM VỤ: Tìm các hạng mục chi phí bị trùng lặp hoặc có tên tương tự nhau trong danh sách sau.
        DANH SÁCH:
        ${categories.map(c => `- ID: ${c.id}, Tên: ${c.name}, ParentId: ${c.parentId || 'None'}`).join('\n')}

        Tìm các cặp hạng mục cùng cấp độ có ý nghĩa giống nhau (Ví dụ: "Lãi vay" và "Tiền lãi vay").
        Trả về JSON array: [{"originalId":"ID_GIỮ_LẠI","duplicateId":"ID_GỘP_VÀO","originalName":"Tên gốc","duplicateName":"Tên trùng"}]
        Nếu không có trùng lặp, trả về [].
      `;
      const response = await fetch('/api/ai/expense-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextData }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'AI service error');
      const results = JSON.parse(data.result || "[]");
      setScanResults(results.length > 0 ? results : null);
      if (results.length === 0) alert("Không tìm thấy hạng mục trùng lặp nào!");
    } catch (error) {
      console.error("Smart Scan failed:", error);
      alert("Lỗi khi quét dữ liệu. Vui lòng kiểm tra ANTHROPIC_API_KEY trong .env.local.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleMergeCategories = (originalId: string, duplicateId: string, originalName: string, duplicateName: string) => {
    if (!confirm(`Xác nhận gộp "${duplicateName}" vào "${originalName}"?\n\nTất cả bản ghi trong Sổ cái sẽ được chuyển sang danh mục mới.`)) return;

    // 1. Update Expense Records
    const newList = list.map(exp => {
      if (exp.category === duplicateName) {
        return { ...exp, category: originalName };
      }
      return exp;
    });
    onUpdate(newList);

    // 2. Update Categories (Remove duplicate and its children if any, though usually we only merge leaves)
    const newCats = categories.filter(c => c.id !== duplicateId);
    onUpdateCategories(newCats);

    // 3. Update scan results
    setScanResults(prev => prev ? prev.filter(r => r.duplicateId !== duplicateId) : null);
  };

  const handleEditCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editingCategory.name.trim()) return;

    const oldName = categories.find(c => c.id === editingCategory.id)?.name;
    const newName = editingCategory.name.trim();

    // 1. Update Expense Records if name changed
    if (oldName && oldName !== newName) {
      const newList = list.map(exp => {
        if (exp.category === oldName) {
          return { ...exp, category: newName };
        }
        return exp;
      });
      onUpdate(newList);
    }

    // 2. Update Categories
    const newCats = categories.map(c => {
      if (c.id === editingCategory.id) {
        return editingCategory;
      }
      return c;
    });
    onUpdateCategories(newCats);
    setEditingCategory(null);
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

  const handleDeleteCategory = (id: string) => {
    if (confirm("Xác nhận xóa danh mục này?")) {
      onUpdateCategories(categories.filter(c => c.id !== id && c.parentId !== id));
    }
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

      {activeSubTab === 'efficiency' && (
        <ExpenseEfficiencyTab
          timeContext={timeContext}
          efficiencyData={efficiencyData}
          misMetrics={misMetrics}
          formatNumber={formatNumber}
        />
      )}

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
      {activeSubTab === 'categories' && (
        <ExpenseCategoriesTab
          categories={categories}
          categoryTotals={categoryTotals}
          fixedParent={fixedParent}
          variableParent={variableParent}
          depreciationParent={depreciationParent}
          interestParent={interestParent}
          otherParents={otherParents}
          isScanning={isScanning}
          onSmartScan={handleSmartScan}
          setEditingCategory={setEditingCategory}
          onDeleteCategory={handleDeleteCategory}
          setActiveParentId={setActiveParentId}
          onStartAddParent={() => setIsAddingParentAtBottom(true)}
          formatNumber={formatNumber}
        />
      )}

      {/* Manual Modals */}
      {editingCategory && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setEditingCategory(null)}></div>
          <div className="relative bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-200">
            <h5 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-8">Chỉnh sửa Danh mục</h5>
            <form onSubmit={handleEditCategory} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tên hạng mục</label>
                <input autoFocus type="text" required value={editingCategory.name} onChange={e => setEditingCategory({...editingCategory, name: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-base font-bold outline-none" />
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Thuộc nhóm cha</label>
                <select 
                  value={editingCategory.parentId || ''} 
                  onChange={e => setEditingCategory({...editingCategory, parentId: e.target.value || undefined})}
                  className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none appearance-none"
                >
                  <option value="">-- Nhóm Cha Cao Nhất (Cấp 1) --</option>
                  {categories
                    .filter(c => c.id !== editingCategory.id)
                    .map(p => {
                      const getLevel = (id: string, depth = 0): number => {
                        const cat = categories.find(c => c.id === id);
                        if (!cat?.parentId) return depth;
                        return getLevel(cat.parentId, depth + 1);
                      };
                      const level = getLevel(p.id);
                      return (
                        <option key={p.id} value={p.id}>
                          {level > 0 ? "—".repeat(level) + " " : ""}{p.name}
                        </option>
                      );
                    })}
                </select>
              </div>

              <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black uppercase text-xs shadow-lg">LƯU THAY ĐỔI</button>
            </form>
          </div>
        </div>
      )}

      {activeParentId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setActiveParentId(undefined)}></div>
          <div className="relative bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-200">
            <h5 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-8">Thêm Tiểu Mục Chi Tiết</h5>
            <form onSubmit={(e) => {
               e.preventDefault();
               if (manualChildName.trim()) {
                 onUpdateCategories([...categories, { id: `cat-${Date.now()}`, name: manualChildName.trim(), parentId: activeParentId }]);
                 setManualChildName('');
                 setActiveParentId(undefined);
               }
            }} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tên tiểu mục</label>
                <input autoFocus type="text" required placeholder="Tên tiểu mục..." value={manualChildName} onChange={e => setManualChildName(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-base font-bold outline-none" />
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Thuộc nhóm cha</label>
                <select 
                  value={activeParentId} 
                  onChange={e => setActiveParentId(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none appearance-none"
                >
                  {/* Show all potential Level 2 parents (those that have a Level 1 parent) */}
                  {categories.filter(c => c.parentId && parentCategories.some(p => p.id === c.parentId)).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                  {/* Also allow selecting Level 1 parents directly if needed (though usually for Level 2) */}
                  <optgroup label="Phân loại chính (Cấp 1)">
                    {parentCategories.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black uppercase text-xs shadow-lg">XÁC NHẬN THÊM</button>
            </form>
          </div>
        </div>
      )}

      {isAddingParentAtBottom && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsAddingParentAtBottom(false)}></div>
          <div className="relative bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-200">
            <h5 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-8">Thêm Nhóm Chi Phí</h5>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (bottomParentName.trim()) {
                onUpdateCategories([...categories, { id: `cat-parent-${Date.now()}`, name: bottomParentName.trim(), parentId: bottomParentId }]);
                setBottomParentName('');
                setBottomParentId(undefined);
                setIsAddingParentAtBottom(false);
              }
            }} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tên nhóm</label>
                <input autoFocus type="text" required placeholder="Tên Nhóm..." value={bottomParentName} onChange={e => setBottomParentName(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-base font-bold outline-none" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Thuộc phân loại (Cấp 1)</label>
                <select 
                  value={bottomParentId || ''} 
                  onChange={e => setBottomParentId(e.target.value || undefined)}
                  className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none appearance-none"
                >
                  <option value="">-- Nhóm Cha Cao Nhất (Cấp 1) --</option>
                  {parentCategories.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black uppercase text-xs shadow-lg">XÁC NHẬN THÊM</button>
            </form>
          </div>
        </div>
      )}

      {/* Smart Scan Results Modal */}
      {scanResults && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setScanResults(null)}></div>
          <div className="relative bg-white p-10 rounded-[3rem] shadow-2xl w-full max-w-2xl animate-in zoom-in-95 duration-300 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg"><Sparkles className="w-5 h-5" /></div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Gợi ý gộp hạng mục trùng</h3>
              </div>
              <button onClick={() => setScanResults(null)} className="p-2 hover:bg-slate-100 rounded-full transition-all"><X className="w-6 h-6 text-slate-400" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-4 no-scrollbar">
              {scanResults.map((res, idx) => (
                <div key={idx} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between gap-6 group hover:border-indigo-200 transition-all">
                  <div className="flex-1 flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-[9px] font-black text-slate-400 uppercase">Hạng mục cũ</p>
                      <span className="text-xs font-bold text-rose-500 line-through">{res.duplicateName}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300" />
                    <div className="text-center">
                      <p className="text-[9px] font-black text-slate-400 uppercase">Hạng mục gốc</p>
                      <span className="text-xs font-bold text-emerald-600">{res.originalName}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleMergeCategories(res.originalId, res.duplicateId, res.originalName, res.duplicateName)}
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all"
                  >
                    Gộp ngay
                  </button>
                </div>
              ))}
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <p className="text-[10px] font-bold text-slate-400 italic">* Việc gộp sẽ cập nhật toàn bộ Sổ cái và xóa hạng mục trùng lặp.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseManager;
