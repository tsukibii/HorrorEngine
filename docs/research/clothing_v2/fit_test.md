# The fit test: ready-made garments carried onto MHR bodies

Research date 2026-11-11. The user's steer: "if you can find a repo or source to get good 3d clothing designs and create
an algorithm to apply that clothing to any of our models (make it fit), and allow custom pbrs, png decals etc that is
also fine, id rather have better already designed clothing with lots of options than generating crappy clothing".

This note is the hands-on half of the research: a first version of that algorithm, written and run in this session on
real library garments and the Studio's own test bodies. It is a **prototype** (`proto/` beside this note: numpy, scipy
and three.js; not on the launcher, nothing wired into the Studio; its layers have a check of their own, §7.7), built to answer one question before
anything is built properly: **does a library garment made for another body land on ours looking right, on every body,
with no hand work?** It does, with the limits in §5.

Everything was run on the CPU in the cloud session. Pictures were drawn by three.js in headless Chromium (SwiftShader).

## 1. Takeaway

- **It works, and it is cheap.** MakeHuman's base body is registered onto MHR's once (4 seconds); after that any
  MakeHuman-format garment is carried onto any MHR body in a tenth to a third of a second. **48 different garments
  went across with no failure and nothing adjusted by hand** (34 of them in `fit_catalogue.jpg`, eleven more in
  `fit_dresses.jpg`): jackets, a coat, shirts,
  sweaters, trousers, skirts, dresses, two suits, an office blouse and skirt, overalls, shoes, a hat.
- **The designs survive.** Pockets, plackets, buttons, yokes, collars and the authors' textures arrive intact
  (`fit_first.jpg`): this is the "already designed" look the user asked for, which the tailor's cut shells don't have.
- **Our own fabrics and decals go on them** (`fit_refabric.jpg`): a second UV in metres made per UV island lets a
  tileable fabric (here the tailor's own plaid and flannel, `tailor/fabric.js`) lie at its real size on a garment whose
  UVs were made for its own texture; the garment's own seams, stitches and folds are kept as a detail layer over the new
  fabric; a PNG from the studio's prints is projected onto the back.
- **Layers, added the same day** (§7), after the user saw the outfits clip: every garment has a layer, each is set
  outside the ones under it, and what a layer covers isn't drawn. Library garments are worn over each other and over
  the tailor's pantyhose, fishnets and socks with nothing coming through (`layers_before_after.jpg`,
  `layers_legwear.jpg`), on the shelf's PBR sets (`layers_pbr.jpg`), on main's newer bodies (`layers_bodies.jpg`), and
  in Godot 4.7 with a dissolve (`layers_godot.jpg`). The twelve library dresses work with them too
  (`layers_dresses.jpg`), under **light rules for an outfit** (§7.5): what can't be worn together without distortion,
  a coat over a dress first of all, simply isn't.
- **One thing a real build must still add**, visible in the pictures: **bridging** on heavy bodies (cloth follows the
  skin into folds a real garment would span), which the tailor already does for its own garments.

## 2. What was used

| | |
|---|---|
| The source body | MakeHuman's `hm08` base mesh (`base.obj` from `makehumancommunity/mpfb2`, CC0): 19,158 vertices, the skin the first 13,380, the rest helpers and joint markers; a decimetre a unit; an A-pose |
| The garments | the official system assets (`mh_system_CC0.zip` from `Makehuman-2/MH2_Asset_Repository_CCO`'s release: 20 outfits, shoes and a hat with their textures, "All of these assets are CC0") and 34 community garments from two public projects that carry them as files (`k3yg4n/glamcam-makehuman-clothing-assets` and `RavinMaddHatter/Madhatters-Table-Top-RPG-Mini-Maker`: CC-BY mostly, each file's header names its author and licence) |
| Our bodies | the Studio's own seven test bodies as the Studio makes them (`tailor/node.mjs` `mhrBody`: identity weights, the base's sculpt, the height): average, feminine, masculine, and the slim and full ones of `tailor/bodies.json` |
| MHR's rig | `Content/Studio/Bodies/MHR_lod1_rig.bin`: 127 bones, four weights a point |

Nothing of MakeHuman's was put in the repo. The pictures beside this note show CC0 and CC-BY garments; their authors
are credited in §6.

