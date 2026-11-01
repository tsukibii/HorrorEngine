# The Director, next: the game as state, things as parts (a plan)

DECISIONS 2026-11-01: "the director script just puppeteers the whole game (if that's what makes sense; if this is a
bad system, make something better)". This is the plan for that, waiting on the user's yes (§9). Nothing in it is
built yet. What exists today is docs/GODOT_DIRECTOR.md.

## 0. In one paragraph

**The scene is the world; the Director is the story.** The world is your level with things in it, each with an id
and the parts that say what it does (a Kettle part on your kettle model, an Inspect part on a photo, a Talk part on
Mari). The story is one file, `director/director.json` in the Godot project, edited in a page of its own (the
**Director Manager**), and read by one node in the main scene. While the game runs, the Director keeps a record of
what the player has done (**facts**), runs the **quests** one at a time, and sets the world to match what's happened
(**states**: who is where doing what, what's shown, what's locked, what each person will say). Nothing in the scene
knows the story; everything is named by id. One world, no jumping between levels, except when the map changes (into
the car, out at the lake).

## 1. Is the puppeteer the right system? Yes, with three refinements

The user's idea is how the better-built narrative games work: a story manager over a world of tagged things, state
read from a blackboard of what's happened. Three things make it hold up:

1. **Two kinds of rules, not one.** *States* ("while"): what the world looks like while something holds ("while the
   tea quest is on, Mari sits in the kitchen with her pout loop"). *Moments* ("when"): what happens once, when
   something happens ("when they walk into the doorway after reading the letter: the figure"). States are worked out
   again whenever a fact changes and after a save is loaded, so a loaded game always puts everyone where the story
   says. Systems built only from events lose that on load: an NPC moved by an event that fired before the save is
   back where she started after it. Where two states say different things about one person, the later in the list
   wins (like CSS), so a story reads top to bottom.
2. **Facts are recorded by themselves.** Every use, pickup, area entered, conversation and answer is written down as
   a fact with its ids (`used:kettle`, `used:kettle:switch_on`, `entered:kitchen`, `talked:mari:t_tea`,
   `answered:t_tea:yes`, `gave:beer:mari`), next to your own flags and counters. Conditions read facts. A hidden
   tracker is a counter the player never sees. An achievement is one more rule over facts, so Steam slots in later
   with nothing else changing (§6).
3. **Quests name their things; things don't name their quests.** Rather than a quest-item script holding a quest id,
   a quest's step names the thing ("switch the hall light on, then off"). A step only listens while its quest is the
   active one, so doing it before the quest doesn't count, which is what was asked. The part on the object still
   shows which quests use it (read-only, from the Director file), so you see the link from the object too. Each link
   lives in one place: renaming or reordering a quest never touches the scene.

## 2. The world: things with parts (the droppables)

A **part** is a small node you add to any object: select your kettle model and pick *Kettle* in the dock (or drag
it from the plugin's `parts/` folder onto the object in the Scene tree). The object becomes a thing with an id (its
name, as now), and the part gives it what it does:

- **Use**: Pickup, **Inspect** (taken up for a moment, turned round, put back), Note, Switch, Breaker, Sit, Sleep,
  Hide (wardrobe) and Locker, Carry, Code lock, Use item, **Give** (someone wants something: the right item ticks the
  step; anything else gets her answer, "Nah, that's not what I want", or fails the step: the quest says which),
  Clean, Talk (on a person), Door with its Latch and Peephole.
- **The little things** (`lives.json`'s 20): Kettle, Whistling kettle, Tetsubin, Hob, Gas hob, Pot, Cup, Coffee,
  Teapot, Cigarette, Lighter, Candle, Mosquito coil, Incense, Clock, Rice cooker, Phone, Tap, TV, Fridge. A life part
  adds its **effect points** as markers you drag onto your model (the names `lives.json` gives them): the Kettle's
  `spout` (the steam comes out there), `led`, `lcd` and `lid`; a Cigarette's `tip`; a Phone's `led` and `screen`;
  a Candle's `flame`. The runtime already plays these lives (timers, acts, effects, sounds); today they only exist on
  kit props, which a Director game doesn't have.
- **Places**: Area, Spot, Path, as now.

Rooms and doors stay as they are (built from numbers), and so do HSActor and the rest of the level's nodes. HSThing
becomes "a plain box with a part" for stand-ins.

## 3. The Director (one node, one file)

The file, in short (the Manager writes it; nobody types it):

```json
{
  "quests": [
    {"id": "q_tea", "title": "Tea for Mari", "objective": "Make Mari a cup of tea", "map": "house",
     "steps": [
       {"id": "s_on", "text": "Put the kettle on", "done": {"used": "kettle", "act": "switch_on"}},
       {"id": "s_give", "text": "Give Mari the tea", "done": {"gave": "cup", "to": "mari"},
        "wrong": {"say": "Nah, that's not what I want.", "who": "mari"}}],
     "fail": {"after_secs": 300},
     "next": [{"if": {"fact": "found:photo"}, "quest": "q_secret_photo"}, {"quest": "q_bedroom"}]}
  ],
  "states": [
    {"while": {"quest": "q_tea"}, "mari": {"at": "kitchen_chair", "do": "sit", "face": "pout_and_glance_loop"}},
    {"while": {"done": "q_tea"}, "mari": {"do": "patrol", "paths": ["hall_path"]}, "bedroom_door": {"locked": false}}
  ],
  "moments": [
    {"when": {"enter": "kitchen_doorway"}, "if": {"fact": "read:letter"}, "do": [{"jumpscare": "figure"}]}
  ],
  "talk": {
    "mari": [
      {"id": "t_tea", "if": {"quest": "q_tea"}, "lines": [{"who": "mari", "text": "Tea, please."}]},
      {"id": "t_idle", "lines": [{"who": "mari", "text": "Not now."}]}
    ]
  },
  "endings": [{"id": "e_morning", "kind": "good", "title": "Morning"}],
  "achievements": []
}
```

- **Quests** run one at a time, in order. Each has its steps (the to-do list: done when, failed when, the wrong-thing
  answer), what happens as it starts and ends, the map it plays on, and what comes **next**, by condition: the
  secret ending or the easter-egg scene when its facts hold ("did they find the photo and go into the attic"), the
  next quest otherwise. A finished step stays on the list crossed out with a single line, a failed one in red (the
  Godot HUD only dims a finished one today: a small fix in step 1). For later games, a moment can end the quest early
  and start another ("if this happens, go there", skipping what's between): the same `next`, from anywhere.
- **States** place and run the people (where, what they're doing: stand, sit, walk a path, patrol, go to a spot;
  their idle motion; their face loop), show or hide things, lock or unlock doors, set lights. The characters'
  animation, paths and patrols are all here, by the story's state.
- **Moments** are today's events (when, if, then), lifted out of the scene.
- **Talk**: each person's conversations, offered by condition (the first whose condition holds is the one you get);
  lines and answers can carry conditions too. Talking and answering are recorded as facts.
- **Saves**: a save is the facts and where the quests are; loading it works the states out again. A new game starts
  with no facts. The Manager lists the saves, deletes them, and starts a test from any quest with the facts it asks
  for.
- **Under it** the runtime we have stays: quests play as its stitches, moments as its beats, conversations as its
  scenes. The new runtime part is the states layer and the fact recording.

## 4. The Director Manager (a page)

`tools/director_manager/` (a small Python server, like the writers' room, on its own port), opened on a Godot
project. It reads the scene's ids and parts (the plugin writes them to `.hsdirector/index.json` on every save) and
reads and writes `director/director.json`, keeping a history of saves as the desk does.

- **Quests**: the list in play order, dragged to reorder; each quest's steps as sentences; its next, by condition.
- **People**: each character's states and conversations together, the conversation's lines and answers.
- **Moments**, **Endings**, **Facts** (each one: where it's set, where it's read; the hidden trackers),
  **Achievements** (when we get there), **Saves**.
- **Coverage**, the helper asked for: ids in the scene nothing in the story uses; ids the story names that aren't in
  the scene; quests with no steps; conversations never offered; facts read but never set; people with no state.
- Every picker offers only ids that exist, of the right kind (a give step offers the things with a Pickup part and
  the people with a Talk part).
- **Godot's dock** keeps what belongs with the scene: adding parts, the scene's ids, Check, Kimodo, and while the
  game runs, the active quest, the steps and the facts live.

## 5. Faces and fingers

- **Faces without the desk**: `tools/face_export.py` takes the expression library into the project: `faces/<id>.tres`
  (a clip of MHR's 72 face shapes) and the loops apart in `faces/loops/<id>.tres` (looping, with their blend). A
  **Face** part on a character finds her face's shapes and plays a clip once (a line, a moment) or a loop (her
  state). What it needs: characters with face shapes in Godot. The plain MHR body has them (117 shapes, by generic
  names; most likely the 45 identity and 72 face ones, to confirm). **A Character Studio export has none today** (it
  is exported neutral), so the Studio's export first needs MHR's 72 face shapes added as morph targets; that is a
  Character Studio change and the biggest single piece of this plan.
- **Kimodo's fingers**: SOMA carries every finger joint (thumb to pinky, both hands: 50 hand joints of its 77). The
  retarget aims each finger bone at its child as it does the limbs, onto MHR's, Mixamo's and Godot's humanoid
  fingers, measured in the Kimodo check.

## 6. Steam achievements: designed for, not built

An achievement is an entry in the Director file: its Steam API name, its title, whether it's hidden, and its
condition over facts (a hidden tracker: "cups poured" at least 3; an ending reached; a secret found). The Director
checks them as facts change. When the user is ready, a small adapter calls the existing GodotSteam add-on
(`Steam.setAchievement`, then `Steam.storeStats`) and, without Steam, keeps them in the save and shows them in the
corner as the desk does. Nothing else in the plan changes for it.

## 7. What changes in what's built

- **The story nodes** (HSChapter, HSTask, HSTodo, HSEvent, HSDialogue, HSLine, HSOption, HSChoice, HSEnding) give way
  to the Director file (§9 asks). The dock's Story, Events and Flags tabs move to the Manager.
- **Kept**: the level's nodes, the runtime, `game.collision: physics`, F9, the Kimodo link, `godot_director.py`.
- **Remade**: the sample house in the new way, the DIRECTOR check for it, the guide.

## 8. Build order (one step a commit, each with its check)

1. **Parts**: the droppables, Inspect and Give among them, the 20 little things with their effect markers; the
   crossed-out finished step in the HUD.
2. **The Director in the runtime**: facts recorded, quests one at a time with their steps listening only while
   they're on, wrong things and fails, states worked out and applied (people, things, doors, lights), moments,
   conversations by condition, saves; the sample remade; DIRECTOR.
3. **The Director Manager**, with Coverage.
4. **Kimodo's fingers** (small; it can come anywhere).
5. **Faces**: the Studio's export with its face shapes, then the export tool and the Face part.
6. **Achievements** and the GodotSteam adapter, when wanted.

## 9. Waiting on the user

- **Replace the story nodes with the Director file** (recommended: one way to write the story, the scene left as the
  world), or keep both.
- **Order**: §8's, or another.
