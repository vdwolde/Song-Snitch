#!/usr/bin/env node
// Liquid Glass contrast gate. Zero dependencies.
// Run: node contrast-check.mjs [--self-test] [--md] [--verbose] [--derive <hue>] [--derive-plate [ratio]]
// Single source of colour: ./tokens.json. The pair lists below reference token paths (or literal
// #hex for the "original look" counter-examples), never copies of token values.
// Exit code 1 on any failure. WCAG 2.x relative luminance; translucent fills are composited over
// the stated ground first.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve as resolvePath } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const TOK = JSON.parse(readFileSync(join(HERE, 'tokens.json'), 'utf8'));

// ---------- colour maths ----------
export const hex2rgb = (h) => {
  const m = /^#([0-9a-f]{6})$/i.exec(h);
  if (!m) throw new Error('bad hex ' + h);
  return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
};
const rgb2hex = (c) =>
  '#' + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
const lin = (v) => {
  v /= 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
export const luminance = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
export const ratio = (a, b) => {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
export const over = (fg, alpha, bg) => fg.map((v, i) => v * alpha + bg[i] * (1 - alpha));

// OKLCH -> sRGB, reducing chroma until the colour is inside the sRGB gamut.
export function oklch2rgb(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const toRgb = (c) => {
    const a = c * Math.cos(h);
    const b = c * Math.sin(h);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
  };
  const inGamut = (v) => v.every((x) => x >= -0.0005 && x <= 1.0005);
  let c = C;
  let v = toRgb(c);
  for (let i = 0; i < 60 && !inGamut(v); i++) {
    c *= 0.96;
    v = toRgb(c);
  }
  const enc = (x) => {
    x = Math.min(1, Math.max(0, x));
    return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
  };
  return rgb2hex(v.map(enc));
}

// Brand-hue derivation rule (SPEC 2c). 'ink' = vivid ramp for ink text, 'deep' = ramp for white text.
export function deriveGel(hue, variant = 'ink') {
  if (variant === 'luminous') return luminousFromVivid(deriveGel(hue, 'ink'));
  const d = TOK.gel.derive[variant === 'ink' ? 'vivid' : 'deep'];
  return Object.fromEntries(
    ['top', 'mid', 'core', 'bottom', 'rim'].map((k) => [k, oklch2rgb(d[k].L, d.chroma * d[k].c, hue)]),
  );
}

// hex -> OKLCH (inverse of oklch2rgb), for the luminous rule below.
export function hex2oklch(h) {
  const [r, g, b] = hex2rgb(h).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, C: Math.hypot(a, bb), h: (Math.atan2(bb, a) * 180) / Math.PI };
}

// Luminous ramp (SPEC 2c, 10.2 rule 2b): the vivid ramp darkened only as far as white text needs.
// Worst case under a title: stop + the pale rim at alpha.gelEdgeLuminous + white at alpha.highlightLuminous.
export function luminousFromVivid(vivid) {
  return darkenForWhite(vivid, TOK.alpha.gelEdgeLuminous, TOK.alpha.highlightLuminous, TOK.gel.derive.luminous.targetRatio);
}

// Deep ramp from a hand-authored vivid ramp (add-colourway.mjs --vivid): the same pure darkening with the deep wash and highlight and a
// higher target, so white reads clearly on it in dark mode. A single-hue colourway uses deriveGel(hue, 'deep') instead.
export function deepFromVivid(vivid) {
  return darkenForWhite(vivid, TOK.alpha.gelEdgeDeep, TOK.alpha.highlightDeep, 5.0);
}

function darkenForWhite(vivid, wash, hl, target) {
  const R = TOK.gel.derive.luminous;
  const o = Object.fromEntries(['top', 'mid', 'core', 'bottom'].map((k) => [k, hex2oklch(vivid[k])]));
  const out = { rim: vivid.rim };
  for (const k of ['top', 'mid', 'core', 'bottom']) {
    const hue = o[k].C < R.paleChroma ? o.mid.h : o[k].h;
    const C = Math.max(o[k].C, R.chromaFloorOfCore * o.core.C);
    const rim = hex2rgb(vivid.rim);
    let L = o[k].L;
    let hex = vivid[k];
    for (; L > 0.2; L -= 0.002) {
      hex = oklch2rgb(L, C, hue);
      const stack = over([255, 255, 255], hl, over(rim, wash, hex2rgb(hex)));
      if (ratio([255, 255, 255], stack) >= target) break;
    }
    out[k] = hex;
  }
  return out;
}

// ---------- token access ----------
const get = (path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), TOK);
const resolve = (ref) => {
  if (typeof ref === 'string' && ref.startsWith('#')) return ref;
  const v = get(ref);
  if (typeof v !== 'string' || !v.startsWith('#')) throw new Error('token path does not resolve to a hex: ' + ref);
  return v;
};
const num = (path) => {
  const v = get(path);
  if (typeof v !== 'number') throw new Error('token path is not a number: ' + path);
  return v;
};
const A = (x) => (typeof x === 'string' ? num(x) : x);

