## GDMOTION3 (tools/godot/motion_check.py v3): animations v3 (docs/ANIMATOR_V3.md) in a by-hand Godot project, headless:
## a character baked by the Animator with the starter's motion.gd under her and the look plugin's HSHeadTrack, HSHandIK
## and HSGrip. What it prints: lines "MOTION ..." and at the end "MOTION result {json}".
## Bone poses are read through BoneAttachment3Ds: a skeleton rolls its modifiers' work back after each frame, and an
## attachment is where it shows.
extends SceneTree

const S := "res://starter/"
const LOOK := "res://addons/horrorstudio_look/"
var main: Node3D
var her: Node3D
var m: Node
var sk: Skeleton3D
var ap: AnimationPlayer
var player: Node3D
var cam: Camera3D
var errors: Array = []
var notes := {}
var only: Array = []
var atts := {}
var evs: Array = []
var dones: Array = []
var hits: Array = []
var ticks := 0


func say(t: String) -> void:
	print("MOTION " + t)


func bad(t: String) -> void:
	errors.append(t)
	print("MOTION !! " + t)


func frames(n: int) -> void:
	for i in n:
		await physics_frame
		ticks += 1


func until(cond: Callable, secs: float) -> bool:
	for i in int(secs * 60.0):
		if cond.call():
			return true
		await physics_frame
		ticks += 1
	return cond.call()


func made(src: String) -> GDScript:
	var s := GDScript.new()
	s.source_code = src
	s.reload()
	return s


# a bone as it is after the modifiers: an attachment on it
func att(nm: String, of: Skeleton3D = null) -> BoneAttachment3D:
	var s := of if of != null else sk
	var key := "%d/%s" % [s.get_instance_id(), nm]
	if not atts.has(key):
		var a := BoneAttachment3D.new()
		a.name = "_Probe_" + nm
		s.add_child(a)
		a.bone_name = nm
		atts[key] = a
	return atts[key]


func yaw_in_her(v: Vector3) -> float:                 # a direction in the world, as degrees to her left of the way she faces
	var l := her.global_basis.inverse() * v
	return rad_to_deg(atan2(l.x, l.z))


func place_player(deg: float, dist := 2.5, eye := 1.6) -> void:
	var a := deg_to_rad(deg) + her.global_rotation.y
	player.global_position = her.global_position + Vector3(sin(a), 0, cos(a)) * dist
	cam.position = Vector3(0, eye, 0)


func mark(at: Vector3, yaw := 0.0) -> Marker3D:
	var k := Marker3D.new()
	main.add_child(k)
	k.global_position = at
	k.global_rotation.y = yaw
	return k


func prop(nm: String, mesh: Mesh, at: Vector3, grip := {}) -> MeshInstance3D:
	var p := MeshInstance3D.new()
	p.name = nm
	p.mesh = mesh
	main.add_child(p)
	p.global_position = at
	if not grip.is_empty():
		var g: Node3D = load(LOOK + "grip.gd").new()
		g.name = "Grip"
		p.add_child(g)
		for k in grip:
			g.set(k, grip[k])
	return p


func watch_until(cond: Callable, secs: float, each: Callable) -> bool:
	for i in int(secs * 60.0):
		each.call()
		if cond.call():
			return true
		await physics_frame
	return cond.call()


func reset_her(at := Vector3.ZERO, yaw := 0.0) -> void:
	m.stop()
	m.stance = ""
	her.visible = true
	her.global_position = at
	her.global_rotation.y = yaw
	m.idle()
	evs.clear()
	dones.clear()
	hits.clear()
	await frames(20)


func wants(stage: String) -> bool:
	return only.is_empty() or only.has(stage)


func _initialize() -> void:
	create_timer(900.0).timeout.connect(func() -> void:
		bad("the test never ended")
		print("MOTION result " + JSON.stringify({"errors": errors, "notes": notes}))
		quit())
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--only="):
			only = Array(a.trim_prefix("--only=").split(","))
	main = (load("res://main.tscn") as PackedScene).instantiate() as Node3D
	root.add_child(main)
	await frames(5)
	var ps := load("res://characters/normal_woman.glb") as PackedScene
	if ps == null or not ResourceLoader.exists(LOOK + "hand_ik.gd"):
		bad("the baked character wasn't imported, or the look plugin isn't in the project")
		print("MOTION result " + JSON.stringify({"errors": errors}))
		quit()
		return
	her = ps.instantiate() as Node3D
	her.name = "Her"
	main.add_child(her)
	sk = her.find_children("*", "Skeleton3D", true, false)[0] as Skeleton3D
	ap = her.find_children("*", "AnimationPlayer", true, false)[0] as AnimationPlayer
	m = Node.new()
	m.name = "Motion"
	m.set_script(load(S + "motion.gd"))
	her.add_child(m)
	m.event.connect(func(n: String) -> void: evs.append([n, ticks]))
	m.done.connect(func(w: String) -> void: dones.append(w))
	m.struck.connect(func(t: Node, k: String) -> void: hits.append([String(t.name), k]))
	player = Node3D.new()
	player.name = "Player"
	player.add_to_group("hs_player")
	main.add_child(player)
	cam = Camera3D.new()
	player.add_child(cam)
	cam.current = true
	place_player(0.0)
	await frames(8)
	var rep: Dictionary = m.report()
	var want := ["sneak_loop", "crouch_loop", "crawl_loop", "crawl_idle_loop", "creep_loop", "creep_idle_loop", "scuttle_loop", "peek_out", "peek_loop", "peek_back", "peek_l_loop", "scare_lunge", "scare_claw", "punch", "swing", "hit_react", "eat", "drink", "look_around", "knock", "cower_loop"]
	var lacks := want.filter(func(c): return not (rep["clips"] as Array).has(c))
	if not lacks.is_empty() or int(m.record.get("version", 0)) < 3:
		bad("her bake lacks %s (version %s)" % [lacks, m.record.get("version")])
	say("baked by the Animator's version %s: %d clips, Motion finds them all" % [m.record.get("version"), (rep["clips"] as Array).size()])

	if wants("head"):
		await stage_head()
	if wants("gaits"):
		await stage_gaits()
	if wants("peek"):
		await stage_peek()
	if wants("scare"):
		await stage_scare()
	if wants("grip"):
		await stage_grip()
	if wants("blows"):
		await stage_blows()
	if wants("small"):
		await stage_small()
	if wants("gizmo"):
		await stage_gizmo()

	print("MOTION result " + JSON.stringify({"errors": errors, "notes": notes}))
	quit()


