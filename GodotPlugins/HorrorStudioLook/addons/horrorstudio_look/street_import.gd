@tool
extends EditorScenePostImportPlugin
## The import step plugin.gd registers: a street baked in Blender (tools/street.py bake), dropped into the project,
## wears its dirt, rain streaks and worn edges (HSStreet.apply, street.gd). Editor only: games use HSStreet itself.


func _post_process(scene: Node) -> void:
	var n := HSStreet.apply(scene)
	if n:
		print("HorrorStudio Look: %d street materials wear their wear (%s)" % [n, scene.name])
