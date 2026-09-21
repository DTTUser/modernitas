/* ---------------------------------------------------------------------------
   Session handling for the modernitas studio.

   One user, one password, no identity service. A login hands back a cookie
   carrying a tiny payload and a signature over it. Nothing secret is inside
   the cookie: the signature is what makes it unforgeable, because producing
   one needs SESSION_SECRET, which never leaves the server.

   Why not Netlify Identity: its sibling, Git Gateway, has just been
   deprecated, and the whole point of this build is that Terry depends on
   nobody. There is nothing here that a third party can discontinue.
--------------------------------------------------------------------------- */

import { createHmac, timingSafeEqual, createHash } from 'node:crypto';

export const COOKIE = 'mod_sess';
const LIFETIME_SECONDS = 12 * 60 * 60;   /* a working day, then sign in again */

const b64url = (buf) => Buffer.from(buf).toString('base64url');

function sign(payloadB64, secret) {
  return createHmac('sha256', secret).update(payloadB64).digest('base64url');
}

/* Compare two strings without leaking, through timing, how much of the string
   matched. Hashing first means both sides are always the same length, which
   timingSafeEqual requires. */
export function sameSecret(a, b) {
  const ha = createHash('sha256').update(String(a)).digest();
  const hb = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(ha, hb);
}

export function issue(user, secret) {
  const payload = { u: user, exp: Math.floor(Date.now() / 1000) + LIFETIME_SECONDS };
  const p = b64url(JSON.stringify(payload));
  return `${p}.${sign(p, secret)}`;
}

/* Returns the payload, or null. Null covers every failure the same way:
   missing, malformed, wrong signature, expired. The caller never needs to
   know which, and saying which is free information for an attacker. */
export function verify(token, secret) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [p, sig] = token.split('.');
  if (!p || !sig) return null;
  const expected = sign(p, secret);
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')); }
  catch { return null; }
  if (!payload || typeof payload.exp !== 'number') return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function cookieHeader(token) {
  const bits = [
    `${COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Secure',
    `Max-Age=${LIFETIME_SECONDS}`,
  ];
  return bits.join('; ');
}

export const clearedCookie =
  `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=0`;

export function readCookie(req, name) {
  const raw = req.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

/* The guard every editing function calls first. */
export function requireSession(req) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  return verify(readCookie(req, COOKIE), secret);
}
