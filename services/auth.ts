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

export interface SignUpCredentials extends SignInCredentials {
  metadata?: {
    tenant_id?: string;
    branch_id?: string;
    role?: string;
    [key: string]: any;
  };
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
 * Sign up new user (admin only - should be done via Supabase Dashboard)
 */
export const signUp = async (credentials: SignUpCredentials): Promise<AuthResponse> => {
  const { data, error } = await supabase.auth.signUp({
    email: credentials.email,
    password: credentials.password,
    options: {
      data: credentials.metadata || {},
    },
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
 * Get current user
 */
export const getCurrentUser = async (): Promise<User | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

/**
 * Get current session
 */
export const getCurrentSession = async (): Promise<Session | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
};

/**
 * Refresh session
 */
export const refreshSession = async (): Promise<{ session: Session | null; error: AuthError | null }> => {
  const { data, error } = await supabase.auth.refreshSession();
  return {
    session: data.session,
    error,
  };
};

/**
 * Reset password (send reset email)
 */
export const resetPassword = async (email: string): Promise<{ error: AuthError | null }> => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  return { error };
};

/**
 * Update password
 */
export const updatePassword = async (newPassword: string): Promise<{ error: AuthError | null }> => {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  return { error };
};

/**
 * Get user metadata (tenant_id, branch_id, role)
 */
export const getUserMetadata = (user: User | null): {
  tenant_id: string;
  branch_id: string;
  role: string;
} => {
  const metadata = user?.user_metadata || {};
  return {
    tenant_id: metadata.tenant_id || 'phuc-sang',
    branch_id: metadata.branch_id || 'main',
    role: metadata.role || 'user',
  };
};

/**
 * Check if user is admin
 */
export const isAdmin = (user: User | null): boolean => {
  const { role } = getUserMetadata(user);
  return role === 'admin';
};

/**
 * Check if user is manager
 */
export const isManager = (user: User | null): boolean => {
  const { role } = getUserMetadata(user);
  return role === 'admin' || role === 'manager';
};
