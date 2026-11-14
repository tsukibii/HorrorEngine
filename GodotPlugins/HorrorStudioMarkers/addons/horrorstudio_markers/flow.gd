@tool
## A character's markers read as a whole (docs/MARKERS.md §3, §6): their order and numbers, where she is when each
## starts, the path of a walk, how long things take, and what can never happen (the tab's Problems). Nothing here
## runs anything: the runner, the 3D view's drawing and the tab all ask the same questions of it.
class_name HSNpcFlow
extends RefCounted

const STEP := 0.1                          # metres between a sampled path's points
const SEAT_EDGE := -0.05                   # the Animator's own numbers when a character's record has none
const REACH_AT := [-0.12, 0.85, 0.45]
const HANDLE_AT := [-0.14, 1.0, 0.45]
const MOST := 6                            # how many places she can be at once are followed (ways of a Choice)


static func quests(npc: Node) -> Array:
	var out := []
	if npc == null:
		return out
	for c in npc.get_children():
		if c is HSNpcQuest:
			out.append(c)
	return out


## the markers directly inside a quest, a way or a Repeat, in order
static func items(container: Node) -> Array:
	var out := []
	if container == null:
		return out
	for c in container.get_children():
		if c is HSNpcMarker:
			out.append(c)
	return out


static func npc_of(node: Node) -> Node:
	var n := node
	while n != null:
		if n is HSNpc:
			return n
		n = n.get_parent()
	return null


static func quest_of(node: Node) -> HSNpcQuest:
	var n := node
	while n != null:
		if n is HSNpcQuest:
			return n
		n = n.get_parent()
	return null


## a quest's storyboard: every marker and way in the order they're read, each {node, label, depth}; a marker's label
## is its number ("3", "4A.1": the first marker of the Choice 4's first way, "5.2": the second inside the Repeat 5)
static func board(quest: Node) -> Array:
	var out := []
	_board(quest, "", 0, out)
	return out


static func _board(container: Node, pre: String, depth: int, out: Array) -> void:
	var i := 0
	for m in items(container):
		i += 1
		var lab := "%s%d" % [pre, i]
		out.append({"node": m, "label": lab, "depth": depth})
		var mk := m as HSNpcMarker
		if mk.kind == "choice":
			var w := 0
			for way in mk.ways():
				var letter := char(65 + w) if w < 26 else str(w + 1)
				w += 1
				out.append({"node": way, "label": lab + letter, "depth": depth + 1})
				_board(way, lab + letter + ".", depth + 2, out)
		elif mk.kind == "repeat":
			_board(mk, lab + ".", depth + 1, out)


static func label_of(marker: Node) -> String:
	var q := quest_of(marker)
	if q == null:
		return ""
	for row in board(q):
		if row["node"] == marker:
			return row["label"]
	return ""


# ---- where she is ---------------------------------------------------------------------------------------------------------
static func turned(v: Vector3, yaw: float) -> Vector3:
	return Vector3(v.x * cos(yaw) + v.z * sin(yaw), v.y, -v.x * sin(yaw) + v.z * cos(yaw))


static func _clip_info(record: Dictionary, clip: String) -> Dictionary:
	var c = (record.get("clips", {}) as Dictionary).get(clip, {}) if record.get("clips") is Dictionary else {}
	return c if c is Dictionary else {}


## where her hand goes for a Grab: the thing itself when it picks one up, else the pin
static func hand_at(m: HSNpcMarker) -> Vector3:
	if m.kind == "grab" and m.action in ["pick_up", "eat", "drink"] and not m.target.is_empty() and m.is_inside_tree():
		var t := m.get_node_or_null(m.target)
		if t is Node3D:
			return (t as Node3D).global_position
	return m.place()


## which of her three reaches suits a height over the floor: "low" (the floor), "mid" (a table), "high" (a shelf):
## the one whose own hand height is nearest (a baked character's record says each; else an adult's)
static func reach_level(record: Dictionary, high: float) -> String:
	var tall := float((record.get("body", {}) as Dictionary).get("height", 165.0)) / 165.0 if record.get("body") is Dictionary else 1.0
	var best := "mid"
	var best_d := INF
	for lv in ["low", "mid", "high"]:
		var at: Array = _clip_info(record, "reach_" + lv).get("reach", {}).get("at", [])
		var h: float = float(at[1]) if at.size() == 3 else float({"low": 0.1, "mid": 0.86, "high": 1.655}[lv]) * tall
		if absf(h - high) < best_d:
			best_d = absf(h - high)
			best = lv
	return best


