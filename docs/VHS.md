# VHS: if a game is shot on tape

**Status:** a direction, not built (DECISIONS 2026-10-23). The Play HUD is already shaped for it (§3 and §4 are in
the desk); the filter, the camera's own display and the reframes (§2, §5 to §7) are for when a game takes this on.
Read this before you add any of it.

## 1. The trope

The player is the one holding the camera: a friend filming, someone on a shoot, a person who documents everything.
Every frame is the camcorder's frame, so the look has a reason, and the footage exists in the story's world.

- **Always the camera's POV.** Nothing changes for the camera rules (DIRECTING §1: one lens, `game.fov`, no zooms).
- **Not as harsh as the research's worst case.** The target sits between "warped and soft" and "noisy and tracking":
  readable faces, tape colour, light grain. Harsher only in pulses (§5, strength).
- **Horror and romance both.** For a romance the same camera is a warm home video: softer noise, warmer colour, the
  date stamp nostalgic rather than threatening. Themes change colours only (`glass-rose`), the tape changes its numbers.

## 2. Two layers

| Layer | Drawn | What's on it | Readability |
|---|---|---|---|
| **The camera's display (OSD)** | *under* the filter: it warps, bleeds and gets grain with the image | REC dot, timecode, date stamp, battery, tape counter, the viewfinder's corner marks; "▮▮ PAUSE" | doesn't need to be read quickly; it's set dressing |
| **The player's layer (HUD)** | *over* the filter | the reticle, floating prompts, subtitles and choices, the corners, cards, menus | must always read (§8) |

What moves from the HUD into the camera:

- **The timer** becomes the tape counter or the REC time running down (OSD, top-right).
- **Pause** becomes *the tape pausing*: the frame freezes with paused-tape jitter (a tracking band, a slight vertical
  wobble), "▮▮ PAUSE" in the OSD's corner, then the menu (play/menu.js) over it. Replaces the lights-out flicker
  (`.ph-dark`'s `ph-lights-out` keyframes) for tape games only.
- **Save slots** become tapes: each slot a cassette with a hand-written label (where, the date).
- **Hidden** (the vignette when in a locker) becomes the viewfinder going dark round the slats.

The rest stays the HUD's: prompts, subtitles, choices, the objective, the log, cards.

## 3. The HUD over footage (done in `glass`; more in a `camcorder` theme)

Clean glass over warped noise looks pasted on. The fix is the reason: the HUD is what the lens is focused on (§4),
and it borrows a little of the tape so it sits in the same picture.

Done (play/ui/themes/glass.css):
- **No pure white:** warm whites (`--ph-text`, `--ph-lit`, `--ph-cursor` are `255,250,240`). Pure white is the loudest
  "not from the tape".
- **No blur in the footer scrim** (`--ph-scrim-blur: none`): blur over tape noise smears; a dark gradient only.

For a `camcorder` theme (`@import url("glass.css")`, variables only, like `glass-rose`):
- **A faint colour fringe on HUD text** when the tape is on: about 0.6 px of red one way and blue the other at 35 %,
  far weaker than the footage's (add `--ph-fringe` to hud.css's text-shadow stack, empty by default).
