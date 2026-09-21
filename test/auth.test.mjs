import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import * as S from '../netlify/lib/session.mjs';

process.env.EDITOR_PASSWORD = 'correct horse battery staple';
process.env.SESSION_SECRET  = 'a-long-random-string-for-testing-only-0123456789';
const { default: auth } = await import('../netlify/functions/auth.mjs');

const SEC = process.env.SESSION_SECRET;
let n = 0, fail = 0;
const t = async (name, fn) => { n++; try { await fn(); console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '  ->  ' + e.message); } };

const req = (method, opts = {}) => new Request('https://modernitas.co.uk/api/auth', {
  method,
  headers: opts.cookie ? { cookie: opts.cookie, 'content-type': 'application/json' }
                       : { 'content-type': 'application/json' },
  body: opts.body ? JSON.stringify(opts.body) : undefined,
});

console.log('\nsession.mjs');
await t('round trip verifies', () => {
  const tok = S.issue('terry', SEC);
  assert.equal(S.verify(tok, SEC).u, 'terry');
});
await t('tampered payload rejected', () => {
  const [p, s] = S.issue('terry', SEC).split('.');
  const evil = Buffer.from(JSON.stringify({ u: 'terry', exp: 9e9 })).toString('base64url');
  assert.equal(S.verify(evil + '.' + s, SEC), null);
});
await t('tampered signature rejected', () => {
  const [p, s] = S.issue('terry', SEC).split('.');
  assert.equal(S.verify(p + '.' + s.slice(0, -1) + (s.slice(-1) === 'A' ? 'B' : 'A'), SEC), null);
});
await t('wrong secret rejected', () => {
  assert.equal(S.verify(S.issue('terry', SEC), 'a-different-secret-entirely-00000'), null);
});
await t('expired rejected', () => {
  const p = Buffer.from(JSON.stringify({ u: 'terry', exp: 1 })).toString('base64url');
  const sig = createHmac('sha256', SEC).update(p).digest('base64url');
  assert.equal(S.verify(p + '.' + sig, SEC), null);
});
await t('garbage rejected', () => {
  for (const bad of ['', 'x', 'a.b', null, undefined, 'a.b.c'])
    assert.equal(S.verify(bad, SEC), null);
});

console.log('\n/api/auth');
let cookie = null;

await t('GET without a cookie says signed out', async () => {
  const r = await auth(req('GET'));
  assert.equal((await r.json()).signedIn, false);
});
await t('wrong password gets 401 and no cookie', async () => {
  const r = await auth(req('POST', { body: { password: 'hunter2' } }));
  assert.equal(r.status, 401);
  assert.equal(r.headers.get('set-cookie'), null);
});
await t('empty password gets 401', async () => {
  assert.equal((await auth(req('POST', { body: { password: '' } }))).status, 401);
});
await t('no body gets 401, does not throw', async () => {
  assert.equal((await auth(req('POST'))).status, 401);
});
await t('right password signs in and sets the cookie', async () => {
  const r = await auth(req('POST', { body: { password: process.env.EDITOR_PASSWORD } }));
  assert.equal(r.status, 200);
  const sc = r.headers.get('set-cookie');
  assert.match(sc, /^mod_sess=/);
  for (const flag of ['HttpOnly', 'SameSite=Strict', 'Secure', 'Path=/'])
    assert.ok(sc.includes(flag), 'cookie missing ' + flag);
  cookie = sc.split(';')[0];
});
await t('GET with that cookie says signed in', async () => {
  assert.equal((await auth(req('GET', { cookie }))).status, 200);
  assert.equal((await (await auth(req('GET', { cookie }))).json()).signedIn, true);
});
await t('a cookie from a different secret is refused', async () => {
  const forged = 'mod_sess=' + S.issue('terry', 'some-other-secret-aaaaaaaaaaaaaaaa');
  assert.equal((await (await auth(req('GET', { cookie: forged }))).json()).signedIn, false);
});
await t('DELETE clears the cookie', async () => {
  const r = await auth(req('DELETE', { cookie }));
  assert.match(r.headers.get('set-cookie'), /Max-Age=0/);
});
await t('PUT is refused with 405', async () => {
  assert.equal((await auth(req('PUT'))).status, 405);
});
await t('unconfigured returns 503, not a sign-in failure', async () => {
  const keep = process.env.EDITOR_PASSWORD;
  delete process.env.EDITOR_PASSWORD;
  assert.equal((await auth(req('POST', { body: { password: 'x' } }))).status, 503);
  process.env.EDITOR_PASSWORD = keep;
});

console.log('\n' + (fail ? fail + ' of ' + n + ' FAILED' : 'all ' + n + ' passed'));
process.exit(fail ? 1 : 0);
