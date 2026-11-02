# HorrorStudio Director: building the game in Godot itself

DECISIONS 2026-10-30, night: "rather than going from Director -> Export to Godot, we have all the easy drag and drop
functionality and filesystem set up that we can just rapidly build out the game in godot without a middle man... I
can just look through my writer block notes and build the game as I want in godot."

The Director is a Godot plugin (`GodotPlugins/HorrorStudioDirector/addons/horrorstudio_director/`). The game is the
nodes of a Godot scene: the level's (rooms, doors, things, areas, spots, paths, characters, your own lights and models)
and the story's (chapters, tasks, to-dos, events, dialogue, choices, endings). When the game plays, the plugin compiles
those nodes into the same story the export's runtime has always played (`tools/godot/addons/horrorstudio`), so the
controls, the interactions, the HUD, the menu, the saves, the flashlight, footsteps, hiding, the power cut, the little
things are the ones already built and tested; one runtime for both ways in.

## 0. Start

```bash
python tools/godot_director.py new ~/Games/MyGame --sample
```

That makes a Godot 4.7 project with the four add-ons (the Director, the runtime, the look, HumanShaders), the sound
shelf, the little things' lives, the balanced look's project settings and both plugins on, with the **sample house** as
`main.tscn` (leave out `--sample` for an empty game with one room). Open it in Godot: the **HorrorStudio** dock sits under
the Inspector, and **F5** plays the game. The add-ons are copies: after a pull, `install` puts the new ones in again
(`--link` makes them symlinks into this repo instead, so a pull reaches the project at once):

```bash
python tools/godot_director.py install ~/Games/MyGame
```

The launcher has both (`./studio`, the Godot section).

**The user's guide** is `guides/director/index.html` (DECISIONS 2026-10-31): every part in the order it's used, with
pictures of the sample made by Godot (`python tools/godot_director.py guide`: the game played and its editor pictured
under xvfb, `tests/guide_game.gd` and `tests/guide_editor.gd`). `install` copies it into the project's `guide/` (with a
`.gdignore`, never over a `guide/` of the user's own), and the dock's **Guide** button, or Project > Tools, opens it.
When a node, a tab or a word changes, change the guide with it, and make its pictures again if they show it.

## 1. The world and the story (DECISIONS 2026-11-01: "the director script just puppeteers the whole game")

