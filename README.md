# modernitas.co.uk

Static site. No framework. One dependency (`marked`) for the markdown.

```
npm install
node build.mjs --demo    # staging, placeholder copy filled in
node build.mjs           # staging, honest empty states
node build.mjs --live    # the real thing
```

Output goes to `dist/`. Netlify is configured to run `node build.mjs` and
publish `dist`, so a push is a deploy.

---

## The launch switch

`--live` is the only thing standing between staging and a public site.

| | without `--live` | with `--live` |
|---|---|---|
| `<meta name="robots">` | `noindex, nofollow` | absent |
| `robots.txt` | `Disallow: /` | `Allow: /` plus sitemap |
| `_headers` | adds `X-Robots-Tag: noindex` | no such header |
| Analytics | not emitted | Plausible snippet |

Until launch day the build command stays as it is, so the staging address on
`netlify.app` cannot end up in Google ahead of the real domain. On launch day,
change the build command in `netlify.toml` to `node build.mjs --live` and push.
That is the whole cutover.

---

## The skin

Terry chose **B** on 1 September 2026. The switch is one line in
`assets/tokens.css`:

```css
@import url("skin-b.css");
```

- `skin-a.css` — Reading Room. Warm editorial, Newsreader and Source Sans 3.
- `skin-b.css` — Plain English. Public Sans, white, slate blue. **In use.**
- `skin-c.css` — Blueprint. Space Grotesk and IBM Plex, dark bands.

No template, component or page refers to a colour, a typeface or a spacing
value directly. Everything reads a custom property defined in the skin file.
If he likes B but wants a different blue, change `--accent` in `skin-b.css`.

Every colour pair in skin B was checked against WCAG AA. The lowest ratio in
the palette is 4.57:1, against a requirement of 4.5:1.

### The typeface is served from this site, not from Google

`assets/fonts/` holds five woff2 files, 84KB in total. They are declared in
`skin-b.css` and preloaded in the page head.

This is deliberate. A request to Google's font CDN sends the visitor's IP
address to Google, which drags a deliberately cookie-free site back into
consent territory for no benefit at all. Self-hosting is also faster. Do not
"tidy this up" by switching back to the `@import` from fonts.googleapis.com.

---

## Adding and filling pages

One markdown file per page in `content/`. Front matter drives everything:

```yaml
---
title: About
slug: about
nav: About
order: 2
layout: document       # see below
intent: What this page is for. Notes only, never rendered.
lede: The sentence under the heading.
cta: true              # show the register band at the foot
inNav: true            # show in the main menu
---

Terry's text goes here as ordinary markdown.
```

### Layouts

| `layout:` | Used by | Content comes from |
|---|---|---|
| `home` | the front page | `content/home.data.json` |
| `tabs` | The Course | the markdown body, plus the modules and audience from `home.data.json` |
| `books` | Books | `content/books.data.json` |
| `articles` | Articles | `content/articles.data.json` |
| `contact` | Contact | the markdown body, plus the enquiry form |
| `document` | everything else, and the default | the markdown body |

A `document` page with front matter and no body renders a "waiting for its
content" panel naming the document still needed. That is on purpose: the site
is navigable from day one and the gaps are visible without anybody chasing.

### Placeholder copy

`--demo` fills empty pages with placeholder prose so the design can be judged
at a realistic weight. It is not lorem ipsum. It is in English and every
paragraph says PLACEHOLDER, so there is no way it reaches the live site
unnoticed. A `--live` build never emits it.

---

## Data files

- `content/home.data.json` — the composed front page.
- `content/books.data.json` — three titles with ISBNs, as Terry sent them on
  31 August. Years and blurbs are deliberately blank: he supplies those.
  Do not guess them.
- `content/articles.data.json` — **provisional**, scaffolded from his Wix site
  so he only has to confirm rather than start from nothing. Each entry needs a
  verdict: `page` (we rebuild it here), `download` (stays a PDF) or `link`
  (published on someone else's site, so it stays an outbound link because the
  publisher owns the posting). Every Google Drive link on the Wix site was
  dead when checked on 1 September 2026, so `href` is blank until he sends the
  actual files.

