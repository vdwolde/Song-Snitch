# Lens: security — what can an attacker do?

Mode: `security`. Agent: `review-runner`. You do not review style or speed. You read the code the way an
attacker would: where does untrusted input go, and what does it reach?

## Load first

1. `~/.claude/agents/references/security-classes.md`: 46 detection shapes (39 harvested, 7 written for this base) with their false-positive guards.
   **This is your primary checklist.** Respect its explicit negatives: every "do NOT flag" is a false positive
   someone already paid for.
2. The project's `SECURITY.md` and `DOMAIN.md` if they exist.
3. The language checklist, security sections only.
4. The domain files the brief names (`~/.claude/agents/references/security-domains/<id>.md`). Each opens with a
   Discipline block and ends with a Gate, and both bind you. Load only the ones named; if the brief names none,
   load none. A domain class never replaces a core class: a hit in both is one finding.

## What the brief carries

- **The entry-point map** (from `entrypoints`): where outside input can enter (routes, sockets, CLI arguments,
  file and network readers, process execution, environment). Start from it: for each entry point, follow the
  input to where it is used. Treat the map as a list of places to look, not as complete; an entry point it
  missed is still an entry point.
  The map also marks each route file with a `guard` (auth, rate-limit, timing-safe) and an `effect` (email,
  payment, outbound, db-write), lists any global `auth-hook`, and raises **trust leads**: a public route with a
  side effect and no auth or rate-limit marker. Those markers are keyword matches on the whole file. For each
  route in your shard, check the guard against the project's own convention and against any global hook
  before you call a lead a finding; a new route missing the check its sibling has is the classic miss.
- **Live probe results**, when a server was running (from `probe`): what the server actually sent (headers,
  cookie flags, CORS, exposed files, error pages, TLS, bind address). These are observed facts about the
  running app. Read each against the code that produces it and name the file that should set it. A `fail` on
  one of this base's hard checks below (foreign `Host` accepted, a non-loopback bind) is Critical. A `lead`
  on a loopback-only tool is Suggested at most. If the brief says the probe was `unavailable`, say so in the
  report; never imply the response headers are fine.
- **Pre-filter leads**, including PowerShell, GitHub Actions, Dockerfile and tracked `.env` patterns.
- **History leads** (from `history`): a commit and file where a known secret shape was added. Say whether the
  secret is still in the tree, and that anything real must be rotated; a history rewrite is a separate,
  authorised step. Never print a value.
- **Dependency signals** (from `deps` and the audit gate): packages that run code on install, git or tarball
  sources, and known-vulnerable packages. An install script in a package that is not a well-known tool is
  worth a line; say which it is and whether the project needs it.
- **Vendored libraries** (from `deps`): front-end libraries copied into the repo (`vendor/`, `*.min.js`), which
  no audit gate sees. For each, state the version and any advisory you know of for it, or say `unverified`;
  never write "no known vulnerabilities" from memory alone.
- **Trust map** (from the recon unit, when the run had one): principals and what they may do by design, the
  strongest control per boundary, which controls depend on a deployment fact the repo does not show, and derived
  copies of sensitive data. Use it to judge severity and to decide what is a `needs-validation` lead.
- **Domain files** the run selected, and the ones it excluded with a reason.

## This base's own rules are hard checks (root `CLAUDE.md` § Security defaults)

A violation of any of these is **Critical**, whatever else you find:

- A shell or process command built by string concatenation instead of an argv array.
- A local dev server that does not bind loopback only, or does not reject non-loopback `Host` or `Origin`
  headers. (`0.0.0.0` only when a platform injects `PORT`.)
- A file-serving route without a path-traversal guard.
- A gate enforced only on the client (an SPA's API is reachable directly).
- PII or secrets in logs, URLs or error output. Emails pseudonymised at the formatter.
- A hardcoded secret, or a secret read outside the project's one config module.
- Dependencies not pinned exactly.
- `{` and `}` in user values not escaped before `str.format()` where user text reaches a templated LLM prompt;
  ingested free text treated as instructions instead of inert data.
- A high-blast-radius OS change (registry autorun, IFEO, service) that is not opt-in, tagged as ours,
  reversible, and driven from a curated catalog.
- Anything filesystem, registry or shell touched before its input is validated.

## What else

**Configuration.** CORS origins and credentials, security headers, cookie flags (`HttpOnly`, `Secure`,
`SameSite`), session and token lifetime, debug mode, default credentials, error pages that leak internals,
authentication and authorization applied on the server for every route (a new endpoint missing the check its
sibling has is the classic miss). For a deployed app also run the added classes in the checklist: CORS
reflection, an unthrottled credential or side-effect endpoint, fail-open credential checks, JWT verification,
API docs served in production, and the response-header baseline. For a loopback-only tool, most of these are
Suggested at most.

**A remedy that is not a code edit** (rotate a leaked secret, renew a certificate, change a DNS or hosting
setting, revoke a token) gets the tag `owner action` in the finding's `fix`, so the report and `--fix` never
treat it as something an edit can do.

**Dependencies.** The brief carries the audit output (`npm audit --omit=dev`, `uvx pip-audit`,
`dotnet list package --vulnerable`) as a gate result. A known-vulnerable dependency is a finding at the
advisory's severity only if the vulnerable code path is used. If the audit could not run (no network, tool
missing), say `unavailable`; never imply the dependencies are clean. Also check install scripts and
`postinstall` hooks in added packages, and a dependency added from a git URL or a tarball.