**The scene is the world; the Director file is the story.** The scene holds your level: rooms, doors, your models made
things by parts (§3b), the characters, areas, spots, paths, lights, each with an id. The story is one file,
`director/director.json` in the project, written in the **Director Manager** (a page: `tools/director_manager`, the
dock's Manager button) and read when the game plays. Nothing in the scene knows the story; the story names the
scene's things by id. One world: the quests play where the player is, a new level only when the map changes.

From the writers' room's chart (docs/WRITERS_ROOM.md): a task is a **quest** (its steps the to-do list), a talk a
**conversation** on the person it's with (offered by condition), a choice a quest's **next** by condition (or a quest
that ends on its first step: hide or sleep), a secret or a scare a **moment**, an ending an **ending**, a place a level
with rooms, a character an HSActor, a thing an HSThing or your model with a part.

## 2. The story: the Director file

The main scene's root is an **HSGame** (the title, the player's name, the time of day, the look, the camcorder tape,
the grade, the HUD's theme, `lighting: off` for a flat test light, the counters; **the player**: `can_run`,
`can_crouch`, `eye_height`, the story's `game.player`, STORY_FORMAT) with the levels under it, and its `story_file`
(`res://director/director.json`). The file (`story/story_file.gd` says its shape):

- **quests**, played one at a time in order. Each: a title, an `objective` (top left), its `steps` (the to-do list:
  a step's `done` and `fail` are the story format's triggers, STORY_FORMAT §4: picks up the key, enters the cellar,
  `{"gave": "lemonade", "to": "mari"}`, `{"holds": <condition>}`; a `wrong` answer for the wrong thing given, "Nah,
  that's not what I want", or a fail; `guide`: a marker over what it needs in the game, `true` for what its `done`
  names, a talk's person included, or an id: the runtime's todo `guide`, STORY_FORMAT §4), `finish` (all its steps, `any`: the first done, `opening`: once what happens as it starts is over, or `never`: a
  moment's `done`), `list` (false: no to-do list on the screen, its steps counting unseen, a marker showing the way:
  the user, 2026-11-02, "quests shouldn't all be task based"),
  `on_start`, `on_done`, `start_at` (a spot), `map` (a level), a chapter `card`, `time_limit` and `on_timeout`, a
  **round** (`{"type": "hide", "secs": 30, "rule", "warn", "seeker", "spots", "on": {<result>: [actions]}}`, the
  story format's `play`, STORY_FORMAT §9.8: hide and seek, a chase, sneaking past her...: played instead of the steps,
  its result ending the quest), and
  **next**: the first `{"if": <condition>, "go": <quest or ending>}` that holds, else the next quest in the list.
  **A step only listens while its quest is the one on**: the light switched on and off before the quest doesn't count.
  **Every game starts with its Intro** (the user: "it always starts with a quest1 which is intro"): a new Director file's
  first quest (`HSStoryFile.INTRO`, `tools/godot_director.py` `INTRO_QUEST`), `finish: "opening"` and no list: what
  happens as the game opens (a chapter card, a thought, a look round), then the next quest. With no ending yet, the last
  quest goes on into a free roam (a game in the making keeps playing). A desk game brought in keeps its own opening.
  A finished step stays on the list, crossed out with a single line (a failed one in red).
- **states**: `{"while": <condition>, "set": {<id>: {...}}}`: what the world looks like while something holds: a
  person `at` a spot, what she `do`es (idle, sit, go `to` a spot, walk a `path`, patrol `paths`), `sees` the player or
  not, her `motion`; a thing `shown` or not, its `state` (a little thing's); a door `locked`, `open`; a light
  (on, off, flicker, dim). A later state's settings over an earlier one's. **The brain works them out again after every
  change and after every load**, so a save never leaves someone in the wrong place.
- **moments**: `when` (a trigger, or `{"holds": <condition>}`: the moment a condition becomes true), `if` (a
  condition), `do` (the story format's actions: a jumpscare, a thought, a sound, the lights dying...), `once` or every
  time (`every`), `during` (quests; none: the whole game).
- **talk**: each person's conversations in order, `{"id", "if", "once", "lines": [{"who", "text", "if", "do",
  "answers": [{"id", "label", "if", "sets", "karma", "reply", "go"}]}]}`: clicking her plays the first whose `if`
  holds (a `once` one goes when it's been heard out); a line or an answer with an `if` is said or offered only when it
  holds.
- **endings** (`kind`: good, bad, neutral, secret, death), **achievements** (`{"id", "title", "text", "hidden",
  "when": <condition>}`: worked out and kept as facts; Steam later, docs/GODOT_DIRECTOR_PLAN.md §6), **facts** (the
  ones you name and describe: hidden trackers, the Manager's list).

**Conditions** (`core/cond.gd`) read **facts**, which the brain writes down as the player plays: `used:<id>`,
`picked:<item>`, `read:<note>`, `entered:<area>`, `left:<area>`, `talked:<person>` and `talked:<id>` (she's clicked
and the conversation she offers begins), `heard:<id>` and `heard:<person>` (a conversation heard to its end; the
person's since the user's "for quests do we have talk to as a quest", DECISIONS 2026-11-01, evening: a step or a moment
waits for one through *Talk to…*), `answered:<talk>:<answer>`, `gave:<item>:<who>`, `step:<id>`, `failed:<id>`, `done:<quest>`,
`result:<quest>:<result>` (how its round went: `result:q_hide:found`), `ending:<id>`, `achievement:<id>`, and your
own flags. A condition is a fact (`"read:letter"`, `"!read:letter"`),
`{"all": [...]}`, `{"any": [...]}`, `{"not": ...}`, `{"quest": id}` (on now), `{"done": id}`, `{"step": id}`,
`{"count": name, "at_least": n}`, `{"karma": {"at_least": n}}`, `{"has": item}`, `{"ending": id}`.

## 3. The level

An **HSLevel** is a place: build it right under the HSGame, or as a scene of its own (its root an HSLevel) dropped into
the main scene. Its **Player start** is where the player begins in it (else its `start`, else a spot named start).
Its **Test start** is where a test begins (`HSDirector.testing`, raised by the HSGame for these): **F6** on a level's
scene plays it alone, a free roam with its events, for testing a level before the story's there; the panel's *Play
from here* on the Test start plays the whole game from the first quest in its level (the earlier quests counted done),
the player kept at the Test start rather than sent to that quest's `start_at`; *Try it* on a thing plays it the same
way with the player standing in front of the thing, facing it. Each begins with what its start `starts_with`.

| Node | What it is |
|---|---|
| **HSRoom** | a floor, four walls and a ceiling from its `size` (the space inside; north is -z), boxes as your architecture is (DECISIONS 2026-10-30, evening). **A door put on one of its walls cuts its own opening**; `openings` are doorways and windows with no door, a window's own words folded under it: `glass` (a pane; the rain runs down it in the rain), `daylight` (the sky's light coming in by the time of day, a soft spot just inside: the windows' fill a desk game's export has, on only where you want it), `shaft` (that light's beam in the haze, dust in it; `shaft_reach`, `shaft_dust`) and *A car passing* (`sweep_on`: headlights along the street outside now and then, `sweep_every` seconds apart, `sweep_out` metres out; an event's `sweep` fires one). `leaks`: water running down a wall from where it comes in (its side, along the wall, how high, its width, the seconds between drops): the wall wet in a band below it, the drips; shown in the editor. Its `floor_kind` is the footsteps'; its id is an area ("the player enters kitchen"); the lights inside it are the room's. Give it your own materials (a texture tiles by the metre). |
| **HSDoor** | a leaf on its hinges (or `sliding`) in a frame, its origin at the doorway's foot. It swings away from the player. `locked_by` an item's id (or `flag:<name>`), a `peephole`, a `latch` (a thumb turn to lock it from inside). Drop a door model in as its child to wear it instead. |
| **HSThing** | something to do something with (a part, §3b): `use` **pickup** (into the inventory; `item` its id, `flashlight` for the torch), **note** (a card to read), **inspect** (taken up in the hands and turned), **switch** (the lights of its room, or the ones it names), **breaker** (the power), **sit**, **sleep**, **hide** (a wardrobe, a locker), **carry**, **roll** (a die), **code** (a keypad; the right code sets its flag), **use_item** (an item used on it sets its flag), **clean** (a stain scrubbed by holding the button), **game** (a board game), **life** (a little thing: §3b), **none** (just a solid thing to name in events). Only its use's fields show. Put your model in as its child; a stand-in box shows until you do. `hidden_at_start`: out of the level until an event shows it. |
| **HSTrigger** | an area (a box on the floor, drawn in the editor only). An event inside it fires when the player walks in. `safe`: a watching character can't see the player in it. |
| **HSPlayerStart** | where the player begins (an HSSpot: a figure and the arrow they look along, drawn in the editor only): `start_for` game (the game's start in this level, over its `start`) or test (the Test start, above), `starts_with` the items they have with them (a key, the flashlight). One of each a level: the panel's card selects the one there. |
| **HSCheckpoint** | an area (an HSTrigger) that autosaves each time the player walks into it (the story's `checkpoint`, the pause menu's autosave slot): a moment of its own, compiled. |
| **HSSpot** | a spot on the floor facing its +Z (the arrow): starts, marks, where a character is sent. As a path's point (an HSPath's child): its `wait` (facing the arrow), the `pose` she holds while she waits (the pose library: look_left...), a hiding place she `check`s there (a locker's id: someone in it is found). |
| **HSPath** | a way a character walks: draw it with Godot's path tools (select it, Add Point, click the floor) or give it HSSpot children; `loop`, `pingpong` or `once`; `waits` at its points. |
| **HSActor** | a character (`cast`: the story's name for her when it isn't her id, as a desk game's cast member placed twice is): her model inside it (a Character Studio export, any rigged glb; none: a stand-in figure), facing her +Z. `behaviour` idle, sit (on a `seat`), path, patrol, or off (until an event brings her); `face_player`; `sees_player` (the suspicion meter, "caught"); `talk` (a click is heard as "the player uses <her id>"); `solid`; `idle_motion` and `walk_motion` (her AnimationPlayer's animations: a Kimodo motion brought in, §6b). |
| your lights | every OmniLight3D and SpotLight3D in a level is the story's by its node's name: a switch flips the ones in its room, the power cut darkens them, an event's Light or the lights dying finds them; a name with candle or fire burns on through the power cut. Light the level as you like (the look plugin's nodes and light zones work as ever). |

Everything a node makes for itself (a room's walls, a door's frame, the stand-ins) is made again when it changes and
never saved: the scene keeps only your numbers.

### 3b. Parts: your own models made things (DECISIONS 2026-11-01)

A **part** is an HSThing set to one use or one little thing, a scene each in the plugin's `parts/` folder
(`parts/make_parts.py` writes them): Pickup, Inspect, Note, Flashlight, Switch, Breaker, Seat, Bed, HidingPlace,
Carry, Die, CodeLock, UseItem, Stain, GameTable, Solid, and the 20 little things of `lives.json` (Kettle, Cup, Teapot,
Candle, Cigarette, Phone, Tap, TV, Clock...). Select your model in the scene and click the part's card in the
HorrorStudio panel (§6e) or in the Inspector's box, or drag the card onto the model in the 3D view or the Scene tree:
either way the part takes the model's place and the model goes inside it (`plugin.gd` `wrap_object`, one step on the
scene's undo). Selected on a thing already, a part changes what it is; This object's *Make it plain again* takes it
off (`unwrap_thing`).

A little thing (`use` **life**, its `life` and the state it starts in) plays its life in the game: the kettle that
boils by itself, the cup going cold, the candle you blow out. Its **effect points** (`spout`, `led`, `tip`,
`flame`...) are Marker3D children, made where a kit thing of its kind has them (`parts/life_points.json`, from the kit
by `tools/kit/life_points.mjs`) and then yours: drag the spout and the steam comes out there. The markers are the one
thing a node makes that's saved (they're your positions); a model put in after they're made moves the ones you
haven't touched. At play they're the life's sockets (`life_sockets`, the runtime's `lifefx.gd` reading a thing's own
`d.sockets` before the kit's), and the compiler hands the little things to the runtime (`life_things_data`).

## 4. Moments: when, if, then

The user's ask: "I want to be able to make my own events (for jumpscares etc) very easily too, like if person moves on
this area after they've ticked off these other boolean flags then we trigger this." A moment in the Director file:

```json
{"id": "figure_scare", "when": {"enter": "kitchen_doorway"}, "if": "read:letter",
 "do": [{"trick": "jumpscare", "figure": "figure", "secs": 0.9}, {"think": "What was that?"}, {"flag": "saw_figure"}]}
