import { supabase } from './supabase';

/**
 * Gọi API backend kèm access token của phiên đăng nhập hiện tại.
 *
 * Tách ra từ `adminStoreRequest` (services/adminStoreApi.ts) khi thêm đường upload
 * logo: hai nơi cần đúng một cách gắn token, nhân đôi đoạn này là sớm muộn cũng lệch.
 * Ném Error kèm thông điệp từ backend để chỗ gọi hiện đúng lý do thất bại thay vì
 * một câu báo lỗi chung chung.
 */
export async function authedRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(path, { ...init, headers, credentials: 'include' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Yêu cầu thất bại (HTTP ${response.status})`);
  return body as T;
}
