@tool
extends VBoxContainer
## The dock's Director tab (docs/GODOT_DIRECTOR.md §6): the story as the Director file has it (director/director.json,
## written in the Director Manager; read here, never written): its quests in play order with their steps and what
## comes next, the endings, each person's conversations, the moments, the states. While the game runs from the editor:
## the quest it's on (▶), the steps and quests done (✓), the facts it has (●). ▶ Here plays from the selected quest
## with the facts typed under it (the quests before it count as done); Manager opens the file in the page.

const RUN_FILE := "user://hs_director_run.json"

var dock = null
var tree: Tree
var facts_edit: LineEdit
var note: Label
var _sig := ""


func _ready() -> void:
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	var bar := HBoxContainer.new()
	add_child(bar)
	for spec in [["Manager", _manager, "Open the story in the Director Manager, the page that writes director/director.json"],
			["▶", _play, "Play the game from its start"],
			["▶ Here", _play_here, "Play from the selected quest, with the facts below (the quests before it count as done)"],
			["Reload", func(): _sig = ""; refresh(), "Read the Director file again"]]:
		var b := Button.new()
		b.text = spec[0]
		b.tooltip_text = spec[2]
		b.pressed.connect(spec[1])
		bar.add_child(b)
	tree = Tree.new()
	tree.size_flags_vertical = Control.SIZE_EXPAND_FILL
	tree.custom_minimum_size = Vector2(0, 160)
	tree.columns = 2
	tree.set_column_expand_ratio(0, 3)
	tree.set_column_expand_ratio(1, 2)
	tree.set_column_clip_content(1, true)
	tree.hide_root = true
	tree.select_mode = Tree.SELECT_ROW
	add_child(tree)
	facts_edit = LineEdit.new()
	facts_edit.placeholder_text = "▶ Here starts with these facts: read:letter, picked:bedroom_key"
	facts_edit.tooltip_text = "The facts (flags) set when ▶ Here starts at the selected quest (commas between)"
	add_child(facts_edit)
	note = Label.new()
	note.clip_text = true
	note.add_theme_color_override("font_color", Color(0.7, 0.7, 0.7))
	add_child(note)


func file_path() -> String:
	var g = dock.game() if dock != null else null
	return str(g.story_file) if g != null else HSStoryFile.DEFAULT


func tick() -> void:
	var p := file_path()
	var sig := "%s|%s|%s|%s|%d" % [p, FileAccess.get_modified_time(p) if FileAccess.file_exists(p) else 0, dock.running, dock.run_step, dock.run_flags.size()]
	if sig != _sig:
		refresh()


