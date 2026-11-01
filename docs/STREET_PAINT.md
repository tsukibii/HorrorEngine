# Street paint: the material library, decals, and the paint page

Asked on 2026-10-31 (DECISIONS, before dawn): "a simple python script wrapper tool (similar to what that prop-tool is
doing), where I can just paintbucket paint on the materials and then zoom in to add decals"; "pre-make a bunch of
building, street, roof tile etc materials to paintbucket, based off the Japanese materials in the real photos". Then
(that afternoon): "without PBRs we can't achieve the fake photorealistic look": the materials are the project's PBR
sets (`pbr/`), tuned and layered with what was made in code (§3b). The research behind it is
docs/research/photoreal.md. The streets come from the street builder (docs/STREET_BUILDER.md),
and the bake into Blender and Godot is docs/STREET_TEXTURING.md.

## 1. Using it

```bash
python tools/street.py library      # once: the material library baked onto the PBR shelf (about 15 minutes on a CPU)
python tools/director/serve.py      # the desk's server, then open http://127.0.0.1:8780/paint.html
```

The dashboard and the launcher have it in Pages as **Street paint**.

- **The header:** the street, a shot to look through (the photo's, to paint 1:1 against it), the light you paint under
  (day, dusk or night: only the view, the street keeps its own time of day), Undo and Redo (Ctrl+Z, Ctrl+Y), Save
  (Ctrl+S). The previous version is kept in `Saved/Streets/<name>/history`.
- **Paint (1):** pick a material from the library on the left (the PBR sets by category: road, asphalt, concrete, wall,
  building, roofing tiles, metal, plastic, gravel, floor, foliage, effects, then your own; the first library, made in
  code, is folded away at the end), tune it in **the brush** under the colour row, then click a surface. What a click
  would paint lights up as you hover:
  - **this one's surface**: this building's walls (its road's asphalt, its thing's metal);
  - **every one on the street**: every wall that doesn't have its own.

  **Alt-click** picks up what's on a surface, into the brush. **A colour** paints a flat colour instead. **Clear**, then
  a click, takes the paint off (back to the street builder's colour).
- **The brush** (a set picked, tuned and layered):
  - **tint** (a colour and its amount: the set's colour becomes it, its light and dark kept, so it averages the tint:
    pick the colour a surface really is), **brightness**, **contrast** (its pattern stronger or fainter about its own
    mean), **saturation**, **hue**, **fade** (washed out toward a pale, sun-bleached version of itself), **roughness**
    (rougher over 1, shinier under), **relief** (its normal map's strength), **size** (its real size times this),
    **turned** (0, 90, 180, 270°). A double-click on a slider puts it back.
  - **Layers over it**: *+ a set over it* lays another set over this one (moss, prints, scuffs, stains) in soft
    patches (coverage, patch size, softness, a seed), by its own opacity map (the fingerprints, the imperfections), its
    mask in patches, or all over; changing the colour, shine and relief, only the shine and relief (prints, smudges),
    or only the colour; with its own size, tint and brightness. *+ decals* scatters one of the decals (§4: scuffs,
    prints, gum, cracks, stains, stickers...) a few times over each repeat, upright or turned, its colour and shine
    over the set's. *+ wear* sets the bake's wear on this surface (grime,
    rain streaks, worn edges, damp patches: 0 none, 1 as the street wears, 2 twice; seen in Blender's render and in
    Godot). ↑ moves a layer under the one before, × takes it off.
  - **Tune the last surface**: on (the default), every change goes onto the surface painted or picked up last, at
    once: Alt-click a surface, then tune it while you look at it.

  A tuned look is a set of its own the desk's server makes in a second or two (§3b): what the page shows is what
  Blender bakes and Godot gets. The library and the brush are `brush.js`, shared with the scene builder's **Paint**
  (SCENE_BUILDER §9): the same brush on a level's rooms, blocks and outside (no wear layers there: a room has no bake).
- **Decals (2):** pick one, hover to see it where it would go, click to lay it. Click one to select it: drag it along
  the surfaces, the wheel sizes it, R turns it (Shift+R the other way), Delete takes it off. On a wall a decal stands
  upright; on the ground it turns with your view.
- **The view:** right-drag turns, middle-drag (or Shift and right-drag) pans, the wheel zooms toward the pointer, a
  double-click looks there.
- **In Blender (right):**
  - **Render the shot** runs `street.py look` through the chosen shot, beside its photo (quick: 16 samples, small).
  - **Bake for Godot** runs `street.py bake`: the sets, the wear atlas, the .glb and the .blend. *Picture it in Godot*
    adds GDSTREET's picture.

  The page saves first. Blender works in the background with its log on the page, and its pictures appear underneath.
  Click one to see it large.

## 2. What it writes

Only the street builder's own words, so whatever you paint shows in the street builder too:
- **A piece's `look`** (a building's, a road's, a thing's, a fence's): `{"wall": "pbr/concrete/Concrete027_1K-PNG"}`;
- **The street's `look`**, for every surface of that kind without its own: `{"asphalt": "pbr/road/Road013A_1K-PNG"}`;
- **A tuned look** in either, an object (§3b):
  `{"set": "pbr/concrete/Concrete027_1K-PNG", "tint": "#c7a99b", "contrast": 1.1, "layers": [{"wear": "streaks",
  "amount": 1.4}, {"set": "pbr/foliage/Moss002_1K-PNG", "amount": 0.5, "coverage": 0.2, "size": 0.6}]}`. The street
  builder shows it and keeps it (its inspector marks it "+ Street paint's"; a set picked there replaces it).
- **`decals`**: `{"id": "d3", "kind": "drain_grate", "at": [x, y, z], "n": [nx, ny, nz], "w": 0.4, "h": 0.9, "rot": 0}`.
  A decal lies a GAP (1 cm) off its surface, facing along `n`, `w` × `h` metres, turned `rot` degrees. Its up is the
  world's up on a wall, and north on the ground.

A building with a set inside that's painted here keeps its own outside from then on (`inside.own`), as if it were
changed in the street builder.

## 3. The material library

`tools/streetbake/library.py`: 49 Japanese exterior finishes after the reference photos. Each is a procedural Blender
node group read in metres, its height faked into a normal map (the joints, grains, ribs and waves), with colours kept
to measured albedos (docs/research/photoreal.md §3). `python tools/street.py library` bakes each once onto the PBR shelf
as a full-colour, seamless set at its real size (`assets/pbr/Procedural/jp_*`), with a lit picture for the page
(`_lit.jpg`).

| Group | Materials |
|---|---|
| walls | sprayed mortar (cream, beige, grey), stucco, white plaster, ALC panels |
| tiles | 45 × 95 (white, beige, grey, brown), 227 × 60 raked brown, the 1970s 50 × 50 mosaic |
| siding | ceramic siding (brick, stone), painted boards, weathered planks, charred cedar |
| concrete | exposed (its forms and P-cones), weathered dark, precast pink panels, block walls, granite (polished black, flamed grey) |
| metal | corrugated (galvanised, painted), spandrel, shutter slats, painted steel (white, grey-green), anodised aluminium, rust |
| roofs | kawara (ibushi silver, glazed blue, glazed black), Colorbest slate, galvalume standing seam, a flat roof's coating |
| roads | asphalt (new, old with cracks and patches), the green and the red lanes |
| pavements | concrete pavers, interlocking blocks, tactile paving (dots, bars), a precast kerb, gravel, packed earth |
| other | window glass |

- **Nothing is perfectly smooth** (the user, 2026-10-31: "there are no perfectly smooth things; things tear and chip,
  smudges, fingerprints"). Every library material and every finish wears its imperfections as it's baked, by what it
  is (`imperfect`):
  - smudges and stains on everything (a touch darker, another shine);
  - fingerprints and hand grease only on what's touched: glass, bare metal (sashes, doors), plastic (a haze on glass);
  - hair-thin scratches in patches on glass, metal, plastic and paint (brighter on metal, through to the primer on
    paint, half as many on a painted wall);
  - chips and nicks on paint, tiles, concrete, mortar and plastic (a fresh break, or the primer), fewer on roofs;
  - hairline cracks in mortar, concrete and asphalt; lichen and soot in patches on roofs (no prints, no scratches up
    there);
  - dents in sheet metal, splits along the grain in wood, worn spots in fabric.

  At a set's resolution a fingerprint is a small hazy oval, as it is to the eye a step away. An entry's `tear` (0 to 1)
  says how much it shows.
- **The maps** each set has: colour (`_albedo`), the bump as a normal map (`_normal`, OpenGL's) and as a height map
  (`_height`, its range in `procedural.json` `height_m`), roughness (`_roughness`), occlusion (`_ao`), and the packed
  ORM (`_orm`: occlusion, roughness, metal). Any engine's PBR material takes them as they are.
- **A material** is an entry in `LIB`: its label, group, family (`stucco`, `tiles`, `boards`, `panels`, `metal`,
  `concrete`, `asphalt`, `pavers`, `kawara`, `simple`), the period it repeats in, the relief its height stands for (in
  metres), the wear it takes, and its numbers (colours, sizes, roughness). A new one is a line there and a
  `street.py library <name>`.
- **A school's inside** (group `interior`, the user, 2026-11-01: the 1:1 classroom "using the pbrs instead to see if it
  helps realism"): the family `grain` (wood with no seams of its own, for the kit's boards and tops, which lay their own:
  the grain's long streaks and its rings' bands, the varnish's shine; `weave`: a cloth's threads) and twelve sets:
  `jp_oak_floor` (the parquet), `jp_pine_varnish` (the wainscot, lockers, the platform), `jp_desk_laminate`,
  `jp_plywood_red` (a chair), `jp_steel_chrome` (the frames, painted silver), `jp_chalkboard`, `jp_cork`, `jp_acoustic`
  (the ceiling's rock wool), `jp_plaster_cream` (the walls), `jp_curtain_mustard`, `jp_lectern_green`, `jp_vinyl_tile`
  (the corridor). The set `school_classroom_pbr` is the classroom wearing them (SCENE_BUILDER §10).
- **Your own sets** off the shelf (`assets/pbr/<name>`, a CC0 scan from ambientCG or Poly Haven) appear in the page
  under *your sets* and paint the same way. A street that wears a set this machine's shelf doesn't have is warned
  about by STREET.

## 3b. Made sets: a set tuned and layered (`storykit/pbrmix.py`)

A look object is made into a set of its own on the shelf, `pbr/_made/<hash>` (in `assets/pbr/_made`, not in git: made
again from the recipe whenever it's missing): tileable at its new size, every map in it, the recipe and its wear in its
`meta.json`. The paint page asks the desk's server for it (`POST /api/pbr/made`), `street.py look` and `bake` make the
street's before Blender starts, and the street's .glb carries its maps to Godot, so the page, the render and the game
show the same thing. One set is made at a time, in a second or two at 1K; a change only to the colour writes only the
colour map (the other maps are hard links to the set's own), a change only to the size writes nothing new.

- **The words** (`LOOK`, `LAYER`, `RANGE` in pbrmix.py; the STREET check asks it, so the check, the page and the bake
  never disagree): `set`, `scale` 0.1 to 10, `turn` 0/90/180/270, `tint` #rrggbb and `tint_amount` 0 to 1,
  `brightness`, `contrast`, `saturation` 0 to 3, `hue` -180 to 180, `fade` 0 to 1, `roughness` 0 to 3, `bump` 0 to 4,
  `layers`. A set layer: `set`, `amount` 0 to 2, `mask` (patches, own, own+patches, all), `coverage` and `softness`
  0 to 1, `size` 0.05 to 20 m, `seed`, `scale`, `affects` (all, shine, colour), and its own `tint`, `tint_amount`,
  `brightness`, `contrast`, `saturation`, `hue`. A decal layer: `decal` (a kind decals.py makes), `count` 1 to 60 a
  repeat, `size` (times the decal's own), `seed`, `spin` (0 upright, 1 turned at random), `amount`, `affects`. A wear
  layer: `wear` (grime, streaks, edges, damp) and `amount`.
- **The sums** (on the colour map, in this order): hue (a turn in YIQ), saturation and contrast about the set's own mean
  (in sRGB, as the eye sees them); the tint in linear light (each pixel's lightness against the mean's kept, its colour
  the tint's, so the whole averages the tint exactly); brightness (linear); the fade toward
  `(L + (c - L) * 0.35) * 0.7 + 0.255` (paler, greyer, flatter). Roughness multiplies the roughness map, relief the
  normal map's slope. A turn turns every map and the normal's x and y with it; the size scales `tile_m`.
- **A set layer** is repeated a whole number of times over the base's tile (its own size rounded to fit, so the made
  set still tiles), its mask made at the base's resolution: soft blobs from a periodic blur of noise (so they tile too)
  thresholded to the coverage, its opacity map, or both. Its colour, roughness and normal (and occlusion, height and
  metal with `affects: all`) are mixed in by the mask.
- **A decal layer** stamps its picture `count` times at random places (±20% in size), wrapping round the tile's edges
  so the made set still tiles; its colour by its alpha, its roughness where the catalogue gives one.
- **A wear layer** goes into the made set's meta.json (`wear`: the bake's `dirt`, `streaks`, `edges`, `wet`), and the
  bake multiplies the street's wear by it on that surface, in Blender and in the .glb's `hs_wear` for Godot. A set off
  the shelf wears as its slot does (asphalt as asphalt, a wall as render).
- **Cleaning:** `street.py look` and `bake` take off the made sets no street uses that are over a day old (a brush tuned
  in the page and not yet painted and saved is younger).

## 4. Decals

`tools/streetbake/decals.py`, `python tools/street.py decals` (the page makes them when they're missing). There are 27,
drawn from code with their alpha into `assets/decals/` (not kept in git), each with its real size and its shine:

- **On walls:** rain streaks, rust bleeding from a fitting, a damp patch, salt bloom, soot over a vent, cracks, moss at
  the foot, a poster, old posters torn, stickers, a sprayed tag.
- **On the ground:** oil, a puddle (wet: roughness 0.04), tyre marks, chewing gum, worn paint, fallen leaves, litter
  and cigarette ends, a manhole cover and a drain grate (iron).
- **Wear to put where it happens:** fingerprints and a palm (a door's push plate, a vending machine's glass), a greasy
  smudge, rubber scuffs at the foot of a door or a wall, scratches, chipped paint, a water stain's tide marks, the tape
  and paper left of posters torn down. That makes 27 decals.

In the street they're pieces of their own (`decal:<kind>`). In Blender they keep their picture and its alpha, take a
little dirt, and stay out of the occlusion bake as the road markings do. In Godot they arrive as see-through quads.
Like the road's paint, they cast no shadow anywhere (DECISIONS 2026-10-31, late morning: a lifted sheet's shadow made
the road's print float): the street builder's view, Blender (`visible_shadow` off) and Godot (the plugin's import
step).

## 5. Checks

- **STREET** (`python tools/street.py check`, in check_all) now also checks:
  - every look: a colour, a set, or a tuned look whose words and numbers pbrmix.py accepts (an unknown word, a number
    out of range, a mask or wear it doesn't have is an error; a set not on this machine's shelf a warning);
  - every street's decals: a kind decals.py makes, a normal one long;
  - a decal faces out of its surface a GAP off it, its picture the right way up;
  - a warning for a painted set missing from this machine's shelf.
- **PAINT** (`node tools/director/painttest.mjs`, the desk's server running): the page in a headless browser on a
  scratch copy of the Shibuya lane: the library listed (the project's sets by category), a wall painted through the
  photo's shot, picked up and tuned live (a tint, rain streaks, moss in patches: the look saved as an object, the
  surface wearing the set made of it), every surface of a kind painted at once, a decal laid, undo and redo, saved and
  read back from disk. It uses the page's hooks (`window.__paint`): pick, paint and
  lay decals by the view's fractions, as a person would.
