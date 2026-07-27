# johnsonmugarra.com

Portfolio of Johnson Mugarra, data scientist and ML engineer in Kampala, working on forecasting, impact evaluation and data pipelines across East Africa.

![Johnson presenting vanilla forecasting findings at the National Vanilla Workshop](img/vanilla-workshop-800.webp)

## What's here

A single static page. No framework and no runtime dependencies of its own: HTML, a compiled Tailwind stylesheet, vanilla JS, and two D3 charts (a fraud-detection scatter on synthetic data, and a simulated vanilla harvest model). The contact form falls back through EmailJS, then Formspree, then mailto. Ships as a PWA with a service worker.

The one build step compiles Tailwind. Its output, `assets/styles.css`, is committed, so the site deploys as plain static files and the host needs no toolchain.

## Run it locally

Install once, then build the stylesheet:

```bash
npm install && npm run build
```

Serve the folder with anything:

```bash
python3 -m http.server 8000
```

While editing styles, keep Tailwind watching:

```bash
npm run dev
```

Or run it under nginx with the production config (gzip, cache headers, a 404 page):

```bash
docker build -t portfolio . && docker run -p 8080:80 portfolio
```

## Checks

`npm run verify` rebuilds the stylesheet and runs the guard script. CI runs the same thing on every push, plus a non-blocking external link check.

```bash
npm run verify
```

`scripts/check-refs.mjs` covers what a site with no test suite can still get wrong: internal anchors that point at nothing, `aria-controls` and `aria-labelledby` that reference missing ids, duplicate ids, missing local files, paths containing spaces, `<img>` without dimensions or alt text, service-worker precache entries that don't exist, invalid JSON in the manifest, and JS that doesn't parse. It also fails the build if the Tailwind CDN ever reappears in the markup.

If you change `src/tailwind.css`, run `npm run build` and commit `assets/styles.css`. CI rebuilds and fails on a diff.

## Layout

```
index.html          the page
src/tailwind.css    stylesheet source: design tokens, components, layout
assets/styles.css   compiled output, committed, linked by index.html
script.js           theme, nav, carousels, tabs, form, analytics
charts.js           the two D3 charts
sw.js               service worker
nginx.conf          production server config
scripts/            the CI guard
PRODUCT.md          brand and design principles
IMPROVEMENTS.md     longer-term direction
```

## Theming

Colours are CSS custom properties defined once in `src/tailwind.css` and exposed to Tailwind as `bg-background`, `text-ink`, `text-muted`, `border-line` and so on. Light mode swaps the variables and needs no per-utility overrides.

Two rules worth knowing:

Secondary text uses `text-muted` and `text-faint` rather than `text-ink` at low alpha, because cream needs more contrast than near-black to clear 4.5:1 and one alpha ramp cannot serve both themes.

Anything sitting on dark photography (the hero, project cover images) carries the `.on-dark` class or lives under `#hero`, which pins the ink tokens to their dark-mode values in both themes.

Both themes were checked against WCAG AA across every text node on the page.

Content © Johnson Mugarra. Get in touch via [johnsonmugarra.com](https://johnsonmugarra.com/#contact).
