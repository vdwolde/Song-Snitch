# Patterns: the signs of AI writing

Read by `humanize` and `audit` (and `tighten`, for the filler section). Descriptions and examples are written fresh for this fork; the taxonomy traces to Wikipedia's "Signs of AI writing" guide and the `humanizer` plugin (see `../LICENSE`). The script `tools/content-lint.mjs check` counts the countable ones; the rest need judgement.

### Content patterns

**Inflated significance.** LLMs attach unearned weight to ordinary facts — "marks a pivotal
moment," "underscores its enduring legacy," "represents a broader shift." Cut the significance
claim and state the fact plainly: *"The tool shipped in March, part of a wider push to cut build
times across the team"* rather than *"The tool's March release marked a pivotal moment in the
team's evolving engineering culture."*

**Unearned notability.** Listing every outlet or follower count as proof something matters —
*"covered by three major publications and followed by 200,000 people"* — reads as padding. If one
citation has real context (what was actually said, and where), keep that one and drop the tally.

**Tacked-on "-ing" depth.** A present-participle clause bolted onto the end of a sentence to
manufacture insight — *"the redesign uses a blue palette, reflecting the brand's renewed focus on
calm and trust."* Cut the participle clause unless it states something the sentence didn't
already say: *"The redesign uses a blue palette."*

**Promotional adjectives.** "Boasts," "vibrant," "cutting-edge," "seamless," "game-changing,"
"nestled," "must-have." These read as ad copy, not description. *"The office is in a converted
warehouse downtown"* beats *"Nestled in a vibrant converted warehouse, the office boasts a
seamless blend of industrial charm and modern comfort."*

**Vague attribution.** "Industry observers note," "critics argue," "many believe" — an opinion
credited to nobody in particular. Name the actual source, or cut the claim. *"Analysts at Gartner
projected 12% growth"* beats *"Industry observers project strong growth."*

**Formulaic challenges/outlook sections.** A rote "Despite these challenges, X continues to
thrive" close, usually unearned. State the specific issue and stop: *"The rollout is still
limited by driver availability in three regions."*

### Language and grammar patterns

**Overused AI vocabulary.** Words that spike hard in AI output and tend to cluster together:
*delve, crucial, intricate, pivotal, tapestry, landscape (abstract), underscore (verb), foster,
garner, testament, robust, seamless.* One of these in isolation is nothing; four in a paragraph is
a tell. Replace with the plain word: *"complex" for "intricate," "important" for "crucial."*

**Copula avoidance.** Swapping "is/are" for an inflated verb — *"stands as," "serves as,"
"represents a."* *"The library is the team's shared component set"* beats *"The library serves as
a testament to the team's commitment to reusability."*

**Negative parallelism and tailing negation.** "Not only X, but Y" overused as a rhetorical
crutch, and clipped fragments tacked on at the end — *"no wasted effort," "no guessing involved."*
Write the real clause instead: *"so nobody has to guess which version is current"* rather than
*"…the latest version, no guessing."*

**Rule-of-three padding.** Forcing every list into exactly three items to sound thorough —
*"faster, cheaper, and more reliable."* If there are really two points, say two: *"The new build
pipeline is faster and cheaper to run."*

**Elegant variation.** Cycling synonyms to avoid repeating a word — "the company," then "the
firm," then "the organization" — reads as evasive rather than elegant. Repeat the plain noun; it's
clearer.

**False ranges.** "From X to Y" used where X and Y aren't actually points on a scale — *"covers
everything from onboarding to enterprise scale."* State the real scope: *"covers onboarding
through billing."*

**Passive voice hiding the actor.** *"The report was reviewed and changes were made"* hides who
did what. *"The editor reviewed the report and revised two sections"* is both clearer and shorter.

### Style patterns

**Em dashes — cut them.** Treat every em dash (—) and en dash (–), spaced or not, as something to
resolve into a period, comma, colon, or parentheses depending on what the sentence needs. This is
a hard constraint on the final draft, not a "use sparingly" note — unless a supplied writing
sample uses them at some rate, in which case match that rate instead.

**Overused boldface.** Bolding routine terms mid-sentence for no reason — *"the app uses **OAuth**
for **authentication** and stores tokens in a **secure vault**"* — reads as mechanical emphasis.
Reserve bold for something that actually needs to stand out.

