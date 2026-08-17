import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useTransition,
} from 'react';
import {
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Sparkles,
  UploadCloud,
  Clock,
  Copy,
  Camera,
  Search,
  CloudCheck,
  CloudOff,
  Upload,
  CheckCircle2,
  AlertCircle,
  CalendarDays,
  FileText,
  Settings,
  Facebook,
  Tag,
  Wand2,
} from 'lucide-react';
import {
  ContentPlanItem,
  ContentStrategy,
  ProductLine,
  BrandProfile,
  StrategicAdvice,
} from '../../types';
import { generateContentPlan } from '../../services/marketingClaudeService';
import {
  STRATEGY_COLORS,
  DEFAULT_STRATEGIES,
  DEFAULT_FOCUS_PRODUCTS,
} from '../../constants/marketing';
import { useSyncStorage, useCalendar } from '../../hooks/useMarketing';
import { StrategyBadge, FacebookPreview, SkeletonPost } from './MarketingUI';
import { uploadImage } from '../../services/marketingStorageService';
import MarketingFacebookTab, { AutoPostConfig, FacebookPage } from './MarketingFacebookTab';
import ProductContentTab from './ProductContentTab';
import MarketingSettingsTab from './MarketingSettingsTab';
import { useMarketingState, MarketingTab } from '../../hooks/useMarketingState';
import { SingleDatePicker } from '../shared';

interface MarketingManagerProps {
  brandProfile: BrandProfile;
  onUpdateBrand: (profile: BrandProfile) => void;
  suggestedFocusProducts?: ProductLine[];
  onSelectMainTab?: (tab: string) => void;
}

const MARKETING_TABS: MarketingTab[] = ['calendar', 'list', 'settings', 'facebook', 'product-content'];
type MarketingSidebarItem = MarketingTab | 'promotions';

const MARKETING_TAB_META: Record<
  MarketingSidebarItem,
  {
    label: string;
    description: string;
    icon: React.ElementType;
    group: 'Cửa hàng' | 'Facebook';
  }
> = {
  calendar: {
    label: 'Lịch đăng',
    description: 'Xem kế hoạch đăng bài theo ngày',
    icon: CalendarDays,
    group: 'Facebook',
  },
  promotions: {
    label: 'Khuyến mãi',
    description: 'Thiết lập chương trình và phân tích hiệu quả',
    icon: Tag,
    group: 'Cửa hàng',
  },
  list: {
    label: 'Kho bài',
    description: 'Quản lý bài đã duyệt và trạng thái đăng',
    icon: FileText,
    group: 'Facebook',
  },
  settings: {
    label: 'Chiến lược',
    description: 'Tỉ lệ nội dung và sản phẩm trọng tâm',
    icon: Settings,
    group: 'Facebook',
  },
  facebook: {
    label: 'Facebook API',
    description: 'Kết nối fanpage và tự động đăng',
    icon: Facebook,
    group: 'Facebook',
  },
  'product-content': {
    label: 'Sinh nội dung',
    description: 'Dùng AI sinh mô tả sản phẩm cho Shopee, Blog, Web, Facebook',
    icon: Wand2,
    group: 'Cửa hàng',
  },
};

const MARKETING_SIDEBAR_ITEMS: MarketingSidebarItem[] = [
  'promotions',
  'product-content',
  'calendar',
  'list',
  'settings',
  'facebook',
];

