#!/usr/bin/env node
// design-tools.mjs -- deterministic helpers for the /design skill. Zero dependencies. Read-only:
// it prints to stdout and never writes a project file. Two exceptions, both ported from unslop (CC BY 4.0, see
// § snapshot and story): `snapshot` and `story` load Playwright (and ffmpeg for story) only when they run, and write
// only the output paths you name (story also uses a temporary .story-frames folder next to the story file).
//
//   node design-tools.mjs contrast <fg> <bg> [<fg> <bg> ...]   WCAG ratio per pair
//   node design-tools.mjs oklch <colour>                       hex / rgb() / oklch() -> oklch(L C H)
//   node design-tools.mjs hex <colour>                         any colour -> #rrggbb (gamut-mapped)
//   node design-tools.mjs ramp <colour> [--steps 11]           lightness ramp, same hue, chroma tapered at the ends
//   node design-tools.mjs retint <colour> <targetColour>       keep L and C of colour, take hue of target
//   node design-tools.mjs inventory <path...> [--top 15] [--delta 0.03] [--json]
//   node design-tools.mjs snapshot <url|file> <out.html> [label] [--dark|--light] [--width 1440] [--height 810]
//   node design-tools.mjs story <story.html> <out.mp4> [--wide]  |  story <story.html> --play
//   node design-tools.mjs --self-test
//
// Colours accepted: #rgb #rrggbb #rrggbbaa rgb(r g b) rgb(r, g, b) color(srgb r g b) oklch(L C H) (L as 0-1 or %).
// Alpha is ignored: composite a translucent colour over its background yourself before checking contrast.
// Run with `node` (an already-trusted host process on this machine), never as a compiled binary.
// Inventory limits: colour, font-size, radius, shadow, duration and z-index literals are found in CSS,
// markup, JS/TS and XAML; duplicate/unused token analysis covers CSS custom properties only. Results are
// candidates to read, not verdicts.

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';

// ---------- colour maths (Ottosson oklab, sRGB, WCAG 2.x) ----------

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function linearToOklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToLinear([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const oklabToOklch = ([L, a, b]) => {
  const C = Math.hypot(a, b);
  let H = (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return [L, C, C < 1e-4 ? 0 : H];
};
const oklchToOklab = ([L, C, H]) => [L, C * Math.cos((H * Math.PI) / 180), C * Math.sin((H * Math.PI) / 180)];

const inGamut = (lin) => lin.every((v) => v >= -0.0005 && v <= 1.0005);

// Reduce chroma (keeping L and H) until the colour fits in sRGB.
function gamutMapOklch([L, C, H]) {
  if (inGamut(oklabToLinear(oklchToOklab([L, C, H])))) return { lch: [L, C, H], mapped: false };
  let lo = 0;
  let hi = C;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklabToLinear(oklchToOklab([L, mid, H])))) lo = mid;
    else hi = mid;
  }
  return { lch: [L, lo, H], mapped: true };
}

function oklchToRgb255(lch) {
  const { lch: g, mapped } = gamutMapOklch(lch);
  const lin = oklabToLinear(oklchToOklab(g)).map(clamp01);
  return { rgb: lin.map((v) => Math.round(toGamma(v) * 255)), mapped };
}

const rgb255ToHex = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
const rgb255ToOklch = (rgb) => oklabToOklch(linearToOklab(rgb.map((v) => toLinear(v / 255))));

// Parse any accepted colour string -> { rgb: [0-255 x3] | null, lch: [L,C,H] } (rgb is gamut-mapped for oklch input).
function parseColour(input) {
  const s = String(input).trim().toLowerCase();
  let m = s.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) throw new Error(`bad hex colour: ${input}`);
    const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    return { rgb, lch: rgb255ToOklch(rgb) };
  }
  m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/);
  if (m) {
    const rgb = [m[1], m[2], m[3]].map((v) => Math.round(Math.min(255, Math.max(0, Number(v)))));
    return { rgb, lch: rgb255ToOklch(rgb) };
  }
  // getComputedStyle in Chrome returns color(srgb r g b) for colour-mix() and some modern colours
  m = s.match(/^color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (m) {
    const rgb = [m[1], m[2], m[3]].map((v) => Math.round(clamp01(Number(v)) * 255));
    return { rgb, lch: rgb255ToOklch(rgb) };
  }
  m = s.match(/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?/);
  if (m) {
    const L = m[2] ? Number(m[1]) / 100 : Number(m[1]);
    const lch = [L, Number(m[3]), Number(m[4])];
    return { rgb: oklchToRgb255(lch).rgb, lch };
  }
  throw new Error(`unrecognised colour: ${input}`);
}

