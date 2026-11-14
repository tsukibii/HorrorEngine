@tool
## The tester (docs/MARKERS.md §9): a marker, or a quest from a marker on, played in the 3D view without running the
## game. A copy of the character is made for it (`_Ghost`: no owner, so it's never saved; the real one is hidden
## meanwhile and nothing of it is touched), put in the state the markers before leave her in, and run by the game's
## own runner with `preview` on: every Starts when passed after a moment, nothing fired, no flag set, conversations
## and lines only noted (the notes are shown at the foot of the 3D view). Stopping, saving, playing the game or
## changing scene ends it and shows the real one again.
extends RefCounted

var plugin: EditorPlugin
var npc: HSNpc
var her: Node3D
var ghost: Node3D
var runner: HSNpcRunner
var notes: Array = []
var was_visible := true
var _done := 0.0
var _mode := ""


func playing() -> bool:
	return runner != null


## play `marker` alone ("one"), it and what follows ("from"), or its whole quest ("quest"); -> why not, or ""
func play(of_npc: HSNpc, marker: HSNpcMarker, mode: String) -> String:
	stop()
	if of_npc == null or not is_instance_valid(of_npc):
		return "Pick a character first."
	var character := of_npc.character_node()
	if character == null:
		return "She has no character yet: pick her model on the HSNpc."
	if marker == null or not is_instance_valid(marker):
		return "Pick a marker to try."
	if mode == "quest":
		var q := HSNpcFlow.quest_of(marker)
		var first := HSNpcFlow.items(q)
		if first.is_empty():
			return "That quest has no markers."
		marker = first[0]
	npc = of_npc
	her = character
	ghost = character.duplicate() as Node3D
	if ghost == null:
		return "Her model couldn't be copied."
	ghost.name = "_Ghost"
	character.get_parent().add_child(ghost)
	ghost.global_transform = character.global_transform
	ghost.visible = true
	was_visible = character.visible
	character.visible = false
	notes = []
	_done = 0.0
	_mode = mode
	runner = HSNpcRunner.new()
	runner.picks = plugin.picks
	runner.on_note = func(t: String) -> void:
		notes.append(t)
		plugin.update_overlays()
	runner.begin(npc, ghost, true)
	runner.jump_to(marker, true)
	if mode == "one":
		runner.stop_after = marker
	plugin.update_overlays()
	return ""


func tick(dt: float) -> void:
	if runner == null:
		return
	if not is_instance_valid(ghost) or not is_instance_valid(npc):
		stop()
		return
	runner.tick(minf(dt, 0.1))
	if runner.over:
		_done += dt
		if _done > 1.2:                                        # (a moment on its last pose, then the real one again)
			stop()


func stop() -> void:
	var had := runner != null
	runner = null
	if ghost != null and is_instance_valid(ghost):
		if ghost.get_parent() != null:
			ghost.get_parent().remove_child(ghost)
		ghost.queue_free()
	ghost = null
	if her != null and is_instance_valid(her):
		her.visible = was_visible
	her = null
	npc = null
	if had and plugin != null:
		plugin.update_overlays()
		if plugin.dock != null:
			plugin.dock.tested()


## what the tester is doing, in a line
func status() -> String:
	return runner.status() if runner != null else ""
