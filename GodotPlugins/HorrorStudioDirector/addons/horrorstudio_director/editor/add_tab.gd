@tool
extends ScrollContainer
## The dock's Add tab (docs/GODOT_DIRECTOR.md §6): every node the game is made of, a button each. A click puts it in
## front of the editor's camera, on the floor (in the selected room or level; a story node where it belongs in the
## story); a drag drops it into the 3D view where you let go (the preset's scene, made the scene's own node once it
## lands). Hover for what each one does.

const PRESETS := "res://addons/horrorstudio_director/presets/"
const LEVEL := [["Level", "level", "level", "A level: a place the game plays in (its rooms, its things)"],
	["Room", "room", "room", "A room: floor, walls, ceiling from its size; a door on a wall opens it"],
	["Big room", "room", "room_big", "A larger room (7 × 6 m, 3 m high)"],
	["Corridor", "room", "corridor", "A corridor (1.6 m wide, 6 m long)"],
	["Door", "door", "door", "A door: put it on a room's wall; it swings away from the player"],
	["Locked door", "door", "door_locked", "A door locked until the player has the key (locked_by)"],
	["Area", "trigger", "area", "An area the player walks into: put events in it (a jumpscare, a thought)"],
	["Safe area", "trigger", "area_safe", "An area where a watching character can't see the player"],
	["Spot", "spot", "spot", "A spot: where the player starts, where a character stands or is sent"],
	["Path", "path", "path", "A path a character walks: its points with Godot's path tools, or HSSpot children"],
	["Character", "actor", "character", "A character: stands, sits, walks a path; talks; watches"],
	["Watcher", "actor", "watcher", "A character who watches for the player (the suspicion meter, caught)"],
	["Light", "", "light", "A lamp of the story's: switches, the power cut and the lights dying find it by its name"]]
const THINGS := [["Key", "thing", "key", "A pickup: into the inventory; a locked door or an event asks for its item"],
	["Flashlight", "thing", "flashlight", "The flashlight: picked up, F switches it"],
	["Note", "thing", "note", "A note to read: its title and words on a card"],
	["Look closely", "thing", "inspect", "A small thing taken up in the hands and turned, its words under it"],
	["Light switch", "thing", "switch", "Switches the lights of its room (or the ones it names)"],
	["Breaker", "thing", "breaker", "The breaker box: the power off and back on"],
	["Chair", "thing", "chair", "A seat: the player sits down, the eye at sitting height"],
	["Bed", "thing", "bed", "A bed: lie down, the view dark (a chapter card next)"],
	["Wardrobe", "thing", "wardrobe", "Somewhere to hide: in, the look limited, out again"],
	["Box", "thing", "box", "Something to carry in both hands and put down (G)"],
	["Die", "thing", "die", "A die thrown from the hand, its face heard"],
	["Code lock", "thing", "code_lock", "A keypad: the right code sets its flag"],
	["Needs an item", "thing", "use_item", "Something an item is used on: it sets its flag"],
	["Stain", "thing", "stain", "A stain to scrub away (hold the button)"],
	["Game table", "thing", "table_game", "A board game at a table"],
	["Prop", "thing", "prop", "A solid thing to name in events (put a model in it)"]]
const STORY := [["Chapter", "chapter", "_add_chapter", "A chapter: its card, its time of day; its steps under it"],
	["Task", "task", "_add_task", "A task: the objective, its to-do list, its events"],
	["To-do", "todo", "_add_todo", "A to-do in the selected task, ticked by what the player does"],
	["Event", "event", "_add_event", "An event: when, if, then (in the selected task, chapter, area or thing)"],
	["Dialogue", "dialogue", "_add_dialogue", "A conversation: lines, a question with answers"],
	["Line", "line", "_add_line", "A line in the selected dialogue"],
	["Option", "option", "_add_option", "An answer under the selected line, or a way of the selected choice"],
	["Choice", "choice", "_add_choice", "Where the story branches: by flags, by what the player does, by karma"],
	["Ending", "ending", "_add_ending", "An ending: its card's title and words"]]

var dock = null
var box: VBoxContainer


func _ready() -> void:
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	box = VBoxContainer.new()
	box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	add_child(box)
	_section("The level (click: in front of the camera; drag: into the view)", LEVEL, true)
	_section("Things to use", THINGS, true)
	_section("The story", STORY, false)


func refresh() -> void:
	pass


func _section(title: String, items: Array, level: bool) -> void:
	var l := Label.new()
	l.text = title
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.add_theme_color_override("font_color", Color(0.75, 0.82, 1.0))
	box.add_child(l)
	var grid := HFlowContainer.new()
	box.add_child(grid)
	for it in items:
		var b := Button.new()
		b.text = it[0]
		b.icon = dock.icon(it[1]) if it[1] != "" else null
		b.tooltip_text = it[3]
		b.custom_minimum_size = Vector2(92, 0)
		if level:
			var path: String = PRESETS + it[2] + ".tscn"
			b.pressed.connect(_place.bind(path))
			b.set_drag_forwarding(func(_at): return _drag(b, path), func(_a, _d): return false, func(_a, _d): pass)
		else:
			b.pressed.connect(func(): dock.story_tab.call(it[2]))
		grid.add_child(b)


## a drag into the 3D view: the editor takes a scene file dropped there and puts it where it lands
func _drag(b: Button, path: String):
	var l := Label.new()
	l.text = b.text
	b.set_drag_preview(l)
	return {"type": "files", "files": [path], "from": b}


## a click: the preset made a node of the scene's own, in front of the camera, in the selected room or level
func _place(path: String) -> void:
	var r = dock.root()
	if r == null:
		dock.say("Open a scene first (the game's main scene, or a level)")
		return
	var n: Node = (load(path) as PackedScene).instantiate()
	n.scene_file_path = ""
	if n is Path3D and n.curve != null:
		n.curve = n.curve.duplicate()
	var p: Node = dock.level_parent()
	if p == null:
		p = r
	if n is Node3D:
		var xf: Transform3D = dock.view_spot()
		var keep_y: float = n.position.y
		var local: Transform3D = (p.global_transform.affine_inverse() * xf) if p is Node3D else xf
		local.origin.y += keep_y
		n.transform = Transform3D(local.basis, local.origin)
	n.name = dock.fresh_name(p, str(n.name))
	dock.add_node(p, n, "add " + str(n.name))
