/* ---------------------------------------------------------------------------
   The only thing in this site that can write to the repository.

   It runs in a Netlify Function, never in the browser, and the token never
   leaves this process. Terry signs in with a password; GitHub is an
   implementation detail he is never told about.

   fetch is injectable so the tests can drive it without a token and without
   touching the network.
--------------------------------------------------------------------------- */

const API = 'https://api.github.com';

export class GitHubError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
    this.body = body;
  }
}

/* Read configuration at call time, not at import time. Netlify sets
   environment variables per invocation, and a module that caches them at
   import will happily serve a deploy that has since been reconfigured. */
export function config(env = process.env) {
  return {
    token: env.GITHUB_TOKEN || '',
    repo: env.GITHUB_REPO || '',
    branch: env.GITHUB_BRANCH || 'main',
  };
}

export function isConfigured(env = process.env) {
  const c = config(env);
  return Boolean(c.token && c.repo);
}

export function client(opts = {}) {
  const { token, repo, branch } = { ...config(opts.env), ...opts };
  const doFetch = opts.fetchImpl || globalThis.fetch;

  async function call(method, url, body) {
    const res = await doFetch(API + url, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'user-agent': 'modernitas-studio',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* not json, keep null */ }

    if (!res.ok) {
      const why = (json && json.message) || res.statusText || 'request failed';
      throw new GitHubError(`${method} ${url}: ${why}`, res.status, json);
    }
    return json;
  }

  const enc = encodeURIComponent;
  const contentsUrl = (p) =>
    `/repos/${repo}/contents/${p.split('/').map(enc).join('/')}`;

  return {
    repo, branch,

    /* Everything in a directory, one level deep. */
    async list(dir) {
      const items = await call('GET', `${contentsUrl(dir)}?ref=${enc(branch)}`);
      if (!Array.isArray(items)) throw new GitHubError(`${dir} is not a directory`, 400, null);
      return items.map((i) => ({ name: i.name, path: i.path, type: i.type, sha: i.sha, size: i.size }));
    },

    /* One file, decoded, with the sha the next write will need. */
    async get(filePath) {
      const f = await call('GET', `${contentsUrl(filePath)}?ref=${enc(branch)}`);
      if (Array.isArray(f) || f.type !== 'file') throw new GitHubError(`${filePath} is not a file`, 400, null);
      return {
        path: f.path,
        sha: f.sha,
        text: Buffer.from(f.content || '', 'base64').toString('utf8'),
      };
    },

    /* One file written, with the sha acting as the stale check: if somebody
       else has changed the file since it was loaded, GitHub returns 409 and
       the save is refused rather than silently overwriting them. */
    async put({ path: filePath, text, sha, message }) {
      return call('PUT', contentsUrl(filePath), {
        message,
        branch,
        sha,
        content: Buffer.from(String(text), 'utf8').toString('base64'),
      });
    },

    async remove({ path: filePath, sha, message }) {
      return call('DELETE', contentsUrl(filePath), { message, branch, sha });
    },

    /* Several files in one commit. Articles need this: an article is an
       entry in articles.data.json and a page, and a half-written pair is a
       broken site. The Contents API cannot do it, so this goes the long way
       round through the git data API. */
    async commitFiles({ files, message }) {
      if (!files || !files.length) throw new GitHubError('nothing to commit', 400, null);

      const ref = await call('GET', `/repos/${repo}/git/ref/heads/${enc(branch)}`);
      const head = ref.object.sha;
      const headCommit = await call('GET', `/repos/${repo}/git/commits/${head}`);

      const tree = [];
      for (const f of files) {
        if (f.delete) { tree.push({ path: f.path, mode: '100644', type: 'blob', sha: null }); continue; }
        const blob = await call('POST', `/repos/${repo}/git/blobs`, {
          content: Buffer.from(String(f.text), 'utf8').toString('base64'),
          encoding: 'base64',
        });
        tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
      }

      const newTree = await call('POST', `/repos/${repo}/git/trees`, {
        base_tree: headCommit.tree.sha, tree,
      });
      const commit = await call('POST', `/repos/${repo}/git/commits`, {
        message, tree: newTree.sha, parents: [head],
      });
      await call('PATCH', `/repos/${repo}/git/refs/heads/${enc(branch)}`, {
        sha: commit.sha, force: false,
      });
      return { sha: commit.sha };
    },

    /* The last few commits touching one file, for the rollback screen. */
    async history(filePath, limit = 10) {
      const commits = await call('GET',
        `/repos/${repo}/commits?path=${enc(filePath)}&sha=${enc(branch)}&per_page=${Number(limit) || 10}`);
      return (commits || []).map((c) => ({
        sha: c.sha,
        date: c.commit?.committer?.date || c.commit?.author?.date || '',
        message: (c.commit?.message || '').split('\n')[0],
      }));
    },

    /* One file as it stood at a given commit, for restoring it. */
    async getAt(filePath, sha) {
      const f = await call('GET', `${contentsUrl(filePath)}?ref=${enc(sha)}`);
      return { path: f.path, text: Buffer.from(f.content || '', 'base64').toString('utf8') };
    },
  };
}
