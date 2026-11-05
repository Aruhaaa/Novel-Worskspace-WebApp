import { useEffect, useRef, useState } from 'react';
import { openLiveSession, type LiveSession, type LiveUser } from './liveEditing';

export interface LiveWanted {
  projectId: string;
  chapterId: string;
  user: LiveUser;
  canWrite: boolean;
}

export type LiveState = { status: 'off' } | { status: 'connecting' } | { status: 'ready'; session: LiveSession };

/**
 * Join the live session for a chapter while `wanted` is set, and leave it when it is not, or when the chapter changes or the
 * screen closes. 'connecting' lasts a moment: the time it takes to ask the others for the document.
 */
export const useLiveSession = (wanted: LiveWanted | null): LiveState => {
  const [opened, setOpened] = useState<{ key: string; session: LiveSession } | null>(null);
  const key = wanted ? `${wanted.projectId}:${wanted.chapterId}:${wanted.canWrite ? 'w' : 'r'}` : '';
  const latest = useRef(wanted);
  useEffect(() => {
    latest.current = wanted;
  });

  useEffect(() => {
    const options = latest.current;
    if (!key || !options) return;
    let cancelled = false;
    const handle = openLiveSession(options);
    void handle.ready.then((s) => {
      if (cancelled) {
        s.close();
        return;
      }
      setOpened({ key, session: s });
    });
    return () => {
      cancelled = true;
      // Leave now, even if the session had not finished starting: the next one (a screen is made twice in development) needs the line
      handle.cancel();
    };
  }, [key]);

  if (!key) return { status: 'off' };
  return opened && opened.key === key ? { status: 'ready', session: opened.session } : { status: 'connecting' };
};
