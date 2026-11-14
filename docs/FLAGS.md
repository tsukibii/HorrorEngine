# Flags and things: one logic for markers and everything else

DECISIONS 2026-11-14, flags and things. The user, on the marker system once it was merged: "review and enhance the
horrorplugin, especially on how to easily tie in the marker system with other elements (interactables), maybe create a
new tab for global flags that can be filtered off of quests or maybe there are non-global flags too, if I make a marker
that depends on a flag to walk, it should be easy for me to use that flag elsewhere too for other game logic e.g. can
only itneract with door if this flag is also on ... Consdier what we mgiht be missing ... and build it. The goal is to
make an insanely fast workflow to build games".

This file is the review, the design and the plan. §1 is what was in the way, §2 to §7 the design, §8 the plan as
checkboxes (ticked as each is built and checked), §9 what's left.

It lives in the **HorrorStudio Markers** plugin (`GodotPlugins/HorrorStudioMarkers/addons/horrorstudio_markers/`): two
more tabs beside NPC Markers, **Flags** and **Things**, one node, **Logic** (`HSLogic`), and flag pickers wherever a
condition is typed. Games built by hand.

## 1. The review: what was in the way

The marker system already spoke the starter Story's words (`holds`): a flag a pickup sets starts a marker, a flag a
marker sets is heard by an area. So the tie existed. What made it slow:

1. **A flag was a word you had to remember.** The NPC Markers tab offered the scene's flags as ticks; everything else
   (a door, an area, a cue, a shown thing, a hunt) was a text field in the Inspector with a different name each
   (`needs`, `locked_by: flag:<name>`, `shown_when`, `when`, `fact`, `flags`...). One typo and nothing happens, with
   nothing to say why.
2. **Nothing showed a flag's two ends.** Who turns `alex_gone` on? What waits for it? You opened nodes one at a time.
3. **Most things couldn't ask.** A door could be locked by one flag; a pickup, a note, a seat, the laptop, a parcel, a
   gun on a table had no "only when" at all, and no "when it's used, switch this" either (a pickup could tick a task,
   a door could tick a task: each its own little set).
4. **Every flag looked global.** With three characters and a dozen quests there was no way to see just one quest's.
5. **Making an interactable was hand work**: find the right starter script, drag it onto the node, find its fields.
6. **In play, a marker that waits says what it waits for (F7); the flags themselves couldn't be seen.**

## 2. Logic: any thing speaks the markers' language

A node, **Logic** (`HSLogic`, `logic.gd`), put under anything. Three lines, the same three a marker has:

| | | |
|---|---|---|
| **Works only when** | `needs` | the condition's words (MARKERS §5: flags, `task:`, `on:`, `item:`, `!` for not). While they aren't so, E on the thing does nothing but say `locked_says` (with none of its own: the thing's own, a door's "Locked.") and play `locked_sound`. Empty: it always works |
| **When** | `on` | **it's used** (E); **one of its signals** (`on_signal`: a door's `opened` or `closed`, a pickup's `picked`, an area's `body_entered`, which counts only for the player); or **by itself**, the moment its needs come to be so. `once`, or every time |
| **Then** | | flags switched (`set_flags`: `+a, -b, ~c`), a task ticked (`tick`) or put on the list (`add_tasks`), a line (`say`), a sound, things fired (`fires`: their `fire()`, `start()` or `use()`) |

The thing is its parent (or `thing`, for a Logic kept somewhere else). So:

- *"can only interact with the door if this flag is on"*: the door's Logic, *Works only when* `alex_gone`.
- *a marker waits for a door*: the door's Logic, *When it's `opened`, then* `+cellar_open`; the marker's *Starts when*
  `cellar_open`.
- *something happens by itself once two things are so*: a Logic on its own, *by itself*, needs `has_key, task:power`.

A Logic made in the tabs is set off by what the thing does when nobody says otherwise: a door when it's **opened**
(not when it's only tried, locked), an area when it has done its own thing or you walk in, anything else when it's
used (`default_when`).

**How it's asked.** The starter's player (`player.gd` `use()`) finds what E is aimed at as before, then asks that
thing's Logic nodes (`allows`): one that says no has said why, and the thing isn't used. After the thing's own `use()`
it tells them (`used`). That one place covers everything with a `use()`: the starter's doors, pickups, notes, seats and
food, the devices plugin's laptop and parcels, the weapons plugin's pickups, your own scripts. A script that uses
things itself: `if HSLogic.may_use(thing, self): thing.use(self); HSLogic.was_used(thing, self)`. A project whose
`starter/player.gd` is from before this is told once in the output, and in the Things tab's Problems.

**An interior's doors.** A door that came with an interior's export (`doors/door_<id>`) has no script in the editor:
the starter's `interior.gd` gives it `door.gd` as the game starts, which is after a Logic under it is ready. So the
Logic looks for its thing's signal again for a couple of seconds before saying it's missing; the tabs know such a
door as a door (it's in the Things list, a Logic made for it is set off when it's *opened*, a click on its mesh finds
it); and giving a node inside an instanced scene a Logic switches that instance's Editable Children on, since
otherwise the scene couldn't keep it.

**Dying.** The Story's checkpoint puts flags back; a Logic keeps how often it had fired at the checkpoint and goes
back to that, so a flag a death took away is set again the next time.

**With no Story** the flags are the plugin's own (as a marker's are).

