# discover — read the project before designing anything

Read by every mode's first phase. Four jobs: find the stack, find or infer the fingerprint, know the
surface, and (create, overhaul) look up the product type.

## 1. Find the stack, then read only its CSV

| Evidence | Stack CSV (`references/ui-catalog/stacks/`) |
|---|---|
| `next` in package.json | `nextjs.csv` (+ `react.csv`) |
| `react` / Vite, no Next | `react.csv` |
| `components.json` present, or `@/components/ui` | add `shadcn.csv` (Tailwind v4 + Base UI here) |
| `vue` / `nuxt` / `@nuxt/ui` | `vue.csv` / `nuxtjs.csv` / `nuxt-ui.csv` |
| `svelte`, `astro`, `@angular/core`, `laravel/framework` | the same-named CSV |
| Tailwind with plain HTML | `html-tailwind.csv` |
| `three` / `@react-three/fiber` | add `threejs.csv` |
| `react-native` / `expo`, `pubspec.yaml`, SwiftUI, Compose | `react-native.csv`, `flutter.csv`, `swiftui.csv`, `jetpack-compose.csv` |
| `.csproj` with `UseWPF` | `wpf.csv` (authoritative over web advice) |
| Avalonia package, `Microsoft.WindowsAppSDK`, Uno, UWP, JavaFX | `avalonia.csv`, `winui.csv`, `uno.csv`, `uwp.csv`, `javafx.csv` |
| Electron / Tauri | the CSV of the renderer's web framework |

No CSV exists for WinForms, Blazor or a tray-only utility: say so in the Design Read, use
`ux-guidelines.csv` rows with Platform `All` (or `Web`), and treat the advice as lower confidence. A stack CSV
under about 20 KB is read whole; a larger one (`threejs`, `javafx`, `uno`, `winui`, `avalonia`, `uwp`, `wpf`,
`laravel`) is read with `design-tools.mjs catalog stacks/<name> --list`, then the categories the mode needs
(`--where Category=<name>`, `--where Severity=High`) instead of whole. Several
surfaces (a site and an app): read each one's stack.

## 2. The fingerprint: read it, or infer it with evidence

