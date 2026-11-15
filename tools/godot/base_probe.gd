## HORRORGAME's look inside the game as it ships (tools/horror_game.py check: run once in the project and once in the pack
## Godot exported from it, `-- --packed`): what the plugins and the starter read off the disk is there in an exported
## game, where text resources are binary (only x.tres.remap is left), a .glb is only what Godot imported from it, and a
## file that isn't a resource is in the pack only when its preset names it. The check made what it reads: a .glb whose
## materials carry the Studio's records, a face clip, a Kimodo motion.
## Prints `HORRORGAME <what> <how>` lines and `HORRORGAME result {errors}`.
extends SceneTree

var errors: Array = []
var tag := ""


func ok(cond: bool, what: String, how := "") -> void:
	print("HORRORGAME %s%s %s" % [tag, what, how])
	if not cond:
		errors.append(tag + what + (" (" + how + ")" if how != "" else ""))


func _initialize() -> void:
	var packed := OS.get_cmdline_user_args().has("--packed")
	tag = "exported: " if packed else "in the project: "
	# a Studio character's records: off her imported materials (the glb's own file isn't in an exported game)
	var glb := "res://probe/probe_look.glb"
	var scene = load(glb)
	var her: Node = scene.instantiate() if scene is PackedScene else null
	if her != null:
		root.add_child(her)
	var eye: Dictionary = HSEye.records(glb, "studioEye", her)
	var hair: Dictionary = HSHair.records(glb, her)
	var skin: Dictionary = HSSkin.records(glb, her)
	print("HORRORGAME %s(the glb's own file: %s)" % [tag, "there" if FileAccess.file_exists(glb) else "not there, only what Godot imported"])
	ok(her != null and float((eye.get("probe_eye", {}) as Dictionary).get("limbus", 0.0)) == 0.55
		and (hair.get("probe_hair", {}) as Dictionary).has("studioHair") and float((skin.get("probe_skin", {}) as Dictionary).get("pores", 0.0)) == 0.7,
		"a Studio character's eye, hair and skin records", "%s; %s; %s" % [str(eye.keys()), str(hair.keys()), str(skin.keys())])
	var m: ShaderMaterial = HSSkin.material()
	ok(m.get_shader_parameter("use_micro_detail") == true and m.get_shader_parameter("texture_micro_detail") is Texture2D, "the skin's micro detail (HumanShaders' MicroDetail folder)")
	# an NPC's face clip (the Face page's, faces/<id>.tres)
	var names := HSNpcFace.names()
	var clip := HSNpcFace.read_clip("probe_smile")
	ok(names.has("clip:probe_smile") and int(clip.get("frames", 0)) == 3 and (clip.get("shapes", PackedStringArray()) as PackedStringArray).has("jawDrop"),
		"an NPC's face clip, listed and read", "%s; %d frames" % [str(names.has("clip:probe_smile")), int(clip.get("frames", 0))])
	# a Kimodo motion (animations/<name>.npz: a file the preset names)
	var npz = load("res://kimodo/npz.gd")
	var arrays: Dictionary = npz.call("read", "res://animations/probe_walk.npz") if npz != null else {}
	var joints: Array = npz.call("joints", arrays) if npz != null else []
	ok(joints.size() == 4, "a Kimodo motion read by its res:// path", "%d frames" % joints.size())
	# the sound physics' table, the music
	var ac = load("res://starter/acoustics.gd")
	ok(ac != null and not (ac.call("cfg") as Dictionary).is_empty(), "the sound physics' table (acoustics.json)")
	ok(load("res://music/calm.ogg") is AudioStream, "the music's moods")
	if her != null:
		her.free()
	print("HORRORGAME result " + JSON.stringify({"errors": errors}))
	quit()
