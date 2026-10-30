# HorrorStudio Look: the studio's look for any Godot 4.7 game

One add-on (`addons/horrorstudio_look/`, GDScript and shaders, nothing to build) with the pieces of the studio's look,
each a script or a shader you load; the director's desk copies it into every game it exports (docs/GODOT_EXPORT.md).
Its demo pictures every part and measures it (`demo/demo.gd`; the studio's check `python tools/godot/plugin_check.py`,
LOOKPLUGIN). The pieces, the numbers behind them and what was measured: **docs/GODOT_LOOK.md**.

| Piece | File | Use |
|---|---|---|
| **The look preset** | `look.gd` (`HSLook`) | `HSLook.apply(viewport, environment, "realism")`: pseudo-realism for small, baked-lit rooms with the effects overplayed: screen-space reflections, SSAO and SSIL, a little glow, a thin volumetric haze, AgX with the contrast pushed, TAA (no MSAA: it switches SSR off). `"plain"` turns it all off. `HSLook.set_aa(viewport, 0..3)` the player's choice (Off, FXAA, TAA, TSR) |
| **Shadows** | `look.gd` (`HSLook.shadows`) | `HSLook.shadows(viewport, 0..3)`: the shadow maps' filter (hard to ultra soft, the lights' `light_size` as penumbras) and the atlas (2048 to 8192, the quadrants cut for a few big maps and many small); give lights a `light_size` and a `shadow_blur` |
| **Light patterns** | `pattern.gd` (`HSPattern`), `pattern.gdshader` | `HSPattern.attach(spot, {pattern, scale, speed, open, angle}, distance)`: caustics, leaves, blinds or cloud shadows drawn into a small viewport each frame and projected by the spot light (`light_projector`); `detach` |
| **Flicker modes** | `../horrorstudio/flicker.gd` (`HSFlicker`, the runtime add-on) | a light's flicker by mode: fluorescent, dying, candle, pulse, custom letters; the same curves as the desk's `tools/shared/flicker.js` |
| **Light shafts** | `shaft.gd` (`HSShaft`), `shaft.gdshader` | `HSShaft.make(at, into, width, height, reach, {strength, dust, drift})` a FogVolume along a window's light whose fog shader thickens the haze in the beam with dust drifting in it; `HSShaft.light(spot, k)` raises the window light's volumetric energy; needs the look's haze on |
| **Headlight sweeps** | `sweep.gd` (`HSSweep`) | `HSSweep.make(window_at, outward, along, {every, secs, out, span, energy})` a spot light that slides along the street outside a window every so often, aimed in, the frame's shadow across the ceiling; `fire()` a car now; `attach(marker, settings)` on the export's marker |
| **The iris** | `look.gd` (`HSLook.iris`) | `HSLook.iris(viewport, on, night)`: auto exposure on the camera settling over about a second, a stop under at night |
| **The grade** | `post.gd` (`HSPost`), `post.gdshader` | a film-style colour grade over the finished picture (under the HUD, over the tape): lift, gamma and gain as colours, warmth, saturation, contrast, a film fade, a vignette, fine grain, chromatic aberration; presets `cinema` (the default), `teal-orange`, `cold`, `sodium`, `bleach`, `noir`, `warm`, `none`; `apply(name or {preset, ...})`, `set_grain_cap(k)` |
| **UltraVHS** | `vhs.gd`, `vhs.gdshader`, `vhs_hold.gdshader` | a CanvasLayer with the tape on a full-screen rect: `preset("camcorder" / "camhybrid" / "worn" / "nightmare" / "off")`, `set_night(k)`, `set_strength(k)`, `set_grain_cap(k)`, `ghost(on)`. The three passes of UnrealPlugins/UltraVHS in one shader, matched to it by measurement (GODOTLOOK), with its persistence: a viewport of its own copies the last frame and the tape mixes a little back in |
| **Puffs** | `puff.gdshader` | steam and smoke as soft, noise-eroded discs on a MultiMesh (custom data: age, seed, spin), lit as little spheres, faded into the scene (docs/research/godot_smoke.md) |
| **Wet surfaces** | `wet.gd` (`HSWet`), `wet.gdshader` | `HSWet.wet(mesh_instance, {wetness, puddles, puddle_scale, ripples})` swaps a floor's material for a wet one keeping its colour, texture and roughness: the damp darkening, pools in a world-space noise, mirror-smooth with a damp rim, rain's rings on them. `HSWet.dry()` puts the old one back; `wet_floors(level, rooms)` for an exported level; `HSWet.puddle(parent, at, size, seed)` one puddle as a Decal on any surface, its maps made in code |
| **Leaks** | `leak.gd` (`HSLeak`), the wet shader's band | `HSLeak.make(wall_meshes, {centre, axis, inward, width, top, bottom, drip, wet})`: a band of the wall wet below where water comes in, running in rivulets, drops falling to a ring on the floor; `set_wet(k)` |
| **The softener** | `soften.gd` (`HSSoften`) | `HSSoften.attach(camera)` a CompositorEffect on the camera, run after the transparents (a compute pass over the colour buffer by its depth: almost sharp up close, soft with distance, `set_amounts(near_m, far_m, pixels, least)`; the digits, steam and glows softened with the room, never lost); the camhybrid tape switches it on, `detach` takes it off; `debug` 2 draws the depth it reads as grey (10 m white), 3 the raw depth; the demo measures it: a checker at arm's length kept, one across the room softened, a glow kept |
| **Mirrors** | `mirror.gd` (`HSMirror`), `mirror.gdshader` | `HSMirror.attach(mesh_instance, surface, camera, res)` a real reflection on a surface: the camera reflected through the glass's plane into a SubViewport of its own each frame the glass is in view, the glass reading the texel that camera gave each of its points (its view-projection), its own wall and itself kept out of the picture, each mirror on a layer of its own (11 to 19) so a mirror seen in a mirror shows its last frame; `mirror_surface(mesh_instance)` finds a kit panel's `kit_mirror` face |
| **Window panes** | `glass.gd` (`HSGlass`), `glass.gdshader` | `HSGlass.pane(mesh_instance, size_m)` clear glass on a quad, the room's lights in it; `set_rain(material, k)` drops running down it with trails and a mist, each bending the view behind |
| **Blood** | `blood.gd` (`HSBlood`), `blood.gdshader` | `HSBlood.material(seed)` a splat for a flat thing (a pool with a ragged edge, flung drops, drips down a wall), glossy wet, `set_dry(k)` to dull it, `set_opacity(k)` to scrub it; `HSBlood.splat(parent, at, normal, size, seed)` a quad over any surface |
| **Rain** | `rain.gd` (`HSRain`), `rain.gdshader` | `HSRain.make(size, count, strength)` a box of streaks falling and wrapping in the vertex shader (no particle system), turned to the camera, faint up close, lit by every light that reaches it (the flashlight's beam full of rain); `follow` a node to keep it round the player outdoors; splashes where they land (`splash.gdshader`, a child MultiMesh: a landing glint, a wet sheen and five thrown droplets, nothing drawn; the ripple is the wet floor's; `set_splashes(on)`) |
| **The eye** | `eye.gd` (`HSEye`), `eye.gdshader` | the Studio's eye on a Character Studio export's eyeballs: `HSEye.wear(node, glb_path)` reads each eye's shape and paint from the glb's material extras and puts the refracting cornea on it (the iris behind the dome, read where the bent view lands; the catchlights on the clear coat). The same maths as the Studio's and Unreal's M_StudioEye |
| **Hair** | `hair.gd` (`HSHair`), `hair.gdshader` | the Studio's hair look on an imported model's card hair (a Character Studio export's salon bake, its brows and lashes, any glb with card hair): anisotropic highlights along the strands from the scene's lights (the tangent from the card's UVs), soft tips and edge-on fades; the retro look as toggles: `flat` (unlit), `steps` (colour levels), `dither` (the PSX's 4x4 ordered dither), `retro` all three. `HSHair.material(atlas, look)`, `wear(node, look)` on every mesh named hair, lash or brow (not the scalp), `set_look(material, look)` later |
| **Wet skin** | `skin.gd` (`HSSkin`), `skin_wet.gdshader` | HumanShaders' skin shader (MIT, MatMADNESS: `../HumanShaders`) with a wetness layer: `wetness` the sweat film, `sweat` beads standing on the skin as little domes with glints, `drips` runs, `oil` oiled up (one tight gloss, the colour deeper). `HSSkin.material(albedo_texture, {wetness, sweat, drips, oil}, tone, maps)`; `wear(node, settings, glb_path)` on a character's skin meshes, with a Character Studio export's relief (its normal map), roughness and thinness (its ORM) and its `studioSkin` numbers read from the glb; `set_wet(material, settings)` later |

## Using it in a Godot project

Copy `addons/horrorstudio_look/` into the project's `addons/` (keep the name: the scripts load their shaders by
`res://addons/horrorstudio_look/...`). The skin needs `HumanShaders/` at the project's root too (its lightwarp, noise
and micro-detail textures: `../HumanShaders`, copy it beside). Every piece is a class (`HSLook`, `HSWet`, `HSBlood`,
`HSRain`, `HSMirror`, `HSSkin`) or a shader, usable without enabling the plugin. Enabling it (Project Settings →
Plugins → HorrorStudio Look) registers one node for the editor: **HSLookEnvironment** (`look_env.gd`), a
WorldEnvironment that wears a preset (`realism` or `plain`) in the editor's viewport, so a scene looks in the editor
as it will in the game; in a running game it frees itself (`editor_only`), leaving the game's own environment the
only one. In a studio export the game applies `game.look` from story.json at start (`game.gd`), so the node is for
editing only: drop one into a level scene to see the look while you work on it.

The demo: `godot --path PROJECT -s res://addons/horrorstudio_look/demo/demo.gd -- --out=DIR` pictures a room with
each piece and writes `report.json` with the measures; `demo/people.gd -- --glb=res://people/NAME.glb --out=DIR` a
Character Studio export (or any glb whose skin mesh is named `..._skin`) on the skin, flat-lit, dry, sweating, oiled.

## Licences

Ours (the studio's), except `skin_wet.gdshader`, which keeps HumanShaders' MIT notice (its base) with the studio's
layer marked `HS`.
