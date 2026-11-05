import { useCallback, useEffect, useSyncExternalStore } from 'react';

/**
 * Writing sprints: a timed burst with a running word count and a short history.
 *
 * A sprint only MEASURES. The words typed during one are already counted by the normal autosave ->
 * dailyWords -> word_count_logs path, so nothing in this file ever writes to the word-count log.
 *
 * The first half is pure (the clock is always a parameter, nothing touches window or storage) so it can be
 * tested in Node. The second half keeps the one running sprint in a small store that every component shares.
 */

export interface SprintPlan {
  durationMs: number;
  goalWords: number | null;
}

export interface ActiveSprint {
  id: string;
  projectId: string;
  startedAt: number;
  durationMs: number;
  goalWords: number | null;
  /** When the current pause began, or null while the clock runs */
  pausedAt: number | null;
  /** Time spent in earlier pauses */
  pausedMs: number;
  /** Each chapter's length the first time it was seen during the sprint */
  baseline: Record<string, number>;
  latest: Record<string, number>;
  /** The most words credited so far. Only ever goes up. */
  peak: number;
}

export interface SprintResult {
  id: string;
  projectId: string;
  startedAt: number;
  endedAt: number;
  /** The length that was planned */
  durationMs: number;
  /** Time actually spent writing, pauses left out */
  activeMs: number;
  words: number;
  goalWords: number | null;
  /** True when the clock ran all the way down */
  completed: boolean;
  wpm: number;
  /** The time ran out while the page was closed */
  awayWhenFinished?: boolean;
}

export interface SprintSummary {
  thisWeek: { count: number; minutes: number; words: number };
  best: SprintResult | null;
  averageWpm: number;
  last: SprintResult[];
}

/** Ended early before this long: not worth a place in the history */
export const MIN_SAVED_MS = 15_000;
const MIN_WPM_MS = 10_000;
const HISTORY_LIMIT = 200;
const WARN_AT_MS = 60_000;
const TICK_MS = 250;

// ---------- Pure core ----------

const wholeWords = (n: number): number => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

