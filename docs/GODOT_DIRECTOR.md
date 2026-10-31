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

## 1. From the writers' room to Godot

The chart (docs/WRITERS_ROOM.md) maps straight onto nodes; read it shape by shape and add the node:

| On the chart | In Godot |
|---|---|
| an act | an **HSChapter** (its card, its time of day) |
| a task | an **HSTask** (the objective), its to-dos **HSTodo**, its moments **HSEvent** |
| a scene, a talk | an **HSDialogue** with **HSLine**s; a talk's answers are **HSOption**s under its line |
| a choice | an **HSChoice** with an **HSOption** per way (`go_to` the step) |
| a secret, a scare | an **HSEvent** (in the area, on the thing, or in the task) |
| an ending | an **HSEnding** |
| a place | an **HSLevel** with **HSRoom**s, **HSDoor**s, **HSThing**s, **HSTrigger** areas |
| a character | an **HSActor** (her model inside it) |
| a thing (small, medium, large) | an **HSThing** with its use (a key to take, a note to read, a bed to sleep in) |

The dock's **Story** tab is that chart again, as the game will play it.

## 2. The story

The main scene's root is an **HSGame** (the title, the player's name, the time of day, the look, the camcorder tape,
the grade, the HUD's theme, `lighting: off` for a flat test light, the counters). Under it, the levels and the story,
grouped as you like (the sample keeps the story under a plain `Story` node).

**Steps play top to bottom** in the scene tree: a task, then the next step, and so on. That's the whole flow for a
linear game; reorder by dragging (in the Scene dock or the Story tab). Branches:
- an **HSChoice**: `by` flags (the first option whose `if_flags` all hold; the last with none is "otherwise"), by
  **act** (the player plays on until one option's `when` happens: through the front door or down to the cellar), or by
  karma; each option's `go_to` is the step it leads to;
- a dialogue's answer (**HSOption** under an **HSLine**) with a `go_to`;
- a task's `next` (skip ahead, rejoin a branch) and `on_timeout` (its `time_limit` running out: a death, a chase);
- an **HSEnding** ends its way (a `death` kind offers the retry from the last checkpoint).

**HSChapter**: its steps under it; a title card when it starts (the view dark, the title, an autosave), the time of day
from there on, the level its tasks play in unless they name their own.

**HSTask**: `objective` (the line at the top left), its **HSTodo** children (the to-do list under it: ticked in any
order by their `done_when`, or by an event's Tick; failed by `fail_when` or their `time_limit`; `hidden` ones count
without showing), `level`, `start_at` (an HSSpot: where the player is put; empty: they carry on from where they are),
`finish` (when every to-do is ticked, when an event says Finish task, or never: a free roam), `checkpoint`.

**HSDialogue**: a conversation played live, the eye the player's own (they can look round, and walk if standing; no
cuts: DECISIONS 2026-10-29). Its **HSLine**s in order: `who` (a character's id; empty: the player's thought) and the
words; `actions` run as the line starts (a light flickers on her line). **HSOption**s under a line make it a question:
two answers at most on its line (DECISIONS 2026-10-30, evening), each with what she says back (`reply_lines`), the
flags and karma it sets, and an optional `go_to`. A dialogue is a step in the list, or played by an event (Play
dialogue: talking to someone, a phone call).

## 3. The level

An **HSLevel** is a place: build it right under the HSGame, or as a scene of its own (its root an HSLevel) dropped into
the main scene. `start` is where the player begins (else a spot named start). **F6** on a level's scene plays it alone:
a free roam with its events, for testing a level before the story's there.

