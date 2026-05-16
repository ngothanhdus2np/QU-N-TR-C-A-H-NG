import React, { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { KnowledgeBaseArticle, AppData, SalaryPolicy, ViolationType } from '../types';
import MechanismsViolationsSubTab from './knowledge/MechanismsViolationsSubTab';
import MechanismsHolidaysSubTab from './knowledge/MechanismsHolidaysSubTab';
import MechanismsSalarySubTab from './knowledge/MechanismsSalarySubTab';
import StandardsWorkflowsTab from './knowledge/StandardsWorkflowsTab';
import {
  Plus,
  Search,
  Library,
  ChevronRight,
  X,
  Save,
  Trash2,
  Edit,
  Settings,
  Layers,
  CalendarCheck,
  Sparkles,
  ShieldCheck as ResponsibilityIcon,
  CalendarCheck as DateIcon,
  Gavel,
  Info,
  HeartHandshake,
  Home,
  Utensils,
  Timer,
  UploadCloud,
  Loader2,
  Shield,
  Banknote,
  Bus,
  Candy,
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  Workflow,
  FileSearch,
  FileDown,
  Upload,
} from 'lucide-react';
import { marked } from 'marked';

interface Props {
  data: AppData;
  onUpdateData: (key: keyof AppData, newList: any, idToRemove?: string) => void;
}

const buildKnowledgeFilePath = (file: File) => {
  const extension = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
  const safeName =
    file.name
      .replace(/\.[^.]+$/, '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'document';
  return `originals/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName}.${extension}`;
};

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const uploadKnowledgeOriginalFile = async (file: File) => {
  const path = buildKnowledgeFilePath(file);
  const fileBase64 = await fileToBase64(file);
  const res = await fetch('/api/data/knowledge/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path,
      fileBase64,
      mimeType: file.type || 'application/octet-stream',
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(`Không thể lưu file gốc lên Supabase Storage: ${data.error || res.status}`);
  }

  return {
    sourceFilePath: data.sourceFilePath || path,
    sourceFileUrl: data.sourceFileUrl,
    sourceFileSize: file.size,
  };
};

const KnowledgeManager: React.FC<Props> = ({ data, onUpdateData }) => {
  const [activeMainTab, setActiveMainTab] = useState<'mechanisms' | 'standards' | 'workflows'>(
    'mechanisms'
  );
  const [activeMechSubTab, setActiveMechSubTab] = useState<
    'salary' | 'holidays' | 'tet' | 'violations'
  >('salary');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Tất cả');
  const [isEditing, setIsEditing] = useState(false);
  const [currentArticle, setCurrentArticle] = useState<Partial<KnowledgeBaseArticle> | null>(null);
  const [viewArticle, setViewArticle] = useState<KnowledgeBaseArticle | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI Suggestion State from Document
  const [aiDocSuggestion, setAiDocSuggestion] = useState<Partial<KnowledgeBaseArticle> | null>(
    null
  );

  // Local state for violations to prevent sync lag
  const [localViolations, setLocalViolations] = useState<ViolationType[]>([]);
  const [hasUnsavedViolations, setHasUnsavedViolations] = useState(false);

  const list = data.knowledgeBase || [];
  const policies = data.salaryPolicies || [];
  const holidays = data.holidays || [];
  const violationTypes = data.violationTypes || [];
  const tet = data.tetCampaign || {
    commitmentDate: '',
    carAllowance: 1000000,
    beforeTetExtraDays: [],
    beforeTetExtraBonus: 500000,
    afterTetDate: '',
    lixiBonus: 200000,
    afterTetExtraDays: [],
    afterTetExtraBonus: 300000,
    date28Tet: '',
    date29Tet: '',
    date30Tet: '',
    bonus29Tet: 500000,
    bonus30Tet: 500000,
  };

  useEffect(() => {
    setLocalViolations(violationTypes);
    setHasUnsavedViolations(false);
  }, [violationTypes]);

  const categories = ['Nhân sự', 'Vận hành', 'Bán hàng', 'Tài chính', 'Khác'];

  const filteredList = list.filter(item => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
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

  const saveViolationsToCloud = () => {
    onUpdateData('violationTypes', localViolations);
    setHasUnsavedViolations(false);
    alert('Đã lưu cấu hình khấu trừ lên Cloud!');
  };

  const handleSavePolicy = () => {
    if (!selectedPolicyId) return;
    onUpdateData(
      'salaryPolicies',
      policies.map(p => (p.id === selectedPolicyId ? ({ ...p, ...policyForm } as SalaryPolicy) : p))
    );
    alert('Đã cập nhật cơ chế nhóm lương!');
  };

  const handleRemovePolicy = (id: string) => {
    if (confirm('Xác nhận xóa nhóm lương?')) {
      onUpdateData(
        'salaryPolicies',
        policies.filter(p => p.id !== id),
        id
      );
      if (selectedPolicyId === id) setSelectedPolicyId(null);
    }
  };

  const handleAddNewPolicy = () => {
    const newPolicy: SalaryPolicy = {
      id: `POL-${Date.now()}`,
      name: 'Nhóm mới',
      salaryType: 'monthly',
      baseSalary: 0,
      startThreshold: 0,
      endThreshold: 0,
      otRate: 0,
      commissionRate: 0,
      seniorityBonusPerYear: 0,
      attendanceAllowance: 0,
      cleaningAllowance: 0,
      customerServiceAllowance: 0,
      dinnerAllowance: 0,
      housingAllowance: 0,
      responsibilityAllowance: 0,
      isProRated: false,
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
    onUpdateData('tetCampaign', {
      ...tet,
      [key]: (tet[key] || []).filter((d: string) => d !== date),
    });
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const mimeType = file.type || 'application/octet-stream';
    const isSupported = mimeType.startsWith('image/') || mimeType === 'application/pdf';
    if (!isSupported) {
      alert('Chỉ hỗ trợ file ảnh (JPG, PNG) và PDF. Định dạng DOCX chưa được hỗ trợ.');
      if (e.target) e.target.value = '';
      return;
    }

    setIsParsing(true);
    const reader = new FileReader();

    reader.onload = async event => {
      const base64Data = event.target?.result as string;
      const pureBase64 = base64Data.split(',')[1];

      try {
        const response = await fetch('/api/ai/knowledge-ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64Data: pureBase64, mimeType }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'AI service error');

        const result = JSON.parse(data.result || '{}');
        if (result.content) {
          const storedFile = await uploadKnowledgeOriginalFile(file);
          setAiDocSuggestion({
            ...result,
            sourceFileName: file.name,
            sourceFileType: mimeType,
            ...storedFile,
          });
        }
      } catch (err) {
        console.error('AI Document Parsing Error:', err);
        alert(
          'AI không thể đọc tệp này. Vui lòng kiểm tra ANTHROPIC_API_KEY trong .env.local hoặc thử lại với ảnh/PDF rõ nét hơn.'
        );
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
      sourceFilePath: aiDocSuggestion.sourceFilePath,
      sourceFileUrl: aiDocSuggestion.sourceFileUrl,
      sourceFileType: aiDocSuggestion.sourceFileType,
      sourceFileSize: aiDocSuggestion.sourceFileSize,
    };
    onUpdateData('knowledgeBase', [newArticle, ...list]);
    setAiDocSuggestion(null);
    alert('Đã số hóa tài liệu thành Quy chuẩn thành công!');
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
              <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">
                Quy Chuẩn & Chính Sách
              </h2>
              <p className="text-indigo-300 text-sm font-normal uppercase tracking-widest mt-1">
                Hệ cơ chế vận hành chính xác 100%
              </p>
            </div>
          </div>
          <div className="flex bg-white/10 p-1.5 rounded-2xl border border-white/5">
            <button
              onClick={() => setActiveMainTab('mechanisms')}
              className={`px-8 py-3 rounded-xl text-[10px] font-normal uppercase tracking-widest transition-all ${activeMainTab === 'mechanisms' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400 hover:text-white'}`}
            >
              Cơ chế
            </button>
            <button
              onClick={() => setActiveMainTab('standards')}
              className={`px-8 py-3 rounded-xl text-[10px] font-normal uppercase tracking-widest transition-all ${activeMainTab === 'standards' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400 hover:text-white'}`}
            >
              Quy chuẩn
            </button>
            <button
              onClick={() => setActiveMainTab('workflows')}
              className={`px-8 py-3 rounded-xl text-[10px] font-normal uppercase tracking-widest transition-all ${activeMainTab === 'workflows' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400 hover:text-white'}`}
            >
              Quy trình
            </button>
          </div>
        </div>
      </div>

      {activeMainTab === 'mechanisms' && (
        <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex bg-slate-100 p-1 rounded-2xl w-fit mx-auto border border-slate-200">
            <button
              onClick={() => setActiveMechSubTab('salary')}
              className={`px-6 py-3 rounded-xl text-[9px] font-normal uppercase transition-all ${activeMechSubTab === 'salary' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400'}`}
            >
              Nhóm Lương
            </button>
            <button
              onClick={() => setActiveMechSubTab('holidays')}
              className={`px-6 py-3 rounded-xl text-[9px] font-normal uppercase transition-all ${activeMechSubTab === 'holidays' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400'}`}
            >
              Ngày Lễ
            </button>
            <button
              onClick={() => setActiveMechSubTab('tet')}
              className={`px-6 py-3 rounded-xl text-[9px] font-normal uppercase transition-all ${activeMechSubTab === 'tet' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400'}`}
            >
              Thưởng Tết
            </button>
            <button
              onClick={() => setActiveMechSubTab('violations')}
              className={`px-6 py-3 rounded-xl text-[9px] font-normal uppercase transition-all ${activeMechSubTab === 'violations' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400'}`}
            >
              Khấu Trừ
            </button>
          </div>

          {activeMechSubTab === 'salary' && (
            <MechanismsSalarySubTab
              policies={policies}
              selectedPolicyId={selectedPolicyId}
              setSelectedPolicyId={setSelectedPolicyId}
              policyForm={policyForm}
              setPolicyForm={setPolicyForm}
              onSavePolicy={handleSavePolicy}
              onRemovePolicy={handleRemovePolicy}
              onAddNewPolicy={handleAddNewPolicy}
            />
          )}

          {activeMechSubTab === 'holidays' && (
            <MechanismsHolidaysSubTab
              holidays={holidays}
              onUpdate={updatedHolidays => onUpdateData('holidays', updatedHolidays)}
            />
          )}

          {activeMechSubTab === 'violations' && (
            <MechanismsViolationsSubTab
              localViolations={localViolations}
              setLocalViolations={violations => {
                setLocalViolations(violations);
                setHasUnsavedViolations(true);
              }}
              hasUnsaved={hasUnsavedViolations}
              onSave={saveViolationsToCloud}
            />
          )}

          {activeMechSubTab === 'tet' && (
            <div className="space-y-8 max-w-5xl mx-auto">
              <div className="bg-white p-10 rounded-[3.5rem] border border-amber-200 shadow-xl space-y-10 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <Bus className="w-48 h-48 text-amber-600" />
                </div>
                <div className="flex items-center gap-5">
                  <div className="p-4 bg-amber-500 text-white rounded-3xl shadow-lg shadow-amber-200">
                    <Bus className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                      GIAI ĐOẠN 1: TRƯỚC TẾT (PHÚC LỢI CAM KẾT)
                    </h4>
                    <p className="text-[10px] text-amber-600 font-normal uppercase tracking-widest mt-1">
                      Đảm bảo nhân sự phục vụ khách hàng giai đoạn cao điểm
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <InputWrapper label="Tiền hỗ trợ xe cộ (đ)" icon={Banknote}>
                      <input
                        type="number"
                        value={tet.carAllowance}
                        onChange={e =>
                          onUpdateData('tetCampaign', {
                            ...tet,
                            carAllowance: Number(e.target.value),
                          })
                        }
                        className="w-full bg-transparent border-none outline-none font-normal text-lg text-slate-800"
                      />
                    </InputWrapper>
                    <InputWrapper label="Thưởng chuyên cần Trước Tết (đ)" icon={CheckCircle2}>
                      <input
                        type="number"
                        value={tet.beforeTetExtraBonus}
                        onChange={e =>
                          onUpdateData('tetCampaign', {
                            ...tet,
                            beforeTetExtraBonus: Number(e.target.value),
                          })
                        }
                        className="w-full bg-transparent border-none outline-none font-normal text-lg text-slate-800"
                      />
                    </InputWrapper>
                  </div>
                  <div className="bg-amber-50 rounded-[2.5rem] p-8 border border-amber-100 space-y-6">
                    <div className="flex items-center gap-3 border-b border-amber-200 pb-4">
                      <CalendarDays className="w-5 h-5 text-amber-600" />
                      <span className="text-[11px] font-normal text-amber-900 uppercase">
                        Danh sách ngày cam kết (Trước Tết)
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(tet.beforeTetExtraDays || []).map(d => (
                        <div
                          key={d}
                          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-amber-200 rounded-xl text-[10px] font-normal text-amber-700"
                        >
                          {d.split('-').reverse().join('/')}
                          <button
                            onClick={() => removeTetExtraDay('before', d)}
                            className="text-amber-300 hover:text-rose-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <input
                        type="date"
                        className="px-3 py-1 bg-white border border-amber-200 rounded-xl text-[10px] font-normal outline-none"
                        onChange={e => {
                          addTetExtraDay('before', e.target.value);
                          e.target.value = '';
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-10 rounded-[3.5rem] border border-rose-200 shadow-xl space-y-10 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <Candy className="w-48 h-48 text-rose-600" />
                </div>
                <div className="flex items-center gap-5">
                  <div className="p-4 bg-rose-500 text-white rounded-3xl shadow-lg shadow-rose-200">
                    <Candy className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                      GIAI ĐOẠN 2: SAU TẾT (PHÚC LỢI TÁI KHỞI ĐỘNG)
                    </h4>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <InputWrapper label="Ngày khai xuân (Lì xì)" icon={DateIcon}>
                      <input
                        type="date"
                        value={tet.afterTetDate}
                        onChange={e =>
                          onUpdateData('tetCampaign', { ...tet, afterTetDate: e.target.value })
                        }
                        className="w-full bg-transparent border-none outline-none font-normal text-slate-800"
                      />
                    </InputWrapper>
                    <InputWrapper label="Mức Lì xì khai xuân (đ)" icon={Banknote}>
                      <input
                        type="number"
                        value={tet.lixiBonus}
                        onChange={e =>
                          onUpdateData('tetCampaign', { ...tet, lixiBonus: Number(e.target.value) })
                        }
                        className="w-full bg-transparent border-none outline-none font-normal text-lg text-slate-800"
                      />
                    </InputWrapper>
                  </div>
                  <div className="bg-rose-50 rounded-[2.5rem] p-8 border border-rose-100 space-y-6">
                    <div className="flex items-center gap-3 border-b border-rose-200 pb-4">
                      <CalendarDays className="w-5 h-5 text-rose-600" />
                      <span className="text-[11px] font-normal text-rose-900 uppercase">
                        Danh sách ngày cam kết (Sau Tết)
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(tet.afterTetExtraDays || []).map(d => (
                        <div
                          key={d}
                          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-rose-200 rounded-xl text-[10px] font-normal text-rose-700"
                        >
                          {d.split('-').reverse().join('/')}
                          <button
                            onClick={() => removeTetExtraDay('after', d)}
                            className="text-rose-300 hover:text-rose-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <input
                        type="date"
                        className="px-3 py-1 bg-white border border-rose-200 rounded-xl text-[10px] font-normal outline-none"
                        onChange={e => {
                          addTetExtraDay('after', e.target.value);
                          e.target.value = '';
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {(activeMainTab === 'standards' || activeMainTab === 'workflows') && (
        <StandardsWorkflowsTab
          mode={activeMainTab}
          list={list}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          categories={categories}
          isEditing={isEditing}
          setIsEditing={setIsEditing}
          currentArticle={currentArticle}
          setCurrentArticle={setCurrentArticle}
          viewArticle={viewArticle}
          setViewArticle={setViewArticle}
          isParsing={isParsing}
          fileInputRef={fileInputRef}
          handleDocumentUpload={handleDocumentUpload}
          aiDocSuggestion={aiDocSuggestion}
          setAiDocSuggestion={setAiDocSuggestion}
          applyAiDocSuggestion={applyAiDocSuggestion}
          onUpdateData={onUpdateData}
        />
      )}

      {/* MODALS */}
      {(isEditing || viewArticle) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            onClick={() => {
              setIsEditing(false);
              setViewArticle(null);
            }}
          ></div>
          <div className="relative bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[3.5rem] shadow-2xl p-10 md:p-14 animate-in zoom-in-95 duration-200 no-scrollbar">
            {isEditing ? (
              <div className="space-y-8">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-black text-slate-900 uppercase">
                    {activeMainTab === 'standards' ? 'Biên soạn Quy chuẩn' : 'Biên soạn Quy trình'}
                  </h3>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="p-3 bg-slate-50 text-slate-400 hover:text-rose-500 rounded-2xl transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-normal text-slate-400 uppercase tracking-widest">
                      Tiêu đề
                    </label>
                    <input
                      type="text"
                      value={currentArticle?.title || ''}
                      onChange={e =>
                        setCurrentArticle({ ...currentArticle, title: e.target.value })
                      }
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-normal outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-normal text-slate-400 uppercase tracking-widest">
                      Danh mục
                    </label>
                    <select
                      value={currentArticle?.category || 'Vận hành'}
                      onChange={e =>
                        setCurrentArticle({ ...currentArticle, category: e.target.value as any })
                      }
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-normal outline-none appearance-none"
                    >
                      {categories.map(c => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-normal text-slate-400 uppercase tracking-widest">
                    Nội dung (Markdown)
                  </label>
                  <textarea
                    value={currentArticle?.content || ''}
                    onChange={e =>
                      setCurrentArticle({ ...currentArticle, content: e.target.value })
                    }
                    className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-normal outline-none min-h-[300px]"
                    placeholder="Sử dụng Markdown để định dạng văn bản..."
                  />
                </div>
                <button
                  onClick={() => {
                    if (currentArticle?.title && currentArticle?.content) {
                      const newArt = {
                        ...currentArticle,
                        id: currentArticle.id || crypto.randomUUID(),
                        updatedAt: new Date().toISOString(),
                      } as KnowledgeBaseArticle;
                      onUpdateData(
                        'knowledgeBase',
                        currentArticle.id
                          ? list.map(it => (it.id === currentArticle.id ? newArt : it))
                          : [newArt, ...list]
                      );
                      setIsEditing(false);
                    }
                  }}
                  className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-normal uppercase text-xs shadow-xl tracking-[0.2em]"
                >
                  Lưu nội dung
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-normal uppercase tracking-widest mb-4 inline-block">
                      {viewArticle?.category}
                    </span>
                    <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight leading-tight">
                      {viewArticle?.title}
                    </h3>
                    {viewArticle?.sourceFileName && (
                      <a
                        href={viewArticle.sourceFileUrl || viewArticle.sourceFileData}
                        download={viewArticle.sourceFileName}
                        className="mt-4 flex items-center gap-2 px-6 py-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all w-fit"
                      >
                        <FileDown className="w-5 h-5" />
                        <span className="text-[10px] font-normal uppercase">
                          Tải xuống tệp gốc ({viewArticle.sourceFileName})
                        </span>
                      </a>
                    )}
                  </div>
                  <button
                    onClick={() => setViewArticle(null)}
                    className="p-3 bg-slate-50 text-slate-400 hover:text-rose-500 rounded-2xl transition-all shadow-sm"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div
                  className="markdown-content prose max-w-none bg-slate-50/50 p-10 rounded-[2.5rem] border border-slate-100"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(marked(viewArticle?.content || '') as string),
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const AllowanceInput = ({
  icon: Icon,
  label,
  value,
  onChange,
  color = 'text-emerald-600',
}: any) => (
  <div className="bg-white p-4 rounded-2xl border border-slate-100 focus-within:border-indigo-200 transition-all shadow-sm flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className="p-2 bg-slate-50 rounded-xl shadow-sm">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
      </div>
      <span className="text-[9px] font-normal text-slate-500 uppercase tracking-tighter">
        {label}
      </span>
    </div>
    <input
      type="number"
      value={value || 0}
      onChange={e => onChange(Number(e.target.value))}
      className="w-32 bg-transparent border-none outline-none font-normal text-slate-800 text-right text-sm"
    />
  </div>
);

const AllowanceRow = ({ icon: Icon, label, value, color = 'text-slate-400' }: any) => (
  <div className="flex items-center justify-between py-1 border-b border-slate-50/50 last:border-none">
    <div className="flex items-center gap-2.5">
      <Icon className={`w-3 h-3 ${color}`} />
      <span className="text-[10px] font-normal text-slate-500 uppercase tracking-tight">{label}</span>
    </div>
    <span className="text-xs font-normal text-slate-700">{(value || 0).toLocaleString()}đ</span>
  </div>
);

const InputWrapper = ({ label, icon: Icon, children }: any) => (
  <div className="space-y-1.5 flex-1">
    <label className="text-[9px] font-normal text-slate-400 uppercase tracking-widest ml-1">
      {label}
    </label>
    <div className="relative bg-slate-50 border border-slate-100 focus-within:bg-white focus-within:border-amber-500 rounded-2xl transition-all shadow-inner flex items-center p-4">
      <Icon className="w-4 h-4 text-slate-400 mr-4" />
      {children}
    </div>
  </div>
);

export default KnowledgeManager;