export const startSprint = (projectId: string, plan: SprintPlan, chapterId: string, chapterWords: number, now: number): ActiveSprint => {
  const words = wholeWords(chapterWords);
  return {
    id: `${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    projectId,
    startedAt: now,
    durationMs: Math.max(1000, Math.round(plan.durationMs)),
    goalWords: plan.goalWords && plan.goalWords > 0 ? Math.round(plan.goalWords) : null,
    pausedAt: null,
    pausedMs: 0,
    baseline: { [chapterId]: words },
    latest: { [chapterId]: words },
    peak: 0,
  };
};

/** Time on the clock so far: pauses left out, never more than the planned length. */
export const elapsedMs = (s: ActiveSprint, now: number): number => {
  const until = s.pausedAt ?? now;
  return Math.min(s.durationMs, Math.max(0, until - s.startedAt - s.pausedMs));
};

export const remainingMs = (s: ActiveSprint, now: number): number => s.durationMs - elapsedMs(s, now);

export const isFinished = (s: ActiveSprint, now: number): boolean => elapsedMs(s, now) >= s.durationMs;

/**
 * Take a chapter's current length. Like the daily tracker, deleting never takes credit back, and a chapter
 * first seen mid-sprint starts from its first reading, so opening a long chapter credits nothing.
 * Words typed while paused still count: pausing stops the clock, not the pen.
 * Returns the same object when nothing changed.
 */
export const noteWords = (s: ActiveSprint, chapterId: string, words: number, now: number): ActiveSprint => {
  if (isFinished(s, now)) return s;
  const n = wholeWords(words);
  const seen = Object.hasOwn(s.baseline, chapterId);
  if (seen && s.latest[chapterId] === n) return s;
  const baseline = seen ? s.baseline : { ...s.baseline, [chapterId]: n };
  const latest = { ...s.latest, [chapterId]: n };
  let total = 0;
  for (const [id, base] of Object.entries(baseline)) total += Math.max(0, (latest[id] ?? base) - base);
  return { ...s, baseline, latest, peak: Math.max(s.peak, total) };
};

/**
 * A chapter was swapped for another version of itself, such as a restored one. Text that already existed is not
 * new writing, so the starting point moves with it and what was earned in that chapter stays exactly as it was.
 */
export const rebase = (s: ActiveSprint, chapterId: string, words: number): ActiveSprint => {
  if (!Object.hasOwn(s.baseline, chapterId)) return s;
  const n = wholeWords(words);
  const earned = Math.max(0, (s.latest[chapterId] ?? 0) - s.baseline[chapterId]);
  if (s.latest[chapterId] === n && n - earned === s.baseline[chapterId]) return s;
  return { ...s, baseline: { ...s.baseline, [chapterId]: n - earned }, latest: { ...s.latest, [chapterId]: n } };
};

export const pause = (s: ActiveSprint, now: number): ActiveSprint => (s.pausedAt !== null ? s : { ...s, pausedAt: Math.max(now, s.startedAt) });

export const resume = (s: ActiveSprint, now: number): ActiveSprint =>
  s.pausedAt === null ? s : { ...s, pausedAt: null, pausedMs: s.pausedMs + Math.max(0, now - s.pausedAt) };

/** Words per minute of real writing time. Zero when the sprint was too short to say anything. */
export const wordsPerMinute = (words: number, activeMs: number): number =>
  activeMs < MIN_WPM_MS ? 0 : Math.round(words / (activeMs / 60_000));

export const finish = (s: ActiveSprint, now: number, completed: boolean): SprintResult => {
  const activeMs = elapsedMs(s, now);
  // A sprint that ran out while nobody was looking ended when its time was up, not when the page woke
  const scheduledEnd = s.startedAt + s.pausedMs + s.durationMs;
  return {
    id: s.id,
    projectId: s.projectId,
    startedAt: s.startedAt,
    endedAt: completed ? Math.min(now, scheduledEnd) : now,
    durationMs: s.durationMs,
    activeMs,
    words: s.peak,
    goalWords: s.goalWords,
    completed,
    wpm: wordsPerMinute(s.peak, activeMs),
  };
};

/** More words wins; the same words in less time is the better sprint. */
export const isBetterSprint = (a: SprintResult, b: SprintResult): boolean => a.words > b.words || (a.words === b.words && a.wpm > b.wpm);

/**
 * Totals for the tracker page. "This week" is the last seven calendar days including today, in the
 * writer's own time zone: `dayOf` turns a Date into a YYYY-MM-DD string (the app passes localDate).
 */
export const summarise = (history: SprintResult[], now: number, dayOf: (d: Date) => string): SprintSummary => {
  const week = new Set<string>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    week.add(dayOf(d));
  }
  const recent = history.filter((r) => week.has(dayOf(new Date(r.startedAt))));

  let best: SprintResult | null = null;
  for (const r of history) if (r.words > 0 && (!best || isBetterSprint(r, best))) best = r;

  // Sprints too short to have a pace are left out of the average
  const paced = history.filter((r) => r.activeMs >= MIN_WPM_MS);
  const pacedWords = paced.reduce((sum, r) => sum + r.words, 0);
  const pacedMs = paced.reduce((sum, r) => sum + r.activeMs, 0);

  return {
    thisWeek: {
      count: recent.length,
      minutes: Math.round(recent.reduce((sum, r) => sum + r.activeMs, 0) / 60_000),
      words: recent.reduce((sum, r) => sum + r.words, 0),
    },
    best,
    averageWpm: pacedMs > 0 ? Math.round(pacedWords / (pacedMs / 60_000)) : 0,
    last: [...history].sort((a, b) => b.endedAt - a.endedAt).slice(0, 5),
  };
};

const pad2 = (n: number) => String(n).padStart(2, '0');

/** mm:ss, rounding up so the last second still reads 00:01. */
export const formatClock = (ms: number): string => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
};

/** "45 s", "20 min" or "7 min 12 s" */
export const formatSpan = (ms: number): string => {
  const total = Math.max(0, Math.round(ms / 1000));
  if (total < 60) return `${total} s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s ? `${m} min ${s} s` : `${m} min`;
};

// ---------- Reading what was saved (pure, and forgiving of anything odd) ----------

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const numberMap = (v: unknown): Record<string, number> | null => {
  if (!v || typeof v !== 'object') return null;
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(v)) {
    if (!isNum(n)) return null;
    out[k] = n;
  }
  return out;
};