---

## Images

Nothing has arrived yet. Wherever an image belongs, the build renders a dashed
`.imgslot` placeholder saying what is missing:

- Terry's photograph, on the front page and the About page.
- Three book covers. Drop them in `assets/covers/` and put the filename in the
  `cover` field in `books.data.json`.

`assets/og.png` is the social sharing card and `assets/favicon.svg` the tab
icon. Both are placeholders of my making and can be replaced.

---

## Forms

Two, both Netlify Forms, both with a honeypot and no CAPTCHA. Both are already
registered on the Netlify project and both have been tested end to end.

| Form | Where | Fields | Confirmation |
|---|---|---|---|
| `register` | the email band at the foot of most pages | email, page | `/registered/` |
| `enquiry` | the contact page | name, email, message, page | `/thanks/` |

The hidden `page` field records which page the person was on when they
submitted. It costs nothing and it is the only way to tell which page is
actually doing the persuading. Without it every registration looks identical.

The two confirmations say different things on purpose. Somebody who registered
interest has been promised one message and needs telling how to get off the
list. Somebody who sent an enquiry has not joined anything.

### Still to set, and it needs Terry

**Notification address.** Netlify UI: Forms, Settings, Form notifications.
Point it at an address on modernitas.co.uk and forward from there to
itmit2025@gmail.com, so the enquiry record stays with the domain rather than
only with his inbox. That needs a mailbox or a forwarder at IONOS, which is
his to create. Until then, point notifications at Michael so nothing is lost
during the build.

**Custom subject line**, on the same settings page. Worth doing: the default
is easy to miss in a busy inbox.

### What Netlify Forms is not

It stores submissions and emails a notification. It cannot send anything to
the list. So when the course launches and Terry wants to email everybody who
registered, that is a separate job: export the CSV from Netlify and import it
into a mailing tool that handles unsubscribes properly.

There is no point setting that up now. The export takes five minutes on the
day, and until there is a list worth mailing it is a subscription paying for
nothing. But it should not be a surprise on launch day, because "just BCC
them all from Gmail" is not a lawful way to run a marketing list and will get
the domain's mail reputation damaged into the bargain.

**Volume.** Netlify has moved to credit-based pricing and form submissions are
metered. The current free allowance was not something I could pin down from
their public pages, so check it in the account before launch. At the volumes
this site will see it is very unlikely to matter. A spam flood is the case
that would, which is what the honeypot is for.

---

## JavaScript

`assets/site.js`, about eighty lines, deferred. Two things, both progressive
enhancements:

- The mobile menu. Without JS the navigation is a plain list of links.
- The tab strip on the course page. Without JS every panel shows, stacked and
  headed, which is a perfectly good page. The strip only appears once the
  script has run, so nobody is offered a control that does nothing.

Tabs support arrow keys, Home and End, and manage `tabindex` properly.

---

## What is checked, and how

`verify.mjs` in the parent folder runs a headless browser over the built site
and asserts seventeen things: tabs with and without JS, keyboard control, the
mobile menu opening and closing, no horizontal overflow, that the font really
loads from our own server, that the page makes zero third-party requests, that
every internal link resolves, and that the console is clean.

```
cd dist && python3 -m http.server 8765 &
node ../verify.mjs
```

Run it before any deploy that matters.

---

## Deliberately not here

- No cookie banner. Analytics are cookieless and nothing else sets one. This
  is a property of the build, not an oversight, and it survives only as long
  as nobody adds a third-party script.
- No image assets. See above.
- No pricing or buy button. The course page ends at "register your interest"
  until Terry and OBS have settled how people actually purchase.

## Still to do

- Terry's seven content documents.
- His page, download or drop verdict on the articles and PDFs.
- Photograph and book covers.
- A Plausible account, if he wants analytics.
- Point the IONOS DNS at Netlify. Ten minute job, last step.
- Change the Netlify build command to `node build.mjs --live` on launch day.
