"""The guide every exported Godot project carries (docs/GODOT_PLAN.md §7): guide/index.html, an app to read in the
browser like the desk's guide.html, written from the game's own data by plain Python: the folders and what's in each,
playing it and jumping to any scene, adding an in-between scene, bringing in an animation, replacing a line or a voice
take, moving the cast, the marks and the camera, the lights and the time of day, swapping a texture or a prop, the
shaders' settings, the HUD and its theme, the music and sounds, building for Windows and Linux, and what a re-export
from the desk will and won't touch. Honest about what isn't built yet. Pictures from Saved/Story/<G>/godot_reference/
when there are any (the checks' pictures: a scene, the kitchen's effects, the menu)."""
import html
import json
import shutil
from pathlib import Path

CSS = """
:root{--bg:#121214;--panel:#1b1b1f;--panel2:#232329;--line:#33333b;--text:#e6e3dc;--dim:#9a978f;--accent:#8fb8ff;--warn:#e0a030;--good:#5aa65a;--bad:#e05a4f}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:20px}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
.wrap{display:grid;grid-template-columns:260px minmax(0,1fr);max-width:1240px;margin:0 auto}
nav.toc{position:sticky;top:0;height:100vh;overflow:auto;padding:28px 18px 28px 22px;border-right:1px solid var(--line);font-size:13.5px}
nav.toc .brand{font-weight:700;letter-spacing:.06em;color:var(--accent);font-size:12px;text-transform:uppercase;margin-bottom:14px}
nav.toc ol{list-style:none;margin:0;padding:0;counter-reset:s}nav.toc li{counter-increment:s}
nav.toc li a{display:flex;gap:8px;padding:4px 8px;border-radius:6px;color:var(--text)}
nav.toc li a::before{content:counter(s);color:var(--dim);min-width:18px;text-align:right}
nav.toc li a:hover{background:var(--panel2);text-decoration:none}
main{padding:34px 44px 90px;min-width:0}
header.hero{border-bottom:1px solid var(--line);padding-bottom:22px;margin-bottom:10px}
header.hero h1{font-size:34px;line-height:1.15;margin:0 0 10px}header.hero p{color:var(--dim);font-size:16.5px;margin:0;max-width:760px}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}.chip{font-size:12px;padding:3px 10px;border-radius:99px;border:1px solid var(--line);color:var(--dim);background:var(--panel)}
section{padding-top:30px;max-width:900px}h2{font-size:24px;margin:16px 0 6px;display:flex;align-items:baseline;gap:12px}
h2 .n{color:var(--accent);font-size:15px;font-weight:600}h3{font-size:16.5px;margin:22px 0 4px}p{margin:8px 0}ul,ol{padding-left:22px;margin:8px 0}li{margin:3px 0}
kbd{font:600 12px/1 ui-monospace,Menlo,monospace;background:var(--panel2);border:1px solid var(--line);border-bottom-width:2px;border-radius:5px;padding:2px 6px}
code{font:13px ui-monospace,Menlo,monospace;background:var(--panel);border:1px solid var(--line);border-radius:5px;padding:1px 5px}
pre{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 14px;overflow:auto;font:13px/1.55 ui-monospace,Menlo,monospace}
figure{margin:16px 0 20px;max-width:100%}figure img{display:block;max-width:100%;height:auto;border-radius:10px;border:1px solid var(--line);box-shadow:0 10px 30px rgba(0,0,0,.45)}
figcaption{color:var(--dim);font-size:13px;margin-top:7px}
.tip{border-left:3px solid var(--accent);background:linear-gradient(90deg,rgba(143,184,255,.09),transparent);padding:9px 14px;border-radius:0 10px 10px 0;margin:14px 0}
.notyet{border-left:3px solid var(--warn);background:linear-gradient(90deg,rgba(224,160,48,.09),transparent);padding:9px 14px;border-radius:0 10px 10px 0;margin:14px 0}
.notyet b{color:var(--warn)}
table{border-collapse:collapse;width:100%;font-size:14px;margin:8px 0}td,th{padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top;text-align:left}td:first-child{white-space:nowrap}
"""


