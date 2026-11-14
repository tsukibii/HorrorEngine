@tool
## What runs a character's markers (docs/MARKERS.md §6): which quest she's in, which marker, what it waits for, and
## the asking of her body (body.gd) and her face (face.gd). One for each HSNpc while the game runs; the editor's tester
## makes one for a copy of her, with `preview` on: every Starts when is passed after a moment, nothing is fired, no
## flag is set, conversations are only noted.
##
## A marker goes gate → run → stay → done:
##   gate   its Starts when isn't so yet: she holds what she's in (and you can talk to her at the marker before)
##   run    she's doing it (walking, sitting down, a clip): done when her body is
##   stay   a kind she stays in (Wait, Sit, Sleep, a loop): for its seconds, or until you've talked to her
## then its flags and tasks, and the next. Quests: §6.2 (in order; one with a Starts when cuts in; never back up).
class_name HSNpcRunner
extends RefCounted

const POLL := 0.1                          # how often conditions are looked at (seconds)
const MOST := 16                           # markers that take no time, a frame
const LOOK_SWITCH := "res://addons/horrorstudio_look/nodes/look_switch.gd"
const TALK_BODY := "res://addons/horrorstudio_markers/talk_body.gd"

var npc: Node                              ## her HSNpc
var her: Node3D
var tree: SceneTree
var body := HSNpcBody.new()
var face := HSNpcFace.new()
var preview := false
var picks := {}                            ## the tester: a Choice -> which of its ways to take
var stop_after: Node                       ## the tester: stop once this marker is done
var on_note := Callable()                  ## the tester: (text) what would happen in the game
var over := false                          ## the tester: it's played what it was asked to

var qi := -1                               ## the quest she's in (-1: none yet)
var began := {}                            ## quests that have started (by index)
var finished := false                      ## the quest she's in has run out
var halted := false                        ## shot down: no quest starts by itself
var dead := false                          ## gone for good
var stack: Array = []                      ## where she is in her markers: [{node: a quest, a way or a Repeat, i: the next marker in it, n: passes, tick}]
var cur: HSNpcMarker                       ## the marker she's on
var phase := ""                            ## "gate", "run", "stay"
var at: HSNpcMarker                        ## the marker she's at: the last one started (its conversation, its face rules)
var ready_t := 0.0                         ## seconds waited at the gate
var stay_t := 0.0
var talked := false                        ## you've talked to her since she got to `at`
var talking := false
var asked := {}                            ## conversations with answers already had at `at`
var shot := false
var down := false
var home := {}                             ## where she was when the game started: {pos, yaw}
var waiting_for := ""                      ## in plain words, for F7
var problems: Array = []

var _poll := 0.0
var _tick := 0
var _dirty := true
var _down_t := 0.0
var _talk_body: StaticBody3D
var _talk_shape: BoxShape3D
var _box_t := 0.0
var _conv := {}
var _player_mode := -1
var _frozen: Node
var _react: Node
var _kept := {}
var _look := {}
var _look_name := ""
var _scared := false                       # a Jump scare marker's scare has been thrown
var _head := {}                            # her head, as the last marker that said left it: {on, range, at (a path from her HSNpc)}; {}: nothing said yet
var _rule_face := ""
var _noted := {}
var _fading := false
var _fade_t := 0.0


# ---- start ------------------------------------------------------------------------------------------------------------------
func begin(of_npc: Node, character: Node3D, as_preview := false) -> void:
	npc = of_npc
	her = character
	preview = as_preview
	tree = npc.get_tree() if npc != null and npc.is_inside_tree() else null
	body.setup(her, {"walk_speed": float(npc.get("walk_speed")), "run_speed": float(npc.get("run_speed")), "turn_degrees": float(npc.get("turn_degrees")),
		"floor_mask": int(npc.get("floor_mask")), "preview": preview, "waits": bool(npc.get("waits_for_player")) and not preview})
	face.setup(her)
	problems = body.problems.duplicate()
	var f := her.global_basis.z
	home = {"pos": her.global_position, "yaw": atan2(f.x, f.z)}
	body.on_event = _on_body_event
	body.on_struck = func(t: Node, k: String) -> void: npc.struck.emit(t, k)
	if preview:
		return
	_skip_bodies()
	_hook_story()
	_react = HSNpcBody.react_of(her)
	if _react != null:
		_react.connect("hit", _on_hit)
		_react.connect("down", _on_down)
	if bool(npc.get("threat")):
		her.add_to_group("hs_threat")
	if bool(npc.get("starts_hidden")):
		body.hide_now()
	else:
		body.stand("")
	for p in problems:
		push_warning("HSNpc (%s): %s" % [npc.name, p])


func story() -> Node:
	return HSNpcCond.story(tree)


func player() -> Node3D:
	return tree.get_first_node_in_group("hs_player") as Node3D if tree != null else null


func _skip_bodies() -> void:
	var rids: Array[RID] = []
	for c in her.find_children("*", "CollisionObject3D", true, false):
		rids.append((c as CollisionObject3D).get_rid())
	var pl := player()
	if pl is CollisionObject3D:
		rids.append((pl as CollisionObject3D).get_rid())
	body.skip = rids


func _hook_story() -> void:
	var st := story()
	if st == null:
		return
	for sig in ["flagged", "unflagged", "task_done", "task_added", "got"]:
		if st.has_signal(sig) and not st.is_connected(sig, _on_story_changed):
			st.connect(sig, _on_story_changed)
	if st.has_signal("kept") and not st.is_connected("kept", _on_kept):
		st.connect("kept", _on_kept)
	if st.has_signal("revived") and not st.is_connected("revived", _on_revived):
		st.connect("revived", _on_revived)
	if st.has_signal("died") and not st.is_connected("died", _on_died):
		st.connect("died", _on_died)


