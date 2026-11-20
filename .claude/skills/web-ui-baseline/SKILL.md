---
name: web-ui-baseline
description: "Standing UI stack for every React web project on this machine: Tailwind CSS v4 + shadcn/ui on Base UI, the shadcn preset, tokens, dark mode, cn(), shadcn init gotchas. Use when: starting a React web project, running npx shadcn, adding shadcn components, theming, dark mode, Tailwind or Base UI question."
---

# Web UI baseline

Moved out of the root `Development Base/CLAUDE.md` on 2026-10-16 to keep that file lean; the root file keeps
the one-line rule (hard rule 13) and a stub.

Every React web project on this machine builds its UI on **Tailwind CSS v4 +
shadcn/ui on Base UI** — not Radix, not React Aria, and not a hand-rolled component layer per
project. This is a standing decision, not a per-project choice each new build re-argues; the
shadcn dependency set below is pre-justified under root CLAUDE.md § Minimal dependencies' "justifiable in one
sentence" rule by this section existing.

- **Base:** `base` (Base UI), matching the one headless library already in use on this machine
  (`Projects/Website Builder/tools/Website Cloner/`). Never Radix, never React Aria — `asChild`
  is a Radix-only prop; Base UI composes via a `render` prop instead (`shadcn.csv` rows 59/68).
- **Provisioning:** `npx shadcn@latest init --preset b7ClRmdZS` (or `add <component>` /
  `apply --preset b7ClRmdZS` on an existing project). `npx` is the provider — it runs inside the
  already-trusted `node.exe` process, which is why it doesn't trip the ASR never-before-seen-binary
  rule below. Not yarn/pnpm/bun: none of the three is installed on this machine (verified
  2026-09-22 — see root CLAUDE.md § Windows dev-machine hygiene).
- **Tokens:** shadcn's own flat `:root`/`.dark` oklch set, applied as-is. This replaced the
  `nextjs-web` archetype's three-tier `--raw-*` → semantic → `@theme inline` grammar, which is
  retired — a deliberate decision, not a partial migration; don't reintroduce the three-tier
  naming in a new token.
- **Dark mode:** shadcn's `@custom-variant dark (&:is(.dark *))` class variant, driven by a small
  hand-written no-flash inline script (`localStorage` ?? `prefers-color-scheme`) plus a toggle —
  never the `next-themes` package (zero installs of it anywhere on this machine; root CLAUDE.md § Minimal
  dependencies' preference for the smallest thing that works applies here too).
- **Animation exception:** `tw-animate-css` is permitted specifically for shadcn/Base UI
  primitive enter/exit states (`data-open:animate-in`, `data-closed:animate-out`, etc.) even in a
  project whose own hard rules otherwise ban animation libraries (e.g. `nextjs-web`'s hard rule
  #1, amended 2026-09-22 with this exact carve-out). All page and content motion in that archetype
  still goes through its own animation engine (`@react-spring/web` / `spring-text-engine`) —
  the exception covers only the overlay/primitive layer shadcn ships.
- **`cn()`:** the official first-party `cn` npm package (`shadcn-ui/cn`, MIT) — a compiled
  drop-in for `clsx` + `tailwind-merge`. Newer `shadcn` CLI versions install this instead of the
  older two-package pattern; don't add `clsx`/`tailwind-merge` back manually.
- **Preset identity:** `b7ClRmdZS` decodes to style `luma`, base color/theme/chart color `mist`
  (a neutral cool grey, oklch), icon library `lucide`, font `inter`, radius `default`. The preset supplies the token
  structure only: its colours and its font are replaced by the vdWolde Brand Guide v1.1 (graphite tokens, one
  signal colour, Sora + DM Sans, both modes; see the `nextjs-web` archetype's `globals.css` override block and
  `~/.claude/skills/design/references/styles/vdwolde/anywhere.md`). Never `shadcn init` over an existing
  stylesheet. The following is the preset's own palette, kept for reference and for a project that departs from
  the guide; `/design` still re-themes per project from its own
  192-palette catalog when a project needs a distinct visual identity — adopting the preset does
  not retire `/design`, it just changes what a fresh, undesigned project looks like before that
  pass runs.
- **A Vite (non-Next) project needs one setup step none of this machine's Vite scaffolds have by
  default:** a `@/*` path alias, in **both** the root `tsconfig.json` and the referenced
  `tsconfig.app.json`. The shadcn CLI's alias detection only reads the root file — if the alias
  exists only in `tsconfig.app.json` (the standard Vite project-references shape), the CLI still
  proceeds but silently writes generated files into a literal `@\` folder instead of `src/`
  (confirmed on Windows, 2026-09-22). Duplicate the `paths` entry at the root.
- **Never add `baseUrl` alongside `paths`** in a project on TypeScript 7+ — `baseUrl` is a hard
  parse error there (`TS5102: Option 'baseUrl' has been removed`). `paths` alone is sufficient
  with `moduleResolution: "bundler"`, and works identically on older TypeScript too.
- **Never run `shadcn init` directly against an existing, populated stylesheet.** Confirmed
  2026-09-22: the CLI merges into an existing `:root` block rather than replacing it, and can
  silently collide on a shared variable name (e.g. an app's own `--border`/`--accent` got
  overwritten in place while sibling variables referencing the old value were left inconsistent).
  Generate the clean token block in a scratch project first, then hand-merge it into a real
  project with existing styles.

## Platform features around the components

shadcn/Base UI owns the overlay and control primitives (dialog, popover, menu, select, tooltip, tabs): never
swap one for a native `<dialog>` or `popover`, and never hand-roll one. Everything around them is the web
platform's job, and the rules for it live in `~/.claude/agents/references/modern-web.md` (read it before writing
markup, CSS or client-side JS; not loaded up front): form constraints and `:user-invalid` instead of a
validation library for basic rules, `autocomplete`/`inputmode` on every field, LCP image priority, `@layer` and
`:has()` instead of JS class toggles, `color-scheme` kept in step with the `.dark` class, reduced motion, and the
browser-support rule (Baseline Widely available needs no fallback; anything newer ships with the fallback that
file names). The same file applies unchanged to a non-React web project, where its overlay recipes
(`<dialog>`, `popover`) are the primitive.

**Rejected:** keeping the `nextjs-web` archetype's three-tier token grammar and layering shadcn's
roles on top of it as Tier 2 (rejected — two token systems doing the same job is the opposite of
the simplicity ladder, and every `shadcn add` afterward would need manual re-mapping forever);
Radix as the base (rejected — this machine has zero direct Radix dependencies today; Base UI is
already what's here); `next-themes` for dark-mode state (rejected — a ~10-line inline script is
the smaller dependency footprint for a problem that small, per root CLAUDE.md § Minimal dependencies).
