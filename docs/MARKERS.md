# NPC markers: a character's whole part in the game, placed in the scene

DECISIONS 2026-11-13, the marker system. The user's mock-up (a Godot editor: a bottom panel "NPC Path & Animation
Sequencer", pins "1 Walk → 1-End, 2 Interact, 3 Walk, 4 Sit" joined by arrows in the room) and their words: "place
markers in the scene for each npc ... the markers correspond with the quests ... triggered based of order, if a boolean
flag is true ... chain them so they grab something, walk to the sofa, and sit ... the goal is that even a young child
would know how to use it".

This file is the design and the plan. §1 reads the picture and the request, §2 is what they left out, §3 to §9 the
design, §10 the plan as checkboxes (ticked as each is built and checked), §11 what's left for later.

It is a new plugin, **HorrorStudio Markers** (`GodotPlugins/HorrorStudioMarkers/addons/horrorstudio_markers/`), for
games built by hand: `tools/godot_byhand.py` puts it in every project beside the Look, UI, Weapons and Devices plugins.
It speaks the starter kit's Story's words (its to-do list, its flags) and uses the Animator's baked clips, and works
without either (its own flags, a character with any clips, a stand-in with none).

## 1. The picture and the request, read

| In the mock-up | What it becomes |
|---|---|
| NPC List, "NPC: Alex (Guard)" | **Characters**: every character with markers, each a colour, an eye to show or hide its markers, solo |
| Scene tree: "NPC: Path" beside "NPC: Alex" | an **HSNpc** node beside the character, holding her quests and markers as nodes (so they save with the scene, copy, undo) |
| Quest dropdown, New, Delete | her **quests**: a named group of markers, in order, each with what starts it |
| pins 1 to 4 joined by arrows | **markers** as numbered pins in the 3D view in her colour, the path between them drawn, an arrow on each for the way she faces |
| "1 Walk" and "1-End" | a Walk marker is **where she walks to**; it starts from wherever she is (the marker before), so nothing can jump |
| Marker Type: Walk Path, Interact, Sit, Wait, Run | the **kinds** (§4) |
| Boolean Flags Trigger: quest_active, has_item, daytime | each marker's **Starts when** (§5): flags, quests, things carried, and a few things about her and you |
| Start/End Position X/Y | the pin, dragged on the floor; numbers too |
| Face Direction, a 360° dial | the pin's arrow, dragged round; a dial in the tab |
| Add Marker, Remove Marker | a palette of cards to drop in the 3D view; Delete |

And from the words: a quest that doesn't end in Disappear leaves her where she is for the next; chains; curved paths;
only one character's markers shown, or several; walk speed, a loop's speed, how long A to B takes, easing into the
next animation; a Disappear that costs nothing while it's on; a Kimodo dance on a marker; stairs; branching by a
dialogue's answer with no bugs; a UI that's neither opaque nor too see-through; a tester in the viewport; jump scares;
eye and skin shaders; later markers inheriting her state; faces per marker and by flag; a marker that's "player
interactable" with its dialogue and answers that set flags; being shot, and whether the sequence goes on.

## 2. What the request leaves out, and what's decided for each

1. **Two kinds of "interact".** She interacts with things (grabs from a shelf): the **Grab** kind. You interact with
   her (E, a conversation): **You can talk to her here**, a switch on any marker where she stays put.
2. **Waiting has two meanings.** *Wait until* (she stays until something is so) and *only if* (skip this when it isn't
   so). The first is a marker's **Starts when**; the second is a **Choice** with ways. One list of flags doing both is
   where bugs come from, so they're separate things.
3. **What she does while she waits.** She holds what she's in: standing she idles, sat she stays sat, asleep she
   sleeps, a looping animation loops on. No marker ever leaves her frozen.
4. **How long a marker lasts.** A walk: until she's there. A one-shot (sit down, grab, a clip): its length. Staying
   (Wait, Sit, Sleep, a loop): **for N seconds**, **until you talk to her**, or **until the next marker can start**.
