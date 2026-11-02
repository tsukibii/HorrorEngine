# Animation in the Director: moves, faces and staging by quest (a plan)

Written 2026-11-02 from the user's ask: *"anything you can think we could do to make animation, patrol/walking,
cinematic animations easy based on 'quest', should we add an animation and facial animation tab to store
animations, these can be project specific, how do I easily be like at this point npc is doing this, then if quest
complete they get up and walk here with this animation, you can talk to them here, they have this expression etc,
jump scare plays this… an easy drag and drop animation system, ideally I can just drag animations into the folders…
Come up with a good plan first."* §9 is the build order (step 1 built: the library and the Animate tab,
docs/GODOT_DIRECTOR.md §6g; step 2 too, the Face page, `tools/facecap`; step 3, a character's moves; step 4, On stage; step 5, paths and the walk through doorways; step 6, reactions and scares); §10 the questions, and the user's answers (DECISIONS 2026-11-02, night), which this plan
now follows.

## 1. What's there today

| Piece | What it does now |
|---|---|
| `HSActor` | a character: her behaviour (idle, sit, path, patrol, off), a seat, a path, a speed, `face_player`, sight, `talk`, **two motion slots** (`idle_motion`, `walk_motion`), her resting `expression`, her body (a Character Studio export, or her own model) |
| the dock's **Kimodo** tab | a Kimodo `.npz` retargeted onto one character's skeleton, saved as `res://motions/<her id>/<name>.res` in an AnimationLibrary on her AnimationPlayer, used as her idle or walk |
| the Director file's **states** | "who is where doing what" while a condition holds: `do` (idle, sit, go, path, patrol, off), `at`, `to`, `path`, `paths`, `motion`, `expr`, `sees`; worked out again on every change and load (the brain applies only what changed) |
| actions (a moment's THEN) | `behave` (stand, sit, go to a spot, a route, a patrol, leave), `anim` (play a clip on a thing), `expr` (a face, resting or over it), `lookat`, `shot` (a close-up), `fade`, `wait`, `trick` (a knock, a glimpse, a jump scare of a figure, a door slam…), `scene` (a desk game's baked cutscene) |
| triggers | `arrived` (she reached her spot), `look`, `enter`, `use`, `talked`/`heard` facts… |
| **faces** | the studio's expression library baked into `res://faces/<id>.tres` (HSFaceClip) and `faces/loops/`, played by the runtime's `face.gd` on MHR's 72 face shapes; a line's `expr` |
| path spots | an `HSSpot` on a path has a `wait`, a `pose` and a `check` |
| **PATTERNS_PLAN** (parked) | a character's **motion set** (`moves`: roles such as idle, walk, run, fidget, look, sit, stand_up, talk, with fallbacks) and patterns (calm, uneasy, hunting…): this plan uses its `moves` and leaves its patterns for later |

So most of the *runtime* exists. What's missing is **a library you fill by dropping files in a folder, a character's
whole set of moves, and one place per quest that says who is where doing what**, in pictures, by drag and drop.

## 2. The idea in one paragraph

Animations and faces live in the project, in two folders the plugin watches: **drop a file in, it shows up as a
card** in a new **Animate** tab of the HorrorStudio panel (Body and Face), already retargeted onto MHR. A
character has **moves** (idle, walk, run, sit down, sitting, stand up, talk, listen, look around, scared…): drop a
card on her slot once, and every behaviour uses it. Each quest gets an **On stage** list, one sentence per
character: *Mari sits on the sofa · reading · tired · you can talk to her: "Could you bring me…"*. When the quest
moves on, the next quest's line takes over and the game works out the **in-between** itself: she stands up (her
stand-up move), walks there (her walk), sits down. Anything that happens at a moment (a reaction, a jump scare, a
cutscene) is a THEN with a clip dropped on it. You see all of it in the editor before playing: pick a quest and the
3D view shows everyone where they'll be.

## 3. The library: drop files into folders

```
res://animations/            body clips (the plugin watches it); empty in a new project
    mari/                    hers only (a folder named after a character's id)
res://faces/                 face clips; empty in a new project
    loops/                   loops cut from a capture
```

No shared studio folder (the user: "I'll just manually move over what I need every project"): a new project gets
both folders empty, and you copy in what it needs.

