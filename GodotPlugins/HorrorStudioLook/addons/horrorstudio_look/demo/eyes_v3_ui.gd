## Eyes v3, the sliders (EYESV3's second stage, headless: tools/godot/eyes_v3_check.py): the eye picker on a Studio
## export (every control a number HSEyePaint takes; a slider, a colour, a pupil and a style onto her eyes; Her own eyes;
## Save as eyes read back), an HSCharacterLook's Eye Look and Eye paint worn when the game runs and its Inspector's
## eye numbers, and the ready-made eye look. Nothing is drawn (no renderer): the eyes' numbers are what's read.
##   godot --headless --path PROJECT -s res://addons/horrorstudio_look/demo/eyes_v3_ui.gd -- --glb=res://people/NAME.glb --out=DIR
extends SceneTree

var glb := ""
var out_dir := "res://"
var rep := {}


func _initialize() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out_dir = a.substr(6)
		elif a.begins_with("--glb="):
			glb = a.substr(6)
	var who: Node3D = load(glb).instantiate()
	root.add_child(who)
	HSEye.wear(who, glb)
	var pk := HSEyePicker.new()
	root.add_child(pk)
	pk.save_dir = "res://looks/eyes_check"
	pk.setup(who)
	var takes := {}
	for c in HSEyePaint.COLOURS + HSEyePaint.CHOICES + HSEyePaint.CONTROLS:
		takes[c[0]] = true
	var sliders := 0
	var unknown: Array = []
	for sec in HSEyePicker.SECTIONS:
		for k in sec[1]:
			sliders += 1
			if not takes.has(k) or not HSEyePaint.DEFAULTS.has(k):
				unknown.append(k)
	rep["sliders"] = sliders
	rep["colours"] = HSEyePaint.COLOURS.size()
	rep["choices"] = HSEyePaint.CHOICES.size()
	rep["unknown"] = unknown
	var p := pk.painter
	if p == null:
		rep["painter"] = false
		done()
		return
	pk.set_value("irisSize", 39.0)
	pk.set_value("iris", "#1a4a8a")
	pk.set_value("pupilShape", "slit")
	var now := p.paint("L")
	var m: ShaderMaterial = p.eyes[0]["material"]
	rep["picked"] = is_equal_approx(float(now["irisSize"]), 39.0) and str(now["iris"]) == "#1a4a8a" and str(now["pupilShape"]) == "slit" \
			and absf(float(m.get_shader_parameter("rho")) - sin(deg_to_rad(39.0)) / float(p.eyes[0]["rec0"]["shape"].get("k", 1.0))) < 0.01 \
			and (m.get_shader_parameter("mesh_shape") as Vector3).x > 0.0
	pk.start_from("style", "violetSun")
	now = p.paint("L")
	rep["styled"] = str(now["pattern"]) == "sunburst" and str(now["iris"]) == "#4a1694" and str(now["pupilShape"]) == "round"
	pk.set_value("catchKeep", 1.5)
	var path := pk.save_as("check violet")
	rep["saved"] = path != "" and FileAccess.file_exists(path)
	rep["saved_path"] = path
	var back = load(path) if path != "" else null
	rep["read_back"] = back is HSEyeLook and str(back.paint.get("pattern", "")) == "sunburst" and is_equal_approx(float(back.paint.get("catchKeep", 0.0)), 1.5)
	pk.reset()
	rep["reset_clean"] = p.changes("L").is_empty() and p.changes("R").is_empty() and (m.get_shader_parameter("mesh_shape") as Vector3).x < 0.0
	pk.queue_free()
	# an HSCharacterLook on another copy of her: its Eye Look, its Eye paint, the Inspector's numbers
	var her: Node3D = load(glb).instantiate()
	root.add_child(her)
	var cl := HSCharacterLook.new()
	cl.glb_path = glb
	cl.eye_look = back if back is HSEyeLook else null
	cl.eye_paint = {"pupilShape": "heart"}
	her.add_child(cl)
	cl.wear()
	var hp := HSEyePaint.of(her)
	var worn: Dictionary = hp.paint("L") if hp != null else {}
	rep["node_look"] = str(worn.get("pattern", "")) == "sunburst"
	rep["node_paint"] = str(worn.get("pupilShape", "")) == "heart"
	var props := 0
	var own_ok := true
	for pr in cl.get_property_list():
		if String(pr["name"]).begins_with("eye/"):
			props += 1
	cl.eye_look = null
	cl.eye_paint = {}
	var rec0: Dictionary = hp.eyes[0]["rec0"].get("paint", {}) if hp != null else {}
	for k in ["irisSize", "pupil", "pattern"]:
		own_ok = own_ok and str(cl.get("eye/" + k)) == str(rec0.get(k, HSEyePaint.DEFAULTS[k]))
	rep["node_props"] = props if own_ok else 0
	# the ready-made eye look
	var ready = load("res://addons/horrorstudio_look/eyes/eyes_v3.tres") if ResourceLoader.exists("res://addons/horrorstudio_look/eyes/eyes_v3.tres") else null
	var rp: HSEyePaint = ready.wear(her) if ready is HSEyeLook else null
	rep["ready_look"] = rp != null and is_equal_approx(float(rp.paint("R").get("catchKeep", 0.0)), float(ready.paint.get("catchKeep", -1.0))) and HSEyeLook.all().size() >= 1
	done()


func done() -> void:
	var f := FileAccess.open(out_dir.path_join("v3_ui.json"), FileAccess.WRITE)
	f.store_string(JSON.stringify(rep, "  "))
	f.close()
	print("EYESV3UI {done}")
	quit()
