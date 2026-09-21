import assert from 'node:assert/strict';
import { issue, COOKIE } from '../netlify/lib/session.mjs';

process.env.SESSION_SECRET = 'a-long-random-string-for-testing-only-0123456789';
process.env.GITHUB_TOKEN = 'ghp_not_a_real_token';
process.env.GITHUB_REPO = 'terry/modernitas';
process.env.GITHUB_BRANCH = 'main';
const { default: versions } = await import('../netlify/functions/versions.mjs');

let n = 0, fail = 0;
const t = async (name, fn) => { n++; try { await fn(); console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '  ->  ' + e.message); } };

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const OLD = '---\ntitle: About\nslug: about\n---\n\nThe old words.\n';
const NOW = '---\ntitle: About\nslug: about\n---\n\nThe new words.\n';

let puts = [], gets = [];
function stub({ now = NOW, old = OLD } = {}) {
  puts = []; gets = [];
  return async (url, init = {}) => {
    const u = new URL(url); const p = u.pathname; gets.push(p + u.search);
    if (init.method === 'PUT') {
      puts.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ content: { sha: 'sha-new' } }), { status: 200 });
    }
    if (p.endsWith('/commits')) {
      return new Response(JSON.stringify([
        { sha: 'aaa1111', commit: { committer: { date: '2026-09-20T10:00:00Z' }, message: 'Edited the About page\n\nbody' } },
        { sha: 'bbb2222', commit: { committer: { date: '2026-09-18T09:00:00Z' }, message: 'Edited the About page' } },
      ]), { status: 200 });
    }
    if (p.includes('/contents/content/02-about.md')) {
      const ref = u.searchParams.get('ref');
      const isOld = ref && ref !== 'main';
      return new Response(JSON.stringify({ path: 'content/02-about.md',
        sha: isOld ? 'sha-old' : 'sha-now', type: 'file', content: b64(isOld ? old : now) }), { status: 200 });
    }
    return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
  };
}
const signedIn = () => `${COOKIE}=${issue('terry', process.env.SESSION_SECRET)}`;
const get = (qs, opts = {}) => new Request('https://modernitas.co.uk/api/versions' + qs, {
  headers: opts.cookie === null ? {} : { cookie: opts.cookie || signedIn() },
});
const post = (body, opts = {}) => new Request('https://modernitas.co.uk/api/versions', {
  method: 'POST',
  headers: opts.cookie === null ? { 'content-type': 'application/json' }
                                : { cookie: signedIn(), 'content-type': 'application/json' },
  body: JSON.stringify(body),
});
const run = async (fn, o) => {
  const real = globalThis.fetch; globalThis.fetch = stub(o);
  try { return await fn(); } finally { globalThis.fetch = real; }
};

console.log('\n/api/versions');
await t('a list without a session is refused', async () => {
  assert.equal((await run(() => versions(get('?path=content/02-about.md', { cookie: null })))).status, 401);
});
await t('the list comes back newest first with dates and plain messages', async () => {
  const d = await (await run(() => versions(get('?path=content/02-about.md')))).json();
  assert.equal(d.versions.length, 2);
  assert.equal(d.versions[0].sha, 'aaa1111');
  assert.equal(d.versions[0].message, 'Edited the About page');
  assert.equal(d.versions[0].date, '2026-09-20T10:00:00Z');
});
await t('the live version is named so it is not offered back', async () => {
  const d = await (await run(() => versions(get('?path=content/02-about.md')))).json();
  assert.equal(d.current, 'aaa1111');
});
await t('the history is asked for on the right branch and page', async () => {
  await run(() => versions(get('?path=content/02-about.md')));
  assert.ok(gets.some((g) => g.includes('path=content%2F02-about.md') && g.includes('sha=main')));
});
await t('a draft has no history to look at', async () => {
  assert.equal((await run(() => versions(get('?path=content/drafts/01-home.md')))).status, 400);
});
await t('netlify.toml has no history to look at', async () => {
  assert.equal((await run(() => versions(get('?path=netlify.toml')))).status, 400);
});

console.log('\nputting a version back');
await t('restoring writes the old text against the current sha', async () => {
  const r = await run(() => versions(post({ path: 'content/02-about.md', sha: 'bbb2222' })));
  assert.equal(r.status, 200);
  assert.equal(puts.length, 1);
  assert.equal(puts[0].sha, 'sha-now');
  assert.equal(Buffer.from(puts[0].content, 'base64').toString('utf8'), OLD);
});
await t('restoring is itself a save, so nothing is destroyed', async () => {
  await run(() => versions(post({ path: 'content/02-about.md', sha: 'bbb2222' })));
  assert.equal(puts[0].message, 'Put the About page back to an earlier version');
  assert.equal(puts[0].branch, 'main');
});
await t('restoring the version already live changes nothing', async () => {
  const r = await run(() => versions(post({ path: 'content/02-about.md', sha: 'bbb2222' })), { old: NOW });
  assert.equal((await r.json()).unchanged, true);
  assert.equal(puts.length, 0);
});
await t('a restore without a session writes nothing', async () => {
  const r = await run(() => versions(new Request('https://modernitas.co.uk/api/versions', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: 'content/02-about.md', sha: 'bbb2222' }) })));
  assert.equal(r.status, 401);
  assert.equal(puts.length, 0);
});
await t('a made-up version reference is refused before anything is fetched', async () => {
  for (const sha of ['', 'zzz', '../../x', 'main', null]) {
    const r = await run(() => versions(post({ path: 'content/02-about.md', sha })));
    assert.equal(r.status, 400, String(sha));
  }
  assert.equal(puts.length, 0);
});
await t('a restore to a locked path writes nothing', async () => {
  const r = await run(() => versions(post({ path: 'netlify.toml', sha: 'bbb2222' })));
  assert.equal(r.status, 400);
  assert.equal(puts.length, 0);
});
await t('DELETE is refused', async () => {
  const r = await run(() => versions(new Request('https://modernitas.co.uk/api/versions', {
    method: 'DELETE', headers: { cookie: signedIn() } })));
  assert.equal(r.status, 405);
});
await t('nothing is cached', async () => {
  assert.equal((await run(() => versions(get('?path=content/02-about.md')))).headers.get('cache-control'), 'no-store');
});

console.log('\n' + (fail ? fail + ' of ' + n + ' FAILED' : 'all ' + n + ' passed'));
process.exit(fail ? 1 : 0);
