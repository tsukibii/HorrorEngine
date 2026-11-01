## A way a character walks (docs/GODOT_DIRECTOR.md §3): draw it with Godot's own path tools (select it, Add Point,
## click on the floor) or give it HSSpot children (dragged where you want them, a wait each). A character set to
## walk it (HSActor's behaviour `path`, or an event's) goes point to point at her speed: round and round (`loop`),
## there and back (`pingpong`) or once.
@tool
@icon("res://addons/horrorstudio_director/icons/path.svg")
class_name HSPath
extends Path3D

@export var id: String = ""
@export_enum("loop", "pingpong", "once") var mode: String = "loop"
## the seconds she waits at each of the curve's points, in order (HSSpot children carry their own)
@export var waits: PackedFloat32Array = PackedFloat32Array()


func _enter_tree() -> void:
	HSDirector.auto_id(self)
	if curve == null:
		curve = Curve3D.new()


func spots() -> Array:
	var out: Array = []
	for c in get_children():
		if c is HSSpot:
			out.append(c)
	return out


## the points in the world, in order, and each one's wait
func points() -> Array:
	var out: Array = []
	var sp := spots()
	if sp.size():
		for s in sp:
			out.append({"pos": s.global_position, "wait": s.wait, "id": HSDirector.id_of(s), "pose": s.pose, "check": s.check})
		return out
	if curve == null:
		return out
	for i in curve.point_count:
		out.append({"pos": global_transform * curve.get_point_position(i), "wait": waits[i] if i < waits.size() else 0.0, "id": "%s__%d" % [HSDirector.id_of(self), i]})
	return out


## the route as the story's level keeps it: its points' spot ids, waits and mode
func as_story() -> Dictionary:
	var pts: Array = []
	for p in points():
		var q := {"at": p["id"]}
		if float(p["wait"]) > 0.0:
			q["wait"] = float(p["wait"])
		for k in ["pose", "check"]:
			if str(p.get(k, "")) != "":
				q[k] = str(p[k])
		pts.append(q)
	return {"points": pts, "mode": mode}


func _ready() -> void:
	if Engine.is_editor_hint() or HSDirector.holding:
		return
	if spots().size():
		return
	var pts := points()                                   # the curve's points as spots of their own, facing the way on
	for i in pts.size():
		var m := Marker3D.new()
		m.name = "_p%d" % i
		add_child(m)
		m.global_position = pts[i]["pos"]
		var nx: Vector3 = pts[(i + 1) % pts.size()]["pos"] if pts.size() > 1 else pts[i]["pos"] + Vector3(0, 0, 1)
		var d: Vector3 = nx - pts[i]["pos"]
		var yaw := rad_to_deg(atan2(-d.z, d.x)) if Vector2(d.x, d.z).length() > 1e-4 else 0.0
		HSDirector.stamp(m, {"id": pts[i]["id"], "kind": "spot", "shape": "box", "size": [0.3, 0.3, 0.0], "room": "", "yaw": yaw,
			"pos": HSDirector.story_pos(pts[i]["pos"]), "tags": ["use:spot"], "d": {}})
