/* ---------------------------------------------------------------------------
   modernitas.co.uk — build

   Reads content/, writes dist/. No framework. One dependency (marked).

       node build.mjs              staging build: noindex, no analytics
       node build.mjs --demo       staging build with placeholder copy filled in
       node build.mjs --live       the real thing: indexable, analytics on

   THE --live FLAG IS THE LAUNCH SWITCH. Until it is used, every page carries
   a noindex tag and robots.txt disallows everything, so the staging address on
   netlify.app cannot end up in Google ahead of the real domain.

   Adding a page: drop a markdown file in content/ with front matter.
   Filling a page: paste Terry's text under the front matter.
   A page with no body renders an honest "waiting for its content" panel, so
   the site is navigable from day one and the gaps are visible without anybody
   having to chase.
--------------------------------------------------------------------------- */

import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const CONTENT = path.join(ROOT, 'content');
const DIST = path.join(ROOT, 'dist');
const SITE = 'https://modernitas.co.uk';

const ARGS = new Set(process.argv.slice(2));
const LIVE = ARGS.has('--live');
const DEMO = ARGS.has('--demo');
const NOINDEX = !LIVE;

/* Plausible: cookie-free analytics. Only emitted on a live build, so the
   staging site never pollutes the numbers. Costs about GBP 90 a year and is
   Terry's subscription, not ours. If he decides against it, delete this
   constant and the site is unchanged. */
const ANALYTICS_DOMAIN = 'modernitas.co.uk';

/* --------------------------------------------------------------- helpers */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* cpSync throws EACCES on the mounted folders this repo lives in, so copy
   by hand. Slower, works everywhere. */
function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

function readData(name) {
  const file = path.join(CONTENT, name);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
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
      layout: data.layout || 'document',
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
function analytics() {
  if (!LIVE) return '';
  return `\n<script defer data-domain="${ANALYTICS_DOMAIN}" src="https://plausible.io/js/script.js"></script>`;
}

function structuredData(p) {
  if (p.slug !== 'home') return '';
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE}/#website`,
        url: SITE,
        name: 'modernitas',
        inLanguage: 'en-GB',
      },
      {
        '@type': 'Person',
        '@id': `${SITE}/#terry`,
        name: 'Dr Terry Critchley',
        jobTitle: 'IT author and course author',
        url: SITE,
      },
      {
        '@type': 'Course',
        name: 'Introduction to Modern IT',
        description:
          'A ten-module course on the whole IT landscape, for people entering IT, changing career into it, or teaching it.',
        provider: { '@id': `${SITE}/#terry` },
        author: { '@id': `${SITE}/#terry` },
        inLanguage: 'en-GB',
        url: `${SITE}/the-course/`,
      },
    ],
  };
  return `\n<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

function head(p) {
  const title = p.slug === 'home' ? 'modernitas — Introduction to Modern IT' : `${p.title} — modernitas`;
  const desc = p.lede || 'Introduction to Modern IT, a course by Dr Terry Critchley.';
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">${NOINDEX ? '\n<meta name="robots" content="noindex, nofollow">' : ''}
<link rel="canonical" href="${SITE}${href(p)}">
<meta property="og:site_name" content="modernitas">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="en_GB">
<meta property="og:url" content="${SITE}${href(p)}">
<meta property="og:image" content="${SITE}/assets/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#2F5D7C">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="preload" as="font" type="font/woff2" href="/assets/fonts/public-sans-latin-400-normal.woff2" crossorigin>
<link rel="preload" as="font" type="font/woff2" href="/assets/fonts/public-sans-latin-600-normal.woff2" crossorigin>
<link rel="stylesheet" href="/assets/site.css">${structuredData(p)}${analytics()}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>`;
}

function masthead(current) {
  const links = navPages.filter((p) => p.slug !== 'home').map((p) =>
    `        <a href="${href(p)}"${p.slug === current ? ' aria-current="page"' : ''}>${esc(p.nav)}</a>`
  ).join('\n');
  return `
<header class="masthead">
  <div class="shell">
    <a class="wordmark" href="/">modernitas</a>
    <button class="navtoggle" type="button" aria-expanded="false" aria-controls="nav" hidden>
      <span class="navtoggle__bars" aria-hidden="true"></span>
      <span class="visually-hidden">Menu</span>
    </button>
    <nav class="nav" id="nav" aria-label="Main">
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
    <p class="footer__mark">modernitas.co.uk</p>
    <nav class="footer__nav" aria-label="Footer">
      <a href="/">Home</a>
      <a href="/the-course/">The course</a>
      <a href="/contact/">Contact</a>
      <a href="/privacy/">Privacy</a>
    </nav>
    <p class="footer__legal">&copy; Dr Terry Critchley ${new Date().getFullYear()}. All rights reserved.</p>
  </div>
</footer>
<script src="/assets/site.js" defer></script>
</body>
</html>`;
}

