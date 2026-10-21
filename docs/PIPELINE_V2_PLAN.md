# Pipeline v2: the build plan (branch `pipeline-v2`)

The tools the new workflow (docs/PIPELINE.md, DECISIONS 2026-10-20) needs, in build order. One phase per commit or
a few, each with its check, ticked here when the user approves it. **Here** = buildable in a cloud session (no
GPU, no editor); **local** = needs the user's machine (local Claude: Kimodo's demo, the RTX 3090, Unreal).

The first game, the 15 to 20 minute itch.io game, is the test bed: each phase is tried on it as soon as it lands.

## Status (2026-10-20): built on this branch, waiting for your look

Nothing below is ticked until you've tried it and said so. Built and checked here (CHECKS ok; the desk tested in a
headless browser; `Content/Games/Sample/story.json` uses every part):

| Phase | What to try |
|---|---|
| W1 format 3 | `python tools/check_all.py --game Sample`: the karma report per answer style, the animation budget |
| W2 MiniMax | `python tools/story.py --game Sample minimax`; the desk: any clip's MiniMax row and copy button; Takes → copy every prompt |
| W3 karma on the desk | Watch → Play from the start: the 30 s choices, the karma meter, the ending it picks |
| W4 takes | Takes → Load takes folder… (your MiniMax mp4s named by take id) → Auto-clean; ▶ scene plays them; or `intake.py` |
| W5 Kimodo shot list | the desk's Kimodo button: work a motion through the demo, save it by its path, Import |
| W7 script generator | `python tools/scriptgen.py setup`, then `--game <New> new outline.md` with Ollama running |
| W8, W9 look and idle | Sample's hall scene (her head follows you) and the locker scene (a tracker); the idle under every pose |
| W13 versioning | `Content/Studio/VERSION`, `CHANGELOG.md`; games record `built_with` |
| W10 to W12 | written as `docs/UNREAL_FLOW.md`; the editor side is the first run on your machine |