## the clip a Grab plays and where her hand is in it, from where she stands: {clip, at: [x, y, z]}. `high`: how far
## the hand's place is over the floor (NAN: not known: a table's height)
static func reach_of(m: HSNpcMarker, record: Dictionary, high: float = NAN) -> Dictionary:
	var hand := "_l" if m.left_hand else ""
	var clip := "open_%s%s" % [m.door_opens, hand] if m.action == "open" else "reach_%s%s" % [reach_level(record, high) if not is_nan(high) else "mid", hand]
	var info := _clip_info(record, clip)
	var at: Array = info.get("door", {}).get("handle", HANDLE_AT) if m.action == "open" else info.get("reach", {}).get("at", REACH_AT)
	var x := float(at[0])
	if m.left_hand and info.is_empty():
		x = -x                                             # (no record: the left hand's reach is the right's mirrored)
	var z := float(at[2])
	if m.action == "open" and not is_nan(high):            # (a handle's own height: she stands nearer to a lower or a higher one than her clip was made for)
		z = handle_ahead(info.get("door", {}), high)
	return {"clip": clip, "at": [x, float(at[1]), z]}


## how far in front of her a handle `high` m over the floor has to be for her hand to get to it (the starter's
## motion.gd handle_ahead, the same rule: where the clip stands her, or nearer when her arm doesn't reach it from
## there; `d`: the clip's `door` record: its shoulder, arm and grip)
static func handle_ahead(d: Dictionary, high: float) -> float:
	var hp: Array = d.get("handle", HANDLE_AT)
	var sh: Array = d.get("shoulder", [])
	var g: Array = d.get("grip", [])
	var arm := float(d.get("arm", 0.0))
	if sh.size() != 3 or g.size() != 3 or arm <= 0.0:
		return float(hp[2])                               # (baked before this: where the clip stands her)
	var up := high - float(g[1]) - float(sh[1])           # her wrist over her shoulder, with the middle of her hand on the handle
	var far := 0.96 * arm
	var flat := sqrt(maxf(0.0, far * far - up * up))
	var toes := 0.55 * float(hp[2])                       # no nearer than this: her feet are in front of her
	return clampf(float(sh[2]) + flat + float(g[2]), toes, float(hp[2]))


## where she stands to sit, lie down or put a hand out at a marker: {pos, yaw} (pos.y the pin's: the floor is the
## body's to find). `record`: the Animator's record of her clips (its own numbers), or nothing; `ground`: the floor's
## height where she'll stand, when it's known (a Grab picks its reach by how high its pin is over it)
static func stand_for(m: HSNpcMarker, record: Dictionary = {}, ground: float = NAN) -> Dictionary:
	var f := m.front()
	var yaw := atan2(f.x, f.z)
	match m.kind:
		"sit":
			var seat: Dictionary = _clip_info(record, "sit_down").get("seat", {})
			return {"pos": m.place() - f * float(seat.get("edge", SEAT_EDGE)), "yaw": yaw}
		"sleep":
			var bed: Dictionary = _clip_info(record, "lie_down" + ("_r" if m.head_right else "")).get("bed", {})
			return {"pos": m.place() - f * float(bed.get("edge", SEAT_EDGE)), "yaw": yaw}
		"grab":
			var at := hand_at(m)
			var rp: Array = reach_of(m, record, at.y - ground)["at"]
			return {"pos": at - turned(Vector3(float(rp[0]), 0, float(rp[2])), yaw), "yaw": yaw}
	return {"pos": m.place(), "yaw": yaw}


## where she is once a marker is done, from where she was: {pos, yaw}
static func end_of(m: HSNpcMarker, from: Dictionary, record: Dictionary = {}) -> Dictionary:
	match m.kind:
		"appear":
			return {"pos": m.place(), "yaw": m.yaw()}
		"walk":
			if m.to_player:
				return from
			var yaw := m.yaw()
			if not m.face_arrow:
				var pts := walk_control(m, from["pos"])
				var d: Vector3 = pts[pts.size() - 1] - pts[pts.size() - 2] if pts.size() >= 2 else Vector3.ZERO
				yaw = atan2(d.x, d.z) if Vector2(d.x, d.z).length() > 0.01 else float(from["yaw"])
			return {"pos": m.place(), "yaw": yaw}
		"sit", "sleep", "grab":
			return stand_for(m, record, (from["pos"] as Vector3).y)
		"scare":
			return {"pos": m.place(), "yaw": m.yaw()}
	return from


