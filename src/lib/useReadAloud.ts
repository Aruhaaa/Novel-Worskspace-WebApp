import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getLang } from '../i18n';

/**
 * Reading text aloud with the voices already on the person's device (the browser's speech synthesis). Nothing is
 * sent anywhere. The text is read paragraph by paragraph, in short pieces, because browsers cut off a long
 * utterance after a while; the paragraph being read is reported so the screen can mark it.
 */
export type SpeakState = 'idle' | 'playing' | 'paused';

const PREFS_KEY = 'novelist_read_aloud';

interface Prefs {
  rate: number;
  voiceUri: string;
}

const loadPrefs = (): Prefs => {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
    if (raw && typeof raw.rate === 'number' && typeof raw.voiceUri === 'string') return { rate: Math.min(2, Math.max(0.5, raw.rate)), voiceUri: raw.voiceUri };
  } catch {
    // fall through to the default
  }
  return { rate: 1, voiceUri: '' };
};

const savePrefs = (prefs: Prefs) => {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // storage unavailable
  }
};

export const speechSupported = (): boolean => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

/** Cut a paragraph into pieces of about `max` characters, at sentence ends where it can. */
export const splitForSpeech = (text: string, max = 180): string[] => {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const sentences = clean.split(/(?<=[.!?…。！？])\s+/);
  const pieces: string[] = [];
  let current = '';
  const flush = () => {
    if (current) pieces.push(current);
    current = '';
  };
  for (const sentence of sentences) {
    if (sentence.length > max) {
      flush();
      // A very long sentence is cut at commas and spaces
      let rest = sentence;
      while (rest.length > max) {
        let cut = Math.max(rest.lastIndexOf(', ', max), rest.lastIndexOf('; ', max), rest.lastIndexOf(': ', max));
        if (cut < max * 0.4) cut = rest.lastIndexOf(' ', max);
        if (cut < 1) cut = max;
        pieces.push(rest.slice(0, cut + 1).trim());
        rest = rest.slice(cut + 1).trim();
      }
      current = rest;
      continue;
    }
    if (current && current.length + 1 + sentence.length > max) flush();
    current = current ? `${current} ${sentence}` : sentence;
  }
  flush();
  return pieces;
};

export interface ReadAloud {
  supported: boolean;
  state: SpeakState;
  /** The paragraph being read (0-based), or -1 */
  index: number;
  total: number;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  rate: number;
  setRate: (rate: number) => void;
  voices: SpeechSynthesisVoice[];
  voiceUri: string;
  setVoiceUri: (uri: string) => void;
}

interface Source {
  /** The paragraphs to read, in order. Called when reading starts. */
  paragraphs: () => string[];
  /** Where to start reading (a paragraph number); defaults to the first */
  startAt?: () => number;
  /** Called with the paragraph now being read, and with null when reading ends */
  onHighlight: (index: number | null) => void;
  /** The language of the text, for choosing a voice (for example "en"); defaults to the app's language */
  lang?: string;
}

export const useReadAloud = (source: Source): ReadAloud => {
  const supported = speechSupported();
  const [state, setState] = useState<SpeakState>('idle');
  const [index, setIndex] = useState(-1);
  const [total, setTotal] = useState(0);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  const sourceRef = useRef(source);
  useEffect(() => {
    sourceRef.current = source;
  });
  const parasRef = useRef<string[]>([]);
  const at = useRef({ para: 0, chunk: 0 });
  // Bumped whenever reading is stopped or restarted, so a late "finished" from an old piece is ignored
  const generation = useRef(0);
  const prefsRef = useRef(prefs);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    voicesRef.current = voices;
  }, [voices]);

  useEffect(() => {
    if (!supported) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener?.('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', load);
  }, [supported]);

  const pickVoice = useCallback((): SpeechSynthesisVoice | null => {
    const list = voicesRef.current;
    if (list.length === 0) return null;
    const chosen = list.find((v) => v.voiceURI === prefsRef.current.voiceUri);
    if (chosen) return chosen;
    const lang = (sourceRef.current.lang ?? getLang()).toLowerCase();
    return list.find((v) => v.lang.toLowerCase().startsWith(lang) && v.default) ?? list.find((v) => v.lang.toLowerCase().startsWith(lang)) ?? null;
  }, []);

  const finish = useCallback(() => {
    generation.current++;
    setState('idle');
    setIndex(-1);
    sourceRef.current.onHighlight(null);
  }, []);

  const speakFrom = useCallback(() => {
    const gen = ++generation.current;
    const run = () => {
      if (gen !== generation.current) return;
      const paras = parasRef.current;
      if (at.current.para >= paras.length) return finish();
      const chunks = splitForSpeech(paras[at.current.para]);
      if (at.current.chunk >= chunks.length) {
        at.current = { para: at.current.para + 1, chunk: 0 };
        return run();
      }
      if (at.current.chunk === 0) {
        setIndex(at.current.para);
        sourceRef.current.onHighlight(at.current.para);
      }
      const utterance = new SpeechSynthesisUtterance(chunks[at.current.chunk]);
      utterance.rate = prefsRef.current.rate;
      const voice = pickVoice();
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = sourceRef.current.lang ?? getLang();
      }
      utterance.onend = () => {
        if (gen !== generation.current) return;
        at.current = { ...at.current, chunk: at.current.chunk + 1 };
        run();
      };
      utterance.onerror = (event) => {
        if (gen !== generation.current) return;
        // Cancelling is how reading is stopped, not a failure
        if (event.error === 'canceled' || event.error === 'interrupted') return;
        finish();
      };
      window.speechSynthesis.speak(utterance);
    };
    run();
  }, [finish, pickVoice]);

  const start = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    const paras = sourceRef.current.paragraphs();
    if (paras.length === 0) return;
    parasRef.current = paras;
    setTotal(paras.length);
    at.current = { para: Math.min(Math.max(0, sourceRef.current.startAt?.() ?? 0), paras.length - 1), chunk: 0 };
    setState('playing');
    speakFrom();
  }, [supported, speakFrom]);

  const pause = useCallback(() => {
    if (!supported || state !== 'playing') return;
    // Stopping the current piece and starting it again later works in every browser; "pause" does not
    generation.current++;
    window.speechSynthesis.cancel();
    setState('paused');
  }, [supported, state]);

  const resume = useCallback(() => {
    if (!supported || state !== 'paused') return;
    setState('playing');
    speakFrom();
  }, [supported, state, speakFrom]);

  const stop = useCallback(() => {
    if (!supported) return;
    generation.current++;
    window.speechSynthesis.cancel();
    finish();
  }, [supported, finish]);

  // Leaving the screen stops the voice
  useEffect(
    () => () => {
      if (!speechSupported()) return;
      generation.current++;
      window.speechSynthesis.cancel();
      sourceRef.current.onHighlight(null);
    },
    []
  );

  const setRate = useCallback(
    (rate: number) => {
      const next = { ...prefsRef.current, rate };
      setPrefs(next);
      savePrefs(next);
      // The piece being read keeps its speed; the next one uses the new one
    },
    []
  );
  const setVoiceUri = useCallback((voiceUri: string) => {
    const next = { ...prefsRef.current, voiceUri };
    setPrefs(next);
    savePrefs(next);
  }, []);

  return useMemo(
    () => ({ supported, state, index, total, start, pause, resume, stop, rate: prefs.rate, setRate, voices, voiceUri: prefs.voiceUri, setVoiceUri }),
    [supported, state, index, total, start, pause, resume, stop, prefs.rate, setRate, voices, prefs.voiceUri, setVoiceUri]
  );
};