export const parseActive = (raw: string | null): ActiveSprint | null => {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Record<string, unknown> | null;
    if (!v || typeof v !== 'object') return null;
    const baseline = numberMap(v.baseline);
    const latest = numberMap(v.latest);
    if (typeof v.id !== 'string' || typeof v.projectId !== 'string' || !baseline || !latest) return null;
    if (!isNum(v.startedAt) || !isNum(v.durationMs) || v.durationMs <= 0 || !isNum(v.pausedMs) || !isNum(v.peak)) return null;
    if (v.pausedAt !== null && !isNum(v.pausedAt)) return null;
    return {
      id: v.id,
      projectId: v.projectId,
      startedAt: v.startedAt,
      durationMs: v.durationMs,
      goalWords: isNum(v.goalWords) ? v.goalWords : null,
      pausedAt: v.pausedAt === null ? null : (v.pausedAt as number),
      pausedMs: v.pausedMs,
      baseline,
      latest,
      peak: v.peak,
    };
  } catch {
    return null;
  }
};

const asResult = (v: unknown): SprintResult | null => {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.projectId !== 'string' || typeof r.completed !== 'boolean') return null;
  if (!isNum(r.startedAt) || !isNum(r.endedAt) || !isNum(r.durationMs) || !isNum(r.activeMs) || !isNum(r.words) || !isNum(r.wpm)) return null;
  return {
    id: r.id,
    projectId: r.projectId,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    durationMs: r.durationMs,
    activeMs: r.activeMs,
    words: r.words,
    goalWords: isNum(r.goalWords) ? r.goalWords : null,
    completed: r.completed,
    wpm: r.wpm,
    ...(r.awayWhenFinished === true ? { awayWhenFinished: true } : {}),
  };
};

/** Newest first, one entry per sprint, at most 200. */
export const tidyHistory = (list: SprintResult[]): SprintResult[] => {
  const seen = new Set<string>();
  const out: SprintResult[] = [];
  for (const r of [...list].sort((a, b) => b.endedAt - a.endedAt)) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out.slice(0, HISTORY_LIMIT);
};

export const parseHistory = (raw: string | null): SprintResult[] => {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return tidyHistory(v.map(asResult).filter((r): r is SprintResult => r !== null));
  } catch {
    return [];
  }
};

// ---------- Saved on this device ----------

// The project id is part of each key, so deleting an account can wipe a project's sprints by id
const ACTIVE_PREFIX = 'novelist_sprint_active_';
const HISTORY_PREFIX = 'novelist_sprint_history_';
const SOUND_KEY = 'novelist_sprint_sound';
const MINUTES_KEY = 'novelist_sprint_minutes';

const activeKey = (projectId: string) => `${ACTIVE_PREFIX}${projectId}`;
const historyKey = (projectId: string) => `${HISTORY_PREFIX}${projectId}`;

const lsGet = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const lsSet = (key: string, value: string): boolean => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

const lsRemove = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
};

/** Every sprint saved as running, newest first. Normally there is one. */
const scanActive = (): ActiveSprint[] => {
  const found: ActiveSprint[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(ACTIVE_PREFIX)) continue;
      const s = parseActive(localStorage.getItem(k));
      if (s && s.projectId === k.slice(ACTIVE_PREFIX.length)) found.push(s);
    }
  } catch {
    // ignore
  }
  return found.sort((a, b) => b.startedAt - a.startedAt);
};