static func _add_place(list: Array, p: Dictionary) -> void:
	for q in list:
		if (q["pos"] as Vector3).distance_to(p["pos"]) < 0.05 and absf(angle_difference(float(q["yaw"]), float(p["yaw"]))) < 0.05:
			return
	if list.size() < MOST:
		list.append(p)


# every place she can be after the markers of a container, from every place she can be before them
static func _chain(container: Node, froms: Array, record: Dictionary) -> Array:
	var at := froms
	for m in items(container):
		at = _after(m, at, record)
	return at


static func _after(m: HSNpcMarker, froms: Array, record: Dictionary) -> Array:
	var out := []
	if m.kind == "choice":
		var any := false
		for way in m.ways():
			any = true
			for p in _chain(way, froms, record):
				_add_place(out, p)
		return out if any else froms
	if m.kind == "repeat":
		var inside := froms.duplicate()
		for p in _chain(m, froms, record):
			_add_place(inside, p)
		for p in _chain(m, inside, record):
			_add_place(out, p)
		for p in froms:
			_add_place(out, p)
		return out
	for f in froms:
		_add_place(out, end_of(m, f, record))
	return out


# the places she can be when `target` starts, searching a container from `froms`; null when it isn't inside
static func _seek(container: Node, froms: Array, target: Node, record: Dictionary):
	var at := froms
	for m in items(container):
		if m == target:
			return at
		var mk := m as HSNpcMarker
		if mk.kind == "choice":
			for way in mk.ways():
				if way == target:
					return at
				var got = _seek(way, at, target, record)
				if got != null:
					return got
		elif mk.kind == "repeat":
			var inside := at.duplicate()
			for p in _chain(mk, at, record):
				_add_place(inside, p)
			var got2 = _seek(mk, inside, target, record)
			if got2 != null:
				return got2
		at = _after(mk, at, record)
	return null


## where the character itself is (in the editor: where she's placed in the scene): {pos, yaw}
static func home_of(npc: Node) -> Dictionary:
	var her: Node3D = npc.character_node() if npc != null and npc.has_method("character_node") else null
	if her == null or not her.is_inside_tree():
		return {"pos": Vector3.ZERO, "yaw": 0.0}
	var f := her.global_basis.z
	return {"pos": her.global_position, "yaw": atan2(f.x, f.z)}


## the places she can be when a quest starts, if every quest before it ran to its end: [{pos, yaw}]
static func quest_starts(quest: Node, home = null, record: Dictionary = {}) -> Array:
	var npc := npc_of(quest)
	var at: Array = [home if home is Dictionary else home_of(npc)]
	for q in quests(npc):
		if q == quest:
			break
		at = _chain(q, at, record)
	return at


## the places she can be when a marker (or a way) starts: [{pos, yaw}], the likeliest first
static func starts_of(marker: Node, home = null, record: Dictionary = {}) -> Array:
	var q := quest_of(marker)
	if q == null:
		return [home if home is Dictionary else {"pos": Vector3.ZERO, "yaw": 0.0}]
	var got = _seek(q, quest_starts(q, home, record), marker, record)
	return got if got != null and not (got as Array).is_empty() else quest_starts(q, home, record)


# ---- a walk's path --------------------------------------------------------------------------------------------------------
## the points a walk goes through: where she is, its bends, its pin
static func walk_control(m: HSNpcMarker, from: Vector3) -> PackedVector3Array:
	var pts := PackedVector3Array([from])
	for b in m.bends():
		pts.append((b as Node3D).global_position if (b as Node3D).is_inside_tree() else (b as Node3D).position)
	pts.append(m.place())
	var out := PackedVector3Array()
	for p in pts:
		if out.is_empty() or out[out.size() - 1].distance_to(p) > 0.001:
			out.append(p)
	return out


## the path walked from a place to a Walk marker, as points about STEP apart: one smooth curve through the bends
## (centripetal Catmull-Rom: it doesn't swing wide), or straight from bend to bend
static func walk_points(m: HSNpcMarker, from: Vector3) -> PackedVector3Array:
	return sampled(walk_control(m, from), m.smooth)


