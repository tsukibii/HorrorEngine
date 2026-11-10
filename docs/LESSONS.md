# Lessons

What each bug that took more than one try taught us: the rule, then the story in a line. Add one before pushing
the fix.

## The laptop in Godot (HSLaptop, HSTerminal): what took a second try (2026-11-10)

- **`set_anchors_preset` keeps a control's size; `set_anchors_and_offsets_preset` fills**: in Godot 4 the first moves
  the anchors and recomputes the offsets so the rect stays as it is. The terminal's root, its background and its
  margins were set full-rect after they were made and stayed 0 by 0: the SubViewport's grey clear colour showed through
  the screen and the status line sat under the header. Use `set_anchors_and_offsets_preset` for a control that must
  fill its parent (and give a Control under a SubViewport its size).
- **Headless Godot keeps no mouse mode and draws nothing**: `Input.mouse_mode` stays VISIBLE whatever's set, and a
  VisibleOnScreenNotifier3D never says it's on screen. A check reads them only with a window; whether a thing can be
  seen is decided by the camera's frustum (`is_position_in_frustum`), which is plain maths, and counted (`idle_draws`)
  rather than read off a viewport's update mode between frames (a one-shot draw is back to DISABLED by the next frame).
- **A script set on a node already in the tree never runs its `_ready`**: the $20 note got pickup.gd after `add_child`
  and made no collider, so E passed through it. Set the script before the node goes in.
- **`:=` needs a typed value**: `SOUNDS + nm` with `nm` from an untyped array, `term._label()` through a Node-typed
  variable and `max()` all give a Variant, and Godot refused to parse the script. Type the variable (`var p: String`) or
  use the typed function (`maxi`).

## The laptop and mouse (the `computer` family): what took a second try (2026-11-10)

- **A material painted only by texel must mark what it painted as used**: the mouse's body came out black in every map
  (its albedo's mean exactly 0). A material with no island leaves the canvas's `used` empty, and the bleed then treats
  every texel as a gap to fill. A family's `texel_paint` sets `cv.used |= hit` first, as the double barrel's does.
- **Which way a model faces is in its own UVs, not its shape**: the mouse's long gentle slope looked like its front and
  it was turned round, which put its wheel behind the hump. Its UVs put that end at the top of its product shot (the
  front), and its one narrow block standing up between the buttons (the wheel) said the same. Read where a model's own
  texture puts its front before turning it.
- **A socket's name must not end in one of Godot's import hints**: the mouse's `socket_wheel` came into Godot as a
  VehicleWheel3D (a node named `-wheel` or `_wheel` is one; so are `_col`, `_colonly`, `_occ`, `_rigid`, `_vehicle`,
  `_navmesh`, `_noimp`). It's `socket_scroll` now; name sockets so their last word isn't a hint.
- **A model's file can carry pictures that aren't ours**: the user's FBX packed a keyboard photo and a mouse maker's
  product shot. Keep a model in the repo with its images taken out (the meshes, names and transforms as they were) and
  paint its surfaces here.

## The ichor alive (HSOoze): what took a second try (2026-11-10)

- **The normal-roughness buffer is filled only for some materials**: a box with no material of its own read as no normal
  at all (0.5, 0.5, 0.5) where MHR's material had one, and the ooze threw her wound away as "facing away". Take a
  projected surface's normal from the depth buffer (each way the neighbour nearer in depth, so it never reaches across
  an edge); under Vulkan `cross(dFdx, dFdy)` points away from the eye (its screen y runs down): flip it.
- **A flat black film shows a flashlight beside the eye nowhere**: the light reflects only off parts leaning about 25°
  toward it, and a meniscus a few millimetres wide is under a pixel at 3 m. Give every blob a dome across all of it and
  let it mirror the room in its rounded edges (the screen copy by Fresnel): then it reads as liquid against a lit wall.
  In a dark corridor that's not enough: at roughness 0.2 a black liquid's flat middle gives the flashlight back a third
  of the wall's light, a dull stencil. Wet black reads by sharp glints: roughness 0.08 and ripples a little under a
  millimetre deep, so small glints catch the light and crawl as its surface moves (rough chrome on the same field lit
  like Godot's own chrome square: the lighting was never the fault).
- **A big field looked at three times a pixel compiles for minutes on the CPU renderer**: four shapes' loops inlined
  three times (the slope by differences) never got a frame out under lavapipe. Look once a pixel, take the slope from
  the neighbouring pixels (`dFdxFine`, before any discard), and make each kind a shader of its own.
- **Awaiting frames inside a SceneTree script's `_initialize` hung a probe**: with the look's WorldEnvironment in it,
  the debug probe never drew a frame (twice, ten minutes); the same work in a deferred function ran in 14 s. Start the
  frames' work with `call_deferred`.
- **A projected mark is a mesh too**: her wound oozes (MeshInstance3Ds under her) were charred and crumbled with her
  body, and a stand-in's "tilt" read a wound's own turn. Leave the plugin's own marks out of anything that walks her
  meshes.

## Someone shot (HSHitReact): what took a second try (2026-11-10)

- **Smoke that rides a body draws a line when the body is thrown**: the wound's smoke (the muzzle's trail, which leaves a
  point every centimetre the source moves) rode her bone, and a stagger shoved her 0.4 m in a fifth of a second: every
  wound drew a straight stroke through the air, and with the ember glow on its young smoke the strokes read as red paint.
  Start smoke that rides something after its shove has settled, and keep a glow in young smoke to a hint.
- **A transparent mesh and a blended overlay on it draw in no fixed order**: fading her out (`transparency`) under the
  char overlay showed her white skin over the char half the time. Don't fade a mesh under an overlay: once the overlay
  covers it, swap its surfaces for an opaque, cut-out material and cut it away.
- **A node's own timing runs on the game's clock**: the stagger held her by `Time.get_ticks_msec()`, and headless at a
  fixed rate (frames racing the wall clock) it held her three times too long. Seconds in a node are its frames' delta
  summed; the wall clock is only for waiting on a thread.
- **Unnamed loops in a long test share its scope**: `for m in ...` clashed with a `var m` a thousand lines up in the same
  function. Prefix a new section's names (`r_`), loop variables too.

## A level's floor has one side: HSBlowUp's pieces under it (2026-11-10)

- **A level's floor is a one-sided mesh, and a fast piece can end up under it**: a mug's shard thrown down at the floor
  by a shot from above sank 5 cm in two steps, continuous collision on and a 6 cm collider, and with its middle under
  the surface nothing pushed it out: it fell out of the world, about one run in five. A piece starting on a floor keeps
  none of its fall into it (the floor takes it at once), and a piece whose middle slips under a floor it fell onto is
  put back on top (`_unsink`: a ray from 15 cm above its middle).

## Things that break when shot (HSBlowUp): what took a second try (2026-11-09)

- **A sealed shell is not a solid**: the kettle is modelled as one closed surface, so filling every cut made its
  pieces look like chunks of a solid black block. Whether a cut is filled is the material's (`hollow`: metal, card,
  glass, plastic are thin walls), not the mesh's being closed.
- **A thin piece can have no thin side by its normals**: a mug's wall has an outside and an inside, their normals
  cancel, and its shards got no thickened collider and sank through the floor. Thicken along the points' own principal
  axes (PCA), every axis.
- **Even 5 cm sinks**: a rigid piece with a 5 to 7 cm collider landing at 4 m/s sank through the hotel's trimesh floor
  (Jolt's slop, a floor with no thickness). Pieces under 4.5 cm fall by rays; rigid colliders are at least 6 cm.
- **A ray that starts under a floor never meets it**: a crumpled piece's corners pushed below the floor put a little
  piece's rays under it, and it fell for ever. Lift it onto what's under it first.
- **A blast looks for a collider's shape nodes' middle**: a hull built round an object but left at its base sat on the
  floor, and the floor hid the object from every blast. Centre the shape node on the thing.
- **Headless at a fixed rate, frames race the clock**: "15 seconds" of frames passed in under a second of wall time, so
  a worker thread's cut wasn't ready by then. Wait for a thread by `Time.get_ticks_msec()`.
- **A low-priority WorkerThreadPool task waits behind the game's own**: the cut ran only when the shot waited for it.
  A task that must be ready goes high-priority.
- **Pieces settle, the engine doesn't say so**: light pieces resting a centimetre sunk jitter and never sleep. At rest
  is "gone nowhere for half a second", then frozen and laid onto the floor by their real vertices.

## A muzzle's smoke trail that reads as smoke (2026-11-09, after the last)

- **A camera-facing strip folds in a tight curl**: the trail's first rebuild kept one strip a strand and drifted its
  points in curl noise. It curled, but where it turned sharply it folded over itself into bright creased facets, worst
  at a still barrel where the points bunch. Soft sprites close along the smoothed curve, each stretched along it and
  turned to the eye, can't fold. Use a strip for a gentle line, sprites for anything that curls.
- **Overlapping sprites must agree on their noise, and erode the noise, not themselves**: eroding each sprite's own
  body by the noise left every sprite's core standing, so the strands came out beaded like rope. A random noise seed
  per sprite averaged several noises where they overlapped into flat cotton. One noise read in the world, the same for
  every sprite on a spot, eroded by itself, with each sprite's body only its soft footprint, reads as one wisp
  (`smoke_noise.gdshaderinc`, shared with the puffs, which looked like sand beside it for the same reason).
- **Fractal value noise sits near its middle**: four octaves averaged leave little contrast, so an erosion threshold
  either kept everything or nothing. Stretch its contrast (about twice round 0.5) before eroding it.
- **`INSTANCE_CUSTOM` is the vertex function's only**: the puff shader failed to compile reading the particle's phase
  in `fragment()`. Pass it through a varying.
- **`| head` on a running Godot kills it**: a probe's output piped to `head -10` closed the pipe after ten lines (the
  ALSA warnings), Godot died on its next print, and only three of five pictures came out. Write the output to a file
  and grep that.

## The double barrel alone and what a 12-gauge leaves on a wall (2026-11-09, last)

- **A check that passes on the dice hides a bug**: the merged test's first green run had both flicked hulls this side
  of the wall at the player's right; the next, with other random flicks, had one 21 cm inside room 301. A hull lying
  on the floor rolled with no check at all (the rolling branch moved it by its speed, nothing more), and while
  falling it was a single point, which slipped through the 2 to 3 cm the exported door leaf's collider stops short of
  its jamb. A hull moves by three rays now (its base's end, its middle, its mouth's end: `HULL_POINTS`, `_hull_hit`),
  rolling or falling, and the hand-off from the gun's frame checks all three. When a check's subject is random, probe
  it over many seeds (`hull_probe.gd` in the scratch project: six seeds at three places) before trusting a pass.
- **A pattern spread from the eye is a pattern from a metre behind the muzzle**: the double's muzzles are 0.98 m ahead
  of the eye, so pellets fanned from the camera landed 40% wider than a real gun's at room range (10 cm across at 2.5 m
  from the muzzle; the sources say 5 to 8). The cone's apex is the muzzle's point on the view's line now: the shot
  still goes where you look, the pattern's size is the muzzle's distance's, and a wall nearer than the muzzle takes the
  whole charge where the line meets it. Simulate a spread's law (numpy, thousands of shots) before setting a check's
  bounds: they hold for any seed, and the seeded run shows the typical case.
- **Added smoke sums to white, and premultiplied smoke only helps if what it converges to is under white**: the left
  barrel's flash, a quarter second after the right's, was a white ball. Ten puffs from the first shot, each lit by the
  second flash a few centimetres away, added up past white. Drawn premultiplied (`blend_premul_alpha`,
  `PREMUL_ALPHA_FACTOR` the cover, `ALPHA` the cover times `occlude`), a stack converges to its own lit colour instead
  of summing. That alone changed little, because each puff was lit to about 1.7 before blending, so it converged to
  white too. With the near light capped at 0.5 (`smoke_light_cap`) the cloud converges to a glow and the second star
  reads through it. Look at a value's ceiling as well as how it adds up.
- **A script's `loaded` has to reach the double's chambers**: the double read `loaded` once in `_ready` (into `live`),
  so the checks' `gun.set("loaded", 2)` did nothing, where the pump's tube healed to it. The double's chambers follow
  `loaded` whenever it isn't busy (`_load_to`); a member a script is told it can set is honoured at any time.

## The muzzle flash, the shell kinds and what a shot leaves (2026-11-09, latest)

- **Smoke a few centimetres from a light glows as a ball the size of the room**: the first flashes were a white blob
  filling the view. With the smoke off the flash's wings were a neat star; with the light off too; both on, the blob.
  The puffs sat 2 to 5 cm from the flash's OmniLight3D, and a point light's falloff makes that a thousand times a lamp
  across the room: even a puff faded almost to nothing glowed, and the bloom spread it. Delaying the puffs until the
  light was out fixed one shot, not the next, which lit the first shot's smoke still hanging there. The fix is in the
  smoke's own shading: `smoke_light.gdshaderinc` caps the light any one source gives it (`light_cap`), so a light
  beside it lights it as a bright lamp would and no more. Every layer is spoken for (the zones 2 to 10, the mirrors 11
  to 20), so a light-cull layer for smoke wasn't free. The old flash had the same ball in its picture: the flash's
  light lit the corridor's haze at full strength; it lights the haze a tenth now (`light_fog`).
- **The burn's order matters**: the user's "blend a noise texture by the facing, the blend a burn" is burn(noise,
  facing) = 1 - (1 - noise) / facing, the noise as the base. The first try had it the other way round (the facing
  burnt by the noise): a flat white middle and holes wherever the noise dipped. The right way, the middle shows the
  noise (white-yellow where it's bright, orange where it isn't) and the rim burns away along it. Read a blend mode's
  base and blend layers off the words before writing it.
- **A plugin's textures come in without mipmaps**: the install copies no `.import` files, so a project imports the
  flash's noise with mipmaps off, and minified on a sphere 40 pixels wide it aliased into grit. `HSMuzzle.tex()`
  builds the mipmaps itself when a texture has none (from the imported image, so it works in an exported game).
- **A headless renderer keeps no MultiMesh**: the check read the flash's spheres back with get_instance_transform and
  got nothing (the dummy renderer stores no instances), so every sphere looked like a run of its own at the origin.
  The muzzle keeps its layout on the script's side (`sphere_list()`); anything a check reads back is kept so.
- **A ribbon of points tears when neighbours drift apart**: the smoke trail's points each had a random drift, so two
  points a few millimetres apart drifted centimetres apart and the strip zig-zagged into slivers and twisted. The drift
  is now a function of when each point was left (neighbours drift alike), points are left by distance or time (not
  every frame), the tangent spans two points each way, and the side is never flipped between neighbours.
- **A JSON round trip reformats a hand-kept file**: adding three recipes by json.load and json.dump rewrote all 8000
  lines of presets.json in another layout. Insert into a hand-formatted file as text and check `git diff --stat`.
- **A local can hide a member**: `var tube := ...` (the tube's height, a float) in `_insert_one` hid the new `tube`
  array (the shells' kinds) and the whole script failed to parse. Name a new member after a grep for the word.

## Cartridges and the customizer's guide (2026-11-09, later still)

- **The wear's edges and dirt need a mesh dense enough for its curvature**: a card box made of flat panels (a vertex at
  each corner, nothing between) came out speckled all over, white and black: the curvature is reckoned per vertex and
  spread over each face from its corners, so every face read as an edge and a crease, and the noise did the rest. A
  flat-panelled thing turns them off (a material's own `wear`: `edges` 0, `dirt` 0) and paints its worn edges by each
  texel's distance from its face's edges (ammo.py `_worn_edges`).
- **A part's `built` is the state its mesh is in, not a wish**: the two open boxes rendered shut, because the lid was
  built shut and only said `built=105`. A part made open is built turned (about its pivot, its axis, by `built`); the
  set-down turns it back to `shut` to measure the box.
- **A drop on one of a prop's own pictures takes its place**: the guide's price sticker, dropped at a spot inside the
  lid's gauge disc's box, replaced the disc instead of being placed. Drop clear of the dashed boxes (or hold Alt).
- **The weapons check's project carries a copy of the plugin**: a picture taken there after editing `pickup.gd` showed
  the old pickup. `weapons_check.py --reuse` installs the plugin again first; a hand-run script there needs the copy
  refreshed.
- **A slot turned a quarter wants its picture turned too**: the shell's print runs along its hull (`rot` 90), so the
  size it wants is the box's turned (192 x 64, not 64 x 192) and its template is drawn upright (sizes.py, picedit.js
  `quarters`): painted over and dropped back, it goes in as it was.

## The double barrel: the user's model, worn (2026-11-09, later)

- **A check timed by the wall clock passes nothing under `--fixed-fps`**: the double's reload measured 0.06 s, because a
  headless run at a fixed 60 fps steps the game faster than real time. Time a run in the game's own frames (count them,
  divide by 60), as the other checks wait (`frames`, `until`).
- **Blender's Workbench engine wants EGL**: rendering an .fbx to look at it headless failed ("Couldn't open
  libEGL.so.1"); Cycles on the CPU renders the same thing (12 to 48 samples for a look).
- **An imported model's objects move with their parents**: the user's .fbx has the barrels, the lever and the triggers
  under the stock's object; putting one object's mesh into place and clearing its transform moves the children with
  it. Read every object's world matrix first, then transform every mesh, then clear the parents.
- **The wear on a texture finer than the made props' looks like frost**: a smart unwrap gave the steel about twice the
  pump gun's texels a millimetre, and the same scratches (0.35) came out as fine white lace all over the bluing; a
  little (0.1) reads as use. The thin parts (a lever, a trigger) are all edge to the curvature, so their edges' wear
  covers them: half of it there.
- **Rings as thin dark lines read as plywood**: the stock's first walnut was evenly spaced dark lines on a light ground;
  the furniture's own recipe (rings 5 mm apart that wander nine millimetres, fibres, a slow tone, the late wood a band)
  reads as a board. Paint wood in the solid with `wood_color`'s numbers.

## The shotgun: things that took a second try (2026-11-09)

- **A tiny rigid body sinks through a level's floor**: a spent hull (a cylinder 1 cm in radius) bounced once on the
  hotel's floor and then sank through it and fell for ever. The floor is a trimesh with no thickness, and the physics
  engine lets bodies sink 2 cm into what they rest on (Jolt's penetration slop): a body thinner than that passes the
  surface's middle and the contact turns round. Small debris falls by rays of its own (the weapon's `_falling`); a
  RigidBody3D only for things thicker than about 5 cm.
- **A node property written as `node_paths` in a .tscn needs a Node-typed export**: the shotgun's `light` was an
  `@export var light: NodePath` and the check's scene wrote it the way Godot writes a node reference
  (`node_paths=PackedStringArray("light")`): it came through empty and the flashlight was never carried. Export the
  node's type (`@export var light: Light3D`): the Inspector gets a node picker too.
- **A made prop's `propgen_part` extras arrive in Godot as JSON text**, not a Dictionary: parse it (`JSON.parse_string`)
  before reading `name`, `axis`, `open` (the shotgun's pump, bolt and trigger were never found until then; the runtime's
  `parts.gd` already did).
- **Smoke drawn with alpha blending darkens a dim room**: the muzzle's smoke was a dark cloud over the corridor at night
  (lit by the room's low light, it was darker than the wall behind it). Smoke scatters light: draw it additive and lit,
  so it shows where light reaches it and never darkens what's behind it. Found by rendering the same frame with one
  thing off at a time (the smoke, the fog, the flash's shadow, its light).
- **A Godot script's `--out` path is read from the project's folder**: `godot --path P -s s.gd -- --out=shots` saved
  nowhere useful; pass an absolute path.
- **presets.json is appended to as text, never rewritten by `json.dumps`**: dumping it whole re-indented 7,000 lines.
- **Hiding a character is `visible = false` (and `hs_hidden`), never PROCESS_MODE_DISABLED**: HSShootable's "gone"
  first disabled her, which froze every script under her (a chase under way never ended, its music for good) and left a
  CSG collider solid; the starter's hunters already stand down when she isn't visible or carries `hs_hidden`. Gone now
  hides her, takes her colliders' layers (and CSG's use_collision) away and marks her; back, puts them as they were.
  And what's hidden isn't shot: a pellet goes through a body that isn't visible (her collider is there before she is).
- **A light put out for good is marked so**: the Look plugin's light zones and the starter's lights turn a light on by
  its `hs_lit` meta, so a lamp shot out (visible false only) lit again when its room came back into view. `hs_lit`
  false, its energy 0.
- **A spring stepped by the frame's dt flies apart on a hitch**: the gun's kick and sway springs (stiffness 120 and 160)
  blew up past about 0.09 s; a 0.3 s frame after the first shot would have thrown the gun round. Stepped in 12 ms
  substeps now; the check gives it a 0.3 s frame.
- **A script that moves a node another script shakes keeps the shake**: carrying the flashlight, the gun set its
  rotation outright every frame and the Fear node's tremor never showed; it keeps flashlight.gd's offset from `_rot0`
  now, and leaves the light alone when it isn't carrying it. (The check holds the Fear node still: it sets the tremor
  from its level every frame.)
- **ffmpeg's Ogg muxer gives every file a random stream serial**: the weapon's sounds made again from the same seeds came
  out as seven changed files. `-fflags +bitexact -flags:a +bitexact` makes a run's bytes the same as the last's.
- **The tape's `camhybrid` preset pillarboxes the frame**: a view model at the bottom right is cut off; picture a view
  model with the tape off.

## The retro pack: pictures read inside Blender, and a mask read upside down (2026-11-08)

- **An image read inside Blender is tagged Non-Color before its pixels are touched**: Blender hands back an 8-bit
  PNG's own values from `Image.pixels`, but decodes a 16-bit PNG into a float buffer and, the image being tagged sRGB
  by default, converts it to linear on the way. Every ambientCG normal map on the shelf (NormalGL, NormalDX) is 16-bit,
  so `paint.read_image` had been giving every set's normal map as 0.5 -> 0.21: each texel's normal tilted about 37
  degrees the same way, everywhere a family laid a shelf set (the trees' bark and leaves read 40 to 45 degrees of mean
  tilt in the quality bar), and Blender 5.1's 16-bit exports (the retro pack's textures) came back at half their
  lightness: a road went near black. Found by the retro road's normal map being one flat light blue, and its colour
  measured 0.31 outside Blender and 0.14 inside; `read_image` and `quality.decode` now set Non-Color first (8-bit
  values unchanged).
- **glTF's v runs down the image**: a texel's row is v x height, not (1 - v) x height. The quality measures first
  flipped it and judged a bag's colours over the wrong texels (its unused corner counted, a darkening that wasn't
  there).
- **Relief from a picture's colours follows its features, not its pixels**: a 256-pixel texture upscaled four times
  gave the high-pass four-texel steps, and the normal map came out in tiles; the filters are at least one source
  texel wide now, the source's edges softened by half of one first.

## A beam in the fog and dust in the light (2026-11-08)

