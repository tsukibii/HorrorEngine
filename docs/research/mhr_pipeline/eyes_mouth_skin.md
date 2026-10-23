# Eyes, teeth, tongue, mouth interior and skin for custom MHR heads in UE 5.8

_Research notes, 2026-10-21. This sandbox's network policy blocked direct page reads from Epic (dev.epicgames.com,
unrealengine.com, metahuman.com), Blender (wiki, studio, docs), MakeHuman, the FLAME site, arXiv, Hugging Face, Fab,
Poly Haven, Sketchfab and 80.lv. Facts from those sites come from search-engine excerpts and are marked "(excerpt)";
treat them as one step weaker than a full read. GitHub pages and licence files were read directly. Facts marked
"local" were measured in this repo from Meta's MHR files in `Content/Studio/Bodies/` (the FBX parsed with a small
binary reader; no Blender in this sandbox)._

## 1. Licence-clean head parts: eyeballs, cornea, tear line, eye occlusion, teeth, gums, tongue, mouth cavity

### Takeaway
Two permissive sources cover nearly the whole set. **USC ICT-FaceKit** (MIT, 2020) has every Digital-Human-style
part: eyeballs (sclera and iris), lacrimal fluid, an eye "blend" mesh, eye occlusion, eyelashes, 32 teeth, gums and
tongue, and a mouth socket. It is built "in the style of" Epic's Digital Human and is "plug and play" with UE's eye
shaders, but it ships no textures. **Google's GNM Head** (Apache-2.0 code and weights, released July 2026) is newer
and anatomically richer: eyeballs with inner and outer parts, articulated upper and lower teeth with gums, an
articulated tongue, UDIM UVs with a tile per part, and a textures folder. It has no eye occlusion or tear-line mesh.
MakeHuman/MPFB2 is the only true CC0 set (eyes, teeth, probably a tongue), at game-asset fidelity. Blender Studio's
Human Base Meshes are CC0 and include an eye and a jaw, but they are sculpting bases. FLAME is non-commercial (an
"Open" variant is unverified) and has no teeth.