## 3. The algorithm, as run

**Once per source body** (`proto/register.py`, 4 s):

1. **Pose.** MHR is posed by its own skinning so its upper arms, forearms, thighs, shins and feet point the way
   hm08's do. The two A-poses are close: 4° at the upper arm, 16° at the forearm, 6° at the legs, 10° at the feet.
2. **Pre-warp.** hm08 is warped smoothly so that 20 of its joints (shoulders, elbows, wrists, hips, knees, ankles,
   the balls of the feet, the clavicles, the neck, the top of the head, the floor under each ankle) land on MHR's.
   This takes care of proportions: MHR's upper arms are 13% longer than hm08's and its forearms 19%.
3. **Skin onto skin.** In twenty rounds each hm08 skin vertex is pulled toward the closest point of MHR's skin that
   faces the same way, the pulls smoothed over hm08's own mesh (a membrane that starts stiff and ends soft), then set
   on the surface. **90.8% of hm08's skin vertices end on MHR's skin**; the rest are the inside of the mouth, the eye
   sockets, the toes and between the fingers, where nothing is worn. Edge lengths change by a factor of 0.64 to 1.39
   (5th to 95th percentile), median 1.00.
4. **Kept:** where every hm08 skin vertex went, and the pose's bone transforms.

**Once per garment** (`proto/fit.py`):

5. **The garment on hm08**, from its own binding, not its stored shape. A `.mhclo` ties every garment vertex to three
   base-mesh vertices with weights and an offset; the `.obj` beside it is whatever body its author modelled on (the
   first run used the `.obj` and put sleeves beside the arms).
6. **Across.** Each garment point takes the blend of its 24 nearest skin vertices' own moves: where the vertex went,
   plus the point's offset from it turned and scaled as the skin there was turned and scaled. A blend rather than the
   nearest triangle, so a skirt between the legs moves smoothly.
7. **Out of the pose.** Each point takes MHR's bone weights from the skin nearest it (smoothed over the garment) and
   the pose is taken back off. The garment now sits on MHR's average body in MHR's own rest pose, which is where the
   Studio shapes, saves and exports everything.

**Per character** (same file: 0.36 s once for the body, then 0.12 to 0.34 s a garment):

8. **Onto the body.** Every MHR body is the same mesh, so how the skin moved from the average to this body is known
   exactly; the garment follows by the same blend as step 6.
9. **Out of the skin.** Points inside the skin, or closer than 3 mm, are put 3 mm outside along the skin's normal and
   their neighbours eased with them, four rounds. Before this, 0.2% to 39% of a garment's points dip in (the tightest:
   the office blouse and a fitted top).
10. **The skin it hides.** The author's `delete_verts` (the hm08 skin vertices under the garment) are carried to MHR
    through the registration and those triangles left out, as the tailor's export leaves out the skin its clothes hide.

**The look** (`proto/render.mjs`):

11. **A second UV in metres.** Each UV island is scaled so its area equals the cloth's own area, its shape and grain
    direction left as its author laid them. A tileable fabric then lies at its real size (the jacket has 52 islands).
12. **The garment's own detail kept.** Its colour texture divided by its own blur leaves the seams, stitches, folds and
    wear as a layer that multiplies whatever fabric goes underneath; its normal map is kept.
13. **A decal** is projected straight onto the garment from the front or the back and drawn on the triangles that
    face it.

## 4. Numbers

| | |
|---|---|
| Registration | 4.1 s once; 20 joints; 20 rounds; 90.8% of the skin matched; the last round's mean gap 0.01 mm |
| Garments tried | 48 (14 system, 34 community); 45 pictured (two fan costumes and one whose header says AGPL left out of the pictures); **none failed** once the reader took keyword lines between vertex lines (the system shoes have two) |
| Their size | 630 to 11,150 points a garment as authored (quads, meant to be subdivided); community dresses up to 32,900 |
| A fit | per garment, once: read 0.02 to 0.09 s, onto MHR's average 0.08 to 0.23 s; per body, once: 0.36 s; per garment on a body: across 0.01 to 0.04 s, out of the skin 0.11 to 0.30 s (3,195 and 11,152 points) |
| Distance off the skin after the fit | medians from 4.5 mm (the office blouse) to 56 mm (a halter dress); never under 2.4 mm but for a few points at edges |
| Bodies | every garment on at least one (the average or the feminine); fifteen on two to five; all seven bodies used; the pictures show all seven (the full ones in `fit_bodies.jpg`) |