- **Faint scanlines inside glass panels:** a 2 px repeating gradient at about 3 % over `--ph-glass`.
- **A slight glow on lit text** (`--ph-opt-glow`, the lit option and the floating prompt's verb).
- **Corners further in:** the barrel warp bends the frame's corners, so `--ph-margin` at least 4 % of the width
  (about 56 px at 1400) keeps the objective, timer and log in the clean part.
- **Pause:** swap the lights-out for the tape pause (§2).

## 4. Focus: why the UI is sharp (done in the desk)

A camera holds one distance sharp; the HUD is clean because it's what the lens is on. The desk does it with a
blurred layer over the 3D view (`.ph-focus` in play/ui/hud.css, driven by `Hud.setCursor` and `runtime.anchorAt`):

- **A held look pulls focus onto the thing.** After `FOCUS_MS` (350 ms: a glance doesn't, a held look does) the world
  softens (`--ph-focus-blur`, 2.5 px in glass) except a round patch at the thing's point (`--ph-focus-hole`, 120 px),
  so the camera is on the door handle and "E Open" sits on that plane. In 0.25 s, out 0.45 s (`data-focus="thing"`).
- **The prompt sharpens as the reticle nears its point** (`--ph-clear`, from the screen distance: 1 within 40 px,
  softer and dimmer out to 300 px; never below 60 % opacity or past 1 px of blur).
- **Answering someone:** the choice floats beside them and the focus holds on their face (a bigger sharp patch,
  `--ph-focus-hole-person`); a choice about a thing holds on the thing; about neither, the middle stays sharp.
- **A card (a note, a code lock):** everything behind softens.

In Unreal (the player's camera a `UCineCameraComponent`):
- **Autofocus like a camcorder:** `FocusSettings.FocusMethod = Manual`, the focus distance set each frame from the
  centre trace's hit distance, `bSmoothFocusChanges` on (`FocusSmoothingInterpSpeed` about 6 to 8).
- **The pull to the thing:** after the held look, focus at the distance to the anchor point (`handleOf` /
  `middleOf`'s point, the same as the desk), or `FocusMethod = Tracking` with the target as `ActorToTrack` and the
  handle as `RelativeOffset`. Aperture to taste, f/2.8 to f/4 at the game's lens; depth of field `Cinematic`.
- **Answering:** depth of field focuses on the speaker; the edges' softness comes from the tape material's radial
  softness (§5, raised while a choice is up), since depth of field can't blur by screen region.
- **A card:** focus very near (about 0.3 m): the room goes soft as if the camera is close on the note.
- **A scare:** the autofocus *hunts* (racks out and back over about 0.5 s). A cheap, very camera-ish fright.

## 5. The filter (one post-process material)

One material, blendable `After Tonemapping`, every number in a Material Parameter Collection `MPC_Tape`, so the
runner, a cue and the settings menu all drive the same values. Effects in this order:

1. **Barrel distortion** (k about 0.06 to 0.10); everything after samples with the warped UV; the OSD (§6) is
   composited *before* this so it warps too.
2. **Chroma bleed:** to YIQ; blur I and Q horizontally, wider than Y; shift chroma right 1.5 to 3 px at 1080p.
3. **Luma:** slight horizontal soften, then a small sharpen halo (tape ringing).
4. **Colour:** lift the blacks 0.03 to 0.05, roll off the highlights, desaturate 10 to 20 %, a faint warm/green cast.
5. **Noise:** animated luma grain plus finer chroma noise.
6. **Tracking:** an occasional band of horizontal offset and noise rolling up the frame; head-switching noise in the
   bottom 2 to 3 % of lines.
7. **Scanlines / interlace**, faint.
8. **Vignette.**
9. **Radial falloff over all of it:** fringing, softness and noise grow with the distance from the centre, so the
   middle (the reticle, the prompts, a face in conversation) is the cleanest part, as a real lens is.

**Strength is one number,** `Tape` 0 to 1, scaling every effect by its own weight: calm about 0.45 (between the
research's two lower frames), a scare pulses to about 0.8 for 0.3 to 1 s and eases back; romance lowers the noise and
warms the colour. If a story drives it (a cue like `{"tape": 0.8, "secs": 0.6}`), that's a new word: grow
STORY_FORMAT, story_check and the runner in one commit (CLAUDE.md rule). The HUD gets a small share of a pulse (a 2 px
jitter on the floating prompt), never enough to hurt reading.

The settings menu's Film grain row (play/menu.js, `grain`) becomes the player's cap on noise; brightness stays its own.

**In the Godot export** (2026-10-29): `addons/horrorstudio/vhs.gdshader` is this filter, the plugin's three passes in
one canvas shader under the HUD (so the HUD stays sharp, §4), with the plugin's presets and night mode; `game.vhs`
names the preset (STORY_FORMAT §9.1); GODOTLOOK measures it against the plugin's own reference.

## 6. The camera's display in Unreal

Cheapest and crispest: **draw the OSD inside the tape material** from a pixel-font atlas (our own 5×7 font, §7):
REC dot, digits for the timecode and counter, the date, battery glyphs, corner marks, positioned in UV, composited
before step 1 so it warps and bleeds with the picture. Values come in through `MPC_Tape` (seconds, date, battery).

The alternative (a UMG widget rendered to a render target with `FWidgetRenderer`, sampled in the material) is more
flexible and more cost; use it only if the OSD needs real layout.

The player's layer (UMG, or the same HTML/CSS through a web widget) is drawn after post-processing by Unreal anyway,
so it sits over the tape with no extra work.

## 7. Fonts

Assets are CC0 or ours. Most well-known VCR fonts are not CC0, and OFL fonts aren't either: ask before shipping one.
**Draw our own 5×7 pixel font** for the OSD (an atlas PNG and its metrics JSON in `Content/Studio/Fonts/`); the HUD's
serif and sans are fallbacks today and need the same decision before a release.

## 8. Checking it

- **Contrast:** every HUD text over the *filtered* frame at least 4.5:1, at strength 0.45 and at 0.8, measured on
  the shot review's contact sheets (not judged by eye).
- **Sizes:** subtitles at least 32 px at 1080p (the desk's 20 px at its smaller frame scales), the floating prompt's
  verb at least 24 px.
- **Corners:** nothing of the HUD inside the warp's bent corners (§3, the margin).
- **The centre stays clean:** the reticle and a centred prompt sharp at strength 0.8.

## 9. The desk's preview (build this first, so the HUD is judged against the tape)

No post-processing is vendored (tools/director/vendor has three.module only). Render the Watch's scene into a
`WebGLRenderTarget`, then a full-screen quad with a `ShaderMaterial` whose GLSL mirrors the Unreal material, step for
step, with uniforms named as `MPC_Tape`'s parameters. One file, `tools/director/tape.js`; a "tape" toggle and strength
on the Watch's bar. The HUD stays DOM above the canvas, so the layering is the same as Unreal's (OSD in the shader,
the player's layer over it).

## 10. Open questions for the user

- **Focus breathing** (a 1 % zoom while focus pulls, as real lenses do) sells the pull, but DIRECTING says no zooms.
  Allowed as a lens effect or not?
- **The OSD's contents:** a date stamp always, or only some games? Whose camera (a brand-less consumer camcorder, a
  phone, a news camera) per game?
- **Fonts:** draw our own, or allow an OFL font for the HUD?
