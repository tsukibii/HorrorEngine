# HorrorStudio Look: notes for Claude

The studio's own Godot plugin: the look (docs/GODOT_LOOK.md has the numbers and the measures). It lives here, not
in the exports: `storykit/godot.py` copies `addons/horrorstudio_look/` into every game's project, and the runtime
add-on (`tools/godot/addons/horrorstudio`) uses it by its classes (`HSLook`, `HSWet`, `HSBlood`, `HSRain`, `HSSkin`,
the VHS layer in `main.tscn`, `puff.gdshader` from lifefx.gd). A change here reaches every game on its next export.

## Map

| File | What |
|---|---|
| `look.gd` | the presets as one dictionary each (`PRESETS`: `balanced` the default, `realism`, `plain`): the viewport's anti-aliasing and the environment's effects; `PROJECT` the balanced look's project settings (`apply_project`; the export's `PROJECT_LOOK` in storykit/godot.py is the same, GDEXPORT reads them back); `apply`, `set_aa`, `shadows` (the filter and atlas), `iris` (auto exposure, a stop under at night) |
| `plugin.gd` | registers HSLookEnvironment and the street's import step (`street_import.gd`); applies `HSLook.PROJECT` the first time it's enabled in a project (`horrorstudio/look/settings_applied`) and from Project > Tools |
| `street.gd`, `street.gdshader`, `street_cut.gdshader`, `street.gdshaderinc`, `street_import.gd` | **a street from the Blender bake** (docs/STREET_TEXTURING.md §3): the .glb is plain glTF (each finish's tileable set at its size times the colour, ORM, normal; the street's wear atlas as the occlusion on UV2; the wear's recipe in extras `hs_wear`); `street_import.gd` (an EditorScenePostImportPlugin, editor only) runs `HSStreet.apply` on every imported scene: each such material becomes the street shader, the same sums as Blender's "Street wear" group (dirt, streaks on walls, wet patches on what faces up, worn edges, a slow tone; `_cut` for MASK alpha); `HSStreet.weather(node, amount)` scales the wear at run time; `lay_flat` (the import step too) makes road paint and decals cast no shadow (by their materials' names `street_paint*`, `street_glyph:*`, `street_decal:*`; the street builder's own .glb too). Checked by GDSTREET `--glb --plugin` and STREETBAKE `--godot` |
| `post.gd`, `post.gdshader` | the grade: `HSPost` a CanvasLayer (6) with a full-screen shader reading the screen (three-way lift/gamma/gain, warmth, saturation, contrast, fade, vignette, grain, aberration); `PRESETS` the looks, `apply` the story's `game.grade` |
| `vhs.gd`, `vhs.gdshader`, `vhs_hold.gdshader` | UltraVHS: the presets as dictionaries of the shader's uniforms (`CAMCORDER` the base), the layer's node; the history viewport (the last frame copied by `vhs_hold`) for the ghosting |
| `pattern.gd`, `pattern.gdshader` | a light's pattern: `HSPattern` a SubViewport under a SpotLight3D drawing caustics, leaves, blinds or clouds (Light Kit's four light functions in GLSL, `metres` the viewport's width on the aimed surface) and set as its `light_projector` |
| `shaft.gd`, `shaft_card.gdshader` | a light shaft: `HSShaft` a card in the window's beam box (two crossed planes, five slices, a surface each with its share), added, the fades from the box's own space (`box_size`), each plane fading edge-on; the FogVolume node kept with empty fog (`shaft.gdshader` is the old fog shader, unused) |
| `sweep.gd` | a headlight sweep: `HSSweep` a SpotLight3D slid along the street outside a window on a clock and a seed, or fired |
| `puff.gdshader` | the little things' puffs (lifefx.gd makes the MultiMesh) |
| `wet.gd`, `wet.gdshader` | wet floors: the pool mask (fbm in world space), the rings (a grid of drops per cell, their age from TIME, bent into the normal per pixel); `puddle` a Decal with maps made in code |
| `leak.gd` | water down a wall: `HSLeak` puts the wet shader's band (`band_*` uniforms: a strip below the leak, spreading, in rivulets) on the wall's meshes and drops the drips |
| `glass.gd`, `glass.gdshader` | window panes: the drops (cells with a drop sliding down, beads above it, a mist) as a slope bending the screen behind |
| `blood.gd`, `blood.gdshader` | the splat (the pool's radius by angle, satellite drops in a cell grid, drips in lanes) |
| `rain.gd`, `rain.gdshader`, `splash.gdshader` | the streaks (a MultiMesh of quads; the vertex shader places each from its custom data and TIME; lit in `light()` by every light that reaches them) and the splashes where they land (a second MultiMesh under the rain: a glint, a sheen and thrown droplets from a seat and a phase; no ring) |
| `mirror.gd`, `mirror.gdshader` | a real mirror: `HSMirror` reflects the camera through the glass's plane (its middle and facing measured from the surface's triangles; a closed block's thin axis, the side toward the eye) into a SubViewport each frame it's in view, the shader projecting each point of the glass through that camera's view-projection; each mirror and its wall on a layer of their own (11 to 19: a mirror seen in a mirror shows its last frame, never itself); `set_quality` for the menu |
| `eye.gd`, `eye.gdshader` | the Studio's eye (people.py's `_FRAME` and `EYE_COLOR` in GLSL; `handed` −1 for Godot's binormal; the lids' shadow `occlusion` on the eye's frame, whose +y runs down the eye, `sclera_bright` 0.58 and `sclera_warm`: GODOT_LOOK §5d, §5f; the socket's shade; `light()`: the cornea's coat and the white's shine as capped GGX lobes, the iris's diffuse on its bowl); `records` reads the glb's JSON chunk for `studioEye` (and `studioTear`); `wear` puts the tear line on and adds the blinker |
| `blink.gd` | `HSBlink`: a Studio export's blink (GODOT_LOOK §5f): `eyesClosed_L`/`_R` and their in-betweens (`_in<weight in ten-thousandths>`, each by its hat) on every mesh that has them; the idle blink, `hold` (bakeplay.gd's faces); pictures turn `idle` off |
| `tear.gdshader` | the tear line: blend_add, black, glossy, the vertices' colour its fade (the file's material wholly see-through: glTF has no adding), `strength` (the export's) times `gain` |
| `hair_fine.gdshader`, `hair.gdshaderinc` | the hair shader's body shared (`hair.gdshader` includes it); `hair_fine` (`HS_FINE`) draws fine hairs (the brows and lashes by hand, the lash line) at blended coverage, so a hair a pixel wide never dithers away; `hair.gd` picks it by name with a coverage gain each (`FINE_GAIN`) |
| `hair.gd`, `hair.gdshader` | the Studio's hair look (hairshader.js's Kajiya-Kay and retro maths) on imported card hair: `HSHair.wear` by mesh name (hair, lash, brow; never `<name>_skin`, `_eye_`, the scalp or `brow_fill`); the tangent from the UVs' screen derivatives in `fragment()`, the highlights in `light()`, the retro quantisation on the albedo (lit) or the emission (flat); **the salon's bake** (GODOT_LOOK §5e): `records` (the glb's `look` and `studioHair`), `set_bake` (the strand numbers from the occlusion slot, `tangent_along`, `shell_normals`, `baked_occlusion`, `BAKED`'s dithered coverage and the rest, only on a shell-normal bake), `scalp_material` (the scalp and the brows' fill by vertex colour over the file's colour) |
| `skin.gd`, `skin_wet.gdshader` | HumanShaders' skin shader with the wetness layer (the lines marked `HS`: the wet layer, `normal_gl` and `normal_has_ao` for a glTF normal map, the detail layer, `sss_scale`, the depth layer and its share of each lamp's diffuse in `light()`); `skin.gd` wires HumanShaders' textures and flat defaults, and a Studio export's normal, ORM and occlusion maps and `studioSkin` record (`set_maps`, `records`); **the detail layer** (GODOT_LOOK §5d: `set_detail`, `DETAIL_PRESETS`, `detail_preset` from the record's age and pores), on by itself on a Studio export; **the depth layer** (GODOT_LOOK §5g: `set_depth`, warm light from under the skin round the eyes, the nose, the mouth and the ears by MHR's depth map; the record's `depth` and `ears`, the Studio's Skin light; the ears' switch takes the lamps' translucency through them too) |
| `textures/` | the detail layer's tiles, MHR's region map and its depth map (`mhr_skin_depth.png`: the eyes, the nose, the ears, the mouth), made by `tools/skin_detail.py` (never by hand: change the script and run it; SKINDETAIL checks them), each with an `.import` that keeps it lossless with its mips (a normal map's RG compression would drop the cavity in B) |
| `flicker.gd` | `HSFlicker`: a light's flicker by mode (fluorescent, dying, candle, pulse, custom letters), the desk's `tools/shared/flicker.js` curves; play.gd drives the story's lights with it (moved here from the runtime add-on 2026-10-30, for the nodes) |
| `nodes/` | **the effects as nodes** (GODOT_LOOK §0): `@tool` classes with an icon each (`icons/`) wrapping the pieces above: `HSRainBox`, `HSPuddle`, `HSBloodSplat`, `HSLightShaft` (the window's rectangle sheared along the sun: the card's transform), `HSHeadlightSweep` (make their own children, never owned, never saved); `on_mesh.gd` (`HSOnMesh`: a node under a mesh that changes its material and puts it back before a save and when removed) with `HSWetSurface`, `HSWindowPane`, `HSWallLeak`; `HSFlickerLight`/`HSFlickerSpot` (`flicker_drive.gd`: the Energy is the full light, saved at full; `on_mains` the group `hs_mains` play.gd's power cut switches), `HSPatternLight` (the projector cleared before a save); `HSMirrorSurface`, `HSCharacterLook`, `HSGrade`, `HSTape` (the game's; the grade and tape over the game's own, put back when they go); `HSLiquidFill` (liquid.gd + liquid.gdshaderinc, liquid.gdshader opaque, liquid_clear.gdshader see-through: a container's inside cut at a level held flat in the world from the prop generator's fill table, its back faces the surface, a spring for the slosh; docs/PROPGEN.md §10); `HSPropFX` (`prop_fx.gd` + `flame.gdshader`: a made prop's enhancers from its glb's `propgen_fx`, each a switch: glow (its emission map's materials, a per-instance override), flame (the flame billboard and an `HSFlickerLight` in candle mode at each flame socket), smoke and steam (puff.gdshader MultiMeshes, top_level, at their sockets), wax (subsurface and backlight); its materials back before a save; `auto(root)` from game.gd's enter_level; `horrorstudio/prop_fx/*` the project's switches, registered by plugin.gd; checked by GDPROPS, docs/PROPGEN.md §14) |
| `nodes/light_zone.gd` | `HSLightZone`: a box owning the lights inside it; its meshes on a render layer of its own (2 to 10, touching zones apart), its lights' cull mask that layer, layer 1 and 11 to 20; their range fitted; off while unseen in the game; `show_light` composes a light's own visibility, the power (play.gd's mains) and the zone; all put back before a save |
| `presets/` | the ready-made nodes as scenes to drag in (40, the room_* zones and look_balanced among them): written as text by `demo/make_presets.py`, each a node of `nodes/` with its numbers |
| `demo/demo.gd` | the demo scene and the measures (`report.json`) |
| `demo/nodes.gd` | every preset in a room, each measured, a save as the editor does it (`nodes.json`, `nodes.png`) |
| `demo/window.gd` | the window sun in a wall's opening (from the room, `--view=side` from the side): the beam from the glass, parallel, to the floor; its light aimed (`window.json`) |
| `demo/zones.gd` | two rooms with a doorway, room_bulb and room_lamp: the layers, the fitted reach, the bulb kept to its room (the next floor no brighter), the lamp off unseen, a save (`zones.json`, `zones.png`) |
| `demo/editor_test.gd`, `demo/editor_scene.tscn` | the nodes in the editor itself: the check installs the script as a plugin, it opens the scene, sees the nodes working, saves; the check reads the file |
| `demo/people.gd` | a Character Studio export on HSSkin: flat-lit against its paint, lit dry, sweating, oiled (`people.json`) |
| `demo/portrait.gd` | a Character Studio export as a portrait (a character reel's light, the game's lamp; a medium close-up, a close-up, the cheek's pores (the hair hidden), the player's shot; `--shots hair,hairecu` the hair from behind and its strands close; `--shots front,eyes` the eyes under a portrait grid's light; `--hair=JSON`, `--eye=JSON` the numbers tried; `--blink=W` the eyes held that far shut, `--eyes=mask` the eyeballs flat green and counted, `--hide=WORDS` meshes left out; the depth layer: `--depth=N`, `--ears=off`, `--depthlook=JSON`, `--light=baked` a baked level's light (the ambient alone), the `side` shot (the ear), `--probe=JSON` points on the skin by UV measured in each shot), with or without the detail layer; the hair's measures (`portrait.json`; `tools/godot/portrait_check.py`, GDPORTRAIT; `tools/godot/eyelids_check.py`, EYELIDS) |

## Checking it

- `python tools/godot/plugin_check.py` (LOOKPLUGIN): the demo in a project of its own under Xvfb (on the card too:
  Vulkan draws there, and no window manager resizes the window; the check prints the renderer and fails if Godot
  fell back to OpenGL; `--fixed-fps 60`, so a stage's frames are the same seconds everywhere), each part pictured
  into `Saved/Story/_look/godot_plugin/` and measured: the lamp's reflection in the wet floor brighter than in the
  dry, the rain moving between frames, the splashes' glow on the floor, the mirror's glint, the blood's red, the
  sweat's glint and the oil's glint over dry skin. `--only=<stage>` runs one stage alone for a quick look. Look at
  the pictures after a change, not only the numbers.
- `python tools/godot/people_check.py` (GDPEOPLE): a Studio export's skin on HSSkin, its colour against its paint.
- `python tools/godot/portrait_check.py` (GDPORTRAIT): the same export as a portrait at four distances, the detail
  layer on and off: the cheek's grain close up, no pattern at the player's shot, no change of brightness; the sheet.
  Then the depth layer off, on and its ears off under a baked level's light: round the eyes and the nose warmer, the
  ear warmer and back with its switch off, the cheek as it was; `depth_sheet.jpg`.
  Look at the sheet after any change to the skin, not only the numbers.
- `python tools/godot/eyelids_check.py` (EYELIDS): a Studio export's eyes behind its lids at every twentieth of the
  blink from five sides (the file's depth), shut nothing of them; in Godot open the eyes drawn, held shut none.
- `python tools/godot/look_check.py` (GODOTLOOK): the tape against UltraVHS's numpy reference.
- `python tools/godot_export.py --game TestRoom001 --testroom` (GDTESTROOM): the yard's rain and wet floor, the blood
  stain's splat, in the game.
- `python tools/godot/street_check.py --glb PATH --plugin --shot ID` (GDSTREET on a Blender bake's .glb): the plugin
  enabled in a fresh project, its import step must make the street's surfaces the street shader and the paint and
  decals shadowless; pictured through a shot. Run it after any change to plugin.gd: a script that fails to compile there takes the whole plugin down.

## Rules

- **A node saves only its numbers.** What a node makes goes in as a child with no owner (never saved); anything it
  changes on a node that is saved (a mesh's material, a light's energy or projector) goes back on
  `NOTIFICATION_EDITOR_PRE_SAVE` and on again (deferred) on `NOTIFICATION_EDITOR_POST_SAVE`. Never add or free a child
  inside those notifications (they're sent down the tree: the parent is busy, and freeing one crashed the check):
  defer it, or `queue_free`. A class a `@tool` node instances (`HSRain.new()`...) must be `@tool` itself: a plain
  script can't be instanced in the editor (static functions can be called).
- **Render layers are shared out:** 1 everything by default (and what moves, for the light zones), 2 to 10 the light
  zones, 11 to 19 the mirrors, 20 the softener and hidden things. A new use of layers takes from none of these.
- **MSAA switches SSR off** in Godot 4.7 (measured in the check, 2026-10-29): the realism preset uses TAA alone.
  Don't add MSAA back without looking at the wet floor.
- The eye's `debug` uniform (1 where the iris is read, 2 the view in the tangent space, 3 the tangent) paints the
  numbers as colours; read them back through the sRGB curve (the picture encodes the linear value).
- The shaders take no textures they aren't given: `skin.gd` sets flat normals and white maps, so a sphere with no
  maps lights the same as a character with them left out. Keep that when adding a sampler.
- A new piece: a class with a static `make`/`material`/`apply`, a shader beside it, a stage in `demo.gd` with a
  measure, its node in `nodes/` (and a preset or two in `presets/`, measured in `demo/nodes.gd`), a row in `README.md` and docs/GODOT_LOOK.md, and the runtime wiring in `play.gd`/`game.gd` through a
  story word (STORY_FORMAT §9.1, `story_check.py`).
