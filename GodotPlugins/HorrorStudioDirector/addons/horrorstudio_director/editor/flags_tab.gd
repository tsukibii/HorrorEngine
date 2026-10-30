@tool
extends VBoxContainer
## The dock's Flags tab (docs/GODOT_DIRECTOR.md §6): every flag in the open scene, where it's set (an event's Set
## flag, an answer, a code lock that opens) and where it's checked (an event's if, a trigger's when, a choice's way,
## a door locked by a flag, a bed's needs). ⚠ a flag checked that nothing sets (a typo, or an event still to make);
## ● the flags the running game has set.

var dock = null
var tree: Tree
var _sig := ""


func _ready() -> void:
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	var l := Label.new()
	l.text = "Flags: set where, checked where. Click a place to go there."
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	add_child(l)
	tree = Tree.new()
	tree.size_flags_vertical = Control.SIZE_EXPAND_FILL
	tree.hide_root = true
	tree.item_selected.connect(func(): var it := tree.get_selected(); if it != null and it.get_metadata(0) != null: dock.select(it.get_metadata(0)))
	add_child(tree)


func tick() -> void:
	var s := str(collect().hash()) + str(dock.run_flags.size())
	if s != _sig:
		refresh()


## flag -> {"set": [[node, how]], "check": [[node, how]]}
func collect() -> Dictionary:
	var out := {}
	var r = dock.root() if dock != null else null
	if r == null:
		return out
	var add := func(f: String, role: String, n: Node, how: String) -> void:
		if f == "":
			return
		if not out.has(f):
			out[f] = {"set": [], "check": []}
		out[f][role].append([n, how])
	for n in r.find_children("*", "", true, false):
		match HSDirector.class_of(n):
			"HSEvent":
				for f in n.require_flags:
					add.call(f, "check", n, "an event's if")
				for f in n.block_flags:
					add.call(f, "check", n, "an event's if not")
				if n.when != null and n.when.kind == "flag":
					add.call(n.when.target, "check", n, "an event's when")
				for a in n.actions:
					_action_flags(a, n, add)
			"HSLine":
				for a in n.actions:
					_action_flags(a, n, add)
			"HSTodo":
				for w in [n.done_when, n.fail_when]:
					if w != null and w.kind == "flag":
						add.call(w.target, "check", n, "a to-do's when")
			"HSOption":
				for f in n.set_flags:
					add.call(f, "set", n, "an answer")
				for f in n.if_flags:
					add.call(f, "check", n, "a choice's way")
				if n.when != null and n.when.kind == "flag":
					add.call(n.when.target, "check", n, "a choice's when")
			"HSThing":
				if n.use in ["code", "use_item"]:
					add.call(n.data().get("then", ""), "set", n, "opens: " + n.use)
				if n.use == "sleep":
					for f in n.sleep_needs:
						add.call(f, "check", n, "the bed's needs")
			"HSDoor":
				if n.locked_by.begins_with("flag:"):
					add.call(n.locked_by.substr(5), "check", n, "the door's lock")
	return out


func _action_flags(a, n: Node, add: Callable) -> void:
	if a == null:
		return
	if a.verb in ["set_flag", "clear_flag"]:
		add.call(a.flag, "set" if a.verb == "set_flag" else "check", n, "Set flag" if a.verb == "set_flag" else "Clear flag")
	if a.verb == "ask":
		for f in a.answer_flags:
			add.call(f, "set", n, "a question's answer")


func refresh() -> void:
	if tree == null or dock == null:
		return
	var fl := collect()
	_sig = str(fl.hash()) + str(dock.run_flags.size())
	tree.clear()
	var top := tree.create_item()
	var names: Array = fl.keys()
	names.sort()
	if names.is_empty():
		var it := tree.create_item(top)
		it.set_text(0, "No flags yet. An event's Set flag action makes one; an event's if waits for it.")
		return
	for f in names:
		var e: Dictionary = fl[f]
		var it := tree.create_item(top)
		var warn: bool = e["set"].is_empty() and not e["check"].is_empty()
		var live: bool = dock.run_flags.has(f)
		it.set_text(0, ("● " if live else "") + f + ("   ⚠ checked, never set" if warn else ("   (set, never checked)" if e["check"].is_empty() else "")))
		it.set_custom_color(0, Color(1.0, 0.6, 0.4) if warn else (Color(0.6, 1.0, 0.6) if live else Color(0.9, 0.9, 0.9)))
		it.collapsed = true
		for role in ["set", "check"]:
			for p in e[role]:
				var c := tree.create_item(it)
				c.set_text(0, "%s by %s (%s)" % ["set" if role == "set" else "checked", p[0].name, p[1]])
				c.set_metadata(0, p[0])
