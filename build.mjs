/* ---------------------------------------------------------------------------
   modernitas.co.uk — build

   Reads content/*.md, writes dist/*.html.

   Adding a page: drop a markdown file in content/ with front matter.
   Filling a page: paste Terry's text under the front matter. That is the
   whole workflow. A page with no body renders an honest "content pending"
   state instead, so the site is navigable from day one.

   Run:  node build.mjs
--------------------------------------------------------------------------- */

import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const CONTENT = path.join(ROOT, 'content');
const DIST = path.join(ROOT, 'dist');
const SITE = 'https://modernitas.co.uk';


/* portable recursive copy: mkdir + copyFile only, no permission copying,
   which keeps it working on network and virtualised mounts */
function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) copyDir(a, b);
    else fs.copyFileSync(a, b);
  }
}

/* --------------------------------------------------------- front matter */
function parse(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw.trim() };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i === -1) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (/^\d+$/.test(v)) v = Number(v);
    else if (v === 'true' || v === 'false') v = v === 'true';
    else v = v.replace(/^["']|["']$/g, '');
    data[k] = v;
  }
  return { data, body: m[2].trim() };
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ------------------------------------------------------------ load pages */
const pages = fs.readdirSync(CONTENT)
  .filter((f) => f.endsWith('.md'))
  .map((f) => {
    const { data, body } = parse(fs.readFileSync(path.join(CONTENT, f), 'utf8'));
    return {
      slug: data.slug || f.replace(/^\d+-/, '').replace(/\.md$/, ''),
      title: data.title || 'Untitled',
      nav: data.nav ?? data.title,
      order: data.order ?? 99,
      intent: data.intent || '',
      lede: data.lede || '',
      cta: data.cta !== false,
      inNav: data.inNav !== false,
      source: f,
      body,
    };
  })
  .sort((a, b) => a.order - b.order);

const navPages = pages.filter((p) => p.inNav);
const href = (p) => (p.slug === 'home' ? '/' : `/${p.slug}/`);

/* -------------------------------------------------------------- partials */
function head(p) {
  const title = p.slug === 'home' ? 'modernitas' : `${p.title} — modernitas`;
  const desc = p.lede || 'Introduction to Modern IT, a course by Dr Terry Critchley.';
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}${href(p)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE}${href(p)}">
<link rel="stylesheet" href="/assets/site.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>`;
}

function masthead(current) {
  const links = navPages.filter((p) => p.slug !== 'home').map((p) =>
    `<a href="${href(p)}"${p.slug === current ? ' aria-current="page"' : ''}>${esc(p.nav)}</a>`
  ).join('\n        ');
  return `
<header class="masthead">
  <div class="shell">
    <a class="wordmark" href="/">modernitas</a>
    <nav class="nav" aria-label="Main">
        ${links}
        <a class="btn btn--small" href="/contact/">Register interest</a>
    </nav>
  </div>
</header>`;
}

function footer() {
  return `
<footer class="footer">
  <div class="shell">
    <span>modernitas.co.uk</span>
    <nav aria-label="Footer">
      <a href="/privacy/">Privacy</a>
      <a href="/contact/">Contact</a>
      <span>&copy; Terry Critchley ${new Date().getFullYear()}</span>
    </nav>
  </div>
</footer>
</body>
</html>`;
}

function ctaBand() {
  return `
<section class="band band--inverse">
  <div class="shell">
    <h2>The course is being finished now.</h2>
    <p>Leave your email and you will hear when it is ready. Nothing else will be sent to you.</p>
    <form class="signup" name="register" method="POST" data-netlify="true" netlify-honeypot="company" action="/thanks/">
      <input type="hidden" name="form-name" value="register">
      <p class="hp"><label>Do not fill this in <input name="company" tabindex="-1"></label></p>
      <label class="visually-hidden" for="reg-email" hidden>Email address</label>
      <input id="reg-email" type="email" name="email" placeholder="your@email.com" required aria-label="Email address">
      <button class="btn" type="submit">Register</button>
    </form>
  </div>
</section>`;
}

