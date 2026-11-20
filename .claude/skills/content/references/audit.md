# audit — does this read as AI?

Report only. **Nothing is rewritten and no file is edited.**

## One text

1. Read the text, the matching section of `voice.md` if it exists, and [patterns.md](patterns.md).
2. `content-lint.mjs check <file> --by-paragraph [--voice voice.md --register name | --dash-rate N] [--allow-words a,b]` for the countable tells
   and the worst paragraphs.
3. Read it yourself for the tells a script cannot count: inflated significance, unearned notability, vague
   attribution you could not source, elegant variation, false ranges, passive voice hiding the actor,
   manufactured drama, aphorism formulas, a send-off nobody earned.
4. Read it a second time for the **human signals to leave alone** (patterns.md, detection guidance): specific
   detail, a self-correction, real hedging, uneven rhythm, a quirk the writer repeats on purpose.

## A folder (or a before and after)

- **A folder:** `check --dir <folder>` ranks every markdown and text file of at least 80 words by its other
  hard tells, worst first, with the dash rate beside it. Report the worst five, then audit those one by one.
- **Two versions of one text:** `compare <before> <after>` prints the counts side by side.

## Report

A short table first, then the hotspots:

| Pattern | Count | Example (line) |
|---|---|---|
| (one row per pattern that appears) | n | "…" (line n) |

- **Two verdicts, kept apart.** **Dashes:** the rate per 100 words against what the writer allows (zero by
  default). **Other hard tells:** `clean`, `light` or `heavy`. They are separate because dashes are most of the
  signal in many real documents, and a text can be clean on one and not the other. Each kind of tell counts at
  most 5 times, so one habit repeated on purpose (a README full of emoji) does not decide the verdict.
- **Hotspots:** the paragraphs with the most tells, by line, and the one or two patterns driving each.
- **Leave alone:** the human signals you found.
- **Reading, not counting:** sentence-length spread, if the helper flagged it as even.

## What the thresholds rest on

Clean is under 0.8 other-tell hits per 100 words and heavy is from 2.0. On 2026-10-06 they were checked against
207 of the maintainer's own project documents (vendored copies excluded; none labelled as AI or human): the
median was 0.00, the 90th percentile 0.20, the 99th 0.49 and the maximum 0.90, so the thresholds sit above all
of them, and one deliberately AI-styled sample of about 70 words scored 13. That is a sanity check, not a
validation: there is no labelled set. Say that the verdict is a heuristic every time.

Quote lines you actually read. Never invent a tell to fill a row, and never call clean text AI because it is
formal.

## Next

For a `light` or `heavy` verdict, suggest `humanize` (and `tighten` if length is part of the problem). Suggest
only.