static func sampled(ctrl: PackedVector3Array, smooth := true) -> PackedVector3Array:
	var out := PackedVector3Array()
	if ctrl.size() < 2:
		return ctrl
	if not smooth or ctrl.size() == 2:
		for i in ctrl.size() - 1:
			var a := ctrl[i]
			var b := ctrl[i + 1]
			var n := maxi(1, int(ceil(a.distance_to(b) / STEP)))
			for k in n:
				out.append(a.lerp(b, float(k) / n))
		out.append(ctrl[ctrl.size() - 1])
		return out
	for i in ctrl.size() - 1:
		var p1 := ctrl[i]
		var p2 := ctrl[i + 1]
		var p0 := ctrl[i - 1] if i > 0 else p1 + (p1 - p2)
		var p3 := ctrl[i + 2] if i + 2 < ctrl.size() else p2 + (p2 - p1)
		var t0 := 0.0
		var t1 := t0 + sqrt(maxf(p0.distance_to(p1), 1e-4))
		var t2 := t1 + sqrt(maxf(p1.distance_to(p2), 1e-4))
		var t3 := t2 + sqrt(maxf(p2.distance_to(p3), 1e-4))
		var n := maxi(2, int(ceil(p1.distance_to(p2) * 1.15 / STEP)))
		for k in n:
			var t := lerpf(t1, t2, float(k) / n)
			var a1 := p0 * ((t1 - t) / (t1 - t0)) + p1 * ((t - t0) / (t1 - t0))
			var a2 := p1 * ((t2 - t) / (t2 - t1)) + p2 * ((t - t1) / (t2 - t1))
			var a3 := p2 * ((t3 - t) / (t3 - t2)) + p3 * ((t - t2) / (t3 - t2))
			var b1 := a1 * ((t2 - t) / (t2 - t0)) + a2 * ((t - t0) / (t2 - t0))
			var b2 := a2 * ((t3 - t) / (t3 - t1)) + a3 * ((t - t1) / (t3 - t1))
			out.append(b1 * ((t2 - t) / (t2 - t1)) + b2 * ((t - t1) / (t2 - t1)))
	out.append(ctrl[ctrl.size() - 1])
	return out


static func length(points: PackedVector3Array) -> float:
	var l := 0.0
	for i in points.size() - 1:
		l += points[i].distance_to(points[i + 1])
	return l


const LOW_SPEED := {"sneak": 0.42, "crawl": 0.38, "creep": 0.53, "scuttle": 1.2}   # a low pace's speed when her record doesn't say (HSNpcBody.LOW)

## how fast she goes on a Walk marker, metres a second: `walk` and `run` her own speeds, `dist` the path's length
## (`low`: her own speed at a low pace (sneak, crawl, creep, scuttle) when it's known; else what such a pace usually is)
static func speed_of(m: HSNpcMarker, walk: float, run: float, dist: float, low := 0.0) -> float:
	if m.take_secs > 0.0:
		return clampf(dist / m.take_secs, 0.1, 9.0)
	var base := run if m.pace == "run" else walk
	if m.pace in LOW_SPEED:
		base = low if low > 0.05 else float(LOW_SPEED[m.pace])
	return clampf(base * m.pace_scale, 0.1, 9.0)


## about how long a marker takes, seconds (-1: it depends: on you, on flags). `from`: where she starts; `walk`, `run`:
## her speeds; `clip_secs`: a named clip's length when known
static func seconds_of(m: HSNpcMarker, from: Vector3, walk := 1.3, run := 3.0, clip_secs := 0.0) -> float:
	match m.kind:
		"walk":
			if m.to_player:
				return -1.0
			var d := length(walk_points(m, from))
			return d / speed_of(m, walk, run, d) + 0.45          # (easing in and out, the turn at the end)
		"wait", "sit", "sleep":
			return m.stay_secs if m.stay == "secs" else -1.0
		"animation":
			if m.loop:
				return m.stay_secs if m.stay == "secs" else -1.0
			return clip_secs * m.times / maxf(m.anim_speed, 0.05) if clip_secs > 0.0 else -1.0
		"appear", "disappear", "event":
			return 0.0 if m.how == "now" or m.kind == "event" else -1.0
		"scare":
			return (1.0 if not m.scare_stays else 2.0) if m.how == "now" else -1.0
	return -1.0


