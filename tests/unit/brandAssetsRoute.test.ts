import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import type { RequestHandler } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Route upload logo (STORAGE-XATTR-0918).
 *
 * Test gọi HTTP THẬT qua một express server tạm, không khớp chuỗi mã nguồn — vì thứ
 * cần khoá ở đây là HÀNH VI: mã trạng thái trả về, key gửi lên R2, và việc route có
 * thực sự nằm sau `requireAuth` hay không.
 *
 * Vì sao route này tồn tại: Supabase Storage tự host đang hỏng ở cả dev lẫn prod
 * (volume bind-mount từ macOS không hỗ trợ extended attributes), nên logo chuyển sang
 * đi qua Cloudflare R2 — đúng đường mà ảnh sản phẩm website đã dùng ổn định.
 */

const uploadToR2 = vi.fn();
const isR2Configured = vi.fn();

vi.mock('../../services/r2', () => ({
  isR2Configured: () => isR2Configured(),
  uploadToR2: (key: string, body: Buffer, contentType: string) =>
    uploadToR2(key, body, contentType),
  deleteFromR2: vi.fn(),
}));

const { createBrandAssetsRouter } = await import('../../routes/brandAssets');

/** Supabase giả — chỉ dùng cho nhánh dự phòng khi R2 chưa cấu hình. */
const fakeSupabase = {
  storage: {
    from: () => ({
      upload: async () => ({ error: { message: 'storage hỏng' } }),
      getPublicUrl: () => ({ data: { publicUrl: 'https://vi-du/anh.jpg' } }),
    }),
  },
} as unknown as SupabaseClient;

const pngBase64 = (bytes: number) =>
  `data:image/jpeg;base64,${Buffer.alloc(bytes, 7).toString('base64')}`;

let server: Server;
let baseUrl: string;

const startServer = (requireAuth: RequestHandler) => {
  const app = express();
  app.use(express.json({ limit: '20mb' }));
  app.use(createBrandAssetsRouter(fakeSupabase, requireAuth));
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
};

const passThroughAuth: RequestHandler = (_req, _res, next) => next();

const post = (body: unknown) =>
  fetch(`${baseUrl}/api/brand/logo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  uploadToR2.mockReset();
  isR2Configured.mockReset();
  isR2Configured.mockReturnValue(true);
  uploadToR2.mockResolvedValue({ key: 'k', url: 'https://img.phucsang.com.vn/brand-assets/1-a.jpg' });
});

afterEach(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
});

describe('POST /api/brand/logo', () => {
  it('đẩy lên R2 và trả về URL công khai', async () => {
    startServer(passThroughAuth);
    const res = await post({
      filename: 'logo.jpg',
      contentType: 'image/jpeg',
      dataBase64: pngBase64(64),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.url).toBe('https://img.phucsang.com.vn/brand-assets/1-a.jpg');
    expect(uploadToR2).toHaveBeenCalledTimes(1);

    // Key phải nằm trong thư mục brand-assets/ — dùng để phân biệt với ảnh sản phẩm
    // (store-media/) khi cần dọn hoặc xoá về sau.
    const [key, buffer, contentType] = uploadToR2.mock.calls[0];
    expect(key).toMatch(/^brand-assets\/\d+-logo\.jpg$/);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBe(64);
    expect(contentType).toBe('image/jpeg');
  });

  it('chỉ nhận định dạng ảnh cho phép', async () => {
    startServer(passThroughAuth);
    for (const contentType of ['application/pdf', 'text/html', 'image/svg+xml', '']) {
      const res = await post({ filename: 'x.bin', contentType, dataBase64: pngBase64(10) });
      expect(res.status, `phải chặn ${contentType || '(rỗng)'}`).toBe(400);
    }
    expect(uploadToR2).not.toHaveBeenCalled();
  });

  it('chặn tệp rỗng và tệp quá 5MB', async () => {
    startServer(passThroughAuth);

    const rong = await post({ filename: 'a.jpg', contentType: 'image/jpeg', dataBase64: '' });
    expect(rong.status).toBe(400);

    const qua = await post({
      filename: 'a.jpg',
      contentType: 'image/jpeg',
      dataBase64: pngBase64(5 * 1024 * 1024 + 1),
    });
    expect(qua.status).toBe(400);
    expect((await qua.json()).error).toContain('5MB');

    expect(uploadToR2).not.toHaveBeenCalled();
  });

  it('làm sạch tên tệp trước khi dùng làm key', async () => {
    startServer(passThroughAuth);
    await post({
      filename: '../../etc/passwd ảnh lạ.jpg',
      contentType: 'image/jpeg',
      dataBase64: pngBase64(8),
    });

    const [key] = uploadToR2.mock.calls[0];
    expect(key).not.toContain('..');
    expect(key).not.toContain('/etc/');
    expect(key).toMatch(/^brand-assets\/\d+-[a-zA-Z0-9._-]+$/);
  });

  it('báo lỗi rõ ràng khi R2 từ chối, không nuốt lỗi', async () => {
    startServer(passThroughAuth);
    uploadToR2.mockRejectedValue(new Error('AccessDenied'));

    const res = await post({
      filename: 'logo.jpg',
      contentType: 'image/jpeg',
      dataBase64: pngBase64(16),
    });

    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain('AccessDenied');
  });

  it('nằm sau requireAuth — khách chưa đăng nhập không upload được', async () => {
    const chanDangNhap: RequestHandler = (_req, res) => {
      res.status(401).json({ error: 'Chưa đăng nhập' });
    };
    startServer(chanDangNhap);

    const res = await post({
      filename: 'logo.jpg',
      contentType: 'image/jpeg',
      dataBase64: pngBase64(16),
    });

    expect(res.status).toBe(401);
    expect(uploadToR2).not.toHaveBeenCalled();
  });

  it('khi R2 chưa cấu hình thì lỗi Storage phải nói rõ nguyên nhân', async () => {
    startServer(passThroughAuth);
    isR2Configured.mockReturnValue(false);

    const res = await post({
      filename: 'logo.jpg',
      contentType: 'image/jpeg',
      dataBase64: pngBase64(16),
    });

    expect(res.status).toBe(500);
    const { error } = await res.json();
    expect(error).toContain('Chưa cấu hình R2');
    expect(error).toContain('STORAGE-XATTR-0918');
  });
});
