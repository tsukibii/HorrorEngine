# Fitting ready-made garments to any MHR body: the binding, the repair, the weights and the look

Research date 2026-11-11. Builds on `docs/research/mhr_pipeline/clothing.md` (2026-10-21, §2 to §4), whose engine was
Unreal; the engine is now Godot 4.7.

Re-weighted part-way by the user's steer: "I'd rather have better already-designed clothing with lots of options than
generating crappy clothing ... create an algorithm to apply that clothing to any of our models (make it fit), and allow
custom PBRs, PNG decals". So §1 and §2 are the heart and are written to be built from: the file format, the maths, the
order of steps. §3 is what follows a fit, §4 the look, §5 and §6 are short.

Network note.
- **Read at source** (shallow clones, nothing run from them; "last commit" is each repo's newest commit as cloned
  today): MakeHuman (its `proxy.py`, `base.obj`, `base.mhclo`, `a7_converter.proxy`), MPFB2, MakeClothes 2, CharMorph,
  MB-Lab, BodySlide and Outfit Studio, Humanizer (Godot), UMA, AvatarOptimizer, Modular Avatar, Blender (the Surface
  Deform, Corrective Smooth and unwrap sources on its GitHub mirror), trimesh, pycpd, probreg, libigl and its Python
  bindings, xatlas, xatlas-python, xatlas.js, UVAtlas, Boundary First Flattening, RobustSkinWeightsTransferCode,
  robust-weight-transfer, UniRig, SkinTokens, Puppeteer, PartField, Michelangelo, MagicArticulate, Make-It-Animatable,
  RigAnything, Anymate, RigNet, Dem Bones, py-dem-bones, OpenVAT, cloth-fit, HOOD, ContourCraft, DrapeNet, ISP, SNUG,
  NeuralClothSim, PBNS, VirtualBones, GAPS, UNIC, MHR, godot-vrm, wigglebone, softpin, Awesome-3D-Garments, and the
  Godot engine and docs repositories at tag `4.7.2-stable`.
- **Measured here:** MakeHuman's base mesh, by a small script of my own reading its `base.obj` as data.
- **Read on github.com by fetch:** cloth-fit's issue list and issues 6 and 7; two issue searches on the Godot repos.
- **Via search summary only:** every paper's text (arxiv.org and \*.github.io are blocked; cims.nyu.edu and
  forum.godotengine.org failed to resolve, so no further hosts were tried), Epic's, Roblox's, VRChat's and EA's pages,
  the Cyberpunk, inZOI and Paralives modding pages, Hugging Face cards and all forum posts. Those lines say "via search
  summary" and are paraphrased, not quoted.
- **The session's web-search budget ran out when the steer arrived.** What the steer added (has anyone re-bound
  MakeHuman's clothes to another body; texel-density tools) is answered from cloned sources only; where that leaves a
  hole, the Gaps say so.
- Licences were read from each repo's licence file. "Unverified" marks anything that was not.

