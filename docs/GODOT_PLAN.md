# Godot: the plan (not started)

Written 2026-10-28 on `godot-support`, at the user's ask (DECISIONS 2026-10-28). **Nothing here is built yet, and
nothing is to be started until the user says so:** a large dev branch of theirs lands first, and everything it adds
gets ported too. When it has landed, merge it into `godot-support` and read this again before the first step.

## 1. Why, and what for

Godot as an export target from the director's desk beside Unreal, to start with, and perhaps instead of it later:
Claude can run Godot 4.7 in a cloud session (headless checks, and pictures under xvfb with lavapipe: Woohill's
`tools/cloud_setup.sh` installs both) and can't run Unreal. Since our characters are MHR from the Character Studio
(DECISIONS 2026-10-21), not MetaHumans, nothing ties the studio to Unreal but the work already done there, most of it
marked untested in UNREAL_FLOW.md. The first step, when it's time, is a trial: one Pilot room in both engines, the
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

## 5. When it starts

1. Merge the user's dev branch into `godot-support`; list what it adds that the Godot side needs.
2. The cloud setup (Godot 4.7 Mono, .NET, xvfb, lavapipe), as Woohill's.
3. The trial (§1): one Pilot room, its light baked, a contact sheet at three times of day.
4. Then, if the user wants it: the importer (story.json to scenes), the StoryRunner in C#, a PLAYTHROUGH check, and
   the Character Studio's look (§2).