## 5. What it doesn't do yet

Each of these is visible in the pictures, and each has an answer in `fit_and_skin.md`.

- **Layering.** In §3 garments are fitted one at a time, against the skin only: a sweater under a coat comes through
  it (`fit_styles.jpg`, third row), a skirt's waistband crosses a sweater's hem. **Done since, in §7.**
- **Bridging.** On the full bodies a suit follows the belly's folds, and a skirt dips between the thighs (`fit_bodies.jpg`). Loose
  garments should lie on the body's bridged outline (the tailor's `bridge`), and skirts and coats' skirts on rings, as
  MakeHuman does with its skirt helper and the tailor with its own. Skirts and dresses are fine on bodies near the
  average.
- **Coarse silhouettes.** The garments are a few thousand quads, made to be subdivided once; here they are drawn as
  they come, so collars and hems are angular close up.
- **Fabric direction.** The second UV keeps each island's direction as its author laid it, so a plaid turns from one
  panel to the next. Each island should be turned so its grain follows the limb or the body it lies on.
- **Shoes** are warped like cloth, so a sole can bend with the foot's shape. They should be carried rigidly (one
  turn, shift and scale per foot).
- **Motion.** MHR's weights are carried to the garment for the un-posing; nothing was skinned and walked. The tailor's
  `weights.js` and `motion.mjs` are the place to test that.
- **The authors' textures** are colour with the light baked in, some with a normal map; roughness is rare. Re-dressing
  with the shelf's sets (steps 11 to 13) is what brings them to the rest of the studio's look.
- **Other libraries.** A garment that is not in MakeHuman's format (a Sketchfab download, a bought pack) has no source
  body to register. It needs a placement step first (landmarks or a skeleton), then steps 8 to 10 as here.

## 6. The pictures, and whose garments they show

