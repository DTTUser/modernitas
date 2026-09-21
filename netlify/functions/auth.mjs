/* ---------------------------------------------------------------------------
   /api/auth — sign in, sign out, and "am I still signed in?"

     POST   { password }   sign in, sets the cookie
     DELETE                sign out, clears the cookie
     GET                   returns { signedIn: true|false }

   Environment variables, set in Netlify, never in the repo:
     EDITOR_PASSWORD   the password Terry chooses at handover
     SESSION_SECRET    a long random string, ours, he never sees it

   Both are read at request time rather than at module load, so rotating
   either one takes effect on the next request without a redeploy.
--------------------------------------------------------------------------- */

import {
  issue, sameSecret, cookieHeader, clearedCookie, requireSession,
} from '../lib/session.mjs';

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });

/* A failed attempt always costs about this long. It is not a substitute for
   attempt limiting, but it turns a fast guessing loop into a slow one, and it
   costs nothing to anybody typing their own password.
   TODO: back this with a Netlify Blobs counter so five failures in a row lock
   the address out for fifteen minutes. Left out of this first pass on purpose,
   because it cannot be tested locally and untested code is worse than none. */
const PENALTY_MS = 400;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req) {
  const pass = process.env.EDITOR_PASSWORD;
  const secret = process.env.SESSION_SECRET;

  /* Misconfiguration is a server fault, not a sign-in failure, and saying so
     plainly here saves an hour of confusion later. */
  if (!pass || !secret) {
    return json({ error: 'The editor is not configured yet.' }, 503);
  }

  if (req.method === 'GET') {
    return json({ signedIn: Boolean(requireSession(req)) });
  }

  if (req.method === 'DELETE') {
    return json({ signedIn: false }, 200, { 'set-cookie': clearedCookie });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405, { allow: 'GET, POST, DELETE' });
  }

  let body;
  try { body = await req.json(); } catch { body = null; }
  const supplied = body && typeof body.password === 'string' ? body.password : '';

  if (!supplied || !sameSecret(supplied, pass)) {
    await wait(PENALTY_MS);
    return json({ error: 'That password was not recognised.' }, 401);
  }

  return json(
    { signedIn: true },
    200,
    { 'set-cookie': cookieHeader(issue('terry', secret)) },
  );
}

export const config = { path: '/api/auth' };