# ---- her head follows you: within its range, letting go past it or holding at its limit, the switch -------------------------
func stage_head() -> void:
	await reset_her()
	var head := att("c_head")
	var chest := att("c_spine3")
	await frames(30)
	var free := yaw_in_her(head.global_basis.z)             # where her idle alone has her looking
	var t: Node = m.head_follow(true, player)
	if t == null:
		bad("head_follow gave nothing: no HSHeadTrack in the project?")
		return
	var facing := func() -> float: return yaw_in_her(head.global_basis.z)
	var bearing := func() -> float: return yaw_in_her(cam.global_position - head.global_position)
	place_player(0.0)
	await frames(50)
	# to one side: followed, never faster than it's allowed, the chest taking its share
	place_player(40.0)
	var fastest := 0.0
	var was: float = facing.call()
	for i in 70:
		await frames(1)
		var now: float = facing.call()
		fastest = maxf(fastest, absf(now - was) * 60.0)
		was = now
	var at40: float = facing.call()
	var b40: float = bearing.call()
	var chest40 := yaw_in_her(chest.global_basis.z)
	if absf(at40 - b40) > 3.0:
		bad("you 40 degrees to her left: her head is turned %.1f, you're at %.1f from it" % [at40, b40])
	if fastest > float(t.turn_speed) + 25.0 or fastest < 40.0:
		bad("her head turned at %.0f degrees a second at the most (never more than %.0f)" % [fastest, t.turn_speed])
	if chest40 < 0.5 * float(t.body_share) * b40 - 2.0 or chest40 > float(t.body_share) * b40 + 5.0:
		bad("her chest's share of a %.0f degree turn: %.1f degrees" % [b40, chest40])
	place_player(-60.0)
	await frames(80)
	var at60: float = facing.call()
	if absf(at60 - float(bearing.call())) > 3.0:
		bad("you 60 degrees to her right: her head is at %.1f" % at60)
	place_player(75.0)
	await frames(80)
	var at75: float = facing.call()
	if absf(at75 - float(bearing.call())) > 3.5:
		bad("you 75 degrees round (inside 80): her head is at %.1f, you're at %.1f" % [at75, bearing.call()])
	# past the range: she lets go; or, asked to, holds at the limit
	place_player(105.0)
	await frames(80)
	var gone: float = facing.call()
	if absf(gone - free) > 5.0 or t.following:
		bad("you 105 degrees round (past 80): her head should be her animation's again (%.1f); it's at %.1f, following %s" % [free, gone, t.following])
	t.beyond = 1
	await frames(80)
	var held: float = facing.call()
	if absf(held - 80.0) > 3.5:
		bad("asked to hold at the limit: her head is at %.1f, not 80" % held)
	t.beyond = 0
	# a narrower range
	t.range_degrees = 60.0
	place_player(40.0)
	await frames(80)
	var narrow: float = facing.call()
	place_player(22.0)
	await frames(80)
	var inside: float = facing.call()
	if absf(narrow - free) > 5.0 or absf(inside - float(bearing.call())) > 3.0:
		bad("a range of 60 degrees: at 40 her head is at %.1f (her animation's is %.1f), at 22 it's at %.1f" % [narrow, free, inside])
	t.range_degrees = 160.0
	# up and down
	place_player(0.0, 1.0, 2.6)
	await frames(70)
	var up := rad_to_deg(asin(clampf(head.global_basis.z.normalized().y, -1.0, 1.0)))
	place_player(0.0, 1.0, 0.5)
	await frames(70)
	var down := rad_to_deg(asin(clampf(head.global_basis.z.normalized().y, -1.0, 1.0)))
	if up < 18.0 or up > float(t.up_degrees) + 4.0 or down > -18.0 or down < -float(t.down_degrees) - 4.0:
		bad("you above and below her: her head tips %.1f up and %.1f down (limits %.0f and %.0f)" % [up, -down, t.up_degrees, t.down_degrees])
	# her eyes lead
	var eye_led := 0.0
	if sk.find_bone("l_eye") >= 0:
		var eye := att("l_eye")
		place_player(0.0)
		await frames(60)
		place_player(35.0)
		await frames(7)
		eye_led = yaw_in_her(eye.global_basis.z) - float(facing.call())
		if eye_led < 3.0:
			bad("her eyes don't lead her head: %.1f degrees ahead of it a tenth of a second after you moved" % eye_led)
	# the switch, and the player found by itself
	place_player(30.0)
	await frames(70)
	m.head_follow(false)
	await frames(50)
	var off: float = facing.call()
	m.head_follow(true)                                     # (no target: the camera in view)
	await frames(70)
	var on: float = facing.call()
	if absf(off - free) > 4.0 or absf(on - float(bearing.call())) > 3.0:
		bad("the switch: off, her head is at %.1f (her animation's %.1f); on again with no target given, %.1f (you're at %.1f)" % [off, free, on, bearing.call()])
	m.head_follow(false)
	notes["head"] = {"at40": at40, "at75": at75, "held": held, "fastest": fastest, "chest40": chest40, "up": up, "down": down, "eyes": eye_led}
	say("her head follows you: at 40 degrees it's turned %.1f, at 75 %.1f, at -60 %.1f; past 80 it lets go (%.1f, her animation's %.1f) or holds at %.1f; her chest takes %.1f of a 40 degree turn; never faster than %.0f degrees a second; up %.0f, down %.0f; her eyes %.0f degrees ahead" % [
		at40, at75, at60, gone, free, held, chest40, fastest, up, -down, eye_led])


