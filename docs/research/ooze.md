# Black gothic ichor that oozes, for the camhybrid tape

The user (2026-11-10, while HSHitReact was being built): "once your done can you look into adding some kind of shader
for the black gothic blood that will fit our vhs camhybrid look and look eery and oozy".

This note is what the weapons plugin's HSOoze (`react/ooze*.gdshader`, `react/ooze.gd`) stands on. The sources are
tools' documentation, forums, papers and press; **a quote is the search engine's extract of the page linked**. "(ours)"
marks a choice made here, and §3 has what was measured in Godot 4.7 itself.

## 1. What's out there

- **Animated blood decals** in games are a reveal and a flow: a pack paints "the whiter areas of the texture ... first
  and the darker areas ... later, so the decal reveals itself smoothly", others drive the spread with optical flow or
  motion vectors, and "thin streaks can dry sooner, while thicker accumulations remain wet-looking longer"
  ([Unreal forums, animated blood](https://forums.unrealengine.com/t/bklleb-digital-store-animated-blood-vol-i-complete-bundle/2841110),
  [wall decal pack](https://forums.unrealengine.com/t/bklleb-digital-store-animated-blood-wall-decal-pack-vol-iii/2776072),
  [Fab](https://www.fab.com/listings/e5cdff4e-d1cc-4632-a1e8-e78b7ea2198a)); drips that run down are made with a rain
  rivulet shader or a flipbook ([realtimevfx](https://realtimevfx.com/t/how-can-create-this-effect-on-hit-mesh-similar-to-blood-but-should-trail-and-drip-down/23642),
  [Unreal forums, a bleeding wall](https://forums.unrealengine.com/t/how-to-create-a-bleeding-wall-effect-ue5-0/512129)).
- **A decal of its own shader in Godot** is a box whose fragment reads the depth texture (`hint_depth_texture`),
  rebuilds the world position from `SCREEN_UV` and the inverse projection and view matrices, and takes it into the
  box's own space ([Godot forum, a triplanar decal](https://forum.godotengine.org/t/trying-to-make-a-sort-of-triplanar-decal-shader/98504),
  [Godot shaders, decal with PBR](https://godotshaders.com/shader/decal-with-pbr-godot-4-4/),
  [a decal for the compatibility renderer](https://godotshaders.com/?p=8310),
  [the docs' screen-reading shaders](https://docs.godotengine.org/ja/4.3/tutorials/shaders/screen-reading_shaders.html)).
- **Black goo reads by its highlights and its movement**: on one production the creatures' black liquid surface was lit
  "to ensure there were specular hits ... to make them readable in dark settings", and effects were added "to make sure
  that there was a good movement" ([VFX Voice, Goosebumps](https://vfxvoice.com/goosebumps-the-vanishing/)); Chicory's
  spooky ooze wriggles by a dissolve edge against scrolling noise ([Medium](https://medium.com/@banovg/the-one-cool-shader-trick-we-use-basically-everywhere-in-chicory-185b5e4d789c));
  a sludge reacts to what touches it through a depth camera ([80.lv](https://80.lv/articles/this-sludge-simulation-is-so-good-it-s-disgusting)).
- **An oil's sheen** is thin-film interference: colours shifting with the angle and the film's thickness, the bands
  blending as it thickens ([Logspace for Unreal](https://forums.unrealengine.com/t/logspace-thin-film-interference-shader-soap-bubble-oil-slick/2600966),
  [Utrecht thesis, iridescence in real time](https://studenttheses.uu.nl/handle/20.500.12932/15359),
  [Blender's thin film add-on](https://blendermarket.com/products/iridescence-thin-film-shading/docs)).
- **How thick liquid moves**: a fixed amount of viscous liquid spreads on a plane ever more slowly, its radius as the
  eighth root of time ([Darrow, Warwaruk and Bush on capillary currents](https://arxiv.org/abs/2508.01053)); released on
  a slope, a viscous band runs down and its front breaks into fingers whose tips run ahead of the rest
  ([Huppert 1982, Nature](https://www.nature.com/articles/300427a0)): drips.
- **The tape**: VHS gives colour a fraction of brightness's detail (luma about 3 MHz, chroma about 0.5 to 0.8 MHz), so
  "sharp color changes" smear and bleed ([VideoHelp](https://forum.videohelp.com/showthread.php?p=2773922),
  [doom9](https://doom9.org/capture/chroma_artefacts.html)); our camhybrid preset blurs colour 1.65 px against 0.88 for
  brightness and lifts black to about 0.035 (`vhs.gd`).

## 2. What we do (ours)

**HSOoze**, a box projected onto whatever it covers (`react/ooze.gd`; `react/ooze_spray`, `_pool`, `_wound`, `_drop`
`.gdshader` over `react/ooze.gdshaderinc` and `react/ooze_frag.gdshaderinc`):

1. **The shape is made in the shader** as a signed distance in metres, so it moves: a spray (a core of lobes, spines
   thrown out longer along the throw, droplets drawn out into tadpoles with their tails back toward where they came
   from) spreads as it lands and creeps on (a little, by a log of its age: the eighth-root law's slowness); on a wall
   drips run down out of it (the world's down in its own plane, so a floor has none and a wound on her runs down her
   whichever way she stands), each slowing to a stop, its trail thinning and beading behind a bulging head; a pool
   spreads and sends thin tendrils out from its edge as it ages; a drop splashes. One look at the field a pixel.
2. **It's lit where it lies**: the surface found from the depth buffer, its normal from its neighbours there (the
   nearer side in depth at each, so it never reaches across an edge), and `LIGHT_VERTEX` set to it.
3. **Thick black liquid**: every blob a low dome rising across it with a meniscus at its very edge, so some part of it
   faces any light (the flashlight is beside the eye: a flat film shows its highlight nowhere); thick, it's a black
   mirror (metallic, a few per cent reflective) whose highlight carries an oil's sheen (violet, green, gold by the angle
   and its depth, drifting); the room round it is seen in its rounded edges by Fresnel (the screen behind it, a little
   off along its lean); thin (its edges, the tendrils), a deep oxblood.
4. **Never still**: its surface crawls, a slow double beat swells its domes (the highlights pulse), embers die in it.
5. **For the tape**: it reads by brightness (its highlights, the bright rims, the dark body against the wall) and by
   movement; its colour (the sheen, the oxblood) only bleeds round it; nothing in it finer than a few millimetres.

## 3. Measured (Godot 4.7, `Saved/Godot/_ooze_lab/`)

- A spatial shader with `depth_test_disabled` and `cull_front` on a box, reading `hint_depth_texture`, writing
  `LIGHT_VERTEX` and `NORMAL`, compiles and lights in 4.7 (Forward+; headless reports Forward+ too).
- **The normal-roughness buffer is filled only for some materials**: a box with no material of its own read as no
  normal at all (0.5, 0.5, 0.5) where MHR's imported material had one. The surface's normal from the depth buffer
  works everywhere; `cross(dFdx, dFdy)` points away from the eye under Vulkan's downward screen y (flip it).
- **The field looked at three times a pixel** (its slope by differences) made a shader the CPU renderer took minutes
  to compile; one look a pixel with its slope from the neighbouring pixels (`dFdxFine`) and a shader a kind: about a
  second.
- Lit white, a spray took the flashlight as the wall round it did, and as rough chrome it lit like a StandardMaterial3D
  chrome square beside it; black with a flat film, it showed no highlight at all (the light beside the eye reflects
  only off parts leaning about 25 degrees toward it). The domes and the room in its rims made it read as a liquid against
  a lit wall; in the dark corridor it took a glossier surface (roughness 0.08) and ripples a little under a millimetre
  deep for glints to catch the flashlight and crawl as it moves, on the tape too (soft bright dots).

Not done: the ooze reacting to being walked through (a footprint, a smear), its drips falling off a ceiling, it
drying.
