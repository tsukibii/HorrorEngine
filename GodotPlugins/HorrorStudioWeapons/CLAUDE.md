# HorrorStudio Weapons: notes for Claude

The studio's own Godot plugin for weapons held in first person (DECISIONS 2026-11-09, the user's `weapon-system`: "create
a shot gun asset and have its pov in godots horror engine similar to the screenshot, it should be equi[pp]able, can
shoot, and reloads like a shotgun with shells entering it"; "I don't need a hand holding the gun"). It lives here:
`tools/godot_byhand.py` copies `addons/horrorstudio_weapons/` into every project made by hand and enables it. The desk's
export and the Director's projects don't copy it yet (nothing in the runtime uses it).

## Map

| File | What |
|---|---|
| `shotgun.gd` | `HSShotgun`, under the player's camera (group `hs_weapon`). `_ready`: the model under a `Rig`, its parts found by their glb extras (`propgen_part` arrives as JSON text: parsed), `_place_gun` (the chamber at `hold`, the bore aimed at the view's middle `aim_at_m` ahead, canted), `_kinds_ready` (the shell kinds: `kinds`, the plugin's buckshot and explosive when empty; `load_kind`), `_make_muzzles` (an HSMuzzle at each of `_muzzle_names()`'s sockets, its -Z along the socket's +Y, `view_model`), `_view_model` (every surface's material duplicated with z clip scale 0.35 and no shadow, every mesh on render layer 20: `VIEW_LAYER`, never in a mirror, no mark lands on it). `_place_gun` makes two holds, `_gun_hip` and `_gun_aim` (the bore straight ahead under the eye); `_process` goes between them by `_aim` (`set_aim`, the right button), the lens with it (`aim_fov`; the camera's own lens adopted whenever it isn't aimed), the tape's 4:3 picture (`_find_tape`: the Look plugin's vhs.gd CanvasLayer; `_hip()` drawn in by 0.75), the view settling back after the kick (`_recover`, `_turn_view`: the starter player's `pitch` and body yaw), the run pose (`_run`, from the eye's speed over the ground), sway (a spring on the view's turn), bob (the eye's speed over the ground), breath, the kick's spring, the reload's pose (`_pose`), lowering (`_lower`), the hull in view, the flashlight carried (`_carry_light`, its `_rot0` kept for flashlight.gd's tremor), the shells drawn (`_draw_hud`: marks and the count in the UI plugin's `theme.gd` colours). `_physics_process`: the hulls in the room by rays (`_falling`). `pull` -> `_fire` (the chambered shell's kind) -> `_shoot(kind, barrel)` (rays from the camera in the kind's cone, impulses, `shot(info)` with its `damage` and `kind`, `HSImpacts.play_shot` (the marks, the debris, a blast's hits added to the shot's), the muzzle's `fire(kind.muzzle, clear, this_side)` (the room ahead of the muzzle shortening the plume; a wall between the eye and the muzzle: the light and smoke this side), the kick, `hs_listener`'s `heard`, the Fear node's `ring`) -> `_rack` (`_chamber_next`: the tube's front kind into the chamber; `_eject` by the kind's model). The kinds: `tube` (kept as long as `loaded`: `_tube_fit`), `chamber_kind`, `load_kind`, `pocket` (the other kinds' shells; `spare` the loaded kind's), `set_load_kind`, `next_kind` (T), `add_shells(n, kind)`, `shells_of`, `_model_of(kind, spent)`; the HUD's marks in the kinds' colours (`_tint`, `_kind_dot`). `reload` (the pose, `_insert_one` a shell from under the gun into the port, a click stops it after the shell going in and fires). `_play` through the starter's Sound node (`hs_sound`), else an AudioStreamPlayer3D |
| `double.gd` | `HSDoubleBarrel`, an HSShotgun (the user's v2: "only the barrel is visible in frame, unless we reload then it splits in two within frame and two shells pop in"). `_init` sets the hold low (only the barrels in the view: `hold`, `aim_at_m`), `capacity` 2 and the reload's pose (`pose_off`, `pose_rot`: HSShotgun reads them in `_process`). `_find_parts` adds the double's parts (`barrels` and its hinge axis, `lever`, `trigger2`) and moves the sockets that ride on the barrels (the muzzles, the chambers, the light) under them; `_place_gun` places by the barrels shut. `_fire` the right barrel then the left (`live`, `spent`, `barrel_kind`, the hull left in its chamber: `_seat`; `_shoot(kind, b)` from that barrel's muzzle: `_muzzle_names` the right's and the left's); `reload` (the pose, the lever, `opened` to 1, `_flick` the spent hulls into `_flying`, `_pop_in` a shell a chamber, shut, the pose back; `_cancel` fires after); `_process` turns the barrels and the lever; `_draw_hud` two marks |
| `muzzle/` | **the muzzle system** (DECISIONS 2026-11-09, latest): `muzzle.gd` `HSMuzzle` (any gun's muzzle: `fire(look, clear_m, from)`; `_build` the nodes (Wings: one MultiMesh of unit spheres, its two ShaderMaterials; Light in `hs_no_zone`; Sparks and Puffs as CPUParticles3D; Trail an ImmediateMesh ribbon, top-level), `_lay` the layout (`_chain` a wing's run of spheres spaced by their sizes, overlapping, fitted to its length; STAR or BURST; kept in `_layout` for checks: a headless renderer keeps no MultiMesh), `_process` the flash's age, the light's fall, `_trail` (points left by distance or time, drifting by when they were left, a camera-facing strip never flipped); `tex()` (a texture with mipmaps built), `puff_mesh()`, `spark_mesh()`; `preview` in the editor), `muzzle_flash.gd` `HSMuzzleFlash` (the look, a Resource), `buckshot.tres`, `explosive.tres`; the shaders: `flash.gdshaderinc` (the burn: the noise triplanar on each sphere, burnt by the facing, 1 - (1 - noise) / facing; the ramp; the z clip and fov override in `vertex`), `flash.gdshader` (added) and `flash_solid.gdshader` (solid, cut), `spark.gdshader` (a streak along the particle's aligned Y), `smoke.gdshader` (the trail), `puff.gdshader` (particle billboards), `smoke_light.gdshaderinc` (smoke's light, each source capped) |
| `shells/` | `shell_type.gd` `HSShellType` (a kind of shell, a Resource: pellets, spread, reach, push, damage, recoil, noise, `muzzle`, `impact`, `model`, `spent_model`, `color`), `buckshot.tres`, `explosive.tres` |
| `impacts/` | `impact.gd` `HSImpact` (what a hit does, a Resource: the mark, the debris, the blast), `impacts.gd` `HSImpacts` (one in a scene, group `hs_impacts`: `of(tree)`, `play`, `play_shot`, `surface_of` (`hs_surface`, `acoustic`, the Sound node's `surface_of`/`_surface`, plaster), `SURFACES`, `_mark` (a Decal with `fx/` maps, tinted, on what it hit, `MARK_MASK` leaving out layers 19 and 20), `_debris` (`_burst` emitters freed after), `_blast` (the fireball an HSMuzzle, a sphere query in its line of sight: pushed, told, hits returned; `_shake` the camera's offsets, the noise, the ring, `shell_burst`)), `pellet.tres`, `explosive.tres`, `fireball.tres` (an HSMuzzleFlash, BURST) |
| `fx/` | `tools/weapon_fx.py` (WEAPONFX) writes them: `flash_noise.png`, `puff.png`, `crater_<0..3>_*`, `scorch_<0..1>_*` (albedo, normal in OpenGL's convention, ORM; the scorch's emission) |
| `shootable.gd` | `HSShootable`: under what can be shot; listens to every `hs_weapon`'s `fired(hits)` (found again every half second for a gun made later), a hit when a pellet's collider is its parent or under it; `hit`, `down`; `gone_secs` hides its parent and disables its processing (its collision leaves the world) and brings it back as it was, `push_m`, `cry`, `say`, `target.fire()`, `lights_out` (down: every Light3D under it hidden, sparks) |
| `pickup.gd` | `HSWeaponPickup`: the gun (lying on its side; `kind` shotgun or double, the gun under the camera of that class) or a box of shells (`shell`: its kind, its box `models/shells_box_5_<id>.glb` when there is one, `box_model`) (`models/shells_box_5.glb`, two shells spilled beside it; `lid_open`: `_open_lid` turns the glb's `lid` part, found by its `propgen_part` extras, about its axis), a StaticBody3D box so the player's E ray finds it; `use()` gives it to the `hs_weapon` |
| `plugin.gd`, `plugin.cfg` | the plugin (nothing to register: the classes are `class_name`s) |
| `icons/` | the classes' icons in Add Node (`@icon`): `shotgun.svg`, `double.svg`, `shells.svg` (the pickup), `shootable.svg`, `muzzle.svg`, `flash.svg` (HSMuzzleFlash), `shell_type.svg`, `impact.svg` (HSImpact, HSImpacts) |
| `models/` | the prop generator's makes, copied in: `shotgun_pump.glb`, `shotgun_double.glb` (the user's model, `Content/Studio/Props/models/dbl_barrel.fbx`, PROPGEN §30), `shell_12ga.glb`, `shell_12ga_spent.glb`, `shells_box_5.glb`, `shell_12ga_explosive.glb`, `shell_12ga_explosive_spent.glb`, `shells_box_5_explosive.glb` (the `ammo` family's, PROPGEN §31: customizable) (`tools/propgen.py make <name>`, then copy from `Saved/Props/<name>/`) |
| `sounds/` | `tools/weapon_sounds.py` (WEAPONSOUNDS) writes them |
| `guides/weapons/` (the repo's) | the user's guide, `index.html`, and its pictures in `img/` (`tools/godot/weapons_check.py --pictures`, `weapons_shots.gd`) |

## Rules

- **No hands** (the user's). The reload's shell moves by itself: `_insert_one`'s four transforms in the gun's frame
  (from under the gun, its nose in the port, levelled on the tube's line, its base past the tube's mouth).
- **Never faster than the flash limit**: a shot, then the rack, is 0.53 s (under two flashes a second); keep it over a
  third of a second.
- **Gun-frame numbers come from the sockets**, never from the mesh: the prop generator's sockets (`socket_<name>`) are
  the truth, so a remade gun (another barrel length) holds itself.
- **The flash is the user's way** (DECISIONS 2026-11-09, latest): wings of slightly elongated intersecting spheres,
  fronts culled, the noise triplanar on each, burnt by the facing through a colour burn with the noise as the base:
  burn(noise, facing) = 1 - (1 - noise) / facing (the other way round makes a flat white core with holes: LESSONS).
- **Smoke never darkens and never takes a light at full strength from a few centimetres** (`smoke_light.gdshaderinc`'s
  cap): lit by the flash beside it, smoke glowed as a ball the size of the room.
- **A shell's kind travels with it**: the tube, the chamber, each barrel and the pocket keep kinds; `loaded`,
  `chambered` and `spare` keep their meaning (scripts and checks set them: the tube heals to the normal kind).
- **Small debris never as a RigidBody3D on a level's floor**: under 2 cm thick it sinks through a trimesh floor in the
  physics engine's penetration slop (LESSONS); the hulls fall by rays.

## Checking it

`python tools/godot/weapons_check.py [--reuse] [--pictures [--only idle,fire]]` (WEAPONS): a `godot_byhand.py new`
project with the hotel floor's interior (tutorial v2's set), played headless by `tools/godot/weapons_test.gd`: where it's
held, a view model, the flashlight carried; a shot at a dummy (pellets in the cone, holes, told, heard, the ears, the
kick, the flash); the rack (the pump to its stop and back, the bolt's face, the hull lying on its side on the floor to
the right); the view settling back after the kick; aimed (the barrel straight ahead under the view's middle, the lens
narrower and back, the cone tighter); under a 4:3 tape the gun drawn in and back; a crate pushed; fired dry to a click,
under the flash limit; the reload's four shells each from under the
gun into the tube, the count, the rack; a reload stopped by a shot that fires; R and Q (a click needs a captured mouse:
not headless); an HSShootable gone at its first hit, back, and down at its second; a lamp shot out (lights_out); the shells' row low on the
right by its rule and above an HSHud's keys; against a wall the flash's light and smoke this side and a hull thrown into
the wall at your right down this side (headless the view is 64 x 64: rules, not pixels); carried low while
running; lowered and raised (the flashlight back); the box of shells and the gun itself taken with E.
`weapons_shots.gd` draws the pictures under xvfb (idle, aim, fire, rack, reload, floor, tape, and box and box_open: the
box of shells close up under a held light, shut and its lid opened). **The double's half**
(`weapons_double_test.gd`, the same corridor with an HSDoubleBarrel, `double.tscn`): only the barrels in the view (the
muzzles toward the middle, the breech under the frame, the hinge at its edge), the right barrel then the left then a
click (each trigger moved), the reload (opened once all the way, the lever over, the chambers in the view, both hulls
flicked and lying on the floor, two shells popped in, shut, back to shut), one barrel's reload leaving the live shell,
a full gun looked into, one shell for two chambers, a shot during it, the pickup of kind double;
`weapons_double_shots.gd` its pictures (double_idle, double_fire, double_open, double_pop, double_shut). **The muzzle and
the kinds** (weapons_test.gd §8f, §8g): the flash a star of 5 wings of intersecting spheres with a plume, fronts culled,
burnt; gone in 6 frames; the smoke trail left behind as the muzzle swings; a mark with its three maps for each pellet,
tinted by its surface, dust and chips; T to the explosive, the tube in order, one slug, its flash, the blast (a ball of
fire, a scorch with embers, the crate pushed away, the dummy in reach told with its damage and not the far one, a
shootable hit, heard, the view shaken and settled), T back; the double's explosive in the right barrel firing from its
own muzzle. `weapons_shots.gd` adds trail, marks, explosive, blast, scorch; `muzzle_shots.gd` flash_parts (the spheres
bare, burnt, the star, the explosive's).
