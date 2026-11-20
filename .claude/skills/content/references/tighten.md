# tighten — shorter, with every fact kept

One pass. Wordiness is not an AI tell, so this mode is about length: it does not hunt for AI patterns unless
they are also padding.

## Process

1. **Read the source**, and the matching section of `voice.md` if it exists. Find the target:
   - a **percentage or a size** from the user ("half", "under 150 words");
   - a **limit** the text must fit. Common ones: a commit subject, 50 characters (72 at the most); a tweet, 280;
     a meta description, 155; alt text, 125. Any `--max-words` or `--max-chars` the user names;
   - nothing: cut as far as the facts allow and stop.
2. **Baseline.** `content-lint.mjs words <source>` gives words and characters.
3. **Cut in this order, stopping when the target is met:**
   1. *Delete.* Throat-clearing and signposting ("it is worth noting", "let's dive in"), a restated point,
      hedges that carry no information, a closing summary of what was just said, filler (read only the "Filler and
      hedging" section of [patterns.md](patterns.md), lines 106 to 145, not the whole file).
   2. *Compress.* A phrase to a word ("in order to" to "to"), a clause to a phrase, two sentences to one,
      passive to active where the actor is known.
   3. *Restructure,* last, and only if it removes more than it risks. **Keep the structure by default:** a
      markdown list stays a list, headings stay, the order of the points stays. Merge or reorder only when the
      user asked or when it is the only way to meet a hard limit.
4. **Verify.** `facts <source> <rewrite>`: nothing `DROPPED`, nothing `NEW`, `PROTECTED` unchanged.
   `words <rewrite> --max-words N --max-chars N` against the target or limit: it must say `ok`. If keeping every
   fact needs more than the target or limit, say so and give the shortest length that keeps them, instead of
   dropping a fact.
5. **Report** the before and after counts (raw numbers from the helper, words and characters; do not describe
   them as a saving of anything else) and what kind of thing was cut.

## Rules

Keep the register and the writer's voice; do not "improve" tone while trimming. Never cut a number, date,
name, link, code block or caveat that changes what the text claims. A hedge that is the point ("probably")
stays. For a commit subject keep the imperative mood and leave the body for another pass; never invent what a
commit did.

## Next

If the result still reads as AI, suggest `humanize`.
