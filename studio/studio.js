import { toHtml, toMarkdown } from '/studio/markdown.mjs';

/* ---------------------------------------------------------------------------
   Studio front end.

   This file knows nothing secret. Every decision that matters is taken on the
   server: the browser asks, the function answers yes or no. All this does is
   show the right half of the page and keep the wording plain.
--------------------------------------------------------------------------- */
(function () {
  'use strict';

  var gate    = document.getElementById('signin');
  var studio  = document.getElementById('studio');
  var form    = document.getElementById('signin-form');
  var pwd     = document.getElementById('password');
  var btn     = document.getElementById('signin-btn');
  var msg     = document.getElementById('signin-msg');
  var signout = document.getElementById('signout');

  function show(which) {
    gate.hidden   = which !== 'gate';
    studio.hidden = which !== 'studio';
    if (which === 'gate') {
      pwd.value = '';
      closePages();
      setTimeout(function () { pwd.focus(); }, 0);
    } else if (!loaded) {
      loaded = true;
      loadList();
    }
  }

  function say(text, ok) {
    msg.textContent = text || '';
    msg.className = ok ? 'msg ok' : 'msg';
  }

  /* Ask the server whether the cookie we may or may not have is still good.
     Never trust anything held in the browser to answer that. */
  function check() {
    return fetch('/api/auth', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (d) { show(d && d.signedIn ? 'studio' : 'gate'); })
      .catch(function () { show('gate'); say('Could not reach the site. Try again in a moment.'); });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!pwd.value) return;
    btn.disabled = true;
    say('Checking…', true);
    fetch('/api/auth', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: pwd.value })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (res.ok && res.d.signedIn) { say(''); show('studio'); return; }
        say((res.d && res.d.error) || 'That did not work.');
        pwd.select();
      })
      .catch(function () { say('Could not reach the site. Try again in a moment.'); })
      .then(function () { btn.disabled = false; });
  });

  /* ------------------------------------------------------------- the pages */

  var list    = document.getElementById('page-list');
  var listMsg = document.getElementById('page-list-msg');
  var empty   = document.getElementById('stage-empty');
  var editor  = document.getElementById('editor');
  var edName  = document.getElementById('ed-name');
  var edChips = document.getElementById('ed-chips');
  var edMsg   = document.getElementById('ed-msg');
  var edTitle = document.getElementById('ed-title');
  var edLede  = document.getElementById('ed-lede');
  var edBody  = document.getElementById('ed-body');
  var edSave  = document.getElementById('ed-save');

  var current = null;   /* the page on screen, with the sha it was loaded at */
  var loaded  = false;  /* the list is fetched once per sign-in, not per click */

  function edSay(text, kind) {
    edMsg.textContent = text || '';
    edMsg.className = 'msg' + (kind ? ' ' + kind : '');
  }

  /* Anything the server sends is somebody's text, so it goes in through
     textContent and value. Nothing here builds HTML from it. */
  function loadList() {
    listMsg.hidden = false;
    listMsg.textContent = 'Loading…';
    list.textContent = '';

    return fetch('/api/content', { credentials: 'same-origin' })
      .then(function (r) {
        if (r.status === 401) { show('gate'); return null; }
        return r.json().then(function (d) { return { ok: r.ok, d: d }; });
      })
      .then(function (res) {
        if (!res) return;
        if (!res.ok) { listMsg.textContent = res.d.error || 'The pages could not be listed.'; return; }
        listMsg.hidden = true;
        res.d.pages.forEach(function (p) {
          var li = document.createElement('li');
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'page-btn';
          b.textContent = p.nav || p.title;
          b.setAttribute('data-path', p.path);
          if (!p.inNav) {
            var tag = document.createElement('span');
            tag.className = 'tag';
            tag.textContent = 'not in the menu';
            b.appendChild(tag);
          }
          b.addEventListener('click', function () { openPage(p.path, b); });
          li.appendChild(b);
          list.appendChild(li);
        });
        if (!res.d.pages.length) { listMsg.hidden = false; listMsg.textContent = 'No pages found.'; }
      })
      .catch(function () { listMsg.textContent = 'Could not reach the site. Try again in a moment.'; });
  }

  function openPage(path, button) {
    Array.prototype.forEach.call(list.querySelectorAll('.page-btn'), function (b) {
      b.classList.toggle('on', b === button);
    });
    edSay('Loading…');
    empty.hidden = true;
    editor.hidden = false;

    fetch('/api/content?path=' + encodeURIComponent(path), { credentials: 'same-origin' })
      .then(function (r) {
        if (r.status === 401) { show('gate'); return null; }
        return r.json().then(function (d) { return { ok: r.ok, d: d }; });
      })
      .then(function (res) {
        if (!res) return;
        if (!res.ok) { edSay(res.d.error || 'That page could not be opened.', 'bad'); return; }
        current = { path: res.d.path, sha: res.d.sha };
        edSay('');
        edName.textContent = res.d.fields.title || res.d.path;
        edTitle.value = res.d.fields.title || '';
        edLede.value  = res.d.fields.lede  || '';
        edBody.innerHTML = toHtml(res.d.body || '');
        dirty = false;
        edSave.disabled = true;

        /* The locked keys are shown so he can see what a page is without
           being offered a box to break it in. */
        edChips.textContent = '';
        var locked = res.d.locked || {};
        [['Address', locked.slug ? '/' + (locked.slug === 'home' ? '' : locked.slug + '/') : ''],
         ['In the menu as', locked.nav],
         ['Position', locked.order]].forEach(function (pair) {
          if (!pair[1] && pair[1] !== 0) return;
          var chip = document.createElement('span');
          chip.className = 'chip';
          chip.textContent = pair[0] + ': ' + pair[1];
          edChips.appendChild(chip);
        });
      })
      .catch(function () { edSay('Could not reach the site. Try again in a moment.', 'bad'); });
  }

  function closePages() {
    loaded = false;
    current = null;
    list.textContent = '';
    editor.hidden = true;
    empty.hidden = false;
  }

  /* ------------------------------------------------------------- formatting */

  var dirty = false;

  function markDirty() {
    if (!current) return;
    dirty = true;
    edSave.disabled = false;
    if (edMsg.textContent === 'Saved.') edSay('');
  }

  /* execCommand is deprecated and has no replacement. For one person editing
     one small site it is still the shortest path to a Bold button that works
     in every browser he might open, and everything it produces is thrown
     through the serialiser on the way out, so its untidiness never reaches
     the repository. */
  function exec(cmd, value) {
    edBody.focus();
    try { document.execCommand(cmd, false, value); } catch (e) { /* nothing to do */ }
    markDirty();
  }

  function setBlock(tag) {
    /* Leaving a quote is a separate action from changing the heading level,
       because formatBlock cannot take you out of a blockquote on its own. */
    if (tag !== 'blockquote') {
      var q = document.queryCommandState ? null : null;
      try { if (document.queryCommandValue('formatBlock').toLowerCase() === 'blockquote')
        document.execCommand('outdent'); } catch (e) { /* nothing to do */ }
    }
    exec('formatBlock', tag === 'p' ? '<p>' : '<' + tag + '>');
  }

  Array.prototype.forEach.call(document.querySelectorAll('.toolbar button'), function (b) {
    b.addEventListener('mousedown', function (e) { e.preventDefault(); });
    b.addEventListener('click', function () {
      var cmd = b.getAttribute('data-cmd');
      var block = b.getAttribute('data-block');
      if (block) return setBlock(block);
      if (cmd === 'link') return openLinkBar();
      exec(cmd);
    });
  });

  /* ------------------------------------------------------------------ links */

  var linkbar = document.getElementById('linkbar');
  var linkUrl = document.getElementById('link-url');
  var savedRange = null;

  function currentLink() {
    var sel = window.getSelection();
    if (!sel || !sel.anchorNode) return null;
    var n = sel.anchorNode;
    while (n && n !== edBody) {
      if (n.nodeType === 1 && n.nodeName === 'A') return n;
      n = n.parentNode;
    }
    return null;
  }

  function openLinkBar() {
    var sel = window.getSelection();
    savedRange = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    var a = currentLink();
    linkUrl.value = a ? a.getAttribute('href') : '';
    linkbar.hidden = false;
    linkUrl.focus();
    linkUrl.select();
  }

  function closeLinkBar() { linkbar.hidden = true; savedRange = null; }

  function restoreSelection() {
    if (!savedRange) return false;
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
    return true;
  }

  document.getElementById('link-apply').addEventListener('click', function () {
    var url = linkUrl.value.trim();
    if (!url) return;
    /* A bare domain typed without a scheme would otherwise be read as a path
       on this site and quietly 404. */
    if (!/^(https?:|mailto:|\/|#)/i.test(url)) url = 'https://' + url;
    edBody.focus();
    if (restoreSelection()) exec('createLink', url);
    closeLinkBar();
  });

  document.getElementById('link-remove').addEventListener('click', function () {
    edBody.focus();
    if (restoreSelection()) exec('unlink');
    closeLinkBar();
  });

  document.getElementById('link-cancel').addEventListener('click', function () {
    edBody.focus(); restoreSelection(); closeLinkBar();
  });

  linkUrl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); document.getElementById('link-apply').click(); }
    if (e.key === 'Escape') { e.preventDefault(); document.getElementById('link-cancel').click(); }
  });

  /* ------------------------------------------------------------------ paste */

  /* Everything arrives as plain words. Terry's most likely source is Word,
     and a Word paste carries its own typefaces, colours and sizes with it.
     Letting those in is exactly the drift the site is built to prevent, so
     the formatting is dropped at the door and the buttons put it back. */
  edBody.addEventListener('paste', function (e) {
    e.preventDefault();
    var text = (e.clipboardData || window.clipboardData).getData('text/plain');
    if (!text) return;
    var html = toHtml(text);
    try { document.execCommand('insertHTML', false, html); }
    catch (err) { document.execCommand('insertText', false, text); }
    markDirty();
  });

  edBody.addEventListener('input', markDirty);

  edBody.addEventListener('keydown', function (e) {
    var meta = e.metaKey || e.ctrlKey;
    if (meta && e.key.toLowerCase() === 'b') { e.preventDefault(); exec('bold'); }
    if (meta && e.key.toLowerCase() === 'i') { e.preventDefault(); exec('italic'); }
    if (meta && e.key.toLowerCase() === 'k') { e.preventDefault(); openLinkBar(); }
  });

  [edTitle, edLede].forEach(function (el) { el.addEventListener('input', markDirty); });

  /* ---------------------------------------------------------------- saving */

  function pendingEdit() {
    return {
      path: current && current.path,
      sha: current && current.sha,
      fields: { title: edTitle.value, lede: edLede.value },
      body: toMarkdown(edBody)
    };
  }
  window.__pendingEdit = pendingEdit;   /* used by the tests, harmless here */

  edSave.addEventListener('click', function () {
    if (!current) return;
    edSave.disabled = true;
    edSay('Saving\u2026');

    fetch('/api/save', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(pendingEdit())
    })
      .then(function (r) {
        if (r.status === 401) { show('gate'); return null; }
        return r.json().then(function (d) { return { ok: r.ok, status: r.status, d: d }; });
      })
      .then(function (res) {
        if (!res) return;
        if (!res.ok) {
          edSay(res.d.error || 'That could not be saved.', 'bad');
          edSave.disabled = false;
          return;
        }
        if (res.d.unchanged) { dirty = false; edSay('Nothing had changed.'); return; }

        /* The new sha becomes the version this tab is holding, so he can go
           on editing and save again without reloading. */
        current.sha = res.d.sha || current.sha;
        dirty = false;
        edName.textContent = edTitle.value || edName.textContent;
        edSay('Saved. The site updates itself in a minute or two.', 'ok');
        refreshNavName(current.path, edTitle.value);
      })
      .catch(function () {
        edSay('Could not reach the site. Nothing was saved. Try again in a moment.', 'bad');
        edSave.disabled = false;
      });
  });

  /* If the title changed, the list on the left is now telling him something
     that is not true. */
  function refreshNavName(path, title) {
    var b = list.querySelector('.page-btn[data-path="' + path + '"]');
    if (!b) return;
    var tag = b.querySelector('.tag');
    b.textContent = title;
    if (tag) b.appendChild(tag);
  }

  /* Losing an afternoon's typing to a stray click on Sign out is the kind of
     thing that ends an experiment like this. */
  window.addEventListener('beforeunload', function (e) {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = '';
  });

  signout.addEventListener('click', function () {
    if (dirty && !window.confirm('You have changes that are not saved. Sign out anyway?')) return;
    dirty = false;
    signout.disabled = true;
    fetch('/api/auth', { method: 'DELETE', credentials: 'same-origin' })
      .catch(function () { /* clearing locally is enough to get back to the gate */ })
      .then(function () { signout.disabled = false; show('gate'); });
  });

  check();
}());
