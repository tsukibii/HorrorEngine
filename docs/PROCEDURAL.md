# Procedural animation from generated variations (a future experiment)

The user's idea (2026-10-20), written up for Claude to run later on the local machine with Kimodo installed. The goal:
stop re-prompting Kimodo for motions that recur all the time (walking, talking, idling, searching, flinching), and
get motions that fit the scene by themselves (a hand that stays on the board being pulled off the wall).

## 1. The idea

1. **Generate a batch** of variations of one action (`motion.py` jobs with `num_samples` and seeds): 20 to 50 takes
   of "talks, gesturing a little", "walks slowly, searching", "pulls at something stuck at chest height".
2. **Analyse what stays and what moves** across the batch, per joint and over time:
   - the **core**: what every take shares (the walk's leg cycle, the pull's lean-back);
   - the **variation**: where the takes differ, how much, and how it's correlated (head and right hand together).
3. **Build a procedural motion** from that: the core as a base, the variation as a few controls (style sliders,
   random draws per playthrough), blended over time, with **IK on top** for contacts (hands on a board, feet on stairs,
   a hand on the player's collar) so the body conforms to the target instead of the target being hand-placed.

## 2. The analysis (what Claude computes)

All in Kimodo's 77-joint space (Content/Studio/soma77.json), on local rotations (6D or quaternion logs) plus the root's
velocity, so it doesn't depend on any one body's proportions.

- **Alignment first:** walks by gait phase (foot contacts are in Kimodo's NPZ), gestures by dynamic time warping, so
  "the same moment" lines up across takes. Without it, the variance just measures timing.
- **Per-joint variance over the aligned batch:** a heat map of the skeleton (stable hips and legs in a walk, restless
  hands and head in talking). This is the "which parts move most" table the user asked for.
- **PCA of the variation** (per body region: legs, trunk, each arm, head): a handful of components explain most of
  it. Each becomes a slider ("arm swing", "head bob", "hunch"), with its observed range.
- **The core:** the mean of the aligned takes (on rotations, done properly: quaternion averaging), checked for foot
  sliding with Kimodo's contacts.
- **Report:** a page in the desk (like the Bodies page): the heat map, the components as sliders, the mean, and any
  take far from the rest (a bad generation to drop).

## 3. The procedural layer (what it makes)

- **A motion family** file per action: the core, the components, their ranges, the gait phase or event times (contact
  on, contact off), saved beside the story's motions (`motions.<id>.family`).
- **At play time (desk first, then Unreal):** base + Σ component × weight, the weights from the clip (style), from a
  seed (each NPC slightly different), or slowly drifting (idles that never loop visibly). Transitions between
  families blend on the aligned phase.
- **Contacts are IK, not animation:** a family marks when a hand or foot should be on something; the scene says what
  (`reach`, a prop, the player). The desk's IK layer (two-bone arms, `reachTo`; the no-clip capsules) already does
  this for one hand; the experiment extends it to both hands and feet and to a moving target (the board coming free),
  with the rest of the body following through a small full-body solve (hips and spine lean toward the reach, as a
  person would) instead of only the arm.

## 4. The board example

"Tries to pull a board off the wall": generate 30 takes of "pulls hard at something stuck at chest height, both
hands" with the hands constrained near a chest-height point (Kimodo end-effector constraints). The analysis finds the
core (plant, lean back, jerk, recover) and the variations (how far the lean, how many jerks, head turned away or not).
In the scene the family plays with both hands IK-locked to the board's two grip points; the board's own animation
(stuck, then free) moves those points, and the body follows: no hand placement by hand, and a different pull each
time.

## 5. In Unreal (where it ends up)

- The families can feed **Motion Matching** (Unreal's Pose Search, in the engine since 5.4): the batch is the database,
  the analysis picks the channels to match on.
- Contacts: **Control Rig** with the full-body IK solver, or **Motion Warping** for reaching a target on time; MetaHuman
  bodies come with corrective joints driven by pose solvers in their post-process Anim Blueprint, so the squash at
  elbows, shoulders and knees comes for free there.
- Kimodo itself takes end-effector and full-body constraints at generation time (`motion.py constrain` already sends
  the blocking): generate around the contact, then let IK hold it exactly.

## 6. First steps when we start

1. `motion.py batch <action> <n>`: the batch, seeds recorded, with the same constraints.
2. `tools/motion_family.py analyse <action>`: alignment, the heat map, PCA, the report page.
3. Play a family in the desk with its sliders and the IK contacts; compare with single generations from the player's
   eye (the body check).
4. Only then, the Unreal side.
