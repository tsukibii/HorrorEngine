## One thing an event does (docs/GODOT_DIRECTOR.md §4): a line, a flag, a door, a light, a jumpscare, a sound, a
## wait... the story's actions (STORY_FORMAT §4) with plain fields. Pick the `verb`; only the fields it needs show in
## the Inspector, the ids picked from the scene's. Its label is the sentence it reads as, so an event's list of
## actions reads as a script in the Inspector and the dock.
@tool
class_name HSAction
extends Resource

## each verb's fields, in the Inspector's order
const VERBS := {
	"say": ["text", "actor", "hold"], "think": ["text", "hold"], "objective": ["text"],
	"set_flag": ["flag"], "clear_flag": ["flag"], "give_item": ["item"], "take_item": ["item"],
	"show": ["thing"], "hide": ["thing"], "door": ["door", "door_set"], "light": ["light", "room", "light_set"],
	"power": ["on_off"], "flashlight": ["torch_set"], "sound": ["sound", "thing"], "wait": ["secs"],
	"fade": ["fade_to", "secs"], "look_at": ["thing", "secs"],
	"jumpscare": ["thing", "secs"], "glimpse": ["thing", "secs"], "knock": ["thing", "count"],
	"lights_die": ["room", "secs"], "slam_door": ["door"], "whisper": ["text"], "swap": ["thing", "other"],
	"ask": ["ask_id", "text", "actor", "answers", "answer_flags"], "dialogue": ["dialogue"],
	"move": ["thing", "spot"], "behave": ["actor", "behave_as", "spot", "path", "sees"], "motion": ["actor", "motion", "hold"],
	"todo": ["todo_id", "text"], "tick": ["todo_id"], "fail": ["todo_id"], "finish_task": [],
	"chapter_card": ["text", "subtitle", "time_of_day"], "checkpoint": [], "karma": ["amount"],
	"counter": ["counter", "amount", "set_counter"], "state": ["thing", "life_state"], "music": ["music"],
	"car_passes": ["room"], "custom": ["custom"],
}
const HINTS := {"actor": "actor", "flag": "flag", "item": "item", "thing": "thing", "door": "door", "light": "light",
	"room": "room", "sound": "sound", "dialogue": "dialogue", "spot": "spot", "path": "path", "motion": "motion",
	"todo_id": "todo", "counter": "counter", "other": "thing"}

@export_enum("say", "think", "objective", "set_flag", "clear_flag", "give_item", "take_item", "show", "hide", "door",
	"light", "power", "flashlight", "sound", "wait", "fade", "look_at", "jumpscare", "glimpse", "knock", "lights_die",
	"slam_door", "whisper", "swap", "ask", "dialogue", "move", "behave", "motion", "todo", "tick", "fail", "finish_task",
	"chapter_card", "checkpoint", "karma", "counter", "state", "music", "car_passes", "custom") var verb: String = "say":
	set(v):
		verb = v
		notify_property_list_changed()
		_label()
## a line, a thought, an objective, a question, a chapter's title, a to-do's words
@export_multiline var text: String = "":
	set(v):
		text = v
		_label()
## who says it (a character's id; empty: the player)
@export var actor: String = "":
	set(v):
		actor = v
		_label()
## say, think: wait until the line's been read before the next action (lines one after another)
@export var hold: bool = true
@export var flag: String = "":
	set(v):
		flag = v
		_label()
@export var item: String = "":
	set(v):
		item = v
		_label()
## a thing, a door, a character, or `player` (move)
@export var thing: String = "":
	set(v):
		thing = v
		_label()
@export var other: String = ""
@export var door: String = "":
	set(v):
		door = v
		_label()
@export_enum("open", "close", "lock", "unlock", "slam") var door_set: String = "open":
	set(v):
		door_set = v
		_label()
## a light's id (its node's name) or empty for every light in `room`
@export var light: String = "":
	set(v):
		light = v
		_label()
@export var room: String = "":
	set(v):
		room = v
		_label()
@export_enum("on", "off", "flicker", "dim") var light_set: String = "off":
	set(v):
		light_set = v
		_label()
@export_enum("off", "on") var on_off: String = "off":
	set(v):
		on_off = v
		_label()
@export_enum("on", "off", "flicker", "dead", "works") var torch_set: String = "flicker":
	set(v):
		torch_set = v
		_label()
## a sound off the shelf (its name), or a sound file of the project's (res://...)
@export var sound: String = "":
	set(v):
		sound = v
		_label()
@export var secs: float = 1.0:
	set(v):
		secs = v
		_label()
@export_enum("out", "in") var fade_to: String = "out"
@export var count: int = 3
## ask: the question's id (its answers are heard as "answered <id>")
@export var ask_id: String = ""
## ask: the two answers (labels); answer_flags: the flag each one sets (optional, in the same order)
@export var answers: PackedStringArray = PackedStringArray(["Yes", "No"])
@export var answer_flags: PackedStringArray = PackedStringArray()
@export var dialogue: String = "":
	set(v):
		dialogue = v
		_label()