const readHistory = (projectId: string): SprintResult[] => parseHistory(lsGet(historyKey(projectId)));

/** The length last used, so a writer who always does 25 minutes does not have to pick it again */
export const rememberedMinutes = (): number => {
  const n = Number(lsGet(MINUTES_KEY));
  return Number.isInteger(n) && n >= 1 && n <= 180 ? n : 20;
};

// ---------- Sound and tab title ----------

let audio: AudioContext | null = null;

/** Called from a click, which is the only moment a browser lets a page start making sound later. */
const unlockAudio = () => {
  try {
    if (typeof window === 'undefined') return;
    if (!audio) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      audio = new Ctor();
    }
    if (audio.state === 'suspended') void audio.resume().catch(() => undefined);
  } catch {
    // Sound is a nicety; a failure here must never get in the way of writing
  }
};

/** Two soft notes, low and then high. */
const playChime = () => {
  try {
    unlockAudio();
    if (!audio) return;
    const ctx = audio;
    const t0 = ctx.currentTime + 0.02;
    [[660, 0], [880, 0.25]].forEach(([freq, offset]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = t0 + offset;
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.1, at + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.27);
    });
  } catch {
    // ignore
  }
};

const TITLE_PREFIX = /^\d{1,3}:\d{2} · /;

/**
 * "mm:ss · Title" while a sprint runs. The prefix is stripped from whatever the title is right now rather than
 * remembered, so a page that sets its own title in the middle of a sprint is not overwritten with an old one.
 */
const writeTitle = (secondsLeft: number | null) => {
  if (typeof document === 'undefined') return;
  const base = document.title.replace(TITLE_PREFIX, '');
  document.title = secondsLeft === null ? base : `${formatClock(secondsLeft * 1000)} · ${base}`;
};

// ---------- The shared store ----------

interface Note {
  seq: number;
  projectId: string;
  text: string;
}

interface StoreState {
  active: ActiveSprint | null;
  /** The sprint that just ended, until the writer dismisses it */
  result: SprintResult | null;
  /** The clock as of the last update, so components never read the time while rendering */
  now: number;
  sound: boolean;
  /** The latest thing worth saying out loud to a screen reader */
  note: Note | null;
}

let state: StoreState = { active: null, result: null, now: 0, sound: true, note: null };
let loaded = false;
let timer: ReturnType<typeof setInterval> | null = null;
let lastSecs: number | null = null;
let warnedId: string | null = null;
let noteSeq = 0;
// Whether the running sprint made it into storage. If it never did, a missing key says nothing about other tabs.
let activeSaved = false;
// The last restore, so undoing or redoing it is not mistaken for writing: `to` is the length the chapter has
// now, `other` the one it would jump to
let restoreSwap: { projectId: string; chapterId: string; to: number; other: number } | null = null;
const listeners = new Set<() => void>();
const historyCache = new Map<string, SprintResult[]>();
// Projects whose history could not be written, so the copy in memory is the only complete one
const historyUnsaved = new Set<string>();
const NO_HISTORY: SprintResult[] = [];

const minutesLabel = (ms: number) => {
  const m = Math.max(1, Math.round(ms / 60_000));
  return `${m} ${m === 1 ? 'minute' : 'minutes'}`;
};

const wordsLabel = (n: number) => `${n.toLocaleString()} ${n === 1 ? 'word' : 'words'}`;

const noteFor = (projectId: string, text: string): Note => ({ seq: ++noteSeq, projectId, text });

const syncTimer = () => {
  const running = !!state.active && state.active.pausedAt === null;
  if (running && timer === null) timer = setInterval(tick, TICK_MS);
  else if (!running && timer !== null) {
    clearInterval(timer);
    timer = null;
  }
};

