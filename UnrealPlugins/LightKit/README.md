# Light Kit

Drag-and-drop lighting tricks for realistic day and night without the cost of doing it the expensive way. Each piece
is a C++ actor or component that sets itself up; a script makes the few materials it needs from text. Works with
Lumen, with a Lightmass bake, or with neither. Pairs with UltraVHS (the camcorder) but doesn't need it.

## The references, measured

**Day (the user's own VHS test):** a hall in daylight. Every shadow is smooth and soft-edged, with no hard
lines anywhere: large soft sources (ceiling light panels and sky through openings), baked bounce filling the shadows
with warm wall colour, contact darkening in the corners. Realism there is *soft light and bounce*, not detail.

**Night (Chilla's Art, *The Closing Shift*):** frames' median brightness 0.01 to 0.02 (very dark), moonlit strips
on the ground at 0.6 to 0.7 in cyan-white (R 0.59, G 0.69, B 0.69), mid-tones a dark violet (0.10, 0.08, 0.12),
blacks crushed to 0, warm windows in the flats against it, and wet ground smearing the lights. The moonlight
strip on the path ("the beam on the ground") is just a cool key light through a gap, its shadow edge soft but
defined. Strong key-to-fill (about 30:1) is what makes it feel like night.

**What we keep and what we change:** keep the cool, soft key, the warm-against-cool practicals, the wet
reflections and the camcorder's softness (UltraVHS's Camcorder, not that video's blur). Change the blacks: the user
wants a deep, pretty night blue, never pitch black, so the kit's night settles shadows to about (0.01, 0.02, 0.05)
with a blue sky glow and fill (key-to-fill about 8:1), and the sky itself stays a visible navy.

## The pieces

| Drag in | What it does | Cost |
|---|---|---|
| **Light Kit Sky** | sun or moon, sky light, atmosphere, height fog, the camera's exposure and grade, set by **Day / Dusk / Night** (or Custom). `SetTime(Night, 30)` blends at runtime (Dynamic). Optional drifting cloud shadows, volumetric fog. Dynamic (Lumen or none) or Baked (Lightmass, stationary) | the usual sun and sky |
| **Light Kit Window** | in a window opening, arrow into the room: a **sky fill** (a soft rect light the size of the glass with the sky's luminance: the biggest single step to a real room), a **Lightmass portal** (clean baked sky light), a **fake bounce** where the sun's patch lands (warm floor light up the walls, without Lumen or a bake), a **light shaft** card from the window to the patch (faded where it touches things; no volumetric fog). All follow the sky's time | one rect light (+1 shadowless for the bounce), one translucent card |
| **Light Kit Pattern** | moving light with nothing moving: a spot light with a light function. **Caustics** (light off water on a ceiling or a wall), **Leaves** (sun or moon through swaying trees), **Blinds** (stripes), **Clouds** | one spot light, shadows off by default |
| **Light Kit Sweep** | a car passing at night: a pair of headlights drives past outside and throws the window frame's shadows across the ceiling, its highlight sliding over glossy things. Random every 12 to 40 s, or `TriggerPass()` on cue | two moving spot lights, only during a pass |
| **Light Kit Flicker** (component) | on any actor with lights: **Fluorescent** (steady, then a stutter now and then), **Dying**, **Candle**, **Pulse**, or a Quake-style letter string; `SetOn` stutters a tube on; can drive the bulb's emissive parameter | nothing (sets intensities) |
| **Light Kit Puddle** | a decal: one irregular puddle, deep and mirror-smooth in the middle, damp at the edge. Reflections are the level's own, so lights and cars smear across it as you walk | one decal |

## Tricks, by goal (what the pieces do, and what else to reach for)

**Realistic day, cheaply**
- *Soft sun:* the sky's `SunSourceAngle` is 1° (twice the real sun): smoother penumbras, in a bake and in Virtual
  Shadow Maps alike. Dusk is 1.5°.
- *The window is the light:* indoors, most daylight is the sky through the glass, not the sun. The window's sky
  fill gives every room that soft, directional, falling-off light. Size it to the glass; leave its shadows on.
- *Bounce:* baked (Lightmass, with the window's portal) or Lumen does it for real. With neither, the window's fake
  bounce lights the walls from the sun patch, tinted by the floor.
- *Area lights for fittings:* ceiling panels as rect lights the panel's size (soft shadows, soft specular), bulbs as
  point lights with a `SourceRadius` of 2 to 5 cm. Never a zero-size light.
- *Contact shadows:* the sky's sun has a short contact shadow (0.02): small things sit on the floor. Add the same
  to a room's main lamp (`ContactShadowLength`, nearly free).
- *Exposure like a camcorder:* auto exposure (histogram) inside a fixed range per time of day, adapting over about a
  second: walking from a dark hall to a sunny room flares and settles, as a real camcorder's iris does.

**A deep blue night (not black)**
- *A film moon:* 1.5 lux (six times the real full moon) in cool blue, soft-shadowed: enough to see by, and it makes
  those cyan strips on the ground.
- *The sky glows:* the atmosphere's luminance is boosted in blue, the sky light is tinted blue and raised, the
  windows' fill is a dim blue: shadows fall to blue, not to zero.
- *Shadows lifted to blue* in the grade (`ShadowLift`), saturation down a little (eyes lose colour at night), and
  exposure biased a stop under so auto exposure doesn't turn night into grey day.
- *Warm against cool:* practical lights at 2700 to 3000 K (bulbs), sodium street lights at 2000 K, LEDs at 4000 K.
  Night reads as night by contrast, not by darkness.
- *Blue haze in the distance:* a little height fog in deep blue gives depth to streets and courtyards.
- With UltraVHS, give the Camcorder a bluer black for night scenes (`BlackLevel` about 0.02, 0.03, 0.05): its default
  is warm.

**Reflections (metal, glass, water)**
- *Reflection captures:* one Box Reflection Capture per room, sized to the room (Unreal's own, drag in). They're
  what makes metal and gloss look right in a baked or a cheap level; Lumen and screen-space reflections fill in
  what's on screen.
- *Roughness carries it:* PBR roughness maps with variation (smudges, wear) make metal read as metal; a flat
  roughness reads as plastic. Keep metallic 0 or 1.
- *Wet things:* Light Kit Puddle on streets and bathroom floors; the reflections move as the camera moves, which is
  what sells them (that video's wet ground).
- *Moving reflections:* Light Kit Sweep's headlights slide highlights across metal and wet floors; Light Kit Pattern
  Caustics on a ceiling over water.
- *Mirrors:* Lumen handles a small one; a bathroom mirror at the player's face may need a Planar Reflection (costly:
  only where you stand in front of it).

**Light you can see**
- *The patch on the floor* is the sun or moon through the opening: it's free once the sky's in.
- *Shafts:* the window's shaft card (cheap, by default) or the sky's volumetric fog (real, about a millisecond, every
  shadowed light gets volumetric beams; flashlights love it).
- *Dust:* the shaft's drifting motes (`Dust`).

## Budget (estimates for an RTX 3090 at 1440p; measure with `stat gpu`)

| | |
|---|---|
| Sky, windows, patterns, puddles, flicker | well under a millisecond together |
| Each shadowed moving light (sweep, a pattern with shadows) | 0.1 to 0.3 ms |
| Volumetric fog | about 1 ms |
| Lumen GI and reflections | 3 to 6 ms (the baked route avoids it) |

## Status

Written without an editor: the materials' HLSL compiles with DXC (`Tools/check_hlsl.py`), the patterns are previewed
offline (`Tools/preview_patterns.py`), the C++ follows the 5.4 to 5.8 API but **hasn't been compiled against an
engine yet**; `CLAUDE.md` lists the engine API it touches. Light levels are physical (lux, cd/m², EV100) and set by
reasoning, not measured in Unreal: the first look in the editor will want tuning by eye, then by measurement.
Everything here is original; no third-party code or assets.
