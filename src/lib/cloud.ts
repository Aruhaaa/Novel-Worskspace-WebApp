import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabase';
import { isNetworkFailure } from './offlineCache';

/**
 * Cloud storage for the features added after the first release (chapter notes, goals, version history,
 * the deleted-chapters bin and reading links). They live in tables created by
 * supabase/migrations/20261003_cloud_sync.sql. Until that has been run, every one of them quietly keeps
 * working on this device, as before.
 */
export type CloudFeature = 'notes' | 'settings' | 'history' | 'bin' | 'share';

/** The cloud database, when there is one. */
export const cloud = (): SupabaseClient | null => (isSupabaseConfigured && supabase ? supabase : null);

// What has been found out this session. undefined = not tried yet.
const available = new Map<CloudFeature, boolean>();

/** True when the error means the table or function has not been created yet. */
export const isMissingSchema = (error: unknown): boolean => {
  const e = (error || {}) as { code?: string; message?: string; status?: number };
  if (e.code && ['PGRST205', 'PGRST202', '42P01', '42883'].includes(e.code)) return true;
  return /schema cache|does not exist|could not find the (table|function)/i.test(e.message || '');
};

export const setupNeeded = (feature: CloudFeature): boolean => available.get(feature) === false;

/** Forget what was learned, for example after the setup has just been run. */
export const resetCloudState = () => available.clear();

/**
 * Run a cloud operation for a feature. Returns `{ ok: true, value }`, or `{ ok: false, reason }` where the reason is
 * 'none' (no cloud database), 'setup' (the tables are not created yet), 'network' (cannot reach it right now)
 * or 'error' (the server refused). Callers decide what each means; most fall back to this device.
 */
export type CloudResult<T> = { ok: true; value: T } | { ok: false; reason: 'none' | 'setup' | 'network' | 'error'; error?: unknown };

export const tryCloud = async <T>(feature: CloudFeature, run: (client: SupabaseClient) => Promise<T>): Promise<CloudResult<T>> => {
  const client = cloud();
  if (!client) return { ok: false, reason: 'none' };
  if (available.get(feature) === false) return { ok: false, reason: 'setup' };
  try {
    const value = await run(client);
    available.set(feature, true);
    return { ok: true, value };
  } catch (error) {
    if (isMissingSchema(error)) {
      available.set(feature, false);
      return { ok: false, reason: 'setup', error };
    }
    if (isNetworkFailure(error)) return { ok: false, reason: 'network', error };
    return { ok: false, reason: 'error', error };
  }
};

/** Unwrap a Supabase response, throwing its error so tryCloud can classify it. */
export const unwrap = <T>(res: { data: T | null; error: unknown }): T => {
  if (res.error) throw res.error;
  return res.data as T;
};
