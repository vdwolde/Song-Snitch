# Domain: Webhooks, messages and shared-service abuse

Adapted from `cloudflare/security-audit-skill` (MIT, Copyright (c) 2025-2026 Cloudflare, Inc.): the message and
replay classes of its protocols file and the shared-service classes of its resource-exhaustion file, cut down to
what a small web service needs. gRPC, brokers and streaming RPC are **not covered here** (nothing in the portfolio
uses them); add a file when one appears. Loaded only when the brief's `## security` section names `webhooks-abuse`.

**Load when:** a route receives callbacks from a provider (payments, source hosts, chat, email), a queue or job
runner processes messages, a public endpoint accepts uploads or archives, or an unauthenticated or low-trust request
can reach a paid API (LLM, email, SMS), a shared worker pool or a shared database. For a loopback single-user tool,
every availability class below is Suggested at most.

## Discipline

- "Internal" is not authentication. Name the peer identity at every hop and how it becomes the application principal
  used for authorisation.
- Schema validation proves shape, not provenance, resource authority, ordering or safe values.
- Write down the delivery model first (retry, ordering, acknowledgement, deduplication, transaction) before judging
  a state change.
- For availability, require an input-to-cost path, a missing *effective* bound, and impact on another user, a shared
  service or operator-owned spend. Work that only slows the requester's own process is not a service vulnerability.
- Never validate by stress. Use asymptotic analysis, small boundary fixtures, mocked paid calls and strict local
  limits. Upstream caps, autoscaling and quotas outside the repo are `needs-validation`.

## Classes

**Unauthenticated inbound webhook**: a route that performs a privileged action on a request body alone. Proof it is
safe: the provider signature is verified over the *raw* body with a constant-time compare, a timestamp tolerance
and the right secret per source/account (`constructEvent`, `X-Hub-Signature-256`, `svix`, HMAC + `compare_digest` /
`timingSafeEqual`), before parsing and before any side effect. A body that can declare itself an admin, provider or
replication event with no independently authenticated producer is the control-plane shape. The `entrypoints`
webhook trust lead is the cue.

**Envelope vs payload identity**: authorisation reads trusted-looking routing or envelope metadata while the handler
acts on a conflicting tenant, account, subject or sender in the body. Identify which source is authoritative and
check clients cannot override it.

**Duplicate delivery and idempotency**: retries or redelivery repeat a side effect because deduplication is absent,
happens *after* the mutation, or uses a key that collides across tenants or operations. Confirm the provider's
retry model and a side effect that is not naturally idempotent (a charge, an email, a grant).

**Replay and out-of-order acceptance**: an old message, revoked membership or cancelled work arrives after newer
state and overwrites it; no timestamp window, sequence/version check or tombstone. Reproduce with a bounded local
or in-memory transport, never a live queue.

**Acknowledge/commit ordering**: acknowledged before the durable commit (work lost) or committed before an
unreliable acknowledgement (mutation duplicated). Several consumers implementing one transition can leave only a
subset committed after a partial failure.

**Parser and canonicalisation disagreement**: two components decode the same message differently (duplicate JSON
keys, unknown fields, numeric width, encoding, envelope-versus-body precedence), e.g. a validator and a handler.
Needs two concrete consumers and one security-relevant divergent value; safe rejection by either side prevents
confirmation. Related to the core Sibling Validator/Sanitizer Asymmetry.

**Superlinear parsing and decompression**: a small accepted input drives catastrophic regex backtracking (ReDoS), a
user-supplied pattern, deeply nested structures, or an archive/image/document that expands far beyond the checked
size (no ratio or total-size limit after expansion). Derive the accepted depth and complexity and show a bounded
growth curve locally. (Zip-slip path traversal and XML entity expansion are core classes.)

**Unbounded buffering and cardinality**: bodies, uploads, sessions, unique cache keys, metric labels, subscriptions
or pending jobs grow with no per-item and aggregate limit, or no cleanup on disconnect, timeout or cancel. Compare
the aggregate limit with the per-object limit: ten thousand valid one-byte items can pass a per-message cap.

**Pre-authentication work imbalance**: expensive parsing, key lookup, crypto, decompression or an outbound request
happens before authentication and before the earliest size or rate gate.

**Quota accounting scope**: the limiter keys on something attacker-influenceable (a spoofable `X-Forwarded-For`
when no trusted proxy strips it, route, task id), so one principal escapes its budget or spends another's. Check
retries, reconnects and account switching.

**Operator-owned spend amplification**: an unauthenticated or low-trust request reaches a paid LLM, email, SMS or
payment API with no per-request budget, per-user cap, cancellation or idempotency. This is the cost-side of the core
Unthrottled Credential or Side-Effect Endpoint class; prove the missing bound in code, never by spending.

**Reachable fatal error or poison record**: an untrusted input reaches an unhandled exception, abort, deadlock or
infinite loop in a shared process, or one malformed message blocks the front of a shared queue or startup scan
forever. Confirm the supervisor's scope and whether other tenants share the blocked unit.

## Moves

- Draw producer → transport → gateway → consumer → storage for each message family. At each hop record the
  authenticated peer, the authoritative tenant/resource fields, the validation and the side effect.
- Build an input-to-resource table: earliest accepted size/cardinality, work before auth, downstream fan-out,
  persistence, shared pool, limit and cleanup owner, recovery.
- Feed the same small fixture to every in-repo schema version or binding; try duplicate, missing, unknown,
  boundary, replayed and reordered messages without producing load.

## Gate

1. Name the realistic producer or peer, the accepted message, the authenticated channel identity, the affected
   principal or resource, and the unauthorised mutation, disclosure or shared impact.
2. Availability: confirm no visible upstream, parser, queue, tenant or framework bound already prevents it; a
   missing rate limit alone, with no concrete shared impact, goes to `hardening:`.
3. Replay and ordering: establish the real delivery guarantee and reproduce the invariant failure with a bounded
   local transport; broker ACLs, provider settings and upstream limits outside the repo are `needs-validation`.
4. Critical for an unauthenticated webhook or message that triggers a privileged action, with a traced path;
   Important for amplification onto shared or paid resources; Suggested for loopback tools.
