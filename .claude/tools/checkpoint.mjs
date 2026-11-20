#!/usr/bin/env node
// checkpoint.mjs -- a small durable work ledger shared by the /design, /content and /prompt skills, so a usage
// limit or a lost cache never costs finished work. Zero dependencies. It reads and writes only its own state
// directory (%LOCALAPPDATA%\claude-checkpoints, or $CHECKPOINT_STATE), never a repository: SyncProjects
// auto-commits a dirty tree, so state inside a repo would be committed. (/code has its own, richer ledger in
// its code-tools.mjs, because it also shards, hashes and reuses results.)
//
// A JOB is one task: a skill plus a key you choose ("polish:whole-app", "humanize:docs/"). It holds ITEMS
// (phases, files, boards, briefs: anything with a status) and ARTIFACTS (named text: the Design Read, a
// findings list, a draft profile). The same skill, key and project find the same job again, so repeating the
// request resumes it. A job untouched for 7 days is set aside, because the code has moved on; --fresh does it
// on demand; a finished job is set aside by the next start.
//
//   node checkpoint.mjs start <skill> <key> [--title T] [--fresh]       open or resume a job; prints its state
//   node checkpoint.mjs add <skill> <item...> [--group g]               register items (existing ones keep their status)
//   node checkpoint.mjs begin <skill> <item>                            mark an item doing
//   node checkpoint.mjs done <skill> <item> [--note T | --stdin]        mark done, with a note kept for the report
//   node checkpoint.mjs fail <skill> <item> --reason T                  back to pending; a limit-shaped reason halts the job
//   node checkpoint.mjs next <skill> [--group g] [--n 4]                pending items (first the ones a dead session left doing)
//   node checkpoint.mjs status <skill>                                  counts, the halt, the artifacts, the resume line
//   node checkpoint.mjs results <skill> [--group g]                     the notes of the done items, in order
//   node checkpoint.mjs save <skill> <name> (stdin) | load <skill> <name>   named text, replaced on every save
//   node checkpoint.mjs finish <skill>                                  the job is complete
//   node checkpoint.mjs list <skill>                                    every job for this project
//   node checkpoint.mjs --self-test
//
// Add --root <dir> for another project (default: the current directory) and --job <id> to pick a job (default:
// the latest for this skill and project). Run with `node`, never as a compiled binary.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const MAX_AGE_DAYS = 7;
const LIMIT_RE = /usage limit|rate.?limit|limit (reached|exceeded|will reset)|quota|overloaded|too many requests|\b429\b|\b529\b|credit balance|resets? (at|in)\b/i;
const sha = (x) => crypto.createHash('sha1').update(x).digest('hex');
let readStdin = () => fs.readFileSync(0, 'utf8');
const flag = (args, name) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : null; };
const VALUE = new Set(['--root', '--job', '--title', '--group', '--n', '--note', '--reason']);
const positional = (args) => { const o = []; for (let i = 0; i < args.length; i++) { if (VALUE.has(args[i])) { i++; continue; } if (!args[i].startsWith('--')) o.push(args[i]); } return o; };

const base = () => process.env.CHECKPOINT_STATE || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), '.cache'), 'claude-checkpoints');
function projDir(skill, root) {
  const abs = path.resolve(root);
  if (!/^[\w-]+$/.test(skill || '')) throw new Error('skill must be letters, digits, - or _');
  return path.join(base(), skill, `${path.basename(abs).replace(/[^\w.-]+/g, '_')}-${sha(abs.toLowerCase()).slice(0, 8)}`);
}
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
const readJob = (dir) => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'job.json'), 'utf8')); } catch { return null; } };
const saveJob = (dir, job) => { job.updated = new Date().toISOString(); atomicWrite(path.join(dir, 'job.json'), JSON.stringify(job, null, 1)); };
const jobsOf = (pd) => (fs.existsSync(path.join(pd, 'jobs')) ? fs.readdirSync(path.join(pd, 'jobs')) : [])
  .map((d) => ({ dir: path.join(pd, 'jobs', d), job: readJob(path.join(pd, 'jobs', d)) })).filter((x) => x.job);

