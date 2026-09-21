import assert from 'node:assert/strict';
import { issue, COOKIE } from '../netlify/lib/session.mjs';
import * as FM from '../netlify/lib/frontmatter.mjs';

process.env.SESSION_SECRET = 'a-long-random-string-for-testing-only-0123456789';
process.env.GITHUB_TOKEN = 'ghp_not_a_real_token';
process.env.GITHUB_REPO = 'terry/modernitas';
process.env.GITHUB_BRANCH = 'main';
const { default: save } = await import('../netlify/functions/save.mjs');

let n = 0, fail = 0;
const t = async (name, fn) => { n++; try { await fn(); console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '  ->  ' + e.message); } };

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const FILE = ['---', 'title: About', 'slug: about', 'nav: About', 'order: 2',
  'layout: document', 'intent: make the site credible', 'lede: Five decades.',
  '---', '', '## Heading', '', 'Body.', ''].join('\n');

let puts = [];
function stub({ text = FILE, sha = 'sha-1', putStatus = 200 } = {}) {
  puts = [];
  return async (url, init = {}) => {
    const p = new URL(url).pathname;
    if (init.method === 'PUT') {
      puts.push(JSON.parse(init.body));
      if (putStatus !== 200)
        return new Response(JSON.stringify({ message: 'conflict' }), { status: putStatus });
      return new Response(JSON.stringify({ content: { sha: 'sha-2' }, commit: { sha: 'c1' } }), { status: 200 });
    }
    if (p.includes('/contents/content/02-about.md'))
      return new Response(JSON.stringify({ path: 'content/02-about.md', sha, type: 'file', content: b64(text) }), { status: 200 });
    return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
  };
}

