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

## 1. The preset: pseudo-realism for small rooms (`look.gd`, `HSLook`)

What sells a small greybox room as real isn't detail, it's *soft light with bounce, contact darkening, and surfaces
that answer the lights* (BLENDER_LOOK §1 on the user's references). The games are a few rooms at a time, so the
screen-space effects that a big scene can't afford are cheap here, and they're turned up:

| Setting | Realism | Why |
|---|---|---|
| Anti-aliasing | **TAA**, no MSAA, no FXAA; debanding on | TAA settles the reflections' and the specular's shimmer. **MSAA switches screen-space reflections off in 4.7** (measured in the check: a mirror floor went black with 2x MSAA, reflected with it off), so it's TAA alone. The player can pick Off, FXAA, TAA or TSR (TAA with FSR 2) in the pause menu; TAA is the default |
| Tonemap | AgX, exposure 1.2 | the filmic curve with the best colour under coloured lights (the warm bulb, the blue night); 1.2 because AgX sits darker than Filmic at 1.0 |
| SSR | on, 128 steps, fade in 0.15, out 2.0, tolerance 0.2 | the overplayed reflections: wet floors, blood, the glossy cabinet, the glass-skin faces carry the lights and the room. 128 steps so the lamp across the room still lands in the puddle under it |
| SSAO | radius 1.0, intensity 2.5, power 1.5 | the corners and the feet of things; GODOT_PLAN §4's trial found it does more for a greybox than any GI |
| Light shafts | density 0.3 (0.5 until 2026-10-30), full by day, 0.6 at dusk, 0.25 at night, the box fading from its middle toward the floor and ceiling | a window's beam in the haze (§1c). At night in a dark room a box of lit fog read as a bright rectangle on the floor, its foot drawn crisp by the froxel grid and shifting as the eye moved (the user's pictures, 2026-10-30) |
| SSIL | radius 1.2, intensity 0.45 (2.5 and 1.2 until 2026-10-30) | a little of the practicals' colour bleeding onto nearby walls over the VoxelGI's bounce. Pared back after the user's "bright gaps on the floor that disappear as I move and look": it's screen-space, so what it bleeds depends on what's in view, and at 1.2 it painted patches that came and went with the eye |
| Glow | soft light, intensity 0.55, threshold 1.05, levels 3 and 5 | the bulbs and the screens bloom a little; soft light keeps the mids from washing |
| Haze | volumetric fog, density 0.012, anisotropy 0.55 | the thin air of a dark house: light beams through doorways, the far end of a corridor softer |
| Grade | contrast 1.08, saturation 1.04 | pushed a touch past neutral, under the tape (UltraVHS) when the game wears it |
| GI | the export's VoxelGI per room (baked at the first load, cached) | GODOT_PLAN §4: SDFGI and one big VoxelGI miss 10 cm walls |

LightmapGI stays out: its `bake()` is editor-only in 4.7 (no such method from a script; measured 2026-10-29 with a probe
under xvfb), so an export's light can't be baked headless where the checks run. The VoxelGI per room is the baked GI.

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
the mirrors (§5b) and, since that evening, **a ReflectionProbe per room** (the kit's one Box Reflection Capture a
room: the export writes one beside each room's VoxelGI, box-projected, interior, updated once), so metal and glossy
things reflect their room where the screen-space reflections can't reach.

**Light shafts** (`shaft.gd`, `HSShaft`, `shaft.gdshader`; after Light Kit's Window shaft card, 2026-10-29): the beam a
window throws into a room, dust drifting in it. The realism preset's haze is Godot's volumetric fog, and every light
lights it, so a window's spot already makes a faint beam; a window with `shaft` (STORY_FORMAT §2) gets a FogVolume
box laid along its light (the glass's width and height, `reach` metres into the room) whose fog shader thickens the
haze inside the beam, full at the window and fading along it and at its sides, with the dust as slow clumps sinking
through it (Light Kit's motes, the same sin product), and the window's spot has its volumetric energy raised so the
beam shows, the frame's shadow cut into it by the light's own shadow map. Nothing drawn by hand: the renderer's fog
carries the light, so the beam is right from every angle. Effects Low turns the haze off and the shafts with it.
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
Not yet: a hashed alpha under TAA for softer edges (the plain scissor keeps the headless pictures measurable), the
salon's inner colour and clump shades (the atlas's G and B channels are baked into the export's albedo already).

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
  still open: the eye's colour measured close in both, and the clothes' maps (albedo only so far).
- ~~Wet walls under a leak~~ (§2b, 2026-10-30); ~~a mirror seen in a mirror~~ (§5b, 2026-10-30).
- Seen by the user (2026-10-29): a square patch of light under a distant counter that goes when you come close.
  Most likely a VoxelGI cell at its coarse distance (the per-room probes meet at the counter), else the SSIL at a
  distance. To look at with a card: picture it from far and near, flip GI and SSIL off in the menu, see which goes.
- A `look` per scene (a level has its own since 2026-10-29, night: STORY_FORMAT §2; a scene's `look` is its look-at, so a per-scene preset would want another word).
