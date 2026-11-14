@tool
## What the three tabs share about flags and things (docs/FLAGS.md §3 to §6): the scene's scan (kept until the scene
## changes), the flags written down (res://flags.json: a note, who one belongs to), and every change that ties things
## together, each through the editor's undo:
##   ask(node, word)        a node asks for a flag: a marker's Starts when, a thing's own Needs, else its Logic
##   switch(node, word)     a node switches one: a marker's Then, else the thing's Logic
##   link_thing(thing)      a thing clicked from a condition: its Logic turns a flag on when it's used (a door: when
##                          it's opened; an area: when you walk in); -> the flag, for whoever asked
##   link_marker(marker)    a marker's pin clicked from a thing: its Then turns a flag on; -> the flag
##   rename(kind, old, new) a name changed everywhere (new "": taken out everywhere)
##   make(card, at)         a card of the Things tab: the selected node made a pickup, a note...; an area placed
##   setup_scene()          the player, the Story, the HUD and the Sound node a scene lacks
extends RefCounted

const NOTES := "res://flags.json"
const VERBS := {"opened": "opened", "entered": "entered", "body_entered": "entered", "scared": "scared", "picked": "taken", "read": "read"}

## the Things tab's cards: `on`: made of the node selected in the scene; `place`: put where you click in the 3D view
const CARDS := [
	{"id": "logic", "title": "Logic", "icon": "logic", "how": "on", "tip": "The selected thing works only when its flags are so, and switches flags when it's used. Any node: a door, a pickup, a lamp."},
	{"id": "pickup", "title": "Pickup", "icon": "pick_up", "how": "on", "script": "res://starter/pickup.gd", "tip": "The selected thing is picked up with E: it goes into the pocket as an item (a key opens a door locked by its name)."},
	{"id": "note", "title": "Note", "icon": "note", "how": "on", "script": "res://starter/note.gd", "tip": "The selected thing is read with E: its words on a card."},
	{"id": "food", "title": "Food", "icon": "food", "how": "on", "script": "res://starter/food.gd", "tip": "The selected thing is taken with E and can be eaten (it mends the sanity meter)."},
	{"id": "shown", "title": "Show / hide", "icon": "eye", "how": "child", "script": "res://starter/shown.gd", "tip": "The selected thing is there, or isn't: Shown When and Hidden When say by which flags."},
	{"id": "quest_marker", "title": "Quest marker", "icon": "appear", "how": "child3d", "script": "res://addons/horrorstudio_ui/quest_marker.gd", "tip": "A guide marker over the selected thing while its Needs hold (on:<task>: while that task is open)."},
	{"id": "area", "title": "Area", "icon": "area", "how": "place", "script": "res://starter/event_area.gd", "tip": "Click the floor: a box that does something when you walk in (an objective, a task, a line, a flag)."},
	{"id": "scare", "title": "Scare", "icon": "scare", "how": "place", "script": "res://starter/scare_area.gd", "tip": "Click the floor: a box that scares when you walk in (lights out, someone shown, a sound)."},
	{"id": "checkpoint", "title": "Checkpoint", "icon": "checkpoint", "how": "place", "script": "res://starter/checkpoint.gd", "tip": "Click the floor: walking in keeps the game (dying comes back here)."},
	{"id": "rule", "title": "Rule", "icon": "event", "how": "rule", "tip": "Something that happens by itself the moment its flags are so: flags switched, a task, a line, things fired."},
]

var plugin: EditorPlugin
var _found := {}
var _stale := true
var _notes := {}
var _notes_at := -1


# ---- the scene read ---------------------------------------------------------------------------------------------------------
func touch() -> void:
	_stale = true


## the scene's flags, tasks and things carried, with every use (HSLogicScan.scan), kept until the scene changes
func found() -> Dictionary:
	if _stale or _found.is_empty():
		_found = HSLogicScan.scan(plugin.scene_root())
		_stale = false
	return _found


## the names of a kind: what the scene uses and, for flags, what's written down
func names(kind: String) -> PackedStringArray:
	var out := HSLogicScan.names(found(), kind)
	if kind == "flag":
		for n in notes():
			if not (String(n) in out):
				out.append(String(n))
		out.sort()
	return out


func uses(kind: String, name: String) -> Array:
	return (found().get(kind, {}) as Dictionary).get(name, [])


