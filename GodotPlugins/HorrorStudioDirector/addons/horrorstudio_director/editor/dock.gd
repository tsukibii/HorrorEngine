@tool
extends VBoxContainer
## The HorrorStudio dock (docs/GODOT_DIRECTOR.md §6): the game at a glance and in reach. Story is the quest log (the
## chapters and their steps in play order, dragged to reorder, a step's to-dos and events under it; "now" marks where
## the running game is; Play from here), Events every event as a sentence with templates for the common ones (a
## jumpscare in an area after a flag...), Flags each flag where it's set and where it's checked, Things the items,
## notes, characters, areas and spots, Check the compiler's problems, Kimodo the link to the motion maker. Adding
## things is the HorrorStudio panel's (editor/panel.gd, its Build tab: the cards). Everything it does is on the
## editor's undo; its helpers (root, selected, add_node, view_spot...) serve the panel too.

const DirectorTab := preload("res://addons/horrorstudio_director/editor/director_tab.gd")
const ThingsTab := preload("res://addons/horrorstudio_director/editor/things_tab.gd")
const CheckTab := preload("res://addons/horrorstudio_director/editor/check_tab.gd")
const KimodoTab := preload("res://addons/horrorstudio_director/editor/kimodo_tab.gd")
const ICONS := "res://addons/horrorstudio_director/icons/"

var plugin: EditorPlugin = null
var tabs: TabContainer
var director_tab
var things_tab
var check_tab
var kimodo_tab
var run_step := ""                  # the running game's step (sent by HSGame through the debugger)
var run_flags: Dictionary = {}
var run_events: Array = []
var running := false
var _dirty := true
var status: Label


func _ready() -> void:
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	custom_minimum_size = Vector2(260, 300)
	tabs = TabContainer.new()
	tabs.size_flags_vertical = Control.SIZE_EXPAND_FILL
	add_child(tabs)
	director_tab = _tab(DirectorTab, "Director")
	things_tab = _tab(ThingsTab, "Things")
	check_tab = _tab(CheckTab, "Check")
	kimodo_tab = _tab(KimodoTab, "Kimodo")
	tabs.tab_changed.connect(func(_i): refresh())
	var foot := HBoxContainer.new()
	add_child(foot)
	status = Label.new()
	status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	status.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	status.add_theme_color_override("font_color", Color(1.0, 0.8, 0.45))
	foot.add_child(status)
	var guide := Button.new()
	guide.name = "Guide"
	guide.text = "Guide"
	guide.tooltip_text = "How to build a game with the HorrorStudio Director: the guide, in your browser"
	guide.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	var th := EditorInterface.get_editor_theme()
	if th != null and th.has_icon("Help", "EditorIcons"):
		guide.icon = th.get_icon("Help", "EditorIcons")
	guide.pressed.connect(open_guide)
	foot.add_child(guide)
	refresh.call_deferred()


## a word to the user under the tabs (what just happened, what's missing)
func say(t: String) -> void:
	if status != null:
		status.text = t


## the guide's page (guides/director in the studio, copied into the project's guide/ by tools/godot_director.py) in
## the system's browser; the studio's own copy when the project has none
func guide_path() -> String:
	var p := ProjectSettings.globalize_path("res://guide/index.html")
	if FileAccess.file_exists(p):
		return p
	var studio := HSKimodoStage.studio_root()
	if studio != "" and FileAccess.file_exists(studio.path_join("guides/director/index.html")):
		return studio.path_join("guides/director/index.html")
	return ""


func open_guide() -> void:
	var p := guide_path()
	if p == "":
		say("No guide here: run tools/godot_director.py install on this project (or open guides/director/index.html in the studio)")
		return
	if OS.shell_open(p) == OK:
		say("The guide opens in your browser: " + p)
	else:
		say("Couldn't open a browser: open %s in one" % p)


