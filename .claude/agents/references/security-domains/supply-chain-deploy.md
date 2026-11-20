# Domain: Supply chain, CI, release and deployment

Adapted from `cloudflare/security-audit-skill` (MIT, Copyright (c) 2025-2026 Cloudflare, Inc.): its supply-chain file
plus the parts of its cloud file that fit Railway, Azure App Service and Docker. The core classes already cover
GitHub Actions injection and unpinned third-party actions, over-broad IAM, TLS verification off and the dependency
audit; this file adds the trust handoffs between them. Loaded only when the brief's `## security` section names
`supply-chain-deploy`.

**Load when:** the repo defines CI workflows, a Dockerfile or compose file, release or publish scripts, an
auto-updater or installer, a plugin/extension loader, or a deployment config (`railway.toml`, `startup.txt`,
`vercel.json`, App Service settings, infrastructure as code). Kubernetes, service-mesh and admission policy are
**not covered here** (nothing in the portfolio uses them yet): add a file when the first such repo appears.

## Discipline

- A mutable or known-vulnerable dependency is not a finding by itself. Show who can influence resolution, which
  build consumes it and what execution or release boundary follows.
- Follow integrity across every handoff: source identity, resolved inputs, build worker, artefact identity, test
  result, signature, promotion, update consumer.
- CI configuration is authorisation code. Establish which event triggered the workflow, whose code runs, which
  secrets and tokens exist, and what it can publish or change.
- A checksum fetched from the same untrusted place as the artefact proves nothing; find the trusted root and the
  failure behaviour.
- Do not infer a live exposure from a manifest alone. Establish which environment consumes it, which overlays
  change it and whether the source path is active. Branch protection, hosted-runner and registry settings are not in
  the repo: `needs-validation`.

## Classes

**Dependency source and namespace confusion**: resolver config can pick an unintended public/private namespace,
fallback registry or source URL (`--extra-index-url`, an unscoped internal package name, `.npmrc` registry
overrides, a git/tarball dependency). Review lockfile and checksum use and first-install versus update behaviour.

**Mutable, unbound build inputs**: floating tags and branches, unverified submodules, tools fetched with `curl | sh`
and no checksum, remote includes, container `latest`. Needs a lower-trust writer and a path into trusted build
output; reproducibility alone is not authenticity. (Third-party Actions by tag are a core class.)

**Build-context inclusion**: secrets, `.env` files, `.git`, local config or developer artefacts enter an image or
package because the build context exceeds the release inputs: `COPY . .` / `ADD . .` with no `.dockerignore`
covering `.env` and `.git`, `npm publish` with no `files` allowlist, an installer that packs dev config. Proof: the
resulting artefact would expose a real credential or private data.

**Untrusted code in a privileged workflow**: a pull request, fork, issue comment or dependency update runs
contributor-controlled code with secrets, a write token or deploy authority: `pull_request_target` (or
`workflow_run`) that checks out `github.event.pull_request.head.*`, then builds or runs it. Compare trigger,
checkout ref, approval gate and permission narrowing; do not assume host defaults that are not in source.

**Cache, artefact and workspace trust mixing**: a lower-trust job populates a cache, artefact or shared workspace
that a higher-trust job restores and executes or releases. Review cache keys and namespaces, producer identity,
digest binding, and whether promotion re-resolves by a mutable name.

**Automation identity overreach**: `permissions: write-all`, a default-write token, or a job that can select the
repository, environment or resource from untrusted input. Missing least privilege alone is hardening; require a
reachable privileged action.

**Build-to-promotion substitution and release authorisation**: tests, review, signature and publication refer to a
mutable tag, filename or channel instead of one immutable digest; or a release or signature is accepted from the
wrong workflow, branch, environment or key role. Check every copy, repack and re-upload between build and release,
and that the consumer validates the attestation's identity claims, not just that a signature exists.

**Update metadata and rollback confusion**: an updater authenticates the payload bytes but not version, product,
platform, channel, expiry or rollback state, or accepts metadata and payload from different transactions. Verify
atomic install and recovery. (Releases ship through GitHub Releases in this base: check what the app verifies
before it runs a downloaded installer.)

**Plugin and extension trust expansion**: a package gains host authority beyond its declared scope, a publisher can
replace another's identity, or install/update hooks run before authenticity and capability checks. Do NOT flag a
user intentionally installing a same-user plugin.

**Security-control precedence drift**: development values, chart/compose defaults, environment variables, flags,
feature gates or per-environment overlays disable authentication, TLS, tenant scoping or audit in a deployed
environment (`DEBUG`, `NODE_ENV`, a dev bypass left enabled, an auth skip keyed on a variable the platform sets).
Render the *final* config for each maintained environment, not only the base file.

**Management-plane and internal reachability**: an admin, debug, metrics or internal API bound publicly through a
bind address, port mapping, route or listener the repo controls. A repository-controlled public route to a sensitive
handler can be confirmed; missing network controls alone are `needs-validation`. `probe` settles a running instance.

**Secret exposure across workload boundaries**: secrets in logs, crash reports, process arguments, shared
environment, build output, service discovery or a read API another workload or tenant can reach. A secret
*reference* is not disclosure; a public endpoint or key id is not a credential.

**Credential renewal and outage fallback**: a failed mount, refresh or rotation leaves a stale credential active,
or the app falls back to a less trusted identity mode (fail-open) when the secret store is unavailable. Review
startup, readiness and reconnect behaviour. Pairs with the core Fail-Open Credential Check.

## Moves

- Walk backward from a released digest or installed update to every source, generated input, credential, worker,
  cache, test result and authorisation decision.
- Compare an untrusted and a protected workflow event side by side; mark every persisted channel crossing between
  them and require an immutable identity plus producer trust.
- Review the failure paths: revoked key, failed download, missing attestation, partial platform release, rollback,
  registry outage. The failure policy is part of release integrity.

## Gate

1. Name the lower-trust actor, the controllable source/cache/artefact/metadata, the consuming trusted job or
   updater, and the resulting unauthorised publication, code inclusion, secret disclosure or privileged execution.
2. Prove identity across the broken handoff: a different mutable name or unbound digest must reach a real consumer.
3. Keep validation local: a harmless fixture repo, a dummy credential marker, no publish and no real release.
4. Critical for a traced path from untrusted code or input to a secret, a release or privileged execution;
   Important for a narrower reach; unknown hosted controls are `needs-validation` with the exact setting to read.
