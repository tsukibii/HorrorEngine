# The MetaHuman route: design here, make it there (2026-10-20)

The user's call: we can't compete with MetaHuman in Unreal, so the desk's tools become editors *of* MetaHumans, not
a rival body. The ideal workflow they asked for, and what the research says each step runs on:

| Step | Runs on | State |
| --- | --- | --- |
| 1. Design the body in the desk (Shape page sliders, the Lines tool, skin tone) | ours, offline | built (skin tone: a cast field, below) |
| 2. Make the MetaHuman from it | **MetaHuman Creator's Python API (5.8)**, driven through UnrealClaude | `tools/metahuman.py` writes the script; untested here (no Unreal in this environment) |
| 3. Rig it in the cloud | the same API (auto-rig request) | same script |
| 4. A simplified rig in the desk, no face | export the rigged body FBX; `bodies.js` already drives the UE5 mannequin skeleton the MetaHuman body extends | works today (`previs_body`); face untouched |
| 5. Jiggle | Kawaii Physics on the MetaHuman body, set up from the Fat suit page's soft-bone export | the export exists; the Unreal side is a manual setup (§4) |

## 1. What MetaHuman exposes (what the research found)

- **A Python API for the Creator, since 5.8** (`MetaHumanCharacterEditorSubsystem`, docs: "MetaHuman Creator Python
  Scripting"): create, edit, conform, sculpt, auto-rig, assemble and export MetaHuman Character assets from scripts.
  Edits are staged on a registered character and committed: the **parametric body** through `get_body_constraints` /
  `set_body_constraints` and `commit_body_state(character)`; **skin** through `commit_skin_settings(character,
  skin_settings)`, which synthesises the textures; the face through `commit_face_state`; the build through
  `BuildMetaHuman` with build parameters. Reference scripts ship in
  `Engine/Plugins/MetaHuman/MetaHumanCharacter/Content/Python/examples/` (one task each) and `test_*.py` beside them.
  Some of it wasn't exposed to Python in 5.7; 5.8 widened it.
- **A MetaHuman generator toolset for Unreal's MCP server, also 5.8:** create a character, read and set eye colour, skin
  tone and body shape. The same reach as the Python API, from a chat; UnrealClaude gives us the same thing.
- **The parametric body:** statistically driven measurement sliders, grouped by region plus global ones (height,
  muscularity, fat), *correlated* (moving one moves the others unless they're pinned), with `get_body_constraints`
  returning the list and their ranges (optionally scaled by height). A **fixed** body (the 18 old presets) loses all
  of that. A **conformed** body (from a mesh: 5.7 accepts any pose from A to T, FBX round-trips) is for shapes the
  parametric model can't make.
- **Body correctives** (volume and skin deformation during animation) are built in from 5.5, LOD 0 by default; the
  body RigLogic can be *unpacked* (5.6, experimental) into PoseDriver and control-rig nodes to edit in the engine.
- **Textures:** 5.8 exports unbaked textures and materials for editing in Unreal or a DCC.
- **DNA Calibration** (Epic's GitHub, EULA-gated, Python 3.7/3.9/3.11 wrappers): edits a DNA's neutral joints, mesh
  vertices and blendshapes, renames and removes joints, scales the rig. It's the **face** DNA toolkit; the body DNA
  isn't documented there, and 5.8 moved DNA to a new asset type (a commandlet converts old ones). Third-party Blender
  add-ons (Polyhammer's Character DNA, MetaReForge) wrap it for head editing. Not our route: the body API above does
  what we need without touching DNA.
- **Jiggle:** nothing built in. The known route is extra bones and weights plus Kawaii Physics (works on 5.6 and 5.7
  from source; 5.8 unconfirmed). Two cautions from people who did it: the MetaHuman body mesh is in **pieces** (seams
  can open when it deforms), and merging vertices breaks the correctives.
- **Licence:** MetaHuman is under the Unreal Engine EULA (free under $1M revenue). The EULA added a restriction on
  using MetaHuman characters and animation curves *with AI*: read it before feeding MetaHuman data to a model.
  Applying Kimodo's motion to a MetaHuman is the other direction; still, check the wording once.

## 2. The decision: drive Creator, don't port the sculpting

- **Port nothing of the sculpt tools into Unreal.** The parametric body is a better body model than ours (it's
  statistical, correlated, rigged, with correctives and a wardrobe), and its mesh is Epic's to deform. Our desk's
  value is being fast, offline and measurable: design there, review there, and send **numbers**, not meshes.
- **Numbers first, mesh second.** A cast member's body goes to Creator as **constraints** (height, shoulders, chest,
  waist, belly, hips, thighs, arms, all in cm from the Shape page's measures), which keeps it parametric. Only a shape
  the model refuses (the chubby hourglass's 0.70 waist to hips) goes as a **conform** from the desk's OBJ, and then
  it's a fixed body: no sliders after.
- **Skin tone from the desk** (`cast.<id>.skin`, below), committed with the skin settings.
- **The desk's body after rigging is the real one:** export the rigged body as FBX into `Content/Studio/Bodies/` and
  set `previs_body`; the storyboard plays the blocking on it. No face rig in the desk, ever.
- **Jiggle in Unreal, tuned in the desk:** the Fat suit page's soft bones stay the tuning tool (they show the look
  at once); their export is the recipe for Kawaii on the MetaHuman body (§4).

## 3. `tools/metahuman.py`: the desk's body as an editor script

`python tools/metahuman.py --game Pilot mari` writes `Saved/Story/Pilot/metahuman_mari.py`, a script for the
editor's Python (run it through UnrealClaude's `unreal_execute_script`, or `UnrealEditor-Cmd.exe <project>
-ExecutePythonScript=...`). It:

1. creates a MetaHuman Character asset for the cast member (or opens the one `cast.<id>.metahuman` names);
2. registers it with the subsystem, reads `get_body_constraints`, matches the desk's measures to constraint names
   (`MEASURES` in the tool; the script prints the names it found when one doesn't match, so the table can be fixed
   on the first run), sets them and commits the body;
3. commits the skin settings with the cast member's `skin`;
4. requests the auto-rig and assembles;
5. exports the body skeletal mesh to FBX into `Content/Studio/Bodies/<id>.fbx` and sets `previs_body`.

**Untested:** this environment has no Unreal. The call names come from the 5.8 docs and API reference
(`set_body_constraints`, `commit_body_state`, `commit_skin_settings`, `BuildMetaHuman`); the skin settings struct and
the export call are marked `VERIFY` in the script against the plugin's `examples/`. The first run is a setup task
(SETUP S12): fix the names, then it's a tool.

## 4. Jiggle on the MetaHuman body (the manual part)

The Fat suit page's **Export** (soft bones) writes, per region, the bones to add (`soft_<region>_root` under the body
bone it hangs from, then `_1`, `_2`), their bind positions, the skin weights (with the painted jiggle) and the
settings. On the MetaHuman body:

1. duplicate the body skeletal mesh (keep Epic's pristine);
2. add the bones (Skeleton Editing in the Skeletal Mesh Editor, or Blender on the FBX round trip 5.7 allows) under
   the named parents;
3. transfer the weights by closest point from the export's positions (the conformed body matches the desk's MHR
   within the conform's tolerance; a parametric body needs the desk's shape fitted to it first: Shape page, fit to
   widths);
4. one Kawaii Physics node per chain in the body Anim Blueprint, after the correctives: damping and stiffness from the
   preset (per 60 Hz tick, the same meaning), the radius and limit angle from the export, sphere/capsule/box limits
   for the world and the arms;
5. the squash: scale the root bone by the chain's length ratio along it and 1/sqrt across, a small node after Kawaii.

The two cautions in §1 apply: weight only the piece the region is on, and never merge the body's pieces.

## 5. What this leaves for the desk

- The Shape page is the body designer (sliders, fit to widths); the Lines tool and the refiner are for the shapes the
  parametric model can't express, and their OBJ is the conform input.
- The Fat suit page is the jiggle tuner and the physics exporter.
- `cast.<id>.skin`: the skin tone, for Creator; the desk's clay stays clay (one colour for all, so the storyboard reads
  bodies, not people).

Sources: Epic's MetaHuman 5.8 release notes, "MetaHuman Creator Python Scripting in Unreal Engine", the
`MetaHumanCharacterEditorSubsystem` API reference (SetBodyConstraints, GetBodyConstraints, CommitSkinSettings,
BuildMetaHuman), "MetaHuman Creator Body Params Tool", "Body Model Controls", "The MetaHuman Component" (body
correctives), "MetaHuman Body RigLogic Unpacking", the MetaHuman-DNA-Calibration repository and its docs, the Epic
forum threads on jiggle physics for MetaHumans and Kawaii Physics, the Unreal EULA change log.
