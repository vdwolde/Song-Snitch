# checkpoints — a folder or a voice profile survives a cut-off

Read by `/content` only for a folder job (`humanize`, `tighten` or `audit` on a folder) or for `voice`. One pasted
text is one response and needs no checkpoint.

The work that spans many steps does: a folder, and `voice`. Progress lives outside the conversation and outside
the repo, in the shared helper (`node ~/.claude/tools/checkpoint.mjs <command> content ... --root <folder or
project>`; state in `%LOCALAPPDATA%\claude-checkpoints`):

- **Folder, `humanize` or `tighten`.** After the audit and the user's confirmation, `start content
  "<mode>:<folder>"` and `add` each confirmed file as an item. Per file: `begin <file>`, edit, run `facts` and
  the checks, and only then `done <file> --stdin` with that file's change summary (before and after numbers,
  flags, anything left for a human). The folder report is `results content`, so it survives a cut. The audit
  list itself is `save audit`.
- **Folder, `audit`.** Save the ranked list (`save audit`), make the worst five items, and `done` each with its
  findings as the note, so the one-by-one reading is never repeated.
- **`voice`.** `save voice-draft` the measured numbers and the written profile **before** asking to save it,
  so a cut after the expensive reading costs only the question. A resume loads the draft, re-asks, and writes
  `voice.md` (still never without asking).
- **Resume.** The same request, or `/content resume` (`list content`, latest `OPEN` job), finds the job. Skip
  done files. A file left `doing` may or may not have been edited: run `tracked` and `facts` against what
  you have and then either verify it or redo it from the saved original in git; never assume.
- **On a usage-limit error:** stop after the file in flight, `fail` it, and report the files done, the files
  left and how to resume. `finish content` when the worklist is empty.
