# API

Every HTTP endpoint this project exposes. Read this before adding or changing one; add the
row in the same change. For request/response conventions in code see
[STACK.md](STACK.md); for auth see [SECURITY.md](SECURITY.md).

Delete this file if the project has no HTTP surface.

## Response envelope

<!-- The one shape every response takes, and the helpers that produce it. E.g.
     `{success, error, data}` via `api_success(data)` / `api_error(message, status)`.
     One envelope, no exceptions — a second shape doubles the client's error handling. -->

## Conventions

- Auth required unless stated otherwise.
- Mutating endpoints require CSRF.
- Rate limits are stated per endpoint as `(max_requests, window_seconds)`.
- Errors never leak internals — log the detail, return the message.

## Page routes

| Method | Path | Purpose | Auth | Rate limit |
| --- | --- | --- | --- | --- |
| … | … | … | … | … |

## API routes

| Method | Path | Purpose | Auth | Rate limit |
| --- | --- | --- | --- | --- |
| GET | `/health` | Liveness check for the deployment platform | none | — |

## Health check

<!-- The exact response body the platform's healthcheck expects, so nobody "tidies" it
     into a different shape and silently breaks deploys. -->
