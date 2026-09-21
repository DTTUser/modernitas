/* ---------------------------------------------------------------------------
   GET /api/content            the list of pages
   GET /api/content?path=...   one page, split into what Terry may edit and
                               what he may not

   Every request goes through the session guard first. There is no read-only
   mode: if you are not signed in you are not here.
--------------------------------------------------------------------------- */

import { requireSession } from '../lib/session.mjs';
import { client, isConfigured, GitHubError } from '../lib/github.mjs';
import * as FM from '../lib/frontmatter.mjs';
import { isPage } from '../lib/paths.mjs';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

/* The keys the studio shows but will not let him change, so the page can
   say "this is page 2 of the navigation" without offering a box to break
   it in. */
const SHOWN_LOCKED = ['slug', 'nav', 'order', 'layout'];

export default async (req) => {
  if (!requireSession(req)) return json({ error: 'not signed in' }, 401);
  if (req.method !== 'GET') return json({ error: 'method not allowed' }, 405);
  if (!isConfigured()) return json({ error: 'the editor is not configured' }, 503);

  const gh = client();
  const wanted = new URL(req.url).searchParams.get('path');

  try {
    if (!wanted) {
      const files = (await gh.list('content'))
        .filter((f) => f.type === 'file' && isPage(f.path));

      const pages = await Promise.all(files.map(async (f) => {
        const doc = FM.parse((await gh.get(f.path)).text);
        return {
          path: f.path,
          title: FM.get(doc, 'title') || f.name,
          nav: FM.get(doc, 'nav') || FM.get(doc, 'title') || f.name,
          slug: FM.get(doc, 'slug') || '',
          order: Number(FM.get(doc, 'order') ?? 99),
          inNav: FM.get(doc, 'inNav') !== 'false',
        };
      }));

      pages.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
      return json({ pages });
    }

    if (!isPage(wanted)) return json({ error: 'not an editable page' }, 400);

    const file = await gh.get(wanted);
    const doc = FM.parse(file.text);
    const all = FM.toObject(doc);

    const locked = {};
    for (const k of SHOWN_LOCKED) if (all[k] !== undefined) locked[k] = all[k];

    return json({
      path: file.path,
      sha: file.sha,
      fields: { title: all.title ?? '', lede: all.lede ?? '' },
      locked,
      body: doc.body,
    });
  } catch (e) {
    if (e instanceof GitHubError) {
      if (e.status === 404) return json({ error: 'that page is not there' }, 404);
      return json({ error: 'the site could not be read just now' }, 502);
    }
    return json({ error: 'something went wrong' }, 500);
  }
};

export const config = { path: '/api/content' };
