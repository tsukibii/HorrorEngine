## The game's own words lying to you for a moment (DECISIONS 2026-11-12, after the seats: "things that make the player
## think, am I going crazy"). One node anywhere in the scene; it needs the Story. Now and then, while its `needs`
## hold (`sanity:shaken` to start with: only once you're slipping), one of these, and then everything is as it was:
##   task lies    a task on your to-do list reads something else for `secs` ("Find the master key" becomes one of
##                `lies`), then its own words again. You look, and it says what it always said
##   false lines  a line at the bottom of the screen that nothing said (one of `whispers`)
##   false pickup "Picked up: " and something you already carry
##   objective    the objective with its letters out of order for a moment
## How often: every `gap_min` to `gap_max` seconds, sooner as sanity falls (`sanity_sync`), never under a card, never
## once the story's over, never the same trick twice running. fire() does one now. It only ever changes what's
## written, for a moment: no task is ticked, nothing is given or taken.
extends Node

signal lied(kind: String, words: String)

@export var needs := "sanity:shaken"                ## the Story's words: only while they hold (empty: always)
@export var gap_min := 35.0
@export var gap_max := 80.0
@export var secs := 1.6                             ## how long a lie stays
@export_range(0.0, 1.0) var sanity_sync := 0.6     ## how much sooner as sanity falls (a Sanity node in the scene)
@export_group("Tricks")
@export var task_lies := true
@export var lies: PackedStringArray = ["Don't look behind you.", "You already did this.", "She is in the room.", "Stay where you are.", "It was never locked."]
@export var false_lines := true
@export var whispers: PackedStringArray = ["Did you leave that door open?", "Something moved.", "You've been here before.", "That wasn't there."]
@export var false_pickup := true
@export var objective_scramble := true

var count := 0                                      ## lies told so far
var last := ""                                      ## the last trick's kind
var telling := ""                                   ## the one on screen now ("": none)
var _wait := -1.0
var _left := 0.0
var _undo: Callable = Callable()


func _story() -> Node:
	return get_tree().get_first_node_in_group("hs_story")


func _gap() -> float:
	var g := randf_range(gap_min, maxf(gap_min, gap_max))
	var san := get_tree().get_first_node_in_group("hs_sanity")
	if san != null and san.has_method("pressure"):
		g /= maxf(1.0, float(san.pressure(sanity_sync)))
	return g


func _process(dt: float) -> void:
	if telling != "":
		_left -= dt
		if _left <= 0.0:
			_end()
		return
	var st := _story()
	if st == null or bool(st.get("over")) or (st.has_method("card_up") and st.card_up()):
		return
	if needs != "" and not (st.has_method("holds") and st.holds(needs)):
		_wait = -1.0                                # (its clock starts when its needs first hold)
		return
	if _wait < 0.0:
		_wait = _gap()
	_wait -= dt
	if _wait <= 0.0:
		_wait = _gap()
		tell()


## One lie now (which: "" any that can, or "task", "line", "pickup", "objective"). The kind told, "" when none could.
func tell(which := "") -> String:
	var st := _story()
	if st == null or telling != "":
		return ""
	var can: Array = []
	var open: Array = st.open_tasks() if st.has_method("open_tasks") else []
	if task_lies and not lies.is_empty() and not open.is_empty() and st.has_method("retext"):
		can.append("task")
	if false_lines and not whispers.is_empty():
		can.append("line")
	if false_pickup and st.get("items") is Dictionary and not (st.get("items") as Dictionary).is_empty():
		can.append("pickup")
	if objective_scramble and st.has_method("objective_now") and str(st.objective_now()).length() > 4:
		can.append("objective")
	if which != "":
		can = can.filter(func(k): return k == which)
	elif can.size() > 1:
		can.erase(last)                             # never the same twice running
	if can.is_empty():
		return ""
	var kind: String = can[randi() % can.size()]
	var words := ""
	match kind:
		"task":
			var id: String = open[randi() % open.size()]
			var was: String = st.task_text(id)
			words = lies[randi() % lies.size()]
			st.retext(id, words)
			_undo = func() -> void: st.retext(id, was)
		"line":
			words = whispers[randi() % whispers.size()]
			st.say(words)
			_undo = Callable()
		"pickup":
			var keys: Array = (st.get("items") as Dictionary).keys()
			var it: String = str(keys[randi() % keys.size()])
			var nm := str((st.get("names") as Dictionary).get(it, it.replace("_", " ")))
			words = "Picked up: %s" % nm
			st.say(words)
			_undo = Callable()
		"objective":
			var obj: String = st.objective_now()
			words = _scramble(obj)
			st.objective(words)
			_undo = func() -> void:
				if st.objective_now() == words:        # (the story may have moved on meanwhile)
					st.objective(obj)
	telling = kind
	last = kind
	_left = secs
	count += 1
	lied.emit(kind, words)
	return kind


# the same letters, a few of them changed places
func _scramble(text: String) -> String:
	var c := text.split("")
	var n := maxi(2, c.size() / 6)
	for i in n:
		var a := randi() % c.size()
		var b := clampi(a + (1 if randf() < 0.5 else -1), 0, c.size() - 1)
		if c[a] != " " and c[b] != " ":
			var t := c[a]
			c[a] = c[b]
			c[b] = t
	var out := "".join(c)
	return out if out != text else text.reverse()


func _end() -> void:
	if _undo.is_valid():
		_undo.call()
	_undo = Callable()
	telling = ""


func _exit_tree() -> void:
	if telling != "":
		_end()


## an area's, a cue's or a moment's target: one now
func fire(_a = null) -> void:
	tell()


func report() -> Dictionary:
	return {"count": count, "last": last, "telling": telling}
