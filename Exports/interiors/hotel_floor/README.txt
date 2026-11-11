hotel_floor.glb: the level (the set hotel_floor) as the scene builder shows it, made for a Godot 4 project built by hand.

Drag this folder into your project's FileSystem dock, then drag hotel_floor.glb into a scene (or double-click it and
choose New Inherited Scene to make it your own). Y is up, a unit is a metre, the level sits where the desk has it.

Inside it:
  visual/        every room's walls, floors, ceilings, trim and things, each piece a node by its id, with its
                 materials (the PBR sets it wears, at their real size)
  doors/         each door its own node, its origin on the hinge: turn it about Y to open it (its collider goes with it);
                 a locked one's metadata says what opens it (locked_by: an item's name, or flag:<name>)
  collision/     the walls, floors, ceilings and things you'd bump into, one *-colonly mesh a room: Godot makes each a
                 StaticBody3D with its shape on import, so a CharacterBody3D walks on the floors and stops at the walls
  occluders/     the walls, floors and ceilings as *-occonly boxes: Godot's occlusion culling (turn it on in Project
                 Settings > Rendering > Occlusion Culling > Use Occlusion Culling)
  lights/        the level's lamps (OmniLight3D, SpotLight3D): delete them to light it all by hand
  markers/       player_start, every spot (spot_<id>) and trigger area (trigger_<id>) as empty nodes, their -Z
                 their facing, what they are in their metadata; a room's trigger_<room>__volume also its floor's
                 kind and the sets on its floor, walls and ceiling (the starter kit's sound and footsteps read them)

The HorrorStudio Look plugin (GodotPlugins/HorrorStudioLook) gives it the studio's look: guides/godot_by_hand.