### Cited Findings
**ICT-FaceKit (USC Institute for Creative Technologies)**
- Light-model parts and sizes: face 9,409 vertices; head and neck 1,839; mouth socket 2,046; eye sockets 384 each; gums and tongue 2,977; teeth 4,412 (32 individual teeth indexed); eyeballs 1,570 each (sclera 770, iris 800); lacrimal fluid 204 each; eye blend meshes 24 each; eye occlusion 152 each; eyelashes 684 each, as poly strips; 26,719 vertices in all — [ICT-FaceKit README](https://github.com/ICT-VGL/ICT-FaceKit)
- The eye geometry "adopts the style of Unreal Engine's Digital Human Project", and the geometries are "plug and play with Unreal Engine's shaders" — [ICT-FaceKit README](https://github.com/ICT-VGL/ICT-FaceKit)
- 53 expression blendshapes and 100 PCA identity modes. The Light model has no albedo or texture maps (it includes a UV layout image). The full model "will be released under a different USC specific license". No registration is stated for the Light model — [ICT-FaceKit README](https://github.com/ICT-VGL/ICT-FaceKit)
- Licence: MIT, "Copyright (c) 2020 USC Institute for Creative Technologies". Use, copy, modify, merge, publish, distribute, sublicense and sell are all permitted, on condition that "the above copyright notice and this permission notice shall be included in all copies or substantial portions" — [ICT-FaceKit LICENSE](https://raw.githubusercontent.com/ICT-VGL/ICT-FaceKit/master/LICENSE)

**GNM Head (Google)**
- GNM ("Generative aNthropometric Model") "strives to be the most accurate and complete 3D parametric human model". Its first release is GNM Head; the technical report is dated 2026-07-28 (arXiv 2607.23687). The repo is Apache 2.0, "suitable for both non-commercial and commercial applications", with "controllable internal anatomy" (eyeballs, teeth, tongue) and NumPy, JAX, PyTorch and TensorFlow backends — [google/GNM](https://github.com/google/GNM)
- The weights (google/gnm-v3) are released under Apache 2.0, "suitable for both academic research and commercial applications" — [Hugging Face model card (excerpt)](https://huggingface.co/google/gnm-v3)
- Mesh components are skin, eyes, teeth and tongue (gums appear in the UV table). UVs come for quads and triangles, in a recommended UDIM layout and a legacy per-region layout; texture files (.jpg, .png) sit in a textures folder. Identity has 253 components (170 head, 3 eyeball, 80 teeth). Expression has 383 (100 left eye, 100 right eye, 150 lower face, 32 tongue, 1 iris), sampled semantically ("happy", "surprise"); FACS is not mentioned. Joints control neck and eyeball rotation; no jaw joint is named. Weights download automatically from Hugging Face Hub or Kaggle into `~/.cache/gnm/models/`, with no registration mentioned. Examples export OBJ through trimesh. Tested with Python 3.13. Trained on "binary gender categories and four broad demographic groups". A single texture can't go on `quad_uvs` because regions overlap; use the UDIM coordinates — [GNM shape README](https://raw.githubusercontent.com/google/GNM/main/gnm/shape/README.md)
- UDIM tiles 1001 to 1007 cover skin, left and right eye interior and exterior, teeth and gums, and tongue. Vertex groups: `left_eye`, `right_eye`, `eye_interiors`, `eye_exteriors`, `upper_teeth_and_gums`, `lower_teeth_and_gums`, `tongue`. The model `.npz` holds the template, bases, skinning weights and UV layout — [GNM gnm/shape folder](https://github.com/google/GNM/tree/main/gnm/shape)
- The report describes "articulated upper and lower dentition" and an "articulated tongue surface supporting inner-mouth deformation and speech articulations" — [arXiv 2607.23687 (excerpt)](https://arxiv.org/pdf/2607.23687)

**MakeHuman / MPFB2**
- All MakeHuman core assets are CC0: no payment, copyright notice or attribution needed. MPFB's code is GPL and MakeHuman's is AGPL — [MakeHuman licence page (excerpt)](https://static.makehumancommunity.org/about/license.html)
- Before a 2020 clarification, targets, proxies and the base mesh were treated as source code under AGPL — [MakeHuman FAQ (excerpt)](https://static.makehumancommunity.org/oldsite/faq/what_changed_regarding_the_license_in_2020.html)
- The "MakeHuman system assets" pack is CC0, covers "proxies, eyes, teeth…", and is the minimum MPFB2 users need; a July 2023 update added missing eye textures — [MakeHuman asset packs (excerpt)](https://static.makehumancommunity.org/assets/assetpacks.html)
- MPFB2's `LICENSE.ASSETS.md` is the CC0 1.0 Universal dedication — [mpfb2 LICENSE.ASSETS.md](https://raw.githubusercontent.com/makehumancommunity/mpfb2/master/LICENSE.ASSETS.md); MPFB 2.x needs Blender 4.2 or later — [mpfb2](https://github.com/makehumancommunity/mpfb2)
- MakeHuman eye textures are 1024×1024, in nine colours, CC0 — [OpenGameArt (excerpt)](https://opengameart.org/content/makehuman-system-assets-eyes)
- MakeHuman 1.0 alpha 7 improved the teeth using laser-scan data — [CG Channel 2012 (excerpt)](https://www.cgchannel.com/2012/11/makehuman-1-0-alpha-7-released/)
- The MakeHuman app repo's `data` folder lists eyes, eyebrows, skins and proxymeshes, but no teeth, tongue or eyelashes — [makehuman/data](https://github.com/makehumancommunity/makehuman/tree/master/makehuman/data)

**Blender Studio Human Base Meshes**
- Released June 2023 with Blender 3.6: 17 meshes, CC0, as a .blend for Blender 3.2 and later. They include individual parts such as feet, hands, heads, jaws and eyeballs — [CG Channel (excerpt)](https://www.cgchannel.com/2023/06/download-blender-studios-free-human-base-meshes)
- The bundle wiki lists "Base Mesh - Eye" and "Base Mesh - Jaw" — [Blender wiki (excerpt)](https://wiki.blender.org/features/asset_system/asset_bundles/human_base_meshes/)
- The Blender 4.0 update added a planar head and a generic head topology with shape keys, replaced the realistic male body with one based on scan data, and fixed the eye scale on the realistic assets — [Blender 4.0 asset bundles notes (excerpt)](https://developer.blender.org/docs/release_notes/4.0/asset_bundles/)
- A forum user says "the jaw with gums and teeth can also be extracted" from the bundle — [Blender Artists (excerpt)](https://blenderartists.org/t/realistic-female-head-in-blender-cc0-license-solved/1636180). An early planning post listed "Teeth, gums & tongue" as a target, not as shipped — [devtalk (excerpt)](https://devtalk.blender.org/t/asset-bundle-base-meshes/21535)

**FLAME (MPI)**
- FLAME 2017, 2019, 2020 and 2023 and the Blender add-on are under an academic licence for non-commercial scientific research, which excludes commercial use — [FLAME model licence (excerpt)](https://flame.is.tue.mpg.de/modellicense.html)
- Downloading requires signing up and agreeing to the model licence — [TF_FLAME README (excerpt)](https://github.com/TimoBolkart/TF_FLAME)
- FLAME has an articulated jaw, neck and eyeballs but no teeth. GaussianAvatars used FLAME 2023 for its revised eye regions and added 168 triangles of teeth by hand — [GaussianAvatars supplemental (excerpt)](https://openaccess.thecvf.com/content/CVPR2024/supplemental/Qian_GaussianAvatars_Photorealistic_Head_CVPR_2024_supplemental.pdf)
- A user post claims the MPI team confirmed that "FLAME 2023 Open" is free for commercial use; this is second-hand — [Hugging Face discussion (excerpt)](https://huggingface.co/3DAIGC/LAM-20K/discussions/2)

**Paid sets with every part (for comparison only)**
- One Head Wonder (paid): head, cornea, iris, caruncle, tear line, gums and teeth, tongue, a jaw rig, and materials — [Blender Market (excerpt)](https://blendermarket.com/products/one-head-wonder)
- Paid jaw, teeth and tongue rigs exist, for example a jaw-with-teeth-and-tongue generator and the Universal Human teeth and tongue rig — [Superhive (excerpt)](https://superhivemarket.com/products/jaw-with-teeth-and-tongue-base-mesh-generator), [Gumroad (excerpt)](https://cjones.gumroad.com/l/GJXZv)

### Inferences
- **Best combination for us:** ICT-FaceKit for the eye accessories (occlusion, lacrimal fluid, eye blend), because they follow Epic's Digital Human conventions and that is what UE's eye material expects. GNM for teeth, gums and tongue (articulated dentition and tongue, UDIM UVs, shipped textures), or ICT's teeth, gums and tongue if GNM's prove awkward to extract. GNM's "eye interior and exterior" tiles are probably the iris/sclera surface plus a cornea shell (Epic's older two-surface style). That is unconfirmed; check it before choosing GNM's eyes over ICT's.
- **Licence fit with the project's rule.** CLAUDE.md says assets are "CC0 or ours", but the project already ships MHR under Apache-2.0 with its licence file beside it ([local: Content/Studio/Bodies/README.md](../../Content/Studio/Bodies/README.md)). MIT (ICT) and Apache-2.0 (GNM) parts would follow the same precedent: keep the LICENSE and notice files next to them. That is the user's call; only MakeHuman and Blender Studio parts are strictly CC0.
- None of these parts match MHR's topology, so every route needs the fitting step in §6. Rigid parts (eyeballs, teeth) transfer easily; thin skin-hugging strips (occlusion, tear line, mouth-socket rim) are better regenerated from MHR's own lid and lip edges than warped from ICT's face.
- FLAME is out for a commercial game unless the "2023 Open" licence is confirmed in writing.

### Gaps
- I couldn't open Blender's .blend to confirm whether a tongue or cornea ships, or whether any materials or textures are included.
- MakeHuman's tongue asset and the full system-asset list are unconfirmed: the MakeHuman site was blocked, and the guessed `makehuman-assets` GitHub repo returned 404.
- FLAME 2023 Open's licence text is unverified (site blocked).
- GNM: vertex counts per part, whether its eye "exterior" is a cornea bulge, what the textures folder contains and at what resolution, and Kaggle's terms are all unverified (arXiv and Hugging Face blocked).
- I found no CC0 eye, teeth or tongue sets on Poly Haven, Fab or Sketchfab (those sites were blocked here), and Fab's licence terms were not checked.

## 2. How MetaHuman builds eyes and mouth, and whether its materials may go on our heads

### Takeaway
MetaHuman eyes are layered: an eyeball per side with a refractive Eye-model material (sclera, iris, pupil, and a
cornea with limbus controls), an eye shell, lacrimal fluid (the tear line) and an eye-occlusion sheet. The mouth has
a teeth mesh that the template API also takes as a separate input. Since UE 5.6, MetaHuman sits under the standard
UE licence, and MetaHumans may be used in any engine. I found **no explicit clause** on putting MetaHuman skin or
eye textures on non-MetaHuman meshes. There is a stated restriction on using MetaHumans to train AI models.

### Cited Findings
- Epic's Digital Humans sample (UE 4.27 era) has lacrimal fluid geometry for "the wetness that gathers underneath the eye and the lower eyelid", geometry that "softens the transition of the head geometry to the eyeball geometry", and eye parameters exposed in `MI_EyeRefractive_Bust` — [Digital Humans (excerpt)](https://dev.epicgames.com/documentation/en-us/unreal-engine/digital-humans?application_version=4.27)
- With the Eye shading model, one surface is enough: refraction through the cornea happens in the shader. The older method used two surfaces, the sclera/iris/pupil plus a wet cornea shell. Depth Scale sets how deep the iris sits, and the suggested IoR is 1.336 for the fluid under the cornea. Eye occlusion is a thin sheet over the eye fitted to the open eyelid area, with UVs filling 0 to 1, using material `MI_Eye_Occlusion_Mike` — [Digital Humans (excerpt)](https://dev.epicgames.com/documentation/en-us/unreal-engine/digital-humans?application_version=4.27)
- A translucent helper surface simulates ambient occlusion around the eye, giving soft shadowing near the eyelid and tear duct "because light will scatter through it". There are specular controls for the iris/cornea and sclera, and a vein-visibility control driven by the sclera colour map — [Photorealistic Character (excerpt)](https://dev.epicgames.com/documentation/en-us/unreal-engine/photorealistic-character?application_version=4.27)
- The MetaHuman character API has slots EyeLeft, EyeRight, EyeShell and LacrimalFluid — [EMetaHumanCharacterTeethAndEyesSlot (excerpt)](https://dev.epicgames.com/documentation/unreal-engine/API/Plugins/MetaHumanCharacter/EMetaHumanCharacterTeethAndEyesS-?lang=en-US). Cornea properties are Size, Limbus Softness and Limbus Color — [FMetaHumanCharacterEyeCorneaProperties (excerpt)](https://dev.epicgames.com/documentation/unreal-engine/API/Plugins/MetaHumanCharacter/FMetaHumanCharacterEyeCorneaProp-?lang=en-US). Eye properties come in iris, pupil, cornea and sclera groups — [MetaHumanCharacterEyeProperties (excerpt)](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/MetaHumanCharacterEyeProperties)
- `ImportFromTemplate` takes the left eye, right eye and teeth as separate static meshes, which must have MetaHuman's vertex counts — [ImportFromTemplate API (excerpt)](https://dev.epicgames.com/documentation/unreal-engine/API/Plugins/MetaHumanCharacterEditor/UMetaHumanCharacterEditorSubsyst-/ImportFromTempla-)
- Community reports: MetaHuman eyes are layered (sclera, iris, outer cornea, moisture). They rely on an `M_EyeRefraction` shader with screen-space or ray-traced refraction. A wrong depth or scale makes the cornea shell look offset, and changing the bones or the `eye_edge_ref` sockets detaches the shell — [UE forum (excerpt)](https://forums.unrealengine.com/t/metahuman-eyes-help-needed/2802326). On a custom template mesh, the eyeshell and edge clip into the eyeball, and custom versions of them can't be imported into Creator — [UE forum (excerpt)](https://forums.unrealengine.com/t/eyeshell-and-edge-not-aligning-to-eyeball-with-custom-template-mesh/2764072)
- MetaHuman uses grooms for hair, eyebrows, eyelashes, fuzz, moustache and beard — [MetaHuman assets overview (excerpt)](https://dev.epicgames.com/documentation/metahuman/assets-overview)
- Licence: MetaHuman "is included as part of your standard Unreal Engine license": free below $1 million in revenue, standard UE terms above that, and MetaHumans "can be used with any engine or creative software" — [metahuman.com/license (excerpt)](https://www.metahuman.com/en-US/license). No separate MetaHuman licence is needed; the UE licensing page is authoritative — [metahuman.com/llms.txt (excerpt)](https://www.metahuman.com/llms.txt)
- For UE 5.6 and later the UE EULA applies. The Creator EULA covers 5.5 and earlier, under which downloaded characters are "MetaHuman Content" under the Epic Content License Agreement — [MetaHuman Creator EULA (excerpt)](https://www.unrealengine.com/eula/mhc)
- MetaHumans may be sold on marketplaces and used in other engines; studios earning over $1M a year need UE seat licences — [CG Channel, June 2025 (excerpt)](https://www.cgchannel.com/2025/06/you-can-now-sell-metahumans-or-use-them-in-unity-or-godot/)
- MetaHumans may be used in "workflows that incorporate artificial intelligence technology", but not to train or enhance AI models. The EULA change log lists a restriction on using MetaHuman characters and animation curves with AI — [UE EULA change log (excerpt)](https://www.unrealengine.com/en-US/eula-change-log/unreal)
- The Epic Content License covers content from the Launcher Samples tab, Quixel Megascans and Marketplace listings — [UE FAQ (excerpt)](https://gateway.unrealengine.com/en-US/faq)

### Inferences
- The Eye shading model, the Substrate Eye BSDF and Subsurface Profile are engine features, so using them on our own heads raises no content-licence question. Epic's actual eye and skin material instances and textures are Epic content. They are probably usable inside a UE game, since no "MetaHumans only" clause turned up, but the project's rule already says Epic and MetaHuman content stays in the user's own project and never in a shared file ([local: CLAUDE.md](../../CLAUDE.md)). The licence-clean path is our own eye and skin materials built on those engine features.
- Because of the AI restriction, MetaHuman textures should not be fed to texture-generation models as training data. Whether using one as a conditioning image counts as an allowed "AI workflow" is unclear; avoid it.
- ICT-FaceKit's eye parts imitate the Digital Human layout, so they are the most likely to work with a Digital-Human-style refractive eye material with little UV fixing.

### Gaps
- No explicit Epic statement was found on applying MetaHuman skin or eye textures to non-MetaHuman meshes (the full UE EULA and FAQ text were blocked).
- Saliva and cartilage meshes, and how MetaHuman splits teeth, gums and tongue, were not confirmed from Epic documentation.
- The current (5.6 to 5.8) MetaHuman eye-material parameter names are not documented in what I found; the detailed eye pages date from 4.27.

## 3. UE 5.6–5.8 shading: the Eye model, Subsurface Profile vs Substrate, dual specular, and the texture set

### Takeaway
UE 5.8 has two valid routes. One is the legacy shading models: **Subsurface Profile with Burley and dual-lobe
specular** for skin, and the **Eye** model for eyes. The other is **Substrate**, production-ready since 5.7: a Slab
BSDF with mean free path plus a subsurface profile, and a dedicated **Substrate Eye BSDF**. For close-up skin,
Subsurface Profile with Burley is the proven path (MetaHuman's, and the one our glass-skin notes already assume).
Substrate earns its place for layers such as sweat, blood and wetness. The texture set MetaHuman bakes is the
reference: base colour, SRMF (specular, roughness, metallic, fuzz), normal, a tiny LOD normal, a scatter map, plus a
tiling micro-detail normal and optional animated wrinkle maps.

### Cited Findings
- The Eye shading model "simulates the surface of an eye". Choosing it turns the Custom Data slots into **Iris Mask** and **Iris Distance**. Epic calls it highly technical, with strong dependencies on shader code, geometry and UV layout, and recommends reusing the Digital Humans eye material as-is and swapping textures — [Shading Models in UE (excerpt)](https://dev.epicgames.com/documentation/en-us/unreal-engine/shading-models-in-unreal-engine)
- Field report: Iris Distance had no visible effect until the user made a world-space normal texture for the eye mesh — [UE AnswerHub (excerpt)](https://answers.unrealengine.com/questions/412119/view.html). A third-party eye shader needs Project Settings → "Clear Coat Enable Second Normal" for cornea normal detail — [Fab listing (excerpt)](https://www.fab.com/listings/31c329e0-58a1-4e1e-ac29-0a3b3678299f)
- Subsurface Profile: set the material's shading model to Subsurface Profile and assign a profile. Without one, a default is used that "is a close approximation to Caucasian skin". The profile can be overridden per material instance — [Subsurface Profile Shading Model (excerpt)](https://dev.epicgames.com/documentation/en-us/unreal-engine/subsurface-profile-shading-model-in-unreal-engine)
- Burley: tick "Enable Burley" in the profile; it needs Temporal Anti-Aliasing. Mean Free Path Color sets per-channel penetration and is scaled by Mean Free Path Distance (in cm); black turns SSS off, and very large distances cause artifacts. World Unit Scale sets the units. Dual specular: Roughness 0, Roughness 1 and Lobe Mix control the two lobes and how they combine — [Using a Subsurface Profile (excerpt)](https://dev.epicgames.com/documentation/unreal-engine/using-a-subsurface-profile-in-your-unreal-engine-materials). The path tracer only supports Subsurface Profiles with Burley enabled — [Path Tracer (excerpt)](https://dev.epicgames.com/documentation/unreal-engine/path-tracer-in-unreal-engine?lang=en-US)
- Python defaults: roughness0 = 0.75, roughness1 = 1.3, lobe_mix = 0.85 — [SubsurfaceProfileStruct 5.1 (excerpt)](https://docs.unrealengine.com/5.1/en-US/PythonAPI/class/SubsurfaceProfileStruct.html). In 5.6 the struct gained an implementation hint, so implementations can be mixed (for example high-quality skin beside cheaper ice) — [SubsurfaceProfileStruct 5.6 (excerpt)](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/SubsurfaceProfileStruct?application_version=5.6), [Break Subsurface Profile Struct (excerpt)](https://dev.epicgames.com/documentation/unreal-engine/BlueprintAPI/Utilities/Struct/BreakSubsurfaceProfileStruct?lang=en-US)
- Substrate moved to production-ready in UE 5.7. It blends material behaviours such as metal, clear coat, skin and cloth, with blood and sweat on skin as Epic's example — [UE 5.7 announcement (excerpt)](https://www.unrealengine.com/en-US/news/unreal-engine-5-7-is-now-available), [GameFromScratch (excerpt)](https://gamefromscratch.com/unreal-engine-5-7-released/)
- Substrate Slab: the subsurface profile (for screen-space SSS) "needs to be set up on both the Substrate diffuse node, and the material node". Slabs not at the bottom of the topology (for example, stacked vertically) only get the SimpleVolume SSS type. `use_sss_diffusion` chooses light diffusion or a wrap approximation — [MaterialExpressionSubstrateSlabBSDF (excerpt)](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/MaterialExpressionSubstrateSlabBSDF)
- Substrate's co-author: the SSS effect and colour come from Mean Free Path (or the Transmittance-To-MeanFreePath helper), and thickness should be plugged in too, since the two work together — [Substrate feedback thread (excerpt)](https://forums.unrealengine.com/t/substrate-feedback-thread/)
- Substrate Eye BSDF inputs: a corneal normal (sclera and cornea), iris distance, iris mask, iris normal, iris plane normal, diffuse and emissive colour, plus a subsurface-profile property — [MaterialExpressionSubstrateEyeBSDF (excerpt)](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/MaterialExpressionSubstrateEyeBSDF)
- MetaHuman face skin bakes Basecolor, SRMF, Normal, a 256×256 "Normal LOD" map and Scatter. The UE Cine pipeline bakes normal and specular maps up to 8K; UE Optimized tops out at 2K. Micro Skin Detail normals are disabled at LOD1, and at LOD3 a baked normal approximates the LOD0 mesh — [MetaHuman Materials and Textures (excerpt)](https://dev.epicgames.com/documentation/metahuman/metahuman-materials-and-textures)
- SRMF packs Specular, Roughness, Metallic and Fuzz. Creator's Texture Override accepts the face base colour, normal, cavity and animated (wrinkle) maps; roughness is not an override slot. 5.8 adds Material Overrides that assemble unbaked materials — [local: docs/METAHUMAN_LOOKS.md §2.2](../../docs/METAHUMAN_LOOKS.md). Epic documents a wrinkle-texture flipbook and filters for wrinkles, stubble, freckles and moles — [Skin Material Controls (excerpt)](https://dev.epicgames.com/documentation/metahuman/skin-material-controls?lang=en-US), [Skin Material Tools (excerpt)](https://dev.epicgames.com/documentation/metahuman/skin-material-tools)
- Micro normals carry "the small details of the skin such as pores and small imperfections"; meso normals carry "medium-sized details of the skin like the primary wrinkles" — [Digital Humans (excerpt)](https://dev.epicgames.com/documentation/en-us/unreal-engine/digital-humans?application_version=4.27)
- The 5.8 MetaHuman release notes, as found, have no skin- or eye-shading changes. They cover an experimental MetaHuman Crowd plugin with "optimized face textures" and MetaHuman Animator on Linux and macOS — [MetaHuman 5.8 release notes (excerpt)](https://dev.epicgames.com/documentation/metahuman/metahuman-5-8-release-notes-in-unreal-engine). In 5.7 the MetaHuman Creator UE plugin came to Linux and macOS — [UE 5.7 announcement (excerpt)](https://www.unrealengine.com/en-US/news/unreal-engine-5-7-is-now-available)

### Inferences
- **Skin, recommended:** Subsurface Profile shading model, a Burley profile tuned for the cast (the MFP colour sets the redness of light bleed), dual specular left near the defaults first, and a material driving base colour, normal (meso, blended with a tiling micro-normal), roughness, specular and a cavity term. Add Substrate only if the project already runs Substrate or a scene needs layered wetness or blood. If it does, set the profile on both the Slab and the material node, as the API notes say.
- The excerpt's description of which lobe is "softer" sits oddly with the default values (0.75 and 1.3). Read the tooltips in the 5.8 editor before tuning; the defaults behave like multipliers on the material's roughness.
- **Eyes, recommended:** one eyeball surface per side with the Eye model (or Substrate Eye) and refraction, an iris mask, a world-space or tangent iris normal (the AnswerHub report shows Iris Distance depends on it), an occlusion sheet with 0-to-1 UVs and a translucent darkening and blur material, and a lacrimal strip with high specular and low roughness. Epic's own advice (reuse their eye material and swap textures) means the eyeball's UVs should follow the Digital Human convention. That is one more reason for ICT's eyeballs.
- MetaHuman's quality comes largely from channel-packed maps feeding a well-tuned material. Matching the *inputs* is cheap; matching the *texture content* (scanned skin, wrinkle maps) is the expensive part (§4, §7).

### Gaps
- Epic's current (5.8) Eye-model documentation, its exact parameter behaviour, and recommended skin values (MFP colours, lobe values) were not reachable.
- Whether MetaHuman 5.8 materials are Substrate-native, and whether new 5.8 projects enable Substrate by default, are unconfirmed (one third-party summary says Substrate is on by default from 5.7; not verified).

## 4. Skin textures: free scans, procedural skin, textures from our photo references, AI tools, and MHR's UVs

### Takeaway
I found **no CC0 scanned face texture**. The only licence-clean scan is Lee Perry-Smith's 2010 head (CC BY 3.0,
attribution required). CC0 skin exists only as tileable synthetic materials. The realistic route is to **project
our own photo references onto MHR's UVs**, de-light, fill the unseen areas from a tileable base, and add a tiling
micro-normal. This is practical because **MHR does ship usable UVs**: one 0-to-1 tile, the same in every LOD, with
the head as a face-centred unwrap filling the top-left quadrant. AI texturers are built for objects, not
likeness, and their licences vary: TEXTure MIT on SD2-depth; MV-Adapter Apache code with unstated weight terms;
Hunyuan3D-2.1 excluded in the EU, UK and South Korea. Marigold-IID (Apache code, RAIL++-M weights, about 768 px) can
help estimate albedo.

### Cited Findings
**MHR's UVs (local measurements)**
- MHR's repo says nothing about UVs or textures. It lists 7 LODs (0 to 6), `lod?.fbx` rigs with identity and expression blendshapes, and 72 expression parameters ("Artist-sculpted, sparse semantic blendshape weights that follow FACS"), under Apache-2.0 — [MHR repo](https://github.com/facebookresearch/MHR)
- Every MHR FBX in the project (`MHR.fbx`, `MHR_hi.fbx`, `MHR_lod1.fbx`, `MHR_lod0.fbx`) carries one UV layer (`LayerElementUV` with `UVIndex`) and no material layer — [local: Content/Studio/Bodies/](../../Content/Studio/Bodies/)
- LOD1 has 18,439 vertices, 36,874 triangles and 19,455 UV points; LOD0 has 73,639 vertices, 147,274 triangles and 75,666 UV points. All UVs sit inside one tile (u and v 0.003 to 0.997) and cover 92% of it. Island bounds are identical in LOD0 and LOD1 — [local: MHR_lod0.fbx, MHR_lod1.fbx](../../Content/Studio/Bodies/)
- 11 UV islands. Head, neck and torso form one island: the head and neck fill the top-left quadrant (u 0 to 0.5, v about 0.5 to 1), face centred, ears to the sides, and the torso sits below. The eye and mouth regions are dense rings with sealed slits inside. The rest are two small pieces at upper-arm height (110 to 138 cm, probably shoulder or upper arm), two arms with hands (one island fully mirrored, with reversed winding), two legs and four foot pieces. No head triangle has reversed UV winding — [local: MHR_lod1.fbx, MHR_lod0.fbx](../../Content/Studio/Bodies/)
- The head (the top 22 cm, down to about the chin) takes 23.4% of UV area but only 6.8% of surface area: about 2.0× the body's linear texel density. A 4096² whole-body texture gives the head about 53 px/cm (body 26); an 8192² texture gives about 106 px/cm — [local: MHR_lod1.fbx](../../Content/Studio/Bodies/MHR_lod1.fbx)
- `MHR_head.obj` (face_mesh.py's template, cut from LOD0) has no UVs: 0 `vt` lines, 22,312 vertices, 44,520 faces — [local: Content/Studio/Bodies/MHR_head.obj](../../Content/Studio/Bodies/MHR_head.obj)

**Free scanned skin**
- "Infinite, 3D Head Scan by Lee Perry-Smith is licensed under a Creative Commons Attribution 3.0 Unported License. Based on a work at www.triplegangers.com", with "Do what you want with the files, but always mention where you got them from" — [three.js LeePerrySmith_License.txt](https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/LeePerrySmith/LeePerrySmith_License.txt). Released in 2010 as OBJ and ZTL with textures — [CG Channel 2010 (excerpt)](https://www.cgchannel.com/2010/09/infinite-realities-releases-free-photorealistic-head-model/). One redistributed copy notes the colour map renamed `lambertian.jpg` and the displacement saved as a 16-bit `bump.png` — [Infinite-Scan licence copy in Unity's SRP repo (excerpt)](https://plastichub.unity.cn/unity-tech-cn/ScriptableRenderPipeline/src/branch/namespace...SampleScenes/HDTest/GraphicTest/SSS/Infinite-Scan_License.txt)
- Ten24's free female head scan (8K albedo, normal, displacement) is not licensed for commercial use — [CG Channel 2023 (excerpt)](https://www.cgchannel.com/?p=150750)
- 3D.sk skin and head photo sets are paid — [RenderHub (excerpt)](https://www.renderhub.com/3d-sk/larry-steel-high-res-skin-texture-photo-set)

**CC0 and procedural skin**
- Sketchfab "Human Materials 1 (CC0)" has synthetic, seamless 2K materials with colour, AO, roughness, normal and displacement — [Sketchfab (excerpt)](https://sketchfab.com/3d-models/human-materials-1-cc0-be48a7526b304914b7c9f45c289b2ecf)
- Free CC0 human skin textures from 1K to 4K (diffuse, normal, height, AO), from sharetextures — [Gumroad listing (excerpt)](https://downloadforfree.gumroad.com/l/free-human-skin-textures-1k-2k-4k-5)
- Material Maker is MIT-licensed: node-based procedural textures and 3D painting, built on Godot — [material-maker](https://github.com/RodZill4/material-maker)
- The project's `glass_skin.py` already generates a UV-agnostic set (roughness, specular, cavity) for the glass-skin look — [local: docs/METAHUMAN_LOOKS.md §2](../../docs/METAHUMAN_LOOKS.md)

**Textures from photos, and de-lighting**
- FFHQ-UV builds UV textures from single photos with "even illuminations, neutral expressions, and cleaned facial regions" (over 50,000 maps). It projects the photo onto a fitted 3D face, masks out non-skin with face parsing, and colour-matches and blends frontal, left and right textures — [FFHQ-UV paper (excerpt)](https://arxiv.org/pdf/2211.13874). The code is MIT; no dataset licence is stated. It uses HiFi3D++ topology and depends on StyleGAN2/FFHQ, e4e, DPR and StyleFlow, plus the Microsoft Face API, which is "no longer accessible" — [FFHQ-UV repo](https://github.com/csbhr/FFHQ-UV)
- `face-projection` (PyPI) draws MediaPipe's canonical face-model UV map onto a face image — [PyPI (excerpt)](https://pypi.org/project/face-projection/1.0.0/). FreeUV (2025) recovers and completes facial UV textures without ground truth — [arXiv 2503.17197 (excerpt)](https://arxiv.org/pdf/2503.17197)
- Marigold's code is Apache-2.0; its models are under "RAIL++-M License". Marigold-IID-Lighting predicts albedo, diffuse shading and a non-diffuse residual; Marigold-IID-Appearance predicts albedo, roughness and metallicity — [Marigold repo](https://github.com/prs-eth/Marigold). It is fine-tuned from Stable Diffusion 2, with an effective resolution of about 768 px — [Hugging Face card (excerpt)](https://huggingface.co/prs-eth/marigold-iid-lighting-v1-1)
- Epic has its own face-texture synthesiser inside MetaHuman (`FMetaHumanFaceTextureSynthesizer`), only usable within MetaHuman — [API (excerpt)](https://dev.epicgames.com/documentation/unreal-engine/API/Plugins/MetaHumanCoreTechLib/FMetaHumanFaceTextureSynthesizer?lang=en-US)

**AI texture generation (for objects)**
- TEXTure: MIT; its default base model is `stabilityai/stable-diffusion-2-depth`, whose conditions must be accepted on Hugging Face — [TEXTure repo](https://github.com/TEXTurePaper/TEXTurePaper)
- MV-Adapter: Apache-2.0 code, no stated licence for its weights, built on SD2.1 and SDXL. It does text-to-texture and image-to-texture on a given mesh (output `_shaded.glb`) and needs CV-CUDA — [MV-Adapter repo](https://github.com/huanngzh/MV-Adapter)
- SyncMVD: text-guided texturing through synchronised multi-view diffusion, developed on Linux with NVIDIA GPUs; licence not confirmed — [SyncMVD repo (excerpt)](https://github.com/LIU-Yuxin/SyncMVD)
- Hunyuan3D-2.1: "TENCENT HUNYUAN 3D 2.1 COMMUNITY LICENSE AGREEMENT", which "DOES NOT APPLY IN THE EUROPEAN UNION, UNITED KINGDOM AND SOUTH KOREA". It has a clause for licensees above 1 million monthly active users, states "Tencent claims no rights in Outputs You generate", and its acceptable-use policy forbids some uses "without expressly and conspicuously identifying that the information and/or content is machine generated" — [Hunyuan3D-2.1 LICENSE](https://raw.githubusercontent.com/Tencent-Hunyuan/Hunyuan3D-2.1/main/LICENSE). The paint model has 2B parameters and needs 21 GB VRAM for textures (29 GB with shape) — [Hunyuan3D-2.1 repo](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1)

### Inferences
- **MHR's UVs are fit for texturing.** The head unwrap is face-centred, cylindrical-style, with no reversed triangles and no seam through the face. For close-ups, give the head its own material that samples a dedicated head texture by remapping the top-left quadrant: `uv' = (2u, 2v − 1)`. A 4K head-only map then gives about 106 px/cm, and 8K about 212 px/cm. The head, neck and torso are one island, so the head/body material split at the neck is a *texture* seam, not a UV seam: match colour across it or hide it under a collar. Alternatively, write a second UV channel for the head faces.
- **Rough close-up budget.** A face about 15 cm wide filling a 1920 px-wide frame needs about 128 px/cm on screen. A 4K head map (about 106 px/cm) roughly holds a 1080p extreme close-up; 1440p or 4K output wants 8K, or relies on the tiling micro-normal for sub-texel detail (which is what MetaHuman's Micro Skin Detail is for).
- **Photo-to-texture pipeline** (no ready-made tool fits MHR; FFHQ-UV is the closest recipe but uses HiFi3D++):
  1. Carry UVs. `face_mesh.py` bends MHR's own head, so UVs re-attach by vertex index from `MHR_lod0.fbx`. Keep the index map when cutting `MHR_head.obj`, which has none today.
  2. Solve each photo's camera from the landmark-to-vertex correspondences the tool already has (a PnP solve).
  3. Bake. For every texel, take its 3D point, project it into each photo and sample. Weight by visibility × a power of the cosine between the view ray and the normal × a skin mask from face parsing. Blend front and side(s), as FFHQ-UV does.
  4. De-light. Above all, capture in flat, diffuse light; cross-polarised if possible. Then divide out low-frequency shading, estimated by fitting a smooth (spherical-harmonics) light to the photo against the fitted mesh. Marigold-IID can help estimate the shading, but at about 768 px it is better used for the low-frequency term than as the final albedo.
  5. Fill the unseen scalp, back of the head, ears and under the chin from a CC0 tileable base, colour-matched to the projected skin.
  6. Normals and spec: a tiling micro-normal (pores, procedural or CC0), meso detail painted or derived carefully (high-pass albedo-to-normal looks fake up close), and roughness, specular and cavity from the existing `glass_skin.py` approach.
  7. Remove lashes, brows and stray hair baked into the photos where grooms will sit.
  8. Faces of real people stay out of shared files, as with `Content/Studio/Heads/` today.
- **AI texturers** (TEXTure, MV-Adapter, SyncMVD, Hunyuan3D Paint) don't preserve a specific face and carry base-model licence baggage (SD and SDXL weights, Hunyuan's territory rule and machine-generated disclosure). At most, use them to fill unseen regions or make variations, after a licence check. Hunyuan's 21 GB fits the RTX 3090's 24 GB, barely.
- The Lee Perry-Smith scan is useful as pore and normal reference, or as a base for a male cast member, with attribution. Its UVs don't match MHR's, so it would have to be landmark-aligned and baked across.

### Gaps
- Poly Haven, ambientCG and Texturing XYZ free samples, and the Wikihuman/Digital Emily data, were not checked (sites blocked).
- Licences not confirmed: FreeUV, SyncMVD, MV-Adapter's weights, and the Stable Diffusion 2-depth and SDXL weights that TEXTure and MV-Adapter download.
- No measurements found of how well Marigold-IID's albedo works on close-up faces.

## 5. Eyebrows: painted into the texture or separate (brief)

### Takeaway
Eyelashes must be separate geometry: they overhang the lid and cast shadow onto the eye. Brows read flat when only
painted. Use a soft painted brow base in the albedo under cards or a groom. MetaHuman does brows, lashes and fuzz
as grooms, and ICT ships lashes as poly strips. Another researcher covers grooms.

### Cited Findings
- MetaHuman grooms cover hair, eyebrows, eyelashes, fuzz, moustache and beard — [MetaHuman assets overview (excerpt)](https://dev.epicgames.com/documentation/metahuman/assets-overview)
- ICT-FaceKit eyelashes: 684 vertices per side, as poly strips — [ICT-FaceKit README](https://github.com/ICT-VGL/ICT-FaceKit)
- MetaHuman eyelash material settings differ at lower LODs — [FMetaHumanCharacterSkinMaterials API (excerpt)](https://dev.epicgames.com/documentation/unreal-engine/API/Plugins/MetaHumanCharacterEditor/FMetaHumanCharacterSkinMaterials)
- MakeHuman's data includes an eyebrows folder (MakeHuman core assets are CC0) — [makehuman/data](https://github.com/makehumancommunity/makehuman/tree/master/makehuman/data), [MakeHuman licence (excerpt)](https://static.makehumancommunity.org/about/license.html)

### Inferences
- Projected photos already contain the brows. Keep them as a soft density shadow in the albedo for mid shots, and add cards or a groom on top for close-ups. Where a groom will sit, thin the painted brow so the two don't double up.

### Gaps
- No measured comparison of painted and groomed brows at close range was found.

## 6. Fitting and rigging the parts onto a shaped MHR head automatically (headless Blender)

### Takeaway
Feasible as a deterministic script, but more than a parent-and-go. MHR already has the joints the parts need: eyes
under `c_head`, and `c_teeth` and the `c_tongue0..4` chain under `c_jaw`. But its skin is **sealed** (closed,
genus 0), so the script must cut the eye and mouth openings first. Then: fit the rigid parts by landmarks and
sphere fits; weight them rigidly to their joints; bind the thin skin-hugging parts (occlusion, tear line,
mouth-bag rim) to the skin with Surface Deform or Data Transfer, so they follow every expression; and add
**eyelid follow**, lid correctives driven by eye rotation, because nothing in MHR does that by itself.

### Cited Findings
- MHR's face joints (204 joints in all): `c_neck` → `c_head` → { `c_jaw` → { `c_teeth`, `c_jaw_null`, `c_tongue0` → `c_tongue1` → … → `c_tongue4` }, `l_eye` (+ `l_eye_null`), `r_eye` (+ `r_eye_null`), `c_head_null` } — [local: MHR_lod1.fbx](../../Content/Studio/Bodies/MHR_lod1.fbx)
- The FBX's 117 morph channels have generic names, `shape_c_0` to `shape_c_116` (45 identity plus 72 expression) — [local: MHR_lod1.fbx](../../Content/Studio/Bodies/MHR_lod1.fbx). The repo describes the 72 as sparse semantic FACS blendshapes, but the names were not found — [MHR repo](https://github.com/facebookresearch/MHR)
- MHR LOD1 is one closed, manifold surface: no boundary edges, no non-manifold edges, V − E + F = 2 (genus 0), all triangles. Eyes, mouth and nostrils are sealed — [local: MHR_lod1.fbx](../../Content/Studio/Bodies/MHR_lod1.fbx)
- Blender's Surface Deform modifier lets "an arbitrary mesh surface control the deformation of another" after a Bind. The target must not have edges with more than two faces, concave faces, doubled vertices, or faces with collinear edges. Sparse Bind (4.0 and later) records only weighted vertices — [Blender manual 2.83](https://docs.blender.org/manual/en/2.83/modeling/modifiers/deform/surface_deform.html), [Blender manual 4.0](https://docs.blender.org/manual/nb/4.0/modeling/modifiers/deform/surface_deform.html)
- MetaHuman's own eye shell is tied to bones and `eye_edge_ref` sockets; changing those detaches it — [UE forum (excerpt)](https://forums.unrealengine.com/t/metahuman-eyes-help-needed/2802326). On custom meshes the shell and edge clip into the eyeball — [UE forum (excerpt)](https://forums.unrealengine.com/t/eyeshell-and-edge-not-aligning-to-eyeball-with-custom-template-mesh/2764072)
- Lid follow in practice: "let the lids follow the gaze slightly", with eye-look morphs doubling as lid followers — [Convai MetaHuman guide (excerpt)](https://docs.convai.com/api-docs/plugins-and-integrations/web-plugins/convai-web-sdk/lipsync-and-blendshape/metahuman-limit-drivers-required-for-mha). Rig Logic stores and applies corrective expressions — [The tech behind MetaHuman Creator face rigs (excerpt)](https://www.metahuman.com/learning/the-tech-behind-metahuman-creator-face-rigs). Copy-rotation constraints on upper lids misbehave; commercial Blender eye rigs use hidden drivers that deform the lids as the eye looks to the corners — [Blender Artists (excerpt)](https://blenderartists.org/t/eye-controller-is-deforming-eyelids-and-eyelids-and-eyes-are-moving-when-head-is-moved/1406884)
- GNM drives eyeballs with joints and gives each eye 100 expression components — [GNM shape README](https://raw.githubusercontent.com/google/GNM/main/gnm/shape/README.md)

### Inferences
The method, all in Blender's Python module and runnable headless:
1. **Load** the shaped head as MHR LOD0 with UVs and shape keys, from the FBX or with UVs re-attached by index (§4).
2. **Cut.** Delete the faces inside each inner lid margin and between the lips. MediaPipe's eye and lip contours are already mapped to MHR vertices by `face_mesh.py`, and the sealed slits show in the UVs. Deleting faces keeps the remaining vertices' shape keys valid.
3. **Eyeballs.** Least-squares fit a sphere to the cut lid-margin loop, with a typical adult radius as a prior and the `l_eye`/`r_eye` joint position as a check on the centre. Scale the template eyeball uniformly, aim the iris down MHR's +Z facing, and weight it 100% to its eye joint.
4. **Lids hug the eye.** Shrinkwrap the lid-margin ring onto the eyeball with a small offset in the neutral shape. Then measure every blink and squint expression for lid-through-eye penetration by raycast, and correct those shape keys, which were authored on a sealed eye.
5. **Occlusion and tear line.** Generate strips from the lid-margin loop, lying on the eyeball, with 0-to-1 UVs as Epic's occlusion material expects. Or warp ICT's strips by landmarks. Bind them with Surface Deform to the cut head, and bake one shape key per MHR expression by evaluating the modifier on each. Transfer skin weights with Data Transfer (nearest face, interpolated) so skeletal motion follows.
6. **Teeth and gums.** Apply a similarity transform from template landmarks to the shaped head's mouth corners, subnasale, chin and `c_jaw` pivot. Weight the upper teeth to `c_head` and the lower to `c_teeth`. Check lip clearance in the neutral pose and in jaw-open.
7. **Tongue.** Weight along `c_tongue0` to `c_tongue4` by normalised distance along its axis, with smooth falloff.
8. **Mouth bag.** Fit it inside the cut lip loop and blend weights `c_head` ↔ `c_jaw` by height. Bind its rim to the lip loop as in step 5.
9. **Eyelid follow in UE.** An AnimBP or Control Rig reads each eye joint's rotation and drives lid-follow curves into morph targets: MHR's own look or lid shapes if they exist, or four generated correctives per eye (the upper and lower lid ring rotated about the eyeball centre by a fraction of the gaze angle).
10. **Checks**, in the project's measure-don't-guess style: per-expression penetration (lids vs eyeballs, lips vs teeth), part-to-skin gap stats, and a contact sheet of eye and mouth close-ups.

- MHR's mesh suits Surface Deform: manifold, all triangles, so no concave faces. Only degenerate (collinear) triangles need a check.

### Gaps
- MHR's 72 expression names are unknown here (generic in the FBX; not found in the repo page or by search), so I couldn't confirm whether eye-look, blink or lid shapes exist to reuse for lid follow.
- The `l_eye`/`r_eye` bind positions relative to the sealed eye surface were not read (no bind-pose node parsed); verify in Blender before relying on them as the eyeball centre.
- No published, MHR-specific part-fitting pipeline was found.

## 7. Honest verdict: how close to MetaHuman, and the minimum for "doesn't look wrong in close-up"

### Takeaway
Rendering is not the gap: we can use the very same engine features (the Eye model or Substrate Eye with
refraction, Burley SSS with dual specular, micro-normals). With ICT- or GNM-derived parts, a well-made photo-projected
skin and a tuned eye material, **static and slow close-ups can get close; mid shots and motion can look right**.
We will stay visibly behind MetaHuman in the tightest stills and in expression detail, because MetaHuman's lead is
content and rig:
- scanned-database skin synthesis with wrinkle maps;
- eye accessories tuned for years;
- Rig Logic's correctives (lid follow, lip seal and roll);
- grooms.

The minimum that "doesn't look wrong": refractive eyeballs, an occlusion sheet, a tear line and lashes; teeth with
gums, a tongue and a dark mouth bag; skin with de-lit base colour, normal, roughness/specular, cavity, a tiling
micro-normal and a Burley profile; and eyelid follow.

### Cited Findings
- The Eye model is "highly technical", and Epic recommends reusing its Digital Humans eye material and swapping textures — [Shading Models in UE (excerpt)](https://dev.epicgames.com/documentation/en-us/unreal-engine/shading-models-in-unreal-engine)
- MetaHuman's eye stack is eyeballs plus EyeShell, LacrimalFluid and occlusion — [EMetaHumanCharacterTeethAndEyesSlot (excerpt)](https://dev.epicgames.com/documentation/unreal-engine/API/Plugins/MetaHumanCharacter/EMetaHumanCharacterTeethAndEyesS-?lang=en-US), [Digital Humans (excerpt)](https://dev.epicgames.com/documentation/en-us/unreal-engine/digital-humans?application_version=4.27)
- MetaHuman bakes skin maps up to 8K (Cine) and adds Micro Skin Detail normals and wrinkle flipbooks — [MetaHuman Materials and Textures (excerpt)](https://dev.epicgames.com/documentation/metahuman/metahuman-materials-and-textures), [Skin Material Controls (excerpt)](https://dev.epicgames.com/documentation/metahuman/skin-material-controls?lang=en-US)
- ICT-FaceKit supplies every Digital-Human-style eye and mouth part under MIT — [ICT-FaceKit README](https://github.com/ICT-VGL/ICT-FaceKit); GNM supplies articulated teeth and tongue with UVs under Apache-2.0 — [GNM shape README](https://raw.githubusercontent.com/google/GNM/main/gnm/shape/README.md)
- MHR gives the head about 106 px/cm at 4K head-only, with no seam on the face — [local: MHR_lod1.fbx](../../Content/Studio/Bodies/MHR_lod1.fbx)
- The project's own decision of 2026-10-20 was that "we can't compete with MetaHuman in Unreal, so the desk's tools become editors *of* MetaHumans", and MetaHuman Creator's plugin runs on Linux from 5.7 — [local: docs/METAHUMAN_ROUTE.md](../../docs/METAHUMAN_ROUTE.md), [UE 5.7 announcement (excerpt)](https://www.unrealengine.com/en-US/news/unreal-engine-5-7-is-now-available)

### Inferences
- **What reads "wrong" first in a close-up**, in order:
  1. Eyes without refraction, occlusion or a wet line (dead, stuck-on eyes).
  2. Lids that don't follow the gaze, or that cut through the eyeball.
  3. A see-through or flat-lit mouth when the jaw opens, or teeth poking through the lips.
  4. Waxy skin: no micro-normal, uniform roughness, wrong SSS radius.
  5. Baked-in photo lighting or lash shadows.

  Texture resolution comes after all of these. With MHR's UVs, a 4K head-only map plus a tiling micro-normal is enough for 1080p close-ups.
- **Minimum parts:**
  1. Eyeballs with a refractive cornea (one surface, Eye model).
  2. An eye-occlusion sheet.
  3. A lacrimal (tear-line) strip.
  4. Eyelashes (strips or cards).
  5. Upper and lower teeth with gums.
  6. A tongue on the `c_tongue` chain.
  7. A dark mouth bag joined to the cut lips.

  Caruncle, saliva and brow grooms can wait.
- **Minimum maps:**
  - Skin: base colour (de-lit), normal (meso), roughness and specular (or one packed map), cavity, a tiling micro-normal with a mask, and a Burley Subsurface Profile (MFP colour tuned). Optionally a scatter mask and, later, wrinkle maps.
  - Eye: iris colour plus mask and height (or iris normal), sclera colour with veins, a sclera normal.
  - Teeth and gums: colour, normal, roughness. Tongue and gums also get SSS.
- **Effort and risk:** the parts and materials are about a week of scripted work plus tuning. The photo-projected skin is the open-ended part, and the deciding one for "MetaHuman-close". Eyelid follow and expression-penetration fixes are the riskiest rig work, because MHR's expressions were authored on sealed eyes and lips.
- **Against the existing MetaHuman route:** Mesh to MetaHuman from our MHR head gets Epic's eyes, teeth, skin synthesis and Rig Logic for free, but the result is Epic content that never leaves the user's project. The custom MHR route buys a shippable, licence-clean, self-owned character and MHR's own rig, at the cost of matching MetaHuman's eyes and skin ourselves. A sensible split: MetaHuman for hero close-ups if the user accepts that content stays local; the custom MHR stack for everything that must be shareable or procedurally varied.

### Gaps
- No public side-by-side comparison of custom-part heads against MetaHuman in UE 5.6 to 5.8 was found. The verdict above is a judgement from the cited components, not a measured result.
- The effort estimate is my own judgement; there is no source for it.
