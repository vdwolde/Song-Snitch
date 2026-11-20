# vdWolde anywhere: per-stack recipes

Read [SPEC.md](SPEC.md) first. Values come from `Branding/brand.json` (or `snapshot/` when that is not reachable).
Verify every recipe by building and screenshotting both modes; nothing here is verified by being written down.

## Web, vanilla CSS or Vite

1. Copy `Branding/fonts/sora/` and `Branding/fonts/dm-sans/` (the css, `web/*-latin-*.woff2`, `OFL.txt`) into the project; link both css files.
2. Copy `Branding/tokens/tokens.css` and `web/vdwolde.css` (this folder); load tokens before vdwolde.css.
3. `<html data-signal="<colour>">`; `<body class="vdw-backlight vdw-glow-middle">` (the one backlight). Optional `data-mode` when the app has its own switch.
4. Build components from `var(--surface)`, `var(--text)`, `var(--edge)`, `var(--signal)`, `var(--signal-text)`; radii `var(--radius-*)`; motion `var(--duration-*)` and `var(--ease-enter)`.
5. Focus ring, reduced motion and tabular figures are in vdwolde.css; do not remove `:focus-visible`.
6. Favicon: `Branding/icons/<slug>/<slug>.ico` and the SVG; apple-touch and PWA icons from `Scripts/BrandAssets.mjs` (`.state/branding/<slug>/`).

## Tailwind v4 + shadcn on Base UI

Keep the shadcn preset's token structure and map the semantic tokens onto the guide (`Templates/archetypes/nextjs-web/src/app/globals.css`, block "vdWolde Brand Guide v1.1"): `--background` = ground, `--card` = surface, `--primary` = the signal UI fill with ground-coloured text on it, `--ring` = signal, `--border` = edge, `--input` = control edge. Fonts through `next/font/local` (Next) or the css imports (Vite). Never `shadcn init` over an existing stylesheet (web-ui-baseline skill).

## WPF

1. Copy `wpf/VdWolde.Dark.xaml`, `VdWolde.Light.xaml`, `BrandParts.xaml` and `wpf/signals/Signal.<Colour>.<Mode>.xaml` into `Themes/`; static TTFs from `Branding/fonts/*/static/` into `Assets/Fonts/` as `Resource`.
2. Merge in `App.xaml` in this order: neutrals, signal, parts. At startup swap the first two to the Light files when `AppsUseLightTheme` is 1 (`Templates/archetypes/dotnet-wpf/.../App.xaml.cs`). ThinkTwice already switches live: use its mechanism.
3. Use `{DynamicResource VdW.*}`; backlight: `VdW.Backlight<Low|Middle|High>` on the root surface plus a 3 px `Border` with `VdW.EdgeLight<...>` at the bottom edge.
4. Text styles `VdW.Text.*`; focus `VdW.FocusVisual`; fonts "Sora" and "DM Sans" resolve through the pack URI in BrandParts (probe-verified with static files; compiled XAML only).
5. Icon: `<ApplicationIcon>` and window `Icon` from `Branding/icons/<slug>/<slug>.ico`; `launcher.ico` at the repo root.

## WinForms tray

Menu renderer: subclass `ToolStripProfessionalRenderer` with a `ProfessionalColorTable` from the neutral tokens of the current mode; icons from `Branding/icons/states/` rendered to ICO (`Scripts/BrandAssets.mjs`). Selection by `AppsUseLightTheme`.

## Gradio

See [gradio.md](gradio.md).

## Android TV

Static TTFs as lowercase `res/font/*.ttf`, tokens as `values/colors.xml` (neutral dark/light, signal), a home theme with a 2 px signal focus ring (D-pad focus must be visible), launcher mipmaps and a 320 x 180 banner from `Scripts/BrandAssets.mjs`. Text 14 sp or more (TV: 16 sp and up where the app already does).

## Docs and GitHub

README header/divider/footer from `.github/brand/` (`Scripts/SyncBranding.ps1`); layout reference `Branding/github/readme/full-readme-computer-cleaner-*.png`. Social preview `Branding/github/social-preview/<slug>.png` is uploaded in the repo settings (GitHub has no API for it).