```

`when` is any trigger of the story format's (enter, exit, use, pickup, read, look, after, ticked, failed, state,
gave, rolled, played, peeping, carrying, dropped, arrived, power, torch, locked, caught, hidden, all, any) or
`{"holds": <condition>}`; `if` any condition; `do` any of its actions. Once a playthrough unless `once` is false.

## 5. How it plays

F5: the HSGame reads the Director file and compiles the world and the story (`compile.gd`, `story/story_compile.gd`):
each quest a stitch (its start: the player at `start_at`, the to-do list, the objective, a checkpoint, `on_start`;
its steps' triggers; its finish; the moments and the conversations listening in it), a chapter card before it, its
next a choice by flags when it has conditions, each person's conversations live scenes, the endings. Every
condition becomes one flag of its own (`?c<n>`) and each conversation's turn one (`?talk__<who>__<id>`), kept true or
false by **the brain** (`run/brain.gd`), so the runtime reads them as plain flags. The levels are taken up as
templates and the runtime starts, the brain beside it: it hears every event before the beats do (the facts first),
knows the quest on, works out the conditions, the conversations, the states and the achievements after each change
and each level entered. Problems print to the console (and the Check tab shows them before you play).

The player moves with **Godot's own physics** (`game.collision: physics`): whatever collides in the level (a room's
walls, a door's leaf, your models' collision, CSG with collision on) stops them and takes the cursor's click; a step
lower than 35 cm is walked up, a drop is fallen. A thing with no collider of its own gets a box round it for the click.
Someone who wants something (a `gave` trigger names her in the quest on) takes what's in the hand when clicked, instead
of talking.

**F9** in the game: where the player is (the quest, the level, what they look at), the objective and to-dos, the facts,
the items, karma and counters, the events as they happen.

## 6. The dock

Under the Inspector (a row picked in it is edited there; drag the dock elsewhere if you like). Everything it does to
the scene is on the editor's undo.

- **Director**: the Director file as the game will play it, read here (the panel's Story tab and the Manager write
  it): the quests in order with their steps and what comes next, the endings, the conversations, the moments, the
  states. While the game runs from
  the editor: ▶ the quest it's on, ✓ the quests, steps and conversations done, ● the facts. **▶** plays from the start,
  **▶ Here** from the selected quest with the facts typed under it (the quests before it count as done); **Manager**
  opens the file in the Director Manager.
- **Things**: items, notes, things to use, characters, rooms, areas, doors and their locks, spots, paths, levels,
  lights, with their ids.
- **Check**: the game compiled as it will play: what's wrong (a quest that never ends, a next that goes nowhere), what's
  worth a look (a quest nothing leads to, a trigger naming a thing the scene hasn't got).
- **Kimodo**: §6b.

Ids: every level node has one (the Inspector's ID): its name as an id when it comes in, following its renames until
you type one of your own. The plugin keeps every saved scene's ids (`res://.hsdirector/index.json`): the Manager's
pickers read them.

## 6a. The Director Manager (DECISIONS 2026-11-01: "an HTML tools folder that lets us manage our Godot stuff via a nice UI")

`tools/director_manager/` (`serve.py`, port 8796; the dock's **Manager** button starts it on the project and opens it; the
launcher's Godot section too): the page that writes the Director file, over the scene's ids (the plugin's
`.hsdirector/index.json`, written on every save; the sample maker writes it once). Its tabs:

- **Quests**: the list in play order (▲ ▼ to reorder; on an empty story, *The intro* first); a quest's id, title,
  objective, the level it plays on and where it starts, how it finishes (its opening over too: an intro), its steps as
  a to-do list or not, a checkpoint, a time limit and what then, a chapter card; its **steps** (the text, done
  when and fails when: the desk's own trigger dialog, *talk to…* (who, and when it counts, as the Story tab's *Talk to
  someone…*), or *or once…* for a condition becoming true; a time; hidden; asked
  by; *a marker over it*, the diamond in the game; for a `gave` step, the answer to anything else given and whether it
  fails); what happens as it starts and when
  it's done (the desk's command lists: the palette, the forms, the rows reading as sentences); **what comes next**:
  each way's condition and where it goes, otherwise the next quest.
- **People**: each character's conversations (offered when; once only; lines by who, said only if, commands as they
  start, up to two answers with their condition, the facts they set, karma, her reply, where they go) and her states.
- **Moments**, **States** (while; per person: what she does, at, to, the path, watching, her motion, seen; a door
  locked or open; a light; a little thing's state), **Endings**, **Facts** (each one asked for: where, what sets it,
  its note, hidden), **Achievements** (the Steam API name, the title, the hint, hidden, when).
- **Coverage** (`coverage.js`, shared with the page test): what's wrong (a quest that never finishes, a next going
  nowhere, a moment with no when, a quest or an ending nothing leads to, a fact asked for that nothing sets), what the
  story names that the scene hasn't got, and **what the scene has that the story never names**, by kind.
