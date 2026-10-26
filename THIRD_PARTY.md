# Third-party files in the kit

| What | Where | Licence |
| --- | --- | --- |
| three.js 0.160.0 and its loaders/exporters | `tools/director/vendor/` | MIT (`tools/director/vendor/THREE_LICENSE.txt`) |
| MHR, the Momentum Human Rig (Meta), LOD 4, 2, 1 and 0 rigs | `Content/Studio/Bodies/MHR.fbx`, `MHR_hi.fbx`, `MHR_lod1.fbx`, `MHR_lod0.fbx` | Apache-2.0 (`Content/Studio/Bodies/MHR_LICENSE.txt`); from github.com/facebookresearch/MHR release v1.0.1, unmodified |
| The Base Mesh props (glTF by M3-org) | `Content/Studio/Library/meshes/basemesh/`, the index in `Content/Studio/Library/index/basemesh.json` | CC0 1.0 (`Content/Studio/Library/LEDGER.json` lists each file and its source) |
| EZSoftBone (Ethan Zack): the soft-bone method, ported to JavaScript and changed (no files copied) | `tools/director/softbone.js` | MIT (github.com/EZhex1991/EZSoftBone; credited in the file) |
| MediaPipe's hair segmenter, multiclass selfie segmenter and Face Landmarker models (Google): fetched by `tools/gshair.py setup` into `vendor/gshair/` (git-ignored), nothing copied; the splat is ours | `vendor/gshair/` | Apache-2.0 |
| Blender's hair maths (blender/blender): the sculpt brushes, the add-and-interpolate step, the length and collision constraints, the children's curl, clump and roughness, the hair simulation's springs and targets, ported to JavaScript for the salon (docs/research/blender_hair.md); Blender's names kept | `tools/character/salon/` (to come), `tools/character/wig.js` when grown | GPL-2.0-or-later: the files that carry ports say so in their header; nothing else of Blender is used |
| awesome-cc0 (madjin) | `docs/assets/awesome-cc0.md` | CC0 1.0 (`docs/assets/awesome-cc0.LICENSE.txt`) |

Apache-2.0 asks that a copy of the licence travels with the files and that changes are marked: keep
`MHR_LICENSE.txt` beside the FBX files. Shapes made on the Shape page and the OBJ exports are derived works of MHR:
credit "MHR (Meta, Apache-2.0)" where a game lists third-party assets (the OBJ header already says so).
