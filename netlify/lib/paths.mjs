/* ---------------------------------------------------------------------------
   What the editor is allowed to touch, decided in one place.

   Everything arriving from the browser is a string someone could have typed,
   so nothing is trusted: a path is matched against a pattern, not cleaned up
   and hoped for. content/drafts/ has no pattern, which is how it stays
   invisible. netlify.toml has no pattern either, which is what stops the
   whole site being republished as noindex.
--------------------------------------------------------------------------- */

const PAGE   = /^content\/[A-Za-z0-9][A-Za-z0-9._-]*\.md$/;
const DATA   = /^content\/(articles|books|home)\.data\.json$/;
const IMAGE  = /^assets\/img\/[A-Za-z0-9][A-Za-z0-9._-]*\.(jpe?g|png|webp)$/i;

export const isPage  = (p) => typeof p === 'string' && PAGE.test(p)  && !p.includes('..');
export const isData  = (p) => typeof p === 'string' && DATA.test(p)  && !p.includes('..');
export const isImage = (p) => typeof p === 'string' && IMAGE.test(p) && !p.includes('..');

/* Writable by the editor, full stop. */
export const isWritable = (p) => isPage(p) || isData(p) || isImage(p);

/* A filename fit to commit, made from whatever the picture was called on
   Terry's desktop. */
export function slugifyFilename(name) {
  const s = String(name || '').trim().toLowerCase();
  const dot = s.lastIndexOf('.');
  const ext = dot > 0 ? s.slice(dot + 1).replace(/[^a-z0-9]/g, '') : '';
  const stem = (dot > 0 ? s.slice(0, dot) : s)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'image';
  return ext ? `${stem}.${ext === 'jpeg' ? 'jpg' : ext}` : stem;
}