// Layers: ref or [ref, alpha], bottom first. Returns the composited rgb.
const compose = (layers) =>
  layers.reduce((acc, l) => {
    const [r, a = 1] = Array.isArray(l) ? l : [l];
    const c = hex2rgb(resolve(r));
    return acc ? over(c, A(a), acc) : c;
  }, null);

// ---------- pair table (SPEC sections 4 and 10) ----------
// P(id, kind, min, fg, bgs). fg = ref | [ref, alpha | 'alpha.token']. bgs = list of ref | layer list.
const pairs = [];
const P = (id, kind, min, fg, bgs) => pairs.push({ id, kind, min, fg, bgs });
const L = 'color.light';
const D = 'color.dark';
const lightBgs = [`${L}.ground`, `${L}.card`, `${L}.cardSunk`];
const darkBgs = [`${D}.ground`, `${D}.panel`, `${D}.panelRaised`];
const gelStops = (set, name) => ['top', 'mid', 'core', 'bottom'].map((s) => `gel.${set}.${name}.${s}`);
const names = Object.keys(TOK.gel.vivid);
const backdrops = TOK.color.photoBackdrops;

// light text
for (const t of ['ink', 'inkSecondary', 'inkTertiary']) P(`light ${t} text`, 'text', 4.5, `${L}.${t}`, lightBgs);
P('light on-ink text on inverted pill', 'text', 4.5, `${L}.onInk`, [`${L}.ink`]);
P('light ink text on lime chip', 'text', 4.5, `${L}.ink`, [`${L}.lime`, `${L}.limeSoft`]);
for (const s of ['success', 'warning', 'danger', 'info']) P(`light state ${s} text`, 'text', 4.5, `${L}.${s}`, lightBgs);
// light UI boundaries and floors
P('light control edge vs surfaces', 'ui', 3.0, `${L}.controlEdge`, lightBgs);
P('light focus ring vs focus halo', 'ui', 3.0, `${L}.focusRing`, [`${L}.focusHalo`]);
P('dark focus ring vs focus halo', 'ui', 3.0, `${D}.focusRing`, [`${D}.focusHalo`]);
P('light hairline floor (static card edge)', 'floor', num('contrast.hairlineFloor'), `${L}.hairline`, [`${L}.ground`, `${L}.card`]);
P('light card vs ground value step', 'floor', num('contrast.valueStepFloor'), `${L}.card`, [`${L}.ground`]);
P('light lime graphic: ink ring vs lime', 'ui', 3.0, `${L}.ink`, [`${L}.lime`]);
// dark text and UI
for (const t of ['ink', 'inkSecondary', 'inkTertiary']) P(`dark ${t} text`, 'text', 4.5, `${D}.${t}`, darkBgs);
P('dark ink text on lime chip', 'text', 4.5, `${L}.ink`, [`${D}.lime`]);
for (const s of ['success', 'warning', 'danger', 'info']) P(`dark state ${s} text`, 'text', 4.5, `${D}.${s}`, darkBgs);
P('dark control edge vs surfaces', 'ui', 3.0, `${D}.controlEdge`, darkBgs);
P('dark hairline floor', 'floor', num('contrast.hairlineFloor'), `${D}.hairline`, darkBgs);
P('dark lime graphic vs surfaces', 'ui', 3.0, `${D}.lime`, darkBgs);
P('dark glow accent graphic vs surfaces', 'ui', 3.0, `${D}.glow`, darkBgs);
P('dark glow accent text vs surfaces', 'text', 4.5, `${D}.glow`, darkBgs);
P('dark inverted pill: ink on light pill fill', 'text', 4.5, `${L}.ink`, [`${D}.pillFill`]);
// gel, light mode: ink text on vivid ramps (rim excluded: no text lives in the rim)
for (const n of names) {
  P(`gel ${n} (vivid): ink title/value`, 'text', 4.5, `${L}.ink`, gelStops('vivid', n));
}
// gel, dark mode: white text on deep ramps
for (const n of names) {
  P(`gel ${n} (deep): white title/value`, 'text', 4.5, `${L}.onInk`, gelStops('deep', n));
  P(`gel ${n} (deep): white secondary (alpha)`, 'text', 4.5, [`${L}.onInk`, 'alpha.whiteOnDeepSecondary'], gelStops('deep', n));
  P(`gel ${n} (deep): focus halo vs core`, 'ui', 3.0, `${L}.focusHalo`, [`gel.deep.${n}.core`]);
}
// frost plates over any backdrop
const frostLightOver = backdrops.map((b) => [b, [`${L}.onInk`, 'alpha.frostText']]);
P('frost light plate: ink text over any backdrop', 'text', 4.5, `${L}.ink`, frostLightOver);
P('frost light plate: ink secondary over any backdrop', 'text', 4.5, `${L}.inkSecondary`, frostLightOver);
const frostDarkOver = backdrops.map((b) => [b, [`${D}.plateScrim`, 'alpha.frostDarkScrim']]);
P('frost dark plate: ink text over any backdrop', 'text', 4.5, `${D}.ink`, frostDarkOver);
P('frost dark plate: ink secondary over any backdrop', 'text', 4.5, `${D}.inkSecondary`, frostDarkOver);
P('sky glass light plate: ink over the sky range', 'text', 4.5, `${L}.ink`,
  ['top', 'bottom', 'screen'].map((k) => [`color.sky.${k}`, [`${L}.onInk`, 'alpha.frostText']]));
