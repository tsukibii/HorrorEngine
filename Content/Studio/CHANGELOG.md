# The studio engine: what each version adds

Every game records the engine and format it was built with (`game.built_with`), so a later game knows what it can
use and an old game knows what changed under it. Bump the version when a mechanic, a runner verb, a format word or a
desk tool lands; the minor number for additions, the major for anything an old game must be changed to keep working.

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
