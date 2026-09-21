/* ---------------------------------------------------------------------------
   The markdown round trip, tested where it actually runs.

   toMarkdown reads a live DOM, and the DOM that matters is the one Chrome
   builds out of a contenteditable after somebody has pasted half a Word
   document into it. A simulated DOM in Node would pass tests that the real
   thing fails, so this drives a real browser.

   Playwright is not a dependency of this site and is not needed to build or
   deploy it. If it is not installed this skips, loudly.

       npm i -D playwright && npx playwright install chromium
       node test/markdown.browser.mjs
--------------------------------------------------------------------------- */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import * as FM from '../netlify/lib/frontmatter.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let chromium;
try { ({ chromium } = await import('playwright')); }
catch {
  console.log('\n  skipped: playwright is not installed.');
  console.log('  npm i -D playwright && npx playwright install chromium\n');
  process.exit(0);
}

/* A server, because a module cannot be imported from a file:// page. */
const srv = http.createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end(`<!doctype html><meta charset="utf-8"><body>
<div id="ed" contenteditable></div>
<script type="module">
import { toHtml, toMarkdown } from '/studio/markdown.mjs';
window.MD = { toHtml, toMarkdown }; window.ready = true;
</script></body>`);
  }
  const fp = path.join(ROOT, req.url);
  if (fp.startsWith(ROOT) && fs.existsSync(fp)) {
    res.writeHead(200, { 'content-type': 'text/javascript' });
    return res.end(fs.readFileSync(fp));
  }
  res.writeHead(404); res.end();
});
const port = 8121;
await new Promise((r) => srv.listen(port, r));

const browser = await chromium.launch();
const pg = await browser.newPage();
const pageErrors = [];
pg.on('pageerror', (e) => pageErrors.push(String(e)));
await pg.goto(`http://localhost:${port}/`);
await pg.waitForFunction('window.ready');

let n = 0, fail = 0;
const t = (name, ok, extra) => {
  n++;
  if (ok) console.log('  ok   ' + name);
  else { fail++; console.log('  FAIL ' + name + (extra ? '\n' + extra : '')); }
};
const fromHtml = (html) => pg.evaluate((h) => {
  const ed = document.getElementById('ed'); ed.innerHTML = h; return window.MD.toMarkdown(ed);
}, html);
const md2md = (md) => pg.evaluate((m) => {
  const ed = document.getElementById('ed'); ed.innerHTML = window.MD.toHtml(m); return window.MD.toMarkdown(ed);
}, md);

/* ------------------------------------------------------ the real content */
console.log('\nthe real pages');
const CONTENT = path.join(ROOT, 'content');
const reflowed = [];
for (const f of fs.readdirSync(CONTENT).filter((x) => x.endsWith('.md'))) {
  const md = FM.parse(fs.readFileSync(path.join(CONTENT, f), 'utf8')).body;
  const r = await pg.evaluate(({ md }) => {
    const ed = document.getElementById('ed');
    ed.innerHTML = window.MD.toHtml(md);
    const once = window.MD.toMarkdown(ed);
    ed.innerHTML = window.MD.toHtml(once);
    const twice = window.MD.toMarkdown(ed);
    ed.innerHTML = window.MD.toHtml(twice);
    const thrice = window.MD.toMarkdown(ed);
    return { once, twice, thrice, before: window.MD.toHtml(md), after: window.MD.toHtml(once) };
  }, { md });

  const diff = (a, b) => {
    const x = a.split('\n'), y = b.split('\n');
    let i = 0; while (i < Math.max(x.length, y.length) && x[i] === y[i]) i++;
    return `      line ${i + 1}\n      was:  ${JSON.stringify(x[i])}\n      now:  ${JSON.stringify(y[i])}`;
  };

  t(f + ' renders identically after a round trip', r.before === r.after, diff(r.before, r.after));
  t(f + ' is stable on every save after the first',
    r.once === r.twice && r.twice === r.thrice, diff(r.once, r.twice));
  if (r.once !== md.trim() + '\n') reflowed.push(f);
}
if (reflowed.length)
  console.log('\n  note: a first save reflows hard-wrapped paragraphs in ' + reflowed.join(', ')
            + '. The rendered page does not change.');

