# Things that break when shot

The user (2026-11-09, after the smoke): "could you create a shader/script called blownUp or something that lets any
object we attach be blow up by shotgun shots, e.g. a kettle, a box, but it should look like the object itself got
destroyed not just a generic animation".

This note is what the weapons plugin's HSBlowUp (`blowup/`) stands on. The sources are developers' write-ups, libraries'
docs and papers; **a quote is the search engine's extract of the page linked**. "(ours)" marks a choice made here.

## 1. What makes a break read as the thing itself

- **Its own pieces, its own surface.** The pieces are the object's mesh cut up, keeping its textures: "Texture
  coordinates are preserved along edges where mesh is fractured/sliced" ([OpenFracture](https://github.com/unitycoder/OpenFracture)).
- **An inside.** The new faces need a material of their own: three-pinata takes "one for the original outer surface
  and one for the newly created internal fracture faces"
  ([three-pinata](https://cdn.jsdelivr.net/npm/@dgreenheck/three-pinata@2.0.1/README.md)); OpenFracture puts them on
  their own submesh. A student project found debris without inner textures looked "bland"
  ([Staffordshire FYP](https://gradex.staffs.ac.uk/wp-content/uploads/2026/04/5521_FYP-presentation.pdf)).
- **The material decides how it breaks.**
  - Planar cuts for glass and wood planks, Voronoi for concrete and stone, radial breaks from the impact for glass;
    wood breaks along its grain ([StraySpark on Chaos](https://www.strayspark.studio/blog/chaos-destruction-ue5-destructible-environments)).
  - Metal bends where wood breaks: in Pixelux's DMM "a wood prop might collide and fracture, while a metal prop might
    collide and then bend" ([Jesse Harlin, 2008](https://www.audiogang.org/breaking-new-ground-jesse-harlin-september-2008/)).
  - Remedy's *Control* gives each material its own fracture geometry, the metal "slightly bent before the metal is
    gone" ([Habr on Remedy's talk](https://habr.com/ru/post/526574)).
  - Props are tagged by material, and each tag plays its own effect ([GMTK, How Games Do Destruction](https://gmtk.substack.com/p/how-games-do-destruction)).
- **Smaller pieces where it was hit**, bigger ones away from it (ours, from the radial patterns above and from how a
  close shot tears a hole while the rest of the thing flies off whole).

## 2. How to cut it

- **Recursive plane slicing**: "Fracturing is performed by recursively slicing a mesh until the target fragment count
  has been reached", each plane through the piece's middle with a random normal; triangles wholly on one side go to
  that side, those it crosses are split and their segments recorded, and the cut is filled by a constrained Delaunay
  triangulation; the mesh "must be closed" ([OpenFracture](https://github.com/unitycoder/OpenFracture)).
- **Voronoi** is the other way: 3D cells are "most realistic, slower"; plane slicing is "fast, lower quality"
  ([three-pinata](https://cdn.jsdelivr.net/npm/@dgreenheck/three-pinata@2.0.1/README.md)). Voronoi of scattered points
  makes "overly regular and convex fragments with perfectly flat faces" ([arXiv 2111.05249](https://arxiv.org/pdf/2111.05249)).
- **Precompute, then swap**: Godot's own destruction add-ons prefracture (Blender's cell fracture, "Pre-generating
  shards is recommended") or fragment on startup, and warn that large breaks drop frames because Godot "struggles to do
  this in less than 16ms" (Destructibles CSharp, Destruct3D; [asset library](https://godotengine.org/asset-library/asset/1850),
  [Destruct3D](https://gh.r-mj.com/OffByTwoDev/Destruct3D)). A destruction budget of about 4 ms of a 16 ms frame
  ([Kaiju Protocol](https://polylusion-games-site.pages.dev/blog/kaiju-protocol-dev-destructible-cities)).

## 3. How it sounds

- Layers: The Last of Us Part II's glass is Impact, Thump, Pane and Debris
  ([GameSpot](https://www.gamespot.com/articles/the-complex-system-behind-breaking-glass-in-the-la/1100-6480713/)).
- Modal synthesis (decaying resonances of the object's modes) is the standard way to make impact sounds in code
  ([survey](https://arxiv.org/pdf/2011.05538), [SMC 2019](https://www.smc2019.uma.es/articles/P1/P1_05_SMC2019_paper.pdf));
  a shattering is many short modal sounds, the small debris masked by the big pieces
  ([Zheng and James](https://research.cs.cornell.edu/FractureSound/files/fractureSound.pdf)); pure modes blur the clicks
  of small debris, which need a short transient ([acceleration noise](https://research.cs.cornell.edu/Sound/proxy/FasterAccelerationNoise_SCA2012.pdf));
  thin shells crash and rumble nonlinearly ([Harmonic Shells](https://research.cs.cornell.edu/HarmonicShells/HarmonicShells09_large.pdf)).

## 4. What we do (ours)

**HSBlowUp**, a node put under any object (`blowup/blow_up.gd`):

1. **When it loads**, its meshes are read and cut up in a worker thread (`blowup/fracture.gd`, HSFracture): recursive
   plane slicing into a tree of pieces, each cut filled (the cut's segments chained into loops on the plane, holes
   split off with Godot's own polygon clipping, ear-clipped), the pieces split where they don't touch. Its own
   materials stay on every piece; the new faces get the inside shader (`blowup/inside.gdshader`). A mesh that isn't
   closed (a single sheet), and every part of a hollow kind (a kettle modelled as a sealed shell is still a thin wall),
   gets its back drawn by the inside instead of a fill. It's cut finer than it ever breaks (2.5 times). Nothing is cut
   when it's shot.
2. **When a shot's damage passes its strength**, its leaves are gathered into pieces from the farthest from the hit in,
   each grown over the leaves it touches while it stays as big as a piece should be there (the kind's `coarse`: small
   near the hit, bigger away; all small in a blast), and it's swapped for them in one frame. The pieces fly out of the hit along the shot, and the holes the pellets left
   go with them.
3. **The material is a resource** (`HSBreakKind`, `blowup/kinds/`), as a shell's kind is: how strong it is, how many
   pieces, along a grain or not, crumpled or dented, how fast and how they bounce, the inside's look, the dust, chips,
   splinters, glints, paper or sparks, the sounds. Ceramic, glass, wood, metal, cardboard, plastic and stone come with
   it; the object's name, its materials and its `hs_surface` guess one.
4. **Below its strength**, metal, card and plastic are dented where the pellets hit; many shots wear it down.
5. **The pieces**: bigger ones (4.5 cm and over) are rigid bodies (Jolt) whose colliders are at least 6 cm along each
   of their own principal axes, lifted clear of the floor they start in, never knocking each other about nor the
   player, frozen and laid onto the floor by their real vertices once they've gone nowhere for half a second (LESSONS:
   a thinner body, even a 5 cm one landing at 4 m/s, sinks through a level's trimesh floor); smaller ones fall by
   rays, as the gun's hulls do, and lie down flat. Parts of their own (a lid on its hinge) and contents (a box's
   shells) fly off whole; a liquid splashes and pools. The player walking into them kicks them on.
6. **The sound** is made in code, modal: a crack and the pieces' ring, then the debris landing.

Not done: Voronoi cells, metal tearing into petals, breaking pieces again.
