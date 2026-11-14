# HorrorStudio Markers: notes for Claude

The studio's own Godot plugin for a character's whole part in a game built by hand, placed in the scene as markers
(DECISIONS 2026-11-13, the marker system; the user's mock-up "NPC Path & Animation Sequencer": "place markers in the
scene for each npc ... the markers correspond with the quests ... the goal is that even a young child would know how
to use it"). **docs/MARKERS.md is the design: its §6 rules are what the runner must keep.** `tools/godot_byhand.py`
copies `addons/horrorstudio_markers/` into every by-hand project and switches it on. It needs none of the other
plugins; it uses them when they're there (by script path or by what a node can do, never by class name): the starter
kit's Story (group `hs_story`), player (`hs_player`) and Sound (`hs_sound`), the UI plugin's HUD (an `HSHud` in the
scene: its line, its choice, its ring) and theme, the Look plugin's look switch and
phasing, the Weapons plugin's hit reaction (any child of her with `hit` and `down` signals), the Kimodo reader in
`res://kimodo/`. The export and the Director's projects don't carry it.

## Map

| File | What |
|---|---|
| `npc.gd` | `HSNpc` (@tool, a Node3D beside the character): `character`, her name, colour, speeds, what being shot down means; in the game it makes an `HSNpcRunner` in `start()` (deferred from `_ready`) and ticks it in `_physics_process`; signals `marker_started`, `marker_done`, `quest_started`, `quest_done`, `talked`, `scared` (it's in the group `hs_scare`); `use(by)` from the talk box round her; `jump_to`; F7 (`HSNpc.debug`) a chip over the character, `_Debug`: a CanvasLayer placed by the camera's `unproject_position` (text in the 3D world smears under TAA while it moves); `debug_text()` what it says |
| `quest.gd`, `marker.gd`, `way.gd`, `bend.gd` | the nodes: `HSNpcQuest` (title, `starts_when`), `HSNpcMarker` (a `kind` and every kind's fields; `USED_BY` says which kinds use a field and `_validate_property` hides the rest in the Inspector; `KINDS`, `PLACED`, `STAYS`, `BODY`; `title()`, `conversations()` makes `talks` whole, `rule()` reads a face rule), `HSNpcWay` (`when`), `HSNpcBend` (`top_level`: a place in the world, so turning or moving its Walk marker leaves it) |
| `cond.gd` | `HSNpcCond`: the condition words (§5). `holds(text, tree, ctx)`: flags, `task:`, `on:`, `item:` asked of the Story when there is one (else `flags`, a static dictionary); the `@` words asked of `ctx.local(kind, arg)` (the runner). `switch_flags`, `says` (plain words: the tab's chips), `with_word`, `flipped`, `slug` |
| `flow.gd` | `HSNpcFlow`: the markers read as a whole, nothing run. `board(quest)` (order and labels: "3", "4A", "4A.1"), `starts_of(marker)` (every place she can be when it starts: through ways and repeats, at most `MOST`), `end_of`, `stand_for` and `reach_of` (where she stands to sit, lie, put a hand out; the Animator's numbers from her record, else the constants), `walk_points` (the curve: centripetal Catmull-Rom, `STEP` apart), `seconds_of`, `problems(npc, clips, setters, tasks)` (the tab's Problems; `setters` null means the scene wasn't read), `flags_set`, `tasks_known` |
| `body.gd` | `HSNpcBody`: her body driven, a queue of steps (`path`, `follow`, `turn`, `clip`, `blend`). Port of the starter's motion.gd with paths. `setup` finds her clips (the record's names, else `GUESS` by name); `_play` plays a **copy** of a clip in a library of ours (`hsm`) on her own player, never changing hers; `walk` (speed, eased in and out, the floor under the path: three rays, the highest of here, 16 cm ahead and behind, eased), `sit`, `lie`, `reach`, `open`, `play`, `stand` (the loop she holds), `follow`, `clip_from` (a file: `.npz` through `res://kimodo/`, an Animation), `hide_now` (visible off, `process_mode` disabled) / `show_now`, `interrupt`, `snapshot` / `restore`, `sit_now` / `lie_now` (straight into a state). With `preview` it never touches a node of the scene (no thing taken, no door used) |
| `face.gd` | `HSNpcFace`: expressions on MHR's shapes (`MHR`) or ARKit's (`ARKIT`), the Studio's presets (tools/character/arkit_mhr.json; regenerate both tables from it when it changes); `wear` (kept), `flash` (for a moment), a face clip from `res://faces/` read as text (`read_clip`: it needs no script from the runtime add-on); her lids go to her blinker's `hold` |
| `runner.gd` | `HSNpcRunner`: §6. `tick(dt)`: quest switching (`_quest_switch`: a later quest with a Starts when cuts in; the next in order when finished and not `halted`), a stack of containers (`_advance`), a marker's `gate` → `run` → `stay`; `_start` (per kind), `_run_done`, `_stay_done`, `_finish`; talking (`use`, the talk body on layer 2, `conversation()`, once per visit: `asked`); looks (`_wear_look` keeps `_look` so a later marker's eyes keep the skin); phase in/out; shot (`_on_hit`, `_on_down`: the three policies); checkpoints (`snapshot`/`restore`, hooked to the Story's `kept` and `revived`); `jump_to(marker, snap)` (the stack rebuilt from the marker's place in the tree; `_snap` puts her in each earlier marker's end state); `preview`: gates pass after 0.7 s, notes instead of effects, `over` when done |
| `talk_box.gd`, `talk_body.gd` | `HSNpcTalkBox` (one CanvasLayer under the root, made at first need: a conversation's stages, lines → the answers → the reply; `advance` (E: the next line now), `select`, `confirm`, `pick`, `close`, `prompt(key, verb, who)`, `caption`, `showing`; the checks call those). **It draws nothing of its own style**: with an `HSHud` in the scene (`hud()`: found by its script's name, looked for at most once a second) a line is the HUD's `line`, the answers its `choose` (`_ask` awaits it; `pick` goes through the HUD's `choice_pick`), the prompt its `set_cursor`; with none it draws the HUD's footer again, number for number (`FOOT_REST`, `FOOT_CHOOSING`, the scrim, the serif from the UI plugin's `theme.gd`, the answers on one line with a dash, `DIM`, the ring and verb). Lines are timed by `read_secs`; the last line before the answers comes with them, as their question. And `talk_body.gd`: the StaticBody3D whose `use()` the starter's player finds |
| `plugin.gd` | the EditorPlugin: what the tab and the 3D view share (`cur_npc`, `cur_quest`, `cur`, `hidden`, `solo`, `all_quests`, `armed`, `picking`, `picks`) and every change to the scene, through `get_undo_redo()`: `set_prop`, `add_node`, `delete_node`, `move_node`, `place_node`, `add_character`, `add_quest`, `add_marker`, `add_bend`. `CARDS` is the palette. `set_force_draw_over_forwarding_enabled()` and `set_input_event_forwarding_always_enabled()`: it draws and hears the mouse whatever is selected. **Two undo signals** (measured in 4.7): a commit says `history_changed` (`_on_history`: the tab's `changed(own)`, own when the tab's form made it: `set_prop`, `set_props`, `place_node(..., own)`), an undo or a redo says `version_changed` (`_on_version`: never own) |
| `editor/dock.gd` | the tab (an EditorDock, bottom): built in `_ready`, filled from the scene by `refresh()`; the storyboard a Tree (drag to reorder: `_drop_spot`; `refresh_board` brings its rows up to date **in place** when they're the same rows, `_dress`, so nothing jumps while a field is typed in; when another marker is picked or the rows are made again, the picked one's row is scrolled into view, `_show_row`); `refresh_form` starts another marker's form at its top and leaves the same one's scroll where it was; `changed(own)`: the form's own change updates the rows and the quest's row at once and leaves the form's fields alone, anything else marks it stale (`_sig = "?"`) and asks the plugin for a look next frame (`look_soon`); the form built for what's picked (`refresh_form`; `REBUILD` lists the fields that change its rows; `_vals` notices a change from outside); `_put` is the form's setter (not `_set`: that's Object's). `candidates`, `problems`, `timing`, `set_target`, `add_way`, `ways_for_answers`, `_talks`/`_save_talks` are what the check calls |
| `editor/overlay.gd` | the 3D view: `draw(control)` (pins, badges, paths, arrows, handles, the legend; it fills `hot`: what can be clicked, by control) and `input(camera, event)` (place, pick, drag, turn, bend); `under_mouse` (the nearer of a collider and a mesh: a `TriangleMesh` a mesh, kept) |
| `editor/tester.gd` | the tester: a `_Ghost` copy of her (no owner), the real one hidden, an `HSNpcRunner` with `preview`; stopped by `_apply_changes` (a save, a play, a scene switch) |
| `editor/cond_edit.gd`, `editor/dial.gd`, `editor/glyphs.gd` | a condition as chips; the facing dial; the drawings (SVG strokes rasterised at the editor's scale, kept) |

## Checking it

- `python tools/godot/markers_check.py [--reuse] [--only a,b]` (MARKERS): a by-hand project, the Animator's normal
  woman baked, `tools/godot/markers_test.gd` builds markers in code and plays them headless: every kind and every rule
  measured (stages order, gates, quests, talk, repeat, hide, sit, clips, speed, stairs, faces, looks, shot,
  checkpoint, event, you, problems, tester). Run it after any change to the runtime files.
- `python tools/godot/markers_check.py --editor [--reuse] [--shots DIR]` (MARKERSEDITOR): `markers_editor_test.gd`
  installed as a plugin of its own drives the tab in the editor itself (headless): a character added, cards placed by
  clicks sent through the 3D view's own input, drags, undo, the form, a conversation into a Choice, who's shown,
  Problems, the tester, a save. Run it after any change to `plugin.gd` or `editor/`. `--shots` pictures the editor
  under xvfb (the guide's pictures).
- A quick loop while working: copy the add-on into `Saved/Godot/_markers/addons/`, then
  `godot --headless --path Saved/Godot/_markers --check-only -s res://addons/horrorstudio_markers/<file>.gd` parses
  one file; the checks' `--reuse` keeps the project.

## Rules

- **Nothing made while the game or the tester runs is ever saved**: the talk body (`_Talk`), the clips' player
  (`_MarkerClips`), the tester's copy (`_Ghost`), the debug label (`_Debug`) have no owner and names with `_`; the
  editor check greps the saved scene for them.
- **Lines and choices are drawn the studio's way, never a new one** (the user, DECISIONS 2026-10-30, evening, and
  2026-11-14 on a boxed panel this plugin first drew: "Keep it the prior style"): no panel; the answers on one line
  under the question with a dash between, the one pointed at white and the others dimmed; no numbers; A / D or the
  arrows and Enter, or a click; two answers at the most (Problems warns past that). Before drawing anything on the
  game's screen, look for what the UI plugin already draws and use it.
- **Nothing holds a runner but its HSNpc.** A runner is a RefCounted: one reference left anywhere (a dictionary's key,
  a captured lambda) keeps it listening to the Story after its character is gone, and the next checkpoint put back
  reaches for freed nodes. The talk box keys its prompts by instance id; an HSNpc leaving the tree calls
  `runner.end()` (the talk shut, the prompt gone, the Story unhooked) and hooks again when it comes back; the Story's
  callbacks ask `_alive()` first. MARKERS frees a character while you're aimed at them and looks.
- **Never change an animation of hers.** `_play` copies. A loop is wanted: the copy loops.
- **A marker's end state must be reachable at once** (`_snap`): the tester starts from it and a checkpoint restores
  through `jump_to`. A new kind gets its `_start`, its `_run_done` case, its `_snap`, its `end_of` in flow.gd, its
  fields in `USED_BY`, its card, its form rows, its drawing in glyphs.gd, a stage in markers_test.gd and a row in
  docs/MARKERS.md §4.
- **Conditions are polled** ten times a second (and at once when the Story signals a change); never per frame for
  every marker. A hidden character costs that and nothing else.
- **The runner never waits inside a frame**: at most `MOST` markers that take no time, a frame; a Repeat whose pass
  took none comes back the next frame.
- The words of a condition are the Story's: don't add a word the Story could mistake for a flag without an `@`.
- **Never read the scene again inside whoever changed it**: a change that isn't the form's own is read at the tab's
  next look (the next frame), so a control is never freed while its own signal is being sent.
- `tick()` on the tab only runs while it's shown (`is_visible_in_tree`); an EditorDock in the bottom slot isn't until
  it's opened (`make_visible()`), and the check does that.
- A test that's killed leaves its test plugin in the scratch project's project.godot: the check takes it out before it
  starts.
