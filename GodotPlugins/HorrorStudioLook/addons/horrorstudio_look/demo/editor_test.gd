## LOOKPLUGIN's editor part (tools/godot/plugin_check.py copies this in as a plugin of its own and starts the editor):
## demo/editor_scene.tscn (presets placed as a user would) opened in the editor, the nodes seen working there (they
## are @tool), the scene saved, then seen on again; prints HSEDITOR {...} and quits. The check reads the saved file.
@tool
extends EditorPlugin

var t := 0.0
var opened := false
var saved_at := -1.0
var rep := {"live": {}}
var e_lo := INF
var e_hi := -INF
var busy := false                # the save draws a progress bar, running frames (and this) inside it


func _enter_tree() -> void:
	set_process(true)


func _process(dt: float) -> void:
	if busy:
		return
	t += dt
	if t > 400.0:
		print("HSEDITOR " + JSON.stringify({"live": {}, "timeout": true}))
		get_tree().quit()
		return
	if not opened and t > 3.0:
		opened = true
		EditorInterface.open_scene_from_path("res://editor_scene.tscn")
		return
	var root := EditorInterface.get_edited_scene_root()
	if root == null or root.name != "Room":
		return
	var tube = root.get_node_or_null("FluorescentTube")
	if tube != null:
		e_lo = min(e_lo, tube.light_energy)
		e_hi = max(e_hi, tube.light_energy)
	if saved_at < 0.0 and t > 25.0:
		var live: Dictionary = rep["live"]
		var rb = root.get_node("Rain")
		live["rain"] = rb.rain != null and rb.rain.multimesh != null
		live["wet"] = root.get_node("Floor").material_override is ShaderMaterial
		var sh = root.get_node("WindowShaft")
		live["shaft"] = sh.beam != null and sh.beam.get_node_or_null("Card") != null
		live["pattern"] = root.get_node("CausticsLight").light_projector != null
		live["flicker"] = e_hi - e_lo > 0.05
		live["pane"] = root.get_node("WindowPane").material_override is ShaderMaterial
		live["puddle"] = root.get_node("Puddle").decal != null
		var zone = root.get_node("RoomBulb")
		rep["zone_dbg"] = [zone.layer, zone.lights.size(), zone.get_node("Bulb").omni_range, zone.get_node("Bulb").light_cull_mask]
		live["zone"] = zone.layer > 0 and zone.lights.size() >= 1 and zone.get_node("Bulb").omni_range < 6.0 and zone.get_node("Bulb").light_cull_mask != 0xFFFFFFFF
		saved_at = t
		busy = true
		rep["saved"] = EditorInterface.save_scene() == OK
		busy = false
		return
	if saved_at > 0.0 and t > saved_at + 1.0:
		rep["after"] = root.get_node("Floor").material_override is ShaderMaterial and root.get_node("WindowPane").material_override is ShaderMaterial
		print("HSEDITOR " + JSON.stringify(rep))
		get_tree().quit()
