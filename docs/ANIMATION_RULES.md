# Modelling for the animations: the rules

**Read this before you model, place or size anything a character will use or walk past**: an interior (the scene
builder, a layout file, `/build-map`), a piece of furniture (the kit, the prop generator), a street (the street
builder), or a scene put together by hand in Godot. DECISIONS 2026-11-14, later, the user: *"add interior, furniture
and street rules for yourself so if I use claude to model in the future it can stick to rules that dont break the
animations."*

A character's animations are made from her own body by the Animator (docs/ANIMATOR_V2.md, docs/ANIMATOR_V3.md) and
played where a marker says. She doesn't see the room: she doesn't collide with furniture, doesn't step round a
table, doesn't know how deep a chair is. **The model has to be where her clips expect it.** When it isn't, she sits
in the air, puts a hand through a door, lies with her feet in a wall, or walks up onto a table.

Every number here is measured, not guessed: from the clips themselves on eleven bodies
(`node tools/animator/space.mjs`, kept in `Content/Studio/Animation/space.json`) and in Godot
(`python tools/godot/motion_check.py ranges`, kept in `ranges.json`). "A person" is the most any of the three adult
test bodies needs (a man of 1.80 m, a woman of 1.63 m, a heavy woman of 1.60 m). The tables in §11 are written
by `python tools/anim_rules.py tables`; `python tools/anim_rules.py check` (ANIMRULES, in check_all) holds the
studio's own furniture to §2 to §4.

## 0. The short list

| What | Make it | Works from, to | If not |
|---|---|---|---|
| A seat's height | 0.40 to 0.50 m | 0.33 to 0.57 m | she sits above it or in it |
| Behind a seat's front edge | 0.55 m with no back in it | | her back is in the backrest |
| In front of a seat's edge | 0.35 m of clear floor | | she stands, and gets up, in the table |
| A mattress's top | 0.40 to 0.55 m | 0.33 to 0.57 m | she sits above it or in it |
| A bed, from the side she gets in | 0.95 m deep, 1.95 m long | | her arm or her feet are in the wall |
| A door's handle | 0.95 to 1.05 m | 0.90 to 1.25 m | her hand closes beside it |
| A door she walks through | 0.80 by 2.00 m | 0.75 m wide at the least | her arms pass through the frame |
| In front of a door, her side | 0.45 m of clear, level floor | | she stands in something to open it |
| A thing she takes | within 0.30 m of the edge of what it's on | see §5 for its height | her hand stops short |
| Where she walks | 0.75 m wide, nothing under 1.0 m high over it | | she brushes through it, or walks on top of it |
| Where she does anything but walk | level floor | | her feet float or sink |

## 1. What she knows and what she doesn't

- **Metres.** One unit is a metre, everywhere: the kit, the prop generator, the street, Godot.
- **She finds the floor and nothing else.** Under her feet a ray looks for a collider on her *Floor mask* (layer 1
  unless you change it), from 0.9 m over where she stands to 1.3 m under it. That is her floor. **She doesn't
  collide with anything**: a path drawn through a table goes through the table.
