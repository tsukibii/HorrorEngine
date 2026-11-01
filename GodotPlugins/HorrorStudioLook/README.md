# HorrorStudio Look: the studio's look for any Godot 4.7 game

One add-on (`addons/horrorstudio_look/`, GDScript and shaders, nothing to build) with the pieces of the studio's look,
each a script or a shader you load; the director's desk copies it into every game it exports (docs/GODOT_EXPORT.md).
Its demo pictures every part and measures it (`demo/demo.gd`; the studio's check `python tools/godot/plugin_check.py`,
LOOKPLUGIN). The pieces, the numbers behind them and what was measured: **docs/GODOT_LOOK.md**.

| Piece | File | Use |
|---|---|---|
| **The look preset** | `look.gd` (`HSLook`) | `HSLook.apply(viewport, environment, "balanced")` (the default: a GTX 1060's budget, no SSIL, SSR at 48 steps; `HSLook.PROJECT` its project settings, `apply_project()`), or `"realism"`: pseudo-realism for small, baked-lit rooms with the effects overplayed: screen-space reflections, SSAO and SSIL, a little glow, a thin volumetric haze, AgX with the contrast pushed, TAA (no MSAA: it switches SSR off). `"plain"` turns it all off. `HSLook.set_aa(viewport, 0..3)` the player's choice (Off, FXAA, TAA, TSR) |
| **Shadows** | `look.gd` (`HSLook.shadows`) | `HSLook.shadows(viewport, 0..3)`: the shadow maps' filter (hard to ultra soft, the lights' `light_size` as penumbras) and the atlas (2048 to 8192, the quadrants cut for a few big maps and many small); give lights a `light_size` and a `shadow_blur` |
| **Light patterns** | `pattern.gd` (`HSPattern`), `pattern.gdshader` | `HSPattern.attach(spot, {pattern, scale, speed, open, angle}, distance)`: caustics, leaves, blinds or cloud shadows drawn into a small viewport each frame and projected by the spot light (`light_projector`); `detach` |
| **Flicker modes** | `flicker.gd` (`HSFlicker`) | a light's flicker by mode: fluorescent, dying, candle, pulse, custom letters; the same curves as the desk's `tools/shared/flicker.js` |
| **Light shafts** | `shaft.gd` (`HSShaft`), `shaft_card.gdshader` | `HSShaft.make(at, into, width, height, reach, {strength, dust, drift, color})` a window's beam as a card: two crossed translucent planes along it and five slices across it, added, fading along and at the sides, dust drifting in it, each plane fading as it turns edge-on (the node is a FogVolume holding empty fog, the card its child); `HSShaft.light(spot, k)` raises the window light's volumetric energy for the haze near the glass |
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
| **The blink** | `blink.gd` (`HSBlink`) | a Character Studio export's blink (docs/GODOT_LOOK.md §5f): `HSEye.wear` adds one to a character whose export carries `eyesClosed_L`/`_R`; it sets them and their in-betweens (`_in1250` ... `_in9375`, each by its hat, so the lid follows its curve over the eye) on the skin, the lashes, the brows and the tear line every frame: an idle blink (every 2 to 6 s), or `hold` (a scene's face) |
| **The tear line** | `tear.gdshader` | the wet strip along each lower lid (`tearline_L`/`_R`, `studioTear`): added over what's behind it, black itself, the lights' glint along the lid (MetaHuman's lacrimal fluid); `HSEye.wear` puts it on |
| **Hair** | `hair.gd` (`HSHair`), `hair.gdshader` | **MetaHuman's way from the salon's bake** (docs/GODOT_LOOK.md §5e): with the glb's path, `wear(node, look, glb_path)` reads each hair material's record and wears what the bake carries (shell normals, strand tangents, occlusion, each strand's numbers): soft dithered coverage under TAA, the roots fading in, the card's sides tapering, two highlights with glints in the look's colours, light through from behind, a scatter; the darkened scalp and the brows' fill in their colours. Without a record: the Studio's hair look on an imported model's card hair (a Character Studio export's salon bake, its brows and lashes, any glb with card hair): anisotropic highlights along the strands from the scene's lights (the tangent from the card's UVs), soft tips and edge-on fades; the retro look as toggles: `flat` (unlit), `steps` (colour levels), `dither` (the PSX's 4x4 ordered dither), `retro` all three. `HSHair.material(atlas, look)`, `wear(node, look)` on every mesh named hair, lash or brow (not the scalp), `set_look(material, look)` later |
| **Wet skin** | `skin.gd` (`HSSkin`), `skin_wet.gdshader` | HumanShaders' skin shader (MIT, MatMADNESS: `../HumanShaders`) with a wetness layer: `wetness` the sweat film, `sweat` beads standing on the skin as little domes with glints, `drips` runs, `oil` oiled up (one tight gloss, the colour deeper). `HSSkin.material(albedo_texture, {wetness, sweat, drips, oil}, tone, maps)`; `wear(node, settings, glb_path)` on a character's skin meshes, with a Character Studio export's relief (its normal map), roughness and thinness (its ORM) and its `studioSkin` numbers read from the glb; `set_wet(material, settings)` later **The skin's detail** (docs/GODOT_LOOK.md §5d), on a Character Studio export by itself: the pores, the furrows between them, the lips' lines and the colour's unevenness drawn at their true size from `textures/` (made by `tools/skin_detail.py`), placed by MHR's region map, a pit darker and duller, the relief turned into roughness once it's too fine to see, a faint peach fuzz, the screen-space scattering kept gentle; `set_detail(material, "young"/"natural"/"adult"/"old" or numbers)`, picked from the export's own age and pores by default; the export's occlusion on the ambient light. **The skin's depth** (docs/GODOT_LOOK.md §5g), on a Character Studio export by itself: warm light from under the skin round the eyes, the nose, the mouth and the ears (MHR's depth map, `textures/mhr_skin_depth.png`, most in the creases), the occlusion red instead of grey there, thin skin lit through by the room, for a baked level's light as much as a lamp's; the ears switched off for hair over them (the Studio's Ear glow, `set_depth(material, amount, ears)`) |

## The effects as nodes: drag and drop

Every effect is also a node to drop into a scene and tune in the inspector (`nodes/`), and `presets/` holds 33 ready
ones (rain, a downpour, wet floors, a puddle, blood on a floor and up a wall, a leak, a window's shaft and its sun,
a headlight sweep, caustics, blinds, leaves and clouds lights, a fluorescent tube, a dying bulb, a candle, an alarm,
a faulty neon, a mirror, a rainy window pane, grades, tapes, a character's look): drag one from the FileSystem dock
into the level, or Add Child Node and type `HS`. They preview in the editor where they can (the rain falls, the dust
drifts, the floor is wet, the lights flicker, the patterns move) and save only their numbers: what they make inside
themselves is never saved, and a node that changes a mesh's material (a wet floor, a pane, a leak) puts the mesh's
own back before every save. Forward (-Z) is always into the room. The list and how each works: docs/GODOT_LOOK.md §0.

| Node | Base | What |
|---|---|---|
| `HSRainBox` | Node3D | rain in a box (`size`, `count`, `strength`, `wind`, `splashes`, `follow_camera`) |
| `HSPuddle` | Node3D | a puddle decal under it (`size`, `seed`, `depth`) |
| `HSBloodSplat` | Node3D | blood on the surface its +Y points out of (`size`, `seed`, `dry`, `opacity`, `pool`, `ragged`, `drops`, `drips`) |
| `HSLightShaft` | Node3D | a window's beam, in the opening with forward into the room: the window's rectangle (`width`, `height`, an orange outline in the editor to fit) swept along the sunlight (`sun_down`, `sun_side`) to the floor (`floor_y`, `reach`), crisp at the glass and soft where it lands (`soft_near`, `soft_far`), `strength`, `dust`, `drift`, `color`; `aim_lights` puts the light under it outside, along the beam |
| `HSHeadlightSweep` | Node3D | a car passing outside the window it sits in (`every`, `secs`, `out`, `span`, `energy`, `aim`, `seed`, `color`, `preview_every`; `fire()`) |
| `HSWetSurface` | HSOnMesh | the mesh it's under made wet (`wetness`, `puddles`, `puddle_scale`, `ripples`, `ripple_rate`, `water_tint`, `edge`) |
| `HSWindowPane` | HSOnMesh | glass with rain on the mesh it's under (`rain`, `clarity`, `tint`, `drop_cm`, `speed`, `bend`, `size_m`, `seed`) |
| `HSWallLeak` | HSOnMesh | water down the wall it's on (`width`, `length`, `wet`, `drip`) |
| `HSMirrorSurface` | Node | the mesh it's under as a real mirror, in the game (`surface`, `resolution`) |
| `HSLiquidFill` | Node | a bottle's liquid kept level and sloshing (a made prop's `<name>_liquid`, or any closed mesh of a container's inside; `fill`, its colours, `slosh`, `settle`, `swing`; the game puts one under every made prop's liquid itself) |
| `HSPropFX` | Node3D | a made prop's enhancers, each a switch: `glow` (its LEDs, screen backlight and embers: the emission map, `glow_energy`, `glow_flicker`), `flame` (a candle's flame drawn by `flame.gdshader` and a flickering candle light, `flame_light`, `flame_shadows`, `flame_size`, `flame_color`), `smoke` (incense), `steam` (a spout, a vent, an open pot; off at first), `wax` (light into a candle's wax: subsurface and backlight, `wax_glow`), `enabled` for all; read from the prop's glb (`propgen_fx`); in its `.tscn`, put on every made prop by the game, or dropped under one; a kind off for the whole project in Project Settings, `horrorstudio/prop_fx/*` (docs/PROPGEN.md §14) |
| `HSCharacterLook` | Node | the character it's under on the skin, eye and hair shaders, in the game (`wetness`, `sweat`, `drips`, `oil`, `skin_detail` auto/young/natural/adult/old/off, `detail_amount`, `skin_depth` (times the character's own Depth), `ear_glow` auto/on/off, `eyes`, `hair`, `glb_path`) |
| `HSFlickerLight`, `HSFlickerSpot` | OmniLight3D, SpotLight3D | a light that flickers (`mode`, `amount`, `interval`, `rate`, `letters`, `seed`, `preview_in_editor`, `on_mains`) |
| `HSPatternLight` | SpotLight3D | a spot throwing caustics, leaves, blinds or clouds (`pattern`, `feature_m`, `speed`, `open`, `angle`, `aim_distance`, `size_px`, `frames`, `period`) |
| `HSGrade` | Node | a colour grade, the level's own over the game's (`preset` fills the numbers: `lift`, `gamma`, `gain`, `warmth`, `saturation`, `contrast`, `fade`, `vignette`, `grain`, `aberration`) |
| `HSTape` | Node | the tape, the level's own over the game's (`preset`, `strength`) |
| `HSLightZone` | Node3D | a room's box (like VoxelGI's) owning the lights inside it: they light only what's in it (its meshes on the zone's render layer, its lights' cull mask), their reach fitted to it, off in the game while it's out of view; `size`, `keep_inside`, `fit_range`, `range_reach`, `hide_unseen`, `cull_distance`, `margin`; the room_* presets are one with its lights; the export puts one in every room |
| `HSLookEnvironment` | WorldEnvironment | the look preset in the editor's viewport (below); `balanced` the default |

