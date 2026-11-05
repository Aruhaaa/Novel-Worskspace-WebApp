import { isSupabaseConfigured } from './supabase';

/**
 * "Continue with Google" and "Continue with Apple". They are offered only when all of these hold:
 *  - there is a cloud database (a sign-in with a provider is an account on it),
 *  - the site's owner has switched the provider on for the website: VITE_AUTH_PROVIDERS=google,apple (and set the
 *    provider up in Supabase, see supabase/README.md), and
 *  - this is the website in a browser. Google refuses to sign anyone in from inside another program's window (the
 *    desktop app, the Android wrapper), so those keep the email form.
 */
export type AuthProvider = 'google' | 'apple';

export const PROVIDER_LABEL: Record<AuthProvider, string> = { google: 'Google', apple: 'Apple' };

const ALL: AuthProvider[] = ['google', 'apple'];

const insideAnotherProgram = (): boolean =>
  /Electron/i.test(navigator.userAgent) || !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();

export const enabledProviders = (): AuthProvider[] => {
  if (!isSupabaseConfigured || typeof window === 'undefined') return [];
  if (!/^https?:$/.test(location.protocol) || insideAnotherProgram()) return [];
  const wanted = String(import.meta.env.VITE_AUTH_PROVIDERS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase());
  return ALL.filter((p) => wanted.includes(p));
};
