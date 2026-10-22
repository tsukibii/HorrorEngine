# Hair: what the reconstruction papers teach us (2026-10-22)

The user's list (github.com/zhoushiwei/Awesome-3D-Hair-Reconstruction) and its papers, read for what the Character
Studio's hair can borrow. The papers' PDFs were blocked from the session (arxiv.org, openaccess.thecvf.com,
ieeexplore.ieee.org, www.hao-li.com), so this is from their abstracts, search summaries and what is known of them.

## The papers

| Paper | What it does | Code, data, licence |
|---|---|---|
| Hu, Ma, Luo, Li 2015, *Single-View Hair Modeling Using a Hairstyle Database* | A photo and a few strokes: the best-matching hairstyles from a database of artist-made models are retrieved, combined into one large-scale shape, then refined to the photo | No code; its database became USC-HairSalon (343 artist hairstyles from game communities; USC's research licence, no commercial use) |
| Zhou et al. 2018, *HairNet* (ECCV) | A 2D orientation map (Gabor filters on the hair region) into a CNN that outputs strands on a 32×32 scalp grid, with a collision loss against the head; trained on USC-HairSalon, augmented | Code MIT (third-party reimplementation), data generator; the weights inherit the data's licence |
| Liang et al. 2018, *Video to Fully Automatic 3D Hair Model* (SIGGRAPH Asia) | Any video, selfies included: automatic hair segmentation, retrieval from a database, then strands estimated and deformed in 3D across the views (not 2D) | No code |
| Wu et al. 2022, *NeuralHDHair* (CVPR) | IRHairNet: a 3D occupancy field (where hair is) and a 3D orientation field (which way it flows), coarse from the orientation map, fine from luminance; GrowingNet grows strands through the field, patch by patch | Code, no licence stated |
| Zheng et al. 2023, *HairStep* (CVPR) | Strand maps and depth maps as the bridge from synthetic training to real photos | CC BY-NC 4.0; data and checkpoints non-commercial research only |
| Hair/skin masking with FCNs (ICME 2017) | Segmenting the hair from the photo | Superseded by MediaPipe's hair segmenter (its licence still to confirm) |

Newer than the list: Perm (ICLR 2025: a parametric hair model, PCA over strands in the frequency domain; code MIT, but
trained on USC-HairSalon), HAAR (CVPR 2024: text to strands; research release), DiffLocks (CVPR 2025: a picture to
100k strands, trained on 40k synthetic Blender hairstyles; Max Planck licence, commercial use through Meshcapade).

**Licences:** every useful trained model or dataset here is research-only. We can take the ideas and the classic
(non-learned) steps; we can't ship their weights or data in a game we sell.

## What they all share

1. **A prior for the 3D shape:** a database of real hairstyles, or a network trained on one. One picture never shows
   the back.
2. **The picture's evidence:** the hair's mask, and a **2D orientation map**: Gabor filters at many angles, the
   strongest per pixel, with a confidence. Classic, no network.
3. **A 3D volume:** occupancy (where hair is) and an orientation field (which way it flows), built from the prior and
   bent to the picture.
4. **Strands grown through that field** from roots on the scalp: thousands of them, about 100 points each, kept off the
   head.

## Why ours looks mediocre

- **Too few, too wide, too flat:** 160 to 900 cards a few centimetres wide, lit like plastic. Real-looking hair in these
  papers is 10k to 100k strands, and it reads as hair because of **how it's shaded**: two highlights along the
  strand's direction (Kajiya-Kay or Marschner), darker roots, the inside shadowed by the outside.
- **The shape is a rule, not a prior:** one growth rule per style instead of real hairstyles bent to fit.
- The wig's structure is right: Unreal's groom works the same way (guide strands simulated, render strands follow).

## What to do instead

1. **Strands, not cards:** the style's (or the wig's) strands become guides, 200 to 400; 20k to 60k render strands are
   interpolated round them with clumping, a little frizz, flyaways and a taper.
2. **A proper preview:** thin strands with an anisotropic hair shader, darker roots and occlusion by depth into the hair
   volume. This is the biggest jump in looks.
3. **Fit to a photo the classic way:** the hair's mask and a Gabor orientation map; our own styles as the database
   (pick the style and its numbers whose silhouette matches); then bend the guides so the front strands follow the
   orientation map and fill the mask.