**What you can drop** and what happens:

| File | What happens |
|---|---|
| `.npz` (Kimodo, the user's main source) | the Kimodo tab's retarget onto the character it's for, without opening the tab |
| `.res` / `.tres` Godot Animation | used as it is |
| a face clip `.tres` (from the Face page, §3b) | a card on the Face side |
| *(later)* `.fbx` / `.glb` / `.gltf` with animations (Mixamo, Blender…) | retargeted onto MHR as it's imported |

**Names say what a clip is** (and the card lets you change it): `mari_sit_reading.fbx` is Mari's, a *sit* move,
style *reading*. A folder named after a role (`walk/`, `idle/`) does the same. Anything unclear goes under *Other*
until you drop it somewhere.

The plugin keeps an index (`res://.hsdirector/library.json`: each clip's id, file, role, character, length, loop,
whether it moves on its own) and a small picture of each (three frames of it on a grey MHR body), made once. Licence
rule kept: **Mixamo and other non-CC0 clips stay in the project's folder**, never in the studio's shared files.

## 3b. The Face page: face mocap out of the desk

The desk's Expressions import becomes **a page of its own** (the user: "make it a separate page so I can save the
facial mocap"), with its own small server like the Character Studio's and the writers' room's: drop a video of a face,
it's solved on your machine (`tools/face_capture.py`), shown on an MHR head (or a Character Studio character) in
sync with the clip, named, its neutral, strength and length set, a loop cut from a range; **Save** keeps it in the
studio's expression library (`Content/Studio/Expressions/`, as now), **For Godot** writes its `.tres` face clip into a
folder you pick (a project's `res://faces/`). The desk's Expressions tab keeps working on the same library.

**Body and face together** (the user: "make sure I can mix facial data with kimodo animations in godot"): a character
plays a Kimodo body clip on her bones and a face clip on her face shapes at the same time; the two never fight (the
body has no face bones, the face no bones at all). An On stage line, a THEN or a cutscene can give her both, and a
body card can carry a face to go with it (a sigh with a tired face) so one drop sets both.

## 4. The Animate tab (Body | Face)

Beside Build, Story and Test. Cards like Build's, **in groups by role** (Idle, Walk & run, Sit & stand, Talk &
listen, Look & search, Reactions, Scares, Cutscene, Other) with a character filter and the search. A card shows its
picture, its length and *loops* or *once*; hovering plays it on the picture; ▶ plays it on the selected character
in the 3D view (a preview, nothing saved).

**Drag a card onto…**

| Target | It becomes |
|---|---|
| a character (3D view or Scene tree) | one of **her moves**: a small menu asks which (idle, walk, sit…) |
| a slot in her **Moves** (This object, when she's selected) | that move |
| an **On stage** line's animation word | what she's doing during that quest |
| a THEN's clip word (*Animate Mari: …*), a ready-made reaction or a scare | that clip |
| a path's spot (3D view) | what she does when she stops there |
| a quest card in Story Flow | a new On stage line for that quest (it asks who) |

The **Face** side is the same with face clips: onto a character (her resting face), an On stage line (her face
during that quest), a conversation's line (its face), a THEN (*a face on Mari*).

## 5. A character's moves

When a character is selected, This object shows her **Moves** as slots with drop zones, filled from her own
folder first, then `shared/`:

| Role | Used for |
|---|---|
| `idle` (and `fidget`s over it now and then) | standing |
| `walk`, `run` | going somewhere, patrols, chases (played at the speed she moves) |
| `sit_down`, `sitting`, `stand_up` | seats: the way in, the loop, the way out |
| `talk`, `listen` | while she speaks, while you answer |
| `look_around`, `check` | a path spot's stop, a search, a hiding place |
| `scared`, `caught`, `dead` | reactions and endings |

Empty roles fall back (PATTERNS_PLAN §5): to a shared clip of that role, then to the pose library's stand-in, so
**a game always plays**, it just looks better as moves are filled in. Under the hood: `HSActor.moves` (role → clip
id), replacing `idle_motion` and `walk_motion` (read as `idle` and `walk`). Later, styles (calm, uneasy, hunting) are
PATTERNS_PLAN's.

## 6. Staging by quest: "On stage"

The heart of the ask. In the Story tab, every quest gets an **ON STAGE** list above its steps (and the same list on
the right of Story Flow when its card is clicked):

> **Mari** sits on **Sofa** · **reading** · face **tired** · **you can talk to her**: *"Could you bring me something…"*
> **The figure** is **not there**

Each blue word is a picker, and a drop target for a card. The choices for *what she does*: stands at a spot, sits on
a seat, walks to a spot and waits, walks a path, patrols paths, follows you, isn't there.

**When the quest moves on**, the next quest's line takes over and the game plays the **in-between** by itself:

> *Mari: sits on Sofa* → *Mari walks to Bedroom door, waits there · arms crossed · face worried*
> plays: her `stand_up` → her `walk` to the door → turns to face the room → *arms crossed* (her idle there)

Overridable on the line: *gets up with…*, *walks with…*, *arrives with…* (drop a clip). A line holds **until a later
quest changes it** (as a character's model is carried down the desk's flow), so you only write what changes. The
line can also hold on a fact instead of a quest (*after she's been given the mug*), for the in-between moments.

**You can talk to her here** sets which of her conversations she offers during that quest (the conversation's own
*offered when*, written for you), or none: she's busy.

**See it before playing**: pick a quest, *Show on stage* moves everyone in the 3D view to where they'll be, in the
pose of what they're doing (an editor preview, nothing saved). In Story Flow, each quest card shows small chips (*Mari
· sits · Sofa*), and a **Cast** view lays out one lane per character across the quests: where she is, quest by quest.

Under the hood: these are the Director file's **states** (`while: {quest: …}`, a line carried until changed), grown
by `talk` (her conversation here), `leave`, `walk`, `arrive` (the in-between's clips) and `look` (her head follows
the player, a thing, or nothing). The brain already applies states on every change; the runtime learns the
in-between (a move per transition) and the new keys.

## 7. Everything else, by scenario

| You want… | You do… | Under the hood |
|---|---|---|
| **a patrol** with stops | draw a path in the 3D view (click to add spots), drop a clip on a spot (*looks around 3 s*), then On stage: *patrols Hall path* | `HSPath`, `HSSpot` `wait`/`pose`/`check` (exist), a spot's clip new |
| **a reaction** (she turns and stares when you walk in) | a ready-made **reaction** card (turns to look at you, flinches, screams, points, waves) dropped on an area or a door, her clip swapped by dropping | a moment: `anim` with *once, then back to what she was doing*, `lookat`, `expr` |
| **a jump scare plays this** | the Jumpscare card asks for the figure and a clip (a lunge), a sound and a face | `trick: jumpscare` grows `clip`, `sound`, `face` |
| **walk her somewhere mid-quest** | THEN *Mari walks to the door*, then WHEN *she arrives* | `behave go` and the `arrived` trigger (exist), her walk move |
| **a cutscene, in the level** (she walks in, two lines, sits down; the player stays in their body) | a moment marked **Cutscene** with a **target** (a spot or a character): its THEN shown as a timeline (a row per character, the view, lines), clips dragged onto rows, *Play it here* | no black bars, no skip (the user: "everything should feel like it's happening in your gameplay"). A **soft lock**: the view drawn back toward the target whenever it drifts (a cone you can look round in), walking slowed or held; a **zoom** as the format's lean-in and held focus (`push`, `zoom`: the lens never changes, DIRECTING §1). A **safety release** always frees the player: when the THEN is over, when the target is gone, and in any case after the moment's longest time (its `max`, 20 s unless set) |
| **talking looks alive** | nothing: she turns to you, plays her `talk` move while she speaks, `listen` while you choose, a line's face as set | the conversation player uses her moves; a line can carry a clip too (`anim`) |
| **an easter egg plays an animation** | its IT PLAYS: *Animate the doll: head turn* | the egg's `on_start` (step 3 of Story Flow) |
| **caught / death** | her `caught` move and the ending's or retry's | a round's or a death's clip |
| **a face during a quest** | a face card on the On stage line | the state's `expr` (exists) |

## 8. What changes in the files

- **The scene** (the world): `HSActor.moves` (role → clip id), a spot's clip.
- **The Director file**: states grow `talk`, `leave`, `walk`, `arrive`, `look`; moments grow `cutscene`;
  `anim` grows *once / loop / then back*; the jumpscare grows `clip`, `sound`, `face`; a talk line may carry `anim`.
- **The runtime** (and STORY_FORMAT, the story check, together, as always): the in-between transitions, the new
  `anim` options, the cutscene hold and skip, moves by role for every behaviour, the conversation's talk/listen.
- **The plugin**: the folders' watcher and importer, the library index and pictures, the Animate tab, Moves in This
  object, On stage in the Story tab and Story Flow, the 3D preview, the Cast lanes.

## 9. Build order (each a step, checked and pushed)

1. **The library and the Animate tab** *(built, 2026-11-02: GODOT_DIRECTOR §6g)*: the two folders (empty in a new
   project), Kimodo `.npz` and Godot clips imported on drop, the index, the tab's cards (Body and Face), ▶ on the
   selected character, a body clip and a face clip played together on one character. Not in it yet: the cards'
   pictures on a grey MHR body (a Kimodo card is drawn as its figure from its own joints instead), the character
   filter, a body card carrying a face.
2. **The Face page** *(built, 2026-11-03: GODOT_DIRECTOR §6g, `tools/facecap`)*: the face video import out of the
   desk, Save to the library, For Godot.
3. **Moves** *(built, 2026-11-03: GODOT_DIRECTOR §6g)*: a character's slots (drop onto her or her slots), the
   fallbacks, every behaviour playing her moves (walk, run, sit down/sitting/stand up, talk/listen, look around).
   Not in it: `fidget`s over the idle, and `scared`, `caught`, `dead` (step 6's reactions).
4. **On stage** *(built, 2026-11-03: GODOT_DIRECTOR §6g)*: the list per quest in the Story tab and Story Flow, carried
   until changed, *talk to her here*, the in-between played by itself, *Show on stage* in the 3D view, the quest
   cards' chips. Not in it: a line held on a fact, the Cast lanes, On stage in the Manager; *talk* isn't carried (a
   conversation belongs to its quest).
5. **Paths and patrols** *(built, 2026-11-03: GODOT_DIRECTOR §6g)*: drawing a path in the 3D view (Godot's own path
   tools, its stops listed in This object), clips on spots (a stop's clip, a card dropped on it); and a walk between
   places going through doorways (the levels' doorway spots, the brain's `way`).
6. **Reactions and scares** *(built, 2026-11-03: GODOT_DIRECTOR §6g)*: the ready-made reaction cards (filled in
   for the nearest character, her clip swapped by a card dropped on the area), `anim` once-then-back (held, turned to
   the player and back: play.gd `react`), the jump scare's clip, face and sound, her Caught move.
7. **Cutscenes in the level**: a moment with a target, its soft lock, lean-in and safety release, its timeline view,
   *Play it here*.
8. *(later)* FBX and glTF clips; the Cast lanes in Story Flow; PATTERNS_PLAN's styles and patterns (calm, hunting) for
   NPCs that react on their own.

Each step is checked the way the Director is (DIRECTOR: the sample gets a few clips of ours, Mari's moves, two On
stage lines with an in-between measured in play, a reaction, a scare and a short cutscene played headless), and the
guide gets each part with its pictures.

## 10. Questions for you (answered: DECISIONS 2026-11-02, night)

Kimodo and the face videos first (the face import a page of its own, body and face mixed in Godot); no shared studio
folder, both folders empty in a new project; On stage carried until changed; cutscenes in the level with a soft lock, a
lean-in and a safety release, no bars, no skip; start with the library, the moves and On stage.

The questions as they were asked:

1. **Where will most clips come from?** Mixamo (FBX), Kimodo, your own mocap, a marketplace? It decides what the
   importer does first.
2. **A shared studio folder too?** Clips of ours (Kimodo) could live once in the studio and be copied into each new
   project; Mixamo's can't (licence), so those stay per project.
3. **On stage carried until changed** (write only what changes), or **each quest says everything**? I'd carry it.
4. **Cutscenes**: black bars or not? Always skippable?
5. **Which first?** I'd start with 1 to 3 (library, moves, On stage): that's "at this point the NPC is doing this,
   then she gets up and walks here, you can talk to her here, with this face".