## her HSNpc left the scene (freed, the level changed): the talk shut, her prompt taken away, the Story no longer
## heard. Nothing may keep this runner going once she's gone: a checkpoint put back would reach for nodes that aren't
func end() -> void:
	if preview:
		return
	_close_talk()
	if tree != null and is_instance_valid(tree.root) and tree.root.has_node(HSNpcTalkBox.NAME):
		HSNpcTalkBox.of(tree).prompt(self, "")
	var st := story()
	if st != null:
		for pair in [["flagged", _on_story_changed], ["unflagged", _on_story_changed], ["task_done", _on_story_changed], ["task_added", _on_story_changed], ["got", _on_story_changed],
				["kept", _on_kept], ["revived", _on_revived], ["died", _on_died]]:
			if st.has_signal(pair[0]) and st.is_connected(pair[0], pair[1]):
				st.disconnect(pair[0], pair[1])


# she and her HSNpc are still there (a runner can outlive them for a moment: something else still holds it)
func _alive() -> bool:
	return npc != null and is_instance_valid(npc) and her != null and is_instance_valid(her)


func _on_story_changed(_a = null) -> void:
	_poll = 0.0                                                # (looked at again this frame)


func _on_body_event(n: String) -> void:
	if preview or tree == null:
		return
	if (n == "step_l" or n == "step_r") and bool(npc.get("step_sounds")):
		var snd := tree.get_first_node_in_group("hs_sound")
		if snd != null and snd.has_method("step"):
			snd.step(her.global_position, body.now == "run")


# ---- conditions ---------------------------------------------------------------------------------------------------------------
func holds(text: String) -> bool:
	return HSNpcCond.holds(text, tree, self)


## the @ words, asked by cond.gd
func local(kind: String, arg: String) -> bool:
	match kind:
		"wait":
			return ready_t >= float(arg)
		"near":
			return player_dist() <= float(arg)
		"far":
			return player_dist() > float(arg)
		"seen":
			return seen()
		"unseen":
			return not seen()
		"shot":
			return shot or HSNpcCond.is_set(tree, "shot:" + npc.id())
		"down":
			return down or HSNpcCond.is_set(tree, "down:" + npc.id())
	return false


func player_dist() -> float:
	var pl := player()
	return pl.global_position.distance_to(her.global_position) if pl != null else INF


func _camera() -> Camera3D:
	var vp := her.get_viewport() if her != null and her.is_inside_tree() else null
	return vp.get_camera_3d() if vp != null else null


func _clear(cam: Camera3D, p: Vector3) -> bool:
	var w := her.get_world_3d()
	var space := w.direct_space_state if w != null else null
	if space == null:
		return true
	var q := PhysicsRayQueryParameters3D.create(cam.global_position, p, 1)
	q.exclude = body.skip
	return space.intersect_ray(q).is_empty()


## a place the player's eye can see: in view with nothing solid in the way (someone standing there: their head, middle, feet)
func spot_seen(feet: Vector3, tall := 1.6) -> bool:
	var cam := _camera()
	if cam == null:
		return false
	for h: float in [tall * 0.95, tall * 0.55, 0.12]:
		var p := feet + Vector3.UP * h
		if cam.is_position_in_frustum(p) and _clear(cam, p):
			return true
	return false


## you can see her
func seen() -> bool:
	if her == null or body.hidden or not her.visible:
		return false
	return spot_seen(her.global_position)


# ---- every frame --------------------------------------------------------------------------------------------------------------
func tick(dt: float) -> void:
	if her == null or not is_instance_valid(her) or npc == null or not is_instance_valid(npc) or over:
		return
	_tick += 1
	if dead:
		return
	_poll -= dt
	var due := _poll <= 0.0
	if due:
		_poll = POLL
	if down:
		if int(npc.get("when_shot_down")) == 2:
			_down_t -= dt
			if _down_t <= 0.0:
				_back_up()
		elif due:
			_quest_switch()
		if down:
			return
	if not preview:
		_player_things(dt)
	body.tick(dt)
	face.tick(dt)
	if talking:
		return
	if due and not preview:
		_quest_switch()
		_face_rules()
	if phase == "gate":
		ready_t += dt
	elif phase == "stay":
		stay_t += dt
	var n := 0
	while n < MOST:
		n += 1
		if cur == null:
			if qi < 0 or finished:
				break
			if not _advance():
				break
			continue
		if not is_instance_valid(cur):                         # (a marker freed under her: on to the next)
			cur = null
			continue
		if phase == "gate":
			if not (due or _dirty):
				break
			_dirty = false
			if not _gate_open(cur):
				break
			_start(cur)
			continue
		if phase == "run":
			if not _run_done(cur):
				break
			phase = "stay"
			stay_t = 0.0
			continue
		if not _stay_done(cur):
			break
		_finish(cur)
		if over:
			break
		cur = null


# which quest: a later one whose Starts when is so cuts in; else the next in order once this one's finished
func _quest_switch() -> void:
	var qs := HSNpcFlow.quests(npc)
	var pick := -1
	for i in range(qs.size() - 1, qi, -1):
		var q := qs[i] as HSNpcQuest
		if q.starts_when.strip_edges() != "" and not began.has(i) and holds(q.starts_when):
			pick = i
			break
	if pick < 0 and not halted and (qi < 0 or finished):
		var nx := qi + 1
		if nx < qs.size() and (qs[nx] as HSNpcQuest).starts_when.strip_edges() == "":
			pick = nx
	if pick >= 0:
		begin_quest(pick)


