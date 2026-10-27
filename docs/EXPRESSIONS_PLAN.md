# Expressions, text and look-at: the plan after the switch to English text (2026-10-27)

The user's direction (DECISIONS 2026-10-27, night): **English** is the games' language, kept so any line can be swapped
for a country's own; **no spoken dialogue**: lines are text, typed out with a short vocal blip (Undertale's way) instead
of a voice; the faces no longer come from talking takes but from **a library of captured expressions**, placed on the
timeline per character and blended, played as loops or reactions outside cutscenes, with **eyes and head that follow the
player** inside an angle.

This supersedes the face half of docs/PERFORMANCE_PLAN.md (which solved a face per voiced take, lips synced to it): the
capture stack it researched (§5: MediaPipe, calibration, zero-phase filtering, ARKit-52 → MHR-72) is what the library
uses; its look-at design (§3.1) and modes (§3) still stand. Takes as voiced MiniMax videos go; MiniMax stays as a way
to make **expression videos** (the user's test: a 3 s face glancing, squinting, pouting).

## 1. The expression library (step 1)

**The flow.** The desk's right side has two tabs, **Inspector** and **Expressions**. Expressions shows the library as
cards: **the character wearing it** at its strongest moment (hover plays it through on the character; the user's ask:
"the model with the motion applied, not the original video"), on the character the panel's **shown on** picks, the
name under it, a **names only** switch for a compact list. **Import** picks a
video; the desk sends it to the server, which solves it (a few seconds a clip); a preview opens: the video beside a
character playing the face in sync, the character chosen from the default MHR, the game's cast (each in their body), or
any exported Studio character; **Neutral** (from the first frame, the clip's quietest, or none) and **Strength**; a
name; **Accept** keeps it, **Discard** throws it away. A card's red **×** asks "are you sure" and removes it.

**What a capture is.** MediaPipe's Face Landmarker in video mode (Apache-2.0, local, the environment `face_mesh.py
setup` makes) reads the 52 ARKit scores every frame: brows, lids, gaze, cheeks, jaw, lips. **The head's movement is
ignored** (Kimodo moves the head). Each channel is smoothed without lag (a forward and back pass), blinks lightly. Kept
as the raw scores, so Neutral and Strength stay choices; played through `arkit_mhr.json` onto MHR's 72 face shapes.

**Where it lives.** `Content/Studio/Expressions/<id>/`: `expression.json` (name, fps, the curves, the neutral and
strength chosen, where it came from), and `clip.mp4` (the face cropped square, no sound: the preview shows
it beside the character). Like the face page's pictures (`Heads/`), the video is git-ignored: a face, often a real
one; the curves are what a game uses, and the cards are drawn from them. A removed expression goes to `Saved/Expressions/removed/` (undo by moving it back).

**Tools.** `tools/face_capture.py` (`solve VIDEO --out DIR`, `check`: FACECAP), the server's `/api/expressions`, the
desk's `expressions.js`, `tools/shared/face.js` (a capture sampled at a time, onto MHR's 72 shapes, onto a body).

**On which bodies.** The desk's MHR body carries the 72 shapes as morph targets (`shape_c_45..116`). A Studio export
carries, for each skin corner, the three MHR points it's made from (`_MHRP`, `_MHRW`; step 1b): the desk reads MHR's
72 shapes on the 5,681 points they move from `MHR_lod1.bin` and moves those corners itself, and turns the eyeballs on
their bones by the gaze as the Studio does (72 dense morph targets in the file would be ~118 MB; Unreal's morph targets
come with step 5). An export made before this has no face: export it again.
**Brows and lashes** ride the face too: a brow hair's points each follow their nearest face point; a lash card follows
the point nearest its root and **swings whole about its eyeball's middle** as that root moves (`_MHRR`, `_MHRE`), so a
blink takes the lashes down without stretching them (the user saw the upper lashes stretch when each lash point
followed its own nearest point). **Length**: the seconds the whole capture plays in (`length` in expression.json, the
user's ask: "put in how many seconds we want the whole original frames to take and use tweening"), set in the
preview beside the video playing at the same rate; between the captured frames a Catmull-Rom curve, so a slowed
capture glides. A placement on the timeline (step 2) stretches it again.

**The lids stay over the eyeballs** (the user saw the whites and irises come through the skin): the Studio grows an
eyeball to fill its opening and sets it back (about 17 mm, a cornea of 2 mm on it), showing it only through the
opening (a stencil); a file has only depth, so the export rests the lids on the eyes, but a blink or a squint slid a lid
down over the eye's front, which bulges further, and the eye came through. The desk measures each eye's shape once from
its own mesh (its distance from its middle by the angle from where it looks) and every frame keeps the skin round it
no deeper inside it than at rest: a lid that rests outside stays outside, the socket's hidden skin keeps its depth,
nothing moves at rest. It also lets a full blink close: the lids come down over the eye instead of passing behind it.
Measured on an export: 10,000 to 16,000 corners up to 3.3 mm inside an eye in a blink or a squint before, none after.

**Built (step 1, 2026-10-27):** `face_capture.py`, the server's `/api/expressions` (list, import, accept, discard,
set, remove; the clip with byte ranges), `shared/face.js`, `expressions.js`, the export's `_MHRP`/`_MHRW`; FACECAP
(check_all) and EXPRESSIONS (`tools/director/exprtest.mjs`).

## 2. Expressions on the timeline (step 2)

Under a scene's clips, **a face row per character** (the ones on stage; `+` adds a row for another). An expression is
dragged from the library onto a row and lands where it's dropped, **riding the nearest clip edge** as cues do (timing is
elastic: never a scene time). Each placed expression: its length (its own, stretched, or until the next one), **loop**,
**in/out blends** (an overlap between two crossfades them), a **weight**, and **speed**. The stage's scrub, the Watch and
Play show it; bake.js carries it to Unreal. The word, in STORY_FORMAT, the check and the desk's lint in one commit:

    "faces": [{"who": "mari", "expr": "pout_glance", "at": {"clip": "c2", "edge": "start", "offset": 0.4},
               "secs": 3, "loop": false, "in": 0.25, "out": 0.4, "w": 1, "speed": 1}]

on a scene (or a variant). Blinks the capture didn't have are added between (procedural, 2 to 6 s).

## 3. Text instead of voices (step 3)

- **English first.** A line's words are `en`; other languages are **string tables**, `Content/Games/<G>/Text/<lang>.json`
  (`{clip or line id: text}`), with `game.text` the language shown and `game.languages` the ones shipped. The desk
  shows a missing translation as a problem for that language only; `story.py text export|import --lang ja` round-trips a
  CSV for a translator. The Japanese written so far moves into `Text/ja.json`, nothing lost.
- **The typewriter.** Each line types out at a speed (`game.typing`: characters a second; a cast member's own), pausing
  on punctuation (a comma short, a full stop longer, an ellipsis longest). **A blip per few letters**: one vocal snippet
  (each cast member's `blip`: a sound off the shelf or one made in Web Audio, a pitch and a spread) played every
  `every` letters (spaces and punctuation skipped), so a sentence of n letters plays about ⌈n / every⌉ blips; a short
  word still gets one; a long sentence never more than the cap. A clip's length is its typing time plus a hold to read
  (by its length), so timing stays elastic.
- MiniMax voice prompts and the take intake stay for expression videos only.

## 4. Faces and looks outside cutscenes (step 4)

- **Loops and reactions** on a cast member: an idle expression looping while they idle or patrol, reactions on what
  happens (`sees` the player, `caught`, `hurt`, a door slam near them): `face: {idle: "bored", sees: "startled"}`.
- **Look-at with a range**: the scene's `look` (STORY_FORMAT §9.6: what a head follows, yaw and up/down limits, what
  happens past them) also on a cast member in play: watch the player while they're within e.g. 90° of her front (and a
  distance); past it, back to the path or what she was looking at. Eyes lead, the head follows, the chest last
  (PERFORMANCE_PLAN §3.1's numbers).

## 5. Into Unreal (step 5)

Expressions as AnimSequences of curves named as MHR's morph targets; the bodies with their 72 morph targets; the face
rows and look-at in preview.json and AStoryPreview; the typewriter as a UMG widget with the blip as a sound cue.

## Order

1 (with 1b) first: the library is the base of 2 and 4. Then the user picks: 2 (timeline), 3 (text), 4 (play), 5 (Unreal).
