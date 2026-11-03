# Faking photorealism for the streets (the Battlefront look, through a tape)

Asked on 2026-10-31 (DECISIONS): "how we could fake photo-realism (think of the new Star Wars Battlefront games look);
we will be using a VHS effect so it doesn't need to be hyper detailed, but fake the textures and materials and even
fake PBR bumps (procedural is fine) and add a photo realism effect... material wise it should almost trick you you're
looking at something real, without hard shaders and lighting (it can be baked in, like Battlefront)". The test is the
Shibuya lane against its photo. The sources are listed at the end. Only GitHub could be reached directly from the
cloud machine, so the claims about other sites come from search extracts of the pages cited. Godot's facts were read
from its own docs and source.

## 1. What made Battlefront look real

- **Scanned surfaces.** DICE photographed the film locations and Lucasfilm's props (about 100,000 photos for four
  planets) and rebuilt them by photogrammetry. Each batch was calibrated to a colour chart and **de-lit**: the light
  of the day it was shot was taken out, so only the surface's own colour was left. Each asset's scanned base was
  blurred to its broad shapes. A small tiling **detail layer** (normal, reflectance, colour) went over it, from a
  texture set per planet.
- **One physical model.** Frostbite's PBR (Lagarde and de Rousiers, 2014): one standard material for about 80% of
  surfaces, lights in **physical units** (sky 20,000 lux, sun 100,000), and a **physical camera** checked against the
  sunny-16 rule. Nothing was brightened by eye.
- **Baked bounce, live sun.** Battlefront II baked lightmaps with Frostbite's own path tracer. They hold **only the
  indirect light**: the sky and the bounce. The sun and lamps stay real-time. The sky model was credited with much of
  the look.
- **A camera's flaws.** Lens flare, chromatic aberration, film grain, vignette, motion blur and lens distortion, with
  TAA. Colour grading in HDR before tonemapping.

