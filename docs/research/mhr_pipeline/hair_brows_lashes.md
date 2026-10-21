# Hair, eyebrows and eyelashes on a custom MHR character in UE 5.8 (researched 2026-10-21)

Method note for the report writer: from this environment the proxy refused dev.epicgames.com, metahuman.com,
fab.com, superhivemarket.com, 80.lv, cgchannel.com, arxiv.org and forums.unrealengine.com (policy denials), so
facts from those sites come from search-engine extracts of the pages, not full reads. Repo licences and READMEs
were read directly from the repositories (shallow git clones). Facts about our own MHR files come from inspecting
`/home/user/HorrorEngine/Content/Studio/Bodies/`.

## 1. Unreal's Groom system on a custom (MHR) skeletal mesh: Blender export, binding, head-shape changes, physics, cost, LODs, Linux

### Takeaway
The Groom system does not care whose mesh it is: a groom whose roots sit on the MHR head binds straight to the MHR
skeletal mesh. Moving a groom from one mesh to another, though, needs the same UV layout. MetaHuman's archetype
head does not share MHR's UVs, so MetaHuman grooms don't transfer to MHR. Every MHR-derived cast member does share
MHR's topology and UVs, so a groom made once on the MHR base head can be transferred to each of them, which is
MetaHuman's archetype trick rebuilt on our own mesh.

- **Blender:** 4.2 and later export hair curves to Alembic. Unreal's groom attributes (width, root UV, guides,
  groups) need an add-on or our own exporter.
- **Cost:** strands are the expensive representation. No authoritative per-character millisecond figure exists.
  Strands for LOD 0 and 1 close-ups with cards below is the usual split.
- **Linux:** Epic's strand platform list includes Linux in one search extract of the page and omits it in another.