func begin_quest(i: int) -> void:
	var qs := HSNpcFlow.quests(npc)
	if i < 0 or i >= qs.size():
		return
	var q := qs[i] as HSNpcQuest
	if cur != null or body.busy:
		body.interrupt()
	if down:                                                   # (shot down in the quest before: this one brings her back)
		_unphase()
		body.show_now()
		down = false
	halted = false
	qi = i
	began[i] = true
	finished = false
	stack = [{"node": q, "i": 0, "n": 0, "tick": -1}]
	cur = null
	phase = ""
	_dirty = true
	waiting_for = ""
	if not preview and bool(npc.get("catch_up")) and not body.hidden:
		_catch_up(q)
	npc.quest_started.emit(q)


# a quest that starts while she isn't where it expects her: put there when you can't see her or the place
func _catch_up(q: HSNpcQuest) -> void:
	var first := HSNpcFlow.items(q)
	if first.is_empty() or (first[0] as HSNpcMarker).kind == "appear":
		return
	var want: Array = HSNpcFlow.quest_starts(q, home, body.record)
	if want.size() != 1:
		return
	var p: Vector3 = want[0]["pos"]
	if Vector2(p.x - her.global_position.x, p.z - her.global_position.z).length() < 1.0:
		return
	if seen() or spot_seen(p):
		return
	body.place(p, float(want[0]["yaw"]))


# the next marker: -> false when there's none to start now
func _advance() -> bool:
	while not stack.is_empty():
		var f: Dictionary = stack.back()
		var node: Node = f["node"]
		if not is_instance_valid(node):
			stack.pop_back()
			continue
		var kids := HSNpcFlow.items(node)
		if int(f["i"]) < kids.size():
			cur = kids[int(f["i"])]
			f["i"] = int(f["i"]) + 1
			phase = "gate"
			ready_t = 0.0
			_dirty = true
			return true
		if node is HSNpcMarker and (node as HSNpcMarker).kind == "repeat":
			var r := node as HSNpcMarker
			if int(f["tick"]) == _tick:                        # a whole pass took no time: again next frame, not in this one
				return false
			f["n"] = int(f["n"]) + 1
			var enough := r.repeat_times > 0 and int(f["n"]) >= r.repeat_times
			if preview:
				enough = int(f["n"]) >= maxi(1, mini(r.repeat_times, 2))
			elif not enough and r.repeat_until.strip_edges() != "":
				enough = holds(r.repeat_until)
			if not enough and not kids.is_empty():
				f["i"] = 0
				f["tick"] = _tick
				continue
		stack.pop_back()
	finished = true
	phase = ""
	waiting_for = "the next quest"
	var qs := HSNpcFlow.quests(npc)
	if qi >= 0 and qi < qs.size():
		npc.quest_done.emit(qs[qi])
	if preview:
		over = true
	return false


func _gate_open(m: HSNpcMarker) -> bool:
	if m.start_when.strip_edges() == "":
		return true
	if preview:
		_note_once(m, "waits for: " + HSNpcCond.says(m.start_when))
		return ready_t >= 0.7
	if holds(m.start_when):
		return true
	waiting_for = HSNpcCond.says(m.start_when)
	return false


# ---- a marker started ---------------------------------------------------------------------------------------------------------
func _start(m: HSNpcMarker) -> void:
	phase = "run"
	stay_t = 0.0
	waiting_for = ""
	_fading = false
	if m.kind != "choice" and m.kind != "repeat":
		at = m
		talked = false
		asked = {}
		_rule_face = ""
	if m.needs_body():
		if body.hidden and m.kind != "appear":             # she comes back where she vanished
			_unphase()
			body.show_now()
		body.released = false
		if m.kind != "wait" and not (m.kind == "animation" and m.loop):
			body.hold_clip = ""
			body.hold_rate = 1.0
	_wear(m)
	_effects(m)
	match m.kind:
		"walk":
			_start_walk(m)
		"wait":                                                # (a wait with no loop of its own after a low way of going: she waits low, as it left her)
			body.stand(m.clip if m.clip != "" or not body.is_low() else body.hold_clip, m.anim_speed, m.blend)
		"sit":
			body.sit(m.place(), m.front(), m.blend)
		"sleep":
			body.lie(m.place(), m.front(), m.head_right, m.blend)
		"grab":
			_start_grab(m)
		"animation":
			var clip := m.clip
			if m.clip_file != "":
				clip = body.clip_from(m.clip_file)
				for p in body.problems:
					if not (p in problems):
						problems.append(p)
						push_warning("HSNpc (%s): %s" % [npc.name, p])
			if clip != "":
				if m.loop:
					body.stand(clip, m.anim_speed, m.blend)
				else:
					body.play(clip, m.times, m.anim_speed, m.blend)
		"event":
			if m.let_go and not preview:
				body.interrupt()
				body.released = true
		"attack":
			var who: Node3D = (m.get_node_or_null(m.attack_at) as Node3D) if not m.attack_at.is_empty() else player()
			if preview or who == null:
				_note("%s %s" % ["punches" if m.attack == "punch" else "swings at", "you" if m.attack_at.is_empty() else str(m.attack_at.get_name(m.attack_at.get_name_count() - 1))])
				body.play(m.attack + ("_l" if m.left_hand else ""), m.attack_times, m.anim_speed, m.blend)
			else:
				body.attack(m.attack, who, m.left_hand, m.attack_times, m.anim_speed, m.blend)
		"scare":
			_scared = false
	_head_from(m)
	npc.marker_started.emit(m)


