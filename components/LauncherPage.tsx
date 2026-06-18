import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, LayoutDashboard, LogOut, Loader2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import { signOut } from '../services/auth';

type UserRole = 'cashier' | 'manager' | 'owner';

const ROLE_LABEL: Record<UserRole, string> = {
  cashier: 'Thu ngân',
  manager: 'Quản lý',
  owner: 'Chủ cửa hàng',
};

export default function LauncherPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState<UserRole>('owner');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { navigate('/login', { replace: true }); return; }
      const meta = user.user_metadata || {};
      setRole((meta.role as UserRole) || 'owner');
      setDisplayName(meta.display_name || user.email?.split('@')[0] || '');
      setIsLoading(false);
    });
  }, [navigate]);

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-rose-50">
        <Loader2 className="h-6 w-6 animate-spin text-rose-400" />
      </div>
    );
  }

  const isCashier = role === 'cashier';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-rose-50 via-white to-slate-50 px-4">
      {/* Logo + greeting */}
      <div className="flex flex-col items-center mb-10">
        <img
          src="/logo.png"
          alt="Logo"
          className="h-16 w-16 object-contain mb-4"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <h1 className="text-2xl font-bold text-slate-800">
          Xin chào, {displayName}
        </h1>
        <span className="mt-1 text-sm font-medium text-rose-500 bg-rose-50 border border-rose-100 px-3 py-0.5 rounded-full">
          {ROLE_LABEL[role]}
        </span>
      </div>

      {/* Buttons */}
      <div className={`flex gap-5 ${isCashier ? '' : 'flex-col sm:flex-row'}`}>
        {/* Nút bán hàng */}
        <button
          onClick={() => navigate('/pos')}
          className="group flex flex-col items-center justify-center gap-3 w-52 h-44 rounded-3xl bg-white border-2 border-rose-100 shadow-md hover:shadow-xl hover:border-rose-300 hover:-translate-y-1 active:scale-[0.97] transition-all duration-200"
        >
          <div className="h-14 w-14 rounded-2xl bg-rose-50 flex items-center justify-center group-hover:bg-rose-100 transition-colors">
            <ShoppingCart className="h-7 w-7 text-rose-500" />
          </div>
          <div className="text-center">
            <p className="font-bold text-slate-800 text-base">Bán hàng</p>
            <p className="text-xs text-slate-400 mt-0.5">Mở quầy tính tiền</p>
          </div>
        </button>

        {/* Nút quản lý — chỉ hiện với manager/owner */}
        {!isCashier && (
          <button
            onClick={() => navigate('/overview')}
            className="group flex flex-col items-center justify-center gap-3 w-52 h-44 rounded-3xl bg-white border-2 border-slate-100 shadow-md hover:shadow-xl hover:border-slate-300 hover:-translate-y-1 active:scale-[0.97] transition-all duration-200"
          >
            <div className="h-14 w-14 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-slate-100 transition-colors">
              <LayoutDashboard className="h-7 w-7 text-slate-600" />
            </div>
            <div className="text-center">
              <p className="font-bold text-slate-800 text-base">Quản lý</p>
              <p className="text-xs text-slate-400 mt-0.5">Báo cáo & điều hành</p>
            </div>
          </button>
        )}
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="mt-10 flex items-center gap-1.5 text-sm text-slate-400 hover:text-rose-500 transition-colors"
      >
        <LogOut className="h-4 w-4" />
        Đăng xuất
      </button>
    </div>
  );
}
