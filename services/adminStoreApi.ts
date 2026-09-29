import { authedRequest } from './apiRequest';

/**
 * Giữ tên cũ cho các trang website đang gọi; phần gắn token nay dùng chung
 * `authedRequest` với những đường API khác (xem services/apiRequest.ts).
 */
export async function adminStoreRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  return authedRequest<T>(path, init);
}