# ---- the low gaits: at their own speed, and what she rests in after -------------------------------------------------------------
func stage_gaits() -> void:
	await reset_her()
	var said := []
	var z := 0.0
	for g in ["sneak", "crawl", "creep", "scuttle"]:
		var far := 2.4 if g != "scuttle" else 4.5
		z = far if z < 1.0 else 0.0
		dones.clear()
		m.go_low(Vector3(0, 0, z), g)
		await frames(50)
		var p0 := her.global_position
		await frames(48)
		var v := p0.distance_to(her.global_position) / 0.8
		var made_at: float = m.gait_speed(g)
		if absf(v - made_at) > 0.15 * made_at:
			bad("%s: she goes at %.2f m/s, her %s was made at %.2f" % [g, v, g, made_at])
		if m.now != g:
			bad("%s: she says she's doing '%s'" % [g, m.now])
		await until(func(): return dones.has(g), 25.0)
		await frames(20)
		var rest := String(m.GAITS[g][1])
		if not dones.has(g) or m.stance != rest or ap.current_animation != String(m._names[rest]) or her.global_position.distance_to(Vector3(0, her.global_position.y, z)) > 0.06:
			bad("%s: there and resting in %s? done %s, her stance '%s', playing '%s', %.2f m off" % [g, rest, dones, m.stance, ap.current_animation, her.global_position.distance_to(Vector3(0, 0, z))])
		said.append("%s %.2f m/s (made at %.2f), then %s" % [g, v, made_at, rest])
	dones.clear()
	m.walk_to(Vector3(0.6, 0, 0.6))
	await until(func(): return dones.has("walk"), 12.0)
	await frames(10)
	if m.stance != "" or ap.current_animation != String(m._names["idle_loop"]):
		bad("asked to walk, she stands up again: her stance '%s', playing '%s'" % [m.stance, ap.current_animation])
	m.cower()
	await frames(30)
	var cowering := ap.current_animation == String(m._names["cower_loop"])
	m.rise()
	await frames(30)
	if not cowering or ap.current_animation != String(m._names["idle_loop"]):
		bad("cower and rise: cowering %s, then playing '%s'" % [cowering, ap.current_animation])
	say("the low gaits: %s; asked to walk she stands again; cower and rise" % "; ".join(said))


# ---- a peek past a wall's edge -------------------------------------------------------------------------------------------------
func stage_peek() -> void:
	await reset_her()
	var said := []
	for left in [false, true]:
		var corner := mark(Vector3(3.0, 0, 2.0), deg_to_rad(90.0))
		var head := att("c_head")
		var hand := att("l_wrist" if left else "r_wrist")
		evs.clear()
		dones.clear()
		m.peek(corner, 1.2, left)
		var got := await until(func(): return evs.any(func(e): return e[0] == "out"), 20.0)
		await frames(25)
		var hl := corner.global_transform.affine_inverse() * head.global_position
		var wl := corner.global_transform.affine_inverse() * hand.global_position
		var past := -hl.x if not left else hl.x             # (to her right the edge is at her right: past it is the corner's -x)
		if not got or past < 0.02:
			bad("peeking %s: her head is %.1f cm past the wall's edge (leant out %s)" % ["left" if left else "right", past * 100.0, got])
		if Vector2(wl.x, wl.z).length() > 0.16 or wl.y < 1.0:
			bad("peeking: her hand is %.1f cm from the edge, %.2f m up" % [Vector2(wl.x, wl.z).length() * 100.0, wl.y])
		await until(func(): return dones.has("peek"), 12.0)
		await frames(15)
		var back := corner.global_transform.affine_inverse() * head.global_position
		if not dones.has("peek") or (-back.x if not left else back.x) > -0.12 or not evs.any(func(e): return e[0] == "hidden"):
			bad("peeking: drawn back? done %s, her head %.1f cm behind the edge" % [dones, (back.x if not left else -back.x) * 100.0])
		said.append("to her %s her head %.0f cm past the edge, her hand %.0f cm from it; back %.0f cm behind it" % ["left" if left else "right", past * 100.0, Vector2(wl.x, wl.z).length() * 100.0, absf(back.x) * 100.0])
		corner.queue_free()
		await reset_her()
	say("a peek: " + "; ".join(said))


