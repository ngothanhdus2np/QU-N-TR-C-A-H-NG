import { Router, RequestHandler, Request } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

type CallerInfo = { role: string; userId: string };

export function createAuthRouter(supabase: SupabaseClient, requireAuth: RequestHandler) {
  const router = Router();

  const ROLE_RANK: Record<string, number> = { cashier: 1, manager: 2, owner: 3 };
  const rankOf = (role: string): number => ROLE_RANK[role] ?? 1;

  /**
   * Xác định chức vụ của người gọi từ JWT (server-side — KHÔNG tin client).
   * - Dev/LAN: requireAuth đã cho qua mà không kèm JWT → coi như owner (giống adminStore).
   * - Có JWT hợp lệ nhưng thiếu/không rõ role → mặc định 'cashier' (thấp nhất) để fail an toàn.
   * - JWT có nhưng không hợp lệ → trả null (caller trả 401).
   */
  const resolveCaller = async (req: Request): Promise<CallerInfo | null> => {
    const authHeader = req.headers.authorization;
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!jwt) return null; // defense-in-depth: requireAuth (Lớp 1) đã chặn LAN-bypass trước
    const { data: { user }, error } = await supabase.auth.getUser(jwt);
    if (error || !user) return null;
    return {
      role: String(user.user_metadata?.role ?? 'cashier').toLowerCase(),
      userId: user.id,
    };
  };

  const countOwners = async (): Promise<number> => {
    const { data } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    return (data?.users ?? []).filter(
      u => String(u.user_metadata?.role ?? '').toLowerCase() === 'owner'
    ).length;
  };

  const getTargetRole = async (id: string): Promise<string> => {
    const { data } = await supabase.auth.admin.getUserById(id);
    return String(data?.user?.user_metadata?.role ?? 'cashier').toLowerCase();
  };

  // Cổng: chỉ chủ cửa hàng (owner)
  const requireOwner: RequestHandler = async (req, res, next) => {
    const caller = await resolveCaller(req);
    if (!caller) return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ.' });
    if (caller.role !== 'owner') {
      return res.status(403).json({ error: 'Chỉ chủ cửa hàng mới có quyền thực hiện thao tác này.' });
    }
    res.locals.caller = caller;
    next();
  };

  // Cổng: quản lý hoặc chủ cửa hàng
  const requireManagerOrOwner: RequestHandler = async (req, res, next) => {
    const caller = await resolveCaller(req);
    if (!caller) return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ.' });
    if (rankOf(caller.role) < rankOf('manager')) {
      return res.status(403).json({ error: 'Bạn không có quyền quản lý tài khoản.' });
    }
    res.locals.caller = caller;
    next();
  };

  /**
   * GET /api/auth/has-accounts
   * Không cần đăng nhập — cho frontend biết hệ thống đã có tài khoản nào chưa, để quyết định
   * hiện màn hình đăng nhập bình thường hay màn hình "Thiết lập lần đầu" (sau khi trắng hóa).
   */
  router.get('/api/auth/has-accounts', async (_req, res) => {
    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1 });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ hasAccounts: (data?.users?.length ?? 0) > 0 });
  });

  /**
   * POST /api/auth/bootstrap-owner
   * Không cần đăng nhập (chicken-and-egg: sau khi trắng hóa không còn ai đăng nhập được) —
   * NHƯNG chỉ hoạt động khi hệ thống thật sự chưa có tài khoản nào (kiểm tra phía server,
   * không tin client) — nếu đã có tài khoản, từ chối ngay để tránh bị lợi dụng chiếm quyền.
   */
  router.post('/api/auth/bootstrap-owner', async (req, res) => {
    const { data: existing, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1 });
    if (listErr) return res.status(500).json({ error: listErr.message });
    if ((existing?.users?.length ?? 0) > 0) {
      return res.status(403).json({ error: 'Hệ thống đã có tài khoản — không thể thiết lập lại.' });
    }

    const { email, password, displayName } = req.body as {
      email?: string;
      password?: string;
      displayName?: string;
    };
    if (!email || !password) {
      return res.status(400).json({ error: 'Thiếu email hoặc mật khẩu.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự.' });
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { role: 'owner', display_name: displayName || email.split('@')[0] },
    });
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ success: true, userId: data.user?.id });
  });

  /**
   * POST /api/auth/register
   * Tạo user mới bằng Admin API — bỏ qua xác nhận email hoàn toàn.
   * Thu ngân: { username, password, role: 'cashier' }
   * Quản lý/Chủ: { email, password, role: 'manager' | 'owner', displayName? }
   */
  router.post('/api/auth/register', requireAuth, requireManagerOrOwner, async (req, res) => {
    const { username, email, password, role, displayName } = req.body as {
      username?: string;
      email?: string;
      password?: string;
      role?: string;
      displayName?: string;
    };

    if (!password) {
      return res.status(400).json({ error: 'Thiếu mật khẩu.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự.' });
    }

    const resolvedRole = (role || 'cashier').toLowerCase();
    if (!['cashier', 'manager', 'owner'].includes(resolvedRole)) {
      return res.status(400).json({ error: 'Chức vụ không hợp lệ.' });
    }
    // Quản lý chỉ được tạo thu ngân — không được tạo manager/owner (chống leo thang đặc quyền)
    const caller = res.locals.caller as CallerInfo;
    if (caller.role !== 'owner' && resolvedRole !== 'cashier') {
      return res.status(403).json({ error: 'Quản lý chỉ được tạo tài khoản thu ngân.' });
    }
    let resolvedEmail: string;

    if (email) {
      // Quản lý / Chủ cửa hàng: dùng email thật hoặc SĐT → @sdt.local
      const isPhoneNumber = /^[0-9+\s\-()]{8,15}$/.test(email.trim());
      resolvedEmail = isPhoneNumber
        ? `${email.trim().replace(/\D/g, '')}@sdt.local`
        : email.trim().toLowerCase();
    } else if (username) {
      const usernameClean = username.trim().toLowerCase();
      if (!/^[a-z0-9_.\-]+$/.test(usernameClean)) {
        return res.status(400).json({ error: 'Tên đăng nhập chỉ được chứa chữ thường, số, dấu _ hoặc dấu chấm.' });
      }
      resolvedEmail = `${usernameClean}@cfobrain.local`;
    } else {
      return res.status(400).json({ error: 'Thiếu tên đăng nhập hoặc email.' });
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: resolvedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        role: resolvedRole,
        display_name: displayName || username || resolvedEmail.split('@')[0],
      },
    });

    if (error) {
      if (error.message?.includes('already registered') || error.message?.includes('already exists')) {
        return res.status(409).json({ error: 'Tài khoản này đã được sử dụng.' });
      }
      return res.status(400).json({ error: error.message });
    }

    return res.json({ success: true, userId: data.user?.id });
  });

  /**
   * GET /api/auth/accounts
   * Lấy danh sách tất cả tài khoản (chỉ dùng trong Settings).
   */
  router.get('/api/auth/accounts', requireAuth, requireManagerOrOwner, async (_req, res) => {
    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (error) {
      console.error('[AUTH] admin.listUsers error:', error.message, error.status);
      return res.status(500).json({ error: error.message });
    }

    const accounts = data.users.map(u => ({
      id: u.id,
      email: u.email,
      role: u.user_metadata?.role || 'owner',
      displayName: u.user_metadata?.display_name || u.email?.split('@')[0] || '',
      createdAt: u.created_at,
      lastSignIn: u.last_sign_in_at,
      banned: u.banned_until ? new Date(u.banned_until) > new Date() : false,
    }));

    return res.json({ accounts });
  });

  /**
   * PATCH /api/auth/accounts/:id/role
   * Đổi chức vụ cho tài khoản.
   */
  router.patch('/api/auth/accounts/:id/role', requireAuth, requireOwner, async (req, res) => {
    const { id } = req.params as { id: string };
    const { role } = req.body as { role?: string };
    if (!role || !['cashier', 'manager', 'owner'].includes(role)) {
      return res.status(400).json({ error: 'Chức vụ không hợp lệ.' });
    }
    const caller = res.locals.caller as CallerInfo;
    if (id === caller.userId) {
      return res.status(400).json({ error: 'Không thể tự đổi chức vụ của chính mình.' });
    }
    // Hạ quyền một owner → đảm bảo vẫn còn ít nhất 1 owner khác
    const currentRole = await getTargetRole(id);
    if (currentRole === 'owner' && role !== 'owner' && (await countOwners()) <= 1) {
      return res.status(400).json({ error: 'Không thể hạ quyền chủ cửa hàng cuối cùng.' });
    }
    const { data: existing } = await supabase.auth.admin.getUserById(id);
    const currentMeta = existing?.user?.user_metadata || {};
    const { error } = await supabase.auth.admin.updateUserById(id, {
      user_metadata: { ...currentMeta, role },
    });
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ success: true });
  });

  /**
   * PATCH /api/auth/accounts/:id/password
   * Đặt lại mật khẩu cho tài khoản.
   */
  router.patch('/api/auth/accounts/:id/password', requireAuth, requireManagerOrOwner, async (req, res) => {
    const { id } = req.params as { id: string };
    const { password } = req.body as { password?: string };
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự.' });
    }
    // Quản lý chỉ được đặt lại mật khẩu cho thu ngân
    const caller = res.locals.caller as CallerInfo;
    if (caller.role !== 'owner' && (await getTargetRole(id)) !== 'cashier') {
      return res.status(403).json({ error: 'Quản lý chỉ được đặt lại mật khẩu cho thu ngân.' });
    }
    const { error } = await supabase.auth.admin.updateUserById(id, { password });
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ success: true });
  });

  /**
   * DELETE /api/auth/accounts/:id
   * Xóa tài khoản.
   */
  router.delete('/api/auth/accounts/:id', requireAuth, requireManagerOrOwner, async (req, res) => {
    const { id } = req.params as { id: string };
    const caller = res.locals.caller as CallerInfo;
    if (id === caller.userId) {
      return res.status(400).json({ error: 'Không thể tự xóa tài khoản của chính mình.' });
    }
    const targetRole = await getTargetRole(id);
    // Quản lý chỉ được xóa thu ngân
    if (caller.role !== 'owner' && targetRole !== 'cashier') {
      return res.status(403).json({ error: 'Quản lý chỉ được xóa tài khoản thu ngân.' });
    }
    // Không cho xóa owner cuối cùng
    if (targetRole === 'owner' && (await countOwners()) <= 1) {
      return res.status(400).json({ error: 'Không thể xóa chủ cửa hàng cuối cùng.' });
    }
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ success: true });
  });

  /**
   * POST /api/auth/verify-manager
   * Xác minh credentials của manager/owner mà không đổi session hiện tại.
   */
  router.post('/api/auth/verify-manager', async (req, res) => {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password) {
      return res.status(400).json({ error: 'Thiếu thông tin đăng nhập.' });
    }

    const email = username.includes('@')
      ? username
      : `${username.trim().toLowerCase()}@cfobrain.local`;

    const tempClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );

    const { data, error } = await tempClient.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return res.status(401).json({ error: 'Tài khoản hoặc mật khẩu không đúng.' });
    }

    // Fail an toàn: thiếu role → chuỗi rỗng (KHÔNG mặc định 'owner')
    const role = String(data.user.user_metadata?.role ?? '').toLowerCase();
    await tempClient.auth.signOut();

    if (role !== 'manager' && role !== 'owner') {
      return res.status(403).json({ error: 'Tài khoản này không có quyền quản lý.' });
    }

    return res.json({
      success: true,
      role,
      displayName: data.user.user_metadata?.display_name || username,
    });
  });

  return router;
}
