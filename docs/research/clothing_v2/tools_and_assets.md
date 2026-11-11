# Ready-made clothing we could ship, and the free tools round it, 2024 to 2026 (outside AI research code)

Research date 2026-11-11. The question this note answers first, after the user's steer ("I'd rather have better
already-designed clothing with lots of options than generating crappy clothing"): **where can the studio get many good,
already-designed, realistic everyday garments for free, under a licence that lets them ship inside a sold game?** The
sources are sorted in two tiers: (1) CC0 or equivalent, which ships under the studio's rule as it stands; (2) free with
attribution or a royalty-free licence that allows games, with what the user would have to do. Authoring tools, pattern
sources, fabric libraries and datasets follow, kept short. Fitting methods belong to the note on refitting.

Network note. Only github.com (WebFetch, `git clone`) and gitlab.com (`git clone`) could be opened; codeberg.org answered
403 and static.makehumancommunity.org did not resolve.

- **Read at source** (shallow, blob-less clones; nothing was run), marked "(source)": the MakeHuman community website's
  sources `c80cd4e` 2026-11-08 (every asset pack page, its news, its FAQ); MPFB2 `6ff1eb3` 2026-10-24; MakeHuman
  `a8bc2d5`; MakeHuman 2; four GitHub repos that hold MakeHuman clothes as files (`Makehuman-2/MH2_Asset_Repository_CCO`
  2026-11-10, `ffunch/vrm-avatar-maker` 2026-11-10, `NastyFFM/HumanGenWeb` 2026-10-22,
  `k3yg4n/glamcam-makehuman-clothing-assets` 2026-02-02) and a 2018 mirror of the bundled assets
  (`dmaugis/makehuman-py3-assets`); CharMorph and its database; MB-Lab; BlenderKit's add-on; Poly Haven's Public-API
  repo; Objaverse-XL; Open Source Avatars; ZOZO's Contact Solver; Blender's GitHub mirror; Seams to Sewing Pattern and
  its fork; Modeling Cloth; FreeSewing's GitHub repo (the project moved to Codeberg, blocked); Seamly2D; Valentina; the
  dataset repos named in section 7.
- **Measured here from files in those repos** (read as data): triangle counts, UV islands and texel density of 14
  garments, quad counts of 53, texture sizes from PNG headers, and the official 256 px thumbnails of 339 clothing and
  accessory assets, viewed as contact sheets.
- **Via search summary**, marked "(search)": prices, vendors' terms, press coverage, library sizes, and everything about
  BlenderKit's terms, Sketchfab, OpenGameArt, Quaternius, Kenney, VRoid, Ready Player Me, MetaHuman, Daz, the texture
  sites, Marvelous Designer, CLO and Style3D. A search summary is weaker evidence than the page.
- **The session's web-search budget ran out before the steer arrived.** Not researched at all, and listed under Gaps:
  itch.io's CC0 packs, Fab's free content and licence, CGTrader and TurboSquid free models, CLO and Marvelous Designer
  garment files, Hugging Face, Blender Studio's film assets.

## 1. Ready-made everyday garments that can ship in a sold game: the sources, in two tiers

### Takeaway
There is one real answer, and it is the MakeHuman community's clothing. Under **CC0** its official asset packs hold 129
garments and shoes and 56 accessories; about 42 of the garments are modern everyday wear, beside 8 formal suits and
about 16 pairs of ordinary shoes. Under **CC-BY** they hold 210 more garments and shoes and 67 accessories, and that
tier is the broader and better-looking everyday wardrobe (jeans, trousers, shirts with ties, a hooded jacket, sweaters,
cardigans, a winter coat, EMT uniforms, oxfords, sneakers, boots). Every one is bound to the same base body by the
same ten-line formula, so one registration of that body to MHR
would fit all of them to any MHR character. They are 2010s community work (1,300 to 11,000 quads, 2048 px colour maps,
normal maps on about 60 %), not current game art. Every other CC0 source found is stylised, tiny, or a per-model hunt.

### Cited Findings
**Tier 1: CC0 or equivalent (ships under the rule as it stands)**

| Source | Licence: one for all, or per asset | Garments | Quality | Formats, and where the files are | Base body; UVs |
|---|---|---|---|---|---|
| **MakeHuman system assets** | One: "These assets have been released under CC0 1.0 Universal" | 12 whole outfits (tee or shirt and jeans, jacket and jeans, suit and tie, blouse and skirt, sportswear, dungarees), 6 pairs of shoes, 2 fedoras | Quads, 1,600 to 8,300 per outfit (3,200 to 16,700 triangles); colour, normal and AO maps (the one read is 2048 px); some tees carry the MakeHuman logo | `.mhclo` + `.obj` + `.mhmat` + `.png` in one zip (267 MB) on files.makehumancommunity.org and files2, linked directly with no login step; also as a GitHub release (405 MB) | `hm08`; one material and one UV layout per item |
| **MPFB2 asset packs marked CC0** | Per asset, listed on each pack's page; every pack is uniform (all CC0 or all CC-BY) | 111 garments and shoes in 10 packs, 54 accessories in 6 packs (breakdown in section 2) | As above for meshes; community textures | Zip per pack, `<pack>_cc0.zip`, 1.2 to 183 MB, same two servers, direct links | `hm08` |
| **MH2 Asset Repository (GitHub)** | "All assets in these packs are as listed CC0"; repo LICENSE is CC0 1.0 | The system kit again, a "crude kit" of plain base garments, a Viking set | As above | Zips as GitHub release assets | `hm08` |
| **vrm-avatar-maker (GitHub)** | Code MIT; "The avatar assets are CC0", each item's own files checked | 94 wearables on its CC0-checked list (a few are its own designs on CC0 garments): 35 outfits, 10 tops, 9 bottoms, 15 shoes, 15 hats, 10 glasses and masks | The same MakeHuman items, lightened for a 40,000-triangle avatar | Committed in the repo (`web/assets/`, `assets/parts/*.obj`); `git clone` | `hm08`, fitted in three.js |
| **HumanGenWeb (GitHub)** | "Mesh and targets come from MakeHuman / mpfb2 and are CC0. App code: MIT" | The 20 system clothes | Converted to JSON with WebP colour and normal maps, 2048 px at most | Committed in the repo (`data/proxies/clothes/`); `git clone` | `hm08`, fitted in three.js |
| Poly Haven | One: "our 3D assets themselves are published under the CC0 license" | No garments. Categories for footwear, gloves and workwear, safety gear, headwear, bags and luggage, eyewear | Photoscanned props | polyhaven.com and its free API; file formats not checked here | None (static props) |
| Quaternius | CC0 per pack | No modern garments: 12 medieval outfits in 62 parts, 6 base characters | Stylised, about 13k triangles a character | FBX, OBJ, Blend, glTF from quaternius.com and itch.io | Its own Universal Base Characters |
| Kenney | CC0 | None: characters change clothes by texture "skins" | Blocky or low-poly | Packs from kenney.nl (seen through OpenGameArt copies) | Its own |
| OpenGameArt, OverScore Proxy | CC0 for this set; OpenGameArt is per file | 315 clothing and accessory models for one low-poly female base | Low-poly, stylised | Download from the OpenGameArt page | Its own base |
| Open Source Avatars | Registry CC0; "individual avatars and collections have their own licenses" | Whole VRM avatars, not garments | Stylised | VRM files linked from JSON in the repo | VRM humanoid |
| Sketchfab, CC0 filter | Per model | Unknown; the clothing found by search was CC-BY | Mixed | Download needs a Sketchfab login | Whatever the author used |
| BlenderKit, CC0 filter | Per asset: "Royalty Free" or "Creative Commons Zero" | Unknown | Mixed | Through BlenderKit's add-on or site | Whatever the author used |
| Smithsonian 3D | Listed CC0, but its file pages say "only for non-commercial, educational, and personal uses" | A handful of scanned museum garments | Photogrammetry of garments on stands | 3d.si.edu | None |

