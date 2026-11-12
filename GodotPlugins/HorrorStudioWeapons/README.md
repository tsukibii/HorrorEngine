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

And **two easter egg shells** (DECISIONS 2026-11-11: "a couple of new goofy ammo types, love hearts (this wouldnt damage
the npc but have some kind of cute effect), water shells (water splashes), just some fun easter egg ones"):
**love hearts** (`shells/heart.tres`: a pink flash and hearts out of the muzzle, a heart printed where each lands with
hearts floating up from it; someone hit is smitten: she stands where she is with hearts over her head) and **water**
(`shells/water.tres`: a spray, splashes, wet patches that run down the wall and dry; someone hit is soaked and drips;
embers and candle flames near a splash go out). Both hurt nobody and break nothing. See *The easter egg shells*.

And **things that break when they're shot** (DECISIONS 2026-11-09, after the smoke: "lets any object we attach be blow up
by shotgun shots, e.g. a kettle, a box, but it should look like the object itself got destroyed"): **HSBlowUp**, put
under any object, cuts its own meshes into pieces in the background when it loads (**HSFracture**: recursive plane
slicing, each cut filled) and, shot hard enough, swaps it for them: its own materials on every piece, the broken faces
drawn as what it's made of inside, small pieces where it was hit and bigger ones away from it, thrown along the shot,
the pellets' holes going with them, its dust, bits and sound; weaker shots dent it. What it's made of is an
**HSBreakKind** (ceramic, glass, wood, metal, cardboard, plastic, stone), guessed when it isn't given.

