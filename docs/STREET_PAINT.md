# Street paint: the material library, decals, and the paint page

Asked on 2026-10-31 (DECISIONS, before dawn): "a simple python script wrapper tool (similar to what that prop-tool is
doing), where I can just paintbucket paint on the materials and then zoom in to add decals"; "pre-make a bunch of
building, street, roof tile etc materials to paintbucket, based off the Japanese materials in the real photos". The
research behind it is docs/research/photoreal.md. The streets come from the street builder (docs/STREET_BUILDER.md),
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
- **Paint (1):** pick a material from the library on the left, then click a surface. What a click would paint lights up
  as you hover:
  - **this one's surface**: this building's walls (its road's asphalt, its thing's metal);
  - **every one on the street**: every wall that doesn't have its own.

  **Alt-click** picks up what's on a surface. **A colour** paints a flat colour instead. **Clear**, then a click, takes
  the paint off (back to the street builder's colour).
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
- **A piece's `look`** (a building's, a road's, a thing's, a fence's): `{"wall": "pbr/Procedural/jp_tile45_white"}`;
- **The street's `look`**, for every surface of that kind without its own: `{"asphalt": "pbr/Procedural/jp_asphalt_old"}`;
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
- **Your own sets** off the shelf (`assets/pbr/<name>`, a CC0 scan from ambientCG or Poly Haven) appear in the page
  under *your sets* and paint the same way. A street that wears a set this machine's shelf doesn't have is warned
  about by STREET.

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
  - every street's decals: a kind decals.py makes, a normal one long;
  - a decal faces out of its surface a GAP off it, its picture the right way up;
  - a warning for a painted set missing from this machine's shelf.
- **PAINT** (`node tools/director/painttest.mjs`, the desk's server running): the page in a headless browser on a
  scratch copy of the Shibuya lane: the library listed, a wall painted through the photo's shot, every surface of a kind painted at once,
  a decal laid, undo and redo, saved and read back from disk. It uses the page's hooks (`window.__paint`): pick, paint and
  lay decals by the view's fractions, as a person would.