# ---- a scare: thrown at once toward someone, shown, hidden ---------------------------------------------------------------------
func stage_scare() -> void:
	await reset_her()
	player.global_position = Vector3(2.0, 0, -2.0)
	var info: Dictionary = m.scare_info("lunge")
	var hand := att("r_wrist")
	m.scare("lunge", player, true)
	var t0 := ticks
	await frames(2)
	var to := player.global_position - her.global_position
	var turned := absf(angle_difference(her.global_rotation.y, atan2(to.x, to.z)))
	var coiled := ap.current_animation == String(m._names["scare_lunge"])
	await until(func(): return evs.any(func(e): return e[0] == "peak"), 4.0)
	var peak_at := (ticks - t0) / 60.0
	var shown := her.visible
	await frames(2)
	var out := (her.global_transform.affine_inverse() * hand.global_position).z
	await until(func(): return not her.visible, 4.0)
	var gone_at := (ticks - t0) / 60.0
	await until(func(): return dones.has("scare"), 4.0)
	if turned > 0.03 or not coiled:
		bad("a scare toward you: she's %.1f degrees off you two frames in, playing '%s'" % [rad_to_deg(turned), ap.current_animation])
	if absf(peak_at - float(info.get("peak", 0))) > 0.08 or not shown or absf(gone_at - float(info.get("show", 0))) > 0.1 or her.visible or not dones.has("scare"):
		bad("the lunge: its peak at %.2f s (the record says %.2f), hidden at %.2f (%.2f), still shown %s, done %s" % [peak_at, info.get("peak", 0), gone_at, info.get("show", 0), her.visible, dones])
	if out < 0.6 * float(info.get("reach", 1.0)):
		bad("the lunge: her hand %.2f m out in front at the peak (the record says her hands reach %.2f)" % [out, info.get("reach", 0)])
	await reset_her()
	m.scare("claw")
	await until(func(): return dones.has("scare"), 6.0)
	await frames(10)
	if m.stance != "crawl_idle_loop" or ap.current_animation != String(m._names["crawl_idle_loop"]):
		bad("the claw leaves her on all fours: her stance '%s', playing '%s'" % [m.stance, ap.current_animation])
	m.rise()
	say("a scare: turned to you at once and already coiled; the lunge's peak at %.2f s, her hand %.2f m out; hidden at %.2f s; the claw leaves her on all fours" % [peak_at, out, gone_at])


# ---- a thing in her hand by its grip, her fingers round it; drinking and eating ---------------------------------------------------
func axis_gap(p: Vector3, g: Transform3D, r: float) -> float:        # how far a point is off a handle's surface (the handle along the grip's +Y)
	var d := p - g.origin
	var y := g.basis.y.normalized()
	return (d - y * d.dot(y)).length() - r


