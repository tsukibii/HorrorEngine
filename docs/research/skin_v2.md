# Skin v2: skin as real as the user's references (research note, 2026-10-28)

The ask (DECISIONS 2026-10-28, later): "research aesthetic realistic skin (basically procedural skin v2 but more real
like MetaHuman skin and the screenshots provided)". Three stills came with it: a young East Asian woman's face under
a soft key light on a dark background; her lips in close-up; her eye and nose in close-up.

What's here: the stills measured (§1), what makes them read as real (§2), our skin against that (§3), the plan in
eight steps with the number each must hit (§4), Unreal (§5), what's left to the user (§6). The research behind it, with
its numbers, algorithms and some eighty links (each number marked as read in code, from memory or an estimate), is
`skin_v2_sources.md`; the scripts are in `skin_v2/` (`measure.py` the stills, `lut.py` the skin profile's
pre-integrated lighting and thin-skin transmittance, `calc.py` the colours and lobes). It builds on `skin.md` (v1: the
layer stack, glass skin, ageing, makeup) and doesn't repeat it. Research, as asked; only step 1's light is built, as an
option in the Character Studio's light picker (§4).

## 1. The references, measured

The stills aren't in git (faces stay out of it); `python docs/research/skin_v2/measure.py <folder>` measures them again.
Colours are CIE L\*a\*b\* (D65) of the pixels as given, so they include the lighting and the grade. The close-up's
scale is 34.9 px a millimetre, from its near iris (102 px across at quarter scale; an iris is 11.7 mm).

| Where | L\* | a\* | b\* | |
|---|---|---|---|---|
| Lit cheek (the face, both sides) | 57-63 | 2-6 | 7-8 | ITA 46-58°: very light |
| Lit cheek (the close-up, less exposed) | 44 | 3 | 8 | |
| Nose tip | 51-56 | 8-10 | 8-11 | two to three times the cheek's red |
| Nose wing, its edge | 47 | 10 | 11 | |
| Inside the nostril | 11 | 14 | 8 | deep red in the dark: light through tissue |
| Lower lip (close-up) | 47-51 | 17-18 | 7 | pink: its hue about 22°, the skin's about 65° |
| Upper lip (close-up) | 39-42 | 11-12 | 8-9 | |
| Skin beside the lips (close-up) | 58-59 | 3 | 9-10 | |
| Background | 10 | -2 | -1 | a cool blue-grey, nearly black |

- **Very low chroma.** The lit cheek's chroma is about 6 to 9 (a\* 2-6, b\* 7-8), where natural light East Asian
  skin is nearer 18 (typical published ranges, a\* about 10, b\* about 16: `skin_v2_sources.md` §6, an estimate). Either very pale, even skin or a desaturated grade; the
  cool blue-grey background says a grade is part of it. The "aesthetic" is as much the picture's grade as the skin.
- **The red is where the blood is.** The nose tip and wings are two to three times redder than the cheek, the lips
  three to six times, and the nostril's inside, nearly black, is still red (a\* 14): light coming through.
- **The sparkle is the pore field.** Bright specks (a pixel 2.2 spreads over its 1.2 mm surround and the brightest
  among its neighbours): about 310 a cm² on the lit cheek (one every 0.57 mm), 400 on the forehead (0.50 mm), 355 under
  the eye, 120 on the nose bridge. That matches the follicle openings' density (200-300 a cm², 0.6-0.7 mm: the
  sources §4): the sparkle is the skin's micro-relief catching the key, not glitter. Each speck is faint, 1.1 to 1.6
  times its surround on the cheek and forehead, 2.2 under the eye (wetter).
