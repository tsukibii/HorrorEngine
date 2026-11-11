# The fit test: ready-made garments carried onto MHR bodies

Research date 2026-11-11. The user's steer: "if you can find a repo or source to get good 3d clothing designs and create
an algorithm to apply that clothing to any of our models (make it fit), and allow custom pbrs, png decals etc that is
also fine, id rather have better already designed clothing with lots of options than generating crappy clothing".

This note is the hands-on half of the research: a first version of that algorithm, written and run in this session on
real library garments and the Studio's own test bodies. It is a **prototype** (`proto/` beside this note: numpy, scipy
and three.js; no check, not on the launcher, nothing wired into the Studio), built to answer one question before
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
- **Two things a real build must add**, both visible in the pictures: **layering** between garments (two library
  garments worn together cross each other: `fit_styles.jpg`, the coat over the sweater), and **bridging** on heavy
  bodies (cloth follows the skin into folds a real garment would span). Both are things the tailor already does for its
  own garments.

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
| Bodies | every garment on at least one (the average or the feminine); fifteen on two to five; all seven bodies used; the pictures show average, feminine, masculine, slim feminine, slim masculine, full masculine |

## 5. What it doesn't do yet

Each of these is visible in the pictures, and each has an answer in `fit_and_skin.md`.

- **Layering.** Garments are fitted one at a time, against the skin only. A sweater under a coat comes through it
  (`fit_styles.jpg`, third row); a skirt's waistband crosses a sweater's hem. The tailor's rule (each garment starts
  from how far the ones under it stand off the skin) is the answer: one cover height per skin point, shared by cut and
  imported garments.
- **Bridging.** On the full bodies a suit follows the belly's folds, and a skirt dips between the thighs. Loose
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
| `fit_cc0_office.jpg` | the CC0 office blouse and skirt with shoes on the feminine and slim feminine bodies |
| `fit_dresses.jpg` | seven dresses, jeans, a sweater, a polo and a handbag, each alone on the feminine body |
| `fit_styles.jpg` | library pieces in our fabrics as a blazer-type school uniform, a gakuran-like set, a camel coat over a sweater (the layering fault), and the CC0 men's suit |

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
