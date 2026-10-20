# One project, many games

Every game lives in one Unreal project. Shaders, derived data, the runner, the horror systems and the tools are
built once, and each new game is a folder.

## Layout

| Path | What | Belongs to |
|---|---|---|
| `Content/Studio/` (`/Game/Studio/`) | the runner's widgets and Blueprints, the greybox materials, the horror template's migrated parts (`Studio/Horror/`), shared sounds, idle animations, the class map | every game |
| `Content/Games/<Game>/story.json` | the game | that game |
| `/Game/Games/<Game>/Maps/` | its levels (`L_<level>`, built by the importer) | that game |
| `/Game/Games/<Game>/Art/`, `Audio/VO/`, `Anim/`, `Seq/`, `Faces/` | its art, takes, body and face animation, sequences | that game |
| `/Game/Games/<Game>/Manifest/DA_<Game>_Manifest` | a soft reference to every asset its story names (the importer writes it) | packaging |
| `Content/StoryData/<Game>/` | the story.json copy a packaged build reads (`package_game.py` writes it) | packaging |
| `Source/<Project>/` | C++: the StoryRunner and the struggle | every game |
| `Footage/<Game>/` | raw takes and face videos (git-ignored) | that game |
| `docs/games/<Game>.md` | the game's outline and decisions | that game |

**Rules:**
- A game never references another game's folder.
- Something two games want moves to `Studio/`.
- **The checks stop each game standing alone:** story_check rejects asset paths into another game's folder.
  (SETUP S8: add this rule when the importer writes manifests.)

## Packaging one game

`python tools/package_game.py --game <Game>`:
1. Cooks only that game's maps (`-map=`), what they reference, and its manifest folder.
2. Sets its start map and title for the build.
3. Copies its story.json to `StoryData/<Game>/` and stages it.

Assets only another game uses aren't referenced, so they aren't cooked. The project's ini is put back afterwards.

- **The `.exe` name is the project's:** name the project something neutral (for example `HorrorStudio`). Steam
  shows the store name, never the exe.
- **Saves:** the runner names slots `<Game>_<slot>`, so games never read each other's saves (they share the
  project's save folder).

## Why it pays

- The first game pays for the shader compile, the derived data cache, the runner and the horror parts; the second
  starts in minutes.
- Fixes to the runner, the tricks and the tools reach every game, including old ones (re-package them).
- **The risk** is one game's change breaking another. That's why `check_all.py` runs every game, and the bot plays
  each pilot path before a runner change is pushed.

## Versions

- One git repo with Git LFS for the binary assets.
- A tag per release (`<Game>-v1.0`).
- After release, a game's folder changes only for patches, so a runner change that would alter a shipped game goes
  behind a per-game setting in story.json (`game.runner`), not a silent change.
