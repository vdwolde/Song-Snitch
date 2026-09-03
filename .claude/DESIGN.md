# DESIGN

Visual identity, UX patterns, and client-side interaction rules. Read this before changing
templates, styling, or front-end behavior. Front-end *code* conventions live in
[STACK.md](STACK.md).

Delete this file if the project has no UI.

## Brand

<!-- Where the tokens are defined (tailwind.config.js, a CSS custom-property block, a
     ResourceDictionary) and the rule that they are the only source of color/type.
     Never hardcode a hex value in a template. -->

### Colors

| Token | Hex | Used for |
| --- | --- | --- |
| … | … | … |

<!-- If the project follows an external brand book, name it and its version, and say what
     is off-limits ("no navy/blue accents"). That single line prevents a lot of drift. -->

### Typography

| Role | Typeface | Fallback |
| --- | --- | --- |
| … | … | … |

### Assets

<!-- Logo, favicon set, social/OG image, and where they live. -->

## Component philosophy

<!-- Two or three sentences: hand-rolled vs. library, how much state a component owns,
     when to extract one. -->

## Layout & spacing

<!-- The grid, the spacing scale, the breakpoints, and where they're defined. -->

## Interaction rules

<!-- Loading states, empty states, error states, focus behavior, motion. Name the rule
     for each state that an agent would otherwise invent:
     - No alert/confirm/prompt — use the toast helper.
     - Every async handler wrapped so a failure surfaces instead of dying silently.
     - Skeletons only for explicit user-initiated loads, never for background refreshes. -->

## Accessibility

<!-- Contrast floor, focus-visible, keyboard paths, reduced-motion handling. State the
     minimum you actually hold the code to. -->

## Do's and don'ts

| Do | Don't |
| --- | --- |
| … | … |
