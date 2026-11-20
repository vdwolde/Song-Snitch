# Domain: Client-side and browser

Adapted from `cloudflare/security-audit-skill` (MIT, Copyright (c) 2025-2026 Cloudflare, Inc.), rewritten as
detection shapes for this base. DOM-sink XSS, manual HTML building and Markdown rendering already have core
classes in `security-classes.md`; this file covers the browser sources, origin boundaries and persistence they do
not. Loaded only when the brief's `## security` section names `client-side`.

**Load when:** meaningful trust decisions or untrusted rendering happen in a browser: SPAs (React, Next.js, Vue),
browser extensions, embedded WebViews, service workers, offline apps, code that renders attacker-influenceable
content, receives cross-window messages or keeps secrets in browser storage. Includes sources the server never
sees: URL fragment, `window.name`, `postMessage`, cached content. For the native side of a WebView bridge use
`desktop-ipc`; for server-side CSRF and sessions use `web-auth`.

## Discipline

- A candidate needs a controllable *source* and an executing or disclosing *sink*. Name both.
- The impact must reach a victim's session, another origin or shared persistence. Self-injection and disclosure of
  the attacker's own data are not findings.
- Framework escaping, the same-origin policy, CSP, COOP/CORP, service-worker scope and modern `noopener` defaults
  are real controls. Verify them before assigning impact.
- Browser storage and caches are per origin and outlive a login. Identify who writes, who reads and what clears
  each record at logout, account switch or worker update.
- Renderer, extension permissions, deployed headers and browser version are often not in the repo:
  `needs-validation` with the exact header or setting.

## Classes

**DOM clobbering**: attacker-injected `id` or `name` attributes shadow a global, form property or config object
that code later trusts. Needs both a markup path that preserves the attribute and a security-relevant use.

**Prototype pollution and gadget**: an attacker-controlled key reaches a recursive write (`_.merge`,
`_.defaultsDeep`, `_.set`, `$.extend(true, ...)`, `deepmerge`, hand-rolled path assignment) and a reachable gadget
then reads the polluted property to change authorisation, execution, navigation or rendering. `JSON.parse`, a
shallow copy, or pollution with no gadget is not enough.

**`postMessage` origin and source trust**: a `message` handler acts on `event.data` without an exact origin
allowlist (and `event.source` where frames share an origin); or sensitive data is posted to `'*'`. A substring,
prefix, suffix or unanchored-regex origin test is not an origin check.

**Cross-site WebSocket use**: the upgrade accepts ambient cookies from an untrusted origin with no `Origin` check
or channel token, and a handler then reads or mutates data. Confirm both the upgrade and a sensitive handler.

**Credentialed CORS** (see the core CORS Reflection class): report the actual reflected or weakly matched origin
and the cross-origin data or mutation it exposes; a bare `*` with credentials is rejected by browsers.

**Service-worker scope and cache identity**: attacker-influenceable content becomes the registered script, or a
broad `Service-Worker-Allowed` scope, or an imported script without integrity; or personalised responses are cached
without account/tenant/auth state in the key and served after logout or account switch. A normal same-origin worker
with intended scope is not a defect.

**Browser-storage disclosure and stale authorisation**: tokens, private responses, drafts or authorisation
decisions in `localStorage`, `sessionStorage`, IndexedDB, Cache Storage or extension storage that a less-trusted
same-origin component can read, or that keep working after logout or revocation. A token in storage alone is not a
finding; name the realistic less-privileged reader (for example an XSS sink elsewhere on the origin).

**Cross-context storage and broadcast confusion**: `storage` events, `BroadcastChannel` or shared workers carry
identity or commands between tabs without binding to the current session; a stale tab overwrites newer auth state.

**XS-Leaks**: an attacker page distinguishes protected cross-origin state through load/error events, frame or
window state, redirect behaviour, timing, cache state or response size while the browser attaches the victim's
credentials. Require one concrete secret-bearing predicate (does a private object or role exist). Generic timing
variance is not a finding.

**Clickjacking**: a framed, state-changing action with no effective `frame-ancestors` / `X-Frame-Options`. Require
the sensitive action to be completable while framed; missing headers on read-only content go to `hardening:`.

**Client-side navigation confusion**: a client source controls a redirect or `href` with no scheme/destination
policy, including executable `javascript:` or `data:` URLs. Reverse tabnabbing applies only where the code keeps
`window.opener`, calls `window.open` without isolation, or supports a browser without implicit `noopener`.

## Moves

- Start from the sinks (DOM, navigation, worker, message, storage) and trace backwards to browser-only and
  server-controlled sources. Record the browser policy that should stop each path.
- Test account switch, logout, worker update, offline fallback and stale-tab state with a local origin and dummy
  accounts. No production users, origins or shared services.
- For XS-Leaks, list only predicates the source proves, then name the header or rendering choice that removes the oracle.

## Gate

1. Cite source, sink, browser policy, affected origin or session, and the observable mutation or disclosure.
2. Prototype pollution: prove the recursive write *and* a gadget. Clobbering: prove the markup survives *and* the
   shadowed value is used.
3. Messaging, CORS, WebSocket and XS-Leaks: show the exact origin/source validation and the protected state
   exposed; confirm CSP, COOP/CORP, cookies and SameSite do not already block it.
4. Critical for script execution or account action in another user's session with a traced path; Important for a
   narrower reach; everything contingent on an unseen header or browser is `needs-validation`.
