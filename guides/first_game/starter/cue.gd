## A cue (the user, 2026-11-08: "a mechanic for jump scares with variables... can also use this mechanism for non
## jumpscares too"): something that happens the moment everything you've set is so. Put it on a Node3D anywhere, set
## what must be so and what then happens; a field left as it is doesn't count.
##
## **What must be so** (all of it, looked at every frame):
## - **where you look**: the event's `spot` (empty: the head of what appears, else this node) in a region of your view.
##   The frame is cut in thirds each way: the middle third is the middle; the outer thirds are the left, the right, the
##   top and the bottom (either side: left or right); a corner is where a side meets the top or the bottom; the edge is
##   the outer sixth all round. `tolerance` widens every region toward the others (a fraction of the frame's half: 0.1
##   a tenth further in), so it needn't be exact, and near a line the spot counts on both sides of it. Or in view
##   anywhere, or out of view (behind you, off the frame, or with something in the way when `line_of_sight` is on);
## - **what the story says**: `needs`, the Story's words (on:x while task x is on your list and not done yet: you're on
##   that quest; task:x once it's done; item:x carried; a fact; ! for not; several apart by commas);
## - **what you're doing**: `doing` standing, walking, running, still, moving, sitting, lying (in bed), hiding, or
##   seated (any of the three: seat.gd puts you there); `flashlight` on or off;
## - **how near**: `near_m` to `far_m` from your eye to the spot;
## - **for how long**: `after_secs` all of it so first; then `chance`, rolled once a second while it stays so.
## Never under a note's card, nor after the ending.
##
## **What happens** (once, or again after `cooldown`): someone or something `appear`s (hidden till then: a jump scare),
## turned to face you (`face_you`), its `animation` played (an AnimationPlayer anywhere under it), for `appear_for`
## seconds, or less if `until_looked_at` and you turn to look straight at it; then it's gone (`vanish`: at once, in a
## blink of `blink_lamp` and your flashlight, or when it's out of your view); a `sound` off the shelf at it (or at
## `sound_at`), a `hush` of the music and the room's tone before (its last half second silent: the sting lands in it); a
## scare (`scare`) makes you jump (the Fear node) and the night's director hears it. And the story's side, a jump scare
## or not: a line (`say`), an `objective`, tasks added (`add_tasks`) or ticked (`tick`), a `fact`, the `music`'s mood,
## `target`'s fire() (a scare area, an event area, another cue); `fired` and `ended` to wire anything else to. `fire()`
## from any signal makes it happen whatever's so; `arm()` turns it on when `armed` is off.
extends Node3D

const Lights := preload("res://starter/lights.gd")
const THIRD := 1.0 / 3.0

signal fired                                      ## it's happening
signal scared                                     ## it's happening and it's a scare (the Fear node and the night's director hear this)
signal ended                                      ## over: what appeared is gone

@export_group("Where you look")
@export var spot: Node3D                          ## where it is (empty: the head of what appears, else this node)
@export_enum("anywhere", "in view", "middle", "left", "right", "either side", "top", "bottom", "top left", "top right",
	"bottom left", "bottom right", "any corner", "edge", "out of view") var look := "anywhere"
@export_range(0.0, 0.33, 0.01) var tolerance := 0.1   ## every region this much wider (of the frame's half)
@export var line_of_sight := true                 ## seen only with nothing in the way (else it's out of view)
@export_group("What must be so")
@export var needs := ""                           ## on:x (task x on your list, not done), task:x (done), item:x, a fact; ! for not
@export_enum("any", "standing", "walking", "running", "still", "moving", "sitting", "lying", "seated", "hiding") var doing := "any"
@export_enum("any", "on", "off") var flashlight := "any"
@export var near_m := 0.0                         ## from your eye to the spot
@export var far_m := 100.0
@export var after_secs := 0.0                     ## all of it so this long first
@export_range(0.0, 1.0, 0.01) var chance := 1.0   ## then rolled once a second while it stays so
@export var armed := true                         ## off: nothing until arm() (from a signal), or fire()
@export var once := true
@export var cooldown := 30.0                      ## seconds before it can come again (once off)
@export_group("What happens")
@export var appear: Node3D                        ## someone (or something) there: hidden until then
@export var appear_for := 1.0                     ## seconds it's there
@export var face_you := true                      ## turned about the vertical to face you (its front, +Z); not if it lies or hangs
@export var animation := ""                       ## played on an AnimationPlayer under what appears
@export var until_looked_at := false              ## gone sooner, the moment you turn to look straight at it (the spot into the middle)
@export_enum("at once", "in a blink", "when unseen") var vanish := "in a blink"
@export var blink_lamp: Light3D                   ## the lamp that blinks out as it goes (with your flashlight)
@export var sound := ""                           ## off the shelf (sting_big, knock_three...) or a path
@export var sound_db := 0.0
@export var sound_at: Node3D                      ## where it sounds (empty: at what appears, else the spot)
@export var hush := 0.0                           ## seconds of quiet first (0: none)
@export var scare := true                         ## a scare: you jump and the night's director hears it (off for a cue that isn't one)
@export var say := ""
@export var objective := ""
@export var add_tasks: PackedStringArray = []     ## each "id: what it says"
@export var tick := ""
@export var fact := ""
@export_enum("keep", "silence", "calm", "uneasy", "dread", "chase") var music := "keep"
@export var target: Node                          ## its fire() too
@export var head_m := 1.5                         ## the head of what appears, over its feet (m): where the cue's spot is taken when no Spot is set, and where its sound comes from; a child's about 1.2, an imp's 0.8, an ogre's 2.3

