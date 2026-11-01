# The look in Godot: the HorrorStudio Look plugin

Written 2026-10-29 on `godot-support`, from the user's ask that afternoon: "the shades we made for rain reflections,
rain, reflective materials inspired by Chilla's Art ported to Godot; a default anti-aliasing and the most aesthetic
settings for pseudo realism (baked lighting with overplayed effects like blood and reflective surfaces to trick the
brain; our games are small); a realistic sweaty wet skin shader, and oiled up; the HumanShaders repo implemented;
our own plugins kept in a folder that gets passed in, not inside the exported projects".

**The pictures:** `docs/godot_sheets/2026-10-29_look.jpg`, a contact sheet of the night's work (the inventory, the
shelf's sets, the rain, the wet floor, blood, the stand-in, the Studio's character dry, sweating and oiled, its eye,
the tape, the preset); the full frames in `Saved/Story/TestRoom001/godot_reference/` and `Saved/Story/_look/` on
the machine that made them.

**Where it is:** `GodotPlugins/HorrorStudioLook/addons/horrorstudio_look/` (its README for anyone, its CLAUDE.md for
changing it). The export copies it into every game (`addons/horrorstudio_look/`, GODOT_EXPORT §3); the runtime uses
it through the story's words (§5). The check: `python tools/godot/plugin_check.py` (LOOKPLUGIN), a demo room
pictured with each part and measured (§6), the pictures in `Saved/Story/_look/godot_plugin/`.

## 0. The effects as nodes: drag, drop, tune (`nodes/`, `presets/`)

Written 2026-10-30 after the user's "I manually handle the lighting, you make a plugin that's easy to drag and drop
the effects you've created and modify/customize them". Every effect below is also a node with its settings in the
inspector, and the folder `addons/horrorstudio_look/presets/` holds ready-made ones: **drag a preset from the
FileSystem dock into the level** (or Add Child Node and type `HS`), move it, and tune it in the inspector. The plugin
needn't be enabled: the nodes are classes (`class_name`, each with its icon), so they're in Add Child Node anyway.

Four kinds, by what they work on:

| Kind | Nodes | How |
|---|---|---|
| **Things of their own** | `HSRainBox`, `HSPuddle`, `HSBloodSplat`, `HSLightShaft`, `HSHeadlightSweep` | drop it where it goes. It makes its streaks, decal, quad, card or lamp as children of its own that are never saved (no owner), so the scene file holds only the node and its numbers. They run in the editor: the rain falls, the dust drifts, a sweep passes every `preview_every` seconds |
| **On a mesh you have** | `HSWetSurface`, `HSWindowPane`, `HSWallLeak` (all `HSOnMesh`), `HSMirrorSurface`, `HSCharacterLook`, `HSLiquidFill` | drop it under the mesh (or the node holding the meshes, or set `target`). The first three change the meshes' materials while they're there, in the editor too, and put the meshes' own back before every save (the editor's pre-save notification) and when removed, so a re-export's level and yours never fight over a material. The mirror reflects and the character wears its skin, eyes and hair when the game runs (they need its camera and its glb). `HSLiquidFill` keeps a bottle's liquid level and sloshing, in the editor too (liquid.gd, docs/PROPGEN.md §10; the game puts one under every made prop's `<name>_liquid` as it enters a level). `HSPropFX` under a made prop (or in the prop's own `.tscn`; the game puts one on every made prop that has some) gives it its enhancers, each a switch: glow, flame (with its candle light), smoke, steam, wax; a kind off for the whole project in Project Settings, `horrorstudio/prop_fx/*` (docs/PROPGEN.md §14) |
| **Lights with behaviour** | `HSFlickerLight` (omni), `HSFlickerSpot`, `HSPatternLight` (spot) | the light itself, its effect in the inspector beside its own settings. A flicker multiplies the Energy you set (the light at full), previewed in the editor, saved at full; `on_mains` puts it in the group `hs_mains`, which the game's power cut switches off and on (any light of yours in that group too). A pattern light draws its loop when the scene starts and is saved without it |
| **Over the picture** | `HSGrade`, `HSTape` | the level's own grade or tape while it's loaded, over the story's `game.grade` and `game.vhs`, which come back when it goes; in a project of your own they add the layer themselves. Picking a grade's `preset` fills its numbers to tune from. Seen when the game runs (a screen effect isn't drawn in the editor's 3D view) |

Orientation, the same for every node that has one: **forward (-Z, the way the node looks) is into the room.** A
shaft's beam runs along it (tilt the node down for the sun); a sweep's and a leak's node sit at the window or on the
wall with forward into the room and X along the street or the wall; a blood splat lies on the surface its +Y (the
green arrow) points out of.

The presets (`presets/*.tscn`, 33): `rain`, `downpour`; `wet_floor`, `wet_floor_raining` (ripples), `damp_floor`;
`puddle`; `blood_pool`, `blood_dried`, `blood_wall`; `wall_leak`; `window_shaft`, `window_sun` (the shaft with a
warm spot shining the same way, a child of it); `headlight_sweep`; `caustics_light`, `blinds_light`, `leaves_light`,
`clouds_light`; `fluorescent_tube`, `dying_bulb`, `candle`, `alarm_pulse`, `faulty_neon`, `desk_lamp_dying`;
`mirror` (a glass quad with its reflection), `window_pane` (a quad with rain on it); `grade_cinema`, `grade_cold`,
`grade_noir`; `tape_camhybrid`, `tape_worn`; `character_look`, `character_sweating`; `look_environment`. A preset is
a scene: its root's settings are in the inspector where it's placed; for one with children (`window_sun`, `mirror`,
`window_pane`) right-click it, Editable Children, to tune those too.

**The window sun** (`HSLightShaft`, the `window_shaft` and `window_sun` presets; the user's ask that afternoon: "adjust
the root to match the window size and make it look like it's coming from the window, at the moment it just looks like
it floats out of the window"). The node sits in the window's opening at the glass's middle, the window's plane its
own XY plane, forward (-Z) into the room. In the editor an orange outline shows the window's rectangle and dashes the
beam's four edges: set `width` and `height` until the rectangle matches the opening (or scale the node). The beam is
that rectangle swept along the sunlight (`sun_down` degrees below level, `sun_side` slanting along the wall), so at
the glass it is exactly the opening and its sides run parallel into the room, crisp at the glass (`soft_near`) and
softer where it lands (`soft_far`); it stops at the floor (`floor_y`, world height; `reach` caps it) instead of
fading in mid-air. The card is HSShaft's with fourteen slices gathered toward the glass and four long planes (a shear
on the card: the slices stay parallel to the window). With `aim_lights` the light under it (window_sun has a warm
spot) is put three metres outside the window and aimed along the beam, so the patch it throws through the opening
and the beam land together. Pictured from the room and from the side: `docs/godot_sheets/2026-10-30_window_sun.jpg`
(LOOKPLUGIN's `demo/window.gd`: a wall with an opening, measured: the beam bright just inside the glass and nothing
beside the opening, its sides parallel, its length to the floor, its light outside and aimed).