func _tab(cls, title: String) -> Control:
	var t: Control = cls.new()
	t.name = title
	t.set("dock", self)
	tabs.add_child(t)
	return t


## the open tab drawn again (cheap enough to do on every change of the scene)
func refresh() -> void:
	if tabs == null:
		return
	var t = tabs.get_current_tab_control()
	if t != null and t.has_method("refresh"):
		t.refresh()


func _process(_dt: float) -> void:
	if Engine.get_process_frames() % 90 == 0 and is_visible_in_tree():   # the Inspector's edits show up within a second or two
		var t = tabs.get_current_tab_control()
		if t != null and t.has_method("tick"):
			t.tick()


# ---- the scene ---------------------------------------------------------------------------------------------------
func root() -> Node:
	return EditorInterface.get_edited_scene_root()


## the HSGame being edited, or null (a level open on its own)
func game() -> Node:
	var r := root()
	return r if r != null and HSDirector.class_of(r) == "HSGame" else null


func icon(name: String) -> Texture2D:
	var p := ICONS + name + ".svg"
	return load(p) if ResourceLoader.exists(p) else null


func icon_of(n: Node) -> Texture2D:
	var cls := HSDirector.class_of(n)
	var m := {"HSGame": "game", "HSLevel": "level", "HSRoom": "room", "HSDoor": "door", "HSThing": "thing", "HSTrigger": "trigger",
		"HSSpot": "spot", "HSPath": "path", "HSActor": "actor"}
	return icon(m[cls]) if m.has(cls) else null


func select(n: Node) -> void:
	if n == null or not is_instance_valid(n):
		return
	var sel := EditorInterface.get_selection()
	sel.clear()
	sel.add_node(n)
	EditorInterface.edit_node(n)


func selected() -> Node:
	var s := EditorInterface.get_selection().get_selected_nodes()
	return s[0] if s.size() else null


func _own(n: Node, owner_: Node) -> void:
	n.owner = owner_
	for c in n.get_children():
		if not str(c.name).begins_with("_"):
			_own(c, owner_)


## a node (and its children) added under a parent, on the editor's undo
func add_node(parent: Node, n: Node, action: String, at := -1) -> Node:
	var r := root()
	if r == null or parent == null:
		return null
	var ur := plugin.get_undo_redo()
	ur.create_action("HorrorStudio: " + action)
	ur.add_do_method(parent, "add_child", n, true)
	if at >= 0:
		ur.add_do_method(parent, "move_child", n, at)
	ur.add_do_method(self, "_own", n, r)
	ur.add_do_reference(n)
	ur.add_undo_method(parent, "remove_child", n)
	ur.commit_action()
	select(n)
	_dirty = true
	refresh()
	return n


## a node moved to another parent or place, on the editor's undo
func move_node(n: Node, parent: Node, index: int) -> void:
	var old_parent := n.get_parent()
	var old_index := n.get_index()
	if parent == old_parent and index > old_index:
		index -= 1
	var ur := plugin.get_undo_redo()
	ur.create_action("HorrorStudio: move %s" % n.name)
	if parent != old_parent:
		ur.add_do_method(n, "reparent", parent, false)
		ur.add_do_method(self, "_own", n, root())
	ur.add_do_method(parent, "move_child", n, clamp(index, 0, parent.get_child_count()))
	if parent != old_parent:
		ur.add_undo_method(n, "reparent", old_parent, false)
		ur.add_undo_method(self, "_own", n, root())
	ur.add_undo_method(old_parent, "move_child", n, old_index)
	ur.commit_action()
	refresh()


func delete_node(n: Node) -> void:
	var p := n.get_parent()
	if p == null:
		return
	var ur := plugin.get_undo_redo()
	ur.create_action("HorrorStudio: delete %s" % n.name)
	ur.add_do_method(p, "remove_child", n)
	ur.add_undo_method(p, "add_child", n, true)
	ur.add_undo_method(p, "move_child", n, n.get_index())
	ur.add_undo_method(self, "_own", n, root())
	ur.add_undo_reference(n)
	ur.commit_action()
	refresh()


