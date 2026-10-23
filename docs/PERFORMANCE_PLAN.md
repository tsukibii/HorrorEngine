# Performances in the desk: characters, motions, faces, every way a scene can play

A plan (2026-10-24, the experiments branch; nothing here is built yet). The goal, in the user's words: **the undressed,
unprocessed game is playable in the director's desk; Unreal is for cleaning up, decals, advanced lighting, effects and
UI.** So everything an actor does (body, face, voice, where they look, when the player can move) is set up and played in
the desk, and what crosses to Unreal is data Unreal only has to dress.

Research behind it: docs/research/mhr_pipeline/face_mocap.md (the face from video and audio; still right) and the
research of 2026-10-24 summarised in §8. What exists today is in §9.

---

## 1. The flow, as you'd use it

After the scene is laid out (rooms, props, the cast's marks):

1. **Cast.** In the game editor each cast role picks a **Character Studio character** (`cast.<id>.person`, a name from
   `Content/Studio/People/`). The desk loads that body as the Studio shows it (shape, sculpt, the face from photos, skin
   tone), its baked hair (`salon.glb`) and clothes (the tailor's OBJ export), so previs looks like the game. A role with no
   person keeps today's shaped MHR.
2. **Motions.** Each character gets a **motion set**: the clips the story asks for (idle, walk, sit, talk gestures, the
   scene's own Kimodo segments). The Kimodo shot list already knows what's missing (`kimodo.html`); attaching becomes a
   drop-down per segment instead of typing `body.file`, and a character's idle / walk / talk loops live in its set so
   gameplay (§3) uses them too.
3. **Mode.** Each scene (and any clip inside one) says how it plays: **cinematic**, **hybrid** or **gameplay** (§3). The
   default comes from the scene's camera: `hard` → cinematic, `free` → hybrid.
4. **Takes.** The takes are already on the timeline (one MiniMax video with its voice per clip, `Footage/<G>/<take>.mp4`).
   Under each clip a **performance lane** shows the take's frames and its waveform.
5. **Capture.** One button, **Capture faces**: every take on the timeline (or the one selected) is solved into face
   curves and put on **the character who speaks that clip** (the clip's `who` already says who; a lane can be pointed at
   someone else, e.g. a listener's reaction take). The face plays at once in the Watch and in Play; a meter per take says
   how good the track was (§5.4).
6. **Watch and Play.** Watch it as a film; play it as the game. What you see is what Unreal gets.

Ease of use comes from the timeline already knowing who speaks, which take is which, and where each clip sits: the user
never times a face by hand, never names a curve file, never picks a target unless it's an exception.

## 2. The data (small, named by take, elastic)

Everything rides on the take id, so nothing anchors to scene time (the rule in CLAUDE.md):

| What | Where | Notes |
|---|---|---|
| the take | `Footage/<G>/<take>.mp4`, `.wav` | as now (intake, auto-clean, trim) |
| its face | `Footage/<G>/<take>.face.json` | curves on the clip's own clock (0 = the take's start, before trim), 30 fps: the 72 MHR shapes by Meta's names (only those that move), head yaw/pitch/roll, eye yaw/pitch per eye, and a `track` block (the score, the calibration: baseline and gain per channel, the filter settings, the solver and its version) |
| a hand fix | `Footage/<G>/<take>.face_edit.json` | per-channel offsets, gains, mutes and keyed patches over the solve (§5.5); re-solving keeps them |
| who it plays on | the clip's `who`; `clip.face_on` to override | a reaction take on the listener, a face on a different actor |
| the character | `cast.<id>.person` | the Studio's character; the desk reads `body.bin`, `character.json`, `salon/salon.glb`, `<name>_clothes.obj` |
| motions | `cast.<id>.moves: {idle, walk, run, talk[], sit, …}` → `Motion/<file>` | the set gameplay draws from; scenes keep their own segments |
| the mode | `scene.mode` / `clip.mode`: `cinematic` \| `hybrid` \| `gameplay` | §3 |

STORY_FORMAT grows `person`, `moves`, `mode` and `face_on` in the same commit as the runner and the check (the rule:
never a word the format doesn't have).

## 3. Three modes: how animation acts in each

| | **Cinematic** | **Hybrid** (interactive cinematic) | **Gameplay** |
|---|---|---|---|
| player | can't move; looks within the cone (hard: not at all) | walks and looks freely | full control |
| camera | the shot (from the player's eye position, the shot's size) | the player's eye | the player's eye |
| body | the scene's Kimodo segments, exactly as blocked | the scene's segments, but **anchored to the actor**, not the room: if the player blocks her path she waits (Play's collision); a look-at layer turns head and chest towards the player within limits | the character's motion set driven by behaviours (`idle`, `path`, `patrol`, `sits`), blended |
| face | the take's curves, untouched; procedural blinks off (the take's own blinks win) | the take's curves; **eyes and head corrected towards the player** (the take was shot looking at the lens, the player isn't always where the lens was) | idle face (a slow additive drift, procedural blinks every 2 to 6 s, saccades, gaze on the player when near and in front) |
| voice | 2D, centred | 3D, from her mouth (walk away and it fades; a line in progress finishes; a `hold` keeps the next clip until you're back in range) | barks from her position |
| ends | when the last clip ends | when the last clip ends; the player kept their place | — |

Every one is a layer stack, the same in the desk and in Unreal:
**body:** motion → look-at (head/chest) → breathing;
**face:** take curves (or idle) → reaction (an additive take, e.g. a flinch) → procedural blinks (only when the take has
none) → eye correction to the target (the player, or what the shot needs).

Why hybrid matters for horror: she can talk while you search the room; the line keeps playing behind you; you turn and
she's closer than she was.

### 3.1 The look-at: a toggle (the user's ask, 2026-10-24)

A character's head follows the player within limits, then lets go and returns to the animation. One word, `look`, on a
clip, a scene or a cast member (the nearest wins): `look: player`, `look: <thing id>`, or `look: false`. New: it goes into
STORY_FORMAT, the runner and the check in one commit when it's built. Its settings, all optional:

| setting | default | what |
|---|---|---|
| `reach` | `[70, 30]` | how far she turns, degrees left/right and up/down from where the animation faces; past it she lets go |
| `leave` | `snap` | past the reach: `snap` (eyes flick back first, head back to the animation in ~0.25 s), `ease` (~0.8 s), `hold` (stays at the limit, watching from the corner of her eye) |
| `back` | `[10, 0.4]` | picks the player up again only inside the reach less 10°, after 0.4 s there: no flicker on the edge |
| `share` | eyes → head → chest | within ~15° only the eyes move; then head and neck; the chest takes the last ~20% |
| `lag` | `[0.1, 0.3, 0.5]` | eyes, head, chest: the eyes lead, the chest arrives last; a blink on a big turn |
| `weight` | `1` | blended over the motion (0.5: she glances, the animation still leads) |
| `stare` | `false` | horror: no blinks, no saccades while she's on you |

`reach: 180` lets the head go past what a neck can, and keep following you round.

Defaults per mode: cinematic off (the take already looks down the lens, which is the player); hybrid on; gameplay on when
she's near and you're in front of her. The same numbers drive the desk (bodies.js: after the Kimodo pose, a rotation
per joint, eyes through MHR's `eyesLook*` shapes and the eyeballs) and Unreal (§6: a Control Rig layer with an Aim per
joint, spine to head, weighted by `share`; its alpha and target set by StoryPreview / the runner, which owns reach,
snap and the hysteresis, so the two never disagree).

## 4. Every way a character might perform (and the word for each)

| Situation | How it's set up | Face | Status |
|---|---|---|---|
| **A cutscene** | a `scene`, mode cinematic | takes | Watch plays it; faces are new |
| **A scene you walk through** (talks while you search) | a `scene`, mode hybrid | takes, eyes on the player | new: Play freezes the player in every scene today |
| **Triggered sequence** (sit on the sofa → she talks) | a beat `{"when": {"use": "sofa"}, "do": [{"scene": "s_talk"}]}` | takes | exists; gains the mode |
| **Trigger cutscene** (Alien: Isolation style interrupt) | `interrupts` | takes | exists |
| **Talk to someone** (press E on her) | new interactable **`talk`** on a cast member: `talk: {first: "s_hi", again: "s_again", when: [{flag: "has_key", scene: "s_key"}]}`; each answer a short scene (one or a few takes) in hybrid mode by default | takes | new (planned in GAMEPLAY_PLAN, not built) |
| **A conversation with answers** | the talk scene's last clip has a `reply` (hanging line) or an `ask`; each answer is its own take (`<take>_<option>`) | takes | `reply`, `ask` exist; talk is new |
| **A question in play** | `ask` with `who` | the question's take if it has one, else idle with eyes on the player | exists (face new) |
| **Barks** (she mutters as you pass; spots you) | `lines` on the cast member with a `when` (near, sees, caught, idle); each bark a take | takes | barks show on the Watch card only today |
| **Ambient life** | the motion set's idle + the idle face | procedural | new |
| **Being chased / seen** | behaviours (`sees`, `path`) | idle face with a chase expression preset (fear, anger) layered | behaviours exist; the expression layer is new |
| **Held / grabbed** | camera `held` | takes or a preset (struggle) | camera mode exists |
| **Jump scare / death** | a short cinematic, often one clip with `seam` cut | a take or an expression preset (`face_preset` on a clip for faces without a take) | presets exist in the Studio |
| **Off-screen voice, phone, intercom** | `face: false` on the clip | none; the voice plays from a prop (`from: phone`) | `face: false` exists; `from` is new |
| **A face on a screen** (a TV, a video call, a camcorder replay) | a prop with `screen: <take>`: the raw MiniMax video as its texture | the video itself | new, cheap, very on-theme |
| **Notes, recordings** | `read`, a tape with a voice take | none | exists |

## 5. The face solve (from the research)

### 5.1 The stack

1. **Default: MediaPipe Face Landmarker in video mode** (Apache-2.0, local, no account; already installed for
   `face_mesh.py`) → per-take calibration → One Euro filter → ARKit-52 → MHR-72 through `arkit_mhr.json` →
   `<take>.face.json`, with head pose from its transform matrix. MiniMax drew the lips from the voice, so tracking the
   video gives lips already in sync. There's precedent for exactly this route (ComfyUI's SAM3DBody face node maps
   MediaPipe's 52 values onto MHR's 72, with a strength and a per-clip baseline).
2. **Reference and hero scenes: MetaHuman Animator's mono-video solve** (offline in UE 5.8; its face solve now runs on
   Linux). It exports MetaHuman control curves (`CTRL_expressions_browDownL`, `…jawOpen`, `…eyeBlinkL`): a small
   CTRL → MHR table makes them ours. Use it to score our solve and for the shots that matter most. Its output stays in
   the user's project (the MetaHuman rule).
3. **Mouth fallback, where the video fails** (a hand over the mouth, a profile turn, a bad AI frame): a vowel matcher
   for Japanese (あいうえお by MFCC, after uLipSync, MIT, ~200 lines in Python) or NVIDIA Audio2Face-3D (SDK MIT, models
   under NVIDIA's Open Model License, Linux with CUDA; Japanese untested: test first; skip Audio2Emotion, it needs a
   Hugging Face login). Switched in only where the track's confidence drops, crossfaded over ~80 ms.
4. **Later: fit MHR directly** to the landmarks (identity frozen from a neutral frame, the 72 weights solved per frame
   with a smoothness term): no ARKit hop, our own code; the Studio's face fit already does half of it. This is how
   MetaHuman Animator works (below), on our rig.

**Why MetaHuman Animator looks so good, and what we copy.** It doesn't score expressions from points; it fits a 3D
face of *that actor* to every frame and reads the rig's controls off the fit:
- **An identity per actor:** a neutral frame (and one showing the teeth) builds the actor's own face first, so the solve
  separates who they are from what they're doing. Ours: the speaker's photo fit, frozen per take.
- **Dense contours, not sparse points:** trackers trained for the lid lines, the inner and outer lips and the brows,
  plus depth (an iPhone's, stereo, or estimated from mono video). Ours: MediaPipe's 478 points, densest round the eyes and lips.
- **A solver that only knows real faces:** trained on 3Lateral's large 4D scan library, so it can only land on
  combinations a face makes; the rig's correctives (RigLogic) and wrinkle maps then add what makes it read as skin.
  Ours: limits and pairings on the 72 shapes (no blink with eyes wide), learned from our own good takes over time.
- **Offline, the whole take at once:** future frames are known, so it smooths without lag. Ours: the zero-phase filter (§5.2).
- **The teeth fix the jaw:** a stable upper-teeth anchor separates head motion from jaw motion.

The other half of the difference is the rig, not the capture: MetaHuman faces have far more joints, correctives and
wrinkle maps than 72 shapes. Our MHR faces will look stiffer for the same solve; animated normal maps for brows, eyes and
mouth (§6, Wrinkles) are the cheap way to close it.

**Not used:** the FLAME family (SMIRK, EMOCA, SPECTRE, Pixel3DMM, UniTalker): FLAME needs an account and is
non-commercial; NVIDIA Maxine (NGC account); Rokoko (account and cloud); LivePortrait (no FACS out).

### 5.2 Calibration and filtering, per take

- **Neutral:** each channel's 5th percentile (or the first still frames) is its zero; a per-channel gain to a tuned
  maximum (MediaPipe rarely reaches 1; pucker, funnel and cheek puff run weak). Stored in the take's `track` block.
- **Filter:** One Euro per channel (start mincutoff ~1 Hz, beta 0); lighter on jaw and lips; blinks nearly
  unfiltered so they stay snappy. Offline, a zero-phase pass (forward and back) removes the lag entirely.
- **Head:** rotation only, the take's mean subtracted, scaled 0.5 to 0.7 (MiniMax's camera moves too), split 40/60 over
  neck and head, added on top of the body.
- **Tongue:** MediaPipe has none; MHR has none either (the Studio's simple tongue rides the jaw, `teeth.js`). The visemes'
  ん/る/ら moments could lift its tip from the audio later; nothing until a shot needs it.

### 5.3 Where it runs

A worker beside the desk's server (`tools/face_take.py`, in the face tool's own environment, the way `face_mesh.py`
runs): `solve <take>` and `solve --game G` (every take without a face, or older than its video). The desk's Capture button
calls it and shows progress per take. Local, no network.

### 5.4 Knowing it's good (the check)

**FACE** (`python tools/face_take.py --game G check`): every clip with a take has a face (or `face: false`); curves in
range, no dead channels where the video moves, no flat lines longer than a take's pauses; the jaw follows the audio's
loudness (correlation above a floor); and a **round-trip score**: render the solved face on the character, run
MediaPipe on the render and compare with the take's own track. A meter per take in the desk shows that score.

### 5.5 Fixing a face without leaving the desk

The performance lane opens a curve view (a few grouped channels: brows, lids, gaze, jaw, smile, pucker, head):
offset, gain or mute a channel over the whole take, or brush a patch where it's wrong; **Exaggerate** (one slider:
gain round the neutral, for a horror read at game distance); expression presets from the Studio laid in as additive keys.
Saved as `face_edit.json`, kept when the take is re-solved.

## 6. Into Unreal

What crosses, so Unreal only dresses it:

- **Bodies:** each person's body as the desk shows it, **with the 72 face shapes as morph targets** (today's
  `Body_<who>.glb` bakes the identity in and drops the face shapes). **The mouth goes with them** (the Studio's
  `teeth.js`): the upper teeth on the head bone, the lower teeth and tongue on a jaw bone driven by the same per-shape
  rigid fits (a curve per jaw shape, or a Control Rig reading them), the mouth's inside a dark material behind the
  membrane; in Unreal the lips' depth hides what the stencil hides in the Studio.
