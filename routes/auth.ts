import { Router, RequestHandler } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function createAuthRouter(supabase: SupabaseClient, requireAuth: RequestHandler) {
  const router = Router();

  /**
   * POST /api/auth/register
   * Tạo user mới bằng Admin API — bỏ qua xác nhận email hoàn toàn.
   * Thu ngân: { username, password, role: 'cashier' }
   * Quản lý/Chủ: { email, password, role: 'manager' | 'owner', displayName? }
   */
  router.post('/api/auth/register', requireAuth, async (req, res) => {
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

    const resolvedRole = role || 'cashier';
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
  router.get('/api/auth/accounts', requireAuth, async (_req, res) => {
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
  router.patch('/api/auth/accounts/:id/role', requireAuth, async (req, res) => {
    const { id } = req.params as { id: string };
    const { role } = req.body as { role?: string };
    if (!role || !['cashier', 'manager', 'owner'].includes(role)) {
      return res.status(400).json({ error: 'Chức vụ không hợp lệ.' });
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
  router.patch('/api/auth/accounts/:id/password', requireAuth, async (req, res) => {
    const { id } = req.params as { id: string };
    const { password } = req.body as { password?: string };
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự.' });
    }
    const { error } = await supabase.auth.admin.updateUserById(id, { password });
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ success: true });
  });

  /**
   * DELETE /api/auth/accounts/:id
   * Xóa tài khoản.
   */
  router.delete('/api/auth/accounts/:id', requireAuth, async (req, res) => {
    const { id } = req.params as { id: string };
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

    const role = data.user.user_metadata?.role || 'owner';
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
