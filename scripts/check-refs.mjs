/* CI guard for a site with no test suite.
 *
 * Checks that internal anchors resolve, local assets exist, the JS parses,
 * the compiled stylesheet is present and current, and that no reference
 * to a file path contains a space (which breaks on case- and
 * encoding-sensitive hosts).
 *
 * Run: node scripts/check-refs.mjs
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

let failures = 0;
const fail = (message) => {
  failures++;
  console.error(`FAIL  ${message}`);
};

const HTML_FILES = ['index.html', '404.html'];
const JS_FILES = ['script.js', 'charts.js', 'sw.js'];
const TEXT_FILES = [...HTML_FILES, ...JS_FILES, 'manifest.json'];

const html = readFileSync('index.html', 'utf8');

/* 1. Every href="#id" resolves to an element with that id. */
const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const anchors = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
for (const anchor of anchors) {
  if (!ids.has(anchor)) fail(`anchor #${anchor} has no matching id`);
}

/* 2. Every aria-controls points at a real id. */
for (const [, target] of html.matchAll(/aria-controls="([^"]+)"/g)) {
  if (!ids.has(target)) fail(`aria-controls="${target}" has no matching id`);
}

/* 3. Every labelling relationship resolves. */
for (const attr of ['aria-labelledby', 'aria-describedby']) {
  for (const [, value] of html.matchAll(new RegExp(`${attr}="([^"]+)"`, 'g'))) {
    for (const target of value.split(/\s+/)) {
      if (target && !ids.has(target)) fail(`${attr}="${target}" has no matching id`);
    }
  }
}

/* 4. No duplicate ids. */
const seen = new Set();
for (const [, id] of html.matchAll(/\sid="([^"]+)"/g)) {
  if (seen.has(id)) fail(`duplicate id="${id}"`);
  seen.add(id);
}

/* 5. Every local src/href exists on disk. */
const localRefs = new Set(
  [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((url) => !/^(https?:|#|mailto:|tel:|data:|\/\/)/.test(url))
);
for (const ref of localRefs) {
  const path = decodeURIComponent(ref.split(/[?#]/)[0]);
  if (!existsSync(path)) fail(`referenced file missing: ${ref}`);
  if (/\s/.test(path)) fail(`referenced path contains a space: ${ref}`);
}

/* 6. Every <img> declares intrinsic dimensions, so nothing shifts on load. */
for (const [tag] of html.matchAll(/<img\b[^>]*>/g)) {
  if (!/\swidth="/.test(tag) || !/\sheight="/.test(tag)) {
    const src = tag.match(/src="([^"]*)"/)?.[1] || tag.slice(0, 60);
    fail(`<img> without width/height: ${src}`);
  }
  if (!/\salt="/.test(tag)) {
    const src = tag.match(/src="([^"]*)"/)?.[1] || tag.slice(0, 60);
    fail(`<img> without alt: ${src}`);
  }
}

/* 7. The compiled stylesheet exists and is not empty.
      Whether it is *current* is checked in CI by rebuilding and
      diffing, because file mtimes are meaningless after a fresh
      clone and would make this check flaky. */
const CSS_OUT = 'assets/styles.css';
if (!existsSync(CSS_OUT)) fail(`${CSS_OUT} is missing — run: npm run build`);
else if (statSync(CSS_OUT).size < 1000) fail(`${CSS_OUT} looks truncated — run: npm run build`);

/* 8. The Tailwind CDN must never come back; it ships ~400kB of JS
      and generates styles at runtime. */
if (html.includes('cdn.tailwindcss.com')) {
  fail('index.html loads the Tailwind CDN — use the compiled assets/styles.css');
}

/* 9. No NUL bytes in text files. */
for (const file of TEXT_FILES) {
  if (existsSync(file) && readFileSync(file).includes(0)) fail(`${file} contains NUL bytes`);
}

/* 10. JS parses. */
for (const file of JS_FILES) {
  try {
    execFileSync(process.execPath, ['--check', file]);
  } catch {
    fail(`${file} failed the syntax check`);
  }
}

/* 11. manifest.json is valid and its icons exist. */
if (existsSync('manifest.json')) {
  try {
    const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
    for (const icon of manifest.icons || []) {
      if (!existsSync(icon.src)) fail(`manifest icon missing: ${icon.src}`);
    }
  } catch (error) {
    fail(`manifest.json is not valid JSON: ${error.message}`);
  }
}

/* 12. Everything the service worker precaches must exist. */
const sw = readFileSync('sw.js', 'utf8');
const precache = sw.match(/const PRECACHE_URLS = \[([\s\S]*?)\]/)?.[1] || '';
for (const [, url] of precache.matchAll(/'\.\/([^']+)'/g)) {
  if (!existsSync(url)) fail(`service worker precaches a missing file: ${url}`);
}

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log(`OK — ${anchors.length} anchors, ${localRefs.size} local refs, ${ids.size} ids, syntax clean`);