func _start_walk(m: HSNpcMarker) -> void:
	var run := m.pace == "run"
	var gait := m.pace if body.LOW.has(m.pace) else ""        # a low way of going (sneak, crawl, creep, scuttle): its own loop and speed, and she stays low after
	if m.to_player:
		if preview:
			_note("comes to you")
			return
		body.follow(func(): return player().global_position if player() != null else her.global_position,
			clampf(body.gait_pace(m.pace) * m.pace_scale, 0.1, 9.0), run, m.stop_short, m.blend, gait)
		return
	var here := Vector3(her.global_position.x, body.ground(), her.global_position.z)
	var ctrl := HSNpcFlow.walk_control(m, here)
	if ctrl.size() > 2:                                        # she isn't where the path starts (cut short, caught up): she joins it at its nearest stretch
		var want: Array = HSNpcFlow.starts_of(m, home, body.record)
		var near := false
		for w in want:
			if (w["pos"] as Vector3).distance_to(here) < 0.75:
				near = true
		if not near:
			var best := 0
			var best_d := INF
			for i in range(1, ctrl.size() - 1):
				var d := Geometry3D.get_closest_point_to_segment(here, ctrl[i], ctrl[i + 1]).distance_to(here)
				if d < best_d:
					best_d = d
					best = i
			var joined := PackedVector3Array([here])
			for i in range(best + 1, ctrl.size()):
				joined.append(ctrl[i])
			ctrl = joined
	var pts := HSNpcFlow.sampled(ctrl, m.smooth)
	var dist := HSNpcFlow.length(pts)
	body.walk(pts, HSNpcFlow.speed_of(m, body.pace(false), body.pace(true), dist, body.gait_pace(m.pace)), run, m.yaw() if m.face_arrow else null, m.follow_floor, m.blend, gait)


func _start_grab(m: HSNpcMarker) -> void:
	var yaw := m.yaw()
	var hand := HSNpcFlow.hand_at(m)
	var thing: Node = m.get_node_or_null(m.target) if not m.target.is_empty() else null
	var r := HSNpcFlow.reach_of(m, body.record, hand.y - body.ground())
	var flat := Vector3(r["at"][0], 0, r["at"][2])
	match m.action:
		"pick_up":
			body.reach(hand, yaw, r["clip"], flat, thing as Node3D, m.keep_in_hand, false, m.anim_speed, m.blend)
		"put_down":
			body.reach(hand, yaw, r["clip"], flat, null, true, true, m.anim_speed, m.blend)
		"open":
			body.open(hand, yaw, r["clip"], flat, thing, m.anim_speed, m.blend)
		"eat", "drink":                                        # the thing taken first when one's named, else what she holds; eaten, it's gone
			body.consume(m.action, thing as Node3D, hand, yaw, r["clip"], flat, m.left_hand, "gone" if m.action == "eat" else "keep", m.anim_speed, m.blend)
		_:
			body.reach(hand, yaw, r["clip"], flat, null, true, false, m.anim_speed, m.blend)


func _run_done(m: HSNpcMarker) -> bool:
	match m.kind:
		"scare":                                               # she's put there, the scare's thrown at once, and when it's been shown she's gone (or stays)
			if not _scared:
				var spot := m.place()
				if m.how == "unseen" and not preview and (seen() or spot_seen(spot)):
					waiting_for = "you to look away"
					return false
				_unphase()
				body.show_now()
				body.place(spot, m.yaw())
				var you := player()
				body.scare(m.scare_kind, you.global_position if m.face_player and you != null and not preview else null, not m.scare_stays)
				_scared = true
				if not preview:
					npc.scared.emit()
					tree.call_group("hs_scare", "scared", her)
				return false
			if body.busy:
				return false
			if not m.scare_stays:
				body.interrupt()
				body.hide_now()
			return true
		"appear":
			var spot := m.place()
			if m.how == "unseen" and not preview and (seen() or spot_seen(spot)):
				waiting_for = "you to look away"
				return false
			var fade := m.how == "fade" and not preview
			if not fade:
				_unphase()
			body.show_now()
			body.place(spot, m.yaw())
			if fade:
				_phase_in()
			return true
		"disappear":
			if body.hidden:
				return true
			if m.how == "unseen" and not preview and seen():
				waiting_for = "you to look away"
				return false
			if m.how == "fade" and not preview and _phase_out():
				return false
			body.interrupt()
			body.hide_now()
			return true
		"choice":
			var ways := m.ways()
			if ways.is_empty():
				return true
			var pick := -1
			if preview:
				pick = clampi(int(picks.get(m, 0)), 0, ways.size() - 1)
			else:
				for i in ways.size():
					if holds((ways[i] as HSNpcWay).when):
						pick = i
						break
			if pick < 0:
				waiting_for = "one of its ways"
				return false
			stack.append({"node": ways[pick], "i": 0, "n": 0, "tick": _tick})
			return true
		"repeat":
			if not preview and m.repeat_until.strip_edges() != "" and holds(m.repeat_until):
				return true
			if not m.inner().is_empty():
				stack.append({"node": m, "i": 0, "n": 0, "tick": _tick})
			return true
		"event":
			return true
	return not body.busy


func _stay_done(m: HSNpcMarker) -> bool:
	if not m.stays():
		return true
	match m.stay:
		"secs":
			waiting_for = "%.1f s" % maxf(0.0, m.stay_secs - stay_t)
			return stay_t >= (minf(m.stay_secs, 3.0) if preview else m.stay_secs)
		"talked":
			if preview:
				_note_once(m, "stays until you talk")
				return stay_t >= 1.2
			waiting_for = "you to talk"
			return talked
	return true


func _finish(m: HSNpcMarker) -> void:
	if preview:
		if m.set_flags != "":
			_note("flags: " + m.set_flags)
		if m.tick != "":
			_note("ticks the task " + m.tick)
	else:
		HSNpcCond.switch_flags(tree, m.set_flags)
		var st := story()
		if st != null:
			if m.tick != "" and st.has_method("tick"):
				st.tick(m.tick)
			if st.has_method("add_line"):
				for line in m.add_tasks:
					st.add_line(line)
	npc.marker_done.emit(m)
	if stop_after == m:
		over = true


