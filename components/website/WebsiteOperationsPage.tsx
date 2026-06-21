import React, { useCallback, useEffect, useState } from 'react';
import { Download, Mail, MessageSquare, Settings2, BellRing, RefreshCw } from 'lucide-react';
import { adminStoreRequest } from '../../services/adminStoreApi';
import { supabase } from '../../services/supabase';
import { useToast } from '../ui/Toast';

type Tab = 'preorders' | 'contacts' | 'newsletter' | 'settings';
type Preorder = { id: string; customer_name: string; phone: string; sku: string | null; size: string | null; note: string | null; status: string; created_at: string };
type Contact = { id: string; name: string; phone: string; email: string | null; topic: string; message: string; status: string; created_at: string };
type Subscriber = { id: string; email: string; status: string; source: string; subscribed_at: string };
type Settings = Record<string, unknown>;

const PREORDER = ['waiting', 'notified', 'converted', 'cancelled'];
const CONTACT = ['new', 'in_progress', 'resolved'];
const SUBSCRIBER = ['active', 'unsubscribed'];
const LABELS: Record<string, string> = {
  waiting: 'Chờ liên hệ', notified: 'Đã báo', converted: 'Đã chuyển đơn', cancelled: 'Đã hủy',
  new: 'Mới', in_progress: 'Đang xử lý', resolved: 'Đã xử lý', active: 'Đang nhận tin', unsubscribed: 'Đã hủy đăng ký',
};

const date = (value: string) => new Date(value).toLocaleString('vi-VN');

