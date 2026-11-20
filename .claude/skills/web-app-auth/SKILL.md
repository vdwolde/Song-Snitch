---
name: web-app-auth
description: "Login pattern for personal web apps that are deployed beyond this machine and hold something sensitive: fixed username Thomas, per-project AUTH_PASSWORD, no auth in local dev. Use when: adding auth or a login to a project, deploying a project that holds sensitive data, password-protecting an app, auth question."
---

# Authentication for personal web apps

Moved out of the root `Development Base/CLAUDE.md` on 2026-10-16 to keep that file lean; the root file keeps
only the always-on rule (default to no auth).

Distilled from Finance Dashboard's ADR-029 (`Projects/Finance
Dashboard/.claude/DECISIONS.md`) — read that ADR for the full reasoning, the rejected
alternatives (a centralized `auth.vdwolde.com` broker shared across every project, one
password reused across every project, a third-party hosted identity provider), and the
tradeoffs it accepts. This section holds only the cross-project pattern.

- **Default to no auth.** Most personal projects on this machine are simple local
  single-user tools (a scraper, a party game, a desktop utility) with no real login
  boundary to protect — the same reasoning Finance Dashboard's own ADR-011 already uses
  for its *local* runs applies to a whole project when nothing it holds is sensitive:
  anyone who can reach the process already has full access to the machine it runs on.
  Don't scaffold a login screen "just in case" — that's exactly the speculative-feature
  case root CLAUDE.md § Coding principles' simplicity ladder exists to catch.
- **When a project is deployed somewhere reachable beyond the owning machine and
  actually holds something worth gating** (real financial data, anything else
  genuinely sensitive), or when Thomas explicitly asks for auth on a project that
  doesn't strictly need it, implement it with the same pattern every time — don't
  reach for passkey/WebAuthn by default (it was Finance Dashboard's original design;
  the device-enrollment ceremony proved consistently cumbersome enough on a new device
  that ADR-029 replaced it):
  - **Username is always `Thomas`** — a fixed constant in code, not a secret, not
    configurable.
  - **Password is chosen per project**, asked of Thomas directly when building that
    project — never a single password shared across projects (a leak or weak
    implementation in one project must never compromise another's login). Comes from
    one env var (`AUTH_PASSWORD` by convention), read through the project's one config
    module like every other secret (root CLAUDE.md § Security defaults above) — never hardcoded,
    never committed.
  - **Compare with `crypto.timingSafeEqual`** on both username and password (guard the
    length check first — it throws on mismatched buffer lengths).
  - **A signed, HttpOnly, `SameSite=Strict` session cookie** is the sole source of
    truth for "is this request authenticated" afterward.
  - **Local dev skips auth entirely**, gated on the same `NODE_ENV`/environment check
    every other dev/prod split in the project already uses — a login prompt on
    `localhost` protects nothing an OS login doesn't already.
  - No centralized/shared identity system across projects, and no third-party
    identity provider — every project that needs auth owns its own login
    independently, so a compromise of one never implies access to another.
