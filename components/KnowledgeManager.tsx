import React, { useState, useEffect, useRef } from 'react';
import { KnowledgeBaseArticle, AppData, SalaryPolicy, ViolationType } from '../types';
import MechanismsViolationsSubTab from './knowledge/MechanismsViolationsSubTab';
import MechanismsHolidaysSubTab from './knowledge/MechanismsHolidaysSubTab';
import MechanismsSalarySubTab from './knowledge/MechanismsSalarySubTab';
import StandardsWorkflowsTab from './knowledge/StandardsWorkflowsTab';
import {
  ArrowLeft,
  Plus,
  Search,
  Library,
  ChevronRight,
  ChevronDown,
  X,
  CalendarCheck as DateIcon,
  UploadCloud,
  Loader2,
  Shield,
  Banknote,
  Bus,
  Candy,
  CalendarDays,
  CheckCircle2,
  Workflow,
  FileText,
} from 'lucide-react';
import { useToast } from './ui/Toast';
import {
  getKnowledgeSection,
  KNOWLEDGE_SECTION_LABELS,
  KnowledgeSection,
  SYSTEM_KNOWLEDGE_SEED,
  withKnowledgeSection,
} from '../constants/systemKnowledgeSeed';

interface Props {
  data: AppData;
  onUpdateData: (key: keyof AppData, newList: any, idToRemove?: string) => void;
  initialMainTab?: 'mechanisms' | KnowledgeSection;
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

const KnowledgeManager: React.FC<Props> = ({ data, onUpdateData, initialMainTab = 'mechanisms' }) => {
  const { showToast } = useToast();
  const [activeMainTab, setActiveMainTab] = useState<'mechanisms' | KnowledgeSection>(
    initialMainTab
  );
  const [expandedSystemSections, setExpandedSystemSections] = useState<
    Set<'mechanisms' | KnowledgeSection>
  >(new Set([initialMainTab]));
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

  useEffect(() => {
    setActiveMainTab(initialMainTab);
    setExpandedSystemSections(prev => new Set([...prev, initialMainTab]));
  }, [initialMainTab]);

  const storedKnowledgeList = data.knowledgeBase || [];
  const seedKnowledgeIdSet = React.useMemo(
    () => new Set(SYSTEM_KNOWLEDGE_SEED.map(seed => seed.id)),
    []
  );
  const list = React.useMemo(() => {
    const userKnowledge = storedKnowledgeList.filter(item => !seedKnowledgeIdSet.has(item.id));
    return [...SYSTEM_KNOWLEDGE_SEED, ...userKnowledge];
  }, [seedKnowledgeIdSet, storedKnowledgeList]);
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

  const categories: KnowledgeBaseArticle['category'][] = [
    'Nhân sự',
    'Vận hành',
    'Bán hàng',
    'Tài chính',
    'Biểu mẫu',
    'Khác',
  ];

  const activeKnowledgeSection = activeMainTab === 'mechanisms' ? null : activeMainTab;
  const sectionList = React.useMemo(
    () =>
      activeKnowledgeSection
        ? list.filter(item => getKnowledgeSection(item) === activeKnowledgeSection)
        : list,
    [activeKnowledgeSection, list]
  );

  const filteredList = React.useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return sectionList.filter(item => {
      const searchableText = [
        item.title,
        item.category,
        item.sourceFileName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchesSearch = !normalizedSearch || searchableText.includes(normalizedSearch);
      const matchesCategory = selectedCategory === 'Tất cả' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchTerm, sectionList, selectedCategory]);

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
    showToast('Đã lưu cấu hình khấu trừ lên Cloud!', 'success');
  };

  const handleSavePolicy = () => {
    if (!selectedPolicyId) return;
    onUpdateData(
      'salaryPolicies',
      policies.map(p => (p.id === selectedPolicyId ? ({ ...p, ...policyForm } as SalaryPolicy) : p))
    );
    showToast('Đã cập nhật cơ chế nhóm lương!', 'success');
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
    const fileName = file.name.toLowerCase();
    const isDocx =
      fileName.endsWith('.docx') ||
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const isLegacyDoc = fileName.endsWith('.doc') || mimeType === 'application/msword';
    const isSupported = mimeType.startsWith('image/') || mimeType === 'application/pdf' || isDocx;
    if (isLegacyDoc && !isDocx) {
      showToast('File Word .doc đời cũ chưa hỗ trợ bóc tách. Vui lòng lưu lại thành .docx rồi tải lên.', 'warning');
      if (e.target) e.target.value = '';
      return;
    }
    if (!isSupported) {
      showToast('Chỉ hỗ trợ file ảnh (JPG, PNG), PDF và Word .docx.', 'warning');
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
          body: JSON.stringify({ base64Data: pureBase64, mimeType, fileName: file.name }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'AI service error');

        const result = JSON.parse(data.result || '{}');
        if (result.content) {
          const storedFile = await uploadKnowledgeOriginalFile(file);
          const targetSection = activeMainTab === 'mechanisms' ? 'standards' : activeMainTab;
          const isPreviewableUpload = mimeType === 'application/pdf' || mimeType.startsWith('image/');
          setAiDocSuggestion({
            ...result,
            content: result.content || '',
            summary: result.summary || '',
            sourceFileName: file.name,
            sourceFileType: mimeType,
            sourcePreviewUrl: isPreviewableUpload ? storedFile.sourceFileUrl : undefined,
            ...storedFile,
          });
        }
      } catch (err) {
        console.error('AI Document Parsing Error:', err);
        showToast(
          'AI không thể đọc tệp này. Vui lòng kiểm tra ANTHROPIC_API_KEY trong .env.local hoặc thử lại với ảnh/PDF rõ nét hơn.',
          'error'
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
      category:
        (aiDocSuggestion.category as KnowledgeBaseArticle['category']) ||
        (activeMainTab === 'templates' ? 'Biểu mẫu' : 'Khác'),
      title: aiDocSuggestion.title || 'Tài liệu mới',
      content: withKnowledgeSection(
        activeMainTab === 'mechanisms' ? 'standards' : activeMainTab,
        aiDocSuggestion.content || '',
        String((aiDocSuggestion as { summary?: string }).summary || '')
      ),
      updatedAt: new Date().toISOString(),
      sourceFileName: aiDocSuggestion.sourceFileName,
      sourceFilePath: aiDocSuggestion.sourceFilePath,
      sourceFileUrl: aiDocSuggestion.sourceFileUrl,
      sourcePreviewUrl: aiDocSuggestion.sourcePreviewUrl,
      sourceFileType: aiDocSuggestion.sourceFileType,
      sourceFileSize: aiDocSuggestion.sourceFileSize,
    };
    onUpdateData('knowledgeBase', [newArticle, ...storedKnowledgeList]);
    setAiDocSuggestion(null);
    const label = activeMainTab === 'mechanisms' ? 'Quy chuẩn' : KNOWLEDGE_SECTION_LABELS[activeMainTab];
    showToast(`Đã số hóa tài liệu thành ${label} thành công!`, 'success');
  };

  const systemSections = [
    { id: 'mechanisms' as const, label: 'Cơ chế', Icon: Library },
    { id: 'standards' as const, label: 'Quy chuẩn', Icon: Shield },
    { id: 'workflows' as const, label: 'Quy trình', Icon: Workflow },
    { id: 'templates' as const, label: 'Biểu mẫu', Icon: FileText },
  ];
  const mechanismSections = [
    { id: 'salary' as const, label: 'Nhóm lương' },
    { id: 'holidays' as const, label: 'Ngày lễ' },
    { id: 'tet' as const, label: 'Thưởng Tết' },
    { id: 'violations' as const, label: 'Khấu trừ' },
  ];
  const activeSectionLabel =
    systemSections.find(section => section.id === activeMainTab)?.label || 'Hệ thống';
  const sidebarHeaderTitle = viewArticle?.title || activeSectionLabel || 'Hệ thống';
  const activeMechanismLabel =
    mechanismSections.find(section => section.id === activeMechSubTab)?.label || 'Nhóm lương';
  const isKnowledgeTab =
    activeMainTab === 'standards' ||
    activeMainTab === 'workflows' ||
    activeMainTab === 'templates';
  const hasActiveKnowledgeFilters = selectedCategory !== 'Tất cả' || searchTerm.trim().length > 0;
  const handleClearKnowledgeFilters = () => {
    setSearchTerm('');
    setSelectedCategory('Tất cả');
    setViewArticle(null);
  };
  const toggleSystemSection = (sectionId: 'mechanisms' | KnowledgeSection) => {
    setExpandedSystemSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };
  const handleSelectSystemSection = (sectionId: 'mechanisms' | KnowledgeSection) => {
    setActiveMainTab(sectionId);
    setSelectedCategory('Tất cả');
    setViewArticle(null);
    toggleSystemSection(sectionId);
  };
  const getSectionCategoryCount = (
    sectionId: KnowledgeSection,
    category: KnowledgeBaseArticle['category']
  ) =>
    list.filter(item => getKnowledgeSection(item) === sectionId && item.category === category)
      .length;
  const handleCreateArticle = () => {
    setCurrentArticle({
      category: activeMainTab === 'templates' ? 'Biểu mẫu' : 'Vận hành',
      title: '',
      content: withKnowledgeSection(activeMainTab === 'mechanisms' ? 'standards' : activeMainTab, ''),
    });
    setIsEditing(true);
  };

  return (
    <div className="flex h-full min-h-0 bg-slate-50">
      <div className="flex flex-1 min-h-0 gap-4">
        <aside className="w-64 shrink-0 h-full min-h-0 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
        <div className="flex min-h-[52px] items-center justify-between border-b border-slate-100 px-4">
          <div className="flex items-center gap-2">
            <Library className="h-4 w-4 text-indigo-500" />
            <span className="line-clamp-2 text-sm font-semibold uppercase leading-5 tracking-tight text-slate-900">
              {sidebarHeaderTitle}
            </span>
          </div>
          {isKnowledgeTab && hasActiveKnowledgeFilters && (
            <button
              onClick={handleClearKnowledgeFilters}
              className="text-2xs font-normal uppercase tracking-wide text-indigo-600 hover:text-indigo-700"
            >
              Xóa lọc
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar p-3">
          <p className="mb-2 px-1 text-2xs font-normal uppercase tracking-wider text-slate-400">
            Thư mục hệ thống
          </p>
          <div className="space-y-1">
            {systemSections.map(section => {
              const isActiveParent = activeMainTab === section.id;
              const isExpanded = expandedSystemSections.has(section.id);
              const Icon = section.Icon;
              const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;
              const childCategories =
                section.id === 'mechanisms'
                  ? []
                  : categories.filter(category => getSectionCategoryCount(section.id, category) > 0);

              return (
                <div key={section.id}>
                  <button
                    onClick={() => handleSelectSystemSection(section.id)}
                    className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-normal transition-all ${
                      isActiveParent && selectedCategory === 'Tất cả'
                        ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                        : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <ChevronIcon className="h-3.5 w-3.5 text-slate-400" />
                    <Icon
                      className={`h-3.5 w-3.5 ${
                        isActiveParent ? 'text-indigo-600' : 'text-slate-400'
                      }`}
                    />
                    <span className="flex-1">{section.label}</span>
                  </button>

                  {isExpanded && section.id === 'mechanisms' && (
                    <div className="mt-1 space-y-1 pl-8">
                      {mechanismSections.map(item => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveMainTab('mechanisms');
                            setActiveMechSubTab(item.id);
                            setViewArticle(null);
                          }}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-normal transition-all ${
                            activeMainTab === 'mechanisms' && activeMechSubTab === item.id
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                          }`}
                        >
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {isExpanded && section.id !== 'mechanisms' && (
                    <div className="mt-1 space-y-1 pl-8">
                      {childCategories.map(category => (
                        <button
                          key={`${section.id}-${category}`}
                          onClick={() => {
                            setActiveMainTab(section.id);
                            setSelectedCategory(category);
                            setViewArticle(null);
                          }}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-normal transition-all ${
                            activeMainTab === section.id && selectedCategory === category
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                          }`}
                        >
                          <span>{category}</span>
                          <span className="text-2xs text-slate-400">
                            {getSectionCategoryCount(section.id, category)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </aside>

        <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 min-h-[52px] border-b border-slate-100 flex items-center gap-3 shrink-0">
            {isKnowledgeTab && viewArticle ? (
              <div className="flex-1 relative max-w-sm">
                <button
                  onClick={() => setViewArticle(null)}
                  className="inline-flex h-[34px] w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-2xs font-normal uppercase tracking-widest text-slate-500 shadow-sm transition-all hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Danh sách tài liệu
                </button>
              </div>
            ) : isKnowledgeTab ? (
              <div className="flex-1 relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder={`Tìm ${
                    activeMainTab === 'standards'
                      ? 'quy chuẩn'
                      : activeMainTab === 'workflows'
                        ? 'quy trình'
                        : 'biểu mẫu'
                  }...`}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-400 focus:bg-white transition-all placeholder:text-slate-300"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            ) : (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">{activeSectionLabel}</p>
                <p className="text-2xs font-bold uppercase tracking-wide text-slate-400">
                  {activeMechanismLabel}
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 ml-auto">
              {isKnowledgeTab && (
                <>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleDocumentUpload}
                    accept=".pdf,.docx,.png,.jpg,.jpeg"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isParsing}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white text-slate-600 rounded-xl font-semibold text-2xs uppercase tracking-wide border border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm transition-all disabled:opacity-60"
                  >
                    {isParsing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <UploadCloud className="h-3.5 w-3.5" />
                    )}
                    {isParsing ? 'Đang đọc' : 'Tải file'}
                  </button>
                  <button
                    onClick={handleCreateArticle}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold text-2xs uppercase tracking-wide shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-all"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Tạo mới
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain no-scrollbar p-5">

      {activeMainTab === 'mechanisms' && (
        <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
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
                    <h4 className="text-2xl font-semibold text-slate-900 uppercase tracking-tight">
                      GIAI ĐOẠN 1: TRƯỚC TẾT (PHÚC LỢI CAM KẾT)
                    </h4>
                    <p className="text-2xs text-amber-600 font-normal uppercase tracking-widest mt-1">
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
                      <span className="text-xs font-normal text-amber-900 uppercase">
                        Danh sách ngày cam kết (Trước Tết)
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(tet.beforeTetExtraDays || []).map(d => (
                        <div
                          key={d}
                          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-amber-200 rounded-xl text-2xs font-normal text-amber-700"
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
                        className="px-3 py-1 bg-white border border-amber-200 rounded-xl text-2xs font-normal outline-none"
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
                    <h4 className="text-2xl font-semibold text-slate-900 uppercase tracking-tight">
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
                      <span className="text-xs font-normal text-rose-900 uppercase">
                        Danh sách ngày cam kết (Sau Tết)
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(tet.afterTetExtraDays || []).map(d => (
                        <div
                          key={d}
                          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-rose-200 rounded-xl text-2xs font-normal text-rose-700"
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
                        className="px-3 py-1 bg-white border border-rose-200 rounded-xl text-2xs font-normal outline-none"
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

      {(activeMainTab === 'standards' ||
        activeMainTab === 'workflows' ||
        activeMainTab === 'templates') && (
        <StandardsWorkflowsTab
          mode={activeMainTab}
          list={sectionList}
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
          embeddedInShell
        />
      )}
          </div>
        </div>
      </div>

      {/* MODALS */}
      {isEditing && (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            onClick={() => {
              setIsEditing(false);
            }}
          ></div>
          <div className="relative bg-white w-full max-w-7xl max-h-[90vh] overflow-y-auto rounded-[2rem] shadow-2xl p-6 md:p-8 animate-in zoom-in-95 duration-200 no-scrollbar">
            {isEditing ? (
              <div className="space-y-8">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-semibold text-slate-900 uppercase">
                    {activeMainTab === 'standards'
                      ? 'Biên soạn Quy chuẩn'
                      : activeMainTab === 'workflows'
                        ? 'Biên soạn Quy trình'
                        : 'Biên soạn Biểu mẫu'}
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
                    <label className="text-2xs font-normal text-slate-400 uppercase tracking-widest">
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
                    <label className="text-2xs font-normal text-slate-400 uppercase tracking-widest">
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
                  <label className="text-2xs font-normal text-slate-400 uppercase tracking-widest">
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
                        content: withKnowledgeSection(
                          activeMainTab === 'mechanisms' ? 'standards' : activeMainTab,
                          currentArticle.content || ''
                        ),
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
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

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
