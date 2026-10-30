extends SceneTree
func _init():
	var m := BoxMesh.new()
	var arr := m.get_mesh_arrays()
	print("GDTEST verts=", arr[Mesh.ARRAY_VERTEX].size(), " engine=", Engine.get_version_info().string)
	quit()
