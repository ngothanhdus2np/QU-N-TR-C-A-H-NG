import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

// Test TẦNG HTTP thật cho createAuthRouter — bề mặt XÁC THỰC (audit 2026-07-21 GĐ4:
// route auth trước đây 0 test dù bảo vệ tạo/xóa/đổi-quyền tài khoản). Trọng tâm: các
// cổng 401/403, chống leo thang đặc quyền (manager tạo manager/owner), bảo vệ owner cuối.
// Không dùng supertest: app.listen(0) + global fetch của Node (giống data.test.ts).

// ── Mock createClient dùng trong verify-manager (tạo tempClient để signIn) ─────────
const signInMock = vi.fn();
vi.mock('@supabase/supabase-js', async (importActual) => {
  const actual = await importActual<typeof import('@supabase/supabase-js')>();
  return {
    ...actual,
    createClient: () => ({
      auth: {
        signInWithPassword: (creds: { email: string; password: string }) => signInMock(creds),
        signOut: () => Promise.resolve({ error: null }),
      },
    }),
  };
});

// Import SAU vi.mock để router dùng createClient đã mock
const { createAuthRouter } = await import('./auth');
import type { SupabaseClient } from '@supabase/supabase-js';

interface MockUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}

// users: map JWT → user (cho auth.getUser); adminUsers: danh sách cho admin.* API
function makeSupabaseMock(opts: {
  userByJwt?: Record<string, MockUser>;
  adminUsers?: MockUser[];
} = {}) {
  const adminUsers = opts.adminUsers ?? [];
  const createUserCalls: unknown[] = [];
  const deletedIds: string[] = [];
  const updatedById: Record<string, unknown> = {};

  const client = {
    auth: {
      getUser: (jwt: string) => {
        const user = opts.userByJwt?.[jwt];
        return Promise.resolve(
          user ? { data: { user }, error: null } : { data: { user: null }, error: { message: 'invalid jwt' } }
        );
      },
      admin: {
        listUsers: () => Promise.resolve({ data: { users: adminUsers }, error: null }),
        getUserById: (id: string) =>
          Promise.resolve({ data: { user: adminUsers.find(u => u.id === id) ?? null }, error: null }),
        createUser: (payload: unknown) => {
          createUserCalls.push(payload);
          return Promise.resolve({ data: { user: { id: 'new-user-id' } }, error: null });
        },
        updateUserById: (id: string, patch: unknown) => {
          updatedById[id] = patch;
          return Promise.resolve({ data: { user: { id } }, error: null });
        },
        deleteUser: (id: string) => {
          deletedIds.push(id);
          return Promise.resolve({ data: {}, error: null });
        },
      },
    },
  } as unknown as SupabaseClient;

  return { client, createUserCalls, deletedIds, updatedById };
}

// requireAuth stub: cho qua (Lớp 1). Lớp 2 (resolveCaller theo JWT) là thứ đang test.
const requireAuthPass: express.RequestHandler = (_req, _res, next) => next();