| File | Shows |
|---|---|
| `fit_first.jpg` | the first outfit close up on the average and the feminine body: a denim jacket, a tee, trousers |
| `fit_catalogue.jpg` | 34 garments, each alone on the average body, as fitted |
| `fit_refabric.jpg` | the same jacket in the tailor's plaid flannel at real size with the studio's print `varsity_tokyo.png` on its back; the tee recoloured |
| `fit_bodies.jpg` | across bodies: the CC0 men's suit on the masculine, slim masculine and full masculine bodies (left), the Maria skirt and knitted sweater on the feminine, slim feminine and full feminine ones (right); the full bodies show the clinging, the right side the skirt's waistband through the sweater |
| `fit_cc0_office.jpg` | the CC0 office blouse and skirt with shoes on the feminine and slim feminine bodies |
| `fit_dresses.jpg` | seven dresses, jeans, a sweater, a polo and a handbag, each alone on the feminine body |
| `fit_styles.jpg` | library pieces in our fabrics as a blazer-type school uniform, a gakuran-like set, a camel coat over a sweater (the layering fault), and the CC0 men's suit |
| `layers_before_after.jpg` | §7: four outfits before and after the layers: the skirt and sweater at the waist on the feminine and full bodies; a polo over a pleated skirt; trousers, a sweater and a coat; a uniform jacket over a polo and a pleated skirt with the tailor's knee socks |
| `layers_legwear.jpg` | the tailor's pantyhose, fishnet tights, over-the-knee, crew and knee socks under library skirts and into library shoes |
| `layers_pbr.jpg` | the layered outfits on the shelf's baked fabric sets, and two close-ups of the weave at its real size |
| `layers_bodies.jpg` | Anime at Bust 2.1 and -2, a girl of ten, a boy of fourteen; main's red sweater dress with pantyhose, then under a library coat before and after |
| `layers_godot.jpg` | Godot 4.7: the coat over six garments, the coat made invisible (what isn't drawn), the covers painted, half way, the coat off; and the same close |
| `layers_dresses.jpg` | §7.5: the twelve library dresses, each with legwear under it and a jacket or cardigan over it, three of them before and after; a coat and a jacket asked for over a wide-sleeved dress and not worn |

Credits (MakeHuman community assets; each as its file's header states):

- **punkduck**, CC BY 3.0: denim jacket, uniform jacket, winter coat, qipao, retro top, black cocktail dress; CC BY 4.0:
  handbag.
- **Mindfront (Sweden)**, CC BY 4.0: trousers 02, knitted sweater 01, lusekofta; dresses 01, 02, 04, 05, 08 and 11, women's
  trousers 1.
- **Elvaerwyn**, CC BY: pleated plaid miniskirt, knee-length halter dress, goddess dress 8, 50s blouse and skirt,
  crochet baby doll, butterfly disco top, double-ruffle disco pants, gored elephant pants, men's boho top; with
  **punkduck**, CC BY 4.0: the rescue team jacket.
- **sonicteam998**, CC BY 3.0: Maria skirt.
- **MRT**, CC0: basic tucked tee, fisherman's sweater. **Namuhekam**, CC0: polo shirt.
- **The MakeHuman team**, CC0 (released September 2020): the system outfits, shoes and fedora.

All were changed here: fitted to another body, and in `fit_refabric.jpg` and `fit_styles.jpg` given other fabrics and
colours. The bodies are Meta's MHR (Apache-2.0) as the Character Studio shapes them.

## 7. Layers

The user, on seeing §6's pictures (2026-11-11): "some of the designs show clear clipping, can you set smart rules so
skirts are always below the waistband, maybe add clothing layers so that if a piece of clothing is higher in the layer
the layer below can never clip through (maybe we can do some dissolve effect that hides it in godot too) ... test
using our custom pbrs on these outfits too. Test using the pantyhose, fishnet tights and socks too".

`proto/layers.py` does it; `proto/wear.py` wears an outfit (library garments and the tailor's own together) with it or
without. Nothing is simulated: it's geometry on the body at rest, a few seconds to a minute an outfit.

### 7.1 A layer for every garment

| Kind | Layer | How it's known |
|---|---|---|
| legwear (pantyhose, fishnets, leggings) | 15 | the tailor's `legs` slot; a library garment by its name |
| socks | 16 | the tailor's `feet` slot with "sock" in its name |
| shoes | 20 | a library garment that stays under 14% of the body's height |
| **trousers, skirts** | **30** | where it lies on the average body (below the chest, to the legs), a skirt by cloth between the legs |
| **tops**, dresses, suits | **40** | reaches above 70% of the height; a dress or a suit when it also reaches the legs |
| jackets, cardigans | 60 | its name, on a garment shaped like a top |
| coats | 70 | its name, or a jacket's name on a garment that reaches the legs |
| hats, accessories | 90, 95 | above 80% of the height; names (bags, glasses: left alone) |

Garments are worn innermost first, by layer; two of one layer in the order the outfit lists them (a polo, then a
sweater). **Bottoms are under tops**: a top's hem always lies over a skirt's or trousers' waistband. An outfit's
`"tuck": true` puts its tops at 25, under the bottoms. An outfit can give any garment a `layer` or a `kind` of its own
when its name misleads.

### 7.2 Nothing under comes through: two rules together

**Each garment is set outside the ones under it.** Going outward, a garment is compared with everything under it,
cloth against cloth: a point of the upper one that is under the lower one's surface, or nearer than 2.5 mm, is a
conflict. The lower gives 65% of it and the upper the rest, three rounds; the lower never goes closer to the skin than
1.5 mm, nor through whatever it lies on itself, nor further in than the cloth round it can go (a hem over pleats goes
in to their ridges as a line). Then once more going outward with only the upper one moving, so at the end nothing is
under anything. No point is ever moved further than 5 cm from where its garment was fitted: an outfit that would need
more is one the rules of §7.5 refuse. Details that mattered:

- **Which way is out** is the body's own outward direction at the place on the skin nearest the point. Not the
  cloth's faces: library garments wind either way, a hem's turned edge faces down, a pleat has side faces (§7.8).
- **Judged on the faces, not only the points.** Library garments are coarse (the skirt of the first picture has 972
  points) and the tailor's are fine (45,800 for the pantyhose). Points are taken every 7 mm on a coarse garment's
  triangles, and each lower garment's points are also checked against the upper one's faces, so a pleat's ridge
  between two of a polo's points is caught.
- **A push carries along the cloth**, fading over 8 cm, so a hem pushed out by a row of pleats moves as a line.
- **A shoe is never bent.** What's under it goes in; what's over it (a trouser hem) goes out.
- **The tailor's garments are left as the tailor made them among themselves** (pantyhose under its socks): it has
  already layered them.
- A library garment's faces are also kept 2 mm outside the skin (§3's step 9 moves only its points).

**What a layer covers isn't drawn.** The part of a garment (and of the skin) that an opaque garment over it covers
closely is left out, starting 3.5 cm inside the covering garment's edge and fully gone 2 cm further in: the tailor's
own rule for skin under clothes (docs/TAILOR.md §3d), carried to cloth under cloth. Under a hem one can look in, so
the lower garment is kept that far; past it nothing is there to come through, in any pose. Under shoes and socks,
whose edges lie tight, the inset is 1.2 cm. Where the upper garment hangs more than 4 cm away (a skirt round the
legs, an open coat) nothing is hidden: one can see in. Sheer garments (pantyhose, fishnets) hide nothing.

How deep under a layer each point is travels with the mesh as a number per point: 0 where the dissolve starts, 1
where the cloth is gone, negative in the open (signed, so that across a coarse triangle it crosses zero where the
edge really is). It is kept per **band** of what does the covering: bottoms, tops, outerwear, legwear and shoes.

### 7.3 The numbers

`layers.crossings` counts the fault itself: points of a garment (with the faces round them) that stand outside a
garment worn over it and are still drawn. A garment with a lining or an insole counts as one: between two of its
sheets is inside it.

| Worn, innermost first | Bodies | Points through without the layers, a body each (deepest) | With them | Most any garment was moved | Of the cloth's points, not drawn |
|---|---|---|---|---|---|
| a skirt, a sweater | feminine, slim feminine, full feminine | 231 / 231 / 226 (to 46 mm) | 0 / 0 / 0 | 29 mm | 24% |
| pantyhose, shoes, a skirt, a sweater | feminine, slim feminine, full feminine | 775 / 863 / 671 (to 46 mm) | 0 / 0 / 0 | 40 mm | 51% |
| crew socks, trainers, a pleated skirt, a polo | feminine, masculine | 3034 / 3066 (to 26 mm) | 0 / 0 | 17 mm | 55% |
| shoes, trousers, a sweater, a coat | masculine, feminine | 1008 / 1003 (to 24 mm) | 0 / 0 | 30 mm | 23% |
| knee socks, shoes, a pleated skirt, a polo, a uniform jacket | feminine, slim feminine | 4718 / 4733 (to 30 mm) | 0 / 0 | 34 mm | 50% |
| fishnet tights, boots, a tucked tee, a pleated skirt, a denim jacket | feminine, slim feminine | 739 / 684 (to 11 mm) | 0 / 0 | 15 mm | 46% |
| over-the-knee socks, shoes, a pleated skirt, a sweater | feminine, slim feminine | 2189 / 2177 (to 20 mm) | 0 / 0 | 15 mm | 42% |
| pantyhose, shoes, a skirt, a sweater | anime full, anime flat | 770 / 775 (to 29 mm) | 0 / 0 | 20 mm | 52% |
| over-the-knee socks, shoes, a pleated skirt, a polo, a uniform jacket | anime full, anime flat | 4748 / 4720 (to 30 mm) | 0 / 0 | 39 mm | 46% |
| knee socks, shoes, a pleated skirt, a polo, a sweater | girl 10 | 5190 (to 15 mm) | 0 | 30 mm | 49% |
| crew socks, trainers, trousers, a polo, a denim jacket | boy 14 | 1038 (to 20 mm) | 0 | 22 mm | 62% |
| pantyhose, shoes, the red sweater dress (two pieces) | feminine, anime full | 544 / 544 (to 7 mm) | 0 / 0 | 0 mm | 26% |
| fishnet tights, boots, the red sweater dress, a coat | feminine, anime full | 35946 / 35673 (to 42 mm) | 0 / 7 | 50 mm | 55% |
| pantyhose, knee socks, shoes, a pleated skirt, a polo, a sweater, a coat | feminine | 12182 (to 32 mm) | 4 | 50 mm | 67% |

Twelve of the fourteen outfits end at zero on every body. On the other two a few points are left: seven of the chunky
sweater dress at the coat's edge on the full bust, by up to 5 mm (the coat is at its 5 cm limit there), and in the
seven-garment outfit two of the pantyhose at the knee socks' cuff (the tailor's own pair, left as made) and two of a
sock at the shoe's collar, under half a millimetre.

The lower layers move little: in the first two rows the skirt goes in by at most 24 mm and the sweater out by at
most 40 mm (on the full body). An outer garment has further to go the more is under it, and stops at 5 cm: the coat
reaches that over six garments, and over the chunky sweater dress on the full bust. A shoe is never moved.

### 7.4 With the tailor's garments, the shelf's PBR sets, and main's newer bodies

- **Pantyhose, fishnet tights, socks** (`layers_legwear.jpg`): the tailor's `tights`, `fishnet-tights`, `knee-socks`,
  `crew-socks` and `over-knee-socks`, cut on the same body by `proto/tailor_parts.mjs` and drawn in the tailor's own
  materials, under library skirts and into library shoes. The library's shoes come with a white sock modelled in as a
  separate piece; an outfit's `"drop_above": 0.2` leaves it out. One thing found on the way: the tailor's garments
  span the body's hollows, so they have no "height off the skin" there; that is why cloth is compared with cloth.
- **PBR sets** (`layers_pbr.jpg`): the baked fabric sets of `assets/pbr/Procedural/fabric_*` (melton, herringbone,
  oxford, gabardine, sweater, rib, corduroy, denim, tweed, jersey) on the layered outfits through §3's metre UV, at
  each set's own `tile_m`, tinted by a colour where the set says it tints, the garment's own seams kept over them at
  40% to 90%. A garment whose own texture is a pattern (the plaid skirt) keeps that pattern's lines in its detail
  layer unless `keep` is turned down.
- **Main's newer bodies** (`layers_bodies.jpg`; main merged first, PR #22): Anime at Bust 2.1, where the garments are
  fitted and layered on the body's dress form (TAILOR §1j) and the skin drawn is the body's own; Anime at Bust -2; a
  girl of ten and a boy of fourteen (`grownBody`); and the red sweater dress (the tailor's `sweater-dress-skirt` and
  `sweater-dress`) with pantyhose, library shoes, and a library coat over it. Nothing comes through on any of them.
  On the full bust the cloth covers and layers, but a knit stretches over it and a coat crumples under it: the fit's
  own limit (§5, bridging), not the layers'.

### 7.5 The dresses, and light rules for an outfit

The user asked whether the library's dresses were kept and whether they work with the layers; then, seeing a dress
being forced under a coat: "if they're wearing a dress dont worry about making them wear a coat ... we want to create
some light rules for outfitting just to not have to deal with harder clipping and mesh distortion".

**Kept.** The twelve dresses of §6 are all still used by the test: Mindfront's dresses 01, 02, 04, 05, 08 and 11
(CC BY 4.0), punkduck's black cocktail dress and qipao (CC BY 3.0), Elvaerwyn's halter dress, goddess dress, 50s
blouse and skirt and crochet baby doll (CC-BY). As with every garment here, the repo keeps how to fit and layer them,
their pictures and their credits, and **not the files**: they are not CC0, and whether CC-BY garments ship is the
user's call. `proto/README.md` has the two `git clone` lines that fetch them again.

**They work with the layers** (`layers_dresses.jpg`). A dress is layer 40, as a top is. Each of the twelve was worn
with legwear under it (the tailor's pantyhose, fishnets, stockings, or socks) and a jacket or a cardigan over it (a
denim jacket, a uniform jacket, a knitted jacket, the tailor's own cardigan):

| Dress | Worn with | Bodies | Points through without the layers | With them | Most any garment was moved | Not worn, by the rules |
|---|---|---|---|---|---|---|
| black cocktail dress (punkduck, CC BY 3.0) | pantyhose, shoes; a denim jacket | feminine, slim feminine, full feminine | 697 / 805 / 732 | 0 / 0 / 0 | 18 mm | nothing |
| qipao (punkduck, CC BY 3.0) | the tailor's stockings, shoes | feminine, slim feminine | 544 / 626 | 0 / 0 | 3 mm | nothing |
| dress 01 (Mindfront, CC BY 4.0) | knee socks, shoes; the tailor's cardigan | feminine | 1148 | 0 | 41 mm | nothing |
| dress 02 (Mindfront, CC BY 4.0) | over-the-knee socks, shoes; a knitted jacket | feminine | 850 | 0 | 9 mm | nothing |
| dress 04 (Mindfront, CC BY 4.0) | pantyhose, shoes; a denim jacket | feminine | 1279 | 0 | 13 mm | nothing |
| dress 05 (Mindfront, CC BY 4.0), wide hanging sleeves, floor length | fishnet tights, boots; a coat asked for | feminine, anime full | 2055 / 2153 | 0 / 0 | 46 mm | Coat: no coat over a dress |
| the same dress 05 | pantyhose, shoes; a denim jacket asked for | feminine | 2021 | 0 | 26 mm | Denim Jacket: F_Dress_05 is too full to go under it |
| dress 08 (Mindfront, CC BY 4.0) | crew socks, trainers; a denim jacket | feminine, girl 10 | 50 / 40 | 0 / 0 | 10 mm | nothing |
| dress 11 (Mindfront, CC BY 4.0) | fishnet tights, boots; a uniform jacket | feminine | 555 | 0 | 17 mm | nothing |
| knee-length halter dress (Elvaerwyn, CC-BY) | pantyhose, shoes; a uniform jacket | feminine | 1668 | 0 | 50 mm | nothing |
| goddess dress 8, floor length (Elvaerwyn, CC-BY) | shoes; a denim jacket | feminine | 4375 | 0 | 50 mm | nothing |
| 50s blouse and skirt (Elvaerwyn, CC-BY) | pantyhose, shoes; a knitted jacket | feminine | 8476 | 0 | 48 mm | nothing |
| crochet baby doll, worn as a top (Elvaerwyn, CC-BY) | trousers, a tee under it, shoes | feminine | 631 | 0 | 30 mm | nothing |

All thirteen end with nothing through. (The counts without the layers include some five hundred points of a sock's or
a stocking's sole under a library shoe's thin sole, which no one sees; with the layers what is inside a shoe isn't
drawn.)

**The rules** (`layers.rules`, `layers.too_full`). What a rule refuses isn't worn, and the run says why; nothing is
bent to make a combination work.

| Rule | Why |
|---|---|
| One skirt or trousers; one jacket; one coat; one pair of shoes; one pantyhose, tights or stockings (socks go over them) | two of a kind in one place only fight |
| A dress or a suit is the top and the bottom: no separate top, skirt or trousers with it | it already covers both |
| **No coat over a dress** | the user's; a dress's skirt and sleeves are as full as they like, a coat's aren't |
| Nothing is worn over a garment too full to go under it: over 2% of the lower garment standing more than 5 cm outside the upper one as fitted (measured on the body) | a fitted jacket over wide hanging sleeves: there is nowhere for them to go |
| No point of any garment is moved further than 5 cm from where it was fitted | a garment keeps its shape whatever is under it |
| Under a hem that reaches the floor the shoes aren't drawn | the hem lies where they are |

Two outfits break them on purpose (`layers_dresses.jpg`, fourth row). Mindfront's dress 05 has wide hanging sleeves
and a floor-length skirt. A coat asked for over it is refused by kind. A denim jacket asked for over it is allowed
by kind and refused by measure: 4.5% of the dress stands more than 5 cm outside the jacket, against 0.2% at most for
every pair the test does wear. The picture's first panel shows what the rules avoid: the same coat fitted over the
dress without them.

### 7.6 In Godot: the dissolve, and taking a layer off

`wear.py --glb` writes the outfit as one .glb (`proto/glb.py`): the body and each garment a mesh, and in every mesh's
vertex colours how deep it is under each band (red under bottoms, green under tops, blue under outerwear, alpha under
legwear and shoes). `proto/godot/cover.gdshader` reads them:

- what's covered is not drawn (a `discard`), and where the mesh goes under the covering layer's edge it **dissolves
  over those 2 cm** by a dither (interleaved gradient noise, which TAA resolves into a fade) instead of ending in a
  line;
- four uniforms, one a band, say whether that band is worn. **A game that takes a coat off turns `outerwear` down**
  and what the coat hid is drawn again, dissolving back in; nothing is baked again;
- `show_cover` paints what's hidden instead of leaving it out, for looking at it.

`proto/godot_test.py` (GDLAYERS) drops the .glb into a scratch Godot 4.7 project, imports it headless and pictures it
under xvfb (`layers_godot.jpg`): a coat over six garments (pantyhose, knee socks, shoes, a pleated skirt, a polo, a
sweater); the coat made invisible, showing what isn't drawn under it; the same painted; half way through taking it
off; the coat off. It checks that the covers came through the import and that the pictures differ as they should.
What Godot read back from the vertex colours, as the share of each mesh's area that isn't drawn: the sweater 74% (all
of it by the coat), the polo 85% (66% by the sweater, 76% by the coat), the pleated skirt 76%, the pantyhose 60%, the
knee socks 31% (the part in the shoes), the skin 65%, the coat and the shoes nothing.

The dither is this prototype's own shader. The look plugin's skin and cloth shaders don't read the covers yet, and the
Character Studio's Export for Godot doesn't write them.

### 7.7 The check

`python proto/check.py <work dir>` (LAYERS; by hand: it needs the fetched garments, so it isn't in `check_all`).
First the outfit rules by kind, on made-up lines. Then thirteen outfits on twenty-five bodies (the seven that clipped,
four with dresses, the two that break the rules on purpose), each worn without the layers and with them: without, the
fault is found and counted (so the count is known to see it); with, nothing comes through (a sliver at an edge is let
be: under half a percent of a garment's points, each under 2 mm; 5 mm for the chunky dress under the coat on the full
bust); no point is further than 5 cm from where its garment was fitted, and no shoe is moved at all; what the rules
refuse isn't worn, and only that; the outermost garment is hidden by nothing; bottoms sit under tops (the other way
in an outfit that tucks them in) and outerwear over both. It ends `LAYERS ok (13 outfits, 25 bodies)`.

### 7.8 What went wrong on the way

The first version compared heights off the skin. It cured the first picture and then missed the tailor's pantyhose,
which span hollows. The second compared cloth with cloth using each garment's own face normals, and broke the first
picture again once pantyhose went under the skirt: the tights' turned edge at the waist faces down, so the skirt and
sweater above it read as under it and were pushed up to 5 cm. The user caught it in a picture ("you had it fixed in
the first screenshot, but somehow broke it"). The third takes "out" from the body and is the one described above;
the outfit that broke is in the check, with and without the tights. docs/LESSONS.md has the rules drawn from it.

### 7.9 What the layers don't do yet

- **Nothing was walked.** The covers are made at rest. Garments skinned from the same skin should keep them (what's
  hidden stays under the edge it was hidden under), but that is untested; `tailor/motion.mjs` is the place.
- **A hem across pleats** is left a little wavy (`layers_before_after.jpg`, the polo's hem), and a garment squeezed
  between two others (a polo between a pleated skirt and a sweater) shows it most (`layers_godot.jpg`, the coat off).
- **Collars.** A lower garment's collar that should stand over the upper one's neck (a shirt collar over a sweater)
  is pushed under it or hidden like any other part.
- **An open coat** hides what it covers closely at the sides and back, and nothing at the open front; a coat that is
  worn open and then closed in the game needs the closed shape's covers.
- **The rules are few.** They are by kind and by one measure. They don't know a pinafore from a ball gown (a blouse
  under a pinafore dress is refused), nor that a cape is not a coat. An outfit can say a garment's `kind` when the
  rule's guess is wrong.
- **Sheer over opaque** has no rule of its own: pantyhose over an opaque sock would be drawn as a veil over it.
- **Speed.** Twenty seconds to two minutes an outfit on a body in numpy, nearly all of it nearest-point searches; a
  real build keeps a search tree a garment.
