# Animator v2: a character's own animations, made from its body

DECISIONS 2026-11-13, animation v2. The user: *"I'm not actually a fan of kimodo animations. Realistically I don't
need that many animations so I want you to create an extremely unique, original, animation system for my godot games
that has animations for walking, running, opening, reaching, sitting, sleeping, idle."*

What's built, why it's built this way, and what isn't there yet. The code is `tools/animator/`; the Godot side is the
starter kit's `motion.gd`, `act.gd` and `moves.gd`, the runtime's `play.gd` and the Director's Animate tab.

## 1. What it is

A character exported from the Character Studio (**Export for Godot**) is opened in the **Animator** (the dashboard's
Animator v2 tile, `python tools/animator/serve.py`, port 8788). Four sliders, a 3D preview, **Bake**. The bake writes
24 clips into the character's own `.glb`:

| clip | what |
|---|---|
| `idle_loop` | standing: breathing, the weight on one leg as the style has it (8 s) |
| `walk_loop`, `run_loop` | in place, one stride; each says how fast it travels |
| `sit_down`, `sit_loop`, `stand_up` | onto a seat 45 cm high, sat, up again |
| `lie_down`, `sleep_loop`, `get_up` | sits on a bed's edge, turns and lies back with her head to her left; asleep (10 s); up (`_r`: her head to her right) |
| `open_push`, `open_pull`, `open_slide` | a hand to a door's handle a metre up, and the door moved (`_l`: the left hand) |
| `reach_low`, `reach_mid`, `reach_high` | taking something from the floor, a table, a shelf (`_l`: the left hand) |

None of it is recorded motion, and none of it is one motion fitted to every body. Each clip is **made from the
character's own body**: its leg length sets the step, its weight the pace and how deep it sinks into each step, its
width how far the arms hang from it, its bust, belly, seat and thighs what moves when it lands. The sliders:

- **Walk style**, masculine to feminine: how wide the feet are set, how much the hips list and turn, how much the
  shoulders answer, how the arms are carried. It starts from the body (the recipe's base: a feminine character opens
  at 0.6, a masculine one at -0.6).
- **Strength**: how well the body carries its own weight. A strong one stands tall, lowers itself onto a seat and
  rises in one line; a weak one sags, lets go for the last of the way down, rocks, and pushes up off its thighs.
- **Weight**: the body's weight is measured; this moves it either way.
- **Softness**: how much the soft tissue moves.

The aim is the user's: *"You don't need to simulate for mathematical realism, just for aesthetic trickery, as in it
looks like they're real people, almost like we are watching dark anthology series (without the mocap)."* So nothing
is simulated that can be planned: a gait is geometry and timing; only the soft tissue runs on springs, and that is
baked.

**The body only.** Every track is a bone's. No clip touches a morph target, the eyes, the jaw, the tongue, or a
hair or ear chain: *"make sure to keep facial expressions as a separate entity ... so we can mix and match body
animations with expressions"*. The checks hold the bake to it (§11).