P('sky glass dark plate: white over the sky range', 'text', 4.5, `${L}.onInk`,
  ['top', 'bottom', 'screen'].map((k) => [`color.sky.${k}`, ['color.sky.scrim', 'alpha.skyScrim']]));
// Round 2: tinted frost plate (SPEC 2b, 10.2 rule 4). The plate is the ground's own tint mixed with white
// (alpha.frostTintShare), laid at alpha.frostTint; it is only valid over a declared ground variant, so it is
// checked over every blob colour of that ground, not over any backdrop. The 'strong' plate above keeps the
// any-backdrop guarantee.
const mixHex = (a, b, share) => {
  const [x, y] = [hex2rgb(a), hex2rgb(b)];
  return rgb2hex(x.map((v, i) => v * share + y[i] * (1 - share)));
};
const GR = TOK.grounds;
const blobs = (g) => Object.entries(g).filter(([k, v]) => k !== 'tint' && typeof v === 'string' && v.startsWith('#')).map(([, v]) => v);
export const groundSets = {
  pink: { tint: GR.pink.tint, stops: blobs(GR.pink) },
  mint: { tint: GR.mint.tint, stops: blobs(GR.mint) },
  cream: { tint: GR.cream.tint, stops: blobs(GR.cream) },
  sky: { tint: GR.sky.tint, stops: [...blobs(GR.sky), ...['top', 'bottom', 'screen'].map((k) => TOK.color.sky[k])] },
  light: { tint: TOK.color.light.ground, stops: [TOK.color.light.ground, TOK.color.light.card] },
};
for (const [gname, g] of Object.entries(groundSets)) {
  const plate = mixHex(g.tint, '#ffffff', TOK.alpha.frostTintShare);
  const bgs = g.stops.map((s) => [s, [plate, 'alpha.frostTint']]);
  P(`tinted frost plate (${gname} ground): ink text`, 'text', 4.5, `${L}.ink`, bgs);
  P(`tinted frost plate (${gname} ground): ink secondary`, 'text', 4.5, `${L}.inkSecondary`, bgs);
}
// gel edge wash + highlight stacked under the text zone (worst case: full edge alpha, full highlight alpha)
for (const n of names) {
  const vivid = ['top', 'mid', 'core', 'bottom'].map((s) => [`gel.vivid.${n}.${s}`, [`gel.vivid.${n}.rim`, 'alpha.gelEdgeVivid'], [`${L}.onInk`, 'alpha.highlight']]);
  const deep = ['top', 'mid', 'core', 'bottom'].map((s) => [`gel.deep.${n}.${s}`, [`gel.deep.${n}.rim`, 'alpha.gelEdgeDeep'], [`${L}.onInk`, 'alpha.highlightDeep']]);
  const lumi = ['top', 'mid', 'core', 'bottom'].map((s) => [`gel.luminous.${n}.${s}`, [`gel.luminous.${n}.rim`, 'alpha.gelEdgeLuminous'], [`${L}.onInk`, 'alpha.highlightLuminous']]);
  P(`gel ${n} (vivid): ink with edge wash + highlight`, 'text', 4.5, `${L}.ink`, vivid);
  // Deep and luminous carry 4.7 (not 4.5): a live probe reads about 0.15 lower than this composite (inset glow, grain).
  P(`gel ${n} (deep): white with edge wash + highlight`, 'text', 4.7, `${L}.onInk`, deep);
  P(`gel ${n} (luminous): white with edge wash + highlight`, 'text', 4.7, `${L}.onInk`, lumi);
  P(`gel ${n} (luminous): white title/value on the stops`, 'text', 4.5, `${L}.onInk`, gelStops('luminous', n));
  P(`gel ${n} (luminous): focus halo vs core`, 'ui', 3.0, `${L}.focusHalo`, [`gel.luminous.${n}.core`]);
}
// dark board luminous rim: the unlit side keeps the static edge floor, the lit side is a >= 3:1 graphic
P('dark rim, unlit side (white alpha) vs ground', 'floor', num('contrast.hairlineFloor'), [`${L}.onInk`, 'alpha.darkRimUnlit'], [`${D}.ground`, `${D}.panel`]);
P('dark rim, lit side (glow alpha) vs ground', 'ui', 3.0, [`${D}.glow`, 'alpha.darkRimLit'], [`${D}.ground`, `${D}.panel`]);
// dot numerals count as text; decision-critical values pair with real text (SPEC 5)
P('dot numeral: ink on card/ground', 'text', 4.5, `${L}.ink`, [`${L}.card`, `${L}.ground`]);
P('dot numeral: white on deep gel core', 'text', 4.5, `${L}.onInk`, names.map((n) => `gel.deep.${n}.core`));
P('dot numeral: white on luminous gel core', 'text', 4.5, `${L}.onInk`, names.map((n) => `gel.luminous.${n}.core`));

