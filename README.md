# عمر الفراج — Portfolio

Personal portfolio of **Omar Alfarraj (عمر الفراج)**, software engineer, Riyadh.
Arabic-first (`<html lang="ar" dir="rtl">`), single page, professional neo-brutalist / editorial design.

- **Stack:** HTML5 · SCSS (Dart Sass, `@use` modules) · vanilla JavaScript. No framework, no runtime dependencies.
- **Fonts:** IBM Plex Sans Arabic (400–700) + IBM Plex Mono (400–500), self-hosted, SIL OFL.
- **Palette:** brand blue `#1b52d8` and navy `#021b8b` (taken from the logo files), black `#0a0a0a`, off-white `#f4f3ee`.

## Requirements

- Node.js 18+ (only for compiling SCSS and the local dev server)

## Setup & commands

```bash
npm install        # installs Dart Sass (+ the font packages used by `npm run fonts`)
npm run dev        # sass --watch + static server on http://localhost:5173
npm run build      # compressed production CSS → css/main.css
npm run serve      # static server only (PORT=8080 npm run serve to change the port)
npm run watch      # sass --watch only
npm run fonts      # re-copy the woff2 files from @fontsource into assets/fonts
```

`css/main.css` is committed (compressed build), so the site also works by opening `index.html` through any static server.

## Structure

```
index.html               all content (semantic HTML, SEO, JSON-LD, inline SVG sprite)
css/main.css             compiled output — do not edit by hand
scss/
  main.scss              entry: @use of every partial, in cascade order
  _variables.scss        design tokens: colors, themes, type scale, spacing, borders, motion, z-index, breakpoints
  _mixins.scss           up()/down() breakpoints, hover(), motion-ok(), theme(), container, press(), focus-ring…
  _fonts.scss            @font-face rules
  _reset.scss            minimal modern reset
  _typography.scss       type defaults, Arabic line-heights, metadata styles
  _base.scss             html/body, theme selectors, focus, skip link, sprite, icons
  _layout.scss           container, 4/6/12-column section grid, section heads
  _components.scss       buttons, links, navigation, mobile menu, loader, progress, marquee
  _sections.scss         hero, about, work + project artwork, experience, capabilities, stack, philosophy, contact, footer
  _animations.scss       keyframes, scroll-reveal system, reduced-motion overrides
  _responsive.scss       cross-cutting responsive tweaks (most queries live beside their component)
js/main.js               all behaviour, one init function per feature (see below)
assets/
  brand/logo, pattern, favicon   original brand pack (never edited)
  brand/web/             tight-cropped SVG copies of the logos in brand colors
  fonts/                 woff2 files
  icons/                 favicon.ico/svg, apple-touch-icon, PWA icons, site.webmanifest
  og/og-image.png        1200×630 social preview
  projects/              project screenshots (see assets/projects/README.md)
scripts/                 dev.mjs, serve.mjs, copy-fonts.mjs (zero dependencies)
```

### Theming

Every section declares `data-theme="light | dark | blue"`. The `theme()` mixin turns that into CSS custom properties
(`--bg --fg --muted --accent --line --shadow …`), and every component reads those variables. That is why the same button
or link works on any background. The navigation takes the theme of the section underneath it (`data-nav-theme`, set by JS).

### JavaScript (`js/main.js`)

A single IIFE. Each feature is its own `init…()` function started through `safeInit()`, so one failing feature
cannot break the others: loader clean-up, nav theme switching, active link, mobile menu (focus trap, ESC, scroll lock),
anchor focus management, scroll reveal (IntersectionObserver), marquee pause off-screen, scroll progress (rAF),
hero logo pointer response (±2°, ±8px),
contact-link guard, Riyadh clock, footer year, external-link `rel` hardening.
Everything respects `prefers-reduced-motion`; the loader and hero entrance are pure CSS and work without JS.

## Brand assets

- Logos are inlined once as `<symbol>`s in the sprite at the top of `index.html` (`#logo-monogram`, `#logo-wordmark`,
  `#logo-lockup`). The paths are the original artwork; only the whitespace was cropped and the fill is `currentColor`, so
  each placement is colored with CSS using brand colors only. Never scale them non-uniformly.
- Favicons and the OG image were generated from the monogram — regenerate them from `assets/brand/web/` if the brand changes.

## Content editing

### Add a project

1. In `index.html`, copy one `<article class="project">` block inside `.work__list`.
2. Update the number, eyebrow, title, description and the `<dl class="project__meta">` rows. Only publish facts you can stand behind.
3. Pick a layout modifier: `project--split-start`, `project--wide` or `project--split-end` (alternate them).
4. Visual: either keep a typographic `.project-art` placeholder or replace the `.project-art` div with a real screenshot:
   ```html
   <img class="project__image" src="assets/projects/my-project-01.webp" width="2400" height="1500"
        alt="وصف عربي للصورة" loading="lazy" decoding="async">
   ```
   (`.project__image` should fill the frame with `object-fit: cover` — add the rule in `_sections.scss` when adding the first screenshot.)
5. Live link: each CTA (`عرض المشروع`) has a placeholder href such as `__HAMESH_URL__` — replace it with the real URL.
   Until then `main.js` keeps the link inert (`aria-disabled`), so a placeholder never ships as a live link.

### Contact & social links

Search `index.html` for `CONTACT CONFIG`.

1. Replace every `__EMAIL__`, `__GITHUB__` and `__LINKEDIN__` placeholder (the big CTA uses `mailto:__EMAIL__`).
2. Remove the `hidden` attribute from `<ul class="contact__channels">` and from each `<li class="contact__channel">` you want to show.
3. Until a link is configured, `main.js` marks it `aria-disabled` and makes it inert, so a placeholder can never ship as a live link.

To add another channel (e.g. X), copy one `<li class="contact__channel">`. If you add public profiles, also add them to the
JSON-LD block as `"sameAs": ["https://…"]`.

### SEO

All metadata is in the `<head>` of `index.html`: `<title>`, description, canonical, Open Graph, Twitter/X and the
`Person` JSON-LD. The production domain (`https://devomar.me/`) appears in `canonical`, `og:url`, `og:image`,
`twitter:image` and the JSON-LD `url` — update all five if the domain changes.

## Deployment

It is a static site. Run `npm run build`, then upload `index.html`, `css/`, `js/` and `assets/` (without `node_modules/`,
`scss/` and `scripts/` if you want a minimal upload) to any static host: Cloudflare Pages, Netlify, GitHub Pages, or
Nginx/Caddy on a VPS. Recommended headers: long cache for `assets/fonts/*` and `assets/icons/*`, short cache for
`index.html`, `css/main.css`, `js/main.js` (or add a version query string when they change).
