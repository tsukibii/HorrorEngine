@tool
## A marker: one thing a character does, placed in the scene (docs/MARKERS.md §3, §4). A child of one of her quests
## (HSNpcQuest), of a way of a Choice (HSNpcWay) or of a Repeat marker; markers run in the order they're in.
##
## It is three things: *Starts when* (nothing: at once, when the marker before is done) → what she does (its `kind`)
## → *then* (flags, a task, a line, a sound, things fired). And on any marker: her face, her look, whether you can
## talk to her there.
##
## Where it is matters for the kinds with a place: `appear` (she's put there), `walk` (where she walks TO, through its
## HSNpcBend children; she starts from wherever she is), `sit` (the seat's front edge, at the height she sits at),
## `sleep` (the bed's edge), `grab` (where her hand goes), `scare` (where she appears). Its +Z (the blue arrow) is the
## way she faces there.
## The other kinds happen where she is.
##
## The Inspector shows only the fields its kind uses; the NPC Markers tab is the easy way to fill them in.
class_name HSNpcMarker
extends Node3D

const KINDS := ["appear", "walk", "wait", "sit", "sleep", "grab", "animation", "event", "disappear", "choice", "repeat", "attack", "scare"]
const TITLES := {"appear": "Start here", "walk": "Walk", "wait": "Wait", "sit": "Sit", "sleep": "Sleep", "grab": "Grab", "animation": "Animation",
	"event": "Event", "disappear": "Disappear", "choice": "Choice", "repeat": "Repeat", "attack": "Attack", "scare": "Jump scare"}
const PLACED := ["appear", "walk", "sit", "sleep", "grab", "scare"]        # kinds whose pin is a place
const STAYS := ["wait", "sit", "sleep", "animation"]                       # kinds she stays in
const BODY := ["appear", "walk", "wait", "sit", "sleep", "grab", "animation", "attack", "scare"]   # kinds that need her body (a hidden character comes back for them)
const ACTIONS := {"reach": "Reach for it", "pick_up": "Pick it up", "put_down": "Put it down", "open": "Open a door", "eat": "Eat it", "drink": "Drink from it"}
const PACES := {"walk": "Walk", "run": "Run", "sneak": "Sneak", "crawl": "Crawl", "creep": "Creep", "scuttle": "Scuttle"}   # (the last four: animations v3, docs/ANIMATOR_V3.md)

# which kinds use a field (a field not listed here is every kind's)
const USED_BY := {
	"pace": ["walk"], "pace_scale": ["walk"], "take_secs": ["walk"], "smooth": ["walk"], "follow_floor": ["walk"], "face_arrow": ["walk"],
	"to_player": ["walk"], "stop_short": ["walk"],
	"stay": STAYS, "stay_secs": STAYS, "face_player": ["wait", "scare"],
	"action": ["grab"], "target": ["grab"], "door_opens": ["grab"], "left_hand": ["grab", "attack"], "keep_in_hand": ["grab"],
	"attack": ["attack"], "attack_at": ["attack"], "attack_times": ["attack"],
	"scare_kind": ["scare"], "scare_stays": ["scare"],
	"head": BODY + ["event"], "head_range": BODY + ["event"], "head_at": BODY + ["event"],
	"head_right": ["sleep"],
	"clip": ["wait", "animation"], "clip_file": ["animation"], "loop": ["animation"], "times": ["animation"],
	"anim_speed": ["wait", "sit", "sleep", "grab", "animation", "attack"], "blend": BODY,
	"how": ["appear", "disappear", "scare"],
	"repeat_times": ["repeat"], "repeat_until": ["repeat"],
	"face": BODY + ["event"], "face_amount": BODY + ["event"], "face_rules": BODY + ["event"],
	"look": BODY + ["event"], "look_skin": BODY + ["event"], "look_eyes": BODY + ["event"], "look_eye_color": BODY + ["event"], "look_secs": BODY + ["event"],
	"talk": BODY + ["event"], "talk_prompt": BODY + ["event"], "turn_to_player": BODY + ["event"], "talks": BODY + ["event"],
	"say": BODY + ["event", "disappear"], "say_secs": BODY + ["event", "disappear"], "sound": BODY + ["event", "disappear"],
	"set_flags": BODY + ["event", "disappear"], "tick": BODY + ["event", "disappear"], "add_tasks": BODY + ["event", "disappear"],
	"fire": BODY + ["event", "disappear"], "scare": ["event"], "let_go": ["event"],
}

@export_enum("appear", "walk", "wait", "sit", "sleep", "grab", "animation", "event", "disappear", "choice", "repeat", "attack", "scare") var kind := "walk":
	set(v):
		kind = v
		notify_property_list_changed()
		update_configuration_warnings()
