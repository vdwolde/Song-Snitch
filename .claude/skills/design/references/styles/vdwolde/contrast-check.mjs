#!/usr/bin/env node
// vdWolde contrast gate (Brand Guide v1.0). Zero dependencies.
// Run: node contrast-check.mjs [--tokens <tokens.css>] [--self-test]
// Reads the colour tokens from tokens.css (default: ./snapshot/tokens.css, a copy of Branding/tokens/tokens.css) and checks
// the pairs the guide promises: 4.5:1 for text, 3:1 for rings, strokes and icons, in Dark Mode and Light Mode.
// Light Mode is measured on white and #F3F4F6; the lower score counts. Exit code 1 on any failure.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
export const ratio = (a, b) => { const x = lum(rgb(a)), y = lum(rgb(b)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// Accepted deviation from Brand Guide v1.0 (found 2026-11-06, accepted by the owner 2026-11-07): the Light Mode control edge #8A919E is
// 3.17:1 on white but 2.88:1 on the #F3F4F6 ground, below the 3:1 the guide states. It stays as designed; #838A97 would pass on both.
// Listed so it is never reported as a new failure; remove it from this set if the guide ever changes the token.
export const KNOWN_GAPS = new Set(['control edge on light ground']);

export function loadTokens(file) {
  const css = readFileSync(file, 'utf8');
  return Object.fromEntries([...css.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6});/g)].map((m) => [m[1], m[2].toUpperCase()]));
}

export function checks(t) {
  const out = [];
  const add = (name, fg, bgs, min) => { for (const [bn, bg] of bgs) out.push({ name: `${name} on ${bn}`, r: ratio(fg, bg), min }); };
  const dark = [['dark ground', t['neutral-dark-ground']], ['dark surface', t['neutral-dark-surface']], ['dark raised', t['neutral-dark-raised']]];
  const light = [['white', '#FFFFFF'], ['light ground', t['neutral-light-ground']]];
  add('text', t['neutral-dark-text'], dark, 4.5); add('text muted', t['neutral-dark-text-muted'], dark, 4.5); add('text subtle', t['neutral-dark-text-subtle'], dark, 4.5);
  add('text', t['neutral-light-text'], light, 4.5); add('text muted', t['neutral-light-text-muted'], light, 4.5); add('text subtle', t['neutral-light-text-subtle'], light, 4.5);
  add('control edge', t['neutral-dark-control-edge'], dark.slice(0, 2), 3); add('control edge', t['neutral-light-control-edge'], light, 3);
  for (const s of ['pink', 'orange', 'amber', 'yellow', 'green', 'sky', 'violet']) {
    add(`${s} text (Dark Mode: light shade)`, t[`signal-${s}-light`], dark.slice(0, 2), 4.5);
    add(`${s} text (Light Mode: ${t[`signal-${s}-text`] ? 'text' : 'deep'} shade)`, t[`signal-${s}-text`] ?? t[`signal-${s}-deep`], light, 4.5);
    add(`${s} focus ring`, t[`signal-${s}-vivid`], dark.slice(0, 2), 3);
    add(`${s} label on fill`, '#0F1115', [[`${s} fill`, t[`signal-${s}-ui-fill`] ?? t[`signal-${s}-vivid`]]], 4.5);
  }
  for (const s of ['ok', 'warn', 'danger']) {
    add(`status ${s} text`, t[`status-${s}-text-dark`], dark.slice(0, 2), 4.5);
    add(`status ${s} text`, t[`status-${s}-text-light`], light, 4.5);
  }
  add('status info text', t['status-info-text-dark'], dark.slice(0, 2), 4.5); add('status info text', t['status-info-text-light'], light, 4.5);
  return out;
}

function selfTest() {
  let fail = 0;
  const t = (c, m) => { if (!c) { fail++; console.error('FAIL', m); } };
  t(Math.abs(ratio('#000000', '#FFFFFF') - 21) < 0.01, 'black on white is 21:1');
  t(ratio('#777777', '#777777') === 1, 'same colour is 1:1');
  const tok = loadTokens(join(HERE, 'snapshot', 'tokens.css'));
  t(tok['signal-pink-vivid'] === '#F0428C', 'tokens parse');
  const bad = checks(tok).filter((c) => c.r < c.min && !KNOWN_GAPS.has(c.name));
  t(bad.length === 0, `kit tokens pass the gate (${bad.map((b) => b.name + ' ' + b.r.toFixed(2)).join('; ')})`);
  console.log(fail ? `self-test: ${fail} failed` : 'self-test: passed');
  return !fail;
}

const args = process.argv.slice(2);
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (args.includes('--self-test')) process.exit(selfTest() ? 0 : 1);
  const i = args.indexOf('--tokens');
  const results = checks(loadTokens(i >= 0 ? args[i + 1] : join(HERE, 'snapshot', 'tokens.css')));
  let fails = 0;
  for (const c of results) { const ok = c.r >= c.min; const known = !ok && KNOWN_GAPS.has(c.name); if (!ok && !known) fails++; console.log(`${ok ? 'pass' : known ? 'accepted' : 'FAIL'}  ${c.r.toFixed(2).padStart(5)} (min ${c.min})  ${c.name}`); }
  console.log(fails ? `\n${fails} failing pair(s)` : `\nall ${results.length} pairs pass`);
  process.exit(fails ? 1 : 0);
}
