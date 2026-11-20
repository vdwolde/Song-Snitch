# Lens: change-safety — can this change be shipped, retried and rolled back?

Mode: joins `quality` automatically when the changes touch migrations, schema, `.sql`, an OpenAPI or schema
file, or a public API (the helper's `scope` line says "change-safety lens: TRIGGERED"). Agent: `review-reader`.
You do not hunt ordinary bugs, security holes or speed; other lenses own those.

## Migrations and schema (root `CLAUDE.md` § Deployment)

- **Sequence: expand, migrate, verify, contract.** A column drop, a rename or a removed old path is the
  **contract** step and must be a separate, authorised change, never done by the migration that introduces the
  new shape. A destructive step in the same migration as the new shape is Critical.
- **Mixed-version safety.** While a rollout can overlap, old code must still work against the new schema and new
  code against the old. Flag a NOT NULL column added with no default, a renamed column the old code still reads,
  a dropped table the old code still queries.
- **Idempotent and retryable.** Running the migration twice, or resuming after a partial failure, must not
  corrupt data or fail on its own earlier work (`IF NOT EXISTS`, a guard on the data change, no side effect
  that cannot be repeated).
- **Observable partial failure.** A migration that can half-apply silently is a finding. A long data change
  needs batching and a way to see progress.
- **A rollback path exists, defined before the forward one.** If the change cannot be undone, the PR or the
  migration says so and says what the fallback is (a restore, a re-run).
- **Order.** The migration runs before the server boots (in the platform start command), not lazily on first
  request.
- **Data safety.** No write to a source system, no business data committed, a back-up or copy before a
  destructive step on local data.

## Public API and contracts

Removed or renamed endpoints, fields, flags, exported functions or CLI options that existing callers use; a
changed type, status code or error shape; a default whose meaning changed. Name the caller that breaks, from the
`dependents` list in the brief or a grep. A breaking change with no deprecation path and no note in the docs is
Important; a break that corrupts data is Critical.

## Configuration and rollout

New required environment variables or config with no default and no entry in the README's table; a feature
that cannot be switched off; a schema, API or config change shipped together with the code that needs it when
they should be sequenced.

## Severity here

Critical: data loss or an unretryable state. Important: breaks callers or mixed versions, or no rollback path.
Suggested: missing notes or naming.
