/**
 * Runs saves for the same chapter strictly one after another, so a slow older request can
 * never finish after (and overwrite) a newer one.
 */
const tails = new Map<string, Promise<unknown>>();

export const enqueueSave = <T>(chapterId: string, task: () => Promise<T>): Promise<T> => {
  const previous = tails.get(chapterId) ?? Promise.resolve();
  const next = previous.then(task, task);
  tails.set(chapterId, next.catch(() => undefined));
  return next;
};
