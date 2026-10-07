import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { countWords } from '../../lib/text';
import { clearDraft, getDraft, saveDraft } from '../../lib/drafts';
import { enqueueSave } from '../../lib/saveQueue';

export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error';

const DEBOUNCE_MS = 1000;
const RETRY_MS = 10000;

/**
 * Saves the open chapter without losing words:
 * - every keystroke is also copied to this device until the server confirms the save
 * - saves for one chapter run in order, so an old slow save can't overwrite a newer one
 * - pending changes are flushed when the chapter closes, the tab is hidden or the page unloads
 * - a failed save is reported honestly and retried
 */
export const useChapterAutosave = (onSaved?: (chapterId: string, title: string, content: string) => void) => {
  const { activeChapter, updateChapter, recordWriting } = useApp();
  const chapterId = activeChapter?.id;

  // Start from the server copy, unless an unsaved draft from this device is newer work
  const [initial] = useState(() => {
    const draft = chapterId ? getDraft(chapterId) : null;
    const differs = !!draft && (draft.content !== (activeChapter?.content || '') || draft.title !== (activeChapter?.title || ''));
    return differs
      ? { title: draft!.title, content: draft!.content, recovered: true }
      : { title: activeChapter?.title || '', content: activeChapter?.content || '', recovered: false };
  });

  const [title, setTitleState] = useState(initial.title);
  const [content, setContentState] = useState(initial.content);
  const [status, setStatus] = useState<SaveStatus>(initial.recovered ? 'pending' : 'saved');
  const [notice, setNotice] = useState<string | null>(initial.recovered ? 'Recovered unsaved changes from this device.' : null);

  const latest = useRef({ title: initial.title, content: initial.content });
  const dirty = useRef(initial.recovered);
  const revision = useRef(0);
  const mounted = useRef(true);
  const timer = useRef<number | null>(null);
  const retryTimer = useRef<number | null>(null);

  const persistRef = useRef<() => Promise<void>>(async () => undefined);

  const schedule = useCallback((delay = DEBOUNCE_MS) => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void persistRef.current();
    }, delay);
  }, []);

  const persist = async () => {
    if (!chapterId || !dirty.current) return;
    if (timer.current) window.clearTimeout(timer.current);
    if (retryTimer.current) window.clearTimeout(retryTimer.current);

    const snapshot = { title: latest.current.title, content: latest.current.content, revision: revision.current };
    dirty.current = false;
    if (mounted.current) setStatus('saving');

    try {
      await enqueueSave(chapterId, async () => {
        await updateChapter(chapterId, { title: snapshot.title, content: snapshot.content });
        await recordWriting(chapterId, countWords(snapshot.content));
      });
      // Only clear the safety copy if nothing newer was typed while this save ran
      if (snapshot.revision === revision.current) clearDraft(chapterId);
      onSaved?.(chapterId, snapshot.title, snapshot.content);
      if (mounted.current && snapshot.revision === revision.current) setStatus('saved');
    } catch (err) {
      console.error('Autosave failed:', err);
      dirty.current = true;
      if (mounted.current) {
        setStatus('error');
        retryTimer.current = window.setTimeout(() => void persistRef.current(), RETRY_MS);
      }
    }
  };

  // The timers and listeners below always call the latest version
  useEffect(() => {
    persistRef.current = persist;
  });

  const markChanged = useCallback(
    (nextTitle: string, nextContent: string) => {
      if (!chapterId) return;
      latest.current = { title: nextTitle, content: nextContent };
      revision.current += 1;
      dirty.current = true;
      saveDraft(chapterId, nextTitle, nextContent);
      setStatus('pending');
      setNotice(null);
      schedule();
    },
    [chapterId, schedule]
  );

  const setTitle = useCallback(
    (value: string) => {
      setTitleState(value);
      markChanged(value, latest.current.content);
    },
    [markChanged]
  );

  const setContent = useCallback(
    (value: string) => {
      setContentState(value);
      markChanged(latest.current.title, value);
    },
    [markChanged]
  );

  /** Replace the whole chapter text, for example when restoring an older version. */
  const replaceAll = useCallback(
    (nextTitle: string, nextContent: string) => {
      setTitleState(nextTitle);
      setContentState(nextContent);
      markChanged(nextTitle, nextContent);
    },
    [markChanged]
  );

  const retry = useCallback(() => {
    void persistRef.current();
  }, []);

  // A recovered draft still has to be saved
  useEffect(() => {
    if (initial.recovered) schedule(300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Never leave unsaved words behind: flush when the chapter closes, the tab hides or the page unloads
  useEffect(() => {
    mounted.current = true;
    const flush = () => void persistRef.current();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    // Back online: try the waiting save at once instead of waiting for the next retry
    window.addEventListener('online', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('online', flush);
      mounted.current = false;
      flush();
      if (timer.current) window.clearTimeout(timer.current);
      if (retryTimer.current) window.clearTimeout(retryTimer.current);
    };
  }, []);

  return { title, content, status, notice, dismissNotice: () => setNotice(null), setTitle, setContent, replaceAll, retry };
};
