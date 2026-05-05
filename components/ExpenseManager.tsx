
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ExpenseRecord, ExpenseCategory, RevenueRecord, PayrollRecord, RecurringExpense, ProductGroupRevenue, DiagnosisRange } from '../types';
import { GoogleGenAI } from "@google/genai";
import { 
  Plus, Trash2, Calendar, Wallet, Layers, FileText, 
  LayoutGrid, ListChecks, ArrowRight, Tag, ChevronRight, 
  GitBranch, Info, AlertTriangle, Subtitles, FolderTree, ChevronDown, Minus, Save, Sparkles, Loader2, X, Check,
  TrendingUp, TrendingDown, Activity, ShieldAlert, Target, BarChart3, PieChart, Upload, Search, Download, FileSpreadsheet,
  ArrowRightLeft, Pencil, Bell, Repeat, History, Clock, ArrowUpRight, ArrowDownRight, Zap
} from 'lucide-react';
import { PieChart as RePie, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, AreaChart, Area } from 'recharts';
import { calculateExpenseAnalysis, calculateTimeContext, getCategoryType, calculateMISMetrics } from '../businessLogic';
import TimeFilter from './TimeFilter';

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

  const [recurringForm, setRecurringForm] = useState<Partial<RecurringExpense>>({
    name: '',
    category: '',
    amount: 0,
    dayOfMonth: 1,
    isActive: true
  });

  const pendingRecurring = useMemo(() => {
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    const currentDay = now.getDate();

    return recurringExpenses.filter(re => 
      re.isActive && 
      re.lastPostedMonth !== currentMonth && 
      currentDay >= re.dayOfMonth
    );
  }, [recurringExpenses]);

  const handlePostRecurring = (re: RecurringExpense) => {
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    const dateStr = `${currentMonth}-${String(re.dayOfMonth).padStart(2, '0')}`;

    const newExpense: ExpenseRecord = {
      id: crypto.randomUUID(),
      date: dateStr,
      category: re.category,
      amount: re.amount,
      description: `[Định kỳ] ${re.name}: ${re.description || ''}`
    };

    if (onUpdateSurgical) {
      onUpdateSurgical([{ key: 'expenses', item: newExpense }]);
    } else {
      onUpdate([newExpense, ...list]);
    }

    const updatedRecurring = recurringExpenses.map(item => 
      item.id === re.id ? { ...item, lastPostedMonth: currentMonth } : item
    );
    onUpdateRecurringExpenses(updatedRecurring);
  };

  const handleAddRecurring = () => {
    if (!recurringForm.name || !recurringForm.category || !recurringForm.amount) {
      alert("Vui lòng nhập đầy đủ thông tin");
      return;
    }
    const newRE: RecurringExpense = {
      id: crypto.randomUUID(),
      name: recurringForm.name,
      category: recurringForm.category,
      amount: Number(recurringForm.amount),
      dayOfMonth: Number(recurringForm.dayOfMonth) || 1,
      description: recurringForm.description,
      isActive: true
    };
    onUpdateRecurringExpenses([...recurringExpenses, newRE]);
    setRecurringForm({ name: '', category: '', amount: 0, dayOfMonth: 1, isActive: true });
  };

  const handleRemoveRecurring = (id: string) => {
    if (confirm("Xóa mẫu chi phí định kỳ này?")) {
      onUpdateRecurringExpenses(recurringExpenses.filter(re => re.id !== id));
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const parentCategories = useMemo(() => categories.filter(c => !c.parentId), [categories]);
  
  // --- LOGIC LỌC THỜI GIAN TOÀN CỤC ---
  const timeContext = useMemo(() => {
    return calculateTimeContext(diagnosisRange, diagStartDate, diagEndDate);
  }, [diagnosisRange, diagStartDate, diagEndDate]);

  // Lọc dữ liệu theo kỳ đang chọn
  const filteredExpenses = useMemo(() => {
    return list.filter(e => e.date >= timeContext.start && e.date <= timeContext.end);
  }, [list, timeContext]);

  const filteredRevenue = useMemo(() => {
    return revenueList.filter(r => r.date >= timeContext.start && r.date <= timeContext.end);
  }, [revenueList, timeContext]);

  const filteredPayrolls = useMemo(() => {
    const { start, end } = timeContext;
    return (payrolls || []).filter(p => {
      const monthStart = `${p.month}-01`;
      const monthEnd = `${p.month}-31`;
      return (monthStart >= start && monthStart <= end) || (monthEnd >= start && monthEnd <= end) || (start >= monthStart && start <= monthEnd);
    });
  }, [payrolls, timeContext]);

  // Logic Phân tích Hiệu quả dựa trên dữ liệu đã lọc
  const efficiencyData = useMemo(() => {
    return calculateExpenseAnalysis(filteredExpenses, filteredRevenue, filteredPayrolls, categories);
  }, [filteredExpenses, filteredRevenue, filteredPayrolls, categories]);

  // MIS Logic: Calculate previous period for comparison
  const misMetrics = useMemo(() => {
    // Determine previous period start/end
    const durationMs = new Date(timeContext.end).getTime() - new Date(timeContext.start).getTime();
    const prevEnd = new Date(new Date(timeContext.start).getTime() - 86400000).toISOString().split('T')[0];
    const prevStart = new Date(new Date(prevEnd).getTime() - durationMs).toISOString().split('T')[0];

    const prevExpenses = list.filter(e => e.date >= prevStart && e.date <= prevEnd);
    const prevRevenueList = revenueList.filter(r => r.date >= prevStart && r.date <= prevEnd);
    const prevRevTotal = prevRevenueList.reduce((sum, r) => sum + (Number(r.netRevenue) || 0) + (Number(r.revenueOther) || 0), 0);
    const prevCogsTotal = prevRevenueList.reduce((sum, r) => sum + (Number(r.totalCogs) || 0), 0);
    const prevPayrollList = (payrolls || []).filter(p => {
      const monthStart = `${p.month}-01`;
      const monthEnd = `${p.month}-31`;
      return (monthStart >= prevStart && monthStart <= prevEnd) || (monthEnd >= prevStart && monthEnd <= prevEnd) || (prevStart >= monthStart && prevStart <= monthEnd);
    });
    const prevPayrollTotal = prevPayrollList.reduce((sum, p) => sum + (Number(p.netPay) || 0), 0);

    const currentRevTotal = filteredRevenue.reduce((sum, r) => sum + (Number(r.netRevenue) || 0) + (Number(r.revenueOther) || 0), 0);
    const currentPayrollTotal = filteredPayrolls.reduce((sum, p) => sum + (Number(p.netPay) || 0), 0);
    const currentCogsTotal = efficiencyData.totalCogs;

    return calculateMISMetrics(
      { expenses: filteredExpenses, revenue: currentRevTotal, payroll: currentPayrollTotal, cogs: currentCogsTotal, categories },
      { expenses: prevExpenses, revenue: prevRevTotal, payroll: prevPayrollTotal, cogs: prevCogsTotal }
    );
  }, [filteredExpenses, filteredRevenue, filteredPayrolls, categories, list, revenueList, payrolls, timeContext]);

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
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `
        BẠN LÀ: Kế toán trưởng chuyên nghiệp.
        NHIỆM VỤ: Phân tích mô tả chi phí và phân loại vào hệ thống MIS 3 cấp.
        MÔ TẢ CHI PHÍ: "${formData.description}"
        
        CẤU TRÚC 3 CẤP:
        Cấp 1: Cố định (Fixed) hoặc Biến đổi (Variable).
        Cấp 2: Nhóm chi phí (Ví dụ: Nhân sự, Mặt bằng, Marketing, Điện nước...).
        Cấp 3: Tiểu mục chi tiết (Ví dụ: Lương cơ bản, Tiền thuê nhà, FB Ads, Tiền điện...).

        DANH SÁCH CẤP 1 HIỆN TẠI:
        ${parentCategories.map(p => `- ID: ${p.id}, Tên: ${p.name}`).join('\n')}

        YÊU CẦU:
        1. Xác định Cấp 1 phù hợp nhất (Fixed/Variable).
        2. Gợi ý Cấp 2 (Nhóm chi phí) phù hợp.
        3. Gợi ý Cấp 3 (Tiểu mục chi tiết).
        4. TRẢ VỀ JSON: {
          "level1Id": "ID_CẤP_1", 
          "level1Name": "Tên Cấp 1",
          "level2Name": "Tên Nhóm Cấp 2", 
          "level3Name": "Tên Tiểu Mục Cấp 3"
        }
      `;
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      const result = JSON.parse(response.text || "null");
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
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `
        BẠN LÀ: Chuyên gia dọn dẹp dữ liệu kế toán.
        NHIỆM VỤ: Tìm các hạng mục chi phí bị trùng lặp hoặc có tên tương tự nhau trong danh sách sau.
        DANH SÁCH:
        ${categories.map(c => `- ID: ${c.id}, Tên: ${c.name}, ParentId: ${c.parentId || 'None'}`).join('\n')}
        
        YÊU CẦU:
        1. Tìm các cặp hạng mục (Cùng cấp độ) có ý nghĩa giống nhau (Ví dụ: "Lãi vay" và "Tiền lãi vay").
        2. TRẢ VỀ JSON ARRAY: [{"originalId": "ID_GIỮ_LẠI", "duplicateId": "ID_GỘP_VÀO", "originalName": "Tên gốc", "duplicateName": "Tên trùng"}]
        3. Nếu không có trùng lặp, trả về mảng trống [].
      `;
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      const results = JSON.parse(response.text || "[]");
      setScanResults(results.length > 0 ? results : null);
      if (results.length === 0) alert("Không tìm thấy hạng mục trùng lặp nào!");
    } catch (error) {
      console.error("Smart Scan failed:", error);
      alert("Lỗi khi quét dữ liệu.");
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

  const processedList = useMemo(() => {
    return filteredExpenses.sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredExpenses]);

  const groupedAnalysis = useMemo(() => {
    const fixedMap: Record<string, any> = {};
    const variableMap: Record<string, any> = {};
    const depreciationMap: Record<string, any> = {};
    const interestMap: Record<string, any> = {};
    
    efficiencyData.analysis.forEach(item => {
      const type = getCategoryType(item.name, categories);
      const cat = categories.find(c => c.name === item.name);
      let groupName = item.name;
      
      if (cat && cat.parentId) {
        const parent = categories.find(c => c.id === cat.parentId);
        // Nếu cha của danh mục này không phải là danh mục gốc (Cấp 1), thì cha chính là Nhóm Cấp 2
        if (parent && parent.parentId) {
          groupName = parent.name;
        }
      }

      const targetMap = type === 'interest' ? interestMap : 
                        type === 'depreciation' ? depreciationMap : 
                        type === 'fixed' ? fixedMap : variableMap;

      if (!targetMap[groupName]) {
        targetMap[groupName] = { name: groupName, amount: 0, ratio: 0 };
      }
      targetMap[groupName].amount += item.amount;
      targetMap[groupName].ratio += item.ratio;
    });

    return { 
      fixed: Object.values(fixedMap).sort((a, b) => b.amount - a.amount), 
      variable: Object.values(variableMap).sort((a, b) => b.amount - a.amount),
      depreciation: Object.values(depreciationMap).sort((a, b) => b.amount - a.amount),
      interest: Object.values(interestMap).sort((a, b) => b.amount - a.amount)
    };
  }, [efficiencyData.analysis, categories]);

  const handleDeleteCategory = (id: string) => {
    if (confirm("Xác nhận xóa danh mục này?")) {
      onUpdateCategories(categories.filter(c => c.id !== id && c.parentId !== id));
    }
  };

  // Calculate totals per category for the current period (Recursive)
  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    const salaryKeywords = ['lương', 'hoa hồng', 'thưởng doanh số', 'thưởng nhân viên', 'phụ cấp', 'tăng ca', 'thực nhận'];
    
    // First pass: sum up direct expenses for each leaf category
    filteredExpenses.forEach(exp => {
      const catLower = exp.category.toLowerCase();
      if (salaryKeywords.some(kw => catLower.includes(kw))) return;

      const cat = categories.find(c => c.name === exp.category);
      if (cat) {
        totals[cat.id] = (totals[cat.id] || 0) + exp.amount;
      }
    });

    // Second pass: propagate totals up the tree using recursion
    const parentToChildren: Record<string, string[]> = {};
    categories.forEach(c => {
      if (c.parentId) {
        if (!parentToChildren[c.parentId]) parentToChildren[c.parentId] = [];
        parentToChildren[c.parentId].push(c.id);
      }
    });

    // --- AUTO-CALCULATE COGS FROM REVENUE LEDGERS ---
    const cogsCategory = categories.find(c => c.id === 'cat-cogs' || c.name.includes('COGS'));
    if (cogsCategory) {
      const storeCogs = revenueList
        .filter(r => r.date >= timeContext.start && r.date <= timeContext.end)
        .reduce((sum, r) => sum + (r.totalCogs || 0), 0);
      
      const shopeeCogs = shopeeProductGroupRevenue
        .filter(r => r.date >= timeContext.start && r.date <= timeContext.end)
        .reduce((sum, r) => sum + (r.cogs || 0), 0);
      
      totals[cogsCategory.id] = storeCogs + shopeeCogs;
    }

    // --- AUTO-CALCULATE STAFF SALARY FROM PAYROLL LEDGER OR GENERAL LEDGER ---
    // Try to find the best category to put the personnel total in (Level 3 preferred, then Level 2)
    const netSalaryCat = categories.find(c => c.id === 'cat-personnel-net' || c.name === 'Nhân sự (Thực nhận)') ||
                         categories.find(c => c.name === 'Lương và Thưởng' || c.name === 'Lương nhân viên') ||
                         categories.find(c => c.name.toLowerCase().includes('nhân sự') && c.parentId) ||
                         categories.find(c => c.name.toLowerCase().includes('nhân sự'));
    
    // 1. From Payroll Ledger
    const payrollNetPayTotal = filteredPayrolls.reduce((sum, p) => sum + (Number(p.netPay) || 0), 0);
    
    // 2. From General Ledger (those that were filtered out from totals initially)
    const ledgerSalaryTotal = list
      .filter(e => e.date >= timeContext.start && e.date <= timeContext.end)
      .reduce((sum, e) => {
        const catLower = e.category.toLowerCase();
        if (salaryKeywords.some(kw => catLower.includes(kw))) {
          return sum + (Number(e.amount) || 0);
        }
        return sum;
      }, 0);

    // Smart Priority: Payroll > Ledger
    const finalPersonnelTotal = payrollNetPayTotal > 0 ? payrollNetPayTotal : ledgerSalaryTotal;

    if (netSalaryCat) totals[netSalaryCat.id] = finalPersonnelTotal;

    const getRecursiveTotal = (catId: string): number => {
      const direct = totals[catId] || 0;
      const children = parentToChildren[catId] || [];
      const childrenTotal = children.reduce((sum, childId) => sum + getRecursiveTotal(childId), 0);
      const combined = direct + childrenTotal;
      totals[catId] = combined;
      return combined;
    };

    // Trigger recursion from top-level parents
    parentCategories.forEach(p => getRecursiveTotal(p.id));

    return totals;
  }, [filteredExpenses, filteredPayrolls, categories, parentCategories, list, revenueList, shopeeProductGroupRevenue, timeContext]);

  const fixedParent = useMemo(() => parentCategories.find(c => c.id === 'cat-fixed' || c.name.toLowerCase().includes('cố định')), [parentCategories]);
  const variableParent = useMemo(() => parentCategories.find(c => c.id === 'cat-variable' || c.name.toLowerCase().includes('biến đổi')), [parentCategories]);
  const depreciationParent = useMemo(() => parentCategories.find(c => c.id === 'cat-depreciation-root' || c.name.toLowerCase().includes('khấu hao')), [parentCategories]);
  const interestParent = useMemo(() => parentCategories.find(c => c.id === 'cat-interest-root' || c.name.toLowerCase().includes('lãi vay')), [parentCategories]);
  
  const otherParents = useMemo(() => 
    parentCategories.filter(p => 
      p.id !== fixedParent?.id && 
      p.id !== variableParent?.id && 
      p.id !== depreciationParent?.id && 
      p.id !== interestParent?.id
    ), [parentCategories, fixedParent, variableParent, depreciationParent, interestParent]);

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

      {/* Navigation Tabs - Order: Efficiency -> Categories -> Ledger */}
      <div className="flex bg-slate-100 p-1.5 rounded-[2rem] w-fit mx-auto shadow-sm border border-slate-200">
        <button 
          onClick={() => setActiveSubTab('efficiency')}
          className={`flex items-center gap-3 px-8 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all ${
            activeSubTab === 'efficiency' ? 'bg-white text-emerald-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Activity className="w-4 h-4" /> Hiệu Quả MIS
        </button>
        <button 
          onClick={() => setActiveSubTab('categories')}
          className={`flex items-center gap-3 px-8 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all ${
            activeSubTab === 'categories' ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Layers className="w-4 h-4" /> Danh Mục Chi Phí
        </button>
        <button 
          onClick={() => setActiveSubTab('ledger')}
          className={`flex items-center gap-3 px-8 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all ${
            activeSubTab === 'ledger' ? 'bg-white text-rose-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" /> Sổ Cái Chi Phí
        </button>
        <button 
          onClick={() => setActiveSubTab('recurring')}
          className={`flex items-center gap-3 px-8 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all relative ${
            activeSubTab === 'recurring' ? 'bg-white text-amber-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Repeat className="w-4 h-4" /> Chi Phí Định Kỳ
          {pendingRecurring.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white animate-bounce">
              {pendingRecurring.length}
            </span>
          )}
        </button>
      </div>

      {activeSubTab === 'efficiency' && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* TOP METRICS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricCard title="Tổng Chi Vận Hành (OpEx)" value={formatNumber(efficiencyData.totalOpEx) + 'đ'} icon={Wallet} color="rose" desc={`Trong kỳ: ${timeContext.start.split('-').reverse().slice(0, 2).join('/')} - ${timeContext.end.split('-').reverse().slice(0, 2).join('/')}`} />
            <MetricCard title="Điểm Hòa Vốn (Doanh thu)" value={formatNumber(Math.round(efficiencyData.breakEvenRevenue)) + 'đ'} icon={Target} color="amber" desc="Mức thu cần thiết để bù đắp OpEx" />
            <MetricCard title="Biên Độ An Toàn" value={efficiencyData.safetyMargin.toFixed(1) + '%'} icon={ShieldAlert} color={efficiencyData.safetyMargin > 15 ? "emerald" : "rose"} desc="Khoảng cách an toàn tới điểm lỗ" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* BENCHMARKING RADAR */}
            <div className="xl:col-span-2 bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-xl overflow-hidden relative">
              <div className="absolute top-0 right-0 p-8 opacity-5"><Activity className="w-40 h-40" /></div>
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Đối soát định mức ngành</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">So sánh thực tế với tiêu chuẩn ngành bán lẻ</p>
                </div>
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><ShieldAlert className="w-6 h-6" /></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {misMetrics.benchmarks.map((b, idx) => (
                  <div key={idx} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase">{b.name}</span>
                        <div className="flex items-baseline gap-2 mt-1">
                          <h4 className="text-2xl font-black text-slate-900">{b.actual.toFixed(1)}%</h4>
                          <span className="text-[10px] font-bold text-slate-400">/ {b.target}% định mức</span>
                        </div>
                      </div>
                      <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase ${
                        b.status === 'safe' ? 'bg-emerald-100 text-emerald-700' : 
                        b.status === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                         {b.desc}
                      </div>
                    </div>
                    <div className="space-y-2">
                       <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex">
                          <div 
                            className={`h-full transition-all duration-1000 ${
                              b.status === 'safe' ? 'bg-emerald-500' : 
                              b.status === 'warning' ? 'bg-amber-500' : 'bg-rose-500'
                            }`} 
                            style={{ width: `${Math.min(b.actual, 100)}%` }}
                          ></div>
                       </div>
                       <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase px-1">
                          <span>0%</span>
                          <div className="relative">
                            <div className="absolute -top-1 left-1.2 w-0.5 h-3 bg-slate-400"></div>
                            <span className="ml-2">Chuẩn {b.target}%</span>
                          </div>
                          <span>100%</span>
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SPENDING HOTSPOTS AND AI */}
            <div className="space-y-8">
              <div className="bg-slate-900 p-10 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden h-full">
                <div className="absolute top-0 right-0 p-8 opacity-10"><Zap className="w-24 h-24 text-rose-500" /></div>
                <h3 className="text-xl font-black uppercase tracking-tight mb-8">Điểm nóng chi phí</h3>
                
                <div className="space-y-4">
                  {misMetrics.hotspots.length > 0 ? (
                    misMetrics.hotspots.map((h, idx) => (
                      <div key={idx} className="p-6 bg-white/5 border border-white/10 rounded-[2.5rem] hover:bg-white/10 transition-all group">
                        <div className="flex items-center justify-between mb-4">
                          <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl group-hover:scale-110 transition-transform"><AlertTriangle className="w-5 h-5" /></div>
                          <div className="flex items-center gap-2 text-rose-500 font-bold">
                            <ArrowUpRight className="w-4 h-4" />
                            <span className="text-sm">+{formatNumber(h.diff)}đ</span>
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-200 uppercase">{h.category}</h4>
                          <p className="text-[10px] text-slate-400 mt-1 font-bold">Tăng {h.diffPercent.toFixed(1)}% so với kỳ trước</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-10 text-center text-slate-500 italic font-bold">Không có hạng mục tăng bất thường.</div>
                  )}
                </div>

                <div className="mt-10 p-6 bg-indigo-600 rounded-[2.5rem] shadow-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <Sparkles className="w-4 h-4 text-indigo-200" />
                    <span className="text-[10px] font-black uppercase text-indigo-100">AI Financial Recommendation</span>
                  </div>
                  <p className="text-xs text-indigo-50 leading-relaxed font-medium">
                    {misMetrics.hotspots.length > 0 
                      ? `Rà soát ngay ${misMetrics.hotspots[0].category}. Chi phí này đang có dấu hiệu mất kiểm soát ảnh hưởng trực tiếp tới biên lợi nhuận ròng.`
                      : "Sức khỏe dòng tiền ổn định. Hãy duy trì kiểm soát định mức nhân sự để tối ưu hóa EBTIDA."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* DETAILED CATEGORY BREAKDOWN */}
          <div className="bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Cơ cấu chi tiết Chi phí Vận hành</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Danh sách đầy đủ tất cả các nhóm chi phí có phát sinh trong kỳ</p>
              </div>
              <div className="p-3 bg-slate-50 text-slate-400 rounded-2xl"><ListChecks className="w-6 h-6" /></div>
            </div>

            <div className="space-y-6">
              {misMetrics.allCategories.map((cat, idx) => (
                <div key={idx} className="group p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 hover:bg-white hover:shadow-lg transition-all duration-300">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-[250px]">
                      <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 text-xs font-black">
                        {idx + 1}
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-800 uppercase leading-none">{cat.name}</h4>
                        <p className="text-[10px] text-slate-400 font-bold mt-1">Tổng chi: {formatNumber(cat.amount)}đ</p>
                      </div>
                    </div>
                    
                    <div className="flex-1 flex items-center gap-6">
                      <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-500 rounded-full transition-all duration-1000" 
                          style={{ width: `${Math.min(cat.ratio * 3.3, 100)}%` }} // Scaled for visualization (30% max usually)
                        ></div>
                      </div>
                      <div className="text-right min-w-[80px]">
                         <span className="text-base font-black text-slate-900">{cat.ratio.toFixed(1)}%</span>
                         <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">/ Doanh thu</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {misMetrics.allCategories.length === 0 && (
                <div className="py-20 text-center">
                  <div className="inline-block p-6 bg-slate-50 rounded-full mb-4">
                    <ListChecks className="w-10 h-10 text-slate-200" />
                  </div>
                  <p className="text-sm font-bold text-slate-400 italic">Không có phát sinh chi phí vận hành trong kỳ này.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'ledger' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
          {pendingRecurring.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-[2rem] p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-lg animate-pulse"><Bell className="w-5 h-5" /></div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 uppercase">Bạn có {pendingRecurring.length} khoản chi phí định kỳ cần xác nhận</h4>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Các khoản chi này đã đến ngày thanh toán trong tháng này</p>
                </div>
              </div>
              <button 
                onClick={() => setActiveSubTab('recurring')}
                className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg flex items-center gap-2"
              >
                Xem chi tiết <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
            <div className="lg:col-span-4 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 hover:border-rose-400 hover:bg-rose-50/20 transition-all p-10 shadow-sm relative group flex flex-col items-center justify-center text-center">
              {aiSuggestion ? (
                <div className="w-full space-y-4 animate-in zoom-in-95 duration-300">
                   <div className="p-4 bg-rose-100 text-rose-600 rounded-2xl flex flex-col items-center">
                      <Sparkles className="w-6 h-6 mb-2" />
                      <p className="text-[10px] font-black uppercase">AI Gợi ý phân loại 3 cấp</p>
                      <div className="text-center mt-2 space-y-1">
                        <p className="text-[9px] font-bold opacity-60 uppercase">{aiSuggestion.level1Name}</p>
                        <ChevronDown className="w-3 h-3 mx-auto opacity-30" />
                        <p className="text-[10px] font-black uppercase text-rose-500">{aiSuggestion.level2Name}</p>
                        <ChevronDown className="w-3 h-3 mx-auto opacity-30" />
                        <h4 className="text-sm font-bold">"{aiSuggestion.level3Name}"</h4>
                      </div>
                   </div>
                   <button onClick={applyAISuggestion} className="w-full py-3 bg-rose-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg">Áp dụng cấu trúc này</button>
                   <button onClick={() => setAiSuggestion(null)} className="text-[9px] font-black text-slate-400 uppercase">Bỏ qua</button>
                </div>
              ) : (
                <>
                  <input type="file" ref={fileInputRef} className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()} className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center border-2 border-dashed border-slate-200 group-hover:border-rose-300 group-hover:bg-white transition-all shadow-sm mb-6">
                    <Upload className="w-8 h-8 text-rose-600" />
                  </button>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Tải lên hóa đơn chi phí</h3>
                  {isAnalyzing && (
                    <div className="mt-4 flex items-center gap-2 text-rose-500">
                       <Loader2 className="w-4 h-4 animate-spin" />
                       <span className="text-[9px] font-black uppercase">AI Đang phân tích...</span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="lg:col-span-6 bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-200 shadow-xl">
              <h3 className="text-xs font-black text-slate-900 mb-8 flex items-center gap-3">
                <div className="p-2 bg-rose-600 rounded-lg text-white"><Plus className="w-3.5 h-3.5" /></div> 
                NHẬP NHANH CHI PHÍ
              </h3>
              <form onSubmit={handleAddRecord} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <InputWrapper label="Ngày chi" icon={Calendar}><input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="input-field py-3 font-bold text-[10px] border-none" /></InputWrapper>
                  <InputWrapper label="Phân loại" icon={Layers}>
                    <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="input-field py-3 font-bold text-[10px] border-none appearance-none bg-transparent">
                      {parentCategories.map(l1 => (
                        <optgroup key={l1.id} label={l1.name.toUpperCase()}>
                          {categories.filter(c => c.parentId === l1.id).map(l2 => (
                            <React.Fragment key={l2.id}>
                              <option key={l2.id} value={l2.name} className="font-black text-slate-900">
                                {l2.name} (Nhóm)
                              </option>
                              {categories.filter(c => c.parentId === l2.id).map(l3 => (
                                <option key={l3.id} value={l3.name}>&nbsp;&nbsp;&nbsp;• {l3.name}</option>
                              ))}
                            </React.Fragment>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </InputWrapper>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <InputWrapper label="Số tiền" icon={Wallet} color="text-rose-600"><input type="number" required placeholder="0" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="input-field py-3 font-bold text-[10px] border-none" /></InputWrapper>
                  <InputWrapper label="Mô tả" icon={FileText}>
                    <div className="relative flex items-center w-full">
                      <input 
                        type="text" 
                        required 
                        placeholder="Nội dung chi..." 
                        value={formData.description} 
                        onChange={e => setFormData({...formData, description: e.target.value})} 
                        className="input-field py-3 font-bold text-[10px] border-none w-full pr-10" 
                      />
                      <button
                        type="button"
                        onClick={triggerAIAnalysis}
                        disabled={isAnalyzing || formData.description.length < 5}
                        className={`absolute right-2 p-1.5 rounded-lg transition-all ${
                          formData.description.length >= 5 
                            ? 'text-rose-600 hover:bg-rose-50' 
                            : 'text-slate-300 cursor-not-allowed'
                        }`}
                        title="AI Gợi ý phân loại"
                      >
                        {isAnalyzing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </InputWrapper>
                </div>
                <button type="submit" className="w-full bg-slate-900 hover:bg-black text-white py-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl">GHI NHẬN SỔ CÁI</button>
              </form>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-rose-600 text-white rounded-xl shadow-lg"><FileSpreadsheet className="w-5 h-5" /></div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Sổ Cái Chi Phí Đã Lọc</h3>
              </div>
              <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                 <div className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-sm">
                    Dữ liệu: {timeContext.start.split('-').reverse().join('/')} → {timeContext.end.split('-').reverse().join('/')}
                 </div>
                 <button className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 hover:bg-slate-900 hover:text-white rounded-xl font-black text-[9px] uppercase tracking-widest transition-all shadow-sm"><Download className="w-3.5 h-3.5" /> Xuất Báo Cáo</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-white">
                    <th className="px-8 py-6">Ngày tháng</th>
                    <th className="px-8 py-6">Danh mục</th>
                    <th className="px-8 py-6">Nội dung ghi chú</th>
                    <th className="px-8 py-6 text-right">Số tiền (VNĐ)</th>
                    <th className="px-8 py-6 text-center w-[100px]">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-[11px] font-bold tabular-nums">
                  {processedList.length > 0 ? (
                    processedList.map(item => (
                      <tr key={item.id} className="group hover:bg-slate-50 transition-all">
                        <td className="px-8 py-5 text-slate-600">{item.date.split('-').reverse().join('/')}</td>
                        <td className="px-8 py-5"><span className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-xl text-[9px] font-black uppercase border border-rose-100">{item.category}</span></td>
                        <td className="px-8 py-5 text-slate-700">{item.description}</td>
                        <td className="px-8 py-5 text-right font-black text-rose-600 text-sm">{formatNumber(item.amount)}</td>
                        <td className="px-8 py-5 text-center">
                          <button 
                            onClick={() => {
                              if (onUpdateSurgical) {
                                onUpdateSurgical([{ key: 'expenses', item, isDelete: true }]);
                              } else {
                                onUpdate(list.filter(i => i.id !== item.id), item.id);
                              }
                            }} 
                            className="p-2 text-slate-200 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-20 text-center text-slate-400 font-bold uppercase text-xs">Không tìm thấy bản kê chi phí trong kỳ lọc này.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'recurring' && (
        <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
          {/* PENDING CONFIRMATION */}
          <div className="bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-xl">
            <h3 className="text-xl font-black text-slate-900 mb-8 uppercase flex items-center gap-4">
              <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-lg"><Bell className="w-5 h-5" /></div>
              CHI PHÍ CẦN XÁC NHẬN TRONG THÁNG
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pendingRecurring.length > 0 ? (
                pendingRecurring.map(re => (
                  <div key={re.id} className="p-6 bg-amber-50 border border-amber-100 rounded-3xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-all"><Repeat className="w-12 h-12" /></div>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="px-3 py-1 bg-amber-500 text-white rounded-lg text-[9px] font-black uppercase">Ngày {re.dayOfMonth} hàng tháng</span>
                        <h4 className="text-sm font-black text-slate-900 mt-2 uppercase">{re.name}</h4>
                      </div>
                    </div>
                    <div className="space-y-1 mb-6">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Danh mục: {re.category}</p>
                      <p className="text-lg font-black text-slate-900 tabular-nums">{formatNumber(re.amount)}đ</p>
                    </div>
                    <button 
                      onClick={() => handlePostRecurring(re)}
                      className="w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" /> Xác nhận & Ghi sổ
                    </button>
                  </div>
                ))
              ) : (
                <div className="col-span-full py-10 text-center text-slate-400 font-bold uppercase text-xs italic">
                  Tất cả chi phí định kỳ tháng này đã được ghi sổ hoặc chưa đến ngày.
                </div>
              )}
            </div>
          </div>

          {/* MANAGEMENT FORM & LIST */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-xl h-fit">
              <h3 className="text-sm font-black text-slate-900 mb-8 uppercase flex items-center gap-3">
                <div className="p-2 bg-indigo-600 text-white rounded-lg"><Plus className="w-4 h-4" /></div>
                THÊM MẪU CHI PHÍ ĐỊNH KỲ
              </h3>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Tên mẫu chi phí</label>
                  <input type="text" value={recurringForm.name} onChange={e => setRecurringForm({...recurringForm, name: e.target.value})} placeholder="Ví dụ: Tiền thuê mặt bằng" className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Danh mục</label>
                  <select value={recurringForm.category} onChange={e => setRecurringForm({...recurringForm, category: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-100">
                    <option value="">Chọn danh mục...</option>
                    {categories.filter(c => !!c.parentId).map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Số tiền (đ)</label>
                    <input type="number" value={recurringForm.amount || ''} onChange={e => setRecurringForm({...recurringForm, amount: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Ngày trong tháng</label>
                    <input type="number" min="1" max="31" value={recurringForm.dayOfMonth || ''} onChange={e => setRecurringForm({...recurringForm, dayOfMonth: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Ghi chú thêm</label>
                  <textarea value={recurringForm.description} onChange={e => setRecurringForm({...recurringForm, description: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-100 h-20" />
                </div>
                <button 
                  onClick={handleAddRecurring}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" /> Lưu mẫu định kỳ
                </button>
              </div>
            </div>

            <div className="lg:col-span-2 bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-xl">
              <h3 className="text-sm font-black text-slate-900 mb-8 uppercase flex items-center gap-3">
                <div className="p-2 bg-slate-800 text-white rounded-lg"><ListChecks className="w-4 h-4" /></div>
                DANH SÁCH MẪU CHI PHÍ ĐỊNH KỲ
              </h3>
              <div className="space-y-4">
                {recurringExpenses.length > 0 ? (
                  recurringExpenses.map(re => (
                    <div key={re.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-between group">
                      <div className="flex items-center gap-6">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-slate-100">
                          <span className="text-sm font-black">{re.dayOfMonth}</span>
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-900 uppercase">{re.name}</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{re.category} • {formatNumber(re.amount)}đ</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => onUpdateRecurringExpenses(recurringExpenses.map(item => item.id === re.id ? {...item, isActive: !item.isActive} : item))}
                          className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${re.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}
                        >
                          {re.isActive ? 'Đang bật' : 'Đã tắt'}
                        </button>
                        <button onClick={() => handleRemoveRecurring(re.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-all"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-20 text-center text-slate-400 font-bold uppercase text-xs italic">
                    Chưa có mẫu chi phí định kỳ nào được tạo.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {activeSubTab === 'categories' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* COLUMN: FIXED COSTS */}
            <div className="bg-white p-8 rounded-[3.5rem] border border-slate-200 shadow-xl flex flex-col">
              <div className="flex flex-col mb-8">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg"><ShieldAlert className="w-5 h-5" /></div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">Cố Định</h3>
                  </div>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase">Tổng cộng</p>
                    <p className="text-lg font-black text-indigo-600 tabular-nums">{formatNumber(categoryTotals[fixedParent?.id || ''] || 0)}đ</p>
                  </div>
                  <button 
                    onClick={handleSmartScan}
                    disabled={isScanning}
                    className="flex items-center gap-2 px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[8px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all"
                  >
                    {isScanning ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Sparkles className="w-2.5 h-2.5" />}
                    Quét
                  </button>
                </div>
              </div>

              <div className="space-y-6 flex-1 overflow-y-auto no-scrollbar max-h-[500px] pr-1">
                {fixedParent && (
                  <div className="space-y-6">
                    {categories.filter(c => c.parentId === fixedParent.id).map((l2) => (
                      <div key={l2.id} className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                          <div className="flex items-center gap-2">
                            <FolderTree className="w-3 h-3 text-indigo-400" />
                            <span className="text-[9px] font-black text-slate-800 uppercase tracking-wider">{l2.name}</span>
                            <span className="text-[9px] font-black text-indigo-600 ml-2">{formatNumber(categoryTotals[l2.id] || 0)}đ</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => setEditingCategory(l2)} className="p-1 hover:bg-slate-100 rounded text-indigo-600"><Pencil className="w-2.5 h-2.5" /></button>
                            <button onClick={() => handleDeleteCategory(l2.id)} className="p-1 hover:bg-slate-100 rounded text-rose-400"><Trash2 className="w-2.5 h-2.5" /></button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-2 pl-3 border-l-2 border-indigo-50">
                          {categories.filter(c => c.parentId === l2.id).map((l3) => (
                            <div key={l3.id} className="group flex items-center justify-between p-3 bg-slate-50 hover:bg-white hover:shadow-md rounded-xl border border-slate-100 transition-all">
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-600">{l3.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black text-slate-400">{formatNumber(categoryTotals[l3.id] || 0)}đ</span>
                                <button onClick={() => setEditingCategory(l3)} className="p-1 text-slate-200 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-all"><Pencil className="w-3 h-3" /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    <button 
                      onClick={() => setActiveParentId(fixedParent.id)}
                      className="w-full py-3 border-2 border-dashed border-slate-100 rounded-xl text-[9px] font-black text-slate-400 uppercase hover:border-indigo-200 hover:text-indigo-600 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-3 h-3" /> Thêm nhóm
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* COLUMN: VARIABLE COSTS */}
            <div className="bg-white p-8 rounded-[3.5rem] border border-slate-200 shadow-xl flex flex-col">
              <div className="flex flex-col mb-8">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-lg"><Activity className="w-5 h-5" /></div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">Biến Đổi</h3>
                  </div>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase">Tổng cộng</p>
                    <p className="text-lg font-black text-amber-600 tabular-nums">{formatNumber(categoryTotals[variableParent?.id || ''] || 0)}đ</p>
                  </div>
                  <button 
                    onClick={handleSmartScan}
                    disabled={isScanning}
                    className="flex items-center gap-2 px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-[8px] font-black uppercase hover:bg-amber-600 hover:text-white transition-all"
                  >
                    {isScanning ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Sparkles className="w-2.5 h-2.5" />}
                    Quét
                  </button>
                </div>
              </div>

              <div className="space-y-6 flex-1 overflow-y-auto no-scrollbar max-h-[500px] pr-1">
                {variableParent && (
                  <div className="space-y-6">
                    {categories.filter(c => c.parentId === variableParent.id).map((l2) => (
                      <div key={l2.id} className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                          <div className="flex items-center gap-2">
                            <FolderTree className="w-3 h-3 text-amber-400" />
                            <span className="text-[9px] font-black text-slate-800 uppercase tracking-wider">{l2.name}</span>
                            <span className="text-[9px] font-black text-amber-600 ml-2">{formatNumber(categoryTotals[l2.id] || 0)}đ</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => setEditingCategory(l2)} className="p-1 hover:bg-slate-100 rounded text-amber-600"><Pencil className="w-2.5 h-2.5" /></button>
                            <button onClick={() => handleDeleteCategory(l2.id)} className="p-1 hover:bg-slate-100 rounded text-rose-400"><Trash2 className="w-2.5 h-2.5" /></button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-2 pl-3 border-l-2 border-amber-50">
                          {categories.filter(c => c.parentId === l2.id).map((l3) => (
                            <div key={l3.id} className="group flex items-center justify-between p-3 bg-slate-50 hover:bg-white hover:shadow-md rounded-xl border border-slate-100 transition-all">
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-600">{l3.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black text-slate-400">{formatNumber(categoryTotals[l3.id] || 0)}đ</span>
                                <button onClick={() => setEditingCategory(l3)} className="p-1 text-slate-200 hover:text-amber-500 opacity-0 group-hover:opacity-100 transition-all"><Pencil className="w-3 h-3" /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    <button 
                      onClick={() => setActiveParentId(variableParent.id)}
                      className="w-full py-3 border-2 border-dashed border-slate-100 rounded-xl text-[9px] font-black text-slate-400 uppercase hover:border-amber-200 hover:text-amber-600 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-3 h-3" /> Thêm nhóm
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* COLUMN: DEPRECIATION COSTS */}
            <div className="bg-white p-8 rounded-[3.5rem] border border-slate-200 shadow-xl flex flex-col">
              <div className="flex flex-col mb-8">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-lg"><History className="w-5 h-5" /></div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">Khấu Hao</h3>
                  </div>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase">Tổng cộng</p>
                    <p className="text-lg font-black text-emerald-600 tabular-nums">{formatNumber(categoryTotals[depreciationParent?.id || ''] || 0)}đ</p>
                  </div>
                </div>
              </div>

              <div className="space-y-6 flex-1 overflow-y-auto no-scrollbar max-h-[500px] pr-1">
                {depreciationParent && (
                  <div className="space-y-6">
                    {categories.filter(c => c.parentId === depreciationParent.id).map((l2) => (
                      <div key={l2.id} className="group flex items-center justify-between p-4 bg-slate-50 hover:bg-white hover:shadow-md rounded-2xl border border-slate-100 transition-all">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-600">{l2.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black text-slate-400">{formatNumber(categoryTotals[l2.id] || 0)}đ</span>
                          <button onClick={() => setEditingCategory(l2)} className="p-1.5 text-slate-200 hover:text-emerald-500 opacity-0 group-hover:opacity-100 transition-all"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteCategory(l2.id)} className="p-1.5 text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    ))}
                    <button 
                      onClick={() => setActiveParentId(depreciationParent.id)}
                      className="w-full py-3 border-2 border-dashed border-slate-100 rounded-xl text-[9px] font-black text-slate-400 uppercase hover:border-emerald-200 hover:text-emerald-600 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-3 h-3" /> Thêm mục
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* COLUMN: INTEREST COSTS */}
            <div className="bg-white p-8 rounded-[3.5rem] border border-slate-200 shadow-xl flex flex-col">
              <div className="flex flex-col mb-8">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-rose-600 text-white rounded-2xl shadow-lg"><TrendingDown className="w-5 h-5" /></div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">Lãi Vay</h3>
                  </div>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase">Tổng cộng</p>
                    <p className="text-lg font-black text-rose-600 tabular-nums">{formatNumber(categoryTotals[interestParent?.id || ''] || 0)}đ</p>
                  </div>
                </div>
              </div>

              <div className="space-y-6 flex-1 overflow-y-auto no-scrollbar max-h-[500px] pr-1">
                {interestParent && (
                  <div className="space-y-6">
                    {categories.filter(c => c.parentId === interestParent.id).map((l2) => (
                      <div key={l2.id} className="group flex items-center justify-between p-4 bg-slate-50 hover:bg-white hover:shadow-md rounded-2xl border border-slate-100 transition-all">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-600">{l2.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black text-slate-400">{formatNumber(categoryTotals[l2.id] || 0)}đ</span>
                          <button onClick={() => setEditingCategory(l2)} className="p-1.5 text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteCategory(l2.id)} className="p-1.5 text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    ))}
                    <button 
                      onClick={() => setActiveParentId(interestParent.id)}
                      className="w-full py-3 border-2 border-dashed border-slate-100 rounded-xl text-[9px] font-black text-slate-400 uppercase hover:border-rose-200 hover:text-rose-600 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-3 h-3" /> Thêm mục
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* OTHER CATEGORIES */}
          {otherParents.length > 0 && (
            <div className="bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-xl">
              <h3 className="text-sm font-black text-slate-900 mb-8 uppercase flex items-center gap-3">
                <div className="p-2 bg-slate-800 text-white rounded-lg"><LayoutGrid className="w-4 h-4" /></div>
                CÁC NHÓM CHI PHÍ KHÁC
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {otherParents.map(parent => (
                  <div key={parent.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 group relative">
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-xs font-black text-slate-800 uppercase">{parent.name}</span>
                      <div className="flex gap-1">
                        <button onClick={() => setEditingCategory(parent)} className="p-1.5 bg-white text-indigo-600 rounded-lg shadow-sm"><Pencil className="w-3 h-3" /></button>
                        <button onClick={() => handleDeleteCategory(parent.id)} className="p-1.5 bg-white text-rose-500 rounded-lg shadow-sm"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {categories.filter(c => c.parentId === parent.id).map(child => (
                        <div key={child.id} className="flex justify-between items-center text-[10px] font-bold text-slate-500 group/child">
                          <span>{child.name}</span>
                          <div className="flex items-center gap-2">
                            <span>{formatNumber(categoryTotals[child.id] || 0)}đ</span>
                            <button onClick={() => setEditingCategory(child)} className="opacity-0 group-hover/child:opacity-100 p-1 hover:bg-white rounded transition-all"><Pencil className="w-2.5 h-2.5 text-indigo-400" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={() => setIsAddingParentAtBottom(true)} className="p-8 rounded-[2.5rem] border-4 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 text-slate-400 hover:text-indigo-600 transition-all flex flex-col items-center justify-center gap-4 w-full font-black uppercase tracking-widest text-[10px]">
            <Plus className="w-8 h-8" /> THÊM NHÓM CHI PHÍ CHA MỚI
          </button>
        </div>
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

const MetricCard = ({ title, value, icon: Icon, color, desc }: any) => {
  const colorMap: any = {
    rose: 'bg-rose-50 text-rose-600',
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    indigo: 'bg-indigo-50 text-indigo-600',
  };
  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col justify-between transition-all hover:-translate-y-1">
      <div>
        <div className={`p-4 rounded-2xl ${colorMap[color] || 'bg-slate-50 text-slate-600'} w-fit mb-6 shadow-sm`}><Icon className="w-6 h-6" /></div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
        <h4 className="text-xl font-black text-slate-900 tabular-nums">{value}</h4>
      </div>
      {desc && <p className="text-[9px] text-slate-400 font-bold mt-4 pt-4 border-t border-slate-50 uppercase tracking-tighter">{desc}</p>}
    </div>
  );
};

const InputWrapper = ({ label, icon: Icon, children, color = "text-slate-400" }: any) => (
  <div className="space-y-1.5">
    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
    <div className="relative bg-slate-50 border border-slate-100 focus-within:bg-white focus-within:border-blue-500 rounded-xl transition-all shadow-inner overflow-hidden flex items-center">
      <Icon className={`absolute left-3 w-3.5 h-3.5 ${color}`} />
      <div className="pl-9 w-full">{children}</div>
    </div>
  </div>
);

export default ExpenseManager;
