import { useState, useMemo, useDeferredValue } from 'react';
import { ContentPlanItem, ContentStrategy, ProductLine, StrategicAdvice } from '../types';
import { DEFAULT_STRATEGIES, DEFAULT_FOCUS_PRODUCTS } from '../constants/marketing';

export type MarketingTab = 'calendar' | 'list' | 'settings' | 'facebook' | 'product-content';

export function useMarketingState() {
  // Core content states
  const [loading, setLoading] = useState(false);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [schedule, setSchedule] = useState<ContentPlanItem[]>([]);
  const [drafts, setDrafts] = useState<ContentPlanItem[]>([]);
  const [strategies, setStrategies] = useState<ContentStrategy[]>(DEFAULT_STRATEGIES);
  const [focusProducts, setFocusProducts] = useState<ProductLine[]>(DEFAULT_FOCUS_PRODUCTS);
  const [aiAdvice, setAiAdvice] = useState<StrategicAdvice | null>(null);

  // Cloud sync state
  const [isCloudSyncEnabled, setIsCloudSyncEnabled] = useState(() => {
    const saved = localStorage.getItem('ps_cloud_sync_enabled');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // View states
  const [duration, setDuration] = useState<'week' | 'month'>('month');
  const [viewDate, setViewDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<MarketingTab>('calendar');
  const [selectedPost, setSelectedPost] = useState<
    (ContentPlanItem & { isDraft?: boolean }) | null
  >(null);

  // Modal states
  const [modalMode, setModalMode] = useState<'edit_caption' | 'resources'>('edit_caption');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [selectedStrategyFilter, setSelectedStrategyFilter] = useState<string>('all');

  // Upload state
  const [uploadingForDate, setUploadingForDate] = useState<string | null>(null);

  // Computed values
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

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

  // Helper functions
  const togglePosted = (date: string) => {
    setSchedule(prev => prev.map(p => (p.date === date ? { ...p, isPosted: !p.isPosted } : p)));
    if (selectedPost?.date === date)
      setSelectedPost(p => (p ? { ...p, isPosted: !p.isPosted } : null));
  };

  return {
    // Core states
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

    // Cloud sync
    isCloudSyncEnabled,
    setIsCloudSyncEnabled,

    // View states
    duration,
    setDuration,
    viewDate,
    setViewDate,
    activeTab,
    setActiveTab,
    selectedPost,
    setSelectedPost,

    // Modal states
    modalMode,
    setModalMode,
    searchQuery,
    setSearchQuery,
    deferredSearchQuery,
    selectedStrategyFilter,
    setSelectedStrategyFilter,

    // Upload
    uploadingForDate,
    setUploadingForDate,

    // Computed
    todayStr,
    nextAvailableStartDate,
    generationCount,

    // Helpers
    togglePosted,
  };
}