function pending(p) {
  return `
<div class="pending">
  <h2>This page is waiting for its content</h2>
  <p>The layout is finished. The words are not.</p>
  <p>Terry: this page is built from <code>${esc(p.source)}</code>. Send the document called
  <strong>${esc(p.source.replace(/\.md$/, '.docx'))}</strong> and it will appear here.</p>
</div>`;
}

/* ------------------------------------------------- home page (composed) */
const HOME = JSON.parse(fs.readFileSync(path.join(CONTENT, 'home.data.json'), 'utf8'));

function homeMain() {
  const trioClass = 'trio' + (getComputedDivider() === 'rules' ? ' trio--rules' : '');
  const audience = HOME.audience.map(([h, d]) =>
    `      <div class="card"><h3>${esc(h)}</h3><p>${esc(d)}</p></div>`).join('\n');
  const modules = HOME.modules.map(([t, d], i) =>
    `      <div class="item"><div class="item__n">${String(i + 1).padStart(2, '0')}</div>` +
    `<div><div class="item__t">${esc(t)}</div><div class="item__d">${esc(d)}</div></div></div>`).join('\n');
  const books = HOME.books.map((b) =>
    `      <li>${esc(b)}</li>`).join('\n');

  return `
<section class="hero">
  <div class="shell">
    <div class="hero__grid">
      <div>
        <p class="label">${esc(HOME.label)}</p>
        <h1>${esc(HOME.headline)}</h1>
        <p class="lede">${esc(HOME.lede)}</p>
        <div class="actions">
          <a class="btn" href="/contact/">Register your interest</a>
          <a class="btn btn--ghost" href="/the-course/">See what is in the course</a>
        </div>
      </div>
      <figure class="pull">
        <p>&ldquo;${esc(HOME.quote)}&rdquo;</p>
        <figcaption><cite>${esc(HOME.quoteBy)}</cite></figcaption>
      </figure>
    </div>
  </div>
</section>

<section class="band band--raised">
  <div class="shell">
    <h2>Who it is for</h2>
    <div class="${trioClass}">
${audience}
    </div>
  </div>
</section>

<section class="band">
  <div class="shell">
    <h2>${esc(HOME.modulesTitle)}</h2>
    <p class="lede">${esc(HOME.modulesLede)}</p>
    <div class="items">
${modules}
    </div>
  </div>
</section>

<section class="band band--sunken">
  <div class="shell">
    <h2>${esc(HOME.authorTitle)}</h2>
    <p class="lede">${esc(HOME.authorLede)}</p>
    <p>${esc(HOME.authorNote)}</p>
    <ul>
${books}
    </ul>
  </div>
</section>`;
}

// skin A separates the audience blocks with a rule rather than a card border
function getComputedDivider() {
  const tokens = fs.readFileSync(path.join(ROOT, 'assets', 'tokens.css'), 'utf8');
  const m = tokens.match(/^\s*@import url\("skin-([abc])\.css"\);/m);
  const skin = m ? m[1] : 'a';
  return skin === 'a' ? 'rules' : 'cards';
}

/* ------------------------------------------------- tabbed interior page */
function tabsMain(p) {
  const tabs = ['Overview', 'Modules', 'Who it is for', 'Resources'];
  const strip = tabs.map((t, i) =>
    `      <button class="tab" role="tab" id="tab-${i}" aria-controls="panel-${i}" aria-selected="${i === 0}">${esc(t)}</button>`
  ).join('\n');
  const panels = tabs.map((t, i) =>
    `    <div class="panel" role="tabpanel" id="panel-${i}" aria-labelledby="tab-${i}"${i ? ' hidden' : ''}>
      <div class="prose"><h2>${esc(t)}</h2>${i === 0 && p.body ? marked.parse(p.body) : `<p class="pending-note">[Content for the ${esc(t)} tab.]</p>`}</div>
    </div>`
  ).join('\n');

  return `
<div class="shell band">
  <h1>${esc(p.title)}</h1>
  ${p.lede ? `<p class="lede">${esc(p.lede)}</p>` : ''}
</div>
<div class="shell">
  <div class="tabs" role="tablist" aria-label="${esc(p.title)}">
${strip}
  </div>
${panels}
</div>
<script>
(() => {
  for (const list of document.querySelectorAll('[role="tablist"]')) {
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const show = (i) => tabs.forEach((t, j) => {
      t.setAttribute('aria-selected', String(i === j));
      document.getElementById(t.getAttribute('aria-controls')).hidden = i !== j;
    });
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => show(i));
      t.addEventListener('keydown', (e) => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        const n = (i + d + tabs.length) % tabs.length;
        tabs[n].focus(); show(n);
      });
    });
  }
})();
</script>`;
}

