# HorrorStudio Markers

A character's whole part in the game, placed in the scene as markers: where she walks, where she waits, what she
grabs, when you can talk to her and what your answer changes, when she vanishes. For a Godot 4.7 game built by hand
(`tools/godot_byhand.py` puts it in every project, switched on). No code. The guide: `guides/markers/index.html`; the
design and its rules: `docs/MARKERS.md`.

## In two minutes

1. Put a character in the scene (a Character Studio export baked by the Animator; any model with animations called
   idle, walk, run works; one with none slides).
2. Open **NPC Markers** along the bottom. Select the character, press **+ Character**. An `HSNpc` node appears beside
   her with a first quest.
3. Click a card (**Walk**), then click the floor in the 3D view. A numbered pin in her colour: that's where she walks
   to. Click **Sit**, then a sofa's front edge. **Talk**, **Grab**, **Disappear**... Each marker is done in order.
4. Press **Try it** (or **Play** for the whole quest): a copy of her plays it in the 3D view.
5. Run the game. She does it.

## What a marker is

**Starts when** → what she does → **then**.

- *Starts when*: nothing (at once, after the marker before), or chips: a flag is on, a quest is open, after 3 s,
  you're near, you can't see her, she's been shot.
- What she does, by its card: **Start here**, **Walk** / **Run** / **Sneak** / **Crawl** (to the pin, through bends
  you add on the path, at her pace or in a time, over stairs; a creature's **Creep** and **Scuttle** are paces in the
  form; after a low pace she stays low), **Wait** / **Talk**, **Sit**, **Sleep**, **Grab** / **Pick up** / **Put down** /
  **Open door** / **Eat** / **Drink**, **Attack** (a punch, or a swing of what she holds, at you or anyone you pick),
  **Jump scare** (there, shown, gone: a lunge, a loom, a snap of her head, a claw up from all fours), **Animation** (one
  of hers, or a file: a Kimodo `.npz` dropped in `res://animations/`), **Event** / **Scare** / **Look**, **Choice**
  (ways by flags), **Repeat**, **Disappear** (hidden and switched off: no drawing, no animation, no processing, until
  a later marker needs her).
- *Then*: flags switched, a task ticked or added, a line, a sound, things fired (a scare area, a cue).
- On any marker: her **face** (and faces by flag), her **look** (skin and eyes, with the Look plugin), her **head**
  (it follows you, or someone you pick, within an arc: 160 degrees unless you set it, 80 to each side; carried on
  until a marker gives it back to her animation), her **small movements** (now and then, or none, from there on),
  and **You can talk to ... here**: her lines, your answers, each answer's flags, face and reply.
- On the character: **Small movements now and then** (how often), and how she **carries things**.

Her state is carried from marker to marker and quest to quest: where she stands, sat or asleep, low or upright,
hidden, her face, her look, who her head follows, what she holds. A quest that doesn't end in Disappear leaves her
where she is for the next.

## The cards from animations v3

Sneak, Crawl, Eat, Drink, Attack, Jump scare and the head want two things (docs/ANIMATOR_V3.md):

- **A character baked by the Animator since animations v3** (53 clips; open her in the Animator and press Bake again).
  On an older bake or another model, Problems names the clip she lacks at its marker.
- **The Look plugin** in the project (every `godot_byhand.py` project has it) for her head and her hands: the head
  follows by its `HSHeadTrack`; a thing is held, eaten, drunk from and swung by its `HSGrip` (add one under a prop:
  a ring where a hand closes round it, a handle for its thickness, a point for the side that's bitten or the rim, a
  point for the far end of a bat) and her hand is carried the last centimetres by `HSHandIK`. A prop without a grip is
  held by a guess from its size.

