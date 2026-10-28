## Behaviours: what a cast member does during play (docs/GAMEPLAY_PLAN.md §2; the desk's behaviours.js, ported), set by
## the `behave` action. Not AI: each is a small routine with settings. `start(npc, rt, s)` sets it up, `update(npc, rt,
## dt, s)` moves it on; both write the npc's state, which the runtime draws: level, pos (feet, Godot), yaw (story
## degrees), pose, walking.
extends RefCounted

const TURN := 240.0
const ARRIVE := 0.05
const SETTINGS := {
	"idle": {"at": null, "pose": "idle", "face": null, "motion": null},
	"sit": {"at": null, "pose": "sit", "motion": null},
	"path": {"route": null, "mode": null, "speed": 1.1, "pose": "idle", "from": "nearest", "motion": null},
	"patrol": {"routes": [], "pick": "order", "speed": 1.1, "pose": "idle", "motion": null},
	"go": {"to": null, "via": [], "then": "idle", "speed": 1.1, "pose": "idle", "sit": "sit", "face": null, "motion": null},
}


static func has(name: String) -> bool:
	return SETTINGS.has(name)


static func settings_of(name: String, spec: Dictionary) -> Dictionary:
	var s: Dictionary = SETTINGS.get(name, {}).duplicate()
	for k in spec:
		s[k] = spec[k]
	return s


static func turn_to(npc: Dictionary, yaw: float, dt: float) -> bool:
	var d := fposmod(yaw - float(npc["yaw"]) + 180.0, 360.0) - 180.0
	var step := TURN * dt
	npc["yaw"] = float(npc["yaw"]) + (d if abs(d) <= step else sign(d) * step)
	return abs(d) <= step


static func at(npc: Dictionary, rt, s: Dictionary) -> bool:
	var t = rt.things.get(s.get("at"))
	if t == null:
		rt.hud.log("behave: no spot %s" % s.get("at"))
		return false
	npc["level"] = rt.level
	npc["pos"] = rt.spot_pos(t)
	npc["yaw"] = float(t["piece"].get("yaw", 0))
	npc["walking"] = false
	return true


static func face_thing(npc: Dictionary, rt, s: Dictionary, dt: float) -> void:
	var f = s.get("face")
	if f == null or npc.get("pos") == null:
		return
	var p = null
	if rt.by_id.has(f):
		p = rt.by_id[f]["node"].global_position
	elif rt.npcs.has(f) and rt.npcs[f].get("pos") != null:
		p = rt.npcs[f]["pos"]
	elif f == "player":
		p = rt.player.pos
	if p != null:
		var np: Vector3 = npc["pos"]
		turn_to(npc, rad_to_deg(atan2(-(p.z - np.z), p.x - np.x)), dt)


static func start(name: String, npc: Dictionary, rt, s: Dictionary) -> void:
	var st: Dictionary = npc["st"]
	match name:
		"idle", "sit":
			if at(npc, rt, s):
				npc["pose"] = s["pose"]
		"path":
			var r = rt.route(s.get("route"))
			st["r"] = r
			if r == null:
				return
			st["dir"] = 1
			st["wait"] = 0.0
			if npc.get("pos") == null:
				npc["pos"] = r["points"][0]["pos"]
				npc["yaw"] = r["points"][0]["yaw"]
				npc["level"] = r["level"]
			var best := 0
			if s.get("from") != "first":
				for i in r["points"].size():
					if (r["points"][i]["pos"] as Vector3).distance_to(npc["pos"]) < (r["points"][best]["pos"] as Vector3).distance_to(npc["pos"]):
						best = i
			st["i"] = best
		"patrol":
			st["k"] = -1
			next_route(npc, rt, s)
		"go":
			var pts: Array = []
			for v in s.get("via", []):
				pts.append(v)
			pts.append(s.get("to"))
			var r = rt.route(pts)
			st["r"] = r
			if r == null:
				return
			st["i"] = 0
			st["dir"] = 1
			st["wait"] = 0.0
			if npc.get("pos") == null:
				npc["pos"] = r["points"][0]["pos"]
				npc["yaw"] = r["points"][0]["yaw"]
				npc["level"] = r["level"]