func stage_grip() -> void:
	await reset_her()
	var ik: Node = m.hand_ik()
	if ik == null:
		bad("no HSHandIK")
		return
	var wrist := att("r_wrist")
	for f in ["index", "middle", "ring", "pinky"]:          # (the probes first: an attachment made now shows its bone as it is only from the next frame)
		for k in ["2", "3", "_null"]:
			att("r_%s%s" % [f, k])
	await frames(3)
	var bottle_mesh := CylinderMesh.new()
	bottle_mesh.top_radius = 0.0325
	bottle_mesh.bottom_radius = 0.0325
	bottle_mesh.height = 0.2
	var bat_mesh := CylinderMesh.new()
	bat_mesh.top_radius = 0.0175
	bat_mesh.bottom_radius = 0.0175
	bat_mesh.height = 0.7
	var said := []
	var tip_gap := {}
	var things := {}
	for item in [["Bottle", bottle_mesh, Vector3(1.6, 0.95, 1.2), {"size": 0.065, "length": 0.14, "use": 2, "mouth": Vector3(0, 0.1, 0)}, 0.0325],
			["Bat", bat_mesh, Vector3(-1.6, 0.35, 1.2), {"position": Vector3(0, -0.2, 0), "size": 0.035, "length": 0.2, "tip": Vector3(0, 0.5, 0)}, 0.0175]]:
		var thing := prop(item[0], item[1], item[2], item[3])
		things[item[0]] = thing
		var grip := thing.get_node("Grip") as Node3D
		var r: float = item[4]
		dones.clear()
		evs.clear()
		m.pick_up(thing, true)
		await until(func(): return evs.any(func(e): return e[0] == "grab"), 20.0)
		var reached: float = ik.last["r"]["error"] if ik.last.has("r") else 9.0
		await until(func(): return dones.has("pick_up"), 10.0)
		await frames(20)
		var frame: Transform3D = wrist.global_transform * (ik.grip_frame("r", grip.size, "handle") as Transform3D)
		var off := frame.origin.distance_to(grip.global_position)
		var along := frame.basis.y.normalized().dot(grip.global_basis.y.normalized())
		var palm := frame.basis.z.normalized().dot(grip.global_basis.z.normalized())
		if m.held() != thing or float(ik.gripping("r")) < 0.95:
			bad("%s: in her hand? she holds %s, her hand closed %.2f" % [item[0], m.held(), ik.gripping("r")])
		if reached > 0.025:
			bad("%s: her hand closed %.1f cm from where it's taken" % [item[0], reached * 100.0])
		if off > 0.012 or along < 0.985 or palm < 0.985:
			bad("%s: held by its grip? its grip %.1f cm from her hand's, the handle %.3f along her knuckles, its palm side %.3f to her palm" % [item[0], off * 100.0, along, palm])
		var gaps := []
		for f in ["index", "middle", "ring", "pinky"]:
			gaps.append(axis_gap(att("r_%s_null" % f).global_position, grip.global_transform, r))
			for k in [2, 3]:                                # no joint of a finger inside the handle
				var gk := axis_gap(att("r_%s%d" % [f, k]).global_position, grip.global_transform, r)
				if gk < -0.004:
					bad("%s: her %s finger's joint %d is %.1f mm inside it" % [item[0], f, k, -gk * 1000.0])
		if gaps.min() < -0.005 or gaps.max() > 0.02:
			bad("%s: her fingertips are %.1f to %.1f mm off its surface" % [item[0], gaps.min() * 1000.0, gaps.max() * 1000.0])
		tip_gap[item[0]] = att("r_index_null").global_position.distance_to(wrist.global_transform * (ik.palm_point("r") as Vector3))
		said.append("%s (%.1f cm thick): her hand closed %.1f cm from its grip, held %.1f mm from her hand's, fingertips %.0f to %.0f mm off it" % [item[0], grip.size * 100.0, reached * 100.0, off * 1000.0, gaps.min() * 1000.0, gaps.max() * 1000.0])
		if item[0] == "Bottle":
			# drinking: its mouth at hers, tipped toward her
			evs.clear()
			dones.clear()
			m.drink()
			await until(func(): return evs.any(func(e): return e[0] == "sip"), 6.0)
			await frames(27)
			var err: float = ik.last["r"]["error"] if ik.last.has("r") else 9.0
			var lips: Vector3 = ik.last["r"]["target"] if ik.last.has("r") else Vector3.INF
			var rim := thing.global_transform * Vector3(0, 0.1, 0)
			var tipped := rad_to_deg(thing.global_basis.y.normalized().angle_to(Vector3.UP))
			var mouth_h := (lips.y - her.global_position.y) if lips != Vector3.INF else 0.0
			if err > 0.02 or rim.distance_to(lips) > 0.03 or tipped < 30.0 or tipped > 80.0 or mouth_h < 1.3 or mouth_h > 1.55:
				bad("drinking: the bottle's rim %.1f cm from her lips (the IK says %.1f), tipped %.0f degrees, her mouth %.2f m up" % [rim.distance_to(lips) * 100.0, err * 100.0, tipped, mouth_h])
			await until(func(): return dones.has("drink"), 8.0)
			if m.held() != thing or not thing.visible:
				bad("after a drink it's still in her hand: she holds %s" % m.held())
			said.append("drinking: its rim %.1f cm from her lips, tipped %.0f degrees" % [rim.distance_to(lips) * 100.0, tipped])
			m.drop()
			await frames(25)
			if m.held() != null or float(ik.gripping("r")) > 0.05 or thing.get_parent() != main:
				bad("dropped: she holds %s, her hand closed %.2f" % [m.held(), ik.gripping("r")])
			await reset_her()
	if tip_gap["Bat"] > tip_gap["Bottle"] - 0.015:
		bad("her hand closes further round a thin handle: her fingertip %.1f cm from her palm round the bat, %.1f round the bottle" % [tip_gap["Bat"] * 100.0, tip_gap["Bottle"] * 100.0])
	notes["bat"] = true
	# a swing of the bat onto someone lower than her shoulder
	var dummy := Node3D.new()
	dummy.name = "Dummy"
	dummy.set_script(made("extends Node3D\nvar h := 1.0\nvar got := []\nfunc aim_point() -> Vector3:\n\treturn global_position + Vector3(0, h, 0)\nfunc struck(by, kind) -> void:\n\tgot.append(kind)\n"))
	main.add_child(dummy)
	dummy.global_position = her.global_position + Vector3(0.4, 0, 2.6)
	evs.clear()
	hits.clear()
	dones.clear()
	m.swing(dummy)
	await until(func(): return evs.any(func(e): return e[0] == "hit"), 20.0)
	await frames(1)
	var bat: Node3D = things["Bat"]
	var end := bat.global_transform * Vector3(0, 0.3, 0)
	var miss := end.distance_to(dummy.aim_point())
	# how much of that was the swing's own and how much the hand IK's: the hand carried and the bat turned to get it there
	# (it once got there with her hand dragged half a metre down to her hip and the bat turned 50 degrees: the clip's wrong then)
	var carried: float = float(ik.last["r"].get("moved", 9.0)) if ik.last.has("r") else 9.0
	var turned_by: float = rad_to_deg(float(ik.last["r"].get("turned", 9.0))) if ik.last.has("r") else 999.0
	var hand_up: float = wrist.global_position.y - her.global_position.y
	await until(func(): return dones.has("swing"), 8.0)
	if miss > 0.1 or hits != [["Dummy", "swing"]] or dummy.got != ["swing"]:
		bad("a swing of the bat: its end %.1f cm from them as it lands, struck %s, they were told %s" % [miss * 100.0, hits, dummy.got])
	if carried > 0.25 or turned_by > 45.0 or hand_up < 0.85:                    # (this one is 30 cm under where the swing lands by itself: a turn of some 36 degrees)
		bad("a swing of the bat lands by the swing, not by the hand IK: her hand carried %.0f cm and the bat turned %.0f degrees to get there, her hand %.2f m up as it lands" % [carried * 100.0, turned_by, hand_up])
	said.append("a swing of the bat: its end %.1f cm from who it's swung at as it lands, her hand %.2f m up, carried %.0f cm and the bat turned %.0f degrees by the hand IK" % [miss * 100.0, hand_up, carried * 100.0, turned_by])
	m.drop()
	dummy.queue_free()
	# eating: a thing with a grip for the whole hand, taken, bitten twice, gone
	await reset_her()
	var ball := SphereMesh.new()
	ball.radius = 0.035
	ball.height = 0.07
	var apple := prop("Apple", ball, Vector3(1.2, 0.9, -1.4), {"shape": 1, "size": 0.07, "use": 1, "mouth": Vector3(0, 0, -0.035)})
	evs.clear()
	dones.clear()
	m.eat(apple)
	var bites := []
	for i in 2:
		var n0 := i + 1
		await until(func(): return evs.filter(func(e): return e[0] == "bite").size() >= n0, 30.0)
		await frames(2)
		bites.append((apple.global_transform * Vector3(0, 0, -0.035)).distance_to(ik.mouth()) if ik.last.has("r") else 9.0)
		if ik.last.has("r"):
			bites[-1] = (apple.global_transform * Vector3(0, 0, -0.035)).distance_to(ik.last["r"]["target"])
	await until(func(): return dones.has("eat"), 10.0)
	await frames(20)
	if bites.size() < 2 or bites.max() > 0.03 or apple.visible or m.held() != null or float(ik.gripping("r")) > 0.05:
		bad("eating: the apple's bitten side %s cm from her lips at each bite; after, shown %s, she holds %s, her hand closed %.2f" % [bites.map(func(b): return snappedf(b * 100.0, 0.1)), apple.visible, m.held(), ik.gripping("r")])
	said.append("eating an apple: its bitten side %.1f and %.1f cm from her lips, then it's gone" % [bites[0] * 100.0, bites[1] * 100.0])
	# a thing with no grip: held by a guess from its size
	await reset_her()
	var box := BoxMesh.new()
	box.size = Vector3(0.03, 0.4, 0.03)
	var stick := prop("Stick", box, Vector3(-1.2, 0.9, -1.4))
	var guess: Dictionary = load(LOOK + "grip.gd").grip_of(stick)
	dones.clear()
	m.pick_up(stick, true)
	await until(func(): return dones.has("pick_up"), 25.0)
	await frames(15)
	var sy := stick.global_basis.y.normalized().dot((wrist.global_transform * (ik.grip_frame("r", 0.03, "handle") as Transform3D)).basis.y.normalized())
	if not guess["guessed"] or guess["shape"] != "handle" or absf(float(guess["size"]) - 0.03) > 0.002 or m.held() != stick or absf(sy) < 0.98:
		bad("a thing with no grip: guessed %s; held %s, its length %.3f along her knuckles" % [guess, m.held(), sy])
	m.drop()
	say("a thing in her hand: " + "; ".join(said) + "; a stick with no grip held by its length")


