#!/usr/bin/env node
// content-lint.mjs -- deterministic checks for the /content skill. Zero dependencies and read-only: it reads
// files and prints (and runs `git` with argument arrays for `tracked`). It counts the countable AI-writing
// tells, and compares a rewrite with its source for dropped or newly appearing facts. Everything it reports is
// a lead for judgement, not a verdict.
//
//   node content-lint.mjs check <file> [--dash-rate N | --voice <voice.md> [--register name]] [--allow-words a,b] [--by-paragraph]
//   node content-lint.mjs check --dir <folder> [--dash-rate N]           rank the files in a folder
//   node content-lint.mjs compare <before> <after> [--dash-rate N]      the same counts, side by side
//   node content-lint.mjs facts <source> <rewrite>                       facts dropped or new; protected content changed
//   node content-lint.mjs conform <file> <voice.md>                      does a text match the saved voice profile?
//   node content-lint.mjs words <file> [--max-words N] [--max-chars N]   word and character counts, with limits
//   node content-lint.mjs tracked <file>                                 is the file tracked by git, and clean?
//   node content-lint.mjs --self-test
//
// --dash-rate N: the writer's own em-dash rate per 100 words (from voice.md). Without it the default is zero.
// --voice <voice.md> [--register name] reads that rate from the profile itself (the register whose heading contains `name`;
// the only register when there is just one); an explicit --dash-rate wins. Allowed words are free text there, so --allow-words stays manual.
// Code fences, inline code and YAML frontmatter are ignored by `check`. Run with `node`, never as a binary.
// The verdict thresholds were set from the distribution on the maintainer's own documents (see the skill's
// references/audit.md); they have not been validated against a labelled set.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const THRESHOLDS = { light: 0.8, heavy: 2.0 }; // other-tell density per 100 words

// ---------- text preparation ----------