5. **Where a quest starts when the one before was cut short.** A later quest can start while she's in the middle of an
   earlier one (the story moved on). She's then not where the later quest expects. If you can't see her she's put
   where it expects; if you can, she walks from where she is (§6.4).
6. **A character who was never baked by the Animator**, or has no animations at all: clips are found by name (idle,
   walk, run...), anything missing is skipped and she still gets there (she slides): the game never stops on a missing
   clip, and the tab's Problems says what's missing.
7. **Dying and checkpoints.** The starter's Story brings back its own tasks and flags; her place in her markers must
   come back with them, or a flag and her position disagree after a death. Her state is kept at each checkpoint and
   put back on revive.
8. **Talking while the story moves on.** While a conversation is open nothing of hers starts (she won't walk off
   mid-sentence), and the player stands still.
9. **Answers given twice.** A conversation with answers plays once each time she comes to that marker (answers set
   flags: asked again they'd contradict). Afterwards E gives her "again" line, or nothing.
10. **The player in her way**, a floor that isn't flat, a door on the way: she waits a moment for you to move and then
    passes; she follows the floor under her path (stairs, slopes); a door is its own marker (Grab, Open door).
11. **Seeing why she's stuck.** In the game, F7 shows over each character her quest, her marker and what it waits for
    (a chip drawn over the picture, not text in the world: that smears under the game's anti-aliasing as she walks).
    In the editor, Problems lists what can never happen (a flag nothing turns on, a way after "otherwise", markers
    after a Repeat that never ends).
12. **Two things moving her.** A chase, a hunt or the starter's Motion node also move a character. A marker can hand
    her over (Event, *Let go of her*); Problems warns when a Motion node sits on the same character.
13. **Sounds, lines, tasks.** Any marker can say a line, play a shelf sound, tick or add a task, switch flags, fire
    other nodes.

## 3. The model

```
Level
├─ Alex                      the character (a Studio export's .glb, baked by the Animator; or any model)
└─ Alex markers   (HSNpc)    who she is: the character, her name, her colour, what being shot down means
   ├─ The missing book   (HSNpcQuest)     starts: at the start of the game
   │  ├─ Start here      (HSNpcMarker, appear)
   │  ├─ Walk            (walk)            children: bends (HSNpcBend), the points the path curves through
   │  ├─ Talk            (wait, you can talk to her, stays until you do)
   │  ├─ Choice          (choice)
   │  │  ├─ if alex_kitchen   (HSNpcWay)   markers inside...
   │  │  └─ otherwise         (HSNpcWay)
   │  └─ Sit             (sit)
   └─ Night two          (HSNpcQuest)     starts: when the task `night2` is on the list
```

Everything is a node, so it saves with the scene, copies, undoes, and can be read in the Scene dock. The tab and the
3D view are how it's made; nobody has to open the Inspector (it works there too: a marker shows only the fields of
its kind).

**A marker is three things**: *Starts when* (nothing: at once) → *what she does* (its kind) → *then* (flags, a task, a
line, a sound, things fired). Beside those, on any marker: her **face**, her **look**, whether **you can talk to her**.

**Her state is carried**: where she stands and faces, standing / sat / asleep, hidden or not, what she holds, her face,
her look, the loop she's in. A marker changes what it names and nothing else; the next marker, and the next quest,
start from it.

## 4. The kinds

| Card | Kind | What she does | Its own settings |
|---|---|---|---|
| Start here | `appear` | is put at the pin, facing its arrow, shown | how: at once, when you're not looking, fading in |
| Walk, Run, **Sneak, Crawl** (and Creep, Scuttle in the form) | `walk` | goes from where she is to the pin, through its bends, then turns to the arrow. At a low pace she goes low and **stays low** where it leaves her (crouched after a sneak, on all fours after a crawl or a scuttle, hunched after a creep) until a plain Walk or Run stands her up | pace (walk, run, sneak, crawl, creep, scuttle; her own speed × N, or "take N seconds"), smooth or sharp corners, follow the floor, end facing the arrow or the way she came; or *to you* (stops short) |
| Wait, Talk | `wait` | stays where she is, idling (or a loop of yours) | stays: N seconds, until you talk to her, until the next can start; faces you |
| Sit | `sit` | walks the last step to the pin (on the seat's front edge, the arrow the way her knees point), sits, stays sat. A short character (a child, a goblin) gets up onto a person's chair and sits with its legs hanging: its own clip (ANIMATOR_V3 §10); a seat higher than her clip is made for she's lifted onto, 12 cm, or 30 when her legs hang | stays (as Wait) |
| Sleep | `sleep` | sits on the bed's edge at the pin, lies down, sleeps (a short character onto the edge as onto a chair) | which side her head goes; stays |
| Grab, Pick up, Put down, Open door, **Eat, Drink** | `grab` | a hand to the pin, the arrow the way she faces: reaches for it; or takes the thing named into her hand; or puts what she holds at the pin; or opens the door named (her hand is put on the pin itself by the hand's IK, as far as her arm goes: a handle a little off the height her clip is made for is still held). Her hand has three reaches (the floor, a table at about 0.86 m, a shelf at about 1.65 m on an adult: the Animator's three clips): the one nearest the pin's height is played. **Eat, Drink**: the thing named is taken first (or it's what she already holds), then brought to her mouth: eaten, it's gone; drunk from, it stays in her hand | which hand, the thing, the door and how it opens |
| Animation | `animation` | plays a clip: one of her own by name, or a file (a Kimodo `.npz` in `res://animations/`, a Godot animation) | once, N times, looping (stays as Wait); speed |
| Event | `event` | nothing with her body: what's under *then*, at once | a scare; let go of her |
| Disappear | `disappear` | is hidden and switched off: not drawn, not animated, not processed, her colliders out of the physics; she still exists | how: at once, when you're not looking, fading out |
| Choice | `choice` | takes the first of its ways whose flags are so | its ways, in order; "otherwise" last |
| Repeat | `repeat` | does the markers inside it again | N times, until flags, or until the quest moves on |
| **Attack** (Punch, Swing) | `attack` | goes to where the blow reaches whoever it's for (you, or anyone picked), turns with them until it's thrown, and throws it: a punch, or a swing of what she holds (her fist when she holds nothing) | punch or swing, who, how many blows, which hand |
| **Jump scare** | `scare` | is put at the pin already in the scare (turned to you unless told not to), and is gone again when it's been shown | lunge, loom, snap or claw; how: at once or when you're not looking; *she stays after* |

Every kind has: a note (shown on its pin), *Starts when*, the animation's **speed** and the **blend** into it
(seconds), a face, a look, **her head** (below), *then*.

The rows in bold are **animations v3** (DECISIONS 2026-11-14; docs/ANIMATOR_V3.md): they want a character baked by
the Animator since then (its record's version 3). On one baked before, or on any other model, Problems says which
clip she lacks and she plays what she has (a walk for a sneak; the clip passed over for the rest).

**A hidden character costs nothing.** Disappear sets `visible` off and `process_mode` to disabled on the character
(Godot then takes her colliders out of the physics too) and the runner looks at her next marker's flags five times a
second, nothing more. She comes back with **Start here** (at a new place), or by herself when a later marker needs her
body (where she vanished).

**Speed.** A walk's pace: *walk* and *run* are her own (the Animator's record says how fast each of her clips
travels, so her feet keep step); *× N* scales it; *take N seconds* works the speed out from the path's length. The
card shows the path's length and how long it takes. Her feet's clip plays faster or slower with her speed (between
0.4 and 2.2 of its own rate; past that she'd slide, and Problems says so). Any loop has its own speed (a faster
idle, a slower dance).

**Easing.** She speeds up over the first 0.3 s of a walk and slows into its end, slower while she's still turning
onto the path; every clip is blended into over the marker's *blend* (0.25 s unless set); a face and a look turn over
their own seconds.

**Curves.** A walk goes through its bends as one smooth curve (a centripetal spline: it doesn't swing wide into
walls), or straight from bend to bend with *sharp corners*. A bend is added by clicking the + on the path, dragged
like a pin. A bend is a place in the world: turning a Walk's arrow or moving its pin leaves its bends where they are.

**Stairs.** The path gives where she is on the plan; the floor gives how high: rays down at each step of the way,
from just above the path to just below it, so on two storeys she follows the floor the path lies on and not the one
under or over it. She rides the highest floor a hand's width ahead of her and behind, eased: up a flight she rises
before each riser, down it she comes off each step late, and she's never inside one (measured on 18 cm risers: at most
3.3 cm of height a frame, never more than 4 cm under a step). One bend at the foot and one at the top of a flight
(*sharp corners*) is enough. Where there's no collider she keeps the path's own height.

