/* motion-probe.js -- motion QA for the /design skill (web only). Read-only.

   Two calls through chrome-devtools evaluate_script, with waitForStableDom: false on both:
     1. evaluate_script { sourcePath: "<this file>" }      installs the sampler and returns the animations
                                                           running right now.
     2. trigger ONE interaction (click, press_key, or a function in evaluate_script), wait about a second, then
        evaluate_script { function: "() => window.__motionProbe.report()" }
   The sampler stops itself after 10 s. `window.__motionProbe.stop()` stops it early.

   What it reports (all CANDIDATES to look at, never verdicts):
     animations   every animation seen while sampling: infinite loops, layout properties animated (width, height,
                  top, left, margin, padding, font-size ...: not compositor-only), linear easing, long durations
     jumps        an element moved or resized, relative to its parent, by more than 2 px in one frame and by more
                  than 3x the frames either side (a step in the layout, not a movement)
     appears / vanishes   a box of 24 px or more going from absent or transparent to fully visible (or back) in a
                  single frame with no animation on it: it popped instead of entering or leaving
     anchorDrift  a menu, listbox, dialog, tooltip or popover whose top AND bottom edges both moved while its
                  height changed (a popover keeps the edge it opened from still)
     layoutShifts the browser's own layout-shift entries with the nodes that moved
   Limits: it only sees the interaction you trigger, in this browser, at this frame rate (frames later than 1.6x
   the median are not judged); it cannot say whether a movement is the right movement. Run it once more with
   emulate cpuThrottlingRate: 4. A clean report is not approval: watch the motion once as well.

   Technique after stageshow's jumps-core.mjs / motion-watch.mjs (MIT, (c) 2026 Benji Taylor,
   https://github.com/benjitaylor/skills), re-implemented. Self-check: tools/fixtures/motion-bad.html.
*/
() => {
  if (window.__motionProbe) window.__motionProbe.stop();
  const MAX_MS = 10000, CAP = 600;
  const num = (v) => parseFloat(v) || 0;
  const r1 = (n) => Math.round(n * 10) / 10;
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
  const SKIP = /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|BR|WBR|SOURCE|TRACK|META|LINK|HEAD|TITLE)$/;
  const LAYOUT = /^(width|height|top|left|right|bottom|inset|margin|padding|fontSize|lineHeight|letterSpacing|gap|flex|minWidth|maxWidth|minHeight|maxHeight|borderWidth|border(Top|Right|Bottom|Left)Width)/;
  const COMPOSITOR = /^(transform|opacity|translate|rotate|scale|offset)/;

  const T = [];
  const tracked = new Map();
  const seenAnims = new WeakSet();
  const anims = [];
  const shifts = [];
  let t0 = 0, stopped = false, raf = 0;

  const addEl = (e, from) => {
    if (tracked.size >= CAP || tracked.has(e) || e.nodeType !== 1 || SKIP.test(e.tagName) || e.ownerSVGElement) return;
    tracked.set(e, { from, r: [], o: [], anim: [] });
  };
  for (const e of document.body.querySelectorAll('*')) addEl(e, 0);

  const describe = (a, at) => {
    const ef = a.effect;
    if (!ef || anims.length >= 120) return;
    let props = [], kfEasing = 'linear';
    try {
      const kf = ef.getKeyframes();
      props = [...new Set(kf.flatMap((k) => Object.keys(k)))].filter((k) => !/^(offset|easing|composite|computedOffset)$/.test(k));
      kfEasing = (kf[0] && kf[0].easing) || 'linear'; /* a CSS animation's timing function lives on its keyframes */
    } catch (_) { /* script animation */ }
    const tm = ef.getComputedTiming(), tg = ef.getTiming();
    const type = typeof CSSTransition !== 'undefined' && a instanceof CSSTransition ? 'transition' : typeof CSSAnimation !== 'undefined' && a instanceof CSSAnimation ? 'animation' : 'script';
    anims.push({
      target: ef.target ? sel(ef.target) : '(none)',
      type,
      name: a.animationName || a.transitionProperty || '',
      props,
      layoutProps: props.filter((p) => LAYOUT.test(p) && !COMPOSITOR.test(p)),
      durationMs: typeof tm.duration === 'number' ? Math.round(tm.duration) : String(tm.duration),
      iterations: tm.iterations === Infinity ? 'infinite' : tm.iterations,
      easing: tg.easing !== 'linear' ? tg.easing : kfEasing,
      atMs: at === null ? 0 : Math.round(T[at] - T[0]),
    });
  };
  for (const a of document.getAnimations()) { seenAnims.add(a); describe(a, null); }
  const snapshot = anims.slice();

  const tick = (now) => {
    if (stopped) return;
    if (!t0) t0 = now;
    if (now - t0 > MAX_MS) { stop(); return; }
    T.push(now);
    const fi = T.length - 1;
    for (const [e, rec] of tracked) {
      if (!e.isConnected) { rec.r[fi] = null; rec.o[fi] = 0; continue; }
      const r = e.getBoundingClientRect();
      rec.r[fi] = r.width > 0 && r.height > 0 ? [r.left, r.top, r.width, r.height] : null;
      rec.o[fi] = rec.r[fi] ? num(getComputedStyle(e).opacity) : 0;
      rec.anim[fi] = rec.r[fi] && fi > 0 && rec.o[fi - 1] !== rec.o[fi] ? e.getAnimations().length : 0;
    }
    for (const a of document.getAnimations()) if (!seenAnims.has(a)) { seenAnims.add(a); describe(a, fi); }
    raf = requestAnimationFrame(tick);
  };

  const mo = new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) { addEl(n, T.length); n.querySelectorAll?.('*').forEach((c) => addEl(c, T.length)); }
  });
  mo.observe(document.body, { childList: true, subtree: true });
  let po = null;
  try {
    po = new PerformanceObserver((list) => {
      for (const en of list.getEntries()) {
        if (en.hadRecentInput || en.value < 0.001 || shifts.length >= 20) continue;
        shifts.push({ value: Math.round(en.value * 1000) / 1000, atMs: Math.round(en.startTime - (t0 || en.startTime)), nodes: (en.sources || []).slice(0, 3).map((s) => (s.node ? sel(s.node) : '(removed)') + ' ' + r1(s.previousRect.y) + '->' + r1(s.currentRect.y) + 'px') });
      }
    });
    po.observe({ type: 'layout-shift', buffered: false });
  } catch (_) { /* not supported */ }
  raf = requestAnimationFrame(tick);

  function stop() { stopped = true; cancelAnimationFrame(raf); mo.disconnect(); po?.disconnect(); }

  function report() {
    const f = T.length;
    const iv = T.slice(1).map((t, i) => t - T[i]).sort((a, b) => a - b);
    const med = iv.length ? iv[Math.floor(iv.length / 2)] : 0;
    const late = (i) => i > 0 && T[i] - T[i - 1] > 1.6 * med;

    /* the step of frame j-1 -> j, relative to the parent's own movement: a container that moves smoothly (or at all)
       does not make its children jump, only an element that moves or resizes inside its parent does */
    const step = (e, rec, j) => {
      const a = rec.r[j - 1], b = rec.r[j];
      if (!a || !b) return 0;
      const pr = e.parentElement && tracked.get(e.parentElement), pa = pr && pr.r[j - 1], pb = pr && pr.r[j];
      const px = pa && pb ? pb[0] - pa[0] : 0, py = pa && pb ? pb[1] - pa[1] : 0;
      return Math.max(Math.abs(b[0] - a[0] - px), Math.abs(b[1] - a[1] - py), Math.abs(b[2] - a[2]), Math.abs(b[3] - a[3]));
    };
    const jumps = [];
    for (const [e, rec] of tracked) {
      for (let i = Math.max(2, rec.from + 2); i < f - 1; i++) {
        if (!rec.r[i - 1] || !rec.r[i] || late(i) || late(i + 1)) continue;
        const s = step(e, rec, i);
        if (s > 2 && s > 3 * Math.max(step(e, rec, i - 1), step(e, rec, i + 1))) { jumps.push({ e, i, s }); break; }
      }
    }
    const jumpList = jumps.sort((x, y) => y.s - x.s).slice(0, 15)
      .map((j) => ({ selector: sel(j.e), atMs: Math.round(T[j.i] - T[0]), stepPx: r1(j.s) }));

    const appears = [], vanishes = [];
    const seenAt = new Map();
    for (const [e, rec] of tracked) {
      for (let i = Math.max(1, rec.from); i < f; i++) {
        const prev = rec.r[i - 1] ? rec.o[i - 1] : 0, cur = rec.r[i] ? rec.o[i] : 0, box = rec.r[i] || rec.r[i - 1];
        if (!box || box[2] < 24 || box[3] < 24 || late(i)) continue;
        if (prev <= 0.05 && cur >= 0.95 && !rec.anim[i]) { appears.push({ e, i }); break; }
        if (prev >= 0.95 && cur <= 0.05 && !rec.anim[i] && !rec.anim[i - 1]) { vanishes.push({ e, i }); break; }
      }
    }
    const topmost = (list) => {
      const groups = new Map();
      for (const x of list.filter((q) => !list.some((y) => y !== q && Math.abs(y.i - q.i) <= 1 && y.e !== q.e && y.e.contains(q.e)))) {
        const k = sel(x.e) + '@' + x.i, g = groups.get(k);
        if (g) g.count++; else groups.set(k, { selector: sel(x.e), atMs: Math.round(T[x.i] - T[0]), count: 1 });
      }
      return [...groups.values()].slice(0, 10);
    };

    const drift = [];
    for (const [e, rec] of tracked) {
      if (!e.matches?.('[role=menu],[role=listbox],[role=dialog],[role=tooltip],[popover],[data-radix-popper-content-wrapper] > *')) continue;
      for (let i = 1; i < f; i++) {
        const a = rec.r[i - 1], b = rec.r[i];
        if (!a || !b || late(i)) continue;
        const dh = Math.abs(b[3] - a[3]), dt = Math.abs(b[1] - a[1]), db = Math.abs((b[1] + b[3]) - (a[1] + a[3]));
        if (dh >= 2 && dt >= 1 && db >= 1) { drift.push({ selector: sel(e), atMs: Math.round(T[i] - T[0]), heightChangePx: r1(dh), topMovedPx: r1(dt), bottomMovedPx: r1(db) }); break; }
      }
    }

    const all = anims;
    const flagged = {
      infinite: all.filter((a) => a.iterations === 'infinite').map((a) => `${a.target} ${a.name || a.props.join(',')} (${a.durationMs}ms)`),
      layoutProperties: all.filter((a) => a.layoutProps.length).map((a) => `${a.target} animates ${a.layoutProps.join(',')} (${a.durationMs}ms)`),
      linearEasing: all.filter((a) => a.easing === 'linear' && a.iterations !== 'infinite' && a.props.length && !a.props.every((p) => /^(opacity)$/.test(p))).map((a) => `${a.target} ${a.name || a.props.join(',')}`),
      longTransitions: all.filter((a) => a.type === 'transition' && typeof a.durationMs === 'number' && a.durationMs > 500).map((a) => `${a.target} ${a.name} (${a.durationMs}ms)`),
    };
    return {
      tool: 'motion-probe v1 (candidates, not verdicts)',
      sampled: { frames: f, durationMs: f ? Math.round(T[f - 1] - T[0]) : 0, medianFrameMs: r1(med), tracked: tracked.size, running: !stopped },
      inconclusive: f < 10 || (f > 2 && med > 50),
      animations: { runningAtStart: snapshot.length, seenInTotal: all.length, flagged, list: all.slice(0, 40) },
      jumps: jumpList,
      appearsWithNoEntrance: topmost(appears),
      vanishesWithNoExit: topmost(vanishes),
      anchorDrift: drift.slice(0, 5),
      layoutShifts: shifts,
    };
  }

  window.__motionProbe = { report, stop };
  return { installed: true, maxMs: MAX_MS, next: 'trigger one interaction, wait ~1 s, then call () => window.__motionProbe.report()', animationsRunningNow: snapshot.length, flaggedNow: { infinite: snapshot.filter((a) => a.iterations === 'infinite').length, layoutProperties: snapshot.filter((a) => a.layoutProps.length).length } };
}