# ---- what can't work ------------------------------------------------------------------------------------------------------
## what's wrong or can never happen in a character's markers: [{node, text, level}] (level "error", "warn" or "tip").
## `clips`: the names of her animations when known (else none is checked); `setters`: the flags something in the scene
## turns on (flow.flags_set), or null when the scene wasn't read (then no flag is called unset); `known_tasks`: the
## scene's tasks' ids, or null
static func problems(npc: Node, clips: PackedStringArray = [], setters = null, known_tasks = null) -> Array:
	var out := []
	if npc == null:
		return out
	var her: Node3D = npc.character_node()
	if her == null:
		out.append({"node": npc, "text": "No character yet: pick the model this is for (Character, on the HSNpc).", "level": "error"})
	var qs := quests(npc)
	if qs.is_empty():
		out.append({"node": npc, "text": "No quest yet: add one, then drop markers in the 3D view.", "level": "tip"})
	var mine := {}
	if npc.has_method("id"):
		for k in ["talked:", "shot:", "down:"]:
			mine[k + npc.id()] = true
	for q in qs:
		_cond_problems(q, (q as HSNpcQuest).starts_when, "starts when", setters, mine, known_tasks, npc, out)
		var rows := board(q)
		if items(q).is_empty():
			out.append({"node": q, "text": "'%s' has no markers." % (q as HSNpcQuest).label(), "level": "tip"})
		_container_problems(q, npc, clips, setters, mine, known_tasks, out, false)
	_hand_problems(npc, out)
	return out


# what's in her hand as the markers go (in order, every way gone through): an Eat or a Drink with nothing named wants
# something there by then
static func _hand_problems(npc: Node, out: Array) -> void:
	var holding := false
	for q in quests(npc):
		for row in board(q):
			var m := row["node"] as HSNpcMarker
			if m == null or m.kind != "grab":
				continue
			var named := not m.target.is_empty() and m.is_inside_tree() and m.get_node_or_null(m.target) != null
			match m.action:
				"pick_up":
					holding = named and m.keep_in_hand
				"put_down":
					holding = false
				"eat", "drink":
					if not named and not holding:
						out.append({"node": m, "text": "%s %s: nothing's named and her hand is empty by then, so she only goes through the motions. Pick the thing, or put a Pick up before it." % [row["label"], m.title()], "level": "tip"})
					holding = m.action == "drink" and (named or holding)


static func _cond_problems(node: Node, text: String, what: String, setters, mine: Dictionary, known_tasks, npc: Node, out: Array) -> void:
	for w in HSNpcCond.words(text):
		var p := HSNpcCond.parse(w)
		var a := String(p["arg"])
		match String(p["kind"]):
			"flag":
				if w.strip_edges().trim_prefix("!").begins_with("@"):
					out.append({"node": node, "text": "'%s' isn't a word it knows (the @ words: @wait:3, @near:2, @far:6, @seen, @unseen, @shot, @down)." % w, "level": "error"})
				elif setters is Dictionary and not (setters as Dictionary).has(a) and not mine.has(a) and not a.contains(":"):
					out.append({"node": node, "text": "Its %s asks for the flag '%s', and nothing in the scene turns it on." % [what, a], "level": "warn"})
			"task", "on":
				if known_tasks is PackedStringArray and not (a in (known_tasks as PackedStringArray)):
					out.append({"node": node, "text": "Its %s asks for the task '%s', which isn't on the Story's list or added by anything." % [what, a], "level": "warn"})
			"wait", "near", "far":
				if not a.is_valid_float():
					out.append({"node": node, "text": "'%s' needs a number (@%s:2)." % [w, p["kind"]], "level": "error"})


