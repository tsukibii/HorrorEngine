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
the grade, the HUD's theme, `lighting: off` for a flat test light, the counters) with the levels under it, and its
`story_file` (`res://director/director.json`). The file (`story/story_file.gd` says its shape):

- **quests**, played one at a time in order. Each: a title, an `objective` (top left), its `steps` (the to-do list:
  a step's `done` and `fail` are the story format's triggers, STORY_FORMAT §4: picks up the key, enters the cellar,
  `{"gave": "lemonade", "to": "mari"}`, `{"holds": <condition>}`; a `wrong` answer for the wrong thing given, "Nah,
  that's not what I want", or a fail), `finish` (all its steps, `any`: the first done, or `never`: a moment's `done`),
  `on_start`, `on_done`, `start_at` (a spot), `map` (a level), a chapter `card`, `time_limit` and `on_timeout`, and
  **next**: the first `{"if": <condition>, "go": <quest or ending>}` that holds, else the next quest in the list.
  **A step only listens while its quest is the one on**: the light switched on and off before the quest doesn't count.
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
`picked:<item>`, `read:<note>`, `entered:<area>`, `left:<area>`, `talked:<id>` (a conversation begun), `heard:<id>`
(heard out), `answered:<talk>:<answer>`, `gave:<item>:<who>`, `step:<id>`, `failed:<id>`, `done:<quest>`,
`ending:<id>`, `achievement:<id>`, and your own flags. A condition is a fact (`"read:letter"`, `"!read:letter"`),
`{"all": [...]}`, `{"any": [...]}`, `{"not": ...}`, `{"quest": id}` (on now), `{"done": id}`, `{"step": id}`,
`{"count": name, "at_least": n}`, `{"karma": {"at_least": n}}`, `{"has": item}`, `{"ending": id}`.

## 3. The level

An **HSLevel** is a place: build it right under the HSGame, or as a scene of its own (its root an HSLevel) dropped into
the main scene. `start` is where the player begins (else a spot named start). **F6** on a level's scene plays it alone:
a free roam with its events, for testing a level before the story's there.

| Node | What it is |
|---|---|
| **HSRoom** | a floor, four walls and a ceiling from its `size` (the space inside; north is -z), boxes as your architecture is (DECISIONS 2026-10-30, evening). **A door put on one of its walls cuts its own opening**; `openings` are doorways and windows with no door. Its `floor_kind` is the footsteps'; its id is an area ("the player enters kitchen"); the lights inside it are the room's. Give it your own materials (a texture tiles by the metre). |
| **HSDoor** | a leaf on its hinges (or `sliding`) in a frame, its origin at the doorway's foot. It swings away from the player. `locked_by` an item's id (or `flag:<name>`), a `peephole`, a `latch` (a thumb turn to lock it from inside). Drop a door model in as its child to wear it instead. |
| **HSThing** | something to do something with (a part, §3b): `use` **pickup** (into the inventory; `item` its id, `flashlight` for the torch), **note** (a card to read), **inspect** (taken up in the hands and turned), **switch** (the lights of its room, or the ones it names), **breaker** (the power), **sit**, **sleep**, **hide** (a wardrobe, a locker), **carry**, **roll** (a die), **code** (a keypad; the right code sets its flag), **use_item** (an item used on it sets its flag), **clean** (a stain scrubbed by holding the button), **game** (a board game), **life** (a little thing: §3b), **none** (just a solid thing to name in events). Only its use's fields show. Put your model in as its child; a stand-in box shows until you do. `hidden_at_start`: out of the level until an event shows it. |
| **HSTrigger** | an area (a box on the floor, drawn in the editor only). An event inside it fires when the player walks in. `safe`: a watching character can't see the player in it. |
| **HSSpot** | a spot on the floor facing its +Z (the arrow): starts, marks, where a character is sent. |
| **HSPath** | a way a character walks: draw it with Godot's path tools (select it, Add Point, click the floor) or give it HSSpot children; `loop`, `pingpong` or `once`; `waits` at its points. |
| **HSActor** | a character: her model inside it (a Character Studio export, any rigged glb; none: a stand-in figure), facing her +Z. `behaviour` idle, sit (on a `seat`), path, patrol, or off (until an event brings her); `face_player`; `sees_player` (the suspicion meter, "caught"); `talk` (a click is heard as "the player uses <her id>"); `solid`; `idle_motion` and `walk_motion` (her AnimationPlayer's animations: a Kimodo motion brought in, §6b). |
| your lights | every OmniLight3D and SpotLight3D in a level is the story's by its node's name: a switch flips the ones in its room, the power cut darkens them, an event's Light or the lights dying finds them; a name with candle or fire burns on through the power cut. Light the level as you like (the look plugin's nodes and light zones work as ever). |

Everything a node makes for itself (a room's walls, a door's frame, the stand-ins) is made again when it changes and
never saved: the scene keeps only your numbers.

### 3b. Parts: your own models made things (DECISIONS 2026-11-01)

