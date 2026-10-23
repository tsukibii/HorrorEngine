# Soft card hair in Unreal (and the salon's preview)

Research, 2026-10-24 (the experiments branch). The question: the salon bakes hair as low-poly cards (`salon.glb`: ribbons
with the strand atlas, `hairtex.js`); thin cards and their edges look harsh, spiky and aliased. What makes card hair
read soft in Unreal 5.8, short of Groom strands, and how does the preview match it?

Searched only: Epic's pages, Medium, SIGGRAPH and ArtStation refused direct fetches, so the claims below come from search
snippets of them; Unreal checkbox names marked *verify in 5.8* are from knowledge of the engine. Sources at the end.

## The answer, in order of gain for the work

1. **Shell normals (a bake change, the biggest win).** Light each card vertex with the normal of a smooth hull round the
   hair volume (the scalp grown outward by the card's depth, or a smoothed blob of the locks), blended about 80/20 with
   the card's own normal, instead of the card's flat face. The cards then shade as one soft volume: no bright and dark
   stripes card to card, no black undersides. It's foliage's "normals from a master surface" (Conan Exiles' hair guide,
   Polycount threads, BNPR's sphereized normals). The strand direction stays in the tangent, so the highlights still run
   along the hair. In Unreal: import normals and tangents, never recompute.
2. **Dithered coverage resolved by TSR, not a hard clip.** Masked, *Dither Opacity Mask* on (or `DitherTemporalAA` into
   the opacity mask, not both): Unreal calls it limited translucency with every lighting feature. Real translucency
   loses self-shadowing and sorts badly. Cost: noise on fast motion and with no temporal history (Movie Render Queue
   needs temporal samples). The skinned locks must write velocity, or the dither ghosts.
3. **Edge-on fade** (Epic's "edge mask" on Paragon and the Photorealistic Character): a card fades as it turns edge-on
   to the camera (camera vector against the card's own face normal, so the card normal rides in a vertex attribute
   beside the shell normal). This removes the thin lines and spikes cards make in profile; the darkened scalp covers
   what shows through.
4. **Root fade and Pixel Depth Offset.** Fade and darken the first 5 to 10% of each card; push pixels back by depth
   (PDO) so cards meet each other and the scalp softly, not along polygon lines (Hairdini's guide, Reallusion's packs,
   inZOI's docs).
5. **Alpha mips that keep coverage, and a sharpened alpha.** Ordinary mips dissolve alpha-tested hair with distance.
   Castaño's coverage-preserving mips (Unity `mipMapsPreserveCoverage`, DirectXTex `ScaleMipMapsAlphaForCoverage`) fix
   it at bake time, for Unreal and three.js alike; Golus's sharpen `a = (a - cut) / max(fwidth(a), 1e-4) + 0.5` for
   alpha-to-coverage.
6. **Baked occlusion and root-to-tip colour** in vertex colours: inner layers and roots darker. Hides "sheets floating
   on a bald head" more than any lighting change (Scheuermann, ATI 2004).
7. **Two-pass edges** (an opaque alpha-tested core, then a blended fringe with no depth write: ATI, Overgrowth,
   CryEngine): only for tip close-ups if dither noise remains after 1 to 6.
8. **Unreal's Hair shading model** (dual highlight, Scatter; Backlit is strands only): a gain over Default Lit only once
   normals and tangents are right; it can read too bright on cards under Lumen. Default Lit with Anisotropy is the
   cheap fallback.

**Groom cards or mesh cards:** Groom cards bring the `HairAttributes` node and Epic's card generator (a Dataflow graph in
5.8), but our glTF route and baked physics (a skinned mesh per swinging lock) favour **skinned mesh cards** carrying the
same data in UVs and vertex colours. **Forward renderer with MSAA** has alpha-to-coverage for masked materials, but costs
TSR, Lumen and the deferred hair path: not worth it.

## The material (M_HairCard, a skeletal mesh)

- Blend Masked, Two Sided, Shading Model Hair (fallback Default Lit), Dither Opacity Mask on *(verify in 5.8)*, clip 0.5,
  Output Velocity on, usage Skeletal Mesh.
- Inputs: `RootTip = TexCoord1.y` (0 root, 1 tip), `Depth = TexCoord1.x` (0 outside, 1 at the skin), `AO = VertexColor.r`,
  `CardN` (the card's face normal, TexCoord2/3), the atlas (R brightness, G strand, B clump, A coverage).
- Opacity mask: `DitherTemporalAA(Atlas.A * edge * root * Density)` with
  `edge = remap(pow(saturate(abs(dot(CameraVector, CardN_world))), 1.5), EdgeMin 0.15)`,
  `root = smoothstep(0, 0.06, RootTip)`, Density 1.0 to 1.3 (thicker without new geometry).
- Base colour: `lerp(Root, Tip, smoothstep(0, 0.3, RootTip)) * (0.45 + 0.55 Atlas.R) * lerp(0.6, 1.2, Atlas.B) * lerp(0.4, 1, AO)`
  (the same as `hairtex.js`'s albedo).
- Tangent (tangent space, V along the strand): `normalize((0,1,0) + (0,0,1) * ((Atlas.G - 0.5) * ShiftNoise + Shift))`:
  Scheuermann's per-strand shift, as `hairshader.js` does it.
- Hair inputs: Specular 0.4, Roughness 0.35 to 0.5 (higher is softer), Scatter 0.2 (dark) to 0.6 (light).
- Pixel Depth Offset: `Depth * 1-3 cm + (1 - RootTip)^4 * 1 cm` (the roots tucked into the scalp). AO from the vertex colour.
- Project: TSR; no screen percentage under ~60% on hair close-ups; 8+ temporal samples in Movie Render Queue.

**With the VHS look** (UnrealPlugins/UltraVHS): run it after TSR (post-tonemap), so its noise never enters TSR's history.
Its luma low-pass and chroma bleed hide the remaining dither and card edges well; but the deck's edge enhancement
(`UltraVHS.usf`, the halo near line 199) re-sharpens hair silhouettes: check close-ups, lower its gain if it does.

## What the salon's bake should write (the work, when it's picked up)

| glTF | what |
|---|---|
| `NORMAL` | the shell normal (hull at the nearest point, ~80/20 with the card normal) |
| `TANGENT` | along the strand, root to tip (vec4, w the handedness) |
| `TEXCOORD_1` | (depth, root-tip) |
| `TEXCOORD_2` | the card's own face normal (xy; z rebuilt) for the edge fade |
| `COLOR_0.r` | baked occlusion (layer depth plus a cheap hemisphere test against the other cards) |
| atlas | coverage-preserving mips at the clip value; a 1 to 2 texel alpha feather for the dither to work across |

The preview (`hairshader.js`) already has the shifted Kajiya-Kay highlights, dark roots, occlusion from depth and
alpha-to-coverage. It lacks the shell normal (lit by the card's own normal today: the main cause of the harsh look), the
edge-on fade, the root fade in alpha, and the coverage-preserving mips / sharpened alpha. three.js notes:
`alphaToCoverage` needs a renderer made with `antialias: true` (4x MSAA = 5 coverage levels, so sharpen first);
`alphaHash` (Wyman and McGuire's hashed alpha) plus `TAARenderPass` previews Unreal's dither-and-TSR look; both keep the
hair opaque, no sorting.

No maintained, freely licensed UE5 card-hair material turned up; the closest are "Hair with Anisotropy" (Unity/VRChat,
MIT: dither plus anisotropy) and AdamFrisby/UnityHairShader (blue-noise dither with alpha-to-coverage; licence not
visible). The recipe above needs none of them.

## Sources

[UE DitherOpacityMask](https://docs.unrealengine.com/4.26/en-US/API/Runtime/Engine/Materials/UMaterial/DitherOpacityMask/index.html) ·
[Photorealistic Character (edge mask)](https://docs.unrealengine.com/4.26/en-US/Resources/Showcases/PhotorealisticCharacter) ·
[Polycount edge mask](https://polycount.com/discussion/comment/2658815/) ·
[Groom materials](https://dev.epicgames.com/documentation/en-us/unreal-engine/groom-materials-in-unreal-engine) ·
[Cards and meshes for grooms](https://dev.epicgames.com/documentation/en-us/unreal-engine/setting-up-cards-and-meshes-for-grooms-in-unreal-engine) ·
[Hair Card Generator (Dataflow)](https://dev.epicgames.com/documentation/metahuman/hair-card-generator-in-dataflow-in-unreal-engine) ·
[Groom strands](https://dev.epicgames.com/documentation/unreal-engine/groom-strands-in-unreal-engine) ·
[Substrate Hair](https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/Engine/UMaterialExpressionSubstrateHair-?lang=en-US) ·
[UE-229370 hair tangent](https://issues.unrealengine.com/issue/UE-229370) ·
[Forward renderer](https://dev.epicgames.com/documentation/en-us/unreal-engine/forward-shading-renderer-in-unreal-engine) ·
[MSAA and A2C](https://forums.unrealengine.com/t/4-15-p2-msaa-and-alpha2coverage-problem/383502) ·
[Reallusion: TSR dependency](https://forum.reallusion.com/FindPost526296.aspx) ·
[Dither glitches](https://forums.unrealengine.com/questions/678352/bug-hair-alpha-dithering-glitches-in-417.html) ·
[DitherTemporalAA noise](https://answers.unrealengine.com/questions/476404/view.html?sort=votes) ·
[Hairdini shader guide](https://psynema.artstation.com/pages/hairdini-unreal-engine-shader-guide) ·
[inZOI hair materials](https://mod-docs.playinzoi.com/ModKit/project/CAZ/Hair/06.MaterialSettings.html) ·
[Scheuermann 2004](https://history.siggraph.org/wp-content/uploads/2022/12/2004-Talks-Scheuermann_Practical-Real-Time-Hair-Rendering-and-Shading.pdf) ·
[Overgrowth two-pass](https://www.moddb.com/news/smooth-plant-rendering-in-overgrowth) ·
[CryEngine hair](https://www.cryengine.com/docs/static/engines/cryengine-3/categories/1114113/pages/1048609) ·
[Conan Exiles proxy normals](https://conanexiles.com/wp-content/wiki/1441955986.html) ·
[Polycount: normals from the head](https://polycount.com/discussion/comment/2423175) ·
[Polycount: foliage normals](https://polycount.com/discussion/comment/2191223) ·
[BNPR Abnormal](https://bnpr.gitbook.io/bnpr/shaders/toon-shading-nbpr-abnormal-normal-sphering) ·
[Castaño: alpha mipmaps](https://ludicon.com/castano/blog/articles/computing-alpha-mipmaps/) ·
[Golus: alpha to coverage](https://bgolus.medium.com/anti-aliased-alpha-test-the-esoteric-alpha-to-coverage-8b177335ae4f) ·
[Hashed alpha testing](https://research.nvidia.com/labs/rtr/publication/wyman2017hashed/) ·
[three.js alpha hash](https://discourse.threejs.org/t/alpha-test-vs-alpha-hash/44493) ·
[Hair with Anisotropy (MIT)](https://booth.pm/en/items/2558858) ·
[UnityHairShader](https://github.com/AdamFrisby/UnityHairShader)
