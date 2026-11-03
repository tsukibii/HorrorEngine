# Exports: for a Godot project built by hand

What the studio's editors export when you build a game in Godot yourself instead of through the Director
(DECISIONS 2026-11-03, night). Each export is a folder of its own: drag the folder into your Godot project's
FileSystem dock, then drag its `.glb` into a scene.

| Folder | Made by | What's in it |
|---|---|---|
| `interiors/<name>/` | the scene builder's **Export for Godot** (`tools/director/builder.html`), or `node tools/director/levelexport.mjs --game set:<name>` | a level: its rooms and things with their materials, each door on its hinge, colliders, occluders, its lamps, the player's start and the spots |
| `streets/<name>/` | the street builder's **Export for Godot** (`tools/director/street.html`), or `node tools/director/streetexport.mjs --street <name>` | a street: its chunks, colliders to walk on, occluders, the street lamps, where each walk-in building's level goes |
| `characters/<name>/` | the Character Studio's **Export for Godot** (`tools/character/`) | a character on MHR's skeleton, its colours baked, MHR's 72 face shapes as blend shapes |

Each folder has a `README.txt` saying what's in its `.glb` and what to do with it. The guides say the rest:
`guides/godot_by_hand/` (setting up Godot for it), `guides/look_plugin/` (the HorrorStudio Look plugin) and
`guides/first_game/` (a first game from an interior, a street and a character).

Nothing here but the READMEs is in git: an export is made again from the studio's own files whenever you press the
button. A name starting with `_` (a check's scratch one) goes to `Saved/Exports/` instead.
