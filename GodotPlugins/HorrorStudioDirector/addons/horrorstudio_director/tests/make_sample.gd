## The sample game (docs/GODOT_DIRECTOR.md §8), made by Godot itself so every property is the class's own: a small
## house (a hall, a kitchen through a door, a bedroom behind a locked one), a letter, a key, a light switch, a
## wardrobe to hide in and a bed, Mari in the hall, a figure that shows for a second when the player walks into the
## kitchen after reading the letter (the user's own example of an event), and a story in one chapter: find the key,
## talk to Mari, get into the bedroom, then hide or sleep (two endings).
##   godot --headless --path <project> -s res://addons/horrorstudio_director/tests/make_sample.gd   (SAMPLE ok)
extends SceneTree

var root_: Node

## the sample's story: the user's example (walk into the kitchen's doorway after reading the letter: the figure), an
## errand with the wrong thing answered, a conversation offered by what's happened, a state that moves Mari, a choice
## by what the player does, two endings, an achievement
const STORY := {
	"format": 1,
	"quests": [
		{"id": "q_key", "title": "The key", "objective": "Find the bedroom key", "start_at": "start", "map": "house",
			"card": {"title": "Night 1", "sub": "23:40", "time": "night"},
			"steps": [{"id": "read_letter", "text": "Read the letter", "done": {"read": "letter"}},
				{"id": "find_key", "text": "Find the bedroom key", "done": {"pickup": "bedroom_key"}}]},
		{"id": "q_drink", "title": "A drink", "objective": "Bring Mari something to drink",
			"steps": [{"id": "give_mug", "text": "Give Mari the mug", "who": "mari", "done": {"gave": "mug", "to": "mari"},
				"wrong": {"say": "Nah, that's not what I want.", "who": "mari"}}]},
		{"id": "q_talk", "title": "Mari", "objective": "Talk to Mari",
			"steps": [{"id": "talk_mari", "text": "Talk to Mari", "done": {"holds": "heard:t_open"}}]},
		{"id": "q_bedroom", "title": "The bedroom", "objective": "Get into the bedroom",
			"steps": [{"id": "enter_bedroom", "text": "Open the bedroom", "done": {"enter": "bedroom"}}]},
		{"id": "q_night", "title": "Something in the hall", "objective": "Something is in the hall.", "finish": "any",
			"steps": [{"id": "hide", "text": "Hide in the wardrobe", "done": {"hidden": "wardrobe"}},
				{"id": "sleep", "text": "Go to sleep", "done": {"use": "bed"}}],
			"next": [{"if": {"step": "hide"}, "go": "e_morning"}, {"go": "e_asleep"}]},
	],
	"moments": [
		{"id": "letter_thought", "when": {"read": "letter"}, "do": [{"think": "She wrote this in a hurry."}]},
		{"id": "figure_scare", "when": {"enter": "kitchen_doorway"}, "if": "read:letter",
			"do": [{"trick": "jumpscare", "figure": "figure", "secs": 0.9}, {"think": "What was that?"}, {"flag": "saw_figure"}]},
	],
	"talk": {"mari": [
		{"id": "t_not_now", "if": {"not": {"done": "q_key"}}, "lines": [{"text": "Not now. Find the key."}]},
		{"id": "t_thirsty", "if": {"quest": "q_drink"}, "lines": [{"text": "Could you bring me something to drink?"}]},
		{"id": "t_open", "if": {"done": "q_drink"}, "once": true, "lines": [{"text": "You found it."},
			{"text": "Will you open the bedroom?", "answers": [{"id": "yes", "label": "Yes", "sets": ["promised"], "reply": ["Then go. Quickly."]},
				{"id": "not_yet", "label": "Not yet", "karma": -1, "reply": ["Don't wait too long."]}]}]},
		{"id": "t_go", "lines": [{"text": "Go on."}]},
	]},
	"states": [
		{"while": {"done": "q_talk"}, "set": {"mari": {"do": "go", "to": "bedroom_spot"}}},
	],
	"endings": [
		{"id": "e_morning", "kind": "good", "title": "Morning", "text": "You waited in the dark until the sun came up."},
		{"id": "e_asleep", "kind": "bad", "title": "Asleep", "text": "You never woke up."},
	],
	"achievements": [{"id": "ACH_HOST", "title": "Good host", "text": "Bring her what she asked for.", "hidden": true, "when": "gave:mug:mari"}],
	"facts": {"saw_figure": {"about": "the figure seen in the kitchen's doorway"}},
}