@export var note := ""                                   ## what it's for, shown on its pin ("grabbing the book from the shelf")
@export var start_when := ""                             ## the condition's words (cond.gd); empty: at once, when the marker before is done

@export_group("Walk")
@export_enum("walk", "run", "sneak", "crawl", "creep", "scuttle") var pace := "walk"   ## her own walk or run; or low: a careful sneak, a crawl on hands and knees, a creature's creep, a scuttle on hands and feet (she stays low after)
@export_range(0.2, 4.0, 0.05) var pace_scale := 1.0      ## times that speed (0.5: a slow walk; her feet keep step)
@export_range(0.0, 120.0, 0.1) var take_secs := 0.0      ## over 0: she gets there in this many seconds, whatever the distance
@export var smooth := true                               ## one smooth curve through her bends (off: straight from bend to bend)
@export var follow_floor := true                         ## her height from the floor under the path (stairs, slopes); off: the path's own height
@export var face_arrow := true                           ## there, she turns to the arrow (off: she stays facing the way she came)
@export var to_player := false                           ## she comes to you instead of to the pin
@export_range(0.3, 5.0, 0.05) var stop_short := 0.8      ## and stops this far from you

@export_group("Stay")
@export_enum("next", "secs", "talked") var stay := "next"   ## how long: until the next marker can start, for some seconds, until you talk to her
@export_range(0.0, 600.0, 0.1) var stay_secs := 3.0
@export var face_player := false                         ## she keeps turning to face you while she waits

@export_group("Grab")
@export_enum("reach", "pick_up", "put_down", "open", "eat", "drink") var action := "reach"
@export var target: NodePath                             ## the thing she picks up, eats or drinks from (none: what she holds), or the door she opens (its use() or fire() is called)
@export_enum("push", "pull", "slide") var door_opens := "push"
@export var left_hand := false
@export var keep_in_hand := true                         ## picked up, it stays in her hand (off: it's put away, hidden)

@export_group("Attack")
@export_enum("punch", "swing") var attack := "punch"     ## a punch, or a swing of what she holds (her fist when she holds nothing)
@export var attack_at: NodePath                          ## who: empty, you
@export_range(1, 20) var attack_times := 1               ## how many blows

@export_group("Jump scare")
@export_enum("lunge", "loom", "snap", "claw") var scare_kind := "lunge"   ## thrown at you; risen over you; her head snapping up; clawed up from all fours
@export var scare_stays := false                         ## she stays after (off: she's gone when it's been shown)

@export_group("Head")
@export_enum("keep", "follow", "free") var head := "keep"   ## from here on: her head follows you ("follow"), is her animation's again ("free"), or as it was ("keep")
@export_range(0.0, 360.0, 1.0, "degrees") var head_range := 160.0   ## the whole arc she follows in, half to each side of straight ahead
@export var head_at: NodePath                            ## who she looks at: empty, you

@export_group("Sleep")
@export var head_right := false                          ## her head goes to her right as she sits on the edge (off: to her left)

@export_group("Animation")
@export var clip := ""                                   ## one of her own animations by name (Wait: the loop she waits in; empty: her idle)
@export_file("*.npz", "*.res", "*.tres", "*.anim") var clip_file := ""   ## or a file: a Kimodo .npz in res://animations/, a Godot animation
@export var loop := false                                ## it loops (and she stays in it: see Stay)
@export_range(1, 99) var times := 1                      ## not looping: played this many times
@export_range(0.1, 4.0, 0.05) var anim_speed := 1.0      ## how fast the clip plays
@export_range(0.0, 2.0, 0.05) var blend := 0.25          ## seconds eased into it from what she was doing

@export_group("Appear and disappear")
@export_enum("now", "unseen", "fade") var how := "now"   ## at once, only when you're not looking, or fading (the look plugin's phasing)

@export_group("Repeat")
@export_range(0, 999) var repeat_times := 0              ## how many times (0: until its flags are so, or the quest moves on)
@export var repeat_until := ""                           ## the condition's words: looked at before each pass

@export_group("Face and look")
@export var face := ""                                   ## an expression she wears from here on: "smile", "sad"... ("": as she was; "neutral": none)
@export_range(0.0, 1.5, 0.05) var face_amount := 1.0
@export var face_rules: PackedStringArray = []           ## by flags, while she's here: "gave_gift => smile", "=> sad" (the first that's so)
@export var look := ""                                   ## a look of her HSLookSwitch by name ("default": her own; "": as she was)
@export var look_skin := ""                              ## or a skin: chrome, ember, cloak... ("default": her own)
@export var look_eyes := ""                              ## and eyes: glow, black, void...
@export var look_eye_color := Color(0, 0, 0, 0)
@export_range(0.0, 5.0, 0.05) var look_secs := 0.6       ## how long the look takes to turn

