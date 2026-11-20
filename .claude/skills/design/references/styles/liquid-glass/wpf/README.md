# Liquid Glass for WPF: drop-in recipe

Verified 2026-10 on .NET 8 WPF (`net8.0-windows`, x64): built from the `Templates/archetypes/dotnet-wpf` archetype in a scratch copy, 0 errors and 0 warnings under its analyzers, rendered to a PNG with `RenderTargetBitmap`. Evidence, gotchas and what WPF cannot do: [`../anywhere.md`](../anywhere.md) §3.7. Proof render: `playbook/styles/liquid-glass/proof/wpf/` in Website Builder. Tokens come from [`../tokens.json`](../tokens.json); if a token changes, change it there first, then here.

| File | What it is |
| --- | --- |
| `LiquidGlass.xaml` | `ResourceDictionary`: colour and brush tokens (light + the dark variant's one hue), five vivid gel colourways, radii, type styles, icons, focus visuals, and the templates `LgMatteCard`, `LgFrostPlate` / `LgFrostPlateText`, `LgGel` + `LgGelGreen/Pink/Blue/Orange/Violet`, `LgPillTab`, `LgGlassIconButton`, `LgGlowSlab`. |
| `SquircleBorder.cs` | `SquircleBorder` (squircle fill, gradient rim, child clip) and `SquircleGeometry`. |
| `GlassParts.cs` | `Glass` attached properties, `GrainOverlay` (generated noise tile), `DotMatrix` (5x7 dot numerals), `FrostBackdrop` (faux backdrop blur), `SpringEase`. |

No NuGet package is added. Nothing is loaded from a file at runtime (the grain tile is generated in code).

## Drop it into the `dotnet-wpf` archetype

1. Copy `SquircleBorder.cs` and `GlassParts.cs` to `<Project>/Controls/`. Copy `LiquidGlass.xaml` to `<Project>/Themes/`. The C# namespace is `LiquidGlass` (declared as `xmlns:lg="clr-namespace:LiquidGlass"` in the theme); rename both together if you want your own.
2. In `App.xaml` replace `<Application.Resources />` with:

   ```xml
   <Application.Resources>
       <ResourceDictionary>
           <ResourceDictionary.MergedDictionaries>
               <ResourceDictionary Source="Themes/LiquidGlass.xaml"/>
           </ResourceDictionary.MergedDictionaries>
       </ResourceDictionary>
   </Application.Resources>
   ```

3. In a window: `xmlns:lg="clr-namespace:LiquidGlass"`, then use the styles:

   ```xml
   <ContentControl Style="{StaticResource LgGelGreen}">…content in ink…</ContentControl>              <!-- gel tile -->
   <ContentControl Style="{StaticResource LgMatteCard}">…</ContentControl>                             <!-- matte card -->
   <ContentControl Style="{StaticResource LgFrostPlateText}" lg:Glass.Ground="{Binding ElementName=Ground}" lg:Glass.Radius="40">…</ContentControl>
   <RadioButton Style="{StaticResource LgPillTab}" GroupName="tabs" Content="Overview" IsChecked="True"/>
   <Button Style="{StaticResource LgGlassIconButton}"><Path Style="{StaticResource LgGlyph}" Data="{StaticResource LgIconSearch}"/></Button>
   <lg:DotMatrix Text="1195" Pitch="5.5" Foreground="{StaticResource LgInk}"/>                          <!-- plus the same value as text beside it -->
   ```

   A frost plate needs a **sibling** element named as its ground (a `Grid` with the blobs, a photo): it must not contain the plate. Put gel tiles, plates and the matte card on `LgGround`; use `LgGlowSlab` and the `LgDark*` brushes on `LgDarkGround`.
4. Build the `.sln` (output `bin\x64\Debug\net8.0-windows\`) or the `.csproj` alone (output `bin\Debug\net8.0-windows\`). Debug builds have no apphost: run `dotnet <App>.dll` (Defender ASR blocks fresh exes; never launch elevated).
5. Check text before shipping a new surface: ink on every gel stop and plate blob must hold 4.5:1 (SPEC §10). The demo's own progress card failed this once (2.79:1) and was darkened; see §3.7 "Contrast".

## Rules the recipe encodes

- One absolute radius per module: card 32, gel 43 (`LgRadiusCardPx`, `LgRadiusGelPx`); a stadium is half the height. Override per control with `lg:Glass.Radius`.
- One gel tone per board (vivid, ink text on a light ground). A dark board uses the `LgDark*` set and one hue (`LgGlow`).
- Fade gradients to the same colour at alpha 0, never `#00000000` (greys the bloom).
- Shadows go on a fill-only sibling, never on the element that clips content.
- `SpringEase` sets `EasingMode.EaseIn` itself; hover is a -2 px lift on the `settle` spring, press a 0.97 scale on the `press` spring.
- Focus: `LgFocusPill` / `LgFocusCircle` (2 px gap, 2 px ring, 2 px halo) show on keyboard focus only.
- Fonts: `Urbanist, Outfit, Inter, Segoe UI Variable Display, Segoe UI`. Urbanist is not installed by default and WPF cannot load woff2; ship a `.ttf` or accept Outfit.

## Proving it renders (no screen capture)

Add a `--render <path.png>` startup argument: show the window off-screen, wait about 1.5 s on a `DispatcherTimer`, draw the window's `AdornerDecorator` (give it its own ground, or the PNG is transparent) through a `DrawingVisual` + `VisualBrush` into a `RenderTargetBitmap` at 192 dpi, encode a `PngBitmapEncoder`, then `Shutdown()`. The focus ring only appears after keyboard input; a headless render has none, so the proof flips the internal `KeyboardNavigation.AlwaysShowFocusVisual` by reflection (proof only).