func own(n: Node, parent: Node, nm: String) -> Node:
	n.name = nm
	parent.add_child(n)
	n.owner = root_
	return n


func room(parent: Node, nm: String, at: Vector3, size: Vector3, walls: int, floor_kind: String) -> HSRoom:
	var r := HSRoom.new()
	r.position = at
	r.size = size
	r.walls = walls
	r.floor_kind = floor_kind
	return own(r, parent, nm)


func thing(parent: Node, nm: String, use: String, at: Vector3, yaw: float = 0.0, fields: Dictionary = {}) -> HSThing:
	var t := HSThing.new()
	t.use = use
	t.position = at
	t.rotation_degrees = Vector3(0, yaw, 0)
	for k in fields:
		t.set(k, fields[k])
	return own(t, parent, nm)


func _own_all(_n: Node) -> void:
	pass


## a standing idle on Kimodo's SOMA skeleton (soma77.json): the arms down at the sides, breathing, a slow weight
## shift, the head turning a little; [frames, 77, 3] as Kimodo saves it, looping
func idle_frames(n: int) -> PackedFloat32Array:
	var S := HSRetarget.soma()
	var names: Array = S["names"]
	var sk := Skeleton3D.new()
	for i in names.size():
		sk.add_bone(names[i])
	for i in names.size():
		var par = S["parents"][i]
		var pi: int = names.find(par) if par != null else -1
		if pi >= 0:
			sk.set_bone_parent(i, pi)
		var r: Array = S["rest"][i]
		var pr: Array = S["rest"][pi] if pi >= 0 else [0, 0, 0]
		sk.set_bone_rest(i, Transform3D(Basis(), Vector3(float(r[0]) - float(pr[0]), float(r[1]) - float(pr[1]), float(r[2]) - float(pr[2]))))
	var out := PackedFloat32Array()
	for f in n:
		var t := f / float(n)
		sk.reset_bone_poses()
		var breathe := sin(t * TAU * 2.0)
		var shift := sin(t * TAU)
		sk.set_bone_pose_rotation(sk.find_bone("LeftArm"), Quaternion(Vector3(0, 0, 1), -1.25 + 0.03 * breathe))
		sk.set_bone_pose_rotation(sk.find_bone("RightArm"), Quaternion(Vector3(0, 0, 1), 1.25 - 0.03 * breathe))
		sk.set_bone_pose_rotation(sk.find_bone("LeftForeArm"), Quaternion(Vector3(0, 1, 0), 0.15))
		sk.set_bone_pose_rotation(sk.find_bone("RightForeArm"), Quaternion(Vector3(0, 1, 0), -0.15))
		sk.set_bone_pose_rotation(sk.find_bone("Chest"), Quaternion(Vector3(1, 0, 0), -0.03 * breathe))
		sk.set_bone_pose_rotation(sk.find_bone("Head"), Quaternion(Vector3(0, 1, 0), 0.25 * sin(t * TAU + 1.0)))
		var h := sk.find_bone("Hips")
		sk.set_bone_pose_position(h, sk.get_bone_rest(h).origin + Vector3(0.03 * shift, 0.004 * breathe, 0))
		sk.force_update_all_bone_transforms()
		for i in names.size():
			var p: Vector3 = sk.get_bone_global_pose(i).origin
			out.append_array([p.x, p.y, p.z])
	sk.free()
	return out


