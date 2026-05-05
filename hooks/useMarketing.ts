
import { useState, useEffect, useMemo } from 'react';
import { supabaseAdmin as supabase } from '../services/supabase';

export function useSyncStorage(userSession: any, isEnabled: boolean = true) {
  const [syncing, setSyncing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchData = async () => {
    // In integrated mode, we might want to use a fixed ID or the MIS session
    // For now, let's use a default 'phuc-sang-marketing' if no session
    const userId = userSession?.user?.id || 'phuc-sang-marketing';
    setInitialLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_state')
        .select('*')
        .eq('user_id', userId)
        .single();
      if (data && !error) return data;
    } catch (e) {
      console.error("Cloud fetch error:", e);
    } finally {
      setInitialLoading(false);
    }
    return null;
  };

  const saveData = async (state: any) => {
    const userId = userSession?.user?.id || 'phuc-sang-marketing';
    if (!isEnabled) return;
    
    setSyncing(true);
    try {
      await supabase.from('app_state').upsert({
        user_id: userId,
        ...state,
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Cloud Sync Error:", e);
    } finally {
      setSyncing(false);
    }
  };

  return { syncing, initialLoading, fetchData, saveData };
}

export function useCalendar(viewDate: Date) {
  const days = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let startIdx = firstDay.getDay() - 1;
    if (startIdx === -1) startIdx = 6;
    
    const result = [];
    for (let i = 0; i < startIdx; i++) result.push({ dayNum: null, dateKey: null });
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const dKey = `${year}-${(month + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
      result.push({ dayNum: i, dateKey: dKey });
    }
    while (result.length < 42) result.push({ dayNum: null, dateKey: null });
    return result;
  }, [viewDate]);

  return days;
}
