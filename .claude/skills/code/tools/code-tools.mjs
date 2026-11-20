#!/usr/bin/env node
// code-tools.mjs -- deterministic helpers for the /code skill. Zero dependencies: it runs `git` with argument
// arrays to read history, reads files, and prints. It never runs a project's own commands. The only command
// that touches the network is `probe`: passive GET/OPTIONS requests to this machine, or to a URL the user said
// they own (--owned). The only thing it writes is the `run` ledger, and only inside its own state directory
// (%LOCALAPPDATA%\claude-code-review, or $CODE_REVIEW_STATE), never in a repository.
//
// Scopes (what to look at). Two flags and an optional path:
//   --changes [ref]   everything that changed and is not on the remote yet: unpushed commits, staged,
//                     unstaged and new files. With a ref: everything different from that ref, plus anything
//                     uncommitted. Changed lines only (hunks).
//   --all             the whole codebase
//   <path ...>        a folder, file or glob after either flag narrows it (no flag means --all inside it)
// Aliases that keep old habits working: --commit = --changes; --session = --changes (the caller intersects
// with its own file list); --ref <r> = --changes <r>.
//
//   node code-tools.mjs scope     <scope>                 files in scope, line counts and changed ranges
//   node code-tools.mjs shards    <scope> [--budget N] [--files]   even shards, riskiest first
//   node code-tools.mjs prefilter <scope | files...> [--mode security|quality|performance|all]
//   node code-tools.mjs gates                              the project's own checks (not run)
//   node code-tools.mjs deps                               dependency hygiene and supply-chain signals
//   node code-tools.mjs lang <name> [--lens security|performance|quality|all]
//   node code-tools.mjs stack                              which language checklists apply
//   node code-tools.mjs hotspots [--n 20]                  most-changed, largest, most-fixed files
//   node code-tools.mjs entrypoints [<scope>]              routes, CLI args, readers: the attack surface
//   node code-tools.mjs domains [<scope>]                  which security-domain files may apply, with evidence
//   node code-tools.mjs cite-check [--root <dir>] < text   do the path:line citations in stdin exist?
//   node code-tools.mjs dependents <file...>               direct importers of those files
//   node code-tools.mjs names [<scope>]                    renamed or deleted names still cited elsewhere
//   node code-tools.mjs doclinks [<path>...]               broken relative links, anchors and run targets
//   node code-tools.mjs tests-map [<scope>]                changed source files and their test files
//   node code-tools.mjs coverage [<scope>]                 coverage of the changed lines, from an existing report
//   node code-tools.mjs history [--n 300]                  secrets in recent git history (no values printed)
//   node code-tools.mjs probe <url> [--owned]              passive live check of a running server (headers, TLS, CORS...)
//   node code-tools.mjs run init --modes <m> <scope> [--bundle|--independent|--fresh|--budget N]
//                                                          plan a resumable run (units, briefs, reuse of finished work)
//   node code-tools.mjs run prep                           run the mode's helpers once, write the shared context (artifact `prep`)
//   node code-tools.mjs run next [--fill 6 | --n 4] [--returned <unit>] [--shards K] [--kind K]
//                                                          hand out pending units, marked running; --fill keeps K in flight (rolling)
//   node code-tools.mjs run hook                           SubagentStop hook of the reviewer agents: stores the reply in the run's inbox
//   node code-tools.mjs run done <unit> | fail <unit> --reason T [--limit]   record a result (stdin) or a failure by hand (the fallback)
//   node code-tools.mjs run merge | edit <F-id> ... | verify-plan | verdicts | report   findings: dedupe, adjust, verify, render
//   node code-tools.mjs run status | results | add <unit> | save <name> [--append] | load <name> | list
//   node code-tools.mjs --self-test
//
// Add `--root <dir>` to run against another project (default: the current directory).
// Run with `node` (an already-trusted host process on this machine), never as a compiled binary.
// Results are leads and candidates to read, not verdicts.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

// ---------- helpers ----------

function git(root, args, { allowFail = false } = {}) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 128 * 1024 * 1024 });
  } catch (e) {
    if (allowFail) return null;
    throw new Error(`git ${args.join(' ')} failed: ${String(e.stderr || e.message).trim().split('\n')[0]}`);
  }
}
const lines = (s) => (s || '').split(/\r?\n/).filter(Boolean);
const isRepo = (root) => git(root, ['rev-parse', '--is-inside-work-tree'], { allowFail: true }) !== null;
const SKIP_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg', '.bmp', '.woff', '.woff2', '.ttf', '.otf', '.eot', '.pdf', '.zip', '.gz', '.7z', '.exe', '.dll', '.pdb', '.so', '.dylib', '.class', '.jar', '.mp3', '.mp4', '.mov', '.webm', '.lock', '.map', '.snap', '.db', '.sqlite', '.parquet', '.psd']);
const SKIP_NAME = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|uv\.lock|poetry\.lock|Cargo\.lock|composer\.lock|packages\.lock\.json)$|\.min\.(js|css)$/;
const SKIP_DIRS = new Set(['node_modules', '.git', 'bin', 'obj', 'dist', 'build', '.next', '.venv', '__pycache__', '.ruff_cache', 'coverage', '.turbo', 'target']);
const TEST_PATH = /(^|\/)(tests?|__tests__|spec|fixtures?|e2e|mocks?)(\/|$)|\.(test|spec)\.[a-z]+$|_test\.(go|py)$|(^|\/)test_[^/]+\.py$|Tests?\.cs$/i;
const VALUE_FLAGS = new Set(['--root', '--budget', '--mode', '--lens', '--langdir', '--n', '--ref']);

function readText(file) {
  let buf;
  try { buf = fs.readFileSync(file); } catch { return null; }
  if (buf.length > 1_000_000 || buf.includes(0)) return null;
  return buf.toString('utf8');
}
const countLines = (file) => { const t = readText(file); return t === null ? 0 : t.split('\n').length; };

function globToRegex(g) {
  let r = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*') {
      if (g[i + 1] === '*') { r += '.*'; i++; if (g[i + 1] === '/') i++; } else r += '[^/]*';
    } else if (c === '?') r += '[^/]';
    else r += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + r + '$');
}
const hasGlob = (s) => /[*?]/.test(s);
function pathMatcher(paths) {
  if (!paths.length) return () => true;
  const tests = paths.map((raw) => {
    const p = raw.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
    if (hasGlob(p)) { const re = globToRegex(p); return (f) => re.test(f); }
    return (f) => f === p || f.startsWith(p + '/');
  });
  return (f) => tests.some((t) => t(f));
}

function positional(args) {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    if (VALUE_FLAGS.has(args[i])) { i++; continue; }
    if (args[i].startsWith('--')) continue;
    out.push(args[i]);
  }
  return out;
}

function walkFiles(root, rel = '', out = []) {
  let names = [];
  try { names = fs.readdirSync(path.join(root, rel)); } catch { return out; }
  for (const n of names) {
    if (SKIP_DIRS.has(n)) continue;
    const r = rel ? `${rel}/${n}` : n;
    let st; try { st = fs.statSync(path.join(root, r)); } catch { continue; }
    if (st.isDirectory()) walkFiles(root, r, out); else out.push(r);
  }
  return out;
}
function allFiles(root) {
  const f = isRepo(root) ? lines(git(root, ['ls-files', '--cached', '--others', '--exclude-standard'])) : walkFiles(root);
  return f.filter((x) => !SKIP_EXT.has(path.extname(x).toLowerCase()) && !SKIP_NAME.test(x) && fs.existsSync(path.join(root, x)));
}

// ---------- scope ----------

function resolvesAsCommit(root, name) {
  return git(root, ['rev-parse', '--verify', '--quiet', `${name}^{commit}`], { allowFail: true }) !== null;
}

function parseScope(root, args) {
  const spec = { mode: null, ref: null, paths: [], notes: [] };
  const ci = args.findIndex((a) => a === '--changes' || a === '--commit' || a === '--session');
  const wantsAll = args.includes('--all');
  if (wantsAll && ci >= 0) throw new Error('choose one scope: --all or --changes');
  if (args.includes('--commit')) spec.notes.push('--commit is an alias of --changes');
  if (args.includes('--session')) spec.notes.push('--session: this is the changed code; intersect it with the files this conversation touched');
  if (wantsAll) spec.mode = 'all';
  let refToken = null; let refForced = false;
  if (ci >= 0) {
    spec.mode = 'changes';
    const n = args[ci + 1];
    if (n && !n.startsWith('--') && !VALUE_FLAGS.has(args[ci])) refToken = n;
  }
  const ri = args.indexOf('--ref');
  if (ri >= 0) { spec.mode = 'changes'; refToken = args[ri + 1]; refForced = true; }
  if (refToken) {
    const exists = fs.existsSync(path.join(root, refToken));
    if (resolvesAsCommit(root, refToken) && !exists) spec.ref = refToken;
    else if (refForced || (!exists && !hasGlob(refToken))) throw new Error(`ref does not resolve: ${refToken}`);
  }
  spec.paths = positional(args).filter((p) => p !== spec.ref && p !== refToken || (p === refToken && !spec.ref));
  if (!spec.mode && spec.paths.length) spec.mode = 'all';
  return spec;
}

function detectBase(root) {
  if (!resolvesAsCommit(root, 'HEAD')) return null;
  for (const cand of ['@{upstream}', 'origin/HEAD', 'origin/main', 'origin/master', 'main', 'master']) {
    if (!resolvesAsCommit(root, cand)) continue;
    const mb = git(root, ['merge-base', cand, 'HEAD'], { allowFail: true });
    if (mb) return { name: cand, mergeBase: mb.trim() };
  }
  return null;
}

function parseHunks(diffText) {
  const out = new Map();
  let file = null;
  for (const l of diffText.split(/\r?\n/)) {
    const f = /^\+\+\+ b\/(.+)$/.exec(l);
    if (f) { file = f[1]; if (!out.has(file)) out.set(file, []); continue; }
    const h = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(l);
    if (h && file) {
      const start = Number(h[1]); const len = h[2] === undefined ? 1 : Number(h[2]);
      if (len > 0) out.get(file).push([start, start + len - 1]);
    }
  }
  return out;
}
const fmtRanges = (r) => r.map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`)).join(',');

function resolveScope(root, spec) {
  const notes = [...spec.notes];
  const match = pathMatcher(spec.paths);
  const vendored = vendoredToolkit(root); // a toolkit sync's copies are the toolkit, not the project's code
  const keep = (f) => !SKIP_EXT.has(path.extname(f).toLowerCase()) && !SKIP_NAME.test(f) && !vendored.has(f) && match(f) && fs.existsSync(path.join(root, f)) && fs.statSync(path.join(root, f)).isFile();
  if (!spec.mode) throw new Error('a scope is required: --all or --changes [ref] (optionally followed by a path)');
  if (vendored.size) notes.push(`${vendored.size} vendored toolkit files (.claude/toolkit/MANIFEST.json) left out`);
  if (spec.mode === 'all') {
    notes.unshift(`whole codebase${spec.paths.length ? ` under ${spec.paths.join(', ')}` : ''}`);
    const files = allFiles(root).filter(keep).sort().map((f) => ({ file: f, lines: countLines(path.join(root, f)), changed: null, ranges: null }));
    return { mode: 'all', files: files.filter((f) => f.lines > 0), notes, base: null };
  }
  if (!isRepo(root)) throw new Error('--changes needs a git repository');
  let base = null;
  if (spec.ref) {
    const mb = git(root, ['merge-base', spec.ref, 'HEAD'], { allowFail: true });
    base = { name: spec.ref, mergeBase: mb ? mb.trim() : spec.ref };
  } else base = detectBase(root);
  const against = base ? base.mergeBase : (resolvesAsCommit(root, 'HEAD') ? 'HEAD' : null);
  notes.unshift(base ? `changes against ${base.name} (merge-base ${base.mergeBase.slice(0, 8)}) plus the working tree` : 'changes in the working tree (no remote or main branch found to compare against)');
  const hunks = against ? parseHunks(git(root, ['diff', '-U0', '--no-color', '--diff-filter=ACMR', against, '--']) || '') : new Map();
  const files = new Map();
  for (const [f, r] of hunks) if (keep(f)) files.set(f, { file: f, lines: countLines(path.join(root, f)), ranges: r });
  for (const f of lines(git(root, ['ls-files', '--others', '--exclude-standard']))) {
    if (!keep(f) || files.has(f)) continue;
    const n = countLines(path.join(root, f));
    if (n > 0) files.set(f, { file: f, lines: n, ranges: [[1, n]] });
  }
  const out = [...files.values()].filter((f) => f.ranges.length).sort((a, b) => a.file.localeCompare(b.file))
    .map((f) => ({ ...f, changed: f.ranges.reduce((s, [a, b]) => s + (b - a + 1), 0) }));
  return { mode: 'changes', files: out, notes, base };
}

const CHANGE_SAFETY = [/(^|\/)(migrations?|alembic|migrate)\//i, /\.sql$/i, /(^|\/)schema\.(prisma|graphql|gql|json)$/i, /(^|\/)(openapi|swagger)[^/]*\.(ya?ml|json)$/i, /\.proto$/i];
const changeSafetyFiles = (files) => files.map((f) => f.file).filter((f) => CHANGE_SAFETY.some((re) => re.test(f)));

// "host/owner/repo" of the origin remote, or "none". A remote URL can carry a token (https://user:token@host/...),
// so only the host and path are ever printed. Whose code this is decides whether a gate may run it.
function originOf(root) {
  const raw = isRepo(root) ? (git(root, ['remote', 'get-url', 'origin'], { allowFail: true }) || '').trim() : '';
  if (!raw) return 'none';
  const m = raw.match(/^(?:[a-z][a-z0-9+.-]*:\/\/)?(?:[^@/\s]+@)?([^/:\s]+)(?::\d+)?[/:]+(\S+?)(?:\.git)?\/?$/i);
  return m ? `${m[1]}/${m[2]}` : 'unrecognised';
}

function cmdScope(root, args) {
  const spec = parseScope(root, args);
  const r = resolveScope(root, spec);
  if (!r.files.length) throw Object.assign(new Error(`empty scope (${r.notes.join('; ')}): nothing to review, stop here`), { code: 3 });
  const out = [`scope: ${r.notes.join('; ')}`, `origin: ${originOf(root)}  (a gate runs the project's own code: only your own repos get gates)`];
  if (r.mode === 'changes') {
    const changed = r.files.reduce((s, f) => s + f.changed, 0);
    out.push(`files: ${r.files.length}  changed lines: ${changed}  fast-path eligible for quality: ${changed <= 300 ? 'yes' : 'no'} (300 or fewer changed lines)`);
    const cs = changeSafetyFiles(r.files);
    out.push(`change-safety lens: ${cs.length ? `TRIGGERED by ${cs.slice(0, 5).join(', ')}${cs.length > 5 ? ', …' : ''}` : 'not triggered'}`);
    for (const f of r.files) out.push(`${String(f.changed).padStart(6)} changed of ${String(f.lines).padStart(5)}  ${f.file}  lines ${fmtRanges(f.ranges)}`);
  } else {
    out.push(`files: ${r.files.length}  lines: ${r.files.reduce((s, f) => s + f.lines, 0)}`);
    for (const f of r.files) out.push(`${String(f.lines).padStart(7)}  ${f.file}`);
  }
  return out.join('\n');
}

// ---------- risk (hotspots) and shards ----------

function riskScores(root, files) {
  const churn = new Map(); const fixes = new Map();
  const log = isRepo(root) ? git(root, ['log', '--since=90.days', '--name-only', '--pretty=format:@@%s'], { allowFail: true }) : null;
  let subject = '';
  for (const l of lines(log)) {
    if (l.startsWith('@@')) { subject = l.slice(2); continue; }
    churn.set(l, (churn.get(l) || 0) + 1);
    if (/\b(fix|bug|hotfix|revert|regression)\b/i.test(subject)) fixes.set(l, (fixes.get(l) || 0) + 1);
  }
  return new Map(files.map((f) => {
    const c = churn.get(f.file) || 0; const x = fixes.get(f.file) || 0;
    return [f.file, { churn: c, fixes: x, score: (c + 2 * x) * Math.log10(f.lines + 10) }];
  }));
}

function cmdHotspots(root, args) {
  const ni = args.indexOf('--n');
  const n = ni >= 0 ? Number(args[ni + 1]) : 20;
  const files = resolveScope(root, { mode: 'all', paths: [], notes: [] }).files;
  const risk = riskScores(root, files);
  const rows = files.map((f) => ({ ...f, ...risk.get(f.file) })).filter((r) => r.score > 0).sort((a, b) => b.score - a.score).slice(0, n);
  if (!rows.length) return 'hotspots: no history in the last 90 days (or not a git repository)';
  return ['hotspots (commits in the last 90 days, weighted by "fix" commits and size):', ...rows.map((r) => `${r.score.toFixed(1).padStart(7)}  churn ${String(r.churn).padStart(3)}  fixes ${String(r.fixes).padStart(2)}  ${String(r.lines).padStart(5)} lines  ${r.file}`)].join('\n');
}

const shardKey = (f, depth) => f.split('/').slice(0, Math.min(depth, f.split('/').length - 1)).join('/') || '.';
const weightOf = (mode, f) => (mode === 'changes' ? f.changed : f.lines);
// A bundled run (one agent carries several lenses) reads each file once, so its shards are half the size:
// a bigger agent run loses more when a usage limit cuts it off.
const defaultBudget = (mode, bundled = false) => Math.round((mode === 'changes' ? 1500 : 6000) / (bundled ? 2 : 1));

function makeShards(root, mode, files, budget, risk = riskScores(root, files)) {
  const weight = (f) => weightOf(mode, f);
  const keyOf = shardKey;
  const sum = (g) => g.reduce((s, f) => s + weight(f), 0);
  const place = (group, depth, out) => {
    if (sum(group) <= budget || depth > 6) { out.push(group); return; }
    const by = new Map();
    for (const f of group) { const k = keyOf(f.file, depth + 1); (by.get(k) || by.set(k, []).get(k)).push(f); }
    if (by.size === 1) {
      let cur = []; let n = 0;
      for (const f of group) { if (n + weight(f) > budget && cur.length) { out.push(cur); cur = []; n = 0; } cur.push(f); n += weight(f); }
      if (cur.length) out.push(cur);
      return;
    }
    for (const g of by.values()) place(g, depth + 1, out);
  };
  const first = new Map();
  for (const f of files) { const k = keyOf(f.file, 1); (first.get(k) || first.set(k, []).get(k)).push(f); }
  const groups = [];
  for (const g of first.values()) place(g, 1, groups);
  groups.sort((a, b) => sum(b) - sum(a));
  const shards = [];
  for (const g of groups) {
    const n = sum(g);
    const slot = shards.find((s) => s.weight + n <= budget);
    if (slot) { slot.files.push(...g); slot.weight += n; } else shards.push({ files: [...g], weight: n });
  }
  for (const s of shards) s.risk = s.files.reduce((t, f) => t + (risk.get(f.file)?.score || 0), 0);
  shards.sort((a, b) => b.risk - a.risk);
  return shards;
}

function cmdShards(root, args) {
  const bi = args.indexOf('--budget');
  const spec = parseScope(root, args);
  const budget = bi >= 0 ? Number(args[bi + 1]) : defaultBudget(spec.mode);
  const r = resolveScope(root, spec);
  if (!r.files.length) throw Object.assign(new Error('empty scope: nothing to shard'), { code: 3 });
  const shards = makeShards(root, r.mode, r.files, budget);
  const keyOf = shardKey;
  const unit = r.mode === 'changes' ? 'changed lines' : 'lines';
  const out = [`shards: ${shards.length}  budget: ${budget} ${unit}  total: ${shards.reduce((s, x) => s + x.weight, 0)} ${unit}  (shard 1 is the riskiest: recent churn, fix commits, size)`];
  shards.forEach((s, i) => {
    const mods = [...new Set(s.files.map((f) => keyOf(f.file, 1)))];
    out.push(`shard ${i + 1}: ${s.weight} ${unit}, ${s.files.length} files, risk ${s.risk.toFixed(1)}, modules: ${mods.join(', ')}`);
    if (args.includes('--files')) s.files.forEach((f) => out.push(`    ${f.file}${f.ranges ? `  lines ${fmtRanges(f.ranges)}` : ''}`));
  });
  return out.join('\n');
}

// ---------- prefilter ----------

