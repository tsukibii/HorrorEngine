# HorrorStudio Look: notes for Claude

The studio's own Godot plugin: the look (docs/GODOT_LOOK.md has the numbers and the measures). It lives here, not
in the exports: `storykit/godot.py` copies `addons/horrorstudio_look/` into every game's project, and the runtime
add-on (`tools/godot/addons/horrorstudio`) uses it by its classes (`HSLook`, `HSWet`, `HSBlood`, `HSRain`, `HSSkin`,
the VHS layer in `main.tscn`, `puff.gdshader` from lifefx.gd). A change here reaches every game on its next export.

## Map

| File | What |
|---|---|
| `look.gd` | the presets as one dictionary each (`PRESETS`): the viewport's anti-aliasing and the environment's effects; `apply`, `set_aa` |
| `vhs.gd`, `vhs.gdshader`, `vhs_hold.gdshader` | UltraVHS: the presets as dictionaries of the shader's uniforms (`CAMCORDER` the base), the layer's node; the history viewport (the last frame copied by `vhs_hold`) for the ghosting |
| `puff.gdshader` | the little things' puffs (lifefx.gd makes the MultiMesh) |
| `wet.gd`, `wet.gdshader` | wet floors: the pool mask (fbm in world space), the rings (a grid of drops per cell, their age from TIME) |
| `blood.gd`, `blood.gdshader` | the splat (the pool's radius by angle, satellite drops in a cell grid, drips in lanes) |
| `rain.gd`, `rain.gdshader` | the streaks (a MultiMesh of quads; the vertex shader places each from its custom data and TIME) |
| `skin.gd`, `skin_wet.gdshader` | HumanShaders' skin shader with the wetness layer (the lines marked `HS`); `skin.gd` wires HumanShaders' textures and flat defaults |
| `demo/demo.gd` | the demo scene and the measures (`report.json`) |
| `demo/people.gd` | a Character Studio export on HSSkin: flat-lit against its paint, lit dry, sweating, oiled (`people.json`) |

## Checking it

- `python tools/godot/plugin_check.py` (LOOKPLUGIN): the demo in a project of its own under xvfb, each part pictured
  into `Saved/Story/_look/godot_plugin/` and measured: the lamp's reflection in the wet floor brighter than in the
  dry, the rain moving between frames, the blood's red, the sweat's glint and the oil's glint over dry skin. Look at
  the pictures after a change, not only the numbers.
- `python tools/godot/people_check.py` (GDPEOPLE): a Studio export's skin on HSSkin, its colour against its paint.
- `python tools/godot/look_check.py` (GODOTLOOK): the tape against UltraVHS's numpy reference.
- `python tools/godot_export.py --game TestRoom001 --testroom` (GDTESTROOM): the yard's rain and wet floor, the blood
  stain's splat, in the game.

## Rules

- **MSAA switches SSR off** in Godot 4.7 (measured in the check, 2026-10-29): the realism preset uses TAA alone.
  Don't add MSAA back without looking at the wet floor.
- The shaders take no textures they aren't given: `skin.gd` sets flat normals and white maps, so a sphere with no
  maps lights the same as a character with them left out. Keep that when adding a sampler.
- A new piece: a class with a static `make`/`material`/`apply`, a shader beside it, a stage in `demo.gd` with a
  measure, a row in `README.md` and docs/GODOT_LOOK.md, and the runtime wiring in `play.gd`/`game.gd` through a
  story word (STORY_FORMAT §9.1, `story_check.py`).
