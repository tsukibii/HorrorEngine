## The sample game (docs/GODOT_DIRECTOR.md §8), made by Godot itself so every property is the class's own: a small
## house (a hall, a kitchen through a door, a bedroom behind a locked one), a letter, a key, a light switch, a
## wardrobe to hide in and a bed, Mari in the hall, a figure that shows for a second when the player walks into the
## kitchen after reading the letter (the user's own example of an event), and a story in one chapter: find the key,
## talk to Mari, get into the bedroom, then hide or sleep (two endings).
##   godot --headless --path <project> -s res://addons/horrorstudio_director/tests/make_sample.gd   (SAMPLE ok)
extends SceneTree

var root_: Node


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


func when(kind: String, target: String = "") -> HSWhen:
	return HSWhen.make(kind, target)


func act(verb: String, fields: Dictionary = {}) -> HSAction:
	return HSAction.make(verb, fields)


## an instanced model's own nodes are its scene's: only its root is the sample's
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
	var not_now: HSEvent = own(HSEvent.new(), mari, "NotNow")
	not_now.once = false
	not_now.every = 0.5
	not_now.actions = [act("say", {"text": "Not now. Find the key.", "actor": "mari"})]
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
	var scare: HSEvent = own(HSEvent.new(), tr, "FigureScare")      # the user's example: walk in here after reading the letter
	scare.require_flags = PackedStringArray(["read_letter"])
	scare.actions = [act("jumpscare", {"thing": "figure", "secs": 0.9}), act("think", {"text": "What was that?"}), act("set_flag", {"flag": "saw_figure"})]

	# ---- the story ----
	var story := own(Node.new(), root_, "Story")
	var ch: HSChapter = own(HSChapter.new(), story, "Night1")
	ch.title = "Night 1"
	ch.subtitle = "23:40"
	ch.time_of_day = "night"
	ch.level = ch.get_path_to(house)
	var arrive: HSTask = own(HSTask.new(), ch, "Arrive")
	arrive.title = "The key"
	arrive.objective = "Find the bedroom key"
	arrive.start_at = arrive.get_path_to(start)
	var td1: HSTodo = own(HSTodo.new(), arrive, "ReadLetter")
	td1.text = "Read the letter"
	td1.done_when = when("read", "letter")
	var td2: HSTodo = own(HSTodo.new(), arrive, "FindKey")
	td2.text = "Find the bedroom key"
	td2.done_when = when("pickup", "bedroom_key")
	var lt: HSEvent = own(HSEvent.new(), arrive, "LetterThought")
	lt.when = when("read", "letter")
	lt.actions = [act("think", {"text": "She wrote this in a hurry."}), act("set_flag", {"flag": "read_letter"})]
	var talk: HSDialogue = own(HSDialogue.new(), ch, "MariTalk")
	talk.title = "Mari"
	var l1: HSLine = own(HSLine.new(), talk, "L1")
	l1.who = "mari"
	l1.text = "You found it."
	var l2: HSLine = own(HSLine.new(), talk, "L2")
	l2.who = "mari"
	l2.text = "Will you open the bedroom?"
	var o1: HSOption = own(HSOption.new(), l2, "Yes")
	o1.label = "Yes"
	o1.set_flags = PackedStringArray(["promised"])
	o1.reply_lines = PackedStringArray(["Then go. Quickly."])
	var o2: HSOption = own(HSOption.new(), l2, "NotYet")
	o2.label = "Not yet"
	o2.karma = -1.0
	o2.reply_lines = PackedStringArray(["Don't wait too long."])
	var bed_task: HSTask = own(HSTask.new(), ch, "Bedroom")
	bed_task.title = "The bedroom"
	bed_task.objective = "Get into the bedroom"
	var td3: HSTodo = own(HSTodo.new(), bed_task, "EnterBedroom")
	td3.text = "Open the bedroom"
	td3.done_when = when("enter", "bedroom")
	var choice: HSChoice = own(HSChoice.new(), ch, "HideOrSleep")
	choice.by = "act"
	choice.prompt = "Something is in the hall."
	var e1: HSEnding = own(HSEnding.new(), ch, "Morning")
	e1.kind = "good"
	e1.text = "You waited in the dark until the sun came up."
	var e2: HSEnding = own(HSEnding.new(), ch, "Asleep")
	e2.kind = "bad"
	e2.text = "You never woke up."
	var oh: HSOption = own(HSOption.new(), choice, "Hide")
	oh.label = "Hide in the wardrobe"
	oh.when = when("hidden", "wardrobe")
	oh.go_to = oh.get_path_to(e1)
	var os_: HSOption = own(HSOption.new(), choice, "Sleep")
	os_.label = "Sleep"
	os_.when = when("use", "bed")
	os_.go_to = os_.get_path_to(e2)

	var ps := PackedScene.new()
	var r := ps.pack(root_)
	if r != OK:
		printerr("SAMPLE FAIL pack %d" % r)
		quit(1)
		return
	var e := ResourceSaver.save(ps, "res://main.tscn")
	print("SAMPLE ok" if e == OK else "SAMPLE FAIL save %d" % e)
	root_.free()
	quit(0 if e == OK else 1)
