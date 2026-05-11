
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Loader2, X, ChevronLeft, ChevronRight, Plus, Trash2,
  Check, Target, Sparkles, UploadCloud, Clock, Copy, Users,
  MessageSquare, Camera, Warehouse, 
  Search, CloudCheck, CloudOff, Upload, CheckCircle2,
  RefreshCw, AlertCircle
} from 'lucide-react';
import { ContentPlanItem, ContentStrategy, ProductLine, BrandProfile, StrategicAdvice } from '../../types';
import { generateContentPlan, getMonthlyStrategicAdvice } from '../../services/marketingClaudeService';
import { supabaseAdmin as supabase } from '../../services/supabase';
import { STRATEGY_COLORS, DEFAULT_STRATEGIES, DEFAULT_FOCUS_PRODUCTS, DEFAULT_BRAND } from '../../constants/marketing';
import { useSyncStorage, useCalendar } from '../../hooks/useMarketing';
import { StrategyBadge, FacebookPreview, SkeletonPost } from './MarketingUI';
import { uploadImage } from '../../services/marketingStorageService';
import { marked } from 'marked';

interface MarketingManagerProps {
  brandProfile: BrandProfile;
  onUpdateBrand: (profile: BrandProfile) => void;
  suggestedFocusProducts?: ProductLine[];
}