@export var spot: String = "":
	set(v):
		spot = v
		_label()
@export_enum("idle", "sit", "path", "patrol", "go", "off") var behave_as: String = "idle":
	set(v):
		behave_as = v
		_label()
@export var path: String = ""
@export var sees: bool = false
@export var motion: String = "":
	set(v):
		motion = v
		_label()
@export var todo_id: String = "":
	set(v):
		todo_id = v
		_label()
@export var subtitle: String = ""
@export_enum("keep", "day", "dusk", "night") var time_of_day: String = "keep"
@export var amount: float = 1.0:
	set(v):
		amount = v
		_label()
@export var counter: String = ""
@export var set_counter: bool = false
@export var life_state: String = ""
@export_enum("silence", "calm", "uneasy", "dread", "chase") var music: String = "dread"
## custom: an action as the story writes it ({"trick": "loop_hall", ...})
@export var custom: Dictionary = {}


static func make(v: String, fields: Dictionary = {}) -> HSAction:
	var a := HSAction.new()
	a.verb = v
	for k in fields:
		a.set(k, fields[k])
	a._label()
	return a


func _validate_property(p: Dictionary) -> void:
	var nm: String = p["name"]
	if nm == "verb" or not (nm in _mine()):
		return
	if not (VERBS.get(verb, []) as Array).has(nm):
		p["usage"] = PROPERTY_USAGE_STORAGE
		return
	if HINTS.has(nm):
		HSDirector.hint(p, HINTS[nm])
	if nm == "thing" and verb == "move":
		p["hint"] = PROPERTY_HINT_ENUM_SUGGESTION
		p["hint_string"] = ",".join(PackedStringArray(["player"]) + HSDirector.ids("thing"))


var _names: Array = []


func _mine() -> Array:
	if _names.is_empty():
		for v in VERBS.values():
			for f in v:
				if not _names.has(f):
					_names.append(f)
	return _names


func _label() -> void:
	resource_name = describe()
	emit_changed()


static func line_secs(t: String) -> float:
	return min(6.0, 1.2 + t.length() / 14.0)


## the action as the story's actions (one, or a line and its wait)
func to_story() -> Array:
	match verb:
		"say":
			var a := {"say": text}
			if actor != "":
				a["who"] = actor
			return [a, {"wait": line_secs(text)}] if hold else [a]
		"think":
			return [{"think": text}, {"wait": line_secs(text)}] if hold else [{"think": text}]
		"objective":
			return [{"objective": text}]
		"set_flag":
			return [{"flag": flag}]
		"clear_flag":
			return [{"unflag": flag}]
		"give_item":
			return [{"give": item}]
		"take_item":
			return [{"take": item}]
		"show":
			return [{"show": thing}]
		"hide":
			return [{"hide": thing}]
		"door":
			return [{"door": door, "set": door_set}]
		"light":
			if light != "":
				return [{"light": light, "set": light_set}]
			return [{"light": null, "room": room, "set": light_set}]
		"power":
			return [{"power": on_off}]
		"flashlight":
			return [{"torch": torch_set}]
		"sound":
			var s := {"sound": sound}
			if thing != "":
				s["at"] = thing
			return [s]
		"wait":
			return [{"wait": secs}]
		"fade":
			return [{"fade": fade_to, "secs": secs}]
		"look_at":
			return [{"lookat": thing, "secs": secs}]
		"jumpscare":
			return [{"trick": "jumpscare", "figure": thing, "secs": secs}]
		"glimpse":
			return [{"trick": "glimpse", "figure": thing, "secs": secs}]
		"knock":
			return [{"trick": "knock", "at": thing, "count": count}]
		"lights_die":
			return [{"trick": "lights_die", "room": room, "secs": secs}]
		"slam_door":
			return [{"trick": "slam_behind", "door": door}]
		"whisper":
			return [{"trick": "whisper", "line": text}]
		"swap":
			return [{"trick": "swap", "hide": thing, "show": other}]
		"ask":
			var opts: Array = []
			for i in answers.size():
				var o := {"id": HSDirector.snake(answers[i]), "label": answers[i]}
				if i < answer_flags.size() and answer_flags[i] != "":
					o["do"] = [{"flag": answer_flags[i]}]
				opts.append(o)
			var q := {"ask": ask_id if ask_id != "" else "q_" + HSDirector.snake(text).left(24), "text": text, "options": opts}
			if actor != "":
				q["who"] = actor
			return [q]
		"dialogue":
			return [{"scene": dialogue}]
		"move":
			return [{"move": thing, "to": spot}]
		"behave":
			var b := {"behave": actor, "as": behave_as}
			if behave_as in ["idle", "sit"] and spot != "":
				b["at"] = spot
			if behave_as == "go":
				b["to"] = spot
			if behave_as == "path":
				b["route"] = path
			if behave_as == "patrol":
				b["routes"] = [path]
			if sees:
				b["sees"] = true
			return [b]
		"motion":
			return [{"anim": actor, "clip": motion, "wait": hold}]
		"todo":
			return [{"todo": todo_id if todo_id != "" else HSDirector.snake(text), "text": text}]
		"tick":
			return [{"tick": todo_id}]
		"fail":
			return [{"fail": todo_id}]
		"finish_task":
			return [{"done": true}]
		"chapter_card":
			var c := {"chapter": text}
			if subtitle != "":
				c["sub"] = subtitle
			if time_of_day != "" and time_of_day != "keep":
				c["time"] = time_of_day
			return [c]
		"checkpoint":
			return [{"checkpoint": true}]
		"karma":
			return [{"karma": amount}]
		"counter":
			return [{"count": counter, "set": amount}] if set_counter else [{"count": counter, "add": amount}]
		"state":
			return [{"state": thing, "to": life_state}]
		"music":
			return [{"music": music}]
		"car_passes":
			return [{"sweep": room}]
		"custom":
			return [custom.duplicate(true)]
	return []


