@tool
## A character's whole part in the game, as markers (docs/MARKERS.md; the user's "NPC: Path" beside "NPC: Alex").
## Put one beside a character and point `character` at her: its children are her quests (HSNpcQuest), each quest's
## children her markers (HSNpcMarker) in the order she does them. The NPC Markers tab makes all of this by clicking
## in the 3D view; nothing here needs code.
##
## While the game runs it runs her markers (runner.gd): which quest, which marker, what it's waiting for. From a
## script, if you want one:
##     $"Alex markers".jump_to($"Alex markers/Night two/Walk")     # straight to a marker
##     $"Alex markers".marker_done.connect(func(m): ...)           # each marker as it finishes
## F7 in the game shows over every character what they're doing and waiting for.
class_name HSNpc
extends Node3D

signal marker_started(marker: Node)
signal marker_done(marker: Node)
signal quest_started(quest: Node)
signal quest_done(quest: Node)
signal talked(marker: Node, answer: int)      ## a conversation with her ended (the answer picked, -1 when it had none)
signal scared                                 ## a marker's jump scare: the starter's Fear node and night director listen (group hs_scare)

const COLORS := ["#4FC3F7", "#FFB74D", "#BA68C8", "#81C784", "#F06292", "#FFF176", "#4DB6AC", "#FF8A65", "#9FA8DA", "#E57373"]

static var debug := false                     ## F7: what every character is doing, over her head

@export var character: NodePath:              ## the character these markers move (the model's root node)
	set(v):
		character = v
		update_configuration_warnings()
@export var npc_name := ""                    ## her name (in conversations, in the tab); empty: the character node's
@export var color := Color("#4FC3F7")         ## her markers' colour in the 3D view
@export var starts_hidden := false            ## hidden and switched off until her first marker that needs her
@export_group("Body")
@export_range(0.0, 8.0, 0.05) var walk_speed := 0.0     ## metres a second; 0: as her own walk was made
@export_range(0.0, 12.0, 0.05) var run_speed := 0.0     ## 0: as her own run was made
@export_range(30.0, 720.0, 5.0) var turn_degrees := 320.0   ## how fast she turns, a second
@export_flags_3d_physics var floor_mask := 1  ## what she stands on (0: she keeps the path's own height)
@export var waits_for_player := true          ## you in her way: she waits a moment for you to move, then passes
@export var solid := false                    ## you can't walk through her (off: you can; nothing of hers can trap you)
@export var step_sounds := true               ## her steps heard (the starter's Sound node)
@export var catch_up := true                  ## a quest that starts while she isn't where it expects: she's put there when you can't see it
@export_group("Talk")
@export var talk_prompt := "Talk"             ## the prompt's word: "E   Talk to Alex"
@export_group("Shot")
@export_enum("the quest stops", "gone for good", "can't be killed") var when_shot_down := 0   ## what the weapons plugin's HSHitReact going down means
@export_range(0.5, 60.0, 0.5) var back_up_secs := 4.0   ## she can't be killed: how long she's down
@export_group("Scares")
@export var threat := false                   ## the player's fear rises near her (the group hs_threat)

var runner: HSNpcRunner
var _label: CanvasLayer
var _chip: PanelContainer
var _who: Label
var _what: Label


func _get_configuration_warnings() -> PackedStringArray:
	if character_node() == null:
		return PackedStringArray(["Pick the character these markers move (Character)."])
	return PackedStringArray()


func _ready() -> void:
	if Engine.is_editor_hint():
		set_physics_process(false)
		return
	add_to_group("hs_npc")
	add_to_group("hs_scare")
	start.call_deferred()


## her markers started (the game's start does this); again: from the top
func start() -> void:
	var her := character_node()
	if her == null:
		push_warning("HSNpc (%s): no character picked: nothing will happen" % name)
		return
	runner = HSNpcRunner.new()
	runner.begin(self, her, false)


func _physics_process(dt: float) -> void:
	if runner != null:
		runner.tick(dt)
	if debug or _label != null:
		_show_debug()


func _unhandled_key_input(event: InputEvent) -> void:
	if not Engine.is_editor_hint() and event is InputEventKey and event.pressed and not event.echo and (event as InputEventKey).physical_keycode == KEY_F7:
		debug = not debug


func _show_debug() -> void:
	if not debug:
		if _label != null:
			_label.queue_free()
			_label = null
		return
	var her := character_node()
	if her == null or runner == null:
		return
	if _label == null:                                         # (drawn in 2D over the picture: text in the 3D world smears under TAA as she moves)
		_label = CanvasLayer.new()
		_label.name = "_Debug"
		_label.layer = 6
		_chip = PanelContainer.new()
		_chip.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var sb := StyleBoxFlat.new()
		sb.bg_color = Color(0.04, 0.045, 0.06, 0.8)
		sb.set_corner_radius_all(6)
		sb.content_margin_left = 12
		sb.content_margin_right = 10
		sb.content_margin_top = 5
		sb.content_margin_bottom = 6
		sb.border_color = color
		sb.border_width_left = 4
		_chip.add_theme_stylebox_override("panel", sb)
		var col := VBoxContainer.new()
		col.add_theme_constant_override("separation", 0)
		col.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_chip.add_child(col)
		_who = Label.new()
		_who.add_theme_font_size_override("font_size", 15)
		_who.add_theme_color_override("font_color", color.lightened(0.35))
		col.add_child(_who)
		_what = Label.new()
		_what.add_theme_font_size_override("font_size", 15)
		_what.add_theme_color_override("font_color", Color(1, 1, 1, 0.94))
		col.add_child(_what)
		_label.add_child(_chip)
		add_child(_label)
	_who.text = display_name()
	_what.text = runner.status()
	var cam := get_viewport().get_camera_3d()
	var over := her.global_position + Vector3.UP * 2.0
	if cam == null or cam.is_position_behind(over):
		_chip.visible = false
		return
	_chip.visible = true
	_chip.reset_size()
	var at := cam.unproject_position(over)
	_chip.position = (at - Vector2(_chip.size.x * 0.5, _chip.size.y)).round()


## what F7 shows over her right now ("" when it's off)
func debug_text() -> String:
	return "%s\n%s" % [_who.text, _what.text] if _label != null and _who != null else ""


func character_node() -> Node3D:
	if character.is_empty() or not is_inside_tree():
		return null
	return get_node_or_null(character) as Node3D


func display_name() -> String:
	if npc_name.strip_edges() != "":
		return npc_name.strip_edges()
	var her := character_node()
	if her != null:
		return String(her.name)
	return String(name).trim_suffix(" markers").trim_suffix("Markers")


## her name as flags spell it: "shot:alex", "down:alex", "talked:alex"
func id() -> String:
	var s := HSNpcCond.slug(display_name())
	return s if s != "" else "npc"


## the Animator's record of her clips (nothing when she wasn't baked)
func record() -> Dictionary:
	return HSNpcBody.record_of(character_node())


## the player's E, from the box round her
func use(by: Node = null) -> void:
	if runner != null:
		runner.use(by)


## straight to a marker: it's the next thing she does (snap: put first as the markers before it leave her)
func jump_to(marker: HSNpcMarker, snap := false) -> void:
	if runner != null and marker != null:
		runner.jump_to(marker, snap)


func report() -> Dictionary:
	return runner.report() if runner != null else {}
