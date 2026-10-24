# The tailor: clothes cut from the character's own body

Clothes for the Character Studio's characters (DECISIONS 2026-10-23): our own generator after Woohill's character
creator (`tsukibii/woohill`, `creator/src/js/20-clothes.js` and `21-outfits.js`: its second skins and its hulled
fields), with far more polygons, because our bodies are realistic. The aim is **a bit better than PSX-style
clothing**: clean garments that fit, with the details that read at a game's distance (collars, plackets, buttons,
pockets, waistbands, belts, cuffs, pleats) and a real thickness. There are no sewing patterns, and the cloth is not
simulated. It replaces the GarmentCode route, which was removed.

## 1. How a garment is made

| Step | What | Where |
|---|---|---|
| Measure | horizontal slices of the body: the crotch (where the legs part), the armpit (where the arms leave the torso), the neck's base and axis, the bust, the waist, the hips (the seat at its fullest), the knee; each arm's centre line from the shoulder joint, its seam plane, elbow, wrist and fingertip | `tailor/scan.js`, `tailor/frame.js` |
| Cut lines | each garment kind as values on the body, positive on the cloth: the neckline (a cone round the neck's base dipped into a round, V or square neck; it starts where the cloth is, so loose garments don't climb the neck), the hem (longer at the front or back for shirt-tails), the waistline (lower in front), sleeves cut square to the arm at a length along it, trouser legs at a height | `tailor/pieces.js` `neckline`, `cutter` |
| Lift | the body's own mesh under the garment, plus a margin, lifted along the skin's normals by the **ease** (the body, the sleeves, the legs, a flare to the hem, more round the crotch), plus how far out the clothes already worn reach | `shell`, `layers` |
| Relax | `tension` rounds of smoothing along the cloth's normals only, each followed by a push back out to its ease from the body: a stretched membrane that lies on what bulges and bridges what dips (under the bust, the waist, the spine, the small of the back). More rounds hang it looser. It's held back at the armpits and between the legs so it doesn't web them | `tailor/fit.js` `relax` |
| Refine | split in four (about 5 mm triangles), settled four more rounds at that size, then cut along the lines: the cut edges are interpolated, so every hem and neckline is one clean curve | `shell`, `mesh.js` `cut` |
| Skirts | rings hung from the waist instead: at every height the convex outline of the body (both legs, and what's worn under it) plus the ease, never narrowing below the hips (`flare` widens it; `taper` makes a pencil skirt), knife or box `pleats` stitched down to the hip, or `waves` | `skirt` |
| Details | parts of the garment's outside lifted a few millimetres off it: `neckband`, `collar` (rolled at the neck, points at the front), `placket` (a button band, or a fly with `x`), `band` (on the waistline: a waistband, a belt; or between two heights: a hem band), `cuff` (sleeves or trouser legs), `pocket` (a rounded rectangle seen from the front, the back or the side: patch pockets, flaps, cargo pockets), `lapel` (along a jacket's V, widest at the neck, rolled), `edgeband` (down an opening's edges: a cardigan's rib, a jacket's front band); a `collar` with `front: false` goes round the back only, for lapels; `buttons` are discs down a line (one big one is a buckle) | `detail`, `buttons` |
| Shoes | `kind: "shoe"`: the upper lofted round each foot as Woohill's footwear is (vertical sections across the foot every 3 mm, each the convex outline of the foot there, so the toes are one smooth toe box; the heel cup a wall, the toe rounded; the ease out; the ends rounded), its opening cut by `shoe` (`heel` and `vamp` heights, `from` where along the foot the upper is whole: a boot is high all round); the **sole** under it (`sole`: the footprint's outline pushed out by `overhang`, `thick` under the floor, `rise` up the side, toe spring, a `heel` block); `foot` details by where they are on the foot (a toe cap, a heel counter, a tongue) | `shoeShell`, `soles`, `frame.js` `feet` |
| Underwear | `bra`: a band round the ribs under the bust (the fold found under each breast's fullest point, `bust`), cups laid on the torso's front as a flat panel (the fabric coordinates' `torsoU` across, the height up): `triangle`, `balconette` (a nearly level top), `plunge` (the inner edges in a V down to the band), the gore between them, straps from each cup's highest point over the shoulder and down to the back band (or meeting between the shoulder blades: `racer`); `sports` one front panel to a scoop with wide straps; `bandeau` a band over the bust. `brief`: under the waistline, the leg openings: a `gusset` between the legs, the front panel widening to the hips, its edge rising to `side` over the crotch (`curve`: under 1 cut high at once, over 1 low and then up); the back from its own gusset (a thong's strip) with its own `curve` and `drop` over the seat, or (`band`) rising from the strip to just under the waistline: a thong's V or a G-string's T. Skin tight (1.5 mm of ease, `tension` 8); `fine: 2` splits the cloth once more (about 2.5 mm) so straps and strings have clean edges; a `trim` detail lifts a band along every edge (the elastic) | `bra`, `brief`, `bust` |
| Thickness | an inner surface and a crisp rim round every open edge; the rim and the outside's last row of points are shaded darker (`S`), so hems, pockets and collars read as stitched edges with a shadow | `fit.js` `thicken` |
| Fabric coordinates | every point gets (u, v) in metres, laid the way a sewn garment's panels lie: the torso a front and a back panel (u the arc length across each row's own outline from the middle, over the shoulders a yoke by x; side seams), a sleeve round the arm's line (the seam underneath), a trouser leg round its own line from the waist down (the seam at the back, a stocking's), a skirt a front and a back panel spreading to the hem; every ring's own radius, so a tile is its real size all round. The mesh is split exactly along each seam first, so seams are clean lines; normals come from the joined mesh, so the light doesn't break there. `sheet.mjs --uv` shows them as a 5 cm checker | `tailor/uv.js`, `frame.js` `torsoArcs` |

Layering is by order: each garment goes over the ones before it. What's under it is measured as a thickness over the
body (how far out the earlier garments reach at each point of the skin), and the new garment's ease starts there.
Nothing is pushed off another garment's open mesh: that tore at hems and pockets. **Bottoms first** and the top hangs
over them; **a top first** and it's tucked in.

A garment is 25k to 165k triangles (the check prints them all). Cutting one on a body takes about 0.5 to 3.5 s; the
Studio does it in a worker. Keeping the cloth off the skin walks the skin's mesh from the point each bit of cloth
came from (a few steps, not a search), except where another part of the body is near (between the thighs, at the
armpits), where it searches properly every round.

## 1b. Fabrics, patterns, prints

`tailor/fabric.js` ports Woohill's surfaces (`creator/src/js/60-character.js` `surfaceTile`, `surfaceAux`; their sizes,
gloss and relief from `20-clothes.js`): each a seamless tile drawn in code at four times Woohill's size, the cloth's
light and dark round a mid grey, laid on the fabric coordinates at its real size in metres. **Cotton, jersey, denim,
canvas, twill, knit, rib, wool, tweed, silk, satin, spandex, leather, patent, suede, velvet, quilted**, and the three
that let the skin through: **sheer** (pantyhose: the nylon at its `denier`, darker where the leg turns away, a sheen
down the leg), **fishnet** and **lace** (their holes are empty). Each also gives a relief (a bump map) and a gloss
(less rough). **Patterns** in the garment's own colours (stripes, pinstripe, vertical stripes, gingham, checks, plaid,
polka dots, houndstooth, camouflage) at a repeat in metres; a **print**: text set in type, or a picture, placed on a
panel (front, back, a sleeve, a leg, a skirt's front) across and up it, a width, a turn. `tailor/look.js` makes the
material (`MeshStandardMaterial` with a small shader patch: the colour or pattern, the grain over it, the print, the
gloss; the bump map is three's own). A garment's look is its design's (`surface`, `trimSurface` for its trim, `pattern`,
`denier`) under its own (outfits.json's third field, or the Studio's controls); a detail can take its own `surface`
(the stockings' lace top). Changing a look only rebuilds materials: nothing refits.

**PBR sets** (2026-10-23): a garment can wear a texture set off the PBR shelf (`assets/pbr`, docs/ASSETS.md §6)
in place of the made-up grain: `pbr: "pbr/denim1"` on a worn garment (or a design), a repeat in metres
(`pbrTile`, 0.3 unless the set's own `tile_m` says, the shelf's default of 2 m being a wall's) and `pbrTint` (the
garment's colour or pattern over the set's). Its colour goes through the fabric shader, so a print still lands on it;
its normal (a DirectX one, Unreal's convention, turned for three.js), roughness, metal, AO and opacity (a net cut out)
take three's own slots; a height map is the bump when there's no normal; a packed ORM (Unreal's) or ARM (Poly Haven's)
map stands in for the separate AO, roughness and metal (AO red, roughness green, metal blue, as three reads them). The
maps are found by their names' last word, so Unreal-ready names work as they are: `denim1_albedo.png`, `_ao`,
`_height`, `_metallic`, `_normal-dx`, `_roughness`, `_orm`. The parts that are the garment's fabric (bands, pockets)
take the set; trim keeps its own. A map the names get wrong is chosen by hand on the shelf page (the Studio's **PBR**
button). `sheet.mjs --pbr pants=pbr/denim1:0.12` renders one.

## 2. The designs are data

`Content/Studio/Clothes/designs.json`: each design has a `label`, a `slot` (`under`, `top`, `bottom`, `full`, `legs`, `feet`, `jacket`), a
`color` (`trim` and `buttons` for its details), a `surface` (and `trimSurface`, `pattern`, `denier`), a `thickness`, a
`piece` and its `details`. Heights are names on the body
(`neck`, `armpit`, `bust`, `waist`, `hip`, `crotch`, `knee`, `ankle`) plus metres on MHR's 1.726 m average, scaled
with the body: `"crotch+0.12"`. The ones that carry the fit are the crotch, the armpit and the neck (the waist found
on MHR's average body is high, so hems and waistlines are measured from the crotch).

| Piece field | Means |
|---|---|
| `kind` | `shell` (cut from the skin) or `skirt` (rings) |
| `neck` | `false`, or `{shape: round \| v \| square, depth, back, width, tilt}` |
| `sleeve` | `short`, `cap`, `elbow`, `wrist`, or metres from the shoulder joint |
| `hem` | `{at, front, back, side}`: a top's hem; `front`/`back` lengthen it there, `side` raises the sides |
| `waist` | `{at, drop, rise}`: a bottom's waistline, `drop` lower in front, `rise` higher at the back |
| `legs` | `{to}`: where the trouser legs end |
| `open` | `{from, gap, top, curve}`: a jacket's front opening, a `gap` down the middle (a closed front's edge when it's a couple of millimetres) widening into a V from `from` to `top` each side at the neck |
| `ease` | `{body, sleeve, leg, flare, crotch}` in metres off the skin |
| `tension` | rounds of relaxing: 18 clings, 48 hangs like a work shirt |
| `fine` | 2: the cloth split once more (about 2.5 mm triangles), for narrow parts: straps, strings |
| `bra` | `{style: triangle \| balconette \| plunge \| sports \| bandeau, band, top, outer, gore, strap, rise, drop, racer}` (sports: `scoop`, `panel`, `strapX`, `bottom`): metres on the average body |
| `brief` | `{side, gusset, curve, deep, back: {gusset, curve, drop, band}}`: the leg openings under the `waist` |
| skirt | `waist.at`, `length`, `ease`, `flare` (m per m), `taper`, `pleats: {n, depth, stitched, box}`, `waves: {n, depth}` |

`Content/Studio/Clothes/outfits.json`: an outfit is `[[design, colour], ...]` in the order worn. Built now: the
**work uniform** (a work shirt with a collar, a placket and buttons, flapped chest pockets and cuffed short sleeves,
tucked into work trousers with a waistband, a belt and buckle, a fly, cargo and back pockets), the same with long
sleeves, a **coverall**, a **t-shirt** with pants, shorts or an A-line skirt, and a long-sleeved top with a pleated
skirt; a pencil skirt is a design of its own. Legwear: **tights** (black pantyhose), **fishnet tights**,
**stockings** (thigh-high, a lace top) and **leggings**, worn first; a school uniform with a plaid pleated skirt, and
outfits that show a print and a stripe. Jackets: a **blazer** (wool, lapels, two buttons, flap pockets, a breast pocket),
a **work jacket** (canvas, a collar, flapped chest pockets, a front band, a hem band) and a **cardigan** (knit, a deep
V, rib edge bands, cuffs and hem); worn last, over a shirt. Footwear: **sneakers** (canvas, a rubber sole, a tongue, a
toe cap, a red heel tab), **work boots** (leather, a lug sole, a toe cap, a heel counter, a padded collar), **loafers**
(a heel block, an apron) and **flats** (patent); **ankle, crew and knee socks** (a rib top). **Underwear** (2026-10-24,
slot `under`, all skin tight, worn first): bras (a **triangle bralette** in silk, a **balconette** and a **plunge** in
satin, a **sports bra** with a racer back, a **bandeau**, a **longline bralette** in velvet), thongs and briefs (a
**thong**, a **G-string**, a **tanga**, a **high-leg thong**, **bikini briefs**) and boxers (**boxer briefs** with a fly
seam, **trunks**, **long boxer briefs**, **boy shorts**); outfits `lingerie: black lace`, `lingerie: satin nude`,
`lingerie: red`, `underwear: sporty`, `underwear: boxer briefs` and `underwear: trunks`. Every outfit has its shoes,
worn after the socks and tights and before the rest. Soles sit under the floor the body stands on (the body isn't
lifted by them yet).

## 3. Where it runs

- **The Character Studio's Clothes tab** (`tools/character/index.html`): an outfit, or a garment and its colour,
  added over what's worn; the worn list (under to over) with a colour each and ×, and under each its **fabric,
  pattern and print** (the fabric, a denier for sheer ones, a **PBR set** off the shelf with its repeat and a tint, or
  **Add a set**: maps picked from disk go onto the shelf as `assets/pbr/<name>/` and onto the garment; the pattern, its
  colours and repeat; a print's text and ink or a picture, its panel, across, height, width and turn), and its **shape**: the garment's lines as **handles in
  the view** (the hem, the neckline's depth, the sleeve's end, the waist, the legs' end, a skirt's length and flare:
  drag one along its line and the garment is cut again on release) and the same as sliders, with the ease and the
  hang; **As designed** takes them back. They're the garment's own edits (`edit` in `character.json`: a sparse piece
  laid over the design's, `tailor.edited`), so the design stays as it is; **Export clothes OBJ** writes
  `People/<name>/<name>_clothes.obj` (one object per part, metres, Y up, facing +Z, the body's frame). The tailor runs
  in `tailor/worker.js` and refits on its own when the body's shape or height changes. What's worn is saved in
  `character.json` (`clothes`); the meshes are made live, like the hair styles, so there's nothing to go stale.
- **Node:** `tools/character/tailor.js` is a plain module. `node tools/character/tailor/sheet.mjs --outfit "work
  uniform" [--body feminine|masculine|average|slim_feminine|full_masculine...] [--height 1.62] [--close | --chest]
  [--uv | --debug] [--out x.png]` renders a contact sheet (Playwright); `node tools/character/tailor/check.mjs` is
  TAILOR, on seven bodies: MHR's average, its feminine and masculine presets, and the slim and full ones in
  `tailor/bodies.json` (fitted with `mhr.py`'s `fit_measures`: a waist and hips 15 to 20% in, or a waist 15% out with
  a rounder belly, wider hips and thicker thighs). Where a gap in the body is narrower than the cloth's clearance
  (between full thighs), the cloth settles in the middle of it, outside both sides.
- **Export clothes OBJ** carries the fabric coordinates (`vt`, metres) and the normals (`vn`).

## 3b. In motion

The clothes move with the body by its own skinning, no simulation (the PSX-and-better target):
`tailor/weights.js` gives every point of a garment four bones and their weights from the skin round it, a Gaussian
over the skin's points near it, the same width for every layer close to the body (so a shirt and the trousers over it
keep their few millimetres apart) and wider for cloth that stands off (a skirt's hem between the knees takes both
thighs). It depends only on where the point is, so it's smooth over the cloth and the same on both sides of a seam.

`node tools/character/tailor/motion.mjs --outfit "work uniform" --bodies feminine,slim_masculine,full_feminine,full_masculine
[--poses rest,idle,walk0,walk0.5,walk1,sit,crouch,kneel,lunge] [--views 0,90] [--zoom 3 --at 0.03] [--marks]` builds
each body as the desk does (`BodyFigure` on `MHR_lod1.fbx` with the body's identity weights), dresses it on its rest
pose, skins the clothes to its skeleton and poses it with the desk's poses and its walk (`walkOverlay`'s two strides
and between): a contact sheet, a pose a column and a body's views a block of rows, and a line per pose with how much
of each garment's outside is under the skin (creases left out). `--marks` shows those points in red.

What it shows (2026-10-23: the work uniform, the office blazer and the plaid-skirt school uniform on the average,
feminine, masculine, slim and full bodies): standing and walking are clean on every body, the skirt swinging with the
forward leg. In a deep sit or crouch the body's own skinning folds (the thighs swell up into the belly: plain linear
skinning, without MHR's pose correctives) and the cloth follows the skin it's on, so trousers there rise over the belt
as the bare thighs do; in a full body's walk the arms come down into its sides and the sleeves with them. Those are
the body's, fixed where the body is (correctives in Unreal). A skirt in a sit is the cloth's: skinned to the thighs it
turns up with them into a tube pointing forward, where a real one drapes over the lap and hangs at the sides. That
needs cloth (Chaos Cloth on the hem in Unreal) or skirt bones; weights alone can't drape it.

The desk's figure stands its ankle bones on the floor at rest, its soles 7 to 8 cm under it; the tailor measures any
body standing on its own lowest point and gives the clothes back in the body's frame (`B.floor`), so shoes, soles and
every height work on it as on the Studio's body. Posed by the desk, the soles are at the floor standing, 4 cm over it
at both strides of `walkOverlay` (the legs swing, the hips keep their height) and 5 cm under it in `sit`: the desk's
previs, not the clothes.

## 4. Not done yet

- **Into Unreal:** the weights are there (§3b); the export isn't: the clothes still leave as OBJ. They go to Unreal
  as skeletal meshes on the character's skeleton (an FBX or glTF with `weights.js`'s bones and weights), a skirt's hem
  or a coat's tails with Chaos Cloth painted onto that mesh. Hide the skin under tight clothes (Woohill's
  `hideSkinUnderCloth`) so it can't poke through in motion.
- **Fabric in Unreal:** the export has the coordinates and, for a PBR set, its ref and repeat (`# pbr` in the OBJ;
  the shelf already imports a set into Unreal as `MI_<name>`); the made-up tiles, patterns and prints still have to go
  across (a material instance per garment with the tile, its size, the colour or pattern and the print), and Unreal's
  import of a set doesn't use a packed ORM yet (the separate maps).
- **Seams and creases** are only where details are lifted; stitch lines and folds would be a normal map.
- Hair doesn't collide with the clothes yet.