- **So a path keeps off anything lower than a metre.** A bed, a sofa, a table or a crate under her path is the
  highest collider within reach of that ray, and she steps up onto it. Draw her way round furniture (the markers'
  bends; `m.go([a, b, c])`). A thing she has to crawl under (a table, a vent's roof under 1.0 m) goes on a collision
  layer that isn't in her Floor mask.
- **Her feet are placed on a flat floor.** Sitting down, lying down, opening a door, taking a thing, peeking, a
  scare, a blow: each plants her feet at the height she stands at. Where she does any of those the floor is level
  for 0.6 m round her. Walking follows the floor (§7).
- **She stands where her clip says, not where the marker is.** A marker says where the *thing* is (a seat's front
  edge, a handle); she stands a few centimetres to a third of a metre from it, by her own size (§9, §11). Leave
  that floor free.
- **A floor needs a collider.** No collider, no floor: she keeps the height she had.

## 2. Seats

A sit clip sits her on a seat of one height, 45 cm unless her bake says otherwise, and the game raises or lowers her
to the real one, 12 cm at the most.

- **Height: 0.33 to 0.57 m; model seats at 0.40 to 0.50.** The kit's sofas are 0.42, its chairs and bench 0.45, a
  school chair 0.44; the prop generator's chairs 0.43 to 0.46.
- **Depth: 0.55 m behind the front edge with no back in it.** Her back ends up 0.48 (a woman) to 0.54 m (a man)
  behind the edge. A sofa is deep enough. A dining chair is 0.42 deep: **put its marker in front of its edge by what
  is missing** (0.10 m), so her back meets the backrest and her knees stand out that much further.
- **Width: 0.70 m free at seat height** (0.35 either side of the marker). Her elbows come out as her hands go to
  her thighs. On a sofa, a marker is 0.35 m in from an arm and markers are 0.60 m apart.
- **In front: 0.35 m of clear, level floor**, as wide as she is. She stands 5 cm in front of the edge and no part of
  her gets further than 0.30 m in front of it, at any height: she doesn't need more.
- **A chair at a table.** One she *sits down on* stands pulled out: 0.35 m between its front edge and the table's
  edge. One she is *already sat on* when she's first seen (a marker that starts her sat) can stand at the table: her
  knees are 0.15 m past the seat's edge at 0.52 m up, so the table's underside is over 0.62 m.
- **Not seats** for an adult's sit clip: a floor cushion (zabuton, a zaisu), a futon, a low table, anything under
  0.33 m; a bar stool over 0.57 m. A character who sits on the floor is baked for it
  (`node tools/animator/bake.mjs her.glb --seat 0.08`: she sits with her knees up, not kneeling).
- **Short characters** (a child, a goblin, an imp) use the same seats: their clip gets them up onto a 45 cm seat and
  sits them with their legs hanging; they're lifted onto one up to 0.75 m (ANIMATOR_V3 §10).

## 3. Beds

She sits on the bed's long edge where the marker is, turns, and lies along that edge with her head to her left or
her right (the pillow's side).

- **Mattress top: 0.33 to 0.57 m** (the kit's beds: 0.50). The bedding lies flat: she lies on it, not under it. A
  pillow no thicker than 0.12 m: her head ends 0.14 to 0.17 m over the mattress.
- **From the edge she gets in: 0.95 m deep.** Her far side ends 0.80 (a woman) to 0.92 m (a man) in from the edge. A
  single bed (0.97) is just enough; on a cot under 0.9 her arm is in the wall.
- **Along the edge: 1.95 m.** From where she sits, 0.87 m toward the pillow and 1.01 m toward the foot. Her head
  comes down 0.61 to 0.68 m along from where she sat: with a pillow marker the starter's `sleep(bed, pillow)`
  slides her along the edge to suit; a Sleep marker goes 0.65 m (0.4 of her height) from the pillow's middle.
- **That edge is free**: 0.35 m of clear, level floor in front of it for 0.7 m either side of the marker; no rail,
  no footboard across it. The other long side can be against a wall.
- **Over the bed: room to sit up**, 1.0 m over the mattress where she sits, her whole height at the edge.
- **A futon on the floor** (0.10 m) isn't a bed for the bed clips. A character who sleeps on one is baked for it
  (`--bed 0.15`).

## 4. Doors

Her hand goes to the handle, the door's own `use()` opens it as her hand moves; in Godot the middle of her closed
hand is put on the handle itself.

- **Handle height: 0.90 to 1.25 m for a person; model it at 0.95 to 1.05.** A small child holds one from 0.65 to
  1.15 m, so **0.90 to 1.15 m suits both**. An imp of 0.90 m reaches 1.00 m and no more.
- **Which way it opens, by her hand.** With her right hand (the default) she **pushes a door hinged on her left**
  and **pulls a door hinged on her right**: pushing she stands in front of the leaf, pulling she stands at the latch
  side, clear of the leaf as it swings. A door the other way round is the left hand's (`m.open(handle, door, how,
  true)`; a Grab marker's *Left hand*). A **sliding** door slides to the side of the hand that takes it: to her right
  with her right hand, 0.52 m with her hand on it.
- **Where she stands**: 0.29 to 0.34 m in front of the handle and 0.14 m to its left. So **0.45 m of clear, level
  floor in front of the door on her side**, across the leaf. Pulling, she leans back: 0.20 m free behind her.
- **A door she walks through: 0.80 m by 2.00 m**, 0.75 m clear at the least. Walking, a person is 0.61 m wide with
  her arms and 1.81 m tall. A louvred closet door of 0.6 m isn't one she walks through.
- **A threshold or a step at a door: 0.20 m at the most**, and not where she stands to open it.

## 5. Things she takes

She walks to where her hand reaches it, takes it, straightens.

- **Where it lies: within 0.30 m of the edge of what it's on**, with 0.6 by 0.6 m of floor in front of that edge.
  She stands 0.35 to 0.46 m from the thing with it 0.10 to 0.14 m to her right. A thing in the middle of a table, or
  behind another, is out of reach.
- **How high**: she has three reaches (the floor, a table, a shelf) and her hand is carried the rest of the way by
  IK. What that covers is measured in §11's last table: **read it before putting something she must take at a
  height in between.** For a person today: anything from the floor to 0.3 m, a counter from 0.8 to 1.0 m, a shelf
  from 1.3 to 1.6 m.
- **Nothing she takes is over her own height.** A person's hand goes to 1.66 m (1.9 m for a man of 1.80).
- **How she holds it**: by its grip (an `HSGrip` node under the prop, the Animator's guide §13), or guessed from
  its size. A thing lying flat is taken with her fingers a little in what it lies on.

## 6. Room to move

- **A way she walks: 0.75 m wide, 0.90 where it can be**; a person walking is 0.61 m wide and takes 0.54 m strides.
  She turns on the spot at a pin: a corner needs no more.
- **Ceilings: 2.1 m where people walk.** Where someone swings what she holds, her hand goes to 1.93 m and the thing
  its own length past it: a bat of 0.8 m wants 2.8 m, and under a 2.4 m ceiling its end goes through.
- **Going low** (a person): sneaking 0.70 m wide and 1.66 high; a creature's creep 0.89 wide, 1.51 high; a crawl
  0.58 wide, 1.71 long and 0.71 high; a scuttle 0.90 wide, 1.36 long and 0.62 high. **A gap she crawls through:
  0.70 m wide and 0.80 m high**, and its roof off her Floor mask (§1).
- **A wall to peek round**: a wall's end that is a plain upright edge from the floor to over her head. She stands
  behind the wall with its face 0.22 m in front of her and its end 0.27 m to her right (the left hand's: to her
  left): 1.0 m of free floor behind the wall there, and 0.5 m free beyond the end for her head and her hand.
- **A scare**: 1.2 m of free floor in front of her (a lunge reaches 1.18 m) and 1.0 m across.
- **A blow**: a punch reaches 0.88 m, and she walks to where it lands. 1.0 m across.
- **A knock**: on something upright at 1.3 to 1.5 m up (0.8 of her height); she stands 0.3 to 0.4 m from it.

## 7. Stairs, steps, slopes

- **Walking follows the floor.** A marker's walk glides up and down whatever the floor does; her feet aren't planted
  on each step. It reads best with **risers of 0.20 m or less and treads of 0.25 m or more** (the kit's apartment
  and motel stairs; its house stairs go to 0.23 by 0.18, which is steep for her).
- **The starter's `walk_to`** takes a kerb or one step (0.20 m) in a frame. A flight of stairs is a marker's.
- **Slopes: 1 in 6 at the steepest** where she walks. Her feet aren't tilted to a slope.
- **Level floor wherever she does anything but walk** (§1).
- The player's own limits (a step of 0.5 m, a doorway's clearance) are the starter player's and LEVEL's, not these.

## 8. Streets

- **A pavement: 1.2 m clear** of poles, machines, bicycles and signs along where characters walk (0.75 m for her,
  and room to be passed). The street builder's kerb is 0.15 m: a step she takes.
- **A door on the street** is §4's: its handle 0.95 to 1.05 m, 0.45 m of level floor in front of it. A step up to an
  entrance is 0.20 m a riser at the most, with a level landing 0.6 m deep at the door.
- **A bench** is §2's: its seat 0.40 to 0.50 m (the street builder's: 0.47), 0.35 m clear in front, nothing behind
  the front edge for 0.55 m but its back.
- **Things she uses** (a vending machine's button, an intercom, a letter box): at a height her hand gets to (§5), on
  a face she can stand 0.4 m in front of on level ground. Something she knocks on or rings: 1.3 to 1.5 m up.
- **Steps and stair stacks**: risers 0.20 m or less (§7). A gate or a gap in a fence she walks through: 0.9 m.
- **Where characters stop** to sit, talk, open something or wait: level ground. A street that climbs is walked,
  not stood on to act.
- **A way round**: a lamp post, a pole, a parked bicycle has no say in where she walks. Keep her path off them.

## 9. Where each marker goes

| For | The marker (a `Marker3D`, or a pin in the NPC Markers tab) | Its blue arrow (+Z) |
|---|---|---|
| a seat | on the seat's front edge (or in front of it, §2), at the height she sits at | the way she faces sat |
| a bed | on the long edge she gets in from, at the mattress's top, 0.65 m from the pillow | away from the bed |
| a pillow | where her head should be | |
| a door | at the handle | into the door |
| a thing to take | the thing itself (its grip) | |
| a peek | at the wall's end, on the floor | along the wall, the way she looks out |
| a knock | the spot on the door | |
| a walk | on the floor (a pin rides the floor under the mouse) | the way she faces when she's there |

## 10. Short and tall characters

- **A child, a goblin, an imp** use a person's chairs, beds and doors (ANIMATOR_V3 §10); nothing is modelled smaller
  for them. Their clips say what they need in §11: less floor, a lower reach. **A handle at 0.90 to 1.15 m** if both
  a person and a small child open that door.
- **Furniture of their own size** (a nursery, a den) is a bake setting, `--furniture own`: the Animator's page says
  the heights to model (a 1.10 m child: a 29 cm seat and bed, a 66 cm handle, a 57 cm table).
- **A ghoul (1.90 m)** wants doors of 2.05 m and ways 0.9 m wide.
- **An ogre (2.60 m)** is 1.58 m wide walking and 2.6 m tall: a doorway of 1.7 by 2.8 m, ways of 1.8 m. It sits on
  a person's chair with its knees up and bends to a person's handle, and needs 1.05 m in front of a seat and 0.87 m
  in front of a door.

## 11. Measured

Centimetres. Written by `python tools/anim_rules.py tables`; don't edit between the markers.

**Standing and moving**: how wide she is with her arms, how far in front of and behind where she stands.

<!-- move:begin -->
| | standing: wide, in front, behind | walking: wide, stride in front and behind | running: wide | sneaking: wide, high | creeping: wide, in front, high | crawling: wide, long, high | scuttling: wide, long, high |
|---|---|---|---|---|---|---|---|
| **a person** (the most of the three adults) | 56, 20, 15 | 61, 53, 54 | 56 | 70, 166 | 89, 86, 151 | 58, 171, 71 | 90, 136, 62 |
| a man, 1.80 m | 54, 20, 13 | 55, 53, 54 | 53 | 70, 166 | 88, 86, 151 | 58, 171, 71 | 90, 136, 62 |
| a woman, 1.63 m | 54, 20, 14 | 54, 47, 46 | 48 | 60, 150 | 79, 73, 137 | 52, 155, 57 | 78, 120, 51 |
| a heavy woman, 1.60 m | 56, 20, 15 | 61, 44, 46 | 56 | 64, 150 | 89, 70, 139 | 51, 147, 58 | 78, 118, 52 |
| a boy of 12, 1.49 m | 43, 16, 11 | 45, 43, 45 | 41 | 55, 137 | 71, 68, 125 | 45, 139, 57 | 70, 111, 50 |
| a girl of 8, 1.27 m | 38, 15, 9 | 38, 35, 36 | 33 | 43, 117 | 60, 58, 107 | 38, 117, 50 | 59, 94, 44 |
| a small child, 1.10 m | 33, 13, 7 | 33, 30, 31 | 29 | 37, 102 | 52, 50, 93 | 33, 101, 44 | 51, 82, 38 |
| hag, 1.50 m | 50, 39, 11 | 49, 47, 46 | 49 | 64, 132 | 76, 85, 115 | 57, 151, 56 | 77, 111, 62 |
| goblin, 1.15 m | 36, 24, 8 | 40, 32, 30 | 36 | 47, 104 | 57, 68, 94 | 42, 108, 56 | 63, 94, 47 |
| imp, 0.90 m | 31, 15, 7 | 31, 27, 24 | 31 | 32, 83 | 43, 48, 75 | 30, 85, 40 | 45, 70, 34 |
| ghoul, 1.90 m | 63, 38, 10 | 64, 58, 57 | 62 | 84, 169 | 97, 115, 149 | 74, 186, 86 | 106, 144, 77 |
| ogre, 2.60 m | 141, 44, 31 | 158, 77, 79 | 155 | 162, 243 | 193, 169, 227 | 124, 249, 130 | 172, 202, 137 |
<!-- move:end -->

**A seat.**

<!-- seat:begin -->
| | the seat her clip is made for | she stands in front of its edge | her body in front of the edge | behind the edge | wide |
|---|---|---|---|---|---|
| **a person** (the most of the three adults) | 45 | 6 | 30 | 54 | 67 |
| a man, 1.80 m | 45 | 6 | 30 | 54 | 67 |
| a woman, 1.63 m | 45 | 5 | 25 | 48 | 55 |
| a heavy woman, 1.60 m | 45 | 5 | 28 | 48 | 59 |
| a boy of 12, 1.49 m | 45 | 5 | 24 | 44 | 48 |
| a girl of 8, 1.27 m | 45 (high for her: she gets up onto it) | 4 | 23 | 39 | 42 |
| a small child, 1.10 m | 45 (high for her: she gets up onto it) | 3 | 20 | 34 | 36 |
| hag, 1.50 m | 45 | 5 | 45 | 40 | 69 |
| goblin, 1.15 m | 45 (high for her: she gets up onto it) | 3 | 31 | 29 | 52 |
| imp, 0.90 m | 45 (high for her: she gets up onto it) | 3 | 21 | 24 | 35 |
| ghoul, 1.90 m | 45 | 6 | 54 | 44 | 94 |
| ogre, 2.60 m | 45 | 8 | 105 | 81 | 172 |
<!-- seat:end -->

**A bed.** "Her head": from where she sat along the edge, over the mattress, in from the edge.

<!-- bed:begin -->
| | the bed her clip is made for | in front of its edge | behind the edge | along it to her head's end | to her feet's end | her head: along, over the bed, in from the edge |
|---|---|---|---|---|---|---|
| **a person** (the most of the three adults) | 45 | 30 | 92 | 87 | 101 | |
| a man, 1.80 m | 45 | 30 | 92 | 87 | 101 | 68, 14, 55 |
| a woman, 1.63 m | 45 | 26 | 80 | 79 | 92 | 61, 16, 49 |
| a heavy woman, 1.60 m | 45 | 26 | 78 | 78 | 90 | 60, 17, 48 |
| a boy of 12, 1.49 m | 45 | 24 | 75 | 72 | 84 | 54, 12, 45 |
| a girl of 8, 1.27 m | 45 | 23 | 64 | 63 | 70 | 46, 10, 40 |
| a small child, 1.10 m | 45 | 19 | 56 | 55 | 60 | 40, 9, 34 |
| hag, 1.50 m | 45 | 45 | 83 | 64 | 92 | 46, 34, 51 |
| goblin, 1.15 m | 45 | 31 | 62 | 60 | 60 | 42, 18, 34 |
| imp, 0.90 m | 45 | 21 | 46 | 47 | 48 | 33, 12, 26 |
| ghoul, 1.90 m | 45 | 54 | 105 | 90 | 108 | 68, 34, 60 |
| ogre, 2.60 m | 45 | 97 | 153 | 127 | 145 | 104, 46, 77 |
<!-- bed:end -->

**A door.**

<!-- door:begin -->
| | the handle her clip is made for | from where she stands: to her right, ahead | pushed: her hand goes ahead | pulled: her body behind where she stands | slid: the handle goes to her right; her reach across | wide (push, pull) |
|---|---|---|---|---|---|---|
| a man, 1.80 m | 100 | 15, 29 | 47 | 16 | 52; 127 | 56, 67 |
| a woman, 1.63 m | 100 | 14, 34 | 49 | 17 | 52; 116 | 52, 64 |
| a heavy woman, 1.60 m | 100 | 14, 33 | 49 | 18 | 52; 114 | 56, 64 |
| a boy of 12, 1.49 m | 100 | 12, 44 | 56 | 14 | 52; 110 | 44, 60 |
| a girl of 8, 1.27 m | 100 | 10, 42 | 55 | 12 | 47; 96 | 37, 53 |
| a small child, 1.10 m | 100 | 9, 34 | 48 | 10 | 40; 85 | 32, 59 |
| hag, 1.50 m | 100 | 13, 43 | 68 | 14 | 52; 131 | 69, 74 |
| goblin, 1.15 m | 100 | 10, 42 | 68 | 12 | 50; 113 | 51, 80 |
| imp, 0.90 m | 86 | 8, 27 | 46 | 9 | 35; 82 | 35, 70 |
| ghoul, 1.90 m | 100 | 16, 43 | 67 | 13 | 52; 144 | 84, 91 |
| ogre, 2.60 m | 100 | 27, 87 | 112 | 41 | 52; 170 | 139, 146 |
<!-- door:end -->

**Her hands.**

<!-- hands:begin -->
| | a thing on the floor, on a table, on a shelf: its height; how far ahead of her | a peek: the wall's end to her right, the wall's face ahead; her width | a scare reaches | a punch reaches | a swing: her hand up to, wide | a knock: up, ahead |
|---|---|---|---|---|---|---|
| a man, 1.80 m | 10, 86, 190; 40, 46, 33 | 27, 22; 97 | 118 | 88 | 193, 96 | 148, 40 |
| a woman, 1.63 m | 10, 86, 166; 36, 42, 30 | 25, 20; 85 | 102 | 74 | 174, 89 | 133, 32 |
| a heavy woman, 1.60 m | 10, 86, 161; 35, 41, 29 | 25, 20; 84 | 99 | 71 | 172, 90 | 131, 30 |
| a boy of 12, 1.49 m | 10, 86, 153; 33, 38, 27 | 22, 18; 76 | 95 | 70 | 159, 78 | 121, 32 |
| a girl of 8, 1.27 m | 10, 86, 128; 27, 32, 23 | 18, 16; 65 | 80 | 60 | 132, 67 | 101, 27 |
| a small child, 1.10 m | 10, 86, 110; 24, 28, 20 | 16, 14; 57 | 70 | 52 | 115, 58 | 88, 23 |
| hag, 1.50 m | 10, 86, 158; 36, 42, 30 | 23, 42; 83 | 113 | 89 | 166, 94 | 126, 32 |
| goblin, 1.15 m | 10, 86, 118; 23, 27, 19 | 17, 26; 71 | 88 | 68 | 117, 69 | 92, 24 |
| imp, 0.90 m | 10, 75, 88; 18, 21, 15 | 13, 17; 55 | 63 | 48 | 91, 51 | 71, 20 |
| ghoul, 1.90 m | 10, 86, 207; 42, 49, 35 | 28, 41; 119 | 151 | 118 | 203, 118 | 159, 42 |
| ogre, 2.60 m | 10, 86, 308; 56, 65, 47 | 45, 50; 194 | 222 | 173 | 287, 181 | 228, 56 |
<!-- hands:end -->

**What heights her hand gets to, in Godot** (GDRANGE: a handle every 5 cm from 0.6 to 1.5 m; a thing on something
every 10 cm from the floor to 2.1 m).

<!-- ranges:begin -->
| | a door's handle: held within 1 cm | within 3 cm | a thing to pick up, what it stands on: her hand's grip on it within 2 cm | within 5 cm |
|---|---|---|---|---|
| a woman, 1.63 m | 0.90 to 1.25 m | 0.85 to 1.30 m | 0.00 to 0.30 m, 0.80 to 1.00 m, 1.30 to 1.60 m | 0.00 to 0.40 m, 0.80 to 1.00 m, 1.30 to 1.70 m |
| a small child, 1.10 m | 0.65 to 1.15 m | 0.65 to 1.20 m | 0.00 to 0.20 m, 0.60 to 1.10 m | 0.00 to 0.20 m, 0.50 to 1.10 m |
| imp, 0.90 m | 0.60 to 0.90 m | 0.60 to 1.00 m | 0.00 to 0.20 m, 0.40 to 0.90 m | 0.00 to 0.20 m, 0.40 to 0.90 m |
<!-- ranges:end -->

## 12. Not there: model round it

- **She doesn't step back from a door she pulls.** She stands at the latch side, clear of the leaf; a pulled door
  hinged on the wrong side swings through her.
- **She doesn't pull a chair out or push it in.** §2's chair at a table.
- **She doesn't get under the bedding**, kneel, sit cross-legged, or lean on anything.
- **She doesn't climb**: onto anything over her hips, or a ladder.
- **Her feet aren't corrected to the floor in Godot.** A seat or a bed off its made-for height by up to 12 cm leaves
  her feet that far over or under the floor as she sits.
- **A thing between two of her reaches** is taken with her hand a few centimetres off it (§11's last table).

## 13. How it's held

- `python tools/anim_rules.py check`: **ANIMRULES** (check_all runs it with `--quick`): this document's tables are the
  files' own; the files are what the clips measure today; every seat, bed and door the kit and the prop generator
  make is inside §2 to §4's ranges, or is listed in `Content/Studio/Animation/rules.json` with why not.
- `node tools/animator/space.mjs --check`: **SPACE**: `space.json` is what the clips measure (within 1.5 cm).
- `python tools/godot/motion_check.py ranges --reuse`: **GDRANGE**: the heights her hand gets to, measured again.
- `python tools/godot/motion_check.py small --reuse`: **GDSMALL**: short bodies on a person's chair, bed and door.

**When a clip changes** (the Animator's `acts.js`, `motion.gd`'s `open` or reach): `node tools/animator/space.mjs
--write`, `python tools/godot/motion_check.py ranges --reuse`, `python tools/anim_rules.py tables`, then bring the
numbers in §0 to §10 up to date by hand from §11. **When a new piece of furniture is made**: run ANIMRULES; a seat, a
bed or a door outside the ranges is changed, or listed in `rules.json` with the reason it isn't for the clips.
