import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Eye, EyeOff, ShoppingCart, LayoutDashboard, LogOut } from 'lucide-react';
import { signIn, signOut } from '../services/auth';
import { triggerCashierTransition } from './LoginTransitionOverlay';

const ROLE_LABEL: Record<string, string> = {
  cashier: 'Thu ngân',
  manager: 'Quản lý',
  owner: 'Chủ cửa hàng',
};

const resolveEmail = (input: string): string => {
  const trimmed = input.trim().toLowerCase();
  if (trimmed.includes('@')) return trimmed;
  const digitsOnly = trimmed.replace(/\D/g, '');
  const isPhone = /^(0|\+?84)\d{8,10}$/.test(trimmed) || (digitsOnly.length >= 9 && digitsOnly.length <= 11);
  if (isPhone) return `${digitsOnly}@sdt.local`;
  return `${trimmed}@cfobrain.local`;
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState<{ displayName: string; role: string } | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!loginInput.trim()) { setError('Vui lòng nhập thông tin đăng nhập.'); return; }
    setIsLoading(true);
    const email = resolveEmail(loginInput);
    const result = await signIn({ email, password });
    setIsLoading(false);
    if (result.error) {
      setError('Tên đăng nhập hoặc mật khẩu không đúng.');
      return;
    }
    const meta = result.user?.user_metadata || {};
    const role = meta.role || 'owner';
    if (role === 'cashier') {
      triggerCashierTransition(() => navigate('/pos'));
      return;
    }
    const displayName = meta.display_name || result.user?.email?.split('@')[0] || '';
    setLoggedIn({ displayName, role });
  };

  const handleLogout = async () => {
    await signOut();
    setLoggedIn(null);
    setLoginInput('');
    setPassword('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-rose-50 px-4">
      <div className="w-[70vw] min-h-[70vh] rounded-3xl shadow-2xl overflow-hidden flex">

        {/* Cột trái */}
        <div className="hidden md:flex flex-col items-center justify-center gap-4 w-5/12 shrink-0 bg-white p-10">
          <img
            src="/logo.png"
            alt="Logo"
            className="w-4/5 max-w-xs object-contain"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="text-center mt-2">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Hệ thống quản lý doanh nghiệp</h2>
            <p className="mt-1 text-sm text-slate-400">Quản lý bán hàng · Báo cáo tài chính · Phân tích AI</p>
          </div>
        </div>

        {/* Cột phải */}
        <div className="flex-1 bg-white flex flex-col justify-center px-8 py-10 md:px-12">

          {/* Logo mobile */}
          <div className="flex md:hidden items-center gap-3 mb-8">
            <img src="/logo.png" alt="Logo" className="h-8 w-8 object-contain" />
            <span className="font-bold text-slate-800 text-lg">CFO Brain</span>
          </div>

          {loggedIn ? (
            <div className="flex flex-col items-center gap-6">
              <div className="text-center">
                <p className="text-lg font-bold text-slate-800">Xin chào, {loggedIn.displayName}</p>
                <span className="mt-1 inline-block text-xs font-medium text-rose-500 bg-rose-50 border border-rose-100 px-3 py-0.5 rounded-full">
                  {ROLE_LABEL[loggedIn.role] ?? loggedIn.role}
                </span>
              </div>

              <p className="text-sm text-slate-400">Bạn muốn vào đâu?</p>

              <div className="flex gap-4 w-full">
                <button
                  onClick={() => navigate('/pos')}
                  className="group flex-1 flex flex-col items-center justify-center gap-3 py-7 rounded-2xl bg-rose-50 border-2 border-rose-100 hover:border-rose-400 hover:bg-rose-100 hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-150"
                >
                  <ShoppingCart className="h-7 w-7 text-rose-500" />
                  <div className="text-center">
                    <p className="font-bold text-slate-800 text-sm">Bán hàng</p>
                    <p className="text-xs text-slate-400 mt-0.5">Mở quầy tính tiền</p>
                  </div>
                </button>

                <button
                  onClick={() => navigate('/overview')}
                  className="group flex-1 flex flex-col items-center justify-center gap-3 py-7 rounded-2xl bg-slate-50 border-2 border-slate-100 hover:border-slate-400 hover:bg-slate-100 hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-150"
                >
                  <LayoutDashboard className="h-7 w-7 text-slate-600" />
                  <div className="text-center">
                    <p className="font-bold text-slate-800 text-sm">Quản lý</p>
                    <p className="text-xs text-slate-400 mt-0.5">Báo cáo & điều hành</p>
                  </div>
                </button>
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-rose-500 transition-colors mt-2"
              >
                <LogOut className="h-4 w-4" />
                Đăng xuất
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-slate-800 mb-1">Chào mừng trở lại</h1>
              <p className="text-sm text-slate-400 mb-6">Nhập tên đăng nhập, email hoặc số điện thoại</p>

              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                    Tên đăng nhập / Email / SĐT
                  </label>
                  <input
                    type="text"
                    value={loginInput}
                    onChange={e => setLoginInput(e.target.value)}
                    placeholder="vd: thungan01 · 0901234567 · email@..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100 transition-all"
                    autoComplete="username"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                    Mật khẩu
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 pr-11 text-sm text-slate-800 outline-none focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100 transition-all"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600 border border-red-100">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-60 active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg, #fb7185 0%, #f43f5e 100%)' }}
                >
                  {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Đăng nhập
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
