# The look in Blender: Light Kit's day and night, UltraVHS's camcorder

The two Unreal plugins (`UnrealPlugins/LightKit`, `UnrealPlugins/UltraVHS`) give a game its light and its tape. This
is the same look in Blender, for stills, key art, trailers or a scene blocked there: the same times of day, the same
deep-blue night, the same camcorder, with the same numbers, so a Blender render and an Unreal frame agree.

**One command does all of it** (§1); §2 to §5 are the same by hand, for when you want to change a part. Everything was
checked by rendering with Blender 4.2 (§6).

## 1. One command

```bash
blender /path/to/scene.blend --python /path/to/HorrorEngine/tools/blender_look.py -- --time night --vhs camcorder --windows --handheld --save
```

Or inside Blender: Scripting tab, open `tools/blender_look.py`, set `DEFAULTS` at the top, Run Script.

| Option | What it sets up |
|---|---|
| `--time day\|dusk\|night` | the sky, the sun or the moon, the haze, the exposure and the grade (§2) |
| `--vhs camcorder\|worn\|nightmare\|off` | UltraVHS's passes as compositor nodes, the frame 4:3; at night its night mode (§4) |
| `--windows` | a window light (and in Cycles a portal) in every object named `window…`, facing into the room (§3) |
| `--handheld` | the camera's slow handheld drift (§4) |
| `--engine cycles\|eevee` | the render engine (default: the scene's) |
| `--save` | saves the .blend |

What it makes is named `LK_…` (the light) and `VHS_…` (the tape); running it again replaces them, and nothing of yours
is touched (your own lights stay; the compositor nodes go between the Render Layers and the Composite). Name your
window glass `Window…` (a thin box or plane the size of the glass) for `--windows`; the script finds which side is the
room by casting rays (the room's walls are near), so it works on any wall.

## 2. The time of day (Light Kit Sky)

| | Day | Dusk | Night |
|---|---|---|---|
| **Sun / moon** (a Sun lamp) | 50° up, from 135°, strength 4, warm white (1, 0.95, 0.88), angle 1° | 6° up, strength 2.5, orange (1, 0.6, 0.34), angle 1.5° | the moon: 35° up, strength 0.3, cool blue (0.55, 0.7, 1.0), angle 1° |
| **Sky** (World) | Sky Texture, Nishita (sun disc off: the lamp casts the shadows), strength 0.25 | Nishita, strength 0.5 | a gradient: the horizon (0.04, 0.07, 0.16), the zenith (0.008, 0.016, 0.05), strength 1: a navy sky, never black |
| **Windows** (§3) | 120 W per m² of glass, cool (0.8, 0.88, 1.0) | 30 W/m², warm (1, 0.72, 0.58) | 6 W/m², blue (0.35, 0.5, 1.0) |
| **Haze** (Mist pass) | none | 25 % toward (0.3, 0.15, 0.1) | 40 % toward (0.01, 0.02, 0.05) |
| **Exposure** (stops) | −0.5 | 0 | 0 |
| **Grade** | saturation 1 | 1.05, shadows +(0, 0, 0.003) | 0.8 (eyes lose colour at night), shadows +(0, 0.004, 0.012): they settle to blue |

By hand:
1. **World:** Background ← Sky Texture (Nishita; Sun Elevation and Rotation as above; Sun Disc off), Strength as above.
   At night: Texture Coordinate (Generated) → Separate XYZ (Z) → Color Ramp (0: the horizon colour, 0.6: the zenith)
   → Background.
2. **Sun lamp:** Strength, Color and Angle as above (a 1° sun is twice the real one: softer, smoother shadow edges, as
   Light Kit does), rotated to the elevation and the compass direction.
3. **Haze:** don't use a world volume (it swallows the sky: every ray to the background is absorbed). Turn on the Mist
   pass (View Layer > Passes > Mist; World > Mist Pass: start 4 m, depth 80 m, quadratic), and in the compositor
   Mix (fac = Mist × the amount) the picture toward the haze colour.
4. **Colour management:** View Transform AgX (Filmic before 4.0), Look None, Exposure as above. With the camcorder on,
   the view transform is Standard instead (§4: the camcorder records after the tonemapper).
5. **Grade** (compositor): Hue/Saturation/Value (saturation), and the shadows' lift: RGB to BW → Math (1 − luma) →
   multiply by the lift colour → Mix Add onto the picture.

**Practical lights:** bulbs 2700 to 3000 K (warm), sodium street lights 2000 K, LEDs 4000 K; night reads as night by
warm against cool, not by darkness. Give every light a size (a bulb's Radius 2 to 5 cm; ceiling panels as Area lights
the panel's size): a zero-size light makes hard shadows and pin-point highlights. A touch of Contact Shadows (Eevee)
sits small things on the floor.

## 3. Windows, bounce and the rest of the kit

| Light Kit | In Blender |
|---|---|
| **Window**: the sky's fill through the glass, a Lightmass portal | an **Area light** (Rectangle) the size of the glass, just inside, facing in, the time's colour and W/m² (§2). In Cycles a second area light there with **Portal** ticked: the sky's light comes in clean (less noise). The bounce off the floor is Cycles' own; in Eevee turn on Raytracing (Render > Raytracing) and a Light Probe Volume over the room |
| **Pattern** (caustics, leaves, blinds, clouds) | Cycles: a Spot light with a node texture (Light > Nodes: Texture Coordinate (Normal) → a Wave or Voronoi texture → Emission strength); Eevee has no light textures: a plane with a cut-out (alpha) texture in front of the light, its shadow is the pattern |
| **Sweep** (a car's headlights across the ceiling) | two Spot lights outside the window, keyed to drive past in a second or two; the window frame throws the moving shadows |
| **Flicker** (a tired tube, a candle) | a Noise modifier on the light's Strength curve (Graph Editor > Modifiers > Noise: scale 2 to 4 frames for a tube's stutter, 12 for a candle) |
| **Puddle** (wet floor) | the floor's Roughness through a Noise texture and a Color Ramp (puddles at 0.02 roughness, damp edges at 0.3); the reflections are the scene's own |
| **Reflection capture** | Eevee: a Light Probe Sphere per room (a Plane probe for a mirror); Cycles needs nothing |
| **Volumetric shafts** | a world volume is out (it hides the sky); give the room a box with a Principled Volume (density 0.01 to 0.03) and the window's light makes the beams |

## 4. The camcorder (UltraVHS) in the compositor

UltraVHS runs after Unreal's tonemapper, on display colour; Blender's compositor works in scene light, before the
view transform. So the chain tonemaps first, grades as the camcorder does, then goes back to scene light, and the
view transform is Standard (nothing twice):

| # | Node | Setting (1080-line output; `k` = height ÷ 480, so the knobs mean the same at any size) |
|---|---|---|
| 1 | Exposure | the time's exposure (§2) |
| 2 | Convert Colorspace | Linear Rec.709 → AgX Base sRGB (the tonemapper) |
| 3 | Lens Distortion | Distortion 0.085 (barrel), Dispersion 0 (the fringe), **Fit** on (the corners filled) |
| 4 | Vignette | Ellipse Mask 1.2 × 1.2 → Blur (Gaussian, 35 % of the height) → Mix Multiply, factor 0.25 (the corners about 75 %) |
| 5 | Hue/Saturation/Value | Saturation 0.8 |
| 6 | Color Balance | Offset/Power/Slope: Offset = black (0.035, 0.027, 0.022), Slope = white − black ((0.82, 0.81, 0.78) − black). **Night mode: Offset (0.02, 0.03, 0.05)** |
| 7 | Separate Color | YCC (ITU 709) |
| 8 | Y: Blur | Gaussian, X 1.4 × k × 3.3 px, Y 60 % of that (the soft luma) |
| 9 | Y: the halo | Blur that again (X 3 × k × 3 px), Mix Subtract it from 8, Mix Add the difference back onto 8 (factor 1): the deck's bright edge |
| 10 | Cb, Cr: Blur | Gaussian, X 2 × k × 3.5 px, Y 0.5 × k × 2 px (colour bled along the line, shared with the line above) |
| 11 | Combine Color | YCC |
| 12 | Convert Colorspace | sRGB → Linear Rec.709 |
| 13 | Composite | View Transform **Standard**, Look None; Output 4:3 (1440 × 1080) |

The presets: **Camcorder** as above; **Worn** saturation 0.7, luma 1.6, chroma 3, colour late by 1.5 (a Translate node
on Cb and Cr, X 1.5 × k px), a little snow (a Texture node with a Noise texture, Mix Overlay 0.075); **Nightmare**
saturation 0.55, black (0.06, 0.045, 0.045), white (0.74, 0.72, 0.70), luma 1.8, chroma 4.5, late 3, snow 0.15.

What the compositor can't do: the tape's lines slipping, the rolling tracking band, the head-switching tear, dropouts
and the last frame's ghost. For those, render the frames and run UltraVHS's own numpy passes over them (the shader's
twin, line for line):

```bash
uv run --with numpy --with pillow python UnrealPlugins/UltraVHS/Tools/preview.py render.png taped.png --preset worn --night
```

(it reads a clean render: leave the compositor's camcorder off for that).

**The handheld camera:** on the camera's rotation curves (key it once, then Graph Editor > Modifiers > Noise), two
Noise modifiers each: scale = fps ÷ 0.35 frames (0.35 Hz), strength 2 × the angle in radians (pitch 0.45°, roll
0.35°, yaw 0.6°); the second at 0.45 of the scale and 0.4 of the strength. Walking adds a bob: a Noise on Z location
at two steps a second (scale fps ÷ 2), strength 0.024 (1.2 cm). Turn on **Motion Blur** (Render > Motion Blur):
camcorders smear in turns.

## 5. Checking (by measurement, as the plugins are)

```bash
python tools/retarget.py setup                # once: Blender's Python module (no Blender install needed)
python tools/blender_look_check.py            # ends BLENDERLOOK ok; --keep DIR keeps the pictures
```

It runs UltraVHS's test chart through the compositor nodes and measures it with UltraVHS's `measure.py` against the
reference video, and renders a room (5 × 4 m, a window in its east wall) at each time. The last run (Blender 4.2):

| | measured | target |
|---|---|---|
| edge rise (10 to 90 %), 1080 lines | 5 px | 5 (the reference) |
| the halo beside edges | 11.8 % | 12 % |
| colour edges against luma's | 2.33 × | 2.4 × |
| black | 0.037 | 0.031 |
| night mode's black | (0.048, 0.078, 0.118): blue | blue |
| the room's median, day / dusk / night | 0.55 / 0.42 / 0.16 | brighter by day; the night readable |
| the night's shadows | (0.044, 0.081, 0.126) | blue, never black |

`UnrealPlugins/UltraVHS/Tools/measure.py` measures any render the same way (`measure.py frame.png`), next to the
reference's numbers.

## 6. Blender versions

Written and checked on Blender 4.2 (the Python module the studio installs). In 5.0 the compositor became a node group
(`scene.compositing_node_group`), the physical sky gained new models and several node settings became input sockets:
`blender_look.py` tries both, and by hand the nodes in §4 have the same names. Eevee (4.2's "Eevee Next") works for
everything but the portal and the light textures (§3).