**The balanced look** (a GTX 1060 the target): `HSLook.PROJECT` is the project settings that make it (TAA, the shadow
atlas and filter, occlusion culling, the effects' buffers). Enabling the plugin applies them once, and Project >
Tools > HorrorStudio: apply the balanced project settings applies them again. `presets/look_balanced.tscn` drops in
the rest: the balanced environment, the camhybrid tape and the cinema grade.

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

**Streets from the Blender bake** (`python tools/street.py bake <street>`, docs/STREET_TEXTURING.md): drop the street's
`.glb` (or its `.blend`) into the project. It is plain glTF, so it already has its finishes at their real size and its
occlusion on UV2. With the plugin enabled, its import step (`street_import.gd`) turns every surface that carries the
wear's recipe (the material's extras, `hs_wear`) into `street.gdshader`, with the dirt, rain streaks, worn edges and
wet patches as Blender rendered them, and makes the road paint and decals cast no shadow of their own (the street
builder's own .glb too). `HSStreet.weather(node, amount)` turns the wear down or up at run time.

The demo: `godot --path PROJECT -s res://addons/horrorstudio_look/demo/demo.gd -- --out=DIR` pictures a room with
each piece and writes `report.json` with the measures; `demo/nodes.gd -- --out=DIR` every preset in a room, measured (`demo/window.gd` the window sun in a wall's opening),
and a save as the editor does it (`nodes.json`, `nodes.png`); `demo/editor_test.gd` the same in the editor (the
check installs it as a plugin); `demo/people.gd -- --glb=res://people/NAME.glb --out=DIR` a
Character Studio export (or any glb whose skin mesh is named `..._skin`) on the skin, flat-lit, dry, sweating, oiled;
`demo/portrait.gd -- --glb=res://people/NAME.glb --out=DIR [--detail=off] [--preset=NAME]` the same export as a
portrait under a character reel's light and the game's lamp, at four distances (`tools/godot/portrait_check.py`);
`--depth=N`, `--ears=off`, `--light=baked` (a baked level's light: the ambient alone), the `side` shot and `--probe=JSON`
(points on the skin by UV, measured in each shot) for the skin's depth (docs/GODOT_LOOK.md §5g).

## Licences

Ours (the studio's), except `skin_wet.gdshader`, which keeps HumanShaders' MIT notice (its base) with the studio's
layer marked `HS`.
