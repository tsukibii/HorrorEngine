# Texturing the streets: street → Blender → Godot

The street builder (docs/STREET_BUILDER.md) makes the shapes and the colours. This is how they get their surfaces:
what each one is made of, how it has worn, and how that goes to Godot with the colliders intact. The test is the
Shibuya lane through its photo's shot (§1). Asked on 2026-10-31 (DECISIONS, past midnight): the most aesthetic way, wear
and decals, procedural bakes instead of PBRs where they do, PBRs optional, and a Blender step where foliage can be
added without losing easy collision.

## 0. The answer

Three layers. Each does what it's good at.

1. **Finishes that tile at their real size.** Plaster, facade tiles, panels, concrete with its form-tie holes,
   asphalt with its aggregate, patches and cracks, paving, kerbs, worn road paint, metal, shutters, kawara, wood and
   fabric. They're made by procedural nodes in Blender and baked once into tileable sets on the PBR shelf
   (`assets/pbr/Procedural/<finish>/`), so no downloads are needed. Because they tile, they stay sharp at the
   player's feet and cost the same for one street or a town. Each surface keeps its colour from the street builder;
   the finish is a tint over it. A CC0 PBR set (ambientCG, Poly Haven: docs/assets/awesome-cc0.md) can replace any
   finish on a slot or a material (§2).
2. **The street's own wear, baked once per street at low resolution.** The wear covers:
   - dirt in corners and under ledges;
   - rain streaks running down from every sill, wall top and air conditioner;
   - the splash band at the foot of each wall;
   - worn and chipped edges;
   - the wet, oily patches on the road.

   All of it goes into one atlas on the second UVs, at 24 pixels a metre. Wear changes slowly across a surface, so
   it needs few pixels, but it is unique to every surface, which is what makes a street look lived in.
3. **Decals** for what must be sharp and placed by hand: posters, flyers, graffiti, manholes, drains, stains, cracks
   and leaves. The road markings already work this way: they're worn by the paint finish, with the road showing
   through the holes. The rest is the next step (§5).

**Is this how the prop generator (`prop-gen-tool`) does it?** It uses the same ingredients at a different scale:
- **The same.** Blender and Cycles bake each texel's place, normal and occlusion. The wear is computed from those in
  numpy (dirt gathers where it's occluded, a slow grime follows the place), and each kind of material wears its own
  way. Everything goes out as glTF.
- **Different.** A prop is small: one unique texture covers a can at several pixels a millimetre, so the prop
  generator bakes everything, wear and print together, into it. A street is huge. The Shibuya lane has 19,054 m² of
  surfaces, and a unique bake at 128 px/m would be 312 million texels per map. That's about 19 4K textures, three
  times over, far past a GTX 1060.
- **So here the detail tiles and only the wear is unique.** The 15 sets at 1024² plus the 4096 × 2112 wear atlas
  come to about 70 MB of VRAM compressed, and the result is sharper.
- **Streaks need one more trick:** the wear atlas lays every flat patch of the street upright, its up the image's up,
  so a streak can run down from a ledge in the image (`tools/streetbake/wear.py`).

## 1. The test: the Shibuya lane

```bash
python tools/street.py look shibuya_lane           # Blender: the finishes and the wear, rendered through the photo's shot
python tools/street.py bake shibuya_lane --godot   # and baked: the sets, the .glb, the .blend, Godot's picture of it
```

In `Saved/Streets/shibuya_lane/blender/`:
- **compare_photo.jpg:** three frames side by side: the photo, Blender's render (Cycles, the finishes live, the wear
  atlas) and Godot's picture of the exported .glb (the plugin's street shader). The two renders are close to each
  other. Where they differ from the photo it's mostly the light: these are lit by a test dusk, and a game's light is
  set by hand in Godot (DECISIONS 2026-10-30, noon).
- **look_close_*.png:** the lane's three close-up shots (`close_shop`, `close_kiosk`, `close_road`: the finishes and
  the wear at arm's length), rendered with `--shot all`. A shot is any view kept in the page (+ Shot).
- **The baked sets** are on the shelf. The PBR button opens them in the shelf page.
- **The finishes the lane uses** are in `Content/Studio/Streets/shibuya_lane/finish.json`. Francfranc's facade is
  `panel`, two far buildings are `tile`, one is `concrete`, and the rest are `render` by their slots.

