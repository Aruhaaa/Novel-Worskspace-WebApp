export type TourName = 'welcome' | 'workspace';

const key = (userId: string, name: TourName) => `novelist_tour_${name}_${userId}`;

export const isTourDone = (userId: string, name: TourName): boolean => {
  try {
    return localStorage.getItem(key(userId, name)) === 'done';
  } catch {
    // If storage is blocked we cannot remember, so do not nag
    return true;
  }
};

export const markTourDone = (userId: string, name: TourName): void => {
  try {
    localStorage.setItem(key(userId, name), 'done');
  } catch {
    // ignore
  }
};

const START_EVENT = 'novelist:tour';

/** Run a tour now, for example from the profile menu. */
export const startTour = (name: TourName) => window.dispatchEvent(new CustomEvent<TourName>(START_EVENT, { detail: name }));

export const onStartTour = (fn: (name: TourName) => void) => {
  const handler = (e: Event) => fn((e as CustomEvent<TourName>).detail);
  window.addEventListener(START_EVENT, handler);
  return () => window.removeEventListener(START_EVENT, handler);
};