An Attack that lands says so: the HSNpc's `struck(target, kind)`, and the target's own `take_hit(by)` or
`struck(by, kind)` when it has one (the starter kit's player has: a fright).

## Life: small movements, and a thing kept in her hand

Pick the character in the tab and tick **Small movements now and then** (docs/ANIMATOR_V3.md §11): while she
stands, walks or sits at her markers she scratches her head, rubs her neck, looks at what's in her hand, stretches,
every 6 to 14 seconds unless you set it. They're laid over whatever she's playing (her legs go on walking, her seat
stays sat), never while a marker's own act has her, never while she's hidden or shot down. Any marker can switch
them from there on (its Head section: *as they were, now and then, none*): someone who turns on you is set to
*none* at the marker where it starts.

**A thing she keeps** (a Grab's Pick up with *Keep in hand*) **is carried** from there on, walking, sitting or
waiting: *Carries things*, on the character, says how (at the side, in front, to the chest, over the shoulder,
raised), or leave it to the thing's own `HSGrip` (its Carry and Upright: a cup that's drunk from is carried in
front of her, upright). The next Grab, Eat, Drink or Attack takes her hand and gives it back; Put down ends it.

Both want a character **baked by the Animator since its life clips** (96 clips on a person; Problems says when she
wasn't) and the Look plugin (its `HSGesture`). The tester's copy doesn't do them.

## The sequences' cards: one small movement, a thing changing hands, a peek

For the little scenes the guide `guides/sequences` is made of (docs/MARKERS.md §4):

- **Small movement** and **Look at it**: one of her small movements *now*, where the Life switch above is chance:
  she looks at what's in her hand, checks her wrist, scratches her head, stretches. Laid over whatever she's doing,
  so sat on the sofa she stays sat. The next marker waits until her hand is back; tick *Over what comes next* and it
  doesn't (she sets off and checks her wrist as she walks).
- **A Wait leaves her as she is**: sat, asleep, looking out past a wall. Sit → Look at it → Wait → Look at it is
  someone sat with a cup; only a marker that moves her stands her up.
- **Take from you** and **Hand to you**: no pin. Where she stands she turns to you and holds a hand out. *Take from
  you* takes a thing you carry, by its name in your pocket (a Pickup's Item), into her hand with the look your
  pocket had for it; kept there, an Eat or a Drink after it uses it. *Hand to you* puts what she holds into your
  pocket (or an item by its name alone, and money: a customer paying). To have her wait until you have the thing,
  give the marker *Starts when: you carry …*; to be asked first, put a Talk before it.
- **Peek**: click the foot of a wall's end; the arrow is the way of the look. She stands hidden behind the wall,
  leans out past its edge and stays looking; the next marker that moves her draws her back first.

They want the same two things as the cards above: a character baked by the Animator since its life clips, and the
Look plugin.

## In the 3D view

Each marker is a map pin in its character's colour, its kind's drawing in it, its number at its corner; an arrow shows
the way she faces; the path between pins is drawn with chevrons. Drag a pin (it rides the floor, a seat, a shelf under
the mouse), drag its arrow's tip round, click a + on a path for a bend, right-click a bend to delete it. The eye
beside a character in the tab shows or hides her markers; the ring shows only hers.

## In the game

- **E** on her when a marker says you can talk to her (aimed at her: a ring, *Talk* and her name). Her lines come one
  after another, each for as long as it takes to read (E or a click: the next now); then your answers on one line under
  the last thing she said, a dash between them, the one pointed at white and the other dimmed: **A / D** or the arrows,
  **Enter**, or a click. No panel, no numbers, two answers at the most: the studio's own style for lines and choices
  (DECISIONS 2026-10-30, evening). With an `HSHud` in the scene it's that HUD's own line, choice and ring; with none
  the plugin draws the same. You stand still meanwhile; she starts nothing.
- **F7**: over each character, their quest, their marker and what it's waiting for; at the left, the scene's flags
  (on: bright), the tasks, the pocket.
- Her flags: `talked:<name>`, `shot:<name>`, `down:<name>` (her name in small letters), set by themselves.
- It speaks the starter kit's Story's words (tasks, flags, items) and works without a Story (it keeps the flags).

## Flags and things: the markers tied to everything else

Two more tabs beside NPC Markers, and one node (the guide: `guides/flags/index.html`; the design: `docs/FLAGS.md`).

- **Things**: select a model and click a card: **Pickup**, **Note**, **Food**, **Show / hide**, **Quest marker**, or
  **Logic**; **Area**, **Scare** and **Checkpoint** go where you click in the 3D view; a **Rule** happens by itself.
  **Set up the scene** adds the player, the Story, the HUD and Sound a scene lacks. Every thing of the scene is in
  one list (what it is, what it works only when, what it does then), and the one selected has a form with chips.
- **Logic** (`HSLogic`, a node under anything): **Works only when** (flags, tasks, things carried: while they aren't
  so, E on the thing only says its line) → **When** (it's used; one of its own signals, a door's `opened`; by itself,
  once its needs are so) → **Then** (flags switched, a task, a line, a sound, things fired). On a plain mesh it also
  makes the mesh something to use with E: a button, a lamp.
- **One click ties a marker and a thing**: on a marker's Starts when, **+** → *A thing… (click it)*, click the door:
  the door turns a flag on when it's opened and the marker waits for it. On a thing's Only when, **+** → *A
  character's marker… (click its pin)*: the marker turns a flag on when it's done and the thing asks for it.
- **Flags**: every flag, task and thing carried the scene names, with who turns it on and who needs it; shown for
  everything, the game, one character, one quest, things, or problems. Type over a flag's name: it's renamed
  everywhere, one undo. **Use it** on what's selected, or on a thing you click. A flag picked is marked over every
  node that uses it in the 3D view.
- **Whose a flag is** is worked out from who uses it (one quest's, one character's, the game's); it can be pinned.
  A flag is still one name everywhere: that's what lets a marker's flag open a door.
- **In the Inspector** any script's `needs`, `*_when`, `locked_by`, `set_flags`, `fact`, `tick` are drawn with the
  same chips and pickers.
- **Problems**: a flag asked for and never turned on, a task nothing lists, a quest's own flag used elsewhere, and
  **things that wait for each other** (a key that needs her gone, who needs the door open, which needs the key).
- **F7** in the game also lists the flags (on: bright; off: dim), the tasks and the pocket.

A project from before this needs the newer player once: `python tools/godot_byhand.py install <project> --starter`.

## From a script (if you want one)

```gdscript
$"Alex markers".jump_to($"Alex markers/Night two/Walk")     # straight to a marker
$"Alex markers".marker_done.connect(func(m): print(m.name))
$"Alex markers".struck.connect(func(who, kind): print("she hit ", who.name, " with a ", kind))
HSNpcCond.set_flag(get_tree(), "met_alex")                   # a flag, with or without a Story
if HSLogic.may_use(thing, self):                             # ask a thing's Logic yourself (the starter's player does)
    thing.use(self)
    HSLogic.was_used(thing, self)
```

## Checking it

`python tools/godot/markers_check.py` (MARKERS: the game side) and `python tools/godot/markers_check.py --editor`
(MARKERSEDITOR: the tab, driven in the editor itself). Flags and things: `python tools/godot/logic_check.py` (LOGIC)
and `python tools/godot/logic_check.py --editor` (LOGICEDITOR: the two tabs driven in the editor, then the scene
they built played).
