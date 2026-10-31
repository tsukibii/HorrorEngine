@tool
extends EditorScenePostImportPlugin
## The import step plugin.gd registers: a street baked in Blender (tools/street.py bake), dropped into the project,
## wears its dirt, rain streaks and worn edges (HSStreet.apply, street.gd), and its road paint and decals cast no
## shadow of their own (HSStreet.lay_flat; the street builder's own .glb too).
## Editor only: games use HSStreet itself.


func _post_process(scene: Node) -> void:
	var n := HSStreet.apply(scene)
	var flat := HSStreet.lay_flat(scene)
	if n or flat:
		print("HorrorStudio Look: %d street materials wear their wear, %d meshes of paint and decals lie flat (%s)" % [n, flat, scene.name])