static func update(name: String, npc: Dictionary, rt, dt: float, s: Dictionary) -> void:
	var st: Dictionary = npc["st"]
	match name:
		"idle":
			face_thing(npc, rt, s, dt)
		"path":
			if st.get("r") != null:
				walk_route(npc, rt, dt, s, st["r"], Callable())
		"patrol":
			if st.get("r") != null:
				var s2 := s.duplicate()
				s2["mode"] = "once"
				walk_route(npc, rt, dt, s2, st["r"], func(): next_route(npc, rt, s))
		"go":
			if st.get("arrived") != null:
				if s.get("then") != "sit":
					face_thing(npc, rt, s, dt)
				return
			if st.get("r") != null:
				var s2 := s.duplicate()
				s2["mode"] = "once"
				walk_route(npc, rt, dt, s2, st["r"], func():
					at(npc, rt, {"at": s.get("to")})
					npc["pose"] = s["sit"] if s.get("then") == "sit" else s["pose"]
					st["arrived"] = s.get("to")
					rt.emit({"type": "arrived", "id": npc["cid"], "at": s.get("to")}))


static func next_route(npc: Dictionary, rt, s: Dictionary) -> void:
	var rs: Array = s.get("routes", [])
	if rs.is_empty():
		return
	var st: Dictionary = npc["st"]
	var k: int
	if s.get("pick") == "random" and rs.size() > 1:
		k = (int(st["k"]) + 1 + randi() % (rs.size() - 1)) % rs.size()
	else:
		k = (int(st["k"]) + 1) % rs.size()
	st["k"] = k
	st["r"] = rt.route(rs[k])
	st["i"] = 0
	st["wait"] = 0.0
	st["dir"] = 1
	if st["r"] != null and npc.get("pos") == null:
		npc["pos"] = st["r"]["points"][0]["pos"]
		npc["level"] = st["r"]["level"]


## walk a route: to each point in turn at `speed`, turning as she goes; a point's `wait` holds her there
static func walk_route(npc: Dictionary, rt, dt: float, s: Dictionary, r: Dictionary, on_end: Callable) -> void:
	var st: Dictionary = npc["st"]
	var pts: Array = r["points"]
	if pts.is_empty():
		return
	if float(st.get("wait", 0.0)) > 0:
		st["wait"] = float(st["wait"]) - dt
		if st.get("pose") != null:
			turn_to(npc, float(st.get("faceYaw", npc["yaw"])), dt)
		if float(st["wait"]) <= 0:
			st["pose"] = null
		npc["pose"] = st["pose"] if st.get("pose") != null else s["pose"]
		return
	var pt: Dictionary = pts[int(st["i"])]
	var d: Vector3 = (pt["pos"] as Vector3) - (npc["pos"] as Vector3)
	d.y = 0
	var dist := d.length()
	if dist <= ARRIVE:
		if float(pt.get("wait", 0)) > 0:
			st["wait"] = float(pt["wait"])
			st["pose"] = pt.get("pose")
			st["faceYaw"] = pt["yaw"]
			npc["walking"] = false
			npc["pose"] = pt.get("pose") if pt.get("pose") != null else s["pose"]
		if pt.get("check") != null and rt.player.hiding == pt["check"]:
			rt.caught(npc["cid"], pt["check"])
		var n := pts.size()
		var mode = s.get("mode") if s.get("mode") != null else r.get("mode", "loop")
		if mode == "pingpong" and n > 1:
			if int(st["i"]) + int(st["dir"]) >= n or int(st["i"]) + int(st["dir"]) < 0:
				st["dir"] = -int(st["dir"])
			st["i"] = int(st["i"]) + int(st["dir"])
		elif int(st["i"]) + 1 < n:
			st["i"] = int(st["i"]) + 1
		elif mode == "once":
			npc["walking"] = false
			npc["pose"] = s["pose"]
			if on_end.is_valid():
				on_end.call()
			return
		else:
			st["i"] = 0
		return
	npc["walking"] = true
	npc["pose"] = s["pose"]
	npc["level"] = r["level"]
	var ready := turn_to(npc, rad_to_deg(atan2(-d.z, d.x)), dt)
	var step: float = min(dist, float(s["speed"]) * dt * (1.0 if ready else 0.3))
	npc["pos"] = (npc["pos"] as Vector3) + d.normalized() * step
