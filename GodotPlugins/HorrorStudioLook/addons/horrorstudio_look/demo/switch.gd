## A character's looks, switched (HSLookSwitch, HSLookPreset, HSLookPicker: docs/GODOT_LOOK.md §5r;
## tools/godot/look_switch_check.py runs it: LOOKSWITCH). Headless, no pictures: a made-up figure (a skin, two eyes on
## the eye shader, a shirt) with a switch and seven looks, counted as it turns: a look at once and her default exactly
## back; a turn over a second (the old fading out, the swap, the new coming in); the cloak with her eyes left and with
## them cloaked; an amount alone; shadows; next and fire; the story's looks, with the starter kit's own Story
## (res://starter/story.gd when the project has it) and its event area; the picker (a word picked, a look saved as a
## .tres and read back, the code, the panel over the game). Then, given a Studio export (`--glb=`), the same switch
## under her beside her HSCharacterLook.
##   godot --headless --path PROJECT -s res://addons/horrorstudio_look/demo/switch.gd -- --out=DIR [--glb=FILE]
extends SceneTree

var out_dir := "res://"
var glb := ""
var rep := {}
var n := 0
var who: Node3D = null
var who_sw: HSLookSwitch = null
var heard: Array = []


func _initialize() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out_dir = a.substr(6)
		elif a.begins_with("--glb="):
			glb = a.substr(6)


func P(d: Dictionary) -> HSLookPreset:
	return HSLookPreset.make(d)


func figure() -> Node3D:
	var her := Node3D.new()
	her.name = "Her"
	root.add_child(her)
	for nm in ["her_skin", "her_eye_L", "her_eye_R", "her_shirt"]:
		var mi := MeshInstance3D.new()
		mi.name = nm
		var sm := SphereMesh.new()
		sm.radius = 0.05
		sm.height = 0.1
		var own := StandardMaterial3D.new()
		own.albedo_color = Color(0.7, 0.5, 0.4)
		sm.material = own
		mi.mesh = sm
		if nm.contains("_eye_"):
			mi.set_surface_override_material(0, HSEye.material({}, null))
		her.add_child(mi)
	return her


func skin_of(mi: MeshInstance3D) -> String:       # the creature skin on a mesh, or "default"
	var m := mi.get_surface_override_material(0)
	return str(m.get_meta("hs_creature")) if m != null and m.has_meta("hs_creature") else "default"


func eyes_of(mi: MeshInstance3D) -> String:       # the eye look on an eye, "default", or "cloaked" (no eye shader on it now)
	var m := mi.get_surface_override_material(0)
	if not (m is ShaderMaterial) or m.shader != HSEye.shader():
		return "cloaked"
	return str(m.get_meta("hs_eye_fx")) if m.has_meta("hs_eye_fx") else "default"


func state(her: Node3D) -> Dictionary:
	return {"skin": skin_of(her.get_node("her_skin")), "shirt": skin_of(her.get_node("her_shirt")),
		"eye_l": eyes_of(her.get_node("her_eye_L")), "eye_r": eyes_of(her.get_node("her_eye_R"))}