**The lane painted from its photo** (2026-10-31, docs/STREET_PAINT.md): in the paint page, each building and the
street-wide surfaces wear the material library's sets (Francfranc's pink precast panels, the far buildings' 45 × 95
tiles, sprayed mortar and ALC, new asphalt, grey pavers), with decals laid in the photo's shot (torn posters and damp
on the kiosk, oil, a manhole and a drain grate on the road, gum and litter on the pavement, rain streaks on a facade).

**The sky is physical** (docs/research/photoreal.md §3): Blender's Nishita sky for dusk and day (`scene.py` `SKY`: the
sun's elevation and turn, the air, dust and ozone), the sun a light of its own (its disc off), calibrated against the
photo by measuring them. The middle tones are 0.022 against 0.022 linear, the sky's band 0.044 against 0.050, the road
0.009 against 0.012. The sun stays out of the .glb, since Godot's light is set by hand there. Night keeps the gradient.

**Times on the cloud's 4 CPUs (no graphics card):**
- the wear atlas: 4 minutes (Cycles' bakes 1.7, numpy 2);
- the 15 sets: 4 minutes, once for every street (made again only when the finishes' code changes);
- the photo's shot: 1 minute at 500 × 750 and 32 samples;
- the export: seconds.

On the 3090, Cycles uses OptiX for the bakes and the renders.

## 2. Procedural or PBR

**Procedural, the default** (`tools/streetbake/finishes.py`):
- Each finish is a node group read in the street's own UVs, which are metres (STREET_BUILDER §5). You can open it
  in Blender's shader editor and change it.
- Its noise is read on a flat torus of the finish's period, and its bricks number themselves round the period, so a
  bake of one period tiles without a seam. STREETBAKE measures every set's wrap against its own steps inside.
- Its colour is a tint under 1, so a baked map can hold it. The street builder's colour is multiplied in.
- **The finishes:**
  - walls: `render`, `tile` (227 × 60 mm facade tiles), `panel`, `concrete` (P-cone holes every 450 × 600 mm,
    pour lines, form seams), `blocks`;
  - ground: `kerb`, `asphalt`, `ground`, `paving`, `paint`;
  - metal: `metal`, `corrugated` (shutters);
  - roofs: `roof_tiles` (kawara: ribs down the slope, courses across), `roof_sheet` (standing seams);
  - others: `glass`, `wood`, `fabric`, `plastic`.
- Lit things (windows, shopfronts, lamps) glow. Signs, the road's letters and cut-out slots (fences, lattices) keep
  their own pictures.

**Which finish where:** a slot has its finish by default (`SLOT_FINISH`). A street's `finish.json` changes it by
slot (`"wall2": "concrete"`) or by material (`"street_wall_dcb4a6": "panel"`; a material is a slot and a colour). It
also sets the wear's amounts (`"wear": {"dirt", "streaks", "edges", "wet"}`) and the lit things' strength
(`"glow"`).

**PBR, when you want it:** name a shelf set instead of a finish, `"street_wall_d5d2cb": "pbr/Stone/granite_tiles"`.
The set is laid at its `tile_m` and the same wear goes over it. Photographed CC0 sets are worth it where the eye goes
close and procedural noise looks like noise: a shrine's wood, a shop's tiled step, a hero door.

## 3. Into Godot

`bake` writes `<name>.glb` and `<name>.blend` (its pictures packed in). Either one drops into a Godot project's
folder. Godot imports a `.blend` through Blender itself (set Blender's path in Editor Settings, FileSystem > Import),
and it imports again whenever the file is saved.

**What any glTF reader gets:**
- each surface's finish at its real size (KHR_texture_transform) times its colour;
- its roughness and metalness (an ORM map) and its normal map;
- the street's wear atlas as its occlusion on UV2 (`occlusionTexture.texCoord = 1`; Godot 4.7 reads it as
  `ao_on_uv2`, tested);
- alpha cut-outs as glTF's MASK.

**What the HorrorStudio Look plugin adds** (enabled in every exported game, GodotPlugins/HorrorStudioLook):
- an import step, `street_import.gd`, that turns every surface whose material carries the wear's recipe (extras
  `hs_wear`, which Godot keeps as metadata) into `street.gdshader`. That shader does the same sums as Blender's
  "Street wear" group: dirt, streaks, worn edges, the wet patches and a slow tone. The game matches the render.
- `HSStreet.weather(node, amount)` scales every street surface's wear at run time: 0 is clean, 1 is as baked, 2 is
  twice as worn.

**The atlas's channels:** R is the occlusion (what glTF's occlusion map reads), G dirt, B streaks on walls and wet
patches on what faces up, A worn edges.