const patch = (next: Partial<StoreState>) => {
  state = { ...state, ...next };
  syncTimer();
  for (const l of [...listeners]) l();
};

const saveActive = (s: ActiveSprint) => {
  activeSaved = lsSet(activeKey(s.projectId), JSON.stringify(s));
};

/**
 * Take sole charge of ending a sprint. If its saved copy is already gone, another tab ended it (or the account
 * was wiped), and writing it to the history again would double count it or bring back deleted data.
 */
const claim = (s: ActiveSprint, wasSaved: boolean): boolean => {
  const raw = lsGet(activeKey(s.projectId));
  if (raw === null) return !wasSaved;
  if (parseActive(raw)?.id !== s.id) return false;
  lsRemove(activeKey(s.projectId));
  return true;
};

/** End a sprint for good: remove it from storage and add it to the history. Null when there is nothing to show. */
const settle = (s: ActiveSprint, completed: boolean, now: number, wasSaved = true, away = false): SprintResult | null => {
  if (!claim(s, wasSaved)) return null;
  const done = finish(s, now, completed);
  if (!completed && done.activeMs < MIN_SAVED_MS) return null;
  const result = away ? { ...done, awayWhenFinished: true } : done;
  // With storage refusing writes (a full disk, some private windows) earlier sprints only live in memory
  const earlier = historyUnsaved.has(s.projectId) ? [...readHistory(s.projectId), ...(historyCache.get(s.projectId) ?? [])] : readHistory(s.projectId);
  const next = tidyHistory([result, ...earlier]);
  if (lsSet(historyKey(s.projectId), JSON.stringify(next))) historyUnsaved.delete(s.projectId);
  else historyUnsaved.add(s.projectId);
  historyCache.set(s.projectId, next);
  return result;
};

const savedResult = (s: ActiveSprint): SprintResult | null => readHistory(s.projectId).find((r) => r.id === s.id) ?? null;

const endActive = (completed: boolean, now: number) => {
  const s = state.active;
  if (!s) return;
  lastSecs = null;
  restoreSwap = null;
  const mine = settle(s, completed, now, activeSaved);
  const done = mine ?? savedResult(s);
  writeTitle(null);
  if (mine && completed && state.sound) playChime();
  const text = done ? `${completed ? 'Sprint complete' : 'Sprint ended'}. ${wordsLabel(done.words)}.` : 'Sprint ended.';
  patch({ active: null, result: done, now, note: noteFor(s.projectId, text) });
};

function tick() {
  const s = state.active;
  if (!s || s.pausedAt !== null) {
    syncTimer();
    return;
  }
  const now = Date.now();
  if (isFinished(s, now)) {
    endActive(true, now);
    return;
  }
  const secs = Math.ceil(remainingMs(s, now) / 1000);
  if (secs === lastSecs) return;
  lastSecs = secs;
  writeTitle(secs);
  const warn = s.durationMs > WARN_AT_MS && warnedId !== s.id && secs * 1000 <= WARN_AT_MS;
  if (warn) warnedId = s.id;
  patch(warn ? { now, note: noteFor(s.projectId, 'One minute left.') } : { now });
}

/** Another tab changed something: take on what is saved. */
const onStorage = (e: StorageEvent) => {
  const key = e.key;
  if (key !== null && !key.startsWith(ACTIVE_PREFIX) && !key.startsWith(HISTORY_PREFIX) && key !== SOUND_KEY) return;
  historyCache.clear();
  const now = Date.now();
  const mine = state.active;
  const saved = scanActive()[0] ?? null;
  const sound = lsGet(SOUND_KEY) !== '0';
  if (saved) {
    const same = mine && JSON.stringify(mine) === JSON.stringify(saved);
    if (!same) {
      const left = mine && mine.id !== saved.id ? savedResult(mine) : state.result;
      lastSecs = null;
      activeSaved = true;
      if (saved.pausedAt !== null) writeTitle(null);
      patch({ active: saved, result: left, now, sound });
      return;
    }
  } else if (mine) {
    lastSecs = null;
    writeTitle(null);
    patch({ active: null, result: savedResult(mine), now, sound });
    return;
  }
  patch({ now, sound });
};