**Kimodo** stays for one-off motions (a dance, a scare's own move): the starter's `moves.gd` and `motion.gd` both
still play a Kimodo `.npz`. It is no longer how a character walks.

## 2. The file it reads

A Studio export (`Exports/characters/<name>/<name>.glb`, CHARACTER_STUDIO §3.1) is MHR's skeleton by MHR's names
under `body_world`, **unturned**: every bone's rest rotation is the identity, the character faces +Z, +Y up, her left
+X. One skin per part (the skin, each garment, the hair), all on the same 127 bones plus any spring chains. The skin
mesh is `<name>_skin`. `core/rig.js` reads it; anything else is refused in words (*"the Animator animates Character
Studio exports"*).

Two things in that file matter more than they look:

- **A limb's skin is on its twist bones**, the limb bone's children spread along it (`l_uparm_twist0..4_proc` and so
  on), never on the limb bone itself. A turn about a limb's own axis is shared out along them: the upper arm's twist
  is taken back toward the shoulder, the forearm's is fed in toward the wrist, the thigh's and the shin's the same.
  A shoulder or a wrist never wrings like a towel (`core/pose.js`).
- **The recipe is in the file** (`scenes[0].extras.studio`): `character.json` and `body.bin`, the character's own
  unclothed body as MHR's 18,439 points in the export's own space (checked: each skin corner is its three MHR points
  to the micrometre). The body is measured from that, so a hoodie doesn't make a character heavy.

`core/glb.js` reads and writes the .glb (accessors with strides, sparse parts, normalised integers), adds views and
accessors, and **packs** it again (`compact`): what nothing references is dropped.

## 3. The body, measured (`core/measure.js`)

From the recipe's body (or, for a file without one, from its skin and garment meshes), with MHR's rig file for each
point's bones:

- lengths: thigh, shank, ankle height, the leg (hip joint to floor), upper arm, forearm, hand, shoulder and hip
  half-widths, the foot (heel, ball and toes from the ankle);
- the trunk as **slabs** 1.5 cm thick from the crotch to the shoulders: half-width, front, back, middle; the levels
  found in them each where a body has it (hips, waist, bust, underbust, belly, seat: no level is found from another's,
  since a heavy body's narrowest place is not where a thin one's is);
- how far the bust stands in front of the ribs, the belly in front of them, the seat behind the waist; where each
  one's apex is;
- the limbs' thickness along their length, by side: inside, outside, front, back;
- **a weight**: the body as slabs and tubes, at a body's density. On the three test bodies it is within 2% of the
  exact volume of MHR's closed mesh (60.5, 55.8 and 72.6 kg against 61.1, 56.3 and 73.8). `build` is that as a
  number: -0.4 thin, 0 ordinary, 1 heavy.

The page shows them (height, weight, bust, waist, hips, thigh) so the user can see what the motion is made from.

## 4. A pose from controls (`core/pose.js`)

A pose is a **world turn for each bone, measured from the rest pose**, and where the pelvis is; a bone left alone
takes its parent's. The builder never deals in bone axes:

- the **legs** by two-bone IK from the hip to an ankle's place, the knee toward a pole;
- the **arms** by angles from the arm hanging (forward, out to the side, turned in, then the elbow), or by IK to a
  wrist's place;
- each bone's turn is the one that takes its rest direction and its hinge onto the posed ones (`Q.frame`), so the
  same controls give the same pose whatever the rest pose is (MHR's A-pose, with its elbows bent 35 degrees);
- the **spine** bends between the pelvis's turn and the chest's, the neck between the chest's and the head's;
- the **hand's turn** is an angle about the forearm (0: the palm faces the body's middle), read from where a palm is
  asked to face. Two lessons are in the code: a palm asked to face along the forearm says nothing about its turn,
  and blending two directions that face opposite ways whips the hand round in two frames (LESSONS 2026-11-13).

Every clip is a function from a frame to these controls; `core/clips.js` builds each frame and turns the poses into
tracks.

## 5. Walking and running (`core/gait.js`)

Planned on the ground first:

1. **Pace and step from the body.** A Froude number (0.20 for an ordinary walk, less for a heavy body, more for a
   strong one) gives the speed from the leg's length; the step is a share of the leg (0.79, shorter when heavy or
   feminine); the stride's length over the speed is its time, rounded to whole frames. A 1.63 m woman walks 1.29 m/s
   at 116 steps a minute; a 1.80 m man 1.39 m/s; the 73 kg woman 1.12 m/s.
2. **Each foot's own cycle.** It lands 0.44 of a step ahead of the pelvis, toes up; rolls flat over its heel; is
   carried back under the body at the ground's speed; its heel rises about the ball; **as the heel comes right up it
   rolls on over its toes** (the point it turns about moves from the ball to the toes' tips). That last roll is what
   makes a real stride's length reachable at all: without it no leg is long enough at toe-off (LESSONS). Then it
   swings through on a path joined to the ground's speed at both ends, lifted where the toes wouldn't clear.
3. **The pelvis rides the planted leg.** A walking knee has a shape (5 degrees at heel strike, about 15 as it takes
   the weight, 5 again mid-stance, 40 at toe-off): for the knee the planted leg should have, the hip can be only so
   high. The pelvis takes the landing leg's word from its heel strike on, blended in over the tenth of a stride
   before; the trailing leg just keeps its reach. The result is the rise and fall of a real walk (3 to 4 cm) without
   one being drawn. It is then followed **as a weight on a spring** (a heavy body's own frequency is lower): later,
   deeper, round at the bottom. And it is never above what a leg can reach: brought under a smooth curve of the legs'
   reach, softly, so there is no kink in it (a kink in the pelvis is a twitch in both knees).
4. **The rest answers.** The pelvis shifts over the planted foot, lists (the swing side drops) and turns (the swing
   side forward); the chest counters the turn; the arms swing against the legs, a little late; the head stays level.

The run is the same plan with a flight between steps, a foot that lands nearly flat under a bent knee, a forward
lean and the elbows at a right angle.

What the sliders change is in one place (`params`): feminine narrows the feet (5.5 cm between the ankles against a
masculine 11.5), lists and turns the hips more, quiets the shoulders, carries the forearms out behind; masculine
squares the stride and swings the shoulders. Heavy slows the pace, shortens the step, keeps the feet down longer,
bends the knee deeper as it takes the weight, leans back a little. Strength quickens it, lifts the chest, pushes off
harder.

## 5b. Standing, sitting, sleeping, a door, a reach (`core/acts.js`)

Each is the body moved through what the act needs, timed by the same numbers:

- **Sitting.** The pelvis goes back before it goes down; the trunk leans to keep the weight over the feet (34
  degrees, more when heavy or weak); the feet never move. A strong body sets itself down; a weak or heavy one is
  still dropping as it meets the seat (0.6 m/s against 0.1), lands, sinks and rocks. Sat, the hands rest on the
  thighs. Up: the trunk thrown forward over the feet first, then the legs.
- **Sleeping.** She sits on the bed's edge, turns to face its foot and lies back, her legs drawn up and swung on,
  the hand of the side she lies toward propping her; one hand ends on her belly. Asleep she breathes every five
  seconds. Getting up is the same road back, slower.
- **A door.** A hand to the handle (as far in front of her as a bent arm takes it), a turn of the wrist, then the
  push, the pull or the slide, her weight going with it. The clip says when: `grab`, `open`, `release`.
- **A reach.** The body leans, bends and squats **as far as the arm needs and no further** (a strong body squats, a
  weak one stoops with a hand on its knee); up on its toes for a shelf. `grab` when the hand closes, `put_away` when
  it lets go.

Every act starts and ends in the idle's first pose, feet included, so a player can cross from any one to any other
through it. The left hand's clips and the other side's are the same clips in a mirror: they start with the weight on
the other leg, a shift the player's blend makes.

## 6. Nothing through itself (`core/clear.js`)

*"they avoid clipping against their own body"*. The trunk is the slabs it was measured in (each a rounded box), the
thighs tubes; an arm is five balls from the elbow to the fingertips. Where a hanging, swinging arm would cut into the
trunk or a thigh, the arm is carried further out from the shoulder, as a broad or a heavy body carries its arms: found
a frame at a time, then made one smooth amount over the clip (its upper envelope, smoothed), so nothing twitches.
With the character's clothes measured too, a jacket's thickness is kept clear, up to 3 cm.

The elbow and the forearm are kept a finger's width clear; **the wrist and the hand may brush the body** (and its
clothes): arms hang with the hands at the thighs, not held off them.

On the test bodies: the skinny man's arms need nothing more in his walk, the normal woman's 7 degrees, the chubby
woman's 14 (her hips are 10 cm wider than her shoulders: her arms hang out past them, as such arms do); no ball ends
inside the body in any frame of idle, walk or run.

## 7. Soft tissue (`core/soft.js`)

*"baking in more generic physics for the fat ... some light squishyness (that affects clothing too)"*.

Up to nine **extra bones**: one in each breast, one in the belly, one in each buttock, one on the outside of each
hip, one inside each thigh. Bones, not morph targets: so the face's shapes stay their own layer, and so **whatever is
skinned where they are goes with them**, skin and clothes alike, by one rule: a point inside a soft bone's reach
gives it a share of itself (up to 0.8), taken from the bones it was on.

Each is sized from the measures. A flat chest gets none; a full bust a slow, deep bounce (its own frequency falls
from 3.5 to 2.2 Hz as it grows); the belly's amount follows how far it stands out and the body's weight. The skinny
man gets seven small ones, the chubby woman all nine with her belly and thighs at the top of the range.

Their motion: a spring driven by how that part of the body is thrown about (its own acceleration, frame to frame)
and by which way is down for it (lying on her back, a bust settles toward her head and flattens). A loop is run three
times and the last lap kept, so it closes. Sat on, the buttocks flatten; breathing moves the belly.

**The thighs squash instead of the walk going wide**: *"rather than making the characters walk really wide and
unrealistic we would add some squish between the thighs as they pass through"*. Where the two thighs' flesh would
overlap in a frame (by the measured inner radius of each, along both), each inner-thigh bone moves away from the
other by half the overlap. The chubby woman's thighs would overlap 19 mm in her walk; 4 mm is left; her feet stay
11 cm apart.

## 8. The bake (`core/bake.js`, `core/animate.js`, `bake.mjs`)

```bash
node tools/animator/bake.mjs Exports/characters/anna/anna.glb --style 0.6 --strength 0.5
```

In place (or `--out`). It adds the soft bones to every skin of the file, rewrites the weights of the skin and the
garments in their reach, turns the bones' matrices into translations (glTF allows no matrix on an animated node), and
writes each clip as a glTF animation: a rotation track for each bone that moves, a translation for the pelvis and the
soft bones. A track that holds one value all through (a finger's curl in a walk) is two keys.

**Its record** (`hsMotion`) goes in the scene's extras and, without the way back, on the skin's node, where Godot
keeps it as metadata (Godot drops a scene's and an animation's extras): the settings, the body's measures, each
clip's length, loop, speed and events, and where things are for the clips that touch the world: a seat's height and
edge, a bed's, a handle's place and travel, a reach's point, where a held thing sits in the palm. Beside a file baked
in place: `<name>.motion.json`, the same, so a character exported again from the Studio can be baked again with the
settings it had.

**Baking again.** A baked file can be baked again with other sliders: the record keeps the way back (the original
weights' accessors, the original bone count), the bake undoes itself first, and the file is packed, so it is no
bigger the second time. Unbaked, the skin's own weights are back to the last bit. Baked twice from the same file:
the same bytes.

A 54 MB character with clothes and hair becomes 64 MB (its soft weights, the old ones kept for the way back, and
about 4 MB of clips) in three seconds.

## 9. The page (`serve.py`, `page/`)

The server lists `Exports/characters` (and a scratch character's `Saved/Exports/characters`, and any `.glb` opened in
the page), and makes each character's **preview**: its file with the soft bones in and no clips. The page shows that
in three.js and **makes the clip on show itself, with the very modules the bake runs** (`/core/*`), each time a
slider moves: about 40 ms for a walk. What's seen is what's baked. Bake sends the sliders to the server, which runs
`bake.mjs` on the character's file and streams its log.

Under the view: the kinds of clip, each kind's clips as chips (sit and sleep also play as the whole of it), a scrub
bar. Beside it: the body as measured, and what the clip on show needed (how far the arms were carried out, how much
the thighs would have overlapped, how far each soft bone moved).

## 10. In Godot

A baked `.glb` dropped into a project plays in any `AnimationPlayer`. Read at run time (`GLTFDocument`) its loops are
`walk_loop`...; imported by the editor they are `walk`, `idle`... with their loop set (Godot's importer takes the
`_loop` off). Both are looked for everywhere below.

**By hand** (the starter kit, `res://starter/`):

- **`motion.gd`**, a node under her. `walk_to(marker)`, `run_to`, `go([a, b, c])`, `face`, `sit(seat)`, `stand()`,
  `sleep(bed, pillow)`, `wake()`, `open(handle, door, "push")`, `reach(thing)`, `pick_up(thing)`, `play("dance")`.
  It moves her at the speed her walk was made for (her feet keep step: 6 cm a second of slide on the test body),
  turns her as she goes, stands her where a clip's own numbers say (so her hand comes down on the handle: 7 cm from
  it on the test body), gets her up first when she's sat or asleep and asked for something else, and says `done(what)`.
  A thing picked up goes into her hand as it closes and is put away as she straightens.
- **`act.gd`**, the same from the Inspector and by a quest's words: who, what, the target; `needs` (the Story's
  words: it happens when they come to hold) or `fire()`; and when she's done: a task ticked, a flag, a line, the next
  act. A row of these is a routine: *"walk from here to here, pick this up ... synced to quests"*.
- **`moves.gd`** (the hunt's): a move given no clip now uses her model's own, with its speed. A baked character
  hunts, stalks and chases with her own walk and run with nothing set.
- **Custom clips** still import: `motion.gd`'s `more` (`{"dance": "res://animations/dance.res"}`), any animation her
  model has by name, or a Kimodo `.npz` on a Moves node beside it.

Where things are, for `sit`, `sleep` and `open`: a Marker3D. A seat's or a bed's on its front edge, at the height you
sit at, its blue arrow (+Z) the way she'll face sat. A handle's at the handle, its blue arrow into the door.

**The Director and the desk's exports** (`tools/godot/addons/horrorstudio/play.gd`): a role the cast gives no motion
plays her body's own clip for it (`body_move`: idle, walk, run, sitting, sit_down, stand_up), and her walk keeps step
with how fast a behaviour moves her. The Animate tab says which moves her model carries and leaves them empty when it
fills from the library.

## 11. Checks

- `node tools/animator/check.mjs`: **ANIMATOR** (in check_all; 10 s): three test bodies built from MHR in node
  (`bodies.mjs`, the same three as the Studio makes), measured, rigged, every clip made and held to numbers, baked,
  baked again, unbaked.
- `node tools/animator/pagetest.mjs`: **ANIMATORPAGE**: the page in a headless browser on a scratch folder: a
  character opened, each slider, every kind of clip, Bake and Bake again.
- `python tools/godot/motion_check.py`: **GDMOTION**: a baked character in a by-hand Godot project, headless: read
  both ways, walked, run, sat, slept, a door, things picked up, acts by the Story's words, a clip of your own,
  `moves.gd`. `shots` pictures any baked file's clip on the real mesh.
- `node tools/animator/people.mjs` makes the three test characters in the Studio (dressed, with hair) and exports
  them: what the pictures in `docs/animator_sheets/` are of.

## 12. What isn't there

- **A seat that isn't 45 cm high.** She is raised or lowered whole to meet it (up to 12 cm); her feet then float or
  sink by that much. Wants foot IK in Godot.
- **A handle or a thing that isn't where the clip expects.** She stands so the clip's own reach lands on it; a
  height in between two reach clips is off by up to the difference. Wants hand IK in Godot (Godot 4.7 has
  `TwoBoneIK3D`).
- **Walking is a straight line** between the points given, as the starter's other scripts walk: no navigation mesh,
  no steps up a stair, no turn-in-place clip (she turns as a whole while idle).
- **A thing in the hand** is put away; there is no carry pose.
- **Her face, her eyes' aim and her hair** are untouched by design: an expression, a blink and a look-at are their
  own layers.
- **Judged by eye only in stills.** The motion was tuned on contact sheets and numbers; the user's eye on it moving
  is the test that hasn't been run.
