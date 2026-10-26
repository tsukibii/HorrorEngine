# MHR characters in Unreal Engine 5.8: import, identity baking, pose correctives, faces, retargeting, and the gaps versus MetaHuman

How these notes were made (Oct 21, 2026):
- **Unreachable from this environment:** arxiv.org, dev.epicgames.com, research.nvidia.com and alphaxiv. Epic and paper facts below come from web-search summaries of those pages and are marked "(search summary)".
- **The web-search budget ran out** before the groom, MetaHuman-performance and Apple ARKit searches.
- **Primary sources were GitHub repos read directly:** MHR, PyMomentum (facebookresearch/momentum), NVlabs/SOMA-X, KawaiiPhysics, ARKitRemap and the SAM 3D Body tools.
- **Measured in this session:** MHR's shipped v1.0.1 assets (`assets.zip`, 199 MB, from the GitHub release). Its `lod1.fbx` and `lod0.fbx` are byte-identical to our `Content/Studio/Bodies/MHR_lod1.fbx` and `MHR_lod0.fbx` (sha256 checked). I wrote a small binary-FBX reader and numpy scripts for this.
  - These are marked "[measured]" and cite the release page.
  - The scripts are in the session scratchpad, `/tmp/claude-0/-home-user-HorrorEngine/d086ac05-0e8d-53fd-9a7e-75c9d1a6e526/scratchpad/scripts/` (`fbxinfo.py`, `correctives.py`, `headjoints.py`, `idshapes.py`). Rerun them if the numbers matter.

## Q1. Importing an MHR rig into UE 5.8: is the FBX clean (units, axes, joint orientations, scale)? Community reports? An official exporter?

### Takeaway
MHR's shipped FBX is structurally clean for Unreal:
- centimetres, Y-up with +Z front, unit scale 1
- no scale on any joint, and the bind pose equals the rest pose
- each joint's X axis runs along the bone, with at most 4 skin influences per vertex
- 117 sparse blendshapes, one UV set and no materials

Two things need cleaning first:
- **77 "Collision N" null nodes** parented under joints. Unreal's FBX importer has historically turned null nodes in a skeleton into bones.
- **No FBX BindPose node.**

MHR ships no Blender or Unreal exporter. The official way to write an MHR character to FBX or glTF is PyMomentum's `save_fbx`/`save_gltf`, which can drop the collision geometry and change the coordinate system. MHR's own web viewer also exports a rigged GLB or USD with the armature and the top 4 skin weights, but no morph targets. Community tools bring MHR or SAM 3D Body output into Blender, Unity and Unreal as FBX, and none of them reports Unreal-specific problems.