- **Saves**: the game's save slots (deleted one by one or all: a new game from nothing) and where the next play
  starts (a quest and its facts: Godot's play-from-here file).

Conditions have their editor (*add*: a fact, a quest on or done, a step ticked, an item held, a counter, karma, an
ending; NOT; *and*/*or*); triggers and commands are the desk's (`tools/director/commands.js` and `ui.js`, served from
the repo). A save keeps the version before it in `director/history/` (the last 50); a file changed on disk is taken in
when nothing's unsaved. **MANAGERPAGE**: `node tools/director_manager/pagetest.mjs` (a scratch project, every tab, a
quest with a palette-picked trigger, a condition, a conversation, a moment, a state, an ending, saved, Coverage, a save
deleted, the next play set).

## 6b. Kimodo, there and back

The user: "I have this room in godot, and a character... pass that room into kimodo and I can do the animation in
kimodo and pass it back to godot exported and ready to use."

1. Select the character (or a spot) and press **Send the selected character's room** (the Kimodo tab): the room she
   stands in and the rooms by it (or the whole level) go to Kimodo as its stage: floors, walls, doors with their swing,
   your things and meshes, the spots, the other characters and the player's start, from where she stands facing her
   +Z, scaled by Kimodo's body height over hers so a hand on a handle stays there after the retarget. It's the file
   `tools/kimodo.py stage` writes from a story (docs/ANIMATION.md, the demo's Stage panel), written where the demo
   opens it (`Saved/Kimodo/stage.json` in the studio folder) and kept in the project (`kimodo/stages/`).
2. **Open Kimodo** starts the demo (`tools/kimodo.py demo` in the studio) and opens it in the browser. Make the motion
   in the room; save it (Exports: NPZ, Download; or Send to Studio).
3. **Look for motions** lists the .npz files in the project's `kimodo/motions`, the studio's `Saved/Kimodo` and
   Downloads. Pick one, name it, tick **in place** for a walk the path moves her along and **loops** for an idle or a
   walk, choose whether it's her idle or walk, and **Import onto the selected character**: it's retargeted onto her own
   skeleton (the Character Studio's MHR, Kimodo's SOMA, Godot's humanoid profile after a BoneMap import, or Mixamo's
   names) and plays. The .npz goes into the project's animation library (`animations/<her id>/<name>.npz`, a card on
   the panel's Animate tab, §6g), the made animation into `animations/_made/<her id>/<name>.res`, in the `anims`
   library on her AnimationPlayer (`HSLibrary.make_for`; projects from before the library keep their `kimodo`
   library and `motions/` folder, still read).

The retarget is the desk's (bodies.js): each limb bone pointed joint to joint with side axes from the positions (the
elbow's bend, the palm, the toes), so neither rig's rotation conventions nor its rest pose matter; the trunk turned by
SOMA's own turn from its rest (the character keeps her spine's curve); the hips' travel scaled by the legs. **The
fingers** (DECISIONS 2026-11-01, "we do want to be able to retarget Kimodo's fingers") the same way: each finger bone
aimed along SOMA's own segment, its side the hand's across (the thumb's the palm's normal), onto MHR's, Mixamo's and
Godot's humanoid fingers; the joints paired by their place from the wrist at rest (SOMA's Index1 to Ring1 sit in the
palm; its Index2 is MHR's index1 and Mixamo's Index1; MHR's thumb0 is a base joint left as it is, its pinky0 SOMA's
Pinky1, the palm's cupping). The hand turns by SOMA's own palm (where its metacarpals start: they go only with the
hand), so a finger curling or the palm cupping never rolls it. Measured (DIRECTOR): onto SOMA every joint lands where
the motion put it, the fingertips too (0.00 cm); onto MHR every limb and every finger bone (32) points SOMA's way
(0.00°), the hips at MHR's own height.

In the game: her `idle_motion` loops while she stands, `walk_motion` while she walks a path (with `idle_motion` at its
waits); an event's **Play motion** plays one once.

## 6c. Faces (DECISIONS 2026-11-01: "a tool to export a facial animation and add it into Godot, a facial animation folder; the exporter should export the loopables separately")

The studio's **expression library** (`Content/Studio/Expressions/<id>/expression.json`: a captured face's ARKit
curves, made on **the Face page**, `tools/facecap`, or the desk's Expressions tab; the page's **For Godot** sends the
picked ones into a project: §6g) comes into a project as clips: `python tools/godot_director.py faces <folder>
[id ...]` (`node tools/face_export.mjs --project <folder> [id ...]`; a new project's `faces/` starts empty, DECISIONS
2026-11-02 night: "I'll just manually move over what I need every project"; `new --sample` brings the sample's two,
`from-desk` the ones its story puts on faces) samples each expression as the desk plays it (`tools/shared/face.js`:
its rest taken away, its strength, a loop's end crossfaded into its start) onto MHR's 72 face shapes, 30 frames a
second, and writes it as an **HSFaceClip** (`addons/horrorstudio/face_clip.gd`): `faces/<id>.tres`, **the loops apart
in `faces/loops/<id>.tres`** (a loop runs round, its last frame into its first). Only the shapes it moves are kept,
by Meta's names. FACEEXPORT (`--check`, in CHECKS) bakes the library and measures it: every weight 0..1, a loop's wrap
no bigger a step than its others.

They play through the story format's **`expr`** action (STORY_FORMAT §4: `{"expr": id, "who": person}`, `rest`, `loop`,
`w`, `in`, `out`): the runtime's `face.gd` finds the mesh carrying MHR's face shapes on her (by Meta's names, or the
plain MHR body's `shape_c_45` on) and plays it: what she **rests in** (a loop) and what plays **over** it (a capture
once, faded in and out; a loop until another takes over), crossfaded. In a Director game:

- an **HSActor**'s **expression**: the face she rests in (the Inspector suggests the project's loops);
- a **state**'s `expr` for a person: her resting face while it holds (the brain turns it into a resting `expr`);
- a **line**'s `expr` in a conversation: her face as she says it (a capture once, over her rest);
- a **moment**'s command *A face on someone* (the desk's palette: any `expr`).

The Manager's pickers list the project's faces (a line's *her face as she says it*, a person's *face* in a state).
Measured (DIRECTOR): Mari rests in `pout_and_glance_loop` on her MHR face shapes, moving; "You found it." wears
`pout_and_glance` over it.

**A Character Studio character's face**: the Studio exports her neutral, but every corner of her skin carries the MHR
points it rides (`_MHRP`, `_MHRW`: how the desk's face.js moves it), so `tools/face_morphs.mjs` bakes MHR's 72 face
shapes into **the copy a project wears** (`game/people/<name>.glb`, made by `install`, and by the desk game's Godot
export): each shape's move on every corner it touches, scaled by her height over MHR's, as sparse morph targets named
by Meta's names; a lash card turns whole about its eye as its root moves (as face.js turns it). Godot makes them blend
shapes; face.gd plays on them. What the desk adds that isn't a morph (the lids kept off the eyeballs, the eyes turned
by the gaze) isn't in Godot yet. FACEMORPHS (`--check`, in CHECKS): a made-up export of MHR's own face, its 72 morphs
MHR's own moves (0.0001 mm at worst), a lash card turned whole on a blink; Godot reads them as 72 blend shapes.

## 6d. A desk game as a Director project (the user, 2026-11-01: "when we export from director to godot it now follows this format/new system too")

`python tools/godot_director.py from-desk <Game> [folder] [--force] [--play]` makes a game written on the desk into a
Director project (`Saved/Godot/<Game>_director` unless a folder's given), the new system all through: the scene is the
world as the Director's own nodes, the story the Director file, editable in the dock and the Manager like any Director
game. The desk's own Godot export (§GODOT_EXPORT, the Godot button) stays as it was, for its checks and the levels
the user has lit by hand. `Content/Python/storykit/director_desk.py` writes the world (`director/desk_world.json`, in
Godot's axes) and the file; `desk/desk_build.gd` (in the plugin) builds the world as nodes in Godot, by their own code,
and saves `main.tscn`. What becomes what:

| The desk | The Director |
|---|---|
| a level (its `look`, `weather`) | an **HSLevel** with them, its start spot |
| a room (`at`, `size`, `skip`, its `look` sets) | an **HSRoom**: its inside (the desk's walls are 10 cm on its edges), its walls, a skipped stretch an opening, its texture sets as materials |
| an opening, a window (`window`, `sill`, `shaft`, `sweep`) | an **HSOpening**: `glass`, `daylight` (every window, as the export lights them), `shaft`, *A car passing* |
| a door in an opening | an **HSDoor** in it (`locked_by`, `peephole`, `latch`, sliding for a sliding kit door) |
| a prop with a use | an **HSThing** with that use (a locker `hide`, a combo `code`, `use_on` `use_item`, a kit little thing `life`), its fields, its model (a kit mesh, a library mesh, its art, else a box, a cylinder, a sphere, steps), its other words as `extra` |
| a kit mirror | a thing that reflects the room (the runtime's mirror) |
| a `leak` | one of its room's **leaks** |
| a light (`kind`, `flicker`, `mode`...), one with a `pattern` and an `aim` | an OmniLight3D with its words, an aimed **HSPatternLight** (the Look plugin's) |
| a spot, a trigger, a person | an **HSSpot**, an **HSTrigger**, an **HSActor** (`cast` the cast member she is; a cast member never placed gets one, off till the story brings her) |
| a route (`points`: `at`, `wait`, `pose`, `check`) | an **HSPath** with an HSSpot a point, each facing its spot's way |
| a stitch | a **quest**: its start beat's to-dos its steps, its objective, the rest `on_start`; its timer `time_limit` and `on_timeout`; its `play` its **round**; its other beats **moments** during it |
| a plain ending | an **ending** |
| a scene, a choice, any other flow node | an item that keeps the desk's node as it was (`desk`), played as the export plays it: shown in the dock and the Manager (◆), moved or taken out there, made again in the desk to change it |
| the scenes, lines, sounds, motions, secrets, interrupts, items, cast, the game's words | the file's `desk` part, as they were (the cutscenes play as the desk recorded them: the bake comes too) |

Its meshes, textures, kit sockets (`game/kit.json`), the bake and the cast's Studio characters come with it (the
faces and the face morphs too, §6c). **Not carried yet:** the trims and thresholds (a level's `trim`), a kit door's own
model (the HSDoor's leaf stands in), a level's `links`, the light zones the export makes per room. **FROMDESK**
(`--play`): the game played headless as its export's check plays it, on the Director project: the Pilot by GDPLAY's
walk to its good ending, TestRoom001 by GDTESTROOM's stations (every station, a death and its retry, the trigger
cutscene; `tests/gdplay.gd` and `tests/gdtestroom.gd` with `--director`); any other game is started and run a while.

## 6e. The HorrorStudio panel (the user, 2026-11-01: "a UI type of panel… more visually friendly, category sorted… drag and drop onto objects or click an object and assign"; the design: the canvas "Director Panel Design")

Along the bottom of the editor (`editor/panel.gd`, an EditorDock in the bottom slot; its ⋮ menu floats it on a second
screen), so the 3D view stays in sight and a card drags straight into it. Three tabs:

- **Build** (`editor/build_tab.gd`): everything a game is made of, as **picture cards** (`editor/glyphs.gd`: line
  drawings on tinted tiles, made from SVG at the editor's scale) in **categories** down the left with their counts.
  The cards are `parts/catalog.json`: each part, preset and ready-made scare with its words and the keywords a model's
  name is matched against; `parts/make_parts.py` keeps it whole (a part it makes that isn't listed comes in under
  *More*), so a new part shows up by itself. A card **clicked** goes in front of the editor's camera, in the selected
  room; **dragged onto a model** in the 3D view or the Scene tree it makes that model the thing (the 3D view drops
  where its physics ray lands, which misses a model with no collider, so `plugin.gd` `model_under_mouse` finds the
  model the mouse's ray meets on its triangles); with **a model selected**, one click makes it the thing (*Make it
  this*). Cards say their state: *It's this now* (the selected thing is it), *Make it this*, *Pick a model first* (a
  level node is selected). **Window** puts a window (glass and the sky's light) in the selected room's wall, the one
  the editor's camera looks at; **Scares** (a jumpscare, a knock, the lights dying, a door slamming, a whisper, a
  thought) make an area named for the scare and its moment in the Director file. The header **searches** every card
  (its title first, then its keywords and words) and shows **what's selected**. **This object** (the right column)
  says the selection in plain words: a model (*What is it?*, the parts its name suggests), a thing (what it is, how it
  starts, what the player can do, its effect points to click and move, or its use's fields; *Change*, *Make it plain
  again*), a level node (what it is; a room's *Add a window here*), and for each its **name in the story** (its id,
  edited there) and **what in the Director file names it**.
  **The Player category** comes first: the *Player start* (where the game begins), the *Test start* (where a test
  begins: F6, Play from here) and the *Checkpoint* (§3). A level has one start of each: its card says *One in House*
  and a click selects that one to move. **This object** on a start: *Which way they look* (eight ways, north the
  editor's -z), *They have with them* (the scene's items as chips, *+ Add an item*), the player's own settings for
  every level (*Can run*, *Can crouch*, *Eye height*, *Their name*: the HSGame's) and *Play from here*. On a thing,
  **Try it** plays the game with the player in front of it (the camera's side, facing it): `panel.gd` writes the
  play-from-here file (`user://hs_director_run.json`: `test`, `near`), the HSGame reads it once.
- **Story** (`editor/story_tab.gd`, the design's Story board): the Director file without JSON, in **the Director
  Manager's words** (`story/commands.gd`: the desk's `commands.js` and the Manager's `tools/director_manager/words.js`,
  through `story/commands.json`, which `tools/director_manager/commands_json.mjs` writes from them; GDScript can't run
  their sentences, so `commands.gd` says them again and DIRECTOR checks every example in the file reads the same).
  On the left the **quests in play order**, each with its steps (ticked and crossed out while the game runs from the
  editor, ▶ the one it's on; an intro says *its opening, then on*, a quest with no list *no to-do list*), *+ Add a quest*
  (on an empty story: the Intro), the **endings** (*+ Add an ending*: a title, a kind, its words), and *Open
  the Manager* for conversations, states, facts and achievements. In the middle the quest being edited (its title and
  what's on the screen, ↑ ↓ in the game's order), **how it ends** (when its steps are done, when any one is, when what
  happens as it starts is over: an intro, or when a moment ends it), **its steps as a to-do list on the screen** or not,
  **AS IT STARTS** (its opening's commands, as a THEN list) and **what happens in it, each a sentence**: its steps (*WHEN Mug is
  given to Mari, tick “Give Mari the mug”*, and the answer to the wrong thing given) and the moments that play in it
  (its own and the whole game's). One opens at a time: **WHEN** (*Talk to someone…*: who, and when it counts: she's
  clicked, she's heard out, or one of her conversations heard out, by its title or first line, kept as the talk facts
  `{"holds": "heard:t_open"}`; every trigger by its label, its blue words picked from the scene's ids; or *once a
  condition becomes true*), **ONLY IF** (the clauses as chips in words, *they've read
  letter*: a click says *not*, ✕ takes it away, *and*/*or* between them, *+ and…* offers every fact the scene and the
  file have), **THEN** (the commands in order, each its verb and its blue words, ↑ ↓ ✕, *+ Then…* by group), **HOW
  OFTEN** (*Just once*, *Every time*), **It reads as** (the whole sentence), *Try this moment* (the game from this quest
  as a test, the facts its ONLY IF asks for already done and its items in hand, the player standing by where it
  happens: the play-from-here file's `from`, `flags`, `items`, `near`) and *Show it in the 3D view* (what its WHEN names,
  selected). An open step also has its **MARKER** row: *Show a marker over it in the game* (the diamond bobbing over what it
  needs: the user, 2026-11-02, "a helper… so players can see the object", optional), over what its WHEN names or a thing,
  a person or an area picked (the step's `guide`). On the right the **ready-made moments** (the Scares cards, the flashlight's flicker too): clicked, onto the
  selected area, room, door or thing (WHEN the player enters it or uses it; a knock on that door, that door slamming),
  else with its WHEN to pick; dragged into the 3D view, onto the area it falls in or the door it falls by (the drop's
  new area taken back again), else into an area of its own there. Every change is written at once and is on the
  editor's undo (its global history: Ctrl+Z); words typed in a box are saved without drawing the tab again, so the
  click that left the box still lands.
- **Test**: *Play the game*, *Play this scene*, and the compiler's check.

**The Inspector's box** (`editor/inspector.gd`, an EditorInspectorPlugin): on a model of yours, *What is this?*, *Make it
a…* (every part by category) and the suggestions from its name; on a thing, what it is and *Change it to…*. The dock's
old Add tab is gone: the panel has everything it had. Measured (DIRECTOR's editor part): the panel in the bottom slot
with its categories and the Kitchen's 12 cards, a search, a model named OldSaucepan suggested a pot (the panel and the
box), made a pot by one click and its card saying so, made plain again and undone, the mouse's ray finding a model with
no collider, a window and its undo, a jumpscare card's area and moment; the Player category first, the sample's starts
selected by their cards, a start turned East and back, the mug put in its pocket and out, a checkpoint placed (an
area) and undone; the Story tab: the quests in order, the drink errand as sentences, a ready-made jumpscare clicked
onto the kitchen's doorway, a clause, a command and its words from the pickers, every time, what it reads as, Try this
moment's request, all of it undone, and a ready-made moment dropped inside the doorway landing on it (the new area taken
back); the Test page's Play buttons and its check of the game.

