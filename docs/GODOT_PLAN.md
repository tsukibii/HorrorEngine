# Godot: the plan (not started)

Written 2026-10-28 on `godot-support`, at the user's ask (DECISIONS 2026-10-28). **Nothing here is built yet, and
nothing is to be started until the user says so:** a large dev branch of theirs lands first, and everything it adds
gets ported too. When it has landed, merge it into `godot-support` and read this again before the first step.

## 1. Why, and what for

Godot as an export target from the director's desk beside Unreal, to start with, and perhaps instead of it later:
Claude can run Godot 4.7 in a cloud session (headless checks, and pictures under xvfb with lavapipe: Woohill's
`tools/cloud_setup.sh` installs both) and can't run Unreal. Since our characters are MHR from the Character Studio
(DECISIONS 2026-10-21), not MetaHumans, nothing ties the studio to Unreal but the work already done there, most of it
marked untested in UNREAL_FLOW.md. After the analysis (§5), the first thing built is a trial: one Pilot room in both engines, the
same shot at day, dusk and night, for the user to judge.

## 2. The Character Studio's look, in Godot, on HumanShaders

`GodotPlugins/HumanShaders/` (matmadness, MIT; UPSTREAM.md) is the base for the characters' shaders in Godot: its
skin shader (Burley diffuse, Godot's skin SSS, a softer SSS falloff or a light-warp ramp, translucency, micro
detail, double specular) and its eye and eye-wetness shaders.

**The rule: translate the Character Studio onto these shaders, but keep everything we designed there.** HumanShaders
gives the lighting response (how skin and eyes take the light); the Character Studio gives what the character looks
like, and that must come across the same:

- **the colours**: the skin tone, the eye colours, the makeup's, the lips', the nails', the hair's;
- **the patterns and shapes**: the procedural skin's layers (`skinshader.js`: mottling, pores, freckles, flush,
  veins, age, the makeup layers and their placement), the photo skin and the touch-up paint, the nails and polishes
  (`nails.js`), the lipstick (`lips.js`), the iris patterns, the pupil shapes and the eye styles (`tools/shared/eye.js`,
  `EYE_STYLES`), the lashes and brows (`browlash.js`), the whole looks (`looks.js`);
- **the eye's refraction**: our eye puts the iris behind a refracting cornea (DECISIONS 2026-10-26); HumanShaders'
  eye only does parallax. Keep our refraction (its HLSL for Unreal, `M_StudioEye`, is the same maths) and take
  HumanShaders' sclera SSS and wetness around it.

So a character exported from the Studio carries its paint and its settings (as `extras.studioEye` already does for
the eyes), and the Godot import sets HumanShaders' uniforms from them, with our patterns added to its shaders where
they have no slot. The check, when it's built: the same character, the same pose and lights, in the Studio and in
Godot, measured side by side (the colours within a small tolerance, the patterns where they should be), as STUDIO and
UEEYE measure today. HumanShaders' own textures (MIT and CC BY 4.0) are used only where our paint has nothing to
give (the micro-detail normal, perhaps); if a game ships them, it credits matmadness.

## 3. Godot 4.7, GDScript (decided 2026-10-28, night)

**GDScript, not C#** (the user left it to Claude: "decide yourself whether to use gdscript or c#; since our games are
math light we can do gdscript if you think it's fine"). Why: the runtime that is tested is the desk's
`play/runtime.js` (JS, dynamic: it ports to GDScript nearly line for line; the C++ `Source/StoryRunner/` was never
run, and RUNNER_SPEC.md is its real source); cloud checks stay one command (`godot --headless -s check.gd`), no .NET
SDK and no compile step; Woohill's GDScript lessons and lint carry over; anyone editing an exported project edits its
scripts inside the editor. The user's machine has **Godot 4.7 Mono** installed, which runs GDScript projects
unchanged; where speed matters later (soft bones, cloth) it's a shader, a compute pass or a GDExtension, not C#.