// Original-look pairs that MUST fail: proof each accessible rule is needed. Counted separately.
const expectFail = [];
const X = (id, min, fg, bg) => expectFail.push({ id, min, fg, bg });
X('original: white text on vivid pink core', 4.5, '#ffffff', 'gel.vivid.pink.core');
X('original: white text on vivid orange-magenta peach', 4.5, '#ffffff', 'gel.vivid.orangeMagenta.mid');
X('original: white text on vivid blue edge', 4.5, '#ffffff', 'gel.vivid.blue.top');
X('original: grey sublabel #b5b5b5 on white', 4.5, '#b5b5b5', '#ffffff');
X('original: ghost chip text #c6c6cc on #ececf0', 4.5, '#c6c6cc', '#ececf0');
X('original: lime #dff30f graphic on white', 3.0, '#dff30f', '#ffffff');
X('original: value-only card edge #f2f2f2 vs white as UI boundary', 3.0, '#f2f2f2', '#ffffff');
X('original: alpha 0.4 white label on vivid green core', 4.5, '#ffffff|0.4', 'gel.vivid.green.core');
X('original: ink at alpha 0.78 as secondary on vivid green core', 4.5, '#121214|0.78', 'gel.vivid.green.core');
X('original: dim label #5a5a5a on #1a1a1a', 4.5, '#5a5a5a', '#1a1a1a');