- **Faces:** one AnimSequence per take, built in the editor from `<take>.face.json` (`unreal.AnimationLibrary`:
  curves named as the morph targets, so they drive them with no remapping), into `/Game/Games/<G>/Faces/`. Also written
  as Live Link Face CSV so Epic's importer and other tools can read them. Avoid 5.8's IK Retargeter "Copy All Source
  Curves" (it corrupts face curves): explicit pairs only.
- **The preview** (`AStoryPreview`) plays face curves and the voice with the bodies, so Unreal's first play matches the
  desk's Watch before any dressing.
- **The game:** the StoryRunner reads `mode` and the layer stack (§3) as an AnimBP: slot for the take's face, additive
  idle and reaction, procedural blinks and eye look-at to the player, the body's look-at. Hero shots can be re-solved
  with MetaHuman Animator in Unreal and swapped in by take id.
- **Wrinkles:** animated normal maps (brows, eyes, nasolabial folds, mouth corners) blended by the face shapes' own
  weights in the skin material, as MetaHumans do: the cheapest way to make 72 shapes read as skin.
- `storykit.media` (named in UNREAL_FLOW but never written) becomes that importer: voices as SoundWaves, faces as
  AnimSequences, screens as media textures.

## 7. Build order (each a step, a commit, a check)

