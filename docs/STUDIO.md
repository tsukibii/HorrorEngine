# One project, many games

Every game lives in one Unreal project. Shaders, derived data, the runner, the horror systems and the tools are
built once, and each new game is a folder.

## Layout

Three kinds of thing, kept apart so each can change on its own: **Epic's template** (untouched), **the studio**
(shared by every game, modular), and **the games** (one folder each, standing alone).

### Epic's template: the playable test level, untouched

`/Game/FirstPerson/`, `Variant_Horror/`, `Variant_Shooter/`, `Characters/`, `Weapons/`, `LevelPrototyping/`, `Input/`
and `Source/HorrorEngine/` are the First Person template as the Project Browser made it. Its maps
(`Lvl_FirstPerson`, `Lvl_Horror`) stay the editor's start map and the default game, so there's always a level that
plays. **Nothing in them is edited:** what we want from them is duplicated into `Studio/` (or subclassed in C++),
so the template can be deleted in one go the day it's no longer needed. **It's never in git:** it's Epic's content
and the repo is public, so `.gitignore` leaves it out, and a fresh clone makes it again (SETUP S2: the Project
Browser, then `setup.py adopt`). Only the `.uproject`, `Config/` and the `*.Target.cs` files are ours to commit.

### The studio: `/Game/Studio/` and `Source/StoryRunner/`

| Path | What |
|---|---|
| `Source/StoryRunner/` | our C++ module (its own module, so the template's code stays as it was): the StoryRunner, the verbs, the events, the struggle, checkpoints (RUNNER_SPEC.md), their automation tests |
| `Studio/Core/` | the Blueprints on our C++ (`BP_StoryGameMode`, `BP_StoryPlayer`, `BP_StoryController`), the input (`IMC_Story`, `IA_*`) |
| `Studio/UI/` | the runner's widgets: `W_Reply`, `W_Timer`, `W_Crosshair`, `W_Subtitles`, `W_DeathCard`, `W_BranchMap`, the HUD |
| `Studio/Horror/<Module>/` | **one folder per module**, self-contained: its Blueprint, meshes, sounds and widgets, and a `README.md` (what it does, its settings, what the story calls it). The template audit's parts (`Door`, `Locker`, `Note`, `Inspect`, `Stalker`, ...) land here |
| `Studio/Horror/Play/` | one Blueprint per `play` type (`BP_Play_hide`, `BP_Play_run`, ...): a module each game starts with its stitch's numbers |
| `Studio/Greybox/`, `Materials/` | the importer's pieces and `M_StudioSurface` |
| `Studio/Library/Meshes/`, `Library/Textures/` | the CC0 library as imported (the source files are `Content/Studio/Library/`) |
| `Studio/Cast/` | what every cast shares: `SK_SOMA`, `IK_SOMA`, the retargeters to MetaHuman, the look Control Rig, idle |
| `Studio/Skin/`, `Grooms/` | shared skin sets and hair |
| `Studio/Audio/` | `Music/`, `Reverb/` (`RV_<preset>`), `SFX/` |
| `Studio/Dev/` | test maps (`L_Studio`, one `L_Test_<Module>` per module) |
| `Content/Studio/*.json`, `Content/Python/storykit/` | the class map, poses, skeletons, the studio's Python (text, not assets) |

**A module** is anything a second game could use: it lives in `Studio/Horror/<Module>/`, never reaches into a game's
folder, takes its settings from the story (through the class map), and has a test map. Its `README.md` says what
changed in which studio version.

### The games: `Content/Games/<Game>/` (`/Game/Games/<Game>/`)

| Path | What |
|---|---|
| `story.json` | the game: everything the desk shows |
| `Previs/` | the desk's exports for Unreal: glTF blocking per scene, the baked layout and shots (UNREAL_FLOW.md) |
| `Motion/` | generated motions (desk files) |
| `Maps/` | its levels (`L_<level>`, built by the importer: never hand-edited) |
| `Cast/<id>/` | the cast member's MetaHuman and their own clothes and hair |
| `Anim/`, `Faces/`, `Seq/` | retargeted body motions, solved faces, sequences |
| `Audio/VO/`, `Music/` | the takes' voices, the game's palette |
| `Art/` | hand-made art only this game uses (the user's) |
| `Manifest/DA_<Game>_Manifest` | soft references to every asset its story names (the importer writes it) |

Outside `Content/`: `Footage/<Game>/` (raw takes, git-ignored), `Saved/Story/<Game>/` (generated reviews, shot
sheets), `docs/games/<Game>.md` (its outline and decisions).

**A new game** is `python tools/story.py --game <Game> new` (or scriptgen) plus its folder: nothing in `Studio/`
changes unless the game needs a new module, and then the module comes first, with a test map.

**Rules:**
- A game never references another game's folder.
- Something two games want moves to `Studio/` (as a module if it does something).
- Epic's template is never edited.
- **The checks keep each game standing alone:** story_check rejects asset paths into another game's folder.
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

- One git repo with Git LFS for the binary assets. `main` always opens and plays; work goes on branches (`dev`, or
  one per step) and merges when its checks pass.
- **The studio's version** is `Content/Studio/VERSION` with `Content/Studio/CHANGELOG.md`; each game records the one it
  was built with (`game.built_with`).
- A tag per release (`<Game>-v1.0`), and the studio's own (`studio-v0.5.0`) when it bumps.
- After release, a game's folder changes only for patches, so a runner change that would alter a shipped game goes
  behind a per-game setting in story.json (`game.runner`), not a silent change.