# ---- a punch carried onto who it's thrown at ---------------------------------------------------------------------------------------
func stage_blows() -> void:
	await reset_her()
	var ik: Node = m.hand_ik()
	var wrist := att("r_wrist")
	var dummy := Node3D.new()
	dummy.name = "Dummy"
	dummy.set_script(made("extends Node3D\nvar h := 1.05\nvar got := []\nfunc aim_point() -> Vector3:\n\treturn global_position + Vector3(0, h, 0)\nfunc struck(by, kind) -> void:\n\tgot.append(kind)\n"))
	main.add_child(dummy)
	var said := []
	var fist := func() -> Vector3: return wrist.global_transform * (ik.knuckles("r") as Vector3)
	for h in [1.05, 1.55]:
		await reset_her()
		dummy.set("h", h)
		dummy.global_position = Vector3(0.8, 0, 2.6)
		dummy.got.clear()
		m.punch(dummy)
		await until(func(): return evs.any(func(e): return e[0] == "hit"), 20.0)
		await frames(1)
		var miss: float = (fist.call() as Vector3).distance_to(dummy.aim_point())
		await until(func(): return dones.has("punch"), 8.0)
		if miss > 0.06 or hits != [["Dummy", "punch"]] or dummy.got != ["punch"]:
			bad("a punch at someone %.2f m up: her fist %.1f cm from them as it lands, struck %s, they were told %s" % [h, miss * 100.0, hits, dummy.got])
		said.append("at %.2f m up her fist lands %.1f cm from them" % [h, miss * 100.0])
	# someone who moves as it's thrown: she turns with them
	await reset_her()
	dummy.set("h", 1.25)
	var reach := float(m.clip_info("punch").get("punch", {}).get("reach", 0.7))
	dummy.global_position = Vector3(0, 0, reach)
	dummy.got.clear()
	m.punch(dummy, false, false)
	await frames(12)
	dummy.global_position += Vector3(0.3, 0, 0)
	await until(func(): return evs.any(func(e): return e[0] == "hit"), 6.0)
	await frames(1)
	var moved: float = (fist.call() as Vector3).distance_to(dummy.aim_point())
	var to := dummy.global_position - her.global_position
	var faced := rad_to_deg(absf(angle_difference(her.global_rotation.y, atan2(to.x, to.z))))
	await until(func(): return dones.has("punch"), 8.0)
	if moved > 0.08 or faced > 8.0 or dummy.got != ["punch"]:
		bad("someone who stepped 30 cm aside as it was thrown: her fist %.1f cm from them, she's turned %.1f degrees off them, told %s" % [moved * 100.0, faced, dummy.got])
	# out of reach, not walked up to: it doesn't land
	await reset_her()
	dummy.global_position = Vector3(0, 0, 2.2)
	dummy.got.clear()
	m.punch(dummy, false, false)
	await until(func(): return dones.has("punch"), 10.0)
	if not hits.is_empty() or not dummy.got.is_empty():
		bad("a punch at someone 2.2 m off, not walked up to, landed: %s" % [hits])
	# nearer than her blow reaches (they've walked right up to her): thrown from where she stands, her back never turned on them
	await reset_her()
	dummy.set("h", 1.25)
	dummy.global_position = Vector3(0, 0, 0.5)
	dummy.got.clear()
	var turned_most := [0.0]
	var from0 := her.global_position
	m.punch(dummy)
	await watch_until(func(): return dones.has("punch"), 10.0, func(): turned_most[0] = maxf(turned_most[0], rad_to_deg(absf(angle_difference(her.global_rotation.y, 0.0)))))
	var stepped: float = Vector2(her.global_position.x - from0.x, her.global_position.z - from0.z).length()
	if dummy.got != ["punch"] or turned_most[0] > 20.0 or stepped > 0.08:
		bad("a punch at someone 0.5 m in front of her: told %s; she turned %.0f degrees away at the most and stepped %.2f m (she should throw it from where she stands)" % [dummy.got, turned_most[0], stepped])
	said.append("at someone 0.5 m in front of her she throws it from where she stands (turned %.0f degrees at the most)" % turned_most[0])
	# at you: it stops short of your eye
	await reset_her()
	place_player(20.0, 2.4)
	m.punch(player)
	await until(func(): return evs.any(func(e): return e[0] == "hit"), 20.0)
	await frames(1)
	var short: float = (fist.call() as Vector3).distance_to(cam.global_position)
	await until(func(): return dones.has("punch"), 8.0)
	if short < 0.08 or short > 0.4 or hits != [["Player", "punch"]]:
		bad("a punch at you: her fist stops %.1f cm from your eye, struck %s" % [short * 100.0, hits])
	# someone with a Motion node of their own reels
	await reset_her()
	var other := (load("res://characters/normal_woman.glb") as PackedScene).instantiate() as Node3D
	other.name = "Other"
	main.add_child(other)
	other.global_position = Vector3(-0.5, 0, 2.4)
	var om := Node.new()
	om.name = "Motion"
	om.set_script(load(S + "motion.gd"))
	other.add_child(om)
	await frames(10)
	m.punch(other)
	await until(func(): return evs.any(func(e): return e[0] == "hit"), 20.0)
	await frames(8)
	var reels: bool = om.now == "hit_react"
	var chest_miss: float = (fist.call() as Vector3).distance_to(m.aim_point(other))
	await until(func(): return dones.has("punch"), 8.0)
	if not reels or hits != [["Other", "punch"]]:
		bad("a punch at someone with a Motion node: they're doing '%s', struck %s" % [om.now, hits])
	# what the hunt's moves find on her
	var mv := Node.new()
	mv.name = "Moves"
	mv.set_script(load(S + "moves.gd"))
	other.add_child(mv)
	await frames(20)
	var found := {}
	for role in ["stalk", "crawl", "peek", "lunge", "search"]:
		found[role] = String((mv.clips.get(role, {}) as Dictionary).get("name", ""))
	if not found["stalk"].begins_with("creep") or not found["crawl"].begins_with("crawl") or not found["peek"].begins_with("peek") or found["lunge"] != "scare_lunge" or found["search"] != "look_around":
		bad("moves.gd on her own clips: %s" % [found])
	other.queue_free()
	dummy.queue_free()
	# the starter's own player, told a blow landed: its view knocked aside and settled again, a scare heard, `hit` said
	var knocked := "no starter player in the project"
	if ResourceLoader.exists(S + "player.tscn"):
		var sp := (load(S + "player.tscn") as PackedScene).instantiate() as Node3D
		main.add_child(sp)
		sp.global_position = Vector3(20, 0, 20)
		var told := []
		var ears := Node.new()
		ears.set_script(made("extends Node\nvar got := []\nfunc scared(who) -> void:\n\tgot.append(who)\n"))
		ears.add_to_group("hs_scare")
		main.add_child(ears)
		sp.connect("hit", func(by: Node, kind: String) -> void: told.append([by, kind]))
		await frames(3)
		sp.call("struck", her, "punch")
		await frames(2)
		var eye_node := sp.get_node("Eye") as Camera3D
		var roll0: float = absf(eye_node.rotation.z)
		await frames(40)
		var roll1: float = absf(eye_node.rotation.z)
		var got: Array = ears.get("got")
		if told != [[her, "punch"]] or got != [her] or roll0 < 0.04 or roll1 > 0.001:
			bad("the starter's player told a blow landed: hit said %d times, a scare heard %d, its view rolled %.1f degrees and %.2f after 0.7 s" % [told.size(), got.size(), rad_to_deg(roll0), rad_to_deg(roll1)])
		knocked = "its view knocked %.0f degrees aside and level again in 0.7 s, a scare heard" % rad_to_deg(roll0)
		sp.queue_free()
		ears.queue_free()
	say("a punch: %s; stepped aside as it's thrown, %.1f cm (she turned with them); out of reach it doesn't land; at you it stops %.0f cm short of your eye; someone with a Motion node reels; the starter's player: %s; the hunt's moves find her creep, crawl, peek and lunge" % ["; ".join(said), moved * 100.0, short * 100.0, knocked])


