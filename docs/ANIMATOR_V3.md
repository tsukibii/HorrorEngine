# Animations v3: creatures, a head that follows you, a grip on props, fights

The user's request (DECISIONS 2026-11-14, animations v3), on the branch `even-more-animations-v3`. It adds to the
Animator v2 (docs/ANIMATOR_V2.md: read that first; nothing in it changes) and to what plays its clips in Godot.

**The plan is §7, ticked as built. §8 says what was measured; §9 what's left.**

## 1. What was asked, and how it's read

| Asked | Built as |
|---|---|
| "animations for creatures (our monsters) maybe some crawls, sneaks, peaking" | new clips: a crawl on hands and knees, a scuttle on hands and feet, a hunched creep, a careful sneak, a peek round a corner (§2) |
| "a generic lunge jump scare ones (ones that briefly appear)" | four scare clips that start already coiled, with a `peak` moment and how long to show her (§2.5) |
| "toggle semi ik animations where the npc head tracks the user for a given adjustable range (… 160 degrees … 80 degrees left and 80 degrees right)" | `HSHeadTrack`, a layer over any clip (§3) |
| "a gizmo we can add to props and adjust to handle size so for pickup object animations … it look like the npc actually picked it up e.g to eat or drink" | `HSGrip` under a prop, its gizmo, `HSHandIK` closing her fingers round it and bringing it to her mouth (§4) |
| "generic ik inspired fight animation, one for punch which tracks the player or npc it's trying to punch, or swing object e.g a baseball bat or any object it's carrying" | a punch and a swing as clips, aimed by `HSHandIK`; being hit (§5) |
| "any more generic animations you think that would be required, e.g a sneak" | sneak and its crouch, looking round, a knock, cowering (§2) |

"Semi IK" is read as: **the clip is played as it was made, and a few bones are corrected after it** (Godot's
SkeletonModifier3D), by as much as a weight says. Nothing is solved from scratch and no clip is made for it.

## 2. The new clips (`tools/animator/core/`)

Every one is made from the body and the five sliders, like the first 24: a strong body is quicker and holds itself
lower, a heavy one slower with shorter steps. New kinds on the page beside the old ones; all baked together.

| Kind | Clips | What |
|---|---|---|
| `sneak` | `sneak_loop`, `crouch_loop` | a careful crouched walk, the foot set down on its ball, the arms held; standing crouched |
| `crawl` | `crawl_loop`, `crawl_idle_loop` | on hands and knees, opposite hand and knee together; stopped on all fours |
| `creature` | `creep_loop`, `creep_idle_loop`, `scuttle_loop` | a hunched stalk, arms hanging forward, the head pushed out; its stance; a fast scuttle on hands and feet, knees and elbows out |
| `peek` | `peek_out`, `peek_loop`, `peek_back` (+ `_l`) | leaning out past a wall's edge to her right with a hand on it, held, drawn back (`_l`: to her left) |
| `scare` | `scare_lunge`, `scare_loom`, `scare_snap`, `scare_claw` | §2.5 |
| `fight` | `punch`, `swing`, `hit_react` (+ `punch_l`, `swing_l`) | §5 |
| `eat` | `eat`, `drink` (+ `_l`) | the hand that holds something to the mouth: two bites, or one long sip with the head back |
| `acting` | `look_around`, `knock`, `cower_loop` | the head and chest turned left then right; three raps on a door; crouched with the arms over the head |

Files: `stealth.js` (the slow, low two-legged gaits: sneak, creep, their stances), `quad.js` (on all fours: the crawl
and the scuttle), `scare.js`, `fight.js`, `acting.js` (peek, eat, drink, look round, knock, cower). `animate.js`
`KINDS` and `makers` list them; `VERSION` 3.

### 2.1 The rules they keep

