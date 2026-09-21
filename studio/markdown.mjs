/* ---------------------------------------------------------------------------
   Markdown in, markdown out, with an editable page in between.

   Terry is never shown a hash or an asterisk. He sees a heading that looks
   like a heading and presses a button marked Bold. So the studio converts
   his markdown to HTML on the way in and back to markdown on the way out,
   and the only thing that really matters is that those two are exact
   inverses: a page saved twice without being touched must be the page that
   was there before.

   That is why this handles a deliberately small subset, and flattens
   anything else to plain text rather than guessing. The subset is what his
   pages actually use: headings, paragraphs, quotes, lists, bold, italics,
   links and pictures. Anything a browser sneaks in, a pasted span with a
   font on it, is thrown away on the way out, which is the behaviour you
   want from a tool whose job is to stop a site drifting.
--------------------------------------------------------------------------- */

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ------------------------------------------------------------------ inline */

/* A backslash escape is lifted out before anything is parsed and put back
   afterwards, so a literal asterisk stays a literal asterisk and does not
   turn into italics the next time the page is opened. Without this the
   escaping compounds: one save writes \\*, the next writes \\\\*, and by the
   fourth the page is full of backslashes. */
const MARK = '\u0000';

function inlineToHtml(text) {
  const held = [];
  let s = String(text).replace(/\\([\\*[\]])/g, (_, ch) => {
    held.push(ch);
    return MARK + (held.length - 1) + MARK;
  });

  s = esc(s);
  /* Pictures before links: the syntax differs by one character. */
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g,
    (_, alt, src) => `<img src="${encodeURI(src)}" alt="${alt}">`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_, txt, href) => `<a href="${encodeURI(href)}">${txt}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');

  return s.replace(new RegExp(MARK + '(\\d+)' + MARK, 'g'), (_, i) => esc(held[Number(i)]));
}

/* ------------------------------------------------------------ markdown in */

export function toHtml(markdown) {
  const lines = String(markdown ?? '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;

  const isBlank = (l) => !l || !l.trim();

  while (i < lines.length) {
    const line = lines[i];

    if (isBlank(line)) { i++; continue; }

    let m;
    if ((m = line.match(/^(#{2,4})\s+(.*)$/))) {
      const level = m[1].length;
      out.push(`<h${level}>${inlineToHtml(m[2].trim())}</h${level}>`);
      i++; continue;
    }

    if (/^>\s?/.test(line)) {
      const inner = [];
      while (i < lines.length && (/^>\s?/.test(lines[i]) || (inner.length && !isBlank(lines[i])))) {
        inner.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${toHtml(inner.join('\n'))}</blockquote>`);
      continue;
    }

    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const ordered = /^\d+\.\s+/.test(line);
      const re = ordered ? /^\d+\.\s+/ : /^[-*]\s+/;
      const items = [];
      while (i < lines.length && re.test(lines[i])) {
        items.push(`<li>${inlineToHtml(lines[i].replace(re, '').trim())}</li>`);
        i++;
      }
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }

    /* A paragraph runs until a blank line or the start of another block. */
    const para = [];
    while (i < lines.length && !isBlank(lines[i])
           && !/^(#{2,4}\s|>\s?|[-*]\s|\d+\.\s)/.test(lines[i])) {
      para.push(lines[i].trim());
      i++;
    }
    if (para.length) out.push(`<p>${inlineToHtml(para.join(' '))}</p>`);
  }

  return out.join('\n');
}

/* ----------------------------------------------------------- markdown out */

const BLOCK = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'BLOCKQUOTE', 'UL', 'OL', 'LI', 'FIGURE', 'PRE', 'SECTION', 'ARTICLE']);

/* Nothing inside these ever becomes page copy. innerHTML does not run a
   script, so this is not what stops one running, but the contents of a
   pasted script or stylesheet should not be committed to the repository as
   Terry's words either. */
const DROP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'IFRAME',
  'OBJECT', 'EMBED', 'HEAD', 'META', 'LINK', 'TITLE']);

/* Escape only what would actually be read back as formatting, and nothing
   else. Escaping every bracket turns a plain aside like [TERRY: ...] into
   \\[TERRY: ...\\], which is both ugly and wrong, so a bracket is escaped
   only where it would form a link. */
const escapeMd = (s) => String(s)
  .replace(/\\/g, '\\\\')
  .replace(/\*/g, '\\*')
  .replace(/\[([^\]\n]*)\]\(/g, '\\[$1\\](');

