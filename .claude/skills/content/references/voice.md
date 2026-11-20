# voice — learn how you write, once

Builds or updates a private profile at `~/.claude/skills/content/voice.md`. `humanize`, `audit` and
`tighten` read it when it exists (the section for the register at hand), so the rewrite sounds like the writer
instead of like the defaults.

## Process

1. **Get samples.** One to three pieces of the user's own writing (pasted or files), about 500 words or more
   in total, **per register** they want matched (casual, docs, formal). Ask for more if it is thinner. If
   `voice.md` exists, read it: this is an update.
2. **Check the samples first.** Run `content-lint.mjs check` on each. If a sample scores **heavy** on the
   other tells, or shows many chatbot artifacts, tell the user: a profile built from text that reads as
   AI-written would teach the skill to write like AI. Ask for another sample, or one the user wrote or
   edited by hand.
3. **Measure what can be counted.** From `check`: the mean and spread of sentence length, and the em and en
   dash count, from which the rate per 100 words is `dashes ÷ words × 100`.
4. **Read for the rest:** how paragraphs open and close, formality, contractions, first person, humour, how
   often they hedge, use of parentheses, semicolons, exclamation marks, lists and bold, the words they reach
   for and the words they never use, and quirks repeated on purpose (which a rewrite must not regularise).
5. **Learn from their edits (optional, the best signal).** If the user can paste an AI draft and the version
   they edited, compare the two: what they cut, what they replaced, what they added. Those changes are habits
   no sample shows. Add them under "Reaches for" and "Never uses".
6. **Write the profile** in the shape below, one section per register. `save voice-draft` it (SKILL.md §
   Checkpoints) so the reading in steps 2 to 5 is never repeated. Show it to the user and **ask before
   saving**; ask again before replacing an existing one.
7. **Confirm it works:** `content-lint.mjs conform <one of the samples> <voice.md>` must say it conforms.

## The file

```markdown
# Voice profile
Updated: <date>. Derived from <n> samples. Rules only; no sample text is stored.

## Register: <name, e.g. docs>
Machine-readable (read by the helper):
- em_dash_per_100_words: <number>
- mean_sentence_words: <number>
- sentence_spread_words: <number>

How this writer sounds here:
- Openers: <how paragraphs and messages begin>
- Punctuation habits: <contractions, parentheses, semicolons, exclamation marks, lists>
- Reaches for: <words and constructions>
- Never uses: <words and constructions>
- Leave alone: <quirks repeated on purpose>
- Recurring phrases: <at most three short ones, only if clearly habitual>

## Register: <next one, e.g. casual>
...
```

Pick the section by the task: a README or doc is `docs`, a message or chat is `casual`, a proposal or letter is
`formal`. With one register on file, use it everywhere. `conform` reads the first machine-readable block it
finds, so put the register being checked first, or pass a file that holds only that section.

## Privacy

The profile holds derived rules and at most three short phrases, never the samples. It is personal: it lives
in `~/.claude/skills/content/`, is not part of any git repository, and is excluded from the Toolbox recovery
payload (the build refuses to include it). It is therefore not backed up anywhere: if the folder is lost, run
this mode again. Do not copy it into a project, a README or a memory file.

## Using and showing it

To show it, print the file. To change it, run this mode again. To remove it, ask before deleting the file.
Other modes treat a sample the user pastes in the same request as outranking the saved profile.

## Next

Suggest `humanize` on a draft to see the profile applied.