func _initialize() -> void:
	root_ = HSGame.new()
	root_.name = "Game"
	root_.title = "The House (sample)"
	root_.player_name = "Alex"
	root_.time_of_day = "night"
	root_.lighting = "off" if OS.get_cmdline_user_args().has("--flat") else "on"

	# ---- the level ----
	var house: HSLevel = own(HSLevel.new(), root_, "House")
	var N := HSRoom.N
	var S := HSRoom.S
	var E := HSRoom.E
	var W := HSRoom.W
	var hall := room(house, "Hall", Vector3(0, 0, 0), Vector3(5, 2.6, 4), N | S | E | W, "wood")
	var kitchen := room(house, "Kitchen", Vector3(4.62, 0, 0), Vector3(4, 2.6, 4), N | S | E, "tile")
	var bedroom := room(house, "Bedroom", Vector3(0, 0, -4.12), Vector3(5, 2.6, 4), N | E | W, "carpet")
	var kd: HSDoor = own(HSDoor.new(), house, "KitchenDoor")
	kd.position = Vector3(2.56, 0, 0.8)
	kd.rotation_degrees = Vector3(0, 90, 0)
	var bd: HSDoor = own(HSDoor.new(), house, "BedroomDoor")
	bd.position = Vector3(-1.2, 0, -2.06)
	bd.locked_by = "bedroom_key"
	bd.latch = true
	var start: HSSpot = own(HSSpot.new(), house, "Start")
	start.position = Vector3(0, 0, 1.2)
	start.rotation_degrees = Vector3(0, 180, 0)          # facing north (-z): its +Z turned round
	house.start = house.get_path_to(start)
	thing(hall, "Letter", "note", Vector3(-1.6, 0, 1.0), 0.0, {"display_name": "Letter", "note_title": "A letter",
		"note_text": "Alex,\n\nI left the key in the kitchen. Don't open the bedroom until I'm back.\n\n- M"})
	var hall_bulb := OmniLight3D.new()
	hall_bulb.position = Vector3(0, 2.35, 0)
	hall_bulb.light_energy = 1.4
	hall_bulb.omni_range = 6.0
	hall_bulb.shadow_enabled = true
	own(hall_bulb, hall, "HallBulb")
	var sw := thing(hall, "LightSwitch", "switch", Vector3(-2.47, 1.15, -0.6), 90.0, {"display_name": "Light switch"})
	sw.switches = [sw.get_path_to(hall_bulb)]
	var lamp := OmniLight3D.new()
	lamp.position = Vector3(0, 2.3, 0)
	lamp.light_energy = 1.0
	lamp.light_color = Color(1.0, 0.82, 0.62)
	lamp.omni_range = 5.0
	own(lamp, kitchen, "KitchenLamp")
	thing(kitchen, "BedroomKey", "pickup", Vector3(1.0, 0, -1.2), 0.0, {"item": "bedroom_key", "item_name": "Bedroom key", "display_name": "Bedroom key"})
	thing(kitchen, "Table", "none", Vector3(-0.6, 0, -1.2))
	# the parts (DECISIONS 2026-11-01): a model of the user's made a kettle, its spout moved by hand off the kit's place;
	# another a thing to look at closely
	var kettle := thing(kitchen, "Kettle", "life", Vector3(-0.66, 0.5, -1.25), 0.0, {"life": "kettle", "display_name": "Kettle"})
	var kbody := MeshInstance3D.new()
	var cyl := CylinderMesh.new()
	cyl.top_radius = 0.065
	cyl.bottom_radius = 0.08
	cyl.height = 0.2
	kbody.mesh = cyl
	kbody.position = Vector3(0, 0.1, 0)
	own(kbody, kettle, "KettleModel")
	var spout := Marker3D.new()
	spout.position = Vector3(0, 0.19, 0.075)
	own(spout, kettle, "spout")
	var orn := thing(kitchen, "Ornament", "inspect", Vector3(-0.44, 0.5, -1.1), 0.0, {"inspect_text": "A porcelain cat. Its eyes are scratched out.", "display_name": "Ornament"})
	var ball := MeshInstance3D.new()
	var sph := SphereMesh.new()
	sph.radius = 0.05
	sph.height = 0.1
	ball.mesh = sph
	ball.position = Vector3(0, 0.05, 0)
	own(ball, orn, "CatModel")
	thing(bedroom, "Wardrobe", "hide", Vector3(1.7, 0, -1.4), 0.0, {"display_name": "Wardrobe"})
	thing(bedroom, "Bed", "sleep", Vector3(-1.3, 0, -0.6), 0.0, {"display_name": "Bed"})
	var mari: HSActor = own(HSActor.new(), house, "Mari")
	mari.position = Vector3(1.5, 0, -1.0)
	mari.face_player = true
	mari.talk = true
	mari.display_name = "Mari"
	if ResourceLoader.exists("res://bodies/MHR.fbx"):           # her body: the studio's MHR, with an idle made on Kimodo's skeleton and brought in
		var body: Node3D = (load("res://bodies/MHR.fbx") as PackedScene).instantiate()
		own(body, mari, "Body")
		_own_all(body)
		var npz := ProjectSettings.globalize_path("res://kimodo/motions/sample_idle.npz")
		DirAccess.make_dir_recursive_absolute(npz.get_base_dir())
		HSNpz.write(npz, {"posed_joints": [[120, 77, 3], idle_frames(120)]})
		var sk := HSRetarget.skeleton_of(body)
		var ap := HSRetarget.player_of(mari)
		ap.owner = root_
		var anim := HSRetarget.animation(HSNpz.joints(HSNpz.read(npz)), sk, mari, mari, {"fps": 30.0, "loop": true})
		DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://motions/mari"))
		ResourceSaver.save(anim, "res://motions/mari/sample_idle.res")
		var lib := AnimationLibrary.new()
		lib.add_animation("sample_idle", load("res://motions/mari/sample_idle.res"))
		ResourceSaver.save(lib, "res://motions/mari/kimodo.tres")
		ap.add_animation_library("kimodo", load("res://motions/mari/kimodo.tres"))
		mari.idle_motion = "sample_idle"
		mari.height = 1.75
	var fig: HSActor = own(HSActor.new(), kitchen, "Figure")
	fig.position = Vector3(1.4, 0, 1.3)
	fig.rotation_degrees = Vector3(0, -90, 0)
	fig.hidden_at_start = true
	fig.solid = false
	fig.behaviour = "off"
	fig.height = 1.9
	var tr: HSTrigger = own(HSTrigger.new(), kitchen, "KitchenDoorway")
	tr.position = Vector3(-1.2, 0, 0.8)
	tr.size = Vector3(1.4, 2.4, 1.6)

	# the drink errand's two things (the right one, a mug; the wrong one, a bottle) and where Mari goes after she's talked
	thing(kitchen, "Mug", "pickup", Vector3(1.0, 0, 1.2), 0.0, {"item": "mug", "item_name": "Mug", "display_name": "Mug"})
	thing(kitchen, "Bottle", "pickup", Vector3(0.6, 0, 1.4), 0.0, {"item": "bottle", "item_name": "Bottle", "display_name": "Bottle"})
	var bspot: HSSpot = own(HSSpot.new(), house, "BedroomSpot")
	bspot.position = Vector3(1.2, 0, -1.4)

	# ---- the story: the Director file (DECISIONS 2026-11-01), the scene left as the world ----
	var r0 := HSStoryFile.write(STORY)
	if r0 != OK:
		printerr("SAMPLE FAIL story %d" % r0)
		quit(1)
		return

	var ps := PackedScene.new()
	var r := ps.pack(root_)
	if r != OK:
		printerr("SAMPLE FAIL pack %d" % r)
		quit(1)
		return
	var e := ResourceSaver.save(ps, "res://main.tscn")
	HSDirector.write_index("res://main.tscn", root_)      # its ids for the Director Manager, as the editor's save would
	print("SAMPLE ok" if e == OK else "SAMPLE FAIL save %d" % e)
	root_.free()
	quit(0 if e == OK else 1)