func run() -> void:
	var her := figure()
	var parts := {}
	var first := {}
	for mi in her.get_children():
		parts[str(mi.name)] = mi
		first[str(mi.name)] = mi.get_surface_override_material(0)
	var sw := HSLookSwitch.new()
	sw.by_story = false
	sw.panel_key = KEY_NONE
	var list: Array[HSLookPreset] = [
		P({"name": "angry", "skin": "ember", "eyes": "glow"}),
		P({"name": "love", "eyes": "hearts"}),
		P({"name": "gone", "skin": "cloak"}),
		P({"name": "watching", "skin": "cloak", "eyes": "glow", "eye_color": Color(0.1, 1.0, 0.2)}),
		P({"name": "night", "skin": "pearl", "needs": "task:dinner"}),
		P({"name": "met", "eyes": "black", "needs": "met_freddy"}),
		P({"name": "slow", "skin": "stone", "seconds": 2.0}),
	]
	sw.looks = list
	her.add_child(sw)
	sw.look_changed.connect(func(nm): heard.append(nm))
	sw.begin()
	rep["names"] = Array(sw.names())
	# ---- a look at once, and her default exactly back
	sw.set_look("angry", 0.0)
	rep["angry"] = state(her)
	rep["angry_amounts"] = [sw.wearing()["skin_amount"], sw.wearing()["eye_amount"], sw.current(), sw.is_turning()]
	rep["angry_shadow"] = parts["her_skin"].cast_shadow == GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	sw.default(0.0)
	var back := true
	for k in parts:
		back = back and parts[k].get_surface_override_material(0) == first[k]
	rep["default"] = state(her)
	rep["default_exact"] = back and float(first["her_eye_L"].get_shader_parameter("fx_glow")) == 0.0 and HSCreatureSkin.worn(her).is_empty() and HSEyeFx.worn(her).is_empty()
	rep["heard_first"] = heard.duplicate()
	# ---- a turn over a second: nothing to fade out, so the whole second coming in
	sw.set_look("angry", 1.0)
	sw.advance(0.5)
	rep["in_half"] = [sw.wearing()["skin_amount"], sw.wearing()["eye_amount"], sw.is_turning(), float(parts["her_eye_L"].get_surface_override_material(0).get_shader_parameter("fx_amount"))]
	sw.advance(0.5)
	rep["in_done"] = [sw.wearing()["skin_amount"], sw.wearing()["eye_amount"], sw.is_turning()]
	# ---- from one look to another: half the turn the old going, the swap, half the new coming
	sw.set_look("love", 1.0)
	sw.advance(0.25)
	rep["out_half"] = [state(her), sw.wearing()["skin_amount"], sw.wearing()["eye_amount"]]
	sw.advance(0.25)
	rep["swapped"] = [state(her), sw.wearing()["eye_amount"]]
	sw.advance(0.25)
	rep["coming"] = sw.wearing()["eye_amount"]
	sw.advance(0.25)
	rep["love"] = [state(her), sw.wearing()["eye_amount"], sw.current(), sw.is_turning()]
	# ---- a look's own seconds over the switch's
	sw.set_look("slow")
	sw.advance(0.5)                                  # (the hearts going: half of its two seconds)
	rep["slow_out"] = sw.wearing()["eye_amount"]
	sw.advance(0.5)
	sw.advance(0.5)
	rep["slow_in"] = [state(her)["skin"], sw.wearing()["skin_amount"]]
	sw.default(0.0)
	# ---- the cloak: her eyes left glowing, then cloaked with the rest, then back
	sw.set_look("watching", 0.0)
	var cloak: Shader = HSCreatureSkin.shader_of("cloak")
	var gc: Color = parts["her_eye_L"].get_surface_override_material(0).get_shader_parameter("fx_glow_color")
	rep["watching"] = [state(her), gc.g > gc.r, parts["her_skin"].get_surface_override_material(0).shader == cloak, parts["her_skin"].cast_shadow == GeometryInstance3D.SHADOW_CASTING_SETTING_OFF]
	sw.set_look("gone", 0.0)
	rep["gone"] = state(her)
	sw.set_look("love", 0.0)
	rep["after_cloak"] = [state(her), parts["her_skin"].cast_shadow == GeometryInstance3D.SHADOW_CASTING_SETTING_ON]
	sw.default(0.0)
	back = true
	for k in parts:
		back = back and parts[k].get_surface_override_material(0) == first[k]
	rep["default_after_cloak"] = back
	# ---- an amount alone: the same skin kept on, only how much of it
	sw.show({"skin": "chrome"}, 0.0)
	var m0: Material = parts["her_skin"].get_surface_override_material(0)
	sw.show({"skin": "chrome", "skin_amount": 0.5}, 1.0)
	sw.advance(0.5)
	rep["amount_alone"] = [sw.wearing()["skin_amount"], parts["her_skin"].get_surface_override_material(0) == m0, float(m0.get_shader_parameter("amount")), sw.current()]
	sw.default(0.0)
	# ---- next and fire
	var order: Array = []
	for i in 9:
		sw.next(0.0)
		order.append(sw.current())
	rep["next"] = order
	sw.on_fire = "love"
	sw.fire()
	sw.advance(5.0)
	sw.advance(5.0)
	rep["fire"] = sw.current()
	rep["missing"] = sw.set_look("nobody", 0.0)
	sw.default(0.0)
	# ---- the story: looks with needs come and go with it (the starter kit's own Story: a by-hand project has it)
	var real := ResourceLoader.exists("res://starter/story.gd")
	rep["story_real"] = real
	if real:
		var story: Node = (load("res://starter/story.gd") as GDScript).new()
		root.add_child(story)
		story.add_task("dinner", "Make dinner")
		sw.by_story = true
		sw.advance(0.3)
		rep["story_none"] = [sw.asked(), sw.current()]
		story.tick("dinner")                             # a quest done
		sw.advance(0.3)
		sw.advance(5.0)
		sw.advance(5.0)
		rep["story_task"] = [sw.asked(), sw.current(), state(her)["skin"]]
		story.flag("met_freddy")                         # a fact: the later look in the list wins
		sw.advance(0.3)
		sw.advance(5.0)
		sw.advance(5.0)
		rep["story_fact"] = [sw.asked(), sw.current(), state(her)]
		sw.set_look("angry", 0.0)                        # asked by hand: it stays until the story changes
		sw.advance(0.5)
		rep["story_by_hand"] = sw.current()
		# an event of the starter kit's turning her (its event area's look_of and her_look), and a cue's
		var area: Area3D = (load("res://starter/event_area.gd") as GDScript).new()
		area.look_of = her
		area.her_look = "love"
		root.add_child(area)
		area.fire()
		sw.advance(5.0)
		sw.advance(5.0)
		rep["event_area"] = sw.current()
		area.look_of = sw                                # (the switch itself named, and her default asked for)
		area.her_look = "default"
		area.once = false
		area.fire()
		sw.advance(5.0)
		sw.advance(5.0)
		rep["event_area_default"] = [sw.current(), state(her)]
		area.queue_free()
		story.queue_free()
		var cue := load("res://starter/cue.gd") as GDScript      # the cue has the same two words
		var names_of := []
		for pr in (cue.get_script_property_list() if cue != null else []):
			names_of.append(pr["name"])
		rep["cue_words"] = cue != null and cue.can_instantiate() and names_of.has("look_of") and names_of.has("her_look")
	# ---- she starts in a look
	var her2 := figure()
	her2.name = "Her2"
	var sw2 := HSLookSwitch.new()
	sw2.by_story = false
	sw2.panel_key = KEY_NONE
	sw2.looks = list
	sw2.start = "love"
	her2.add_child(sw2)
	sw2.begin()
	rep["start"] = [sw2.current(), state(her2)["eye_l"]]
	# ---- the picker
	sw.by_story = false
	sw.default(0.0)
	var pk := HSLookPicker.new()
	root.add_child(pk)
	pk.save_dir = "res://looks_test"
	pk.secs = 0.0
	pk.setup([sw, sw2])
	pk.pick("skin", "pearl")
	pk.pick("eyes", "spiral")
	pk.pick("eye_color", Color(0, 1, 0, 1))
	var sc: Color = parts["her_eye_L"].get_surface_override_material(0).get_shader_parameter("fx_spiral_a")
	rep["picked"] = [state(her), sc.g > sc.r, sw.current()]
	rep["code"] = pk.code()
	var path := pk.save_as("pearly")
	var again = load(path) if path != "" else null
	rep["saved"] = [path, again is HSLookPreset and again.skin == "pearl" and again.eyes == "spiral" and again.name == "pearly", Array(sw.names()).has("pearly")]
	rep["no_name"] = pk.save_as("")
	pk.choose_look("")
	rep["picker_default"] = state(her)
	pk.choose_look("pearly")
	rep["picker_named"] = [state(her)["skin"], sw.current()]
	pk.queue_free()
	var over := HSLookPicker.toggle(self)             # over the running game: every switch in the scene
	rep["panel"] = [over != null, over.switches.size() if over != null else 0, root.get_node_or_null(HSLookPicker.LAYER) != null]
	HSLookPicker.toggle(self)
	if path != "":
		DirAccess.remove_absolute(ProjectSettings.globalize_path(path))
	# ---- the lists a preset offers are the looks there are
	var hint := {}
	for pr in HSLookPreset.new().get_property_list():
		hint[pr["name"]] = str(pr["hint_string"])
	rep["lists"] = [hint.get("skin") == "default," + ",".join(HSCreatureSkin.names()), hint.get("eyes") == "default," + ",".join(HSEyeFx.names()),
		",".join(HSLookPreset.SKINS) == hint.get("skin"), ",".join(HSLookPreset.EYES) == hint.get("eyes")]
	rep["heard"] = heard.size()
	her.visible = false
	her2.visible = false


