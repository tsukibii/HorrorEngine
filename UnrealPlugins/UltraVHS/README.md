# Ultra VHS

A home camcorder recorded to VHS, as a post-process, plus the way a person holds that camcorder. C++ and shaders
only: no materials, no assets, nothing to set up in the editor. Drop it into any project (5.4 or newer, written for
5.8), add one component to the player, and the player's eye records to tape.

Rebuilt from the user's lost preset, working only from a 44 s capture of it (`Ultra_Realistic_VHS_Effect_In_UE5_test_preview`)
and measuring that video; see "The reference" below.

## What it does

The post-process runs right after the tonemapper (display colour, before FXAA and the UI), in three passes:

| Pass | Size | What |
|---|---|---|
| **Camera** | the tape (640×480) | the lens: barrel distortion zoomed to keep the corners filled, chromatic aberration, vignette; the sensor: less saturation, lifted warm blacks, whites that stop short of full; the view sampled down with a 4-tap box |
| **Tape** | 640×480 | luma low-passed with the deck's edge enhancement (the bright halo beside edges); colour bled wide, late and shared with the line above; line tracking slips and wobble; the rolling tracking-error band; the head-switching tear; luma snow, chroma smears, dropouts; a little of the last frame (persistence) |
| **Screen** | the view | the tape scaled back up (bilinear, soft like the TV), 4:3 pillarboxed, optional scanlines |

The **handheld camera** is a camera modifier on the player's camera manager: the hands' slow wander (Perlin noise,
two octaves) and breathing, a gait (a bob per step, a sway per two steps) scaled by how fast the player walks on the
ground, a bank into fast turns, and the view trailing the look a little (its weight). It also sets the camera's
motion blur (camcorders smear: the reference blurs heavily in turns).

Scene captures, reflection captures and planar reflections are left clean; only the player's eye records.

## Using it

Add the **Ultra VHS** component to the player's pawn or character (Add Component > Ultra VHS, or
`CreateDefaultSubobject<UUltraVHSComponent>(TEXT("UltraVHS"))`). Pick a preset; edit the settings and it becomes
Custom. That's all.

| Preset | |
|---|---|
| **Camcorder** | the reference: soft, haloed edges, bled colour, lifted blacks, barrel lens, 4:3. No tape damage. |
| **WornTape** | the same tape years later: snow, chroma smear and lag, jitter, the head-switching tear, a few dropouts |
| **Nightmare** | 360 lines, a rolling tracking error, dropouts, colour falling apart, faint scanlines |
| **Custom** | the settings as you left them |

From Blueprint or C++ on the component: `SetVHSEnabled`, `ApplyPreset`, `SetHandheldEnabled`, `Settings` and
`Handheld` (read and write), and **`TriggerGlitch(Strength, Duration)`**: a moment of tape damage that fades out (a
scare, a cut, a rewind, a cast member too close to the lens).

With more than one component in a world (a cutscene camera that records differently), the enabled one with the
highest `Priority` is on screen.

**Console:**

| | |
|---|---|
| `r.UltraVHS -1` | the components decide (default) |
| `r.UltraVHS 0` | off everywhere |
| `r.UltraVHS 1` / `2` / `3` | on with Camcorder / WornTape / Nightmare, with or without a component, **also in the editor's viewport** |
| `r.UltraVHS.Glitch 0..1` | damage on top, to try the glitch by hand |

## The knobs

Distances on the tape are in 480-line pixels, so they mean the same at any `TapeLines`.

| Group | Knob | Camcorder | |
|---|---|---|---|
| Frame | `bCrop4x3` | on | record 4:3 and pillarbox it |
| | `TapeLines` | 480 | 240 is one field: softer still |
| Lens | `Distortion` | 0.085 | barrel k in r' = r (1 + k r²), r in half-heights |
| | `ChromaticAberration` | 0 | the red/blue fringe at the corners, in tape pixels |
| | `Vignette` | 0.08 | 1 / (1 + v r²)²: the corners at about 75% of the centre |
| Camera | `BlackLevel` | 0.035, 0.027, 0.022 | what black records as (lifted, warm) |
| | `WhiteLevel` | 0.82, 0.81, 0.78 | what full white records as |
| | `Saturation` | 0.8 | |
| Tape | `LumaBlur` | 1.4 | softness along the line (Gaussian sigma) |
| | `Sharpen`, `SharpenRadius` | 1.0, 3 | the edge halo: 1.0 overshoots about 12% |
| | `ChromaBlur` | 2.0 | colour bleed along the line |
| | `ChromaShift` | 0 | colour arriving late, to the right |
| | `ChromaVerticalBlend` | 0.5 | colour shared with the line above |
| | `Ghosting` | 0.15 | how much of the last frame stays |
| Wear | `LumaNoise`, `ChromaNoise` | 0, 0 | snow; chroma smears |
| | `TrackingJitter` | 0 | lines slipping sideways, a wobble |
| | `TrackingError` | 0 | a band of torn lines rolling down |
| | `HeadSwitch` | 0 | the tear along the bottom lines |
| | `Dropouts` | 0 | short white streaks |
| Screen | `Scanlines` | 0 | dark gaps between the tape's lines |

