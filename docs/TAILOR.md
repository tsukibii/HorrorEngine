# The tailor: clothes cut from the character's own body

Clothes for the Character Studio's characters (DECISIONS 2026-10-23): our own generator after Woohill's character
creator (`tsukibii/woohill`, `creator/src/js/20-clothes.js` and `21-outfits.js`: its second skins and its hulled
fields), with far more polygons, because our bodies are realistic: clean garments that fit, with the details that read
at a game's distance (collars, plackets, buttons, pockets, waistbands, belts, cuffs, pleats) and a real thickness. There
are no sewing patterns. Since 2026-10-26 the cut cloth is **hung on the body by gravity**, a cloth simulation (§1c), and
baked as it hangs: it falls from the shoulders and the bust, folds where it's fuller than the body, tucks into what
closes over it, and a **Fit** takes any garment from skin tight to loose (DECISIONS 2026-10-26: the user found the
clothes lifeless). It replaces the GarmentCode route, which was removed. Since 2026-10-27 a garment is shaped in the
Studio's **edit mode** (§3c: its cut lines on the body itself, moved at once, nothing cut or hung until Bake), the
outfits are **pictures** of the default model wearing them (§3), and the **designer collection** after the user's
references (§2) is in.

## 1. How a garment is made

| Step | What | Where |
|---|---|---|
| Measure | horizontal slices of the body: the crotch (where the legs part), the armpit (where the arms leave the torso), the neck's base and axis, the bust, the waist, the hips (the seat at its fullest), the knee; each arm's centre line from the shoulder joint, its seam plane, elbow, wrist and fingertip | `tailor/scan.js`, `tailor/frame.js` |
| Cut lines | each garment kind as values on the body, positive on the cloth: the neckline (a cone round the neck's base dipped into a round, V or square neck; it starts where the cloth is, so loose garments don't climb the neck; `rise` takes it up the neck instead, a turtleneck), the hem (longer at the front or back for shirt-tails), the waistline (lower in front), sleeves cut square to the arm at a length along it, trouser legs at a height, a front opening (a V from `from` to the neck; `shift` slides it sideways on the way down: a wrap front's diagonal, a jeogori's) | `tailor/pieces.js` `neckline`, `opening`, `cutter` (which also says which line is nearest: `V.which`, for the guides) |
| Lift | the body's own mesh under the garment, plus a margin, lifted along the skin's normals by the **ease** (the body, the sleeves, the legs, a flare to the hem, more round the crotch; `shoulder`: a pad round each shoulder joint, above the armpit, so a jacket's shoulder is built rather than the body's slope: the art review, 2026-10-27), plus how far out the clothes already worn reach | `shell`, `shoulderPad`, `layers` |
| Relax | `tension` rounds of smoothing along the cloth's normals only, each followed by a push back out to its ease from the body: a stretched membrane that lies on what bulges and bridges what dips (under the bust, the waist, the spine, the small of the back). More rounds hang it looser. It's held back at the armpits and between the legs so it doesn't web them | `tailor/fit.js` `relax` |
| Refine | split in four (about 5 mm triangles), settled four more rounds at that size, then cut along the lines: the cut edges are interpolated, so every hem and neckline is one clean curve | `shell`, `mesh.js` `cut` |
| Skirts | rings hung from the waist instead: at every height the convex outline of the body (the torso's own loop above the crotch, never an arm beside it: a dress hung from the bust; both legs below; what's worn under it) plus the ease, never narrowing below the hips (`flare` widens it; `taper` makes a pencil skirt; `straight`: never narrowing from its top, a chima gathered under the bust), knife or box `pleats` stitched down to the hip, or `waves`; `open: {gap}` leaves it open down the front (a coat's skirts); the last ring is on the hem itself | `skirtOutline`, `skirt` |
| Details | parts of the garment's outside lifted a few millimetres off it: `neckband`, `collar` (rolled at the neck, points at the front), `placket` (a button band, or a fly with `x`), `band` (on the waistline: a waistband, a belt; or between two heights: a hem band), `cuff` (sleeves or trouser legs), `pocket` (a rounded rectangle seen from the front, the back or the side: patch pockets, flaps, cargo pockets), `lapel` (along a jacket's V, widest at the neck, rolled), `edgeband` (down an opening's edges: a cardigan's rib, a jacket's front band); a `collar` with `front: false` goes round the back only, for lapels; `buttons` are discs down a line (one big one is a buckle) | `detail`, `buttons` |
| Shoes | `kind: "shoe"`: the upper lofted round each foot as Woohill's footwear is (vertical sections across the foot every 3 mm, each the convex outline of the foot there, so the toes are one smooth toe box; the heel cup a wall, the toe rounded; the ease out; the ends rounded), its opening cut by `shoe` (`heel` and `vamp` heights, `from` where along the foot the upper is whole: a boot is high all round); the **sole** under it (`sole`: the footprint's outline pushed out by `overhang`, `thick` under the floor, `rise` up the side, toe spring, a `heel` block); `foot` details by where they are on the foot (a toe cap, a heel counter, a tongue) | `shoeShell`, `soles`, `frame.js` `feet` |
| Underwear | `bra`: a band round the ribs under the bust (the fold found under each breast's fullest point, `bust`), cups laid on the torso's front as a flat panel (the fabric coordinates' `torsoU` across, the height up): `triangle`, `balconette` (a nearly level top), `plunge` (the inner edges in a V down to the band), the gore between them, straps from each cup's highest point over the shoulder and down to the back band (or meeting between the shoulder blades: `racer`); `sports` one front panel to a scoop with wide straps; `bandeau` a band over the bust. `brief`: under the waistline, the leg openings: a `gusset` between the legs, the front panel widening to the hips, its edge rising to `side` over the crotch (`curve`: under 1 cut high at once, over 1 low and then up); the back from its own gusset (a thong's strip) with its own `curve` and `drop` over the seat, or (`band`) rising from the strip to just under the waistline: a thong's V or a G-string's T. Skin tight (1.5 mm of ease, `tension` 8); `fine: 2` splits the cloth once more (about 2.5 mm) so straps and strings have clean edges; a `trim` detail lifts a band along every edge (the elastic) | `bra`, `brief`, `bust` |
| Thickness | an inner surface and a crisp rim round every open edge; the rim and the outside's last row of points are shaded darker (`S`), so hems, pockets and collars read as stitched edges with a shadow | `fit.js` `thicken` |
| Fabric coordinates | every point gets (u, v) in metres, laid the way a sewn garment's panels lie: the torso a front and a back panel (u the arc length across each row's own outline from the middle, over the shoulders a yoke by x; side seams), a sleeve round the arm's line (the seam underneath), a trouser leg round its own line from the waist down (the seam at the back, a stocking's), a skirt a front and a back panel spreading to the hem; every ring's own radius, so a tile is its real size all round. The mesh is split exactly along each seam first, so seams are clean lines; normals come from the joined mesh, so the light doesn't break there. `sheet.mjs --uv` shows them as a 5 cm checker | `tailor/uv.js`, `frame.js` `torsoArcs` |

| Fit | a piece's `fit` (1 as designed) scales its ease and how freely it hangs before it's cut: 0 is **skin tight** (1.5 mm of ease, 6 rounds of relaxing: into every hollow, nothing to hang, a skirt straight down), 2 is loose (2.5 times the ease, more rounds, a fifth more cloth round the body, twice the flare) | `tailor.js` `fitted` |
| Drape | the cut cloth hung by gravity (§1c); every detail, button and handle is cut where the cloth was cut and sewn where it hangs, the fabric's coordinates the cut's (a stripe follows the cloth into its folds) | `tailor/drape.js`, `fit.js` `lifted`, `uv.js` `unwrap` (`at`) |

Layering is by order: each garment goes over the ones before it. What's under it is measured as a thickness over the
body (how far out the earlier garments reach at each point of the skin), and the new garment's ease starts there.
Nothing is pushed off another garment's open mesh: that tore at hems and pockets. **Bottoms first** and the top hangs
over them; **a top first** and it's tucked in.

A garment is 25k to 165k triangles (the check prints them all). Cutting one on a body takes about 0.5 to 3.5 s; the
Studio does it in a worker. Keeping the cloth off the skin walks the skin's mesh from the point each bit of cloth
came from (a few steps, not a search), except where another part of the body is near (between the thighs, at the
armpits), where it searches properly every round.

## 1c. The drape: hung by gravity

`tailor/drape.js` takes a garment's cut outside and lets it fall onto the body and onto the clothes already worn
(each of those hung first), in MHR's own pose, for a second or so, until nothing moves. Position-based cloth in small
steps (XPBD, Macklin et al. 2019), 600 steps a second, in real units (metres, kilograms, seconds):

- **Lengths**: every edge keeps its length, two plain Gauss-Seidel passes a step, from the top down (the weight is
  carried up to what holds it). Pushed shorter it gives half as much as pulled longer: cloth folds rather than shrinks
  (with almost nothing against shrinking, an A-line skirt's hem drew in ten centimetres instead of folding).
- **Bending**: every two triangles resist bending away from flat (quadratic bending, Bergou et al. 2006: fabric is flat
  before it's sewn), the design's `bend` in N m, but never stiffer in a step than the points it moves are heavy (a
  stiffer one fights the lengths and buzzes for ever: LESSONS); in each pass with the lengths, its stiffness shared
  between the passes (once a step after them, the two undid each other into the cloth's speed: a soft knit's sleeve
  rocked for as long as the drape ran).
- **Long range attachments** (Kim et al. 2012): no point ends further from where the garment hangs from than the cloth
  between them reaches, so it hangs without stretching: about 3% stretched at most for one edge in ten.
- **What it lies on**: each point's plane at its closest skin (walked from the last, searched where another limb is
  near), raised by how far the clothes under it stand off the skin there, the cloth's thickness and half a millimetre
  more; asked again only as often as the point could reach it (half its way to the plane: a skirt's hem a hand off the
  legs asks seldom). **Friction** there (0.5).
- **Held** where a garment holds: a bottom by its waistband, a skirt by its waist, a top round its neckline (or it sags
  into a V), the cloth under a **neckband**, a sleeve's **cuff** (buttoned or ribbed round the wrist: the sleeve blouses
  above it and never slides over the hand) and a ribbed hem (rib pulls in round the hips), a top **tucked** into
  trousers or a skirt worn over it later (held under that waist, blousing above it), and a **sleeve inside** a sleeve
  worn over it later (a shirt's in a blazer's, a top's in a cardigan's): held as cut, pressed to the arm, so the jacket's
  isn't cut over a sagging shirt sleeve and then sags again (a balloon from the elbow down). A **buttoned front** (`open` with
  `buttons`) is kept closed between the buttons; below them it may part. A sliver of cloth the cut leaves on its own
  (where an opening meets a hem) stays as cut.
