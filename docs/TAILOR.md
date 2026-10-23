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
| Details | parts of the garment's outside lifted a few millimetres off it: `neckband`, `collar` (rolled at the neck, points at the front), `placket` (a button band, or a fly with `x`), `band` (on the waistline: a waistband, a belt; or between two heights: a hem band), `cuff` (sleeves or trouser legs), `pocket` (a rounded rectangle seen from the front, the back or the side: patch pockets, flaps, cargo pockets); `buttons` are discs down a line (one big one is a buckle) | `detail`, `buttons` |
| Thickness | an inner surface and a crisp rim round every open edge; the rim and the outside's last row of points are shaded darker (`S`), so hems, pockets and collars read as stitched edges with a shadow | `fit.js` `thicken` |
| Fabric coordinates | every point gets (u, v) in metres, laid the way a sewn garment's panels lie: the torso a front and a back panel (u the arc length across each row's own outline from the middle, over the shoulders a yoke by x; side seams), a sleeve round the arm's line (the seam underneath), a trouser leg round its own line from the waist down (the seam at the back, a stocking's), a skirt a front and a back panel spreading to the hem; every ring's own radius, so a tile is its real size all round. The mesh is split exactly along each seam first, so seams are clean lines; normals come from the joined mesh, so the light doesn't break there. `sheet.mjs --uv` shows them as a 5 cm checker | `tailor/uv.js`, `frame.js` `torsoArcs` |

Layering is by order: each garment goes over the ones before it. What's under it is measured as a thickness over the
body (how far out the earlier garments reach at each point of the skin), and the new garment's ease starts there.
Nothing is pushed off another garment's open mesh: that tore at hems and pockets. **Bottoms first** and the top hangs
over them; **a top first** and it's tucked in.

A garment is 25k to 145k triangles (the check prints them all). Cutting one on a body takes about 0.5 to 3 s; the
Studio does it in a worker.

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

## 2. The designs are data

`Content/Studio/Clothes/designs.json`: each design has a `label`, a `slot` (`top`, `bottom`, `full`, `legs`, `feet`), a
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
| `ease` | `{body, sleeve, leg, flare, crotch}` in metres off the skin |
| `tension` | rounds of relaxing: 18 clings, 48 hangs like a work shirt |
| skirt | `waist.at`, `length`, `ease`, `flare` (m per m), `taper`, `pleats: {n, depth, stitched, box}`, `waves: {n, depth}` |

`Content/Studio/Clothes/outfits.json`: an outfit is `[[design, colour], ...]` in the order worn. Built now: the
**work uniform** (a work shirt with a collar, a placket and buttons, flapped chest pockets and cuffed short sleeves,
tucked into work trousers with a waistband, a belt and buckle, a fly, cargo and back pockets), the same with long
sleeves, a **coverall**, a **t-shirt** with pants, shorts or an A-line skirt, and a long-sleeved top with a pleated
skirt; a pencil skirt is a design of its own. Legwear: **tights** (black pantyhose), **fishnet tights**,
**stockings** (thigh-high, a lace top) and **leggings**, worn first; a school uniform with a plaid pleated skirt, and
outfits that show a print and a stripe.

## 3. Where it runs

- **The Character Studio's Clothes tab** (`tools/character/index.html`): an outfit, or a garment and its colour,
  added over what's worn; the worn list (under to over) with a colour each and ×, and under each its **fabric,
  pattern and print** (the fabric, a denier for sheer ones, the pattern, its colours and repeat; a print's text and ink
  or a picture, its panel, across, height, width and turn), and its **shape**: the garment's lines as **handles in
  the view** (the hem, the neckline's depth, the sleeve's end, the waist, the legs' end, a skirt's length and flare:
  drag one along its line and the garment is cut again on release) and the same as sliders, with the ease and the
  hang; **As designed** takes them back. They're the garment's own edits (`edit` in `character.json`: a sparse piece
  laid over the design's, `tailor.edited`), so the design stays as it is; **Export clothes OBJ** writes
  `People/<name>/<name>_clothes.obj` (one object per part, metres, Y up, facing +Z, the body's frame). The tailor runs
  in `tailor/worker.js` and refits on its own when the body's shape or height changes. What's worn is saved in
  `character.json` (`clothes`); the meshes are made live, like the hair styles, so there's nothing to go stale.
- **Node:** `tools/character/tailor.js` is a plain module. `node tools/character/tailor/sheet.mjs --outfit "work
  uniform" [--body feminine|masculine|average|slim_feminine|slim_masculine] [--height 1.62] [--close | --chest]
  [--uv | --debug] [--out x.png]` renders a contact sheet (Playwright); `node tools/character/tailor/check.mjs` is
  TAILOR, on five bodies: MHR's average, its feminine and masculine presets, and the slim ones in
  `tailor/bodies.json` (fitted with `mhr.py`'s `fit_measures` to a waist and hips 15 to 20% in).
- **Export clothes OBJ** carries the fabric coordinates (`vt`, metres) and the normals (`vn`).

## 4. Not done yet

- **Into Unreal:** the clothes have no skin weights yet. Each vertex comes from a point on the body, so its weights
  can be copied from the skin under it (the crop, the split and the cut each keep where their points came from). Then the clothes go to Unreal
  as skeletal meshes on the character's skeleton. A skirt's hem or a coat's tails can take Chaos Cloth painted onto
  that mesh. Hide the skin under tight clothes (Woohill's `hideSkinUnderCloth`) so it can't poke through in motion.
- **Fabric in Unreal:** the export has the coordinates; the tiles and the look still have to go across (a material
  instance per garment with the tile, its size, the colour or pattern and the print).
- **Seams and creases** are only where details are lifted; stitch lines and folds would be a normal map.
- Hair doesn't collide with the clothes yet.