# what a marker does as it starts beside her body: a line, a sound, things fired, a scare
func _effects(m: HSNpcMarker) -> void:
	if preview:
		if m.say != "":
			_note("says: " + m.say)
		if m.sound != "":
			_note("sound: " + m.sound)
		if not m.fire.is_empty():
			_note("fires %d thing%s" % [m.fire.size(), "" if m.fire.size() == 1 else "s"])
		if m.scare:
			_note("a jump scare")
		return
	if m.say != "":
		say(m.say, m.say_secs)
	if m.sound != "":
		sound(m.sound)
	for p in m.fire:
		var t := m.get_node_or_null(p)
		if t == null:
			continue
		if t.has_method("fire"):
			t.fire()
		elif t.has_method("start"):
			t.start()
	if m.scare:
		npc.scared.emit()


func say(text: String, secs := 3.0) -> void:
	var st := story()
	if st != null and st.has_method("say"):
		st.say(text, secs)
	elif tree != null:
		HSNpcTalkBox.of(tree).caption(text, secs)


## a sound where she is: one off the starter's sound shelf by name (its Sound node), or a file
func sound(what: String) -> void:
	if tree == null:
		return
	var snd := tree.get_first_node_in_group("hs_sound")
	if snd != null and snd.has_method("play") and not what.begins_with("res://"):
		snd.play(what, her.global_position + Vector3.UP)
		return
	var path := what
	if not path.begins_with("res://"):
		for ext in ["ogg", "wav", "mp3"]:
			if ResourceLoader.exists("res://sfx/%s.%s" % [what, ext]):
				path = "res://sfx/%s.%s" % [what, ext]
	var stream = load(path) if ResourceLoader.exists(path) else null
	if stream is AudioStream:
		var p := AudioStreamPlayer3D.new()
		p.stream = stream
		npc.add_child(p)
		p.global_position = her.global_position + Vector3.UP
		p.finished.connect(p.queue_free)
		p.play()


# ---- her face and her look ----------------------------------------------------------------------------------------------------
# her head from a marker on: following someone, her animation's again, or as it was
func _head_from(m: HSNpcMarker) -> void:
	if m.head == "keep":
		return
	_head = {"on": m.head == "follow", "range": m.head_range, "at": npc.get_path_to(m.get_node(m.head_at)) if not m.head_at.is_empty() and m.get_node_or_null(m.head_at) != null else NodePath("")}
	_head_apply()


func _head_apply() -> void:
	if _head.is_empty() or her == null:
		return
	var who: Node3D = npc.get_node_or_null(_head["at"]) as Node3D if not (_head["at"] as NodePath).is_empty() else null
	if preview:
		_note("her head %s" % ("follows %s" % ("you" if who == null else str(who.name)) if _head["on"] else "is her animation's again"))
		return
	body.head(bool(_head["on"]), who, float(_head["range"]))


func _wear(m: HSNpcMarker) -> void:
	if m.face != "":
		face.wear(m.face, m.face_amount, maxf(m.blend, 0.15))
	if m.look != "" or m.look_skin != "" or m.look_eyes != "":
		_wear_look(m)
	_dirty = true
	_face_rules()


# a marker's face by flags, while she's at it: the first rule that's so
func _face_rules() -> void:
	if at == null or not is_instance_valid(at) or at.face_rules.is_empty() or preview:
		return
	for line in at.face_rules:
		var r := HSNpcMarker.rule(line)
		if String(r["face"]) == "":
			continue
		if holds(String(r["when"])):
			if String(r["face"]) != _rule_face:
				_rule_face = String(r["face"])
				face.wear(_rule_face, at.face_amount, 0.3)
			return


func _wear_look(m: HSNpcMarker) -> void:
	if preview:
		_note("look: " + (m.look if m.look != "" else ", ".join(PackedStringArray([m.look_skin, m.look_eyes])).trim_prefix(", ").trim_suffix(", ")))
		return
	if not ResourceLoader.exists(LOOK_SWITCH):
		_problem("a marker changes the look, and the HorrorStudio Look plugin isn't in this project")
		return
	var sw = load(LOOK_SWITCH).call("attach", her)
	if sw == null:
		return
	if m.look != "":
		_look_name = m.look
		_look = {}
		sw.set_look(m.look, m.look_secs)
		return
	_look_name = ""
	if m.look_skin != "":
		_look["skin"] = m.look_skin
	if m.look_eyes != "":
		_look["eyes"] = m.look_eyes
	if m.look_eye_color.a > 0.0:
		_look["eye_color"] = m.look_eye_color
	_apply_look(sw, m.look_secs)


func _apply_look(sw, secs: float) -> void:
	if _look_name != "":
		sw.set_look(_look_name, secs)
	elif str(_look.get("skin", "default")) in ["", "default"] and str(_look.get("eyes", "default")) in ["", "default"]:
		sw.default(secs)
	else:
		sw.show(_look, secs)


# the look plugin's phasing under her, when the project has it
func _phase_node() -> Node:
	var path := "res://addons/horrorstudio_look/phase.gd"
	if not ResourceLoader.exists(path):
		return null
	return load(path).call("attach", her)


# going: true while she's still fading
func _phase_out() -> bool:
	var ph := _phase_node()
	if ph == null:
		return false
	if not _fading:
		_fading = true
		_fade_t = float(_tick)
		ph.phase_out()
	return float(ph.get("amount")) < 1.0 and float(_tick) - _fade_t < 600.0     # (gone when nothing of her is left; never waited for longer than ten seconds of frames)


func _phase_in() -> void:
	var ph := _phase_node()
	if ph == null:
		return
	ph.set("amount", 1.0)
	ph.set("goal", 1.0)
	ph.phase_in()


