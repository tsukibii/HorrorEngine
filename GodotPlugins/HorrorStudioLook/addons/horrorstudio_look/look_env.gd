## The look in the editor (docs/GODOT_LOOK.md): a WorldEnvironment that wears an HSLook preset while you edit, so a
## level scene opened in Godot shows the realism look (the haze, the glow, AgX, SSR...) in the editor's viewport. Drop
## one into any scene (Add Child Node: HSLookEnvironment, or the Look node the plugin registers), pick its `preset`.
## In a running game it steps aside (frees itself): the game's own environment (game.gd, from story.json's
## `game.look`) is the one that counts, and Godot allows one WorldEnvironment per scene tree. `editor_only` false
## keeps it in the game too, for a project of your own that has no other environment.
@tool
class_name HSLookEnvironment
extends WorldEnvironment

@export_enum("balanced", "realism", "plain") var preset: String = "balanced":
	set(v):
		preset = v
		_wear()
@export var editor_only := true


func _ready() -> void:
	if not Engine.is_editor_hint() and editor_only:
		queue_free()
		return
	_wear()


func _wear() -> void:
	if environment == null:
		environment = Environment.new()
		environment.background_mode = Environment.BG_COLOR
		environment.background_color = Color(0.02, 0.02, 0.03)
		environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
		environment.ambient_light_color = Color(0.45, 0.5, 0.65)
		environment.ambient_light_energy = 0.25
	# the editor's own viewport is left alone (its anti-aliasing is the editor's); in a game of your own, the viewport too
	HSLook.apply(null if Engine.is_editor_hint() else get_viewport(), environment, preset)
