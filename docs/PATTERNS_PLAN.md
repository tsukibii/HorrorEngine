# NPC patterns: states, motion sets, routines (a plan)

A plan, written 2026-10-24 from the user's ask: "a behaviour pattern (for different states, e.g. calm, hunting) for
NPCs to have different idle animations, easy to use and reusable, accounting for patrol cycles and loops". Nothing
here is built yet. §12 is the build order and §13 the questions for the user.

It grows what Play already has, and keeps the user's rule (DECISIONS 2026-10-21): **simple behaviours, not AI**, the
same steps every time so a player can learn them.

- **What Play has** (GAMEPLAY_PLAN §2 to §4): behaviours, routes, the sight cone and meter, `caught`.
- **What was planned:** the per-character motion sets of PERFORMANCE_PLAN §2 (`moves`).

## 1. The idea

**In play, a cast member is always in one state**: calm, uneasy, hunting, chasing and so on. The state says:

- **What she does:** a behaviour, such as patrolling, searching or chasing.
- **How she looks doing it:** her motion set for that state (a calm idle, a tense idle, a stalking walk, a run).
- **What she watches and listens for, and what she says.**
- **What moves her on, and to which state:** an event (she sees you, hears you, loses you, finishes a search, a
  timer, the story).

**A pattern** is a set of states written once as data (`Content/Studio/Patterns/stalker.json`) and given to anyone:

- **The pattern says what she does; her motion set says how she looks doing it.** So the same `stalker` works on Mari
  and on the next game's ghost.
- **A pattern plays the day it's written.** Whatever isn't made yet falls back to the pose library and the procedural
  idle, and it looks better as each Kimodo motion is made (the desk already works this way for scenes).

## 2. Four words, kept apart

| Word | What it is | Who writes it | Where |
|---|---|---|---|
| **behaviour** (exists) | one activity, in code, with settings. Today `idle`, `sit`, `path` and `patrol`; new ones are `search`, `chase`, `follow` and `routine` | Claude, as parts (GAMEPLAY_PLAN §5) | `play/behaviours.js` on the desk; C++ in Unreal |
| **state** | a named mode: which behaviour runs, how she looks, what she senses and says, where she goes next | the pattern | inside a pattern |
| **pattern** | a reusable set of states, the events between them, and parameters (her routes, how long she searches) | Claude or the user, as JSON | `Content/Studio/Patterns/<name>.json`; a game's own in `Content/Games/<G>/Patterns/` (as board games are) |
| **motion set** | a character's motions by style and role (calm idle, hunting walk), taken from the `motions` table | the user, by picking them in the desk | `cast.<id>.moves` |

