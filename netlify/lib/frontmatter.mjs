/* ---------------------------------------------------------------------------
   Front matter, read and written without losing anything.

   build.mjs parses front matter for its own purposes and is allowed to be
   lossy: it coerces numbers and booleans, strips quotes, and throws the key
   order away, because all it ever does is read. The editor writes, so it
   cannot do any of that. A page saved twice must be byte for byte the page
   that was saved once.

   So this keeps every line exactly as it was found, in the order it was
   found, and changes only the values it is told to change. Keys it has
   never heard of survive untouched, which matters because the next person
   to add a front matter key will not think to come back here.
--------------------------------------------------------------------------- */

const FM = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/* Split a document into its front matter lines and its body.
   Returns { fields, body, eol, hadFrontMatter }.
   fields is an ordered list of { key, value, raw }. A line that is not a
   key: value pair (a comment, a blank line) is kept as { raw } alone and
   is written back where it was. */
export function parse(raw) {
  const text = String(raw ?? '');
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const m = text.match(FM);
  if (!m) return { fields: [], body: text, eol, hadFrontMatter: false };

  const fields = m[1].split(/\r?\n/).map((line) => {
    const i = line.indexOf(':');
    if (i === -1) return { raw: line };
    return {
      key: line.slice(0, i).trim(),
      value: line.slice(i + 1).trim(),
      raw: line,
    };
  });

  return { fields, body: m[2], eol, hadFrontMatter: true };
}

/* Put it back together. Unchanged in means unchanged out. */
export function serialise(doc) {
  const eol = doc.eol || '\n';
  const body = doc.body ?? '';
  if (!doc.hadFrontMatter && (!doc.fields || !doc.fields.length)) return body;
  const lines = (doc.fields || []).map((f) =>
    f.key === undefined ? f.raw : `${f.key}: ${f.value}`
  );
  return `---${eol}${lines.join(eol)}${eol}---${eol}${body}`;
}

/* Read one value, as a string. */
export function get(doc, key) {
  const f = (doc.fields || []).find((x) => x.key === key);
  return f ? f.value : undefined;
}

/* Set one value, in place, keeping its position. A key that is not there
   is appended at the end, which is where a human would have put it. */
export function set(doc, key, value) {
  const v = String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
  const f = (doc.fields || []).find((x) => x.key === key);
  if (f) { f.value = v; f.raw = `${key}: ${v}`; }
  else { doc.fields = doc.fields || []; doc.fields.push({ key, value: v, raw: `${key}: ${v}` }); }
  return doc;
}

/* Everything as a plain object, for handing to the browser. Values stay
   strings; the editor has no business coercing them. */
export function toObject(doc) {
  const out = {};
  for (const f of doc.fields || []) if (f.key !== undefined) out[f.key] = f.value;
  return out;
}

/* The only keys the editor is allowed to write. Everything else is
   structure or layout, which Terry was told he does not control, and
   intent, which is a build note he has already mistaken for copy. */
export const EDITABLE_KEYS = ['title', 'lede'];

/* Apply an edit from the browser. Anything outside EDITABLE_KEYS is
   ignored rather than rejected: a stale studio tab should not be able to
   fail a save, and it should certainly not be able to move a page. */
export function applyEdit(doc, { fields = {}, body } = {}) {
  for (const key of EDITABLE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) set(doc, key, fields[key]);
  }
  if (typeof body === 'string') {
    /* Keep the blank line the file already had between the front matter and
       the first heading. Dropping it would put a one line change into every
       page the first time Terry touched it, and make the history harder to
       read for no reason at all. */
    const lead = /^\n*/.exec(doc.body || '')[0] || '';
    doc.body = lead + body.replace(/\r\n/g, '\n').replace(/^\n+/, '').replace(/\s+$/, '') + '\n';
  }
  return doc;
}
