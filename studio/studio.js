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
        edBody.value  = res.d.body || '';

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

  signout.addEventListener('click', function () {
    signout.disabled = true;
    fetch('/api/auth', { method: 'DELETE', credentials: 'same-origin' })
      .catch(function () { /* clearing locally is enough to get back to the gate */ })
      .then(function () { signout.disabled = false; show('gate'); });
  });

  check();
}());