**The default house style is `vdwolde`.** In a project under the Development Base (or any new vdWolde project) load `references/styles/vdwolde/SPEC.md` (4.6 KB, whole) and the matching section of `anywhere.md` (`section references/styles/vdwolde/anywhere.md "<stack>"`) without waiting for a name, and write the Style line of `.claude/DESIGN.md` as `vdWolde Brand Guide v1.1 (house style, references/styles/vdwolde/)`. Treat it like a brand book (skip create Phase 3 and overhaul's three-directions step unless asked). It does not apply to client sites, vdwolde.com, vendored third-party templates or frozen work projects (AIRA, Sales Intelligence Dashboard); say so when you skip it. Another named house style below still wins when the user names it.

**House styles first.** A named house style (a folder under `references/styles/<id>/` with a `SPEC.md`) takes
precedence over catalog keyword matching. When the user's words contain a house style's name or alias
(case-insensitive, e.g. "in Liquid Glass", "Liquid Glass look", "glassmorphism 2.0", "gel glass"), load
`references/styles/<id>/SPEC.md` and, for the current stack, the matching section of `anywhere.md`. **Both can be
large (Liquid Glass: 95 KB and 72 KB): run `toc` on each and read the sections the Design Read needs with `section`
(identity and tokens first, then the surfaces and components the screen uses), not the files whole.** Write the
Style line of `.claude/DESIGN.md` as `<name> (house style, references/styles/<id>/)`; treat the spec like a brand
book: skip create Phase 3 direction-picking and skip overhaul's three-directions step unless the user asks for
alternatives; "apply <style> to this app" is an overhaul-class change to the Style line, ask once to confirm
scope if it would restyle an existing UI; for a web project on the user's baseline (Tailwind v4 + shadcn on Base
UI) in the Website Builder repo use the builder layer at `playbook/styles/liquid-glass/layer/` (README there),
elsewhere use `anywhere.md`'s section for the detected stack. A vague word ("glassy", "frosted") is not a name:
it follows the catalog path below. "Apple Liquid Glass", or a SwiftUI/UIKit/AppKit project, means the
`liquid-glass` catalog row (Apple's lens material), a different thing; the house style's row is
`liquid-glass-gel`. Aliases live in that row and in SPEC § 0.

If `.claude/DESIGN.md` has `## Design language`, use it. If not, infer each line from the code, cite one
`path:line` of evidence for each, tag the block `inferred`, and show it to the user before any edit:

| Line | Evidence to read | Map to |
|---|---|---|
| Style | radius, borders, shadows, blur, gradients, texture | a house style if the user named one or the code already carries it (above); else the closest `active` row of `styles.csv` (`catalog styles --q "<the keywords you saw>" --where Status=active`); name two if two fit |
| Type pairing | `font-family`, `--font-*`, `FontFamily` | a `typography.csv` row by Heading/Body Font (`catalog typography --q "<font names>"`), else `custom: X + Y` |
| Colour strategy | hues of the token set: `design-tools.mjs oklch <hex>` per colour | neutral + one hue = mono + accent; two = duotone; three or more = multi-hue; default background L < 0.3 = dark-first; high L, low C = soft |
| Layout archetype | the root shell component or window | see `directions.md` axis 4 |
| Motion tier | transitions only = Subtle; keyframes, stagger, scroll reveal = Standard; GSAP, springs, WebGL, shaders, parallax = Complex | `motion.csv` tiers |

The block to write (copy it; `Templates/docs/DESIGN.md` has the commented version). For a house style the Style
value is the house-style line from above, the first four rows are fixed by the spec, and `Status` is `applied`
once the build uses the style's layer:

```markdown
## Design language

Read: <what this is, for whom, with what vibe, leaning toward vdWolde (house style; or Liquid Glass when the user named it)>

| Part | Value |
| --- | --- |
| Style | vdWolde Brand Guide v1.1 (house style, references/styles/vdwolde/); Liquid Glass (house style, references/styles/liquid-glass/) when named |
| Type pairing | <from the spec, e.g. Urbanist + Inter + Doto> |
| Colour strategy | <e.g. neutral + one hue per tile> |
| Layout archetype | <e.g. top-nav one-page site> |
| Motion tier | <Subtle / Standard / Complex> |

Status: applied
```

A DESIGN.md that does not exist yet is created with just this block under a `# DESIGN` heading.

**Adopting an older DESIGN.md.** Three shapes exist on this machine: the template (Song Snitch),
`Read / Color / Typography / Components / Motion / Accessibility / Non-goals` (Computer Cleaner), and
`Principles / Tokens / Component kit / Patterns` (Finance Dashboard). Never restructure or delete one.
Add the `## Design language` block (the `Read:` line, the five lines, `Status`) above its first section,
leave the rest, and add a missing section (Motion, Voice, Changelog) only when the pass needs it.

## 3. Know the surface

| Surface | What applies |
|---|---|
| Web app (SaaS, dashboard) | Stack CSV, `ux-guidelines.csv`, `charts.csv` for data; every phase. |
| Marketing / landing site | `landing.csv`, `products.csv`; add an OG image and a performance budget. |
| Desktop window | `wpf.csv` / `winui.csv` / `avalonia.csv`; no web-only effects; sizes are default and minimum window. |
| Tray or menu utility | The design is icon states (idle, active, error), menu order and wording, notification text, and a credit item. Icon at 16 / 20 / 24 / 32 px, light and dark taskbar variants. Skip layout and responsive phases. |
| CLI / TUI | 16 ANSI colours, honour `NO_COLOR`, output hierarchy. Skip tokens and motion. |
| Claude Artifact / canvas | Load the `artifact-design` skill; its page contract wins. |
| Email | 600px tables, inline CSS, web-safe font stacks, dark-mode meta. Skip motion. |
| Slide deck | The Slides Artifact type, via `Artifact` quickstart. |

## 4. Product-type lookup (create and overhaul only)

**Under a house style (the default here) read only the `ui-reasoning.csv` row's Key_Effects and
`Anti_Patterns`**: the spec already decides style, palette and type, and the rest of this lookup only feeds the
direction-picking that a house style skips. Otherwise: match the product to the nearest `products.csv` row
(`catalog products --q "<product words>" --limit 3`; Product Type + Keywords). Read its Primary Style
Recommendation, Secondary Styles, Landing Page Pattern, Dashboard Style, Color Palette Focus and Key
Considerations. Then read the matching `ui-reasoning.csv` row (`catalog ui-reasoning --where UI_Category=<name>`):
Style_Priority, Typography_Mood, Key_Effects and **Anti_Patterns**. Only 31 of its 192 rows carry a `Reasoning` or
`Confidence` value, so this is a **seed, not truth**: it proposes a starting point and names the traps for
that product type, and the Design Read can overrule it. If no row fits (a tray utility), name the nearest
one (Productivity Tool) and say the confidence is lower.
