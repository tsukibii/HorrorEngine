# Handoff: merging `scene-builder` into `main`

For the session on `main` (the Unreal flow) that merges this branch. Written 2026-10-21 by the cloud session that
built it. Everything here was built and checked **offline**, with no editor: the desk, the builder and the checks pass,
and the Unreal side is written to the API but has never run in Unreal. §3 lists what to prove the first time. Delete
this file once that's done, and move anything still true into UNREAL_FLOW.md.

## 1. The merge

`scene-builder` is 15 commits on top of `6411d30` (the commit `main` and this branch share). Since then `main` has one
commit (`42a377a`: MCP_TOOLS.md, SETUP S4, `Content/UnrealClaude/` ignored).

```bash
cd ~/HorrorStudio        # the project folder
git fetch origin scene-builder
git merge origin/scene-builder        # a merge commit: no rebase, no squash
```

- **One conflict, in `docs/LESSONS.md`:** both branches added bullets at the end. Keep both, `main`'s first (the
  "start the editor before Claude Code" lesson), then this branch's five.
- **`.gitignore` and `setup/gitignore.txt`** merge on their own. Both now ignore the kit's generated meshes
  (`Library/meshes/kit/`, `index/kit.json`), your own meshes (`Library/meshes/local/`, `index/local.json`) and
  the PBR shelf (`Content/Studio/PBR/*` except its README), as well as `main`'s `Content/UnrealClaude/`.
  Check `git status` shows none of those after the merge.
- No game's `story.json` changed on this branch, so the Sample game merges as it is.

## 2. After the merge, offline

1. Restart the desk's server. It loads storykit once, so it would keep planning with the old code. Find its PID with
   `ps aux | grep "[d]irector/serve.py"`, kill that PID in a separate command, then start `tools/director/serve.py` again.
2. The checks:
   - `python tools/check_all.py`: CHECKS ok. It now ends with a `(studio) pbr.py PBR ok` line.
   - `node tools/kit/check.mjs`: KIT ok.
   - `node tools/score/check.js`: SCORE ok.
   - Optional, with Playwright: `node tools/director/buildertest.js`, which ends BUILDER ok.
3. To try the PBR shelf before your own sets are on it: `uv run --with numpy --with pillow tools/pbr.py demo` puts
   five made-up sets there. Then open http://127.0.0.1:8780/pbr.html.

## 3. What's new, and what the first Unreal run has to prove

**The scene builder** (`tools/director/builder.html`, docs/SCENE_BUILDER.md):
- It draws levels as floor plans and lets you walk them from the player's eye.
- It writes `levels` into story.json. The desk's *Edit environment* opens a node's level in it, and a save reloads
  the desk.
- New story-format words (docs/STORY_FORMAT.md):
  - rooms: `kind`, `name`, `dir`;
  - a room skips a stretch of wall (`skip`);
  - walls are shared across heights;
  - sliding doors (`swing: "slide"`);
  - trim (skirting, cornice, door casings, `threshold`);
  - `look` (floor, walls, ceiling, trim);
  - kit props (`kit`), and doors with a `kit` and a `class`.

**The kit** (docs/KIT.md) makes room things from numbers as real meshes: floors with seeded gaps, cabinets, wall
fittings, window frames, curtains, sofas, cushions, doors with handles and butt hinges, and hinge mortises.
- `importer.build(G)` runs `build_kit` first. That writes `Saved/kit/<G>.json` and runs
  `node tools/kit/build.mjs`, which writes the missing glbs into `Library/meshes/kit/`.
- **Prove:**
  - The editor's Python can find `node`. Without it the log says so, and kit props stay grey blocks. If Unreal is
    started from a launcher without your shell's PATH, it may not see `node`.
  - The kit meshes import, and they **face the right way**. Place a cabinet, check its handles face the room, and if
    they don't, set `kit_yaw` (degrees) in `Content/Studio/class_map.json` once.
  - Kit things are **Static** (so they bake); a door's leaf and handle are **Movable**.

**Doors** (KIT.md §8, `importer.spawn_kit_door`):
- A kit door is three actors: `<id>__frame` (in the wall), the leaf `<id>` (its pivot on the hinge axis) and
  `<id>__handle` (attached to the leaf).
- They're all tagged `door:<id>` and `door_part:frame|leaf|handle`, and sit in the outliner under
  `Story/<room>/doors/<id>`.
- **Prove:**
  - Rotate a leaf about Z in the editor: it turns on its hinges, and the handle goes with it.
  - Then set `"door": {"class": ".../BP_Door.BP_Door_C"}` in class_map. The Blueprint should spawn on the hinge axis
    with the leaf attached under it, and turning the Blueprint should turn the door.
- **For the runner (to do):** a sliding door (`swing: "slide"`) has to slide along its wall, not turn. That's not in
  RUNNER_SPEC yet.
- Your own hinge model is split by the builder into door and frame halves. The halves are `local/` meshes on the
  machine that split them, so they aren't in git. They're `<id>__hinge<i>_door` (attached to the leaf) and
  `_frame` (static).

**Textures** (docs/ASSETS.md §5 and §6, `storykit/surfaces.py`):
- `M_StudioSurface` (world-aligned Albedo, Normal, Rough and AO, plus `TileCm`) was written without an editor before
  this branch, and is still unproven. If `master_material()` fails, build it by hand with those parameter names.
- **The PBR shelf:** your sets live in `Content/Studio/PBR/<Category>/<name>/`, and a story names one as
  `pbr/<Category>/<name>`.
  - When a level is built, `surfaces.material(ref)` first looks for
    `/Game/Studio/PBR/<Category>/<name>/MI_<name>`.
  - It imports only when that's missing, or when a map changed since. The stamp of the maps is kept as asset
    metadata `storykit_stamp` on the material instance.
  - `surfaces.sync_pbr()` does the whole shelf at once and logs how many Unreal had, imported and re-imported.
- **Prove:**
  - `sync_pbr()` runs.
  - A second run imports nothing.
  - DX normals look right; they import with no green flip.
  - The displacement imports as linear greyscale.
- The API names this code relies on, which Unreal may disagree with: `EditorAssetLibrary.get_metadata_tag` and
  `set_metadata_tag`, `TextureCompressionSettings.TC_GRAYSCALE`, `flip_green_channel`, and
  `MaterialEditingLibrary.get_material_instance_scalar_parameter_value`. The logic was run against a stand-in for
  Unreal's API, not Unreal.

**Kimodo:** `kimodo.py stage` still sends boxes, and a sliding door no longer gets a swing on the floor. No materials or
kit meshes go to Kimodo.

## 4. Where to read more

- docs/SCENE_BUILDER.md: the builder.
- docs/KIT.md: the kit; §5 covers Unreal, §8 doors and hinges.
- docs/ASSETS.md §6: the PBR shelf.
- docs/STORY_FORMAT.md: the new words.
- docs/LESSONS.md: the five new lessons.
- The launcher has the new pages (the scene builder, the kit maker, the PBR shelf) and the PBR tools.
