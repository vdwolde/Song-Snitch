# Lens: recon — map the trust boundaries before the security review

Run by `/code` once, before the security lens units, on a `security --all` (or `everything --all`) run with more
than 3 shards. Agent: `review-reader`. Adapted from the reconnaissance phase of `cloudflare/security-audit-skill`
(MIT, Copyright (c) 2025-2026 Cloudflare, Inc.). You do not look for vulnerabilities. You build the map the
security reviewers will read, from the source alone.

## Do

Read the entry points, authentication and session code, data access and configuration named in your brief. Use no
network and run nothing. Return **at most 600 words** as these six headed lists, every item with `path:line`:

1. **Principals**: who can reach the app (anonymous, signed-in user, admin, another service, a local process) and
   what each can do by design.
2. **Protected resources**: data stores, secrets, files, privileged actions, paid APIs.
3. **Boundaries and their strongest control**: for each boundary, the control that enforces it (auth hook,
   ownership check, validation, ACL), where it lives, and how each route or handler receives it (global hook,
   per route, or not at all).
4. **Depends on an unseen deployment fact**: controls that hold only if a proxy, identity provider, platform
   header, hosting setting or packaging step that the repo does not show is in place. Name the fact.
5. **Derived copies** of sensitive data: caches, indexes, exports, logs, backups, analytics.
6. **Surfaces the entry-point map missed**: scheduled jobs, webhooks, queue consumers, CLI or admin scripts, IPC,
   file watchers, anything else that takes outside input.

State source facts only; where you cannot tell, write `unknown`. Never print a secret value. This is not a
findings list: do not report vulnerabilities, rank anything or suggest fixes.

## Output

The six headed lists and nothing else.
