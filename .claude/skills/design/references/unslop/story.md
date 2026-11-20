# Story video

A short video where the screen unslops itself step by step, with red redlines on the slop. Look at
[refs/story-dashboard-frames.webp](refs/story-dashboard-frames.webp) before building one: eight frames from it in
order. It adds a few minutes, so make it only when the user wants it. It is a presentation piece: the real fix
still ships as normal code in the project's own stack, without `.s` classes or story attributes.

How it works:

- **Nothing is swapped, everything morphs.** One page; each step only changes CSS, so padding, gaps, sizes, colours,
  radii and shadows tween in place.
- **A wave.** Elements start a few dozen milliseconds apart from the top left down.
- **Text rolls.** Changed copy blurs out; the new words rise in letter by letter.
- **Redlines first.** Slop gets red boxes with tags; a spacing step shows red measurements that turn white once fixed;
  a details step outlines corners with their radius.
- **Close and short.** Square, cropped close on the part that changes most, about 10 seconds.

## Build it

1. **One story file.** `.state/unslop/story/story.html` inside the project (gitignored): a standalone copy of the
   original screen with its styles in the file (`design-tools.mjs snapshot` makes one). The original rules are step 0.
2. **Steps.** Three to five, merging passes so each changes something visible (`Spacing`, `Color and icons`,
   `Type and copy`, `Details`). A new chart or visual goes in the last step. List them in the head:
   `<meta name="unslop-steps" content="Spacing, Color and icons, Type and copy, Details">`. A name containing
   Spacing shows spacing measurements; one containing Details shows corner outlines.
3. **Each step is CSS on top.** Step 1 under `.s1`, step 2 under `.s2` (`.s1 .card { padding: 24px }`). Classes add
   up. Change values, never structure, so the browser can tween them.
4. **What cannot tween:**
   - Gradients, glows, washes: own layer, fade its `opacity` to 0 while the solid colour underneath changes. Gradient
     text goes on the `.from` span only.
   - Pills: radius as half the height (`23px`), not `9999px`.
   - Swaps only where words change, at most eight. Weight, size, tracking and colour tween on their own. A new font
     family switches directly in its step.
   - Changed text, a new family, an emoji becoming an icon:
     `<span class="swap" data-at="3"><span class="from">Welcome back, Damir! 👋</span><span class="to">October 2026</span></span>`.
   - Emoji to icon: stack both absolutely in one box and crossfade `opacity` (not a swap).
   - Disappearing things (`New ✨`): `data-out="2"`. Appearing things: `data-in="4"`, with their space reserved.
5. **Redlines.** `data-gap` on the blocks of a vertical stack, four to six measured gaps per stack, named per stack
   (`data-gap="sidebar"`). `data-radius` on two to four elements whose corners change. `data-slop="Gradient text"`
   on at most five clear examples (optional).
6. **Only the screen and its background.** No extra window or shadow. The page renders 1440 wide and at least 900
   tall: no `100vh`, `position: fixed` for background layers only. A window that grows anchors left.
7. **Camera.** `<meta name="unslop-frame" content="0 0 960">`: x, y and width in page pixels, at the screen's own
   top-left corner, cropped close on where the most change happens.
8. **Render.** `node ~/.claude/skills/design/tools/design-tools.mjs story .state/unslop/story/story.html
   .state/unslop/story.mp4` (square; `--wide` for 16:9; `--play` instead of the output path to watch it loop).
   It needs Playwright and ffmpeg, both installed machine-wide in the base's `.state/npm-global` (the error message
   names the install command if not). Pull a few frames with ffmpeg and look at them before handing it over.
9. **Credit.** Every video carries the small `unslop by @heydamir` credit the licence asks for; the renderer adds it.

---

Adapted from unslop by Damir Sokolovsky ([@heydamir](https://x.com/heydamir)), CC BY 4.0. Changes: see [README.md](README.md).
