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
- [x] The markers: paces, eat and drink, Attack, the head, Jump scare; MARKERS, MARKERSEDITOR
- [x] Sheets of pictures, the guides (the Animator's, the markers'), CLAUDE.md, CONTINUE, LESSONS; every check

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
  thrown; a swung bat's end 2.0 cm from who it's swung at (the swing itself brings it down level: §8.5; the hand
  IK turns it the last few degrees and carries it); at you
  it stops 21 cm short of your eye; someone with a Motion node of their own reels (`take_hit`).
- **What a skeleton does with a modifier's work**: rolls it back after the frame. Outside the modifier a bone reads as
  its animation left it; a BoneAttachment3D follows the modified pose, so a held thing follows the corrected hand,
  and the checks read bones through attachments (made a frame before they're read).
- **A finger's wrap needed its angle unwrapped**: the tangent's direction is an `atan2`, the bend the difference from
  the bone before: past half a turn that difference reads as a bend the other way, clamped to none. The first run's
  fingers stood 3 to 5 cm off every handle.

### 8.3 In the NPC Markers tab (MARKERS's stage `v3`, MARKERSEDITOR; docs/MARKERS.md §4)

Six new cards (Sneak, Crawl, Eat, Drink, Attack, Jump scare), two new kinds (`attack`, `scare`), four new paces and a
*Head* row on every marker. Measured on the test woman, headless:

- **Paces**: a Walk at a sneak goes at 0.42 m/s (her sneak was made at 0.42; her walk is 1.34) and at a crawl at
  0.38; she waits crouched after the sneak and on all fours after the crawl; a plain Walk stands her up; the tab's
  time for a 2 m sneak is 5.2 s.
- **Her head**: you 50.2 degrees to her left, her head turned 50.6; carried on to the next marker (50.7); given back
  to her animation by a later marker (-1.5); kept by a checkpoint and put back.
- **Eat**: the apple taken by its grip, its bitten side 0.0 cm from her lips at the nearest, then hidden and out of
  her hand.
- **Attack**: she comes for you from 2.7 m and both of two punches land (`struck` twice); her fist stops 20 cm from
  your eye; she stands 0.88 m from you to throw it.
- **Jump scare**: hidden until its quest starts; then at its pin, 0.0 degrees off you, already in `scare_lunge`;
  shown 0.98 s (the lunge's own *show*), then hidden; the scare heard once.
- **Problems**: a character with no sneak, eat, swing or scare_claw is told so at its marker; an Eat with nothing
  named and an empty hand by then; an Attack or a head pointed at someone who isn't there; a head asked to follow in
  a project without the Look plugin.

What it took in the runner: **a Wait keeps a low rest** (a Wait after a Sneak with no loop of its own stood her up:
the rest she's in is the body's `hold_clip`, and Wait used to set it to its own, empty); **the Jump scare card sets
*turned to you*** (the field's default is off, for a Wait; a scare facing its arrow and not you missed the point);
**in the tester an Attack is its clip and a note**, the head a note (nothing of the scene may be touched).

### 8.4 On creatures' bodies (ANIMATOR's section 6c; `tools/animator/bodies.mjs` `CREATURE_BODIES`)

The request is for creatures. The clips were written and measured on three people, and a clip is made from the body
it's for, so the last stage made five of the Studio's own creature cards in node, as the page makes them (their base,
their build from MHR's shapes, their sculpt at monster mode's reach, their height: `grownBody` takes a `shape` now):
a **goblin** (1.15 m, arms 40 cm on legs of 56), a **ghoul** (1.90 m, arms 67 cm, hunched), an **ogre** (2.60 m,
hands of 41 cm), an **imp** (0.90 m) and a **hag** (1.50 m, bent double). Every clip was made on each. It found six
things, the first of them in every clip since animation v2:

- **The elbow's hinge was read off the rest pose, and a creature's rest pose has no bend to read.** The hinge was the
  axis the forearm is bent about at rest: 35 degrees on MHR's own bodies. A hunch and longer arms leave it 15 degrees
  on the goblin, 10 on the ghoul, 13 and a little the wrong way on the hag, and the axis is then whatever the last
  millimetres make it. The hag's came out pointing backward, the ghoul's sideways. Everything downstream was
  consistent with it, so nothing looked broken from the numbers: the hand still got where it was sent. But the
  upper arm's skin was wrung 139 degrees round against the collarbone and the forearm's 143 back again, standing
  still, and in a peek, a punch or a swing the twist went past half a turn and the twist bones flipped over between
  two frames (160 degrees in one). The hinge is now **MHR's own, carried by the upper arm** (`rig.js` `ELBOW`: the
  mean of its two bases' axes, 1.9 degrees from either, which ANIMATOR holds it to). On the three people nothing
  moved that a check could see. On every creature the standing arm is as a person's: the upper arm 31 to 42 degrees
  round, the forearm 13 to 35.
- **A wall put by her height stood inside a hunched face.** The peek's wall was 20 cm ahead of her feet times her
  scale. A hag's face is 34 cm ahead of hers and a ghoul's 34: the wall cut through their heads, and their
  shoulders were past where the hand was sent, so the arm folded flat (the elbow 179 degrees) and pointed anywhere.
  The wall now stands clear of the body's own front as it stands (its face by the head's own size, its chest and
  belly by the slabs it's measured in): 20 cm on a person as before, 37 on the ghoul, 39 on the ogre.
- **Where a hand goes is by the arm and the hand that's on it.** The peek's hand is on the wall's end, a line up the
  wall: how high is free, and it's put where the arm isn't folded flat to get there (no nearer the shoulder than 0.42
  of the arm: a long arm's hand ends higher). On its way any hand can be kept clear of its own shoulder (`armTo`'s
  `near`, `clearOf`). A wrist beside a mouth, on a wall or over a head is placed by the hand's and the head's own
  size against a person's (`handScale`, `headScale`: an ogre's hand is 2.3 times a person's where its height says
  1.6; a goblin's head and ears 1.2 where its height says 0.6). And the peek's arm goes with the lean all the way
  through it: sent in a burst in the middle, the elbow swung 27 degrees in a frame on a person and 37 on a ghoul.
- **On all fours the wrist's height is the hand's own.** A wrist a person's 2.8 cm off the floor put an ogre's
  fingertips 5.3 cm under it. It's read off the pose now (`handDrop`: how far under its wrist a planted hand's
  lowest finger joint lies), and a carried hand is lifted by what its hanging fingers need. The arms' share of
  their length comes down for a body whose crawl would ask for all of it (a goblin's 0.993, an ogre's 0.997: now
  0.966 and 0.967, a person's 0.959 to 0.972 as before), found by running the crawl's own cycle (`kneeling`, kept
  for a body and its settings).
- **A thing on the floor was never reached, on people either.** The low reach's body was held to a squat of 0.52 of
  her scale and 82 degrees over, and from there the two women's hands stopped 5.5 and 7.7 cm short of where they
  were asked. No IK in the game makes an arm longer, so a pick-up from the floor could not have touched. It goes to
  0.62 and 92 now, and the hand gets there on all eight bodies (0.0 to 0.4 cm). The palm was asked to face the
  floor, which a forearm pointing at the floor can't do: the turn stayed as it hung until the elbow bent, then went
  60 degrees in a frame; it faces back toward her feet now. The wrist is held as high over the thing as keeps the
  fingers off the floor (an ogre's were 21 cm under it), and the other hand goes to its thigh (a ghoul's hung 6 cm
  through the floor from a squat that deep). A table is at an ogre's knees: the middle reach's knees give too.
- **A toe follows its heel.** On a knee-high imp's 0.47 s stride the toe joint turns 38 degrees in the frame its
  heel leaves the floor. That is what keeps the toes flat, and it's allowed a blow's limit.

| | height | walks | sneaks | creeps | crawls | scuttles | its front | its lunge reaches |
|---|---|---|---|---|---|---|---|---|
| goblin | 1.15 m | 1.11 m/s | 0.27 | 0.34 | 0.24 | 1.07 | 24 cm ahead of its feet | 79 cm |
| ghoul | 1.90 m | 1.43 | 0.49 | 0.63 | 0.45 | 1.43 | 37 cm | 137 cm |
| ogre | 2.60 m | 1.23 | 0.43 | 0.52 | 0.31 | 1.04 | 39 cm | 202 cm |
| imp | 0.90 m | 0.95 | 0.27 | 0.27 | 0.19 | 0.75 | | |
| hag | 1.50 m | 1.34 | 0.42 | 0.53 | 0.38 | 1.20 | | |

On each of the five: no bone turns faster than it may in the new clips, the walk, the run and the reaches; no arm is
asked for more than its length (0.994 at the most); no fingertip, foot, wrist or head under the floor (a fingertip
0.5 cm at the worst); a planted foot, knee or hand slips 1 mm at the most; the wall is 1 to 5 cm past its front, its
head out past the wall's end, its arm 0.48 of its length held and never under 0.41; its fist comes up under its
mouth by its own hand (14 cm from its lips on a goblin's 17 cm hand, 33 on an ogre's 41); a thing on the floor, a
table and a shelf is reached within 0.5 cm.

### 8.5 On the mesh (`python tools/godot/motion_check.py sheets3`)

Until this stage every clip had been looked at as a stick figure and measured. Pictured in Godot on the normal
woman's dressed character (a sheet a group in `docs/animator_sheets/2026-11-14_v3_*.jpg`; `motion_shots.gd` takes
`boxes` now, so a peek has its wall), five things showed that no number had:

- **The sneak** carried its forearms level at the chest with the hands hanging: a cartoon burglar on tiptoe. The
  hands are low now, in front of the hips, the elbows a little bent.
- **The creep's hands** hung limp from the wrists in loose fists, a sleepwalker's. They're hooked: the wrists bent
  back, the fingers half curled, the palms down. The same for the hands of the **lunge** (it lunged with its fists)
  and of the **loom**.
- **The peek's hand** was on the wall's end at her shoulder's height, which is where her face comes out: she stood
  with her cheek on her hand. It's below her leaning shoulder now (107 cm up on the woman, her head at 137), the
  elbow behind her. From in front, behind a wall, what comes out is her head, her shoulder and her forearm. (Her hand
  itself was still behind the wall, and her other hand in it: §8.6.)
- **Eating**, with nothing in the hand, the fist stopped at her collarbone: it was placed for a thing standing a
  hand's breadth out of the fist. The top of the fist is at her lips now; with a thing in it, the game's hand IK
  takes the hand back out by the thing's own length (0.0 cm from her lips, as before).
- The crawl, the scuttle, the punch, the hit, the knock, looking round, cowering and the reach to the floor read
  as what they are.

Then in the game (`python tools/godot/motion_check.py shots3`: her with the starter's Motion node, a water bottle
and a bat with grips, someone to hit; `gizmo`: the grip's gizmo in the editor), two more:

- **The swing was wrong, and its number was right.** GDMOTION3 measured "the bat's end 4.5 cm from who it's swung
  at" and passed. The picture showed her hand down at her hip with the bat pointing up at them, and a tenth of a
  second before that the bat held level at them from behind her head. The clip landed with what the fist holds 55
  degrees up, so a bat's end was half a metre over its target; the hand IK made up the difference, by turning the bat
  at them early and dragging the hand down. Asking the clip for a level bat outright made it worse: with the forearm
  level too, that is a hammer held along its own forearm, and the forearm's twist bones went half a turn in a frame.
  What a fist holds stands out of its thumb side, square to the forearm, and swings round toward where the forearm
  points only by the wrist's sideways bend. So the swing is built that way now (`pose.js` `dev`, the wrist tipped
  toward the little finger; `fight.js`): the hand comes down in front of her with the elbow out to her side, the
  forearm pointing ahead and down, and the wrist tips the rest: the bat is back and down behind her shoulder wound
  up, up as it comes over, and 21 to 28 degrees above level as it lands on a person (37 to 45 on a goblin, a ghoul or
  a hag, whose forearms are short for their upper arms or long for their bodies). No hand's turn is given outright,
  so no forearm is asked past its range (22 degrees of twist a frame at the most). In the game the bat's end is
  2.0 cm from who it's swung at, and the hand stays where the swing put it. The hand IK's turn toward its target
  comes in late now (the square of its weight): turned in step with the rise, it pointed the thing before the arm
  had brought it. An outright hand turn (`handQ`, still used for a hand flat on the floor) keeps the forearm's share
  inside what a forearm turns.
- **The player wasn't told.** A blow that landed said so (`struck`) and told a character with a Motion node, who
  reels; the starter's own player had nothing to hear it with. It has `struck(by, kind)` now: your view is knocked
  5 degrees aside and settles in a third of a second, whatever hears a scare hears it, and its `hit` signal says
  who and with what, for a game to count.
- Drinking: the Devices plugin's water bottle with a grip, taken from a table and brought to her lips, her fingers
  round it, its mouth 0.0 cm from them.

### 8.6 On the creatures' meshes, and in the editor (`sheets3 --who`, `gizmo`, `guide3`)

The same sheets on two creatures exported from the Character Studio and baked (`creature_ghoul`, 190 cm with hands
27 cm long; `creature_goblin`, 115 cm; `node tools/character/creatures.mjs make --only ghoul,goblin --export`, then
`node tools/animator/bake.mjs`; sheets in `docs/animator_sheets/2026-11-14_v3_creature_*.jpg`). The low gaits, the
scares and the fights read as what they are on both. One thing didn't:

- **The ghoul's fingers came out of the front of the wall it was peeking round.** Not the hand on the wall's end:
  the other one. It was put in front of her chest "flat on the wall", by the arm's own rules, which carry a hand on
  the way its forearm points; her forearm pointed at the wall, so her hand went into it. Measured on every body: the
  left hand's fingertips ended 11 cm past the wall's back on the three people (inside a wall that thick, out of a
  thinner one), 13 on a goblin, 15 on a hag, 21 on a ghoul, 29 on an ogre. The right hand never touched the wall's
  end at all: its fingers lay on behind the wall, the palm facing back at her. Every check passed, because none
  asked where a finger was.
- **Both hands are laid flat on the wall now**, their turn given outright as a hand planted on the floor's is
  (`pose.js` `handQ`, with a new `handK`: how much of it, so a hand turns flat as it gets there), each wrist as far
  off the wall as that hand's deepest finger joint (`quad.js` `handDrop`). The right is on the wall's end, under her
  face: palm to it, fingers up and forward along it, the elbow hanging under her shoulder behind it. Seen from in
  front that's a hand round the wall's end beside her face, which on a ghoul is the picture a peek is for. The left
  is flat on the wall's back, up beside her shoulder, fingers up, the elbow under it.
- **The left hand goes out to her side and up**, the forearm swinging up along the wall like a clock's hand. Brought
  straight up in front of her, a forearm and a hand (41 cm on a person) don't fit between her and a wall under
  20 cm away. It goes all the way through the lean, as the right does: started late and eased twice, the swing was over in
  seven frames of coming back and the upper arm turned 36 degrees in one of them.
- **The wall stands clear of her hands where they hang**, as it does of her face and her belly: an ogre's wrists
  hang 15 cm behind where its belly put the wall, and its hands are 41 cm long. Its wall is 11 cm past its belly
  now.
- **A frame's hand found in the wall has its wrist put back out** (`acting.js` `clear`: the left's off the wall's
  back, the right's off whichever of its back and its end is nearer): the last of it: 6 cm for an ogre's left hand half way
  through, under 1 cm for a person's right, 1.6 for a ghoul's.
- **ANIMATOR holds it**, on the three people and the five creatures, at every frame of the three clips: no joint of
  either hand further into the wall than a fingertip pressed on it (5 to 7 mm on people, 4 to 14 on creatures), the
  palms square to the wall held (0.97), a wrist bent 39 to 40 degrees at the most on people and 38 to 56 on
  creatures, nothing turning more than 17 degrees in a frame (it was 24).

**The grip's gizmo, pictured in Godot's editor** (`python tools/godot/motion_check.py gizmo`: `grip_editor_shots.gd`
installed as a plugin of its own, under xvfb). Its first pictures had a progress box across the middle ("Updating
Scene Groups", then "Loading editor"): a plugin's `_enter_tree` runs long before the editor has finished starting,
and the project's first scan being over doesn't mean it has. It waits now until nothing is scanning and no
`ProgressDialog` is showing for a few seconds, frames each prop with the view's own Focus Selection (F) and zooms by
the wheel to a distance, instead of guessing at an orbit.

**The guide's pictures** are put together from all of this by `python tools/godot/motion_check.py guide3`
(`guides/animator/img/v3_*.jpg`, `grip_*.jpg`).

## 9. Not there

- **How thick the wall is.** A peek knows where the wall's end and its back are, not its front. The fingers of the
  hand on its end lie along the end for a hand's length (7 cm past the wall's back on the test woman, 11 on a
  ghoul, 16 on an ogre), so on a wall thinner than that their tips stand out past its front. They don't hook round the front corner
  either: that would need the thickness.
- **Climbing.** A small body gets onto a seat or a bed up to its own hips' height (§10). Onto something over its
  head, or down from it, there is no clip; the game lifts it up to 30 cm and no further.
- **A handle out of reach.** An imp of 90 cm reaches 86 cm; at a person's handle a metre up its hand stops 7 cm
  short (GDSMALL says so). It doesn't jump for it.
- **A two-handed swing, a kick, a grab that holds you.** One punch, one swing, one reaction.
- **Beckoning, pointing, waving, a shrug.** The small acts are look around, knock, cower.
- **Her eyes without eye bones.** `HSHeadTrack` leads with the eyes when the model has `l_eye`/`r_eye` bones (a
  Studio export has); a stand-in's eyes don't move.
- **A floor under a brought hand.** `HSHandIK` carries a hand onto a grip; it doesn't know where the floor or a
  table's top is, so a thing lying flat is taken with the fingers a little into what it lies on.
- **Which clips to bake.** All 53 go into the file (10.3 MB on the test body where 24 made 6.5). A creature that
  never sits could leave those out; there's no switch.
- **The Director and desk games.** The head, the grip and the blows are the starter kit's (`motion.gd`, `act.gd`) and
  the markers'. The runtime add-on's cast plays the new loops only if a behaviour names them; it has no head
  following and no hand IK.

## 10. The furniture by her size: children, goblins, imps

DECISIONS 2026-11-14, short NPCs. The user, on this document's first report: *"you said there are issues with the
sitting/sleeping for imps and goblins etc. What about children npcs (really short npcs), can you figure out a way to
adjust the animations proportionally to height."*

### 10.1 What was wrong, measured

Every clip is made from the body it's for. Sitting, lying down, doors and the reach to a table were made for a
person's furniture as if the body were a person's: a seat and a bed 45 cm high, a handle a metre up, a table at
86 cm. On the 1.63 m test woman those are the back of her knee (0.947 of its height), three quarters of the way up
to her shoulder (0.751), and her leg's own length (0.994).

| On a person's furniture, the old clips | a girl of 8 (1.27 m) | the same at 1.10 m | goblin 1.15 m | imp 0.90 m | the woman |
|---|---|---|---|---|---|
| sat: an arm asked for, of its length | 1.23 | 1.35 | 1.08 | 1.35 | 1.11 |
| sat: a leg asked for, of its length | 0.83 | 0.91 | 0.92 | **1.16** | 0.72 |
| a door: the fastest a bone turns, degrees a frame (34 allowed) | **47** | **45** | **50** | **71** | 24 |
| lying down: the same | **41** | **36** | 34 | **50** | 32 |

A child's or an imp's legs can't sit on a seat over their knees with their feet on the floor; its arm was straight
long before its hand had followed a door 26 cm.

### 10.2 What a clip is made for: `acts.js` `furniture(body, set)`

`{ mode, seat, bed, handle, table }`, metres, in the bake's record (`furniture`) and each clip's own
(`seat.height`, `bed.height`, `door.handle`, `reach.at`).

- **`fit`** (the default, "A person's, where she can use it"): a person's wherever her body can use it. A seat and a
  bed no higher than her hips (1.05 of her leg), a handle no higher than her hand goes with her elbow still bent (0.6
  of her arm over her shoulder), a table no higher than a fifth of her arm over her shoulder. An adult's are a
  person's; so are a child's, a goblin's and an imp's seat and bed. An imp's handle comes out at 86 cm and its table
  at 75.
- **`own`** ("Her own size"): 0.947 of her knee's height, 0.751 of her shoulder's, 0.994 of her leg. The 1.10 m
  child: 29, 29, 66 and 57 cm. A nursery, a den.
- **`person`**: a person's whatever she is.
- `set.seat`, `set.bed`, `set.handle`, `set.table` say one outright (`bake.mjs --seat 0.3`).

A body bigger than a person keeps a person's and comes down to it: an ogre's shoulder is 1.2 m over a person's
handle and its arm 1.07 m long, so it bends until the handle is within nine tenths of its reach (`opening()`'s
`stoop`).

### 10.3 A seat that's high for her (`seated().high`, `sitFrame`)

Over 1.18 of her own seat (`FEET_ON`) her feet can't stay on the floor. She gets onto it as a child does:

1. **Her bottom to its front** (`Z.perch`): down to it, or up onto it when it's over her hips (an imp: up on its
   toes, then off the floor, a 1.5 cm hop over the edge). Her feet stay where they stood as long as her legs allow
   (`footUnder`: on her toes, the ball staying put; past that the foot leaves the floor, the leg toward where it
   stood). No leg is asked for more than its length.
2. **She slides back**, her hands on the seat beside her. Her feet come up over the whole of the slide and hang
   under where her knees end up.
3. **Sat**: her hip joints a thigh behind the edge, her thighs on the seat (sloping 5 degrees), her shins a little
   ahead of straight down and never back into what she sits on, her toes drooped, her hands on her thighs. Her legs
   swing a few degrees, one then the other, for a few seconds of every eight.

Getting off is the same road back. The Animator's page draws the chair.

### 10.4 Doors (`opening()`)

How far her hand follows the door and how far her body goes after it are by her arm (`ts`: 1 on an arm of 41 cm or
more, an adult's). A handle over her shoulder: up on her toes from a quarter of her arm over it (`heel`). The time her
hand takes to get there and back is by how far her arm has to swing (`q`: 38 degrees up from a woman's hanging arm,
88 for a child, 130 for an imp), and a hand that has to come up to her shoulder's height goes round her shoulder at
arm's length, not past it.

### 10.5 The bed clips, for everyone

Holding the clips on other bodies showed what the adults' own had wrong. All fixed in `sleeping()`:

- **No hand is asked further than the arm goes** (`armTo`'s `far`, `within()`): a hand left on the bed while the body
  went on past it was asked for 1.8 of the arm, and in the frame it came back within reach the elbow folded 32 to 50
  degrees. Let off gently from nine tenths of the arm's length, the elbow gives all the way.
- **Her legs leave from where they sit** (their knees turned out as they were: an ogre's jumped 27 cm inward in the
  frame it began to lie down), and **her arms from how they hang** as she sits.
- **Her feet go over the bed's edge**, lifted in front of it, not 2 to 5 cm through the mattress's corner.
- **Sat on the edge, her hands rest on the bed beside her**; they used to hang at her sides, a person's fingers 7 cm
  in the mattress. They prop her as she lies back, and leave the bed before she leans forward to get up (a weak or
  heavy body's go to its thighs from there).
- **Asleep, her arm lies on the bed**: the forearm level, the hand on its edge with its palm to her thigh.

These are the only adult clips that changed (the three test bodies' other 47 clips are the same to the bit), which is
why the bake's version went to 4.

### 10.6 In Godot

Nothing to do differently: the same `sit(seat)`, `sleep(bed, pillow)`, `open(handle, door)`, the same markers.

- **Lift** (`motion.gd` `_lift_for`, the Markers' `body.gd` `most_lift`): a clip that sits her with her feet on the
  floor is raised or lowered 12 cm at the most, as before; one made for a seat that's high for her (`high` in the
  clip's record) is raised up to 30 cm, since her legs hang anyway.
- **The handle** (`open()`): from `grab` to `release` the middle of her closed hand (`HSHandIK.grip_frame`) is
  carried onto the handle's marker, as far as her arm goes (`bring`, `"handle"`, `most` 0.35 m). The adult's hand is
  now on the handle too, not 7 cm from it.

### 10.7 The plan

- [x] `furniture()`: fit, own, person, a size outright; in the record and the clips
- [x] A high seat: onto it, sat with the legs hanging, off it; no leg over its length
- [x] A high bed: the same onto its edge, the legs up from where they hang
- [x] Doors by the arm; a handle over the shoulder; a body bigger than a person bends to it
- [x] The bed clips' arms, legs and feet, for everyone
- [x] Test bodies: three children (`bodies.mjs` `CHILD_BODIES`); every clip held on them and the five creatures
- [x] ANIMATOR §6d: the furniture rules, on eleven bodies
- [x] The page: Her furniture, the sizes, the furniture drawn; ANIMATORPAGE holds it on a child
- [x] Godot: the lift by the clip's kind, the hand onto the handle; GDSMALL; MARKERS' door
- [x] Pictures on a child and a goblin; the guide's section 15

### 10.8 As built

**In node** (ANIMATOR, 44 s; `node tools/animator/sticks.mjs --body child_small --kind sit` draws any of it):

| | girl 8, 1.27 m | 1.10 m | boy 12, 1.49 m | goblin | imp | ogre | hag |
|---|---|---|---|---|---|---|---|
| a 45 cm seat is | high | high | not | high | high | not | not |
| sat: feet off the floor, cm | 7.5 | 12.4 | on it | 12.8 | 19.0 | on it | on it |
| getting on and off: fastest turn, degrees a frame | 24 | 24 | 13 | 23 | 27 | 7 | 14 |
| lying down and getting up | 24 | 24 | 15 | 25 | 31 | 24 | 17 |
| a door | 28 | 28 | 27 | 30 | 29 | 19 | 33 |
| handle, cm | 100 | 100 | 100 | 100 | 86 | 100 | 100 |

The woman's own lie-down went from 32 degrees a frame to 16. On all eleven bodies (the ghoul and the three adults
too): no leg asked for more than its length, no foot under the floor, no ankle, knee, toe or wrist in the chair or
the bed, asleep no joint under the bed's top, at a door the wrist within 1 cm of where it's asked as she takes hold.

**In Godot** (GDSMALL: `python tools/godot/motion_check.py small`, bodies baked beside the normal woman):

| | the 1.10 m child | goblin | imp | the woman |
|---|---|---|---|---|
| a 45 cm chair: pelvis up, m; back from the edge, m | 0.49, 0.22 | 0.50, 0.22 | 0.48, 0.17 | 0.52, 0.31 |
| feet | hang 11 cm | hang 11 cm | hang 18 cm | on the floor |
| a 60 cm seat: lifted, cm | 15 | 15 | 15 | 12 |
| a 45 cm bed: head from the pillow, m; lowest joint over it, cm | 0.01, 1.0 | 0.02, 2.1 | 0.02, 1.2 | 0.04, 0.6 |
| a handle its clip is made for: hand from it, cm (carried, cm) | 0.1 (3.8) | 0.0 (7.1) | 0.0 (5.1), at 86 | 0.0 (10.8) |
| a handle 4 cm higher (the imp: a metre up) | 1.8 | 0.0 | 7.2 | 0.0 |

No leg in the chair or the bed on any of them. MARKERS' stage `sit` opens a door through a Grab marker with the pin
4 cm over what the clip is made for: her hand 0.0 cm from it, the door's own `use()` once.

**Pictures** (`python tools/godot/motion_check.py furniture --who NAME`, the furniture drawn as boxes from the
record): `docs/animator_sheets/2026-11-14_furniture_child_small_{seat,bed,door}.jpg` (a plain test body, `--plain`),
`..._creature_goblin_{seat,bed,door}.jpg` (the Studio's goblin, baked).

**What took a second try** is in docs/LESSONS.md (the Animator's furniture).

### 10.9 Not there

- **A child made in the Studio and dressed** pictured on the furniture: the pictures are a plain test body's and the
  goblin's. A Studio child bakes the same way; none was exported for this.
- **Her back against the chair's back.** She sits with her knees at the front edge; a deep chair's back is behind her.
- **Her hands flat on a high seat as she gets onto it.** They go to the seat beside her hips by the wrist; the
  fingers aren't laid on it.
- **A footrest, a step.** A seat over her hips' height is out of her reach: lifted, not climbed.
