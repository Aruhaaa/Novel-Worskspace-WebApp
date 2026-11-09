import { useSyncExternalStore } from 'react';
import type { Project } from '../services/types';

/**
 * Publishing a novel whose language was never chosen asks which language it is in first. The button that publishes can be on several
 * screens, so the question is one dialog for the whole app (PublishLanguageDialog), asked for through here.
 */

interface Pending {
  project: Project;
  resolve: (code: string | null) => void;
}

let pending: Pending | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Ask which language this novel is in. Resolves with a code, or null if the person backs out. */
export const askLanguage = (project: Project): Promise<string | null> =>
  new Promise((resolve) => {
    // A second question while one is open cancels the first
    pending?.resolve(null);
    pending = { project, resolve };
    emit();
  });

export const answerLanguage = (code: string | null): void => {
  const current = pending;
  pending = null;
  emit();
  current?.resolve(code);
};

export const usePendingLanguageQuestion = (): Project | null =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => pending?.project ?? null,
    () => null,
  );
