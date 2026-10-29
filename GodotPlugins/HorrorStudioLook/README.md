# HorrorStudio Look: the studio's look for any Godot 4.7 game

One add-on (`addons/horrorstudio_look/`, GDScript and shaders, nothing to build) with the pieces of the studio's look,
each a script or a shader you load; the director's desk copies it into every game it exports (docs/GODOT_EXPORT.md).
Its demo pictures every part and measures it (`demo/demo.gd`; the studio's check `python tools/godot/plugin_check.py`,
LOOKPLUGIN). The pieces, the numbers behind them and what was measured: **docs/GODOT_LOOK.md**.

| Piece | File | Use |
|---|---|---|
| **The look preset** | `look.gd` (`HSLook`) | `HSLook.apply(viewport, environment, "realism")`: pseudo-realism for small, baked-lit rooms with the effects overplayed: screen-space reflections, SSAO and SSIL, a little glow, a thin volumetric haze, AgX with the contrast pushed, TAA (no MSAA: it switches SSR off). `"plain"` turns it all off. `HSLook.set_aa(viewport, 0..3)` the player's choice (Off, FXAA, TAA, TSR) |
| **UltraVHS** | `vhs.gd`, `vhs.gdshader` | a CanvasLayer with the tape on a full-screen rect: `preset("camcorder" / "worn" / "nightmare" / "off")`, `set_night(k)`, `set_strength(k)`, `set_grain_cap(k)`. The three passes of UnrealPlugins/UltraVHS in one shader, matched to it by measurement (GODOTLOOK) |
| **Puffs** | `puff.gdshader` | steam and smoke as soft, noise-eroded discs on a MultiMesh (custom data: age, seed, spin), lit as little spheres, faded into the scene (docs/research/godot_smoke.md) |
| **Wet surfaces** | `wet.gd` (`HSWet`), `wet.gdshader` | `HSWet.wet(mesh_instance, {wetness, puddles, puddle_scale, ripples})` swaps a floor's material for a wet one keeping its colour, texture and roughness: the damp darkening, pools in a world-space noise, mirror-smooth with a damp rim, rain's rings on them. `HSWet.dry()` puts the old one back; `wet_floors(level, rooms)` for an exported level |
| **Blood** | `blood.gd` (`HSBlood`), `blood.gdshader` | `HSBlood.material(seed)` a splat for a flat thing (a pool with a ragged edge, flung drops, drips down a wall), glossy wet, `set_dry(k)` to dull it, `set_opacity(k)` to scrub it; `HSBlood.splat(parent, at, normal, size, seed)` a quad over any surface |
| **Rain** | `rain.gd` (`HSRain`), `rain.gdshader` | `HSRain.make(size, count, strength)` a box of streaks falling and wrapping in the vertex shader (no particle system), turned to the camera, faint up close; `follow` a node to keep it round the player outdoors |
| **Wet skin** | `skin.gd` (`HSSkin`), `skin_wet.gdshader` | HumanShaders' skin shader (MIT, MatMADNESS: `../HumanShaders`) with a wetness layer: `wetness` the sweat film, `sweat` beads standing on the skin as little domes with glints, `drips` runs, `oil` oiled up (one tight gloss, the colour deeper). `HSSkin.material(albedo_texture, {wetness, sweat, drips, oil})`; `wear(node, settings)` on a character's skin meshes; `set_wet(material, settings)` later |

## Using it in a Godot project

Copy `addons/horrorstudio_look/` into the project's `addons/` (keep the name: the scripts load their shaders by
`res://addons/horrorstudio_look/...`). The skin needs `HumanShaders/` at the project's root too (its lightwarp, noise
and micro-detail textures: `../HumanShaders`, copy it beside). Enabling the plugin in Project Settings is optional:
there's nothing to register, every piece is a class (`HSLook`, `HSWet`, `HSBlood`, `HSRain`, `HSSkin`) or a shader.

The demo: `godot --path PROJECT -s res://addons/horrorstudio_look/demo/demo.gd -- --out=DIR` pictures a room with
each piece and writes `report.json` with the measures; `demo/people.gd -- --glb=res://people/NAME.glb --out=DIR` a
Character Studio export (or any glb whose skin mesh is named `..._skin`) on the skin, flat-lit, dry, sweating, oiled.

## Licences

Ours (the studio's), except `skin_wet.gdshader`, which keeps HumanShaders' MIT notice (its base) with the studio's
layer marked `HS`.
