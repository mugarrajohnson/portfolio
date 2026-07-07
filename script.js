/* ═══════════════════════════════════════════════════
   script.js — Johnson Mugarra Portfolio
   ═══════════════════════════════════════════════════ */
'use strict';

document.addEventListener('DOMContentLoaded', () => {

  /* ── Page Loader ─────────────────────────────────────── */
  window.addEventListener('load', () => {
    const loader = document.getElementById('page-loader');
    const heroEl = document.getElementById('hero');
    if (heroEl) heroEl.classList.add('js-anim');
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(() => {
        loader.style.display = 'none';
        if (heroEl) {
          heroEl.classList.remove('js-anim');
          heroEl.classList.add('hero-ready');
        }
      }, 300);
    }
  });


  /* ── Theme toggle ────────────────────────────────────── */
  const root        = document.documentElement;
  const toggleBtn   = document.getElementById('theme-toggle');
  const STORAGE_KEY = 'jm-theme';

  const ICON_MOON = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
  const ICON_SUN  = '<circle cx="12" cy="12" r="5"/>'
    + '<line x1="12" y1="1"  x2="12" y2="3"/>'
    + '<line x1="12" y1="21" x2="12" y2="23"/>'
    + '<line x1="4.22" y1="4.22"   x2="5.64"  y2="5.64"/>'
    + '<line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>'
    + '<line x1="1"  y1="12" x2="3"  y2="12"/>'
    + '<line x1="21" y1="12" x2="23" y2="12"/>'
    + '<line x1="4.22" y1="19.78" x2="5.64"  y2="18.36"/>'
    + '<line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';

  const applyTheme = (theme) => {
    root.classList.toggle('dark', theme === 'dark');
    root.setAttribute('data-theme', theme);
    const isLight = theme === 'light';
    if (toggleBtn) {
      const icon = document.getElementById('theme-icon');
      if (icon) icon.innerHTML = isLight ? ICON_MOON : ICON_SUN;
      toggleBtn.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
    }
    const mobIcon  = document.getElementById('mob-theme-icon');
    const mobLabel = document.getElementById('mob-theme-label');
    if (mobIcon)  mobIcon.innerHTML = isLight ? ICON_MOON : ICON_SUN;
    if (mobLabel) mobLabel.textContent = isLight ? 'Dark mode' : 'Light mode';
    if (typeof dataLayer !== 'undefined') {
      dataLayer.push({ event: 'theme_change', theme });
    }
    document.dispatchEvent(new CustomEvent('themeChange'));
  };

  /* Respect saved preference → OS preference → default dark */
  const saved  = localStorage.getItem(STORAGE_KEY);
  const osDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (osDark ? 'dark' : 'light'));

  const doToggle = () => {
    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
  };
  toggleBtn?.addEventListener('click', doToggle);
  document.getElementById('mob-theme-toggle')?.addEventListener('click', doToggle);

  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem(STORAGE_KEY)) applyTheme(e.matches ? 'dark' : 'light');
  });


  /* ── EmailJS ─────────────────────────────────────────── */
  const EJS_SERVICE  = 'service_51t4hfn';
  const EJS_TEMPLATE = 'template_tutr40i';
  const EJS_KEY      = 'i8KrO_W-JbnVbaLqL';

  if (typeof emailjs !== 'undefined') emailjs.init({ publicKey: EJS_KEY });


  /* ── 1. Scroll progress bar ──────────────────────────── */
  const progressBar = document.getElementById('progress-bar');
  window.addEventListener('scroll', () => {
    if (!progressBar) return;
    const pct = window.scrollY / (document.body.scrollHeight - window.innerHeight) * 100;
    progressBar.style.width = `${Math.min(pct, 100)}%`;
  }, { passive: true });


  /* ── 2. Nav glass + active section highlight ─────────── */
  const navbar      = document.getElementById('navbar');
  const navLinks    = document.querySelectorAll('.nav-links a');
  const mobNavLinks = document.querySelectorAll('nav[aria-label="Mobile navigation"] a');
  const sections    = document.querySelectorAll('section[id]');

  window.addEventListener('scroll', () => {
    navbar?.classList.toggle('scrolled', window.scrollY > 50);

    let current = '';
    sections.forEach((sec) => {
      if (window.scrollY >= sec.offsetTop - 130) current = sec.id;
    });
    navLinks.forEach((link) => {
      link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
    });
    mobNavLinks.forEach((link) => {
      const href   = link.getAttribute('href');
      const isHome = href === '#hero';
      const match  = isHome ? (current === 'hero' || current === '') : href === `#${current}`;
      link.classList.toggle('text-primary', match);
      link.classList.toggle('text-white/50', !match);
    });
  }, { passive: true });


  /* ── 3. Mobile menu ──────────────────────────────────── */
  const ham    = document.getElementById('ham');
  const mmenu  = document.getElementById('mob-menu');
  const mclose = document.getElementById('mob-close');

  const getFocusable = () => Array.from(
    mmenu.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
  );

  const trapFocus = (e) => {
    if (e.key !== 'Tab') return;
    const focusable = getFocusable();
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };

  const openMenu = () => {
    if (!mmenu) return;
    mmenu.classList.remove('hidden');
    requestAnimationFrame(() => {
      mmenu.classList.add('open');
      mmenu.addEventListener('keydown', trapFocus);
      getFocusable()[0]?.focus();
    });
    ham?.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  };
  const closeMenu = () => {
    if (!mmenu) return;
    mmenu.classList.remove('open');
    mmenu.removeEventListener('keydown', trapFocus);
    ham?.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    setTimeout(() => { if (!mmenu.classList.contains('open')) mmenu.classList.add('hidden'); }, 260);
    ham?.focus();
  };

  ham?.addEventListener('click', openMenu);
  mclose?.addEventListener('click', closeMenu);
  mmenu?.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMenu));


  /* ── 4. Skill bars ───────────────────────────────────── */
  const skillSection = document.getElementById('skill-bars');
  if (skillSection) {
    const animateBars = () => {
      skillSection.querySelectorAll('.sk-fill').forEach((fill) => {
        fill.style.width = `${fill.dataset.w || 0}%`;
      });
    };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries, obs) => {
        if (entries[0].isIntersecting) { setTimeout(animateBars, 100); obs.disconnect(); }
      }, { threshold: 0.15 }).observe(skillSection);
    } else {
      animateBars();
    }
  }


  /* ── 5. Metrics counter ──────────────────────────────── */
  const REDUCED_MOTION = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const countUp = (el, target, duration) => {
    if (!el) return;
    if (REDUCED_MOTION) { el.textContent = target; return; }
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const p    = Math.min((ts - start) / duration, 1);
      const ease = 1 - (1 - p) ** 3;
      el.textContent = Math.floor(ease * target);
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = target;
    };
    requestAnimationFrame(step);
  };

  const metricsEl = document.getElementById('metrics');
  if (metricsEl) {
    let counted = false;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries, obs) => {
        if (entries[0].isIntersecting && !counted) {
          counted = true;
          countUp(document.getElementById('m1'), 95, 1500);
          countUp(document.getElementById('m2'), 85, 1500);
          countUp(document.getElementById('m3'), 80, 1600);
          countUp(document.getElementById('m4'), 6,  1200);
          obs.disconnect();
        }
      }, { threshold: 0.4 }).observe(metricsEl);
    } else {
      [['m1',95],['m2',85],['m3',80],['m4',6]].forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      });
    }
  }


  /* ── 6. Project filter ───────────────────────────────── */
  const filterRow = document.getElementById('filter-row');
  if (filterRow) {
    const hideTimers = new WeakMap();

    filterRow.addEventListener('click', (e) => {
      const btn = e.target.closest('.filt');
      if (!btn) return;

      document.querySelectorAll('.filt').forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');

      const f = btn.getAttribute('data-f');

      document.querySelectorAll('.proj-card').forEach((card) => {
        const cats  = (card.getAttribute('data-cat') || '').split(' ');
        const match = f === 'all' || cats.includes(f);

        if (hideTimers.has(card)) { clearTimeout(hideTimers.get(card)); hideTimers.delete(card); }

        if (match) {
          card.classList.add('hiding');
          card.classList.remove('hidden');
          void card.offsetWidth;
          card.classList.remove('hiding');
        } else {
          card.classList.add('hiding');
          const t = setTimeout(() => { card.classList.add('hidden'); hideTimers.delete(card); }, 360);
          hideTimers.set(card, t);
        }
      });
    });
  }


  /* ── 6b. Projects horizontal carousel ────────────────── */
  const scroller = document.getElementById('proj-grid');
  const carousel = document.querySelector('.proj-carousel');
  const projPrev = document.getElementById('proj-prev');
  const projNext = document.getElementById('proj-next');

  if (scroller && carousel) {
    const step = () => {
      const card = scroller.querySelector('.proj-card:not(.hidden)');
      const cardW = card ? card.getBoundingClientRect().width + 24 : scroller.clientWidth * 0.85;
      // advance by whole cards, at least one, without overshooting a screenful
      return Math.max(cardW, Math.floor(scroller.clientWidth / cardW) * cardW || cardW);
    };

    const idxEl = document.getElementById('proj-index');
    const totEl = document.getElementById('proj-total');

    let ticking = false;
    const updateNav = () => {
      const max = scroller.scrollWidth - scroller.clientWidth - 1;
      const x = scroller.scrollLeft;
      const atStart = x <= 1;
      const atEnd = x >= max;
      const scrollable = max > 2;
      if (projPrev) projPrev.disabled = atStart || !scrollable;
      if (projNext) projNext.disabled = atEnd || !scrollable;

      const visible = scroller.querySelectorAll('.proj-card:not(.hidden)');
      const card = visible[0];
      const cardW = card ? card.getBoundingClientRect().width + 24 : 1;
      const idx = Math.min(visible.length, Math.round(x / cardW) + 1);
      if (idxEl) idxEl.textContent = visible.length ? idx : 0;
      if (totEl) totEl.textContent = visible.length;
    };

    projPrev?.addEventListener('click', () => scroller.scrollBy({ left: -step(), behavior: 'smooth' }));
    projNext?.addEventListener('click', () => scroller.scrollBy({ left: step(), behavior: 'smooth' }));

    scroller.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { updateNav(); ticking = false; });
    }, { passive: true });

    window.addEventListener('resize', updateNav, { passive: true });

    // Reset to the start and refresh arrows whenever a filter is applied
    filterRow?.addEventListener('click', () => {
      requestAnimationFrame(() => {
        scroller.scrollTo({ left: 0, behavior: 'auto' });
        updateNav();
      });
    });

    updateNav();
    window.addEventListener('load', updateNav);
  }


  /* ── 6c. Analytics demo tabs (one chart at a time) ───── */
  const anTabs = document.getElementById('analytics-tabs');
  const showPanel = (id) => {
    if (!anTabs) return;
    anTabs.querySelectorAll('.an-tab').forEach((t) => {
      const on = t.dataset.panel === id;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.classList.toggle('text-white/60', !on);
    });
    document.querySelectorAll('.analytics-panel').forEach((p) => {
      p.classList.toggle('hidden', p.id !== id);
    });
    /* the revealed chart was drawn while hidden (0 size); force both to redraw */
    requestAnimationFrame(() => document.dispatchEvent(new CustomEvent('themeChange')));
  };
  anTabs?.addEventListener('click', (e) => {
    const btn = e.target.closest('.an-tab');
    if (btn) showPanel(btn.dataset.panel);
  });
  // expose so anchor links to a hidden chart can reveal it
  window.__showAnalyticsPanel = showPanel;


  /* ── 6d. Publications carousel ───────────────────────── */
  (function () {
    const sc = document.getElementById('pub-grid');
    if (!sc) return;
    const prev = document.getElementById('pub-prev');
    const next = document.getElementById('pub-next');
    const idxEl = document.getElementById('pub-index');
    const totEl = document.getElementById('pub-total');
    const stepW = () => {
      const c = sc.querySelector('.pub-item');
      return c ? c.getBoundingClientRect().width + 24 : sc.clientWidth;
    };
    let t = false;
    const upd = () => {
      const max = sc.scrollWidth - sc.clientWidth - 1;
      const x = sc.scrollLeft;
      if (prev) prev.disabled = x <= 1 || max <= 2;
      if (next) next.disabled = x >= max || max <= 2;
      const items = sc.querySelectorAll('.pub-item');
      const w = stepW();
      if (idxEl) idxEl.textContent = items.length ? Math.min(items.length, Math.round(x / w) + 1) : 0;
      if (totEl) totEl.textContent = items.length;
    };
    prev?.addEventListener('click', () => sc.scrollBy({ left: -stepW(), behavior: 'smooth' }));
    next?.addEventListener('click', () => sc.scrollBy({ left: stepW(), behavior: 'smooth' }));
    sc.addEventListener('scroll', () => { if (t) return; t = true; requestAnimationFrame(() => { upd(); t = false; }); }, { passive: true });
    window.addEventListener('resize', upd, { passive: true });
    upd();
    window.addEventListener('load', upd);
  })();


  /* ── 7. Contact form — EmailJS → Formspree → mailto ─────
     Three-layer fallback so messages always get through.
  ──────────────────────────────────────────────────────── */
  const FORMSPREE_ID  = 'xpqyjjbq';
  const CONTACT_EMAIL = 'johnsonmugarra@yahoo.com';

  const form    = document.getElementById('contact-form');
  const sendBtn = document.getElementById('send-btn');
  const fMsg    = document.getElementById('f-msg');

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const name    = form.querySelector('[name="name"]').value.trim();
      const email   = form.querySelector('[name="email"]').value.trim();
      const subject = form.querySelector('[name="subject"]').value.trim() || 'Portfolio enquiry';
      const message = form.querySelector('[name="message"]').value.trim();

      const nameEl  = form.querySelector('[name="name"]');
      const emailEl = form.querySelector('[name="email"]');
      const msgEl   = form.querySelector('[name="message"]');
      [nameEl, emailEl, msgEl].forEach((el) => el?.removeAttribute('aria-invalid'));

      if (!name || !email || !message) {
        if (!name)    nameEl?.setAttribute('aria-invalid', 'true');
        if (!email)   emailEl?.setAttribute('aria-invalid', 'true');
        if (!message) msgEl?.setAttribute('aria-invalid', 'true');
        showMsg('error', '&#x26A0; Please fill in your name, email and message.');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        emailEl?.setAttribute('aria-invalid', 'true');
        showMsg('error', '&#x26A0; Please enter a valid email address.');
        return;
      }

      setBusy(true);

      if (typeof emailjs !== 'undefined') {
        emailjs.send(EJS_SERVICE, EJS_TEMPLATE, {
          from_name: name, from_email: email, reply_to: email,
          to_email: CONTACT_EMAIL, subject, message,
        })
        .then(() => {
          showMsg('success', `&#x2713; Message sent! I'll reply to ${email} soon.`);
          form.reset();
          setBusy(false);
          trackEvent('form_submission_success', { method: 'emailjs' });
        })
        .catch(() => tryFormspree(name, email, subject, message));
      } else {
        tryFormspree(name, email, subject, message);
      }
    });
  }

  const tryFormspree = (name, email, subject, message) => {
    const data = new FormData();
    data.append('name', name); data.append('email', email);
    data.append('subject', subject); data.append('message', message);

    fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
      method: 'POST', body: data, headers: { Accept: 'application/json' },
    })
    .then((res) => {
      if (res.ok) {
        showMsg('success', `&#x2713; Message sent! I'll reply to ${email} soon.`);
        form?.reset();
        trackEvent('form_submission_success', { method: 'formspree' });
      } else {
        openMailto(name, email, subject, message);
      }
    })
    .catch(() => openMailto(name, email, subject, message))
    .finally(() => setBusy(false));
  };

  const openMailto = (name, email, subject, message) => {
    const body   = `From: ${name} <${email}>\n\n${message}`;
    const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const a = Object.assign(document.createElement('a'), { href: mailto, style: 'display:none' });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showMsg('success', '&#x2713; Your email client opened &#x2014; just hit Send!');
    form?.reset();
    setBusy(false);
  };

  const setBusy = (busy) => {
    if (!sendBtn) return;
    sendBtn.disabled    = busy;
    sendBtn.textContent = busy ? 'Sending…' : 'Send message →';
  };

  const showMsg = (type, html) => {
    if (!fMsg) return;
    fMsg.innerHTML  = html;
    fMsg.className  = `f-msg show ${type || ''}`;
    setTimeout(() => { fMsg.className = 'f-msg'; }, 8000);
  };


  /* ── 8. Scroll reveal with stagger ──────────────────── */
  if ('IntersectionObserver' in window) {
    const revealObs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('fade-in-up');
          revealObs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll(
      '.cert-card, .testimonial-card, .highlight-card, .pub-item, .trust-item, .metric, .exp-item'
    ).forEach((el, i) => {
      el.style.setProperty('--stagger', i % 4);
      revealObs.observe(el);
    });
  }


  /* ── 9. Outbound link tracking ───────────────────────── */
  document.querySelectorAll('a[href^="http"], a[href^="//"]').forEach((link) => {
    link.addEventListener('click', () => trackEvent('outbound_click', { url: link.href }));
  });


  /* ── 10. CV download tracking ────────────────────────── */
  document.querySelectorAll('a[download], a[href$=".pdf"]').forEach((link) => {
    link.addEventListener('click', () => trackEvent('file_download', {
      file_name: link.href.split('/').pop(),
      link_text: link.textContent.trim(),
    }));
  });


  /* ── 11. Section view tracking ───────────────────────── */
  if ('IntersectionObserver' in window) {
    const sectionObs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) trackEvent('section_view', { section_id: entry.target.id });
      });
    }, { threshold: 0.5 });
    sections.forEach((s) => sectionObs.observe(s));
  }


  /* ── 12. Smooth scroll (fixed-nav offset) ────────────── */
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        let scrollTarget = target;
        // If the link points to a chart that lives in a hidden tab, reveal it first
        if (target.classList.contains('analytics-panel') && typeof window.__showAnalyticsPanel === 'function') {
          window.__showAnalyticsPanel(target.id);
          scrollTarget = document.getElementById('analytics') || target;
        }
        window.scrollTo({ top: scrollTarget.offsetTop - 90, behavior: 'smooth' });
        trackEvent('internal_nav', { href });
      }
    });
  });


  /* ── 13. Right-click email address to copy ───────────── */
  document.querySelectorAll('a[href^="mailto:"]').forEach((emailLink) => {
    emailLink.addEventListener('contextmenu', (e) => {
      const address = emailLink.href.replace('mailto:', '').split('?')[0];
      if (!navigator.clipboard?.writeText) return;
      e.preventDefault();
      navigator.clipboard.writeText(address).then(() => {
        const valEl  = emailLink.querySelector('.c-val');
        const target = valEl || emailLink;
        const orig   = target.textContent;
        target.textContent = 'Copied!';
        setTimeout(() => { target.textContent = orig; }, 2000);
      });
    });
  });


  /* ── 14. Keyboard: Escape closes mobile menu ─────────── */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mmenu?.classList.contains('open')) {
      closeMenu();
      ham?.focus();
    }
  });


  /* ── 15. Page performance (Navigation Timing Level 2) ── */
  window.addEventListener('load', () => {
    const [nav] = performance.getEntriesByType('navigation');
    if (nav) trackEvent('timing_complete', {
      name: 'page_load',
      value: Math.round(nav.loadEventEnd),
      event_category: 'Performance',
    });
  });


  /* ── 16. Page exit + time-on-page ───────────────────── */
  let hiddenTime = 0;
  let lastHide   = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) lastHide = Date.now();
    else hiddenTime += Date.now() - lastHide;
  });

  window.addEventListener('beforeunload', () => {
    /* performance.now() = ms since navigation start (same clock as hiddenTime deltas) */
    const timeOnPage = Math.floor((performance.now() - hiddenTime) / 1000);
    const scrollPct  = document.body.scrollHeight > window.innerHeight
      ? Math.floor(window.scrollY / (document.body.scrollHeight - window.innerHeight) * 100)
      : 100;
    trackEvent('page_exit', { time_on_page: timeOnPage, scroll_depth: scrollPct });
  });

  window.addEventListener('beforeprint', () => trackEvent('print', { event_category: 'engagement' }));


  /* ── Shared analytics helper ─────────────────────────── */
  const trackEvent = (name, params = {}) => {
    if (typeof gtag !== 'undefined') gtag('event', name, params);
    else if (typeof dataLayer !== 'undefined') dataLayer.push({ event: name, ...params });
  };

}); /* end DOMContentLoaded */


/* ── Service Worker (PWA) ────────────────────────────────
   Relative path works on both root deployments and
   GitHub Pages project-site subdirectories.
──────────────────────────────────────────────────────── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* SW unavailable — site still works fully without it */
    });
  });
}