A behaviour knows nothing about animation. It moves the body and names a role ("walking at 1.1 m/s", "looking
around"). The motion set knows nothing about logic. Keeping the two apart is what makes both reusable.

## 3. A pattern

```json
{
  "title": "Stalker",
  "about": "Walks her rounds; a noise makes her look, seeing you makes her run at you; lose her and she searches, then goes back.",
  "params": {"routes": [], "search": 20, "run": 3.0},
  "start": "calm",
  "states": {
    "calm":    {"do": {"patrol": {"routes": "@routes"}}, "sees": {"meter": 1.5}, "hears": {"range": 1},
                "on": {"glimpse": "uneasy", "noise": "uneasy", "spotted": "chasing"}},
    "uneasy":  {"do": {"search": {"at": "@heard", "secs": 6}}, "sees": {"meter": 1.0}, "hears": {"range": 1.3},
                "look": "noise", "bark": "huh", "on": {"spotted": "chasing", "done": "calm"}},
    "chasing": {"do": {"chase": {"speed": "@run"}}, "sees": {"give_up": 4}, "look": "player", "music": "chase",
                "bark": "chase", "on": {"lost": "hunting", "reached": "caught"}},
    "hunting": {"do": {"search": {"at": "@last_seen", "secs": "@search", "check": "near"}}, "sees": {"meter": 0.8},
                "music": "uneasy", "barks": {"lines": "search", "every": 8}, "on": {"spotted": "chasing", "done": "calm"}},
    "caught":  {"do": {"idle": {"face": "player"}}, "style": "hunting", "emit": "caught"}
  }
}
```

**Top-level fields:**
- `title`, and `about`: one line, shown in the desk.
- `params`: the defaults for any `@name` in the states.
- `start`: the state she begins in.

| State field | Meaning |
|---|---|
| `do` | the behaviour and its settings: `{"patrol": {"routes": "@routes"}}` |
| `style` | which column of her motion set plays (default: the state's own name) |
| `mood` | the procedural idle's mood (`calm`, `dread`, `panic`, `chase`...); by default taken from the style's name when it's one of them |
| `sees` | sight's numbers (`SIGHT`: angle, range, crouched, meter, drain, calm), plus `give_up` (seconds unseen before `lost`). Absent: she doesn't look |
| `hears` | `range` (×, against how far a noise carries). Absent: she doesn't listen |
| `on` | an event and the state it leads to: `"spotted": "chasing"`, or `{"to": "chasing", "if": {condition}}` |
| `when` | conditions checked as she goes: `[{"flag": "saw_rival", "to": "jealous"}]` (any condition the format has) |
| `after` | `{"secs": 20, "to": "calm"}`: a timer from entering the state |
| `hold` | seconds before she can leave the state (0.5): no flicker between states |
| `bark`, `barks` | a line on entering; lines while in it (`every` seconds, never the same twice in a row) |
| `music` | the music state while she's in it; the most alert one in play wins (chase over uneasy over calm) |
| `look` | what her head follows: `player` (while she sees you), `noise` (where she heard it), `none` |
| `face` | an expression preset, once faces play (PERFORMANCE_PLAN §3) |
| `emit` | a story event on entering: `caught` (as today), or any name a beat listens for |

**Events:**

| Event | When |
|---|---|
| `glimpse` | the suspicion meter passes half (she saw something) |
| `spotted` | the meter is full. Today that's `caught`; now it's a change of state, and the pattern decides whether to emit `caught` at once |
| `lost` | after spotting you, she hasn't seen you for `give_up` seconds |
| `noise` | she heard one: the player's steps (walking, not crouched), a door, a thing dropped. `@heard` is where it was |
| `near` | the player is within `near` metres (barks; the romance side) |
| `reached` | a `chase` got to arm's length |
| `done` | the behaviour finished: a `once` route, a search's seconds, a routine's step |
| `told` | the story set her state (`behave` with `state`) |

**Values the runtime fills, alongside `@params`:**
- `@heard`: where the last noise was.
- `@last_seen`: where she last saw you.
- `@home`: where she was when the pattern started.
- `@player`: the player.

**The rules that keep it learnable:**
- **One change a tick:** at most one transition per tick, in the order `on` lists them.
- **`hold` first:** she can't leave a state before its `hold`.
- **The story always wins:** a `behave` overrides the pattern.
- **Seeded picks:** random picks (a random route, a fidget) come from a seed per playthrough and cast member, so a run
  replays the same and the checks can test it.

## 4. Giving one to someone

- **The cast's default for play:** `"cast": {"mari": {..., "behave": {"pattern": "stalker", "routes": ["r_hall", "r_library"]}}}`.
  It has the same fields as the action.
- **A beat:**
  - `{"behave": "mari", "pattern": "stalker", "routes": [...]}` gives her a pattern, its parameters inline.
  - `{"behave": "mari", "state": "hunting"}` puts her in a state (the event `told`).
  - Today's `{"behave": "mari", "as": "path", "route": "r_hall"}` still works, as a pattern of one state;
    `{"behave": "mari", "as": "off"}` takes her out of play.
- **A scene** takes her and hands her back in the state she was in, as it does today.
- **A condition:** `{"state": "mari", "is": "chasing"}` (one state, or a list), so a beat can fire as she starts
  chasing (a sting, a door slamming shut ahead). `caught` stays as it is.

## 5. Motion sets: how she looks in each state

```json
"moves": {
  "calm":    {"idle": "mari_idle", "walk": "mari_walk", "fidget": ["mari_hair_tuck", "mari_sigh", "mari_stretch"]},
  "uneasy":  {"like": "calm", "idle": "mari_idle_tense", "fidget": ["mari_glance_back"], "look": "mari_look_around"},
  "hunting": {"like": "uneasy", "walk": "mari_stalk", "check": "mari_peek"},
  "chasing": {"like": "hunting", "run": "mari_run"}
}
```

Each value is an id in the `motions` table, which already holds Kimodo motions (name, prompt, Loop, In place, file),
or a list of them. So a motion is made once, listed once, and the shot list already knows it.

**Roles** (a pattern relies on these names):

| Role | What | Made as |
|---|---|---|
| `idle` | standing, looping | Kimodo, Loop |
| `walk`, `run` | locomotion, looping, played in place at the speed she moves | Kimodo, Loop, saved **without** In place: the import measures the loop's own speed, and the desk takes the travel out itself |
| `fidget` | short one-shots over the idle every few seconds (a sigh, a hair tuck, a glance back) | Kimodo, 2 to 4 s, several per style |
| `look` | looking around, at a search point | Kimodo |
| `check` | looking into a hiding place | Kimodo |
| `turn` | turning on the spot (optional: otherwise she turns as she walks) | Kimodo |
| `sit`, `stand_up`, `talk` | as named | Kimodo |
| a pattern's own | `count`, `peek`, `wash`: what a route point's or a routine step's `do` names | Kimodo |

**When a style lacks a role**, it falls back, in order:
1. the style's `like`
2. the first style (usually `calm`)
3. the pose library: the idle pose, the walk overlay, or a pose with the role's name, under the procedural idle at
   the state's mood.

So nothing is ever missing, and the desk lists what is falling back.

**What already maps onto it:**
- The hide-and-seek round's `loops` (`{role: motions id}`) is a motion set for that round.
- PERFORMANCE_PLAN's `moves: {idle, walk, run, talk[], sit}` is a set with one style. With no styles, the roles count
  as `calm`.

## 6. How it plays (the desk and Unreal alike)

For each NPC, every frame:

1. **The behaviour moves her:** position, facing and speed, and it names a role (`walk` at 1.1 m/s, `idle`, `look`).
2. **The motion set picks the motion** for that state's style and role.
3. **Locomotion loops play in place**, at a rate matched to her speed (her speed ÷ the loop's own, kept between ×0.75
   and ×1.3; beyond that `walk` blends to `run`), so the feet don't slide.
4. **The idle:**
   - The idle loop plays, and every few seconds a `fidget` plays, never the same one twice running.
   - The gap is 6 to 14 s by default and shorter when she's uneasy; a style can set its own `fidget_gap`.
   - While she walks, a fidget plays as an `upper` layer (the desk's body layers).
5. **No pops:** a new state, role or motion blends in inertially (0.3 s, the desk's `inertialBlend`).
6. **Then today's layers:**
   - the procedural idle, at the state's `mood`
   - the look: her head follows the player while she sees you, or the noise when she hears one
   - reach

This replaces how Play draws NPCs today (library poses with a walk overlay) with the Watch's own stack. An NPC in play
then moves like the same character in a scene.

## 7. Patrols, routines and loops

- **Routes**, as today: points with `wait`, `pose` and `check`; `mode` is `loop`, `pingpong` or `once`. New:
  - a point's `do`, a role she plays there for its `wait`: `{"at": "kitchen_sink", "wait": 12, "do": "wash"}`
  - a point's `face`: a thing, or `player`.
- **Patrol**, as today: routes in order or at random. New:
  - `weights` (some rounds more often than others)
  - `rest` (an idle at `@home` between rounds).
- **A routine** (a new behaviour) is a looping list of steps. Each step is a behaviour with how long it lasts (or
  until it's done), and can be gated by a condition. A patrol is a routine of paths. For the romance side, her day
  around the house:

```json
"do": {"routine": {"steps": [
  {"path": "r_to_kitchen"}, {"idle": {"at": "kitchen_sink", "do": "wash"}, "secs": 20},
  {"path": "r_to_window"},  {"idle": {"at": "hall_window", "do": "watch"}, "secs": 15, "if": {"flag": "night"}},
  {"path": "r_to_sofa"},    {"sit": {"at": "sofa"}, "secs": 30}]}}
```

- **Interrupt and resume:**
  - When another state takes her off her routine (a noise), the routine keeps its step.
  - Back in `calm`, she walks to the nearest point of it and carries on.
  - A place can come back changed: the steps' `if`s (GAMEPLAY_PLAN §11, Chilla's Art).
- **Looping motions:** idles and locomotion are Kimodo Loops, saved with Drop last frame. One-shots (fidget, look,
  check) play once and hand back to the loop.

## 8. The patterns to ship

| Pattern | States | For |
|---|---|---|
| `routine` | calm | ambient life; the romance side (her day around the house) |
| `guard` | calm → uneasy → calm | stands somewhere, turns to a noise, then goes back |
| `watcher` | calm → uneasy → caught | today's `behave` with `sees`: walks a route, catches you on sight |
| `stalker` | calm → uneasy → chasing → hunting → calm, and caught | the Granny-style loop: her rounds, investigating, chasing, searching, giving up |
| `seeker` | count → search → found or lost | the hide-and-seek round (STORY_FORMAT §9.8); the round's `loops` and `barks` become the pattern's moves and barks, unchanged in the story |
| `follower` | near → far → waiting | romance and yandere: stays at your side. `clingy` comes closer; `sulking` won't follow |

A game's own goes in its `Patterns/` folder: a copy of one of these, edited.

## 9. The desk: what makes it easy

- **Game → Cast → Behaviour:**
  - the pattern, picked from a list with each one's line
  - its parameters: routes picked from the level's, and numbers shown with their defaults
  - **the motion grid**, described below
- **The motion grid:**
  - rows are the roles the pattern needs; columns are its styles
  - a made cell shows ✓, the motion and its length
  - a missing cell says what it falls back to, and has **+ make**. That adds a `motions` entry named
    `<game>_<cast>_<style>_<role>`, with a suggested prompt from `kimodo_prompts.json` (a hunting walk gets
    `stalk`; an uneasy idle, `look_around`), to the Kimodo shot list. From there it's the usual route: the demo, Send,
    and the cell fills.
- **The pattern's diagram:** states as boxes, events on the arrows, read-only. In Play, the current state lights up.
- **In Play (for the developer):**
  - a strip per NPC: her state, the meter, the role and motion playing, and the events she's waiting for
  - keys to force a state.
- **A new pattern:** copy a studio one into the game's `Patterns/` and edit it. A form comes later, if patterns turn out
  to be written often.

## 10. Checks

- **STORY:**
  - A pattern's behaviours, settings and events are known; every state can be reached from `start`; every state but a
    final one has a way out; every `@param` is filled; its routes exist.
  - `moves` names `motions` that exist.
  - Roles a pattern needs that a character doesn't have are a warning listing what falls back, not an error.
- **PATTERN** (new, offline, like BOARD): each pattern is run in a small simulation, a few minutes long, against
  scripted players: one who hides at once, one who is seen, one who is noisy. It passes when:
  - every state is entered by some player
  - she always comes back to `start` when the player stays hidden
  - no state is left within its `hold`
  - the same seed gives the same run.

## 11. Unreal

- **One interpreter, not a second source.** A C++ component (`UStoryPatternComponent`, in StoryRunner) reads the
  same JSON at runtime. The desk's JS and it read one file, so they can't drift (text is the truth).
  - StateTree isn't the source: generated StateTree assets would be a second truth, edited apart from the story.
  - It stays an option for a hand-made boss later.
- **Senses:** AI Perception's sight and hearing, with the state's numbers. The suspicion meter stays ours. Noise
  comes from noise events on the player's steps and doors.
- **Moving:** the navmesh. MoveTo along route points; a chase moves to the player.
- **Looking:** the AnimBP picks motions by the state's style:
  - **per style:** a Linked Anim Layer, or a Chooser table the importer writes from `moves`
  - **locomotion:** blended by speed
  - **fidgets:** montages on an upper-body slot
  - **on top:** the look-at Control Rig and the procedural idle, as additives (PERFORMANCE_PLAN §3).

## 12. Build order (each a step, a commit, a check)

1. **Motion sets on NPCs** (the visible win first, with today's behaviours and no states yet):
   - `moves`, the chooser and its fallbacks
   - Play's NPCs drawn by the Watch's stack with real motions: the idle loop, fidgets, locomotion synced to speed
   - the import measuring a loop's speed.
2. **Patterns:**
   - the format and the interpreter
   - the events from sight (`glimpse`, `spotted`, `lost`), plus `done` and `after`
   - `behave` `pattern` and `state`; the `state` condition
   - the first patterns: `routine`, `guard`, `watcher`, `stalker`
   - STORY's checks.
3. **New behaviours:**
   - `search` (around a point, checking the hiding places near it)
   - `chase`
   - `routine` steps, with interrupt and resume
   - hearing: `noise` from steps, doors and dropped things.
4. **The desk:** the cast's Behaviour panel, the motion grid with **+ make** into the shot list, the diagram, Play's
   developer strip.
5. **The rest:**
   - PATTERN (the simulation check)
   - the hide-and-seek round on `seeker`
   - `follower`.
6. **Unreal:** the component, perception, the AnimBP.

## 13. For the user to decide

1. **The first game's states:** is calm → uneasy → hunting → chasing → caught (and back) right? Which states does the
   romance side need (affectionate, jealous, sulking, clingy)?
2. **Chasing:** does she chase you in the first game, or only find you?
3. **Noise:** do the player's steps make noise (walking yes, crouched no)? Do doors, or a dropped plushie?
4. **After she loses you:** straight back to calm, or uneasy for a while (she remembers you, and spots you faster)?
5. **Fidgets:** a few made per character in Kimodo (more work, more life), or generic ones every character shares?
