/**
 * Authentication Service
 * Handles user authentication with Supabase Auth
 */

import { supabase } from './supabase';
import type { User, Session, AuthError } from '@supabase/supabase-js';

export interface SignInCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User | null;
  session: Session | null;
  error: AuthError | null;
}

/**
 * Sign in with email and password
 */
export const signIn = async (credentials: SignInCredentials): Promise<AuthResponse> => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });

  return {
    user: data.user,
    session: data.session,
    error,
  };
};

/**
 * Sign out current user
 */
export const signOut = async (): Promise<{ error: AuthError | null }> => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

/**
 * Get current session
 */
export const getCurrentSession = async (): Promise<Session | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
};

// Đã xóa (code chết, không nơi nào gọi → loại bỏ rủi ro bảo mật BUG-SEC):
//   signUp           — tạo user phải làm qua Supabase Dashboard (admin)
//   resetPassword    — không rate-limit
//   updatePassword   — không xác thực mật khẩu cũ
//   getUserMetadata  — fallback nguy hiểm role='owner'/tenant='phuc-sang'
//   isAdmin/isManager— chỉ dựa metadata client; phân quyền thật do RLS + requireAuth lo
// Nếu sau này cần phân quyền theo role, hãy kiểm tra phía server (RLS/route), không tin client.