# shown without a fade after she faded out: the phasing put back to none
func _unphase() -> void:
	if her == null:
		return
	for c in her.get_children():
		if c.has_method("phase_in") and c.get("amount") != null and (float(c.get("amount")) > 0.0 or float(c.get("goal")) > 0.0):
			if (c.get("materials") as Array).is_empty():
				c.set("amount", 0.0)
				c.set("goal", 0.0)
			else:
				c.phase_in(0.0)


# ---- talking ----------------------------------------------------------------------------------------------------------------
# the conversation she'd have now: {} for none
func conversation() -> Dictionary:
	if at == null or not is_instance_valid(at) or not at.talk:
		return {}
	var list := at.conversations()
	for i in list.size():
		var c: Dictionary = list[i]
		if not holds(String(c["when"])):
			continue
		if not (c["answers"] as Array).is_empty() and asked.has(i):
			if String(c["again"]) == "":
				return {}
			return {"i": -1, "lines": [c["again"]], "answers": [], "sets": "", "when": ""}
		c["i"] = i
		return c
	return {}


func can_talk() -> bool:
	return not preview and not talking and not dead and not down and not body.hidden and not body.busy and not body.released and not conversation().is_empty()


## the player's E on her
func use(_by: Node = null) -> void:
	if not can_talk() or tree == null:
		return
	var box := HSNpcTalkBox.of(tree)
	if box.open_now:
		return
	_conv = conversation()
	talking = true
	_freeze(true)
	var pl := player()
	if at.turn_to_player and body.posture == "standing" and pl != null:
		var d := pl.global_position - her.global_position
		if Vector2(d.x, d.z).length() > 0.05:
			body.turn_to(atan2(d.x, d.z))
	box.line_shown.connect(_on_line)
	box.answered.connect(_on_answer)
	box.finished.connect(_on_talk_done)
	box.prompt(self, "")
	box.start(_conv, npc.display_name())


func _on_line(face_name: String, who: String, _text: String) -> void:
	if face_name != "" and who != "You":
		face.flash(face_name, 1.0, 2.5)


func _on_answer(i: int) -> void:
	var answers: Array = _conv.get("answers", [])
	if i < 0 or i >= answers.size():
		return
	var a: Dictionary = answers[i]
	HSNpcCond.switch_flags(tree, String(a["sets"]))
	if String(a["face"]) != "":
		face.wear(String(a["face"]), 1.0, 0.3)
		_rule_face = String(a["face"])


func _on_talk_done(i: int) -> void:
	var box := HSNpcTalkBox.of(tree)
	for pair in [[box.line_shown, _on_line], [box.answered, _on_answer], [box.finished, _on_talk_done]]:
		if (pair[0] as Signal).is_connected(pair[1]):
			(pair[0] as Signal).disconnect(pair[1])
	if not talking:
		return
	talking = false
	_freeze(false)
	if not (_conv.get("answers", []) as Array).is_empty() and i >= 0:
		asked[int(_conv.get("i", -1))] = true
	if int(_conv.get("i", -1)) >= 0 or i >= 0:
		HSNpcCond.switch_flags(tree, String(_conv.get("sets", "")))
		HSNpcCond.set_flag(tree, "talked:" + npc.id())
		talked = true
	_poll = 0.0
	_dirty = true
	npc.talked.emit(at, i)


func _close_talk() -> void:
	if talking and tree != null:
		HSNpcTalkBox.of(tree).close()
	if talking:
		talking = false
		_freeze(false)


# the player stood still while you talk (as the laptop does it), and free again after
func _freeze(on: bool) -> void:
	if on:
		var pl := player()
		if pl != null:
			_frozen = pl
			_player_mode = pl.process_mode
			pl.process_mode = Node.PROCESS_MODE_DISABLED
	elif _frozen != null and is_instance_valid(_frozen) and _player_mode >= 0:
		_frozen.process_mode = _player_mode as Node.ProcessMode
		_frozen = null
		_player_mode = -1


# what's about you each frame: where you are (she waits for you to move), the box E finds her by, the prompt, facing you
func _player_things(dt: float) -> void:
	var pl := player()
	body.avoid = pl.global_position if pl != null else Vector3.INF
	var can := can_talk()
	if can and _talk_body == null:
		_make_talk_body()
	if _talk_body != null:
		_box_t -= dt
		if _box_t <= 0.0:
			_box_t = 0.4
			_fit_talk_body()
		_talk_body.collision_layer = (2 if can else 0) | (1 if bool(npc.get("solid")) and not body.hidden else 0)
	if tree != null and (can or _talk_body != null):
		var aimed := false
		if can and pl != null and pl.get("aim") is RayCast3D:
			var aim := pl.get("aim") as RayCast3D
			aimed = aim.is_colliding() and aim.get_collider() == _talk_body
		if aimed or tree.root.has_node(HSNpcTalkBox.NAME):
			var word := at.talk_prompt if at != null and is_instance_valid(at) and at.talk_prompt != "" else str(npc.get("talk_prompt"))
			HSNpcTalkBox.of(tree).prompt(self, word if aimed else "", npc.display_name())     # (the HUD's own ring and prompt: the verb, and who under it)
	if at != null and is_instance_valid(at) and at.kind == "wait" and at.face_player and pl != null and not body.busy and body.posture == "standing" and not body.hidden:
		var d := pl.global_position - her.global_position
		if Vector2(d.x, d.z).length() > 0.3:
			her.global_rotation.y = rotate_toward(her.global_rotation.y, atan2(d.x, d.z), deg_to_rad(float(npc.get("turn_degrees"))) * 0.5 * dt)