function ctaBand(p) {
  // The hidden "page" field costs nothing and tells Terry which page actually
  // persuaded somebody to register. Without it every signup looks identical.
  return `
<section class="band band--inverse">
  <div class="shell">
    <div class="signup__grid">
      <div>
        <h2>The course is being finished now</h2>
        <p>Leave your email and you will hear when it is ready. Nothing else will be sent to you, and the list is not shared with anyone.</p>
      </div>
      <form class="signup" name="register" method="POST" data-netlify="true" netlify-honeypot="company" action="/registered/">
        <input type="hidden" name="form-name" value="register">
        <input type="hidden" name="page" value="${esc(p && p.slug ? p.slug : 'unknown')}">
        <p class="hp"><label>Do not fill this in <input name="company" tabindex="-1" autocomplete="off"></label></p>
        <div class="signup__row">
          <label class="visually-hidden" for="reg-email">Email address</label>
          <input id="reg-email" type="email" name="email" placeholder="your@email.com" autocomplete="email" required>
          <button class="btn btn--onDark" type="submit">Register</button>
        </div>
        <p class="signup__note">One message, when the course is ready. See the <a href="/privacy/">privacy notice</a>.</p>
      </form>
    </div>
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

/* Placeholder prose for --demo builds. Deliberately not lorem ipsum: it is in
   English, and it says what it is on every paragraph, so there is no chance of
   it being mistaken for copy or surviving to the live site unnoticed. */
const FILLER = [
  'PLACEHOLDER. This paragraph exists only to show how a block of body copy sits on the page at a realistic length. Terry’s words will replace it in full. Nothing here is a proposal, a summary or a suggestion.',
  'PLACEHOLDER. A second paragraph, so the spacing between them can be judged. Line length is capped at about forty-two characters per em to keep it comfortable to read on a wide screen, which is why this column does not run the full width of the page.',
  'PLACEHOLDER. A third and final paragraph. When the real text arrives it may be longer or shorter than this, and the layout will absorb either without anything needing to be redrawn.',
];
function filler(p) {
  return `
<div class="prose">
  <p class="placeholder-flag">Placeholder text. This is a demonstration build.</p>
  ${FILLER.map((t) => `<p>${esc(t)}</p>`).join('\n  ')}
  <h2>A subheading, to show the spacing</h2>
  ${FILLER.slice(0, 2).map((t) => `<p>${esc(t)}</p>`).join('\n  ')}
  <ul>
    <li>PLACEHOLDER list item, to show how bullets are set</li>
    <li>PLACEHOLDER list item, second of three</li>
    <li>PLACEHOLDER list item, third of three</li>
  </ul>
  ${FILLER.slice(2).map((t) => `<p>${esc(t)}</p>`).join('\n  ')}
</div>
<p class="placeholder-source">Real content goes in <code>${esc(p.source)}</code>.</p>`;
}

/* ------------------------------------------------- home page (composed) */
const HOME = readData('home.data.json');

function homeMain() {
  const audience = HOME.audience.map(([h, d]) =>
    `      <div class="card"><h3>${esc(h)}</h3><p>${esc(d)}</p></div>`).join('\n');
  const modules = HOME.modules.map(([t, d], i) =>
    `      <div class="item"><div class="item__n">${String(i + 1).padStart(2, '0')}</div>` +
    `<div><div class="item__t">${esc(t)}</div><div class="item__d">${esc(d)}</div></div></div>`).join('\n');
  const books = HOME.books.map((b) => `      <li>${esc(b)}</li>`).join('\n');

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
    <div class="trio">
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
    <div class="author">
      <div class="author__portrait">
        <div class="imgslot" role="img" aria-label="Photograph of Dr Terry Critchley, to be supplied">
          <span>Photograph<br>to come</span>
        </div>
      </div>
      <div class="author__text">
        <h2>${esc(HOME.authorTitle)}</h2>
        <p class="lede">${esc(HOME.authorLede)}</p>
        <p>${esc(HOME.authorNote)}</p>
        <ul class="tight">
${books}
        </ul>
        <p><a class="more" href="/about/">More about Terry</a></p>
      </div>
    </div>
  </div>
</section>`;
}

