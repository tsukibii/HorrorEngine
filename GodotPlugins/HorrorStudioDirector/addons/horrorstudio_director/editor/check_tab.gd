@tool
extends VBoxContainer
## The dock's Check tab (docs/GODOT_DIRECTOR.md §6): the open game compiled as it will play (compile.gd), what's wrong
## (✕: it won't play right: a task that never ends, a choice's way that goes nowhere) and what's worth a look (⚠: a
## step nothing leads to, a flag checked and never set, an event that does nothing), each clicked to go to its node;
## the story's size; and the last run's problems as the game reported them.

var dock = null
var tree: Tree
var summary: Label
var run_problems: Array = []


func _ready() -> void:
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	var b := Button.new()
	b.text = "Check the game"
	b.pressed.connect(refresh)
	add_child(b)
	summary = Label.new()
	summary.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	add_child(summary)
	tree = Tree.new()
	tree.size_flags_vertical = Control.SIZE_EXPAND_FILL
	tree.hide_root = true
	tree.item_selected.connect(func(): var it := tree.get_selected(); if it != null and it.get_metadata(0) != null and is_instance_valid(it.get_metadata(0)): dock.select(it.get_metadata(0)))
	add_child(tree)


func refresh() -> void:
	if tree == null or dock == null:
		return
	tree.clear()
	var top := tree.create_item()
	var r = dock.root()
	if r == null:
		summary.text = "No scene open."
		return
	var c := HSCompiler.new()
	var res: Dictionary
	if HSDirector.class_of(r) == "HSGame":
		res = c.compile(r, null, HSStoryFile.read(str(r.story_file)))
	elif HSDirector.class_of(r) == "HSLevel":
		res = c.compile(null, r, HSStoryFile.read())
	else:
		summary.text = "Open the game's main scene (an HSGame) or a level (an HSLevel)."
		return
	var st: Dictionary = res["story"]
	var n_task := 0
	var n_scene: int = st["scenes"].size()
	var n_end := 0
	var n_choice := 0
	for k in st["flow"]:
		match st["flow"][k].get("type"):
			"stitch":
				if not str(k).ends_with("__card"):
					n_task += 1
			"ending":
				n_end += 1
			"choice":
				n_choice += 1
	var errs: Array = res["problems"].filter(func(p): return p["error"])
	summary.text = "%d quests, %d conversations, %d branch points, %d endings; %d items, %d notes, %d characters, %d levels. %s" % [n_task, n_scene, n_choice, n_end,
		st["items"].size(), st["notes"].size(), st["cast"].size(), st["levels"].size(),
		("%d to fix, %d to look at." % [errs.size(), res["problems"].size() - errs.size()]) if res["problems"].size() else "Nothing wrong found."]
	for p in res["problems"]:
		var it := tree.create_item(top)
		it.set_text(0, ("✕ " if p["error"] else "⚠ ") + str(p["text"]))
		it.set_custom_color(0, Color(1.0, 0.45, 0.45) if p["error"] else Color(1.0, 0.8, 0.45))
		it.set_metadata(0, p["node"] if p["node"] != null and is_instance_valid(p["node"]) else null)
	if run_problems.size():
		var hi := tree.create_item(top)
		hi.set_text(0, "The last run said:")
		hi.set_selectable(0, false)
		for t in run_problems:
			var it2 := tree.create_item(hi)
			it2.set_text(0, str(t))