1. **The desk loads a Studio character** (`cast.<id>.person`; a `/api/people` proxy or a shared route; body.bin,
   hair, clothes). The single biggest previs win.
2. **Face curves play on desk bodies**: the 72 morphs driven per frame (the Studio's `fromArkit` and expression code
   moved to a shared module), from a hand-made test curve.
3. **`face_take.py solve`** (MediaPipe video, calibration, filter, ARKit → MHR) and the FACE check; the Capture button and
   the lane.
4. **Modes**: `mode` in the format, Play's hybrid (scenes that don't freeze the player), the look-at toggle (§3.1).
5. **`talk`** on cast members, barks with `when`, the idle face.
6. **Unreal:** morph targets on the bodies, faces in preview.json, `storykit.media`, StoryPreview's morphs and audio.
7. The MHA comparison and the CTRL → MHR table; the mouth fallback if the tests say so; the curve editor.

## 8. The research of 2026-10-24, in short

- Offline face capture ranked by lips and brows on AI video: MetaHuman Animator mono > an MHR landmark fit ≈ calibrated
  MediaPipe > the FLAME tools (account, non-commercial) > Maxine (account). Sources: Google's Face Landmarker guide,
  Epic's MetaHuman 5.8 release notes and mono-video docs, the ComfyUI SAM3DBody face node, the tools' repositories.