func _make_talk_body() -> void:
	if not ResourceLoader.exists(TALK_BODY):
		return
	_talk_body = StaticBody3D.new()
	_talk_body.set_script(load(TALK_BODY))
	_talk_body.name = "_Talk"
	_talk_body.set("npc", npc)
	_talk_body.collision_layer = 0
	_talk_body.collision_mask = 0
	var cs := CollisionShape3D.new()
	_talk_shape = BoxShape3D.new()
	_talk_shape.size = Vector3(0.6, 1.7, 0.6)
	cs.shape = _talk_shape
	cs.position = Vector3(0, 0.85, 0)
	_talk_body.add_child(cs)
	her.add_child(_talk_body)
	_skip_bodies()
	_fit_talk_body()


# the box round her as she is now (standing, sat, lying): round her skeleton's bones
func _fit_talk_body() -> void:
	var sk := HSNpcBody.skeleton_of(her)
	if sk == null or _talk_shape == null or sk.get_bone_count() == 0:
		return
	var inv := her.global_transform.affine_inverse() * sk.global_transform
	var lo := Vector3(INF, INF, INF)
	var hi := Vector3(-INF, -INF, -INF)
	for i in sk.get_bone_count():
		var p := inv * sk.get_bone_global_pose(i).origin
		lo = lo.min(p)
		hi = hi.max(p)
	if lo.x == INF:
		return
	var grow := Vector3(0.14, 0.1, 0.14)
	_talk_shape.size = (hi - lo + grow * 2.0).max(Vector3(0.45, 0.45, 0.45))
	(_talk_body.get_child(0) as CollisionShape3D).position = (lo + hi) * 0.5


# ---- shot -----------------------------------------------------------------------------------------------------------------------
func _on_hit(_info = null) -> void:
	if not shot:
		shot = true
		HSNpcCond.set_flag(tree, "shot:" + npc.id())
		_poll = 0.0


func _on_down() -> void:
	_on_hit()
	down = true
	HSNpcCond.set_flag(tree, "down:" + npc.id())
	_close_talk()
	if tree != null and tree.root.has_node(HSNpcTalkBox.NAME):
		HSNpcTalkBox.of(tree).prompt(self, "")
	match int(npc.get("when_shot_down")):
		1:
			_cut_short()
			dead = true
		2:
			_down_t = float(npc.get("back_up_secs"))
		_:
			_cut_short()
			halted = true
	_poll = 0.0


func _cut_short() -> void:
	body.interrupt()
	cur = null
	stack = []
	finished = true
	phase = ""
	waiting_for = "a later quest"


# she can't be killed: up again, and on with what she was doing
func _back_up() -> void:
	if _react != null and is_instance_valid(_react) and _react.has_method("restore"):
		_react.restore()
	down = false
	body.show_now()


# ---- checkpoints ----------------------------------------------------------------------------------------------------------------
func snapshot() -> Dictionary:
	return {"qi": qi, "began": began.duplicate(), "finished": finished, "halted": halted, "dead": dead, "shot": shot, "down": down,
		"cur": npc.get_path_to(cur) if cur != null and is_instance_valid(cur) else NodePath(""),
		"at": npc.get_path_to(at) if at != null and is_instance_valid(at) else NodePath(""),
		"talked": talked, "asked": asked.duplicate(), "body": body.snapshot(), "face": face.snapshot(), "look": _look.duplicate(), "look_name": _look_name, "head": _head.duplicate()}


func restore(d: Dictionary) -> void:
	if d.is_empty():
		return
	_close_talk()
	_unphase()
	if bool(d.get("down", false)) == false and _react != null and is_instance_valid(_react) and bool(_react.get("is_down")) and _react.has_method("restore"):
		_react.restore()
	body.restore(d.get("body", {}))
	face.restore(d.get("face", {}))
	_look = (d.get("look", {}) as Dictionary).duplicate()
	_look_name = String(d.get("look_name", ""))
	_head = (d.get("head", {}) as Dictionary).duplicate()
	if _head.is_empty():
		body.head(false)
	else:
		_head_apply()
	if ResourceLoader.exists(LOOK_SWITCH) and her.get_node_or_null("HSLookSwitch") != null:
		_apply_look(load(LOOK_SWITCH).call("attach", her), 0.0)
	qi = int(d.get("qi", -1))
	began = (d.get("began", {}) as Dictionary).duplicate()
	finished = bool(d.get("finished", false))
	halted = bool(d.get("halted", false))
	dead = bool(d.get("dead", false))
	shot = bool(d.get("shot", false))
	down = bool(d.get("down", false))
	var c := npc.get_node_or_null(d.get("cur", NodePath("")))
	if c is HSNpcMarker:
		jump_to(c, false)
	else:
		cur = null
		stack = []
		phase = ""
		if not finished and qi >= 0:                           # (between two markers of a quest: from its top again would replay it; she holds)
			finished = true
	var a := npc.get_node_or_null(d.get("at", NodePath("")))
	at = a as HSNpcMarker
	talked = bool(d.get("talked", false))
	asked = (d.get("asked", {}) as Dictionary).duplicate()
	_rule_face = ""
	_poll = 0.0


func _on_kept() -> void:
	if _alive():
		_kept = snapshot()


func _on_revived() -> void:
	if _alive():
		restore(_kept)


func _on_died(_how = null) -> void:
	if not _alive():
		return
	_close_talk()