### Cited Findings
**Blender to Alembic to groom**
- Blender 4.2 added Alembic import **and export** of the new Hair Curves object type. — [Blender 4.2 release notes, Pipeline & I/O](https://developer.blender.org/docs/release_notes/4.2/pipeline_assets_io/)
- The Blender 4.4 manual says hair is written to Alembic as "animated zero-width curves". Particle systems are not supported and are exported as animated points. — [Blender manual 4.4, Alembic](https://docs.blender.org/manual/ru/4.4/files/import_export/alembic.html)
- Unreal's Alembic groom schema:
  - Attribute names are lowercase and start with `groom_`.
  - `groom_width` is a per-curve width. If it is missing, and there are no Maya widths to convert, the builder falls back to **1 cm**.
  - `groom_root_uv` is optional and supports UDIM. If it is absent, the engine computes root UVs by projecting the roots onto a sphere.
  - `groom_group_id` is an int32.
  - `groom_guide` is a 0/1 flag. If no guides are supplied, they are generated from the strands and the decimation settings.
  - Sources: [Epic, Using Alembic for grooms](https://dev.epicgames.com/documentation/unreal-engine/using-alembic-for-grooms-in-unreal-engine); [UE 4.27, Alembic for Grooms](https://docs.unrealengine.com/4.27/WorkingWithContent/Hair/AlembicForGrooms).
  - A tutorial blog uses slightly different names (`groom_guides`, `groom_guide_id`). Use Epic's names. — [Leah McEwen, XGen to UE5 breakdown](https://leahmcewen.artstation.com/blog/wBYX4/xgen-to-unreal-engine-5-breakdown-simulation-setup)
- **Groom Exporter (turbocheke):** a free (donation) Blender add-on that writes Blender's Curves objects to Alembic in Unreal's groom schema.
  - Its listing says "only OS supported Windows" and "Supports Blender 4.1".
  - Exporting several objects together gives separate groups in UE.
  - A forum post says it was only tested on Windows, and the thread shows problems with group IDs and reading guides.
  - Sources: [Gumroad listing](https://turbocheke.gumroad.com/l/Groomexporter); [Blender Artists thread](https://blenderartists.org/t/groom-exporter-for-unreal-engine/1415778).
- **GroomForge Pro (paid, Superhive).** These are vendor claims.
  - It converts Blender hair curves for UE 5.x Groom and 5.7 Hair Dataflow, injecting Root UV, ClumpID and Occlusion. It is "not a hair creation tool".
  - For cards, it injects Flow, Gradient and Occlusion data.
  - Sources: [GroomForge docs](https://superhivemarket.com/products/groomforge/docs); [GroomForge](https://superhivemarket.com/products/groomforge).
- Epic ships an official **Houdini** groom exporter that writes Alembic formatted for Unreal (Y-up, scaled). No Epic exporter for Blender was found. — [Epic, Houdini Groom Exporter](https://dev.epicgames.com/documentation/metahuman/houdini-groom-exporter?lang=ja)
- Fab's "Blender MetaHuman Groom Starter + Hair Cards" targets UE 5.6 and Blender 3.6+. It needs the Alembic Hair Importer, Hair Card Generator and MetaHuman plugins. — [Fab listing](https://www.fab.com/listings/6a061f58-8dfc-4bce-b298-4cf5f943d8a4)
- A 2024 anecdote, dated: converting card hair to a groom through Blender only worked with Blender 3.6.5 and UE 5.3, because later Blender versions needed a patch. — [Versluis, Daz hair to groom](https://www.versluis.com/2024/04/quick-notes-on-turning-daz-hair-into-groom-hair-for-unreal-engine/)
- MetaHuman's default hair material reportedly did not work on a custom groom. The poster suspected inconsistencies in Root UVs, Guide IDs and seed. — [UE forum, MetaHuman hair material on custom groom](https://forums.unrealengine.com/t/how-to-use-metahuman-hair-material-on-custom-groom/844218)
- Epic's hair overview says the engine itself provides no grooming solution: hair is shaped in Maya XGen, Ornatrix, Yeti or Houdini and imported as Alembic. Strands can render "hundreds of thousands (or more)" hairs in real time, and cards have traditionally been the real-time standard. — [Epic, Hair rendering and simulation](https://dev.epicgames.com/documentation/unreal-engine/hair-rendering-and-simulation-in-unreal-engine)
  - This statement predates 5.7's Groom Dataflow editing (below), so treat it as partly outdated.

**Binding to any skeletal mesh, and head-shape changes**
- A Groom Binding asset attaches and skins a groom component to a skeletal mesh component. No binding is needed if the groom only needs to be attached rigidly. — [Epic, Setting up bindings for grooms](https://dev.epicgames.com/documentation/en-us/unreal-engine/setting-up-bindings-for-grooms-in-unreal-engine)
- The **Source Skeletal Mesh** is optional. It is "used only if the hair binding is done a different mesh than the one which it has been authored". — [Python API, GroomBindingAsset (5.1)](https://docs.unrealengine.com/5.1/en-US/PythonAPI/class/GroomBindingAsset.html)
- Source and target **topology can differ**, but "the system assumes both the Source and Target meshes share the **same UV mapping**" when it transfers the curves and positions. The engine's TransferMesh function has the same requirement. — [Epic, Setting up bindings](https://dev.epicgames.com/documentation/en-us/unreal-engine/setting-up-bindings-for-grooms-in-unreal-engine); [TransferMesh API (4.27)](https://docs.unrealengine.com/4.27/en-US/API/Plugins/HairStrandsCore/FGroomBindingBuilder/TransferMesh/index.html)
- The source mesh matters only when the curve roots and the surface "don't align and need to be wrapped/transformed". — [Python API, GroomCreateBindingOptions](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/GroomCreateBindingOptions)
- Further binding controls (source for all three: [Epic, Setting up bindings](https://dev.epicgames.com/documentation/en-us/unreal-engine/setting-up-bindings-for-grooms-in-unreal-engine)):
  - **Matching Section** restricts the transfer to one mesh section.
  - **Global (RBF) interpolation** "preserves the original groom shape under large skeletal mesh deformations".
  - "100 samples or less should be good enough."
- **Binding needs the GPU Skin Cache.** Turn on Project Settings > Rendering > Optimization > Support Compute Skin Cache, and turn off "Tick Animation On Skeletal Mesh Init". — [UGroomComponent::bBindGroomToSkeletalMesh (4.26 API)](https://docs.unrealengine.com/4.26/en-US/API/Plugins/HairStrandsCore/UGroomComponent/bBindGroomToSkeletalMesh/index.html); [Epic, Hair quick start](https://dev.epicgames.com/documentation/en-us/unreal-engine/hair-simulation-and-rendering-quick-start-guide-in-unreal-engine)
- Without a binding asset, the projection is done at runtime, "a large GPU cost at startup time". — [UGroomComponent::BindingAsset (4.27 API)](https://docs.unrealengine.com/4.27/en-US/API/Plugins/HairStrandsCore/UGroomComponent/BindingAsset/index.html)
- **Morph targets.** In a UE 4.25-era thread, a morph moved the mesh but the hair stayed put. The reply argues that morphs deform the skinned mesh as bones do, so a bound groom should follow. The thread also reports crashes when binding several grooms. It is dated. — [Polycount thread](https://polycount.com/discussion/comment/2742792)
- **A vendor's alternative workflow:** a scalp shape key morphs to the character's head and the hair follows. The hair is attached to the head bone with no binding. — [Fab hair pack listing](https://www.fab.com/listings/b1652b8f-94dd-4590-9437-29f8d27946d7)
- **MetaHuman grooms on non-MetaHuman meshes:** a developer judged it "probably easier to build custom clothes for a MetaHuman head and body, than to use the grooms on a new head", because binding depends on the MetaHuman head's topology and UV layout. The workaround offered was a helper socket plus a binding asset. — [UE forum, Using MetaHuman grooms with non-MHC meshes](https://forums.unrealengine.com/t/using-metahuman-grooms-with-non-mhc-meshes/226299)

**Our MHR meshes (local inspection)**
- `Content/Studio/Bodies/MHR.fbx`, `MHR_lod1.fbx` and `MHR_lod0.fbx` each contain a UV layer (`LayerElementUV`, with `UVIndex`) and about 120 shape (blend-shape) records. The extracted `MHR_head.obj` has 22,312 vertices and **no UVs** (0 `vt` lines). — local files, `/home/user/HorrorEngine/Content/Studio/Bodies/`
- MHR is Apache-2.0, and its README mentions no hair, brows or lashes. — [facebookresearch/MHR](https://github.com/facebookresearch/MHR)

**Physics**
- Groom simulation runs on the GPU inside Niagara, with an XPBD solver. Source for this item: [Epic, Enabling physics simulation on grooms](https://dev.epicgames.com/documentation/en-us/unreal-engine/enabling-physics-simulation-on-grooms-in-unreal-engine).
  - Turn it on in Groom Asset Editor > Physics > Enable Simulation.
  - Substeps are set per frame, with solver calls at a fixed 24 fps, plus an iteration count.
  - Forces: gravity, air drag and air velocity. Bend constraints have stiffness and damping.
  - Simulation guides are resampled from the rendering guides, with 4, 8, 16 or 32 points per strand.
- **UE 5.7:** hair guides and strands can be authored with "joint-based deformation, painting, and mesh-based manipulation", blending simulated physics with art-directed animation. Hair shading and shadowing are also more accurate. — [UE 5.7 announcement](https://www.unrealengine.com/news/unreal-engine-5-7-is-now-available)
- An Unreal Fest Stockholm 2025 talk covers 5.7's Groom Dataflow: custom deformation pipelines, painting attributes, and rebuilding guides from strands non-destructively. — [Class Central listing](https://www.classcentral.com/course/youtube-advanced-groom-dataflow-setup-in-ue-5-7-unreal-fest-stockholm-2025-509126); [YouTube](https://www.youtube.com/watch?v=cER2jT8oxKY)
- **Known 5.7.x issue:** "hair explosions" on MetaHuman grooms. Epic says it is being investigated. — [UE forum](https://forums.unrealengine.com/t/metahuman-grooms-hair-explosions-in-ue-5-7/2684304)

**Cost and LODs (UE 5.x)**
- What costs what (source: [Epic, Groom scalability and performance](https://dev.epicgames.com/documentation/unreal-engine/groom-scalability-and-performance-with-unreal-engine)):
  - Strand rendering runs in stages: simulation, interpolation, voxelization, primary visibility, lighting and composition.
  - More curves make simulation, interpolation, voxelization and visibility more expensive.
  - A rigid binding with no simulation and no RBF skips interpolation.
  - Grooms that are off screen but cast shadows are still updated and voxelized.
- Groom LOD settings (source: [Epic, Setting up LOD for grooms](https://dev.epicgames.com/documentation/unreal-engine/setting-up-level-of-detail-for-grooms-in-unreal-engine)):
  - LOD Mode is Default, Auto or Manual. **Auto** sets the number of curves from the groom's screen size, and **Auto LOD Bias** pushes the reduction further away.
  - Each hair group can have up to 8 manual LODs. Each LOD sets a screen size, a geometry type (strands, cards or meshes) and a binding type.
  - Decimation controls: curve decimation, vertex decimation, angular threshold, and a thickness scale to make up for removed strands.
- **MetaHuman LOD budgets:**
  - Facial hair strands: **10,000 at LOD 0, 5,000 at LOD 1**.
  - Facial hair card vertices: **15,000 / 7,000 / 3,000 / 1,000 / 500** for LOD 0 to 4.
  - Source: [Epic, MetaHuman platform support and LOD specifications](https://dev.epicgames.com/documentation/en-us/metahuman/platform-support-and-lod-specifications-for-metahumans).
- **Cost console variables:**
  - `r.HairStrands.SkyAO 0` saves GPU time.
  - `r.HairStrands.Visibility.MSAA.SamplePerPixel` trades quality against cost.
  - `r.HairStrands.MinLOD` cooks out LODs, which mainly saves memory. MetaHuman's LOD 0 and 1 strands "use a lot of memory".
  - Source: [Epic, MetaHuman requirements and configuration](https://dev.epicgames.com/documentation/metahuman/requirements-and-configuration-settings-for-metahumans-in-unreal-engine).
- **No authoritative millisecond figure was found.** The ones that exist:
  - A Medium "pipeline reference" claims 3–6 ms of GPU per character at 1080p with LOD 0 strands on RTX 3070/4070-class cards. It gives no method and looks unreliable. — [Medium](https://medium.com/@Jamesroha/metahuman-5-6-5-7-pipeline-reference-170d302b078e)
  - A 2026 studio blog puts strands at "High ... often several ms" per character and cards at "Low". Its rule: cards for 60 fps on mid-range PCs and for crowds; strands for one or two hero characters on a high-end PC, or for cinematics. It also recommends a hybrid. This is opinion. — [Strayspark, Blender hair to Unreal (2026)](https://www.strayspark.studio/blog/blender-hair-grooming-to-unreal-engine-pipeline-2026)
- **Strands in a shipped game, different engine:** Indiana Jones and the Great Circle budgeted **2 ms** for strand-hair simulation plus rendering on minimum spec, in a worst case of about a dozen characters. — [Advances in Real-Time Rendering 2025, Strand Hair in IJGC](https://www.advances.realtimerendering.com/s2025/content/Strand%20Hair%20in%20IJGC%20-%20Final%20Slides%20(Post-Conference).pdf)

**Linux**
- Epic's groom platform page says strand rendering "can only run on certain platforms due to its demanding rendering cost". Cards and meshes run on all platforms, and one LOD can hold both strands and cards so the groom can switch.
  - One search extract lists Windows (DX11, DX12, Vulkan), **Linux** and current-generation consoles. An earlier extract of the same page listed Windows and consoles without Linux.
  - Source: [Epic, Groom platform support](https://dev.epicgames.com/documentation/unreal-engine/groom-platform-support-in-unreal-engine?lang=en-US).
- Epic's desktop feature table marks "Hair and Fur Grooms" supported on the deferred SM5 and SM6 paths, including Vulkan. — [Epic, Supported features by rendering path (desktop)](https://dev.epicgames.com/documentation/en-us/unreal-engine/supported-features-by-rendering-path-for-desktop-with-unreal-engine)
- Older Linux problems, all from the UE 4.26/4.27 era (dated):
  - A crash in the hair ambient-occlusion pass on Linux. — [UE-107672](https://issues.unrealengine.com/issue/UE-107672)
  - A Vulkan depth-stencil ensure. — [UE-100708](https://issues.unrealengine.com/issue/UE-100708)
  - Packaged Linux builds drew cards instead of strands until a source change was made. — [UE forum, MetaHuman groom/HairStrands on Linux/Vulkan](https://forums.unrealengine.com/t/metahuman-groom-hairstrands-on-linux-vulkan/498241)
- **MetaHuman on Linux:**
  - MetaHuman Creator runs on Linux and macOS since 5.7. Identity and Performance creation, and Conform from Identity, are disabled there, because marker tracking is DirectX 12 only.
  - MetaHuman Animator gained Linux and macOS support in 5.8.
  - Sources: [MetaHuman 5.7 release notes](https://dev.epicgames.com/documentation/metahuman/metahuman-5-7-release-notes); [MetaHuman 5.8 release notes](https://dev.epicgames.com/documentation/metahuman/metahuman-5-8-release-notes-in-unreal-engine?lang=en-US).
- A user post about UE 5.7.1 on Linux says SM6 has to be enabled for the Linux target in Project Settings. — [CachyOS forum](https://discuss.cachyos.org/t/nvidia-issue-with-unreal-engine/19812)

### Inferences
- **MHR as our archetype head.**
  - Every cast member is the same MHR mesh with a different shape: the same topology and the same UVs, as long as the FBX's UVs are kept.
  - Epic's UV-matching condition is therefore met for any groom authored on the MHR base head.
  - The workflow:
    1. Groom once on the base head.
    2. Bind directly to the base mesh, with no source mesh.
    3. For each cast member, make a binding with Source = MHR base and Target = that member's mesh.
  - This mirrors how MetaHuman refits grooms from `SKM_MH_Groom_Head`.
- **Use the UV-carrying FBX head for grooming, not `MHR_head.obj`.** The OBJ has no UVs, so root UVs and scalp-UV-driven colour would be lost.
- **If a cast member's shape lives in morph targets on one shared skeletal mesh**, rather than baked into a separate mesh, one binding may serve everyone, provided bound grooms follow morphs through the skin cache. Only a dated thread supports that; test it in 5.8.
- **MetaHuman-format grooms (Epic's or Fab's)** are authored on a head with different UVs, so the binding transfer cannot move them to MHR. Each one needs a one-time refit, a mesh-to-mesh wrap of the curves onto the MHR head in Blender (untested), and is then bound as a native MHR groom.
- **Blender's built-in exporter is probably not enough on its own.** The manual's "zero-width curves" plus Unreal's 1 cm width fallback mean grooms exported without `groom_width` would render far too thick unless the width is set some other way. Plan on an exporter that writes the `groom_*` attributes:
  - GroomForge Pro (paid).
  - The free Groom Exporter, which is documented only for Windows and Blender 4.1.
  - A small exporter of our own. Whether a usable Alembic Python module exists on Arch is untested.
- **Costs for our scenes.**
  - A first-person romance close-up has one or two characters on screen and runs on an RTX 3090.
  - That fits the case where strands are affordable: LOD 0 and 1 strands for close-ups, cards from LOD 2 down.
  - Strand cost is unmeasured, so profile one groom early with `stat GPU` and Insights.
- **Linux.**
  - The Linux editor is listed by Epic as strand-capable, and MetaHuman Creator, which renders grooms, now runs on Linux. The editor side looks supported.
  - Packaged Linux builds have a history of falling back to cards, so test any Linux package.

### Gaps
- No measured cost for a strand groom in UE 5.6–5.8 on an RTX 3090: no Epic number and no independent benchmark. It has to be profiled.
- Unconfirmed whether Blender 4.2+'s native Alembic export writes curve radius as Alembic widths, or any custom attributes that Unreal maps to `groom_*`.
- Unconfirmed in 5.8 whether bound grooms follow morph targets; the only evidence is a UE 4.25 thread.
- The exact current Linux row of Epic's groom platform table: the two search extracts conflict, and the page could not be opened.
- Whether the Groom Dataflow (5.7/5.8) can refit an existing groom to a different head in the engine. The 5.7 notes mention "mesh-based manipulation", but no details were found.

## 2. Hair cards: Epic's Hair Card Generator, Blender card tools, texture atlases, close-up quality

### Takeaway
Epic's Hair Card Generator is still marked experimental and works from a strand groom, so you make the strands
first. In 5.8 it is integrated into Dataflow. Its Python machine-learning dependencies (torch, scipy,
scikit-learn, moderngl, PyOpenGL and others) are the main source of failures in 5.6 and 5.7. Every documented fix
is a Windows path, and no evidence for or against Linux was found.

The Blender card tools found are all paid but cheap ($13–$40, HairTG $120). Cards are the industry standard for game
hair and cheap to render, but they take craft to read as volume and look flatter than strands up close.

### Cited Findings
**Epic's Hair Card Generator**
- An experimental plugin, enabled under Edit > Plugins > Geometry, that converts strand grooms into cards inside the Groom Asset Editor's Cards panel. Epic says later releases aim to handle more complex styles. — [Epic, Hair Card Generator for grooms](https://dev.epicgames.com/documentation/unreal-engine/hair-card-generator-for-grooms-in-unreal-engine)
- Its plugin-index page lists the dependencies as Groom, a Python package plugin (rendered "Python ML Package" in the search extract) and Editor DataflowGraph. The plugin sits at `Engine/Plugins/Experimental/HairCardGenerator/`. — [Epic API, HairCardGenerator plugin index](https://dev.epicgames.com/documentation/unreal-engine/API/PluginIndex/HairCardGenerator?lang=en-US)
- **In UE 5.8** the generator is integrated into Dataflow: the generation pipeline is a node graph. It is still described as an experimental tool for generating cards from strand grooms. — [Epic, Hair Card Generator in Dataflow](https://dev.epicgames.com/documentation/metahuman/hair-card-generator-in-dataflow-in-unreal-engine?lang=en-US)
- A Python API class (`HairCardGeneratorPluginSettings`) holds a copy of the settings so the groom isn't changed until generation finishes. — [Epic Python API](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/HairCardGeneratorPluginSettings)
- **Dependency problems reported on the forums:**
  - Users install numpy, PyYAML, scipy, addict, torch, scikit-learn, moderngl, Pillow, pyrr and PyOpenGL (one also needed opencv-python). They use the engine's own Python at `Engine\Binaries\ThirdParty\Python3\Win64`, and one pins numpy to 1.26.x. — [UE forum, Hair card generator error](https://forums.unrealengine.com/t/hair-card-generator-error/2567348)
  - In 5.6, a numpy conflict between the OpenCV and Python Foundation plugins broke the generator; one user said 5.7.1 fixed it. — [UE forum, posts #6–#8](https://forums.unrealengine.com/t/hair-card-generator-error/2567348/8)
  - Community advice: let the editor run its pip step once, then install from the generated `merged_requirements.in`. — [UE forum, Tutorial: Hair Card Generator](https://forums.unrealengine.com/t/tutorial-hair-card-generator/1918784)
  - In 5.7, card generation failed (MetaHuman hair included) with a missing `yaml` module. — [UE forum, Hair card generator error (5.7)](https://forums.unrealengine.com/t/hair-card-generator-error/2691938)
- **Linux:** no source mentions the generator running on Linux, either way. — searches across the [Epic docs](https://dev.epicgames.com/documentation/unreal-engine/hair-card-generator-for-grooms-in-unreal-engine) and the forum threads above.

**Blender card add-ons (all paid; vendor claims)**
- **Simple Hair Cards ($14.99):**
  - Blender support is listed as 4.2 LTS to 5.2 LTS, and elsewhere as built for 4.3 and tested on 4.2, 4.5 and 5.2.
  - It has curve strand drawing, combing brushes, and five strand profiles (round, ribbon, cross, braid/rope, custom).
  - It bakes Color, Alpha, Roughness, Normal and AO, and has a UV editor for laying out atlas cells.
  - Source: [Superhive](https://superhivemarket.com/products/simple-hair-cards).
- **Curve-BStrands:** for Blender 5.1+, in beta. It bakes a whole atlas sheet into ten texture maps. — [Superhive](https://superhivemarket.com/products/curve-bstrands)
- **Fiberbake ($39.99 for a single artist):** bakes up to 12 maps in one pass and has an atlas packer. — [Superhive](https://superhivemarket.com/products/fiberbake-hair-cards)
- **Hair Card Studio, PixelicaCG ($12.99):**
  - One reviewer said it had no normal, depth, AO, flow or strand-ID maps, and strands only from −Z to +Z.
  - Another reviewer says the author has since added normal baking.
  - Source: [Superhive ratings](https://superhivemarket.com/products/hair-card-studio-hair-card-creator-addon-for-blender/ratings).
- **Keratin (Hair Card Studio):** a Blender add-on that makes cards for Unreal, Unity and other engines. — [Superhive docs](https://superhivemarket.com/products/hair-card-studio/docs)
- **HairTG – Hair & Fur ($120):** a procedural hair and fur texture generator plus a card utility; its listing says Blender 3.x, which may be outdated. — [Gumroad](https://eyosido.gumroad.com/l/hairtg-hairandfur); [Polycount thread](https://polycount.com/discussion/211094/hairtg-hair-fur-procedural-hair-fur-texture-generator-and-3d-hair-card-utility-master-thread)
- **Pro Hair Suite** converts existing card geometry back into Blender hair curves; tested on Blender 4.5–5.1. — [Superhive docs](https://superhivemarket.com/products/blender-pro-hair-suite-addon/docs)
- An older free-standing card generator for Blender 2.93/3.0 was covered by 80.lv; it is dated. — [80.lv](https://80.lv/articles/a-powerful-tool-for-hair-tasks-in-blender)

**How cards look up close**
- Cards are "the current standard in the game industry" for real-time hair: a groom is made in a DCC tool and then rebuilt as card meshes. — [80.lv, Creating hair for real-time game characters](https://80.lv/articles/creating-hair-for-real-time-game-characters/)
- EA's Frostbite team describes strand hair as the newer, costlier alternative to cards. — [Frostbite, Hair rendering and simulation part 2](https://ea.com/frostbite/news/frostbite-hair-rendering-and-simulation-2)
- Strands are "easier to make look good". Cards "require deliberate craft": placing planes so they read as volume, hiding the seams, and baking texture sets. — [Strayspark (2026)](https://www.strayspark.studio/blog/blender-hair-grooming-to-unreal-engine-pipeline-2026)
- Epic's docs show MetaHuman grooms side by side as strands and as cards. — [Epic, Hair rendering and simulation](https://dev.epicgames.com/documentation/unreal-engine/hair-rendering-and-simulation-in-unreal-engine)

### Inferences
- **The cheapest card route is Epic's generator,** run on the same strand groom, writing LOD 2 and below into the same groom asset. It costs nothing and reuses the groom.
  - The risk is the Python dependency stack on Linux: torch and OpenGL bindings inside the engine's bundled Python.
  - Test this on the user's machine before relying on it.
  - If it fails, the fallback is a Blender card add-on with atlas baking (Simple Hair Cards or Fiberbake are cheap). The cards then become a separate mesh LOD or a cards LOD imported into the groom.
- **For our close-up romance scenes,** cards should not be the LOD 0 hair. The sources agree strands look better up close, and our frame counts (one or two characters, RTX 3090) are where strands are affordable.

### Gaps
- Whether the Hair Card Generator, standalone or the 5.8 Dataflow version, runs on the Linux editor: no source found. To check on the user's machine: look in `Engine/Plugins/Experimental/HairCardGenerator/HairCardGenerator.uplugin` for a platform allow-list, then try generating cards.
- **Hair Tool**, the Blender add-on the brief names, did not appear in any search result, so its 2026 price and Blender 4.x/5.x support are unconfirmed.
- No add-on called **"HairModule"** was found.
- No source compares strands and cards side by side at first-person close-up distances.

## 3. MetaHuman grooms on non-MetaHuman characters: the licence and the binding

### Takeaway
**The licence.** Since June 2025 (MetaHuman 5.6), MetaHuman is part of the standard Unreal Engine EULA:

- MetaHumans can be used "with any engine or creative software".
- MetaHuman characters and animation are "Non-Engine Products".
- MetaHuman characters and outfits can be sold, for example on Fab.

No official text was found that addresses taking Epic's MetaHuman grooms (hair, brows, lashes, fuzz) and putting
them on a non-MetaHuman character. Under the 2025 terms it reads as very likely allowed inside a UE game, but
confirm it in the FAQ before shipping. Fab grooms carry their own Fab licence.

**The binding.** MetaHuman grooms are bound to Epic's archetype head, and a binding transfer requires matching
UVs, so they cannot be bound to an MHR head as they are. They need a refit: re-root the curves on the MHR head,
then bind them natively. The alternative is a rigid socket attach, which follows the head's motion but not its
shape.

### Cited Findings
- **Epic's official licence page:**
  - MetaHuman "is included as part of your standard Unreal Engine license, meaning it's free to use for anyone making under $1 million USD in revenue".
  - MetaHumans can be used "with any engine or creative software".
  - Its FAQ classes MetaHuman characters and animation as **Non-Engine Products** under the UE EULA, so using them at runtime in games built with other engines triggers no royalty.
  - Source: [metahuman.com/license](https://www.metahuman.com/license) (content from search extracts; the page could not be opened from here).
- **CG Channel on the June 2025 change:**
  - MetaHumans can be used in Unity or Godot.
  - MetaHuman characters and clothing can be sold on online marketplaces.
  - AI workflows are allowed, but MetaHumans may not be used to train or improve AI models.
  - Studios with more than $1 million a year in revenue need UE seat licences, quoted at $1,850 a year.
  - Source: [CG Channel, 4 June 2025](https://www.cgchannel.com/2025/06/you-can-now-sell-metahumans-or-use-them-in-unity-or-godot/); also [Digital Production](https://digitalproduction.com/2025/06/05/metahumans-graduate-ready-for-unity-godot-and-the-fab-cash-register/).
- Epic's 5.6 announcement says "new licensing options in the Unreal Engine EULA" let MetaHumans be used with any engine or creative software, and outfits can be packaged in the MetaHuman format and sold on Fab. — [MetaHuman leaves Early Access](https://www.metahuman.com/news/metahuman-leaves-early-access-with-a-feature-packed-new-release)
- **The older terms, superseded:** forum posts quote an earlier FAQ under which MetaHumans were licensed for use in Unreal Engine projects only. — [UE forum, The MetaHuman EULA is quite concerning (2021)](https://forums.unrealengine.com/t/the-metahuman-eula-is-quite-concerning/226965); the old [MetaHuman Creator EULA page](https://www.unrealengine.com/eula/mhc)
- **Wardrobe:**
  - Any MetaHuman-compatible hairstyle (head hair, eyebrows, eyelashes, mustache, beard, peach fuzz) can be added to a MetaHuman wardrobe.
  - Items added by hand are available only for the current MetaHuman Character asset.
  - Groom and Groom Binding assets can be bought on Fab or made in UE.
  - Sources: [Epic, Tailoring your own wardrobe items](https://dev.epicgames.com/documentation/metahuman/tailoring-your-own-wardrobe-items); [Epic, Hair and clothing tools](https://dev.epicgames.com/documentation/metahuman/hair-and-clothing-tools?lang=en-US).
- **Technical limit:** a binding transfer needs source and target to share the same UV mapping. — [Epic, Setting up bindings](https://dev.epicgames.com/documentation/en-us/unreal-engine/setting-up-bindings-for-grooms-in-unreal-engine)
  - A developer called using MetaHuman grooms on a new head harder than making custom clothes, because of "the way hair binding works to the specific topology and UV layout of the MH head". Their workaround was a helper socket plus a binding. — [UE forum](https://forums.unrealengine.com/t/using-metahuman-grooms-with-non-mhc-meshes/226299)
- **Fab hair outside MetaHuman:** some third-party listings in Fab's MetaHuman hair channel say they work in any engine or 3D package, or include an Alembic file for use outside UE. — e.g. [Real-time Long Straight Groom Hair for MetaHuman](https://www.fab.com/listings/8b32ef99-aebf-410a-bdb5-f89b800e2eb9); [Short Curly Hair, MetaHuman Groom & HairCard](https://www.fab.com/listings/49f976d8-0f5e-4b84-85a6-8e14401592b7) (which listing says which wasn't clear from the extract)
- **Fab licence terms** are covered in section 6.

### Inferences
- **Legally,** the 2025 terms are broad: MetaHumans are usable in any engine or DCC tool and can be sold. A MetaHuman groom on our own character in our own UE game therefore looks permissible. This is still a reading, not a quote, so the report should tell the user to confirm on the metahuman.com FAQ before shipping.
- **Technically,** reusing a MetaHuman groom on MHR takes a one-time refit per groom, by one of two routes:
  - Export or obtain the groom as Alembic. Some Fab grooms include one; exporting Epic's own Creator grooms out of UE is unverified. Then re-root the curves on the MHR base head in Blender and bind natively.
  - Attach it rigidly to the head bone. The hairline then won't follow a different skull shape.
- The forum report that MetaHuman's hair material misbehaves on custom grooms (Root UVs, Guide IDs, seed) suggests a refitted groom should keep its `groom_root_uv`, guide flags and per-strand seed if it is to keep the MetaHuman shader look.

### Gaps
- The exact metahuman.com FAQ wording on using MetaHuman parts (grooms, clothing) with non-MetaHuman characters: the page was policy-blocked, and no extract quoted that entry.
- Whether UE 5.8 can export a groom asset, Epic's MetaHuman grooms included, back to Alembic: only Epic's Houdini and XGen exporters were found.
- No documented case of a MetaHuman groom refitted to an MHR (or any non-MetaHuman) head, with results.

## 4. Eyebrows and eyelashes: groom vs cards vs painted vs mesh strips

### Takeaway
MetaHuman makes brows, lashes and peach fuzz as separate grooms:

- Strands at the top LODs. The facial-hair strand budget is 10k at LOD 0 and 5k at LOD 1.
- Cards or meshes below that, with a dedicated eyelash mesh and a mask texture at the lower LODs.

On our budget, for close-ups:

- **Brows:** a small strand groom over a painted brow base in the skin albedo.
- **Lashes:** a small strand groom for LOD 0–1, with a card or mesh strip as the fallback.

Painted brows alone only hold up for thin, straight brows.

### Cited Findings
- Each MetaHuman includes grooms for hair, eyebrows, eyelashes, fuzz (the fine facial hair), mustache and beard. Higher LODs use strand grooms; lower LODs use card- or mesh-based grooms. — [Epic, MetaHuman assets overview](https://dev.epicgames.com/documentation/metahuman/assets-overview)
- **MetaHuman facial-hair budgets:** strands 10,000 at LOD 0 and 5,000 at LOD 1; card vertices 15,000, 7,000, 3,000, 1,000 and 500 for LOD 0 to 4. — [Epic, MetaHuman LOD specifications](https://dev.epicgames.com/documentation/en-us/metahuman/platform-support-and-lod-specifications-for-metahumans)
- A community wiki says MetaHuman hair defaults to strands below LOD 2, cards for LOD 2–4, and meshes beyond that. — [RWTH VR wiki, Using MetaHumans in VR](https://git-ce.rwth-aachen.de/vr-vis/unreal-wiki/-/wikis/Unreal/Using-MetaHumans-in-VR) (community source)
- MetaHuman Creator's skin-material API has:
  - An opacity toggle for the eyelash material at lower LODs, which "can have both strands and cards".
  - A function that returns the mask texture used for the **eyelashes mesh**.
  - Source: [Epic API, FMetaHumanCharacterSkinMaterials](https://dev.epicgames.com/documentation/unreal-engine/API/Plugins/MetaHumanCharacterEditor/FMetaHumanCharacterSkinMaterials?lang=en-US).
- Artists' advice on Polycount:
  - Paint the brows as a texture "if they going to be thin and straight". For realism, use hair cards or spline grooming.
  - One hybrid uses a few thicker spline strands for volume with dithered cards for the wispy hairs, which the poster admits is "not realistic up close".
  - Lashes are often placed by hand.
  - Source: [Polycount thread](https://polycount.com/discussion/comment/2558745).
- Reallusion's Character Creator markets card-based brows and beards that conform to facial movement. It is commercial software. — [Reallusion, 3D Hair & Beard System](https://www.reallusion.com/character-creator/hair.html)

### Inferences
- Brow and lash grooms are tiny next to head hair: MetaHuman caps all facial hair at 10k strands at LOD 0. So **strand brows and lashes are the best quality per millisecond in a close-up**, while head hair carries most of the cost.
- A painted brow base under the strands hides thin spots and the LOD switch, and lets distant LODs drop the brow groom entirely.
- **Lashes and brows must follow blinks and brow raises.** Bound to the head through the skin cache, they follow whatever deforms the head mesh, bones or morphs (morphs unverified in 5.8, see section 1).
  - How an MHR face is animated (its own blend shapes, the ~120 shape records in our FBX, versus a MetaHuman face rig) decides whether this just works. That is outside the hair question but blocks it.
- **Peach fuzz** (vellus) is the most optional: an extra strand groom over the whole face. A skin-shader sheen is the cheap stand-in (an unverified craft assumption).

### Gaps
- No source on how MetaHuman's face material treats painted brows at the low LODs, or whether a brow texture is baked in.
- No close-up comparison of lash cards, mesh strips and strands from a primary source.
- Whether an MHR head's blink and brow motion comes from morphs or joints; this depends on the face-rig decision covered elsewhere.

## 5. Generative and automated hair (strands from a photo or text) and their licences

### Takeaway
Every photo- or text-to-strands model whose licence could be checked is **non-commercial**:

- **DiffLocks** explicitly bans "production of other artifacts for commercial purposes".
- **HAAR, NeuralHaircut, HairStep, MonoHair** and **CT2Hair** are CC BY-NC 4.0.
- **GaussianHaircut** and **Im2Haircut** are CC BY-NC-SA 4.0.

**Perm**'s code is MIT, but its weights come from USC-HairSalon, whose terms were not found, and it generates
from parameters, not from photos. **TANGLED**, **HairGPT** and a 2026 LRM paper have no confirmed code or licence.
**Hairmony** is a hairstyle taxonomy, not a generator. None of these can make shipped assets.

The usable "automated" route for a commercial game is procedural: **Sisir** (free, commercial use allowed per
2026 coverage, Windows only, Alembic out) or Blender's procedural hair nodes.

### Cited Findings
- **DiffLocks (Meshcapade / Max Planck, 2025):**
  - What it is: inference and training code that makes strand hair from one image, plus a 40K-hairstyle synthetic Blender dataset with about 100K strands per sample.
  - Output: inference can export a `.blend` and an **Alembic** (`--export_alembic`), but it needs a Blender **4.1.1** executable.
  - Licence: "Non-Commercial Scientific Research Use Only". It forbids "incorporation in a commercial product ... or production of other artifacts for commercial purposes". Derivatives inherit the licence, and pornographic use is also forbidden.
  - Sources: [GitHub, Meshcapade/difflocks (LICENSE, README)](https://github.com/Meshcapade/difflocks). The checkpoints need registration on the [project page](https://difflocks.is.tue.mpg.de/).
- **HAAR**, text-conditioned strand hairstyles (CVPR 2024): **CC BY-NC 4.0**; last commit 2024-10-09. — [GitHub, Vanessik/HAAR](https://github.com/Vanessik/HAAR)
- **NeuralHaircut** (ICCV 2023): **CC BY-NC 4.0**; last commit 2024-03-08. — [GitHub, Vanessik/NeuralHaircut](https://github.com/Vanessik/NeuralHaircut)
- **GaussianHaircut** (ETH AIT): **CC BY-NC-SA 4.0**; last commit 2025-01-16. — [GitHub, eth-ait/GaussianHaircut](https://github.com/eth-ait/GaussianHaircut)
- **HairStep:** **CC BY-NC 4.0**; last commit 2026-03-30. — [GitHub, GAP-LAB-CUHK-SZ/HairStep](https://github.com/GAP-LAB-CUHK-SZ/HairStep)
- **MonoHair:** **CC BY-NC 4.0**; last commit 2024-08-14. — [GitHub, KeyuWu-CS/MonoHair](https://github.com/KeyuWu-CS/MonoHair)
- **CT2Hair** (Meta, hair from CT scans): **CC BY-NC 4.0**. — [GitHub, facebookresearch/CT2Hair](https://github.com/facebookresearch/CT2Hair)
- **Im2Haircut** (ICCV 2025), single-view strand hair for avatars: built on 3D Gaussian Splatting (with the 3DGS licence); "the rest of the code is distributed under **CC BY-NC-SA 4.0**". — [GitHub, Vanessik/Im2Haircut README](https://github.com/Vanessik/Im2Haircut); [arXiv 2509.01469](https://arxiv.org/pdf/2509.01469)
- **Perm**, a parametric multi-style 3D hair model:
  - The code is **MIT**.
  - The checkpoints are trained on **Hair20k**, an augmented USC-HairSalon with 21,054 hairstyles.
  - Its to-do list still has "a reimplementation of our single-view reconstruction pipeline with a public license" unchecked.
  - Source: [GitHub, c-he/perm](https://github.com/c-he/perm).
- **USC-HairSalon:** 343 hairstyles in basic categories (long or short, straight or wavy), with no extremely curly or braided styles. No licence text was found. — [arXiv 2409.16863](https://arxiv.org/pdf/2409.16863)
- **TANGLED** (Feb 2025):
  - Generates 3D strands from images of "arbitrary styles and viewpoints": photos, anime and oil paintings.
  - Built on a MultiHair dataset of 457 hairstyles with 74 attributes, a latent diffusion model conditioned on multi-view line art, and a post-process for braids.
  - No public code was confirmed.
  - Sources: [arXiv 2502.06392](https://arxiv.org/abs/2502.06392v1); [project page](https://sites.google.com/view/tangled1).
- **HairGPT** (May 2026; ShanghaiTech University and Deemos Technology): models strands autoregressively, "strand-as-language". No code or weights confirmed. — [arXiv 2605.08824](https://arxiv.org/pdf/2605.08824); project page haiminluo.github.io/hairgpt (not opened)
- **"Strand-based Hairstyle Generation via Large Reconstruction and Multimodal Models"** (Aug 2026): no code found. — [arXiv 2608.13679](https://arxiv.org/pdf/2608.13679)
- **StrandHead** (text to 3D head avatars with separate hair): licence not checked. — [arXiv 2412.11586](https://arxiv.org/html/2412.11586v3)
- **Hairmony** (Meishvili et al., 2024) is cited by HairGPT as a hairstyle **taxonomy** grounded in anthropology and grooming, not a strand generator. — [HairGPT paper](https://arxiv.org/pdf/2605.08824)
- **Sisir**, the procedural route (July 2026):
  - A free standalone, guide-based grooming tool with Guides, Hair and Render modules.
  - Runs on 64-bit Windows; the Render module needs a DirectX 12 GPU.
  - Exports PLY and Alembic, with no FBX or USD. Card support is planned but not there yet.
  - The CG Channel article was "updated with the new free commercial licensing", and 80.lv calls it free for personal and commercial use.
  - Sources: [CG Channel](https://www.cgchannel.com/2026/07/sisir-is-a-promising-new-free-standalone-hair-grooming-tool/); [80.lv](https://80.lv/articles/sisir-new-guide-based-hair-grooming-tool); [Digital Production](https://digitalproduction.com/2026/07/29/sisir-free-hair-grooming-tool/).
  - The project already chose Sisir for custom cuts. — `/home/user/HorrorEngine/docs/DECISIONS.md` (2026-10-21)

### Inferences
- **For a game that may be sold, treat every model above as off-limits for shipped assets.**
  - DiffLocks's licence bans commercial artifacts outright.
  - The NC licences make "use the tool to make an asset for a commercial game" a commercial use of the licensed material.
  - Using them only as "reference" is a grey zone; the user should decide with legal advice, not by default.
- **Quality and fit.** Even for prototypes, these output raw strands, about 100K per DiffLocks sample. That's dense enough for UE strands, but it still needs guides, groups, width, root UVs, a refit to the MHR scalp, and cards. They save the shaping, not the pipeline work.
- **Coverage of our styles.** The training sets lean on basic styles: USC-HairSalon has no braids, while TANGLED targets braids and cultural styles. Long straight hair with bangs is well covered; twin tails are untested.
- **Sisir for MHR.** Sisir grooms on an imported head OBJ (per the project's notes), so it can groom directly on the MHR base head. Export that head with UVs, unlike the current `MHR_head.obj`. The catch is that it is Windows only and the user runs Arch; whether it works under Wine or Proton with DirectX 12 is untested.

### Gaps
- USC-HairSalon's licence, which decides whether Perm's weights can be used commercially.
- Code and licence status of TANGLED, HairGPT, StrandHead and the Aug-2026 LRM paper.
- Sisir's actual licence text: only press coverage was found.
- No commercial-licence photo-to-strands service was found. Whether Meshcapade sells commercial DiffLocks licences is not stated; the licence only requires its "prior written permission" for third-party distribution.

## 6. Asset sources: Fab licences, CC0 and CC-BY hair, anime mesh hair, physics for twin tails

### Takeaway
- **Fab:** its Standard licence (Personal or Professional tier, split at $100k revenue) lets assets be used in any
  engine, and CC-BY listings exist.
- **MetaHuman-format grooms on Fab** come bound to Epic's archetype head. On MHR they need the refit from
  section 3; prefer listings that include an Alembic file.
- **Free realistic grooms:** no CC0 or CC-BY realistic groom was found. Blender Studio's CC0 Human Base Meshes have
  no hair.
- **Anime hair:** VRoid sets a licence per model at export time, and the stylised Blender add-ons are paid.
- **Twin-tail physics:** Kawaii Physics is MIT and supports UE 5.3–5.8. The engine's own options are Niagara's
  groom solver for strands and 5.7's joint-based groom deformation.

### Cited Findings
- **Fab licences:**
  - Licence types are CC-BY (free) and Standard (free or paid).
  - Standard comes in Personal and Professional tiers, chosen by gross revenue over the last 12 months, with the cut-off at **$100,000**.
  - Products moved from the old UE Marketplace may carry the legacy UE Marketplace License, which Epic is phasing out.
  - Source: [Epic, Licenses and pricing in Fab](https://dev.epicgames.com/documentation/en-us/fab/licenses-and-pricing-in-fab).
- Epic, quoted in the press, says the Standard licence lets Fab assets (Megascans included) be used "in any game engine or tool", unlike the old Marketplace's UE-only terms. — [etcentric](https://www.etcentric.org/?p=188458); [Jon Peddie Research](https://www.jonpeddie.com/news/when-one-door-closes-another-opens/)
- Fab's MetaHuman channel has groom listings, free samples included (e.g. "FREE Sample – MetaHuman Hairstyle Male 11 Groom"). — [Fab, MetaHuman hair search](https://www.fab.com/search/channels/metahuman?tags=hair); [free sample listing](https://www.fab.com/listings/eb7f2500-56d2-49ed-bbf4-ce48f639b373?lang=en)
  - The project has already picked Fab grooms for an East Asian cast: Venice's free "Real-time Straight Hair with Air Bangs", "Anime Twin-Tail" and others. — `/home/user/HorrorEngine/docs/METAHUMAN_LOOKS.md` §3.5
- **Blender Studio Human Base Meshes:** CC0; v1.4.1, 49 MB; needs Blender 4.2+. It holds 17 meshes (bodies, heads, hands, feet, jaws, eyeballs), and no hair is mentioned. — [blender.org Asset Bundles](https://www.blender.org/download/demo-files/); [CG Channel (2023)](https://www.cgchannel.com/2023/06/download-blender-studios-free-human-base-meshes)
  - A forum request for a CC0 head built on them lists hair, brows and lashes as things still to add. — [Blender Artists](https://blenderartists.org/t/realistic-female-head-in-blender-cc0-license-solved/1636180)
- No CC0 or CC-BY realistic groom or card set turned up. The closest results were paid tools (Fiberbake) and Fab listings without open licences. — [Fiberbake](https://superhivemarket.com/products/fiberbake-hair-cards); [Fab starter kit](https://www.fab.com/listings/6a061f58-8dfc-4bce-b298-4cf5f943d8a4)
- **VRoid Studio (anime):**
  - Free. The 2018 beta announcement said characters can be used commercially.
  - The developers said formal terms were still being drafted then.
  - Models carry permission settings chosen at export (VRM). A guide recommends the VRM 1.0 settings that allow commercial use.
  - Hair items bought on BOOTH carry their sellers' own terms.
  - CC0 VRoid models exist on OpenGameArt.
  - Sources: [pixivision (2018)](https://www.pixivision.net/en/a/3681); [Blender Artists](https://blenderartists.org/t/vroid-studio-pixivs-free-character-creator-released/1117684); [CineV guide](https://docs.channel.io/cinev/en/articles/Creating-a-VRM-Character-f48ad4d9); [BOOTH item](https://booth.pm/en/items/8187987); [OpenGameArt](https://opengameart.org/content/vroid-studio-cc0-models).
- **Kawaii Physics:**
  - **MIT**, version 1.21.0, supports **UE 5.3 to 5.8**. The last commit was 2026-10-02.
  - It does sphere, capsule and plane collisions. The same content is on Fab.
  - Its 5.8 sample bundles a `KawaiiPhysicsToolset` for UE 5.8's experimental Unreal MCP plugin.
  - Sources: [GitHub, pafuhana1213/KawaiiPhysics (LICENSE, .uplugin, README)](https://github.com/pafuhana1213/KawaiiPhysics); [Fab listing](https://www.fab.com/listings/f870c07e-0a02-4a78-a888-e52a22794572).
- **Strand physics:** Niagara's XPBD groom solver works on guides with 4 to 32 points each (section 1), and 5.7 adds joint-based deformation for strands. — [Epic, Enabling physics on grooms](https://dev.epicgames.com/documentation/en-us/unreal-engine/enabling-physics-simulation-on-grooms-in-unreal-engine); [UE 5.7 announcement](https://www.unrealengine.com/news/unreal-engine-5-7-is-now-available)

### Inferences
- **Twin tails: strand groom.** Use the groom's own guide simulation, or 5.7's joint-based deformation. With joints, a bone chain posed by Kawaii Physics might drive the strands. That combination is untested and is the thing to prototype for the twin tails.
- **Twin tails: mesh or card hair.** Kawaii Physics on the hair bones is the proven route; it is what VRM and anime pipelines do.
- **Ready-made styles.** Buying is the fastest route when the style exists, as with Fab Standard-licence grooms that ship an Alembic. The refit to the MHR base head is a one-time step per groom. Fab assets are not CC0, so under the project's rules they stay in the user's project and out of shared files.
- **Anime look.** VRoid hair, or the paid Blender stylised-hair add-ons already listed in `docs/METAHUMAN_LOOKS.md` §3.3, give mesh hair that is cheap at runtime. It reads as anime, though, and won't match realistic MHR skin.

### Gaps
- The full text of Fab's Standard licence, for example any restriction on redistributing source files with a shipped game; the page was not reachable.
- VRoid Studio's current terms and platforms (Linux is not believed to be supported, but this was not verified).
- Whether the Niagara groom solver collides with a skeletal mesh's Physics Asset bodies for ponytail-to-shoulder collision: the docs extract does not cover collision.

## 7. Verdict: can one person and an AI assistant reach MetaHuman-like hair on MHR characters, by which route, and at what cost per character

### Takeaway
Yes for rendering quality, with one real bottleneck. Everything that makes MetaHuman hair look good is the engine's,
and none of it is tied to MetaHuman's mesh:

- strand rendering, binding with RBF, LODs with auto LOD, Niagara simulation, and the Hair Card Generator.

What MetaHuman adds on top is a library of professionally groomed styles, pre-fitted to one archetype head and
refitted automatically. We can rebuild the refit by making the **MHR base head our archetype**: groom once,
transfer the binding to every cast member, because they share MHR's UVs.

The bottleneck is **authoring the hairstyles**. Unreal provides no grooming tool; the free options are Blender
(on Linux) and Sisir (Windows only), and purchased MetaHuman grooms each need a one-time refit. MetaHuman-like
results depend more on groom craft than on the engine. No source gives hours per hairstyle.

### Cited Findings
- The engine has no grooming solution; grooms come from DCC tools as Alembic. — [Epic, Hair rendering and simulation](https://dev.epicgames.com/documentation/unreal-engine/hair-rendering-and-simulation-in-unreal-engine)
- Binding works across topologies when source and target share UVs. — [Epic, Setting up bindings](https://dev.epicgames.com/documentation/en-us/unreal-engine/setting-up-bindings-for-grooms-in-unreal-engine)
- Our MHR FBX meshes carry UVs and blend shapes. — local `/home/user/HorrorEngine/Content/Studio/Bodies/`
- MetaHuman grooms adapt because they are bound to `SKM_MH_Groom_Head` and rebound to each assembled character. — `/home/user/HorrorEngine/docs/METAHUMAN_LOOKS.md` §3.1
- MetaHuman ships hair, brows, lashes, fuzz and beard grooms, with strands at the top LODs and cards or meshes below. — [Epic, MetaHuman assets overview](https://dev.epicgames.com/documentation/metahuman/assets-overview)
- Strands are worth it for one or two hero characters on a high-end PC; cards for crowds and mid-range 60 fps. — [Strayspark (2026)](https://www.strayspark.studio/blog/blender-hair-grooming-to-unreal-engine-pipeline-2026)
- The card generator is experimental and dependency-fragile. — [UE forum](https://forums.unrealengine.com/t/hair-card-generator-error/2567348); [Epic, Hair Card Generator in Dataflow (5.8)](https://dev.epicgames.com/documentation/metahuman/hair-card-generator-in-dataflow-in-unreal-engine?lang=en-US)
- Every strand generator checked is non-commercial. — section 5 sources
- Sisir is free, including commercial use, but Windows only, with Alembic out. — [CG Channel](https://www.cgchannel.com/2026/07/sisir-is-a-promising-new-free-standalone-hair-grooming-tool/)

### Inferences
**Recommended pipeline (inference; each step needs a first-run test):**
1. **Make the MHR base head the archetype.** Bring the UV-carrying MHR FBX head into Blender; `MHR_head.obj` will not do because it has no UVs.
2. **Make the hairstyle on that head**, by one of three routes:
   - **Blender's hair curves:** free, runs on Linux.
   - **Sisir:** free, Windows only; give it the MHR head as an OBJ with UVs.
   - **A Fab groom:** buy one that ships an Alembic and re-root it on the MHR head once (a wrap).
   - Make brows and lashes the same way, as small separate grooms.
3. **Export Alembic with the `groom_*` attributes:** width, root UV, guides, group ids. The tools are GroomForge Pro (paid), the free Groom Exporter (documented for Windows and Blender 4.1 only), or a small exporter of our own. Blender's built-in export alone risks Unreal's 1 cm width fallback.
4. **Set up the groom in UE 5.8:**
   - Turn on the Skin Cache.
   - Make one Groom asset with strands at LOD 0–1 (Auto LOD for the head hair), and cards from the Hair Card Generator at LOD 2 and below (test on Linux; if it fails, use a Blender card add-on).
   - Simulate guides for long hair. For twin tails, try 5.7 joint-based strands, or mesh tails driven by Kawaii Physics.
5. **Bind it to every cast member:** a Groom Binding per member, Source = MHR base, Target = that member's mesh. If shapes are morph targets on one mesh, test whether one binding is enough.
6. **Brows:** a strand groom over a brow painted into the albedo. **Lashes:** a strand groom at LOD 0–1 with a card or mesh fallback. **Fuzz:** optional.

**Work per character (estimates, not sourced):**
- **Reusing an existing hairstyle** on a new cast member is mostly mechanical: a binding, colour and material settings, and an LOD check. The assistant can script it through the editor's Python API.
- **A new hairstyle** is the real cost, and it is artist time:
  - shaping, clumping, the bangs and the hairline;
  - then a cards pass;
  - then a look check under the game's three lights.
- **A purchased groom** costs one refit; the refit method is not yet proven.

**Compared with staying on MetaHuman:**
- MetaHuman's wardrobe auto-fits any MetaHuman-format groom with no refit.
- The MHR route gives that up but gains independence from MetaHuman Creator.
- If the faces still come from MetaHuman, as the 2026-10-20 decision says, the simplest hair route stays MetaHuman's wardrobe. The MHR hair route only pays off if heads also become MHR.

**Risks to test first, in order:**
1. A strand groom made in Blender and bound to the MHR head in the Linux editor: does it render, and what does it cost on the 3090?
2. Binding transfer between two MHR cast members.
3. The Hair Card Generator's Python dependencies on Linux.
4. Whether bound brows and lashes follow the MHR face's blinks.

### Gaps
- No source gives hours per hairstyle or per character for a custom groom pipeline, or a quality comparison of custom Blender grooms against MetaHuman's stock grooms.
- No first-hand report of a non-MetaHuman, custom-topology character with MetaHuman-quality strands in UE 5.6–5.8. Forum material is mostly MetaHuman-centred or dated.
- Several key Epic pages (bindings, platform support, card generator, MetaHuman licence FAQ) were read only through search extracts. The report should present version-specific details as "per Epic docs, to be confirmed in 5.8".
