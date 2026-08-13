import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { User } from './types';

// Mock local auth storage
const LOCAL_SESSION_KEY = 'novelist_local_session';

class AuthService {
  async getUser(): Promise<User | null> {
    if (isSupabaseConfigured && supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.email) {
        return { id: user.id, email: user.email };
      }
      return null;
    }

    // Local Mock Fallback
    const localSession = localStorage.getItem(LOCAL_SESSION_KEY);
    if (localSession) {
      try {
        return JSON.parse(localSession) as User;
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  async login(email: string, password: string):Promise<{user: User | null, error: string | null}> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { user: null, error: error.message };
      if (data.user && data.user.email) {
        return { user: { id: data.user.id, email: data.user.email }, error: null };
      }
      return { user: null, error: 'User data not found.' };
    }

    // Local Mock Fallback (Insecure, just for development)
    if (email && password.length >= 6) {
      const mockUser: User = { id: `mock-user-${email}`, email };
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(mockUser));
      return { user: mockUser, error: null };
    }
    return { user: null, error: 'Invalid mock credentials. Password must be at least 6 characters.' };
  }

  async signup(email: string, password: string):Promise<{user: User | null, error: string | null}> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return { user: null, error: error.message };
      if (data.user && data.user.email) {
        return { user: { id: data.user.id, email: data.user.email }, error: null };
      }
      return { user: null, error: 'User data not found after signup.' };
    }

    // Local Mock Fallback
    if (email && password.length >= 6) {
      const mockUser: User = { id: `mock-user-${email}`, email };
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(mockUser));
      return { user: mockUser, error: null };
    }
    return { user: null, error: 'Invalid mock credentials. Password must be at least 6 characters.' };
  }

  async logout(): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
      return;
    }

    // Local Mock Fallback
    localStorage.removeItem(LOCAL_SESSION_KEY);
  }
}

export const authService = new AuthService();