# ---- a knock, looking round, the acts -------------------------------------------------------------------------------------------------
func stage_small() -> void:
	await reset_her()
	var ik: Node = m.hand_ik()
	var wrist := att("r_wrist")
	var spot := Vector3(-2.5, 1.14, 1.5)
	m.knock(spot)
	var offs := []
	for i in 3:
		var n0 := i + 1
		await until(func(): return evs.filter(func(e): return e[0] == "knock").size() >= n0, 20.0)
		await frames(1)
		offs.append((wrist.global_transform * (ik.knuckles("r") as Vector3)).distance_to(spot))
		if i == 0:
			await frames(8)
			offs.append(-(wrist.global_transform * (ik.knuckles("r") as Vector3)).distance_to(spot))     # (between raps: drawn back)
	await until(func(): return dones.has("knock"), 8.0)
	var on_it := [offs[0], offs[2], offs[3]]
	if on_it.max() > 0.035 or -float(offs[1]) < 0.015 or not dones.has("knock"):
		bad("a knock on a spot 1.14 m up: her knuckles %s cm from it at each rap, %.1f cm back between" % [on_it.map(func(o): return snappedf(o * 100.0, 0.1)), -float(offs[1]) * 100.0])
	await reset_her()
	var head := att("c_head")
	m.look_around()
	var most := [0.0, 0.0]
	for i in 300:
		await frames(1)
		var y := yaw_in_her(head.global_basis.z)
		most = [maxf(most[0], y), minf(most[1], y)]
		if dones.has("look"):
			break
	if most[0] < 40.0 or most[1] > -40.0:
		bad("looking round: her head goes %.0f and %.0f degrees" % most)
	# an act by the Story's words: sneak somewhere, then her head follows
	await reset_her()
	var spot2 := mark(Vector3(0, 0, 2.0))
	var act := Node.new()
	act.name = "Sneak"
	act.set_script(load(S + "act.gd"))
	act.set("act", "sneak_to")
	her.add_child(act)
	act.set("target", act.get_path_to(spot2))
	var ended := [false]
	act.finished.connect(func() -> void: ended[0] = true)
	await frames(3)
	act.fire()
	await until(func(): return ended[0], 20.0)
	var act2 := Node.new()
	act2.set_script(load(S + "act.gd"))
	act2.set("act", "head_follow")
	her.add_child(act2)
	await frames(2)
	act2.fire()
	await frames(10)
	var tr: Node = load(LOOK + "head_track.gd").of(her)
	if not ended[0] or m.stance != "crouch_loop" or her.global_position.distance_to(spot2.global_position) > 0.08 or tr == null or not tr.follow:
		bad("acts: sneak_to ended %s (her stance '%s', %.2f m off), head_follow on %s" % [ended[0], m.stance, her.global_position.distance_to(spot2.global_position), tr != null and tr.follow])
	m.head_follow(false)
	say("a knock on a spot 1.14 m up: her knuckles %.1f, %.1f and %.1f cm from it, %.1f cm back between; looking round %.0f and %.0f degrees; acts: sneak_to and head_follow by act.gd" % [on_it[0] * 100.0, on_it[1] * 100.0, on_it[2] * 100.0, -float(offs[1]) * 100.0, most[0], most[1]])


