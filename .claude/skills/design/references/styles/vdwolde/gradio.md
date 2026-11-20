# vdWolde on Gradio (Fooocus)

Read [SPEC.md](SPEC.md) and [anywhere.md](anywhere.md) § Web first. Gradio renders its own DOM, so the recipe is a theme object plus CSS variables, never a rewrite of the components.

1. Theme: build `gr.themes.Base` (not a built-in colour theme) with `font=[gr.themes.Font('DM Sans'), 'system-ui', 'sans-serif']` and `font_mono=[gr.themes.Font('Cascadia Mono'), 'Consolas', 'monospace']`, never `gr.themes.GoogleFont`. Set the `*_dark` variants for Dark Mode and the plain ones for Light Mode so one theme serves both; map `body_background_fill` = ground, `block_background_fill` = surface, `border_color_primary` = edge, `body_text_color` = text, `button_primary_background_fill` = the signal UI fill with `button_primary_text_color` = `#0F1115`, `color_accent` = signal, `block_radius`/`button_large_radius` = 8 px/14 px.
2. Fonts: `@font-face` rules in the app css pointing at local files (`Branding/fonts/*/web/*.woff2`), served through Gradio's allowed static paths. No Google Fonts link in `review/index.html` either.
3. Mode: follow the system (`prefers-color-scheme`); do not force `?__theme=dark`. Test both.
4. Backlight: one `radial-gradient` stack on the `gradio-container` root (see `web/vdwolde.css` `.vdw-backlight`), never on blocks or the inpaint canvas.
5. Focus: `:focus-visible` 2 px signal ring on buttons, inputs, tabs and the canvas toolbar; do not rely on Gradio's default ring.
6. Buttons: sentence-case verbs; replace emoji with line icons (inline SVG); keep component ids and elem_ids stable because presets and other code reference them.
7. Inpaint layout rules the project documents stay as they are; the brand changes colour, type and edges, not the layout.
