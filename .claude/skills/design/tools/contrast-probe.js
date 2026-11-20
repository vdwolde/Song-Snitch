/* contrast-probe.js -- collects the text colour pairs a page really renders, for the /design skill (web only).

   Run it through chrome-devtools: evaluate_script { sourcePath: "<this file>" } (format "function").
   It returns up to 60 distinct { fg, bg, size, weight, sample } entries, one per colour + size + weight combination.
   Then pass the pairs to `node design-tools.mjs contrast <fg> <bg> ...`. Large text is 24px+, or 18.66px+ at weight
   700+ (needs 3:1); everything else needs 4.5:1. A pair whose `bg` is `image` cannot be computed: judge it by eye.
   Alpha is ignored, so composite a translucent colour first. Run it again with emulate colorScheme dark.
   It only reads the page.
*/
() => {
  const seen = new Map();
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e);
    if (c.backgroundImage !== 'none') return 'image';
    const m = c.backgroundColor.match(/[\d.]+/g); if (m && (m.length < 4 || +m[3] === 1)) return c.backgroundColor; }
    return 'rgb(255, 255, 255)'; };
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode()); ) {
    if (!n.nodeValue.trim()) continue;
    const el = n.parentElement, cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const bg = bgOf(el), key = [cs.color, bg, cs.fontSize, cs.fontWeight].join('|');
    if (!seen.has(key)) seen.set(key, { fg: cs.color, bg, size: cs.fontSize, weight: cs.fontWeight, sample: n.nodeValue.trim().slice(0, 30) });
  }
  return [...seen.values()].slice(0, 60);
}
