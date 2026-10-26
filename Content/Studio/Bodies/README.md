# Bodies for the director's desk

**`MHR.fbx` ships and is the default:** Meta's Momentum Human Rig (github.com/facebookresearch/MHR, Apache-2.0: see
`MHR_LICENSE.txt`), LOD 4, with its 45 identity shapes as morph targets. The desk's **Shape** page shapes it per cast
member (`cast.<id>.shape`) and exports it for MetaHuman. `MHR_hi.fbx` (LOD 2, 10,661 vertices) is used for those exports and
the Fat suit page's balloons and hourglass; `MHR_lod1.fbx` (18,437) and `MHR_lod0.fbx` (73,639) are the page's finer
meshes, for round soft volumes (slower in the browser). `MHR_head.obj` is the head of `MHR_lod0.fbx`, cut
0.245 m under its top (Y up, facing +Z, metres): `tools/face_mesh.py`'s default head template.
`MHR_lod1.bin` is `MHR_lod1.fbx`'s mesh, its 45 identity shapes, its 72 expression shapes and its UVs, packed for the
Character Studio and face_mesh.py
(`tools/character/pack_mhr.py`, run in Blender's module; read with `tools/character/mhr.py`); `MHR_presets.json` holds the
editor's bases (average, feminine, masculine: fitted to proportions by `python tools/character/mhr.py presets`).
`MHR_lod1_rig.bin` is `MHR_lod1.fbx`'s skeleton (127 bones) and each of `MHR_lod1.bin`'s points' four bones and weights:
the Character Studio shows its body in a T-pose with it (`node tools/character/rig_mhr.mjs` makes it; `pose.js` reads it).

You can also drop other rigged human models here (`.glb`, `.gltf` with its files, or `.fbx`): the desk drives them with the blocking,
from the player's eye, instead of the capsule figure. Bones are found by name: Unreal mannequin (`pelvis`,
`spine_01`, `upperarm_l`...), Mixamo (`mixamorig:Hips`, `LeftArm`...) and common rig names. A-pose or T-pose both
work; any size (it's scaled to each cast member's height).

Other good choices, all made on your own machine (these are not redistributable: only the MHR files go in a zip,
and git LFS keeps the rest private in your repo):

- **Manny or Quinn** from your Unreal project (the same skeleton as the game). In the editor, find
  `SKM_Manny_Simple` (or `SKM_Quinn_Simple`) in the template's `Characters/Mannequins/Meshes`, right-click →
  Asset Actions → Export → FBX, and save it here as `Manny.fbx`. Epic's content is licensed for Unreal projects; a
  local preview tool for an Unreal project is that.
- **A Mixamo character** (mixamo.com, free with an Adobe account): pick a character, Download → FBX Binary, T-pose,
  with skin. Mixamo forbids redistributing raw files, so keep it here and don't share it outside the team.
- **Each cast member's MetaHuman body**, once they exist: export the body skeletal mesh to FBX, and set the cast
  member's `previs_body` to it. Their real proportions in the storyboard.

Which body plays: the cast member's `previs_body`, else the game's `previs_body`, else a file here named
`default.*`, else the first file here (MHR.fbx), else the capsule figure. The desk's Game panel sets them. A
cast member's `shape` only applies to MHR bodies.
