import { Router, RequestHandler } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { isR2Configured, uploadToR2 } from '../services/r2';

/**
 * Upload tài sản thương hiệu (hiện tại: logo cửa hàng) lên Cloudflare R2.
 *
 * Vì sao có route này (STORAGE-XATTR-0918, 18/09/2026): logo trước đây đi thẳng từ
 * trình duyệt vào Supabase Storage. Nhưng Storage tự host đang hỏng ở CẢ dev lẫn prod —
 * volume của nó là bind-mount từ macOS vào container Linux, mà lớp chia sẻ file của
 * Docker Desktop không hỗ trợ extended attributes, thứ `FileBackend` bắt buộc cần:
 *   500 "The file system does not support extended attributes or has the feature disabled."
 * Hệ quả: ảnh cũ mất sạch (500 ENOENT) và ảnh mới không tải lên được.
 *
 * R2 đi vòng qua toàn bộ chuyện đó: ảnh nằm trên Cloudflare, không phụ thuộc đĩa iMac,
 * và được phục vụ qua CDN. Đường này KHÔNG mới — `routes/adminStore.ts` đã dùng đúng
 * `uploadToR2` cho ảnh sản phẩm website và chạy ổn định nhiều tháng trên prod; đây chỉ
 * là áp cùng khuôn đó cho logo.
 *
 * Upload buộc phải qua backend vì khóa R2 chỉ tồn tại server-side (.env.local).
 */

const ALLOWED_TYPES = ['image/webp', 'image/jpeg', 'image/png', 'image/avif'];
const MAX_BYTES = 5 * 1024 * 1024;

const text = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

export function createBrandAssetsRouter(
  supabase: SupabaseClient,
  requireAuth: RequestHandler
): Router {
  const router = Router();

  router.post('/api/brand/logo', requireAuth, async (req, res) => {
    // Lọc ký tự lạ, RỒI thu gọn chuỗi dấu chấm. Bước thứ hai không thừa: đường xoá ảnh
    // ở routes/adminStore.ts từ chối mọi path chứa '..', nên một key lọt được '..' vào
    // sẽ tạo ra object KHÔNG BAO GIỜ xoá được bằng giao diện.
    const filename = text(req.body?.filename, 140)
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .replace(/\.{2,}/g, '.');
    const contentType = text(req.body?.contentType, 100);
    const encoded = typeof req.body?.dataBase64 === 'string' ? req.body.dataBase64 : '';

    if (!filename || !ALLOWED_TYPES.includes(contentType) || !encoded) {
      return res.status(400).json({ error: 'Tệp logo không hợp lệ (chỉ nhận JPEG/PNG/WebP/AVIF)' });
    }

    const data = Buffer.from(encoded.replace(/^data:[^;]+;base64,/, ''), 'base64');
    if (!data.length) return res.status(400).json({ error: 'Tệp logo rỗng' });
    if (data.length > MAX_BYTES) return res.status(400).json({ error: 'Logo phải nhỏ hơn 5MB' });

    const path = `brand-assets/${Date.now()}-${filename}`;

    if (isR2Configured()) {
      try {
        const { url } = await uploadToR2(path, data, contentType);
        return res.status(201).json({ path, url });
      } catch (e) {
        return res.status(500).json({ error: 'Upload R2 thất bại: ' + (e as Error).message });
      }
    }

    // Chưa cấu hình R2 (hiện là trường hợp của dev) → thử Supabase Storage như trước.
    // Nhiều khả năng vẫn hỏng vì đúng lỗi xattr nói trên, nên thông điệp phải chỉ thẳng
    // ra nguyên nhân thay vì để người dùng đoán.
    const { error } = await supabase.storage
      .from('images')
      .upload(path, data, { contentType, upsert: true });
    if (error) {
      return res.status(500).json({
        error:
          'Chưa cấu hình R2 cho môi trường này và Supabase Storage cũng lỗi: ' +
          error.message +
          ' — xem STORAGE-XATTR-0918 trong TODO.md',
      });
    }
    const url = supabase.storage.from('images').getPublicUrl(path).data.publicUrl;
    return res.status(201).json({ path, url });
  });

  return router;
}
