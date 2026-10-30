@tool
extends VBoxContainer
## The dock's Events tab (docs/GODOT_DIRECTOR.md §6): every event of the open scene as the sentence it reads as
## ("When the player enters hallway, if read_letter, then JUMPSCARE: figure; set saw_figure"), grouped by when it
## listens (any time, a chapter, a task), ✓ on the ones the running game has fired. Templates make the common ones
## in a click, in front of the editor's camera or on the selected thing: a jumpscare in an area after a flag, the
## lights dying, a door slamming behind, a knock, a whisper when looked at, a thought on picking up, a character to
## talk to, the task finished on arriving somewhere.

const TEMPLATES := [
	["Jumpscare in an area (after flags)", "jumpscare", "An area in front of the camera: walking in shows a figure for a second with a sting, once; set the flags it waits for in its event"],
	["Lights die in an area", "lights_die", "An area: walking in kills the room's lights for a few seconds"],
	["Door slams behind the player", "slam", "An area: walking in slams the nearest door"],
	["Knock at a door", "knock", "An area: walking in sets off three knocks at the nearest door"],
	["Whisper when looked at", "whisper", "On the selected thing: looked at for two seconds, a whisper"],
	["Thought on picking up", "pickup", "On the selected thing (a pickup): picked up, a thought and a flag"],
	["Talk to a character", "talk", "On the selected character: a click, her lines and a question with two answers (each sets a flag)"],
	["Finish the task on arriving", "arrive", "An area in the selected task: walking in finishes the task"],
	["Show something once a flag is set", "reveal", "Anywhere: when a flag is set, a hidden thing shows"],
]

var dock = null
var tree: Tree
var picker: OptionButton
var hint: Label
var _sig := ""


func _ready() -> void:
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	var row := HBoxContainer.new()
	add_child(row)
	picker = OptionButton.new()
	picker.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	for t in TEMPLATES:
		picker.add_item(t[0])
	picker.item_selected.connect(func(i): hint.text = TEMPLATES[i][2])
	row.add_child(picker)
	var make := Button.new()
	make.text = "Make"
	make.tooltip_text = "Make the template's event (and its area or figure) now"
	make.pressed.connect(_make)
	row.add_child(make)
	var blank := Button.new()
	blank.text = "+ Blank"
	blank.tooltip_text = "An empty event: into the selected task, chapter, area, thing or character, else the whole game"
	blank.pressed.connect(_blank)
	row.add_child(blank)
	hint = Label.new()
	hint.clip_text = true
	hint.add_theme_color_override("font_color", Color(0.7, 0.7, 0.7))
	hint.text = TEMPLATES[0][2]
	picker.tooltip_text = TEMPLATES[0][2]
	picker.item_selected.connect(func(i): picker.tooltip_text = TEMPLATES[i][2])
	add_child(hint)
	tree = Tree.new()
	tree.size_flags_vertical = Control.SIZE_EXPAND_FILL
	tree.hide_root = true
	tree.item_selected.connect(func(): var it := tree.get_selected(); if it != null and it.get_metadata(0) != null: dock.select(it.get_metadata(0)))
	add_child(tree)


func tick() -> void:
	var s := _signature()
	if s != _sig:
		refresh()


func _signature() -> String:
	var r = dock.root() if dock != null else null
	if r == null:
		return ""
	var parts: Array = [dock.run_flags.size()]
	for e in HSDirector.nodes_of(r, "HSEvent"):
		parts.append(e.describe())
	return str(parts.hash())


