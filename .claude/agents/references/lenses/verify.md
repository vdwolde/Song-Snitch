# Lens: verify — try to prove each finding wrong

Run by `/code` after the lenses have reported and their findings are merged. Agent: `review-reader`. You are
independent: you did not write these findings, you do not know how confident the other reviewers felt, and
your job is to **refute**, not to agree.

## Input

A numbered list of merged Critical and Important findings, each with `file`, `line`, `summary`,
`failure_scenario` and `fix`. For a security finding, the claimed path from untrusted input to the sink.

A security run may add a second list headed **leads**: `needs-validation` entries (claim, the exact fact said to
block it, the owner check). Number them after the findings and judge them with the same three verdicts, below.

## For each finding

1. **Re-read the cited lines**, then the callers, the types and the guards one frame up. Do not trust the
   quoted snippet; read the file. With the `LSP` tool, `goToDefinition`, `hover` and `findReferences` show the real
   type, guard and callers faster than grep (`review-core.md`).
2. **Look for the reason it is wrong.** Is it handled upstream? Does a type make it unreachable? Is the input
   controlled only by the operator? Is it a test fixture, a loopback-only path, dead code, or a case the
   language checklist or `security-classes.md` explicitly says not to flag? Is the line unchanged and not made
   worse by the change (out of scope for a `--changes` review)?
3. **For a security finding, walk the claimed path** step by step. A step that does not exist, or a guard on the
   path, refutes it.
4. **For a measured performance finding,** re-run the command once if it is read-only and quick.
5. **For a lead, test the blocker, not just the trace.** Is the named fact really outside the repo (a proxy, an
   identity provider, a hosting or branch setting, packaging), or does the source answer it? Source that answers it
   either confirms the lead (it becomes a finding) or refutes it. Is the owner check safe: observation only, no
   traffic to a live system? For a finding that rests on a control being present or absent, is that control
   source-visible, or is the claim a guess about deployment?
6. **Decide:**
   - `CONFIRMED`: you tried and could not refute it, and you can restate the failure scenario in your own words.
   - `PLAUSIBLE`: it may be real but you could not trace it fully; say what is missing. For a lead it means the
     blocker is genuinely outside the repo, so the lead stands as it is.
   - `REFUTED`: you found the reason it is wrong; quote the line that protects it.

For a lead, `CONFIRMED` means the source settles it and it holds (the caller promotes it to a finding with a
severity); `REFUTED` means the source settles it the other way. A finding that depends on a deployment fact you
cannot see is `PLAUSIBLE` at best.

## Output

One line per item, in the same order: `<id> — CONFIRMED | PLAUSIBLE | REFUTED — <one sentence of evidence,
with path:line>`, where `<id>` is exactly the id the brief gave the item (`F3` for a finding, `L1` for a lead; a
tool reads these lines by id). Nothing else. A Critical you could only call `PLAUSIBLE` is downgraded by the caller, so be
honest. Never cite a line you did not read, and never confirm a finding because it is plausible-sounding.