## where the editor's 3D camera looks: a spot on the floor 3 m ahead (or where its view meets something nearer)
func view_spot() -> Transform3D:
	var vp := EditorInterface.get_editor_viewport_3d(0)
	var cam: Camera3D = vp.get_camera_3d() if vp != null else null
	if cam == null:
		return Transform3D()
	var from := cam.global_position
	var fwd := -cam.global_transform.basis.z
	var to := from + fwd * 3.0
	var space := vp.world_3d.direct_space_state if vp.world_3d != null else null
	if space != null:
		var h := space.intersect_ray(PhysicsRayQueryParameters3D.create(from, from + fwd * 30.0))
		if not h.is_empty() and from.distance_to(h["position"]) < 30.0:
			to = h["position"]
	var flat := Vector3(fwd.x, 0, fwd.z).normalized()
	var yaw := atan2(-flat.x, -flat.z) if flat.length() > 0.01 else 0.0     # turned to face the camera (+Z toward it)
	return Transform3D(Basis(Vector3.UP, yaw), Vector3(to.x, max(0.0, to.y) if to.y < 0.5 else to.y, to.z))


## where a new thing of the level goes: the selected room, level or Node3D, else the scene's first level
func level_parent() -> Node:
	var s := selected()
	while s != null:
		var c := HSDirector.class_of(s)
		if c in ["HSRoom", "HSLevel"]:
			return s
		if c == "HSGame":
			break
		s = s.get_parent()
	var r := root()
	if r == null:
		return null
	if HSDirector.class_of(r) == "HSLevel":
		return r
	var lv := HSDirector.nodes_of(r, "HSLevel")
	return lv[0] if lv.size() else r


## a new name not yet among a parent's children
func fresh_name(parent: Node, base: String) -> String:
	var n := base
	var i := 2
	while parent != null and parent.has_node(NodePath(n)):
		n = "%s%d" % [base, i]
		i += 1
	return n


# ---- the running game (HSGame sends these through the debugger) ---------------------------------------------------
func on_run_start(_start: String, problems: Array) -> void:
	running = true
	run_step = ""
	run_flags = {}
	run_events = []
	if check_tab != null:
		check_tab.run_problems = problems
	refresh()


func on_run_step(nid: String, flags: Array) -> void:
	run_step = nid
	for f in flags:
		run_flags[str(f)] = true
	refresh()


func on_run_flag(f: String) -> void:
	run_flags[f] = true


func on_run_event(ev: String) -> void:
	run_events.append(ev)
	while run_events.size() > 40:
		run_events.pop_front()


## the Director Manager (the studio's tools/director_manager/serve.py) started on this project and opened in the
## browser; a second start finds its port taken and leaves, the page opening on the one running
const MANAGER_PORT := 8796
func open_manager() -> String:
	var studio := HSKimodoStage.studio_root()
	var serve := studio.path_join("tools/director_manager/serve.py") if studio != "" else ""
	if serve == "" or not FileAccess.file_exists(serve):
		return "The Director Manager is the studio's (tools/director_manager): set the studio folder in the Kimodo tab, or run python tools/director_manager/serve.py there"
	var project := ProjectSettings.globalize_path("res://")
	var cmd := str(ProjectSettings.get_setting("horrorstudio/director/python", "python3")).split(" ", false)
	var args: Array = Array(cmd.slice(1)) + [serve, "--project", project, "--port", str(MANAGER_PORT)]
	OS.create_process(cmd[0], PackedStringArray(args))
	var url := "http://127.0.0.1:%d/?project=%s" % [MANAGER_PORT, project.uri_encode()]
	get_tree().create_timer(1.5).timeout.connect(func(): OS.shell_open(url))
	return "The Director Manager opens in your browser: " + url


func on_run_stop() -> void:
	running = false
	refresh()
