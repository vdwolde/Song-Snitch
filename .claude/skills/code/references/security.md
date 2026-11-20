# security — what an attacker could do

Lens: `security` (1 agent per shard, `review-runner`). On a `--all` run with more than 3 shards two more units
bracket the wave: a `recon` unit before it and a `coverage-critic` unit after it (below).

## Before the agent

0. **Is the target yours?** `scope` prints an `origin:` line (credentials stripped). It is your own code when the
   origin owner is `vdwolde`, the folder is under `Development Base\Projects`, or the user said so in this turn.
   Anything else (a stranger's clone, a downloaded repo, inherited code you cannot place) is **unverified**, and
   running its tests, build, lint config or benchmarks runs its code on this machine. For an unverified target
   report every such gate as `blocked: target not verified as yours` and run only the static helpers (`prefilter`,
   `entrypoints`, `domains`, `history`, `deps`). An audit that only reads a lockfile (`npm audit --omit=dev`) may
   run; one that restores or builds the project (`dotnet list package --vulnerable`, `pip-audit` on a project
   directory) is blocked too. The user lifts this by saying the code is theirs.
`run prep` runs steps 1 to 5's helpers (`entrypoints`, `domains`, `prefilter --mode security`, `history`, `deps`)
in one go and addresses them to the `security` lens; what follows says what each is for and what stays yours
(the ownership check, the domain choice, the trust sketch, the audit gate, `probe`).

1. **The entry-point map first:** `entrypoints <scope>`: routes (including Next.js `route.ts` handlers and
   server actions), sockets, CLI arguments, file and network readers, process execution, environment. This is
   where outside input can enter; the reviewer starts from it. For route files it also shows each file's
   guard and effect, any global auth hook, and trust leads (a public route with a side effect and no auth or
   rate-limit marker, or a webhook-looking route with no signature check). Add a three-line **trust-boundary
   sketch** of your own (who can reach the entry points: the local user, the LAN, the internet) so severity is
   judged against reality; the recon unit (step 7) replaces it on a large run.
2. **Domains:** `domains <scope>` lists candidate domain files with the evidence for each. Confirm every
   candidate against the **boundary it names**, never the dependency name alone. Put the chosen ids in the shared
   `## security` section (`run save shared --append`) as `Domain files: <ids>` and, for every candidate you rejected, one line
   `Excluded: <id> — <reason>`, so a silent omission is visible (a brief that sees `Domain files:` lists those files
   under "Also read"). The files live in
   `~/.claude/agents/references/security-domains/` and cost nothing unless chosen:

   | id | Load when |
   |---|---|
   | `ai-llm` | a model takes part in a trust decision: prompts from untrusted input, retrieval, memory, tools or MCP, model output acted on or rendered |
   | `desktop-ipc` | a desktop app, Windows service, elevated helper, updater, named pipe or socket, WebView host, URI scheme |
   | `web-auth` | a deployed or LAN web app or API with sessions, logins, resets, API keys, or its own cache or proxy |
   | `client-side` | browser code that renders untrusted content, handles messages, or keeps secrets in browser storage |
   | `data-isolation` | data that users or tenants must not see across; derived copies; exports; deletion or revocation promises |
   | `supply-chain-deploy` | CI workflows, a Dockerfile, release or publish scripts, an updater, deployment config |
   | `webhooks-abuse` | inbound provider callbacks, queues, uploads or archives, public endpoints that can spend money or shared capacity |

3. `prefilter <scope> --mode security` for leads (secrets, shell exec, SQL concatenation, TLS off, open bind,
   CORS any origin, unsafe deserialization including .NET formatters, XSS sinks, `postMessage` and web-storage
   tokens, prototype-pollution merges, security TODOs; PowerShell, GitHub Actions, Dockerfile and tracked `.env`
   patterns).
4. **Secrets in history:** `history`: a commit and file where a known secret shape or an `.env` file was added.
   Values are never printed. Anything real must be rotated; a history rewrite is a separate, authorised step.
5. **Dependencies:** the audit gate from `gates` (`npm audit --omit=dev`, `uvx pip-audit`,
   `dotnet list package --vulnerable`; network, so report `unavailable` if it cannot run and never imply the
   dependencies are clean) and `deps` (unpinned versions, packages that run code on install, git or tarball
   sources, and vendored front-end libraries that no audit gate can see).
6. **Live check, when a server is running:** `probe <url>` (`code-tools.mjs`). It is passive: GET and OPTIONS
   only, no payload, no credentials, no body, no redirects followed; cookie values and bodies are never
   printed. It reports what the running server actually sends: security headers, cookie flags, a foreign
   `Host` or `Origin`, CORS reflection, exposed `.env` / `.git` / service-account / source-map / API-doc files,
   stack traces on an error page, TLS trust, expiry and protocol, and (Windows, loopback) the bind address.
   - Only when the user named a URL or said the app is running. **Never start the app to probe it**; nothing
     answering is reported as `unavailable`, never as `pass`.
   - A loopback URL needs nothing more. **Any other host needs the user's confirmation in that turn that they
     own it or have written authorization, then `--owned`**; the helper refuses otherwise. Never infer
     ownership from a bare URL, and never probe a well-known third-party domain.
   - Add the output to the shared `## security` section and list the live check in the gates table
     (`pass` / `fail` / `unavailable`). It observes that one running instance, not the code.
7. **Recon unit (only a `--all` run with more than 3 shards):** `run add recon1 --lenses recon --kind recon`
   with the entry-point map, the `stack` output and the files that hold authentication, sessions, data access and
   configuration in the brief, then `run next --kind recon --n 1`, dispatch it alone, `run done recon1`. Put the
   trust map it returns (`run results --kind recon`) into the shared `## security` section under `Trust map`,
   before the first wave. A small run keeps the three-line sketch.

Pass all of it to the reviewer. Tell it never to print a secret value: file, line and kind only.

## After the wave: the coverage critic (the same large runs)

When no lens unit is pending, collect every unit's `traced:` block from `run results`.
`run add crit1 --lenses coverage-critic --kind critic` with the entry-point map, the trust map, the shard file
lists, those blocks and the merged finding titles; `run next --kind critic --n 1`, dispatch, `run done crit1`.
For each `gap:` you accept (after a quick look that it is real and in scope), `run add gap1 --lenses security
--kind gap` with the paths and boundary it names, the pointer to `shared`, and the same output rules, then
dispatch and store it like any unit. **One round, no loop.** Whatever the critic still lists, and every `thin:`
line, goes in the report as not reviewed. Never call coverage complete.

## Verification is stricter here

Every Critical and Important needs one traced path from untrusted input to the sink (the lens writes it in
`scenario`); the independent `verify` lens walks that path and looks for the guard. Before that:

- **Consolidate by root cause.** One missing guard behind five routes is one finding listing the five sites;
  independent missing controls stay separate: `run edit F3 --join F7`. `run merge` merges the `needs-validation:`
  leads by claim and keeps the `hardening:` and `traced:` blocks out of the findings.
- **Citations:** `run merge` runs the `cite-check` itself on every finding. A finding whose cited file or line does
  not exist was not read: it is dropped and listed ("N citations unresolved" in the report).
- **Verify the leads too.** `run verify-plan` sends the `needs-validation` leads (ids `L1..`) in the same `verify`
  units as the findings, about 8 items per unit. `CONFIRMED` means the source settles it and it holds: give it a
  severity with `run edit new`; `PLAUSIBLE` keeps it as a lead; `REFUTED` drops it.

The **second look** over files touching auth, input handling, money, data writes and process execution is
`look1`, which `run verify-plan` plans for you (its lens is `security` here).

## Report emphasis

Severity follows exploitability and reachability, not the pattern's name (anchors are in the lens). After the
verdict add:

- **Needs validation:** a table of the leads that stood: the claim, the exact blocker, the owner check. No
  severity, not counted in the verdict, never called a vulnerability.
- **Attack surface, from evidence:** count the `traced:` lines as covered / finding / blocked, and list every
  entry point not reached, every `thin:` or unresolved `gap:` and the critic result (or that none ran). What the
  live check observed, or that it was `unavailable`. Never fill this from the map alone.
- **Controls that held:** two to five lines naming verified protections the `traced:` lines record (for example
  "all six mutating routes check ownership through `requireOwner`").
- **Hardening:** the `hardening:` notes, one line each, never in the verdict.

A finding whose remedy is not a code edit (rotate a secret, renew a certificate, change a DNS or hosting
setting) is tagged **`owner action`**: report it clearly, and `--fix` never attempts it. Say "no Critical
or Important found in the reviewed scope", never "secure". List the audit and any other gate that could not run.
Report excluded-item conflicts prominently: a Critical security finding is never suppressed.

## Next

`/code quality` for the non-security issues noticed on the way; `/code tests` for the missing checks on a
security path. For a **second opinion on the same scope**, re-run with `--fresh` and give the reviewers the first
pass's finding titles (title and root cause only) as an exclusion list so they hunt elsewhere; Cloudflare reports
that a single audit run found roughly half of what repeated runs found (their figure, conditions not published,
so treat it as a reason to repeat a high-stakes audit, not as a measurement of this skill).
