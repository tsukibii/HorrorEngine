# The look in Godot: the HorrorStudio Look plugin

Written 2026-10-29 on `godot-support`, from the user's ask that afternoon: "the shades we made for rain reflections,
rain, reflective materials inspired by Chilla's Art ported to Godot; a default anti-aliasing and the most aesthetic
settings for pseudo realism (baked lighting with overplayed effects like blood and reflective surfaces to trick the
brain; our games are small); a realistic sweaty wet skin shader, and oiled up; the HumanShaders repo implemented;
our own plugins kept in a folder that gets passed in, not inside the exported projects".

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

`plain` is everything off (Filmic, no AA, no effects): a look at the geometry.

## 2. Wet surfaces (`wet.gdshader`, `HSWet`)

Light Kit's Puddle (UnrealPlugins/LightKit): "one irregular puddle, deep and mirror-smooth in the middle, damp at
the edge; the reflections are the level's own, so lights smear across it as you walk". In Godot: a floor's material
swapped for the wet shader keeping its colour, texture and roughness. The damp darkens the whole floor (×0.55) and
tightens its highlight (roughness ×0.45); pools lie where a world-space fbm dips (`puddles` moves the threshold,
`puddle_scale` the pools' size), each mirror-smooth (roughness 0.035, specular 0.9, the colour the water's tint over
the dark floor) with a damp rim just outside its edge; `ripples` puts rain on them: a grid of cells, a drop every
1.2 to 2.8 s in each, its ring growing and fading, as a gradient on the normal. SSR does the reflecting (§1), so the
lamp, the cabinet and the walls lie in the pools and slide as the eye moves.

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
`follow` a node to keep the rain round the player outside.

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

`HSSkin.material(albedo_texture, settings, tone)` wires HumanShaders' lightwarp, noise and micro-detail textures from
`res://HumanShaders/` and gives every sampler the shader reads a flat default (a flat normal, white maps), so a
sphere with no maps lights the same as a character missing one. `HSSkin.wear(node, settings)` puts it on a Studio
export's skin meshes (named skin, body, head, face; not the eyes, lashes, brows, hair, teeth), each keeping its baked
albedo. **The Studio's character on it** (the eye's refraction, the paint's patterns, the side-by-side measure of
GODOT_PLAN §2) is the next step: it waits on a Studio export (STUDIO makes `People/_studiotest`; see CONTINUE §0).

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

- The characters: the Studio's export on HSSkin with the eye's refraction and the paint (GODOT_PLAN §2), measured
  beside the Studio.
- Puddles as decals for any surface (`Decal` with ORM: a ready-made in `HSWet` next), wet walls (rain running down
  glass: the window shader), splashes where the streaks land.
- A rain that follows the player outdoors through a level (today each open room has its own box).
- The tape's ghosting (a last-frame viewport), listed in GODOT_EXPORT §8.
- A `look` per level or scene (today the game's).
