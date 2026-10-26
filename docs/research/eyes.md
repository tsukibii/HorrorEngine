# Real-looking eyes: MetaHuman's eye outside Unreal, and eye shaders for the Studio

Research, 2026-10-26. The user's question: are there repos, on GitHub or off it, that **reverse-engineered
MetaHuman's eye** out of Unreal, or that make **real-looking eyes simply**, or **eye shaders** we can run in our own
local HTML and Python apps (the Character Studio: three.js r160 in the browser, a Python server)?

Searched: GitHub pages and raw files were read directly, so the licences and the shader code quoted below were read,
not taken from a search summary. Epic's and Unity's docs, Shadertoy, Godot Shaders, iryoku.com (Jorge Jimenez's site),
Valve's wiki, CryEngine's docs, Polycount and Blender Artists refused direct reads from here; what comes from them is
from search excerpts and is marked *(excerpt)*. Nothing was built: §4 is a plan for the user to choose from. The
earlier note on MetaHuman's eye **in Unreal** is docs/research/mhr_pipeline/eyes_mouth_skin.md §1 to §3 (ICT-FaceKit's
eye parts, GNM, the Eye shading model in UE 5.8); this one is about the browser.

## The Studio's eye now

From the code (`tools/character/eyes.js`, the eye section of `tools/character/index.html`): a sphere of 12 mm radius
per eye behind the opening cut in the skin, drawn through a stencil; one `MeshPhysicalMaterial` with a clear coat; the paint a
512×256 canvas in polar coordinates round the front pole (two iris tones, fibres, a pale ring, the limbal ring and its
soft edge, the pupil, sclera shading, corner pink); catchlights painted by the shader where the lights are; the lids'
shadow and the eye occlusion darkening it in the shader; a tear line strip along each lower lid that only reflects. The
scene already has a PMREM environment (four soft panels) for the glossy skin.

What it lacks beside MetaHuman's:

- the iris is painted **on** the eyeball, so it never shifts under a clear cornea as the eye or the camera turns (the
  biggest tell in a moving shot);
- no corneal bulge, so a highlight doesn't slide over a dome;
- the catchlights are paint, not reflections of what's round the eye;
- the iris is lit like a flat sticker (MetaHuman's iris is lit as a bowl, bright on the side away from the light);
- the limbus doesn't darken more when the eye is seen from the side.

## The answer, in short

1. **No open repo reverse-engineers MetaHuman's eye.** What exists is Unreal-only (guto88's shaders for Daz assets,
   "only for use within an Epic Unreal Engine project"), paid (the MetaHuman DNA Importer for Blender; Pautinka's eye
   pack for Unreal), or for rigging (Poly Hammer's MetaHuman DNA add-on, whose author says it's "not for rendering").
   Unity's and Unreal's own eye shaders are readable but licensed only for their engines.
2. **That matters less than it sounds: MetaHuman's eye is Epic's Digital Humans eye, and how it works is public**
   (Jimenez's 2012 and 2013 talks, Epic's 4.27 Digital Humans docs). Two permissively licensed engines rebuilt it:
   - **RoboPoets' Digital Humans for Godot 4** (MIT code, CC0 textures and eye model): Epic's approach and parameter
     set (Iris UV Radius, Limbus UV Width, Depth Scale), on one mesh, the refraction made in the shader from a
     mid-plane depth texture, plus parallax on the iris, pupil width and height, the limbus, sclera veins, an eye
     shadow, and an eye-occlusion blur. About 230 lines of Godot's shading language, a straight port to a three.js
     `onBeforeCompile`. **The closest thing there is to "MetaHuman's eye, open source".**
   - **O3DE's Eye material** (Apache-2.0 or MIT): Jimenez's refraction worked out on a sphere, with no depth texture;
     iris and sclera each with their own colour, normal and roughness; dual specular; subsurface. It fits our
     eyeball, which is a sphere.
3. **The simple recipe is the same in every engine that does it well** (Epic, Unity, O3DE, RoboPoets, Valve,
   CryEngine): refract the view ray at the cornea and look the iris up where the ray lands on a plane behind it; give
   the cornea a smooth dome normal and let it reflect the room, with no shine of the iris's own under it; light the
   iris as a bowl (the "caustic"); darken the limbus more at grazing angles; a sclera that's never white. §3 has the
   maths, §4 a plan for the Studio.
