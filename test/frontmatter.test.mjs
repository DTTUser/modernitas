import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as FM from '../netlify/lib/frontmatter.mjs';

let n = 0, fail = 0;
const t = (name, fn) => { n++; try { fn(); console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '  ->  ' + e.message); } };

const CONTENT = path.join(process.cwd(), 'content');
const files = fs.readdirSync(CONTENT).filter((f) => f.endsWith('.md'));

console.log('\nround trip against the real content');
for (const f of files) {
  t(f + ' survives parse and serialise unchanged', () => {
    const raw = fs.readFileSync(path.join(CONTENT, f), 'utf8');
    assert.equal(FM.serialise(FM.parse(raw)), raw);
  });
}

t('every page still has a title and a slug afterwards', () => {
  for (const f of files) {
    const doc = FM.parse(fs.readFileSync(path.join(CONTENT, f), 'utf8'));
    assert.ok(FM.get(doc, 'title'), f + ' lost its title');
    assert.ok(FM.get(doc, 'slug'), f + ' lost its slug');
  }
});

console.log('\nediting');
const sample = ['---', 'title: About', 'slug: about', 'order: 2', 'inNav: true',
  'lede: Five decades.', '---', '', '## Heading', '', 'Body text.', ''].join('\n');

t('a second save is identical to the first', () => {
  const once = FM.serialise(FM.applyEdit(FM.parse(sample), { fields: { title: 'About Terry' }, body: '## Heading\n\nBody text.' }));
  const twice = FM.serialise(FM.applyEdit(FM.parse(once), { fields: { title: 'About Terry' }, body: '## Heading\n\nBody text.' }));
  assert.equal(twice, once);
});

t('editing the title leaves every other line alone', () => {
  const out = FM.serialise(FM.applyEdit(FM.parse(sample), { fields: { title: 'About Terry' } }));
  assert.ok(out.includes('title: About Terry'));
  for (const line of ['slug: about', 'order: 2', 'inNav: true', 'lede: Five decades.'])
    assert.ok(out.includes(line), 'lost ' + line);
});

t('key order is preserved', () => {
  const out = FM.serialise(FM.applyEdit(FM.parse(sample), { fields: { lede: 'Changed.' } }));
  const keys = out.split('---')[1].trim().split('\n').map((l) => l.split(':')[0]);
  assert.deepEqual(keys, ['title', 'slug', 'order', 'inNav', 'lede']);
});

t('a locked key sent from the browser is ignored', () => {
  const out = FM.parse(FM.serialise(FM.applyEdit(FM.parse(sample),
    { fields: { slug: 'somewhere-else', order: 1, inNav: 'false', layout: 'evil', title: 'Fine' } })));
  assert.equal(FM.get(out, 'slug'), 'about');
  assert.equal(FM.get(out, 'order'), '2');
  assert.equal(FM.get(out, 'inNav'), 'true');
  assert.equal(FM.get(out, 'layout'), undefined);
  assert.equal(FM.get(out, 'title'), 'Fine');
});

t('a newline pasted into the title cannot break the front matter', () => {
  const out = FM.parse(FM.serialise(FM.applyEdit(FM.parse(sample),
    { fields: { title: 'One\nslug: hijacked\ntwo' } })));
  assert.equal(FM.get(out, 'slug'), 'about');
  assert.equal(FM.get(out, 'title'), 'One slug: hijacked two');
});

t('an unknown key is carried through untouched', () => {
  const withNew = sample.replace('lede:', 'somethingNew: keep me\nlede:');
  const out = FM.serialise(FM.applyEdit(FM.parse(withNew), { fields: { title: 'X' } }));
  assert.ok(out.includes('somethingNew: keep me'));
});

t('windows line endings come back as windows line endings', () => {
  const crlf = sample.replace(/\n/g, '\r\n');
  assert.equal(FM.serialise(FM.parse(crlf)), crlf);
});

t('a file with no front matter is left as it is', () => {
  assert.equal(FM.serialise(FM.parse('# Just a body\n')), '# Just a body\n');
});

t('the body always ends with exactly one newline', () => {
  for (const b of ['x', 'x\n', 'x\n\n\n', 'x   \n  \n']) {
    const out = FM.applyEdit(FM.parse(sample), { body: b });
    assert.equal(out.body, 'x\n');
  }
});

t('the editable list is title and lede only', () => {
  assert.deepEqual(FM.EDITABLE_KEYS, ['title', 'lede']);
});

console.log('\n' + (fail ? fail + ' of ' + n + ' FAILED' : 'all ' + n + ' passed'));
process.exit(fail ? 1 : 0);