### Cited Findings
- **[measured] File format.** `lod1.fbx` is FBX 7700 (FBX 2020 format). GlobalSettings: UpAxis = +Y, FrontAxis = +Z, CoordAxis = +X, UnitScaleFactor = 1.0 (centimetres). The mesh's bounding box is 172.62 units tall, so the mesh is in cm. — [MHR v1.0.1 release assets](https://github.com/facebookresearch/MHR/releases/tag/v1.0.1)
- **[measured] Skeleton.** 127 joints: one FBX `Root` node named `body_world` and 126 `LimbNode`s. `body_world` → `root` (pelvis, 92.4 cm above the floor) → legs, spine, arms and head.
  - **Twist joints:** each limb segment has 4–5 twist joints with a `_proc` suffix (e.g. `l_upleg_twist0_proc..4_proc`, `l_lowarm_twist1_proc..4_proc`), plus one `l_wrist_twist`/`r_wrist_twist` per side.
  - **Neck:** `c_neck`, `c_neck_twist0_proc`, `c_neck_twist1_proc`.
  - **Feet:** `l_talocrural`, `l_subtalar`, `l_transversetarsal`, `l_ball`.
  - **Fingers:** `thumb0-3`, `index1-3`, `middle1-3`, `ring1-3`, `pinky0-3`, each ending in a `*_null` end joint.
  - **Head:** `c_head`, `c_jaw`, `c_teeth`, `c_jaw_null`, `c_tongue0..4`, `r_eye`, `r_eye_null`, `l_eye`, `l_eye_null`, `c_head_null`.
  - There are 127 skin clusters. — [MHR v1.0.1 release assets](https://github.com/facebookresearch/MHR/releases/tag/v1.0.1)
- **[measured] Joint transforms.**
  - No joint has a non-unit `Lcl Scaling`, and every `Lcl Rotation` is zero at rest.
  - 60 joints carry a `PreRotation` (the FBX equivalent of Maya's joint orient).
  - Each skin cluster's `TransformLink` equals the joint's rest-pose global transform to within 0.0001 cm, so bind = rest.
  - There is no FBX `Pose` (BindPose) object. — [MHR v1.0.1 release assets](https://github.com/facebookresearch/MHR/releases/tag/v1.0.1)
- **[measured] Joint axes and rest pose.** X runs along the bone: `l_uparm`'s X axis in rest is (0.67, −0.74, 0.05), so the arms are about 48° below horizontal (an A-pose). `c_head`'s X axis points straight up (0, 1, 0). — [MHR v1.0.1 release assets](https://github.com/facebookresearch/MHR/releases/tag/v1.0.1)
- **[measured] Skinning.** At most 4 influences per vertex (mean 2.78). Histogram of 1/2/3/4 influences: 3,925 / 3,491 / 3,662 / 7,361 vertices. — [MHR v1.0.1 release assets](https://github.com/facebookresearch/MHR/releases/tag/v1.0.1)
- **[measured] Blendshapes.** 117 `BlendShapeChannel`s named `shape_c_0` … `shape_c_116`, whose shape geometries are named `shape_0` … `shape_116`. They are stored sparsely: the expression shapes list 924–5,681 of the 18,439 vertices (median 3,130). — [MHR v1.0.1 release assets](https://github.com/facebookresearch/MHR/releases/tag/v1.0.1)
- **[measured] Collision nulls.** 77 extra `Null` models named `Collision 0` … `Collision 76`, parented under joints: 5 each under `l_ball`/`r_ball`, 3 under each wrist, 3 under `root`, 2 under each spine joint, 1 under each finger segment, and so on. These are Momentum's collision primitives. — [MHR v1.0.1 release assets](https://github.com/facebookresearch/MHR/releases/tag/v1.0.1)
- **[measured] UVs and materials.** One UV set (19,455 UVs in 0–1, by polygon vertex, so the UV seams split vertices) plus normals. No materials. — [MHR v1.0.1 release assets](https://github.com/facebookresearch/MHR/releases/tag/v1.0.1)
- **[measured] Mesh size.** LOD1 has 18,439 vertices and 36,874 triangles; LOD0 has 73,639 vertices and 147,274 triangles. Both are a single closed shell with 0 boundary edges. — [MHR v1.0.1 release assets](https://github.com/facebookresearch/MHR/releases/tag/v1.0.1)
- **What MHR ships, per its README:**
  - Assets: `compact_v6_1.model` (the parameterization), `corrective_activation.npz` ("Pose corrective MLP sparse activations"), `corrective_blendshapes_lod?.npz`, `lod?.fbx` ("rig with identity and expression blendshapes") and `mhr_model.pt` (TorchScript), across 7 LODs (0–6).
  - The TorchScript model "only supports LOD 1".
  - The pip install is "experimental"; PyMomentum "may not resolve on all platforms" (Pixi is recommended).
  - No Blender, Unreal or Maya exporter is mentioned. — [MHR README](https://github.com/facebookresearch/MHR)
- **The paper:** 127 joints, 204 pose parameters, and six levels of detail from about 595 to about 73,600 vertices. The release itself ships 7 FBX files, `lod0`–`lod6`. It builds on ATLAS's separation of skeleton and body shape. — [arXiv 2511.15586](https://arxiv.org/abs/2511.15586) (search summary; the page itself was unreachable)
- **MHR's official web viewer (in the repo):**
  - It "export[s] the evaluated mesh as OBJ, GLB, or USD. OBJ exports are static meshes. GLB and USD exports include the MHR armature and four normalized skinning influences per vertex."
  - The model is evaluated in centimetres and converted to metres.
  - Other LODs are produced with MHR's official barycentric mappings.
  - FBX topology is read from control points because "general FBX renderers can duplicate vertices at UV/normal seams". — [MHR web-viewer README](https://github.com/facebookresearch/MHR/blob/main/web-viewer/README.md)
- **How the viewer picks weights:** it keeps the top 4 weights per vertex from the model's own skin weights (`np.argsort(...)[:, -4:]` on `model.get_lbsw()`). — [web-viewer/server.py](https://github.com/facebookresearch/MHR/blob/main/web-viewer/server.py)
- **How the viewer exporter handles the skeleton:** it reads the skeleton state as translation, quaternion and a uniform scale per joint, and folds the scale into the bind matrices. Its GLB writer has no morph-target code (the only "target"s are buffer-view targets 34962/34963). — [web-viewer/exporters.py](https://github.com/facebookresearch/MHR/blob/main/web-viewer/exporters.py)
- **How MHR loads its rig:** through PyMomentum, `pym_geometry.Character.load_fbx(fbx_path, model_path, load_blendshapes=True)`. — [mhr/mhr.py](https://github.com/facebookresearch/MHR/blob/main/mhr/mhr.py)
- **PyMomentum's writers:**
  - `Character.save_fbx(path, character, fps=120, motion, offsets, markers, options)`: "Blend shape and face expression weights are automatically extracted from the model parameters (motion)".
  - Also `save_fbx_with_joint_params`, `save_gltf`, `save_gltf_from_skel_states`.
  - `FbxBuilder.add_character` writes "skeleton + mesh with skin deformer, locators, collision geometry". — [momentum character_pybind.cpp](https://github.com/facebookresearch/momentum/blob/main/pymomentum/geometry/character_pybind.cpp), [fbx_builder_pybind.cpp](https://github.com/facebookresearch/momentum/blob/main/pymomentum/geometry/fbx_builder_pybind.cpp)
- **PyMomentum's `FileSaveOptions`:** `mesh` (default true), `locators` (true), `collisions` (true), `blend_shapes` (true), `permissive`, `coord_system_info` (default "Maya Y-up") and `fbx_namespace`. — [momentum geometry_pybind.cpp](https://github.com/facebookresearch/momentum/blob/main/pymomentum/geometry/geometry_pybind.cpp)
- **Community: tori29umai0123's ComfyUI-SAM3DBody_utills.** It writes "an FBX containing armature + skinned mesh + pose animation… The FBX opens directly in Blender / Unity / Unreal Engine", using headless Blender. — [tori29umai0123/ComfyUI-SAM3DBody_utills](https://github.com/tori29umai0123/ComfyUI-SAM3DBody_utills)
- **Community: FBXify.**
  - It exports armature-only FBX from SAM 3D Body.
  - Its `direct_rotation` mapping is "primarily useful for MHR due to the perpendicular nature of MHR bone rotations".
  - It supports MHR, Mixamo and Unity targets. — [segfaultExpress/sam-3d-body-fbxify](https://github.com/segfaultExpress/sam-3d-body-fbxify)
- **Community: Mimic.** It fits Rigify bones to MHR joints; "Bone rolls follow the MHR hinge axes, so elbows, knees and fingers bend about their local X axis". — [saranunt-0/mimic-blender-sam3d](https://github.com/saranunt-0/mimic-blender-sam3d)
- **Null nodes in Unreal (old reports).**
  - Epic's Lina Halper in 2014: "We import empty node as a bone, but I think we can support that as an option" (a possible `bImportNullNodeInBoneHierarchy`). — [bf-gamedev list, 2014](https://lists.blender.org/pipermail/bf-gamedev/2014-July/000275.html)
  - A user reports that null objects/groups in the tree "will mess things up" on skeletal import. — [Unreal Answers](https://answers.unrealengine.com/questions/497214/view.html)
- **Our own earlier lesson (glTF, not FBX):** Unreal's glTF import scaled MHR's bones by their nodes but not its vertices, giving a 172 m skin on a 1.6 m skeleton. The desk now exports "a fresh skeleton with no scales, vertices and bones in metres". — [docs/LESSONS.md](../../docs/LESSONS.md)

### Inferences
- **Import route:**
  - **Either** export each character with PyMomentum `save_fbx` with `collisions=False` and `locators=False` (optionally a Z-up `coord_system_info`)
  - **or** load the FBX in Blender's module, delete the `Collision *` empties and re-export.
  - Then import with "Import Morph Targets" on.
  - Expect a 127-bone skeleton rooted at `body_world`. The `*_null` leaf joints come in as harmless end bones, usable as sockets (e.g. `l_eye_null` for a look target).
- **Units and axes need no fixing.** Centimetres match Unreal; Y-up/+Z-front is the standard Maya convention, which the FBX importer converts.
- **The missing BindPose should only cause a warning.** Rest equals bind, so a time-zero fallback gives the right result. This is unverified on 5.8's FBX/Interchange importer.
- **Use FBX, not the viewer's GLB/USD, for game characters.** The GLB/USD lose the 72 expression morphs, and our own lesson shows the glTF path is risky in Unreal.
- **Rename the 72 expression channels** (`shape_c_45..116`) to their semantic names (`browLowerer_L` …) at export, and drop the 45 identity channels once they are baked. Curve mapping files then become readable, and morph names don't collide across games.

### Gaps
- No direct test of 5.8's FBX/Interchange import of `lod?.fbx` was possible here: the editor is not reachable from this container, and the MCP "unreal" server failed to connect. Two things are unverified: whether null nodes still become bones, and whether the morph-target names come from the channel names (`shape_c_N`) or the shape names (`shape_N`).
- PyMomentum's `save_fbx` output was not run, so whether it writes blendshape channels with semantic names is unknown.
- No community report specific to Unreal (forum or blog) about MHR import problems was found.

## Q2. Baking a custom identity while keeping the 72 expression shapes valid, and re-fitting the skeleton to the new identity

### Takeaway
In MHR's own forward pass, identity and expression are both linear deltas on one template. They are simply added together: expressions do not depend on identity, and identity coefficients never move the joints.

Measured on the shipped FBX:
- No identity shape changes height by more than 0.48 cm at weight 1.
- Elbow and knee skin rings move by at most 0.48 cm.
- Height and limb proportions come from separate skeleton **scale** parameters (68 of the 204 model parameters, per SOMA-X).

So baking a character = template + identity deltas (+ our photo bend) as the new rest mesh, with the 72 expression deltas kept as they are, which is exactly what MHR does. The proportions get baked into the joint positions with unit scales, as MHR's own viewer exporter does. The only risk is where our photo bend moves eyelids or lips beyond MHR's identity space; that needs a contact check or deformation transfer.

### Cited Findings
- **MHR's forward pass:**
  - `coeffs = cat([identity_coeffs, face_expr_coeffs])`, then `rest_pose = blend_shape.forward(coeffs)`: one linear blend.
  - Joint parameters come from `model_parameters` with the identity and expression parameter slots zero-padded.
  - Correctives come from the joint parameters only and are added to `rest_pose`; then `skin_points(skel_state, rest)`. — [mhr/mhr.py](https://github.com/facebookresearch/MHR/blob/main/mhr/mhr.py)
- **Parameter counts:** identity is 45 parameters ("first 20 control body shape, the next 20 control head, and the last 5 control hands", typical range about −3 to +3); model parameters are 204 ("Joint angles and scalings"); expressions are 72 (typical range −1 to +1). — [MHR README](https://github.com/facebookresearch/MHR)
- **The 72 expressions** are "artist-sculpted, sparse semantic blendshape weights that follow FACS", "not PCA components", and not one-to-one with FACS Action Units. Index *i* is FBX `shape_{45+i}` and PyMomentum `blend_{45+i}`. "The mapping is identical for LODs 0 through 6." — [docs/face-expressions.md](https://github.com/facebookresearch/MHR/blob/main/docs/face-expressions.md)
- **[measured] Identity shapes barely move the skeleton:**
  - At weight 1, the largest height change is +0.48 cm (`shape_20`, a head shape); 0 of 45 shapes change height by more than 1 cm.
  - The largest shape (`shape_0`) moves vertices by up to 3.19 cm but shifts the mean of the left elbow's skin ring by only 0.33 cm and the knee ring by 0.48 cm.
  - The median per-shape maximum delta is 0.21 cm. — [MHR v1.0.1 release assets](https://github.com/facebookresearch/MHR/releases/tag/v1.0.1)
- **MHR's 204 model parameters**, as SOMA-X's converter describes them: "[0:3] = global translation (cm), [3:136] = pose parameters (axis-angle), [136:204] = body-part scale parameters (68)". — [SOMA-X tools/mhr2soma.py](https://github.com/NVlabs/SOMA-X/blob/main/tools/mhr2soma.py)
- **SAM 3D Body's sample output has separate fields:**
  - `shape_params` (45), `scale_params` (28), `body_pose_params` (133), `hand_pose_params` (108), `expr_params` (72)
  - `mhr_model_params` (204), `pred_joint_coords` (127×3)
  - The 28 vs 68 scale count differs from SOMA-X's description; presumably a compressed basis, which is unverified. — [MHR repo, sam3d_body_outputs sample](https://github.com/facebookresearch/MHR/tree/main/tools/mhr_smpl_conversion/data/sam3d_body_outputs)
- **Bone lengths are a separate estimate from shape:** "Body shape, bone scales and bone lengths are fixed to their median over the clip. SAM 3D Body re-estimates bone lengths every frame". — [mimic-blender-sam3d](https://github.com/saranunt-0/mimic-blender-sam3d)
- **Bone-length sliders scale the mesh too:** a community tool implements them "as an extension of LBS with per-joint isotropic scaling: bone-length changes also isotropically scale the mesh around that joint". — [ComfyUI-SAM3DBody_utills](https://github.com/tori29umai0123/ComfyUI-SAM3DBody_utills)
- **MHR's viewer exporter** stores the skeleton state per joint as (t, q, s) and folds `s` into the global bind matrices (`rotations *= scales`), so the exported rest skeleton carries the proportions. — [web-viewer/exporters.py](https://github.com/facebookresearch/MHR/blob/main/web-viewer/exporters.py)
- **LOD transfer:** MHR ships barycentric mappings from LOD1 to LODs 0 and 2–6 (`triangle_ids`, `baryc_coords`) for converting a LOD1 mesh to the other LODs. — [tools/mhr_LOD_conversion](https://github.com/facebookresearch/MHR/tree/main/tools/mhr_LOD_conversion)
- **Our desk's joint refit today:** "each joint moves with the skin around it: vertices weighted to both the bone and its parent (the joint's ring)". — [tools/director/bodies.js](../../tools/director/bodies.js)
- **[measured] Size of the expression deltas.** On the template, `jawDrop` moves up to 3.97 cm (1,901 vertices > 1 mm), `eyesClosed_L` up to 0.96 cm (457 vertices > 1 mm) and `lipCornerPuller_L` up to 1.86 cm. — [MHR v1.0.1 release assets](https://github.com/facebookresearch/MHR/releases/tag/v1.0.1)

### Inferences
- **Inside MHR's identity space, keeping the 72 deltas is not an approximation.** Adding them to a baked identity is exactly how MHR itself animates every identity. Deformation transfer would only be needed for our extra photo bend from `face_mesh.py`, which goes beyond the identity space.
- **Where the photo bend matters most** are the eyelids (a lid delta of about 1 cm has to land on the lower lid) and the lips (`lipPressor` or `lipSuck` can interpenetrate if lip thickness changed).
- **A measurable check per character:** apply `eyesClosed_L/R` and measure the minimum distance between the upper and lower lid; apply `jawDrop`, `lipPressor` and `lipSuck` and test for self-intersection.
- **Joints need little refitting for identity alone.** Real refitting is needed for proportions (height, limb lengths), and MHR expresses those through scale parameters.
- **Two ways to bake proportions:**
  - (a) Evaluate MHR (PyMomentum or TorchScript) with identity + scale parameters at zero pose. Take the evaluated joint positions (unit scale) and the evaluated rest mesh, and export with the original skin weights (what the viewer does).
  - (b) Keep the desk's "joint ring" refit for residuals.
  - Avoid shipping bone scale as a runtime animation channel in Unreal: it complicates retargeting and Kawaii Physics.
- **Build each character at LOD1 and push it to LOD0 and LODs 2–6** with the official mappings, so every LOD shares the same identity. The expression shapes already exist in each `lodN.fbx` with the same index mapping.

### Gaps
- No public MHR joint regressor (vertices → joints) was found. Fitting scale parameters to an arbitrary custom mesh would need PyMomentum's solver (not verified in this session).
- No sources on deformation-transfer tooling were gathered (search budget exhausted). The standard technique is Sumner & Popović's deformation transfer (2004); a mesh-wrapping tool such as R3DS Wrap is an alternative. Neither was verified here.
- Whether MHR's head identity shapes (20–39) were sculpted or learned jointly with the expression set, which would affect how well expressions fit extreme heads, is undocumented.

## Q3. Pose correctives: how much do they matter (shoulders, elbows, hips), and how to reproduce them in Unreal? Pose Driver/RBF, ML Deformer, or ignore; costs

### Takeaway
MHR's correctives are a sparse two-layer network: 750 rotation features → 3,000 ReLU units → 3,000 corrective blendshapes. They are added in rest space before skinning, which is the same space Unreal applies morph targets in.

Measured on the shipped assets, they are small on average but large locally:
- A single 90° joint rotation moves skin by up to about 2 cm at the elbow, 3–5 cm at the shoulder, 3–4 cm at the knee, 4–6 cm at the spine and 5–9 cm at the hip, over 1,000–2,000 vertices. Some of those test rotations are non-anatomical, so the largest figures are upper bounds.
- Over real SAM 3D Body poses, a third party measured a Rigify rig with plain linear skinning at 3–5 mm mean difference from full MHR with correctives.

Three ways to reproduce them in Unreal:
- **Exact:** 3,000 morphs plus the sparse layer in a custom AnimNode. Heavy: about 1.16 million deltas at LOD1.
- **Approximate:** ML Deformer's Neural Morph Model trained on geometry caches from MHR with correctives on. This is Epic-supported and runs on CPU, but training on Linux is uncertain.
- **Cheap:** a handful of Pose Driver (RBF) correctives taken from MHR at key poses for the shoulders, hips, knees, elbows and spine.

Ignoring them is acceptable for wide or fast shots, but not for close, slow, intimate shots of shoulders and hips.

### Cited Findings
- **Inputs:** correctives are computed from joint parameters only. The Euler XYZ rotations of joints 2–126 (125 joints, excluding the two global ones) become 6D rotation features with the identity subtracted, and the result is added to the rest mesh before `skin_points`. — [mhr/mhr.py](https://github.com/facebookresearch/MHR/blob/main/mhr/mhr.py)
- **Network:** `SparseLinear(125*6 → 125*24, posedirs_sparse_mask, bias=False)` → `ReLU` → `Linear(125*24 → n_verts*3, bias=False)`, whose weights are the `corrective_blendshapes` array. "24 is a hyperparameter." — [mhr/io.py](https://github.com/facebookresearch/MHR/blob/main/mhr/io.py)
- **[measured] Network structure.** The mask is 3000×750 with 53,136 non-zero weights. Each hidden unit reads 12–48 inputs (median 18, about 3 joints), so the correctives are local. — [MHR v1.0.1 release assets](https://github.com/facebookresearch/MHR/releases/tag/v1.0.1)
- **[measured] File sizes (dense float32, uncompressed):**

  | File | Contents | Size |
  |---|---|---|
  | `corrective_blendshapes_lod0.npz` | | 2,651 MB |
  | `corrective_blendshapes_lod1.npz` | 3,000 × 18,439 × 3 | 663.8 MB |
  | `corrective_blendshapes_lod2.npz` | | 383.8 MB |
  | `corrective_blendshapes_lod3.npz` | | 176.4 MB |
  | `corrective_blendshapes_lod4.npz` | | 88.6 MB |
  | `corrective_blendshapes_lod5.npz` | | 35.0 MB |
  | `corrective_blendshapes_lod6.npz` | | 21.4 MB |
  | `corrective_activation.npz` | | 3.3 MB |

  — [MHR v1.0.1 release assets](https://github.com/facebookresearch/MHR/releases/tag/v1.0.1)
- **[measured] Sparsity at LOD1.** Each corrective shape touches a median of 223 vertices (more than 1 µm; up to 2,703). Altogether that is 1,162,530 non-zero vertex deltas (852,100 above 0.1 mm). — [MHR v1.0.1 release assets](https://github.com/facebookresearch/MHR/releases/tag/v1.0.1)
- **[measured] Correctives are zero at rest.** With no bias, zero features give ReLU(0) = 0.
  - A single-joint 90° rotation activates 49–116 of the 3,000 hidden units.
  - Sanity check: the moved vertices sit at the rotated joint (the left elbow region at x 30.6 cm, y 128.2 cm for `l_lowarm`; the knee at y 52 cm for `l_lowleg`). — [MHR v1.0.1 release assets](https://github.com/facebookresearch/MHR/releases/tag/v1.0.1)
- **[measured] Largest corrective displacement for a single-joint rotation about one local axis, other joints at rest:**

  | Joint | 45° | 90° | Vertices moved > 2 mm at 90° |
  |---|---|---|---|
  | `l_uparm` (shoulder) | 6.5–26 mm | 11.6–47.0 mm | 959–1,737 |
  | `l_lowarm` (elbow) | 1.5–18.8 mm | 5.9–21.0 mm | 378–1,017 |
  | `l_wrist` | | 5.3–16.4 mm | |
  | `l_upleg` (hip) | 9.5–36.6 mm | 27–86 mm | 1,306–1,640 |
  | `l_lowleg` (knee) | 4–18 mm | 15–44 mm | 510–2,082 |
  | `c_spine1` | 19–28 mm | 34–62 mm | about 2,000 |
  | `c_neck` | | 11–35 mm | |
  | `l_index1` | | 2–5 mm | |

  Some of these axis rotations are not anatomical (outside the training distribution), so the larger values are upper bounds, not typical. — [MHR v1.0.1 release assets](https://github.com/facebookresearch/MHR/releases/tag/v1.0.1)
- **Third-party accuracy on real SAM 3D Body poses:**
  - "Rigify rig vs MHR with linear skinning: 1.4–2.5 mm mean, 7–16 mm 99th percentile; Rigify rig vs full MHR (with pose-corrective shapes): 3–5 mm."
  - "The larger local errors sit at the feet and shoulders."
  - "Blender uses plain linear skinning. MHR's pose-corrective shapes are not reproduced." — [mimic-blender-sam3d](https://github.com/saranunt-0/mimic-blender-sam3d)
- **NVIDIA's SOMA-X uses the same idea:** an "optional shallow pose-dependent corrective MLP (2 hidden layers, ReLU activations) for surface artifact reduction", with standard LBS. — [SOMA-X model card](https://github.com/NVlabs/SOMA-X/blob/main/docs/model_card.md)
  - MHR "was used to learn the pose corrective model". — [SOMA-X README](https://github.com/NVlabs/SOMA-X)
  - Its body correctives are "supported only with procedural transforms". — [SOMA-X data_assets.md](https://github.com/NVlabs/SOMA-X/blob/main/docs/data_assets.md)
- **ML Deformer:**
  - The Neural Morph Model "generates a set of highly compressed morph targets approximating the target deformation based on bone rotations and/or curve inputs". The network runs on CPU at inference.
  - Training needs a Skeletal Mesh, an Animation Sequence with a wide range of poses, and a Geometry Cache of the target deformations (e.g. from Alembic). — [ML Deformer framework](https://dev.epicgames.com/documentation/en-us/unreal-engine/ml-deformer-framework-in-unreal-engine), [NeuralMorphModel Python API](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/NeuralMorphModel) (search summary)
  - Local mode can reduce GPU memory but may miss deformations away from joints. More morph targets or neurons means more memory and slower evaluation. The Detail Pose Model adds one morph target per detail pose. The Vertex Delta Model runs on GPU and is described as less efficient than the Neural Morph Model. — [ML Deformer framework](https://dev.epicgames.com/documentation/en-us/unreal-engine/ml-deformer-framework-in-unreal-engine), [DetailPoseModel API](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/DetailPoseModel), [VertexDeltaModel API](https://docs.unrealengine.com/PythonAPI/class/VertexDeltaModel.html) (search summary)
  - Epic's how-to says the workflow relies on Maya to generate training data, exported as FBX and Alembic. — [How to use the ML Deformer](https://dev.epicgames.com/documentation/en-us/unreal-engine/how-to-use-the-machine-learning-deformer-in-unreal-engine) (search summary)
  - **Linux, old information:** an Epic roadmap entry (about 3.5 years old) says trained Neural Morph and Nearest Neighbor models run on Linux and macOS, "although training errors may be encountered". — [ML Deformer roadmap](https://portal.productboard.com/epicgames/1-unreal-engine-public-roadmap/c/1162-ml-deformer) (search summary)
  - Autodesk's ML Deformer Python installer for Maya offers CUDA PyTorch on Windows and Linux. — [Autodesk Maya help](https://help.autodesk.com/cloudhelp/2025/ENU/Maya-CharacterAnimation/files/GUID-C2885274-C439-40E9-88B5-9C28C1A18A01.htm) (search summary)
- **Pose Driver:**
  - The AnimGraph node drives Pose Assets with RBF from a bone's orientation or translation; one use is "a pose space deformer to drive corrective blend shapes". — [Pose Driver docs (4.27)](https://docs.unrealengine.com/4.27/en-US/AnimatingObjects/SkeletalMeshAnimation/AnimPose/PoseDriverNode) (search summary)
  - Epic's free, experimental Pose Driver Connect authors correctives in Maya for Unreal, including for MetaHumans. — [CG Channel, Dec 2023](https://www.cgchannel.com/2023/12/get-epic-games-free-pose-driver-connect-for-maya-and-ue5/)
  - Users report its response is non-linear and suggest putting pose drivers in a Linked Anim Graph. — [Daz forum](https://www.daz3d.com/forums/discussion/590086/updated-bringing-daz-figures-to-life-in-ue5/p3)
  - "Not simple to setup"; based on Hans Godard's RBF. — [Epic forum](https://forums.unrealengine.com/t/how-to-set-bone-driven-controllers-for-corrective-morph-targets/497249) (search summary)
- **In-engine morph authoring:**
  - The morph-target vertex sculpt tool (`SkeletalMeshMorphTargetEditingTools`) is listed as Experimental for UE 5.6, 5.7 and 5.8. — [UMorphTargetVertexSculptTool API](https://dev.epicgames.com/documentation/unreal-engine/API/Plugins/SkeletalMeshMorphTargetEditingTo-/UMorphTargetVertexSculptTool?lang=en-US) (search summary)
  - 5.8 adds Experimental "Direct Mesh Controls" and expanded Skeletal Editor tools for "sculpting faces, correcting poses". — [UE 5.8 release notes](https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-5-8-release-notes?lang=en-US), [UE 5.8 announcement](https://www.unrealengine.com/news/unreal-engine-5-8-is-now-available) (search summary)

### Inferences
- **Rest-space deltas are the key compatibility point.** MHR adds its corrective deltas in rest space before skinning, which is exactly where Unreal applies morph targets, so MHR corrective output can become Unreal morph targets with no conversion.
- **Correctives don't depend on identity:** their input is pose only. The same deltas apply to every baked character as long as vertex order is preserved.
- **Option A, exact. Too heavy for many characters; fine for experiments.**
  - Import all 3,000 corrective shapes as morphs and evaluate the 750→3,000 sparse layer + ReLU in a small C++ AnimNode or Control Rig function: about 53k multiply-adds per frame, trivial.
  - The memory and weight-count cost is the problem: about 1.16M deltas at LOD1, roughly 4× that at LOD0, and hundreds of non-zero weights per frame in full-body poses.
  - Can be pruned: units are local (about 3 joints each), so keep only the shoulder, hip, knee, elbow and spine groups.
- **Option B: ML Deformer.**
  - MHR's corrective model is itself a bone-rotation → morph-weight network, the same architecture family as the Neural Morph Model. Training data can come straight from MHR in Python instead of Maya: run a range-of-motion or Kimodo motion set through MHR with correctives on, and write the vertices as an Alembic/USD geometry cache.
  - Cost: one training per skeletal mesh; CPU inference with a few dozen compressed morphs.
  - Risk: the training status on Linux in 5.8.
- **Option C: Pose Driver. Cheapest and deterministic; the first thing to try for close shots.**
  - Take MHR's corrective deltas at about 10–20 key poses: shoulder abduction and flexion 90°, elbow 120°, hip flexion 90°, knee 120°, spine forward/side 45°, neck turn.
  - Import them as morph targets and drive them with the Pose Driver.
- **Where it matters most** for our games: shoulders and hips (largest offsets), then knees, elbows and spine (belly and back creases, which matter for chubby characters). Fingers can be ignored. With linear skinning only, expect the familiar "candy-wrapper"/collapse look at shoulders and hips in close, slow shots.

### Gaps
- No Unreal benchmark numbers found for the Neural Morph Model runtime or for many active morphs; no memory figures for 3,000-morph meshes in Unreal.
- The current (5.8) Linux status of ML Deformer training is unverified; the only Linux statement found is old.
- How large MHR's correctives are over *realistic* full-body poses (as opposed to single-axis tests) was not measured here. Next step: run the Kimodo motion library through MHR with and without correctives.

## Q4. Facial animation in Unreal on a custom MHR mesh: 72 morphs from curves (ARKit or MHR names), Pose Asset/mapping, face board, Live Link; jaw/teeth/tongue; eyes and lids

### Takeaway
The 72 MHR expression shapes import as ordinary morph targets, and Unreal drives morph targets with animation curves of the same name. So any capture source can be mapped onto them:
- MetaHuman Animator (about 250 `CTRL_expressions` curves)
- Live Link Face / ARKit (52 curves)

Unreal 5.8's experimental **RigMapper** (weighted sums, set-driven keys, multiply nodes for combination correctives; JSON in and out) and the experimental **Remap Curves** node are the tools for that mapping.

The bigger gap: MHR's mesh has **no eyeballs, teeth, tongue or mouth opening**.
- It is one watertight shell at both LOD1 and LOD0.
- `l_eye`, `r_eye`, `c_teeth` and `c_tongue0-4` have **no skinned vertices**.
- Gaze and blinks are surface shapes (`eyesLook*` ≤0.8 cm; `eyesClosed` ≤0.96 cm).
- The jaw opens mainly through the `jawDrop` shape (≤4 cm); `c_jaw` is skinned to 1,693 vertices at LOD1.

Eyes, lids that close over real eyeballs, teeth, tongue and a mouth interior all have to be built and skinned to MHR's existing eye, teeth, jaw and tongue joints.

### Cited Findings
- **[measured] Head-joint skinning.**

  | Joint | LOD1 vertices | LOD0 vertices |
  |---|---|---|
  | `l_eye`, `r_eye`, `c_teeth`, `c_tongue0..4` | 0 | 0 |
  | `c_jaw` | 1,693 (28 with weight > 0.99) | 6,929 |
  | `c_head` | 5,739 | |

  Both LODs are a single closed shell with 0 boundary edges: no eye openings, no mouth opening, and no separate eyeball, teeth or tongue geometry. — [MHR v1.0.1 release assets](https://github.com/facebookresearch/MHR/releases/tag/v1.0.1)
- **[measured] Face shape sizes (LOD1):**

  | Shape | Largest move | Vertices moved > 1 mm |
  |---|---|---|
  | `jawDrop` (`shape_69`) | 3.97 cm | 1,901 |
  | `eyesClosed_L` (`shape_57`) | 0.96 cm | 457 |
  | `eyesLookUp_L` (`shape_65`) | 0.79 cm | 422 |
  | `eyesLookLeft_L` (`shape_61`) | 0.36 cm | 380 |
  | `lipCornerPuller_L` (`shape_77`) | 1.86 cm | 1,292 |

  — [MHR v1.0.1 release assets](https://github.com/facebookresearch/MHR/releases/tag/v1.0.1)
- **MHR's 72 names** include unilateral brow, cheek, lid, lip-corner and nostril controls; eye gaze (`eyesLookDown/Left/Right/Up_L/R`); `eyesClosed_L/R`; jaw (`jawDrop`, `jawSidewaysLeft/Right`, `jawThrust`); and lip quadrants (`lipFunneler_LB/LT/RB/RT`, `lipSuck_*`, `lipsToward_*`). There are no tongue shapes. `_L`/`_R` are the character's own left and right. — [docs/face-expressions.md](https://github.com/facebookresearch/MHR/blob/main/docs/face-expressions.md)
- **ARKit 52 conventions:**
  - The 52 ARKit blendshape names, listed in full. — [ARKitRemap reference/conventions.md](https://github.com/Dylanyz/ARKitRemap/blob/main/reference/conventions.md)
  - "Curve→morph binding in UE is name-based and case-insensitive."
  - MetaHuman Animator's baked output is "~250 `CTRL_expressions_*` curves (251 raw controls on the archetype rig)".
  - Apple's naming is performer-relative for eyes, brows and smile, but observer-relative for `mouthLeft`/`mouthRight`.
  - Selfie-style source video is mirrored, so it gives a mirror-space MHA performance. — [ARKitRemap reference/conventions.md](https://github.com/Dylanyz/ARKitRemap/blob/main/reference/conventions.md)
- **RigMapper (as surveyed from UE 5.8.1 engine source by a community project):**
  - It lives in `Engine/Plugins/Experimental/Animation/RigMapper`; RigMapperOp adds IK Retargeter ops.
  - A definition holds `Inputs`, `Features` and `Outputs`. Feature types are WeightedSum, SDK (set-driven key, piecewise-linear), Multiply ("the corrective-combination primitive") and MathOp (new in 5.8).
  - JSON `LoadFromJsonFile` and `ExportAsJsonString` are BlueprintCallable.
  - Definitions can be stamped on a SkeletalMesh as asset user data. There is a live AnimNode.
  - Missing inputs propagate as unset, not 0. — [ARKitRemap reference/rigmapper.md](https://github.com/Dylanyz/ARKitRemap/blob/main/reference/rigmapper.md)
- **Epic's roadmap on RigMapper:** it lets "motion be transferred between different character setups, such as applying ARKit animations to MetaHumans or using MetaHuman Animator animations on ARKit characters". Remap Curves "has been expanded to a stack of Ops". Listed as Beta; a forum post calls it experimental in 5.7. — [Unreal roadmap: RigMapper](https://portal.productboard.com/epicgames/1-unreal-engine-public-roadmap/c/2311-rigmapper-animation-retargeting-tool-beta-) (search summary)
- **5.8.1 hotfix:** fixed a JSON import problem that stopped RigMapper Definition graphs being created. — [5.8.1 hotfix notes](https://forums.unrealengine.com/t/5-8-1-hotfix-released/2738864) (search summary)
- **ARKitRemap's MHA → ARKit definition (UE 5.8):**
  - `RM_MHA_to_ARKit` maps "164 MHA curves in → 52 ARKit curves out".
  - It was built from Epic's `PA_MetaHuman_ARKit_Mapping` PoseAsset and the `ABP_MH_LiveLink` formulas.
  - Fit: "R² mean 0.92". Correlation per curve against real iPhone data: jaw 0.96, brows 0.94–0.96, smile 0.88, blink 0.87. Weakest curves: BrowInnerUp, dimples, RollUpper, Funnel.
  - "MHA barely tracks tongues"; "gaze-by-bone characters need their own eye-bone hookup".
  - RigMapper is "experimental since 5.7". — [ARKitRemap README](https://github.com/Dylanyz/ARKitRemap), [reference/findings.md](https://github.com/Dylanyz/ARKitRemap/blob/main/reference/findings.md)
- **Remap Curves nodes:** "Remap Curves" and "Remap Curves From Mesh" are AnimGraph nodes in the Experimental "Animation Curve Expressions" plugin. Expressions can come from a data asset, and an expressions-immutable flag improves performance. — [AnimNode_RemapCurves API](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/AnimNode_RemapCurves), [FAnimNode_RemapCurvesFromMesh](https://dev.epicgames.com/documentation/unreal-engine/API/Plugins/CurveExpression/FAnimNode_RemapCurvesFromMesh) (search summary)
- **UE 5.8 MetaHuman Animator:** now supports markerless capture (full body and face) from a single webcam, and is available in the editor on Linux and macOS as well as Windows. — [UE 5.8 announcement](https://www.unrealengine.com/news/unreal-engine-5-8-is-now-available) (search summary)
- **5.8 known issue:** Live Link Face's Android dev builds give broken face tracking on the Galaxy S25. — [MetaHuman known issues 5.8](https://dev.epicgames.com/documentation/metahuman/metahuman-known-issues-5-8-in-unreal-engine) (search summary)
- **OpenRigLogic 5.8 sample content** ships `faceboard.json`, a 2D picker GUI for the MetaHuman board with 175 controls (not a curve mapping). — [ARKitRemap reference/rigmapper.md](https://github.com/Dylanyz/ARKitRemap/blob/main/reference/rigmapper.md)

### Inferences
- **ARKit → MHR mapping by name (not verified by measurement):**
  - Each side: `eyeBlink`→`eyesClosed`, `eyeSquint`→`lidTightener`, `eyeWide`→`upperLidRaiser`. Eyes `In`/`Out`→`eyesLookLeft/Right` per side; `Up`/`Down` map directly.
  - Jaw: `jawOpen`→`jawDrop`, `jawForward`→`jawThrust`, `jawLeft/Right`→`jawSidewaysLeft/Right`.
  - Mouth: `mouthSmile`→`lipCornerPuller`, `mouthFrown`→`lipCornerDepressor`, `mouthDimple`→`dimpler`, `mouthStretch`→`lipStretcher`, `mouthPress`→`lipPressor`, `mouthLowerDown`→`lowerLipDepressor`, `mouthUpperUp`→`upperLipRaiser`, `mouthLeft/Right`→`mouthLeft/Right`.
  - Combined from MHR's left/right or quadrant shapes: `mouthPucker`→`lipPucker_L+R`, `mouthFunnel`→the four `lipFunneler` quadrants, `mouthRollLower/Upper`→`lipSuck_LB+RB` / `LT+RT`.
  - `mouthShrugLower/Upper`→`chinRaiser_B/T`.
  - Brows and cheeks: `browDown`→`browLowerer`, `browInnerUp`→`innerBrowRaiser_L+R`, `browOuterUp`→`outerBrowRaiser`, `cheekPuff`→`cheekPuff_L+R`, `cheekSquint`→`cheekRaiser`, `noseSneer`→`noseWrinkler`.
  - No MHR counterpart for `mouthClose` or `tongueOut`. MHR's extras (`cheekSuck`, `lipsToward`, `lipTightener`, `nasolabialFurrow`, `nostril*`) go unused by ARKit.
- **Recommended path for our takes:** MetaHuman Animator (webcam/video; on Linux in 5.8) → a RigMapper definition `MHA→MHR72`, authored as JSON by script (fits our "text is the truth" rule) → curves named after the morphs → Sequencer/AnimBP.
  - Quickest start: chain ARKitRemap's MHA→ARKit definition with an ARKit→MHR72 table. That caps detail at ARKit's 52 channels (fit R² 0.92).
  - Better: fit MHA→MHR72 directly. Use Multiply features as combination correctives (e.g. `jawDrop × lipFunneler`), which MHR's linear shapes lack.
- **No face board exists for MHR.** Either drive curves directly in Sequencer, or build a simple Control Rig with 72 float controls. The MetaHuman faceboard and RigLogic don't apply.
- **Eyes:** add eyeball meshes (CC0 or our own, with a wet/refraction material) skinned 100% to `l_eye`/`r_eye`, and rotate the bones from the gaze curves. Keep the `eyesLook*` shapes so the lids follow, and the `eyesClosed` shapes for blinks. Eye openings have to be cut into the shell, or the shell re-topologised, so lids can close over real eyeballs. For close-ups this is mandatory.
- **Jaw, teeth, tongue:** the jaw can be driven both by the `c_jaw` bone and by `jawDrop`; pick one primary (shape for fidelity, bone for teeth attachment). Teeth meshes go on `c_teeth`/`c_jaw` (upper/lower) and a tongue on `c_tongue0..4`. A mouth interior is needed because the template's mouth is closed.

### Gaps
- Whether `jawDrop` reveals any modelled mouth interior (an inward fold) or just stretches closed lips apart was not checked visually.
- Apple's own ARKit documentation was not fetched (search budget exhausted); the 52-name list comes from ARKitRemap.
- No measured quality figure exists for mapping MetaHuman Animator output onto MHR's 72 shapes; the R² 0.92 above is for MHA→ARKit.
- Whether RigMapper is still Experimental or now Beta in 5.8.3 is not confirmed (the roadmap says Beta; the plugin path says Experimental).

## Q5. Retargeting Kimodo SOMA motions onto MHR (IK Retargeter or offline), plus UE mannequin animations and hand/finger quality

### Takeaway
This is the easiest part of the pipeline:
- Kimodo's SOMA skeleton was designed to drive MHR: NVIDIA's SOMA-X makes MHR its default high-fidelity body and drives it "with no model-specific retargeting".
- Our desk already maps all 77 SOMA joints onto every MHR bone, sharing twist across MHR's twist joints.

The simplest reliable route is **offline**: bake Kimodo NPZ → MHR skeleton curves using the desk's mapping (twist bones included) → FBX animation on the MHR skeleton, with no IK Retargeter. That keeps Unreal identical to the storyboard.

The alternative inside Unreal is an IK Retargeter SOMA→MHR with hand-made chains. Auto-chains depend on name templates and MHR's names are non-standard. 5.8 improves foot handling, but the IK Retargeter leaves MHR's procedural twist joints to be driven separately.

Mannequin animations need an MHR IK Rig with chains, which we would generate by script as we already do for MetaHumans.

### Cited Findings
- **SOMA-X README:**
  - "maps supported identity models to shared SOMA topology and rig conventions so applications can reuse one animation, retargeting, and geometry pipeline across model families".
  - The backends table lists "Body | MHR | Default high-fidelity body backend".
  - Example: `SOMALayer(identity_model_type="mhr")` with `poses = torch.zeros(1, 77, 3)`.
  - Related projects include Kimodo and a "SOMA Retargeter (SOMA-to-Humanoid retargeting)". — [NVlabs/SOMA-X](https://github.com/NVlabs/SOMA-X)
- **SOMA paper:** unifies SOMA-Shape, MHR, SMPL-X, Anny and GarmentMeasurements; all are driven by the same SOMA skeleton in an identical pose, with no model-specific retargeting. — [arXiv 2603.16858](https://arxiv.org/abs/2603.16858) (search summary)
- **SOMA conventions:**
  - Native unit is centimetres, up axis +Y, forward axis +Z (the same as MHR).
  - The mid-LOD body has 18,056 vertices and 36,108 triangles; there are 78 full-body joints, derived from a 110-joint template with procedural twist joints.
  - Forearm and shin twist come from hand and foot twist; upper-arm and thigh twist use "reverse start/end compensation".
  - Skinning is standard LBS. — [SOMA-X docs/data_assets.md](https://github.com/NVlabs/SOMA-X/blob/main/docs/data_assets.md), [model card](https://github.com/NVlabs/SOMA-X/blob/main/docs/model_card.md)
- **`tools/rig_soma_body_mesh.py`:** "Rig a custom SOMA body template mesh and export as a UsdSkel USD file". The input must have SOMA's exact 18,056-vertex topology; weights are transferred from the template. There are reference Blender and Maya add-ons for the procedural twist. — [SOMA-X rig_soma_body_mesh.py](https://github.com/NVlabs/SOMA-X/blob/main/tools/rig_soma_body_mesh.py), [soma_procedural_blender README](https://github.com/NVlabs/SOMA-X/blob/main/tools/soma_procedural_blender/README.md)
- **Kimodo's skeletons:** `somaskel30` (30 joints, used internally by the model) and `somaskel77` (77 joints, for public exports). Models Kimodo-SOMA-RP and Kimodo-SOMA-SEED, under the NVIDIA Open Model License. — [Kimodo docs: skeleton](https://research.nvidia.com/labs/sil/projects/kimodo/docs/key_concepts/skeleton.html), [Kimodo-SOMA-SEED-v1 model card](https://huggingface.co/nvidia/Kimodo-SOMA-SEED-v1/blob/main/README.md) (search summary)
- **Our project:**
  - "Kimodo's SOMA skeleton has 77 joints (every finger, toes, jaw, eyes) and its body layer is built on MHR, so its motions fit the desk's MHR body."
  - "the desk drives every MHR bone from them: spine and neck chains, eyes, fingers and thumbs, feet and toes, with MHR's twist bones sharing out the forearm, shin, upper-arm and thigh roll (`bodies.js`)". — [docs/ANIMATION.md](../../docs/ANIMATION.md)
  - The MetaHuman retarget pipeline (NPZ → BVH → FBX on SOMA, then a generated IK Rig + IK Retargeter batch script) is described in [CLAUDE.md](../../CLAUDE.md) and ANIMATION.md §1b.
- **Unreal auto-retargeting:** "Auto Retarget Chains" matches chains to pre-configured templates by bone names. Exact matches aren't needed, but naming affects how well it works. "Auto Align" aligns retarget poses for whole skeletons or individual bones. — [Auto retargeting in UE](https://dev.epicgames.com/documentation/en-us/unreal-engine/auto-retargeting-in-unreal-engine) (search summary)
- **IKRetargeter Python API:** some properties are marked deprecated since the 5.6 refactor (the op-stack retargeter). — [IKRetargeter Python API](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/IKRetargeter) (search summary)
- **UE 5.8 retargeting:** a foot plane and toe definition on the target character, and "retarget override sets" storing ops in the retargeter asset. — [UE 5.8 release notes](https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-5-8-release-notes?lang=en-US) (search summary)
- **[measured] MHR's skeleton for retargeting:**
  - Twist joints: 5 on each upper-arm and thigh segment (`twist0..4_proc`), 4 on each forearm and shin (`twist1..4_proc`), `r/l_wrist_twist`, and 2 neck twists.
  - Four foot joints (`talocrural`, `subtalar`, `transversetarsal`, `ball`).
  - Thumb and pinky have 4 segments (`0..3`); the other fingers have 3.
  - The rest pose is an A-pose (upper arm about 48° below horizontal). — [MHR v1.0.1 release assets](https://github.com/facebookresearch/MHR/releases/tag/v1.0.1)
- **Community retarget notes:**
  - MHR's "perpendicular" bone rotations make direct rotation copying work for MHR targets. — [FBXify](https://github.com/segfaultExpress/sam-3d-body-fbxify)
  - Mapping MHR onto a simpler rig puts the largest errors at feet and shoulders, "where several MHR joints share one Rigify bone". — [mimic-blender-sam3d](https://github.com/saranunt-0/mimic-blender-sam3d)

### Inferences
- **Recommended: offline retarget**, i.e. the same mapping as `bodies.js` ported to Python in Blender's module, producing FBX animations on the MHR skeleton.
  - It needs no IK Rig and handles the twist joints, fingers and feet exactly as the storyboard shows them; the desk is the reference the Unreal build must match.
  - The existing SOMA FBX path can stay for MetaHumans.
- **Why the in-engine IK Retargeter is weaker here:** with an IK Retargeter, MHR's twist joints, extra foot joints and finger roots would stay at rest unless they are mapped or driven by twist nodes or Control Rig in the AnimBP. That adds work and drift from the desk.
- **Mannequin/Manny animations** (for generic locomotion) need an IK Rig for MHR (chains: `c_spine0-3`, neck, head, `clavicle`→`wrist`, `upleg`→`ball`, five fingers each) and a Manny→MHR retargeter. These can be generated by the same kind of script we already have for MetaHumans. MHR's A-pose rest needs a retarget-pose adjustment against Manny's rest pose.
- **The SOMA-X route** (wrap our MHR identity onto SOMA topology and rig it with `rig_soma_body_mesh.py`) would make Kimodo motions native. But it gives up MHR's topology, so the 72 face shapes and MHR's 7 LODs would have to be transferred. Not worth it while the offline MHR bake exists.
- **Hand quality:** both SOMA77 and MHR have full finger chains, so a one-to-one rotation copy should be clean. The risk is thumb-base orientation differences, which should be checked against the desk.

### Gaps
- The exact SOMA77 → MHR127 joint correspondence and SOMA's rest orientations were not re-verified here; they are in `bodies.js` and Kimodo's docs.
- The SOMA paper and the Kimodo docs pages could not be fetched (DNS); facts come from search summaries.
- No Unreal-side test of an IK Retargeter on MHR names was possible.

## Q6. Can MHR characters replace MetaHumans in Sequencer/AnimBP pipelines (LODs, performance, groom binding)?

### Takeaway
Mechanically, yes. An MHR character is an ordinary skeletal mesh that Sequencer, AnimBP, Control Rig and Kawaii Physics (UE 5.3–5.8) handle like any other:
- 127 bones, at most 4 influences per vertex
- 72 face morphs (plus optional correctives)
- 7 official LODs from about 73.6k down to about 595 vertices, with official LOD mappings

It is structurally far lighter than a MetaHuman: no RigLogic and no hundreds of face joints. But it arrives as a bare body:
- no eyes, teeth, tongue, lashes, brows or hair
- no materials (one UV set)
- no soft-tissue or hair bones for Kawaii Physics

Grooms would have to be authored and bound to each MHR head; that part was not verified.

### Cited Findings
- **LOD range:** about 595 to about 73,600 vertices, 127 joints. — [arXiv 2511.15586](https://arxiv.org/abs/2511.15586) (search summary)
- **[measured] Mesh sizes:** LOD1 has 18,439 vertices and 36,874 triangles; LOD0 has 73,639 vertices and 147,274 triangles. One UV set, no materials, 4 influences at most. The corrective file sizes per LOD are in Q3. — [MHR v1.0.1 release assets](https://github.com/facebookresearch/MHR/releases/tag/v1.0.1)
- **Official LOD mappings** from LOD1 to LODs 0 and 2–6. — [tools/mhr_LOD_conversion](https://github.com/facebookresearch/MHR/tree/main/tools/mhr_LOD_conversion)
- **MetaHuman LODs and rig evaluation:**
  - 8 LODs (0–7); "a single joint set runs across all LODs, and lower LODs reduce joint count by excluding subsets of joints".
  - "Only LOD 0 uses vertex displacement shapes".
  - RigLogic maps "hundreds of semantically meaningful channels" to joint transforms, adds per-vertex displacement at LOD0, and drives "external parameters such as wrinkle triggering through materials". — [MetaHuman DNA, Rig Definition, and Rig Operation](https://dev.epicgames.com/documentation/metahuman/metahuman-dna-rig-definition-and-rig-operation?lang=en-US) (search summary)
- **Community counts (unverified):** about 700–800 joints and about 710 FACS-driven blendshapes on a baseline LOD0 MetaHuman head, with about 24K–60K head triangles. — [Medium: MetaHuman 5.6/5.7 Pipeline Reference](https://medium.com/@Jamesroha/metahuman-5-6-5-7-pipeline-reference-170d302b078e) (search summary)
- **Kawaii Physics:** supports "Unreal Engine 5.3 ~ 5.8"; sphere, capsule and plane collisions. Its sample project uses 5.8's experimental Unreal MCP plugin and a bundled `KawaiiPhysicsToolset`. — [pafuhana1213/KawaiiPhysics](https://github.com/pafuhana1213/KawaiiPhysics)
- **[measured] No soft-tissue bones:** MHR's skeleton has no breast, belly, glute or hair bones; the full joint list is in Q1. — [MHR v1.0.1 release assets](https://github.com/facebookresearch/MHR/releases/tag/v1.0.1)
- **UE 5.8 skinning-related additions:** expanded Skeletal Editor tools (sculpting faces, correcting poses, customising MetaHumans in-engine) and Experimental Direct Mesh Controls (Control Rig controls on mesh sections). — [UE 5.8 announcement](https://www.unrealengine.com/news/unreal-engine-5-8-is-now-available), [CG Channel on UE 5.8](https://www.cgchannel.com/2026/06/see-5-key-features-for-cg-artists-in-unreal-engine-5-8/) (search summary)

### Inferences
- **Sequencer works as for any skeletal mesh:**
  - Face animation becomes curve tracks named after the morphs, or a live RigMapper node in the AnimBP.
  - Body animation is plain AnimSequences on the MHR skeleton.
  - Kimodo motions baked offline (Q5) drop straight in.
- **Performance should be far better than a MetaHuman:** 127 bones, a single mesh section and at most 72 face morphs, versus a RigLogic face (hundreds of joints, about 700 LOD0 shapes) plus a separate body and a groom.
  - No benchmark was found, so measure in our scenes (`stat anim`, `stat gpu`) before deciding.
  - The ML Deformer or Pose Driver correctives add a little CPU each.
- **Kawaii Physics on MHR needs bones added for each soft region** (breasts, belly, buttocks, hair strands), with their weights painted or transferred. This matches the soft-bones work in [docs/FLESH.md](../../docs/FLESH.md). It can be done in Blender before export, or with Unreal's Skeletal Editor.
- **Hair:** an MHR character needs its own grooms or hair cards authored to its head. MetaHuman grooms belong to the MetaHuman ecosystem, and whether they can be rebound to non-MetaHuman heads was not checked.

### Gaps
- **Groom binding** to a non-MetaHuman skeletal mesh (Groom Binding asset requirements, transferring between head topologies) could not be researched: the search budget was exhausted.
- **No measured performance comparison** between MetaHuman and a custom skeletal mesh was found.
- **MetaHuman exact joint and blendshape counts** come from one community source only.

## Q7. What do MetaHumans have that we'd lack, and which gaps matter most for close-up dialogue?

### Takeaway
For our close-ups (a CU is a face within 0.55 m of the player's eye), the gaps in order of impact:
1. **Eyes and mouth hardware:** eyeballs with wet, refractive layers; lids that close over them; lashes, tear line and eye occlusion; teeth; tongue; mouth interior. MHR has none of these.
2. **Facial deformation quality:** 72 linear sculpted shapes with no combination correctives and no face joints, versus RigLogic's hundreds of joints, about 700 LOD0 corrective shapes and combination logic.
3. **Wrinkle maps** (animated normal and colour detail) driven by expression: MHR has none.
4. **Capture integration:** MetaHuman Animator solves natively to MetaHumans. For MHR we need a RigMapper mapping (experimental) and accept some information loss.
5. **Skin and hair look:** MetaHuman skin shaders and grooms.

Body deformation is a smaller gap if we reproduce MHR's correctives (Q3). Bodies and body animation are where MHR clearly wins: Apache-2.0, shippable, shaped in our desk, Kimodo-native, light.

### Cited Findings
- **[measured] What MHR's head lacks:** no eye, teeth or tongue geometry (a single closed shell, 0 boundary edges); eye, teeth and tongue joints unskinned; gaze and blinks as surface shapes only (`eyesLookUp_L` ≤0.79 cm; `eyesClosed_L` ≤0.96 cm). — [MHR v1.0.1 release assets](https://github.com/facebookresearch/MHR/releases/tag/v1.0.1)
- **MHR's 72 expressions** are artist-sculpted, sparse, FACS-based shapes, not PCA components and not one-to-one with Action Units. — [docs/face-expressions.md](https://github.com/facebookresearch/MHR/blob/main/docs/face-expressions.md)
- **MHR combines face shapes linearly** (one `blend_shape.forward` over identity + expression coefficients). No combination or corrective shapes exist for the face; the pose correctives depend on joint rotations only. — [mhr/mhr.py](https://github.com/facebookresearch/MHR/blob/main/mhr/mhr.py), [mhr/io.py](https://github.com/facebookresearch/MHR/blob/main/mhr/io.py)
- **MetaHuman RigLogic:**
  - Hundreds of control channels drive joints, per-vertex displacement at LOD0, and wrinkle triggers through materials.
  - 8 LODs; displacement shapes only at LOD0. — [MetaHuman DNA, Rig Definition, and Rig Operation](https://dev.epicgames.com/documentation/metahuman/metahuman-dna-rig-definition-and-rig-operation?lang=en-US) (search summary)
  - About 700–800 joints and about 710 blendshapes at LOD0 (community, unverified). — [Medium pipeline reference](https://medium.com/@Jamesroha/metahuman-5-6-5-7-pipeline-reference-170d302b078e) (search summary)
- **Wrinkle maps** are driven by blendshape values and blended over the base skin texture, so wrinkle strength follows the expression. — [Realtime Avatars: MetaHuman](https://www.realtime-avatars.com/learn/metahuman) (search summary; an explainer, not Epic docs)
- **MetaHuman Animator output:** about 250 `CTRL_expressions` curves. Mapping 164 of them to ARKit's 52 reaches R² 0.92 (jaw 0.96, brows 0.94–0.96, smile 0.88, blink 0.87 against an iPhone). Tongue is barely tracked. — [ARKitRemap](https://github.com/Dylanyz/ARKitRemap), [findings.md](https://github.com/Dylanyz/ARKitRemap/blob/main/reference/findings.md)
- **UE 5.8:** MetaHuman Animator runs on Linux and from a single webcam. — [UE 5.8 announcement](https://www.unrealengine.com/news/unreal-engine-5-8-is-now-available) (search summary)
- **The project's current route** uses MHR bodies as the base for a MetaHuman mesh conform, with the fine detail done in MetaHuman Creator. — [docs/DECISIONS.md](../../docs/DECISIONS.md) (2026-10-20, "MHR instead of the basic figure")

### Inferences
- **What matters most for close-up dialogue** in a first-person horror romance: eyes (gaze contact, blinks over real eyeballs, wet highlights), lips and teeth during Japanese speech, and fine expression detail such as wrinkles and the nasolabial fold. On all of these MetaHuman is far ahead.
- **MHR's 72 shapes would look acceptable at medium distance** (MS/MCU), especially with combination correctives added through RigMapper Multiply features and a curve-driven wrinkle material.
- **The realistic split, for the user to decide by testing a shot:**
  - **MHR for bodies and non-hero or distant characters** (shippable, desk-native, Kimodo-native, cheap).
  - **MetaHuman heads (or full MetaHumans conformed to the MHR body, as the project does now) for the faces seen in close-ups.**
  - Or invest in an "MHR face kit": eyes, teeth and tongue meshes skinned to MHR's existing joints; eye openings; combination correctives; wrinkle maps; an MHA→MHR72 RigMapper definition. Then measure a CU against the MetaHuman version in the shot review.
- **Licensing:** MHR (Apache-2.0) characters can be shipped and shared. MetaHuman assets stay inside Unreal projects, per the CLAUDE.md asset rules.

### Gaps
- No side-by-side comparison of MHR's 72-shape face and a MetaHuman face in close-up exists; nothing published was found.
- MetaHuman's exact LOD0 joint and blendshape counts, and its wrinkle-map setup, were not confirmed from Epic's documentation (search budget exhausted; Epic's docs unreachable).
- The MetaHuman runtime cost (RigLogic evaluation per frame) has no published number.