export default function WebsiteOperationsPage({ navigationSlot }: { navigationSlot?: React.ReactNode }) {
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>('preorders');
  const [preorders, setPreorders] = useState<Preorder[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pre, con, news, cfg] = await Promise.all([
        adminStoreRequest<{ data: Preorder[] }>('/api/admin/store/preorders'),
        adminStoreRequest<{ data: Contact[] }>('/api/admin/store/contacts'),
        adminStoreRequest<{ data: Subscriber[] }>('/api/admin/store/newsletter'),
        adminStoreRequest<{ data: Settings }>('/api/admin/store/settings'),
      ]);
      setPreorders(pre.data ?? []); setContacts(con.data ?? []); setSubscribers(news.data ?? []); setSettings(cfg.data ?? {});
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể tải dữ liệu Website', 'error');
    } finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (kind: 'preorders' | 'contacts' | 'newsletter', id: string, status: string) => {
    setSaving(id);
    try {
      await adminStoreRequest(`/api/admin/store/${kind}/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      await load();
      showToast('Đã cập nhật trạng thái', 'success');
    } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể cập nhật', 'error'); }
    finally { setSaving(null); }
  };

  const exportNewsletter = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Phiên đăng nhập đã hết hạn');
      const response = await fetch('/api/admin/store/newsletter.csv', { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!response.ok) throw new Error('Không thể xuất CSV');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = 'website-newsletter.csv'; link.click(); URL.revokeObjectURL(url);
    } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể xuất CSV', 'error'); }
  };

  const saveSettings = async () => {
    setSaving('settings');
    try { await adminStoreRequest('/api/admin/store/settings', { method: 'PUT', body: JSON.stringify({ value: settings }) }); showToast('Đã lưu cấu hình Website', 'success'); }
    catch (error) { showToast(error instanceof Error ? error.message : 'Không thể lưu cấu hình', 'error'); }
    finally { setSaving(null); }
  };

  const setConfig = (key: string, value: unknown) => setSettings(prev => ({ ...prev, [key]: value }));
  const matching = <T extends Record<string, unknown>>(rows: T[]) => rows.filter(row => !query || Object.values(row).join(' ').toLowerCase().includes(query.toLowerCase()));

  return <div className="grid h-full min-h-0 grid-cols-[280px_minmax(0,1fr)] gap-4 overflow-hidden bg-slate-50 px-4 pb-5 pt-10">
    <aside className="flex h-full min-h-0 flex-col gap-4">{navigationSlot}</aside>
    <main className="min-w-0 overflow-auto rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <div><h1 className="text-lg font-semibold text-slate-800">Quản lý Website PHÚC SANG</h1><p className="mt-0.5 text-xs text-slate-500">Inbox, newsletter và cấu hình riêng cho Website</p></div>
        <button onClick={load} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><RefreshCw size={16} /></button>
      </div>
      <div className="flex flex-wrap gap-1 border-b border-slate-100 px-5 pt-3">
        {([['preorders', 'Đặt trước', BellRing], ['contacts', 'Liên hệ', MessageSquare], ['newsletter', 'Newsletter', Mail], ['settings', 'Cấu hình', Settings2]] as const).map(([id, label, Icon]) => <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm ${tab === id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}><Icon size={14}/>{label}</button>)}
      </div>
      {loading ? <p className="p-10 text-center text-sm text-slate-400">Đang tải…</p> : <div className="p-5">
        {tab !== 'settings' && <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm kiếm…" className="mb-4 w-full max-w-sm rounded-lg border border-slate-200 px-3 py-2 text-sm" />}
        {tab === 'preorders' && <Table rows={matching(preorders)} columns={['Khách hàng', 'Sản phẩm', 'Ghi chú', 'Thời gian', 'Trạng thái']} render={row => <><td>{row.customer_name}<p className="text-xs text-slate-400">{row.phone}</p></td><td>{row.sku ?? '—'} {row.size ? `· ${row.size}` : ''}</td><td>{row.note ?? '—'}</td><td>{date(row.created_at)}</td><Status value={row.status} options={PREORDER} busy={saving === row.id} onChange={v => updateStatus('preorders', row.id, v)} /></>} />}
        {tab === 'contacts' && <Table rows={matching(contacts)} columns={['Khách hàng', 'Chủ đề / Nội dung', 'Thời gian', 'Trạng thái']} render={row => <><td>{row.name}<p className="text-xs text-slate-400">{row.phone} · {row.email ?? '—'}</p></td><td><p className="font-medium">{row.topic}</p><p className="max-w-lg text-xs text-slate-500">{row.message}</p></td><td>{date(row.created_at)}</td><Status value={row.status} options={CONTACT} busy={saving === row.id} onChange={v => updateStatus('contacts', row.id, v)} /></>} />}
        {tab === 'newsletter' && <><div className="mb-3 flex justify-end"><button onClick={exportNewsletter} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><Download size={14}/>Xuất CSV</button></div><Table rows={matching(subscribers)} columns={['Email', 'Nguồn', 'Đăng ký', 'Trạng thái']} render={row => <><td>{row.email}</td><td>{row.source}</td><td>{date(row.subscribed_at)}</td><Status value={row.status} options={SUBSCRIBER} busy={saving === row.id} onChange={v => updateStatus('newsletter', row.id, v)} /></>} /></>}
        {tab === 'settings' && <SettingsForm settings={settings} onChange={setConfig} onSave={saveSettings} saving={saving === 'settings'} />}
      </div>}
    </main>
  </div>;
}

function Status({ value, options, busy, onChange }: { value: string; options: string[]; busy: boolean; onChange: (value: string) => void }) {
  return <td><select disabled={busy} value={value} onChange={e => onChange(e.target.value)} className="rounded border border-slate-200 bg-white px-2 py-1 text-xs">{options.map(option => <option key={option} value={option}>{LABELS[option] ?? option}</option>)}</select></td>;
}
function Table<T>({ rows, columns, render }: { rows: T[]; columns: string[]; render: (row: T) => React.ReactNode }) {
  return <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{columns.map(column => <th key={column} className="px-3 py-2 font-medium">{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={(row as { id?: string }).id ?? index} className="border-t border-slate-100">{render(row)}</tr>)}{rows.length === 0 && <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-slate-400">Chưa có dữ liệu</td></tr>}</tbody></table></div>;
}
function SettingsForm({ settings, onChange, onSave, saving }: { settings: Settings; onChange: (key: string, value: unknown) => void; onSave: () => void; saving: boolean }) {
  const social = (settings.social_links ?? {}) as Record<string, unknown>;
  const setSocial = (key: string, value: string) => onChange('social_links', { ...social, [key]: value });
  return <div className="max-w-2xl space-y-5"><div><h2 className="font-medium text-slate-800">Chính sách vận chuyển Website</h2><p className="text-xs text-slate-500">Dưới 800.000đ: 30.000đ · từ 800.000đ: miễn phí. Chính sách này được RPC tính ở server, không thể sửa tại form để tránh lệch tiền đơn.</p></div><Field label="Hotline" value={String(settings.hotline ?? '')} onChange={v => onChange('hotline', v)}/><Field label="Địa chỉ" value={String(settings.address ?? '')} onChange={v => onChange('address', v)}/><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Field label="Facebook" value={String(social.facebook ?? '')} onChange={v => setSocial('facebook', v)}/><Field label="Shopee" value={String(social.shopee ?? '')} onChange={v => setSocial('shopee', v)}/><Field label="TikTok" value={String(social.tiktok ?? '')} onChange={v => setSocial('tiktok', v)}/><Field label="Zalo" value={String(social.zalo ?? '')} onChange={v => setSocial('zalo', v)}/></div><label className="block text-sm text-slate-600">Tài khoản ngân hàng hiển thị Website<textarea value={String(settings.bank_info ?? '')} onChange={e => onChange('bank_info', e.target.value)} placeholder="Ngân hàng · Số tài khoản · Chủ tài khoản" className="mt-1 w-full rounded-lg border border-slate-200 p-2" rows={3}/></label><label className="block text-sm text-slate-600">Footer<textarea value={String((settings.footer as Record<string, unknown> | undefined)?.text ?? '')} onChange={e => onChange('footer', { text: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 p-2" rows={4}/></label><button disabled={saving} onClick={onSave} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{saving ? 'Đang lưu…' : 'Lưu cấu hình'}</button></div>;
}
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block text-sm text-slate-600">{label}<input value={value} onChange={e => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"/></label>; }
