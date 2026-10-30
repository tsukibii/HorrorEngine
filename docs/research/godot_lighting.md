# Better lighting for Godot 4.7: what exists (2026-10-28)

Research for docs/GODOT_PLAN.md §4, at the user's ask ("research if there's any 4.7 compatible better lighting
projects"). Read from GitHub pages and search results; godotengine.org, its forum and gamefromscratch.com were out of
this session's network, so what's said from them is from search excerpts. Nothing here was run.

## The verdict

Nothing for stock Godot 4.7 is a drop-in Lumen. The serious ray-traced options are **engine forks on 4.8-dev,
Windows-first**, which rules them out on the user's Arch machine for now. For our games (small static rooms, night,
a flashlight) the plan in GODOT_PLAN §4 stands: baked light per time of day, VoxelGI, AreaLight3D, fog. Two add-ons
are worth a trial on top of it: **O1S_FauxGI** (the flashlight's bounce, done for us) and **radiance-cascades-lab**
(the nearest thing to Lumen on stock 4.7, but a prototype).

## Forks (a different engine build)

| Project | What | Base | Platforms | Licence | For us |
|---|---|---|---|---|---|
| [NVIDIA-RTX/godot](https://github.com/NVIDIA-RTX/godot) (`nvidia-pt-dlss`) | NVIDIA's own fork, out at GDC 2026: real-time **path tracing** on the new Vulkan RT plumbing, DLSS | master (4.8-dev) | Windows (Streamline); not Linux yet: a proof of concept with direct NGX, [plankatron/godot `ngx-dlss-linux`](https://github.com/plankatron/godot/tree/ngx-dlss-linux) | MIT; DLSS files NVIDIA's own terms | Not yet. Denoising is Ray Reconstruction only (RTX 20 and up; non-NVIDIA cards run it undenoised, Aug 2026); early reports of noise, artefacts and no volumetric fog; said to be rushed for GDC. A 3090 can run it; most players' cards and Linux can't |
| [Diginaat/godot](https://github.com/Diginaat/godot) | NVIDIA's path tracer plus a **DDGIVolume** node (ray-traced diffuse GI by probes, moving lights and geometry), DLSS, PhysX 5 | master (4.8-dev) | Windows 10/11 only; standard and **.NET** builds in its releases | MIT; PhysX BSD-3 | DDGI is the closest to Lumen in Godot, but Windows only and on hardware RT ("any GPU" in its title, RT in its text) |
| [bailaiOWO/rtx-godot](https://github.com/bailaiOWO/rtx-godot) | NVIDIA's path tracer and DLSS rebased on the latest upstream snapshots | 4.8-dev | Windows x64 | MIT | Same as NVIDIA's |
| [HDDAGI, PR #119869](https://github.com/godotengine/godot/pull/119869) | SDFGI's successor in Godot itself: faster, far faster updates, fewer leaks, energy conserving, better reflections | master | all (Vulkan) | MIT | **Open**, 4.x milestone, no date; open items: Intel device-lost, dynamic objects, reflections. One to watch, not to build on |

## Add-ons for stock Godot 4.7

| Project | What | Godot | Licence | For us |
|---|---|---|---|---|
| [GregPickering/O1S_FauxGI](https://github.com/GregPickering/O1S_FauxGI) | A scene you instance: every shadowed light drops **virtual point lights** where raycasts hit (the first bounce), the environment's ambient the rest; all three renderers | tested 4.4.1 | MIT | **Try first.** It is the "faint light where the flashlight lands" trick made general, cheap and dynamic. Needs collision shapes on the level (the importer makes them anyway) |
| [dequevedo/radiance-cascades-lab](https://github.com/dequevedo/radiance-cascades-lab) | **Radiance cascades** GI as a CompositorEffect with compute shaders: moving lights and objects, emissives, several bounces, fog | **4.7**, Vulkan | MIT | **Try second.** Rooms at 10 cm voxels 4.6 ms on an RX 9070 XT at 1080p. One camera-following volume, moving things voxelised as boxes, blocky off-screen reflections; calls itself a lab |
| [jebbyk/SSRT_GI_CompositorEffect](https://github.com/jebbyk/SSRT_GI_CompositorEffect) | Screen-space ray-traced GI as a CompositorEffect | not stated | MIT | Unknown maturity (1 star, no docs); screen space only, so it can't light what's off screen. Low priority |
| [SimplestGodRay3D](https://godotengine.org/asset-library/asset/4146) | Light shafts from one quad and a shader | 4.4 | MIT | Cheap visible beams (the flashlight in dust, a window at dusk) where volumetric fog costs too much |

## In Godot 4.7 itself

LightmapGI (GPU path-traced bakes, directional, a denoiser, shadowmask), VoxelGI (moving lights' bounce in a room),
SDFGI (coarse, leaks indoors), SSIL, SSAO, volumetric fog (every light; a light's Volumetric Fog Energy), reflection
probes, and **AreaLight3D**, new in 4.7 (real-time rectangular lights). Whether AreaLight3D bakes into LightmapGI
isn't stated anywhere found; a 4.7 forum post reports its shadows pixelated at long range. Both are for the trial to
measure. Baking outside Godot: Blender Cycles onto a second UV set, the lightmap as its own texture (glTF doesn't carry
lightmaps); paid Blender add-ons do it (Godot Pipeline, Easy Bake), our `blender_look.py` can do it ourselves.

## What would change the verdict

- NVIDIA's fork (or Diginaat's) on Linux with an open denoiser, on a released Godot: then a path-traced or DDGI mode
  for players with RTX cards, with the baked light as everyone else's.
- HDDAGI merged: a real-time GI that works indoors on stock Godot.
