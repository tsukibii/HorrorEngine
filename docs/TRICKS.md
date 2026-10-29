# Cheap tricks: hiding seams, selling the scare

Horror forgives a lot, because the player can't see well, expects to be manipulated, and fills gaps with dread. We
use that. Each trick says what it is, when to use it and what it costs.

## 1. Seams between takes (the 10-second limit)

Each clip is one generated take of 10 s or less, so a scene of several takes has cuts. Three layers keep a cut
invisible:

**1. Bookend frames (free, done at recording).**
- Every take begins and ends on the cast member's **anchor frame**: face to camera, neutral, mouth closed, the same
  framing. Use MiniMax's first-frame and last-frame control where available, starting every take from the same
  anchor image.
- `story.py clips` writes each take's start and end frame into the shooting script.
- Matching poses make even a plain cut read as a blink.
- The `turn` seam is the cheapest of all: takes end and begin with the actor turned away or head down.

**2. A seam effect at the cut** (STORY_FORMAT §3.2):

| Seam | What happens | Notes |
|---|---|---|
| `blink` | 0.12 to 0.18 s of black: the player's own blink | Use a slightly soft fade-in, not a hard pop. A blink every few seconds during long scenes makes the real seam blinks invisible: blink sometimes when there's no cut too |
| `glance` | **Deprecated** (DECISIONS 2026-10-29: tested, it reads as the eye wrenched away and back; a STORY warning). It eased the soft camera to the `look` target over 0.35 s, held, eased back | Give the player a reason: the lamp flickers, a door creaks, a shadow moves. It feels like looking away in real life |
| `flicker` | The practical light drops for 2 to 4 frames, and the cut lands in the dark | Lights already flicker in these games, so nobody counts them |
| `occlude` | A swinging bulb throws the actor into shadow, smoke drifts across, a second figure walks between | Costs one cue |
| `cutaway` | **Deprecated** (as `glance`). A hard cut to an insert (her hands, the photo, the key) and back | Cinematic, so use it sparingly in first person |
| `stumble` | Camera shake and a look down; the cut happens at the bottom | After grabs, near misses, falls |
| `dip` | A longer fade through black: time has passed | A scene in two halves |
| `jcut` | The next take's voice starts 0.3 s before its picture, while the face is hidden by any of the above | Hides that the delivery restarts |
| `heartbeat` | A vignette pulse with a heartbeat; the image softens for 0.3 s | Dread scenes |

**3. Never at a bad moment.**
- Cuts go between sentences, never mid-word. The checks force a seam on every cut.
- The shot review takes a picture at every seam, so we see what the player sees when it happens.

## 2. The camera: control without taking control

| Mode | Movement | Look | Use |
|---|---|---|---|
| `free` | yes | yes | ambient moments, voices from elsewhere |
| `soft` | off (or slowed to 20 %) | inside a cone round the subject (default 30° × 18°), with a spring that pulls back when the mouse stops; **avoid zones**: directions the look can't reach (a greybox gap, the edge of the set, where a seam is being hidden) | most performed scenes: the player feels free, and we know they're looking at her |
| `hard` | off | off: a cinematic camera, blended in and out over 0.5 s | rare: an establishing shot, a death |
| `held` | off; the body is pulled by the actor | small, shaky; the struggle reads the presses (E, Space, the left button) | grabs |

**Forced looks (`lookat`):**
- Eased (0.5 s, or 0.8 s past 120°).
- Held no more than 2.5 s without control (the checks warn).
- Control comes back softly.

**The player's own body sells the camera:**
- a slight breath sway when still
- a flinch on loud sounds (0.1 s, 2°)
- the head turning toward a sound before the player does (5°, a hint)

## 3. Immersion tricks (cheap, reusable, built once in the runner)

- **Lead the eye:** a sound, light or movement 0.5 to 2 s before every reveal, from the reveal's side. The checks
  enforce it.
- **The look-away swap (`swap`):** change the set while it's off screen. The hallway that changes when you turn
  round is the cheapest scare there is.
- **Glimpses (`glimpse`):** a figure at the edge of the view for 0.4 s, gone when looked at. The stand-in is fine
  for these: it's too brief to read.
- **Sound does the heavy lifting:**
  - creaks before steps; knocks that stop when you come near (`knock`)
  - whispers from where nobody stands (`whisper`)
  - silence before a scare (music `silence` 20 s or more)