- **Fullness** (`slack`): cloth round the body beyond the cut's, under a top's bust and down a bottom's legs (never
  over the shoulders, round the seat or down a sleeve, whose ease makes it loose: between its shoulder and a cuff that
  holds, more cloth only buckles, creeping on for as long as the drape runs): it falls into folds. `drop`: more along
  the body, for legs that bunch.
- It **settles**: damped (4 a second, much more at the end) and stopped when the cloth moves under 2 mm a second.

The cut's points hang; the garment's parts are made from them: the thickness, the details lifted off the hanging cloth
(cut where they were on the cut, so a pocket stays where it was sewn), buttons on the same points, the handles where
the cloth now is, the fabric's coordinates from the cut. A design hangs if its piece has `drape` (§2): the tops,
trousers, shorts, skirts, the coverall and the jackets; underwear, legwear and shoes don't (skin tight, or rigid), nor
does anything at a fit under a quarter. A garment of 11k points (a t-shirt) takes 2 to 3 s here, a skirt's 24k about
5 s (`node tools/character/tailor/sheet.mjs --drape`).

**The bake**: what a garment fell to is kept by a key (`tailor.js` `drapeKey`: the drape's version and settings, the
body, the cut of it and of everything worn under it, and for each of those what holds it from over it, the waists it's
tucked into and the sleeves round its own) and taken as it is next time instead of falling again. The Studio saves the
bakes as `People/<name>/drape.bin` (a header, then each garment's points) and carries it in the export's recipe; a
changed body, garment, layer under it or what closes over it (trousers put on over a shirt that hung alone) misses its
key and falls again. Shoes change nothing; socks and tights do (they have a waist, and what's worn under them in the
list is tucked into it).

## 1b. Fabrics, patterns, prints

`tailor/fabric.js` ports Woohill's surfaces (`creator/src/js/60-character.js` `surfaceTile`, `surfaceAux`; their sizes,
gloss and relief from `20-clothes.js`): each a seamless tile drawn in code at four times Woohill's size, the cloth's
light and dark round a mid grey, laid on the fabric coordinates at its real size in metres. **Cotton, jersey, denim,
canvas, twill, knit, rib, wool, tweed, silk, satin, spandex, leather, patent, suede, velvet, quilted, sequin** (discs
in staggered rows, each catching the light its own way), **laced** (lace lined: the same net and flowers raised on an
opaque ground, for a lace top that isn't see-through), and the three that let the skin through: **sheer** (pantyhose:
the nylon at its `denier`, darker where the leg turns away, a sheen down the leg), **fishnet** and **lace** (their
holes are empty). Each also gives a relief (a bump map) and a gloss
(less rough). **Patterns** in the garment's own colours (stripes, pinstripe, vertical stripes, gingham, checks, plaid,
polka dots, houndstooth, camouflage) at a repeat in metres; **prints** (`prints`, up to three; `print`, one, as of old):
each text set in type, or a picture (a file, or one from the prints library, `Content/Studio/Clothes/prints/`, our own
made by `tailor/make_prints.py` and yours dropped in), placed on a panel (front, back, a sleeve, a leg, a skirt's front)
across and up it, a width, a turn: a tee's front and back print, a sleeve's. `tailor/look.js` makes the
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

## 1d. Creases (DECISIONS 2026-11-01)

The user: "what makes our clothes bland is we are missing creases, natural fabric kinda style that could be emulated via
PBR techniques ... add a crease gen as well (basically how we emulate wrinkles on faces)". `tailor/crease.js`: the
cloth's small relief drawn as a height in the garment's shader (`clothH`, in metres of cloth, at the fabric coordinates'
real size), never as geometry; the drape (§1c) gives the big folds, this what a sewn, worn garment has on them:
**folds** where the body bends (rings round the limb inside the elbow and behind the knee, each fold its own spacing,
tilted one way then the other, only part of the way round; a sleeve stacking at the wrist, a trouser leg breaking on the
shoe, the waist), **drag lines** (diagonal pulls from the crotch over the thigh, a jean's whiskers, and from the armpit
across the chest), the **press** (a sharp ridge down the middle of a trouser leg's front), **seams** (the stitched line
sunk in, the cloth puckered a few millimetres either side, the pucker coming and going along it), **hems** (the turned
edge rolled, the turn-up ending 2.5 cm in, a row of stitches 1.3 cm in), the fabric's own **crinkle** (thin crease
lines along a noise stretched down the hang, a softer shoulder either side, wrinkled in patches) and fine **drape**
streaks down skirts and wide legs. Per vertex, `crz` is made when a part is unwrapped (`creaseData`): how much it
bunches and is pulled there (from the body's frame: the elbow, the knee, the ankle, the crotch, the armpits, the
waist), and how far it is along the cloth from the nearest seam and the nearest hem (Dijkstra along the mesh, relaxed so
the lines come out smooth). The amounts come by fabric (`CREASE`: linen wrinkles most, wool and tweed a little, knit and
rib almost none, denim's folds deep, a twill's and flannel's press holding) times the garment's **Creases** slider (the
Studio, a garment's look: 0 none, 1 as the fabric has them, 2 well worn) and its **Pressed crease** switch (trousers);
a design can carry its own (`crease: {press: 1}` on the wide pleated trousers). The slope bends the normal in the view;
the valleys darken the colour a little. **In the export** the creases are baked into the garment's normal map on its own
layout (`albedo.js` `bakeClothNormal`, at 1.5 mm a texel), so the desk and Godot show them; a file has one normal map,
so a PBR set's weave normal gives way to it there.

## 1e. Fabrics made in Blender (DECISIONS 2026-11-01)

The user: "similar to what we did for props and buildings can you create some procedural materials with blender for the
clothing in the studio, stuff like cotton, etc.". `tools/streetbake/fabrics.py`: node groups read in metres, as the
street's library is (and baked by the same `tiles.py` into `assets/pbr/Procedural/fabric_<name>/`: colour, normal,
roughness, ORM, height, a lit picture), built from what each cloth is made of at its real size: **weaves** (threads
over and under: poplin, cotton, oxford's basket, linen with its slubs, canvas, chambray, denim's 3/1 indigo twill with
its streaks, washed light denim, gabardine, chino, herringbone, five-harness satin; each thread its own shade and
thickness along it), **knits** (jersey's Vs, a chunky sweater, 2 x 2 rib, waffle), **felts** (flannel's brushed fuzz
over a faint twill, fleece, melton), **hides** (leather's fine pebbled grain and pores, suede's nap) and **piles**
(corduroy's wales, velvet, crepe's pebble, boucle's loops, tweed's flecked twill). Each tile is a whole number of its
threads or stitches, so it repeats without a seam (FABRICS checks it). Most are white-based: the Studio lays the
garment's colour over them (their `tint`); denim, chambray and tweed carry their threads' own colours.
`python tools/fabric_bake.py bake` makes them (Blender's module, `python tools/retarget.py setup` once), `list`, `sheet`
(`Saved/Story/_look/fabrics/sheet.jpg`), `check` (FABRICS). In the Studio they come first in a garment's **PBR set**
picker, "(made)", tinted by default; the smart casual designs name theirs (`pbr: "pbr/Procedural/fabric_crepe"`), and
on a machine where it isn't baked a garment falls back to its drawn `surface`. Three drawn surfaces were added beside
them: **linen**, **crepe** and **flannel** (`fabric.js`).

## 1f. The smart casual collection (DECISIONS 2026-11-01)

After the user's sheet of Japanese smart casual outfits (eighteen looks, phone held over the face): a new tab,
**Smart casual**, first in the outfit picker, fifteen outfits (`group: "smart"`), and the cuts they needed: **wide
pleated trousers** (high waisted, wide and straight, pressed: crepe or flannel), a **tie-neck blouse** (its bow's tails as
two plackets and a knot), a **blouse with full sleeves** (gathered into long cuffs), a **shirt** (sleeves rolled, a breast
pocket, worn striped), a **cropped collarless tweed jacket** (gold buttons, boucle), a **collarless jacket** (melton), a
**cropped leather jacket** (worn open), a **knit midi skirt** and a **pleated midi skirt**. The shirts and blouses are
worn tucked in (listed before the trousers). Not made: the sweater knotted over the shoulders, the bags.

## 1g. Everyday clothes that hold up in animation (DECISIONS 2026-11-01, the clothing review; docs/CLOTHING_PLAN.md)

The clothes are skinned, never simulated, so the cut keeps to what skinning carries and looseness is shown, not built:

- **Snug waistbands**: a bottom's ease falls to the cloth's 2.5 mm at its waistline and opens to the design's over
  the hip (`shell`); a skirt's top ring the same (`skirtOutline`). It's what holds them up.
- **Bridged hollows** (`bridge` in pieces.js, after the relax): each centimetre's slice of the cloth on its convex hull
  round the torso's axis (above the crotch) or each leg's line (below it), carried up and down so it comes back in no
  faster than a slope: no dent into the buttocks' cleft, between the breasts, down the spine or behind the knee; it
  tents over the kneecap. A loose top's slope is shallower front and back (it falls from the bust and the shoulder
  blades), never at the sides (cloth standing out from the waist is in the arms' way); bras and thongs aren't bridged.
  A skirt never comes in past the legs' hull in the drape (`rings.floor`: its back buckled into the gap).
- **Ease limits**, checked by TAILOR: tops 12 mm (jackets and coats 16), sleeves 14, a bottom's body 12, legs 18, a
  skirt's 16, the drape's `slack` at most 3 %.
- **Bagginess by creases** (crease.js): a loose top's hang (by its ease, 4 to 14 mm) as soft vertical folds down the
  front from under the bust and down the back from under the shoulder blades, the sleeve's sag along its underside,
  more blousing at the waist; carried in the creases' drag channel as a negative value, baked into the export's normal
  map with the rest.
- **The wardrobe**: outfit groups Casual, Smart casual, Business, Uniforms, Sleepwear, Swimwear, Underwear, Designer;
  new basics joggers, sweatshirt, polo, suit trousers, pyjama top and trousers, sleep shorts, swim shorts; bikinis from
  the underwear's cuts in spandex; fabric, colour, pattern and prints doing the variety. Not made yet: a shirt dress
  and a one-piece swimsuit (the shell can't cut a dress's or a swimsuit's legs without a new cut).

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
| `neck` | `false`, or `{shape: round \| v \| square, depth, back, width, tilt, rise}` (`rise`: metres up the neck, a turtleneck or a mock neck; its neckband is then the roll) |
| `sleeve` | `short`, `cap`, `elbow`, `wrist` (each with an offset down the arm: `elbow+0.06`, rolled to below the elbow), or metres from the shoulder joint; the wrist and the elbow are found on the body and checked against MHR's own joints |
| `hem` | `{at, front, back, side}`: a top's hem; `front`/`back` lengthen it there, `side` raises the sides |
| `waist` | `{at, drop, rise}`: a bottom's waistline, `drop` lower in front, `rise` higher at the back |
| `legs` | `{to, straight}`: where the trouser legs end; `straight` (0..1, wide pressed trousers) sets the legs out from under the seat into a column as wide as the thigh plus the leg's ease, never following the knee or calf in, and the drape holds them as cut |
| `open` | `{from, gap, top, curve, shift}`: a jacket's front opening, a `gap` down the middle (a closed front's edge when it's a couple of millimetres) widening into a V from `from` to `top` each side at the neck; `shift` (metres, + to the body's left) slides the opening's middle sideways from the neck down to `from`, and straight below: a wrap front, its edge a diagonal across the chest (an `edgeband` along it is a jeogori's collar band); `closed: false` is a front worn open (a wide `gap` from `from` down, the lapels falling open), which the drape never pulls together |
| `ease` | `{body, sleeve, leg, flare, crotch, shoulder}` in metres off the skin (`shoulder`: the pad at each shoulder joint, 0.009 to 0.016 on jackets and coats, 0.003 to 0.008 on shirts and sweatshirts) |
| `tension` | rounds of relaxing: 18 clings, 48 hangs like a work shirt |
| `fine` | 2: the cloth split once more (about 2.5 mm triangles), for narrow parts: straps, strings |
| `fit` | 1 as designed, 0 skin tight, 2 loose (§1, `fitted`): the Studio's Fit slider |
| `drape` | how it hangs (§1c): `{density (kg/m²), bend (N m), slack, drop, memory (1: keeps the bend it was cut with: pressed pleats), friction, on}`, over `drape.js` `DRAPE`; no `drape`: it doesn't hang |
| `bra` | `{style: triangle \| balconette \| plunge \| sports \| bandeau, band, top, outer, gore, strap, rise, drop, racer}` (sports: `scoop`, `panel`, `strapX`, `bottom`): metres on the average body |
| `brief` | `{side, gusset, curve, deep, back: {gusset, curve, drop, band}}`: the leg openings under the `waist` |
| skirt | `waist.at`, `length`, `ease`, `flare` (m per m), `taper`, `straight` (never narrowing from the top ring, not only below the hips), `open: {gap}` (open down the front, `gap` metres wide), `columns` (256), `pleats: {n, depth, stitched, box}`, `waves: {n, depth}` |

`Content/Studio/Clothes/outfits.json`: an outfit is `[[design, colour, look, edit], ...]` in the order worn (the
edit a garment's own, as the Studio keeps it: `{"fit": 1.5}` for a shirt worn oversized, `{"length": "knee+0.22"}` for
a skirt cut to a mini); its `meta` entry (by name) gives its `group` (`designer`; the rest are the studio's, or
underwear by their names), what it's `after`, and the `accessories` the Studio puts on with it (a hat, sunglasses:
accessories.js kinds, in place of the same kinds worn).