Not done: dragging trackers as gizmos in the 3D view (their keys are typed for now, on the scene's trackers field);
the runner's format 3 parts and the look's Control Rig (Unreal, local).

## Round 2 (2026-10-21): horror romance, deaths and the branch map, replies, gameplay

Built on this branch (DECISIONS 2026-10-21), waiting for your look:

| What | Try it |
|---|---|
| Deaths and the branch map | Sample in Watch: get found three times in hide and seek; YOU DIED → Return to round 1, or Branch map; the Branches tab |
| Replies and hanging lines | Sample's hall scene: "How was your day?" with Good. / Bad. (Japanese over English); wait it out to hear nothing |
| Gameplay cards | Sample's hide and seek rounds: the rule, a timer, did you hide or not |
| The writing | docs/WRITING.md; REFERENCES.md §5 (Roblox horror mechanics) and §6 (yandere) |
| Script generator | writes replies and gameplay cards with deaths (`--fake` shows the shape) |
| Reverb | room `acoustics`, the importer's AudioVolumes (untested in the editor) |
| Gameplay assets | Sample's hide and seek: the seeker's in-place loops and barks (the Kimodo page lists the loops, the MiniMax sheet the barks); caught in the study wardrobe plays that spot's death |
| Later | the music tool from woohill, per game and part procedural (not started, as asked) |

## W0. The workflow written down (here)

- [x] docs/PIPELINE.md v2, docs/KIMODO.md (the prompting rules, the shot list rules, the names), this plan, the
  decision.

## W1. The story format grows (here)

Format 3, with `story_check` and STORY_FORMAT.md in the same commit:
- [ ] **Lines:** clip `en_draft` (the English draft), `ja`, `ja_note` (the delivery, as a film director would give
  it), `en` and `zh` (subtitles translated from the Japanese), `expr` (the expression for MiniMax), `voice` (`says`
  `whispers` `says angrily` `screams`, more as needed). Cast `subject` (`she`/`he`) for the prompts.
- [ ] **`clip_max` 8** for new games (MiniMax's audio is good for 7 to 9 s). Estimated lengths come from the
  Japanese (morae per second), and a clip over 8 s is a warning to split at a pause or an expression.
- [ ] **Karma:** `game.karma` (the axes: one by default, `mercy` from cruel to kind, range and thresholds). Choice
  options carry `karma: {"mercy": 1}`; beats get a `karma` action (reactions count: helping, running, looking away).
- [ ] **Timed choices:** `choose` events default to 30 s; the timeout takes `default`, and silence can carry karma.
- [ ] **Endings by karma:** a flow choice `by: "karma"` (`{"min": 3, "to": "e_good"}`, `{"max": -3, "to": "e_bad"}`,
  the fallback neutral).
- [ ] **No dying:** a timed task's `fail`, a struggle's `caught`, an interrupt all lead to a scene or a task (a
  gentle guide back: the player is found, wakes, is pulled on), never to an ending, except in the final act
  (`final: true`). The check enforces it, and every karma ending is reachable.
- [ ] **The animation budget:** body `tier` (`simple` `activity` `action`, `hero: true` for the detailed few); the
  check reports the split against 80 / 15 / 5.
- [ ] **Motions as segments:** body `segments` `[{"name", "prompt", "secs", "style", "loop", "keys", "path"}]`, each
  2 to 10 s and one behaviour, the prompt starting "A person"; the check enforces the KIMODO.md §2 rules and names.

## W2. The MiniMax sheet (here)

- [ ] `story.py --game G minimax [--scene S] [--csv]`: per take, the take id, the Japanese, the subtitles, the
  delivery note, and the prompt ready to paste: `she makes a worried expression while she whispers <d> [Japanese]
  ……来てくれたんだ。 </d>`.
- [ ] The desk shows the same on each clip, with a copy button.

## W3. Choices, karma and endings on the desk (here)

- [ ] The desk plays choices with the 30 s timer, keeps karma (a debug meter), and picks the ending by karma.
- [ ] Missed tasks play their guide-back scene.
- [ ] `story_check` plays every karma route (the greedy player tries the kind, cruel and silent answer at each choice)
  and reports which ending each reaches.

## W4. The takes on the timeline, and the auto-clean (here)

- [ ] The desk's timeline loads each take's video by take id (from a folder you pick); the video preview can be off,
  audio only.
- [ ] **Auto-clean:** measures each take (its audio's length, dead air at either end by a silence threshold), writes
  `dur` and the take's `trim`, and fits the director's parts (subtitles, the body's segments, cues, the next clip) to
  it.
- [ ] By hand: drag a take's trim; drag the director's action (the body) against the take separately.
- [ ] `intake.py` does the same offline (ffmpeg), so the checks see the real lengths.

## W5. The Kimodo helper (here)

- [ ] `tools/director/kimodo.html`: every motion the game needs, scene by scene and clip by clip: the scene's rules,
  each segment's prompt, length (s and frames), save-as name (copy buttons), constraints (a top-down sketch of the
  root path through the stage marks, the key poses), tier, and whether the file has been made.
- [ ] `motion.py import`: finds the saved motions by name and puts them on their clips (`file` per segment); the desk
  chains them with bridges.

## W6. A blocking overlay in Kimodo's demo (local)

**For local Claude**, as a patch like `setup/kimodo_loop.patch`: the desk exports a segment's surroundings
(`Saved/Story/<G>/kimodo/<name>.overlay.json`: the room's walls and floor, the props as boxes, the other actors as
capsules, the player's eye as a cone, the stage marks), in the actor's own frame at the segment's start; the patched
demo (viser can draw boxes and meshes with opacity) loads it as see-through blocks, with an opacity slider, so the
motion is framed for the scene. Also: the root path and key poses from the shot list prefilled as constraints, where
the demo can take them (`tools/kimodo_constrain.py` already writes them for the CLI).

- [x] **Done by the user** (2026-10-20): a blocking loader into Kimodo's demo, and a Loop tool for looped walk cycles
  (passing NPCs and other non-cinematic motion). Nothing to build here.

## W7. The script generator (here, run local)

- [ ] `tools/scriptgen.py`: the outline → a **story bible** (premise, cast, tone, the karma axis, the rules: about
  2k tokens) → a **beat sheet** of scene cards (one each, about 300 tokens: who, where, what changes, the choice and
  its karma) → **one scene at a time**, the model drafting dialogue and action as JSON from the bible, the previous
  scene's summary and the card only (under 8k tokens in, so it never runs out of context) → validated by
  `story_check`, failures sent back to the model with the error.
- [ ] Claude's part is the review: one pass per act over the drafts, written as notes, and the glue between scenes.
- [ ] Reference structures in `docs/REFERENCES.md` (Resident Evil 7's pacing, *Five Hearts Under One Roof*'s
  branching, anthology episode shapes) that the bible and the cards draw on.
- **The model:** **Qwen3.6-27B** at Q4_K_M (about 17 GB, so a 32k context fits on the RTX 3090), through Ollama or
  llama.cpp; **Gemma 3 27B** (Q4_K_M or its QAT build) as the second to compare on Japanese prose. Both run at
  15 to 35 tokens a second on the 3090. The tool talks to Ollama's API, so the model is one setting.

## W8. The look-at layer and trackers (here, then Unreal)

- [ ] Clip `look`: `{"at": "player" | <a tracker> | <a placed thing>, "limit": [70, 20, 30] (yaw, up, down),
  "speed": 120, "eyes_lead": 0.3, "past": "hold" | "snap"}`, spread over spine, chest, neck and head (10/15/25/25/25%).
- [ ] **Trackers:** invisible boxes with a path and keys (`trackers` in a scene), so a head (or a hand) can follow
  something moving that isn't the player.
- [ ] The desk shows them as gizmos you can drag and key; the body check reports the look's clamping.
- [ ] Unreal: one Control Rig layer for the whole cast (local, with W10).

## W9. The procedural idle (here, then Unreal)

- [ ] When nothing is playing (between lines, while a scene holds, during the player's choice), the character keeps
  living: breathing, weight shifts, blinks, small head moves, on top of the looping idle, by cast member and mood.
  In the desk first, then the same parameters in Unreal.

## W10. The blocked game into Unreal (local)

- [ ] The importer builds the levels; the scenes play the desk's motions on stand-ins (retargeted); choices with the
  timer, karma and endings work; the whole game plays as blocks.
- [ ] The MetaHumans in their roles; the motions retargeted onto them (`retarget.py`).
- [ ] The face mocap from the take videos, on the scene tracks by take id.

## W11. The gameplay (local)

- [ ] The tasks made real; a crosshair as the interaction point (no hands in the first game).

## W12. Art and atmosphere (local)

- [ ] Rooms, props, materials, lights, atmosphere, camera shakes and effects, for the first game.

## W13. QA and versioning

- [ ] Playthroughs (the bot, yours); the itch.io build.
- [ ] `Content/Studio/VERSION` and `CHANGELOG.md`: the engine, the format and each mechanic, versioned; each game
  records the versions it was built with.

## Answered (DECISIONS 2026-10-20)

- Endings: good, neutral, bad ("evil" is the bad one). Easter eggs come from what's found, not karma, and blend back
  into the main story.
- The MiniMax prompt writes `[Japanese]` literally inside `<d>`; Claude gives only the expression and the voice, the
  user handles the rest of MiniMax's format.
- Voices: a list to try in docs/VOICES.md, with a log of what's been tested.