A **part** is an HSThing set to one use or one little thing, a scene each in the plugin's `parts/` folder
(`parts/make_parts.py` writes them): Pickup, Inspect, Note, Flashlight, Switch, Breaker, Seat, Bed, HidingPlace,
Carry, Die, CodeLock, UseItem, Stain, GameTable, Solid, and the 20 little things of `lives.json` (Kettle, Cup, Teapot,
Candle, Cigarette, Phone, Tap, TV, Clock...). Select your model in the scene and click the part in the dock's Add tab,
or drag the part's file onto the model in the Scene tree: either way the part takes the model's place and the model
goes inside it (`plugin.gd` `wrap_object`, one step on the scene's undo). Selected on a thing already, a part changes
what it is.

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

- **Director**: the Director file as the game will play it, read here (the Manager writes it): the quests in order with
  their steps and what comes next, the endings, the conversations, the moments, the states. While the game runs from
  the editor: ▶ the quest it's on, ✓ the quests, steps and conversations done, ● the facts. **▶** plays from the start,
  **▶ Here** from the selected quest with the facts typed under it (the quests before it count as done); **Manager**
  opens the file in the Director Manager.
- **Things**: items, notes, things to use, characters, rooms, areas, doors and their locks, spots, paths, levels,
  lights, with their ids.
- **Add**: the parts first (§3b: select your model, click what it is), then every level node as a button: a click puts
  it in front of the editor's camera, in the selected room or level; a **drag drops it into the 3D view**.
- **Check**: the game compiled as it will play: what's wrong (a quest that never ends, a next that goes nowhere), what's
  worth a look (a quest nothing leads to, a trigger naming a thing the scene hasn't got).
- **Kimodo**: §6b.

Ids: every level node has one (the Inspector's ID): its name as an id when it comes in, following its renames until
you type one of your own. The plugin keeps every saved scene's ids (`res://.hsdirector/index.json`): the Manager's
pickers read them.

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
   names), saved as `motions/<her id>/<name>.res` in a `kimodo` library on her AnimationPlayer, and plays.

The retarget is the desk's (bodies.js): each limb bone pointed joint to joint with side axes from the positions (the
elbow's bend, the palm, the toes), so neither rig's rotation conventions nor its rest pose matter; the trunk turned by
SOMA's own turn from its rest (the character keeps her spine's curve); the hips' travel scaled by the legs. Measured
(DIRECTOR): onto SOMA every joint lands where the motion put it (0.00 cm); onto MHR every limb points SOMA's way
(0.00°), the hips at MHR's own height.

In the game: her `idle_motion` loops while she stands, `walk_motion` while she walks a path (with `idle_motion` at its
waits); an event's **Play motion** plays one once.

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
  with its steam at its moved spout, the ornament looked at, Mari's conversation before the key (each time, heard
  out), the key, the drink errand (the bottle refused, "Nah, that's not what I want"; the mug taken, its step ticked,
  an achievement), the conversation the story offers next (answered Yes, heard out: its step ticks), the state that
  sends Mari to the bedroom door, the locked door opened by the key, the bedroom entered, the night's quest ending on
  its first step (hiding in the wardrobe) and its next by what was done: the good ending;
- **Kimodo** (`tests/kimodo_check.gd`): an .npz round trip, the retarget onto SOMA and onto MHR, in place, the house as
  a stage from Mari;
- **a level alone** (`tests/alone_check.gd`): the house as its own scene played with F6's way;
- **the editor** (`tests/editor_check.gd`, as a plugin of its own): the sample opened with the plugin, every tab drawn
  (the Director tab the file's quests, steps, endings and moments), a cup part made from the dock and a pickup part
  dropped on a mesh (undone), a preset placed, a rename, the live marks (▶, ✓, ●), a save holding no story nodes and
  nothing the nodes make for themselves.
- **the guide**: every picture `guides/director/index.html` shows is in `img/` and every one there is shown, every link
  inside it lands, the project got its copy, and the dock's Guide button finds it.

The runtime's own checks (GDPLAY, GDTESTROOM, GDEXPORT) stay as they were: the export's games keep their boxes.

## 9. Not yet

- The Director Manager (the page that writes the Director file, with its Coverage) is the plan's next step
  (docs/GODOT_DIRECTOR_PLAN.md §4): until then the file is written by hand (the sample's is the example).
- A moment can't end the quest on early and send the story elsewhere yet (for later games: "if this happens, go there").
- Achievements are worked out and kept as facts; Steam (GodotSteam) when the user wants it.
- Faces (the expression library's clips in Godot) wait on the Character Studio's export carrying its face shapes.
- Fingers aren't retargeted (the hands keep their rest); MHR's twist bones keep theirs.
- A kit thing (`tools/kit`) or a CC0 library prop isn't one click yet: drop its glb into an HSThing.
- The desk can't open a Director game, and a Director game can't go back to the desk: the scene is the game now.
