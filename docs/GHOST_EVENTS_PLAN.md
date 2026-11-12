# Ghost events: a house that acts by itself (a plan)

DECISIONS 2026-11-12. The user: *"since we are making paranormal games we might want to be able to create
ghostly-eventors, e.g. objects within this range might fly off the table (some light physics), ghostly eventors should
function based off flags e.g. we complete a quest and trigger a certain event flag ... items that are flung shouldn't
clip out of the scene. ... if I have an animation of an npc opening a door what if I want a door to open easily in sync
with when their hand touches the door, or a cupboard ... things that add to the atmosphere and game that make it seem
like there is paranormal activity happening."* And the kind of game it's for: *"My Sister's Imaginary Friend Freddy
... discovering an alien gray is in your house while your parents are on vacation and you are looking after your
sister, the game would sort of start off like tamagotchi quests where you cook, clean etc, interact, but the paranormal
elements bleed into the game later, with intense jump scares, creepy moments"*, with *"drag and drop scripts that
would help set the atmosphere"*.

**Built with this note** (the look plugin, GODOT_LOOK §5p, §5q): the cloak (`HSCreatureSkin`'s `cloak`, the `HSCloak`
node) and creepy eyes (`HSEyeFx`). **Everything below is a plan: nothing of it is built. It waits on the user's
pick** (§7).

## 1. What a ghost event is

One small node, dropped in the level, that makes the house do something by itself. They all share one shape, so a
new one is an afternoon:

| It has | What | From |
|---|---|---|
| `needs` | the flags it waits for: `task:dinner`, `on:tidy`, `fact:met_freddy`, `!fact:lights_fixed`, `haunt>=3` (§4) | the starter Story's `holds()`, the Director's conditions |
| a trigger | walked into its area, looked at (or **only while not looked at**), a time after the flags hold, a chance, or `fire()` from any signal, a cue or the dread director | `event_area.gd`, `cue.gd`, `closer.gd`'s unseen test |
| `once` / `every` / `cooldown` | once, or again and again with a rest between | `dread_moment.gd` |
| what it does | the thing itself: §2, §3 | new |
| what it tells | the Fear node and the director (`hs_scare`, with a strength: a cup falling is 0.2, a cupboard emptying itself 0.8), a `Noises.make` (the one who hunts hears it too), a `fact` when it's done, a task ticked | `fear.gd`, `dread.gd`, `noise.gd` |
| `preview` | in the editor: the arcs it would throw things along, the door's swing, drawn | the look plugin's nodes' way |

So the user's flag case is one line: a `ghost_fling.gd` over the kitchen table with `needs = task:dinner`.