var count := 0                                    ## times it's happened (a check's)
var held := 0.0                                   ## seconds all of it has been so (a check's)
var running := false                              ## happening now
var shown_for := 0.0                              ## seconds what appeared was there, the last time (a check's)
var heard: Node = null                            ## the player its sound played on, the last time (a check's)
var animated := ""                                ## the animation it played, the last time (a check's)
var _clock := 0.0
var _last := -1e9
var _roll_at := 0.0


func _ready() -> void:
	if scare:
		add_to_group("hs_scare")                  # the Fear node and the director hook every scare's `scared`
	if appear != null:
		appear.visible = false


## on (from a signal: whatever it sends is ignored)
func arm(_a = null, _b = null) -> void:
	armed = true


func _process(dt: float) -> void:
	_clock += dt
	if not armed or running or (once and count > 0) or _clock - _last < cooldown or not all_so():
		held = 0.0
		return
	held += dt
	if held < after_secs or _clock < _roll_at:
		return
	_roll_at = _clock + 1.0
	if randf() <= chance:
		fire()


## everything set is so just now
func all_so() -> bool:
	var st := get_tree().get_first_node_in_group("hs_story")
	if st != null and (bool(st.get("over")) or (st.has_method("card_up") and st.card_up())):
		return false
	if needs != "" and (st == null or not st.holds(needs)):
		return false
	var pl := get_tree().get_first_node_in_group("hs_player")
	if doing != "any" and not doing_now(pl):
		return false
	if flashlight != "any":
		var t: Node = pl.get_node_or_null("Eye/Flashlight") if pl != null else null
		if (t is Light3D and (t as Light3D).visible) != (flashlight == "on"):
			return false
	var cam := get_viewport().get_camera_3d()
	if cam == null:
		return false
	var d := cam.global_position.distance_to(where())
	if d < near_m or d > far_m:
		return false
	return look == "anywhere" or regions(cam).has(look)


## the player's doing() matches `doing`
func doing_now(pl: Node) -> bool:
	if pl == null or not pl.has_method("doing"):
		return false
	var now: String = pl.doing()
	match doing:
		"still": return now == "standing" or now == "sitting" or now == "lying"
		"moving": return now == "walking" or now == "running"
		"seated": return now == "sitting" or now == "lying" or now == "hiding"
	return now == doing


## where it is: the spot, else the head of what appears (however it's placed: standing, hanging, lying), else here
func where() -> Vector3:
	if spot != null:
		return spot.global_position
	if appear != null:
		return appear.global_transform * Vector3(0, head_m, 0)
	return global_position


## where the spot is in your view: (u, v), u from -1 at the frame's left edge to 1 at its right, v from -1 at the bottom
## to 1 at the top (beyond them it's off the frame); null when it's behind you
func frame_at(cam: Camera3D) -> Variant:
	var p := where()
	if cam.is_position_behind(p):
		return null
	var size := cam.get_viewport().get_visible_rect().size
	var s := cam.unproject_position(p)
	return Vector2(s.x / maxf(size.x, 1.0) * 2.0 - 1.0, 1.0 - s.y / maxf(size.y, 1.0) * 2.0)


