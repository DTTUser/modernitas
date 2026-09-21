import assert from 'node:assert/strict';
import * as P from '../netlify/lib/paths.mjs';
import { client, GitHubError } from '../netlify/lib/github.mjs';
import { issue, COOKIE } from '../netlify/lib/session.mjs';

process.env.SESSION_SECRET = 'a-long-random-string-for-testing-only-0123456789';
process.env.GITHUB_TOKEN = 'ghp_not_a_real_token';
process.env.GITHUB_REPO = 'terry/modernitas';
process.env.GITHUB_BRANCH = 'main';
const { default: content } = await import('../netlify/functions/content.mjs');

let n = 0, fail = 0;
const t = async (name, fn) => { n++; try { await fn(); console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '  ->  ' + e.message); } };

/* ------------------------------------------------------------ a fake GitHub */
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const page = (title, slug, order, lede) =>
  `---\ntitle: ${title}\nslug: ${slug}\nnav: ${title}\norder: ${order}\nlayout: document\nintent: a build note\nlede: ${lede}\n---\n\n## Heading\n\nBody.\n`;

let calls = [];
function fakeGitHub(overrides = {}) {
  calls = [];
  const files = {
    'content/01-home.md': page('Home', 'home', 1, 'Lede one.'),
    'content/02-about.md': page('About', 'about', 2, 'Lede two.'),
    'content/08-privacy.md': page('Privacy', 'privacy', 8, 'Lede three.'),
    ...(overrides.files || {}),
  };
  return async (url, init = {}) => {
    calls.push({ url, method: init.method });
    const u = new URL(url);
    const p = decodeURIComponent(u.pathname);
    const ok = (body) => new Response(JSON.stringify(body), { status: 200 });

    if (p === '/repos/terry/modernitas/contents/content') {
      return ok([
        ...Object.keys(files).map((f) => ({ name: f.split('/').pop(), path: f, type: 'file', sha: 'sha-' + f, size: files[f].length })),
        { name: 'drafts', path: 'content/drafts', type: 'dir', sha: 'd' },
        { name: 'articles.data.json', path: 'content/articles.data.json', type: 'file', sha: 'a', size: 2 },
      ]);
    }
    const m = p.match(/^\/repos\/terry\/modernitas\/contents\/(.+)$/);
    if (m && files[m[1]]) return ok({ path: m[1], sha: 'sha-' + m[1], type: 'file', content: b64(files[m[1]]) });
    if (m) return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
    return new Response(JSON.stringify({ message: 'unexpected ' + p }), { status: 500 });
  };
}

const signedIn = () => `${COOKIE}=${issue('terry', process.env.SESSION_SECRET)}`;
const req = (qs = '', opts = {}) => new Request('https://modernitas.co.uk/api/content' + qs, {
  method: opts.method || 'GET',
  headers: opts.cookie === null ? {} : { cookie: opts.cookie || signedIn() },
});

/* --------------------------------------------------------------------- paths */
console.log('\npaths');
await t('real pages are editable', () => {
  for (const p of ['content/01-home.md', 'content/08-privacy.md', 'content/a.md'])
    assert.ok(P.isPage(p), p);
});
await t('drafts, netlify.toml and traversal are not', () => {
  for (const p of ['content/drafts/01-home.md', 'netlify.toml', 'build.mjs',
                   'content/../netlify.toml', '../../etc/passwd', 'content/x.json',
                   'content/.git/config', '', null, 'content/drafts'])
    assert.equal(P.isPage(p), false, 'allowed ' + p);
});
await t('only the three data files are writable data', () => {
  assert.ok(P.isData('content/articles.data.json'));
  assert.ok(P.isData('content/books.data.json'));
  assert.equal(P.isData('content/secrets.data.json'), false);
});
await t('images are jpg, png, webp under assets/img only', () => {
  assert.ok(P.isImage('assets/img/photo.jpg'));
  assert.ok(P.isImage('assets/img/Photo.WEBP'));
  assert.equal(P.isImage('assets/img/evil.svg'), false);
  assert.equal(P.isImage('assets/img/sub/photo.jpg'), false);
  assert.equal(P.isImage('assets/photo.jpg'), false);
});
await t('filenames are slugified sensibly', () => {
  assert.equal(P.slugifyFilename('Terry at the Lectern (2).JPEG'), 'terry-at-the-lectern-2.jpg');
  assert.equal(P.slugifyFilename('  ..//weird name!!.PNG'), 'weird-name.png');
  // a dotfile has no usable name and no extension, so it must fail the image test
  assert.equal(P.isImage('assets/img/' + P.slugifyFilename('.jpg')), false);
  assert.equal(P.isImage('assets/img/' + P.slugifyFilename('')), false);
});

