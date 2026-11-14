@tool
## HorrorStudio Markers in the editor (docs/MARKERS.md §7 to §9): the NPC Markers tab along the bottom (editor/dock.gd),
## the markers drawn over the 3D view and moved there by mouse (editor/overlay.gd), the tester (editor/tester.gd).
## And flags and things (docs/FLAGS.md): the Flags tab (editor/flags_dock.gd), the Things tab (editor/things_dock.gd),
## what they share (editor/wiring.gd), the pickers in the Inspector (editor/inspector.gd).
## This file holds what they all share: who's picked, who's shown, what a click in the 3D view will do, and every
## change to the scene, each through the editor's undo.
extends EditorPlugin

const Dock := preload("res://addons/horrorstudio_markers/editor/dock.gd")
const Overlay := preload("res://addons/horrorstudio_markers/editor/overlay.gd")
const Tester := preload("res://addons/horrorstudio_markers/editor/tester.gd")
const Glyphs := preload("res://addons/horrorstudio_markers/editor/glyphs.gd")
const Wiring := preload("res://addons/horrorstudio_markers/editor/wiring.gd")
const FlagsDock := preload("res://addons/horrorstudio_markers/editor/flags_dock.gd")
const ThingsDock := preload("res://addons/horrorstudio_markers/editor/things_dock.gd")
const Inspector := preload("res://addons/horrorstudio_markers/editor/inspector.gd")

## the palette: a card makes a marker of a kind with a few fields set
const CARDS := [
	{"id": "appear", "title": "Start here", "kind": "appear", "tip": "Put here, facing the arrow, and shown."},
	{"id": "walk", "title": "Walk", "kind": "walk", "tip": "Walks here from wherever they are. Add bends on the path to curve it."},
	{"id": "run", "title": "Run", "kind": "walk", "set": {"pace": "run"}, "tip": "The same, running."},
	{"id": "wait", "title": "Wait", "kind": "wait", "set": {"stay": "secs", "stay_secs": 3.0}, "tip": "Stays put for a while, idling."},
	{"id": "talk", "title": "Talk", "kind": "wait", "set": {"talk": true, "stay": "talked", "talks": [{"lines": ["Hello."]}]}, "tip": "Stays until you talk (E). Your answers can switch flags."},
	{"id": "sit", "title": "Sit", "kind": "sit", "tip": "Click a seat's front edge: sits there, the arrow the way the knees point."},
	{"id": "sleep", "title": "Sleep", "kind": "sleep", "tip": "Click a bed's edge: sits there, lies down and sleeps. The arrow points away from the bed."},
	{"id": "grab", "title": "Grab", "kind": "grab", "set": {"action": "reach"}, "tip": "Click where the hand should go (a shelf, a table): reaches for it."},
	{"id": "pick_up", "title": "Pick up", "kind": "grab", "set": {"action": "pick_up"}, "tip": "Click the thing: it goes into the hand."},
	{"id": "put_down", "title": "Put down", "kind": "grab", "set": {"action": "put_down"}, "tip": "Click where what's held is put down."},
	{"id": "open", "title": "Open door", "kind": "grab", "set": {"action": "open"}, "tip": "Click the door's handle: opens it. The arrow points into the door."},
	{"id": "animation", "title": "Animation", "kind": "animation", "tip": "Any animation of the model's by name, or a file (a Kimodo dance)."},
	{"id": "event", "title": "Event", "kind": "event", "tip": "Nothing with the body: flags, a task, a line, a sound, things fired."},
	{"id": "scare", "title": "Scare", "kind": "event", "set": {"scare": true}, "tip": "An Event that's a jump scare: fire a scare area or a cue, a sound, a face."},
	{"id": "look", "title": "Look", "kind": "event", "set": {"look_skin": "default"}, "tip": "Skin and eyes change (the look plugin's)."},
	{"id": "choice", "title": "Choice", "kind": "choice", "tip": "Takes the first way whose flags are on: an answer, something you did."},
	{"id": "repeat", "title": "Repeat", "kind": "repeat", "tip": "The markers inside it, again and again."},
	{"id": "disappear", "title": "Disappear", "kind": "disappear", "tip": "Hidden and switched off until a later marker needs the body."},
]