## who a flag belongs to: pinned in the notes, else worked out from who uses it ("": the game's)
func home(name: String) -> String:
	var pinned := String((notes().get(name, {}) as Dictionary).get("home", ""))
	if pinned != "":
		return "" if pinned == "game" else pinned
	return HSLogicScan.home_of(uses("flag", name))


func home_says(h: String) -> String:
	if h == "":
		return "the game"
	var who := h.get_slice("/", 0)
	for n in plugin.npcs():
		if (n as HSNpc).id() == who:
			who = (n as HSNpc).display_name()
	return who + (" › " + h.get_slice("/", 1) if h.contains("/") else "")


## The scene's flags in groups for a picker, the nearest first: [[title, [names]]]. `ctx`: the node being edited (a
## marker: its quest's flags first, then its character's, then the game's).
func flag_groups(ctx: Node = null) -> Array:
	var npc := HSNpcFlow.npc_of(ctx) as HSNpc if ctx != null else null
	var q := HSNpcFlow.quest_of(ctx) if ctx != null else null
	var mine_q := []
	var mine := []
	var game := []
	var others := []
	var kit := []
	for name in names("flag"):
		if HSLogicScan.kit_flag(name):
			kit.append(name)
			continue
		var h := home(name)
		if npc != null and q != null and h == npc.id() + "/" + q.label():
			mine_q.append(name)
		elif npc != null and h.get_slice("/", 0) == npc.id():
			mine.append(name)
		elif h == "":
			game.append(name)
		else:
			others.append(name)
	var out := []
	if npc != null:
		if q != null:
			out.append(["This quest's (ticked: must be on)", mine_q])
		out.append([npc.display_name() + "'s", mine])
		out.append(["The game's", game])
		out.append(["Other characters'", others])
	else:
		out.append(["Flags (ticked: must be on)", game + others])
	out.append(["By themselves", kit])
	return out


func problems() -> Array:
	return HSLogicScan.problems(found(), notes())


# ---- the flags written down -------------------------------------------------------------------------------------------------
## res://flags.json: {name: {note, home}}. A flag needs no entry to exist; an entry keeps a note, pins who it belongs
## to, or lists a flag before anything uses it.
func notes() -> Dictionary:
	var at := FileAccess.get_modified_time(NOTES) if FileAccess.file_exists(NOTES) else 0
	if at != _notes_at:
		_notes_at = at
		_notes = {}
		if at != 0:
			var d = JSON.parse_string(FileAccess.get_file_as_string(NOTES))
			if d is Dictionary and (d as Dictionary).get("flags") is Dictionary:
				_notes = d["flags"]
	return _notes


func _save_notes(d: Dictionary) -> void:
	var clean := {}
	var keys := d.keys()
	keys.sort()
	for k in keys:
		clean[k] = d[k]
	if clean.is_empty() and not FileAccess.file_exists(NOTES):
		return
	var f := FileAccess.open(NOTES, FileAccess.WRITE)
	if f != null:
		f.store_string(JSON.stringify({"flags": clean}, "\t") + "\n")
		f.close()
	_notes = clean.duplicate(true)
	_notes_at = FileAccess.get_modified_time(NOTES)


func _notes_action(label: String, now: Dictionary) -> void:
	var was := notes().duplicate(true)
	var ur: EditorUndoRedoManager = plugin.get_undo_redo()
	ur.create_action("Flags: " + label, UndoRedo.MERGE_DISABLE, plugin.scene_root())
	ur.add_do_method(self, "_save_notes", now)
	ur.add_undo_method(self, "_save_notes", was)
	ur.commit_action()


## a flag written down (nothing has to use it yet); -> its name (made safe, and new)
func declare(name: String) -> String:
	var nm := HSNpcCond.slug(name)
	if nm == "":
		nm = "new_flag"
	var all := names("flag")
	var base := nm
	var i := 2
	while nm in all:
		nm = "%s_%d" % [base, i]
		i += 1
	var now := notes().duplicate(true)
	now[nm] = {}
	_notes_action("a new flag '%s'" % nm, now)
	return nm