/* -------------------------------------------------------------- the client */
console.log('\ngithub client');
await t('list returns files with paths', async () => {
  const gh = client({ fetchImpl: fakeGitHub() });
  const items = await gh.list('content');
  assert.ok(items.some((i) => i.path === 'content/02-about.md'));
});
await t('get decodes base64 and carries the sha', async () => {
  const gh = client({ fetchImpl: fakeGitHub() });
  const f = await gh.get('content/02-about.md');
  assert.match(f.text, /title: About/);
  assert.equal(f.sha, 'sha-content/02-about.md');
});
await t('a 404 becomes a GitHubError with the status on it', async () => {
  const gh = client({ fetchImpl: fakeGitHub() });
  await assert.rejects(() => gh.get('content/nope.md'), (e) => e instanceof GitHubError && e.status === 404);
});
await t('the token is sent and never returned', async () => {
  let seen = null;
  const gh = client({ fetchImpl: async (url, init) => { seen = init.headers.authorization; return fakeGitHub()(url, init); } });
  await gh.get('content/02-about.md');
  assert.equal(seen, 'Bearer ghp_not_a_real_token');
});
await t('paths with spaces are encoded, not pasted in raw', async () => {
  let seen = null;
  const gh = client({ fetchImpl: async (url, init) => { seen = url; return fakeGitHub()(url, init); } });
  await gh.get('content/two words.md').catch(() => {});
  assert.ok(seen.includes('two%20words.md'), seen);
});

/* ------------------------------------------------------------ the function */
console.log('\n/api/content');
const withGitHub = async (fn, overrides) => {
  const real = globalThis.fetch;
  globalThis.fetch = fakeGitHub(overrides);
  try { return await fn(); } finally { globalThis.fetch = real; }
};

await t('a request without a session is refused', async () => {
  const r = await withGitHub(() => content(req('', { cookie: null })));
  assert.equal(r.status, 401);
});
await t('a forged cookie is refused', async () => {
  const forged = `${COOKIE}=${issue('terry', 'some-other-secret-aaaaaaaaaaaa')}`;
  const r = await withGitHub(() => content(req('', { cookie: forged })));
  assert.equal(r.status, 401);
});
await t('the page list comes back in navigation order', async () => {
  const r = await withGitHub(() => content(req()));
  const { pages } = await r.json();
  assert.deepEqual(pages.map((p) => p.title), ['Home', 'About', 'Privacy']);
  assert.deepEqual(pages.map((p) => p.order), [1, 2, 8]);
});
await t('the list holds pages only, not drafts or data files', async () => {
  const { pages } = await (await withGitHub(() => content(req()))).json();
  assert.ok(pages.every((p) => p.path.endsWith('.md')));
  assert.ok(!pages.some((p) => p.path.includes('drafts')));
  assert.ok(!pages.some((p) => p.path.includes('.json')));
});
await t('one page comes back split into editable and locked', async () => {
  const r = await withGitHub(() => content(req('?path=content/02-about.md')));
  const d = await r.json();
  assert.deepEqual(Object.keys(d.fields).sort(), ['lede', 'title']);
  assert.equal(d.fields.title, 'About');
  assert.equal(d.locked.slug, 'about');
  assert.match(d.body, /## Heading/);
  assert.equal(d.sha, 'sha-content/02-about.md');
});
await t('intent never reaches the browser', async () => {
  const body = await (await withGitHub(() => content(req('?path=content/02-about.md')))).text();
  assert.ok(!body.includes('a build note'), 'intent leaked to the studio');
  assert.ok(!body.includes('intent'));
});
await t('a draft cannot be opened', async () => {
  const r = await withGitHub(() => content(req('?path=content/drafts/01-home.md')));
  assert.equal(r.status, 400);
});
await t('netlify.toml cannot be opened', async () => {
  const r = await withGitHub(() => content(req('?path=netlify.toml')));
  assert.equal(r.status, 400);
});
await t('a missing page is a plain 404, not a stack trace', async () => {
  const r = await withGitHub(() => content(req('?path=content/nope.md')));
  assert.equal(r.status, 404);
  assert.equal((await r.json()).error, 'that page is not there');
});
await t('POST is refused', async () => {
  const r = await withGitHub(() => content(req('', { method: 'POST' })));
  assert.equal(r.status, 405);
});
await t('an unconfigured deploy says so rather than failing oddly', async () => {
  const keep = process.env.GITHUB_TOKEN;
  delete process.env.GITHUB_TOKEN;
  const r = await withGitHub(() => content(req()));
  process.env.GITHUB_TOKEN = keep;
  assert.equal(r.status, 503);
});
await t('nothing is cached', async () => {
  const r = await withGitHub(() => content(req()));
  assert.equal(r.headers.get('cache-control'), 'no-store');
});

console.log('\n' + (fail ? fail + ' of ' + n + ' FAILED' : 'all ' + n + ' passed'));
process.exit(fail ? 1 : 0);
