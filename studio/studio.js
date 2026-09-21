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
    if (which === 'gate') { pwd.value = ''; setTimeout(function () { pwd.focus(); }, 0); }
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

  signout.addEventListener('click', function () {
    signout.disabled = true;
    fetch('/api/auth', { method: 'DELETE', credentials: 'same-origin' })
      .catch(function () { /* clearing locally is enough to get back to the gate */ })
      .then(function () { signout.disabled = false; show('gate'); });
  });

  check();
}());
