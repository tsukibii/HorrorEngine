# The studio engine: what each version adds

Every game records the engine and format it was built with (`game.built_with`), so a later game knows what it can
use and an old game knows what changed under it. Bump the version when a mechanic, a runner verb, a format word or a
desk tool lands; the minor number for additions, the major for anything an old game must be changed to keep working.

## 0.5.0 (2026-10-21): gameplay assets

- A play's `seeker`, her `loops` by role (in-place looped Kimodo motions, `motions.in_place`) and her `barks` by
  moment (lines, heard not seen); deaths by hiding spot (`pick_by: "found_at"` variants that set their own view).
- The MiniMax sheet and the desk's takes list the lines; the Kimodo page and shot list show every per-spot variant
  and each loop's role; Watch plays the barks through a round, asks where you were caught and plays that death.

## 0.4.0 (2026-10-21): horror romance, deaths and the branch map, replies, gameplay

- **Format 3 additions:** endings of kind `death` with a `retry` (no dying is now opt-in, `game.no_death`); replies
  on clips (two options, her answer back as its own take, silence skips it); `wait_expr` for hanging lines; `play`
  stitches (hide, run, collect, sneak, hold, search, escape) whose results branch; counters, `count` and choices by
  count; room `acoustics`.
- **Desk:** replies in Watch (left and right, Japanese over English, she waits); gameplay cards; YOU DIED with return
  to the retry; the Branches tab (every node reached with its checkpoint, the missed ones as silhouettes); answers
  in the takes list.
- **Tools:** MiniMax prompts end hanging lines on the waiting face; answer takes in `story.py minimax` and
  `intake.py`; `scriptgen.py` writes horror romance with replies and gameplay cards with deaths; the importer gives
  each room a reverb (AudioVolume).
- **Docs:** WRITING.md (the craft), REFERENCES.md §5 and §6 (Roblox horror mechanics, yandere).

## 0.3.0 (2026-10-20): pipeline v2

- **Format 3:** the Japanese pass (ja_note, zh, expr, voice), 30 s timed choices with karma, a `karma` verb, endings
  by karma, no dying outside the final act, easter eggs that blend back, body tiers (80/15/5) and Kimodo segments,
  the look and trackers, take trims. Format 2 games still check and play.
- **Desk:** the MiniMax prompt per take; takes on the timeline with the auto-clean; timed choices, the karma meter
  and endings by karma in Watch; the Kimodo shot list page and the import back; segments chained; the look layer,
  trackers and the procedural idle.
- **Tools:** `story.py minimax`, `intake.py` auto-clean, `motion.py shotlist` and `import`, `scriptgen.py` (the local
  model drafts), `retarget.py` (Kimodo onto MetaHumans).

## 0.2.0: the MetaHuman route

- `metahuman.py`, `garment.py`, the Shape page's measures and skin; the Lines tool and soft bones in the desk.

## 0.1.0: the kit

- Format 2 (scenes, stitches, flow), the checks, the desk, Kimodo motion jobs, the importer and the runner spec.