var dock: Control
var flags_dock: Control                    ## the Flags tab
var things_dock: Control                   ## the Things tab
var wiring: RefCounted                     ## the scene's flags and things, and the changes that tie them
var inspector: EditorInspectorPlugin
var cur_name: Array = []                   ## the flag, task or thing carried picked in the Flags tab: [kind, name] (the 3D view marks its uses)
var picking_pin := Callable()              ## a click on a marker's pin in the 3D view hands the marker to this
var overlay: RefCounted
var tester: RefCounted
var cur_npc: HSNpc                         ## the character picked in the tab
var cur_quest: HSNpcQuest                  ## her quest shown
var cur: Node                              ## the marker, way or bend picked
var hidden := {}                           ## characters whose markers aren't drawn (by instance id)
var solo: HSNpc                            ## only hers drawn
var all_quests := false                    ## every quest's markers drawn, not just the one picked
var armed := {}                            ## the card a click in the 3D view will place ({}: none)
var picking := Callable()                  ## a click in the 3D view hands the node clicked to this
var picking_what := ""
var picks := {}                            ## the tester: a Choice -> which of its ways
var view_quest := {}                       ## each character's quest last looked at (by instance id)
var _own := false
var _poll := 0.0
var _owned := {}                           ## a node added or taken out (by id) -> the nodes under it the scene saves


func _enter_tree() -> void:
	overlay = Overlay.new()
	overlay.plugin = self
	tester = Tester.new()
	tester.plugin = self
	wiring = Wiring.new()
	wiring.plugin = self
	dock = Dock.new()
	dock.name = "NPCMarkers"
	dock.plugin = self
	add_dock(dock)
	flags_dock = FlagsDock.new()
	flags_dock.name = "Flags"
	flags_dock.plugin = self
	flags_dock.wiring = wiring
	add_dock(flags_dock)
	things_dock = ThingsDock.new()
	things_dock.name = "Things"
	things_dock.plugin = self
	things_dock.wiring = wiring
	add_dock(things_dock)
	inspector = Inspector.new()
	inspector.plugin = self
	add_inspector_plugin(inspector)
	set_force_draw_over_forwarding_enabled()
	set_input_event_forwarding_always_enabled()
	EditorInterface.get_selection().selection_changed.connect(_on_selection)
	scene_changed.connect(_on_scene_changed)
	get_undo_redo().history_changed.connect(_on_history)
	get_undo_redo().version_changed.connect(_on_version)
	set_process(true)


func _exit_tree() -> void:
	if tester != null:
		tester.stop()
	var sel := EditorInterface.get_selection()
	if sel.selection_changed.is_connected(_on_selection):
		sel.selection_changed.disconnect(_on_selection)
	if scene_changed.is_connected(_on_scene_changed):
		scene_changed.disconnect(_on_scene_changed)
	if get_undo_redo().history_changed.is_connected(_on_history):
		get_undo_redo().history_changed.disconnect(_on_history)
	if get_undo_redo().version_changed.is_connected(_on_version):
		get_undo_redo().version_changed.disconnect(_on_version)
	if inspector != null:
		remove_inspector_plugin(inspector)
		inspector = null
	for d in [dock, flags_dock, things_dock]:
		if d != null:
			remove_dock(d)
			d.queue_free()
	dock = null
	flags_dock = null
	things_dock = null


func _handles(object: Object) -> bool:
	return object is HSNpc or object is HSNpcQuest or object is HSNpcMarker or object is HSNpcWay or object is HSNpcBend or object is HSLogic


func _make_visible(visible: bool) -> void:                 # one of its nodes picked in the scene: its tab comes up
	if not visible:
		return
	if selected() is HSLogic:
		if things_dock != null and not things_dock.is_visible_in_tree():
			things_dock.make_visible()
	elif dock != null and not dock.is_visible_in_tree():
		dock.make_visible()


func _apply_changes() -> void:                             # before a save, a play, a scene switch: the tester's copy never stays
	if tester != null:
		tester.stop()


func _process(dt: float) -> void:
	if tester != null and tester.playing():
		tester.tick(dt)
	_poll += dt
	if _poll > 0.7:
		_poll = 0.0
		for d in [dock, flags_dock, things_dock]:
			if d != null and d.is_visible_in_tree():
				d.tick()


func _forward_3d_gui_input(camera: Camera3D, event: InputEvent) -> int:
	return overlay.input(camera, event) if overlay != null else AFTER_GUI_INPUT_PASS


