# The director's desk: a review (2026-10-24)

A lead developer's pass over the desk (`tools/director/`): how easy it is to use, how a Kimodo motion gets from the
shot list onto a body, and how motions join and blend. What was found, what was fixed (four commits), what's still
open. How blending works now is ANIMATION.md §0c.

## 1. Adding a Kimodo motion, now

1. **In the desk:** a scene, then a clip card, then **Kimodo**: "+ segment".
   - Write the prompt ("A person …", one behaviour), its seconds (2 to 10), the path (marks, added from a list) and
     any keys.
   - ↻ names it by the shot list's rule. Save.
2. **"shot list ↗"** (the Kimodo page) has each segment's prompt, length, constraints and save name. Its metres are
   Kimodo's (the room scaled to Kimodo's 1.76 m body, as Load Stage scales it), so a path drawn to a mark lands on it.
3. **In the demo:** start it with `python tools/kimodo.py demo`. It now runs in the project folder, so the shot
   list's save paths land in the project. Make the motion, then do either of these:
   - **Send to Studio** with the segment's name, in any case. The motion goes straight onto its segment.
   - Save the NPZ to the save path, then **Import** on the shot list.

   Either way, an open desk picks it up without F5, and a take made again under the same name replaces the old one.
4. **Watch:** a clip plays as soon as any of its segments is made (one not made yet holds a pose for its seconds).
   **MOTION** (`python tools/motion.py --game G check`) fails on a motion made but not on its segment, or a link to
   a file that's gone, and counts what's left to make.

## 2. What was wrong, and what changed

**Kimodo into the desk** (da2674b, 87ca35e)

- **Re-importing didn't refresh:** a take imported again under its name never showed, because the desk cached motions
  by name until F5. It now compares the files' times; the Kimodo page's Import tells the desk.
- **Send to Studio didn't link:** Send (and `import <npz> <name>`) set the clip's `file`, never the segment's, so the
  shot list said "made" and nothing played. A shot-list name now links its segment and keeps the NPZ in the game's
  inbox. The bulk import also finds Send's files and relinks motions made earlier.
- **A save could drop the links:** a save conflict after an import, answered "overwrite", erased the links. The
  desk now carries the import's links into its own version first.
- **MOTION passed without checking:** it ended "MOTION ok" having checked nothing: it read only the old route's
  `jobs.json`, crashed without it, and a missing motion didn't count. It now checks the shot list.
- **Partly made clips played nothing:** a clip with one segment missing played only its blocking. It now plays
  what's made.
- **The motion box was free text:** typing a file name failed silently, and its hint ("Motion/…") was wrong. It's
  now a picker of the motions made, which says the motion's length or "not made yet".
- **Check and Generate ran unsaved versions:** they now stop when the save didn't happen. Reload also picks up poses
  saved since the desk opened.

**Blending** (da2674b, 87ca35e, 59fbeed)

- **Walks snapped back:** a generated walk snapped its actor back to their mark at the next clip. They now carry
  on, facing the new way.
- **Blends started from the wrong pose:** a blend into a clip started from the last clip's unplayed end (a pose
  never seen). It now starts from the pose at the cut.
- **Blends dragged the new motion:** a crossfade from a held pose held the incoming motion back. Blends are now
  inertial (as Unreal's Inertialization): the new motion plays at full speed and only the difference at the join
  fades. The timeline draws each blend as a light wedge.
- **Blocked walks fell short of their marks:** `fk` scaled the travel with the body, so Mari (1.62 m on the 1.70 m
  skeleton) stopped 5% short of every mark and slid 22 cm where a Kimodo walk met blocking. Travel is now in metres
  (LESSONS).
- **The stride switched off in one frame:** the blocking's stride ended abruptly, moving a foot 41 cm in a frame.
  It now eases in and out.
- **Blends distorted Kimodo bodies:** after a blend the previs bones were forced to the previs skeleton's lengths,
  up to 14 cm off Kimodo's proportions. They now keep the two poses' own lengths.
- **Layers** (new): a part of the body (upper, arms, one arm, head) from a made motion or a library pose, over the
  clip's own, for a window, faded, weighted. Examples: arms held over a walk, a gesture over an idle. The format,
  the check, the desk and the docs went in together.
- **Segments** have their own `blend`.

**Ease of use** (this commit)

- **New controls:**
  - **▶ Watch from here** on a scene or task.
  - **Undo and redo** (Ctrl+Z, Ctrl+Shift+Z or Ctrl+Y, 150 steps; outside text boxes).
  - **A shortcuts list** (the **?** button).
- **Clips:** they move down as well as up. Renaming a clip's id warns that its take won't match any more.
- **The look row:** it applies as it's changed (it waited for "set").
- **Choices:** they can branch on a counter (`by: count`, in the format since round 2 but not in the desk).
- **Placement:** new scenes and tasks go on the level of the node they follow.
- **Header links:** Kimodo and Shape open on the desk's game; the controls without labels have tooltips.
- **Generate:**
  - It shows the checks' errors, not only "STORY FAILED".
  - A server error is reported instead of hanging.
  - It gives up after 20 silent minutes, pointing at the editor's log.
- **Launcher:**
  - A running page's number opens it again (it used to stop the server), and `x<number>` stops one.
  - "New game" works when there are no games yet.

**Measured** on the Sample's hall scene (a synthetic Kimodo walk on its second clip), walked frame by frame:

- **Largest per-frame jump of any joint:** a 41 cm foot (the stride's snap) before; walking speed (6 cm) after.
- **The next clip's start:** where the cut left the pelvis (0.953 m to 0.953 m), where it slid back to 0.908 m
  before.
- **Layers:** the legs and the other arm stay put to 1e-16 m; bone lengths are exact at every weight; Kimodo's
  fingers stay on a posed hand.

## 3. Still open (recommended, in order)

1. **The shot list into the demo by name.** The biggest friction left: the prompt, the length, the path and the
   keys are still re-entered in the demo by hand. A "Load segment" in the demo's Send folder (the patch,
   `setup/kimodo_studio.patch`) reading the story would fill them in one click. It needs a machine with Kimodo to
   build and test.
2. **The reach target into Kimodo.** STORY_FORMAT says `reach` is passed on, but `kimodo_constrain.py` ignores it.
   Kimodo's end-effector constraint wants a whole solved pose (every joint's position and rotation), so it waits for
   Kimodo too. Until then the desk's IK layer does the reach.
3. **The `motions` table never plays.** Idles and the seeker's loops are made, but neither the Watch nor Play uses
   them:
   - Play's behaviours (wait, search, patrol) could play their `loops` motions instead of library poses.
   - The Watch could put a cast member's idle motion under the procedural idle while they hold still.
4. **A mark tool on the desk's stage.** Marks are made only in the scene builder; "drop a mark here" would save the
   trip.
5. ~~**JSON boxes.**~~ Done in the redesign after RPG Maker (docs/DESK_DESIGN.md): replies, beats, an event's `on`,
   the act choices' triggers, the Database's tables and a scene's look and trackers are forms; JSON is left only
   behind Advanced.
6. **One word per thing:** stitch or task, push or lean, in-between or bridge, "★ play this one".
7. **Takes from a folder are forgotten on refresh.** The folder handle isn't kept; the server already serves
   `Footage/`, which could be the default.
8. **Small things:**
   - `motion.py` makes bridge jobs that attach to nothing, and `run` always uses seed 1.
   - The shot list lists only the picked variant of a scene unless `pick_by` is set.
   - The old route's `jobs` ignores segments.