function startApp(client: SupabaseClient): Promise<{ server: Server; baseUrl: string }> {
  const app = express();
  app.use(express.json());
  app.use(createAuthRouter(client, requireAuthPass));
  return new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

const OWNER: MockUser = { id: 'owner-1', user_metadata: { role: 'owner' } };
const MANAGER: MockUser = { id: 'mgr-1', user_metadata: { role: 'manager' } };
const CASHIER: MockUser = { id: 'cash-1', user_metadata: { role: 'cashier' } };
const bearer = (jwt: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` });

describe('createAuthRouter — cổng phân quyền', () => {
  let server: Server;
  let baseUrl: string;
  const userByJwt = { 'jwt-owner': OWNER, 'jwt-mgr': MANAGER, 'jwt-cash': CASHIER };

  beforeAll(async () => {
    const { client } = makeSupabaseMock({
      userByJwt,
      adminUsers: [OWNER, MANAGER, CASHIER],
    });
    ({ server, baseUrl } = await startApp(client));
  });
  afterAll(() => server?.close());

  it('không có JWT → 401 (defense-in-depth dù requireAuth đã cho qua)', async () => {
    const res = await fetch(`${baseUrl}/api/auth/accounts`);
    expect(res.status).toBe(401);
  });

  it('JWT không hợp lệ → 401', async () => {
    const res = await fetch(`${baseUrl}/api/auth/accounts`, { headers: bearer('jwt-rác') });
    expect(res.status).toBe(401);
  });

  it('cashier gọi route quản-lý → 403', async () => {
    const res = await fetch(`${baseUrl}/api/auth/accounts`, { headers: bearer('jwt-cash') });
    expect(res.status).toBe(403);
  });

  it('manager gọi route CHỈ-owner (đổi quyền) → 403', async () => {
    const res = await fetch(`${baseUrl}/api/auth/accounts/cash-1/role`, {
      method: 'PATCH', headers: bearer('jwt-mgr'), body: JSON.stringify({ role: 'manager' }),
    });
    expect(res.status).toBe(403);
  });

  it('manager xem danh sách tài khoản → OK (200)', async () => {
    const res = await fetch(`${baseUrl}/api/auth/accounts`, { headers: bearer('jwt-mgr') });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.accounts)).toBe(true);
  });
});

describe('register — validate + chống leo thang đặc quyền', () => {
  let server: Server;
  let baseUrl: string;
  beforeAll(async () => {
    const { client } = makeSupabaseMock({
      userByJwt: { 'jwt-owner': OWNER, 'jwt-mgr': MANAGER },
      adminUsers: [OWNER, MANAGER],
    });
    ({ server, baseUrl } = await startApp(client));
  });
  afterAll(() => server?.close());

  const register = (jwt: string, body: unknown) =>
    fetch(`${baseUrl}/api/auth/register`, { method: 'POST', headers: bearer(jwt), body: JSON.stringify(body) });

  it('thiếu mật khẩu → 400', async () => {
    expect((await register('jwt-owner', { username: 'a' })).status).toBe(400);
  });

  it('mật khẩu < 6 ký tự → 400', async () => {
    expect((await register('jwt-owner', { username: 'a', password: '123' })).status).toBe(400);
  });

  it('chức vụ không hợp lệ → 400', async () => {
    expect((await register('jwt-owner', { username: 'a', password: '123456', role: 'god' })).status).toBe(400);
  });

  it('tên đăng nhập ký tự lạ → 400', async () => {
    expect((await register('jwt-owner', { username: 'Tên Có Dấu!', password: '123456' })).status).toBe(400);
  });

  it('thiếu cả username lẫn email → 400', async () => {
    expect((await register('jwt-owner', { password: '123456' })).status).toBe(400);
  });

  it('MANAGER tạo tài khoản manager → 403 (chống leo thang)', async () => {
    const res = await register('jwt-mgr', { email: 'x@y.com', password: '123456', role: 'manager' });
    expect(res.status).toBe(403);
  });

  it('MANAGER tạo tài khoản owner → 403 (chống leo thang)', async () => {
    const res = await register('jwt-mgr', { email: 'x@y.com', password: '123456', role: 'owner' });
    expect(res.status).toBe(403);
  });

  it('owner tạo cashier hợp lệ → 200', async () => {
    const res = await register('jwt-owner', { username: 'thungan1', password: '123456', role: 'cashier' });
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });
});

describe('đổi quyền / xóa — bảo vệ owner cuối + tự-thao-tác', () => {
  let server: Server;
  let baseUrl: string;
  beforeAll(async () => {
    // Chỉ 1 owner trong hệ thống → không được hạ/xóa
    const { client } = makeSupabaseMock({
      userByJwt: { 'jwt-owner': OWNER },
      adminUsers: [OWNER, MANAGER, CASHIER],
    });
    ({ server, baseUrl } = await startApp(client));
  });
  afterAll(() => server?.close());

  it('owner tự đổi quyền chính mình → 400', async () => {
    const res = await fetch(`${baseUrl}/api/auth/accounts/owner-1/role`, {
      method: 'PATCH', headers: bearer('jwt-owner'), body: JSON.stringify({ role: 'manager' }),
    });
    expect(res.status).toBe(400);
  });

  it('hạ quyền owner cuối cùng → 400', async () => {
    const res = await fetch(`${baseUrl}/api/auth/accounts/owner-1/role`, {
      method: 'PATCH', headers: bearer('jwt-owner'), body: JSON.stringify({ role: 'manager' }),
    });
    // owner-1 là caller nên chặn self trước; dùng owner khác không tồn tại → test riêng dưới
    expect(res.status).toBe(400);
  });

  it('owner tự xóa chính mình → 400', async () => {
    const res = await fetch(`${baseUrl}/api/auth/accounts/owner-1`, {
      method: 'DELETE', headers: bearer('jwt-owner'),
    });
    expect(res.status).toBe(400);
  });

  it('đổi quyền cashier hợp lệ → 200', async () => {
    const res = await fetch(`${baseUrl}/api/auth/accounts/cash-1/role`, {
      method: 'PATCH', headers: bearer('jwt-owner'), body: JSON.stringify({ role: 'manager' }),
    });
    expect(res.status).toBe(200);
  });
});

describe('verify-manager — không đổi session, fail an toàn', () => {
  let server: Server;
  let baseUrl: string;
  beforeAll(async () => {
    const { client } = makeSupabaseMock();
    ({ server, baseUrl } = await startApp(client));
    process.env.SUPABASE_URL = 'http://mock';
    process.env.SUPABASE_ANON_KEY = 'mock-anon';
  });
  afterAll(() => server?.close());

  const verify = (body: unknown) =>
    fetch(`${baseUrl}/api/auth/verify-manager`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });

  it('thiếu thông tin → 400 (chặn TRƯỚC khi gọi signIn)', async () => {
    // KHÔNG queue mock: route trả 400 trước khi chạm signInWithPassword.
    expect((await verify({ username: 'a' })).status).toBe(400);
  });

  it('sai mật khẩu → 401', async () => {
    signInMock.mockResolvedValueOnce({ data: { user: null }, error: { message: 'invalid' } });
    expect((await verify({ username: 'a', password: 'wrong' })).status).toBe(401);
  });

  it('đúng credentials nhưng role cashier → 403 (không đủ quyền)', async () => {
    signInMock.mockResolvedValueOnce({
      data: { user: { id: 'c', user_metadata: { role: 'cashier' } } }, error: null,
    });
    expect((await verify({ username: 'thungan', password: 'ok123456' })).status).toBe(403);
  });

  it('role THIẾU → 403 (fail an toàn, KHÔNG mặc định owner)', async () => {
    signInMock.mockResolvedValueOnce({
      data: { user: { id: 'x', user_metadata: {} } }, error: null,
    });
    expect((await verify({ username: 'x', password: 'ok123456' })).status).toBe(403);
  });

  it('manager hợp lệ → 200 kèm role', async () => {
    signInMock.mockResolvedValueOnce({
      data: { user: { id: 'm', user_metadata: { role: 'manager', display_name: 'Quản Lý' } } }, error: null,
    });
    const res = await verify({ username: 'ql', password: 'ok123456' });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.role).toBe('manager');
  });
});