- **In place**, like the walk: a gait's record says its `speed`, the game moves her.
- A loop closes on itself. An act starts and ends in the idle's first pose, except: `peek_out` ends as `peek_loop`
  leans and `peek_back` starts there; `scare_claw` starts and ends as `crawl_idle_loop` kneels; **a scare starts in
  its own coiled pose** (she's shown already in it) and ends in the idle's.
- What a game needs to stage one is in its `meta`, from where she stands, in metres: `peek.edge` (where the wall's
  edge is), `punch.at` and `swing.at` (where the fist or hand is as it lands), `eat.at` and `eat.mouth`, `knock.at`,
  `scare.peak` and `scare.show`. Moments are events: `out`, `hidden`, `peak`, `hit`, `bite`, `sip`, `knock`.
- A foot or a knee that's down doesn't slide; nothing under the floor; no bone turns more than 34° in a frame.

### 2.2 The slow gaits (`stealth.js`)

One planner, `prowl`, for a slow walk held low: where each foot lands (on its ball: toes down, then the heel let
down), how long it stays (0.7 of the stride: both feet down for a long while), the pelvis dropped by a share of the
leg and carried over the planted foot, the trunk leant. Sneak: knees lifted, arms bent and held near the body, the
head level. Creep: lower, the trunk at 40°, the arms hanging forward from the shoulders with the hands clawed, the
head pushed out and tilted, the feet barely lifted.

### 2.3 On all fours (`quad.js`)

A leg in the crawl is a contact at the **knee**: the knee stays where it was put while the hip goes over it, so the
pelvis rises over each knee and lists toward the one that's swinging (its height and list solved together each frame
from the knees that are down). The shin lies behind it. The hands are planted by the arm's IK, the wrist bent back so
the palm is flat. The scuttle is the same plan with the feet as the contacts: on the balls, wide, the knees out, the
hips level with the shoulders, twice the pace.

### 2.5 Scares

| Clip | From | What | Shown for |
|---|---|---|---|
| `scare_lunge` | coiled: low, the arms drawn back | a step and the whole body thrown forward, both hands out at your face, shaking | about 0.9 s |
| `scare_loom` | bent double, the head hanging | whipped upright onto her toes and leant in over you, the head tilted | about 1.1 s |
| `scare_snap` | stood, the head down | the head snaps up and to one side, a shoulder jerks | about 0.9 s |
| `scare_claw` | on all fours | a hand clawed up and forward from the floor, the trunk risen | about 0.8 s |

