# Unslop, harvested

Turns vibecoded, AI-looking UI into a designed interface: an audit list of the signs, nine fix passes in a fixed
order, and the rule that the chrome stays quiet so one or two moments of content carry the colour. Read on demand,
never up front: by `/design` `create`, `improve` and `polish` ([../../SKILL.md](../../SKILL.md) § Step 3), by the
design reviewer ([../review.md](../review.md), [../craft-checks.md](../craft-checks.md) § 7) and by the `/code`
design lens (`~/.claude/agents/references/lenses/design.md` § UI slop). Pointed to from every UI archetype and from
root `CLAUDE.md` § Web UI baseline.

**The vdWolde Brand Guide wins over every rule here** (root `CLAUDE.md` § Brand). Read [conflicts.md](conflicts.md)
before applying any value in a vdWolde project.

| File | Holds | Read when |
|---|---|---|
| [signs.md](signs.md) | Every sign with an ID, a ripgrep pattern to find it, the fix and the brand note | Auditing or reviewing UI |
| [passes.md](passes.md) | Run order, direction, the nine passes (spacing, colour, icons, copy, type, layout, details, visuals, motion), "do not", checklist | Fixing |
| [conflicts.md](conflicts.md) | Each clash with the Brand Guide and why the brand wins | Before any fix in a vdWolde project |
| [tokens.md](tokens.md) | Unslop's default values | Only in a project with no brand and no tokens |
| [visuals.md](visuals.md) | Choosing, generating and placing a visual | Visuals pass |
| [effects.md](effects.md) | Glyph, halftone, dither, duotone treatments | A visual that needs one |
| [refs.md](refs.md), `refs/` | Three finished screens, two more described | Visuals pass; a reviewer needing a picture of the target |
| [rtl.md](rtl.md) | Right-to-left rules | A screen in Arabic, Persian, Urdu or Hebrew |
| [story.md](story.md) | The before-to-after video | Only when the user asks for one |

Tools: `design-tools.mjs snapshot` (save a live page as one HTML file plus a screenshot) and `design-tools.mjs
story` (render the video), both in [../../tools/](../../tools/design-tools.mjs).

## Source and credit

**unslop** by Damir Sokolovsky ([@heydamir](https://x.com/heydamir), <https://heydamir.design/unslop>), who started
the Unslopping series on X. Upstream: <https://github.com/heydamir/unslop>. Licence: **CC BY 4.0**
(<https://creativecommons.org/licenses/by/4.0/>), which allows copying and adapting, including commercially, with
credit, a link to the licence and an indication of changes. That indication is the list below. Harvested
2026-11-15 from the Claude Code plugin `unslop@heydamir`, cache hash **`620163eedb35`**.

## What changed

- **Split and re-homed.** The plugin's `SKILL.md` became [passes.md](passes.md) (process, direction, passes,
  checklist) and [story.md](story.md) (video). The skill's own frontmatter and trigger words went to `/design`'s
  description; there is no separate `/unslop` skill.
- **Brand overlay.** Every rule the vdWolde Brand Guide owns is marked and resolved in [conflicts.md](conflicts.md);
  [passes.md](passes.md) and [signs.md](signs.md) carry a pointer at each clash. Direction is reduced to Product,
  Moments and Signature in a vdWolde project. A vdWolde project is at most "light slop" (polish only what the audit found).
- **signs.md:** rewritten as tables; each sign got an ID (C1 … P4), a ripgrep "Find it" pattern or an audit check,
  and a brand note. Detection lives in the design reviewer through these patterns, not in a script.
- **tokens.md:** a header limits it to projects with no brand. Values unchanged.
- **visuals.md:** "Generate it" names this machine's tools and makes paid generation a stop. Otherwise unchanged.
- **effects.md, rtl.md:** unchanged apart from the footer.
- **refs.md:** three of five images copied; the other two described in words with an upstream link.
- **Scripts:** ported into `design-tools.mjs` (see the fold table). Paths and install commands changed to this
  machine's: Playwright and ffmpeg from the base's `.state/npm-global`; output into the project's `.state/unslop/`.
- **Dropped:** the Codex/Antigravity install notes, `agents/openai.yaml` (a Codex manifest), the "hire the
  unslopper" section, and the plugin's own tests (their cases moved into `design-tools.mjs --self-test`).

## Fold table

| Plugin file | Status | Where, or why not |
|---|---|---|
| `skills/unslop/SKILL.md` | Folded | [passes.md](passes.md), [story.md](story.md); trigger words in `../../SKILL.md` |
| `references/signs.md` | Folded | [signs.md](signs.md) |
| `references/tokens.md` | Folded | [tokens.md](tokens.md), brand overrides in [conflicts.md](conflicts.md) |
| `references/visuals.md` | Folded | [visuals.md](visuals.md) |
| `references/effects.md` | Folded | [effects.md](effects.md) |
| `references/refs.md` | Folded | [refs.md](refs.md) |
| `references/rtl.md` | Folded | [rtl.md](rtl.md) |
| `refs/unslop-dashboard-after.webp`, `refs/unslop-hero-after.webp`, `refs/story-dashboard-frames.webp` | Folded | `refs/` (486 KB together) |
| `refs/beacon-engraving.webp` (569 KB), `refs/meadow-3d.webp` (287 KB) | Not folded | 66% of the image weight, vendored into every project repo by the toolkit sync; their lesson is in [refs.md](refs.md) in words with the upstream link |
| `scripts/snapshot.mjs` | Folded | `design-tools.mjs snapshot` |
| `scripts/story.mjs` | Folded | `design-tools.mjs story` |
| `scripts/story-path.mjs` | Folded | `resolveStoryFile` in `design-tools.mjs`, covered by the self-test |
| `test/*.test.mjs` | Folded | Their cases in `design-tools.mjs --self-test` (the symlink case runs only where the OS allows symlinks) |
| `examples/dashboard.html`, `hero.html`, `store.html`, `assets/blob.webp` | Not folded | Deliberately sloppy practice screens; upstream keeps them. Not needed to run the passes |
| `agents/openai.yaml` | Not folded | Codex manifest; this machine uses Claude Code only |
| `README.md`, `CITATION.cff`, `LICENSE`, `.claude-plugin/*` | Not folded | Install and packaging; the credit and licence link are in this file |
