# The Godot export: the analysis (2026-10-28, night; for the user to agree before it's built)

GODOT_PLAN §5 asked for this before anything is built: the most efficient way to turn a game on the desk into a Godot
project the user can keep working in. Measured facts in this session: Godot 4.7 runs here headless and renders under
xvfb (GODOT ok); a `.tscn` written by hand as text loads exactly as written (a box with lightmap UVs, its collision, a
lamp), and Godot's own save of it differs only in the order of its lines. So a Python exporter can write the whole
project without Godot running, and Godot regenerates its `.import` files on first open.

## 1. The shape, in one paragraph

**Export** on the desk = the bake that exists today (the Watch stepped through every scene: cameras, every bone,
faces, subtitles, flicker; each cast member's body as a glb) + a new plain-Python exporter (`storykit/godot.py`, a
sibling of `importer.py` with no `unreal` import: `plan.py` already turns the world into pieces) that writes **one
Godot project per game** as text files and copies the assets, zipped: `Saved/Story/<G>/godot/<G>.zip`, or straight
into a folder the user names. The project carries **our runtime as an add-on** (`addons/horrorstudio/`, GDScript,
the desk's `play/` ported) and HumanShaders as another, so it stands alone. Scenes are `.tscn` files whose timelines
are **AnimationPlayer animations** (Godot's own sequencer: the camera, every bone, the face shapes, the voice as an
audio track, the subtitles and cues as method tracks), so a scene is edited in Godot's animation editor. Tasks
(stitches) are beats as **Resources with typed fields** in the Inspector, the flow a resource with a small dock that
draws it. A re-export overwrites only what the user hasn't touched, and reports the rest.

## 2. Why this and not the other ways

| Way | Verdict |
|---|---|
| **A. Python writes the project (text `.tscn`/`.tres` + copied assets)** | **Chosen.** Fast (no engine at export time), testable in the cloud and on the user's machine alike, and the text formats are stable and documented; the desk's bake already computes everything hard (poses, cameras, faces). |
| B. A Godot editor plugin reads story.json and builds the scenes through the API | Needs Godot at export time and an editor plugin to maintain; the API builds the same `.tscn` A writes. Kept only for what only the editor can do (lightmap bakes, §6). |
| C. Woohill's way: an add-on reads the data files at run time, no generated scenes | Smallest export, but nothing to edit in the editor: the user asked for scenes they can change by hand. Used *inside* A for the things that stay data (the flow, items, notes, sounds, the lives). |
| D. Play the bake as a recording (as Unreal's `AStoryPreview` does) | Not editable, and the runtime computes nothing. The bake's numbers go into Animation tracks instead, which are editable and play through Godot's own player. |
| One project for every game (Unreal's way) | Rejected by the user: a project per game; shared things are copied in (an add-on each). |

## 3. The project a game becomes

```
<Game>/
  project.godot                 Forward+, the game's title, the start scene (the runtime's main), input map, GDScript only
  addons/horrorstudio/          THE RUNTIME (copied, versioned): the runner, parts, HUD, menu, physics, the shaders
                                (VHS, Light Kit's sky and lights, M_StudioSurface, the eye, the skin), the lives' effects
  addons/humanshaders/          as GodotPlugins/HumanShaders
  game/
    game.tres                   StoryGame: title, start, fov, time, theme, karma axes, player_name, clip_max, see_through
    flow.tres                   StoryFlow: the nodes (type, ref, next, choices and their conditions), endings, interrupts
    data/                       items, notes, sounds, lines, secrets, achievements, motions (names), lives: .tres each
    levels/house/house.tscn     rooms as Node3D groups: walls/floors/ceilings (BoxMesh + collision, UV2 on, a material from
                                its `look`), kit things and props (glb instances), doors (Door scene: frame, leaf on its
                                hinge, handle; locked_by, swing, creak, peephole, latch as exported properties), lights
                                (Omni/Spot + flicker script), spots (Marker3D), triggers (Area3D), windows (AreaLight3D)
                                + lighting/ (the bakes per state: lit, power_cut; day, dusk, night: §6)
    cast/mari/mari.glb          the body (the Studio's export or the shaped MHR), mari.tscn (the body wearing its
                                materials, the eye and skin shaders set from the glb's extras), models/<name>.glb
    acts/                       ONE FOLDER PER FLOW NODE, numbered in play order (§4):
      01_arrival/stitch.tscn    a StoryStitch node; children: one Beat node each (when, do: Resources in the Inspector)
      02_mari_in_the_hall/
        scene.tscn              StoryScene: the level instanced, the cast at their spots, a Camera3D, an AnimationPlayer
        takes/c1.ogg ...        the voice of each take (ffmpeg from the mp4), subtitles in the animation
      ...                       choices/endings: small .tres beside the flow, no folder
    ui/theme.tres, hud.tscn     the HUD theme from the game's (glass, glass-rose, neumorph, plain) as Godot theme vars
    music/, sfx/                the palette's cues (rendered) and the shelf's files the game names
  guide/index.html              the guide (GODOT_PLAN §7), with its pictures
  .desk/manifest.json           every generated file's hash (the re-export's receipt, §5) and the desk's version
```

**Sequencing the user can see:** a scene's whole timeline is one Animation (`scene`): a position/rotation track for
the camera (the bake's, at 30 fps, keys thinned), bone tracks per cast member (the bake's skin matrices turned into
local bone transforms on the glb's skeleton), blend-shape tracks for the 72 face shapes, an audio track per take, a
method track calling the runtime (`subtitle(ja, en)`, `cue(...)`: lights_die, sound, door, fade, blink and glance
seams, the events' stops, the replies' choices) at the clip edges. Everything is on Godot's timeline, draggable; the
takes' lengths come from the desk, so **timing stays elastic on the desk** (the rule in CLAUDE.md) and is fixed in the
export, as a build is. The flow is also written as `acts/_ORDER.md` (the `story.py flow` tree) and shown by the dock.

**Tasks the user can edit:** a Beat is a node (so the scene tree shows a task's beats in order, draggable); its `when`
and `do` are `Array[StoryCommand]` in the Inspector; `StoryCommand` is one script whose Inspector fields change with
its `verb` (`_get_property_list` from the parts registry: the same verbs the desk's palette has, 43 actions, 23
conditions, 20 interactables, 5 abilities, 5 behaviours, 2 physics kinds), so each reads as the desk's sentence.
Props' `use` is the same: a `StoryUse` resource on the prop's node.

## 4. Open choices (the user's call; my pick first)

1. **Numbered folders in play order** (`01_arrival`, as asked) **or stable ids** (`arrival/`)? Numbers shift when the
   flow changes, so a re-export renames folders. Godot 4.4+ keeps references by UID, and the exporter rewrites its
   own; the user's own files inside a renamed folder move with it. My pick: **numbers, with the act's number first**
   (`1-02_mari_in_the_hall`), and the exporter never renumbers a folder the user has files in without saying so.
2. **Animations baked** (as above: editable, what the desk showed) **or the blocking played live** by a GDScript port
   of `motion.js` (editable as blocking, not as curves)? My pick: **baked**, with the blocking kept as data beside it
   for the day a live player is wanted.
3. **GDScript only** in the export (the user's Mono build runs it; a C# project needs .NET on every machine that opens
   it): yes, unless told otherwise.

## 5. Re-export: keeping the user's hand work

The rule (CHARACTER_STUDIO.md §2): editable at every stage, a receipt on each bake. Here:
- **Built (2026-10-29):** `.desk/manifest.json` holds the hash of every file the exporter wrote. On a re-export the
  project is written fresh beside the old one and merged in (`merge_export`): a file whose content still matches its
  last hash is overwritten; one the user changed is **kept**, the new version written beside it as
  `<name>.desk.<ext>` (taken back by hand when they want it; gone again once theirs matches the receipt); a file the
  last export wrote and this one didn't goes if unchanged, stays if they changed it; files they added anywhere are
  never touched (`custom/` folders are theirs by convention). The export's report lists the kept files
  (`export.json` `kept`, the CLI's lines, the desk's Export panel). GDEXPORT changes a level file by hand and
  re-exports: the change survives, the new one is beside it. Godot's own sidecars (`.import`, `.uid`) and its
  `.godot/` are never in the receipt (2026-10-29: a receipt written after an import had listed them, and the next
  re-export took them for stale and removed them, so nothing with a texture loaded).
- Not built: nodes the user adds inside a generated scene (a `hand` group) lifted out and put back into the new
  file; today a changed scene file is kept whole. The runtime add-on is copied on every export (the plugins live in
  the repo: a change there reaches every game).

## 6. Lighting in the export (GODOT_PLAN §4)

Every room piece has lightmap UVs (`add_uv2`, `lightmap_size_hint`; glb props by the import option). Each level gets
a `LightmapGI` per lighting state (`lit`, `power_cut`, by the scene's `time`), and the runtime swaps them with the
state. **Baking is editor-only in Godot** (the LightmapGI docs); the trial decides between (a) one click in the editor
per state (the guide shows it), (b) an editor plugin button that bakes every state in turn, (c) `godot --editor
--headless` with an EditorScript from the exporter (tried once here: the script loader refused an EditorScript on the
command line; there may be a right incantation), (d) Blender Cycles from `blender_look.py` (Blender isn't on this
machine; `retarget.py setup` brings its module). Moving lights (the flashlight) keep their bounce by VoxelGI or
O1S_FauxGI, judged in the trial.

## 7. The runtime add-on (what gets ported, in order)

The desk's `play/` (about 2,400 lines of JS: `runtime.js` 919, the parts, `hud.js`, `menu.js`, `physics.js`, the
torch, peephole, latch, examine, todo, typing, steps) and the Watch's scene player (choices, replies, events, seams,
the fades; RUNNER_SPEC.md), as GDScript classes under `addons/horrorstudio/`: `StoryRuntime` (the player: a
CharacterBody3D with the look, walk, crouch, steps and torch abilities; USE_RANGE, SIGHT and the rest as exported
settings), `Parts` (the registry, each verb a small script), `ScenePlayer` (drives the scene's AnimationPlayer and
answers its method track), `Hud` (Control nodes, the theme), `Menu` (saves, settings), the lives (`life.js` ported,
the effects as GPUParticles3D and shader parameters at the kit's sockets). The check: **GDPLAY**, `playtest.js` ported
to a headless Godot script that walks the Pilot to its good ending (Woohill's `*_check.gd` pattern), run after every
export; and **GDEXPORT**, the exporter's own (every game exports, the project opens headless, every scene and level
loads, every verb in the games has a part).

## 8. The order (replaces GODOT_PLAN §8's steps 4 and 5)

1. **The trial** (GODOT_PLAN §4): the Pilot's hall exported by a first cut of the level writer (rooms, props, doors,
   lights, spots), lit three ways, pictured at three times of day and with the power cut; the bake route settled.
2. **The exporter v1**: `game.tres`, the flow, the levels, the cast's bodies, the scenes (the bake into Animations,
   the takes' audio), the stitches, the data; the zip; the desk's Export button (`/api/godot/export/<G>`); GDEXPORT.
3. **The runtime v1**: enough of §7 for the Pilot to be played start to end in Godot; GDPLAY ok.
   Then TestRoom001 station by station: **GDTESTROOM** ok (every station's checks as the desk's TESTROOM makes them; the
   typing effects, the little things' lights, the round's spots, the names as words all ported on the way).
   **The bake played** (`bakeplay.gd`, 2026-10-29): `tools/godot/bake.mjs` records the Watch as the desk's Generate does
   (the scenes' camera, bodies, skinning matrices, black, lights, 30 fps; each cast member's shaped body as a glb); the
   export splits it a file a scene (`game/previs/index.json`, `scenes/<sid>.json`, `Body_<who>.glb`) and the scene
   player drives the camera, a skinned body posed from the matrices (every bone's global pose first, then each as a
   local under its parent: the bake's bone order isn't parents first) and the lights' flicker from it, mapping its own
   timeline onto the bake's by clip (the bake plays every line and the first answers; a reply's other branch holds the
   last frame). Measured: the skinned head within 8 cm of the recorded joint; a picture `tests/sceneshot.gd`. **The
   faces**: the body glb carries MHR's 72 face shapes as morph targets (bake.js keeps them as targets instead of baking
   them, named as the bake names its weights), and each frame's weights go onto the mesh's blend shapes (measured: the
   lobby scene's lip pucker at 1.0; `godot_reference/s_hello_face.png`). **The reply branches**: the bake records
   every combination of a scene's answers (silence too, at most 16 a scene) as its own recording (`recordings`, keyed
   `c3=good|c7=`; the export a file each, `scenes/<sid>__<key>.json`), and the scene player switches to the branch's
   recording at the answer, its timeline mapped onto it (measured: the night scene's painting answer, no frame held).
   Not yet: a cast member's models per scene.
   **The things' meshes** (2026-10-29): the export builds the kit's meshes the game needs (`tools/kit_build.py`, the
   glbs the Unreal importer uses too) and copies them and the library's into `game/meshes/<lib>/`, each instanced in
   its block (`art` under the StaticBody3D, the box mesh hidden, its collision kept): a kit thing at the block's
   base, a kit door's leaf on its hinge axis, a library mesh centred and rested on the base and scaled evenly into
   the box unless `real` (the desk's kitIn and dress; the glb's bounds read from its accessors). The project is
   imported once after writing (`import_project`), so the glbs load headless; GDEXPORT counts the art meshes and
   fails on an empty one. Picture: `godot_reference/kitchen_kit.png`.
   **The little things' effects** (2026-10-29, `lifefx.gd`, lifefx.js ported): the kit's build writes each mesh's
   sockets and slots into the kit index (`build.mjs`), the export's `game/kit.json` carries them, and the effects run
   at the sockets every tick in Play and during scenes: steam and smoke as puffs (a MultiMesh of billboards born on
   the desk's schedule, the same rates, sizes and alphas), LEDs and embers, digits (Label3D), the hob's rings glowing
   (the slot's surface material, emissive, plus a glow), candle and gas flames, the cup's fill (the inner profile
   turned), the pour (the kettle lifted and tipped over the cup, a stream), drips and the running tap, the clock's
   hands and the pendulum (a slot's surface split into its own node and turned), the rattling lid, screens (static, a
   programme, a phone's lock screen and call), the buzz, the cigarette burnt back by a clip shader. `report()` says
   what each thing shows; GDTESTROOM checks the kettle's LED and steam, the hob's glow and digits, the cup's fill, the
   cigarette's burn, the clock's hands and the TV's static. Pictures: `godot_reference/kitchen_fx_*.png`. The puffs
   draw through `puff.gdshader` (noise-eroded soft discs, spun, lit from above, faded into the scene behind, alpha
   blended: docs/research/godot_smoke.md, after the user found the first additive blobs too fake). **Their sounds**
   (2026-10-29, `lifesound.gd`, lifesound.js ported): each recipe (noise, RBJ biquads, tones with a vibrato, blips
   that slide, bursts that decay, amplitude modulation) rendered once into a 22 kHz looping wave (two seconds, or the
   figure's period: the phone's 2.2 s, the clock's tick and tock in two) and played placed at the thing; a state's
   `sound` while it lasts with its level ramping (`level: [from, to]` over the state's secs), its `enter` sounds once
   as it starts (the switch, the click, the beep, the igniter, the tune); what the desk modulates live is the player's
   pitch (the kettle's low band opening, the pour climbing with the cup, the whistle rising); the drip's plink when
   the drop lands. `heard` and `playing()` for the checks: GDTESTROOM hears the kettle's switch and rumble, the
   clock's tick, the roar taking over at the boil.
   **The sound shelf** (2026-10-29): the export copies `Content/Studio/SFX` (CC0, 6 MB) into `game/sfx/` with its
   index; `play_sfx` plays a shelf sound placed in the room (an AudioStreamPlayer3D at the thing or the cast member,
   inverse distance, from a pool) or on the player, looping as the shelf says, the stream loaded at run time when
   the project isn't imported yet; the story's `sound` actions, the steps, the knocks, slams, the latch, the
   flashlight and the scenes' sound cues all go through it; `audio_log` says what played (headless, the audio server
   is a dummy: the streams load, nothing is heard). GDTESTROOM checks the steps' and the knock's sounds loaded and
   placed.
   **Physics** (2026-10-29, `physics.gd`, physics.js ported onto Godot's own bodies): the thing in the hand is a copy
   of it (its art or its block) sprung after the hand each frame with its kind's stiffness and give, dipping with
   each step, kept off the walls; a plushie squashes and stretches with the hand's acceleration and its top leans
   (the copy tilted from its base: the desk bends the mesh in a shader); a die is a RigidBody3D with the kind's mass,
   bounce, friction and damping, thrown from the hand against the level's own static bodies, its pips drawn on a
   six-surface mesh, the face on top read when it sleeps (or after 8 s), `rolled` heard then. GDTESTROOM checks the
   plushie's copy in the hand and the die thrown, settled off its start, on the floor.
   **The pause menu and the themes** (2026-10-29, `menu.gd`, `theme.gd`): Esc holds the game and the menu opens in
   the HUD's theme (`game.ui_theme`: glass, glass-rose, neumorph, plain as Godot Themes: text, surface, border,
   radii, the keys): the controls on the left as key tiles with what each does, Resume, Save game (three slots and
   the autosave, in `user://saves_<game>.json`; a chapter's and a checkpoint's autosave lands there), Settings
   (Display, Graphics, Audio: the desk's rows with their Unreal names and the Godot name each maps to, stepped with
   A/D, levels as dashes; applied where Godot can: the window mode and size, VSync, the frame rate limit, brightness
   through the environment's adjustment, the buses' volumes, the subtitles and their size; `user://
   horrorstudio_settings.json`), Quit as a footer choice (to title: the Watch stops; to desktop). Pictures:
   `godot_reference/menu_root.png`, `menu_settings.png`. GDTESTROOM opens it, saves to a slot and resumes.
   **The guide and the desk's button** (2026-10-29): every export carries `guide/index.html` (`storykit/godot_guide.py`,
   GODOT_PLAN §7: the folders, playing and `--node=<id>` to jump anywhere, an in-between scene, a new animation,
   lines and faces, the cast's marks and the camera, the lights and baking, textures and props, the little things,
   the HUD, theme and menu, the sounds, building for Windows and Linux, what a re-export touches; honest "not built
   yet" boxes; the checks' pictures from `Saved/Story/<G>/godot_reference/`). The desk's **Godot** button (beside
   Unreal) records the scenes, runs the export with `--zip` (`/api/godot/export/<G>`) and links the guide
   (`/godot/<G>/guide/index.html`); the launcher has the export and the checks under Godot. GDEXPORT checks the guide.
4. **The look** (GODOT_PLAN §6): UltraVHS and Light Kit as shaders and nodes, measured; M_StudioSurface; the
   characters' shaders on HumanShaders (§2 of the plan) with the Studio's colours and patterns checked side by side.
   **UltraVHS done** (2026-10-29, `vhs.gdshader`, `vhs.gd`): the plugin's three passes (the camera's lens, sensor and
   tape sampling; the tape's luma low-pass and edge enhancement, chroma bleed and shift, tracking, head switching,
   noise, dropouts; the screen's pillarbox and scanlines) in one canvas shader on a layer under the HUD, the presets
   camcorder, worn and nightmare, night mode (the black turning blue with the time of day), the menu's Film grain as
   the noise's cap, the story's new word `game.vhs` (STORY_FORMAT §9.1, the check). **Persistence** (2026-10-29): a viewport of its own copies the screen's last frame each frame (`vhs_hold.gdshader`) and the tape mixes it in by the preset's Ghosting (0.15, 0.2, 0.3); GODOTLOOK takes the chart out for a frame and measures the ghost it leaves. **GODOTLOOK** renders the plugin's chart through it and measures it
   beside the numpy reference: edge rise 5.0 / 5.0, halo 0.119 / 0.111, chroma 2.2 / 2.4, black 0.046 / 0.049.
   Pictures: `Saved/Story/TestRoom001/godot_reference/kitchen_vhs_*.png`.
   **The inventory's row as the things themselves** (2026-10-29, `hud.gd` `inventory`, after the user: the common way,
   the model scaled into the slot and only the shown ones drawn, not pictures): each shown slot is a small SubViewport
   with a world of its own (a warm key, a blue rim, a cool fill, an orthographic camera three-quarters from above)
   holding a copy of the thing's mesh (the kit's or the library's, else its block; `physics.gd`'s `copy_of`, made at
   the pickup) fitted to the slot; the one in the hand bigger, turning, its name under it; the side ones dimmer. Only
   the row's five slots exist, the side ones rendered once when the row changes (`UPDATE_ONCE`), the middle one every
   frame while the row shows; a thing scrolled out of the row has no model anywhere. The viewport's texture goes in a
   TextureRect, not a SubViewportContainer (that would set every slot to draw every frame). GDTESTROOM station 5
   checks the slots (one a thing shown, its own world, a mesh in it, the middle one the hand's and live, the others
   once); `tests/lookshot.gd --take=id,id` pictures it: `godot_reference/inventory_live.png`.
   **The look plugin** (2026-10-29, docs/GODOT_LOOK.md): our own pieces of the look live in
   `GodotPlugins/HorrorStudioLook/addons/horrorstudio_look/` and the export copies them in (the user: our plugins in
   a folder that gets passed in, not inside the exported projects): UltraVHS and the puffs moved there; the
   pseudo-realism preset (`game.look`; SSR, SSAO, SSIL, glow, haze, AgX, TAA alone: MSAA switches SSR off in 4.7),
   wet floors, blood, rain (`game.weather`), wet or oiled skin on HumanShaders. LOOKPLUGIN pictures and measures
   each in a demo room; GDTESTROOM checks the yard's rain and wet floor and the chores room's blood.
   **Window panes** (2026-10-29, `LevelWriter.windows`): a quad of glass in every window opening (`__pane_<room>_<i>`,
   `metadata/pane`), plain glass from the export, the rain running down it from the runtime when `game.weather` is
   rain (HSGlass); `HSWet.puddle` a puddle as a Decal for any surface.
   **The cast's stand-ins as their bodies** (2026-10-29, `play.gd` `standin_bodies`): in play a cast member's
   stand-in is their body, a Character Studio export (`game/people/`, HSSkin and HSEye) or the bake's shaped MHR
   body (`game/previs/Body_<cid>.glb`, HSSkin), read by GLTFDocument at run time (the importer's skeleton has other
   bone frames), its feet on the stand-in's floor, turned to face the stand-in's forward, its arms brought down from
   the T-pose (`arms_down`: 52° about the skeleton's z as a global pose, the axis and sign found by trying); the
   capsules hidden under it. It glides on its behaviour's path until the motion sets come (GAMEPLAY_PLAN).
   `tests/lookshot.gd --behave=aoi,path,r_atrium --cast=aoi` sets a cast member going and puts the eye in front of
   them: `godot_reference/look_standin.png`.
   **M_StudioSurface done** (2026-10-29, `LevelWriter.surface`): a room's `look` and a prop's `mat` (`mat:<ref>`
   tags) become world-aligned StandardMaterial3Ds (triplanar in world space, tiled by the set's `tile_m`, albedo,
   roughness, AO, a packed ORM, the normal with a DirectX map's green flipped) with the maps copied into
   `game/textures/<set>/`; a set not on the shelf leaves the block its colour. TestRoom001's lobby, corridor,
   kitchen and power room wear the demo shelf's sets (`tools/pbr.py demo`); GDEXPORT counts the pieces wearing one
   against the export's own count; pictures `godot_reference/look_*_pbr.png`. HSWet samples a world-aligned floor
   by its place, so a wet textured floor keeps its planks.
   **Light Kit's times of day** (2026-10-29): `game.gd`'s `set_time` is the sky rig as nodes, the numbers of
   BLENDER_LOOK §2's table: the sun or the moon (a DirectionalLight3D: 50° up from 135° by day, 6° at dusk, the
   moon at night, their colours), a procedural sky (zenith and horizon per time; night a navy, never black), the
   ambient (the desk's), the windows' fill (W/m² and colour), the haze (fog toward a colour at dusk and night) and
   the grade (saturation 0.8 at night). `tests/lookshot.gd` pictures the game at a spot, a time, a GI, the power and
   the tape; `tools/godot/sheet.py` makes a contact sheet of them: `godot_reference/times_sheet.png` (the lobby's open
   door at day, dusk and night, the power cut, SDFGI, VoxelGI), `gi_sheet.png` (the lighting trial of GODOT_PLAN §4
   in the corridor at night: direct lights only, SDFGI, VoxelGI baked at run time, each with SSAO and SSIL, the
   power cut). **After the trial**: the export writes a VoxelGI per room (its box plus a metre, 64 cells, unbaked);
   the runtime bakes each once when the level loads and keeps the data in `user://gi/<game>/` (28 MB for
   TestRoom001's nineteen rooms), so the bounce is there from the first run; SSAO is on in the main scene's
   environment. Headless runs skip the bake (the dummy renderer).
5. **The rest of §6**: the lives' effects, hiding, reverb, the HUD themes, the pause menu, the little things.
6. **The guide** (GODOT_PLAN §7), grown with each step above (each step adds its page), its pictures by driving Godot.
7. **The re-export** (§5), once there's a project someone has edited.

Each step one commit, checks ok before its push, as always.