static func _container_problems(container: Node, npc: Node, clips: PackedStringArray, setters, mine: Dictionary, known_tasks, out: Array, hidden_in: bool) -> bool:
	var hidden := hidden_in
	var list := items(container)
	var record: Dictionary = npc.record() if npc.has_method("record") else {}
	for i in list.size():
		var m := list[i] as HSNpcMarker
		var lab := "%s %s" % [label_of(m), m.title()]
		_cond_problems(m, m.start_when, "Starts when", setters, mine, known_tasks, npc, out)
		if m.kind == "attack" and not m.attack_at.is_empty() and m.get_node_or_null(m.attack_at) == null:
			out.append({"node": m, "text": "%s: pick who she attacks (or leave it empty: you)." % lab, "level": "error"})
		if not clips.is_empty():                               # animations v3's clips: a character baked before them (or never baked) has none
			var lacks := ""
			var then := ""
			if m.kind == "walk" and m.pace in LOW_SPEED and not _has_clip(clips, m.pace):
				lacks = m.pace
				then = "she'll walk"
			elif m.kind == "grab" and m.action in ["eat", "drink"] and not _has_clip(clips, m.action + ("_l" if m.left_hand else "")):
				lacks = m.action
				then = "she'll only take it"
			elif m.kind == "attack" and not _has_clip(clips, m.attack + ("_l" if m.left_hand else "")):
				lacks = m.attack
				then = "she'll go up to them and nothing more"
			elif m.kind == "scare" and not _has_clip(clips, "scare_" + m.scare_kind):
				lacks = "scare_" + m.scare_kind
				then = "she'll be there for a blink and no more"
			if lacks != "":
				out.append({"node": m, "text": "%s: she has no '%s' of her own (%s). Bake her again in the Animator: it makes one." % [lab, lacks, then], "level": "warn"})
		if m.head != "keep" and not m.head_at.is_empty() and m.get_node_or_null(m.head_at) == null:
			out.append({"node": m, "text": "%s: pick who her head follows (or leave it empty: you)." % lab, "level": "error"})
		if m.head == "follow" and not ResourceLoader.exists(HSNpcBody.LOOK + "head_track.gd"):
			out.append({"node": m, "text": "%s: her head can't follow anyone without the HorrorStudio Look plugin in the project (addons/horrorstudio_look)." % lab, "level": "warn"})
		match m.kind:
			"walk":
				if not m.to_player:
					for from in starts_of(m):
						var d := length(walk_points(m, from["pos"]))
						if d < 0.05:
							out.append({"node": m, "text": "%s goes nowhere: its pin is where the character already is." % lab, "level": "warn"})
						elif m.take_secs > 0.0 and d / m.take_secs > 6.0:
							out.append({"node": m, "text": "%s: %.1f m in %.1f s is faster than anyone runs; the feet will slide." % [lab, d, m.take_secs], "level": "warn"})
						break
			"sit", "sleep", "grab":
				for from in starts_of(m):
					var st := stand_for(m, record, (from["pos"] as Vector3).y)
					var gap := Vector2(st["pos"].x - from["pos"].x, st["pos"].z - from["pos"].z).length()
					if gap > 2.0:
						out.append({"node": m, "text": "%s is %.1f m from where the character will be: it's walked in a straight line. Put a Walk marker before it." % [lab, gap], "level": "tip"})
					break
				if m.kind == "grab" and m.action in ["pick_up", "open"] and (m.target.is_empty() or m.get_node_or_null(m.target) == null):
					out.append({"node": m, "text": "%s: pick %s." % [lab, "the thing to pick up" if m.action == "pick_up" else "the door to open"], "level": "error"})
			"animation":
				if m.clip == "" and m.clip_file == "":
					out.append({"node": m, "text": "%s: pick the animation to play." % lab, "level": "error"})
				elif m.clip_file != "" and not ResourceLoader.exists(m.clip_file) and not FileAccess.file_exists(m.clip_file):
					out.append({"node": m, "text": "%s: the file %s isn't there." % [lab, m.clip_file], "level": "error"})
				elif m.clip_file == "" and not clips.is_empty() and not _has_clip(clips, m.clip):
					out.append({"node": m, "text": "%s: there's no animation called '%s'." % [lab, m.clip], "level": "error"})
			"wait":
				if m.clip != "" and not clips.is_empty() and not _has_clip(clips, m.clip):
					out.append({"node": m, "text": "%s: there's no animation called '%s'." % [lab, m.clip], "level": "error"})
			"choice":
				var ways := m.ways()
				if ways.is_empty():
					out.append({"node": m, "text": "%s has no ways: add one for each thing that can happen." % lab, "level": "error"})
				for w in ways.size():
					var way := ways[w] as HSNpcWay
					_cond_problems(way, way.when, "flags", setters, mine, known_tasks, npc, out)
					if way.when.strip_edges() == "" and w < ways.size() - 1:
						out.append({"node": way, "text": "%s: the way '%s' has no flags, so it's always taken: the ways under it never are. Move it last." % [lab, way.title()], "level": "error"})
					_container_problems(way, npc, clips, setters, mine, known_tasks, out, hidden)
			"repeat":
				_cond_problems(m, m.repeat_until, "until", setters, mine, known_tasks, npc, out)
				if m.inner().is_empty():
					out.append({"node": m, "text": "%s has nothing inside it to repeat." % lab, "level": "warn"})
				elif m.repeat_times == 0 and m.repeat_until.strip_edges() == "" and i < list.size() - 1:
					out.append({"node": m, "text": "%s never ends, so the markers after it never run (only a later quest takes over). Give it a number of times or an 'until'." % lab, "level": "warn"})
				_container_problems(m, npc, clips, setters, mine, known_tasks, out, hidden)
			"disappear":
				hidden = true
			"appear":
				hidden = false
		if hidden and m.kind in ["walk", "sit", "sleep", "grab", "attack"] :
			out.append({"node": m, "text": "%s comes after a Disappear: the character comes back where they vanished. Put a Start here before it to come back somewhere else." % lab, "level": "tip"})
			hidden = false
		if m.stay == "talked" and m.stays() and not (m.talk and not m.conversations().is_empty()):
			out.append({"node": m, "text": "%s stays until you talk, but has nothing to say here: turn on 'You can talk here' and give it a line." % lab, "level": "error"})
		if m.talk and m.conversations().is_empty() and m.kind != "choice":
			out.append({"node": m, "text": "%s: you can talk here, but there's no conversation." % lab, "level": "warn"})
		if m.talk:                                             # answers are shown on one line with a dash between: two at the most (DECISIONS 2026-10-30, evening)
			for c in m.conversations():
				if (c["answers"] as Array).size() > 2:
					out.append({"node": m, "text": "%s: %d answers to one question. They're shown on one line with a dash between: keep it to two (a second question can follow from an answer's flag)." % [lab, (c["answers"] as Array).size()], "level": "warn"})
		for fp in m.fire:
			var t := m.get_node_or_null(fp) if m.is_inside_tree() else null
			if t == null:
				out.append({"node": m, "text": "%s fires something that isn't there any more." % lab, "level": "error"})
			elif not (t.has_method("fire") or t.has_method("start")):
				out.append({"node": m, "text": "%s fires '%s', which has no fire() to call." % [lab, t.name], "level": "warn"})
	return hidden