**Handheld** (degrees, cm): `Intensity` 1; drift `DriftPitch` 0.45, `DriftYaw` 0.6, `DriftRoll` 0.35 at `DriftSpeed`
0.35 Hz, `WalkingDrift` ×1.6, `BreathPitch` 0.12; walk `WalkSpeed` 300 cm/s, `StepsPerSecond` 2, `BobHeight` 1.2,
`BobSway` 0.8, `BobPitch` 0.35, `BobYaw` 0.25, `BobRoll` 0.45; turn `TurnRoll` 0.012 per deg/s up to `MaxTurnRoll`
2.5; `RotationLag` 0.04 s. `RotationLag` moves the view, not the controller: a crosshair drawn at the screen's
centre still shows where traces from the camera go, but traces from the controller's rotation lead the view by
that lag.

## The reference

Measured from the capture with `Tools/measure.py` (seconds 9 to 39, the walk down the corridors), then the Camcorder
preset run through `Tools/preview.py` on a test chart and measured the same way:

| | reference | Camcorder (preview) | what it means |
|---|---|---|---|
| frame | 4:3 pillarboxed in 16:9 | 4:3 | `bCrop4x3` |
| barrel k | 0.085 (a wall edge fitted straight) | 0.085 (fitted back out of the output) | `Distortion` |
| edge rise (10-90%) | 5 px at 1080 | 5 px | `LumaBlur`, `TapeLines` |
| edge halo | 12% | 11% | `Sharpen` |
| colour edges vs luma edges | 2.4× as wide | 2.4× | `ChromaBlur` |
| white (99.5th percentile) | 0.78 | 0.75 (the chart's light is in the vignette) | `WhiteLevel` |
| black | 0.03, warm shadows | 0.05 | `BlackLevel` |
| RGB misregistration | none at the centre or the edges | none | `ChromaticAberration` 0, `ChromaShift` 0 |
| noise, scanlines, tracking damage | none | none | the Wear knobs are 0 in Camcorder |
| vignette | corners 0.85 of the centre (biased up: the corridor's dark end is in the centre) | 0.75 on a flat field | `Vignette` |
| camera wander | 0.25 to 0.75 Hz (strongest 0.5), and a sideways sway at 1 Hz while walking | drift 0.35 Hz in two octaves, 2 steps a second (a sway at 1 Hz) | the handheld settings |

So the reference is a *clean* camcorder: its realism is the optics, the softness and the halo, the colour bleed, the
levels and the hand-held motion, not tape damage. WornTape and Nightmare add the damage for games that want it.

## Offline tools

No Unreal needed (Python with numpy and Pillow; `uv run --with numpy --with pillow python ...`):

- `Tools/preview.py IN.png OUT.png [--preset camcorder|worn|nightmare] [--set Knob=value ...]`: the three passes in
  numpy, line for line with the shader (`--chart chart.png` writes a test chart).
- `Tools/measure.py CAPTURE.mp4 | frames...`: the numbers above, from a capture or stills, printed next to the
  reference's.

The shader compiles with DXC (DXIL and SPIR-V, HLSL 2018 and 2021) with a stub for `/Engine/Public/Platform.ush`.

## Status

Written without an editor to build in: the shader compiles, the preview runs and measures like the reference, the
C++ follows the 5.4 to 5.8 engine API but **hasn't been compiled against an engine yet**. The first build on the
user's machine is the test; `CLAUDE.md` here lists the engine API it touches and what to check.

Everything here is original (no third-party code); the noise hash is the well-known lowbias32 integer hash.
