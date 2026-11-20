# humanize — remove the signs of AI writing, keep every fact

One pass. The rules in `SKILL.md` apply (facts kept, none invented, register matched, code and links
untouched, the writer's voice first).

## Process

1. **Read the source**, and the matching section of `voice.md` if it exists. Read [patterns.md](patterns.md).
   **Name the register** (README, email, essay, release note, commit message) and keep it.
2. **Baseline.** `content-lint.mjs check <source> --by-paragraph` (add `--voice <voice.md> --register <name>`
   for the dash rate, and `--allow-words` from `voice.md`'s "Reaches for" line; do not copy the rate by hand). It shows the countable tells and which paragraphs carry them; the judgement tells (inflated
   significance, vague attribution, elegant variation) you find by reading.
3. **Choose how much to rewrite.**
   - *Light* verdict: **edit only the hotspot paragraphs** and leave the rest byte for byte. Smaller edits
     mean less drift, less risk to facts, and more of the writer survives.
   - *Heavy* verdict: rewrite throughout.
   Compress the dull parts, linger where a person would, merge or split sentences freely. Trade a vague claim
   for a specific one only when the specific detail came from the source or the user; if a sentence needs a
   detail that does not exist, ask for it or leave the sentence general.
4. **Claim ledger** (for a text over about 150 words): list the source's claims in a short numbered list
   (one line each: who or what, and the number, date or name it carries). Tick each off against the rewrite.
   Anything unticked goes back in. This checks the facts the script cannot see, the ones stated in words.
5. **Verify, at most twice.** On the rewrite:
   - `check <rewrite> [--dash-rate N]`: **zero em and en dashes** unless `voice.md` or a sample gives a rate; no
     emoji; no chatbot artifacts; the other hard tells at or below the source's. `conform <rewrite>
     <voice.md>` if a voice profile exists.
   - `facts <source> <rewrite>`: every `DROPPED` fact goes back in; every `NEW` fact is removed unless the user
     supplied it; `PROTECTED` content must be unchanged.
   - **Length guard:** the rewrite stays within about 15% of the source's word count unless `tighten` was asked
     (`words`). A rewrite far shorter has probably dropped something; far longer has probably padded.
   After two loops, report whatever is left instead of looping again.
6. **Hand back** what `SKILL.md` says for the way the text arrived. In the change note give the **before and
   after numbers** from `compare` (other hard tells and dashes), and name anything the helper still flags and
   anything that still reads as AI.

## Personality (only where the content calls for a voice)

Removing the tells is half the job: sterile, opinion-free writing is its own tell. Apply this to essays,
opinion, blog posts and personal writing. For reference, technical or legal text, plain and neutral *is* the
correct human register, so do not manufacture a first-person opinion there. Where a voice fits: vary the
rhythm, let the writer be unsure or have mixed feelings, allow a dry aside in parentheses, do not resolve every
thought into a clean takeaway. None of this licenses a new factual claim.

## Do not over-correct

See the detection guidance at the end of [patterns.md](patterns.md): clean grammar and a formal register are
not tells, a single instance of one pattern is not a tell, and specific hard-to-fabricate detail is a human
signal to keep. Leave real unevenness and real hedging alone.

## Next

If the text is still long, suggest `tighten`. If the user keeps correcting the same habits, suggest `voice`.
