/* ---------------------------------------------------------------------------
   POST /api/save   { path, sha, fields, body }

   One page, written to the repository as a commit. Netlify sees the commit
   and rebuilds, so the page is live in about ninety seconds. Terry is told
   that, in those words, and is never told what a commit is.

   The sha is the whole safety story: it is the version of the file the
   studio was looking at when it loaded. If anything has changed since,
   GitHub refuses the write and he is told to reload rather than quietly
   flattening somebody else's work. That somebody is usually Michael.
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

/* A body big enough to be a mistake rather than a page. The longest page on
   the site is well under 20kB. */
const MAX_BODY = 200 * 1024;

/* The commit message is what the rollback screen shows him, so it is
   written for him and not for a developer. */
function messageFor(doc, filePath) {
  const title = FM.get(doc, 'title') || filePath.replace(/^content\//, '');
  return `Edited the ${title} page`;
}

export default async (req) => {
  const session = requireSession(req);
  if (!session) return json({ error: 'not signed in' }, 401);
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  if (!isConfigured()) return json({ error: 'the editor is not configured' }, 503);

  let payload;
  try { payload = await req.json(); } catch { payload = null; }
  if (!payload || typeof payload !== 'object') return json({ error: 'nothing to save' }, 400);

  const { path: filePath, sha, fields, body } = payload;
  if (!isPage(filePath)) return json({ error: 'not an editable page' }, 400);
  if (!sha || typeof sha !== 'string') return json({ error: 'reload the page and try again' }, 400);
  if (typeof body !== 'string') return json({ error: 'nothing to save' }, 400);
  if (body.length > MAX_BODY) return json({ error: 'that page is too long to save' }, 413);

  const gh = client();

  try {
    const file = await gh.get(filePath);

    /* Load, edit, write back. Everything not in EDITABLE_KEYS survives
       exactly as it was, including keys added after this was written. */
    const doc = FM.parse(file.text);
    FM.applyEdit(doc, { fields: fields || {}, body });
    const next = FM.serialise(doc);

    if (next === file.text) return json({ unchanged: true, sha: file.sha });

    /* The sha the studio held, not the one just fetched: using the fresh one
       would defeat the check entirely. */
    const res = await gh.put({
      path: filePath, text: next, sha, message: messageFor(doc, filePath),
    });

    return json({ saved: true, sha: res.content?.sha || null, commit: res.commit?.sha || null });
  } catch (e) {
    if (e instanceof GitHubError) {
      if (e.status === 404) return json({ error: 'that page is not there' }, 404);
      if (e.status === 409 || e.status === 422) {
        return json({ error: 'someone else changed this page while you had it open. Reload and make the change again.' }, 409);
      }
      if (e.status === 401 || e.status === 403) {
        return json({ error: 'the site would not accept the change. Michael needs to look at it.' }, 502);
      }
      return json({ error: 'the change could not be saved just now. Try again in a moment.' }, 502);
    }
    return json({ error: 'something went wrong' }, 500);
  }
};

export const config = { path: '/api/save' };
