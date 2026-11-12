## A hunt spot: somewhere a hunt (hunt.gd) can have its hunter do something (docs/HUNT_PLAN.md §3; the user's "hidden
## hunt event boxes around the map for certain animations to play out"). A Marker3D where she'll be (its +Z her
## front, as every character's), dropped anywhere in the level; put as many as you like. The hunt picks among
## the ones that are possible right now, by weight, never the same twice running, a few seconds apart. Kinds:
##   watch    she's standing there, far off, still. Set up only while the spot is out of your sight; looked at for
##            `stare` seconds she's gone in a lamp's blink
##   dart     she runs from here to `to` (a Marker3D: the other side of a doorway, the next room) across your view:
##            only while the crossing's middle is in view and where she starts isn't
##   peek     her at a corner; looked straight at, she draws back behind it (along the spot's -X) and is gone
##   wait     as watch, in the room you need (by the breaker), her back to you: `face_you` off
##   ambush   you walk into its box (an Area3D child): she's there, in your face, a sting. With `catches` in a hunt that
##            can catch, a real catch when you're within a metre
##   follow   she's down the way you came, nearer each time you look away (never touching in a haunting)
##   pass     cloaked (an HSCloak under her), she walks from here to `to`: the shimmer crossing the room
##   door     a door (door.gd) opens a little, or shuts: `door`, `door_open`
##   decoy    a sound here, where she isn't
##   custom   her `animation` here and a `target`'s fire(): anything of yours
## An Area3D child (or `box`) is where you must be for it; none: anywhere within `near_m` to `far_m` of it. Her move
## there is her moves.gd's (`move`: watch, run, peek, lunge, stalk...; empty: the kind's own), or an `animation` of hers
## by name.
extends Marker3D

const Sight := preload("res://starter/sight.gd")
const MOVE := {"watch": "watch", "wait": "idle", "peek": "peek", "dart": "run", "pass": "stalk", "ambush": "lunge",
	"follow": "watch", "custom": "idle"}

signal played                                             ## the hunt has started it

@export var hunt: Node                                    ## the hunt it's for (empty: any hunt)
@export_enum("watch", "dart", "peek", "wait", "ambush", "follow", "pass", "door", "decoy", "custom") var kind := "watch"
@export var to: Node3D                                    ## dart, pass: where she goes
@export var box: Area3D                                   ## where you must be (empty: its first Area3D child; none: anywhere)
@export var near_m := 4.0                                 ## your eye to the spot, at least
@export var far_m := 18.0                                 ## and at most
@export_range(1, 9) var stage_min := 1                    ## the hunt's stages it belongs to
@export_range(1, 9) var stage_max := 9
@export var needs := ""                                   ## the Story's words
@export var once := false
@export var cooldown := 40.0                              ## seconds before it can come again
@export var weight := 1.0                                 ## how often against the others
@export_group("What she does")
@export var move := ""                                    ## her move here (moves.gd); empty: the kind's own
@export var animation := ""                               ## or an animation of hers by name (on an AnimationPlayer under her)
@export var sound := ""                                   ## off the shelf, played here
@export var sound_db := 0.0
@export var hold := 12.0                                  ## seconds she's there at most, never seen
@export var stare := 0.8                                  ## seconds looked at before she's gone
@export var speed := 6.0                                  ## dart: metres a second
@export_range(0.0, 1.0) var scare := 0.3                  ## how much the Fear node jumps (0: not a scare)
@export var face_you := true                              ## turned to face you (off: as the marker points)
@export var door: Node                                    ## door: the door.gd door
@export var door_open := true                             ## opened (off: shut)
@export var target: Node                                  ## its fire() as it plays
@export var blink_lamp: Light3D                           ## the lamp that blinks out as she goes
@export var catches := false                              ## ambush: a real catch within a metre (a hunt that can catch)
@export var head_m := 1.5

var plays := 0
var last := -10000.0                                      ## when it last played (the hunt's clock)
var _here := true


func _ready() -> void:
	add_to_group("hs_hunt_spot")
	if box == null:
		for c in get_children():
			if c is Area3D:
				box = c
				break
	if box != null:
		_here = false
		box.body_entered.connect(func(b: Node) -> void:
			if b.is_in_group("hs_player"):
				_here = true)
		box.body_exited.connect(func(b: Node) -> void:
			if b.is_in_group("hs_player"):
				_here = false)


## you're where it needs you (its box; none: anywhere)
func here() -> bool:
	return _here


func her_move() -> String:
	return move if move != "" else str(MOVE.get(kind, ""))


## Whether a hunt could play it now: its stage, its needs, its rest, where you are and what you can see.
func ready_for(h: Node, pl: Node3D, cam: Camera3D, now: float) -> bool:
	if hunt != null and hunt != h:
		return false
	var stage := int(h.get("stage"))
	if stage < stage_min or stage > stage_max:
		return false
	if (once and plays > 0) or now - last < cooldown:
		return false
	if needs != "":
		var st := get_tree().get_first_node_in_group("hs_story")
		if st == null or not st.has_method("holds") or not st.holds(needs):
			return false
	if not _here:
		return false
	var d := cam.global_position.distance_to(global_position + Vector3.UP * head_m * 0.6)
	var skip := [pl]
	match kind:
		"watch", "wait", "peek", "custom":
			return d >= near_m and d <= far_m and not Sight.figure_seen(cam, global_position, head_m, skip, 8.0)
		"dart":
			if to == null or d < near_m or d > far_m:
				return false
			var mid := (global_position + to.global_position) * 0.5 + Vector3.UP * head_m * 0.7
			return Sight.off_deg(cam, mid) <= 38.0 and Sight.seen(cam, mid, skip) \
				and not Sight.figure_seen(cam, global_position, head_m, skip)
		"pass":
			return to != null and d >= near_m and d <= far_m and h.has_method("can_cloak") and h.can_cloak()
		"ambush":
			return box != null
		"follow":
			return h.has_method("trail_point") and h.trail_point(float(h.get("follow_m"))) != Vector3.INF
		"door":
			if door == null or not ("open" in door) or bool(door.get("open")) == door_open:
				return false
			if door_open and door.has_method("lock") and str(door.lock()) != "":
				return false
			return door is Node3D and pl.global_position.distance_to((door as Node3D).global_position) >= 2.5
		"decoy":
			return d >= near_m and d <= far_m and not Sight.in_frame(cam, global_position + Vector3.UP)
	return false