- **`VIEWPORT_SIZE` is 0 in a spatial shader's `vertex()`** (Godot 4.7, Forward+, a particle's draw pass): pass the
  picture's size as a uniform. The motes' "never under 2 px" read it there, so every mote grew 20,000-fold into a
  full-screen quad dimmed to nothing: 6.3 s a frame on lavapipe and not one mote seen. Timing each piece on its own
  found it (the standard material 47 ms a frame, ours 6258). A growth gets a cap too (6).
- **A cone hull from SurfaceTool drew nothing; Godot's CylinderMesh did.** Its winding faced the other way for
  `cull_front`. Use a primitive mesh, whose faces are known, and a debug colour for "the hull is drawn here" before
  judging the shader.
- **The softness of a beam in Godot's froxel fog is the light's own profile, not the grid.** 128 froxels without the
  filter cost 9.5 times as much for an edge 2 px sharper. A hard-edged spot narrowed it more, and a beam of its own
  with a cookie made it a beam.
- **`pow` of a negative is NaN, and NaN draws black.** On the beam's axis, the cone's cosine rounded a hair over 1, the
  rim went negative, and `pow(rim, attenuation)` left black dots along the beam; and a mote with the light straight
  behind it had no half vector (`normalize(0)`). Clamp before `pow`, guard a normalize that can meet zero.
- **A picture's difference counts every jittered pixel.** The motes were measured as lit pixels with dust on against
  off; with any haze, the beam's per-frame jitter counted too (239 "motes" that were the beam). Measure a thing alone
  (the motes in clear air), or against a frame that has everything else.
- **An eased value can't also carry direct changes.** The air eased every change over 1.5 s, so `fog_to` lagged its
  tween and a zone let go at the default rate. The level's own numbers apply at once now; only each zone's pull
  eases, over that zone's own seconds.
- **An additive speck adds to what's behind it, however it's capped.** The motes were capped at 1.0, under the glow's
  1.05, but `blend_add` adds to the pixel behind: over a lit corridor wall a capped mote can take the pixel past the
  glow, and dust shouldn't show there at all. The woods at night hid it (nothing behind). A mote reads the screen
  behind it now: it fades as that gets lighter (dust is only seen against the dark) and never adds more than takes the
  pixel to the cap. Judge an effect over a lit background as well as a dark one. (The corridor's soft discs themselves
  were the size bug below: I blamed the background first.)
- **A `.tscn` writes a Transform3D's basis by rows.** `Transform3D(xx, yx, zx, xy, yy, zy, xz, yz, zz, origin)`: a
  helper that wrote the x, y and z axes one after another wrote the transpose, and tutorial v2's leaves light looked
  west when it was aimed east. Print the node's `-basis.z` once it's loaded.
- **What's found by place must prefer what's on.** The light zone gives each glowing fitting to a light beside it, and
  the interior export brings its own lamp markers at every fitting, hidden by `interior.gd`. They came first in the
  tree and took every tube's glass, so the tutorial's tubes had none (TUTORIAL2 caught it: the glass still lit with the
  corridor dark). Each glowing mesh now goes to the nearest light that's on.
- **Godot's `PROJECTION_MATRIX[1][1]` is negative under Vulkan** (the clip space's y flipped): the motes' size in
  pixels came out negative, so every mote took the growth's cap (8-fold), dimmed by 64 and then lifted back to full
  by the brightness cap: the near ones were 17 px soft discs, the very look the user called stylized, and the far ones
  still looked like points, so the pictures half hid it. Found by turning the near fade and the growth off in a small
  scene of its own. Take `abs()` of a projection term used as a size.
- **Glass from a glTF casts a shadow in Godot**: the importer draws see-through glass with a depth pre-pass, and
  depth pre-pass materials cast shadows (plain alpha doesn't). The street lamp outside the stairwell window lit nothing
  inside. The starter's `interior.gd` turns the glass's shadow off in the game.

## Curtains that crumpled where nothing touched them (2026-11-04, after the wood)

- **A rail keeps its family's distance from the wall**: the flat's curtains were first hung 100 to 110 mm out (to
  clear a desk), and the sheer's deep gathers pressed against the wall and twisted; the default 200 mm hangs them
  clean (the desk moved 10 cm instead).
- **A pucker that stays put whatever changes is the seed's**: the living room's drapes kept the same crumple near one
  panel's hem through a nearer rail, a further rail and a shallower window frame (the settle has no self-collision:
  two folds crossing). A few seeds made small in a scratch folder (`propgen.py make <name> --seed N --as try_N
  --formats glb --tex 1024 --out <scratch>`, two at once) found clean ones in minutes; the recipe keeps that seed.

## Wood sets that looked drawn, then real (2026-11-04, latest)

- **Wood's figure is a cut through rings, not rings drawn on the face**: the first sets drew the growth rings as
  evenly spaced contours of a noise field, which read as a topographic map, and drew oak's latewood dark where real
  flat-sawn oak shows its earlywood's band of open pores dark. Rewritten as a board's face cut a little off the pith
  and slanted to it through rings of their own wandering widths (`ring_table`), so the arches come out of the
  geometry; oak's figure the porous earlywood band, birch's the latewood.
- **A set that tiles is checked against its own joints**: the first seam check compared the repeat's edges to the
  pixels beside them and failed sets whose edge falls on a board joint (a groove is a step by design). It compares
  each edge's step with the steps at the joints inside the set now.
- **A stand-out set is measured against its neighbours, not judged alone**: too little tone between boards read as
  one sheet of vinyl, and the first birch was pink; each set's lightness, saturation and roughness are kept in the
  imported sets' and measured wood's range (WOODPBR) and its boards varied from the others by tone and warmth.
- **A word in a layout is checked in the picture, not in the file**: the kits' `mats` were written inside their spec,
  where nothing reads them; the set built and checked clean while the bed stayed the kit's orange (and the curtains
  had never worn their colours). Godot's pictures showed it; `presetToModel` moves a kit's `mats` onto the thing.

## Every prop's picture and the sticker passes (2026-11-04, night)

- **A new field or class in a big module is looked up first**: the picture editor's state already had `E.view` (the 3D
  viewer's loaded model) and its stylesheet `.pe-pic` (the pictures to drag); the preview's switch and box took the same
  names, the model overwrote the switch (both views hidden) and the box took the thumbnails' style. `E.pane` and
  `.pe-onpic` now; grep a name before giving it.
- **A 3D view that isn't shown doesn't draw**: three.js's loop kept rendering the hidden editor view in software GL,
  and the page's clicks waited seconds behind it (`view3d.js` skips frames while its box has no width).

- **A picture laid on a render is lit through the surface's own detail**: the first light and gloss passes ignored the
  materials' normal maps, so a sticker on a crushed can lay smooth over its creases while the label round it was
  crumpled. The override shaders take the material's own normal now (`stage._override`), and the passes carry a
  version (`_st.json` `v`) so the older ones are made again.
- **A batch longer than a background command's two hours runs detached and resumes**: the first run of every recipe
  would have been stopped at the limit; `setsid nohup` and a command that skips what's done (`thumbs --make`).
- **Python's prints into a log file wait in a buffer**: the batch's progress showed nothing for minutes until its
  output was line-buffered (`sys.stdout.reconfigure(line_buffering=True)`).

## The user's floor plan as a map (2026-11-04, small hours)

- **Look at the export, not only the plan**: the plan view (plan.py on the set) had the kitchen open to the living
  room; the Godot export, which goes through the scene builder's page, walled it off (the page read open plans back
  as walls). A picture of the real thing (`tools/godot/map_shots.py`) is the check of a map.
- **Restart the desk's server after changing storykit's Python**: it keeps the modules it started with, and every
  export plans through it. The gate looked still walled up after plan.py was fixed, until the server was restarted.
- **A rule for every bug the map found, and the old levels compared**: each plan.py fix was run over every set and
  game's walls before and after (identical but where they were wrong: the schools' stair arches were walled up too,
  unnoticed), and LEVEL now says what it was.
- **Glass for Godot is clearer than the desk's**: 25 % of a pale blue reads as glass in three.js and as a milky veil in
  Godot (lit by the room's lamps, under SSR); the game export already used 12 %, the by-hand export now does too.
- **A pole's arms cross the road** (`turn`): at turn 0 along an east-west lane every wire hung in one vertical plane.
- **Cameras for pictures stand where a person could**: a shot "across the bend" stood behind the curved wall.

## A street's pieces in one plane (2026-11-03, night)

- **Measure faces against planes, not planes against buckets:** the first street measure keyed each face's plane by its
  normal and its distance rounded to half a millimetre and called a shared key a clash; on a sloping road every strip
  of paint 5 mm over the asphalt landed in a neighbour's bucket and the hills were "full" of clashes that weren't
  there. The test that holds is STREET's own: every corner of one face within the distance of the other's plane, then
  the overlap's area clipped in that plane (`SG.between`); buckets only to find who to compare.
- **A rule that clamps makes its own coincidences:** cutting every part at "half way to the neighbour" put a balcony's
  end and the air conditioner on it at the same cut, in one plane; parts cut there now each end their own step in.
  Likewise a ridge cap ending "no further than the slabs" ended exactly in their ends' plane. After a clamp, look at
  what else it clamped to the same number.

## Walls meeting (2026-11-03, later evening)

- **Close a corner only where nothing else does:** a wall run on "to close the corner" was right for a room alone and
  wrong where it met another room's wall: its end lay on that wall's face, two faces in one plane that z-fight, as a
  thin line down the wall flickering with the eye. Ask what fills the corner first (every other wall, measured), and
  check it the same way: LEVEL now counts faces of two rooms in one plane and corners left open, WALLS the same on a
  Director project's built rooms. The first fix, "filled over the whole height or not at all", missed a stair shaft
  the building's height beside each storey's corridor: decide by height, and cap only what's left open.
- **Look for the same fault one dimension over:** the walls' z-fighting had a twin in the Director's floors, each run
  a whole wall past its room so neighbours' floors overlapped under the wall between them and showed in its doorway.
  Measured the same way (WALLS counts floors and ceilings too), fixed the same way (stop on the middle line where a
  neighbour carries on, one builder for what's left).
- **A level put straight under the root plays alone:** HSLevel's `_enter_tree` takes a parent that's the root (and no
  current scene) for F6 and holds its rooms back. A test that builds a level's rooms puts it under a holder node, and
  waits a frame (nodes added in a SceneTree script's `_initialize` enter the tree once the loop runs).

## The skin's depth and the clothes in motion (2026-11-03)

- **A check of a subtle effect needs a ceiling as well as a floor:** the skin's depth layer (GODOT_LOOK §5g) was
  checked only for being there (round the eyes up over 8%, the ear over 15%), so the first numbers passed at 44% and
  53% and the user saw orange rings round the eyes and a red ear in the game. GDPORTRAIT now fails a glow too (no point
  warmed more than 25%, the ear 30%). Look at the effect against the layer off in the game's own light, not only at
  the numbers going the right way.
- **A shader ramp's first stop is the hue a little of it shows:** HumanShaders' translucency looks up a ramp from
  black through pure red to orange by the skin's thinness, so thin skin under a lamp from behind (a nostril's rim, the
  lips' seam) drew pure red lines. Lower its gain, not the lookup: the lookup only slides along the same red.
- **A test page with its own little server dies silently on a module it can't serve:** `motion.mjs` served only
  `tools/director` and `tools/character`; once the desk's `bodies.js` imported `../shared/`, the page's module graph
  never loaded, nothing threw on the page, and the sheet waited its full half hour. It serves `tools/shared/` now and
  fails at once on a module that won't load.

## The prop generator's trees (2026-11-02)

- **A bush is leafy to the ground, so its leaves go on every node, stems too:** the first azalea balls floated, a
  cloud of leaves over bare sticks, because the cards hung only on the last order of twigs, as a tree's do. A clipped
  bush carries leaves along every branch and stem (`leaves.on: all`), and the clip cuts branches, not the leaves off
  them.
- **A spray hangs by its cut stem, and "the thin end" isn't it:** the first realistic trees hung most fir sprays by
  their bushy end (the user caught it in the atlas). Measured by the outline's width, a spray's cut end looks wide
  (its side shoots angle back past the stem) and its far end narrow (a point of needles). What marks the stem is
  that the last slices of the long axis hold one thin run of pixels, not several; and a leaf photographed on a
  plain ground is simply stalk down, so its base is its lowest point. Read a photo's convention before inventing a
  measure, and check an atlas by eye before the tree.

- **Port the algorithm, not the add-on:** Modular Tree 4 is an MIT C++ core under a GPL Blender add-on compiled
  against one Blender's Python at a time (the fork stopped at 3.2). Its growth (a few hundred lines once the
  `shared_ptr` scaffolding is gone) ran in plain numpy Python in an afternoon, on Blender 4.2's and 5.x's own Python
  with nothing to build, and the same seed grows the same tree. Fetch a library like that for what it knows (the
  order of its steps, its words, its defaults), and write it in the project's own way.
- **A tiling texture over every branch wants no per-texel raster and no occlusion bake:** the bark tile covers
  thousands of tubes, so `raster` walked twenty thousand triangles whose UVs run many tiles up each twig (thirty
  seconds at 512 px, minutes at 1024) for a wear nothing used, and a Cycles occlusion bake over UVs that overlap
  everywhere is a jumble. Skip the raster where no wear and no paint by place reads it (`build.run` now does, for
  every prop), and let a thing say it bakes no occlusion (`Thing.bake_ao`).
- **A texture that must repeat both ways is drawn on the flat torus in 4D, not crossfaded:** sampling 3D noise round
  a cylinder tiles one way; crossfading the field with itself a tile up blurred the bark's cracks into ink blots, and
  the 3D torus squeezes its inner side to half. Four coordinates, (cos u, sin u, cos v, sin v) with each circle's
  radius its length round, and perlin4 reads it with no direction stretched and no seam (`noise.fbm4`, `ridged4`).
- **A leaf card is a spray, not a leaf:** the first atlas drew leaves at their true size along a twig, and the crown
  came out a scatter of green specks on bare branches. A card stands for a whole spray, so its leaves are a quarter
  bigger than life and half a leaf apart along every twig (a fifth to a third of the card covered), and the cards
  sit at every branch's tip as well as along the last order of twigs, so nothing ends bare.
- **A pipe model starves a trunk with few tips:** a pollarded plane and a dead tree came out with trunks a few
  centimetres thick, since their radii were summed from a handful of twigs. A stem keeps at least its species' trunk,
  tapering up it (`_trunk_floor`), and a pollard's limbs keep the radii they grew with.

## Carried over from the Godot project (Woohill)

- **Measure, don't guess:** a check that prints one `<NAME> ok` line beats any amount of reading code. Every
  system gets one, and `tools/check_all.py` runs them all.
- **Keep context small:** summaries and tails, not whole files and logs. Contact sheets, not frames.
- **Small steps, pushed:** the user changes course quickly, so every step should stand on its own.

## This project

- **A shading frame goes into a basis once:** the Godot eye's iris bowl normal went back to view space through BINORMAL
  with `handed` applied a second time (eB, the binormal's image, already had it), so the bowl tilted down where it
  should tilt up: under a lamp above, the iris's lower half went black and the eye read as a black hole (the user:
  "lifeless and scary"). Found by turning the guessed lid shadow off and seeing the lower iris stay black (GODOT_LOOK
  §5h). When a frame's sign is a uniform, every use of the frame must be checked, not only the one that was measured.
- **On a mesh with a crease, take the frame where the normals are exact:** the eye's wet layer first worked out the
  eyeball's centre per pixel from the interpolated tangent frame, and across the limbus (the export puts the white's
  sphere and the cornea's dome on one ring of vertices with their normals averaged, 14.5° off each) the frame bent and
  the centre moved millimetres: a false ring of shadow round the iris. Second try: per vertex, with the averaged normal
  on the limbus ring, every vertex gives the same centre (to 0.02 mm), so its interpolation is exact.
- **A Studio export made in the cloud needs MediaPipe first:** without it the Studio's face landmarks fail
  (`api/face/landmarks`: "MediaPipe isn't set up", then a missing libEGL), and an export said "wrote ... 12.0 MB"
  carrying only the skin: no eyes, no blink, no lashes, no lips or make-up, its paint one flat tone (found on both
  `eye-enhancements` and `subsurace-scattering-exp` the same day). Second try: `python tools/face_mesh.py setup` and
  `apt-get install libegl1` before the Studio's server makes an export to check (the eyes and lashes come once
  `graft().on`; about two minutes).
- **GDTESTROOM on a fresh checkout needs the desk's bake first:** without `Content/Games/TestRoom001/Previs/` (git-ignored)
  Aoi's stand-in has no body to wear HSSkin, and station 6 fails on "her skin ... on 0 materials", which reads like a
  skin bug. Second try: the desk's server and `node tools/godot/bake.mjs --game TestRoom001` (about a minute), then
  GDTESTROOM passes.
- **A shade from on/off taps is a staircase:** sixteen taps each lid or not gave the lid's shadow seventeen levels,
  steps that followed the lid's shape. Second try: the distance to the lid along eight ways, each found by halving,
  shaded by the distance: no steps.
- **Never copy a repo's `.import` files over an imported Godot project's:** Godot writes each one's `path=` and `uid=`
  into it on import, the repo's has neither, and every texture then fails to load, its sampler falling back to the flat
  default without an error in the picture (the skin's depth layer measured exactly nothing off and on). Second try:
  the plugin's other files copied in, or the project imported again (`--import`) after.
- **A graft takes over every deformation of what it replaces:** the grafted eyes rode MHR's face without MHR's blink, but
  MHR's blink still moved the skin round them, and shut, the seam opened into black slivers. Second try: with the grafted eyes
  on, MHR's own eyesClosed is left out of the face altogether; the graft shuts its own way.
- **Lids rest on the outermost surface under them, not the eyeball's sphere:** our cornea bulges about 2 mm past the
  white (the base mesh's barely does), and the base mesh's shut lids, seated on the white's sphere, showed the cornea and the pupil through
  them. Second try: each lid point is kept out of whichever is further out under it, the cornea's dome or the white.
- **A shut lid shows skin no photo saw:** the base mesh's upper lid unfolds from under the crease as it shuts, and its UVs, laid on
  MHR's narrow lid, stretched what the photo had there (the test character's: a screenshot with the Studio's circles
  over the lid) into grey stripes, which a first look took for the studio lights' reflections; a blur alone only
  softened them (the stripes ran along the lid's angle). Second try: that part of the lid near the photo's own skin
  tone, and its skin and makeup worked out on the open lid laid flat, so they go down with it.
- **A photo skin lives on MHR's UVs, so a graft's UVs come from where the skin it replaces was, by position:** UVs taken
  from the nearest MHR triangle put the photo's eye (projected onto MHR's closed strip and the lid skin by it) on the base mesh's
  shut lid as pale, jagged patches. Second try: the base mesh's lid laid on MHR's lid between the opening and the edge, round the
  eye, and the strip left out.

- **Read a generator's own controls before blaming its look:** the add-on's lashes "stood up" because its Straight preset says
  so (Angle Inner 80°, Angle Outer 70°, off the lid's line: every other preset sweeps out at 40° to 10°), and a tidy that
  turned lashes up to keep them off the eye made it worse. Second try: the brows and lashes by hand, their angles
  measured on the user's references (the middle lashes 1.5 to 2.5 mm over the lid, not 3.7).
- **A hair's look is its thickness as much as its texture:** the editor's first lashes and brows were drawn the same way
  as the add-on's but 30 to 50% thinner, and in Godot they faded to a faint line; at the add-on's 0.055 mm they read as the add-on's did.
- **A name in a 3000-line page is shared:** the editor's handle list was called `GH`, as the garments' handles already
  were, and the whole page stopped with "Identifier 'GH' has already been declared"; grep a name before taking it.

- **Move a cut mesh by the points its corners are made of, never corner by corner:** the Studio's export cuts the eyes'
  openings out of the skin by splitting MHR's triangles, and a split triangle's corner lies on its neighbour's edge (a
  T-junction). Any move that isn't the same blend of the same points (pushing each corner off the eyeball, closing the
  lids by moving the edge corners) opened cracks there, and the eye showed through them. The blink's targets are made
  from MHR's points (kept off the eye, the lids met by moving the edge corners' triangles' points) and the corners
  follow by their weights. Second try: the first shut lid had a cracked inner corner and a patch dipping into the cornea.
- **A morph target is a straight line; check the way, not just the ends:** the shut lid sat outside the eye and so did
  the open one, and halfway down the straight line between them ran 0.7 mm into the cornea (most where the lid crosses
  it, 60 to 90% shut). One corrective at the middle didn't cover it; in-betweens an eighth apart (and a sixteenth before
  the end) do. EYELIDS draws the file at every twentieth of the blink from five sides.
- **MHR's shut lids don't shut:** they leave 15 to 20% of the opening (the Studio hides it by shrinking its cut). A file
  whose opening is cut out of the skin showed the eye through a slit with the lids "closed"; the export meets the
  cut's edges over the blink's last quarter.
- **Pin a strand to the face it will be worn on:** the add-on grew the lashes on the export, whose lids are brought forward
  onto the eyeballs (up to 4 mm); pinned there and rebuilt on the Studio's own face (not brought forward), each lash
  turned with its triangle's tilt and a fifth of them crossed the eye. Now each strand is moved back off the lift (the
  Studio's `body.bin`), pinned, and the export lifts it again with the lids (`liftWith`); our own lashes had stayed
  behind the export's lids too.
- **Copying a plugin over an imported Godot project leaves stale textures:** the skin came out striped like wood until
  the project was made fresh. The checks always build their project from nothing; a scratch script must too.