const MarketingManager: React.FC<MarketingManagerProps> = ({ brandProfile, onUpdateBrand, suggestedFocusProducts }) => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [schedule, setSchedule] = useState<ContentPlanItem[]>([]);
  const [drafts, setDrafts] = useState<ContentPlanItem[]>([]);
  const [strategies, setStrategies] = useState<ContentStrategy[]>(DEFAULT_STRATEGIES);
  const [focusProducts, setFocusProducts] = useState<ProductLine[]>(DEFAULT_FOCUS_PRODUCTS);

  useEffect(() => {
    if (suggestedFocusProducts && suggestedFocusProducts.length > 0) {
      setFocusProducts(suggestedFocusProducts);
    }
  }, [suggestedFocusProducts]);
  const [aiAdvice, setAiAdvice] = useState<StrategicAdvice | null>(null);
  
  const [isCloudSyncEnabled, setIsCloudSyncEnabled] = useState(() => {
    const saved = localStorage.getItem('ps_cloud_sync_enabled');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [duration, setDuration] = useState<'week' | 'month'>('month');
  const [viewDate, setViewDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'calendar' | 'list' | 'settings' | 'facebook'>('calendar');
  const [selectedPost, setSelectedPost] = useState<(ContentPlanItem & { isDraft?: boolean }) | null>(null);
  
  // Facebook State
  const [fbAppConfig, setFbAppConfig] = useState({ appId: '', appSecret: '' });
  const [fbPages, setFbPages] = useState<any[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string>('');
  const [isFbConnected, setIsFbConnected] = useState(false);
  const [fbLoading, setFbLoading] = useState(false);
  const [autoPostConfig, setAutoPostConfig] = useState({
    enabled: false,
    selectedPageId: '',
    selectedPageName: '',
    selectedPageAccessToken: '',
    logs: [] as any[]
  });

  useEffect(() => {
    // Load FB Config
    fetch('/api/fb/config')
      .then(res => res.json())
      .then(data => {
        setFbAppConfig(prev => ({ ...prev, appId: data.appId }));
      });

    // Load Auto Post Config
    fetch('/api/fb/auto-post/config')
      .then(res => res.json())
      .then(data => {
        if (data) setAutoPostConfig(data);
      });

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
          selectedPageAccessToken: page?.access_token || autoPostConfig.selectedPageAccessToken
        })
      });
      const data = await res.json();
      if (data.success) {
        setAutoPostConfig(data.config);
      }
    } catch (e) {
      console.error("Lỗi cập nhật tự động đăng bài:", e);
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
        console.error("Lỗi lấy Fanpage:", errData.error);
        setIsFbConnected(false);
      }
    } catch (e) {
      console.error("Lỗi Fetch:", e);
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
        body: JSON.stringify(fbAppConfig)
      });
      alert("Đã lưu cấu hình App Facebook!");
    } catch (e) {
      alert("Lỗi lưu cấu hình");
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
        alert(data.error || "Lỗi lấy URL xác thực");
      }
    } catch (e) {
      alert("Lỗi kết nối");
    }
  };

  const handlePostToFb = async (post: ContentPlanItem) => {
    if (!selectedPageId) {
      alert("Vui lòng chọn Fanpage trước!");
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
          message: `${post.topic}\n\n${post.caption}`
        })
      });
      const data = await res.json();
      if (data.success) {
        alert("Đã đăng bài lên Facebook thành công!");
        togglePosted(post.date);
      } else {
        alert("Lỗi đăng bài: " + data.error);
      }
    } catch (e) {
      alert("Lỗi hệ thống khi đăng bài");
    } finally {
      setFbLoading(false);
    }
  };
  const [modalMode, setModalMode] = useState<'edit_caption' | 'resources'>('edit_caption');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStrategyFilter, setSelectedStrategyFilter] = useState<string>('all');
  
  const [uploadingForDate, setUploadingForDate] = useState<string | null>(null);
  const imageUploadRef = useRef<HTMLInputElement>(null);

  const { syncing, initialLoading, fetchData, saveData } = useSyncStorage(session, isCloudSyncEnabled);
  const calendarDays = useCalendar(viewDate);
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  useEffect(() => {
    localStorage.setItem('ps_cloud_sync_enabled', JSON.stringify(isCloudSyncEnabled));
  }, [isCloudSyncEnabled]);

  const nextAvailableStartDate = useMemo(() => {
    if (schedule.length > 0) {
      const lastDate = new Date(schedule[schedule.length - 1].date);
      return new Date(lastDate.getTime() + 86400000).toISOString().split('T')[0];
    }
    return todayStr;
  }, [schedule, todayStr]);

  const generationCount = useMemo(() => {
    const start = new Date(nextAvailableStartDate);
    const lastDayOfMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    const currentDay = start.getDate();
    const daysLeftInMonth = lastDayOfMonth - currentDay + 1;
    const requested = duration === 'week' ? 7 : 30;
    
    return Math.max(0, Math.min(requested, daysLeftInMonth));
  }, [nextAvailableStartDate, duration]);

  useEffect(() => {
    fetchData().then(data => {
      if (data) {
        if (data.schedule) setSchedule(data.schedule);
        if (data.strategies) setStrategies(data.strategies);
        if (data.focus_products) setFocusProducts(data.focus_products);
        if (data.brand_profile) onUpdateBrand(data.brand_profile);
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
          brand_profile: brandProfile,
          selected_page_id: selectedPageId
        });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [schedule, strategies, focusProducts, drafts, brandProfile, selectedPageId, isCloudSyncEnabled]);

  const handleGenerateNext = async () => {
    if (generationCount <= 0) {
      alert("Đã hết ngày trong tháng này. Hãy đợi sang tháng mới hoặc xóa bớt bài cuối tháng!");
      return;
    }
    const total = strategies.reduce((sum, s) => sum + s.percentage, 0);
    if (total !== 100) { alert("Tổng tỉ lệ phải là 100%!"); setActiveTab('settings'); return; }
    
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
    } catch (e) { alert("Lỗi AI: " + (e as Error).message); } finally { setLoading(false); }
  };

  const handleApplyAdvice = () => {
    if (!aiAdvice) return;
    setStrategies(prev => prev.map(s => {
      const suggest = aiAdvice.suggestedDistribution.find(d => d.strategyId === s.id);
      return suggest ? { ...s, percentage: suggest.percentage } : s;
    }));
  };

  const processAndUploadImage = async (file: File, callback: (url: string) => void) => {
    const userId = 'content-images';
    setLoading(true);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height, max = 1200; 
        if (w > h) { if (w > max) { h *= max/w; w = max; } } else { if (h > max) { w *= max/h; h = max; } }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
        
        canvas.toBlob(async (blob) => {
          if (blob) {
            const publicUrl = await uploadImage(userId, 'images', file.name, blob);
            if (publicUrl) {
              callback(publicUrl);
            } else {
              alert("Lỗi tải ảnh lên Cloud!");
            }
            setLoading(false);
            setUploadingForDate(null);
          }
        }, 'image/jpeg', 0.8);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const togglePosted = (date: string) => {
    setSchedule(prev => prev.map(p => p.date === date ? { ...p, isPosted: !p.isPosted } : p));
    if (selectedPost?.date === date) setSelectedPost(p => p ? { ...p, isPosted: !p.isPosted } : null);
  };

  const groupedSchedule = useMemo(() => {
    const filtered = (schedule || []).filter(item => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = (item.topic || "").toLowerCase().includes(q) || (item.caption || "").toLowerCase().includes(q) || (item.type || "").toLowerCase().includes(q);
      const matchesStrategy = selectedStrategyFilter === 'all' || item.type === selectedStrategyFilter;
      return matchesSearch && matchesStrategy;
    }).sort((a, b) => b.date.localeCompare(a.date));
    
    const groups: Record<string, ContentPlanItem[]> = {};
    filtered.forEach(item => {
      const m = `Tháng ${new Date(item.date).getMonth() + 1} / ${new Date(item.date).getFullYear()}`;
      if (!groups[m]) groups[m] = [];
      groups[m].push(item);
    });
    return groups;
  }, [schedule, searchQuery, selectedStrategyFilter]);

  const handleQuickUpload = (date: string) => {
    setUploadingForDate(date);
    imageUploadRef.current?.click();
  };

  return (
    <div className="flex flex-col h-full">
      <input type="file" ref={imageUploadRef} className="hidden" accept="image/*" onChange={e => {
        const f = e.target.files?.[0];
        if (f && uploadingForDate) processAndUploadImage(f, (url) => {
          const upd = (ls: ContentPlanItem[]) => ls.map(p => p.date === uploadingForDate ? {...p, image: url} : p);
          if (drafts.some(d => d.date === uploadingForDate)) setDrafts(upd); else setSchedule(upd);
          if (selectedPost?.date === uploadingForDate) setSelectedPost(p => p ? {...p, image: url} : null);
        });
      }} />

      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-6">
          <nav className="flex gap-1 bg-slate-200 p-1 rounded-xl">
            {['calendar', 'list', 'settings', 'facebook'].map((t: any) => (
              <button key={t} onClick={() => setActiveTab(t)} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === t ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-700'}`}>
                {t === 'calendar' ? 'Lịch Đăng' : t === 'list' ? 'Kho Bài' : t === 'settings' ? 'Chiến Lược' : 'Facebook API'}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
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
               <span className="text-[10px] font-black uppercase text-slate-400 select-none">Backup</span>
             </div>
             <div className="h-4 w-px bg-slate-200"></div>
             <div className="flex items-center gap-2 text-[10px] font-black uppercase">
               {!isCloudSyncEnabled ? (
                 <span className="text-slate-500 flex items-center gap-1.5"><CloudOff size={14}/> Sandbox</span>
               ) : syncing ? (
                 <span className="text-indigo-400 flex items-center gap-1.5"><Loader2 size={14} className="animate-spin"/> Đồng bộ...</span>
               ) : (
                 <span className="text-green-500 flex items-center gap-1.5"><CloudCheck size={14}/> Cloud Live</span>
               )}
             </div>
          </div>
          <button 
            onClick={handleGenerateNext} 
            disabled={loading || generationCount <= 0} 
            className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-xl text-white text-xs font-black flex items-center gap-2 shadow-lg disabled:opacity-50 transition-all"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />} 
            {generationCount > 0 ? `SÁNG TẠO ${generationCount} BÀI` : 'ĐÃ ĐỦ BÀI THÁNG'}
          </button>
        </div>
      </div>

      {initialLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl p-6">
             {[1,2,3].map(i => <SkeletonPost key={i}/>)}
           </div>
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đang tải dữ liệu...</span>
        </div>
      ) : (
        <div className="flex-1 bg-white border border-slate-200 rounded-[2.5rem] shadow-xl overflow-auto flex flex-col relative min-h-[600px]">
          {activeTab === 'calendar' && (
            <div className="flex flex-col h-full min-w-[1000px]">
              <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-20">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                    <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} className="p-2 hover:bg-white rounded-lg transition-all"><ChevronLeft size={18}/></button>
                    <span className="px-6 text-sm font-black uppercase tracking-wide">{viewDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}</span>
                    <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} className="p-2 hover:bg-white rounded-lg transition-all"><ChevronRight size={18}/></button>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
                    <button onClick={() => setDuration('week')} className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase transition-all duration-200 ${duration === 'week' ? 'bg-white text-indigo-600 shadow-md ring-1 ring-slate-200/50' : 'text-slate-400 hover:text-slate-600'}`}>Tuần</button>
                    <button onClick={() => setDuration('month')} className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase transition-all duration-200 ${duration === 'month' ? 'bg-white text-indigo-600 shadow-md ring-1 ring-slate-200/50' : 'text-slate-400 hover:text-slate-600'}`}>Tháng</button>
                  </div>
                </div>
                {drafts.length > 0 && (
                  <button onClick={() => { setSchedule(prev => [...prev, ...drafts]); setDrafts([]); }} className="bg-indigo-600 text-white px-8 py-3 rounded-xl text-xs font-black shadow-lg animate-bounce uppercase">Duyệt vào kho ({drafts.length})</button>
                )}
              </div>
              <div className="grid grid-cols-7 bg-slate-900 text-white text-[10px] font-black py-3 text-center uppercase tracking-widest sticky top-[80px] z-10">
                {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(d => <div key={d}>{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-[1px] bg-slate-100 flex-1">
                {calendarDays.map((day, idx) => {
                  const post = schedule.find(s => s.date === day.dateKey) || drafts.find(d => d.date === day.dateKey);
                  const isDraft = drafts.some(d => d.date === day.dateKey);
                  const isToday = day.dateKey === todayStr;
                  return (
                    <div key={idx} onClick={() => post && setSelectedPost({...post, isDraft})} className={`bg-white p-3 min-h-[160px] flex flex-col gap-2 relative group transition-all ${post ? 'cursor-pointer hover:bg-slate-50' : ''} ${day.dayNum === null ? 'bg-slate-50/30' : ''} ${isToday ? 'ring-2 ring-amber-400 ring-inset bg-amber-50/30' : ''}`}>
                      {day.dayNum && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-black ${post ? (isDraft ? 'bg-orange-500 text-white' : 'bg-slate-900 text-white') : 'text-slate-300'}`}>
                              {day.dayNum}
                            </span>
                            {post?.isPosted && <CheckCircle2 size={14} className="text-green-500" />}
                          </div>
                          {post && (
                            <div className="flex flex-col gap-1.5">
                              <StrategyBadge type={post.type} strategies={strategies} />
                              <h4 className="text-[10px] font-black leading-tight line-clamp-3 uppercase tracking-tighter text-slate-700">{post.topic}</h4>
                              {isDraft && <span className="text-[8px] text-orange-500 font-bold italic uppercase">Bản thảo</span>}
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
                <h3 className="text-xl font-black uppercase text-slate-900 tracking-tight">Kho bài viết</h3>
                <div className="flex gap-2">
                  <button onClick={() => setSearchQuery('')} className="p-2 text-slate-400 hover:text-slate-600"><X size={20}/></button>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="bg-slate-50 border rounded-xl pl-10 pr-4 py-2 text-xs font-bold outline-none focus:border-indigo-500 w-64" placeholder="Tìm bài viết..."/>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mb-8 overflow-x-auto scrollbar-hide">
                <button onClick={() => setSelectedStrategyFilter('all')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${selectedStrategyFilter === 'all' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>Tất cả</button>
                {(strategies || []).map(s => {
                  const style = STRATEGY_COLORS[s.color as keyof typeof STRATEGY_COLORS] || STRATEGY_COLORS['blue'];
                  const isActive = selectedStrategyFilter === s.name;
                  return (
                    <button key={s.id} onClick={() => setSelectedStrategyFilter(s.name)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase border transition-all whitespace-nowrap flex items-center gap-2 ${isActive ? `${style.bg} ${style.text} ${style.border} shadow-sm ring-1 ring-offset-1 ring-slate-100` : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${style.dot}`}></div>
                      {s.name}
                    </button>
                  );
                })}
              </div>
              <div className="flex-1 overflow-y-auto pr-2 space-y-10">
                {Object.entries(groupedSchedule).length > 0 ? Object.entries(groupedSchedule).map(([month, items]) => (
                  <div key={month} className="space-y-4">
                    <div className="flex items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <span>{month}</span>
                      <div className="flex-1 h-px bg-slate-100"></div>
                      <span>{(items as ContentPlanItem[]).length} BÀI</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {(items as ContentPlanItem[]).map((item, i) => (
                        <div key={i} className={`bg-white p-6 rounded-3xl border transition-all hover:shadow-lg group flex flex-col gap-4 relative ${item.isPosted || item.status === 'posted' ? 'border-green-100' : item.status === 'error' ? 'border-rose-100' : item.status === 'scheduled' ? 'border-indigo-100' : 'border-slate-100'}`}>
                          {!item.image && (
                            <div className="absolute top-4 right-4 z-10">
                              <div className="bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full text-[8px] font-black uppercase flex items-center gap-1 shadow-sm">
                                <AlertCircle size={10}/> Thiếu ảnh
                              </div>
                            </div>
                          )}
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-indigo-500">{item.date.split('-').reverse().join('/')}</span>
                              {item.scheduledTime && <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md">{item.scheduledTime}</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              <StrategyBadge type={item.type} strategies={strategies}/>
                              {(item.isPosted || item.status === 'posted') && <CheckCircle2 size={14} className="text-green-500" />}
                              {item.status === 'error' && <X size={14} className="text-rose-500" />}
                            </div>
                          </div>
                          <h4 onClick={() => setSelectedPost(item)} className="text-sm font-black text-slate-900 line-clamp-2 leading-tight uppercase cursor-pointer group-hover:text-indigo-600">{item.topic}</h4>
                          <div className="h-40 bg-slate-50 rounded-2xl flex items-center justify-center overflow-hidden border border-slate-100 relative group/image">
                            {item.image ? (
                              <>
                                <img src={item.image} className="w-full h-full object-cover" />
                                <button onClick={(e) => { e.stopPropagation(); handleQuickUpload(item.date); }} className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center text-white gap-2 text-[10px] font-black uppercase"><Upload size={16}/> Thay ảnh</button>
                              </>
                            ) : (
                              <div className="flex flex-col items-center justify-center p-4 text-center">
                                <Camera size={24} className="text-slate-200 mb-2" />
                                <button onClick={(e) => { e.stopPropagation(); handleQuickUpload(item.date); }} className="text-[8px] font-black text-indigo-600 uppercase tracking-widest mb-1 underline">Tải ảnh lên</button>
                                <p className="text-[9px] text-slate-400 italic font-medium leading-tight line-clamp-3">{item.imageInstruction}</p>
                              </div>
                            )}
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t mt-auto">
                            <button onClick={() => togglePosted(item.date)} className={`text-[10px] font-black uppercase flex items-center gap-1.5 ${item.isPosted ? 'text-green-600' : 'text-slate-400'}`}>
                              {item.isPosted ? <CheckCircle2 size={14}/> : <Clock size={14}/>} {item.isPosted ? 'Đã đăng' : 'Chưa đăng'}
                            </button>
                            <div className="flex gap-2">
                              <button onClick={() => { navigator.clipboard.writeText(item.caption); alert("Đã copy!"); }} className="p-2 bg-slate-50 rounded-lg text-slate-400 hover:text-indigo-600 transition-all"><Copy size={16}/></button>
                              <button onClick={() => { if(confirm("Xóa?")) setSchedule(prev => prev.filter(p => p.date !== item.date)); }} className="p-2 bg-slate-50 rounded-lg text-slate-400 hover:text-red-600 transition-all"><Trash2 size={16}/></button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )) : (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                    <span className="text-[10px] font-black uppercase tracking-widest">Không tìm thấy bài viết nào</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'facebook' && (
            <div className="p-8 flex flex-col gap-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Cấu hình App & Kết nối */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                      <Sparkles size={20} />
                    </div>
                    <h3 className="text-sm font-black uppercase text-slate-800">Cấu hình & Kết nối</h3>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">App ID</label>
                      <input 
                        type="text" 
                        value={fbAppConfig.appId} 
                        onChange={e => setFbAppConfig(prev => ({ ...prev, appId: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-indigo-500"
                        placeholder="Nhập App ID..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">App Secret</label>
                      <input 
                        type="password" 
                        value={fbAppConfig.appSecret} 
                        onChange={e => setFbAppConfig(prev => ({ ...prev, appSecret: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-indigo-500"
                        placeholder="Nhập App Secret..."
                      />
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={handleSaveFbConfig}
                        disabled={fbLoading}
                        className="flex-1 py-4 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase hover:bg-slate-800 transition-all disabled:opacity-50"
                      >
                        {fbLoading ? "Đang lưu..." : "Lưu cấu hình"}
                      </button>
                      
                      {!isFbConnected ? (
                        <button 
                          onClick={handleConnectFb}
                          disabled={fbLoading || !fbAppConfig.appId}
                          className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {fbLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                          Kết nối ngay
                        </button>
                      ) : (
                        <div className="flex-1 flex gap-2">
                          <button 
                            onClick={fetchFbPages}
                            disabled={fbLoading}
                            className="flex-1 py-4 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl font-black text-[10px] uppercase hover:bg-indigo-100 transition-all flex items-center justify-center gap-2"
                          >
                            <RefreshCw size={14} className={fbLoading ? "animate-spin" : ""} />
                            Làm mới
                          </button>
                          <button 
                            onClick={() => setIsFbConnected(false)}
                            className="flex-1 py-4 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl font-black text-[10px] uppercase hover:bg-rose-100 transition-all"
                          >
                            Ngắt kết nối
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {isFbConnected && (
                    <div className="p-4 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-[10px] font-black text-green-700 uppercase">Tài khoản đã sẵn sàng</span>
                      </div>
                      <button onClick={fetchFbPages} className="text-[9px] font-black text-indigo-600 uppercase underline">Cập nhật lại</button>
                    </div>
                  )}
                </div>

                {/* Danh sách Fanpage */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isFbConnected ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-400'}`}>
                        <Users size={20} />
                      </div>
                      <h3 className="text-sm font-black uppercase text-slate-800">Danh sách Fanpage</h3>
                    </div>
                    {isFbConnected && (
                      <button 
                        onClick={fetchFbPages}
                        disabled={fbLoading}
                        className="p-2 hover:bg-slate-50 rounded-full text-slate-400 hover:text-indigo-600 transition-all"
                        title="Tải lại danh sách"
                      >
                        <RefreshCw size={16} className={fbLoading ? "animate-spin" : ""} />
                      </button>
                    )}
                  </div>
                  
                  {!isFbConnected ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                        <CloudOff size={32} />
                      </div>
                      <p className="text-[10px] text-slate-400 font-black uppercase max-w-[200px] leading-relaxed">
                        Vui lòng kết nối Facebook ở cột bên trái để xem danh sách Fanpage.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Chọn Fanpage để đăng bài</label>
                      <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {fbPages.length > 0 ? fbPages.map(page => (
                          <button 
                            key={page.id}
                            onClick={() => {
                              setSelectedPageId(page.id);
                              // Nếu đang bật tự động, cập nhật luôn trang được chọn
                              if (autoPostConfig.enabled) {
                                handleToggleAutoPost(true);
                              }
                            }}
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${selectedPageId === page.id ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600' : 'border-slate-100 hover:border-slate-200 bg-slate-50'}`}
                          >
                            <div className="w-10 h-10 bg-white rounded-full border border-slate-200 flex items-center justify-center overflow-hidden">
                              <img src={`https://graph.facebook.com/${page.id}/picture`} alt="" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[11px] font-black text-slate-800 uppercase">{page.name}</span>
                              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">ID: {page.id}</span>
                            </div>
                            {selectedPageId === page.id && <Check className="ml-auto text-indigo-600" size={16} />}
                          </button>
                        )) : (
                          <div className="flex flex-col items-center gap-3 py-10 text-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase">Không tìm thấy Fanpage nào</p>
                            <p className="text-[9px] text-slate-400 leading-relaxed max-w-[200px]">
                              Lưu ý: Bạn cần "Tích chọn" các Fanpage trong cửa sổ Facebook khi kết nối. Hãy thử "Ngắt kết nối" và kết nối lại.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Auto Post Toggle */}
                      {isFbConnected && selectedPageId && (
                        <div className="pt-4 border-t border-slate-100 space-y-4">
                          <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-indigo-900 uppercase">Tự động đăng bài</span>
                              <span className="text-[9px] text-indigo-600 font-bold uppercase">Theo lịch đã lên</span>
                            </div>
                            <button 
                              onClick={() => handleToggleAutoPost(!autoPostConfig.enabled)}
                              className={`w-12 h-6 rounded-full transition-all relative ${autoPostConfig.enabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
                            >
                              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${autoPostConfig.enabled ? 'left-7' : 'left-1'}`}></div>
                            </button>
                          </div>

                          {/* Mini Logs */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between px-1">
                              <span className="text-[9px] font-black text-slate-400 uppercase">Nhật ký hoạt động</span>
                              <button onClick={() => fetch('/api/fb/auto-post/logs').then(r => r.json()).then(l => setAutoPostConfig(prev => ({...prev, logs: l})))} className="text-[9px] font-bold text-indigo-600 uppercase">Làm mới</button>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 max-h-[120px] overflow-y-auto custom-scrollbar space-y-2">
                              {autoPostConfig.logs.length > 0 ? autoPostConfig.logs.slice(0, 5).map(log => (
                                <div key={log.id} className="flex flex-col gap-0.5 border-b border-slate-200 pb-1 last:border-0">
                                  <div className="flex items-center justify-between">
                                    <span className={`text-[8px] font-black uppercase ${log.type === 'success' ? 'text-green-600' : log.type === 'error' ? 'text-rose-600' : 'text-slate-500'}`}>
                                      {log.type}
                                    </span>
                                    <span className="text-[7px] text-slate-400 font-bold">{log.time}</span>
                                  </div>
                                  <p className="text-[9px] text-slate-700 font-medium leading-tight">{log.message}</p>
                                </div>
                              )) : (
                                <p className="text-center py-4 text-[8px] font-bold text-slate-400 uppercase italic">Chưa có hoạt động nào</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {activeTab === 'settings' && (
            <div className="p-6 flex flex-col gap-4 h-full overflow-hidden">
              {/* Top Section: Two Columns */}
              <div className="flex flex-col md:flex-row gap-4 flex-[2] min-h-0">
                {/* Left Column: Post Distribution (40%) */}
                <div className="w-full md:w-[40%] flex flex-col border rounded-[2rem] overflow-hidden bg-slate-50/30">
                  <div className="p-4 bg-white border-b flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-xs font-black uppercase text-slate-800">Tỉ lệ bài đăng</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${strategies.reduce((sum, s) => sum + s.percentage, 0) === 100 ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`}></div>
                        <span className={`text-[9px] font-bold uppercase ${strategies.reduce((sum, s) => sum + s.percentage, 0) === 100 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          Tổng: {strategies.reduce((sum, s) => sum + s.percentage, 0)}%
                        </span>
                      </div>
                    </div>
                    <button onClick={() => setStrategies(prev => [...prev, {id: Date.now().toString(), name: 'Tuyến mới', percentage: 0, description: '', color: 'blue'}])} className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-md"><Plus size={14}/></button>
                  </div>
                  <div className="p-4 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                    {/* Multi-color progress bar */}
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner border border-slate-200">
                      {strategies.map((s, idx) => (
                        <div 
                          key={s.id} 
                          style={{ width: `${s.percentage}%`, backgroundColor: (STRATEGY_COLORS[s.color as keyof typeof STRATEGY_COLORS] || STRATEGY_COLORS['blue']).hex }}
                          className="h-full transition-all duration-500 ease-out border-r border-white/20 last:border-r-0"
                          title={`${s.name}: ${s.percentage}%`}
                        />
                      ))}
                    </div>

                    <div className="space-y-2">
                      {(strategies || []).map(s => (
                        <div key={s.id} className="group bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all duration-200">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1 mr-3">
                              <input 
                                value={s.name} 
                                onChange={e => setStrategies(prev => prev.map(x => x.id === s.id ? {...x, name: e.target.value} : x))} 
                                className="w-full font-black text-[10px] uppercase outline-none border-b border-transparent focus:border-indigo-400 bg-transparent py-0.5 transition-colors" 
                                placeholder="Tên tuyến..."
                              />
                              <div className="mt-1 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full transition-all duration-500" 
                                  style={{
                                    width: `${Math.min(100, s.percentage)}%`,
                                    backgroundColor: (STRATEGY_COLORS[s.color as keyof typeof STRATEGY_COLORS] || STRATEGY_COLORS['blue']).hex
                                  }}
                                />
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <div className="flex items-center bg-slate-50 rounded-lg px-2 py-1 border border-slate-100 group-hover:border-indigo-100 transition-colors">
                                <input 
                                  type="number" 
                                  value={s.percentage} 
                                  onChange={e => setStrategies(prev => prev.map(x => x.id === s.id ? {...x, percentage: parseInt(e.target.value)||0} : x))} 
                                  className="w-8 text-right text-[10px] font-black outline-none bg-transparent text-indigo-900"
                                />
                                <span className="ml-0.5 text-[8px] font-black text-slate-400">%</span>
                              </div>
                              <button 
                                onClick={() => setStrategies(prev => prev.filter(x => x.id !== s.id))} 
                                className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-all opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 size={12}/>
                              </button>
                            </div>
                          </div>
                          <div className="flex gap-1.5">
                            {Object.entries(STRATEGY_COLORS).map(([colorName, colorValue]) => (
                              <button
                                key={colorName}
                                onClick={() => setStrategies(prev => prev.map(x => x.id === s.id ? {...x, color: colorName} : x))}
                                className={`w-3 h-3 rounded-full border transition-transform hover:scale-125 ${s.color === colorName ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                                style={{ backgroundColor: colorValue.hex }}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column: Focus Products (60%) */}
                <div className="w-full md:w-[60%] flex flex-col border rounded-[2rem] overflow-hidden bg-slate-50/30">
                  <div className="p-3 bg-white border-b flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-red-600">Sản phẩm trọng tâm</span>
                    <button 
                      onClick={() => {
                        const name = window.prompt("Nhập tên sản phẩm trọng tâm mới:");
                        if (name) {
                          setFocusProducts(prev => [...prev, {id: Date.now().toString(), name, target: 'Khách hàng mục tiêu', highlights: 'Đặc điểm nổi bật', isSelected: true}]);
                        }
                      }} 
                      className="p-1 bg-red-600 text-white rounded-md shadow-md hover:bg-red-700 transition-colors"
                    >
                      <Plus size={12}/>
                    </button>
                  </div>
                  <div className="p-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 overflow-y-auto flex-1 custom-scrollbar">
                    {(focusProducts || []).map(p => (
                      <div key={p.id} className={`bg-white px-2 py-1 rounded-lg border border-l-2 ${p.isSelected !== false ? 'border-l-red-500' : 'border-l-slate-300 opacity-60'} shadow-sm flex justify-between items-center gap-2 hover:shadow-md transition-all group h-fit`}>
                         <div className="flex items-center gap-2 flex-1 min-w-0">
                           <input 
                             type="checkbox" 
                             checked={p.isSelected !== false} 
                             onChange={() => setFocusProducts(prev => prev.map(x => x.id === p.id ? {...x, isSelected: !(x.isSelected !== false)} : x))}
                             className="w-3 h-3 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                           />
                           <span className={`font-black text-xs uppercase truncate ${p.isSelected !== false ? 'text-slate-800' : 'text-slate-400'}`}>
                             {p.name}
                           </span>
                         </div>
                         <button onClick={() => setFocusProducts(prev => prev.filter(x => x.id !== p.id))} className="text-slate-200 hover:text-red-500 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100">
                          <Trash2 size={12}/>
                         </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Section: AI Analysis (Full Width) */}
              <div className="bg-indigo-900 rounded-[2rem] p-5 text-white flex flex-col md:flex-row justify-between items-center gap-5 flex-shrink-0">
                <div className="flex flex-col gap-2 text-center md:text-left flex-1">
                  <div className="flex items-center gap-2 bg-indigo-800 w-fit px-2 py-0.5 rounded-md text-[8px] font-black uppercase mx-auto md:mx-0"><Sparkles size={12} className="text-yellow-400"/> Phân tích AI</div>
                  <div className="flex items-center gap-4">
                    <h2 className="text-xl font-black uppercase tracking-tight">Tháng {viewDate.getMonth()+1} / {viewDate.getFullYear()}</h2>
                    <div className="flex gap-2">
                      {adviceLoading ? <Loader2 className="animate-spin" size={16} /> : <button onClick={async () => { setAdviceLoading(true); setAiAdvice(await getMonthlyStrategicAdvice(viewDate.getMonth()+1, viewDate.getFullYear(), strategies)); setAdviceLoading(false); }} className="bg-white text-indigo-900 px-4 py-1.5 rounded-lg font-black text-[9px] uppercase shadow-md hover:scale-105 transition-all">Phân tích mới</button>}
                      {aiAdvice && <button onClick={handleApplyAdvice} className="bg-indigo-700 text-white border border-indigo-500 px-4 py-1.5 rounded-lg font-black text-[9px] uppercase hover:bg-indigo-600 transition-all">Áp dụng tỉ lệ</button>}
                    </div>
                  </div>
                  <p className="text-indigo-200 text-[10px] max-w-3xl line-clamp-2 font-medium italic">{aiAdvice?.marketInsight || "Hãy chạy phân tích để nhận lời khuyên thị trường..."}</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full md:w-auto">
                  {(aiAdvice?.holidays || []).slice(0, 4).map((h, i) => <div key={i} className="bg-white/10 p-2 rounded-lg border border-white/5 text-[8px] font-black uppercase text-center whitespace-nowrap">{h}</div>)}
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {selectedPost && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md p-4 flex items-center justify-center">
          <div className="bg-[#f0f2f5] w-full max-w-7xl h-full max-h-[92vh] rounded-[2.5rem] overflow-hidden flex flex-col md:flex-row shadow-2xl relative">
            <button onClick={() => setSelectedPost(null)} className="absolute top-6 right-6 p-2 bg-white/20 text-white rounded-full hover:bg-white/40 z-50"><X size={24}/></button>
            <div className="w-full md:w-[420px] bg-white border-r flex flex-col shadow-xl z-10 overflow-hidden">
               <div className="p-6 border-b bg-slate-50 flex gap-2">
                 <button onClick={() => setModalMode('edit_caption')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${modalMode==='edit_caption'?'bg-indigo-600 text-white shadow-lg':'bg-white text-slate-400 border'}`}>Viết Bài</button>
                 <button onClick={() => setModalMode('resources')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${modalMode==='resources'?'bg-indigo-600 text-white shadow-lg':'bg-white text-slate-400 border'}`}>Hình Ảnh</button>
               </div>
               <div className="flex-1 overflow-hidden p-6 flex flex-col gap-4">
                 <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                   <div className="flex flex-col gap-1">
                     <span className="text-[9px] font-black text-slate-400 uppercase">Giờ lên lịch</span>
                     <input 
                       type="time" 
                       value={selectedPost.scheduledTime || "08:00"} 
                       onChange={e => {
                         const t = e.target.value;
                         const upd = (ls: ContentPlanItem[]) => ls.map(x => x.date === selectedPost.date ? {...x, scheduledTime: t, status: 'scheduled' as const} : x);
                         if (selectedPost.isDraft) setDrafts(upd); else setSchedule(upd);
                         setSelectedPost(p => p ? {...p, scheduledTime: t, status: 'scheduled'} : null);
                       }}
                       className="bg-white border rounded-lg px-2 py-1 text-xs font-black text-indigo-900 outline-none focus:ring-1 ring-indigo-600"
                     />
                   </div>
                   <div className="flex flex-col gap-1 flex-1">
                     <span className="text-[9px] font-black text-slate-400 uppercase">Trạng thái</span>
                     <div className="flex items-center gap-2">
                       <div className={`px-2 py-1 rounded-md text-[8px] font-black uppercase ${
                         selectedPost.status === 'posted' || selectedPost.isPosted ? 'bg-green-100 text-green-700' :
                         selectedPost.status === 'error' ? 'bg-rose-100 text-rose-700' :
                         selectedPost.status === 'scheduled' ? 'bg-indigo-100 text-indigo-700' :
                         'bg-slate-100 text-slate-600'
                       }`}>
                         {selectedPost.status === 'posted' || selectedPost.isPosted ? 'Đã đăng' :
                          selectedPost.status === 'error' ? 'Lỗi đăng' :
                          selectedPost.status === 'scheduled' ? 'Đã lên lịch' :
                          'Nháp'}
                       </div>
                       {selectedPost.errorLog && <span className="text-[8px] text-rose-500 font-bold truncate max-w-[150px]">{selectedPost.errorLog}</span>}
                     </div>
                   </div>
                 </div>
                 {modalMode === 'edit_caption' ? (
                   <textarea value={selectedPost.caption} onChange={e => {
                      const t = e.target.value;
                      const upd = (ls: ContentPlanItem[]) => ls.map(x => x.date === selectedPost.date ? {...x, caption: t} : x);
                      if (selectedPost.isDraft) setDrafts(upd); else setSchedule(upd);
                      setSelectedPost(p => p ? {...p, caption: t} : null);
                    }} className="w-full h-full bg-slate-50 p-5 text-sm font-medium rounded-2xl outline-none resize-none" />
                 ) : (
                   <div className="flex flex-col gap-4">
                     <button onClick={() => { setUploadingForDate(selectedPost.date); imageUploadRef.current?.click(); }} className="w-full py-10 border-2 border-dashed rounded-[2rem] bg-slate-50 flex flex-col items-center gap-2 text-slate-400">
                       <UploadCloud size={32}/> 
                       <span className="text-[10px] font-black uppercase">Tải ảnh lên</span>
                     </button>
                     {selectedPost.image && <img src={selectedPost.image} className="w-full rounded-2xl shadow-xl" />}
                   </div>
                 )}
               </div>
                <div className="p-6 border-t bg-slate-50 space-y-3">
                  {isFbConnected && selectedPageId && (
                    <div className="space-y-2">
                      <button 
                        onClick={() => handlePostToFb(selectedPost)} 
                        disabled={fbLoading || !selectedPost.image}
                        className={`w-full py-4 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg transition-all ${
                          !selectedPost.image 
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' 
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }`}
                      >
                        {fbLoading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                        ĐĂNG LÊN FACEBOOK
                      </button>
                      {!selectedPost.image && (
                        <p className="text-[9px] text-rose-500 font-black uppercase text-center flex items-center justify-center gap-1">
                          <AlertCircle size={10}/> Vui lòng tải ảnh lên trước khi đăng
                        </p>
                      )}
                    </div>
                  )}
                  <button onClick={() => { navigator.clipboard.writeText(selectedPost.caption); alert("Copy!"); }} className="w-full py-3 bg-indigo-50 text-indigo-600 rounded-xl font-black text-[10px] uppercase">COPY NỘI DUNG</button>
                  <button onClick={() => { if(selectedPost.isDraft) { setSchedule(prev => [...prev, ...drafts]); setDrafts([]); } setSelectedPost(null); }} className="w-full py-4 bg-slate-900 text-white rounded-xl font-black text-xs uppercase">HOÀN TẤT & LƯU</button>
                </div>
            </div>
            <div className="flex-1 bg-[#f0f2f5] p-12 overflow-y-auto hidden md:flex justify-center items-start">
              <FacebookPreview post={selectedPost} brandLogo={brandProfile.logo} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketingManager;
