# Kimodo: prompting rules and the shot list

How to write motions for Kimodo (Kimodo-SOMA-RP-v1.2) so they come out right first time. The prompting style is
NVIDIA's guidance plus our tests, as the user gave it (2026-10-20). The shot list rules below it are how Claude
writes a game's motions with those limits in mind. ANIMATION.md §1 has the tools.

## 1. Prompting style

**Form**
- Start every prompt with "A person ..." ("A person walks forward slowly", "A person crouches and looks around").
  The subject may be styled: "An old person...", "A drunk person...", "A scared person...", "An injured person...".
- One behaviour, at most two, per prompt. Longer sequences: several prompts on the timeline, one after another.
- Medium detail: one plain sentence like a mocap caption. Not "A person walks." (too vague), not a per-body-part
  description (too much; the model can't follow it). Reference for the right granularity: the prompts in the
  BONES-SEED dataset (huggingface.co/datasets/bones-studio/seed).
- In a multi-prompt sequence, each prompt must stand alone: "A person walking while carrying a box comes to a stop",
  not "Then the person stops". The transition happens at the start of the next prompt and eats some of its time.

**What it knows** (the training data): locomotion, gestures, everyday activities, common object interactions,
videogame combat, dancing; styles tired, angry, happy, sad, scared, drunk, injured, stealthy, old, childlike.
Anything outside that (sports, unusual poses) comes out poor.

**Limits**
- Up to 10 s per prompt; 30 fps (5 s = frames 0 to 149).
- The whole prompt becomes ONE pooled text vector (LLM2Vec on Llama-3-8B), so the main action wins and fine limb
  details wash out. Measured: "lying on the ground with knees bent and feet in the air" gave lying flat in 24 of 24
  takes (4 phrasings and settings, text weight up to 4, up to 400 steps). Wording, text weight and steps can't add a
  pose the model doesn't know.
- Fewer than 20 constrained frames per constraint type (a dense 2D root path is the exception).
- Constraints must not contradict the text (the two fight and produce artifacts).

**When the text isn't enough, use constraints**
- A specific pose: a Full-Body keyframe (or End-Effectors for just the hands or feet), with the prompt kept simple
  and consistent ("A person lies on their back").
- Where the body goes: a 2D root path.
- Loops: our patched demo has a **Loop** checkbox; it repeats the first Full-Body keyframe at the last frame, along
  the root path. Play frames 0 to N-1; blend the last 0.3 s into the start if the direction turns.
- Turn post-processing on when foot contact and hitting the constraints matter.

**Variation**
- The same prompt with the same seed gives the same motion. Change the seed, or raise the samples slider, for
  different takes (CLI: `--seed N`, `--num_samples N`).
- Text Weight (classifier-free guidance, default 2.0) trades how closely it follows the text against how closely it
  follows the constraints; it didn't help with poses the model doesn't know.

**CLI:** (the user's notes stopped here; `tools/kimodo.py gen` and `tools/motion.py run` wrap it, ANIMATION.md §1.)

## 2. The shot list rules (how Claude writes a game's motions)

- **One motion, one behaviour, 2 to 10 seconds.** Never under 2 s: a stand-up is one motion, the walk after it is
  the next. Each prompt stands alone ("A person sitting on the floor stands up", "A person walks to the right").
- **Where to look isn't Kimodo's job.** Prompts never say where the head turns ("looks at the player"); the look-at
  layer does it (PIPELINE.md §7). "Looks around" as a behaviour is fine.
- **Poses it doesn't know get a keyframe**, from the blocking, with a plain prompt that agrees with it.
- **Travel gets a root path** from the stage marks; the prompt says the kind of walk, not the route.
- **Idles loop** (the Loop checkbox), one per character and mood, and the procedural idle (plan W9) keeps them alive.
- **Gameplay loops are in place:** the seeker's walk, search, patrol and run cycles (a play's `loops`) are made with
  Loop on and exported In place (no root travel: the game moves her along her route and blends the cycles), 3 to 4 s
  so the cycle doesn't show, starting and ending on the same foot.
- **Deaths per hiding spot** are scene variants (`pick_by: "found_at"`): each spot's catch is its own motion (she
  opens the locker; she was sitting outside the wardrobe and stands up; she lies down to look under the bed).
- **The budget per game:** 80% simple (stand, sit, turn, walk over, small gestures, idles), 15% activity, 5% action
  and horror, plus a few hero moments and the final ending's animation. `story_check` reports the split.
- **Hits and falls** (a slap, a kick, a shove) are in the training data as videogame combat: one motion for the
  blow, one for the reaction, each 2 s or more.
- **The face and voice carry the acting.** The body stays simple so the take's face can do the work.

## 3. Names

Each motion is saved under its shot list name, which the import (`motion.py import`) finds it by:

`<game>_<scene>_<clip>_<nn>_<verb>`, lower case, for example `pilot_message_c1_01_standup`,
`pilot_message_c1_02_walkright`. Idles and reusable motions: `<game>_<cast>_<motion id>`, for example
`pilot_mari_idle_kneel`. The helper page shows each name with a copy button.
