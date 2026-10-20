# Lessons

What each bug that took more than one try taught us: the rule, then the story in a line. Add one before pushing
the fix.

## Carried over from the Godot project (Woohill)

- **Measure, don't guess:** a check that prints one `<NAME> ok` line beats any amount of reading code. Every
  system gets one, and `tools/check_all.py` runs them all.
- **Keep context small:** summaries and tails, not whole files and logs. Contact sheets, not frames.
- **Small steps, pushed:** the user changes course quickly, so every step should stand on its own.

## This project

- **Playwright's own Chromium can't decode H.264 or AAC:** the desk's take test read nothing from a MiniMax-style
  mp4 until it used a WebM copy. Test takes with WebM; your Chrome or Edge plays the real mp4s.
- **A running desk server keeps the old serve.py:** new routes 404 until it's restarted (find its PID in one
  command, kill it in the next, start it again).
- **A dev skip mustn't skip the thing being tested:** the desk's Esc skip jumped past timed choices, so the karma
  test saw none; it now jumps to the next event instead.
- **A room with no doorway in had its entrance shot from its middle, looking straight down:** the planner now stands
  at the level's start spot (or just inside the south wall), so a new game's template passes the shot check.
- **Blender joins bones when it reads an FBX, and a joined bone can't move:** the first round-trip check of a
  Kimodo FBX was off by the whole walk, because the hips' travel was dropped on Blender's re-import, not in the file.
  Disconnect the bones before measuring (Unreal has no such rule).
- **Kimodo's skin is bound in an A-pose; its motions rest in a T-pose:** the first SK_SOMA put the A-pose mesh on the
  T-pose skeleton (64 cm apart at the hands). Kimodo's own skinning with identity local rotations puts the mesh in
  the T-pose first (`retarget.py` TPOSE). Its `from_standard_tpose` is the other way (to the BONES-SEED rest).
- **A Blender FBX in metres can say UnitScaleFactor 100 even with "FBX All":** for Unreal's own kind (centimetre
  values, factor 1) keep the scene unit at 0.01 m, import the centimetre BVH at scale 1, and export with
  `FBX_SCALE_NONE`. Read the header to be sure (`fbx_unit_scale`).
- **Walls are centred on the room edge (0.1 m thick):** a prop against a wall sits d/2 + 0.05 m from the edge.
  The pilot's bookshelf was 2 cm into the study wall until level_check caught it.
- **The greedy playthrough walks from where the player is, not from the level's start:** the first version
  locked the player out after the front door slammed behind them.
- **A greedy check finds secrets every time:** sweep the paths twice, once missing every `secret` beat and once
  finding them all, or the endings that need a secret missed are never reached.
- **The player keeps playing at an act choice:** use the key, read the note. The first check stopped the player at
  the choice with the key in hand and the door still locked, so only "hide" was possible.
- **Never kill by a pattern that the same command line contains:** `pkill -f`/`pgrep -f` match your own shell
  when the pattern (or the command that started the server) is in it. It happened twice. Start a server in one
  command, note its PID (`ps aux | grep "[s]erve.py"` in a separate command), and `kill <pid>` in another.
- **Ids made per scene must say which scene:** two staged stand-ins both called `cast_mari` overwrote each other in
  the shot planner.
- **A thing made per clip needs the clip in its id:** two clips starting at the same mark gave their stand-ins the
  same id, and the moved one overwrote the other in the shot planner (the second time this lesson came up: ids
  derived from data must include every key that varies).
- **Measure shots where the actor is, not where they started:** blocking moves actors, so the planner follows each
  actor's `move` keys across clips and measures a moving clip halfway.
- **"Medium shot" names a body part, not a distance:** the framing check measures the part a shot is about (face,
  chest up, waist up) as a share of the frame. The pilot's "MS" at 3.2 m read as a wide shot until it was measured.
- **`--no-build-isolation` means every build backend is ours to install:** Kimodo's demo pulls NVIDIA's `viser` fork
  from git, which builds with hatchling; `setup.py kimodo --demo` failed until hatchling joined the build tools.
