# HorrorStudio Markers: notes for Claude

The studio's own Godot plugin for a character's whole part in a game built by hand, placed in the scene as markers
(DECISIONS 2026-11-13, the marker system; the user's mock-up "NPC Path & Animation Sequencer": "place markers in the
scene for each npc ... the markers correspond with the quests ... the goal is that even a young child would know how
to use it"). **docs/MARKERS.md is the design: its §6 rules are what the runner must keep.** **And flags and things** (DECISIONS
2026-11-14: "how to easily tie in the marker system with other elements (interactables) ... a new tab for global
flags"): the Flags and Things tabs, the Logic node, the scene's scan, pickers in the Inspector, F7's flag board;
**docs/FLAGS.md is their design.** `tools/godot_byhand.py`
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
| `quest.gd`, `marker.gd`, `way.gd`, `bend.gd` | the nodes: `HSNpcQuest` (title, `starts_when`), `HSNpcMarker` (a `kind` and every kind's fields; `USED_BY` says which kinds use a field and `_validate_property` hides the rest in the Inspector; `KINDS` (with `attack` and `scare` since animations v3), `PLACED`, `STAYS`, `BODY`, `ACTIONS` (a Grab's: with `eat`, `drink`), `PACES` (a Walk's: walk, run, sneak, crawl, creep, scuttle); `head`, `head_range`, `head_at` on every body kind and the event; `title()`, `conversations()` makes `talks` whole, `rule()` reads a face rule), `HSNpcWay` (`when`), `HSNpcBend` (`top_level`: a place in the world, so turning or moving its Walk marker leaves it) |
| `cond.gd` | `HSNpcCond`: the condition words (§5). `holds(text, tree, ctx)`: flags, `task:`, `on:`, `item:` asked of the Story when there is one (else `flags`, a static dictionary); the `@` words asked of `ctx.local(kind, arg)` (the runner). `switch_flags`, `says` (plain words: the tab's chips), `with_word`, `flipped`, `slug` |
| `flow.gd` | `HSNpcFlow`: the markers read as a whole, nothing run. `board(quest)` (order and labels: "3", "4A", "4A.1"), `starts_of(marker)` (every place she can be when it starts: through ways and repeats, at most `MOST`), `end_of`, `stand_for` and `reach_of` (where she stands to sit, lie, put a hand out; the Animator's numbers from her record, else the constants), `walk_points` (the curve: centripetal Catmull-Rom, `STEP` apart), `seconds_of`, `speed_of(m, walk, run, dist, low)` (a low pace at its own speed: her record's, else `LOW_SPEED`), `problems(npc, clips, setters, tasks)` (the tab's Problems; `setters` null means the scene wasn't read; a v3 clip she lacks, an attack or a head at nobody, a head asked to follow with no Look plugin; `_hand_problems`: an Eat or a Drink with nothing named and an empty hand by then, what she holds followed through the quests in order), `flags_set`, `tasks_known` |
| `body.gd` | `HSNpcBody`: her body driven, a queue of steps (`path`, `follow`, `turn`, `clip`, `blend`). Port of the starter's motion.gd with paths. `setup` finds her clips (the record's names, else `GUESS` by name); `_play` plays a **copy** of a clip in a library of ours (`hsm`) on her own player, never changing hers; `walk` (speed, eased in and out, the floor under the path: three rays, the highest of here, 16 cm ahead and behind, eased), `sit`, `lie`, `reach`, `open`, `play`, `stand` (the loop she holds), `follow`, `clip_from` (a file: `.npz` through `res://kimodo/`, an Animation), `hide_now` (visible off, `process_mode` disabled) / `show_now`, `interrupt`, `snapshot` / `restore`, `sit_now` / `lie_now` (straight into a state). With `preview` it never touches a node of the scene (no thing taken, no door used). **Animations v3**: `LOW` (a low pace's loop, the loop she rests in after, its speed), `gait_pace`, `walk`/`follow(..., gait)`, `is_low`, `_rest_for`; the Look plugin's pieces by script path (`LOOK`, `look_script`: never by class name, the project may not have it): `ik()` her `HSHandIK`, `head(on, target, range)` her `HSHeadTrack`; `_take` holds a thing by its grip (`held_grip`, `held_side`; her fingers closed to its size); `consume(what, thing, ...)` (taken first when it isn't held, then the clip with its mouth point brought to her lips at the clip's `bite`/`sip` moments; gone, kept or dropped), `attack(kind, target, left, times)` (a `follow` to where the blow reaches, the clip facing them until just before its `hit`, her knuckles or the held thing's `tip` brought onto `aim_point(target)`; `_land`: within `hit_m`, `on_struck` and the target's `take_hit` or `struck`), `scare(kind, toward, cut)` (no blend; over at the clip's `over` event with `cut`), `scare_info`; a clip step's `bring` (`_bring_start`: what HSHandIK carries where, by the clip's own moments), `face`, `until` **Short characters** (docs/ANIMATOR_V3.md §10): nothing here knows her size; her clips do. `most_lift(m)`: 12 cm onto a seat or a bed higher than her clip was made for, 30 when the clip's record says `high` (her legs hang). `open` brings the middle of her closed hand onto the pin from the clip's `grab` to its `release` (`_bring_start`'s `"handle"`). |
| `face.gd` | `HSNpcFace`: expressions on MHR's shapes (`MHR`) or ARKit's (`ARKIT`), the Studio's presets (tools/character/arkit_mhr.json; regenerate both tables from it when it changes); `wear` (kept), `flash` (for a moment), a face clip from `res://faces/` read as text (`read_clip`: it needs no script from the runtime add-on); her lids go to her blinker's `hold` |
| `runner.gd` | `HSNpcRunner`: §6. `tick(dt)`: quest switching (`_quest_switch`: a later quest with a Starts when cuts in; the next in order when finished and not `halted`), a stack of containers (`_advance`), a marker's `gate` → `run` → `stay`; `_start` (per kind), `_run_done`, `_stay_done`, `_finish`; talking (`use`, the talk body on layer 2, `conversation()`, once per visit: `asked`); looks (`_wear_look` keeps `_look` so a later marker's eyes keep the skin); phase in/out; shot (`_on_hit`, `_on_down`: the three policies); checkpoints (`snapshot`/`restore`, hooked to the Story's `kept` and `revived`); `jump_to(marker, snap)` (the stack rebuilt from the marker's place in the tree; `_snap` puts her in each earlier marker's end state); `preview`: gates pass after 0.7 s, notes instead of effects, `over` when done. **Animations v3**: `_start`'s `attack` (the target `attack_at` or the player; in the tester the clip alone, with a note), `_run_done`'s `scare` (placed, turned to you with `face_player`, `body.scare`, `npc.scared` and the group `hs_scare` once, hidden after unless `scare_stays`), a Grab's `eat`/`drink`, a Walk's low pace; **her head** `_head` (`{on, range, at}`: set by the last marker whose `head` isn't `keep`, `_head_from`, `_head_apply`; in `snapshot`/`restore` and `_snap`); a Wait with no loop of its own keeps a low rest; `npc.struck` from the body's `on_struck` |
| `talk_box.gd`, `talk_body.gd` | `HSNpcTalkBox` (one CanvasLayer under the root, made at first need: a conversation's stages, lines → the answers → the reply; `advance` (E: the next line now), `select`, `confirm`, `pick`, `close`, `prompt(key, verb, who)`, `caption`, `showing`; the checks call those). **It draws nothing of its own style**: with an `HSHud` in the scene (`hud()`: found by its script's name, looked for at most once a second) a line is the HUD's `line`, the answers its `choose` (`_ask` awaits it; `pick` goes through the HUD's `choice_pick`), the prompt its `set_cursor`; with none it draws the HUD's footer again, number for number (`FOOT_REST`, `FOOT_CHOOSING`, the scrim, the serif from the UI plugin's `theme.gd`, the answers on one line with a dash, `DIM`, the ring and verb). Lines are timed by `read_secs`; the last line before the answers comes with them, as their question. And `talk_body.gd`: the StaticBody3D whose `use()` the starter's player finds |
| `plugin.gd` | the EditorPlugin: what the tab and the 3D view share (`cur_npc`, `cur_quest`, `cur`, `hidden`, `solo`, `all_quests`, `armed`, `picking`, `picks`) and every change to the scene, through `get_undo_redo()`: `set_prop`, `add_node`, `delete_node`, `move_node`, `place_node`, `add_character`, `add_quest`, `add_marker`, `add_bend`. `CARDS` is the palette (a card is a kind and the fields it starts with: Sneak and Crawl are a Walk with a pace, Eat and Drink a Grab with an action, Jump scare a `scare` turned to you). `set_force_draw_over_forwarding_enabled()` and `set_input_event_forwarding_always_enabled()`: it draws and hears the mouse whatever is selected. **Two undo signals** (measured in 4.7): a commit says `history_changed` (`_on_history`: the tab's `changed(own)`, own when the tab's form made it: `set_prop`, `set_props`, `place_node(..., own)`), an undo or a redo says `version_changed` (`_on_version`: never own) |
| `editor/dock.gd` | the tab (an EditorDock, bottom): built in `_ready`, filled from the scene by `refresh()`; the storyboard a Tree (drag to reorder: `_drop_spot`; `refresh_board` brings its rows up to date **in place** when they're the same rows, `_dress`, so nothing jumps while a field is typed in; when another marker is picked or the rows are made again, the picked one's row is scrolled into view, `_show_row`); `refresh_form` starts another marker's form at its top and leaves the same one's scroll where it was; the v3 rows: *The attack* (`PickWho`), *The scare*, *Head* (`PickHead`) in the face section; `set_who(m, field, node)` puts a node picked in the 3D view into a field (an attack's target, who a head follows: a click lands on a mesh, so it climbs to the character or the player it belongs to); `changed(own)`: the form's own change updates the rows and the quest's row at once and leaves the form's fields alone, anything else marks it stale (`_sig = "?"`) and asks the plugin for a look next frame (`look_soon`); the form built for what's picked (`refresh_form`; `REBUILD` lists the fields that change its rows; `_vals` notices a change from outside); `_put` is the form's setter (not `_set`: that's Object's). `candidates`, `problems`, `timing`, `set_target`, `add_way`, `ways_for_answers`, `_talks`/`_save_talks` are what the check calls |
| `editor/overlay.gd` | the 3D view: `draw(control)` (pins, badges, paths, arrows, handles, the legend; it fills `hot`: what can be clicked, by control) and `input(camera, event)` (place, pick, drag, turn, bend); `under_mouse` (the nearer of a collider and a mesh: a `TriangleMesh` a mesh, kept) |
| `editor/tester.gd` | the tester: a `_Ghost` copy of her (no owner), the real one hidden, an `HSNpcRunner` with `preview`; stopped by `_apply_changes` (a save, a play, a scene switch) |
| `editor/cond_edit.gd`, `editor/dial.gd`, `editor/glyphs.gd` | a condition as chips (`groups`: the scene's flags nearest first; `items`; `links`: one-gesture ties, each `[label, Callable(this editor)]`); the facing dial; the drawings (SVG strokes rasterised at the editor's scale, kept) |
| `logic.gd`, `logic_body.gd` | **flags and things** (docs/FLAGS.md): `HSLogic` (@tool, a Node under anything; `thing` for one kept elsewhere): `needs` / `locked_says`, `on` (`used`, `signal` + `on_signal`, `itself`), `once`, then `set_flags`, `tick`, `add_tasks`, `say`, `sound`, `fires`. `allows(by)` and `used(by)` are what the starter's player calls (its `logic_of(thing)`: the group `hs_logic`); `press(by)` for a thing with no `use()` of its own (`_reach`: a `_LogicReach` box on layer 2 with `logic_body.gd`, not round anything over `REACH_MOST` across); `run()`, `fire()`; `times` kept at the Story's `kept` and put back at `revived`; statics `may_use`, `was_used`, `of` |
| `scan.gd` | `HSLogicScan`: the scene read, nothing run. `FIELDS` (field name -> encoding: cond, conds, lock, switch, switches, flag, flags, task, tasks, task_flags, item, rules, talks), `PLAIN` (names only trusted on the studio's scripts), `fields_of(node)` (off the script's own property list: exported, the table's type; kept 3 s a script), `names_in(value, enc)`, `uses_of`, `scan(root)` -> `{flag, task, item, nodes}` of uses `{node, prop, enc, kind, name, role}`, `home_of` (whose a flag is), `place` / `what` / `role_says` (plain words), `renamed` / `rename_plan`, `deadlocks` (names that wait for each other: `_gate` is what a setter asks first), `problems(found, notes)`, `lines(v)` (a list field as lines, whatever the editor's stand-in says it is) |
| `flag_board.gd` | `HSFlagBoard`: one CanvasLayer under the root (`of(tree)`, a static keeps it one), the only place F7 is heard; with `HSNpc.debug` on it lists the scene's flags (on first, bright), the tasks, the pocket (`text()`, `read()`, `most`) |
| `editor/wiring.gd` | what the three tabs share: `found()` (the scan, kept until `touch()`), `names`, `uses`, `home`, `flag_groups(ctx)`, `problems`; the flags written down (`res://flags.json`: `notes`, `declare`, `set_note`, through undo); the Story (`story`, `starts_on`, `set_start`); `rename(kind, old, new)` ("" takes it out; one undo step; nodes another scene owns are skipped and said); `things()`, `logics(thing)`, `default_when(thing)`, `signals_of`, `logic_for`, `ask(node, word)`, `switch(node, word)`, `link_thing`, `link_marker`, `thing_of(clicked)`; `CARDS`, `cant`, `make(card, node, at)`, `setup_scene()`, `player_asks()` |
| `editor/panel.gd` | the base of the two new docks: the look, `_sec`, `_row`, `_text`, `_check`, `_pick`, `_lines`, `_cond`, `_switches`, `_name`, `field(node, prop, enc)` (a field drawn with the picker of its encoding), `_put` (the form's setter) |
| `editor/flags_dock.gd` | the Flags tab: `shows` (the filter tree: `filter` all, game, things, problems, `npc:<id>`, `quest:<id>/<label>`), `kinds`, `table`, `form`; `pick(kind, name)`, `rename`, `remove`, `use_on(node, flag, how)` are what the check calls |
| `editor/things_dock.gd` | the Things tab: the cards (`_card`, `made_thing`), `list`, `show_thing(node)` (it follows the scene's selection), the form (`_form_logic` per Logic, then the thing's own fields), `add_fire` |
| `editor/switch_edit.gd` | flags switched as chips (`add_flag(name, sign)`, `toggle_flag`, `set_at`, statics `parts`, `joined`) |
| `editor/inspector.gd` | the EditorInspectorPlugin: a field of the scan's table on any node drawn with chips or a name picker (`Field`); it changes through `plugin.set_prop` |

## Checking it

- `python tools/godot/markers_check.py [--reuse] [--only a,b]` (MARKERS): a by-hand project, the Animator's normal
  woman baked, `tools/godot/markers_test.gd` builds markers in code and plays them headless: every kind and every rule
  measured (stages order, gates, quests, talk, repeat, hide, sit, clips, speed, stairs, faces, looks, shot,
  checkpoint, event, you, problems, tester, v3: the low paces, her head, eating by a grip, an attack on you, a jump
  scare, their Problems; life: small movements standing, walking and sat, a marker's none and now and then, a
  checkpoint, a kept thing carried and put down, none while she's down, her Problems). Run it after any change to
  the runtime files, and after a change to the Look plugin's `head_track.gd`, `hand_ik.gd`, `grip.gd` or `gesture.gd`
  (the stages `v3` and `life` play them). **A character baked before the Animator's life clips has none**: a run
  with `--reuse` keeps the project's old bake, so after the Animator's `VERSION` goes up run it once without.
- `python tools/godot/markers_check.py --editor [--reuse] [--shots DIR]` (MARKERSEDITOR): `markers_editor_test.gd`
  installed as a plugin of its own drives the tab in the editor itself (headless): a character added, cards placed by
  clicks sent through the 3D view's own input, drags, undo, the form, a conversation into a Choice, who's shown,
  Problems, the tester, a save. Run it after any change to `plugin.gd` or `editor/`. `--shots` pictures the editor
  under xvfb (the guide's pictures).
- `python tools/godot/logic_check.py [--reuse] [--only a,b]` (LOGIC): a by-hand project, `tools/godot/logic_test.gd`
  builds things with a Logic and markers in code and plays them (gate, then, tie, checkpoint, scan, board, alone).
  Run it after any change to `logic.gd`, `scan.gd`, `flag_board.gd`, `cond.gd` or the starter's `player.gd`.
- `python tools/godot/logic_check.py --editor [--reuse] [--shots DIR]` (LOGICEDITOR): `logic_editor_test.gd` drives
  the Things and Flags tabs in the editor (cards, forms, both one-click ties, the list and filters, a rename and its
  undo, a flag written down and taken out, the Inspector's chips, a list field on a stand-in script), then
  `logic_play_test.gd` plays the scene they saved. Run it after any change to `plugin.gd` or `editor/`.
  `python tools/godot/logic_check.py guide DIR` gathers the guide's pictures (and `logic_shots.gd` makes F7's).
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
- **Her head and her hands are the Look plugin's, found by path** (`HSNpcBody.LOOK`), never by class name: a project
  without it still parses and plays (the clip as it was made, no head following; Problems says so). The IK is only
  ever a correction after her clip: a blow, a bite or a grab must already read right with it off.
- **In the tester nothing reaches into the scene**: an Attack plays its clip where she stands, a head is a note.
- **Her small movements and what she carries are the Look plugin's `HSGesture`, told what she's doing** (`body.gd`
  `gesture()`, `layer_tick()`, called by the runner every frame before `body.tick`, and with `quiet` while she's
  down): this driver plays her clips itself, so the layer can't read what she's doing off a loop's name. `_doing()`
  says "stand" (her idle, no loop of her own), "walk" (a path at a walk), "sit", else "busy"; a flourish is only
  ever started on the first three. Never made on the tester's copy (`set.preview`): they come when they like, and a
  preview must show the same thing twice. A new clip that uses a hand goes in `HANDS_OFF` (both) or `ONE_HAND` (its
  own) here **and in the starter's motion.gd**, or a carried thing stays in its carry pose through it.
- **An editor test that fails to parse hangs the editor** (the test plugin never quits it): parse it first
  (`--check-only`), and type every variable read off an untyped node (`var who: Node = dock.find_child(...)`).
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
- **A field's change goes through `plugin.set_prop` / `do_prop`**, never a bare `add_do_property`: a script that isn't
  a tool is a stand-in in the editor, and the stand-in refuses a `PackedStringArray` for a list nobody has set
  (`do_prop` sets an `Array` first). Read such a list with `HSLogicScan.lines()`.
- **A node made for the editor is `Node.new()` then `set_script()`**, never `Script.new()` (that runs the script for
  real in the editor). What's saved with the scene is decided once, when a node is first added (`_built`) or taken
  out (`_owned`): never what a node's script makes under itself.
- **A new field that names flags** goes in `HSLogicScan.FIELDS` with its encoding (and `SAYS`): the scan, the Flags
  tab, a rename, Problems, the Things form and the Inspector all read that one table. A name too plain to trust on
  anyone's script goes in `PLAIN`.
- **A flag is one name everywhere.** "Whose it is" is worked out for showing and for a Problem, never to fence a
  flag in: the user's point was to use a marker's flag on a door.
- F7 is heard by the flag board alone (each character hearing it flipped it once each).
- **A thing may get its script after its Logic is ready** (an interior's door: `interior.gd` sets `door.gd` in its
  own `_ready`, which comes after its children's). Anything a Logic needs of its thing's script (a signal, `use()`,
  `locked_says`) is looked for when it's needed or deferred with retries (`_listen`), never once in `_ready`.