static func _has_clip(clips: PackedStringArray, n: String) -> bool:
	for c in clips:
		if c == n or c == n + "_loop" or c.trim_suffix("_loop") == n or c.get_slice("/", c.get_slice_count("/") - 1) == n:
			return true
	return false


## the flags something in a scene turns on: {flag: true}. Read from every marker's set_flags and answers, and from
## the properties the starter kit's nodes set flags by (fact, flag, flags, task_flags, flags_start)
static func flags_set(root: Node) -> Dictionary:
	var out := {}
	if root == null:
		return out
	var todo: Array = [root]
	while not todo.is_empty():
		var n: Node = todo.pop_back()
		todo.append_array(n.get_children())
		if n is HSNpcMarker:
			var m := n as HSNpcMarker
			for f in HSNpcCond.switched(m.set_flags):
				out[f["name"]] = true
			for c in m.conversations():
				for f in HSNpcCond.switched(c["sets"]):
					out[f["name"]] = true
				for a in c["answers"]:
					for f in HSNpcCond.switched(a["sets"]):
						out[f["name"]] = true
			continue
		if n.get_script() == null:
			continue
		for key in ["fact", "flag", "flags", "sets"]:
			var v = n.get(key)
			if v is String and v != "":
				for f in HSNpcCond.switched(v):
					out[f["name"]] = true
		for key in ["task_flags", "flags_start"]:
			var v2 = n.get(key)
			if v2 is PackedStringArray:
				for line in v2:
					var s := String(line)
					var at := s.find(":")
					for f in HSNpcCond.switched(s.substr(at + 1) if key == "task_flags" and at >= 0 else s):
						out[f["name"]] = true
	return out


## the ids of the tasks a scene knows: the Story's own list and what anything adds ("id: text" lines)
static func tasks_known(root: Node) -> PackedStringArray:
	var out := PackedStringArray()
	if root == null:
		return out
	var todo: Array = [root]
	while not todo.is_empty():
		var n: Node = todo.pop_back()
		todo.append_array(n.get_children())
		for key in ["tasks", "add_tasks"]:
			var v = n.get(key) if (n.get_script() != null) else null
			if v is PackedStringArray:
				for line in v:
					var id := String(line).get_slice(":", 0).strip_edges()
					if id != "" and not (id in out):
						out.append(id)
	return out