/* ------------------------------------------------- tabbed interior page */
function tabsMain(p) {
  const tabs = ['Overview', 'Modules', 'Who it is for', 'Resources'];
  const strip = tabs.map((t, i) =>
    `      <button class="tab" role="tab" id="tab-${i}" aria-controls="panel-${i}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${esc(t)}</button>`
  ).join('\n');
  const modules = HOME.modules.map(([t, d], i) =>
    `        <div class="item"><div class="item__n">${String(i + 1).padStart(2, '0')}</div>` +
    `<div><div class="item__t">${esc(t)}</div><div class="item__d">${esc(d)}</div></div></div>`).join('\n');
  const audience = HOME.audience.map(([h, d]) =>
    `        <div class="card"><h3>${esc(h)}</h3><p>${esc(d)}</p></div>`).join('\n');

  const bodies = [
    p.body ? `<div class="prose">${marked.parse(p.body)}</div>` : (DEMO ? filler(p) : `<div class="prose"><p class="pending-note">[Overview text for the course page.]</p></div>`),
    `<div class="items">\n${modules}\n      </div>`,
    `<div class="trio">\n${audience}\n      </div>`,
    `<div class="prose"><p class="pending-note">[Reading list, downloads and links. Waiting on Terry's page, download or drop verdict for each document.]</p></div>`,
  ];

  // No hidden attribute here on purpose. Without JavaScript every panel shows,
  // stacked and headed, which is a perfectly good page. site.js hides all but
  // the first on load, and the tab strip only appears once JS has run.
  const panels = tabs.map((t, i) =>
    `    <div class="panel" role="tabpanel" id="panel-${i}" aria-labelledby="tab-${i}" tabindex="0">
      <h2 class="panel__h">${esc(t)}</h2>
      ${bodies[i]}
    </div>`
  ).join('\n');

  return `
<div class="shell band band--tight">
  <h1>${esc(p.title)}</h1>
  ${p.lede ? `<p class="lede">${esc(p.lede)}</p>` : ''}
</div>
<div class="shell">
  <div class="tabs" role="tablist" aria-label="${esc(p.title)}">
${strip}
  </div>
${panels}
</div>`;
}

/* --------------------------------------------------------- contact page */
function contactMain(p) {
  const intro = p.body
    ? marked.parse(p.body)
    : '<p>[TERRY: two or three sentences here about what you are happy to be contacted about.]</p>';
  return `
<div class="shell band">
  <h1>${esc(p.title)}</h1>
  <div class="contact__grid">
    <div class="prose">${intro}</div>
    <form class="form" name="enquiry" method="POST" data-netlify="true" netlify-honeypot="company" action="/thanks/">
      <input type="hidden" name="form-name" value="enquiry">
      <input type="hidden" name="page" value="contact">
      <p class="hp"><label>Do not fill this in <input name="company" tabindex="-1" autocomplete="off"></label></p>
      <div class="field"><label for="c-name">Your name</label><input id="c-name" name="name" autocomplete="name" required></div>
      <div class="field"><label for="c-email">Your email</label><input id="c-email" type="email" name="email" autocomplete="email" required></div>
      <div class="field"><label for="c-msg">Your message</label><textarea id="c-msg" name="message" rows="6" required></textarea></div>
      <div><button class="btn" type="submit">Send</button></div>
      <p class="signup__note">Your details go to Terry and nowhere else. See the <a href="/privacy/">privacy notice</a>.</p>
    </form>
  </div>
</div>`;
}

/* ----------------------------------------------------------- books page */
const BOOKS = readData('books.data.json') || { books: [] };

function booksMain(p) {
  const items = BOOKS.books.map((b) => `
      <article class="book">
        <div class="book__cover">
          <div class="imgslot imgslot--cover" role="img" aria-label="Cover of ${esc(b.title)}, to be supplied"><span>Cover<br>to come</span></div>
        </div>
        <div class="book__text">
          <h2>${esc(b.title)}</h2>
          <p class="book__meta">${esc(b.publisher || '')}${b.year ? `, ${esc(b.year)}` : ''}${b.isbn ? ` &middot; ISBN ${esc(b.isbn)}` : ''}</p>
          <p>${b.blurb ? esc(b.blurb) : '<span class="pending-note">[TERRY: a sentence or two on this one, and who it is for.]</span>'}</p>
          ${b.url ? `<p><a class="more" href="${esc(b.url)}" rel="noopener">Where to buy it</a></p>` : ''}
        </div>
      </article>`).join('\n');

  return `
<div class="shell band">
  <h1>${esc(p.title)}</h1>
  ${p.lede ? `<p class="lede">${esc(p.lede)}</p>` : ''}
  <div class="books">${items}</div>
</div>`;
}

/* -------------------------------------------------------- articles page */
const ARTICLES = readData('articles.data.json') || { articles: [] };