## a flag's note or home ("" worked out, "game", "<npc id>", "<npc id>/<quest>")
func set_note(name: String, key: String, value: String) -> void:
	var now := notes().duplicate(true)
	var e: Dictionary = (now.get(name, {}) as Dictionary).duplicate()
	if String(e.get(key, "")) == value:
		return
	if value == "":
		e.erase(key)
	else:
		e[key] = value
	if e.is_empty() and uses("flag", name).size() > 0:
		now.erase(name)
	else:
		now[name] = e
	_notes_action("%s of '%s'" % [key, name], now)


# ---- the Story ---------------------------------------------------------------------------------------------------------------
## the scene's Story (the starter kit's: a node with flags_start and tasks), or null
func story() -> Node:
	var r: Node = plugin.scene_root()
	if r == null:
		return null
	for n in ([r] + r.find_children("*", "CanvasLayer", true, false)):
		if (n as Node).get_script() != null and "flags_start" in n and "tasks" in n:
			return n
	return null


func starts_on(name: String) -> bool:
	var st := story()
	if st == null:
		return false
	for line in HSLogicScan.lines(st.get("flags_start")):
		for f in HSNpcCond.switched(String(line)):
			if String(f["name"]) == name:
				return true
	return false


## a flag on when the game starts, or not (the Story's Flags Start)
func set_start(name: String, on: bool) -> bool:
	var st := story()
	if st == null:
		return false
	var lines := PackedStringArray()
	for line in HSLogicScan.lines(st.get("flags_start")):
		if HSNpcCond.switched(String(line)).all(func(f) -> bool: return String(f["name"]) != name):
			lines.append(line)
	if on:
		lines.append(name)
	plugin.set_prop(st, "flags_start", lines, "'%s' on at the start" % name if on else "'%s' off at the start" % name)
	return true


# ---- a name changed everywhere -----------------------------------------------------------------------------------------------
# may a node's fields be changed and saved with this scene?
func _saved_here(node: Node) -> bool:
	var r: Node = plugin.scene_root()
	if node == r or node.owner == r:
		return true
	return node.owner != null and r.is_ancestor_of(node.owner) and r.is_editable_instance(node.owner)


## A flag, a task or a thing carried renamed in every field that names it (new "": taken out of them), one undo step.
## -> {changed: how many fields, skipped: [nodes inside another scene that this one can't change]}
func rename(kind: String, old: String, new: String) -> Dictionary:
	var nm := new.strip_edges()
	if kind == "flag" and nm != "" and not HSLogicScan.kit_flag(nm):
		nm = HSNpcCond.slug(nm)
	var out := {"changed": 0, "skipped": [], "name": nm}
	if old == "" or nm == old:
		return out
	touch()
	var plan := HSLogicScan.rename_plan(found(), kind, old, nm)
	var now := notes().duplicate(true)
	var was := now.duplicate(true)
	if kind == "flag" and now.has(old):
		if nm != "" and not now.has(nm):
			now[nm] = now[old]
		now.erase(old)
	var ur: EditorUndoRedoManager = plugin.get_undo_redo()
	ur.create_action(("Flags: rename '%s' to '%s'" % [old, nm]) if nm != "" else ("Flags: take '%s' out everywhere" % old), UndoRedo.MERGE_DISABLE, plugin.scene_root())
	for ch in plan:
		var node := ch[0] as Node
		if not _saved_here(node):
			(out["skipped"] as Array).append(node)
			continue
		plugin.do_prop(ur, node, ch[1], ch[2])
		out["changed"] += 1
	if now != was:
		ur.add_do_method(self, "_save_notes", now)
		ur.add_undo_method(self, "_save_notes", was)
	ur.commit_action()
	touch()
	return out


# ---- things and their Logic -------------------------------------------------------------------------------------------------
## Every thing of the scene, in the scene's order: a node with a use(), with fields that ask or switch, or with a Logic;
## a Logic that happens by itself is a thing of its own (a rule). A character's markers aren't things.
func things() -> Array:
	var out := []
	var r: Node = plugin.scene_root()
	if r == null:
		return out
	var todo: Array = [r]
	while not todo.is_empty():
		var n: Node = todo.pop_back()
		if n is HSNpc or String(n.name).begins_with("_"):
			continue
		var kids := n.get_children()
		kids.reverse()
		todo.append_array(kids)
		if n is HSLogic:
			var t: Node = n if is_rule(n) else (n as HSLogic).thing_node()
			if t != null and not (t in out):
				out.append(t)
		elif n.get_script() != null and (n.has_method("use") or not HSLogicScan.fields_of(n).is_empty()):
			if n is CharacterBody3D or n.has_method("logic_of") or not _saved_here(n):
				continue                                           # (the player isn't a thing; nor is what's inside an instanced scene)
			if not (n in out):
				out.append(n)
	return out


