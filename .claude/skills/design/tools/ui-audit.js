/* ui-audit.js -- DOM geometry audit for the /design skill (web only).

   Run it through chrome-devtools: evaluate_script { sourcePath: "<this file>" } (format "function").
   It returns JSON: viewport, what it scanned, counts per check, and at most 40 findings.
   Every finding is a CANDIDATE to look at (screenshot it, read the selector's code), never a verdict.
   It reads the page; the one exception is `squeezed`, which sets flex-shrink:0 on a few small flex items for
   one measurement and restores the inline value in a finally block.
   Run it at 390, 768 and 1280 wide, and again with emulate colorScheme dark.
   `inconclusive: true` (almost nothing scanned: a canvas, an iframe-only page) means the gate is
   `unavailable`, not `pass`. Iframes and shadow roots are counted in `scanned`, never entered.

   Ideas and thresholds follow stageshow's film-checks.mjs / layout-core.mjs (MIT, (c) 2026 Benji Taylor,
   https://github.com/benjitaylor/skills), re-implemented here for real UI. The px values are defaults:
   when the project has a spacing token, a brand wins (vdWolde: 4 8 12 16 24 32 48).
   Self-check: tools/fixtures/ui-audit-bad.html reports every check once, ui-audit-good.html reports none.
*/
() => {
  const W = innerWidth, H = innerHeight;
  const cs = new Map(), rc = new Map();
  const S = (e) => { let s = cs.get(e); if (!s) cs.set(e, (s = getComputedStyle(e))); return s; };
  const R = (e) => { let r = rc.get(e); if (!r) rc.set(e, (r = e.getBoundingClientRect())); return r; };
  const num = (v) => parseFloat(v) || 0;
  const alpha = (c) => {
    if (!c || c === 'transparent') return 0;
    let m = c.match(/\/\s*([\d.]+)(%?)\s*\)/);
    if (m) return m[2] ? m[1] / 100 : +m[1];
    m = c.match(/^rgba\(([^)]+)\)/);
    if (m) { const p = m[1].split(','); return p.length === 4 ? +p[3] : 1; }
    return 1;
  };
  const sides = ['Top', 'Right', 'Bottom', 'Left'];
  const painted = (e) => {
    const s = S(e);
    return alpha(s.backgroundColor) > 0.02 || s.backgroundImage !== 'none' ||
      sides.some((k) => num(s['border' + k + 'Width']) > 0 && s['border' + k + 'Style'] !== 'none' && alpha(s['border' + k + 'Color']) > 0.02) ||
      (s.boxShadow !== 'none' && !/^rgba?\(0, 0, 0, 0\)/.test(s.boxShadow));
  };
  /* a card/panel: a fill, an image, a shadow, or borders on at least two sides (a lone border-bottom is a rule, not a box) */
  const enclosed = (e) => {
    const s = S(e);
    return alpha(s.backgroundColor) > 0.02 || s.backgroundImage !== 'none' ||
      (s.boxShadow !== 'none' && !/^rgba?\(0, 0, 0, 0\)/.test(s.boxShadow)) ||
      sides.filter((k) => num(s['border' + k + 'Width']) > 0 && s['border' + k + 'Style'] !== 'none' && alpha(s['border' + k + 'Color']) > 0.02).length >= 2;
  };
  const vis = (e) => {
    const r = R(e);
    if (r.width < 0.5 && r.height < 0.5) return false;
    if (r.width <= 1 && r.height <= 1) return false;
    try { return e.checkVisibility({ checkOpacity: true, opacityProperty: true, checkVisibilityCSS: true, visibilityProperty: true }); }
    catch { return S(e).visibility !== 'hidden' && S(e).display !== 'none'; }
  };
  const sel = (e) => {
    const parts = [];
    for (let x = e; x && x !== document.body && parts.length < 3; x = x.parentElement) {
      let s = x.tagName.toLowerCase();
      if (x.id) { parts.unshift(s + '#' + CSS.escape(x.id)); break; }
      s += [...x.classList].filter((c) => c.length < 24).slice(0, 2).map((c) => '.' + CSS.escape(c)).join('');
      parts.unshift(s);
    }
    return (parts.join(' > ') || e.tagName.toLowerCase()).slice(0, 150);
  };
  const r1 = (n) => Math.round(n * 10) / 10;
  const out = [], counts = {}, notes = [];
  const add = (check, e, detail, severity = 'candidate') => {
    counts[check] = (counts[check] || 0) + 1;
    out.push({ check, severity, selector: sel(e), rect: ((r) => [r1(r.left), r1(r.top), r1(r.width), r1(r.height)])(e.getBoundingClientRect()), detail });
  };
  const run = (name, fn) => { try { fn(); } catch (err) { notes.push(name + ' failed: ' + String(err).slice(0, 80)); } };
  const inScroller = (e) => {
    for (let a = e.parentElement; a; a = a.parentElement) {
      const s = S(a);
      if (/(auto|scroll)/.test(s.overflowX) && a.scrollWidth > a.clientWidth + 1) return true;
    }
    return false;
  };
  const union = (rs) => {
    let l = 1e9, t = 1e9, r = -1e9, b = -1e9;
    for (const q of rs) { l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom); }
    return { left: l, top: t, right: r, bottom: b, width: r - l, height: b - t };
  };

  /* ---- scan ---- */
  const SKIP = /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|BR|WBR|SOURCE|TRACK|META|LINK|DATALIST|OPTION|OPTGROUP|AREA|MAP|COL|COLGROUP|HEAD|TITLE)$/;
  const everything = [...document.body.querySelectorAll('*')].filter((e) => !e.ownerSVGElement && !SKIP.test(e.tagName));
  const truncated = everything.length > 4000;
  const els = everything.slice(0, 4000).filter(vis);
  const runs = [];
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = tw.nextNode()) && runs.length < 3000;) {
    if (!n.nodeValue.trim()) continue;
    const p = n.parentElement;
    if (!p || p.ownerSVGElement || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|OPTION)$/.test(p.tagName) || !vis(p)) continue;
    const rg = document.createRange(); rg.selectNodeContents(n);
    const rs = [...rg.getClientRects()].filter((q) => q.width > 0.5 && q.height > 0.5);
    if (!rs.length) continue;
    const u = union(rs);
    const tops = rs.map((q) => q.top).sort((a, b) => a - b);
    let lines = 1;
    for (let i = 1; i < tops.length; i++) if (tops[i] > tops[i - 1] + 0.6 * rs[0].height) lines++;
    runs.push({ el: p, r: u, lines, fs: num(S(p).fontSize), text: n.nodeValue.trim() });
  }
  const icons = els.filter((e) => e.tagName.toLowerCase() === 'svg' && R(e).width <= 40 && R(e).height <= 40);
  const replaced = els.filter((e) => /^(IMG|VIDEO|CANVAS|INPUT|SELECT|PROGRESS|METER)$/.test(e.tagName) || (e.tagName.toLowerCase() === 'svg'));
  const leaves = [...runs.map((x) => ({ el: x.el, r: x.r, run: true })), ...replaced.map((e) => ({ el: e, r: R(e) }))];
  const surfaces = els.filter((e) => e !== document.documentElement && enclosed(e) && R(e).width >= 40 && R(e).height >= 24).slice(0, 300);
  const contentOf = (a) => {
    const ar = R(a), s = S(a), ps = [];
    for (const l of leaves) if ((l.run || l.el !== a) && a.contains(l.el) && l.r.width > 0 && l.r.height > 0) ps.push(l.r);
    if (!ps.length) return null;
    const c = union(ps);
    const bl = num(s.borderLeftWidth), br = num(s.borderRightWidth), bt = num(s.borderTopWidth), bb = num(s.borderBottomWidth);
    return { c, L: c.left - (ar.left + bl), Rr: ar.right - br - c.right, T: c.top - (ar.top + bt), B: ar.bottom - bb - c.bottom };
  };
  const ellipsisBetween = (from, to) => {
    for (let x = from; x; x = x.parentElement) {
      const s = S(x);
      if (s.textOverflow === 'ellipsis' || (s.webkitLineClamp && s.webkitLineClamp !== 'none')) return true;
      if (x === to) break;
    }
    return false;
  };

  /* ---- page level ---- */
  run('page-overflow', () => {
    const sw = document.documentElement.scrollWidth;
    if (sw > W + 1) {
      const off = els.filter((e) => R(e).right > W + 1 && !inScroller(e) && S(e).position !== 'fixed').slice(0, 4).map(sel);
      add('page-overflow', document.body, `page is ${sw}px wide in a ${W}px viewport (horizontal scroll); first offenders: ${off.join(' | ') || 'n/a'}`, 'fail');
    }
  });

  /* ---- text ---- */
  run('small-text', () => {
    const by = {};
    for (const x of runs) {
      if (x.fs < 12) (by[x.fs] ||= []).push(x);
    }
    for (const [fs, xs] of Object.entries(by)) {
      const f = +fs;
      add('small-text', xs[0].el, `${xs.length} text run(s) at ${f}px (e.g. "${xs[0].text.slice(0, 30)}"); under 10 px is a fail, 10-11.9 px a note (brand body text is 14 px or more)`, f < 10 ? 'fail' : 'note');
    }
  });
  run('words-cut', () => {
    for (const x of runs) {
      const r = x.r;
      const cross = (r.left < -1 && r.right > 1) || (r.right > W + 1 && r.left < W - 1);
      if (cross && !inScroller(x.el) && S(x.el).position !== 'fixed') add('words-cut', x.el, `text "${x.text.slice(0, 30)}" crosses the viewport edge (${r1(r.left)} to ${r1(r.right)} of ${W})`);
    }
    for (const e of els.filter((q) => q.matches('button,[role=button],a[href],input,select'))) {
      const r = R(e);
      if (((r.left < -1 && r.right > 1) || (r.right > W + 1 && r.left < W - 1)) && !inScroller(e) && S(e).position !== 'fixed') add('words-cut', e, `control crosses the viewport edge (${r1(r.left)} to ${r1(r.right)} of ${W})`);
    }
  });
  run('clipped', () => {
    const seen = new Set();
    const test = (e, r, label) => {
      for (let a = e.parentElement; a && a !== document.documentElement; a = a.parentElement) {
        const s = S(a);
        if (!/(hidden|clip)/.test(s.overflowX + s.overflowY)) continue;
        const ar = R(a);
        if (ar.width <= 1 || ar.height <= 1) continue;
        const ix = Math.min(r.right, ar.right) - Math.max(r.left, ar.left), iy = Math.min(r.bottom, ar.bottom) - Math.max(r.top, ar.top);
        if (ix <= 0 || iy <= 0) continue;
        const cuts = [['left', ar.left - r.left, ar.left > 2], ['right', r.right - ar.right, ar.right < W - 2], ['top', ar.top - r.top, true], ['bottom', r.bottom - ar.bottom, true]];
        const c = cuts.find(([, d, inside]) => d > 0.5 && inside);
        if (c && !ellipsisBetween(e, a) && !seen.has(e)) { seen.add(e); add('clipped', e, `${label} is cut ${r1(c[1])}px at the ${c[0]} by ${sel(a)} (overflow hidden)`); }
      }
    };
    for (const x of runs) test(x.el, x.r, `text "${x.text.slice(0, 24)}"`);
    for (const i of icons) test(i, R(i), 'icon');
  });

  /* ---- controls ---- */
  run('hit-target', () => {
    const coarse = matchMedia('(pointer: coarse)').matches;
    const q = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=link],[role=checkbox],[role=radio],[role=switch],[role=tab],[role=menuitem],[role=option],[tabindex]:not([tabindex="-1"])';
    for (const e of els.filter((x) => x.matches(q))) {
      if (e.disabled || (S(e).display === 'inline' && e.tagName === 'A')) continue;
      const lab = e.closest('label');
      const r = lab && /^(checkbox|radio)$/.test(e.type) ? R(lab) : R(e);
      const m = Math.min(r.width, r.height);
      if (m < 24) add('hit-target', e, `target is ${r1(r.width)}x${r1(r.height)}px; WCAG 2.5.8 floor is 24 (a spacing exception may apply)`, 'fail');
      else if (coarse && m < 44) add('hit-target', e, `target is ${r1(r.width)}x${r1(r.height)}px on a coarse pointer; 44 is the touch size`, 'note');
    }
  });
  run('control-fit', () => {
    for (const e of els.filter((x) => x.matches('button,[role=button],input[type=button],input[type=submit]'))) {
      if (ellipsisBetween(e, e)) continue;
      const dx = e.scrollWidth - e.clientWidth, dy = e.scrollHeight - e.clientHeight;
      if (dx > 1 || dy > 1) add('control-fit', e, `content is ${dx > 1 ? dx + 'px wider' : ''}${dx > 1 && dy > 1 ? ' and ' : ''}${dy > 1 ? dy + 'px taller' : ''} than the control's box`);
    }
  });
  run('spills', () => {
    for (const p of surfaces) {
      const s = S(p);
      if (/(hidden|clip|auto|scroll)/.test(s.overflowX + s.overflowY) || /^(contents|inline)$/.test(s.display)) continue;
      const pr = R(p);
      for (const c of p.children) {
        if (!vis(c)) continue;
        const cs2 = S(c), r = R(c);
        if (!/^(static|relative|sticky)$/.test(cs2.position) || sides.some((k) => num(cs2['margin' + k]) < 0)) continue;
        if (r.right > pr.right + 3 || r.left < pr.left - 3) add('spills', c, `child extends ${r1(Math.max(r.right - pr.right, pr.left - r.left))}px past its parent ${sel(p)}`);
      }
    }
  });

  /* ---- insets and padding ---- */
  run('tight-inset', () => {
    const best = new Map();
    for (const x of runs) {
      let a = x.el;
      while (a && a !== document.body && !(enclosed(a) && R(a).height > 44 && R(a).width >= 80)) a = a.parentElement;
      if (!a || a === document.body || a === document.documentElement) continue;
      const ar = R(a), s = S(a);
      const d = Math.min(x.r.left - ar.left - num(s.borderLeftWidth), ar.right - num(s.borderRightWidth) - x.r.right);
      if (d >= 0 && d < 8 && (!best.has(a) || best.get(a).d > d)) best.set(a, { d, t: x.text });
    }
    for (const [a, v] of best) add('tight-inset', a, `text "${v.t.slice(0, 30)}" sits ${r1(v.d)}px from the card edge (12 is right, under 8 is flagged)`);
  });
  run('uneven-padding', () => {
    for (const a of surfaces) {
      const r = R(a);
      if (r.height < 80 || r.width > r.height * 4 || r.width >= W - 1) continue;
      const g = contentOf(a);
      if (!g) continue;
      const side = Math.min(g.L, g.Rr);
      if (side < 8) continue;
      for (const [name, v] of [['top', g.T], ['bottom', g.B]]) {
        if (v >= 0 && v < 0.7 * side && side - v >= 4) add('uneven-padding', a, `${name} gap ${r1(v)}px against a side gap of ${r1(side)}px`);
      }
    }
  });
  run('uneven-inset', () => {
    for (const a of surfaces) {
      const r = R(a);
      if (r.height < 24 || r.height > 80) continue;
      const g = contentOf(a);
      if (!g || g.c.width < 0.7 * r.width) continue;
      const big = Math.max(g.L, g.Rr), small = Math.min(g.L, g.Rr);
      if (big >= 16 && small < 0.55 * big && big - small >= 6) add('uneven-inset', a, `content sits ${r1(g.L)}px from the left and ${r1(g.Rr)}px from the right`);
    }
    const ctl = els.filter((x) => x.matches('button,[role=button],[role=tab],input[type=button],input[type=submit],[class*=badge],[class*=chip],[class*=pill]'));
    for (const a of ctl) {
      const r = R(a), s = S(a);
      if (r.height < 14 || r.height > 44 || /^(left|start)$/.test(s.textAlign) && s.display === 'block') continue;
      const g = contentOf(a);
      if (!g || g.c.width < 0.45 * r.width) continue;
      if (Math.abs(g.L - g.Rr) > 3) add('lopsided', a, `content has ${r1(g.L)}px on the left and ${r1(g.Rr)}px on the right`);
    }
  });
  run('touching', () => {
    const flexy = (e) => /(flex|grid)/.test(S(e).display);
    const seen = new Set();
    for (const x of runs) {
      let item = x.el;
      for (let i = 0; i < 4 && item && !(item.parentElement && flexy(item.parentElement)); i++) item = item.parentElement;
      if (!item || !item.parentElement || !flexy(item.parentElement) || seen.has(item)) continue;
      seen.add(item);
      const par = item.parentElement, cg = num(S(par).columnGap);
      for (const sib of par.children) {
        if (sib === item || !vis(sib)) continue;
        const sr = R(sib);
        if (sr.width < 4 || sr.height < 4) continue;
        const ov = Math.min(x.r.bottom, sr.bottom) - Math.max(x.r.top, sr.top);
        if (ov < 0.4 * Math.min(x.r.height, sr.height)) continue;
        const gap = sr.left >= x.r.right ? sr.left - x.r.right : x.r.left >= sr.right ? x.r.left - sr.right : -1;
        if (gap < (cg >= 4 ? 2 : 5)) { add('touching', x.el, `text "${x.text.slice(0, 24)}" is ${gap < 0 ? 'overlapping' : r1(gap) + 'px from'} ${sel(sib)}`); break; }
      }
    }
  });
  run('near-tangent', () => {
    let n = 0;
    for (let i = 0; i < surfaces.length && n < 8; i++) for (let j = i + 1; j < surfaces.length && n < 8; j++) {
      const a = surfaces[i], b = surfaces[j];
      if (a.contains(b) || b.contains(a)) continue;
      const ra = R(a), rb = R(b);
      const stacked = rb.top >= ra.bottom - 1 && rb.top - ra.bottom < 300 || ra.top >= rb.bottom - 1 && ra.top - rb.bottom < 300;
      const beside = rb.left >= ra.right - 1 && rb.left - ra.right < 300 || ra.left >= rb.right - 1 && ra.left - rb.right < 300;
      const near = (d) => d >= 1 && d <= 3;
      let why = '';
      if (stacked && near(Math.abs(ra.left - rb.left))) why = `left edges ${r1(Math.abs(ra.left - rb.left))}px apart`;
      else if (stacked && near(Math.abs(ra.right - rb.right))) why = `right edges ${r1(Math.abs(ra.right - rb.right))}px apart`;
      else if (beside && near(Math.abs(ra.top - rb.top))) why = `top edges ${r1(Math.abs(ra.top - rb.top))}px apart`;
      else if (beside && near(Math.abs(ra.bottom - rb.bottom))) why = `bottom edges ${r1(Math.abs(ra.bottom - rb.bottom))}px apart`;
      if (why) { n++; add('near-tangent', a, `${why} from ${sel(b)}: align exactly or part them`); }
    }
  });
  run('tight-control', () => {
    for (const b of els.filter((x) => x.matches('button,[role=button]') && painted(x))) {
      const p = b.previousElementSibling;
      if (!p || !vis(p)) continue;
      const br = R(b), pr = R(p);
      const gap = br.top - pr.bottom;
      if (gap >= 0 && gap < 8 && Math.min(br.right, pr.right) - Math.max(br.left, pr.left) > 20 && (painted(p) || /^(INPUT|TEXTAREA|SELECT)$/.test(p.tagName))) add('tight-control', b, `button is ${r1(gap)}px below ${sel(p)} (8 to 12 reads as attached but separate)`);
    }
  });

  /* ---- rhythm and typography ---- */
  run('unit-wrapped', () => {
    for (const x of runs) {
      if (x.fs >= 28 && x.lines > 1 && /^[\s\d.,+\-−€$£%]+\s*\S{1,4}\s*$/.test(x.text)) add('unit-wrapped', x.el, `"${x.text}" wraps onto ${x.lines} lines at ${x.fs}px: the unit is on its own line`);
    }
    for (const e of els.filter((q) => num(S(q).fontSize) >= 28 && q.children.length)) {
      const own = runs.find((x) => x.el === e && /\d/.test(x.text));
      if (!own) continue;
      for (const c of e.children) {
        const t = (c.textContent || '').trim();
        if (t.length >= 1 && t.length <= 4 && vis(c) && R(c).top >= own.r.bottom - 2) add('unit-wrapped', e, `unit "${t}" sits below the number`);
      }
    }
  });
  run('stack-gap', () => {
    const ordered = runs.filter((x) => x.lines === 1);
    for (let i = 0; i < ordered.length - 1; i++) {
      const a = ordered[i], b = ordered[i + 1];
      if (a.el === b.el || !(a.el.parentElement === b.el.parentElement || a.el.parentElement?.parentElement === b.el.parentElement?.parentElement)) continue;
      const gap = b.r.top - a.r.bottom;
      if (gap < -8 || gap > 20 || Math.abs(a.r.left - b.r.left) > 6) continue;
      const sa = S(a.el), sb = S(b.el);
      if (sa.fontSize === sb.fontSize && sa.fontWeight === sb.fontWeight && sa.color === sb.color) continue;
      const ink = gap + 0.24 * (a.fs + b.fs);
      if (ink < 3) add('stack-gap', b.el, `${r1(ink)}px of ink between "${a.text.slice(0, 20)}" and "${b.text.slice(0, 20)}" (estimated, 4 to 6 is right)`);
      else if (ink > 10 && Math.max(a.fs, b.fs) < 15) add('stack-gap', b.el, `${r1(ink)}px of ink between two small lines (estimated; reads as two items, 4 to 6 is right)`, 'note');
    }
  });
  run('rows', () => {
    const cont = els.filter((x) => x.children.length >= 3);
    for (const c of cont) {
      const kids = [...c.children].filter(vis);
      if (kids.length < 3 || !kids.every((k) => k.tagName === kids[0].tagName)) continue;
      const hs = kids.map((k) => R(k).height), med = [...hs].sort((x, y) => x - y)[Math.floor(hs.length / 2)];
      if (hs.some((h) => Math.abs(h - med) > 0.1 * med) || R(kids[0]).width < 120) continue;
      const lineCount = (k) => runs.filter((x) => k.contains(x.el)).reduce((n, x) => n + x.lines, 0);
      const oneLine = kids.every((k) => lineCount(k) === 1);
      const fs = num(S(kids[0]).fontSize);
      if (oneLine && med > 3.4 * fs && med > 48) add('fat-row', c, `${kids.length} one-line rows of ${r1(med)}px at ${fs}px type (padding 12, dense 8)`);
      const gaps = kids.slice(1).map((k, i) => R(k).top - R(kids[i]).bottom).sort((x, y) => x - y);
      const mg = gaps[Math.floor(gaps.length / 2)];
      if (kids.length >= 3 && R(kids[1]).top > R(kids[0]).bottom - 1 && mg > Math.max(24, med)) add('loose-list', c, `median gap ${r1(mg)}px between rows of ${r1(med)}px: rows spread to fill the space`);
    }
  });
  run('text-wrap', () => {
    for (const x of runs.filter((q) => /^H[1-3]$/.test(q.el.tagName) && q.lines >= 2)) {
      const tw2 = S(x.el).textWrapStyle;
      if (tw2 === 'auto') add('text-wrap', x.el, `heading wraps onto ${x.lines} lines with text-wrap: auto (use balance)`, 'note');
    }
  });
  run('tabular-nums', () => {
    for (const x of runs) {
      if (/^(TD|TH)$/.test(x.el.tagName) && /^[\s\d.,:+\-−€$£%]{3,}$/.test(x.text) && !/tabular/.test(S(x.el).fontVariantNumeric)) add('tabular-nums', x.el, `figure "${x.text}" in a table cell without tabular-nums (needs a font that has tnum: Sora yes, DM Sans no)`, 'note');
    }
  });

  /* ---- icons ---- */
  run('mixed-icons', () => {
    const kind = (svg) => {
      const sh = [...svg.querySelectorAll('path,circle,rect,ellipse,polygon,polyline,line')].slice(0, 6);
      const fill = sh.some((s) => { const f = getComputedStyle(s).fill; return f !== 'none' && alpha(f) > 0.02; });
      const stroke = sh.some((s) => { const q = getComputedStyle(s); return q.stroke !== 'none' && num(q.strokeWidth) > 0; });
      return fill && !stroke ? 'filled' : !fill && stroke ? 'outline' : 'other';
    };
    const roots = els.filter((x) => x.matches('nav,header,aside,ul,ol,[role=toolbar],[role=tablist],[role=menu]'));
    for (const c of roots) {
      const sv = icons.filter((i) => c.contains(i));
      if (sv.length < 3) continue;
      const ks = new Set(sv.map(kind));
      const ws = sv.map((i) => R(i).width);
      if (ks.has('filled') && ks.has('outline')) add('mixed-icons', c, `${sv.length} icons mix filled and outline styles`);
      else if (Math.max(...ws) - Math.min(...ws) > 2) add('mixed-icons', c, `${sv.length} icons range from ${r1(Math.min(...ws))} to ${r1(Math.max(...ws))}px wide: one size per set`);
    }
  });
  run('emoji-icon', () => {
    const re = /\p{Extended_Pictographic}/u, strip = /[\p{Extended_Pictographic}️‍\s]/gu;
    for (const x of runs) {
      if (!re.test(x.text) || x.text.replace(strip, '') !== '') continue;
      const e = x.el, r = R(e), sib = e.parentElement && runs.some((y) => y.el !== e && e.parentElement.contains(y.el) && y.text.replace(strip, '') !== '');
      if ((r.width <= 56 && r.height <= 56 && sib) || e.closest('button,[role=tab],[role=menuitem],nav,th')) add('emoji-icon', e, `emoji "${x.text}" used as an icon (emoji are content, not icons)`);
    }
  });
  run('clipped-glyph', () => {
    for (const i of icons) {
      if (S(i).overflow === 'visible' || !i.viewBox?.baseVal?.width) continue;
      const bb = i.getBBox(), vb = i.viewBox.baseVal;
      const sw = Math.max(0, ...[...i.querySelectorAll('*')].slice(0, 8).map((s) => num(getComputedStyle(s).strokeWidth)));
      const pad = sw / 2 + 0.25;
      if (bb.x < vb.x - pad || bb.y < vb.y - pad || bb.x + bb.width > vb.x + vb.width + pad || bb.y + bb.height > vb.y + vb.height + pad) add('clipped-glyph', i, `drawing (${r1(bb.x)},${r1(bb.y)} ${r1(bb.width)}x${r1(bb.height)}) runs past its viewBox`);
    }
  });
  run('translucent', () => {
    const groups = new Map();
    for (const e of els) if (e.parentElement && vis(e)) { const k = e.parentElement; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); }
    let n = 0;
    for (const [, kids] of groups) {
      const tr = kids.filter((k) => { const a = alpha(S(k).backgroundColor); return a > 0.02 && a < 0.98 && R(k).width >= 8; });
      for (let i = 0; i < tr.length && n < 6; i++) for (let j = i + 1; j < tr.length && n < 6; j++) {
        const a = R(tr[i]), b = R(tr[j]);
        if ((Math.min(a.right, b.right) - Math.max(a.left, b.left)) * (Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) > 4 && Math.min(a.right, b.right) > Math.max(a.left, b.left)) { n++; add('onion-skin', tr[i], `overlaps ${sel(tr[j])}; both have see-through fills (use opaque fills)`); }
      }
    }
    for (const i of icons.slice(0, 200)) {
      const sh = i.querySelector('path,circle,rect,line,polyline,polygon');
      if (!sh) continue;
      const q = getComputedStyle(sh), a = Math.max(q.fill !== 'none' ? alpha(q.fill) : 0, q.stroke !== 'none' ? alpha(q.stroke) : 0);
      if (a > 0.02 && a < 0.98) { add('translucent-icon', i, `icon ink has alpha ${r1(a)}; strokes that cross paint darker (use one opaque colour, fade with opacity)`, 'note'); break; }
    }
  });
  run('tight-mark', () => {
    const dots = els.filter((x) => { const r = R(x), s = S(x); return r.width >= 4 && r.width <= 10 && Math.abs(r.width - r.height) < 1 && num(s.borderTopLeftRadius) >= r.width / 2 - 0.5 && alpha(s.backgroundColor) > 0.5 && !x.children.length; });
    for (const d of dots) {
      const dr = R(d), par = d.parentElement;
      if (!par) continue;
      for (const x of runs) {
        if (!par.contains(x.el) || Math.min(dr.bottom, x.r.bottom) - Math.max(dr.top, x.r.top) < 2) continue;
        const gap = x.r.left >= dr.right ? x.r.left - dr.right : dr.left >= x.r.right ? dr.left - x.r.right : -1;
        if (gap < 5) { add('tight-mark', d, `dot is ${gap < 0 ? 'on' : r1(gap) + 'px from'} the text "${x.text.slice(0, 20)}" (6px clear)`); break; }
      }
    }
  });

  /* ---- layout mechanics ---- */
  run('squeezed', () => {
    const cand = els.filter((x) => {
      const p = x.parentElement, r = R(x);
      return p && /flex/.test(S(p).display) && /^row/.test(S(p).flexDirection) && S(x).flexShrink !== '0' && r.width <= 64 && r.height <= 64 && (x.querySelector('svg') || x.matches('button,[role=button]'));
    }).slice(0, 120);
    for (const x of cand) {
      const old = x.style.flexShrink, w0 = x.getBoundingClientRect().width;
      try { x.style.flexShrink = '0'; const w1 = x.getBoundingClientRect().width; if (w1 - w0 >= 1.5) add('squeezed', x, `shrinks by ${r1(w1 - w0)}px in its row; give it flex: none`); }
      finally { x.style.flexShrink = old; }
    }
  });
  run('gap-collapse', () => {
    for (const c of els.filter((x) => /(flex|grid)/.test(S(x).display) && num(S(x).columnGap) > 0 && !/^column/.test(S(x).flexDirection))) {
      const cg = num(S(c).columnGap), kids = [...c.children].filter(vis).sort((a, b) => R(a).left - R(b).left);
      for (let i = 1; i < kids.length; i++) {
        const a = R(kids[i - 1]), b = R(kids[i]);
        if (Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) < 0.5 * Math.min(a.height, b.height)) continue;
        if (b.left - a.right < cg - 3) { add('gap-collapse', c, `gap of ${r1(b.left - a.right)}px where gap is ${cg}px: children are squeezed together`); break; }
      }
    }
  });
  run('double-corner', () => {
    for (const a of surfaces) {
      const ra = R(a), s = S(a), rad = num(s.borderTopLeftRadius);
      if (rad < 1) continue;
      for (const c of a.children) {
        if (!vis(c) || !(enclosed(c) || c.tagName === 'IMG')) continue;
        const rb = R(c), rr = num(S(c).borderTopLeftRadius);
        const flush = (Math.abs(rb.left - ra.left) <= 2 + num(s.borderLeftWidth) ? 1 : 0) + (Math.abs(rb.top - ra.top) <= 2 + num(s.borderTopWidth) ? 1 : 0);
        if (flush >= 2 && Math.abs(rad - rr) > 1 && (rr > 0 || /visible/.test(s.overflowX))) add('double-corner', c, `top-left corner is ${r1(rr)}px inside a parent corner of ${r1(rad)}px (overflow: ${s.overflowX})`);
      }
    }
  });
  run('overlay-room', () => {
    const q = '[role=dialog],[role=alertdialog],[role=menu],[role=listbox],[role=tooltip],[popover]:popover-open,[data-radix-popper-content-wrapper]>*';
    for (const o of els.filter((x) => x.matches(q))) {
      const r = R(o);
      const near = [['left', r.left, r.width < W - 1], ['right', W - r.right, r.width < W - 1], ['top', r.top, r.height < H - 1], ['bottom', H - r.bottom, r.height < H - 1]].find(([, d, ok]) => ok && d < 16);
      if (near) add('overlay-room', o, `${near[0]} edge is ${r1(near[1])}px from the viewport (a gutter of 16 or more)`, 'note');
    }
  });

  /* ---- result ---- */
  const rank = { fail: 0, candidate: 1, note: 2 };
  const perCheck = {};
  const findings = out.sort((a, b) => rank[a.severity] - rank[b.severity]).filter((f) => (perCheck[f.check] = (perCheck[f.check] || 0) + 1) <= 4).slice(0, 40);
  const iframes = document.querySelectorAll('iframe').length, shadows = everything.filter((e) => e.shadowRoot).length;
  return {
    tool: 'ui-audit v1 (candidates, not verdicts)',
    viewport: { w: W, h: H, dpr: devicePixelRatio, scheme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light', coarse: matchMedia('(pointer: coarse)').matches },
    scanned: { elements: els.length, textRuns: runs.length, surfaces: surfaces.length, icons: icons.length, iframesNotEntered: iframes, shadowRootsNotEntered: shadows, truncatedAt4000: truncated },
    inconclusive: els.length < 5 || runs.length === 0,
    counts,
    findings,
    notes,
  };
}