// ---------- evaluate ----------
const bgColour = (bg) => (Array.isArray(bg) ? compose(bg) : hex2rgb(resolve(bg)));
const bgName = (bg) => (Array.isArray(bg) ? bg.map((l) => (Array.isArray(l) ? l.join('@') : l)).join(' + ') : bg);

function evaluate() {
  return pairs.map((p) => {
    const [fref, fa = 1] = Array.isArray(p.fg) ? p.fg : [p.fg];
    const alpha = A(fa);
    let worst = null;
    const detail = [];
    for (const bg of p.bgs) {
      const b = bgColour(bg);
      const f = over(hex2rgb(resolve(fref)), alpha, b);
      const r = ratio(f, b);
      detail.push({ bg: bgName(bg), ratio: r });
      if (!worst || r < worst.ratio) worst = { bg: bgName(bg), ratio: r };
    }
    return { ...p, alpha, worst, count: p.bgs.length, ok: worst.ratio >= p.min, detail };
  });
}

function evaluateExpectFail() {
  return expectFail.map((x) => {
    const [fh, fa = '1'] = x.fg.split('|');
    const b = hex2rgb(resolve(x.bg));
    const r = ratio(over(hex2rgb(fh), Number(fa), b), b);
    return { ...x, r, ok: r < x.min };
  });
}

// Ground spread: lightness range of each stand-in ground, in CIELAB L* (SPEC 3). No near-black mass.
const lstar = (c) => {
  const y = luminance(c);
  const f = y > 216 / 24389 ? Math.cbrt(y) : ((24389 / 27) * y + 16) / 116;
  return 116 * f - 16;
};
function evaluateSpreads() {
  return ['pink', 'mint', 'cream', 'sky'].map((name) => {
    const ls = groundSets[name].stops.map((s) => lstar(hex2rgb(s)));
    const spread = Math.max(...ls) - Math.min(...ls);
    return { id: `ground spread: ${name}`, min: Math.min(...ls), max: Math.max(...ls), spread, ok: spread <= TOK.grounds.lstarSpreadMax };
  });
}

// Lowest tinted-plate alpha (alpha.frostTint) at which ink and ink-secondary both clear `target`, over every blob colour of every declared
// ground (SPEC 2b step 3, 10.2 rule 4). Used by `--derive-plate`; the shipped alpha adds a margin because a live probe reads slightly lower.
export function minFrostTint(target = 4.5) {
  const ink = hex2rgb(TOK.color.light.ink);
  const sec = hex2rgb(TOK.color.light.inkSecondary);
  for (let a = 0; a <= 1.0001; a += 0.01) {
    let ok = true;
    for (const g of Object.values(groundSets)) {
      const plate = hex2rgb(mixHex(g.tint, '#ffffff', TOK.alpha.frostTintShare));
      for (const stop of g.stops) {
        const bg = over(plate, a, hex2rgb(stop));
        if (ratio(ink, bg) < target || ratio(sec, bg) < target) ok = false;
      }
    }
    if (ok) return +a.toFixed(2);
  }
  return 1;
}