**Inline-header bullet lists.** *"- **Speed:** The app is fast now."* — a bolded label restating
the point that follows. Either drop the label or fold the list into prose: *"The update makes the
app faster, cuts crash reports in half, and adds two-factor login."*

**Title case in headings.** *"## Quarterly Revenue And Growth Trends"* over-capitalizes. Sentence
case reads as human: *"## Quarterly revenue and growth trends."*

**Emoji decoration.** Sprinkling 🚀 or ✅ in front of headings or bullets. Drop them; let the words
carry the point.

**Curly quotes from a chat export.** Straight quotes (`"..."`) read as edited prose; curly quotes
(`"…"`) alone mean nothing (most editors auto-curl), but combined with other tells they're worth
normalizing to straight quotes.

### Communication patterns

**Chatbot correspondence artifacts.** Text meant as a reply, pasted into content as-is — *"Here's
an overview. Let me know if you'd like me to expand on any part!"* Cut the framing; keep only the
content: *"Overview: …"*

**Knowledge-cutoff hedging and invented filler.** Two related tells: stating a training cutoff
disclaimer in the output, and, when a fact isn't known, writing a paragraph *about* not knowing it
and then filling the gap with plausible-sounding guesses — *"while specific details remain
scarce, it's likely the company was founded sometime in the early 2000s."* Say what isn't known
and stop, or cut the sentence. Never dress a guess up as fact.

**Sycophantic tone.** *"Great question! You're absolutely right that this is worth exploring."*
Cut the praise, keep the substance: *"That's worth exploring because…"*

### Filler and hedging

**Filler phrases.** *"In order to" → "to." "Due to the fact that" → "because." "At this point in
time" → "now." "Has the ability to" → "can."*

**Excessive hedging.** *"It could potentially perhaps be argued that this might have some
effect"* → *"This may have an effect."*

**Generic upbeat closers.** *"The future looks bright, and exciting things are ahead."* Cut it, or
end on the last real fact instead of a send-off.

**Hyphenation on autopilot.** AI hyphenates compounds uniformly, including where a person
wouldn't — *"the report is high-quality"* in predicate position. Keep the hyphen when the compound
comes before the noun (*"a high-quality report"*), drop it after (*"the report is high quality"*).

**Persuasive-authority filler.** *"At its core, what really matters is…"*, *"the real question
is…"* — these announce depth instead of adding it. Cut the frame, keep the claim: *"What matters
is whether the team can hit the deadline."*

**Signposting.** *"Let's dive into how this works. Here's what you need to know."* Just say the
thing: *"The cache invalidates on every deploy."*

**Fragmented headers.** A heading followed by a one-line restatement before real content starts —
*"## Reliability \n\n Reliability matters. \n\n When the service goes down, customers notice."*
Drop the restatement.

**Diff-anchored writing.** Docs or comments narrated as a change ("this replaces the old loop
that was slow") rather than describing the current state. Unless the doc is genuinely
version-scoped (a changelog, a migration guide), describe what the thing does now.

**Manufactured staccato drama.** A run of short declarative fragments stacked for effect — *"No
delay. No queue. No excuses."* One short sentence for emphasis is fine; three in a row starts to
sound engineered.

**Aphorism formulas.** *"X is the Y of Z," "X is not a tool, it's a mirror."* Cut the formula,
keep the actual claim underneath it.

**Fake-candid openers.** *"Honestly? It depends."* — a theatrical pause before an ordinary answer.
Just give the answer: *"It depends on usage volume."*

## Detection guidance — don't over-correct

A clean human writer can hit several of the patterns above without any AI involved. Before
rewriting, check that a cut is actually warranted:

- **Clean grammar or a formal register alone isn't a tell.** Plenty of people write carefully.
- **A single instance of any one pattern is not a tell** — clusters are. One em dash, one
  "however," one curly quote means nothing on its own.
- **Specific, hard-to-fabricate detail is a strong human signal** — a real name, an odd aside, a
  self-correction mid-sentence. Don't smooth these away.
- **Uneven sentence length, genuine hedging, and mixed feelings are human, not sloppy.** AI prose
  tends toward even, resolved, mid-length sentences — leave real unevenness alone.
