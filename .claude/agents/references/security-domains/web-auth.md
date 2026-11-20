# Domain: Web sessions, authentication and HTTP trust

Adapted from `cloudflare/security-audit-skill` (MIT, Copyright (c) 2025-2026 Cloudflare, Inc.), rewritten as
detection shapes for this base. JWT, OAuth `state`, CORS reflection, open redirect, spoofable-field auth and the
header baseline already have core classes in `security-classes.md`; this file adds what they do not cover. Loaded
only when the brief's `## security` section names `web-auth`.

**Load when:** the project is a deployed or LAN-reachable web app or API that keeps sessions, accepts logins,
resets passwords, issues API keys, or sits behind a cache or proxy it configures. A loopback-only tool with no
login needs only the base's hard checks. The base's own login pattern is the `web-app-auth` skill (fixed username
`Thomas`, per-project `AUTH_PASSWORD`, `timingSafeEqual`, signed HttpOnly SameSite=Strict cookie): review a project
against it, and do not demand more than it promises.

## Discipline

- Framing and cache findings need *two interpretations* of the same request, response or key. Name both components
  and the exact normalised value on each side.
- For every credential, find the verification and every binding its role needs: issuer, audience, origin, client,
  session, principal, resource, assurance, expiry, one-time state.
- `Host`, `Forwarded`, `X-Forwarded-*`, `Origin`, `Referer`, redirect targets and request-derived URLs are trust
  decisions. Trace each to the identity or response it affects.
- A missing header, cookie attribute, MFA prompt or rate limit is not a finding by itself. Require an accepted
  invalid request, cross-principal impact, an assurance downgrade or a credential disclosure.
- Proxy chains, edge cache keys, IdP policy, browser behaviour and deployed auth modes are often outside the
  repo (Azure Easy Auth, Railway edge): `needs-validation`, never an assumption either way.

## Classes

**Session fixation and invalidation**: the session id is not rotated on login, account switch, MFA completion or
other privilege change, or stays valid after logout, password change, revocation or account disable. Check server
sessions, refresh tokens, signed cookies, websocket state and cache copies. A stateless signed cookie cannot be
revoked before `exp`: flag it only when the app promises logout or revocation, and check `exp` is set and enforced.

**Ordinary CSRF**: a cookie-authenticated, state-changing route accepts a cross-site request with no token,
same-site binding or strict `Origin` check. Inventory every cookie-authenticated mutation, including form, JSON-like,
multipart, method-override and legacy routes. SameSite helps only for the cookie and browser contexts actually in
use; login CSRF differs. Do NOT flag read-only actions or routes that need a non-ambient bearer header.

**Cookie scope and transport**: a sensitive cookie with an over-broad `Domain` or `Path`, sent over an insecure
transport, or shadowed by a sibling cookie another component selects. Bare missing flags are hardening unless a
realistic less-trusted origin or network position can gain or replace the credential.

**Host and forwarded-header trust**: untrusted host or proxy metadata decides absolute URLs, tenant routing, reset
links, cache keys or the client address used by authorisation. Proof: who can supply the header, and whether the
trusted ingress strips client copies. Complements the core Spoofable-Field class.

**Cache deception and poisoning**: a private dynamic path is cached as a public asset (suffix or path-parameter
routing, `Cache-Control: public`, Next.js static/ISR rendering of a personalised route, missing `Vary`), or an
unkeyed request value changes a cached response. Compare edge cacheability with the application's route parsing and
every response variant. Proof is a cross-user or private-response effect, not just a cacheable header.

**Response-header injection**: untrusted data in `Location`, `Set-Cookie` or another header with control
characters. Verify the framework does not already reject it and that a security-relevant response changes.

**Password reset and recovery**: reset tokens, backup codes, support recovery, email/phone change. Check token
randomness (see Weak Cryptographic Primitives), user/action binding, expiry, one-time use, rate control, that the
delivery URL is not built from an untrusted `Host`, and that a reset invalidates prior tokens and sessions. Do NOT
flag a response that only confirms a publicly known account exists.

**MFA enrolment, downgrade and step-up**: a valid first factor can enrol or replace the second factor without fresh
authentication; a disabled factor still authorises; a challenge upgrades the wrong session, account or action; an
alternate route (API, batch, recovery, resume) omits the assurance check. Compare every route to the same operation.

**Account linking and identity collision**: adding an IdP, passkey, email or phone must need a current session,
verified ownership of the new identity and callback state bound to the initiating account. A verified-email
collision between two providers is an account-takeover shape. Review unlink/relink and invite acceptance.

**OAuth redirect and PKCE (authorization-server side)**: exact `redirect_uri` ownership, PKCE and code binding, ID
token `iss`/`aud`/`nonce`, selected-IdP binding in multi-provider flows. These belong to the component that issues
or consumes the artefact; do not apply server-side controls to a pure relying party. (Forgeable `state` is a core class.)

**API-key scope and exposure**: a key authenticates to more tenants, actions or environments than its server-side
record grants, or request parameters override those bindings; a publishable key treated as secret or the reverse;
keys in client bundles, URLs, logs or error bodies. A public identifier called a key is not a secret.

**Request framing and desynchronisation** (only where the repo ships a proxy or custom HTTP parser): two
components disagree on `Content-Length` / `Transfer-Encoding` or header normalisation. A single application server
behind a managed proxy has little source-confirmable surface; say `needs-validation`, not "vulnerable".

## Moves

- Walk *issue → store → transmit → consume → refresh → revoke* for every credential and challenge. Compare the
  normal, error, retry, migration, legacy and account-switch paths.
- Enumerate every door to the same identity and every route to the same sensitive operation. The effective policy
  is the weakest parallel path, not the most polished screen.
- For recovery and linking, draw the account before/after graph: each edge names the current principal, the proof of
  the new identity, the assurance required and the revocation effect.

## Gate

1. Source-visibility first: record a precise `needs-validation` (the exact header, setting or policy to read)
   instead of asserting what missing infrastructure does.
2. Token, MFA, account-link, recovery and API-key findings cite the verification line and the missing binding, and
   show the server accepts the invalid transition or credential.
3. CSRF names the ambient credential, the state-changing route, the accepted cross-site request shape and the
   missing effective check.
4. Critical for an accepted authentication bypass or account takeover with a traced path; Important for a
   weakened control or a narrow reach; hardening notes go to `hardening:`.