func _forward_3d_force_draw_over_viewport(control: Control) -> void:
	if overlay != null:
		overlay.draw(control)


# ---- the scene ----------------------------------------------------------------------------------------------------------------
func scene_root() -> Node:
	return EditorInterface.get_edited_scene_root()


## every character with markers in the edited scene
func npcs() -> Array:
	var out := []
	var r := scene_root()
	if r == null:
		return out
	if r is HSNpc:
		out.append(r)
	for n in r.find_children("*", "HSNpc", true, false):
		out.append(n)
	return out


func is_shown(npc: HSNpc) -> bool:
	if solo != null and is_instance_valid(solo):
		return npc == solo
	return not hidden.has(npc.get_instance_id())


## the quests of a character that are drawn now
func quests_shown(npc: HSNpc) -> Array:
	var qs := HSNpcFlow.quests(npc)
	if all_quests or qs.is_empty():
		return qs
	var q = instance_from_id(int(view_quest.get(npc.get_instance_id(), 0))) if view_quest.has(npc.get_instance_id()) else null
	if npc == cur_npc and cur_quest != null and is_instance_valid(cur_quest):
		q = cur_quest
	if q == null or not is_instance_valid(q) or not (q in qs):
		q = qs[0]
	return [q]


func valid(n) -> bool:
	return n != null and is_instance_valid(n) and (n as Node).is_inside_tree()


# ---- what's picked ------------------------------------------------------------------------------------------------------------
func _on_selection() -> void:
	var nodes := EditorInterface.get_selection().get_selected_nodes()
	if flags_dock != null and flags_dock.is_visible_in_tree() and not cur_name.is_empty():
		flags_dock.refresh_form()                              # (its "Use it on the thing selected" names who's selected)
	if nodes.size() != 1:
		return
	var n: Node = nodes[0]
	if things_dock != null and not (n is HSNpc or n is HSNpcQuest or n is HSNpcMarker or n is HSNpcWay or n is HSNpcBend):
		things_dock.show_thing(n)
	if n is HSLogic or not _handles(n) or n == cur or (n is HSNpc and n == cur_npc and cur == null):
		return
	pick_node(n, false)


## the one node selected in the scene (null: none, or several)
func selected() -> Node:
	var nodes := EditorInterface.get_selection().get_selected_nodes()
	return nodes[0] if nodes.size() == 1 and valid(nodes[0]) else null


## Go to a node from a list: one of a character's markers opens in NPC Markers; anything else is selected in the
## scene and shown in the Things tab (raise: the tab comes up)
func go_to(n: Node, raise := true) -> void:
	if not valid(n):
		return
	if n is HSNpc or n is HSNpcQuest or n is HSNpcMarker or n is HSNpcWay or n is HSNpcBend:
		pick_node(n)
		return
	var sel := EditorInterface.get_selection()
	var now := sel.get_selected_nodes()
	if now.size() != 1 or now[0] != n:
		sel.clear()
		sel.add_node(n)
	if things_dock != null:
		things_dock.show_thing(n)
		if raise and not things_dock.is_visible_in_tree():
			things_dock.make_visible()


## a flag, a task or a thing carried shown in the Flags tab
func show_name(kind: String, name: String) -> void:
	if flags_dock == null:
		return
	if not flags_dock.is_visible_in_tree():
		flags_dock.make_visible()
	flags_dock.filter = "all"
	flags_dock.pick(kind, name)


## a line under whichever tab is shown
func say(t: String) -> void:
	for d in [dock, flags_dock, things_dock]:
		if d != null and (d.is_visible_in_tree() or d == dock):
			d.say(t)


## a node of ours picked: the tab and the 3D view follow; select: also in the editor (the Inspector, the move gizmo)
func pick_node(n: Node, select := true) -> void:
	if not valid(n):
		return
	var npc := HSNpcFlow.npc_of(n) as HSNpc
	if npc == null:
		return
	cur_npc = npc
	if n is HSNpc:
		cur = null
		var qs := HSNpcFlow.quests(npc)
		if cur_quest == null or not is_instance_valid(cur_quest) or HSNpcFlow.npc_of(cur_quest) != npc:
			cur_quest = quests_shown(npc)[0] if not qs.is_empty() else null
	elif n is HSNpcQuest:
		cur_quest = n
		cur = null
	else:
		cur_quest = HSNpcFlow.quest_of(n)
		cur = n
	if cur_quest != null:
		view_quest[npc.get_instance_id()] = cur_quest.get_instance_id()
	if select:
		var sel := EditorInterface.get_selection()
		var now := sel.get_selected_nodes()
		if now.size() != 1 or now[0] != n:
			sel.clear()
			sel.add_node(n)
	if dock != null:
		dock.refresh()
	update_overlays()


