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

**One export is ready-made and in git** (DECISIONS 2026-11-11): `interiors/hotel_floor/`, tutorial v2's hotel floor
(the set `hotel_floor` exported), so the tutorial starts in Godot without the scene builder (`guides/tutorial_v2`, §2).
Its `ready.json` says what made it. `python tools/godot_byhand.py ready` makes it again from the set (the desk's server
running) and keeps the .glb as it was when what it holds is the same; `python tools/godot_byhand.py ready --check`
(READYMADE) says when it's older than its set. Exporting the set yourself writes over it: `git checkout
Exports/interiors/hotel_floor` puts the ready-made one back. What Godot unpacks beside it when a project links this folder
(`hotel_floor_0.png`..., `.import` files) stays out of git.