## what was clicked, up to something that's a thing: a node with a use(), an area, a node with a Logic (else itself)
func thing_of(node: Node) -> Node:
	var p := node
	var r: Node = plugin.scene_root()
	while p != null and p != r:
		if p.has_method("use") or p is Area3D or not logics(p).is_empty():
			return p
		p = p.get_parent()
	return node


## a Logic that isn't about its parent: it happens by itself
func is_rule(n: Node) -> bool:
	return n is HSLogic and (n as HSLogic).on == "itself" and (n as HSLogic).thing.is_empty()


## the Logic nodes of a thing (a rule: itself)
func logics(thing: Node) -> Array:
	var out := []
	if thing == null or not is_instance_valid(thing):
		return out
	if thing is HSLogic:
		return [thing]
	for c in thing.get_children():
		if c is HSLogic and (c as HSLogic).thing_node() == thing:
			out.append(c)
	for l in plugin.scene_root().find_children("*", "HSLogic", true, false):
		if not (l in out) and not (l as HSLogic).thing.is_empty() and (l as HSLogic).thing_node() == thing:
			out.append(l)
	return out


## what sets a thing's Logic off when nobody says: a door when it's opened (not just tried), an area when it has
## done its own thing or you walk in, anything else when it's used. -> [on, on_signal]
func default_when(thing: Node) -> Array:
	for sig in ["opened", "entered", "scared"]:
		if thing.has_signal(sig):
			return ["signal", sig]
	if thing is Area3D:
		return ["signal", "body_entered"]
	return ["used", ""]


## the signals of a thing a Logic can listen to: its script's own first, then a few of its class's
func signals_of(thing: Node) -> PackedStringArray:
	var out := PackedStringArray()
	if thing == null:
		return out
	var sc: Script = thing.get_script()
	if sc != null:
		for s in sc.get_script_signal_list():
			out.append(String(s["name"]))
	for s2 in ["body_entered", "body_exited", "pressed", "toggled", "timeout", "finished", "animation_finished", "visibility_changed"]:
		if thing.has_signal(s2) and not (s2 in out):
			out.append(s2)
	return out


## A thing's Logic: the first it has (with `when`: the first set off that way), else one made with `set`.
func logic_for(thing: Node, when: Array = [], set: Dictionary = {}) -> HSLogic:
	if thing is HSLogic:
		return thing
	for l in logics(thing):
		if when.is_empty() or ((l as HSLogic).on == String(when[0]) and (String(when[0]) != "signal" or (l as HSLogic).on_signal == String(when[1]))):
			return l
	var lg := HSLogic.new()
	lg.name = "Logic"
	if not when.is_empty():
		lg.on = String(when[0])
		lg.on_signal = String(when[1])
	for k in set:
		lg.set(k, set[k])
	plugin.add_node(thing, lg, "Logic for " + String(thing.name))
	touch()
	return lg


# the field of a node that says when it happens ("": it has none, its Logic does)
func ask_prop(node: Node) -> String:
	if node is HSNpcMarker:
		return "start_when"
	if node is HSNpcQuest:
		return "starts_when"
	if node is HSNpcWay:
		return "when"
	if node is HSLogic:
		return "needs"
	for f in HSLogicScan.fields_of(node):
		if String(f[0]) == "needs":
			return "needs"
	return ""


## A node asks for something: `word` a condition's word ("alex_gone", "!alarm", "task:key"). A marker's Starts when,
## a thing's own Needs when it has one, else its Logic's (made when it has none). -> the node that now asks
func ask(node: Node, word: String) -> Node:
	if not plugin.valid(node):
		return null
	var prop := ask_prop(node)
	var who := node
	if prop == "":
		var had := logics(node)
		if had.is_empty():
			return logic_for(node, [], {"needs": word})
		who = had[0]
		prop = "needs"
	plugin.set_prop(who, prop, HSNpcCond.with_word(str(who.get(prop)), word), "%s needs %s" % [node.name, word])
	touch()
	return who