| Node | What it is |
|---|---|
| **HSRoom** | a floor, four walls and a ceiling from its `size` (the space inside; north is -z), boxes as your architecture is (DECISIONS 2026-10-30, evening). **A door put on one of its walls cuts its own opening**; `openings` are doorways and windows with no door. Its `floor_kind` is the footsteps'; its id is an area ("the player enters kitchen"); the lights inside it are the room's. Give it your own materials (a texture tiles by the metre). |
| **HSDoor** | a leaf on its hinges (or `sliding`) in a frame, its origin at the doorway's foot. It swings away from the player. `locked_by` an item's id (or `flag:<name>`), a `peephole`, a `latch` (a thumb turn to lock it from inside). Drop a door model in as its child to wear it instead. |
| **HSThing** | something to do something with: `use` **pickup** (into the inventory; `item` its id, `flashlight` for the torch), **note** (a card to read), **inspect** (taken up in the hands and turned), **switch** (the lights of its room, or the ones it names), **breaker** (the power), **sit**, **sleep**, **hide** (a wardrobe, a locker), **carry**, **roll** (a die), **code** (a keypad; the right code sets its flag), **use_item** (an item used on it sets its flag), **clean** (a stain scrubbed by holding the button), **game** (a board game), **none** (just a solid thing to name in events). Only its use's fields show. Put your model in as its child; a stand-in box shows until you do. `hidden_at_start`: out of the level until an event shows it. |
| **HSTrigger** | an area (a box on the floor, drawn in the editor only). An event inside it fires when the player walks in. `safe`: a watching character can't see the player in it. |
| **HSSpot** | a spot on the floor facing its +Z (the arrow): starts, marks, where a character is sent. |
| **HSPath** | a way a character walks: draw it with Godot's path tools (select it, Add Point, click the floor) or give it HSSpot children; `loop`, `pingpong` or `once`; `waits` at its points. |
| **HSActor** | a character: her model inside it (a Character Studio export, any rigged glb; none: a stand-in figure), facing her +Z. `behaviour` idle, sit (on a `seat`), path, patrol, or off (until an event brings her); `face_player`; `sees_player` (the suspicion meter, "caught"); `talk` (a click is heard as "the player uses <her id>"); `solid`; `idle_motion` and `walk_motion` (her AnimationPlayer's animations: a Kimodo motion brought in, §6b). |
| your lights | every OmniLight3D and SpotLight3D in a level is the story's by its node's name: a switch flips the ones in its room, the power cut darkens them, an event's Light or the lights dying finds them; a name with candle or fire burns on through the power cut. Light the level as you like (the look plugin's nodes and light zones work as ever). |

Everything a node makes for itself (a room's walls, a door's frame, the stand-ins) is made again when it changes and
never saved: the scene keeps only your numbers.

## 4. Events: when, if, then

The user's ask: "I want to be able to make my own events (for jumpscares etc) very easily too, like if person moves on
this area after they've ticked off these other boolean flags then we trigger this." An **HSEvent**:

- **when** (an HSWhen): enter or leave an area, use a thing, pick up an item, read a note, the task starts, a flag is
  set, look at something for a while, a question answered, caught, hiding, some seconds after another event, a to-do
  ticked (or every to-do), the flashlight or the power on or off, a door locked, something put down, a character
  arrived, or a custom trigger as the story writes it. **Left empty, an event inside an area is entering it, one on a
  thing or a character is using it.**
- **if**: `require_flags` (all set), `block_flags` (none set), `require_items` (held).
- **then**: its `actions` in order, each an HSAction whose fields change with its verb: say a line, think, the
  objective, set or clear a flag, give or take an item, show or hide a thing, a door (open, close, lock, unlock,
  slam), a light (on, off, flicker, dim; or a room's), the power, the flashlight, a sound (off the shelf, or a file of
  the project's), wait, fade, turn the player's eye to something, **jumpscare** (a hidden thing or character shown
  for a moment with a sting), a glimpse, knocks, the lights dying, a door slamming behind, a whisper, a swap while
  unseen, ask a question (two answers, each setting a flag), play a dialogue, move a thing or the player to a spot, a
  character's behaviour, play a motion, a to-do (add, tick, fail), finish the task, a chapter card, a checkpoint,
  karma, a counter, a little thing's state, music, a car passing, or a custom action. Each reads as its sentence in
  the Inspector and the dock.
- **once** (a playthrough) or every time (`every` seconds apart at least).

**Where it sits is when it listens**: inside a task, while that task is on; inside a chapter, through its tasks;
anywhere else (the game, a level, an area, a thing, a character), through the whole game. `only_after` holds it back
until the run has reached a step.

So the example is one event, in the hallway's area: `require_flags` read_letter, saw_the_photo; actions Jumpscare
(figure, 0.8 s), Think ("What was that?"), Set flag (saw_figure). The Events tab's **templates** make the common ones in
a click: a jumpscare in an area after flags (the area and a hidden figure made with it), the lights dying, a door
slamming behind, knocks, a whisper when looked at, a thought on picking up, a character to talk to, the task finished on
arriving, something shown once a flag is set.

## 5. How it plays

F5: the HSGame compiles its nodes (`compile.gd`): the flow in the tree's order, a chapter's card before its first
step, each task a stitch whose beats are its start (the player put at `start_at`, the to-do list, the objective, a
checkpoint), its to-dos' ticks and its events, plus the chapter's and the whole game's events (a once-event guarded by
a flag of its own, so it fires once a playthrough). Its levels are taken up as templates (their nodes set themselves up
only in the copy the runtime enters), and the runtime starts. Problems print to the console (and the Check tab shows
them before you play).

