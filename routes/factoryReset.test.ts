import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { SupabaseClient } from '@supabase/supabase-js';
import { createFactoryResetRouter } from './factoryReset';

/**
 * Test tầng HTTP cho `DELETE /api/admin/factory-reset` — endpoint xoá VĨNH VIỄN
 * toàn bộ dữ liệu nghiệp vụ, cấu hình và tài khoản đăng nhập, không hoàn tác
 * được và không tự backup.
 *
 * Audit 2026-08-29 phát hiện endpoint này **không có một test nào**, dù chính nó
 * từng dính lỗ hổng phân quyền nghiêm trọng (FACTORY-RESET-SECURITY-0816: trước
 * 16/08/2026 chỉ có `requireAuth`, nghĩa là mọi nhân viên đã đăng nhập — kể cả
 * thu ngân — đều gọi được bằng curl, bỏ qua hoàn toàn ô xác nhận ở giao diện).
 * Các test dưới đây khoá lại đúng hàng rào phân quyền đó cùng vài bất biến khác.
 *
 * Cùng pattern `routes/store.test.ts`/`data.test.ts`: app.listen(0) + fetch thật,
 * không thêm supertest.
 */

interface MockOpts {
  /** user trả về từ auth.getUser — undefined = lỗi token. */
  user?: { user_metadata?: { role?: string } } | null;
  getUserError?: { message: string } | null;
  /** Lỗi giả cho một bảng cụ thể khi delete. */
  tableError?: { table: string; message: string };
}

function makeSupabaseMock(opts: MockOpts = {}) {
  const deletedTables: string[] = [];
  const deletedUserIds: string[] = [];
  let brandUpserted: Record<string, unknown> | null = null;

  const client = {
    auth: {
      getUser: (_jwt: string) =>
        Promise.resolve({
          data: { user: opts.user ?? null },
          error: opts.getUserError ?? null,
        }),
      admin: {
        listUsers: () =>
          Promise.resolve({
            data: { users: [{ id: 'u-1' }, { id: 'u-2' }] },
            error: null,
          }),
        deleteUser: (id: string) => {
          deletedUserIds.push(id);
          return Promise.resolve({ error: null });
        },
      },
    },
    from: (table: string) => ({
      delete: () => ({
        not: () => {
          deletedTables.push(table);
          const err =
            opts.tableError?.table === table ? { message: opts.tableError.message } : null;
          return Promise.resolve({ error: err });
        },
      }),
      upsert: (row: Record<string, unknown>) => {
        if (table === 'brand_profile') brandUpserted = row;
        return Promise.resolve({ error: null });
      },
    }),
  };

  return {
    client: client as unknown as SupabaseClient,
    deletedTables,
    deletedUserIds,
    getBrandUpserted: () => brandUpserted,
  };
}

const passThroughAuth: express.RequestHandler = (_req, _res, next) => next();

function startServer(client: SupabaseClient) {
  const app = express();
  app.use(express.json());
  app.use(createFactoryResetRouter(client, passThroughAuth));
  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;
  return { server, url: `http://127.0.0.1:${port}/api/admin/factory-reset` };
}