4. **On the Python side:** OpenSculptBoy (Apache-2.0, a Python character tool with a browser viewer) builds eyes as
   geometry and textures in Python and writes GLBs with a refracting cornea (glTF's transmission, volume and IOR
   extensions, which three.js reads); MPFB2's procedural eye is a Blender node tree. A Cycles render of a two-surface
   eye (OpenSculptBoy's `apply_eye_materials()`) would be a ground truth to measure our real-time eye against.

## 1. MetaHuman's eye, part by part

| Part | What it does | Described in | The Studio now |
|---|---|---|---|
| The eyeball (a mesh per eye, the corneal bulge in it) | sclera, iris, pupil and cornea in one material on the **Eye** shading model; the cornea's refraction is done in the shader (Depth Scale; IoR 1.336 for the fluid under the cornea) | Epic's 4.27 Digital Humans docs *(excerpt, eyes_mouth_skin.md §2)* | a sphere with the iris painted on it |
| Iris controls | rotation, primary and secondary colour, colour blend and its method, shadow details, the limbal ring's size, softness and colour, global saturation and tint | MetaHuman's Eye Material Controls *(excerpt)* | two iris tones, fibres, limbal ring, edge softness |
| Pupil | dilation, feather | same *(excerpt)* | a size |
| Cornea | size, limbus softness, limbus colour | the MetaHuman Python API *(excerpt, eyes_mouth_skin.md §2)* | a clear coat |
| Sclera | rotation (of the vessels), tint, transmission spread and colour, vascularity intensity and coverage | same page, its Chinese version *(excerpt)* | darker toward the rim, corner pink |
| Eye occlusion (`eyeshell`) | a translucent sheet over the eye that darkens and softens where the lids meet it | Digital Humans docs *(excerpt)* | the lids' shadow widened (Eye occlusion) |
| Lacrimal fluid (`eyeEdge`) | a wet strip along the lower lid | same | Tear line |
| The shading model | the iris lit by a normal of its own, bent concave (a "caustic normal"), apart from the cornea's specular | eukky's walk through `ShadingModels.ush` *(excerpt)* | one normal |

## 2. What exists, by use to us

### Usable here (permissive licences)

| Repo | Licence | What it has | How it fits us |
|---|---|---|---|
| [RoboPoets/digital_human](https://github.com/RoboPoets/digital_human) (Godot 4) | MIT code; art CC0 ("doesn't use any third-party assets") | `shaders/eye.gdshaderinc` (read): refraction and depth made in the shader on one mesh, from the eye's tangent map and a mid-plane depth texture; iris colour from a 3-channel mask and two colour pairs, or one of six iris textures; limbus width, darkness and power; pupil scale, x and y apart; parallax occlusion mapping on the iris; sclera veins (a power on the sclera texture); an eye shadow toward the rim; SSS 0.5 on the sclera, 0 on the iris. `eye_occlusion.gdshader`: the screen behind it, blurred. An eye model in `maps/showcase.glb`. Iris caustics are on its to-do list, not built | **the best port.** GLSL-like code, no engine calls but the matrices. Its textures (1024²; looked at here: blue, brown, the colour mask, depth, displacement, tangent, sclera colour and normal, all good, the iris finely fibred; amber, green, grey and hazel too) use Epic's Digital Humans layout: the eye's front half projected flat, the iris in the middle, up is up. On our sphere that layout can be computed from the eyeball's own position in the shader |
| [O3DE](https://github.com/o3de/o3de): `Gems/Atom/Feature/Common/Assets/Shaders/Materials/Eye/Eye_SurfaceEval.azsli`, `.../Assets/Materials/Types/Eye.materialtype` | Apache-2.0 or MIT, the user's choice | the refraction "based on" Jimenez (its comment cites iryoku.com's "stare-into-the-future"): the view ray refracted by 1/IOR (1.336), its length to the iris plane from the point's height above it on a sphere of radius 0.5 (`irisDepth` 0.423), the offset added to the iris's UV; the iris mask a sigmoid of the distance from the gaze axis (`irisRadius` 0.19, `limbusSize` 0.03); iris and sclera colour, normal and roughness each; dual specular; subsurface and transmission | the maths for a sphere, no depth texture: what our eyeball is |
| [blackears/godot_eyeball_shader](https://github.com/blackears/godot_eyeball_shader) (Godot) | MIT | a procedural iris from cells (octaves, lacunarity, jitter, a pinch toward the pupil), gradient colouring with a dodge ring and a multiply ring, a glassy cornea shader; no refraction | ideas for an iris drawn in the shader, sharp at any zoom |
| [lighttransport/procedural-eyeball-shader](https://github.com/lighttransport/procedural-eyeball-shader) (WebGL) | MIT | "W.I.P.": a GLSL fragment shader (credited to FMS-Cat) that draws an iris and sclera texture in long-lat coordinates; two commits | already WebGL; a source of procedural iris and sclera paint |
| [matmadness/HumanShaders](https://github.com/matmadness/HumanShaders) (Godot 4.5) | MIT code; art CC BY 4.0, two head scans on their own terms | an eye shader (iris and sclera textures and normals, a heightmap parallax, SSS) and an eye-wetness shader; "a work in progress and not actively maintained" *(excerpt)* | parallax only, no refraction: below RoboPoets |
| [zulubo/EyeShader](https://github.com/zulubo/EyeShader) (Unity) | MIT | "A PBR multipass eyeball shader for unity" | not read further |
| [infinia-yzl/opensculptboy](https://github.com/infinia-yzl/opensculptboy) (Python, a fork of NAVER's Anny) | Apache-2.0; its data CC0 (MakeHuman, MPFB2), MIT (ICT-FaceKit) | `docs/eyes.md` (read): an eyeball with the iris a shallow dome behind the limbus, a separate refracting cornea (a sphere of 7.8 mm through the limbus), a caruncle, a seamless eye texture (procedural iris with a collarette, limbal ring, warm sclera with veins), lashes and blinks; the GLB's cornea `KHR_materials_transmission` with `KHR_materials_volume` (3 mm) and `KHR_materials_ior` (1.376), the iris under it with no specular of its own; Blender's `apply_eye_materials()` for Cycles; a browser viewer | Python, like our tools: its numbers, its glTF route, and a Cycles reference |
| [ICT-FaceKit](https://github.com/ICT-VGL/ICT-FaceKit) | MIT | eye parts in Epic's Digital Human style (occlusion, lacrimal fluid, eye blend); no textures | in eyes_mouth_skin.md §1, for Unreal |
| MakeHuman, [MPFB2](https://github.com/makehumancommunity/mpfb2) | code GPL-3; assets CC0 | MakeHuman's nine CC0 eye textures (eyes_mouth_skin.md §1); MPFB2's procedural eye, "Eye model v1" (`src/mpfb/data/node_trees/procedural_eyes.json`, read: a Principled BSDF fed by node groups, IrisMain a Voronoi radiated from the centre, IrisBorder, IrisInnermostRing, a bump; no refraction) | the textures are CC0; the node tree's licence is unclear (it's JSON: "configuration files" are GPL code, "data contributing to the output" CC0), so ideas only |
| [met4citizen/TalkingHead](https://github.com/met4citizen/TalkingHead) (three.js) | MIT | the eyes' life (README, read): eye contact for a share of the time idle (0.2), speaking (0.5) and listening (0.5); a blink every 1 to 8 s (50 ms closing, 100 to 300 ms shut, 100 ms opening); ARKit eye-look shapes | for the eyes' motion on our ARKit-52 curves (`arkit_mhr.json`) |

### Reference only (licensed to their engine, or GPL)

| What | Licence | What it shows |
|---|---|---|
| Unity HDRP's Eye: `Runtime/Material/Eye/EyeUtils.hlsl` and `Eye.hlsl` in Unity-Technologies/Graphics (read) | Unity Companion License, "for Unity-dependent projects" | the view ray refracted at the cornea (IOR 1.3333) onto a plane behind it (`BUILTIN_IRIS_PLANE_OFFSET` 0.02; iris radius 0.22 on its model); the pupil dilated by remapping radii inside and outside it, the iris's rim kept; a limbal ring that darkens more as N·V falls; the diffuse lit by the iris's normal and the specular by the cornea's; caustics (§3.3), a cheap term or a LUT. Its eye works only on its own eye model, "By Design", because the refraction is tied to that mesh *(excerpt, Unity's issue tracker)* |
| Unity's Digital Human package (The Heretic, Enemies) | Unity Companion License | eye and teeth occlusion driven by markers; a blur of the normal buffer for the tear line |
| Unreal's Eye shading model, MetaHuman's eye material | the Unreal EULA (the engine's shaders aren't ours to port); MetaHuman's material and textures are Epic's | the look we're after; §1 |
| [CC/iC Blender Tools](https://github.com/soupday/cc_blender_tools) (Reallusion's characters in Blender) | GPL-3.0 | two eyes in Blender: a refractive one ("iris refractive transmission with depth control and pupil size") and a single-material parallax one that needs no screen-space refraction, so it takes full shadows and SSS in EEVEE; an eye occlusion ported from its Unity HDRP setup; tear line shaders |
| guto88/ShadersForDaz3dAssets | "only for use within an Epic Unreal Engine project" | an eye shader "based on" Epic's |
| Galacean (Ant Group's MIT web engine) | docs only | a digital-human eye in its docs: iris parallax, limbal ring, pupil dilation, "use the official eye model and swap textures" *(excerpt)*; I didn't find its source in the open repos (`galacean/engine`, `engine-toolkit`) |
| Valve's EyeRefract (Source) | docs | `$corneatexture`: RG a normal, B the parallax mask, A a lighting multiplier; `$parallaxstrength` (0.25); `$dilation`; a ray-traced sphere so the eyeball reads round *(excerpt)* |
| CryEngine 3's eye shader | docs | iris parallax mapping by default, pupil dilation, iris scattering *(excerpt)* |
| Shadertoy "Realistic Eye" (XsfGWj, 2013) | Shadertoy's default unless the page says otherwise (CC BY-NC-SA) | ray-marched, the iris's refraction ray-traced *(excerpt)*; not read |
| Godot Shaders' "Refractive Procedural Eye" | not stated in what I could see | corneal refraction on any sphere: iris size, pupil, cornea bulge, IOR about 1.376 *(excerpt)*; not read |

### MetaHuman itself

Since MetaHuman 5.6 (June 2025) MetaHuman characters may be used in any engine or creative software
(mhr_pipeline/metahuman_baseline.md §2 has the terms, the AI clauses and the $1M seat rule). So a side by side is
possible: a MetaHuman's eye next to ours in the Studio, its files kept local and out of git, like the local bodies in
`Content/Studio/Bodies/`. Whether the DCC Export (a zip of DNA files, `.png` and `.json`) carries the eye's textures is
unconfirmed *(excerpt)*. The project's rule stands: Epic's files never go into a shared file, so they can be a
reference, never our eye.

## 3. How the good ones do it (in our words)

### 3.1 The iris behind a refracting cornea (Jimenez; Epic, Unity, O3DE)

The iris is a nearly flat disc 2 to 3 mm behind the front of the cornea, in fluid (IOR 1.336). For each pixel of the
eyeball's front:

1. `n` the surface normal there (the cornea's), `v` the view direction into the eye, `g` the eye's gaze axis, `C` its
   centre, `R` its radius.
2. `t = refract(v, n, 1.0 / 1.336)`.
3. The point's height above the iris plane: `h = dot(P - C, g) - d`, the plane `d` from the centre along the gaze
   (O3DE: 0.846 R, about 10.2 mm on a 12 mm eye). Where `h <= 0` the pixel is sclera: no refraction.
4. Along `t` to the plane: `L = h / dot(-g, t)`, and the iris's point `H = P + L * t`.
5. The iris texture looked up flat at `H`: `uv = 0.5 + vec2(dot(H - C, right), dot(H - C, up)) / (2 * irisR)`, the
   Digital Humans layout.

The iris then sits behind glass: it slides against the limbus as the view turns, its far edge tucks under the cornea's
rim, and it reads as an eye in a moving shot. It needs no special mesh on a sphere. Watch for: a Toolbag user saw
refraction break between 70 and 90° *(excerpt)*, so keep `dot(-g, t)` off zero; and Unity's version only works on
its own eye model.

RoboPoets' version is Epic's mid-plane trick, for any mesh: the depth under each pixel is a texture (`iris_depth`) less
its value at the iris's edge, times Depth Scale (1.2), divided by `mix(0.3, 1.0, dot(v, eye_forward)²)` (the eye's
forward axis read per texel from a tangent map), times the refracted ray; that offset turned into the tangent frame and
added to the UV, scaled by Iris UV Radius (0.15). On our sphere, step 3's analytic height does the same job.

### 3.2 Two normals: the cornea shines, the iris doesn't

The specular and the reflections take a smooth dome (the cornea's bulge, with no normal map: a Polycount tip
*(excerpt)*); the iris's diffuse takes the iris's own normal. Unity's eye: the specular normal is the sclera's out to
the limbus and the mesh's own (the cornea's dome) over the iris; the diffuse normal the iris's. OpenSculptBoy: the iris
under the cornea gets no reflection of its own, since "a rough reflection there reads as a milky veil over the iris".
In three.js r160 the clear coat has its own normal (`clearcoatNormal` in the physical material's shader chunks), so the
cornea can be the clear coat and the iris the base layer with `specularIntensity` near 0. The dome on our sphere: past
the limbus, the front raised as a sphere of 7.8 mm (OpenSculptBoy's default), in the vertex shader or as normals only.
With a dome and the PMREM panels the Studio already has, the catchlights become real reflections that slide as the eye
turns.

### 3.3 Caustics: the iris bright on the side away from the light

The cornea focuses light onto the iris's far side. Unreal blends the iris plane's normal with the negated surface
normal (by iris mask times iris distance) into a "caustic normal" that makes the iris a little concave *(excerpt,
eukky)*; lit by it, the side away from the light is the one that catches it. Unity multiplies the light on the iris by
one plus a term that grows as the point's direction in the iris plane opposes the light's (squared), plus a sharp
bright term in the band where iris meets sclera on that side (a power of 20); behind a material flag it reads a LUT
instead (`EyeCausticLUT.hlsl`). Jimenez's 2012 demo had "view and light refraction,
caustics" *(excerpt)*. Cheap either way: a dot product per light.

### 3.4 The limbus

Every engine darkens the iris's edge and melts it into the white. Unity's ring darkens more at grazing angles (its
factor raised to a higher power as N·V falls), so it reads stronger when the eye is seen from the side, as in life.
RoboPoets: `1 - pow(length(uv - 0.5) * darkness, power)` (2.1 and 8). Our Iris edge softness already makes the soft
band; the N·V part is what's missing.

### 3.5 The sclera

Never white: a tint, veins coming in from the rim (RoboPoets: the sclera texture raised to a power; MetaHuman:
vascularity intensity and coverage, and a rotation), a warm transmission (MetaHuman: transmission spread and colour), a
soft shadow under the upper lid and pink at the corners (both ours already), a little SSS or wrap light (RoboPoets 0.5
on the sclera, none on the iris).

### 3.6 Occlusion and the tear line

RoboPoets' eye occlusion draws the screen behind it from a blurrier mip, so the lid's edge melts into the eye. CC/iC
Blender Tools ported Reallusion's Unity eye occlusion to Blender. Ours: the widened lid shadow and the tear line strip,
both built.

### 3.7 Numbers

| | Value | From |
|---|---|---|
| Eyeball | about 24 mm across | anatomy; ours a 12 mm radius |
| Iris (to the limbus) | 11.7 mm across | OpenSculptBoy's default |
| Pupil | 3.5 mm (3 to 4 mm in neutral light) | OpenSculptBoy |
| Cornea | front radius 7.8 mm, IOR 1.376, the anterior chamber 3 mm | OpenSculptBoy; Godot Shaders' eye *(excerpt)* |
| Fluid under the cornea | IOR 1.336 (Epic's suggestion, O3DE's default); 1.3333 (Unity); 1/1.33 (RoboPoets) | |
| Iris plane | 0.846 R from the centre (O3DE's 0.423 on a radius of 0.5) | O3DE |
| Iris radius in the engines' own units | O3DE 0.19 (of a 0.5 radius), Unity 0.22, RoboPoets 0.15 of the UV | |
| Limbus | O3DE 0.03; RoboPoets width 0.035, darkness 2.1, power 8; Unity a blend 0.02 either side of the iris's radius | |

## 4. For the Studio: a plan

**Built 2026-10-26** (DECISIONS): steps 1 to 4 in `tools/shared/eye.js`, worn by the Studio's eyes and by Studio
characters on the desk; the export's eyeballs carry the paint baked flat with the eye's shape and paint, and Unreal
refracts them again with M_StudioEye (step 7, untested in the editor). Steps 5 and 6 are still open.


In order of what each gives for what it costs, each one measured (STUDIO) before the next:

1. **The iris behind glass** (§3.1). In the eyeball's `onBeforeCompile` (it already gets the head's frame, `uToRig`):
   the iris looked up through the refracted ray, our paint drawn as a flat disc (the Digital Humans layout) instead of
   polar round the pole, the sclera painted where it is. Controls: Iris depth, IOR. STUDIO measures how far the iris's
   centre slides against the limbus 30° off axis (Snell's law gives the number) and that nothing tears at 80°.
2. **A cornea that reflects the room** (§3.2): the dome normal on the clear coat, the PMREM panels as real catchlights,
   no specular on the iris; the painted catchlights stay as a switch for a stylised look.
3. **The iris lit as a bowl, and the limbus at grazing angles** (§3.3, §3.4): a term per light, an N·V.
4. **Veins and a tint on the sclera** (§3.5), like MetaHuman's vascularity intensity and coverage.
5. **Photo irises, if wanted:** RoboPoets' CC0 textures (six colours, the colour mask with two colour pairs, sclera) as
   a choice beside the paint, recorded like the CC0 library (`Content/Studio/Library/LEDGER.json`); or the iris drawn
   in the shader after blackears' cells (always sharp); or made in Python with numpy after Shah and Ross (a background
   texture, then furrows, the collarette, crypts) *(excerpt)*.
6. **The pupil and the eyes' life:** a pupil feather; the pupil narrowing under the flashlight and opening in the dark
   (the POV lights); saccades and blinks after TalkingHead's timings and the "Eyes Alive" model (Lee, Badler and
   Badler); both eyes turning in on a near target.
7. **Unreal:** the flat iris layout is what Epic's eye material expects (eyes_mouth_skin.md §3: reuse its material and
   swap the textures), so the Studio's iris can go across as a texture on the export's eyeball, which now gets plain
   materials. **Built 2026-10-26, untested in the editor:** our own material instead (Epic's is Epic content), M_StudioEye
   (`Content/Python/storykit/people.py`, UNREAL_FLOW §1d): Clear Coat, the iris read through the cornea from the baked
   paint by two Custom nodes, the view brought into the eye's frame from the tangent space; UEEYE runs its HLSL as GLSL
   against a traced ray. Still open: the caustic (a second normal), occlusion and the tear line.

A Cycles render of the same eye (two surfaces, a real refracting cornea, after OpenSculptBoy's Blender setup) from a
few angles would be the ground truth to measure steps 1 to 3 against, as BLENDERLOOK does for the look.

## 5. Licences in one place

- **Port freely, keep the notice:** RoboPoets (MIT; textures and model CC0), O3DE (Apache-2.0 or MIT), blackears
  (MIT), lighttransport (MIT), matmadness (MIT code; its art CC BY 4.0, needs credit), zulubo (MIT), OpenSculptBoy
  (Apache-2.0), ICT-FaceKit (MIT), TalkingHead (MIT), MakeHuman's eye textures (CC0).
- **Read, don't copy:** Unity's HDRP and Digital Human code (Unity Companion License: Unity projects only), Unreal's
  shaders and MetaHuman's material (the Unreal EULA, Epic content), CC/iC Blender Tools (GPL-3.0), MPFB2's node tree
  (GPL-3 or CC0, unclear), guto88 (Unreal projects only), Shadertoy's defaults (non-commercial).
- The maths in §3 (Snell's law to a plane, a sigmoid mask, an N·V darkening, a far-side boost) is general and can be
  written fresh.

## 6. Gaps

- Not read directly (blocked here): Epic's and Unity's docs, Jimenez's slides (GDC 2013 "Next-Generation Character
  Rendering", a 324 MB deck whose slides 229 to 232 carry the eye's code *(excerpt)*; SIGGRAPH 2012's "Separable
  Subsurface Scattering and Photorealistic Eyes Rendering"; his post "Open Your Eyes", 2012-08-07), Valve's and
  CryEngine's pages, Shadertoy, Godot Shaders, CC/iC Blender Tools' docs. What's said of them is from excerpts.
- Not looked inside: RoboPoets' eye model (`maps/showcase.glb`), zulubo's shader, the Shadertoy eye, MatMADNESS's eye
  wetness shader, Galacean's eye (its source wasn't found).
- Whether MetaHuman's DCC Export carries the eye's textures.
- Whether GNM's "eye exterior" is a cornea shell (eyes_mouth_skin.md's open question) is still open.

## Sources

Read directly:

- RoboPoets, Digital Humans for Godot: [repo](https://github.com/RoboPoets/digital_human),
  [README](https://raw.githubusercontent.com/RoboPoets/digital_human/main/README.md),
  [LICENSE.md](https://raw.githubusercontent.com/RoboPoets/digital_human/main/LICENSE.md),
  [eye.gdshaderinc](https://raw.githubusercontent.com/RoboPoets/digital_human/main/shaders/eye.gdshaderinc),
  [eye_occlusion.gdshader](https://raw.githubusercontent.com/RoboPoets/digital_human/main/shaders/eye_occlusion.gdshader),
  [textures](https://github.com/RoboPoets/digital_human/tree/main/textures)
- O3DE: [LICENSE.txt](https://raw.githubusercontent.com/o3de/o3de/development/LICENSE.txt),
  [Eye_SurfaceEval.azsli](https://raw.githubusercontent.com/o3de/o3de/development/Gems/Atom/Feature/Common/Assets/Shaders/Materials/Eye/Eye_SurfaceEval.azsli),
  [Eye.materialtype](https://raw.githubusercontent.com/o3de/o3de/development/Gems/Atom/Feature/Common/Assets/Materials/Types/Eye.materialtype),
  [issue #7247, the eye material type](https://github.com/o3de/o3de/issues/7247)
- Unity: [Graphics LICENSE.md](https://raw.githubusercontent.com/Unity-Technologies/Graphics/master/LICENSE.md),
  [EyeUtils.hlsl](https://raw.githubusercontent.com/Unity-Technologies/Graphics/master/Packages/com.unity.render-pipelines.high-definition/Runtime/Material/Eye/EyeUtils.hlsl),
  [Eye.hlsl](https://raw.githubusercontent.com/Unity-Technologies/Graphics/master/Packages/com.unity.render-pipelines.high-definition/Runtime/Material/Eye/Eye.hlsl),
  [com.unity.demoteam.digital-human](https://github.com/Unity-Technologies/com.unity.demoteam.digital-human) and its
  [LICENSE.md](https://raw.githubusercontent.com/Unity-Technologies/com.unity.demoteam.digital-human/master/LICENSE.md)
- [blackears/godot_eyeball_shader](https://github.com/blackears/godot_eyeball_shader) ([README](https://raw.githubusercontent.com/blackears/godot_eyeball_shader/master/README.md))
- [lighttransport/procedural-eyeball-shader](https://github.com/lighttransport/procedural-eyeball-shader) ([color.frag](https://raw.githubusercontent.com/lighttransport/procedural-eyeball-shader/master/color.frag))
- [matmadness/HumanShaders](https://github.com/matmadness/HumanShaders) ([LICENSE](https://raw.githubusercontent.com/matmadness/HumanShaders/main/LICENSE), [eye_shader.gdshader](https://raw.githubusercontent.com/matmadness/HumanShaders/main/HumanShaders/eye_shader.gdshader))
- [zulubo/EyeShader](https://github.com/zulubo/EyeShader)
- OpenSculptBoy: [repo](https://github.com/infinia-yzl/opensculptboy), [docs/eyes.md](https://raw.githubusercontent.com/infinia-yzl/opensculptboy/main/docs/eyes.md), [pull request #13, the eyes](https://github.com/infinia-yzl/opensculptboy/pull/13); [NAVER's Anny](https://github.com/naver/anny)
- MPFB2: [repo](https://github.com/makehumancommunity/mpfb2), [LICENSE.md](https://raw.githubusercontent.com/makehumancommunity/mpfb2/master/LICENSE.md), [procedural_eyes.json](https://raw.githubusercontent.com/makehumancommunity/mpfb2/master/src/mpfb/data/node_trees/procedural_eyes.json)
- [CC/iC Blender Tools](https://github.com/soupday/cc_blender_tools) (its changelog on the repo page)
- [met4citizen/TalkingHead](https://github.com/met4citizen/TalkingHead) ([README](https://raw.githubusercontent.com/met4citizen/TalkingHead/main/README.md), [LICENSE](https://raw.githubusercontent.com/met4citizen/TalkingHead/main/LICENSE))
- [guto88/ShadersForDaz3dAssets](https://github.com/guto88/ShadersForDaz3dAssets)
- [galacean/engine-toolkit](https://github.com/galacean/engine-toolkit), [galacean/engine](https://github.com/galacean/engine)

From search excerpts:

- Epic: [Digital Humans (4.27)](https://dev.epicgames.com/documentation/en-us/unreal-engine/digital-humans?application_version=4.27),
  [Shading Models](https://dev.epicgames.com/documentation/en-us/unreal-engine/shading-models-in-unreal-engine),
  [MetaHuman Eye Material Controls](https://dev.epicgames.com/documentation/metahuman/eye-material-controls),
  [MetaHuman Creator Export Tool](https://dev.epicgames.com/documentation/metahuman/metahuman-creator-export-tool-in-unreal-engine),
  [metahuman.com/license](https://www.metahuman.com/license),
  [CG Channel on MetaHumans in Unity and Godot (2025-06)](https://www.cgchannel.com/2025/06/you-can-now-sell-metahumans-or-use-them-in-unity-or-godot/)
- [eukky: a custom shading model in UE5, the eye's caustic normal (Chinese)](https://eukky.github.io/GameDev/UnrealEngine/CustomShadingModel.html)
- Unity: [Cornea Refraction node](https://docs.unity3d.com/Packages/com.unity.shadergraph@14.0/manual/Cornea-Refraction-Node.html),
  [Iris Limbal Ring node](https://docs.unity3d.com/Packages/com.unity.shadergraph@14.0/manual/Iris-Limbal-Ring-Node.html),
  [issue: the iris inside the mesh, "By Design"](https://issuetracker.unity3d.com/issues/hdrp-iris-texture-is-applied-inside-of-the-mesh-when-using-eye-shader),
  [a port of Jimenez's eye refraction](https://discussions.unity.com/t/eye-shader-physically-based-refraction-source-code/646027)
- Jimenez: [GDC 2013, Next Generation Character Rendering](https://gdcvault.com/play/1018270/Next-Generation-Character),
  [Open Your Eyes (2012)](https://www.iryoku.com/open-your-eyes/),
  [SIGGRAPH 2012 session](http://s2012.siggraph.org/attendees/sessions/separable-subsurface-scattering-photorealistic-eyes-rendering.html),
  [GameDev.net on the slides' parallax refraction](https://www.gamedev.net/forums/topic/669948-eye-shader-parallax-refraction-help/)
- [Valve: EyeRefract](https://developer.valvesoftware.com/wiki/EyeRefract), [CryEngine 3: Eye Shader](https://www.cryengine.com/docs/static/engines/cryengine-3/categories/1114113/pages/15728675)
- [Godot Shaders: Refractive Procedural Eye](https://godotshaders.com/shader/eye/), [Shadertoy: Realistic Eye](https://www.shadertoy.com/view/XsfGWj)
- Polycount's eye-shader threads, where the tips quoted in §3 come from (two normals and parallax, a clear coat with
  no normal for the cornea, Toolbag's IOR and the 70 to 90° break): [1](https://polycount.com/discussion/comment/1137298),
  [2](https://polycount.com/discussion/comment/1137163/), [3](https://polycount.com/discussion/comment/1302074),
  [4](https://polycount.com/discussion/comment/2525974)
- MetaHuman tools for Blender: [Poly Hammer's MetaHuman DNA add-on](https://www.cgchannel.com/2025/03/poly-hammer-releases-metahuman-dna-add-on-for-blender/), [MetaHuman DNA Importer for Blender](https://superhivemarket.com/products/dnaimporter)
- [Galacean's digital-human eye](https://galacean.antgroup.com/engine/en/docs/graphics/material/builtinShaders/digitalHuman/eye)
- [MPFB's materials](https://static.makehumancommunity.org/mpfb/docs/materials/overview.html)
- Iris synthesis: [Shah and Ross's synthetic iris textures (Clarkson)](https://citer.clarkson.edu/?p=187), [a survey of GAN iris synthesis](https://arxiv.org/pdf/2404.17105)
- ["Eyes Alive" (Lee, Badler and Badler)](https://history.siggraph.org/?p=118454)