The player moves with **Godot's own physics** (`game.collision: physics`): whatever collides in the level (a room's
walls, a door's leaf, your models' collision, CSG with collision on) stops them and takes the cursor's click; a step
lower than 35 cm is walked up, a drop is fallen. A thing with no collider of its own gets a box round it for the click.

**F9** in the game: where the player is (the step, the level, what they look at), the objective and to-dos, the flags,
the items, karma and counters, the events as they happen.

## 6. The dock

Under the Inspector (a row picked in it is edited there; drag the dock elsewhere if you like). Everything it does is on
the editor's undo.

- **Story**: the quest log: chapters, steps in play order, a task's to-dos and events, a dialogue's lines, a choice's
  ways and where they go. **+ Add** puts a chapter, task, dialogue, choice or ending after the selected step (or in the
  selected chapter), a to-do or event into the selected task, a line into the selected dialogue, an option under the
  selected line or choice. Drag rows to reorder or into another chapter; ▲ ▼ and ✕. **▶** plays from the start, **▶ Here**
  from the selected step, with the flags typed under it set. While the game runs from the editor, ▶ marks the step
  it's at.
- **Events**: every event as its sentence, grouped by when it listens; ✓ on the ones the running game fired; the
  templates.
- **Flags**: each flag, where it's set and where it's checked; ⚠ one checked that nothing sets (a typo, or an event
  still to make); ● the ones the running game has set.
- **Things**: items, notes, things to use, characters, rooms, areas, doors and their locks, spots, paths, levels,
  lights, with their ids.
- **Add**: every node as a button: a click puts it in front of the editor's camera, in the selected room or level; a
  **drag drops it into the 3D view** where you let go.
- **Check**: the game compiled as it will play: what's wrong (a task that never ends, a way that goes nowhere), what's
  worth a look (a step nothing leads to, a flag never set), each clicked to its node.
- **Kimodo**: §6b.

Ids: every node has one (the Inspector's ID): its name as an id when it comes in, following its renames until you type
one of your own. Fields that name things suggest the scene's ids of the right kind as you type; the plugin keeps every
saved scene's ids (`res://.hsdirector/index.json`), so a level open on its own still suggests the story's.

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

Three ways to see it: the dock's ▶ and ● while the game runs from the editor (it sends the step, the flags and the
events through Godot's debugger), **F9** in the game, and every reached step is a flag of its own (`@<step id>`), so an
event can wait for "from this task on" (`only_after`).

## 8. The checks

`python tools/godot_director.py check` (**DIRECTOR**, about a minute): a fresh project with the sample, built by Godot
itself (`tests/make_sample.gd`), then
- **the game** (`tests/director_check.gd`): compiled, played headless to its good ending as a player would: the chapter
  card, the objective and to-dos, Mari's Kimodo idle on her MHR body, a wall that stops the player, the letter read,
  the shut door stopping them and opening, the figure's jumpscare in the kitchen's doorway after the letter (the user's
  example), Mari's line every time she's clicked, the key, the dialogue's answer, the locked door opened by the key,
  the bedroom entered, hiding in the wardrobe;
- **Kimodo** (`tests/kimodo_check.gd`): an .npz round trip, the retarget onto SOMA and onto MHR, in place, the house as
  a stage from Mari;
- **a level alone** (`tests/alone_check.gd`): the house as its own scene played with F6's way;
- **the editor** (`tests/editor_check.gd`, as a plugin of its own): the sample opened with the plugin, every tab drawn,
  a task added and undone and redone, the jumpscare template, a preset placed, a rename, the live marks, a save
  holding nothing the nodes make for themselves.
- **the guide**: every picture `guides/director/index.html` shows is in `img/` and every one there is shown, every link
  inside it lands, the project got its copy, and the dock's Guide button finds it.

The runtime's own checks (GDPLAY, GDTESTROOM, GDEXPORT) stay as they were: the export's games keep their boxes.

## 9. Not yet

- A choice by act's options can't be dialogue answers (use a dialogue's `go_to`); an event can't sit in a dialogue.
- Fingers aren't retargeted (the hands keep their rest); MHR's twist bones keep theirs.
- A kit thing (`tools/kit`) or a CC0 library prop isn't one click yet: drop its glb into an HSThing.
- The desk can't open a Director game, and a Director game can't go back to the desk: the scene is the game now.
