# Skin v2: sources, numbers and algorithms (research note, 2026-10-28)

The full research behind `skin_v2.md` (which measures the user's reference stills and sets the plan).

For `tools/character/skinshader.js` (three.js r160, `MeshPhysicalMaterial` + `onBeforeCompile`, procedural layers in
rest-pose object space) and the later bake for Unreal 5.8. It builds on `docs/research/skin.md` (2026-10-22: layer
stack, glass skin, ageing, makeup, MetaHuman's texture synthesis, presets) and does not repeat it.

**How this was researched.** dev.epicgames.com and graphics.pixar.com do not resolve from this sandbox, so pages were
not read directly. Numbers come from (a) web-search summaries of the papers and docs, (b) source code found by GitHub
code search: Unreal 5.6.1's `SubsurfaceProfile.h` and `ShadingModels.ush` (public mirrors), Blender Cycles' `bssrdf.h`,
three.js r160 itself (`tools/director/vendor/three.module.min.js`) and Jimenez's `SeparableSSS.h`, and (c) my own
calculations (`docs/research/skin_v2/calc.py`, `lut.py`). Marks: **[code]** read in source, **[memory]** a known value I
could not re-check here, **[est.]** my estimate, to tune by eye.

**What the current shader does that v2 should change** (read in `skinshader.js`, `index.html`):
- "Translucency" is **emissive**: `rim^2.5 * diffuseColor * (0.55, 0.12, 0.08)`, independent of any light. It glows
  in the dark and does not follow the key. It reads as makeup glow, not scattering. v2 makes all scattering light-driven.
- The oil and dew lobe is the `clearcoat` (F0 fixed at 0.04 in three.js **[code]**). The base is `ior 1.4` (F0 0.028).
  There is no sheen or fuzz, no cavity on F0, and no specular occlusion.
- Pores and grain **fade out** with `fwidth` but their slope variance is dropped, not turned into roughness. three.js
  adds only the *geometric* normal's variance (`geometryRoughness` from `dFdx(nonPerturbedNormal)` **[code]**).
- Pore spacing defaults to 1.3 mm. Real follicle openings are about 0.6-0.7 mm apart (§4).
- The viewer uses **no tone mapping** (default `NoToneMapping`). ACES is used only in the studio view
  (`tools/shared/studioview.js`). Lights: hemi 0.7, directional key 1.6, and a PMREM of a box with four emissive cards.
- Pixel footprint: the studio's 26° (vertical) lens in a face-filling close-up, about 0.5 m away, gives about
  0.21 mm/px at 1080p and 0.11 mm/px at 4K or DPR 2. The game's 90° POV at 1.5 m gives about 1.6 mm/px. So pores resolve only in close-ups, and the furrows (0.2-0.5 mm)
  sit at Nyquist even there. Everything finer must become **roughness and sparkle statistics**, both in the browser
  and in the bake's mips.

---

## 1. How MetaHuman / Unreal skin is built

**What it is.** Skin uses the **Subsurface Profile** shading model. It is a screen-space diffusion of the diffuse
lighting, with full-resolution skin shading so pores and wrinkles stay sharp. The profile asset holds the diffusion (either Jimenez's
*separable* SSS or *Burley normalized diffusion*), the **dual-lobe specular**, and the **transmission** settings. The
material supplies base colour, roughness, specular (cavity), normal, and "Opacity" (the SSS amount mask). MetaHuman
faces add a scanned or synthesised texture set, **animated wrinkle and blood-flow maps** driven by RigLogic, and a
tiling **micro-normal**.

**Numbers, the profile struct defaults** (UE 5.6.1 `FSubsurfaceProfileStruct()` **[code]**):
- Separable (the "defaults from SeparableSSS.h and the demo"):
  - `ScatterRadius 1.2` (cm)
  - `SubsurfaceColor (0.48, 0.41, 0.28)`
  - `FalloffColor (1.0, 0.37, 0.3)`
  - `BoundaryColorBleed` white
- Burley:
  - `bEnableBurley = false` in the struct. MetaHuman's own profile is not verified here.
  - `SurfaceAlbedo (0.91058, 0.338275, 0.2718)`. The comment says it matches FalloffColor for the default.
  - `MeanFreePathColor (1.0, 0.1983/2.229, 0.1607/2.229) = (1, 0.089, 0.072)`
  - `MeanFreePathDistance 1.2*2.229 = 2.67`. The comment gives "world/unreal units (cm)".
  - `WorldUnitScale 0.1`, commented "scale of world/unreal units (cm)". If the two multiply (my reading), the
    effective red MFP is about 2.7 mm and green and blue about 0.24 and 0.19 mm.
- Burley requires TAA (Epic docs). Transmission tint works only with Burley.
- Transmission category: `ExtinctionScale 1.0` ("1 = physically correct extinction"), `ScatteringDistribution 0.93`,
  `NormalScale 0.08`, `IOR 1.55`.
- Dual specular: `Roughness0 0.75`, `Roughness1 1.30`, `LobeMix 0.85`.

**Transmission, exactly** (`ShadingModels.ush`, `SubsurfaceProfile.cpp` **[code]**):
`Transmission = FalloffColor · Profile(thickness) · HG(dot(−L, refract(V, −N, 1/IOR)), g = ScatteringDistribution)`.
It is a Henyey-Greenstein phase with g = 0.93 (strongly forward) about the refracted view ray. The thickness comes from
the shadow map (`ThicknessInCm` in Substrate's evaluation).

**The dual lobe, exactly** (`ShadingModels.ush` **[code]**):
`Lobe0Roughness = max(saturate(R*0.75), 0.02)`, `Lobe1Roughness = saturate(R*1.30)`, and
`D = lerp(D_GGX(a0)*E0, D_GGX(a1)*E1, LobeMix)`. Visibility uses the *material* roughness R.
So **LobeMix is the weight of the rougher lobe**: by default 85% broad and 15% sharp.

| material roughness R | lobe 0, sharp (15%) | lobe 1, broad (85%) |
|---|---|---|
| 0.45 | 0.338 | 0.585 |
| 0.50 | 0.375 | 0.650 |
| 0.55 | 0.413 | 0.715 |

Roughness here is perceptual (alpha = R²). With Opacity going to 0 the shading lerps back to one GGX lobe **[code]**.

**F0.** Unreal's measured "Specular" for skin is 0.35, which gives F0 = 0.08 × 0.35 = 0.028, the same as IOR 1.4
(skin.md; NVIDIA GDC 2007 also gives IOR 1.4).

**MetaHuman texture set** (Epic docs via search):
- The face takes base colour, normal, cavity, and **animated maps**. The body takes base colour, normal and cavity.
- Animated maps store only the difference from the base.
- Three wrinkle normals (WM1-3) are blended together with three **blood-flow colour maps** (CM1-3), so each pair must
  stay consistent. RGB region masks are weighted by RigLogic outputs.
- **Micro Skin Detail normals are disabled at LOD1.** Animated maps are off at LOD2 and at low scalability.
- Creator's synthesiser bakes Base Color, a packed SRMF texture, a detail normal and a 512² scatter map (skin.md §5).
- I found **no published value for the micro-normal tiling or strength**. Reallusion's similar setup uses tiling
  10-42 and strength 1-2, which is a different pipeline. Read it off a MetaHuman material instance in the editor
  (e.g. `MI_Face_Skin_Baked_LOD0`, `MF_skin_scalability`).

**Transmission (ears, nose).** The profile's transmission takes thickness from the shadow map. On UE 5.6+ with
**Virtual Shadow Maps**, thin parts such as earlobes and fingers can "glow with nuclear intensity" when backlit
(forum). The fixes reported are lowering `r.Shadow.Virtual.ScreenRayLength` or lowering the profile's
**Extinction Scale**. **This project has `r.Shadow.Virtual.Enable=1`**, so expect it.

**Substrate in this project.** `Config/DefaultEngine.ini` has `r.Substrate=True` and
`r.Substrate.ProjectGBufferFormat=0`, which is **Blendable**. Epic staff say Blendable won't support coloured specular,
**SSS using MFP, Glint, or layering**. A forum report says Second Roughness has no visual effect under Blendable.
The Subsurface Profile itself is "100% supported" in Substrate (staff).

So in this project, skin should be **Slab + Subsurface Profile** (not the slab's MFP input). Glint needs the
**Adaptive** GBuffer (format 1), which costs more. Fuzz probably does too (not confirmed). Substrate glints follow Chermain et al., with density
parameterised over UV, and converge to one GGX lobe when far away (Substrate SIGGRAPH 2023 deck; `r.Substrate.Glints`).

**What to bake for Unreal** (MHR UVs; summary in §9): an albedo with no lighting baked in, a normal map, roughness,
cavity, an SSS-amount mask, and a fuzz mask. Then pick a profile: start at the defaults above and tune
`Roughness0/1` and `LobeMix` rather than painting them.

**Cost in the browser:** not applicable; this is the target the browser approximates.

**Links:**
- Subsurface Profile model: https://dev.epicgames.com/documentation/en-us/unreal-engine/subsurface-profile-shading-model-in-unreal-engine
- Profile Python API: https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/SubsurfaceProfileStruct
- UE 5.6.1 source mirror: https://github.com/Viktor4221/ue5.6.1 (`Engine/Source/Runtime/Engine/Classes/Engine/SubsurfaceProfile.h`)
- `ShadingModels.ush` mirror: https://github.com/repalash/Open-Shaders (`Engines/Unreal/Private/ShadingModels.ush`)
- MetaHuman materials and textures: https://dev.epicgames.com/documentation/metahuman/metahuman-materials-and-textures
- Skin material controls: https://dev.epicgames.com/documentation/metahuman/skin-material-controls
- Digital Humans (4.26): https://docs.unrealengine.com/4.26/Resources/Showcases/DigitalHumans
- VSM transmission glow: https://forums.unrealengine.com/t/subsurface-transmission-and-smrtrayoffset/2702960
- Blendable GBuffer limits: https://forums.unrealengine.com/t/substrate-feedback-thread/691314?page=35
- Second Roughness under Blendable: https://forums.unrealengine.com/t/substrate-second-roughness-leads-to-no-visual-change-when-using-the-blendable-gbuffer-format/2719356
- Substrate (SIGGRAPH 2023): https://advances.realtimerendering.com/s2023/2023%20Siggraph%20-%20Substrate.pdf
- Substrate overview: https://dev.epicgames.com/documentation/en-us/unreal-engine/overview-of-substrate-materials-in-unreal-engine
- Reallusion micro normal (comparison only): https://manual.reallusion.com/Character-Creator-4/Content/ENU/4.0/15_Digital_Human_Shader/Skin/Micro_Normal.htm

---

## 2. Real-time SSS you can run in plain WebGL / three.js

### 2a. The measured profile, and what it implies
**What it is.** d'Eon & Luebke's skin profile is a sum of six Gaussians, fitted to a three-layer model. The same
numbers sit in Jimenez's `SeparableSSS.h` **[code]**.

| variance (mm²) | 0.0064 | 0.0484 | 0.187 | 0.567 | 1.99 | 7.41 |
|---|---|---|---|---|---|---|
| R | 0.233 | 0.100 | 0.118 | 0.113 | 0.358 | 0.078 |
| G | 0.455 | 0.336 | 0.198 | 0.007 | 0.004 | 0 |
| B | 0.649 | 0.344 | 0 | 0.007 | 0 | 0 |

The share of each channel's weight in Gaussians wider than about 0.4 mm is **R 0.67, G 0.21, B 0.01** (my sum). So
a 0.3-0.5 mm pore or furrow loses about 2/3 of its diffuse shading in red, about 1/5 in green, and nothing in blue.
That is why pores read in the specular and in blue/green but look soft and warm in red.

Two more results from `lut.py` (my calculation with this profile):
- **Thin-skin transmittance** `T(d) = Σ w·exp(-d²/v)` (Jimenez's transmittance form):
  - d = 0.25 mm: (0.64, 0.24, 0.10)
  - d = 0.5 mm: (0.50, 0.06, 0.007)
  - d = 1 mm: (0.31, 0.005, 0.001)
  - d = 2 mm: (0.09, 0, 0)

  Any light that crosses a millimetre of tissue comes out deep red. That is the ears and the nostril rims.
- **Pre-integrated curvature diffusion with the measured profile is small at face scale.**
  - At the terminator (N·L = 0), Lambert gives 0. The LUT gives (0.032, 0.017, 0.014) at r = 3 mm and
    (0.007, 0.003, 0.003) at r = 15 mm.
  - It only becomes clearly red near r ≈ 0.5-1 mm, e.g. (0.116, 0.100, 0.082) at r = 0.5 mm.
  - So the curvature term alone will not make the look. Most of the visible softness comes from three places: bump
    detail softened in red, scattering across **shadow edges**, and **transmission** at thin parts. Games that show a
    strong red terminator probably exaggerate curvature or the profile width (my inference). Expose that as an
    artistic "scatter width" knob.

### 2b. Options, cheapest first

| technique | what it does | cost in our viewer | fit |
|---|---|---|---|
| **Wrap lighting with a red shift** (Green, GPU Gems 1 ch.16) | `max(0,(N·L+w)/(1+w))`, w per channel; the chapter's LUT example uses w = 0.2 and adds a red shift near zero | a few ALU | a quick stand-in; not energy-correct; no bump softening |
| **Per-channel normals** (Penner's "scattering on small details") | diffuse N·L per channel from a mix of the bumped and smooth normals: R mostly smooth, B fully bumped | 2 dot products | **yes**: biggest gain per cost, and it uses our procedural bump |
| **Pre-integrated skin** (Penner 2011) | `D(N·L, 1/r)` LUT from the profile on a ring, curvature from `fwidth(N)/fwidth(P)` or a per-vertex attribute; separate penumbra LUT for shadow edges | one 64×64 half-float texture made once in JS (≈0.1-0.3 s **[est.]**), 1-3 fetches per light | yes, with a width knob (§2a) |
| **Frostbite fast translucency** (Barré-Brisebois & Bouchard 2011; the three.js SSS example) | back-light term from a thickness map | ~10 ALU per light | **yes**, for ears, nose wings, eyelids, fingers |
| **Screen-space separable SSS** (Jimenez 2009/2015) | blur the diffuse irradiance in screen space with the profile, 2 passes, depth-aware; <0.5 ms on a console and 7 samples/pixel with jitter (paper) | needs EffectComposer, a diffuse/specular split (MRT), linear depth and a skin mask; none of the passes are vendored | later, as a "quality" mode |
| **Burley in screen space** (Golubev 2018, Unity HDRP; Unreal's Burley) | disk importance-sampling of R(r) with rotated patterns; Unreal's Burley requires TAA | many samples, plus a TAA three.js lacks | no |
| **Texture-space diffusion** (d'Eon 2007) | blur irradiance in UV space | 6 blurs at 1024²; MHR has UV seams | no (our object-space design avoids seams) |

**Recommendation for a one-mesh viewer.** Use per-channel normals, pre-integrated diffuse with a width knob, a
penumbra tint, and translucency for thin parts. Defer screen-space SSS. All four are per-light terms and cost
little. They go in `RE_Direct_Physical`, plus the shadow line of `lights_fragment_begin` for the penumbra tint.

**Burley profile, if you want it** (Christensen & Burley 2015):
- Profile: `R(r) = A·(e^{-r/d} + e^{-r/(3d)}) / (8π·d·r)`, with `d = ℓ/s`.
- Scaling factor s, three fits:
  - searchlight with mfp: `s = 1.85 − A + 7|A − 0.8|³` **[memory]**
  - diffuse transmission with mfp: `s = 1.9 − A + 3.5(A − 0.8)²` (eq. 6, the one Cycles uses **[code]**)
  - diffuse mean free path: `s = 3.5 + 100(A − 0.33)⁴` **[memory]**
- Cycles first scales the user radius by `1/(4π)` **[code]**.
- Unreal's default albedo gives s = (1.03, 2.31, 2.60).
- For comparison, Jensen's "skin1" (σs′ (0.74, 0.88, 1.01), σa (0.032, 0.17, 0.48) mm⁻¹ **[memory]**) gives diffuse
  MFP ≈ (3.7, 1.4, 0.7) mm.

### 2c. GLSL sketch (three.js r160)
Replace `#include <lights_physical_pars_fragment>` with the chunk patched at its diffuse line. The line is, verbatim
in r160 **[code]**: `reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );`.

```glsl
// globals (in COMMON, set in main after normal_fragment_maps): skinNs = the smooth normal (nonPerturbedNormal),
// skinCurv = 1/r in mm^-1 (per-vertex attribute, or uCurvScale*length(fwidth(N))/length(fwidth(P))*1e-3)
vec3 skinDiffuse(vec3 L, vec3 Nb, vec3 Ns) {
  vec3 nl = vec3(dot(normalize(mix(Nb, Ns, 0.67)), L),   // weights from the profile (§2a)
                 dot(normalize(mix(Nb, Ns, 0.21)), L),
                 dot(Nb, L));
  float v = clamp(skinCurv * uScatterWidth, 0.0, 1.0);   // the LUT's 1/r axis, with the artistic knob
  return vec3(texture2D(uSkinLUT, vec2(nl.r * 0.5 + 0.5, v)).r,
              texture2D(uSkinLUT, vec2(nl.g * 0.5 + 0.5, v)).g,
              texture2D(uSkinLUT, vec2(nl.b * 0.5 + 0.5, v)).b);
}
// in RE_Direct_Physical: directLight.color already carries the shadow; the LUT replaces dotNL for diffuse only
reflectedLight.directDiffuse += skinDiffuse(directLight.direction, geometryNormal, skinNs) * directLight.color
                              * BRDF_Lambert(material.diffuseColor);
// translucency (thin parts), after Barré-Brisebois/the three.js example; thickness t (mm) from a per-vertex bake (§10 item 5)
vec3 Lt = normalize(directLight.direction + geometryNormal * uDistortion);       // 0.2-0.3 [est.]
float back = pow(saturate(dot(geometryViewDir, -Lt)), uPower) * uTScale;        // power 3-4, scale 1-4 [est.]
// or Unreal's own form (§1), V = geometryViewDir, L = light dir: HG(dot(-L, refract(V, -N, 1.0/1.55)), g = 0.93)
// in place of the pow(), so the browser matches the bake target
reflectedLight.directDiffuse += back * skinTransmit(t) * directLightColorUnshadowed * material.diffuseColor;
```

- **The LUT**, made once in JS. For each texel, u = N·L in [-1, 1] and v = 1/r. Integrate `max(cos(θ+x),0)·R(2r·sin|x/2|)`
  over x in [-π, π] and divide by `∫R`, using the six Gaussians above. Store linear values in a `HalfFloatType`
  `DataTexture` (`THREE.DataUtils.toHalfFloat`, present in r160 **[code]**). Penner's GPU Pro 2 LUT image is in
  sRGB while his SIGGRAPH slides' is linear; mind which one you copy. A 2014 blog also reports an error in the
  integral limits of the GPU Pro 2 sample code, so generate the LUT yourself rather than copying it.
- **Shadow edges.** Shadows are multiplied into `directLight.color` in `lights_fragment_begin` before `RE_Direct`
  **[code]**. A cheap penumbra reddening patches that line to keep the shadow factor `s` and tint the half-shadow,
  e.g. `pow(vec3(s), vec3(0.6, 0.9, 1.0))` **[est.]**. Penner's version is a second LUT indexed by penumbra width.
- **Transmission needs the light's colour without the shadow** (the light reaches the back of the ear). Keep a copy
  before the shadow multiply. Choose `skinTransmit(t)` from the T(d) table in §2a, with t in mm.
- **Ambient light.** For the environment diffuse, use the per-channel normals too, or at least the smooth normal for
  red (`getIBLIrradiance` is called with `geometryNormal`).

**Links:**
- Penner, SIGGRAPH 2011 course: https://www.slideshare.net/slideshow/penner-preintegrated-skin-rendering-siggraph-2011-advances-in-realtime-rendering-course/13966747
- Penner, GPU Pro 2: https://gameenginegems.com/gemsdb/article.php?id=1103
- Pre-integrated skin notes (incl. the LUT space mismatch): https://simonstechblog.blogspot.com/2015/02/pre-integrated-skin-shading.html
- Notes on skin shading (the sample code's integral error): https://jonmoore.squarespace.com/blog/2014/4/19/notes-on-skin-shading.html
- Jimenez et al. 2015, separable SSS: https://graphics.unizar.es/papers/Separable-Subsurface-Scattering.pdf
- Jimenez et al. 2009, screen-space skin: https://graphics.unizar.es/papers/Screen-Space-Perceptual-Rendering-of-Human-Skin.pdf
- Separable SSS code: https://github.com/iryoku/separable-sss
- Christensen & Burley 2015: https://graphics.pixar.com/library/ApproxBSSRDF (slides: https://graphics.pixar.com/library/ApproxBSSRDF/approxbssrdfslides.pdf)
- Cycles Burley code: https://github.com/blender/blender/blob/main/intern/cycles/kernel/closure/bssrdf.h
- Golubev 2018, Burley in screen space: https://www.advances.realtimerendering.com/s2018/Efficient%20screen%20space%20subsurface%20scattering%20Siggraph%202018.pdf
- GPU Gems 3 ch.14 (d'Eon & Luebke): https://developer.nvidia.com/gpugems/GPUGems3/gpugems3_ch14.html
- GPU Gems 1 ch.16 (wrap lighting): https://developer.nvidia.com/gpugems/gpugems/part-iii-materials/chapter-16-real-time-approximations-subsurface-scattering
- Frostbite translucency (GDC 2011): https://www.ea.com/frostbite/news/approximating-translucency-for-a-fast-cheap-and-convincing-subsurface-scattering-look
- three.js SSS example: https://github.com/mrdoob/three.js/blob/dev/examples/jsm/shaders/SubsurfaceScatteringShader.js

### 2d. What three.js already offers (r160)
- **`MeshPhysicalMaterial`:**
  - `sheen`, `sheenColor`, `sheenRoughness`: Charlie D × Neubelt V (§5).
  - `clearcoat`: a second GGX lobe with F0 0.04, which attenuates the base.
  - `specularIntensity` scales **F0 and F90**; `specularColor` scales **F0 only** **[code]**. Use the latter for
    cavity (§3).
  - `ior`, `anisotropy`, `iridescence`.
  - `transmission`, `thickness`, `attenuationColor`: refraction through a volume. It renders a transmission pass and
    is **wrong for skin** (it looks like glass or wax).
- **The SSS example** (`webgl_materials_subsurface_scattering`, Phong-based):
  `scatteringHalf = normalize(L + N*distortion)`, `dot = pow(saturate(dot(V, -scatteringHalf)), power) * scale`,
  `(dot + ambient) * thicknessColor * attenuation * lightColor` **[code]**.
  - The example's values are colour (0.5, 0.3, 0.0), distortion 0.1, **ambient 0.4**, attenuation 0.8, power 2,
    scale 16.
  - For skin, use **ambient ≈ 0**. A non-zero ambient is exactly the glow-in-the-dark problem of our emissive rim.
- **Newer than our vendored r160:** `MeshSSSNodeMaterial` (WebGPU/TSL, same model); Khronos **Neutral** tone mapping
  (r162). **AgX** is in r160, but its gamut-mapping fix landed in r161.

---

## 3. Specular: lobes, occlusion, oil by region, sparkle

**What it is.** Skin specular is a thin, oily, rough dielectric interface with F0 ≈ 0.028 and no tint. Measured faces
need **two lobes**, one sharp (the oil film) and one broad (the rough corneum). Specular must vanish inside pores and
furrows, but not at grazing angles. Oiliness varies by region. Close up, the highlight **breaks into points** because
each micro-plateau tilts a little differently.

**Numbers:**
- **Kelemen / Szirmay-Kalos (KSK)** as used by d'Eon & Luebke:
  - Beckmann `m = 0.3` is "a good average for the face", from Weyrich's 149 measured faces (NVIDIA GDC 2007).
  - IOR 1.4, so F0 0.028. ρs ≈ 0.18 **[memory]**.
  - Beckmann m = 0.3 ≈ GGX α 0.3, which is **perceptual roughness ≈ 0.55** (√α). Our presets' 0.32-0.62 are in the
    right range.
- **Unreal dual lobe** (§1): R × 0.75 at 15% and R × 1.3 at 85%. For R = 0.5 that is 0.375 and 0.65.
  - In three.js, the cheap way: base `roughness = R*1.3`, `clearcoat ≈ 0.15`, `clearcoatRoughness = R*0.75`. The coat
    is F0 0.04 and attenuates the base: close, not exact.
  - The exact way: patch `BRDF_GGX`'s `float D = D_GGX( alpha, dotNH );` (verbatim in r160 **[code]**) to mix two D
    terms with the UE weights.
  - For the environment, `getIBLRadiance(...)` is called once with `material.roughness` **[code]**. Call it twice
    (R*0.75, R*1.3) and mix 15/85. That is one extra PMREM fetch.
- **Cavity** (Jimenez & von der Pahlen, GDC 2013): apply cavity to the reflectance (F0). Fresnel then removes it at
  grazing angles by itself. In three.js, multiply **`specularColor`** (F0 only), not `specularIntensity`.
- **Specular occlusion from AO.** three.js r160 already has Lagarde's
  `saturate(pow(NdotV + ao, exp2(-16*rough - 1)) - 1 + ao)` and applies it to the env specular when an aoMap is
  present **[code]**. Feed it our procedural cavity × a baked per-vertex AO by patching `aomap_fragment`, or set
  `ambientOcclusion` ourselves.
- **Oil by region:**
  - Sebum is higher on the forehead, nose and chin than on both cheeks (Youn et al. 2005).
  - Young Taiwanese women: forehead ≈ 90-200 and cheek ≈ 90-160 µg/cm² (garbled snippet, unverified).
  - Starting roughness multipliers **[est.]**: nose tip and alae 0.70, forehead centre and chin 0.80, inner cheeks
    0.90, outer cheeks 1.0, eyelids and under-eye 1.05-1.10 (drier, finer), ears 1.05.
  - The oil film itself is the sharp lobe's weight: 0.15 dry to 0.35 oily **[est.]**.
- **Glass skin and K-beauty makeup** (skin.md §2, METAHUMAN_LOOKS §2):
  - broad lobe about 0.28-0.38
  - a thin coat on the high planes
  - pore contrast at about a third
  - The failure mode is a sharp highlight over the whole face (PC Gamer on MetaHuman's "strange skin shine").
- **Bump variance into roughness** (Toksvig; Tokuyoshi & Kaplanyan 2019). When pores and furrows fade below a pixel,
  add their slope variance σ² to α²: `α'² = α² + min(2σ², 0.18)`. The 0.18 clamp is **[memory]**.
  - Without this, distant skin goes **plastic-smooth**. With it, it keeps the soft broad highlight that MetaHuman's
    mips and TAA give.

**Sparkle and glints:**
- **Zirr & Kaplanyan 2016.** A biscale NDF, with glints counted per pixel footprint at several LODs. It is stable and
  anti-aliased. A **Shadertoy demo** is linked from the NVIDIA page, so it is already in WebGL GLSL.
- **Chermain et al. 2020.** Physically based glints with GLSL code (`ASTex-ICube/real_time_glint`). It needs a
  precomputed dictionary. Unreal's Substrate glints follow it.
- **Deliot & Belcour 2023.** Binomial laws on anisotropic grids, 1.5-5× faster than prior work.
- For skin, most "micro-sparkle" is **not** a separate glitter. It is the sharp lobe hitting resolved micro-plateaus
  (§4), which a real micro-normal plus a low-roughness lobe produce by themselves at close range.
- Add an explicit glint term only for dewy, highlighter or mica makeup and sweat.

```glsl
// cheap hashed facets (my sketch): sparse mirror-like cells, faded by footprint, masked to the high planes
float cs = 0.00015 * uScale;                         // 0.15 mm cells [est.]
vec3 c = floor(vObj / cs), j = h33(c) - 0.5;          // skinshader's hash
vec3 nF = normalize(N + 0.5 * j);                     // facet normal, tilted by about 5-20 degrees
float on = step(1.0 - uSparkDensity, h31(c + 3.7));   // 2-10% of cells [est.]
float g = on * pow(saturate(dot(nF, H)), 3000.0);
g *= 1.0 - smoothstep(0.3, 1.0, length(fwidth(vObj)) / cs);   // gone when a cell is under a pixel
spec += g * F * NdotL * lightColor * uSparkle * highPlanes;   // highPlanes: skinshader's hp mask
```

**Cost:**
- Dual lobe: one extra D term per light plus one PMREM fetch.
- Cavity on F0, and specular occlusion: free.
- Hashed glints: about 15 ALU.
- A Zirr-Kaplanyan port: about 100-200 ALU per pixel, only on face pixels.

**Links:**
- NVIDIA GDC 2007, advanced skin (m = 0.3, IOR 1.4): https://developer.download.nvidia.com/presentations/2007/gdc/Advanced_Skin.pdf
- Weyrich et al. 2006: https://cdfg.csail.mit.edu/pdf/journal/2006-weyrich-analysis-of-human-faces-using-a-measurement-based-skin.pdf
- Jimenez & von der Pahlen, GDC 2013 (cavity on reflectance): https://www.scribd.com/document/438787655/Next-Gen-Character-Rendering
- Two GGX lobes plus normalized diffusion: https://shihchinw.github.io/2015/12/realistic-human-skin-with-normalized-diffusion-ggx.html
- Lagarde & de Rousiers 2014, "Moving Frostbite to PBR": https://seblagarde.files.wordpress.com/2015/07/course_notes_moving_frostbite_to_pbr_v32.pdf
- Youn et al. 2005, facial sebum: https://www.ovid.com/journals/skrt/fulltext/00061349-200508000-00005~regional-and-seasonal-variations-in-facial-sebum-secretions
- Zirr & Kaplanyan 2016: https://research.nvidia.com/publication/2016-02_real-time-rendering-procedural-multiscale-materials
- Chermain et al. 2020: https://publis.icube.unistra.fr/2-CSDD20 (code: https://github.com/ASTex-ICube/real_time_glint)
- Deliot & Belcour 2023: https://arxiv.org/pdf/2306.05051
- Tokuyoshi & Kaplanyan, geometric specular antialiasing (2021 version): https://www.jcgt.org/published/0010/02/02/paper-lowres.pdf

---

## 4. Micro-geometry: pores and the fine cross-hatch

**What it is.** The skin surface is a network of **furrows** around polygonal **plateaus**, mostly triangles and
rectangles. Follicle and sweat-duct openings are dispersed through the network. Graham et al. 2013 scanned skin
patches at **10 µm** and showed this microstructure shapes the specular lobe. They synthesise it onto a face scan by
region. Nagano et al. 2015 measured that **stretching smooths the microstructure** (blurred along the stretch) and
**compression roughens it** (sharpened). They implemented this as GPU filtering of the displacement map.

**Numbers:**
- **Furrows:** primary 30-100 µm deep (20-200 µm in another source), secondary 5-40 µm. With age, primary furrows grow
  fewer but deeper, and on the forearm the second direction nearly disappears. Face and limbs differ clearly in furrow
  density and depth, and periorbital density levels off at age 30-40 (Corcuff 1987 via search).
- **Plateau size: no source found.** About 0.2-0.5 mm across on the face, larger on the limbs **[est.]**.
- **Pores (follicle openings):**
  - Density 200-300/cm², fairly even over the face (Flament 2015). That is a spacing of about **0.6-0.7 mm**.
  - Visible pore surface area 0.06-0.16 mm² (dermatoscopy, cheeks): **diameter about 0.28-0.45 mm**. The threshold
    that matched experts' judgement was 250 µm.
  - Chinese women had clearly the lowest pore density and size of five populations (2,585 women). A cheek-replica
    study found the smallest pore areas in Asians.
  - Most openings are invisible. Only a fraction reaches the visible threshold, more on the nose and inner cheeks
    **[est.]**.
- **By region [est.]** (consistent with skin.md):
  - nose and alae: largest and densest visible pores
  - inner cheeks: large
  - forehead: many small ones
  - chin: medium
  - outer cheeks and jaw: fewer
  - eyelids and under-eye: fine crepe texture, almost no visible pores
  - lips: none (they have lip lines, §7)

**A procedural recipe** (object space, matches our `cells()` hash):
1. **Furrow network.** Use Voronoi edges (F2 − F1) of cells about 0.25-0.45 mm **[est.]**. Stretch them about 1.5×
   along a local tension direction so the plateaus elongate. The direction follows Langer's lines: horizontal across
   the forehead, radial around the eyes and mouth. It can come from the landmark frame we already have (uRight, uUp,
   eye and mouth centres).
2. **Secondary lines.** A second Voronoi at about 2.3× frequency, half the depth.
3. **Tertiary.** The existing grain noise.
4. **Pores.** At about 0.65 mm spacing, at or near network junctions. Each is a soft-walled pit of radius 0.1-0.2 mm
   (visible ones) and depth about 50-100 µm **[est.]**. Use a density mask by region, and lower density and size for
   the "young East Asian" preset.
5. **Strain (Nagano, cheaply).** In the fragment shader, `stretch = length(fwidth(worldPos)) / length(fwidth(vObj))`
   gives the local area change from rest. Scale furrow depth by `pow(stretch, -k)` with k ≈ 1-2 **[est.]**:
   compressed skin (a smile's cheeks) gets rougher, stretched skin smoother.
6. **Filtering.** Fade each band out by footprint (we already do this) and **add its variance to roughness** (§3).
   Each band also lowers F0 a little inside furrows (cavity, §3).

```glsl
vec2 f = voronoiF1F2(aniso(vObj, tension) / (0.00035 * uScale));       // F1, F2 of stretched cells
float furrow = 1.0 - smoothstep(0.0, 0.12, f.y - f.x);                  // furrow ~12% of a cell [est.]
float px = length(fwidth(vObj)), cs = 0.00035 * uScale;
float keep = 1.0 - smoothstep(0.5 * cs, 1.5 * cs, 2.0 * px);            // resolved?
skinH += -(0.06 * furrow) * keep * strainK;                             // depth units as skinH (tune)
skinRough2 += (1.0 - keep) * 0.02 * uFurrowAmt;                         // what fades becomes roughness [est.]
skinCav *= 1.0 - 0.25 * furrow * keep;                                  // -> specularColor (F0)
```

**Cost:**
- Voronoi F1/F2 in 3D: 27 cells, about 150-250 ALU. Two octaves on face pixels only is fine on desktop.
- Our `cells()` already does F1 over 27 cells. F2 is a small extension.
- If needed, bake the network once into a 3D-ish texture, or into MHR-UV textures at character Save.

**Bake for Unreal.** At 4K on MHR's head UVs, the face gets roughly 0.1 mm per texel **[est.]**. That is enough for
pores and primary furrows in the **normal** and **cavity** maps. Leave anything finer to a **tiling micro-normal**,
as MetaHuman does (disabled at LOD1).

**Links:**
- Graham et al. 2013: https://vgl.ict.usc.edu/Research/Microgeometry
- Nagano et al. 2015: https://vgl.ict.usc.edu/Research/SkinStretch
- Microrelief review (furrow depths): https://pmc.ncbi.nlm.nih.gov/articles/PMC9838641
- Corcuff et al. 1987, face vs limbs: https://library.scconline.org/v038n03/1
- Flament et al. 2015, pores: https://pmc.ncbi.nlm.nih.gov/articles/PMC4337418
- Pore quantification (Cutis 2009, 250 µm threshold): https://mdedge.com/content/quantification-facial-pores-using-image-analysis

---

## 5. Vellus hair / peach fuzz

**What it is.** Fine, mostly unpigmented hairs on the cheeks, jaw sides, upper lip, forehead and ears. They are most
visible on women and children. Koenderink & Pont call it **asperity scattering**: a sparse layer of scatterers over
the surface whose BRDF is **inversely proportional to cos θi · cos θv**. It is dim face-on and bright where the view
or the light grazes, so it **brightens the occluding contour and the edge of the body shadow**. It makes cheeks look
"velvety/peachy". Without it, Lambert looks papery, the "skin" BRDF looks like glossy plastic, and translucency looks
hard. MetaHuman does this with an actual **fuzz groom** (strands at the top LODs; community reports).

**Numbers:**
- Vellus hair: diameter **< 30 µm**, length **≤ 2 mm** (dermatology classification; other sources say up to 5-10 mm).
- Forehead shaft diameter 16 µm, follicle density 292/cm² on the forehead, the highest of seven sites (Otberg 2004).
- 439 vellus hairs/cm² on the forehead, 49% growing (Blume et al. 1991, via search).
- Cheek-specific length: no source. Facial peach fuzz is about 1-3 mm **[est.]**.

**Models:**
- **three.js sheen** = Charlie (Estevez & Kulla 2017).
  `D = (2 + 1/α)·sin^(1/α)θh / 2π`, with α = sheenRoughness². Visibility is Neubelt's
  `1/(4(N·L + N·V − N·L·N·V))` **[code]**.
  - Try **[est.]**: `sheen 1`, `sheenColor` = skin albedo lightened and desaturated × 0.15-0.3, `sheenRoughness 0.35-0.5`.
  - Mask it by a fuzz-density map: cheeks, jaw, upper lip, forehead, ears. None on the lips.
  - Sheen is per-material in three.js. A per-pixel mask needs a patch: multiply `material.sheenColor` in
    `lights_physical_fragment`, where we already set the coat.
- **An asperity term** (a direct implementation of the paper's 1/cos form) adds the soft bright rim and a glow when
  backlit:

```glsl
float NdotV = max(dot(N, V), 0.0), NdotL = dot(N, L);
float lit = smoothstep(-0.15, 0.25, NdotL);                   // still lit a little past the terminator
float asp = max(lit / max(NdotV, 0.15) - 1.0, 0.0);           // 0 face-on, rising toward the silhouette (capped)
float fwd = pow(saturate(dot(-L, V)), 3.0);                    // forward scattering: a rim light from behind
vec3 fuzz = mix(material.diffuseColor, vec3(1.0), 0.5);       // pale, skin-tinted
reflectedLight.directSpecular += directLight.color * fuzz * asp * (0.02 + 0.2 * fwd) * fuzzMask * uFuzz;  // shadowed light; [est.]
```

- Ghost of Tsushima (Patry 2020) shipped an **anisotropic asperity BRDF** with an SGGX phase function, plus a cheaper
  "fuzziness" in the default path. Its supplemental PDF has the implementation.
- Real strands: the salon could grow a few thousand 1-2 mm cards. That is costly and alias-prone at the studio's
  ≥0.1 mm/px. **Use sheen plus asperity first.**

**Unreal:**
- Substrate Slab **Fuzz Amount / Color / Roughness** (a Charlie-like edge brightening) needs the **Adaptive** GBuffer.
  This project is on Blendable (§1).
- Otherwise use a fuzz groom like MetaHuman's, or bake nothing and accept it.

**Cost:** sheen is about 20 ALU per light plus an IBL term; the asperity term is about 10 ALU.

**Links:**
- Koenderink & Pont 2003: https://doi.org/10.1007/s00138-002-0089-7
- Estevez & Kulla 2017: https://blog.selfshadow.com/publications/s2017-shading-course/imageworks/s2017_pbs_imageworks_sheen.pdf
- KHR_materials_sheen: https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_sheen
- Patry 2020 slides: https://blog.selfshadow.com/publications/s2020-shading-course/patry/s2020_pbs_patry_slides.pdf
- Patry 2020 supplemental: https://blog.selfshadow.com/publications/s2020-shading-course/patry/s2020_pbs_patry_supplemental.pdf
- Vellus hair: https://en.wikipedia.org/wiki/Vellus_hair
- Hair types by diameter and length: https://www.medicalalgorithms.com/types-of-human-hair
- Otberg 2004: https://data.zhenzhi.com/details/1/889731637
- MetaHuman fuzz (community): https://forums.unrealengine.com/t/creating-peach-fuzz-for-your-character-like-metahuman/695520
- Substrate fuzz: https://forums.unrealengine.com/t/substrate-setting-up-a-fuzz-map/2838647

---

## 6. Colour: two chromophores, zones, under-eye

**What it is.** Skin colour is set mostly by **melanin** in the epidermis and **hemoglobin** in the dermis, the two
layers of the standard model.
- **Donner & Jensen 2006** control appearance with four parameters: oil, melanin, melanin type (eu/pheo), hemoglobin.
  This is enough to cover African, Asian and Caucasian skin.
- **Jimenez et al. 2010** capture per-expression **hemoglobin and melanin maps**. They keep a base melanin and a base
  hemoglobin map and code only hemoglobin *changes*, so blushing and pallor animate in real time. MetaHuman's CM1-3
  blood-flow maps are the same idea.
- **Iglesias-Guitian et al. 2015** drive a multi-layer model by age, gender and skin type, with time-varying
  chromophores.

**Numbers** (absorption shapes for an RGB approximation; band centres 610/550/465 nm; my calculation):
- **Melanin** absorption ∝ λ^-3.33 (Jacques: μa = 6.6×10¹¹·λ^-3.33 cm⁻¹ inside melanosomes). RGB weight
  **(0.41, 0.57, 1.0)**: browning and yellowing.
- **Oxy-hemoglobin**, Prahl's extinction table **[memory values: 1506 / 43016 / 33209 cm⁻¹/M]**. RGB weight
  **(0.035, 1.0, 0.77)**: takes green and blue, leaves red. Flush, alae, lips.
- **Deoxy-hemoglobin** (about 9443 at 610 nm against oxy's 1506 **[memory]**). RGB weight **(0.18, 1.0, 0.30)**:
  purple-blue. Veins, the venous under-eye, cold or fearful lips.
- Ranges in Donner-Jensen-style models: melanin fraction about 0-0.5 and hemoglobin about 0.001-0.1, with
  oxy-hemoglobin often fixed at 0.75 **[memory; the 2025 polarimetric reuse fixes γ = 0.75]**.

```glsl
// chromophores as Beer-Lambert-like filters on a pale base (layer maps from landmarks; amounts 0..1)
const vec3 K_MEL = vec3(0.41, 0.57, 1.0), K_HBO2 = vec3(0.035, 1.0, 0.77), K_HB = vec3(0.18, 1.0, 0.30);
vec3 skinCol(vec3 base, float mel, float hbo2, float hb) {
  return base * exp(-(uMelK * mel * K_MEL + uHbK * hbo2 * K_HBO2 + uHbK * hb * K_HB));   // uMelK, uHbK ~ 0.5-2 [est.]
}
// pallor (fear): hbo2 *= 0.5, hb += 0.1 at the lips and under the eyes; flush: hbo2 += 0.3 on cheeks, nose, ears
```

**Zones** (painter's convention, Gurney 2008, vs measurements):
- Painter's convention: forehead yellowish or golden, forehead-to-nose reddish, mouth to chin bluish, greenish or
  grey (the last zone is from a secondary source; it is strongest in men with beard shadow).
- Measured (Xiao 2017, four ethnic groups including Chinese): facial redness a* was similar across ethnic groups, and
  the **forehead had the highest a*** of their four sites (forehead, cheek, inner arm, back of hand). Treat the
  "yellow forehead" as hue, not redness.
- Beijing vs Tokyo women (2020, cheek): Chinese skin was brighter, redder and less yellow than Japanese. In both, L*
  falls and a* rises with age. Most were ITA "light/intermediate/tan".
- **Redness hot spots [est.]:** nose wings and tip, cheek apples, ear rims and lobes, upper eyelids (pinkish), chin
  tip, around the nostrils.

**Targets, CIELAB → sRGB [est.: typical published ranges, not one study's means]:**

| region | L* | a* | b* | ITA° | sRGB |
|---|---|---|---|---|---|
| light East Asian cheek | 65 | 10 | 16 | 43 | `#ba9782` |
| a lighter young cheek | 68 | 9 | 15 | 50 | `#c09f8b` |
| forehead (yellower) | 64 | 9 | 18 | 38 | `#b6957c` |
| nose wing / flush | 60 | 15 | 16 | | `#b48675` |
| under-eye | 58 | 9 | 12 | | `#a38577` |
| natural vermilion | 52 | 22 | 10 | | `#a56d6c` |

These are reflectance (albedo) colours. Check them with a neutral tone map (§8) and a grey card in view, not by
matching a photo's brightness, since photos are often exposed brighter.

**Under-eye darkness.** It has four causes, often combined: pigment (brown, melanin), vascular (blue-purple: thin
skin, often **< 0.5 mm**, showing the venous plexus and the orbicularis), translucency, and structural shadow (the
tear trough). It is more marked with age. Model it as melanin + deoxy-Hb in a crescent below the lower lid, plus a
little extra roughness and finer, denser crepe texture. Leave the shadow itself to geometry, AO and the light.

**Cost:** an exp of a vec3 per pixel; the masks we already compute from landmarks.

**Bake:** these colour layers *are* the albedo. Flush and pallor deltas are candidate blood-flow (CM) pairs later.

**Links:**
- Donner & Jensen 2006: https://graphics.ucsd.edu/~henrik/papers/skin_bssrdf/
- Jimenez et al. 2010: https://www.iryoku.com/skincolor/
- Iglesias-Guitian et al. 2015: https://graphics.unizar.es/papers/Iglesias_eg15.pdf
- Jacques, skin optics: https://omlc.org/news/jan98/skinoptics.html
- Melanin absorption: https://omlc.org/spectra/melanin/mua.html
- Prahl, hemoglobin spectra: https://omlc.org/spectra/hemoglobin/
- Polarimetric BSSRDF 2025 (reuses the model): https://arxiv.org/pdf/2501.01980
- Xiao et al. 2017: https://eprints.whiterose.ac.uk/id/eprint/100718/
- Gurney, color zones of the face: https://gurneyjourney.blogspot.com/2008/05/color-zones-of-face.html
- Chinese vs Japanese facial colour (2020): https://bvbvf1.bib-bvb.de/vufind/PrimoRecord/cdi_proquest_miscellaneous_2339788331
- Korean facial colour variability: https://color.kaist.ac.kr/?p=1296
- Periorbital dark circles: https://en.wikipedia.org/wiki/Periorbital_dark_circles

---

## 7. Lips, the tear line and the inner corner

**Lips: what makes them read.**
- The vermilion has no hair or sebaceous glands, very thin cornified layer, little melanin, and blood close to the
  surface. So it is **redder, more translucent, smoother and wetter** than skin.
- Its surface carries **lip lines** (sulci labiorum) running roughly **perpendicular to the vermilion border**.
  Suzuki & Tsuchihashi's types: I full vertical, I′ partial, II branched, III crossing, IV reticular, V undetermined.
- At the border, a thin pale raised **"white roll"** catches light and forms the V of the cupid's bow.
- Wet highlights are small, sharp and broken by the lines. They sit on the lower lip's centre and the cupid's-bow peaks.

**Numbers [est.]; no source gave line spacing or lip roughness:**
- Lines about 0.6-1.2 mm apart in the middle, closer and finer toward the corners, dashed and branched. Our current
  `uLipN = 300` gives about 1.3 mm.
- Base roughness: dry 0.40-0.45, natural 0.30-0.35.
- Wet film as the sharp lobe: weight 0.5-0.9, roughness 0.05-0.12, **absent inside the lines**. We already damp the
  coat by `ln`.
- Hemoglobin is about 2-3× the cheek's. The SSS amount is higher, so in Unreal the Opacity mask is about 1.0 on the
  lips.
- White roll: a 0.5-1 mm band just outside the border, +5-8% value, slightly lower roughness.
- Omniverse's digital human excludes the lips from the skin micro-normal. Do the same: no furrow network on the lips.

**Tear line and inner corner (canthus).** The studio already has a tear-line strip (`TEARM`) and eye occlusion, the
MetaHuman/Reallusion structure. Reallusion's description: the tear line emulates the reflections of tears at the line
of contact between eyeball and lids; the occlusion simulates the lids' shadow.
- MetaHuman's eye occlusion is **unlit/emissive** so it never goes black. Its "Apply Fogging" causes bright eyes under
  height fog (forum).
- Path-traced, MetaHuman's tear line is nearly invisible and uses no refraction (forum).
- v2 numbers **[est.]**:
  - tear meniscus: F0 ≈ 0.02 (water, n 1.33), roughness 0.03-0.08, about 0.2-0.3 mm high on the lower lid, fading out
    at the corners
  - caruncle: pink-red, wet (roughness 0.15-0.25), with a little scatter
  - waterline (lower lid rim): roughness 0.1-0.2. Our makeup layer already wets it.
- **Catchlights** come from the key's *shape*. A large soft key gives a soft rectangle (§8).

**Cost:** existing layers; small changes.

**Links:**
- Lip anatomy, white roll: https://www.ncbi.nlm.nih.gov/books/NBK507900/
- White roll: https://taylorandfrancis.com/knowledge/Medicine_and_healthcare/Anatomy/White_roll
- Cheiloscopy types: https://pmc.ncbi.nlm.nih.gov/articles/PMC9469331
- Omniverse digital human setup: https://docs.omniverse.nvidia.com/workflows/latest/rtx_rt-dh-setup.html
- Reallusion tear line: https://manual.reallusion.com/Character-Creator-4/Content/ENU/4.0/15_Digital_Human_Shader/Eyes/Digital-Human-Tearline-Shader.htm
- Reallusion eye occlusion: https://manual.reallusion.com/Character-Creator-5/Content/ENU/5.0/15_Digital_Human_Shader/Eyes/Digital-Human-Eye-Occlusion-Shader.htm
- MetaHuman eye occlusion: https://forums.unrealengine.com/t/metahuman-eye-occlusion-shader/541004
- MetaHuman tear line in path tracing: https://forums.unrealengine.com/t/path-tracing-glass-material-black-artifacts/2156370

---

## 8. The rest of the picture (three.js viewer)

**Tone mapping:**
- r160 has Linear, Reinhard, Cineon, ACESFilmic, **AgX** (gamut fix in r161) and Custom.
- Khronos **PBR Neutral** is r162. Both Neutral and r161's AgX can be added **without upgrading**, through the
  `CustomToneMapping` hook: replace `vec3 CustomToneMapping( vec3 color ) { return color; }` in
  `THREE.ShaderChunk.tonemapping_pars_fragment`. The string is present verbatim in our r160 **[code]**.
- Which to use:
  - **AgX** for the photographic "reference still" look. It rolls bright skin off toward white instead of skewing hue.
  - **Neutral** to check albedo and bakes. It is almost identity below about 0.76 and keeps base colours.
  - **ACES Filmic** shifts hue in highlights; a three.js maintainer calls this "a bit of a known problem". It pushes
    bright skin toward orange-yellow.
- Today the studio clips with no tone mapping, which flattens highlights and makes the sharp lobe look plastic.

```glsl
vec3 CustomToneMapping( vec3 color ) {           // Khronos PBR Neutral (as in three.js r162)
  const float startCompression = 0.8 - 0.04, desaturation = 0.15;
  color *= toneMappingExposure;
  float x = min(color.r, min(color.g, color.b)), offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;
  float peak = max(color.r, max(color.g, color.b));
  if (peak < startCompression) return color;
  float d = 1.0 - startCompression, newPeak = 1.0 - d * d / (peak + d - startCompression);
  color *= newPeak / peak;
  float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
  return mix(color, vec3(newPeak), g);
}
```

**Lighting like the references** (soft key on a dark background):
- A **large soft key**: about 0.6×0.9 m at 1-1.5 m, 30-45° to the side and above **[est.]**.
  - Either a `RectAreaLight`, which needs `RectAreaLightUniformsLib` (not vendored) and casts no shadows, so pair it
    with a shadowed directional light from the same side.
  - Or a softbox in the PMREM environment. That is what we do now, with four cards.
- A weak fill, a key:fill of 1:4 to 1:8 **[est.]**, and a dark background.
- A **rim or kicker** from behind. It is what makes the fuzz (§5) and the ear transmission (§2) visible.
- The env's softbox must match the key, so the catchlights and the highlight shapes agree.
- Free CC0 studio HDRs: Poly Haven. The studio view already loads `studio_small_09_1k.hdr`.

**Ambient and specular occlusion:**
- Bake a per-vertex AO once on MHR's base mesh: nostrils, eye sockets, under the chin, behind the ears.
- Multiply it with the procedural cavity, and feed it to three.js's `computeSpecularOcclusion` (§3).
- Screen-space AO needs EffectComposer passes, which are not vendored. A per-vertex AO is enough for one character.

**Film grain.** Light luminance grain after tone mapping hides banding in dark backgrounds and makes CG read
photographic. Use σ ≈ 1-2% of the signal, new each frame **[est.]**, in a final screen pass (FilmPass, or 3 lines in a
custom output pass). Never in the material.

**Depth of field.** At an 85 mm-equivalent around f/2.8, ears and hair fall off slightly. BokehPass (approximate) is
for beauty stills only; skip it in the POV check.

**Anti-aliasing.** MSAA (`antialias: true`) plus alpha-to-coverage are already on. Add the geometric/procedural
specular AA from §3, or the sparkle and pores will shimmer as the head turns.

**Links:**
- three.js r160 (AgX): https://newreleases.io/project/github/mrdoob/three.js/release/r160
- three.js r161 (AgX gamut fix, PR #27413): https://github.com/mrdoob/three.js/pull/27413
- three.js r162 (Neutral): https://newreleases.io/project/github/mrdoob/three.js/release/r162
- AgX discussion: https://discourse.threejs.org/t/is-agx-tonemapping-implemented-correctly/60609
- Tone mapping guidance: https://discourse.threejs.org/t/pmndrs-post-processing-tone-mapping-guidance/59374/2
- model-viewer tone mapping: https://modelviewer.dev/examples/tone-mapping
- GTAO (Jimenez 2016): https://www.iryoku.com/downloads/Practical-Realtime-Strategies-for-Accurate-Indirect-Occlusion.pdf

---

## 9. Bake for Unreal: what each layer becomes (MHR UVs)

| map | from the browser shader | Unreal input |
|---|---|---|
| Base colour (sRGB) | albedo: chromophore zones, freckles, spots, makeup. **No** lighting terms: no rim, transmission, sheen or LUT reddening | Base Color (Slab diffuse albedo) |
| Normal (tangent, 4K) | wrinkles, pores, primary furrows (≥ 0.3 mm) | Normal; finer detail as a tiling micro-normal (LOD0 only, like MetaHuman) |
| Roughness | zone roughness (T-zone, dewy, lips, under-eye) **plus** the variance of relief finer than a texel (Toksvig) | Roughness; the profile's 0.75 / 1.30 / 0.85 split it into two lobes |
| Cavity | pore and furrow depth | Specular (0.35 × cavity, so F0 ≤ 0.028) |
| SSS amount | 1 on lips, ~0.9 skin, lower on brows and stubble **[est.]** | Opacity (Subsurface Profile) |
| Fuzz mask | fuzz density | Substrate Fuzz Amount (needs Adaptive GBuffer) or a fuzz groom |
| Flush / pallor deltas | hemoglobin changes | MetaHuman-style CM maps with RigLogic masks (later) |
| (thickness) | only for the browser's translucency | not needed: UE's transmission uses shadow depth; tame it with Extinction Scale under VSM |

Profile to start from: the struct defaults (§1). Check them under the project's VSM and Blendable GBuffer, then tune
Roughness0/1, LobeMix and Extinction Scale by measurement (the shot review), not by painting.

---

## 10. The 8 changes that would most move our skin toward MetaHuman realism (smallest effort first)

1. **The picture** (hours). Add AgX or Neutral through `CustomToneMapping` with exposure about 1, and a "reference"
   light preset: a big soft key plus a matching env softbox, a dark background, and a rim. Every later step is judged
   under it, and it alone removes the clipped, plastic highlight.
2. **Peach fuzz** (hours). Masked `sheen` (Charlie, roughness 0.35-0.5) plus the asperity rim and its back-lit term
   (§5). This gives the velvety edge the references show along the cheek and jaw.
3. **The specular stack** (about a day). Keep F0 0.028. Add Unreal's dual lobe (R×0.75 at 15%, R×1.3 at 85%) in `BRDF_GGX` and
   the IBL, cavity on `specularColor`, AO into `computeSpecularOcclusion`, roughness by zone, and the faded relief's
   variance into roughness. This is the MetaHuman highlight: broad and soft, with a fine sharp core that breaks up.
4. **Light-driven scattering** (about a day). Remove the emissive rim. Add per-channel normals with weights R 0.67,
   G 0.21, B 0 toward the smooth normal, a penumbra tint at shadow edges, and the pre-integrated LUT with a width knob.
   Pores stay crisp in the highlight and soft and warm in the diffuse.
5. **Thin-part transmission** (about a day). Bake per-vertex thickness once on MHR (inverted-normal AO: ears, alae,
   nostril rims, eyelids, fingers). Use the Frostbite term with the profile's transmittance colours and no ambient
   term. This gives the red glow at the nostrils and ears, driven by the key and the rim.
6. **Two-chromophore colour** (about a day). Melanin, oxy-Hb and deoxy-Hb layers with the RGB weights above,
   replacing the ad-hoc tints: the alae and cheek-apple redness, the purple-brown under-eye, the pinker eyelids, and a
   flush/pallor slider (fear!) that also feeds the bake.
7. **Micro-relief at real scale** (1-2 days). A Voronoi-edge furrow network (0.25-0.45 mm, anisotropic), pores
   re-spaced to about 0.65 mm with only the visible ones at 0.28-0.45 mm (sparser for young East Asian skin), depth
   modulated by strain, and fading to roughness. This is MetaHuman's micro-normal look and the source of the natural
   sparkle.
8. **Micro-sparkle, then optional screen-space SSS** (2-4 days). Hashed glint facets for dewy and makeup shimmer now;
   a Zirr-Kaplanyan port (Shadertoy GLSL) if it must hold up in motion; and Jimenez's separable SSS as a "quality"
   mode once EffectComposer and MRT are vendored.

**Checks**, in keeping with "judge the frame":
- Make a contact sheet of each step under the reference light and the game's three lights, at close-up and at
  medium POV.
- Measure the cheek highlight's area and peak, albedo variance over the cheek, the terminator hue, and ear and nose
  transmission under a rim light, against crops of the user's reference stills.
- The scripts behind the numbers here: `docs/research/skin_v2/calc.py` (colours, chromophore weights, Burley s,
  roughness splits) and `lut.py` (the pre-integrated LUT and transmittance samples).