const onVisible = () => {
  if (document.visibilityState === 'visible') tick();
};

/** First use: pick up a sprint that was running when the page was last open. */
const ensureLoaded = () => {
  if (loaded) return;
  loaded = true;
  const now = Date.now();
  state = { ...state, now, sound: lsGet(SOUND_KEY) !== '0' };
  const [current, ...strays] = scanActive();
  for (const stray of strays) settle(stray, isFinished(stray, now), now);
  if (current) {
    if (isFinished(current, now)) {
      // The time ran out while the page was closed: it ended on schedule with the words it last knew about
      state = { ...state, result: settle(current, true, now, true, true) ?? savedResult(current) };
    } else {
      activeSaved = true;
      if (remainingMs(current, now) <= WARN_AT_MS) warnedId = current.id;
      state = { ...state, active: current };
      if (current.pausedAt === null) {
        lastSecs = Math.ceil(remainingMs(current, now) / 1000);
        writeTitle(lastSecs);
      }
    }
  }
  syncTimer();
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
};

export const sprintStore = {
  subscribe: (listener: () => void) => {
    ensureLoaded();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  getState: (): StoreState => {
    ensureLoaded();
    return state;
  },

  /** A project's saved sprints, newest first. The same array until something changes. */
  history: (projectId: string | undefined): SprintResult[] => {
    if (!projectId) return NO_HISTORY;
    let list = historyCache.get(projectId);
    if (!list) {
      list = readHistory(projectId);
      historyCache.set(projectId, list);
    }
    return list;
  },

  /** Take a chapter's current length. Does nothing unless this project has a sprint running. */
  feed: (projectId: string, chapterId: string, words: number) => {
    ensureLoaded();
    const s = state.active;
    if (!s || s.projectId !== projectId) return;
    const now = Date.now();
    const swap = restoreSwap;
    // Undo or redo of a restore: the chapter jumps straight between the two lengths with no typing in between
    const swapped =
      !!swap && swap.projectId === projectId && swap.chapterId === chapterId && swap.to === s.latest[chapterId] && swap.other === Math.floor(words);
    if (swap && swapped) restoreSwap = { ...swap, to: swap.other, other: swap.to };
    const next = swapped ? rebase(s, chapterId, words) : noteWords(s, chapterId, words, now);
    if (next === s) return;
    saveActive(next);
    patch({ active: next, now });
  },

  /** The open chapter was replaced by another version of itself: do not count the difference as writing. */
  rebase: (projectId: string, chapterId: string, words: number) => {
    ensureLoaded();
    const s = state.active;
    if (!s || s.projectId !== projectId) return;
    const next = rebase(s, chapterId, words);
    if (next === s) return;
    restoreSwap = { projectId, chapterId, to: next.latest[chapterId], other: s.latest[chapterId] };
    saveActive(next);
    patch({ active: next, now: Date.now() });
  },

  start: (projectId: string, plan: SprintPlan, chapterId: string, chapterWords: number) => {
    ensureLoaded();
    const now = Date.now();
    // Only one sprint at a time in this browser: whatever else is running ends here
    const running = new Map<string, ActiveSprint>();
    for (const s of scanActive()) running.set(s.id, s);
    if (state.active) running.set(state.active.id, state.active);
    for (const s of running.values()) settle(s, isFinished(s, now), now, s.id === state.active?.id ? activeSaved : true);
    const sprint = startSprint(projectId, plan, chapterId, chapterWords, now);
    saveActive(sprint);
    lsSet(MINUTES_KEY, String(Math.max(1, Math.min(180, Math.round(sprint.durationMs / 60_000)))));
    if (state.sound) unlockAudio();
    warnedId = null;
    restoreSwap = null;
    lastSecs = Math.ceil(sprint.durationMs / 1000);
    writeTitle(lastSecs);
    patch({ active: sprint, result: null, now, note: noteFor(projectId, `Sprint started. ${minutesLabel(sprint.durationMs)}.`) });
  },

  pause: () => {
    const s = state.active;
    if (!s || s.pausedAt !== null) return;
    const now = Date.now();
    if (isFinished(s, now)) {
      endActive(true, now);
      return;
    }
    const next = pause(s, now);
    saveActive(next);
    writeTitle(null);
    patch({ active: next, now, note: noteFor(s.projectId, 'Sprint paused.') });
  },

  resume: () => {
    const s = state.active;
    if (!s || s.pausedAt === null) return;
    const now = Date.now();
    const next = resume(s, now);
    saveActive(next);
    lastSecs = Math.ceil(remainingMs(next, now) / 1000);
    writeTitle(lastSecs);
    patch({ active: next, now, note: noteFor(s.projectId, 'Sprint resumed.') });
  },

  /** End early. Saved as not completed, unless it barely began. */
  stop: () => {
    const s = state.active;
    if (!s) return;
    const now = Date.now();
    endActive(isFinished(s, now), now);
  },

  dismiss: () => patch({ result: null }),

  setSound: (on: boolean) => {
    ensureLoaded();
    lsSet(SOUND_KEY, on ? '1' : '0');
    if (on) unlockAudio();
    patch({ sound: on });
  },
};

// ---------- React ----------

/** For the editor's restore-a-version action. */
export const rebaseSprint = sprintStore.rebase;

const useStore = () => useSyncExternalStore(sprintStore.subscribe, sprintStore.getState, sprintStore.getState);

const liveView = (snap: StoreState, projectId: string | undefined) => {
  const active = snap.active && snap.active.projectId === projectId ? snap.active : null;
  return {
    active,
    remainingMs: active ? remainingMs(active, snap.now) : 0,
    elapsedMs: active ? elapsedMs(active, snap.now) : 0,
    words: active ? active.peak : 0,
    goalMet: !!active && active.goalWords !== null && active.peak >= active.goalWords,
  };
};

/** The running sprint for a project, read only. For small displays such as the footer hint. */
export const useSprintStatus = (projectId: string | undefined) => liveView(useStore(), projectId);

/** A project's saved sprints, newest first. Updates when a sprint finishes. */
export const useSprintHistory = (projectId: string | undefined): SprintResult[] => {
  const read = () => sprintStore.history(projectId);
  return useSyncExternalStore(sprintStore.subscribe, read, read);
};

/**
 * The editor's sprint: shared state plus the controls. Pass the open chapter's current word count; each change
 * is fed to the store, which works out how many words the sprint has earned.
 */
export const useSprint = (projectId: string, chapterId: string, chapterWords: number) => {
  const snap = useStore();

  useEffect(() => {
    sprintStore.feed(projectId, chapterId, chapterWords);
  }, [projectId, chapterId, chapterWords]);

  const start = useCallback(
    (plan: SprintPlan) => sprintStore.start(projectId, plan, chapterId, chapterWords),
    [projectId, chapterId, chapterWords],
  );

  return {
    ...liveView(snap, projectId),
    start,
    pause: sprintStore.pause,
    resume: sprintStore.resume,
    stop: sprintStore.stop,
    dismissResult: sprintStore.dismiss,
    result: snap.result && snap.result.projectId === projectId ? snap.result : null,
    sound: snap.sound,
    setSound: sprintStore.setSound,
    /** A sprint is running in a different novel, and starting one here would end it */
    busyElsewhere: !!snap.active && snap.active.projectId !== projectId,
    /** What a screen reader should hear next */
    note: snap.note && snap.note.projectId === projectId ? snap.note : null,
  };
};
