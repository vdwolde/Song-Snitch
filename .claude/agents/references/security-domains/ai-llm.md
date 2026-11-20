# Domain: AI, LLM and agents

Adapted from `cloudflare/security-audit-skill` (MIT, Copyright (c) 2025-2026 Cloudflare, Inc.), rewritten as
detection shapes for this base. Loaded only when the brief's `## security` section names `ai-llm`.

**Load when:** a language model takes part in a trust-sensitive decision: prompts assembled from untrusted
input, retrieval (RAG), persistent agent memory, tool-calling or MCP, or model output that is acted on or rendered.
The flow to trace is *untrusted content → model or memory → capability, authority or sink*. Transport, access
control, injection and rendering stay ordinary boundaries (the core classes); this file is the delegation layer.

## Discipline

- Prompt injection alone is not a finding. It needs a code-level boundary failure: content reaches another
  principal's context, invokes authority the requester lacks, discloses data they cannot read, or drives a sink
  they cannot reach directly.
- Model output, memory, tool descriptions and MCP responses are untrusted input. Point at the code that grants
  authority, trusts the output, writes durable state or feeds a sink.
- A guardrail prompt is not a boundary. Count only deterministic checks: resource-scoped authorization,
  isolation, binding, constrained credentials.
- Name the attacker, the affected principal, the effective execution identity, the resource and the exact action.
  A user asking for something their own authority allows is not a delegation defect just because a model ran it.
- Authorization and action binding are separate controls. Attacker content that causes an action under a victim's
  valid authority is a binding failure when the victim never asked for that exact action.
- The base's own hard check applies first: `{` and `}` in user values reaching a templated prompt, and ingested
  free text treated as instructions (root `CLAUDE.md` § Security defaults) is Critical.

## Classes

**Indirect injection through ingested content**: someone can write a RAG document, indexed page, file, email,
issue body, tool response or metadata that enters a *different* principal's model context. Trace who can write each
source, how retrieval scopes it, whose session consumes it and what capability is on there. Proof: the missing
deterministic control (scope, isolation, binding), not persuasive text. Do NOT flag a source only the same user
writes and reads.

**Context bleed across sessions or tenants**: history, embeddings, retrieval results or prompt caches keyed too
broadly. Proof: the tenant/ACL filter is absent from the query itself or from a cache key on some path (batch,
alternate query, shared cache). A tenant column on the stored object is not enforcement.

**Persistent memory poisoning**: attacker-controlled content or a model summary is written to memory that later
shapes another user's task or a privileged session. Check who can create, update, merge and delete memory, whether
low-trust observations become durable instructions, whether retrieval separates user preference from tool policy.
Do NOT flag memory a user saved on purpose and that only drives that user's own allowed requests.

**Role and provenance confusion**: prompt assembly lets untrusted text pose as a system message, earlier turn, tool
result or memory record (string concatenation, untyped history, a caller-supplied `role`, a serialization round
trip that drops source labels). Proof: the forged provenance changes a deterministic trust decision or reaches a
capability.

**Tool-argument injection into a sink**: model-produced arguments reach SQL, a shell, a file path, a URL fetch or a
privileged API without validation in the handler. Treat the tool schema as input parsing and follow each field to
the sink. Structured output narrows the shape; it does not make a path, URL or query safe.

**Excessive agency / confused deputy**: the agent runs under a service identity or broad credential and the handler
never re-checks the *requesting* principal on the named resource. Proof: the requester could not do that exact
thing through the normal product. Do NOT flag a shared credential with enforced per-user query scope.

**Approval and action binding**: a user approves one described action but execution can use changed arguments, a
different resource or principal, or a later model turn; retries and resumed sessions replay or mutate the side
effect. Proof: approval or intent binds the normalised tool name, the complete argument object, requester, target
and expiry, compared with what the handler uses.

**Schema vs dispatcher disagreement**: the schema accepts aliases, extra fields, duplicate keys, coercions or
free-form nested objects that the handler reads differently. Proof: the validated object differs from the object
the handler acts on, at a resource selector or a security option.

**Unbounded delegated loops**: one bounded request enqueues repeated spend, sends, mutations or external API calls
with no per-request budget, per-action authorization, cancellation or idempotency key. Proof is the code-level
accounting, never an actual flood. Pairs with the webhooks-abuse spend class.

**Sub-agent and MCP trust inheritance**: a delegated task or MCP server receives the whole session, credentials,
memory or capabilities instead of the least authority; delegated results are trusted on return. (Base) Spawning
Claude Code or another tool-using model with permission gates removed is already a core class; check the same
inheritance for hooks, skills and `settings.json` copied from a repo the model did not author.

**MCP identity and metadata as policy**: calls or results routed by server name, tool name, request id, resource URI
or model-chosen alias rather than the authenticated connection and the outstanding request; tool descriptions,
prompts or schemas from an MCP peer treated as authorization. Metadata can guide a model; it cannot grant
capability. Look for the deterministic allowlist and the handler authorization that stay authoritative.

**Unsafe rendering of model output**: model text reaches HTML, Markdown, a template, a URL or a command without the
sink's encoding. For browsers, confirm sanitisation and CSP in `client-side`; a renderer outside the repo makes it
`needs-validation`.

**Sensitive context extraction**: the assembled context holds credentials, another user's data or policy values
that grant access, and user-influenced output can expose them. Read prompt assembly and data fetch. Do NOT flag
disclosure of generic instructions that crosses no data boundary.

## Moves

- Draw four maps first: each execution identity, each capability, every writable context or memory source, each
  output destination. Then connect the principal at the start to the authority at the end.
- Start at side-effecting tools and work backward through dispatcher, schema, confirmation, context, retrieval and
  ingestion. Start at durable memory reads and trace every writer.
- Compare direct, queued, retry, resume, batch and delegated paths for the same action. The strongest gate must
  hold after the arguments are final and before every side effect.

## Gate

1. Name the crossed boundary and the observable result: attacker, affected principal or shared resource,
   execution identity, target, and the unauthorised or unrequested action or disclosure.
2. Confused-deputy: prove the tool lacks requester-and-resource authorization *and* the attacker could not do it
   normally. Action-binding: prove attacker content caused an action the principal did not intentionally request.
3. Memory or retrieval: cite both the attacker-controlled write and the later cross-principal read or privileged
   decision. A shared record with no reachable consumer is not enough.
4. MCP identity, renderer, provider or model behaviour that lives outside the repo: `needs-validation` with the
   exact missing fact. Critical for a traced path to another user's data or an unrequested side effect; Important
   for a narrower reach; otherwise a lead.
