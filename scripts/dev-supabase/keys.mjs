// The sign-in tokens of the Supabase stand-in. The secret is fixed, so the "anon" key is always the same and can be
// written into a config file. This is for the stand-in only; a real Supabase project has its own secret.
import crypto from 'node:crypto';

const SECRET = 'supabase-lite-secret';

const b64 = (input) => Buffer.from(input).toString('base64url');

export const sign = (payload) => {
  const head = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
};

export const verify = (token) => {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const sig = crypto.createHmac('sha256', SECRET).update(`${parts[0]}.${parts[1]}`).digest('base64url');
  if (sig !== parts[2]) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
};

/** Always the same: issued long ago, valid for decades. */
export const ANON_KEY = sign({ role: 'anon', iss: 'supabase-lite', iat: 1700000000, exp: 4102444800 });
