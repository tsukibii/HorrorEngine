# A muzzle's smoke trail that reads as smoke

The user (2026-11-09, after the last), with four of the weapons guide's pictures: "the smoke trails look a bit unrealistic
and fake and show sharp lines, enhance it, research how to do realistic smoke if required first in godot".

This note is about the trail a gun's muzzle leaves (HSMuzzle's `Trail`, `muzzle/smoke.gdshader`). The puffs thrown out
with a shot, and the export's steam and smoke, are docs/research/godot_smoke.md's: noise-eroded soft discs, soft
particles, lit spheres, flipbooks.

**How it was gathered.** Six web searches. The sources are mostly VFX artists' forum threads and Godot's docs and shader
pages; **a quote is the search engine's extract of the page linked**. "(ours)" marks a choice made here.

## 1. What was wrong (the pictures, `Saved/Godot/_weapons/trail_probe.gd`)

- **A flat band of even width**: the trail was one camera-facing strip; its noise was read in the ribbon's own UVs
  (across 0 to 1, along in metres) and stretched along it, so it streaked into parallel lines.
- **Sharp corners**: its points were joined by straight segments, so where the muzzle turned (breaking the gun open) it
  made a V of two straight strips.
- **Cut ends**: the newest end began at full width and density at the muzzle.
- **No softness where it met things**: the strip cut straight through walls and the gun.
- **Nothing from a still barrel**: points left in one place stacked into a short smudge.

## 2. How real-time games make smoke trails