func _q(s: String) -> String:
	return s if s != "" else "?"


## the action as words
func describe() -> String:
	match verb:
		"say":
			return "%s: \"%s\"" % [actor if actor != "" else "You", text.left(48)]
		"think":
			return "think: \"%s\"" % text.left(48)
		"objective":
			return "objective: %s" % text.left(48)
		"set_flag":
			return "set %s" % _q(flag)
		"clear_flag":
			return "clear %s" % _q(flag)
		"give_item":
			return "give %s" % _q(item)
		"take_item":
			return "take %s away" % _q(item)
		"show":
			return "show %s" % _q(thing)
		"hide":
			return "hide %s" % _q(thing)
		"door":
			return "%s %s" % [door_set, _q(door)]
		"light":
			return "light %s %s" % [light if light != "" else ("in " + _q(room)), light_set]
		"power":
			return "the power %s" % on_off
		"flashlight":
			return "flashlight: %s" % torch_set
		"sound":
			return "play %s%s" % [_q(sound), (" at " + thing) if thing != "" else ""]
		"wait":
			return "wait %.1f s" % secs
		"fade":
			return "fade %s over %.1f s" % [fade_to, secs]
		"look_at":
			return "turn the player's eye to %s" % _q(thing)
		"jumpscare":
			return "JUMPSCARE: %s for %.1f s" % [_q(thing), secs]
		"glimpse":
			return "glimpse of %s" % _q(thing)
		"knock":
			return "%d knocks at %s" % [count, _q(thing)]
		"lights_die":
			return "the lights die in %s" % _q(room)
		"slam_door":
			return "slam %s behind the player" % _q(door)
		"whisper":
			return "whisper: \"%s\"" % text.left(40)
		"swap":
			return "swap %s for %s when unseen" % [_q(thing), _q(other)]
		"ask":
			return "ask \"%s\" (%s)" % [text.left(32), " / ".join(answers)]
		"dialogue":
			return "play the dialogue %s" % _q(dialogue)
		"move":
			return "move %s to %s" % [_q(thing), _q(spot)]
		"behave":
			return "%s: %s%s" % [_q(actor), behave_as, (" " + (spot if spot != "" else path)) if (spot != "" or path != "") else ""]
		"motion":
			return "%s plays %s" % [_q(actor), _q(motion)]
		"todo":
			return "to-do: %s" % text.left(40)
		"tick":
			return "tick %s" % _q(todo_id)
		"fail":
			return "fail %s" % _q(todo_id)
		"finish_task":
			return "finish the task"
		"chapter_card":
			return "chapter card: %s" % text.left(40)
		"checkpoint":
			return "checkpoint"
		"karma":
			return "karma %+.0f" % amount
		"counter":
			return "%s %s %s" % [_q(counter), "=" if set_counter else "+", str(amount)]
		"state":
			return "%s to %s" % [_q(thing), _q(life_state)]
		"music":
			return "music: %s" % music
		"car_passes":
			return "a car passes %s" % _q(room)
		"custom":
			return "custom: %s" % JSON.stringify(custom).left(40)
	return verb


## the ids it names, by kind (the dock's flags and references)
func collect(add: Callable) -> void:
	if verb in ["set_flag", "clear_flag"] and flag != "":
		add.call("flag", flag)
	if verb in ["give_item", "take_item"] and item != "":
		add.call("item", item)
	if verb == "ask":
		for f in answer_flags:
			add.call("flag", f)
		add.call("ask", ask_id if ask_id != "" else "q_" + HSDirector.snake(text).left(24))
	if verb == "todo":
		add.call("todo", todo_id if todo_id != "" else HSDirector.snake(text))