func load_who() -> void:
	var doc := GLTFDocument.new()
	var st := GLTFState.new()
	if doc.append_from_file(glb, st) != OK:
		return
	who = doc.generate_scene(st) as Node3D
	if who == null:
		return
	root.add_child(who)
	var cl := HSCharacterLook.new()
	cl.glb_path = glb
	who.add_child(cl)
	who_sw = HSLookSwitch.attach(who, {"by_story": false, "panel_key": KEY_NONE})


func run_who() -> void:
	who_sw.begin()
	var skins := func() -> int:
		var k := 0
		for mi in who.find_children("*", "MeshInstance3D", true, false):
			for s in (mi.mesh.get_surface_count() if mi.mesh != null else 0):
				var m = mi.get_surface_override_material(s)
				if m is ShaderMaterial and m.shader == HSSkin.shader():
					k += 1
		return k
	var w := {"skin_before": skins.call(), "eyes_before": HSEyeFx.eyes(who).size()}
	who_sw.show({"skin": "chrome", "eyes": "glow"}, 0.0)
	w["chrome_glow"] = [HSCreatureSkin.worn(who).size(), HSEyeFx.worn(who).size()]
	who_sw.show({"skin": "cloak", "eyes": "hearts"}, 0.0)
	w["cloak_hearts"] = [HSCreatureSkin.worn(who).size(), HSEyeFx.worn(who).size(), HSEyeFx.eyes(who).size()]
	who_sw.show({"skin": "cloak"}, 0.0)
	w["cloak"] = [HSCreatureSkin.worn(who).size(), HSEyeFx.eyes(who).size()]
	who_sw.default(0.0)
	w["default"] = [HSCreatureSkin.worn(who).size(), HSEyeFx.worn(who).size(), skins.call(), HSEyeFx.eyes(who).size()]
	rep["who"] = w


func _process(_d: float) -> bool:
	n += 1
	if n == 3:
		run()
		if glb != "":
			load_who()
	if n == 12 and who_sw != null:
		run_who()
	if n >= (14 if glb != "" else 4):
		var f := FileAccess.open(out_dir.path_join("switch.json"), FileAccess.WRITE)
		if f != null:
			f.store_string(JSON.stringify(rep, "  "))
			f.close()
		print("SWITCH {done}")
		return true
	return false