const MarketingManager: React.FC<MarketingManagerProps> = ({
  brandProfile,
  onUpdateBrand,
  suggestedFocusProducts,
  onSelectMainTab,
}) => {
  const [session] = useState<any>(null);

  // Use custom hook for marketing state management
  const marketingState = useMarketingState();

  // Destructure for convenience
  const {
    loading,
    setLoading,
    adviceLoading,
    setAdviceLoading,
    schedule,
    setSchedule,
    drafts,
    setDrafts,
    strategies,
    setStrategies,
    focusProducts,
    setFocusProducts,
    aiAdvice,
    setAiAdvice,
    isCloudSyncEnabled,
    setIsCloudSyncEnabled,
    duration,
    setDuration,
    viewDate,
    setViewDate,
    activeTab,
    setActiveTab,
    selectedPost,
    setSelectedPost,
    modalMode,
    setModalMode,
    searchQuery,
    setSearchQuery,
    deferredSearchQuery,
    selectedStrategyFilter,
    setSelectedStrategyFilter,
    uploadingForDate,
    setUploadingForDate,
    todayStr,
    nextAvailableStartDate,
    generationCount,
    togglePosted,
  } = marketingState;

  useEffect(() => {
    if (suggestedFocusProducts && suggestedFocusProducts.length > 0) {
      setFocusProducts(suggestedFocusProducts);
    }
  }, [suggestedFocusProducts, setFocusProducts]);

  // Facebook State
  const [fbAppConfig, setFbAppConfig] = useState({ appId: '', appSecret: '' });
  const [fbPages, setFbPages] = useState<FacebookPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string>('');
  const [isFbConnected, setIsFbConnected] = useState(false);
  const [fbLoading, setFbLoading] = useState(false);
  const [autoPostConfig, setAutoPostConfig] = useState<AutoPostConfig>({
    enabled: false,
    selectedPageId: '',
    selectedPageName: '',
    selectedPageAccessToken: '',
    logs: [],
  });

  const [, startTabTransition] = useTransition();
  const imageUploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load FB Config
    fetch('/api/fb/config')
      .then(res => res.json())
      .then(data => {
        setFbAppConfig(prev => ({ ...prev, appId: data.appId }));
      })
      .catch(err => console.error('[MarketingManager] Không tải được FB config:', err));

    // Load Auto Post Config
    fetch('/api/fb/auto-post/config')
      .then(res => res.json())
      .then(data => {
        if (data) setAutoPostConfig(data);
      })
      .catch(err => console.error('[MarketingManager] Không tải được auto-post config:', err));

    // Check if already connected (session)
    fetch('/api/fb/pages')
      .then(res => {
        if (res.ok) return res.json();
        throw new Error();
      })
      .then(data => {
        setFbPages(data);
        setIsFbConnected(true);
      })
      .catch(() => setIsFbConnected(false));

    // Listen for OAuth success
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        fetchFbPages();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleToggleAutoPost = async (enabled: boolean) => {
    try {
      const page = fbPages.find(p => p.id === selectedPageId);
      const res = await fetch('/api/fb/auto-post/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          selectedPageId: page?.id || autoPostConfig.selectedPageId,
          selectedPageName: page?.name || autoPostConfig.selectedPageName,
          selectedPageAccessToken: page?.access_token || autoPostConfig.selectedPageAccessToken,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAutoPostConfig(data.config);
      }
    } catch (e) {
      console.error('Lỗi cập nhật tự động đăng bài:', e);
    }
  };

  const fetchFbPages = async () => {
    setFbLoading(true);
    try {
      // Đợi một chút để session kịp ổn định sau khi popup đóng
      await new Promise(resolve => setTimeout(resolve, 1000));

      const res = await fetch('/api/fb/pages', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setFbPages(data);
        setIsFbConnected(true);
      } else {
        const errData = await res.json();
        console.error('Lỗi lấy Fanpage:', errData.error);
        setIsFbConnected(false);
      }
    } catch (e) {
      console.error('Lỗi Fetch:', e);
      setIsFbConnected(false);
    } finally {
      setFbLoading(false);
    }
  };

  const handleSaveFbConfig = async () => {
    setFbLoading(true);
    try {
      await fetch('/api/fb/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fbAppConfig),
      });
      alert('Đã lưu cấu hình App Facebook!');
    } catch {
      alert('Lỗi lưu cấu hình');
    } finally {
      setFbLoading(false);
    }
  };

  const handleConnectFb = async () => {
    try {
      const res = await fetch('/api/fb/auth-url');
      const data = await res.json();
      if (data.url) {
        window.open(data.url, 'fb_oauth', 'width=600,height=700');
      } else {
        alert(data.error || 'Lỗi lấy URL xác thực');
      }
    } catch {
      alert('Lỗi kết nối');
    }
  };

  const handlePostToFb = async (post: ContentPlanItem) => {
    if (!selectedPageId) {
      alert('Vui lòng chọn Fanpage trước!');
      return;
    }
    const page = fbPages.find(p => p.id === selectedPageId);
    if (!page) return;

    setFbLoading(true);
    try {
      const res = await fetch('/api/fb/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: page.id,
          pageAccessToken: page.access_token,
          message: `${post.topic}\n\n${post.caption}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Đã đăng bài lên Facebook thành công!');
        togglePosted(post.date);
      } else {
        alert('Lỗi đăng bài: ' + data.error);
      }
    } catch {
      alert('Lỗi hệ thống khi đăng bài');
    } finally {
      setFbLoading(false);
    }
  };

  const handleSelectedPostDateChange = (date: string) => {
    if (!selectedPost) return;
    const previousDate = selectedPost.date;
    const updatePostDate = (items: ContentPlanItem[]) =>
      items.map(item => (item.date === previousDate ? { ...item, date } : item));

    if (selectedPost.isDraft) setDrafts(updatePostDate);
    else setSchedule(updatePostDate);
    setSelectedPost(post => (post ? { ...post, date } : null));
    setUploadingForDate(current => (current === previousDate ? date : current));
    setViewDate(new Date(`${date}T00:00:00`));
  };

  const changeTab = (tab: MarketingTab) => {
    startTabTransition(() => setActiveTab(tab));
  };

  const { syncing, initialLoading, fetchData, saveData } = useSyncStorage(
    session,
    isCloudSyncEnabled
  );
  const calendarDays = useCalendar(viewDate);

  useEffect(() => {
    localStorage.setItem('ps_cloud_sync_enabled', JSON.stringify(isCloudSyncEnabled));
  }, [isCloudSyncEnabled]);

  useEffect(() => {
    fetchData().then(data => {
      if (data) {
        if (data.schedule) setSchedule(data.schedule);
        if (data.strategies) setStrategies(data.strategies);
        if (data.focus_products) setFocusProducts(data.focus_products);
        // brand_profile is managed by the main app (brand_profile table), not app_state
        if (data.selected_page_id) setSelectedPageId(data.selected_page_id);
      }
    });
  }, []);

  useEffect(() => {
    if (!initialLoading) {
      const timer = setTimeout(() => {
        saveData({
          schedule,
          strategies,
          focus_products: focusProducts,
          drafts,
          selected_page_id: selectedPageId,
        });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [
    schedule,
    strategies,
    focusProducts,
    drafts,
    selectedPageId,
    isCloudSyncEnabled,
  ]);

  const handleGenerateNext = async () => {
    if (generationCount <= 0) {
      alert('Đã hết ngày trong tháng này. Hãy đợi sang tháng mới hoặc xóa bớt bài cuối tháng!');
      return;
    }
    const total = strategies.reduce((sum, s) => sum + s.percentage, 0);
    if (total !== 100) {
      alert('Tổng tỉ lệ phải là 100%!');
      setActiveTab('settings');
      return;
    }

    setLoading(true);
    try {
      const data = await generateContentPlan(
        'custom',
        nextAvailableStartDate,
        strategies || [],
        focusProducts || [],
        brandProfile,
        (schedule || []).slice(-30).map(s => s.topic),
        generationCount
      );
      setDrafts(prev => [...prev, ...data]);
      setActiveTab('calendar');
    } catch (e) {
      alert('Lỗi AI: ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyAdvice = () => {
    if (!aiAdvice) return;
    setStrategies(prev =>
      prev.map(s => {
        const suggest = aiAdvice.suggestedDistribution.find(d => d.strategyId === s.id);
        return suggest ? { ...s, percentage: suggest.percentage } : s;
      })
    );
  };

  const processAndUploadImage = async (file: File, callback: (url: string) => void) => {
    const userId = 'content-images';
    setLoading(true);

    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        let w = img.width,
          h = img.height;
        const max = 1200;
        if (w > h) {
          if (w > max) {
            h *= max / w;
            w = max;
          }
        } else {
          if (h > max) {
            w *= max / h;
            h = max;
          }
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);

        canvas.toBlob(
          async blob => {
            if (blob) {
              const publicUrl = await uploadImage(userId, 'images', file.name, blob);
              if (publicUrl) {
                callback(publicUrl);
              } else {
                alert('Lỗi tải ảnh lên Cloud!');
              }
              setLoading(false);
              setUploadingForDate(null);
            }
          },
          'image/jpeg',
          0.8
        );
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const groupedSchedule = useMemo(() => {
    if (activeTab !== 'list') return {};
    const filtered = (schedule || [])
      .filter(item => {
        const q = deferredSearchQuery.toLowerCase();
        const matchesSearch =
          (item.topic || '').toLowerCase().includes(q) ||
          (item.caption || '').toLowerCase().includes(q) ||
          (item.type || '').toLowerCase().includes(q);
        const matchesStrategy =
          selectedStrategyFilter === 'all' || item.type === selectedStrategyFilter;
        return matchesSearch && matchesStrategy;
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    const groups: Record<string, ContentPlanItem[]> = {};
    filtered.forEach(item => {
      const m = `Tháng ${new Date(item.date).getMonth() + 1} / ${new Date(item.date).getFullYear()}`;
      if (!groups[m]) groups[m] = [];
      groups[m].push(item);
    });
    return groups;
  }, [activeTab, schedule, deferredSearchQuery, selectedStrategyFilter]);

  const calendarPostByDate = useMemo(() => {
    if (activeTab !== 'calendar') return new Map<string, ContentPlanItem & { isDraft?: boolean }>();
    const byDate = new Map<string, ContentPlanItem & { isDraft?: boolean }>();
    for (const post of schedule || []) byDate.set(post.date, post);
    for (const draft of drafts || []) byDate.set(draft.date, { ...draft, isDraft: true });
    return byDate;
  }, [activeTab, drafts, schedule]);

  const handleQuickUpload = (date: string) => {
    setUploadingForDate(date);
    imageUploadRef.current?.click();
  };

  const activeMeta = MARKETING_TAB_META[activeTab];
  const sidebarGroups = Array.from(
    new Set(MARKETING_SIDEBAR_ITEMS.map(tab => MARKETING_TAB_META[tab].group))
  );

  return (
    <div className="flex h-full min-h-0 gap-4 pt-4">
      <input
        type="file"
        ref={imageUploadRef}
        className="hidden"
        accept="image/*"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f && uploadingForDate)
            processAndUploadImage(f, url => {
              const upd = (ls: ContentPlanItem[]) =>
                ls.map(p => (p.date === uploadingForDate ? { ...p, image: url } : p));
              if (drafts.some(d => d.date === uploadingForDate)) setDrafts(upd);
              else setSchedule(upd);
              if (selectedPost?.date === uploadingForDate)
                setSelectedPost(p => (p ? { ...p, image: url } : null));
            });
        }}
      />

      <aside className="w-64 shrink-0 h-full min-h-0 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
        <div className="px-4 min-h-[60px] border-b border-slate-100 shrink-0 flex flex-col justify-center">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-widest">
            {activeMeta.label}
          </h2>
          <p className="text-2xs text-slate-400 uppercase tracking-wide">Marketing</p>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-5">
          {sidebarGroups.map(group => (
            <div key={group} className="space-y-2">
              <p className="px-2 text-2xs font-normal uppercase tracking-widest text-slate-400">
                {group}
              </p>
              <div className="space-y-1">
                {MARKETING_SIDEBAR_ITEMS.filter(tab => MARKETING_TAB_META[tab].group === group).map(tab => {
                  const meta = MARKETING_TAB_META[tab];
                  const Icon = meta.icon;
                  const isActive = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => {
                        if (tab === 'promotions') onSelectMainTab?.('promotions');
                        else changeTab(tab);
                      }}
                      className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${
                        isActive
                          ? 'border-indigo-100 bg-indigo-50 text-indigo-700 shadow-sm'
                          : 'border-transparent text-slate-500 hover:border-slate-100 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-xs font-normal uppercase">{meta.label}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </aside>

      <section className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="shrink-0 border-b border-slate-100 px-5 py-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-2xs font-normal uppercase tracking-widest text-slate-400">
              <span>Marketing</span>
              <span>/</span>
              <span>{activeMeta.label}</span>
            </div>
            <h1 className="mt-1 text-xl font-semibold uppercase tracking-tight text-slate-900">
              {activeMeta.label}
            </h1>
            <p className="mt-1 text-xs text-slate-500">{activeMeta.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2">
              <label className="relative inline-flex items-center cursor-pointer group">
                <input
                  type="checkbox"
                  checked={isCloudSyncEnabled}
                  onChange={() => setIsCloudSyncEnabled(!isCloudSyncEnabled)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 group-hover:ring-4 ring-indigo-500/10"></div>
              </label>
              <span className="text-2xs font-normal uppercase text-slate-400 select-none">
                Backup
              </span>
            </div>
            <div className="h-4 w-px bg-slate-200"></div>
            <div className="flex items-center gap-2 text-2xs font-normal uppercase">
              {!isCloudSyncEnabled ? (
                <span className="text-slate-500 flex items-center gap-1.5">
                  <CloudOff size={14} /> Sandbox
                </span>
              ) : syncing ? (
                <span className="text-indigo-400 flex items-center gap-1.5">
                  <Loader2 size={14} className="animate-spin" /> Đồng bộ...
                </span>
              ) : (
                <span className="text-green-500 flex items-center gap-1.5">
                  <CloudCheck size={14} /> Cloud Live
                </span>
              )}
            </div>
          </div>
          {activeTab !== 'product-content' && (
            <button
              onClick={handleGenerateNext}
              disabled={loading || generationCount <= 0}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-white text-xs font-normal flex items-center gap-2 shadow-md disabled:opacity-50 transition-all"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
              {generationCount > 0 ? `SÁNG TẠO ${generationCount} BÀI` : 'ĐÃ ĐỦ BÀI THÁNG'}
            </button>
          )}
        </div>
        </div>

      {initialLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl p-6">
            {[1, 2, 3].map(i => (
              <SkeletonPost key={i} />
            ))}
          </div>
          <span className="text-2xs font-normal text-slate-400 uppercase tracking-widest">
            Đang tải dữ liệu...
          </span>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto flex flex-col relative">
          {activeTab === 'calendar' && (
            <div className="flex flex-col h-full min-w-[1000px]">
              <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-20">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                    <button
                      onClick={() =>
                        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))
                      }
                      className="p-2 hover:bg-white rounded-lg transition-all"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <span className="px-6 text-sm font-normal uppercase tracking-wide">
                      {viewDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}
                    </span>
                    <button
                      onClick={() =>
                        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))
                      }
                      className="p-2 hover:bg-white rounded-lg transition-all"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
                    <button
                      onClick={() => setDuration('week')}
                      className={`px-5 py-2 rounded-lg text-2xs font-normal uppercase transition-all duration-200 ${duration === 'week' ? 'bg-white text-indigo-600 shadow-md ring-1 ring-slate-200/50' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      Tuần
                    </button>
                    <button
                      onClick={() => setDuration('month')}
                      className={`px-5 py-2 rounded-lg text-2xs font-normal uppercase transition-all duration-200 ${duration === 'month' ? 'bg-white text-indigo-600 shadow-md ring-1 ring-slate-200/50' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      Tháng
                    </button>
                  </div>
                </div>
                {drafts.length > 0 && (
                  <button
                    onClick={() => {
                      setSchedule(prev => [...prev, ...drafts]);
                      setDrafts([]);
                    }}
                    className="bg-indigo-600 text-white px-8 py-3 rounded-xl text-xs font-normal shadow-lg animate-bounce uppercase"
                  >
                    Duyệt vào kho ({drafts.length})
                  </button>
                )}
              </div>
              <div className="grid grid-cols-7 bg-slate-900 text-white text-2xs font-normal py-3 text-center uppercase tracking-widest sticky top-[80px] z-10">
                {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(d => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-[1px] bg-slate-100 flex-1">
                {calendarDays.map((day, idx) => {
                  const post = calendarPostByDate.get(day.dateKey);
                  const isDraft = post?.isDraft === true;
                  const isToday = day.dateKey === todayStr;
                  return (
                    <div
                      key={idx}
                      onClick={() => post && setSelectedPost({ ...post, isDraft })}
                      className={`bg-white p-3 min-h-[160px] flex flex-col gap-2 relative group transition-all ${post ? 'cursor-pointer hover:bg-slate-50' : ''} ${day.dayNum === null ? 'bg-slate-50/30' : ''} ${isToday ? 'ring-2 ring-amber-400 ring-inset bg-amber-50/30' : ''}`}
                    >
                      {day.dayNum && (
                        <>
                          <div className="flex items-center justify-between">
                            <span
                              className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-normal ${post ? (isDraft ? 'bg-orange-500 text-white' : 'bg-slate-900 text-white') : 'text-slate-300'}`}
                            >
                              {day.dayNum}
                            </span>
                            {post?.isPosted && (
                              <CheckCircle2 size={14} className="text-green-500" />
                            )}
                          </div>
                          {post && (
                            <div className="flex flex-col gap-1.5">
                              <StrategyBadge type={post.type} strategies={strategies} />
                              <h4 className="text-2xs font-normal leading-tight line-clamp-3 uppercase tracking-tighter text-slate-700">
                                {post.topic}
                              </h4>
                              {isDraft && (
                                <span className="text-[8px] text-orange-500 font-normal italic uppercase">
                                  Bản thảo
                                </span>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'list' && (
            <div className="p-8 h-full flex flex-col overflow-hidden">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold uppercase text-slate-900 tracking-tight">
                  Kho bài viết
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSearchQuery('')}
                    className="p-2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={20} />
                  </button>
                  <div className="relative">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"
                      size={16}
                    />
                    <input
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="bg-slate-50 border rounded-xl pl-10 pr-4 py-2 text-xs font-normal outline-none focus:border-indigo-500 w-64"
                      placeholder="Tìm bài viết..."
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mb-8 overflow-x-auto scrollbar-hide">
                <button
                  onClick={() => setSelectedStrategyFilter('all')}
                  className={`px-5 py-2.5 rounded-xl text-2xs font-normal uppercase transition-all whitespace-nowrap ${selectedStrategyFilter === 'all' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                >
                  Tất cả
                </button>
                {(strategies || []).map(s => {
                  const style =
                    STRATEGY_COLORS[s.color as keyof typeof STRATEGY_COLORS] ||
                    STRATEGY_COLORS['blue'];
                  const isActive = selectedStrategyFilter === s.name;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedStrategyFilter(s.name)}
                      className={`px-5 py-2.5 rounded-xl text-2xs font-normal uppercase border transition-all whitespace-nowrap flex items-center gap-2 ${isActive ? `${style.bg} ${style.text} ${style.border} shadow-sm ring-1 ring-offset-1 ring-slate-100` : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${style.dot}`}></div>
                      {s.name}
                    </button>
                  );
                })}
              </div>
              <div className="flex-1 overflow-y-auto pr-2 space-y-10">
                {Object.entries(groupedSchedule).length > 0 ? (
                  Object.entries(groupedSchedule).map(([month, items]) => (
                    <div key={month} className="space-y-4">
                      <div className="flex items-center gap-4 text-2xs font-normal text-slate-400 uppercase tracking-widest">
                        <span>{month}</span>
                        <div className="flex-1 h-px bg-slate-100"></div>
                        <span>{(items as ContentPlanItem[]).length} BÀI</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {(items as ContentPlanItem[]).map((item, i) => (
                          <div
                            key={i}
                            className={`bg-white p-6 rounded-3xl border transition-all hover:shadow-lg group flex flex-col gap-4 relative ${item.isPosted || item.status === 'posted' ? 'border-green-100' : item.status === 'error' ? 'border-rose-100' : item.status === 'scheduled' ? 'border-indigo-100' : 'border-slate-100'}`}
                          >
                            {!item.image && (
                              <div className="absolute top-4 right-4 z-10">
                                <div className="bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full text-[8px] font-normal uppercase flex items-center gap-1 shadow-sm">
                                  <AlertCircle size={10} /> Thiếu ảnh
                                </div>
                              </div>
                            )}
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <span className="text-2xs font-normal text-indigo-500">
                                  {item.date.split('-').reverse().join('/')}
                                </span>
                                {item.scheduledTime && (
                                  <span className="text-[9px] font-normal text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md">
                                    {item.scheduledTime}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <StrategyBadge type={item.type} strategies={strategies} />
                                {(item.isPosted || item.status === 'posted') && (
                                  <CheckCircle2 size={14} className="text-green-500" />
                                )}
                                {item.status === 'error' && (
                                  <X size={14} className="text-rose-500" />
                                )}
                              </div>
                            </div>
                            <h4
                              onClick={() => setSelectedPost(item)}
                              className="text-sm font-normal text-slate-900 line-clamp-2 leading-tight uppercase cursor-pointer group-hover:text-indigo-600"
                            >
                              {item.topic}
                            </h4>
                            <div className="h-40 bg-slate-50 rounded-2xl flex items-center justify-center overflow-hidden border border-slate-100 relative group/image">
                              {item.image ? (
                                <>
                                  <img src={item.image} className="w-full h-full object-cover" />
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      handleQuickUpload(item.date);
                                    }}
                                    className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center text-white gap-2 text-2xs font-normal uppercase"
                                  >
                                    <Upload size={16} /> Thay ảnh
                                  </button>
                                </>
                              ) : (
                                <div className="flex flex-col items-center justify-center p-4 text-center">
                                  <Camera size={24} className="text-slate-200 mb-2" />
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      handleQuickUpload(item.date);
                                    }}
                                    className="text-[8px] font-normal text-indigo-600 uppercase tracking-widest mb-1 underline"
                                  >
                                    Tải ảnh lên
                                  </button>
                                  <p className="text-[9px] text-slate-400 italic font-normal leading-tight line-clamp-3">
                                    {item.imageInstruction}
                                  </p>
                                </div>
                              )}
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t mt-auto">
                              <button
                                onClick={() => togglePosted(item.date)}
                                className={`text-2xs font-normal uppercase flex items-center gap-1.5 ${item.isPosted ? 'text-green-600' : 'text-slate-400'}`}
                              >
                                {item.isPosted ? <CheckCircle2 size={14} /> : <Clock size={14} />}{' '}
                                {item.isPosted ? 'Đã đăng' : 'Chưa đăng'}
                              </button>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(item.caption);
                                    alert('Đã copy!');
                                  }}
                                  className="p-2 bg-slate-50 rounded-lg text-slate-400 hover:text-indigo-600 transition-all"
                                >
                                  <Copy size={16} />
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm('Xóa?'))
                                      setSchedule(prev => prev.filter(p => p.date !== item.date));
                                  }}
                                  className="p-2 bg-slate-50 rounded-lg text-slate-400 hover:text-red-600 transition-all"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                    <span className="text-2xs font-normal uppercase tracking-widest">
                      Không tìm thấy bài viết nào
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'facebook' && (
            <MarketingFacebookTab
              fbAppConfig={fbAppConfig}
              setFbAppConfig={setFbAppConfig}
              fbPages={fbPages}
              selectedPageId={selectedPageId}
              setSelectedPageId={setSelectedPageId}
              isFbConnected={isFbConnected}
              setIsFbConnected={setIsFbConnected}
              fbLoading={fbLoading}
              autoPostConfig={autoPostConfig}
              setAutoPostConfig={setAutoPostConfig}
              fetchFbPages={fetchFbPages}
              handleSaveFbConfig={handleSaveFbConfig}
              handleConnectFb={handleConnectFb}
              handleToggleAutoPost={handleToggleAutoPost}
            />
          )}
          {activeTab === 'settings' && (
            <MarketingSettingsTab
              strategies={strategies}
              setStrategies={setStrategies}
              focusProducts={focusProducts}
              setFocusProducts={setFocusProducts}
              aiAdvice={aiAdvice}
              setAiAdvice={setAiAdvice}
              adviceLoading={adviceLoading}
              setAdviceLoading={setAdviceLoading}
              viewDate={viewDate}
              onApplyAdvice={handleApplyAdvice}
            />
          )}
          {activeTab === 'product-content' && <ProductContentTab />}
        </div>
      )}
      </section>

      {selectedPost && (
        <div className="fixed inset-0 z-modal bg-slate-950/90 backdrop-blur-md p-4 flex items-center justify-center">
          <div className="bg-[#f0f2f5] w-full max-w-7xl h-full max-h-[92vh] rounded-[2.5rem] overflow-hidden flex flex-col md:flex-row shadow-2xl relative">
            <button
              onClick={() => setSelectedPost(null)}
              className="absolute top-6 right-6 p-2 bg-white/20 text-white rounded-full hover:bg-white/40 z-50"
            >
              <X size={24} />
            </button>
            <div className="w-full md:w-[420px] bg-white border-r flex flex-col shadow-xl z-10 overflow-hidden">
              <div className="p-6 border-b bg-slate-50 flex gap-2">
                <button
                  onClick={() => setModalMode('edit_caption')}
                  className={`flex-1 py-3 text-2xs font-normal uppercase rounded-xl transition-all ${modalMode === 'edit_caption' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-400 border'}`}
                >
                  Viết Bài
                </button>
                <button
                  onClick={() => setModalMode('resources')}
                  className={`flex-1 py-3 text-2xs font-normal uppercase rounded-xl transition-all ${modalMode === 'resources' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-400 border'}`}
                >
                  Hình Ảnh
                </button>
              </div>
              <div className="flex-1 overflow-hidden p-6 flex flex-col gap-4">
                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="flex flex-col gap-1 min-w-[150px]">
                    <span className="text-[9px] font-normal text-slate-400 uppercase">
                      Ngày đăng
                    </span>
                    <SingleDatePicker
                      value={selectedPost.date}
                      onChange={handleSelectedPostDateChange}
                      className="h-[30px] rounded-lg px-2 text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-normal text-slate-400 uppercase">
                      Giờ lên lịch
                    </span>
                    <input
                      type="time"
                      value={selectedPost.scheduledTime || '08:00'}
                      onChange={e => {
                        const t = e.target.value;
                        const upd = (ls: ContentPlanItem[]) =>
                          ls.map(x =>
                            x.date === selectedPost.date
                              ? { ...x, scheduledTime: t, status: 'scheduled' as const }
                              : x
                          );
                        if (selectedPost.isDraft) setDrafts(upd);
                        else setSchedule(upd);
                        setSelectedPost(p =>
                          p ? { ...p, scheduledTime: t, status: 'scheduled' } : null
                        );
                      }}
                      className="bg-white border rounded-lg px-2 py-1 text-xs font-normal text-indigo-900 outline-none focus:ring-1 ring-indigo-600"
                    />
                  </div>
                  <div className="flex flex-col gap-1 flex-1">
                    <span className="text-[9px] font-normal text-slate-400 uppercase">
                      Trạng thái
                    </span>
                    <div className="flex items-center gap-2">
                      <div
                        className={`px-2 py-1 rounded-md text-[8px] font-normal uppercase ${
                          selectedPost.status === 'posted' || selectedPost.isPosted
                            ? 'bg-green-100 text-green-700'
                            : selectedPost.status === 'error'
                              ? 'bg-rose-100 text-rose-700'
                              : selectedPost.status === 'scheduled'
                                ? 'bg-indigo-100 text-indigo-700'
                                : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {selectedPost.status === 'posted' || selectedPost.isPosted
                          ? 'Đã đăng'
                          : selectedPost.status === 'error'
                            ? 'Lỗi đăng'
                            : selectedPost.status === 'scheduled'
                              ? 'Đã lên lịch'
                              : 'Nháp'}
                      </div>
                      {selectedPost.errorLog && (
                        <span className="text-[8px] text-rose-500 font-normal truncate max-w-[150px]">
                          {selectedPost.errorLog}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {modalMode === 'edit_caption' ? (
                  <textarea
                    value={selectedPost.caption}
                    onChange={e => {
                      const t = e.target.value;
                      const upd = (ls: ContentPlanItem[]) =>
                        ls.map(x => (x.date === selectedPost.date ? { ...x, caption: t } : x));
                      if (selectedPost.isDraft) setDrafts(upd);
                      else setSchedule(upd);
                      setSelectedPost(p => (p ? { ...p, caption: t } : null));
                    }}
                    className="w-full h-full bg-slate-50 p-5 text-sm font-normal rounded-2xl outline-none resize-none"
                  />
                ) : (
                  <div className="flex flex-col gap-4">
                    <button
                      onClick={() => {
                        setUploadingForDate(selectedPost.date);
                        imageUploadRef.current?.click();
                      }}
                      className="w-full py-10 border-2 border-dashed rounded-[2rem] bg-slate-50 flex flex-col items-center gap-2 text-slate-400"
                    >
                      <UploadCloud size={32} />
                      <span className="text-2xs font-normal uppercase">Tải ảnh lên</span>
                    </button>
                    {selectedPost.image && (
                      <img src={selectedPost.image} className="w-full rounded-2xl shadow-xl" />
                    )}
                  </div>
                )}
              </div>
              <div className="p-6 border-t bg-slate-50 space-y-3">
                {isFbConnected && selectedPageId && (
                  <div className="space-y-2">
                    <button
                      onClick={() => handlePostToFb(selectedPost)}
                      disabled={fbLoading || !selectedPost.image}
                      className={`w-full py-4 rounded-xl font-normal text-xs uppercase flex items-center justify-center gap-2 shadow-lg transition-all ${
                        !selectedPost.image
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      {fbLoading ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        <Upload size={16} />
                      )}
                      ĐĂNG LÊN FACEBOOK
                    </button>
                    {!selectedPost.image && (
                      <p className="text-[9px] text-rose-500 font-normal uppercase text-center flex items-center justify-center gap-1">
                        <AlertCircle size={10} /> Vui lòng tải ảnh lên trước khi đăng
                      </p>
                    )}
                  </div>
                )}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(selectedPost.caption);
                    alert('Copy!');
                  }}
                  className="w-full py-3 bg-indigo-50 text-indigo-600 rounded-xl font-normal text-2xs uppercase"
                >
                  COPY NỘI DUNG
                </button>
                <button
                  onClick={() => {
                    if (selectedPost.isDraft) {
                      setSchedule(prev => [...prev, ...drafts]);
                      setDrafts([]);
                    }
                    setSelectedPost(null);
                  }}
                  className="w-full py-4 bg-slate-900 text-white rounded-xl font-normal text-xs uppercase"
                >
                  HOÀN TẤT & LƯU
                </button>
              </div>
            </div>
            <div className="flex-1 bg-[#f0f2f5] p-12 overflow-y-auto hidden md:flex justify-center items-start">
              <FacebookPreview post={selectedPost} brandLogo={brandProfile.logo} brandName={brandProfile.name} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketingManager;