- **A node that rides a rigid body must lose its own colliders while it rides** (the desk's TestRoom as a Director
  project, 2026-11-01): the die's node is moved onto its rolling body every frame, and a Director thing's collider is
  a `_solid` StaticBody3D under it (the export's is a `shape` the roll turned off by name): it rode along inside the
  die and shoved it through the floor, the die settling 9 m under the room. physics.gd now turns off every collision
  shape under a thing it rolls, whatever it's called, and on again after.
- **A check measured on one layout fails another's by the walls' thickness** (the same day): the desk's rooms run to
  their walls' middle, a Director room is its inside; the yard's rain box was 12.9 m wide against a floor of 12.9 and
  failed by float. Leave a check a margin for both, and ask the running game for what it names itself (a save file by
  the game's id) rather than writing the desk's in.

- **A Godot node's setup for play runs once, in the copy that plays** (the Director, 2026-10-30): a scene's children
  are `_ready` before their parent, so a level under the HSGame had set itself up (recentred, colliders, pieces) before
  the game could take it up as a template, and the runtime's copy would have done it again. The HSGame raises a flag
  in `_enter_tree` (which runs before the children's `_ready`) and the level's nodes wait for the copy.
- **Placing the player inside an area isn't entering it:** the runtime's `place` counts the triggers it lands in as
  already entered, so a test that teleports into a jumpscare's area never fires it; walk in from outside. Found twice
  (the Director's play check, then its level-alone check).
- **A Skeleton3D out of the tree doesn't update its poses:** a test that set bone poses and read global poses got the
  rest every frame (a motion with no travel, a 16 cm "error"); put it in the tree and `force_update_all_bone_transforms()`.
- **Switching something off for what's hidden needs its way back:** characters are hidden while a level loads, so switching collision
  off for every hidden thing switched hers off for good; whatever shows a thing again must switch its collision back
  (draw_npcs does now).

- **A headless test waits on the game's clock, not the wall's:** on slow frames (the cloud's software GPU) the
  runtime clamps each step, so a second of real time is less play; fixed `waitForTimeout`s raced every walk, sit,
  turn and meter. `gameWait`/`hold` in playtest.js wait for `rt.clock` (and stop when play ends: a walk that answers
  a choice ends play). Upper bounds can be generous; they only cost time when something is broken. PLAY failed at
  step 4 for a whole session before this was found.
- **A click in a headless test lands where the mouse last was:** Playwright's `page.click(selector)` moves the mouse
  to that element, so a mouse parked over the view before the Watch's Start button was clicked was over the button,
  and the game never saw the click (PLAY's first try of a left click to use). Park it again right before pressing, with
  the faked pointer lock let go for that moment: a locked mouse that moves turns the view (`click()` in playtest.js).
  And a check of someone walking measures the game's clock too (`onRoute`: Mari moved 0.18 m in 4 wall seconds).
- **A renamed room takes its built pieces' names with it:** the scene builder renames a borrowed level's rooms that clash
  (`genkan` → `genkan_2`), but the pieces it keeps as props (`genkan_fx_floor`, its built-ins, a cushion `on` its sofa)
  kept the old names, so a level taken twice into one game (a set borrowed where its layout already was) had every
  fixture twice and wouldn't plan. `renameItems` renames them and the `on`s; BUILDER borrows a set into such a game.
- **A test's search must not touch the story:** `goTo` tried 16 spots and ticked the game at each, so a spot on the
  cellar stairs fired `enter` and answered a choice. Aim-test a candidate without a tick, and skip spots inside a
  trigger the player isn't already in.
- **Two of the same element is a test's trap:** the Watch's footer and Play's HUD both have a `.ph-line`; a bare
  selector read the wrong one (and found a real bug: a triggered scene's last line stayed up in play). Read the
  runtime's own element (`rt.hud.lineEl`).

- **A box of absolutely placed cards has no height of its own:** the branch map's cards sat in a zero-height box and
  the page took the clicks; size the box to the cards (the map does now).
- **Merge the other session's push before building on the same file:** the local session's `motion.py import` (one
  file) landed on main while this branch had its own (every shot-list name); both forms now live under one command.
- **Playwright's own Chromium can't decode H.264 or AAC:** the desk's take test read nothing from a MiniMax-style
  mp4 until it used a WebM copy. Test takes with WebM; your Chrome or Edge plays the real mp4s.
- **A running desk server keeps the old serve.py:** new routes 404 until it's restarted (find its PID in one
  command, kill it in the next, start it again).
- **A dev skip mustn't skip the thing being tested:** the desk's Esc skip jumped past timed choices, so the karma
  test saw none; it now jumps to the next event instead.
- **A room with no doorway in had its entrance shot from its middle, looking straight down:** the planner now stands
  at the level's start spot (or just inside the south wall), so a new game's template passes the shot check.
- **Blender joins bones when it reads an FBX, and a joined bone can't move:** the first round-trip check of a
  Kimodo FBX was off by the whole walk, because the hips' travel was dropped on Blender's re-import, not in the file.
  Disconnect the bones before measuring (Unreal has no such rule).
- **Kimodo's skin is bound in an A-pose; its motions rest in a T-pose:** the first SK_SOMA put the A-pose mesh on the
  T-pose skeleton (64 cm apart at the hands). Kimodo's own skinning with identity local rotations puts the mesh in
  the T-pose first (`retarget.py` TPOSE). Its `from_standard_tpose` is the other way (to the BONES-SEED rest).
- **A Blender FBX in metres can say UnitScaleFactor 100 even with "FBX All":** for Unreal's own kind (centimetre
  values, factor 1) keep the scene unit at 0.01 m, import the centimetre BVH at scale 1, and export with
  `FBX_SCALE_NONE`. Read the header to be sure (`fbx_unit_scale`).
- **Walls are centred on the room edge (0.1 m thick):** a prop against a wall sits d/2 + 0.05 m from the edge.
  The pilot's bookshelf was 2 cm into the study wall until level_check caught it.
- **The greedy playthrough walks from where the player is, not from the level's start:** the first version
  locked the player out after the front door slammed behind them.
- **A greedy check finds secrets every time:** sweep the paths twice, once missing every `secret` beat and once
  finding them all, or the endings that need a secret missed are never reached.
- **The player keeps playing at an act choice:** use the key, read the note. The first check stopped the player at
  the choice with the key in hand and the door still locked, so only "hide" was possible.
- **Never kill by a pattern that the same command line contains:** `pkill -f`/`pgrep -f` match your own shell
  when the pattern (or the command that started the server) is in it. It happened twice. Start a server in one
  command, note its PID (`ps aux | grep "[s]erve.py"` in a separate command), and `kill <pid>` in another.
- **Ids made per scene must say which scene:** two staged stand-ins both called `cast_mari` overwrote each other in
  the shot planner.
- **A thing made per clip needs the clip in its id:** two clips starting at the same mark gave their stand-ins the
  same id, and the moved one overwrote the other in the shot planner (the second time this lesson came up: ids
  derived from data must include every key that varies).
- **Measure shots where the actor is, not where they started:** blocking moves actors, so the planner follows each
  actor's `move` keys across clips and measures a moving clip halfway.
- **"Medium shot" names a body part, not a distance:** the framing check measures the part a shot is about (face,
  chest up, waist up) as a share of the frame. The pilot's "MS" at 3.2 m read as a wide shot until it was measured.
- **`--no-build-isolation` means every build backend is ours to install:** Kimodo's demo pulls NVIDIA's `viser` fork
  from git, which builds with hatchling; `setup.py kimodo --demo` failed until hatchling joined the build tools.
- **A patch meant for other machines needs `--src-prefix=a/ --dst-prefix=b/`:** this machine's git has
  `diff.mnemonicprefix`, which writes `i/` and `w/`, and the patch refresh's own parsing broke on it.
- **Kimodo's demo keeps its skeleton on the GPU:** tensors made to run its FK (the pose window's rest pose) must be
  created on `skeleton.neutral_joints.device`, or TorchScript refuses the indexing.
- **Measure a prompt before trusting it:** of 12 horror prompts, 4 didn't do what they said on the first wording
  (no crouch, no cower, no getting up, a fast retreat). Two were fixed by rewording; two can't be (crouch-walking,
  slowness), and those need a pose or a paced path. `tools/kimodo_presets.py check` is the measure.
- **A run of things that each "stop the last one" needs its own token:** the score room's audition plays every
  variation in turn, but a take ending by itself went through the same stop as the Stop button and ended the whole
  audition after one card. Ending a take (`endPlay`) and stopping what the user started (`stopAll`) are two calls.
- **A compressor and limiter on the music bus make every cue the same loudness:** a dread bed rendered as loud as
  the jump scare (both about -14 dB RMS). Cue levels go after the limiter (the master), never on the notes.
- **A server started from a script must not keep the script's output:** the launcher's page servers inherited its
  stdout, so anything reading the launcher's output (a pipe, a test) waited for the server to end. Windows gets its
  own console window; elsewhere the server's output goes to Saved/launch/<name>.log.
- **UnrealClaude's bridge lists only its simple tools:** taking the script tools out of `HIDDEN_TOOL_NAMES` made
  them "mega" tools, which aren't listed either (16 of 28 shown). `setup.py unrealclaude --show-scripts` now adds
  them to `SIMPLE_TOOL_NAMES`; after a router change, restart Claude Code so the bridge reloads.
- **Start the editor before Claude Code:** the bridge gives its tool list once, when Claude Code starts, and never
  says it changed; started before the editor, Claude saw only `unreal_status`. Check the editor runs *this*
  `.uproject` too (`pgrep -a UnrealEditor`): it once reopened a stray template and the bridge never came up.
- **Story ids are unique across the whole file, levels included:** the scene builder's layouts planned on their own
  but failed beside an existing level (two `start`s, two `front_door`s). Anything added to a story is renamed
  against `takenIds()` first.
- **`node --check file.js` passes an ES module with a syntax error:** it reads the file as CommonJS and said nothing
  about a `const` declared twice, which then stopped the whole desk from loading. Check the desk's modules with
  `node --input-type=module --check < tools/director/<file>.js`.
- **A BroadcastChannel never crosses browser contexts:** Playwright's `browser.newPage()` makes a new context per
  page, so a test of the builder telling the desk it saved has to open both pages from one `newContext()`.
- **A level check that reads every level's rooms has to keep to the level it checks:** the doorway clearances of
  one level were tested against another level's furniture standing in the same place, and failed a borrowed level.
- **The desk's server imports storykit once:** after changing `plan.py`, `level_check.py` or anything it imports,
  restart `serve.py` (find its PID, kill it, start it again), or the pages plan with the old code. The kit's pieces
  were missing from the builder's 3D view, and a level check failed on a rule already fixed, both for this reason.
- **Unreal mustn't watch `Content/` for new files:** the merge put `Kit/presets.json` there, Unreal offered to import
  it as a DataTable, and the options dialog opened blank on another workspace and held the editor (and every MCP
  call) in its modal loop. `bMonitorContentDirectories=False` (setup.py configure), and a Hyprland rule keeps all of
  Unreal's windows on its workspace (4).
- **The `.uproject` must be Unreal's first argument:** `ue` put its `-ini:` flag first, and Unreal opened the Project
  Browser instead of the project (that's how a stray template got opened). The launcher now puts a `.uproject` first.
- **A script that opens a map crashed UnrealClaude:** it counted the actors afterwards in the world from before the
  script, which the new map had freed (SIGSEGV). Fixed in `ScriptExecutionManager.cpp`, kept in
  `setup/unrealclaude_linux.patch`.
- **`-ExecutePythonScript=` on the editor runs before the project's Python is on the path, and quits the editor
  after.** The desk's Generate leaves `Saved/Story/<G>/generate/pending` instead, and `init_unreal.py` runs it once
  the editor has loaded.
- **The editor saves its per-user settings over the project's defaults:** `bMonitorContentDirectories=False` in
  `DefaultEditorPerProjectUserSettings.ini` did nothing while `Saved/Config/LinuxEditor/` said True. Those settings
  aren't visible to Python either; `init_unreal.py` corrects the saved file.
- **A Slate tick isn't an engine frame:** with the editor in the background Slate ticks many times per frame, so
  `shots.take` queued all 18 cameras inside one frame and one picture came out. Wait on
  `SystemLibrary.get_frame_count()` for anything that needs the renderer.
- **Unreal's glTF import scales a skinned mesh's bones by their nodes but not its vertices:** MHR binds in
  centimetres under a 0.0098 node scale, so Mari came in as a 172 m skin on a 1.6 m skeleton and drew nowhere near
  her bones. The desk now exports a fresh skeleton with no scales, vertices and bones in metres, the mesh at the
  identity. Check an imported body's reference bones against its bounds before posing it.
- **The editor keeps a Python module it has imported:** `storykit.generate` reloaded the rest of storykit but not
  itself, so a Generate ran yesterday's code. The desk's script reloads it first.
- **FBXLoader's vertices aren't shared:** normals recomputed on them come out flat (a faceted body in Unreal). Keep
  the file's normals.
- **The desk lights every room with an ambient; Unreal's sky light doesn't get through Lumen's walls:** a room with
  no lamp (the Pilot's cellar stairs) played black in Unreal while the desk showed it. Each room gets a shadowless
  fill (`importer.room_fills`). And anything the desk lets the player do during a scene (look round the cone) has to
  be in the bake, or Unreal locks it.
- **The desk's server sends only the file types it lists** (`serve.py` STATIC): Play's CSS came back 404 until `.css`
  was added. A new kind of file in `tools/director/` needs its type there. A test can run its own desk beside the
  open one: `DESK_PORT=8781 python tools/director/serve.py`.
- **Inside a box you see nothing of it** (three.js draws front faces only), and a flat see-through tint over the
  whole view doesn't read as "I'm in a locker" either: the Pilot's locker scene looked like standing in the hall.
  Slats (an alpha map of bars, drawn both sides) read at once and keep the room visible between them
  (`stage.seeThrough`).

- **Mesh to MetaHuman needs a head, not a face:** the face-only mesh from `face_mesh.py` (MediaPipe's 468 points)
  traced badly: with no skull or ears the tracker struggled to place things, and MediaPipe's eye openings are too
  soft to read as eyelids. Bend a whole head template to the points instead (the template's own eyelids, shaped by
  the photo's), best the MetaHuman base head itself, so the result is already lined up.
- **Every stitched edge needs the same number of points on both sides:** `garment.py` sampled a straight edge as one
  point and a curve as twelve, so the drape skipped every straight-to-curved stitch (the skirt's waistband floated,
  the t-shirt slid off its shoulders). Straight edges now get twelve too. And GarmentCode's flat placement, 30 cm in
  front and 25 cm behind, sews shoulder seams straight through the shoulders: lay the panels on the body first.
- **To open MHR's sealed shell, move points, don't hide triangles:** hiding the triangles inside the lid outline
  left slivers over one eye (MHR's triangulation differs round each eye); sinking every point inside the outline
  behind the eyeball works whatever the triangles are. The mouth is still open: its visible inside isn't within the
  inner-lip outline at all, so the same trick showed a pale wall (a look at MHR's mouth geometry comes first).

**Sewing springs: gentle, not strong (2026-10-21).** Blender's `sewing_force_max` at 30 closed a GarmentCode t-shirt's
10 cm seam gaps so hard that it pulled the shirt off the shoulders and crushed the sleeves into rolls up the arms;
heavier or lighter fabric and stiffer bending didn't help. At 8 the seams still close (0.5 mm), the shirt stays on the
shoulders with real short sleeves, and skirts and pants drape as before. Try `DRAPE_SET='{"key": value}'` on a few
settings side by side (renders stacked) before rewriting the drape.

**MHR's mouth is sealed by a membrane (2026-10-21).** The open mouth's "inside" isn't a sock of skin behind the lips:
it's a sheet of triangles whose corners all sit on the lip line, stretched across the gap when the jaw drops. Sinking
points, depth tests and floods inward from the lip line all miss it (they also leaked onto the chin at the corners).
Find it by what it does: near the mouth, the triangles that grow ten times or more in area under jawDrop; colour those
per corner. Measure the expression's effect before guessing at the geometry.

**A simulation undoes what the generator promised (2026-10-22).** The grown hair kept off the face and cut its bangs at
the brows while it grew; once the same strands became wig clumps under gravity, side locks fell across the face and
bangs sagged into the eyes, and in twin tails the bangs took the tie and were pinned whole. Every rule the shape keeps
(the face keep-out, the bangs' hold, who is pinned) has to live in the step too, not only in the shape it starts from;
and read the exported data (pinned counts per clump) as well as the pictures.

**Collide hair with the skin, not a star-shaped head (2026-10-22).** Hair kept off the head by a radial field (the
farthest skin in each 11° direction) hung a median 26 mm off the cheeks: near an ear or a cheekbone the farthest skin
in that direction is the ear's tip. Pushing along the nearest skin point's normal (a hash of the skin's points, 1.2 cm
cells) brought it to 19 mm (the rest is physics: straight hair drops from the skull's widest part), and the hair now
lies along the face. Measure distance to the skin at face height; a front picture hides it.

**Pin cloth round the body, not onto its nearest points (2026-10-22).** Locking a waistband by moving each of its
points to the nearest skin point piled several onto the same spot on a heavy body: coincident and crossed points
blew Blender's cloth apart (seams a metre apart). Laying them round the body's cross-section at that height (each at
its own angle from the middle, at its own height) keeps their order and spacing, and the pants stay on. And don't
flatten a scooped neckline to one height: it hitches the whole top up.

## A drop goes where the picture fits, not only where it lands (2026-11-01)

- **Decide a dropped picture's target by its shape as well as its place:** a box under the pointer can be the whole
  part (the can's bubbles pattern is a slot as big as its label), so "the smallest box under the pointer" swapped the
  pattern when a label-shaped picture was dropped to cover the label. A picture the part's shape fills the part unless
  it's the shape of a box that's only some of the part. And "square and half the texture's size" took a 256 px logo on
  a 512 texture for a painted template: the texture's shape is square and exactly its size (or 2x, 4x), or opaque and
  three quarters of it. The drag's label says what the drop will do, and Alt and Shift override it.

## A chart is pseudo-code, not prose (2026-10-28)

- **Write the writers' room's script as literal things:** who does what with which thing, short lines, sounds as cues,
  a `Note:` for anything the director must know. No narrative description ("she's soaked", "cicadas outside"): every
  described thing is a model, a state or a shot someone has to make. Chilla's Art's density: few words, a to-do list.
- **The player never speaks a line** (no `You: "..."`): his answers are an act and a thought, `[ Greet ] She looks
  cold, welcome her inside --- [ Question ] She looks different`, and the player imagines what he said. Only the cast
  talk in quotes. A talk needs a line from someone in the cast before the answers.
- **His thoughts know only what's in front of him:** never a thought that states what the player hasn't been shown
  ("Natsu came back. Tell her", "Twelve years. Is it really her?" before anyone said twelve years). Facts come from
  outside (the list, her lines, the props, the phone), and his answers react to them; the player has amnesia with him.
- The first chart of The Visitor read like a novel (scene-setting lines, a wet arrival needing its own model, a cold
  open); the user asked for pseudo-code. Rewritten terse, the same structure held.

## Tops: no cuff bands, sleeves at the arms' angle (2026-10-22)

GarmentCode's tops on our A-pose bodies came out cropped and crumpled. Not the tightness or the sewing force: the hem
rode up on the hips until the top flared (`shirt.flare` 1.25 to 1.35) and was long enough, and the sleeves folded up at
the wrist while they had a `CuffBand` (the cuff panel pulls the sleeve's end in and the drape can't pass it over the
hand). Cut sleeves at 45 degrees (the arms' angle), 0.8 long, no cuff. Compare variants of one design side by side
(four drapes in parallel) before changing a preset.

## Three.js converts a colour once (2026-10-22)

Since r152 `Color.set("#hex")` turns the sRGB hex into linear itself (ColorManagement is on). The procedural skin and the
strand hair also called `.convertSRGBToLinear()` after it, so their colours went through twice: the skin came out an
orange tan, darker than the same tone without the shader, and the hair darker than picked. Set a uniform colour with
`.set()` alone. Compare a shader's colour against plain `material.color` with the same hex when a look seems off.

## A frame with a wig in it is never the same twice (2026-10-22)

The touch-up's check compared the picture before a stroke and after its undo, byte for byte, and failed although the
paint layer was back to empty: two shots taken one after the other with nothing changed differ by thousands of pixels,
because the wig keeps swinging. Measure where the change is meant to be (the mouth, where no hair falls) and the layer
itself, not the whole frame. "A changed picture" alone proves nothing for the same reason: check it changed where it
should.

## The game's lens is 90° across a 16:9 screen, not across whatever canvas (2026-10-22)

The Studio's first POV view took `game.fov` (90° horizontal) against its own canvas, nearly square beside the side
panel: 94° up and down, a medium close-up that showed the whole torso. A first-person check frames like the game's
screen: 16:9, so 59° vertical, drawn in a 16:9 frame with bars round it, and any picking (the brush) goes through that
frame. Distances from DIRECTING.md's shot table (MCU 0.7 m, MS 1.2 m) only mean what they say through the right lens.

## A tool's launcher can't share its name with its package (2026-10-22)

`tools/gshair.py` (the launcher) and `tools/character/gshair/` (the package) are both `gshair` to Python: the
package's own CLI put `tools/` on `sys.path` first and imported the launcher instead of itself. Put the package's
folder before `tools/`, or name them apart. The launcher runs the package in its own environment with `-I`, so the
order inside `cli.py` is the only thing that decides it.

## OpenCV's hue is half a degree, and "the largest piece" isn't the wig (2026-10-22)

Green is 120 degrees, so 60 in OpenCV's 0 to 180 hue: a green key written for 30 keyed nothing. And with patterns on
the floor for the cameras to track by, the largest non-green piece of a frame is the floor, not the wig: keep the
piece that is big, central and high (area weighted by its distance from the middle and its height in the frame).

## A face's PnP has a mirror solution, and a small reprojection error doesn't rule it out (2026-10-22)

The 468 face points are nearly flat, so PnP has two answers: the camera in front of the face and its mirror behind
the head, both within a pixel or two at a small image size. EPnP, SQPnP and a RANSAC consensus all landed in the
mirror with a fine rms, and every chained camera followed it round. OpenCV's iterative solver from its own start
finds the right one; check it anyway (the camera must sit on the face's side) and never trust the rms alone.

## A synthetic camera must be a proper rotation (2026-10-22)

The check's look-at built its camera rows as right = up x forward, down = right x forward: a left-handed frame
(determinant -1), a mirror. Every real solver returns proper rotations, so PnP could only land in the mirrored twins
of such a camera, with a fine reprojection error, and two fixes went into the solver before the truth was checked.
Check the truth first: a camera's determinant, and the subject's left on the viewer's right.

## A frame from bound landmarks inherits the binding's asymmetry (2026-10-22)

The face landmarks bound onto MHR put 234 and 454 (the ear sides) 2.4 cm apart front to back on a body that is exactly
symmetric, so an ear-to-ear axis from them turns the head's frame about 10 degrees. Anything placed in that frame (a
reference's cameras, a splat's fit) comes out turned. Build a frame from the mesh's own symmetry: one vertex and its
mirror, not two landmarks.

## A test's clicks have to be where a user could click (2026-10-22)

The salon's first runs "failed" four times on clicks no one would make: ends off the bottom of the view, a fringe's
end in the air 9 cm in front of the face, roots grazing the silhouette's edge, a root below the temple's hairline. Each
time the page did the right thing. Aim a test's clicks at what's visible: points on the skin inside the silhouette,
inside the view at that zoom, and check the page's refusals before calling them bugs.

## Joining gaps round a head closes over the face (2026-10-22)

The fill's trace joins the gaps between locks with a closing on the grid of directions round the head. A fringe above
and two sidelocks beside the face surround it, so the closing filled the face, and a lock's footprint spread a cell
round each point bled onto the eyes. Mark the face (the front, below the hairline, above the chin) and never join
across it; give a point only its own cell; keep the face clear below the brows unless the user brings it back.

## Wait in time, not frames (2026-10-22)

The salon's physics stopped its loop after 150 still frames. A heavier hair shader dropped the software renderer's
frame rate and the same 150 frames took longer than the test's 15 s, so SALON failed with nothing wrong. Anything that
settles, times out or animates goes by the clock (here: 2.5 s still), never by a count of frames.

## Hair has to be laid down, not just kept out (2026-10-22)

The salon's curves were drawn straight, bowed out by a fifth of their length, and only ever pushed out of the head, 12 mm
clear: on a round head nothing pulled them back down, so hair floated 13 to 18 mm over the scalp. Combed hair lies on the
scalp until it leaves the head: pull every point near the head down onto it, then let the user bow it. And a setting the
wheel changes while placing (the bow) must start over for the next lock, or the next lock floats too.

## A reach in centimetres meets handles spaced by the lock's length (2026-10-22)

The pull's first test used a 4 cm reach and expected it to bend the strand it pulled: nothing else on that strand moved,
because a 35 cm strand's six handles are 6 cm apart (only the next strand, 2.5 cm away, was in reach). Distances
between handles grow with the lock, so a reach that suits a fringe takes nothing on a long lock. Measure the spacing
before picking a reach (for a default or a test): the salon starts at 8 cm.

## A preview is only true if it's made the way the result is (2026-10-22)

The salon's gravity drew each frame from the fall alone, and switching it off kept the hair through another path: twins
rebuilt as their originals' mirrors (they had fallen on their own, a little differently) and Layer by height re-laid
on top (it wasn't applied while falling). The user switched off and the hair moved. Whatever shows a result before
it's kept (a preview, a scrubbed frame) goes through the same steps the kept result will; the check compares what's
drawn before and after, not the data.

## A map round the skull is only true on the head (2026-10-22)

Layer by height kept, per direction from the skull's middle, how far out the hair below reached, and pushed later
hair past it. Hair that pokes out or hangs below the head lies along those same directions, far out, so a strand
combed over a poking one was lifted 11 cm along it, and with gravity's fallen hair, 45 cm. Only what lies on the head
belongs in such a map. The second try counted a lock's whole cross-section wherever its lowest edge lay, and a sheet
touching the cheek with its other edge 5 cm out made a spike; count each point up to the lock's own thickness.

## A page test reads what's drawn only after drawing it (2026-10-22)

The salon draws on the next animation frame, and a step that read a new lock's evaluated guides straight after the
click passed for days, then failed once (the frame hadn't come). Every step that reads drawn state (EVAL, meshes)
calls the page's render() first.

## Hair without friction slides round the head (2026-10-22)

The cover's sheets were combed out from a middle parting, and the fall (Verlet, the head pushing points out, no
friction) swung them round the back of the head into a crest: on a frictionless head, hair lying on top creeps to its
lowest path whatever way it was combed, and the head's slight tilt decides which way. Hair that lies needs friction
where it touches: the slide along the surface held back by friction times how far the point was pushed out (Coulomb,
position-based), so it stays where the slope is gentle and slides where it's steep. The other side of it: hair laid
along the head with friction is already where gravity leaves it; to check that a fall happens at all, make something
that overhangs.

## A sample's number isn't its place along the lock (2026-10-22)

The salon's guides were 24 samples spread evenly, and the taper, the texture, the dome's height and the bake's skin
weights all took sample k as k/23 of the way along. Bending the roots needed samples closer near the root, and every
one of those had to change to the sample's own place (each guide's `t`), as did a check that measured "half way" at
sample 12. Carry the place with the samples (or resample by arc length) instead of deriving it from an index.

## Hair finished by gravity needs stiff roots, and rows that meet (2026-10-22)

The first presets fell badly three ways. Long hair combed back off the face slid down the forehead onto it (steeper
than friction holds, and nothing in the chains stiffened the roots): the drop now holds each strand's first few cm to
its comb, fading along it (Root hold), and long locks get a control point every 6 cm so the hold has something to
hold. Rows too far apart left skin between them (short hair must reach past the next row's roots), and a row that
ran into the ear was skipped whole (split rows into the runs that are on the scalp). Measure the scalp covered
(SALON: at least 90 %) instead of judging it from one view.

## Shade hair by what's over it, not by the skin (2026-10-22)

The hair shader darkened hair near the skin (inner layers in shadow). Short hair lies near the skin everywhere, so a
crop's top, its outermost hair, came out black, and with the darkened scalp under it read as bald. The depth it
shades by is now how far a point is under the hair's outer surface (all the hair shown, round the skull's middle):
the outermost hair is lit however close to the skin it lies.

## Clear the signal before waiting for it (2026-10-22)

SALON's bake step clicked Bake and waited for the status bar to say "baked". A step before it now bakes too, so the
status already said "baked": the wait returned at once and the step read the earlier step's files (no physics lock, the
wrong vertex count). A test that waits for a message (a status, a file, a flag) clears it first.

## Restarting a server: kill the process that holds the port (2026-10-22)

After a change to serve.py the salon's server had to restart. The PID found first was a wrapper; killing it left the
old server running (started before the change) and the new one failed with "Address already in use", while the page
still answered, from the old code, which refused the new file. Check the running server's start time against the
change, kill that PID, and start the new one detached; then check the log, not just that the port answers.

## A check that measured nothing is a broken check (2026-10-22)

The Clip blend check counted 0 points over the base three times: first the test strand bowed out above the base (it
was never in it), then the test subtracted the collider object instead of its centre (NaN everywhere). It failed
rather than passed only because it asked for a minimum. Every measuring check states how many samples it measured
and fails on none.

The salon's bake was written as hair for Unreal on its own, and the user had to correct it: hair goes onto the
Character Studio's characters, and only finished characters go to Unreal. DECISIONS 2026-10-21 already said one app
for everything character, with the export to Unreal from it. Before building where a tool's output goes, read where
the decisions send it, and say the whole route (made, used, exported) back to the user.

An element's `hidden` loses to a CSS rule that sets its `display` (`.row { display: grid }`): the Character Studio's
Hair tab "hid" the style's rows for strand hair and they stayed on screen. Pages that hide with the attribute carry
`[hidden] { display: none !important; }`.

The bake preview's `let PREVIEW` was already the lock tools' placement preview: a second `let` of the same name kills
the whole module at load, and the salon came up blank with no status. Before adding a top-level name to a long page
script, grep for it (`\bNAME\b`).

## The eye is a picture problem, not a mesh problem (2026-10-23)

- **Don't fix the eye by moving the shell's vertices or cutting the skin around the eyeball.** MHR's eye region is too
  coarse: conforming the lid vertices onto the eyeball sank the eye and left shards of lid over the iris, and cutting
  the skin per pixel in front of the eyeball with a darkened socket read as a hole. Both were dropped. The way the
  user chose: they pick the eye's vertices themselves and the eyeball's picture is projected onto them.
- **A wide cut deletes what sits after it:** cutting from one `def` to the next `def` also took the module constants
  between them (`HAIR`, `SALON_FILES`): the server ran and failed on its first request. After a cut, `pyflakes` the
  file before restarting.
- **An eyeball grown from its front still widens to the sides:** pinning the pupil keeps the front in place, but a
  23 mm sphere reaches past the eye's corner and out of the temple. Drawing the eyeball only through the opening (the
  cut triangles into the stencil, the eyeball where it's set) lets it grow freely. And the eye plane (the eyeball's
  paint projected onto picked vertices) was rejected by the user too: a real opening with a real eyeball reads better.
- **Replacing a prefix of a line moves its tail:** swapping the `DP[...]` part of a line that also set the normals put
  `DN[...] = NP[...]` after the new line's comment; every normal was zero and the body rendered black. Replace whole lines.
- **Cutting along MHR's triangles leaves teeth:** its lid edge is a few long thin triangles that poke into the opening
  on one side; whichever rule picks them (the middle inside, all corners inside, two corners inside), some side gets
  teeth. Cut per pixel in the skin's shader along MediaPipe's smoothed outline instead, and draw the eyeball over what's
  inside the opening (MHR's lids fold inwards, in front of any eyeball). Measure it: the head's inside in magenta, the
  magenta pixels counted over sixteen poses, front and three-quarter.
- **Where a measurement can't settle a look, hand the user the control:** three tries at the lower lid's cut (a fixed
  drop, tapered, even) each left a step somewhere on one face. The eyelid line as sliders, with the line drawn on the
  face and a saved default, ended it.
- **A frame that's already open doesn't see new data:** the Hair tab saved the body every visit, but the salon's frame
  only loaded it the first time (the address hadn't changed), so later body and face edits never reached it. Tell an
  open frame to reload (`__salon.refreshBody`), and check it with a second visit after a change.
- **Find a model's features by what its shapes do, not by landmarks mapped onto it:** MediaPipe's lid points sat
  3 to 4 mm inside MHR's sculpted lids, and no slider range fixed that well. The triangles MHR's own blink squeezes
  shut are exactly its eye opening (as jawDrop's stretched ones are the mouth's): their edge, walked as one loop, is
  the lid line, and it rides every expression.
- **A measure that adds geometry can fail where the render doesn't:** the gap test's magenta inner surfaces blocked
  the eye's stencil where the lower lid folds in (looking down), a line no normal render shows. Check a measured fault
  in real colours before fixing it.
- **Find a feature on the face its shapes were made for:** the lid line was found on the character's own face, so on a
  face bent to a photo (bigger, rounder lids) the blink no longer met, the squeezed strip came out a fragment and the
  cut was distorted. Found once on MHR's base face, each point a place along a mesh edge, it rides any shape or fit.
  And an additive expression made for the base face doesn't close a fitted one: the blink has to take the lids from
  the fit's own offsets to their common one as it closes. Test a feature on a fitted face, not only the bare one.
- **Find what makes a spike before smoothing it:** the baked hair's sharp tents looked like the bake's fault, and three
  smoothers in turn made it worse (easing curves cut into the skull or swung long strands out; flattening bumps
  flattened the roots' lift and opened the partings). Measured (bumps and corners per card, live against baked, every
  point kept against 8), the ring round the crown was in the styled hair itself, and only a few tents came from the
  thinning. What worked: keep points where a card bends, and press what stands out of the hair's surface in towards it,
  proportionally, eased along the card.
- **A mesh builder that assumes equal cards breaks when they aren't:** the cards' triangles were offset by `j * n * 2`,
  every card the same length; once the bake kept more points on some cards, triangles joined unrelated cards in long
  pale bands. Offset by a running count.
- **A throw in three.js's frame loop stops every frame after it:** `setAnimationLoop` asks for the next frame after the
  callback returns, so one exception (the handles read the normals before the first compose made them) froze the view
  for good. Anything new in the loop gets its own guard.
- **MediaPipe's points on MHR's base face aren't symmetric, the mesh is:** the jaw's angle came out 4.5 cm apart in
  depth between the sides. For anything mirrored, average each pair across the middle.

## Cloth over cloth: measure what's under as a thickness, don't push off its mesh (2026-10-23)

The tailor's first layering pushed each garment off the ones under it with the closest point on their meshes. An open
mesh has no inside: at a hem, a waistband or a lifted pocket the closest point's normal points anywhere, and the
t-shirt over the pants came out in a ruffle at the waist. Measuring the garments under it as a thickness over the
body (how far out they reach above each point of the skin) and starting the new garment's ease there fixed it, and it
was faster. Push only off closed surfaces (the body).

## Don't move cloth onto a curtain; let it bridge (2026-10-23)

Woohill's "hang" (below the bust the cloth may only fall, never follow the body in) ported as a radial push onto a
vertical curtain flipped the triangles under the bust: their normals turned over, and pockets lifted along them tore.
The same look comes from relaxing longer: smoothing along the normals with a push back out to the ease is a membrane,
and with enough rounds it spans from the bust to the belly by itself. Rounds are cheap on the coarse body (four times
fewer points, each round reaching twice as far), so relax there and split the triangles after.

## A walk finds its own leg (2026-10-23)

The tailor's push off the skin was slow for loose garments (a jacket 5 cm out: every nearest-point search grew to that
radius, 12 s a blazer). Walking the skin's mesh from where each bit of cloth came from made it 15 times faster, but a
walk stops at a local nearest: between the thighs the trousers found their own leg while the other was closer, and
1% of the shorts went under the skin. One proper search at the end didn't fix it (pushed off one leg, the cloth landed
in the other's clearance). What did: find up front the points another part of the body comes near and search properly
for those every round; walk the rest. Run TAILOR on all five bodies before calling a speed-up done.


## Cloth's skin weights: a smooth function of place, the same width for every layer (2026-10-23)

Copying the closest skin point's weights onto each bit of cloth (its triangle's corners blended) looked exact, and a
sit gave the trousers' waistband a spike at the small of the back: over the spine's groove, points either side project
onto its two walls and the one on the line between takes weights of its own, then the bending back swings it out.
Blending wider the farther the cloth stands off was smooth but gave a shirt and the trousers over it, a few
millimetres apart, different widths and so different weights, and the shirt came through the waistband in a sit. What
worked: a Gaussian over the skin's points near the cloth, the same width for everything close to the body (wider only
for cloth that stands off, a skirt's hem). And before blaming the cloth in a deep pose, render the bare body in it: in
plain linear skinning the thighs swell up into the belly in a sit, and the cloth only follows.

## A full thigh crosses the middle (2026-10-23)

The tailor found the crotch as the first slice down with no loop across x = 0. On a full body each thigh's own loop
crosses the middle by a few millimetres, so the crotch came out 6 cm low (the clothes cut into the body there) or not
at all, and the desk's figure of the same body crashed the frame. A torso's loop reaches well to both sides of the
middle; a thigh's barely: count a loop as the torso's only when it does (and only there: the same test on the neck's
rows lost the neck on the desk's figure, and a collar came up over the chin). Test new body shapes at their extremes
(the full and slim ones in `tailor/bodies.json`) on the desk's figure as well as on the packed body: the figure
stands with its foot bones on the floor, not its soles, and the slices' `at(y)` that forgot the lowest point gave a
skirt the outline of a slice 2 cm off; under the chin, a slice cuts the neck and the jaw, three loops like an armpit's.

## A test that takes the first row breaks when the data grows (2026-10-23)

STUDIO's clothes step dyed "the first worn garment" denim and waited for the shirt to change: when the outfits got
their socks and shoes, the first was the socks, and the step timed out (and its drag looked for the shirt's hem from
the head view the skin and layer steps had left). Find a garment, a row or a handle by its name, and set the view the
step needs. Run STUDIO after changing outfits or designs, not only TAILOR. In a fresh container it needs
`python tools/face_mesh.py setup` and `libegl1` before its face steps run.

## A click that was done can still time out (2026-10-23)

STUDIO failed now and then on a step that had nothing to do with the change (the strand hair, then the procedural
skin): the log said `click action done`, then `waiting for scheduled navigations to finish` until the timeout. With a
heavy shader in software GL the page is too busy to answer Playwright's after-click check. The Studio never navigates
on a click, so the test's clicks pass `noWaitAfter: true`; a flake that moves from step to step is the test's, look at
its log before re-running it.
- **A tab that saves the body must wait for the body's face:** changing the body schedules a face re-fit (350 ms, then
  the worker); the Hair tab saved the body before it landed and the salon's head was 0.7 mm off. Entering the Hair
  tab now runs a pending fit at once and waits for it.
- **Measure a lens's barrel on a lone straight line, not a grid** (UltraVHS): following the darkest pixel down a
  checker grid slips onto the crossing lines and fits k twice too big. A chart of vertical lines only, each traced in
  a narrow window, gives k back exactly (0.085 in, 0.085 out).
- **A jaw from the face's points follows the lips, not the bone:** fitting a rigid motion every frame to the points
  jawDrop carries turned the teeth 27° on a pucker and 14° on a lip roll: the lip shapes move those points too. The
  jaw is now fitted once to each of MHR's jaw shapes alone and mixed by their weights, so only jaw shapes move it.
  The check that it rides the jaw compares the jaw's own points carried by the teeth's motion, not one landmark: the
  chin and the lower lip are on different lever arms and drop more than the teeth's tip.
- **Cut an opening along a smoothed line, not along triangles** (the mouth, as the eyes already were): the teeth first
  showed through MHR's membrane triangles, which missed the lips' inner corners (grey wedges across the mouth in a
  snarl) and left a jagged edge. Growing the triangle set by stretch either left slivers or ate into the lips. The lip
  line is now the seal's points (upper or lower by how far the jaw carries them), the upper lip's lowest edge and the
  lower's highest, sampled corner to corner and smoothed, cut in the skin's shader, a dark bag behind it.
- **Try the presets before engineering around a test pose:** the "flap" in a pout was a full pucker stacked on a 0.6
  funnel, a pair no preset makes; MHR folds the lower lip out over itself there. Two cut changes didn't remove it
  (it is the face's own geometry, with nothing behind it). The fix is a pairing limit on the weights (`paired()`), the
  place mocap goes through too.
- **An opening counts from rest:** MHR's lips overlap at rest (the lower one ~1 mm up inside the upper's curl), so the
  seal's reach read as 0.6 mm open with no expression, and the first lower-lip curl parted the lips and showed the
  teeth at rest. The opening is now what the seal reaches beyond its reach at rest; what's between the lips at rest
  is the lips' inside, not the mouth.
- **The painted iris isn't the Iris size on a grown eyeball:** the eye painter shrinks the iris's angle when the eyeball
  grows (it keeps its real size), so a check that looked for the iris's edge at the slider's angle sampled plain
  white. Measure where two paintings differ, not where a setting says the feature is.
- **Wait for what a step is about, not its first sign:** a new character's name shows as soon as it starts loading; its
  look is applied (and saved) only once loading is done. The check that read the look on the name saw the old values.

## A state that's already true isn't a wait (2026-10-24)

STUDIO's accessories step reopened the character and waited for its four accessories to be drawn: they already were,
from before the reopen, so the wait passed at once, the cleanup ran while the character was still loading, and the
loaded file put the four back (the save the step then waited for matched the last save's word, "saved"). Before
waiting for a state an action brings, take it away first (clear the drawn accessories, clear the status line), then
wait for it to come back; and read the file to check a save landed.
- **Two headless browsers at once starve each other:** PLAY failed on its second step ("the play clock stopped") while
  STUDIO ran beside it: on the cloud's software GPU each frame took so long that the game's clock barely moved, and a
  wait on it timed out. Run the browser checks one after another. Even alone, a long run slows as it goes (the locker
  late in PLAY draws 2 frames a second), so every wait on something the game does has a 60 s bound, not 10 or 15.
  PLAY's triggered scene (sitting on the second chair) still waited 5 s for the scene to take over and missed once
  after a long TIMES run; it passed alone. It has the 60 s bound now: a short bound proves nothing about speed here.
  Later the locker step missed its 60 s once, again right after TIMES, and passed alone: run PLAY first and TIMES after
  it, with nothing else between.
- **cannon-es mixes two bodies' own friction and bounce only when both have a material** (else the world's default
  contact is used): a physics kind's `friction` and `bounce` would do nothing against the floor, so the level's static
  bodies have one too (friction 1, bounce 1: the product is the thing's own). Found by reading its narrowphase before
  tuning a plushie; read how an engine combines settings before tuning them.

## Lay a necklace on the body itself, not on a model of it (2026-10-24)

The first necklace fell through the body: its collisions were a stack of polar slices (the outermost skin by angle
round each slice's middle), and near the chin a slice holds the jaw too, so round the neck it measured 77 cm; with the
start fixed it caught on a saddle the slices invented and hid under the jaw. A narrow-band distance field built from
the mesh's own triangles (4 mm grid, a band either side of the skin, signed by the nearest triangle) gave the drape at
once: the back on the nape, a V down the chest. And a ring round the neck is found from the neck's middle outward (the
first skin met), not from outside inward: on a short neck the shoulders stand further out than the neck at the same
height, and a ring found from outside goes round them. When something lies on the body, test it against the body's
triangles; a simplified shape is wrong exactly where things touch.
- **Pick a character only once the list is in:** a probe set the character picker before the page's own list had
  loaded, so the pick was lost (the page opened "no one", then the first character), and the accessories it put on
  were wiped when that load finished. The Studio's `open()` now stops at its next wait if another character is
  picked meanwhile (an earlier load could also have finished last and saved the wrong character's state over the
  new one); a probe waits for the picker's option before choosing it.
- **A distance along a mesh's edges draws polygons:** the nails measured from the fingertip along the skin's edges
  (Dijkstra) came out as hexagons, its rings following the edges' directions. A straight coordinate along the finger
  is smooth; what was wrong with it was only where the nail ended (on the tip's curve, so the free edge wrapped over
  the end): the end moved 2.5 mm back, the outline stayed smooth. Fix the parameter before the method.
- **A sparse fabric on a small garment is a pattern of dots:** the stockings' lace (a fine net, mostly holes) on a bra's
  7 mm straps and small cups read as dotted outlines, and nude lace on skin as nothing. Lingerie got solid fabrics
  (silk, satin, velvet, jersey); the lace stays for the legwear it was made for.
- **Scale the body, never the road:** the desk's forward kinematics scaled every joint by the cast member's height,
  the blocking's travel included, so Mari (1.62 m on a 1.70 m skeleton) stopped 5% short of every mark, and where a
  Kimodo walk (whose travel was added after the scaling) met blocking she slid 22 cm. Walk a whole scene frame by
  frame and print the biggest jump of any joint (and which): it found this and the blocking's stride switching off
  in one frame (a foot 41 cm), neither visible in a still.

## `node --check` passes a broken ES module (2026-10-25)

The desk's files are ES modules with a `.js` name. `node --check file.js` on one of them exits 0 even with a syntax
error in it (a bracket too many in app.js passed it; the browser refused the page: "Unexpected token ')'", nothing
drawn). Check them as modules: `node --experimental-default-type=module --check file.js` (or import the file), and
load the page once after an edit.

## The desk's second tries (2026-10-25)

- **Focus a box the moment it opens:** Ctrl+K's search took its focus 20 ms after opening, so the first keys typed
  straight after the shortcut went to the page. A box that's typed into is focused synchronously, in the same call
  that opens it.
- **Never await the Watch from a probe's evaluate:** `window.__dd.watch()` runs until the playthrough ends, so a
  probe that awaited it inside `page.evaluate` waited forever. Start it without awaiting, then poll for the state
  wanted.
- **Give a lazy picture its size:** the guide's links landed above their sections, because its lazy images had no
  width and height until they loaded, so everything below moved after the jump. Every `<img>` carries its size
  (GUIDE writes them).
- **A simulator that only goes forward answers the present:** life.js `States` advances its timers to the time it's
  asked about; asked about an earlier moment afterwards, it answers with the present (the kettle was already off
  when the test asked what it was at 6 s). Ask in time order, or snapshot and restore.
- **The Watch plays scenes with no run:** a scene previewed alone (TIMES does it) has `RUN` null, and reading
  `RUN.secs` at the scene's start threw. Whatever a scene reads from the run at its start is guarded.
- **Effects are never in a ray's way:** the stage's right-click on the kitchen table found nothing, because the
  steam over the tea on it (a `Points` cloud, whose ray threshold is a whole metre) was hit first and read as a
  wall. Everything lifefx.js makes gets a no-op `raycast`, so a pick, a drip's floor and Play's cursor go through it.
- **Click the desk by selector, not by a handle held across a wait:** GUIDE's quick task failed one run in three
  with "Element is not attached", because the live check redraws the side panel a few seconds after an edit (the
  step before had edited), and the button held was the old one. `page.click(selector)` finds it again.
- **The desk's stage draws when asked:** GUIDE's first pictures of the kettle and the tea came out as the free
  camera's wide default, because the camera was moved from a script and nothing drew it again. Moving the camera
  from a probe, call `camera.updateMatrixWorld()` (a pick reads it) and `render()`.

## The Studio's body in a T-pose, and a flat belly (2026-10-25)

- **A sculpt field is smooth, or it shows:** the first Belly pressed whatever stood in front of a flat line back onto
  it, point by point: flat side-on, but from three quarters the middle sank between flanks left standing, ridged where
  the press let go. Read every centimetre and joined by straight lines, every joint then caught the light as a band.
  A field is smooth over the body (whole in the middle, easing out to the flanks) and between its samples (a
  Catmull-Rom curve through samples 4 cm apart).
- **Wait for the body before measuring it:** a probe that read the Studio's body two seconds after the page loaded
  found it all zeros (its first compose hadn't run), and a working pose looked broken. Wait until POS holds a body.
- **Plain skinning opens the armpit's fold, it doesn't tear it:** raising MHR's arms 48° stretches a few 5 mm edges in
  the A-pose's crease five times and turns a handful of tiny triangles over on the fullest body, all out of sight;
  giving the collarbone a share of the lift barely helped and shrugged the shoulders. Check for tearing (an edge
  longer than any at rest, triangles turned over) and look, rather than guess a stretch limit.
- **STUDIO's ONLY picks steps by any word in their names:** ONLY=pose also ran the teeth ("every speech pose") and
  the eyes ("filled in every pose"), and the eyes failed for want of the face fit the skipped picture steps make. Pick
  by words only the wanted steps have, with the steps they stand on, or run it all.
- **Switch a feature in a check the way its control does:** STUDIO's nails turned them off with `nailLook()` alone;
  the Nails checkbox calls `skinLook()`, which also takes the skin's coat off. Off the check's way, a coat of 1 was
  left on the whole skin, a highlight the old view's sample missed and the T-pose's view from above caught, so the
  polish seemed to change the skin. It took three probes: the camera, the coat, then the switch.

- **Over-relax only one side of a one-sided constraint and the round-off grows:** the drape over-corrected pulled
  edges (SOR 1.5) and gave pushed ones half; from rest a 1e-12 m error grew past a metre in 240 steps. Plain
  Gauss-Seidel stays at 1e-18. Find such things by starting from rest with nothing to do and watching the biggest
  move a step: it should stay at round-off.
- **A bending stiffer in a step than the points it moves are heavy, after the lengths and carried on as speed, buzzes
  for ever:** the skirt's 5 mm wool flipped 1.6 mm back and forth every step at rms 15 cm/s through the strongest
  damping. It's an instability, not a slow settle: each point's step-to-step moves alternated in sign. Capping the
  bend's compliance at the points' own inverse weight (`alpha >= sum w k^2`) stops it; more steps only slow it.
- **Cloth that gives way when pushed shrinks instead of folding:** with compression at 4% of stretch an A-line
  skirt's hem drew in ten centimetres; at half it folds, as cloth does.
- **A worker's two answers to one job need the job's inputs until the last:** the Studio dropped the body the clothes
  were cut on when the cut came back, so the hung clothes that followed were shown unposed (the A-pose's sleeves on
  T-posed arms, looking like funnels); keep it until the job's final message.
- **A field read at the nearest vertex is a staircase, and a point on a step flips:** the drape took the layers'
  height under a point from its nearest skin vertex; two neighbours 6.5 mm apart (a tucked shirt's edge) made a point
  beside a held waistband jump between two floors every step, 5 mm each way. Read it across the closest triangle.
- **Measure the layers under a garment the same way where it's cut and where it hangs:** the drape spread the clothes
  under it wider than the cut had, so a blazer cut to fit started 5 cm under its own floor and was shoved out, its
  edges stretched to double. Count the points that start under the floor before blaming the solver.
- **A loose sliver falls for ever:** the cut can leave a few points on their own where an opening meets a hem; nothing
  holds them, so they fell 2.7 m and kept the drape from settling. Hold what nothing holds.
- **More cloth between two held edges only creeps:** sleeves cut fuller between the shoulder and a held cuff buckled
  so slowly that their end state depended on when the drape stopped (19 mm). Compare two runs of different lengths to
  tell creeping from settled.
- **A bake's key is everything the result depends on, what comes after it too:** a top's drape is held where trousers
  put on over it later close round it, but its key named only it and what was under it, so a t-shirt baked alone came
  back untucked under trousers (10.6 cm off) and the trousers were cut over it. Test a cache by changing each input on
  its own and asking whether the key moves.
- **Layers sag on each other:** a jacket cut over a shirt's hung sleeve, which already hung 2 cm below the arm, and then
  hanging itself, ballooned from the elbow down (7.9 cm off the skin against 3.6 cut). What a later garment closes
  over is held there, as a tuck is. Measure each layer's stand-off from the skin, cut and hung, before tuning the outer.
- **Two projections that can't both be met, each run once a step, pump each other:** the drape bent toward flat once
  after the lengths; on a sleeve (a tube can't be flat) each undid the other and the difference became speed, so a
  cardigan rocked 6 mm at the elbows at 18 mm/s through the strongest damping, at some stiffnesses and weights and
  not others. Damping only moved the band. In each pass together they settle everywhere. Find it by switching one
  thing off at a time (friction, compression, tethers, bending) and by mapping the stiffness and the weight, not by
  tuning the one garment that showed it.
- **Compare a garment against itself only on the same cut:** a drape run longer for a whole outfit re-cut the
  garments over it (the layers under them hung differently), so their points no longer matched by index and the
  comparison showed 35 cm moves and a NaN that weren't there. Hang the layers under it once and vary only it.
- **Measure a limb's thickness round its own middle, and check the result against the rig:** the tailor found the
  wrist as the thinnest place by distance from the arm's straight line; a forearm bent off the line seemed to thicken
  towards the hand, and on the new bases the wrist came out 6 cm either way of MHR's own wrist joint (long sleeves to
  mid-forearm on the woman, over the hand on the man), the elbow 14 cm down the forearm. Nothing checked where a
  sleeve ends. Each slice's radius round its own middle, pooled over its neighbours (a centimetre's slice of the mesh
  holds part of a ring and reads thin), and the wrist where the forearm's thin end gives way to the hand: within
  2.7 cm on every body. TAILOR now holds both to the rig.
- **A check's margin taken from one design is about that design:** STUDIO wanted a t-shirt at Fit 0 a centimetre
  nearer the body than as designed; tailored close on purpose, the designed one was already within 2.5 mm, and the
  step failed with nothing broken. When a design changes on purpose, ask what the step means (here: tighter, and
  nothing left to hang) before moving its number.

## Lashes over the lid's rim (2026-10-26)

- **A landmark line is where it was found, not where a thing grows:** the lashes were rooted on MHR's lid line, which
  runs along the rim's back edge (where the lid meets the eye: the strip the blink squeezes shut), and sent straight
  out. The rim is rounded and 2.4 mm deep, so every lash's first 3 mm ran under the skin and a band of bare skin showed
  between the eye and the lashes. Slice through the lid and look where the line sits before rooting anything on it.
- **A straight way across a rounded rim goes under it:** the first fix sent the lashes along the chord from the line to
  the rim's front edge; the rim bulges over the chord, so they were still hidden in its middle. Cast rays out through
  the skin a third and two thirds of the way, and keep each point a little off it.
- **A window along a sparse mesh is ragged:** the front edge found within 1 mm along the lid jumped between MHR's
  points, a few millimetres apart there, and the lash line zigzagged. Look 2.5 mm either way, take the part along the
  lid off, and smooth along it.
- **What sits right on an open lid needn't on a shut one:** the way over the rim kept as the eye shut smudged a dark
  band down the closed lid (the rim turns down and away); fade it with the opening.
- **A band's texture runs the way its strands do:** the lash line drawn with the atlas running along the lid showed its
  strands as blocks; across it, they read as short roots.

## The T-pose's neck (2026-10-26)

- **Check the rule, not a stand-in for it:** "the head untouched" was checked as "nothing above 88% of the height
  moves"; standing the neck up moves the skin under the jaw and at the nape (partly on the neck's bones), and POSE and
  STUDIO failed with the head itself untouched. They check the points on the head's own bones now.
- **Joints built down a chain differ from the ones they came from by a rounding:** a check that the head's joints
  hadn't moved compared them exactly and found eleven "moved" by 1e-17. Points copied as they are compare exactly;
  joints, within a tolerance.
- **Match the reference, not only the textbook:** with the head's joint 3 cm ahead of the shoulders the ear was already
  over the shoulder's top (the plumb line of good posture), yet the neck's front, under the jaw, still leaned 17° where
  the user's reference leans about 8°, measured the same way on both pictures. 2.2 cm brought it to 14°, and the
  squeeze it adds under the chin looked smooth from below before the check's limit moved.
- **Give a long check its own time:** STUDIO takes about 50 minutes here; run under a 30-minute `timeout` it was killed
  at its 22nd step with nothing wrong. Run it with an hour and more, or by ONLY for the steps a change touches.


## The eye in a file (2026-10-26)

- **A stencil hides what depth shows:** the Studio draws an eyeball only through its opening, so it could stand up to
  3 mm proud of MHR's lower lid and nobody saw; exported, with only depth, it showed through the lids all round. Before
  carrying geometry from one renderer to another, find what a trick in the first one was hiding.
- **Move the soft thing, not the round one:** pushing the eyeball's points back behind the lids dented it in steps
  along the lid (each triangle across the lid line half pushed, half not). Real lids lie on the eye: bring the skin
  forward onto the eyeball and keep the eyeball whole.
- **Displace where a mesh's pieces meet, then blend:** lifting each corner of the cut skin on its own took the cut's new
  corners off their neighbours' straight edges, and a flat triangle between points lifted onto a sphere still dips under
  it in the middle (patches of eyeball under the eye). Lift MHR's own points, sample each triangle and raise it by the
  most it dips, and blend the lift into new corners like their positions.
- **A cut by a 32nd of a triangle still steps on a long sliver:** the shut eye's strip has triangles 20 mm long, and
  their pieces kept or dropped whole zigzagged the lid by half a millimetre. Cut the last pieces along the outline's
  own edge.
- **Smoothing a sharp corner can tie it in a knot:** MHR's own left inner corner, smoothed by Catmull-Rom, crosses
  itself; the even-odd cut counts the little loop as opening, and every character had a diamond of eyeball at that
  corner, in the Studio too. Check an outline for crossings; pull a small loop to where it crosses.
- **A body that misses its marks may miss them by definition:** the desk's check had a Studio body 6 to 7 cm off the
  blocking's head and hands, and the desk's own MHR body is off by as much (the previs skeleton's joints aren't MHR's).
  Measure the reference before setting a limit; compare against it.

## Iris patterns (2026-10-26)

- **Put a pattern beside its reference before measuring it:** the first sunburst was a solid blob with a jagged edge,
  the first lightning wandering cracks, the first crypts a ring of dashes. Each passed what a check would ask (the
  accent shows, it differs from the plain iris) and none read like the user's pictures. Rays need gaps, a taper and a
  colour running from root to tip; streaks run out from the pupil, nearly straight; crypts read as an iris only with
  the fine strands between them and a pale collarette.
- **A restarted machine keeps its files, not its servers:** after a reboot the test characters and MediaPipe's setup
  were still there but neither server was running. Check the ports before blaming a test.

## Anime lashes and the painted liner (2026-10-26, night)

- **A band "up from a line" breaks when the surface turns:** the liner was first painted as the skin within a liner's
  width up (the face's up) from the lashes' roots; on a shut lid, whose skin runs forward, that took a slab of the lid
  and showed its nine segments as flat plates. Bound a band by two lines found on the skin instead (the roots, and the
  skin a width out from them by rays): between two lines the distances to them add up to their separation, outside they
  add up to more, whatever the pose.
- **Check that the layer you're tuning shows at all before tuning it:** the liner at 1.0 with loud test colours showed
  only two specks at the corners, because the lid line it followed lies under the lashes and the eye's cut. A picture
  with every makeup layer at full strength in a colour of its own finds that in one look.
- **`out` is a GLSL keyword:** a float named `out` fails the whole skin shader (the Studio draws nothing but the eyes
  and the hair); the error names the line.
- **Hair is hairs:** lashes built as a few dozen cards of clumped strands read as solid wedges however they were
  clustered, and no amount of tuning the clusters fixed it; the user's reference is hundreds of fine hairs. One thin
  card per hair with a single soft-cored strand on it (its own atlas) looked right at the first render. Count the
  things in the reference before building them.
- **A helper's name taken by a setting:** the lashes' Criss-cross slider was called `cross`, the module's vector
  product too; renamed, the definition was missed and only the calls renamed (a regex on `cross(` doesn't match
  `const cross =`). Rename the definition first and let the syntax check find the calls.
- **Swing round the right centre:** the lashes' turn with a blink was first measured round the eye opening's middle (the
  outline's centroid, in the lids' plane): a lid that drops 5 mm past it swings 100° and the lashes folded into the
  cheek. The lids turn round the eyeball's middle, a centimetre behind: 31°. Anything that rotates with a lid pivots
  there.
- **A band of sparse strands shows what's under it:** the lash line drawn with the lashes' strand atlas (one soft hair
  to a cell) was mostly see-through, and skin showed between the roots. A root line wants its own texture: opaque along
  the edge, ragged only where it ends.
- **Check that a crossed card actually crosses:** the second lash card's width ran along the lash itself (the cross
  product of the first card's normal and the lid's tangent is the lash's own direction), a sliver that showed nothing
  from the side. The second card's width is the first card's normal.
- **Turn the root with the margin, the hair with the droop:** the extra droop a shut lid's lashes want was applied to
  the whole frame, rim included, and the roots swung below the seam onto the lower lid. What grows from the margin
  turns with the margin; only the hairs' own direction takes the droop.
- **Everything painted on a moving lid should take the same frame:** the painted liner found its lines by rays on the
  lid as it is now, which on a shut lid's bulge put a dark patch up the lid while the lashes (from the open lid, swung)
  sat at its edge. One frame for all of it: the open lid, swung with the margin.
- **A soft strand goes grey when it's small on screen:** the lash atlas's Gaussian core, mipped down to the few pixels
  a lower lash covers, spread its alpha over the whole card: a wide grey ribbon, not a hair. A strand that must read at
  a few pixels wants a solid core (alpha 1) with a texel of soft edge, and a tip that thins but stays black (the card's
  own taper makes the point); let the geometry taper, not the alpha.
- **The lower lid's margin faces up, the upper's faces down:** laying the lower lashes over their margin from the eye's
  edge (as the upper ones are, which hides the upper waterline the way a real face does) ran each lash toward the
  viewer and then down: an L from the front. The lower waterline shows in a real eye; root the lower lashes at the
  margin's front edge.
- **Hairs side by side are a comb, not a thicker hair:** a lower lash made of three nearly parallel hairs read as three
  thin lines with gaps, whatever their spacing. One hair, wide enough to cover a pixel and a half, reads as one lash.
- **Fading a measurement to nothing where it's unreliable puts the thing at zero, which is also wrong:** the rim the
  lashes lie over was faded to nothing at the corners because the search there picked the wrong skin; at zero the
  corner lashes rooted under the skin and the lower roots jumped to the eye's edge. Fix the search (square to the lid's
  own line, far picks dropped) and fill a gap from its neighbours; never fade to a value you know is false.
- **"Away from the centre" is not "out of the opening" at the ends of a slit:** from the eye's middle, outward points
  along the eye at the corners, where the margin still runs across the lid and a lash still grows across it. Square to
  the line, oriented away from the middle, is the direction that means out of the opening everywhere.

## Merging the eyes and the lashes (2026-10-26)

- **A check proved on a subset of steps isn't proved on the run:** the refraction step passed in every run of the eye
  steps alone and failed in the full run, after twenty steps had dressed the character (draped clothes, hair): with the
  cornea's coat off it still read a bright pixel in the iris, the frame most likely drawn before the shader that lost
  its coat had recompiled. It now waits for rendered frames and measures the eyeballs alone. Run the whole check once
  before calling a new step done.

## A test's root above the crown's top misses from a level view (2026-10-26)

The salon's radial field overestimates the head's radius at its pole (the top bins are filled from their neighbours),
so `COL.surface([0.03, 0.14, 0])` sits a centimetre above the skin. A camera from below (the reference's frames) looks
up through it into the head and the click lands; a level front view's ray passes over the crown and nothing is hit.
Three steps "failed" on it. Put a test's root where the view sees skin (the front of the crown from the front), and
when a click lands nowhere, check the ray against the mesh before the tool.

## Buttons over the view steal clicks (2026-10-26)

The salon's view buttons sat over the top of the view; a test's end click on the forehead, seen from below, landed on
"Side L" and turned the head instead of placing the sheet. Anything that floats over a canvas takes the clicks under
it: keep bars in the header or the panel, and keep only what must be in the view (the tools' column, OK by the arrow).

## The second reference's lash sets (2026-10-26)

- **A sculpt near an opening measures from the opening's own line, never from MediaPipe's ring:** on MHR's face the
  upper ring sits 2 mm below the line the eye is cut along, so Hooded lids, kept still for an eighth of the way up from
  the ring, still moved the opening's own vertices 0.3 mm and the lashes' rim with them. The sculpt is built now with
  the model's lid line (`buildSculpt({ lid })`) and nothing within 2.8 mm of it moves.
- **A height over a line is only as smooth as the line:** measured straight up from the lid's line, a point's height
  changed fast sideways where the line falls into the corners, and the fold turned twelve triangles over just above
  the outer corner. Measure from an envelope that can't fall faster than a set slope (its gradient bounded), fade a
  field out where it stops (no hard cut by depth or by the brow's gap) and count the triangles turned over.
- **Makeup under long lashes doesn't show:** the smoky plum looked grey-brown on the first render because its whole
  spread sat inside the 6.5 mm the glam lashes cover; sample the pixels where the colour should be before blaming the
  colour, and give a look the reach it needs (Eyeshadow size).
- **Measure the thing the style changes:** neighbouring hairs' lean differences barely told a criss-cross mink from a
  combed natural set (1.4×: the hairs in one cluster share a lean, so most neighbours agree); neighbouring clusters'
  mean leans did (2.6×).
- **A hard step in a makeup mask draws a line wherever the layer is still strong at it:** the eyeshadow's "above the
  lid's middle" and the wash's "nearer the lower lid" were steps; once the shadow spread wider they showed as straight
  lines across the skin beside the inner corner (found by sampling a column of pixels: a 20-level jump in one row).
  Ease every mask a layer can reach past.

## The clothes' edit mode and the designer collection (2026-10-27)

- **Radii carried round a middle that moved sink:** a shoe's heel cup took a forward section's radii as they were and
  blended the middles; on a tall boot the forward section's middle was 20 cm higher, so its radii round the heel's
  lower middle reached under the floor. Carry an outline as points and measure it again round the new middle.
- **A cropped top with long sleeves hangs lower than its hem:** the check measured a hem by the cloth's lowest point,
  and the sleeves' cuffs were lower. Measure a hem off the arms.
- **A shaft lofted from the foot cuts the calf:** the shoe loft's sections are planes along the foot, so above the
  ankle they wall off whatever lies behind the heel; a boot to the knee is cut as a shell with the shoe's line instead.
- **Lace with empty holes reads as see-through:** the reference's lace top was lined. An over-skin fabric needs an
  opaque twin (`laced`) for anything that isn't meant to show the skin.
- **A film on the body is the cheap preview of a cut:** the cutter's value on every skin point, drawn with its zero as
  the line, is a few milliseconds a garment and shows exactly what the tailor will cut; the cloth itself (relaxed,
  hung) is only for the bake.
- **A cut that hugs the body reads as knitwear, whatever the fabric says:** every structured garment looked like a
  cardigan until the cut bridged the hollows (more tension), the shoulders were built (a pad at each joint) and the
  drape kept the cut (memory, stiff bend, little slack). Fabric tiles can't make a membrane look tailored.
- **Judge a tile on the garment, not the swatch:** lace flowers at 7 cm were polka dots on a blouse, silk streaks were
  creases down a skirt, a satin sheen band tiled into blocks. Render the outfit before calling a fabric done.
- **"Loose" is not "open":** a blazer loosened by its fit still closed down the front and read as a long cardigan; the
  reference wore it open. Cut what's worn open open, and let the drape leave it so.

## What a shader draws never reaches a file (2026-10-27)

The Studio's skin, clothes and lashes looked right in the Studio and came out white on the desk: their colours were
drawn in shaders (`onBeforeCompile` uniforms, a `ShaderMaterial`), and glTF carries only a material's colour and maps
(GLTFExporter drops a ShaderMaterial without a word in the file). Check an export by reading it back and measuring what
a plain viewer would draw (STUDIO's export colours step), never by the Studio's own view. Anything new drawn in a
shader needs its bake (`albedo.js`) before it ships.

## A close-up says its size, and the check plays every answer that matters (2026-10-27)

The writers' room's first builds passed the story check and failed SHOTS: the plan's shot review frames a clip's whole
body unless the clip says its size, and an actor on a mark 0.65 m from the eye shows only a quarter of a standing body.
A first-person close-up names its shot (`mcu` at 0.55 to 0.9 m, `cu` closer) so the review frames the head and
shoulders, and its mark stands straight ahead of the eye (a mark offset sideways put the face 0.97 m away, an MS). And
the walker answered every reply by its sweep (the kindest, the cruellest, silence), so an ending decided by a middle
answer was never reached: a reply whose answer sets a flag a flag choice reads now plays each such answer on its own
path. Build a generated game through all of check_all (STORY, LEVEL, SHOTS) and the desk's own suites, not only STORY.

## A redraw on the first click eats the double-click (2026-10-27)

The writers' room's chart picked a shape or an arrow on mousedown and redrew it, so the element the first click landed
on was gone by the second: the browser's dblclick never came (an arrow couldn't be labelled, a shape retitled). Read a
double-click from the second mousedown (`e.detail >= 2`). And an autosave that redraws mustn't run over a title being
typed on the chart (the redraw replaced the element being typed in: `editing` holds it off); a blur that follows an
Enter must not finish the same edit twice. Test an editor through the gestures a person uses (a double-click, typing
after a drop, a box dragged with Shift held) in the view as it is after the steps before (a step that centres the view
moves what the next one aims at), not only by calling its functions.

## A wait in a browser test is counted in the slowest frames (2026-10-27)

PLAY's bed step failed twice at the same place ("not lying down", the eye at 0.71 of a 0.69 target): the lie-down is a
1.1 s tween that moves at most 0.05 s a frame, and a software GPU late in the run draws about two frames a second, so
it needed some 8 s of real time and the step waited 8. Nothing was broken. A test waiting on anything the frame loop
drives (tweens, fades, cards) gives it the run's slowest frame rate: 60 s, as PLAY's other steps do.

## A step late in a browser test may be in a new run (2026-10-28)

PLAY's pause-menu step expected the flashlight's row (picked up a few steps earlier) and found it missing: by then the
test had started a second playtest (the one that checks a new run starts from the story's level), and a new run starts
with nothing in the pocket. The menu was right. Before asserting what a step "already has", check whether a step since
began a new run; give the step what it needs itself (here `give("flashlight")` before the menu opens).

## An Esc sent to skip a scene can pause the play after it (2026-10-28)

PLAY skips the Watch's scenes by pressing Esc until play is back. Once (third run of the day, the step had passed twice)
the last Esc landed after play had resumed: on the software GPU's slow frames it arrived more than the runtime's 400 ms
after `go()`, so it was a pause, and the next step found the menu up. Nothing in the game was wrong. A test that sends
keys to get past something must check what its last key did once it's past (`scenesUntilPlay` now closes a pause it
opened), not only that it got there.

## Two browser suites at once, and a suite cut in half (2026-10-28)

STUDIO failed twice on the Character Studio's reference light, neither time because of it. The first run was cut off
at 23 of its 38 steps by the timeout I gave it (28 minutes: the whole suite takes nearly an hour on this box's software
GPU). The rest, run on their own with `ONLY` while PLAY ran beside them, timed out on a click whose element was already
visible and still: two headless browsers drawing WebGL on four cores starve each other's input. Run alone, the same
subset failed on the eyes: that step checks a face fitted to pictures, which two earlier steps (the front and side
pictures) make, and `ONLY` had skipped them. So: one browser suite at a time; a suite's timeout over its whole length
(STUDIO an hour); and `ONLY` only for steps that stand alone, else the whole suite.

## A count over a short window isn't a rate (2026-10-28)

PLAY's footsteps step compared the steps heard in 1.6 s walking and crouched and wanted fewer crouched. Both were
three: the first step comes half a stride in, so a short window rounds both rates to the same count. The steps were
right (0.52 s apart walking, 0.65 s crouched). Measure what's meant (the time between steps, from the game's clock),
not a count over a window that small.

## The stage's cast are figures, not objects (2026-10-28)

The cast's footsteps heard nothing on their first PLAY run: `stage.cast[id]` is a figure (its body, its head, its
motion), and the Object3D that moves through the room is its `.group`; the code asked the figure for `visible` and a
world position and skipped her. The runtime's `shelfSound` had made the same mistake since it was written, so a sound
placed at a cast member played from nowhere in particular. Anything that wants where someone is asks
`stage.cast[id].group` (or `headWorld()` for the eyes' height).

## A new way through a lock must leave the story's locks alone (2026-10-28)

The latch's first PLAY run found the front door's turn saying Unlock before anyone had turned it: the Pilot's arrival
slams the front door and locks it behind you (`door` `lock`), and a thumb turn that undid any lock would have let the
player walk straight out of the story. The latch now keeps its own lock (`latched`) apart from the door's: it locks and
unlocks only what it locked, and against the story's lock or a key's it won't turn. Anything new that opens, unlocks or
moves past something should first ask what else already holds it shut, and leave that alone.

## The key that closes a card keeps going (2026-10-28)

Putting the examined photo back with Esc paused the game straight after. The HUD's Esc handler (a capture listener,
first to run) closed the card and resolved its promise; the runtime's `modal` then set `busy` back to false in a
microtask, which runs between listeners, so by the time the same keydown reached the runtime's own handler the game
was no longer busy and Esc meant pause. Text cards closed with Esc did the same; the tests had always closed them
with the button. The runtime's guard for "an Esc meant for the scene that just ended" (`since`, 400 ms) now starts
when a card closes too. A key that ends one thing must be checked against everything else listening for it.

## A test that touches the story's things can change its ending (2026-10-28)

PLAY's new examining step looked at the Pilot's kitchen photo, and twenty steps later the walk out onto the porch
ended in "Mother's day" instead of the good ending: looking at that photo is the Pilot's secret (`found_photo`). The
step itself was fine. Before a test step uses one of a game's things, check what the story hears from it (`story.py
flow`, a grep for its id); use one nothing listens to (the answering machine), or give the step a thing of its own.

## An import inside a function hides the module's name everywhere in it (2026-10-28)

The desk's "saves kept" list (the toolbar's clock) had failed since 2026-10-26 without anyone seeing it: two branches
of the server's `do_GET` had their own `import urllib.parse`, which makes `urllib` a local name for the whole
function, so the history branch (on paths those lines never run) found it unbound, raised, and the server dropped the
connection. GUIDE's history step was the first to notice. The module imports it once at the top; a function never
imports again what the module already has.

## A second level at the same coordinates found the checks comparing across maps (2026-10-28)

TestRoom001 is the first game with two levels, and its annex sits at the lab's own coordinates (each level is its
own map, in Unreal and on the desk's stage). The level check then put the lab's cornices "3 cm into a wall of
annex_hall", and the shot review found an annex camera "inside corridor__wall_e4": both compared every piece with
every wall, whatever its level. Whatever compares two pieces compares them on one level; a new kind of story (two
levels, a set, a second floor) is worth one run of every check before trusting what they say about it.

## The reticle reaches a door from either side, so a test must say which side (2026-10-28)

TESTROOM's walk through the front door went the wrong way: the helper that stands the player where the cursor lands on
a thing tried the side north of the door first, and a door is in its wall's plane, so the reticle found it from the
lobby too. Walked "through" from there, the player went out into the yard. Through a door, a test stands on the side
away from the room it wants and faces it (`walkThrough(door, into)`), never where a search happened to stop.

## A station's last tick clears its list at once (2026-10-28)

The latch locked the front door, its task ticked, and the test waiting to see it ticked on the HUD never did: the
station's own `done` (`untodo` then `done`) had cleared the list in the same moment. A test hears what the story hears
(the runtime's events: `{type: "todo", id, state}`), not what's left on the screen afterwards.

## The software GPU and a big level: draw only what can be seen (2026-10-28)

Play in TestRoom001's lab ran at one frame a second in the headless browser (24 lights over 565 meshes, half a second
a frame with every light lit per pixel; the Pilot runs at three), and the game's clock moves at most 0.05 s a frame, so
a 40 s station took ten minutes. A smaller window or the simple view alone barely helped. What did: the simple view
leaves out the rooms the eye can't see through any opening in view (their props, floors, lights; never walls or
doors), thirty frames a second, the pictures the same to the pixel. Measure where the time goes (a render read back,
then with lights off, then far things off) before reaching for a fix.

## A list that's through before it's whole (2026-10-28)

TestRoom001's power station ended the moment you walked in: walking in ticked its first task ("Go into the power
room") and fired the beat that cut the power and put the other three tasks on the list, but Play ran a beat's actions
one awaited step at a time, so the station's `{"ticked": true}` beat heard the same event first, found a list of one
ticked task, and ended it. The story check never saw it (its walker runs a beat whole). Play now runs a beat's
instant actions together before the next beat looks (STORY_FORMAT §4), and the test room puts each station's whole
list on at its start, its later tasks ticking only once their moment has come (`all` with a flag). A `{"ticked": true}`
station needs its list whole before any of it can be ticked.

## The last tick cut its own beat off (2026-10-28)

TestRoom001's sofa and locker: "Sit on the sofa" ticked on `use: rest_sofa`, the same event that started the sofa's
beat (a scene, then the name box); the tick was the station's last, so the station ended there and the name was never
asked. The locker's "Hide in the locker" did the same to the look-away swap, and the run went on through the next scene
and the round's card while the test was still waiting in the locker. A station ends when its list is through, so the
task that closes it ticks at the end of the beat it's about (`{"tick": id}`), never on the trigger that starts it
(STORY_FORMAT §4); the story check now warns about it. The bed did it too, and so did the fuse, whose beat only slams
a door: there Play was wrong, the to-do list heard the pickup before the beats did, so the list ended the station
before the slam. Beats hear an event first now. The same day: a kit door's frame is a block spanning the doorway,
drawn only at its edges, and it caught the reticle, so a kit door couldn't be opened from its middle; Play's aim now
passes through hollow pieces.

## A retry with empty pockets (2026-10-28)

The full TestRoom001 run failed at the annex's fusebox ("Needs: Fuse") though every station alone passed: the death
in the round and its retry ("Return to") restarted the run from the round's checkpoint, and a checkpoint kept flags,
karma and counters but not the items or the little things' states, so the fuse from the vault was gone. A start
`--from` a station is given what the stations before it leave (LEAVES), so it never showed. A checkpoint keeps the
pocket and the little things now, and the test checks them after the retry. Run the whole room from the start before
calling it done: what one station leaves the next is only tested there. The full run's clock showed one more: the
kitchen's cigarette, lit from the start, burns seven minutes and keeps what it burnt (`keep`), so by the time a whole
playthrough reached the kitchen it was out for good and there was nothing to put out. A little thing a station is
about starts there (unlit, and lit as you come in).

## A number that belonged to one character (2026-10-28)

PEOPLE checked a Studio export's eye on the desk by its white being over 120 of 255. It passed for months on the export
the last full STUDIO run left behind; once a shorter STUDIO run left a fresh default character's export there, the white
came out 118 (with the skin light on or off: the eye isn't the skin's), and the check failed on a healthy eye. How light
a white is belongs to the character's paint and the light; the check now asks what makes an eye an eye: the pupil
dark, the white's lightest clearly over the lids' mean beside it (118 against 93). A test measuring a picture compares
parts of the same picture, not a number tuned on one run's leftovers.

## One budget for six walks (2026-10-28)

The story check walks a game six times (the kind, the cruel and the silent player, each missing every secret and then
finding them all), and all six shared one cap of 4096 paths. A conversation card whose answers go different ways (the
end, another card) multiplies the paths after it; in the Sample with one four-answer talk the first five walks took
759 each and the last, the silent player who finds the secrets, was cut at 301, silently: what it would have found
past that went unchecked, and an ending only it reaches would have read as unreachable. Each walk has its own cap now,
a walk cut short says so, and an ending no walk reached is an error only when nothing was cut. An answer is walked on
a path of its own only when its way differs from the sweep's (another card, or replies and events it skips); a skip
over plain lines is only time.

## Look at what fills a hole before reshaping it (2026-10-28)

The Studio's eyes vanished seen from the side. The eyeball is drawn only where a fan over its opening marks the
stencil, over whatever is inside the head (no depth test), and from the side that fan is nearly edge-on, so the first
two fixes widened where the eyeball may show: drawn again as a solid inside the opening's outline, then a fan domed
over the cornea. Each made the eye bulge out of the lids, which the user didn't want, and neither touched the cause.
Rendering the opening with its eyeball hidden and the fan coloured green showed it: from 75° the opening was full of
an eyeball all the same, the other one. Both eyes wrote the same stencil value, and seen from the side they line up,
so the far eyeball, drawn after the near one with no depth test, painted itself through the near opening; and where
the skin is cut deeper than the fan, a grazing ray slipped past the fan into the head and onto the other eye's. Each
eye has its own stencil value now, its fan is walled back to the cut and writes depth. Only then was the shape worth
working on: the user drew the mask they wanted (red, over our renders), and the fan became that mask made smooth, an
arch from lid to lid. When something drawn looks wrong, take parts away one at a time (colour the mask, hide the
object) and see what's left, before changing the shape of anything.


## A browser check in the cloud wants the machine to itself (2026-10-28)

The full STUDIO run failed 30 steps in: a click on the Head view's button timed out after 30 seconds. Nothing was
wrong with the page; the picture the failure left shows the button right there. CHECKS, DESK, CMDS and REFS were
running beside it on the cloud's four cores. SwiftShader already spends about a second on a frame there, and
Playwright's click waits for the button to hold still over two frames, so with the cores shared the wait ran out. The
same steps passed when the run had the machine to itself. In the cloud, run nothing heavy beside a browser check, not
even the offline ones. On the user's machine, with `GPU=1` (docs/RUN_LOCALLY.md), a frame is milliseconds and this
doesn't arise. Confirmed 2026-10-29: TESTROOM's typed-thought check went red twice in the cloud, once with nothing
else running, and passed first time on the 3090 in 3.2 minutes with the rest of the suite running beside it; the
thought's typing is paced by the clock and SwiftShader's frame was slower than a letter. A browser timing check that
fails only in the cloud is read on the card before anything is changed.

## A spot light projects only through its shadows (2026-10-29)

A SpotLight3D with a `light_projector` lit nothing: the wall under it went dark, with any texture, even plain white.
It lights again the moment `shadow_enabled` is on. Godot's projector sampling rides on the spot's shadow atlas slot,
so without shadows there is no projection and the light's whole contribution goes with it. HSPattern switches the
spot's shadows on itself and says so. Measured in the plugin's own project (`Saved/Godot/_lookplugin/`), five runs of
a ten-line scene: when a light does nothing, try it bare (no projector, no pattern) before suspecting the pattern.

## A projector that changes every frame doesn't show (2026-10-29)

The first HSPattern drew its caustics into a SubViewport each frame and made the ViewportTexture the spot's
projector. The renderer copies a projector into its atlas once, when it's added, so the light showed one frame of the
viewport, or nothing. The loop is drawn once at load instead, a frame a frame into plain ImageTextures, and the
projector is swapped among them (each copied into the atlas once). Anything the renderer atlases (projectors,
decals) wants a texture that stands still.

## A chain that waited for itself (2026-10-29)

A background chain began `until ! ps -p $(pgrep -f "lookshot.gd" ...)`: the pattern matched the chain's own shell,
whose command line held the words, so it waited forever, and three chains queued behind its logs waited with it.
CLAUDE.md's rule about `pgrep -f` and `pkill -f` covers `until` loops too: a chain that waits for a process should
wait for its log's last line, or for a PID taken from a variable, never for a name that is also in its own command.

## A Godot check that measured a different renderer and a different window (2026-10-29, the local run)

The first LOOKPLUGIN run on the 3090 came back with ten red rows and no error. Two things had gone wrong at once,
neither of them the plugin. First, the check set `VK_ICD_FILENAMES` to the cloud's lavapipe driver file, which doesn't
exist on the user's machine; the Vulkan loader then found no driver at all and Godot fell back to OpenGL, with a
warning in its output the check never read: no SSR, no volumetric fog, no compositor effects, no auto exposure, so the
wet floor, the shaft, the softener and the iris measured the same on and off. Second, with a display, Godot opened a
real window and Hyprland tiled it to 941 × 1030, so every measure's pixel box fell on another part of the picture (the
oil sphere's glint box measured a black pool). Now every Godot script sets the lavapipe ICD only when that file
exists, fails on Godot's "switching to OpenGL 3" line, prefers Xvfb whenever `xvfb-run` is there (the card still draws
through Vulkan under it, and no window manager touches the window), and the check projects are `resizable=false`
(a tiling manager floats a fixed-size window). The plugin check runs with `--fixed-fps 60`, so a stage's frame counts
mean the same seconds on the card as in the cloud. Two rules: a check that measures pixels must first assert the
renderer and the picture's size it measured in; and a stage that passed alone (`--only`) but not in sequence
(the sweep: its beam never crossed the camera's view, the alone run had another camera) was passing by accident.

## A browser check that passed only because the cloud was slow (2026-10-29, the local run)

PLAY went red three times in a row on the 3090, each time one step further, and each red was the check's own pacing,
not the desk's: the name box takes focus 30 ms after it appears and the card typed before that (the thought then said
the placeholder's name); after a crouch the eye rises over a second and `goTo` aimed from where it still was, so the
first tick after carried the reticle off the small thing; the kitchen's glimpse beat shows its thought 1.4 s after the
room's edge and the step looked 1.37 s after it. On SwiftShader every one of these had been hidden by the slow frames.
The fixes are in the checks (wait for the box to have the keys, for the eye to settle, for the beat's own time) and
one in the HUD (the box focused at once as well as after its timer). The rule: a wait in a browser check is for a
state the page can show (focus, a settled value, the clock past the beat's own sum), never for a frame count or a
guessed margin; and a check that only ever ran on a slow machine hasn't been run.

## A lightmap bake that worked by hand and baked nothing from a fresh export (2026-10-30)

- **The editor's file system has to know a folder before a bake writes into it.** LightmapGI's bake writes each
  light texture (`<data>.exr`) and asks the editor to import it; a folder made after the editor's startup scan isn't
  in its tree, so the import fails (`Can't find file ... during file reimport`, then `BAKE_ERROR_CANT_CREATE_IMAGE`)
  and the data comes out with no meshes. The export makes `game/lightmaps/` (with a README, so a zip keeps it), and
  the bake plugin rescans the file system if it ever has to make it.
- **The editor writes a LightmapGIData only at a scene save or at quit.** A level baked for several states (the times
  of day, the lamps on and off) on one LightmapGI would keep only the last; the plugin saves each state's data with
  `ResourceSaver.save` right after its bake.
- The story: the hand run baked 473 meshes because an earlier run had already made the folder; the first GDBAKE from
  a fresh export baked twice and registered none. The annex (a ten-second bake) was the quick test bench.

## Tool nodes in Godot's editor save, notify and instance by their own rules (2026-10-30)

- **Nothing added or freed inside a notification sent down the tree.** The pre-save and post-save notifications
  come through `propagate_notification`, which holds every parent busy while it runs: a leak node freeing its drips
  there failed ("Parent node is busy") and crashed Godot. Restore what's saved (a material, an energy) right away;
  free with `queue_free` and build again with `call_deferred`.
- **`EditorInterface.save_scene()` runs frames while it saves** (its progress bar): an EditorPlugin's `_process`
  that called it ran again inside it and saved again ("Task 'save' already exists", then an abort). Mark the save
  started before calling it, and return early while it's busy.
- **A plain script can't be instanced in the editor**, only its static functions called: a `@tool` node making an
  `HSRain.new()` needs `rain.gd` to be `@tool` too.
- **`surface_get_name` is ArrayMesh's alone**: a helper that matches surfaces by name must skip it for a
  primitive mesh (a SphereMesh stood in for a body and the skin's `wear` stopped there).

## The street builder's page (2026-10-30)

- **A captured pointer's click lands on the capturer:** the map captures the pointer on press (so a drag keeps going
  off its edge), so the double-click that opens a building's facade came to the SVG itself, not the building under it,
  and did nothing (STREETPAGE's first run). Find what's under the pointer with `document.elementsFromPoint`.
- **Encode a path, not its query:** a pasted photo's file is kept as `refs/b1_front.png?v=<time>` (so the browser
  reloads a new one); `encodeURIComponent` on every part of it turned the `?` into `%3F` and the server looked for a
  file of that name (404, the photo never showed). Split the query off first.
- **`hidden` loses to a `display` rule:** `#facadeBox{display:flex}` showed the facade panel under the map when it was
  hidden; `[hidden]{display:none!important}` at the top of the page's style.

## The street's Godot export and its insides (2026-10-30, later night)

- **Godot's glTF importer leaves vertex colours off the albedo:** the merged chunks carry each building's colour on
  their vertices (the page draws them so, one material a slot), and every wall came into Godot white (the probe:
  "vertex-colour albedo 0"). The export now gives each colour a material of its own on the same mesh. Measure the
  import (GDSTREET), never assume an engine reads a format as three.js does.
- **A strip that only touches another road's edge isn't crossed by it:** the curved streets' crossing test looked at a
  walk's very edges, and a lane ending on the cross street's pavement edge cut that pavement away across the lane's
  mouth (GDSTREET's ray onto the walk fell through to the ground). The points it tests sit just inside the strip.
- **Object.assign's order decides who wins:** a check built two buildings as `Object.assign({id, at}, base)`, so the
  base's own id and place overwrote both, and "the cache kept a changed building" was the test's fault. Defaults
  first, the thing's own fields last.

## The prop generator (2026-10-30, night)

- **An inextensible sheet squeezed only from outside stays flat in the middle:** the first paper ball came out a disc
  with a crumpled rim. A few random folds first (the sheet already a tangle in space), then a pull on every particle
  toward the middle as the sphere shrinks, and it crumples all through, like a ball of newsprint.
- **Paper laid down must not set new creases:** with the crumple's plasticity on and a cloth's soft bend, a note and a
  receipt wrinkled like fabric as they landed. Lying down springs back to the creases it has (a stiffer bend, no
  plasticity); only the fist sets creases.
- **A label's middle faces the front, the front is -y:** the first can showed its barcode. A lathe's UV seam goes at
  the back (+y), so the print's middle lands at -y, which the glTF export turns into the +Z front the kit uses.
- **Cache a font's outlines, never its Blender datablock:** a reset between recipes (`read_factory_settings`) freed the
  font and the next label failed with "StructRNA of type VectorFont has been removed". Check a cached datablock is
  still there before using it.
- **Overlapping V cuts are a union, not a list:** a key's cuts deeper than their pitch, written as points, folded the
  edge back on itself in loops and the cap tessellated to holes. Sample the edge as the deepest cut at each point and
  keep the corners.
- **Blender's Python module can crash on its way out:** `bpy` as a module exited 245 after every job had printed ok.
  The entry point leaves with `os._exit` once its output is flushed.
- **A Godot camera's look_at needs the tree:** in a SceneTree script's `_init`, a camera aimed before the first frame
  pictured only the floor. Await a frame, then `look_at_from_position`.
- **Look at the preview before the code:** the pizza box's lid "vanished" because, open at 38 degrees, it faced the
  camera edge-on; its geometry was right all along.
- **Run the tool on the user's Blender too:** the cloud has Blender 4.2's module, the user's Arch machine a 5.x. Under
  Blender 5.2's environment (Python 3.13, a newer NumPy) `np.cross` refused 2D vectors and a resting face pointing
  exactly down divided by zero; PROPGEN on both found them. Write 2D crosses by hand, and treat a dot product of -1 with
  a tolerance.
- **A segment's material wins over the mesh's list:** the liquid's lathe was given `mats=["liquid"]`, but each
  segment takes its island's material unless it names its own, so its faces went to the glass's slot (None in its
  object) and rendered Blender's default white. A mesh built for a material of its own names it on its segments.
- **See-through glass is mostly reflection, not white:** at 22% opacity on each of its four surfaces the glass washed
  a dark soy sauce out to grey. Clear glass at 10% (PET 12%), the look carried by the specular.

## The street in Blender (2026-10-31)

- **Cycles bakes one object at a time, each over the whole image:** 78 street meshes into one 4096 × 2112 atlas took
  over ten minutes for the first pass and never finished the three. A joined copy of them all bakes each pass once
  (1.5 minutes for all three), with the originals hidden from the render so the occlusion meets each surface once.
- **A GDScript function named after a global hides nothing, it breaks:** HSStreet's `static func convert(m)` lost to
  GDScript's own `convert(what, type)` ("too few arguments"), and since plugin.gd preloads the import step, the whole
  HorrorStudio Look plugin failed to load. Never name a function after a GDScript global (convert, str, load, print,
  range...), and import the plugin in a fresh project (GDSTREET --plugin) after any change to plugin.gd.
- **What lies flat on a surface mustn't shut its occlusion:** the road's letters are quads 4 mm over the asphalt, so
  the occlusion bake saw the asphalt under them as shut (0), and Godot, which reads the atlas as ambient occlusion,
  drew a black square round every letter where the paint is cut away. Road markings are now baked apart, out of the
  rays while what's under them is baked.
- **A seam test that compares the wrap with the average step flags every brick:** a tile set's period ends on a
  brick's edge, so the step at the wrap is a brick's edge, far above the average step inside. Compare the wrap with
  the biggest step inside (a texture that doesn't tile still fails it by 12 times).

## The prop generator's occult, kitchen and sinks (2026-10-31)

- **Never seed from `hash()` of a string:** Python salts string hashes per process, so the candles' drips landed in a
  different place every run and the same recipe stopped making the same mesh. Seeds come from `noise.rng(seed, ...)`
  or from an index, never `hash`.
- **Smooth normals over a big cap with only its rim's points shade in stripes:** a wax puddle's top was one fan of
  long triangles from its edge, each corner's normal tipped by the bevel beside it, and it rendered striped. Put
  points inside big caps (`fill`), and give hard surfaces normals weighted by face area (`th.weighted`), so a flat face
  shades flat whatever its bevel does.
- **A lathe's faces look to the right of its profile:** a pot's lid written from its middle out had its top facing
  into itself. Walk a top from its rim inward, and its underside, first, from the middle out.
- **Scale every part to metres at the same step:** the sinks' ring strips were built in millimetres and never scaled,
  so the basin came out a kilometre wide beside metre-sized taps, and the preview, fitted to the whole, showed no taps
  and no water at all. Build in mm and multiply by `MM` at the one place each part is made; a part 1000 times the
  others is the first thing to look for when something vanishes.
- **Rust is a few spots, not a coat:** the tetsubin's `rust` age at a quarter strength covered it in orange blotches
  like a leopard. Cast iron reads black; its rust goes in as small, rare patches.
- **A colour of your own must reach what's seen:** a liquid's `color` set only its body, so a mug of "green" tea came
  out the same brown as black tea: in an opaque cup only the surface (the back faces drawn flat at the level) shows,
  and its colour still came from the kind. An override sets every colour that's drawn, derived where not given.
- **A part fixed to a curved wall ends inside it, at its own place round the wall:** the pots' loop handles ended at
  the wall's radius straight out from the middle (x = R), but at their own angle round the pot the wall had already
  curved away by 3 mm, and the user saw the tubes' open ends poke out. Set an end by the radius at its angle
  (x = √((R − rod)² − y²)), and close a tube's ends.
- **A part laid on a curved body follows its curve, or sits where it's flat:** the rice cooker's panel was a flat
  slab tipped toward the viewer; its front edge dipped into the body's rounded front and the white showed through.
  Laid flat on the deck, it still overhung the deck's rounded corners. On the lid, bent to the lid's own dome inside
  its rounded edge, it sits as if it belongs there. Check a part's footprint against the flat region under it (inside
  the bevels and corners), not against the box.
- **GDScript can't infer a type from an untyped loop:** `for k in [...]: var key := "a/" + k` is a parse error in
  Godot 4.7 (the plugin's script failed to load in the editor, and only the editor's part of LOOKPLUGIN said so). Type
  the loop variable (`for k: String in`) or the variable (`var key: String`).
- **Cycles draws both sides of a face; Godot only its front:** the rice cooker's walls looked solid in every preview
  and were see-through in Godot (the user saw its bottom through its sides). `slab` walked its rounded edge from the
  top down, and a loft's band faces the right of its walk: out of the material only when it climbs. Seven other
  parts were inside out the same way unseen (caps lathed from the middle of their top outward, a lathe laid on its
  side by swapping two axes, which is a mirror, a capsule's profile walked in the wrong order, the drips' tubes, a
  clockwise outline extruded). Judge a mesh's faces by measure, not by a render that draws both sides: PROPGEN
  casts rays at every case from all round and fails when more than 1.5% of what they hit is a face's back
  (`check.orientation`). A mirror (an axis swap, a scale by −1) needs `M.flip` after it.
- **A set's order changes from one run to the next:** a few props' textures differed between two makes of the same
  recipe (the cigarette butts, the kettles, the sinks, the shimenawa). The paint was the same each time; the padding
  between islands wasn't. Before the padding is filled, each band that goes round copies a few columns past its edges
  from its far side, and in a gap narrower than two such margins the last band copied wins. The bands came from a
  Python set of names, whose order follows the strings' hashes, and those are seeded afresh every run. Walk things in
  a list's order (the islands' here), never a set's, when the order reaches the output. PROPGEN makes the butts (twelve
  bands side by side) again in a second process with another `PYTHONHASHSEED` and compares every file byte for byte;
  a make again in the same process can't see it.
- **An outline walked backwards across itself:** the fork's tines showed 1.2% of their faces from behind. Each tip's
  rounded end and each slot's rounded foot was walked from the far side to the near one, so the outline crossed itself
  in a bow-tie at every tine, and the slab there came out inside out (Cycles hid it again). Every arc in a closed
  outline turns the same way as the rest: test a new outline for edges crossing each other (none may) before it's
  swept.

## No clipping in the street (2026-10-31)

- **Fixing what a picture shows leaves the rest:** the bungalow's roof showed its wall tops (the eaves dipped below the
  walls' top, a lid's sides were in the walls' planes), but a sweep over every style, set, street and the check's own
  builds found some twenty more kinds of faces in one plane over each other, from a sign's words 2 mm off its board to
  a car park gate's two leaves in one place. Measure every piece the generator can make (the clash test is in STREET
  now), then fix by rule (a GAP between layers, parts 6 mm in), never the one case.
- **A plane's offset says nothing about two tilted faces far from the origin:** comparing `n·p` for nearly parallel
  faces 43 m out called a pole and its band 1.4 cm apart "one plane". Measure the other face's points from this
  face's own plane.
- **A minimum overlap per triangle pair hides an overlap split across triangles:** two rail posts at a roof's corner
  overlapped by 16 cm², in four pieces each under the 15 cm² the first test needed, and 1,836 of them passed. The test
  now counts a square centimetre.
- **Roofs per room over an L overlap everywhere:** their soffits (7 m² each) and slabs lay over each other. Roofs over
  an outline are joined: each cut where it's inside another's volume (a convex solid each; on a face of both, the
  first keeps it), and every roof a closed solid, so the cut leaves no hole.

## The paint page and the physical sky (2026-10-31)

- **three.js gives a texture its image only when it arrives:** a `TextureLoader` texture's `image` is undefined until
  then. The .glb export's wait for pictures looked for "an image not complete" and saw nothing to wait for, so every
  decal went out without its picture. Wait while a texture has no image, or an incomplete one.
- **A material's name carries what the bake needs to know:** surfaces coloured by vertex drop their look from the
  material's name, so the street-wide paint (asphalt, pavers) was baked with the old finishes. A painted set now
  stays in the name, and the bake reads it back through the colour's suffix. Read the bake's MATERIALS line after any
  change to naming.
- **A physical sky isn't calibrated by its defaults:** Nishita at strength 0.9 made the lane five times the photo's
  brightness. Measure (the median, the road, the sky's band, each against the photo) and scale the sky, not the
  exposure, so the shop windows and lamps keep their balance with it.

## The road's print floating (2026-10-31)

- **A layer lifted for the depth buffer casts a shadow that shows the lift:** the road's lines and letters stood 1.2 to
  6 cm over the asphalt (a GAP each, stacked), and under Blender's sun each cast a thin shadow beside it, so the print
  looked like a sheet floating over the road (the user saw it). Paint lies 5 mm up (over the clash test's 4 mm), a
  mark over another only where they overlap, and nothing that lies on a surface casts a shadow, in every renderer:
  check a close-up under a low sun after any change to how things are layered.

## Kit floors taking a material (2026-10-31)

- **What's drawn is the plan's piece, not the story's thing:** the stage built a kit thing from `p.d.kit` (the story's
  own spec), so a floor the plan had laid out by its set's cells (`p.kit`, with `cells`) was drawn with the kit's own
  pattern and each board a random cut: two grids, the painted seams across the real gaps. When the plan derives
  anything for a piece (a spec, a size, a tag), every drawer reads the piece (`p.kit`); the story's `d` is for what
  the plan doesn't touch. Check a derived spec by looking at it drawn, not only at the plan's JSON.
- **The .glb's `1 - v` is a metre in a set's UVs:** kit UVs are metres and the export writes v as `1 - v`, so Godot
  laid every set a metre off the desk's (invisible on random cuts, wrong on a floor laid out by its set). A material
  scaling metre UVs takes it back with `uv1_offset` (`-1 / tile`, mod 1).
- **A set's label isn't its contents:** "black marble" on the shelf is ambientCG's SurfaceImperfections020, an overlay
  with an opacity map, so on a floor the stage cut most of each tile away. Look at a set's maps (an `opacity` map is
  a cut-out) before putting it on a surface that must be solid.
- **After `openPreset`, wait for that preset's own plan:** the replan is debounced and async, and the last level's
  plan is still `B.plan`, so a test that only waits for "a plan" can aim its rays at the previous world.

- **A detail tile's size is metres of skin, not UV units.** HumanShaders' micro tile at 30 a UV unit was made for a
  head that fills its UVs; on MHR's shared layout (0.72 m a UV unit on the head, 1.9 on the body) it lay 2.4 cm a
  repeat on the face and 5.7 on the shoulders: the user's "pores way too large". Measure the layout's metres (area in
  3D over area in UV, per triangle) before choosing a scale, and keep one scale an island (a scale that changes
  across the skin squeezes the pattern where it changes: `uv * s(uv)` has `uv * ds` in its derivative).
- **A visible pore is 0.15 to 0.35 mm across**, not the 0.6 mm between follicles: the first tile's 0.09 mm pits were
  under a pixel at a close-up's 0.12 mm and nothing showed. Size a feature by what a camera sees at the shot's pixel.
- **Godot's screen-space scattering blurs the finished colour, paint and detail with it.** HumanShaders' strength (1.3 to
  3 within a metre of the eye) turned a face to wax and hid every pore the detail layer drew; picture a skin change
  with the scattering off once (`portrait_check.py --sss 0`) before deciding the detail is too faint.
- **Paint a shader's coordinates before trusting a direction.** The eye's layout runs +y down the eye, so the "upper
  lid's" shadow first fell on the lower lid; a debug grid (`fract(eP.xy * 2)` as the colour) showed it in one picture.
- **Godot's glTF importer lights an emissive texture** although glTF's emissive colour is black when it's left out:
  the salon's strand numbers parked in the emissive slot glowed as rainbow hair wherever HSHair wasn't on (the editor,
  GDPEOPLE's flat picture). Data rides in the occlusion slot, which only shades the ambient.
- **Godot's importer drops an unlit glTF material's vertex colours**: the salon's darkened scalp (its colour by vertex,
  unlit) showed as a white cap at the parting and the hairline in every game. An unlit material's colour goes in its
  base colour; the vertex colours carry only what can be lost (the see-through).
- **Name matching meets the character's own name**: `_hairbefore_skin` was taken for hair and `_hairbefore_eye_L` with
  it. A Studio export's parts are matched by their suffix first (`_skin`, `_eye_`), the words after.
- **A dithered coverage thins a strand narrower than a pixel to nothing**: the lashes vanished under the hair's hashed
  cut. Hairs lying on the skin keep the soft scissor.
- **Measure one part with the others out of the picture**: the pores' close-up started measuring the hair once a long
  cut fell into it (the grain ratio 1.16 instead of 1.76); the portrait hides the hair for that shot.

- **Shell normals on double-sided cards need the winding to agree.** A viewer turns a back face's normal round (three.js,
  Godot's own materials): with every card's normal the hair volume's, the cards wound into the hair lit their outside
  with a normal into the head (dark) and the rest caught the room's reflection as one grey sheen; the Studio's view of
  the new bake was worse than the old one while Godot's HSHair (both faces lit by the vertex normal) looked right. Wind
  each triangle toward its normal (`hairvolume.js` `wind`), and look at a change in every viewer that shows the file.

## Wide trousers and the creases' distances (2026-11-01, `clothing-refiner`)

- **A big offset along the skin's normals folds the cloth in a hollow:** wide trousers pushed 5 to 8 cm out along the
  normals folded over themselves under the kneecap (the normals converge there), a ledge round the knee in the cut
  itself, before any drape; giving each point its own top-up made it worse (the kneecap got little, the shin below a
  lot, and the offsets crossed), and freer smoothing didn't reach it. Second and third tries: relax with a small ease,
  then set the leg out radially from its line into a column (`legs.straight`, pieces.js); and the column's width from
  the median radius, not the mean (the buttocks' lobe under the crotch made the top rings bulge like jodhpurs).
- **A garment hung by gravity settles onto what it can touch:** the clean column fell 5 cm in the drape and wrapped the
  knee again, whatever its stiffness; pressed straight legs are held as cut from under the seat (drape.js holds).
- **Never store a shortest-path's distances in a Float32Array:** a zero-length edge (two points at one place) makes
  the float64 sum smaller than the float32-rounded stored value for ever, and the heap grows until node runs out of
  memory. Distances in Float64Array, an improvement only by more than a nanometre (crease.js spread).


## The clothing review (2026-11-01, `clothing-refiner`)

- **A per-slice fix needs carrying between slices:** a convex hull a centimetre, each slice's points snapped onto
  their own hull, left a ledge wherever the hull jumped (the kneecap appearing in one slice). Keep the hull as a radius
  per angle round a centre that moves smoothly, carry it up and down at a slope (the cloth can't come in faster than
  that), and interpolate between slices by height.
- **Tell left from right by where a point came from, not where it is:** a garment's leg columns lean in across the
  middle near the knee, so splitting the cloth by x put one leg's points in the other's hull. The body vertex each
  cloth point grew from knows its side.
- **Leave out the junctions:** the sleeve's root under the arm, the gusset across the crotch and the top of the foot
  in a trouser's crop each stretch a slice's hull over something that isn't that slice (the side webbed out like a
  wing, the gusset pushed under the other thigh, the hem bulged over the instep). Every new shape rule: picture it on
  the whole body, and run TAILOR's under-the-skin measure on the tight bottoms on all seven bodies.
- **A shader branch on a sign makes an edge:** the hang folds stored as a negative drag, switched in where they beat
  the armpits' pull, drew a hard line under the bust. Add the two (drag minus hang) and branch on zero, so the value
  crosses smoothly.
- **A landmark is a shape, not an extreme:** the fold under the breast found as the deepest point below it ran on
  down the ribs, which keep sinking slowly to the waist, and every bra sat 2.5 cm low. Find the bend (the slope fallen
  to half its steepest) and measure it on all seven bodies before trusting it.

## The soles (2026-11-01, `clothing-refiner`)

- **A part that joins another is cut from the other's shape, not from what's under both:** the sole was the hull of
  the bare foot's footprint, so the shoe's upper (the foot plus its ease) broke out through its rim in a jagged line.
  Slice the upper where the sole meets it and carry that outline down; then the join is one clean line by construction.
- **Read what a setting does before trusting its name:** a sole's `heel` raised the bottom at the back (a thinner heel)
  for months of designs; nothing looked at it closely until the soles were redone.
- **Lumps have more than one source; colour the parts before smoothing anything:** the shoes' "sculpted" look was
  three things at once: a toe cap running down through the sole's wall (seen at once with each part a colour), the
  upper following the toes, and the end cap closing a flat heel wall to one point (a pyramid's shading). Smoothing
  alone would have kept the knot and the star.

## The wardrobe (2026-11-02, `clothing-refiner`)

- **Anything pushed out round a leg must know the other leg is there:** folds and an A-line gap pushed out radially
  from each leg's line went into the other thigh on the full masculine body (TAILOR's under-the-skin measure). Fade
  them on the side facing the other leg, and run the tight-bottoms probe on all seven bodies before TAILOR.
- **A kept result must also not be sent and drawn again:** the tailor kept the garments, yet "the same outfit again"
  took seconds: every garment was still copied to the page and its meshes rebuilt. The page tells the worker what it
  shows (`have`) and keeps those meshes; measure the worker's answer apart from the frames a CPU renderer draws.

## Potted plants and vines (2026-11-02, `procedural-trees`)

- **A lathe's step follows the profile's length, not a number that suited a cup:** the pots were turned at the
  ware family's 4 mm step, which made a 40 cm floor pot of thirty thousand triangles (a monstera's whole plant was
  six thousand). Rows by `arclen / 44` and columns by the diameter: the same pot in a tenth of the triangles,
  nothing seen. Measure a family's triangles across its sizes before its recipes, not after.
- **A tiny tree's crown is its branch count:** a 1.2 m ficus with a street tree's branch density grew three
  branches off its trunk, so three balls of leaves whatever the leaf count. Density is per metre of trunk: a
  potted tree needs a few times a street tree's, and leaves along its twigs (`on: all`), not at their tips only.
- **Few wide splits, not many narrow:** a monstera drawn with nine notches a side read as a palm frond, and narrow
  slits a sample wide vanished at the card's resolution. Five rounded lobes a side cut by V-shaped gaps that
  widen to the edge read as the plant.

## A check that a motion "plays" passed on a motion that never moved (2026-11-02)

The sample's Kimodo idle for Mari was made by posing a Skeleton3D built in code, outside the scene tree, frame by
frame and reading `get_bone_global_pose`: every frame came out the first frame's pose (the arms down, nothing else),
so the retargeted animation had 120 identical keys a track. DIRECTOR had checked only that her AnimationPlayer was
playing `sample_idle`, which it was. The new check (her bones and her face shapes moving in the same moment) found it:
0 bones moved, 31 face shapes did.

- **Check that a motion moves, between two moments while it plays**, never only that its player says it's playing,
  and never against the pose before it started (the first editor check compared her rest with the preview and
  counted 48 bones "moving" on a frozen clip).
- **Work out joint positions yourself when making test motions** (parent's transform times the bone's local, parents
  first): a Skeleton3D out of the tree isn't a reliable calculator for its own global poses.

## A check that looked for a walk after it was over (2026-11-03)

Mari's moves in DIRECTOR: "she didn't walk on her walk", twice. She did. The story's state sends her half a metre
(0.45 s at 1.1 m/s), and the check looked after waiting a second; then, getting up off a seat, she went half a metre at
2.6 m/s (0.2 s) and the check looked once, after her getting up and a margin. Both times she had already arrived and
was back on her idle.

- **Watch a move frame by frame from before it can start**, keeping what was seen (here: walking on her walk, at any
  frame), and only then judge; never one look after a fixed wait, which passes or fails by how far the thing had to go.
- **Know the distances the sample uses**: its spots are close together, so anything that walks there is over in well
  under a second.

## A soft lock that never looked at what it held the view on (2026-11-03)

The first cutscene's `focus` only pulled the view back to the edge of its cone when it drifted out, which is the right
feel once the player is looking at the scene, but at the start it left the subject wherever the cone's edge fell: the
guide's picture of the night's cutscene had Mari at the side of the frame, a wall filling the rest. The numbers
DIRECTOR measured (within the cone a second after looking away) were all true, and said nothing about whether the
cutscene ever turned the player toward her.

- **A hold starts by turning the view onto its subject** (as a look does: eased, to its middle), and only then keeps
  it inside the cone; a cone alone is a fence, not a camera.
- **Look at the picture of a camera feature, not only its measures**: the angle checks passed on a frame no director
  would keep.
- **HUD lines time out on the wall clock** (`hud.line`: `Time.get_ticks_msec`), so a picture taken in a slow,
  fixed-fps test run misses a line that a real game shows: picture a line by waiting for it to be the current one
  (`hud.line_text`), never by game time after it started.

## Cloth that came out smooth, crumpled, or in the wrong place (2026-11-04)

The bedding family (PROPGEN §21) took several tries. A pillow simulated as a filled bag stayed smooth at every
stiffness, iteration count and jitter tried: the folds a filled bag makes at its corners are smaller than any grid
a prop can afford to simulate. A folded futon creased by reflecting its flap (the old `sim.hinge`) and then settled
came out a crumpled heap: a stack of layers that thick, pushed apart by self-collision under gravity, never settles
neatly. A blanket made for a bed and placed by its origin in the level landed off the bed.

- **The simulation gives the form, the detail mesh the small folds**: fill, the seam, the drape over an edge from the
  simulation; the corner folds, the seam's puckers, lumps and wrinkles drawn into the high mesh and baked (faded to
  nothing at a seam, so two pieces still meet).
- **Fold a thick thing by rolling, and leave it folded**: each layer round the fold's middle at its own radius, each
  flap longer than what it covers by what its bend takes; a soft unevenness and a sag drawn on, no settle.
- **`sim.fold` works in the flat sheet's coordinates**: fold first, then move the sheet onto what it lies on.
- **Every exporter places a library mesh by its box** (centred, on its base), not by its origin: an anchored prop
  (a tree's trunk, a blanket's bed) records its `box_m`, and a layout places it where its box falls.
- **Rewriting a hand-formatted JSON file with `json.dumps` reflows all of it** (presets.json grew 2500 lines of
  diff): append to its text, then check it still parses to the same thing.

## A curtain's pleats finer than its cloth, and a rod's bake scrambled (2026-11-04)

The curtain family (PROPGEN §22) took three tries in two places. A pinch pleat's three folds, drawn as a zigzag of six
legs 23 mm long on a cloth sampled every 32 mm, crumpled into dark specks under the tape: the grid skipped legs and
folded triangles over each other. And the rod's parts (the pole, its finials, brackets and rings) shared one small
island: their bake's rays, cast a few millimetres out, caught each other (a ring is 5 mm round the pole) and the
normal map came out facing away (PROPGEN: 0.38).

- **Model at the grid's resolution, detail below it in the paint or the bake**: a pleat's three folds became one
  narrow loop at the tape, its pinch the stitching's.
- **Parts the same in both meshes don't need a bake**: `th.material(..., bake=False)` keeps a material out of it (its
  normal from its paint's relief alone), so they can share one island.
- **One long thin island sets the whole texture's density** (the packer fits every island at one pixels-per-mm, and
  nothing may be wider than the texture): a plain strip (a hem round a blanket, 6.6 m) is declared short and squeezed.
  The bedding's hem islands are still long (their textures at about a third of a pixel a millimetre): worth the same
  change and a make again.

## Wood that read as cork, flaws that never reached the normal map, cushions that crumpled (2026-11-04)

The tables and chairs (PROPGEN §23, §24) took a second try in three places. The wood_grain design's rings, 2.2 mm
apart, landed two texels apart on a 1.6 m table at 2048 and aliased into speckle. The flaws painted at their real size
(a 0.3 mm scratch, a 1 mm crack, a 0.04 mm grain) were finer than a texel (0.6 px/mm) and left the normal map flat.
And a seat pad's bag filled only to a pad's thickness had more cloth than air and crumpled all over.

- **Size detail to the texture, not to the world**: a ring, a scratch or a crack at least about two texels wide
  (`1 / frame.s` is a texel in mm), its depth a share of its width so the normal tilts; a top's underside at a third
  of the density (seldom seen) leaves more for its face.
- **A glued-up top is boards**: strips 12 to 22 cm wide, each its own log's heart (the cathedral arches) and tone, read
  as wood where one wide figure read as noise; a board's edge is straight edge grain.
- **A pad is foam in a cover, not air**: fill the bag firm between a floor and a ceiling at its thickness, then let it
  go; and keep its volume (pressure) while it settles, or gravity flattens it.

## Parts that open, cloth on hangers and a station of things (2026-11-05, the suitcases and the book)

- **A library mesh at its real size is `shape: "asset props/<name>"`, not `art`**: `art` dresses a block and needs
  one (a `shape` or a `kit`); the test room's suitcase, closets and journal were given `art` alone, the plan made no
  piece of them and Godot's run said "no things_case". The story check now reads the parts of an asset shape too.
- **Cycles renders the scene, not the list**: the preview was handed the parts it should show, but every object linked
  to the scene is drawn; a part not in the picture is hidden from the render (`hide_render`) and shown again after.
  And an empty's `bound_box` is its display size (a metre): never put one in the list the camera is fitted to.
- **A coarse copy interpolated on a simulated cloth crosses it where the cloth folds**: the hanging shirt's game
  mesh (points located in the fine sim's triangles, 2.2 times its step) cut chords through the hem's and the sides'
  folds, and the front's triangles went inside the back's: dark slivers that no bake setting fixed (the maps had no
  black in them). The simulated bag at a slightly coarser step was then the game mesh itself, the detail mesh the
  same cloth with the weave's wrinkles pushed along its normals. (The user scrapped the hanging clothes that evening
  all the same: a bag of two pieces hung from a wire never read as a shirt. The lesson about the copy stands.)
- **A bake's miss is black, and the alpha says where**: a ray from the game mesh that finds nothing of the detailed
  one within its reach leaves (0, 0, 0, 0) with `use_clear`; the image made with alpha, a miss is filled from its
  baked neighbours (`bake.py fill_misses`) instead of being painted in.
- **GDScript's `:=` from `duplicate()` is a parse error, and the export's load check didn't see it**: `var q :=
  p.duplicate()` on a Dictionary can't infer its type; GDEXPORT's Pilot loaded fine and only the test room's run,
  reloading the runtime, failed at the first station that used it. `godot --headless --check-only -s <script>` on each
  changed script, in an exported project, finds it in seconds.
- **A Blender make outlives the wrapper you kill**: `propgen.py make` runs Blender's Python as a subprocess (`main.py`);
  killing the wrapper's PID left the bpy process writing its 54,000-triangle hardshell into the same folder as the
  coarser remake. Find the `main.py` process too (one command to find the PID, the next to kill it).
- **A part shares the thing's materials**: the sticker passes blacked out "the other objects'" materials for the
  prop's picture, and a lid's or a cover's are the thing's own datablocks, so the whole prop went holdout and the kept
  passes saw nothing. Only materials not the thing's are the others'.
- **A thing with parts is set down by its box shut**: built with its lid up, a suitcase was centred as built, so the
  closed case a level places by its shut size sat 11 cm off its spot; the builder now turns every part to shut before
  centring (`build.run`), and a check reads a part's vertices where its node puts them (a part keeps its vertices
  about its hinge), or the lid "hangs below the floor".

## Stairs (2026-11-05, night)

- **A point under the feet is a hole waiting.** The box collision's ground test took the highest top exactly under
  the player's centre; a dog-leg's landing slab stops a centimetre short of the wall it meets (the builder's
  `DOGLEG.wall` 0.06 over a 0.05 half wall), and a frame whose centre landed in that centimetre dropped the player
  three metres onto the ground floor, in Godot every time and on the desk when the frames were slow enough to land
  there. The feet now rest on anything within 6 cm of the centre (`SUPPORT`, play.gd and runtime.js). Any walkable
  surface made of pieces needs the same: never trust two tops to meet exactly.
- **Simulate the walk before building the stair.** Thirty lines of Python with the runtime's own rule (a block is an
  obstacle when its top is more than a step above the feet) showed the steep house stair unclimbable at its very
  foot, before any geometry existed, and showed the contact-point rule climbing it. Cheaper than a Godot run, and it
  said why.
- **A test's hold must be shorter than the run.** "Stuck for half a second" fired at the wall at the end of a flight
  because the key was held longer than the flight took; the flights' holds are now a little under their length.
- **A "sanity" clamp with a ratio in it is a rule about the size, not the thing.** The kit's `top` allowance (the metre
  a stair's box stands on above its last tread) was clamped to 60 % of the box: fine for a 3 m flight, but a winder's
  box is three risers and that metre, so the clamp took a third of its rise and its treads stood 2 to 7 cm above the
  flights they joined (the feet at 2.23 m where no tread should be). Clamp by what the parts need (10 cm a riser), and
  write the twin (kit.py) the same day.
- **A test's clock must be the runtime's clock.** The desk's climb test timed its frames with performance.now() while
  the runtime steps by the animation frame's timestamp (capped at 0.05 s). After a stall the timestamp lags the clock,
  the next interval comes out short, and a 4 cm "jump" was only the two clocks disagreeing (and only under load: it
  passed the next three runs). Read the frame's seconds the way the code under test does.
- **When the geometry needs hack after hack to pass a check, the model is wrong: look at the reference again.** The
  first zigzag stair put both flights in one lane, crossing in an X as the photo looks from the street. Its flights
  met end-on at every landing, their rails ran through each other's posts, and each fix (odd stages narrower, 6 mm
  shorter, their rails 7 cm in) uncovered the next pair of faces in one plane. The photo, read once more: the lower
  flight's railing would run up through the flight above if they shared a lane; a scissor stair alternates lanes as
  well as directions. Two lanes, and every hack went. The clashes that remained were honest ones: a parapet drawn
  over the treads' side, a rail's bar ending 2 mm from a post's face, a post against a stringer's end, a flight's
  rail 2 cm inside the landings' rail line. Found by the check's own test lifted into a 10-second probe over every
  form, style, rail and shaft (`stack_probe`: build, `clashes`, the triangles printed). Pick offsets by listing the
  other part's face planes and keeping more than the test's 4 mm from all of them.
- **The standard for a stair is the line, not the code book.** The rails were built a riser high ("the rails poke
  out"), then bent level at the last nose as a real handrail is, and the user drew the answer over the picture in
  red: one straight edge from the foot to the landing's corner with nothing stepping above it. Every element that
  shows in silhouette (a rail, a panel's top, a parapet's top, a stringer's top edge) now runs on the inner-corner
  line, through the risers' feet from the floor to the landing, so it lands at the landing's own height in one
  straight line; what sits against the treads (the bottom bar, the stringer's depth) uses the nosing line. Two
  lines, no bends, no knuckles. And check it the way the user did: draw the ideal lines over the picture
  (`stairlines.mjs`) and look at the junctions from a metre away. Two more things that round came out of it: a
  **flat projection of the lines is useless** (hidden lines through walls, nothing to judge); draw them in the scene
  itself, depth-tested, a hair toward the eye. And **a rule you can state, make a check**: "nothing above the line"
  became `stackLineFaults` (no vertex of the stack 4 mm over the rail's line) and found the posts' caps, the bars'
  ends and the panels' nubs that the eye had passed.
- **A preset's arrays are shared until copied.** The floors buttons change `B.model.floors` in place; `presetToModel`
  handed the model the preset's own array, so after a basement was added the house preset itself had four floors and
  the builder test's reopen waited forever for two. Copy what a loader hands out.

## A photo matched outdoors (2026-11-06, the street builder's nature streets)

The five nature photos (STREET_BUILDER §7d) took several tries each to pin under 2% of the frame.

- **Fit the camera from what can be measured, then place the rest by casting**: pins on a lamp or a plant placed by
  eye fought the pins on the steps; the fit came under 2% only with pins on the timbers' strap tops and the fence's
  posts alone, the camera solved from those (`shotfit.mjs`), and everything else cast through it (`--cast`).
- **A wrong height moves the whole camera**: a fence post taken as 1.1 m when it was 1.3, a bridge's deck measured
  above the water when its middle stood on the bank, a point pinned exactly on a fall: each pulled the solver metres
  away or down to the ground. When a fit won't close, question a height before a position.
- **A layer of flat quads must meet edge to edge**: white water drawn as strips with a new jitter at each station
  overlapped itself and the foam rings round the rocks (STREET: hundreds of faces in one plane); the jitter is now a
  function of the station, the rings a layer over the strips and never over each other.
- **A thing placed by hand follows the placement rules the page's snapping gives**: a utility pole turned along its
  wires puts its cross-arm along the run and three wires in one line; houses given a smaller front than the house style
  makes put its parts in the wall's plane. Use the style's own maker (`SP.makeBuilding`) and face poles across the road.
- **Random angles can coincide**: the stand-in tree's three limbs at random angles twice came out nearly parallel
  (two cylinders in one plane); they leave a third of a turn apart now.
- **Noise for the mountains is noise under the houses**: a terrain's `noise` big enough to roughen far hills (14 m)
  dug 3 m dips beside the stream and under the town, and the relief ramped in from the river's edge, so its bank
  collapsed into them; GDSTREET found it (a house's roof over the road behind it). A bank now holds to its end, and a
  town's floor is a `flat` (an area held at a level in place of the relief). Drop a body on every street in Godot
  (GDSTREET) before calling a match done: the drawing through the shot hid all of it.

- **A probe on steps samples the middle of a tread**: GDSTREET's ray at a flight's half way landed exactly on a riser
  in `shrine_steps` (16 treads: the middle is a boundary), and stone fronts are ragged, so it hit the tread below, one
  rise lower than the street said (0.154 m). The probe takes the middle of a tread now, and a station clear of bridges
  (the park's footbridge had the same trap). A probe must stand where one surface is the only one there.

## The rivers (2026-11-06, last)

A day's river work (the kind, its banks, white water, falls, rocks in it, three streets, a park) went on the user's
word the same evening: "scrap the rivers, keep the foliage and rocks as props". What survived was what stood on its
own as a reusable piece: the props, the paths and steps, the ground. Build the reusable piece first and the showcase
last; a showcase that needs the piece is cheap to drop, a piece buried in a showcase is not.

## Rocks by code (2026-11-06, later, the rock family)

The first boulder came out a pale marshmallow: a smooth pancake with a few pen-line cracks and green dots. What made
it a rock, in order of how much each mattered: the planes' cuts all round and deep (not mostly on top: a flat top
reads as a pillow from a low eye), the crackle lumps nearly off (they made brain folds on the sides), the base tone
darker than it looks right (the preview's light and the occlusion's gamma both lift it), cracks only where a second
noise lets a joint run (a network of cell borders reads as cracked glaze), every stone of a patch its own tone, and
the fine grain in the paint's relief rather than the detailed mesh (a 1 m rock's 80k triangles can't carry a 2 mm
grain; the normal map's height can). Judge a prop on a sheet of several beside each other, not one at a time: the
pale one shows.


## The sound that can go quiet (2026-11-07, later: music, room tone and the hush)

- **A brief state is sampled from before what fires it, not read after the helper returns**: station 15's hush lasts a
  second, and the check read the beds after `ticked`; but the task ticks partway through the 2.5 s walk that the test
  holds, so by the time `ticked` returned the hush was over and the calm coming in. Both drivers now sample the beds
  every frame from before the walk until the calm comes, then look for silent frames while the chase was still the
  mood (and not at the first calm frame, which still rounds to silence as the beds start back: expected).
- **A bed that must line up with a beat runs on the play's clock**: the beat waits the hush in game time (each frame's
  step capped at 0.05 s), so beds on wall time drift from it on slow frames, and the sting can land after the silence
  has ended. Godot's beds step by the same capped delta; the desk's are driven by Play's frame, on their own timer
  only in the Watch.
- **Rendered cues are levelled before they're beds**: the four moods came out 24 dB apart (a pizzicato with its
  silences at −37.5 dB mean, the chase at −13.6); each is brought to −20 LUFS when it's made (ffmpeg's `loudnorm`
  measuring, a plain gain applied, peaks under −1.5 dBTP). The meter prints to stderr: Node's `execFileSync` returns
  only stdout, so it's read with `spawnSync`.

## Tutorial v2: a hotel floor built by hand (2026-11-07, night)

- **Every floor needs a room of its own, not just a stairwell**: the scene builder takes a level's floors from where
  its rooms stand, leaving stairwells out. With only the stairwell's foot on the lower floor, reopening the set gave
  one floor, and the builder said "stairs need a floor above". A real second-floor landing under the corridor fixed it,
  and reads better.
- **Rotation 0 faces south**: things against a north wall face the room at 0. The first floor had the linen bookshelf,
  the fridge and the bath's mirror at 180, so their backs (and the mirror's glass) faced the wall, and the key floated
  in front of a blank panel. It's in the map skill's reference now.
- **A thing to use stands clear of the furniture's collider**: the export makes a kit thing one collision box, so a key
  placed inside the bookshelf's box was behind the box's face. The aim hit the shelf, and E did nothing. On the
  shelf's front edge, its own collider comes first.
- **A CRT wants its glass's UVs corner to corner**: the kit's TV screen is mapped in metres, so the static covered part
  of it. A QuadMesh the screen's size in front of it is the by-hand answer.
- **A Godot script that errors in `_initialize` never quits**: the process sits until the caller's timeout (ten
  minutes, twice). The scripts check what they load and quit with a word, and the play test has a watchdog.
- **A fresh project's first `--import` can stop short of the exports**: the hotel wasn't in the cache after it. The
  check imports again until it is.
- **`@export_enum` can't have an empty option** (the Director's notes say so too): `keep` for "leave it as it is".
- **Pictures at night need the iris held**: a dimmed corridor shot after 40 frames looked as bright as the lit one,
  because the look's auto exposure had opened up. Eight frames shows it as the player sees it happen.

## Making it intense (2026-11-08, night: the sound physics, the body, her signs, the uncanny seen)

- **A cache keyed on the wall clock never goes stale in a fixed-fps test**: the sound's traces were kept for half a
  second of `Time.get_ticks_msec`, and the play test at `--fixed-fps 60` outruns real time, so 304's knock was heard
  through the same trace shut and open. Kept on the game's own clock (each frame's delta added up), they go stale as
  the game does.
- **What answers the player's steps waits for the first one**: the steps behind you, started by the batteries' pickup
  while the player stood still, took "no step for a second" for "stopped" and ended at once, with its step too many
  for nobody. It waits (a minute at most) for you to walk.
- **Parse-check a new script before a long run**: the play test took six minutes to find an untyped loop variable
  (`for h in [...]`, the lesson above, made again), which
  `godot --headless --path PROJECT --check-only -s starter/closer.gd` reports in two seconds (exit 1, the line).
  Every new or changed starter script gets that first.
- **A mirror's near plane is square to the view, not the glass**: looking down at a mirror, its camera's near plane
  (set at the glass's nearest corner) leaves the wall behind the glass in, below a line across it, so the room below
  that line was the wall's back. `_hide_wall` found the wall only through a collider with the wall's meshes under it:
  the demo's wall has no collider and an export's walls have `-colonly` bodies with no meshes, so neither was ever
  hidden. It now also takes every mesh whose box a short segment back from the glass crosses (never a whole level's
  mesh). A point 3 cm back found the hotel bath's corridor wall but not the 4 mm lining in front of it: a slab that
  thin falls between sampled points, so test segments, not points.
- **A measure that passes for the wrong reason**: LOOKPLUGIN's "a mirror seen in a mirror" wanted a peak at twice
  its box's mean, and had it only because that uncovered wall darkened most of the box. With the wall gone the second
  mirror's glass is the room's brightness. Found while adding a box that should have shown in the mirror and didn't,
  even on layer 1: when a new measure fails, put the thing on the plainest settings before blaming the new part.
- **A moment armed by a scare goes off with the scare**: the feet under 308's door, armed when the corridor went dark,
  came at once and were gone before anyone looked: the player stood within their 6 m with the door's foot in the
  frustum, while looking at her. What wants to be noticed waits for the eye: near (4 m), and the place within 30° of
  where you look, not merely somewhere in the frame.
- **Place a figure before you show it**: the shadow pass set her visible, then moved her onto her path the next frame,
  so for one frame she stood at her node's origin (the test read her "walk" as 7.8 m).
- **A light put inside a lampshade is boxed in by it**: 304's lamp, moved up from the floor into its floor lamp's shade
  (where the guide always said), lit the room only through the shade's open top and bottom, and a figure's shadow on
  the wall measured nothing (0.1419 against 0.1418): the shade's mesh casts shadows. A fabric shade lets light
  through, so interior.gd turns the kit lamps' shadows off as it does the windows' glass. Before blaming a faint
  shadow, render the frame with and without the thing and compare.
- **Only an ArrayMesh answers about blend shapes**: `mesh.get_blend_shape_count()` is ArrayMesh's, so HSBlink's search
  for the blink's shapes stopped with a script error on the stand-in's CylinderMesh (a box in a character's hand would
  have done the same). Ask the MeshInstance3D (`get_blend_shape_count`, `find_blend_shape_by_name`) or check
  `mesh is ArrayMesh` first.
- **A compressed playthrough leaves a director little room**: tutorial v2's play test fires a scare every 20 s or so,
  so the dread director spent most of it at its peak or relaxing (its intensity falls 0.01 a second), and two of its
  moments came, not the three the check first wanted, and on the next run one. Check what it's for (its phases,
  moments in place, none twice running) and bring its moments on deliberately where they're ready (its gap cut to
  nothing in the corridor); a count left to chance is luck.
- **One pending time for a thing that can overlap is a bug**: the lightning kept its thunder's due time in one value,
  so a strike two seconds after another cancelled the first's thunder (thunder comes 3 s a kilometre later, often
  after the next flash). Each strike queues its own. The demo's stage strikes twice and times the first thunder.
- **An interior's furniture is solid to its top**: the hotel's export gives each room one collider with every piece of
  furniture in it as a box up to its highest point (304's bed to its headboard, 0.95 m). A seat's own box for E,
  lower than that, was never reached: the aim stopped on the room's box. And an eye lying inside such a box would hear
  every sound through its faces (the tracer's rays hit them on the way in). So a seat's eye goes just over what's
  under it, its box reaches above it, and the player lifts an eye placed inside one. Before blaming a ray, print what
  it hit.
- **A walk in a check needs room to walk**: the check's walk from 304's chair went west, into the bed's box within half
  a metre, and `doing()` read the stopped slide as standing. Walk where nothing's in the way, or watch the position.
- **Headless, Godot's window is 64 px square**: a cue's regions are the frame's, and the frame's shape sets where a
  thing lands in it. Her place from 304's pillow, 0.7 of the way to the right edge of the game's 16:9 view, was off a
  square one (u 1.24) and read "out of view". The check gives the window the game's 1600 × 900 for the cues and puts
  it back (the older checks were tuned in the square frame). Any check of where something is in the frame sets the
  frame first.
- **Steps walked in a check are heard**: the check's walk in 304 had her copying the steps from the corridor (uncanny.gd's
  mimic), and the time there filled her menace gauge, so her own checks later started 2 m nearer. A part checked in the
  middle of a playthrough goes where nothing else is listening: before she's out.
- **Breath is light scattered, not a cloud painted on**: the first breath, puff.gdshader's look lit by the scene, showed
  as a bluish ball in the dark (the ambient lit it) and darkened what was behind it when unlit (mixed, not added).
  Breath scatters light and hides nothing: lit by direct lights only and added, the dark hides it and a beam shows it.
  And a flashlight's beam starts at the hand, 18 cm right and 20 cm down: breath 15 cm ahead of the mouth is outside
  it until it's carried 60 cm out. Before tuning a look, check the thing is where the light is (print its place
  against the light's cone), and measure it against a background that can show it (white added to white is nothing).
- **A flashlight's cookie is part of its light**: in the hotel the breath hardly showed in the beam that lit it in the
  demo, because the game's flashlight wears a cookie (a hot core, a ring, a dim spill) and breath carried a metre out
  sits 15 to 20° off the beam's axis, in the spill. The demo's spot had none. Measure an effect with the light the
  game gives it. Breath also reads best backlit (droplets scatter forward), so its shader has a forward lobe of its
  own and the guide's picture faces the street lamp.
- **A spot light's projector needs its shadow setup**: the cold stage's flashlight wore the game's cookie (HSBeam's
  projector) and went almost black, breath and frost with it, until its shadows were turned on as the starter's
  flashlight has them. Godot projects a spot's cookie through the light's shadow matrix. A light given a projector in
  code gets `shadow_enabled` with it.
- **A teleport is a footstep to the player**: her copied steps (uncanny.gd's mimic) went from 2 to 1 when the steam's
  check stood the player at the basin while she was out. player.gd counts a stride by the ground covered since the
  last frame, so the check's jump was a step, she copied it, and she started the later walk one step nearer the 2.5 m
  she stops at. The light was blamed first, wrongly: turning it off changed nothing. A check that moves the player
  while something listens to its steps clears the last position (`_was`), as settle() and rise() do.
- **A script constant can't take a native class's name**: the starter's preload of noise.gd as `const Noise` failed to
  parse in every script that held it, because Godot has a class `Noise` (FastNoiseLite's base). It's `Noises`. Name a
  preload after what it is, not the obvious word, and parse each new script (`--check-only -s`) before a long run.
- **A state that leads back to its own trigger loops**: in the hunt's check she found you 30 times in a row, because
  finding you pulled you out into the open in front of her, she turned to go, saw you, and found you again. A
  reaction that puts the player where its own trigger fires needs a once: a search finds you at most once now.
- **A check's clock counts every frame, or it times only part of what it measures**: the hunt's check timed her
  listening (3 to 6 s) with a counter its waiting loop advanced, but she hears you during the run before that loop
  starts, so about 0.6 s went uncounted. It passed twice, while the dice gave her a long listen, and failed on the
  merged tree at 2.7 s. A time the game keeps is read off the engine's own count (`Engine.get_physics_frames()` over
  the fixed 60), never off a counter that runs only while the check is looking.