# ---- the grip's gizmo: what its handles do (the same sums the editor calls) ---------------------------------------------------------
func stage_gizmo() -> void:
	var gz: GDScript = load(LOOK + "grip_gizmo.gd")
	var g: Node3D = load(LOOK + "grip.gd").new()
	main.add_child(g)
	g.global_position = Vector3(5, 1, 5)
	g.global_rotation = Vector3(0.3, 0.8, -0.2)
	var c := Camera3D.new()
	main.add_child(c)
	c.global_position = Vector3(5.5, 1.3, 5.9)
	c.look_at(g.global_position)
	c.current = true
	await frames(3)
	var pts: PackedVector3Array = gz.handle_points(g)
	var drag := func(id: int, to_local: Vector3):
		return gz.dragged(g, id, c, c.unproject_position(g.global_transform * to_local))
	var thick: float = drag.call(0, Vector3(0, -g.length * 0.3, -0.05))
	var length: float = drag.call(1, Vector3(0, 0.2, 0))
	var mouth: Vector3 = drag.call(2, g.mouth + (g.global_transform.affine_inverse().basis * c.global_basis.x) * 0.04)
	var lines: PackedVector3Array = gz.hand_lines(g, 1.0)
	g.size = 0.012
	var thin: PackedVector3Array = gz.hand_lines(g, 1.0)
	var tip_of := func(l: PackedVector3Array) -> Vector3: return l[5]          # the end of the first finger's last bone
	if pts.size() != 4 or absf(thick - 0.1) > 0.006 or absf(length - 0.4) > 0.01 or mouth.distance_to(Vector3(0, 0.08, 0)) < 0.03 or mouth.distance_to(Vector3(0, 0.08, 0)) > 0.05:
		bad("the grip's handles: thickness dragged to 5 cm out gives %.3f m, length to 20 cm gives %.3f, the mouth moved %.1f cm" % [thick, length, mouth.distance_to(Vector3(0, 0.08, 0)) * 100.0])
	if lines.size() < 30 or (tip_of.call(thin) as Vector3).length() > (tip_of.call(lines) as Vector3).length() - 0.004:
		bad("the hand drawn round the handle closes further round a thin one: its fingertip %.1f cm from the handle's middle at 1.2 cm thick, %.1f at 3.5" % [(tip_of.call(thin) as Vector3).length() * 100.0, (tip_of.call(lines) as Vector3).length() * 100.0])
	cam.current = true
	c.queue_free()
	g.queue_free()
	say("the grip's gizmo: thickness dragged to %.1f cm, length to %.0f cm, the mouth 4 cm across the view; the hand drawn closes further round a thin handle" % [thick * 100.0, length * 100.0])
