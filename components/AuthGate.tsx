import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import { getCurrentSession } from '../services/auth';
import type { Session } from '@supabase/supabase-js';

interface AuthGateProps {
  children: React.ReactNode;
}


export default function AuthGate({ children }: AuthGateProps) {
  // Dev: khởi tạo truthy để bypass auth, Prod: null để check session thật
  const [session, setSession] = useState<Session | null>(
    !import.meta.env.PROD ? ({} as Session) : null
  );
  const [isLoading, setIsLoading] = useState(import.meta.env.PROD);

  useEffect(() => {
    // Luôn đăng ký listener ở mọi môi trường — cần thiết để logout hoạt động trong dev
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!import.meta.env.PROD) {
        // Dev: chỉ phản hồi SIGNED_OUT, bỏ qua INITIAL_SESSION để không override bypass
        if (event === 'SIGNED_OUT') setSession(null);
        return;
      }
      setSession(nextSession);
    });

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
    <div className="min-h-screen flex items-center justify-center bg-rose-50">
      <div className="flex flex-col items-center gap-4">
        <img src="/logo.png" alt="Logo" className="h-14 w-14 object-contain opacity-80" />
        <Loader2 className="h-6 w-6 animate-spin text-rose-400" />
      </div>
    </div>
  );

  if (session) return <>{children}</>;

  return <Navigate to="/login" replace />;
}