def e(s):
    return html.escape(str(s))


def section(sid, n, title, body):
    return f'<section id="{sid}"><h2><span class="n">{n}</span>{e(title)}</h2>{body}</section>'


def fig(pictures, name, caption):
    return f'<figure><img src="pictures/{name}" alt="{e(caption)}"><figcaption>{e(caption)}</figcaption></figure>' if name in pictures else ""


def write_guide(out, game, story, info, pictures_from=None):
    """guide/index.html in the project; `info` the export's facts (levels, arts, bake, bodies, sfx)."""
    out = Path(out)
    gd = out / "guide"
    (gd / "pictures").mkdir(parents=True, exist_ok=True)
    (gd / ".gdignore").write_text("", encoding="utf-8")        # the guide is for a browser: Godot neither imports its pictures nor lists it
    pictures = set()
    if pictures_from and Path(pictures_from).is_dir():
        for p in sorted(Path(pictures_from).glob("*.png")):
            shutil.copy(p, gd / "pictures" / p.name)
            pictures.add(p.name)
    g = story.get("game") or {}
    title = g.get("title") or game
    levels = story.get("levels") or {}
    cast = story.get("cast") or {}
    scenes = story.get("scenes") or {}
    flow = story.get("flow") or {}
    start = g.get("start") or (next(iter(flow)) if flow else "")
    nodes_rows = "".join(f"<tr><td><code>{e(nid)}</code></td><td>{e(n.get('type', ''))}</td><td>{e(n.get('ref', ''))}</td><td>{e((scenes.get(n.get('ref'), {}) or story.get('stitches', {}).get(n.get('ref'), {}) or {}).get('title', ''))}</td></tr>"
                         for nid, n in flow.items())
    cast_rows = "".join(f"<tr><td><code>{e(cid)}</code></td><td>{e(c.get('name', cid))}</td><td>{e(c.get('previs_body', 'capsules'))}</td><td>{'yes' if cid in (info.get('bodies_list') or []) else 'no'}</td></tr>" for cid, c in cast.items())
    level_rows = "".join(f"<tr><td><code>game/levels/{e(lid)}.tscn</code></td><td>{len(lv.get('rooms', []))} rooms</td><td>{', '.join(e(r.get('id')) for r in lv.get('rooms', []))}</td></tr>" for lid, lv in levels.items())

    body = []
    body.append(section("start", 1, "Opening and playing it", f"""
<p>This folder is a complete Godot 4.7 project. Open Godot, <span class="ui">Import</span>, pick <code>project.godot</code>, and press <kbd>F5</kbd>:
the game starts at <code>{e(start)}</code>, the story's own start. Everything in it was written by the director's desk of HorrorStudio
from <code>Content/Games/{e(game)}/story.json</code>; the desk's checks played this same export headless before it was zipped.</p>
<p><b>Jump to any point of the story</b> without playing up to it: run the project with <code>--node=&lt;id&gt;</code> after <code>--</code>
(from a terminal: <code>godot --path . -- --node=n_kitchen</code>; in the editor: Project → Project Settings → Editor → Run → Main Run Args: <code>-- --node=n_kitchen</code>).
The flags and items the stations before it leave are not set then: a scene that needs them plays as if they weren't.</p>
<p><b>The controls:</b> <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> walk, <kbd>Shift</kbd> run, <kbd>C</kbd> crouch, the mouse looks, a click uses what the dot is on,
<kbd>E</kbd> the inventory row, the wheel turns it, <kbd>G</kbd> puts the thing in the hand down, <kbd>Q</kbd> lowers it out of view and raises it, <kbd>F</kbd> the flashlight once you have it, <kbd>Esc</kbd> the pause menu.
In a scene the mouse looks round within the scene's cone; <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> or <kbd>A</kbd>/<kbd>D</kbd> and <kbd>Enter</kbd> answer a choice.</p>
{fig(pictures, 'start_day.png', 'The start, by day (made by Godot at the export: --pictures).')}
{fig(pictures, 'scene_first.png', 'The first scene, three seconds in, played from the desk\'s recording.')}
{fig(pictures, 's_hello_6s.png', 'A scene played from the desk\'s recording: the cast member\'s own body, the camera where the desk put it.')}
<table><tr><th>Node</th><th>Type</th><th>Plays</th><th>Title</th></tr>{nodes_rows}</table>
"""))
    body.append(section("folders", 2, "The folders and what's in each", f"""
<pre>{e(game)}/
  project.godot              Forward+, the game's title, the main scene (the runtime's), GDScript only
  addons/horrorstudio/       THE RUNTIME: game.gd (the story's flow walked), play.gd (walking, using, doors, lights, the
                             inventory, hiding, the little things), scene_player.gd + bakeplay.gd (a scene from the desk's
                             recording), hud.gd + theme.gd + menu.gd (the HUD, its theme, the pause menu), lifefx.gd +
                             puff.gdshader (steam, smoke, LEDs, screens...), physics.gd (the hand, the die), story.gd
                             (the story's data read), conditions/actions/interactables/behaviours/todo/life.gd (the format's
                             words, one each), tests/ (the headless checks)
  HumanShaders/              matmadness's skin and eye shaders (MIT): the characters' look will be built on them
  game/
    story.json               THE GAME: world, cast, scenes, tasks, flow, endings. Text is the truth: change it and play
    lives.json, life_things.json   the little things' lives (a kettle boils, a cigarette burns) and which things have one
    levels/&lt;level&gt;.tscn      a level: every wall, floor, door, light, spot and trigger a node carrying its piece
                             (metadata/piece: the story's own numbers), in folders by kind (Ground, Walls, Ceilings,
                             Doors, Things, Lights, Glass, Triggers, Spots, People, GI); the things' meshes instanced under their blocks
    meshes/kit/, meshes/basemesh/   the kit's things (built from numbers) and the CC0 library's meshes (glb)
    kit.json                 each kit mesh's sockets (where its steam, LED, flame... come from) and slots
    previs/                  THE DESK'S RECORDING of every scene: index.json, scenes/&lt;scene&gt;.json (the camera, every bone,
                             the face, the black and the lights at 30 fps; a file per answer branch), Body_&lt;who&gt;.glb
    sfx/                     the sound shelf (CC0): index.json names every sound
    export.json              what this export was made from
  guide/index.html           this guide
</pre>
<table><tr><th>Level</th><th></th><th>Rooms</th></tr>{level_rows}</table>
<table><tr><th>Cast</th><th>Name</th><th>Body on the desk</th><th>Recorded body here</th></tr>{cast_rows}</table>
<div class="tip"><b>The rule the desk lives by:</b> text is the truth. The story is <code>game/story.json</code>; the runtime reads it at start. A change there
is a change in the game. The levels' <code>.tscn</code> are written from it, so a thing moved in story.json moves in the level at the next export, and a thing moved
in the editor stays moved until then (see <a href="#reexport">what a re-export touches</a>).</div>
"""))
    body.append(section("scene", 3, "Adding an in-between scene or task", """
<p>The story is a graph of <b>nodes</b> (<code>flow</code> in story.json): a <code>scene</code> (the cast act, the player watches, a line can ask a question),
a <code>stitch</code> (the player plays: a task with its beats, or a round like hide and seek), a <code>choice</code> (by what the player did, by karma, a flag
or a count) and an <code>ending</code>. Each has a <code>next</code>. To put a scene between two nodes:</p>
<ol>
<li>Add the scene under <code>scenes</code>: a title, its <code>level</code>, a <code>view</code> (the spot the player's eye stands on), <code>stage</code>
(who stands on which spot), <code>camera.look</code> (who the eye looks at), and its <code>clips</code>: one line each, <code>who</code> and <code>en</code>, a <code>seam</code>
between them (<code>blink</code>, <code>dip</code>, <code>cut</code>), a <code>reply</code> on a line that waits for an answer.</li>
<li>Add a node under <code>flow</code>: <code>{"type": "scene", "ref": "s_new", "next": "n_after"}</code>, and point the node before it at it.</li>
<li>Play it (<code>--node=n_new</code>). Without a recording the scene plays from its data: the eye at the view, the cast on their marks as stand-ins,
each line shown for its length.</li>
</ol>
<p>A task the same way: a <code>stitch</code> with <code>beats</code>, each a <code>when</code> (a trigger: <code>enter</code> a room, <code>use</code> a thing, <code>flag</code>...)
and a <code>do</code> (actions: <code>objective</code>, <code>todo</code>, <code>door</code>, <code>light</code>, <code>sound</code>, <code>think</code>, <code>done</code>...). The format's every
word is listed in <code>docs/STORY_FORMAT.md</code> of HorrorStudio; the runtime's <code>conditions.gd</code> and <code>actions.gd</code> have one case each.</p>
<div class="tip"><b>The better route</b> is the desk: add the scene there (a card on the board, its script typed as "Mari: words"), let it record the scene
with the cast's real bodies, and export again. The recording (<code>game/previs</code>) only exists for scenes the desk baked.</div>
<div class="notyet"><b>Not built yet:</b> scenes as Godot scenes with an AnimationPlayer timeline and tasks as nodes with Inspector resources
(GODOT_EXPORT.md §3). For now the story is data and the runtime plays it; the editor shows the levels, the bodies and the recordings as files.</div>
"""))
    body.append(section("anim", 4, "Bringing in a new animation", """
<p>A scene's motion here is the desk's recording: every bone of each cast member, every frame, in <code>game/previs/scenes/&lt;scene&gt;.json</code>
(<code>skin</code>: a matrix per bone), played onto <code>Body_&lt;who&gt;.glb</code> by <code>bakeplay.gd</code>. So a new animation goes in one of two ways:</p>
<ul>
<li><b>Through the desk</b> (the way the studio works): a Kimodo take or any motion the desk's motion table knows, placed on the scene's body track, then
Generate / export again. The recording is remade from it.</li>
<li><b>Your own Godot scene</b>: import an FBX or glTF with its animation (drop it in <code>game/</code>, Godot imports it), make a scene with its AnimationPlayer,
and play it from a task's beat with the <code>scene</code> action naming a story scene whose <code>level</code> you keep, or call it from your own script. The
runtime's <code>Game.scene_player</code> is the hook: <code>play(sc, nid, sid)</code> takes a story scene; a Godot-made one can be played by a node you add to
<code>main.tscn</code> and called from <code>actions.gd</code>'s <code>trick</code> verb (add a case there).</li>
</ul>
<div class="notyet"><b>Not built yet:</b> the recording turned into Animation tracks on the body's skeleton (bone tracks, blend-shape tracks) that the
editor's timeline shows and lets you edit. The plan is GODOT_EXPORT.md §3; until then the recording is data the runtime plays.</div>
"""))
    body.append(section("lines", 5, "Replacing a line, a voice take, a face", """
<p>A line's words are in its clip: <code>scenes.&lt;scene&gt;.clips[].en</code> (and <code>ja</code> for the Japanese take). Change <code>en</code> and the subtitle changes;
its length (how long the scene holds on it) comes from the take's measured <code>dur</code>, else from the words. A thought (<code>who: "player", think: true</code>)
can type itself out and correct itself (<code>retype</code>) or break off (<code>breaks</code>); the runtime's <code>typing.gd</code> plays that.</p>
<p>The faces: each recorded frame carries the 72 weights of MHR's face shapes per cast member (<code>face</code>), set on the body's blend shapes; they come from the
desk's Expressions tab (a video of a face solved by MediaPipe). A new expression goes in there and the scene is recorded again.</p>
<div class="notyet"><b>Not built yet:</b> the voices. The takes' audio isn't exported (the desk shows subtitles only, so does this); when it is, each clip's
take lands beside its scene's recording as an .ogg and plays on its line.</div>
"""))
    body.append(section("marks", 6, "Moving the cast, the marks and the camera", """
<p><b>Spots</b> are the marks: in the level's <code>.tscn</code> every <code>Marker3D</code> whose piece is a spot (<code>metadata/piece.kind == "spot"</code>), named after the
story's thing. A scene's <code>stage</code> says who stands on which, its <code>view</code> where the player's eye is, <code>camera.look</code> whom it looks at. Move a spot in
story.json (the thing's <code>at</code> in its room, metres from the room's corner, and its <code>rot</code>) and export again, or move the Marker3D in the editor for a
try (the runtime reads the node's position: the scene's stand-ins and the player's eye follow it).</p>
<p><b>The camera</b> in a recorded scene is the recording's: the desk's camera modes (hard, soft, free: how far the player may look round) are kept as the
scene's <code>look</code> cone. To change a shot, change it on the desk (the Camera tab of the clip) and record again. A <b>live</b> scene
(<code>camera.mode: live</code>) has no camera of its own: the eye stays the player's where they stood or sat, they look round (seated, 90° either
side of the seat), standing they walk, and the cast act in the room from the recording.</p>
<p><b>Behaviours</b> (a cast member walks to the sofa and sits, patrols, hides and seeks) are the story's <code>behave</code> cues and tasks; the runtime's
<code>behaviours.gd</code> plays them on the stand-ins between scenes. <b>The stand-ins are the cast's bodies</b>: a Character Studio export
(<code>game/people/&lt;name&gt;.glb</code>, with its skin and eyes) or the bake's shaped body (<code>game/previs/Body_&lt;cast&gt;.glb</code>) on the skin shader, read at
run time, its arms brought down from the bind pose (<code>play.gd</code> <code>ARMS_DOWN</code>); it glides on its path until the motions come. Without either, a figure of
capsules stands in.</p>
{fig(pictures, 'look_standin.png', 'A cast member on her route: her own body as the stand-in.')}
"""))
    body.append(section("lights", 7, "The lights, the time of day, baking", f"""
<p>Every story light is an <code>OmniLight3D</code> in the level with <code>metadata/light</code> (its kind: bulb, lamp, candle...; its room; its flicker; whether
it starts lit). The power cut, the breaker, <code>light</code> actions and the scenes' recorded flicker all drive <code>light_energy</code> at run time, so
these lights must stay dynamic. Windows are <code>SpotLight3D</code>s with <code>metadata/window</code>, set by the time of day.</p>
<p><b>The time of day</b> is the story's: <code>game.time</code> at the start, a scene's own <code>time</code>, a chapter's. <code>game.gd</code>'s <code>set_time</code> sets the
sky's colour, the ambient and the windows from <code>TIME_LOOK</code> (day, dusk, night, as the desk shows them).</p>
<p><b>Baking</b> (for the still lights: the fills, the windows at one time of day): add a <code>LightmapGI</code> node to the level, set the walls' and floors'
<code>MeshInstance3D</code>s to <code>Static</code> global illumination mode (they carry UV2 already: <code>add_uv2</code>), and press <span class="ui">Bake Lightmaps</span>.
Keep the story lights dynamic. A level with more than one lighting state (the power cut) wants one bake per state: GODOT_EXPORT.md §6 lays out the
plan (a LightmapGI per state, swapped by the runtime).</p>
<p><b>What the export bakes:</b> a <code>VoxelGI</code> per room, baked at the game's first load and kept in <code>user://gi/</code> (the lighting trial,
GODOT_PLAN.md §4: it gives the bounce the thin walls need). <code>LightmapGI</code>'s bake is the editor's alone (no script can call it in 4.7), so it stays
yours to press.</p>
{fig(pictures, 'start_night.png', 'The same start at night: the sky, the windows and the ambient from the time of day.')}
"""))
    body.append(section("props", 8, "Swapping a texture or a prop", f"""
<p>A thing in a level is a <code>StaticBody3D</code>: its box (<code>mesh</code>, hidden when the thing has a real mesh; its <code>shape</code> for walking into) and, under it,
<code>art</code>: the kit's mesh or the library's, instanced from <code>game/meshes/</code>. To swap a prop, point <code>art</code> at another glb (the editor: select it,
change its instanced scene), or replace the file in <code>game/meshes/</code>. Keep the box: the cursor and the walls are the boxes. This export has
{info.get('arts', 0)} such meshes.</p>
<p>A room's surfaces take their texture set from the story's <code>look</code> (<code>{{"floor": "pbr/Wood/worn_planks", "walls": ...}}</code>; a prop's
<code>mat</code>; the floor's <code>floor</code> word sets the footsteps too): the set's maps are copied into <code>game/textures/&lt;set&gt;/</code> and worn as a
world-aligned material (triplanar, tiled by the set's metres, so a block's stretched UVs don't matter; a DirectX normal's green flipped for Godot): the
Unreal side's M_StudioSurface. This export wears {info.get('surfaced', 0)} such surfaces from {len(info.get('surface_sets', []))} sets. A room with no
<code>look</code> keeps the exporter's plain colour per kind (wall, floor, trim, prop...). To swap a texture, change the set in the story and export
again, or change the material on the wall's <code>MeshInstance3D</code> (it stays until the next export).</p>
{fig(pictures, 'look_corridor_pbr.png', 'The corridor wearing the shelf\'s planks and plaster, tiled by their real size.')}
{fig(pictures, 'kitchen_kit.png', 'The kitchen: the kit\'s things (a kettle, a hob, a rice cooker, a clock) in their blocks.')}
"""))
    body.append(section("fx", 9, "The little things and their effects", f"""
<p>A kettle that boils by itself, a cup going cold, a cigarette burning down, a phone that rings: each is a kit thing with a <b>life</b>
(<code>game/lives.json</code>: states in order with timers, what the player can do in each, what each state shows). The effects come from the mesh's
<b>sockets</b> (<code>game/kit.json</code>: the spout, the tip, the rings, the screen) and are drawn by <code>lifefx.gd</code>: steam and smoke through
<code>puff.gdshader</code> (its uniforms: the colour, the light's direction, how far a puff fades into a wall, how fast the noise eats it), LEDs, digits, the
hob's glow, flames, the cup filling, the pour, drips, the clock's hands, screens. To tune steam, edit the numbers at the top of <code>puffs_new</code>
(rate, life, size, rise, alpha) or the shader's uniforms.</p>
{fig(pictures, 'kitchen_fx_kettle.png', 'The kettle boiling: its steam at the spout, the hob\'s ring glowing under the pot.')}
{fig(pictures, 'kitchen_fx_table.png', 'The cup filled and steaming, the cigarette burning in the ashtray, the phone\'s call, the TV\'s static.')}
"""))
    body.append(section("look", 10, "The look: the realism preset, rain, wet floors, mirrors, blood, wet skin", f"""
<p>The look comes from the studio's own plugin, <code>addons/horrorstudio_look/</code> (its README says how to use each part in any Godot project):
<b>game.look</b> in story.json names the preset <code>HSLook</code> applies at the start, <b>{e(g.get('look', 'realism'))}</b> here: <code>realism</code> is screen-space
reflections, ambient occlusion and indirect light, a little glow, a thin haze, AgX and temporal anti-aliasing (TAA alone: MSAA switches the reflections off in 4.7);
<code>plain</code> turns it all off. The pause menu's Anti-aliasing row picks Off, FXAA, TAA or TSR over it. <b>In the editor</b> a level scene shows none of
this (the game applies it at start): enable the plugin (Project → Project Settings → Plugins → HorrorStudio Look) and add an <code>HSLookEnvironment</code> node to the
level scene to edit under the look; it steps aside when the game runs. The tape (<code>game.vhs</code>: camcorder, camhybrid, worn, nightmare) shows only in play; <code>camhybrid</code> is the camcorder with half the fisheye
and its blur only with distance (what's close stays almost sharp).</p>
<p><b>game.weather</b> <code>rain</code> (this game: <b>{e(g.get('weather', 'clear'))}</b>) puts rain in every room with no <code>ceiling</code> (<code>HSRain</code>, a box of
streaks moved by the vertex shader, splashes where they land) and wets its floor (<code>HSWet</code>: the damp, pools that carry the lights, the rain's rings on them), with the shelf's rain heard there.
Every kit <code>mirror</code> reflects the room for real (<code>HSMirror</code>: the camera reflected through the glass into a viewport of its own while the mirror is in view).
A <code>clean</code> stain of kind <code>blood</code> wears <code>HSBlood</code>'s splat (a ragged pool, flung drops, glossy, fading as it's scrubbed). <code>HSSkin</code> is
HumanShaders' skin shader with a wetness layer (a sweat film, beads, drips, oil) for the characters: the story's <code>skin</code> action
(<code>{{"skin": "aoi", "wet": 0.7, "sweat": 0.5}}</code> in a beat or a cue) puts it on a cast member's bodies and keeps it till set again. To change a number, edit the preset in <code>look.gd</code> or the
shader's uniforms; to check it, the plugin's demo (<code>demo/demo.gd</code>) pictures and measures each part.</p>
{fig(pictures, 'look_yard_rain.png', 'The yard in the rain: the streaks, the floor wet with pools carrying the sky.')}
{fig(pictures, 'look_chores_blood.png', 'A blood stain: a glossy pool with flung drops, scrubbed away by the chore.')}
{fig(pictures, 'look_bath_mirror.png', 'The bath\'s mirror: the room behind the player reflected for real, by a second camera.')}
"""))
    body.append(section("hud", 11, "The HUD, its theme, the pause menu", f"""
<p>The HUD is built by <code>hud.gd</code> (the objective and the to-do list top left, the line and the choices at the bottom, the cursor's dot and prompt,
the inventory row (the things themselves, each shown slot a small viewport of its own world with a copy of the thing's mesh fitted into it, the one in the hand turning; nothing drawn for the rest), the chapter card, the fade). Its colours, surfaces and radii come from the theme: <code>game.ui_theme</code> in story.json names
one of <code>glass</code> (the default), <code>glass-rose</code>, <code>neumorph</code>, <code>plain</code>; <code>theme.gd</code> turns it into a Godot Theme. Add a theme by adding
an entry to its <code>THEMES</code>. This game wears <b>{e(g.get('ui_theme', 'glass'))}</b>.</p>
{fig(pictures, 'inventory_live.png', 'The inventory row: the things themselves, the one in the hand in the middle, turning.')}
<p>The pause menu (<kbd>Esc</kbd>, <code>menu.gd</code>): the controls, Resume, Save game (three slots and the autosave, in <code>user://saves_{e(game)}.json</code>),
Settings (Display, Graphics, Audio; stepped with <kbd>A</kbd>/<kbd>D</kbd>; each row names the Godot setting it maps to; the ones Godot can apply, it applies:
the Graphics rows pare the look's preset back on a slower machine: Reflections Low turns the screen-space reflections and the mirrors off (Medium: half the steps, half-size mirrors), Post-processing Low the glow,
SSAO and SSIL, Effects Low the haze; Anti-aliasing picks Off, FXAA, TAA or TSR; Resolution scale the 3D scale),
Quit. Settings live in <code>user://horrorstudio_settings.json</code>.</p>
{fig(pictures, 'menu_root.png', 'The pause menu: the controls on the left, the pages on the right.')}
"""))
    body.append(section("sound", 12, "The music and the sounds", """
<p><b>The sound shelf</b> is in <code>game/sfx/</code> (240 CC0 effects; <code>index.json</code> names each with its tags and length). A story sound names one with
<code>file: "sfx/&lt;name&gt;"</code>; the runtime's <code>play_sfx</code> plays it placed in the room (an <code>AudioStreamPlayer3D</code> at the thing or the cast member) or on
the player. The footsteps pick by the room's floor, the knocks, the slams and the latch by name. Add your own sound: drop the file in
<code>game/sfx/&lt;category&gt;/</code>, add it to <code>index.json</code>, name it in story.json.</p>
<p><b>The little things' sounds</b> (<code>lifesound.gd</code>) are made from their recipes at run time, no files: the kettle's rumble rising to the boil's roar, the hob's hum,
the clock's tick, the tap, the phone's ring, the switch, the beep, the rice cooker's tune; each rendered once into a short loop and played where the thing is,
its level following the state's age. To change one, edit its recipe in <code>render()</code>; to replace it with a recording, put the wave in <code>wavs</code> under its name.</p>
<div class="notyet"><b>Not built yet:</b> the music (the score room's cues, rendered to .ogg and played by the scenes' moods). Audio buses named Music, SFX and Voice
make the menu's volumes work per kind: add them in Project → Audio Buses.</div>
"""))
    body.append(section("build", 13, "Building for Windows and Linux", """
<ol>
<li>Editor → <span class="ui">Manage Export Templates</span>: download the templates for this Godot version once.</li>
<li>Project → <span class="ui">Export</span>: add a preset <b>Linux</b> (x86_64) and one <b>Windows Desktop</b>. Leave <span class="ui">Export With Debug</span> off for a release.</li>
<li><span class="ui">Export Project</span> to <code>build/</code>. Or from a terminal, once the presets exist:
<pre>godot --headless --export-release "Linux" build/game.x86_64
godot --headless --export-release "Windows Desktop" build/game.exe</pre></li>
</ol>
<p>Everything the game needs is inside the project (the story, the recordings, the meshes, the sounds), so a build carries it all. The checks this
project passed before it was zipped can be run again headless: <code>godot --headless --path . -s res://addons/horrorstudio/tests/load_check.gd</code>
(every level loads, the story reads, the start is reached).</p>
"""))
    body.append(section("reexport", 14, "What a re-export from the desk touches", """
<p>The desk writes this whole project again on every export: <code>project.godot</code>, the add-ons, <code>HumanShaders/</code>, everything under
<code>game/</code>, and this guide. <b>It keeps a receipt</b> (<code>.desk/manifest.json</code>: the hash of every file it wrote), so a re-export into this folder can tell
what you changed: a written file you edited is <b>kept as yours</b>, with the desk's new version beside it as <code>&lt;name&gt;.desk.&lt;ext&gt;</code> (look at it, take what you
want, delete it); a file you left alone is overwritten; files you added anywhere are never touched. The export's panel on the desk and <code>game/export.json</code>
(<code>kept</code>) list what was kept. Keep your own work in files of your own where you can: your scenes in <code>custom/</code>, your scripts extending the runtime's
rather than editing them, your materials as <code>.tres</code> in <code>custom/</code>.</p>
<div class="notyet"><b>Not yet:</b> nodes you add inside a generated scene lifted out and put back into the new file; today a scene you changed is kept whole.</div>
"""))
    toc = "".join(f'<li><a href="#{sid}">{e(t)}</a></li>' for sid, t in [("start", "Opening and playing it"), ("folders", "The folders"), ("scene", "An in-between scene"), ("anim", "A new animation"),
                                                                       ("lines", "Lines, takes, faces"), ("marks", "Cast, marks, camera"), ("lights", "Lights and time of day"), ("props", "Textures and props"),
                                                                       ("fx", "The little things"), ("hud", "HUD, theme, menu"), ("sound", "Music and sounds"), ("build", "Building"), ("reexport", "Re-exporting")])
    chips = "".join(f'<span class="chip">{e(c)}</span>' for c in [f"Godot {info.get('godot', '4.7')}", f"{len(levels)} levels", f"{len(scenes)} scenes", f"{len(flow)} nodes", f"{len(cast)} cast",
                                                                 "recorded scenes" if info.get("bake") else "no recording yet", f"exported {info.get('made', '')}"])
    page = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)} · Godot project guide</title><style>{CSS}</style></head><body><div class="wrap">
<nav class="toc"><div class="brand">HorrorStudio · Godot</div><ol>{toc}</ol></nav>
<main><header class="hero"><h1>{e(title)}: the Godot project</h1>
<p>How this project is laid out and how to change anything in it in Godot, step by step: playing and jumping to a scene, adding one, bringing in
animations, moving the cast and the camera, the lights, the textures and props, the effects, the HUD and menu, the sounds, building, and what the
next export from the director's desk will and won't touch.</p><div class="chips">{chips}</div></header>
{''.join(body)}
</main></div></body></html>"""
    (gd / "index.html").write_text(page, encoding="utf-8")
    return gd / "index.html"
