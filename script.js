/* ============================================================
   script.js — johnsonmugarra.com
   ------------------------------------------------------------
   Loaded with `defer`, so the DOM is parsed before any of this
   runs and there is no DOMContentLoaded wrapper.

   Layout-reading work (scroll position, section offsets) is
   batched into a single rAF-throttled scroll handler. Anything
   that can be done with IntersectionObserver is.
   ============================================================ */
'use strict';

(() => {
  const root = document.documentElement;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  /* ── Analytics ─────────────────────────────────────────────
     Declared first: everything below calls it. GTM is loaded in
     the head, so dataLayer exists even before gtag does.
  ──────────────────────────────────────────────────────────── */
  function trackEvent(name, params = {}) {
    if (typeof window.gtag === 'function') window.gtag('event', name, params);
    else if (Array.isArray(window.dataLayer)) window.dataLayer.push({ event: name, ...params });
  }

  /* ── Theme ─────────────────────────────────────────────────
     The initial theme is resolved by an inline script in <head>
     so there is no flash. This only handles later changes.
  ──────────────────────────────────────────────────────────── */
  const THEME_KEY = 'jm-theme';

  const ICON_MOON = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
  const ICON_SUN = [
    '<circle cx="12" cy="12" r="5"/>',
    '<line x1="12" y1="1" x2="12" y2="3"/>',
    '<line x1="12" y1="21" x2="12" y2="23"/>',
    '<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>',
    '<line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>',
    '<line x1="1" y1="12" x2="3" y2="12"/>',
    '<line x1="21" y1="12" x2="23" y2="12"/>',
    '<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>',
    '<line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
  ].join('');

  function applyTheme(theme) {
    const isLight = theme === 'light';
    root.setAttribute('data-theme', theme);
    root.classList.toggle('dark', !isLight);

    const label = isLight ? 'Switch to dark mode' : 'Switch to light mode';
    const icon = isLight ? ICON_MOON : ICON_SUN;

    [
      [$('#theme-toggle'), $('#theme-icon')],
      [$('#mob-theme-toggle'), $('#mob-theme-icon')],
    ].forEach(([button, iconEl]) => {
      if (button) button.setAttribute('aria-label', label);
      if (iconEl) iconEl.innerHTML = icon;
    });

    const mobLabel = $('#mob-theme-label');
    if (mobLabel) mobLabel.textContent = isLight ? 'Dark mode' : 'Light mode';

    /* charts.js listens for this and repaints its axis inks. */
    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
  }

  function toggleTheme() {
    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* private mode: the choice just will not persist */
    }
    trackEvent('theme_change', { theme: next });
  }

  applyTheme(root.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
  $('#theme-toggle')?.addEventListener('click', toggleTheme);
  $('#mob-theme-toggle')?.addEventListener('click', toggleTheme);

  /* Follow the OS only while the visitor has not made a choice. */
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
    let stored = null;
    try {
      stored = localStorage.getItem(THEME_KEY);
    } catch {
      /* ignore */
    }
    if (!stored) applyTheme(event.matches ? 'dark' : 'light');
  });

  /* ── Scroll: progress bar and max depth, in one handler ──── */
  const progressBar = $('#progress-bar');
  let maxScrollDepth = 0;
  let scrollQueued = false;

  function readScroll() {
    scrollQueued = false;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = scrollable > 0 ? Math.min(window.scrollY / scrollable, 1) : 1;
    if (progressBar) progressBar.style.transform = `scaleX(${ratio})`;
    maxScrollDepth = Math.max(maxScrollDepth, Math.round(ratio * 100));
    $('#navbar')?.classList.toggle('scrolled', window.scrollY > 50);
  }

  window.addEventListener(
    'scroll',
    () => {
      if (scrollQueued) return;
      scrollQueued = true;
      requestAnimationFrame(readScroll);
    },
    { passive: true }
  );
  readScroll();

  /* ── Nav: which section am I in ────────────────────────────
     An observer beats reading offsetTop for every section on
     every scroll frame, which is what the old build did.
  ──────────────────────────────────────────────────────────── */
  const sections = $$('main section[id]');
  const navLinks = $$('.nav-links a');
  const tabbarLinks = $$('#mobile-tabbar a');

  if (sections.length) {
    const visible = new Set();

    const markCurrent = () => {
      /* Lowest section still on screen wins, so the highlight moves
         forward as you scroll rather than jumping around. */
      const current = sections.find((s) => visible.has(s.id))?.id || '';

      navLinks.forEach((link) => {
        if (link.getAttribute('href') === `#${current}`) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });

      tabbarLinks.forEach((link) => {
        const href = link.getAttribute('href');
        const match = href === '#hero' ? current === 'hero' || current === '' : href === `#${current}`;
        link.classList.toggle('text-primary', match);
        link.classList.toggle('text-faint', !match);
      });
    };

    const navObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        });
        markCurrent();
      },
      { rootMargin: '-90px 0px -55% 0px' }
    );
    sections.forEach((section) => navObserver.observe(section));

    /* Fire once per section, for engagement reporting. */
    const seen = new Set();
    const viewObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !seen.has(entry.target.id)) {
            seen.add(entry.target.id);
            trackEvent('section_view', { section_id: entry.target.id });
          }
        });
      },
      { threshold: 0.5 }
    );
    sections.forEach((section) => viewObserver.observe(section));
  }

  /* ── Mobile menu ───────────────────────────────────────────── */
  const menu = $('#mob-menu');
  const hamburger = $('#ham');

  if (menu && hamburger) {
    /* No visibility filter here: every control in the panel is meant to be
       reachable whenever the panel is open, and offsetParent is unreliable
       inside a fixed-position container. */
    const focusable = () => $$('a[href], button:not([disabled])', menu);

    const onKeydown = (event) => {
      if (event.key === 'Escape') {
        closeMenu();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    function openMenu() {
      menu.classList.add('open');
      hamburger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      menu.addEventListener('keydown', onKeydown);
      focusable()[0]?.focus();
    }

    function closeMenu() {
      if (!menu.classList.contains('open')) return;
      menu.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      menu.removeEventListener('keydown', onKeydown);
      hamburger.focus();
    }

    hamburger.addEventListener('click', openMenu);
    $('#mob-close')?.addEventListener('click', closeMenu);
    $$('a', menu).forEach((link) => link.addEventListener('click', closeMenu));
  }

  /* ── Metric counters ───────────────────────────────────────── */
  const metrics = $('#metrics');
  if (metrics) {
    const targets = $$('[data-count-to]', metrics);

    const countUp = (el, target, duration) => {
      let startedAt = null;
      const step = (now) => {
        if (startedAt === null) startedAt = now;
        const progress = Math.min((now - startedAt) / duration, 1);
        const eased = 1 - (1 - progress) ** 3;
        el.textContent = String(Math.floor(eased * target));
        if (progress < 1) requestAnimationFrame(step);
        else el.textContent = String(target);
      };
      requestAnimationFrame(step);
    };

    /* The real figures stay in the markup and are only overwritten once
       the animation actually begins, so a counter that never runs (no
       scripting, reduced motion, an observer that never fires in a
       background tab) shows the number rather than a zero. */
    if (!prefersReducedMotion && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries, obs) => {
          if (!entries[0].isIntersecting) return;
          obs.disconnect();
          targets.forEach((el) => countUp(el, Number(el.dataset.countTo), 1400));
        },
        { threshold: 0.4 }
      );
      observer.observe(metrics);
    }
  }

  /* ── Carousels ─────────────────────────────────────────────
     One implementation drives both the projects and the
     publications rails. Each rail owns its buttons via
     aria-controls and its counter via the enclosing section.
  ──────────────────────────────────────────────────────────── */
  const carousels = $$('.scroller').map((scroller) => {
    const section = scroller.closest('section');
    const prev = $(`[data-carousel-prev][aria-controls="${scroller.id}"]`);
    const next = $(`[data-carousel-next][aria-controls="${scroller.id}"]`);
    const indexEl = section && $('[data-carousel-index]', section);
    const totalEl = section && $('[data-carousel-total]', section);

    const items = () => Array.from(scroller.children).filter((el) => !el.hidden);
    const stepWidth = () => {
      const first = items()[0];
      return first ? first.getBoundingClientRect().width + 24 : scroller.clientWidth;
    };

    let queued = false;
    function refresh() {
      queued = false;
      const maxScroll = scroller.scrollWidth - scroller.clientWidth - 1;
      const scrollable = maxScroll > 2;
      if (prev) prev.disabled = !scrollable || scroller.scrollLeft <= 1;
      if (next) next.disabled = !scrollable || scroller.scrollLeft >= maxScroll;

      const count = items().length;
      if (totalEl) totalEl.textContent = String(count);
      if (indexEl) indexEl.textContent = String(count ? Math.min(count, Math.round(scroller.scrollLeft / stepWidth()) + 1) : 0);
    }

    const go = (direction) => scroller.scrollBy({ left: direction * stepWidth(), behavior: prefersReducedMotion ? 'auto' : 'smooth' });

    prev?.addEventListener('click', () => go(-1));
    next?.addEventListener('click', () => go(1));

    scroller.addEventListener(
      'scroll',
      () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(refresh);
      },
      { passive: true }
    );

    /* The rail is a focusable scroll region, so it must answer arrow keys. */
    scroller.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        go(1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        go(-1);
      }
    });

    window.addEventListener('resize', refresh, { passive: true });
    refresh();
    return { scroller, refresh };
  });

  const refreshCarousels = () => carousels.forEach((c) => c.refresh());
  window.addEventListener('load', refreshCarousels);

  /* ── Project filter ────────────────────────────────────────── */
  const filterRow = $('#filter-row');
  const projectRail = $('#proj-grid');

  if (filterRow && projectRail) {
    filterRow.addEventListener('click', (event) => {
      const button = event.target.closest('.filt');
      if (!button) return;

      $$('.filt', filterRow).forEach((b) => b.setAttribute('aria-pressed', String(b === button)));

      const filter = button.dataset.f;
      $$('.proj-card', projectRail).forEach((card) => {
        const categories = (card.dataset.cat || '').split(' ');
        card.hidden = filter !== 'all' && !categories.includes(filter);
      });

      /* Reading scrollWidth inside refresh forces layout, so the counter
         is already correct on this frame. */
      projectRail.scrollTo({ left: 0, behavior: 'auto' });
      refreshCarousels();

      trackEvent('project_filter', { filter });
    });
  }

  /* ── Analytics demo tabs ───────────────────────────────────── */
  const tablist = $('#analytics-tabs');
  if (tablist) {
    const tabs = $$('[role="tab"]', tablist);

    function selectTab(tab, { focus = false } = {}) {
      tabs.forEach((t) => {
        const selected = t === tab;
        t.setAttribute('aria-selected', String(selected));
        t.tabIndex = selected ? 0 : -1;
        const panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !selected;
      });
      if (focus) tab.focus();
      trackEvent('analytics_tab', { tab: tab.id });
    }

    tablist.addEventListener('click', (event) => {
      const tab = event.target.closest('[role="tab"]');
      if (tab) selectTab(tab);
    });

    tablist.addEventListener('keydown', (event) => {
      const keys = { ArrowRight: 1, ArrowLeft: -1 };
      const index = tabs.indexOf(document.activeElement);
      if (index === -1) return;

      if (event.key in keys) {
        event.preventDefault();
        selectTab(tabs[(index + keys[event.key] + tabs.length) % tabs.length], { focus: true });
      } else if (event.key === 'Home') {
        event.preventDefault();
        selectTab(tabs[0], { focus: true });
      } else if (event.key === 'End') {
        event.preventDefault();
        selectTab(tabs[tabs.length - 1], { focus: true });
      }
    });

    /* A link to a chart in the hidden tab has to reveal it first. */
    window.revealAnalyticsPanel = (panelId) => {
      const tab = tabs.find((t) => t.getAttribute('aria-controls') === panelId);
      if (tab) selectTab(tab);
    };
  }

  /* ── Smooth scroll with the fixed nav accounted for ────────── */
  document.addEventListener('click', (event) => {
    const anchor = event.target.closest('a[href^="#"]');
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    if (!href || href === '#') return;

    const target = document.getElementById(decodeURIComponent(href.slice(1)));
    if (!target) return;

    event.preventDefault();

    let destination = target;
    if (target.getAttribute('role') === 'tabpanel') {
      window.revealAnalyticsPanel?.(target.id);
      destination = $('#analytics') || target;
    }

    const top = destination.getBoundingClientRect().top + window.scrollY - 90;
    window.scrollTo({ top, behavior: prefersReducedMotion ? 'auto' : 'smooth' });

    /* Keep the URL and the keyboard in sync with where the page went. */
    history.replaceState(null, '', href);
    if (!destination.hasAttribute('tabindex')) destination.setAttribute('tabindex', '-1');
    destination.focus({ preventScroll: true });

    trackEvent('internal_nav', { href });
  });

  /* ── Copy-to-clipboard buttons ─────────────────────────────── */
  $$('[data-copy]').forEach((button) => {
    button.addEventListener('click', async () => {
      const value = button.dataset.copy;
      if (!navigator.clipboard) return;
      try {
        await navigator.clipboard.writeText(value);
        const original = button.getAttribute('aria-label');
        button.classList.add('is-copied');
        button.setAttribute('aria-label', 'Copied');
        setTimeout(() => {
          button.classList.remove('is-copied');
          button.setAttribute('aria-label', original);
        }, 1800);
        trackEvent('copy_contact', { value });
      } catch {
        /* clipboard denied: the address is still selectable */
      }
    });
  });

  /* ── Contact form ──────────────────────────────────────────
     EmailJS first, Formspree if that fails, mailto as the last
     resort, so a message always has somewhere to go.
  ──────────────────────────────────────────────────────────── */
  const form = $('#contact-form');
  if (form) {
    const EMAILJS = { service: 'service_51t4hfn', template: 'template_tutr40i', publicKey: 'i8KrO_W-JbnVbaLqL' };
    const FORMSPREE_ID = 'xpqyjjbq';
    const CONTACT_EMAIL = 'johnsonmugarra@yahoo.com';
    const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const sendButton = $('#send-btn');
    const statusEl = $('#f-msg');
    let messageTimer = null;

    if (typeof window.emailjs !== 'undefined') window.emailjs.init({ publicKey: EMAILJS.publicKey });

    function setBusy(busy) {
      if (!sendButton) return;
      sendButton.disabled = busy;
      sendButton.setAttribute('aria-busy', String(busy));
      sendButton.textContent = busy ? 'Sending…' : 'Send message →';
    }

    function showStatus(kind, text) {
      if (!statusEl) return;
      clearTimeout(messageTimer);
      statusEl.textContent = text;
      statusEl.className = `f-msg is-shown is-${kind}`;
      if (kind === 'success') {
        messageTimer = setTimeout(() => {
          statusEl.className = 'f-msg';
          statusEl.textContent = '';
        }, 10000);
      }
    }

    function readField(name) {
      const el = form.elements[name];
      return { el, value: (el?.value || '').trim() };
    }

    function validate(fields) {
      const problems = [];
      ['name', 'email', 'message'].forEach((key) => {
        const invalid = !fields[key].value;
        fields[key].el?.setAttribute('aria-invalid', String(invalid));
        if (invalid) problems.push(key);
      });
      if (problems.length) return 'Please fill in your name, email and message.';

      if (!EMAIL_PATTERN.test(fields.email.value)) {
        fields.email.el?.setAttribute('aria-invalid', 'true');
        return 'That email address does not look right.';
      }
      return null;
    }

    function succeed(email, method) {
      showStatus('success', `Message sent. I'll reply to ${email} soon.`);
      form.reset();
      $$('[aria-invalid]', form).forEach((el) => el.removeAttribute('aria-invalid'));
      trackEvent('form_submission_success', { method });
    }

    async function viaFormspree(payload) {
      const body = new FormData();
      Object.entries(payload).forEach(([key, value]) => body.append(key, value));
      const response = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
        method: 'POST',
        body,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`Formspree responded ${response.status}`);
    }

    function viaMailto(payload) {
      const body = `From: ${payload.name} <${payload.email}>\n\n${payload.message}`;
      const href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(payload.subject)}&body=${encodeURIComponent(body)}`;
      window.location.href = href;
      showStatus('success', 'Your email client is opening. Press send there and it will reach me.');
      form.reset();
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      /* Honeypot: only a bot fills a field it cannot see. Report
         success so the bot does not retry with a different shape. */
      if (readField('company').value) {
        showStatus('success', 'Message sent.');
        form.reset();
        trackEvent('form_submission_blocked', { reason: 'honeypot' });
        return;
      }

      const fields = {
        name: readField('name'),
        email: readField('email'),
        subject: readField('subject'),
        message: readField('message'),
      };

      const problem = validate(fields);
      if (problem) {
        showStatus('error', problem);
        $('[aria-invalid="true"]', form)?.focus();
        return;
      }

      const payload = {
        name: fields.name.value,
        email: fields.email.value,
        subject: fields.subject.value || 'Portfolio enquiry',
        message: fields.message.value,
      };

      setBusy(true);
      try {
        if (typeof window.emailjs === 'undefined') throw new Error('EmailJS unavailable');
        await window.emailjs.send(EMAILJS.service, EMAILJS.template, {
          from_name: payload.name,
          from_email: payload.email,
          reply_to: payload.email,
          to_email: CONTACT_EMAIL,
          subject: payload.subject,
          message: payload.message,
        });
        succeed(payload.email, 'emailjs');
      } catch {
        try {
          await viaFormspree(payload);
          succeed(payload.email, 'formspree');
        } catch {
          viaMailto(payload);
          trackEvent('form_submission_success', { method: 'mailto' });
        }
      } finally {
        setBusy(false);
      }
    });

    /* Clear the invalid state as soon as the visitor starts fixing it. */
    form.addEventListener('input', (event) => {
      if (event.target.getAttribute('aria-invalid') === 'true') event.target.setAttribute('aria-invalid', 'false');
    });
  }

  /* ── Scroll reveal ─────────────────────────────────────────── */
  const revealTargets = $$('.reveal');
  if (revealTargets.length) {
    /* These start at opacity 0 under .js, so anything that stops the
       observer running has to reveal them instead of leaving them hidden. */
    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      revealTargets.forEach((el) => el.classList.add('is-visible'));
    } else {
      let anyRevealed = false;
      const revealObserver = new IntersectionObserver(
        (entries, obs) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            anyRevealed = true;
            entry.target.classList.add('is-visible');
            obs.unobserve(entry.target);
          });
        },
        { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
      );
      revealTargets.forEach((el, i) => {
        el.style.setProperty('--stagger', String(i % 4));
        revealObserver.observe(el);
      });

      /* If nothing at all has revealed once the page has been visible for
         a few seconds, the observer is not doing its job. Show everything
         rather than leave the section blank. */
      setTimeout(() => {
        if (anyRevealed || document.visibilityState !== 'visible') return;
        revealObserver.disconnect();
        revealTargets.forEach((el) => el.classList.add('is-visible'));
      }, 4000);
    }
  }

  /* ── Outbound and download tracking ────────────────────────── */
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link) return;

    if (link.hasAttribute('download') || link.getAttribute('href').endsWith('.pdf')) {
      trackEvent('file_download', { file_name: link.href.split('/').pop(), link_text: link.textContent.trim() });
      return;
    }

    const href = link.getAttribute('href');
    if (/^(https?:)?\/\//.test(href) && link.hostname !== window.location.hostname) {
      trackEvent('outbound_click', { url: link.href });
    }
  });

  /* ── Engagement on the way out ─────────────────────────────
     `pagehide` and `visibilitychange` instead of `beforeunload`,
     which blocks the back/forward cache in several browsers.
  ──────────────────────────────────────────────────────────── */
  let visibleSince = document.visibilityState === 'visible' ? performance.now() : 0;
  let visibleMs = 0;
  let exitReported = false;

  function reportExit() {
    if (exitReported) return;
    exitReported = true;
    if (visibleSince) {
      visibleMs += performance.now() - visibleSince;
      visibleSince = 0;
    }
    trackEvent('page_exit', { time_on_page: Math.round(visibleMs / 1000), scroll_depth: maxScrollDepth });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      reportExit();
    } else {
      visibleSince = performance.now();
      exitReported = false;
    }
  });
  window.addEventListener('pagehide', reportExit);
  window.addEventListener('beforeprint', () => trackEvent('print', { event_category: 'engagement' }));

  window.addEventListener('load', () => {
    const [navigation] = performance.getEntriesByType('navigation');
    if (navigation) {
      trackEvent('timing_complete', {
        name: 'page_load',
        value: Math.round(navigation.duration),
        event_category: 'Performance',
      });
    }
  });

  /* ── Footer year ───────────────────────────────────────────── */
  const yearEl = $('#footer-year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();

/* ── Service worker ──────────────────────────────────────────
   A relative path works from a domain root and from a GitHub
   Pages project subdirectory alike.
──────────────────────────────────────────────────────────── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* no service worker: the site still works in full */
    });
  });
}
