# HorrorStudio Weapons: a double-barrelled shotgun in first person for any Godot 4.7 game

One add-on (`addons/horrorstudio_weapons/`, GDScript with its models and sounds, nothing to build): **HSDoubleBarrel**,
a side-by-side 12-gauge that breaks open (the user's own model), held in first person, and **HSWeaponPickup**, the gun
or a box of shells lying in a room. Made for horror first: one heavy gun, two shells in it, every shell counted and
loaded by hand, and no hands on it (the user's, DECISIONS 2026-11-09). The double is the plugin's only gun ("I don't
want the single barrel shotgun, only the double barrel one", DECISIONS 2026-11-09, last). A game made by hand gets it
with `tools/godot_byhand.py`.

Under it, **a muzzle system for any gun** (DECISIONS 2026-11-09, latest): **HSMuzzle**, a gun's muzzle, plays an
**HSMuzzleFlash** (its wings each a run of slightly elongated spheres that intersect, their fronts culled, a noise
mapped triplanar onto each and burnt by the view's normal dotted with the surface's: the user's way), its light,
sparks, the smoke thrown out and **the smoke it trails** wherever the gun goes; **HSShellType**, a kind of shell (its
pellets, its flash, what it does where it lands, its models: the plugin's buckshot and explosive, more by duplicating
one); **HSImpact**, what a hit does (**what a 12-gauge leaves on a wall** by distance: one torn hole close up with the
powder's soot and grains round it, a torn middle with holes round it across a room, each pellet its own hole farther;
the wad's dent; lead smeared on concrete; the PBR maps making pieces look missing; dust and chips; the explosive's
blast), played by **HSImpacts**. **HSGun** is what a gun is under all that (abstract): the next gun extends it.

![held: only its barrels](../../guides/weapons/img/idle.jpg) ![aimed](../../guides/weapons/img/aim.jpg)
![the right barrel](../../guides/weapons/img/fire.jpg) ![the left, through the first's smoke](../../guides/weapons/img/fire_left.jpg)
![broken open, the hulls flicked out](../../guides/weapons/img/open.jpg) ![a shell into each chamber](../../guides/weapons/img/pop.jpg)
![on tape: in its 4:3 picture](../../guides/weapons/img/tape.jpg) ![the smoke left behind](../../guides/weapons/img/trail.jpg)
![from an arm's length](../../guides/weapons/img/damage_arm.jpg) ![across a room](../../guides/weapons/img/damage_room.jpg)
![down a corridor](../../guides/weapons/img/damage_corridor.jpg) ![on concrete](../../guides/weapons/img/damage_concrete.jpg)
![the explosive shell](../../guides/weapons/img/explosive.jpg) ![its blast](../../guides/weapons/img/blast.jpg)
![its scorch](../../guides/weapons/img/scorch.jpg) ![the flash's spheres, bare and burnt](../../guides/weapons/img/flash_parts.jpg)

The guide for the user, with these pictures: `guides/weapons/index.html`.

| Piece | File | Use |
|---|---|---|
| **The double barrel** | `double.gd` (`HSDoubleBarrel`, an HSGun) | put one under the player's camera. Held low: only its barrels in the view, their muzzles toward its middle (their line meets the middle `aim_at_m` 1.3 m ahead); the carried flashlight's beam on the middle `beam_at_m` 12 m ahead; it sways behind the view as it turns, bobs as you walk, breathes, kicks, and never pokes through a wall; held to the eye on the right button. Left click fires the right barrel (the front trigger), then the left (the rear), then clicks; each through its own choke (`chokes`: the right improved cylinder 0.9°, the left modified 0.7°) from its own muzzle (`muzzle(0)` the right, `muzzle(1)` the left). R: up near the eye and broken open there, a V in the middle of the view (the barrels dropping away to the left, the stock down to the right) with the chambers at its point; the fired hulls flicked up and out over your shoulder, a live shell left where it is, a shell of the kind T picked popping into each empty chamber; snapped shut and back down (1.6 s for two); a click during it fires once it's shut. The shells low on the right as two marks (a shell of another kind in its kind's colour) and the pocket's count, in the HorrorStudio UI's colours. `pull()`, `reload()` (a full gun is looked into and shut), `set_aim(on)`, `set_raised(up)`, `give(shells, kind)`, `add_shells(n, kind)`, `set_load_kind(kind)`, `next_kind()`, `shells_of(kind)`; `broke_open`, `closed`; `live`, `spent`, `barrel_kind` (each chamber's), `opened`, `loaded` (set it and the chambers follow), `spare`, `aiming`, `last_kind`; `open_deg`, `lever_deg`, `pop_secs`, `pose_off`, `pose_rot` (the reload's pose) |
| **A gun** | `gun.gd` (`HSGun`, abstract) | what every gun is: carried (`owned`), raised and lowered, aimed, run with, its hold and sway, the flashlight under it, its kinds of shell (`kinds`, `load_kind`, `pocket`, `spare`), the shot (`_shoot(kind, barrel)`: rays in its cone, things pushed and told, the marks, the muzzle's flash, the kick, the noise, the ears), the hulls in the room, the HUD, the keys. A gun extends it with its own `_fire()`, `reload()`, `_draw_hud()`, `_spread(barrel)` and `_muzzle_names()` |
| **A muzzle** | `muzzle/muzzle.gd` (`HSMuzzle`, a Node3D) | any gun's muzzle: put it at the end of a barrel, its -Z along the barrel, and call `fire(look, clear_m, from)`. Its wings are one MultiMesh laid out again every shot; `view_model` draws them in front of the world as a first-person gun is (`z_clip`, `fov`); `light_energy` (the gun's `flash_energy`), `shadows`, `smoke`. In the editor, `preview` shows its look frozen at `preview_age`. `report()`, `sphere_list()`, `trail_points()` for checks |
| **A flash's look** | `muzzle/muzzle_flash.gd` (`HSMuzzleFlash`, a Resource) | `muzzle/buckshot.tres`, `muzzle/explosive.tres`, `impacts/fireball.tres`: the wings (`layout` STAR round the bore or BURST, a ball; `wings`, `wing_angle_deg`, `wing_length_m`, `wing_spheres`, `wing_radius_m`, `taper`, `stretch`, `jitter`), the plume and the core, the fire (`blend` ADD or SOLID, `core_color`, `mid_color`, `edge_color`, `energy`, `noise_scale`, `burn`, `erode`, `tip_burn`, `swell`, `life_s`), the light (`light_scale`, `light_color`, `light_range_m`, `light_s`, `light_fog`), sparks, the smoke (`puffs`, `puff_size_m`, `puff_life_s`, `trail_s`, `trail_life_s`, `trail_width_m`, `trail_rise`, `trail_strands`, `trail_spread`, `trail_turbulence`, `trail_erode`, `smoke_color`, `smoke_density`, `smoke_glow`, `smoke_light_cap`) |
| **A kind of shell** | `shells/shell_type.gd` (`HSShellType`, a Resource) | `shells/buckshot.tres` (the normal one) and `shells/explosive.tres` (one slug that bursts where it lands): `id`, `title`, `pellets` (0: the gun's), `spread_scale`, `reach_scale`, `push_scale`, `damage`, `recoil_scale`, `noise_scale`, `muzzle` (its HSMuzzleFlash), `impact` (its HSImpact), `model`, `spent_model`, `color` (its marks in the shells' row) |
| **What a hit does** | `impacts/impact.gd` (`HSImpact`, a Resource), `impacts/impacts.gd` (`HSImpacts`, a Node3D) | `impacts/pellet.tres` and `impacts/explosive.tres`: the mark (`mark` crater or scorch: a Decal with an albedo, normal and ORM map from `fx/`, so pieces look missing; `mark_size_m`, `keep`, `embers_s`), the shot's pellets together (`merge_m` 1.6 cm and `merge_min` 3: one torn hole; `soot_m` 0.4 m and `powder_m` 0.9 m: the powder round it; `wad_m` 1.5 to 5 m: the wad's dent), the debris (`dust`, `chips`, `sparks`, times what the surface throws), the blast (`radius_m`, `power`, `damage`, `fireball`, `light_energy`, `shake`, `noise`, `ring_secs`, `sound`). HSImpacts (one in a scene, `HSImpacts.of(get_tree())`) plays them: `play(impact, hit)`, `play_shot(impact, hits)`, `clusters(hits, merge_m)`; a hit's surface from its `hs_surface` metadata, its `acoustic` one, the starter's Sound node's rooms, else plaster (`SURFACES`: each one's tint, dust, chips, sparks, and `hard` for concrete, stone and metal); `marks`, `last`, `last_shot` (the last shot's pellets, torn holes, ones alone, soot, grains, wad, surface, marks), `blasts` |
| **The maps** | `fx/` | made in code (`tools/weapon_fx.py`, WEAPONFX): `flash_noise.png` (the fire's noise, tiling), `puff.png`, `crater_<0..3>_*` (a pellet's crater from one height field: the hole, the broken cone, chips of paint gone), `blast_<0..2>_*` (pellets landing together: one ragged hole, the paper torn back in flaps, the plaster broken out, cracks), `smear_<0..1>_*` (lead flattened on a hard wall: a grey metallic splash, a shallow dent, chips), `wad_0_*` (the wad's dent: a dish, a scuffed ring, its petals' marks), each `_albedo`, `_normal` (Godot's OpenGL convention, leaning into the hole) and `_orm`; `soot_0_albedo.png` (the smoke's starburst) and `grains_0_albedo.png` (the powder's specks); `scorch_<0..1>_*` with `_emission` (an explosion's: a jagged crater, cracks, soot fanned round it, embers). Paint over them in Krita: the plugin reads whatever is there |
| **Pickups** | `pickup.gd` (`HSWeaponPickup`, a Node3D) | `kind` double (the gun lying on its side, `shells` coming with it; an older scene's `shotgun` is the double too) or shells (the prop generator's box of five, `shells_box_5`, two spilled beside it; `lid_open` shows it open, its lid swung on its own hinge; into the gun you own); `shell` the kind of shells (none: the normal; the explosive comes in its own box, `shells_box_5_explosive`; `box_model` any other); E takes it (the starter's player uses anything with `use()`), `say` a line through the Story, `taken` to wire a scare to |
| **Something to shoot** | `shootable.gd` (`HSShootable`, a Node) | put one under what can be shot (a character, a doll, a lamp): a shot with a pellet on its parent is a hit, `hit(info)`, and after `hits` of them `down`. Each a switch: `gone_secs` (gone at once and back after that long, its collision with it: a ghost's way; down, gone for good), `push_m` (shoved back), `cry` (a sound), `say` (a line), `target` (its `fire()`), `lights_out` (every light under it dark when it's down) |
| **The models** | `models/` | the prop generator's `shotgun_double` (the user's model, `Content/Studio/Props/models/dbl_barrel.fbx`, made round-barrelled and painted: blued, case-hardened, checkered walnut; its `barrels` with the fore-end on their hinge, `lever`, `trigger`, `trigger2`; sockets `muzzle`, `muzzle_r`, `muzzle_l`, `chamber`, `chamber_r`, `chamber_l`, `hinge`, `breech`, `grip`, `trigger`, `shoulder`, `light`), `shell_12ga` and `shell_12ga_spent` (their brand printed along the hull, their heads stamped), `shells_box_5` (the box of shells: its lid a part on its hinge), `shell_12ga_explosive`, `shell_12ga_explosive_spent` and `shells_box_5_explosive` (the explosive kind's: a black hull printed in orange, high brass) (`tools/propgen.py make <name>`, docs/PROPGEN.md §30, §31: the shells and the box are customizable, your logo on them in the prop generator's picture editor, guides/prop_customizer) |
| **The sounds** | `sounds/` | made in code (`tools/weapon_sounds.py`: numpy, then ffmpeg to Ogg): the blast with its tail, a shell clicking in, the dry click, a hull on the floor, the handling; the break open, the snap shut and the ejectors' flick; an explosive shell bursting (`shell_burst`); a box of shells taken |

## Try it

`python tools/godot/weapons_check.py --keep ~/Games/ShotgunRange` builds the check's project in a folder of your own
(tutorial v2's hotel floor at night, the starter's player with the gun and its flashlight, a box of shells, two boxes to
shoot): open it in Godot and press F5.

## By hand

1. `python tools/godot_byhand.py new ~/Games/MyGame` (or `install` into a project you have: the plugin's copied in and
   enabled).
2. Under the player's camera (the starter's `Player/Eye`) add an **HSDoubleBarrel** (Add Node) and name it Shotgun. The
   gun shows in the editor where it'll be held (a preview, never saved): change **hold**, **aim_at_m** and **cant_deg**
   and watch it move. Set its **light** to the flashlight (`Player/Eye/Flashlight`): it's carried under the barrels
   while the gun is up, its beam along them, and back on the eye when it's lowered.
3. Found, not carried: untick **owned** and put an **HSWeaponPickup** (kind double) where it lies. Boxes of shells:
   HSWeaponPickup, kind shells, `shells` 5.
4. Play: **left click** fires a barrel, **right button** held aims it, **R** breaks it open and loads (a click stops it
   and fires once it's shut), **T** picks the kind of shell R loads, **Q** lowers and raises it, **E** takes a pickup.
5. Hear it from your scripts: `fired(hits)`, `shell_in(loaded)`, `empty`, `broke_open`, `closed`, `raised_changed(up)`.
   A thing shot (or a node above it) with a `shot(info)` method is told: `{point, normal, dir, from, pellet, damage,
   kind}` once a pellet, and `{..., blast: true, damage, radius}` once by an explosive shell's blast that reaches it.
   Every node in the group `hs_listener` hears a shot `noise` loud (the starter's `searcher.gd` comes for it); the Fear
   node's ears ring; the Sound node plays it through the rooms.

## The muzzle

**HSMuzzle** is a node for any gun: put it at the end of a barrel (its -Z along the barrel) and call `fire(look)`.
HSDoubleBarrel makes one a barrel, at its `muzzle_r` and `muzzle_l` sockets. Its flash is the user's way:

- **Each wing a run of slightly elongated spheres that intersect, their fronts culled.** Five wings round the bore (a
  star seen from the front: `layout` STAR, `wings`, leaning `wing_angle_deg` off the bore), a plume straight out of it
  and a white core at the muzzle; each run of `wing_spheres` spheres stretched along it (`stretch`), tapering to its tip
  (`taper`), overlapping the next by well over half. All of them are one MultiMesh, laid out again for every shot
  (`jitter`: never twice alike); BURST lays the wings anywhere round the axis (the explosion's ball of fire).
- **The noise mapped triplanar onto each sphere, blended by the view's normal dotted with the surface's, the blend a
  burn** (`muzzle/flash.gdshaderinc`): the facing, 1 where a sphere's middle is seen and 0 at its rim, burns the noise,
  1 - (1 - noise) / facing: the noise itself in the middle, eaten away toward the rim, furthest where the noise is
  darkest. A ramp then colours it red (`edge_color`) where it burns out, orange (`mid_color`), white-yellow (`core_color`)
  where it's hottest; over the flash (`life_s`, a frame or three) the spheres swell and burn away (`swell`, `erode`),
  a wing's tip first (`tip_burn`).
- **Added or solid** (`blend`): ADD sums the spheres (white-hot where they overlap, a glow: the plugin's), SOLID draws
  each pixel as the nearest sphere's back, cut where it burns out (crisp orange edges).
- **Its light** (`light_scale` times the gun's `flash_energy`), lighting the room's haze only a little (`light_fog`: a
  flash that lit it fully hung a ball of glow in the air); **sparks** as streaks along their way; **the smoke thrown out**
  with the shot; **the smoke trail**: for `trail_s` after the shot the muzzle leaves smoke behind wherever it goes
  (docs/research/muzzle_smoke.md). It leaves the barrel straight and thick, then curls in curl noise (`trail_turbulence`,
  ramping in as it ages: swirls that never pile it up), rises (`trail_rise`) and spreads into strands that part
  (`trail_strands`, `trail_spread`). It's drawn as soft sprites close along a smoothed curve through where it's been, so
  it has no corners and can't fold, tapering in at the muzzle. Thick just after the shot, thin wisps after; a gun held
  still sends up a curling thread.
- **Smoke that reads as smoke** (`muzzle/smoke_noise.gdshaderinc`): the trail's sprites and the puffs read one noise
  in the world, warped by itself so its wisps curl and rising through the smoke. They agree where they overlap, so it's
  one smoke, not beads, rope or grit. Each is worn away by that noise as it ages (`trail_erode`: wisps, then threads,
  then nothing), and faded where it meets a wall or the gun (a soft particle) and near the lens.
- **Smoke and the next flash**: the double's second barrel fires a quarter second after the first, into the first's
  smoke. A lamp lights the smoke no brighter than `smoke_light_cap` (0.5; `muzzle/smoke_light.gdshaderinc`), so the
  flash beside it can't blow it out, and the cloud is drawn premultiplied (`muzzle/puff.gdshader`'s `occlude`): each
  puff adds its light and hides a little of what's behind it, so a thick cloud glows its lit colour instead of summing
  to white, and the second star reads through it. An impact's dust only adds (`occlude` 0).
- **In the editor**: an HSMuzzle's `preview` shows the flash frozen at `preview_age`; give it a look and change it.

## Kinds of shell

A kind is an **HSShellType** resource: the plugin's `shells/buckshot.tres` (the normal one: nine pellets, the barrel's
cone) and `shells/explosive.tres` (one slug, a third of the cone, a bigger, fiercer flash with more sparks; where it
lands it bursts). **A new kind**: duplicate one (FileSystem, right-click, Duplicate), change its numbers and give it its
own `muzzle` (duplicate `muzzle/buckshot.tres` too) and `impact`; add it to the gun's `kinds`; put a pickup with its
`shell` in the room. The gun keeps every shell's kind, each barrel's; R loads the kind T picked; a shell of another kind
shows in its kind's `color` in the shells' row, and a dot of it under the pocket's count while it's the kind R loads.

## What a shot leaves

A shot's pellets play their kind's **HSImpact** through **HSImpacts** (one in the scene), as a 12-gauge marks a wall
(docs/research/shotgun_damage.md):

- **By distance.** The pattern spreads from the muzzle (where you look: the muzzle's point on the view's line).
  - **At an arm's length** the whole charge tears one hole about the bore's size (`fx/blast_*`: the paper torn back in
    flaps, the plaster broken out, cracks), with the smoke's black starburst round it within 40 cm of the muzzle
    (`fx/soot_0`) and the powder's grains peppered round it within 90 cm (`fx/grains_0`).
  - **Across a room** (2.5 m) a pattern about 6 cm across: a torn middle with pellet holes round it, the wad's own dent
    near it.
  - **Down a corridor** (4.5 m) about 11 cm across, each pellet its own crater (`fx/crater_*`: an 8 mm hole in a ring of
    chipped paint), the wad's dent; at 9 m about 22 cm.
  - Pellets landing within `merge_m` (1.6 cm) of each other run into one hole.
- **Every hole's maps** make pieces look missing: three maps from one height field, the albedo the material under the
  surface (black down the hole), the normal map leaning into it so the room's light and the flashlight find its walls,
  the ORM's occlusion darkening its depths. Tinted by what was hit (plaster white, wood pale, carpet dark:
  `HSImpacts.SURFACES`), carried by what it's on (a door swings with its holes), the last 180 kept. No mark lands on the
  gun itself (it's on render layer 20, the Look plugin's: drawn by your eye, never in a mirror).
- **Concrete, stone and steel** (`hard`): the lead doesn't go in. Each hole is a grey metallic smear over a shallow dent
  (`fx/smear_*`); chips fly, and sparks off steel.
- **Dust and chips** of the surface fly off (wood splinters, metal sparks, tile shards).
- **What it's made of**: a collider's `hs_surface` metadata (plaster, concrete, stone, tile, wood, door, metal, glass,
  plastic, carpet, cloth, tatami, water), else its `acoustic` (the sound physics' word), else the starter's Sound node's
  rooms (the interior export's floor, walls and ceiling), else plaster.
- **A blast** (`impacts/explosive.tres`): a scorched crater a metre across with cracks running out of it and embers
  glowing in it for a few seconds (`fx/scorch_*`); a ball of fire (an HSMuzzle at the hit facing out of it, laid out as
  a burst: `impacts/fireball.tres`) with its light, sparks and smoke; everything in its reach (`radius_m` 2.2) and in
  its sight pushed (`power`) and told, its `damage` falling to nothing at the edge (an HSShootable counts it a hit);
  the view shaken near it, every listener hearing it (`noise` 6), the ears ringing, its sound.
- **Not yet**: pellets through a thin wall into the next room, ricochets off concrete, the wad lying on the floor.

## The numbers

- **The shot**: nine pellets of 00 buckshot, the right barrel's cone 0.9° (improved cylinder), the left's 0.7°
  (modified), `reach_m` 45, each pushing a thing that moves 0.9 N·s; the flash about three frames (55 ms,
  `flash_energy` 5), its smoke trailing 1.4 s; the view kicked 3.2° up (and a little aside), settling back by itself by
  `recover` 0.6 of it over a fraction of a second. The explosive shell: one slug in a cone a third as wide, its kick
  1.2 times, its blast 2.2 m.
- **Two barrels**: as fast as you pull (0.24 s between them), then the reload; never three flashes in a second (the
  flash limit).
- **Aimed** (the right button, `aim`): the breech under the eye (`aim_hold`), the barrels straight ahead with their rib
  just under the view's middle, the lens 58° (`aim_fov`, from the camera's own), the cone the barrel's own (a choke
  doesn't change when you aim: `aim_spread` 1), the sway and bob less; never while reloading or lowered.
- **Running** (over 2.2 m/s: the starter runs at 3.2, walks at 1.6): carried low and turned in, up again to aim, shoot
  or reload.
- **The reload**: up into the view 0.24 s, the lever over and the barrels down 0.23 s, the hulls flicked (0.2 s), a
  shell popping in a chamber (`pop_secs` 0.16 and 0.05), shut 0.15 s, back down 0.22 s: 1.6 s for two.
- **The hulls**: flicked in view for 0.22 s, then into the room, falling, bouncing and rolling on their side by rays of
  their own from their middle and both ends (a body this small sinks through a level's thin floor in a physics engine's
  slop, and a point slips through a gap a hull can't); the last 16 kept.

## Notes

- A view model: every material's z clip scale (0.35) keeps the gun in front of the wall you stand against while the
  room still lights it; it casts no shadow. `fov` gives it a lens of its own (0: the camera's). Against a wall its
  muzzles are past it: the flash's light and smoke stay this side, and the hulls flicked out beside a wall come down
  this side of it.
- The gun is drawn by the hold's numbers (`hold`, `aim_at_m`, `cant_deg`), not posed by hand: change those to hold it
  higher or lower.
- **On tape** (the Look plugin's HSTape, its picture 4:3): the gun is drawn in toward the middle (`fit_tape`) so it sits
  in the tape's picture as it does in the whole view.
- **Few shells**: the pocket starts with 4 (`spare`): every one counts.
- **What isn't there isn't shot**: a pellet passes through a body that isn't visible (someone hidden at her post still
  has her collider); an HSShootable that's gone (hidden, its colliders off, `hs_hidden` set so the starter's hunters
  stand down) can't be hit until it's back; a lamp shot out stays out (`hs_lit` false, as the light zones read it).
- **Your hooks are safe**: the gun is busy from the moment it fires; the kick and sway springs are stepped finely, so a
  long frame can't throw the gun; the flashlight's own shake (the Fear node's tremor) shows while it's carried.
- No crosshair of its own: the HUD's reticle (HorrorStudio UI) is the middle of the cone. The shells left show low on the
  right a moment after each change (`hud`).
- **The pump-action gun is gone** (DECISIONS 2026-11-09, last). `shotgun.gd` is kept only as the double under its old
  path, so a scene made before still loads; give a new gun HSDoubleBarrel.
- `tools/godot/weapons_check.py` (WEAPONS) builds it into the hotel corridor of tutorial v2 and plays it headless;
  `--pictures` draws the guide's pictures (`guides/weapons/img/`).