- **Lips.** Lines about 1.0 mm apart across the lower lip's middle; its brightest 1% at 4.1 times its median, the
  peak 5.2 times: wet, sharp highlights broken by the lines (against 1.1-1.6 for the cheek's sparkle).
- **The light.** Lit to shadow about 8:1 (three stops) across the nose and down the jaw; the background about a
  sixth of the lit skin. The nose's lit side falls into its shadow (90% to 10%) over about 9.5 mm, the cheek into the
  jaw's shadow over about 20 mm: a large, soft source. One soft catchlight in each eye.

## 2. What makes them read as real

1. **The picture**: a large soft key from one side and above, a weak fill (three stops down), a dark cool
   background, highlights that roll off (a filmic curve) and never clip, a desaturated, slightly cool grade.
2. **The highlight**: broad and soft, with a fine sharp core that breaks into points over the pores and plateaus
   (two specular lobes on a real-scale micro-relief).
3. **Light that travels in the skin**: warmth at the shadow's edge, pores soft in the diffuse but crisp in the
   highlight, the nostrils and ears glowing red where light comes through.
4. **Peach fuzz**: a faint velvety brightening at the cheek's and jaw's edge against the dark (fine hairs scattering
   at grazing angles).
5. **Colour where the blood is**, low chroma elsewhere: nose, lips, eyelids, ears.
6. **The lips**: vertical lines about a millimetre apart, wet highlights four to five times the lip, a pink hue.
7. **The eyes**: a wet tear line, a catchlight the shape of the key (both built: eye.js).

## 3. Our skin against that

| Cue | The Character Studio today (`skinshader.js`, `index.html`) | Gap |
|---|---|---|
| 1 | No tone mapping (three's default clips); a key on the camera (frontal) with a hemisphere fill of 0.7 | flat, frontal light; clipped, plastic highlights |
| 2 | One GGX lobe (F0 0.028) and a clear coat (F0 0.04) for oil and dew | close to two lobes, not Unreal's split; no cavity on F0, no specular occlusion |
| 2 | Pores 1.3 mm apart by default; relief that fades below a pixel is dropped | pores twice too far apart (measured 0.57 mm); distant skin goes plastic-smooth |
| 3 | "Translucency" is an emissive rim (`rim × diffuse × (0.55, 0.12, 0.08)`) | it glows in the dark and ignores the light |
| 4 | none | no fuzz |
| 5 | flush and mottling as tints | close; no melanin and hemoglobin to drive flush and pallor |
| 6 | lip lines (1.3 mm), gloss, a gradient | lines a little far apart; the highlight not wet enough |

## 4. The plan: eight steps, smallest first, each with the number it must hit

Each step is checked as the project checks a frame: a contact sheet under the reference light and the games' three
lights (studio, lamp, night), close up and at the medium POV shot, measured with `skin_v2/measure.py`'s functions
against §1.

1. **The picture** (hours). AgX tone mapping (or Khronos Neutral through three's `CustomToneMapping` hook, for
   checking albedo), exposure about 1; a **reference light**: a soft key 35-45° to the side and above with a matching
   softbox in the environment (the catchlight), a fill three stops down, a rim from behind, a dark blue-grey
   background; an optional grade (chroma about 0.6, a little cool). *Hits:* lit to shadow 8:1 on the nose; the lit
   cheek's chroma under about 9; no clipped highlight. **Built (the light, not the grade)**: the Character Studio's
   light picker has **reference (film)**: the soft key from the side, a cool rim, a dark blue-grey ground and AgX, with
   the old emissive "translucency" off under it (it glows in the dark: skinshader.js `uGlowK`). Measured on a default
   head at three-quarter: lit to shadow 7.7:1 across the cheek, the lit cheek L\* 62, a\* 3.5, b\* 7.6 (the stills:
   57-63, 2-6, 7-8). The other lights are as they were.
2. **Peach fuzz** (hours). three's `sheen` (Charlie, roughness 0.35-0.5, the skin's colour lightened, 0.15-0.3),
   masked to the cheeks, jaw, upper lip, forehead and ears, plus an asperity rim (bright at grazing angles, brighter
   backlit). *Hits:* the cheek's edge visibly velvety against the dark under the rim light.
3. **The specular stack** (a day). F0 0.028; Unreal's two lobes (the material's roughness ×0.75 at 15% and ×1.3 at
   85%); the cavity on F0 (`specularColor`), AO into three's specular occlusion; roughness by zone (nose 0.7×,
   forehead and chin 0.8×, eyelids 1.1×); the relief that fades below a pixel turned into roughness. *Hits:* the
   cheek's highlight broad and soft with a sharper core; the sparkle's specks 1.1-1.6× their surround.