/* ------------------------------------------- what a browser leaves behind */
console.log('\nwhat a browser leaves behind');
t('a bare div becomes a paragraph', await fromHtml('<div>Hello there.</div>') === 'Hello there.\n');
t('nested divs do not nest paragraphs',
  await fromHtml('<div><div>One.</div><div>Two.</div></div>') === 'One.\n\nTwo.\n');
t('a styled span keeps its words and loses its styling',
  await fromHtml('<p><span style="font-family:Comic Sans MS;color:red">Terry</span> wrote this.</p>') === 'Terry wrote this.\n');
t('a pasted font tag is stripped', await fromHtml('<p><font face="Arial">Words</font></p>') === 'Words\n');
t('non-breaking spaces come back as spaces', await fromHtml('<p>One two</p>') === 'One two\n');
t('an empty paragraph is dropped', await fromHtml('<p></p><p>Real.</p><p><br></p>') === 'Real.\n');
t('b and i are treated as strong and em',
  await fromHtml('<p><b>Bold</b> and <i>italic</i>.</p>') === '**Bold** and *italic*.\n');
t('a heading pasted as h1 is demoted to h2', await fromHtml('<h1>Shouting</h1>') === '## Shouting\n');
t('h5 is promoted up to h4', await fromHtml('<h5>Deep</h5>') === '#### Deep\n');
t('a word processor table is flattened to its words, not dropped',
  (await fromHtml('<table><tr><td>One</td><td>Two</td></tr></table>')).includes('One'));
t('a pasted script contributes nothing',
  !(await fromHtml('<p>Safe</p><script>alert(1)</script>')).includes('alert'));
t('a pasted stylesheet contributes nothing',
  !(await fromHtml('<style>p{color:red}</style><p>Safe</p>')).includes('color'));
t('an image survives with its alt text',
  await fromHtml('<p><img src="/assets/img/terry.jpg" alt="Terry at the lectern"></p>')
    === '![Terry at the lectern](/assets/img/terry.jpg)\n');
t('a link keeps its address',
  await fromHtml('<p>See the <a href="/books/">books page</a>.</p>') === 'See the [books page](/books/).\n');

/* --------------------------------------------------- things Terry may type */
console.log('\nthings Terry might type');
t('a literal asterisk stays literal', await md2md('5 * 4 = 20\n') === '5 \\* 4 = 20\n');
t('and does not gather backslashes on every save',
  await md2md(await md2md(await md2md('5 * 4 = 20\n'))) === '5 \\* 4 = 20\n');
t('a bare bracket is not escaped', await md2md('[TERRY: a note]\n') === '[TERRY: a note]\n');
t('an ampersand survives', await md2md('Marks & Spencer\n') === 'Marks & Spencer\n');
t('angle brackets do not become tags', await md2md('a < b > c\n') === 'a < b > c\n');
t('an em dash is left alone', await md2md('Yes — and no.\n') === 'Yes — and no.\n');
t('a curly quote survives', await md2md('Terry’s book\n') === 'Terry’s book\n');
t('a numbered list renumbers itself', await md2md('3. one\n7. two\n') === '1. one\n2. two\n');
t('a bullet list survives', await md2md('- one\n- two\n') === '- one\n- two\n');
t('a quote with bold in it survives', await md2md('> **Note.** Read this.\n') === '> **Note.** Read this.\n');
t('bold inside a heading survives', await md2md('## A **strong** heading\n') === '## A **strong** heading\n');
t('an empty document is empty, not a stray newline', await md2md('') === '');

console.log('\n' + (fail ? fail + ' of ' + n + ' FAILED' : 'all ' + n + ' passed'));
if (pageErrors.length) console.log('page errors:', pageErrors);
await browser.close();
srv.close();
process.exit(fail ? 1 : 0);
