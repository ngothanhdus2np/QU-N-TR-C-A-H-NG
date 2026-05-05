
import React, { useState, useEffect, useRef } from 'react';
import { KnowledgeBaseArticle, AppData, SalaryPolicy, Holiday, ViolationType, ViolationOccurrence, TetCampaign } from '../types';
import { 
  Plus, Search, Library, FileText, ChevronRight, X, Save, 
  Trash2, BookOpen, Edit, Settings, Layers, CalendarCheck, 
  Sparkles, ShieldCheck as ResponsibilityIcon, PartyPopper, Gift,
  CalendarCheck as DateIcon, Flame, Gavel, Info, TrendingUp,
  HeartHandshake, Home, Utensils, BadgeCheck, Timer, UploadCloud, Loader2,
  Coffee, Shield, Banknote, Bus, Candy, CalendarDays, CheckCircle2, AlertTriangle, RefreshCw,
  Workflow, FileSearch, FileDown, Upload
} from 'lucide-react';
import { marked } from 'marked';
import { GoogleGenAI } from "@google/genai";

interface Props {
  data: AppData;
  onUpdateData: (key: keyof AppData, newList: any, idToRemove?: string) => void;
}

const KnowledgeManager: React.FC<Props> = ({ data, onUpdateData }) => {
  const [activeMainTab, setActiveMainTab] = useState<'mechanisms' | 'standards' | 'workflows'>('mechanisms');
  const [activeMechSubTab, setActiveMechSubTab] = useState<'salary' | 'holidays' | 'tet' | 'violations'>('salary');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Tất cả');
  const [isEditing, setIsEditing] = useState(false);
  const [currentArticle, setCurrentArticle] = useState<Partial<KnowledgeBaseArticle> | null>(null);
  const [viewArticle, setViewArticle] = useState<KnowledgeBaseArticle | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI Suggestion State from Document
  const [aiDocSuggestion, setAiDocSuggestion] = useState<Partial<KnowledgeBaseArticle> | null>(null);

  // Local state for violations to prevent sync lag
  const [localViolations, setLocalViolations] = useState<ViolationType[]>([]);
  const [hasUnsavedViolations, setHasUnsavedViolations] = useState(false);

  const list = data.knowledgeBase || [];
  const policies = data.salaryPolicies || [];
  const holidays = data.holidays || [];
  const violationTypes = data.violationTypes || [];
  const tet = data.tetCampaign || { 
    commitmentDate: '', carAllowance: 1000000, beforeTetExtraDays: [], beforeTetExtraBonus: 500000, 
    afterTetDate: '', lixiBonus: 200000, afterTetExtraDays: [], afterTetExtraBonus: 300000,
    date28Tet: '', date29Tet: '', date30Tet: '', bonus29Tet: 500000, bonus30Tet: 500000
  };

  useEffect(() => {
    setLocalViolations(violationTypes);
    setHasUnsavedViolations(false);
  }, [violationTypes]);

  const categories = ['Nhân sự', 'Vận hành', 'Bán hàng', 'Tài chính', 'Khác'];

  const filteredList = list.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Tất cả' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const [policyForm, setPolicyForm] = useState<Partial<SalaryPolicy>>({});

  useEffect(() => {
    if (selectedPolicyId) {
      const p = policies.find(p => p.id === selectedPolicyId);
      if (p) setPolicyForm(p);
    } else {
      setPolicyForm({});
    }
  }, [selectedPolicyId, policies]);

  const handleUpdateLocalViolation = (id: string, field: keyof ViolationType, value: string) => {
    setLocalViolations(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v));
    setHasUnsavedViolations(true);
  };

  const handleAddLocalViolation = () => {
    const newViolation: ViolationType = { id: crypto.randomUUID(), name: '', fine1: '', fine2: '', fine3: '' };
    setLocalViolations(prev => [...prev, newViolation]);
    setHasUnsavedViolations(true);
  };

  const handleRemoveLocalViolation = (id: string) => {
    setLocalViolations(prev => prev.filter(v => v.id !== id));
    setHasUnsavedViolations(true);
  };

  const saveViolationsToCloud = () => {
    onUpdateData('violationTypes', localViolations);
    setHasUnsavedViolations(false);
    alert("Đã lưu cấu hình khấu trừ lên Cloud!");
  };

  const handleSavePolicy = () => {
    if (!selectedPolicyId) return;
    onUpdateData('salaryPolicies', policies.map(p => p.id === selectedPolicyId ? { ...p, ...policyForm } as SalaryPolicy : p));
    alert("Đã cập nhật cơ chế nhóm lương!");
  };

  const handleRemovePolicy = (id: string) => {
    if (confirm("Xác nhận xóa nhóm lương?")) {
      onUpdateData('salaryPolicies', policies.filter(p => p.id !== id), id);
      if (selectedPolicyId === id) setSelectedPolicyId(null);
    }
  };

  const handleAddNewPolicy = () => {
    const newPolicy: SalaryPolicy = {
      id: `POL-${Date.now()}`, name: 'Nhóm mới', salaryType: 'monthly', baseSalary: 0, startThreshold: 0, endThreshold: 0, 
      otRate: 0, commissionRate: 0, seniorityBonusPerYear: 0, attendanceAllowance: 0, cleaningAllowance: 0,
      customerServiceAllowance: 0, dinnerAllowance: 0, housingAllowance: 0, responsibilityAllowance: 0,
      isProRated: false
    };
    onUpdateData('salaryPolicies', [...policies, newPolicy]);
    setSelectedPolicyId(newPolicy.id);
  };

  const addTetExtraDay = (type: 'before' | 'after', date: string) => {
    if (!date) return;
    const key = type === 'before' ? 'beforeTetExtraDays' : 'afterTetExtraDays';
    const currentDays = tet[key] || [];
    if (currentDays.includes(date)) return;
    onUpdateData('tetCampaign', { ...tet, [key]: [...currentDays, date].sort() });
  };

  const removeTetExtraDay = (type: 'before' | 'after', date: string) => {
    const key = type === 'before' ? 'beforeTetExtraDays' : 'afterTetExtraDays';
    onUpdateData('tetCampaign', { ...tet, [key]: (tet[key] || []).filter((d: string) => d !== date) });
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      const base64Data = event.target?.result as string;
      const pureBase64 = base64Data.split(',')[1];
      const mimeType = file.type || 'application/octet-stream';

      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const model = 'gemini-3-flash-preview';

        const prompt = `
          BẠN LÀ: Chuyên gia Hệ thống Quản lý (MIS) và Kế toán trưởng.
          NHIỆM VỤ: Đọc tài liệu đính kèm (có thể là thông báo, quy trình, hoặc văn bản ký tên).
          YÊU CẦU:
          1. Trích xuất toàn bộ nội dung quan trọng và chuyển thành định dạng Markdown chuyên nghiệp.
          2. Đặt tiêu đề (Title) súc tích cho tài liệu này.
          3. Phân loại tài liệu vào 1 trong các nhóm: Nhân sự, Vận hành, Bán hàng, Tài chính, Khác.
          4. TRẢ VỀ JSON: {"title": "Tiêu đề", "category": "Nhóm", "content": "Nội dung Markdown chi tiết"}
        `;

        const response = await ai.models.generateContent({
          model: model,
          contents: [
            {
              parts: [
                { inlineData: { data: pureBase64, mimeType: mimeType } },
                { text: prompt }
              ]
            }
          ],
          config: { responseMimeType: "application/json" }
        });

        const result = JSON.parse(response.text || "{}");
        if (result.content) {
          setAiDocSuggestion({
            ...result,
            sourceFileName: file.name,
            sourceFileData: base64Data,
            sourceFileType: mimeType
          });
        }
      } catch (err) {
        console.error("AI Document Parsing Error:", err);
        alert("AI không thể đọc tệp này. Vui lòng thử lại với định dạng hình ảnh hoặc PDF rõ nét hơn.");
      } finally {
        setIsParsing(false);
        if (e.target) e.target.value = '';
      }
    };

    reader.readAsDataURL(file);
  };

  const applyAiDocSuggestion = () => {
    if (!aiDocSuggestion) return;
    const newArticle: KnowledgeBaseArticle = {
      id: crypto.randomUUID(),
      category: (aiDocSuggestion.category as any) || 'Khác',
      title: aiDocSuggestion.title || 'Tài liệu mới',
      content: aiDocSuggestion.content || '',
      updatedAt: new Date().toISOString(),
      sourceFileName: aiDocSuggestion.sourceFileName,
      sourceFileData: aiDocSuggestion.sourceFileData,
      sourceFileType: aiDocSuggestion.sourceFileType
    };
    onUpdateData('knowledgeBase', [newArticle, ...list]);
    setAiDocSuggestion(null);
    alert("Đã số hóa tài liệu thành Quy chuẩn thành công!");
  };

  return (
    <div className="space-y-8 pb-20 max-w-7xl mx-auto animate-in fade-in duration-700">
      <div className="bg-slate-900 rounded-[3.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl -z-0"></div>
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center shadow-2xl ring-4 ring-indigo-500/20">
              <Library className="w-10 h-10 text-white" />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">Quy Chuẩn & Chính Sách</h2>
              <p className="text-indigo-300 text-sm font-bold uppercase tracking-widest mt-1">Hệ cơ chế vận hành chính xác 100%</p>
            </div>
          </div>
          <div className="flex bg-white/10 p-1.5 rounded-2xl border border-white/5">
             <button onClick={() => setActiveMainTab('mechanisms')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeMainTab === 'mechanisms' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400 hover:text-white'}`}>Cơ chế</button>
             <button onClick={() => setActiveMainTab('standards')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeMainTab === 'standards' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400 hover:text-white'}`}>Quy chuẩn</button>
             <button onClick={() => setActiveMainTab('workflows')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeMainTab === 'workflows' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400 hover:text-white'}`}>Quy trình</button>
          </div>
        </div>
      </div>

      {activeMainTab === 'mechanisms' && (
        <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex bg-slate-100 p-1 rounded-2xl w-fit mx-auto border border-slate-200">
             <button onClick={() => setActiveMechSubTab('salary')} className={`px-6 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${activeMechSubTab === 'salary' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400'}`}>Nhóm Lương</button>
             <button onClick={() => setActiveMechSubTab('holidays')} className={`px-6 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${activeMechSubTab === 'holidays' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400'}`}>Ngày Lễ</button>
             <button onClick={() => setActiveMechSubTab('tet')} className={`px-6 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${activeMechSubTab === 'tet' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400'}`}>Thưởng Tết</button>
             <button onClick={() => setActiveMechSubTab('violations')} className={`px-6 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${activeMechSubTab === 'violations' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400'}`}>Khấu Trừ</button>
          </div>

          {activeMechSubTab === 'salary' && (
            <div className="space-y-12">
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20">
                 {policies.map(p => {
                    const totalFixedIncome = (p.baseSalary || 0) + (p.attendanceAllowance || 0) + (p.cleaningAllowance || 0) + (p.customerServiceAllowance || 0) + (p.housingAllowance || 0) + (p.responsibilityAllowance || 0);
                    return (
                   <div key={p.id} onClick={() => { setSelectedPolicyId(p.id); setTimeout(() => document.getElementById('policy-editor')?.scrollIntoView({ behavior: 'smooth' }), 100); }} className={`group p-8 rounded-[3.5rem] border-2 transition-all duration-500 h-[880px] cursor-pointer relative overflow-hidden flex flex-col ${selectedPolicyId === p.id ? 'bg-white border-indigo-600 shadow-2xl ring-8 ring-indigo-50 translate-y-[-8px]' : 'bg-white border-slate-100 shadow-lg hover:border-slate-200'}`}>
                    <div className="flex items-start justify-between mb-8 relative z-10">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl ${selectedPolicyId === p.id ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'}`}><Layers className="w-8 h-8" /></div>
                      <div className="text-right">
                        <span className="block px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-black uppercase tracking-widest mb-1">{p.salaryType === 'monthly' ? 'Lương Tháng' : 'Lương Ngày'}</span>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">ID: {p.id}</span>
                      </div>
                    </div>
                    <h4 className="font-black text-xl mb-4 text-slate-900 uppercase tracking-tight break-words">{p.name}</h4>
                    
                    <div className="p-5 bg-indigo-600 rounded-[2rem] mb-6 shadow-xl shadow-indigo-200 border border-indigo-500 group-hover:scale-[1.02] transition-transform">
                       <div className="flex items-center gap-2 mb-1">
                          <Banknote className="w-4 h-4 text-indigo-200" />
                          <p className="text-[9px] font-black text-indigo-100 uppercase tracking-widest">Gói thu nhập cố định</p>
                       </div>
                       <p className="text-2xl font-black text-white tabular-nums">{totalFixedIncome.toLocaleString()}đ</p>
                       <p className="text-[8px] text-indigo-200 font-bold uppercase mt-1 italic">* Chưa gồm Hoa hồng, Ăn tối, OT</p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl mb-6 border border-slate-100/50">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Timer className="w-3 h-3" /> Khoảng thâm niên nhảy bậc</p>
                       <div className="flex items-center gap-4">
                          <div className="flex-1">
                             <p className="text-[8px] font-bold text-slate-400 uppercase">Bắt đầu</p>
                             <p className="text-sm font-black text-indigo-700">{p.startThreshold} ngày</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-indigo-300" />
                          <div className="flex-1">
                             <p className="text-[8px] font-bold text-slate-400 uppercase">Kết thúc</p>
                             <p className="text-sm font-black text-indigo-700">{p.endThreshold === 0 ? '∞ (Vô cực)' : `${p.endThreshold} ngày`}</p>
                          </div>
                       </div>
                    </div>

                    <div className="space-y-4 flex-1">
                      <div className="flex justify-between items-center"><span className="text-[10px] text-slate-400 font-black uppercase">Lương Cơ Bản</span><span className="text-lg font-black text-slate-900 tabular-nums">{(p.baseSalary || 0).toLocaleString()}đ</span></div>
                      
                      <div className="space-y-2 mt-4">
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">CHI TIẾT PHỤ CẤP</p>
                         <AllowanceRow icon={CalendarCheck} label="Chuyên cần" value={p.attendanceAllowance} />
                         <AllowanceRow icon={Sparkles} label="Vệ sinh" value={p.cleaningAllowance} />
                         <AllowanceRow icon={HeartHandshake} label="CSKH" value={p.customerServiceAllowance} />
                         <AllowanceRow icon={Utensils} label="Ăn tối (ngày)" value={p.dinnerAllowance} />
                         <AllowanceRow icon={Home} label="Hỗ trợ ở" value={p.housingAllowance} />
                         <AllowanceRow icon={Shield} label="Trách nhiệm" value={p.responsibilityAllowance} color="text-indigo-500" />
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-6 border-t border-slate-50 mt-auto">
                         <div><p className="text-[8px] font-black text-emerald-500 uppercase">Hoa Hồng</p><p className="text-sm font-black">{(p.commissionRate || 0)}%</p></div>
                         <div><p className="text-[8px] font-black text-amber-500 uppercase">Đơn giá OT</p><p className="text-sm font-black">{(p.otRate || 0).toLocaleString()}đ</p></div>
                      </div>
                    </div>
                    <div className="mt-6 flex justify-between items-center pt-6 border-t border-slate-50">
                       <button onClick={(e) => { e.stopPropagation(); handleRemovePolicy(p.id); }} className="p-3 text-slate-300 hover:text-rose-500 transition-all"><Trash2 className="w-5 h-5" /></button>
                       <div className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-2xl text-[10px] font-black uppercase group-hover:bg-indigo-600 group-hover:text-white transition-all">Sửa Cơ Chế</div>
                    </div>
                   </div>
                 )})}
                 <button onClick={handleAddNewPolicy} className="p-10 rounded-[3.5rem] border-4 border-dashed border-slate-200 hover:border-indigo-400 text-slate-400 flex flex-col items-center justify-center gap-6 h-[880px] transition-all"><Plus className="w-16 h-16" /><span className="text-[12px] font-black uppercase tracking-widest">Thêm Nhóm Lương</span></button>
               </div>
               
               {selectedPolicyId && (
                 <div id="policy-editor" className="bg-white rounded-[3.5rem] border border-slate-200 shadow-2xl p-10 space-y-12 animate-in slide-in-from-top-4 duration-500 scroll-mt-20">
                    <div className="flex items-center justify-between border-b border-slate-50 pb-8">
                       <div className="flex items-center gap-5">
                          <div className="p-4 bg-indigo-600 text-white rounded-3xl shadow-xl"><Settings className="w-8 h-8" /></div>
                          <div><h4 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Cấu hình: {policyForm.name}</h4><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Chỉnh sửa điều kiện nhảy bậc và phụ cấp</p></div>
                       </div>
                       <div className="flex gap-4">
                          <button onClick={() => setSelectedPolicyId(null)} className="px-8 py-5 rounded-2xl font-black text-xs text-slate-400 uppercase">Hủy bỏ</button>
                          <button onClick={handleSavePolicy} className="bg-indigo-600 text-white px-12 py-5 rounded-2xl font-black text-xs shadow-xl flex items-center gap-4 uppercase tracking-widest hover:bg-black transition-all"><Save className="w-6 h-6" /> Lưu Cơ Chế</button>
                       </div>
                    </div>
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-16">
                      <div className="xl:col-span-2 space-y-12">
                        <div className="p-8 bg-indigo-50 rounded-[2.5rem] border border-indigo-100 space-y-8">
                           <div className="flex items-center gap-3 border-b border-indigo-200 pb-4"><Timer className="w-6 h-6 text-indigo-600" /><h5 className="text-[12px] font-black text-indigo-900 uppercase tracking-widest">ĐIỀU KIỆN THỜI GIAN (NHẢY BẬC TỰ ĐỘNG)</h5></div>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                              <div className="space-y-4">
                                 <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Mốc Bắt Đầu (Ngày công tác)</label>
                                 <div className="relative">
                                    <input type="number" value={policyForm.startThreshold || 0} onChange={(e) => setPolicyForm({...policyForm, startThreshold: Number(e.target.value)})} className="w-full px-8 py-5 bg-white border-2 border-indigo-200 rounded-[2rem] text-xl font-black text-indigo-900 outline-none focus:border-indigo-500 transition-all shadow-inner" />
                                    <span className="absolute right-8 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 uppercase tracking-widest">Ngày</span>
                                 </div>
                              </div>
                              <div className="space-y-4">
                                 <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Mốc Kết Thúc (0 = Vô cực)</label>
                                 <div className="relative">
                                    <input type="number" value={policyForm.endThreshold || 0} onChange={(e) => setPolicyForm({...policyForm, endThreshold: Number(e.target.value)})} className="w-full px-8 py-5 bg-white border-2 border-indigo-200 rounded-[2rem] text-xl font-black text-indigo-900 outline-none focus:border-indigo-500 transition-all shadow-inner" />
                                    <div className="absolute right-8 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                       {policyForm.endThreshold === 0 && <span className="text-2xl font-black text-indigo-400">∞</span>}
                                       <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{policyForm.endThreshold === 0 ? 'TRỞ ĐI' : 'NGÀY'}</span>
                                    </div>
                                 </div>
                              </div>
                           </div>
                           <div className="flex items-start gap-4 p-4 bg-indigo-100/50 rounded-2xl border border-indigo-200/50">
                              <Info className="w-5 h-5 text-indigo-600 mt-1" />
                              <p className="text-[11px] text-indigo-800 font-medium leading-relaxed italic">Gợi ý: Hệ thống sẽ tự động gán bậc lương dựa trên số ngày nhân viên đã làm việc. Nếu mốc Kết thúc là 0, bậc này sẽ kéo dài mãi mãi cho đến khi có bậc cao hơn.</p>
                           </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                           <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên Nhóm</label><input type="text" value={policyForm.name || ''} onChange={e => setPolicyForm({...policyForm, name: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-base font-bold outline-none" /></div>
                           <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lương Gốc (đ)</label><input type="number" value={policyForm.baseSalary || 0} onChange={e => setPolicyForm({...policyForm, baseSalary: Number(e.target.value)})} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-base font-bold outline-none" /></div>
                           <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Đơn giá OT (đ/h)</label><input type="number" value={policyForm.otRate || 0} onChange={e => setPolicyForm({...policyForm, otRate: Number(e.target.value)})} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-base font-bold outline-none" /></div>
                           <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hoa Hồng (%)</label><input type="number" value={policyForm.commissionRate || 0} onChange={e => setPolicyForm({...policyForm, commissionRate: Number(e.target.value)})} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-base font-bold outline-none" /></div>
                        </div>
                      </div>
                      <div className="space-y-8 bg-slate-50 p-8 rounded-[3rem] border border-slate-100 shadow-inner">
                         <div className="flex items-center gap-3 border-b border-slate-200 pb-4"><Sparkles className="w-6 h-6 text-emerald-500" /><h5 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Phụ cấp Cố định</h5></div>
                         <div className="space-y-5">
                            <AllowanceInput icon={CalendarCheck} label="Chuyên cần" value={policyForm.attendanceAllowance} onChange={(v: number) => setPolicyForm({...policyForm, attendanceAllowance: v})} />
                            <AllowanceInput icon={Sparkles} label="Vệ sinh" value={policyForm.cleaningAllowance} onChange={(v: number) => setPolicyForm({...policyForm, cleaningAllowance: v})} />
                            <AllowanceInput icon={HeartHandshake} label="CSKH" value={policyForm.customerServiceAllowance} onChange={(v: number) => setPolicyForm({...policyForm, customerServiceAllowance: v})} />
                            <AllowanceInput icon={Utensils} label="Ăn tối" value={policyForm.dinnerAllowance} onChange={(v: number) => setPolicyForm({...policyForm, dinnerAllowance: v})} />
                            <AllowanceInput icon={Home} label="Hỗ trợ Ở" value={policyForm.housingAllowance} onChange={(v: number) => setPolicyForm({...policyForm, housingAllowance: v})} />
                            <AllowanceInput icon={ResponsibilityIcon} label="Trách nhiệm" value={policyForm.responsibilityAllowance} onChange={(v: number) => setPolicyForm({...policyForm, responsibilityAllowance: v})} color="text-rose-500" />
                         </div>
                      </div>
                    </div>
                 </div>
               )}
            </div>
          )}

          {activeMechSubTab === 'holidays' && (
            <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl max-w-4xl mx-auto">
               <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                     <div className="p-3 bg-rose-500 text-white rounded-2xl shadow-lg"><DateIcon className="w-6 h-6" /></div>
                     <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight">Ngày Lễ (x2 Lương)</h4>
                  </div>
                  <button onClick={() => onUpdateData('holidays', [...holidays, { id: crypto.randomUUID(), date: '01-01', name: 'Mới' }])} className="p-3 bg-slate-900 text-white rounded-xl shadow-lg"><Plus className="w-5 h-5" /></button>
               </div>
               <div className="space-y-4">
                  {holidays.map(h => (
                    <div key={h.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                       <input type="text" value={h.date} placeholder="MM-DD" onChange={(e) => onUpdateData('holidays', holidays.map(item => item.id === h.id ? { ...item, date: e.target.value } : item))} className="w-24 px-4 py-2 bg-white border border-slate-200 rounded-xl font-black text-xs text-center outline-none focus:border-indigo-500" />
                       <input type="text" value={h.name} placeholder="Tên ngày lễ..." onChange={(e) => onUpdateData('holidays', holidays.map(item => item.id === h.id ? { ...item, name: e.target.value } : item))} className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-500" />
                       <button onClick={() => onUpdateData('holidays', holidays.filter(item => item.id !== h.id))} className="p-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
               </div>
            </div>
          )}
          
          {activeMechSubTab === 'violations' && (
            <div className="bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-xl max-w-6xl mx-auto space-y-10">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                     <div className="p-3 bg-rose-600 text-white rounded-2xl shadow-lg"><Gavel className="w-6 h-6" /></div>
                     <div>
                        <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight">Ma trận Kỷ luật & Khấu trừ</h4>
                        {hasUnsavedViolations && (
                          <span className="flex items-center gap-1.5 text-rose-500 font-bold text-[10px] uppercase mt-1 animate-pulse">
                            <AlertTriangle className="w-3 h-3" /> Có thay đổi chưa lưu
                          </span>
                        )}
                     </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={handleAddLocalViolation} className="px-6 py-3 bg-slate-100 text-slate-900 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-slate-200 transition-all"><Plus className="w-4 h-4" /> Thêm lỗi mới</button>
                    <button 
                      onClick={saveViolationsToCloud} 
                      disabled={!hasUnsavedViolations}
                      className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center gap-2 transition-all ${hasUnsavedViolations ? 'bg-indigo-600 text-white hover:bg-black' : 'bg-slate-50 text-slate-300 cursor-not-allowed'}`}
                    >
                      <Save className="w-4 h-4" /> Lưu cấu hình
                    </button>
                  </div>
               </div>
               <div className="overflow-x-auto rounded-3xl border border-slate-100">
                  <table className="w-full text-left border-collapse">
                     <thead>
                        <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest"><th className="px-6 py-5">Lỗi vi phạm</th><th className="px-6 py-5">Lần 1</th><th className="px-6 py-5">Lần 2</th><th className="px-6 py-5">Lần 3</th><th className="px-6 py-5 text-center">Xóa</th></tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50">
                        {localViolations.map(v => (
                           <tr key={v.id} className="hover:bg-slate-50/50">
                              <td className="px-6 py-4 align-top">
                                <textarea 
                                  value={v.name} 
                                  onChange={(e) => handleUpdateLocalViolation(v.id, 'name', e.target.value)}
                                  className="w-full bg-transparent border-none outline-none font-black text-xs resize-none overflow-hidden min-h-[40px]" 
                                  rows={2}
                                  onInput={(e: any) => {
                                    e.target.style.height = 'auto';
                                    e.target.style.height = e.target.scrollHeight + 'px';
                                  }}
                                />
                              </td>
                              <td className="px-6 py-4 align-top">
                                <input type="text" value={v.fine1} onChange={(e) => handleUpdateLocalViolation(v.id, 'fine1', e.target.value)} className="w-full bg-transparent border-none outline-none text-xs" placeholder="VD: Nhắc nhở" />
                              </td>
                              <td className="px-6 py-4 align-top">
                                <input type="text" value={v.fine2} onChange={(e) => handleUpdateLocalViolation(v.id, 'fine2', e.target.value)} className="w-full bg-transparent border-none outline-none text-xs" placeholder="VD: 50.000đ" />
                              </td>
                              <td className="px-6 py-4 align-top">
                                <input type="text" value={v.fine3} onChange={(e) => handleUpdateLocalViolation(v.id, 'fine3', e.target.value)} className="w-full bg-transparent border-none outline-none text-xs" placeholder="VD: Mất phụ cấp" />
                              </td>
                              <td className="px-6 py-4 text-center align-top">
                                <button onClick={() => handleRemoveLocalViolation(v.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-all"><Trash2 className="w-4 h-4" /></button>
                              </td>
                           </tr>
                        ))}
                        {localViolations.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-slate-400 italic font-bold">Chưa có danh mục khấu trừ. Bấm "Thêm lỗi mới" để bắt đầu.</td>
                          </tr>
                        )}
                     </tbody>
                  </table>
               </div>
            </div>
          )}

          {activeMechSubTab === 'tet' && (
            <div className="space-y-8 max-w-5xl mx-auto">
              <div className="bg-white p-10 rounded-[3.5rem] border border-amber-200 shadow-xl space-y-10 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5"><Bus className="w-48 h-48 text-amber-600" /></div>
                <div className="flex items-center gap-5">
                   <div className="p-4 bg-amber-500 text-white rounded-3xl shadow-lg shadow-amber-200"><Bus className="w-8 h-8" /></div>
                   <div>
                      <h4 className="text-2xl font-black text-slate-900 uppercase tracking-tight">GIAI ĐOẠN 1: TRƯỚC TẾT (PHÚC LỢI CAM KẾT)</h4>
                      <p className="text-[10px] text-amber-600 font-bold uppercase tracking-widest mt-1">Đảm bảo nhân sự phục vụ khách hàng giai đoạn cao điểm</p>
                   </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                   <div className="space-y-6">
                      <InputWrapper label="Tiền hỗ trợ xe cộ (đ)" icon={Banknote}>
                         <input type="number" value={tet.carAllowance} onChange={e => onUpdateData('tetCampaign', {...tet, carAllowance: Number(e.target.value)})} className="w-full bg-transparent border-none outline-none font-black text-lg text-slate-800" />
                      </InputWrapper>
                      <InputWrapper label="Thưởng chuyên cần Trước Tết (đ)" icon={CheckCircle2}>
                         <input type="number" value={tet.beforeTetExtraBonus} onChange={e => onUpdateData('tetCampaign', {...tet, beforeTetExtraBonus: Number(e.target.value)})} className="w-full bg-transparent border-none outline-none font-black text-lg text-slate-800" />
                      </InputWrapper>
                   </div>
                   <div className="bg-amber-50 rounded-[2.5rem] p-8 border border-amber-100 space-y-6">
                      <div className="flex items-center gap-3 border-b border-amber-200 pb-4">
                         <CalendarDays className="w-5 h-5 text-amber-600" />
                         <span className="text-[11px] font-black text-amber-900 uppercase">Danh sách ngày cam kết (Trước Tết)</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(tet.beforeTetExtraDays || []).map(d => (
                          <div key={d} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-amber-200 rounded-xl text-[10px] font-black text-amber-700">
                             {d.split('-').reverse().join('/')}
                             <button onClick={() => removeTetExtraDay('before', d)} className="text-amber-300 hover:text-rose-500"><X className="w-3 h-3" /></button>
                          </div>
                        ))}
                        <input type="date" className="px-3 py-1 bg-white border border-amber-200 rounded-xl text-[10px] font-bold outline-none" onChange={(e) => { addTetExtraDay('before', e.target.value); e.target.value = ''; }} />
                      </div>
                   </div>
                </div>
              </div>

              <div className="bg-white p-10 rounded-[3.5rem] border border-rose-200 shadow-xl space-y-10 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5"><Candy className="w-48 h-48 text-rose-600" /></div>
                <div className="flex items-center gap-5">
                   <div className="p-4 bg-rose-500 text-white rounded-3xl shadow-lg shadow-rose-200"><Candy className="w-8 h-8" /></div>
                   <div>
                      <h4 className="text-2xl font-black text-slate-900 uppercase tracking-tight">GIAI ĐOẠN 2: SAU TẾT (PHÚC LỢI TÁI KHỞI ĐỘNG)</h4>
                   </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                   <div className="space-y-6">
                      <InputWrapper label="Ngày khai xuân (Lì xì)" icon={DateIcon}>
                         <input type="date" value={tet.afterTetDate} onChange={e => onUpdateData('tetCampaign', {...tet, afterTetDate: e.target.value})} className="w-full bg-transparent border-none outline-none font-black text-slate-800" />
                      </InputWrapper>
                      <InputWrapper label="Mức Lì xì khai xuân (đ)" icon={Banknote}>
                         <input type="number" value={tet.lixiBonus} onChange={e => onUpdateData('tetCampaign', {...tet, lixiBonus: Number(e.target.value)})} className="w-full bg-transparent border-none outline-none font-black text-lg text-slate-800" />
                      </InputWrapper>
                   </div>
                   <div className="bg-rose-50 rounded-[2.5rem] p-8 border border-rose-100 space-y-6">
                      <div className="flex items-center gap-3 border-b border-rose-200 pb-4">
                         <CalendarDays className="w-5 h-5 text-rose-600" />
                         <span className="text-[11px] font-black text-rose-900 uppercase">Danh sách ngày cam kết (Sau Tết)</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(tet.afterTetExtraDays || []).map(d => (
                          <div key={d} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-rose-200 rounded-xl text-[10px] font-black text-rose-700">
                             {d.split('-').reverse().join('/')}
                             <button onClick={() => removeTetExtraDay('after', d)} className="text-rose-300 hover:text-rose-500"><X className="w-3 h-3" /></button>
                          </div>
                        ))}
                        <input type="date" className="px-3 py-1 bg-white border border-rose-200 rounded-xl text-[10px] font-bold outline-none" onChange={(e) => { addTetExtraDay('after', e.target.value); e.target.value = ''; }} />
                      </div>
                   </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {(activeMainTab === 'standards' || activeMainTab === 'workflows') && (
        <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
           {/* KHO TÀI LIỆU GỐC & UPLOAD AI */}
           <div className="bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><UploadCloud className="w-64 h-64 text-indigo-600" /></div>
              <div className="flex flex-col md:flex-row items-center justify-between gap-10 relative z-10">
                 <div className="flex-1">
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                       <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><Upload className="w-6 h-6" /></div>
                       Kho tài liệu gốc (Số hóa AI)
                    </h3>
                    <p className="text-sm font-medium text-slate-500 mt-2">Tải lên văn bản gốc (.pdf, .png, .docx). AI Gemini 3 Flash sẽ tự động bóc tách và chuyển thành Quy chuẩn Markdown để nhân viên tra cứu nhanh.</p>
                 </div>
                 <div className="flex-shrink-0">
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleDocumentUpload} accept=".pdf,.png,.jpg,.jpeg,.docx" />
                    <button 
                       onClick={() => fileInputRef.current?.click()}
                       disabled={isParsing}
                       className="px-14 py-6 bg-slate-900 hover:bg-black text-white rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-2xl flex items-center gap-4 active:scale-95 transition-all disabled:opacity-50"
                    >
                       {isParsing ? <Loader2 className="w-6 h-6 animate-spin" /> : <UploadCloud className="w-6 h-6" />}
                       {isParsing ? "Đang giải mã tài liệu..." : "Tải lên văn bản (.pdf, .png)"}
                    </button>
                 </div>
              </div>

              {aiDocSuggestion && (
                <div className="mt-10 p-8 bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-[2.5rem] animate-in zoom-in-95 duration-300">
                   <div className="flex items-start justify-between mb-8">
                      <div className="flex items-center gap-4">
                         <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg"><Sparkles className="w-6 h-6" /></div>
                         <div>
                            <h4 className="font-black text-indigo-900 uppercase tracking-tight">AI Đã Giải Mã Thành Công</h4>
                            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Đang xem trước bản thảo quy chuẩn</p>
                         </div>
                      </div>
                      <div className="flex gap-3">
                         <button onClick={() => setAiDocSuggestion(null)} className="px-6 py-3 bg-white text-slate-400 rounded-xl font-black text-[10px] uppercase shadow-sm">Bỏ qua</button>
                         <button onClick={applyAiDocSuggestion} className="px-10 py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg shadow-indigo-200">Lưu vào Quy chuẩn</button>
                      </div>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                      <div className="space-y-2">
                         <label className="text-[9px] font-black text-indigo-400 uppercase ml-1">Tiêu đề đề xuất</label>
                         <input type="text" value={aiDocSuggestion.title} onChange={e => setAiDocSuggestion({...aiDocSuggestion, title: e.target.value})} className="w-full px-6 py-4 bg-white border-none rounded-2xl font-black text-slate-800" />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[9px] font-black text-indigo-400 uppercase ml-1">Danh mục đề xuất</label>
                         <select value={aiDocSuggestion.category} onChange={e => setAiDocSuggestion({...aiDocSuggestion, category: e.target.value as any})} className="w-full px-6 py-4 bg-white border-none rounded-2xl font-black text-slate-800">
                           {categories.map(c => <option key={c} value={c}>{c}</option>)}
                         </select>
                      </div>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[9px] font-black text-indigo-400 uppercase ml-1">Nội dung đã bóc tách (Markdown)</label>
                      <textarea value={aiDocSuggestion.content} onChange={e => setAiDocSuggestion({...aiDocSuggestion, content: e.target.value})} className="w-full px-6 py-4 bg-white border-none rounded-2xl text-xs font-medium min-h-[200px]" />
                   </div>
                </div>
              )}
           </div>

           <div className="flex flex-col md:flex-row gap-6">
            <div className="relative flex-1">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input type="text" placeholder={`Tìm kiếm ${activeMainTab === 'standards' ? 'quy chuẩn' : 'quy trình'}...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-16 pr-6 py-5 bg-white border-2 border-slate-100 focus:border-indigo-500 rounded-[2rem] shadow-xl outline-none text-base font-bold transition-all" />
            </div>
            <div className="flex gap-4">
               <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="px-8 py-5 bg-white border-2 border-slate-100 rounded-[2rem] shadow-xl outline-none font-black text-[10px] uppercase tracking-widest appearance-none min-w-[180px]">
                  <option value="Tất cả">Tất cả danh mục</option>
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
               </select>
               <button onClick={() => { setCurrentArticle({ category: 'Vận hành' as any, title: '', content: '' }); setIsEditing(true); }} className="px-8 py-5 bg-indigo-600 text-white rounded-[2rem] shadow-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 hover:bg-black transition-all">
                    <Plus className="w-5 h-5" /> {activeMainTab === 'standards' ? 'Soạn Quy chuẩn mới' : 'Soạn Quy trình mới'}
               </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredList.map((item) => (
              <div key={item.id} className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-xl hover:shadow-2xl transition-all cursor-pointer group flex flex-col justify-between h-[360px]" onClick={() => setViewArticle(item)}>
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-100">{item.category}</span>
                    <p className="text-[9px] font-bold text-slate-400">{new Date(item.updatedAt).toLocaleDateString('vi-VN')}</p>
                  </div>
                  <h4 className="text-xl font-black text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors line-clamp-3 uppercase tracking-tight">{item.title}</h4>
                  
                  {item.sourceFileName && (
                    <div className="mt-4 flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100">
                       <FileSearch className="w-4 h-4 text-indigo-400" />
                       <span className="text-[8px] font-black text-slate-400 uppercase truncate">Bản gốc: {item.sourceFileName}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between pt-6 border-t border-slate-50 mt-auto">
                   <div className="flex items-center gap-4">
                      <button onClick={(e) => { e.stopPropagation(); setCurrentArticle(item); setIsEditing(true); }} className="p-2.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><Edit className="w-4 h-4" /></button>
                      <button onClick={(e) => { e.stopPropagation(); onUpdateData('knowledgeBase', list.filter(it => it.id !== item.id), item.id); }} className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
                   </div>
                   <div className="flex items-center gap-1.5 text-slate-400 font-black text-[10px] uppercase tracking-widest group-hover:text-indigo-600 transition-colors">Xem chi tiết <ChevronRight className="w-4 h-4" /></div>
                </div>
              </div>
            ))}
            {filteredList.length === 0 && (
              <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  {activeMainTab === 'standards' ? <Library className="w-8 h-8 text-slate-300" /> : <Workflow className="w-8 h-8 text-slate-300" />}
                </div>
                <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Chưa có nội dung {activeMainTab === 'standards' ? 'quy chuẩn' : 'quy trình'}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODALS */}
      {(isEditing || viewArticle) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => { setIsEditing(false); setViewArticle(null); }}></div>
          <div className="relative bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[3.5rem] shadow-2xl p-10 md:p-14 animate-in zoom-in-95 duration-200 no-scrollbar">
             {isEditing ? (
               <div className="space-y-8">
                  <div className="flex justify-between items-center mb-8">
                     <h3 className="text-2xl font-black text-slate-900 uppercase">{activeMainTab === 'standards' ? 'Biên soạn Quy chuẩn' : 'Biên soạn Quy trình'}</h3>
                     <button onClick={() => setIsEditing(false)} className="p-3 bg-slate-50 text-slate-400 hover:text-rose-500 rounded-2xl transition-all"><X className="w-6 h-6" /></button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tiêu đề</label><input type="text" value={currentArticle?.title || ''} onChange={e => setCurrentArticle({...currentArticle, title: e.target.value})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold outline-none" /></div>
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Danh mục</label><select value={currentArticle?.category || 'Vận hành'} onChange={e => setCurrentArticle({...currentArticle, category: e.target.value as any})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold outline-none appearance-none">{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                  </div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nội dung (Markdown)</label><textarea value={currentArticle?.content || ''} onChange={e => setCurrentArticle({...currentArticle, content: e.target.value})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold outline-none min-h-[300px]" placeholder="Sử dụng Markdown để định dạng văn bản..." /></div>
                  <button onClick={() => { if(currentArticle?.title && currentArticle?.content) { const newArt = { ...currentArticle, id: currentArticle.id || crypto.randomUUID(), updatedAt: new Date().toISOString() } as KnowledgeBaseArticle; onUpdateData('knowledgeBase', currentArticle.id ? list.map(it => it.id === currentArticle.id ? newArt : it) : [newArt, ...list]); setIsEditing(false); } }} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black uppercase text-xs shadow-xl tracking-[0.2em]">Lưu nội dung</button>
               </div>
             ) : (
               <div className="space-y-8">
                  <div className="flex justify-between items-start">
                     <div>
                        <span className="px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-black uppercase tracking-widest mb-4 inline-block">{viewArticle?.category}</span>
                        <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight leading-tight">{viewArticle?.title}</h3>
                        {viewArticle?.sourceFileName && (
                           <a 
                              href={viewArticle.sourceFileData} 
                              download={viewArticle.sourceFileName}
                              className="mt-4 flex items-center gap-2 px-6 py-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all w-fit"
                           >
                              <FileDown className="w-5 h-5" />
                              <span className="text-[10px] font-black uppercase">Tải xuống tệp gốc ({viewArticle.sourceFileName})</span>
                           </a>
                        )}
                     </div>
                     <button onClick={() => setViewArticle(null)} className="p-3 bg-slate-50 text-slate-400 hover:text-rose-500 rounded-2xl transition-all shadow-sm"><X className="w-6 h-6" /></button>
                  </div>
                  <div className="markdown-content prose max-w-none bg-slate-50/50 p-10 rounded-[2.5rem] border border-slate-100" dangerouslySetInnerHTML={{ __html: String(marked(viewArticle?.content || '')) }} />
               </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
};

const AllowanceInput = ({ icon: Icon, label, value, onChange, color = "text-emerald-600" }: any) => (
  <div className="bg-white p-4 rounded-2xl border border-slate-100 focus-within:border-indigo-200 transition-all shadow-sm flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className="p-2 bg-slate-50 rounded-xl shadow-sm"><Icon className={`w-3.5 h-3.5 ${color}`} /></div>
      <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">{label}</span>
    </div>
    <input type="number" value={value || 0} onChange={e => onChange(Number(e.target.value))} className="w-32 bg-transparent border-none outline-none font-black text-slate-800 text-right text-sm" />
  </div>
);

const AllowanceRow = ({ icon: Icon, label, value, color = "text-slate-400" }: any) => (
  <div className="flex items-center justify-between py-1 border-b border-slate-50/50 last:border-none">
     <div className="flex items-center gap-2.5">
        <Icon className={`w-3 h-3 ${color}`} />
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{label}</span>
     </div>
     <span className="text-xs font-black text-slate-700">{(value || 0).toLocaleString()}đ</span>
  </div>
);

const InputWrapper = ({ label, icon: Icon, children }: any) => (
  <div className="space-y-1.5 flex-1">
    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
    <div className="relative bg-slate-50 border border-slate-100 focus-within:bg-white focus-within:border-amber-500 rounded-2xl transition-all shadow-inner flex items-center p-4">
      <Icon className="w-4 h-4 text-slate-400 mr-4" />
      {children}
    </div>
  </div>
);

const DateBonusInput = ({ label, date, bonus, labelBonus = "Thưởng", isFixedBonus = false, onChange }: any) => (
  <div className="space-y-2 bg-white/10 p-4 rounded-2xl border border-white/5">
     <p className="text-[9px] font-black text-orange-400 uppercase text-center">{label}</p>
     <input type="date" value={date || ''} onChange={e => onChange(e.target.value, bonus)} className="w-full p-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-bold text-white outline-none focus:border-orange-500" />
     {!isFixedBonus && (
       <div className="relative">
         <input type="number" value={bonus || 0} placeholder="đ" onChange={e => onChange(date, Number(e.target.value))} className="w-full p-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-orange-400 outline-none focus:border-orange-500" />
         <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-bold text-white/40">đ</span>
       </div>
     )}
     {isFixedBonus && <div className="w-full p-2 bg-white/5 border border-white/5 rounded-xl text-[9px] font-black text-slate-400 uppercase text-center">{labelBonus}</div>}
  </div>
);

export default KnowledgeManager;