function articlesMain(p) {
  if (!ARTICLES.articles.length) {
    return `<div class="shell band"><h1>${esc(p.title)}</h1>${p.lede ? `<p class="lede">${esc(p.lede)}</p>` : ''}${pending(p)}</div>`;
  }
  const items = ARTICLES.articles.map((a) => {
    const kind = a.kind === 'link' ? 'Published elsewhere'
      : a.kind === 'download' ? 'PDF download' : 'Article';
    const target = a.kind === 'link' ? ' rel="noopener"' : '';
    const href = a.href || '#';
    return `
      <li class="entry">
        <p class="entry__kind">${esc(kind)}</p>
        <h2 class="entry__title"><a href="${esc(href)}"${target}>${esc(a.title)}</a></h2>
        <p class="entry__blurb">${esc(a.blurb || '')}</p>
        ${a.source ? `<p class="entry__source">${esc(a.source)}</p>` : ''}
      </li>`;
  }).join('\n');

  return `
<div class="shell band">
  <h1>${esc(p.title)}</h1>
  ${p.lede ? `<p class="lede">${esc(p.lede)}</p>` : ''}
  <ul class="entries">${items}</ul>
</div>`;
}

/* ---------------------------------------------------------------- render */
marked.setOptions({ mangle: false, headerIds: false });

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
copyDir(path.join(ROOT, 'assets'), path.join(DIST, 'assets'));

let built = 0, empty = 0;

for (const p of pages) {
  const hasBody = p.body.length > 0;
  if (!hasBody) empty++;

  let main;
  switch (p.layout) {
    case 'home': main = homeMain(); break;
    case 'tabs': main = tabsMain(p); break;
    case 'contact': main = contactMain(p); break;
    case 'books': main = booksMain(p); break;
    case 'articles': main = articlesMain(p); break;
    default:
      main = `<div class="shell band">
  <h1>${esc(p.title)}</h1>
  ${p.lede ? `<p class="lede">${esc(p.lede)}</p>` : ''}
  ${hasBody ? `<div class="prose">${marked.parse(p.body)}</div>` : (DEMO ? filler(p) : pending(p))}
</div>`;
  }

  const html = [
    head(p),
    masthead(p.slug),
    `<main id="main">`,
    main,
    `</main>`,
    p.cta ? ctaBand(p) : '',
    footer(),
  ].join('\n');

  const dir = p.slug === 'home' ? DIST : path.join(DIST, p.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  built++;
}

/* --------------------------------------------------------- extra pages */
const extras = {
  thanks: ['Message sent',
    '<p>Your message is with Terry and he will come back to you.</p>' +
    '<p>Nothing else will be done with your details. If you would rather they were deleted, ' +
    'say so in a reply and they will be.</p>' +
    '<p><a class="more" href="/">Back to the site</a></p>'],
  registered: ['You are on the list',
    '<p>You will get one message, when the course is ready. Nothing else.</p>' +
    '<p>If you change your mind, reply to that message and you will come off the list.</p>' +
    '<p><a class="more" href="/the-course/">See what is in the course</a></p>'],
  404: ['Page not found',
    '<p>That page does not exist, or it has moved.</p>' +
    '<p><a class="more" href="/">Back to the site</a></p>'],
};
for (const [slug, [title, body]] of Object.entries(extras)) {
  const p = { slug, title, lede: '', cta: false };
  const html = [head(p), masthead(''), '<main id="main">',
    `<div class="shell band"><h1>${esc(title)}</h1><div class="prose">${body}</div></div>`,
    '</main>', footer()].join('\n');
  if (slug === '404') fs.writeFileSync(path.join(DIST, '404.html'), html);
  else {
    fs.mkdirSync(path.join(DIST, slug), { recursive: true });
    fs.writeFileSync(path.join(DIST, slug, 'index.html'), html);
  }
}

/* ------------------------------------------------ robots, sitemap, headers */
fs.writeFileSync(path.join(DIST, 'robots.txt'), NOINDEX
  ? 'User-agent: *\nDisallow: /\n'
  : `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);

const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  pages.map((p) => `  <url><loc>${SITE}${href(p)}</loc><lastmod>${today}</lastmod></url>`).join('\n') +
  `\n</urlset>\n`);

/* One source of truth for headers. netlify.toml deliberately does NOT set any,
   because this file has to change with the --live flag and a static toml
   cannot. Note the cache rules: the fonts never change so they are cached for
   a year, but the stylesheet and the script must NOT be, or an update will
   not reach anyone who has visited before. */
fs.writeFileSync(path.join(DIST, '_headers'), `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN
  Permissions-Policy: geolocation=(), microphone=(), camera=(), interest-cohort=()
${NOINDEX ? '  X-Robots-Tag: noindex, nofollow, noarchive\n' : ''}
/assets/fonts/*
  Cache-Control: public, max-age=31536000, immutable

/assets/*.css
  Cache-Control: public, max-age=0, must-revalidate

/assets/*.js
  Cache-Control: public, max-age=0, must-revalidate

/assets/*.png
  Cache-Control: public, max-age=604800

/assets/*.svg
  Cache-Control: public, max-age=604800
`);

console.log(
  `built ${built} pages, ${empty} still waiting for content` +
  `  [${LIVE ? 'LIVE, indexable, analytics on' : 'staging, noindex, no analytics'}${DEMO ? ', placeholder copy filled' : ''}]`
);