- Audio: Audio2Face-3D is open (SDK MIT, models NVIDIA Open Model License, commercial use allowed), Linux with CUDA
  12.8-12.9, a 3090 is plenty; no published Japanese results. uLipSync's vowel matching (MIT) suits Japanese.
- Games: a performance layer per line, an additive idle, procedural blinks (closing faster than opening, a blink on a
  big gaze shift), designer look-at targets with saccades on top (The Last of Us Part II); The Witcher 3 generated most
  of its 35 hours of dialogue from timelines of shots, cast and look-ats timed by the voice, mocapping only 2.5 hours.
- Unreal: curves named as morph targets drive them; `AnimationLibrary.add_curve` / `add_float_curve_keys` build
  sequences from data; Live Link Face CSV has an Epic importer; the 5.8 retargeter's "Copy All Source Curves" corrupts
  face curves.

## 9. What exists today (so the plan starts from it)

- Takes: `Footage/<G>/<take id>.mp4|.wav`, matched by name (`app.js` loadTakes, allClips), auto-cleaned (length, dead
  air, trim), played picture-in-picture in the Watch. No field points at a file; no face data anywhere.
- Bodies: `BodyFigure` (bodies.js) sets MHR's 45 identity morphs from `cast.shape` and drives the skeleton from Kimodo's
  SOMA joints; the 72 face morphs (`shape_c_45..116`) are never driven. The desk can't read Character Studio people.
- Motions: per clip only (`body.file`, `segments[].file` in `Content/Games/<G>/Motion/`); the `motions` table (idles,
  loops) isn't played by the Watch or Play; Play's NPCs use pose-library poses with a walk overlay.
- Scenes: camera modes `free`, `soft`, `hard`, `held`; Play freezes the player in every scene (`hold()`), only the look
  stays. Triggered scenes, interrupts, `reply`, `choose`, `ask` exist; `talk` doesn't.
- Face: `arkit_mhr.json` (ARKit-52 → MHR-72, gains all 1 until fitted; 18 presets incl. the visemes あいうえおん);
  the Studio's expression sliders and `fromArkit` (a preview, not saved).
- Unreal: preview.json carries joints and skin matrices only; `AStoryPreview` has no morphs or audio; `storykit.media`
  doesn't exist.