func refresh() -> void:
	if tree == null or dock == null:
		return
	var p := file_path()
	_sig = "%s|%s|%s|%s|%d" % [p, FileAccess.get_modified_time(p) if FileAccess.file_exists(p) else 0, dock.running, dock.run_step, dock.run_flags.size()]
	tree.clear()
	var top := tree.create_item()
	if dock.game() == null:
		note.text = "Open the game's main scene (its root an HSGame) for its story." if dock.root() != null else "No scene open."
		return
	var f := HSStoryFile.read(p)
	if f.has("_error"):
		note.text = str(f["_error"])
		return
	var flags: Dictionary = dock.run_flags
	var qs: Array = f.get("quests", [])
	var qi := _row(top, "Quests (%d)" % qs.size(), "in play order", "task")
	for q in qs:
		var qid := str(q.get("id", ""))
		if q.get("desk") is Dictionary:                # a desk game's scene or choice, as the desk had it (from-desk)
			var dk: Dictionary = q["desk"]
			var kind := "a cutscene" if dk.get("type") == "scene" else ("an ending" if dk.get("type") == "ending" else "a choice by %s" % dk.get("by", "flag"))
			var di := _row(qi, ("▶ " if (dock.running and dock.run_step == qid) else "") + "◆ %s: %s" % [kind, qid], "from the desk", "choice" if dk.get("type") == "choice" else "dialogue")
			di.set_metadata(0, {"quest": qid})
			for o in dk.get("options", []):
				_row(di, "→ " + str(o.get("to", "")), str(o.get("label", o.get("result", ""))), "choice")
			continue
		var mark := "▶ " if (dock.running and dock.run_step == qid) else ("✓ " if flags.has("done:" + qid) else "")
		var it := _row(qi, mark + str(q.get("title", qid)), str(q.get("objective", "")), "task")
		it.set_metadata(0, {"quest": qid})
		if q.get("round") is Dictionary:               # a round of gameplay: hide and seek, a chase (its result the quest's end)
			var rd: Dictionary = q["round"]
			_row(it, "a round: %s%s" % [str(rd.get("type", "?")), (", %d s" % int(rd["secs"])) if rd.has("secs") else ""], str(rd.get("rule", "")), "choice")
		for s in q.get("steps", []):
			var done := flags.has("step:" + str(s.get("id", "")))
			_row(it, ("✓ " if done else "☐ ") + str(s.get("text", s.get("id", ""))), when_text(s.get("done")), "todo")
		for n in q.get("next", []):
			_row(it, "→ " + str(n.get("go", "")), ("if " + cond_text(n.get("if"))) if not HSCond.empty(n.get("if")) else "otherwise", "choice")
	var es: Array = f.get("endings", [])
	var ei := _row(top, "Endings (%d)" % es.size(), "", "ending")
	for e in es:
		_row(ei, ("✓ " if flags.has("ending:" + str(e.get("id", ""))) else "") + str(e.get("title", e.get("id", ""))), str(e.get("kind", "")), "ending")
	var talk: Dictionary = f.get("talk", {}) if f.get("talk") is Dictionary else {}
	var ti := _row(top, "Conversations (%d people)" % talk.size(), "the first whose if holds", "dialogue")
	for who in talk:
		var w := _row(ti, str(who), "%d" % (talk[who] as Array).size(), "actor")
		for t in talk[who]:
			var lines: Array = t.get("lines", [])
			_row(w, ("✓ " if flags.has("talked:" + str(t.get("id", ""))) else "") + (str(lines[0].get("text", "")) if lines.size() else str(t.get("id", ""))),
				("if " + cond_text(t.get("if"))) if not HSCond.empty(t.get("if")) else "any time", "line")
	var ms: Array = f.get("moments", [])
	var mi := _row(top, "Moments (%d)" % ms.size(), "when, if, then", "event")
	for m in ms:
		_row(mi, ("✓ " if flags.has("_fired_" + str(m.get("id", ""))) else "") + str(m.get("id", "")), when_text(m.get("when")), "event")
	var ss: Array = f.get("states", [])
	var si := _row(top, "States (%d)" % ss.size(), "while, set", "spot")
	for st in ss:
		if st is Dictionary:
			_row(si, ", ".join(PackedStringArray((st.get("set", {}) as Dictionary).keys())), "while " + cond_text(st.get("while")), "spot")
	si.collapsed = true
	if dock.running:
		var fi := _row(top, "Facts", "the running game's", "game")
		var names: Array = []
		for k in flags:
			var s := str(k)
			if not (s.begins_with("?") or s.begins_with("_fired_") or s.begins_with("@")):
				names.append(s)
		names.sort()
		for s in names:
			_row(fi, "● " + s, "", "")
	note.text = "%s · %d quests, %d endings, %d moments" % [p, qs.size(), es.size(), ms.size()]


func _row(parent: TreeItem, a: String, b: String, ic: String) -> TreeItem:
	var it := tree.create_item(parent)
	it.set_text(0, a)
	it.set_text(1, b)
	if ic != "":
		it.set_icon(0, dock.icon(ic))
	return it


## a trigger as a few words ("enters kitchen", "uses kettle")
static func when_text(w) -> String:
	if not (w is Dictionary) or w.is_empty():
		return ""
	var words := {"enter": "enters", "exit": "leaves", "use": "uses", "pickup": "picks up", "read": "reads", "look": "looks at",
		"gave": "gives", "state": "when", "ticked": "ticked", "flag": "flag", "holds": "once"}
	for k in w:
		if k == "holds":
			return "once " + cond_text(w[k])
		if k == "gave":
			return "gives %s to %s" % [w[k], w.get("to", "")]
		if words.has(k):
			return "%s %s" % [words[k], w[k]]
	return JSON.stringify(w)


## a condition as a few words
static func cond_text(c) -> String:
	if HSCond.empty(c):
		return "always"
	if c is String:
		return c
	if c is Array:
		return " and ".join(PackedStringArray(c.map(func(x): return cond_text(x))))
	if c is Dictionary:
		if c.has("all"):
			return cond_text(c["all"])
		if c.has("any"):
			return " or ".join(PackedStringArray((c["any"] as Array).map(func(x): return cond_text(x))))
		if c.has("not"):
			return "not " + cond_text(c["not"])
		for k in ["fact", "quest", "done", "step", "ending", "has"]:
			if c.has(k):
				return "%s %s" % [k, c[k]] if k != "fact" else str(c[k])
	return JSON.stringify(c)


func _play() -> void:
	EditorInterface.play_main_scene()


func _play_here() -> void:
	var it := tree.get_selected()
	var md = it.get_metadata(0) if it != null else null
	if not (md is Dictionary) or not md.has("quest"):
		note.text = "Select a quest to play from."
		return
	var fl: Array = []
	for s in facts_edit.text.split(","):
		if s.strip_edges() != "":
			fl.append(s.strip_edges())
	var f := FileAccess.open(RUN_FILE, FileAccess.WRITE)
	f.store_string(JSON.stringify({"from": md["quest"], "flags": fl}))
	f.close()
	EditorInterface.play_main_scene()


## the Director Manager (tools/director_manager in the studio): started on this project and opened in the browser
func _manager() -> void:
	note.text = dock.open_manager()