func _on_scene_changed(_root = null) -> void:
	if tester != null:
		tester.stop()
	cur_npc = null
	cur_quest = null
	cur = null
	armed = {}
	picking = Callable()
	picking_pin = Callable()
	cur_name = []
	wiring.touch()
	var list := npcs()
	if not list.is_empty():
		pick_node(list[0], false)
	elif dock != null:
		dock.refresh()
	for d in [flags_dock, things_dock]:
		if d != null:
			d.set("picked", [])
			d.set("thing", null)
			d.refresh()
	update_overlays()


## something was done to the scene (an action committed). Godot's undo manager says so with history_changed; its
## version_changed is for an undo or a redo only (measured in 4.7: a commit sends the first and not the second)
func _on_history() -> void:
	wiring.touch()
	for d in [dock, flags_dock, things_dock]:
		if d != null:
			d.changed(_own)
	_own = false
	update_overlays()


## an undo or a redo: never the form's own doing, so the tab reads everything again
func _on_version() -> void:
	_own = false
	wiring.touch()
	for d in [dock, flags_dock, things_dock]:
		if d != null:
			d.changed(false)
	update_overlays()


## the tab wants its next look at the scene now, not in 0.7 s (the next frame: never inside whoever changed the scene)
func look_soon() -> void:
	_poll = 10.0


## a card armed: the next click in the 3D view places it ({}: none)
func arm(card: Dictionary) -> void:
	armed = card
	picking = Callable()
	picking_pin = Callable()
	say(("Click in the 3D view to place '%s'.  Shift keeps placing, Esc cancels." % card.get("title", "")) if not card.is_empty() else "")
	update_overlays()


## the next click in the 3D view hands the node clicked to `to`
func pick_in_view(what: String, to: Callable) -> void:
	armed = {}
	picking = to
	picking_pin = Callable()
	picking_what = what
	say("Click %s in the 3D view.  Esc cancels." % what)
	update_overlays()


## the next click on a marker's pin in the 3D view hands that marker to `to`
func pick_pin(to: Callable) -> void:
	armed = {}
	picking = Callable()
	picking_pin = to
	picking_what = "a marker's pin"
	say("Click a marker's pin in the 3D view.  Esc cancels.")
	update_overlays()


# ---- changes, each undoable ---------------------------------------------------------------------------------------------------
# a node and what's under it that is saved with the scene when it's added: not the insides of an instanced scene, not
# what's made for the game or the tester (names with _)
func _built(n: Node) -> Array:
	var out := [n]
	if n.scene_file_path != "":
		return out
	for c in n.get_children():
		if not String(c.name).begins_with("_"):
			out.append_array(_built(c))
	return out


# What's saved with the scene is decided once, when a node is first added (what was built for it then) or taken out
# (what the scene owned then): never what a node's own script makes under itself afterwards.
func _own_all(n: Node, owner_: Node) -> void:
	var id := n.get_instance_id()
	if not _owned.has(id):
		_owned[id] = _built(n)
	for m in (_owned[id] as Array):
		if is_instance_valid(m) and m != owner_ and (m == n or n.is_ancestor_of(m)):
			(m as Node).owner = owner_


## A field's new value put on an undo action. (A script that isn't a tool is a stand-in for itself in the editor, and
## the stand-in silently refuses a PackedStringArray for a list nobody has set yet, which reads as a plain Array: it
## takes an Array first, and the real type after that. Measured in 4.7.)
func do_prop(ur: EditorUndoRedoManager, node: Object, prop: String, value) -> void:
	if value is PackedStringArray and typeof(node.get(prop)) == TYPE_ARRAY:
		ur.add_do_property(node, prop, Array(value))
	ur.add_do_property(node, prop, value)
	ur.add_undo_property(node, prop, node.get(prop))


