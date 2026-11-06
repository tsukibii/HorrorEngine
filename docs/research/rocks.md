# Realistic rocks by code (2026-11-06)

The user (DECISIONS 2026-11-06, later): the nature streets looked ugly but for the realistic plants; "work on modelling
some new rocks, research a Blender creating realistic rocks tutorial first". What the tutorials and Blender's own rock
generator do, and what the prop generator's `rock` family takes from them (numpy for the shape and the paint, Blender
for the bake, as every family: PROPGEN §1).

## 1. What Blender's rock generator does (add_mesh_extra_objects / add_mesh_rocks, `rockgen.py`)

Read from its source (the add-on that ships with Blender; the tutorials on the web start from it or do the same by hand).

- **A random low-poly base**, not a sphere: one of twelve 7 to 10 vertex shapes, each vertex drawn from a skewed
  Gaussian (`skewedGauss`: a mean, a sigma a third of the way to the bound, the far side rescaled), its edges creased
  (0.5 on the main edges, 0.25 and 0.125 on the rest) so the first subdivision keeps a few hard corners. Two
  **Subdivision Surface** modifiers smooth it into a lump that is already lopsided.
- **Four Displace modifiers in a row**, their strengths Gaussian about: *Musgrave* at `deform / 1000` (a big slow
  swell), *Voronoi* at `deform / 10` (the facets: each cell a bump, the borders between them the creases), then two
  textures picked at random (Clouds most often; Musgrave, Distorted Noise, Stucci, Voronoi) at `rough / 50` and
  `rough / 100` (the grain). `deform` is the recipe's number over 10, `rough` over 100.
- **A Smooth modifier** (`smooth_fac`, `smooth_it`) for rounded rocks; the faces shaded smooth; normals made consistent.
  No decimation: the subdivision level (`detail`) is the triangle count.
- **The presets** (`add_mesh_rocks.xml`): *River Rock* deform 3, rough 2, detail 2, smoothing 2 x 2, scale 0.5 to 1.25
  skewed small (−0.5); *Asteroid* deform 7.5, rough 3, detail 4, no smoothing, scale 1 to 5; *Sandstone* deform 0.5,
  rough 1, a flat slab (scale factor z 0.1), smoothing 2 x 2; *Ice* deform 5, rough 1, smoothing 2 x 1; *Fake Ocean*
  a flat plate 10 x 10 x 0 with deform 7.5 and rough 3. Material: a grey with roughness 0.125 (river rock) to 1.5
  (asteroid), a `mossy` field reserved and unused.

What that says: a rock is **a lopsided base + Voronoi facets + a swell + two grains**, then **smoothing by type**
(river stones most, quarried none), at **sizes that skew small**.

## 2. What the tutorials add (the look)

The search results (Blender Bazaar's procedural rock material, Blender Guru's asteroid, the Ultimate Rock Generator's
docs, cgtrader's rock modelling; their pages are outside this session's network, their summaries in the search):

- **Displacement from a Voronoi fed by a noise** (the noise's factor into the Voronoi's vector: warped cells, so the
  facets aren't a tidy honeycomb); the divets Voronoi leaves are tamed with a colour ramp or a map range.
- **Layered displacement** with a strength and a size each (the rock generators sell this as "layers").
- **The material**: the base colour from colour ramps over noise (two or three tones mottled), **speckles** as a fine
  noise or Voronoi points through a ramp, **roughness from the same noises** (brighter grains rougher), **bump from a
  noise** at the texture's finest scale, and where the tutorials go further: **cracks** as a ridged noise or a Voronoi
  crackle darkened and dented, **moss** masked by the up-facing normal and the cavities (pointiness or ambient
  occlusion), **lichen** as round patches, **wet** stones darker and glossy to a water line.

## 3. What the prop generator does (families/rock.py)

The same ingredients, each a field of the direction from the rock's centre, so the shape and the paint read one source:

- **The shape** (a star-shaped radius about the centre, in numpy on an icosphere): an ellipsoid with a random aspect
  (sizes skewed small as the presets), **facets as cuts by random planes** (a fractured rock's flat faces, sharper
  than Voronoi bumps: the radius along a ray is the nearer of the lump's and each plane's, blended by a soft minimum
  whose width is the rounding: river stones round, quarried rock crisp), **Voronoi crackle lumps** (`cells3`'s
  F2 − F1) and **a fractal swell** (`fbm3`) as the generator's Musgrave + Voronoi layers, a **flat underside** (a
  plane cut, the rock sits), and on the detailed mesh alone **cracks** (`ridged3` over a threshold, cut in), **pits**
  (small Voronoi cells, dented: basalt's vesicles, weathered granite) and **grain** (fine fbm). The game mesh is the
  same shape at a coarse icosphere; the bake carries the rest as its normal map and occlusion.
- **The paint** by each texel's place (`texel_paint`): the stone's tone mottled by a fractal and per facet (each
  Voronoi cell its own tint), granite's **speckles** (quartz, feldspar, mica by a fine cellular noise), sandstone's
  **strata** (a sine of the height warped by noise), the **cracks** darkened and dented where the shape cut them, the
  **cavities** dirtied by the bake's occlusion and creases, **moss** where it faces up, sits low and shades (a fractal
  mask, a cushion in the relief), **lichen** as crusts on the sun side, a **wet** band to a water line (darker, glossy,
  a mineral tide line), **dirt** at the foot.
- **Kinds**: `boulder`, `stone`, `river` (rounded, smooth, polished), `slab` (a flat stepping stone), `pebbles` (a
  patch of small stones), `cluster` (a few rocks leaning together). **Stones**: granite, basalt, sandstone, limestone,
  slate, river (a mixed cobble). Recipes in presets.json: `rock_boulder`, `rock_mossy`, `rock_basalt`,
  `rock_sandstone`, `rock_slab`, `stone_river`, `stone_river_wet`, `rocks_cluster`, `pebbles_river`.

Not taken: Blender's modifier stack itself (the shape is numpy, so the street builder and the checks can read the
recipe without Blender, and a seed gives the same rock), sculpting by hand, scanned rock textures (ours are made).
