# modernitas.co.uk

Static site. No framework, no build dependencies beyond `marked`.

```
npm install
node build.mjs     # writes dist/
```

## Changing the skin

Terry picks A, B or C. Change one line in `assets/tokens.css`:

```css
@import url("skin-a.css");
```

That is the whole job. No template, no component and no page refers to a
colour, a typeface or a spacing value directly. Everything reads a custom
property defined in the skin file.

- `skin-a.css` — Reading Room. Warm editorial, Newsreader and Source Sans 3.
- `skin-b.css` — Plain English. Public Sans, white, slate blue. Closest to Aptos.
- `skin-c.css` — Blueprint. Space Grotesk and IBM Plex, dark bands, hairline grid.

If he likes A but wants B's blue, change `--accent` in `skin-a.css`. That is
also a one-line job.

## Adding content

One markdown file per page in `content/`. Front matter drives the nav:

```yaml
---
title: About
slug: about
nav: About
order: 2
intent: What this page is for. Notes only, never rendered.
lede: The sentence under the heading.
cta: true          # show the register band at the foot
inNav: true        # show in the main menu
---

Terry's text goes here as ordinary markdown.
```

A page with front matter and no body renders a "waiting for its content"
panel naming the document still needed. That is deliberate: the site is
navigable from day one and the gaps are visible without anybody chasing.

The home page is composed rather than written, so its content lives in
`content/home.data.json`. The course page has the tab strip. Everything else
is a plain document page.

## Forms

Two, both Netlify Forms, both with a honeypot field and no CAPTCHA.

- `register` — the email band at the foot of most pages.
- `enquiry` — name, email, message, on the contact page.

Both post to `/thanks/`. Set the notification address in the Netlify UI:
Forms, then Settings, then Form notifications. Deliver to an address on
modernitas.co.uk and forward to itmit2025@gmail.com, so the enquiry record
stays with the domain rather than only with Terry's inbox.

## What is deliberately not here

- No cookie banner. Analytics will be cookieless, so none is needed.
- No JavaScript except the tab strip, which degrades to the first panel.
- No image assets yet. Terry has not sent his photograph or the book covers.

## Still to do

- Terry's seven content documents.
- His page, download or drop verdict on the seventeen PDFs.
- Photograph and book covers.
- Analytics snippet once an account exists.
- Point the IONOS DNS at Netlify. Ten minute job, last step.