4. **Light that travels in the skin** (a day). The emissive rim goes; the diffuse lit per colour through normals
   blended toward the smooth one (red 0.67, green 0.21, blue none: from the measured skin profile), a warm tint in
   the penumbra, the pre-integrated profile (`lut.py`) with a width knob. *Hits:* the nose's shadow edge 90-10% over
   about 10 mm under the reference light, warmer (higher a\*) in its middle than on the lit side.
5. **Thin parts** (a day). Thickness baked once per vertex on MHR (ears, nose wings, nostril rims, eyelids,
   fingers); transmission as Unreal does it (forward-scattering, g 0.93) through the profile's colours (1 mm passes
   0.31, 0.005, 0.001: deep red). *Hits:* the nostril's inside L\* about 11, a\* about 14 under the key; ears red
   against a rim light.
6. **Colour from melanin and hemoglobin** (a day). Two chromophores as filters on a pale base (melanin 0.41, 0.57,
   1.0; oxygenated blood 0.035, 1.0, 0.77; venous 0.18, 1.0, 0.30), placed by the face's landmarks: the nose, lips,
   eyelids, ears, the under-eye's venous crescent; a **flush and pallor** slider (fear drains the lips). *Hits:* the
   nose tip's a\* two to three times the cheek's, the lips' hue pink (about 22°).
7. **Micro-relief at real scale** (one or two days). A network of fine furrows (cells 0.25-0.45 mm, stretched along
   the face's tension lines), pores every 0.6 mm or so with only the visible ones 0.3-0.45 mm across (sparser for a
   young East Asian face), deeper where the skin is squeezed (a smile's cheeks), fading into roughness. *Hits:* in a
   close-up, about 300 specks a cm² on the lit cheek, 400 on the forehead, 120 on the nose bridge.
8. **Sparkle and screen-space scattering** (two to four days, later). Hashed glints for dewy makeup and sweat; a
   screen-space separable scattering pass (Jimenez) as a "quality" view once the post-processing passes are vendored.

The lips ride along: lines at 1.0 mm (now 1.3), a wet sharp lobe absent inside the lines, a pale "white roll" along
the border, more red and more scattering than the skin.

## 5. Unreal

- **What to bake** from the Studio (MHR's UVs): base colour with no lighting in it (no rim, sheen, transmission or
  scattering tint), a normal map (wrinkles, pores, the furrows of 0.3 mm and up; finer as a tiling micro-normal at LOD
  0, as MetaHuman does), roughness (with the sub-texel relief's variance), cavity (Specular = 0.35 × cavity), the
  scattering amount (Opacity: 1 on the lips, about 0.9 on skin), a fuzz mask. Table in `skin_v2_sources.md` §9.
- **This project's settings** (Config/DefaultEngine.ini): Substrate on with the **Blendable** GBuffer
  (`r.Substrate.ProjectGBufferFormat=0`). A Substrate slab with a **Subsurface Profile** works there; glints, the
  slab's mean-free-path scattering and (a forum report) its second roughness don't; fuzz probably needs the
  **Adaptive** GBuffer, which costs more. Virtual shadow maps are on: backlit ears can glow too much, which the
  profile's Extinction Scale tames.
- **The profile to start from**: Unreal's defaults (two lobes 0.75 and 1.30, the broad one 85%; Burley, red mean
  free path about 2.7 mm by one reading of its units), tuned by the shot review, not painted.

## 6. What's the user's to decide

- Step 1 changes how everything in the Character Studio looks (the tone curve). It should come in behind a view
  switch and be judged side by side before it becomes the default.
- The grade (desaturated, cool): the Studio's reference view, or the game's look (Unreal's post-process), or both.
- The Adaptive GBuffer in Unreal for fuzz and glints, or a fuzz groom as MetaHuman uses.
- Whether to build v2, and in this order.