**Low ways of going.** Sneak (a careful walk on bent knees, 0.42 m/s on the test woman), Crawl (hands and knees,
0.38), Creep (a creature's hunched prowl, 0.53) and Scuttle (hands and feet, fast: 1.2) are a Walk's pace: the same
pin, bends, stairs and "take N seconds", each at its own clip's speed so nothing slides. Where it ends she rests in
that pace's own loop, and a Wait, a Talk or the next low Walk keeps her there. A plain Walk or Run, a Sit, a Sleep, a
Grab or an Attack stands her up first.

**Her head.** On any marker, *Head*: **follows you** (or someone picked), **is her animation's again**, or nothing
said (as the marker before left it). Following, her head and neck turn to whoever it is on top of whatever clip she's
playing, within an arc: 160 degrees unless set, half to each side of straight ahead (the user's "80 degrees left and
80 degrees right"); past it she lets go and looks ahead again. It's carried from marker to marker and quest to quest
like her face and her look, and kept by a checkpoint. It's the Look plugin's `HSHeadTrack` under her skeleton
(GODOT_LOOK §5x): a little of the turn goes into her chest, her eyes lead when her model has eye bones. Without the
Look plugin in the project the row does nothing and Problems says so.

**Small movements, and what she keeps in her hand** (DECISIONS 2026-11-14, later: "'add life' animations ...
looking at an object they are holding, scratching, little life flourish stuff"; docs/ANIMATOR_V3.md §11, §12).
On the character (her HSNpc, the tab's form with her picked) *Life*: **Small movements now and then**, with how
often (6 to 14 s unless set). While she stands, walks or sits at her markers she scratches her head, rubs her neck,
looks at what's in her hand, stretches: the Animator's `life_` clips, laid over whatever she's playing by the Look
plugin's `HSGesture` (GODOT_LOOK §5z), so her legs go on walking and her seat stays sat. Never while a marker's own
act has her (a Grab, an Attack, a jump scare, sitting down, a custom animation), never while she's hidden or shot
down. On any marker, in its *Head* section, **Small movements: as they were, now and then, none**: from there on,
carried from marker to marker and quest to quest and kept by a checkpoint, as her head's following is (someone
stalking you is switched to none at the marker where the stalking starts). Off unless ticked. She needs to have
been baked by the Animator since its life clips (Problems says when she wasn't), and the project the Look plugin.

**A thing she keeps** (a Grab's Pick up with *Keep in hand*) **is carried** from there on, whatever she does: at
her side, in front of her, to her chest, over her shoulder, or raised, with her walk and her seat going on under
it. *Carries things*, on the character, says how; left at *as the thing's grip says*, a prop's own `HSGrip` does
(its Carry and Upright: a cup that's drunk from is carried in front of her and kept upright; anything else at her
side). The next Grab, Eat, Drink or Attack takes her hand for as long as it needs and gives it back; Put down ends
it.

**Eat and drink.** The thing is held where its **grip** says (the Look plugin's `HSGrip` under the prop: a ring to
put where a hand closes round it, sized by a handle to the prop's thickness, with a point for the side that's bitten
or the rim that's drunk from; a prop with none is gripped by a guess from its size). Her fingers close to the grip's
size; the bite or the rim is carried the last centimetres to her lips by her hand's IK (`HSHandIK`, GODOT_LOOK §5y),
measured at 0.0 cm on the test woman. Eat: two bites, then the thing is put away (hidden, not deleted). Drink: a sip,
tipped, and it stays in her hand for the next marker (Put down leaves it at a pin).

**Attack.** She walks to where the blow reaches (nearer for someone above or below her shoulder), keeps turning with
them until just before it lands, and her fist or the end of what she holds is carried onto where they are at that
moment: someone who stepped aside 20 cm is still hit, someone who got away isn't. A blow that gets there (within
12 cm) says so: the HSNpc's `struck(target, kind)` signal, and the target's `take_hit(by)` or `struck(by, kind)` when
it has one (the starter's player and Motion both do). On you it's aimed a little under your eye and stops 20 cm short
of it. *How many blows* repeats it, catching up with them between blows; she gives up a blow after 8 s of not getting
there. Swing swings whatever she holds by its grip (a bat picked up a marker earlier); with nothing in her hand it's a
swung fist.

**Jump scare.** One marker for the whole thing: she's put at its pin, turned to you, already in the scare's first
frame (no blend), the scare is heard at once (`scared` on the HSNpc, the group `hs_scare`: the Fear node and the
night's director hear it), and when the clip's own *over* moment comes (the lunge has been shown for 0.98 s) she's
hidden and switched off as Disappear does. *She stays after* plays it to its end and leaves her there (after the claw,
on all fours). *When you're not looking* waits for that before she's put there. Lunge: thrown at you from a crouch.
Loom: risen over you with her arms up. Snap: her head snapping up to you. Claw: clawed up from all fours.

**A custom animation (a Kimodo dance).** Drop the `.npz` in `res://animations/`. On an Animation marker pick it under
*From a file*: it's fitted onto her own skeleton the first time it's needed (the Director's Kimodo reader and
retarget, which every by-hand project already carries in `res://kimodo/`) and kept. Her own clips (the Animator's 53,
or whatever her model has) are in the same list by name.

## 5. Starts when, and flags

One small language everywhere a condition is asked (a marker's *Starts when*, a quest's, a way's, a Repeat's *until*,
a face's rule, a conversation's): words apart by commas, all of them must be so; `!` in front for "not".

| Word | So when |
|---|---|
| `name` | the flag `name` is on (the Story's; any name, nothing to declare) |
| `task:id` | that task is ticked |
| `on:id` | that task is on the to-do list and not ticked: *the quest is open* |
| `item:name` | you carry it |
| `@wait:3` | she's been ready for this marker for 3 seconds |
| `@near:2`, `@far:6` | you're within 2 m of her; further than 6 m |
| `@seen`, `@unseen` | you can see her (in view, nothing in the way); you can't |
| `@shot`, `@down` | she's been hit; she's been shot down |

The first four are the starter Story's own words (`holds`), so a flag set by a pickup, an event area or the laptop
starts a marker, and a flag a marker sets is heard by everything else. **How a marker and a thing are tied without
typing a flag twice, and where every flag's two ends can be seen, is docs/FLAGS.md** (the Flags and Things tabs, the
Logic node: DECISIONS 2026-11-14). Without a Story in the scene the plugin keeps
the flags itself. In the tab a condition is built from a menu and shown as chips ("flag alex_kitchen", "not seen",
"after 3 s"); nobody types the words unless they want to.

**Flags she sets by herself**: `talked:<id>` when a conversation with her ends, `shot:<id>` at her first hit,
`down:<id>` when she's shot down (`<id>` her name in small letters). Any marker's *then* switches flags
(`+name`, `-name`, `~name`: the Story's `switch_flags`), and so does each answer of a conversation.

## 6. The rules (how it runs, so nothing surprises)

1. **In order.** Within a quest, markers run top to bottom. A marker starts when the one before is done and its
   *Starts when* is so. Until then she holds (§2.3).
2. **Quests.** Her quests are in order too. A quest with no *Starts when* starts when the one before is finished
   (the first: when the game starts). A quest with one starts the moment it's so, even in the middle of an earlier
   quest, which is cut short where it is. **She never goes back up the list**: once a later quest has started,
   earlier ones never start. A quest runs once.
3. **Carried on.** When a quest's markers run out she holds her state. The next quest starts from it (the user's rule:
   no Disappear, the position continues).
4. **Catching up.** A quest that starts while she isn't where it expects her (the end of the quest before): if you
   can't see her or that place, she's put there; otherwise she walks from where she is, joining the path at its
   nearest point.
5. **Choice.** Each tick the first way (top to bottom) whose flags are so is taken; its markers run; then the markers
   after the Choice. A way with no flags is "otherwise": with one, the Choice decides at once; without, she waits
   until a way opens (the answer of a conversation). A way is taken once per visit.
6. **Repeat.** Its markers again and again: N times, until its flags are so (looked at before each pass), or until a
   later quest starts.
7. **Talking.** E on her while she stays put at a marker with *You can talk to her* on: the first of the marker's
   conversations whose flags are so (so a flag chooses what she says). Lines one after another, each for as long as
   it takes to read (E: the next now), the last of them with the answers under it; an answer switches its flags,
   shows its face, gives her reply. While it's open she starts nothing and you stand still. A marker that *stays
   until you talk to her* is done when it ends. **Drawn the studio's way** (DECISIONS 2026-10-30, evening, and
   2026-11-14: "Keep it the prior style"): no panel, her name small over the line, the answers on one line under
   it with a dash between, the one pointed at white and the other dimmed, no numbers; A / D or the arrows and Enter,
   or a click; two answers at the most. With an HSHud in the scene it is that HUD's own line, choice and ring; with
   none the plugin draws the same.
8. **Faces.** A marker's face is worn as it starts and stays (until another marker's, or "neutral"). Its **rules**
   ("if `gave_gift`: smile; otherwise: sad") are looked at while she's at that marker, the first that's so worn. A
   conversation's line or answer can wear a face for that moment.
9. **Looks.** A marker's look (a skin, eyes, a colour, or one of her look switch's named looks) is turned to as it
   starts and stays.
10. **Shot.** Hits and going down are heard from the weapons plugin's HSHitReact under her. What going down means is
    hers to say (on the HSNpc): **her quest stops** (she's down until a later quest brings her back: the default),
    **she's gone for good** (nothing of hers ever runs again), or **she can't be killed** (she's back up after a few
    seconds and carries on: only the flags `shot:` and `down:` remember, for an ending). A later quest whose *Starts
    when* is `down:<id>` is how "beaten early" jumps ahead.
11. **Checkpoints.** At the Story's `kept` her quest, marker, counts and state are kept; at `revived` put back.
12. **Never stuck in a frame.** At most 16 markers that take no time may run in one frame; a Repeat of only such
    markers waits a frame a pass.

## 7. The tab: NPC Markers

A dock along the bottom (it can float; it comes up by itself when one of its nodes is picked in the scene), four
parts, left to right (as built; the first design had the palette over the storyboard, which left the storyboard a
row and a half):

1. **Characters.** A row each: a colour, a name, an eye (that character's markers shown in the 3D view or not), solo
   (only theirs). *+ Character* makes an HSNpc for the model selected in the scene. *All quests* (every quest's
   markers drawn, not just the picked one's). **Problems**, a count that opens the list; each takes you to its
   marker.
2. **Add a marker**: the palette, a column of its own: a card a kind, with its drawing. Click one, then click in the
   3D view; Shift keeps it armed; Esc lets it go. A card with no place of its own is added at once.
3. **The quest**, picked from a dropdown (its name, new, delete, its *starts* chips, Play), and under it the
   **storyboard**: the markers in order, numbered as their pins are, each with its drawing and note, and beside it
   what starts it, how long it takes and what it carries (talk, a face, a look, flags); ways and repeats indented;
   dragged to reorder; ▶ on a row tries it.
4. **The marker picked**, as a short form in plain words: its kind (it can be changed) and note; *Starts when* as
   chips (the + lists the scene's flags with a tick each: the mock-up's "Boolean Flags Trigger"); **Where** (the pin
   as x and z and its height, the facing as a dial with its degrees: the mock-up's positions and "Face Direction");
   its own settings; Animation (clip, speed, eased in); Face and look; *You can talk to ... here* with its
   conversations (lines, answers, each answer's flags, face and reply; *A way for each answer* adds the Choice);
   *Then*. **Try it** and **From here** on top. With no marker picked: the character's own settings (name, model,
   speeds, what being shot down means).

Everything it changes goes through the editor's undo. The labels name the character or nobody ("You can talk to Alex
here", "Stays", "Facing"): a guard, a monster and a sister all read right. The tab never asks for more width than the
editor has (its rows wrap, its fields shrink); it's 300 px tall at the least, and can be dragged taller or floated.

## 8. In the 3D view

Drawn over the view, translucent (the room shows through; nothing is hidden behind a panel): each shown character's
markers as **map pins in their colour**, the kind's drawing in the pin's head and its number at its corner, its
point on the place (the mock-up's pins); its title and note on a dark chip beside it; what happens where they stand
(a wait, a talk, an event, a choice and its ways) as **round badges** stacked over that place; **the path** between
pins as a line with chevrons in the walking direction (dashed inside the ways of a Choice); **an arrow** from every
pin for the facing; a dashed line from where they'll stand to the seat or the thing reached for. The picked marker
has handles: the pin itself (drag: it rides the floor under the mouse, a seat's top, a shelf; taken by its head, its
point stays as far from the mouse as it was), the arrow's tip (drag round: the facing), each bend, and a + on each
stretch of path for a new bend (right-click a bend to delete it). A legend in the corner: who's shown, in which
colour; at the foot of the view, what a click will do while a card is armed, and what the tester is doing.

## 9. The tester

▶ **Try it** plays the picked marker in the 3D view; ▶ **From here** it and what follows; ▶ on a quest all of it.
A **copy** of the character is made for it (never saved; the real one is hidden meanwhile and nothing of it is
touched), put in the state the markers before leave her in, and run by the same runner as the game with every
*Starts when* passed after a moment (its words shown), conversations shown as captions and their first answer taken,
the Choice's ways taken as picked in the storyboard. Nothing is fired, no flag is set, no sound played. Stop, or
saving the scene, ends it. (The copy makes no small movements, which come when they like, and takes nothing of the
scene's into its hand, so it carries nothing.)

## 10. The plan

**A. The design**
- [x] the picture and the request read; what's missing; the design (this file); the user's words in DECISIONS

**B. The runtime** (`addons/horrorstudio_markers/`)
- [x] the nodes: `HSNpc`, `HSNpcQuest`, `HSNpcMarker` (a kind and its fields; the Inspector shows only its kind's),
      `HSNpcWay`, `HSNpcBend`; warnings in the Scene dock for a marker in the wrong place
- [x] `HSNpcCond`: the words of §5, with the Story or without; read back as plain words
- [x] `HSNpcFlow`: the order and numbers, where each marker starts from, the path of a walk (curve, length, time),
      the problems
- [x] `HSNpcBody`: the body driven: appear and disappear (off costs nothing), walk along a path (speed, easing, the
      floor under it, turning), stand, sit, sleep, grab / pick up / put down / open, a clip (her own, a file, Kimodo),
      a loop's speed, the blend; a baked character, any character, a stand-in
- [x] `HSNpcRunner`: quests, order, *Starts when*, holding, Choice, Repeat, catching up, *then* (flags, task, line,
      sound, fire, scare), hand over
- [x] talking: the E body and prompt, `HSNpcTalkBox`, conversations by flags, answers to flags, once
- [x] faces: presets on MHR's shapes (and ARKit's), by rule, for a line; face clips from `res://faces/`
- [x] looks: through the look plugin (a named look, a skin, eyes); phase and cloak for Appear and Disappear
- [x] shot: `shot:` and `down:` flags, the three policies
- [x] checkpoints: kept and put back with the Story's
- [x] F7: what each character is doing and waiting for

**C. Checked**
- [x] MARKERS (`tools/godot/markers_check.py`): a by-hand project, a baked test character and a stand-in, played
      headless: every rule of §6 and every kind of §4 measured

**D. The editor**
- [x] the plugin and the dock: characters (colour, eye, solo, add), quests (new, rename, delete, starts when)
- [x] the palette and placing by a click in the 3D view; the storyboard (numbers, chips, nesting, reorder, delete)
- [x] the marker's form: kind, Starts when chips, its settings, animation, face and look, talk, then; picking a
      target in the 3D view; undo everywhere
- [x] the 3D view: pins, paths, arrows, the legend; drag a pin, its arrow, a bend; add a bend; who's shown
- [x] Problems
- [x] the tester

- [x] from the mock-up itself, once it could be looked at: map pins with the kind's drawing, the facing dial, the
      place as numbers, flags as ticks; the palette a column of its own so the storyboard keeps the height; labels
      that name the character or nobody

- [x] conversations in the studio's own style (the user's first feedback, 2026-11-14): the HUD's line, one-line
      answers and ring when the scene has an HSHud, the same drawn by the plugin when it has none; the boxed panel
      with numbered answers this round first drew is gone

**E. Checked, written, shipped**
- [x] MARKERSEDITOR: the tab driven in the editor itself (headless), a scene made from nothing, saved clean
- [x] `godot_byhand.py` installs and enables it (a project made before it gets it switched on by `install`)
- [x] the launcher's rows
- [x] the guide `guides/markers/` with pictures of the real thing; the plugin's README and CLAUDE.md; CLAUDE.md,
      CONTINUE, GodotPlugins/README

**F. Animations v3** (DECISIONS 2026-11-14; docs/ANIMATOR_V3.md)
- [x] a Walk's low paces: sneak, crawl, creep, scuttle, each at its own clip's speed, resting low after
- [x] Eat and Drink on a Grab: the thing by its grip, to her mouth by her hand's IK
- [x] the **Attack** kind: punch or swing at you or anyone, carried onto them, `struck`
- [x] the **Jump scare** kind: there, shown, gone
- [x] *Head* on every marker: follows you within an arc, carried on, kept by a checkpoint
- [x] the cards (Sneak, Crawl, Eat, Drink, Attack, Jump scare), their form rows, their drawings; Problems for a
      character with no such clip or an attack at nobody
- [x] MARKERS (the stage `v3`) and MARKERSEDITOR (the new cards)

**G. Life and carrying** (DECISIONS 2026-11-14, later; docs/ANIMATOR_V3.md §11, §12)
- [x] an HSNpc's **Life**: *Small movements now and then* (and how often), *Carries things*; in the tab's character
      form
- [x] *Small movements* on every marker (as they were, now and then, none), carried on, kept by a checkpoint
- [x] `HSNpcBody`: the Look plugin's `HSGesture` under her (`gesture()`, `alive()`, `flourish()`), told each frame
      what she's doing; a thing kept in her hand carried from there on, her hand given to a later act and taken back
- [x] none while she's hidden, shot down, or an act has her; never in the tester's copy
- [x] Problems for a character baked before the life clips, or with no skeleton
- [x] MARKERS (the stage `life`) and MARKERSEDITOR (the two form rows)

## 11. Later (not in this round)

- doors opened on the way of a walk (now: an Open door marker before it)
- a Follow marker (she keeps after you along your trail, as the starter's chase does)
- feet planted on each step of a stair (now: she glides over the risers)
- a navigation mesh (now: the path you draw is the path she takes)
- Director and desk games (now: games built by hand)