func set_prop(node: Object, prop: String, value, label := "") -> void:
	if node == null or not is_instance_valid(node):
		return
	if typeof(node.get(prop)) == typeof(value) and node.get(prop) == value:
		return
	_own = true
	var ur := get_undo_redo()
	ur.create_action("Markers: " + (label if label != "" else prop.replace("_", " ")), UndoRedo.MERGE_ENDS, scene_root())
	do_prop(ur, node, prop, value)
	ur.commit_action()


## several fields of one node at once: {prop: value}
func set_props(node: Object, values: Dictionary, label: String) -> void:
	if node == null or not is_instance_valid(node):
		return
	_own = true
	var ur := get_undo_redo()
	ur.create_action("Markers: " + label, UndoRedo.MERGE_DISABLE, scene_root())
	for k in values:
		do_prop(ur, node, k, values[k])
	ur.commit_action()


func _add(parent: Node, n: Node, at: int) -> void:
	parent.add_child(n, true)
	if at >= 0 and at < parent.get_child_count():
		parent.move_child(n, at)
	_own_all(n, scene_root())


func _remove(parent: Node, n: Node) -> void:
	if n.get_parent() == parent:
		parent.remove_child(n)


func add_node(parent: Node, n: Node, label: String, at := -1) -> void:
	var ur := get_undo_redo()
	ur.create_action("Markers: " + label, UndoRedo.MERGE_DISABLE, scene_root())
	ur.add_do_method(self, "_add", parent, n, at)
	ur.add_do_reference(n)
	ur.add_undo_method(self, "_remove", parent, n)
	ur.commit_action()


func delete_node(n: Node, label := "") -> void:
	if not valid(n) or n == scene_root():
		return
	var parent := n.get_parent()
	var at := n.get_index()
	var r := scene_root()
	_owned[n.get_instance_id()] = _built(n).filter(func(m: Node) -> bool: return m == n or m.owner == r)
	if n == cur or (cur != null and is_instance_valid(cur) and n.is_ancestor_of(cur)):
		cur = null
	if n == cur_quest:
		cur_quest = null
	if n == cur_npc:
		cur_npc = null
		cur_quest = null
	var ur := get_undo_redo()
	ur.create_action("Markers: " + (label if label != "" else "delete " + String(n.name)), UndoRedo.MERGE_DISABLE, scene_root())
	ur.add_do_method(self, "_remove", parent, n)
	ur.add_undo_method(self, "_add", parent, n, at)
	ur.add_undo_reference(n)
	ur.commit_action()


func _move(n: Node, parent: Node, at: int) -> void:
	if n.get_parent() != parent:
		var keep := (n as Node3D).global_transform if n is Node3D and n.is_inside_tree() else Transform3D()
		n.get_parent().remove_child(n)
		parent.add_child(n, true)
		if n is Node3D:
			(n as Node3D).global_transform = keep
		_own_all(n, scene_root())
	parent.move_child(n, clampi(at, 0, parent.get_child_count() - 1))


## a marker moved to another place in the order (or into a way or a Repeat)
func move_node(n: Node, parent: Node, at: int) -> void:
	if not valid(n) or not valid(parent) or n == parent or n.is_ancestor_of(parent):
		return
	var old_parent := n.get_parent()
	var old_at := n.get_index()
	if old_parent == parent and old_at < at:
		at -= 1
	if old_parent == parent and old_at == at:
		return
	var ur := get_undo_redo()
	ur.create_action("Markers: move " + String(n.name), UndoRedo.MERGE_DISABLE, scene_root())
	ur.add_do_method(self, "_move", n, parent, at)
	ur.add_undo_method(self, "_move", n, old_parent, old_at)
	ur.commit_action()


## a pin (or a bend) put somewhere, turned: one undo step from where it was (own: by the tab's own form, which then
## keeps its fields as they are; from the 3D view the form reads the new place)
func place_node(n: Node3D, xf: Transform3D, was: Transform3D, label: String, own := false) -> void:
	if xf.is_equal_approx(was):
		return
	_own = own
	var ur := get_undo_redo()
	ur.create_action("Markers: " + label, UndoRedo.MERGE_DISABLE, scene_root())
	ur.add_do_property(n, "global_transform", xf)
	ur.add_undo_property(n, "global_transform", was)
	ur.commit_action()