const PS = /\.(ps1|psm1)$/i;
const WORKFLOW = /(^|\/)\.github\/workflows\/[^/]+\.ya?ml$/i;
const DOCKERFILE = /(^|\/)(Dockerfile[^/]*|[^/]+\.dockerfile)$/i;
// [lens, id, regex, optional file-path regex the pattern is limited to]
const PATTERNS = [
  ['security', 'unsafe-deserialization', /\bpickle\.loads?\(|\bmarshal\.loads\(|\bjoblib\.load\(|\bcloudpickle\.load/],
  ['security', 'yaml-unsafe-load', /\byaml\.load\((?!.*Safe)/],
  ['security', 'torch-load', /\btorch\.load\((?!.*weights_only\s*=\s*True)/],
  ['security', 'dynamic-eval', /\beval\(|new Function\(|\bFunction\(\s*['"`]/],
  ['security', 'shell-exec', /\bos\.system\(|subprocess\.[a-z_]+\([^)]*shell\s*=\s*True|exec\.Command\(\s*"(sh|bash|cmd)"|child_process.*\bexec\(|\bProcess\.Start\([^)]*\+/],
  ['security', 'tls-disabled', /verify\s*=\s*False|rejectUnauthorized\s*:\s*false|InsecureSkipVerify|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0|--insecure|ServerCertificateValidationCallback\s*=.*true/],
  ['security', 'xss-sink', /dangerouslySetInnerHTML|\.innerHTML\s*=|document\.write\(|v-html=|\|\s*safe\b|mark_safe\(/],
  ['security', 'script-no-integrity', /<script[^>]+src=["']https?:(?![^>]*integrity)/i],
  ['security', 'weak-crypto', /\bAES[^\n]*ECB|\bMD5\b|hashlib\.(md5|sha1)\(|createHash\(\s*['"](md5|sha1)['"]/i],
  ['security', 'hardcoded-secret', /(secret[_-]?key|passw(or)?d|\bpwd|api[_-]?key|auth[_-]?token|client[_-]?secret|jwt[_-]?secret|session[_-]?secret)\s*[:=]\s*["'](?![^"']*(placeholder|example|changeme|dummy|sample|redacted|fake|your[_-]|xxx|\*\*\*|(?<![a-z])test(?![a-z])))[^"'\s]{8,}["']/i],
  ['security', 'known-token-shape', /\bAKIA[0-9A-Z]{16}\b|\bghp_[A-Za-z0-9]{30,}\b|\bsk-[A-Za-z0-9_-]{20,}|\b[sr]k_live_[A-Za-z0-9]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['security', 'debug-on', /\bDEBUG\s*=\s*True\b|app\.debug\s*=\s*True|\.run\([^)]*\bdebug\s*=\s*True|UseDeveloperExceptionPage\(/],
  ['security', 'weak-random-token', /(Math\.random\(\)|\brandom\.(random|randint|choice)\()[^\n]*(token|secret|session|nonce|password|key)|(token|secret|session|nonce|password|key)[^\n]*(Math\.random\(\)|\brandom\.(random|randint|choice)\()/i],
  ['security', 'sql-concat', /\b(SELECT|INSERT|UPDATE|DELETE)\b[^\n"'`]*["'`]\s*(\+|%|\.format\()|f["'][^"']*\b(SELECT|INSERT|UPDATE|DELETE)\b[^"']*\{/i],
  ['security', 'open-bind', /(host|bind|listen)[^\n]*['"]0\.0\.0\.0['"]|UseUrls\([^)]*\+:|--host\s+0\.0\.0\.0/i],
  ['security', 'cors-any-origin', /Access-Control-Allow-Origin['"]?\s*[:,]\s*['"]\*|origin\s*:\s*(['"]\*['"]|true\b)|origin\s*\|\|\s*['"]\*|allow_origins\s*=\s*\[\s*['"]\*|allow_origin_regex|AllowAnyOrigin\(\)|Allow-Origin['"\]]*\s*[:,=]\s*(req|request)\.headers|Allow-Origin['"\]]*\s*[:,=]\s*['"]null['"]/i],
  ['security', 'ssti', /render_template_string\(|\.from_string\(|Handlebars\.compile\(|\bejs\.render\(|nunjucks\.renderString\(|Template\([^)]*(request|req)\b/],
  ['security', 'jwt-weak-verify', /verify_signature['"]?\s*:\s*False|ignoreExpiration\s*:\s*true|algorithms[^\n]*['"]none['"]|\bjwt\.decode\(/],
  ['security', 'open-redirect', /redirect\([^)\n]*(req\.(query|body|params)|request\.(args|GET|query_params)|searchParams\.get)/],
  ['security', 'error-leak', /(res\.(json|send)|reply\.send|Response\.json|JSONResponse)\([^\n]*(\berr(or)?\.(message|stack)|\bstr\((e|exc|err)\)|traceback\.format_exc)/],
  ['security', 'todo-security', /(?:\/\/|#|\/\*|<!--|^\s*\*)\s*(?:TODO|FIXME|HACK|XXX)\b.*?\b(?:auth|authori[sz]|permission|csrf|xss|sanitiz|validat|escap|secur|encrypt|password|token|rate.?limit)/i],
  ['security', 'dotnet-unsafe-deserialization', /\b(BinaryFormatter|NetDataContractSerializer|SoapFormatter|LosFormatter|ObjectStateFormatter)\b|TypeNameHandling\s*=\s*TypeNameHandling\.(All|Auto|Objects|Arrays)\b|\bObjectInputStream\(/],
  ['security', 'named-pipe-server', /new\s+NamedPipeServerStream\(/],
  ['security', 'postmessage-wildcard', /\.postMessage\([^\n]*,\s*['"]\*['"]\s*\)/],
  ['security', 'postmessage-handler', /addEventListener\(\s*['"]message['"]/],
  ['security', 'token-in-web-storage', /\b(localStorage|sessionStorage)\.setItem\(\s*['"`][^'"`]*(token|jwt|secret|session|auth|password)/i],
  ['security', 'prototype-pollution-merge', /\b(_|lodash)\.(merge|mergeWith|defaultsDeep|set)\(|\$\.extend\(\s*true\b|\bdeepmerge\(|\bmerge-deep\b/],
  ['security', 'javascript-url', /['"`]javascript:/i],
  // PowerShell
  ['security', 'ps-invoke-expression', /\bInvoke-Expression\b|\biex\b\s*[\(\$"']/i, PS],
  ['security', 'ps-download-and-run', /\b(Invoke-WebRequest|Invoke-RestMethod|iwr|irm)\b[^\n]*\|\s*(iex|Invoke-Expression)\b/i, PS],
  ['security', 'ps-execution-bypass', /-ExecutionPolicy\s+Bypass/i, PS],
  ['security', 'ps-plaintext-secret', /ConvertTo-SecureString[^\n]*-AsPlainText/i, PS],
  ['security', 'ps-arglist-concat', /Start-Process[^\n]*-ArgumentList[^\n]*(\+|"[^"]*\$[^"]*")/i, PS],
  ['quality', 'ps-silent-failure', /(?<!Get-Command[^\n]*)-ErrorAction\s+SilentlyContinue|\$ErrorActionPreference\s*=\s*['"]?(SilentlyContinue|Continue)/i, PS],
  ['performance', 'ps-array-append', /\$\w+\s*\+=\s*(?!\d|if\b|-?\d)/, PS],
  // GitHub Actions
  ['security', 'actions-pull-request-target', /\bpull_request_target\b/, WORKFLOW],
  ['security', 'actions-unpinned-third-party', /uses:\s*(?!actions\/|github\/|\.\/)[\w.-]+\/[\w./-]+@(?![0-9a-f]{40}\b)\S+/, WORKFLOW],
  ['security', 'actions-injection', /\$\{\{\s*github\.event\.(issue|pull_request|comment|review)[\w.]*\.(title|body|head\.ref)\s*\}\}/, WORKFLOW],
  ['security', 'actions-pr-head-checkout', /ref:\s*\$\{\{\s*github\.(event\.pull_request\.head\.(sha|ref)|head_ref)/, WORKFLOW],
  ['security', 'actions-write-all', /permissions:\s*write-all\b/, WORKFLOW],
  // Dockerfile
  ['security', 'docker-run-as-root', /^\s*USER\s+root\b/i, DOCKERFILE],
  ['security', 'docker-pipe-to-shell', /\b(curl|wget)\b[^\n]*\|\s*(sh|bash)\b/i, DOCKERFILE],
  ['security', 'docker-unpinned-base', /^\s*FROM\s+[^\s:@]+(:latest)?\s*(AS\s+\S+)?\s*$/i, DOCKERFILE],
  ['security', 'docker-copy-all', /^\s*(COPY|ADD)\s+(--\S+\s+)*\.\s+\S+/i, DOCKERFILE],
  // quality
  ['quality', 'empty-catch', /catch\s*(\([^)]*\))?\s*\{\s*\}|except[^:\n]*:\s*pass\b|\.catch\(\s*\(\)\s*=>\s*(\[\]|null|\{\})\s*\)/],
  ['quality', 'blocking-async', /\.GetAwaiter\(\)\.GetResult\(\)|\.Result\b(?!\w)|\.Wait\(\)|\basync void\b/],
  ['quality', 'lint-suppression', /eslint-disable|@ts-ignore|@ts-nocheck|#\s*type:\s*ignore|#\s*noqa|#pragma warning disable|\[SuppressMessage/],
  ['quality', 'leftover-debug', /\bconsole\.log\(|\bdebugger;|\bprint\(\s*f?["']DEBUG|\bDebug\.WriteLine\(|\bdd\(|var_dump\(/],
  ['quality', 'todo-marker', /\b(TODO|FIXME|HACK|XXX)\b/],
  ['quality', 'floating-promise', /^\s*(?!return|await|const|let|var)[A-Za-z_.]+\.then\(/],
  // performance
  ['performance', 'select-star', /\bSELECT\s+\*/i],
  ['performance', 'foreach-async', /\.forEach\(\s*async\b/],
  ['performance', 'deep-clone-json', /JSON\.parse\(JSON\.stringify\(/],
  ['performance', 'sync-io', /\b(readFileSync|writeFileSync|readdirSync|execSync)\(|\bFile\.ReadAll(Text|Lines)\(/],
  ['performance', 'whole-library-import', /import\s+(_|moment|\*\s+as\s+_)\s+from\s+['"](lodash|moment)['"]|require\(['"](lodash|moment)['"]\)/],
  ['performance', 'sleep-polling', /\btime\.sleep\(|Thread\.Sleep\(|setInterval\([^)]*\b\d{1,3}\b\s*\)/],
];
const ENV_FILE = /(^|\/)\.env(\.[\w-]+)?$/i;
const ENV_EXAMPLE = /\.(example|sample|template|dist)$/i;

function cmdPrefilter(root, args) {
  const mi = args.indexOf('--mode');
  const mode = mi >= 0 ? args[mi + 1] : 'all';
  const scoped = args.includes('--all') || args.includes('--changes') || args.includes('--commit') || args.includes('--session') || args.includes('--ref');
  let targets; // [{ file, ranges|null }]
  if (scoped) {
    const r = resolveScope(root, parseScope(root, args));
    targets = r.files.map((f) => ({ file: f.file, ranges: r.mode === 'changes' ? f.ranges : null }));
  } else {
    targets = positional(args).map((f) => ({ file: f, ranges: null }));
  }
  if (!targets.length) throw new Error('prefilter needs a scope (--all or --changes) or files');
  const hits = [];
  for (const t of targets) {
    const rel = t.file.replace(/\\/g, '/');
    const full = path.isAbsolute(t.file) ? t.file : path.join(root, t.file);
    if (mode !== 'quality' && mode !== 'performance' && ENV_FILE.test(rel) && !ENV_EXAMPLE.test(rel) && isRepo(root) && git(root, ['ls-files', '--error-unmatch', rel], { allowFail: true }) !== null) {
      hits.push(`${rel}:1  [security/tracked-env-file]  an .env file is tracked by git; check what it holds without printing values`);
    }
    const text = readText(full);
    if (text === null) continue;
    const isTest = TEST_PATH.test(rel);
    const seen = new Map();
    text.split(/\r?\n/).forEach((line, i) => {
      if (line.length > 1500) return;
      if (t.ranges && !t.ranges.some(([a, b]) => i + 1 >= a && i + 1 <= b)) return;
      for (const [lens, id, re, only] of PATTERNS) {
        if (mode !== 'all' && mode !== lens) continue;
        if (only && !only.test(rel)) continue;
        if (!re.test(line)) continue;
        const n = (seen.get(id) || 0) + 1;
        seen.set(id, n);
        if (n <= 5) hits.push(`${rel}:${i + 1}  [${lens}/${id}]${isTest ? ' (test file)' : ''}  ${line.trim().slice(0, 110)}`);
      }
    });
    for (const [id, n] of seen) if (n > 5) hits.push(`${rel}  [${id}] +${n - 5} more lead(s) of the same kind`);
  }
  const where = scoped ? 'changed lines only' : 'whole files';
  return [`prefilter (${mode}, ${where}): ${hits.length} lead(s) in ${targets.length} file(s). A lead is not a finding: read the context first.`, ...hits].join('\n');
}

// ---------- gates ----------

function walkShallow(root, depth, rel = '', out = []) {
  let names = [];
  try { names = fs.readdirSync(path.join(root, rel)); } catch { return out; }
  for (const n of names) {
    if (SKIP_DIRS.has(n)) continue;
    const r = rel ? `${rel}/${n}` : n;
    let st; try { st = fs.statSync(path.join(root, r)); } catch { continue; }
    if (st.isDirectory()) { if (depth > 0) walkShallow(root, depth - 1, r, out); } else out.push(r);
  }
  return out;
}

function cmdGates(root) {
  const found = [];
  const add = (kind, command, speed, source) => found.push({ kind, command, speed, source });
  const row = (g) => `${g.kind.padEnd(9)} ${g.command.padEnd(40)} ${g.speed.padEnd(8)} ${g.source}`;
  const review = readText(path.join(root, '.claude', 'REVIEW.md'));
  if (review) {
    const gates = review.match(/##\s+Gates[\s\S]*?(?=\n##\s|$)/);
    if (gates) {
      for (const r of gates[0].split('\n')) {
        const c = r.split('|').map((s) => s.trim());
        const cmd = (c[2] || '').replace(/^`|`$/g, '');
        if (c.length >= 4 && c[1] && !/^(kind|-+)$/i.test(c[1]) && cmd && !cmd.startsWith('<!--')) add(c[1].toLowerCase(), cmd, (c[3] || '').toLowerCase() || 'unknown', '.claude/REVIEW.md ## Gates');
      }
    } else {
      const q = review.match(/##\s+Quality gate[\s\S]*?```[a-z]*\n([\s\S]*?)```/);
      if (q) for (const l of q[1].split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('<!--'))) add('gate', l, 'unknown', '.claude/REVIEW.md ## Quality gate');
    }
  }
  if (found.length) return ['gates from .claude/REVIEW.md (not run; run the fast ones first with a time limit, ask before a slow one on a large repo):', ...found.map(row)].join('\n');
  const pj = readText(path.join(root, 'package.json'));
  if (pj) {
    let scripts = {};
    try { scripts = JSON.parse(pj).scripts || {}; } catch { /* ignore */ }
    const runner = fs.existsSync(path.join(root, 'yarn.lock')) ? 'yarn' : fs.existsSync(path.join(root, 'pnpm-lock.yaml')) ? 'pnpm' : 'npm';
    const map = [['lint', /^lint$/], ['format', /^(format:check|format-check|prettier:check|check:format)$/], ['typecheck', /^(typecheck|type-check|tsc|check:types)$/], ['test', /^test$/], ['build', /^build$/]];
    for (const [kind, re] of map) for (const name of Object.keys(scripts)) if (re.test(name)) add(kind, runner === 'npm' ? `npm run ${name}` : `${runner} ${name}`, kind === 'test' || kind === 'build' ? 'slow' : 'fast', 'package.json scripts');
    if (runner !== 'npm') add('note', `${runner} is not installed on this machine (only node, npm, npx); use npm`, '-', 'lockfile');
    if (fs.existsSync(path.join(root, 'package-lock.json'))) add('audit', 'npm audit --omit=dev', 'network', 'package-lock.json');
  }
  const py = readText(path.join(root, 'pyproject.toml')) || '';
  if (py || fs.existsSync(path.join(root, 'requirements.txt'))) {
    if (/\[tool\.ruff/.test(py) || fs.existsSync(path.join(root, 'ruff.toml'))) { add('lint', 'uvx ruff check .', 'fast', 'pyproject/ruff.toml'); add('format', 'uvx ruff format --check .', 'fast', 'pyproject/ruff.toml'); }
    if (/pytest/.test(py) || fs.existsSync(path.join(root, 'tests'))) add('test', 'python -m pytest -q', 'slow', 'pyproject/tests');
    add('audit', 'uvx pip-audit', 'network', 'python project');
  }
  const sln = walkShallow(root, 3).filter((f) => /\.(sln|csproj)$/.test(f));
  if (sln.length) {
    add('build', 'dotnet build', 'slow', sln[0]);
    if (sln.some((f) => /\.csproj$/.test(f) && /Microsoft\.NET\.Test\.Sdk/.test(readText(path.join(root, f)) || ''))) add('test', 'dotnet test --no-build', 'slow', 'test project');
    add('format', 'dotnet format --verify-no-changes', 'fast', sln[0]);
    add('audit', 'dotnet list package --vulnerable', 'network', sln[0]);
  }
  if (fs.existsSync(path.join(root, 'Cargo.toml'))) { add('lint', 'cargo clippy -- -D warnings', 'slow', 'Cargo.toml'); add('test', 'cargo test', 'slow', 'Cargo.toml'); }
  if (fs.existsSync(path.join(root, 'go.mod'))) { add('lint', 'go vet ./...', 'fast', 'go.mod'); add('test', 'go test ./...', 'slow', 'go.mod'); }
  if (!found.length) return 'gates: none found. Say so in the report (gate `unavailable`), and do not invent a command.';
  return ['gates found (not run; run the fast ones first with a time limit, ask before a slow one on a large repo):', ...found.map(row)].join('\n');
}

// ---------- deps ----------

const EXACT = /^\d+\.\d+\.\d+([-+][\w.-]+)?$/;

function cmdDeps(root) {
  const out = [];
  const pjText = readText(path.join(root, 'package.json'));
  if (pjText) {
    let pj = {};
    try { pj = JSON.parse(pjText); } catch { out.push('package.json: not valid JSON'); }
    const all = { ...(pj.dependencies || {}), ...(pj.devDependencies || {}), ...(pj.optionalDependencies || {}) };
    const ranges = Object.entries(all).filter(([, v]) => !EXACT.test(v) && !/^(file|link|workspace):/.test(v));
    out.push(`package.json: ${Object.keys(all).length} dependencies, ${ranges.length} not pinned exactly`);
    ranges.slice(0, 40).forEach(([n, v]) => out.push(`  unpinned  ${n}@${v}`));
    const odd = Object.entries(all).filter(([, v]) => /^(git\+|github:|https?:|git:)/.test(v));
    odd.forEach(([n, v]) => out.push(`  non-registry source  ${n}@${v} (a git or tarball dependency is not covered by the registry's checks)`));
    const locks = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'].filter((l) => fs.existsSync(path.join(root, l)));
    if (!locks.length) out.push('  no lockfile (commit one)');
    if (locks.length > 1) out.push(`  more than one lockfile: ${locks.join(', ')} (npm or yarn, never both)`);
    const lockText = readText(path.join(root, 'package-lock.json'));
    if (lockText) {
      try {
        const pk = JSON.parse(lockText).packages || {};
        const withScripts = Object.entries(pk).filter(([k, v]) => k && v.hasInstallScript).map(([k, v]) => `${k.replace(/^.*node_modules\//, '')}@${v.version || '?'}`);
        const nonRegistry = Object.entries(pk).filter(([k, v]) => k && v.resolved && !/^https:\/\/registry\.npmjs\.org\//.test(v.resolved)).map(([k, v]) => `${k.replace(/^.*node_modules\//, '')} <- ${String(v.resolved).slice(0, 60)}`);
        out.push(`  packages with install scripts (run code on install): ${withScripts.length}`);
        withScripts.slice(0, 20).forEach((n) => out.push(`    ${n}`));
        if (nonRegistry.length) { out.push(`  packages resolved from outside registry.npmjs.org: ${nonRegistry.length}`); nonRegistry.slice(0, 10).forEach((n) => out.push(`    ${n}`)); }
      } catch { out.push('  package-lock.json: could not be parsed'); }
    }
    const blob = walkShallow(root, 6).filter((f) => /\.(m?[jt]sx?|vue|svelte|astro|cjs|json|css|scss|html|ya?ml)$/.test(f) && f !== 'package.json' && !SKIP_NAME.test(f)).map((f) => readText(path.join(root, f)) || '').join('\n');
    const scripts = JSON.stringify(pj.scripts || {});
    const TOOLING = /^(typescript|tsx|ts-node|eslint.*|@eslint\/.*|prettier.*|vitest|jest|ts-jest|@playwright\/test|playwright|nodemon|concurrently|rimraf|husky|lint-staged|cross-env|@types\/.*)$/;
    const unused = Object.keys(all).filter((n) => !TOOLING.test(n) && !blob.includes(n) && !scripts.includes(n.replace(/^@[^/]+\//, '')));
    out.push(`  unused candidates (named nowhere in source, config or scripts; a plugin loaded by name can hide): ${unused.length}`);
    unused.slice(0, 30).forEach((n) => out.push(`    ${n}`));
  }
  for (const f of ['requirements.txt', 'requirements-dev.txt']) {
    const t = readText(path.join(root, f));
    if (t === null) continue;
    const rows = t.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && !l.startsWith('-'));
    const bad = rows.filter((l) => !/==/.test(l));
    out.push(`${f}: ${rows.length} requirements, ${bad.length} not pinned with ==`);
    bad.slice(0, 40).forEach((l) => out.push(`  unpinned  ${l}`));
    rows.filter((l) => /^(git\+|https?:)/.test(l)).forEach((l) => out.push(`  non-registry source  ${l}`));
  }
  const pyp = readText(path.join(root, 'pyproject.toml'));
  if (pyp) {
    const dep = pyp.match(/dependencies\s*=\s*\[([\s\S]*?)\]/);
    if (dep) {
      const rows = [...dep[1].matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);
      const bad = rows.filter((l) => !/==/.test(l));
      out.push(`pyproject.toml: ${rows.length} dependencies, ${bad.length} not pinned with ==`);
      bad.slice(0, 40).forEach((l) => out.push(`  unpinned  ${l}`));
    }
    if (!fs.existsSync(path.join(root, 'uv.lock'))) out.push('  no uv.lock (commit one)');
  }
  for (const f of walkShallow(root, 4).filter((x) => x.endsWith('.csproj'))) {
    const t = readText(path.join(root, f)) || '';
    const refs = [...t.matchAll(/<PackageReference\s+Include="([^"]+)"[^>]*Version="([^"]+)"/g)];
    const bad = refs.filter((m) => !EXACT.test(m[2]));
    out.push(`${f}: ${refs.length} package references, ${bad.length} not pinned exactly`);
    bad.slice(0, 40).forEach((m) => out.push(`  unpinned  ${m[1]} ${m[2]}`));
  }
  const vend = vendoredLibs(root);
  if (vend.length) {
    out.push(`vendored front-end libraries: ${vend.length} (copied into the repo, so no audit gate sees them; check each version against known advisories)`);
    vend.slice(0, 30).forEach((v) => out.push(`  ${v.name} ${v.version}  ${v.file}`));
  }
  if (!out.length) return 'deps: no package.json, requirements, pyproject or .csproj found';
  return ['deps hygiene (candidates; read before acting):', ...out].join('\n');
}

// Tracked *.min.js and vendor/ scripts: the scope skips minified files, and `npm audit` cannot see a copied file.
function vendoredLibs(root) {
  const files = isRepo(root) ? lines(git(root, ['ls-files', '--cached', '--others', '--exclude-standard'])) : walkFiles(root);
  const found = new Map();
  for (const f of files) {
    const inVendor = /(^|\/)vendor\//i.test(f);
    if (!/\.js$/i.test(f) || !(/\.min\.js$/i.test(f) || inVendor) || (!inVendor && /(^|\/)(dist|build|\.next)\//i.test(f))) continue; // a project's own built output is not vendored
    const m = /(^|\/)([\w.-]+)@(\d+\.\d+\.\d+[\w.-]*)\//.exec(f);
    let name = m ? m[2] : null; let version = m ? m[3] : null;
    if (!version) {
      const head = (readText(path.join(root, f)) || '').slice(0, 600);
      const b = /\/\*!?[\s*]*(?:@license\s+)?(?:@preserve\s+)?([A-Za-z][\w. -]{1,30}?)\s+v?(\d+\.\d+\.\d+[\w.-]*)/.exec(head);
      if (b) { name = b[1].trim(); version = b[2]; }
    }
    name = name || path.basename(f).replace(/(\.min)?\.js$/i, '');
    const key = `${name} ${version || 'version unknown'}`;
    if (!found.has(key)) found.set(key, { name, version: version || 'version unknown', file: f });
  }
  return [...found.values()];
}

// ---------- lang and stack ----------

function langDir(args) {
  const i = args.indexOf('--langdir');
  return i >= 0 ? args[i + 1] : path.join(os.homedir(), '.claude', 'agents', 'references', 'languages');
}
function classify(heading) {
  if (/security|safety|secrets|injection|crypto/i.test(heading)) return 'security';
  if (/performance|concurrency|memory|allocation|efficien/i.test(heading)) return 'performance';
  return 'quality';
}
function cmdLang(args) {
  const name = positional(args)[0];
  if (!name) throw new Error('lang needs a name, for example: lang csharp --lens security');
  const li = args.indexOf('--lens');
  const lens = li >= 0 ? args[li + 1] : 'all';
  const file = path.join(langDir(args), `${name}.md`);
  const text = readText(file);
  if (text === null) throw new Error(`no checklist named ${name} (looked for ${file})`);
  if (lens === 'all') return text;
  const parts = [];
  let cur = { heading: '', body: [] };
  for (const l of text.split(/\r?\n/)) {
    if (/^#{2,3} /.test(l)) { parts.push(cur); cur = { heading: l, body: [l] }; } else cur.body.push(l);
  }
  parts.push(cur);
  const preamble = parts.shift();
  const picked = parts.filter((p) => classify(p.heading) === lens || (lens === 'quality' && /diagnostic|approval/i.test(p.heading)));
  if (!picked.length) return `# ${name}: no section titled for the ${lens} lens, so here is the whole checklist\n\n${text}`;
  return [`# ${name}: ${lens} sections only`, preamble.body.join('\n').trim(), ...picked.map((p) => p.body.join('\n').trim())].filter(Boolean).join('\n\n');
}

// Which source extensions make a language checklist relevant to a shard (used to trim the repo-wide stack to the files
// a reviewer actually gets). A stack not listed here is kept as is.
const STACK_EXT = {
  react: /\.(tsx|jsx)$/i, typescript: /\.(m?[jt]sx?|cts)$/i, node: /\.(m?[jt]s|cjs)$/i, vue: /\.vue$/i,
  powershell: /\.(ps1|psm1)$/i, csharp: /\.(cs|csx)$/i, wpf: /\.(xaml|axaml|cs)$/i, fsharp: /\.fs[xi]?$/i,
  python: /\.py$/i, fastapi: /\.py$/i, django: /\.py$/i, rust: /\.rs$/i, go: /\.go$/i, java: /\.java$/i, kotlin: /\.kt$/i,
  swift: /\.swift$/i, flutter: /\.dart$/i, php: /\.php$/i, database: /\.sql$/i,
};
const stacksForFiles = (stack, files) => [...stack.keys()].filter((n) => !STACK_EXT[n] || files.some((f) => STACK_EXT[n].test(f)));

function cmdStack(root) {
  const found = detectStack(root);
  if (!found.size) return 'stack: nothing recognised. Say so, and read no language checklist.';
  return ['stack (read only these checklists, each with lang <name> --lens <lens>):', ...[...found].map(([n, w]) => `  ${n.padEnd(11)} ${w}`)].join('\n');
}

function detectStack(root) {
  const found = new Map();
  const add = (name, why) => { if (!found.has(name)) found.set(name, why); };
  const files = isRepo(root) ? lines(git(root, ['ls-files', '--cached', '--others', '--exclude-standard'])) : walkFiles(root);
  const pj = readText(path.join(root, 'package.json'));
  if (pj) {
    let d = {};
    try { const j = JSON.parse(pj); d = { ...(j.dependencies || {}), ...(j.devDependencies || {}) }; } catch { /* ignore */ }
    if (d.react || d.next) add('react', 'react or next in package.json');
    if (d.vue || d.nuxt) add('vue', 'vue or nuxt in package.json');
    if (d.typescript || fs.existsSync(path.join(root, 'tsconfig.json'))) add('typescript', 'typescript or tsconfig.json');
    if (d.fastify || d.express || d.koa || d.hono) add('node', 'a Node server framework in package.json');
    if (!found.size) add('typescript', 'package.json (JavaScript or TypeScript)');
  }
  if (files.some((f) => /\.ps1$|\.psm1$/i.test(f))) add('powershell', 'PowerShell scripts present');
  for (const f of files.filter((x) => x.endsWith('.csproj')).slice(0, 20)) {
    const t = readText(path.join(root, f)) || '';
    if (/<UseWPF>\s*true/i.test(t)) add('wpf', `UseWPF in ${f}`);
    add('csharp', `.csproj: ${f}`);
  }
  if (files.some((f) => /\.(xaml|axaml)$/i.test(f))) add('wpf', 'XAML files present');
  if (files.some((f) => /\.fsproj$/.test(f))) add('fsharp', '.fsproj present');
  const py = (readText(path.join(root, 'pyproject.toml')) || '') + (readText(path.join(root, 'requirements.txt')) || '');
  if (py || files.some((f) => f.endsWith('.py'))) {
    add('python', 'Python project');
    if (/fastapi/i.test(py)) add('fastapi', 'fastapi dependency');
    if (/django/i.test(py)) add('django', 'django dependency');
  }
  if (fs.existsSync(path.join(root, 'Cargo.toml'))) add('rust', 'Cargo.toml');
  if (fs.existsSync(path.join(root, 'go.mod'))) add('go', 'go.mod');
  if (files.some((f) => /pom\.xml$|build\.gradle(\.kts)?$/.test(f))) add(files.some((f) => /\.kt$/.test(f)) ? 'kotlin' : 'java', 'Maven or Gradle build');
  if (fs.existsSync(path.join(root, 'Package.swift'))) add('swift', 'Package.swift');
  if (fs.existsSync(path.join(root, 'pubspec.yaml'))) add('flutter', 'pubspec.yaml');
  if (fs.existsSync(path.join(root, 'composer.json'))) add('php', 'composer.json');
  const usesSqlite = files.filter((f) => /\.(m?[jt]sx?)$/.test(f)).slice(0, 300).some((f) => /node:sqlite|better-sqlite3|sqlite3/.test(readText(path.join(root, f)) || ''));
  if (files.some((f) => /\.sql$/i.test(f)) || usesSqlite || /sqlite|psycopg|asyncpg|better-sqlite3|\bpg\b/i.test((pj || '') + py)) add('database', 'SQL files, SQLite or a database dependency');
  return found;
}

// ---------- entry points, dependents ----------

const ENTRY = [
  ['route', /\b(app|router|fastify|server|api)\.(get|post|put|delete|patch|all|use|route|register)\(|@\w+\.(get|post|put|delete|patch|route|websocket)\(|\[Http(Get|Post|Put|Delete|Patch)|\bapp\.Map(Get|Post|Put|Delete)\(|\bcreateServer\(|^\s*export\s+(async\s+)?(function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b/],
  ['server-action', /^\s*['"]use server['"]/],
  ['auth-hook', /\.addHook\(\s*['"](onRequest|preHandler|preValidation)['"]|\bapp\.use\([^)\n]*(auth|session|jwt|passport)|export\s+(async\s+)?function\s+middleware\b|\bmatcher\s*:|\[Authorize\b|\blogin_required\b|\bDepends\([^)\n]*(user|auth)/i],
  ['socket', /new WebSocket(Server)?\(|\.on\(\s*['"]message['"]|\bsocket\.on\(|NamedPipe|\bSignalR\b|\bHub\b\s*:/],
  ['cli', /process\.argv|\bargparse\b|\bsys\.argv\b|\bclick\.|\bparam\s*\(|\$args\b|static (void|async Task(<int>)?) Main\(/],
  ['file-read', /\b(readFile|readFileSync|createReadStream|readdir)\(|\bopen\(\s*[^)]*['"]r|\bFile\.(ReadAll|Open|Read)|\bGet-Content\b|\bRead-Host\b/],
  ['network', /\bfetch\(|\baxios\.|\brequests\.(get|post)\(|\bHttpClient\b|\bInvoke-(WebRequest|RestMethod)\b|\burllib\b/],
  ['process', /\bspawn\(|\bexecFile\(|\bexec\(|subprocess\.|Process\.Start\(|Start-Process\b/],
  ['ipc-or-env', /ipcMain\.|ipcRenderer\.|process\.env\b|os\.environ|Environment\.GetEnvironmentVariable|\$env:/],
  ['deserialize', /JSON\.parse\(|yaml\.(safe_)?load|JsonSerializer\.Deserialize|pickle\.load|XmlSerializer|ConvertFrom-Json/],
];

function cmdEntrypoints(root, args) {
  const spec = parseScope(root, args);
  if (!spec.mode) spec.mode = 'all';
  const r = resolveScope(root, spec);
  const rows = []; const perFile = new Map(); const trustLeads = [];
  for (const f of r.files) {
    const text = readText(path.join(root, f.file));
    if (text === null || TEST_PATH.test(f.file)) continue;
    const seen = new Map();
    text.split(/\r?\n/).forEach((line, i) => {
      if (line.length > 1500) return;
      if (f.ranges && r.mode === 'changes' && !f.ranges.some(([a, b]) => i + 1 >= a && i + 1 <= b)) return;
      for (const [kind, re] of ENTRY) {
        if (!re.test(line)) continue;
        const n = (seen.get(kind) || 0) + 1; seen.set(kind, n);
        if (n <= 4) rows.push(`${f.file}:${i + 1}  [${kind}]  ${line.trim().slice(0, 100)}`);
      }
    });
    if (seen.size) {
      let s = [...seen].map(([k, n]) => `${k} x${n}`).join(', ');
      if (seen.has('route') || seen.has('server-action')) {
        const t = trustOf(text);
        s += `  | guard: ${t.guards.join('+') || 'none'} | effect: ${t.effects.join('+') || 'none'}`;
        if (!t.guards.includes('auth') && !t.guards.includes('rate-limit') && t.effects.length) trustLeads.push(`${f.file}  public route with a side effect (${t.effects.join('+')}) and no auth or rate-limit marker in the file`);
        if (WEBHOOK_ROUTE.test(f.file) && !t.guards.includes('signature') && !t.guards.includes('auth')) trustLeads.push(`${f.file}  looks like an inbound webhook route with no signature-verification marker in the file`);
      }
      perFile.set(f.file, s);
    }
  }
  if (!rows.length) return 'entrypoints: none found by pattern. Say so; do not assume there is no attack surface.';
  const hooks = rows.filter((r) => r.includes('[auth-hook]')).length;
  return [`entry points (a map of where outside input can enter; patterns, not proof): ${perFile.size} file(s)`, ...[...perFile].map(([f, s]) => `  ${f}: ${s}`), '', ...rows.slice(0, 120), rows.length > 120 ? `+${rows.length - 120} more` : '',
    '', `global auth hooks found: ${hooks}${hooks ? '' : ' (none: every route must carry its own check)'}. The guard and effect columns are keyword matches on the whole file, not proof.`,
    ...(trustLeads.length ? ['trust leads (read the file and any global hook before calling one a finding):', ...trustLeads.map((l) => `  ${l}`)] : [])].filter((x) => x !== '').join('\n');
}

// Keyword sets from Penthera's attack-surface.js (MIT, danoszz), widened for Python and C#.
const GUARD_AUTH = /requireAuth|getSession|getServerSession|verifyToken|verifyAdmin|isAdmin|jwt\.verify|verifyIdToken|currentUser|request\.user\b|Depends\([^)\n]*(user|auth)|\[Authorize\b|login_required|AUTH_PASSWORD/i;
const GUARD_RATE = /rateLimit|rate-limit|ratelimit|throttle|slowapi|\bLimiter\b/i;
const GUARD_TIMING = /timingSafeEqual|safeCompare|compare_digest/;
// Cloudflare's security-audit-skill (MIT): an inbound provider callback is trusted only after its signature is verified.
const GUARD_SIGNATURE = /constructEvent|verifySignature|verify_signature|X-Hub-Signature|stripe-signature|svix|webhook[_-]?secret|createHmac|hmac\.compare|timingSafeEqual|compare_digest/i;
const WEBHOOK_ROUTE = /(^|[/_.-])(web)?hooks?([/_.-]|$)|(^|[/_.-])ipn([/_.-]|$)/i;
const EFFECTS = [['email', /resend|sendgrid|nodemailer|smtplib|sendMail|mailgun|postmark/i], ['payment', /stripe|paypal|mollie|adyen/i], ['outbound', /\bfetch\(|axios\.|requests\.(get|post)|httpx\.|HttpClient/], ['db-write', /\b(INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b|\.(insert|create|update|delete|destroy|save)\(/i]];
function trustOf(text) {
  const guards = [];
  if (GUARD_AUTH.test(text)) guards.push('auth');
  if (GUARD_RATE.test(text)) guards.push('rate-limit');
  if (GUARD_TIMING.test(text)) guards.push('timing-safe');
  if (GUARD_SIGNATURE.test(text)) guards.push('signature');
  return { guards, effects: EFFECTS.filter(([, re]) => re.test(text)).map(([n]) => n) };
}

// ---------- security domains, citations ----------

// [id, a dependency name in a manifest, a source line, a file path]. What each domain file needs before it is worth
// loading is in security-domains/<id>.md ("Load when"). These patterns only propose candidates with evidence: the
// run picks a domain by the boundary it names, never by a dependency.
const DOMAINS = [
  ['ai-llm', /^(openai|anthropic|@anthropic-ai\/.+|langchain.*|llama[-_]?index.*|google-generativeai|@google\/genai|@modelcontextprotocol\/.+|ollama|semantic-?kernel.*|litellm|mistralai|azure\.ai\.openai|microsoft\.extensions\.ai.*)$/i,
    /\b(chat\.completions|messages\.create|responses\.create|tool_use|function_call|McpServer|FastMCP)\b/, null],
  ['desktop-ipc', null,
    /NamedPipe(Server|Client)Stream|\bServiceBase\b|\bServiceController\b|UseWindowsService|AddWindowsService|WebView2|AddHostObjectToScript|\bHttpListener\b|requestedExecutionLevel|<UseWPF>\s*true|<OutputType>\s*WinExe|\bipcMain\b|contextBridge|URL Protocol/, null],
  ['web-auth', /^(jsonwebtoken|express-session|next-auth|passport.*|cookie-parser|python-jose|pyjwt|authlib|itsdangerous|microsoft\.aspnetcore\.authentication.*)$/i,
    /\bjwt\.(sign|verify|decode)\(|Set-Cookie|set_cookie\(|\[Authorize\b|login_required|OAuth2PasswordBearer|AUTH_PASSWORD|\bcsrf\b|password_hash|check_password|reset[_-]?token/i, null],
  ['client-side', /^(react|react-dom|next|vue|nuxt|svelte|preact|@angular\/core)$/i,
    /postMessage\(|addEventListener\(\s*['"]message['"]|new WebSocket\(|serviceWorker|localStorage|sessionStorage|dangerouslySetInnerHTML|\.innerHTML\s*=|window\.open\(|chrome\.runtime|"manifest_version"/, null],
  ['data-isolation', null,
    /\b(tenant_?id|org_?id|organi[sz]ation_?id|workspace_?id|owner_?id)\b|ROW LEVEL SECURITY|CREATE POLICY|\bpgvector\b/i, null],
  ['supply-chain-deploy', null,
    /\b(gh release|npm publish|dotnet publish|vpk pack|Squirrel|Velopack|AutoUpdater|ClickOnce|MSIX)\b/,
    /(^|\/)(\.github\/workflows\/|Dockerfile|docker-compose|compose\.ya?ml$|railway\.toml$|startup\.txt$|vercel\.json$|fly\.toml$|azure-pipelines|[^/]+\.(bicep|tf)$)/i],
  ['webhooks-abuse', /^(stripe|svix|multer|formidable|busboy|python-multipart|celery|bullmq|bull|amqplib|pika|kafkajs)$/i,
    /stripe\.webhooks|constructEvent|X-Hub-Signature|stripe-signature|\bUploadFile\b|\bzipfile\.|\btarfile\.|ZipArchive|ExtractToDirectory/, WEBHOOK_ROUTE],
];
const MANIFEST = /(^|\/)(package\.json|requirements[^/]*\.txt|pyproject\.toml|[^/]+\.csproj)$/;

// Files a toolkit sync copied into a project (.claude/toolkit/MANIFEST.json, paths relative to .claude/). They are
// the toolkit, not the project's code: left in scope, their examples would flood every helper with false leads.
function vendoredToolkit(root) {
  try { return new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(root, '.claude', 'toolkit', 'MANIFEST.json'), 'utf8')).files || {}).map((k) => `.claude/${k}`)); } catch { return new Set(); }
}

function cmdDomains(root, args) {
  const spec = parseScope(root, args);
  if (!spec.mode) spec.mode = 'all';
  const r = resolveScope(root, spec);
  const evidence = new Map(DOMAINS.map(([id]) => [id, []]));
  const add = (id, text) => { const e = evidence.get(id); if (e.length < 3) e.push(text); };
  const tracked = isRepo(root) ? lines(git(root, ['ls-files', '--cached', '--others', '--exclude-standard'])) : walkFiles(root);
  for (const mf of tracked.filter((f) => MANIFEST.test(f)).slice(0, 40)) {
    const text = readText(path.join(root, mf));
    if (text === null) continue;
    let names = [];
    if (/package\.json$/.test(mf)) { try { const j = JSON.parse(text); names = Object.keys({ ...j.dependencies, ...j.devDependencies }); } catch { /* not JSON: no names */ } }
    else if (/\.csproj$/.test(mf)) names = [...text.matchAll(/<PackageReference\s+Include="([^"]+)"/g)].map((m) => m[1]);
    else names = text.match(/[A-Za-z0-9_.@/-]+/g) || [];
    for (const [id, dep] of DOMAINS) { const hit = dep && names.find((n) => dep.test(n)); if (hit) add(id, `dependency ${hit} (${mf})`); }
  }
  for (const f of r.files) {
    if (TEST_PATH.test(f.file) || /\.mdx?$/i.test(f.file)) continue; // prose describes plans as well as code
    for (const [id, , , where] of DOMAINS) if (where && where.test(f.file)) add(id, `file ${f.file}`);
    const text = readText(path.join(root, f.file));
    if (text === null) continue;
    text.split(/\r?\n/).forEach((line, i) => {
      if (line.length > 1500) return;
      if (f.ranges && r.mode === 'changes' && !f.ranges.some(([a, b]) => i + 1 >= a && i + 1 <= b)) return;
      for (const [id, , code] of DOMAINS) if (code && evidence.get(id).length < 3 && code.test(line)) add(id, `${f.file}:${i + 1}  ${line.trim().slice(0, 60)}`);
    });
  }
  const rows = DOMAINS.filter(([id]) => evidence.get(id).length).map(([id]) => `  ${id.padEnd(20)} ${evidence.get(id).join('; ')}`);
  if (!rows.length) return 'domains: no candidate found by pattern. Say so and load no domain file; do not assume none applies.';
  return ['domains (candidates; confirm each against the boundary its file names, a dependency name alone is not a reason):', ...rows].join('\n');
}

// A reviewer that cites a line it never read invents a finding. Only extensions that name source or config count,
// so `localhost:3000` and `example.com:443` are not citations. Reads under the project root only.
const CITE_EXT = 'tsx?|jsx?|mjs|cjs|py|cs|csx|xaml|axaml|ps1|psm1|psd1|json|ya?ml|toml|md|sql|html?|css|scss|go|rs|java|kt|swift|rb|php|sh|bat|cmd|csproj|sln|props|targets|razor|cshtml|vue|svelte|ini|cfg|conf|xml|config|tf|bicep|gradle';
const CITE_RE = new RegExp(String.raw`(?<![\w@./\\-])([\w@.\\/-]+\.(?:${CITE_EXT})):(\d+)(?:-(\d+))?(?!\d)`, 'gi');
const lineCount = (text) => { const n = text.split(/\r?\n/).length; return /\n$/.test(text) ? n - 1 : n; };

function citeProblem(root, rel, a, b, cache) {
  const base = path.resolve(root);
  const full = path.resolve(base, rel);
  if (path.isAbsolute(rel) || /^[A-Za-z]:/.test(rel) || !full.startsWith(base + path.sep)) return ['bad', 'outside the project root'];
  if (!cache.has(full)) {
    let n = null; // null: no such file; -1: binary or over 1 MB
    try { if (fs.statSync(full).isFile()) { const t = readText(full); n = t === null ? -1 : lineCount(t); } } catch { /* missing */ }
    cache.set(full, n);
  }
  const n = cache.get(full);
  if (n === null) return ['bad', 'no such file'];
  if (n === -1) return ['skip', 'not checked (binary or over 1 MB)'];
  if (a < 1 || b < a) return ['bad', 'not a valid line range'];
  if (b > n) return ['bad', `line ${b} is past the end (${n} lines)`];
  return null;
}

function cmdCiteCheck(root) {
  const seen = new Set(); const bad = []; const skipped = []; const cache = new Map();
  for (const m of readStdin().matchAll(CITE_RE)) {
    const rel = m[1].replace(/\\/g, '/'); const a = Number(m[2]); const b = m[3] ? Number(m[3]) : a;
    const label = `${rel}:${a}${b !== a ? `-${b}` : ''}`;
    if (seen.has(label)) continue;
    seen.add(label);
    if (seen.size > 2000) break;
    const p = citeProblem(root, rel, a, b, cache);
    if (p) (p[0] === 'bad' ? bad : skipped).push(`  ${label}  ${p[1]}`);
  }
  if (!seen.size) return 'cite-check: no path:line citations found in the input';
  return [`cite-check: ${seen.size} citation(s), ${seen.size - bad.length - skipped.length} resolved, ${bad.length} unresolved${skipped.length ? `, ${skipped.length} not checked` : ''}`, ...bad, ...skipped].join('\n');
}

function cmdDependents(root, args) {
  const targets = positional(args);
  if (!targets.length) throw new Error('dependents needs at least one file');
  const sources = allFiles(root).filter((f) => /\.(m?[jt]sx?|vue|svelte|astro|py|cs|ps1|psm1)$/i.test(f));
  const out = [];
  for (const t of targets) {
    const stem = path.basename(t).replace(/\.[^.]+$/, '');
    const esc = stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = /\.(m?[jt]sx?|vue|svelte|astro)$/i.test(t) ? new RegExp(`['"]\\.{1,2}/(?:[^'"]*/)?${esc}(?:\\.[a-z]+)?['"]`)
      : /\.py$/i.test(t) ? new RegExp(`\\b(from|import)\\s+[\\w.]*\\b${esc}\\b`)
        : new RegExp(`\\b${esc}\\b`);
    if (/\.cs$/i.test(t) && stem.length < 5) { out.push(`${t}: name too short to search by identifier; skipped`); continue; }
    const imp = [];
    for (const f of sources) {
      if (f === t.replace(/\\/g, '/') || TEST_PATH.test(f)) continue;
      const text = readText(path.join(root, f));
      if (text !== null && re.test(text)) imp.push(f);
    }
    out.push(`${t}  <-  ${imp.length ? imp.slice(0, 12).join(', ') + (imp.length > 12 ? `, +${imp.length - 12} more` : '') : 'no importers found (dead-code candidate; check dynamic imports and entry points)'}`);
  }
  return ['direct importers (heuristic by import path or identifier):', ...out].join('\n');
}

// ---------- names (renames still cited), doclinks, tests-map, coverage, history ----------

function changeBase(root, spec) {
  const base = spec.ref ? { name: spec.ref, mergeBase: (git(root, ['merge-base', spec.ref, 'HEAD'], { allowFail: true }) || spec.ref).trim() } : detectBase(root);
  return { base, against: base ? base.mergeBase : 'HEAD' };
}
const GENERIC = new Set(['index.ts', 'index.js', 'index.tsx', 'index.html', 'readme.md', 'package.json', 'main.py', '__init__.py', 'program.cs', 'app.tsx', 'app.ts', 'styles.css', 'claude.md']);

function cmdNames(root, args) {
  const spec = parseScope(root, args.includes('--all') ? [] : (args.some((a) => a === '--changes' || a === '--commit' || a === '--session' || a === '--ref') ? args : ['--changes', ...args]));
  if (!isRepo(root)) throw new Error('names needs a git repository');
  const { against } = changeBase(root, spec);
  const status = lines(git(root, ['diff', '-M', '--name-status', '--no-color', against, '--'], { allowFail: true }));
  const added = new Set([...status.filter((l) => l.startsWith('A')).map((l) => l.split('\t')[1]), ...lines(git(root, ['ls-files', '--others', '--exclude-standard']))]);
  const gone = [];
  for (const l of status) {
    const c = l.split('\t');
    if (c[0].startsWith('R')) gone.push({ old: c[1], now: c[2], kind: 'renamed' });
    else if (c[0] === 'D') {
      const same = [...added].find((a) => path.basename(a) === path.basename(c[1]));
      gone.push({ old: c[1], now: same || null, kind: same ? 'moved' : 'deleted' });
    }
  }
  if (!gone.length) return 'names: nothing was renamed, moved or deleted in this scope. (Renamed functions, variables and env vars cannot be seen here: read the diff for those.)';
  const out = ['renamed, moved or deleted files, and where the old name is still cited (leads for the docs lens):'];
  for (const g of gone) {
    const name = path.basename(g.old);
    if (name.length < 5 || GENERIC.has(name.toLowerCase())) { out.push(`${g.kind}: ${g.old}${g.now ? ` -> ${g.now}` : ''}  (name too generic to search; skipped)`); continue; }
    const hits = lines(git(root, ['grep', '-n', '-I', '-F', '-e', name, '--'], { allowFail: true })).filter((h) => !h.startsWith(`${g.old}:`));
    out.push(`${g.kind}: ${g.old}${g.now ? ` -> ${g.now}` : ''}  ${hits.length} reference(s)`);
    hits.slice(0, 6).forEach((h) => out.push(`    ${h.slice(0, 140)}`));
    if (hits.length > 6) out.push(`    +${hits.length - 6} more`);
  }
  return out.join('\n');
}

const slug = (h) => h.trim().toLowerCase().replace(/<[^>]+>/g, '').replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');

function cmdDoclinks(root, args) {
  const given = positional(args);
  const docs = (given.length ? allFiles(root).filter(pathMatcher(given)) : allFiles(root)).filter((f) => /\.md$/i.test(f));
  const problems = [];
  const pj = readText(path.join(root, 'package.json'));
  let scripts = {};
  try { scripts = JSON.parse(pj || '{}').scripts || {}; } catch { /* ignore */ }
  const headingsOf = (file) => { const t = readText(path.join(root, file)) || ''; const s = new Set(); let fence = false; for (const l of t.split(/\r?\n/)) { if (/^```/.test(l)) fence = !fence; const m = !fence && /^#{1,6}\s+(.*)$/.exec(l); if (m) s.add(slug(m[1])); } return s; };
  for (const d of docs) {
    const text = readText(path.join(root, d));
    if (text === null) continue;
    let fence = false;
    text.split(/\r?\n/).forEach((line, i) => {
      if (/^\s*```/.test(line)) { fence = !fence; return; }
      if (fence) return;
      for (const m of line.matchAll(/\]\(([^)\s]+)\)/g)) {
        const target = m[1];
        if (/^(https?:|mailto:|tel:|<)/i.test(target)) continue;
        const [p, anchor] = target.split('#');
        const base = p ? path.posix.join(path.posix.dirname(d), decodeURI(p)) : d;
        if (p && !fs.existsSync(path.join(root, base))) { problems.push(`${d}:${i + 1}  broken link: ${target}`); continue; }
        if (anchor && /\.md$/i.test(base) && !headingsOf(base).has(anchor.toLowerCase())) problems.push(`${d}:${i + 1}  no heading for anchor: ${target}`);
      }
      for (const m of line.matchAll(/`npm (?:run )?([\w:-]+)`/g)) if (pj && m[1] !== 'install' && m[1] !== 'ci' && m[1] !== 'test' && m[1] !== 'start' && !(m[1] in scripts)) problems.push(`${d}:${i + 1}  \`npm run ${m[1]}\` is not a script in package.json`);
    });
  }
  if (!problems.length) return `doclinks: ${docs.length} markdown file(s) checked, no broken relative links, anchors or npm run targets`;
  return [`doclinks: ${problems.length} problem(s) in ${docs.length} markdown file(s)`, ...problems.slice(0, 80), problems.length > 80 ? `+${problems.length - 80} more` : ''].filter(Boolean).join('\n');
}

function cmdTestsMap(root, args) {
  const spec = parseScope(root, args.some((a) => a === '--all' || a === '--changes' || a === '--commit' || a === '--session' || a === '--ref') ? args : ['--changes', ...args]);
  const r = resolveScope(root, spec);
  const all = allFiles(root);
  const tests = all.filter((f) => TEST_PATH.test(f));
  const out = [];
  let none = 0;
  for (const f of r.files) {
    if (TEST_PATH.test(f.file) || !/\.(m?[jt]sx?|py|cs|go|ps1|rs|java|kt|php|rb)$/i.test(f.file)) continue;
    const stem = path.basename(f.file).replace(/\.[^.]+$/, '');
    const cands = tests.filter((t) => {
      const b = path.basename(t).replace(/\.[^.]+$/, '');
      return b === `${stem}.test` || b === `${stem}.spec` || b === `test_${stem}` || b === `${stem}_test` || b === `${stem}Tests` || b === `${stem}Test` || b === `${stem}.Tests`;
    });
    const refs = cands.length ? [] : tests.filter((t) => { const x = readText(path.join(root, t)); return x !== null && new RegExp(`['"][^'"]*\\b${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`).test(x); });
    const found = [...cands, ...refs];
    if (!found.length) none++;
    out.push(`${f.file}  ->  ${found.length ? found.slice(0, 4).join(', ') : 'NO TEST FILE FOUND'}${f.ranges && r.mode === 'changes' ? `  (changed lines ${fmtRanges(f.ranges)})` : ''}`);
  }
  if (!out.length) return 'tests-map: no source files in scope';
  return [`tests-map: ${out.length} source file(s), ${none} with no test file found (by name or import; a test may still cover it indirectly)`, ...out].join('\n');
}

function parseLcov(text) {
  const map = new Map(); let cur = null;
  for (const l of text.split(/\r?\n/)) {
    if (l.startsWith('SF:')) { cur = new Map(); map.set(l.slice(3).replace(/\\/g, '/'), cur); } else if (l.startsWith('DA:') && cur) { const [n, h] = l.slice(3).split(','); cur.set(Number(n), Number(h)); } else if (l === 'end_of_record') cur = null;
  }
  return map;
}
function parseCobertura(text) {
  const map = new Map();
  for (const c of text.matchAll(/<class\b[^>]*filename="([^"]+)"[\s\S]*?<\/class>/g)) {
    const m = new Map();
    for (const l of c[0].matchAll(/<line\b[^>]*number="(\d+)"[^>]*hits="(\d+)"/g)) m.set(Number(l[1]), Number(l[2]));
    map.set(c[1].replace(/\\/g, '/'), m);
  }
  return map;
}

function cmdCoverage(root, args) {
  const spec = parseScope(root, args.some((a) => a === '--changes' || a === '--commit' || a === '--session' || a === '--ref') ? args : ['--changes', ...args]);
  const cands = ['coverage/lcov.info', 'lcov.info', 'coverage.lcov', 'coverage/cobertura-coverage.xml', 'coverage.xml', 'cobertura.xml'];
  const rep = cands.find((c) => fs.existsSync(path.join(root, c)));
  if (!rep) return 'coverage: no existing report found (looked for lcov.info and Cobertura xml). Say so; do not run the tests with coverage unasked.';
  const text = readText(path.join(root, rep)) || '';
  const map = /<coverage\b/.test(text) ? parseCobertura(text) : parseLcov(text);
  const r = resolveScope(root, spec);
  const out = [`coverage report: ${rep} (modified ${new Date(fs.statSync(path.join(root, rep)).mtime).toISOString().slice(0, 10)}; if older than the changes it says nothing about them)`];
  for (const f of r.files) {
    const key = [...map.keys()].find((k) => k.endsWith(f.file) || f.file.endsWith(k));
    if (!key) { out.push(`${f.file}: not in the report`); continue; }
    const da = map.get(key);
    let exec = 0; let hit = 0;
    for (const [a, b] of f.ranges || [[1, f.lines]]) for (let n = a; n <= b; n++) if (da.has(n)) { exec++; if (da.get(n) > 0) hit++; }
    out.push(`${f.file}: ${exec ? `${hit}/${exec} changed executable lines covered (${Math.round((hit / exec) * 100)}%)` : 'no executable changed lines in the report'}`);
  }
  return out.join('\n');
}

function cmdHistory(root, args) {
  if (!isRepo(root)) throw new Error('history needs a git repository');
  const ni = args.indexOf('--n');
  const n = ni >= 0 ? Number(args[ni + 1]) : 300;
  const ere = 'AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30}|sk-[A-Za-z0-9_-]{20}|[sr]k_live_[A-Za-z0-9]{20}|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY';
  const log = git(root, ['log', '-n', String(n), '-G', ere, '-p', '--no-color', '--pretty=format:@@%h%x09%s'], { allowFail: true }) || '';
  const shapes = [['aws-key', /AKIA[0-9A-Z]{16}/], ['github-token', /ghp_[A-Za-z0-9]{30}/], ['api-key-sk', /sk-[A-Za-z0-9_-]{20}/], ['stripe-live-key', /[sr]k_live_[A-Za-z0-9]{20}/], ['private-key', /BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/]];
  const rows = []; let commit = ''; let file = '';
  for (const l of log.split(/\r?\n/)) {
    if (l.startsWith('@@')) { commit = l.slice(2).split('\t')[0]; continue; }
    const f = /^\+\+\+ b\/(.+)$/.exec(l); if (f) { file = f[1]; continue; }
    if (!l.startsWith('+') || l.startsWith('+++')) continue;
    for (const [kind, re] of shapes) if (re.test(l)) rows.push(`${commit}  ${file}  ${kind}`);
  }
  const envAdds = lines(git(root, ['log', '-n', String(n), '--diff-filter=A', '--name-only', '--pretty=format:@@%h', '--', '.env', '*/.env', '.env.*', '*/.env.*'], { allowFail: true })).reduce((acc, l) => { if (l.startsWith('@@')) acc.c = l.slice(2); else if (!ENV_EXAMPLE.test(l)) acc.rows.push(`${acc.c}  ${l}  env-file-added`); return acc; }, { c: '', rows: [] }).rows;
  const all = [...new Set([...rows, ...envAdds])];
  if (!all.length) return `history: nothing matching a known secret shape in the last ${n} commits (known shapes only; this is not proof there is no secret)`;
  return [`history: ${all.length} lead(s) in the last ${n} commits (values are never printed; rotate anything real, a history rewrite is a separate, authorised step)`, ...all.slice(0, 60), all.length > 60 ? `+${all.length - 60} more` : ''].filter(Boolean).join('\n');
}

// ---------- probe: a passive live check of a running server ----------
// What a diff review cannot see: what the server actually sends. GET and OPTIONS only, one request at a time
// (about 22 in all), no redirects followed, no body, no credentials, no attack payload. Cookie values and
// response bodies are never printed. The judging is in pure functions so every rule is self-tested without a
// network. Check ideas from Penthera (MIT, danoszz), rebuilt on node:http/tls; its CLI and payload modes are not used.

const LOOPBACK_HOST = /^(localhost|127(\.\d+){3}|\[?::1\]?)$/i;
const PROBE_TIMEOUT = 5000;
const EVIL_ORIGIN = 'https://probe.invalid';
const SESSION_COOKIE = /sess|token|auth|jwt|sid/i;
const STACK_TRACE = /Traceback \(most recent call last\)|Werkzeug Debugger|\bat [\w.$<>]+ \((\/|[A-Za-z]:\\|file:)[^)\n]*:\d+:\d+\)|node_modules[\\/]|System\.[\w.]+Exception|Exception in thread|\.java:\d+\)|SQLSTATE\[|Whitelabel Error Page/;
// [path, is a secret or source (always a fail), shape the body must have to count]
const PROBE_PATHS = [
  ['/.env', true, (b, h) => !/html/.test(h) && /^[A-Z][A-Z0-9_]*\s*=/m.test(b)],
  ['/.env.local', true, (b, h) => !/html/.test(h) && /^[A-Z][A-Z0-9_]*\s*=/m.test(b)],
  ['/.env.production', true, (b, h) => !/html/.test(h) && /^[A-Z][A-Z0-9_]*\s*=/m.test(b)],
  ['/.git/HEAD', true, (b) => /^ref: refs\//.test(b)],
  ['/.git/config', true, (b) => /\[core\]/.test(b)],
  ['/serviceAccountKey.json', true, (b) => /"private_key"/.test(b) && /"client_email"/.test(b)],
  ['/service-account.json', true, (b) => /"private_key"/.test(b) && /"client_email"/.test(b)],
  ['/_next/static/chunks/main.js.map', false, (b) => /"sources"\s*:/.test(b) && /"mappings"/.test(b)],
  ['/openapi.json', false, (b) => /"(openapi|swagger)"\s*:/.test(b)],
  ['/swagger.json', false, (b) => /"(openapi|swagger)"\s*:/.test(b)],
  ['/api/openapi.json', false, (b) => /"(openapi|swagger)"\s*:/.test(b)],
  ['/docs', false, (b, h) => /html/.test(h) && /swagger|openapi|redoc|rapidoc/i.test(b)],
  ['/redoc', false, (b, h) => /html/.test(h) && /swagger|openapi|redoc|rapidoc/i.test(b)],
  ['/swagger', false, (b, h) => /html/.test(h) && /swagger|openapi|redoc|rapidoc/i.test(b)],
  ['/api/docs', false, (b, h) => /html/.test(h) && /swagger|openapi|redoc|rapidoc/i.test(b)],
];

function judgeHeaders(h, { https, loopback }) {
  const out = [];
  const miss = loopback ? 'lead' : 'fail';
  const csp = String(h['content-security-policy'] || '');
  out.push(csp ? ['pass', 'header:csp', 'Content-Security-Policy is set'] : [miss, 'header:csp', 'no Content-Security-Policy']);
  out.push(/frame-ancestors/i.test(csp) || h['x-frame-options'] ? ['pass', 'header:framing', 'framing is restricted'] : [miss, 'header:framing', 'no frame-ancestors or X-Frame-Options']);
  out.push(/nosniff/i.test(String(h['x-content-type-options'] || '')) ? ['pass', 'header:nosniff', 'X-Content-Type-Options: nosniff'] : [miss, 'header:nosniff', 'no X-Content-Type-Options: nosniff']);
  out.push(h['referrer-policy'] ? ['pass', 'header:referrer-policy', 'Referrer-Policy is set'] : [miss, 'header:referrer-policy', 'no Referrer-Policy']);
  if (https) out.push(h['strict-transport-security'] ? ['pass', 'header:hsts', 'Strict-Transport-Security is set'] : [miss, 'header:hsts', 'no Strict-Transport-Security']);
  else out.push(loopback ? ['n/a', 'transport:cleartext', 'http on loopback'] : ['fail', 'transport:cleartext', 'a non-loopback target answered over plain http']);
  const fp = [h['x-powered-by'] ? `X-Powered-By: ${h['x-powered-by']}` : '', /\d+\.\d+/.test(String(h.server || '')) ? `Server: ${h.server}` : ''].filter(Boolean);
  out.push(fp.length ? ['lead', 'header:fingerprint', fp.join('; ')] : ['pass', 'header:fingerprint', 'no framework or version header']);
  return out;
}

function judgeCookies(setCookie, { https }) {
  return (setCookie || []).map((c) => {
    const parts = String(c).split(';').map((s) => s.trim());
    const name = parts[0].split('=')[0];
    const attrs = parts.slice(1).map((a) => a.toLowerCase());
    const missing = [];
    if (!attrs.includes('httponly')) missing.push('HttpOnly');
    if (!attrs.some((a) => a.startsWith('samesite'))) missing.push('SameSite');
    if (https && !attrs.includes('secure')) missing.push('Secure');
    if (!missing.length) return ['pass', `cookie:${name}`, 'HttpOnly, SameSite set'];
    return [SESSION_COOKIE.test(name) ? 'fail' : 'lead', `cookie:${name}`, `missing ${missing.join(', ')}`];
  });
}

function judgeCors({ evil, nul, pre, loopback }) {
  const out = [];
  const acao = (r) => (r && r.headers && r.headers['access-control-allow-origin']) || '';
  const acac = (r) => String((r && r.headers && r.headers['access-control-allow-credentials']) || '').toLowerCase() === 'true';
  let bad = null;
  for (const [r, label] of [[evil, 'GET'], [pre, 'preflight']]) {
    if (!r || r.error) continue;
    if (acao(r) === EVIL_ORIGIN) bad = bad || `${label} echoes an arbitrary Origin${acac(r) ? ' together with credentials' : ''}`;
    else if (acao(r) === '*' && acac(r)) bad = bad || `${label} sends * together with credentials`;
  }
  if (bad) out.push(['fail', 'cors:origin', bad]);
  else if (acao(evil) === '*') out.push(['lead', 'cors:origin', 'Access-Control-Allow-Origin: * (fine for a public API, not for one with cookies)']);
  else out.push(['pass', 'cors:origin', 'no arbitrary Origin echoed']);
  out.push(acao(nul) === 'null' ? ['fail', 'cors:null', 'trusts the null Origin'] : ['pass', 'cors:null', 'the null Origin is not trusted']);
  if (loopback && evil && !evil.error) out.push(evil.status >= 400 ? ['pass', 'origin:foreign', `a foreign Origin was refused (${evil.status})`] : ['lead', 'origin:foreign', `a foreign Origin was accepted (${evil.status}); base rule: loopback tools reject non-loopback Origin`]);
  return out;
}

function judgeExposure(p, secret, shape, res, loopback) {
  if (!res || res.error || res.status !== 200) return null;
  if (!shape(res.body, String(res.headers['content-type'] || '').toLowerCase())) return null;
  return [secret || !loopback ? 'fail' : 'lead', `exposed:${p}`, secret ? 'served, and the body has the shape of the real file' : 'served in a form an outsider can read'];
}

function judgeErrorBody(res) {
  if (!res || res.error) return ['unavailable', 'error:leak', 'no answer'];
  return STACK_TRACE.test(res.body) ? ['fail', 'error:leak', `the ${res.status} page for an unknown path shows a stack trace or framework error`] : ['pass', 'error:leak', 'the page for an unknown path shows no internals'];
}

function judgeTls(i, now = Date.now()) {
  if (i.error) return [['unavailable', 'tls:handshake', `no handshake (${i.error})`]];
  const out = [];
  out.push(i.authorized ? ['pass', 'tls:trust', 'certificate chain is trusted'] : ['fail', 'tls:trust', `certificate not trusted (${i.authError || 'unknown'}); owner action`]);
  const days = Number.isFinite(i.validTo) ? Math.floor((i.validTo - now) / 86400000) : null;
  if (days === null) out.push(['unavailable', 'tls:expiry', 'no expiry date']);
  else if (days < 0) out.push(['fail', 'tls:expiry', `certificate expired ${-days} day(s) ago; owner action`]);
  else if (days < 30) out.push(['lead', 'tls:expiry', `certificate expires in ${days} day(s); owner action`]);
  else out.push(['pass', 'tls:expiry', `certificate valid for ${days} more day(s)`]);
  out.push(/^(SSLv3|TLSv1|TLSv1\.1)$/.test(i.protocol || '') ? ['fail', 'tls:protocol', `negotiated ${i.protocol}; owner action`] : ['pass', 'tls:protocol', `negotiated ${i.protocol || 'unknown'}`]);
  return out;
}

function judgeBind(netstat, port) {
  const addrs = [];
  for (const l of netstat.split(/\r?\n/)) {
    const m = /^\s*TCP\s+(\[[^\]]+\]|[\d.]+):(\d+)\s+\S+\s+LISTENING/i.exec(l);
    if (m && Number(m[2]) === port) addrs.push(m[1]);
  }
  if (!addrs.length) return ['unavailable', 'bind:listen', `nothing listening on port ${port} was found`];
  const wide = addrs.filter((a) => a === '0.0.0.0' || a === '[::]');
  return wide.length ? ['fail', 'bind:listen', `listening on ${wide.join(', ')}: reachable from the LAN; base rule: loopback only unless a platform injects PORT`] : ['pass', 'bind:listen', `listening on ${addrs.join(', ')} only`];
}

function probeRequest(u, { method = 'GET', pathname = '/', headers = {} } = {}) {
  return new Promise((resolve) => {
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request({ hostname: u.hostname.replace(/^\[|\]$/g, ''), port: u.port || undefined, path: pathname, method, timeout: PROBE_TIMEOUT, rejectUnauthorized: false, headers: { 'user-agent': 'code-probe/1', accept: '*/*', connection: 'close', ...headers } }, (res) => {
      const chunks = []; let size = 0;
      const done = () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') });
      res.on('data', (c) => { size += c.length; if (size <= 65536) chunks.push(c); else res.destroy(); });
      res.on('end', done); res.on('close', done);
    });
    req.on('timeout', () => { req.destroy(); resolve({ error: 'timeout' }); });
    req.on('error', (e) => resolve({ error: e.code || e.message }));
    req.end();
  });
}

function probeTls(host, port) {
  return new Promise((resolve) => {
    const s = tls.connect({ host, port, servername: net.isIP(host) ? undefined : host, rejectUnauthorized: false, timeout: PROBE_TIMEOUT }, () => {
      const c = s.getPeerCertificate();
      resolve({ authorized: s.authorized, authError: s.authorizationError ? String(s.authorizationError) : '', protocol: s.getProtocol(), validTo: c && c.valid_to ? Date.parse(c.valid_to) : NaN });
      s.end();
    });
    s.on('error', (e) => resolve({ error: e.code || e.message }));
    s.on('timeout', () => { s.destroy(); resolve({ error: 'timeout' }); });
  });
}

async function cmdProbe(_root, args) {
  const raw = positional(args)[0];
  if (!raw) throw new Error('probe needs a URL: probe <url> [--owned]');
  let u;
  try { u = new URL(raw); } catch { throw new Error(`probe: not a URL: ${raw}`); }
  if (!/^https?:$/.test(u.protocol)) throw new Error('probe: only http and https URLs');
  const loopback = LOOPBACK_HOST.test(u.hostname);
  if (!loopback && !args.includes('--owned')) throw new Error(`probe: ${u.hostname} is not on this machine. Ask the user to confirm they own it, then add --owned. Nothing was sent.`);
  const https_ = u.protocol === 'https:';
  const base = await probeRequest(u);
  if (base.error) return `probe ${u.origin}: nothing answered (${base.error}). The live check is unavailable, not passed: the server is not running or not at that address. Do not start it to probe it.`;
  const rows = [];
  rows.push(...judgeHeaders(base.headers, { https: https_, loopback }));
  rows.push(...judgeCookies(base.headers['set-cookie'], { https: https_ }));
  if (loopback) {
    const fh = await probeRequest(u, { headers: { host: 'probe.invalid' } });
    rows.push(fh.error ? ['unavailable', 'host:foreign', fh.error] : fh.status >= 400 ? ['pass', 'host:foreign', `a foreign Host was refused (${fh.status})`] : ['fail', 'host:foreign', `a foreign Host was accepted (${fh.status}); base rule: loopback tools reject non-loopback Host (DNS rebinding)`]);
  }
  const evil = await probeRequest(u, { headers: { origin: EVIL_ORIGIN } });
  const nul = await probeRequest(u, { headers: { origin: 'null' } });
  const pre = await probeRequest(u, { method: 'OPTIONS', headers: { origin: EVIL_ORIGIN, 'access-control-request-method': 'GET' } });
  rows.push(...judgeCors({ evil, nul, pre, loopback }));
  for (const [p, secret, shape] of PROBE_PATHS) {
    const row = judgeExposure(p, secret, shape, await probeRequest(u, { pathname: p }), loopback);
    if (row) rows.push(row);
  }
  rows.push(judgeErrorBody(await probeRequest(u, { pathname: `/code-probe-${crypto.randomBytes(4).toString('hex')}` })));
  if (https_) rows.push(...judgeTls(await probeTls(u.hostname.replace(/^\[|\]$/g, ''), Number(u.port) || 443)));
  const port = Number(u.port) || (https_ ? 443 : 80);
  if (loopback && process.platform === 'win32') {
    let ns = '';
    try { ns = ['TCP', 'TCPv6'].map((p) => execFileSync('netstat', ['-ano', '-p', p], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })).join('\n'); } catch { /* reported below */ }
    rows.push(ns ? judgeBind(ns, port) : ['unavailable', 'bind:listen', 'netstat could not run']);
  } else if (loopback) rows.push(['unavailable', 'bind:listen', 'the bind check needs Windows netstat']);
  const fails = rows.filter((r) => r[0] === 'fail').length;
  return [`probe ${u.origin} (${loopback ? 'this machine' : 'owner-confirmed'}): ${fails} fail, ${rows.filter((r) => r[0] === 'lead').length} lead, ${rows.filter((r) => r[0] === 'pass').length} pass`,
    ...rows.map(([s, c, n]) => `${s.padEnd(11)} ${c.padEnd(26)} ${n}`),
    'These are observed facts, not verdicts: severity is the lens\'s call (a loopback-only tool needs no CSP). A failure with "owner action" is fixed in hosting or DNS, not in code. Nothing here proves the server is secure.'].join('\n');
}

async function probeSelfTest() {
  const ok = (name, fn) => { try { fn(); } catch (e) { e.message = `probe ${name}: ${e.message}`; throw e; } };
  const rowOf = (rows, id) => rows.find((r) => r[1] === id);
  const state = (rows, id) => (rowOf(rows, id) || [])[0];
  ok('judgeHeaders', () => {
    const good = judgeHeaders({ 'content-security-policy': "default-src 'self'; frame-ancestors 'none'", 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'strict-transport-security': 'max-age=1' }, { https: true, loopback: false });
    assert.ok(good.every((r) => r[0] === 'pass'), JSON.stringify(good));
    const bad = judgeHeaders({ 'x-powered-by': 'Express', server: 'nginx/1.18.0' }, { https: false, loopback: false });
    assert.equal(state(bad, 'header:csp'), 'fail'); assert.equal(state(bad, 'transport:cleartext'), 'fail'); assert.equal(state(bad, 'header:fingerprint'), 'lead');
    assert.equal(state(judgeHeaders({}, { https: false, loopback: true }), 'header:csp'), 'lead', 'loopback downgrades a missing header to a lead');
  });
  ok('judgeCookies', () => {
    const c = judgeCookies(['sid=abc; Path=/', 'theme=dark; HttpOnly; SameSite=Lax', 'jwt=x; HttpOnly; SameSite=Strict'], { https: true });
    assert.equal(state(c, 'cookie:sid'), 'fail'); assert.equal(state(c, 'cookie:theme'), 'lead'); assert.match(rowOf(c, 'cookie:jwt')[2], /Secure/);
    assert.ok(!JSON.stringify(c).includes('abc'), 'a cookie value is never printed');
  });
  ok('judgeCors', () => {
    const r = (h, status = 200) => ({ status, headers: h });
    const echoed = judgeCors({ evil: r({ 'access-control-allow-origin': EVIL_ORIGIN, 'access-control-allow-credentials': 'true' }), nul: r({ 'access-control-allow-origin': 'null' }), pre: r({}), loopback: false });
    assert.equal(state(echoed, 'cors:origin'), 'fail'); assert.equal(state(echoed, 'cors:null'), 'fail');
    assert.equal(state(judgeCors({ evil: r({ 'access-control-allow-origin': '*', 'access-control-allow-credentials': 'true' }), nul: r({}), pre: r({}), loopback: false }), 'cors:origin'), 'fail');
    assert.equal(state(judgeCors({ evil: r({ 'access-control-allow-origin': '*' }), nul: r({}), pre: r({}), loopback: false }), 'cors:origin'), 'lead');
    assert.equal(state(judgeCors({ evil: r({}, 403), nul: r({}, 403), pre: r({}, 403), loopback: true }), 'origin:foreign'), 'pass');
  });
  ok('judgeExposure and judgeErrorBody', () => {
    const [envPath, envSecret, envShape] = PROBE_PATHS[0];
    const res = (body, ct = 'text/plain') => ({ status: 200, headers: { 'content-type': ct }, body });
    assert.equal(judgeExposure(envPath, envSecret, envShape, res('DB_URL=postgres://x\nKEY=1'), true)[0], 'fail');
    assert.equal(judgeExposure(envPath, envSecret, envShape, res('<html>app</html>', 'text/html'), false), null, 'an SPA fallback is not an exposed file');
    const [docPath, docSecret, docShape] = PROBE_PATHS.find((p) => p[0] === '/openapi.json');
    assert.equal(judgeExposure(docPath, docSecret, docShape, res('{"openapi":"3.0.0"}', 'application/json'), true)[0], 'lead', 'loopback downgrades docs');
    assert.equal(judgeExposure(docPath, docSecret, docShape, res('{"openapi":"3.0.0"}', 'application/json'), false)[0], 'fail');
    assert.equal(judgeErrorBody({ status: 500, headers: {}, body: 'Traceback (most recent call last):\n  File "x.py"' })[0], 'fail');
    assert.equal(judgeErrorBody({ status: 404, headers: {}, body: 'Not found' })[0], 'pass');
  });
  ok('judgeTls', () => {
    const now = Date.parse('2026-01-01');
    assert.equal(state(judgeTls({ authorized: true, protocol: 'TLSv1.3', validTo: now + 90 * 86400000 }, now), 'tls:expiry'), 'pass');
    assert.equal(state(judgeTls({ authorized: true, protocol: 'TLSv1.3', validTo: now + 10 * 86400000 }, now), 'tls:expiry'), 'lead');
    assert.equal(state(judgeTls({ authorized: true, protocol: 'TLSv1.3', validTo: now - 86400000 }, now), 'tls:expiry'), 'fail');
    assert.equal(state(judgeTls({ authorized: false, authError: 'CERT_HAS_EXPIRED', protocol: 'TLSv1', validTo: now + 90 * 86400000 }, now), 'tls:trust'), 'fail');
    assert.equal(state(judgeTls({ authorized: true, protocol: 'TLSv1.1', validTo: now + 90 * 86400000 }, now), 'tls:protocol'), 'fail');
  });
  ok('judgeBind', () => {
    const ns = '  TCP    0.0.0.0:3000    0.0.0.0:0    LISTENING    11\n  TCP    127.0.0.1:4000    0.0.0.0:0    LISTENING    12\n  TCP    [::]:5000    [::]:0    LISTENING    13\n  TCP    127.0.0.1:6000    127.0.0.1:1    ESTABLISHED    14';
    assert.equal(judgeBind(ns, 3000)[0], 'fail'); assert.equal(judgeBind(ns, 4000)[0], 'pass'); assert.equal(judgeBind(ns, 5000)[0], 'fail');
    assert.equal(judgeBind(ns, 6000)[0], 'unavailable', 'an established connection is not a listener');
  });

  // the gate: a foreign URL is refused before any request is made
  await assert.rejects(() => cmdProbe('.', ['https://example.com']), /not on this machine/);
  await assert.rejects(() => cmdProbe('.', ['ftp://localhost']), /only http and https/);

  const listen = (handler) => new Promise((resolve) => { const s = http.createServer(handler); s.listen(0, '127.0.0.1', () => resolve(s)); });
  const bad = await listen((req, res) => {
    const h = { 'x-powered-by': 'Express', 'set-cookie': 'sid=abc123secret; Path=/', 'access-control-allow-origin': req.headers.origin || '*', 'access-control-allow-credentials': 'true' };
    if (req.url === '/openapi.json') { res.writeHead(200, { ...h, 'content-type': 'application/json' }); return res.end('{"openapi":"3.0.0"}'); }
    if (req.url === '/.git/HEAD') { res.writeHead(200, { ...h, 'content-type': 'text/plain' }); return res.end('ref: refs/heads/main\n'); }
    if (req.url === '/') { res.writeHead(200, { ...h, 'content-type': 'text/html' }); return res.end('<html>ok</html>'); }
    res.writeHead(404, { ...h, 'content-type': 'text/plain' }); res.end('Traceback (most recent call last):\n  File "app.py", line 3');
  });
  const good = await listen((req, res) => {
    const host = String(req.headers.host || '').split(':')[0];
    const sec = { 'content-security-policy': "default-src 'self'; frame-ancestors 'none'", 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' };
    if (host !== '127.0.0.1' && host !== 'localhost') { res.writeHead(403, sec); return res.end('invalid host'); }
    if (req.headers.origin) { res.writeHead(403, sec); return res.end('blocked'); }
    res.writeHead(200, { ...sec, 'content-type': 'text/html' }); res.end('<html>spa fallback for every path</html>');
  });
  try {
    const badOut = await cmdProbe('.', [`http://127.0.0.1:${bad.address().port}`]);
    ok('bad server', () => {
      assert.match(badOut, /fail\s+cors:origin/); assert.match(badOut, /fail\s+cors:null/); assert.match(badOut, /fail\s+host:foreign/);
      assert.match(badOut, /fail\s+cookie:sid/); assert.match(badOut, /lead\s+header:fingerprint/); assert.match(badOut, /fail\s+exposed:\/\.git\/HEAD/);
      assert.match(badOut, /lead\s+exposed:\/openapi\.json/); assert.match(badOut, /fail\s+error:leak/);
      assert.doesNotMatch(badOut, /abc123secret/, 'a cookie value is never printed');
      if (process.platform === 'win32') assert.match(badOut, /pass\s+bind:listen/, 'a 127.0.0.1 listener is loopback only');
    });
    const goodOut = await cmdProbe('.', [`http://127.0.0.1:${good.address().port}`]);
    ok('good server', () => {
      assert.match(goodOut, /pass\s+header:csp/); assert.match(goodOut, /pass\s+host:foreign/); assert.match(goodOut, /pass\s+cors:origin/);
      assert.match(goodOut, /pass\s+error:leak/); assert.doesNotMatch(goodOut, /^(fail|lead)\s+exposed:/m, 'an SPA fallback is not an exposed file');
      assert.doesNotMatch(goodOut, /^fail/m);
    });
    const closed = await listen((req, res) => res.end());
    const closedPort = closed.address().port;
    await new Promise((resolve) => closed.close(resolve));
    const down = await cmdProbe('.', [`http://127.0.0.1:${closedPort}`]);
    ok('nothing listening', () => assert.match(down, /unavailable, not passed/));
  } finally { bad.close(); good.close(); }
}

// ---------- run ledger: runs that survive a usage limit ----------
// A review can be cut off by a usage limit. The ledger keeps every finished unit on disk, so a resume
// dispatches only what is missing. A unit is one agent run: a shard crossed with one lens, or (bundled) with
// one agent type's lens group. This is the only part of the helper that writes, and it writes only inside the
// state directory (%LOCALAPPDATA%\claude-code-review, or $CODE_REVIEW_STATE), never in the repo: SyncProjects
// auto-commits a dirty tree, so state inside a repo would be committed.
//
// A lens unit's result is stored under a hash of everything that could change it: the lens files,
// review-core.md, the project's CLAUDE.md and REVIEW.md, and the shard's file contents and changed ranges. A
// result is reused (across a resume and across runs) only while all of that is unchanged, and for REUSE_DAYS.
// The shared-context file and the leads are deliberately not in the key: they derive from the same files.

const LENS_ORDER = ['correctness', 'design', 'conventions', 'docs', 'change-safety', 'performance', 'security', 'tests'];
const LENS_AGENT = { correctness: 'review-reader', design: 'review-reader', conventions: 'review-reader', docs: 'review-reader', 'change-safety': 'review-reader', verify: 'review-reader', performance: 'review-runner', security: 'review-runner', tests: 'review-runner' };
const MODE_LENSES = { quality: ['correctness', 'design', 'conventions'], performance: ['performance'], security: ['security'], tests: ['tests'], docs: ['docs'], everything: ['correctness', 'design', 'conventions', 'performance', 'security', 'tests', 'docs'] };
const REUSE_DAYS = 14;
const MAX_ATTEMPTS = 3;
const LIMIT_RE = /usage limit|rate.?limit|limit (reached|exceeded|will reset)|quota|overloaded|too many requests|\b429\b|\b529\b|credit balance|resets? (at|in)\b/i;
const sha = (x) => crypto.createHash('sha1').update(x).digest('hex');
let readStdin = () => fs.readFileSync(0, 'utf8');
const flagValue = (args, name) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : null; };

const stateBase = () => process.env.CODE_REVIEW_STATE || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), '.cache'), 'claude-code-review');
function repoState(root) {
  const abs = path.resolve(root);
  return path.join(stateBase(), `${path.basename(abs).replace(/[^\w.-]+/g, '_')}-${sha(abs.toLowerCase()).slice(0, 8)}`);
}
const refsDir = path.join(os.homedir(), '.claude', 'agents', 'references');
const lensFile = (l) => path.join(refsDir, 'lenses', `${l}.md`);

// Temp file in the same folder, then rename, retrying briefly: Norton and OneDrive can hold a file for a moment.
function atomicWrite(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  for (let i = 0; ; i++) {
    try { fs.renameSync(tmp, file); return; } catch (e) {
      if (i >= 4 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) { try { fs.unlinkSync(tmp); } catch { /* best effort */ } throw e; }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100 * (i + 1));
    }
  }
}
const readLedger = (dir) => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'run.json'), 'utf8')); } catch { return null; } };
function saveLedger(dir, led) { led.updated = new Date().toISOString(); atomicWrite(path.join(dir, 'run.json'), JSON.stringify(led)); }

// Record a finished or failed unit. Shared by `run done` / `run fail` and by the inbox the stop hook fills, so a
// result arrives the same way whichever path it took.
function applyDone(root, dir, led, u, body) {
  atomicWrite(resultFile(root, dir, u), body + '\n');
  u.status = 'done'; u.finished = new Date().toISOString(); delete u.reason;
}
function applyFail(led, u, reason, limit) {
  u.reason = reason;
  u.status = !limit && u.attempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
  if (limit) led.halted = { at: new Date().toISOString(), reason };
}

// The SubagentStop hook (`run hook`) cannot touch run.json without racing the main thread, so it drops each reply in
// runs/<id>/inbox/<unit>.md (or .fail) and every `run` command folds the inbox into the ledger first.
function reconcileInbox(root, dir, led) {
  const inbox = path.join(dir, 'inbox'); const stored = []; const files = [];
  let names = [];
  try { names = fs.readdirSync(inbox).sort(); } catch { return stored; }
  for (const n of names) {
    const m = /^(.+)\.(md|fail)$/.exec(n);
    if (!m) continue;
    const file = path.join(inbox, n); files.push(file);
    const u = led.units.find((x) => x.id === m[1]);
    if (!u || u.status === 'done') continue; // a late duplicate of something already stored
    const body = (readText(file) || '').trim();
    const limit = LIMIT_RE.test(body) && body.length < 800;
    if (m[2] === 'fail' || !body || limit) { applyFail(led, u, body || 'the agent returned an empty reply', limit); stored.push(`${u.id} FAILED${limit ? ' (limit: run halted)' : ''}: ${(body || 'empty reply').slice(0, 120)}`); }
    else { applyDone(root, dir, led, u, body); stored.push(`${u.id} stored`); }
  }
  if (files.length) { if (stored.length) saveLedger(dir, led); for (const f of files) { try { fs.unlinkSync(f); } catch { /* best effort */ } } }
  return stored;
}

function loadRun(root, args) {
  const runs = path.join(repoState(root), 'runs');
  let id = flagValue(args, '--run');
  if (!id) {
    const all = (fs.existsSync(runs) ? fs.readdirSync(runs) : []).map((d) => ({ d, led: readLedger(path.join(runs, d)) })).filter((x) => x.led);
    all.sort((a, b) => String(b.led.updated).localeCompare(String(a.led.updated)));
    id = all[0]?.d;
  }
  if (!id) throw new Error('no run found for this project: start one with `run init --modes <mode> <scope>`');
  const dir = path.join(runs, id);
  const led = readLedger(dir);
  if (!led) throw new Error(`run ${id} not found`);
  return { dir, led, stored: reconcileInbox(root, dir, led) };
}

function splitRunArgs(args) {
  const o = { modes: [], scopeArgs: [], bundle: false, independent: false, fresh: false, budget: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--modes') o.modes = String(args[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--bundle') o.bundle = true;
    else if (a === '--independent') o.independent = true;
    else if (a === '--fresh') o.fresh = true;
    else if (a === '--budget') o.budget = Number(args[++i]);
    else if (a === '--root') i++;
    else o.scopeArgs.push(a);
  }
  return o;
}

function lensesFor(modes, files, scopeMode) {
  for (const m of modes) if (!MODE_LENSES[m]) throw new Error(`unknown mode: ${m} (quality, performance, security, tests, docs, everything)`);
  const set = new Set(modes.flatMap((m) => MODE_LENSES[m]));
  if (scopeMode === 'changes' && (modes.includes('quality') || modes.includes('everything')) && changeSafetyFiles(files).length) set.add('change-safety');
  return LENS_ORDER.filter((l) => set.has(l));
}

function planUnits(shards, lenses, bundled) {
  const units = [];
  shards.forEach((_, i) => {
    const groups = bundled
      ? ['review-reader', 'review-runner'].map((a) => [a, lenses.filter((l) => LENS_AGENT[l] === a)]).filter(([, ls]) => ls.length)
      : lenses.map((l) => [LENS_AGENT[l], [l]]);
    for (const [agent, ls] of groups) units.push({ id: `s${i + 1}-${bundled ? agent.replace('review-', '') : ls[0]}`, kind: 'lens', shard: i + 1, agent, lenses: ls });
  });
  return units;
}

const contextHash = (root) => sha([path.join(refsDir, 'review-core.md'), path.join(root, 'CLAUDE.md'), path.join(root, '.claude', 'REVIEW.md')].map((f) => readText(f) || '').join('\0'));
// Everything in a folder, so a stored result is not reused after one of these files changes.
const hashDir = (dir) => { try { return sha(fs.readdirSync(dir).sort().map((f) => `${f}\0${readText(path.join(dir, f)) || ''}`).join('\0')); } catch { return ''; } };
// The security lens reads the class catalog and whichever domain files the brief names, so they belong in its key.
const securityRefs = () => sha(hashDir(path.join(refsDir, 'security-domains')) + (readText(path.join(refsDir, 'security-classes.md')) || ''));
// The language checklists a brief inlines belong in the key too: edit one and the units that carried it re-run.
const unitKey = (ctx, u, shard, root) => sha(JSON.stringify({ ctx, agent: u.agent, lenses: u.lenses.map((l) => [l, sha(readText(lensFile(l)) || '')]), ...(u.lenses.includes('security') ? { sec: securityRefs() } : {}), lang: sha(langText(root, shard.files, u.lenses)), files: shard.files.map((f) => [f.file, f.hash, f.ranges]) }));
const resultFile = (root, dir, u) => (u.kind === 'lens' ? path.join(repoState(root), 'results', `${u.key}.md`) : path.join(dir, 'results', `${u.id}.md`));
const resultAge = (file) => { try { return (Date.now() - fs.statSync(file).mtimeMs) / 864e5; } catch { return null; } };
const lensCounts = (led) => { const l = led.units.filter((u) => u.kind === 'lens'); return { total: l.length, done: l.filter((u) => u.status === 'done').length }; };

// ---- briefs: self-contained, so a reviewer starts reading code at once instead of spending turns on reference files.
const LANG_LENS = (l) => (l === 'security' ? 'security' : l === 'performance' ? 'performance' : 'quality');
const stackCache = new Map();
// Checklists for the stacks present in these files, filtered to the sections the lenses use (same filter as `lang`).
function langText(root, files, lenses) {
  let stack = stackCache.get(root);
  if (!stack) { try { stack = detectStack(root); } catch { stack = new Map(); } stackCache.set(root, stack); }
  const kinds = [...new Set(lenses.filter((l) => !['verify', 'recon', 'coverage-critic'].includes(l)).map(LANG_LENS))];
  const out = [];
  for (const n of stacksForFiles(stack, files.map((f) => f.file))) for (const k of kinds) { try { out.push(cmdLang([n, '--lens', k])); } catch { /* no checklist for this stack */ } }
  return out.join('\n\n');
}

// "## heading" blocks of a shared-context artifact. A heading may name several lenses ("## correctness, design").
function mdSections(text) {
  const out = []; let cur = null;
  for (const l of text.split(/\r?\n/)) {
    const m = /^## (.+?)\s*$/.exec(l);
    if (m) { cur = { head: m[1], words: m[1].toLowerCase().split(/[\s,+&]+/).filter(Boolean), body: [] }; out.push(cur); } else if (cur) cur.body.push(l);
  }
  return out.map((s) => ({ ...s, body: s.body.join('\n').trim() }));
}
// The run's shared context (generated `prep` first, then what the main thread saved as `shared`) for these lenses only.
function sharedFor(dir, lenses) {
  const parts = [];
  for (const name of ['prep', 'shared']) {
    const t = readText(path.join(dir, 'artifacts', `${name}.md`));
    if (!t) continue;
    for (const s of mdSections(t)) if (s.body && (s.words.includes('all') || lenses.some((l) => s.words.includes(l)))) parts.push(`### ${s.head}\n${s.body}`);
  }
  return parts.join('\n\n');
}
// ---- project rules. The reviewers run with omitClaudeMd, so no CLAUDE.md is loaded into them (the 86 KB base file alone was
// about 34,000 tokens per agent, measured on 2026-11-08); the brief carries what they may quote instead.

// The Development Base folder: the nearest folder at or above `root` that holds Projects/, CLAUDE.md and .claude/projects.json.
function findBase(root) {
  for (let a = path.resolve(root); ; a = path.dirname(a)) {
    if (fs.existsSync(path.join(a, 'Projects')) && fs.existsSync(path.join(a, 'CLAUDE.md')) && fs.existsSync(path.join(a, '.claude', 'projects.json'))) return a;
    if (a === path.dirname(a)) return null;
  }
}
// Base sections every lens gets, those for the quality and docs lenses, and those that apply when the shard holds a certain kind of file.
const BASE_ALWAYS = /^(Hard rules|Coding principles|Data handling|Security defaults|Testing philosophy|Minimal dependencies|Naming per language|Git)\b/i;
const BASE_DOCS = /^(Docs-first|The README convention|Attribution|Decision log|ADR-0NN|Known gaps register)\b/i;
const BASE_BY_PATH = [
  [/\.(ps1|psm1|bat|cmd)$|launcher|\.code-workspace$|(^|\/)Scripts\//i, /^(Windows dev-machine hygiene|One-click launchers)\b/i],
  [/Dockerfile|railway|startup\.|\.github\/workflows\/|health/i, /^Deployment\b/i],
  [/\.(css|scss|tsx|jsx|xaml|axaml|html|vue|svelte)$|components\.json|tailwind/i, /^(Web UI baseline|Brand|Named styles)\b/i],
  [/(^|\/)\.claude\/(skills|agents|tools)\/|SKILL\.md$|(^|\/)CLAUDE\.md$/i, /^(Subagents and skills|Context economy|Claiming a measurement|Briefing an agent)\b/i],
  [/projects\.json|(^|\/)Scripts\/Sync/i, /^Syncing two machines\b/i],
  [/auth|login|session|password/i, /^Authentication for personal web apps\b/i],
];
// The sections of the base CLAUDE.md for these lenses and files, whole, plus an index of the ones left out (with their line
// ranges) so a reviewer can read any of them with Read when its files fall under it.
function baseRules(baseFile, lenses, files) {
  const text = readText(baseFile) || '';
  const rows = text.split(/\r?\n/); const heads = [];
  rows.forEach((l, i) => { const m = /^## (.+?)\s*$/.exec(l); if (m) heads.push({ title: m[1], start: i }); });
  heads.forEach((h, k) => { h.end = k + 1 < heads.length ? heads[k + 1].start : rows.length; });
  const paths = files.map((f) => f.file);
  const docs = lenses.some((l) => ['conventions', 'docs'].includes(l));
  const wanted = (h) => BASE_ALWAYS.test(h.title) || (docs && BASE_DOCS.test(h.title)) || BASE_BY_PATH.some(([pathRe, headRe]) => headRe.test(h.title) && paths.some((p) => pathRe.test(p)));
  const take = heads.filter(wanted); const left = heads.filter((h) => !wanted(h));
  return {
    text: take.map((h) => rows.slice(h.start, h.end).join('\n').trimEnd()).join('\n\n'),
    left: left.map((h) => `${h.title} (lines ${h.start + 1}-${h.end})`),
  };
}

// Core rules + lens files + project rules + (optionally) language checklists and shared context.
function inlineRules(root, dir, led, lenses, { langs = true, shared = true, files = [] } = {}) {
  const L = ['## Core rules (review-core.md, inlined: do not read it again)', (readText(path.join(refsDir, 'review-core.md')) || '').trim(), ''];
  for (const l of lenses) L.push(`## Lens: ${l} (${lensFile(l)}, inlined)`, (readText(lensFile(l)) || `(missing lens file ${lensFile(l)})`).trim(), '');
  L.push('## Project rules', 'No CLAUDE.md is loaded into your session (on purpose: it would cost far more than the code you review), so the rules you may quote are inlined here. Quote the rule you invoke.');
  const baseDir = findBase(root); const isBase = baseDir && path.resolve(baseDir) === path.resolve(root);
  const projFile = path.join(root, 'CLAUDE.md');
  if (!isBase && fs.existsSync(projFile)) L.push(`### The project's own CLAUDE.md (${projFile}, whole)`, (readText(projFile) || '').trim(), '');
  if (baseDir) {
    const baseFile = path.join(baseDir, 'CLAUDE.md'); const b = baseRules(baseFile, lenses, files);
    L.push(`### ${isBase ? "This project's CLAUDE.md, which is also the Development Base rules" : 'Development Base rules (this project lives under it)'}: the sections for your lens and files (${baseFile})`, b.text, '',
      `Sections of that file NOT inlined here, with their line ranges. If a file you review falls under one, read just that range with Read (offset and limit): ${b.left.join('; ')}.`, '');
  } else if (!fs.existsSync(projFile)) L.push('No CLAUDE.md found for this project.', '');
  const review = readText(path.join(root, '.claude', 'REVIEW.md'));
  L.push(review ? `.claude/REVIEW.md (inlined):\n${review.trim()}` : 'No .claude/REVIEW.md.', '');
  const lang = langs ? langText(root, files, lenses) : '';
  if (lang) L.push('## Language checklists (sections for your lens, inlined)', lang, '');
  const sh = shared ? sharedFor(dir, lenses) : '';
  if (sh) L.push('## Shared context for the run (stacks, gate results, leads, helper outputs; only the parts addressed to you)', sh, '');
  const extra = [];
  if (lenses.includes('security')) extra.push(`${path.join(refsDir, 'security-classes.md')} (your primary checklist: read it)`);
  if (lenses.includes('security') && /Domain files:/i.test(sh)) extra.push(`the security-domain files named in the shared context, in ${path.join(refsDir, 'security-domains')}`);
  if (extra.length) L.push('## Also read', ...extra.map((e) => `- ${e}`), '');
  return L;
}

function lensBrief(root, dir, led, u, shard) {
  const L = [`# /code unit ${u.id}: ${u.agent}, lenses: ${u.lenses.join(', ')}`, '',
    `Run ${led.id}. Project root: ${root}`,
    `Scope: ${led.notes.join('; ')} (reproduce: node ~/.claude/skills/code/tools/code-tools.mjs scope ${led.scopeArgs.join(' ')} --root "${root}")`, '',
    `Everything you need is below, so start with the code. Run each lens as its own complete pass and label every finding with its lens. Your final reply is stored automatically by a hook: write no files.`, '',
    ...inlineRules(root, dir, led, u.lenses, { files: shard.files }),
    `## Files to review (a shard boundary: other agents review the other shards)${led.scopeMode === 'changes' ? '. Read each whole file for context, but review the changed line ranges.' : ''}`,
    ...shard.files.map((f) => `- ${f.file}${f.ranges ? `  changed lines ${fmtRanges(f.ranges)}` : ''}`), '',
    'Return findings in the review-core output format and nothing else, or `nothing found`. Never cite a line you did not read.'];
  return L.join('\n') + '\n';
}

function cmdRunInit(root, args) {
  const a = splitRunArgs(args);
  if (!a.modes.length) throw new Error('run init needs --modes <quality|performance|security|tests|docs|everything>[,...]');
  const r = resolveScope(root, parseScope(root, a.scopeArgs));
  if (!r.files.length) throw Object.assign(new Error(`empty scope (${r.notes.join('; ')}): nothing to review, stop here`), { code: 3 });
  for (const f of r.files) f.hash = sha(fs.readFileSync(path.join(root, f.file)));
  const lenses = lensesFor(a.modes, r.files, r.mode);
  const changed = r.mode === 'changes' ? r.files.reduce((s, f) => s + f.changed, 0) : Infinity;
  const fastPath = !a.independent && a.modes.length === 1 && a.modes[0] === 'quality' && changed <= 300;
  const bundled = a.bundle || fastPath;
  const budget = a.budget || defaultBudget(r.mode, bundled);
  const id = sha(JSON.stringify([[...a.modes].sort(), a.scopeArgs, a.bundle, a.independent, a.budget])).slice(0, 8);
  const dir = path.join(repoState(root), 'runs', id);

  let old = readLedger(dir);
  if (a.fresh && fs.existsSync(dir)) {
    const arch = path.join(repoState(root), 'archive');
    fs.mkdirSync(arch, { recursive: true });
    fs.renameSync(dir, path.join(arch, `${id}-${new Date().toISOString().replace(/[:.]/g, '-')}`));
    old = null;
  }

  // Keep the old shard groups whose files are all unchanged, so one edit does not reshuffle every shard.
  const cur = new Map(r.files.map((f) => [f.file, f]));
  const same = (o, f) => !!f && o.hash === f.hash && fmtRanges(o.ranges || []) === fmtRanges(f.ranges || []);
  const risk = riskScores(root, r.files);
  const mk = (files) => ({ files, weight: files.reduce((s, f) => s + weightOf(r.mode, f), 0), risk: files.reduce((t, f) => t + (risk.get(f.file)?.score || 0), 0) });
  const kept = []; const keptSet = new Set();
  if (old && old.budget === budget && old.bundled === bundled) {
    for (const g of old.shards) {
      const now = g.files.map((o) => cur.get(o.file));
      if (g.files.every((o, i) => same(o, now[i]))) { kept.push(mk(now)); now.forEach((f) => keptSet.add(f.file)); }
    }
  }
  const rest = r.files.filter((f) => !keptSet.has(f.file));
  const shards = [...kept, ...(rest.length ? makeShards(root, r.mode, rest, budget, risk) : [])].sort((x, y) => y.risk - x.risk);

  const ctx = contextHash(root);
  const oldByKey = new Map((old?.units || []).filter((u) => u.kind === 'lens').map((u) => [u.key, u]));
  const units = planUnits(shards, lenses, bundled);
  for (const u of units) {
    u.key = unitKey(ctx, u, shards[u.shard - 1], root);
    u.attempts = oldByKey.get(u.key)?.attempts || 0;
    const age = a.fresh ? null : resultAge(resultFile(root, dir, u));
    if (age !== null && age <= REUSE_DAYS) { u.status = 'done'; u.reusedFrom = new Date(Date.now() - age * 864e5).toISOString(); } else u.status = 'pending';
  }
  const extra = (old?.units || []).filter((u) => u.kind !== 'lens').map((u) => (u.status === 'done' ? u : { ...u, status: 'pending' }));
  const now = new Date().toISOString();
  const led = {
    version: 1, id, root, created: old?.created || now, updated: now, modes: a.modes, scopeArgs: a.scopeArgs, flags: [a.bundle && '--bundle', a.independent && '--independent', a.budget && `--budget ${a.budget}`].filter(Boolean), scopeMode: r.mode, notes: r.notes,
    bundled, budget, ctx, lenses,
    shards: shards.map((s, i) => ({ n: i + 1, files: s.files.map((f) => ({ file: f.file, hash: f.hash, ranges: f.ranges || null, lines: f.lines, changed: f.changed ?? null })) })),
    halted: null, units: [...units, ...extra],
  };
  fs.rmSync(path.join(dir, 'briefs'), { recursive: true, force: true });
  for (const u of units) if (u.status === 'pending') atomicWrite(path.join(dir, 'briefs', `${u.id}.md`), lensBrief(root, dir, led, u, led.shards[u.shard - 1]));
  saveLedger(dir, led);

  const reused = units.filter((u) => u.reusedFrom).length;
  const pending = units.filter((u) => u.status === 'pending');
  const out = [`run ${id}  ${old ? 'resumed' : 'new'}  dir: ${dir}`, `scope: ${r.notes.join('; ')}`,
    `modes: ${a.modes.join(',')}  lenses: ${lenses.join(', ')}`,
    `agents: ${bundled ? `bundled, one agent per type per shard (${a.bundle ? '--bundle' : 'fast path: quality, 300 or fewer changed lines'})` : 'one agent per lens per shard'}`,
    `shards: ${shards.length}  budget: ${budget} ${r.mode === 'changes' ? 'changed lines' : 'lines'}  (shard 1 is the riskiest)`,
    `units: ${units.length}  done: ${units.length - pending.length} (${reused} reused from an earlier result)  to dispatch: ${pending.length}`];
  if (extra.length) out.push(`carried over: ${extra.length} later-phase unit(s) (${extra.map((u) => `${u.id} ${u.status}`).join(', ')})`);
  for (const u of units) out.push(`  ${u.id.padEnd(22)} ${u.status.padEnd(8)} ${u.agent}  ${u.lenses.join('+')}`);
  out.push(`next: run next --n 4   (waves of 4; write each result back the moment it returns)`);
  return out.join('\n');
}

// Hands out pending units. `--n K` is a fixed wave; `--fill K` keeps K units in flight (rolling dispatch: call it each
// time an agent returns, and a slow agent no longer holds up the rest). Every call first folds in the results the stop
// hook stored, and `--returned <unit>` says loudly when that unit's result did not arrive.
function cmdRunNext(root, args) {
  const { dir, led, stored } = loadRun(root, args);
  const head = [];
  if (stored.length) head.push(`stored by the hook: ${stored.join('; ')}`);
  const returned = flagValue(args, '--returned');
  if (returned) {
    const r = led.units.find((x) => x.id === returned);
    if (!r) head.push(`unknown unit ${returned}`);
    else if (r.status === 'running') head.push(`NOT STORED: ${returned} returned but the hook stored nothing. Pipe its reply to \`run done ${returned}\` (or \`run fail ${returned} --reason "<its text>"\` if it was an error).`);
  }
  const tally = () => `pending ${led.units.filter((u) => u.status === 'pending').length}, running ${led.units.filter((u) => u.status === 'running').length}, done ${led.units.filter((u) => u.status === 'done').length}, failed ${led.units.filter((u) => u.status === 'failed').length}`;
  if (led.halted) return [...head, `halted at ${led.halted.at}: ${led.halted.reason}\nDo not dispatch more. Report the coverage (run status) and tell the user to resume in a new usage window with the resume line from run status.`].join('\n');
  const running = led.units.filter((u) => u.status === 'running').length;
  const fill = flagValue(args, '--fill');
  const n = fill ? Math.max(0, Number(fill) - running) : Number(flagValue(args, '--n') || 4);
  if (!Number.isFinite(n)) throw new Error('--n and --fill need a number');
  const maxShard = flagValue(args, '--shards') ? Number(flagValue(args, '--shards')) : Infinity;
  const kind = flagValue(args, '--kind'); // e.g. the recon unit has to run before the lens wave, not after it
  const pick = led.units.filter((u) => u.status === 'pending' && (u.shard == null || u.shard <= maxShard) && (!kind || u.kind === kind)).slice(0, n);
  if (!pick.length) return [...head, `nothing to dispatch now (${tally()}${fill && running >= Number(fill) ? '; the fill target is reached' : ''})`].join('\n');
  const now = new Date().toISOString();
  for (const u of pick) {
    u.status = 'running'; u.started = now; u.attempts++;
    if (u.kind === 'lens') atomicWrite(path.join(dir, 'briefs', `${u.id}.md`), lensBrief(root, dir, led, u, led.shards[u.shard - 1])); // fresh: it carries the shared context saved since init
  }
  saveLedger(dir, led);
  return [...head, `dispatch ${pick.length} unit(s), one background Agent call each, all in one message (${tally()}). Prompt for every call: "Read your brief at <brief> and follow it exactly."`,
    ...pick.map((u) => `${u.id}\t${u.agent}\t${u.lenses.join('+')}\t${path.join(dir, 'briefs', `${u.id}.md`)}`)].join('\n');
}

// The report of a finished subagent, read from its transcript (JSONL): the `message` of its last SubagentHandback call, else
// the text of its last assistant turn, else ''.
function lastReply(transcript) {
  const rows = String(transcript || '').trim().split('\n');
  let text = '';
  for (let i = rows.length - 1; i >= 0; i--) {
    let j; try { j = JSON.parse(rows[i]); } catch { continue; } // a partial line
    const c = j.message?.content;
    if (!Array.isArray(c) || (j.type !== 'assistant' && j.message?.role !== 'assistant')) continue;
    const hand = [...c].reverse().find((x) => x.type === 'tool_use' && x.name === 'SubagentHandback' && x.input?.message);
    if (hand) return String(hand.input.message).trim();
    if (!text) text = c.filter((x) => x.type === 'text').map((x) => x.text).join('\n').trim();
  }
  return text;
}

// SubagentStop hook, declared in the two reviewer agents' frontmatter: store the reply of the unit that just finished.
// It finds the unit from the brief path in the agent's own transcript (the first prompt), writes the reply to the run's
// inbox and never touches run.json, so agents that stop together cannot race. Silent, and always succeeds.
function cmdRunHook() {
  // hook.log (capped) records every call and where it stopped: the one way to tell "the hook never fired" from "it fired and found no unit".
  const log = (s) => { try { const f = path.join(stateBase(), 'hook.log'); fs.mkdirSync(path.dirname(f), { recursive: true }); let t = ''; try { t = fs.readFileSync(f, 'utf8'); } catch { /* new */ } if (t.length > 20000) t = t.slice(-10000); fs.writeFileSync(f, `${t}${new Date().toISOString()} ${s}\n`); } catch { /* logging must not fail the hook */ } };
  try {
    const ev = JSON.parse(readStdin());
    let transcript = '';
    try { transcript = fs.readFileSync(ev.agent_transcript_path, 'utf8'); } catch { /* not flushed yet or no path */ }
    const m = /runs[\\/]+([0-9a-f]{8})[\\/]+briefs[\\/]+([\w.-]+?)\.md/.exec(transcript.slice(0, 200000));
    log(`event ${ev.hook_event_name || '?'} agent ${ev.agent_type || '?'} transcript ${transcript ? `${transcript.length} bytes` : 'unreadable'} unit ${m ? m[2] : 'none'}`);
    if (!m) return '';
    let msg = String(ev.last_assistant_message || '').trim();
    // A subagent here ends by calling SubagentHandback({message}) and has no closing text, so last_assistant_message is empty:
    // the report is that call's `message`. Failing that, the last assistant text. The transcript may still be flushing when the
    // hook runs, so look a few times before giving up.
    for (let attempt = 0; !msg && attempt < 6; attempt++) {
      if (attempt) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300); try { transcript = fs.readFileSync(ev.agent_transcript_path, 'utf8'); } catch { /* still unreadable */ } }
      msg = lastReply(transcript);
    }
    const base = stateBase(); let dir = null;
    for (const d of fs.readdirSync(base)) { const c = path.join(base, d, 'runs', m[1]); if (fs.existsSync(path.join(c, 'run.json'))) { dir = c; break; } }
    if (!dir) return '';
    const bad = !msg || (msg.length < 800 && LIMIT_RE.test(msg));
    atomicWrite(path.join(dir, 'inbox', `${m[2]}.${bad ? 'fail' : 'md'}`), (msg || 'the agent returned an empty reply') + '\n');
    log(`stored ${m[2]} as ${bad ? 'fail' : 'md'} (${msg.length} chars)`);
  } catch (e) { log(`error ${e.message}`); /* a hook must never fail the agent it observes */ }
  return '';
}

function cmdRunDone(root, args) {
  const { dir, led } = loadRun(root, args);
  const u = led.units.find((x) => x.id === args[0]);
  if (!u) throw new Error(`no unit ${args[0]} in run ${led.id}`);
  const body = readStdin().trim();
  if (!body) throw new Error('empty result: a reviewer with no findings says `nothing found`; an empty reply is a failure, use run fail');
  if (body.length < 800 && LIMIT_RE.test(body)) throw new Error(`that looks like a usage-limit or rate error, not findings: use \`run fail ${u.id} --reason "<text>"\``);
  applyDone(root, dir, led, u, body);
  saveLedger(dir, led);
  const c = lensCounts(led);
  return `done ${u.id}  (${c.done}/${c.total} lens units)`;
}

function cmdRunFail(root, args) {
  const { dir, led } = loadRun(root, args);
  const u = led.units.find((x) => x.id === args[0]);
  if (!u) throw new Error(`no unit ${args[0]} in run ${led.id}`);
  const reason = flagValue(args, '--reason') || 'no reason given';
  const limit = args.includes('--limit') || LIMIT_RE.test(reason);
  applyFail(led, u, reason, limit);
  saveLedger(dir, led);
  return limit ? `${u.id} back to pending. HALTED (limit): stop dispatching, run status, tell the user how to resume.` : `${u.id} ${u.status} after attempt ${u.attempts}: ${reason}`;
}

function cmdRunStatus(root, args) {
  const { dir, led } = loadRun(root, args);
  const by = (s) => led.units.filter((u) => u.status === s);
  const lens = led.units.filter((u) => u.kind === 'lens');
  const completeShards = led.shards.filter((s) => lens.filter((u) => u.shard === s.n).every((u) => u.status === 'done'));
  const sum = (ss, k) => ss.reduce((t, s) => t + s.files.reduce((x, f) => x + (f[k] || 0), 0), 0);
  const k = led.scopeMode === 'changes' ? 'changed' : 'lines';
  const out = [`run ${led.id}  modes: ${led.modes.join(',')}  scope: ${led.notes.join('; ')}`,
    `units: ${by('done').length} done, ${by('running').length} running, ${by('pending').length} pending, ${by('failed').length} failed, of ${led.units.length}`,
    `coverage: ${completeShards.length} of ${led.shards.length} shards fully reviewed by every lens (${sum(completeShards, k)} of ${sum(led.shards, k)} ${k === 'changed' ? 'changed lines' : 'lines'}; shards run riskiest first)${completeShards.length === led.shards.length ? '' : '  PARTIAL: say so in the verdict'}`];
  if (led.halted) out.push(`halted at ${led.halted.at}: ${led.halted.reason}`);
  const stuck = by('running');
  if (stuck.length) out.push(`running (cut off if this is a new session; run init resets them): ${stuck.map((u) => u.id).join(', ')}`);
  out.push(`resume: node ~/.claude/skills/code/tools/code-tools.mjs run init --modes ${led.modes.join(',')} ${led.scopeArgs.join(' ')} ${led.flags.join(' ')} --root "${led.root}"`);
  out.push(`artifacts: ${fs.existsSync(path.join(dir, 'artifacts')) ? fs.readdirSync(path.join(dir, 'artifacts')).join(', ') || 'none' : 'none'}`);
  return out.join('\n');
}

function cmdRunResults(root, args) {
  const { dir, led } = loadRun(root, args);
  const kind = flagValue(args, '--kind') || 'lens';
  const out = [];
  for (const u of led.units.filter((x) => x.kind === kind && x.status === 'done')) {
    out.push(`=== ${u.id}  ${u.lenses.join('+')}${u.shard ? `  shard ${u.shard}` : ''}${u.reusedFrom ? `  (reused from ${u.reusedFrom.slice(0, 10)})` : ''} ===`, (readText(resultFile(root, dir, u)) || '(result file missing)').trim(), '');
  }
  return out.length ? out.join('\n') : `no finished ${kind} units yet`;
}

function cmdRunAdd(root, args) {
  const { dir, led } = loadRun(root, args);
  const id = args[0];
  const lens = flagValue(args, '--lenses') || 'verify';
  const agent = flagValue(args, '--agent') || LENS_AGENT[lens] || 'review-reader';
  if (!id || id.startsWith('--')) throw new Error('usage: run add <unit-id> [--lenses verify] [--agent review-reader] < brief');
  const body = readStdin().trim();
  if (!body) throw new Error('empty brief');
  return addUnit(root, dir, led, { id, lens, agent, kind: flagValue(args, '--kind') || 'verify', body });
}

// Add (or refresh) a non-lens unit. The brief inlines the core rules and the lens file, like a lens brief does. The key
// covers the body, the lens file and the core rules, not the shared context, so adding the same body twice is a no-op.
function addUnit(root, dir, led, { id, lens, agent, kind, body, files = [] }) {
  const key = sha(JSON.stringify([id, agent, lens, body, sha(readText(lensFile(lens)) || ''), sha(readText(path.join(refsDir, 'review-core.md')) || '')]));
  const ctxual = !['verify', 'recon', 'coverage-critic'].includes(lens); // these read the code themselves; the others also get checklists and shared context
  const brief = [`# /code unit ${id}: ${agent}, lens: ${lens}`, '', `Project root: ${root}`, 'Everything you need is below. Your final reply is stored automatically by a hook: write no files.', '',
    ...inlineRules(root, dir, led, [lens], { langs: ctxual, shared: ctxual, files }), '## Your task', body, ''].join('\n');
  const prev = led.units.find((u) => u.id === id);
  if (prev && prev.key === key) {
    const briefFile = path.join(dir, 'briefs', `${id}.md`);
    if (!fs.existsSync(briefFile)) atomicWrite(briefFile, brief); // run init deletes the briefs folder and rewrites only the lens briefs
    return `unit ${id} unchanged (${prev.status})`;
  }
  led.units = led.units.filter((u) => u.id !== id);
  led.units.push({ id, kind, agent, lenses: [lens], key, status: 'pending', attempts: prev?.attempts || 0 });
  atomicWrite(path.join(dir, 'briefs', `${id}.md`), brief);
  saveLedger(dir, led);
  return `unit ${id} ${prev ? 'replaced (its input changed)' : 'added'}, pending`;
}

function artifactPath(root, args, name) {
  const { dir } = loadRun(root, args);
  if (!/^[\w-]+$/.test(name || '')) throw new Error('artifact name must be letters, digits, - or _');
  return path.join(dir, 'artifacts', `${name}.md`);
}
function cmdRunSave(root, args) {
  const file = artifactPath(root, args, args[0]);
  const body = readStdin();
  if (!body.trim()) throw new Error('empty artifact');
  const text = body.endsWith('\n') ? body : body + '\n';
  const prev = args.includes('--append') ? readText(file) : null; // --append adds to what is saved instead of replacing it
  atomicWrite(file, prev ? `${prev.trimEnd()}\n\n${text}` : text);
  return `${prev ? 'appended to' : 'saved'} ${file}`;
}
function cmdRunLoad(root, args) {
  const t = readText(artifactPath(root, args, args[0]));
  if (t === null) throw new Error(`no artifact named ${args[0]} in this run`);
  return t.trimEnd();
}

function cmdRunList(root) {
  const runs = path.join(repoState(root), 'runs');
  const rows = (fs.existsSync(runs) ? fs.readdirSync(runs) : []).map((d) => readLedger(path.join(runs, d))).filter(Boolean)
    .sort((a, b) => String(b.updated).localeCompare(String(a.updated)))
    .map((l) => { const c = lensCounts(l); return `${l.id}  ${l.updated.slice(0, 16)}  ${c.done}/${c.total} lens units  ${l.modes.join(',')}  ${l.scopeArgs.join(' ')}${c.done === c.total ? '' : '  UNFINISHED'}`; });
  return rows.length ? rows.join('\n') : 'no runs for this project yet';
}

// ---------- shared context: run prep ----------

// Runs the deterministic helpers the modes need, in-process, and writes the result as the run's `prep` artifact, with each
// block under the lens headings that should see it. The main thread keeps what only it can do: the gates, the domain
// choice and the trust sketch (`run save shared --append`).
function cmdRunPrep(root, args) {
  const { dir, led } = loadRun(root, args);
  const sa = led.scopeArgs; const modes = new Set(led.modes);
  const has = (...m) => modes.has('everything') || m.some((x) => modes.has(x));
  const files = [...new Set(led.shards.flatMap((s) => s.files.map((f) => f.file)))];
  const blocks = []; const got = {};
  const step = (name, heads, fn) => {
    let t;
    try { t = String(fn()).trim(); } catch (e) { t = `unavailable: ${e.message}`; }
    blocks.push(`## ${heads}\n### ${name}\n${t}`); got[name] = t;
  };
  const depHeads = [has('quality') && 'design', has('security') && 'security'].filter(Boolean).join(', ');
  if (has('quality')) {
    step('prefilter quality', 'correctness, design', () => cmdPrefilter(root, [...sa, '--mode', 'quality']));
    step('dependents', 'correctness, design', () => cmdDependents(root, files.slice(0, 15)));
  }
  if (depHeads) step('deps', depHeads, () => cmdDeps(root));
  if (has('performance')) step('prefilter performance', 'performance', () => cmdPrefilter(root, [...sa, '--mode', 'performance']));
  if (has('security') || has('quality')) step('prefilter security', has('security') ? 'security' : 'security-net', () => cmdPrefilter(root, [...sa, '--mode', 'security']));
  if (has('security')) {
    step('entrypoints', 'security', () => cmdEntrypoints(root, sa));
    step('domains', 'security', () => cmdDomains(root, sa));
    step('history', 'security', () => cmdHistory(root, []));
  }
  if (has('tests')) {
    step('tests-map', 'tests', () => cmdTestsMap(root, sa));
    step('coverage', 'tests', () => cmdCoverage(root, sa));
  }
  if (has('docs')) {
    step('names', 'docs', () => cmdNames(root, sa));
    step('doclinks', 'docs', () => cmdDoclinks(root, positional(sa)));
  }
  const file = path.join(dir, 'artifacts', 'prep.md');
  atomicWrite(file, `# prep (generated by \`run prep\`: rerun it, do not edit)\n\n${blocks.join('\n\n')}\n`);
  const first = (t) => t.split('\n')[0].slice(0, 120);
  const out = [`prep saved: ${file}  (${Object.keys(got).length} helper outputs, each addressed to its lenses; briefs pick them up at dispatch)`, ...Object.entries(got).map(([k, v]) => `  ${k}: ${first(v)}`)];
  const net = (got['prefilter security'] || '').split('\n').filter((l) => /known-token-shape|hardcoded-secret|shell-exec|sql-concat|dynamic-eval|tracked-env-file/.test(l));
  if (net.length) out.push('Critical-shaped security leads (list them in the report; do not investigate them here):', ...net.slice(0, 10).map((l) => `  ${l}`));
  if (got.domains) out.push('domain candidates (confirm each against the boundary it names, then `run save shared --append` the line `Domain files: <ids>` and one `Excluded: <id> — <reason>` per rejected candidate):', ...got.domains.split('\n').slice(0, 14).map((l) => `  ${l}`));
  const trust = (got.entrypoints || '').split('\n').filter((l) => /public route|webhook route/.test(l));
  if (trust.length) out.push('trust leads:', ...trust.slice(0, 8).map((l) => `  ${l.trim()}`));
  out.push('still yours: the fast gates (parallel Bash calls, with a time limit), and for security a three-line trust-boundary sketch; save both with `run save shared --append` under `## all` or `## <lens>` headings');
  return out.join('\n');
}

// ---------- findings: parse, merge, verify, report ----------

const SEV_RANK = { Critical: 3, Important: 2, Suggested: 1 };
const capSev = (s) => s[0].toUpperCase() + s.slice(1).toLowerCase();
const FINDING_HEAD = /^###\s+(?:(F\d+)\s+)?(Critical|Important|Suggested)\s+(\S+?):(\d+(?:-\d+)?)\s*(?:\[([^\]]*)\])?\s*(.*)$/i;
const TRAILING = /^(needs-validation|hardening|traced):\s*$/;

// A reviewer reply in the review-core format: `### <Severity> <path>:<line> [<lens>] <summary>` plus `scenario:`,
// `fix:` and `rule:` lines, and for the security lens trailing needs-validation / hardening / traced blocks.
// `ok` is false for a reply that is neither `nothing found` nor parseable: the caller lists it raw, never drops it.
function parseResult(text) {
  const rows = String(text || '').split(/\r?\n/);
  const cut = rows.findIndex((l) => TRAILING.test(l));
  const main = cut >= 0 ? rows.slice(0, cut) : rows;
  const extras = { 'needs-validation': [], hardening: [], traced: [] };
  if (cut >= 0) {
    let cur = null;
    for (const l of rows.slice(cut)) {
      const m = TRAILING.exec(l);
      if (m) { cur = m[1]; continue; }
      if (cur && l.trim()) extras[cur].push(l.replace(/^\s*-\s*/, '').trim());
    }
  }
  const findings = []; let f = null; let field = null;
  for (const l of main) {
    const h = FINDING_HEAD.exec(l);
    if (h) {
      f = { id: h[1] || null, sev: capSev(h[2]), file: h[3].replace(/\\/g, '/'), line: h[4], lens: (h[5] || '').trim(), summary: h[6].trim(), scenario: '', fix: '', rule: '', tension: '', also: '' };
      findings.push(f); field = null; continue;
    }
    if (!f) continue;
    const k = /^\s*(scenario|failure_scenario|fix|rule|tension|also):\s*(.*)$/i.exec(l);
    if (k) { field = k[1].toLowerCase() === 'failure_scenario' ? 'scenario' : k[1].toLowerCase(); f[field] = k[2].trim(); }
    else if (field && l.trim()) f[field] += ` ${l.trim()}`;
  }
  const body = main.join('\n');
  return { findings, extras, ok: findings.length > 0 || /^\s*nothing found\b/im.test(body) || !body.trim() };
}

const words = (s) => new Set(String(s).toLowerCase().match(/[a-z0-9_]{5,}/g) || []);
const overlap = (a, b) => { const B = words(b); return [...words(a)].filter((w) => B.has(w)).length; };
// Same place: the same line, or within 3 lines when another lens describes the same thing in similar words.
const sameSpot = (e, r) => e.file.toLowerCase() === r.file.toLowerCase() && (e.lineNum === r.lineNum || (Math.abs(e.lineNum - r.lineNum) <= 3 && r.lenses.some((l) => !e.lenses.includes(l)) && overlap(e.summary, r.summary) >= 2));
// Fold r into g: highest severity and its scenario win, the lenses and units union, the longer fix is kept as the more specific,
// and a differing summary is kept as `also`, so merging never loses a claim.
function joinInto(g, r) {
  const up = SEV_RANK[r.sev] > SEV_RANK[g.sev];
  const lead = up ? r : g; const other = up ? g : r;
  const also = [g.also, r.also, other.summary.toLowerCase() === lead.summary.toLowerCase() ? '' : `(${other.lenses.join('+')}) ${other.summary}`].filter(Boolean).join(' | ');
  Object.assign(g, { sev: lead.sev, summary: lead.summary, scenario: lead.scenario || other.scenario, fix: g.fix.length >= r.fix.length ? g.fix : r.fix, rule: g.rule || r.rule, tension: g.tension || r.tension, also,
    lenses: [...new Set([...g.lenses, ...r.lenses])], units: [...new Set([...g.units, ...r.units])] });
}
const fmtFinding = (f) => [`### ${f.id ? `${f.id} ` : ''}${f.sev} ${f.file}:${f.line} [${f.lenses.join(',')}] ${f.summary}`, `scenario: ${f.scenario}`, `fix: ${f.fix}`, f.rule && `rule: ${f.rule}`, f.tension && `tension: ${f.tension}`, f.also && `also: ${f.also}`].filter(Boolean).join('\n');

const mergedPath = (dir) => path.join(dir, 'merged.json');
const readMerged = (dir) => { try { return JSON.parse(fs.readFileSync(mergedPath(dir), 'utf8')); } catch { return null; } };
function saveMerged(dir, m) {
  atomicWrite(mergedPath(dir), JSON.stringify(m));
  const open = m.findings.filter((f) => f.status === 'open').sort((a, b) => SEV_RANK[b.sev] - SEV_RANK[a.sev]);
  atomicWrite(path.join(dir, 'artifacts', 'merged.md'), `${open.map(fmtFinding).join('\n\n') || 'no open findings'}\n`);
}
const newMerged = () => ({ findings: [], leads: [], hardening: [], traced: [], unparsed: [], mergedUnits: [], nextF: 1, nextL: 1, vcount: 0, lookPlanned: false });
const indexLine = (f) => `${f.id} ${f.sev} ${f.file}:${f.line} [${f.lenses.join(',')}] ${f.summary}${f.status === 'dropped' ? `  (DROPPED: ${f.dropReason})` : ''}`;

// Fold every newly finished lens, look and gap result into merged.json: dedupe, drop unresolvable citations, number the
// findings F1..Fn. Safe to repeat: units already merged are skipped, so edits and verdicts survive a second call.
function cmdRunMerge(root, args) {
  const { dir, led } = loadRun(root, args);
  const m = args.includes('--reset') ? newMerged() : (readMerged(dir) || newMerged());
  const todo = led.units.filter((u) => ['lens', 'look', 'gap'].includes(u.kind) && u.status === 'done' && !m.mergedUnits.includes(u.id));
  const cache = new Map(); const added = [];
  for (const u of todo) {
    const text = readText(resultFile(root, dir, u)) || '';
    const p = parseResult(text);
    m.mergedUnits.push(u.id);
    if (!p.ok) { m.unparsed.push({ unit: u.id, text: text.trim() }); continue; }
    for (const f of p.findings) {
      const rec = { ...f, id: null, lineNum: Number(String(f.line).split('-')[0]), lenses: [f.lens || u.lenses[0]], units: [u.id], source: u.kind };
      const g = m.findings.find((e) => sameSpot(e, rec));
      if (g) { joinInto(g, rec); continue; }
      const [a, b] = String(rec.line).split('-').map(Number);
      const bad = citeProblem(root, rec.file, a, b || a, cache);
      Object.assign(rec, { id: `F${m.nextF++}`, status: bad && bad[0] === 'bad' ? 'dropped' : 'open', dropReason: bad && bad[0] === 'bad' ? `unresolved citation: ${bad[1]}` : '' });
      delete rec.lens; m.findings.push(rec); added.push(rec.id);
    }
    for (const h of p.extras.hardening) m.hardening.push(`${h} [${u.id}]`);
    for (const t of p.extras.traced) m.traced.push(t);
    for (const n of p.extras['needs-validation']) if (!m.leads.some((l) => l.text === n)) m.leads.push({ id: `L${m.nextL++}`, text: n, unit: u.id, planned: false });
  }
  saveMerged(dir, m);
  const open = m.findings.filter((f) => f.status === 'open'); const gone = m.findings.filter((f) => f.status === 'dropped');
  const out = [`merged ${todo.length} unit(s): ${open.length} open finding(s) (${['Critical', 'Important', 'Suggested'].map((s) => `${open.filter((f) => f.sev === s).length} ${s}`).join(', ')}), ${gone.length} dropped, ${m.leads.length} lead(s), ${m.unparsed.length} unparsed unit(s)`,
    ...open.sort((a, b) => SEV_RANK[b.sev] - SEV_RANK[a.sev]).map(indexLine)];
  if (gone.length) out.push('dropped (unresolved citation or edited away; `run edit <id> --restore` undoes it):', ...gone.map((f) => `  ${indexLine(f)}`));
  for (const x of m.unparsed) out.push(`NOT PARSED, merge by hand: unit ${x.unit} (add its findings with \`run edit new --sev S --at path:line --lens L --summary T --fix T\`):`, ...x.text.split('\n').slice(0, 12).map((l) => `  | ${l}`));
  if (!todo.length && !m.findings.length) out.push('nothing to merge yet: no finished lens units');
  return out.join('\n');
}

function cmdRunEdit(root, args) {
  const { dir } = loadRun(root, args);
  const m = readMerged(dir); if (!m) throw new Error('nothing merged yet: run `run merge` first');
  const id = args[0];
  if (id === 'new') {
    const at = flagValue(args, '--at') || ''; const mt = /^(.+):(\d+(?:-\d+)?)$/.exec(at);
    const sev = capSev(flagValue(args, '--sev') || 'Suggested');
    if (!mt || !SEV_RANK[sev] || !flagValue(args, '--summary')) throw new Error('usage: run edit new --sev S --at path:line --lens L --summary T [--scenario T] [--fix T]');
    const rec = { id: `F${m.nextF++}`, sev, file: mt[1].replace(/\\/g, '/'), line: mt[2], lineNum: Number(mt[2].split('-')[0]), lenses: [flagValue(args, '--lens') || 'manual'], units: ['manual'], source: 'manual', summary: flagValue(args, '--summary'), scenario: flagValue(args, '--scenario') || '', fix: flagValue(args, '--fix') || '', rule: '', tension: '', also: '', status: 'open', dropReason: '' };
    m.findings.push(rec); saveMerged(dir, m); return `added ${indexLine(rec)}`;
  }
  const f = m.findings.find((x) => x.id === id);
  if (!f) throw new Error(`no finding ${id}; ids: ${m.findings.map((x) => x.id).join(' ')}`);
  const notes = [];
  const join = flagValue(args, '--join');
  if (join) {
    const o = m.findings.find((x) => x.id === join);
    if (!o || o === f) throw new Error(`cannot join ${join}`);
    joinInto(f, o); m.findings = m.findings.filter((x) => x !== o); notes.push(`joined ${join} into ${id}`);
  }
  const sv = flagValue(args, '--severity'); if (sv) { if (!SEV_RANK[capSev(sv)]) throw new Error('severity is Critical, Important or Suggested'); f.sev = capSev(sv); notes.push(`severity ${f.sev}`); }
  const dr = flagValue(args, '--drop'); if (dr !== null) { f.status = 'dropped'; f.dropReason = dr; notes.push('dropped'); }
  if (args.includes('--restore')) { f.status = 'open'; f.dropReason = ''; notes.push('restored'); }
  const fx = flagValue(args, '--fix'); if (fx !== null) { f.fix = fx; notes.push('fix replaced'); }
  const sc = flagValue(args, '--scenario'); if (sc !== null) { f.scenario = sc; notes.push('scenario replaced'); }
  if (!notes.length) throw new Error('usage: run edit <F-id> [--join <F-id>] [--severity S] [--drop "reason"] [--restore] [--fix T] [--scenario T]  |  run edit new ...');
  saveMerged(dir, m);
  return `${id}: ${notes.join(', ')}\n${indexLine(f)}`;
}

// Content signals for the "second look": auth, process execution, data writes, money, request input.
const HIGH_RISK = new RegExp([GUARD_AUTH.source, String.raw`child_process|execFile|execSync|spawn(Sync)?\(|subprocess\.|Process\.Start|Invoke-Expression`,
  String.raw`\b(INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b|writeFile(Sync)?\(|atomicWrite|\.(insert|save|destroy)\(`, String.raw`stripe|paypal|mollie|adyen|invoice`,
  String.raw`req\.(body|query|params)|request\.(form|json|args)|\[From(Body|Query|Route)\]`].join('|'), 'i');
function highRiskFiles(root, led, n = 6) {
  const seen = new Map();
  for (const s of led.shards) for (const f of s.files) if (!TEST_PATH.test(f.file) && !seen.has(f.file)) seen.set(f.file, f);
  const hits = [...seen.values()].filter((f) => HIGH_RISK.test(readText(path.join(root, f.file)) || ''));
  const risk = riskScores(root, hits);
  return hits.sort((a, b) => (risk.get(b.file)?.score || 0) - (risk.get(a.file)?.score || 0)).slice(0, n);
}

// Verify units for every Critical and Important not yet judged (and every needs-validation lead), about 8 per unit, plus the
// second look at the riskiest files. The look runs in the same wave as the verify units: it needs the merged titles (to hunt
// elsewhere) but not their verdicts. Repeat after the look returns and `run merge`: only what is new gets planned.
function cmdRunVerifyPlan(root, args) {
  const { dir, led } = loadRun(root, args);
  const m = readMerged(dir); if (!m) throw new Error('nothing merged yet: run `run merge` first');
  const per = Number(flagValue(args, '--per') || 8);
  const items = [
    ...m.findings.filter((f) => f.status === 'open' && !f.planned && SEV_RANK[f.sev] >= 2).map((f) => ({ ref: f, text: [`${f.id} — ${f.sev} — ${f.file}:${f.line} [${f.lenses.join(', ')}]`, `summary: ${f.summary}`, `scenario: ${f.scenario}`, `fix: ${f.fix}`, f.rule && `rule: ${f.rule}`].filter(Boolean).join('\n') })),
    ...m.leads.filter((l) => !l.planned).map((l) => ({ ref: l, text: `${l.id} — lead (needs-validation, not a finding): ${l.text}` }))];
  const out = [];
  for (let i = 0; i < items.length; i += per) {
    const chunk = items.slice(i, i + per); const id = `v${++m.vcount}`;
    const body = `Judge each item below with the verify lens. Items marked L are leads, not findings. Answer one line per id, in order: \`<id> — CONFIRMED | PLAUSIBLE | REFUTED — <one sentence of evidence with path:line>\`. Nothing else.\n\n${chunk.map((c) => c.text).join('\n\n')}`;
    out.push(addUnit(root, dir, led, { id, lens: 'verify', agent: 'review-reader', kind: 'verify', body }));
    for (const c of chunk) c.ref.planned = true;
  }
  if (!m.lookPlanned && !args.includes('--no-look')) {
    const risky = highRiskFiles(root, led);
    if (risky.length) {
      const lens = led.modes.includes('security') || led.modes.includes('everything') ? 'security' : led.lenses[0];
      const body = ['Second look. The lens reviewers have reported on this scope. You are a fresh reader of the riskiest files in it (authentication, input handling, money, data writes, process execution). Hunt for what they missed. These are already reported, so do not repeat them:',
        ...(m.findings.filter((f) => f.status === 'open').map((f) => `- ${f.file}:${f.line} ${f.summary}`).slice(0, 60)), '',
        `Review these files${led.scopeMode === 'changes' ? ' (read each whole; review the changed lines)' : ''}:`, ...risky.map((f) => `- ${f.file}${f.ranges ? `  changed lines ${fmtRanges(f.ranges)}` : ''}`), '',
        'Return only NEW findings in the review-core output format, or `nothing found`.'].join('\n');
      out.push(addUnit(root, dir, led, { id: 'look1', lens, agent: LENS_AGENT[lens] || 'review-reader', kind: 'look', body, files: risky }));
      m.lookPlanned = true;
    }
  }
  saveMerged(dir, m);
  return out.length ? [...out, `dispatch with \`run next --fill 6\`; when they are stored run \`run verdicts\`${m.lookPlanned ? ', then `run merge` and `run verify-plan` again if look1 found anything new' : ''}`].join('\n') : 'nothing to plan: no unjudged Critical or Important finding, no lead, and no second look needed';
}

function cmdRunVerdicts(root, args) {
  const { dir, led } = loadRun(root, args);
  const m = readMerged(dir); if (!m) throw new Error('nothing merged yet: run `run merge` first');
  const byId = new Map([...m.findings, ...m.leads].map((x) => [x.id, x]));
  const empty = [];
  for (const u of led.units.filter((x) => x.kind === 'verify' && x.status === 'done')) {
    let n = 0;
    for (const l of (readText(resultFile(root, dir, u)) || '').split(/\r?\n/)) {
      const v = /^\W*([FL]\d+)\s*[—–-]+\s*(CONFIRMED|PLAUSIBLE|REFUTED)\b\W*(.*)$/i.exec(l);
      const x = v && byId.get(v[1].toUpperCase());
      if (!x) continue;
      x.verdict = v[2].toUpperCase(); x.evidence = v[3].trim(); n++;
      if (x.verdict === 'REFUTED' && x.sev) { x.status = 'dropped'; x.dropReason = `refuted: ${x.evidence}`; }
    }
    if (!n) empty.push(u.id);
  }
  saveMerged(dir, m);
  const open = m.findings.filter((f) => f.status === 'open');
  const count = (v) => m.findings.filter((f) => f.verdict === v).length;
  const out = [`verdicts: ${count('CONFIRMED')} confirmed, ${count('PLAUSIBLE')} plausible, ${count('REFUTED')} refuted (dropped); leads: ${m.leads.filter((l) => l.verdict === 'CONFIRMED').length} confirmed, ${m.leads.filter((l) => l.verdict === 'PLAUSIBLE').length} plausible, ${m.leads.filter((l) => l.verdict === 'REFUTED').length} refuted`];
  for (const f of m.findings.filter((x) => x.verdict === 'REFUTED')) out.push(`  refuted ${f.id}: ${f.evidence}`);
  for (const f of open.filter((x) => x.sev === 'Critical' && x.verdict !== 'CONFIRMED')) out.push(`  ${f.id} is Critical but ${f.verdict || 'unverified'}: it will be reported as Important (never an unverified Critical)`);
  const waiting = open.filter((f) => SEV_RANK[f.sev] >= 2 && f.planned && !f.verdict);
  if (waiting.length) out.push(`  planned but no verdict yet: ${waiting.map((f) => f.id).join(' ')}`);
  const unplanned = open.filter((f) => SEV_RANK[f.sev] >= 2 && !f.planned);
  if (unplanned.length) out.push(`  not planned for verification yet: ${unplanned.map((f) => f.id).join(' ')} (run verify-plan)`);
  if (empty.length) out.push(`  NOT PARSED: verify unit(s) ${empty.join(', ')} returned no "<id> — VERDICT — evidence" line; read them with \`run results --kind verify\` and \`run edit\` by hand`);
  const confirmedLeads = m.leads.filter((l) => l.verdict === 'CONFIRMED');
  if (confirmedLeads.length) out.push(`  confirmed leads need a severity from you (\`run edit new ...\`): ${confirmedLeads.map((l) => l.id).join(' ')}`);
  return out.join('\n');
}

const effSev = (f) => (f.sev === 'Critical' && f.verdict !== 'CONFIRMED' ? 'Important' : f.sev);
// The findings section of the final report, from the merged file. The verdict, tension axes, excluded-item conflicts and the
// next mode are the main thread's judgement. Over 15 open findings the whole thing goes to a file.
function cmdRunReport(root, args) {
  const { dir, led } = loadRun(root, args);
  const m = readMerged(dir) || newMerged();
  const open = m.findings.filter((f) => f.status === 'open');
  const by = { Critical: [], Important: [], Suggested: [] };
  for (const f of open) by[effSev(f)].push(f);
  const line = (f) => `${f.file}:${f.line} — ${f.summary} — ${effSev(f)} — fix: ${f.fix || 'n/a'} — ${f.lenses.join('+')}${f.verdict ? ` — ${f.verdict}` : ''}${f.sev !== effSev(f) ? ` (raised as Critical, ${f.verdict || 'unverified'})` : ''}`;
  const body = [];
  for (const s of ['Critical', 'Important', 'Suggested']) if (by[s].length) {
    body.push(`## ${s} (${by[s].length})`);
    for (const f of by[s]) { body.push(`- ${line(f)}`); if (s !== 'Suggested' && f.scenario) body.push(`    scenario: ${f.scenario}`); if (f.also) body.push(`    also: ${f.also}`); }
  }
  const tension = open.filter((f) => f.tension); if (tension.length) body.push('## Tension axes', ...tension.map((f) => `- ${f.file}:${f.line} — ${f.tension}`));
  const leads = m.leads.filter((l) => l.verdict !== 'REFUTED');
  if (leads.length) body.push('## Needs validation (not findings, not counted in the verdict)', ...leads.map((l) => `- ${l.id} [${l.verdict || 'unjudged'}] ${l.text}`));
  const tr = m.traced.filter((t) => /—\s*(covered|finding|blocked)\b/i.test(t));
  const un = m.traced.filter((t) => /^(uncovered|thin|gap):/i.test(t));
  if (tr.length || un.length) body.push('## Attack surface (from the reviewers\' traced lines)', `- traced: ${tr.length} entry point(s): ${['covered', 'finding', 'blocked'].map((k) => `${tr.filter((t) => new RegExp(`—\\s*${k}\\b`, 'i').test(t)).length} ${k}`).join(', ')}`, ...un.slice(0, 20).map((t) => `- not reviewed: ${t}`));
  if (m.hardening.length) body.push('## Hardening (never in the verdict)', ...m.hardening.map((h) => `- ${h}`));
  const gone = m.findings.filter((f) => f.status === 'dropped');
  const notes = [];
  if (gone.length) notes.push(`dropped ${gone.length}: ${gone.map((f) => `${f.id} (${f.dropReason.slice(0, 60)})`).join('; ')}`);
  const unv = open.filter((f) => SEV_RANK[f.sev] >= 2 && !f.verdict); if (unv.length) notes.push(`UNVERIFIED Critical/Important: ${unv.map((f) => f.id).join(' ')} (run verify-plan and verdicts, or say they are unverified)`);
  if (m.unparsed.length) notes.push(`NOT MERGED (unparsed units): ${m.unparsed.map((x) => x.unit).join(', ')}`);
  const cov = cmdRunStatus(root, args).split('\n').find((l) => l.startsWith('coverage:')) || '';
  const head = [cov, `findings: ${by.Critical.length} Critical, ${by.Important.length} Important, ${by.Suggested.length} Suggested`, ...notes].filter(Boolean);
  const outFile = flagValue(args, '--out') || path.join(dir, 'artifacts', 'report.md');
  const full = [...head, '', ...body].join('\n');
  if (open.length <= 15) return full;
  atomicWrite(outFile, `${full}\n`);
  return [...head, '', ...body.filter((l) => !/^- .* — Suggested — /.test(l)), '', `${open.length} open findings: the full report, with every Suggested line, is in ${outFile}`].join('\n');
}

function cmdRun(root, args) {
  const [sub, ...rest] = args;
  switch (sub) {
    case 'hook': return cmdRunHook();
    case 'prep': return cmdRunPrep(root, rest);
    case 'merge': return cmdRunMerge(root, rest);
    case 'edit': return cmdRunEdit(root, rest);
    case 'verify-plan': return cmdRunVerifyPlan(root, rest);
    case 'verdicts': return cmdRunVerdicts(root, rest);
    case 'report': return cmdRunReport(root, rest);
    case 'init': return cmdRunInit(root, rest);
    case 'next': return cmdRunNext(root, rest);
    case 'done': return cmdRunDone(root, rest);
    case 'fail': return cmdRunFail(root, rest);
    case 'status': return cmdRunStatus(root, rest);
    case 'results': return cmdRunResults(root, rest);
    case 'add': return cmdRunAdd(root, rest);
    case 'save': return cmdRunSave(root, rest);
    case 'load': return cmdRunLoad(root, rest);
    case 'list': return cmdRunList(root);
    default: throw new Error('usage: run init --modes <m> <scope> [--bundle|--independent|--fresh|--budget N] | prep | next [--fill 6 | --n 4] [--returned <unit>] [--shards K] [--kind K] | done <id> (stdin) | fail <id> --reason T [--limit] | status | results [--kind lens|verify|look] | merge [--reset] | edit <F-id> ... | verify-plan [--per 8] [--no-look] | verdicts | report [--out F] | add <id> (stdin) | save <name> [--append] (stdin) | load <name> | list | hook (SubagentStop, stdin)   (add --run <id> to pick a run)');
  }
}

// ---------- self-test ----------

function selfTest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'code-tools-'));
  const write = (rel, text) => { const p = path.join(tmp, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };
  const run = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: tmp, stdio: 'pipe' });
  const ok = (name, fn) => { try { fn(); } catch (e) { e.message = `${name}: ${e.message}`; throw e; } };
  try {
    run('init', '-q', '-b', 'main');
    write('src/a.js', 'const a = 1;\nconst b = 2;\nconst c = 3;\n');
    write('src/util.js', 'export const u = 1;\n');
    write('app/b.py', 'x = 1\n');
    write('hot.js', 'let h = 0;\n');
    write('package.json', JSON.stringify({ dependencies: { left: '^1.0.0', pinned: '2.0.0', usedpkg: '3.1.4', gitdep: 'github:o/r' }, scripts: { lint: 'eslint .', test: 'node --test' } }));
    write('package-lock.json', JSON.stringify({ packages: { '': {}, 'node_modules/usedpkg': { version: '3.1.4', hasInstallScript: true, resolved: 'https://registry.npmjs.org/usedpkg/-/usedpkg-3.1.4.tgz' } } }));
    write('README.md', '# T\n\nSee [util](src/util.js) and [gone](src/missing.js) and [anchor](#nope). Run `npm run nonexistent`. Old name: oldname.js\n');
    write('oldname.js', 'export const o = 1;\n');
    run('add', '-A'); run('commit', '-q', '-m', 'one');
    run('branch', 'base');
    for (let i = 0; i < 3; i++) { write('hot.js', `let h = ${i + 1};\n`); run('add', '-A'); run('commit', '-q', '-m', `fix: hot ${i}`); }
    write('src/a.js', 'const a = 1;\nconst b = 22;\nconst c = 3;\neval(userInput);\n'); // committed below
    run('add', '-A'); run('commit', '-q', '-m', 'two');
    // working tree: unstaged modification, staged addition, untracked file, a rename, a migration
    write('app/b.py', 'x = 1\ny = 2\n');
    write('src/staged.js', 'import { u } from "./util";\ncatch (e) {}\n'); run('add', 'src/staged.js');
    write('src/new.js', 'const password = "hunter2hunter2";\n');
    write('migrations/001_init.sql', 'create table t(id int);\n');
    run('mv', 'oldname.js', 'newname.js');

    ok('scope --changes base (committed + working tree)', () => {
      const s = cmdScope(tmp, ['--changes', 'base']);
      for (const f of ['src/a.js', 'hot.js', 'app/b.py', 'src/staged.js', 'src/new.js']) assert.match(s, new RegExp(f.replace('.', '\\.')), `${f} in scope`);
      assert.match(s, /src\/a\.js[^\n]*lines [^\n]*4/, 'hunk range for the new eval line');
      assert.doesNotMatch(s, /package-lock/);
      assert.match(s, /change-safety lens: TRIGGERED by migrations\/001_init\.sql/);
      assert.match(s, /fast-path eligible for quality: yes/);
    });
    ok('scope --changes (no upstream: main == HEAD, so working tree only)', () => {
      const s = cmdScope(tmp, ['--changes']);
      assert.match(s, /app\/b\.py/); assert.match(s, /src\/new\.js/); assert.doesNotMatch(s, /hot\.js/, 'committed work is not "unpushed" without a remote base');
    });
    ok('aliases', () => {
      const body = (a) => cmdScope(tmp, a).split('\n').slice(1).join('\n');
      assert.equal(body(['--commit']), body(['--changes']), '--commit lists what --changes lists');
      assert.match(cmdScope(tmp, ['--commit']).split('\n')[0], /alias of --changes/);
      assert.equal(body(['--ref', 'base']), body(['--changes', 'base']), '--ref is --changes <ref>');
      assert.match(cmdScope(tmp, ['--session']).split('\n')[0], /intersect/);
    });
    ok('path narrows a scope; a path alone means --all inside it', () => {
      const s = cmdScope(tmp, ['--changes', 'base', 'src']);
      assert.match(s, /src\/a\.js/); assert.doesNotMatch(s, /app\/b\.py/);
      const all = cmdScope(tmp, ['app']);
      assert.match(all, /whole codebase under app/); assert.match(all, /app\/b\.py/); assert.doesNotMatch(all, /src\/a\.js/);
      assert.match(cmdScope(tmp, ['--all', 'src/*.js']), /src\/util\.js/);
    });
    ok('--all skips lockfiles', () => { const s = cmdScope(tmp, ['--all']); assert.match(s, /package\.json/); assert.doesNotMatch(s, /package-lock/); });
    ok('bad ref, two scopes, no scope', () => {
      assert.throws(() => cmdScope(tmp, ['--ref', 'nope-not-a-ref']), /does not resolve/);
      assert.throws(() => cmdScope(tmp, ['--changes', 'nope-not-a-ref']), /does not resolve/);
      assert.throws(() => cmdScope(tmp, ['--all', '--changes']), /choose one scope/);
      assert.throws(() => cmdScope(tmp, []), /a scope is required/);
    });
    ok('shards: even, riskiest first', () => {
      const s = cmdShards(tmp, ['--all', '--budget', '3']);
      const n = Number(s.match(/shards: (\d+)/)[1]);
      assert.ok(n >= 3, `several shards, got ${n}`);
      const first = s.split('\n').find((l) => l.startsWith('shard 1:'));
      assert.match(s, /riskiest/);
      assert.match(cmdShards(tmp, ['--all', '--budget', '3', '--files']), /shard 1:[^\n]*\n(    [^\n]*\n)*/);
      assert.ok(first, 'shard 1 present');
    });
    ok('hotspots', () => assert.match(cmdHotspots(tmp, []).split('\n')[1], /hot\.js/));
    ok('prefilter on changed lines only, and whole files', () => {
      const p = cmdPrefilter(tmp, ['--changes', 'base']);
      assert.match(p, /dynamic-eval/); assert.match(p, /empty-catch/); assert.match(p, /hardcoded-secret/);
      assert.match(cmdPrefilter(tmp, ['--changes', 'base']), /changed lines only/);
      assert.doesNotMatch(cmdPrefilter(tmp, ['src/a.js', '--mode', 'performance']), /dynamic-eval/, 'mode filters leads');
    });
    ok('prefilter sees PowerShell and workflow files', () => {
      write('s.ps1', 'Invoke-Expression $x\nGet-Item a -ErrorAction SilentlyContinue\n$a += 1\n');
      write('.github/workflows/ci.yml', 'on: pull_request_target\njobs:\n  b:\n    steps:\n      - uses: someone/action@v1\n');
      const p = cmdPrefilter(tmp, ['s.ps1', '.github/workflows/ci.yml']);
      for (const id of ['ps-invoke-expression', 'ps-silent-failure', 'ps-array-append', 'actions-pull-request-target', 'actions-unpinned-third-party']) assert.match(p, new RegExp(id), id);
      fs.rmSync(path.join(tmp, 's.ps1')); fs.rmSync(path.join(tmp, '.github'), { recursive: true });
    });
    ok('gates', () => {
      const g = cmdGates(tmp);
      assert.match(g, /npm run lint/); assert.match(g, /npm run test/); assert.match(g, /npm audit/);
      write('.claude/REVIEW.md', '## Gates\n\n| Kind | Command | Speed |\n| --- | --- | --- |\n| lint | `<!-- e.g. npm run lint -->` | fast |\n| typecheck | `npm run typecheck` | fast |\n');
      const g2 = cmdGates(tmp);
      assert.match(g2, /typecheck\s+npm run typecheck\s+fast/); assert.doesNotMatch(g2, /e\.g\./);
      fs.rmSync(path.join(tmp, '.claude'), { recursive: true });
    });
    ok('deps: pins, unused, install scripts, non-registry', () => {
      const d = cmdDeps(tmp);
      assert.match(d, /unpinned\s+left@\^1\.0\.0/); assert.doesNotMatch(d, /unpinned\s+pinned@/);
      assert.match(d, /non-registry source\s+gitdep@github:o\/r/);
      assert.match(d, /install scripts[^\n]*: 1/); assert.match(d, /usedpkg@3\.1\.4/);
    });
    ok('stack', () => {
      write('x.ps1', 'Write-Output 1\n'); write('wpfapp/WpfApp.csproj', '<Project><PropertyGroup><UseWPF>true</UseWPF></PropertyGroup></Project>');
      const s = cmdStack(tmp);
      assert.match(s, /powershell/); assert.match(s, /wpf/); assert.match(s, /csharp/); assert.match(s, /typescript/);
      fs.rmSync(path.join(tmp, 'x.ps1')); fs.rmSync(path.join(tmp, 'wpfapp'), { recursive: true });
    });
    ok('entrypoints', () => {
      write('srv.js', 'app.get("/x", (req, res) => {});\nconst a = process.argv[2];\n');
      const e = cmdEntrypoints(tmp, ['--all']);
      assert.match(e, /srv\.js:1  \[route\]/); assert.match(e, /srv\.js:2  \[cli\]/);
      fs.rmSync(path.join(tmp, 'srv.js'));
    });
    ok('entrypoints: Next.js route handlers and server actions, with guard and effect', () => {
      write('app/api/contact/route.ts', "import { Resend } from 'resend';\nexport async function POST(req) { await resend.emails.send({}); }\n");
      write('app/api/me/route.ts', "export const GET = async () => { const s = await getServerSession(); };\n");
      write('app/actions.ts', "'use server'\nexport async function save() {}\n");
      write('mw.ts', 'export function middleware(req) {}\n');
      const e = cmdEntrypoints(tmp, ['--all']);
      assert.match(e, /route\.ts:2  \[route\]/); assert.match(e, /actions\.ts:1  \[server-action\]/); assert.match(e, /mw\.ts:1  \[auth-hook\]/);
      assert.match(e, /app\/api\/contact\/route\.ts: route x1  \| guard: none \| effect: email/);
      assert.match(e, /app\/api\/me\/route\.ts: route x1  \| guard: auth/);
      assert.match(e, /trust leads[^\n]*\n\s+app\/api\/contact\/route\.ts[^\n]*email/); assert.doesNotMatch(e, /trust leads[\s\S]*api\/me/, 'a guarded route is not a lead');
      assert.match(e, /global auth hooks found: 1/);
      fs.rmSync(path.join(tmp, 'app/api'), { recursive: true }); fs.rmSync(path.join(tmp, 'app/actions.ts')); fs.rmSync(path.join(tmp, 'mw.ts'));
    });
    ok('prefilter: cors reflection, jwt, ssti, open redirect, error leak, stripe key, placeholder suppression', () => {
      write('sec.js', [
        'app.use(cors({ origin: true }));', 'const c = { jwtSecret: "realvalue12345" };', 'const d = { password: "changeme-please" };', 'const e = { apiKey: "test-bunq-api-key" };', 'const f = { apiKey: "latestrealkey99" };',
        `const k = "sk_live_${'a'.repeat(24)}";`, 'jwt.decode(token);', 'res.redirect(req.query.next);', 'res.json({ error: err.message });', 'render_template_string(x)',
        'app.run(debug=True)', 'resp.headers["Access-Control-Allow-Origin"] = req.headers.origin',
      ].join('\n') + '\n');
      const p = cmdPrefilter(tmp, ['sec.js']);
      for (const id of ['cors-any-origin', 'hardcoded-secret', 'known-token-shape', 'jwt-weak-verify', 'open-redirect', 'error-leak', 'ssti', 'debug-on']) assert.match(p, new RegExp(`\\[security/${id}\\]`), id);
      assert.doesNotMatch(p, /changeme|test-bunq/, 'a placeholder value is not a secret lead');
      assert.match(p, /latestrealkey99/, '"test" inside a longer word is not a placeholder');
      assert.equal((p.match(/cors-any-origin/g) || []).length, 2, 'origin: true and the reflected header');
      fs.rmSync(path.join(tmp, 'sec.js'));
    });
    ok('deps: vendored libraries named by path or banner', () => {
      write('public/lib/jquery.min.js', '/*! jQuery v3.4.1 | (c) JS Foundation */\n!function(){}();\n');
      write('vendor/three@0.143.0/build/three.module.js', 'export const x = 1;\n');
      const d = cmdDeps(tmp);
      assert.match(d, /vendored front-end libraries: 2/); assert.match(d, /jQuery 3\.4\.1\s+public\/lib\/jquery\.min\.js/); assert.match(d, /three 0\.143\.0/);
      fs.rmSync(path.join(tmp, 'public'), { recursive: true }); fs.rmSync(path.join(tmp, 'vendor'), { recursive: true });
    });
    ok('dependents', () => assert.match(cmdDependents(tmp, ['src/util.js']), /src\/util\.js\s+<-\s+src\/staged\.js/));
    ok('names: a renamed file still cited in the README', () => {
      const n = cmdNames(tmp, []);
      assert.match(n, /renamed: oldname\.js -> newname\.js/); assert.match(n, /README\.md:3/);
    });
    ok('doclinks', () => {
      const d = cmdDoclinks(tmp, ['README.md']);
      assert.match(d, /broken link: src\/missing\.js/); assert.match(d, /no heading for anchor: #nope/); assert.match(d, /npm run nonexistent/);
      assert.doesNotMatch(d, /broken link: src\/util\.js/);
    });
    ok('tests-map', () => {
      write('src/a.test.js', 'import "./a";\n');
      const t = cmdTestsMap(tmp, ['--changes', 'base']);
      assert.match(t, /src\/a\.js\s+->\s+src\/a\.test\.js/); assert.match(t, /hot\.js\s+->\s+NO TEST FILE FOUND/);
      fs.rmSync(path.join(tmp, 'src/a.test.js'));
    });
    ok('coverage of the changed lines', () => {
      write('coverage/lcov.info', 'SF:src/a.js\nDA:1,1\nDA:2,1\nDA:3,1\nDA:4,0\nend_of_record\n');
      const c = cmdCoverage(tmp, ['--changes', 'base']);
      assert.match(c, /src\/a\.js: [^\n]*covered/); assert.match(c, /app\/b\.py: not in the report/);
      fs.rmSync(path.join(tmp, 'coverage'), { recursive: true });
    });
    ok('history finds a secret shape without printing it', () => {
      write('leak.txt', `key = AKIA${'A'.repeat(16)}\n`); write('pay.txt', `STRIPE=sk_live_${'b'.repeat(24)}\n`); run('add', '-A'); run('commit', '-q', '-m', 'oops');
      const h = cmdHistory(tmp, []);
      assert.match(h, /leak\.txt\s+aws-key/); assert.doesNotMatch(h, /AKIAAAAA/);
      assert.match(h, /pay\.txt\s+stripe-live-key/); assert.doesNotMatch(h, /sk_live_b/);
    });
    ok('an empty scope stops the run', () => {
      // the history test committed everything, so the tree is clean and main == HEAD
      assert.throws(() => cmdScope(tmp, ['--changes']), /empty scope/);
    });
    ok('lang: sections by lens, with a whole-file fallback', () => {
      const ld = path.join(tmp, 'langs'); fs.mkdirSync(ld);
      fs.writeFileSync(path.join(ld, 'x.md'), 'intro\n\n## Review Priorities\n\n### CRITICAL -- Security\n- sqli\n\n### HIGH -- Code Quality\n- big fns\n\n### MEDIUM -- Performance\n- loops\n\n## Diagnostic Commands\n\nrun lint\n');
      const sec = cmdLang(['x', '--lens', 'security', '--langdir', ld]);
      assert.match(sec, /sqli/); assert.doesNotMatch(sec, /big fns|loops/);
      assert.match(cmdLang(['x', '--lens', 'performance', '--langdir', ld]), /loops/);
      fs.writeFileSync(path.join(ld, 'y.md'), '## Notes\n- one thing\n');
      assert.match(cmdLang(['y', '--lens', 'security', '--langdir', ld]), /whole checklist/);
    });

    ok('entrypoints: an unsigned webhook route is a trust lead, a signed one is not', () => {
      write('app/api/webhooks/stripe/route.ts', 'export async function POST(req) { const e = await req.json(); await db.insert(e); }\n');
      write('app/api/webhooks/github/route.ts', "export async function POST(req) { const h = createHmac('sha256', s); await db.insert({}); }\n");
      const e = cmdEntrypoints(tmp, ['--all']);
      assert.match(e, /webhooks\/stripe\/route\.ts[^\n]*inbound webhook route with no signature/);
      assert.doesNotMatch(e, /webhooks\/github\/route\.ts[^\n]*no signature/, 'a signature marker clears the lead');
      fs.rmSync(path.join(tmp, 'app/api'), { recursive: true });
    });
    ok('prefilter: the security patterns taken from the Cloudflare comparison, each with a clean negative', () => {
      write('sec2.cs', 'var f = new BinaryFormatter();\nvar p = new NamedPipeServerStream("x");\nvar s = new JsonSerializerSettings { TypeNameHandling = TypeNameHandling.All };\nvar n = new JsonSerializerSettings { TypeNameHandling = TypeNameHandling.None };\n');
      write('sec2.js', ['// TODO: add auth check here', '// TODO: rename this variable', 'const note = "skeleton TODO fields validated by hand";', 'window.parent.postMessage(JSON.stringify(d), "*");', 'window.parent.postMessage(d, window.location.origin);',
        'window.addEventListener("message", onMsg);', 'localStorage.setItem("authToken", t);', 'localStorage.setItem("theme", t);', '_.merge(target, req.body);', 'const u = "javascript:void(0)";'].join('\n') + '\n');
      write('.github/workflows/ci.yml', 'on: pull_request_target\npermissions: write-all\nsteps:\n  - uses: actions/checkout@v4\n    with:\n      ref: ${{ github.event.pull_request.head.sha }}\n');
      write('Dockerfile', 'FROM node:20.1.0\nCOPY . .\nCOPY --from=build /app .\nCOPY package.json ./\n');
      const p = cmdPrefilter(tmp, ['sec2.cs', 'sec2.js', '.github/workflows/ci.yml', 'Dockerfile']);
      const n = (id) => (p.match(new RegExp(`\\[security/${id}\\]`, 'g')) || []).length;
      for (const id of ['dotnet-unsafe-deserialization', 'named-pipe-server', 'todo-security', 'postmessage-wildcard', 'postmessage-handler', 'token-in-web-storage', 'prototype-pollution-merge', 'javascript-url', 'actions-pr-head-checkout', 'actions-write-all', 'docker-copy-all']) assert.ok(n(id) >= 1, `${id} fires`);
      assert.equal(n('dotnet-unsafe-deserialization'), 2, 'BinaryFormatter and TypeNameHandling.All, not TypeNameHandling.None');
      assert.equal(n('todo-security'), 1, 'a TODO with no security word, or a TODO word inside a string, is not a lead');
      assert.equal(n('postmessage-wildcard'), 1, 'posting to the page origin is fine');
      assert.equal(n('token-in-web-storage'), 1, 'a theme preference is not a token');
      assert.equal(n('docker-copy-all'), 1, 'COPY --from and a named file are fine');
      for (const f of ['sec2.cs', 'sec2.js', 'Dockerfile']) fs.rmSync(path.join(tmp, f));
      fs.rmSync(path.join(tmp, '.github'), { recursive: true });
    });
    ok('domains: candidates come with evidence; every id has a domain file; the recon and critic lenses exist', () => {
      write('svc/Guard.csproj', '<Project><PropertyGroup><UseWPF>true</UseWPF></PropertyGroup></Project>');
      write('svc/Pipe.cs', 'var s = new NamedPipeServerStream("p");\n');
      write('chat.js', 'const r = await client.messages.create({});\n');
      write('.github/workflows/ci.yml', 'on: push\n');
      const d = cmdDomains(tmp, ['--all']);
      assert.match(d, /desktop-ipc\s+[^\n]*NamedPipeServerStream/); assert.match(d, /ai-llm\s+[^\n]*chat\.js:1/); assert.match(d, /supply-chain-deploy\s+[^\n]*ci\.yml/);
      assert.doesNotMatch(d, /webhooks-abuse/, 'nothing in the fixture points at a webhook or an upload');
      assert.match(cmdDomains(tmp, ['--all', 'src']), /^domains: no candidate found/, 'a scope with no signal proposes nothing');
      fs.rmSync(path.join(tmp, 'svc'), { recursive: true });
      write('.claude/toolkit/MANIFEST.json', JSON.stringify({ files: { 'agents/vendored.cs': 'h' } }));
      write('.claude/agents/vendored.cs', 'var h = AddHostObjectToScript;\n');
      write('notes.md', 'one day we may use NamedPipeServerStream\n');
      assert.doesNotMatch(cmdDomains(tmp, ['--all']), /desktop-ipc/, 'a file the toolkit sync copied in, or prose in a markdown file, is not evidence');
      fs.rmSync(path.join(tmp, 'notes.md'));
      write('.claude/agents/own.cs', 'var h = AddHostObjectToScript;\n');
      assert.match(cmdDomains(tmp, ['--all']), /desktop-ipc\s+[^\n]*own\.cs/, 'a file the project owns still counts');
      fs.rmSync(path.join(tmp, '.claude'), { recursive: true });
      const refs = (rel) => fileURLToPath(new URL(`../../../agents/references/${rel}`, import.meta.url));
      for (const [id] of DOMAINS) assert.ok(fs.existsSync(refs(`security-domains/${id}.md`)), `security-domains/${id}.md is missing`);
      for (const l of ['recon', 'coverage-critic']) assert.ok(fs.existsSync(refs(`lenses/${l}.md`)), `lenses/${l}.md is missing`);
      fs.rmSync(path.join(tmp, 'chat.js')); fs.rmSync(path.join(tmp, '.github'), { recursive: true });
    });
    ok('cite-check: a real line resolves; a missing file, a line past the end and a traversal do not; URLs are ignored', () => {
      write('cite/x.js', 'a\nb\nc\n');
      const realIn = readStdin;
      try {
        readStdin = () => 'cite/x.js:3\ncite/x.js:2-3\ncite/x.js:900\ncite/nope.js:1\n../outside.js:1\nsee http://localhost:3000 and example.com:443\ncite/x.js:3\n';
        const out = cmdCiteCheck(tmp);
        assert.match(out, /5 citation\(s\), 2 resolved, 3 unresolved/);
        assert.match(out, /cite\/x\.js:900  line 900 is past the end \(3 lines\)/); assert.match(out, /cite\/nope\.js:1  no such file/); assert.match(out, /\.\.\/outside\.js:1  outside the project root/);
        assert.doesNotMatch(out, /localhost|example\.com/);
        readStdin = () => 'nothing cited here, only http://localhost:3000';
        assert.match(cmdCiteCheck(tmp), /no path:line citations/);
      } finally { readStdin = realIn; fs.rmSync(path.join(tmp, 'cite'), { recursive: true }); }
    });
    ok('origin: host/owner/repo for every remote form, never a credential; none without a remote', () => {
      const o = fs.mkdtempSync(path.join(os.tmpdir(), 'code-origin-'));
      try {
        const g = (...a) => execFileSync('git', a, { cwd: o, stdio: 'pipe' });
        g('init', '-q', '-b', 'main');
        assert.equal(originOf(o), 'none');
        g('remote', 'add', 'origin', 'https://user:SECRETTOKEN@github.com/vdwolde/demo.git');
        assert.equal(originOf(o), 'github.com/vdwolde/demo');
        g('remote', 'set-url', 'origin', 'git@github.com:vdwolde/demo.git');
        assert.equal(originOf(o), 'github.com/vdwolde/demo');
        g('remote', 'set-url', 'origin', 'ssh://git@host.example:2222/team/app.git');
        assert.equal(originOf(o), 'host.example/team/app');
      } finally { fs.rmSync(o, { recursive: true, force: true }); }
      assert.match(cmdScope(tmp, ['--all']).split('\n')[1], /^origin: none/, 'scope prints the origin as its second line');
    });
    ok('scope leaves out the files a toolkit sync copied in, so every helper sees only the project', () => {
      write('.claude/toolkit/MANIFEST.json', JSON.stringify({ files: { 'agents/v.js': 'h' } }));
      write('.claude/agents/v.js', 'eval(x);\napp.get("/v", () => {});\n');
      write('.claude/agents/own.js', 'eval(y);\n');
      const s = cmdScope(tmp, ['--all']);
      assert.doesNotMatch(s, /agents\/v\.js/); assert.match(s, /agents\/own\.js/); assert.match(s, /1 vendored toolkit files/);
      const p = cmdPrefilter(tmp, ['--all', '--mode', 'security']);
      assert.doesNotMatch(p, /agents\/v\.js/); assert.match(p, /agents\/own\.js/);
      assert.doesNotMatch(cmdEntrypoints(tmp, ['--all']), /agents\/v\.js/);
      fs.rmSync(path.join(tmp, '.claude'), { recursive: true });
    });
    ok('hashDir changes when a file in the folder changes, and is empty for a missing folder', () => {
      const d = path.join(tmp, 'hd'); fs.mkdirSync(d);
      fs.writeFileSync(path.join(d, 'a.md'), 'one'); const h1 = hashDir(d);
      fs.writeFileSync(path.join(d, 'a.md'), 'two'); assert.notEqual(hashDir(d), h1);
      assert.equal(hashDir(path.join(tmp, 'no-such-dir')), '');
      fs.rmSync(d, { recursive: true });
    });

    // ---- run ledger (state goes to a temp dir, never the real one)
    const stateTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'code-state-'));
    process.env.CODE_REVIEW_STATE = stateTmp;
    const realStdin = readStdin;
    const feed = (text) => { readStdin = () => text; };
    const count = (s, re) => (s.match(re) || []).length;
    try {
      ok('run init: fast path bundles quality into one reader agent, with a brief on disk', () => {
        const s = cmdRun(tmp, ['init', '--modes', 'quality', '--changes', 'base']);
        assert.match(s, /new/); assert.match(s, /fast path/); assert.match(s, /units: 1 /);
        assert.match(s, /s1-reader\s+pending\s+review-reader\s+correctness\+design\+conventions\+change-safety/, 'change-safety joins (migration in scope)');
        const { dir } = loadRun(tmp, []);
        assert.match(fs.readFileSync(path.join(dir, 'briefs', 's1-reader.md'), 'utf8'), /changed lines/);
      });
      ok('run init --independent: one agent per lens; everything = 7 lenses (+change-safety) per shard', () => {
        const s = cmdRun(tmp, ['init', '--modes', 'quality', '--changes', 'base', '--independent']);
        assert.match(s, /one agent per lens per shard/); assert.match(s, /units: 4 /);
        const e = cmdRun(tmp, ['init', '--modes', 'everything', '--changes', 'base', '--bundle']);
        assert.match(e, /s1-reader/); assert.match(e, /s1-runner\s+pending\s+review-runner\s+performance\+security\+tests/);
      });
      ok('run init: bad mode, empty scope', () => {
        assert.throws(() => cmdRun(tmp, ['init', '--modes', 'nope', '--changes', 'base']), /unknown mode/);
        assert.throws(() => cmdRun(tmp, ['init', '--changes']), /needs --modes/);
        assert.throws(() => cmdRun(tmp, ['init', '--modes', 'quality', '--changes', 'base', 'no-such-dir']), /empty scope/);
      });
      const base = ['--modes', 'quality', '--changes', 'base', '--independent', '--budget', '5'];
      ok('waves, a limit error is not a result, a limit halts the run', () => {
        const init = cmdRun(tmp, ['init', ...base]);
        const total = Number(init.match(/units: (\d+)/)[1]);
        assert.ok(total > 4, `several shards, got ${total} units`);
        const w1 = cmdRun(tmp, ['next', '--n', '2']);
        assert.equal(count(w1, /^s\d+-/gm), 2, 'a wave of two');
        const w2 = cmdRun(tmp, ['next', '--n', '2']);
        assert.equal(count(w2, /^s\d+-/gm), 2);
        for (const l of w2.split('\n').slice(1)) assert.ok(!w1.includes(l.split('\t')[0] + '\t'), 'running units are not handed out twice');
        const first = w1.split('\n')[1].split('\t')[0];
        feed("You've hit your usage limit. Your limit will reset at 3pm.");
        assert.throws(() => cmdRun(tmp, ['done', first]), /usage-limit or rate error/);
        feed('   ');
        assert.throws(() => cmdRun(tmp, ['done', first]), /empty result/);
        feed('nothing found');
        assert.match(cmdRun(tmp, ['done', first]), /done s\d+-/);
        assert.match(cmdRun(tmp, ['fail', w1.split('\n')[2].split('\t')[0], '--reason', 'API Error: usage limit reached']), /HALTED/);
        assert.match(cmdRun(tmp, ['next']), /^halted at/, 'no wave while halted');
        assert.match(cmdRun(tmp, ['status']), /PARTIAL/);
        assert.match(cmdRun(tmp, ['results']), /nothing found/);
      });
      ok('resume: finished units are kept, the halt clears, unfinished units go back to pending', () => {
        const s = cmdRun(tmp, ['init', ...base]);
        assert.match(s, /resumed/); assert.match(s, /\(1 reused/);
        assert.doesNotMatch(cmdRun(tmp, ['next', '--n', '1']), /^halted/);
      });
      ok('a changed file invalidates only its own shard on resume', () => {
        cmdRun(tmp, ['init', ...base]); // a new session: whatever was running was cut off and is pending again
        for (let guard = 0; guard < 50; guard++) {
          const w = cmdRun(tmp, ['next', '--n', '50']);
          if (/^nothing to dispatch/.test(w)) break;
          for (const l of w.split('\n').slice(1)) { feed('nothing found'); cmdRun(tmp, ['done', l.split('\t')[0]]); }
        }
        assert.match(cmdRun(tmp, ['status']), /PARTIAL|coverage: (\d+) of \1 shards/);
        assert.doesNotMatch(cmdRun(tmp, ['status']), /PARTIAL/, 'every unit finished');
        const before = cmdRun(tmp, ['init', ...base]);
        assert.match(before, /to dispatch: 0/);
        write('hot.js', 'let h = 999;\n');
        const after = cmdRun(tmp, ['init', ...base]);
        const toDo = Number(after.match(/to dispatch: (\d+)/)[1]); const units = Number(after.match(/units: (\d+)/)[1]);
        assert.ok(toDo > 0 && toDo < units, `only the changed shard is redone (${toDo} of ${units})`);
        run('checkout', 'hot.js');
      });
      ok('--fresh archives the old run and reuses nothing; a failed unit stops retrying after three attempts', () => {
        const s = cmdRun(tmp, ['init', ...base, '--fresh']);
        assert.match(s, /new/); assert.match(s, /\(0 reused/);
        assert.ok(fs.readdirSync(path.join(repoState(tmp), 'archive')).length >= 1);
        const id = cmdRun(tmp, ['next', '--n', '1']).split('\n')[1].split('\t')[0];
        for (let i = 0; i < MAX_ATTEMPTS; i++) { cmdRun(tmp, ['fail', id, '--reason', 'agent crashed']); cmdRun(tmp, ['next', '--n', '50']); }
        assert.match(cmdRun(tmp, ['status']), /1 failed/);
      });
      ok('later-phase units (verify) and artifacts: added once, replaced only when their input changes', () => {
        feed('1. src/a.js:4 eval(userInput)');
        assert.match(cmdRun(tmp, ['add', 'v1']), /added/);
        feed('1. src/a.js:4 eval(userInput)');
        assert.match(cmdRun(tmp, ['add', 'v1']), /unchanged/);
        feed('1. src/a.js:4 eval(userInput)\n2. new finding');
        assert.match(cmdRun(tmp, ['add', 'v1']), /replaced/);
        feed('# merged\n- a'); cmdRun(tmp, ['save', 'merged']);
        assert.match(cmdRun(tmp, ['load', 'merged']), /# merged/);
        assert.throws(() => cmdRun(tmp, ['save', '../x']), /artifact name/);
        assert.match(cmdRun(tmp, ['list']), /UNFINISHED/);
      });
      ok('recon and critic units: dispatched by kind, and a pending unit keeps its brief across a resume', () => {
        const { dir } = loadRun(tmp, []);
        feed('map the boundaries');
        assert.match(cmdRun(tmp, ['add', 'recon1', '--lenses', 'recon', '--kind', 'recon']), /added/);
        const brief = path.join(dir, 'briefs', 'recon1.md');
        assert.match(fs.readFileSync(brief, 'utf8'), /## Lens: recon/, 'the lens file is inlined in the brief');
        const w = cmdRun(tmp, ['next', '--kind', 'recon', '--n', '4']);
        assert.match(w, /^dispatch 1 unit/); assert.match(w, /recon1\treview-reader\trecon\t/);
        assert.match(cmdRun(tmp, ['next', '--kind', 'critic']), /^nothing to dispatch/, 'a kind filter hands out only that kind');
        cmdRun(tmp, ['init', ...base]); // a new session: the briefs folder is deleted and the cut-off unit is pending again
        assert.ok(!fs.existsSync(brief), 'init removed the brief');
        feed('map the boundaries');
        assert.match(cmdRun(tmp, ['add', 'recon1', '--lenses', 'recon', '--kind', 'recon']), /unchanged \(pending\)/);
        assert.ok(fs.existsSync(brief), 'an unchanged add rewrites the missing brief');
      });
      ok('checklists follow the files in the shard, not the whole repo', () => {
        const js = langText(tmp, [{ file: 'src/a.js' }], ['correctness']);
        assert.match(js, /^# typescript:/m); assert.doesNotMatch(js, /^# python:/m);
        const py = langText(tmp, [{ file: 'app/b.py' }], ['security']);
        assert.match(py, /^# python:/m); assert.doesNotMatch(py, /^# typescript:/m);
        assert.equal(langText(tmp, [{ file: 'README.md' }], ['correctness']), '', 'a markdown file brings no language checklist');
        assert.equal(langText(tmp, [{ file: 'src/a.js' }], ['verify']), '', 'verify reads code itself');
      });
      ok('project rules: inlined per lens and per file kind, with an index of what was left out', () => {
        const b = fs.mkdtempSync(path.join(os.tmpdir(), 'code-base-'));
        try {
          fs.mkdirSync(path.join(b, 'Projects', 'X'), { recursive: true }); fs.mkdirSync(path.join(b, '.claude'), { recursive: true });
          fs.writeFileSync(path.join(b, '.claude', 'projects.json'), '{}');
          fs.writeFileSync(path.join(b, 'CLAUDE.md'), '# Base\n\n## Hard rules — start here\nHR-TEXT\n\n## Docs-first\nDOCS-TEXT\n\n## Windows dev-machine hygiene\nWIN-TEXT\n\n## Syncing two machines\nSYNC-TEXT\n');
          fs.writeFileSync(path.join(b, 'Projects', 'X', 'CLAUDE.md'), '# X\nPROJECT-TEXT\n');
          const proj = path.join(b, 'Projects', 'X');
          const rules = (root, lenses, files) => inlineRules(root, b, {}, lenses, { files: files.map((file) => ({ file })), shared: false, langs: false }).join('\n');
          const c = rules(proj, ['correctness'], ['src/a.js']);
          assert.match(c, /PROJECT-TEXT/); assert.match(c, /HR-TEXT/); assert.doesNotMatch(c, /DOCS-TEXT|WIN-TEXT|SYNC-TEXT/);
          assert.match(c, /NOT inlined[^\n]*Docs-first \(lines \d+-\d+\)[^\n]*Windows dev-machine hygiene \(lines/, 'what was left out is listed with its line range');
          assert.match(rules(proj, ['conventions'], ['src/a.js']), /DOCS-TEXT/); assert.doesNotMatch(rules(proj, ['conventions'], ['src/a.js']), /WIN-TEXT/);
          assert.match(rules(proj, ['correctness'], ['tools/run.ps1']), /WIN-TEXT/, 'a PowerShell file brings the Windows rules');
          assert.match(rules(proj, ['security'], ['projects.json']), /SYNC-TEXT/);
          const self = rules(b, ['correctness'], ['src/a.js']);
          assert.match(self, /also the Development Base rules/); assert.equal((self.match(/HR-TEXT/g) || []).length, 1, 'the base is not inlined twice');
          assert.match(inlineRules(tmp, b, {}, ['correctness'], { shared: false, langs: false }).join('\n'), /No CLAUDE\.md found/, 'a project outside the base with no CLAUDE.md says so');
        } finally { fs.rmSync(b, { recursive: true, force: true }); }
      });
      ok('briefs are self-contained and carry only the shared sections addressed to the unit', () => {
        cmdRun(tmp, ['init', ...base, '--fresh']);
        feed('## correctness\nLEAD-FOR-CORRECTNESS\n\n## docs\nLEAD-FOR-DOCS\n\n## all\nFOR-EVERYONE\n'); cmdRun(tmp, ['save', 'shared']);
        feed('## design\nGENERATED-FOR-DESIGN\n'); cmdRun(tmp, ['save', 'prep']);
        feed('## all\nAPPENDED-LATER\n'); assert.match(cmdRun(tmp, ['save', 'shared', '--append']), /appended to/);
        const rows = cmdRun(tmp, ['next', '--n', '50']).split('\n').slice(1).map((l) => l.split('\t'));
        const brief = (lens) => fs.readFileSync(rows.find((c) => c[2] === lens)[3], 'utf8');
        const c = brief('correctness'); const d = brief('design');
        for (const re of [/## Core rules/, /## Lens: correctness/, /LEAD-FOR-CORRECTNESS/, /FOR-EVERYONE/, /APPENDED-LATER/, /Files to review/]) assert.match(c, re);
        assert.doesNotMatch(c, /LEAD-FOR-DOCS|GENERATED-FOR-DESIGN/); assert.match(d, /GENERATED-FOR-DESIGN/); assert.doesNotMatch(d, /LEAD-FOR-CORRECTNESS/);
        assert.doesNotMatch(c, /Read ~\/\.claude\/agents\/references\/review-core\.md/, 'no instruction to read the core rules again');
      });
      ok('rolling dispatch keeps a fixed number in flight', () => {
        cmdRun(tmp, ['init', ...base, '--fresh']);
        assert.equal(count(cmdRun(tmp, ['next', '--fill', '3']), /^s\d+-/gm), 3);
        assert.match(cmdRun(tmp, ['next', '--fill', '3']), /nothing to dispatch now .*fill target is reached/);
        assert.throws(() => cmdRun(tmp, ['next', '--fill', 'x']), /need a number/);
      });
      ok('stop hook: the reply lands in the inbox, next folds it in, a missing result is flagged, a limit halts', () => {
        cmdRun(tmp, ['init', ...base, '--fresh']);
        const { dir } = loadRun(tmp, []);
        const ids = cmdRun(tmp, ['next', '--fill', '2']).split('\n').filter((l) => /^s\d+-/.test(l)).map((l) => l.split('\t')[0]);
        assert.equal(ids.length, 2);
        const transcript = path.join(os.tmpdir(), `code-hook-${process.pid}.jsonl`);
        const hook = (unit, msg) => {
          fs.writeFileSync(transcript, `${JSON.stringify({ type: 'user', message: { content: `Read your brief at ${path.join(dir, 'briefs', `${unit}.md`)} and follow it exactly.` } })}\n`);
          feed(JSON.stringify({ agent_transcript_path: transcript, last_assistant_message: msg }));
          assert.equal(cmdRun(tmp, ['hook']), '', 'the hook prints nothing');
        };
        try {
          hook(ids[0], 'nothing found');
          const n1 = cmdRun(tmp, ['next', '--fill', '2', '--returned', ids[0]]);
          assert.match(n1, new RegExp(`stored by the hook: ${ids[0]} stored`)); assert.doesNotMatch(n1, /NOT STORED/); assert.match(n1, /dispatch 1 unit/, 'the freed slot is refilled');
          assert.match(cmdRun(tmp, ['results']), /nothing found/);
          hook(ids[0], 'a late duplicate'); assert.doesNotMatch(cmdRun(tmp, ['next', '--fill', '9']), /stored by the hook/, 'a unit already stored is not stored twice');
          assert.match(cmdRun(tmp, ['next', '--fill', '2', '--returned', ids[1]]), /NOT STORED: .*run done/, 'no hook result: tell the caller to pipe the reply');
          hook(ids[1], "You've hit your usage limit. Your limit will reset at 3pm.");
          assert.match(cmdRun(tmp, ['next', '--fill', '2']), /FAILED \(limit: run halted\)[\s\S]*halted at/);
          fs.writeFileSync(transcript, 'not a brief prompt\n'); feed(JSON.stringify({ agent_transcript_path: transcript, last_assistant_message: 'x' }));
          assert.equal(cmdRun(tmp, ['hook']), '', 'an unknown transcript is ignored, never an error');
          feed('{ not json'); assert.equal(cmdRun(tmp, ['hook']), '');
        } finally { try { fs.unlinkSync(transcript); } catch { /* gone */ } }
      });
      const led0 = (dir) => readLedger(dir).units.find((u) => u.kind === 'lens').id;
      ok('lastReply: the SubagentHandback message, else the last assistant text, else nothing', () => {
        const row = (o) => JSON.stringify(o);
        const hand = [row({ type: 'user', message: { role: 'user', content: 'go' } }), row({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'thinking', thinking: '' }, { type: 'tool_use', name: 'SubagentHandback', input: { message: '### Suggested a.js:1 [design] x\nscenario: s\nfix: f' } }] } }), row({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', content: 'ok' }] } }), '{"partial'].join('\n');
        assert.match(lastReply(hand), /^### Suggested a\.js:1 \[design\] x/);
        assert.equal(lastReply([row({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'nothing found' }] } })].join('\n')), 'nothing found');
        assert.equal(lastReply(row({ type: 'user', message: { role: 'user', content: 'go' } })), ''); assert.equal(lastReply(''), '');
        const transcript = path.join(os.tmpdir(), `code-hand-${process.pid}.jsonl`);
        try { // the hook with an empty last_assistant_message, as a fresh session sends it
          const { dir } = loadRun(tmp, []);
          const unit = led0(dir);
          fs.writeFileSync(transcript, `${row({ type: 'user', message: { content: `Read your brief at ${path.join(dir, 'briefs', `${unit}.md`)} and follow it exactly.` } })}\n${hand}\n`);
          feed(JSON.stringify({ agent_transcript_path: transcript, last_assistant_message: '' })); cmdRun(tmp, ['hook']);
          assert.match(fs.readFileSync(path.join(dir, 'inbox', `${unit}.md`), 'utf8'), /^### Suggested a\.js:1 \[design\] x/, 'the report is read from the handback call');
        } finally { try { fs.unlinkSync(transcript); } catch { /* gone */ } }
      });
      ok('parseResult: findings, trailing blocks, nothing found, and a reply it cannot parse', () => {
        const p = parseResult('### Critical src/a.js:4 [correctness] eval of input\nscenario: x reaches eval\nfix: remove it\nrule: R\n### Suggested C:\\x\\y.js:7-9 [design] shrink\nscenario: s\nfix: f\nneeds-validation:\n- a.js:1 — claim — blocked by: proxy — owner check: read it\nhardening:\n- note\ntraced:\n- GET /x — covered — a.js:3\n');
        assert.equal(p.findings.length, 2); assert.equal(p.findings[0].sev, 'Critical'); assert.equal(p.findings[0].rule, 'R'); assert.equal(p.findings[1].file, 'C:/x/y.js'); assert.equal(p.findings[1].line, '7-9');
        assert.equal(p.extras['needs-validation'].length, 1); assert.equal(p.extras.hardening[0], 'note'); assert.equal(p.extras.traced.length, 1);
        assert.ok(parseResult('nothing found').ok && parseResult('nothing found\ntraced:\n- e — covered — a.js:1').ok);
        assert.equal(parseResult('Looks fine to me, no issues at all.').ok, false);
        assert.equal(parseResult('### Important src/a.js:4 [design] multi\nfix: line one\n  continues here\n').findings[0].fix, 'line one continues here');
      });
      ok('findings pipeline: merge, edit, verify-plan with the second look, verdicts, report', () => {
        fs.writeFileSync(path.join(tmp, 'src', 'hr.js'), "import fs from 'node:fs';\nfs.writeFileSync(out, data);\n");
        const sh = (...a) => cmdRun(tmp, a);
        const doneAll = (texts) => {
          const rows = sh('next', '--fill', '20').split('\n').filter((l) => l.includes('\t')).map((l) => l.split('\t')[0]);
          for (const id of rows) { feed(texts[id] ?? 'nothing found'); sh('done', id); }
          return rows;
        };
        try {
          sh('init', '--modes', 'quality', '--all', 'src/hr.js');
          const { led } = loadRun(tmp, []);
          assert.deepEqual(led.units.map((u) => u.id).sort(), ['s1-conventions', 's1-correctness', 's1-design']);
          doneAll({
            's1-correctness': '### Critical src/hr.js:2 [correctness] write without a temp file\nscenario: a crash mid-write leaves a torn file\nfix: write a temp file, then rename\n### Suggested src/hr.js:1 [correctness] import style\nscenario: none\nfix: none\n',
            's1-design': '### Important src/hr.js:2 [design] torn write of data on a crash\nscenario: same\nfix: atomic write helper\n### Suggested src/ghost.js:9 [design] cites a file that is not there\nscenario: x\nfix: y\n',
            's1-conventions': 'The code looks fine overall, no issues.',
          });
          const merged = sh('merge');
          assert.match(merged, /2 open finding\(s\) \(1 Critical, 0 Important, 1 Suggested\), 1 dropped, 0 lead\(s\), 1 unparsed/);
          assert.match(merged, /F1 Critical src\/hr\.js:2 \[correctness,design\]/, 'same line from two lenses is one finding with both lenses');
          assert.match(merged, /DROPPED: unresolved citation: no such file/); assert.match(merged, /NOT PARSED, merge by hand: unit s1-conventions/);
          assert.match(sh('load', 'merged'), /also: \(design\) torn write/, 'the other lens\'s wording is kept');
          assert.match(sh('merge'), /merged 0 unit\(s\)/, 'a second merge adds nothing and loses nothing');
          assert.match(sh('edit', 'F2', '--severity', 'Important'), /severity Important/);
          assert.match(sh('edit', 'F2', '--severity', 'Suggested'), /Suggested/);
          assert.throws(() => sh('edit', 'F9', '--drop', 'x'), /no finding F9/);
          const plan = sh('verify-plan');
          assert.match(plan, /unit v1 added/); assert.match(plan, /unit look1 added/, 'a write in the file makes it a high-risk file');
          assert.match(fs.readFileSync(path.join(loadRun(tmp, []).dir, 'briefs', 'look1.md'), 'utf8'), /already reported[\s\S]*src\/hr\.js:2 write without a temp file/);
          assert.match(sh('verify-plan'), /^nothing to plan/, 'planning twice plans nothing twice');
          doneAll({ v1: 'F1 — PLAUSIBLE — the crash window cannot be traced to a reader', look1: 'nothing found' });
          const verdicts = sh('verdicts');
          assert.match(verdicts, /1 plausible/); assert.match(verdicts, /F1 is Critical but PLAUSIBLE: it will be reported as Important/);
          const rep = sh('report');
          assert.match(rep, /## Important \(1\)/); assert.match(rep, /raised as Critical, PLAUSIBLE/); assert.match(rep, /1 Important, 1 Suggested|0 Critical, 1 Important, 1 Suggested/); assert.doesNotMatch(rep, /## Critical/);
          const bogus = sh('edit', 'new', '--sev', 'Critical', '--at', 'src/hr.js:2', '--lens', 'manual', '--summary', 'bogus claim').match(/F\d+/)[0];
          assert.match(sh('verify-plan'), /unit v2 added/); assert.doesNotMatch(sh('verify-plan'), /look1/);
          doneAll({ v2: `${bogus} — REFUTED — guarded at src/hr.js:1` });
          assert.match(sh('verdicts'), new RegExp(`refuted ${bogus}: guarded`));
          assert.doesNotMatch(sh('report'), /bogus claim/, 'a refuted finding is not reported');
          assert.match(sh('edit', bogus, '--restore'), /restored/);
          for (let i = 0; i < 16; i++) sh('edit', 'new', '--sev', 'Suggested', '--at', 'src/hr.js:1', '--lens', 'manual', '--summary', `filler ${i}`);
          assert.match(sh('report'), /open findings: the full report, with every Suggested line, is in /, 'a long report goes to a file');
        } finally { fs.rmSync(path.join(tmp, 'src', 'hr.js'), { force: true }); }
      });
    } finally {
      readStdin = realStdin;
      delete process.env.CODE_REVIEW_STATE;
      fs.rmSync(stateTmp, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return probeSelfTest().then(() => 'self-test: all checks passed');
}

// ---------- main ----------

function main(argv) {
  const ri = argv.indexOf('--root');
  const root = ri >= 0 ? path.resolve(argv[ri + 1]) : process.cwd();
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case 'scope': return cmdScope(root, rest);
    case 'shards': return cmdShards(root, rest);
    case 'prefilter': return cmdPrefilter(root, rest);
    case 'gates': return cmdGates(root);
    case 'deps': return cmdDeps(root);
    case 'lang': return cmdLang(rest);
    case 'stack': return cmdStack(root);
    case 'hotspots': return cmdHotspots(root, rest);
    case 'entrypoints': return cmdEntrypoints(root, rest);
    case 'domains': return cmdDomains(root, rest);
    case 'cite-check': return cmdCiteCheck(root);
    case 'dependents': return cmdDependents(root, rest);
    case 'names': return cmdNames(root, rest);
    case 'doclinks': return cmdDoclinks(root, rest);
    case 'tests-map': return cmdTestsMap(root, rest);
    case 'coverage': return cmdCoverage(root, rest);
    case 'history': return cmdHistory(root, rest);
    case 'probe': return cmdProbe(root, rest);
    case 'run': return cmdRun(root, rest);
    case '--self-test': return selfTest();
    default: return 'usage: scope|shards|prefilter <--all | --changes [ref]> [path] | gates | deps | lang <name> [--lens L] | stack | hotspots | entrypoints | domains | cite-check (text on stdin) | dependents <file...> | names | doclinks | tests-map | coverage | history | probe <url> [--owned] | run <init|next [--kind K]|done|fail|status|results|add|save|load|list> | --self-test   (add --root <dir>)';
  }
}

Promise.resolve().then(() => main(process.argv.slice(2))).then((out) => { if (out !== '') console.log(out); }, (e) => {
  console.error(`code-tools: ${e.message}`);
  process.exit(e.code === 3 ? 3 : 1);
});