**The designer collection** (2026-10-27, DECISIONS: "add some new stylish clothing under a tab called designer", one
outfit per reference image, more where an image showed several looks): `hanbok: lace jeogori and pleated skirt`
(a white lined-lace **jeogori** (`jeogori-lace`: a wrap V by `open.shift`, the collar band an `edgeband` along it, the
ribbon's two tails as plackets and its knot a button) over the pleated skirt cut to a mini, **over-the-knee socks**,
a beret), the street looks `street: pink blazer and plaid mini` (an **oversized blazer**, a satin **cami top** (the bra
cut with a band down to the hips), a plaid **mini skirt**, **knee-high boots**, a cap), `street: cargo pants and crop
tee` (**cargo pants** with a belt and ribbed hems that hold, a **crop tee**, **combat boots**, a cap), `street: leather
pleats and graphic tee` (the pleated skirt in leather, the t-shirt oversized with a print, white socks, combat boots),
`street: sequins and a blazer` (a strapless **sequin mini dress**: a skirt hung from under the armpit, tapered; the
blazer loose; heeled **ankle boots**; sunglasses), `rainy day: long coat and wide jeans` (the **long coat** as two
garments, its top a jacket to the hip and its skirts a skirt open down the front worn under it, over a **turtleneck**
(`neck.rise`) and **wide-leg jeans** with a brown belt), `modern hanbok: cream lace` (a sheer **jeogori** with
three-quarter sleeves over a **chima**: a skirt hung from under the bust, straight and full, waved, with its wide band)
and `modern hanbok: navy and plum` (a plain jeogori with a cream collar band, a plum chima), and the menswear
`menswear: blazer and knit` (a **knit top**, **trousers with a belt**, the blazer), `menswear: double denim` (a
**denim shirt** with pearl snaps tucked into **jeans**, **cowboy boots**), `menswear: denim jacket` (a **trucker
jacket** open over a white tee, navy belted trousers with turned cuffs) and `menswear: hoodie and jeans` (a **hoodie**:
its hood a wide collar rolled down the back, a kangaroo pocket, drawstrings, ribbed hem and cuffs). The combat, cowboy
and heeled ankle boots are lofted from the foot as the work boots are; the knee-high boots are cut as a shell with
the shoe's line (lofted from the foot, a shaft to the knee cut into the calf). **Tailored after the user's
references** (2026-10-26, DECISIONS): cut close and following the waist (the tops' tension about halved, their ease a
third less), the drape's fullness only enough for soft folds; a **blouse** (light cotton, a collar, a placket, six
buttons, short sleeves) and one with its **sleeves rolled** to below the elbow; the pleated skirt high on the waist,
mid-thigh and full; the pencil skirt high, close over the hips and tapered; a **fitted blazer** (to the hip, a deep V,
one button at the waist) beside the men's. Outfits after the pictures: `school uniform (summer)`, `office (pencil
skirt)`, `skirt suit`, `shirt and shorts` (the long work shirt at fit 1.5), `t-shirt tucked in` (the man's). Built now: the
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
  hang; at the top its **Fit** (skin tight to loose); **As designed** takes them back. Under it, a design that hangs
  has **Hang**: on or off for this garment, its **Fullness**, **Stiffness** (silk to canvas, a log of N m) and
  **Weight** (kg/m²). **Hang by gravity (cloth simulation)** turns the drape for the whole outfit: the worker gives the
  cut clothes back at once, then hangs them a few dozen steps at a time (the status line says which and how far; a
  newer edit stops it), and the hung ones replace them; **Save** keeps them baked (`drape.bin`), opening the character
  takes the bake, and Export waits for the clothes to hang. They're the garment's own edits (`edit` in `character.json`: a sparse piece
  laid over the design's, `tailor.edited`), so the design stays as it is; **Export clothes OBJ** writes
  `People/<name>/<name>_clothes.obj` (one object per part, metres, Y up, facing +Z, the body's frame). The tailor runs
  in `tailor/worker.js` and refits on its own when the body's shape or height changes. What's worn is saved in
  `character.json` (`clothes`); the meshes are made live, like the hair styles, so there's nothing to go stale.
  The outfits show as **cards with pictures** (`Content/Studio/Clothes/thumbs/<slug>.jpg`, the default model wearing
  each, hung by gravity: `tools/character/tailor/thumbs.mjs`; a card without its picture shows its name alone), in
  groups by `meta`: Designer, Studio, Underwear; a click wears the outfit and puts on the accessories it brings.
- **The edit mode** (§3c): **Edit the cut (no cloth)** above the worn list draws every garment as a film on the body
  with its cut lines, and the handles and the Shape sliders move them at once; **Bake** cuts and hangs the clothes.
- **Node:** `tools/character/tailor.js` is a plain module. `node tools/character/tailor/thumbs.mjs [--only "a,b"]
  [--designs | --outfits] [--body default|feminine|masculine] [--no-drape]` pictures every outfit (and every design
  alone, `thumbs/design_<name>.jpg`) for the Studio's cards; run it after adding or changing one. `node tools/character/tailor/sheet.mjs --outfit "work
  uniform" [--body feminine|masculine|average|slim_feminine|full_masculine...] [--height 1.62] [--close | --chest]
  [--uv | --debug] [--drape ['{"t-shirt": {"slack": 0.3}}']] [--edit '{"t-shirt": {"fit": 0}}'] [--out x.png]` renders a
  contact sheet (Playwright), hung by gravity with `--drape` (and a design's drape settings over its own), with a
  garment's own edits as the Studio keeps them; `node tools/character/tailor/check.mjs` is
  TAILOR, on seven bodies: MHR's average, its feminine and masculine presets, and the slim and full ones in
  `tailor/bodies.json` (fitted with `mhr.py`'s `fit_measures`: a waist and hips 15 to 20% in, or a waist 15% out with
  a rounder belly, wider hips and thicker thighs). Where a gap in the body is narrower than the cloth's clearance
  (between full thighs), the cloth settles in the middle of it, outside both sides.
- **Export clothes OBJ** carries the fabric coordinates (`vt`, metres) and the normals (`vn`).

## 3b. In motion

The drape is baked in MHR's own pose, the pose everything is saved and exported in; the Studio's T-pose view turns the
hung clothes with the arms (a sleeve's fold under the arm turns with it). In motion the clothes move with the body by
its own skinning:
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

## 2b. The art review: what made the clothes read wrong, and the rules that came out of it

The designer collection was reviewed by eye on contact sheets (2026-10-27, "some don't look natural"), five views and a
close one per outfit, and fixed outfit by outfit. What read wrong, and the rule each left behind:

- **Woven, structured garments read as knitwear** (the denim shirt, the trucker jacket, the blazers, the coat): the
  cut hugged the body like a membrane and the drape softened it further. A structured garment wants three things: a
  **shoulder** (`ease.shoulder`, a pad round each shoulder joint), more **tension** (30 to 56 rounds: the cloth
  bridges the hollows instead of lying in them), and the drape's **memory** with a stiff **bend** and little **slack**
  (denim and wool keep their cut; jersey and knit may hang loose).
- **A blazer or coat worn open must be cut open**: `open` from the hip up with a wide `gap` and `closed: false`, the
  lapels along it and no fastened button (one decorative, on the left front's edge). Cut closed and loosened, a blazer
  is a cardigan; the coat was a dressing gown. `blazer-open` is the design for it; the office and school blazers stay
  closed.
- **A turtleneck's collar is soft**: a modest `rise`, the neckline hugging the neck (`open` 0.002, little ease), a
  thinner cloth and a narrow rib neckband; risen 7.5 cm with a thick band it was a brace up to the jaw.
- **A turned cuff must not hold the wrist** (`hold: 0` on a coat's cuff): held, the sleeve's fullness bloused above
  it into a balloon.
- **Jeans keep their cut at the ankle**: `memory` and no `slack`, or the wider calf's cloth slides down and bells.
- **A hood down is a flat flap**, a wide collar over the back with no roll, plus a narrow rolled rim at the neck; one
  rolled collar was a neck pillow.
- **Fabric tiles must be quiet on a big surface**: the lined lace's flowers at a 7 cm repeat read as polka dots (now
  3.6 cm, faint); silk's streaks read as creases down a long skirt (now a faint slub); satin's band of light tiled into
  blocks (now gentle). Judge a tile on a skirt, not a swatch.
- **A tall boot's shaft is wider than the leg** (ease 0.012 to 0.013, a heel, a band at the top); cut like a sock it
  was a sock.

## 3c. The edit mode: the cut lines, no cloth

Editing a garment used to cut and hang the whole outfit again at every change: minutes a slider on a long outfit
(DECISIONS 2026-10-27, "it takes 2 minutes to update the change"). With **Edit the cut** on, nothing is cut:
`tailor/guides.js` evaluates the design's own cutter on every point of the skin (the cut's value, which of its lines
is nearest there: the neckline, a front opening, a sleeve's end, the hem, the waist, the legs' end, a shoe's line,
underwear's own shape, and how far off the skin the cloth will sit: its ease by the fit, over the garments under it),
and `cutedit.js` draws each garment as a **film** on the body: a shader on the shown body's own points, lifted along
its normals by that ease, discarded where the value is negative, with the line drawn at the value's zero in the
garment's line colours (the handles' hues: hems and waists yellow, necklines and openings green, sleeves and legs
blue, shoes orange, underwear pink), so it follows the pose, a sculpt and the zoom. A skirt is its **rings** (`skirtOutline`
every 4 cm, the last on the hem, four lines down them), skinned into the view's pose. The **handles** are
`pieces.js`'s own `handles`, found on the skin's points lifted (and the middles and crossings of its edges, the skin's
mesh being too coarse for a handle's window), so they sit where the cut's would. A slider or a drag remakes only the
garments that changed (a few tens of milliseconds each; the body's frame is measured once per body), the line
following the handle as it's dragged; a body change in the edit mode measures the guides again instead of cutting.
**Bake** (or the mode off with something changed) runs the tailor once with every edit; an export or the clothes' OBJ
bakes first. TAILOR compares the guides with real cuts: their top and bottom within 2 cm, each handle within 3 cm of
the cut's own (8 at a trouser hem, where the relaxed cloth bridges the ankle's hollow).

## 4. Not done yet

- **The pictures** are the clothes alone: a hat or sunglasses an outfit brings aren't in them (they need the face's
  landmarks, which only the Studio has); a bag or a scarf from a reference isn't made at all.
- **The long coat** is two garments (its top and its skirts) because a shell's hem can't pass the crotch (below it the
  skin is two legs); a coat kind that joins them is still to do.

- **Into Unreal:** the weights are there (§3b); the export isn't: the clothes still leave as OBJ. They go to Unreal
  as skeletal meshes on the character's skeleton (an FBX or glTF with `weights.js`'s bones and weights), a skirt's hem
  or a coat's tails with Chaos Cloth painted onto that mesh. Hide the skin under tight clothes (Woohill's
  `hideSkinUnderCloth`) so it can't poke through in motion.
- **Fabric in Unreal:** the export has the coordinates and, for a PBR set, its ref and repeat (`# pbr` in the OBJ;
  the shelf already imports a set into Unreal as `MI_<name>`); the made-up tiles, patterns and prints still have to go
  across (a material instance per garment with the tile, its size, the colour or pattern and the print), and Unreal's
  import of a set doesn't use a packed ORM yet (the separate maps).
- **The drape** doesn't keep the cloth off itself (a deep fold can pass through its neighbour), hangs only in MHR's own
  pose (not a pose of the desk's), and isn't seen falling (the hung clothes replace the cut ones when they've settled).
- Hair doesn't collide with the clothes yet.