# ---- making things ----------------------------------------------------------------------------------------------------------
## an HSNpc for a character (a node of the scene), beside it, with a first quest; -> it
func add_character(her: Node3D) -> HSNpc:
	if her == null or scene_root() == null:
		return null
	for n in npcs():
		if (n as HSNpc).character_node() == her:
			pick_node(n)
			return n
	var npc := HSNpc.new()
	npc.name = "%s markers" % her.name
	npc.color = Color(HSNpc.COLORS[npcs().size() % HSNpc.COLORS.size()])
	var q := HSNpcQuest.new()
	q.name = "Quest 1"
	q.title = "Quest 1"
	npc.add_child(q)
	var parent: Node = her.get_parent() if her != scene_root() else scene_root()
	var at := her.get_index() + 1 if her != scene_root() else -1
	var ur := get_undo_redo()
	ur.create_action("Markers: markers for " + String(her.name), UndoRedo.MERGE_DISABLE, scene_root())
	ur.add_do_method(self, "_add", parent, npc, at)
	ur.add_do_method(self, "_point", npc, her)
	ur.add_do_reference(npc)
	ur.add_undo_method(self, "_remove", parent, npc)
	ur.commit_action()
	pick_node(q, false)
	return npc


func _point(npc: HSNpc, her: Node) -> void:
	if valid(npc) and valid(her):
		npc.character = npc.get_path_to(her)


func add_quest(npc: HSNpc, title := "") -> HSNpcQuest:
	if not valid(npc):
		return null
	var q := HSNpcQuest.new()
	var n := HSNpcFlow.quests(npc).size() + 1
	q.title = title if title != "" else "Quest %d" % n
	q.name = q.title.validate_node_name()
	add_node(npc, q, "a quest")
	pick_node(q, false)
	return q


## where a new marker goes: [its container, the index in it]
func insert_point() -> Array:
	if valid(cur):
		if cur is HSNpcWay:
			return [cur, -1]
		if cur is HSNpcBend:
			var wm := cur.get_parent()
			return [wm.get_parent(), wm.get_index() + 1]
		if cur is HSNpcMarker:
			if (cur as HSNpcMarker).kind == "repeat":
				return [cur, -1]
			return [cur.get_parent(), cur.get_index() + 1]
	if valid(cur_quest):
		return [cur_quest, -1]
	return []


## a card's marker made; `at`: where it was clicked in the 3D view (null: where she is then); -> it
func add_marker(card: Dictionary, at = null, facing = null) -> HSNpcMarker:
	if not valid(cur_npc):
		if dock != null:
			dock.say("Add a character first: select the model in the scene and press + Character.")
		return null
	if not valid(cur_quest):
		add_quest(cur_npc)
	var spot := insert_point()
	if spot.is_empty():
		return null
	var parent: Node = spot[0]
	var m := HSNpcMarker.new()
	m.kind = String(card.get("kind", "wait"))
	for k in (card.get("set", {}) as Dictionary):
		if k == "talks":
			var list: Array[Dictionary] = []
			list.assign((card["set"][k] as Array).duplicate(true))
			m.talks = list
		else:
			m.set(k, card["set"][k])
	m.name = m.title()
	if m.kind == "choice":
		for when in ["new_flag", ""]:
			var w := HSNpcWay.new()
			w.when = when
			w.name = "Way" if when != "" else "Otherwise"
			m.add_child(w)
	add_node(parent, m, "a %s marker" % m.title(), int(spot[1]))
	var from: Dictionary = HSNpcFlow.starts_of(m)[0]
	var pos: Vector3 = at if at is Vector3 else from["pos"]
	var yaw := float(from["yaw"])
	if facing != null:
		yaw = float(facing)
	elif m.kind == "walk" and at is Vector3:
		var d: Vector3 = pos - (from["pos"] as Vector3)
		if Vector2(d.x, d.z).length() > 0.05:
			yaw = atan2(d.x, d.z)
	m.global_transform = Transform3D(Basis(Vector3.UP, yaw), pos)
	pick_node(m)
	return m


## a bend on a Walk marker's path, after its `index`th point (0: right after where she starts)
func add_bend(m: HSNpcMarker, at: Vector3, index: int) -> HSNpcBend:
	var b := HSNpcBend.new()
	b.name = "Bend"
	var bends := m.bends()
	var child_at := (bends[index] as Node).get_index() if index < bends.size() else -1
	add_node(m, b, "a bend", child_at)
	b.global_position = at
	update_overlays()
	return b