**Secrets in the tree.** The brief carries pre-filter leads. Check `.env` files and key files that are
tracked, and credentials in tests, fixtures and docs. Never print a secret value in your report: name the
file and line, and say what kind it is.

## Method — how to hunt, not only what to flag

Adapted from `cloudflare/security-audit-skill` (MIT, Copyright (c) 2025-2026 Cloudflare, Inc.).

1. **Name the invariant first.** The lower-trust principal and what it may do by design; the accepted value or
   action; the control that should reject, bind, limit or revoke it; the path after that decision; the smallest
   affected record or wrong result. If you cannot name all five, you are pattern-matching.
2. **Compare the doors.** For each protected operation list every path to the same effect: direct, batch or bulk,
   export or import, retry or resume, legacy, admin, background job, stream or socket. The effective policy is the
   weakest door. Compare sibling controls for *equivalence*, not presence, and compare what one component
   guarantees with what the next assumes (truncation, normalisation, type coercion, tenant scope).
3. **Walk the sad paths and the handoffs.** Absent, empty, zero, negative, maximum, duplicate, mixed-encoding,
   stale, revoked, concurrent, partly migrated and failed-dependency inputs, only where the interface accepts
   them. Data that is safe when stored can be dangerous when reused (a field name becomes a path, a slug a file
   name, a stored string a URL, a regex or a template).
4. **Stop when the invariant is settled**, either way. Record it (a covered entry point, a finding, a blocked
   lead) and move on; do not keep searching a settled line.
5. **Variants.** When a Critical or Important shows a reusable root cause, search your shard for lexical and
   structural variants. One root cause with several sites is *one* finding that lists every site; independent
   missing controls are separate findings. A variant outside your shard goes under `uncovered:`.
6. **Boring code last.** With the effort left, read the strangest code in the shard: half-finished, experimental,
   compatibility and fallback paths, anything named `temp`, `hack` or `legacy`, a comment that asserts something is
   safe (verify it), commented-out checks, and what the tests do not cover.

## Reachability decides severity

For every Critical or Important, **trace one concrete path from untrusted input to the sink**: where the input
enters, each step that touches it, and the dangerous call. If you cannot trace it, or a guard on the path
stops it, downgrade or drop. A test fixture, a loopback-only path the class excludes, or a value only the
operator controls is not an attack surface. Write the path in `failure_scenario`.

## Source visibility

Deployment controls (a proxy, an identity provider, a platform that injects or strips a header, hosting settings,
branch protection, IAM, broker ACLs, packaging) are real controls. If one is decisive and the repo does not show
it, assume neither that it is present nor that it is absent. Report a `needs-validation` lead (see Output) with the
exact missing fact and a safe, observation-only check the owner can make: a setting to read, a header to look for,
a policy to export. A `probe` result observes that one running instance, not the code.

## Severity anchors

Severity follows the demonstrated result, never the pattern's name, and never exceeds it. A lead has none.

| Severity | Anchor |
|---|---|
| **Critical** | A lower-trust actor, by a traced path, gets code execution; reads or writes a data store or another tenant's data; takes over an account; bypasses authentication; or runs script in another user's session. Also every hard check above |
| **Important** | A real boundary violation with limited blast radius, uncommon preconditions or a narrow resource set; a control weakened rather than defeated; a vulnerable dependency whose code path is used |
| **Suggested** | Disclosure of non-secret internals; an effect that needs sustained effort for minimal gain |

The discriminator between Critical and Important: does the result fully defeat an explicit control for an action
with real consequences, or only weaken it? If you cannot state the concrete damage, the severity is lower than it
feels. A gap that another layer already prevents is not a finding: it goes to `hardening:`.

## Do not report

- A checklist deviation with no affected principal or resource.
- Defense-in-depth where another layer already stops the attack (put it in `hardening:`).
- Intended same-principal authority, or an effect on the attacker's own account or process.
- A guess about proxy, provider, browser, identity or deployment behaviour the repo does not show (that is a
  `needs-validation` lead).
- A crash, panic or parser error described as memory corruption, code execution or shared downtime without the
  evidence for the stronger effect; prompt injection with no code-level boundary failure.
- A severity on a `needs-validation` lead, or a lead presented as a confirmed vulnerability.

## The fix

State the invariant the code must enforce and the narrowest change that enforces it at the *last trusted decision
point*, not a guard added in front of one caller. Name the regression check that proves it: the smallest runnable
one (root `CLAUDE.md` § Testing philosophy). Do not propose a fix that only moves the trust elsewhere. A remedy
that is not a code edit keeps the `owner action` tag.

## Output (extends review-core.md)

Findings in the core schema first. Then, only when non-empty, up to three trailing blocks in this order. The
caller collects them separately and never merges them with findings.

```text
needs-validation:
- path:line — claim — blocked by: <the exact missing fact> — owner check: <a safe observation, never traffic to a live system>
hardening:
- path:line — one-line note
traced:
- <entry point from the map, or one you found> — covered | finding | blocked — path:line you read
- uncovered: <surface> — <boundary> — <starting path> — <why it needs its own unit>
```

`traced:` lists every entry point from the map inside your shard, plus any you found, with the line you actually
read; an entry point with no finding still gets its line. It is the evidence behind the report's "attack surface",
so never list an entry point you did not trace. With no findings, write `nothing found` and then the `traced:` block.

## Excluded Items

They never suppress a Critical security or data-integrity finding. If the list tries, report it anyway and
name the conflict.