**So the realism isn't detail.** It's right values (each surface's colour and roughness as a real one measures), right
light (the sky's soft fill and the occlusion where things meet), and right flaws (a lens, a grade).

## 2. What survives the tape

VHS keeps about 240 lines of brightness and about 40 lines of colour. Across a 640-pixel frame, brightness detail under
about 3 pixels and colour detail under about 15 pixels are gone.
- **What still reads:** exposure, the balance of sky and shade, occlusion and bounce gradients, silhouettes,
  highlights and bloom, repetition at large scales, motion.
- **What doesn't:** micro normals, roughness noise, fine print, distant aggregate.

So the effort goes into values and light first, and into variation at the scale of a metre or more, not millimetres.

## 3. Our ingredients, ranked by realism per effort

1. **Bake the sky and its bounce (the biggest gain).** An overcast lane is mostly skylight and its occlusion. In
   Godot that bake is the user's, by hand (DECISIONS 2026-10-31, late morning), with LightmapGI (Battlefront II's
   split: a live sun, the sky and the bounce baked) or VoxelGI (the light live, the street baked into voxels). What
   each needs from the street is in STREET_TEXTURING §3: LightmapGI's own UV2 unwrap would take the wear atlas's place,
   and VoxelGI reads the street shader as white.
2. **Calibrate every material's colour** (low effort). Albedo as measured: fresh asphalt 0.02 to 0.05 (linear), worn
   asphalt 0.08, fresh concrete 0.5, brick about (0.26, 0.10, 0.06), glazed tile 0.75, rust about (0.18, 0.06,
   0.02). Dielectrics stay between about 0.013 and 0.87 linear (sRGB 30 to 240). Paint is not a metal.
3. **Calibrate exposure** (low effort). A grey card (18%) in the lane reads mid-grey under AgX. An overcast midday is
   1,000 to 2,000 lux; the sun kept soft.
4. **Variation at the metre scale and no visible tiling** (medium effort). Low-frequency noise over each wall (tone,
   roughness, dirt). Hex-tiling or stochastic tiling in the street shader, so a 3 m set doesn't repeat on a 30 m wall.
   The street's own wear atlas already gives every surface unique dirt, streaks and worn edges.
5. **Decals** (medium effort): rain streaks, leaks, damp, rust bleed, cracks, posters, oil, puddles, manholes. Made
   procedurally here (no download needed); CC0 sets on ambientCG can join them later from the user's machine.
6. **Spend little on micro detail.** 1K sets at real scale are enough at 240 lines. No parallax.
7. **A camcorder's post, in a camcorder's order:** lens chromatic aberration and vignette before the tape, the tape's
   own noise in place of film grain, and no sharpening, since the tape adds its own edge rise.

## 4. What we build for it (this round)

- **A material library** (`tools/streetbake/library.py`): about fifty Japanese exterior finishes after the
  reference photos:
  - walls: sprayed mortar, stucco, plaster, ALC panels;
  - 45 × 95 and 227 × 60 facade tiles, the 1970s mosaic;
  - ceramic siding (brick, stone, boards), weathered planks, charred cedar;
  - exposed concrete with its P-cones, precast panels, block walls, granite;
  - galvanised and painted corrugated sheet, spandrel, shutters, painted and rusted steel, anodised sashes;
  - kawara (ibushi and glazed), Colorbest slate, galvalume, a flat roof's coating;
  - asphalt new and old, the green and red lanes, pavers, interlocking blocks, tactile paving, kerbs, gravel, earth;
  - glass.

  Each is procedural (its height faked into a normal map: joints, grains, ribs, waves), with colours kept to measured
  ones, and baked onto the PBR shelf as a full-colour tileable set at its real size.
- **Decals made from code** (`tools/streetbake/decals.py`): twenty of them, each at its real size and with its own
  shine (a puddle wet, a manhole's iron).
- **The paint page** (`tools/director/paint.html`, after the prop generator's page): the street in 3D, the library
  and the decals as pictures. Click a surface to paint it (this building's wall, or every wall on the street), zoom
  in and lay decals. Then bake it in Blender from the page, with its log and its pictures.
- **The Shibuya lane painted from its photo**, rendered in Blender against it.

## Sources

- Brown and Hamilton, *Photogrammetry and Star Wars Battlefront*, GDC 2016:
  https://media.gdcvault.com/gdc2016/Presentations/Brown_Kenneth_Hamilton_Andrew_PhotogrammetryStarWars.pdf
- Lagarde and de Rousiers, *Moving Frostbite to PBR*, SIGGRAPH 2014:
  https://blog.selfshadow.com/publications/s2014-shading-course/frostbite/s2014_pbs_frostbite_slides.pdf
- *Precomputed Global Illumination in Frostbite*, GDC 2018 (Battlefront II's indirect-only lightmaps):
  https://media.contentapi.ea.com/content/dam/eacom/frostbite/files/gdc2018-precomputedgiobalilluminationinfrostbite.pdf
- Hillaire, *Physically Based Sky, Atmosphere and Cloud Rendering in Frostbite*, 2016:
  https://media.contentapi.ea.com/content/dam/eacom/frostbite/files/s2016_pbs_frostbite_sky_clouds.pdf
- Fry, *High Dynamic Range Color Grading and Display in Frostbite*, GDC 2017:
  https://www.slideshare.net/DICEStudio/high-dynamic-range-color-grading-and-display-in-frostbite
- Measured albedo: Epic's physically based materials table,
  https://dev.epicgames.com/documentation/en-us/unreal-engine/physically-based-materials-in-unreal-engine, and the
  Physically Based database (CC0), https://github.com/AntonPalmqvist/physically-based-api
- Anti-tiling: Mikkelsen, *Practical Real-Time Hex-Tiling*, JCGT 2022, https://jcgt.org/published/0011/03/05/paper.pdf;
  Quilez, https://iquilezles.org/articles/texturerepetition
- Godot: LightmapGI, https://docs.godotengine.org/en/latest/tutorials/3d/global_illumination/using_lightmap_gi.html;
  the comparison of its GI, https://docs.godotengine.org/en/latest/tutorials/3d/global_illumination/introduction_to_global_illumination.html;
  the spatial shader's `IRRADIANCE` and `CUSTOM0`,
  https://docs.godotengine.org/en/latest/tutorials/shaders/shader_reference/spatial_shader.html
- VHS resolution: https://www.videouniversity.com/?p=909
- Japanese finishes: ceramic siding on 70 to 78% of houses (https://www.livable.co.jp/l-note/?p=7104); ALC panels
  (https://www.kenzai-navi.com/uploads/makers/clion/catalogs/clion_260130_C.pdf); tactile paving to JIS T 9251
  (https://www.city.kobe.lg.jp/documents/13647/06_01_03.pdf); 45二丁 tiles (https://wiki.proz.com/kudoz/1160801);
  kawara 53A (https://eishiro.co.jp/english/products/wakei/index.html); coloured paving (https://car-me.jp/articles/8434);
  efflorescence and rain streaks (https://www.city.kyoto.lg.jp/tokei/cmsfiles/contents/0000123/123679/2gaihekitairu_taisaku2803.pdf,
  https://www.cit.nihon-u.ac.jp/laboratorydata/kenkyu/kouennkai/reference/No.46/pdf/4-50.pdf).
