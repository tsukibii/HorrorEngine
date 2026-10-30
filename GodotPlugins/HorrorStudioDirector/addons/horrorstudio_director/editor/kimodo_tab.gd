@tool
extends ScrollContainer
## The dock's Kimodo tab (docs/GODOT_DIRECTOR.md §6b): Godot to Kimodo and back. Select a character (or a spot) and
## Send her room: the room she stands in and the ones by it, as Kimodo's stage from where she stands (stage.gd),
## written where Kimodo's demo opens it; Open Kimodo starts the demo (tools/kimodo.py demo in the studio) and the
## browser on it. Make the motion there and save it (Download as NPZ, or Send to Studio); it's listed here (the
## project's kimodo/motions, the studio's Saved/Kimodo, Downloads); Import puts it on the selected character as an
## animation of her own skeleton (retarget.gd), saved in motions/<her id>/, on her AnimationPlayer, ready for her
## idle or walk, or an event's Play motion.

var dock = null
var box: VBoxContainer
var studio: LineEdit
var python: LineEdit
var whole: CheckBox
var list: ItemList
var name_edit: LineEdit
var in_place: CheckBox
var loop: CheckBox
var use_as: OptionButton
var fps: SpinBox
var info: Label
var files: Array = []


func _ready() -> void:
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	box = VBoxContainer.new()
	box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	add_child(box)
	_head("1 · Send a room to Kimodo")
	var r1 := HBoxContainer.new()
	box.add_child(r1)
	var send := Button.new()
	send.text = "Send the selected character's room"
	send.tooltip_text = "The room she (or the selected spot) stands in and the rooms by it, as Kimodo's stage from where she stands, facing her way"
	send.pressed.connect(_send)
	r1.add_child(send)
	whole = CheckBox.new()
	whole.text = "whole level"
	r1.add_child(whole)
	var r2 := HBoxContainer.new()
	box.add_child(r2)
	var open := Button.new()
	open.text = "Open Kimodo"
	open.tooltip_text = "Start Kimodo's demo (tools/kimodo.py demo in the studio) and open it in the browser: its Stage panel shows the room"
	open.pressed.connect(_open)
	r2.add_child(open)
	var gs := GridContainer.new()
	gs.columns = 2
	box.add_child(gs)
	studio = _field(gs, "Studio folder", HSKimodoStage.studio_root(), "The HorrorEngine folder (tools/kimodo.py, Saved/Kimodo)")
	studio.text_changed.connect(func(t): ProjectSettings.set_setting("horrorstudio/director/studio_root", t); ProjectSettings.save())
	python = _field(gs, "Python", str(ProjectSettings.get_setting("horrorstudio/director/python", "python3")), "The command that runs the studio's Python tools")
	python.text_changed.connect(func(t): ProjectSettings.set_setting("horrorstudio/director/python", t); ProjectSettings.save())
	_head("2 · Bring a motion back")
	var r3 := HBoxContainer.new()
	box.add_child(r3)
	var rescan := Button.new()
	rescan.text = "Look for motions"
	rescan.tooltip_text = "The .npz files in the project's kimodo/motions, the studio's Saved/Kimodo and Downloads"
	rescan.pressed.connect(refresh)
	r3.add_child(rescan)
	var addf := Button.new()
	addf.text = "Open folder"
	addf.tooltip_text = "The project's kimodo/motions folder: drop .npz files saved from Kimodo in it"
	addf.pressed.connect(func(): DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://kimodo/motions")); OS.shell_open(ProjectSettings.globalize_path("res://kimodo/motions")))
	r3.add_child(addf)
	list = ItemList.new()
	list.custom_minimum_size = Vector2(0, 120)
	list.item_selected.connect(func(i): name_edit.text = HSDirector.snake(str(files[i]).get_file().get_basename().trim_prefix("send_")))
	box.add_child(list)
	var g2 := GridContainer.new()
	g2.columns = 2
	box.add_child(g2)
	name_edit = _field(g2, "Name", "", "The motion's name (what a character's idle or walk, or an event's Play motion, calls it)")
	var lf := Label.new()
	lf.text = "Frames a second"
	g2.add_child(lf)
	fps = SpinBox.new()
	fps.min_value = 10
	fps.max_value = 120
	fps.value = 30
	g2.add_child(fps)
	in_place = CheckBox.new()
	in_place.text = "in place (a walk the path moves)"
	box.add_child(in_place)
	loop = CheckBox.new()
	loop.text = "loops"
	box.add_child(loop)
	var r4 := HBoxContainer.new()
	box.add_child(r4)
	var ul := Label.new()
	ul.text = "Her"
	r4.add_child(ul)
	use_as = OptionButton.new()
	for t in ["(just add it)", "idle motion", "walk motion"]:
		use_as.add_item(t)
	r4.add_child(use_as)
	var imp := Button.new()
	imp.text = "Import onto the selected character"
	imp.pressed.connect(_import)
	box.add_child(imp)
	info = Label.new()
	info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	info.add_theme_color_override("font_color", Color(0.75, 0.75, 0.75))
	box.add_child(info)


func _head(t: String) -> void:
	var l := Label.new()
	l.text = t
	l.add_theme_color_override("font_color", Color(0.75, 0.82, 1.0))
	box.add_child(l)


func _field(grid: GridContainer, label: String, value: String, tip: String) -> LineEdit:
	var l := Label.new()
	l.text = label
	grid.add_child(l)
	var e := LineEdit.new()
	e.text = value
	e.tooltip_text = tip
	e.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.add_child(e)
	return e


func _selected_of(classes: Array):
	var n = dock.selected()
	while n != null:
		if HSDirector.class_of(n) in classes:
			return n
		n = n.get_parent()
	return null


func _send() -> void:
	var o = _selected_of(["HSActor", "HSSpot"])
	if o == null:
		info.text = "Select the character (or a spot) the motion starts from."
		return
	var scope = o.get_parent()
	while scope != null and HSDirector.class_of(scope) != "HSLevel":
		scope = scope.get_parent()
	if scope == null:
		scope = dock.root()
	var st := HSKimodoStage.make(o, scope, {"all": whole.button_pressed})
	var paths := HSKimodoStage.write(st)
	info.text = "%d boxes, %d marks, %d door swings, x%.3f for %s.\nWritten: %s%s" % [st["boxes"].size(), st["marks"].size(), st["arcs"].size(), st["scale"], st["who"],
		"\n".join(paths), "" if paths.size() > 1 else "\n(Set the studio folder for Kimodo's demo to open it by itself; else Load Stage this file there.)"]


func _open() -> void:
	var root := studio.text.strip_edges()
	if root == "" or not FileAccess.file_exists(root.path_join("tools/kimodo.py")):
		info.text = "Set the studio folder (the one with tools/kimodo.py) first."
		return
	var pid := OS.create_process(python.text.strip_edges(), [root.path_join("tools/kimodo.py"), "demo"], false)
	info.text = ("Kimodo's demo starting (pid %d): it opens at http://127.0.0.1:7860 once it's up (a minute the first time). Its Stage panel has the room." % pid) if pid > 0 else "Couldn't start %s: set Python to the command that runs the studio's tools (uv run python, python3...)." % python.text
	if pid > 0:
		OS.shell_open("http://127.0.0.1:7860")


## the motions to bring in: .npz files in the project's kimodo/motions, the studio's Saved/Kimodo, Downloads
func refresh() -> void:
	if list == null:
		return
	files = []
	var dirs: Array = [ProjectSettings.globalize_path("res://kimodo/motions")]
	var root := studio.text.strip_edges() if studio != null else ""
	if root != "":
		dirs.append(root.path_join("Saved/Kimodo"))
	dirs.append(OS.get_system_dir(OS.SYSTEM_DIR_DOWNLOADS))
	for d in dirs:
		if d == "" or not DirAccess.dir_exists_absolute(d):
			continue
		for f in DirAccess.get_files_at(d):
			if f.ends_with(".npz"):
				files.append(d.path_join(f))
	list.clear()
	for f in files:
		list.add_item("%s   (%s)" % [str(f).get_file(), str(f).get_base_dir().get_file()])
	if files.is_empty():
		list.add_item("No .npz yet: save one from Kimodo (Exports: NPZ, Download; or Send to Studio), or drop it in kimodo/motions")
		list.set_item_disabled(0, true)


func _import() -> void:
	var sel := list.get_selected_items()
	if sel.is_empty() or sel[0] >= files.size():
		info.text = "Pick a motion in the list first."
		return
	var a = _selected_of(["HSActor"])
	if a == null:
		info.text = "Select the character it's for (an HSActor with her model in it)."
		return
	var sk := HSRetarget.skeleton_of(a)
	if sk == null:
		info.text = "%s has no skeleton: put her rigged model (a Character Studio export, any rigged glb) in her as a child first." % a.name
		return
	var fam := HSRetarget.detect(sk)
	if fam == "":
		info.text = "Her skeleton's bones aren't ones the retarget knows (MHR, SOMA, Mixamo, or Godot's humanoid profile: reimport the model with a BoneMap to SkeletonProfileHumanoid)."
		return
	var frames := HSNpz.joints(HSNpz.read(files[sel[0]]))
	if frames.is_empty():
		info.text = "No posed_joints in that file."
		return
	var nm := HSDirector.snake(name_edit.text if name_edit.text.strip_edges() != "" else str(files[sel[0]]).get_file().get_basename())
	var ap := HSRetarget.player_of(a)
	if ap.owner == null:
		ap.owner = dock.root()
	var anim := HSRetarget.animation(frames, sk, a, ap.get_node(ap.root_node), {"fps": fps.value, "in_place": in_place.button_pressed, "loop": loop.button_pressed})
	if anim == null:
		info.text = "The retarget failed (see the Output)."
		return
	var dir := "res://motions/%s" % HSDirector.id_of(a)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(dir))
	var path := "%s/%s.res" % [dir, nm]
	ResourceSaver.save(anim, path)
	anim = load(path)
	var lib: AnimationLibrary
	if ap.has_animation_library("kimodo"):
		lib = ap.get_animation_library("kimodo")
	else:
		lib = AnimationLibrary.new()
		ResourceSaver.save(lib, dir + "/kimodo.tres")
		lib = load(dir + "/kimodo.tres")
		ap.add_animation_library("kimodo", lib)
	if lib.has_animation(nm):
		lib.remove_animation(nm)
	lib.add_animation(nm, anim)
	ResourceSaver.save(lib, lib.resource_path)
	match use_as.selected:
		1:
			a.idle_motion = nm
		2:
			a.walk_motion = nm
	EditorInterface.mark_scene_as_unsaved()
	ap.play("kimodo/" + nm)
	info.text = "%s: %d frames onto %s's %s skeleton, saved as %s, playing on her AnimationPlayer (kimodo/%s).%s" % [nm, frames.size(), a.name, fam, path, nm,
		" Her %s." % ["idle", "walk"][use_as.selected - 1] if use_as.selected > 0 else ""]