**Verdict for this slice, ranked.** Nothing below puts a tool's own mesh or texture into a game; what ships is the
garment asset itself (which must be CC0 or the studio's) and the studio's own data.

Usable now, as the studio's own code:
1. **A one-time bridge from MakeHuman's base mesh to MHR, then every `.mhclo` garment fits every MHR body with no
   work per garment** (§1). The format is a point in the plane of three base-mesh vertices plus a distance along that
   plane's normal; MakeHuman itself ships a file of this kind that ties an older generation of its base mesh to the
   current one. JavaScript or numpy; the one-time registration can use trimesh's non-rigid ICP (MIT).
2. **A binding and repair pipeline for any other garment mesh** (§2): closest surface point plus normal distance near
   the skin (what Blender's Surface Deform stores), a soft many-vertex warp for cloth that stands off, then push-out,
   detail restoration (delta mush or ARAP), rigid parts put back rigidly, skirts re-hung with the tailor's own solver.
   JavaScript or numpy; no Blender.
3. **Robust skin-weight transfer by inpainting** (§3): MIT reference code, numpy, SciPy and libigl (MPL-2.0).
4. **Hidden skin and layering through one field on the body** (§3): MakeHuman's delete sets carried over the bridge,
   or computed by visibility; a "cover height" per garment so imported and tailor-cut garments stack in either order.
5. **A second UV in metres per island, and decals baked in the rest pose** (§4): keeps the authored seams and texture,
   puts any shelf fabric on at real size with its grain along the limb. xatlas (MIT; Python and WASM builds) when the
   mesh has no usable UVs.
6. **Godot's own spring bones and bone constraints** for what swings (§5).

Usable with work:
7. **cloth-fit** (Intersection-free Garment Retargeting, SIGGRAPH 2025; MIT, C++) when a garment comes with the rigged
   avatar it was made for. A command-line tool to build; its run time is not known here.
8. **MakeClothes 2** (MIT) as a Blender-side binding tool against a custom base, and Blender's own Surface Deform,
   Data Transfer and Minimum Stretch unwrap headless, as second opinions.
9. **Pose correctives from the tailor's own solver**, **py-dem-bones** (BSD-3) for baked takes and **OpenVAT** (GPL
   add-on, MIT Godot shader) (§5); **SkinTokens** (MIT, 14 GB) for accessories (§3).

Not usable:
- **Tied to SMPL or non-commercial:** DrapeNet, ISP, SNUG, NeuralClothSim, UNIC, RigAnything, Puppeteer's skinning
  stage (PartField), HOOD and ContourCraft as documented.
- **No licence file:** PBNS, VirtualBones, GAPS, Anymate, manifold-aware transformers.
- **No code found:** LoBoFit (2026), Dress Anyone (2026), LUIVITON, Progressive Outfit Assembly, DiffusedWrinkles.
- **Other engines or paid:** Unreal's Outfit Asset, MetaHuman resizing and Mutable; Roblox's cages; MochiFitter, Outfit
  Refit, Blender DemBones, BoneBake.
- **As code to ship:** Humanizer (AGPL-3), CharMorph and MB-Lab (AGPL character data), Blender's modifier source
  (GPL). All are good reading; the algorithms are described here from them, not copied.
- **Godot's SoftBody3D** for clothes on a skeleton.

## 1. A garment made on a known base body: MakeHuman's `.mhclo`, and carrying it to MHR

### Takeaway
An `.mhclo` line is three base-mesh vertex numbers, three barycentric weights (of the garment vertex's projection onto
those three vertices' plane) and an offset that is the remaining distance along that plane's normal, frozen as a world
vector. So if MHR can produce "where each MakeHuman base vertex would be on this body", every MakeHuman garment fits it
by a few lines of arithmetic, with its hand-made hidden-skin list and layer number for free. That needs one non-rigid
registration of MakeHuman's base mesh onto MHR's, done once. No public tool was found that does this for another body;
MakeHuman did it internally between two of its own base meshes, by the same kind of file.

### Cited Findings

#### The file, from MakeHuman's own reader
All from MakeHuman's `loadTextProxy` and `ProxyRefVert` unless another source is given —
[makehuman/shared/proxy.py](https://github.com/makehumancommunity/makehuman/blob/HEAD/makehuman/shared/proxy.py).
- **One parser for clothes and proxies.** Proxy types are `Proxymeshes`, `Clothes`, `Hair`, `Eyes`, `Eyebrows`,
  `Eyelashes`, `Teeth`, `Tongue`; the text file is `.proxy` for `Proxymeshes` (other topologies of the body itself,
  such as MPFB's `female_generic.proxy`) and `.mhclo` for everything else; a compiled `.mhpxy` cache is written beside
  it. So eyes, hair and a low-poly body are bound to the base mesh exactly as a shirt is.
- **Keys the reader acts on:** `name`, `uuid`, `description`, `author`, `license`, `homepage`, `tag`, `version`,
  `basemesh`, `obj_file` (the mesh, an OBJ), `material` (an `.mhmat`), `vertexboneweights_file` (custom bone weights),
  `z_depth`, `max_pole`, `special_pose <type> <file>` ("Special poses that should be set on the human when this proxy
  is active to make it look good"), `uvLayer`, `x_scale` / `y_scale` / `z_scale`, `shear_x|y|z` with `l_shear_*` and
  `r_shear_*`, and the sections `verts`, `weights` and `delete_verts`. Deprecated keys (`shapekey`, `subsurf`,
  `shrinkwrap`, `solidify`, `delete`, `backface_culling`, `transparent` and others) only log a warning.
- **A vertex line** is either one integer (the garment vertex sits exactly on that base vertex: weights 1, 0, 0, no
  offset) or `v0 v1 v2 w0 w1 w2 [d0 d1 d2]`: three base-mesh vertex indices, three weights, and an optional offset
  (zero if absent). Vertex lines are in the OBJ's vertex order.
- **Weights are not confined to the triangle.** MakeHuman's own `base.mhclo` has the line
  `6760 7307 7306 -0.00612 0.51970 0.48642 -0.01255 0.00487 0.01683` —
  [base.mhclo](https://github.com/makehumancommunity/makehuman/blob/HEAD/makehuman/data/3dobjs/base.mhclo)
- **Scale lines** are `x_scale <vn1> <vn2> <den>` (and y, z): two base-mesh vertices and a reference distance.
  **Shear lines** are `shear_x <vn1> <vn2> <x1> <x2>` and give a bounding box instead.
- **`delete_verts`** is a list of base-mesh vertex indices and ranges written `a - b`, stored as a boolean per base
  vertex.
- **`z_depth`** is the "Render order depth for the proxy object. Also used to determine which proxy object should mask
  others (delete faces)"; a file without one gets 50 and a warning.

What MPFB2's documentation adds —
[MPFB2 mhclo.md](https://github.com/makehumancommunity/mpfb2/blob/HEAD/docs/fileformats/mhclo.md):
- Only `obj_file` is required. A blank line or a non-numeric first word ends the `verts` or `delete_verts` section, so
  a `delete_verts` line directly after the last vertex line is swallowed; `material` and `vertexboneweights...` lines
  may appear inside the vertex block.
- MPFB writes `basemesh hm08` always and ignores the line on reading.
- **The licence is in the header and MPFB misreads it.** `# license ...` is matched by substring over the whole line:
  `by` gives CC-BY, `apgl` (a transposition) gives AGPL, anything else stays CC0, so "a correctly spelled
  `# license AGPL3` is *not* recognised and is read as CC0". The document calls both "defects rather than intent".

#### How a garment vertex is made, and how it is evaluated on a morphed body
- **How MakeClothes writes a line.** With A, B, C the three chosen base vertices (the three closest vertices of the
  matched face), N the triangle's normal and Q the clothes vertex: R is Q projected onto the triangle's plane; the
  weights are R's barycentric coordinates in ABC (solved without clamping); the offset is
  `D = Q − (wa·A + wb·B + wc·C)`, which is the part of Q along N. It is written as `[D.x, D.z, −D.y] / scale_factor`
  (Blender's Z-up to MakeHuman's Y-up). A comment in the code: the older tool "also multiplies with scales ... it
  seems the scale is always 1.0" —
  [MPFB2 vertexmatch.py](https://github.com/makehumancommunity/mpfb2/blob/HEAD/src/mpfb/entities/clothes/vertexmatch.py)
- **Which three vertices.** Four strategies in order: EXACT (a base vertex within 0.001 units), RIGID_GROUP (the
  vertex group has exactly three base vertices: "small accessories such as buttons or buckles that should scale
  uniformly with a body part"), SIMPLE_FACE (closest face of the same-named group), EXTENDED_FACE (of the 20 nearest
  faces in the group, the first within 30 degrees of the direction to the vertex). Every clothes vertex must be in
  exactly one vertex group and that group must exist on the base mesh —
  [MPFB2 vertexmatch.md](https://github.com/makehumancommunity/mpfb2/blob/HEAD/docs/entities/clothes/vertexmatch.md),
  [MPFB2 clothesservice.md](https://github.com/makehumancommunity/mpfb2/blob/HEAD/docs/services/clothesservice.md)
- **How MakeHuman evaluates it** (`Proxy.getCoords`): with `hcoord` the base mesh's rest-pose coordinates after all
  targets (morphs),

  ```
  coord = hcoord[v0]·w0 + hcoord[v1]·w1 + hcoord[v2]·w2 + M · offset
  ```

  where `M` (`TMatrix.getMatrix`) is, when scale lines exist, the diagonal matrix
  `M[n][n] = |hcoord[vn1][n] − hcoord[vn2][n]| / den` for each axis n; else, when shear lines exist, the 3 × 3 part of
  the affine map from the file's bounding box to the same box on the current body; else the identity —
  [proxy.py](https://github.com/makehumancommunity/makehuman/blob/HEAD/makehuman/shared/proxy.py)
- **The same in MPFB2:** offsets are loaded as `Vector((d0, -d2, d1))`; the fit takes the base mesh's vertex positions
  from a temporary shape key "from mix" (the body after its targets) and sets each clothes vertex to the weighted sum
  plus the offset with each component multiplied by that axis's size ratio; with no scale lines the ratio is the
  object's scale factor —
  [MPFB2 mhclo.py](https://github.com/makehumancommunity/mpfb2/blob/HEAD/src/mpfb/entities/clothes/mhclo.py),
  [MPFB2 clothesservice.py](https://github.com/makehumancommunity/mpfb2/blob/HEAD/src/mpfb/services/clothesservice.py)
- **The scale references are body regions.** MakeClothes takes the two vertices per axis from a table of regions
  (Body, Head, Teeth, Torso, Arm, Hand, Leg, Foot); for example Torso is x 3924 and 10589, y 1892 and 3946, z 1524 and
  4370. Some references are not skin vertices: Body's x pair is 13868 and 14308, beyond the skin's range —
  [MPFB2 clothesservice.py](https://github.com/makehumancommunity/mpfb2/blob/HEAD/src/mpfb/services/clothesservice.py),
  [MakeClothes 2 hm08.config](https://github.com/makehumancommunity/community-plugins-makeclothes/blob/HEAD/makeclothes/data/hm08.config)
- **The fit is done in the rest pose;** posing is by skinning afterwards (`getCoords(fit_to_posed=False)` reads
  `getRestposeCoordinates()`) —
  [proxy.py](https://github.com/makehumancommunity/makehuman/blob/HEAD/makehuman/shared/proxy.py)
- **Units.** MPFB's METER setting scales the character by 0.1 and DECIMETER by 1.0, so the files' native unit is the
  decimetre — [MPFB2 newhuman.md](https://github.com/makehumancommunity/mpfb2/blob/HEAD/docs/ui/new_human/newhuman.md)

#### What rides the same binding: weights, hidden skin, order, material
- **Bone weights:** each base vertex's weight for a bone, times the mapping weight, summed onto the clothes vertex,
  dropped below 1e-4 (MPFB: 0.001); a proxy with its own weights file uses that instead —
  [proxy.py](https://github.com/makehumancommunity/makehuman/blob/HEAD/makehuman/shared/proxy.py),
  [MPFB2 clothesservice.md](https://github.com/makehumancommunity/mpfb2/blob/HEAD/docs/services/clothesservice.md)
- **Hidden skin:** the `delete_verts` flags hide base-mesh vertices, and "only faces that have all vertices hidden will
  be hidden". MPFB applies them through "a conservative mask algorithm that excludes vertices on partially-affected
  face boundaries" — [proxy.py](https://github.com/makehumancommunity/makehuman/blob/HEAD/makehuman/shared/proxy.py),
  [MPFB2 clothesservice.md](https://github.com/makehumancommunity/mpfb2/blob/HEAD/docs/services/clothesservice.md)
- **Hidden under-layers:** `transferVertexMaskToProxy` carries a base-mesh mask onto a proxy: an exact-match vertex
  takes its base vertex's flag; any other is hidden when fewer than two of its three reference vertices are visible.
  Humanizer does this in Godot: clothes sorted by `z_depth`, highest first, each hiding what is under it —
  [proxy.py](https://github.com/makehumancommunity/makehuman/blob/HEAD/makehuman/shared/proxy.py),
  [Humanizer equipment.gd](https://github.com/NitroxNova/humanizer/blob/HEAD/addons/humanizer/scripts/services/equipment.gd)
- **Material (`.mhmat`):** key and value lines. Textures: `diffuseTexture`, `normalmapTexture`, `bumpmapTexture`,
  `roughnessmapTexture`, `metallicmapTexture`, `aomapTexture`, `opacitymapTexture` and others, paths relative to the
  file, with aliases (`albedoTexture`, `basecolorTexture`). Flags: `transparent`, `alphaToCoverage`, `backfaceCull`.
  It has its own `license` key, default CC0 —
  [MPFB2 mhmat.md](https://github.com/makehumancommunity/mpfb2/blob/HEAD/docs/fileformats/mhmat.md)
- **Licences of the code and data:** MakeHuman's code is AGPL-3, MPFB2's GPL-3; the bundled assets ("The base mesh and
  proxies ... Clothes (any MHCLO-based asset) ...") "have been released under CC0 1.0 Universal", and of output "the
  MakeHuman team makes no claim whatsoever". Community assets carry their own licence in their header —
  [MPFB2 LICENSE.md](https://github.com/makehumancommunity/mpfb2/blob/HEAD/LICENSE.md),
  [MPFB2 mhclo.md](https://github.com/makehumancommunity/mpfb2/blob/HEAD/docs/fileformats/mhclo.md)

#### MakeHuman's base mesh, as documented and as measured
- hm08 has 19,158 vertices. The skin is `body`, vertices 0 to 13379; the rest is helper geometry (ranges 13380 to
  13605 and 14598 to 19149) and joint markers (for example `joint-head` 13636 to 13643). A mirror table pairs every
  vertex with its opposite (9,402 left, 9,402 right, 354 on the mid line) —
  [MPFB2 mesh_metadata.md](https://github.com/makehumancommunity/mpfb2/blob/HEAD/docs/fileformats/mesh_metadata.md)
- Helper geometry is "internal mesh regions that are used for rigging and vertex group painting but are not meant to be
  visible", with "skirt helpers and hair helpers" named. The groups: `helper-skirt` 18002 to 18721, `helper-tights`
  15328 to 18001, `helper-hair` 18722 to 19149, eyes, lashes, teeth, tongue, genital —
  [MPFB2 importerpresets.md](https://github.com/makehumancommunity/mpfb2/blob/HEAD/docs/ui/new_human/importerpresets.md),
  [MakeClothes 2 hm08.config](https://github.com/makehumancommunity/community-plugins-makeclothes/blob/HEAD/makeclothes/data/hm08.config)
- **Measured from the file** (my script, on [base.obj](https://github.com/makehumancommunity/makehuman/blob/HEAD/makehuman/data/3dobjs/base.obj)):
  19,158 vertices, 18,486 faces, all quads, 139 groups. The skin stands 16.66 units tall (1.67 m) with the origin
  near mid-body (y from −8.17 to 8.49) and is only 9.93 units wide: the arms are down. From the joint markers, the
  upper arm points 50 degrees below horizontal, the forearm 27 degrees below horizontal and forward (the elbows are
  bent), the thigh 83 degrees below horizontal (the legs slightly apart). The skirt helper is 720 vertices, a tube from
  y 1.84 down to −7.28 (waist to about 9 cm above the floor). The tights helper is 2,674 vertices spanning nearly the
  whole body in height and width: an offset shell.

#### Has anyone carried such a binding to another body?
- **MakeHuman did, between its own base meshes.** It ships `a7_converter.proxy` ("name A7_converter", `basemesh hm08`,
  18,556 lines, `obj_file a7_converter.obj`): by its name and header, an older base mesh (alpha 7) written as a proxy
  of hm08. Its `base.mhclo` (`basemesh alpha_7`, `obj_file base.obj`) reads as the reverse, the current base mesh
  written as a proxy of the older one. `proxy.py` still declares `_A7converter = None` but no longer uses it, so how
  the converter was applied is not in today's code —
  [a7_converter.proxy](https://github.com/makehumancommunity/makehuman/blob/HEAD/makehuman/data/3dobjs/a7_converter.proxy),
  [base.mhclo](https://github.com/makehumancommunity/makehuman/blob/HEAD/makehuman/data/3dobjs/base.mhclo),
  [proxy.py](https://github.com/makehumancommunity/makehuman/blob/HEAD/makehuman/shared/proxy.py)
- **MakeHuman II has a second base mesh, and clothes are made again for it.** MakeClothes 2 (MIT, last commit
  2026-05-18, tested with Blender 4.5 LTS) "should be used for MakeHuman Version 2, especially for non-hm08 meshes";
  its data folder holds `hm08.config` and `mh2bot.config` ("MakeHuman2 Bot mesh"); the workflow for "a different mesh
  (custom base)" needs "a config-file for that mesh ... used for dimensions" and then "Create clothes". No converter
  from one base to another is described —
  [MakeClothes 2 README](https://github.com/makehumancommunity/community-plugins-makeclothes/blob/HEAD/README.md),
  [mh2bot.config](https://github.com/makehumancommunity/community-plugins-makeclothes/blob/HEAD/makeclothes/data/mh2bot.config)
- **Meta bridges body topologies the same way.** MHR's own tool for converting to and from SMPL "uses barycentric
  interpolation for topology mapping" and then fits parameters —
  [MHR, mhr_smpl_conversion](https://github.com/facebookresearch/MHR/blob/HEAD/tools/mhr_smpl_conversion/README.md)
- **MB-Lab and CharMorph do not read MakeHuman bindings;** each fits any mesh to its own characters by proximity at
  fit time (§2). MB-Lab ties a garment to a template family by its name (`anime_female`, `human_male` ...) and warns
  on a mismatch; it also has a `reverse` fit, from a morphed character back to the template —
  [MB-Lab proxyengine.py](https://github.com/animate1978/MB-Lab/blob/HEAD/proxyengine.py)
- **Humanizer keeps MakeHuman's mesh:** it is the whole MakeHuman clothing model in GDScript for Godot 4.3, on hm08,
  AGPL-3.0, last commit 2025-11-07 — [Humanizer README](https://github.com/NitroxNova/humanizer/blob/HEAD/README.md),
  [LICENSE](https://github.com/NitroxNova/humanizer/blob/HEAD/LICENSE)

#### What went wrong for others, as their own sources show it
- **Weights leaking across the mid line.** MPFB has a per-asset flag `fix_leftright_weights_for_groups` that "strips
  weights which assign a vertex on one side of the mesh to a vertex group belonging to the other side"; the file
  listing which assets need it "is the remainder of an experiment which was not really finished" —
  [MPFB2 mesh_metadata.md](https://github.com/makehumancommunity/mpfb2/blob/HEAD/docs/fileformats/mesh_metadata.md)
- **Shoes with heels need the body posed** (`special_pose`), and some garments need their own weights
  (`vertexboneweights_file`) — [proxy.py](https://github.com/makehumancommunity/makehuman/blob/HEAD/makehuman/shared/proxy.py)
- **One binding did not serve every asset in CharMorph.** An asset can carry a `fold` (a coarse stand-in mesh that is
  bound to the body in the garment's place, with weights from it to the garment), a `morph` applied to the *body*
  before binding, and its own `mask`; a character has a `fitting_subset` of vertices and faces allowed in the binding;
  and the user picks a soft or a hard binder —
  [CharMorph charlib.py](https://github.com/Upliner/CharMorph/blob/HEAD/lib/charlib.py),
  [CharMorph fit_calc.py](https://github.com/Upliner/CharMorph/blob/HEAD/lib/fit_calc.py)
- **MB-Lab needed three passes and a clean-up:** a bounding-box scale for everything, a per-triangle transform for
  vertices near the skin, a push-off along the normals of the ten nearest body faces, then a smoothing "finishing
  morph" — [MB-Lab proxyengine.py](https://github.com/animate1978/MB-Lab/blob/HEAD/proxyengine.py)
- **Loose clothes.** The Daz importer's developer reports that morph transfer usually works for tight clothing and can
  leave artefacts on loose-fitting clothes — [Diffeomorphic wiki](https://bitbucket.org/Diffeomorphic/import_daz/wiki/Setup/Morphs/Transfer%20Shapekeys)
  (via search summary). Epic reports resizing problems where the body clips at the armpits or the thigh gap —
  [Creating Your MetaHuman Characters](https://dev.epicgames.com/documentation/metahuman/creating-your-metahuman-characters?lang=en-US)
  (via the earlier note's search summary)

### Inferences

**The whole idea in one line:** make MHR able to answer "where would MakeHuman base vertex i be on this body?" for
all 19,158 vertices. Call that the virtual base, `V(body)`. Then MakeHuman's own formula runs on `V` and every garment
in the format works on every MHR body, including its skirt helper, its hidden-skin list and its layer number.

**A. Build the bridge, once** (numpy on the Python server; the result is a small data file).
1. *Units and frame.* Multiply `base.obj` by 0.1 (decimetres to metres) and put its lowest skin vertex on the floor.
2. *Pose.* The two rest poses differ (hm08's arms 50 degrees down with bent elbows, measured above). Pose MHR by its
   own skinning so its shoulder, elbow, hip and knee directions match hm08's joint markers. The Character Studio
   already poses MHR this way for its T-pose view (`pose.js`).
3. *Landmarks.* Pick 40 to 60 pairs of vertex ids once (nose tip, chin, ears, shoulder tops, armpits front and back,
   nipples, navel, crotch, elbow and knee points, wrists, knuckles, fingertips, ankles, heels, toes). Both meshes have
   fixed topology, so the two lists never change.
4. *Non-rigid registration.* Deform hm08's skin (vertices 0 to 13379) onto posed MHR: trimesh's `nricp_amberg` takes a
   source mesh, a target, landmarks as vertex ids or (triangle, barycentric) pairs, and a schedule of stiffness steps
   (§2). Fingers and toes are where this fails; weight their landmarks high or leave them out (only gloves bind there).
5. *Project.* For each hm08 skin vertex store the MHR triangle under it and its barycentric coordinates.
6. *Helpers and joint markers.* They are off the surface. Move them by the same deformation (the registration's
   displacement of the skin, spread to them by the soft warp of §2), then store, per helper vertex, an MHR triangle,
   barycentrics and a signed distance along the normal. For the skirt helper prefer a rule over a binding: each of its
   720 vertices has a height between waist and hem and an angle round the body, which is exactly how the tailor builds
   its skirt rings (the convex outline of the legs every 4 cm, TAILOR §3c). Regenerating the helper from those rings on
   each body avoids binding anything across the gap between the legs.
7. *The inverse map.* For each MHR vertex store the registered hm08 face it lies on, with barycentrics. This carries
   `delete_verts` to MHR: an MHR vertex is hidden when at least two of the three hm08 corners round it are (MakeHuman's
   own rule), and the tailor's export already drops only triangles whose three corners are hidden.
8. *Evaluate.* `V(body)` is then: for each hm08 vertex, the barycentric point on the MHR triangle of *that body in
   its rest pose*, plus the stored normal distance times that triangle's normal. Identity sliders and the sculpt only
   move MHR's vertices, so nothing else is needed.

**B. Import one MakeHuman garment** (automatic, JavaScript; no Blender).
1. Parse the `.mhclo` (rules above), its OBJ (topology, UVs) and its `.mhmat`. Read the licence from the header
   yourself and refuse anything but CC0 (MPFB's parser reads a correctly spelled AGPL as CC0).
2. Turn each offset into a number that survives a change of pose. On the unmorphed hm08, with A, B, C the three
   reference vertices: `a0 = wa·A + wb·B + wc·C`, `n0 = normalize((B − A) × (C − A))`, `M0` the file's scale matrix on
   that mesh, and `d = (M0·offset) · n0`. By MakeClothes' construction the offset is all normal, so `d` is the garment's
   distance from the plane of ABC. The three references are in no particular winding, so `n0` may point inward; that
   is harmless as long as the same order A, B, C is used on every body, because `d` carries the sign. Keep the
   tangential remainder `M0·offset − d·n0` only if it is not near zero (hand written or legacy files), expressed along
   `B − A` and `n0 × (B − A)`. A one-integer line has no offset: the vertex is `V` of that base vertex.
3. On any body: `g = wa·VA + wb·VB + wc·VC + s·d·n`, with `VA, VB, VC` from `V(body)`,
   `n = normalize((VB − VA) × (VC − VA))` and `s` a scale. `s = 1` keeps the garment's distance from the skin in
   millimetres (Surface Deform's choice); MakeHuman's own behaviour is `s` = the body region's size ratio. A sensible
   rule: `s = 1` where `|d|` is under about 1 cm (ease and thickness), the region's ratio beyond (a loose garment
   stays as loose in proportion). To be tuned on the check bodies.
4. Skirts and anything else bound to a helper need no special case: their three reference vertices are helper
   vertices, which `V(body)` provides.
5. Weights: MakeHuman's rule works unchanged with MHR's weights read at the bridge points; for helper-bound vertices
   use the inpainting transfer of §3 instead.
6. Hidden skin from `delete_verts` through the inverse map; the layer number from `z_depth`.
7. A unit test that needs no eyes: on the unmorphed hm08 the formula must reproduce the garment's own OBJ vertices
   (to rounding, for assets made on the default body).

**Why this and not a re-bind of each garment to MHR's surface.** Both work. The two-stage form keeps what the
garment's author decided (which body region each vertex follows, what is rigid, what hangs from the helper) and costs
nothing per garment. A direct re-bind (§2's binding, applied to the garment once it stands on neutral MHR) makes the
asset independent of the bridge; it is the fallback for a vertex whose three references form a sliver.

**What will go wrong, predicted from the above:** the registration at the fingers, toes, ears and armpits (inspect it
once, by eye, on a contact sheet); garments authored for a heel (`special_pose`: MHR's foot must be posed or the shoe
refused); references to helper vertices that were registered badly; bodies outside anything MakeHuman's targets reach
(a strong sculpt), where the garment will need §2's repair; and assets whose header is not CC0.

**Effort (estimate):** the bridge two to four days including the landmark lists and its checks; the importer one to
two days; the skirt-helper rule a day.

### Gaps
- No search could be run on whether anyone has re-bound MakeHuman's clothes to another body (CharMorph, MB-Lab,
  Rigify bases, Unreal's mannequins); the budget was spent. The repositories read show no such converter, and
  MakeHuman II's answer for a new base mesh is to make the clothes again.
- The asset repositories themselves (`makehuman-assets`, MakeHuman II) could not be cloned under the names tried, so
  how many community garments use shear lines, custom weights or `special_pose` is not known. MakeHuman's code
  repository holds only three `.mhclo` files.
- How hm08's weights for the skirt helper are painted (which the bridge could copy as a starting point) was not read.
- MHR's rest pose was not measured here against hm08's; the studio's own files have it.

## 2. An arbitrary garment mesh: the pipeline, with the maths

### Takeaway
There is no free tool that takes any garment and any body and fits one to the other unaided. What works is a short
pipeline of old, simple parts that the studio can write itself: bring the garment onto neutral MHR (by its source body
if it has one, by hand if not), bind it (closest point plus normal distance near the skin, a smooth many-vertex warp
away from it), evaluate the binding on each body, then repair (push out, restore detail, put rigid parts back, re-hang
what hangs). Blender's Surface Deform is the first half of that binding; MB-Lab, CharMorph and Outfit Studio are the
second half; none does the repair well, which is where the tailor's own cloth solver gives the studio an edge.

### Cited Findings

#### What Blender's Surface Deform does, exactly
All from the modifier's source (GPL-2.0-or-later; read on Blender's GitHub mirror, last commit 2026-11-11) —
[MOD_surfacedeform.cc](https://github.com/blender/blender/blob/HEAD/source/blender/modifiers/intern/MOD_surfacedeform.cc).
- **Bind.** For each vertex of the garment it finds the nearest *vertex* of the target, takes every target face round
  that vertex, and gives each face a weight built from angular terms and distance terms raised to the `falloff`
  exponent. Per face it stores one of three records: an n-gon record when the point projects inside the face
  (mean-value style weights over the face's corners), else a centroid record (barycentric weights on two face
  vertices and the face's centroid) and/or a corner-triangle record (barycentric weights on three corners). Each
  record keeps the vertex indices, the weights, an `influence`, and one scalar, `normal_dist`: the signed distance from
  the point to its projection along the face normal.
- **Deform.** For each record it rebuilds the point from the target's current vertices with the stored weights, adds
  the current face normal times `normal_dist`, and sums the records by influence. The vertex moves by the difference
  from its original position, times the modifier's strength and an optional vertex-group weight.
- **Limits.** The comment on its edge table: "Polygons per edge (only 2, any more will exit calculation)"; binding
  can be restricted to a vertex group ("sparse bind"). The manual adds that the target may not have concave faces,
  overlapping vertices or faces with collinear edges —
  [Surface Deform, Blender manual](https://docs.blender.org/manual/en/latest/modeling/modifiers/deform/surface_deform.html)
  (via the earlier note's search summary)
- So: the distance from the skin is kept in absolute units, the offset turns with the surface, and each garment
  vertex depends only on the faces round one target vertex.

#### The other free binders
- **CharMorph** (code GPL-3; MB-Lab characters AGPL-3, and "the AGPL will propagate ... to the output models"; last
  commit 2024-10-10). Soft binding: each asset vertex to the 16 nearest character vertices with weight
  (1 − d/d_max)/d, to the vertices of character faces within 0.75 of the nearest distance, and by a reverse pass from
  character vertices onto asset faces within 0.125 units; weights under 1/32 of the largest are cut. The fitted asset
  is its own vertices plus the bound average of the character's morph *displacement* —
  [CharMorph fit_calc.py](https://github.com/Upliner/CharMorph/blob/HEAD/lib/fit_calc.py),
  [CharMorph fitting.py](https://github.com/Upliner/CharMorph/blob/HEAD/lib/fitting.py),
  [license.txt](https://github.com/Upliner/CharMorph/blob/HEAD/license.txt)
- **MB-Lab** (code GPL-3, data AGPL-3; last commit 2024-06-08). Every vertex is first scaled about the body's centre by
  the ratio of two bounding boxes (the body faces nearest the garment, before and after). Then each vertex within a
  threshold of a body face (default 0.5 units in `fit_proxy_object`; if the nearest face looks the wrong way, the
  nearest of 25 that does not) is moved by `barycentric_transform` between that face's three closest corners before
  and after, blended by a factor that falls linearly to zero at twice the threshold; mid-line vertices are kept on
  the mid line. Weights: every body vertex within twice the nearest distance, weighted by nearest distance over
  distance — [MB-Lab proxyengine.py](https://github.com/animate1978/MB-Lab/blob/HEAD/proxyengine.py),
  [license.txt](https://github.com/animate1978/MB-Lab/blob/HEAD/license.txt)
- **Outfit Studio** (GPL-3, last commit 2026-11-09; builds on Linux). Each outfit vertex takes the
  inverse-distance-weighted average of the slider deltas of up to 10 reference vertices within a radius of 10 units,
  with options to smooth the deltas, "no squeeze", "solid mode" and "fix clipping" —
  [ConformOptions.h](https://github.com/ousnius/BodySlide-and-Outfit-Studio/blob/HEAD/src/components/ConformOptions.h),
  [Automorph.cpp](https://github.com/ousnius/BodySlide-and-Outfit-Studio/blob/HEAD/src/components/Automorph.cpp)

#### Registering one body onto another, with code that can be called
- **trimesh** (MIT, last commit 2026-10-23) has `procrustes`, `icp`, and two non-rigid registrations. `nricp_amberg`
  is an "Implementation of 'Amberg et al. 2007: Optimal Step Nonrigid ICP Algorithms for Surface Registration'"; it
  takes `source_landmarks` as vertex indices or as triangle indices with barycentric coordinates, `target_positions`,
  and `steps` of (smoothness, landmark weight, normal weight, iterations). `nricp_sumner` implements the
  correspondence part of Sumner and Popović's deformation transfer. Its own comparison: Amberg "fits to the target
  mesh in less steps" and "can generate sharp edges"; Sumner "tend[s] to preserve more the original shape" and its
  "parameters are easier to tune" — [trimesh registration.py](https://github.com/mikedh/trimesh/blob/HEAD/trimesh/registration.py),
  [LICENSE.md](https://github.com/mikedh/trimesh/blob/HEAD/LICENSE.md)
- Point-set registration libraries also exist under MIT: pycpd (coherent point drift, last commit 2022-12-15) and
  probreg (last commit 2026-07-22). Only their licences and dates were read —
  [pycpd](https://github.com/siavashk/pycpd), [probreg](https://github.com/neka-nat/probreg)
- **libigl's Python bindings** (`pip install libigl`; classified "Mozilla Public License 2.0"; its headers are MPL-2.0;
  the `igl.copyleft` modules are the GPL part) include `arap`, `lscm`, `slim`, `harmonic`, `biharmonic_coordinates`,
  `bbw`, `min_quad_with_fixed`, `point_mesh_squared_distance`, `signed_distance` and `fast_winding_number`; wheels are
  also built for Pyodide (Python in the browser) —
  [pyproject.toml](https://github.com/libigl/libigl-python-bindings/blob/HEAD/pyproject.toml),
  [bindings source](https://github.com/libigl/libigl-python-bindings/tree/HEAD/src),
  [README](https://github.com/libigl/libigl-python-bindings/blob/HEAD/README.md),
  [cotmatrix.h](https://github.com/libigl/libigl/blob/HEAD/include/igl/cotmatrix.h)

#### What a commercial system does (reference points, none usable here)
- **Unreal's Outfit Asset and MetaHuman clothing** warp a garment by the difference between a source body and a target
  body with RBF interpolation over about 1000 to 2500 points (default 1500), pick the nearest of several authored
  sizes, advise more than one source body because warping degrades when shapes differ a lot, and in 5.6 replace custom
  skinning with a simple weight transfer on resize —
  [Create a MetaHuman Parametric Outfit Asset](https://dev.epicgames.com/documentation/metahuman/create-a-metahuman-parametric-outfit-asset?lang=en-US),
  [Getting Started with Parametric Clothing](https://dev.epicgames.com/documentation/unreal-engine/getting-started-with-parametric-clothing?lang=en-US)
  (via search summaries, the earlier note's and today's; no 5.7 change to the limit was found)
- **Roblox layered clothing** fits by cages: a garment has an inner and an outer cage, a body an outer one; cage
  vertices are matched by UV and the render mesh follows its cage; it works on any avatar only because every body and
  garment is authored against Roblox's cage templates —
  [Roblox, Cage meshes](https://create.roblox.com/docs/en-us/art/modeling/cage-meshes.md),
  [Roblox, Create cages](https://create.roblox.com/docs/art/modeling/cage-meshes/create-cages) (via search summary)
- **Paid tools seen, not free:** MochiFitter (outfit retargeting between VRChat avatars, with per-avatar profiles sold
  on Booth: [example](https://booth.pm/en/items/8508518)) and Outfit Refit (a Blender add-on sold on Superhive:
  [listing](https://superhivemarket.com/products/outfit-refit?search_id=50361077)) (via search summary)

#### 2024 to 2026 research: one usable release
The list of recent work comes from a curated index, last commit 2026-11-03 —
[Awesome-3D-Garments, "Garment Retargetting"](https://github.com/Shanthika/Awesome-3D-Garments).

**cloth-fit: Intersection-free Garment Retargeting** (Huang, Araújo, Kunz, Zorin, Panozzo, Zordan; NYU and Roblox;
SIGGRAPH 2025 Conference Papers, Article 44 — [ACM](https://dl.acm.org/doi/abs/10.1145/3721238.3730590), via search
summary).
- Repo and state: [Huangzizhou/cloth-fit](https://github.com/Huangzizhou/cloth-fit), last commit 2025-08-19; "the
  opensource reference implementation", built on PolyFEM. Four issues, all closed; two are outsiders asking how to
  prepare their own avatar — [issue list](https://github.com/Huangzizhou/cloth-fit/issues?q=is%3Aissue)
- Licence: **MIT** — [LICENSE](https://github.com/Huangzizhou/cloth-fit/blob/HEAD/LICENSE). There are no trained
  weights: it optimises the garment's mesh directly, per the paper's summary —
  [project page](https://huangzizhou.github.io/research/cloth.html) (via search summary). The licence of the example
  avatars and garments in `garment-data/` is not stated (unverified).
- Inputs: the target avatar as an OBJ of "one or multiple closed surfaces" (turned into a signed distance field with
  OpenVDB); the garment as "a connected manifold triangular mesh" OBJ; a source and a target skeleton, each an OBJ whose
  vertices are joints and edges bones, with identical connectivity and joint order; optionally the avatar's skin
  weights; optionally a "no-fit" list of garment vertices that should not fit tightly; an `is_skirt` flag that "will
  insert an extra skeleton bone in the middle of two legs" —
  [README](https://github.com/Huangzizhou/cloth-fit/blob/HEAD/README.md),
  [input-spec.json](https://github.com/Huangzizhou/cloth-fit/blob/HEAD/json-specs/input-spec.json)
- Outputs: an OBJ per optimisation step of the garment; the same mesh, moved —
  [README](https://github.com/Huangzizhou/cloth-fit/blob/HEAD/README.md)
- Method: the avatar is projected to its skeleton, inflated inside the garment, then the garment is shrunk onto it,
  with terms that keep the surface's shape, the curvature, torsion and position of its curve loops (hem, collar, cuff)
  and a contact barrier; the paper's summary says it avoids intersections with the avatar, between garments and within
  a garment, so layers can be retargeted — [README](https://github.com/Huangzizhou/cloth-fit/blob/HEAD/README.md),
  [project page](https://huangzizhou.github.io/research/cloth.html) (the second via search summary)
- Hand work, from the author: the skeleton OBJ is not something Blender exports ("Python probably can"); the method
  only works between avatars with "the same skeleton topology"; `no-fit.txt` "was generated manually" by selecting
  faces in Blender; without it a small fit weight "wouldn't be too bad in most cases, like T-shirts, jackets, and
  pants" but is "more problematic when the garment is floating 'far' from the body, like a wedding dress" —
  [issue 6](https://github.com/Huangzizhou/cloth-fit/issues/6), [issue 7](https://github.com/Huangzizhou/cloth-fit/issues/7)
- Hardware and install: CPU (the example runs with `--max_threads 16`; a Newton solver with up to 5000 iterations and
  continuous collision detection); CMake, "gcc 7 or later", dependencies fetched by CMake (PolyFEM's solvers, IPC
  Toolkit, libigl, OpenVDB, oneTBB) — [README](https://github.com/Huangzizhou/cloth-fit/blob/HEAD/README.md),
  [Goblin_Jacket/setup.json](https://github.com/Huangzizhou/cloth-fit/blob/HEAD/garment-data/Goblin_Jacket/setup.json),
  [cmake/recipes](https://github.com/Huangzizhou/cloth-fit/tree/HEAD/cmake/recipes)

**Released, but tied to SMPL or with a licence problem:**
- **ContourCraft** (SIGGRAPH 2024; [repo](https://github.com/Dolorousrtur/ContourCraft), last commit 2025-08-02) and
  **HOOD** ([repo](https://github.com/Dolorousrtur/HOOD), last commit 2025-05-20): code **MIT**. ContourCraft lists an
  "Automatic untangling procedure to combine unrelated garments into outfits", run "from the innermost to the
  outermost". But a new garment must be an OBJ "aligned with the canonical body model" and "We currently support SMPL
  and SMPL-X body models"; the install has the user download SMPL-X or SMPL. No licence is stated for the checkpoints
  (unverified) — [README](https://github.com/Dolorousrtur/ContourCraft/blob/HEAD/README.md),
  [GarmentImport.ipynb](https://github.com/Dolorousrtur/ContourCraft/blob/HEAD/GarmentImport.ipynb),
  [Untanglement.ipynb](https://github.com/Dolorousrtur/ContourCraft/blob/HEAD/Untanglement.ipynb),
  [INSTALL.md](https://github.com/Dolorousrtur/ContourCraft/blob/HEAD/INSTALL.md)
- **DrapeNet** (CVPR 2023): GPL-3, needs an SMPL model file; last commit 2023-09-06 —
  [README](https://github.com/liren2515/DrapeNet/blob/HEAD/README.md). **ISP** (NeurIPS 2023): no licence file, needs
  SMPL model files; last commit 2025-04-24 — [README](https://github.com/liren2515/ISP/blob/HEAD/README.md).
  **PBNS** (ACM TOG 2021) has a resizer ("retargetting to the desired body shape and control over tightness") for "any
  3D custom avatar", but no licence file — [README](https://github.com/hbertiche/PBNS/blob/HEAD/README.md)

**Papers with no code found** (all via search summary; none turned up, which is not proof that none exists):
- **LoBoFit** (arXiv 2605.07450, May 2026; listed as SIGGRAPH 2026 by the curated index, not confirmed by the arXiv
  entry): garment geometry as a blend of its mappings into local bone frames — [arXiv](https://arxiv.org/abs/2605.07450)
- **Dress Anyone** (CGF 2026 per the index; earlier "Dress-Me-Up", arXiv 2401.03108): self-supervised retargeting of
  non-parametric garments onto avatars of arbitrary shape and pose; its authors said they planned to release code and
  a dataset of 255 garments — [arXiv](https://arxiv.org/abs/2401.03108v1), [project page](https://shanthika.github.io/projects/dressmeup)
- **LUIVITON** (arXiv 2509.05030, 2025): arbitrary garments onto stylised humanoids, through SMPL as a proxy —
  [arXiv](https://arxiv.org/html/2509.05030)
- **Progressive Outfit Assembly and Instantaneous Pose Transfer** (SIGGRAPH Asia 2025): untangles multilayer outfits
  on midsurfaces — [author's page](https://wanghmin.github.io/publication/guo-2025-poa)

#### Free code and tools for the repair
- **Outfit Studio's ClippingFixer** "inflates the body surface outward and smoothly displaces nearby outfit vertices
  along the interpolated body normal, preserving outfit detail" (strength 0 to 1), and separately finds body vertices
  that poke out between outfit vertices, "where large outfit triangles span a curve of the body while every outfit
  vertex stays outside it" —
  [ClippingFixer.h](https://github.com/ousnius/BodySlide-and-Outfit-Studio/blob/HEAD/src/components/ClippingFixer.h)
- **Blender's Corrective Smooth** is, by its own header, a "Method of smoothing deformation, also known as
  'delta-mush'"; Blender also has a Laplacian Deform modifier —
  [MOD_correctivesmooth.cc](https://github.com/blender/blender/blob/HEAD/source/blender/modifiers/intern/MOD_correctivesmooth.cc),
  [MOD_laplaciandeform.cc](https://github.com/blender/blender/blob/HEAD/source/blender/modifiers/intern/MOD_laplaciandeform.cc)
- **Rigid parts at bind time:** MakeClothes binds a whole part to three vertices when its group has exactly three
  ("buttons or buckles that should scale uniformly with a body part") —
  [MPFB2 vertexmatch.md](https://github.com/makehumancommunity/mpfb2/blob/HEAD/docs/entities/clothes/vertexmatch.md)
- **Skirts:** MakeHuman binds them to a helper tube, not to the legs (§1); cloth-fit adds a bone between the legs and
  holds the hem's loop in place —
  [input-spec.json](https://github.com/Huangzizhou/cloth-fit/blob/HEAD/json-specs/input-spec.json)

### Inferences

**The pipeline.** Steps 1 to 3 happen once per garment and end with the garment standing on neutral MHR; steps 4 to 6
run for every body and are automatic.

**1. Clean and place.** Weld vertices that share a position (keep UV seams as render-time splits), triangulate, drop
degenerate triangles, list connected components and open boundary loops (a garment's loops are its openings: neck,
cuffs, hem, waist). Fix units and axes. Then, by what came with the garment:
- *Its source body, rigged or not.* Register that body onto MHR as in §1.A (pose, landmarks, non-rigid ICP). That gives
  every source-body vertex `c_j` a displacement `u_j` onto MHR. Carry the garment along in one of two ways:
  - *Surface style:* bind the garment to the source body (step 3's binding) and evaluate the binding on the
    registered body. Exact where the cloth is close to the skin.
  - *RBF style* (what Unreal does, with 1000 to 2500 points): pick N centres on the body by farthest-point sampling
    and find a smooth field `u(x) = Σ_j λ_j·φ(|x − c_j|) + A·x + b` that takes the value `u_j` at each centre, with
    `φ(r) = r` (the biharmonic kernel in 3D). The unknowns `λ` (N × 3), `A` (3 × 3) and `b` solve the linear system
    `[Φ P; Pᵀ 0]·[λ; A, b] = [u; 0]`, where `Φ_ij = φ(|c_i − c_j|)` and row i of `P` is `(c_i, 1)`; a dense solve
    of size N + 4, about a second in numpy for N = 1500 (estimate). Then every garment vertex moves by `u(x)`.
    Smooth everywhere, so it suits skirts, hoods and accessories, and it needs no binding.
  - A cage (Roblox's way, Blender's Mesh Deform) needs someone to model the cage; skip it.
  Use the RBF for the whole garment first, then step 3 from where it lands.
- *A skeleton and skin weights but no body* (a game-ready outfit for an avatar that is sold separately). Re-pose in
  bone space: for each garment vertex, `x' = Σ_b w_b · T_b(MHR) · T_b(source)⁻¹ · x`, with `T_b` the rest frame of bone
  b after the two skeletons' bones are matched by name, each scaled along its length to MHR's bone length. This is the
  premise of cloth-fit (a skeleton pair of one topology) and of LoBoFit (geometry as a blend of bone-frame mappings).
  Then shrink it onto the body (below).
- *Nothing* (a hand-modelled or generated mesh). A similarity transform from landmarks: with points `x_i` on the
  garment (centres of its loops, shoulder points) and `y_i` on MHR (neck base, wrists, waist), minimise
  `Σ |s·R·x_i + t − y_i|²`. Closed form: centre both sets, `H = Σ (x_i − x̄)(y_i − ȳ)ᵀ = U·S·Vᵀ`,
  `D = diag(1, 1, det(V·Uᵀ))`, `R = V·D·Uᵀ`, `s = trace(S·D) / Σ |x_i − x̄|²`, `t = ȳ − s·R·x̄` (trimesh has it as
  `procrustes`). Then the user nudges it with a gizmo, and it is shrunk onto the body.

**2. Shrink onto the body where it was meant to be close.** After a rough placement the garment floats or cuts
through. Run the tailor's XPBD with: the garment's own edge lengths and bending as the cloth, the body's distance
field as the collider at the minimum ease, and a weak pull toward the offset surface for the vertices marked "fitted"
(those that were within a threshold of the source body; else the user paints them, as cloth-fit's `no-fit` list in
reverse). This is the same optimisation cloth-fit solves with guarantees, done with the solver the studio has.

**3. Bind to neutral MHR.** For garment vertex `g`:
- *Closest point with a normal test.* Find the closest point `p` on the body: triangle `(i, j, k)`, barycentrics `β`,
  distance `d = |g − p|`. Reject triangles whose normal is more than about 30 to 60 degrees from `g − p` (MakeClothes
  and the weight transfer both use 30) and triangles of a different body region from the garment vertex's neighbours
  (MakeClothes' vertex groups do this by hand; MHR's segmentation can do it automatically). This is what stops a
  sleeve binding to the ribs and a skirt to the wrong thigh.
- *Near the skin* (`d` under `d0`, about 1.5 cm): store the triangle, `β`, and the offset `g − p` in a frame that
  rides the surface: `n = normalize(β_i·N_i + β_j·N_j + β_k·N_k)` (the interpolated vertex normal),
  `t = normalize(e − (e·n)·n)` with `e` the triangle's first edge, and `b = n × t`; the three numbers are
  `o = (t·(g − p), b·(g − p), n·(g − p))`, of which the last, the distance from the skin, carries almost everything.
  Evaluate as `g' = p' + o_1·t' + o_2·b' + o_3·n'` on the new body. This is Surface Deform's record with one face
  instead of a fan; using smooth vertex normals gives the continuity its fan of faces is there to provide.
- *Standing off* (`d` over `d1`, about 5 cm): a moving-least-squares warp. Gather the body vertices `P_m` within a
  radius of a few times `d` (MB-Lab uses twice the nearest distance), with weights `ω_m = 1 / (|P0_m − g|² + ε)`
  measured on the neutral body. Their weighted centroid is `c0` on the neutral body and `c` on the new one. Find the
  rotation and uniform scale that best map one neighbourhood onto the other:
  `H = Σ ω_m (P0_m − c0)(P_m − c)ᵀ = U·S·Vᵀ`, `D = diag(1, 1, det(V·Uᵀ))`, `R = V·D·Uᵀ`,
  `s = trace(S·D) / Σ ω_m |P0_m − c0|²`. Then `g' = c + s·R·(g − c0)`. Only the list of neighbours and their weights
  is stored. MB-Lab's first pass is this with one neighbourhood for the whole garment; Outfit Studio's and
  CharMorph's are this without the rotation; Unreal's RBF is the global, smoother version.
- *Between:* blend the two results with `smoothstep(d0, d1, d)`.
- *What hangs* (a skirt, a coat's skirts, wide trouser legs below the knee): bind only the top (waistband, yoke,
  shoulders) and mark the rest free; step 6 re-hangs it. The mark can be automatic: everything below the lowest loop
  that lies within `d0` of the body.

**4. Evaluate on the body** (identity plus sculpt, rest pose): the two formulas above. Milliseconds.

**5. Repair.**
- *Push out.* With `φ_v` the signed distance of garment vertex v from the body (and from the layers under it, §3) and
  `e` the minimum ease (the tailor uses 2.5 mm): the raw correction is `c_v = max(0, e − φ_v)` along the body's normal
  there. Applied raw it dents the cloth, so spread it first: solve `(I + λ·L)·δ = c` on the garment's mesh (`L` its
  Laplacian, a few conjugate-gradient iterations), move by `δ`, repeat two or three times. Then test the reverse case
  Outfit Studio names: for each body vertex cast a short ray inward; if it meets a garment triangle before the body's
  far side, lift that triangle's three corners by the depth plus `e`.
- *Restore detail.* A warp bends folds, collars and pockets like rubber. Delta mush puts them back with no linear
  solve: on the original garment `x0`, smooth it k times to `S(x0)` and store each vertex's detail vector
  `x0 − S(x0)` in the local frame (normal and a tangent) of `S(x0)`. After the warp gives `x̂`:
  `x = S(x̂) + F(S(x̂))·detail`, with `F` the same local frame on the smoothed warped mesh. The as-rigid-as-possible
  form is stronger where the body changed a lot: alternate, per vertex,
  `R_v = polar(Σ_u w_vu (x_v − x_u)(x0_v − x0_u)ᵀ)` (the rotation part, by an SVD) with one sparse solve of
  `Σ_u w_vu (x_v − x_u) = Σ_u (w_vu / 2)(R_v + R_u)(x0_v − x0_u)`, softly tied to `x̂`. Keep wrinkle height in
  absolute units; do not scale it with the body.
- *Rigid parts.* Find them: connected components smaller than a few centimetres (buttons, buckles, eyelets, zip pulls),
  plus any the user tags (soles, heels, a belt's buckle, glasses). For each, fit the best rigid motion from the
  original to the warped positions of its *attachment* (the cloth vertices nearest its base) by the same SVD as step 1
  with `s = 1`, and replace the part by its original shape moved by that motion. Belts, collars with interfacing and
  soles are semi-rigid: give their edges a higher weight in the ARAP step instead.
- *Self-check.* Report the share of garment vertices inside the body before and after, the smallest ease, and the
  edge-length ratio against the original (how much it was resized). The tailor's check already measures the first.

**6. Re-hang what hangs.** Pin the bound rows, let the free part fall under the tailor's drape solver against this
body, and bake. A skirt then hangs from this waist over these hips, which no geometric warp can give. This is the one
place where owning a cloth solver changes the answer: MakeHuman, MB-Lab and CharMorph have none and warp the skirt.

**Which parts need what.** All of steps 1 to 6 are plain geometry: a BVH for closest points (the tailor has one), 3 × 3
SVDs, a sparse Laplacian and a conjugate-gradient or Cholesky solve. JavaScript in the page or numpy on the server;
`libigl` (MPL-2.0) and `trimesh` (MIT) cover the closest-point, distance-field, ARAP and registration pieces if a
library is preferred. Blender is needed for none of it; it is useful for reading FBX and as a referee (bind with
Surface Deform, compare).

**Geometric warp or the same garment?** A warp grades the garment: it grows with the body, like made-to-measure. A
relax with the original edge lengths keeps the garment's size and makes it tight or loose on a different body. For a
library of ready-made clothes the first is what a player expects; the edge-ratio report says how far each fit went, and
past some ratio (to be found on the check bodies) a second authored size is the honest answer, as Epic advises.

**Where cloth-fit fits.** Only in step 1, for a garment that arrives with a rigged avatar of very different
proportions, and only if its run time proves acceptable. For a garment already standing on MHR it adds nothing.

**Against the 2026-10-21 note.** Its gap "learned fitting methods were not surveyed; they are mostly SMPL-bound" is
now checked at source and holds. Its Unreal route no longer applies. New since: cloth-fit, MIT reference code for the
weight transfer (§3), and the reading of MakeHuman's format above, which that note did not have.

### Gaps
- cloth-fit's run time, failure cases and multi-layer mode: the paper is on a host that did not resolve. Whether its
  output keeps the input's vertex order and UVs was not checked.
- The thresholds `d0`, `d1`, the normal test's angle and the push-out's `λ` are starting values, not measured ones.
- No free tool was found that fits a garment to a body with no source body, skeleton or hand placement.
- trimesh's NRICP was read, not run: its speed and quality on two 13k to 18k vertex bodies are unknown.

## 3. After the fit: skin weights, the skin underneath, and layering with the tailor's own garments

### Takeaway
Weights: copy the body's where a garment vertex clearly lies on it and fill the rest by a smooth solve over the
garment (SIGGRAPH Asia 2023; MIT reference code). Skin: take the garment author's hidden list when there is one,
compute it by visibility when there is not, and keep the tailor's inset. Layers: every garment, imported or cut by the
tailor, should publish one number per body vertex, how far its outer face stands off the skin there; with that the two
systems stack in either order.

### Cited Findings

#### Weights: the inpainting transfer and its implementations
- The authors' sample code is **MIT** ("Copyright (c) 2024 Rinat Abdrashitov"), Python on libigl's bindings (218 lines
  in `utils.py`), with a C++ folder; "the code contains the full implementation of the method"; last commit
  2024-07-24 — [README](https://github.com/rin-23/RobustSkinWeightsTransferCode/blob/HEAD/README.md),
  [LICENSE](https://github.com/rin-23/RobustSkinWeightsTransferCode/blob/HEAD/LICENSE)
- The algorithm as the code has it —
  [src/utils.py](https://github.com/rin-23/RobustSkinWeightsTransferCode/blob/HEAD/src/utils.py),
  [src/sphere_to_plane_transfer.py](https://github.com/rin-23/RobustSkinWeightsTransferCode/blob/HEAD/src/sphere_to_plane_transfer.py):
  1. for each garment vertex, the closest point on the body's surface; weights and normals interpolated there;
  2. the match is kept only if the distance is under a threshold (the sample: 0.05 of the garment's bounding-box
     diagonal) and the two normals are within 30 degrees;
  3. every other vertex is inpainted: with L twice the cotangent Laplacian and M the Voronoi mass matrix,
     `Q = −L + L·M⁻¹·L`, minimised with the matched vertices fixed (`igl.min_quad_with_fixed`), all bones at once;
  4. optionally the inpainted vertices and their neighbours within the threshold are smoothed (10 iterations, 0.2).
- Unreal's `TransferSkinWeights` node uses the method by default (30 degrees, 0.05 of the diagonal, 10 smoothing
  iterations at 0.1, up to 8 influences) and notes it works best on a welded, manifold mesh —
  [node reference](https://dev.epicgames.com/documentation/unreal-engine/node-reference/Dataflow/TransferSkinWeights?lang=en-US)
  (via the earlier note's search summary)
- **Blender add-on** by Sent From Space: **GPL-3**, version 1.1.9, Blender 3.1 or newer, last commit 2026-03-27; needs
  `scipy`, `libigl==2.5.1`, `robust-laplacian`. It claims transfer "without needing additional weight painting work
  like smoothing in problem areas (between legs, between chest, armpits)". Its changes: flipped normals allowed (so
  solid, two-sided garments match) and a point-cloud Laplacian for pieces with no match. Options include max distance,
  max normal difference, an inpaint vertex group, and a limit of groups per vertex —
  [README](https://github.com/sentfromspacevr/robust-weight-transfer/blob/HEAD/README.md),
  [\_\_init\_\_.py](https://github.com/sentfromspacevr/robust-weight-transfer/blob/HEAD/__init__.py)
- The paper and its slides, on loose clothes: older transfers struggle with garments that are not skin-tight and need
  hand painting after; closest-point transfer stretches at the armpits and is worse on loose clothing; a pipeline
  usually starts from a transfer and is then edited by hand, by an amount that depends on the garment —
  [project page](https://www.dgp.toronto.edu/~rinat/projects/RobustSkinWeightsTransfer) (via search summary)
- The tailor today: four bones a vertex from "a Gaussian over the skin's points near it", wider for cloth that stands
  off; a skirt in a sit "turns up with [the thighs] into a tube pointing forward ... That needs cloth ... or skirt
  bones; weights alone can't drape it" — `docs/TAILOR.md` §3b (this repo)

#### Learned rigging, 2025 to 2026 (none aimed at clothes on a known body)
| Name | Repo, last commit | Licence of code | What it does | Verdict here |
|---|---|---|---|---|
| **SkinTokens** (2026) | [VAST-AI-Research/SkinTokens](https://github.com/VAST-AI-Research/SkinTokens), 2026-05-12 | MIT | rig as one token sequence; `--use_skeleton` "Use existing skeleton (generate skin only)"; needs 14 GB VRAM | with work, for accessories |
| **UniRig** (SIGGRAPH 2025) | [VAST-AI-Research/UniRig](https://github.com/VAST-AI-Research/UniRig), 2026-06-04 | MIT | skeleton, then weights; points to SkinTokens as its successor | superseded |
| **Puppeteer** (2025) | [Seed3D/Puppeteer](https://github.com/Seed3D/Puppeteer), 2025-09-19 | Apache-2.0 | skeleton, weights, animation | blocked: skinning needs PartField |
| **Make-It-Animatable** (2025; v2 2026) | [jasongzy/Make-It-Animatable](https://github.com/jasongzy/Make-It-Animatable), 2026-09-08 | MIT | weights and bones for the Mixamo skeleton | not MHR's skeleton |
| **RigAnything** (2025) | [Isabella98Liu/RigAnything](https://github.com/Isabella98Liu/RigAnything), 2025-10-23 | Adobe Research License | rig for any object | blocked |
| **Anymate** (2025) | [yfde/Anymate](https://github.com/yfde/Anymate), 2025-08-28 | none | dataset and baselines | blocked |
| **RigNet** (2020) | [zhan-xu/RigNet](https://github.com/zhan-xu/RigNet), 2024-11-03 | GPL-3 | skeleton and weights | old |

- SkinTokens' README: trained on "ArticulationXL 2.0 + VRoid Hub + ModelsResource"; Python 3.11, PyTorch 2.7.0; it
  shows baselines suffering "'bleeding' artifacts across disconnected mesh parts". Its weights' licence on Hugging Face
  is reported as MIT by a search summary and was not read at source —
  [README](https://github.com/VAST-AI-Research/SkinTokens/blob/HEAD/README.md)
- PartField's licence: "The Work and any derivative works thereof only may be used or intended for use
  non-commercially" — [LICENSE](https://github.com/nv-tlabs/PartField/blob/HEAD/LICENSE),
  [Puppeteer skinning README](https://github.com/Seed3D/Puppeteer/blob/HEAD/skinning/README.md)
- RigAnything's: "may be exercised for noncommercial research purposes (i.e., academic research and teaching) only" —
  [LICENSE.md](https://github.com/Isabella98Liu/RigAnything/blob/HEAD/LICENSE.md)
- Make-It-Animatable's v2 is "Upgraded to the Hunyuan3D 2.1 ShapeVAE backbone with retrained MIA models" and trains on
  Mixamo characters; no licence is stated for its weights (unverified) —
  [README](https://github.com/jasongzy/Make-It-Animatable/blob/HEAD/README.md)

#### The skin underneath
- **From the garment's author:** `delete_verts`, with MakeHuman's and MPFB's conservative application (§1).
- **Computed, CharMorph's way:** a body vertex is covered when it is within 0.001 units of the asset, or when rays to
  it from 26 points on a cube round the character are blocked (by the asset or by the body itself) with at most one
  clear ray and at least one stopped by the asset; the set is then shrunk by its boundary ring —
  [CharMorph fitting.py](https://github.com/Upliner/CharMorph/blob/HEAD/lib/fitting.py)
- **By shapes or masks, the VRChat tools' way** (both MIT): AvatarOptimizer removes "vertices transformed by specified
  BlendShape" (a body's "shrink" shapes) or by a mask texture; Modular Avatar's Shape Changer sits on an outfit "to
  delete or shrink parts of the avatar base model which are hidden by or interfere with the outfit mesh" —
  [AAO Remove Mesh By BlendShape](https://github.com/anatawa12/AvatarOptimizer/blob/HEAD/.docs/content/docs/reference/remove-mesh-by-blendshape/index.md),
  [MA Shape Changer](https://github.com/bdunderscore/modular-avatar/blob/HEAD/docs~/docs/reference/reaction/shape-changer.md)
- **In engines and games:** Unity's UMA (MIT) has a `MeshHideAsset`; Unreal's Mutable, production-ready in 5.8, has a
  "Remove Unseen" step for geometry under clothing; inZOI masks body regions through a second UV channel; Paralives
  replaces the body part a garment's mesh slot names —
  [UMA MeshHideAsset.cs](https://github.com/umasteeringgroup/UMA/blob/HEAD/UMAProject/Assets/UMA/Core/StandardAssets/UMA/Scripts/MeshHideAsset.cs),
  [Unreal Engine news](https://www.unrealengine.com/news/mutable-sample-for-runtime-character-customization-now-updated-for-ue-5-8),
  [inZOI ModKit](https://mod-docs.playinzoi.com/ModKit/project/CAZ/Guide/03.%20Masking%20System.html),
  [Sims Community on Paralives](https://simscommunity.info/2026/03/22/paralives-modding-tools/) (the last three via
  search summary)
- **The tailor today** (`docs/TAILOR.md` §3d, this repo): skin at least 3.5 cm inside every edge of an opaque garment
  (6 cm from a neckline or an open front) is left out of the export, only where all three corners of a triangle are
  hidden; on the test character 5,478 of 36,874 skin triangles; the share of a cardigan's outside under the skin in
  five hard poses fell from 0.3 to 1.9% to 0 to 0.3%. Not covered: "cloth through cloth ... and the skin near a
  garment's edges".

#### Layers
- An explicit number per garment is the norm: `z_depth` in MakeHuman (§1), `WrapLayer.Order` in Roblox, a "ZOrder
  Layer" in Paralives — [WrapLayer reference](https://robloxapi.github.io/ref-temp/class/WrapLayer.html),
  [Sims Community](https://simscommunity.info/2026/03/22/paralives-modding-tools/) (via search summary)
- MakeHuman hides an under-layer through the body: a garment vertex goes when two of its three body references are
  hidden by the layers above (§1). Roblox makes each layer wrap the outer cage of the one beneath (§2).
- Cyberpunk 2077's "garment support" squashes the garment underneath by a morph, limited by painted vertex colours,
  and only between meshes that both carry it —
  [Garment Support: How does it work?](https://wiki.redmodding.org/cyberpunk-2077-modding/for-mod-creators-theory/3d-modelling/garment-support-how-does-it-work)
  (via search summary)
- Untangling layers geometrically: ContourCraft (MIT code, SMPL-bound import), cloth-fit (MIT), Progressive Outfit
  Assembly (no code found) (§2).

### Inferences
- **Weights for an imported garment:** run the MIT functions on the Python server with the fitted garment and the
  body's weights; then keep the four (or eight) largest per vertex and renormalise. It needs `libigl` and `scipy`
  wheels. A JavaScript port is moderate: the Laplacian and closest points are easy, the sparse solve is the part to
  write (conjugate gradients will do). One factorisation serves every bone, so seconds for a garment of 12k to 80k
  vertices is the expected order (estimate, not measured).
- **Why not keep the tailor's Gaussian for imports.** It works in space, so at an armpit a sleeve can take the ribs'
  weights. The inpainting works along the garment's own surface and refuses matches whose normals disagree. On a
  garment cut from the body the two agree; on a jacket with a lining, a collar and thickness they do not. Thick,
  two-sided meshes need the add-on's trick: accept a match whose normal is flipped.
- **For a MakeHuman garment** the format's own rule (body weights through the three references) is the first choice;
  use the inpainting for helper-bound vertices and wherever §1's mid-line leak shows.
- **Hidden skin, in order of preference:** the author's `delete_verts` over the bridge; else visibility. The tailor's
  occlusion bake already renders depth from 64 directions (CLAUDE.md, `bakeOcclusion`), which is CharMorph's test with
  more rays. Either way keep the existing inset, so a cuff or hem never shows a hole, and the existing rule that only
  fully hidden triangles go.
- **One interface for layering imported and tailor-cut garments: a cover height.** For each worn garment compute, per
  body vertex, `h_g(v)` = the distance from the skin along its normal to the garment's outer face (a short ray; zero
  where it does not cover). Then:
  - *imported over tailor-cut:* in §2's push-out, replace the body by the body raised by `max h` of the layers under
    it, plus a gap of a few millimetres;
  - *tailor-cut over imported:* the tailor already lifts a garment "over the garments under it" (TAILOR §3c); feed it
    the imported garment's `h`;
  - *hiding:* a layer's faces go where a layer above covers the skin they are bound to (the two-of-three rule), and
    only if the layer above is opaque (the tailor's existing test).
  The order itself stays a number per garment; a MakeHuman garment arrives with one (`z_depth`).
- **What stays unsolved by this:** cloth through cloth at deep bends. That is a pose problem, answered in §5 by a
  corrective shape, not by the fit.

### Gaps
- No evaluation was found of any learned rigger on clothes over a body.
- Whether SkinTokens' `--use_skeleton` accepts a skeleton as large as MHR's was not found.
- No source measured poke-through on imported garments after hiding the skin; the tailor's numbers are for its own.

## 4. The look on an imported garment: a real-size fabric and PNG decals on someone else's UVs

### Takeaway
Keep the garment's own UVs for its own texture and for anything baked (decals, occlusion), and add a second UV set in
metres for the tileable fabric, made per UV island from the first by a scale and a turn, re-flattened only where the
island is too distorted. Tileable UVs may overlap, so nothing needs packing. Godot's standard material can already
blend a detail layer on UV2 over a base on UV. When a mesh has no usable UVs, xatlas (MIT) makes them, in Python or in
the browser.

### Cited Findings
- **xatlas:** MIT; "a small C++11 library with no external dependencies that generates unique texture coordinates
  suitable for baking lightmaps or texture painting"; last commit 2022-07-26; used by Godot, Filament and ArmorPaint.
  Output: "New meshes have more vertices (the UV channel adds seams), but the same number of indices". Options that
  matter here: `ChartOptions.useInputMeshUvs` ("Use MeshDecl::vertexUvData for charts"); `PackOptions.texelsPerUnit`
  ("Unit to texel scale. e.g. a 1x1 quad with texelsPerUnit of 32 will take up approximately 32x32 texels in the
  atlas"), `padding`, `rotateCharts` ("Rotate charts to improve packing") and `rotateChartsToAxis`, both on by default.
  `AddUvMesh` repacks existing charts — [README](https://github.com/jpcy/xatlas/blob/HEAD/README.md),
  [xatlas.h](https://github.com/jpcy/xatlas/blob/HEAD/source/xatlas/xatlas.h),
  [LICENSE](https://github.com/jpcy/xatlas/blob/HEAD/LICENSE)
- **xatlas-python:** MIT, `pip install xatlas`, last commit 2025-07-04; `xatlas.parametrize(vertices, faces)` returns
  `vmapping, indices, uvs`; it exposes `use_input_mesh_uvs`, `texels_per_unit`, `rotate_charts`,
  `rotate_charts_to_axis` and `add_uv_mesh` — [README](https://github.com/mworchel/xatlas-python/blob/HEAD/README.md),
  [options.cpp](https://github.com/mworchel/xatlas-python/blob/HEAD/src/options.cpp)
- **xatlas.js:** MIT, a WebAssembly build (`npm install xatlasjs`) usable as a module or in a web worker; last commit
  2024-10-05; its README points to `xatlas-three` for three.js —
  [README](https://github.com/repalash/xatlas.js/blob/HEAD/README.md)
- **Godot carries xatlas itself** (`thirdparty/xatlas`, `modules/xatlas_unwrap`), and `ArrayMesh.lightmap_unwrap`
  "Performs a UV unwrap on the ArrayMesh to prepare the mesh for lightmapping" —
  [thirdparty](https://github.com/godotengine/godot/tree/4.7.2-stable/thirdparty/xatlas),
  [ArrayMesh.xml](https://github.com/godotengine/godot/blob/4.7.2-stable/doc/classes/ArrayMesh.xml)
- **Flattening an island well:** libigl's Python bindings have `lscm`, `arap` and `slim` (MPL-2.0, §2). Blender's
  unwrap methods are "Angle Based", "Conformal" and "Minimum Stretch" (the last is SLIM in its source) —
  [bindings source](https://github.com/libigl/libigl-python-bindings/tree/HEAD/src),
  [uvedit_unwrap_ops.cc](https://github.com/blender/blender/blob/HEAD/source/blender/editors/uvedit/uvedit_unwrap_ops.cc)
- **Others, for the record:** Microsoft's UVAtlas (MIT) is "archived ... use of it for new projects is not
  recommended"; Boundary First Flattening (MIT, last commit 2023-06-21) is an application for conformal flattening
  with control of the boundary — [UVAtlas README](https://github.com/microsoft/UVAtlas/blob/HEAD/README.md),
  [BFF README](https://github.com/GeometryCollective/boundary-first-flattening/blob/HEAD/README.md)
- **Godot's standard material has what the two-UV scheme needs:** `uv1_scale`, `uv2_scale` and offsets; a detail layer
  (`detail_enabled`, `detail_albedo`, `detail_normal`, `detail_mask`, `detail_blend_mode`) whose `detail_uv_layer`
  "Specifies whether to use UV or UV2 for the detail layer"; and `uv1_triplanar` / `uv2_triplanar`, which "uses the
  orientation of the object's surface to blend between texture coordinates" and reads the texture three times, in
  object space or (`uv1_world_triplanar`) world space —
  [BaseMaterial3D.xml](https://github.com/godotengine/godot/blob/4.7.2-stable/doc/classes/BaseMaterial3D.xml)
- **Godot's Decal node** projects textures onto meshes inside its box, "projected within their AABB", in Forward+ and
  Mobile only, eight a mesh on Mobile — [Decal.xml](https://github.com/godotengine/godot/blob/4.7.2-stable/doc/classes/Decal.xml)
- **What an imported MakeHuman garment brings:** UVs in its OBJ and an `.mhmat` naming a diffuse texture and
  optionally normal, roughness, metallic, occlusion and opacity maps (§1). MakeClothes 2's material editor writes
  glTF-style keys (`metallicRoughnessTexture`: green roughness, blue metallic) —
  [MakeClothes 2 README](https://github.com/makehumancommunity/community-plugins-makeclothes/blob/HEAD/README.md)
- **What the tailor has now:** fabric coordinates "at its real size in metres", a tileable fabric or a PBR set off the
  shelf at a repeat in metres, and prints (text or a picture) "placed on a panel (front, back, a sleeve, a leg, a
  skirt's front)" — `docs/TAILOR.md` §1b (this repo). The prop generator already wears shelf sets on imported models
  "by triplanar projection" — `CLAUDE.md` (this repo)

### Inferences
**Two UV sets, two jobs.**
- `UV` (the author's): the garment's own albedo and normal map if kept; and every bake that needs each texel to be one
  place on the garment (decals, occlusion, the crease normal map). If its islands overlap (mirrored halves are common
  in game assets), it cannot take a bake: make a unique one with xatlas (`useInputMeshUvs` keeps the author's charts
  and only repacks them; else let it chart).
- `UV2` (made): metres, for the tileable fabric. Overlaps are harmless because the fabric repeats.

**Making UV2 from UV, per island** (an island is a connected piece of the UV map; numpy or JavaScript, no library).
1. *Scale.* For each triangle take its area in 3D (rest pose, metres) and in UV. The island's scale is
   `ρ = sqrt(Σ area3D / Σ areaUV)`, in metres per UV unit. `UV2 = ρ · (UV − centre)` already gives the fabric its real
   size on average. This is the whole of "normalising texel density".
2. *Check the distortion.* For each triangle, the 2 × 2 map `J` from its UV edges to its 3D edges (in the triangle's
   own plane) has singular values `σ1 ≥ σ2`. After step 1, `σ1 = σ2 = 1` means the fabric is neither stretched nor
   sheared there. Sum, by area, the triangles where `σ1/σ2` exceeds about 1.15 or either value is off by more than
   about 10%.
3. *Re-flatten only the bad islands,* keeping their seams: start from the author's UV and run a few iterations of an
   as-rigid-as-possible parameterisation (libigl's `arap`, or `slim`), whose optimum has every `J` as near a rotation
   as the island's curvature allows. A garment's islands are usually its panels, which are nearly developable, so this
   converges to almost no stretch. An island that cannot be flattened (a whole sleeve with no seam) gets a cut along
   its underside first.
4. *Turn it so the grain runs right.* Cloth is cut with its grain down the body's length on the torso and along the
   limb on sleeves and legs. For each island take the axis of the bone that dominates its skin weights (or straight
   down, for the torso and a skirt), project that axis into each triangle's plane, map it through `J⁻¹` into UV2,
   take the area-weighted mean direction, and rotate the island so that direction is UV2's vertical. The fabric's
   stripes then run down the sleeve, not across the world.
5. *Seams.* A weave will not line up across a seam, as on a real garment; a print that must is a decal.

**No UVs worth keeping** (generated meshes with confetti charts, or none): chart with xatlas, then steps 1 to 4 on its
charts with `rotateCharts` off. For hard accessories (a bag, a buckle, a boot's sole) where grain means nothing,
triplanar is enough, but it must be computed from rest-pose positions: project in the tool and bake, or carry the rest
position as a vertex attribute for the shader. (Whether Godot's built-in triplanar uses the skinned or the rest
position on a skinned mesh was not checked; baking avoids the question.)

**Fabric over the author's texture, or instead of it.** Instead: sample the shelf set on UV2 with the garment's tint.
Over: keep the author's albedo and normal on UV (seams, pockets, shading painted in) and add the fabric's weave as a
detail layer on UV2; Godot's standard material does this for albedo and normal; roughness needs the studio's own
shader, which it has. An occlusion or "dirt" look can be multiplied from the author's map either way.

**PNG decals.** Bake them, as the tailor bakes prints; a run-time Decal node projects in world space and would swim on
a skinned garment. Two ways to place one, both in the rest pose:
- *In the panel:* a rectangle in the island's UV2 (metres), so the decal has its real size and no projection stretch.
  Right for a chest print or a sleeve patch. This is what the tailor's prints do.
- *Projected:* a frame with centre `c`, axes `t, b`, normal `n`, width `w`, height `h`. For each texel of the unique
  UV with rest position `p` and normal `m`: `u = (p − c)·t / w + 0.5`, `v = (p − c)·b / h + 0.5`; keep it if u and v
  are in 0 to 1, `|(p − c)·n|` is under a depth limit, `m·n` is positive enough (facing the projector), and the texel's
  triangle is connected to the one under the decal's centre without leaving the frame (so it does not print through
  onto the back). In the page this is one render of the garment in UV space with those tests in the fragment shader.
  Right for a decal that crosses a seam.

**Libraries, and what needs Blender.** Steps 1, 2 and 4 and both decal bakes need nothing. Step 3 needs a
parameteriser: libigl in Python (MPL-2.0), or the same few lines of ARAP as §2's repair. Unique UVs need xatlas
(Python or WASM, MIT). Blender's own unwrap (Minimum Stretch) is an alternative for both, not a requirement.

**Effort (estimate):** UV2 with the grain turn two to three days; the overlap test and xatlas path a day; projected
decals a day on top of the existing print bake.

### Gaps
- No search could be run for existing texel-density or grain-alignment tools; the method above is derived, not found.
- How often library garments have overlapping or mirrored UVs is not known; it decides how often xatlas is needed.
- Godot's triplanar on skinned meshes, and the cost of a detail layer on every garment, were not checked.

## 5. Looking alive without runtime cloth, briefly (Godot 4.4 to 4.7)

### Takeaway
Godot now has spring bone chains with colliders (4.4), bone-to-bone constraints (4.5) and IK (4.6) as plain skeleton
modifiers. It has no pose-driven shape system and no usable cloth on a skinned character. So the rest comes from data
made offline: pose-blended creases and a few corrective shapes from the tailor's own solver, bones for what hangs, and
for scripted takes a baked simulation.

### Cited Findings
- **Versions** (release tags; class docs present at each tag): 4.4 (2025-03-03) has SpringBoneSimulator3D; 4.5
  (2025-09-15) adds BoneConstraint3D with Aim, CopyTransform and ConvertTransform modifiers; 4.6 (2026-01-25) adds
  IKModifier3D and its solvers, LimitAngularVelocityModifier3D and BoneTwistDisperser3D; 4.7 (2026-06-17; 4.7.2 on
  2026-08-16) adds no new class of this kind — [Godot tags](https://github.com/godotengine/godot/tags),
  [doc/classes at 4.7.2-stable](https://github.com/godotengine/godot/tree/4.7.2-stable/doc/classes)
- **SpringBoneSimulator3D** "can be used to wiggle hair, cloth, and tails"; it "attempts to return the original pose";
  a chain runs from a root bone to an end bone and "does not support a branched chain like Y-shaped chains"; each joint
  has stiffness, drag, gravity, radius and a rotation axis; collisions are its own child nodes (sphere, capsule,
  plane), "not related to PhysicsServer3D", and can follow a bone —
  [SpringBoneSimulator3D.xml](https://github.com/godotengine/godot/blob/4.7.2-stable/doc/classes/SpringBoneSimulator3D.xml),
  [SpringBoneCollision3D.xml](https://github.com/godotengine/godot/blob/4.7.2-stable/doc/classes/SpringBoneCollision3D.xml)
- **Constraints and custom modifiers:** ConvertTransformModifier3D and CopyTransformModifier3D apply one bone's
  transform to another, whole or by axis; SkeletonModifier3D "should be used to implement custom IK solvers,
  constraints, or skeleton physics". Blend shapes are set by script; no pose-driver class exists —
  [ConvertTransformModifier3D.xml](https://github.com/godotengine/godot/blob/4.7.2-stable/doc/classes/ConvertTransformModifier3D.xml),
  [SkeletonModifier3D.xml](https://github.com/godotengine/godot/blob/4.7.2-stable/doc/classes/SkeletonModifier3D.xml),
  [MeshInstance3D.xml](https://github.com/godotengine/godot/blob/4.7.2-stable/doc/classes/MeshInstance3D.xml)
- **SoftBody3D:** Jolt is recommended and is the default from 4.6; "physics interpolation currently does not affect
  soft bodies". Godot's Jolt wrapper has no reference to Jolt's skinned cloth constraints, which the bundled library
  has (`mSkinnedConstraints`). An add-on's author lists as Godot's limits: "When you assign `Skeleton3D` In the
  SoftBody it breaks. Animations on the mesh do not deform properly" —
  [soft_body.rst](https://github.com/godotengine/godot-docs/blob/HEAD/tutorials/physics/soft_body.rst),
  [jolt_soft_body_3d.cpp](https://github.com/godotengine/godot/blob/4.7.2-stable/modules/jolt_physics/objects/jolt_soft_body_3d.cpp),
  [SoftBodySharedSettings.h](https://github.com/godotengine/godot/blob/4.7.2-stable/thirdparty/jolt_physics/Jolt/Physics/SoftBody/SoftBodySharedSettings.h),
  [softpin README](https://github.com/bryantcrisos/softpin/blob/HEAD/README.md)
- **Issues and proposals:** "Jolt SoftBody 3D Stiffness not working as expected" (#123569, open, 2026-09-17); a
  spring-bone collision bug closed 2026-11-02 (#125026); "Add a Cloth Node" (#9058) closed in 2024 —
  [Godot issues](https://github.com/godotengine/godot/issues?q=is%3Aissue+SpringBoneSimulator3D+skirt+OR+cloth+OR+collision),
  [proposals](https://github.com/godotengine/godot-proposals/issues?q=is%3Aissue+cloth+skeleton+skinned)
- **Add-ons:** godot-vrm (MIT, last commit 2026-07-08), wigglebone (MIT, 2026-05-11) —
  [godot-vrm](https://github.com/V-Sekai/godot-vrm), [wigglebone](https://github.com/detomon/wigglebone)
- **Baking a simulation into bones:** Dem Bones (EA; BSD 3-Clause; version 1.2.1; last commit 2025-01-16) converts "any
  animated mesh sequence ... to LBS, which can be replayed in popular game engines"; its tools read FBX and Alembic.
  py-dem-bones (BSD 3-Clause; `pip install py-dem-bones`; last commit 2026-10-24) is a NumPy interface,
  `solve_skinning(rest, poses, bone_count=…)`, and shows 81 bones fitted to 48 poses of 8,000 points at 0.041%
  normalised error (its own figure) — [dem-bones](https://github.com/electronicarts/dem-bones/blob/HEAD/README.md),
  [py-dem-bones](https://github.com/loonghao/py-dem-bones/blob/HEAD/README.md)
- **Baking into textures:** OpenVAT (add-on GPL-3, Blender 4.2 or newer; engine shaders MIT, two for Godot; last commit
  2026-10-02) — [README](https://github.com/sharpen3d/openvat/blob/HEAD/README.md),
  [engine tools](https://github.com/sharpen3d/openvat/tree/HEAD/OpenVAT-Engine_Tools)
- **Paid, so out:** the Blender wrappers of Dem Bones (Blender DemBones, sold from 15 USD; BoneBake for skirts and
  capes, whose own docs say a bake replays the frames it read and does not react to new animations) —
  [Blender DemBones](https://dener.itch.io/blender-dembones),
  [BoneBake docs](https://superhivemarket.com/products/bonebake/docs) (via search summary)
- **Learned garment motion, none usable:** VirtualBones (SIGGRAPH 2022: bones from a simulation database plus a
  network that drives them; no licence file, last commit 2022-05-10); GAPS (3DV 2024; no licence file, last commit
  2024-02-27); Neural Garment Dynamics via Manifold-Aware Transformers (Eurographics 2024; no licence file, loads an
  SMPL model, last commit 2024-05-08); DiffusedWrinkles (BMVC 2024; no code found, via search summary) —
  [VirtualBones](https://github.com/non-void/VirtualBones), [GAPS](https://github.com/simonhfls/gaps),
  [manifold-aware-transformers](https://github.com/PeizhuoLi/manifold-aware-transformers),
  [DiffusedWrinkles on arXiv](https://arxiv.org/abs/2503.18370v1)
- **Pose-driven shapes in a shipped game:** EA's Swish on Madden NFL 21 maps joint rotations to about 32 PCA shape
  weights and picks a normal map from a database, for under a millisecond a player by its slides —
  [EA SEED](https://www.ea.com/seed/news/swish-neural-network-cloth-sim-in-madden-nfl-21) (via search summary)
- **The same idea as research:** PBNS learns "Pose Space Deformation (PSD) basis for rigged garments" from a physics
  energy, "training takes barely a few minutes, even without a GPU" (no licence file); its successors
  NeuralClothSim and SNUG forbid "any use for commercial purposes"; UNIC (2026) is CC BY-NC-SA 4.0 —
  [PBNS](https://github.com/hbertiche/PBNS/blob/HEAD/README.md),
  [NCS licence](https://github.com/hbertiche/NeuralClothSim/blob/HEAD/LICENSE.md),
  [SNUG licence](https://github.com/isantesteban/snug/blob/HEAD/LICENSE.md),
  [UNIC licence](https://github.com/igl-hkust/UNIC/blob/HEAD/LICENSE.txt)
- **MHR has pose correctives of its own** ("Non-linear Pose Correctives", shipped as corrective blend shapes with a
  small network, Apache-2.0); the studio's exports do not use them —
  [MHR README](https://github.com/facebookresearch/MHR/blob/HEAD/README.md), `docs/TAILOR.md` §3b (this repo)

### Inferences
A ladder, cheapest first, all within "skinned, never simulated":
1. **Pose-blended creases:** two or three crease sets per garment (rest, bent), blended in the shader by the elbow's,
   knee's and hip's angle. The tailor's crease code is the generator; an imported garment gets the same.
2. **A few corrective shapes:** pose the body, let the tailor's solver settle the skinned garment on it, bring the
   result back to the rest pose and store the difference as a sparse blend shape driven by the joint angle. It also
   removes cloth through cloth at deep bends. The blocker is the tailor's: its drape runs only in the rest pose
   (TAILOR §4).
3. **Bones for what hangs:** chains round a skirt or under a coat's tails (say 8 to 12 round, 2 to 4 joints down; an
   estimate), weighted by ring and by angle, on SpringBoneSimulator3D with capsule colliders on the thighs. Chains are
   not linked sideways, so neighbours must share weights smoothly. A constraint can lift the front chains with the
   thighs in a sit before the springs run.
4. **Baked takes:** the studio's actor scenes are fixed takes of 10 s or less. An offline cloth run over a take,
   turned into bones by py-dem-bones, is legitimate and never simulates in the game. Rough sizes (my arithmetic): 300
   frames of 20,000 vertices as 16-bit positions is about 36 MB as a texture, about 0.3 MB as 40 bones.

A garment bound to the body's surface (§1, §2) would also inherit MHR's own correctives if they are ever brought into
the game. SoftBody3D is ruled out twice: it is runtime simulation, and it is reported to break on skeletons.

### Gaps
- No Godot write-up was found of a skirt on spring bones with numbers, nor blend-shape cost figures for 4.7.
- Dem Bones' quality on loose cloth is not documented beyond py-dem-bones' own showcase.

## 6. What shipped games and small teams do

### Takeaway
One shared skeleton, garments as separate skinned meshes, the body under them removed by a per-garment mask, body
morphs copied onto the clothes, an explicit layer number, and a strict budget of bones for what swings. No 2024 to
2026 write-up from a small team with numbers for its own clothing system was found.

### Cited Findings
- **A platform's budget for swinging bones:** VRChat ranks an avatar on PC as Excellent, Good, Medium or Poor at 4 / 8
  / 16 / 32 PhysBone components, 16 / 64 / 128 / 256 affected transforms, 4 / 8 / 16 / 32 colliders and 32 / 128 /
  256 / 512 collision checks — [VRChat, Performance Ranks](https://creators.vrchat.com/avatars/avatar-performance-ranking-system/),
  [VRChat wiki](https://wiki.vrchat.com/wiki/Avatar_Performance_Ranking) (via search summary)
- **Morph-following by copying deltas:** Bethesda's modding tool conforms outfits to body sliders and copies bone
  weights by proximity (§2) —
  [ConformOptions.h](https://github.com/ousnius/BodySlide-and-Outfit-Studio/blob/HEAD/src/components/ConformOptions.h)
- **Body parts replaced or masked per garment, a layer number:** Paralives (its development page announces early
  access for 2026-05-25) and inZOI (§3) — [Paralives development page](https://www.paralives.com/development),
  [Sims Community](https://simscommunity.info/2026/03/22/paralives-modding-tools/) (via search summary)
- **Universal fit by a shared cage:** Roblox (§2). **Layering by squashing what is under:** Cyberpunk 2077 (§3).
- **Forum practice** (via search summary): matching shape keys on body and clothes driven by one slider; the complaint
  that a morph set on every garment is hard on artists, against scaling bones instead; and deleting the mesh under
  each piece of clothing —
  [Unreal forum](https://forums.unrealengine.com/t/character-creation-body-customization-shape-keys-and-clothes-adjustment-how-to-best-practices/155194),
  [Unity discussion](https://discussions.unity.com/t/3d-character-customization/614906),
  [Unreal forum](https://forums.unrealengine.com/t/character-customizer-system/39359/44)
- **In Godot** (forum posts, via search summary): body shape keys copied onto each clothing mesh and driven together
  work in game; separate clothing meshes on one skeleton, shown and hidden, is the common setup —
  [Making NPCs with interchangeable clothes and heads](https://forum.godotengine.org/t/making-npcs-with-interchangeable-clothes-and-heads/145616),
  [Character customization in Godot](https://forum.godotengine.org/t/character-customization-in-godot-3d/59840)
- **Free systems a small team can read end to end:** UMA for Unity (MIT), Humanizer for Godot (AGPL-3), Modular
  Avatar and AvatarOptimizer for VRChat (MIT) — [UMA](https://github.com/umasteeringgroup/UMA),
  [Humanizer](https://github.com/NitroxNova/humanizer), [Modular Avatar](https://github.com/bdunderscore/modular-avatar),
  [AvatarOptimizer](https://github.com/anatawa12/AvatarOptimizer)

### Inferences
- **Morph-following in the game is not needed here.** Games with sliders in play copy body morphs onto clothes at run
  time. This studio's bodies are fixed at export, so the fit happens in the tool and the game sees a finished mesh.
  That removes the largest cost the forum posts complain about.
- **Per-garment hand work is where a library pays or does not.** A MakeHuman garment over the bridge costs none. Any
  other garment costs a placement, a look at the mask and a layer number: minutes for a simple piece, more for a skirt
  or a coat (my reading of the tools' steps, not a measured figure). That is the argument for starting with the
  format that carries its own binding.
- **VRChat's "Good" rank is a sane ceiling** for a first-person horror game with one to three characters close: a
  skirt of 8 chains by 3 joints is 24 transforms.

### Gaps
- No 2024 to 2026 postmortem from a small team with numbers (garments, bones, triangles, hours per garment) was found.
- Nothing was found on how many authored sizes small teams keep per garment when bodies vary widely.
