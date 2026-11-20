
## Review Priorities

For a Node or TypeScript backend such as Fastify with `node:sqlite`. Read `typescript.md` as well for type
safety and async correctness.

### CRITICAL — Security

- **Binding**: a local dev server binds loopback only and rejects non-loopback `Host` and `Origin` headers.
  `0.0.0.0` only when the platform injects `PORT`.
- **Process execution**: `execFile` or `spawn` with an argument array; never `exec` with a string built from input.
- **Static or file-serving routes** without a path-traversal guard (`path.resolve` then `realpath`, then check
  the prefix).
- **Validation at every boundary**: request bodies, query, params and headers go through a schema (Fastify's
  JSON schema or zod). Every gate is enforced on the server; a client check is not a boundary.
- **SQL**: parameterised statements only (`db.prepare('… ?').run(value)`); never a template literal with input.
- **Secrets** read through one config module, never hardcoded, never in logs. **PII** pseudonymised at the
  logger, not at each call site.
- **Auth** (when the project has it): compare username and password with `crypto.timingSafeEqual` after
  guarding the length; a signed, `HttpOnly`, `SameSite=Strict` cookie as the only source of truth.
- **CORS** with a wildcard and credentials; missing security headers; prototype pollution through object
  merges; ReDoS on user-supplied patterns; `JSON.parse` without a try/catch.

### CRITICAL — Error Handling

- **Unhandled rejections** and async route handlers that neither return nor await.
- **A global handler that swallows `uncaughtException`.**
- **No central error handler**, or error output that leaks internals or stack traces to the client.
- **No graceful shutdown**, so an open database or in-flight request is cut off.
- **A deployed app without a health endpoint** (`/health`) pointed at by the platform.

### HIGH — node:sqlite and SQLite

- **`DatabaseSync` is synchronous**: it blocks the event loop. Keep queries short and never hold a transaction
  open across an `await`.
- **`PRAGMA foreign_keys = ON`** is off by default and must be set per connection. Consider WAL
  (`journal_mode=WAL`) and a `busy_timeout`.
- **Transactions** wrapped in try/finally with a rollback; a multi-step write that is not atomic.
- **Migrations run before the server boots**, in the start command, and follow expand, migrate, verify,
  contract. The contract step is a separate, authorised change.
- **The data directory is gitignored** and no business data is committed.

### HIGH — Code Quality

- **Dependencies pinned exactly**, one lockfile, `npm` only (yarn, pnpm and bun are not installed here).
- **ESM and CommonJS mixed** without a reason; a new dependency where the stdlib or `node:` module does it.
- **Config read in scattered places** instead of one module.

### MEDIUM — Performance

- **A prepared statement created inside a loop**: prepare once and reuse. N+1 queries; `SELECT *`; unbounded
  result sets with no pagination.
- **Synchronous file or `execSync` calls in a request handler.**
- **Independent `await`s in sequence** that could run together.
- **Unbounded caches or `Map`s**; large objects serialised repeatedly; work done at startup that could wait.

## Diagnostic Commands

```bash
npm run typecheck --if-present
npm test --if-present
npm audit --omit=dev
```
