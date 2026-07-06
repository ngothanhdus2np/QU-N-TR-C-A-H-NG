import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { getCurrentSession, signIn } from '../services/auth';
import AppLoadingScreen from './AppLoadingScreen';
import type { Session } from '@supabase/supabase-js';

interface AuthGateProps {
  children: React.ReactNode;
}

// Dev auto-login: nếu .env.local khai báo VITE_DEV_LOGIN_USER + VITE_DEV_LOGIN_PASSWORD
// thì dev ĐĂNG NHẬP THẬT (role `authenticated`) thay vì bypass anon. Cần thiết vì các
// bảng nội bộ (shopee_inventory_out, shopee_source_data...) đã REVOKE anon ở migration
// 023/024 — chạy anon sẽ bị "permission denied", trang Xuất kho không tải được đơn.
// Thiếu biến → giữ nguyên bypass `{}` cũ (không regression cho máy chưa cấu hình).
const DEV_USER = import.meta.env.VITE_DEV_LOGIN_USER as string | undefined;
const DEV_PASSWORD = import.meta.env.VITE_DEV_LOGIN_PASSWORD as string | undefined;
const DEV_AUTOLOGIN = !import.meta.env.PROD && !!DEV_USER && !!DEV_PASSWORD;

// Cùng quy tắc resolveEmail của LoginPage: username trần → @cfobrain.local
const resolveDevEmail = (input: string): string => {
  const trimmed = input.trim().toLowerCase();
  return trimmed.includes('@') ? trimmed : `${trimmed}@cfobrain.local`;
};

export default function AuthGate({ children }: AuthGateProps) {
  // Dev bypass: truthy để render ngay. Dev auto-login / Prod: null để chờ session thật.
  const [session, setSession] = useState<Session | null>(
    (!import.meta.env.PROD && !DEV_AUTOLOGIN) ? ({} as Session) : null
  );
  const [isLoading, setIsLoading] = useState(import.meta.env.PROD || DEV_AUTOLOGIN);

  useEffect(() => {
    // Luôn đăng ký listener ở mọi môi trường — cần thiết để logout hoạt động trong dev
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!import.meta.env.PROD && !DEV_AUTOLOGIN) {
        // Dev bypass: chỉ phản hồi SIGNED_OUT, bỏ qua INITIAL_SESSION để không override bypass
        if (event === 'SIGNED_OUT') setSession(null);
        return;
      }
      setSession(nextSession);
    });

    // Dev auto-login: đăng nhập thật rồi mới render → JWT sẵn sàng trước mọi fetch dữ liệu
    if (DEV_AUTOLOGIN) {
      let mounted = true;
      (async () => {
        try {
          let s = await getCurrentSession();
          if (!s) {
            const res = await signIn({ email: resolveDevEmail(DEV_USER!), password: DEV_PASSWORD! });
            if (res.error) console.error('[dev auto-login] thất bại:', res.error.message);
            s = res.session;
          }
          // Login lỗi vẫn render (bằng `{}`) để app dùng được — chỉ mất data khoá anon
          if (mounted) setSession(s ?? ({} as Session));
        } finally {
          if (mounted) setIsLoading(false);
        }
      })();
      return () => { mounted = false; listener.subscription.unsubscribe(); };
    }

    if (!import.meta.env.PROD) {
      return () => listener.subscription.unsubscribe();
    }

    let mounted = true;
    const timeoutId = setTimeout(() => {
      if (mounted) { setSession(null); setIsLoading(false); }
    }, 5000);
    getCurrentSession()
      .then(s => { if (mounted) setSession(s); })
      .catch(() => { if (mounted) setSession(null); })
      .finally(() => { clearTimeout(timeoutId); if (mounted) setIsLoading(false); });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Đang kiểm tra session → hiện loading (tránh flash)
  if (isLoading) return (
    <AppLoadingScreen visible={true} stageLabel="Đang kiểm tra đăng nhập..." />
  );

  if (session) return <>{children}</>;

  return <Navigate to="/login" replace />;
}
