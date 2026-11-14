# Clothing fabric that reads as cloth: the research behind the fabric sets

The user (2026-11-14): "start of by researching the latest techinques for creating hyper realistic clothing fabric pbrs
(or even other types that you can implement the techniques for), then create new beautiful clothing fabric pbrs that
work well with being tinted (maybe base pbrs should all be white or cream so tints apply well), then demo some of the
clothing in the new pbrs system. I want thinks like knitted wool, wool, cotton, spin cotton, leather, spandex, sheer
hosier, fluffy cotton (for socks), matte leather (for shoes)".

What was built from this note: `tools/fabricpbr.py` (the sets, `pbr/fabric/`), the Studio's garment shader for them
(`tools/character/tailor/look.js`) and Godot's (`HSCloth`, the look plugin's `cloth.gdshaderinc`). docs/TAILOR.md §1k
and docs/GODOT_LOOK.md §5x say how they work; this note says why.

**How it was gathered.** Two research passes, about 170 searches and page reads between them. The shading half read its
primary sources directly where they are on GitHub (Filament, the glTF extensions, three.js, Godot 4.6, 4.7 and master,
Unity's HDRP, MaterialX, OpenPBR, Disney's BRDF explorer, Mitsuba, the Khronos sample assets). **The papers themselves
could not be fetched** from this session (arxiv.org and the publishers' hosts were out of reach), so what a paper does is
from its abstract or from an implementation of it, and is marked so. **The textile half had only search extracts**: no
page could be opened, so every number in §4 is the search engine's extract of the page linked and wants checking before
it is leaned on. "(ours)" marks a choice made here; "(derived)" a number worked out from cited ones.

## 1. Why a normal PBR material doesn't look like cloth

A cloth is fibres, twisted into yarns, woven or knitted with air between them. Three things follow that the standard
material (a rough dielectric with one GGX highlight over a Lambert diffuse) gets wrong:

- **The highlight is in the wrong place.** Fibres that stand off the surface catch light at grazing angles, so cloth is
  brightest toward its outline, not where a mirror would reflect the lamp. Every engine's cloth model replaces or adds
  a lobe for this: the "sheen" or "fuzz" lobe (§2).
- **The terminator is too hard.** Light gets through and between fibres, so the shaded side of a fold doesn't go black
  where the surface turns away: Filament's cloth model wraps its diffuse term for this (§2.2).
- **Colour is not albedo times a constant.** Down between the yarns light meets the dyed fibre several times before
  it leaves, so hollows are deeper and more saturated than crowns, and a dark dye reads glossier than a pale one
  because the fibre's own reflectance (about 4%) stays while its diffuse colour falls (§5).

And one that is about the textures, not the shader: **at a character's distance a thread is far below a pixel.** A
1080p view at a metre is about 1.9 mm a pixel; a shirting's yarn is 0.14 mm. What a player sees of a fine weave is its
average: its colour, how rough it is once the threads' normals are averaged (§6), its fuzz. The thread-resolved normal
map only shows in a close-up. Coarse structures (a hand knit's 5 mm stitches, a rib, leather's grain) do show.

## 2. The shading models

### 2.1 The fuzz lobe: Charlie (Estevez and Kulla 2017)

"Production Friendly Microfacet Sheen BRDF". A microfacet distribution that is the reverse of the usual ones: zero where
the half vector lies along the normal, largest where it lies in the surface.

    D = (2 + 1/a) * sin(theta_h)^(1/a) / (2 pi)          a = sheenRoughness^2
    V = 1 / (4 (NoL + NoV - NoL NoV))                    Neubelt's visibility ("Ashikhmin")
    f = sheenColor * D * V                               no Fresnel

Filament, three.js and Unity's HDRP all use this D with Neubelt's V; Filament and Unity both say Charlie's own
visibility term costs too much ([glTF KHR_materials_sheen](https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_sheen),
[Filament's BRDFs](https://github.com/google/filament/blob/main/shaders/src/surface_brdf.fs),
[HDRP Fabric](https://github.com/Unity-Technologies/Graphics/blob/master/Packages/com.unity.render-pipelines.high-definition/Runtime/Material/Fabric/Fabric.hlsl)).
The base under it is scaled down by what the lobe reflects; three.js r160 uses `1 - 0.157 * max(sheenColor)`, later
versions and glTF a fitted directional albedo E(NoV).

**What it cannot do, found by measuring ours:** with the light straight behind the cloth the half vector lies along the
normal at the lit outline, so D is zero there. Charlie lights a knit's edge for a light beside or in front of it, never
for one behind it, which is exactly when real knitwear glows along its outline. (§7: a small halo term, ours.)

### 2.2 Filament's cloth model

Specular is `D_Charlie * V_Neubelt * sheenColor`; diffuse is Lambert, and with a "subsurface colour":

    diffuse *= saturate((NoL + 0.5) / 2.25)              an energy conserving wrap, w = 0.5
    Fd = diffuse * diffuseColor * saturate(subsurfaceColor + NoL)

Its guidance: velvet is a dark base with the colour in the sheen; cotton and denim keep the colour in the base with the
sheen at the base's luminance; **leather, silk and satin belong on the standard or the anisotropic model, not the cloth
one**; `sheenColor` defaults to `sqrt(baseColor)`
([Filament.md](https://github.com/google/filament/blob/main/docs/Filament.md.html),
[the cloth shading model](https://github.com/google/filament/blob/main/shaders/src/surface_shading_model_cloth.fs)).

### 2.3 The others

- **Zeltner, Burley, Chiang 2022**, "Practical Multiple-Scattering Sheen Using Linearly Transformed Cosines" (abstract
  and code only): a lobe fitted to a volume of fibre-like flakes with multiple scattering; "dusty" at high roughness.
  OpenPBR's fuzz (`fuzz_weight`, `fuzz_color`, `fuzz_roughness` 0.5) is this. MaterialX has a fit of it with no lookup
  table ([mx_microfacet_sheen.glsl](https://github.com/AcademySoftwareFoundation/MaterialX/blob/main/libraries/pbrlib/genglsl/lib/mx_microfacet_sheen.glsl),
  Apache-2.0): the one to port if Charlie's look ever falls short.
- **Unreal's Cloth model** (forum excerpts; the source is behind a login): the specular is a blend from GGX to an
  inverted GGX with a Fuzz Color, by a Cloth mask. **Unity HDRP Fabric**: Charlie for cotton and wool, anisotropic GGX
  for silk, and a **thread map** on its own tiling (occlusion, normal, smoothness) plus a one-channel **fuzz map**:
  the same split of "the garment's own maps" and "the fabric's tile" that we use.
- **Disney 2012**: `sheen * (1 - LoH)^5`, tinted toward the base colour; added to diffuse. The oldest and cheapest.

### 2.4 Where the engines we use stand

- **three.js r160** (the Studio): `MeshPhysicalMaterial` has `sheen`, `sheenColor`, `sheenRoughness` and their maps
  (Charlie and Neubelt, as above), and `anisotropy`. Its sheen under ambient light comes only from an environment map.
- **Godot 4.7** (the games): **no sheen**. `material.cpp` has no such word at 4.6, 4.7 or master; the proposal (#1934,
  2020) and a pull request (#111568, October 2025, Filament's model, Forward+ only) are both open. Its glTF importer
  reads neither `KHR_materials_sheen` nor `KHR_materials_anisotropy`
  ([gltf_document.cpp at 4.7](https://github.com/godotengine/godot/blob/4.7-stable/modules/gltf/gltf_document.cpp)).
  A spatial shader's `light()` function replaces the whole direct BRDF, and never runs for ambient light, which
  `fragment()` cannot read either
  ([scene_forward_lights_inc.glsl](https://github.com/godotengine/godot/blob/4.7-stable/servers/rendering/renderer_rd/shaders/scene_forward_lights_inc.glsl)).
  So a cloth in Godot is a shader of our own (§7).

### 2.5 The yarn-level papers, for what a texture generator can borrow

Abstracts and implementations only.

- **Irawan and Marschner 2012** (woven cloth): highlights off fibres on bent, twisted yarn segments; Mitsuba's version
  has per-yarn twist and curvature. *Borrowed:* a filament yarn (no twist) streaks along itself, a spun one across; a
  yarn's fibres run at its twist angle.
- **Sadeghi et al. 2013**: threads as micro-cylinders with shadowing between them; explains two-tone "shot" cloth.
  *Borrowed:* warp and weft are told apart (our `_Tint` map: a denim's weft stays white).
- **Montazeri et al. 2020 (woven), 2021 (knitted)**: the ply, not the fibre, as the unit. *Borrowed:* **each ply drawn
  as its own tube wound round the yarn**: the diagonal ridges on a knit's legs are what make it read as wool.
- **Zhu et al. 2023**, "A Realistic Surface-based Cloth Rendering Model" (and Wang et al.'s SpongeCake under it):
  ply-level shading with transmission through yarns and straight through the gaps. *Borrowed:* a **cover map** for
  sheer cloth, its opacity rising with the viewing angle (§6).
- **Since**: a multi-scale version with sheen (Zhu et al. 2024), a neural woven model at about 60 fps on a 3090 (Chen
  et al. 2024), and texture-free models driven by the weave's draft alone with parallax and shadowing (Khattar et al.
  2025 for woven, 2026 for knit): the nearest in spirit to building the height from the draft, as we do.

## 3. How fabric textures are authored

From Substance Designer write-ups (search extracts): a fabric graph is **structure first, then irregularity, then
fibres**. Qu Bin's knit: the main thread (a shape, skewed and mirrored), fluff (a scratches generator), pills, then a
low wave over all of it; roughness as a mask over white; colour patches from a cell noise. Others: warp the threads
with a low noise, twist has to be built by hand (the fibre node has none), fuzz carried in the normal map or
multiplied faintly into the colour. **Height to normal in world units**: give the tile's real size and the relief's real
depth instead of an arbitrary strength. Roughness from the height: crowns catch the highlight, hollows don't.

Nobody gave layer amplitudes. Derived from §4's sizes: the weave or knit 1; a ply's twist 0.15 to 0.25 of the yarn's
diameter; a fibre's striation 0.03 to 0.08; a slow warp of 2 to 5% of the period; fuzz as a thin layer of its own.

**The knit loop.** Keenan Crane's note on plain-knit yarn curves (2023) gives the centre line as
`(t + a sin 2t, h cos t, d cos 2t)`, one stitch a turn of t, with a = 3/2, h = 4, d = 1 and a tube of radius 4/5 for a
snug fit, in units where a stitch is 2 pi wide
([YarnCurve.pdf](https://www.cs.cmu.edu/~kmcrane/Projects/Other/YarnCurve.pdf)). In stitches (derived): the lean 0.24
of a wale, the loop 1.65 courses tall, the yarn's radius 0.127 of a wale, the legs 1.25 radii in front of the heads.
That radius matches a measured jersey (0.62 mm wales of 0.166 mm yarn: 1/3.7). Our knits start from these.

## 4. Real sizes (search extracts; check before leaning on one)

Yarn diameter: spun cotton `0.907 / sqrt(Ne)` mm (Peirce); a filament `11.9 * sqrt(denier / density)` micrometres
(nylon 1.14: 15 denier is 43 micrometres). A woven yarn is flattened to 0.64 to 0.75 of round.

| Cloth | Structure | A cm | Yarn mm | Fuzz mm |
|---|---|---|---|---|
| Cotton poplin | plain, 40s yarn, 132 x 72 an inch | 52 ends, 28 picks | 0.14 | 0.2 to 0.5, sparse |
| Jersey, 28 gauge | ring-spun 30s, loop 2.6 mm | 16 wales, 21 courses | 0.17 | 0.3 to 1 |
| Hand knit, worsted | 16 to 20 stitches to 10 cm, rows 1.3 times | 1.8 stitches, 2.4 rows | 2.3 to 2.8 | wool 1 to 3 |
| Worsted 2/2 twill | two-ply | 22 to 29 ends, 15 to 20 picks | 0.23 | under 0.3 |
| Wool flannel | milled and brushed (counts not found) | as suiting | 0.3 to 0.5 | nap 0.5 to 2 |
| Sock terry | loops 3 to 4 mm (2 to 5) | not found | 0.2 | the loops |
| Nylon and elastane warp knit | 32 gauge, 33 to 83 dtex | 12.6 wales or more, 20 to 25 courses | 0.07 | none |
| Sheer hosiery | 400 needles on 4 inches; 15 denier | 12.5 wales as knit, 27 courses | 0.016 to 0.043 a filament | none |
| Cattle hide | 650 to 2500 follicles a square cm | pores 0.2 to 0.4 mm apart | relief 0.02 to 0.05 | none |
| Embossed leather | pebbled 0.2 to 0.4 mm deep | cells 1 to 3 mm (unverified) | | |
| Nubuck, suede | buffed | | | nap 0.3 to 1.5 |

Ply twist is about 25 degrees for a knitting yarn: a four-ply turns once in about four diameters (derived). Spun
cotton's hairiness (Uster H) is about 5 to 6: that many millimetres of hair stand off a millimetre of yarn.

**Sheer hosiery by the leg** (derived): cover is about the yarn's length a stitch times its width, over the stitch's
area. 400 wales round a 22 cm ankle are 0.55 mm apart, round a 55 cm thigh 1.4 mm: the thigh has about 0.4 of the
ankle's cover. No table of cover by denier was found.

**Values.** Reflectance of a fibre: 4 to 5.6% (Filament's fabric range; cotton, wool and nylon all near 1.53 to 1.58).
Bleached cotton is about linear 0.80 to 0.85 (sRGB 231 to 237) and nothing in an albedo should pass sRGB 240. Roughness:
cotton, canvas, denim 0.8 to 0.9; glossy leather 0.2 to 0.4, worn 0.5 to 0.7 (Roblox's material reference). **No
source gives a sheen strength for cotton, wool or nylon**: the Khronos sample assets have only velvet (a dark base, the
colour in the sheen, roughness 0.3 to 1) and a leather sofa (a weak sheen at 0.4, specular lowered to 0.3). Ours were
set by eye on the swatch sheet.

## 5. Fabric that tints well

What the sources say (search extracts): CLO and Marvelous Designer **desaturate** the base map and multiply the colour
over it; Roblox says to author the colour map near white for the strongest tint; MetaHuman clothing tints per instance
through region masks. And why a plain multiply is not what a dyed cloth does: dry fibres scatter a little of every
wavelength at each surface between fibre and air (wet cloth, with fewer such surfaces, is darker and more saturated);
a twill dyes deeper than a plain weave at the same dye; multiple scattering dominates a colourful cloth's look.

The rules built from that (ours):

- **The map is the undyed cloth**, pale and nearly neutral (sRGB 217 to 234, never above 240), with **no shading baked
  in**: only what is the cloth's own (each yarn's tone, a little dust and depth between yarns, hairs a shade lighter).
- **The dye is laid over the map divided by its mean**, so the colour picked is the colour the garment is from afar,
  whatever the set. (A plain multiply by a 0.8 map would wear every colour a fifth darker.)
- **Deeper down between the yarns**: `colour = dye ^ (1 + cavity * hollow)`. n bounces off a dyed fibre give dye^n;
  the hollow is read off the map itself (where it is darker than its mean), so it costs nothing.
- **A dye that takes only in part is a power, not a blend**: `undyed * (dye / undyed) ^ (mask / mean mask)`. A linear
  blend of white and navy at 75% is a pale grey-blue; a dye's depth goes by its amount in the exponent. Dividing by the
  mask's mean keeps the picked colour as the cloth's from afar. (Found by getting it wrong: the first denim was grey.)
- **The fuzz carries the dye**: its colour is the dye's square root (Filament's default: lighter, less saturated), not
  white. White fuzz turned black socks grey.
- **The occlusion is given back between pale yarns**: Jimenez's multi-bounce fit,
  `max(ao, ((ao a + b) ao + c) ao)` with a, b, c linear in the albedo. A white knit's hollows aren't grey.

## 6. Sheer cloth, leather, and what's finer than a pixel

- **Sheer.** A thin sheet's opacity seen at a slant: `1 - (1 - a)^(1 / NoV)`: more yarn in the way. inZOI composites
  stockings inside the skin's own material (their modding documentation), which avoids sorting; Godot's alpha hash has
  no temporal term, so under TAA it stays noise. We blend (§7).
- **Leather.** On the standard model: the grain as a normal, pores as hollows with a higher roughness, a soft polish
  on the plates, no fuzz (a weak one for a matte or buffed finish).
- **Below a pixel.** When a normal map is averaged down its normals shorten; what's lost is roughness. Toksvig's rule
  gives it back (`variance = (1 - len) / len`): we do it once, where each set is brought from twice its size down.
  Godot's roughness limiter does the same on the screen from the normal's derivatives. Detail normals are combined with
  a garment's own by building the detail's frame on the screen from the fabric's coordinates, so a garment's layout
  can lie any way round.

## 7. What we do (ours), and what we left

**The sets** (`tools/fabricpbr.py`): a height first, at real size, at twice the size and brought down. Weaves from
their draft (each yarn a flattened tube with its own width, wander and slubs; crimp by which is over which; twist as
ridges). Knits from the loop's centre line (§3), every ply a tube wound round it, the highest kept; ribs by purling
wales. Hides as cells inside cells with creases that come and go. Stray fibres as curled hairs. Then every map from
that height and what is known about each point of it.

**Three maps beyond the usual five**: `_Sheen` (how hairy each point is), `_Opacity` (a sheer knit's yarn against its
holes), `_Tint` (where a dye takes). And a `fabric` block of numbers in each set's meta.json for the shaders.

**Two shaders that agree**: the Studio's (three.js, its own sheen with two of its lights' lines changed) and Godot's
(a spatial shader with its own `light()`): the dye rules of §5, Charlie's lobe taken off the cloth's own surface and
not each yarn's, a wrapped diffuse, the sky's light on the fuzz (in Godot folded into ALBEDO, the only thing ambient
light is multiplied by, and taken out again for the direct light), a slow unevenness over many repeats (the same map
read seven times larger, turned), a sheer knit's cover brought to the garment's denier.

**The halo** (ours, §2.1): `sheenColor * halo * (1 - NoV)^3 * (-V.L)^2 / pi`: a light behind the cloth caught in its
hairs along its outline. Not from a paper: Charlie is measurably dark there and knitwear visibly isn't.

**Left for later:**

- **Anisotropy.** Satin, and a filament knit's highlight drawn out along its wales, want it. three.js and Godot both
  have it; no set here needs it yet (the spandex reads right by its roughness alone), and a thread-direction map is the
  next map to add when a satin is made.
- **Zeltner's lobe** in place of Charlie's, if the fuzz ever needs its backward scattering.
- **Parallax and yarn shadowing** from the height (Khattar's direction): the chunky knit would gain most.
- **Light through thin cloth** (a shirt against a window): Godot has a backlight term; nothing writes it.
- **A sheer knit inside the skin's shader**, as inZOI does: no blending, no sorting.
- **Stretch**: a tight's cover falling over the knee and thigh (§4) from how far the garment is stretched there.
- **Velvet, satin, suede, corduroy, lace**: the generator has the parts (a pile is hairs and a fuzz lobe; a satin is a
  draft); only the user's list was made.

## Sources

Shading (read directly unless said): [glTF KHR_materials_sheen](https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_sheen),
[KHR_materials_anisotropy](https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_anisotropy),
[Filament.md](https://github.com/google/filament/blob/main/docs/Filament.md.html),
[three.js physical lights](https://github.com/mrdoob/three.js/blob/dev/src/renderers/shaders/ShaderChunk/lights_physical_pars_fragment.glsl.js),
[MaterialX sheen](https://github.com/AcademySoftwareFoundation/MaterialX/blob/main/libraries/pbrlib/genglsl/lib/mx_microfacet_sheen.glsl),
[ltc-sheen](https://github.com/tizian/ltc-sheen), [OpenPBR](https://github.com/AcademySoftwareFoundation/OpenPBR),
[Disney's BRDF](https://github.com/wdas/brdf/blob/main/src/brdfs/disney.brdf),
[HDRP Fabric](https://github.com/Unity-Technologies/Graphics/blob/master/Packages/com.unity.render-pipelines.high-definition/Runtime/Material/Fabric/Fabric.hlsl),
[Godot's sheen pull request](https://github.com/godotengine/godot/pull/111568) (summary only),
[Unreal's cloth BRDF, a forum thread](https://forums.unrealengine.com/t/cloth-brdf-what-does-it-do/114599) (excerpts),
[Mitsuba's Irawan BSDF](https://github.com/mitsuba-renderer/mitsuba/blob/master/src/bsdfs/irawan.h) (GPL: ideas only),
[Jimenez et al. 2016, multi-bounce occlusion](https://www.activision.com/cdn/research/Practical_Real_Time_Strategies_for_Accurate_Indirect_Occlusion_NEW%20VERSION_COLOR.pdf) (the fit as Filament and Unity carry it),
[Zhu et al. 2023](https://sites.cs.ucsb.edu/~lingqi/publications/paper_sig23cloth.pdf) (abstract).

Textiles and authoring (search extracts): [yarn diameter from count](https://www.textilecalculations.com/relation-between-yarn-dia-and-yarn-count/),
[a 40s 132 x 72 poplin](https://fabriclore.com/products/40s-132-x-72-cotton-poplin-bio-mill-dyed-finish-57-l-ctpl-019),
[yarn cross-sections in a plain weave](https://www.researchgate.net/publication/286983908_Geometrical_parameters_of_yarn_cross-section_in_plain_woven_fabric),
[knitted fabric geometry, NPTEL](https://archive.nptel.ac.in/content/storage2/courses/116102008/download/m5faq.pdf),
[yarn weights](https://sarahmaker.com/yarn-weights-guide/) (the Craft Yarn Council's table at second hand),
[ply twist](https://spinoffmagazine.com/finding-balance/),
[a worsted twill measured](https://journals.sagepub.com/doi/full/10.1177/1558925019845978),
[terry towels](https://hutex.co.kr/wp-content/uploads/2023/06/Terry_Towel.pdf),
[a nylon and elastane warp knit, a patent](https://patents.google.com/patent/EP2804972B1/en),
[fibre measures](https://www.minifibers.com/fiber-measurement-conversions),
[hosiery, a patent](https://patents.google.com/patent/US6539752),
[follicle counts in hides](https://edepot.wur.nl/297368),
[embossed leather depths](https://topsunsiliconeleather.com/news/embossed-leather-pattern-engineering-guide/),
[nubuck and suede](https://hoplokleather.com/nubuck-vs-suede-leather-guide/),
[Roblox's material reference](https://create.roblox.com/docs/art/modeling/material-reference),
[Unity on dark dielectrics](https://docs-alpha.unity3d.com/cn/2018.1/uploads/ExpertGuides/Dark_Dielectric_Materials.pdf),
[CLO's Desaturation](https://support.clo3d.com/hc/en-us/articles/115012226407-Desaturation),
[why water darkens a shirt](https://www.wtamu.edu/~cbaird/sq/2013/11/06/why-does-water-make-a-shirt-darker/),
[Qu Bin's fabrics in Substance Designer](https://www.adobe.com/learn/substance-3d-designer/web/qu-bin-weaves-fabrics-with-substance-designer),
[Height to Normal World Units](https://helpx.adobe.com/substance-3d-designer/substance-compositing-graphs/nodes-reference-for-substance-compositing-graphs/node-library/filters/normal-map/height-to-normal-world-units.html),
[Keenan Crane's yarn curve](https://www.cs.cmu.edu/~kmcrane/Projects/Other/YarnCurve.pdf),
[inZOI's stockings](https://mod-docs.playinzoi.com/docs/modkit-docs/modkit/project/caz/stocking/01-overview).
