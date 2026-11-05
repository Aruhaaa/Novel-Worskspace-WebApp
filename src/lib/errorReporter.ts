import { tryCloud, unwrap } from './cloud';

/**
 * Finding out what goes wrong on people's screens, so it can be fixed. When something breaks, a short report is sent:
 * what the error said, where in the program it happened, which part of the app was open, and which build it was.
 * Never what anyone wrote, and never who they are. It can be switched off in Preferences.
 *
 * With the cloud database set up (supabase/setup_scripts/20261105_next_features.sql) reports go to a list the admin
 * reads (Admin > Errors). Without it, or when it cannot be reached, they are kept on this device only, for whoever
 * runs the app locally.
 */
export interface ErrorGroup {
  fingerprint: string;
  message: string;
  source: string;
  occurrences: number;
  first_seen: string;
  last_seen: string;
  sample_stack: string;
  sample_url: string;
  app_version: string;
}

const ENABLED_KEY = 'novelist_error_reports';
const LOG_KEY = 'novelist_error_log';
const LOG_MAX = 40;
const PER_FINGERPRINT = 3;
const PER_SESSION = 40;

/** Whether reports may be sent. On unless switched off. */
export const errorReportsEnabled = (): boolean => {
  try {
    return localStorage.getItem(ENABLED_KEY) !== 'off';
  } catch {
    return true;
  }
};

export const setErrorReportsEnabled = (on: boolean): void => {
  try {
    localStorage.setItem(ENABLED_KEY, on ? 'on' : 'off');
  } catch {
    // storage unavailable
  }
};

const buildId = (): string => (typeof __BUILD_ID__ === 'string' && __BUILD_ID__ ? __BUILD_ID__ : 'dev');
const source = (): 'web' | 'desktop' => (/Electron/i.test(navigator.userAgent) ? 'desktop' : 'web');

/**
 * Which screen was open, and nothing else. Long codes (ids, private reading links) are replaced, and anything after
 * the screen's name is dropped, because the address can carry secrets: a password-reset link puts a token in it.
 */
export const scrubUrl = (url: string): string => {
  const route = /^#?\/[^?#&=\s]*/.exec(url)?.[0] ?? '';
  const withHash = route ? (route.startsWith('#') ? route : `#${route}`) : '#/';
  return withHash
    .replace(/\/[^/]{21,}/g, '/:id')
    .replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, ':id')
    .replace(/[0-9a-fA-F]{16,}/g, ':id')
    .slice(0, 200);
};

/** The folder part of a place on this computer (the desktop app runs from a folder with a user name in it) */
const FILE_FOLDER = /(?:file:\/\/\/?|(?<![A-Za-z])[A-Za-z]:[\\/])[^\s)'"]*[\\/]/g;

/** A few engines put a piece of the text that failed to read into the message. That piece is writing, so it goes. */
export const scrubMessage = (message: string): string =>
  message
    .replace(/, "[^"]*"(\.\.\.)? is not valid JSON/gi, ', "…" is not valid JSON')
    .replace(/(JSON[^"\n]*?)"[^"\n]*"/gi, '$1"…"')
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g, '[token]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]')
    // An address keeps its path (which file failed to load) but loses the host and anything after a "?"
    .replace(/(https?:\/\/[^\s"'()?#]*)[?#][^\s"'()]*/g, '$1')
    .replace(/https?:\/\/[^/\s"'()]+/g, '')
    .replace(FILE_FOLDER, '');

const hash = (text: string): string => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
};

/** Messages that are about the browser, an extension or the person's connection, not about this app. */
const NOISE = [
  /ResizeObserver loop/i,
  /^Script error\.?$/i,
  /(chrome|moz|safari)-extension:/i,
  /Non-Error promise rejection captured/i,
  /AbortError/i,
  /^(TypeError: )?(Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.?)$/i,
];

const messageOf = (error: unknown): string => {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error) ?? String(error);
  } catch {
    return String(error);
  }
};

/** Make errors that differ only in numbers or quoted words group together. */
const normalise = (message: string): string => message.replace(/[0-9a-f]{8,}/gi, '#').replace(/\d+/g, '#').replace(/"[^"]*"|'[^']*'/g, '…').slice(0, 200);

/** The first place in our own code (not a library) where it went wrong, without the numbers that change between builds */
const topFrame = (cleanedStack: string): string => {
  const lines = cleanedStack.split('\n');
  const line = lines.find((l) => !/node_modules|react-dom|chunk-/.test(l)) ?? lines[0] ?? '';
  return line.replace(/-[A-Za-z0-9_-]{8}\.(js|mjs)/g, '.$1').replace(/:\d+:\d+/g, '').replace(/\?[^\s)]*/g, '').trim().slice(0, 160);
};

export const fingerprintOf = (message: string, cleanedStack: string): string => hash(`${normalise(message)}|${topFrame(cleanedStack)}`);

/** A line of a stack that is a place in the program (Chrome and Edge write "at …", Firefox and Safari "name@address:line:column") */
const FRAME = /^\s*at\s|@\S*:\d+:\d+\s*$/;

/**
 * The stack as sent: only where in the program, never the words of the message (a stack repeats the message on its first
 * line, which could carry an email address or a piece of someone's writing), and never an address on this computer.
 */
const cleanStack = (stack: string): string =>
  stack
    .split('\n')
    .filter((line) => FRAME.test(line))
    .slice(0, 14)
    .join('\n')
    .replace(/https?:\/\/[^/\s)]+/g, '')
    .replace(FILE_FOLDER, '')
    .replace(/\?[^\s):]*(?=:\d+:\d+)/g, '')
    .slice(0, 3500);

const seen = new Map<string, number>();
let sent = 0;

const readLog = (): ErrorGroup[] => {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) || '[]') as ErrorGroup[];
  } catch {
    return [];
  }
};