They are **starter kit scripts first** (`guides/first_game/starter/ghost_*.gd`, every by-hand project gets them),
then **Director cards** (a Build tab category *Hauntings*, the Story tab's THEN words), then story format words for
desk games (the rule: the runner, the check and STORY_FORMAT in one commit).

## 2. The two the user described

### 2.1 Things fly off the table: `ghost_fling.gd` (the poltergeist)

An Area3D: a box or a ball, the range. Everything loose inside it is its to throw: RigidBody3Ds, the starter's
pickups, a Director thing with *Moveable*, and with `make_loose` any small mesh in range (it gets a body and a box
collider when the event fires, not before).

**What it does** (`how`): *sweep* (all of it off one side, as an arm would), *burst* (outward from the middle),
*at you* (thrown toward the player and always missing: aimed 0.4 m or more wide of the head), *one by one* (0.1 to
0.6 s apart: worse than all at once), *lift and drop* (up 30 cm, held a second, let go), *rattle* (shaking where it
stands: the warning before a fling), *slide* (one thing, slowly, to the edge, and over). A spin on each; a cup that
has an `HSBlowUp` breaks where it lands (`break_on_land`); each thing's sound by what it's made of (the weapons
plugin's break kinds: ceramic, glass, wood, metal, card, plastic).

**Light physics.** Until it fires, nothing in range is simulated (frozen bodies: no cost, nothing nudged by the
player). When it fires they wake, fly, land, and freeze again once asleep.

**Never out of the scene** (the user's rule), four ways at once:
1. **It throws to a place, not with a force.** For each thing it picks where it lands: a point on the floor inside
   the room (`interior` + `room`, the room's own box from the export's volume marker; or a `keep_in` box of its own),
   with a clear arc to it (a shape cast along the arc: no window, no doorway unless `through_doors`), and works out
   the velocity that lands it there. Random impulses are what send things through walls.
2. **A speed limit** (6 m/s) and continuous collision on each body while it flies (thin walls, small things).
3. **A watch** while they fly and for 4 s after: a thing outside the room's box or under its floor goes back to the
   last place it was inside, stopped. (The weapons plugin does this for a broken thing's pieces: `_unsink`.)
4. **The player is never shoved**: the player doesn't collide with things in flight (they'd push the player through a
   wall, or the player them), only with things at rest.

**After**: it sets a `fact` (`mess:kitchen`) and can add a task, so a haunting makes a chore: *tidy up* counts the
things put back where they stood (each remembers its place; `count_in`, §5.2).

**The check** (GHOSTS): 200 seeded flings of each kind in tutorial v2's 304 and in a room with a window and an open
door: nothing outside the room, nothing under the floor, nothing through the player, everything asleep in 4 s, the
same seed the same throw.

### 2.2 In time with a hand: `touch_sync.gd`

The problem: a clip of someone opening a door, and a door. Timing the door's swing to the clip by hand breaks
whenever the clip is retimed, blended or swapped.

**The door follows the hand, not a clock.** The node names an `actor`, a `target` (a door with `door.gd`, a made
prop's part that opens, a drawer, a switch, a tap, anything with `fire()`) and finds the rest: the actor's nearer
hand bone, the target's handle (a marker; else the door's free edge at 1 m).
- **Touch**: when the hand comes within `reach` (8 cm) of the handle, it begins. For a switch or a radio that's all:
  `fire()` at the frame of the touch.
- **Follow**: for a door, a lid or a drawer, while the hand is on it the part's angle (or slide) is solved each frame
  so the handle stays under the hand. The clip decides how fast it opens.
- **Let go**: when the hand leaves (the handle can't follow further, or the clip ends), the part coasts to its
  `rest` (open, ajar, shut again) with the door's own weight.

It works at any playback speed, with any clip that reaches for the handle, and for a clip that pushes a door shut.
Where a clip has no reach in it, the other way: a **marker in the clip** (`touch` at its moment; Godot's animation
markers) and the node fires at the marker; Kimodo's constrained takes can write that marker themselves (the hand's
constraint time: `kimodo_constrain`), so made motions arrive already marked.

**And it is a ghost event**: point it at an actor wearing the cloak (§5p) and the door opens by itself, the handle
turning first, exactly as a body would open it, because a body is. A cup pushed along a table by a hand nobody sees
is the same node on a `push` setting.

**With no actor at all**: `ghost_hand.gd`, the cheap version: the handle turns, a pause, the door opens along a
curve (*creak open*, *try the handle* (it's locked: the handle only), *slam*, *all the cupboards at once*,
*drawers one after another*), on `door.gd` and the props' opening parts as they are.

**The check**: the door shut until the touch, moving within a frame of it, the handle within 3 cm of the hand while
it follows, the same at half and at twice the clip's speed; the cloaked actor's door the same door.

## 3. The catalogue: what else a house can do

Each a node of the same shape (§1). *Has*: what's in the project to build it from.

**Things that move**
| Event | What the player sees | Has |
|---|---|---|
| moved while you looked away (`ghost_move.gd`) | a chair turned to face the bed, a doll a step nearer, toys in a line, then a circle; between marks, only unseen | `closer.gd`'s unseen test, mirrors counted |
| stacked (`ghost_stack.gd`) | you come back and the chairs are a tower on the table | the fling's bodies, frozen in place |
| rocking (`ghost_rock.gd`) | a rocking chair, a cradle, a swing, a hanging lamp swinging; stops dead when you look | a hinge and a sine; the look test |
| a ball out of the dark (`ghost_roll.gd`) | it rolls out of the hall to your feet, and stops | the runtime's `roll` |
| levitation (`ghost_lift.gd`) | one thing lifts off the table, turns slowly, hangs, drops when seen | the fling's *lift and drop*, slower |
| pushed out | books leaving a shelf one at a time, a frame tilting then falling, cutlery out of a drawer | the fling's *slide* |
| the bed, the sofa | a dent in a cushion where nobody sits, a shape under the blanket that flattens when you pull it | the cushion and bedding props made twice (plain, dented), swapped unseen |
| the water glass | rings in a glass on the table, in time with steps you can't hear | `HSLiquidFill`'s slosh |

**The house's own things**
| Event | What | Has |
|---|---|---|
| doors | ajar when you left it shut, closing behind you, the handle tried from the other side | `door.gd`, HORROR_TODO's door tried from outside |
| lights and power | a switch flipping by itself, one bulb following you room to room, the fridge light on in a dark kitchen | `lights.gd`, `HSFlickerLight`, `presence.gd` |
| the set | the TV on to snow at 3 a.m., a channel that shows the room you're in, the radio tuning itself | `HSCrtScreen`, the little things' lives |
| toys | a music box starting, a toy that walks out of the toy box, a baby monitor that answers | new props (the prop standard: customizable recipes), the sound shelf |
| the laptop | the terminal typing by itself, an order you didn't place arriving at the door | the devices plugin: `HSTerminal`, `HSPackage` |
| taps and steam | the shower running, the bath full, the kettle boiling in an empty kitchen | the kit's tap, the lives, steam |
| the clock | every clock in the house at 3:13; an hour gone between two looks (missing time) | the kit's clocks' hands, `chapter` |
| candles | every flame leaning the same way, then out | `HSPropFX` flames |
| curtains | billowing with the window shut | the curtain props, a wind on their top bones (new) |

**Traces**
| Event | What | Has |
|---|---|---|
| footprints (`ghost_steps.gd`) | wet prints appearing one at a time across the floor toward you; small ones, three toes | `HSPuddle`'s decal way |
| hands on glass | a handprint in the frost or the steam, from the other side | `HSGlass.frost`, the mirror's steam writing |
| drawings | the sister's drawings on the fridge changing night by night: a grey figure, nearer the house | the prop generator's pictures |
| fridge magnets | letters pushed into a word while the door was shut | a made prop, its letters parts |
| dust and plaster | dust falling from the ceiling under steps overhead | `HSDust`, eye_candy's catalogue |
| flour, spilled sugar | prints in it; a cloaked thing's feet showing where it walks | a decal trail under a cloaked actor |

**Seen and half seen** (most of these exist: this is where the new looks go)
| Event | What | Has |
|---|---|---|
| the cloak in weather | nobody there, and a shape in the rain, the fog, the flashlight's beam, the dust | `HSCloak` (§5p: see-through things behind her leave her as a hole: here that's the point) |
| the cloak breaking up | near the TV, in lightning, under the sprinkler: bands of him for a moment | `HSCloak.flicker`, `presence.gd`, `HSLightning` |
| eyes in the dark | two points in the vent, the wardrobe, under the bed, only while your light is off | `HSEyeFx`'s glow, the flashlight's `beam_on` |
| a shadow with no body | on the wall, nobody casting it | the cloak's `shadow` |
| at the corner of the eye, closer each look, only in the mirror, feet under the door | as built | `glimpse.gd`, `closer.gd`, `mirror_figure.gd`, `door_feet.gd` |
| behind the fridge door (`reveal_behind.gd`) | you shut the fridge and he's where the door was | a part that opens, the unseen test, a cue |
| the sister sees him | she looks at an empty corner, follows something across the room with her eyes, smiles at it | a look-at (§5.3), her face clips |

**Heard** (placed in the room, through the sound physics): steps overhead crossing from room to room, knocks that
answer yours (knock three times: `interactables`' knock, then a `dread_moment`), a child laughing in an empty room,
humming from the sister's room after she's asleep, her voice on the baby monitor talking to someone.

## 4. The haunt level: how it bleeds in

One number for the game, 0 to 5, that every ghost event reads (`min_haunt`, `max_haunt`) and the Story sets
(`haunt 2` on a task done, a night slept, a fact). It's what makes "starts simple, the paranormal bleeds in later"
one setting instead of a hundred `needs`:

| Haunt | The house | Events let through |
|---|---|---|
| 0 | a house | none |
| 1 | you could be wrong | a thing moved an inch unseen, a tap dripping, a toy on (strength up to 0.2) |
| 2 | somebody's here | doors ajar, the set on, prints, the sister looking at corners |
| 3 | it wants you to know | cupboards, rocking, the ball, eyes in the dark, the shadow |
| 4 | it's angry or it's hunting | flings, the cloak seen, the hunt (`searcher.gd`), chases |
| 5 | the last night | everything, the director on `relentless` |

The dread director (`dread.gd`) picks ghost events as its moments (they have `tier` and `weight`), so within a
level they're paced by its build, peak and relax, never the same twice running. A check walks a game's nights and
lists which events can fire at each level (nothing at 0; no level with fewer than three).

## 5. What "Freddy" needs beyond ghosts

*My Sister's Imaginary Friend Freddy*: days of looking after her, a grey in the house. What exists and what doesn't.

### 5.1 Already here
- **Freddy himself**: the Studio's grey alien preset (`creatures.mjs make --only alien --export`: 1.25 m), cloaked
  and with eyes that glow (built with this note); a child's body for the sister (ages 8 to 17), her face clips.
- **Him as a threat**: the corner of the eye, closer each look, the mirror, the shadow, feet under the door, his
  signs (static, lights), the hunt by ear with hiding and held breath, the chase, his menace, the director, the
  body under fear, cues (the face on the ceiling while you lie in bed is already this game's abduction night).
- **The days**: the to-do list, requests (*someone asks for something*), nights as chapters (a bed, a title card),
  the little things (kettle, hob, pots, tea, taps), cleaning a stain, containers, carrying, the book, board games
  to play with her, hide and seek as a round, the laptop to order groceries with the cash the parents left, parcels
  at the door, the phone that rings.

### 5.2 Missing: the Tamagotchi half
| What | Why | Size |
|---|---|---|
| **her needs** (`ward.gd`): hunger, fun, sleep, clean, and trust in you, each falling by the clock, raised by a chore; never bars: she says it, her face and walk show it, a task appears on the list | the loop the whole first act is | medium |
| **a day** (`day.gd`): morning, afternoon, evening, night as phases with their chores; the clock on the wall the real one; bed ends it, the night is the haunt's | paces the chores and the bleed (a day a haunt level) | medium |
| **counting chores**: *put 6 toys in the box*, *3 plates in the sink*, *everything back on the table* (`count_in:<container>`, `count_at:<place>`) | tidying, and tidying up after a fling | small |
| **cooking** (`recipe.gd`): steps on things that exist: from the fridge, into the pot, on the hob, wait (its life's states: raw, cooking, done, burnt), onto a plate, to her | the first chore the user named | medium |
| **food props**: a `food` family in the prop generator (customizable, as the cans: a cereal box, milk, eggs, bread, instant noodles, rice, a bento, plates of food raw to burnt) | cooking needs things to cook | medium |
| **more chores from what's there**: dishes (the sink props: hold to wash), laundry (the folded clothes, a washing machine with a life), beds made (bedding swapped), the rubbish out (the sack to a bin on the street) | variety for five days | small each |
| **the evening call**: the parents ring at eight, you report, it saves; later the line is static, then someone else is on it | exposition, a save point, a scare | small (HORROR_TODO's phone) |

### 5.3 Missing: her and him in the room
| What | Why | Size |
|---|---|---|
| **look-at** (`look_at.gd`): a head and eyes turned to a point or a thing, eased, within a neck's reach | *she's looking at something that isn't there*; him watching you from a doorway | small (Godot's look-at bone modifier; planned in EXPRESSIONS_PLAN) |
| **a routine**: where she is by the hour (breakfast, the garden, her room, bed), walking between through doors | a child who lives in the house | medium (PATTERNS_PLAN, not built) |
| **follow and lead**: she takes your hand to show you something; she won't go into one room | the story's turns | small on `behave` |
| **the imaginary friend's place**: a second chair she sets, a plate that's empty when you look back, a second voice on the monitor | the title | ghost events (§3) pointed at one seat |
| **hiding under the bed, behind the shower curtain** | the abduction night | HORROR_TODO, not built |

### 5.4 The jump scares this game would want
All `cue.gd` with one new verb: **decloak in your face** (`HSCloak.reveal(0.15)` and a scare at 0.5 m), the face
at the window in a lightning flash (as tutorial v2's figure), *behind the fridge door*, under the bed when you
hide there, the sister's voice from her room while she's standing behind you, the cloaked thing walking through
the flour you spilled. Each silent for the last half second before it (research/jump_scares.md), none repeated.

## 6. Build order (a proposal)

1. **The base and the two the user asked for**: `ghost_event.gd`, `ghost_fling.gd` (with the keep-in rule and its
   check), `ghost_hand.gd`, `touch_sync.gd`; a guide page with pictures; tutorial v2 gets one of each.
2. **The haunt level** and the director picking ghost events.
3. **Six cheap ones**: moved while unseen, rocking, the ball, footprints, eyes in the dark, the set turning on.
4. **Look-at**, then the sister's needs, the day and counting chores (Freddy's first act playable).
5. **Cooking and the food props.**
6. Director cards and story words for all of it.

## 7. For the user to say

- Which first: the order in §6, or Freddy's first act (§5.2) before more ghosts?
- Freddy by hand (the starter kit) or in the Director? The ghost events start as starter scripts either way.
- Is anything in this game shot at? (It decides whether Freddy wears `HSHitReact`; the cloak already flickers when
  he's hit.)
- The haunt level: one number for the game (§4), or one per room (a haunted room in a calm house)?