/* --------------------------------------------------------- contact page */
function contactMain(p) {
  return `
<div class="shell band">
  <h1>${esc(p.title)}</h1>
  <div class="prose">${p.body ? marked.parse(p.body) : '<p>[TERRY: two or three sentences here about what you are happy to be contacted about.]</p>'}</div>
  <form class="form" name="enquiry" method="POST" data-netlify="true" netlify-honeypot="company" action="/thanks/">
    <input type="hidden" name="form-name" value="enquiry">
    <p class="hp"><label>Do not fill this in <input name="company" tabindex="-1"></label></p>
    <div class="field"><label for="c-name">Your name</label><input id="c-name" name="name" required></div>
    <div class="field"><label for="c-email">Your email</label><input id="c-email" type="email" name="email" required></div>
    <div class="field"><label for="c-msg">Your message</label><textarea id="c-msg" name="message" required></textarea></div>
    <div><button class="btn" type="submit">Send</button></div>
  </form>
</div>`;
}

/* ---------------------------------------------------------------- render */
marked.setOptions({ mangle: false, headerIds: false });

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
copyDir(path.join(ROOT, 'assets'), path.join(DIST, 'assets'));

let built = 0, empty = 0;

for (const p of pages) {
  const isHome = p.slug === 'home';
  const hasBody = p.body.length > 0;
  if (!hasBody) empty++;

  let main;
  if (isHome) main = homeMain();
  else if (p.slug === 'the-course') main = tabsMain(p);
  else if (p.slug === 'contact') main = contactMain(p);
  else main = `<div class="shell band">
  <h1>${esc(p.title)}</h1>
  ${p.lede ? `<p class="lede">${esc(p.lede)}</p>` : ''}
  <div class="prose">${hasBody ? marked.parse(p.body) : ''}</div>
  ${hasBody ? '' : pending(p)}
</div>`;

  const html = [
    head(p),
    masthead(p.slug),
    `<main id="main">`,
    main,
    `</main>`,
    p.cta ? ctaBand() : '',
    footer(),
  ].join('\n');

  const dir = isHome ? DIST : path.join(DIST, p.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  built++;
}

/* --------------------------------------------------------- extra pages */
const extras = {
  'thanks': ['Thank you', '<p>Your details are with Terry. He will be in touch.</p><p><a href="/">Back to the site</a></p>'],
  '404': ['Page not found', '<p>That page does not exist, or has moved.</p><p><a href="/">Back to the site</a></p>'],
};
for (const [slug, [title, body]] of Object.entries(extras)) {
  const p = { slug, title, lede: '', cta: false };
  const html = [head(p), masthead(''), '<main id="main">',
    `<div class="shell band"><h1>${esc(title)}</h1><div class="prose">${body}</div></div>`,
    '</main>', footer()].join('\n');
  if (slug === '404') fs.writeFileSync(path.join(DIST, '404.html'), html);
  else { fs.mkdirSync(path.join(DIST, slug), { recursive: true }); fs.writeFileSync(path.join(DIST, slug, 'index.html'), html); }
}

/* ----------------------------------------------------- robots & sitemap */
fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
fs.writeFileSync(path.join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  pages.map((p) => `  <url><loc>${SITE}${href(p)}</loc></url>`).join('\n') +
  `\n</urlset>\n`);

console.log(`built ${built} pages, ${empty} still waiting for content`);
