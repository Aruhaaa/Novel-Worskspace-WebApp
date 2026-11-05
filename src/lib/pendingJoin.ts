/** Where an invitation link is kept while its owner signs in or makes an account, so they land back on it afterwards. */
export const PENDING_JOIN_KEY = 'novelist_pending_join';

/** Take the kept invitation, if there is one. It is only ever used once. */
export const takePendingJoin = (): string => {
  try {
    const token = sessionStorage.getItem(PENDING_JOIN_KEY) || '';
    sessionStorage.removeItem(PENDING_JOIN_KEY);
    return token;
  } catch {
    return '';
  }
};