function inlineToMd(node, opts = {}) {
  let out = '';
  for (const child of node.childNodes || []) {
    if (child.nodeType === 3) {
      out += (opts.raw ? child.nodeValue : escapeMd(child.nodeValue))
        .replace(/ /g, ' ');
      continue;
    }
    if (child.nodeType !== 1) continue;

    const tag = child.nodeName.toUpperCase();
    if (DROP.has(tag)) continue;
    const inner = () => inlineToMd(child, opts);

    if (tag === 'BR') { out += '\n'; continue; }
    if (tag === 'IMG') {
      const src = child.getAttribute('src') || '';
      const alt = child.getAttribute('alt') || '';
      out += `![${alt}](${src})`;
      continue;
    }
    if (tag === 'A') {
      const href = child.getAttribute('href') || '';
      const text = inner().trim();
      out += href && text ? `[${text}](${href})` : text;
      continue;
    }
    if (tag === 'STRONG' || tag === 'B') {
      const t = inner().trim();
      out += t ? `**${t}**` : '';
      continue;
    }
    if (tag === 'EM' || tag === 'I') {
      const t = inner().trim();
      out += t ? `*${t}*` : '';
      continue;
    }
    /* Anything else, a pasted span with a typeface on it, keeps its words
       and loses its decoration. That is the point. */
    out += inner();
  }
  return out;
}

const tidy = (s) => s.replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();

function blocksToMd(node, depth = 0) {
  const parts = [];
  const kids = Array.from(node.childNodes || []);

  /* Loose text sitting directly in the editable, which is what a browser
     leaves behind when everything is deleted and something is typed. */
  let loose = [];
  const flushLoose = () => {
    if (!loose.length) return;
    const text = tidy(loose.map((n) => inlineToMd({ childNodes: [n] })).join(''));
    if (text) parts.push(text);
    loose = [];
  };

  for (const child of kids) {
    if (child.nodeType === 3) {
      if (child.nodeValue.trim()) loose.push(child);
      continue;
    }
    if (child.nodeType !== 1) continue;

    const tag = child.nodeName.toUpperCase();
    if (DROP.has(tag)) continue;
    if (!BLOCK.has(tag)) { loose.push(child); continue; }
    flushLoose();

    if (/^H[1-6]$/.test(tag)) {
      /* h1 belongs to the page title, never the body, so anything that
         claims to be one is demoted rather than allowed to compete. */
      const level = Math.min(Math.max(Number(tag[1]), 2), 4);
      const t = tidy(inlineToMd(child));
      if (t) parts.push('#'.repeat(level) + ' ' + t.replace(/\n/g, ' '));
      continue;
    }
    if (tag === 'BLOCKQUOTE') {
      const inner = blocksToMd(child, depth + 1);
      if (inner) parts.push(inner.split('\n').map((l) => (l ? '> ' + l : '>')).join('\n'));
      continue;
    }
    if (tag === 'UL' || tag === 'OL') {
      const ordered = tag === 'OL';
      const items = Array.from(child.childNodes || [])
        .filter((li) => li.nodeType === 1 && li.nodeName.toUpperCase() === 'LI')
        .map((li, n) => {
          const t = tidy(inlineToMd(li)).replace(/\n/g, ' ');
          return t ? `${ordered ? n + 1 + '.' : '-'} ${t}` : '';
        })
        .filter(Boolean);
      if (items.length) parts.push(items.join('\n'));
      continue;
    }
    if (tag === 'DIV' || tag === 'SECTION' || tag === 'ARTICLE' || tag === 'FIGURE') {
      /* A wrapper the browser invented. Look inside it; if it holds only
         inline content, treat it as the paragraph it is standing in for. */
      const hasBlocks = Array.from(child.childNodes || [])
        .some((n) => n.nodeType === 1 && BLOCK.has(n.nodeName.toUpperCase()));
      const inner = hasBlocks ? blocksToMd(child, depth) : tidy(inlineToMd(child));
      if (inner) parts.push(inner);
      continue;
    }
    /* P and anything left */
    const t = tidy(inlineToMd(child));
    if (t) parts.push(t);
  }
  flushLoose();

  return parts.join('\n\n');
}

/* Takes the editable element itself. */
export function toMarkdown(root) {
  const md = blocksToMd(root);
  return md ? md.replace(/\n{3,}/g, '\n\n').trim() + '\n' : '';
}