type Report = Omit<ErrorGroup, 'occurrences' | 'first_seen' | 'last_seen'>;

const keepLocally = (g: Report) => {
  const log = readLog();
  const now = new Date().toISOString();
  const found = log.find((x) => x.fingerprint === g.fingerprint);
  if (found) {
    found.occurrences += 1;
    found.last_seen = now;
  } else {
    log.unshift({ ...g, occurrences: 1, first_seen: now, last_seen: now });
  }
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(0, LOG_MAX)));
  } catch {
    // storage full or refused
  }
};

/** Report something that went wrong. Quietly does nothing if reports are off, repeated too often, or just noise. */
export const reportError = (error: unknown, context: { where?: string; components?: string | null } = {}): void => {
  try {
    if (!errorReportsEnabled()) return;
    const message = scrubMessage(messageOf(error)).slice(0, 300);
    if (!message || NOISE.some((re) => re.test(message))) return;
    const stack = error instanceof Error && error.stack ? cleanStack(error.stack) : '';
    const fingerprint = fingerprintOf(message, stack);
    const count = (seen.get(fingerprint) ?? 0) + 1;
    seen.set(fingerprint, count);
    if (count > PER_FINGERPRINT || sent >= PER_SESSION) return;
    sent++;

    // The desktop app runs from a file, whose folder name would say where it is installed; only the screen counts
    const report: Report = { fingerprint, message, sample_stack: stack, source: source(), sample_url: scrubUrl(location.hash), app_version: buildId() };
    const extra: Record<string, string> = {};
    if (context.where) extra.where = context.where;
    // Names of screens and parts, such as "at LibraryView"; never anything that was written
    if (context.components) {
      extra.components = context.components
        .split('\n')
        .map((l) => l.trim().replace(/^at\s+/, '').replace(/\s*\(.*$/, '').replace(/@\S+$/, ''))
        .filter(Boolean)
        .slice(0, 8)
        .join(' < ')
        .slice(0, 400);
    }

    void tryCloud('errors', async (c) => {
      unwrap(
        await c.rpc('report_client_error', {
          p_fingerprint: fingerprint,
          p_message: message,
          p_stack: stack,
          p_source: report.source,
          p_version: report.app_version,
          p_url: report.sample_url,
          p_ua: navigator.userAgent.slice(0, 200),
          p_extra: extra,
        })
      );
    }).then((res) => {
      // Without a place to send it, or no connection, the report stays on this device
      if (!res.ok) keepLocally(report);
    });
  } catch {
    // Reporting must never be the thing that breaks
  }
};

let started = false;
/** Start catching errors nobody caught. Call once at start-up. */
export const initErrorReporting = (): void => {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('error', (event) => {
    // A failed picture or script file is not an error in our code
    if (event.target && event.target !== window) return;
    reportError(event.error ?? event.message, { where: 'window' });
  });
  window.addEventListener('unhandledrejection', (event) => reportError(event.reason, { where: 'promise' }));
};

export interface ErrorList {
  groups: ErrorGroup[];
  /** cloud: from the server. local: kept on this device. setup: the server has no error log yet (what is on this device is shown) */
  source: 'cloud' | 'local' | 'setup';
  error: string | null;
}

/** The admin's list: what the server has gathered, or what this device has kept when there is no server for it. */
export const listErrorGroups = async (): Promise<ErrorList> => {
  const res = await tryCloud('errors', async (c) => unwrap(await c.rpc('admin_error_groups', { p_days: 14 })) as ErrorGroup[]);
  if (res.ok) return { groups: res.value.map((g) => ({ ...g, occurrences: Number(g.occurrences) })), source: 'cloud', error: null };
  if (res.reason === 'setup') return { groups: readLog(), source: 'setup', error: null };
  if (res.reason === 'none') return { groups: readLog(), source: 'local', error: null };
  const message = (res.error as { message?: unknown } | null)?.message;
  const fallback = res.reason === 'network' ? 'Could not reach the database to load the error list.' : 'Could not load the error list.';
  return { groups: [], source: 'cloud', error: typeof message === 'string' && res.reason === 'error' ? message : fallback };
};

export const clearErrors = async (fingerprint?: string): Promise<void> => {
  const res = await tryCloud('errors', async (c) => {
    unwrap(await c.rpc('admin_clear_errors', { p_fingerprint: fingerprint ?? null }));
  });
  if (res.ok) return;
  // What is kept on this device can always be cleared from here
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(fingerprint ? readLog().filter((g) => g.fingerprint !== fingerprint) : []));
  } catch {
    // storage unavailable
  }
};