`meta.scare`: `peak` (s: the worst of it), `show` (s: how long to leave her there before she's gone: the hold's end,
before she relaxes), `reach` (m: how far in front of her feet her hands or head get: stand her that much and a little
more from the player's eye).

## 3. A head that follows you: `HSHeadTrack` (Look plugin, `head_track.gd`)

A SkeletonModifier3D under her skeleton. After her clip each frame it turns her **chest a little, her neck, her
head and her eyes** toward a target: the player's eye by default (`target` empty: the camera in view), any node, or a
point.

- **`range_degrees` = 160**: the whole arc, half to each side of straight ahead; **0 is the way she faces** (her own
  forward, not where her clip has turned her chest). Up and down have their own limits (`up_degrees`, `down_degrees`).
- **Past the range** (`beyond`): *lets go* (her head goes back to what her clip has it do: the default) or *holds at
  the limit*. Six degrees of slack so she doesn't flick at the edge.
- **A switch**: `follow` on or off, eased over a third of a second; `amount` 0 to 1; `max_distance`.
- How it turns: the angles are smoothed and never faster than `turn_speed`; `snappy` moves in sudden steps instead (a
  creature). `body_share` of a turn is the upper spine's; the eyes lead by up to 18°.
- `HSHeadTrack.attach(character, settings)`; `look_at_node`, `look_at_point`, `follow_player`, `stop`; `report()`.

Godot 4.7 has a `LookAtModifier3D` of its own (one bone, a limit that is also the whole arc). Ours is one node for
the whole chain, measured from her facing, with the two behaviours past the range.

## 4. A grip on a prop: `HSGrip` and `HSHandIK`

### 4.1 `HSGrip` (Look plugin, `grip.gd`; its gizmo `grip_gizmo.gd`)

A Node3D put under a prop **where a hand takes it**. Its place is the middle of what the hand closes round; its **green
arrow (+Y) runs along the handle toward the thumb**; its **blue arrow (+Z) points at the palm** (where the hand comes
from). The same node serves either hand (a left hand is the right's mirror).

| Property | What |
|---|---|
| `shape` | Handle (a bat, a bottle, a can, a torch), Ball (an apple), Pinch (a key, a pill) |
| `size` | how thick it is where the fingers close, metres: what the gizmo's side handle drags |
| `length` | how long the handle is |
| `hand` | either, right only, left only |
| `use` | just held, eaten, drunk from |
| `mouth` | where the mouth goes (the rim, the bite), from the grip |
| `tip` | where it hits when it's swung, from the grip |

In the 3D view (the Look plugin's gizmo): the handle as a wire cylinder at its size, **a hand drawn round it** with
the fingers wrapped as they will be, the mouth and the tip as marks; four handles to drag: thickness, length, mouth,
tip, each undoable.

No grip on a prop: one is guessed from its size (its longest side the handle).

### 4.2 `HSHandIK` (Look plugin, `hand_ik.gd`)

A SkeletonModifier3D under her skeleton, for both hands:

- **`grip(side, size, shape)`**: her fingers closed round a handle that thick. Each finger is wrapped: its joints
  bent so each bone lies against a circle of the handle's radius set in the palm (a thin handle a fist, a can an open
  hand); the thumb laid as the Animator lays a fist's. `release(side)`.
- **`bring(side, {point, target, peak, rise, hold, fall, aim, freeze})`**: a point that rides the hand (in the wrist's
  own space) is brought onto a target in the world by `weight`: the arm's two bones solved again for where the wrist
  must be, the elbow kept on the side the clip had it. `aim`: the hand is also turned so the point leads. The weight
  is an envelope over the clip's time (`at(side, t)`): rising into `peak`, held, let go. `freeze`: the target is
  taken as it was at the peak (a punch thrown doesn't home).

One rule serves every use: her palm onto a thing's grip as her hand closes (a pick-up that touches); a held thing's
`mouth` onto her mouth as she bites or sips; her knuckles onto who she punches; a held thing's `tip` onto who she
swings at.

## 5. Fights

- `punch`: the guard up, the shoulder back, the fist out with the chest and hips turning into it, back to the guard.
  `swing`: the hand up behind the shoulder, a diagonal blow down through the target and across, recovered.
  `hit_react`: the trunk and head thrown back, a step to catch it, upright again.
- In Godot she **turns to who she's hitting until the blow is thrown**, standing `reach` away, and `HSHandIK` carries
  the fist or the thing's end onto them (their chest or head: a node's `aim_point()`, its skeleton's chest, the
  player's eye less a hand's breadth). When it lands near enough: `struck(target, kind)`, the target's own `struck`,
  `hit` or `punched` called when it has one; someone with a Motion node plays `hit_react`.

## 6. Who plays them

- **The starter kit's `motion.gd`**: `sneak_to`, `crawl_to`, `creep_to`, `scuttle_to` (she stays low after: `rise()`),
  `peek(corner, secs)`, `scare(kind)`, `punch(target)`, `swing(target)`, `eat(thing)`, `drink(thing)`,
  `look_around()`, `knock(at)`, `cower(on)`, `head_follow(on, target, range)`; a held thing sits in her hand by its
  grip. `act.gd` offers them by a quest's words. `moves.gd` uses her own creep, crawl, peek and lunge for a hunt.
- **The markers**: a Walk's pace (walk, run, sneak, crawl, creep, scuttle); a Grab that eats or drinks; an **Attack**
  card (a punch or a swing at you or at something, how many times); *Her head follows you* on any marker, carried on
  like her face; a **Jump scare** card (she appears, the scare plays, she's gone when it's been shown).

## 7. The plan

- [x] The request in DECISIONS, this design
- [ ] `tools/animator/sticks.mjs`: a clip as rows of stick figures (side, front), to look at one without Godot
- [ ] Clips: sneak and crouch; creep and its stance (`stealth.js`)
- [ ] Clips: crawl, all fours, scuttle (`quad.js`)
- [ ] Clips: peek out, held, back
- [ ] Clips: the four scares
- [ ] Clips: punch, swing, hit_react
- [ ] Clips: eat, drink; look_around, knock, cower
- [ ] `animate.js` kinds, `VERSION` 3, the page's kinds and labels; ANIMATOR holds each new clip to its rules;
      ANIMATORPAGE
- [ ] `HSHeadTrack`; measured (the range, both behaviours past it, the switch, the speed)
- [ ] `HSHandIK`: the arm's IK and the envelope; the fingers' wrap; measured
- [ ] `HSGrip` and its gizmo; a held thing sits in the hand by it; a grip guessed
- [ ] `motion.gd`: the new gaits, peek, scare, punch, swing, eat, drink, the small acts, `head_follow`; `act.gd`;
      `moves.gd`; GDMOTION
- [ ] The markers: paces, eat and drink, Attack, the head, Jump scare; MARKERS, MARKERSEDITOR
- [ ] Sheets of pictures, the guides (the Animator's, the markers'), CLAUDE.md, CONTINUE, LESSONS; every check

## 8. As built

(filled in as it's built)

## 9. Not there

(filled in at the end)
