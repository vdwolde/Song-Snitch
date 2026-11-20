# Failure Patterns Reference

34 patterns that waste tokens and cause re-prompts, scoped to Claude Code and Claude chat/API —
the only two targets `/prompt` covers. Read this file when the user pastes a prompt to fix, or a
brief is underperforming and needs diagnosis. Used by `fix` mode (`fix.md`), which shows the top three
changes and why; flag first any fix that would change the user's stated intent.

Trimmed and re-verified from the upstream `prompt-master` taxonomy (see `../LICENSE`). Patterns
tied to specific model versions or to reasoning-native models outside the Claude family were
removed or rewritten version-neutral — nothing here should go stale because a model version
changed.

---

## Task Patterns

| # | Pattern | Before | After |
|---|---|---|---|
| 1 | **Vague task verb** | "help me with my code" | "Refactor `getUserData()` to use async/await and handle null returns" |
| 2 | **Two tasks in one prompt** | "explain AND rewrite this function" | Split: explain first, rewrite second |
| 3 | **No success criteria** | "make it better" | "Done when the function passes existing unit tests and handles null input without throwing" |
| 4 | **Over-permissive agent** | "do whatever it takes" | Explicit allowed-actions list plus explicit forbidden-actions list |
| 5 | **Emotional task description** | "it's totally broken, fix everything" | "Throws uncaught TypeError on line 43 when `user` is null" |
| 6 | **Build-the-whole-thing** | "build my entire app" | Split into Prompt 1 (scaffold), Prompt 2 (core feature), Prompt 3 (polish) |
| 7 | **Implicit reference** | "now add the other thing we discussed" | Restate the full task — never reference "the thing we discussed" |

---

## Context Patterns

| # | Pattern | Before | After |
|---|---|---|---|
| 8 | **Assumed prior knowledge** | "continue where we left off" | Point at the owning doc (`.claude/DECISIONS.md`, prior turns) instead of assuming it carries forward |
| 9 | **No project context** | "add authentication" | "JWT verify middleware following the pattern in `.claude/STACK.md`; routes in `src/routes/auth.js`" |
| 10 | **Forgotten stack/decision** | New prompt contradicts an established choice | Cite `.claude/DECISIONS.md` or `.claude/STACK.md` rather than re-deciding silently |
| 11 | **Hallucination invite** | "what's the standard way to do X?" | "Use only what you're highly confident is accurate. If uncertain, say so." |
| 12 | **Undefined audience** | "write something for users" | "Non-technical end users, no coding knowledge, reading the in-app help text" |
| 13 | **No mention of prior failures** | (blank) | "Already tried X — it failed because Y. Do not suggest X again." |

---

## Format Patterns

| # | Pattern | Before | After |
|---|---|---|---|
| 14 | **Missing output format** | "explain this concept" | "3 bullet points, each under 20 words, one-sentence summary at top" |
| 15 | **Implicit length** | "write a summary" | "Exactly 3 sentences" |
| 16 | **No role assignment** | (blank) | "You are a senior backend engineer specializing in Node.js and PostgreSQL" |
| 17 | **Vague aesthetic adjectives** | "make it look more professional" | "Monochrome palette, 16px base font, 24px line height, no decorative elements" |

---

## Scope Patterns

| # | Pattern | Before | After |
|---|---|---|---|
| 18 | **No scope boundary** | "fix my app" | "Fix only the login form validation in `src/auth.js`. Touch nothing else." |
| 19 | **No stack constraints** | "build a React component" | "React 18, TypeScript strict, no new dependency, Tailwind only" |
| 20 | **No stop condition for an agent** | "build the whole feature" | Explicit stop conditions plus a ✅ checkpoint after each step |
| 21 | **No file path for a code edit** | "update the login function" | "Update `handleLogin()` in `src/pages/Login.tsx` only" |
| 22 | **Pasting the whole codebase as context** | Full repo context on every prompt | Scope to the relevant function and file only, point at docs by path for the rest |

---

## Reasoning Patterns

| # | Pattern | Before | After |
|---|---|---|---|
| 23 | **No reasoning cue for a logic task** | "which approach is better?" | "Think through both approaches carefully before recommending one" |
| 24 | **Redundant thinking scaffolding** | "think step by step" plus a fixed budget on top of Claude's own adaptive thinking | Drop the scaffolding — not a manual step list. For an API target set depth with `effort`; for a chat target with no such control, one plain sentence about how much deliberation the task deserves is enough |
| 25 | **Expecting inter-session memory** | "you already know my project" | Re-provide the relevant context or doc path in every new session |
| 26 | **Contradicting prior work silently** | New prompt ignores an earlier architecture decision | Cite `.claude/DECISIONS.md` and reconcile explicitly, don't just diverge |
| 27 | **No grounding rule for a factual task** | "summarize what's true about X" | "Use only information you're highly confident is accurate. Say [uncertain] if not." |

---

## Agentic Patterns (Claude Code)

| # | Pattern | Before | After |
|---|---|---|---|
| 28 | **No starting state** | "build me a REST API" | "Empty Node.js project, Express installed, `src/app.js` exists" |
| 29 | **No target state** | "add authentication" | "`src/middleware/auth.js` with JWT verify. `POST /login` and `POST /register` in `src/routes/auth.js`" |
| 30 | **Silent agent** | No progress output requested | "After each step output: ✅ [what was completed] — [files affected]" |
| 31 | **Unlocked filesystem** | No file restrictions stated | "Only edit files inside `src/`. Do not touch `package.json`, `.env`, or any config file." |
| 32 | **No human review trigger** | Agent decides everything autonomously | "Stop and ask before: deleting any file, adding any dependency, or changing a database schema" |
| 33 | **Vague first turn** | "fix the auth bug" — no scope, no files, no criteria | Claude Code reads instructions literally and won't fill in missing context with a guess. Front-load intent, file scope, constraints, and acceptance criteria in the first turn — use the Task Brief in `write.md`. |
| 34 | **Context rot on a long session** | Repeatedly correcting the same session for 60+ turns | New task = new session. Compact when context fills rather than letting corrections stack. Spin off a subagent for file-heavy investigation so it stays out of the main context. |
