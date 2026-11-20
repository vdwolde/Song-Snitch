---
name: content
description: Edit prose in four modes — humanize (remove the signs of AI writing and keep every fact; the default), audit (report the tells, change nothing, one file or a whole folder), tighten (shorter, no fact lost, to a word or character limit if you give one), voice (learn your own writing voice and apply it). Use when: humanize this, make this sound less like AI, does this read like AI, audit these docs, tighten this, make this shorter, learn my writing voice.
---

# /content

Adapted from the third-party `humanizer` plugin (MIT, blader), whose taxonomy traces back to Wikipedia's
"Signs of AI writing" guide (CC BY-SA, WikiProject AI Cleanup). This fork keeps the category structure and the
before/after teaching method; every description and example is written fresh. See `LICENSE`.
`/content help` prints the mode table below and stops.

## Step 1 — Pick the mode

| Mode | Use it when | Playbook |
|---|---|---|
| `humanize` (default) | "Make this sound less like AI." Rewrites the text, every fact kept | [humanize.md](references/humanize.md) |
| `audit` | "Does this read as AI?" Report only: where the tells are and how bad. One text, or a whole folder ranked | [audit.md](references/audit.md) |
| `tighten` | A draft, README, PR or message that is too long, or must fit a limit. Shorter, no fact lost | [tighten.md](references/tighten.md) |
| `voice` | Once. Learns how you write from samples, saves it, and the other modes then apply it | [voice.md](references/voice.md) |

**If the request clearly fits a mode, start it.** Hints: "rewrite", "sounds like ChatGPT", "humanize" →
humanize. "Does this read as AI", "check this", "how bad is it", "which of my docs" → audit. "Shorter", "cut this
down", "too long", "fit in 72 characters" → tighten. "My voice", "sound like me", "learn from these samples" →
voice. **If it is vague** ("fix this text", "improve this"), ask once with `AskUserQuestion`: the four modes as
the options. Never run two modes on one request without saying so.

**Other skills own other jobs.** Dutch business text and email in the house style: `tekst-herschrijven` and
`email-rewriter`. LinkedIn posts: `linkedin-humanizer`. `/content` removes the tells of AI writing from any
other text and checks that no fact moved. The patterns are English; Dutch text is not covered.

## Rules for every mode

1. **Preserve the information, not the shape.** Every claim in the source survives. If keeping information
   and mirroring the structure conflict, information wins.
2. **Never invent a fact.** No name, number, date, quote or claim appears that is not in the source or given
   by the user. Opinions and reactions are voice, not facts, and may be added only where
   [humanize.md](references/humanize.md) allows. Exception: fiction.
3. **Match the register.** Formal stays formal, casual casual, technical technical.
4. **Never touch** code blocks, inline code, YAML frontmatter or link targets.
5. **The writer's voice outranks the defaults.** If `~/.claude/skills/content/voice.md` exists, read it first
   (the section for the register at hand); a sample the user pastes now outranks both. Its dash rate replaces
   the zero-dash default, and its habitual words are allowed.
6. **Check, do not promise.** The helper `node ~/.claude/skills/content/tools/content-lint.mjs` does the
   counting: `check` (tells; `--by-paragraph`; `--dir` for a folder; `--voice voice.md [--register name]` or `--dash-rate N`; `--allow-words a,b`),
   `compare` (before and after), `facts` (what was dropped or appeared), `conform` (a text against
   `voice.md`), `words` (words, characters, limits) and `tracked` (git status of a file). For text pasted into
   the chat, write it to the scratchpad first. A text under about 100 words can be judged by eye.

## How the text arrives

- **Pasted text (default).** Return the final text and a short change note (what changed, before and after
  numbers, what still needs a human, any fact flag the helper raised). The intermediate draft only on request
  (`--show-draft`).
- **File mode.** The user points at a file. Run `tracked` first: **tracked and clean** means a diff is a clean
  undo, so rewrite in place and give a diff summary; **tracked with uncommitted changes** or **untracked**
  means say so and ask before touching it. Edit prose only; `facts` must report code, links and frontmatter
  unchanged. `audit` never edits.
- **A folder.** `audit` ranks every markdown and text file by its tells (`check --dir`) and reports the worst.
  For `humanize` or `tighten` on a folder: audit first, show the list, and edit only the files the user
  confirms, each with its own summary. Never rewrite a folder in one go. A folder is a job with a worklist:
  see Checkpoints.
- **Embedded.** Another task uses this as a step (a PR description, a commit message). Run it internally and
  output only the final text.

## Checkpoints — a folder or a voice profile survives a cut-off

One pasted text needs none. **A folder job and `voice` do: read [checkpoints.md](references/checkpoints.md)
before the first step** (the shared helper `node ~/.claude/tools/checkpoint.mjs`, the per-file protocol, resume
with `/content resume`, and what to do on a usage-limit error).

## Stop and ask before

Overwriting an untracked file, or one with uncommitted changes · editing more than one file · deleting a file ·
inventing a detail a sentence seems to need (ask for it, or leave the sentence general) · saving or replacing
`voice.md`.

## Reference files

[patterns.md](references/patterns.md) (the tells, read whole by `humanize` and `audit`; `tighten` reads only its
"Filler and hedging" section), [checkpoints.md](references/checkpoints.md) (folder jobs and `voice` only). Only the
chosen mode's playbook is read.