describe('DELETE /api/admin/factory-reset', () => {
  describe('hàng rào phân quyền owner (FACTORY-RESET-SECURITY-0816)', () => {
    let server: Server;
    let url: string;
    let mock: ReturnType<typeof makeSupabaseMock>;

    beforeAll(() => {
      mock = makeSupabaseMock({ user: { user_metadata: { role: 'cashier' } } });
      ({ server, url } = startServer(mock.client));
    });
    afterAll(() => server.close());

    it('CHẶN nhân viên thu ngân bằng 403 và KHÔNG xoá bảng nào', async () => {
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { authorization: 'Bearer fake-jwt' },
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain('Chỉ chủ cửa hàng');
      // Quan trọng hơn cả mã lỗi: không được đụng vào dữ liệu.
      expect(mock.deletedTables).toHaveLength(0);
      expect(mock.deletedUserIds).toHaveLength(0);
    });
  });

  it('CHẶN vai trò mặc định khi user_metadata không khai báo role', async () => {
    // Mặc định trong code là 'cashier' — token hợp lệ nhưng không có role vẫn phải bị chặn.
    const mock = makeSupabaseMock({ user: {} });
    const { server, url } = startServer(mock.client);
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { authorization: 'Bearer fake-jwt' },
    });
    expect(res.status).toBe(403);
    expect(mock.deletedTables).toHaveLength(0);
    server.close();
  });

  it('CHẶN khi token không hợp lệ', async () => {
    const mock = makeSupabaseMock({ user: null, getUserError: { message: 'bad jwt' } });
    const { server, url } = startServer(mock.client);
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { authorization: 'Bearer hong-hop-le' },
    });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toContain('Phiên đăng nhập không hợp lệ');
    expect(mock.deletedTables).toHaveLength(0);
    server.close();
  });

  it('CHO PHÉP owner, xoá đủ các bảng và tài khoản', async () => {
    const mock = makeSupabaseMock({ user: { user_metadata: { role: 'owner' } } });
    const { server, url } = startServer(mock.client);
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { authorization: 'Bearer fake-jwt' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.accountsDeleted).toBe(2);
    expect(mock.deletedUserIds).toEqual(['u-1', 'u-2']);

    // Vài bảng đại diện cho từng batch phải nằm trong danh sách đã xoá.
    expect(mock.deletedTables).toContain('store_product_collections');
    expect(mock.deletedTables).toContain('inventory_transactions'); // batch 1
    expect(mock.deletedTables).toContain('pos_products'); // batch 2
    expect(mock.deletedTables).toContain('shopee_shops'); // batch 3
    expect(mock.deletedTables).toContain('vat_documents'); // batch 4
    expect(mock.deletedTables).toContain('audit_logs');
    server.close();
  });

  it('xoá store_product_collections TRƯỚC các batch (ràng buộc khoá ngoại)', async () => {
    const mock = makeSupabaseMock({ user: { user_metadata: { role: 'owner' } } });
    const { server, url } = startServer(mock.client);
    await fetch(url, { method: 'DELETE', headers: { authorization: 'Bearer fake-jwt' } });
    // Bảng này dùng khoá kép nên không lồng được vào FACTORY_RESET_BATCHES; nó bị
    // store_products/store_collections (batch 2) tham chiếu nên phải đi trước.
    expect(mock.deletedTables[0]).toBe('store_product_collections');
    expect(mock.deletedTables.indexOf('store_products')).toBeGreaterThan(0);
    server.close();
  });

  it('reset brand_profile về mặc định thay vì xoá hẳn record', async () => {
    const mock = makeSupabaseMock({ user: { user_metadata: { role: 'owner' } } });
    const { server, url } = startServer(mock.client);
    await fetch(url, { method: 'DELETE', headers: { authorization: 'Bearer fake-jwt' } });
    const brand = mock.getBrandUpserted();
    expect(brand).toBeTruthy();
    expect(brand?.id).toBe('00000000-0000-0000-0000-000000000000');
    expect(brand?.name).toBeNull();
    expect(mock.deletedTables).not.toContain('brand_profile');
    server.close();
  });

  it('BỎ QUA lỗi "bảng không tồn tại" thay vì bắt cả quá trình dừng', async () => {
    // Migration chưa chạy hoặc cửa hàng dùng schema rút gọn — coi như bảng đó đã sạch.
    const mock = makeSupabaseMock({
      user: { user_metadata: { role: 'owner' } },
      tableError: { table: 'shopee_shops', message: 'Could not find the table shopee_shops' },
    });
    const { server, url } = startServer(mock.client);
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { authorization: 'Bearer fake-jwt' },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    server.close();
  });

  it('trả 500 khi gặp lỗi DB thật (không phải lỗi thiếu bảng)', async () => {
    const mock = makeSupabaseMock({
      user: { user_metadata: { role: 'owner' } },
      tableError: { table: 'pos_products', message: 'permission denied for table pos_products' },
    });
    const { server, url } = startServer(mock.client);
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { authorization: 'Bearer fake-jwt' },
    });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain('permission denied');
    server.close();
  });
});
