import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppAlert, AlertConfig } from '../../types';

const ALERT_CONFIG_KEY = 'alert-config';

export const DEFAULT_ALERT_CONFIG: AlertConfig = {
  defaultMinStock: 5,
  debtOverdueDays: 30,
  revenueDropPct: 50,
};

export async function loadAlertConfig(supabase: SupabaseClient): Promise<AlertConfig> {
  try {
    const { data } = await supabase
      .from('app_state')
      .select('schedule')
      .eq('user_id', ALERT_CONFIG_KEY)
      .single();
    if (data?.schedule) return { ...DEFAULT_ALERT_CONFIG, ...data.schedule };
  } catch {}
  return { ...DEFAULT_ALERT_CONFIG };
}

export async function saveAlertConfig(supabase: SupabaseClient, config: AlertConfig): Promise<void> {
  await supabase.from('app_state').upsert({
    user_id: ALERT_CONFIG_KEY,
    schedule: config,
    updated_at: new Date().toISOString(),
  });
}

function makeId(type: string, key: string) {
  return `${type}_${key}`;
}

async function checkLowStock(supabase: SupabaseClient, config: AlertConfig): Promise<AppAlert[]> {
  const { data, error } = await supabase
    .from('pos_products')
    .select('id, name, sku, stock, min_stock, status')
    .eq('status', 'Active');

  if (error || !data) return [];

  const alerts: AppAlert[] = [];
  const now = new Date().toISOString();

  for (const p of data) {
    const minStock = p.min_stock ?? config.defaultMinStock;
    if (p.stock <= 0) {
      alerts.push({
        id: makeId('low_stock', p.id),
        type: 'low_stock',
        severity: 'critical',
        title: `Hết hàng: ${p.name}`,
        message: `Sản phẩm "${p.name}" (${p.sku}) đã hết hàng. Cần nhập ngay.`,
        createdAt: now,
      });
    } else if (p.stock <= minStock) {
      alerts.push({
        id: makeId('low_stock', p.id),
        type: 'low_stock',
        severity: 'warning',
        title: `Sắp hết: ${p.name}`,
        message: `"${p.name}" còn ${p.stock} cái (ngưỡng tối thiểu: ${minStock}). Cân nhắc nhập thêm.`,
        createdAt: now,
      });
    }
  }

  return alerts;
}

async function checkOverdueDebts(supabase: SupabaseClient, config: AlertConfig): Promise<AppAlert[]> {
  const { data, error } = await supabase
    .from('supplier_debts')
    .select('supplier_id, supplier_name, date, type, amount');

  if (error || !data) return [];

  const thresholdDate = new Date(Date.now() - config.debtOverdueDays * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];
  const now = new Date().toISOString();

  const balanceMap = new Map<string, { name: string; balance: number; lastActivity: string }>();
  for (const r of data) {
    if (!balanceMap.has(r.supplier_id)) {
      balanceMap.set(r.supplier_id, { name: r.supplier_name, balance: 0, lastActivity: r.date });
    }
    const entry = balanceMap.get(r.supplier_id)!;
    entry.balance += r.type === 'purchase' ? r.amount : -r.amount;
    if (r.date > entry.lastActivity) entry.lastActivity = r.date;
  }

  const alerts: AppAlert[] = [];
  for (const [supplierId, entry] of balanceMap) {
    if (entry.balance > 0 && entry.lastActivity < thresholdDate) {
      alerts.push({
        id: makeId('overdue_debt', supplierId),
        type: 'overdue_debt',
        severity: 'warning',
        title: `Công nợ chưa thanh toán: ${entry.name}`,
        message: `Còn nợ ${entry.name.toUpperCase()} ${entry.balance.toLocaleString('vi-VN')}đ — hoạt động cuối ${entry.lastActivity} (hơn ${config.debtOverdueDays} ngày trước).`,
        createdAt: now,
      });
    }
  }

  return alerts;
}

async function checkRevenueDrop(supabase: SupabaseClient, config: AlertConfig): Promise<AppAlert[]> {
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('revenue_records')
    .select('date, net_revenue')
    .gte('date', sevenDaysAgo)
    .order('date', { ascending: false });

  if (error || !data || data.length < 2) return [];

  const revenueRows = data as { date: string; net_revenue?: number }[];
  const yesterdayRecord = revenueRows.find(r => r.date === yesterday);
  if (!yesterdayRecord) return [];

  const prior6Days = revenueRows.filter(r => r.date >= sevenDaysAgo && r.date < yesterday);
  if (prior6Days.length === 0) return [];

  const avg = prior6Days.reduce((s, r) => s + (r.net_revenue || 0), 0) / prior6Days.length;
  const yesterdayRevenue = yesterdayRecord.net_revenue || 0;
  const threshold = config.revenueDropPct / 100;

  if (avg > 0 && yesterdayRevenue < avg * threshold) {
    return [{
      id: makeId('revenue_drop', yesterday),
      type: 'revenue_drop',
      severity: 'warning',
      title: `Doanh thu hôm qua thấp bất thường`,
      message: `Doanh thu ${yesterday}: ${yesterdayRevenue.toLocaleString('vi-VN')}đ — chỉ bằng ${(yesterdayRevenue / avg * 100).toFixed(0)}% mức trung bình 6 ngày trước (${Math.round(avg).toLocaleString('vi-VN')}đ/ngày).`,
      createdAt: now,
    }];
  }

  return [];
}

export async function checkAllAlerts(supabase: SupabaseClient): Promise<AppAlert[]> {
  const config = await loadAlertConfig(supabase);

  const [stockAlerts, debtAlerts, revenueAlerts] = await Promise.allSettled([
    checkLowStock(supabase, config),
    checkOverdueDebts(supabase, config),
    checkRevenueDrop(supabase, config),
  ]);

  return [
    ...(stockAlerts.status === 'fulfilled' ? stockAlerts.value : []),
    ...(debtAlerts.status === 'fulfilled' ? debtAlerts.value : []),
    ...(revenueAlerts.status === 'fulfilled' ? revenueAlerts.value : []),
  ];
}
