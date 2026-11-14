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
  until a marker gives it back to her animation), and **You can talk to ... here**: her lines, your answers, each
  answer's flags, face and reply.

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
- **F7**: over each character, their quest, their marker and what it's waiting for.
- Her flags: `talked:<name>`, `shot:<name>`, `down:<name>` (her name in small letters), set by themselves.
- It speaks the starter kit's Story's words (tasks, flags, items) and works without a Story (it keeps the flags).

## From a script (if you want one)

```gdscript
$"Alex markers".jump_to($"Alex markers/Night two/Walk")     # straight to a marker
$"Alex markers".marker_done.connect(func(m): print(m.name))
$"Alex markers".struck.connect(func(who, kind): print("she hit ", who.name, " with a ", kind))
HSNpcCond.set_flag(get_tree(), "met_alex")                   # a flag, with or without a Story
```

## Checking it

`python tools/godot/markers_check.py` (MARKERS: the game side) and `python tools/godot/markers_check.py --editor`
(MARKERSEDITOR: the tab, driven in the editor itself).
