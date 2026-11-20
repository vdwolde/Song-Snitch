# agent — write the durable thing, not a one-off prompt

For something that will be loaded again and again: a subagent definition, a skill, a system prompt, or a
`CLAUDE.md` rule. **The formats are owned by `Development Base/CLAUDE.md` § Subagents and skills.** Read it and
follow it; this playbook only says what to check, so the rules live in one place. Empty shapes for each kind
are in [skeletons.md](skeletons.md).

## Choose the kind

| Kind | Where it lives | Shape |
|---|---|---|
| Subagent | `~/.claude/agents/<name>.md` (machine-wide) or `<project>/.claude/agents/` | Frontmatter `name` (kebab-case), `description`, `tools` (comma-separated, capitalised, the minimum); then the role, the steps, an output contract |
| Skill | `~/.claude/skills/<name>/SKILL.md` or `<project>/.claude/skills/<name>/` | Frontmatter `name` and `description`, a lean `SKILL.md` that routes, detail in `references/`, a deterministic helper in `tools/` |
| System prompt | Wherever the app keeps it | XML sections, static content first, an untrusted-input slot if it reads outside text |
| `CLAUDE.md` rule | The root file or the project's, in whichever one owns that topic | One rule, then **Why** and **How to apply** |

Ask which one if the request does not say (counts toward the 3 questions). Do not write the file unless the
user asks; return the text and the path it belongs at.

**Is it really a hook or a setting?** "Always run X after an edit", "never allow Y", an environment variable or
a permission is configuration, not an agent or a skill. Say so and point to the `update-config` skill (hooks,
permissions and env in `settings.json`) instead of writing prose that the harness will not enforce.

## Checks before delivering

1. **Name and collisions.** List what exists (`~/.claude/agents`, `~/.claude/skills`, plus the project's own
   `.claude/` folders) and avoid a name or a job that is already taken.
2. **Overlap scan.** Pull the existing descriptions (grep `^description:` in `~/.claude/agents/*.md` and
   `~/.claude/skills/*/SKILL.md`) and compare their `Use when:` phrases with the new ones. If two would fire
   on the same request, either narrow the new one, add a routing line to both ("for X, use the other"), or
   fold the new job into the existing one.
3. **The description is the costly part.** Every agent and skill description is announced in every
   conversation on this machine. Keep it short: what it does, when it fires, and a trailing
   `Use when: <phrase>, <phrase>` clause. Say "dispatched by X; not for direct use" for an internal one.
   **Length guide, measured on this machine on 2026-10-06:** the agents here run about 200 to 300 characters
   and the skills about 300 to 650. Aim at or under **300 for an agent and 650 for a skill**; over that, cut
   words that only restate the name, or move detail into the body. A guide drawn from existing files, not a
   limit from the format.
4. **Minimum tools.** A reader gets `Read, Grep, Glob`. Add `Bash` only if it must run commands, and say which.
   A reviewer never edits.
5. **An output contract.** For anything that reports back: one finding per line as `path:line — claim`, no
   preamble, no recap, cite only lines it read, `nothing found` instead of a guess. Context economy applies to
   what an agent hands back as much as to what it reads.
6. **Model.** Default to the parent's model. Name a cheaper one only for bulk, rote work with no judgement.
7. **Point, do not copy.** Cite a doc by path instead of pasting its facts. A rule that lives in two files
   will diverge.
8. **Scripts versus skills.** A fully deterministic procedure is a script, not a skill. A skill earns its
   `SKILL.md` by needing judgement somewhere in the middle.
9. **Not a Copilot file.** Never `AGENTS.md`, `AGENT.md` or `copilot-instructions.md` in a personal project, and
   not the `.agent.md` format.
10. **No secrets** and no real credentials in the text.

## For a `CLAUDE.md` rule

State the rule in one line. Add **Why** (the incident or reason, so a future reader can judge edge cases) and
**How to apply** (when it kicks in). Before adding it:

- **Grep for a duplicate.** Search the root `CLAUDE.md`, the project's `CLAUDE.md` and its `.claude/` docs for
  the rule's key words. If one already says it, change that one or point at it. A fact lives in one place.
- **Find the owner.** The rule goes in the file whose topic it is (a git rule in § Git, a security rule in
  § Security defaults), not at the bottom of whichever file is open.
- **A rule an agent repeatedly fails to follow** should become a check (a lint rule, a `REVIEW.md` gate, a
  hook) instead of being restated louder.

## Output

1. The file's text in one copyable block, and the exact path it belongs at.
2. **Three test requests**, returned with every new skill or subagent, so the user can try it once:
   - one that **should fire** it, in the words a user would really type;
   - one **near miss** that must **not** fire it (it belongs to a neighbouring skill or agent, named);
   - one **edge case** (vague, or a mix of two jobs) with what it should do.

   For a rule or a system prompt, give three inputs and the behaviour each should produce instead.
3. One line on what to verify after saving: for a skill, that its description shows up in the skill list; for
   an agent, that the dispatching skill names it; for a rule, that no second copy of it remains.

## Next

For a prompt the new agent will run unattended, suggest `unattended`.
