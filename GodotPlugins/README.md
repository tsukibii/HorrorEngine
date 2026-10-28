# GodotPlugins

Third-party and our own plugins for the Godot side of the studio (docs/GODOT_PLAN.md: not started; Godot 4.7
**Mono**). Each folder is a plugin as its upstream ships it, with an `UPSTREAM.md`: where it came from, the commit,
its licences, what was left out.

| Folder | What | Licence |
|---|---|---|
| `HumanShaders/` | [matmadness/HumanShaders](https://github.com/matmadness/HumanShaders): a skin shader (Burley diffuse, skin SSS, a light-warp ramp, translucency, micro detail, double specular), an eye shader (iris parallax from a heightmap, sclera SSS) and an eye-wetness visual shader. Godot 4.5+ | code MIT; its textures MIT and CC BY 4.0 (credit the author if a game ships them) |

## Using one in a Godot project

Copy (or link) the folder to the project's root under the same name: HumanShaders' resources refer to themselves as
`res://HumanShaders/...` (`vshader_eye_wetness.tres`), so it has to sit at `res://HumanShaders/` unless those paths
are changed. The `.import` and `.uid` files are upstream's; Godot rewrites them on its first import.