# ---- going straight to a marker (the tester, a checkpoint, a script) -----------------------------------------------------------
## the next thing she does is `m`: her place in her markers set to it. snap: she's first put in the state the markers
## before it leave her in (where she stands, sat, hidden, her face), as if they'd all run
func jump_to(m: HSNpcMarker, snap := true) -> void:
	var q := HSNpcFlow.quest_of(m)
	if q == null:
		return
	var qs := HSNpcFlow.quests(npc)
	qi = qs.find(q)
	began[qi] = true
	finished = false
	if snap:
		body.interrupt()
		_unphase()
		body.show_now()
		body.place(home["pos"], float(home["yaw"]))
		face.wear("neutral", 1.0, 0.01)
		for q0 in qs:
			if q0 == q:
				break
			_snap_all(q0)
		_snap_until(q, m)
		face.snap()
	var chain: Array = []
	var n: Node = m
	while n != null and n != q:
		var p := n.get_parent()
		if n is HSNpcWay:
			n = p                                              # (the Choice it's a way of: it has no place of its own in the stack)
			continue
		chain.push_front({"node": p, "i": HSNpcFlow.items(p).find(n) + 1, "n": 0, "tick": -1})
		n = p
	stack = chain
	cur = m
	phase = "gate"
	ready_t = 0.0
	_dirty = true
	over = false


func _snap_all(container: Node) -> void:
	for it in HSNpcFlow.items(container):
		_snap_one(it)


func _snap_one(m: HSNpcMarker) -> void:
	if m.kind == "choice":
		var ways := m.ways()
		if not ways.is_empty():
			_snap_all(ways[clampi(int(picks.get(m, 0)), 0, ways.size() - 1)])
	elif m.kind == "repeat":
		_snap_all(m)
	else:
		_snap(m)


# the markers of a container before `target` snapped; -> true when it's inside
func _snap_until(container: Node, target: Node) -> bool:
	for it in HSNpcFlow.items(container):
		if it == target:
			return true
		var mk := it as HSNpcMarker
		if mk.kind == "choice":
			var inside := false
			for way in mk.ways():
				if way == target:
					return true
				if (way as Node).is_ancestor_of(target):
					inside = true
					if _snap_until(way, target):
						return true
			if not inside:
				_snap_one(mk)
		elif mk.kind == "repeat":
			if mk.is_ancestor_of(target):
				return _snap_until(mk, target)
			_snap_all(mk)
		else:
			_snap(mk)
	return false


# a marker's end state, at once
func _snap(m: HSNpcMarker) -> void:
	if m.needs_body() and body.hidden:
		body.show_now()
	match m.kind:
		"appear":
			body.place(m.place(), m.yaw())
		"walk":
			if not m.to_player:
				var e := HSNpcFlow.end_of(m, {"pos": her.global_position, "yaw": her.global_rotation.y}, body.record)
				body.place(e["pos"], float(e["yaw"]))
		"wait":
			var wc := m.clip if m.clip != "" or not body.is_low() else body.hold_clip
			body.hold_clip = wc
			body.hold_rate = m.anim_speed
			body.stand(wc, m.anim_speed, 0.0)
		"sit":
			body.sit_now(m.place(), m.front())
		"sleep":
			body.lie_now(m.place(), m.front(), m.head_right)
		"grab":
			var st := HSNpcFlow.stand_for(m, body.record, body.ground())
			body.place(Vector3(st["pos"].x, body.ground(), st["pos"].z), float(st["yaw"]))
		"animation":
			if m.loop:
				var clip := m.clip if m.clip_file == "" else body.clip_from(m.clip_file)
				if clip != "":
					body.stand(clip, m.anim_speed, 0.0)
		"disappear":
			body.hide_now()
		"scare":
			body.place(m.place(), m.yaw())
			if not m.scare_stays:
				body.hide_now()
	if m.kind in ["walk", "sit", "sleep", "grab", "appear", "attack", "scare"] or (m.kind == "animation" and not m.loop):
		body.hold_clip = ""
	if m.kind == "walk" and body.LOW.has(m.pace):              # she rests low where a low way of going took her
		body._rest_for(m.pace)
	if m.kind == "scare" and m.scare_stays and m.scare_kind == "claw" and body.has_clip("crawl_idle_loop"):
		body.hold_clip = "crawl_idle_loop"
	if m.head != "keep":
		_head_from(m)
	if m.face != "":
		face.wear(m.face, m.face_amount, 0.01)


# ---- words --------------------------------------------------------------------------------------------------------------------
func _note(text: String) -> void:
	if on_note.is_valid():
		on_note.call(text)


func _note_once(m: Node, text: String) -> void:
	if _noted.get(m) != text:
		_noted[m] = text
		_note(text)


func _problem(text: String) -> void:
	if not (text in problems):
		problems.append(text)
		push_warning("HSNpc (%s): %s" % [npc.name, text])


## what she's doing, in a line (F7)
func status() -> String:
	if dead:
		return "gone for good"
	if down:
		return "shot down"
	var qs := HSNpcFlow.quests(npc)
	var q := (qs[qi] as HSNpcQuest).label() if qi >= 0 and qi < qs.size() else "no quest yet"
	if cur == null or not is_instance_valid(cur):
		return "%s: done%s" % [q, (", waiting for " + waiting_for) if waiting_for != "" else ""]
	var lab := "%s %s" % [HSNpcFlow.label_of(cur), cur.title()]
	match phase:
		"gate":
			return "%s: before %s, waiting for %s" % [q, lab, waiting_for if waiting_for != "" else "nothing"]
		"run":
			return "%s: %s%s" % [q, lab, (", waiting for " + waiting_for) if waiting_for != "" else (" (%s)" % body.now)]
	return "%s: %s, staying%s" % [q, lab, (" (%s)" % waiting_for) if waiting_for != "" else ""]


func report() -> Dictionary:
	return {"quest": qi, "marker": String(cur.name) if cur != null and is_instance_valid(cur) else "", "label": HSNpcFlow.label_of(cur) if cur != null and is_instance_valid(cur) else "",
		"phase": phase, "at": String(at.name) if at != null and is_instance_valid(at) else "", "finished": finished, "talking": talking, "talked": talked,
		"shot": shot, "down": down, "dead": dead, "halted": halted, "waiting_for": waiting_for, "body": body.report(), "status": status(), "problems": problems}
