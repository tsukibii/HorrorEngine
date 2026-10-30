# HorrorStudio Look: notes for Claude

The studio's own Godot plugin: the look (docs/GODOT_LOOK.md has the numbers and the measures). It lives here, not
in the exports: `storykit/godot.py` copies `addons/horrorstudio_look/` into every game's project, and the runtime
add-on (`tools/godot/addons/horrorstudio`) uses it by its classes (`HSLook`, `HSWet`, `HSBlood`, `HSRain`, `HSSkin`,
the VHS layer in `main.tscn`, `puff.gdshader` from lifefx.gd). A change here reaches every game on its next export.

## Map

| File | What |
|---|---|
| `look.gd` | the presets as one dictionary each (`PRESETS`): the viewport's anti-aliasing and the environment's effects; `apply`, `set_aa`, `shadows` (the filter and atlas), `iris` (auto exposure, a stop under at night) |
| `vhs.gd`, `vhs.gdshader`, `vhs_hold.gdshader` | UltraVHS: the presets as dictionaries of the shader's uniforms (`CAMCORDER` the base), the layer's node; the history viewport (the last frame copied by `vhs_hold`) for the ghosting |
| `pattern.gd`, `pattern.gdshader` | a light's pattern: `HSPattern` a SubViewport under a SpotLight3D drawing caustics, leaves, blinds or clouds (Light Kit's four light functions in GLSL, `metres` the viewport's width on the aimed surface) and set as its `light_projector` |
| `shaft.gd`, `shaft.gdshader` | a light shaft: `HSShaft` a FogVolume box along a window's light, its fog shader the beam's density (ends, sides, drifting dust clumps); the renderer's volumetric fog carries the light |
| `sweep.gd` | a headlight sweep: `HSSweep` a SpotLight3D slid along the street outside a window on a clock and a seed, or fired |
| `puff.gdshader` | the little things' puffs (lifefx.gd makes the MultiMesh) |
| `wet.gd`, `wet.gdshader` | wet floors: the pool mask (fbm in world space), the rings (a grid of drops per cell, their age from TIME, bent into the normal per pixel); `puddle` a Decal with maps made in code |
| `leak.gd` | water down a wall: `HSLeak` puts the wet shader's band (`band_*` uniforms: a strip below the leak, spreading, in rivulets) on the wall's meshes and drops the drips |
| `glass.gd`, `glass.gdshader` | window panes: the drops (cells with a drop sliding down, beads above it, a mist) as a slope bending the screen behind |
| `blood.gd`, `blood.gdshader` | the splat (the pool's radius by angle, satellite drops in a cell grid, drips in lanes) |
| `rain.gd`, `rain.gdshader`, `splash.gdshader` | the streaks (a MultiMesh of quads; the vertex shader places each from its custom data and TIME; lit in `light()` by every light that reaches them) and the splashes where they land (a second MultiMesh under the rain: a glint, a sheen and thrown droplets from a seat and a phase; no ring) |
| `mirror.gd`, `mirror.gdshader` | a real mirror: `HSMirror` reflects the camera through the glass's plane (its middle and facing measured from the surface's triangles; a closed block's thin axis, the side toward the eye) into a SubViewport each frame it's in view, the shader projecting each point of the glass through that camera's view-projection; each mirror and its wall on a layer of their own (11 to 19: a mirror seen in a mirror shows its last frame, never itself); `set_quality` for the menu |
| `eye.gd`, `eye.gdshader` | the Studio's eye (people.py's `_FRAME` and `EYE_COLOR` in GLSL; `handed` −1 for Godot's binormal); `records` reads the glb's JSON chunk for `studioEye` |
| `hair.gd`, `hair.gdshader` | the Studio's hair look (hairshader.js's Kajiya-Kay and retro maths) on imported card hair: `HSHair.wear` by mesh name (hair, lash, brow); the tangent from the UVs' screen derivatives in `fragment()`, the highlights in `light()`, the retro quantisation on the albedo (lit) or the emission (flat) |
| `skin.gd`, `skin_wet.gdshader` | HumanShaders' skin shader with the wetness layer (the lines marked `HS`); `skin.gd` wires HumanShaders' textures and flat defaults |
| `demo/demo.gd` | the demo scene and the measures (`report.json`) |
| `demo/people.gd` | a Character Studio export on HSSkin: flat-lit against its paint, lit dry, sweating, oiled (`people.json`) |

## Checking it

- `python tools/godot/plugin_check.py` (LOOKPLUGIN): the demo in a project of its own under Xvfb (on the card too:
  Vulkan draws there, and no window manager resizes the window; the check prints the renderer and fails if Godot
  fell back to OpenGL; `--fixed-fps 60`, so a stage's frames are the same seconds everywhere), each part pictured
  into `Saved/Story/_look/godot_plugin/` and measured: the lamp's reflection in the wet floor brighter than in the
  dry, the rain moving between frames, the splashes' glow on the floor, the mirror's glint, the blood's red, the
  sweat's glint and the oil's glint over dry skin. `--only=<stage>` runs one stage alone for a quick look. Look at
  the pictures after a change, not only the numbers.
- `python tools/godot/people_check.py` (GDPEOPLE): a Studio export's skin on HSSkin, its colour against its paint.
- `python tools/godot/look_check.py` (GODOTLOOK): the tape against UltraVHS's numpy reference.
- `python tools/godot_export.py --game TestRoom001 --testroom` (GDTESTROOM): the yard's rain and wet floor, the blood
  stain's splat, in the game.

## Rules

- **MSAA switches SSR off** in Godot 4.7 (measured in the check, 2026-10-29): the realism preset uses TAA alone.
  Don't add MSAA back without looking at the wet floor.
- The eye's `debug` uniform (1 where the iris is read, 2 the view in the tangent space, 3 the tangent) paints the
  numbers as colours; read them back through the sRGB curve (the picture encodes the linear value).
- The shaders take no textures they aren't given: `skin.gd` sets flat normals and white maps, so a sphere with no
  maps lights the same as a character with them left out. Keep that when adding a sampler.
- A new piece: a class with a static `make`/`material`/`apply`, a shader beside it, a stage in `demo.gd` with a
  measure, a row in `README.md` and docs/GODOT_LOOK.md, and the runtime wiring in `play.gd`/`game.gd` through a
  story word (STORY_FORMAT §9.1, `story_check.py`).