- **Light as the level designer:**
  - the next goal is the brightest or warmest thing in a room's entrance shot (the shot review flags it)
  - flicker means danger
  - candles gutter when she's close
- **Doors:**
  - a door slams behind you (`slam_behind`)
  - a locked door rattles from the other side
  - a door is found open that you closed
- **Lights dying (`lights_die`)**, one by one toward the player.
- **The loop (`loop_hall`):** walk through a door and be back at its start, one thing changed each time.
- **The forced close-up (`shot: closeup`):** the generated-face trick. Her face fills the screen for the line, the
  camera cuts back, and nobody checks her body.
- **The breather:** after every chase or grab, about 2 minutes with no threat, then a note or a story beat (dread,
  relief, information).
- **Fake agency:**
  - choices by acting (`choice by act`) instead of menus
  - a struggle you can win
  - a locker you can hide in, even if she was never coming
- **Notes as lore:** the cheapest way to make a 2-hour game feel deep. Every stitch hides one or two.
- **Secrets:** easter eggs that change the ending. Players replay for them, and the refund window doesn't care.

## 4. Stitch templates (the player's tasks)

Reusable shapes for the stitches, so a game's tasks are written fast. Each is a pattern of beats over the world
vocabulary.

| Template | Shape | Minutes |
|---|---|---|
| `fetch` | A locked door; its key is somewhere in 2 to 4 rooms, behind a note that hints | 4 to 8 |
| `code` | A combo lock; the digits are spread over notes, a photo and a calendar | 5 to 10 |
| `power` | Lights out (`power: off`: every bulb and lamp in the level, the switches dead); find the breaker box (`use: breaker`) in the dark; the lights come back changed. The quick task *The power cut* | 5 to 8 |
| `chore` | A job of the shift on the to-do list: a mess scrubbed away (`use: clean`, the mop in the hand), the door locked (its `latch`), wiping, tidying; done in any order; a timed one (`secs`) fails when its time runs out. The quick tasks *A chore: clean up a mess*, *A chore: lock the door*, *A timed chore: take your pills* (a counter goes up when they're taken) | 1 to 3 |
| `peephole` | A knock at night; the eye to the door's peephole (`peeping`): nobody there, or someone shown while you look and gone after. The quick task *A knock at the door* | 1 to 2 |
| `hide` | Something walks the corridor (stalker `patrol`); get to a locker and wait it out | 3 to 6 |
| `escape` | A chase (`stalker chase`) along a fixed route of doors that slam open | 2 to 4 |
| `explore` | No lock: rooms to read and look at, scares on a timer, a `glimpse` | 5 to 10 |
| `loop` | A `loop_hall` that changes each pass until the player notices the clue | 4 to 8 |
| `ritual` | Collect N items and place them (`use_on` × N) | 8 to 15 |

## 4b. Timed moments and trigger cutscenes

- **Quick-time events** (clip `event`; DIRECTING.md §4): press, mash, hold (a door shut), breath (keep still in the
  locker), aim, struggle, and choose (timed dialogue: silence is a choice). Warn first, make the input mean the
  action, branch on the result, one per scene at most.
- **Timed tasks** (stitch `timer`): "before she gets up". A fast player beats it with seconds left and feels clever;
  a slow one hits the fail branch. The checks keep timers fair.
- **Trigger cutscenes** (`interrupts`): take the doll, open the wrong door, make noise near her, and a scene plays,
  usually a death. It's cheap dread: every object becomes a question.

## 5. The grab and the struggle (hybrid IK)

When a scene's clip has an `event` of type `struggle`, the actor grabs the player:
1. Kimodo's body animation lunges, and the hand reaches `player_collar` at the grab frame (the motion job pins it
   there).
2. At the grab frame, IK takes over the arm. Its target is a socket on the player's camera rig, so the hand stays
   on the player whatever the player does.
3. The player mashes E (or Space, or the left button). Their camera pulls back in the `pull` direction, while the
   actor's upper body runs physical animation, partly ragdoll and blended in proportion to the presses. She leans, staggers and loses her
   footing instead of playing a canned clip.
4. Past `need` within `secs`, she stumbles: a stumble picked by the pull's direction, the physics blend
   peaks, then recovers to her idle. That's `escape`. Otherwise she wins (`caught`).

The details are in ANIMATION.md §4. It's cheap because it's one system made once and reused by every grab in every
game.
