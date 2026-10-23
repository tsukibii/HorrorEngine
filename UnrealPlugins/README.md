# UnrealPlugins

Plugins built here that work in **any** Unreal project, not only HorrorStudio. Each folder is one plugin: copy it into a
project's `Plugins/` folder, enable it, build. They carry no `.uasset`s (C++, shaders and text only), so they diff,
review and merge like code, and nothing in them depends on this project's folders.

| Plugin | What | Engine |
|---|---|---|
| [`UltraVHS/`](UltraVHS/README.md) | A camcorder recorded to VHS as a post-process (lens, sensor, tape, screen) plus a handheld camera (drift, gait, turn roll, weight), tuned to a reference video by measurement | 5.4 or newer, written for 5.8 |

How to add any of these to a project, for a person or for Claude: [CLAUDE.md](CLAUDE.md). Each plugin's own
`CLAUDE.md` has its specifics.

## Rules for a plugin in this folder

- **Self-contained.** No paths into `Content/Games/`, `Content/Studio/` or `tools/`; no dependency on StoryRunner or
  any HorrorStudio module. If it needs an asset, it makes it at runtime or the instructions say how to make one.
- **Text only.** C++, `.usf`/`.ush`, `.uplugin`, Python. No binaries, no `.uasset`s (an editor script can make them).
- **Assets are CC0 or ours** (the studio's rule), and the plugin's README says where anything came from.
- **A `README.md`** (what it does, how to use it, its knobs) and **a `CLAUDE.md`** (how to install it, check it and
  fix it on another engine version, step by step).
- **Offline checks where they can exist:** a shader that compiles with DXC, a numpy preview, a measuring tool.
