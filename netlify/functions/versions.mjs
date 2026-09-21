/* ---------------------------------------------------------------------------
   GET  /api/versions?path=...      the last ten saves of one page
   POST /api/versions { path, sha } put one of them back

   Git gives this away for nothing, which is most of the reason the editor is
   git-backed rather than sitting on a database. Putting a version back is
   itself a save, so nothing is ever destroyed and the trail stays honest:
   the mistake and the correction are both in the history.
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

const fail = (e) => {
  if (e instanceof GitHubError) {
    if (e.status === 404) return json({ error: 'that page is not there' }, 404);
    if (e.status === 409 || e.status === 422)
      return json({ error: 'someone else changed this page while you had it open. Reload and try again.' }, 409);
    return json({ error: 'the site could not be reached just now. Try again in a moment.' }, 502);
  }
  return json({ error: 'something went wrong' }, 500);
};

export default async (req) => {
  if (!requireSession(req)) return json({ error: 'not signed in' }, 401);
  if (!isConfigured()) return json({ error: 'the editor is not configured' }, 503);

  const gh = client();

  if (req.method === 'GET') {
    const wanted = new URL(req.url).searchParams.get('path');
    if (!isPage(wanted)) return json({ error: 'not an editable page' }, 400);
    try {
      const versions = (await gh.history(wanted, 10)).map((c) => ({
        sha: c.sha,
        date: c.date,
        message: c.message,
      }));
      /* The first entry is what is live now, and offering to restore the
         version you are already looking at is just a way of confusing
         somebody. */
      return json({ versions, current: versions.length ? versions[0].sha : null });
    } catch (e) { return fail(e); }
  }

  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  let payload;
  try { payload = await req.json(); } catch { payload = null; }
  if (!payload) return json({ error: 'nothing to restore' }, 400);

  const { path: filePath, sha } = payload;
  if (!isPage(filePath)) return json({ error: 'not an editable page' }, 400);
  if (!sha || typeof sha !== 'string' || !/^[0-9a-f]{7,40}$/i.test(sha))
    return json({ error: 'that version could not be found' }, 400);

  try {
    const old = await gh.getAt(filePath, sha);
    const now = await gh.get(filePath);
    if (old.text === now.text) return json({ unchanged: true, sha: now.sha });

    const doc = FM.parse(old.text);
    const title = FM.get(doc, 'title') || filePath.replace(/^content\//, '');
    const res = await gh.put({
      path: filePath, text: old.text, sha: now.sha,
      message: `Put the ${title} page back to an earlier version`,
    });
    return json({ restored: true, sha: res.content?.sha || null });
  } catch (e) { return fail(e); }
};

export const config = { path: '/api/versions' };
