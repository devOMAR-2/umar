/**
 * Omar Alfarraj — portfolio interactions.
 * Vanilla JS, no dependencies. Loaded with `defer`.
 *
 * Every feature is a small, self-contained init function. `boot()` runs each
 * one through `safeInit()` so a failure in one feature never breaks the rest.
 * Styling lives in SCSS; this file only toggles classes, attributes and CSS
 * custom properties (see "JS <-> CSS hooks" in the build spec).
 *
 * Features: loader, nav theme, active link (desktop + mobile menu), mobile
 * menu (disclosure + focus trap + ESC), anchor focus, scroll reveal, marquee
 * pause, scroll progress, hero logo tilt, contact placeholders,
 * Riyadh clock, footer year, external-link rel.
 */
(function () {
  'use strict';

  document.documentElement.classList.add('js');

  /* ------------------------------------------------------------------ */
  /* Constants & selectors                                               */
  /* ------------------------------------------------------------------ */

  const SELECTORS = {
    loader: '[data-loader]',
    nav: '[data-nav]',
    navLink: '[data-nav-link]',
    themed: '[data-theme]',
    menu: '[data-menu]',
    menuToggle: '[data-menu-toggle]',
    menuToggleLabel: '[data-menu-toggle-label]',
    menuLink: '[data-menu-link]',
    reveal: '[data-reveal]',
    marquee: '[data-marquee]',
    progressBar: '[data-progress-bar]',
    brand: '.site-header__brand',
    hero: '.hero',
    heroLogo: '[data-hero-logo]',
    contactLink: '[data-contact-link], [data-config-link]',
    clock: '[data-clock]',
    year: '[data-year]',
    focusable:
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
      'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  };

  const CLASSES = {
    loaded: 'is-loaded',
    menuOpen: 'is-menu-open',
    open: 'is-open',
    active: 'is-active',
    revealed: 'is-revealed',
    paused: 'is-paused',
    unconfigured: 'is-unconfigured',
  };

  const MENU_LABEL = { closed: 'القائمة', open: 'إغلاق' };
  const LOADER_FALLBACK_MS = 1600;
  const RESIZE_DEBOUNCE_MS = 150;
  const CURSOR_LERP = 0.2;
  const LOGO_LERP = 0.08;
  const LOGO_MAX_SHIFT = 8; // px
  const LOGO_MAX_ROTATE = 2; // deg
  const PAGE_END_TOLERANCE = 2; // px
  const DEV_HOSTS = ['localhost', '127.0.0.1', '[::1]', '::1'];

  /* ------------------------------------------------------------------ */
  /* Cached DOM + shared state                                           */
  /* ------------------------------------------------------------------ */

  const root = document.documentElement;
  const header = document.querySelector(SELECTORS.nav);
  const menuEl = document.querySelector(SELECTORS.menu);

  const media = {
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)'),
    finePointer: window.matchMedia('(hover: hover) and (pointer: fine)'),
    desktop: window.matchMedia('(min-width: 1024px)'),
  };

  const supportsIO = 'IntersectionObserver' in window;

  /** Shared between the nav-theme and mobile-menu features. */
  const state = {
    menuOpen: false,
    pageNavTheme: header ? header.dataset.navTheme || 'light' : 'light',
    closeMenu: null, // set by initMobileMenu
  };

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */

  /** Subscribe to a MediaQueryList change (with legacy Safari fallback). */
  function onMediaChange(mql, handler) {
    if (typeof mql.addEventListener === 'function') mql.addEventListener('change', handler);
    else if (typeof mql.addListener === 'function') mql.addListener(handler);
  }

  /** Trailing-edge debounce. */
  function debounce(fn, wait) {
    let timer = 0;
    return function debounced() {
      window.clearTimeout(timer);
      timer = window.setTimeout(fn, wait);
    };
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  /**
   * One passive, rAF-throttled scroll listener shared by every feature that
   * needs per-frame scroll work (progress bar, nav theme page-end check).
   */
  const scrollFrame = (function () {
    const subscribers = [];
    let ticking = false;

    function run() {
      ticking = false;
      subscribers.forEach((fn) => fn());
    }

    function schedule() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(run);
    }

    return {
      /** Run `fn` once per animation frame in which the page scrolled. */
      subscribe(fn) {
        subscribers.push(fn);
        if (subscribers.length === 1) {
          window.addEventListener('scroll', schedule, { passive: true });
        }
      },
      /** Force all subscribers to run on the next frame (resize, layout change). */
      schedule,
    };
  })();

  /** True when the page is scrolled to (within a couple of px of) its very end. */
  function isAtPageEnd() {
    const scrollY = window.scrollY;
    return scrollY > 0 && scrollY + window.innerHeight >= root.scrollHeight - PAGE_END_TOLERANCE;
  }

  /** Local development host (dev-only diagnostics). */
  function isDevHost() {
    return DEV_HOSTS.includes(window.location.hostname);
  }

  /** Preferred scroll behavior for programmatic scrolling. */
  function scrollBehavior() {
    return media.reducedMotion.matches ? 'auto' : 'smooth';
  }

  /** Resolve an in-page hash ("#id") to its element, or null. */
  function getHashTarget(hash) {
    if (!hash || hash.length < 2 || hash.charAt(0) !== '#') return null;
    let id = hash.slice(1);
    try {
      id = decodeURIComponent(id);
    } catch (err) {
      /* keep the raw id */
    }
    return document.getElementById(id);
  }

  /** Move keyboard / screen-reader focus to an element without scrolling. */
  function focusTarget(el) {
    if (!el) return;
    if (!el.matches(SELECTORS.focusable) && !el.hasAttribute('tabindex')) {
      el.setAttribute('tabindex', '-1');
    }
    el.focus({ preventScroll: true });
  }

  /** Update the header theme unless the open mobile menu is overriding it. */
  function setPageNavTheme(theme) {
    if (!theme) return;
    state.pageNavTheme = theme;
    if (header && !state.menuOpen && header.dataset.navTheme !== theme) {
      header.dataset.navTheme = theme;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Features                                                            */
  /* ------------------------------------------------------------------ */

  /** Remove the CSS-driven loader once its exit animation has finished. */
  function initLoader() {
    const loader = document.querySelector(SELECTORS.loader);
    let done = false;
    let fallback = 0;

    function finish() {
      if (done) return;
      done = true;
      window.clearTimeout(fallback);
      if (loader) {
        loader.removeEventListener('animationend', onAnimationEnd);
        loader.remove();
      }
      root.classList.add(CLASSES.loaded);
    }

    function onAnimationEnd(event) {
      if (event.target !== loader) return;
      // The loader may run several animations; wait until none is still running.
      if (typeof loader.getAnimations === 'function') {
        const running = loader.getAnimations().some((a) => a.playState === 'running');
        if (running) return;
      }
      finish();
    }

    if (!loader || media.reducedMotion.matches) {
      finish();
      return;
    }

    loader.addEventListener('animationend', onAnimationEnd);
    fallback = window.setTimeout(finish, LOADER_FALLBACK_MS);
  }

  /**
   * Header theme follows the section under its bottom edge.
   * The observer's root is shrunk to a 1px line at the nav's bottom edge.
   * Safety net: at the very end of the page the last themed element (the
   * footer) wins, even if it never reaches the nav line.
   */
  function initNavTheme() {
    if (!header || !supportsIO) return;

    const targets = Array.prototype.filter.call(
      document.querySelectorAll(SELECTORS.themed),
      (el) => !header.contains(el) && !(menuEl && menuEl.contains(el))
    );
    if (!targets.length) return;

    const intersecting = new Set();
    const lastTarget = targets[targets.length - 1];
    let observer = null;
    let atEnd = false;

    function pickTheme() {
      if (atEnd) {
        setPageNavTheme(lastTarget.dataset.theme);
        return;
      }
      // Last in document order wins (handles nested themed blocks).
      let current = null;
      targets.forEach((el) => {
        if (intersecting.has(el)) current = el;
      });
      if (current) setPageNavTheme(current.dataset.theme);
    }

    /** Re-pick only when the page-end state flips (cheap per-frame check). */
    function checkPageEnd() {
      const end = isAtPageEnd();
      if (end === atEnd) return;
      atEnd = end;
      pickTheme();
    }

    function onIntersect(entries) {
      entries.forEach((entry) => {
        if (entry.isIntersecting) intersecting.add(entry.target);
        else intersecting.delete(entry.target);
      });
      pickTheme();
    }

    function build() {
      if (observer) observer.disconnect();
      intersecting.clear();
      const navH = Math.round(header.offsetHeight);
      const bottom = Math.max(0, window.innerHeight - navH - 1);
      observer = new IntersectionObserver(onIntersect, {
        rootMargin: `-${navH}px 0px -${bottom}px 0px`,
        threshold: 0,
      });
      targets.forEach((el) => observer.observe(el));
    }

    build();
    atEnd = isAtPageEnd();
    if (atEnd) pickTheme();
    scrollFrame.subscribe(checkPageEnd);
    window.addEventListener(
      'resize',
      debounce(() => {
        build();
        scrollFrame.schedule();
      }, RESIZE_DEBOUNCE_MS),
      { passive: true }
    );
  }

  /**
   * Highlight the nav links (desktop nav + mobile menu) whose section crosses
   * the middle of the viewport.
   */
  function initActiveLink() {
    const links = Array.from(
      document.querySelectorAll(`${SELECTORS.navLink}, ${SELECTORS.menuLink}`)
    );
    if (!links.length || !supportsIO) return;

    const linkBySection = new Map();
    links.forEach((link) => {
      const section = getHashTarget(link.getAttribute('href'));
      if (!section) return;
      const group = linkBySection.get(section) || [];
      group.push(link);
      linkBySection.set(section, group);
    });
    if (!linkBySection.size) return;

    let activeSection = null;

    function setActive(section) {
      if (section === activeSection) return;
      activeSection = section;
      links.forEach((link) => {
        const isActive = Boolean(section) && linkBySection.get(section).includes(link);
        link.classList.toggle(CLASSES.active, isActive);
        if (isActive) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target);
          else if (entry.target === activeSection) setActive(null);
        });
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
    );

    linkBySection.forEach((_, section) => observer.observe(section));
  }

  /**
   * Full-screen mobile menu (disclosure pattern: the toggle's aria-expanded /
   * aria-controls): toggle, focus trap, ESC, link navigation.
   */
  function initMobileMenu() {
    const toggle = document.querySelector(SELECTORS.menuToggle);
    if (!toggle || !menuEl) return;

    const label = toggle.querySelector(SELECTORS.menuToggleLabel);
    const brand = document.querySelector(SELECTORS.brand);
    const menuLinks = Array.from(menuEl.querySelectorAll(SELECTORS.menuLink));

    function getTrapItems() {
      const inside = Array.from(menuEl.querySelectorAll(SELECTORS.focusable));
      return [toggle].concat(inside);
    }

    function open() {
      if (state.menuOpen) return;
      state.menuOpen = true;

      menuEl.removeAttribute('inert');
      menuEl.setAttribute('aria-hidden', 'false');
      menuEl.classList.add(CLASSES.open);
      toggle.setAttribute('aria-expanded', 'true');
      if (label) label.textContent = MENU_LABEL.open;
      root.classList.add(CLASSES.menuOpen);
      if (header) header.dataset.navTheme = 'dark';

      document.addEventListener('keydown', onKeydown);

      const first = menuLinks[0] || getTrapItems()[1];
      if (first) {
        first.focus({ preventScroll: true });
        // If the panel was not focusable yet (CSS visibility switch), retry next frame.
        if (document.activeElement !== first) {
          window.requestAnimationFrame(() => first.focus({ preventScroll: true }));
        }
      }
    }

    /**
     * @param {{ returnFocus?: boolean }} [options]
     */
    function close(options) {
      if (!state.menuOpen) return;
      state.menuOpen = false;

      menuEl.classList.remove(CLASSES.open);
      menuEl.setAttribute('aria-hidden', 'true');
      menuEl.setAttribute('inert', '');
      toggle.setAttribute('aria-expanded', 'false');
      if (label) label.textContent = MENU_LABEL.closed;
      root.classList.remove(CLASSES.menuOpen);
      if (header) header.dataset.navTheme = state.pageNavTheme;

      document.removeEventListener('keydown', onKeydown);

      if (options && options.returnFocus) toggle.focus({ preventScroll: true });
    }

    function onKeydown(event) {
      if (event.key === 'Escape' || event.key === 'Esc') {
        event.preventDefault();
        close({ returnFocus: true });
        return;
      }
      if (event.key !== 'Tab') return;

      const items = getTrapItems();
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;

      if (!items.includes(current)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    }

    toggle.addEventListener('click', () => {
      if (state.menuOpen) close();
      else open();
    });

    menuLinks.forEach((link) => {
      link.addEventListener('click', (event) => {
        const hash = link.getAttribute('href');
        const target = getHashTarget(hash);
        if (!target) {
          close();
          return;
        }
        event.preventDefault();
        close();
        target.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
        if (window.location.hash !== hash) window.history.pushState(null, '', hash);
        focusTarget(target);
      });
    });

    // Crossing into desktop closes the menu; the toggle is hidden there, so a
    // focus that was inside the menu (or on the toggle) moves to the brand link
    // instead of dropping to <body>.
    onMediaChange(media.desktop, (event) => {
      if (!event.matches || !state.menuOpen) return;
      const active = document.activeElement;
      const hadFocus = Boolean(active) && (menuEl.contains(active) || active === toggle);
      close();
      if (hadFocus && brand) brand.focus({ preventScroll: true });
    });

    state.closeMenu = close;
  }

  /**
   * In-page anchors (outside the mobile menu): the browser scrolls natively
   * (CSS handles smooth scrolling), then focus follows for keyboard/AT users.
   */
  function initAnchorFocus() {
    document.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null;
      if (!link || (menuEl && menuEl.contains(link))) return;

      const hash = link.getAttribute('href');
      const target = getHashTarget(hash);
      if (!target) return;

      // A link in the header (e.g. the brand) clicked while the menu is open.
      if (state.menuOpen && typeof state.closeMenu === 'function') state.closeMenu();

      // Let the native fragment navigation run first, then move focus.
      window.requestAnimationFrame(() => focusTarget(target));
    });
  }

  /** Reveal `[data-reveal]` elements as they enter the viewport. */
  function initScrollReveal() {
    const items = Array.from(document.querySelectorAll(SELECTORS.reveal));
    if (!items.length) return;

    function revealAll() {
      items.forEach((el) => el.classList.add(CLASSES.revealed));
    }

    if (!supportsIO || media.reducedMotion.matches) {
      revealAll();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const tall = entry.rootBounds && entry.boundingClientRect.height > entry.rootBounds.height;
          if (entry.intersectionRatio >= 0.12 || tall) {
            entry.target.classList.add(CLASSES.revealed);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: [0, 0.12], rootMargin: '0px 0px -8% 0px' }
    );

    items.forEach((el) => observer.observe(el));

    // If the user switches to reduced motion mid-visit, show everything.
    onMediaChange(media.reducedMotion, (event) => {
      if (!event.matches) return;
      observer.disconnect();
      revealAll();
    });
  }

  /** Pause the marquee animation while off-screen or while the tab is hidden. */
  function initMarquee() {
    const marquees = Array.from(document.querySelectorAll(SELECTORS.marquee));
    if (!marquees.length) return;

    const inView = new Map(marquees.map((el) => [el, true]));

    function update(el) {
      el.classList.toggle(CLASSES.paused, document.hidden || !inView.get(el));
    }

    if (supportsIO) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          inView.set(entry.target, entry.isIntersecting);
          update(entry.target);
        });
      });
      marquees.forEach((el) => observer.observe(el));
    }

    document.addEventListener('visibilitychange', () => marquees.forEach(update));
  }

  /** Expose page scroll progress (0..1) as `--progress` on the progress bar. */
  function initScrollProgress() {
    const bar = document.querySelector(SELECTORS.progressBar);
    if (!bar) return;

    let maxScroll = 1;
    let lastValue = '';

    function measure() {
      maxScroll = Math.max(1, root.scrollHeight - window.innerHeight);
    }

    function render() {
      const value = clamp(window.scrollY / maxScroll, 0, 1).toFixed(4);
      if (value !== lastValue) {
        lastValue = value;
        bar.style.setProperty('--progress', value);
      }
    }

    function remeasure() {
      measure();
      scrollFrame.schedule();
    }

    measure();
    render();

    scrollFrame.subscribe(render);
    window.addEventListener('resize', remeasure, { passive: true });

    // Document height changes (fonts, images, reveals) without a window resize.
    // Scheduling the shared frame also re-runs the nav theme page-end check.
    if ('ResizeObserver' in window) {
      new ResizeObserver(remeasure).observe(document.body);
    }
  }

  /** Very subtle pointer-driven tilt of the hero monogram (desktop, fine pointer). */
  function initLogoInteraction() {
    const hero = document.querySelector(SELECTORS.hero);
    const logo = hero ? hero.querySelector(SELECTORS.heroLogo) : null;
    if (!hero || !logo) return;

    const current = { x: 0, y: 0, r: 0 };
    const goal = { x: 0, y: 0, r: 0 };
    const pointer = { x: 0, y: 0, active: false };
    let rafId = 0;
    let heroVisible = true;
    // Cached hero geometry: measured on pointerenter, invalidated on resize /
    // scroll and re-read lazily (at most once per invalidation), never per frame.
    let rect = null;

    function measure() {
      rect = hero.getBoundingClientRect();
    }

    function invalidate() {
      rect = null;
    }

    function enabled() {
      return media.finePointer.matches && media.desktop.matches && !media.reducedMotion.matches;
    }

    function write() {
      logo.style.transform =
        `translate3d(${current.x.toFixed(2)}px, ${current.y.toFixed(2)}px, 0) ` +
        `rotate(${current.r.toFixed(3)}deg)`;
    }

    function step() {
      rafId = 0;
      if (!heroVisible) return;

      if (pointer.active) {
        if (!rect) measure();
        const nx = clamp((pointer.x - (rect.left + rect.width / 2)) / (rect.width / 2 || 1), -1, 1);
        const ny = clamp((pointer.y - (rect.top + rect.height / 2)) / (rect.height / 2 || 1), -1, 1);
        goal.x = nx * LOGO_MAX_SHIFT;
        goal.y = ny * LOGO_MAX_SHIFT;
        goal.r = nx * LOGO_MAX_ROTATE;
      } else {
        goal.x = 0;
        goal.y = 0;
        goal.r = 0;
      }

      current.x += (goal.x - current.x) * LOGO_LERP;
      current.y += (goal.y - current.y) * LOGO_LERP;
      current.r += (goal.r - current.r) * LOGO_LERP;

      const settled =
        Math.abs(goal.x - current.x) < 0.02 &&
        Math.abs(goal.y - current.y) < 0.02 &&
        Math.abs(goal.r - current.r) < 0.005;

      if (settled) {
        current.x = goal.x;
        current.y = goal.y;
        current.r = goal.r;
        write();
        return; // idle — wait for the next pointer event
      }

      write();
      rafId = window.requestAnimationFrame(step);
    }

    function start() {
      if (!rafId && heroVisible) rafId = window.requestAnimationFrame(step);
    }

    function stop() {
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = 0;
    }

    function reset() {
      stop();
      pointer.active = false;
      current.x = current.y = current.r = 0;
      logo.style.removeProperty('transform');
    }

    hero.addEventListener(
      'pointerenter',
      (event) => {
        if (event.pointerType === 'mouse' && enabled()) measure();
      },
      { passive: true }
    );

    window.addEventListener('resize', invalidate, { passive: true });
    window.addEventListener('scroll', invalidate, { passive: true });

    hero.addEventListener(
      'pointermove',
      (event) => {
        if (event.pointerType !== 'mouse' || !enabled()) return;
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        pointer.active = true;
        start();
      },
      { passive: true }
    );

    hero.addEventListener(
      'pointerleave',
      () => {
        if (!pointer.active) return;
        pointer.active = false;
        start(); // ease back to rest
      },
      { passive: true }
    );

    if (supportsIO) {
      new IntersectionObserver((entries) => {
        heroVisible = entries[entries.length - 1].isIntersecting;
        if (!heroVisible) stop();
        else if (pointer.active || current.x || current.y || current.r) start();
      }).observe(hero);
    }

    function sync() {
      if (!enabled()) reset();
    }
    onMediaChange(media.finePointer, sync);
    onMediaChange(media.desktop, sync);
    onMediaChange(media.reducedMotion, sync);
  }

  /** Make placeholder contact links (href still containing "__") inert. */
  function initContactLinks() {
    const links = Array.from(document.querySelectorAll(SELECTORS.contactLink)).filter((link) =>
      (link.getAttribute('href') || '').includes('__')
    );
    if (!links.length) return;

    links.forEach((link) => {
      link.setAttribute('aria-disabled', 'true');
      link.classList.add(CLASSES.unconfigured);
      link.addEventListener('click', (event) => event.preventDefault());
    });

    // Dev-only hint; production stays silent.
    if (isDevHost()) {
      console.info('[portfolio] Some contact/project links are not configured yet — see README.');
    }
  }

  /** Live Riyadh time (HH:MM), updated on minute boundaries while the tab is visible. */
  function initClock() {
    const clocks = Array.from(document.querySelectorAll(SELECTORS.clock));
    if (!clocks.length || typeof Intl === 'undefined') return;

    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Riyadh',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    let timer = 0;

    function render() {
      const parts = formatter.formatToParts(new Date());
      const pick = (type) => {
        const part = parts.find((p) => p.type === type);
        return part ? part.value.padStart(2, '0') : '00';
      };
      const time = `${pick('hour')}:${pick('minute')}`;
      clocks.forEach((el) => {
        if (el.textContent !== time) el.textContent = time;
        // Valid time string (HH:MM); the zone is stated in the visible label.
        if (el.getAttribute('datetime') !== time) el.setAttribute('datetime', time);
      });
    }

    function tick() {
      window.clearTimeout(timer);
      render();
      const delay = 60000 - (Date.now() % 60000) + 50;
      timer = window.setTimeout(tick, delay);
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        window.clearTimeout(timer);
        timer = 0;
      } else {
        tick();
      }
    });

    tick();
  }

  /** Current year in the footer. */
  function initYear() {
    const year = String(new Date().getFullYear());
    document.querySelectorAll(SELECTORS.year).forEach((el) => {
      el.textContent = year;
    });
  }

  /** Ensure every new-tab link carries `rel="noopener noreferrer"`. */
  function initExternalLinks() {
    document.querySelectorAll('a[target="_blank"]').forEach((link) => {
      link.relList.add('noopener', 'noreferrer');
    });
  }

  /* ------------------------------------------------------------------ */
  /* Boot                                                                */
  /* ------------------------------------------------------------------ */

  /** Run a feature in isolation so one failure never breaks the others. */
  function safeInit(name, fn) {
    try {
      fn();
    } catch (err) {
      console.error(`[portfolio] ${name} failed:`, err);
    }
  }

  function boot() {
    safeInit('loader', initLoader);
    safeInit('navTheme', initNavTheme);
    safeInit('activeLink', initActiveLink);
    safeInit('mobileMenu', initMobileMenu);
    safeInit('anchorFocus', initAnchorFocus);
    safeInit('scrollReveal', initScrollReveal);
    safeInit('marquee', initMarquee);
    safeInit('scrollProgress', initScrollProgress);
    safeInit('logoInteraction', initLogoInteraction);
    safeInit('contactLinks', initContactLinks);
    safeInit('clock', initClock);
    safeInit('year', initYear);
    safeInit('externalLinks', initExternalLinks);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