function current(skill, args) {
  const pd = projDir(skill, flag(args, '--root') || process.cwd());
  const want = flag(args, '--job');
  const all = jobsOf(pd).sort((a, b) => String(b.job.updated).localeCompare(String(a.job.updated)));
  const hit = want ? all.find((x) => x.job.id === want) : all[0];
  if (!hit) throw new Error(`no ${skill} job for this project: open one with \`start ${skill} <key>\``);
  return { ...hit, pd };
}
const days = (iso) => (Date.now() - Date.parse(iso)) / 864e5;
const tally = (job) => { const c = { done: 0, doing: 0, pending: 0 }; for (const i of job.items) c[i.status]++; return c; };
const line = (i) => `  ${i.status.padEnd(7)} ${i.id}${i.group ? `  [${i.group}]` : ''}${i.note ? `  - ${i.note.split('\n')[0].slice(0, 100)}` : ''}${i.reason ? `  (last failure: ${i.reason.slice(0, 80)})` : ''}`;

function cmdStart([skill, key, ...rest]) {
  if (!key) throw new Error('usage: start <skill> <key> [--title T] [--fresh]');
  const root = flag(rest, '--root') || process.cwd();
  const pd = projDir(skill, root);
  const id = sha(`${skill}\0${key}`).slice(0, 8);
  const dir = path.join(pd, 'jobs', id);
  let job = readJob(dir); let why = '';
  if (job && (rest.includes('--fresh') || job.finished || days(job.updated) > MAX_AGE_DAYS)) {
    why = rest.includes('--fresh') ? 'set aside by --fresh' : job.finished ? 'the previous job had finished' : `the previous job was ${Math.floor(days(job.updated))} days old`;
    fs.mkdirSync(path.join(pd, 'archive'), { recursive: true });
    // Two archives of one job inside the same millisecond (a fast Linux VM) must not land on one name: rename onto a non-empty folder fails.
    const base = path.join(pd, 'archive', `${id}-${new Date().toISOString().replace(/[:.]/g, '-')}`);
    let target = base;
    for (let n = 2; fs.existsSync(target); n++) target = `${base}-${n}`;
    fs.renameSync(dir, target);
    job = null;
  }
  const resumed = !!job;
  if (!job) job = { id, skill, key, title: flag(rest, '--title') || key, root: path.resolve(root), created: new Date().toISOString(), finished: null, halted: null, items: [] };
  job.halted = null; // a new start is a new usage window
  for (const i of job.items) if (i.status === 'doing') i.interrupted = true;
  saveJob(dir, job);
  const out = [`job ${id}  ${resumed ? 'RESUMED' : 'new'}${why ? ` (${why})` : ''}  ${job.title}`, `dir: ${dir}`];
  if (resumed) {
    const c = tally(job);
    out.push(`items: ${c.done} done, ${c.doing} left doing by a cut-off session, ${c.pending} pending`, ...job.items.map(line));
    const arts = fs.existsSync(path.join(dir, 'artifacts')) ? fs.readdirSync(path.join(dir, 'artifacts')).map((f) => f.replace(/\.md$/, '')) : [];
    out.push(`artifacts: ${arts.join(', ') || 'none'}`, 'Load the artifacts instead of re-deriving them, skip the done items, and check the files an item left doing (git diff) before redoing it.');
  }
  return out.join('\n');
}

function cmdAdd([skill, ...rest]) {
  const { dir, job } = current(skill, rest);
  const group = flag(rest, '--group');
  const ids = positional(rest);
  if (!ids.length) throw new Error('usage: add <skill> <item...> [--group g]');
  let added = 0;
  for (const id of ids) if (!job.items.some((i) => i.id === id)) { job.items.push({ id, group, status: 'pending', attempts: 0 }); added++; }
  saveJob(dir, job);
  return `${added} added, ${ids.length - added} already known; ${job.items.length} items`;
}

function item(job, id) { const i = job.items.find((x) => x.id === id); if (!i) throw new Error(`no item ${id} in job ${job.id}`); return i; }

