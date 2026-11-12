@icon("res://addons/horrorstudio_weapons/icons/shot_with.svg")
class_name HSShotWith
extends Node
## Shot with what? (DECISIONS 2026-11-12, last: "some question or drag and drop thing that we can do quests to have
## npcs be hit by the easter egg love shells or water shells (a way to check if someone did it), e.g. an npc gets shot
## with love, then it ticks that flag as true".) Put one under a character (beside her HSHitReact or HSShootable) or
## under anything with a collider: when a shot of the kind it names lands on what it's under, it sets a fact in the
## Story (`fact`), ticks a task (`tick`), says a line, fires a `target`, turns her look. The fact is the way to ask
## afterwards: a door's, an area's, a cue's, a quest marker's or a look's `needs`, or `Story.is_set("<fact>")`.
##     Her / Loved (HSShotWith)   shell = heart, fact = "her_loved", tick = "love", her_look = "smitten"
## Ready-made: `quest/loved.tscn` (love hearts) and `quest/soaked.tscn` (water), to drag under someone and name.
##
## It listens to every gun itself (the group hs_weapon's `fired`), so it knows a shot's kind whether the shell hurts or
## not, and needs neither an HSHitReact nor an HSShootable (a character with no collider of her own needs her
## HSHitReact: its hitboxes are what the pellets land on). A shot is one pull of the trigger, however many pellets.
## Nothing's counted while what it's under is hidden.

signal counted(info: Dictionary)                  ## a shot that counts: {kind, touch, pellets, part, parts, point, dir, damage, blast, count, who}
signal happened(info: Dictionary)                 ## `times` of them: what it does is done

const SHELLS := ["heart", "water", "buckshot", "explosive", "harmless", "harmful", "any"]
const PARTS := ["anywhere", "head", "torso", "arm", "leg"]

@export_enum("heart", "water", "buckshot", "explosive", "harmless", "harmful", "any") var shell: String = "heart"   ## the kind of shell that counts (an HSShellType's id): love hearts, water, buckshot, explosive; harmless: any kind whose damage is 0; harmful: any that hurts; any
@export var shell_id := ""                        ## a kind of your own, by its id (in place of Shell)
@export_enum("anywhere", "head", "torso", "arm", "leg") var part: String = "anywhere"   ## where on her it has to land (an HSHitReact's hitboxes; without one, anywhere)
@export_range(1, 64) var pellets := 1             ## pellets of one shot on her for it to count
@export_range(1, 99) var times := 1               ## shots that count until it happens
@export var needs := ""                           ## the Story's words (task:<id> done, on:<id>, item:<name>, a fact, ! for not, commas for all): counted only while they hold
@export var once := true                          ## it happens once (off: again every `times` shots)
@export var who: Node                             ## the one shot (none: what this is under)
@export_group("Then")
@export var fact := ""                            ## a fact set in the Story (Story.is_set, anyone's `needs`): "freddy_loved"
@export var tick := ""                            ## a task ticked off the to-do list
@export var say := ""                             ## a line (the Story's say)
@export var objective := ""                       ## a new objective
@export var add_tasks: PackedStringArray = []     ## tasks added, each "id: what it says"
@export var target: Node                          ## its fire(): a scare_area, a cue, an event area, a look switch
@export var her_look := ""                        ## her look (an HSLookSwitch under her: its set_look), "smitten"
@export var look_secs := 0.0                      ## ...for this long, then her default again (0: it stays)

var count := 0                                    ## shots counted so far (toward `times`)
var done := false                                 ## it has happened
var last: Dictionary = {}                         ## the last shot counted
var _guns: Array = []
var _t := 0.0


func _ready() -> void:
	add_to_group("hs_shot_with")
	add_to_group("hs_shootable")                  # (an explosive shell's blast reaches what it's under: HSImpacts)
	_listen()


func _process(dt: float) -> void:
	_t += dt
	if _t > 0.5:                                  # (a gun picked up later: listened to once it's there)
		_t = 0.0
		_listen()


func _listen() -> void:
	for w in get_tree().get_nodes_in_group("hs_weapon"):
		if not _guns.has(w) and w.has_signal("fired"):
			w.fired.connect(_on_fired)
			_guns.append(w)


## the one whose being shot it counts: `who`, else what it's under (under an HSHitReact or an HSShootable by mistake:
## what that is under)
func host() -> Node:
	if who != null and is_instance_valid(who):
		return who
	var p := get_parent()
	if p != null and (p is HSHitReact or p is HSShootable):
		p = p.get_parent()
	return p


## the kind it counts, in a word
func wants() -> String:
	return shell_id.strip_edges() if shell_id.strip_edges() != "" else shell


## whether a kind (its id, its damage) is one it counts
func counts(kind: String, damage: float) -> bool:
	var w := wants()
	match w:
		"any":
			return true
		"harmless":
			return damage <= 0.0
		"harmful":
			return damage > 0.0
	return kind == w