And **someone who bleeds black ichor** (DECISIONS 2026-11-10: "a reactive system for characters/enemies to be shot,
but dont do blood, instead create some form of demonic dark smoke and dark splatters like black blood"):
**HSHitReact**, put under a character, gives her hitboxes on her bones on a layer of their own (**sized to her**: a child's, a goblin's or an ogre's limbs, shoulders and head measured from her own skeleton, an adult's as they were; `girth` for a heavy creature whose flesh stands wide of its bones), a flinch on springs on
top of her animation (**HSFlinch**), a stagger counter that holds her where she is and shoves her back, black ichor
where she's hit (a wound riding her bone, drops, the spray behind her, glossy, embers in it) and black smoke out of each
wound trailing after her; shot down, she chars over, crumbles into the smoke and is gone. Its look is an
**HSWoundLook**. Her ichor is **alive** (the user, the same day: "a shader for the black gothic blood that will fit our
vhs camhybrid look and look eery and oozy"): each mark an **HSOoze**, a box projected onto whatever it lands on with a
shader of its own, so it spreads, drips down a wall, sends tendrils out of a pool, glistens with an oil's sheen, beats
slowly and smoulders, and reads on the camhybrid tape by its shine and its movement.

![held: only its barrels](../../guides/weapons/img/idle.jpg) ![aimed](../../guides/weapons/img/aim.jpg)
![the right barrel](../../guides/weapons/img/fire.jpg) ![the left, through the first's smoke](../../guides/weapons/img/fire_left.jpg)
![broken open, the hulls flicked out](../../guides/weapons/img/open.jpg) ![a shell into each chamber](../../guides/weapons/img/pop.jpg)
![on tape: in its 4:3 picture](../../guides/weapons/img/tape.jpg) ![the smoke left behind](../../guides/weapons/img/trail.jpg)
![from an arm's length](../../guides/weapons/img/damage_arm.jpg) ![across a room](../../guides/weapons/img/damage_room.jpg)
![down a corridor](../../guides/weapons/img/damage_corridor.jpg) ![on concrete](../../guides/weapons/img/damage_concrete.jpg)
![the explosive shell](../../guides/weapons/img/explosive.jpg) ![its blast](../../guides/weapons/img/blast.jpg)
![love hearts out of the muzzle](../../guides/weapons/img/hearts_fire.jpg) ![hearts on the wall](../../guides/weapons/img/hearts_wall.jpg)
![someone smitten](../../guides/weapons/img/charmed.jpg) ![a water shell's splash](../../guides/weapons/img/water_wall.jpg)
![the two boxes](../../guides/weapons/img/egg_boxes.jpg)
![its scorch](../../guides/weapons/img/scorch.jpg) ![the flash's spheres, bare and burnt](../../guides/weapons/img/flash_parts.jpg)
![a kettle, a mug and a box shot](../../guides/weapons/img/blowup_close.jpg) ![the kettle's cut](../../guides/weapons/img/blowup_cut.jpg)
![shot in the chest](../../guides/weapons/img/react_hit.jpg) ![smoking as she comes on](../../guides/weapons/img/react_smoke.jpg)
![charring](../../guides/weapons/img/react_char.jpg) ![crumbling into the smoke](../../guides/weapons/img/react_crumble.jpg)
![the ichor on a wall, its drips run](../../guides/weapons/img/ooze_wall.jpg) ![on camhybrid tape](../../guides/weapons/img/ooze_tape.jpg)

The guide for the user, with these pictures: `guides/weapons/index.html`.

| Piece | File | Use |
|---|---|---|
| **The double barrel** | `double.gd` (`HSDoubleBarrel`, an HSGun) | put one under the player's camera. Held low: only its barrels in the view, their muzzles toward its middle (their line meets the middle `aim_at_m` 1.3 m ahead); the carried flashlight's beam on the middle `beam_at_m` 12 m ahead; it sways behind the view as it turns, bobs as you walk, breathes, kicks, and never pokes through a wall; held to the eye on the right button. Left click fires the right barrel (the front trigger), then the left (the rear), then clicks; each through its own choke (`chokes`: the right improved cylinder 0.9°, the left modified 0.7°) from its own muzzle (`muzzle(0)` the right, `muzzle(1)` the left). R: up near the eye and broken open there, a V in the middle of the view (the barrels dropping away to the left, the stock down to the right) with the chambers at its point; the fired hulls flicked up and out over your shoulder, a live shell left where it is, a shell of the kind T picked popping into each empty chamber; snapped shut and back down (1.6 s for two); a click during it fires once it's shut. The shells low on the right as two marks (a shell of another kind in its kind's colour) and the pocket's count, in the HorrorStudio UI's colours. `pull()`, `reload()` (a full gun is looked into and shut), `set_aim(on)`, `set_raised(up)`, `give(shells, kind)`, `add_shells(n, kind)`, `set_load_kind(kind)`, `next_kind()`, `shells_of(kind)`; `broke_open`, `closed`; `live`, `spent`, `barrel_kind` (each chamber's), `opened`, `loaded` (set it and the chambers follow), `spare`, `aiming`, `last_kind`; `open_deg`, `lever_deg`, `pop_secs`, `pose_off`, `pose_rot` (the reload's pose) |
| **A gun** | `gun.gd` (`HSGun`, abstract) | what every gun is: carried (`owned`), raised and lowered, aimed, run with, its hold and sway, the flashlight under it, its kinds of shell (`kinds`, `load_kind`, `pocket`, `spare`), the shot (`_shoot(kind, barrel)`: rays in its cone, things pushed and told, the marks, the muzzle's flash, the kick, the noise, the ears), the hulls in the room, the HUD, the keys. A gun extends it with its own `_fire()`, `reload()`, `_draw_hud()`, `_spread(barrel)` and `_muzzle_names()` |
| **A muzzle** | `muzzle/muzzle.gd` (`HSMuzzle`, a Node3D) | any gun's muzzle: put it at the end of a barrel, its -Z along the barrel, and call `fire(look, clear_m, from)`. Its wings are one MultiMesh laid out again every shot; `view_model` draws them in front of the world as a first-person gun is (`z_clip`, `fov`); `light_energy` (the gun's `flash_energy`), `shadows`, `smoke`. In the editor, `preview` shows its look frozen at `preview_age`. `report()`, `sphere_list()`, `trail_points()` for checks |
| **A flash's look** | `muzzle/muzzle_flash.gd` (`HSMuzzleFlash`, a Resource) | `muzzle/buckshot.tres`, `muzzle/explosive.tres`, `impacts/fireball.tres`: the wings (`layout` STAR round the bore or BURST, a ball; `wings`, `wing_angle_deg`, `wing_length_m`, `wing_spheres`, `wing_radius_m`, `taper`, `stretch`, `jitter`), the plume and the core, the fire (`blend` ADD or SOLID, `core_color`, `mid_color`, `edge_color`, `energy`, `noise_scale`, `burn`, `erode`, `tip_burn`, `swell`, `life_s`), the light (`light_scale`, `light_color`, `light_range_m`, `light_s`, `light_fog`), sparks (`spark_sprite`: each a picture turned to the eye instead of a streak, the love hearts' `fx/heart.png`; `spark_energy`; a `spark_gravity` under 0 floats them up; `muzzle/heart.tres`, `muzzle/water.tres`), the smoke (`puffs`, `puff_size_m`, `puff_life_s`, `trail_s`, `trail_life_s`, `trail_width_m`, `trail_rise`, `trail_strands`, `trail_spread`, `trail_turbulence`, `trail_erode`, `smoke_color`, `smoke_density`, `smoke_glow`, `smoke_light_cap`) |
| **A kind of shell** | `shells/shell_type.gd` (`HSShellType`, a Resource) | `shells/buckshot.tres` (the normal one) and `shells/explosive.tres` (one slug that bursts where it lands): `id`, `title`, `pellets` (0: the gun's), `spread_scale`, `reach_scale`, `push_scale`, `damage`, `recoil_scale`, `noise_scale`, `ring_scale` (the ears), `fire_sound` (its own instead of the blast), `touch` (what it does to someone it hits: `charm`, `soak`, or a word of your own), `muzzle` (its HSMuzzleFlash), `impact` (its HSImpact), `model`, `spent_model`, `color` (its marks in the shells' row); the easter eggs `shells/heart.tres` and `shells/water.tres` (`damage` 0: harmless) |
| **What a hit does** | `impacts/impact.gd` (`HSImpact`, a Resource), `impacts/impacts.gd` (`HSImpacts`, a Node3D) | `impacts/pellet.tres` and `impacts/explosive.tres`: the mark (`mark` crater or scorch: a Decal with an albedo, normal and ORM map from `fx/`, so pieces look missing; `mark_size_m`, `keep`, `embers_s`), the shot's pellets together (`merge_m` 1.6 cm and `merge_min` 3: one torn hole; `soot_m` 0.4 m and `powder_m` 0.9 m: the powder round it; `wad_m` 1.5 to 5 m: the wad's dent), the debris (`dust`, `chips`, `sparks`, times what the surface throws), the blast (`radius_m`, `power`, `damage`, `fireball`, `light_energy`, `shake`, `noise`, `ring_secs`, `sound`), and what the easter eggs leave (`mark` heart or wet: a print or a wet patch, upright on a wall, nothing missing; `fade_s`: gone after a while; `hearts`, `droplets`, `mist`, `spray_color`; `douse_m`: embers and flames near it put out; `impacts/heart.tres`, `impacts/water.tres`). HSImpacts (one in a scene, `HSImpacts.of(get_tree())`) plays them: `play(impact, hit)`, `play_shot(impact, hits)`, `clusters(hits, merge_m)`; a hit's surface from its `hs_surface` metadata, its `acoustic` one, the starter's Sound node's rooms, else plaster (`SURFACES`: each one's tint, dust, chips, sparks, and `hard` for concrete, stone and metal); `marks`, `last`, `last_shot` (the last shot's pellets, torn holes, ones alone, soot, grains, wad, surface, marks, hearts, droplets), `blasts`; `hearts(at, basis, n, color)`, `douse(at, r)` (a scorch's embers, an HSPropFX's flame, anything in the group `hs_flame` with `douse()`), `doused` |
| **The maps** | `fx/` | made in code (`tools/weapon_fx.py`, WEAPONFX): `ichor_<kind>_<n>_*` (splat, drip, wound, drop: black ichor, glossy, a dark oxblood film where it's thin, embers in it, with `_emission`; a splat thrown one way, a drip running down, a wound, a drop),  `flash_noise.png` (the fire's noise, tiling), `puff.png`, `crater_<0..3>_*` (a pellet's crater from one height field: the hole, the broken cone, chips of paint gone), `blast_<0..2>_*` (pellets landing together: one ragged hole, the paper torn back in flaps, the plaster broken out, cracks), `smear_<0..1>_*` (lead flattened on a hard wall: a grey metallic splash, a shallow dent, chips), `wad_0_*` (the wad's dent: a dish, a scuffed ring, its petals' marks), each `_albedo`, `_normal` (Godot's OpenGL convention, leaning into the hole) and `_orm`; `soot_0_albedo.png` (the smoke's starburst) and `grains_0_albedo.png` (the powder's specks); `scorch_<0..1>_*` with `_emission` (an explosion's: a jagged crater, cracks, soot fanned round it, embers). Paint over them in Krita: the plugin reads whatever is there |
| **Pickups** | `pickup.gd` (`HSWeaponPickup`, a Node3D) | `kind` double (the gun lying on its side, `shells` coming with it; an older scene's `shotgun` is the double too) or shells (the prop generator's box of five, `shells_box_5`, two spilled beside it; `lid_open` shows it open, its lid swung on its own hinge; into the gun you own); `shell` the kind of shells (none: the normal; the explosive comes in its own box, `shells_box_5_explosive`, the love hearts and the water in theirs, `shells_box_5_heart` and `shells_box_5_water`; `box_model` any other); E takes it (the starter's player uses anything with `use()`), `say` a line through the Story, `taken` to wire a scare to |
| **Something to shoot** | `shootable.gd` (`HSShootable`, a Node) | put one under what can be shot (a character, a doll, a lamp): a shot with a pellet on its parent is a hit, `hit(info)`, and after `hits` of them `down`. Each a switch: `gone_secs` (gone at once and back after that long, its collision with it: a ghost's way; down, gone for good), `push_m` (shoved back), `cry` (a sound), `say` (a line), `target` (its `fire()`), `lights_out` (every light under it dark when it's down); a harmless shell's pellets aren't a hit: `touched(info)` instead |
| **A quest for being shot** | `quest/shot_with.gd` (`HSShotWith`, a Node) | put one under a character (beside her HSHitReact or HSShootable) or anything with a collider: when a shot of the kind it names lands on what it's under, it sets a fact in the Story, ticks a task, says a line, fires a target, turns her look: see *A quest for being shot*. `shell` (heart, water, buckshot, explosive, harmless, harmful, any) or `shell_id` (a kind of your own), `part` (anywhere, head, torso, arm, leg), `pellets`, `times`, `needs`, `once`, `who`; then `fact`, `tick`, `say`, `objective`, `add_tasks`, `target`, `her_look`, `look_secs`; `counted(info)`, `happened(info)`, `count`, `done`, `last`, `fire()`, `reset()`, `HSShotWith.was(node)`. Ready-made: `quest/loved.tscn`, `quest/soaked.tscn` |
| **Something that breaks** | `blowup/blow_up.gd` (`HSBlowUp`, a Node3D) | put one under any object (a made prop, a model, a MeshInstance3D): see *Things that break*. `kind` (an HSBreakKind; none: guessed, `HSBlowUp.guess_kind(node)`), `strength`, `pieces`, `whole`, `liquid`, `push`, `keep_s`, `kick`, `target`, `collider`, `preview` (its pieces drawn apart in the editor, nothing saved); `blow_up(at, dir, power, blast_at)`, `restore()`, `is_prepared()`, `report()`; `prepared`, `hit(info)`, `blown_up(pieces)`; `damage`, `is_broken`, `pieces_out`, `last` |
| **What it's made of** | `blowup/break_kind.gd` (`HSBreakKind`, a Resource) | `blowup/kinds/`: `ceramic`, `glass`, `wood`, `metal`, `cardboard`, `plastic`, `stone`: `strength`, `pieces`, `coarse`, `grain`, `crumple_m`, `dent_m`, `dent_r_m`, `hollow`, `speed`, `spin`, `bounce`, `friction`, `areal_kg`, the inside (`inside_color`, `inside_from_surface`, `inside_roughness`, `inside_metallic`, `fibres`, `speckle`, `see_through`), the debris (`dust`, `dust_color`, `chips`, `chip_style`, `sparks`, `surface`), `sound`, `clink` |
| **The cut** | `blowup/fracture.gd` (`HSFracture`, plain data) | a thing's surfaces cut into a tree of pieces in a worker thread: recursive plane slicing, each cut's outline chained into loops, its holes split off with Godot's polygon clipping and filled; single sheets (or a hollow kind) never filled, their backs drawn; the pieces split where they don't touch; parts made of materials the rest isn't (a box's shells) kept whole; crumpled; each piece's middle, axes, hull and which touch which. `blowup/inside.gdshader` (and `inside_glass.gdshader`) draws the broken faces in the thing's own space |
| **Someone who bleeds ichor** | `react/hit_react.gd` (`HSHitReact`, a Node3D) | put one under a character (the node that moves): see *Someone shot*. `health`, `head_x`, `limb_x`, `stagger`, `stagger_s`, `push_m`, `flinch`, `down_mode` (DISSOLVE, VANISH, RAGDOLL, NOTHING), `gone_secs`, `look` (an HSWoundLook; none: `react/looks/demon.tres`), `hitboxes`, `target`, `cry`, the easter eggs' `charm_s`, `charm_color`, `soak_s`; `shoot(point, dir, damage)`, `charm(secs)`, `soak(spots, dir, secs)`, `charmed()`, `soaked()`, `restore()`, `report()`; `hit(info)`, `staggered(secs)`, `down`, `touched(info)`; `damage`, `is_down`, `hit_count`, `wounds`, `marks`, `last`; `HITBOX_LAYER` (layer 11) |
| **Her flinch** | `react/flinch.gd` (`HSFlinch`, a SkeletonModifier3D) | HSHitReact puts one under her skeleton: `kick(bone, axis, amp, w, delay, drop)` turns a bone about a world axis on a critically damped spring after her animation (at its peak at 1/w s), or lowers it (a knee giving); `busy()`, `peak_now()` |
| **How she bleeds** | `react/wound_look.gd` (`HSWoundLook`, a Resource) | `react/looks/demon.tres`: the ichor (`ichor_color`, `embers`, `embers_s`, `wound_m`, `splat_m`, `splat_reach_m`, `drops`, `spray`, `pool_m`, `keep`, `evaporate_s`), the smoke (`wound_smoke`, `down_smoke`: HSMuzzleFlash looks, `react/ichor_smoke.tres` and `react/dissolve_smoke.tres`; `bleed_wounds`), her going (`char_color`, `char_edge`, `char_edge_energy`, `dissolve_s`), the sounds (`hit_sound`, `down_sound`), the ooze (`ooze`: off, or on a renderer other than Forward+, flat decals; `ooze_film`, `ooze_sheen`, `ooze_gloss`, `ooze_mirror`, `ooze_pulse`, `ooze_crawl`, `ooze_reach`, `ooze_drip`). `react/char.gdshader` (the char spreading over her, an overlay) and `react/crumble.gdshader` (her surfaces eaten away, opaque, cut out), their noise in the world (`char_noise.gdshaderinc`) |
| **The ichor alive** | `react/ooze.gd` (`HSOoze`, a MeshInstance3D) | see *The ichor alive*. `kind` (SPRAY, POOL, WOUND, DROP), `size_m`, `seed`, `depth_m`, `embers`, `embers_s`, `settle_s`, `look` (an HSWoundLook's ooze colours), `age` (where it starts: a pool long settled, 60), `preview` (it lands again and again in the editor); `now()`; `HSOoze.make_material(look, kind)`. Its shaders `react/ooze_spray`, `_pool`, `_wound`, `_drop` `.gdshader` over `react/ooze.gdshaderinc` and `react/ooze_frag.gdshaderinc` |
| **The models** | `models/` | the prop generator's `shotgun_double` (the user's model, `Content/Studio/Props/models/dbl_barrel.fbx`, made round-barrelled and painted: blued, case-hardened, checkered walnut; its `barrels` with the fore-end on their hinge, `lever`, `trigger`, `trigger2`; sockets `muzzle`, `muzzle_r`, `muzzle_l`, `chamber`, `chamber_r`, `chamber_l`, `hinge`, `breech`, `grip`, `trigger`, `shoulder`, `light`), `shell_12ga` and `shell_12ga_spent` (their brand printed along the hull, their heads stamped), `shells_box_5` (the box of shells: its lid a part on its hinge), `shell_12ga_explosive`, `shell_12ga_explosive_spent` and `shells_box_5_explosive` (the explosive kind's: a black hull printed in orange, high brass), `shell_12ga_heart`, `shell_12ga_heart_spent`, `shells_box_5_heart` (love hearts: a pink hull with little white hearts, a heart on the box) and `shell_12ga_water`, `shell_12ga_water_spent`, `shells_box_5_water` (water: a blue hull with drops), `electric_kettle` and `mug_stoneware` (two things to break: a brushed steel kettle, a stoneware mug of tea) (`tools/propgen.py make <name>`, docs/PROPGEN.md §30, §31: the shells and the box are customizable, your logo on them in the prop generator's picture editor, guides/prop_customizer) |
| **The sounds** | `sounds/` | made in code (`tools/weapon_sounds.py`: numpy, then ffmpeg to Ogg): the blast with its tail, a shell clicking in, the dry click, a hull on the floor, the handling; the break open, the snap shut and the ejectors' flick; an explosive shell bursting (`shell_burst`); a box of shells taken; a thing breaking (`break_<kind>`: its crack, its body, its pieces ringing as they part, bits landing) and a piece landing (`debris_<kind>`) for each kind; someone hit (`ichor_hit`: a heavy wet thump, the squelch of thick liquid, bubbles, a hiss) and going (`ichor_down`: a breath drawn in, a wet collapse, a long hiss with embers popping over a falling rumble); the easter eggs': `shell_heart` (a soft pomf, a pop, three little bells), `heart_pop` (hearts landing), `charm` (someone smitten: a run of bells), `shell_water` (a thump of air and the spray), `water_splash` (`--only name ...` makes just those) |

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

## The easter egg shells

Two kinds for fun, to hide in a game (DECISIONS 2026-11-11). A gun doesn't offer them until some are in its pocket: put
an **HSWeaponPickup** in a room with `kind` shells and its `shell` set to `shells/heart.tres` or `shells/water.tres`
(each comes in its own box), or `gun.add_shells(2, load(...))` from a script. T then picks them like any other kind.
Both are **harmless**: a kind whose `damage` is 0 pushes what it hits a little and leaves its own mark, but nobody is
wounded or staggered, an HSShootable doesn't count it, an HSBlowUp isn't dented or broken. Each plays its own sound
instead of the blast, is hardly heard by listeners, and leaves no ringing in the ears.

- **Love hearts** (`shells/heart.tres`, pink in the shells' row): seven hearts in a wide cone, a short reach. The muzzle
  gives a small pink flash, pink smoke, and hearts that pop out and float up (`muzzle/heart.tres`). Where each lands a
  heart is printed on the wall, upright, glowing for a few seconds and fading away after sixteen (`impacts/heart.tres`),
  and five small hearts float up from it. **Someone with an HSHitReact is smitten** (`touch` "charm"): she stands where
  she is for `charm_s` (2.5 s; whatever moves her waits, as in a stagger, with no shove), hearts floating up over her
  head, a little run of bells. Then she comes on as before.
- **Water** (`shells/water.tres`, blue): nine splashes, a wide cone, a shorter reach. No flash and no light: a spray out
  of the muzzle and a puff of mist (`muzzle/water.tres`). Each splash throws drops and mist and leaves a wet patch, dark
  only as water darkens, glossy so the flashlight finds it, running down a wall; it dries in 24 s (`impacts/water.tres`).
  **Someone is soaked** (`touch` "soak"): a start, water dripping off her for `soak_s`, her skin wet if she wears the
  Look plugin's skin. **What burns within 40 cm of a splash goes out** (`douse_m`): an explosive's embers, a made
  candle's flame (the Look plugin's HSPropFX: its `flame` switched off), and anything of yours in the group `hs_flame`
  with a `douse()` method.

Signals to hang a joke on: HSHitReact's and HSShootable's `touched(info)` (`info.touch` the kind's word, `info.kind` its
id). A kind of your own: duplicate `shells/heart.tres`, its muzzle look and its impact; `touch` can be any word, which
reaches `touched` and nothing else.

## A quest for being shot

"Make her love you", "Soak the cat", "Put a love heart in his head": an **HSShotWith** (Add Node, or drag
`quest/loved.tscn` or `quest/soaked.tscn` from the FileSystem dock onto someone) under a character, a doll, a door,
anything a pellet can land on. It needs no script:

| Its setting | What it means |
|---|---|
| **Shell** | the kind that counts: `heart`, `water`, `buckshot`, `explosive`; `harmless` (any kind whose damage is 0), `harmful` (any that hurts), `any`. **Shell Id**: a kind of your own by its id |
| **Part** | where on her: anywhere, head, torso, arm, leg (her HSHitReact's hitboxes; without one, leave it anywhere) |
| **Pellets**, **Times** | pellets of one shot on her for the shot to count; shots until it happens (a shot is one pull of the trigger) |
| **Needs** | the Story's words (`task:<id>`, `on:<id>`, `item:<name>`, a fact, `!` for not, commas for all): counted only while they hold, so a shot before its quest is on counts nothing |
| **Once** | it happens once (off: again every Times shots) |
| **Who** | the one shot, when the node isn't under them |
| Then: **Fact** | a fact set in the Story: the thing to ask afterwards |
| **Tick**, **Say**, **Objective**, **Add Tasks** | the to-do list and the words, as the starter's areas have them |
| **Target** | its `fire()`: a scare area, a cue, an event area, the lights |
| **Her Look**, **Look Secs** | her look turned (the Look plugin's HSLookSwitch under her: heart eyes), back to her own after that long (0: it stays) |

**Asking whether it happened**: the fact. A door's, an area's, a cue's, a quest marker's or a look's **Needs** takes it
(`her_loved`; three people: `her_loved, him_loved, cat_loved`), a script asks `Story.is_set("her_loved")`, and the node
itself says `done`, `count` and `last` (`HSShotWith.was(her)`: any of hers happened). Its signals `counted(info)` (each
shot that counts: `{kind, touch, pellets, part, parts, point, dir, damage, blast, count, who}`) and `happened(info)` are
there for anything else.

It listens to the guns itself, so it knows the kind of every shot, the ones that hurt too (an HSHitReact's `hit` doesn't
say), and an explosive shell's blast reaching her counts as that shell. Someone hidden isn't counted. A character with
no collider of her own needs her HSHitReact: its hitboxes are what the pellets land on. For a game built by hand (the
starter's Story); without a Story it still counts and signals.

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
  plastic, carpet, cloth, tatami, water; and a breakable thing's: sheet_metal (holed, not smeared), ceramic, cardboard), else its `acoustic` (the sound physics' word), else the starter's Sound node's
  rooms (the interior export's floor, walls and ceiling), else plaster.
- **A blast** (`impacts/explosive.tres`): a scorched crater a metre across with cracks running out of it and embers
  glowing in it for a few seconds (`fx/scorch_*`); a ball of fire (an HSMuzzle at the hit facing out of it, laid out as
  a burst: `impacts/fireball.tres`) with its light, sparks and smoke; everything in its reach (`radius_m` 2.2) and in
  its sight pushed (`power`) and told, its `damage` falling to nothing at the edge (an HSShootable counts it a hit);
  the view shaken near it, every listener hearing it (`noise` 6), the ears ringing, its sound.
- **Not yet**: pellets through a thin wall into the next room, ricochets off concrete, the wad lying on the floor.

## Things that break

Put an **HSBlowUp** under an object (docs/research/breaking_props.md):

- **When it loads** its meshes are read (its own space: where it stands and how it's turned) and cut in a worker thread
  (**HSFracture**, half a second for a kettle of 11,000 triangles): the biggest piece cut through its middle by a plane
  each time, finer than it ever breaks into, each cut's outline chained into loops on the plane and filled (holes split
  off with Godot's polygon clipping, ear-clipped); a single sheet (an edge with one triangle), or every part of a
  **hollow** kind (metal, card, glass, plastic: a kettle modelled as a closed shell is still a thin wall), never filled,
  its back drawn by the inside instead; the pieces split where they don't touch; parts made only of materials the
  biggest part isn't (a box's shells) kept whole; a crumpled kind's pieces crumpled. A thing with no collider gets one
  (a hull round its meshes, `BlowUpBody`), and every collider under it its kind's `hs_surface`.
- **Shot**: a shot's damage (its pellets on it, a blast that reaches it) past its `strength` breaks it; weaker shots
  dent metal, card and plastic (each pellet pushes the mesh in) and wear it down (2.5 times its strength in all breaks
  it). Broken, it's hidden and nothing under it is solid, and its pieces come out where its parts were in the same
  frame: the cut's leaves gathered from the farthest from the hit in, each piece grown over the leaves it touches while
  it stays as big as a piece should be there (`coarse`: small near the hit, bigger away from it; all small in a blast),
  thrown along the shot and out of the hit (a blast throws them out of itself), spinning. Its own materials on every
  piece (a world-laid triplanar made the thing's own); the broken faces the kind's inside (`inside.gdshader`: its
  colour, grit, fibres along the grain, a blast's scorch). The pellets' holes go with the piece they were on.
- **The pieces**: bigger ones (4.5 cm and more) rigid bodies whose colliders are at least 6 cm thick along each of their
  own axes (thinner sinks through a level's floor), lifted clear of the floor they start in, never knocking each other
  about nor the player, laid down onto the floor once they've gone nowhere for half a second (frozen); smaller ones fall
  by rays as the gun's hulls do, lying down flat where they stop. A made prop's parts (a lid on its hinge, `whole`) fly
  off whole; its liquid (`<name>_liquid`, the mug's tea) splashes and pools under it. The player walking into them kicks
  them on. The gun's pellets and blasts still move them.
- **Its look and sound**: dust in the inside's colour, chips, splinters, glints, paper or sparks by its kind; its
  breaking sound and its pieces landing, made in code.


## Someone shot

Put an **HSHitReact** under a character (docs/research/hit_reactions.md):

- **Her hitboxes**: her skeleton found under her, its bones named by what they are (head, neck, spine, pelvis, each arm
  and leg's pieces: MHR's names, a mannequin's, Mixamo's), a capsule along each on collision layer 11
  (`HITBOX_LAYER`) riding its bone (a BoneAttachment3D); the gun's pellets and blasts look there (`HSGun.SHOT_MASK`), the
  player never bumps into them. A stand-in with no skeleton gets one capsule round its meshes, and where it's hit is read
  from the height. Her own colliders (a body's capsule) are hers too: a pellet that hits one finds the hitbox behind it.
  Every collider of hers says `hs_surface` "ichor": no crater, no dust on her. While she's hidden (a figure not come yet,
  a searcher waiting at her post) her hitboxes stop nothing: a pellet goes through where she'd stand.
- **A hit**: the pellets of one shot added up (the head's times `head_x` 2, an arm's or a leg's `limb_x` 0.6), a blast
  taken once at its strongest; the bone hit kicked away from the shot on a spring after her animation (`HSFlinch`): the
  spine bent back, the head whipped a beat later, an arm swung, a knee giving, a stand-in tilted whole and back upright.
  The damage fills a counter: past `stagger` she's held where she is for `stagger_s` (whatever moves her: the starter's
  chase, a searcher; its position put back every frame after it, `process_priority` 100) and shoved back `push_m`; it
  empties when she staggers. Smaller hits nudge her.
- **The ichor**: a wound on her riding her bone, drops flung out of it (most along the shot, a few back toward you),
  heavy drops falling by rays and splashing where they land, the spray on the wall or the floor behind her within
  `splat_reach_m` (its drips running down a wall, none on the floor), a pool where she went; each an HSOoze (see
  *The ichor alive*), one material a kind for all she leaves; with the look's `ooze` off, or on a renderer other than
  Forward+, flat decals of the same (`fx/ichor_*`). The last `keep` marks stay; they live beside her (a node of their
  own), so they stay when she's gone.
- **The smoke**: a quarter second after the hit (once a shove has settled: smoke riding her bone drew a line through the
  air as she was thrown back), black smoke out of the wound, an HSMuzzle playing `wound_smoke` riding the bone, rising
  and trailing after her as she moves (the muzzle's own trail); `bleed_wounds` at most at once.
- **Down** at `health`: what moves her stopped (anything under her with a `stop()`: the starter's chase.gd, and its
  searcher.gd, which leaves her to dissolve), `hs_down` and, once gone,
  `hs_hidden` set for the starter's hunters; DISSOLVE (the char spreading over her own look, then her surfaces swapped
  for the char's and crumbling away from burning holes, smoke pouring off her head, hands, knees and chest, `dissolve_s`
  2.4), VANISH (gone at once in the smoke), RAGDOLL (her PhysicalBoneSimulator3D let go, else DISSOLVE) or NOTHING;
  gone, nothing of her solid and a pool of ichor where she stood. `gone_secs` brings her back whole (`restore()`).

## The ichor alive

An **HSOoze** is a box projected onto whatever it covers, as a Decal is, but drawn by a shader of its own
(docs/research/ooze.md), so the ichor moves:

- **Its shape is made in the shader**: a spray (a core of lobes, spines thrown out longer along the throw, droplets
  drawn out into tadpoles, their tails back where they came from) spreading as it lands and creeping on; on a wall,
  drips running down out of it, slowing to a stop, each trail wavering and beading behind a bulging head (the world's
  down in its own plane: none on a floor, and on her they run down her whichever way she stands); a pool spreading,
  thin tendrils reaching out of it as it ages; a wound oozing; a drop's splash. `age` drives it (HSOoze counts it until
  `settle_s`); its surface still moves after.
- **Lit where it lies**: the surface found from the depth buffer, its normal from its neighbours there,
  `LIGHT_VERTEX` set to it, so the flashlight and the lamps light it as they light the wall.
- **Black and thick**: every blob a low dome with a meniscus, so some part of it catches any light; thick, a black
  mirror whose highlight carries an oil's sheen (violet, green, gold, drifting); the room seen in its rounded edges;
  thin (its edges, the tendrils), a deep oxblood.
- **Never still**: its surface crawls, a slow double beat swells it (the highlights pulse), embers die in it.
- **On the camhybrid tape** it reads by its shine and its movement (the tape lifts black and keeps a fifth of colour's
  detail): nothing in it finer than a few millimetres.
- **By hand**: add an HSOoze anywhere (Add Child Node), turn its +Y out of the surface and its +X the way a spray was
  thrown, pick its `kind`, `size_m` and `seed`; `preview` plays it in the editor; `age` 60 shows it long settled (a
  wall that weeps, a pool in a doorway).

It needs Forward+ (it reads the depth buffer); HSHitReact falls back to plain decals elsewhere.

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
- **The ichor alive**: a spray's spines reach about half its size, its drips 0.7 of it, slowing over 2 to 7 s; a pool
  spreads to its size in a few seconds, its tendrils reaching a third of it more over half a minute; the double beat
  every 1.3 s; embers dying over `embers_s` 4 s; it stops counting at `settle_s` 40 s.
- **Someone shot**: `health` 12; staggered at 4 for 0.9 s (1.3 times from the head, 1.4 from a blast), shoved 0.35 m
  by a close shot; the flinch peaking a tenth of a second after the hit (the spine about 7° a bone from a close shot,
  the head about 25° from one in the head), gone in half a second; her smoke a quarter second after the hit.

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
- `tools/godot/shot_with_check.py` (SHOTWITH) plays HSShotWith with the real gun, the real shells and the starter's Story.
- `tools/godot/weapons_check.py` (WEAPONS) builds it into the hotel corridor of tutorial v2 and plays it headless;
  `--pictures` draws the guide's pictures (`guides/weapons/img/`).