Sources for the table: [MPFB2 LICENSE.md](https://github.com/makehumancommunity/mpfb2/blob/HEAD/LICENSE.md),
[asset packs index](https://github.com/makehumancommunity/makehuman-static-website/blob/HEAD/content/Assets/AssetPacks/_index.md),
[system assets page](https://github.com/makehumancommunity/makehuman-static-website/blob/HEAD/content/Assets/AssetPacks/makehuman_system_assets.md),
[hugo.toml (file servers)](https://github.com/makehumancommunity/makehuman-static-website/blob/HEAD/hugo.toml),
[MH2_Asset_Repository_CCO](https://github.com/Makehuman-2/MH2_Asset_Repository_CCO),
[vrm-avatar-maker README](https://github.com/ffunch/vrm-avatar-maker) and
[ASSETS.md](https://github.com/ffunch/vrm-avatar-maker/blob/HEAD/ASSETS.md),
[HumanGenWeb README](https://github.com/NastyFFM/HumanGenWeb),
[Poly Haven ToS.md](https://github.com/Poly-Haven/Public-API/blob/HEAD/ToS.md) and
[taxonomy.json](https://github.com/Poly-Haven/Public-API/blob/HEAD/taxonomy.json),
[Open Source Avatars](https://github.com/ToxSam/open-source-avatars),
[BlenderKit add-on `__init__.py`](https://github.com/BlenderKit/BlenderKit/blob/HEAD/__init__.py) (all source);
[Quaternius outfits](https://quaternius.itch.io/modular-character-outfits-fantasy),
[Quaternius base characters](https://quaternius.com/packs/universalbasecharacters.html),
[Kenney, Animated Characters 2](https://opengameart.org/content/animated-characters-2),
[OverScore Proxy](https://opengameart.org/content/overscore-proxy-modular-low-poly-female-character-creation-set),
[Sketchfab licence filters](https://sketchfab.com/blogs/community/refine-downloadable-model-searches-with-new-license-filters),
[Sketchfab download API guidelines](https://api.sketchfab.com/developers/download-api/guidelines),
[a Smithsonian dress record](https://3d.si.edu/object/3d/dress-1-piece:a1651b35-7019-4b92-9f98-58351f4aaf57) (all
search). The mesh and texture figures for the system assets were measured from
[the 2018 mirror's files](https://github.com/dmaugis/makehuman-py3-assets/tree/HEAD/base/clothes) (source).

**Tier 2: free, with attribution or a royalty-free licence that allows games**

| Source | Licence, and what the user would have to do | Garments | Quality | Where the files are | Base body |
|---|---|---|---|---|---|
| **MPFB2 asset packs marked CC-BY** | CC-BY 3.0 or 4.0 per asset (the version is in each file's header). MakeHuman's own summary: "tell end users of your work that you used the model in question, and who you got the model from"; in a closed-source game, in "an 'about' or 'legal info' menu entry or popup box"; a bundled README only "as a last resort". The licence text itself (which the FAQ links, and which was not opened here) governs changes and redistribution | 210 garments and shoes in 13 packs, 67 accessories in 5 packs, 21 props in 2 packs (breakdown in section 2) | The better half of the wardrobe; up to 65k triangles on a few dresses | Zip per pack, `<pack>_ccby.zip`, about 1.7 GB in all, same servers, direct links | `hm08` |
| **MakeHuman's user asset repository** | Per asset: "assets that come licensed in two forms: CC0 and CC-BY" (some old ones AGPL) | Everything in the packs and more; a total could not be counted | As the packs | The site went down on 2026-10-21; "the asset files as such are still online, they're just not browseable", listed in an `assets.json` on files.makehumancommunity.org | `hm08` |
| BlenderKit, Royalty Free | No credit needed; commercial use allowed; the asset may not be resold "in the same form"; in a game it "shouldn't be directly extractable" | Unknown how many garments | Mixed | BlenderKit's add-on or site | Various |
| Sketchfab, CC-BY | Credit the author and the licence | Unknown; Style3D publishes garments there under CC Attribution | Mixed; simulation-grade meshes from pattern tools | Login to download | Various, often a fashion avatar |
| VRoid Studio presets, and BOOTH items | pixiv allows selling or commercial use of "any mesh, texture, or preset item provided by VRoid Studio" unless an item says otherwise; BOOTH items are licensed by each creator | VRoid's parametric clothes; XWear outfits on BOOTH | Anime style | VRoid Studio (Windows, macOS); booth.pm | VRoid body, VRM |
| MetaHuman clothing | Unreal Engine EULA: free under $1 million a year; use in other engines carries no royalty. Fab outfits are under each seller's terms | Epic's own outfits in MetaHuman Creator (not counted); more on Fab | High | Needs the Unreal editor | MetaHuman bodies |
| CharMorph | Antonia is CC-BY 3.0, Reom CC-BY, the MB-Lab characters AGPL3 | A bra and panties for Antonia; nothing else | Underwear only | GitHub | Its own |
| Daz | Not free: a paid Interactive License per product for any game use | Very large | High | Daz store; Windows or macOS | Genesis |

Sources: [asset packs index](https://github.com/makehumancommunity/makehuman-static-website/blob/HEAD/content/Assets/AssetPacks/_index.md),
[MakeHuman FAQ, using a CC-BY asset](https://github.com/makehumancommunity/makehuman-static-website/blob/HEAD/old_data/OldSite/FAQ/what_do_i_need_to_do_when_i_use_a_ccby_asset.md),
[news 2026-11-08](https://github.com/makehumancommunity/makehuman-static-website/blob/HEAD/content/news/2026-11-08-moving-to-discord.md),
[CharMorph-db](https://github.com/Upliner/CharMorph-db) (all source);
[BlenderKit licences](https://www.blenderkit.com/docs/licenses/),
[BlenderKit licensing FAQ](https://www.blenderkit.com/docs/licenses/licensing-faq/),
[a Style3D garment on Sketchfab](https://sketchfab.com/3d-models/sweatshirt-and-jacket-and-workwear-pants-ceabc26ccd8a48ed9dea753c6f7bcd2e),
[VRoid Studio guidelines](https://vroid.com/en/studio/guidelines),
[a BOOTH XWear item](https://booth.pm/ja/items/8785259),
[CG Channel on MetaHuman's licence](https://www.cgchannel.com/2025/06/you-can-now-sell-metahumans-or-use-them-in-unity-or-godot/),
[Daz licences](https://www.daz3d.com/daz-licenses) (all search).

**Gone, or not a source**
- Ready Player Me: acquired by Netflix in December 2025; its public services were shut down on 2026-01-31 (search) —
  [Wikipedia](https://en.wikipedia.org/wiki/Ready_Player_Me)
- MB-Lab: no clothes, and "the models must be distribuited under AGPL 3" (source) —
  [license.txt](https://github.com/animate1978/MB-Lab/blob/HEAD/license.txt)
- The official `makehumancommunity/makehuman-assets` repository that MakeHuman's own download script names now answers
  404 (source) — [download_assets_git.py](https://github.com/makehumancommunity/makehuman/blob/HEAD/makehuman/download_assets_git.py)
- Repository searches on GitHub for clothing libraries ("clothing 3d models cc0", "3d garment assets game ready clothing
  library", "mhclo clothes") returned nothing; "makehuman clothes" and "makehuman-assets" returned the repos in the
  tables above (source) — [a GitHub search](https://github.com/search?q=makehuman-assets&type=repositories)
- The studio's own CC0 library is no garment source: of the 900 Base Mesh entries its index lists, the wearable ones
  are a bow tie, glasses frames, three boots, an oven glove and a watch strap —
  `Content/Studio/Library/index/basemesh.json` (this repo)

### Inferences
- **Ranking for the user's ask** (many, good, already designed, free, shippable):
  1. **MakeHuman CC-BY packs**, if the user relaxes the rule to "CC0, ours, or credited CC-BY": the largest realistic
     everyday set found (210 garments and shoes), at the cost of one credits screen.
  2. **MakeHuman CC0 packs and system assets**: usable today, about 42 everyday garments plus formal suits, shoes and
     accessories; thin on jackets, shirts and jeans.
  3. **Poly Haven** for scanned accessories.
  4. Everything else is either not realistic (Quaternius, Kenney, OverScore, VRoid), not a library (Sketchfab,
     BlenderKit, Objaverse: one model at a time, each with its own provenance), closed (Ready Player Me), or not free
     (Daz).
- **"Good" needs an honest caveat.** These are designed garments with real construction (collars, lapels, plackets,
  pockets, ties, waistbands), which the tailor cannot draw. But they are low to mid resolution next to the tailor's 25k
  to 165k triangles, and their look is a decade old. At 1 to 2 m under the VHS filter, with the studio's own fabric
  sets over them, they should read as ordinary clothes; that is a judgement from thumbnails and numbers, not from a
  render.
- **One body makes this a system rather than a pile of models.** Every item in both tiers is bound to `hm08` by the
  same file format, so the work to fit one to MHR is the work to fit all of them (section 2).
- **Two browser tools already do this in the studio's own stack** (three.js, plain JavaScript, MIT): both fit
  MakeHuman clothes live and hide the skin under them, and HumanGenWeb hands weights down from the body. They are
  working references, and their repos (with the MH2 release zips and one small community repo) are where the clothes
  sit on GitHub as files.
- **Before shipping any CC0 item, check its own file header.** Pack pages and file headers sometimes disagree
  (section 2); the strict list is shorter than 185.

### Gaps
- **Not researched (the search budget ended before the steer):** itch.io's CC0 clothing packs; Fab's free content and
  what the Fab licence allows; CGTrader's and TurboSquid's free models and their royalty-free licences; free garment
  files for CLO and Marvelous Designer and their terms; clothing libraries on Hugging Face; Blender Studio's film
  characters (only its CC0 Human Base Meshes, which have no clothing, were confirmed). Each could hold better-looking
  modern garments than MakeHuman's, in tier 2 at best.
- How many garments BlenderKit and Sketchfab offer free, and under which of their licences, could not be counted (their
  sites and APIs were not reachable). Style3D's CC-BY uploads on Sketchfab are the lead most worth a look by hand.
- pixiv's full terms, Epic's EULA text and BlenderKit's licence text were not read; those rows rest on summaries.
- Whether Quaternius changed its licence for new packs (one guide mentions a "Quaternius Asset Licence") is unverified.

## 2. MakeHuman and MPFB2 in detail: licences, counts, where the files are, formats, quality, fitting

### Takeaway
The core assets are CC0 without conditions and the team claims nothing over output; community assets are CC0 or CC-BY,
asset by asset, and the official packs sort them into all-CC0 and all-CC-BY zips. The files are plain text and PNG
(`.mhclo`, `.obj`, `.mhmat`), downloadable without a login, and partly mirrored on GitHub. A garment is fitted by
placing each of its vertices on three vertices of the `hm08` base body plus an offset, which is why two MIT-licensed
browser tools can fit them in a few lines. The weak points are age, uneven quality, a fragile community site, and
licence labels that have to be checked in the file as well as on the page.

### Cited Findings
**Licences**
- MPFB2: code GPLv3; assets ("the base mesh and proxies, targets and modifiers, textures, clothes (any MHCLO-based
  asset), rigs, poses and expressions") "have been released under CC0 1.0 Universal"; and "the MakeHuman team makes no
  claim whatsoever over output" such as exports and saved model files: "We regard these things as your data" (source) —
  [MPFB2 LICENSE.md](https://github.com/makehumancommunity/mpfb2/blob/HEAD/LICENSE.md). MakeHuman: code AGPL, the same
  CC0 and output statements (source) — [MakeHuman LICENSE.md](https://github.com/makehumancommunity/makehuman/blob/HEAD/LICENSE.md)
- This dates from September 2020: before, "assets are per default covered by AGPL"; after, "assets are per default
  released as CC0" and "exports only consist of things which were CC0 to start with". Older copies still carry AGPL
  headers: the 2018 mirror's files say "This file is licensed AGPLv3" (source) —
  [FAQ, the 2020 change](https://github.com/makehumancommunity/makehuman-static-website/blob/HEAD/old_data/OldSite/FAQ/what_changed_regarding_the_license_in_2020.md),
  [a 2018 `.mhclo`](https://github.com/dmaugis/makehuman-py3-assets/blob/HEAD/base/clothes/male_casualsuit01/male_casualsuit01.mhclo)
- "MakeHuman as such only includes CC0 assets. However ... it does not apply to assets you downloaded separately from
  the user contributed asset respositories. In those repositories, you will find assets that come licensed in two
  forms: CC0 and CC-BY" (source) —
  [FAQ, CC-BY](https://github.com/makehumancommunity/makehuman-static-website/blob/HEAD/old_data/OldSite/FAQ/what_do_i_need_to_do_when_i_use_a_ccby_asset.md)
- MakeClothes offers an author three licences: CC0, CC-BY, and AGPL ("don't use unless absolutely necessary") (source) —
  [license.json](https://github.com/makehumancommunity/mpfb2/blob/HEAD/src/mpfb/ui/create_assets/makeclothes/objectproperties/license.json)
- **Page and file can disagree.** In a repo of 33 community assets as downloaded, the headers read "CC BY 3.0", "CC BY
  4.0", "CC-BY", "CC0", and on four older ones "AGPL3". An asset of the same name as one of those four, the "bag on
  head", is listed as CC0 on the Hats 01 pack page; another, the Mars suit, as CC-BY on Suits 03 (source) —
  [the asset files](https://github.com/k3yg4n/glamcam-makehuman-clothing-assets/tree/HEAD/finalized_clothes),
  [hats01](https://github.com/makehumancommunity/makehuman-static-website/blob/HEAD/content/Assets/AssetPacks/hats01.md).
  An independent project warns of the same: "Only use items whose own `.mhclo`/`.mhmat` header says CC0: some packs
  labelled CC0 contain items under other licenses" (source) — [vrm-avatar-maker README](https://github.com/ffunch/vrm-avatar-maker)
- MPFB's own reader is no help: it defaults to CC0 and, by a documented defect, reads a correctly spelled
  `# license AGPL3` as CC0 (source) — [mhclo.md](https://github.com/makehumancommunity/mpfb2/blob/HEAD/docs/fileformats/mhclo.md)

**Counts, by kind** (counted from the pack pages; kinds assigned here from names and thumbnails) —
[asset packs index](https://github.com/makehumancommunity/makehuman-static-website/blob/HEAD/content/Assets/AssetPacks/_index.md) (source)

| Kind | CC0 | CC-BY |
|---|---|---|
| T-shirts, tops, tanks | 8 | 19 |
| Shirts, blouses, polo | 1 (polo) | 7 (shirt and tie, untucked shirt, striped shirt, blouses) |
| Sweaters | 1 | 3 |
| Jackets, hoodies, cardigans, coats | 0 as separate items | 4 (hooded sweat jacket, long cardigan, lusekofta, winter coat) |
| Jeans, trousers | 3 (cargo, wool, harem) | 13 (bootcut and straight jeans, trousers, tight and classic jeans, flares) |
| Shorts, swim trunks | 1 | 8 |
| Skirts | 6 | 14 |
| Dresses | 13 | 42 |
| Suits (jacket with trousers or skirt) | 8 formal | 1 |
| Whole outfits in one mesh | 12 (system assets) | 0 |
| Uniforms, workwear, sportswear | 0 (dungarees are in the outfits) | about 13 (EMT jackets and trousers, coveralls, tracksuit, wetsuit, tennis dress) |
| Costume, fantasy, sci-fi suits | 24 | about 11 |
| Underwear, hosiery, socks, swimwear | 23 | 39 |
| Shoes and boots | 29 (about 16 everyday) | 36 (sneakers, oxfords, monk straps, flats, sandals, 12 boots) |
| **Garments and shoes** | **129** | **210** |
| Hats and helmets | 14 (cloche, newsboy cap, two fedoras, 6 helmets) | 27 (bowler, flat cap, trilby, beanies, patrol cap, 8 helmets) |
| Gloves | 9 (3 plain) | 0 |
| Glasses | 10 | 5 |
| Jewellery | 14 | 31 |
| Masks | 9 (one medical) | 4 (bandana, covid mask, plague doctor, gas mask) |
| Bags, cases, vests | 0 | 6 (suitcase, handbags, shopping bag, tactical vests; in Equipment 03) |
| **Accessories** | **56** | **67 + 6** |

- The CC0 packs with clothing: Dress 01 (13), Pants 01 (4), Shirts 01 (10), Skirts 01 (6), Suits 01 (8), Suits 02
  (21), Suits 05 (3), Underwear 01 (19), Underwear 04 (4), Shoes 01 (23), Gloves 01 (9), Hats 01 (6), Hats 02 (6),
  Glasses 01 (10), Jewelry 01 (14), Masks 01 (9), and the system assets (20 clothes). The CC-BY ones: Dress 02 (24),
  Dress 03 (19), Pants 02 (13), Pants 03 (8), Shirts 02 (13), Shirts 03 (19), Skirts 02 (14), Suits 03 (19), Suits 04
  (6), Underwear 02 (28), Underwear 03 (11), Shoes 02 (24), Shoes 03 (12), Hats 03 (19), Hats 04 (8), Glasses 02 (5),
  Jewelry 02 (31), Masks 02 (4), Equipment 03 (13). No pack mixes licences (source) —
  [pack pages](https://github.com/makehumancommunity/makehuman-static-website/tree/HEAD/content/Assets/AssetPacks)
- A stricter count: vrm-avatar-maker lists 94 wearables (a few of them its own makes), produced by a pipeline that
  "fails if any item's own files don't say CC0" (source) — [ASSETS.md](https://github.com/ffunch/vrm-avatar-maker/blob/HEAD/ASSETS.md)

**Where the files are**
- Packs are zips on two servers, `https://files2.makehumancommunity.org` and `https://files.makehumancommunity.org`,
  at `/asset_packs/<pack>/<pack>_cc0.zip` or `_ccby.zip`, linked directly from the pages; the system assets are
  `makehuman_system_assets_cc0.zip`, 267 MB (source) —
  [hugo.toml](https://github.com/makehumancommunity/makehuman-static-website/blob/HEAD/hugo.toml),
  [pants01](https://github.com/makehumancommunity/makehuman-static-website/blob/HEAD/content/Assets/AssetPacks/pants01.md)
- On GitHub as files: release zips in the MH2 repository (`mh_system_CC0.zip` 405 MB, `crude_kit_CC0.zip`,
  `RP_Viking_set_CC0.zip`); the 20 system clothes converted in HumanGenWeb; 94 CC0 wearables in vrm-avatar-maker; 33
  community assets with their original files in the glamcam repo (source) —
  [community_packs.json](https://github.com/Makehuman-2/MH2_Asset_Repository_CCO/blob/HEAD/community_packs.json),
  [HumanGenWeb data](https://github.com/NastyFFM/HumanGenWeb/tree/HEAD/data/proxies/clothes),
  [vrm-avatar-maker assets](https://github.com/ffunch/vrm-avatar-maker/tree/HEAD/assets/parts),
  [glamcam](https://github.com/k3yg4n/glamcam-makehuman-clothing-assets)
- The community's forum and user asset repository were taken down on 2026-10-21 as a security precaution; on
  2026-11-08 the forum was closed for good and the community moved to Discord. "The asset files as such are still
  online, they're just not browseable"; the asset packs "were unaffected" (source) —
  [news 2026-10-21](https://github.com/makehumancommunity/makehuman-static-website/blob/HEAD/content/news/2026-10-21-community-site-shut-down.md),
  [news 2026-11-08](https://github.com/makehumancommunity/makehuman-static-website/blob/HEAD/content/news/2026-11-08-moving-to-discord.md)
- MPFB2 itself is alive: a Blender extension (Blender 4.2 minimum), version 2.0.18 of 2026-10-10, 49th most downloaded
  extension in February 2026; it installs a pack from its zip and can be scripted (samples create a human, add assets,
  export FBX) (source) — [blender_manifest.toml](https://github.com/makehumancommunity/mpfb2/blob/HEAD/src/mpfb/blender_manifest.toml),
  [news 2026-02-14](https://github.com/makehumancommunity/makehuman-static-website/blob/HEAD/content/news/2026-02-14-mpfb-now-one-of-the-50-most-downloaded-extensions.md),
  [script_samples](https://github.com/makehumancommunity/mpfb2/tree/HEAD/script_samples)

**Formats**
- A garment is a folder: `<name>.mhclo` (text: metadata, the fit, the hidden body vertices), `<name>.obj` (the mesh
  with UVs), `<name>.mhmat` (text: material and texture file names), PNG textures, a `.thumb` picture; `.mhpxy` and
  `.npz` are caches (source) — [a community asset's files](https://github.com/k3yg4n/glamcam-makehuman-clothing-assets/tree/HEAD/finalized_clothes/Denim_Jacket)
- The `.mhclo` says `basemesh hm08`, gives three scale lines (`x_scale 5399 11998 1.4340`: two base vertices and a
  reference distance), then one line per garment vertex, for example
  `16883 17193 17764 0.45120 0.27008 0.27872 -0.05059 0.28756 0.28788` (three base vertices, three weights, an offset),
  then `delete_verts` with ranges of base vertices to hide (source) —
  [male_casualsuit01.mhclo](https://github.com/dmaugis/makehuman-py3-assets/blob/HEAD/base/clothes/male_casualsuit01/male_casualsuit01.mhclo)
- "Only one material for one item of clothing is allowed"; a mesh is all quads or all triangles; the base mesh "hm08"
  includes a "helper mesh", and "for underwear the nude body is best choice, but for a coat the helper mesh will be
  used"; the unposed base mesh "is presented in an A-Pose" (source) —
  [MakeClothes introduction](https://github.com/makehumancommunity/makehuman-static-website/blob/HEAD/content/Assets/CreatingAssets/MakeClothes/introduction.md)

**Quality, measured**

| Item (licence) | Quads | As triangles | Textures | UV islands | Texel density, px per cm at 2048 px (10th / 50th / 90th percentile) |
|---|---|---|---|---|---|
| System: tee and jeans, male (CC0) | 8,336 | 16,672 | colour, normal, AO | 6 | 8 / 9 / 11 |
| System: jacket and jeans (CC0) | 2,998 | 5,996 | colour, normal, AO | n/m | n/m |
| System: suit and tie (CC0) | 7,478 | 14,956 | colour | 23 | 9 / 10 / 11 |
| System: female tee and jeans (CC0) | 2,118 | 4,236 | colour, normal, AO | 6 | 12 / 16 / 18 |
| System: shoes 01, a pair (CC0) | 1,660 | 3,320 | colour, normal | 6 | 21 / 58 / 67 |
| Tucked T-shirt, Toigo (CC0) | 1,350 | 2,700 | colour, bump | 6 | 17 / 20 / 29 |
| Male trousers 02, Mindfront (CC-BY 4.0) | 7,292 | 14,584 | colour, normal, specular | 9 | 13 / 15 / 16 |
| Knitted sweater 01, Mindfront (CC-BY 4.0) | 1,314 | 2,628 | colour, normal, specular | 2 | 14 / 16 / 19 |
| Winter coat, punkduck (CC-BY 3.0) | 3,700 | 7,400 | colour | 27 | 9 / 13 / 21 |
| Denim jacket, punkduck (CC-BY 3.0) | 3,494 | 6,988 | colour, normal | 52 | 14 / 20 / 70 |
| EMT uniform jacket (CC-BY 4.0) | 10,806 | 21,612 | colour | 145 | 23 / 29 / 61 |
| Goddess dress 8, Elvaerwyn (CC-BY) | triangles | 65,094 | colour, normal | 102 | 5 / 11 / 78 |

- Measured by reading the OBJ files; "n/m" is not measured. The range over all 53 meshes read: 1,300 to 10,800 quads
  for quad garments, and 5k to 65k triangles for the nine triangle meshes, all by one author. All UVs lie inside 0 to
  1. Three of the 14 UV sets measured cover more than the whole square (shoes, the goddess dress, the EMT jacket), so
  parts of them overlap or mirror (source) —
  [system clothes](https://github.com/dmaugis/makehuman-py3-assets/tree/HEAD/base/clothes),
  [community assets](https://github.com/k3yg4n/glamcam-makehuman-clothing-assets/tree/HEAD/finalized_clothes)
- Textures: all eight colour and normal maps whose headers were read are 2048 × 2048. Across the 33 community
  materials, every one has a colour map, 20 a normal map, 4 a specular map, 2 a bump map, 1 each roughness, metallic
  and AO (source) — [community assets](https://github.com/k3yg4n/glamcam-makehuman-clothing-assets/tree/HEAD/finalized_clothes)
- The look, from the official thumbnails of 339 clothing and accessory assets (viewed here as contact sheets): clean, plausible
  silhouettes with modelled collars, lapels, ties, pockets and waistbands; fabric shown by tiled or photo textures;
  folds mostly modest. The CC0 everyday pieces are plain (white "crude" tees, a polo, a fisherman sweater, cargo
  trousers, plaid mini skirts, print dresses, eight formal suits); the system outfits are tee-and-jeans sets. The CC-BY
  packs show the more finished work: shirts with ties, sweaters, jeans and trousers with modelled folds, a winter
  coat, EMT uniforms, oxfords and sneakers (source) —
  [pack pages and their thumbnails](https://github.com/makehumancommunity/makehuman-static-website/tree/HEAD/content/Assets/AssetPacks)
- What the packs' "checked" means: "opened in both MPFB2 and MakeHuman, and a cursory inspection has been made to
  ensure that the asset isn't in any obvious way broken"; "the character skin might peek through the clothes and
  require manual correction" on bodies far from the one it was made for (source) —
  [asset packs FAQ](https://github.com/makehumancommunity/makehuman-static-website/blob/HEAD/content/Assets/AssetPacks/faq.md)

**Fitting, as the format defines it**
- "Each clothes vertex is mapped to three basemesh vertices with barycentric weights and an offset vector, allowing
  clothes to deform as the character's shape changes"; skin under a garment is hidden by "delete groups"; "bone weights
  are transferred from the basemesh to the clothes mesh using the MHCLO vertex mapping" (source) —
  [clothesservice.md](https://github.com/makehumancommunity/mpfb2/blob/HEAD/docs/services/clothesservice.md)
- The whole fit in JavaScript, from an MIT-licensed three.js tool: "each proxy vert = w1*b1 + w2*b2 + w3*b3 +
  offset*scale", with the scale per axis `Math.abs(morphed[a] - morphed[b]) / ref` from the three scale lines; body
  quads whose corners are all in `delete_verts` are dropped; "proxies inherit weights from the vertices they are fitted
  to". Its `app.js` is 592 lines in all (source) — [app.js](https://github.com/NastyFFM/HumanGenWeb/blob/HEAD/app.js),
  [build_data.py](https://github.com/NastyFFM/HumanGenWeb/blob/HEAD/build_data.py)
- A second MIT tool does the same for "a real person, not anime", and adds what the user asked for: its own garment
  designs "painted onto the texture of an existing CC0 garment by position on the body", "MakeHuman's T-shirts with the
  MakeHuman logo covered", and "body coverage (which body skin a garment hides)" (source) —
  [vrm-avatar-maker README](https://github.com/ffunch/vrm-avatar-maker)

### Inferences
- **What "make it fit" needs: `hm08`'s vertex positions for an MHR body, once.** The fit never looks at the garment's
  shape, only at base vertices. So the one missing piece is a registration of `hm08` (body and helper mesh, since coats
  and skirts are bound to the helpers) onto MHR: each `hm08` vertex stored as a point on MHR's surface plus an offset,
  in a shared pose. MHR has one topology for every body, so that table is made once; after it, every `.mhclo` in both
  tiers fits every character with the ten lines above. How to make the registration is the refitting note's subject.
- **The rest already exists in the tailor.** Hidden skin can come from `delete_verts` through the same table or from
  the tailor's own coverage test; weights come from the MHR body as they do today.
- **Custom PBR sets:** the garments' own UVs are hand unwraps at 0.5 to 1.2 mm a texel, with each island at its own
  scale. On simple garments the density is even (the 90th percentile is 1.2 to 1.8 times the 10th), so a tileable set
  can be laid at real size by scaling each island by its measured area ratio; on detailed ones (jackets, the qipao) it
  varies 4 to 15 times and the islands' grain directions are whatever the author chose. Keeping the garment's own
  colour map as a tint and detail layer (it holds the painted seams and pockets) under a shelf fabric is the cheap
  route; a second, generated UV set is the clean one.
- **PNG decals** should be projected onto the fitted garment in 3D, or placed by position on the body as
  vrm-avatar-maker does, not placed in the garment's UVs: some UV sets overlap or mirror.
- **Content to leave out, by name and thumbnail:** a cap with a political slogan, fan costumes of film, comic and anime
  characters, sneakers that copy real brands' designs, and the MakeHuman logo on the system tees. A CC0 or CC-BY tag
  from the uploader does not clear a third party's mark or character.
- **Download and keep the packs now.** One maintainer, a forum that is gone and an asset repository that is offline:
  the two file servers are the only official source, about 0.8 GB for the CC0 clothing packs and system assets and
  about 1.7 GB for the CC-BY ones.
- **If the rule is relaxed to CC-BY, the credit list is mechanical:** each `.mhclo` header carries the author and
  licence, so a credits file can be generated at import, as vrm-avatar-maker generates its own.

### Gaps
- No pack was downloaded: the two file servers were not reachable from this session. The measurements come from 53
  asset folders found on GitHub, not from a full pack, and a render of a garment on a body was not made.
- The user asset repository's total and its CC0 to CC-BY split could not be counted: the site is down and its
  `assets.json` was not reachable.
- Whether the CC-BY items' authors specify a wording for the credit was not checked asset by asset.
- The helper mesh's layout (which helper vertices exist and how far they sit from the skin) was not read; it decides
  how the registration must treat coats and skirts.

## 3. The other character systems and marketplaces, briefly

### Takeaway
Nothing else gives the studio a wardrobe. The 2024 to 2026 changes here are a closure (Ready Player Me), a licence
opening that needs Unreal (MetaHuman), a dress-up format for anime avatars (VRoid's XWear) and steady MPFB2 releases.

### Cited Findings
- **CharMorph**: code GPL-3, "each character has its own license" (Antonia CC-BY 3.0, Reom CC-BY, MB-Lab characters
  AGPL3); its only clothes are underwear for Antonia; last commits 2024-10-10 and 2023-12-11. **MB-Lab** 1.8.1 is the
  "final version", last commit 2024-06-08, no clothes (source) —
  [CharMorph license.txt](https://github.com/Upliner/CharMorph/blob/HEAD/license.txt),
  [CharMorph-db](https://github.com/Upliner/CharMorph-db), [MB-Lab README](https://github.com/animate1978/MB-Lab)
- **VRoid Studio** 2.0.0 (2024-11-28) made the dress-up feature and the XWear format (`.xwear`) official; a free Unity
  extension converts VRChat outfits; dressed models export as VRM 1.0. Windows, macOS and iPad; not on Linux (search) —
  [VRoid notice](https://vroid.com/en/studio/notice/3rgHw1j8oCVkdWM0LKHBH6),
  [Steam](https://store.steampowered.com/app/1486350/VRoid_Studio/)
- **MetaHuman**: since Unreal Engine 5.6 (June 2025) under the standard Unreal EULA; characters are "non-engine
  products" usable in Unity or Godot without the 5 % royalty. Clothing is authored on several body shapes and
  "interpolated to create clothing that fits any body"; outfits on Fab are `.mhpkg` packages for UE 5.6+, and one
  listing limits use to Unreal projects. A vendor blog from March 2026 disputes that shipped use outside Unreal is
  allowed (search) —
  [CG Channel](https://www.cgchannel.com/2025/06/you-can-now-sell-metahumans-or-use-them-in-unity-or-godot/),
  [Epic, MetaHuman 5.6](https://metahuman.com/news/metahuman-leaves-early-access-with-a-feature-packed-new-release),
  [a Fab listing](https://forums.unrealengine.com/t/unseen-neon-formal-off-shoulder-dress-for-metahuman-parametric-outfit-ue-5-6/2698411),
  [StraySpark](https://www.strayspark.studio/blog/metahuman-2026-web-app-shutdown-migration-guide)
- **Daz**: "an Interactive License is required when using or distributing 3D content from the Daz 3D store ... in video
  games"; bought per product ($35, $50, $100 in forum examples); Windows and macOS only (search) —
  [Daz licences](https://www.daz3d.com/daz-licenses),
  [Daz forum](https://www.daz3d.com/forums/discussion/comment/9056431)
- **BlenderKit**: its add-on's licence field has exactly two values, "Royalty Free" ("royalty free commercial
  license") and "Creative Commons Zero" (source) —
  [`__init__.py`](https://github.com/BlenderKit/BlenderKit/blob/HEAD/__init__.py)
- **Sketchfab**: "over 2000 Public Domain CC0 models" site-wide in 2021; a 2026 guide says CC0 models remain
  downloadable (search) — [Sketchfab blog](https://sketchfab.com/blogs/community/600000-free-3d-models-on-sketchfab),
  [guide](https://app.cinevva.com/guides/free-3d-model-sites)
- **Objaverse**: "Individual objects in Objaverse-XL are licensed under different licenses" (source) —
  [README](https://github.com/allenai/objaverse-xl); the 1.0 card lists CC0 at about 3.5K objects (search) —
  [dataset card](https://huggingface.co/datasets/allenai/objaverse)

### Inferences
- VRoid's clothes are legally usable but anime-styled, and the tool does not run on the user's system.
- MetaHuman outfits are the best-looking free garments there are, and out of reach without the Unreal editor the
  project removed.

### Gaps
- See section 1's gaps: the marketplaces the steer names were not researched.

## 4. CC0 fabric sets, for custom PBRs on those garments

### Takeaway
Fabric is where free and CC0 is rich. Besides ambientCG, which the studio has, Poly Haven, 3D Textures, TextureCan and
CGBookcase publish fabric sets under plain CC0, and ShareTextures has the most fabric pages under a "Custom CC0".

### Cited Findings

| Library | Licence | Fabric coverage | Reference |
|---|---|---|---|
| ambientCG | CC0 | Over 2,000 PBR materials in all, 1K to 8K; fabric count not obtained | [ambientCG](https://ambientcg.com) (search) |
| Poly Haven | CC0: "CC0 assets carry no attribution requirement whatsoever" | 8K scans; a "Textiles & Leather" branch: denim, knits (fleece, jersey, wool), leather, jacquard, pile and velvet (corduroy, faux fur, terry), sackcloth, technical (neoprene, stretch), woven (linen, plaid, plain cotton, satin and crepe) | [ToS.md](https://github.com/Poly-Haven/Public-API/blob/HEAD/ToS.md), [taxonomy.json](https://github.com/Poly-Haven/Public-API/blob/HEAD/taxonomy.json) (source) |
| ShareTextures | "Custom CC0 ... with specific restrictions": valid only when downloaded from its own site; no scraping or hotlinking | 1,600+ textures; fabric pages numbered at least to 200 | [licence](https://www.sharetextures.com/p/license), [fabric-200](https://sharetextures.com/textures/fabric/fabric-200) (search) |
| CGBookcase | CC0 | 380 sets in 2019; jeans, rag, tulle, Fabric 01 to 10 | [CG Channel](https://www.cgchannel.com/2019/03/download-380-free-pbr-texture-sets-from-cgbookcase-com/), [fabric post](https://cgbookcase.com/blog/fabric-textures-overview-and-making-of) (search) |
| 3D Textures | "All textures on this site are licensed as CC0" | 1,300+ textures; a cloth tag | [FAQ](https://3dtextures.me/about) (search) |
| TextureCan | CC0 1.0 for all textures | Fabric, cloth, textile and garment tags | [terms](https://texturecan.com/terms) (search) |

### Inferences
- Poly Haven is the first shelf to add: licence verified at source, 8K scans, sorted by textile type.

### Gaps
- Fabric counts per library were not obtained (sites and APIs unreachable).

## 5. Authoring tools: Blender, its add-ons, and alternatives to Marvelous Designer

### Takeaway
No free tool makes garments markedly easier, and no dedicated garment application is both free for commercial work and
on Linux. The one real advance is a drape engine: ZOZO's Contact Solver (Apache-2.0) got a Blender 5 add-on in April
2026. With ready-made garments at the centre, these tools matter only for fixing or draping an imported piece.

### Cited Findings
- **Blender:** the legacy Cloth modifier and the sculpt cloth brush are still in main (5.4 alpha, 2026-11-10); sewing
  springs are unchanged (source) —
  [cloth.cc](https://github.com/blender/blender/blob/HEAD/source/blender/blenkernel/intern/cloth.cc). 5.2 LTS
  (2026-07-14) added node-based cloth on an XPBD solver, labelled experimental, which the manual says is missing
  self-collision (search) — [CG Channel](https://www.cgchannel.com/2026/07/blender-5-2-lts-is-here-discover-its-5-key-features/),
  [manual](https://docs.blender.org/manual/sl/latest/modeling/geometry_nodes/simulation/cloth_dynamics.html). The
  node is still named "XPBD Solver (Experimental)" and its sources contain no sewing, stitch or self-collision code
  (source) — [node_geo_xpbd_solver.cc](https://github.com/blender/blender/blob/HEAD/source/blender/nodes/geometry/nodes/node_geo_xpbd_solver.cc)
- **ZOZO's Contact Solver:** solver Apache-2.0, add-on GPL-3.0-or-later (version 1.0.16, Blender 5.0+), last commit
  2026-11-10; Linux with CUDA 13.2 and driver 580 or newer, "3090 ... for small to medium" scenes; "loose edges ...
  become stitch constraints"; six fabric presets "calibrated against published fabric drape measurements"; a Python API
  whose `fitting.ipynb` sews a dress onto a body mesh (28.5K vertices, 240 frames, 1.26 minutes on an NVIDIA L4, the
  authors' figure); "Not production ready (yet)" in its own words (source) —
  [README](https://github.com/st-tech/ppf-contact-solver),
  [LICENSING.md](https://github.com/st-tech/ppf-contact-solver/blob/HEAD/LICENSING.md),
  [material.md](https://github.com/st-tech/ppf-contact-solver/blob/HEAD/docs/blender_addon/workflow/params/material.md),
  [fabric_presets.md](https://github.com/st-tech/ppf-contact-solver/blob/HEAD/docs/blender_addon/workflow/params/fabric_presets.md)
- **Free add-ons:** Seams to Sewing Pattern is GPL v2, version 1.0 for Blender 2.8 to 3.0, last commit 2022-04-17; a
  fork "refactored for Blender 5.0+" exists (GPL v2, 2026-06-06). Modeling Cloth's free version for Blender 4.1+
  (`MC-4x`, 2026-06-19) carries its own licence text that allows commercial use; its Blender 5 repo holds only a
  Windows `.dll` (source) — [S2S](https://gitlab.com/thomaskole/blender-seams-to-sewing-pattern/-/blob/master/README.md),
  [fork](https://github.com/ThundazZ/Seams-to-Plush-Simulation), [MC-4x](https://github.com/the3dadvantage/MC-4x),
  [MC5](https://github.com/the3dadvantage/MC5)
- **Paid add-ons:** Simply Cloth Studio 2.0 ($36 to $66, January 2026), Garment Tool ($40), Cloth Weaver ($39 to $49),
  Divine Cut ($39.75 to $60), Easy Cloth (needs Blender 5.2) (search) —
  [CG Channel](https://www.cgchannel.com/2026/01/vjaceslav-tissen-releases-simply-cloth-studio-2-0-for-blender/),
  [Garment Tool](https://bartoszstyperek.gumroad.com/l/GarmentTool),
  [Cloth Weaver](https://blendermarket.com/products/cloth-weaver),
  [Divine Cut](https://xanestudios.gumroad.com/l/divine-cut-smart-cloth-generator),
  [Easy Cloth](https://superhivemarket.com/products/easy-cloth)
- **Marvelous Designer:** Personal $39 a month or $280 a year; Linux only on the Enterprise plan at $2,300 a seat a
  year (RHEL and Rocky 9); "freelancers are allowed to use personal licenses, but all other companies (studios, game
  companies ...) must purchase enterprise licenses" (search) —
  [MD support](https://support.marvelousdesigner.com/hc/en-us/articles/47358269350041),
  [CG Channel](https://www.cgchannel.com/2025/10/marvelous-designer-is-now-available-for-linux/),
  [MD support, licences](https://support.marvelousdesigner.com/hc/en-us/articles/47358297616153-What-is-the-difference-between-Personal-and-Enterprise-License)
- **CLO** has a 14-day trial and no free plan; **Style3D Atelier** has had a free version, which Style3D's own blog
  calls a trial that does not cover commercial work; **Houdini Apprentice** is for "non-commercial projects" (search) —
  [CLO support](https://support.clo3d.com/hc/en-us/articles/115012788967-How-do-I-start-a-CLO-free-trial-version),
  [Style3D blog](https://www.style3d.com/blog/?p=14316), [SideFX](https://www.sidefx.com/faq/question/435/)

### Inferences
- ZOZO's solver adds a fourth commercial-safe simulator to the earlier note's list (Blender cloth, Newton,
  ContourCraft), and the only one with stitches, strain limiting, no penetration and measured fabrics together. It
  drapes garments; it does not make them.
- Blender's sewing springs and ZOZO's stitches are both "edges with no face", so one mesh serves both.

### Gaps
- Nothing was run. Style3D's free plan and CLO's price are unverified.

## 6. Open sewing patterns

### Takeaway
Patterns drafted from measurements give flat panel shapes, not garments. FreeSewing (MIT, JavaScript, 58 designs, 38
measurements) fits the studio's stack but carries no sewing information; Seamly2D and Valentina are active GPL drafting
programs. With the user now preferring ready-made garments, these are reference material.

### Cited Findings
- FreeSewing: MIT; "an open source platform for made-to-measure sewing patterns"; moved to Codeberg after version
  4.0.0 (GitHub's last commit 2025-04-02); 58 designs, 32 of them everyday garments and none a dress; exports SVG,
  PDF and its settings as JSON or YAML; its core has no notion of which edge is sewn to which (source) —
  [LICENSE](https://github.com/freesewing/freesewing/blob/HEAD/LICENSE),
  [collection](https://github.com/freesewing/freesewing/blob/HEAD/packages/collection/src/index.mjs),
  [measurements](https://github.com/freesewing/freesewing/blob/HEAD/packages/config/src/measurements.mjs),
  [export](https://github.com/freesewing/freesewing/blob/HEAD/packages/react/components/Editor/lib/export/index.mjs),
  [core](https://github.com/freesewing/freesewing/tree/HEAD/packages/core/src)
- Seamly2D: "GPLv3+ ... available for Windows, MacOS, and Linux"; patterns read "individual measurement files for
  custom-fit"; exports SVG, PDF, OBJ and DXF in flat, AAMA and ASTM flavours; last commit 2026-11-10 (source) —
  [README](https://github.com/FashionFreedom/Seamly2D/blob/HEAD/.github/README.md),
  [def.h](https://github.com/FashionFreedom/Seamly2D/blob/HEAD/src/libs/vmisc/def.h)
- Valentina: GPL v3, active (2026-11-06), with a command line that takes a measurement file and an export format
  (source) — [README](https://github.com/dismine/Valentina),
  [commandoptions.cpp](https://github.com/dismine/Valentina/blob/HEAD/src/libs/vmisc/commandoptions.cpp)

### Inferences
- This is the route the studio removed in October, with less help than GarmentCode gave. It is not an advance.

### Gaps
- FreeSewing's state after April 2025 was not readable.

## 7. Clothing datasets

### Takeaway
None can ship. Those with readable terms forbid commercial use; the rest are unverified; nearly all sit on SMPL-family
bodies.

### Cited Findings

| Dataset | Licence | Body | Reference |
|---|---|---|---|
| DeepFashion3D and V2 | CC BY-NC 4.0 | Aligned to SMPL | [LICENSE](https://github.com/GAP-LAB-CUHK-SZ/deepFashion3D/blob/HEAD/LICENSE) (source) |
| Multi-Garment Net's wardrobe | "any use for commercial purposes, is prohibited" | SMPL | [README](https://github.com/bharat-b7/MultiGarmentNetwork) (source) |
| GarmageSet (Style3D, 14,801 garments, 2025-11-18) | Code repo CC BY-NC-ND 4.0; data licence not read | Not stated | [LICENSE](https://github.com/Style3D/garmagenet-impl/blob/HEAD/LICENSE) (source) |
| 4D-DRESS (64 real outfits) | None in the repo or its project page | SMPL, SMPL-X | [README](https://github.com/eth-ait/4d-dress) (source) |
| CLOTH3D | None in the repo; registration at ChaLearn | SMPL | [README](https://github.com/hbertiche/CLOTH3D) (source) |
| GarmentCodeData (115,000 drapes) | Not confirmed | Its own model, based on CAESAR | [ETH record](https://www.research-collection.ethz.ch/entities/researchdata/d9df8fe3-2add-49a2-bb58-21750ca7970c) (search) |
| GarVerseLOD | No licence; only part released | Not stated | [dataset README](https://github.com/zhongjinluo/GarVerseLOD/blob/HEAD/dataset/README.md) (source) |

### Inferences
- GarmageSet is the only one of professional, production-style garments, and its repo's licence rules it out.

### Gaps
- The licences of 4D-DRESS, CLOTH3D, GarmentCodeData and GarmageSet's data are unverified (hosts unreachable).

## 8. Ranked verdict for this slice

### Takeaway
For "better already-designed clothing with lots of options", the free answer is MakeHuman's clothing, fitted to MHR
through its own file format: about 185 wearable CC0 items today, about 460 if credited CC-BY is accepted. Around it,
CC0 fabric shelves and one new drape engine are usable; everything else is paid, closed, stylised or forbidden.

### Cited Findings
- The evidence for each line is in the section named beside it — sections 1 to 7 of this note.

### Inferences
**Usable now**
1. **MakeHuman CC0 clothing** (system assets and the CC0 packs): legally clean, plain files, one base body, two MIT
   reference fitters in three.js. About 42 everyday garments, 8 formal suits, 29 pairs of shoes, 56 accessories
   (sections 1, 2).
2. **CC0 fabric sets**, Poly Haven first, for re-texturing them (section 4).
3. **Poly Haven's scanned props** for footwear, gloves, headwear and bags (section 1).

**Usable if the rule is relaxed to credited CC-BY**
4. **MakeHuman CC-BY packs**: 210 more garments and shoes, the stronger everyday set, for one credits screen and a
   generated credits file (sections 1, 2).

**Usable with work**
5. **The fit itself**: a one-time registration of `hm08` to MHR, then the format's own ten lines (section 2; method in
   the refitting note).
6. **ZOZO's Contact Solver**, if an imported coat or dress needs a real drape on an MHR body (section 5).
7. **BlenderKit Royalty Free and Sketchfab CC-BY**, one garment at a time, each checked by hand (section 1).

**Not usable**
- Quaternius, Kenney, OverScore, Open Source Avatars, VRoid: stylised (sections 1, 3).
- Ready Player Me (closed), MetaHuman outfits (need Unreal), Daz (paid per product), CharMorph and MB-Lab (no clothes,
  AGPL or CC-BY bodies) (sections 1, 3).
- Marvelous Designer, CLO, Style3D, Houdini Apprentice and the paid Blender add-ons: not free for commercial work
  (section 5).
- Blender 5.2's node cloth, Seams to Sewing Pattern, Modeling Cloth: experimental, stale or beside the point
  (section 5).
- Sewing-pattern tools and every clothing dataset (sections 6, 7).

### Gaps
- Nothing was downloaded from MakeHuman's servers or rendered; the first hands-on step is to fetch the system assets
  and two CC-BY packs, look at them at 1 to 2 m, and fit one to an MHR body.
- The marketplaces that might hold better-looking free garments (Fab, itch.io, CGTrader, TurboSquid, CLO and Marvelous
  Designer files, Hugging Face, Blender Studio) were not researched: the search budget was spent before the steer.