## every region of your view the spot is in now (the tolerance widening each), or ["out of view"]
func regions(cam: Camera3D) -> Array:
	var f = frame_at(cam)
	if f == null or absf(f.x) > 1.0 or absf(f.y) > 1.0 or (line_of_sight and not _clear(cam)):
		return ["out of view"]
	var u: float = f.x
	var v: float = f.y
	var t := tolerance
	var out := ["in view"]
	if absf(u) <= THIRD + t and absf(v) <= THIRD + t:
		out.append("middle")
	var l := u <= -THIRD + t
	var r := u >= THIRD - t
	var tp := v >= THIRD - t
	var b := v <= -THIRD + t
	if l: out.append("left")
	if r: out.append("right")
	if l or r: out.append("either side")
	if tp: out.append("top")
	if b: out.append("bottom")
	if l and tp: out.append("top left")
	if r and tp: out.append("top right")
	if l and b: out.append("bottom left")
	if r and b: out.append("bottom right")
	if (l or r) and (tp or b): out.append("any corner")
	if maxf(absf(u), absf(v)) >= 2.0 * THIRD - t: out.append("edge")
	return out


## it happens now (from anything's signal too: what must be so isn't asked)
func fire(_a = null, _b = null) -> void:
	if running:
		return
	running = true
	count += 1
	_last = _clock
	var snd := get_tree().get_first_node_in_group("hs_sound")
	if hush > 0.0 and snd != null and snd.has_method("hush"):
		await get_tree().create_timer(snd.hush(hush)).timeout
	if appear != null:
		if face_you:
			_face(appear)
		appear.visible = true
		if animation != "":
			_animate(true)
	heard = null
	if sound != "" and snd != null and snd.has_method("play"):
		var at: Vector3 = sound_at.global_position if sound_at != null else (appear.global_transform * Vector3(0, head_m, 0) if appear != null else where())
		heard = snd.play(sound, at, sound_db, "event" if scare else "sfx")
	var st := get_tree().get_first_node_in_group("hs_story")
	if st != null:
		if objective != "":
			st.objective(objective)
		for tl in add_tasks:
			st.add_line(tl)
		if tick != "":
			st.tick(tick)
		if say != "":
			st.say(say)
		if fact != "":
			st.flag(fact)
	if music != "keep" and snd != null and snd.has_method("music"):
		snd.music(music)
	if target != null and target != self and target.has_method("fire"):
		target.fire()
	fired.emit()
	if scare:
		scared.emit()
	if appear != null:
		await _shown()
	running = false
	ended.emit()


# there for appear_for seconds (or until you turn to look straight at it: into the middle, not already there), then
# gone as `vanish` says
func _shown() -> void:
	var t := 0.0
	var cam0 := get_viewport().get_camera_3d()
	var was_mid := cam0 != null and regions(cam0).has("middle")
	while t < appear_for:
		await get_tree().process_frame
		t += get_process_delta_time()
		if until_looked_at:
			var cam := get_viewport().get_camera_3d()
			var mid := cam != null and regions(cam).has("middle")
			if mid and not was_mid:
				break
			was_mid = mid
	if vanish == "when unseen":
		var waited := 0.0
		while waited < 6.0:
			var cam := get_viewport().get_camera_3d()
			if cam == null or regions(cam) == ["out of view"]:
				break
			await get_tree().process_frame
			waited += get_process_delta_time()
		t += waited
	elif vanish == "in a blink":
		Lights.blink(get_tree(), blink_lamp, randf_range(0.1, 0.2))
	shown_for = t
	appear.visible = false
	_animate(false)


# the animation on the first AnimationPlayer under what appears that has it (or stopped)
func _animate(on: bool) -> void:
	for n in appear.find_children("*", "AnimationPlayer", true, false):
		var ap := n as AnimationPlayer
		if not ap.has_animation(animation):
			continue
		if on:
			ap.stop()
			ap.play(animation)
			animated = animation
		else:
			ap.stop()
		return


# turned about the vertical to face your eye, however it's tilted (nothing when its front points up or down)
func _face(n: Node3D) -> void:
	var cam := get_viewport().get_camera_3d()
	if cam == null:
		return
	var f := n.global_basis.z * Vector3(1, 0, 1)
	var d := (cam.global_position - n.global_position) * Vector3(1, 0, 1)
	if f.length() < 0.2 or d.length() < 0.01:
		return
	n.global_basis = Basis(Vector3.UP, f.normalized().signed_angle_to(d.normalized(), Vector3.UP)) * n.global_basis


func _clear(cam: Camera3D) -> bool:
	var p := where()
	var q := PhysicsRayQueryParameters3D.create(cam.global_position, p, 1)          # the world (not layer 2's seats)
	q.hit_back_faces = false
	var pl := get_tree().get_first_node_in_group("hs_player")
	if pl is CollisionObject3D:
		q.exclude = [(pl as CollisionObject3D).get_rid()]
	var hit := get_world_3d().direct_space_state.intersect_ray(q)
	if hit.is_empty() or (hit["position"] as Vector3).distance_to(p) < 0.3:
		return true
	return appear != null and hit["collider"] is Node and appear.is_ancestor_of(hit["collider"])