func refresh() -> void:
	if tree == null or dock == null:
		return
	_sig = _signature()
	tree.clear()
	var top := tree.create_item()
	var r = dock.root()
	if r == null:
		return
	var groups := {}
	var order: Array = []
	for e in HSDirector.nodes_of(r, "HSEvent"):
		var g := _group(e)
		if not groups.has(g):
			groups[g] = []
			order.append(g)
		groups[g].append(e)
	if order.is_empty():
		var it := tree.create_item(top)
		it.set_text(0, "No events yet: pick a template above and Make, or + Blank.")
		return
	for g in order:
		var gi := tree.create_item(top)
		gi.set_text(0, g)
		gi.set_custom_color(0, Color(0.75, 0.82, 1.0))
		gi.set_selectable(0, false)
		for e in groups[g]:
			var it := tree.create_item(gi)
			var fired: bool = dock.run_flags.has("_fired_" + HSDirector.id_of(e))
			it.set_text(0, ("✓ " if fired else "") + e.describe())
			it.set_icon(0, dock.icon("event"))
			it.set_metadata(0, e)
			it.set_tooltip_text(0, "%s\n%s (%s)" % [e.describe(), e.name, str(r.get_path_to(e))])
			if fired:
				it.set_custom_color(0, Color(0.6, 1.0, 0.6))


## when an event listens, by where it sits
func _group(e: Node) -> String:
	var p := e.get_parent()
	while p != null:
		var c := HSDirector.class_of(p)
		if c == "HSTask":
			return "During the task: " + p.title
		if c == "HSChapter":
			return "Through the chapter: " + p.title
		if c in ["HSGame", "HSLevel"]:
			return "Any time"
		p = p.get_parent()
	return "Any time"


# ---- making ------------------------------------------------------------------------------------------------------
func _event(when_kind: String, target: String, actions: Array, flags: Array = []) -> HSEvent:
	var ev := HSEvent.new()
	if when_kind != "":
		ev.when = HSWhen.make(when_kind, target)
	ev.actions.assign(actions)
	ev.require_flags = PackedStringArray(flags)
	return ev


func _area(name_: String) -> Node:
	var lp: Node = dock.level_parent()
	if lp == null:
		dock.say("Open a scene with a level first")
		return null
	var tr := HSTrigger.new()
	tr.name = dock.fresh_name(lp, name_)
	var xf: Transform3D = dock.view_spot()
	tr.transform = (lp.global_transform.affine_inverse() * xf) if lp is Node3D else xf
	return tr


func _nearest(cls: String, near: Vector3) -> Node:
	var best = null
	var d := INF
	for n in HSDirector.nodes_of(dock.root(), cls):
		var dd: float = n.global_position.distance_to(near)
		if dd < d:
			d = dd
			best = n
	return best