4. **To Unreal as a groom:** strands and guides as Alembic (Blender's module writes it); Unreal shades and simulates
   strands itself, and its Hair Card Generator (three cards per clump, the same idea as our wig) makes the card LODs.
5. **Our own hairstyle library later:** grooms made in Blender (free, the output ours) become the database the 2015
   paper retrieves from.

Sources: the list above; HairStep's repository (licence, README); Perm's repository (MIT, README); the HairNet
reimplementation (MIT); Hair-GAN (GPL-3.0); Epic's Hair Card Generator documentation; the DiffLocks, HAAR and
NeuralHDHair project pages and abstracts.

## The Asian cuts in hair.js (2026-10-22)

The procedural styles are stand-ins for a Perm blend: quick to grow, they show the silhouette in a POV medium shot.
What each cut is, and the knob that makes it:

| Style | What it is | How hair.js makes it |
|---|---|---|
| `hime` | Hime cut: long and straight, blunt bangs, sidelocks cut level at the chin | `bangs: true`, `sidelocks: "chin"` (front side strands stop at the chin) |
| `seethrough` | Korean see-through bangs: a sparse, fine fringe to the brows, the forehead showing through | `bangs: "thin"` (45% of the fringe roots, half-width cards, a ragged end) |
| `curtain` | Curtain bangs: parted in the middle, swept out, longest at the sides, to the cheekbones | `bangs: "curtain"` |
| `layered_bob` | Layered bob (C-curl bob): chin length, shorter layers on top, thin bangs | `cut: "chin"`, `layers` |
| `wolf` | Wolf cut: shaggy short crown, longer nape, curtain bangs, volume | `layers: 0.7`, high volume and wave |
| `two_block` | Two-block (Korean men's): short sides and nape, a longer top falling to the brows | `under` (the lower scalp cut short) |
| `half_up` | Half-up: the top gathered to a tie at the back, the rest down | `tails: "half"` |
| `low_pony` | Low ponytail at the nape with curtain bangs | `tails: "pony"`, a low `tie` |

The Hair tab's sliders override each style's numbers (`layers` is one of them); the Bangs switch keeps a style's own
kind of bangs.

## Hair models worn as wigs, and where CC0 ones come from (2026-10-22)

`wigify.js` (the Hair tab's "a hair model, worn as a wig") takes any hair-only mesh, GLB, glTF, FBX or OBJ, and wears it:
fitted by the crown (the model's top 10 cm scaled to the head's crown band plus a centimetre of hair, its top just over
the head's, centred on the skull), six handles (the crown moves it; left, right, front and back widen or narrow each
side; the bottom one stretches what hangs below the ears), points inside the head pushed out at rest, the top locked to
the head (a slider: the crown only, or down to the ears), the rest a cage of a few hundred particles with gravity, a
loose hold to the fitted shape, springs to their neighbours and the skin collision, every vertex riding its nearest
particles. Centimetre models (taller than 3 units) are scaled to metres; Turn 90° when a model faces another way.

So a model's licence is the only licence. Where CC0 hair models are (check each one's page: CC0 is per asset):

- **MakeHuman's own assets**: the system hairs that ship with MakeHuman are CC0 ([the FAQ](https://static.makehumancommunity.org/makehuman/faq/are_makehuman_files_free.html));
  the community library's hairs are licensed one by one ([MakeHuman Community](https://static.makehumancommunity.org/about.html)), many CC0.
- **Quaternius**: low-poly CC0 character packs, some with separate hair meshes (listed as CC0 by
  [a third party's licence file](https://app.cinevva.com/blog/hair/library/LICENSE.txt); confirm on Quaternius's page).
- **Womp**: CC0 stylised hair caps ([Hair 1](https://flowerpecker.womp.com/assets/hair-1-v40clnbwzg/) to 9), but edited in the browser: an export is needed.
- **Blender's Human Base Meshes** (CC0) has bodies and heads but no hair meshes; its hair is the Geometry Nodes system.
- **Our own**: the Hair tab's cards exported as OBJ, or anything made in Blender: no licence question at all.

Not CC0 and kept out: Perm's fitted hairstyles (USC-HairSalon, research use: free games only, DECISIONS 2026-10-22),
Mixamo, MetaHuman grooms, store-bought hair.