A Logic is also something to fire: a marker's *Fires*, an area's Target or a signal calls its `fire()` and its Then
happens (while its needs are so).

**A plain mesh becomes something to use.** A lamp, a button, a painting has no `use()` for E to find. A Logic set off
by *it's used* gives such a thing a box round what's drawn (on the layer only E's aim finds: nobody walks into it),
and E on it is "it's used": one card makes a button that flips a flag. Not round anything over 6 m across (a Logic
left under a whole room would take every E in it): that's said in the output instead.

## 3. The scan: every flag's two ends

`HSLogicScan` (`scan.gd`) reads a scene without running it: every flag, task and thing carried, and for each every
**use**: which node, which field, and what the field does with it (*needs it on*, *needs it off*, *turns it on*,
*turns it off*, *flips it*, *on at the start*; for a task *ticks it*, *puts it on the list*, *needs it open*; for a
thing *gives it*).

One table (`FIELDS`) says which fields hold names and how: a marker's Starts when, its conversations' answers, its
face rules, its Then; a quest's Starts when; a way's flags; a Logic's lines; and by field name on any script: `needs`,
`*_when`, `*_needs`, `locked_by` (a door: `flag:<name>` or a thing's name), `set_flags`, and on the studio's own scripts
also `when`, `flags`, `fact`, `flag`, `tick`, `item`, `tasks` (the plain names aren't trusted on a script of yours: a
`flags` there may be a number). A new script that names its fields the same way is read with no change.

From it:
- **whose a flag is**, worked out, never typed: used only inside one quest's markers, it's that quest's; only by one
  character, hers; by a thing or by two characters, **the game's**. That is the user's "global" and "non-global": a
  flag is one name everywhere (so it can always be used elsewhere, which was the point), and the tab can show just a
  quest's. A flag can be **pinned** to a quest or a character (`res://flags.json`): then using it outside is a Problem.
- **what can't work**: a flag asked for and never turned on; one switched and never asked for (a tip); a task used and
  never put on the list; a pinned flag used outside its home; a flag written down and used nowhere; and **names that
  wait for each other** (`deadlocks`): for every flag, task and thing carried, what *everything* that could make it
  so asks first (a marker's own condition and its quest's, a thing's Logic, a door's own lock); a circle in that is
  said once, with who asks for what: "'door_opened', 'cellar_key' and 'ann_walk_done' wait for each other, so none can
  ever happen". (Found by the editor check's own scene, which had tied itself into one.)
- **a rename** that moves every use (inside a condition its `!` and prefix kept, inside a switch its sign), one undo
  step; **taking a flag out** of everything the same way.

Flags the kit sets by itself are known: `talked:<id>`, `shot:<id>`, `down:<id>` for every character with markers; any
other name with a colon (`hunt:night`, `sanity:shaken`) is taken as the kit's.

## 4. The Flags tab

A dock along the bottom beside NPC Markers. Three parts:

1. **Show**: a search box; *Everything*; *The game's*; each character and under each her quests (the flags that
   character's or that quest's markers touch); *Things* (what things use); *Problems*; and which kinds are listed:
   flags, tasks, things carried. **+ Flag** writes one down before anything uses it.
2. **The list**: a row a name: its kind, whose it is, *on at the start* (a tick: the Story's Flags Start), how many
   turn it on and the first of them, how many need it and the first, a mark when something's wrong with it.
3. **The one picked**: its name (typed over: renamed everywhere), a note, who it belongs to (worked out, or pinned),
   on at the start; **Turned on by** and **Needed by**, a row a use in plain words ("Alex › The missing book › 3
   Talk: an answer turns it on", "Door304 (door): needs it on"), each a click that takes you there (a marker opens in
   NPC Markers, a thing in Things and the scene); **Use it on the thing selected in the scene**: *needs it on*, *needs
   it off*, *turns it on when used*, *turns it off*; or **Click a thing…** in the 3D view for the same. Delete takes
   it out of everything.

While a flag is picked, the 3D view marks every node that uses it: a small flag badge over each, green where it's
switched, amber where it's needed.

## 5. The Things tab

1. **Make it a…**: cards for what the kit can make of the node selected in the scene: **Logic** (§2), **Pickup**,
   **Note**, **Food**, **Show / hide**, **Quest marker**, and things placed by a click in the 3D view: **Area** (an
   event when you walk in), **Scare**, **Checkpoint**; **Rule** (a Logic on its own, by itself). (As built: no Seat
   card, since the starter's seats are scenes dropped onto furniture; no Flag switch, since a Rule does that and more.)
   **Set up the scene** adds what a game needs and the scene lacks: the player, the Story, the HUD, the Sound node.
2. **The scene's things**: every node that asks or switches something, a row each: what it is, *works only when*,
   *then*. A click selects it.
3. **The thing picked**: its Logic as a form in plain words (*Works only when* as chips, what it says when it isn't
   so; *When* it's used / a signal from a list of the thing's own / by itself; *Then* flags as chips, a task, a line,
   a sound, things to fire), and under it **its own fields** from the scan's table, each with the picker of its kind
   (a door's *Locked by*, an area's *Needs* and *Sets*, a shown thing's *Shown when*...). No Logic yet: the first chip
   makes it.

## 6. Pickers everywhere

- The chips' **+** (`cond_edit.gd`) lists the whole scene's flags (this quest's and this character's first, then the
  game's, then what's written down), its tasks, its things carried; **New flag…**; and **A thing… (click it)**: click
  a door, a pickup, an area in the 3D view and the tie is made in one gesture: the thing gets a Logic that turns a
  flag on when it's used (a door: when it's opened; an area: when you walk in), named after it (`door304_opened`),
  and the chip asks for that flag.
- From a thing's side the same toward a marker: *Works only when* **+**, **A character's marker… (click its pin)**:
  the marker's Then turns a flag on (`alex_sit_done`) and the thing asks for it.
- Flags switched are chips too (`switch_edit.gd`): `+name` green, `-name` red, `~name` blue; a click turns one into
  the next.
- **In the Inspector** (`editor/inspector.gd`): any node's fields from the scan's table are drawn with the same chips
  and pickers instead of a text box: a cue's Needs, a shown thing's Shown When, a hunt's Ends When, your own script's
  `needs`.

## 7. In the game

F7 (the characters' chips) also lists, at the left of the screen, the flags that are on and the tasks, as they change:
why something waits can be read off the screen.

## 8. The plan

**A. Design**
- [x] the review, the design (this file), the user's words in DECISIONS

**B. The runtime**
- [x] `HSLogic`: works only when, when (used, a signal, by itself), then; a Logic elsewhere pointed at a thing;
      `may_use` / `was_used`; checkpoints; no Story
- [x] the starter's player asks a thing's Logic before it uses it and tells it after
- [x] `HSLogicScan`: the table of fields, the scan, whose a flag is, where a use is in plain words, what can't work,
      a rename and a removal
- [x] LOGIC (`tools/godot/logic_check.py`): a by-hand project played headless: gates, the three whens, a marker
      waiting for a door and a safe waiting for a marker, a checkpoint, the scan and its renames

**C. The editor**
- [x] flags switched as chips; the chips' menu with the whole scene's names
- [x] the Flags tab: show, the list, the one picked, new, rename everywhere, delete, on at the start, notes and
      pinning (`res://flags.json`), use it on the selected thing, marks in the 3D view
- [x] the Things tab: the cards, set up the scene, the scene's things, the thing's form (its Logic, its own fields)
- [x] the two gestures: a thing clicked from a marker's condition, a marker's pin clicked from a thing's
- [x] the Inspector's pickers
- [x] the NPC Markers tab uses the same scan, pickers and Problems (its Then's flags are chips too)
- [x] seen in the first pictures and fixed: Set up the scene had run the HUD inside the editor and saved its
      insides; the player, its flashlight and the HUD listed as things
- [x] things that wait for each other, as a Problem

**D. In the game**
- [x] F7 lists the flags, the tasks and the pocket; F7 heard in one place (two characters flipped it back)
- [x] a plain mesh with a Logic is something to use with E
- [x] an interior's doors (their script comes when the game starts): the Logic waits for the signal, the tabs know
      them, an instance's children made editable when one of its nodes is given a Logic

**E. Checked, written, shipped**
- [x] LOGICEDITOR: the two tabs driven in the editor itself, headless, and the scene they saved played as a game
- [x] MARKERS and MARKERSEDITOR still pass
- [x] `godot_byhand.py install --starter`; the guide `guides/flags/` with pictures of the real thing; the plugin's
      README and CLAUDE.md; CLAUDE.md, CONTINUE, LESSONS

## 9. Later

- the HUD's prompt over a thing that can't be used yet (now: its line when you try)
- flags kept between scenes of one game (now: a Story per scene)
- flags switched while the game runs, from F7's board (now: it shows them)
- the Flags tab's list live while the game plays from the editor (now: F7 in the game)
- cards for the rest of the starter kit (a seat on furniture, a cue, a hunt and its spots, the laptop, a parcel)
- a conversation's answers' flags as chips in the NPC Markers tab (now: a text box; its Then's are chips)
- tutorial v2 built with Things and Flags, to find what a whole game needs of them
- the Director's and the desk's games (they have their own facts and conditions)
