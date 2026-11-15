## The pause menu, for a game built by hand (the enhancements review, docs/TOOLS_REVIEW.md): the UI plugin's own (the
## runtime's menu.gd: the controls on the left, Resume, Save game, Load game, Settings, Quit) over the scene's HSHud.
## Esc holds the game (the tree paused: the player, her, a hunt, the director all wait) and opens it; Esc again, or
## Resume, and the game goes on. Save game writes the Story's save (save_game: a checkpoint where you stand) to slot 1,
## 2 or 3; Load game lists the Autosave (the Story's Autosave writes it at every checkpoint) and the slots there are;
## Settings are applied as they're changed and kept for the next time the game starts; Quit to title starts the scene
## again (or goes to `title_scene`), Quit to desktop quits.
## Put it in the main scene: a Node called Pause with this script, beside the Story and an HSHud (it asks the HUD for
## its menu: the HUD's Pause Menu). Not while the laptop has you, the game's ended or you're dead.
extends Node

const MenuC := preload("res://addons/horrorstudio_ui/menu.gd")

signal opened                                         ## the game held, the menu up
signal closed(result)                                 ## "resume", "escaped", "loaded" or {"quit": "title" | "desktop"}

@export var hud_path: NodePath                        ## the HSHud (the scene's first when empty)
@export var title := ""                               ## what the menu calls the game (the project's name when empty)
@export_file("*.tscn") var title_scene := ""           ## where Quit to title goes ("": this scene from its start)

var up := false                                       ## the menu's up
var played := 0.0                                     ## seconds played (the menu shows it with each save; a save keeps it)
var _hud: Node = null
var _load := -1                                       # a slot to load once the menu's shut


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS           # (it hears Esc while the game is held)
	add_to_group("hs_pause")
	add_to_group("hs_saves")                          # (the time played goes with a save)
	_find.call_deferred()


func _find() -> void:
	var st := _story()
	if st != null and st.has_signal("saved") and not st.saved.is_connected(_on_saved):
		st.saved.connect(_on_saved)


func _story() -> Node:
	return get_tree().get_first_node_in_group("hs_story")


func _the_hud() -> Node:
	if _hud != null and is_instance_valid(_hud):
		return _hud
	_hud = get_node_or_null(hud_path) if not hud_path.is_empty() else null
	if _hud == null:
		for n in get_tree().root.find_children("*", "CanvasLayer", true, false):
			var sc: Script = n.get_script()
			if sc != null and sc.get_global_name() == &"HSHud":
				_hud = n
				break
	return _hud


func menu() -> Node:
	var h := _the_hud()
	if h == null:
		return null
	if h.get("menu") == null and h.has_method("make_menu"):
		h.call("make_menu")
	return h.get("menu")


func _process(dt: float) -> void:
	if not get_tree().paused:
		played += dt


## can it open now: a HUD with its menu, nobody at the laptop, the game going on
func can_open() -> bool:
	if up or menu() == null:
		return false
	for lap in get_tree().get_nodes_in_group("hs_laptop"):
		if bool(lap.get("using")):
			return false
	var st := _story()
	if st != null and (bool(st.get("over")) or bool(st.get("dead"))):
		return false
	return true


func _input(e: InputEvent) -> void:
	if not (e is InputEventKey) or not e.pressed or e.echo:
		return
	if up:
		get_viewport().set_input_as_handled()         # (first: the menu closing lets the game go on inside this call)
		var code := OS.get_keycode_string(e.physical_keycode)
		if code == "Kp Enter":
			code = "Enter"
		var m := menu()
		if m != null:
			m.call("key", code)
	elif e.physical_keycode == KEY_ESCAPE and can_open():
		get_viewport().set_input_as_handled()
		open()


## the game held and the menu up; -> what closed it (closed's result)
func open() -> Variant:
	var m := menu()
	if m == null or up:
		return null
	up = true
	_load = -1
	get_tree().paused = true
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	opened.emit()
	var r = await m.call("open", _ctx())
	get_tree().paused = false
	up = false
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	if r is Dictionary and r.has("quit"):
		if r["quit"] == "desktop":
			get_tree().quit()
		elif title_scene != "":
			get_tree().change_scene_to_file(title_scene)
		else:
			get_tree().reload_current_scene()
	elif _load >= 0:
		var st := _story()
		if st != null:
			st.call("load_game", _load)
	closed.emit(r)
	return r


func _ctx() -> Dictionary:
	var st := _story()
	var has := {}
	var bat := {}
	var p := get_tree().get_first_node_in_group("hs_player")
	var fl: Node = p.get_node_or_null("Eye/Flashlight") if p != null else null
	if fl != null:
		has["torch"] = true
		if float(fl.get("battery")) > 0.0 and fl.has_method("_change"):       # the flashlight's charge and its spare sets
			bat = {"charge": float(fl.get("charge")), "sets": int(fl.get("spares")), "change": Callable(fl, "_change")}
	var ctx := {"game": game_id(), "where": where(), "secs": played, "has": has, "battery": bat, "controls": controls()}
	if st != null and st.has_method("save_game"):
		ctx["save"] = func(n: int) -> bool: return bool(st.call("save_game", n))
		ctx["load"] = func(n: int) -> bool:
			_load = n
			return true
		ctx["can_load"] = func(n: int) -> bool: return bool(st.call("has_save", n))
	return ctx


## the controls the menu shows: the game's own keys, the HSHud's chips ("W A S D:walk", "E:use"...), then Esc; none
## given (an HSHud with no Keys): the starter player's
func controls() -> Array:
	var out: Array = []
	var h := _the_hud()
	var keys: Array = Array(h.get("keys")) if h != null and h.get("keys") != null else []
	if keys.is_empty():
		keys = ["W A S D:walk", "Shift:run", "E:use", "Tab:pocket", "F:flashlight", "Space:hold your breath"]
	for k in keys:
		var t := str(k)
		var i := t.find(":")
		if i <= 0:
			continue
		var what := t.substr(i + 1).strip_edges()
		out.append({"keys": t.substr(0, i).strip_edges().split(" ", false), "label": what.left(1).to_upper() + what.substr(1)})
	out.append({"keys": ["Esc"], "label": "This menu"})
	return out


## what the menu's saves are filed under (the game's name, as a file's)
func game_id() -> String:
	var t := title if title != "" else str(ProjectSettings.get_setting("application/config/name", "game"))
	var out := ""
	for ch in t.to_lower():
		out += ch if (ch >= "a" and ch <= "z") or (ch >= "0" and ch <= "9") else "_"
	return out if out.strip_edges() != "" else "game"


## what a save is called in the menu: the objective then, else the game's name
func where() -> String:
	var st := _story()
	var o := str(st.call("objective_now")) if st != null and st.has_method("objective_now") else ""
	return o if o != "" else (title if title != "" else str(ProjectSettings.get_setting("application/config/name", "")))


# a save made (the menu's, F5's, an autosave): the menu's slot says where and when
func _on_saved(slot: int) -> void:
	if slot == 0:
		MenuC.autosave(game_id(), where(), played)
		return
	var f := MenuC.saves_file(game_id())
	var sv = MenuC.read_json(f, {})
	var d: Dictionary = sv if sv is Dictionary else {}
	d[str(slot)] = {"where": where(), "secs": played, "at": Time.get_unix_time_from_system()}
	MenuC.write_json(f, d)


## the Story's save_game and load_game: the time played
func save_state() -> Dictionary:
	return {"played": played}


func load_state(d: Dictionary) -> void:
	played = float(d.get("played", played))
