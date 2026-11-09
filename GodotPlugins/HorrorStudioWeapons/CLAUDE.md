# HorrorStudio Weapons: notes for Claude

The studio's own Godot plugin for weapons held in first person (DECISIONS 2026-11-09, the user's `weapon-system`: "create
a shot gun asset and have its pov in godots horror engine similar to the screenshot, it should be equi[pp]able, can
shoot, and reloads like a shotgun with shells entering it"; "I don't need a hand holding the gun"; then a double barrel
from their own model; then, last, "I don't want the single barrel shotgun, only the double barrel one"). It lives here:
`tools/godot_byhand.py` copies `addons/horrorstudio_weapons/` into every project made by hand and enables it. The desk's
export and the Director's projects don't copy it yet (nothing in the runtime uses it).

## Map

| File | What |
|---|---|
| `gun.gd` | `HSGun` (`@abstract`: never in Add Node), what a gun is, under the player's camera (group `hs_weapon`). `_ready`: the model under a `Rig`, its parts found by their glb extras (`propgen_part` arrives as JSON text: parsed; the base finds the `trigger`), the sockets (`socket_<name>`, `_sock`), `_place_gun` (the `chamber` at `hold`, the bore (`chamber` to `muzzle`) aimed at the view's middle `aim_at_m` ahead, canted; and `_gun_aim`, the bore straight ahead under the eye), `_kinds_ready` (the shell kinds: `kinds`, the plugin's buckshot and explosive when empty; `load_kind`), `_make_muzzles` (an HSMuzzle at each of `_muzzle_names()`'s sockets, its -Z along the socket's +Y, `view_model`), `_view_model` (every surface's material duplicated with z clip scale 0.35 and no shadow, every mesh on render layer 20: `VIEW_LAYER`, never in a mirror, no mark lands on it). `_process` goes between the holds by `_aim` (`set_aim`, the right button), the lens with it (`aim_fov`), the tape's 4:3 picture (`_find_tape`, `_hip()` drawn in by 0.75), the view settling back after the kick (`_recover`, `_turn_view`), the run pose (`_run`), sway, bob, breath, the kick's spring, the reload's pose (`_pose` by `pose_off`/`pose_rot`), lowering (`_lower`), the flashlight carried (`_carry_light`, its `_rot0` kept for flashlight.gd's tremor), the HUD (`_make_hud`, `_hud_at`, `_mark`, `_kind_dot`, `_tint`: the UI plugin's `theme.gd` colours). `_physics_process`: the hulls in the room (`_falling`), moved by `_hull_hit` (rays from a hull's base end, middle and mouth end: `HULL_POINTS`), rolling on the floor checked too; `_fly` the hulls in the gun's frame for 0.22 s, then `_drop` (the three points brought back this side of a wall the eye can't see them through). `pull` -> the gun's `_fire` -> `_shoot(kind, barrel)` (the pattern's apex the muzzle's point on the view's line, `start` the eye when a wall is nearer; rays (`_ray`, past hidden colliders) in `_spread(barrel)`'s cone, impulses, `shot(info)` with its `damage`, `kind`, `muzzle`, `HSImpacts.play_shot` (the marks, a blast's hits added), the muzzle's `fire(kind.muzzle, clear, this_side)`, the kick, `hs_listener`'s `heard`, the Fear node's `ring`). Abstract: `_fire()`, `reload()`, `_draw_hud()`; `_spread(barrel)`, `_muzzle_names()` overridable. `_play` through the starter's Sound node (`hs_sound`), else an AudioStreamPlayer3D |
| `double.gd` | `HSDoubleBarrel`, an HSGun: the plugin's shotgun (the user's: "only the barrel is visible in frame, unless we reload then it splits in two within frame and two shells pop in"). `_init` sets the hold low (only the barrels in the view: `hold`, `aim_at_m`, `aim_hold`), `capacity` 2 and the reload's pose. `_ready` its model (`models/shotgun_double.glb`) and sounds; `_find_parts` adds `barrels` (its hinge axis), `lever`, `trigger2` and moves the sockets that ride on the barrels (the muzzles, the chambers, the light) under them; `_place_gun` places by the barrels shut. `_fire` the right barrel then the left (`live`, `spent`, `barrel_kind`, the hull left in its chamber: `_seat`; `_shoot(kind, b)`); `chokes` and `_spread` (each barrel's cone); `_muzzle_names` the right's and the left's; `reload` (the pose, the lever, `opened` to 1, `_flick` the spent hulls into `_flying`, `_pop_in` a shell a chamber, shut, the pose back; `_cancel` fires after); `_process` turns the barrels and the lever, and makes the chambers follow a script's `loaded` (`_load_to`) when it isn't busy; `_draw_hud` two marks |
| `shotgun.gd` | the double under its old path (`extends HSDoubleBarrel`, nothing else): a scene made with the pump-action gun still loads. Nothing new uses it |
| `muzzle/` | **the muzzle system** (DECISIONS 2026-11-09, latest): `muzzle.gd` `HSMuzzle` (any gun's muzzle: `fire(look, clear_m, from)`; `_build` the nodes (Wings: one MultiMesh of unit spheres, its two ShaderMaterials; Light in `hs_no_zone`; Sparks and Puffs as CPUParticles3D; Trail an ImmediateMesh ribbon, top-level; the look's `smoke_light_cap` and `smoke_glow` on the puffs' and the trail's materials), `_lay` the layout (`_chain` a wing's run of spheres spaced by their sizes, overlapping, fitted to its length; STAR or BURST; kept in `_layout` for checks: a headless renderer keeps no MultiMesh), `_process` the flash's age, the light's fall, `_trail` (points left by distance or time, drifting by when they were left, a camera-facing strip never flipped); `tex()` (a texture with mipmaps built), `puff_mesh(tex, occlude)`, `spark_mesh()`; `preview` in the editor), `muzzle_flash.gd` `HSMuzzleFlash` (the look, a Resource), `buckshot.tres`, `explosive.tres`; the shaders: `flash.gdshaderinc` (the burn: the noise triplanar on each sphere, burnt by the facing, 1 - (1 - noise) / facing; the ramp; the z clip and fov override in `vertex`), `flash.gdshader` (added) and `flash_solid.gdshader` (solid, cut), `spark.gdshader` (a streak along the particle's aligned Y), `smoke.gdshader` (the trail), `puff.gdshader` (particle billboards, premultiplied: `PREMUL_ALPHA_FACTOR` the cover, `ALPHA` the cover times `occlude`), `smoke_light.gdshaderinc` (smoke's light, each source capped at `light_cap`) |
| `shells/` | `shell_type.gd` `HSShellType` (a kind of shell, a Resource: pellets, spread, reach, push, damage, recoil, noise, `muzzle`, `impact`, `model`, `spent_model`, `color`), `buckshot.tres`, `explosive.tres` |
| `impacts/` | `impact.gd` `HSImpact` (what a hit does, a Resource: the mark; Together: `merge_m`, `merge_min`, `soot_m`, `powder_m`, `wad_m`; the debris; the blast), `impacts.gd` `HSImpacts` (one in a scene, group `hs_impacts`: `of(tree)`, `play`, `play_shot` (`clusters`: union-find over each collider's hits within `merge_m`, biggest first; a group of `merge_min` or more `_torn`, the rest `play` each; `_powder_and_wad` round the biggest group by the muzzle's distance; `last_shot`), `surface_of` (`hs_surface`, `acoustic`, the Sound node's `surface_of`/`_surface`, plaster), `SURFACES` (`hard`: concrete, stone, metal), `_mark` (a Decal with `fx/` maps, tinted, on what it hit, `MARK_MASK` leaving out layers 19 and 20; on a hard surface a crater or a torn hole is a `smear`; soot and grains colour only; `hs_mark` metadata its kind), `_debris` (`_burst` emitters freed after), `_blast` (the fireball an HSMuzzle, a sphere query in its line of sight: pushed, told, hits returned; `_shake` the camera's offsets, the noise, the ring, `shell_burst`)), `pellet.tres`, `explosive.tres`, `fireball.tres` (an HSMuzzleFlash, BURST) |
| `fx/` | `tools/weapon_fx.py` (WEAPONFX) writes them: `flash_noise.png`, `puff.png`, `crater_<0..3>_*`, `blast_<0..2>_*`, `smear_<0..1>_*`, `wad_0_*` (albedo, normal in OpenGL's convention, ORM), `scorch_<0..1>_*` (with the emission), `soot_0_albedo.png`, `grains_0_albedo.png` |
| `shootable.gd` | `HSShootable`: under what can be shot; listens to every `hs_weapon`'s `fired(hits)` (found again every half second for a gun made later), a hit when a pellet's collider is its parent or under it; `hit`, `down`; `gone_secs` hides its parent and disables its processing (its collision leaves the world) and brings it back as it was, `push_m`, `cry`, `say`, `target.fire()`, `lights_out` (down: every Light3D under it hidden, sparks) |
| `pickup.gd` | `HSWeaponPickup`: the gun (lying on its side; `kind` double, an older `shotgun` the same) or a box of shells (`shell`: its kind, its box `models/shells_box_5_<id>.glb` when there is one, `box_model`) (`models/shells_box_5.glb`, two shells spilled beside it; `lid_open`: `_open_lid` turns the glb's `lid` part, found by its `propgen_part` extras, about its axis), a StaticBody3D box so the player's E ray finds it; `use()` gives it to the `hs_weapon` |
| `plugin.gd`, `plugin.cfg` | the plugin (nothing to register: the classes are `class_name`s) |
| `icons/` | the classes' icons in Add Node (`@icon`): `double.svg` (HSDoubleBarrel; HSGun, abstract, has none), `shells.svg` (the pickup), `shootable.svg`, `muzzle.svg`, `flash.svg` (HSMuzzleFlash), `shell_type.svg`, `impact.svg` (HSImpact, HSImpacts) |
| `models/` | the prop generator's makes, copied in: `shotgun_double.glb` (the user's model, `Content/Studio/Props/models/dbl_barrel.fbx`, PROPGEN §30), `shell_12ga.glb`, `shell_12ga_spent.glb`, `shells_box_5.glb`, `shell_12ga_explosive.glb`, `shell_12ga_explosive_spent.glb`, `shells_box_5_explosive.glb` (the `ammo` family's, PROPGEN §31: customizable) (`tools/propgen.py make <name>`, then copy from `Saved/Props/<name>/`) |
| `sounds/` | `tools/weapon_sounds.py` (WEAPONSOUNDS) writes them, each from its own pinned seed |
| `guides/weapons/` (the repo's) | the user's guide, `index.html`, and its pictures in `img/` (`tools/godot/weapons_check.py --pictures`, `weapons_shots.gd`, `muzzle_shots.gd`) |

## Rules

- **No hands** (the user's). The reload's shells move by themselves: `_pop_in` from behind the breech and a little over
  it, along the bore into the chamber.
- **Never three flashes in a second** (the flash limit): two barrels as fast as they're pulled (0.24 s apart), then the
  reload (1.6 s). WEAPONS fires as fast as it can and counts.
- **Gun-frame numbers come from the sockets**, never from the mesh: the prop generator's sockets (`socket_<name>`) are
  the truth, so a remade gun (another barrel length) holds itself.
- **The flash is the user's way** (DECISIONS 2026-11-09, latest): wings of slightly elongated intersecting spheres,
  fronts culled, the noise triplanar on each, burnt by the facing through a colour burn with the noise as the base:
  burn(noise, facing) = 1 - (1 - noise) / facing (the other way round makes a flat white core with holes: LESSONS).
- **Smoke never takes a light at full strength from a few centimetres** (`smoke_light.gdshaderinc`'s cap, the look's
  `smoke_light_cap`), **and a cloud converges to its lit colour** (the puffs premultiplied, `occlude`): lit by the flash
  beside it, smoke glowed as a ball the size of the room, and a second barrel's flash through the first's smoke was a
  white ball. An impact's dust only adds (`occlude` 0): it never hides the wall.
- **The pattern spreads from the muzzle**, on the view's line (LESSONS): its sizes are a real gun's at the muzzle's
  distance; the wall damage follows docs/research/shotgun_damage.md (by distance: one torn hole and the powder, a torn
  middle and the wad, separate holes; lead smears on hard surfaces).
- **A shell's kind travels with it**: each barrel and the pocket keep kinds; `loaded` and `spare` keep their meaning
  (scripts and checks set them: the chambers follow `loaded` with the normal kind).
- **Small debris never as a RigidBody3D on a level's floor**: under 2 cm thick it sinks through a trimesh floor in the
  physics engine's penetration slop (LESSONS); the hulls fall and roll by rays, three of them (a point slips through
  the gap a door's collider leaves at its jamb).

## Checking it

`python tools/godot/weapons_check.py [--reuse] [--pictures [--only idle,fire]]` (WEAPONS): a `godot_byhand.py new`
project with the hotel floor's interior (tutorial v2's set), an HSDoubleBarrel under the starter's player's eye (the
node `Player/Eye/Shotgun`), played headless by `tools/godot/weapons_test.gd`:
- **held**: only the barrels in the view (the muzzles toward its middle, the breech under the frame, the hinge at its
  edge, the butt behind the eye), their line on the view's middle, a view model, the flashlight carried and its tremor;
- **a shot at a dummy**: the pellets in the right barrel's cone, every pellet a hole (alone or in a torn one:
  `last_shot`), told, heard, the ears, the kick, the flash, a hitch, the view settling back;
- **the barrels**: the right then the left (each trigger moved, the left inside its tighter cone) then a click;
- **aimed** (the barrels straight ahead under the view's middle, the lens narrower and back, the cone the barrel's own);
  a hidden body not shot; under a 4:3 tape the gun drawn in and back; a crate pushed carrying its holes;
- **never three flashes in a second**;
- **the reload**: opened once all the way, the lever over, the chambers in the view, both hulls flicked and lying on
  the floor, two shells popped in, shut, back to shut, under 2.2 s; one barrel's reload leaving the live shell, a full
  gun looked into, one shell for two chambers, a shot during it;
- **the controls**: R and Q (a click needs a captured mouse: not headless); an HSShootable gone at its first hit, back,
  and down at its second; a lamp shot out; the shells' row low on the right and above an HSHud's keys; carried low while
  running;
- **against a wall**: the flash's light and smoke this side, and the hulls flicked out beside a wall at your right come
  down this side of it (headless the view is 64 x 64: rules, not pixels);
- **the muzzle** (§8f): a star of 5 wings of intersecting spheres with a plume, fronts culled, burnt; gone in 6 frames;
  the smoke trail left behind as the muzzle swings; a hole for every pellet with its maps, tinted by its surface, dust
  and chips;
- **what a 12-gauge leaves** (§8g): two panels across the corridor's east end (plaster, concrete), the right barrel
  seeded at an arm's length (the muzzle 0.15 m off: one hole of 7 or more under 1.5 cm across, soot and grains, no wad), across a room
  (3.5 to 9.5 cm across, a torn middle with holes round it, the wad, no powder), down a corridor (7 to 16.5 cm across,
  5 or more alone, the wad) and on concrete (smears, no holes);
- **the explosive** (§8h): T to it, the explosive popped into the right barrel alone, a slug from its own muzzle with its
  own flash, its blast (a ball of fire, a scorch with embers, the crate pushed away, the dummy in reach told with its
  damage and not the far one, a shootable hit, heard, the view shaken and settled), T back;
- **the rest**: lowered and raised (the flashlight back); the box of shells and the gun itself taken with E.

`weapons_shots.gd` draws the pictures under xvfb: idle, aim, fire, fire_left (the left barrel through the first's
smoke), open, pop, floor, tape, trail; damage_arm, damage_room, damage_corridor and damage_concrete (two panels with
meshes, shot seeded as the check shoots them, each close in a raking light); explosive, blast, scorch; box and box_open.
`muzzle_shots.gd` draws flash_parts (the spheres bare, burnt, the star, the explosive's).
