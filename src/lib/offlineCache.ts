/**
 * Keeps a copy of what was last loaded from the cloud, so a book you have already opened still opens
 * with no connection. Only used with the cloud database; the local database is already on this device.
 */
const PREFIX = 'novelist_cache_';

/** True for a failure to reach the server (as opposed to the server refusing the request). */
export const isNetworkFailure = (err: unknown): boolean => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const message = String((err as { message?: unknown } | null)?.message ?? err ?? '');
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(message);
};

/**
 * Load fresh data and remember it. If the server cannot be reached, fall back to the last copy.
 * Other errors (a refused request, a bad query) are passed on, never hidden behind old data.
 */
export const readThrough = async <T>(key: string, load: () => Promise<T>): Promise<T> => {
  try {
    const fresh = await load();
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(fresh));
    } catch {
      // storage full: loading still worked, we just cannot keep a copy
    }
    return fresh;
  } catch (err) {
    if (isNetworkFailure(err)) {
      try {
        const raw = localStorage.getItem(PREFIX + key);
        if (raw) return JSON.parse(raw) as T;
      } catch {
        // fall through to the original error
      }
    }
    throw err;
  }
};

/** Forget every kept copy, for example when someone signs out on a shared computer. */
export const clearOfflineCache = (): void => {
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(PREFIX)) localStorage.removeItem(k);
    }
  } catch {
    // ignore
  }
};
