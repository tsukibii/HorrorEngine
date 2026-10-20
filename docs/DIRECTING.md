# Directing: shots, moods, scares and cutscenes for first-person horror

What the director's desk encodes, and why. Read before plotting a game.
- Shot sizes live on clips (`shot`, `cam`), moods on scenes (`mood`), events on clips (`event`).
- The desk's body check and the shot review measure what can be measured. The rest is taste: the user's.

## 1. In first person, the camera is the player's eyes

- **The cutscene stays in the player's head.** Resident Evil 7 and Village keep their cutscenes in first person:
  characters talk into the camera, and the player is never shown from outside. Village even returns to first person
  for cutscenes after adding a third-person mode. We do the same, so there's no cinematic camera to stage and every
  frame is one the player could have seen.
- **The camera is the player, so it can only be where the player can be (the user's rule, 2026-10-20):**
  - **Position:** the scene's `view` spot, a place the player can stand (in a room, not in a wall or a prop; inside
    a locker only when it's listed in `camera.through` with stance `hide`). `story_check` refuses anything else.
  - **Height:** the player's stance (`stance`: stand 1.65 m, crouch 1.05, kneel 1.2, sit 1.15, lie 0.3, hide 1.6).
    Height is the first-person way to get low and high angles: seat the player and a standing person looms (the
    Bakers' dinner table in Resident Evil 7); put them on the floor and everything does.
  - **Angle:** where the head can turn. Looks past 75° up or down are refused (the neck). The soft lock keeps the
    subject inside a cone; the player looks around but can't lose them.
  - **Lens:** one field of view for the whole game (`game.fov`, 90° horizontal by default). No zooms: a lens change
    is the one thing that breaks "this is my eye". The only exception is `zoom` (up to 15 %) for a held focus beat,
    the way the eye narrows on something.
  - **Moving in:** `push` is the player **leaning in** (up to 0.35 m over the clip), not a lens. Bigger moves are the
    player being moved by the story (pulled, carried), in a held camera.
- **So a shot size is a distance:** how close the actor comes to the player's eye. Bring the actor in; don't
  narrow the lens. The bands follow Edward T. Hall's proxemic zones (intimate under 0.45 m, personal to 1.2 m,
  social to 3.6 m), because in first person distance is felt, not just seen: a face inside your personal space
  makes people uncomfortable, and studies with virtual characters find the discomfort peaks while they **stand**
  there, more than during the approach. So step in, then hold.
- **The player's body is part of the frame:** hands in view when grabbed, looking down when dragged, a flinch on a
  bang.

**Shot sizes** (the `shot` field: the distance from the player's eye to the actor's face; the desk's body check and
the shot review measure the clip's closest moment and say what it really frames as):

| Shot | Face at | Zone | Use |
|---|---|---|---|
| `ecu` | under 0.3 m | intimate: a violation | in your face: a breath on you, a bite, the grab, the eye at the keyhole |
| `cu` | 0.3 to 0.55 m | intimate | a face leaning into yours: a whisper, a threat said quietly, a confession |
| `mcu` | 0.55 to 0.9 m | personal (arm's length) | head and shoulders: talking close, a hand on your shoulder |
| `ms` | 0.9 to 1.6 m | personal to social | waist up: across a table, a conversation, someone in the way |
| `fs` | 1.6 to 3 m | social | the whole body: in the doorway, across the room; the pose reads |
| `ws` | over 3 m | public | small in the room: the end of the corridor, the window, the empty frame |
| `insert` | 0.2 to 0.7 m | within reach | an object in your hands or on the table in front of you |
| `pov_down` / `pov_up` | | | the player looks down (hands, a body, being dragged) or up (the ceiling, someone looming) |

**Framing a close-up from the player's eye:**
- **They come to you.** Every CU is staging: a mark close to the view spot and a walk in (a `move` key), or the
  player led to them. Blend or seam the walk so the approach itself is part of the scare.
- **Eye contact into the lens** is the first-person close-up's power: they talk to *you* (Resident Evil 7 and
  Village address the camera throughout). Break it on purpose: eyes that slide past you, or fix on something behind
  you, unsettle more than any stare.
- **Height difference sets the power.** Someone taller, closer, looking down at a seated player dominates; a child
  or a crawling thing seen from above is pitiable, until it looks up.
- **The face sits a little high in frame** when the player looks at it naturally (their look lands on the eyes or
  just below). Don't centre a face on the crosshair line: aim the look at the chin for a CU.
- **Wide is the default; close is an event.** At 90° the room is always around them: use the edges (a shape in a
  doorway at the side of the frame while she talks) and save the face-to-face for the beats that matter.
- **Foreground framing:** door frames, locker slats, a gap in curtains. The player peering through something is the
  most natural "shot" first person has (`camera.through`).
- **Hands:** the player's own hands in the lower frame (taking a photo, pushing a door, held by someone) sell the
  body; plan `insert` and `pov_down` beats for them.

**Camera moves** (`cam`):
- `push`: the player leans in over the clip (metres, up to 0.35). Slow and small reads as intimacy or dread; it only
  works if the actor holds still.
- `zoom`: a held focus narrows the view a little (up to 0.15): sparingly, on the thing the scene is about.
- `roll`: a head tilt, a dutch angle (unease, injury).
- `shake`: panic and impacts.
- `look`: hold on something other than the speaker (the reaction shot: her line over the thing she's talking
  about).
- `lag`: the eye trails the subject (exhaustion, drugged, cold).

## 2. Moods (scene `mood`; the desk's "apply" sets the camera and clip defaults)

| Mood | Recipe |
|---|---|
| **intimate** | They step into your space (CU, under 0.55 m) and stay; the player leans in a little (push 0.1 to 0.2 m); little or no shake, warm practical light close to the face, silence and breath under the line. Long clips; seams on turns and blinks. Eye contact into the lens is the scene. |
| **dread** | Far and still (WS, FS). **Negative space:** the subject off-centre, an empty doorway or dark corner filling the rest, so the player searches the frame for what might be there. Low hum, no music. Make them wait. |
| **panic** | The threat inside 0.55 m (CU; ECU for the grab), shake 0.3 to 0.6, heartbeat, quick seams (blink, stumble), a slight roll. No time to look away. |
| **reveal** | Lead the eye (a sound, a light, a movement on the reveal's side), then a slow look-at, the subject sharp and lit, a beat of silence before the sting. **Show less:** a shape, a hand, a face in a reflection. |
| **calm** | Across a table or at arm's length (MS, MCU), free look, natural light: the breather after a scare, so the next one lands. |
| **grief** | MCU, no push, low light, long holds; let the silence after the line play. |
| **chase** | Free camera, shake, music `chase`; the threat behind and to the side, never in front, closing the distance. |
| **aftermath** | The room after (WS), a slow look round, ringing ears, a dip to black. |

## 3. How horror scares (and how we build each)

- **Suspense beats surprise (Hitchcock's bomb under the table):** let the player know the danger exists, then make
  them wait. A knock heard, the door they must open, a figure glimpsed earlier. The `knock`, `glimpse` and `whisper`
  tricks plant it; the payoff comes minutes later.
- **The empty frame:** negative space and darkness do more than a monster. Hold a wide shot of an empty corridor
  past comfort.
- **Hold past comfort:** a long take forces the player to sit in it. A scene's `hold` keeps the camera on the moment
  after the last line.
- **The false scare, the release, then the real one:** a cat-jump (a creak, a falling object), relief, and the real
  thing while their guard is down. The checks space scares (60 s minor, 4 min major), so these are placed, not
  sprayed.
- **Reaction over reveal:** cut to the reaction instead of the monster's approach. In first person, the "reaction"
  is the player's own camera: a flinch, a stumble, the look pulled away (`stumble`, `lookat`).
- **Light:** low key, high contrast, practical sources (a candle, a flickering bulb). Flicker means danger. The next
  goal is the brightest thing in the room.
- **Sound carries half of it:**
  - silence before a scare
  - stingers rarely
  - breath close in the mix for intimacy and hiding
  - footsteps that stop
- **The threat finds you:** Alien Isolation's tension comes from a threat that is always where you don't want it,
  and the tension is paced over time. **Trigger cutscenes (`interrupts`)** do this cheaply: take the doll and she's
  behind you. Its makers also avoided autosaves because they kill tension, so checkpoints should be earned, not
  constant.

## 4. Quick-time events (scene clip `event`)

The Dark Pictures games are the model. Their QTEs have warning signs, consequences that branch the story
(including death) instead of retries, timed dialogue where silence is a choice, and "Keep Calm": pressing in rhythm
with the character's heartbeat to stay hidden.

| `type` | The player | Results |
|---|---|---|
| `press` | presses a key in time | success, fail |
| `mash` | mashes a key | success, fail |
| `hold` | holds a key the whole time (holding a door shut) | success, fail |
| `breath` | keeps still: doesn't move the mouse (hiding) | success, fail |
| `aim` | clicks a target | success, fail |
| `struggle` | drags the mouse in a direction (pull free) | escape, caught |
| `choose` | picks a line or an action before the timer ends; `default` is taken on timeout | the option ids |

**The rules:**
1. **Warn:** `warn` seconds of an "!" before it.
2. **Make the input mean the action:** drag back to pull back, keep still to hide, hold to hold the door.
3. **Branch, don't retry:** each result goes somewhere, through a result choice or `on` actions. Failing should cost
   something real: a relationship, an item, a life.
4. **One per scene at most,** and not in every scene. They're spice.
5. **Accessibility:** the runner's settings can turn off timers. Plan for it: the default result must still be a
   good story.

## 5. Unskippable cutscenes and the 2-hour minimum

- **Cutscenes can't be skipped,** so their minutes count fully for everyone. Tasks are counted twice:
  - **typical:** a first-time player who looks around
  - **fast:** a player who knows what to do
- The checks need typical ≥ `target_min` (150) and fast ≥ `fast_min` (120) on the shortest path to every normal
  ending.
- **A rough budget for a 2.5-hour game:**
  - 35 to 50 minutes of scenes (the spine)
  - 90 to 110 minutes of tasks
  - 10 to 15 minutes of chases, hides and timed moments
- **Timed tasks** (`timer`) feel like a choice ("hurry"), but a fast player still spends time. If a typical player
  needs longer than the timer, the check warns that many will fail. If a fast player can't make it, it's an error.

## 6. Animation, judged from the player's eye

- **Only what the player sees matters.** If she's sitting behind the kitchen table, her feet don't need to be
  clean. The desk's **body check** marks what's hidden and why ("feet: behind kitchen_table"), and the fixers ignore
  hidden parts.
- **Joins:** a pose jump between two clips is hidden by a seam when there is one (the blend happens under the
  blink). Otherwise use `blend` (a crossfade, 0.25 to 0.5 s) or `bridge` (an in-between motion: posed in the desk,
  then generated by Kimodo from the end pose of one clip to the start pose of the next).
- **Length mismatches** (the take is longer than the motion): `fit` set to:
  - `hold`: play it, then breathe on the last pose
  - `loop`: repeat it, for idles
  - `pad`: idle first, motion at the end
  - `stretch`: only between ×0.8 and ×1.25, beyond which it reads slow or hurried
- **Modifiers** for what text-to-motion does badly (sudden, unnatural movement). They're Blender-style easing on
  the clip's time:
  - `ease`: soften the start and end
  - `snap`: creep, then strike. The jumpscare: a slow lean for most of the clip, the last 0.12 to 0.2 s a lunge
  - `hold`: freeze mid-motion. The wrongness of something that stops when you look
  - `twitch`: stutter frames. The uncanny "it moves like it's broken"
  - `speed`, `ramp`, `trim`, `loop`, `mirror`
- **Recipes:**
  - **Jumpscare:** blocked `head_down` → `idle` (ease `in`), `twitch` 0.25, then `lunge` with ease `snap`; a
    `snap` modifier at 0.6; a sting cue 0.3 s before the end; mood `panic`.
  - **Intimate line:** a walk in to a mark about 0.5 m from the view spot (`move`), then `lean_in` (ease `inout`),
    the player leaning in a little (push 0.15), an `ease` modifier (0.3 in, 0.2 out), shot `cu`. The pilot's
    `s_message` c3.
  - **Searching walk:** `idle` → `look_left` with `walk` and `move` to a spot; the soft camera follows her.

## 7. The review, before anything goes to Unreal

1. **Watch** the path end to end (the animatic): does it flow? Are the cutscenes too long for their beat? Do the
   tasks give the story room?
2. **Storyboard:** every clip as a frame from the player's eye. Is each shot size right (did they come close enough)? Is the subject lit? Is the
   empty frame empty where it should be?
3. **The body check** per scene: the framing flags, pose jumps, length mismatches, visible parts.
4. `python tools/check_all.py`: paths, softlocks, timers, interrupts, playtime (fast and typical), the shot review.
5. **Fix it in the desk,** then build it in Unreal. The desk's storyboard and the exported glTF blocking are the
   reference Claude builds to.

## Sources

- [No Film School: how the camera builds tension in horror](https://nofilmschool.com/cinematography-camera-horror) · [Seven ways horror scares its audience](https://nofilmschool.com/ways-horror-likes-scare-its-audience)
- [Tyler Williams DP: horror cinematography, light, lens and composition](https://www.tylerwilliamsdp.com/blog/the-cinematography-of-fear) · [Videomaker: negative space](https://www.videomaker.com/article/c10/15681-how-to-effectively-use-in-negative-space-in-your-shots/) · [Mike Flanagan's negative space](https://www.horrorhomeroom.com/mike-flanagans-devotion-to-negative-space/)
- [Collider: horror filmmaking techniques](https://collider.com/best-horror-filmmaking-techniques/) · [GamesRadar: cheap tricks horror uses](https://www.gamesradar.com/4-cheap-tricks-horror-movies-use-to-scare-you/)
- [Push-in (glossary)](https://morphic.com/ai-glossary/push-in)
- [Resident Evil Village (Wikipedia)](https://en.wikipedia.org/wiki/Resident_Evil_Village) · [Village's cutscenes stay first person (Steam discussion)](https://steamcommunity.com/app/1196590/discussions/0/3484123157243008245)
- [Keep Calm (The Dark Pictures wiki)](https://thedarkpictures.fandom.com/wiki/Keep_Calm) · [Little Hope review (QTE warnings)](https://www.maxi-geek.com/con/the-dark-pictures-anthology-little-hope-review) · [The Devil in Me (timed choices)](https://en.wikipedia.org/wiki/The_Dark_Pictures_Anthology:_The_Devil_in_Me) · [House of Ashes review (QTE settings)](https://www.well-played.com.au/the-dark-pictures-anthology-house-of-ashes-review/)
- [The AI of Alien: Isolation (Game Developer)](https://www.gamedeveloper.com/design/the-perfect-organism-the-ai-of-alien-isolation) · [Alien: Isolation at gamescom 2014 (saves and tension)](https://news.xbox.com/en-us/?p=11775)
- Edward T. Hall, *The Hidden Dimension* (1966): the proxemic zones (intimate under 0.45 m, personal to 1.2 m, social to 3.6 m).
- "Differential Physiological Responses to Proxemic and Facial Threats in Virtual Avatar Interactions" (arXiv 2508.10586, 2025): discomfort with a virtual character inside personal space, highest while it stands there. https://arxiv.org/abs/2508.10586
- CD PROJEKT RED, "Cinematics and Interactivity in Cyberpunk 2077" (GDC 2024): why a first-person game tells its story in first person. https://schedule.gdconf.com/session/game-narrative-summit-cinematics-and-interactivity-in-cyberpunk-2077-two-sides-of-the-same-coin/902206
- Resident Evil 7's first-person choice (Kawata, Nakanishi): https://www.psu.com/news/30465/Why-Resident-Evil-7-is-set-from-a-first-person-viewpoint-
