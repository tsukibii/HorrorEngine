# HorrorStudio: start here

One project where all our short first-person horror games are made, with Claude as co-lead engineer. You write a
rough story; Claude plots it on the director's desk, builds the greybox, plays it through, checks every frame that
matters, and swaps in your faces and art as they arrive. Each game ships as a **Godot 4.7** project the desk exports,
a new version each time, with a guide inside it (docs/GODOT_EXPORT.md). (The project started on Unreal; that side was
removed on 2026-10-30 and lives in git history.)

## Try it now

You need Python 3 with `pip install pillow`, and Godot 4.7 for the game itself.

```
./studio                              the launcher: every tool by section
python dashboard.py                   the same as a page, http://127.0.0.1:8790
python tools/director/serve.py        the director's desk, http://127.0.0.1:8780 (Flow, Storyboard, Watch, Play)
python tools/check_all.py             every offline check: STORY, LEVEL, SHOTS, PBR...
python tools/godot_export.py --game TestRoom001    a game exported as a Godot project (Saved/Godot/<Game>_v001...)
```

Open the exported folder's `project.godot` in Godot 4.7. Its guide (`guide/index.html`) explains what's inside. The
look plugin, HorrorStudio Look, comes in every export with its effects as nodes and presets to drag into a level:
rain, wet floors, shafts of window light, flickering bulbs, light zones per room, the camcorder tape
(docs/GODOT_LOOK.md).

**Bodies and characters:** the Character Studio (`python tools/character/serve.py`) makes our characters on Meta's MHR
body: face, skin, eyes, hair, clothes, all exported for the desk and Godot (docs/CHARACTER_STUDIO.md).

## What's inside

| Path | What |
|---|---|
| `CLAUDE.md` | Claude's instructions and the map of everything |
| `docs/DECISIONS.md`, `docs/CONTINUE.md` | your answers, newest first; where the last session stopped |
| `docs/PIPELINE.md` | how a game gets made: spine first, then the player's tasks, then the polish layers |
| `docs/STORY_FORMAT.md` | the story file: world, scenes, stitches, flow, endings, notes |
| `tools/director/` | the director's desk: plot, block bodies and shots on a 3D stage, play it from the player's eye, export it to Godot |
| `tools/godot_export.py`, `tools/godot/` | the Godot export and its runtime add-on |
| `GodotPlugins/` | the look plugin and HumanShaders, copied into every export |
| `tools/character/` | the Character Studio and the salon (hair) |
| `docs/DIRECTING.md`, `docs/TRICKS.md` | shots, moods, scares; hiding seams, immersion tricks |
| `docs/ASSETS.md`, `tools/cc0.py` | the CC0 library: props by name at real size, textures, fetched and recorded |
| `Content/Games/` | the games (the Pilot, TestRoom001: a lab of every feature) |
