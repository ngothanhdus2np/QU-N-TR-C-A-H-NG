import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus, Loader2, Trash2, KeyRound, Eye, EyeOff,
  ShoppingCart, LayoutDashboard, Crown, RefreshCw, X, Check,
} from 'lucide-react';
import { useToast } from '../../ui/Toast';
import { getAuthHeaders } from '../../../services/apiService';

type UserRole = 'cashier' | 'manager' | 'owner';

interface Account {
  id: string;
  email: string;
  role: UserRole;
  displayName: string;
  createdAt: string;
  lastSignIn: string | null;
  banned: boolean;
}

const ROLE_CONFIG: Record<UserRole, { label: string; color: string; icon: React.ElementType }> = {
  cashier: { label: 'Thu ngân', color: 'bg-blue-50 text-blue-600 border-blue-100', icon: ShoppingCart },
  manager: { label: 'Quản lý', color: 'bg-amber-50 text-amber-600 border-amber-100', icon: LayoutDashboard },
  owner: { label: 'Chủ cửa hàng', color: 'bg-rose-50 text-rose-600 border-rose-100', icon: Crown },
};

type RegisterRole = 'cashier' | 'manager' | 'owner';
const ROLE_LABELS: Record<RegisterRole, string> = {
  cashier: 'Thu ngân',
  manager: 'Quản lý',
  owner: 'Chủ cửa hàng',
};

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AccountsTab() {
  const { showToast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form tạo tài khoản
  const [showForm, setShowForm] = useState(false);
  const [newRole, setNewRole] = useState<RegisterRole>('cashier');
  const [newInput, setNewInput] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [creating, setCreating] = useState(false);

  // Đặt lại mật khẩu
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPassword, setResetPasswordVal] = useState('');
  const [showResetPw, setShowResetPw] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Đổi chức vụ
  const [roleEditId, setRoleEditId] = useState<string | null>(null);
  const [changingRole, setChangingRole] = useState(false);

  // Xóa tài khoản
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadAccounts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/accounts', { headers: await getAuthHeaders() });
      const json = await res.json();
      if (res.ok) setAccounts(json.accounts || []);
      else showToast(json.error || 'Không tải được danh sách tài khoản.', 'error');
    } catch {
      showToast('Lỗi kết nối server.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInput.trim() || !newPassword) return;
    setCreating(true);
    try {
      const body: Record<string, string> = {
        password: newPassword,
        role: newRole,
        displayName: newDisplayName.trim() || newInput.trim(),
      };
      if (newRole === 'cashier') body.username = newInput.trim();
      else body.email = newInput.trim();

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || 'Không thể tạo tài khoản.', 'error'); return; }
      showToast('Tạo tài khoản thành công!', 'success');
      setShowForm(false);
      setNewInput('');
      setNewDisplayName('');
      setNewPassword('');
      setNewRole('cashier');
      loadAccounts();
    } catch {
      showToast('Lỗi kết nối server.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleResetPassword = async (id: string) => {
    if (!resetPassword || resetPassword.length < 6) {
      showToast('Mật khẩu phải có ít nhất 6 ký tự.', 'error');
      return;
    }
    setResetting(true);
    try {
      const res = await fetch(`/api/auth/accounts/${id}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify({ password: resetPassword }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || 'Không thể đổi mật khẩu.', 'error'); return; }
      showToast('Đã đặt lại mật khẩu.', 'success');
      setResetId(null);
      setResetPasswordVal('');
    } catch {
      showToast('Lỗi kết nối server.', 'error');
    } finally {
      setResetting(false);
    }
  };

  const handleRoleChange = async (id: string, newRole: UserRole) => {
    setChangingRole(true);
    try {
      const res = await fetch(`/api/auth/accounts/${id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify({ role: newRole }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || 'Không thể đổi chức vụ.', 'error'); return; }
      showToast('Đã cập nhật chức vụ.', 'success');
      setRoleEditId(null);
      loadAccounts();
    } catch {
      showToast('Lỗi kết nối server.', 'error');
    } finally {
      setChangingRole(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/auth/accounts/${id}`, { method: 'DELETE', headers: await getAuthHeaders() });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || 'Không thể xóa tài khoản.', 'error'); return; }
      showToast('Đã xóa tài khoản.', 'success');
      setDeleteId(null);
      loadAccounts();
    } catch {
      showToast('Lỗi kết nối server.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header + nút thêm */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Danh sách tài khoản</h3>
          <p className="text-xs text-slate-500 mt-0.5">Quản lý tài khoản đăng nhập cho nhân viên</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadAccounts}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            title="Tải lại"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Thêm tài khoản
          </button>
        </div>
      </div>

      {/* Form tạo tài khoản */}
      {showForm && (
        <div className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm space-y-4" id="accounts-create">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-sm font-bold text-slate-800">Tạo tài khoản mới</h4>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleCreate} className="space-y-3">
            {/* Vai trò */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Vai trò</label>
              <div className="flex gap-2">
                {(Object.keys(ROLE_LABELS) as RegisterRole[]).map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => { setNewRole(r); setNewInput(''); }}
                    className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition-all ${
                      newRole === r
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    {ROLE_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>

            {/* Họ tên */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Họ và tên</label>
              <input
                type="text"
                value={newDisplayName}
                onChange={e => setNewDisplayName(e.target.value)}
                placeholder="vd: Nguyễn Văn A"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all"
              />
            </div>

            {/* Tên đăng nhập / email */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">
                {newRole === 'cashier' ? 'Tên đăng nhập' : 'Email hoặc Số điện thoại'}
              </label>
              <input
                type="text"
                value={newInput}
                onChange={e => setNewInput(e.target.value)}
                placeholder={newRole === 'cashier' ? 'vd: thungan01' : 'vd: 0901234567 hoặc email@gmail.com'}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all"
                required
              />
            </div>

            {/* Mật khẩu */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Mật khẩu</label>
              <div className="relative">
                <input
                  type={showNewPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 pr-10 text-sm outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all"
                  required
                />
                <button type="button" onClick={() => setShowNewPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showNewPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={creating}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
              >
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Tạo tài khoản
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Danh sách tài khoản */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          Chưa có tài khoản nào.
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map(acc => {
            const cfg = ROLE_CONFIG[acc.role] || ROLE_CONFIG.owner;
            const RoleIcon = cfg.icon;
            const isResetting = resetId === acc.id;
            const isDeleting = deleteId === acc.id;
            const isEditingRole = roleEditId === acc.id;

            return (
              <div key={acc.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                    <RoleIcon className="h-4 w-4 text-slate-500" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800 truncate">
                        {acc.displayName}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setRoleEditId(isEditingRole ? null : acc.id);
                          setResetId(null);
                          setDeleteId(null);
                        }}
                        title="Đổi chức vụ"
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all hover:ring-2 hover:ring-offset-1 ${cfg.color} ${isEditingRole ? 'ring-2 ring-offset-1' : ''}`}
                      >
                        {cfg.label}
                      </button>
                      {acc.banned && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                          Đã khóa
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{acc.email}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Đăng nhập gần nhất: {formatDate(acc.lastSignIn)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => { setResetId(isResetting ? null : acc.id); setResetPasswordVal(''); setDeleteId(null); setRoleEditId(null); }}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                      title="Đặt lại mật khẩu"
                    >
                      <KeyRound className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setDeleteId(isDeleting ? null : acc.id); setResetId(null); setRoleEditId(null); }}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                      title="Xóa tài khoản"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Đổi chức vụ */}
                {isEditingRole && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-xs text-slate-500 mb-2">Chọn chức vụ mới:</p>
                    <div className="flex gap-2">
                      {(Object.keys(ROLE_CONFIG) as UserRole[]).map(r => {
                        const rc = ROLE_CONFIG[r];
                        const isCurrentRole = acc.role === r;
                        return (
                          <button
                            key={r}
                            type="button"
                            disabled={changingRole || isCurrentRole}
                            onClick={() => handleRoleChange(acc.id, r)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs rounded-lg border font-medium transition-all disabled:cursor-not-allowed ${
                              isCurrentRole
                                ? `${rc.color} opacity-60`
                                : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                            }`}
                          >
                            {changingRole ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                            {isCurrentRole ? '✓ ' : ''}{rc.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Form đặt lại mật khẩu */}
                {isResetting && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showResetPw ? 'text' : 'password'}
                        value={resetPassword}
                        onChange={e => setResetPasswordVal(e.target.value)}
                        placeholder="Mật khẩu mới (ít nhất 6 ký tự)"
                        className="w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 pr-10 text-sm outline-none focus:border-amber-400 focus:bg-white transition-all"
                      />
                      <button type="button" onClick={() => setShowResetPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                        {showResetPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleResetPassword(acc.id)}
                      disabled={resetting}
                      className="flex items-center gap-1 rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-60 transition-colors"
                    >
                      {resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Lưu
                    </button>
                    <button type="button" onClick={() => setResetId(null)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50">
                      Hủy
                    </button>
                  </div>
                )}

                {/* Xác nhận xóa */}
                {isDeleting && (
                  <div className="mt-3 pt-3 border-t border-red-100 flex items-center gap-2">
                    <p className="flex-1 text-xs text-red-600">Xóa tài khoản <strong>{acc.displayName}</strong>? Không thể hoàn tác.</p>
                    <button
                      type="button"
                      onClick={() => handleDelete(acc.id)}
                      disabled={deleting}
                      className="flex items-center gap-1 rounded-xl bg-red-500 px-3 py-2 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-60 transition-colors"
                    >
                      {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      Xóa
                    </button>
                    <button type="button" onClick={() => setDeleteId(null)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50">
                      Hủy
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
