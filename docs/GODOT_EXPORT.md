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
- `.desk/manifest.json` holds the hash of every file the exporter wrote. On a re-export a file whose content still
  matches its last hash is overwritten; one the user changed is **kept**, the new version written beside it as
  `<name>.desk.tscn`, and the export's report lists them (the desk shows it, as its merge toast does).
- Inside a generated scene, nodes the user adds go in the group **`hand`** (or under a `Hand` node): the exporter
  reads the old file, lifts those nodes out and puts them back into the new one. Files the user adds anywhere are
  never touched; `custom/` folders are theirs by convention.
- The runtime add-on is versioned; a re-export updates it only when its version is newer and it's unchanged.

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
4. **The look** (GODOT_PLAN §6): UltraVHS and Light Kit as shaders and nodes, measured; M_StudioSurface; the
   characters' shaders on HumanShaders (§2 of the plan) with the Studio's colours and patterns checked side by side.
5. **The rest of §6**: the lives' effects, hiding, reverb, the HUD themes, the pause menu, the little things.
6. **The guide** (GODOT_PLAN §7), grown with each step above (each step adds its page), its pictures by driving Godot.
7. **The re-export** (§5), once there's a project someone has edited.

Each step one commit, checks ok before its push, as always.
