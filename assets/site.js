/* ---------------------------------------------------------------------------
   modernitas.co.uk

   Two small things, both progressive enhancements. With JavaScript switched
   off the navigation is a plain list of links and the tab strip shows every
   panel stacked in order. Nothing is lost, it is only tidier with it on.
--------------------------------------------------------------------------- */
(function () {
  'use strict';

  /* ------------------------------------------------------ mobile navigation */
  var toggle = document.querySelector('.navtoggle');
  var nav = document.getElementById('nav');

  if (toggle && nav) {
    // Only reveal the button once we know scripting is available, otherwise a
    // no-JS visitor gets a button that does nothing.
    toggle.hidden = false;
    document.documentElement.classList.add('has-js');

    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      nav.classList.toggle('is-open', !open);
    });

    // Close on Escape, and put focus back where it came from.
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (toggle.getAttribute('aria-expanded') !== 'true') return;
      toggle.setAttribute('aria-expanded', 'false');
      nav.classList.remove('is-open');
      toggle.focus();
    });

    // Reset state when the viewport goes back to desktop width.
    var wide = window.matchMedia('(min-width: 861px)');
    var reset = function () {
      if (!wide.matches) return;
      toggle.setAttribute('aria-expanded', 'false');
      nav.classList.remove('is-open');
    };
    wide.addEventListener ? wide.addEventListener('change', reset)
                          : wide.addListener(reset);
  }

  /* -------------------------------------------------- main menu drop-downs */
  var groups = Array.prototype.slice.call(document.querySelectorAll('.nav__group'));
  var openable = [];

  function closeAll(except) {
    openable.forEach(function (g) {
      if (g === except) return;
      g.btn.setAttribute('aria-expanded', 'false');
      g.panel.hidden = true;
    });
  }

  groups.forEach(function (g) {
    var btn = g.querySelector('.nav__more');
    var panel = btn && document.getElementById(btn.getAttribute('aria-controls'));
    if (!btn || !panel) return;

    // Only offer the button now that we know scripting is on.
    btn.hidden = false;
    var entry = { btn: btn, panel: panel };
    openable.push(entry);

    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') === 'true';
      closeAll(entry);
      btn.setAttribute('aria-expanded', String(!open));
      panel.hidden = open;
    });
  });

  if (openable.length) {
    document.addEventListener('click', function (e) {
      if (!e.target.closest || !e.target.closest('.nav__group')) closeAll(null);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAll(null);
    });
  }

  /* --------------------------------------------------------- build notes */
  var notesBtn = document.querySelector('.notesbtn');
  if (notesBtn) {
    notesBtn.addEventListener('click', function () {
      var on = document.body.classList.toggle('notes-on');
      notesBtn.setAttribute('aria-pressed', String(on));
      notesBtn.textContent = on ? 'Hide build notes' : 'Show build notes';
      if (!on) return;
      var notes = document.getElementById('notes');
      if (notes) notes.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  /* ------------------------------------------------------------------ tabs */
  var lists = document.querySelectorAll('[role="tablist"]');

  Array.prototype.forEach.call(lists, function (list) {
    var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
    if (!tabs.length) return;

    document.documentElement.classList.add('has-tabs');

    var show = function (i, focus) {
      tabs.forEach(function (t, j) {
        var selected = i === j;
        t.setAttribute('aria-selected', String(selected));
        t.setAttribute('tabindex', selected ? '0' : '-1');
        var panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !selected;
      });
      if (focus) tabs[i].focus();
    };

    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { show(i); });
      t.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (d) {
          e.preventDefault();
          show((i + d + tabs.length) % tabs.length, true);
          return;
        }
        if (e.key === 'Home') { e.preventDefault(); show(0, true); }
        if (e.key === 'End') { e.preventDefault(); show(tabs.length - 1, true); }
      });
    });

    show(0);
  });
})();
