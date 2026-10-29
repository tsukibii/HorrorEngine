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
| SSIL | radius 2.5, intensity 1.2 | the practicals' colour bleeding onto nearby walls (a warm lamp on a wall) over the VoxelGI's bounce |
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
own pace) flashes a point, widens a thin ring that fades as it grows (6 cm at its widest) and throws a few spikes up
round it; additive and unshaded, so on the wet floor they read as glints, on a dry one as a faint stipple. The demo
shoots the floor with and without them and measures what they add (`splash_glow`, LOOKPLUGIN). `set_splashes(off)`
for a cheaper rain. In a game the shelf's rain is heard at the open room's middle from indoors and rides with the
player once they're in it (`rain_follow` in play.gd), and every step taken in that room is a wet one (`step_wet`,
on the desk too: steps.js).


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

## 6. The story's words, and the check

- `game.look`: `realism` (the default) or `plain` (STORY_FORMAT §9.1); `game.weather`: `rain` puts HSRain over every
  room with no `ceiling` (its size, 25 streaks a square metre, at most 2500), wets its floor with pools and ripples
  (`HSWet.wet_floors`), and plays the shelf's rain there; a `clean` stain of kind `blood` wears HSBlood.
  TestRoom001 wears both (its yard rains; the chores room's second stain is blood); GDTESTROOM checks them at
  stations 1 and 7.
- **LOOKPLUGIN** (`tools/godot/plugin_check.py`): the demo (`demo/demo.gd`) in a project of its own under xvfb:
  a room with a lamp (its bulb emissive, so it has something to reflect), a cool fill, a table and a glossy cabinet;
  pictured plain, with the realism preset, with the floor wet, with blood (on the floor, up the wall) and rain, and
  with three skin spheres (dry; wet, sweating and dripping; oiled). The measures (`report.json`): the lamp's
  reflection region brighter wet than dry; the preset changing the picture; the blood's red pixels; the rain moving
  between two frames; the sweat's peak brighter than dry skin; the oil's glint from the fill light brighter than the
  same region on dry skin. First run 2026-10-29 (lavapipe): wet 0.514 against dry 0.444 in the lamp's region; rain
  motion 0.008; blood 1923 red pixels; sweat peak 1.0 against 0.76; the oil's glint 0.68 against 0.48.

## 7. What's left

- The characters: the Studio's paint and eye measured beside the Studio's own render (the three.js side), not only
  against the baked texture and by the pupil's shift; the skin's own light (studioSkin: the Unreal side's
  M_StudioSkin numbers) onto HSSkin's sliders.
- Wet walls under a leak; a mirror seen in a mirror.
- Seen by the user (2026-10-29): a square patch of light under a distant counter that goes when you come close.
  Most likely a VoxelGI cell at its coarse distance (the per-room probes meet at the counter), else the SSIL at a
  distance. To look at with a card: picture it from far and near, flip GI and SSIL off in the menu, see which goes.
- A rain that follows the player outdoors through a level (today each open room has its own box).
- A `look` per level or scene (today the game's).
