# HorrorStudio UI: the studio's HUD for any Godot 4.7 game

One add-on (`addons/horrorstudio_ui/`, GDScript and one shader, nothing to build): the HUD the studio's games wear, and a
quest marker you can hang on anything. The studio's own games get it from here too: the director's desk copies it into
every export and the Director plugin installs it (the runtime's HUD *is* this plugin's `HSHud`); a game made by hand gets
it with `tools/godot_byhand.py`. Made for horror first: flat and vector, one stroke, nothing glows or pops, every
appearing and going an ease, and no panels (words, and where they need it a soft dark behind them with no edge).

| Piece | File | Use |
|---|---|---|
| **The HUD** | `hud.gd` (`HSHud`, a CanvasLayer) | add one to a scene. `objective(text)`, `todo(items, fresh)` (a row a task, `{id, text, state, who, left, guide}`: a task with `guide` has the marker's diamond for a bullet), `line(text, who, secs, think)` (the subtitle, in a serif, over a scrim that rises while it's up), `log(text)` (a toast), `set_cursor(kind, label, name)` (the reticle opens into a ring; the verb and what it's on beside it), `progress(0..1)`, `seen(0..1)`, `set_stance("hidden")` (the dark closes in), `timer(secs)`, `board(text)`, `choose({prompt, options})` (one line, a dash between, A/D and Enter), `panel({title, text})` (a card that is only its words), `inventory(...)`, `chapter(title, sub, secs)`, `hint_key(key, what)` |
| **The quest marker** | `quest_marker.gd` (`HSQuestMarker`, a Node3D), `marker.gd` (what draws it) | add an `HSQuestMarker` as a child of a door, a person, an item, a trigger: while `active` the HSHud hangs a diamond over it. **The nearer the clearer**: nearly opaque inside 3 m, faint far off, gone by 72 m, and about half as strong with a wall between (a physics ray against `sight_mask`: you can see roughly where it is through the rooms); its `label` comes over it once you're close; a small diamond with a chevron points to it from the screen's edge once it has been out of view a moment. `height`: metres up to the top of the thing. Off, Subtle or Clear in Project Settings |
| **The look** | `theme.gd`, `halo.gdshader` | the four themes (`glass` the default, `glass-rose`, `neumorph`, `plain`: colours, a surface, a voice), the serif for what people say and write (a system serif: Source Serif 4, Noto Serif, Georgia, Liberation, DejaVu; the default font where there's none), small letter-spaced capitals for labels; `halo.gdshader` a soft edgeless dark behind a card's words |
| **The pause menu** | `menu.gd` | the controls, Save game, Settings (display, graphics, audio, Quest marker), Quit: the studio's runtime uses it (`HSHud.standalone = false`); a game by hand has none |
| **Typed thoughts** | `typing.gd` | a thought typing itself out, retyped or breaking off (the story's `type`) |

## By hand

1. `python tools/godot_byhand.py new ~/Games/MyGame` (or `install` into a project you have: the plugin is copied in; enable
   **HorrorStudio UI** in Project Settings > Plugins for its settings).
2. Add an **HSHud** node to your scene. It sets itself up (`standalone`, the default): the project's theme and quest marker
   setting, no black fade, no pause menu, and the quest markers found in the scene.
3. Add an **HSQuestMarker** as a child of what the player should be pointed at: set its `label` and `height`; turn `active`
   off (or free it) when the task is done.
4. Say things from your scripts: `hud.objective("Find the doll")`, `hud.todo([{"id": "doll", "text": "Find the doll", "state": "open", "guide": true}], true)`,
   `hud.line("She's in the kitchen.", "Mari", 4.0, false)`.
5. **Project Settings > horrorstudio/ui**: `theme` (glass, glass-rose, neumorph, plain) and `quest_marker` (Off, Subtle, Clear).

`demo/byhand_check.gd` is the smallest whole example (a camera, a wall, two markers, an HSHud): the studio's check GDUI runs
it in a project of its own.

## Made through the studio

The desk's export and the Director's projects run the same `HSHud` through the runtime add-on (`addons/horrorstudio`:
`play.gd` feeds the marker from the to-do list's `guide`, with its own line-of-sight test; `game.gd` makes the HUD with
`standalone = false`): the player's Quest marker setting is in the pause menu, a story's `guide` is STORY_FORMAT §4.
It needs the Look plugin beside it (`HSLook`: the pause menu's graphics rows).

Pictures: `demo/hudlab.gd` puts the HUD alone over a picture (seconds a picture; `tools/godot/ui_check.py` for the rules,
`tests/uishot.gd` in the runtime for the HUD in a game).
