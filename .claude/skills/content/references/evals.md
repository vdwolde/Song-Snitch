# evals — the maintainer's walk-through (not read at runtime)

After any edit to this skill or its helper, walk each request below on paper against `SKILL.md` and the
playbooks. Every row must still route as written and every "must hold" must still be written down. The helper
is tested with `node tools/content-lint.mjs --self-test`.

| # | Request | Route | Must hold |
|---|---|---|---|
| 1 | "make this sound less like AI" + pasted text | humanize | baseline `check --by-paragraph`; rewrite; `check` shows zero dashes; `facts` shows nothing dropped or new; before and after numbers in the note; final text plus a short note, no draft |
| 2 | humanize a text whose verdict is light | humanize, minimal edit | only the hotspot paragraphs change; the others are byte for byte the same |
| 3 | "does this read like ChatGPT?" + a file | audit | nothing rewritten or edited; a pattern table; two separate verdicts (dashes, other tells); the human signals to leave alone; the verdict called a heuristic |
| 4 | "which of my READMEs read as AI?" + a folder | audit, batch | `check --dir` ranking; the worst five audited one by one; nothing edited |
| 5 | "make this README intro half as long" | tighten | before and after words and characters from the helper; `facts` clean; the list structure kept; no fact cut to hit the target (if it cannot be met, it says so) |
| 6 | "shorten this commit subject to 50 characters" | tighten, limit | `words --max-chars 50` says `ok`; imperative mood kept; no invented detail |
| 7 | "learn my voice" + two samples | voice | samples checked first; a heavy sample is flagged; profile shown and saved only after a yes; rules only, at most three phrases; a dash rate computed; `conform` confirms |
| 8 | "fix this text" | one `AskUserQuestion` with the four modes | nothing is edited before the answer |
| 9 | humanize with `voice.md` present and a 0.8 dash rate | humanize | dashes allowed up to that rate, not banned; habitual words allowed |
| 10 | humanize a markdown file with a code block and links | humanize, file mode | `tracked` run first; code fences, link targets and frontmatter unchanged, confirmed by `facts` |
| 11 | humanize an untracked file, or one with uncommitted changes | humanize, file mode | `tracked` says so and it asks before touching it |
| 12 | humanize every file in a folder | humanize, folder | audit first; the user confirms which files; each gets its own summary; never one big rewrite |
| 13 | the rewrite needs a detail the source does not give | humanize | asks for it or leaves the sentence general; never invents it |
| 14 | a source that says "42 percent" and "March 5", a rewrite that says "42%" and "5 March" | humanize | `facts` does not report them as dropped |
| 15 | "make this email sound professional" (Dutch) | routed away | points to `email-rewriter` or `tekst-herschrijven`; does not apply the English patterns |
| 16 | "write a LinkedIn post" | routed away | points to `linkedin-post-writer` and `linkedin-humanizer` |
| 17 | `/content humanize docs/` after the audit list is confirmed, a limit hits at file 4 of 9 | folder humanize, cut off | each finished file was `done` only after `facts` passed, with its summary as the note; the report names the files done and left; resume skips done files and checks a file left `doing` with `tracked` and `facts` before touching it |
| 18 | `/content voice`, a limit hits after the profile is written but before the question | voice, cut off | `voice-draft` is saved; a resume loads it and asks before saving; `voice.md` is never written without the question |
| 19 | `/content help` | help | prints the mode table and stops |

Also check: every link in `SKILL.md` resolves; `patterns.md` still holds the full taxonomy and the detection
guidance; `voice.md` is excluded from the Toolbox payload config and the build guard; the threshold figures in
`audit.md` still match what `check --dir` reports on the maintainer's documents; the helper's `--self-test`
passes.
