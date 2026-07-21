import { supabase } from './supabase';

// Bật/tắt liên kết 1 sản phẩm với kênh bán (website / shopee) qua backend.
// Trước đây hàm này bị chép gần y hệt ở OnlineCatalogPage.tsx và GoodsChannelLinksTab.tsx
// — gộp về đây làm nguồn duy nhất. Lấy bản error-handling chắc hơn (bắt cả response
// không phải JSON) làm chuẩn cho cả 2 nơi.
export interface ToggleChannelPayload {
  channel: 'website' | 'shopee';
  action: 'link' | 'unlink';
  product: { id: string; name: string; sku: string; parentId?: string; isParent?: boolean };
  childIds?: { id: string; sku: string }[];
  variantId?: string;
  shopId?: string;
}

export async function toggleChannelBackend(payload: ToggleChannelPayload): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
  const res = await fetch('/api/channel-links/toggle', {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  let json: { ok: boolean; error?: string };
  try {
    json = await res.json();
  } catch {
    throw new Error(`Lỗi server (HTTP ${res.status}) — server có thể chưa restart sau cập nhật`);
  }
  if (!json.ok) throw new Error(json.error ?? 'Lỗi không xác định');
}