**Light zones and the room presets** (`HSLightZone`, `room_bulb`, `room_fluorescent`, `room_dying`, `room_lamp`,
`room_candle`, `room_night`; the user, 2026-10-30, evening: "presets for different room lights with a cubed area
affected, like VoxelGI, the zone is what will be lit; I'm ok limiting the architecture to boxes"). A zone is a box
(`size`, drawn in the editor as VoxelGI's is, coloured by its layer) that owns every light inside it, its children or
anywhere in the scene. It does three things with them:

- **Keeps them to the box** (`keep_inside`): the meshes wholly inside it (by `margin`, so a wall between two rooms
  is in both) go on the zone's render layer, 2 to 10, chosen so that zones touching each other differ. Its lights
  shine on that layer, on layer 1 (what moves: doors, things picked up, the cast, the little things' effects) and on
  the mirrors' layers. A lamp never lights the next room through an open door, and costs nothing there. Shadows are
  still cast by everything, so walls still block.
- **Fits their reach** (`fit_range`): a light's range comes down to `range_reach` (1.25) times the box's farthest
  corner from it, and is never raised.
- **Switches them off unseen** (`hide_unseen`, in the game): while the eye is outside the box and the box is out of
  view or beyond `cull_distance`, its lights are off, shadow maps and all. A power cut and a zone agree through
  `HSLightZone.show_light`: a light shows when its own visibility, the power and its zone all say so.

In the editor the layers, cull masks and ranges are shown as the game will have them, and put back before every
save. The room presets are a zone of 4 × 3 × 4 m about its middle, with one shadowed light, a GTX 1060's budget:
put it in the room's middle and size it to the room. The export puts a zone in every room of every level (the
level's `Zones` folder): the story's lamps, its windows' light and any light the user adds inside are kept to their
room and switched off out of sight. LOOKPLUGIN's `demo/zones.gd` measures it in two rooms with a doorway. The rooms
get different layers and the wall between them both. The bulb's reach is fitted. The next room's floor, seen
through the doorway, is no brighter with the bulb on than off, but brighter when the bulb is let out (so the measure
can tell). The next room's lamp is off while the eye looks away and on when it looks back. A save puts everything
back.

**The balanced look for a GTX 1060** (DECISIONS 2026-10-30, evening): `game.look` `balanced` is the default (§1):
realism's picture with SSIL off (it flashed colours as lights flickered), SSR at 48 steps, a thinner haze. Its
project settings (`HSLook.PROJECT`: TAA alone, debanding, occlusion culling, the shadow atlas at 4096 and 16 bits with
the medium soft filter, SSAO low at half size, SSR's roughness low, the fog's volume at 48, a GI of yours at half
resolution, 4x anisotropic filtering) are written into every export's project.godot and applied by the plugin to a
project of your own the first time it's enabled (again from Project > Tools > HorrorStudio: apply the balanced
project settings). GDEXPORT reads them back. For a project of your own, `presets/look_balanced.tscn` is the rest in
one drop: the balanced environment (kept in the game), the camhybrid tape and the cinema grade. The pause menu's
Shadows default is Medium (the same atlas and filter).

**Carrying them to the next version.** An export is a new folder each time (GODOT_EXPORT §8), the level rebuilt from
the story. Select your nodes in the old version's level, copy, open the new version's level, paste: they hold only
their numbers, so nothing else comes along; one that goes on a mesh (a wet floor) is pasted under the new level's
floor, since the floor itself is the export's.

**Checked:** LOOKPLUGIN's nodes part (`python tools/godot/plugin_check.py --nodes` alone): `demo/nodes.gd` drops
every preset into a room and measures each (the rain made, the floor wet, the decal, the blood dripping on the wall,
the leak's band, the shaft's card, the sweep passing, the four patterns thrown, the flicker lights moving, the mirror
attached, the pane, the skin worn), then saves as the editor does (the meshes' own materials back, the lights at full,
no projector, nothing made in the packed scene; on again after), takes a node off (its floor dry), and runs the
grade and the tape over each other; then `demo/editor_test.gd` opens a scene of presets **in the editor itself**,
sees the rain, the wet floor, the shaft, the pattern, the flicker, the pane and the puddle working there, saves, and
the check reads the file: only what was placed. The room with every preset in it:
`docs/godot_sheets/2026-10-30_nodes.jpg`.

## 1. The preset: pseudo-realism for small rooms (`look.gd`, `HSLook`)

What sells a small greybox room as real isn't detail, it's *soft light with bounce, contact darkening, and surfaces
that answer the lights* (BLENDER_LOOK §1 on the user's references). The games are a few rooms at a time, so the
screen-space effects that a big scene can't afford are cheap here, and they're turned up:

`balanced` (the default since 2026-10-30, evening, a GTX 1060 the target) is this table with SSIL off, SSR at 48
steps and a haze of 0.009; its project settings are §0's.

| Setting | Realism | Why |
|---|---|---|
| Anti-aliasing | **TAA**, no MSAA, no FXAA; debanding on | TAA settles the reflections' and the specular's shimmer. **MSAA switches screen-space reflections off in 4.7** (measured in the check: a mirror floor went black with 2x MSAA, reflected with it off), so it's TAA alone. The player can pick Off, FXAA, TAA or TSR (TAA with FSR 2) in the pause menu; TAA is the default |
| Tonemap | AgX, exposure 1.2 | the filmic curve with the best colour under coloured lights (the warm bulb, the blue night); 1.2 because AgX sits darker than Filmic at 1.0 |
| SSR | on, 128 steps, fade in 0.15, out 2.0, tolerance 0.2 | the overplayed reflections: wet floors, blood, the glossy cabinet, the glass-skin faces carry the lights and the room. 128 steps so the lamp across the room still lands in the puddle under it |
| SSAO | radius 1.0, intensity 2.5, power 1.5 | the corners and the feet of things; GODOT_PLAN §4's trial found it does more for a greybox than any GI |
| Light shafts | a card (two crossed planes and five slices), density 0.3, full by day, 0.6 at dusk, 0.25 at night, coloured by the time | a window's beam (§1c). A FogVolume box till 2026-10-30: the froxel grid drew its foot on the floor as a crisp dotted rectangle that came and went with the eye (the user's pictures) |
| SSIL | radius 1.2, intensity 0.45 (2.5 and 1.2 until 2026-10-30) | a little of the practicals' colour bleeding onto nearby walls over the VoxelGI's bounce. Pared back after the user's "bright gaps on the floor that disappear as I move and look": it's screen-space, so what it bleeds depends on what's in view, and at 1.2 it painted patches that came and went with the eye |
| Glow | soft light, intensity 0.55, threshold 1.05, levels 3 and 5 | the bulbs and the screens bloom a little; soft light keeps the mids from washing |
| Haze | volumetric fog, density 0.012, anisotropy 0.55 | the thin air of a dark house: light beams through doorways, the far end of a corridor softer |
| Grade | contrast 1.08, saturation 1.04 | pushed a touch past neutral, under the tape (UltraVHS) when the game wears it |
| GI | none from the export (since 2026-10-30, noon): yours, made in Godot | the user's decision below |

**The lighting is made by hand in Godot** (DECISIONS 2026-10-30, noon, after a day of view-dependent light: the
per-room VoxelGIs' voxels, SSIL, the fog shafts, then a scripted lightmap bake that took twenty minutes a state in
the cloud). The export writes no VoxelGI, reflection probe or LightmapGI; the story's own lamps (`use: light`:
switches, the power, flicker) and the windows' fill stay, being the story's. You add the GI, the probes and the
effects with the plugin's nodes (§0, the effects as nodes), in a level of a versioned export (GODOT_EXPORT §8), and
carry them to the next version by copy and paste. The export marks every moving thing (a door's leaf, its handle
and hinge half, a pickup, a thing to carry or roll) `gi_mode` dynamic, so a LightmapGI you add bakes around them and
lights them by its probes. The runtime's `lighting` word (STORY_FORMAT §9.1): `on` gives the time of day's sky, sun
and ambient unless the level carries its own WorldEnvironment or DirectionalLight3D (yours win, its Env wears your
environment); `off` is the test light (a flat grey ambient, a soft key without shadows, the look plain, no fog, no
iris), for playing a scene before its lighting is made. LightmapGI's `bake()` is the editor's alone in 4.7 (no
script can call it; a plugin pressing its button works, LESSONS 2026-10-30, but takes twenty minutes a state on the
cloud's CPU renderer): press Bake Lightmaps yourself.

**In the editor** (2026-10-29, the user's return: "how do I apply the look for the test scene"): a game applies its
look at start (`game.gd`, from `game.look`), so a level scene opened in Godot's editor shows none of it. The plugin,
enabled in Project Settings → Plugins, registers **HSLookEnvironment** (`look_env.gd`): a WorldEnvironment with a
`preset` that wears it in the editor's viewport and frees itself in a running game (one WorldEnvironment per scene
tree). The export enables the plugin in `project.godot`, so the node is there to add (search "HSLook" in Add Child
Node; a plain WorldEnvironment with `look_env.gd` attached is the same thing). Drop one into the level scene to edit
under the look; the tape (UltraVHS) is a CanvasLayer of the game's
main scene and shows only in play, when `game.vhs` names a preset (TestRoom001 names none: off).

`plain` is everything off (Filmic, no AA, no effects): a look at the geometry. The pause menu's Graphics rows pare
the preset back on a slower machine (`HSLook.quality`: Reflections Low no SSR, Medium half its steps; Post-processing
Low no glow, SSAO or SSIL, Medium no SSIL; Effects Low no haze; Global illumination Low no SSIL), never add to it.

**Shadows** (`HSLook.shadows(viewport, q)`, the menu's Shadows row, 2026-10-29: the user saw a staircase along the
top of the front door's shadow with TAA on): the filter over the shadow maps (Low hard, Medium soft, High softer,
Epic ultra: the lights' sizes become penumbras) and the positional atlas (2048, 4096, 8192, 8192; sixteen bits
below High), its quadrants cut four, sixteen, sixty-four, sixty-four ways so the nearest lights get big maps and the
rest of a level's twenty-odd small ones; the sun's map the same sizes. The export gives every light a size
(`light_size`: a bulb 6 cm, a lamp 15 cm, a candle 2 cm, a fire 30 cm) and `shadow_blur` 1.5, and writes the High
values into `project.godot`. The game applies the saved row at start, the menu when it changes; the lookshot's
`--shadows=0|1|2` pictures the difference.

**Flicker modes** (`flicker.gd`, `HSFlicker`; the desk's `tools/shared/flicker.js` the same curves; after Light Kit's
Flicker component, 2026-10-29): a light's `mode` (STORY_FORMAT §2): `fluorescent` steady, then every `interval`
seconds or so a stutter of quick drops; `dying` drops out often, sometimes for a while, and sits at three quarters
between; `candle` a fast, small, restless wobble; `pulse` a slow breath at `rate` a second; `custom` your `letters` at
`rate` a second (a off, m as placed, z double). `flicker` 0..1 is how much of it (a mode alone is all of it; none is
the old wobble). A tube switched on, or the power coming back, stutters on for a moment. Everything is drawn from
the clock and a seed from the light's id: a light flickers the same way on every run, and the same way on the desk.
TestRoom001's power lamp is a dying tube, the corridor's second lamp a fluorescent; GDTESTROOM watches the dying one
drop out and sit under full between, DESK checks each curve.

**Light patterns** (`pattern.gd`, `HSPattern`, `pattern.gdshader`; after Light Kit's Pattern actor, the same four
light functions, 2026-10-29): moving light with nothing moving. A light with a `pattern` (STORY_FORMAT §2) is
exported as a SpotLight3D aimed at its `aim`, its cone `spread` wide; at run time HSPattern draws the pattern into a
small viewport under the light every frame (256 px, a canvas shader by TIME) and makes it the light's projector, so
it falls where the light is aimed. `caustics` water's light (two layers of moving cells, their edges bright) on a
ceiling or a wall; `leaves` sun or moon through a swaying canopy (noise warped by a slow wave, cut at its `open`);
`blinds` a venetian blind's stripes (`scale` a slat, `angle` their tilt, `open` how far); `clouds` cloud shadows
passing (slow noise, `open` the cover). `scale` is metres on the aimed surface: the viewport's width in metres is
worked out from the spread and the distance (the export writes it), so a 60 cm caustic is 60 cm on the wall. A
pattern flickers with its light (the flicker modes multiply the energy). The desk draws the pattern too since
2026-10-29, night (`tools/director/lightfx.js`: the same four functions in JavaScript into a loop of small textures,
one a frame at load, cycled back and forth and worn by the spot as its `map`, which three.js projects through the
spot's shadow camera). The demo throws caustics on the back wall and measures the light
and dark across it and that it moves (LOOKPLUGIN). **Where they belong** (the user, 2026-10-29, on the Chilla's
Art references the kit was drawn from: The Closing Shift's wet night street, its puddles and shop windows carrying
the lights): the patterns are for the shinier, wetter, outdoor things, not ceilings as a rule: caustics from a rain
puddle under a street lamp thrown up the wall beside it, moonlight through leaves onto wet ground, a blind's stripes
across a desk by a window; TestRoom001's example is the puddle under the yard's lamp lighting the lobby's wall. The
reflections those references show (metal, wet ground, windows) come from the wet floors (§2), the glass panes (§4),
the mirrors (§5b) and, from that evening till the next noon (the lighting handed to the user), **a ReflectionProbe per room** (the kit's one Box Reflection Capture a
room: the export writes one beside each room's VoxelGI, box-projected, interior, updated once), so metal and glossy
things reflect their room where the screen-space reflections can't reach.

**Light shafts** (`shaft.gd`, `HSShaft`, `shaft_card.gdshader`; after Light Kit's Window shaft card, 2026-10-29; a
card since 2026-10-30): the beam a window throws into a room, dust drifting in it. A window with `shaft`
(STORY_FORMAT §2) gets a box laid along its light (the glass's width and height, `reach` metres into the room; the
export writes it as a FogVolume, which now holds empty fog) and in it **a card**: two translucent planes crossed
along the beam for the side views and five slices across it for the view down the beam, added to the picture,
full at the window and fading along the beam and at its sides, the dust as slow clumps sinking through it (Light
Kit's motes, the same sin product), each plane fading as it turns edge-on so together they read as one beam from
any side; the colour by the time of day (the sky's by day, amber at dusk, the moon's blue at night) and the
strength with it (full, 0.6, 0.25). The window's spot keeps its volumetric energy raised, so the room's haze near
the glass carries the light too. **Why not the renderer's fog** (the first version, a FogVolume box with a fog
shader): the froxel grid drew the box's foot on the floor as a crisp rectangle with a dotted edge that came and
went with the eye and faded with distance (the user's pictures, 2026-10-30, twice). A card is the same from
every seat.
The desk draws a shaft as a see-through additive box along the window's light with the fog shader's density (the
ends, the sides, the dust's clumps), as bright as the window's light is of a full day's (`lightfx.js`, `Shaft`).
The demo lays one from a window-sized spot on the left wall and measures the air inside the beam brighter than
beside it (LOOKPLUGIN); TestRoom001's lobby windows have them. **Seen on the 3090** (2026-10-29,
`docs/godot_sheets/2026-10-29_local_shafts.jpg`, strengths 0.5, 1, 2 and 4 by day and at dusk, side-on): by day a
strength of 1 already reads as a beam into the room, 2 a fuller one, 4 a fog bank; at dusk the window's light is
too weak for any of them, and at night there is none (a lamp outside would give one). The default stays 1; the
user picks from the ladder.

**Headlight sweeps** (`sweep.gd`, `HSSweep`; after Light Kit's Sweep actor, 2026-10-29): a car passing outside a
window at night. A window with `sweep` (STORY_FORMAT §2) gets a marker at its middle from the export; at run time
HSSweep hangs a SpotLight3D off it (the two headlights as one wide beam, with shadows) that every `every` seconds or
so (0.7 to 1.3 of it, from a seed: the same on every run) slides along the street `out` metres from the glass at
headlight height, `span` metres each way over `secs`, aimed in through the window, so the frame's shadow crosses the
ceiling and the highlights slide over metal and wet floors; off between passes. The story's `sweep` action fires one
on a room's windows now (`every` 0: only then). The desk slides the same lamp, with shadows since 2026-10-29, night
(the stage's shadow maps are on; only the lights that ask cast any: a sweep's lamp, a patterned spot); the desk's
quick beat "A car passes" (templates.js) fires one as the player enters a zone, and gives the room's first window a
sweep that only fires if none has one. The demo fires one in
its closed room and measures the ceiling and wall brighter mid-pass (LOOKPLUGIN); TestRoom001's lobby has one every
half minute, and GDTESTROOM fires it and watches the lamp slide along outside the south wall. **Seen on the 3090**
(2026-10-29, `docs/godot_sheets/2026-10-29_local_sweep.jpg`): nothing came in at first, for two reasons that aren't
the sweep's: the export's window panes cast shadows (glass is `cast_shadow` off now, in the export and in
`HSGlass.pane`), and the test room's car ran six metres out, past the yard's own wall (its `out` is 2.5 now, inside
the yard). Then the window read as a white card: the lamp's volumetric fog energy lit the haze right outside the
glass; it's 0.15 on the sweep's lamp now, and the pass reads as it should: the window's rectangle of light on the
far wall and ceiling with the frame's shadow, at energy 10. `lookshot.gd --sweep=<room>` holds a car mid-pass for a
picture.

**The iris** (`HSLook.iris`, after Light Kit's Sky exposure, 2026-10-29; its range cut to one stop 2026-10-30: five
stops made the whole room darken when the eye dropped to the floor, the user's "the lights change based on what
direction I look"; the band is half a stop either way of ISO 300: the demo's bright light now closes the eye by
8% instead of 24%, night holds it at 0.80): auto exposure on the camera
(CameraAttributesPractical), the eye settling over about a second as a camcorder's iris does, held a stop under at
night so night doesn't turn grey (the scale halved; game.gd's set_time). On with any look but `plain`. The demo
switches a bright light on and measures the jump, the settle and the night's step down.

## 1d. The grade (`post.gdshader`, `HSPost`)

The user (2026-10-30, asleep): "work on post processing so the game feels more professional, specifically more
color grading". AgX and the tape are the picture's base; a film-style grade sits over the finished picture now,
a CanvasLayer between the tape (5) and the HUD (10) with one full-screen shader reading the screen: a three-way
corrector (`lift` the shadows, `gamma` the mids, `gain` the highlights, each a colour), `warmth`, `saturation`,
`contrast`, a film `fade` (the blacks lifted toward grey-blue), a `vignette` with its softness, fine `grain`
(finer in the lights, as film's; the menu's Film grain caps it with the tape's), a touch of chromatic
`aberration` at the edges, `amount` mixing it with the plain picture. Presets after the looks horror films are
graded to (`HSPost.PRESETS`): **cinema** (the default for every game: a gentle teal in the shadows and orange in
the lights, saturation 0.94, contrast 1.06, a soft vignette, grain 0.15), **teal-orange** (more of it), **cold**
(blue-grey, desaturated), **sodium** (the street's yellow), **bleach** (bypass: desaturated, hard), **noir** (near
mono, crushed), **warm** (amber), **none**. The story's `game.grade` (STORY_FORMAT §9.1): a name, or an object
with `preset` and any number over it; the check knows the words and ranges. The demo's `grade` stage pictures
the room ungraded and under cinema and measures: over the darkest fifth of the pixels blue over red rises (0.44
to 0.75), over the brightest fifth red over blue rises (1.53 to 1.58), the corner darkens by the vignette (0.038
to 0.029), the middle stays within 0.08.

## 2. Wet surfaces (`wet.gdshader`, `HSWet`)

Light Kit's Puddle (UnrealPlugins/LightKit): "one irregular puddle, deep and mirror-smooth in the middle, damp at
the edge; the reflections are the level's own, so lights smear across it as you walk". In Godot: a floor's material
swapped for the wet shader keeping its colour, texture and roughness. The damp darkens the whole floor (×0.55) and
tightens its highlight (roughness ×0.45); pools lie where a world-space fbm dips (`puddles` moves the threshold,
`puddle_scale` the pools' size), each mirror-smooth (roughness 0.035, specular 0.9, the colour the water's tint over
the dark floor) with a damp rim just outside its edge; `ripples` puts rain on them: a grid of cells, a drop every
1.2 to 2.8 s in each, its ring growing and fading, as a gradient on the normal. SSR does the reflecting (§1), so the
lamp, the cabinet and the walls lie in the pools and slide as the eye moves. A floor wearing a set off the shelf
(the export's world-aligned materials, GODOT_EXPORT §8) keeps its planks or tiles: the wet shader samples it by its
place in the world (`world_uv`), as the triplanar material did.

**A puddle as a decal** (`HSWet.puddle(parent, at, size, seed)`): Light Kit's Puddle for any surface: a `Decal`
whose maps are made in code from a seed (five soft blobs summed with a ragged edge: the pool's alpha, the water's
dark tint; an ORM map with roughness 0.03 in the pool, so SSR mirrors in it; a flat normal), damp at its rim.

**Window panes** (`glass.gdshader`, `HSGlass`): the export writes a quad of glass in every window opening
(`__pane_<room>_<i>`, `metadata/pane`); the runtime rains on them with `game.weather` (`HSGlass.set_rain`): a grid
of cells a couple of centimetres across, a drop in some sliding down at its own pace with a wobble and a trail of
beads above it, a second finer layer, and a mist of static droplets; each drop a little dome whose slope bends what's
seen through the glass (the screen behind, read through the drop's normal) and catches the lights; dry, the glass is
clear with the room's lights in it. GDTESTROOM checks the lobby's two panes wear it with the rain on.

A room's own `wet` (STORY_FORMAT §2, 2026-10-29: a bathroom's floor, a cellar's) wears the same shader by that
much with no rain's rings, and from 0.5 the steps in it are wet ones; TestRoom001's bath is 0.8. The desk's stage
shows a wet floor (its own `wet`, or the rain) darker and glossy (`wetFloor` in stage.js: a clear coat, the roughness
down), the pools being Godot's.

## 2b. Wet walls under a leak (`leak.gd`, `HSLeak`; the wet shader's band)

A prop with `use: leak` (STORY_FORMAT §2: its `wall`, `at` and `z`, `width`, `drip`, `wet`) is water coming in at a
point on a wall. The export writes a marker on the wall's face; at level load the runtime finds the room's wall
pieces of that side and HSLeak puts the wet shader on them with its band: the wall wet only in a strip below the leak,
`width` wide at the top and nearly twice that at the floor as the water spreads, running in rivulets (a noise along
the wall), drying in patches toward the floor, dark and glossy (the damp's darkening and the roughness down: the
lamp's reflection lands in it through SSR), no pools and no rings. Drops fall from the top every `drip` seconds to
a ring on the floor (lifefx's drip, on its own node). The desk draws the band as a dark glossy strip on the wall's
face, the drips not. The demo wets the left wall from near its ceiling and measures the band's peak over the dry wall
and its mean under it (LOOKPLUGIN); TestRoom001's bath has its old leak on the west wall, and GDTESTROOM checks the
band's words on the wall and counts the drops.

## 3. Blood (`blood.gdshader`, `HSBlood`)

A splat drawn by the shader from a seed: a pool whose radius wanders with the angle (fbm, a few lobes), deep red in
the middle; satellite drops in a cell grid round it, elongated away from the pool as if flung; `drips` lanes running
down the quad's v for a splat on a wall, each ending in a bead. Wet it's glossy (roughness 0.08, specular 0.7: the
lights lie in it, overplayed on purpose); `dry` dulls it to brown (roughness 0.6); `opacity` fades it, which is how
the `clean` task scrubs it. In a game a `clean` stain of kind `blood` wears it on a quad over its block.

## 4. Rain (`rain.gdshader`, `HSRain`)

A MultiMesh of thin quads, each placed by the vertex shader from its custom data (its seat in the box, its phase)
and TIME: it falls at its own speed, wraps at the box's floor, leans and drifts with the wind, turns to the camera,
and fades near the eye (a drop a hand away would be a bar) and at the box's top and bottom. Additive, soft along and
across. No particle system to tick: a few hundred streaks in a room, a few thousand outdoors, two triangles each.
**Lit** (2026-10-29, later): a streak carries only a faint glow of its own (`strength`, as emission) and catches
every light that reaches it in the shader's `light()` (`lit`, the gain): the flashlight's beam fills with rain, a
lamp's cone over the yard shows the fall, the dark between them hardly any, the way rain is seen.
`follow` a node to keep the rain round the player outside.
**Splashes** (`splash.gdshader`, the rain's "Splashes" child, 2026-10-29): where the streaks land, on the box's floor,
a third as many seats as streaks, each a quad laid flat that every cycle (about two landings a second, each at its
own pace) shows what a real drop does under a lamp and nothing drawn: a glint the instant it lands, a faint wet sheen
a tenth of a second, and five tiny droplets thrown their own ways, out and gone within a third of a second (the first
version widened a thin ring and threw spikes, and the user's run read it as a cartoon: "we are aiming for realism not
stylization", 2026-10-29). The ripple itself is the wet floor's: `wet.gdshader` bends the water's normal in rings
per pixel (it had done so per vertex, which on a floor of eight vertices was nothing), so the lamp's reflection
wobbles where the drops land. Nothing beyond a few metres, where a splash is smaller than a pixel. The demo
shoots the floor with and without them and measures what they add (`splash_glow`, LOOKPLUGIN). `set_splashes(off)`
for a cheaper rain. In a game the shelf's rain is heard at the open room's middle from indoors and rides with the
player once they're in it (`rain_follow` in play.gd), and every step taken in that room is a wet one (`step_wet`,
on the desk too: steps.js).


**One box that rides with the player** (2026-10-29, night; GODOT_LOOK §7's "a rain that follows the player"): the
runtime makes one HSRain for the level, a dozen metres across and the open rooms' full height, moved to the eye's
x and z every tick (`rain_follow`); its drops keep seats on a world lattice the box's size (the shader's `follow`:
walking doesn't drag the rain along, the nearest copy of each seat is drawn), and only inside the open rooms (the
shader's `rooms_lo`/`rooms_hi`, up to eight world boxes: a drop over a roofed room isn't drawn; the splashes the
same). So a street needn't be one huge thin box, nor a box a room; the rain's sound stays one player a room, riding
with you indoors. GDTESTROOM checks the box at the eye, its one room box the yard's.

## 5. Wet and oiled skin (`skin_wet.gdshader`, `HSSkin`): HumanShaders implemented

HumanShaders' skin shader (MIT, MatMADNESS; GODOT_PLAN §2 is the plan for the Studio's look on it) is the base, kept
whole: Burley diffuse, Godot's skin SSS, the three-channel wrapped diffuse with the normal blurred per channel (its
better SSS), the lightwarp, translucency, micro detail, the double specular lobe. The studio's layer sits at the end
of its `fragment()` and in two lines of its `light()` (marked `HS`):

- **`wetness`**, the sweat film: the skin reads darker (×0.86), its roughness ×0.4, the specular up to 0.9;
- **`sweat`**, beads standing on the skin: cells over the UV (`sweat_scale` per UV unit), a dome in some
  (`sweat_size`), each a tilt on the normal map (steeper toward its rim) with roughness 0.03 on it: a glint per bead;
- **`drips`**, runs down the skin: lanes along u, a streak of some length from some start, wet inside;
- **`oil`**, oiled up: one tight gloss (roughness to `oil_roughness` 0.14, the second, wider lobe mixed out), the
  colour deeper (a gamma of 1.18 and a touch brighter). In `light()`, the base reflectivity rises to water's 4 % where
  the layer is glossy and the double lobe collapses to one.

**The story's word** (2026-10-29, STORY_FORMAT §9.8): `{"skin": "aoi", "wet": 0.7, "sweat": 0.5}` in a beat, a
cue or an answer's `do` puts it on her bodies (the stand-in's now, a scene's as it's made) and keeps it till set
again (`play.gd` `skin_set`, `skin_wet`); TestRoom001's kitchen has her sweating, GDTESTROOM checks it.

`HSSkin.material(albedo_texture, settings, tone)` wires HumanShaders' lightwarp, noise and micro-detail textures from
`res://HumanShaders/` and gives every sampler the shader reads a flat default (a flat normal, white maps), so a
sphere with no maps lights the same as a character missing one. `HSSkin.wear(node, settings)` puts it on a Studio
export's skin meshes (named skin, body, head, face; not the eyes, lashes, brows, hair, teeth), each keeping its baked
albedo.

**The Studio's eye** (`eye.gdshader`, `HSEye`; M_StudioEye's maths from `storykit/people.py`, eye.js's): the
export's eyeball carries its paint baked flat (Epic's layout) and, in its material's extras, `studioEye` (the shape:
the limbus, the cornea's dome, the iris's plane; the paint's numbers). `HSEye.wear(node, glb)` reads them from the
glb's own JSON (Godot's importer keeps no material extras) and puts the shader on each eye: the eye's point from the
UV and the shape, the view brought into the eye's frame through the mesh's tangent space (the export's tangents lie
along the eye's +x; **Godot's binormal runs the other way from three's and Unreal's: `handed` is −1**, found when the
pupil came out as a bar), bent at the dome by Snell's law onto the iris's plane, the iris read there, the white where
the point is, the limbus darker at a slant, the iris as a shallow bowl under the cornea's own normal on the clear
coat (the catchlights are the room's), no shine of its own under the glass. GDPEOPLE pictures the left eye close,
straight on and from 35° above, and the same slant with the cornea bending nothing (IOR 1): the pupil's centre lies
elsewhere (first run 1.3 px at 1280×720 with a 6° lens). Not measured yet: the same eye beside the Studio's own
render (the three.js side), which would also settle the sign of the picture's V by measurement rather than by the
bar.

**The Studio's character on it** (GDPEOPLE, `tools/godot/people_check.py`, `demo/people.gd`): a Character Studio
export (`People/<name>/export/<name>.glb`, STUDIO makes `_studiotest`) loaded in a Godot project of its own, its skin
mesh (`<name>_skin`, its paint baked on MHR's UVs) worn by HSSkin, its eyes on HSEye, pictured as a medium close-up: flat-lit under a
white ambient, where the picture's skin is measured against the export's own paint (the Studio's colours come across:
each channel within 0.7 to 1.6 of the paint and the hue kept within 25 %; first run 1.14, 1.19, 1.23, the 4 % of
specular ambient over the paint), then under a key and a rim dry, sweating (beads, the sheen, runs) and oiled.
Pictures in `Saved/Story/_look/godot_people/`. In a game, the export copies every cast member's `people/<name>` body
into `game/people/`, and **every baked body in a scene wears HSSkin** (`bakeplay.gd` `make_bodies`: the desk's MHR
bodies with their tone, a Studio export with its paint; GDTESTROOM checks Aoi's at station 1).

**The desk draws the same layer** (`tools/shared/skinwet.js`, 2026-10-29): the film, beads, drips and oil as here
(the same hashes and numbers), patched into three's standard material over the desk's clay MHR body, a Studio export's
skinLit skin and the figure of cylinders; the beads' domes bend the normal in a frame from the screen's derivatives
(no tangents on the desk's bodies), the layer's 4 % goes into skinlight.js's highlight (`swGloss`). `Stage.setSkin`
keeps what the run set per cast member and puts it on any body she's given later (a model switched, a new level);
Play's `skin` action and the Watch's `skin` cues call it. Out in the rain a cast member wets by herself on both
runtimes (`rain_wet` in play.gd, `rainWet` in runtime.js: toward 0.8 in a few seconds, dry again in about a minute
indoors), unless the story's word has set her (`by_word`): TestRoom001's Aoi at the front door is wet when you look
through the peephole. A sheet of the five states on the Studio's test export:
`Saved/Story/_look/desk_skin.png` (made by hand; TESTROOM checks the kitchen's beat lands on Aoi's body).

**Less plastic still** (2026-10-30, night, the user: "characters/npcs look more real and less like bright
plastic"): the flat defaults softened (roughness 0.62, specular 0.35, SSS 0.45; 0.55, 0.45, 0.35 before) and the
export's roughness map lifted by 1.4 (1.25). GDPEOPLE holds the lit face within 0.85 to 1.15 of the export's own
plain material under the same lights.

**The export's maps and numbers** (2026-10-30, the user: "why does it look so plastic and not detailed"): the
Character Studio's export carries three maps for the skin and Godot wore one. `HSSkin.wear` took the imported
material's albedo alone and gave the shader a flat normal and a white roughness map: every pore gone, one gloss
(0.55) everywhere on a smooth sculpt, the plastic look. Now it passes through what the glb carries: the Studio's
**relief** (its tangent-space normal map: pores, wrinkles, the nails' edges, in glTF's convention, so the shader's
`normal_gl` keeps its +Y and `normal_has_ao` off stops HumanShaders reading an occlusion out of its blue), the
**roughness** (the ORM's green: the oily T-zone, the matte cheeks, the lips; the shader's `roughness` set to 1 so
the map rules, lifted a quarter: the Studio's 0.3 to 0.4 on a young face read glossier under Godot's GGX than
under its own light) and **how thin the skin is** (the ORM's blue as the translucency map: the light through the ears
and nostrils), and the export's own `studioSkin` record (the glb's material extras, `HSSkin.records`): its
smoothness, falloff, specular, double lobe, translucency and wrap (as the SSS strength). The micro-detail tile
steps back to 0.15 under a real relief. The bake's plain body and the demo's spheres keep the flat defaults.
GDPEOPLE reports the maps worn and measures the relief: the lit face's grain with the normal map against the same
light with it flattened (`lit_smooth`), at least 1.08, when the map holds any relief (`_studiotest` has none set:
its map is flat, and the check says so instead).

## 5b. Mirrors (`mirror.gdshader`, `HSMirror`)

Chilla's Art's bathrooms have a mirror you can't not look in. Screen-space reflections can't give one (the room
behind the player is off screen), so the plugin does it the way games do: `HSMirror.attach(mesh, surface, camera)`
hangs a SubViewport of its own under the mirror's mesh with a second camera in it, and every frame the glass is in
view and the eye on its side, reflects the player's camera through the glass's plane (its middle and facing measured
from the surface's own triangles, area-weighted, the side settled by the mesh's normals) and renders the room into it
at 288 lines (its width by the window's aspect). The glass's shader doesn't read the picture by SCREEN_UV: it
projects each point of the glass through that camera's own view-projection (passed in each frame), so the texel is
the one that camera gave that point, and the parity, the angle and the frame come out right whatever the mirror's
shape and however it hangs. The second camera renders through a copy of the room's environment with a linear tone
map, no glow, no grade, and no screen-space reflections or indirect light of its own (a reflection needs none: the
second render costs half as much), so the glass's picture is tone-mapped once, by the main pass, like everything round it;
the reflection is unshaded (it carries its own light), with a tint and a faint dust film. The mirror itself and the wall it hangs on (the body a ray
finds just behind the glass) go on layer 20 alone, which the player's camera draws and the second camera doesn't: a
mirror never shows its own wall or itself (so one mirror's wall is missing from another's reflection: two mirrors in
one room is for later), and the camera's near plane sits at the glass's nearest corner, so what's beyond the wall
stays out. Out
of view the viewport stops drawing. In a game every kit `mirror` (a panel with its `kit_mirror` face) and every
prop tagged `mirror` gets one at the level's load (`mirror_attach` in play.gd; GDTESTROOM looks into the bath's).
The demo hangs one on its back wall and measures the bulb's glint in it (LOOKPLUGIN). The cost is a second render
of the room per mirror in view: keep mirrors to the rooms that need one; the pause menu's Reflections row switches
them off at Low (dull glass) and halves them at Medium (`set_quality`). Not yet: a mirror seen in a mirror.

**A mirror seen in a mirror** (2026-10-30, CONTINUE's second step): each mirror and its wall sit on a layer of their
own (11 to 19, the first free one; the tenth onward share 20), and a mirror's camera draws every layer but its own
(and the softener's 20), so another mirror's glass is in its picture with that mirror's last frame on it, a frame
late, and a mirror never draws itself (no reading the picture it's writing). Two bounces, not an endless hall: the
third would need a third render. The demo's mirror stage has a second mirror facing the first across the room and
measures the second's glass inside the first's picture: the room's bulb glints there, brighter than the wall beside
(LOOKPLUGIN); the bath's mirror in GDTESTROOM sits on its own layer.

## 5c. Hair on imported models (`hair.gdshader`, `HSHair`)

A Character Studio export's hair is the salon's cards (`hair_static`, a skinned mesh per swinging lock) with a
strand atlas whose alpha is its coverage, and its brows and lashes are strands the same way; a glb from anywhere
with card hair is the same shape. Godot imported them as plain StandardMaterial3Ds: lit like paper, no highlight
along the strands, hard-cut edges. `HSHair.wear(node, look)` puts the Studio's hair look
(`tools/character/hairshader.js`, the same maths) on every mesh whose name says hair, lash or brow (never the
scalp, a plain dark cap), each keeping its atlas and colour:

- **the tangent along the strand** from the card's UVs in the fragment shader (dP/dv from the screen derivatives:
  the glb carries no tangents, and the strands run along v), so Kajiya-Kay works on any card hair;
- **two highlights** from each of the scene's lights (`light()`): a tight white one and a broad one in the hair's
  colour, shifted apart along the strand (`shift1`, `shift2`), the roots in the strands' shade; a wrapped diffuse so
  a card's back isn't black; a rim; cards drawn from both sides, the normal flipped on the back;
- **soft edges** (`soft`): the coverage's cut feathered, the tips fading out, a card seen edge-on fading (no spikes
  in profile), as the salon's Soft edges; `cut` the coverage a pixel needs;
- **the retro look as toggles** (the story's `hair`, STORY_FORMAT §2, on the game or a cast member; the user's ask
  2026-10-30, the PSX dither for any model brought in): `flat` unlit (the atlas's colours, `gain`, whatever the
  light: ALBEDO zero and the colour as EMISSION), `steps` the colours in so many levels and `dither` the PSX's
  4x4 ordered dither between them in the screen's pixels, both in the screen's gamma as the Studio quantises its
  frame; `retro` is all three (flat, 8 steps, the dither). Lit (not flat) the steps and dither quantise the
  strands' colour before the light, so the banding is the hair's, not the room's: a spatial shader can't
  quantise its lit result.

Worn in play on every stand-in's body (`play.hair_look`: `game.hair` under the cast member's `hair`) and on a
scene's bodies (bakeplay). The demo's `hair` stage (LOOKPLUGIN): a sphere head under 240 cards made in code with
an atlas of 90 strands, pictured with the highlights off, lit, retro and stepped without the dither; the measures:
the lit crown band brighter than the dull one by 5% (24% measured), the stepped picture's colours over that band (at 6
bits a channel) under half the lit one's (265 against 1013), the dithered picture's grain there (the mean step between
neighbouring pixels) over the stepped one's by 1.3 (0.019 against 0.009; the dither's own colours under AgX and TAA
put the retro count at 419).
Not yet: the salon's inner colour and clump shades (the atlas's G and B channels are baked into the export's albedo
already). The dithered coverage under TAA came with the salon's bake (§5e); a file without it keeps the soft scissor.

## 5d. Skin that isn't a doll's: the detail at its true size (`textures/`, `HSSkin.set_detail`), DECISIONS 2026-10-30, night

The user's ask (their screenshot of a Studio character beside a sheet of MetaHuman faces): "make them look less like
dolls and more like Unreal's MetaHumans; the plugin's skin isn't a huge effect; really close up it looks more real but
the pores look way too large and not enough micro detail". They offered a Blender step after the Studio (procedural
skin with presets, baked) if that were the best way. **It isn't needed:** the finest detail can't be baked on MHR's
shared UVs at any size a game carries (a face's texel is 0.35 mm in the export's 2048 normal map, 0.175 in its 4096
paint; a pore's opening is 0.15 to 0.35 mm, the furrows between them 0.02 wide), so like MetaHuman's tiling micro
normal it's drawn live at its size, and what is the character's own (its occlusion) goes in the Studio's existing bake.
Nothing to run by hand: the Studio's Export and Godot do it.

**What made the doll** (measured on a fresh export, `tools/godot/portrait_check.py`'s "before" row, the sheet
`docs/godot_sheets/2026-10-30_skin_detail.jpg`):

1. **HumanShaders' micro tile at five times its size.** `micro_detail_scale` 30 was made for a head that fills its
   UVs; MHR's head spans 0.72 m of skin a UV unit (the body 1.9), so its 512 px tile lay 2.4 cm a repeat on the face
   and 5.7 cm on the shoulders: the coarse orange peel the user saw as "pores way too large".
2. **Godot's screen-space scattering blurring the whole colour.** HumanShaders sets `SSS_STRENGTH` to (strength × 2 +
   thinness × 2) × a dither of 0 to 3, about 1.3 to 3 within a metre of the eye; Godot blurs the finished colour (the
   paint and any detail with it), so the face read as wax and every pore went (the sheet's `sss` pictures: off, the
   game's Low, High).
3. **No colour unevenness, no occlusion.** The Studio's default look (soft cinematic: pores 0.04, evenness 0.7) bakes an
   even paint, and the export's ORM had no occlusion (its red was 1).
4. **Eyes that glow.** A painted white (sRGB 234) lit as a wet ball, with nothing of the lids' shadow on it.

**The detail layer** (`skin_wet.gdshader`'s `skin_detail` group, marked HS; `HSSkin.set_detail`; on by itself on a
Studio export, the bake's plain bodies and the demo's spheres keep it off):

- **Three tiles made once by `tools/skin_detail.py`** (seeded numpy; SKINDETAIL checks them), lossless with their mips
  (`.import` beside each: a normal map's RG compression would drop the cavity): `skin_pores.png` 10 mm of skin, about
  130 openings a cm², 0.15 mm across at the median and up to 0.4, each a pit in a shallow funnel; `skin_micro.png`
  5 mm, the furrows' network (cells 0.55 mm, finer ones 0.23 mm, wandering, fading in and out, a cushion in each cell:
  the pebbled look that survives at a few pixels a cell); both RG the normal (OpenGL's) and B the cavity;
  `skin_tone.png` 40 mm of the colour's unevenness (melanin's mottle and faint specks, the blood's patches, a grain).
- **Laid at their metres, twice:** each tile again turned 37° and 1.37 times larger, so the cheek gets 250 to 300
  pores a cm² (the reference's 310: docs/research/skin_v2.md §1) and nothing repeats; the scale from MHR's two
  densities (`uv_metres` 0.72 and 1.9), blended where the head's islands meet the body's (a scale changing across the
  skin would squeeze the pattern); a mip sharper than the pixel (the relief's glints survive; TAA settles them).
- **Placed by MHR's region map** (`mhr_skin_regions.png`, from MediaPipe's points on MHR:
  `Content/Studio/Bodies/MHR_landmarks.json`): R the pores (nose 1, the cheeks beside it 0.9, chin and forehead 0.75,
  the rest of the face 0.55, the body 0.3, the lids 0.1, the lips none), G the furrows (the lids' crepe most, the nose
  least), B the lips (their own lines: grooves a millimetre apart, wandering), A which density.
- **The normal from the UVs' screen derivatives** (no tangents: Godot's binormal sign on an imported glb didn't matter),
  full in the highlight, soft in the diffuse (HumanShaders' per-channel normals take 0.15, 0.4, 0.55 of it: the red
  travels furthest under the skin); a pit or a furrow darker (`detail_cavity`) and duller (its specular and a rougher
  floor); what's too fine to see once far turned into roughness (`detail_rough`), so a medium shot gets no pattern
  (GDPORTRAIT: the player's shot's grain 0.0034 against 0.0033 without; the cheek close up 0.0037 against 0.0017).
- **The colour's unevenness** (`tone`, `tone_red`): melanin darker and browner, the blood redder or paler, a grain;
  its mean the paint's own (the lit face 0.97 to 0.99 of the plain one).
- **A faint peach fuzz** (`fuzz`): a soft rim where the skin turns away, more from behind.
- **Presets** (`HSSkin.DETAIL_PRESETS`, the user's "old, young, normal"): `young`, `natural`, `adult`, `old`, each
  the pores' depth and size, the furrows', the cavity, the lips' lines, the roughness from afar, the fuzz, the tone,
  the scattering; picked from the export's own procedural skin (its `studioSkin` record now carries the Studio's
  `age`, `pores`, `poreSize`, `evenness`, `wrinkles`: seventy and over old, an adult's adult, a young even skin young,
  else natural) or named: `HSCharacterLook`'s **Skin Detail** (auto, the four, off) and **Detail Amount**,
  `set_detail(m, "old")`, the settings' `detail_preset`. **The Studio's own sliders ride on it** (`detail_look`): its
  Pores deepen or soften them (0.3, its default, as the preset; 0.04, the soft cinematic look's, two thirds), its Pore
  spacing sizes them (1.3 mm as the preset); and the Studio leaves its own pores out of the file's maps (a 0.35 mm
  texel only blurred them into the bumps the user saw as too big): they're Godot's now. The sheet (the presets as a
  character at the Studio's default pores gets them): `docs/godot_sheets/2026-10-30_skin_presets.jpg`.
- **The scattering kept gentle:** `sss_scale` (0.35 young to 0.25 old) scales HumanShaders' strength; the light still
  bleeds at a shadow's edge, the pores stay.

**The occlusion** (the Studio, `albedo.js` `bakeOcclusion`): depth maps of the body from 64 directions over the sphere
(an orthographic view of a sphere round it, one atlas of tiles), and again for the head in a sphere of its own at 512 px
a tile (0.65 mm a texel: the nostrils, the eyes' corners, the ears); every skin texel drawn flat at its UV and tested
against each map it faces (a cosine's weight; an occluder nearer than 9 cm counts fully, past 25 cm not at all, so the
far arm doesn't black the hip out), smoothed over a millimetre inside each island. It's the export's ORM red (and the
glb's occlusionTexture: the desk's three.js shades its ambient with it too); HSSkin wears it on the ambient light, a
third on the lamps' (`ao_block_light` 0.3: their shadows do the rest) and on the specular. An export from before this
has none, and nothing changes.

**The eyes** (`eye.gdshader`, HSEye): the lids' shadow as a falloff on the eyeball (`occlusion` 0.85: darker toward the
opening's edge, most under the upper lid; `opening` its half-width and height in eye units, 0.8 and 0.34; on the eye's
own frame, so a glance moves it a little), the cornea's reflections shut out there too, and the white's paint at 0.85
(`sclera_bright`). Found on the way: the eye layout's +y runs **down** the eye (a debug grid on an export).

**The check:** `python tools/godot/portrait_check.py [--person NAME]` (GDPORTRAIT): the export as the game wears it,
lit like a character reel (a big soft key from the side and above, a weak fill, a cool rim, a muted teal ground) at a
medium close-up, a close-up, an extreme close-up of the cheek (about 9 cm across) and the player's own medium shot
under a warm lamp, again with the layer off, measured (the cheek's grain over 1.25 times, the player's shot under 1.6
times, the brightness within 0.85 to 1.12) and sheeted (`Saved/Story/_look/godot_portrait/sheet.jpg`); `--plugin DIR`
pictures an older plugin for a before row, `--preset`, `--quick ecu,cu` for tuning, `--sss N` the scattering's quality.
GDPEOPLE still measures the eye and the colours.

**Not yet:** the eye's shadow fitted to each character's own opening (the skin's `extras.openings` outline is in the
file); wrinkle maps that deepen with the face's 72 shapes (MetaHuman's animated normals); the desk (it stays plain,
DECISIONS 2026-10-30, night); the clothes' fabric detail the same way.

## 5e. Hair MetaHuman's way: what the salon's bake carries and how Godot wears it (DECISIONS 2026-10-31)

The user's ask, after the skin: "making better hair that looks similar to Unreal's MetaHuman (if possible), probably a
shader/texture we need to bake when we do our current hair". What the hair looked like in Godot (the sheet
`docs/godot_sheets/2026-10-31_hair.jpg`, top row): near-black planks with hard card edges, stripes card to card (each
card lit by its own flat face), a white cap at the parting and the hairline, a black mass from behind, no strand detail
close up. docs/research/hair_cards_unreal.md (2026-10-24) had the recipe, for Unreal; it's built for Godot:

**The salon's bake writes** (`tools/character/salon.js` `buildBake`, `finishCards`; `hairvolume.js`):

- **Shell normals** (the biggest gain): every card vertex of the hairstyle splatted into a density grid (8 mm cells) with
  the head and body solid (the salon's collider), blurred over 12 mm; each vertex's normal becomes the volume's outward
  direction, 80% over its card's own face, so the cards shade as one soft mass, no stripes, both faces alike.
- **The tangent along each strand** (glTF's TANGENT, root to tip): the highlights run along the hair without guessing.
- **The second UV** (TEXCOORD_1): x across the card (its two edges 0 and 1, for the sides to taper), y the occlusion
  (twelve rays over the hemisphere round the shell normal marched 6 cm through the density: the inner layers, the roots
  and the underside darker; its most open tenth 1, the layers deep under the outside a quarter darker still).
- **Each strand's numbers** (`strandsTexture`, `hairshader.js`): the atlas's G (each strand's random number) and B (its
  clump's) in the material's **occlusion slot**, R a faint shade per strand (0.8 to 1): a plain viewer only darkens some
  strands' ambient a little. (The emissive slot was tried first: Godot's importer lights an emissive texture although
  glTF's emissive colour is black by default, and the hair glowed in rainbow colours wherever HSHair wasn't on.)
- **The record**: `studioHair` in the material's extras (what each slot and attribute holds) beside the salon's `look`.
- **Each card wound to face its shell normal** (`hairvolume.js` `wind`): a double-sided material turns a back face's
  normal round (three.js, Godot's StandardMaterial3D), and the cards wound into the hair lay dark under a plain viewer
  while the rest caught the room as a grey sheen (the Studio's view, until the fix; HSHair lights both faces by the
  vertex normal and never showed it). The plain material's roughness 0.55 (it was 0.42).
- **The darkened scalp's colour in its material** (its vertices white, carrying only its see-through), so a reader that
  drops an unlit material's vertex colours draws a dark cap, never a white one.
- The Character Studio's export keeps all of it (`exportRig`: a swinging lock's normals and tangents turned with it, no
  longer recomputed) and gives the **brows and lashes** names (`brows`, `lashes`, `lash_line`, `brow_fill`), their own
  strand numbers and records (their normals the cards' own: no volume for hairs lying on the skin).

**HSHair wears it** (`hair.gd` `records`, `set_bake`; `hair.gdshader`): `HSHair.wear(node, look, glb_path)` reads each hair
material's record from the file (the runtime's stand-ins, a scene's bodies, HSCharacterLook and the portrait pass the
path) and, where the bake is a volume, turns on `BAKED`: the **coverage dithered** pixel by pixel and frame by frame
(a per-pixel scissor threshold from interleaved gradient noise, the TAA averaging it into soft, see-through strands;
thickened 1.15), the **roots fading in** over 6% of the strand, the **card's own face** (from the screen derivatives, not
the shell) fading edge-on, the **card's sides tapering** over 45% of each half (a lock, not a plank), **two highlights**
shifted by each strand's own number with **glints** on some strands, the salon look's own highlight colours, glosses and
shifts, **light through the outer strands from behind** in the hair's colour squared, a soft **scatter** of the hair's
colour, the diffuse partly by the strand's angle to the light (Kajiya's), the **occlusion** in full on the diffuse, the
ambient and the highlights, the highlights 2.5 times the flat card's (`spec_gain`, tuned on the portrait: 4 washed the
colour out). Brows and lashes take the strand numbers and the look but keep the soft scissor (a lash a pixel wide
dithers away). The **darkened scalp and the brows' fill** get a material of their own (`scalp_material`: their colour by
vertex over the file's own colour, faintly lit): Godot's importer had left them white. A glb without the record (an
older export, a model from elsewhere) keeps §5c's look.

**Found on the way**: the plugin matched meshes by name, and a character whose name holds "hair" (the test's
`_hairbefore`) had the hair shader on its skin and eyes; now a Studio export's `<name>_skin` and `<name>_eye_*` are never
hair, and HSSkin takes `<name>_skin` whatever the name.

**The checks**: GDPORTRAIT's `--shots hair,hairecu` (the hair from behind and to one side; its strands close over the
ear) and its hair measures (the bake worn when the file carries one; the scalp in its own colour; the pores' close-up
hides the hair); HAIRVOLUME (`node tools/character/hairvolume_check.mjs`: a made-up head under two layers, the shell
normals out of the mass, the inner layer darker); GDPEOPLE hides the hair (it measures the skin's colour and the eyes).

**Not yet**: the salon's own live view still lights each card by its face (the bake's preview shows the shell); hair
that pierces the outer layer after a fall still shows as a card; flyaway strands at the silhouette; the shoulder's fan
of cards on a long cut is the hairstyle's own (it lies flat after the fall).

## 5f. Eyes that close, behind their lids, wet and not white paint (DECISIONS 2026-10-31, later)

The user's ask: "make sure the eyes don't clip through the eyelids ... make sure the eyes can close properly without
clipping ... make sure the eyes don't look like white paint and follow Unreal's MetaHuman inspired coloring and wetness
so the eyes look more natural in game". What there was: a Studio export **couldn't blink in Godot at all** (no morph
targets: bakeplay.gd's faces waited on "a body with morph targets"); the export rested the lids on the eyeballs at rest
(`lidsRest`), so open the file was clean (measured from five sides: nothing of the eye in front of a lid); the whites
rendered 1.3 to 1.8 times as bright as the skin under them, flat and neutral. The sheet, before and after (open, half
shut, shut, on `_skintest` with the add-on's brows and lashes): `docs/godot_sheets/2026-10-31_eyes.jpg`.

**The blink in the file** (`tools/character/index.html`: `blinkShapes`, `blinkTargets`, `meetLids`, `keepPoints`,
`sparseTargets`): MHR's `eyesClosed_L` and `eyesClosed_R` as morph targets by MHR's names on the skin, the lashes, the
lash line, the brows and the tear line, with their normals on the skin (the face's own surface shut, the lift left
out), made from MHR's points so the cut skin's corners follow them by their weights (moved one by one, the skin tore at
the cut's T-junctions):

- **The lids kept off the eyeball** in every state, as the desk keeps them (`tools/shared/face.js`): no point deeper into
  the eye than it rests (the white's sphere and the cornea's dome), a lid outside pushed out to the surface and 0.4 mm,
  then each triangle's middle raised where it still dips (a flat triangle over the cornea's bulge dipped 0.2 mm); a lash
  card moves with its root.
- **The lids meet**: MHR's shut lids leave 15 to 20% of the opening (the Studio shrinks its cut to nothing as they meet;
  the file's opening is cut out of the skin, and the eye showed through a slit), so over the blink's last quarter the
  cut's edge is taken to where the lids meet (along the lid, 35% of the way from the lower edge to the upper), by moving
  the points of the edge corners' triangles.
- **In-betweens**: a morph target moves each point on a straight line, and a lid's way over the round eye and its
  cornea is a curve (straight, it ran up to 0.7 mm into the cornea 60 to 90% shut). The way is kept at eight more
  weights (an eighth apart and a sixteenth before the end), each its own target (`eyesClosed_L_in1250` ...
  `_in9375`, its weight in ten-thousandths: what the lid lacks there over the straight line), set by its hat.
- **Sparse**: the blink's 36 targets move the corners round the eyes; written whole each was 1.6 MB, sparse (glTF's
  accessor without a buffer view, the moved points alone, `sparseTargets`) the file grows about a tenth.

**Godot** (`blink.gd`, `HSBlink`; `eye.gd`): `HSEye.wear` adds a blinker to a character whose export blinks. It sets the
blink and its in-betweens on every mesh that has them each frame: the larger of what's asked (`hold`, a scene's face:
bakeplay.gd hands it the bake's `eyesClosed` weights) and its own idle blink (every 2 to 6 s; shut in 70 ms, held 40,
open in 130; now and then twice). A picture turns `idle` off (`demo/portrait.gd --blink=W` holds it).

**The whites**: `sclera_bright` 0.58 (it was 0.85), `sclera_warm` 0.35 (a warm, slightly yellowed white, pinker toward
the corners: MetaHuman's sclera is never a neutral white), the lids' shadow at full (`occlusion` 1). Measured on the eyes'
close-up under the portrait grid's light: the white over the skin under the eye 0.83 to 0.96 (it was 1.3 to 1.8; the
MetaHuman references' 0.3 to 0.5 come with heavier lids over the eye). The socket's shade and the cornea's own coat and
catchlight (the eye's `light()`) are §5d's. (Since 2026-11-01 the ellipse is off under the wet layer, which shades by
the real lids, and the socket's shade is halved: §5g.)

**The tear line** (`tear.gdshader`): the Studio's wet strip along each lower lid, in the file now (`tearline_L`, `_R`,
its fade in the vertices' colour, `studioTear` its strength; the file's material wholly see-through, as glTF has no adding), drawn added over what's behind it, black itself: the
lights' and the room's glint along the lid (MetaHuman's lacrimal fluid). At the Studio's strength it read as a white
line in Godot's light (and at 0.45 of it): `gain` 0.2, roughness 0.2.

**What lies on the lids comes forward with them** (`liftWith`): the export brings the lids forward onto the eyeballs (up
to 3.9 mm) and the lashes, the lash line, the tear line and the brows stayed on the Studio's lids behind them; now each
point is lifted by the MHR point it rides (a lash card by its root's). (the add-on's strands, since removed, were moved back off
the lift before they were pinned.)

**EYELIDS** (`tools/godot/eyelids_check.py`): the file's skin and eyeballs drawn as depth from the front and four sides at
every twentieth of the blink, as Godot puts the targets together: nothing of the eye in front of a lid (at most
0.005 mm², 0.01 mm deep, on `_skintest`), open the eyes show, shut nothing of them from the front; then in Godot with the
eyeballs a flat green: open thousands of green pixels, held shut none; `blink.jpg` open, half and shut. A file with the grafted eyes (its skin's extras `eyeGraft`, CHARACTER_STUDIO §2c) is measured with its lining and its lids' backs on the eye left out (they face the eyeball and lie in it), a 2.5 mm reach and the lids' touch within 0.1 mm.

**Not yet**: the eyes don't turn in Godot (a glance, look-at); the Studio export carries only the blink of MHR's 72
shapes (bakeplay.gd sets the others on a body that has them); the lid has no thickness of its own (MetaHuman's waterline);
in the shut picture a lash clump at an inner corner and a fold at an outer corner want a look.

## 5g. The eye's wet layer, and eyes that aren't a black hole (`eye_wet.gdshader`; DECISIONS 2026-11-01)

The user's ask: "the eyes look kind of lifeless and scary, it doesn't seem like we are applying the eye wetness etc
correctly", without changing the exported eyes much. Measured on a fresh export with the grafted eyes (`_eyetest`, the
soft cinematic look and natural lashes; `portrait.gd --shots=eyes`, the subject's right eye): the iris read black
(its lower half 0.000, its top 0.001, though the baked paint is a clear brown), the whites a flat grey (0.14 to 0.48 of
the skin under the eye), and HumanShaders' eye wetness (`vshader_eye_wetness.tres`) wasn't used at all. The sheet,
before and after (the eyes, the close-up under the reel's light, the game's medium shot):
`docs/godot_sheets/2026-11-01_eyes.jpg`. Three causes, all on the Godot side:

- **The iris's bowl was upside down** (a bug): `eye.gdshader` took the bowl normal back to view space through BINORMAL
  with `handed` a second time, so the bowl tilted down where it should tilt up, and under a lamp above the lower
  half of the iris faced away from it. Fixed: the lower iris is now the bright side (the caustic: 1.6 to 1.7 times the
  middle under the portrait light).
- **The lids' shadow was a guessed ellipse** (`occlusion`, `opening` 0.8 × 0.34 eye units), smaller than the grafted
  eyes' opening: it blacked out the iris's top and bottom and greyed the white. It's off when the wet layer is on.
- **The white was greyed three times over**: the paint at 0.58, the socket's shade all over (0.35), the ellipse.

**The wet layer** (`eye_wet.gdshader`, each eyeball's `material_overlay`, put on by `HSEye.wear`: no new nodes, nothing in
the export): HumanShaders' eye wetness is a shell over the eye that shows the screen behind it blurred and darkened
toward the lids, its mask in the shell's vertex colours; MetaHuman's eye occlusion is the same idea. A Studio export has
no shell, so the layer finds the lids itself, in the depth buffer: the eyeball's shape is known exactly (the white's
sphere and the cornea's dome, from the record's shape, the radius from the mesh's bounds, the centre and axis worked
out per vertex from the mesh's own tangent frame, where the normals are exact: on the limbus ring the export averages
the sphere's and the dome's, and the vertex shader takes the average there), so wherever the depth buffer stands more
than `tolerance` (0.25 mm) in front of the eyeball's surface, or the eyeball isn't there, there's a lid. Along eight ways
out from each point the lid's distance is found by halving (no steps), and:

- **the rim**: dark against every lid (`shade` 0.6 at the lid, gone `reach` 1 mm in);
- **the upper lid's shadow** down the eye (`top_shade` 0.45, reaching 3 mm: `reach` × (1 + `reach_up` 2)), by its height above
  the point (the world's up as the screen sees it), softer (squared): the brow and the lid's overhang keep the light off;
- **warm**, not grey (`shadow_color`, HumanShaders' ShadowColor: the lids' skin bouncing its light in);
- **the lid's edge melted into the eye** (`soften` 0.3 mm: the screen read from a blurrier mip next to the lid, only when
  that's a pixel or more, so far away nothing blurs).

It follows the real lids in any pose: the grafted lids or MHR's, the blink (half shut, the shade comes down with the
lid), a squint, an eye turned. `wet_debug` 1 draws the rim red and the upper lid's shadow green. The layer sits 0.12 mm
off the eyeball (`lift`): over it, under the lids (0.4 mm off it), clear of a 24-bit depth's steps a few metres off.
`HSEye.wear(node, glb, {"wet": false})` leaves it off (and puts the ellipse back); `wet_*` overrides go to it.

**The white**: under the layer the socket's shade is halved (`WET_SOCKET` 0.5: its guess at the lids' shadow, darker all
over, is the real one now) and the white's light wraps past the terminator (`wrap` 0.3) in a warm, pinkish colour
(`scatter_color`, MetaHuman's sclera transmission), with a little of Godot's screen-space scattering on it (`sss` 0.3,
none on the iris; HumanShaders' eye 0.4, RoboPoets' 0.5). Measured against the skin under the eye: 0.94 to 1.04 in the
open middle beside the iris, 0.23 under the upper lid at the inner corner (it was 0.20 to 0.48 everywhere, flat).

**The catchlight**: crisp, `catch_size` 0.025 (0.08 spread a lamp into a soft blob, plastic; the cap still keeps a
pinpoint from blooming): one small dot per lamp, the same place in both eyes.

The tear line is as §5f left it (`gain` 0.2: a wet glint along the lower lid under the key light).

**Checks**: EYELIDS draws the eyeballs flat green with the layer off (`portrait.gd --eyes=mask` clears the overlay), so
its counts are what's drawn (on `_eyetest`: open 1874 and 56146 pixels, held shut none); GDPEOPLE's pupil still moves
with the cornea (7.7 px at the slant); GDPORTRAIT's skin measures are untouched. EYELIDS' file measure (numpy on the glb,
no plugin in it) fails on `_eyetest`, a new character with the grafted eyes: 0.315 mm² of the right eye in front of the
lower lid at 0.90 shut, seen from 20° below, 0.6 mm deep. That's the export's blink, left as it was here (the user asked
for the Godot side only).
**Not yet**: the eyes' own life (micro-saccades, a glance: the eyes don't turn in Godot yet, §5f) is the next lever after
the shading.

## 5d. Streets from the Blender bake (`street.gdshader`, `HSStreet`)

A street baked in Blender (`tools/street.py bake`, docs/STREET_TEXTURING.md) comes as plain glTF:
- each surface's finish as a tileable set at its real size (KHR_texture_transform), times its colour, with its ORM
  and normal maps;
- the street's wear atlas as its occlusion on UV2 (R the occlusion, G dirt, B rain streaks on walls and wet patches
  on what faces up, A worn edges);
- the wear's recipe in the material's extras (`hs_wear`: the dirt's, streaks' and edges' colours and amounts, the
  wet, the tone).

Godot 4.7 reads `texCoord: 1` as `ao_on_uv2` and keeps material extras as metadata (both tested), so without the
plugin the street already has its finishes and occlusion. The plugin's import step (`street_import.gd`, registered
by plugin.gd) makes each such material `street.gdshader` (`street_cut` for alpha MASK), which does the same sums as
Blender's "Street wear" group, so the game matches the render. `HSStreet.weather(node, amount)` scales the wear: 0
clean, 1 as baked, 2 twice as worn.

The import step also makes the **road paint and decals** cast no shadow of their own (`HSStreet.lay_flat`, by their
materials' names `street_paint*`, `street_glyph:*`, `street_decal:*`; DECISIONS 2026-10-31, late morning: "the print
on the road looks like it's floating"), the street builder's own .glb too.

GDSTREET with `--glb --plugin --shot` checks it: the street's colliders after Blender, the surfaces on the street
shader, the paint and decals shadowless, a picture through the street's shot.

## 6. The story's words, and the check

- `game.look`: `realism` (the default) or `plain` (STORY_FORMAT §9.1); `game.weather`: `rain` puts HSRain over every
  room with no `ceiling` (its size, 25 streaks a square metre, at most 2500), wets its floor with pools and ripples
  (`HSWet.wet_floors`), and plays the shelf's rain there; a `clean` stain of kind `blood` wears HSBlood.
  TestRoom001 wears both (its yard rains; the chores room's second stain is blood); GDTESTROOM checks them at
  stations 1 and 7.
- `game.hair` and a cast member's `hair` (§5c): the hair look on imported models' hair; the check knows the words
  and their ranges (`check_hair`).
- `game.grade` (§1d): the grade's preset or numbers; `cinema` when unset, `none` for the plain picture.
- **LOOKPLUGIN** (`tools/godot/plugin_check.py`): the demo (`demo/demo.gd`) in a project of its own under xvfb:
  a room with a lamp (its bulb emissive, so it has something to reflect), a cool fill, a table and a glossy cabinet;
  pictured plain, with the realism preset, with the floor wet, with blood (on the floor, up the wall) and rain, and
  with three skin spheres (dry; wet, sweating and dripping; oiled). The measures (`report.json`): the lamp's
  reflection region brighter wet than dry; the preset changing the picture; the blood's red pixels; the rain moving
  between two frames; the sweat's peak brighter than dry skin; the oil's glint from the fill light brighter than the
  same region on dry skin. First run 2026-10-29 (lavapipe): wet 0.514 against dry 0.444 in the lamp's region; rain
  motion 0.008; blood 1923 red pixels; sweat peak 1.0 against 0.76; the oil's glint 0.68 against 0.48.

## 7. What's left

- The characters: ~~the Studio's paint and eye measured beside the Studio's own render~~ (GDSTUDIO, 2026-10-29,
  night: `tools/godot/studio_compare.py` pictures the character from the Studio's own view under its studio and
  reference lights and beside Godot's lit, flat and eye pictures, and measures the face's skin colour as ratios in
  both: for `lol`, red over green 1.27 in the Studio and 1.23 in Godot, blue over green 0.85 and 0.86); ~~the skin's
  own light (studioSkin's numbers) onto HSSkin's sliders~~ (2026-10-30, §5, with the export's normal and ORM maps);
  ~~skin that reads as a doll's: pores five times too big, wax from the scattering, no occlusion~~ (2026-10-30, night:
  §5d, the detail layer at its true size, the Studio's occlusion, the eyes' lid shadow); still open: the eye's colour
  measured close in both, the eye's shadow fitted to each opening, and the clothes' maps (albedo only so far);
  ~~hair as planks with a white cap~~ (2026-10-31, §5e: the salon's bake as a volume, worn MetaHuman's way).
- ~~Wet walls under a leak~~ (§2b, 2026-10-30); ~~a mirror seen in a mirror~~ (§5b, 2026-10-30).
- Seen by the user (2026-10-29): a square patch of light under a distant counter that goes when you come close.
  Most likely a VoxelGI cell at its coarse distance (the per-room probes meet at the counter), else the SSIL at a
  distance. To look at with a card: picture it from far and near, flip GI and SSIL off in the menu, see which goes.
- A `look` per scene (a level has its own since 2026-10-29, night: STORY_FORMAT §2; a scene's `look` is its look-at, so a per-scene preset would want another word).