func _story() -> Node:
	return get_tree().get_first_node_in_group("hs_story")


func _react() -> Node:
	var h := host()
	if h == null:
		return null
	for c in h.get_children():
		if c is HSHitReact:
			return c
	return null


# where on her a hit landed: its hitbox's word, else her HSHitReact's guess, else nothing
func _part_of(h: Dictionary, hr: Node) -> String:
	var c = h.get("collider")
	if c is Node and (c as Node).has_meta("hs_part"):
		return str((c as Node).get_meta("hs_part"))
	if hr != null and hr.has_method("_where") and not bool(h.get("blast", false)):
		return str((hr.call("_where", h) as Dictionary).get("part", ""))
	return ""


func _on_fired(shot_hits: Array) -> void:
	if done and once:
		return
	var her := host()
	if her == null or shot_hits.is_empty():
		return
	if her is Node3D and not (her as Node3D).is_visible_in_tree():
		return                                       # (not there to be shot)
	var mine := shot_hits.filter(func(h) -> bool:
		var c = h.get("collider")
		return c is Node and is_instance_valid(c) and (c == her or her.is_ancestor_of(c)))
	if mine.is_empty():
		return
	# the shot's kind: its pellets say (a blast's reach doesn't: it's the shell's that burst)
	var kind := ""
	var touch := ""
	var dmg := 0.0
	for h in shot_hits:
		if h.has("kind"):
			kind = str(h["kind"])
			touch = str(h.get("touch", ""))
			dmg = float(h.get("damage", 1.0))
			break
	var blast := mine.any(func(h) -> bool: return bool(h.get("blast", false)))
	if kind == "" and blast:
		dmg = 1.0
	if not counts(kind, dmg):
		return
	var hr := _react()
	var parts := {}
	var on := 0
	for h in mine:
		var p := _part_of(h, hr)
		if p != "":
			parts[p] = true
		if part == "anywhere" or p == part:
			on += 1
	if on < pellets:
		return
	var st := _story()
	if needs != "" and (st == null or not st.has_method("holds") or not st.holds(needs)):
		return
	count += 1
	var first: Dictionary = mine[0]
	last = {"kind": kind, "touch": touch, "pellets": on, "part": _part_of(first, hr), "parts": parts.keys(),
		"point": first.get("point", Vector3.ZERO), "dir": first.get("dir", Vector3.FORWARD), "damage": dmg, "blast": blast,
		"count": count, "who": her}
	counted.emit(last)
	if count >= times:
		_happen()


## What it does, done now (a script's: as if she'd been shot enough).
func fire(_a = null, _b = null) -> void:
	if done and once:
		return
	if last.is_empty():
		last = {"kind": wants(), "touch": "", "pellets": 0, "part": "", "parts": [], "point": Vector3.ZERO, "dir": Vector3.FORWARD,
			"damage": 0.0, "blast": false, "count": count, "who": host()}
	_happen()


func _happen() -> void:
	done = true
	if not once:
		count = 0
	var st := _story()
	if st != null:
		if fact != "" and st.has_method("flag"):
			st.flag(fact)
		if tick != "" and st.has_method("tick"):
			st.tick(tick)
		if objective != "" and st.has_method("objective"):
			st.objective(objective)
		if st.has_method("add_line"):
			for line in add_tasks:
				st.add_line(line)
		if say != "" and st.has_method("say"):
			st.say(say)
	if her_look != "":
		var sw := _switch()
		if sw != null:
			sw.set_look(her_look)
			if look_secs > 0.0 and sw.has_method("default"):
				var tm := get_tree().create_timer(look_secs)
				tm.timeout.connect(_look_back.bind(sw, her_look))
	if target != null and is_instance_valid(target) and target.has_method("fire"):
		target.fire()
	happened.emit(last)


# her look switch: the one shot herself, or a node under her that has set_look (the look plugin's HSLookSwitch)
func _switch() -> Node:
	var h := host()
	if h == null:
		return null
	if h.has_method("set_look"):
		return h
	for c in h.find_children("*", "", true, false):
		if c.has_method("set_look"):
			return c
	return null


func _look_back(sw: Node, was: String) -> void:
	if not is_instance_valid(sw):
		return
	if sw.has_method("current") and str(sw.current()) != was:
		return                                       # (something else has turned her since: left as she is)
	sw.default()


## Not happened, nothing counted: to be done again.
func reset() -> void:
	done = false
	count = 0
	last = {}


## Whether `who` (a node with an HSShotWith under it) has been shot the way one of them asks: a script's question.
static func was(node: Node) -> bool:
	if node == null:
		return false
	for c in node.find_children("*", "", true, false):
		if c is HSShotWith and (c as HSShotWith).done:
			return true
	return false
