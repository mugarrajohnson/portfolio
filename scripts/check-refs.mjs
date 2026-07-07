/* CI guard: internal anchors resolve, local assets exist, no NUL bytes, JS parses.
   Run: node scripts/check-refs.mjs */
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

let failures = 0;
const fail = (msg) => { failures++; console.error('FAIL: ' + msg); };

const html = readFileSync('index.html', 'utf8');

/* 1. Every href="#..." must match an id="..." */
const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
const anchors = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
for (const a of anchors) if (!ids.has(a)) fail(`anchor #${a} has no matching id`);

/* 2. Every local src/href must exist on disk */
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((m) => m[1])
  .filter((u) => !/^(https?:|#|mailto:|tel:|data:|\/\/)/.test(u));
for (const r of new Set(refs)) {
  if (!existsSync(decodeURIComponent(r))) fail(`referenced file missing: ${r}`);
}

/* 3. No NUL bytes in text files */
for (const f of ['index.html', 'script.js', 'sw.js', 'manifest.json', '404.html']) {
  if (existsSync(f) && readFileSync(f).includes(0)) fail(`${f} contains NUL bytes`);
}

/* 4. JS parses */
for (const f of ['script.js', 'sw.js']) {
  try { execFileSync('node', ['--check', f]); }
  catch { fail(`${f} failed syntax check`); }
}

if (failures) { console.error(`${failures} check(s) failed`); process.exit(1); }
console.log(`OK — ${anchors.length} anchors, ${new Set(refs).size} local refs, syntax clean`);
