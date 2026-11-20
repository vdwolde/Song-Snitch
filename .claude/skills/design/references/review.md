# review — a fresh eye on the result

Read by `create` (Phase 11) and `polish` (Phase 4, whole-app scope). A pass that builds and checks its own work
shares its own blind spots: it knows what it meant, so it stops seeing what is there. This step hands the
screenshots to a reader who has never seen the brief's reasoning and asks what is wrong with the picture.

**It runs only inside a `/design` pass the user asked for** (root `CLAUDE.md` § Briefing an agent: this is a
read-only subagent of the pass, not `/code`, `/code-review` or `/security-review`, which stay user-triggered).

| Mode and scope | Review |
|---|---|
| `create`, key screen | On: the first screen, before the rest are built |
| `polish`, whole app | On: the two or three screens that matter most |
| `polish` on a diff, `improve`, `overhaul`, `audit` | Off, and say so in one line; on when the user asks ("unslop", "looks AI-generated" counts as asking) |

Cost: one subagent, a handful of images. Do not repeat it after every fix; run it once after the fixes from the
geometry audit, and again only if the first review found a structural problem.

## Prepare

1. Screenshots of the screens in scope with chrome-devtools `take_screenshot` and a `filePath` into the
   project's own gitignored `.state/` folder (never `%TEMP%`; root `CLAUDE.md` § Windows dev-machine hygiene): desktop (1280 or
   1440) and `390x844x3,mobile,touch`, both colour modes when the app has them. Desktop apps: the screenshots
   the user supplied.
2. A reference, if there is one: the "before" shots (improve and polish), `Branding/screens/<slug>-dark.png`
   and `-light.png` (a vdWolde project), or the user's reference screenshot. Same scale as the new ones.
3. The Design Read line and, if it exists, `.claude/DESIGN.md`. **Nothing else**: not your plan, not why you did
   it, not the audit report.
4. The sign list as vocabulary, not as findings: [unslop/signs.md](unslop/signs.md), and in a vdWolde project
   [unslop/conflicts.md](unslop/conflicts.md) so the brand's own backlight, mark and signal are not sent back.

## The brief

Send one `Agent` call (`general-purpose`, the parent's model, never a cheaper one: this is judgment work). The
brief carries: the objective (find what is wrong with these screens), the pointers (image paths, the Design Read
line, DESIGN.md), the scope lock (read only; change nothing), the output contract, and these rules.

> You are reviewing screens someone else built. You have the screenshots and the one-line read of what this is
> and for whom. Look at them the way the most exacting designer you know would: the one who screenshots the
> single wrong thing and sends it back with "what is this?".
>
> Your first question, before any checklist: does this composition answer this product and this audience, or
> could it be any product in its category? A layout the brief did not shape is a finding even when nothing
> else is wrong.
>
> Then walk the sign list (signs.md): every sign you can see in a picture is a finding, named by its ID (`C2 gradient
> text`). conflicts.md lists what the brand does on purpose; those are not findings.
>
> Then: put each screen beside its reference (if any) and name the one difference. Squint: what does the eye
> land on first, and is it the thing the screen is for?
>
> Return a ranked list, **structure and hierarchy first, then density and spacing, then motion if you can see
> it, then polish**. One line each: `<image> — <what you would screenshot> — <the fix>`. Rank by how much of the
> screen it spoils, not by how easy it is to fix.
>
> Rules: the bar for a finding is a picture; quote the file. A predicted failure is not a finding, and neither is
> a predicted pass. Do not fix anything and do not soften a finding because the work is nearly there. Platform
> conventions are not placeholders (a Windows title bar, a system control, a browser's own widgets): never send
> back a convention, only an invented accent or a redrawn control. Say what you could not check. If there is
> nothing, say `nothing` and list the images you looked at. No preamble, no recap.

## Use the answer

- Treat each line as a candidate, like the audit's. Look at the image it points at before you act.
- Sign findings (an ID from signs.md) are fixed in the pass order of [unslop/passes.md](unslop/passes.md) and
  [craft-checks.md](craft-checks.md) § 7, never one by one in the order they came back.
- Fix the largest first. A structural finding (the eye lands on the wrong thing, the screen could be any
  product) outranks any spacing fix and may change the plan, not only the CSS.
- A line you think is intentional is not settled: look at the picture again. If it still looks right, say so
  in the report with the image; do not clear it by hiding the thing.
- Record what the review could not see (motion, real data, a state that was not screenshotted) in the report's
  `Not checked:` line ([verify.md](verify.md) § 6).
- A review that returns `nothing` after you looked at the same screens yourself ten times is the signal to
  stop, not to look an eleventh.

Adapted from the review protocol of `benjitaylor/skills` › `stageshow` (MIT, © 2026 Benji Taylor).
