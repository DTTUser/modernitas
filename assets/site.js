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
