## A flickering light, a lamp's cone (a spot light) (HSFlicker, the desk's and Light Kit's curves; docs/GODOT_LOOK.md §0): `mode`
## fluorescent (a tube's stutters every `interval` seconds and its starter clicking on), dying (out more than on),
## candle, pulse (`rate` a second), custom (`letters` a to z, Quake's light styles, `rate` letters a second),
## wobble (a gentle sway); `amount` how much. Its Energy is the light at full. With `on_mains` it goes out with the
## game's power cut (the story's `power`) and comes back with it.
@tool
@icon("res://addons/horrorstudio_look/icons/flicker.svg")
class_name HSFlickerSpot
extends SpotLight3D

@export_enum("fluorescent", "dying", "candle", "pulse", "custom", "wobble") var mode: String = "fluorescent"
@export_range(0.0, 1.0) var amount: float = 1.0
@export_range(0.0, 60.0) var interval: float = 0.0   ## seconds between a tube's stutters (0: 6)
@export_range(0.0, 30.0) var rate: float = 0.0       ## pulses or letters a second (0: the mode's own)
@export var letters: String = ""                      ## custom: a (dark) to z (double), m full; empty: a tube's
@export var seed: int = 0                             ## 0: from the node's name
@export var preview_in_editor := true
@export var on_mains := true
var drive := HSFlickerDrive.new()


func _ready() -> void:
	if on_mains and not Engine.is_editor_hint():
		add_to_group("hs_mains")


func _process(dt: float) -> void:
	drive.setup(self, mode, amount, interval, rate, letters, seed)
	drive.tick(self, dt, preview_in_editor or not Engine.is_editor_hint())


func _notification(what: int) -> void:
	if what == NOTIFICATION_EDITOR_PRE_SAVE:
		drive.rest(self)                               # saved at full


## the power back: the starter clicks again
func power_on() -> void:
	drive.restart()
