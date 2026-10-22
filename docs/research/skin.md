# Procedural skin for the Character Studio: research note (2026-10-22)

Scope: how artists layer procedural skin, what makes "glass skin", young vs aged, oil and makeup as layers, how
MetaHuman skin works, and concrete presets for `tools/character/skinshader.js`. Most pages could not be fetched from
this sandbox (DNS), so this rests on search summaries plus established rendering facts; **[guess]** marks my own
estimates, **[memory]** marks values I know but could not re-verify here.

Context checked in the repo (read only): the studio skin is a `MeshStandardMaterial` (roughness 0.62) with
`skinshader.js` adding mottling, grain, pores (T-zone weighted from MediaPipe landmarks 4/425/205), freckles,
flush, veins and a translucency rim. `docs/METAHUMAN_LOOKS.md` §2 already holds a glass-skin recipe for MetaHuman
(roughness about 0.3, specular 0.55, shallow cavity); the numbers below agree with it.

---

## 1. How Blender artists build procedural skin

**The usual layer stack** (seen across UltimateSkin, Sporemind, Tri-vima, Pignataro's free shader, the Xeofrios
painterly breakdown):

1. **Base albedo**: a tone colour, then large-scale variation: fbm/Noise blotches (redness, mottling, 2 to 5 cm),
   zone tints (redder cheeks/nose/ears, slightly yellower forehead, bluish-grey around the mouth/jaw for stubble
   zones in men, darker eyelids). Kept subtle: one artist moving a Blender skin to Unreal found "colour variation far
   too prominent" there and had to tone it down and re-bake.
2. **Pores**: a Voronoi texture (distance to F1, or "Distance to Edge" inverted) at roughly 0.3 to 1 mm cell size,
   thresholded with a ColorRamp, fed to a **Bump** node (strength roughly 0.05 to 0.2, distance a few mm) and a small
   darkening of albedo/specular in the pore centres. Masked: densest on nose, inner cheeks, chin; finest on
   forehead/eyelids; almost none on lips.
3. **Micro-grain / micro-normal**: high-frequency Noise (scale in the thousands per metre) into the same bump, often
   with a slight stretch along the skin's tension lines.
4. **Blemishes etc.**: freckles, moles, red spots, veins, pimples, goosebumps as separate masked layers
   (UltimateSkin lists exactly these).
5. **Subsurface**: Principled BSDF **Subsurface Weight 1.0** (the manual: "typically zero or one"), **Radius RGB with
   red largest** (red scatters deepest in skin); the Principled default radius is (1.0, 0.2, 0.1) with Scale 0.05 m
   **[memory]**, artists typically use Scale 0.002 to 0.01 m for a life-size head **[guess from common practice]**.
   Cycles' **Random Walk (Skin)** method adapts the radius to the colour texture and keeps more surface detail; the
   manual gives skin's measured **anisotropy as 0.8**. Subsurface IOR 1.4.
