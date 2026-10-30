## When something happens (docs/GODOT_DIRECTOR.md §4): an event's trigger, a to-do's tick, a choice's option: what
## the player does or what holds (the story's triggers, STORY_FORMAT §4). `target` is the id it's about, picked from
## the scene's ids of the right kind; only the fields the kind needs show in the Inspector. Left empty on an event
## inside a trigger, a room or a thing, it's that one (entering it, using it).
@tool
class_name HSWhen
extends Resource

const KINDS := ["enter", "leave", "use", "pickup", "read", "start", "flag", "look", "answered", "caught", "hidden",
	"after", "ticked", "all_ticked", "torch", "power", "locked", "dropped", "arrived", "custom"]
## the fields each kind shows, and the kind of id its target is
const FIELDS := {
	"enter": ["target"], "leave": ["target"], "use": ["target"], "pickup": ["target"], "read": ["target"],
	"start": [], "flag": ["target"], "look": ["target", "secs", "within"], "answered": ["target", "option"],
	"caught": ["target"], "hidden": ["target"], "after": ["target", "secs"], "ticked": ["target"], "all_ticked": [],
	"torch": ["state"], "power": ["state"], "locked": ["target"], "dropped": ["target", "within_area"],
	"arrived": ["target", "spot"], "custom": ["custom"],
}
const TARGET := {"enter": "area", "leave": "area", "use": "thing", "pickup": "item", "read": "note", "flag": "flag",
	"look": "thing", "answered": "ask", "caught": "actor", "hidden": "thing", "after": "event", "ticked": "todo",
	"locked": "door", "dropped": "thing", "arrived": "actor"}

@export_enum("enter", "leave", "use", "pickup", "read", "start", "flag", "look", "answered", "caught", "hidden", "after",
	"ticked", "all_ticked", "torch", "power", "locked", "dropped", "arrived", "custom") var kind: String = "enter":
	set(v):
		kind = v
		notify_property_list_changed()
		_label()
## what it's about: the area, thing, item, note, flag, question, character, to-do or event (by its id)
@export var target: String = "":
	set(v):
		target = v
		_label()
## look: how long the player must look at it; after: the seconds after that event
@export var secs: float = 1.0:
	set(v):
		secs = v
		_label()
## look: how near they must be (metres)
@export var within: float = 8.0
## answered: that answer only (its label or id; empty: any answer)
@export var option: String = ""
## torch, power: on or off
@export_enum("on", "off") var state: String = "on":
	set(v):
		state = v
		_label()
## dropped: put down inside this area (empty: anywhere)
@export var within_area: String = ""
## arrived: at this spot (empty: anywhere she was sent)
@export var spot: String = ""
## custom: a trigger as the story writes it ({"enter": "hall"}, {"all": [...]}...)
@export var custom: Dictionary = {}


static func make(k: String, t: String = "") -> HSWhen:
	var w := HSWhen.new()
	w.kind = k
	w.target = t
	return w


func _validate_property(p: Dictionary) -> void:
	var fields: Array = FIELDS.get(kind, [])
	var mine := ["target", "secs", "within", "option", "state", "within_area", "spot", "custom"]
	if not mine.has(p["name"]):
		return
	if not fields.has(p["name"]):
		p["usage"] = PROPERTY_USAGE_STORAGE
		return
	if p["name"] == "target" and TARGET.has(kind):
		HSDirector.hint(p, TARGET[kind])
	elif p["name"] == "within_area":
		HSDirector.hint(p, "area")
	elif p["name"] == "spot":
		HSDirector.hint(p, "spot")


func _label() -> void:
	resource_name = describe()
	emit_changed()


## the trigger as the story writes it; `fallback` the id of the trigger, room or thing the event sits in, `beats`
## an event id -> its beat id (after)
func to_story(fallback: String = "", beats: Dictionary = {}) -> Dictionary:
	var t := target if target != "" else fallback
	match kind:
		"start":
			return {"start": true}
		"enter":
			return {"enter": t}
		"leave":
			return {"exit": t}
		"use":
			return {"use": t}
		"pickup":
			return {"pickup": t}
		"read":
			return {"read": t}
		"flag":
			return {"flag": t}
		"look":
			return {"look": t, "secs": secs, "within": within}
		"answered":
			var w := {"answered": t}
			if option != "":
				w["option"] = HSDirector.snake(option)
			return w
		"caught":
			return {"caught": t if t != "" else true}
		"hidden":
			return {"hidden": t if t != "" else true}
		"after":
			return {"after": beats.get(t, t), "secs": secs}
		"ticked":
			return {"ticked": t}
		"all_ticked":
			return {"ticked": true}
		"torch":
			return {"torch": state}
		"power":
			return {"power": state}
		"locked":
			return {"locked": t}
		"dropped":
			var w2 := {"dropped": t}
			if within_area != "":
				w2["in"] = within_area
			return w2
		"arrived":
			var w3 := {"arrived": t}
			if spot != "":
				w3["at"] = spot
			return w3
		"custom":
			return custom.duplicate(true)
	return {"start": true}


## the trigger as words (the dock's sentences, the Inspector's label)
func describe(fallback: String = "") -> String:
	var t := target if target != "" else (fallback if fallback != "" else "?")
	match kind:
		"start":
			return "the task starts"
		"enter":
			return "the player enters %s" % t
		"leave":
			return "the player leaves %s" % t
		"use":
			return "the player uses %s" % t
		"pickup":
			return "the player picks up %s" % t
		"read":
			return "the player reads %s" % t
		"flag":
			return "%s is set" % t
		"look":
			return "the player looks at %s for %.1f s" % [t, secs]
		"answered":
			return "%s is answered%s" % [t, (" " + option) if option != "" else ""]
		"caught":
			return "the player is caught%s" % ((" by " + target) if target != "" else "")
		"hidden":
			return "the player hides%s" % ((" in " + target) if target != "" else "")
		"after":
			return "%.1f s after %s" % [secs, t]
		"ticked":
			return "%s is ticked" % t
		"all_ticked":
			return "every to-do is ticked"
		"torch":
			return "the flashlight goes %s" % state
		"power":
			return "the power goes %s" % state
		"locked":
			return "%s is locked" % t
		"dropped":
			return "%s is put down%s" % [t, (" in " + within_area) if within_area != "" else ""]
		"arrived":
			return "%s arrives%s" % [t, (" at " + spot) if spot != "" else ""]
		"custom":
			return "custom: %s" % JSON.stringify(custom)
	return kind


## the ids it names, by kind (the dock's flags and references)
func collect(add: Callable) -> void:
	if kind == "flag" and target != "":
		add.call("flag", target)
	if kind == "pickup" and target != "":
		add.call("item", target)
