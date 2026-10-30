# Realistic smoke and steam in real time (for the Godot export's little things)

2026-10-29. The user found the first Godot puffs (round additive blobs, the desk's own recipe) too fake and stylized
and asked for a search. What real-time smoke and steam use, and what the export does now.

## What makes smoke read as real

1. **Noise-shaped sprites with alpha erosion, not radial dots.** A puff is a soft disc masked by fractal noise; as it
   ages the noise threshold rises so it dissolves from the edges inward. Each puff gets its own rotation and a slow
   spin, so no two are alike. Godot smoke packs do this with procedural noise (their performance knob is the noise's
   iterations). Alpha blend, never additive: steam is translucent white-grey and lit, smoke is dark and darkens what
   is behind it; additive glows white.
2. **Soft particles.** A puff fades where it nears geometry behind it (depth fade: `proximity_fade` on a
   StandardMaterial3D, or the depth texture in a shader), so it never cuts across the spout, the lid or a wall.
3. **Lighting.** The AAA method is **6-way lighting**: a baked simulation flipbook with six directional lightmaps
   (RGB+RGB of two textures), the shader weighting them by the light's direction, so puffs show internal shadow and
   rim light from any light; cheap to draw, heavy in memory, baked from EmberGen or a Blender smoke sim. A light
   version: shade each puff as a lit sphere from its UV (brighter where the room's light falls) with a back-light wrap.
4. **Flipbooks.** Godot 4 particles play animated sprite sheets (frames, a random start offset); fire and smoke gain
   most. Frame blending was a community PR (Hugo Locurcio, 2021), not confirmed merged.
5. **Motion.** Fewer, larger puffs; size grows over life; turbulence (ParticleProcessMaterial since 4.1, or curl noise
   per puff); emission from a disc, not a point; steam short-lived (1 to 2 s) and fast, smoke long and curling.
6. **Volumetric.** A FogVolume with a custom `shader_type fog` and animated 3D noise (the official Volumetric Fog
   demo has one) suits room haze and dense smoke, Forward+ only; its froxel grid is far too coarse for a kettle's
   plume and thin volumes flicker as the camera moves. A raymarched noise volume in a spatial shader is the middle
   ground for a small plume.

## What the export does now (`puff.gdshader`, `lifefx.gd`)

The puffs keep the desk's schedule, rates and sizes (the checks hold) but draw through a shader: a soft disc eroded by
four octaves of value noise as it ages, spun by its seed, lit as a little sphere from above, faded over 8 cm into the
scene behind it, alpha-blended (steam white-grey at 0.26 a puff, smoke dark at 0.5). Pictures:
`Saved/Story/TestRoom001/godot_reference/kitchen_fx_kettle.png`, `kitchen_fx_table.png`.

Still to do in the look pass (GODOT_EXPORT §8 step 4): a baked steam loop as a flipbook (Blender's Mantaflow, a 8x8
sheet) with 6-way lighting for the kettle's jet and the hob's pot, the fine lid steam as wisps (stretched along their
velocity) rather than balls, turbulence per puff, and the same shader back on the desk's three.js stage (its puffs are
the reference for Unreal, which has none yet).

## Sources

- Godot Smoke VFX by GameIdea Studio: https://gameidea-studio.itch.io/godot-smoke-vfx
- Godot 4 3D Particle Systems Guide (Godot Lab): https://godotlab.org/en/tutorials/3d-particle-systems
- Process material properties (Godot docs): https://docs.godotengine.org/en/4.3/tutorials/3d/particles/process_material_properties.html
- Flipbook frame blending (Hugo Locurcio): https://x.com/HugoLocurcio/status/1415387581370482692
- Realistic smoke lighting with 6-way lighting (Unity): https://unity.com/blog/engine-platform/realistic-smoke-with-6-way-lighting-in-vfx-graph
- Huge real-time smoke in game engine (Real Time VFX): https://realtimevfx.com/t/huge-real-time-smoke-in-game-egine/15860
- EmberGen: https://jangafx.com/software/embergen
- Stylized Smoke Shader (godotshaders.com): https://godotshaders.com/shader/stylized-smoke-shader/
- Volumetric fog and fog volumes (Godot docs): https://docs.godotengine.org/en/4.7/tutorials/3d/volumetric_fog.html
- Moving gradient noise fog (godotshaders.com): https://godotshaders.com/shader/moving-gradient-noise-fog-mist-for-godot-4/
- FogVolume cutting around camera (Godot forum): https://forum.godotengine.org/t/fogvolume-cutting-around-camera-when-moving-in-3d-space/97583

(The articles themselves couldn't be opened from the cloud session: those hosts aren't in its allowed domains.)