- **Erode each part by its own age, not the whole ribbon at once.** "Using a ribbon or trail emitter you can have the
  erosion over each quads lifetime. If you use one mesh, the whole texture will erode making it look uniform."
  ([Real Time VFX, Simon Trümpler's sketchbook](https://realtimevfx.com/t/simon-trumpler-vfx-sketchbook/4177/310))
- **Subtract, don't multiply**: "Subtracting the values gives the nicer alpha erosion, not just multiplying"; a soft,
  motion-blurred erosion map; hard edges appear "when erosion runs into a solid wall in the alpha", fixed with a softer
  alpha ([Shannon Berke's LoL FX thread](https://realtimevfx.com/t/shannon-berke-lol-fx-knowledge-share/1133/168),
  [EStampes](https://realtimevfx.com/t/estampes-sketch-15-wip/5388)).
- **Distortion and curl noise ramp in with age**: "the start of the trail has no UV distortion and the end has full
  intensity"; "add noise to the velocity vector on the original line source, then add curl noise to the ribbon as it
  unfolds" ([SideFX forum](https://www.sidefx.com/forum/post/185410/),
  [cigarette smoke trail thread](https://realtimevfx.com/t/cigarette-smoke-trail-vfx-ue4-question/14370)).
- **Soft wisps in the texture**: warps make wispy noise, and "warp intensity controls how soft or sharp the whisps will
  be" ([stylized smoke texture breakdown](https://realtimevfx.com/t/stylized-smoke-texture-substance-designer-breakdown/30038)).
- **Ribbons that read as smoke, not sticks**: the Epic wiki's cigarette smoke is a ribbon "that smooths itself with extra
  sheets", spreading as it rises over about four seconds, its tangents recalculated every frame; users report ribbons
  that look like "jagged straight lines" or sticks, and a ribbon's material stretched along it; a fix is opacity over
  life, layered with smoke puffs
  ([Epic wiki: ribbon particle](https://unrealcommunity.wiki/ribbon-particle-(tutorial)-9tyv6kh4),
  [jagged edges](https://forums.unrealengine.com/t/ribbon-particle-cigarette-smoke-jagged-edges-issue/28475),
  [cascade ribbon tiling](https://forums.unrealengine.com/t/cascade-particles-ribbon-tiling/334718)). Maya's
  SmokeStrings builds a ribbon as "a soft body ... between two streams of particles"
  ([lesterbanks](https://lesterbanks.com/?p=24541)).
- **Curl noise moves it**: Bridson's curl noise takes a noise field as a potential and its curl as the velocity, which
  "yields a divergence-free field, so particles do not bunch together"; three octaves of noise are enough for the look
  ([kbladin's Curl_Noise](https://github.com/kbladin/Curl_Noise), [cnpf](https://github.com/CaffeineViking/cnpf),
  [The Little Grasshopper](https://prideout.net/blog/old/blog/index.html@p=63.html)).
- **Soft particles in Godot**: read the scene's depth and fade the alpha near geometry
  ([Mesh Blend, godotshaders](https://godotshaders.com/shader/mesh-blend-alpha-blend-soft-particles-blend-between-water-and-ground/));
  the breath and the beam in the Look plugin already do it. Billboards get their volume from normals computed per
  pixel ([80.lv, Binbun's smoke](https://80.lv/articles/check-out-this-godot-smoke-vfx-with-fake-depth)).
- **Godot's own particle trails** (GPUParticles3D with a RibbonTrailMesh, `use_particle_trails`) exist in Forward+
  ([docs: trails](https://docs.godotengine.org/en/4.2/tutorials/3d/particles/trails.html)). They break with draw
  order View Depth ([forum](https://forum.godotengine.org/t/cant-setup-gpuparticles3d-trails-they-look-broken-wrong-rendering/105199)),
  and a headless check can't read them back (ours).
- **Timing**: the smoke comes just after the flash ([Toolfarm](https://www.toolfarm.com/?p=76809)), as the trail already
  does (out of the flash's light first).

## 3. What we do (ours)

The trail stays ours: an `ImmediateMesh` built each frame from points the script keeps, so the checks can read them.
Rebuilt to the recipe, and to what the pictures showed along the way (LESSONS):

1. **The points drift in curl noise.** A FastNoiseLite potential, its curl taken by differences (`_curl_at`): swirls
   that never pile the smoke up. The curl ramps in as each point ages (`trail_turbulence`), on top of the rise and the
   shot's push. The fresh smoke leaves the barrel straight and thick (thinner the later it's left: thick just after the
   shot, wisps after), then curls.
2. **Strands of soft sprites along a smoothed curve** (`_strand`):
   - Each frame the points are joined by a Catmull-Rom curve, so there are no corners.
   - Each strand (`trail_strands`) is moved off the line by its own drift, parting as it ages (`trail_spread`), in a
     frame fixed in the world so the strands don't swim as you turn.
   - Each strand is drawn as soft sprites close along it, stretched along the curve and turned to the eye. A strip per
     strand was tried first: it curled, but folded over itself into bright creases in every tight curl.
   - Each sprite takes its share of the density, so the trail doesn't thicken where the sprites crowd.
   - The trail tapers in at the muzzle and thins out by age.
3. **One noise in the world for all of it** (`smoke_noise.gdshaderinc`, shared with the puffs thrown out with the
   shot):
   - Fractal value noise, warped by itself so the wisps curl, rising with time, its contrast stretched.
   - Every sprite and puff on a spot reads the same value, and the noise is what's eroded. Each sprite's own body is
     only its soft footprint. Eroding each sprite's own body made beads like rope; a noise seed per sprite averaged into
     cotton; the puffs' own ragged picture looked like sand.
   - Eroded by subtraction as it ages (`trail_erode`): wisps, then threads, then nothing.
   - Faded where it meets what's behind it (a soft particle, over `soft_m`) and near the lens.
   - Drawn premultiplied, like the puffs: thick smoke converges to its lit colour, thin smoke only adds light.
4. **A still barrel smokes**: points are left by time as well as distance, and the curl takes them up and apart. A gun
   held still after a shot sends up a thin curling thread for a second or two.

WEAPONS holds it:
- **Drawn as sprites**: the trail is soft sprites in its strands (`trail_drawn`).
- **A still barrel's smoke curls**: its smoke older than half a second spreads across the barrel's line. Only the curl
  does that: measured 4.7 cm with it and 0.3 cm without (the sway and the kick).

The before and after are `Saved/Godot/_weapons/trail_probe.gd`'s five moments: swung after a shot, broken open, a shell
popping in, and the barrel's smoke from the side at 0.6 s and 1.6 s.

Not done: a baked flipbook down the trail (EmberGen or Blender), 6-way lighting, Godot's GPU trails.
