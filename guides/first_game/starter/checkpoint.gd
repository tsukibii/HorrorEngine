## A checkpoint: walk into it and the Story keeps where you are and what you've done (its tasks, facts, pocket and
## cash, the doors you've opened). If you die (a lethal hunt: hunt.gd) you're put back here as you were. An Area3D with
## a CollisionShape3D; `needs` in the Story's words; once, or every time you come through. A lethal hunt keeps one by
## itself when it starts, so this is for the ones you want nearer the danger.
extends Area3D

signal kept

@export var needs := ""
@export var once := true
@export var say := ""                                 ## a line as it's kept (most games: none)

var count := 0


func _ready() -> void:
	body_entered.connect(_on_body)


func _on_body(b: Node) -> void:
	if b.is_in_group("hs_player"):
		keep()


## keep it now (from a signal too)
func keep(_a = null, _b = null) -> void:
	if once and count > 0:
		return
	var st := get_tree().get_first_node_in_group("hs_story")
	if st == null or not st.has_method("checkpoint"):
		return
	if needs != "" and not st.holds(needs):
		return
	count += 1
	st.checkpoint()
	if say != "":
		st.say(say)
	kept.emit()
