# HorrorStudio Director

A Godot 4.7 plugin for building a HorrorStudio game in Godot itself (docs/GODOT_DIRECTOR.md): drag-and-drop nodes for
the level (rooms, doors, things to take, read, use, hide in or sit on, areas, spots, paths, characters) and the story
(chapters, tasks with their to-do lists, events, dialogue, choices, endings), a dock to see, rearrange and check it all,
and a link to Kimodo for motions. Played, the scene is compiled into the story the studio's runtime plays
(`addons/horrorstudio`): the player, the interactions, the HUD, the menu, the saves come with it.

Needs, beside it in the project: `addons/horrorstudio` (the runtime), `addons/horrorstudio_look` (the look) and
`HumanShaders/`; `tools/godot_director.py new <folder>` (or `install <folder>`) puts them all in.

## Use

**The guide**: `guides/director/index.html` in the studio (the whole thing, step by step, with pictures); a project
has its copy in `guide/`, opened by the dock's Guide button or Project > Tools.

- **New project**: `python tools/godot_director.py new ~/Games/MyGame --sample`, then open it in Godot; F5 plays.
- **The dock** (under the Inspector): Story (the quest log, reordered by dragging, Play from here), Events (sentences
  and templates: a jumpscare in an area after flags, the lights dying...), Flags (set where, checked where), Things,
  Add (click or drag into the 3D view), Check, Kimodo.
- **F9** in the game: where the player is, the flags, the items, the events.
- **F6** on a level's scene: that level alone, a free roam with its events.

## Nodes

| Node | |
|---|---|
| HSGame | the main scene's root: the game's settings; its levels and its story under it |
| HSLevel, HSRoom, HSDoor, HSThing, HSTrigger, HSSpot, HSPath, HSActor | the level |
| HSChapter, HSTask, HSTodo, HSEvent, HSDialogue, HSLine, HSOption, HSChoice, HSEnding | the story |
| HSWhen, HSAction, HSOpening | resources: a trigger, an action, a hole in a wall |

## Licence

Ours. The sample's body (`bodies/MHR.fbx`, copied in by the tool) is Meta's MHR, Apache-2.0 (its licence beside it).