**The cloud setup:** `tools/godot_setup.sh` (after Woohill's `tools/cloud_setup.sh`: Godot 4.7 standard to
`/usr/local/bin/godot`, xvfb and lavapipe; a no-op when they're there or off the cloud, `--force` otherwise).
**The check:** `tools/godot/check.sh`, GODOT: a headless script and a lit box rendered under xvfb on lavapipe
(Forward+ on llvmpipe works here: Vulkan 1.4, a shadowed omni light). Scripts take `$GODOT`, else `godot`, else
`godot-mono` (the user's). Godot prints ALSA errors under xvfb: harmless, filtered.

## 4. Lighting (from the 2026-10-28 discussion)

Godot has nothing like Lumen's fully dynamic GI (HDDAGI isn't merged; 4.7's Vulkan ray tracing is groundwork only).
For our small static rooms at night: bake each room's light per time of day (Blender Cycles from
`blender_look.py`'s setups, or Godot's LightmapGI), swap the bake with the scene's `time`, VoxelGI per room for the
flashlight's bounce, AreaLight3D (new in 4.7) for windows and screens, fog, and UltraVHS ported as a Godot shader.
What else exists for 4.7 (forks, add-ons, what to try): docs/research/godot_lighting.md. The two add-ons to try
in the trial: O1S_FauxGI (the flashlight's bounce) and radiance-cascades-lab (real-time GI, a prototype).

**Baked first, VoxelGI on top only where a light moves** (the 2026-10-28 talk: "fake realistic lighting that is
allowed to be baked", urban and apartment rooms). VoxelGI alone can look good in a small flat and follows a light
that flickers, dies or moves, but it's soft and blotchy (no contact darkening without SSAO and SSIL), leaks through
anything thinner than about two of its cells and costs a few ms; a bake gives the corners, the soft shadows and the
probes that light the cast, for almost nothing at run time, but its bounce can't change. So: **a bake per lighting
state of a room** (lights on, power cut; day, dusk, night), swapped when the state changes (the lights dying: flicker,
dark, swap while it's black); flickers as the live direct light over the bake; VoxelGI (or O1S_FauxGI) only where a
light must move its bounce (the flashlight, headlights across a ceiling, a TV as the only light). Proposed for the
trial, not yet agreed: one flat lit three ways (VoxelGI only, baked only, baked plus VoxelGI for the flashlight), lit
and with the power cut, as one contact sheet. To verify there: whether a lightmap and VoxelGI layer cleanly on one
surface, and whether two bakes can blend (a shader) or only swap.

**The trial, first pass (2026-10-29, on the cloud's software Vulkan; `tools/godot/sheet.py`, `tests/lookshot.gd`;
`Saved/Story/TestRoom001/godot_reference/gi_sheet*.png`):** TestRoom001's corridor at night, the ambient off so a
GI's bounce shows for itself. Direct lights only, SDFGI and one VoxelGI over the whole level came out the same to
three decimals: the greybox's walls are 10 cm and the cells of SDFGI (20 cm at its finest) and of a level-wide VoxelGI
(37 cm) miss them. A **VoxelGI per room** (its box plus a metre, 64 cells: about 8 cm) baked at run time gives a
bounce, small on these plain grey walls (the floor's median 0.145 to 0.153), and SSAO on top adds the corners
(0.173). The probe room (`tools/godot/smoke/gi_probe.gd`: a closed 6 m room, one lamp, no ambient) shows the renderer
does GI: the shadowed floor 0.40 direct, 0.44 SDFGI, 0.51 VoxelGI. So for our rooms: **VoxelGI per room, baked once
when the level loads (or at export, cached), SSAO and SSIL on, the flat ambient down to a fill**; SDFGI only for a big
open level. A lightmap bake (LightmapGI) needs the editor and stays the user's step (the guide tells how). Still to
look at on the 3090: the cost per frame of nineteen VoxelGIs (only the rooms in view need to be on), and whether the
PBR shelf's surfaces (not plain grey) make the bounce worth more.

## 5. Export: a Godot project per game, as a .zip

Not Unreal's way (one project for every game, docs/STUDIO.md): Godot is light enough that **each game is its own
Godot project**, and the desk's Export makes it, ideally as a `.zip` the user opens in Godot 4.7 Mono and keeps
working in. The Studio's shared things (the shaders, the runner, the plugins) go into each project as a copy (an
`addons/` folder each), so a project stands alone; a later export of the same game has to bring the desk's changes in
without losing what the user changed by hand in Godot (the rule from CHARACTER_STUDIO.md: editable at every stage, a
receipt on each bake), and that is part of the analysis below.

**The project has to be easy to change by hand in Godot's editor** after the export: a folder structure that reads
in Godot's FileSystem dock (the game's acts and scenes in the story's order, numbered so they sort as they play; the
levels, the cast, the props, the lights, the sounds and the takes each in their place), scenes as `.tscn` files with
plainly named nodes, settings as exported properties in the Inspector (not buried in code or JSON), the sequence of
the game (the flow, the stitches, the scenes' clips and cues) as something seen and edited in the editor itself (a
resource per scene, or a dock), and C# where the runner needs it, kept out of the way of what the user edits.

**The analysis is written: docs/GODOT_EXPORT.md** (2026-10-28, night; the chosen way, the project's layout, the open choices for the user, the re-export, the order). It was the first work on the branch, not building: the most efficient way to do all of this (one export
script from the desk, or a Godot editor plugin that builds the project from the story, or both; what's generated and
what's the user's; how a re-export merges; the folder layout; how the sequence shows in the editor), written up for
the user to agree before any of it is built.

## 6. Everything Unreal never got, built for Godot

When the branch starts, **build out for Godot every shader and effect that was planned or written for Unreal and
never built or never run there**, not only what's needed for the trial. The list, against UNREAL_FLOW.md's to-dos and
docs/LATER.md, and **what `dev-002` added that Godot needs** (merged 2026-10-28, night: the flashlight (`torch`), the
power cut and the breaker box, the peephole, the latch, cleaning (stains, the mop), examining (a thing in the hands),
footsteps by the room's floor (the sound shelf), the inventory row, the to-do list and requests, nights as chapters
(sleep, the chapter card), time skipped and thoughts that type themselves out, what's shown by what's happened
(`{her}`), a cast member's models per scene, body tracks (`behave` cues across lines), the expression library and the
face rows (ARKit-52 onto MHR's 72 shapes), the Studio's baked colours and the skin light maps (`studioSkin`), hooded
lids and the nose sculpt, hats, the designer outfits, the sound shelf (240 CC0 effects), the score room's expanded
orchestra, texture templates for placeholder things (the desk's painted blocks), TestRoom001 (every station a thing to
pass in Godot too: its reference in `Saved/Story/TestRoom001/reference/`); desk-only, nothing to port: the writers'
room, the dashboard, the flow board's arrow editing):

- **the look**: UltraVHS (the camcorder to tape: lens, sensor, tape, screen; the night mode; the handheld camera;
  docs/VHS.md: the camera's display, the HUD over the footage, focus, the tape material) and Light Kit (the Day, Dusk
  and Night sky rig, window lights, headlight sweeps, flicker, light-function patterns, puddles) as Godot shaders and
  nodes, measured against `UltraVHS/Tools/preview.py` and BLENDERLOOK's numbers;
- **surfaces**: M_StudioSurface (the PBR shelf's sets, packed ORM) and the kit's things with their doors;
- **the characters**: the Studio's eye (M_StudioEye: the refracting cornea), the skin, makeup, nails and lips on
  HumanShaders (§2), the salon's hair cards (docs/research/hair_cards_unreal.md: shell normals, dithered coverage,
  the edge-on fade), the lashes and brows, the teeth, the clothes' drape and the soft bones (docs/FLESH.md §5);
- **the little things** (docs/IMMERSION.md §5): steam, smoke, the burn, embers, LEDs, digits, flames, the pour,
  drips, screens, a clock's hands, their sounds;
- **the game**: the StoryRunner and the struggle (docs/RUNNER_SPEC.md) in C#, hiding and its see-through, the HUD and
  its themes, the pause menu, reverb per room, the takes' voices and faces, the cast's look and trackers (UNREAL_FLOW's Control Rig layer), Play mode's
  parts as they are on the desk.

## 7. A guide in every exported project

**Built 2026-10-29** (`storykit/godot_guide.py`; the desk's Godot button and the launcher's Godot section run the
export): the sections below, each honest about what the export does now and what waits (GODOT_EXPORT §8).

Each exported project carries **an .html guide** (an app to read in the browser, like the desk's `guide.html`, with
pictures made by driving Godot under xvfb as GUIDE makes the desk's): how to change anything in that project in
Godot, step by step. At least: the folders and what's in each; playing it and jumping to any scene; adding an
in-between scene (a stitch) and putting it in the sequence; bringing in a new animation (a Kimodo take or any FBX or
glTF) and giving it to a character; replacing a voice take or a line; moving the cast, the marks and the camera;
changing the lights and re-baking them, the time of day; swapping a texture or a prop; the shaders' settings (the
look, the eyes, the skin); the HUD and its theme; the music and sounds; building the game for Windows and Linux; and
what a re-export from the desk will and won't touch. Whatever else turns up while it's built goes in too.

## 8. When it starts

1. Merge the user's dev branch into `godot-support` (done: `dev-002` through main, 2026-10-28, night); list what it adds that the Godot side needs (§6).
2. The cloud setup (§3): done 2026-10-28, night.
3. **The analysis (§5)**: written, docs/GODOT_EXPORT.md (2026-10-28, night); its §4 has the choices for the user.
4. Then GODOT_EXPORT §8's order: the trial (§4 here), the exporter, the runtime (GDPLAY), the look and the
   characters' shaders (§2), the rest of §6, the guide (§7), the re-export.
