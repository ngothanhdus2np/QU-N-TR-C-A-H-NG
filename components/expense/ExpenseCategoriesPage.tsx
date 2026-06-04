import React, { useState } from 'react';
import { ExpenseRecord, ExpenseCategory, RevenueRecord, PayrollRecord, ProductGroupRevenue, DiagnosisRange } from '../../types';
import { ArrowRight, Sparkles, X } from 'lucide-react';
import TimeFilter from '../TimeFilter';
import { useExpenseAnalytics } from './useExpenseAnalytics';
import { ExpenseCategoriesTab } from './ExpenseCategoriesTab';
import { useToast } from '../ui/Toast';

interface Props {
  list: ExpenseRecord[];
  categories: ExpenseCategory[];
  revenueList: RevenueRecord[];
  shopeeProductGroupRevenue: ProductGroupRevenue[];
  payrolls: PayrollRecord[];
  onUpdate: (newList: ExpenseRecord[]) => void;
  onUpdateCategories: (newCats: ExpenseCategory[]) => void;
}

const ExpenseCategoriesPage: React.FC<Props> = ({
  list, categories, revenueList, shopeeProductGroupRevenue, payrolls,
  onUpdate, onUpdateCategories,
}) => {
  const { showToast } = useToast();
  const today = new Date().toLocaleDateString('sv-SE');
  const [diagnosisRange, setDiagnosisRange] = useState<DiagnosisRange>('thisMonth');
  const [diagStartDate, setDiagStartDate] = useState(today);
  const [diagEndDate, setDiagEndDate] = useState(today);
  const [manualChildName, setManualChildName] = useState('');
  const [activeParentId, setActiveParentId] = useState<string | undefined>(undefined);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [isAddingParentAtBottom, setIsAddingParentAtBottom] = useState(false);
  const [bottomParentName, setBottomParentName] = useState('');
  const [bottomParentId, setBottomParentId] = useState<string | undefined>(undefined);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<{ originalId: string; duplicateId: string; originalName: string; duplicateName: string }[] | null>(null);

  const {
    parentCategories,
    categoryTotals,
    fixedParent,
    variableParent,
    depreciationParent,
    interestParent,
    otherParents,
  } = useExpenseAnalytics({
    list,
    categories,
    revenueList,
    shopeeProductGroupRevenue,
    payrolls,
    diagnosisRange,
    diagStartDate,
    diagEndDate,
  });

  const formatNumber = (num: number) => Math.round(num || 0).toLocaleString('vi-VN');

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
      const results = JSON.parse(data.result || '[]');
      setScanResults(results.length > 0 ? results : null);
      if (results.length === 0) showToast('Không tìm thấy hạng mục trùng lặp nào!', 'warning');
    } catch (error) {
      console.error('Smart Scan failed:', error);
      showToast('Lỗi khi quét dữ liệu. Vui lòng kiểm tra ANTHROPIC_API_KEY trong .env.local.', 'error');
    } finally {
      setIsScanning(false);
    }
  };

  const handleMergeCategories = (originalId: string, duplicateId: string, originalName: string, duplicateName: string) => {
    if (!confirm(`Xác nhận gộp "${duplicateName}" vào "${originalName}"?\n\nTất cả bản ghi trong Sổ cái sẽ được chuyển sang danh mục mới.`)) return;
    const newList = list.map(exp => exp.category === duplicateName ? { ...exp, category: originalName } : exp);
    onUpdate(newList);
    onUpdateCategories(categories.filter(c => c.id !== duplicateId));
    setScanResults(prev => prev ? prev.filter(r => r.duplicateId !== duplicateId) : null);
  };

  const handleEditCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editingCategory.name.trim()) return;
    const oldName = categories.find(c => c.id === editingCategory.id)?.name;
    const newName = editingCategory.name.trim();
    if (oldName && oldName !== newName) {
      onUpdate(list.map(exp => exp.category === oldName ? { ...exp, category: newName } : exp));
    }
    onUpdateCategories(categories.map(c => c.id === editingCategory.id ? editingCategory : c));
    setEditingCategory(null);
  };

  const handleDeleteCategory = (id: string) => {
    if (confirm('Xác nhận xóa danh mục này?')) {
      onUpdateCategories(categories.filter(c => c.id !== id && c.parentId !== id));
    }
  };

  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-20 animate-in fade-in duration-500">
      <TimeFilter
        diagnosisRange={diagnosisRange}
        setDiagnosisRange={setDiagnosisRange}
        diagStartDate={diagStartDate}
        setDiagStartDate={setDiagStartDate}
        diagEndDate={diagEndDate}
        setDiagEndDate={setDiagEndDate}
        variant="range"
      />

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

      {editingCategory && (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setEditingCategory(null)} />
          <div className="relative bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-200">
            <h5 className="text-lg font-semibold text-slate-800 uppercase tracking-tight mb-8">Chỉnh sửa Danh mục</h5>
            <form onSubmit={handleEditCategory} className="space-y-6">
              <div className="space-y-2">
                <label className="text-2xs font-normal text-slate-400 uppercase ml-1">Tên hạng mục</label>
                <input autoFocus type="text" required value={editingCategory.name} onChange={e => setEditingCategory({ ...editingCategory, name: e.target.value })} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-base font-normal outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-2xs font-normal text-slate-400 uppercase ml-1">Thuộc nhóm cha</label>
                <select
                  value={editingCategory.parentId || ''}
                  onChange={e => setEditingCategory({ ...editingCategory, parentId: e.target.value || undefined })}
                  className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-normal outline-none appearance-none"
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
                          {level > 0 ? '—'.repeat(level) + ' ' : ''}{p.name}
                        </option>
                      );
                    })}
                </select>
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-xl font-normal uppercase text-xs shadow-lg">LƯU THAY ĐỔI</button>
            </form>
          </div>
        </div>
      )}

      {activeParentId && (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setActiveParentId(undefined)} />
          <div className="relative bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-200">
            <h5 className="text-lg font-semibold text-slate-800 uppercase tracking-tight mb-8">Thêm Tiểu Mục Chi Tiết</h5>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (manualChildName.trim()) {
                onUpdateCategories([...categories, { id: `cat-${Date.now()}`, name: manualChildName.trim(), parentId: activeParentId }]);
                setManualChildName('');
                setActiveParentId(undefined);
              }
            }} className="space-y-6">
              <div className="space-y-2">
                <label className="text-2xs font-normal text-slate-400 uppercase ml-1">Tên tiểu mục</label>
                <input autoFocus type="text" required placeholder="Tên tiểu mục..." value={manualChildName} onChange={e => setManualChildName(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-base font-normal outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-2xs font-normal text-slate-400 uppercase ml-1">Thuộc nhóm cha</label>
                <select
                  value={activeParentId}
                  onChange={e => setActiveParentId(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-normal outline-none appearance-none"
                >
                  {categories.filter(c => c.parentId && parentCategories.some(p => p.id === c.parentId)).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                  <optgroup label="Phân loại chính (Cấp 1)">
                    {parentCategories.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-xl font-normal uppercase text-xs shadow-lg">XÁC NHẬN THÊM</button>
            </form>
          </div>
        </div>
      )}

      {isAddingParentAtBottom && (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsAddingParentAtBottom(false)} />
          <div className="relative bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-200">
            <h5 className="text-lg font-semibold text-slate-800 uppercase tracking-tight mb-8">Thêm Nhóm Chi Phí</h5>
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
                <label className="text-2xs font-normal text-slate-400 uppercase ml-1">Tên nhóm</label>
                <input autoFocus type="text" required placeholder="Tên Nhóm..." value={bottomParentName} onChange={e => setBottomParentName(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-base font-normal outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-2xs font-normal text-slate-400 uppercase ml-1">Thuộc phân loại (Cấp 1)</label>
                <select
                  value={bottomParentId || ''}
                  onChange={e => setBottomParentId(e.target.value || undefined)}
                  className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-normal outline-none appearance-none"
                >
                  <option value="">-- Nhóm Cha Cao Nhất (Cấp 1) --</option>
                  {parentCategories.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-xl font-normal uppercase text-xs shadow-lg">XÁC NHẬN THÊM</button>
            </form>
          </div>
        </div>
      )}

      {scanResults && (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setScanResults(null)} />
          <div className="relative bg-white p-10 rounded-[3rem] shadow-2xl w-full max-w-2xl animate-in zoom-in-95 duration-300 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg"><Sparkles className="w-5 h-5" /></div>
                <h3 className="text-xl font-semibold text-slate-900 uppercase tracking-tight">Gợi ý gộp hạng mục trùng</h3>
              </div>
              <button onClick={() => setScanResults(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-6 h-6 text-slate-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 space-y-4 no-scrollbar">
              {scanResults.map((res, idx) => (
                <div key={idx} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between gap-6 group hover:border-indigo-200 transition-colors">
                  <div className="flex-1 flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-[9px] font-normal text-slate-400 uppercase">Hạng mục cũ</p>
                      <span className="text-xs font-normal text-rose-500 line-through">{res.duplicateName}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300" />
                    <div className="text-center">
                      <p className="text-[9px] font-normal text-slate-400 uppercase">Hạng mục gốc</p>
                      <span className="text-xs font-normal text-emerald-600">{res.originalName}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleMergeCategories(res.originalId, res.duplicateId, res.originalName, res.duplicateName)}
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-normal text-2xs uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-colors"
                  >
                    Gộp ngay
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <p className="text-2xs font-normal text-slate-400 italic">* Việc gộp sẽ cập nhật toàn bộ Sổ cái và xóa hạng mục trùng lặp.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseCategoriesPage;
