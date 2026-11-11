# Fit ready-made garments; don't generate them

**Build CloV2 as a wardrobe of ready-made garments fitted to your MHR bodies, starting with MakeHuman's community
clothing. Do not build it on Cloth2Tex or on any generator.** Cloth2Tex cannot be the tab: it makes no garments, only
one 512-pixel texture for one of nine fixed meshes that may not ship in a sold game, and it would need about 2 GB of
VRAM (worked out from its code, not measured). Nothing found since 2023 makes a wearable garment for a body like yours
under a licence you can sell with. The ready-made route already works. In this session a first version of the fit
carried **48 real garments onto your MHR test bodies with no failure and no hand work**, in a tenth to a third of a
second each on a CPU, with pockets, collars and buttons intact. It then dressed a library jacket in the tailor's own
plaid with one of your prints on its back. MakeHuman's packs hold **129 garments and shoes and 56 accessories under
CC0** (no conditions) and **210 more garments and shoes and 67 accessories under CC-BY** (free to sell with, if you
credit the author). All are tied to one base body, so one alignment fits the lot. A second pass the same day, after
you saw the outfits clip, added **layers**: library garments worn over each other and over the tailor's pantyhose,
fishnets and socks with nothing coming through, on your PBR sets, and a dissolve for it in Godot 4.7
(`clothing_v2/fit_test.md` §7, [`layers_before_after.jpg`](clothing_v2/layers_before_after.jpg)). The test did not
prove heavy bodies or motion; those are the build. No free library found has a sailor uniform, a
gakuran, a hanbok or a kimono; the best lead is Style3D's garments on Sketchfab, not yet confirmed. Three calls are
yours: whether CC-BY garments may ship with a credits screen, how the packs get downloaded, and which garments come
first.

| You asked | Short answer |
|---|---|
| 1. Could Cloth2Tex be a second clothing system (a CloV2 tab), and how much VRAM would it need? | No. It paints a texture onto nine fixed meshes and fits nothing to a body. About 2 GB, an estimate from its code |
| 2. That repo is three years old. Is there anything better and free? | Not for making garments. Yes for the parts round them: a fitting method, weight transfer, fabric maps, one generator for accessories |
| 3. Ready-made designs, an algorithm that makes them fit any of your models, custom PBRs and PNG decals? | Yes, and this is the route. A free library exists, the fit ran on your bodies, and your fabric and print went onto a library jacket |
| 4. More Korean and Japanese smart casual, uniforms, dresses, suits? | Suits, office wear, pleated skirts and dresses: yes, free. Sailor uniforms, gakuran, hanbok, kimono: not free anywhere found |

How to read the evidence. Research date 2026-11-11; the notes behind this report are in [`clothing_v2/`](clothing_v2/).
*At source* means a fact was read in a repository's own files. *Via search summary* means the page could not be opened
from this session (arxiv.org, project pages, Hugging Face, Sketchfab and MakeHuman's file servers were blocked or out
of reach), so the fact comes from a search engine's summary of it: weaker evidence. *Unverified* means nobody here
read the licence or ran the thing. Apart from the fit test nothing was run, so every VRAM and time figure is the
authors' or a user's unless it says *estimate*.

## Cloth2Tex makes one 512-pixel texture, not clothes