function prepare(text) {
  const lines = text.split(/\r?\n/);
  let i = 0;
  if (lines[0] === '---') { // frontmatter
    const end = lines.indexOf('---', 1);
    if (end > 0) for (; i <= end; i++) lines[i] = '';
  }
  let fence = false;
  for (let k = i; k < lines.length; k++) {
    if (/^\s*(```|~~~)/.test(lines[k])) { fence = !fence; lines[k] = ''; continue; }
    if (fence) lines[k] = '';
    else lines[k] = lines[k].replace(/`[^`\n]*`/g, (m) => ' '.repeat(m.length));
  }
  return lines;
}

const wordsOf = (s) => (s.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []);
const countWords = (lines) => lines.reduce((n, l) => n + wordsOf(l).length, 0);

function paragraphSpans(lines) {
  const spans = []; let s = null;
  lines.forEach((l, i) => { if (l.trim()) { if (s === null) s = i; } else if (s !== null) { spans.push([s, i - 1]); s = null; } });
  if (s !== null) spans.push([s, lines.length - 1]);
  return spans;
}

// ---------- the tells ----------

const VOCAB = ['delve', 'delves', 'delving', 'crucial', 'intricate', 'pivotal', 'tapestry', 'landscape', 'underscore', 'underscores', 'underscored', 'underscoring', 'foster', 'fosters', 'fostering', 'garner', 'garnered', 'testament', 'robust', 'seamless', 'seamlessly', 'vibrant', 'boasts', 'nestled', 'cutting-edge', 'game-changing', 'must-have', 'showcase', 'showcases', 'showcasing', 'realm', 'embark', 'unlock', 'elevate', 'holistic', 'multifaceted', 'meticulous', 'meticulously'];
const FILLER = ['in order to', 'due to the fact that', 'at this point in time', 'has the ability to', 'it is important to note', "it's important to note", "it's worth noting", 'it is worth noting', 'needless to say', "in today's", 'at its core', "let's dive", 'dive into', "here's what you need to know", 'the real question is', 'what really matters is', 'plays a crucial role', 'a wide range of', 'in the realm of', 'when it comes to'];
const CHATBOT = ['i hope this helps', 'let me know if', 'great question', 'certainly!', 'absolutely!', 'as an ai', 'happy to help', 'feel free to ask', "here's an overview", 'i would be happy to'];

function lineHits(lines, re) {
  const hits = [];
  lines.forEach((l, i) => {
    for (const m of l.matchAll(re)) {
      const ctx = m[0].length < 8 ? `…${l.slice(Math.max(0, m.index - 28), m.index + m[0].length + 28).trim()}…` : m[0];
      hits.push({ line: i + 1, text: ctx });
    }
  });
  return hits;
}
const phraseRe = (arr) => new RegExp(`(?<![\\p{L}])(${arr.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\p{L}])`, 'giu');
const isDashRow = (id) => id === 'em dash' || id.startsWith('en dash');

function check(text, { dashRate = 0, allowWords = [] } = {}) {
  const lines = prepare(text);
  const total = countWords(lines);
  const per100 = (n) => (total ? (n / total) * 100 : 0);
  const allow = new Set(allowWords.map((w) => w.toLowerCase()));
  const vocab = VOCAB.filter((w) => !allow.has(w));
  const rows = [];
  const add = (id, hits, hard = true) => rows.push({ id, hard, n: hits.length, hits });

  add('em dash', lineHits(lines, /—/g));
  add('en dash (not a number range)', lineHits(lines, /(?<!\d)–|–(?!\d)/g));
  add('overused vocabulary', lineHits(lines, phraseRe(vocab)), false);
  add('filler phrase', lineHits(lines, phraseRe(FILLER)));
  add('chatbot artifact', lineHits(lines, phraseRe(CHATBOT)));
  add('negative parallelism', lineHits(lines, /\bnot only\b[^.!?\n]{0,120}\bbut\b|\bit'?s not (just|merely|about)\b[^.!?\n]{0,80}[,;—-]\s*(it'?s|but)\b|\bnot a [^.,\n]{1,40}, (it'?s|but) a\b/gi));
  add('tacked-on -ing clause', lineHits(lines, /, (highlighting|underscoring|reflecting|showcasing|emphasi[sz]ing|demonstrating|ensuring|fostering|contributing to|paving the way)\b/gi));
  add('vague attribution', lineHits(lines, /\b(industry (experts|observers)|critics (argue|say)|many (believe|argue)|experts (say|agree)|studies (show|suggest)|observers note)\b/gi));
  add('stacked triad (A, B, and C)', lineHits(lines, /\b[\p{L}-]+, [\p{L}-]+,? and [\p{L}-]+\b/gu), false);
  add('emoji', lineHits(lines, /\p{Extended_Pictographic}/gu));
  add('curly quotes', lineHits(lines, /[‘’“”]/g), false);
  add('title-case heading', lines.map((l, i) => ({ l, i })).filter(({ l }) => /^#{1,6} /.test(l)).filter(({ l }) => { const w = l.replace(/^#+ /, '').split(/\s+/).filter((x) => x.length > 3); return w.length >= 3 && w.every((x) => /^[A-Z]/.test(x)); }).map(({ l, i }) => ({ line: i + 1, text: l.trim() })), false);
  add('inline-header bullet', lineHits(lines, /^\s*[-*] \*\*[^*\n]+:\*\*/g), false);
  const boldPairs = lineHits(lines, /\*\*[^*\n]+\*\*/g);
  add('bold phrases (per 100 words shown)', boldPairs.length > 0 && per100(boldPairs.length) > 2 ? boldPairs : [], false);

  // overused-vocabulary clusters: three or more distinct words in one paragraph
  const spans = paragraphSpans(lines);
  const clusters = [];
  for (const [a, b] of spans) {
    const w = new Set(wordsOf(lines.slice(a, b + 1).join(' ')).map((x) => x.toLowerCase()).filter((x) => vocab.includes(x)));
    if (w.size >= 3) clusters.push({ line: a + 1, text: [...w].join(', ') });
  }
  rows.push({ id: 'vocabulary cluster (3+ words in one paragraph)', hard: true, n: clusters.length, hits: clusters });

  // sentence-length spread (prose lines only)
  const sentences = lines.filter((l) => !/^\s*\||^#|^\s*[-*] /.test(l)).join(' ').split(/(?<=[.!?])\s+(?=[\p{Lu}"'(])/u).map((s) => wordsOf(s).length).filter(Boolean);
  const mean = sentences.reduce((a, b) => a + b, 0) / (sentences.length || 1);
  const sd = Math.sqrt(sentences.reduce((a, b) => a + (b - mean) ** 2, 0) / (sentences.length || 1));
  const even = sentences.length >= 8 && sd / mean < 0.35;

  // dashes are scored on their own: on many real documents they are most of the signal
  const dashes = rows.filter((r) => isDashRow(r.id)).reduce((s, r) => s + r.n, 0);
  const allowed = Math.ceil((dashRate / 100) * total);
  const dashExcess = Math.max(0, dashes - allowed);
  // variety over volume: one pattern repeated on purpose (53 emoji in a README) must not decide the verdict,
  // so each kind of tell counts at most 5 times
  const otherCount = rows.filter((r) => r.hard && !isDashRow(r.id)).reduce((s, r) => s + Math.min(r.n, 5), 0);
  const otherDensity = per100(otherCount);
  const verdict = otherDensity < THRESHOLDS.light ? 'clean' : otherDensity < THRESHOLDS.heavy ? 'light' : 'heavy';
  const dashDensity = per100(dashes);

  // per-paragraph ranking of the hard tells
  const paras = spans.map(([a, b]) => {
    const w = countWords(lines.slice(a, b + 1));
    const tells = new Map();
    for (const r of rows) {
      if (!r.hard || isDashRow(r.id)) continue;
      const n = r.hits.filter((h) => h.line - 1 >= a && h.line - 1 <= b).length;
      if (n) tells.set(r.id, n);
    }
    const count = [...tells.values()].reduce((s, n) => s + n, 0);
    return { line: a + 1, words: w, count, density: w ? (count / w) * 100 : 0, tells };
  }).filter((p) => p.count > 0 && p.words >= 15).sort((x, y) => y.density - x.density);

  return { total, rows, mean, sd, even, dashes, allowed, dashExcess, dashDensity, otherCount, otherDensity, verdict, sentences: sentences.length, dashRate, paras };
}

function renderCheck(r, { byParagraph = false } = {}) {
  const out = [`words: ${r.total}   sentences: ${r.sentences}   mean length: ${r.mean.toFixed(1)}   spread (sd): ${r.sd.toFixed(1)}${r.even ? '   EVEN: sentence lengths are suspiciously uniform' : ''}`];
  out.push(`dashes (em and en): ${r.dashes} = ${r.dashDensity.toFixed(2)} per 100 words; ${r.dashRate ? `the writer's own rate ${r.dashRate} allows ${r.allowed}` : 'the default allows none'} -> ${r.dashExcess ? `${r.dashExcess} OVER` : 'ok'}`);
  for (const row of r.rows) {
    if (!row.n || isDashRow(row.id)) continue;
    out.push(`${row.id}: ${row.n}`);
    row.hits.slice(0, 5).forEach((h) => out.push(`   line ${h.line}: ${String(h.text).replace(/\s+/g, ' ').slice(0, 90)}`));
    if (row.n > 5) out.push(`   +${row.n - 5} more`);
  }
  const dashRows = r.rows.filter((x) => isDashRow(x.id) && x.n);
  for (const row of dashRows) { out.push(`${row.id}: ${row.n}`); row.hits.slice(0, 3).forEach((h) => out.push(`   line ${h.line}: ${String(h.text).replace(/\s+/g, ' ').slice(0, 90)}`)); if (row.n > 3) out.push(`   +${row.n - 3} more`); }
  out.push(`other hard tells (everything except dashes, each kind counted at most 5 times): ${r.otherCount} = ${r.otherDensity.toFixed(2)} per 100 words -> ${r.verdict} (heuristic; clean under ${THRESHOLDS.light}, heavy from ${THRESHOLDS.heavy}; the judgement tells need reading)`);
  if (byParagraph) {
    out.push('paragraphs by density of hard tells (dashes excluded):');
    if (!r.paras.length) out.push('   none');
    r.paras.slice(0, 8).forEach((p) => out.push(`   line ${p.line}  ${p.words} words  ${p.count} tell(s)  ${p.density.toFixed(1)} per 100  [${[...p.tells].map(([k, n]) => `${k} x${n}`).join(', ')}]`));
  }
  return out.join('\n');
}

function checkDir(dir, opts, top = 40) {
  const files = [];
  const walk = (d) => { for (const n of fs.readdirSync(d)) { if (['node_modules', '.git', 'dist', 'build', '.next'].includes(n)) continue; const p = path.join(d, n); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(md|mdx|txt)$/i.test(n)) files.push(p); } };
  walk(dir);
  const rows = files.map((f) => { const r = check(fs.readFileSync(f, 'utf8'), opts); return { f: path.relative(dir, f).split(path.sep).join('/'), r }; }).filter((x) => x.r.total >= 80);
  if (!rows.length) return 'check --dir: no markdown or text files with at least 80 words found';
  rows.sort((a, b) => b.r.otherDensity - a.r.otherDensity);
  return [`${rows.length} file(s), worst first by other hard tells per 100 words (dashes shown separately):`, `${'other'.padStart(6)} ${'verdict'.padEnd(7)} ${'dashes/100'.padStart(10)} ${'words'.padStart(6)}  file`, ...rows.slice(0, top).map(({ f, r }) => `${r.otherDensity.toFixed(2).padStart(6)} ${r.verdict.padEnd(7)} ${r.dashDensity.toFixed(2).padStart(10)} ${String(r.total).padStart(6)}  ${f}`)].join('\n');
}

function compare(a, b, opts) {
  const x = check(a, opts); const y = check(b, opts);
  const out = [`${'metric'.padEnd(46)} ${'before'.padStart(8)} ${'after'.padStart(8)}`];
  const line = (name, p, q) => out.push(`${name.padEnd(46)} ${String(p).padStart(8)} ${String(q).padStart(8)}`);
  line('words', x.total, y.total);
  line('dashes (em and en)', x.dashes, y.dashes);
  line('other hard tells', x.otherCount, y.otherCount);
  line('other hard tells per 100 words', x.otherDensity.toFixed(2), y.otherDensity.toFixed(2));
  line('verdict', x.verdict, y.verdict);
  for (const row of x.rows) { const q = y.rows.find((r) => r.id === row.id); if (row.n || q.n) line(row.id, row.n, q.n); }
  return out.join('\n');
}

// ---------- facts ----------

const MONTHS = 'january|february|march|april|may|june|july|august|september|october|november|december';
const MONTH_NUM = Object.fromEntries(MONTHS.split('|').map((m, i) => [m, i + 1]));
const MON = `(${MONTHS})`;
const pad = (n) => String(n).padStart(2, '0');

function normNumbers(s) {
  return s
    .replace(/(\d)\s*(?:per ?cent|percent)\b/gi, '$1%')
    .replace(/\b(\d+(?:\.\d+)?)\s*(?:k|thousand)\b/gi, (m, n) => String(Number(n) * 1000))
    .replace(/\b(\d+(?:\.\d+)?)\s*million\b/gi, (m, n) => String(Number(n) * 1000000));
}

function tokens(text) {
  const body = text.replace(/\r\n/g, '\n');
  const noCode = body.replace(/^\s*(```|~~~)[\s\S]*?^\s*(```|~~~)/gm, '').replace(/^---\n[\s\S]*?\n---\n/, '');
  const out = { number: new Map(), url: new Map(), name: new Map(), quote: new Map(), date: new Map(), code: new Map() };
  const put = (kind, v) => { const k = String(v).toLowerCase().trim(); if (k) out[kind].set(k, String(v).trim()); };
  for (const m of noCode.matchAll(/https?:\/\/[^\s)>\]"']+/g)) put('url', m[0].replace(/[.,;:!?]+$/, ''));
  let rest = noCode.replace(/https?:\/\/[^\s)>\]"']+/g, ' ');
  // dates, in any common order, become one canonical token
  rest = rest.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (m, y, mo, d) => { put('date', `${y}-${mo}-${d}`); return ' '; });
  rest = rest.replace(new RegExp(`\\b${MON}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, 'gi'), (m, mo, d, y) => { put('date', `${y || ''}-${pad(MONTH_NUM[mo.toLowerCase()])}-${pad(d)}`); return ' '; });
  rest = rest.replace(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MON}(?:,?\\s+(\\d{4}))?\\b`, 'gi'), (m, d, mo, y) => { put('date', `${y || ''}-${pad(MONTH_NUM[mo.toLowerCase()])}-${pad(d)}`); return ' '; });
  rest = rest.replace(new RegExp(`\\b${MON}\\s+(\\d{4})\\b`, 'gi'), (m, mo, y) => { put('date', `${y}-${pad(MONTH_NUM[mo.toLowerCase()])}`); return ' '; });
  rest = normNumbers(rest);
  for (const m of rest.matchAll(/\bv?\d+(?:[.,]\d+)*%?/g)) put('number', m[0].replace(/,/g, ''));
  for (const m of rest.matchAll(/["“]([^"”\n]{3,200})["”]/g)) put('quote', m[1].replace(/[‘’]/g, "'"));
  for (const m of rest.matchAll(/`([^`\n]+)`/g)) put('code', m[1]);
  for (const m of rest.matchAll(/(?<![.!?]\s)(?<!^)(?<!\n)\b([A-Z][a-z]+(?: [A-Z][a-z]+)+|[A-Z]{2,}[A-Za-z]*|[A-Z][a-z]+[A-Z][A-Za-z]*)\b/gm)) put('name', m[1]);
  return out;
}

function protectedBits(text) {
  const t = text.replace(/\r\n/g, '\n');
  const fences = [...t.matchAll(/^\s*(```|~~~)[^\n]*\n[\s\S]*?^\s*(```|~~~)/gm)].map((m) => m[0].trim());
  const links = [...t.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]);
  const fm = /^---\n[\s\S]*?\n---/.exec(t);
  return { fences, links, frontmatter: fm ? fm[0] : '' };
}

function facts(source, rewrite) {
  const a = tokens(source); const b = tokens(rewrite);
  const out = []; let flags = 0;
  for (const kind of ['number', 'date', 'url', 'quote', 'code', 'name']) {
    const dropped = [...a[kind].keys()].filter((k) => !b[kind].has(k)).map((k) => a[kind].get(k));
    const added = [...b[kind].keys()].filter((k) => !a[kind].has(k)).map((k) => b[kind].get(k));
    flags += dropped.length + added.length;
    if (dropped.length) out.push(`DROPPED ${kind}s (in the source, missing from the rewrite): ${dropped.join(' | ')}`);
    if (added.length) out.push(`NEW ${kind}s (in the rewrite, not in the source; fine only if you supplied them): ${added.join(' | ')}`);
  }
  const pa = protectedBits(source); const pb = protectedBits(rewrite);
  const changed = [];
  if (pa.fences.length !== pb.fences.length || pa.fences.some((f, i) => f !== pb.fences[i])) changed.push('code fences');
  if (pa.links.length !== pb.links.length || pa.links.some((l, i) => l !== pb.links[i])) changed.push('link targets');
  if (pa.frontmatter !== pb.frontmatter) changed.push('frontmatter');
  if (changed.length) { out.push(`PROTECTED content changed: ${changed.join(', ')}. Code, links and frontmatter must come through untouched.`); flags += changed.length; }
  if (!flags) out.push('facts: nothing dropped, nothing new, protected content unchanged (a heuristic: claims in words are not checked)');
  return out.join('\n');
}

// ---------- conform, words, tracked ----------

function parseVoice(text) {
  const num = (k) => { const m = new RegExp(`${k}\\s*:\\s*([0-9.]+)`).exec(text); return m ? Number(m[1]) : null; };
  return { dash: num('em_dash_per_100_words'), mean: num('mean_sentence_words'), sd: num('sentence_spread_words') };
}

// The em-dash rate of one register of a voice profile: the named one, or the only one. Throws when it cannot tell which.
function voiceDashRate(voiceText, register) {
  const secs = voiceText.split(/^## Register:/m).slice(1);
  const title = (s) => s.split('\n')[0];
  const sec = register ? secs.find((s) => title(s).toLowerCase().includes(register.toLowerCase())) : (secs.length === 1 ? secs[0] : null);
  if (!sec) throw new Error(`--voice needs --register <name>${register ? ` (none contains "${register}")` : ''}; registers in the profile: ${secs.map((s) => title(s).trim()).join(', ') || 'none'}`);
  return parseVoice(sec).dash ?? 0;
}

function conform(textFile, voiceText) {
  const v = parseVoice(voiceText);
  const r = check(textFile, { dashRate: v.dash ?? 0 });
  const rows = []; let fails = 0;
  const judge = (name, got, want, tol, unit) => {
    if (want === null) { rows.push(`${name}: not in the profile; skipped`); return; }
    const ok = Math.abs(got - want) <= tol;
    if (!ok) fails++;
    rows.push(`${name}: ${got.toFixed(2)}${unit} against profile ${want}${unit} (tolerance ${tol.toFixed(2)}) -> ${ok ? 'ok' : 'OFF'}`);
  };
  judge('dashes per 100 words', r.dashDensity, v.dash, Math.max(0.4, (v.dash ?? 0) * 0.5), '');
  judge('mean sentence length (words)', r.mean, v.mean, (v.mean ?? 0) * 0.25, '');
  judge('sentence-length spread (words)', r.sd, v.sd, (v.sd ?? 0) * 0.4, '');
  rows.push(fails ? `${fails} metric(s) off the profile: revise the text toward it` : 'conforms to the profile on the metrics it records (it cannot judge word choice or tone)');
  return rows.join('\n');
}

function words(text, { maxWords, maxChars } = {}) {
  const lines = prepare(text);
  const w = countWords(lines);
  const c = lines.join('\n').trim().length;
  const out = [`words: ${w}   characters: ${c} (prose only: code, inline code and frontmatter excluded)`];
  if (maxWords) out.push(`limit ${maxWords} words -> ${w <= maxWords ? 'ok' : `${w - maxWords} OVER`}`);
  if (maxChars) out.push(`limit ${maxChars} characters -> ${c <= maxChars ? 'ok' : `${c - maxChars} OVER`}`);
  return out.join('\n');
}

function tracked(file) {
  const full = path.resolve(file);
  const cwd = path.dirname(full);
  const g = (args) => { try { return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch { return null; } };
  if (!fs.existsSync(full)) throw new Error(`no such file: ${file}`);
  if (g(['rev-parse', '--is-inside-work-tree']) === null) return 'not in a git repository: there is no diff to undo with, so ask before editing';
  if (g(['ls-files', '--error-unmatch', '--', full]) === null) return 'untracked: git cannot undo an edit, so ask before editing';
  const st = (g(['status', '--porcelain', '--', full]) || '').trim();
  return st ? 'tracked, with uncommitted changes: a diff will mix your earlier edits with this one, so tell the user before editing' : 'tracked and clean: a diff is a clean undo';
}

// ---------- self-test ----------

function selfTest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'content-lint-'));
  const write = (rel, text) => { const p = path.join(tmp, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); return p; };
  try {
    const dirty = 'In today\'s landscape, the tool serves as a testament — a robust, seamless, intricate system. It is not only fast but also reliable. We shipped it in March 2026, ensuring 42% faster builds.\n\n## Quarterly Revenue And Growth Trends\n\n- **Speed:** fast\n🚀 Great question! I hope this helps.\n\n```js\nconst a = 1; // — not counted\n```\n';
    const r = check(dirty);
    const n = (id) => r.rows.find((x) => x.id === id).n;
    assert.equal(n('em dash'), 1, 'one em dash outside code');
    assert.ok(n('filler phrase') >= 1, "in today's");
    assert.equal(n('chatbot artifact'), 2);
    assert.equal(n('negative parallelism'), 1);
    assert.equal(n('emoji'), 1);
    assert.equal(n('title-case heading'), 1);
    assert.equal(n('inline-header bullet'), 1);
    assert.equal(n('tacked-on -ing clause'), 1);
    assert.ok(n('vocabulary cluster (3+ words in one paragraph)') >= 1);
    assert.equal(r.verdict, 'heavy');
    assert.equal(check('A plain sentence. Another plain one here.').verdict, 'clean');
    assert.equal(check('One — two.', { dashRate: 20 }).dashExcess, 0, "the writer's own dash rate is honoured");

    // the verdict no longer hangs on dashes alone
    const dashy = Array.from({ length: 12 }, () => 'This sentence is plain — and it has a dash in it for no reason at all.').join(' ');
    const d = check(dashy);
    assert.equal(d.verdict, 'clean', 'many dashes, no other tells: clean on the other tells');
    assert.ok(d.dashExcess > 0, 'but the dashes are still reported as over');
    assert.match(renderCheck(d), /OVER/);

    // allowed words
    assert.ok(check('This robust design is robust and seamless.').rows.find((x) => x.id === 'overused vocabulary').n >= 2);
    assert.equal(check('This robust design is robust.', { allowWords: ['robust'] }).rows.find((x) => x.id === 'overused vocabulary').n, 0);

    // per-paragraph ranking: the dirty paragraph is first
    const two = 'Plain prose here about a plain thing that happened on a plain day in the plain town of nowhere.\n\nIn today\'s landscape, a robust and seamless testament, ensuring pivotal results for the realm of crucial work.\n';
    const p = check(two).paras;
    assert.equal(p[0].line, 3, 'the second paragraph starts on line 3 and ranks first');
    assert.match(renderCheck(check(two), { byParagraph: true }), /paragraphs by density/);

    // batch
    write('docs/a.md', two.repeat(4)); write('docs/b.md', 'Plain words only. '.repeat(40));
    const batch = checkDir(path.join(tmp, 'docs'), {});
    assert.ok(batch.indexOf('a.md') < batch.indexOf('b.md'), 'the dirtier file is listed first');

    // compare
    assert.match(compare(dirty, 'A short plain sentence about the tool.'), /other hard tells\s+\d+\s+0/);

    // facts: dropped, new, normalisation, protected content
    const src = 'The release is v1.2.3, shipped on March 5, 2026 by Thomas van der Wolde. See https://example.com/docs. It cut build time by 42%.\n\n```bash\nnpm run build\n```\n';
    assert.match(facts(src, src), /nothing dropped/);
    const bad = 'The release shipped soon after by someone. It cut build time by 99%.\n\n```bash\nnpm run buildd\n```\n';
    const f = facts(src, bad);
    assert.match(f, /DROPPED numbers[^\n]*1\.2\.3/); assert.match(f, /DROPPED urls[^\n]*example\.com/); assert.match(f, /NEW numbers[^\n]*99%/);
    assert.match(f, /DROPPED dates/); assert.match(f, /PROTECTED content changed: code fences/);
    const okRewrite = 'Version v1.2.3 shipped on 5 March 2026, by Thomas van der Wolde (docs: https://example.com/docs). Build time fell 42 percent.\n\n```bash\nnpm run build\n```\n';
    assert.match(facts(src, okRewrite), /nothing dropped/, 'a reordered date and "42 percent" are not dropped facts');
    assert.match(facts('We had 10k users and 2 million views.', 'We had 10000 users and 2000000 views.'), /nothing dropped/);

    // conform
    const voice = '# Voice profile\n- em_dash_per_100_words: 0\n- mean_sentence_words: 12\n- sentence_spread_words: 5\n';
    assert.match(conform('Short one. A bit longer sentence follows here. Then a very short one. Another medium sentence appears now. Tiny. This one runs a little longer than the others do.', voice), /mean sentence length[^\n]*(ok|OFF)/);
    assert.match(conform('One — two — three — four.', voice), /dashes per 100 words[^\n]*OFF/);

    // words and limits
    assert.match(words('one two three four five', { maxWords: 3 }), /2 OVER/);
    assert.match(words('hello world', { maxChars: 5 }), /6 OVER/);
    assert.match(words('text\n\n```\ncode words here\n```\n'), /words: 1 /);

    // tracked
    const run = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: tmp, stdio: 'pipe' });
    const tf = write('t.md', 'x\n');
    assert.match(tracked(tf), /untracked|not in a git/);
    run('init', '-q', '-b', 'main'); run('add', '-A'); run('commit', '-q', '-m', 'one');
    assert.match(tracked(tf), /tracked and clean/);
    fs.writeFileSync(tf, 'y\n');
    assert.match(tracked(tf), /uncommitted changes/);
    assert.match(tracked(write('u.md', 'z\n')), /untracked/);

    assert.equal(wordsOf('one two  three').length, 3);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  // --voice: the dash rate comes from the named register, or from the only one; ambiguity is an error, not a guess
  const prof = ['# Voice profile', '', '## Register: docs', '- em_dash_per_100_words: 0.3', '- mean_sentence_words: 14', '', '## Register: casual', '- em_dash_per_100_words: 1.2', ''].join('\n');
  assert.equal(voiceDashRate(prof, 'casual'), 1.2); assert.equal(voiceDashRate(prof, 'DOCS'), 0.3);
  assert.throws(() => voiceDashRate(prof), /needs --register.*docs, casual/); assert.throws(() => voiceDashRate(prof, 'email'), /none contains "email"/);
  assert.equal(voiceDashRate(['## Register: only', '- em_dash_per_100_words: 0.5', ''].join('\n')), 0.5);
  return 'self-test: all checks passed';
}

// ---------- main ----------

function main(argv) {
  const [cmd, ...rest] = argv;
  const read = (f) => { if (!f) throw new Error('a file path is required'); return fs.readFileSync(f, 'utf8'); };
  const val = (flag) => { const i = rest.indexOf(flag); return i >= 0 ? rest[i + 1] : undefined; };
  const files = () => rest.filter((a, i) => !a.startsWith('--') && !['--dash-rate', '--allow-words', '--dir', '--max-words', '--max-chars', '--top', '--voice', '--register'].includes(rest[i - 1]));
  const opts = () => ({ dashRate: val('--dash-rate') ? Number(val('--dash-rate')) : (val('--voice') ? voiceDashRate(read(val('--voice')), val('--register')) : 0), allowWords: val('--allow-words') ? val('--allow-words').split(',') : [] });
  switch (cmd) {
    case 'check':
      if (val('--dir')) return checkDir(val('--dir'), opts(), val('--top') ? Number(val('--top')) : 40);
      return renderCheck(check(read(files()[0]), opts()), { byParagraph: rest.includes('--by-paragraph') });
    case 'compare': return compare(read(files()[0]), read(files()[1]), opts());
    case 'facts': return facts(read(files()[0]), read(files()[1]));
    case 'conform': return conform(read(files()[0]), read(files()[1]));
    case 'words': return words(read(files()[0]), { maxWords: val('--max-words') && Number(val('--max-words')), maxChars: val('--max-chars') && Number(val('--max-chars')) });
    case 'tracked': return tracked(files()[0]);
    case '--self-test': return selfTest();
    default: return 'usage: check <file> [--dash-rate N] [--allow-words a,b] [--by-paragraph] | check --dir <folder> | compare <before> <after> | facts <source> <rewrite> | conform <file> <voice.md> | words <file> [--max-words N] [--max-chars N] | tracked <file> | --self-test';
  }
}

try {
  console.log(main(process.argv.slice(2)));
} catch (e) {
  console.error(`content-lint: ${e.message}`);
  process.exit(1);
}
