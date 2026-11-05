/**
 * The link in a password-reset email brings the person back to the site with a code in the address
 * (`#access_token=…&type=recovery`). Coming back from Google or Apple is the same: a code in the address, or, if the
 * person refused or something failed, an error in its place. The app routes by that same part of the address, so it is
 * read once, here, before anything else can rewrite it. This file must be imported ahead of the Supabase client.
 */
export type RecoveryLink = 'recovery' | 'expired' | null;

const readParams = (): URLSearchParams => {
  if (typeof location === 'undefined') return new URLSearchParams();
  const hash = location.hash.replace(/^#\/?/, '');
  return new URLSearchParams(hash.includes('=') ? hash : '');
};

const readLink = (params: URLSearchParams): RecoveryLink => {
  if (params.get('type') === 'recovery' && params.get('access_token')) return 'recovery';
  // An old or already-used link comes back with an error instead of a code
  if (params.get('error_code') === 'otp_expired' || (params.get('error') && /recovery|otp|expired/i.test(params.get('error_description') || ''))) return 'expired';
  return null;
};

const params = readParams();

export const recoveryLink: RecoveryLink = readLink(params);

/** Why a sign-in with Google or Apple did not finish (they refused, or it failed), to tell the person once. */
export const signInProblem: string | null = (() => {
  if (recoveryLink || !params.get('error')) return null;
  const why = (params.get('error_description') || '').replace(/\s+/g, ' ').trim().slice(0, 160);
  return why ? `That sign-in did not finish: ${why}` : 'That sign-in did not finish.';
})();
