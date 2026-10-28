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

## 3. Godot 4.7 Mono

Work on **Godot 4.7 Mono** (the .NET build), which is what the user has installed: C# makes porting our C++
(`Source/StoryRunner/`: `AStoryPreview`, the StoryRunner, the struggle) much more direct than GDScript would. Cloud
sessions need the Mono build too (Woohill's `tools/cloud_setup.sh` fetches the standard build: change it to
`Godot_v4.7-stable_mono_linux_x86_64.zip` and install the .NET SDK it asks for). GDScript stays fine for the
editor-side scripts and the checks.

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

**The first work on the branch is analysis, not building:** the most efficient way to do all of this (one export
script from the desk, or a Godot editor plugin that builds the project from the story, or both; what's generated and
what's the user's; how a re-export merges; the folder layout; how the sequence shows in the editor), written up for
the user to agree before any of it is built.

## 6. Everything Unreal never got, built for Godot

When the branch starts, **build out for Godot every shader and effect that was planned or written for Unreal and
never built or never run there**, not only what's needed for the trial. The list to check against the dev branch
when it lands (and UNREAL_FLOW.md's to-dos, docs/LATER.md):

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

Each exported project carries **an .html guide** (an app to read in the browser, like the desk's `guide.html`, with
pictures made by driving Godot under xvfb as GUIDE makes the desk's): how to change anything in that project in
Godot, step by step. At least: the folders and what's in each; playing it and jumping to any scene; adding an
in-between scene (a stitch) and putting it in the sequence; bringing in a new animation (a Kimodo take or any FBX or
glTF) and giving it to a character; replacing a voice take or a line; moving the cast, the marks and the camera;
changing the lights and re-baking them, the time of day; swapping a texture or a prop; the shaders' settings (the
look, the eyes, the skin); the HUD and its theme; the music and sounds; building the game for Windows and Linux; and
what a re-export from the desk will and won't touch. Whatever else turns up while it's built goes in too.

## 8. When it starts

1. Merge the user's dev branch into `godot-support`; list what it adds that the Godot side needs (§6).
2. The cloud setup (Godot 4.7 Mono, .NET, xvfb, lavapipe), as Woohill's.
3. **The analysis (§5)**: the most efficient way to export, the project's layout, the sequence in the editor, the
   re-export; written up for the user before anything is built.
4. The trial (§1, §4): one Pilot room, its light baked, a contact sheet.
5. Then, as the user agrees: the export, the runner in C#, a PLAYTHROUGH check in Godot, everything in §6, the
   Character Studio's look (§2), and the guide (§7).