## A node switches a flag: `word` "+name", "-name" or "~name". A marker's Then, else the thing's Logic (made when it
## has none, set off by what the thing does: default_when). -> the node that now switches it
func switch(node: Node, word: String) -> Node:
	if not plugin.valid(node):
		return null
	var who := node
	if not (node is HSNpcMarker or node is HSLogic):
		var when := default_when(node)
		var had := logics(node)
		if had.is_empty():
			return logic_for(node, when, {"set_flags": word})
		who = had[0]
	var sign := word[0] if word[0] in ["+", "-", "~"] else "+"
	var nm := word.substr(1).strip_edges() if word[0] in ["+", "-", "~"] else word
	var list := HSNpcCond.switched(str(who.get("set_flags")))
	var parts := PackedStringArray()
	var done := false
	for f in list:
		if String(f["name"]) == nm:
			parts.append(sign + nm)
			done = true
		else:
			parts.append(String(f["op"]) + String(f["name"]))
	if not done:
		parts.append(sign + nm)
	plugin.set_prop(who, "set_flags", ", ".join(parts), "%s switches %s" % [node.name, word])
	touch()
	return who


# a flag's name nobody uses yet
func _fresh(base: String) -> String:
	var all := names("flag")
	var nm := base
	var i := 2
	while nm in all:
		nm = "%s_%d" % [base, i]
		i += 1
	return nm


## A thing tied from someone's condition in one gesture: its Logic turns a flag on when the thing does its thing
## (a door: opened; an area: entered; anything else: used). A flag it already turns on that way is used again.
## -> the flag
func link_thing(thing: Node) -> String:
	if not plugin.valid(thing) or thing is HSNpcMarker or thing is HSNpcQuest or thing is HSNpc:
		return ""
	var when := default_when(thing)
	for l in logics(thing):
		var lg := l as HSLogic
		if lg.on == String(when[0]) and (lg.on != "signal" or lg.on_signal == String(when[1])):
			for f in HSNpcCond.switched(lg.set_flags):
				if String(f["op"]) == "+":
					return String(f["name"])
	var verb := String(VERBS.get(String(when[1]), "used")) if String(when[0]) == "signal" else "used"
	var flag := _fresh("%s_%s" % [HSNpcCond.slug(String(thing.name)), verb])
	switch(thing, "+" + flag)
	return flag


## A marker tied from a thing's condition in one gesture: its Then turns a flag on (one it already turns on is used
## again). -> the flag
func link_marker(m: Node) -> String:
	if not (m is HSNpcMarker):
		return ""
	var mk := m as HSNpcMarker
	for f in HSNpcCond.switched(mk.set_flags):
		if String(f["op"]) == "+":
			return String(f["name"])
	var npc := HSNpcFlow.npc_of(m) as HSNpc
	var flag := _fresh("%s_%s_done" % [npc.id() if npc != null else "npc", HSNpcCond.slug(mk.title())])
	switch(m, "+" + flag)
	return flag


# ---- making things ----------------------------------------------------------------------------------------------------------
func card(id: String) -> Dictionary:
	for c in CARDS:
		if c["id"] == id:
			return c
	return {}


## Can a card be made of this node? "" when it can; else why not.
func cant(c: Dictionary, node: Node) -> String:
	var how := String(c.get("how", ""))
	if how in ["place", "rule"]:
		return ""
	if not plugin.valid(node):
		return "Select the thing in the scene first."
	if c.has("script") and not ResourceLoader.exists(String(c["script"])):
		return "This project has no %s." % String(c["script"])
	if how == "on":
		if c["id"] == "logic":
			return ""
		if not (node is Node3D):
			return "%s isn't something in the 3D world." % node.name
		if node.get_script() != null:
			return "%s already is a %s: it has a script. (Logic works on anything.)" % [node.name, HSLogicScan.what(node)]
	if how == "child3d" and not (node is Node3D):
		return "%s isn't something in the 3D world." % node.name
	return ""


func _set_script(node: Node, sc) -> void:
	if is_instance_valid(node):
		node.set_script(sc)