const signedIn = () => `${COOKIE}=${issue('terry', process.env.SESSION_SECRET)}`;
const post = (body, opts = {}) => new Request('https://modernitas.co.uk/api/save', {
  method: opts.method || 'POST',
  headers: opts.cookie === null ? { 'content-type': 'application/json' }
                                : { cookie: opts.cookie || signedIn(), 'content-type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const run = async (fn, o) => {
  const real = globalThis.fetch; globalThis.fetch = stub(o);
  try { return await fn(); } finally { globalThis.fetch = real; }
};
const good = { path: 'content/02-about.md', sha: 'sha-1',
  fields: { title: 'About Terry', lede: 'Five decades.' }, body: '## Heading\n\nNew body.' };

console.log('\n/api/save');
await t('a save without a session is refused and writes nothing', async () => {
  const r = await run(() => save(post(good, { cookie: null })));
  assert.equal(r.status, 401);
  assert.equal(puts.length, 0);
});
await t('a forged cookie writes nothing', async () => {
  const forged = `${COOKIE}=${issue('terry', 'another-secret-bbbbbbbbbbbbbbbb')}`;
  const r = await run(() => save(post(good, { cookie: forged })));
  assert.equal(r.status, 401);
  assert.equal(puts.length, 0);
});
await t('GET is refused', async () => {
  const r = await run(() => save(new Request('https://modernitas.co.uk/api/save',
    { method: 'GET', headers: { cookie: signedIn() } })));
  assert.equal(r.status, 405);
  assert.equal(puts.length, 0);
});
await t('a good save commits the file and returns the new sha', async () => {
  const r = await run(() => save(post(good)));
  const d = await r.json();
  assert.equal(r.status, 200);
  assert.equal(d.saved, true);
  assert.equal(d.sha, 'sha-2');
  assert.equal(puts.length, 1);
});
await t('the committed file keeps every locked key', async () => {
  await run(() => save(post(good)));
  const written = Buffer.from(puts[0].content, 'base64').toString('utf8');
  const doc = FM.parse(written);
  assert.equal(FM.get(doc, 'slug'), 'about');
  assert.equal(FM.get(doc, 'order'), '2');
  assert.equal(FM.get(doc, 'layout'), 'document');
  assert.equal(FM.get(doc, 'intent'), 'make the site credible');
  assert.equal(FM.get(doc, 'title'), 'About Terry');
  assert.match(written, /New body\./);
});
await t('a locked key sent from a tampered browser is ignored', async () => {
  await run(() => save(post({ ...good,
    fields: { title: 'Fine', slug: 'hijacked', order: 1, layout: 'evil' } })));
  const doc = FM.parse(Buffer.from(puts[0].content, 'base64').toString('utf8'));
  assert.equal(FM.get(doc, 'slug'), 'about');
  assert.equal(FM.get(doc, 'layout'), 'document');
});
await t('the sha the studio held is the one sent, not a fresh one', async () => {
  await run(() => save(post(good)), { sha: 'moved-on' });
  assert.equal(puts[0].sha, 'sha-1');
});
await t('a save that changes nothing does not make a commit', async () => {
  const r = await run(() => save(post({ path: 'content/02-about.md', sha: 'sha-1',
    fields: { title: 'About', lede: 'Five decades.' }, body: '## Heading\n\nBody.' })));
  assert.equal((await r.json()).unchanged, true);
  assert.equal(puts.length, 0);
});
await t('the commit message is written for Terry, not for a developer', async () => {
  await run(() => save(post(good)));
  assert.equal(puts[0].message, 'Edited the About Terry page');
});
await t('it commits to the configured branch', async () => {
  await run(() => save(post(good)));
  assert.equal(puts[0].branch, 'main');
});
await t('a stale sha comes back as a plain explanation, not a 500', async () => {
  const r = await run(() => save(post(good)), { putStatus: 409 });
  assert.equal(r.status, 409);
  assert.match((await r.json()).error, /someone else changed this page/);
});
await t('netlify.toml cannot be written', async () => {
  const r = await run(() => save(post({ ...good, path: 'netlify.toml' })));
  assert.equal(r.status, 400);
  assert.equal(puts.length, 0);
});
await t('a draft cannot be written', async () => {
  const r = await run(() => save(post({ ...good, path: 'content/drafts/01-home.md' })));
  assert.equal(r.status, 400);
  assert.equal(puts.length, 0);
});
await t('a path outside the repository cannot be written', async () => {
  for (const p of ['../../etc/passwd', 'content/../netlify.toml', 'build.mjs']) {
    const r = await run(() => save(post({ ...good, path: p })));
    assert.equal(r.status, 400, p);
  }
  assert.equal(puts.length, 0);
});
await t('a save with no sha is refused', async () => {
  assert.equal((await run(() => save(post({ ...good, sha: undefined })))).status, 400);
});
await t('a save with no body is refused', async () => {
  assert.equal((await run(() => save(post({ ...good, body: undefined })))).status, 400);
});
await t('an enormous body is refused', async () => {
  const r = await run(() => save(post({ ...good, body: 'x'.repeat(300 * 1024) })));
  assert.equal(r.status, 413);
  assert.equal(puts.length, 0);
});
await t('a broken request does not throw', async () => {
  const r = await run(() => save(new Request('https://modernitas.co.uk/api/save', {
    method: 'POST', headers: { cookie: signedIn(), 'content-type': 'application/json' }, body: 'not json',
  })));
  assert.equal(r.status, 400);
});
await t('an unconfigured deploy says so', async () => {
  const keep = process.env.GITHUB_TOKEN; delete process.env.GITHUB_TOKEN;
  const r = await run(() => save(post(good)));
  process.env.GITHUB_TOKEN = keep;
  assert.equal(r.status, 503);
});
await t('a missing page is a 404', async () => {
  const r = await run(() => save(post({ ...good, path: 'content/nope.md' })));
  assert.equal(r.status, 404);
});
await t('nothing is cached', async () => {
  assert.equal((await run(() => save(post(good)))).headers.get('cache-control'), 'no-store');
});

console.log('\n' + (fail ? fail + ' of ' + n + ' FAILED' : 'all ' + n + ' passed'));
process.exit(fail ? 1 : 0);