// ---------- self-test ----------
function selfTest() {
  const results = [];
  const t = (name, cond) => results.push([name, !!cond]);
  const near = (a, b, e) => Math.abs(a - b) <= e;
  t('black on white = 21:1', near(ratio([0, 0, 0], [255, 255, 255]), 21, 0.001));
  t('#777777 on white = 4.48:1 (just under 4.5)', near(ratio(hex2rgb('#777777'), [255, 255, 255]), 4.48, 0.01));
  t('#767676 on white >= 4.5 (the classic AA grey)', ratio(hex2rgb('#767676'), [255, 255, 255]) >= 4.5);
  t('alpha composite: white 0.5 over black is mid grey', near(over([255, 255, 255], 0.5, [0, 0, 0])[0], 127.5, 0.01));
  t('luminance of white = 1, black = 0', luminance([255, 255, 255]) === 1 && luminance([0, 0, 0]) === 0);
  t('tokens.json parses and has the required groups', ['color', 'gel', 'motion', 'radius', 'contrast', 'alpha'].every((k) => TOK[k]));
  t('at least the five canonical colourways, and vivid, deep and luminous list the same names', names.length >= 5 && names.every((n) => TOK.gel.deep[n] && TOK.gel.luminous[n]) && Object.keys(TOK.gel.deep).length === names.length && Object.keys(TOK.gel.luminous).length === names.length);
  t('every pair reference resolves to a hex or number', (() => {
    try { evaluate(); evaluateExpectFail(); return true; } catch (e) { console.error(e.message); return false; }
  })());
  let derOk = true;
  let derDeepOk = true;
  for (let h = 0; h < 360; h += 30) {
    const v = deriveGel(h, 'ink');
    const d = deriveGel(h, 'deep');
    for (const k of ['top', 'mid', 'core', 'bottom']) {
      if (ratio(hex2rgb(TOK.color.light.ink), hex2rgb(v[k])) < 4.5) derOk = false;
      if (ratio([255, 255, 255], hex2rgb(d[k])) < 4.5) derDeepOk = false;
    }
  }
  t('derive(hue, ink) passes ink 4.5:1 for 12 hues x 4 stops', derOk);
  t('derive(hue, deep) passes white 4.5:1 for 12 hues x 4 stops', derDeepOk);
  let lumOk = true;
  for (let h = 0; h < 360; h += 30) {
    const v = deriveGel(h, 'luminous');
    for (const k of ['top', 'mid', 'core', 'bottom']) if (ratio([255, 255, 255], hex2rgb(v[k])) < 4.5) lumOk = false;
  }
  t('derive(hue, luminous) passes white 4.5:1 for 12 hues x 4 stops', lumOk);
  t('stored luminous ramps equal the rule applied to the vivid ramps', names.every((n) => { const g = luminousFromVivid(TOK.gel.vivid[n]); return ['top', 'mid', 'core', 'bottom'].every((k) => g[k] === TOK.gel.luminous[n][k]); }));
  t('every stand-in ground stays within the L* spread cap (no near-black mass)', evaluateSpreads().every((s) => s.ok));
  t('all original-look pairs fail as expected (the rules are necessary)', evaluateExpectFail().every((x) => x.ok));
  t('gel stops are hex in vivid, deep and luminous', names.every((n) => ['top', 'mid', 'core', 'bottom', 'rim'].every(
    (k) => ['vivid', 'deep', 'luminous'].every((set) => /^#[0-9a-f]{6}$/i.test(TOK.gel[set][n][k])))));
  t('spring tokens carry linear() easing strings', ['sheet', 'press', 'settle'].every((k) => /^linear\(/.test(TOK.motion.spring[k].linear)));
  t('spring tokens are under-damped only where overshoot is declared', ['sheet', 'press'].every((k) => {
    const s = TOK.motion.spring[k];
    const zeta = s.friction / (2 * Math.sqrt(s.tension * (s.mass ?? 1)));
    return zeta > 0.6 && zeta < 0.8;
  }));
  let fails = 0;
  for (const [n, ok] of results) {
    console.log((ok ? 'ok   ' : 'FAIL ') + n);
    if (!ok) fails++;
  }
  console.log(fails ? `self-test: ${fails} failed` : `self-test: ${results.length} passed`);
  return fails === 0;
}

// ---------- CLI ----------
// Importable (add-colourway.mjs reuses deriveGel, luminousFromVivid and the gate); the CLI only runs when this file is the entry point.
const isMain = process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
const args = process.argv.slice(2);
if (args.includes('--derive')) {
  const h = Number(args[args.indexOf('--derive') + 1]);
  console.log(JSON.stringify({ hue: h, vivid: deriveGel(h, 'ink'), deep: deriveGel(h, 'deep'), luminous: deriveGel(h, 'luminous') }, null, 1));
  process.exit(0);
}
if (args.includes('--derive-plate')) {
  const t = Number(args[args.indexOf('--derive-plate') + 1]) || 4.5;
  console.log(JSON.stringify({ target: t, minFrostTint: minFrostTint(t), shipped: TOK.alpha.frostTint, share: TOK.alpha.frostTintShare }, null, 1));
  process.exit(0);
}
if (args.includes('--luminous')) {
  // Prints gel.luminous for the five canonical colourways, to paste into tokens.json.
  console.log(JSON.stringify(Object.fromEntries(names.map((n) => [n, luminousFromVivid(TOK.gel.vivid[n])])), null, 2));
  process.exit(0);
}
if (args.includes('--self-test')) process.exit(selfTest() ? 0 : 1);

const rows = evaluate();
const ef = evaluateExpectFail();
const fmt = (r) => r.toFixed(2).padStart(5);
if (args.includes('--md')) {
  console.log('| Pair | Kind | Worst background | Ratio | Min | Result |\n| --- | --- | --- | --- | --- | --- |');
  for (const r of rows) {
    console.log(`| ${r.id} | ${r.kind} | ${r.worst.bg.replace(/\|/g, '/')} | ${r.worst.ratio.toFixed(2)} | ${r.min} | ${r.ok ? 'pass' : 'FAIL'} |`);
  }
} else {
  for (const r of rows) {
    console.log(`${r.ok ? 'pass' : 'FAIL'}  ${fmt(r.worst.ratio)} >= ${String(r.min).padEnd(3)}  [${r.kind}] ${r.id}  (worst of ${r.count}: ${r.worst.bg})`);
    if (args.includes('--verbose')) for (const d of r.detail) console.log(`        ${fmt(d.ratio)}  ${d.bg}`);
  }
}
const checked = rows.reduce((n, r) => n + r.count, 0);
const failed = rows.filter((r) => !r.ok);
console.log('\nOriginal-look pairs that must fail (proof the rules are needed):');
for (const x of ef) console.log(`${x.ok ? 'fails-as-expected' : 'UNEXPECTED-PASS'}  ${fmt(x.r)} < ${x.min}  ${x.id}`);
const spreads = evaluateSpreads();
console.log('\nGround lightness spread (CIELAB L*, cap ' + TOK.grounds.lstarSpreadMax + '):');
for (const s of spreads) console.log(`${s.ok ? 'pass' : 'FAIL'}  L* ${s.min.toFixed(0)}..${s.max.toFixed(0)} = ${s.spread.toFixed(1)}  ${s.id}`);
const efBad = ef.filter((x) => !x.ok);
console.log(`\n${rows.length} pairs (${checked} background combinations) checked, ${failed.length} failed; ${spreads.length} ground spreads, ${spreads.filter((s) => !s.ok).length} over the cap; ${ef.length} original-look pairs, ${efBad.length} unexpectedly passed.`);
process.exit(failed.length || efBad.length || spreads.some((s) => !s.ok) ? 1 : 0);
}