Cloth2Tex is not a clothing system. It ships **nine garment meshes made by hand** (a sweatshirt, a polo, a T-shirt,
shorts, trousers, a zip-up, a wind coat, a jacket, a skirt), and its whole output is a texture for one of them: a
front and a back catalog photo pulled onto that mesh. Nothing in it fits a garment to a body; a user's question, how
to put the cloth on an avatar, has had no answer from its authors since 2024
([Cloth2Tex](https://github.com/HumanAIGC/Cloth2Tex), [issue 7](https://github.com/HumanAIGC/Cloth2Tex/issues/7)). So
"its garments with our textures and PBRs" would keep nothing of it but those nine meshes. They are under GPL-3.0, a
licence that is fine for a tool you run but does not let a mesh ship inside a closed, sold game, and they fit no MHR
body.

The texture is small and torn: **512 × 512 pixels for the whole garment**, about 3 mm of cloth a pixel on a
sweatshirt, with smears and holes down the sides, the underarms and the inner legs, because only a front and a back
view are used. The second phase that was to repair them was never released; asked for a date, the only reply is
another user's "Seems that they forgot about it" ([issue 8](https://github.com/HumanAIGC/Cloth2Tex/issues/8)). The
repository has one commit, from 2023-12-01. The part that finds a garment's landmarks in a photo was held back too, so
**every photo needs 10 to 12 points clicked by hand**.

Memory was never the obstacle. It needs **about 2 GB of VRAM**, a twelfth of your 3090, and 5 to 7 GB if its texture
were raised to 2,048 pixels. Both figures are worked out from the sizes of the data its code creates, not measured:
the session had no graphics card ([cloth2tex.md](clothing_v2/cloth2tex.md)). The one idea worth keeping is a garment's
look taken from a photo of a real one. On a library garment that is a decal, with no renderer and no VRAM, and the
photo has to be your own: a shop's product photo belongs to the shop, and a logo to its brand.

## Three years of research still stop short of a wearable garment

Research since Cloth2Tex has moved fast and released little that a one-person studio selling its games can use. The
pattern repeats in every family below. The tool makes half a garment (a flat pattern, a loose object, a painted
texture), and the other half is work you already do or already removed.

| Family (2024 to 2026) | What comes out | Why it is not your route | VRAM against your 24 GB, and whose figure | Worth keeping | Sources |
|---|---|---|---|---|---|
| Sewing-pattern generators: 11 with code, among them ChatGarment, AIpparel, Design2GarmentCode | A flat sewing pattern, or a list of design settings, from a picture or words | The pattern still has to be draped on the body, the step you removed in October, and the drape tools they document are research-only or paid. Their designs have no pockets, buttons, zips, plackets, pleats or linings. No licence for their trained model files (the "weights") could be verified | Fits: ChatGarment "at least 15 GB" (a user) | Nothing | [ChatGarment issue 26](https://github.com/biansy000/ChatGarment/issues/26), [simulator licence](https://github.com/maria-korosteleva/NvidiaWarp-GarmentCode/blob/main/LICENSE.md), [design list](https://github.com/biansy000/GarmentCodeRC/blob/main/assets/design_params/design_used.yaml), [note](clothing_v2/sewing_patterns.md) |
| Image-to-3D generators: TRELLIS.2, Stable Fast 3D, Hunyuan3D | A textured object from one picture | An object, not a garment on a body: no body, no real size, often a second shell inside, and nothing that refits when the body changes | TRELLIS.2 "at least 24GB" (authors), about 11 GB at peak after a user's fix; Stable Fast 3D "about 6GB" (authors) | TRELLIS.2, for one-off accessories | [TRELLIS.2](https://github.com/microsoft/TRELLIS.2/blob/HEAD/README.md), [issue 25](https://github.com/microsoft/TRELLIS.2/issues/25), [issue 188](https://github.com/microsoft/TRELLIS.2/issues/188), [Stable Fast 3D](https://github.com/Stability-AI/stable-fast-3d/blob/HEAD/README.md) |
| Garment-specific 3D methods: 23 checked | A garment mesh from text, a picture or a scan | 14 have no code that could be found. Of the nine with code, five are non-commercial, four have no licence file, and five need the SMPL body models | Not relevant: none is usable | One idea: bend a clean garment toward a target shape | [Garment3DGen licence](https://github.com/nsarafianos/Garment3DGen/blob/HEAD/LICENSE.md), [note](clothing_v2/mesh_generators.md) |
| AI texture painters: OmniFabric, NI-Tex, DiffusedTexture | A texture painted onto your mesh from a prompt or a picture | The two built for Cloth2Tex's job are closed: OmniFabric by non-commercial FLUX models, NI-Tex by having no licence. The usable ones invent a look and bake the light in | OmniFabric 28 to 35 GB (authors): too big. DiffusedTexture 3.7 GiB with Stable Diffusion 1.5, about 10 GiB with SDXL (authors) | DiffusedTexture, for variants of an untextured garment | [OmniFabric](https://github.com/humansensinglab/OmniFabric/blob/HEAD/README.md), [NI-Tex](https://github.com/SII-Hui/NI-Tex/blob/HEAD/README.md), [DiffusedTexture](https://github.com/FrederikHasecke/diffused-texture-addon/blob/HEAD/README.md) |
| Fitting methods: cloth-fit, ContourCraft, DrapeNet | An existing garment moved from one body to another | Most need SMPL or have no code. cloth-fit (MIT) is the one clean release, and it needs the garment's own rigged avatar and input files made by hand | No VRAM: cloth-fit runs on the CPU; its run time is not known | cloth-fit, for a garment that comes with its avatar; the MIT weight-transfer code | [cloth-fit](https://github.com/Huangzizhou/cloth-fit/blob/HEAD/README.md), [issue 6](https://github.com/Huangzizhou/cloth-fit/issues/6), [ContourCraft](https://github.com/Dolorousrtur/ContourCraft/blob/HEAD/README.md), [weight transfer](https://github.com/rin-23/RobustSkinWeightsTransferCode) |
| Cloth simulators: ZOZO's Contact Solver, libuipc, Newton | A drape of panels that someone has already cut | They drape, they don't design. ZOZO's author: "Honestly, not yet for serious use" | ZOZO: "3090 ... for small to medium" scenes (authors) | A fallback, if a fitted coat ever needs a real drape | [ZOZO](https://github.com/st-tech/ppf-contact-solver/blob/main/README.md), [issue 152](https://github.com/st-tech/ppf-contact-solver/issues/152), [Newton](https://github.com/newton-physics/newton/blob/main/docs/solvers/index.rst) |
| Fabric maps from a photo: PBRify_Remix, DeepBump | Normal and roughness maps for a flat colour tile | A network's guess from colour; it does not remove light baked into the photo | PBRify has a 6 GB setting; DeepBump runs on the CPU | PBRify_Remix (CC0), for your own swatches | [PBRify_Remix](https://github.com/Kim2091/PBRify_Remix/blob/HEAD/README.md), [DeepBump](https://github.com/HugoTini/DeepBump/blob/HEAD/cli.md) |
| Garment design apps: Marvelous Designer, CLO, Style3D | Garments made by hand in a pattern tool | Not free for commercial work, or not on Linux: Marvelous Designer on Linux is $2,300 a seat a year (via search summary) | Not relevant | Nothing free | [Marvelous Designer](https://support.marvelousdesigner.com/hc/en-us/articles/47358269350041), [CG Channel](https://www.cgchannel.com/2025/10/marvelous-designer-is-now-available-for-linux/) |

Licences, not memory, decide almost everything here; a 3090 runs nearly all of it. Eight traps came up again and
again. They are worth knowing, because the next release will carry the same ones.

| Trap | What the licence says | What it closes | Source |
|---|---|---|---|
| A research-only library inside the export | nvdiffrast, NVIDIA's library for drawing meshes: "only may be used or intended for use non-commercially" | TRELLIS.2's textured export as shipped (a small thing to replace), MV-Adapter, InstantMesh, Unique3D | [nvdiffrast](https://github.com/NVlabs/nvdiffrast/blob/HEAD/LICENSE.txt), [TRELLIS.2 issue 22](https://github.com/microsoft/TRELLIS.2/issues/22) |
| A territory clause | Tencent's Hunyuan 3D licence: no use of outputs "outside the Territory", which excludes the EU, the UK and South Korea | Every Hunyuan3D model and painter. TripoSG, Step1X-3D and CraftsMan3D carry Tencent-licensed files inside permissive repos | [Hunyuan3D-2.1](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1/blob/HEAD/LICENSE), [TripoSG](https://github.com/VAST-AI-Research/TripoSG/blob/HEAD/triposg/LICENSE) |
| Free outputs, non-commercial model | FLUX.1-dev and FLUX.2-dev, two image models: outputs may be used commercially, the model itself only for "Non-Commercial Purposes"; add-ons trained on it inherit that | OmniFabric, UniTEX, any FLUX-dev add-on | [FLUX.1-dev](https://github.com/black-forest-labs/flux/blob/HEAD/model_licenses/LICENSE-FLUX1-dev) |
| Research only | CHORD (Ubisoft): "Commercial use is strictly prohibited". The same in kind: RGB-X (Adobe), Cube (Roblox), GarmentCode's simulator, MeshAnything V2 | The one model built to turn a texture into PBR maps, and the drape most pattern generators rely on | [CHORD](https://github.com/ubisoft/ubisoft-laforge-chord/blob/HEAD/LICENSE), [GarmentCode simulator](https://github.com/maria-korosteleva/NvidiaWarp-GarmentCode/blob/main/LICENSE.md) |
| A body you may not use | SMPL and SMPL-X, the research body models your brief rules out as non-commercial | ContourCraft and HOOD (their code is MIT), DrapeNet, GALA, SO-SMPL | [ContourCraft install](https://github.com/Dolorousrtur/ContourCraft/blob/HEAD/INSTALL.md), [DrapeNet](https://github.com/liren2515/DrapeNet/blob/HEAD/README.md) |
| No licence at all, or one nobody could read | No licence file means no permission was given. Weights' licences often sit only on Hugging Face, which was blocked: unverified | DressCode, SewFormer, ReWeaver, SeqTex, TEXGen; most generators' weights | [DressCode](https://github.com/IHe-KaiI/DressCode/blob/main/README.md), [SeqTex](https://github.com/VAST-AI-Research/SeqTex/blob/HEAD/README.md) |
| Strings on "free" | Stability AI: free under US$1M of yearly revenue, and commercial users "must register" | Stable Fast 3D and SPAR3D are usable, inside those strings | [Stability licence](https://github.com/Stability-AI/stable-fast-3d/blob/HEAD/LICENSE.md) |
| Generated, so nobody's | The US Copyright Office: prompts alone do not make the user an author. Steam asks developers to declare pre-generated AI content that players see (both via search summary) | Nothing, but a generated bag is not "ours" in the sense of your rule: you could ship it, and you could not stop anyone copying it | [Mintz](https://www.mintz.com/insights-center/viewpoints/54731/2025-02-07-us-copyright-office-publishes-second-part-report-ai), [GIGAZINE](https://gigazine.net/gsc_news/en/20260120-steam-updates-ai-disclosure-guidelines) |

What is new and useful is small, and it sits round the garments, not in place of them: cloth-fit and the
weight-transfer code for fitting, PBRify_Remix for fabric maps, Godot's own spring bones (since 4.4) for hems that
swing, and TRELLIS.2 for accessories no library has, at 15 to 60 minutes of clean-up for a bag, a hat or a pendant
(the note's estimate; nothing was measured). The October research on sewing patterns needs three corrections.
ContourCraft-CG does not sew patterns; it moves garments that are already draped, on SMPL-X bodies. Newton has left
beta (1.0.0 on 2026-03-10), but its basic cloth solver has no self-collision. And two Apache-2.0 simulators with real
stitching, ZOZO's and libuipc, were missed. Its conclusion stands: every pattern generator still ends at the draping
step you removed ([mesh_generators.md](clothing_v2/mesh_generators.md),
[sewing_patterns.md](clothing_v2/sewing_patterns.md)).

## One free library is a system: 185 CC0 pieces, 277 more under CC-BY

Good, free, already-designed everyday clothing exists in one place: the MakeHuman community's garments. What makes it
a system and not a pile of models is that every garment is tied to the same base body by the same small text file.
That file (`.mhclo`) places each point of the garment on three points of MakeHuman's body plus an offset
([MPFB2 clothes service](https://github.com/makehumancommunity/mpfb2/blob/HEAD/docs/services/clothesservice.md)). So
the work to fit one garment to MHR is the work to fit all of them.

The licences are clean, with care. MakeHuman's own assets are CC0, a public-domain dedication with no conditions, and
its team "makes no claim whatsoever over output"
([MPFB2 LICENSE.md](https://github.com/makehumancommunity/mpfb2/blob/HEAD/LICENSE.md)). Community garments are CC0
or CC-BY, file by file, and the official packs sort them into all-CC0 and all-CC-BY zips. About 42 of the CC0
garments are modern everyday wear, beside 8 formal suits and about 16 pairs of ordinary shoes; the CC-BY tier is the
broader and better-looking wardrobe. The counts below are from the pack pages
([packs index](https://github.com/makehumancommunity/makehuman-static-website/blob/HEAD/content/Assets/AssetPacks/_index.md)).

| Kind | CC0 (ships under your rule today) | CC-BY (ships with a credit) |
|---|---|---|
| T-shirts, tops, shirts, blouses | 9 (8 tees and tops, a polo) | 26 (19 tees and tops; a shirt with a tie, striped and untucked shirts, blouses) |
| Sweaters, jackets, cardigans, coats | 1 sweater; no jacket as a separate piece | 7 (3 sweaters, a hooded jacket, a long cardigan, a lusekofta cardigan, a winter coat) |
| Jeans, trousers, shorts | 4 (cargo, wool and harem trousers; one pair of shorts or trunks) | 21 (bootcut, straight, tight and classic jeans, trousers, flares; 8 shorts and trunks) |
| Skirts | 6 | 14 |
| Dresses | 13 | 42 |
| Suits | 8 formal | 1 |
| Whole outfits in one mesh | 12 (tee and jeans, jacket and jeans, suit and tie, blouse and skirt, sportswear, dungarees) | 0 |
| Uniforms, workwear, sportswear | 0 | about 13 (emergency-service jackets and trousers, coveralls, a tracksuit, a tennis dress) |
| Costume, fantasy, sci-fi | 24 | about 11 |
| Underwear, hosiery, socks, swimwear | 23 | 39 |
| Shoes and boots | 29 (about 16 everyday) | 36 (sneakers, oxfords, monk straps, flats, sandals, 12 boots) |
| **Garments and shoes** | **129** | **210** |
| Accessories | 56 (14 hats, 9 gloves, 10 glasses, 14 jewellery, 9 masks) | 67 (27 hats, 5 glasses, 31 jewellery, 4 masks), plus 6 bags, cases and vests |

Quality is honest mid-range. These are 2010s community work: **1,300 to 11,000 four-sided faces a garment,
2,048-pixel textures in every file read, normal maps on about 60%**, measured from 53 garments' meshes and 33 of
their materials
([community garments](https://github.com/k3yg4n/glamcam-makehuman-clothing-assets/tree/HEAD/finalized_clothes),
[system clothes](https://github.com/dmaugis/makehuman-py3-assets/tree/HEAD/base/clothes)). They have what the tailor
cannot draw: modelled collars, lapels, plackets, pockets, ties and waistbands. They are far coarser than the tailor's
25,000 to 165,000 triangles, and were made to be subdivided once (every face split in four and rounded).

Three warnings come with it. First, **the label on a pack's page and the licence inside a file sometimes disagree**.
In those same 33 community garments, four older ones say AGPL in their header, and a garment of the same name as one
of them is listed as CC0 on its pack page. MakeHuman's own reader reads a correctly spelled AGPL line as CC0. An
importer has to read each header itself; one independent project that does lists 94 CC0 wearables, not 185
([Hats 01 page](https://github.com/makehumancommunity/makehuman-static-website/blob/HEAD/content/Assets/AssetPacks/hats01.md),
[format notes](https://github.com/makehumancommunity/mpfb2/blob/HEAD/docs/fileformats/mhclo.md),
[vrm-avatar-maker](https://github.com/ffunch/vrm-avatar-maker/blob/HEAD/ASSETS.md)). Second, **the source is
fragile**. The community's forum and asset site went down on 2026-10-21 and the forum closed for good on 2026-11-08.
The packs were not affected and sit on two file servers, about 0.8 GB for the CC0 clothing and 1.7 GB for the CC-BY
([news 2026-10-21](https://github.com/makehumancommunity/makehuman-static-website/blob/HEAD/content/news/2026-10-21-community-site-shut-down.md)).
Download and keep them now. Third, **a licence tag does not clear someone else's mark**: leave out the tees with the
MakeHuman logo, fan costumes of film and anime characters, sneakers that copy real brands, and a cap with a political
slogan.

Every other source found is stylised, tiny, closed, paid, or a hunt for one model at a time. Some were not researched
at all, because the search budget ran out before your third message: itch.io's CC0 packs, Fab's free content,
CGTrader's and TurboSquid's free models, garment files for CLO and Marvelous Designer, Hugging Face, and Blender
Studio's film assets. Each could hold better-looking modern garments, under credit or royalty-free terms at best
([tools_and_assets.md](clothing_v2/tools_and_assets.md)).

| Source | Licence | What it has | Verdict | Source |
|---|---|---|---|---|
| Style3D's uploads on Sketchfab | CC Attribution on some pages, none shown on others (via search summary) | Modern East Asian ready-to-wear; count unknown | The best second source; one model at a time, by hand | [example](https://sketchfab.com/3d-models/sweatshirt-and-jacket-and-workwear-pants-ceabc26ccd8a48ed9dea753c6f7bcd2e) |
| Poly Haven | CC0 (at source) | No garments; scanned footwear, gloves, headwear, bags; 8K fabric scans | For accessories and fabrics | [terms](https://github.com/Poly-Haven/Public-API/blob/HEAD/ToS.md), [categories](https://github.com/Poly-Haven/Public-API/blob/HEAD/taxonomy.json) |
| BlenderKit, Sketchfab's CC0 filter | Per model (via search summary) | Unknown: their sites could not be reached | A hunt, each model checked by hand | [BlenderKit](https://www.blenderkit.com/docs/licenses/) |
| Quaternius, Kenney, OverScore Proxy | CC0 (via search summary) | Medieval outfits; texture skins; 315 low-poly pieces | Wrong style | [Quaternius](https://quaternius.itch.io/modular-character-outfits-fantasy), [OverScore](https://opengameart.org/content/overscore-proxy-modular-low-poly-female-character-creation-set) |
| VRoid | Commercial use allowed (via search summary) | Anime clothes | Wrong style; its app has no Linux version | [guidelines](https://vroid.com/en/studio/guidelines) |
| MetaHuman outfits | Unreal's licence; free under $1 million a year (via search summary) | High-quality outfits by Epic | Need the Unreal editor you removed | [CG Channel](https://www.cgchannel.com/2025/06/you-can-now-sell-metahumans-or-use-them-in-unity-or-godot/) |
| Daz; Ready Player Me | A paid licence per product for any game; shut down on 2026-01-31 (both via search summary) | Very large; nothing now | Not free; gone | [Daz](https://www.daz3d.com/daz-licenses), [Wikipedia](https://en.wikipedia.org/wiki/Ready_Player_Me) |
| Research datasets | Non-commercial where a licence could be read | Thousands of garments | Cannot ship | [DeepFashion3D](https://github.com/GAP-LAB-CUHK-SZ/deepFashion3D/blob/HEAD/LICENSE), [GarmageNet](https://github.com/Style3D/garmagenet-impl/blob/HEAD/LICENSE) |

## One four-second alignment carried 48 garments onto your bodies

This part is first-hand, and it outranks every estimate in the other notes. A first version of the fit was written
and run in this session on real MakeHuman garments and the Character Studio's own seven test bodies
([fit_test.md](clothing_v2/fit_test.md)). It is a prototype: five small scripts in
[`clothing_v2/proto/`](clothing_v2/proto/), with no check of their own and nothing wired into the Character Studio.

The method has three stages. **Once, the two bodies are lined up.** MHR is posed to match MakeHuman's base body
(their rest poses differ by 4° to 16° at the limbs). MakeHuman's body is stretched so that 20 of its joints land on
MHR's (MHR's forearms are 19% longer). Then each point of its skin is pulled onto MHR's skin, over twenty rounds.
**90.8% of its skin points end on MHR's skin**; the rest are inside the mouth, the eye sockets, the toes and between
the fingers, where nothing is worn. This takes 4.1 seconds. **Once per garment, the garment is carried across.** It
is rebuilt on MakeHuman's body from its binding file, each of its points follows the blended movement of the 24 skin
points nearest it, and the pose is taken back off with MHR's own bone weights. The garment now sits on MHR's average
body at rest. **Once per character, the garment follows the body.** Every MHR body is the same mesh with its points
moved, so how the skin moved from the average body to this one is known exactly, and the garment follows it. Points
left inside the skin, or nearer to it than 3 mm, are pushed out to 3 mm and their neighbours eased with them. One
lesson came out of the first run: the mesh file that comes with a garment is whatever body its author modelled on,
and using it put the sleeves beside the arms. The binding is the truth, not the mesh.

| What the test asked | Result | Where to look |
|---|---|---|
| Does one alignment serve every garment? | Yes. 48 garments (14 CC0 system pieces, 34 community ones): jackets, a coat, shirts, sweaters, trousers, skirts, thirteen dresses, two suits, an office blouse and skirt, overalls, shoes, a hat, a handbag. None failed, and nothing was adjusted by hand | [`fit_catalogue.jpg`](clothing_v2/fit_catalogue.jpg): 34 of them, each alone on the average body; [`fit_dresses.jpg`](clothing_v2/fit_dresses.jpg): eleven more on the feminine body |
| Does the design survive? | Yes. Pockets, plackets, buttons, yokes, collars and the authors' textures arrive intact | [`fit_first.jpg`](clothing_v2/fit_first.jpg): a denim jacket, a tee and trousers on the average and feminine bodies, from the front, three-quarter and back |
| Does it hold across bodies? | On the slim and average ones, yes; on the full ones the cloth arrives but clings (below). Every garment was fitted on at least one body, fifteen on two to five, and all seven test bodies were used | [`fit_bodies.jpg`](clothing_v2/fit_bodies.jpg): the CC0 suit on the masculine, slim and full masculine bodies, a skirt and sweater on the feminine, slim and full feminine ones; [`fit_cc0_office.jpg`](clothing_v2/fit_cc0_office.jpg) |
| Is it fast enough to refit when a slider moves? | Yes. 0.36 s once per body, then 0.12 to 0.34 s a garment, on a CPU. **CloV2 as recommended needs no VRAM** | The numbers in `fit_test.md` §4 |
| Does the cloth stay off the skin? | After the push-out, yes. A garment's typical distance off the skin (its median) runs from 4.5 mm (the office blouse) to 56 mm (a halter dress), and no point sits under 2.4 mm but a few at edges. Before it, 0.2% to 39% of a garment's points dipped in | `fit_cc0_office.jpg`: the tightest garment |
| Is the skin under a garment left out? | Yes: the author's own list of hidden skin is carried through the alignment, as your export does for the tailor's clothes | `fit_test.md` §3 |
| Do your fabrics and decals go on? | Yes (next section) | [`fit_refabric.jpg`](clothing_v2/fit_refabric.jpg) |

| What it did not prove | What was seen | What closes it |
|---|---|---|
| Two garments worn together | They crossed in the first test: a sweater through a coat in large patches, a skirt through a jacket's back, a skirt's waistband through a sweater's hem ([`fit_styles.jpg`](clothing_v2/fit_styles.jpg), rows 3 and 1; `fit_bodies.jpg`, right). **Closed in the prototype since** (`fit_test.md` §7, [`layers_before_after.jpg`](clothing_v2/layers_before_after.jpg)): a layer for each garment, each set outside the ones under it, and what a layer covers not drawn | Move `proto/layers.py` into the Character Studio with its check; walk it |
| Heavy bodies, and skirts between the legs | A suit follows a full belly's folds and a skirt dips between full thighs: [`fit_bodies.jpg`](clothing_v2/fit_bodies.jpg), the bottom row on each side. The sweater and tees also cling to the average body's belly (`fit_catalogue.jpg`), and a pleated skirt's back hem dips between the legs (`fit_styles.jpg`, row 1, back view) | Lay loose garments across the body's hollows instead of into them, as the tailor's bridging does; hang skirts on rings |
| Smooth edges | Collars and hems are angular close up. The garments are a few thousand faces, drawn as they come | Subdivide each once, as they were made to be |
| Fabric direction | The plaid turns from one panel to the next: `fit_refabric.jpg` | Turn each piece so the weave runs down the body or along the limb |
| Shoes | They were bent like cloth, so a sole can curve with the foot | Carry each shoe as a rigid piece |
| Motion | Nothing was skinned and walked | The tailor's `weights.js` and `motion.mjs` |
| The look in the game | The fit's pictures were drawn by three.js in a headless browser. Since then one layered outfit was exported as a .glb and drawn by Godot 4.7 with the layers' dissolve ([`layers_godot.jpg`](clothing_v2/layers_godot.jpg)); nothing yet on the look plugin's shaders or under the VHS filter | The Character Studio's export writing the same data, and a look check |
| Other libraries | A garment that is not in MakeHuman's format has no base body to line up | A placement step first, then the same fit |

Three points from the wider reading shape the real build ([fit_and_skin.md](clothing_v2/fit_and_skin.md)). Nobody was
found who has carried MakeHuman's clothes onto another body; the search budget had run out, so that is "none found",
not "none exists". Two MIT-licensed browser tools already fit these garments in three.js and hide the skin under
them, and are good reading ([HumanGenWeb](https://github.com/NastyFFM/HumanGenWeb),
[vrm-avatar-maker](https://github.com/ffunch/vrm-avatar-maker)). And skirts are where you have an edge: the other
free fitters have no cloth solver and simply warp a skirt, while the tailor can pin its waistband and let the rest
hang over this body's hips.

Motion is the largest unknown. A garment takes the body's bone weights through its binding, which is MakeHuman's own
rule. Where cloth stands off the body, a better method fills the weights in along the garment's own surface, so a
sleeve never takes the ribs' weights; its reference code is MIT
([weight transfer](https://github.com/rin-23/RobustSkinWeightsTransferCode/blob/HEAD/README.md)). A skirt in the game
needs bones of its own, because your clothes are skinned and never simulated. Godot's spring bones do this since 4.4:
a skirt of 8 chains by 3 joints is 24 moving bones (the note's estimate), inside the 64 that VRChat rates "Good" (via
search summary)
([SpringBoneSimulator3D](https://github.com/godotengine/godot/blob/4.7.2-stable/doc/classes/SpringBoneSimulator3D.xml),
[VRChat](https://creators.vrchat.com/avatars/avatar-performance-ranking-system/)).

## Your fabrics and decals go on through a second UV map

The test dressed the library's denim jacket in the tailor's own plaid flannel at real size, put your print
`varsity_tokyo.png` on its back and recoloured the tee under it ([`fit_refabric.jpg`](clothing_v2/fit_refabric.jpg)).
Three small steps did it. **A second UV map in metres** was made from the garment's own, to do the job the tailor's
fabric coordinates do: each connected piece of the author's map (the jacket has 52) is scaled until its area matches
the cloth's real area, so a tileable fabric lies at its true size. **The garment's own detail was kept**: its colour
texture divided by a blurred copy of itself leaves the seams, stitches, folds and wear as a layer over whatever
fabric goes underneath, and its normal map stays. **The decal was projected** straight onto the garment from behind
and drawn only on the faces that look back at it.

The real build adds four things, all plain geometry in your own page ([fit_and_skin.md](clothing_v2/fit_and_skin.md),
§4). Turn each piece so the weave runs down the body on the torso and along the limb on sleeves and legs. Keep the
author's UV map for anything baked (decals, creases, shading) and use the metre one only for the fabric. Bake decals
into the garment's texture in the rest pose, as the tailor bakes its prints; Godot's own Decal node projects a box in
space, so by its documentation it would not follow skinned cloth as it bends (an inference, untested)
([Godot decals](https://github.com/godotengine/godot-docs/blob/HEAD/tutorials/3d/using_decals.rst)). And store a
decal as data (its spot on the garment, its turn, its size in metres), so it survives a refit to another body.

Two traps come with other people's garments. **Some authors' UV maps overlap or mirror** (3 of the 14 measured), so
a decal would print twice. There, make a fresh map with xatlas (MIT, for Python and for the browser), or keep the
decal as a thin patch of mesh, which three.js already builds
([xatlas](https://github.com/jpcy/xatlas/blob/HEAD/README.md),
[DecalGeometry](https://github.com/mrdoob/three.js/blob/HEAD/examples/jsm/geometries/DecalGeometry.js)). **The
authors' textures have light painted into them**, and roughness maps are rare, so re-dressing a garment with a shelf
set is what brings it into your look. A 20 cm chest print on a 2K texture that covers about a metre of cloth gets
about 400 pixels across (the note's arithmetic); a garment with fine print wants a 4K bake or a mesh patch.

Fabric is where free is rich. Your shelf already takes ambientCG's sets, and Poly Haven adds 8K scans sorted by
textile type under CC0, verified at source ([terms](https://github.com/Poly-Haven/Public-API/blob/HEAD/ToS.md)). For
a fabric from your own photo, the clean route is a flat swatch made to tile, then **PBRify_Remix** (CC0) or DeepBump
(a GPL tool, on the CPU) for its normal and roughness maps; both guess relief from colour, and neither removes baked
light ([PBRify_Remix](https://github.com/Kim2091/PBRify_Remix/blob/HEAD/README.md)). In Godot the standard material
already blends a detail layer on the second UV map for colour and normal; roughness needs your own shader, which you
have ([BaseMaterial3D](https://github.com/godotengine/godot/blob/4.7.2-stable/doc/classes/BaseMaterial3D.xml)).

## Suits and uniforms are covered; sailor collars, hanbok and kimono are not

The free library covers the plain half of your fourth request well, and the specifically Japanese and Korean half not
at all ([korean_japanese.md](clothing_v2/korean_japanese.md)).

| Kind | Free under CC0 | Free under CC-BY (a credit) |
|---|---|---|
| Suits | 8 by one author: a women's skirt suit, two women's trouser suits, men's single and double-breasted suits, one with a tie, a dinner jacket, one with a bow tie. Plus the two system suits the test fitted | 1 men's suit |
| Smart casual | A polo, a fisherman's sweater, wool and cargo trousers, tees; flats, cloth mary janes, T-bar shoes, ankle boots | A shirt with a tie, a button-down, a striped shirt, a long cardigan, two knitted sweaters, a hooded jacket; trousers and jeans; a pencil skirt; oxfords, monk straps, saddle shoes; a belted winter coat; outside the packs, a denim jacket |
| Dresses | 13: a shift dress, a keyhole dress, a cut-out dress, halter, tiered and ruffled ones, a flapper dress | 42: eleven sheath, office and evening dresses by one author, a cocktail dress, an evening gown, a qipao, many halter dresses |
| Uniforms | None | Emergency-service jackets and trousers, coveralls, a tracksuit, sports wear; outside the packs, a train driver's uniform jacket |
| Pieces for a school uniform | Two plaid miniskirts, stockings, T-bar shoes | Three more pleated plaid skirts, the shirt with a tie, the cardigan, saddle shoes, mary janes, the uniform jacket |

Missing for the looks you named: a sailor collar top, a gakuran's stand-collar jacket, a school blazer with a crest,
ribbons and bow ties, loafers, a hanbok, a kimono, a yukata, and the modern Korean cut of an oversized blazer over
wide slacks. There is a qipao, and a bathrobe named kimono.

The best lead outside the library is **Style3D's free garments on Sketchfab**. Style3D makes a professional garment
design tool and publishes garments made in it: several Japanese school uniforms, business suits for women and men, a
vest and pleated skirt suit, dresses and coats
([JK School Uniform](https://sketchfab.com/3d-models/jk-school-uniform-3eb53d4915ed49da94a4edd983e73d48),
[JK School Uniform 4](https://sketchfab.com/3d-models/jk-school-uniform-4-887e3a1705f040bc91597e1fad47a7c0),
[black business suit set](https://sketchfab.com/3d-models/black-business-suit-set-3d61d6d1a6bc400898709f0a92ac9105),
[man's black business suit](https://sketchfab.com/3d-models/man-black-business-suit-7a669a06fb954d459985ccaa98672177)).
**Everything about them here is via search summary and has to be confirmed on each page.** The summaries show CC
Attribution for JK School Uniform 4, the dresses and a jacket coat. They show no licence for the first uniform or the
suits, and one suit page's footer names another publisher. The garments are heavy as published (about 158,500
triangles for one uniform, 836,500 for one suit set) and come without the body they were draped on, so each needs
thinning and the placement step the test did not cover. Each download is done by hand, with a free Sketchfab account.

The other leads are weaker, and all of them are via search summary. The same uniforms on CGTrader are under a
"Royalty Free No AI License", not Creative Commons
([CGTrader](https://www.cgtrader.com/free-3d-models/character/clothing/jk-suit)). VRoid's school set is free and may
be used commercially, but it is anime-styled and made in a Windows and macOS app
([VRoid](https://vroid.com/en/studio/guidelines)). **No free hanbok, kimono or yukata was found under CC0 or CC-BY**;
paid ones start at about $10 a garment. Until one is brought in, the tailor's own jeogori, chima and hanbok designs
remain the only Korean garments you have.

What can be had today is the silhouette. [`fit_styles.jpg`](clothing_v2/fit_styles.jpg) shows four looks put together
from library pieces in the tailor's fabrics: a blazer-type school uniform (a navy uniform jacket, a grey and navy
plaid pleated skirt, black shoes and socks), a gakuran-like black set, a camel coat over a cream sweater, and the CC0
men's suit as it comes. The note judges that the uniform reads as one at the player's distance. It lacks a shirt
collar and a ribbon, a crest (a decal would do) and a shorter jacket, and the "gakuran" has a turn-down collar where
a real one stands. For dresses and office wear as they come, [`fit_dresses.jpg`](clothing_v2/fit_dresses.jpg) shows
seven of the library's dresses fitted on the feminine body: the checked sheath dress with three-quarter sleeves is the
office look, beside a black day dress, a summer dress, a halter dress, an evening gown and a cocktail dress (all
CC-BY), with a handbag that came across the same way.

## CloV2 is a wardrobe tab built mostly from parts you already own

CloV2 would be a second tab beside Clothes: cards with pictures sorted by kind, a click to wear a garment over or
under the tailor's, and the same fabric, PBR, colour and print controls for its look. It is built from four things.
The **library**: MakeHuman's packs, fetched, with a ledger of each garment's author and licence. The **fit**: the
prototype, moved into the Character Studio. The **tailor's own parts**, reused: its layering, bridging, cloth solver,
weights, hidden skin, fabrics and print bake. And three small permissive libraries where needed: xatlas for UV maps,
the weight-transfer code, three.js's decal builder. Nothing in it comes from AI research code, and nothing in it
needs the graphics card.

The order below puts the cheapest proof first. Sizes are estimates, not measurements: small is a day or two, medium
a few days, large a week or more. Where a note gave days, they are quoted. The best measure of pace is that the
prototype behind steps 1, 2 and part of 6 was written and run inside this one research session.

| Step | What you get | Built from | Rough size |
|---|---|---|---|
| 1. Keep the files and read them | The packs on disk before the source gets worse; each garment's author and licence read from its own header; a refuse-list for logos and fan costumes | The test's reader; the ledger your CC0 prop library keeps | Small. The notes: 1 to 2 days |
| 2. Move the fit into the Character Studio | Any library garment on any character, refitted when the body changes, with a check on the seven test bodies | `proto/register.py` and `proto/fit.py` | Medium. The notes guessed 2 to 4 days for the alignment before the prototype existed |
| 3. Walk it, and look at it in Godot | The go or no-go: one outfit on two bodies walking, sitting and crouching, then in a level under the VHS filter at 1 to 2 m | The tailor's `weights.js` and `motion.mjs`; the Character Studio's export | Small (my estimate) |
| 4. Layers, heavy bodies, smooth edges | A coat over a sweater, a library jacket over a tailor tee, suits that span a belly, smooth collars, flat soles, buttons that stay round | The layers as the prototype now has them (`proto/layers.py`, `fit_test.md` §7), moved over with their check; the tailor's bridging; one subdivision; rigid carry for shoes and small parts | Medium (my estimate; the notes give none); the layers' rules are settled, so less than it was |
| 5. The tab | Cards, wearing with the tailor's garments, saving with the character, export with weights and hidden skin | The Clothes tab's cards and the wardrobe page | Medium (my estimate) |
| 6. Your fabrics and decals | Any shelf set at real size with the weave turned right, the garment's seams kept, PNG decals placed and baked, a credits list written by itself | The test's three steps; the tailor's print bake; xatlas | Medium. The notes: 2 to 3 days for the metre UV map, 1 for overlapping ones, 1 for projected decals |
| 7. What hangs | Skirts, dresses and coat skirts hung over this body's hips; hems that swing in the game | The tailor's cloth solver and skirt rings; Godot's spring bones | Large (my estimate), and the least certain |
| 8. A second source | Style3D's uniforms and suits, or any pack you buy later | Thinning; placement by a few landmarks; then steps 2 to 6 | Medium for the placement step (my estimate), then minutes a garment (the note's reading, not measured) |
| 9. Extras | An accessory from your own photo or drawing; a fabric from your own photo | TRELLIS.2 with its export fixed; PBRify_Remix | Not sized; only if you want them |

The tailor keeps everything that fits by construction or exists nowhere else: underwear, socks, tights and other
skin-tight layers; shoes that bend at the toes; belts lifted off any waist; and your hanbok, smart casual and
designer collections ([TAILOR.md](../TAILOR.md), §1f and §2). It also keeps any garment you want to re-cut. A library
garment grows with the body, like made-to-measure, but its hem, neckline and sleeve length are fixed: it has no cut
lines to drag (my reading; the notes do not test it). And the tailor becomes CloV2's engine room: its cover heights
make layers work, its solver hangs imported skirts, and its creases and weights serve both. In CloV2, "lots of
options" comes from many garments times your fabrics, colours and decals, not from sliders.

Three decisions are yours alone, and two smaller ones follow from them. One is where the garments live: the test
kept MakeHuman's files out of the repo and fetched them, which is how your CC0 prop library works too (its index in
git, its files fetched, a ledger of where each came from). The other is whether you want generated accessories at
all, given that nobody owns them and Steam asks for them to be declared.

| Decision | What each answer gives | What the research can tell you |
|---|---|---|
| **May CC-BY garments ship, with a credits screen?** | Yes: 210 more garments and shoes and 67 accessories, among them nearly all the jeans, shirts and jackets, the coat, the uniforms and 42 of the 55 dresses, plus Style3D's garments. No: 129 garments and shoes and 56 accessories by the pack pages, fewer once each file's own header is checked (one project's strict list has 94), and thin on jackets, shirts and jeans | Your standing rule is "assets are CC0 or ours". MakeHuman's own advice for a closed game is a credit in "an 'about' or 'legal info' menu entry or popup box" ([FAQ](https://github.com/makehumancommunity/makehuman-static-website/blob/HEAD/old_data/OldSite/FAQ/what_do_i_need_to_do_when_i_use_a_ccby_asset.md)). Each file's header names its author and licence, so the list can be generated. The licence text itself was not opened in this session, and files differ between CC BY 3.0 and 4.0. The test pictures beside the notes already show CC-BY garments, credited in `fit_test.md` §6 |
| **Open the blocked hosts, or download by hand?** | Open them: the assistant fetches, checks and indexes about 2.5 GB of packs itself. By hand: you download the zips on your machine and drop them in a folder. Sketchfab needs your own account either way | The packs sit on `files.makehumancommunity.org` and `files2.makehumancommunity.org`, which this session could not reach. GitHub holds only the 20 CC0 system pieces as a release (how the test got them) and a few small collections. The community's site went dark three weeks ago, so do this first |
| **Which garments first?** | A suggestion, one outfit of each kind you asked for, from pieces the test already fitted: the CC0 men's suit and the CC0 blouse and skirt; the school uniform of `fit_styles.jpg` (the uniform jacket and pleated skirt, then a shirt with a tie and saddle shoes); a smart casual set (denim jacket, knitted sweater, trousers, winter coat); then the CC0 suits and dresses packs. After those, one Style3D uniform as the test of a second source | Apart from the CC0 suit, blouse and skirt and the CC0 packs, everything in that list is CC-BY, so it follows the first decision. The eight CC0 suits and thirteen CC0 dresses were counted from pack pages, not downloaded or fitted; six of the CC-BY dresses were fitted (`fit_dresses.jpg`) |

## Conclusion

The scarce thing was never a generator. It was a wardrobe whose every piece is tied to one known body, because MHR's
single mesh turns any such wardrobe into a one-time alignment. That changes how to judge every future source, free or
bought: ask first whether a garment comes with the body or the binding it was made on. MakeHuman's does, which is why
48 garments cost one four-second alignment; Style3D's does not, which is why each of its garments will cost hand
work. It also changes what the tailor is for. The library brings dresses, coats, tailored jackets and bags, which the
tailor finds awkward or cannot make; the tailor brings skin-tight layers, hanbok, shapes you can re-cut, and the
layering and hanging rules the library has none of. CloV2 is less a second clothing system than a second source of
cloth for the one you have.

The risk has moved. Whether someone else's garment would land on your bodies at all is answered. Whether it holds up
walking, sitting and under the VHS filter at 1 to 2 m is not, and finding out is a small job, which is why it comes
before any tab is built. The other risk is not technical: a community site that went dark in October, licence labels
that have to be read file by file, and a rule of yours that decides whether the wardrobe has 185 pieces or about 460.