function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => toLinear(v / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(rgbA, rgbB) {
  const a = luminance(rgbA);
  const b = luminance(rgbB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const fmtLch = ([L, C, H]) => `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(1)})`;

function deltaE(lchA, lchB) {
  const [L1, a1, b1] = oklchToOklab(lchA);
  const [L2, a2, b2] = oklchToOklab(lchB);
  return Math.hypot(L1 - L2, a1 - a2, b1 - b2);
}

// ---------- commands: contrast / oklch / hex / ramp / retint ----------

function cmdContrast(args) {
  if (args.length < 2 || args.length % 2) throw new Error('contrast needs pairs: <fg> <bg> [<fg> <bg> ...]');
  const rows = [];
  for (let i = 0; i < args.length; i += 2) {
    const fg = parseColour(args[i]);
    const bg = parseColour(args[i + 1]);
    const ratio = contrastRatio(fg.rgb, bg.rgb);
    rows.push(
      `${args[i]} on ${args[i + 1]}  ${ratio.toFixed(2)}:1  text(4.5) ${ratio >= 4.5 ? 'pass' : 'FAIL'}  ` +
        `large/UI(3) ${ratio >= 3 ? 'pass' : 'FAIL'}  AAA(7) ${ratio >= 7 ? 'pass' : 'no'}`,
    );
  }
  return rows.join('\n');
}

function cmdOklch(args) {
  const c = parseColour(args[0]);
  return fmtLch(c.lch);
}

function cmdHex(args) {
  const c = parseColour(args[0]);
  const { rgb, mapped } = oklchToRgb255(c.lch);
  return rgb255ToHex(rgb) + (mapped ? '   (chroma reduced to fit sRGB)' : '');
}

function cmdRamp(args) {
  const stepsIdx = args.indexOf('--steps');
  const steps = stepsIdx >= 0 ? Number(args[stepsIdx + 1]) : 11;
  const c = parseColour(args[0]);
  const [, C, H] = c.lch;
  const labels = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
  const out = [`ramp from ${args[0]}  ${fmtLch(c.lch)}  (hue kept; chroma tapers toward the light and dark ends and is reduced where sRGB cannot hold it)`];
  for (let i = 0; i < steps; i++) {
    const L = 0.97 - (i * (0.97 - 0.15)) / (steps - 1);
    const t = Math.abs(L - 0.62) / 0.38; // chroma peaks mid-ramp and tapers toward the light and dark ends
    const { rgb, mapped } = oklchToRgb255([L, C * Math.max(0.15, 1 - 0.85 * t * t), H]);
    const lch = rgb255ToOklch(rgb);
    const label = steps === 11 ? String(labels[i]).padEnd(4) : String(i + 1).padEnd(4);
    out.push(`${label} ${rgb255ToHex(rgb)}  ${fmtLch(lch)}${mapped ? '  (gamut-mapped)' : ''}`);
  }
  return out.join('\n');
}

function cmdRetint(args) {
  if (args.length < 2) throw new Error('retint needs <colour> <targetColour>');
  const from = parseColour(args[0]);
  const target = parseColour(args[1]);
  const lch = [from.lch[0], from.lch[1], target.lch[2]];
  const { rgb, mapped } = oklchToRgb255(lch);
  return `${rgb255ToHex(rgb)}  ${fmtLch(rgb255ToOklch(rgb))}${mapped ? '  (gamut-mapped)' : ''}  (L and C of ${args[0]}, hue of ${args[1]})`;
}

// ---------- inventory ----------

const SKIP_DIRS = new Set(['node_modules', '.git', 'bin', 'obj', 'dist', 'build', '.next', '.venv', '__pycache__', '.ruff_cache', 'coverage', '.turbo']);
const TEXT_EXT = new Set(['.css', '.scss', '.less', '.html', '.htm', '.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte', '.astro', '.xaml', '.axaml', '.cshtml', '.razor']);
const COMPONENT_EXT = new Set(['.jsx', '.tsx', '.vue', '.svelte', '.astro', '.xaml', '.axaml', '.razor']);

function walk(p, files = []) {
  let st;
  try { st = fs.statSync(p); } catch { return files; }
  if (st.isFile()) {
    if (TEXT_EXT.has(path.extname(p).toLowerCase()) && st.size < 1_000_000) files.push(p);
    return files;
  }
  for (const name of fs.readdirSync(p)) {
    if (SKIP_DIRS.has(name)) continue;
    walk(path.join(p, name), files);
  }
  return files;
}

// A value that is only a token reference (or none/0) is not a literal.
const isRef = (v) => /^\s*(?:var\([^)]*\)|none|0|inherit|initial)\s*(?:!important)?\s*$/i.test(v);

const bump = (map, key, loc) => {
  const e = map.get(key) || { n: 0, at: [] };
  e.n++;
  if (e.at.length < 3) e.at.push(loc);
  map.set(key, e);
};

function inventory(paths, { top = 15, delta = 0.03, json = false } = {}) {
  const files = paths.flatMap((p) => walk(p));
  const colours = new Map(); // hex -> {n, at, stray}
  const strayColours = new Map();
  const cats = { 'font-size': new Map(), radius: new Map(), shadow: new Map(), duration: new Map(), 'z-index': new Map(), 'arbitrary-tailwind': new Map() };
  const tokenDefs = []; // {name, value, loc}
  const allText = [];
  const sigs = []; // component structure signatures

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    allText.push(text);
    const ext = path.extname(file).toLowerCase();
    const isXaml = ext === '.xaml' || ext === '.axaml';
    const xamlDict = isXaml && /<ResourceDictionary[\s>]/.test(text.slice(0, 2000)) && !/<(Window|UserControl|Page)[\s>]/.test(text.slice(0, 2000));
    const rel = path.relative(process.cwd(), file) || file;
    const lines = text.split(/\r?\n/);
    lines.forEach((line, i) => {
      const loc = `${rel}:${i + 1}`;
      const isDef = /^\s*--[\w-]+\s*:/.test(line) || (xamlDict && /(x:Key|Color=|SolidColorBrush)/.test(line));
      const def = line.match(/^\s*(--[\w-]+)\s*:\s*([^;]+);?/);
      if (def) tokenDefs.push({ name: def[1], value: def[2].trim().toLowerCase(), loc });
      // colours
      for (const m of line.matchAll(/#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g)) {
        let h = m[1].toLowerCase();
        if (h.length <= 4) h = [...h].map((c) => c + c).join('');
        const hex = '#' + (h.length === 8 ? (isXaml ? h.slice(2) : h.slice(0, 6)) : h);
        bump(colours, hex, loc);
        if (!isDef) bump(strayColours, hex, loc);
      }
      for (const m of line.matchAll(/\b(?:rgba?|hsla?|oklch)\([^)]*\)/gi)) {
        try {
          if (/^oklch|^rgb/i.test(m[0])) {
            const c = parseColour(m[0]);
            const hex = rgb255ToHex(oklchToRgb255(c.lch).rgb);
            bump(colours, hex, loc);
            if (!isDef) bump(strayColours, hex, loc);
          } else if (!isDef) bump(strayColours, m[0].toLowerCase().replace(/\s+/g, ' '), loc);
        } catch { /* ignore unparseable */ }
      }
      // other literals (outside token definitions)
      if (!isDef) {
        for (const m of line.matchAll(/font-size\s*:\s*([\d.]+(?:px|rem|em|pt|%))/gi)) bump(cats['font-size'], m[1], loc);
        for (const m of line.matchAll(/FontSize\s*=\s*"([\d.]+)"/g)) bump(cats['font-size'], m[1], loc);
        for (const m of line.matchAll(/border-radius\s*:\s*([^;}"']+)/gi)) if (!isRef(m[1])) bump(cats.radius, m[1].trim(), loc);
        for (const m of line.matchAll(/CornerRadius\s*=\s*"([^"]+)"/g)) bump(cats.radius, m[1], loc);
        for (const m of line.matchAll(/box-shadow\s*:\s*([^;}"']+)/gi)) if (!isRef(m[1])) bump(cats.shadow, m[1].trim().replace(/\s+/g, ' '), loc);
        for (const m of line.matchAll(/(?:transition(?:-duration)?|animation(?:-duration)?)\s*:[^;]*?\b([\d.]+m?s)\b/gi)) bump(cats.duration, m[1], loc);
        for (const m of line.matchAll(/Duration\s*=\s*"([^"]+)"/g)) bump(cats.duration, m[1], loc);
        for (const m of line.matchAll(/z-index\s*:\s*(-?\d+)/gi)) bump(cats['z-index'], m[1], loc);
        for (const m of line.matchAll(/\b[a-z-]+-\[[^\]\s]+\]/g)) bump(cats['arbitrary-tailwind'], m[0], loc);
      }
    });
    if (COMPONENT_EXT.has(ext)) {
      const tokens = new Set([...text.matchAll(/<([A-Za-z][\w.:-]*)/g)].map((m) => m[1]));
      for (const m of text.matchAll(/class(?:Name)?\s*=\s*["'{`]([^"'}`]+)/g)) m[1].split(/\s+/).forEach((c) => c && tokens.add('.' + c));
      if (tokens.size >= 8) sigs.push({ file: rel, tokens });
    }
  }

  // colour clusters: distinct values within delta of each other
  const list = [...colours.entries()].map(([hex, v]) => ({ hex, ...v, lch: parseColour(hex).lch }));
  const clusters = [];
  const used = new Set();
  list.sort((a, b) => b.n - a.n);
  for (const c of list) {
    if (used.has(c.hex)) continue;
    const members = list.filter((o) => !used.has(o.hex) && deltaE(c.lch, o.lch) <= delta);
    members.forEach((m) => used.add(m.hex));
    if (members.length > 1) clusters.push(members);
  }

  // duplicate and unused tokens
  const byValue = new Map();
  for (const t of tokenDefs) {
    const k = t.value;
    (byValue.get(k) || byValue.set(k, []).get(k)).push(t);
  }
  const dupes = [...byValue.values()].filter((g) => new Set(g.map((t) => t.name)).size > 1 && g[0].value.length > 2 && !/^var\(/.test(g[0].value));
  // A token is "unused" when no line outside its own definition mentions it, either as --name or as a
  // Tailwind-style utility built from the bare name (bg-primary, text-foreground).
  const allLines = allText.flatMap((t) => t.split(/\r?\n/));
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
  const unused = [...new Set(tokenDefs.map((t) => t.name))].filter((name) => {
    const bare = name.replace(/^--/, '').replace(/^(color|radius|font|text|spacing|shadow|ease|animate)-/, '');
    const nameRe = new RegExp('(?<![\\w-])' + esc(name) + '(?![\\w-])');
    const bareRe = bare ? new RegExp('(?<!\\w)' + esc(bare) + '(?![\\w-])') : null;
    const ownDef = new RegExp('^\\s*' + esc(name) + '\\s*:');
    return !allLines.some((l) => !ownDef.test(l) && (nameRe.test(l) || (bareRe && bareRe.test(l))));
  });

  // similar components
  const similar = [];
  const cap = sigs.slice(0, 400);
  for (let i = 0; i < cap.length; i++) {
    for (let j = i + 1; j < cap.length; j++) {
      const a = cap[i].tokens;
      const b = cap[j].tokens;
      let inter = 0;
      for (const t of a) if (b.has(t)) inter++;
      const jac = inter / (a.size + b.size - inter);
      if (jac >= 0.8) similar.push({ a: cap[i].file, b: cap[j].file, jac });
    }
  }
  similar.sort((x, y) => y.jac - x.jac);

  const topOf = (map) => [...map.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, top).map(([value, v]) => ({ value, n: v.n, at: v.at }));
  const result = {
    filesScanned: files.length,
    colours: { distinct: colours.size, strayDistinct: strayColours.size, strayTotal: [...strayColours.values()].reduce((s, v) => s + v.n, 0), topStray: topOf(strayColours) },
    nearDuplicateColourClusters: clusters.slice(0, top).map((g) => g.map((m) => ({ hex: m.hex, n: m.n, at: m.at[0] }))),
    ...Object.fromEntries(Object.entries(cats).map(([k, map]) => [k, { distinct: map.size, total: [...map.values()].reduce((s, v) => s + v.n, 0), top: topOf(map) }])),
    duplicateTokens: dupes.slice(0, top).map((g) => ({ value: g[0].value, names: g.map((t) => t.name), at: g[0].loc })),
    unusedTokenCandidates: unused.slice(0, top * 2),
    similarComponentCandidates: similar.slice(0, top).map((s) => ({ ...s, jac: Number(s.jac.toFixed(2)) })),
  };
  if (json) return JSON.stringify(result, null, 2);

  const L = [];
  L.push(`scanned ${result.filesScanned} files`);
  L.push(`colours: ${result.colours.distinct} distinct, ${result.colours.strayDistinct} distinct outside token definitions (${result.colours.strayTotal} uses)`);
  for (const s of result.colours.topStray) L.push(`  stray ${s.value}  x${s.n}  ${s.at[0]}`);
  L.push(`near-duplicate colour clusters (within dE ${delta}): ${clusters.length}`);
  for (const g of result.nearDuplicateColourClusters) L.push('  ' + g.map((m) => `${m.hex} x${m.n}`).join(' ~ ') + `  (${g[0].at})`);
  for (const [k, v] of Object.entries(result).filter(([k]) => k in cats)) {
    L.push(`${k} literals outside tokens: ${v.distinct} distinct, ${v.total} uses`);
    for (const t of v.top) L.push(`  ${t.value}  x${t.n}  ${t.at[0]}`);
  }
  L.push('note: duplicate/unused token analysis reads CSS custom properties only; XAML ResourceDictionary keys and XAML Margin/Padding are not analysed (0 here does not mean clean)');
  L.push(`tokens defined twice under different names: ${dupes.length}`);
  for (const d of result.duplicateTokens) L.push(`  ${d.value}  <- ${d.names.join(', ')}  (${d.at})`);
  L.push(`unused token candidates (verify before deleting; Tailwind utilities can hide uses): ${unused.length}`);
  for (const u of result.unusedTokenCandidates) L.push(`  ${u}`);
  L.push(`similar components, structure only (candidates, read both before merging): ${similar.length}`);
  for (const s of result.similarComponentCandidates) L.push(`  ${s.jac}  ${s.a}  ~  ${s.b}`);
  return L.join('\n');
}

// ---------- catalog: row lookup in the local CSV data set, and sections of the big reference documents ----------
// The data set is large (styles.csv alone is 154 KB) and a lookup needs a few rows, so these print only what matches.

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_DIR = path.join(SKILL_DIR, 'references', 'ui-catalog');

// RFC 4180: quoted fields may hold commas, doubled quotes and line breaks.
function parseCsv(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows = []; let row = []; let f = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; rows.push(row); row = []; }
    else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.some((x) => x !== ''));
}

const clip = (s, n) => (s.length > n ? `${s.slice(0, n)}…` : s);
function listCsvNames(dir) {
  const out = [];
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) { for (const m of fs.readdirSync(p)) if (m.endsWith('.csv')) out.push(`${n}/${m.slice(0, -4)}`); } else if (n.endsWith('.csv')) out.push(n.slice(0, -4));
  }
  return out.sort();
}

// catalog <file> [--q "words"] [--where "Column=regex"]... [--cols "A,B"] [--limit 8] [--full] [--list]
function cmdCatalog(args, dir = CATALOG_DIR) {
  const o = { q: '', where: [], cols: null, limit: 8, full: false, list: false }; let file = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--q') o.q = args[++i] || '';
    else if (a === '--where') o.where.push(args[++i] || '');
    else if (a === '--cols') o.cols = String(args[++i] || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    else if (a === '--limit') o.limit = Number(args[++i]);
    else if (a === '--full') o.full = true;
    else if (a === '--list') o.list = true;
    else if (!file) file = a;
  }
  if (!file) throw new Error(`catalog needs a file name. Available: ${listCsvNames(dir).join(', ')}`);
  const full = path.resolve(dir, `${file.replace(/\.csv$/i, '')}.csv`);
  if (!full.startsWith(path.resolve(dir) + path.sep)) throw new Error('catalog reads only inside the ui-catalog folder');
  if (!fs.existsSync(full)) throw new Error(`no catalog file "${file}". Available: ${listCsvNames(dir).join(', ')}`);
  if (!(o.limit >= 1)) throw new Error('--limit must be a positive number');
  const [header, ...data] = parseCsv(fs.readFileSync(full, 'utf8'));
  const col = (name) => {
    const n = name.toLowerCase();
    const i = header.findIndex((h) => h.toLowerCase() === n); const j = i >= 0 ? i : header.findIndex((h) => h.toLowerCase().startsWith(n));
    if (j < 0) throw new Error(`no column "${name}" in ${file}. Columns: ${header.join(' | ')}`);
    return j;
  };
  if (o.list) return [`${file}: ${data.length} row(s); columns: ${header.join(' | ')}`, ...data.map((r) => `  ${r.slice(0, 3).map((x) => clip(x, 50)).join(' | ')}`)].join('\n');
  let rows = data;
  for (const w of o.where) {
    const k = w.indexOf('='); if (k < 1) throw new Error(`--where wants Column=regex, got "${w}"`);
    const idx = col(w.slice(0, k)); const re = new RegExp(w.slice(k + 1), 'i');
    rows = rows.filter((r) => re.test(r[idx] || ''));
  }
  const words = [...new Set(o.q.toLowerCase().split(/[\s,]+/).filter((x) => x.length > 1))];
  let scored = rows.map((r) => {
    const all = r.join(' ').toLowerCase(); const name = (r[1] || '').toLowerCase();
    return { r, s: words.reduce((t, x) => t + (all.includes(x) ? 1 : 0) + (name.includes(x) ? 1 : 0), 0) };
  });
  if (words.length) scored = scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  const picked = scored.slice(0, o.limit);
  if (!picked.length) return `catalog ${file}: no row matched${words.length ? ` "${o.q}"` : ''}${o.where.length ? ` with ${o.where.join(' and ')}` : ''} (of ${data.length}). Try fewer or other words, \`--list\` for the names, or check the columns: ${header.join(' | ')}`;
  const want = o.cols ? o.cols.map(col) : header.map((_, i) => i);
  const out = [`catalog ${file}: ${scored.length} of ${data.length} row(s) match, showing ${picked.length}${scored.length > picked.length ? ' (--limit for more)' : ''}`];
  for (const { r } of picked) {
    out.push(`#${r[0]}`);
    for (const i of want) if (i !== 0 && (r[i] || '') !== '') out.push(`  ${header[i]}: ${o.full ? r[i] : clip(r[i], 240)}`);
  }
  return out.join('\n');
}

// Headings of a Markdown file (code fences skipped), each with the line range of its section.
function mdOutline(text) {
  const lines = text.split(/\r?\n/); const heads = []; let fence = false;
  lines.forEach((l, i) => {
    if (/^\s*```/.test(l)) { fence = !fence; return; }
    const m = !fence && /^(#{1,6})\s+(.+?)\s*$/.exec(l);
    if (m) heads.push({ level: m[1].length, title: m[2], start: i + 1 });
  });
  heads.forEach((h, k) => { const next = heads.slice(k + 1).find((x) => x.level <= h.level); h.end = next ? next.start - 1 : lines.length; });
  return { lines, heads };
}
function skillFile(file) {
  const full = path.resolve(SKILL_DIR, file);
  if (!full.startsWith(SKILL_DIR + path.sep) || !fs.existsSync(full)) throw new Error(`"${file}" is not a file inside the design skill folder (give a path relative to it, e.g. references/styles/liquid-glass/SPEC.md)`);
  return full;
}
function cmdToc(args, base) {
  if (!args[0]) throw new Error('toc needs a file');
  const { heads } = mdOutline(fs.readFileSync(base || skillFile(args[0]), 'utf8'));
  return [`${args[0]}: ${heads.length} heading(s); \`section ${args[0]} "<heading words>"\` prints one`, ...heads.filter((h) => h.level <= 3).map((h) => `  L${h.start}-${h.end}  ${'#'.repeat(h.level)} ${h.title}`)].join('\n');
}
function cmdSection(args, base) {
  const full = args.includes('--full'); const rest = args.filter((a) => a !== '--full');
  if (rest.length < 2) throw new Error('section needs a file and a heading pattern (a regex, case-insensitive)');
  const { lines, heads } = mdOutline(fs.readFileSync(base || skillFile(rest[0]), 'utf8'));
  const re = new RegExp(rest[1], 'i');
  const hits = heads.filter((h) => re.test(h.title));
  if (!hits.length) throw new Error(`no heading matches /${rest[1]}/ in ${rest[0]}; \`toc ${rest[0]}\` lists them`);
  const h = hits[0]; const body = lines.slice(h.start - 1, h.end);
  const cap = full ? Infinity : 400;
  return [`${rest[0]} L${h.start}-${h.end}${hits.length > 1 ? ` (first of ${hits.length} matches: ${hits.slice(1, 6).map((x) => `"${x.title}"`).join(', ')})` : ''}`, ...body.slice(0, cap), ...(body.length > cap ? [`… ${body.length - cap} more line(s): rerun with --full`] : [])].join('\n');
}

// ---------- snapshot and story (ported from unslop) ----------
// Ported from unslop by Damir Sokolovsky (@heydamir), CC BY 4.0, plugin hash 620163eedb35:
// scripts/snapshot.mjs, scripts/story.mjs and scripts/story-path.mjs. Changed: folded into this helper as two
// subcommands; argument and meta parsing split into pure functions the self-test covers; errors thrown instead of
// process.exit; Playwright and ffmpeg resolved from this machine's global npm prefix (see resolveFromGlobal);
// macOS/Linux Chrome paths dropped (CHROME_PATH still wins). The render logic and the video credit are unchanged.
// These two are the only commands that need anything outside node: Playwright (both) and ffmpeg (story). Nothing
// else in this file loads them, so every other command and --self-test stay zero-dependency.

function resolveAll(name) {
  // A project's own install first, then the machine-wide npm prefix (root CLAUDE.md § Windows dev-machine hygiene:
  // npm_config_prefix points at the base's .state\npm-global), then npm's default prefix.
  const bases = [path.join(process.cwd(), 'package.json')];
  for (const dir of [process.env.npm_config_prefix, process.env.APPDATA && path.join(process.env.APPDATA, 'npm')]) {
    if (dir) bases.push(path.join(dir, 'node_modules', 'noop.js'), path.join(dir, 'lib', 'node_modules', 'noop.js'));
  }
  const found = [];
  for (const base of bases) {
    try { found.push(createRequire(base)(name)); } catch { /* next */ }
  }
  return found;
}
const resolveFromGlobal = (name) => resolveAll(name)[0] ?? null;

function browserKit() {
  // A project may pin its own Playwright whose Chromium build was never downloaded (Inspiration Gallery pins
  // 1.62.1, the shared browser is 1.64's), so take the first install whose browser actually exists.
  const kits = [...resolveAll('playwright'), ...resolveAll('playwright-core')];
  if (!kits.length) throw new Error('Playwright is not installed: npm install -g --save-exact playwright@1.64.1 (it uses the Chromium already in PLAYWRIGHT_BROWSERS_PATH)');
  const usable = (kit) => { try { return fs.existsSync(kit.chromium.executablePath()); } catch { return false; } };
  return kits.find(usable) ?? kits[0];
}

function ffmpegPath() {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH;
  const stat = resolveFromGlobal('ffmpeg-static');
  if (typeof stat === 'string' && fs.existsSync(stat)) return stat;
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return 'ffmpeg'; } catch { /* missing */ }
  throw new Error('ffmpeg is not installed: npm install -g --allow-scripts=ffmpeg-static ffmpeg-static@5.3.0');
}

const chromeOptions = () => (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH) ? { executablePath: process.env.CHROME_PATH } : {});

function parseSnapshotArgs(args) {
  const usage = 'usage: snapshot <url or local file> <out.html> [pass label] [--dark | --light] [--width 1440] [--height 810]';
  const positionals = [];
  let width = 1440;
  let height = 810;
  const size = (name, value) => {
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0) throw new Error(`--${name} must be a whole number above 0, got "${value}"`);
    return n;
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const match = /^--(width|height)(?:=(.*))?$/.exec(arg);
    if (match) {
      const value = match[2] ?? args[++i];
      if (value === undefined || value.startsWith('--')) throw new Error(`--${match[1]} needs a value, like --${match[1]} 1440`);
      if (match[1] === 'width') width = size('width', value);
      else height = size('height', value);
    } else if (!arg.startsWith('--')) {
      positionals.push(arg);
    }
  }
  const [url, out, label] = positionals;
  if (!url || !out) throw new Error(usage);
  const scheme = args.includes('--dark') ? 'dark' : args.includes('--light') ? 'light' : 'no-preference';
  // A path on disk is a page too: Playwright rejects a bare file path with a protocol error, so turn it into a URL.
  const target = fs.statSync(url, { throwIfNoEntry: false })?.isFile() ? pathToFileURL(path.resolve(url)).href : url;
  return { target, out, label, scheme, width, height };
}

async function cmdSnapshot(args) {
  const { target, out, label, scheme, width, height } = parseSnapshotArgs(args);
  const { chromium } = browserKit();
  const browser = await chromium.launch(chromeOptions());
  try {
    const page = await browser.newPage({ viewport: { width, height }, colorScheme: scheme });
    await page.goto(target, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
    await page.evaluate(async () => {
      const pause = (ms) => new Promise((done) => setTimeout(done, ms));
      const root = document.scrollingElement || document.documentElement;
      let last = root.scrollHeight;
      for (let step = 0; step < 30 && root.scrollTop < 20_000; step++) {
        window.scrollBy(0, window.innerHeight);
        await pause(150);
        const grown = root.scrollHeight;
        if (grown <= last && root.scrollTop + window.innerHeight >= grown) break;
        last = grown;
      }
      window.scrollTo(0, 0);
      const loaded = (image) => new Promise((done) => {
        image.addEventListener('load', done, { once: true });
        image.addEventListener('error', done, { once: true });
      });
      const pending = [...document.images].filter((image) => !image.complete);
      await Promise.race([Promise.all(pending.map(loaded)), pause(5000)]);
    });
    const html = await page.evaluate(async ([label, scheme]) => {
      const LIMIT = 3_000_000;
      const absolute = (value, base = location.href) => { try { return new URL(value, base).href; } catch { return value; } };
      const inlined = new Map();
      const inline = async (href) => {
        if (!href || href.startsWith('data:')) return href;
        if (!inlined.has(href)) {
          inlined.set(href, fetch(href)
            .then((response) => (response.ok ? response.blob() : null))
            .then((blob) => (blob && blob.size < LIMIT
              ? new Promise((done) => { const reader = new FileReader(); reader.onload = () => done(reader.result); reader.readAsDataURL(blob); })
              : href))
            .catch(() => href));
        }
        return inlined.get(href);
      };
      const urls = async (css, base) => {
        const found = [...css.matchAll(/url\((['"]?)(?!data:)([^)'"]+)\1\)/g)];
        let result = css;
        for (const [whole, , value] of found) {
          if (/^(#|%23)/.test(value.trim())) continue;
          const data = await inline(absolute(value.trim(), base));
          result = result.split(whole).join(`url("${data}")`);
        }
        return result;
      };
      const css = [];
      for (const sheet of document.styleSheets) {
        const owner = sheet.ownerNode;
        let text = '';
        let base = location.href;
        if (sheet.href) {
          base = sheet.href;
          text = await fetch(sheet.href).then((response) => (response.ok ? response.text() : '')).catch(() => '');
        } else if (owner && owner.textContent.trim()) {
          text = owner.textContent;
        }
        if (!text) { try { text = [...sheet.cssRules].map((rule) => rule.cssText).join('\n'); } catch { /* cross-origin */ } }
        const media = sheet.media && sheet.media.mediaText;
        css.push(media && media !== 'all' ? `@media ${media} {\n${text}\n}` : text);
        css[css.length - 1] = await urls(css[css.length - 1], base);
      }
      const copy = document.documentElement.cloneNode(true);
      // Freeze the browser's selected image before removing responsive markup.
      const images = document.querySelectorAll('img');
      copy.querySelectorAll('img').forEach((node, index) => { const selected = images[index].currentSrc; if (selected) node.setAttribute('src', selected); });
      copy.querySelectorAll("script, noscript, link[rel='stylesheet'], link[rel='preload'], link[rel='modulepreload'], style").forEach((node) => node.remove());
      copy.querySelectorAll('[srcset]').forEach((node) => node.removeAttribute('srcset'));
      copy.querySelectorAll('source').forEach((node) => node.remove());
      copy.querySelectorAll('[loading]').forEach((node) => node.removeAttribute('loading'));
      for (const node of copy.querySelectorAll('img[src], video[poster], image')) {
        const attr = node.tagName === 'VIDEO' ? 'poster' : node.tagName.toLowerCase() === 'image' ? 'href' : 'src';
        const value = node.getAttribute(attr);
        if (value) node.setAttribute(attr, await inline(absolute(value)));
      }
      copy.querySelectorAll('a[href]').forEach((node) => node.setAttribute('href', absolute(node.getAttribute('href'))));
      for (const node of copy.querySelectorAll("[style*='url(']")) node.setAttribute('style', await urls(node.getAttribute('style'), location.href));
      const style = document.createElement('style');
      let text = css.join('\n');
      if (scheme === 'dark' || scheme === 'light') {
        const other = scheme === 'dark' ? 'light' : 'dark';
        text = text
          .replace(new RegExp(`prefers-color-scheme\\s*:\\s*${scheme}`, 'g'), 'min-width: 0px')
          .replace(new RegExp(`prefers-color-scheme\\s*:\\s*${other}`, 'g'), 'max-width: 0px');
        const meta = document.createElement('meta');
        meta.name = 'color-scheme';
        meta.content = scheme;
        copy.querySelector('head').prepend(meta);
      }
      style.textContent = text;
      copy.querySelector('head').appendChild(style);
      if (label) {
        const meta = document.createElement('meta');
        meta.name = 'unslop-pass';
        meta.content = label;
        copy.querySelector('head').prepend(meta);
      }
      return '<!doctype html>\n' + copy.outerHTML;
    }, [label ?? '', scheme]);
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(path.resolve(out), html);
    await page.evaluate(() => window.scrollTo(0, 0));
    const shot = path.resolve(out).replace(/\.html?$/, '') + '.live.png';
    await page.screenshot({ path: shot });
    return `saved ${path.resolve(out)} and ${shot}${label ? ` as ${label}` : ''}`;
  } finally {
    await browser.close();
  }
}

// Resolve a story-server request path to a file inside root, or null. A bare startsWith(root) is not enough: a
// sibling whose name starts with the root's (/a/site vs /a/site-private) passes it, and so does a symlink inside root
// that points outside. Both sides are resolved to real paths first, and root itself is rejected (it is a directory).
function resolveStoryFile(root, requestPath) {
  const target = path.normalize(path.join(root, requestPath.replace(/^\/__story\//, '/')));
  if (!fs.existsSync(target)) return null;
  let realRoot;
  let realTarget;
  try { realRoot = fs.realpathSync(root); realTarget = fs.realpathSync(target); } catch { return null; }
  const rel = path.relative(realRoot, realTarget);
  if (rel === '' || rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) return null;
  return realTarget;
}

// A meta tag is valid HTML whatever order its attributes are in and whichever quotes they use, so read the tag
// first, then its attributes.
function storyMeta(html, name) {
  for (const [, attrs] of html.matchAll(/<meta\s+([^>]*)>/gi)) {
    const get = (attr) => new RegExp(`(?:^|\\s)${attr}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attrs)?.slice(1).find((value) => value !== undefined);
    if (get('name')?.toLowerCase() === name) return get('content');
  }
  return undefined;
}

function parseStory(html) {
  const steps = (storyMeta(html, 'unslop-steps') ?? '').split(',').map((step) => step.trim()).filter(Boolean);
  if (steps.length === 0) throw new Error('story.html needs <meta name="unslop-steps" content="Spacing, Color, Type"> listing the steps in order');
  const frameRaw = storyMeta(html, 'unslop-frame') ?? '0 0 960';
  const frame = frameRaw.split(/\s+/).filter(Boolean);
  const [x, y, width] = frame.map(Number);
  if (frame.length !== 3 || frame.some((value) => !Number.isFinite(Number(value))) || width <= 0) {
    throw new Error(`unslop-frame must be three numbers, like "0 0 960", with a width above 0, got "${frameRaw}"`);
  }
  const count = (pattern) => html.match(pattern)?.length ?? 0;
  const warnings = [];
  const swaps = count(/class="(?:[^"]*\s)?swap(?:\s[^"]*)?"/g);
  if (swaps > 8) warnings.push(`${swaps} swaps, use swaps sparingly, only where the words change, at most eight in a story`);
  if (/border-radius\s*:[^;}"]*\b9{3,4}px/i.test(html)) warnings.push('pills: write their radius as half the height, like 23px, not 9999px, or the corner only changes in the last frame');
  if (/\b100vh\b/i.test(html)) warnings.push('the story page renders 1440 wide and at least 900 tall, so do not size things from 100vh');
  const slops = count(/\sdata-slop\b/g);
  if (slops > 5) warnings.push(`${slops} data-slop marks, at most five, on the clearest examples that sit apart from each other`);
  const radii = count(/\sdata-radius\b/g);
  if (radii && (radii < 2 || radii > 4)) warnings.push(`${radii} data-radius marks, data-radius goes on two to four buttons and cards whose corners change`);
  const stacks = new Map();
  for (const [, n] of html.matchAll(/\sdata-gap(?:\s*=\s*"([^"]*)")?/g)) stacks.set(n || 'main', (stacks.get(n || 'main') ?? 0) + 1);
  stacks.forEach((blocks, n) => { if (blocks < 5 || blocks > 7) warnings.push(`data-gap="${n}" has ${blocks} blocks, ${blocks - 1} gaps, aim for four to six measured gaps per stack`); });
  return { steps, frame: { x, y, width }, warnings };
}

const storyKind = (text) => (/spac/i.test(text) ? 'spacing' : /detail|radius|corner/i.test(text) ? 'details' : null);

function storyLayout({ x: frameX, y: frameY, width: frameWidth }, wide) {
  const FRAME = wide ? { width: 1920, height: 1080 } : { width: 1080, height: 1080 };
  const PAGE_WIDTH = 1440;
  const MARGIN = 72;
  const scale = (FRAME.width - MARGIN) / frameWidth;
  const offsetX = MARGIN / scale - frameX;
  const offsetY = MARGIN / scale - frameY;
  const padLeft = Math.max(0, offsetX);
  const padTop = Math.max(0, offsetY);
  const left = Math.min(0, offsetX) * scale;
  const top = Math.min(0, offsetY) * scale;
  const pageWidth = Math.max(PAGE_WIDTH + padLeft, Math.ceil((FRAME.width - left) / scale) + 2);
  const padRight = pageWidth - PAGE_WIDTH - padLeft;
  const pageHeight = Math.max(900 + padTop, Math.ceil((FRAME.height - top) / scale) + 2);
  return { FRAME, scale, padLeft, padTop, padRight, left, top, pageWidth, pageHeight };
}

function storyStage(L, src, play, VIEW) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  html, body { margin: 0; width: ${L.FRAME.width}px; height: ${L.FRAME.height}px; overflow: hidden; background: #111; }
  ${play ? `body { transform: scale(${VIEW}); transform-origin: 0 0; }` : ''}
  #story-layer { position: absolute; inset: 0; pointer-events: none; z-index: 10; }
  #story-layer > * { position: absolute; }
  #story-layer .s-fade { opacity: 0; transition: opacity 240ms ease; }
  #story-layer.s-on .s-fade { opacity: 1; }
  #story-layer .s-x { transform: scaleX(0); transition: transform 520ms cubic-bezier(0.65, 0, 0.35, 1), background-color 300ms ease; }
  #story-layer .s-y { transform: scaleY(0); transition: transform 520ms cubic-bezier(0.65, 0, 0.35, 1), background-color 300ms ease; }
  #story-layer.s-on .s-x { transform: scaleX(1); }
  #story-layer.s-on .s-y { transform: scaleY(1); }
  #story-layer .s-tag { font: 500 15px/30px ui-monospace, "Geist Mono", "SF Mono", Menlo, monospace; height: 30px; padding: 0 12px; border-radius: 999px; white-space: nowrap; color: #fff; background: #ff4d6a; font-variant-numeric: tabular-nums; transition: opacity 220ms ease 100ms, background-color 300ms ease, color 300ms ease; }
  #story-layer.s-fixed .s-tag { background: #f5f5f5; color: #111; }
  #story-layer .s-ink { background: #ff4d6a; }
  #story-layer .s-hair { background: rgba(255,77,106,0.55); }
  #story-layer .s-fill { background: rgba(255,77,106,0.1); }
  #story-layer.s-fixed .s-ink { background: rgba(255,255,255,0.92); }
  #story-layer.s-fixed .s-hair { background: rgba(255,255,255,0.24); }
  #story-layer.s-fixed .s-fill { background: rgba(255,255,255,0.05); }
  #story-layer .s-box { border: 1.5px solid #ff4d6a; background: rgba(255,77,106,0.07); transform: scale(1.03); transition: opacity 220ms ease, transform 260ms ease, border-color 300ms ease, background-color 300ms ease; }
  #story-layer.s-on .s-box { transform: scale(1); }
  #story-layer.s-fixed .s-box { border-color: rgba(255,255,255,0.92); background: rgba(255,255,255,0.04); }
  #story-layer .s-corner { width: 8px; height: 8px; background: #fff; border: 1px solid #ff4d6a; }
  .credit { position: absolute; right: 28px; bottom: 24px; z-index: 20; padding: 7px 12px; border-radius: 999px; font: 500 15px/1 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; letter-spacing: 0.01em; color: rgba(255,255,255,0.86); background: rgba(12,12,14,0.62); box-shadow: 0 0 0 1px rgba(255,255,255,0.1); backdrop-filter: blur(8px); }
  iframe { position: absolute; left: ${L.left}px; top: ${L.top}px; border: 0; width: ${L.pageWidth}px; height: ${L.pageHeight}px; transform-origin: 0 0; transform: scale(${L.scale}); background: transparent; }
</style></head><body>
  <iframe id="page" src="/__story/${encodeURIComponent(src)}"></iframe>
  <div id="story-layer"></div>
  <div class="credit">unslop by @heydamir</div>
  <script>
    window.__stage = { conf: { scale: ${L.scale}, x: ${L.left}, y: ${L.top} } };
  </script>
</body></html>`;
}

function storyRuntime(steps) {
  return `
(() => {
  const red = "#ff4d6a";
  const spring = "cubic-bezier(0.3, 1.12, 0.45, 1)";
  const ease = "cubic-bezier(0.45, 0, 0.2, 1)";
  const layout = ["padding", "margin", "gap", "row-gap", "column-gap", "width", "height", "min-width", "min-height", "max-width", "max-height", "top", "right", "bottom", "left", "inset", "font-size", "line-height", "letter-spacing", "font-weight", "transform", "translate", "scale", "rotate", "border-width", "outline-width", "flex-basis", "grid-template-columns", "grid-template-rows"];
  const tint = ["color", "background-color", "border-color", "outline-color", "fill", "stroke", "stroke-dashoffset", "stroke-width", "box-shadow", "text-shadow", "border-radius", "opacity", "filter", "backdrop-filter", "clip-path", "text-decoration-color", "-webkit-text-fill-color"];
  const transition = [...layout.map((p) => p + " 700ms " + spring + " var(--wave, 0ms)"), ...tint.map((p) => p + " 900ms " + ease + " var(--wave, 0ms)")].join(", ");
  const rise = "cubic-bezier(0.17, 0.84, 0.44, 1)";
  const steps = ${JSON.stringify(steps)};
  let css = \`
    :root { interpolate-size: allow-keywords; }
    html.story-live *, html.story-live *::before, html.story-live *::after { transition: \${transition} !important; }
    .swap { display: inline-grid; justify-items: start; align-items: start; vertical-align: top; overflow: visible; }
    div.swap, p.swap, h1.swap, h2.swap, h3.swap, li.swap { display: grid; }
    .swap > .from, .swap > .to { grid-area: 1 / 1; }
    .swap > .to { opacity: 0; pointer-events: none; }
    .swap > .to .ch { display: inline-block; opacity: 0; transform: translateY(40%); filter: blur(8px); }
    html.story-live .swap > .to .ch { transition: opacity 700ms \${rise} calc(var(--wave, 0ms) + 140ms + var(--ci) * 16ms), transform 700ms \${rise} calc(var(--wave, 0ms) + 140ms + var(--ci) * 16ms), filter 700ms \${rise} calc(var(--wave, 0ms) + 140ms + var(--ci) * 16ms) !important; }
    [data-in] { opacity: 0; transform: translateY(10px) scale(0.98); }
  \`;
  steps.forEach((_, index) => {
    const k = index + 1;
    css += \`
      html.s\${k} .swap[data-at="\${k}"] > .from { opacity: 0; filter: blur(10px); transform: translateY(-14px); }
      html.s\${k} .swap[data-at="\${k}"] > .to { opacity: 1; }
      html.s\${k} .swap[data-at="\${k}"] > .to .ch { opacity: 1; transform: none; filter: none; }
      html.s\${k} [data-in="\${k}"] { opacity: 1; transform: none; }
      html.s\${k} [data-out="\${k}"] { opacity: 0; max-height: 0 !important; max-width: 0 !important; margin-top: 0 !important; margin-bottom: 0 !important; padding: 0 !important; border-width: 0 !important; }
    \`;
  });

  function letters(node) {
    let index = 0;
    const walk = (el) => {
      [...el.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\\s+$/.test(part)) return frag.appendChild(document.createTextNode(part));
            const word = document.createElement("span");
            word.style.display = "inline-block";
            word.style.whiteSpace = "nowrap";
            [...part].forEach((char) => {
              const span = document.createElement("span");
              span.className = "ch";
              span.style.setProperty("--ci", index++);
              span.textContent = char;
              word.appendChild(span);
            });
            frag.appendChild(word);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.tagName.toLowerCase() !== "svg") {
          walk(child);
        }
      });
    };
    walk(node);
  }

  const conf = window.parent.__stage.conf;
  function layer() { return window.parent.document.getElementById("story-layer"); }
  const box = (el) => el.getBoundingClientRect();
  const sx = (x) => conf.x + x * conf.scale;
  const sy = (y) => conf.y + y * conf.scale;
  function put(className, style, html) {
    const node = window.parent.document.createElement("div");
    node.className = className;
    Object.assign(node.style, style);
    if (html) node.innerHTML = html;
    layer().appendChild(node);
    return node;
  }
  const rect = (left, top, width, height) => ({ left: sx(left) + "px", top: sy(top) + "px", width: width * conf.scale + "px", height: height * conf.scale + "px" });

  function audit() {
    document.querySelectorAll("[data-slop]").forEach((el, index) => {
      const b = box(el);
      if (b.width < 4 || b.bottom < 0 || b.top > innerHeight) return;
      const pad = 8 / conf.scale;
      const wrap = put("s-fade", { ...rect(b.left - pad, b.top - pad, b.width + pad * 2, b.height + pad * 2), transitionDelay: index * 70 + "ms" });
      wrap.innerHTML = '<div class="s-box" style="position:absolute;inset:0"></div>' +
        [["left", "top"], ["right", "top"], ["left", "bottom"], ["right", "bottom"]].map(([x, y]) => '<span class="s-corner" style="position:absolute;' + x + ':-4px;' + y + ':-4px"></span>').join("") +
        '<span class="s-tag" style="position:absolute;left:0;top:-40px">' + el.dataset.slop + "</span>";
    });
  }

  function spacing() {
    const groups = new Map();
    document.querySelectorAll("[data-gap]").forEach((el) => {
      const key = el.dataset.gap || "main";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(el);
    });
    // In --play the stage is scaled down to fit the window, so take its layout width, not the window's.
    const stageWidth = window.parent.document.body.offsetWidth;
    const several = groups.size > 1;
    const pairs = [];
    groups.forEach((list) => {
      const items = list.filter((el) => box(el).height > 0 && box(el).top < innerHeight).sort((a, b) => box(a).top - box(b).top);
      for (let i = 1; i < items.length; i++) {
        if (box(items[i]).top - box(items[i - 1]).bottom <= 2) continue;
        pairs.push({ group: items, above: items[i - 1], below: items[i], nodes: {
          fill: put("s-fill s-x", {}), top: put("s-hair s-x", {}), bottom: put("s-hair s-x", {}),
          ruler: put("s-ink s-y", {}), capTop: put("s-ink s-x", {}), capBottom: put("s-ink s-x", {}),
          tag: put("s-tag s-fade", {}),
        } });
      }
    });
    return () => {
      for (const { group, above, below, nodes } of pairs) {
        const a = box(above);
        const b = box(below);
        const left = sx(Math.min(...group.map((el) => box(el).left)));
        const ruler = Math.max(14, left - 20);
        const top = sy(a.bottom);
        const size = Math.max(0, (b.top - a.bottom) * conf.scale);
        const value = Math.round(b.top - a.bottom);
        const right = several ? sx(Math.max(...group.map((el) => box(el).right))) + 24 : stageWidth;
        const start = several ? ruler - 8 : 0;
        const band = { left: start + "px", width: right - start + "px", transformOrigin: ruler - start + "px 50%" };
        Object.assign(nodes.fill.style, band, { top: top + "px", height: size + "px" });
        Object.assign(nodes.top.style, band, { top: top + "px", height: "1px" });
        Object.assign(nodes.bottom.style, band, { top: top + size - 1 + "px", height: "1px" });
        Object.assign(nodes.ruler.style, { left: ruler + "px", top: top + "px", width: "1.5px", height: size + "px", transformOrigin: "50% 0" });
        Object.assign(nodes.capTop.style, { left: ruler - 4 + "px", top: top + "px", width: "9px", height: "1.5px" });
        Object.assign(nodes.capBottom.style, { left: ruler - 4 + "px", top: top + size - 1.5 + "px", width: "9px", height: "1.5px" });
        const room = ruler - 10 > 64;
        Object.assign(nodes.tag.style, { left: (room ? ruler - 10 : ruler + 12) + "px", top: top + size / 2 - 15 + "px", translate: room ? "-100% 0" : "0 0" });
        const text = value + "px";
        if (nodes.tag.textContent !== text) nodes.tag.textContent = text;
        const hidden = value < 4 ? "0" : "";
        Object.values(nodes).forEach((node) => {
          if (node.style.visibility !== (hidden ? "hidden" : "")) node.style.visibility = hidden ? "hidden" : "";
        });
      }
    };
  }

  function details() {
    const items = [...document.querySelectorAll("[data-radius]")].filter((el) => box(el).bottom > 0 && box(el).top < innerHeight).map((el) => {
      const wrap = put("s-fade", {}, '<div class="s-box" style="position:absolute;inset:0"></div>');
      return { el, wrap, outline: wrap.firstChild, tag: put("s-tag s-fade", {}) };
    });
    return () => {
      for (const { el, wrap, outline, tag } of items) {
        const b = box(el);
        const radius = Math.round(Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, b.width / 2, b.height / 2));
        const pad = 5 / conf.scale;
        Object.assign(wrap.style, rect(b.left - pad, b.top - pad, b.width + pad * 2, b.height + pad * 2));
        outline.style.borderRadius = radius * conf.scale + 5 + "px";
        Object.assign(tag.style, { left: sx(b.left) + "px", top: sy(b.bottom) + 12 + "px" });
        const text = "r " + radius;
        if (tag.textContent !== text) tag.textContent = text;
      }
    };
  }

  const kinds = { audit, spacing, details };
  const managed = new WeakMap();
  let current = null;
  let stepping = false;

  window.__story = {
    install() {
      const style = document.createElement("style");
      style.id = "story-style";
      style.textContent = css;
      document.head.appendChild(style);
      document.querySelectorAll(".swap > .to").forEach(letters);
      document.querySelectorAll("[data-out]").forEach((el) => {
        const b = box(el);
        if (getComputedStyle(el).display === "inline") el.style.display = "inline-block";
        el.style.overflow = "hidden";
        el.style.maxHeight = Math.ceil(b.height) + "px";
        el.style.maxWidth = Math.ceil(b.width) + "px";
      });
      document.querySelectorAll("body *").forEach((el) => {
        const b = box(el);
        const wave = Math.round(Math.min(420, Math.max(0, b.top) / innerHeight * 320 + Math.max(0, b.left) / innerWidth * 100));
        el.style.setProperty("--wave", wave + "ms");
      });
      document.querySelectorAll("*").forEach((el) => {
        if (getComputedStyle(el).animationName !== "none") el.style.animationPlayState = "paused";
      });
      document.documentElement.offsetHeight;
      document.documentElement.classList.add("story-live");
      const follow = () => {
        if (current && !stepping) current();
        requestAnimationFrame(follow);
      };
      requestAnimationFrame(follow);
    },
    reset() {
      const root = document.documentElement;
      root.classList.remove("story-live", ...steps.map((_, index) => "s" + (index + 1)));
      layer().className = "";
      layer().innerHTML = "";
      current = null;
      root.offsetHeight;
      root.classList.add("story-live");
    },
    tick(ms) {
      stepping = true;
      for (const animation of [...document.getAnimations(), ...window.parent.document.getAnimations()]) {
        if (!managed.has(animation)) {
          if (animation.playState !== "running") continue;
          managed.set(animation, ms);
          animation.pause();
        }
        const time = ms - managed.get(animation);
        const end = animation.effect ? animation.effect.getComputedTiming().endTime : Infinity;
        if (Number.isFinite(end) && time >= end) animation.finish();
        else animation.currentTime = time;
      }
      if (current) current();
    },
    step(k) { document.documentElement.classList.add("s" + k); },
    show(kind) {
      const node = layer();
      node.className = "";
      node.innerHTML = "";
      const update = (kinds[kind] || (() => {}))();
      current = typeof update === "function" ? update : null;
      if (current) current();
      node.offsetHeight;
      node.classList.add("s-on");
    },
    settle() { layer().classList.add("s-on", "s-fixed"); },
    clear() { layer().classList.remove("s-on"); },
  };
})();
`;
}

async function cmdStory(args) {
  const usage = 'usage: story <story.html> <out.mp4> [--wide], or story <story.html> --play to watch it live in a browser window';
  const [input, out] = args.filter((arg) => !arg.startsWith('--'));
  const wide = args.includes('--wide');
  const play = args.includes('--play');
  if (!input || (!out && !play)) throw new Error(usage);
  const ffmpeg = play ? null : ffmpegPath();
  const file = path.resolve(input);
  const root = path.dirname(file);
  const { steps, frame: frameBox, warnings } = parseStory(fs.readFileSync(file, 'utf8'));
  warnings.forEach((text) => console.warn(`warning: ${text}`));
  const L = storyLayout(frameBox, wide);
  const VIEW = 0.75;
  const stage = storyStage(L, file.slice(root.length + 1), play, VIEW);
  const runtime = storyRuntime(steps);

  const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp4': 'video/mp4' };
  const server = createServer((request, response) => {
    const reqPath = decodeURIComponent(new URL(request.url, 'http://local').pathname);
    if (reqPath === '/__stage.html') { response.writeHead(200, { 'content-type': 'text/html' }); return response.end(stage); }
    const target = resolveStoryFile(root, reqPath);
    if (target === null) { response.writeHead(404); return response.end(); }
    response.writeHead(200, { 'content-type': types[path.extname(target).toLowerCase()] ?? 'application/octet-stream' });
    return response.end(fs.readFileSync(target));
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${server.address().port}`;

  const FPS = 60;
  const LENGTH = 10;
  const frames = path.join(root, '.story-frames');
  if (!play) { fs.rmSync(frames, { recursive: true, force: true }); fs.mkdirSync(frames, { recursive: true }); }

  const { chromium } = browserKit();
  const browser = await chromium.launch({ ...chromeOptions(), headless: !play });
  const sleep = (ms) => new Promise((done) => setTimeout(done, Math.max(0, ms)));
  let total = 0;
  try {
    const page = await browser.newPage(play ? { viewport: { width: Math.round(L.FRAME.width * VIEW), height: Math.round(L.FRAME.height * VIEW) } } : { viewport: L.FRAME, deviceScaleFactor: 2 });
    await page.goto(`${base}/__stage.html`, { waitUntil: 'networkidle' });
    const frame = page.frames().find((item) => item !== page.mainFrame());
    await frame.waitForLoadState('networkidle');
    await frame.evaluate(async () => {
      const families = new Set();
      for (const sheet of document.styleSheets) {
        let rules = [];
        try { rules = [...sheet.cssRules]; } catch { /* cross-origin */ }
        const walk = (list) => list.forEach((rule) => {
          if (rule.cssRules) walk([...rule.cssRules]);
          const value = rule.style && rule.style.fontFamily;
          if (value) value.split(',').forEach((name) => families.add(name.trim().replace(/^["']|["']$/g, '')));
        });
        walk(rules);
      }
      await Promise.all([...families].flatMap((family) => [400, 500, 600, 700, 800].map((weight) => document.fonts.load(`${weight} 16px "${family}"`).catch(() => null))));
      await document.fonts.ready;
    });
    await frame.addStyleTag({ content: `html { padding: ${L.padTop}px ${L.padRight}px 0 ${L.padLeft}px !important; }` });
    await frame.addScriptTag({ content: runtime });
    await frame.evaluate(() => window.__story.install());
    await page.waitForTimeout(300);

    const slop = await frame.evaluate(() => document.querySelectorAll('[data-slop]').length);
    const call = (name, value) => () => frame.evaluate(([n, v]) => window.__story[n](v), [name, value]);
    const plan = [];
    const at = (time, run) => plan.push({ time, run });
    let cursor = 0.5;
    if (slop) { at(cursor, call('show', 'audit')); at(cursor + 0.9, call('clear')); cursor += 1.1; }
    const blocks = steps.map((name) => (storyKind(name) ? 1.75 : 1.25));
    const fit = Math.min(1, (LENGTH - cursor - 1.6) / blocks.reduce((sum, block) => sum + block, 0));
    steps.forEach((name, index) => {
      const kind = storyKind(name);
      if (kind) {
        at(cursor, call('show', kind));
        at(cursor + 0.35 * fit, call('step', index + 1));
        at(cursor + 1.35 * fit, call('settle'));
        at(cursor + 1.7 * fit, call('clear'));
      } else {
        at(cursor, call('step', index + 1));
      }
      cursor += blocks[index] * fit;
    });
    total = cursor + 1.6;
    plan.sort((a, b) => a.time - b.time);

    if (play) {
      console.log('playing in the browser window, close it to stop');
      while (browser.isConnected()) {
        await frame.evaluate(() => window.__story.reset());
        await sleep(400);
        const begin = Date.now();
        for (const { time, run } of plan) { await sleep(begin + time * 1000 - Date.now()); await run(); }
        await sleep(begin + total * 1000 - Date.now());
      }
    } else {
      let next = 0;
      for (let index = 0; index <= Math.round(total * FPS); index++) {
        const now = index / FPS;
        while (next < plan.length && plan[next].time <= now + 1e-6) await plan[next++].run();
        await frame.evaluate((ms) => window.__story.tick(ms), now * 1000);
        await page.screenshot({ path: path.join(frames, `f-${String(index).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 });
      }
    }
  } catch (error) {
    if (!play) { fs.rmSync(frames, { recursive: true, force: true }); throw error; }
    if (browser.isConnected()) console.error(error);
  } finally {
    await browser.close().catch(() => {});
    server.close();
  }
  if (play) return 'stopped';
  try {
    execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(frames, 'f-%05d.jpg'), '-vf', `scale=${L.FRAME.width * 2}:${L.FRAME.height * 2}:flags=lanczos`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'slow', '-movflags', '+faststart', path.resolve(out)]);
  } finally {
    fs.rmSync(frames, { recursive: true, force: true });
  }
  return `saved ${path.resolve(out)}, ${steps.length} steps, ${total.toFixed(1)}s`;
}

// ---------- self-test ----------

function selfTest() {
  const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: got ${a}, want ${b} +/- ${tol}`);
  // conversions against independently published values
  const white = parseColour('#ffffff').lch;
  near(white[0], 1, 0.001, 'white L');
  near(white[1], 0, 0.001, 'white C');
  const black = parseColour('#000000').lch;
  near(black[0], 0, 0.001, 'black L');
  const red = parseColour('#ff0000').lch;
  near(red[0], 0.628, 0.002, 'red L');
  near(red[1], 0.2577, 0.002, 'red C');
  near(red[2], 29.23, 0.3, 'red H');
  // round trip
  for (const hex of ['#3b82f6', '#767676', '#0f172a', '#14b8a6', '#fafaf9']) {
    const back = rgb255ToHex(oklchToRgb255(parseColour(hex).lch).rgb);
    assert.equal(back, hex, `round trip ${hex}`);
  }
  // contrast against known values
  near(contrastRatio([0, 0, 0], [255, 255, 255]), 21, 0.01, 'black/white');
  near(contrastRatio(parseColour('#767676').rgb, [255, 255, 255]), 4.54, 0.02, '#767676 on white');
  near(contrastRatio(parseColour('#777777').rgb, [255, 255, 255]), 4.48, 0.02, '#777777 on white');
  near(contrastRatio([255, 255, 255], [255, 255, 255]), 1, 0.001, 'same colour');
  // parsing forms
  assert.deepEqual(parseColour('#fff').rgb, [255, 255, 255]);
  assert.deepEqual(parseColour('rgb(255, 0, 0)').rgb, [255, 0, 0]);
  assert.deepEqual(parseColour('color(srgb 1 0 0)').rgb, [255, 0, 0]);
  assert.deepEqual(parseColour('rgba(0, 0, 0, 0.5)').rgb, [0, 0, 0]);
  assert.equal(rgb255ToHex(parseColour('oklch(100% 0 0)').rgb), '#ffffff');
  // gamut mapping never leaves sRGB and reports it
  const wild = oklchToRgb255([0.7, 0.4, 150]);
  assert.ok(wild.mapped && wild.rgb.every((v) => v >= 0 && v <= 255), 'gamut mapping');
  // retint keeps lightness, changes hue
  const tinted = parseColour(cmdRetint(['#3b82f6', '#14b8a6']).split(/\s+/)[0]);
  near(tinted.lch[0], parseColour('#3b82f6').lch[0], 0.03, 'retint keeps L');
  // ramp is monotonic in lightness
  const rampLs = cmdRamp(['#3b82f6']).split('\n').slice(1).map((l) => Number(l.match(/oklch\(([\d.]+)/)[1]));
  for (let i = 1; i < rampLs.length; i++) assert.ok(rampLs[i] < rampLs[i - 1] + 0.001, 'ramp descends');
  // inventory on a temp fixture
  const dir = fs.mkdtempSync(path.join(process.env.TEMP || process.env.TMPDIR || '.', 'design-tools-'));
  try {
    fs.writeFileSync(path.join(dir, 'tokens.css'), ':root {\n  --accent: #3b82f6;\n  --brand: #3b82f6;\n  --unused-thing: #123456;\n  --color-primary: #111111;\n  --card: var(--accent);\n  --ring: var(--accent);\n}\n');
    fs.writeFileSync(path.join(dir, 'a.css'), '.a { color: #3a80f4; background: var(--accent); font-size: 13px; border-radius: 6px; }\n.b { font-size: 14px; border-radius: var(--r); box-shadow: none; }\n');
    fs.writeFileSync(path.join(dir, 'b.tsx'), 'export const B = () => <div className="bg-primary">x</div>;\n');
    const out = inventory([dir], { top: 5 });
    assert.match(out, /radius literals outside tokens: 1 distinct/, 'var() radius is not a literal');
    assert.doesNotMatch(out, /--color-primary\s*$/m, 'Tailwind utility use counts as used');
    assert.doesNotMatch(out, /var\(--accent\)\s+<-/, 'alias tokens are not reported as duplicates');
    assert.match(out, /near-duplicate colour clusters[^\n]*: 1/, 'finds the #3b82f6 ~ #3a80f4 cluster');
    assert.match(out, /tokens defined twice under different names: 1/, 'finds duplicate token');
    assert.match(out, /unused-thing/, 'finds unused token');
    assert.match(out, /font-size literals outside tokens: 2 distinct/, 'counts font sizes');
    // catalog: quoted commas and line breaks survive, filters and scoring work, nothing outside the folder is read
    assert.deepEqual(parseCsv('No,Name,Note\n1,"a, b","line\nbreak ""q"""\n2,c,d\n'), [['No', 'Name', 'Note'], ['1', 'a, b', 'line\nbreak "q"'], ['2', 'c', 'd']]);
    fs.writeFileSync(path.join(dir, 'demo.csv'), 'No,Name,Keywords,Status\n1,Glass panel,"blur, frosted",active\n2,Flat card,"plain, solid",active\n3,Old glass,"blur",deprecated\n');
    const hit = cmdCatalog(['demo', '--q', 'frosted blur'], dir);
    assert.match(hit, /1 of 3 row\(s\) match|2 of 3 row\(s\) match/); assert.match(hit, /^#1$/m); assert.ok(hit.indexOf('#1') < hit.indexOf('#3'), 'the row matching more words ranks first');
    assert.doesNotMatch(cmdCatalog(['demo', '--q', 'blur', '--where', 'Status=active'], dir), /#3/, '--where filters');
    assert.match(cmdCatalog(['demo', '--q', 'blur', '--cols', 'Name'], dir), /Name: Glass panel/); assert.doesNotMatch(cmdCatalog(['demo', '--q', 'blur', '--cols', 'Name'], dir), /Keywords:/);
    assert.match(cmdCatalog(['demo', '--q', 'zzzz'], dir), /no row matched/); assert.match(cmdCatalog(['demo', '--list'], dir), /3 row\(s\)/);
    assert.throws(() => cmdCatalog(['demo', '--where', 'Nope=x'], dir), /no column "Nope"/); assert.throws(() => cmdCatalog(['../demo'], dir), /only inside|no catalog file/);
    assert.match(cmdCatalog(['styles', '--q', 'glass', '--where', 'Status=active', '--limit', '2']), /row\(s\) match/, 'the real styles.csv is readable');
    // toc / section: headings inside code fences are ignored, a section ends at the next heading of its level or higher
    fs.writeFileSync(path.join(dir, 'doc.md'), '# Top\n\nintro\n\n## One\n\none body\n```\n# not a heading\n```\n\n### One-a\n\nsub\n\n## Two\n\ntwo body\n');
    assert.match(cmdToc(['doc.md'], path.join(dir, 'doc.md')), /L5-15 {2}## One[\s\S]*L12-15 {2}### One-a[\s\S]*L16-19 {2}## Two/);
    assert.doesNotMatch(cmdToc(['doc.md'], path.join(dir, 'doc.md')), /not a heading/, 'a # line inside a code fence is not a heading');
    const sec = cmdSection(['doc.md', '^one$'], path.join(dir, 'doc.md'));
    assert.match(sec, /one body/); assert.match(sec, /sub/); assert.doesNotMatch(sec, /two body/); assert.match(sec, /# not a heading/);
    assert.throws(() => cmdSection(['doc.md', 'zzz'], path.join(dir, 'doc.md')), /no heading matches/); assert.throws(() => skillFile('../../../CLAUDE.md'), /not a file inside the design skill folder/);
    // snapshot: argument parsing (no browser needed)
    assert.throws(() => parseSnapshotArgs([]), /usage: snapshot/);
    assert.throws(() => parseSnapshotArgs(['a', 'b', '--width']), /--width needs a value/);
    assert.throws(() => parseSnapshotArgs(['a', 'b', '--width', '0']), /whole number above 0/);
    assert.throws(() => parseSnapshotArgs(['a', 'b', '--height', 'x']), /whole number above 0/);
    assert.equal(parseSnapshotArgs(['a', 'b', '--width', '800']).width, 800);
    assert.equal(parseSnapshotArgs(['a', 'b', '--width=800']).width, 800);
    assert.equal(parseSnapshotArgs(['a', 'b', '--height', '600']).height, 600);
    assert.equal(parseSnapshotArgs(['a', 'b', '--dark']).scheme, 'dark');
    assert.match(parseSnapshotArgs([path.join(dir, 'doc.md'), 'o.html']).target, /^file:\/\//, 'a local file becomes a file URL');
    assert.equal(parseSnapshotArgs(['http://127.0.0.1:5173/', 'o.html', 'before']).label, 'before');
    // story: meta parsing in any attribute order, quotes and case; frame validation; warnings
    const story = (meta) => `<!doctype html><html><head><meta charset="utf-8">${meta}</head><body></body></html>`;
    assert.throws(() => parseStory(story('')), /needs <meta name="unslop-steps"/);
    assert.throws(() => parseStory(story('<meta name="unslop-steps" content="">')), /needs <meta name="unslop-steps"/);
    for (const meta of ['<meta content="Spacing, Color" name="unslop-steps">', "<meta name='unslop-steps' content='Spacing, Color'>", '<meta data-x="1" name="unslop-steps" content="Spacing, Color">', '<META NAME="unslop-steps" CONTENT="Spacing, Color">']) {
      assert.deepEqual(parseStory(story(meta)).steps, ['Spacing', 'Color'], meta);
    }
    const good = '<meta name="unslop-steps" content="Spacing, Color">';
    for (const bad of ['0 0', '0 0 abc', '0 0 0', '0 0 -960', '0 0 960 100', '']) {
      assert.throws(() => parseStory(story(`${good}<meta name="unslop-frame" content="${bad}">`)), new RegExp(`got "${bad}"`), `frame "${bad}"`);
    }
    assert.deepEqual(parseStory(story(good)).frame, { x: 0, y: 0, width: 960 }, 'default frame');
    assert.match(parseStory(story(`${good}<style>.p{border-radius:9999px;height:100vh}</style>`)).warnings.join('|'), /9999px[\s\S]*100vh/);
    assert.equal(storyKind('Spacing'), 'spacing'); assert.equal(storyKind('Details'), 'details'); assert.equal(storyKind('Color'), null);
    near(storyLayout({ x: 0, y: 0, width: 960 }, false).scale, (1080 - 72) / 960, 1e-9, 'story scale');
    assert.match(storyStage(storyLayout({ x: 0, y: 0, width: 960 }, false), 'story.html', false, 0.75), /unslop by @heydamir/, 'the video keeps its credit');
    // story server: path guard (siblings, escapes, the root itself, symlinks where the OS allows them)
    const site = path.join(dir, 'site');
    fs.mkdirSync(path.join(site, 'sub'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'site-private'));
    fs.writeFileSync(path.join(site, 'asset.txt'), 'a');
    fs.writeFileSync(path.join(site, 'sub', 'inner.txt'), 'i');
    fs.writeFileSync(path.join(dir, 'site-private', 'secret.txt'), 's');
    const real = (p) => fs.realpathSync(p);
    assert.equal(resolveStoryFile(site, '/__story/asset.txt'), real(path.join(site, 'asset.txt')));
    assert.equal(resolveStoryFile(site, '/__story/sub/inner.txt'), real(path.join(site, 'sub', 'inner.txt')));
    assert.equal(resolveStoryFile(site, '/__story/sub/../asset.txt'), real(path.join(site, 'asset.txt')));
    assert.equal(resolveStoryFile(site, '/__story/nope.txt'), null);
    assert.equal(resolveStoryFile(site, '/__story/'), null, 'root itself');
    assert.equal(resolveStoryFile(site, '/__story/../site-private/secret.txt'), null, 'sibling prefix');
    assert.equal(resolveStoryFile(site, '/__story/sub/../../site-private/secret.txt'), null, 'deeper escape');
    let linked = false;
    try { fs.symlinkSync(path.join(dir, 'site-private', 'secret.txt'), path.join(site, 'link-out')); linked = true; } catch { /* Windows without symlink rights */ }
    if (linked) assert.equal(resolveStoryFile(site, '/__story/link-out'), null, 'symlink out');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return 'self-test: all checks passed';
}

// ---------- main ----------

function main(argv) {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case 'contrast': return cmdContrast(rest);
    case 'oklch': return cmdOklch(rest);
    case 'hex': return cmdHex(rest);
    case 'ramp': return cmdRamp(rest);
    case 'retint': return cmdRetint(rest);
    case '--self-test': return selfTest();
    case 'catalog': return cmdCatalog(rest);
    case 'toc': return cmdToc(rest);
    case 'section': return cmdSection(rest);
    case 'snapshot': return cmdSnapshot(rest);
    case 'story': return cmdStory(rest);
    case 'inventory': {
      const opt = { top: 15, delta: 0.03, json: false };
      const paths = [];
      for (let i = 0; i < rest.length; i++) {
        if (rest[i] === '--top') opt.top = Number(rest[++i]);
        else if (rest[i] === '--delta') opt.delta = Number(rest[++i]);
        else if (rest[i] === '--json') opt.json = true;
        else paths.push(rest[i]);
      }
      if (!paths.length) throw new Error('inventory needs at least one path');
      return inventory(paths, opt);
    }
    default:
      return 'usage: contrast <fg> <bg> ... | oklch <colour> | hex <colour> | ramp <colour> [--steps N] | retint <colour> <target> | inventory <path...> [--top N] [--delta D] [--json] | catalog <file> [--q words] [--where Col=regex] [--cols A,B] [--limit N] [--full] [--list] | toc <md file> | section <md file> <heading regex> [--full] | snapshot <url|file> <out.html> [label] [--dark|--light] [--width N] [--height N] | story <story.html> <out.mp4> [--wide] | story <story.html> --play | --self-test';
  }
}

Promise.resolve()
  .then(() => main(process.argv.slice(2)))
  .then((out) => console.log(out), (e) => {
    console.error(`design-tools: ${e.message}`);
    process.exit(1);
  });
