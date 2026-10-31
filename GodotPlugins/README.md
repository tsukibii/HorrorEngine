# GodotPlugins

Third-party and our own plugins for the Godot side of the studio (docs/GODOT_PLAN.md; Godot 4.7, GDScript). A
third-party folder is a plugin as its upstream ships it, with an `UPSTREAM.md`: where it came from, the commit, its
licences, what was left out. Our own have a `README.md` (for anyone) and a `CLAUDE.md` (how to check and change it),
like `UnrealPlugins/`. The director's desk copies what a game needs into its export (docs/GODOT_EXPORT.md): the
plugins live here, once, not in the exported projects.

| Folder | What | Licence |
|---|---|---|
| `HorrorStudioLook/` | **ours**: the studio's look as one add-on (`addons/horrorstudio_look/`): the pseudo-realism preset (SSR, SSAO, SSIL, glow, haze, AgX, TAA), UltraVHS as a canvas shader, the little things' puffs, wet floors with puddles and rain's rings, blood, rain, wet or oiled skin on HumanShaders' skin shader; a demo that pictures and measures each (docs/GODOT_LOOK.md, `tools/godot/plugin_check.py`) | ours; the skin shader keeps HumanShaders' MIT |
| `HorrorStudioDirector/` | **ours**: build the game in Godot itself (`addons/horrorstudio_director/`, docs/GODOT_DIRECTOR.md): drag-and-drop nodes for the level and the story, events (when, if, then), a dock (the story in play order, events, flags, things, add, check, Kimodo), compiled at play into the runtime's story; `tools/godot_director.py new` makes a project with it; the user's guide `guides/director/index.html` | ours |
| `HumanShaders/` | [matmadness/HumanShaders](https://github.com/matmadness/HumanShaders): a skin shader (Burley diffuse, skin SSS, a light-warp ramp, translucency, micro detail, double specular), an eye shader (iris parallax from a heightmap, sclera SSS) and an eye-wetness visual shader. Godot 4.5+ | code MIT; its textures MIT and CC BY 4.0 (credit the author if a game ships them) |

## Using one in a Godot project

Copy (or link) the folder to the project's root under the same name: HumanShaders' resources refer to themselves as
`res://HumanShaders/...` (`vshader_eye_wetness.tres`), so it has to sit at `res://HumanShaders/` unless those paths
are changed. The `.import` and `.uid` files are upstream's; Godot rewrites them on its first import.