6. **Specular / roughness**: IOR 1.4 (F0 about 0.028; Unreal's "measured skin" Specular 0.35 is the same F0),
   roughness about 0.35 to 0.55 overall, lower (shinier) on nose, forehead, lips, higher in pores and wrinkles (Epic's
   Digital Human notes: specular "dampens in areas where we don't want reflection, such as the centre of the pores
   and within wrinkles"). NVIDIA's skin talk quotes 0.3 as a good facial average from Weyrich's measurements (in its
   own BRDF's units).
7. **Second lobe / coat**: the dual-lobe idea (a broad lobe for the skin, a sharp lobe for the thin oil film) done in
   Blender with **Coat**: weight about 0.05 to 0.3, coat roughness about 0.2 to 0.4, coat IOR 1.4 to 1.5 **[guess,
   common practice]**. Some add **Sheen** (weight 0.05 to 0.2, roughness 0.3 to 0.5) for peach fuzz at grazing
   angles **[guess]**.

**Free / cheap node groups and licences**
- *UltimateSkin* (kuhantilope, Gumroad/Superhive): fully procedural, EEVEE and Cycles; pores, blemishes, freckles,
  veins, moles, red spots, goosebumps, pimples; one node group. Terms: personal and commercial use, attribution
  appreciated, **do not resell the material** (listed as "Creative Commons", variant not stated).
- *Eugenio Pignataro (Oscurart)*: free procedural shader with procedural pores (80.lv); **no licence stated**, so
  study only.
- *Xeofrios*: painterly procedural skin, faked SSS, Voronoi-driven strokes (80.lv breakdown); technique reference.
- Paid: Sporemind Procedural Skin Shader (subsurface slider, pore depth), Tri-vima (matte-to-oily shine control),
  Ryan King procedural skin, PixelicaCG "Ultimate Guide to Hyper-Realistic Skin" (Blender 4.x), Konrad Hetko's face
  course (peach fuzz module). Royalty-free product licences; nothing to copy, only the layer ideas.
- Our shader already credits the layered-noise approach (Vulpinii/skin-texture) and uses our own code; same rule
  going forward: copy ideas, not node groups.

## 2. Glass skin / dewy / chok-chok in CG

**What it is (beauty sources)**: "smooth, clear, poreless, translucent and luminous like a piece of glass" (Glow
Recipe's Sarah Lee via Refinery29); "exceptionally smooth, even-toned and lustrous" (Dermstore); a "lit-from-within
glow that shines without looking oily". The minimised pores come from hydration, not smaller pores, and several
sources say glass skin does not require literally poreless skin.

**What makes it read in a render** (no CG breakdown of "glass skin" turned up; this is the synthesis, consistent with
METAHUMAN_LOOKS §2):
- **Even albedo**: mottling and redness pulled down hard; only a soft, broad flush (upper cheeks) and a slight pink/
  peach undertone kept. Uneven tone is the strongest "older/tired" cue (see §3), so evenness is most of the effect.
- **Low, even roughness on the broad lobe** (about 0.28 to 0.38) and **a thin sharp coat** on top: the wide, soft
  highlight that slides over cheekbone, nose bridge, forehead centre, chin and cupid's bow.
- **Low pore contrast**: pore bump strength about a third of normal; pores still slightly rougher than the skin
  between them so the highlight breaks up a little at close range (a perfectly smooth highlight reads as plastic).
- **More translucency**: slightly larger SSS radius / stronger rim glow; soft shadow terminators.
- **Highlight placement**: it is mostly geometry plus lighting; the shader helps with a "dewy zone" mask that lowers
  roughness further on the high planes (cheekbone tops, nose bridge, forehead centre, chin) **[guess, matches the
  beauty description of strobing]**.
- **Lighting dependency**: it reads under a large soft key plus rim; under one hard light it becomes a wet point
  highlight. inZOI (Krafton, UE5, MetaHuman-based) puts gloss under makeup (highlighter with Tone/Glow, lipstick
  gloss), not as base-skin gloss, which is a useful split: base skin moderately glossy, "glow" as an optional layer.
- PC Gamer's MetaHuman launch review complains about "that strange skin shine": too much sharp specular over the
  whole face is the failure mode; keep the coat thin and mask it.

## 3. Youthful vs aged skin

**Physical changes** (Iglesias-Guitian et al. 2015 multilayer aging model; Shiseido/Muroran translucency work; a
PMC study of 50 Japanese women aged 30 to 50s):
- Dermis and epidermis thin, the dermo-epidermal junction flattens, collagen deteriorates: base colour, translucency
  and surface reflectance all shift.
- **Less subsurface light re-emitted with age** (Shiseido): less translucency, flatter, "duller" look.
- Perceived **dullness** tracked most with **melanin and yellowness**, then redness, roughness and translucency (the
  Japanese study), with weights changing by age group: sallowness is a yellow/grey shift plus lost translucency.
- Uneven melanin: age spots (lentigines), mostly on cheekbones, temples, forehead, backs of hands.
- Thinner skin shows **veins** (temples, under the eyes, hands) and redness (broken capillaries on nose and cheeks).
- Bigger, more elongated pores (cheeks, nose), rougher, drier surface (higher roughness, weaker coat).
- Wrinkles at landmarks: **forehead lines** (horizontal), **glabellar "11" lines** between the brows, **crow's
  feet** fanning from the outer eye corners, **under-eye lines and tear trough**, **nasolabial folds** (nose wing to
  mouth corner), **marionette lines** (mouth corner down to jaw), **lip lines** (vertical, upper lip), neck bands.
- Sagging: jowls, lowered brow, hooded upper lids, deeper tear trough; that is geometry (MHR identity shapes), the
  shader only adds shading.

**How CG fakes it**: wrinkle normal maps blended per region by masks (Oat, SIGGRAPH 2007; Jimenez et al.; Unity's
Blacksmith); MetaHuman's "Face Texture Index" (a flipbook of wrinkle-density textures that "can help make your
character look younger or older"); commercial Blender aged materials expose age (wrinkles, spots, tonal fade) plus
roughness and SSS. Rule from Epic: roughness rises inside wrinkles and pores.

**Procedurally, on our body (no UVs)**: each wrinkle family is a **distance field from a landmark curve** (MediaPipe
points on the face fit) modulating a 1D sine/ridge pattern along the curve's normal, with fbm wobble, amplitude by
age. Candidate anchors **[guess, check on the mesh]**: forehead band between brow line and landmark 10; glabella near
9/168; crow's feet from outer eye corners 33 and 263; under-eye along lower-lid points 145/374; nasolabial from nose
wings (about 129/358) to mouth corners 61/291; marionette from 61/291 down toward the jaw. Store the result as height
(bump) plus a roughness increase and a slight albedo darkening in the crease. Later in Unreal the same masks can be
baked to a texture on MHR's UVs.

## 4. Oil and makeup as layers

**Oily skin**: oil is a thin film with unevenly distributed sheen. As a layer: a **T-zone mask** (forehead centre,
nose, chin; plus inner cheeks next to the nose) that **drops roughness** (by 0.1 to 0.2) and **raises coat weight**
(to 0.4 to 0.7) with low coat roughness; a broken-up noise in the mask so it is patchy. Reallusion's skin uses an RGBA
area mask, one channel per region, each with its own roughness: the same structure. Remember Unreal's roughness
convention (white = rough) when baking.

**Makeup looks** (beauty sources):
- **Korean natural**: even, dewy base; soft blush **on or just below the cheekbone**; **gradient lips** (strong pink/
  red in the centre fading to nude at the edges); **aegyo-sal**: a thin pearl/light highlight under the lower lash
  line over the under-eye "smile pad", with a faint brown shadow line just below it; **puppy eyeliner** (thin upper
  liner ending in a short flick that angles slightly down, brown rather than black); **straight, softly filled
  brows** (sources say only "a simpler arch").
- **Japanese igari**: blush placed **high, between the cheekbone and the eye, almost directly under the eyes and
  across the nose bridge** ("hangover/drunk blush"), most pigment on the apples close to the lower lids, **no
  contour, no highlight**, minimal eyes, juicy or blurred soft-edged lips (sheer tint, "bitten" lip).
- **Soft glam** **[guess, general convention]**: more coverage, warm-brown eyeshadow and a longer liner wing,
  blush and bronzer lower on the cheekbones, a defined highlight on cheekbone tops and nose bridge, satin lips.

**How game creators layer it**: stacked masked colour layers with their own colour, intensity and gloss
(Reallusion's blush = contour + blush + highlight layers; DAZ makeup editors apply layers through the shader so they
stay adjustable; Roblox bakes per-region layers; MetaHuman: foundation, eyes, blush, lips, each with colour,
intensity and roughness; inZOI: every makeup category has intensity, colour and gloss). Practical model: each layer
= (mask, colour, opacity, roughness override, optional coat). Masks are UV paint or, for us, landmark-anchored
procedural shapes (ellipses and curve distances) with soft falloff; layer order foundation -> contour -> blush ->
highlight -> eyes -> lips.

## 5. MetaHuman skin, how it works

- **Synthesis, not painting**: Creator's texture synthesiser (`FMetaHumanFaceTextureSynthesizer`) builds face
  textures from the **skin tone (U, V on a swatch)** and a discrete **high-frequency index** (the "Face/Body Texture
  Index": "a flipbook of discrete texture choices that control the wrinkle density and appearance"; "can help make
  your character look younger or older"; filters by wrinkle, stubble, freckle, mole density). Press at launch
  described the database as blending scanned examples "in a plausible, data-constrained way". Epic does not publish
  how the scan set is spread across ages or ethnicities; **the user's observation that young textures are few is not
  confirmed by any source found**, but it matches the design: detail comes only from the scanned set, so if the
  smoothest index still carries adult pores and fine lines there is no slider below it. Reallusion's comparison
  calls MHC's wrinkle patterns "default (not adjustable)" and skin effects "limited".
- **Maps**: per character, face and body **albedo, normal, cavity**, face **animated maps** (wrinkle maps), body
  masks; at assembly baked into Base Color, **SRMF** (specular, roughness, metallic, fuzz packed), a base detail
  normal, and a 512x512 scatter map; the material exposes global multipliers for base colour, specular, roughness,
  scatter, normal. Custom textures are allowed (Texture Override).
- **Wrinkles**: RigLogic outputs drive wrinkle masks in the material (Epic's DNA docs: some outputs, "wrinkle
  triggering", connect to materials). The Poly Hammer DNA docs describe the node: three colour and three normal
  variants blended by RGB masks (black base, R/G/B wrinkle maps 1 to 3) weighted by RigLogic. Same technique as
  Oat 2007.
- **Shading**: Unreal **Subsurface Profile** shading model; dual-lobe specular lives in the profile asset (struct
  defaults Roughness0 0.75, Roughness1 1.3, Lobe Mix 0.85: multipliers on the material roughness, two lobes for the
  oily film); Burley SSS is an "Enable Burley" checkbox needing TAA, with mean free path colour default about
  (1.0, 0.089, 0.072) and distance 2.67 cm (4.2x Python defaults). SSS is disabled at Medium/Low material quality.
- **Licence**: since UE 5.6 MetaHuman falls under the standard Unreal EULA and MetaHumans may be used in any engine
  or DCC (CG Channel, Digital Production, June 2025); free under USD 1M revenue. The assets and synthesised textures
  stay Epic content under that EULA; the *approach* (zone masks, dual lobe, wrinkle-map blending, an age index) is
  generic published technique (Oat, Jimenez, Weyrich) and free to reimplement. Nothing found restricts copying the
  method; do not copy MetaHuman textures or the head's masks into shared files (our CLAUDE.md rule already).
- **Making MetaHumans younger/East Asian** (what turned up): smoothest texture index, roughness and specular tuned
  separately and checked under the target lighting (Convai's guide: renderer and exposure change perceived gloss),
  custom textures. Fab sells "young Asian" MetaHumans with custom face texture setups, which suggests the stock
  textures are not enough. Our §2 recipe in METAHUMAN_LOOKS covers the rest.

## 6. Recommendations for our shader

**Switch the skin to `MeshPhysicalMaterial`**: `ior` 1.4, `specularIntensity` 1, `clearcoat` as the oil lobe,
`sheen` for fuzz, keep our `onBeforeCompile` layers. Three.js has no real SSS: keep the wrap-diffuse/rim translucency
term, add a red-shifted wrap on the terminator **[guess]**. It costs more per pixel and needs an environment map
(three.js docs) or the highlights will not read; use a soft studio HDR/RoomEnvironment.

**New layers to add** (each a slider, like the existing ones): *Evenness* (scales mottle, flush blotch, grain and
spots together), *Dewy* (high-plane mask lowering roughness), *Oil* (T-zone mask: roughness down, coat up), *Age*
(drives wrinkle families, spots, sallow shift, pore size, SSS down, roughness up, veins up), *Wrinkles* per family
(forehead, glabella, crow's feet, under-eye, nasolabial, marionette, lip), *Spots*, *Makeup* stack (foundation,
blush with a placement control from "Korean cheekbone" to "igari under-eye", contour, highlight, aegyo-sal, liner,
brow fill, lips with gradient amount and gloss).

**Presets** (MeshPhysical units; roughness is the base layer; all **[guess]** starting points to tune by eye in
medium POV shots, aimed at a slightly stylised "hybrid realism": fewer, bolder features beat many tiny ones that
alias at medium range, and our `fwidth` fade already handles that):

| Preset | Rough | Coat / coat rough | Sheen | Pores (amt, mm) | Mottle | Grain | Flush | Transl. | Veins | Age | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Young glass | 0.32 | 0.25 / 0.25 | 0.10 | 0.12, 1.0 | 0.08 | 0.15 | 0.25 peach-pink | 0.55 | 0.05 | 0 | dewy 0.6 on high planes (to about 0.24); albedo saturation -5% |
| Natural young | 0.42 | 0.12 / 0.35 | 0.10 | 0.30, 1.2 | 0.25 | 0.30 | 0.30 | 0.45 | 0.08 | 0.1 | default for young cast |
| Adult (30 to 45) | 0.48 | 0.10 / 0.40 | 0.08 | 0.45, 1.5 | 0.40 | 0.35 | 0.35 | 0.38 | 0.12 | 0.35 | faint crow's feet and nasolabial (0.2) |
| Aged 50+ | 0.55 | 0.06 / 0.45 | 0.05 | 0.60, 1.9 | 0.50 | 0.45 | 0.30 | 0.28 | 0.25 | 0.6 | wrinkles 0.4 to 0.6, spots 0.25, yellow +3% |
| Aged 70+ | 0.62 | 0.03 / 0.50 | 0.04 | 0.70, 2.3 | 0.55 | 0.55 | 0.25 broken capillaries | 0.20 | 0.40 | 0.9 | wrinkles 0.8, spots 0.5, sallow (grey-yellow) +6%, temple/hand veins |
| Oily (add-on) | -0.12 in T-zone | +0.45 / 0.15 in T-zone | - | +0.05 | - | - | +0.05 | - | - | - | patchy mask; nose tip and forehead centre strongest |

**Makeup presets** (layer colour, opacity, roughness):
- *Natural Korean*: foundation opacity 0.5, colour half a step lighter than tone, evenness +0.4, roughness 0.30;
  blush rosy-coral, 0.25, on/below cheekbone, wide soft falloff; aegyo-sal pearl highlight 0.35 (roughness 0.25)
  with a 0.1 light-brown line below; puppy liner brown 0.6, short down-angled flick; brows straight, soft fill 0.4;
  lips gradient (centre red-pink 0.7 to edge nude 0.1), roughness 0.25 with coat 0.3.
- *Japanese igari*: foundation 0.35 (keep skin showing, dewy base); blush pink-red 0.35 high under the eyes and across
  the nose bridge, densest near the lower lid; contour 0, highlight 0; liner thin brown 0.3; lips sheer tint 0.5
  with blurred edges, roughness 0.30.
- *Soft glam*: foundation 0.7, roughness 0.40 (satin, coat down to 0.05 except highlight); contour cool taupe 0.3
  under cheekbones; blush warm 0.3 on the cheekbone, swept back; highlight 0.45 on cheekbone tops and nose bridge
  (roughness 0.18, coat 0.4); eyeshadow warm brown 0.5, longer liner wing; lips satin rose 0.8, roughness 0.35.

**Checks to make it measurable** (fits "judge the frame"): render a contact sheet of each preset under the game's
three lights (soft key with rim, flashlight, the dark) at medium POV distance and at close-up; measure highlight
area and peak on the cheek (glass skin: broad and medium peak; oily: smaller, brighter; aged: weak, broken) and
albedo variance over the cheek (glass skin lowest). The Unreal export later maps: our roughness/specular to SRMF (or a
5.8 Material Override), coat to the dual lobe (Lobe Mix and Roughness1), translucency to the subsurface profile,
wrinkle families to baked masks on MHR's UVs.

---

## Sources

- Blender manual, Principled BSDF: https://docs.blender.org/manual/en/4.2/render/shader_nodes/shader/principled.html
- 80.lv, free procedural skin shader (Pignataro): https://80.lv/articles/free-procedural-skin-shader-for-blender
- 80.lv, procedural hand-painted skin (Xeofrios): https://80.lv/articles/procedural-hand-painted-skin-shader-created-with-blender
- UltimateSkin (kuhantilope): https://kuhantilope.gumroad.com/l/ultimate-skin , https://superhivemarket.com/products/ultimateskin
- Sporemind Procedural Skin Shader: https://superhivemarket.com/products/procedural-skin-shader/docs
- Tri-vima Procedural Skin Shader: https://superhivemarket.com/products/procedural-skin-shader-for-blender
- Procedural Skin Material, Detailed (aged): https://superhivemarket.com/products/procedural-skin-material---detailed
- CG Cookie (Blender to Unreal skin): https://cgcookie.com/comments/352224/replies/new
- NVIDIA GDC 2007 Advanced Skin: https://developer.download.nvidia.com/presentations/2007/gdc/Advanced_Skin.pdf
- Unreal physically based materials: https://dev.epicgames.com/documentation/unreal-engine/physically-based-materials-in-unreal-engine
- Unreal Digital Humans showcase (4.26): https://docs.unrealengine.com/4.26/Resources/Showcases/DigitalHumans
- Unreal Photoreal Character (4.26): https://docs.unrealengine.com/4.26/en-US/Resources/Showcases/PhotorealisticCharacter
- Unreal SubsurfaceProfileStruct (defaults): https://docs.unrealengine.com/4.27/en-US/PythonAPI/class/SubsurfaceProfileStruct.html
- Unreal Subsurface Profile shading model: https://dev.epicgames.com/documentation/en-us/unreal-engine/subsurface-profile-shading-model-in-unreal-engine
- Unreal forums, dual lobe specular: https://forums.unrealengine.com/t/dual-lobe-specular/427474
- Unity roadmap, skin dual lobe: https://activation.unity3d.com/roadmap/2120-skin-dual-lobe-and-diffuse-power
- Octane skin shader docs (dual lobe ratio): https://superhivemarket.com/products/skin-shader-for-octane-render/docs
- Weyrich et al. 2006: https://cdfg.csail.mit.edu/pdf/journal/2006-weyrich-analysis-of-human-faces-using-a-measurement-based-skin.pdf
- Iglesias-Guitian et al. 2015 (skin aging model): https://graphics.unizar.es/papers/Iglesias_eg15.pdf
- Japanese skin dullness study (PMC): https://pmc.ncbi.nlm.nih.gov/articles/PMC10337531/
- Shiseido translucency research: https://corp.shiseido.com/en/newsimg/4117_m7o15_en.pdf , https://www.personalcareinsights.com/news/shiseido-light-behavior-skin-research.html
- Oat, Animated Wrinkle Maps (SIGGRAPH 2007): https://www.advances.realtimerendering.com/s2007/Oat%20-%20Wrinkles%20-%20Course%20notes%20(SIGGRAPH%202007).pdf
- Jimenez et al., practical wrinkles: https://iryoku.com/wrinkles/
- Unity Blacksmith wrinkle maps: https://blogs.unity3d.com/pt/technology/wrinkle-maps-in-the-blacksmith
- MetaHuman skin material controls: https://dev.epicgames.com/documentation/metahuman/skin-material-controls
- MetaHuman skin material tools: https://dev.epicgames.com/documentation/metahuman/skin-material-tools
- MetaHuman materials and textures: https://dev.epicgames.com/documentation/metahuman/metahuman-materials-and-textures
- FMetaHumanFaceTextureSynthesizer API: https://dev.epicgames.com/documentation/unreal-engine/API/Plugins/MetaHumanCoreTechLib/FMetaHumanFaceTextureSynthesizer
- MetaHumanCharacterTextureSourceResolutions: https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/MetaHumanCharacterTextureSourceResolutions
- MetaHuman DNA / RigLogic: https://dev.epicgames.com/documentation/metahuman/metahuman-dna-rig-definition-and-rig-operation
- Poly Hammer Character DNA terminology: https://docs.polyhammer.com/character-dna/terminology
- Reallusion CC-to-MetaHuman comparison: https://forum.reallusion.com/Topic535222.aspx
- Convai MetaHuman hair and skin guidelines: https://docs.convai.com/api-docs/no-code-experiences/avatar-studio-experiences/customizing-your-avatar/configure-avatar/uploading-avatars/metahuman-avatars/metahuman-hair-and-skin-appearance-guidelines
- PC Gamer on MetaHuman skin shine: https://www.pcgamer.com/uk/epics-new-metahuman-tool-is-pure-uncanny-valley
- MetaHuman licence: https://www.metahuman.com/license , https://www.unrealengine.com/eula/mhc
- CG Channel, MetaHumans in other engines (2025): https://www.cgchannel.com/2025/06/you-can-now-sell-metahumans-or-use-them-in-unity-or-godot/
- Digital Production (2025): https://digitalproduction.com/2025/06/05/metahumans-graduate-ready-for-unity-godot-and-the-fab-cash-register/
- inZOI Create a Zoi (fan wiki): https://thegameswiki.com/inzoi/wiki/create-a-zoi
- Reallusion blush layers: https://manual.reallusion.com/Character_Creator/ENU/1/16_Makeup/Blush.htm
- Reallusion RGBA area mask: https://manual.reallusion.com/Character-Creator-4/Content/ENU/4.0/15_Digital_Human_Shader/Skin/Texture_RGBA_Area_Mask.htm
- Roblox makeup: https://create.roblox.com/docs/makeup
- DD Makeup Editor (DAZ): https://www.renderosity.com/marketplace/products/170840/quick-view
- Blender Artists, film-quality textures (gloss mask): https://blenderartists.org/t/creating-film-quality-textures/685129
- Reallusion forum, oily skin: https://forum.reallusion.com/Topic535738.aspx
- Glass skin: https://www.refinery29.com/2017/09/171750/glass-skin-korean-beauty-trend , https://www.dermstore.com/blog/what-is-glass-skin , https://www.theinkeylist.com/blogs/news/what-is-glass-skin , https://gulfnews.com/lifestyle/korean-beauty-secrets-for-glass-like-skin-1.1569587674658
- Igari: https://www.makeup.com/japanese-igari-blush-tutorial , https://hypebae.com/2025/11/igari-makeup-drunk-blush-beauty-trend-explainer , https://japanwithlovestore.com/en-hk/blogs/blogs/igari-makeup
- Korean makeup (aegyo-sal, puppy liner, gradient lips): https://www.maybelline.co.in/makeup-tips/featured/korean-makeup-looks , https://dailyvanity.sg/trends/aegyo-sal-makeup-korean , https://www.mochimag.com/lifestyle/beauty/korean-beauty-makeup-looks-how-to-aegyo-sal-gradient-lipstick/
- three.js MeshPhysicalMaterial: https://threejs.org/docs/pages/MeshPhysicalMaterial.html