function cmdBegin([skill, id, ...rest]) {
  const { dir, job } = current(skill, rest); const i = item(job, id);
  i.status = 'doing'; i.attempts++; i.at = new Date().toISOString(); delete i.interrupted;
  saveJob(dir, job); return `${id} doing`;
}
function cmdDone([skill, id, ...rest]) {
  const { dir, job } = current(skill, rest); const i = item(job, id);
  const note = rest.includes('--stdin') ? readStdin().trim() : flag(rest, '--note');
  if (note && note.length < 800 && LIMIT_RE.test(note)) throw new Error(`that note looks like a usage-limit or rate error, not a result: use \`fail ${id} --reason "<text>"\``);
  i.status = 'done'; i.at = new Date().toISOString(); delete i.interrupted; delete i.reason;
  if (note) i.note = note;
  saveJob(dir, job);
  const c = tally(job); return `${id} done  (${c.done}/${job.items.length})`;
}
function cmdFail([skill, id, ...rest]) {
  const { dir, job } = current(skill, rest); const i = item(job, id);
  const reason = flag(rest, '--reason') || 'no reason given';
  i.status = 'pending'; i.reason = reason; delete i.interrupted;
  const limit = LIMIT_RE.test(reason);
  if (limit) job.halted = { at: new Date().toISOString(), reason };
  saveJob(dir, job);
  return limit ? `${id} back to pending. HALTED (limit): stop dispatching, report what is done, tell the user to repeat the request in the next usage window.` : `${id} back to pending (attempt ${i.attempts}): ${reason}`;
}
function cmdNext([skill, ...rest]) {
  const { job } = current(skill, rest);
  if (job.halted) return `halted at ${job.halted.at}: ${job.halted.reason}\nDo not start more work. Report what is done and how to resume.`;
  const group = flag(rest, '--group'); const n = Number(flag(rest, '--n') || 4);
  const pick = job.items.filter((i) => i.status !== 'done' && (!group || i.group === group))
    .sort((a, b) => (b.status === 'doing') - (a.status === 'doing')).slice(0, n);
  return pick.length ? pick.map((i) => `${i.id}${i.status === 'doing' ? '  (was in progress when the last session ended: check what landed first)' : ''}`).join('\n') : 'nothing pending';
}
function cmdStatus([skill, ...rest]) {
  const { dir, job } = current(skill, rest); const c = tally(job);
  const arts = fs.existsSync(path.join(dir, 'artifacts')) ? fs.readdirSync(path.join(dir, 'artifacts')).map((f) => f.replace(/\.md$/, '')) : [];
  return [`job ${job.id}  ${job.title}  ${job.finished ? 'FINISHED' : 'open'}  updated ${job.updated.slice(0, 16)}`,
    `items: ${c.done} done, ${c.doing} doing, ${c.pending} pending, of ${job.items.length}`, ...job.items.map(line),
    job.halted ? `halted at ${job.halted.at}: ${job.halted.reason}` : '', `artifacts: ${arts.join(', ') || 'none'}`,
    `resume: repeat the same request (job key "${job.key}"); \`start ${skill} "${job.key}"\` finds this job`].filter(Boolean).join('\n');
}
function cmdResults([skill, ...rest]) {
  const { job } = current(skill, rest); const group = flag(rest, '--group');
  const rows = job.items.filter((i) => i.status === 'done' && (!group || i.group === group));
  return rows.length ? rows.map((i) => `=== ${i.id}${i.group ? `  [${i.group}]` : ''} ===\n${i.note || '(no note)'}`).join('\n\n') : 'no finished items yet';
}
const artifact = (dir, name) => { if (!/^[\w-]+$/.test(name || '')) throw new Error('artifact name must be letters, digits, - or _'); return path.join(dir, 'artifacts', `${name}.md`); };
function cmdSave([skill, name, ...rest]) {
  const { dir } = current(skill, rest); const body = readStdin();
  if (!body.trim()) throw new Error('empty artifact');
  atomicWrite(artifact(dir, name), body.endsWith('\n') ? body : body + '\n'); return `saved ${name}`;
}
function cmdLoad([skill, name, ...rest]) {
  const { dir } = current(skill, rest);
  try { return fs.readFileSync(artifact(dir, name), 'utf8').trimEnd(); } catch { throw new Error(`no artifact named ${name} in this job`); }
}
function cmdFinish([skill, ...rest]) { const { dir, job } = current(skill, rest); job.finished = new Date().toISOString(); saveJob(dir, job); return `job ${job.id} finished`; }
function cmdList([skill, ...rest]) {
  const pd = projDir(skill, flag(rest, '--root') || process.cwd());
  const rows = jobsOf(pd).sort((a, b) => String(b.job.updated).localeCompare(String(a.job.updated)))
    .map(({ job }) => { const c = tally(job); return `${job.id}  ${job.updated.slice(0, 16)}  ${c.done}/${job.items.length}  ${job.finished ? 'finished' : 'OPEN'}  ${job.title}`; });
  return rows.length ? rows.join('\n') : `no ${skill} jobs for this project`;
}

