# Domain: Data isolation and lifecycle

Adapted from `cloudflare/security-audit-skill` (MIT, Copyright (c) 2025-2026 Cloudflare, Inc.), rewritten as
detection shapes for this base. The core Authorization (IDOR) and Unfiltered Serialization classes cover the
endpoint-level check; this file follows one data item through every copy and state change. Loaded only when the
brief's `## security` section names `data-isolation`.

**Load when:** the project stores data that more than one user, tenant, role or owner must not see across (tenant,
org, workspace or owner columns, row-level policy), derives copies of it (search or vector index, cache, thumbnails,
analytics, exports, backups), issues links to it, or promises deletion, revocation or retention. A single-user
local tool has no cross-principal boundary: skip it. Where the data is personal (AIRA), the base's "never log PII"
and "never write back to a source system" rules (root `CLAUDE.md` § Data handling, § Security defaults) are hard checks.

## Discipline

- A tenant or owner field on a record is not isolation. Find the query, key, path, policy or row-level control that
  enforces it for *each* read and write path.
- Trace derived copies. Data that is sanitised in the primary store can be unsafe in search, cache, analytics,
  export, preview, logs, replicas and backups, each with its own ACL and retention.
- Deletion and revocation are lifecycle contracts: check current, historical, cached, indexed, exported, restored
  and queued copies *within the product's stated boundary*.
- A privacy or retention preference is not automatically a vulnerability. Require an explicit access boundary or a
  deletion/revocation guarantee, and an unauthorised reader or later operation.
- External storage policy, CDN behaviour, replica lag and backup access are usually not in the repo:
  `needs-validation`.

## Classes

**Missing tenant or owner enforcement**: a read, update, delete, list, count or bulk query names an object without
binding it to the authenticated tenant or owner, or takes the identity from the body. Compare direct lookup, nested
relation, background job, admin, import and legacy paths. Complements the core IDOR class.

**Composite-key and namespace collision**: cache keys, object paths, DB uniqueness, search document ids, temp files
or dedupe keys omit the tenant or environment, so two principals overwrite or retrieve the same logical key even
though the records carry separate owners.

**Policy and query disagreement**: row-level policy, ORM default scopes, authorisation filters and raw or bypass
clients apply different predicates. Check joins, aggregates, aliases, views, transactions, `unscoped`/service
clients and error paths where the context is missing.

**Blob and signed-reference overreach**: object keys, attachment ids, version ids, share links or signed URLs allow
operations or namespaces beyond the issuer's access, or outlive an ACL change. Bind operation, exact object and
version, audience, expiry and tenant; check list and write paths as well as reads.

**Search, cache and index ACL drift**: a record's ACL or lifecycle changes without invalidating a searchable,
cached, embedded (RAG), thumbnail, preview or feed copy. Validate the filter at *retrieval* time as well as at
ingestion and invalidation.

**Logs, traces and analytics as alternate readers**: private content or credentials emitted to a system with a
broader audience, longer retention or mixed tenants. Name the data class and the realistic reader; a public
identifier or operator-only content under intended policy is not enough.

**Enumeration and aggregate oracles**: counts, filters, ordering, errors, uniqueness constraints, timing or
notification behaviour disclose protected state. Require a concrete confidential predicate and an observable
distinction, not general response variance.

**Export and backup scope expansion**: an export, snapshot, portability package or backup includes other tenants,
inaccessible fields, soft-deleted data, secret values or history above the requester's access. Check per-item
authorisation after selection *and* authorisation to download the artefact.

**Import and restore authority expansion**: restore or import bypasses owner, schema, ACL, uniqueness or validation,
overwrites existing resources or recreates records in a tenant the requester cannot write. Treat archive content as
untrusted and authorise the resulting operation, not the provenance.

**Migration default and ownership confusion**: old rows lack tenant/ACL/lifecycle fields, ids collide, or a partial
rollout makes old and new readers apply different defaults. Review backfill, dual read/write, rollback and resumed
migrations. (Sequencing of the schema change itself is a deployment rule in root `CLAUDE.md` § Deployment.)

**Soft-delete and tombstone bypass**: direct lookup, search, relation traversal, object link, background processor
or restore ignores the lifecycle predicate and returns or acts on a deleted or revoked record; a deleted id can be
re-registered before references are gone.

**Stale authorisation and derived-copy use**: membership removal, ACL update, consent withdrawal, secret revocation
or role downgrade does not invalidate sessions, caches, subscriptions, jobs or materialised data that keep
authorising later operations.

**Retention and queued-work overrun**: deletion completes in primary storage while queues, retries, exports,
analytics or generated artefacts recreate or keep the data past the promised boundary. Look for idempotent deletion
and tombstone propagation.

**Restore reintroduces invalid state**: backup, undo, undelete or replica recovery restores data, credentials,
memberships or permissions that current policy no longer allows. Re-authorise restored state.

## Moves

- Pick one protected record and draw primary write, query, cache, index, event, export, backup, deletion and restore.
  Mark principal and tenant at every edge.
- Compare two dummy tenants through the same local service methods, then repeat after an ACL change, deletion,
  account switch and restore. Never use real user data.
- Start at bypass clients, background jobs, migrations, global uniqueness and cache keys: these omit the
  request-scoped identity interactive endpoints carry.

## Gate

1. Name the lower-trust principal, the protected data, the affected owner or tenant, the alternate copy or
   operation, and the unauthorised disclosure or mutation.
2. Cite both the intended source-of-truth policy and the path that omits or contradicts it; confirm no other layer
   enforces the same condition.
3. External cache, storage, replica, analytics, backup or retention policy that decides the result:
   `needs-validation` with the owner-observed check.
4. Critical for a traced cross-tenant read or write; Important for a narrower or conditional reach; a retention
   preference with no boundary goes to `hardening:`.