## A card made: of the selected node (`on`, `child`), or at `at` (`place`). -> the node made or changed (null: it
## couldn't; `say` on the plugin's docks says why)
func make(c: Dictionary, node: Node = null, at = null) -> Node:
	var why := cant(c, node)
	if why != "":
		plugin.say(why)
		return null
	var r: Node = plugin.scene_root()
	var how := String(c.get("how", ""))
	var made: Node = null
	match how:
		"on":
			if c["id"] == "logic":
				made = logic_for(node)
			else:
				var ur: EditorUndoRedoManager = plugin.get_undo_redo()
				ur.create_action("Things: %s a %s" % [node.name, String(c["title"]).to_lower()], UndoRedo.MERGE_DISABLE, r)
				ur.add_do_method(self, "_set_script", node, load(String(c["script"])))
				ur.add_undo_method(self, "_set_script", node, null)
				ur.commit_action()
				made = node
		"child", "child3d":
			var ch: Node = Node3D.new() if how == "child3d" else Node.new()
			ch.name = String(c["title"]).replace(" / ", "").replace(" ", "")
			ch.set_script(load(String(c["script"])))
			plugin.add_node(node, ch, "%s for %s" % [c["title"], node.name])
			made = ch
		"rule":
			var lg := HSLogic.new()
			lg.name = "Rule"
			lg.on = "itself"
			plugin.add_node(r, lg, "a rule")
			made = lg
		"place":
			var a := Area3D.new()
			a.name = String(c["title"])
			var cs := CollisionShape3D.new()
			cs.name = "Shape"
			var bs := BoxShape3D.new()
			bs.size = Vector3(2, 2, 2)
			cs.shape = bs
			cs.position.y = 1.0
			a.add_child(cs)
			a.set_script(load(String(c["script"])))
			plugin.add_node(r, a, "a %s" % String(c["title"]).to_lower())
			if at is Vector3:
				a.global_position = at
			made = a
	touch()
	return made


## What a by-hand game needs and this scene lacks, added: the player, the Story, the HUD, the Sound node. -> their names
func setup_scene() -> PackedStringArray:
	var out := PackedStringArray()
	var r: Node = plugin.scene_root()
	if r == null:
		return out
	var has := func(tail: String) -> bool:
		for n in ([r] + r.find_children("*", "", true, false)):
			var sc: Script = (n as Node).get_script()
			if sc != null and sc.resource_path.ends_with(tail):
				return true
		return false
	var ur: EditorUndoRedoManager = plugin.get_undo_redo()
	var adds := []
	if not has.call("starter/player.gd") and ResourceLoader.exists("res://starter/player.tscn"):
		var pl := (load("res://starter/player.tscn") as PackedScene).instantiate(PackedScene.GEN_EDIT_STATE_INSTANCE)
		pl.name = "Player"
		adds.append(pl)
	if story() == null and ResourceLoader.exists("res://starter/story.gd"):
		var st := CanvasLayer.new()
		st.name = "Story"
		st.set_script(load("res://starter/story.gd"))
		adds.append(st)
	if not has.call("horrorstudio_ui/hud.gd") and ResourceLoader.exists("res://addons/horrorstudio_ui/hud.gd"):
		var hud := CanvasLayer.new()                             # (set_script, never Script.new(): that would run the HUD for real inside the editor)
		hud.name = "Hud"
		hud.set_script(load("res://addons/horrorstudio_ui/hud.gd"))
		adds.append(hud)
	if not has.call("starter/sound.gd") and ResourceLoader.exists("res://starter/sound.gd"):
		var snd := Node.new()
		snd.name = "Sound"
		snd.set_script(load("res://starter/sound.gd"))
		adds.append(snd)
	if adds.is_empty():
		return out
	ur.create_action("Things: set up the scene", UndoRedo.MERGE_DISABLE, r)
	for n in adds:
		ur.add_do_method(plugin, "_add", r, n, -1)
		ur.add_do_reference(n)
		ur.add_undo_method(plugin, "_remove", r, n)
		out.append(String((n as Node).name))
	ur.commit_action()
	touch()
	return out


## does the project's player ask a thing's Logic? (false: its starter/player.gd is from before the Logic node)
func player_asks() -> bool:
	var path := "res://starter/player.gd"
	if not FileAccess.file_exists(path):
		return true
	return FileAccess.get_file_as_string(path).contains("func logic_of")