function selfTest() {
  const st = fs.mkdtempSync(path.join(os.tmpdir(), 'ckpt-')); const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'ckpt-proj-'));
  process.env.CHECKPOINT_STATE = st; const real = readStdin; const feed = (t) => { readStdin = () => t; };
  const R = ['--root', proj];
  try {
    assert.match(cmdStart(['design', 'polish:app', ...R]), /new/);
    assert.match(cmdAdd(['design', 'phase-1', 'phase-2', 'phase-3', ...R]), /3 added/);
    assert.match(cmdAdd(['design', 'phase-1', 'phase-4', ...R]), /1 added, 1 already known/);
    assert.match(cmdBegin(['design', 'phase-1', ...R]), /doing/);
    feed('Design Read: dashboard for analysts'); cmdSave(['design', 'read', ...R]);
    assert.match(cmdDone(['design', 'phase-1', '--note', '12 literals merged', ...R]), /1\/4/);
    cmdBegin(['design', 'phase-2', ...R]);
    feed("You've hit your usage limit. It will reset at 3pm."); assert.throws(() => cmdDone(['design', 'phase-3', '--stdin', ...R]), /usage-limit/);
    assert.match(cmdFail(['design', 'phase-2', '--reason', 'API Error: rate limit reached', ...R]), /HALTED/);
    assert.match(cmdNext(['design', ...R]), /^halted/);
    // a new session: resume finds the job, keeps done work, clears the halt, flags the cut-off item
    const s = cmdStart(['design', 'polish:app', ...R]);
    assert.match(s, /RESUMED/); assert.match(s, /1 done/); assert.match(s, /artifacts: read/);
    assert.equal(cmdNext(['design', ...R]).split('\n')[0], 'phase-2');
    cmdBegin(['design', 'phase-2', ...R]);
    assert.match(cmdNext(['design', '--n', '1', ...R]), /phase-3|phase-2/);
    cmdStart(['design', 'polish:app', ...R]);
    assert.match(cmdNext(['design', ...R]), /^phase-2 +\(was in progress/, 'a cut-off item comes first and is flagged');
    assert.equal(cmdLoad(['design', 'read', ...R]), 'Design Read: dashboard for analysts');
    assert.match(cmdResults(['design', ...R]), /12 literals merged/);
    assert.throws(() => cmdSave(['design', '../x', ...R]), /artifact name/);
    assert.match(cmdStatus(['design', ...R]), /1 done, 1 doing, 2 pending/);
    // groups
    cmdAdd(['design', 'a-home', 'b-home', '--group', 'boards', ...R]);
    assert.equal(cmdNext(['design', '--group', 'boards', ...R]), 'a-home\nb-home');
    // another skill and another key do not collide
    cmdStart(['content', 'tighten:docs', ...R]); assert.match(cmdList(['content', ...R]), /OPEN/); assert.match(cmdList(['design', ...R]), /polish:app/);
    // finished jobs are set aside; --fresh too; old jobs too
    cmdFinish(['design', ...R]);
    assert.match(cmdStart(['design', 'polish:app', ...R]), /new \(the previous job had finished\)/);
    assert.match(cmdStart(['design', 'polish:app', '--fresh', ...R]), /set aside by --fresh/);
    const { dir, job } = current('design', R); job.updated = new Date(Date.now() - 9 * 864e5).toISOString();
    fs.writeFileSync(path.join(dir, 'job.json'), JSON.stringify(job));
    assert.match(cmdStart(['design', 'polish:app', ...R]), /9 days old/);
  } finally {
    readStdin = real; delete process.env.CHECKPOINT_STATE;
    fs.rmSync(st, { recursive: true, force: true }); fs.rmSync(proj, { recursive: true, force: true });
  }
  return 'self-test: all checks passed';
}

function main(argv) {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case 'start': return cmdStart(rest);
    case 'add': return cmdAdd(rest);
    case 'begin': return cmdBegin(rest);
    case 'done': return cmdDone(rest);
    case 'fail': return cmdFail(rest);
    case 'next': return cmdNext(rest);
    case 'status': return cmdStatus(rest);
    case 'results': return cmdResults(rest);
    case 'save': return cmdSave(rest);
    case 'load': return cmdLoad(rest);
    case 'finish': return cmdFinish(rest);
    case 'list': return cmdList(rest);
    case '--self-test': return selfTest();
    default: return 'usage: start|add|begin|done|fail|next|status|results|save|load|finish|list <skill> ...  |  --self-test   (add --root <dir>, --job <id>)';
  }
}

try {
  console.log(main(process.argv.slice(2)));
} catch (e) {
  console.error(`checkpoint: ${e.message}`);
  process.exit(1);
}