func _make() -> void:
	var kind: String = TEMPLATES[picker.selected][1]
	var sel = dock.selected()
	match kind:
		"jumpscare":
			var tr := _area("ScareArea")
			if tr == null:
				return
			var lp: Node = dock.level_parent()
			var fig = null
			for a in HSDirector.nodes_of(dock.root(), "HSActor"):
				if a.hidden_at_start:
					fig = a
					break
			var fid := "figure"
			if fig == null:
				fig = HSActor.new()
				fig.name = dock.fresh_name(lp, "Figure")
				fig.hidden_at_start = true
				fig.solid = false
				fig.behaviour = "off"
				fig.height = 1.9
				fig.transform = tr.transform * Transform3D(Basis(Vector3.UP, PI), Vector3(0, 0, -2.5))
				dock.add_node(lp, fig, "add the jumpscare's figure")
				fid = HSDirector.snake(str(fig.name))
			else:
				fid = HSDirector.id_of(fig)
			var flag := HSDirector.snake(str(tr.name)) + "_done"
			tr.add_child(_named(_event("", "", [HSAction.make("jumpscare", {"thing": fid, "secs": 0.8}), HSAction.make("think", {"text": "What was that?"}),
				HSAction.make("set_flag", {"flag": flag})]), "Jumpscare"))
			dock.add_node(lp, tr, "add a jumpscare area")
			dock.say("Made %s: walking in shows %s. Set the flags it waits for in its event (require flags); move the area and the figure where you want them." % [tr.name, fid])
		"lights_die", "slam", "knock":
			var tr2 := _area({"lights_die": "DarkArea", "slam": "SlamArea", "knock": "KnockArea"}[kind])
			if tr2 == null:
				return
			var lp2: Node = dock.level_parent()
			var at: Vector3 = (lp2.global_transform * tr2.transform).origin if lp2 is Node3D else tr2.transform.origin
			var acts: Array = []
			if kind == "lights_die":
				var room = null
				for r in HSDirector.nodes_of(dock.root(), "HSRoom"):
					if r.holds(at):
						room = r
				acts = [HSAction.make("lights_die", {"room": HSDirector.id_of(room) if room != null else "", "secs": 3.0}), HSAction.make("think", {"text": "Not now..."})]
			else:
				var dr = _nearest("HSDoor", at)
				var did: String = HSDirector.id_of(dr) if dr != null else ""
				acts = [HSAction.make("slam_door", {"door": did})] if kind == "slam" else [HSAction.make("knock", {"thing": did, "count": 3})]
			tr2.add_child(_named(_event("", "", acts), "Event"))
			dock.add_node(lp2, tr2, "add an area with an event")
		"whisper", "pickup":
			var t = _up(sel, ["HSThing", "HSActor", "HSDoor"])
			if t == null:
				dock.say("Select the thing first")
				return
			var ev2: HSEvent
			if kind == "whisper":
				ev2 = _event("look", HSDirector.id_of(t), [HSAction.make("whisper", {"text": "...behind you..."})])
				ev2.when.secs = 2.0
			else:
				var item: String = t.item_id() if HSDirector.class_of(t) == "HSThing" else HSDirector.id_of(t)
				ev2 = _event("pickup", item, [HSAction.make("think", {"text": "Why is this here?"}), HSAction.make("set_flag", {"flag": "got_" + item})])
			ev2.name = dock.fresh_name(t, "Event")
			dock.add_node(t, ev2, "add an event on " + str(t.name))
		"talk":
			var a = _up(sel, ["HSActor"])
			if a == null:
				dock.say("Select the character first")
				return
			a.talk = true
			var aid := HSDirector.id_of(a)
			var ev3 := _event("", "", [HSAction.make("say", {"text": "You shouldn't be here.", "actor": aid}),
				HSAction.make("ask", {"text": "Will you stay?", "actor": aid, "ask_id": "ask_" + aid, "answers": PackedStringArray(["Stay", "Leave"]), "answer_flags": PackedStringArray(["stayed", "left"])})])
			ev3.once = false
			ev3.every = 1.0
			ev3.name = dock.fresh_name(a, "Talk")
			dock.add_node(a, ev3, "talk to " + str(a.name))
		"arrive":
			var task = _up(sel, ["HSTask"])
			if task == null:
				dock.say("Select the task first: the area finishes it")
				return
			var tr3 := _area("FinishArea")
			if tr3 == null:
				return
			var ev4 := _event("enter", HSDirector.snake(str(tr3.name)), [HSAction.make("finish_task")])
			ev4.name = dock.fresh_name(task, "ArriveEvent")
			dock.add_node(dock.level_parent(), tr3, "add the task's area")
			task.finish = "event"
			dock.add_node(task, ev4, "finish the task on arriving")
		"reveal":
			var host = _up(sel, ["HSTask", "HSChapter"])
			if host == null:
				host = dock.game() if dock.game() != null else dock.root()
			var ev5 := _event("flag", "", [HSAction.make("show", {"thing": ""})])
			ev5.name = dock.fresh_name(host, "Reveal")
			dock.add_node(host, ev5, "add a reveal")
			dock.say("Set the flag it waits for (when, target) and the thing it shows (its Show action); the thing hidden at start.")
	refresh()


func _named(n: Node, nm: String) -> Node:
	n.name = nm
	return n


func _up(n, classes: Array):
	while n != null and n is Node:
		if HSDirector.class_of(n) in classes:
			return n
		n = n.get_parent()
	return null


func _blank() -> void:
	var host = _up(dock.selected(), ["HSTask", "HSChapter", "HSTrigger", "HSRoom", "HSThing", "HSDoor", "HSActor"])
	if host == null:
		host = dock.game() if dock.game() != null else dock.root()
	if host == null:
		return
	var ev := HSEvent.new()
	ev.actions.assign([HSAction.make("think", {"text": "..."})])
	ev.name = dock.fresh_name(host, "Event")
	dock.add_node(host, ev, "add an event")