## 6f. Story Flow: the quests as a flowchart (the user, 2026-11-02: "a story flowchart tab… only a flowchart of the quests' flow… so I don't have to look through them one by one to see the prerequisites")

A main screen beside 2D, 3D and Script (`plugin.gd`: `_has_main_screen`, its button *Story Flow*), `editor/flow_tab.gd`
over Godot's graph editor (`editor/flow_graph.gd`). Every quest and ending of the Director file is a card, numbered as
the Story tab lists them, its title bar coloured by kind (the intro, a quest, a round; an ending by its kind; a desk
game's scenes and choices marked DESK; the free roam when the last quest has no ending), its objective (or *no to-do
list*, *its opening, then on*), its steps' count, its round, its time limit. The arrows are **the story as the
compiler plays it** (`story/flow.gd`, `HSFlow.chart`, plain data the checks read too): a quest's `next` in order, each
`if` a way out of its own in violet with its condition in the Manager's words, the first without one its *then* in
blue; with none, the next quest in the list, else the first ending, else the free roam (*then*, or *otherwise* in
grey-blue after its ifs); its time limit's *out of time* in amber; a desk choice's answers in teal; a desk game's trigger
cutscenes (`desk.interrupts`) as cards of their own hung off the quests they listen during, their jump in red.

**Laid out** (`HSFlow.layout`) left to right by how far into the story each card comes (the longest way there from the
start, loops left out), the main path (each card's *then* from the start) on top of each column, a long story wrapped
onto rows like lines of text (as many columns as the view shows at a readable size); an arrow going back to the left
(the next row, a loop) is drawn round the cards as a flowchart's line (out to the right, along the gap above the card it
goes into, in from the left, its corners rounded: `flow_graph.gd`, `_get_connection_line`). **Click a card**: on the
right, how the player gets there (every arrow into it: its prerequisites, lit on the chart; *The game starts here*;
*Nothing leads here* when nothing does) and where it goes. **Double-click** (or *Open it in the Story tab*): the panel's
Story tab on it. **Cards dragged**: every card's place kept in the file's `chart` (`{id: [x, y]}`, the editor's units at
scale 1; the Manager keeps it as it is), on the editor's undo; *Lay it out again* forgets them, *Fit the view* shows it
all. It reads and writes the file through the Story tab (its `f` and `change`; the tab's `changed` signal draws the
chart again), so the two never disagree, and it reads the file again when it changes on disk (the Manager saved it) or
the running game moves on (▶ on the quest it's in, ✓ on those done).

**Setting it up in the chart** (step 2; the user: "we should be allowed to set up the quests too in this flow (without
the detail)… set the branching up in the flowchart"; `HSFlow`'s edits, each inside the Story tab's `change`, on the
editor's undo): a right-click (or *+ Quest*, *+ Ending*) makes a card there (`add_quest`: at the end of the list, the
quest that was last keeping its way to an ending written down; the first of a file its Intro) and its title is typed on
it (F2 again); a way's dot dragged onto a card sends it there (`set_way`: a branch's `go`, a then written only when it
isn't the list's next anyway, a time limit's `on_timeout`), into empty space offers a new card there or *Take this way
away* (`cut_way`); on the right, the clicked quest's ways: each if's condition as the Story tab's chips, where it goes
picked from the cards, ↑ ↓ (the first that holds wins), ✕, and *+ A way: if…* (`add_branch`, before its then); Delete
(asked first) takes a card away (`remove`: a way into a quest goes on where that quest went, into an ending is taken
away; the quest's own moments with it); *Number them by the flow* (`renumber`) puts the list in the order the story
reaches them, every way written down first and made plain after, so the game plays the same (measured on the desk
games too). Measured (DIRECTOR's editor part): the main screen
found and shown, a card for each of the sample's six quests and two endings, its seven arrows, the night's branch in
words, the cards in reading order, a card's prerequisites and the start said, a card opened in the Story tab, a card
moved (every card's place kept) and undone; a new quest put and titled, the bedroom's then dropped on it and its own on
to the night, a branch on the key by a fact sent to it, the quests numbered by the flow with the same arrows, the new
quest deleted (the key's branch and the bedroom going on to the night), all eight changes undone.

**Easter eggs** (step 3; the user: "label easter egg quests (special hidden quests that might just be jump scares or
certain animations)… if you find the easter egg you can maybe skip a bunch of quests and jump straight to another
one"): a quest with `egg: true` in the Director file, out of the quests' order and numbers. It's found by its `found`
(a WHEN, the Story tab's own row) while one of its `during` quests is on (none: any; the free roam too), when its `if`
holds, once a playthrough; it plays its `on_start`, sets the fact `done:<egg>`, and when it has a `next` it jumps the
story there. Compiled (`story_compile.gd` `_eggs`, `_egg_jumps`) into a beat of each quest it can be found in (its
`_found_<egg>` flag keeps it once; the jump is the flag `_jump_<egg>` set last, which an interrupt of those quests
listens for: the runtime's trigger cutscenes, STORY_FORMAT §5.1, so no new word), and a `next` going to an egg is
refused. An egg has no steps of its own: its steps would sit in the quest's to-do list and keep the quest from
finishing; two eggs chain by one's ONLY IF asking for the other's `done:`. In Story Flow a gold card (*+ Easter
egg*, a right-click), wired from a quest's *easter eggs found during it* (`set_during`) and on by its *then* to the
card it jumps to (a skip); clicked, on the right where it's found, FOUND WHEN, ONLY IF, what it plays (the Story tab's
rows) and then. In the panel's Story tab under *Easter eggs* (*+ Add an easter egg*, DURING by name); in the Manager
*+ Easter egg* (Found when, Only if, During, Then, It plays), Coverage knowing them (found, not reached; no steps; a
missing FOUND WHEN); the dock lists them apart. The sample has two: *the cat's eyes* (the ornament put down, any time:
a thought) and *straight to bed* (the bedroom walked into during the drink errand: a thought, then the night). Measured:
DIRECTOR's playthrough finds the cat's eyes (its thought, the quest still on); a run from the drink errand
(`alone_check.gd --mode=egg`) finds both, the skip landing on the night with the errand, the talk and the bedroom's
quest left out; MANAGERPAGE makes one.

## 6g. The animation library and the Animate tab (the user, 2026-11-02: "an animation and facial animation tab to store animations… ideally I can just drag animations into the folders"; docs/GODOT_ANIMATION_PLAN.md, its step 1)

Two folders in every project, empty in a new one (the user copies in what a game needs): **`animations/`** for body
clips (Kimodo's `.npz` as Kimodo saves it, Godot animations `.res`/`.tres`/`.anim`; a folder named after a
character's id holds hers) and **`faces/`** for face clips (HSFaceClip `.tres`, the loops in `faces/loops/`).
`core/library.gd` (**HSLibrary**) reads them: `body()` (each clip's id, file, kind, who it's for, role, seconds, loop),
`faces()`, `ids()` (by file name alone, for compile.gd at play), a clip's **role** by its name's words (`role_of`:
stand up before idle's *stand*, *scared* a reaction before a scare's words; `MariStandUp` is a stand, `return_home`
other), a Kimodo clip's **figure** (`figure`: its body's 24 joints at up to 48 moments, the hips held over one spot,
seen turned 0.5 rad from the front; read once a file), and `res://.hsdirector/library.json` beside the ids' index
(written on every save, for the Manager's pickers to come). `animation_for` makes a clip an Animation for a character
in memory (an .npz retargeted onto her own skeleton by kimodo/retarget.gd, walks and runs in place, its loop by its
role; a Godot animation as it is); `make_for` gives it to her: saved as `animations/_made/<her id>/<clip>.res` and put
in the `anims` library on her AnimationPlayer (`anims/<clip>`, played by the runtime by its name: play.gd
`player_with`), the scene marked changed.

**The Animate tab** (`editor/animate_tab.gd`, the panel's third tab): Body and Face down the left with the folders'
buttons (each opens its folder in the file manager); the folders polled every 2 s while the tab is open (their files
and times: Godot's own scan skips an .npz, so a dropped one would never say so); the clips as cards in groups by role (Idle, Walk, Run, Sit, Stand up, Talk, Listen, Look & search,
Reactions, Scares, Other; the faces as Faces and Loops), each with its length and *loops* or *once*, a Kimodo clip
drawn as its figure (its start, middle and end faint to full; played while the mouse is over it), hers marked
(*hers*, a blue edge); This character on the right (her idle, walk and resting face, her clips). A card clicked with
a character selected, or **dragged onto her** in the 3D view or the Scene tree (it drags the spot preset; plugin.gd
`_unlink` with `pending_anim` takes the drop back and finds her: in the 3D view the character whose meshes' boxes the
mouse's ray meets, `actor_on_ray` (the panel's model picking leaves characters out), else the nearest within 1.5 m;
in the Scene tree the one it fell on): a menu, *Her idle*, *Her walk* (on the scene's undo), *Hers, for the story to
play*, *Look at it on her (▶)*; a face card *Her resting face*, *Look at it on her face*. **The preview** plays in
the 3D view on a player of its own (`_Preview`: no owner, a name with "_", never saved), the clip made in memory, a
face clip's weights on her face shapes from the tab's `_process`; both at once (the user: "make sure I can mix facial
data with kimodo animations": the body moves her bones, the face her blend shapes; they never fight); ■ puts her pose
and face back exactly, and so does a save (`_apply_changes`). The Kimodo tab's import lands in the same library.
compile.gd warns of a story `anim` naming a clip the character hasn't got (the Animate tab named when the clip is in
the library).

**A character's moves** (docs/GODOT_ANIMATION_PLAN.md step 3, §5): what she plays by what she's doing, so no one says
when. HSActor's `idle_motion` and `walk_motion` are two of them; the rest in `moves` (role → one of her motions, hidden
from the Inspector): `run`, `sit_down`, `sitting`, `stand_up`, `talk`, `listen`, `look_around` (`HSActor.MOVES`, with the
library role each takes). compile.gd writes them as the cast's `moves` (STORY_FORMAT §2; a move naming a clip she
hasn't got warned and left out) and her behaviour no longer carries a `motion`. The runtime (play.gd `npc_want`) picks:
a move begun once till it ends (her `sit_down` the moment her pose becomes a seat's from standing, `npc_seated`; her
`stand_up` when a behaviour takes her off a seat, the behaviour waiting till she's up: `start_at`); walking, the
behave's own `motion` or her walk (her run at 2.2 m/s or faster, `RUN_SPEED`); at a route's wait whose pose is look,
search or check, her look_around; a behave's `rest`; seated, her sitting; her talk while her line is up in a scene and
her listen while the player answers her (`speaking`, `listening`, set by scene_player.gd; a live scene's tick keeps
choosing while it holds play); else the behave's `motion` or her idle. An empty move falls back (`MOVE_FALLBACK`: run to
walk; sitting, talk, listen, look_around to idle; sit_down and stand_up to nothing), so a game always plays; a desk
game's export, with no moves, plays exactly as before. The library makes a clip once-only by its name (`loops`: down,
up, into, out...). **On the Animate tab**: a body card's menu offers every move (the one its name suits marked ✓); her
moves are rows on the right while she's selected, a card dropped on one or a click picking from her clips and the
library's that suit it (`HSLibrary.for_move`: the role, her folder first), **Fill the empty ones from the library**
(`fill_moves`), each on the scene's undo; This object (Build) says how many she has, with a button to them. Measured
(DIRECTOR): the sample's Mari has seven (a walk, sitting down, sitting, getting up, talking made on SOMA by
make_sample.gd, and the look round); on the tab her rows, the once-only ones by name, her talk cleared and filled again
and undone, sitting's clips first, her moves in the compiled story; in play her talk while "You found it." is up, her
idle while the player answers (no listen), her walk as she leaves, then on a seat sitting down once and sitting, and
getting up once before a 2.6 m/s walk (no run: her walk), held on the seat till she's up.

**On stage** (docs/GODOT_ANIMATION_PLAN.md step 4, §6; the user: "at this point npc is doing this, then if quest
complete they get up and walk here with this animation, you can talk to them here, they have this expression"): a
quest's `stage`, `{person: line}` (story_file.gd), the line `{do, at, to, then, path, paths, motion, expr, talk, walk,
leave, arrive, face}`: `do` stands at, sits on, walks to (then stands or sits: `then`), walks a path, patrols paths, or
isn't there (`off`); `motion` what she plays there (none: her moves); `expr` her resting face; `talk` the conversation
she offers in that quest ("": she's busy; none: as she does); `walk`, `leave`, `arrive` the in-between's own clips (walks
with, gets up with, arrives with); `face: "player"` faces you. **A line holds from its quest on, down the flow's ways
(each `next`, else the quest after it), until a quest with a line of its own for her** (`HSStoryCompiler.stage_cover`);
compiled into a state each (`while` any of those quests, marked `stage`), before the file's own states, which win;
`talk` narrows her conversations in its own quest only (`_talk_if`: a conversation belongs to its quest, so it isn't
carried). **The in-between plays by itself**: the brain (`_acts`) puts a line's motion and clips into her `behave`
(STORY_FORMAT §4 `walk`, `leave`, `arrive`), and a line that stands or sits her somewhere other than where the last one
had her walks her there (`go`, then idle or sit: her stand_up if seated, her walk, her sit_down; the first placing in a
level just puts her there); a state's `motion` with no place is still played once. **In the editor**: the Story tab's
quest view has ON STAGE above its steps, a row per character: her own line in blue words (what she does, where, doing,
face, talks, `…` for walks with, gets up with, arrives with and faces you, × to take it off) or the carried one in grey
(as in “The key”: …) with Change it here (a copy without its conversation); **Show on stage** moves everyone in the 3D
view to where the quest has them, playing what they do there (her line's motion, else her sitting or idle) on a
throwaway `_Staged` player, nothing saved, put back by ■ or before a save (`_apply_changes`); Story Flow's quest cards
show each line as a chip (Mari · stands at …). Measured (DIRECTOR): the sample's three lines (the Intro's carried to the
key's quest, the drink errand's to the talk and the bedroom, the night's) as states in order with the file's own last;
her conversations narrowed (the thirsty one in the errand, none at night); at night she sits down, then sits, and
offers nothing; in the editor the card's chip, her line in blue words, the carried one, changed here and undone, Show
on stage there and back.

**Paths and the walk between places** (docs/GODOT_ANIMATION_PLAN.md step 5): a path's stops (HSSpot children, or the
curve's points drawn with Godot's own path tools: select the path, Add Point, click on the floor) each have a `wait`
and now a `clip` (HSSpot `clip`, HSPath `clips` for curve points): what she plays while she stops there, as long as the
wait, or the clip's own length when there's none (the format's route point `clip`, STORY_FORMAT §2; the runtime's
`walk_route` and `npc_want`). This object (Build) lists a path's stops with a wait and a clip each (`_side_path`), and an
Animate card dropped on a stop in the 3D view or the Scene tree gives it that clip, made for whoever walks the path
(her behaviour's path or patrol, an On stage line's: `set_stop_clip`). **Walks go through doorways**: each level makes a
spot on both sides of every door at play (`<door>__in`, `<door>__out`, 0.6 m out: `HSLevel.DOORWAY`); compile.gd's
`_room_map` gives the brain each place's room and each door as a way between the two rooms it joins, and the brain's
`way(from, to)` finds the doorways a walk from one place to another goes through (fewest doors), which On stage's
in-between walks put in their `go` as `via`. Measured (DIRECTOR): This object's two stops of the sample's hall path, a
clip picked there and undone, a card dropped on a stop; in play Mari looking round at the path's stop, the way from her
place to the kitchen (the kitchen door's hall side, then its kitchen side), On stage's in-between to the kitchen as a
`go` by them, and her walk through the doorway into the kitchen.

**Reactions and scares** (docs/GODOT_ANIMATION_PLAN.md step 6): the Build tab's **Reactions** category (also among
the Story tab's ready-made moments): *Turns to look at you*, *Flinches*, *Screams*, *Points at you*, *Waves*, each a
moment on an area (a new one in a room, or an area or door picked in the Story tab) whose `do` is filled in for where
it lands (build_tab.gd `fill_ready`, shared with the Scares: `{room}`, a door's id, and a reaction's `{who}` the
nearest character in the game from the start, `{clip:words}` her clip by its name's words else the library's made hers
(none: she only turns), `{face:words}` a face clip by name (none: that command left out)). The runtime plays the
story's `anim` on someone in play as a **reaction** (play.gd `react`): the clip once through her `once`, her behaviour
held where she is meanwhile (no walking), turned to `face` (the player, a thing, someone) and back after; with no clip
she only turns, 2.5 s (`secs` sets it). A card from the Animate tab dropped on an area or a door someone reacts in
swaps that moment's clip, made for her (animate_tab.gd `set_reaction_clip`). The **jumpscare** grows `clip` (the
figure plays it, a figure with a body: the sample's MHR, its lunge), `expr` (a face on it) and `sound` (its own sting);
a character's **Caught** move (HSActor.MOVES) plays once, turned to the player, whenever she catches them. Measured
(DIRECTOR): the five cards, Flinches and Waves on the kitchen's doorway filled in for Mari (her flinch, her wave, turned
to the player, no face: the sample has no fitting one), a face found by its words, the look round dropped on the
doorway swapping the first reaction's clip, all undone; in play Mari's flinch held and turned to the player then back
to her idle and turned back, her caught move turned to the player, and the figure's jumpscare lunging with a face and
the short sting.

**The Face page** (docs/GODOT_ANIMATION_PLAN.md step 2; the user: "the tooling we are using in director to upload the
face videos... let's make it a separate page so I can save the facial mocap"): `tools/facecap/serve.py` (port 8797) is
the desk's own server loaded as a module with the page and two routes on top, so the library's endpoints (import,
accept, discard, set, loop, remove) are the desk's own and the two never disagree; the page is the desk's Expressions
panel (`tools/director/expressions.js`) with its characters made from `bodies.js` without the desk's stage (the default
MHR, a Character Studio export): Import a video of a face (solved by `tools/face_capture.py` on the machine), the
preview beside a character in sync, neutral, strength, length, a loop cut from a range, Accept into
`Content/Studio/Expressions`. **For Godot**: a project's folder (`?project=`, `--project`, or the last one; the ones
used kept in `Saved/facecap/projects.json`), the library ticked, Send: `tools/face_export.mjs` bakes them into its
`faces/` and `faces/loops/` (`HS_EXPRESSIONS` names another library), what the project has already marked. The
Animate tab's Face side has **Make face clips (the Face page)**: `dock.gd` `open_face_page` starts the page for the
project (the studio's Python, as the Manager's button does) and opens it. Measured (FACEMOCAP, `tools/facecap/
pagetest.mjs`, a scratch library and project): the cards the MHR head wearing each; a capture and a loop sent into
`faces/` and `faces/loops/` as HSFaceClips, marked, the project remembered; a card's preview moving the face's shapes,
renamed and saved; a folder that isn't a project refused; with `EXPR_VIDEO` an import (faces stay out of git). DIRECTOR:
the button there, its command the studio's page for the project.

Measured (DIRECTOR): the sample's two clips (`animations/mari/sample_idle.npz`, Mari's idle, made hers by make_sample
through `make_for`; `animations/look_around.npz`, anyone's) as cards in Idle and Look & search, each a figure of 40
moments; the roles of six names; its two faces on the Face side; Mari's idle *hers*, her idle and resting face read; a
story clip she hasn't got warned of (the library's named, the other not in the project), none after the look round is
made hers (its file there, `anims/look_around` on her player); the look round and a face on her at once in the 3D
view, her bones and face shapes moving between two moments, put back after (and the throwaway player gone); a card
dropped on her: her menu, the drop taken back; a Kimodo file copied in while the tab is open a card in a group of
its own, in the tab's order; a preview left playing stopped by a save, nothing of it saved. In play: her Kimodo idle on her bones and her face loop on her face
shapes, both moving in the same moment. (The sample's idle had been one frozen pose: a Skeleton3D out of the tree kept
its first pose, so make_sample now works out SOMA's joints itself; LESSONS.)

## 7. Where you are

Three ways to see it: the dock's Director tab while the game runs from the editor (it sends the quest, the facts and
the events through Godot's debugger), **F9** in the game, and the facts themselves: every quest reached is `@<id>`,
every one finished `done:<id>`, so a moment or a state can say "from this quest on" (`{"done": "q_key"}`).

## 8. The checks

`python tools/godot_director.py check` (**DIRECTOR**, about a minute): a fresh project with the sample, built by Godot
itself (`tests/make_sample.gd`: the house, and its story as `director/director.json`), then
- **the game** (`tests/director_check.gd`): compiled, played headless to its good ending as a player would: the chapter
  card, the first quest's objective and steps, Mari's Kimodo idle on her MHR body, a wall that stops the player, the
  letter read (its fact, its step ticked and crossed out), the shut door stopping them and opening, the figure's
  jumpscare in the kitchen's doorway after the letter (the user's example, a moment), the kettle (a part) switched on
  with its steam at its moved spout, Mari resting in a loop from the expression library on her MHR face shapes (§6c), the ornament taken up in the hands (turned by a drag, put back), Mari's conversation before the key (each time, heard
  out), the key, the drink errand (the bottle refused, "Nah, that's not what I want"; the mug taken, its step ticked,
  an achievement), the conversation the story offers next (answered Yes, heard out: its step ticks), the state that
  sends Mari to the bedroom door, the locked door opened by the key, the bedroom entered, the night's quest ending on
  its first step (hiding in the wardrobe) and its next by what was done: the good ending;
- **Kimodo** (`tests/kimodo_check.gd`): an .npz round trip (the motion curling the fingers too), the retarget onto SOMA
  and onto MHR (every limb and finger bone), in place, the house as a stage from Mari;
- **the test runs** (`tests/alone_check.gd`, a run each): the house as its own scene played F6's way (the player at its
  Test start with the bedroom key, the jumpscare, the bedroom's checkpoint autosaving), the whole game from the Test
  start (its first quest, the player kept there), and Try it (in front of the letter, facing it);
- **the editor** (`tests/editor_check.gd`, as a plugin of its own): the sample opened with the plugin, every tab drawn
  (the Director tab the file's quests, steps, endings and moments), a cup part made from the dock and a pickup part
  dropped on a mesh (undone), a preset placed, a rename, the live marks (▶, ✓, ●), a save holding no story nodes and
  nothing the nodes make for themselves.
- **the words** (`tests/words_check.gd`): `story/commands.json` up to date with the desk's `commands.js` and the
  Manager's `words.js` (COMMANDSJSON, `node tools/director_manager/commands_json.mjs --check`), and every example in it
  read the same by the panel's `story/commands.gd`;
- **the guide**: every picture `guides/director/index.html` shows is in `img/` and every one there is shown, every link
  inside it lands, the project got its copy, and the dock's Guide button finds it. `python tools/godot_director.py
  guide` makes the pictures again: the sample played (`tests/guide_game.gd`), its editor (`tests/guide_editor.gd`)
  and the Director Manager on it in a headless browser (`tools/director_manager/guide_shots.mjs`, MANAGERSHOTS).

The runtime's own checks (GDPLAY, GDTESTROOM, GDEXPORT) stay as they were: the export's games keep their boxes.
**FROMDESK** (`godot_director.py from-desk Pilot --play`, `from-desk TestRoom001 --play`, §6d): the same playthroughs
on the Director projects made from the desk's games.

## 9. Not yet

- Loading a save in the game: the pause menu saves where you are (the runtime's slots), but there's no Load yet, and a
  slot doesn't hold the facts; a death's retry and the checkpoints keep the run in play. The Manager lists and
  clears the saves and sets where the next play starts.
- A moment can't end the quest on early and send the story elsewhere yet (for later games: "if this happens, go there").
- Achievements are worked out and kept as facts; Steam (GodotSteam) when the user wants it.
- Faces on a Character Studio character (§6c): her copy's morphs carry the skin, brows and lashes; the lids kept off the
  eyeballs and the eyes turned by the gaze (the desk's) aren't in Godot yet.
- MHR's twist bones keep their rest (the forearm's and the upper arm's twist isn't shared along them).
- The desk can't open a Director game, and a Director game can't go back to the desk: the scene is the game now
  (`from-desk` goes one way, §6d: making it again replaces the project).
- From the desk (§6d): the trims and thresholds, a kit door's own model, the light zones per room.
- Animation (§6g, docs/GODOT_ANIMATION_PLAN.md's order): reactions and scares (6), cutscenes in the
  level with a soft lock and its safety release (7); FBX and glTF clips and a
  picture on a grey MHR body for each card (later); the story's pickers offering the library's clips not yet hers; On stage in the Manager, a line held on a fact, Story
  Flow's Cast lanes; a walk goes through doorways (§6g) but not round furniture, and a shut door doesn't stop her.
