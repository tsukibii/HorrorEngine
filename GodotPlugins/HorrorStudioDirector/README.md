# HorrorStudio Director

A Godot 4.7 plugin for building a HorrorStudio game in Godot itself (docs/GODOT_DIRECTOR.md): the scene is the world
(drag-and-drop nodes for rooms, doors, areas, spots, paths, characters, and parts that make your own models things to
take, read, look at, use, hide in, sit on, or little things with lives: a kettle, a candle, a phone), and the story is
the Director file, `director/director.json` (quests one at a time, states, moments, conversations, endings), which a
brain at play runs over the world by id. A dock to see and check it all, and a link to Kimodo for motions. Played, it's
the studio's runtime (`addons/horrorstudio`): the player, the interactions, the HUD, the menu, the saves come with it.

Needs, beside it in the project: `addons/horrorstudio` (the runtime), `addons/horrorstudio_look` (the look) and
`HumanShaders/`; `tools/godot_director.py new <folder>` (or `install <folder>`) puts them all in.

## Use

**The guide**: `guides/director/index.html` in the studio (the whole thing, step by step, with pictures); a project
has its copy in `guide/`, opened by the dock's Guide button or Project > Tools.

- **New project**: `python tools/godot_director.py new ~/Games/MyGame --sample`, then open it in Godot; F5 plays.
- **The dock** (under the Inspector): Director (the Director file's quests, steps, endings, conversations, moments,
  states; ▶ ✓ ● while the game runs; Play from a quest; the Manager), Things, Add (the parts for your models, then the
  level's nodes: click or drag into the 3D view), Check, Kimodo.
- **F9** in the game: where the player is, the quest, the facts, the items, the events.
- **F6** on a level's scene: that level alone, a free roam with the story's moments, conversations and states.

## Nodes

| Node | |
|---|---|
| HSGame | the main scene's root: the game's settings, its levels under it, its story file (`story_file`) |
| HSLevel, HSRoom, HSDoor, HSThing, HSTrigger, HSSpot, HSPath, HSActor | the level; an HSThing is a part when it wraps your model (`parts/`) |
| HSOpening | a resource: a hole in a room's wall |

## Licence

Ours. The sample's body (`bodies/MHR.fbx`, copied in by the tool) is Meta's MHR, Apache-2.0 (its licence beside it).