The import step also makes the road paint and decals cast no shadow of their own (`HSStreet.lay_flat`; DECISIONS
2026-10-31, late morning: "the print on the road looks like it's floating... it should look part of the road"). The
street builder's own .glb gets the same.

**The light is yours** (DECISIONS 2026-10-31, late morning: baked by hand in Godot). Two things to know when baking it:
- **LightmapGI** wants a lightmap UV2 per mesh, and the import's *Static Lightmaps* mode unwraps a new one over the
  wear atlas's UV2: the street shader's wear would then read the wrong places. Bake with the import's *Static* mode
  and meshes that have their own UV2, or ask for the atlas on a third UV.
- **VoxelGI** reads only a BaseMaterial3D's colour (Godot's `scene/3d/voxelizer.cpp`): a surface on the street shader
  bakes as white, so the lane bounces about twice the light it should, with no colour (measured 2026-10-31). Bake it
  with the street's plain materials on (the import without the plugin), then put the plugin's back.

## 4. Collision, made easy

**The street's own colliders** are the street builder's `-colonly` meshes: the walkable surfaces, a box for each
building, the fences, the things you'd bump into. Blender keeps names, the bake exports them as they came, and Godot
makes a StaticBody3D for each. GDSTREET on the baked .glb proves it: its rays land on the road at 0.004 m, on the
pavement at 0.150 m and on each roof at its height, as the street says. The occluders (`-occonly`), the lamps and the
insides' markers come through the same way.

**What you add in Blender** goes in the `.blend`'s **Foliage** collection: trees, plants, props and their colliders.
Baking the street again brings that collection into the new `.blend` (STREETBAKE adds a tree and bakes again to prove
it). For collision, name things with Godot's own suffixes:

| Name ends with | Godot makes | Use it for |
|---|---|---|
| `-colonly` | only a collider, from this mesh (invisible) | a cylinder round a trunk, a box round a bush: the cheapest, and smooth to walk along |
| `-convcol` | the mesh and a convex collider made from it | a rock, a planter, a bin |
| `-col` | the mesh and a collider exactly its shape | static walls, steps; too heavy for leaves |
| (nothing) | the mesh, no collider | grass, leaves, hanging wires: things to walk through |
| `-occonly` | an occluder (hides what's behind it) | a box inside something big and solid |
| `-noimp` | nothing | Blender-only helpers |

## 5. Decals

Road markings are decals: quads lying 5 mm over the road, worn by the paint finish, their worn holes cut (MASK), and
baked apart from the road so the road under them keeps its own occlusion. The rest (27 of them: posters, stains, a
manhole, fingerprints...) are laid with the paint page (docs/STREET_PAINT.md §4) as the street's `decals`, quads a
GAP off their surface. None casts a shadow, in Blender or Godot.

A later step could make each one a Godot Decal node at import (it projects onto whatever is there, and Forward+ draws
many cheaply).

## 6. Checks

- `python tools/street.py bake-check [--godot]`: **STREETBAKE**. The Shibuya lane is baked small on a scratch shelf,
  with the procedural sets and a set of our own on one slot. Its `.glb` is read back and must show:
  - every surface but the lit ones carries its wear and the atlas as its occlusion on UV2;
  - the colliders, occluders, lamps and insides are as many as in the street's own .glb;
  - the atlas is sane, and every baked set is seamless;
  - the set of our own made it in;
  - after a tree is added to the `.blend`'s Foliage and the street is baked again, the tree and its `-colonly`
    trunk come along.

  With `--godot`, GDSTREET then runs on it with the plugin. About a minute. It needs Blender (on the PATH, or
  `python tools/retarget.py setup`) and the desk's server for the street's .glb.
- `python tools/godot/street_check.py --glb PATH --plugin --shot ID`: **GDSTREET** on a baked .glb, with the
  plugin's import step checked (the street shader on the surfaces, the paint and decals shadowless) and the street
  pictured through a shot.

## 7. Limits and what's next

- **Finishes are per material,** and a material is a slot and a colour: two buildings with the same wall colour
  share a finish. Next: a `finish` beside each slot's colour in the street's `look` (the page's inspector), carried
  in the exported material's name.
- **The wear isn't rain-aware yet.** The plugin's rain (HSRain, `wet.gdshader`) could darken the streaked walls and
  pool the wet patches.
- **Big streets:** the wear atlas shrinks to fit in 8192². A town past that would need an atlas a chunk.
- **The lighting in the pictures is a test light** (a dusk sky, the lamps). The game's is lit by hand in Godot.
