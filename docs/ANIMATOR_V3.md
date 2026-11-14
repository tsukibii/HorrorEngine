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
- [x] `tools/animator/sticks.mjs`: a clip as rows of stick figures (side, front), to look at one without Godot
- [x] Clips: sneak and crouch; creep and its stance (`stealth.js`)
- [x] Clips: crawl, all fours, scuttle (`quad.js`)
- [x] Clips: peek out, held, back
- [x] Clips: the four scares
- [x] Clips: punch, swing, hit_react
- [x] Clips: eat, drink; look_around, knock, cower
- [x] `animate.js` kinds, `VERSION` 3, the page's kinds and labels; ANIMATOR holds each new clip to its rules;
      ANIMATORPAGE
- [x] `HSHeadTrack`; measured (the range, both behaviours past it, the switch, the speed)
- [x] `HSHandIK`: the arm's IK and the envelope; the fingers' wrap; measured
- [x] `HSGrip` and its gizmo; a held thing sits in the hand by it; a grip guessed
- [x] `motion.gd`: the new gaits, peek, scare, punch, swing, eat, drink, the small acts, `head_follow`; `act.gd`;
      `moves.gd`; GDMOTION
- [ ] The markers: paces, eat and drink, Attack, the head, Jump scare; MARKERS, MARKERSEDITOR
- [ ] Sheets of pictures, the guides (the Animator's, the markers'), CLAUDE.md, CONTINUE, LESSONS; every check

## 8. As built

### 8.1 The clips (29 new, 53 in all; a baked test body 10.2 MB from 2.0, where 24 clips made it 6.5)

Measured by ANIMATOR on the three test bodies (the skinny man, the normal woman, the chubby woman):

- **Sneak** 0.46, 0.42, 0.34 m/s, **creep** 0.59, 0.53, 0.40, **crawl** 0.42, 0.38, 0.27, the scuttle 1.2 to 1.4 m/s at
  a stride every half second. The sneak's pelvis is held 9 to 10 cm under where it stands and the creep's 16 to 17;
  the trunk leant 21 and 41 degrees; a planted foot, knee or hand stays within 12 mm of where it was put (15 for the
  scuttle).
- **The crawl**: knees 5.4 to 8 cm (on the floor, carried just over it), wrists from 2.8 cm, fingertips never more than
  4 mm under, the hips rising 3.3 cm over each knee, the back level within a few centimetres.
- **What it took in `pose.js`**: a hand's turn given outright (`handQ`: a hand laid flat on the floor however the arm
  above it leans, and a swinging fist turned as a hand holds a hammer) and `thumbFlat` (a rig's thumb rests below
  its palm; flat on a floor it has to come round into the palm's plane). Nothing else in the first 24 clips' code
  changed: gait.js and acts.js only export what they had.
- **The scuttle's legs are a person's**, not a lizard's: feet behind the hips, knees ahead and a little out, the
  pelvis tucked 38 degrees under a rounded back. The first try carried the knees out to the sides over feet set under
  them: the thighs' twist against the pelvis came out at 180 degrees and flipped every other frame.
- **A hand's path never passes close to its own shoulder**: the swing's first path brought the hand from behind the
  head straight down past the shoulder, the arm folded flat there and the elbow's side was anybody's guess (60
  degrees a frame). It goes over the top now, never nearer than half the arm's length.
- **A blow's or a scare's bones may turn up to 56 degrees in a frame** (everything else 34): a lunge's arms come from
  behind the ribs to straight out in a fifth of a second.
- **The swing lands with what's in the fist pointing up and ahead** (`meta.swing.axis`: 0.2, 0.8, 0.55 for the normal
  woman): the palm faces her own middle all the way, as a hand holds a hammer.

### 8.2 In Godot (GDMOTION3: `python tools/godot/motion_check.py v3`)

- **The head** (docs/GODOT_LOOK.md §5x has the table): at 40 degrees her head is turned 40.4, at 75 75.8; past 80 it
  lets go, or holds at 80.0; the chest takes 8 of a 40 degree turn; 242 degrees a second at the most; the eyes lead.
- **The grip** (§5y): a thing is held 0.0 mm from her hand's own grip frame, her fingertips 9 to 16 mm off a bottle's
  surface and 12 to 16 off a bat's; the bottle's rim at her lips tipped 52 degrees; an apple's bitten side at her lips
  at both bites, then gone.
- **Blows**: a punch lands 2.3 and 2.6 cm from someone 1.05 and 1.55 m up; she stands nearer for someone above or
  below her shoulder (`_reach_at`: her arm is no longer); 2.9 cm from someone who stepped 30 cm aside as it was
  thrown; a swung bat's end 4.5 cm from who it's swung at (the bat is turned to point at them, then carried); at you
  it stops 21 cm short of your eye; someone with a Motion node of their own reels (`take_hit`).
- **What a skeleton does with a modifier's work**: rolls it back after the frame. Outside the modifier a bone reads as
  its animation left it; a BoneAttachment3D follows the modified pose, so a held thing follows the corrected hand,
  and the checks read bones through attachments (made a frame before they're read).
- **A finger's wrap needed its angle unwrapped**: the tangent's direction is an `atan2`, the bend the difference from
  the bone before: past half a turn that difference reads as a bend the other way, clamped to none. The first run's
  fingers stood 3 to 5 cm off every handle.

## 9. Not there

(filled in at the end)
