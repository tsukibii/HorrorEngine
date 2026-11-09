# HorrorStudio Weapons: notes for Claude

The studio's own Godot plugin for weapons held in first person (DECISIONS 2026-11-09, the user's `weapon-system`: "create
a shot gun asset and have its pov in godots horror engine similar to the screenshot, it should be equi[pp]able, can
shoot, and reloads like a shotgun with shells entering it"; "I don't need a hand holding the gun"). It lives here:
`tools/godot_byhand.py` copies `addons/horrorstudio_weapons/` into every project made by hand and enables it. The desk's
export and the Director's projects don't copy it yet (nothing in the runtime uses it).

## Map

| File | What |
|---|---|
| `shotgun.gd` | `HSShotgun`, under the player's camera (group `hs_weapon`). `_ready`: the model under a `Rig`, its parts found by their glb extras (`propgen_part` arrives as JSON text: parsed), `_place_gun` (the chamber at `hold`, the bore aimed at the view's middle `aim_at_m` ahead, canted), the flash (a star billboard, an OmniLight3D in `hs_no_zone`, smoke as additive CPUParticles3D), `_view_model` (every surface's material duplicated with z clip scale 0.35 and no shadow). `_place_gun` makes two holds, `_gun_hip` and `_gun_aim` (the bore straight ahead under the eye); `_process` goes between them by `_aim` (`set_aim`, the right button), the lens with it (`aim_fov`; the camera's own lens adopted whenever it isn't aimed), the tape's 4:3 picture (`_find_tape`: the Look plugin's vhs.gd CanvasLayer; `_hip()` drawn in by 0.75), the view settling back after the kick (`_recover`, `_turn_view`: the starter player's `pitch` and body yaw), sway (a spring on the view's turn), bob (the eye's speed over the ground), breath, the kick's spring, the reload's pose (`_pose`), lowering (`_lower`), the hull in view, the flashlight carried (`_carry_light`, its `_rot0` kept for flashlight.gd's tremor), the shells drawn (`_draw_hud`: marks and the count in the UI plugin's `theme.gd` colours). `_physics_process`: the hulls in the room by rays (`_falling`). `pull` -> `_fire` -> `_shoot` (rays from the camera in the cone, holes, dust, impulses, `shot(info)`, the flash, the kick, `hs_listener`'s `heard`, the Fear node's `ring`) -> `_rack`. `reload` (the pose, `_insert_one` a shell from under the gun into the port, a click stops it after the shell going in and fires). `_play` through the starter's Sound node (`hs_sound`), else an AudioStreamPlayer3D |
| `shootable.gd` | `HSShootable`: under what can be shot; listens to every `hs_weapon`'s `fired(hits)` (found again every half second for a gun made later), a hit when a pellet's collider is its parent or under it; `hit`, `down`; `gone_secs` hides its parent and disables its processing (its collision leaves the world) and brings it back, `push_m`, `cry`, `say`, `target.fire()` |
| `pickup.gd` | `HSWeaponPickup`: the gun (lying on its side) or a box of shells, a StaticBody3D box so the player's E ray finds it; `use()` gives it to the `hs_weapon` |
| `plugin.gd`, `plugin.cfg` | the plugin (nothing to register: the classes are `class_name`s) |
| `models/` | the prop generator's makes, copied in: `shotgun_pump.glb`, `shell_12ga.glb`, `shell_12ga_spent.glb` (`tools/propgen.py make <name>`, then copy from `Saved/Props/<name>/`) |
| `sounds/` | `tools/weapon_sounds.py` (WEAPONSOUNDS) writes them |
| `guides/weapons/` (the repo's) | the user's guide, `index.html`, and its pictures in `img/` (`tools/godot/weapons_check.py --pictures`, `weapons_shots.gd`) |

## Rules

- **No hands** (the user's). The reload's shell moves by itself: `_insert_one`'s four transforms in the gun's frame
  (from under the gun, its nose in the port, levelled on the tube's line, its base past the tube's mouth).
- **Never faster than the flash limit**: a shot, then the rack, is 0.53 s (under two flashes a second); keep it over a
  third of a second.
- **Gun-frame numbers come from the sockets**, never from the mesh: the prop generator's sockets (`socket_<name>`) are
  the truth, so a remade gun (another barrel length) holds itself.
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
not headless); an HSShootable gone at its first hit, back, and down at its second; lowered and raised (the
flashlight back); the box of shells and the gun itself taken with E.
`weapons_shots.gd` draws the pictures under xvfb (idle, aim, fire, rack, reload, floor, tape).
