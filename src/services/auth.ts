import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { User } from './types';
import { isNetworkFailure } from '../lib/offlineCache';
import { appBaseUrl } from '../lib/share';

// Mock local auth storage
const LOCAL_SESSION_KEY = 'novelist_local_session';

type AccountMeta = Record<string, unknown> | undefined;

// What the person said they came for is kept in their account's own metadata: no database column needed
const modeOf = (meta: AccountMeta): User['mode'] => {
  const v = meta?.use_mode;
  return v === 'read' || v === 'write' || v === 'both' ? v : undefined;
};

class AuthService {
  async getUser(): Promise<User | null> {
    if (isSupabaseConfigured && supabase) {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (user && user.email) {
        return { id: user.id, email: user.email, mode: modeOf(user.user_metadata) };
      }
      // With no connection the server cannot confirm anyone, but the session kept on this device still shows who is signed in
      if (error && isNetworkFailure(error)) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email) return { id: session.user.id, email: session.user.email, mode: modeOf(session.user.user_metadata) };
      }
      return null;
    }

    // Local Mock Fallback
    const localSession = localStorage.getItem(LOCAL_SESSION_KEY);
    if (localSession) {
      try {
        return JSON.parse(localSession) as User;
      } catch {
        return null;
      }
    }
    return null;
  }

  async login(email: string, password: string):Promise<{user: User | null, error: string | null, message?: string | null}> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { user: null, error: error.message };
      if (data.user && data.user.email) {
        return { user: { id: data.user.id, email: data.user.email, mode: modeOf(data.user.user_metadata) }, error: null };
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

  async signup(email: string, password: string):Promise<{user: User | null, error: string | null, message?: string | null}> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return { user: null, error: error.message };
      
      // If session is null, it usually means email confirmation is required
      if (!data.session) {
        return { user: null, error: null, message: 'Signup successful! Please check your email to verify your account.' };
      }
      
      if (data.user && data.user.email) {
        return { user: { id: data.user.id, email: data.user.email }, error: null };
      }
      return { user: null, error: 'An unexpected issue occurred during signup. Please try logging in.' };
    }

    // Local Mock Fallback
    if (email && password.length >= 6) {
      const mockUser: User = { id: `mock-user-${email}`, email };
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(mockUser));
      return { user: mockUser, error: null };
    }
    return { user: null, error: 'Invalid mock credentials. Password must be at least 6 characters.' };
  }

  /**
   * Send the browser to Google or Apple to sign in, and back to the site afterwards. If it works this page is left
   * at once, so the only thing to report is a failure to start. The way back is read by the Supabase client from the
   * address (the same way a password-reset link is), and the site's address must be in Supabase's list of Redirect URLs.
   */
  async signInWithProvider(provider: 'google' | 'apple'): Promise<{ error: string | null }> {
    if (!(isSupabaseConfigured && supabase)) return { error: 'Signing in with Google or Apple needs the cloud database.' };
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: appBaseUrl() } });
    if (error) return { error: isNetworkFailure(error) ? 'Could not reach the server. Check your connection and try again.' : error.message };
    return { error: null };
  }

  /** Remember the answer to "what brings you here" on the account. Quietly does nothing without the cloud database. */
  async saveMode(mode: NonNullable<User['mode']>): Promise<void> {
    if (!(isSupabaseConfigured && supabase)) return;
    try {
      await supabase.auth.updateUser({ data: { use_mode: mode } });
    } catch {
      // The choice is still kept on this device; it will be offered to the account again next time
    }
  }

  /**
   * Email a link that lets the person choose a new password. The answer is the same whether or not an account
   * exists for the address, so this cannot be used to find out who has one.
   */
  async requestPasswordReset(email: string): Promise<{ error: string | null }> {
    if (!(isSupabaseConfigured && supabase)) {
      return { error: 'Password reset needs the cloud database. In local mode your account lives in this browser only.' };
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: appBaseUrl() });
    if (error) {
      if (isNetworkFailure(error)) return { error: 'Could not reach the server. Check your connection and try again.' };
      // Too many requests is worth saying; anything else is kept vague on purpose
      if (error.status === 429 || /rate|seconds/i.test(error.message)) return { error: 'Too many requests. Please wait a minute and try again.' };
    }
    return { error: null };
  }

  /** Set a new password for whoever is signed in (including someone who arrived through a reset link). */
  async updatePassword(password: string): Promise<{ error: string | null }> {
    if (!(isSupabaseConfigured && supabase)) {
      return { error: 'Changing a password needs the cloud database.' };
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: isNetworkFailure(error) ? 'Could not reach the server. Check your connection and try again.' : error.message };
    return { error: null };
  }

  /** Check the current password without changing the session, before something sensitive. */
  async confirmPassword(email: string, password: string): Promise<boolean> {
    if (!(isSupabaseConfigured && supabase)) return true;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return !error;
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