@export_group("Talk")
@export var talk := false                                ## you can talk to her here (E)
@export var talk_prompt := ""                            ## the prompt's word ("": her HSNpc's)
@export var turn_to_player := true                       ## she turns to you when you do
@export var talks: Array[Dictionary] = []                ## her conversations here, the first whose `when` is so: {when, lines, answers: [{text, sets, face, reply}], sets, again}

@export_group("Then")
@export var say := ""                                    ## a line as it starts
@export_range(0.5, 20.0, 0.1) var say_secs := 3.0
@export var sound := ""                                  ## a sound as it starts: one of the sound shelf's by name, or a file
@export var fire: Array[NodePath] = []                   ## nodes fired as it starts (their fire(), or start()): a scare area, a cue, a look switch...
@export var scare := false                               ## it's a jump scare: the Fear node and the night's director hear it
@export var let_go := false                              ## from here another script moves her (a chase, a hunt) until her next marker
@export var set_flags := ""                              ## flags switched when it's done: "+met_alex, -door_locked"
@export var tick := ""                                   ## a task ticked when it's done
@export var add_tasks: PackedStringArray = []            ## tasks put on the list when it's done: "id: what to do"


func _validate_property(property: Dictionary) -> void:
	var nm := String(property["name"])
	if USED_BY.has(nm) and not (kind in (USED_BY[nm] as Array)):
		property["usage"] = PROPERTY_USAGE_NO_EDITOR | PROPERTY_USAGE_STORAGE


func _get_configuration_warnings() -> PackedStringArray:
	var out := PackedStringArray()
	var p := get_parent()
	var ok := p is HSNpcQuest or p is HSNpcWay or (p is HSNpcMarker and (p as HSNpcMarker).kind == "repeat")
	if not ok:
		out.append("A marker belongs under a quest (HSNpcQuest), a way of a Choice, or a Repeat marker.")
	if kind == "choice" and ways().is_empty():
		out.append("A Choice needs ways: add one for each thing that can happen.")
	return out


func title() -> String:
	if kind == "walk" and pace != "walk":
		return PACES.get(pace, "Walk")
	if kind == "attack":
		return "Punch" if attack == "punch" else "Swing"
	if kind == "wait" and talk and stay == "talked":
		return "Talk"
	if kind == "grab":
		return {"reach": "Grab", "pick_up": "Pick up", "put_down": "Put down", "open": "Open door", "eat": "Eat", "drink": "Drink"}.get(action, "Grab")
	return TITLES.get(kind, kind)


func is_placed() -> bool:
	return kind in PLACED and not (kind == "walk" and to_player)


func stays() -> bool:
	return kind in STAYS and (kind != "animation" or loop)


func needs_body() -> bool:
	return kind in BODY


## the way she faces here: the marker's +Z laid flat
func front() -> Vector3:
	var f := global_basis.z if is_inside_tree() else basis.z
	f.y = 0.0
	return f.normalized() if f.length() > 0.001 else Vector3(0, 0, 1)


func yaw() -> float:
	var f := front()
	return atan2(f.x, f.z)


func place() -> Vector3:
	return global_position if is_inside_tree() else position


func bends() -> Array:
	var out := []
	for c in get_children():
		if c is HSNpcBend:
			out.append(c)
	return out


func ways() -> Array:
	var out := []
	for c in get_children():
		if c is HSNpcWay:
			out.append(c)
	return out


## the markers inside a Repeat
func inner() -> Array:
	var out := []
	for c in get_children():
		if c is HSNpcMarker:
			out.append(c)
	return out


## her conversations here made whole: every one a dictionary with all its keys
func conversations() -> Array:
	var out := []
	for t in talks:
		if not (t is Dictionary):
			continue
		var lines: Array = []
		for l in t.get("lines", []):
			if str(l).strip_edges() != "":
				lines.append(str(l))
		var answers: Array = []
		for a in t.get("answers", []):
			if a is Dictionary and str(a.get("text", "")).strip_edges() != "":
				answers.append({"text": str(a.get("text", "")), "sets": str(a.get("sets", "")), "face": str(a.get("face", "")), "reply": str(a.get("reply", ""))})
		out.append({"when": str(t.get("when", "")), "lines": lines, "answers": answers, "sets": str(t.get("sets", "")), "again": str(t.get("again", ""))})
	return out


## a face rule read: "gave_gift => smile" -> {when, face}
static func rule(text: String) -> Dictionary:
	var at := text.find("=>")
	if at < 0:
		return {"when": "", "face": text.strip_edges()}
	return {"when": text.substr(0, at).strip_edges(), "face": text.substr(at + 2).strip_edges()}
