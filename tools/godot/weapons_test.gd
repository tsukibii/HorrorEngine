## WEAPONS's playthrough (tools/godot/weapons_check.py): the weapons plugin's shotgun, the double barrel (HSDoubleBarrel,
## DECISIONS 2026-11-09, latest: "I don't want the single barrel shotgun, only the double barrel one"), under the
## starter's player's eye in the hotel corridor, played headless (--fixed-fps 60). Only its barrels in the view, drawn
## as a view model (no shadow, z-clipped), the flashlight carried under them; a shot at a dummy (the pellets in the right
## barrel's cone, every one a hole, the dummy told, the noise heard, the ears ringing, the kick), the right barrel then
## the left then a click, aimed and under a 4:3 tape, a crate pushed, never three flashes in a second; the reload (up
## into the view, broken open with the chambers in it, the hulls flicked out onto the floor, a shell popped into each
## chamber, shut), one barrel's reload, a full gun looked into, one shell for two, a reload stopped by a shot; the keys
## (left click, R, Q); something that reacts to being shot, a lamp shot out, the shells' row, running, a wall in front
## and beside you; the muzzle (a star of wings of intersecting spheres, burnt; its trail); what a 12-gauge leaves on a
## wall at an arm's length, across a room and down a corridor, and on concrete (docs/research/shotgun_damage.md); the
## explosive shell in the right barrel and its blast; things that break when they're shot (HSBlowUp); someone who bleeds
## black ichor and goes into smoke (HSHitReact); lowered and raised, the box of shells taken with E, and the gun itself
## picked up and drawn into view. Prints `WEAPONS <what> <how>` lines and `WEAPONS result {errors}`, quits.
extends SceneTree

var errors: Array = []
var main: Node3D
var player: CharacterBody3D
var eye: Camera3D
var gun: Node3D
var cfg: Dictionary


func say(what: String, how: String) -> void:
	print("WEAPONS %s %s" % [what, how])


func bad(e: String) -> void:
	errors.append(e)
	print("WEAPONS ERROR %s" % e)


# the marks shots have left in the world (HSImpacts)
func marks() -> int:
	var im := get_first_node_in_group("hs_impacts")
	return (im.get("marks") as Array).size() if im != null else 0


func impacts() -> Node:
	return get_first_node_in_group("hs_impacts")


func frames(n: int) -> void:
	for i in n:
		await physics_frame


func secs(t: float) -> void:
	await frames(int(ceil(t * 60.0)))


## wait up to `t` seconds for `cond` to hold; whether it did
func until(cond: Callable, t: float) -> bool:
	for i in int(ceil(t * 60.0)):
		if cond.call():
			return true
		await physics_frame
	return cond.call()


func look(p: Vector3) -> void:
	var d := p - player.global_position
	player.rotation = Vector3(0, atan2(-d.x, -d.z), 0)
	var e := p - eye.global_position
	var pt := atan2(e.y, Vector2(e.x, e.z).length())
	player.set("pitch", pt)
	eye.rotation = Vector3(pt, 0, 0)


func click() -> void:
	var e := InputEventMouseButton.new()
	e.button_index = MOUSE_BUTTON_LEFT
	e.pressed = true
	Input.parse_input_event(e)
	await frames(2)
	var u := InputEventMouseButton.new()
	u.button_index = MOUSE_BUTTON_LEFT
	u.pressed = false
	Input.parse_input_event(u)
	await frames(2)


func press(code: int) -> void:
	var e := InputEventKey.new()
	e.physical_keycode = code as Key
	e.keycode = code as Key
	e.pressed = true
	Input.parse_input_event(e)
	await frames(2)
	var u := e.duplicate() as InputEventKey
	u.pressed = false
	Input.parse_input_event(u)
	await frames(2)


## where a point in the eye's space falls on a 16:9 picture, 0..1 from the top left (headless has no window to ask)
func on_screen(p: Vector3) -> Vector2:
	var t := tan(deg_to_rad(eye.fov) / 2.0)
	return Vector2(0.5 + p.x / -p.z / (2.0 * t * 16.0 / 9.0), 0.5 - p.y / -p.z / (2.0 * t))


func made(src: String) -> GDScript:
	var s := GDScript.new()
	s.source_code = src
	s.reload()
	return s


func g(prop: String):
	return gun.get(prop)


func sock(nm: String) -> Node3D:
	return (gun.get("_sock") as Dictionary).get(nm) as Node3D


func scr(nm: String) -> Vector2:
	return on_screen(eye.to_local(sock(nm).global_position))


## both chambers loaded again (a script setting `loaded`: the double's chambers follow it once it isn't busy)
func fill(n := 2) -> void:
	await until(func() -> bool: return not g("busy"), 4.0)
	gun.set("loaded", n)
	await frames(3)


## a shot's pattern: how wide its pellets landed (twice the farthest from their middle) and the widest pellet's angle
## off the way the eye looked
func pattern(hits: Array, from: Vector3, fwd: Vector3) -> Vector2:
	var mid := Vector3.ZERO
	for h in hits:
		mid += (h["point"] as Vector3) / float(maxi(hits.size(), 1))
	var across := 0.0
	var widest := 0.0
	for h in hits:
		across = maxf(across, 2.0 * (h["point"] as Vector3).distance_to(mid))
		widest = maxf(widest, rad_to_deg(((h["point"] as Vector3) - from).angle_to(fwd)))
	return Vector2(across, widest)


## a step that never comes back (a script error stops a coroutine where it is): what's known so far, then out
func _watchdog() -> void:
	bad("the playthrough stopped before the end (a script error above?)")
	print("WEAPONS result " + JSON.stringify({"errors": errors}))
	quit()


func _initialize() -> void:
	create_timer(400.0).timeout.connect(_watchdog)
	cfg = JSON.parse_string(FileAccess.get_file_as_string("res://weapons.json"))
	root.size = Vector2i(1600, 900)
	var ms := load("res://main.tscn") as PackedScene
	if ms == null:
		bad("main.tscn doesn't load")
		print("WEAPONS result " + JSON.stringify({"errors": errors}))
		quit()
		return
	main = ms.instantiate() as Node3D
	root.add_child(main)
	await frames(10)
	player = main.get_node("Player") as CharacterBody3D
	eye = player.get_node("Eye") as Camera3D
	gun = player.get_node("Eye/Shotgun") as Node3D
	var fl := float(cfg["floor"])
	var fear := main.get_node("Fear")
	var torch := player.get_node("Eye/Flashlight") as Node3D
	if gun == null or not (gun is HSDoubleBarrel) or g("_barrels") == null or g("_lever") == null or g("_trigger") == null or g("_trigger2") == null:
		bad("the gun isn't the double or its parts (barrels, lever, triggers) weren't found: the glb's propgen_part extras")
		print("WEAPONS result " + JSON.stringify({"errors": errors}))
		quit()
		return
	var listener := Node.new()
	listener.set_script(made("extends Node\nvar got: Array = []\nfunc _ready() -> void:\n\tadd_to_group(\"hs_listener\")\nfunc heard(at: Vector3, loud: float) -> void:\n\tgot.append([at, loud])\n"))
	main.add_child(listener)
	var fired_n := [0]
	var shell_log: Array = []
	var empties := [0]
	var opens := [0]
	var shuts := [0]
	var t_now := [0.0]
	process_frame.connect(func() -> void: t_now[0] += 1.0 / 60.0)
	gun.fired.connect(func(_h: Array) -> void: fired_n[0] += 1)
	gun.shell_in.connect(func(n: int) -> void: shell_log.append(n))
	gun.empty.connect(func() -> void: empties[0] += 1)
	gun.broke_open.connect(func() -> void: opens[0] += 1)
	gun.closed.connect(func() -> void: shuts[0] += 1)

	# 1. held low: only its barrels in the view (the muzzles toward its middle, the breech and the hinge under it, the
	# butt behind the eye), their line meeting the view's middle aim_at_m ahead; drawn as a view model; the flashlight
	# carried under the barrels with its beam on the view's middle, its tremor still showing
	look(eye.global_position + Vector3(-1, 0, 0))
	await frames(30)
	var mr := scr("muzzle_r")
	var ml := scr("muzzle_l")
	var br := scr("breech")
	var bh := eye.to_local(sock("breech").global_position)
	var hg := scr("hinge")
	var butt := eye.to_local(sock("shoulder").global_position)
	var c := eye.to_local(sock("chamber").global_position)
	var m := eye.to_local(sock("muzzle").global_position)
	var bore := (m - c).normalized()
	var aim := float(g("aim_at_m"))
	var meet := c + bore * ((-aim - c.z) / bore.z)
	say("held", "the muzzles at (%.2f, %.2f) and (%.2f, %.2f) of the view, the breech at (%.2f, %.2f), the hinge at (%.2f, %.2f), the butt %.2f m behind the eye; the barrels' line %.1f cm off the middle %.1f m ahead" % [
		mr.x, mr.y, ml.x, ml.y, br.x, br.y, hg.x, hg.y, butt.z, Vector2(meet.x, meet.y).length() * 100.0, aim])
	for mp in [mr, ml]:
		if mp.x < 0.4 or mp.x > 0.75 or mp.y < 0.45 or mp.y > 0.85:
			bad("a muzzle isn't in the view toward its middle (%.2f, %.2f)" % [mp.x, mp.y])
	if not (br.y > 1.0 or bh.z > -0.03) or not (hg.y > 0.95):
		bad("more than the barrels in the view: the breech at (%.2f, %.2f), the hinge at (%.2f, %.2f)" % [br.x, br.y, hg.x, hg.y])
	if butt.z < -0.02:
		bad("the butt isn't behind the eye (%.2f m)" % butt.z)
	if Vector2(meet.x, meet.y).length() > 0.04:
		bad("the barrels' line misses the view's middle by %.1f cm" % (Vector2(meet.x, meet.y).length() * 100.0))
	var shadowy := 0
	var unclipped := 0
	var meshes := 0
	for gi in gun.get_node("Rig").find_children("*", "GeometryInstance3D", true, false):
		if (gi as GeometryInstance3D).cast_shadow != GeometryInstance3D.SHADOW_CASTING_SETTING_OFF:
			shadowy += 1
		if gi is MeshInstance3D and (gi as MeshInstance3D).mesh != null:
			meshes += 1
			for i in (gi as MeshInstance3D).mesh.get_surface_count():
				var mat := (gi as MeshInstance3D).get_active_material(i)
				if mat is BaseMaterial3D and not (mat as BaseMaterial3D).use_z_clip_scale:
					unclipped += 1
	say("view model", "%d meshes, %d casting a shadow, %d surfaces not z-clipped" % [meshes, shadowy, unclipped])
	if shadowy > 0 or unclipped > 0 or meshes < 4:
		bad("the gun isn't a view model (%d meshes, %d shadows, %d not z-clipped)" % [meshes, shadowy, unclipped])
	var ls := sock("light")
	var off := eye.to_local(torch.global_position).distance_to(eye.to_local(ls.global_position))
	var mid_far := eye.to_global(Vector3(0, 0, -float(g("beam_at_m"))))
	var ang := rad_to_deg((-torch.global_basis.z).angle_to(mid_far - torch.global_position))
	say("flashlight", "carried %.1f cm from the barrels' light socket, its beam %.1f° off the view's middle %.0f m ahead" % [off * 100.0, ang, float(g("beam_at_m"))])
	if off > 0.01 or ang > 1.5:
		bad("the flashlight isn't under the barrels with its beam on the view's middle (%.1f cm, %.1f°)" % [off * 100.0, ang])
	fear.process_mode = Node.PROCESS_MODE_DISABLED  # (the Fear node sets the tremor from its level each frame: held still)
	torch.set("tremor", 6.0)                       # (its shake: it must still show while the gun carries it)
	var shook := 0.0
	for i in 20:
		await process_frame
		var r0 = torch.get("_rot0")
		if r0 != null:
			shook = maxf(shook, rad_to_deg((torch.rotation - (r0 as Vector3)).length()))
	torch.set("tremor", 0.0)
	fear.process_mode = Node.PROCESS_MODE_INHERIT
	await frames(5)
	say("tremor", "the flashlight's shake while carried: up to %.2f°" % shook)
	if shook < 0.05:
		bad("the flashlight's tremor doesn't show while the gun carries it")
	var mode_ok := Input.mouse_mode == Input.MOUSE_MODE_CAPTURED
	if g("_hud_ctl") == null:
		bad("no shells drawn low on the right (the HUD's Shells)")

	# 2. a shot at a dummy that knows it's shot: the right barrel, its pellets in its own choke's cone, every one a
	# hole (alone or in a torn one), the dummy told, heard, the ears ringing, the kick, the flash
	var dummy := StaticBody3D.new()
	dummy.set_script(made("extends StaticBody3D\nvar got: Array = []\nfunc shot(info: Dictionary) -> void:\n\tgot.append(info)\n"))
	var dcs := CollisionShape3D.new()
	var dbox := BoxShape3D.new()
	dbox.size = Vector3(0.3, 1.6, 0.6)
	dcs.shape = dbox
	dummy.add_child(dcs)
	main.add_child(dummy)
	dummy.global_position = Vector3(player.global_position.x - 2.5, fl + 0.8, player.global_position.z)
	look(dummy.global_position + Vector3(0, 0.25, 0))
	await frames(5)
	var marks0 := marks()
	var p0: float = player.get("pitch")
	var fwd0 := -eye.global_basis.z
	var from0 := eye.global_position
	gun.pull()
	await frames(1)
	var hits: Array = g("last_hits")
	var on_dummy := hits.filter(func(h): return h["collider"] == dummy).size()
	var pat0 := pattern(hits, from0, fwd0)
	var kick := rad_to_deg(float(player.get("pitch")) - p0)
	var heard: Array = listener.get("got")
	var shot0: Dictionary = impacts().get("last_shot") if impacts() != null else {}
	var torn0: Array = shot0.get("torn", [])
	var holes0 := int(shot0.get("alone", 0))
	for t in torn0:
		holes0 += int(t)
	say("shot", "the right barrel: %d pellets hit (%d on the dummy, told %d times), the widest %.2f° off the middle (its choke %.1f°), %d marks (%s torn, %d alone), heard %s, the ears ringing %.1f s, the view kicked %.1f°, the flash %.1f; live %s" % [
		hits.size(), on_dummy, (dummy.get("got") as Array).size(), pat0.y, float(g("chokes").x), marks() - marks0, str(torn0), int(shot0.get("alone", 0)),
		str(heard.map(func(x): return x[1])), float(fear.get("_ring")), kick, gun.muzzle().light.light_energy, str(g("live"))])
	if int(g("shots")) != 1 or g("live") != [false, true]:
		bad("the shot didn't use the right barrel's shell (shots %d, live %s)" % [int(g("shots")), str(g("live"))])
	if on_dummy < int(g("pellets")) - 1 or (dummy.get("got") as Array).size() != on_dummy:
		bad("the pellets missed the dummy 2.5 m ahead or it wasn't told (%d of %d hit, told %d)" % [on_dummy, int(g("pellets")), (dummy.get("got") as Array).size()])
	if pat0.y > float(g("chokes").x) + 0.05:
		bad("a pellet left the right barrel's cone (%.2f° > %.2f°)" % [pat0.y, float(g("chokes").x)])
	if int(shot0.get("pellets", -1)) != hits.size() or holes0 != hits.size():
		bad("not every pellet made a hole of its own or one in a torn hole (%d of %d: %s)" % [holes0, hits.size(), str(shot0)])
	if heard.size() != 1 or absf(float(heard[0][1]) - float(g("noise"))) > 0.01:
		bad("the listeners didn't hear the shot as loud as it is (%s)" % str(heard))
	if float(fear.get("_ring")) < 1.0:
		bad("the ears aren't ringing after the shot (the Fear node's ring)")
	if kick < float(g("recoil_deg")) - 0.5 or kick > float(g("recoil_deg")) + 0.1:
		bad("the view wasn't kicked up by the recoil (%.2f°)" % kick)
	if gun.muzzle().light.light_energy < 1.0 or not gun.muzzle().wings.visible:
		bad("no muzzle flash at the shot")
	gun.call("_process", 0.3)                       # (a hitch just after a shot: a 0.3 s frame)
	var kick_after := float(g("_kick"))
	say("hitch", "a 0.3 s frame just after the shot: the kick's spring at %.2f" % kick_after)
	if absf(kick_after) > 0.6:
		bad("a long frame threw the kick's spring (%.2f)" % kick_after)
	await secs(1.0)
	var settled := rad_to_deg(float(player.get("pitch")) - p0)
	var want_settle := float(g("recoil_deg")) * (1.0 - float(g("recover")))
	say("recoil", "the view kicked %.1f° and settled back to %.1f° above where it was (%.1f wanted)" % [kick, settled, want_settle])
	if absf(settled - want_settle) > 0.35:
		bad("the view didn't settle back after the kick (%.2f°, want %.2f°)" % [settled, want_settle])

	# 3. the right barrel, then the left (each its own trigger, the left through its tighter choke), then a click
	await fill()
	look(eye.global_position + Vector3(-5, -0.4, 0))
	await frames(3)
	var shots_a := int(g("shots"))
	var fired_a: int = fired_n[0]
	var empties_a: int = empties[0]
	gun.pull()
	await frames(2)
	var after1: Array = (g("live") as Array).duplicate()
	var t1: float = (g("_trigger") as Node3D).rotation.distance_to(g("_trig0"))
	await until(func() -> bool: return not g("busy"), 1.0)
	var fwd_l := -eye.global_basis.z
	var from_l := eye.global_position
	gun.pull()
	await frames(2)
	var pat_l := pattern(g("last_hits"), from_l, fwd_l)
	var t2: float = (g("_trigger2") as Node3D).rotation.distance_to(g("_trig2_0"))
	var after2: Array = (g("live") as Array).duplicate()
	await until(func() -> bool: return not g("busy"), 1.0)
	gun.pull()
	await frames(3)
	say("fire", "first the right %s (its trigger back %s), then the left %s (the rear trigger %s; its widest pellet %.2f°, its choke %.1f°), then %d click; %d shots, spent %s" % [
		str(after1), t1 > 0.01, str(after2), t2 > 0.01, pat_l.y, float(g("chokes").y), empties[0] - empties_a, int(g("shots")) - shots_a, str(g("spent"))])
	if after1 != [false, true] or after2 != [false, false] or empties[0] - empties_a != 1 or int(g("shots")) - shots_a != 2 or fired_n[0] - fired_a != 2:
		bad("the barrels didn't fire right then left then click (%s, %s, %d clicks, %d shots)" % [str(after1), str(after2), empties[0] - empties_a, int(g("shots")) - shots_a])
	if t1 < 0.01 or t2 < 0.01:
		bad("the triggers didn't move (front %s, rear %s)" % [t1 > 0.01, t2 > 0.01])
	if pat_l.y > float(g("chokes").y) + 0.05:
		bad("a pellet left the left barrel's cone (%.2f° > %.2f°)" % [pat_l.y, float(g("chokes").y)])

	# 3b. aimed (the right button): the barrels straight ahead under the eye, the lens narrower, the cone the barrel's
	# own (a choke doesn't change when you aim)
	await fill()
	look(dummy.global_position + Vector3(0, 0.25, 0))
	await frames(3)
	var fov0 := eye.fov
	gun.set_aim(true)
	await secs(0.5)
	var am := eye.to_local(gun.call("_at", "muzzle"))
	var ac := eye.to_local(gun.call("_at", "chamber"))
	var abore := rad_to_deg((am - ac).normalized().angle_to(Vector3(0, 0, -1)))
	var asm := on_screen(am)
	var afov := eye.fov
	var afwd := -eye.global_basis.z
	var afrom := eye.global_position
	gun.pull()
	await frames(1)
	var apat := pattern(g("last_hits"), afrom, afwd)
	await until(func() -> bool: return not g("busy"), 1.5)
	gun.set_aim(false)
	await secs(0.5)
	say("aim", "aimed: the muzzles at (%.2f, %.2f) of the view, the bore %.1f° off straight ahead, the lens %.0f° (from %.0f), the widest pellet %.2f° off; let go: the lens %.0f°, at the hip %s" % [
		asm.x, asm.y, abore, afov, fov0, apat.y, eye.fov, float(g("_aim")) < 0.001])
	if absf(asm.x - 0.5) > 0.03 or asm.y < 0.5 or asm.y > 0.6 or abore > 1.0:
		bad("aimed, the barrels aren't straight ahead under the view's middle (%.2f, %.2f; %.1f°)" % [asm.x, asm.y, abore])
	if absf(afov - float(g("aim_fov"))) > 0.5 or absf(eye.fov - fov0) > 0.01:
		bad("the lens didn't narrow while aimed and come back (%.1f, then %.1f from %.1f)" % [afov, eye.fov, fov0])
	if apat.y > float(g("chokes").x) + 0.05:
		bad("aimed, the pellets left the barrel's cone (%.2f°)" % apat.y)

	# 3b2. someone hidden (not there yet, her collider still is) isn't shot: the pellets go through to what's behind
	dummy.visible = false
	look(dummy.global_position + Vector3(0, 0.25, 0))
	await frames(3)
	gun.pull()
	await frames(1)
	var through: Array = g("last_hits")
	var on_hidden := through.filter(func(h): return h["collider"] == dummy).size()
	say("hidden", "a shot at a hidden body: %d pellets on it, %d on what's behind" % [on_hidden, through.size() - on_hidden])
	if on_hidden > 0 or through.size() == 0:
		bad("a hidden body was shot (%d pellets on it)" % on_hidden)
	dummy.visible = true
	await until(func() -> bool: return not g("busy"), 1.5)

	# 3c. under a 4:3 tape (the Look plugin's), the gun drawn in to sit in its picture; back without it
	var vhs = main.get_node("Tape").get("vhs")
	var hip0 := eye.to_local(gun.call("_at", "chamber")).x
	vhs.call("preset", "camhybrid")
	await frames(3)
	var hip1 := eye.to_local(gun.call("_at", "chamber")).x
	vhs.call("preset", "off")
	await frames(3)
	var hip2 := eye.to_local(gun.call("_at", "chamber")).x
	say("tape", "the chamber %.3f m right of the eye, %.3f under the tape's 4:3, %.3f after" % [hip0, hip1, hip2])
	if absf(hip1 - hip0 * 0.75) > 0.01 or absf(hip2 - hip0) > 0.01:
		bad("the gun isn't drawn into the tape's 4:3 picture and back (%.3f, %.3f, %.3f)" % [hip0, hip1, hip2])

	# 4. a crate shoved by the shot, carrying its holes with it
	await fill()
	var crate := main.get_node("Crate0") as RigidBody3D
	var cp := crate.global_position
	look(cp)
	await frames(5)
	gun.pull()
	await secs(1.0)
	var moved := crate.global_position.distance_to(cp)
	var carried := crate.get_children().filter(func(cc): return cc is Decal).size()
	say("crate", "moved %.2f m by the shot, %d holes in it carried with it" % [moved, carried])
	if moved < 0.05:
		bad("the crate didn't move when it was shot (%.3f m)" % moved)
	if carried < 1:
		bad("the holes in the crate stayed where it was (none of its own)")
	await until(func() -> bool: return not g("busy"), 1.0)

	# 5. as fast as it goes: both barrels, R, both again; never three flashes in any second (the flash limit)
	await fill()
	look(eye.global_position + Vector3(-5, -0.3, 0))
	await frames(2)
	var times: Array = []
	var stamp := func(_h: Array) -> void: times.append(t_now[0])
	gun.fired.connect(stamp)
	for i in 900:
		if not g("busy"):
			if int(g("loaded")) > 0:
				gun.pull()
			elif times.size() < 4:
				gun.reload()
			else:
				break
		await frames(1)
	gun.fired.disconnect(stamp)
	var most_in_s := 0
	for ti in times:
		most_in_s = maxi(most_in_s, times.filter(func(tj) -> bool: return float(tj) >= float(ti) and float(tj) < float(ti) + 1.0).size())
	say("flash limit", "4 shots as fast as it goes, at %s s: at most %d in any second" % [str(times.map(func(x): return snappedf(float(x) - float(times[0]), 0.01))), most_in_s])
	if times.size() != 4 or most_in_s > 2:
		bad("the double fires faster than the flash limit allows (%d shots, %d in a second)" % [times.size(), most_in_s])

	# 6. the reload: up into the view, broken open there (the chambers in the frame), the hulls flicked out and down on
	# the floor, a shell popped into each chamber, shut, back down
	look(eye.global_position + Vector3(-5, -0.4, 0))
	await until(func() -> bool: return not g("busy"), 2.0)                # (both barrels fired just now)
	var spare0 := int(g("spare"))
	shell_log.clear()
	var opens0: int = opens[0]
	var shuts0: int = shuts[0]
	var flicked0 := int(g("flicked"))
	var most_open := [0.0]
	var chambers_in := [false]
	var chambers_at := [Vector2.ZERO, Vector2.ZERO]
	var lever_most := [0.0]
	var ticks := [0]
	var watch := func() -> void:
		ticks[0] += 1
		var o := float(g("opened"))
		lever_most[0] = maxf(lever_most[0], float(g("_lever_k")))
		if o > most_open[0]:
			most_open[0] = o
		if o > 0.97:
			var a := scr("chamber_r")
			var b := scr("chamber_l")
			chambers_at[0] = a
			chambers_at[1] = b
			if a.x > 0.05 and a.x < 0.95 and a.y > 0.05 and a.y < 0.95 and b.x > 0.05 and b.x < 0.95 and b.y > 0.05 and b.y < 0.95:
				chambers_in[0] = true
	process_frame.connect(watch)
	gun.reload()
	await until(func() -> bool: return not g("busy"), 4.0)
	var took := float(ticks[0]) / 60.0
	process_frame.disconnect(watch)
	var shut_ang := rad_to_deg((g("_barrels") as Node3D).transform.basis.get_rotation_quaternion().angle_to((g("_barrels0") as Transform3D).basis.get_rotation_quaternion()))
	say("reload", "broken open %d time%s (%.2f of the way, the lever over %.2f), the chambers in the view at (%.2f, %.2f) and (%.2f, %.2f): %s; %d hulls flicked, %s shells popped in, spare %d to %d, shut %d, the barrels %.1f° from shut after; live %s" % [
		opens[0] - opens0, "" if opens[0] - opens0 == 1 else "s", most_open[0], lever_most[0], chambers_at[0].x, chambers_at[0].y, chambers_at[1].x, chambers_at[1].y,
		"in frame" if chambers_in[0] else "OUT OF FRAME", int(g("flicked")) - flicked0, str(shell_log), spare0, int(g("spare")), shuts[0] - shuts0, shut_ang, str(g("live"))])
	if opens[0] - opens0 != 1 or most_open[0] < 0.99 or lever_most[0] < 0.99 or shuts[0] - shuts0 != 1 or shut_ang > 0.5:
		bad("the gun didn't break open on its hinge and shut again (opens %d, %.2f, lever %.2f, shuts %d, %.1f°)" % [opens[0] - opens0, most_open[0], lever_most[0], shuts[0] - shuts0, shut_ang])
	if not chambers_in[0]:
		bad("broken open, the chambers aren't in the view (%s, %s)" % [str(chambers_at[0]), str(chambers_at[1])])
	if int(g("flicked")) - flicked0 != 2 or shell_log != [1, 2] or g("live") != [true, true] or int(g("spare")) != spare0 - 2:
		bad("the reload didn't throw two hulls out and pop two shells in (flicked %d, %s, live %s, spare %d)" % [int(g("flicked")) - flicked0, str(shell_log), str(g("live")), int(g("spare"))])
	var fell := await until(func() -> bool: return (g("_falling") as Array).is_empty() and (g("_flying") as Array).is_empty(), 4.0)
	var hl: Array = (g("_hulls") as Array).filter(func(h): return is_instance_valid(h))
	var on_floor := hl.filter(func(h): return absf((h as Node3D).global_position.y - fl) < 0.06).size()
	say("hulls", "%d of %d flicked hulls lying on the floor%s; the reload took %.2f s" % [on_floor, hl.size(), "" if fell else " (STILL FALLING)", took])
	if hl.size() < 2 or on_floor < hl.size():
		bad("the flicked hulls didn't all come down on the floor (%d of %d)" % [on_floor, hl.size()])
	if took > 2.2:
		bad("the reload's too slow (%.2f s)" % took)

	# 6b. one barrel fired and reloaded: the live one left where it is, one popped in
	await frames(10)
	var left_shell = (g("_in_chamber") as Array)[1]
	gun.pull()
	await until(func() -> bool: return not g("busy"), 1.0)
	shell_log.clear()
	var fl0 := int(g("flicked"))
	gun.reload()
	await until(func() -> bool: return not g("busy"), 4.0)
	var kept: bool = (g("_in_chamber") as Array)[1] == left_shell
	say("one", "the right fired and reloaded: %d flicked, %d popped in, the left's live shell %s; live %s" % [int(g("flicked")) - fl0, shell_log.size(), "left where it was" if kept else "TOUCHED", str(g("live"))])
	if int(g("flicked")) - fl0 != 1 or shell_log.size() != 1 or not kept or g("live") != [true, true]:
		bad("one barrel's reload went wrong (flicked %d, popped %d, kept %s, live %s)" % [int(g("flicked")) - fl0, shell_log.size(), kept, str(g("live"))])

	# 6c. full: broken open and shut, a look, nothing thrown out or put in
	shell_log.clear()
	fl0 = int(g("flicked"))
	var opens1: int = opens[0]
	gun.reload()
	await until(func() -> bool: return not g("busy"), 4.0)
	say("look", "a full gun broken open %d time and shut: %d flicked, %d popped in" % [opens[0] - opens1, int(g("flicked")) - fl0, shell_log.size()])
	if opens[0] - opens1 != 1 or int(g("flicked")) != fl0 or not shell_log.is_empty():
		bad("a full gun's look did more than open and shut")

	# 6d. one shell for two empty chambers: the right one loaded, the left left empty
	gun.pull()
	await until(func() -> bool: return not g("busy"), 1.0)
	gun.pull()
	await until(func() -> bool: return not g("busy"), 1.0)
	var spare_kept := int(g("spare"))
	gun.set("spare", 1)
	shell_log.clear()
	gun.reload()
	await until(func() -> bool: return not g("busy"), 4.0)
	say("short", "one shell for two: live %s, spare %d" % [str(g("live")), int(g("spare"))])
	if g("live") != [true, false] or int(g("spare")) != 0:
		bad("one shell didn't go into the right chamber alone (%s, spare %d)" % [str(g("live")), int(g("spare"))])

	# 7. a shot during the reload: the loading stopped after the shell going in, shut, then it fires
	gun.pull()
	await until(func() -> bool: return not g("busy"), 1.0)
	gun.set("spare", spare_kept)
	shell_log.clear()
	var shots0 := int(g("shots"))
	gun.reload()
	await until(func() -> bool: return shell_log.size() >= 1, 3.0)
	gun.pull()
	var fired_ok := await until(func() -> bool: return int(g("shots")) == shots0 + 1, 3.0)
	await until(func() -> bool: return not g("busy"), 2.0)
	say("stopped", "%d shell in, then shut and fired %s, open %.2f, reloading %s" % [shell_log.size(), "at once" if fired_ok else "NEVER", float(g("opened")), g("reloading")])
	if shell_log.size() != 1 or not fired_ok or float(g("opened")) > 0.01 or g("reloading"):
		bad("a shot during the reload didn't stop it, shut it and fire (%d in, fired %s)" % [shell_log.size(), fired_ok])

	# 8. the keys: R reloads, Q lowers and raises; a left click fires (with the mouse captured, as the starter's player has it)
	await fill(0)
	shell_log.clear()
	await press(KEY_R)
	await until(func() -> bool: return shell_log.size() > 0, 2.0)
	await until(func() -> bool: return not g("busy"), 4.0)
	await press(KEY_Q)
	await secs(0.5)
	var down: bool = not g("raised") and float(g("_lower")) > 0.99 and not gun.visible
	await press(KEY_Q)
	await secs(0.5)
	var up: bool = g("raised") and float(g("_lower")) < 0.01 and gun.visible
	var clicked := "not tried (no mouse to capture headless)"
	if mode_ok:
		var sh0 := int(g("shots"))
		await click()
		await until(func() -> bool: return not g("busy"), 1.5)
		clicked = "fired %d" % (int(g("shots")) - sh0)
		if int(g("shots")) != sh0 + 1:
			bad("a left click didn't fire")
	say("keys", "R put %d in, Q lowered it %s and raised it %s; a click %s" % [shell_log.size(), down, up, clicked])
	if shell_log.size() != 2 or not down or not up:
		bad("the keys don't work (R %d shells, Q down %s, up %s)" % [shell_log.size(), down, up])

	# 8b. something that reacts to being shot (an HSShootable under it): gone a moment at the first hit, down at the second
	if is_instance_valid(dummy):
		dummy.queue_free()
	var ghost := Node3D.new()
	ghost.name = "Ghost"
	main.add_child(ghost)
	ghost.global_position = Vector3(player.global_position.x - 2.6, fl, player.global_position.z)
	var gb := StaticBody3D.new()
	var gcs := CollisionShape3D.new()
	var gbox := BoxShape3D.new()
	gbox.size = Vector3(0.4, 1.6, 0.5)
	gcs.shape = gbox
	gb.add_child(gcs)
	ghost.add_child(gb)
	gb.position = Vector3(0, 0.8, 0)
	var sh := Node.new()
	sh.set_script(load("res://addons/horrorstudio_weapons/shootable.gd"))
	sh.set("hits", 2)
	sh.set("gone_secs", 0.5)
	ghost.add_child(sh)
	var g_hits: Array = []
	var g_down := [false]
	sh.hit.connect(func(info: Dictionary) -> void: g_hits.append(info))
	sh.down.connect(func() -> void: g_down[0] = true)
	await fill()
	await frames(30)
	look(ghost.global_position + Vector3(0, 1.1, 0))
	await frames(3)
	gun.pull()
	await frames(2)
	var gone1: bool = not ghost.visible and gb.collision_layer == 0 and bool(ghost.get_meta("hs_hidden", false))
	await secs(0.7)
	var back: bool = ghost.visible and gb.collision_layer != 0 and not bool(ghost.get_meta("hs_hidden", false))
	await until(func() -> bool: return not g("busy"), 1.0)
	gun.pull()
	await frames(2)
	await secs(0.8)
	var gone_for_good: bool = not ghost.visible and g_down[0]
	say("shootable", "hit %d times (%s pellets each), gone at the first %s and back after %s, down at the second %s" % [
		g_hits.size(), str(g_hits.map(func(x): return x["hits"])), gone1, back, gone_for_good])
	if g_hits.size() != 2 or not gone1 or not back or not gone_for_good:
		bad("an HSShootable didn't answer its hits (hits %d, gone %s, back %s, down %s)" % [g_hits.size(), gone1, back, gone_for_good])
	await until(func() -> bool: return not g("busy"), 1.0)

	# 8b2. a lamp shot out (an HSShootable with lights_out under it): its light dark when it's down
	var lamp := Node3D.new()
	lamp.name = "Lamp"
	main.add_child(lamp)
	lamp.global_position = Vector3(player.global_position.x - 2.4, fl + 1.5, player.global_position.z)
	var lb := StaticBody3D.new()
	var lcs := CollisionShape3D.new()
	var lbox := BoxShape3D.new()
	lbox.size = Vector3(0.3, 0.3, 0.3)
	lcs.shape = lbox
	lb.add_child(lcs)
	lamp.add_child(lb)
	var bulb := OmniLight3D.new()
	lamp.add_child(bulb)
	var lsh := Node.new()
	lsh.set_script(load("res://addons/horrorstudio_weapons/shootable.gd"))
	lsh.set("lights_out", true)
	lamp.add_child(lsh)
	await fill()
	look(lamp.global_position)
	await frames(3)
	var lit_before := bulb.visible
	gun.pull()
	await frames(3)
	say("lamp", "a lamp lit %s, shot: its light %s, down %s, marked unlit %s" % [lit_before, "dark" if not bulb.visible else "STILL LIT", lsh.get("is_down"), not bool(bulb.get_meta("hs_lit", true))])
	if not lit_before or bulb.visible or not lsh.get("is_down") or bool(bulb.get_meta("hs_lit", true)) or bulb.light_energy > 0.0:
		bad("a lamp with lights_out wasn't shot out (lit %s, now %s)" % [lit_before, bulb.visible])
	await until(func() -> bool: return not g("busy"), 1.0)
	lamp.queue_free()

	# 8c. the shells' row low on the right: inside the tape's 4:3 picture, and above the studio HUD's keys when there's an HSHud
	var vsz := gun.get_viewport().get_visible_rect().size
	var u := clampf(vsz.y / 1080.0, 0.5, 3.0)
	var at0: Vector2 = gun.call("_hud_at", vsz, u)
	var hud_ui: Node = null
	if ResourceLoader.exists("res://addons/horrorstudio_ui/hud.gd"):
		hud_ui = (load("res://addons/horrorstudio_ui/hud.gd") as GDScript).new()
		main.add_child(hud_ui)
		await secs(4.5)                                          # (the gun looks for a HUD now and then)
		var chips := hud_ui.get("hint_el") as Control
		var at1: Vector2 = gun.call("_hud_at", vsz, u)
		var top := chips.get_global_rect().position.y if chips != null else -1.0
		say("shells row", "at (%.0f, %.0f) of %.0f x %.0f; with an HSHud its keys' top at %.0f and the row's baseline at %.0f" % [at0.x, at0.y, vsz.x, vsz.y, top, at1.y])
		if chips == null or chips.get_child_count() == 0 or absf(at1.y - (top - 12.0 * u)) > 1.0 or at1.y >= at0.y:
			bad("the shells' row isn't above the HSHud's keys (%.0f, the keys at %.0f)" % [at1.y, top])
		hud_ui.queue_free()
	if absf(at0.x - (vsz.x - 46.0 * u)) > 1.0 or absf(at0.y - (vsz.y - 42.0 * u)) > 1.0:          # (headless, the view is tiny: its rule, not pixels)
		bad("the shells' row isn't low on the right (%.0f, %.0f of %.0f x %.0f)" % [at0.x, at0.y, vsz.x, vsz.y])

	# 8d. running (the starter's 3.2 m/s): carried low and turned in; walking, back up
	var run_most := 0.0
	var start_at := player.global_position
	for i in 70:
		player.global_position += Vector3(-3.2 / 60.0, 0, 0)
		await process_frame
		run_most = maxf(run_most, float(g("_run")))
	var walk_k := 1.0
	for i in 70:
		player.global_position += Vector3(1.6 / 60.0, 0, 0)
		await process_frame
		walk_k = float(g("_run"))
	player.global_position = start_at
	say("run", "running the gun carried low (%.2f), walking up again (%.2f)" % [run_most, walk_k])
	if run_most < 0.9 or walk_k > 0.05:
		bad("the gun isn't carried low while running and up while walking (%.2f, %.2f)" % [run_most, walk_k])

	# 8e. against a wall: the muzzles (drawn in front of it) are past it, but the flash's light and smoke stay this
	# side; reloaded beside a wall at your right, the hulls flicked out come down this side of it
	var corr: Dictionary = cfg["corridor"]
	var zn := float(corr["at"][2]) + float(corr["size"][2]) / 2.0          # the corridor's north wall
	var zs := float(corr["at"][2]) - float(corr["size"][2]) / 2.0          # and its south
	var spot := player.global_position
	await fill()
	player.global_position = Vector3(spot.x, spot.y, zn - 0.45)
	look(Vector3(spot.x, eye.global_position.y, zn + 2.0))
	await frames(5)
	var wall_mz: Vector3 = gun.call("_at", "muzzle")
	gun.pull()
	await frames(1)
	var fl_at: Vector3 = gun.muzzle().light.global_position
	var sm_at: Vector3 = gun.muzzle().puffs.global_position
	await until(func() -> bool: return not g("busy"), 1.5)
	player.global_position = Vector3(spot.x, spot.y, zs + 0.38)        # the south wall at your right (looking west)
	look(Vector3(spot.x - 3.0, eye.global_position.y, zs + 0.38))
	await frames(5)
	gun.pull()                                                          # (the left barrel: both spent now)
	await until(func() -> bool: return not g("busy"), 1.5)
	var flicked1 := int(g("flicked"))
	gun.reload()
	await until(func() -> bool: return not g("busy"), 4.0)
	await until(func() -> bool: return (g("_falling") as Array).is_empty() and (g("_flying") as Array).is_empty(), 4.0)
	var hl2: Array = (g("_hulls") as Array).filter(func(h): return is_instance_valid(h))
	var new_hulls: Array = hl2.slice(maxi(0, hl2.size() - (int(g("flicked")) - flicked1)))
	var inside := new_hulls.filter(func(h): return (h as Node3D).global_position.z > zs and (h as Node3D).global_position.z < zn).size()
	say("wall", "facing a wall 0.45 m off: the muzzle %.2f m past it, the flash's light %.2f m and its smoke %.2f m this side; reloaded with a wall at your right, %d of %d hulls down this side of it (%s)" % [
		wall_mz.z - zn, zn - fl_at.z, zn - sm_at.z, inside, new_hulls.size(), str(new_hulls.map(func(h): return snappedf((h as Node3D).global_position.z - zs, 0.01)))])
	if wall_mz.z <= zn:
		bad("the check's set-up: the muzzle isn't past the wall (%.2f)" % (wall_mz.z - zn))
	if fl_at.z >= zn or sm_at.z >= zn:
		bad("the flash's light or smoke went through the wall you stand against (%.2f, %.2f past it)" % [fl_at.z - zn, sm_at.z - zn])
	if new_hulls.size() != 2 or inside != 2:
		bad("the hulls flicked out beside a wall didn't come down this side of it (%d of %d)" % [inside, new_hulls.size()])
	player.global_position = spot

	# 8f. the muzzle (DECISIONS 2026-11-09, latest): its flash a star of wings round the bore and a plume out of it, each
	# a run of elongated spheres that intersect, their fronts culled, burnt by the facing through a colour burn; out
	# in a frame or three; its smoke trailing after it and left where the muzzle was as the gun turns. Every pellet a
	# hole whose three maps make pieces look missing (alone or in a torn one), tinted by what it's made of, with that
	# surface's dust and chips
	look(Vector3(spot.x - 4.0, eye.global_position.y - 0.3, spot.z))
	await fill()
	await frames(5)
	var muz: Node3D = gun.muzzle()
	gun.pull()
	await frames(1)
	var rep: Dictionary = muz.report()
	var sph: Array = muz.sphere_list()
	var wing_dirs: Array = []
	var chains := 0
	var apart := 0
	var plume_far := 0.0
	var tips: Array = []                                  # each run's last sphere: a wing's way, read at its tip
	for i in sph.size():
		var xf: Transform3D = sph[i]["transform"]
		var along: float = sph[i]["along"]
		var prev_along: float = sph[i - 1]["along"] if i > 0 else 2.0
		if along <= prev_along:
			chains += 1                                   # a new run: its root
			tips.append(xf.origin)
		else:
			tips[tips.size() - 1] = xf.origin
			var pxf: Transform3D = sph[i - 1]["transform"]
			var reach := pxf.basis.z.length() + xf.basis.z.length()   # (their half-lengths along the run)
			if pxf.origin.distance_to(xf.origin) >= reach:
				apart += 1
		plume_far = minf(plume_far, xf.origin.z)
	for tp in tips:
		var d: Vector3 = (tp as Vector3).normalized() if (tp as Vector3).length() > 0.001 else Vector3(0, 0, -1)
		if absf(d.z) < 0.97:                              # (the plume runs straight out, the core sits on it: not wings)
			wing_dirs.append(atan2(d.y, d.x))
	wing_dirs.sort()
	var gap := 0.0
	for i in wing_dirs.size():
		var nx: float = wing_dirs[(i + 1) % wing_dirs.size()] + (TAU if i == wing_dirs.size() - 1 else 0.0)
		gap = maxf(gap, rad_to_deg(nx - float(wing_dirs[i])))
	var wmat := muz.wings.material_override as ShaderMaterial
	var code := wmat.shader.code if wmat != null and wmat.shader != null else ""
	var inc := FileAccess.get_file_as_string("res://addons/horrorstudio_weapons/muzzle/flash.gdshaderinc")
	var burns := inc.contains("color_burn(base, facing)") and inc.contains("1.0 - (1.0 - base) / max(blend")
	var light_at_shot := float(rep["light"])
	say("muzzle", "the %s flash: %d spheres in %d runs (%d wings round the bore, the widest gap %.0f°, the plume %.2f m out), %d spheres not touching the one before; fronts culled %s, burnt %s; its light %.1f" % [
		rep["look"], rep["spheres"], chains, wing_dirs.size(), gap, -plume_far, apart, code.contains("cull_front"), burns, light_at_shot])
	if not bool(rep["drawn"]) or int(rep["spheres"]) < 20 or wing_dirs.size() < 4 or gap > 115.0 or apart > 0 or plume_far > -0.15:
		bad("the muzzle flash isn't a star of wings of intersecting spheres with a plume (%s, %d wings, gap %.0f°, %d apart, plume %.2f)" % [str(rep), wing_dirs.size(), gap, apart, plume_far])
	if not code.contains("cull_front") or not burns:
		bad("the flash's spheres aren't drawn with their fronts culled and burnt by the facing (cull_front %s, burn %s)" % [code.contains("cull_front"), burns])
	if light_at_shot < 1.0:
		bad("the muzzle's light didn't flash (%.2f)" % light_at_shot)
	var hits2: Array = g("last_hits")
	var im := impacts()
	var ls2: Dictionary = im.get("last_shot")
	var made_marks: Array = ls2.get("marks", [])
	var holes_n := int(ls2.get("alone", 0))
	for t in (ls2.get("torn", []) as Array):
		holes_n += int(t)
	var maps_ok := made_marks.all(func(d) -> bool:
		var mk := str((d as Decal).get_meta("hs_mark", ""))
		return (d as Decal).texture_albedo != null and (mk == "soot" or mk == "grains" or ((d as Decal).texture_normal != null and (d as Decal).texture_orm != null)))
	var surf := str(ls2.get("surface", ""))
	var tint: Color = (im.get_script() as GDScript).get_script_constant_map()["SURFACES"].get(surf, {}).get("tint", Color.WHITE)
	var tinted := made_marks.all(func(d) -> bool:
		var mk := str((d as Decal).get_meta("hs_mark", ""))
		var mc := (d as Decal).modulate
		var want := tint if mk == "crater" or mk == "blast" else Color.WHITE
		return Color(mc.r, mc.g, mc.b).is_equal_approx(Color(want.r, want.g, want.b)))
	var dust_n := 0
	var chip_n := 0
	for e in im.get_children():
		if e is CPUParticles3D and (e as CPUParticles3D).emitting:
			if (e as CPUParticles3D).mesh is QuadMesh:
				dust_n += 1
			else:
				chip_n += 1
	say("marks", "%d pellets, %d holes in %d marks (%s torn, %d alone), each with its maps %s, on %s tinted %s; %d bursts of dust and sparks, %d of chips flying" % [
		hits2.size(), holes_n, made_marks.size(), str(ls2.get("torn", [])), int(ls2.get("alone", 0)), maps_ok, surf, tinted, dust_n, chip_n])
	if holes_n != hits2.size() or made_marks.is_empty() or not maps_ok or not tinted or surf == "":
		bad("not a hole for each pellet with its maps, tinted by its surface (%d of %d, maps %s, tinted %s, %s)" % [holes_n, hits2.size(), maps_ok, tinted, surf])
	if dust_n < 1 or chip_n < 1:
		bad("no dust or chips flying off where the pellets landed (%d, %d)" % [dust_n, chip_n])
	await frames(6)
	var rep2: Dictionary = muz.report()
	say("flash out", "6 frames on: drawn %s, its light %.2f" % [rep2["drawn"], float(rep2["light"])])
	if bool(rep2["drawn"]) or float(rep2["light"]) > 0.01:
		bad("the flash is still there 6 frames on (%s)" % str(rep2))
	await frames(14)
	var bits0: Array = muz.trail_bits()
	var b0: Dictionary = bits0.back() if bits0.size() > 0 else {}          # the newest bit: followed by when it was left
	var mz0 := muz.global_position
	look(Vector3(spot.x, eye.global_position.y - 0.3, spot.z + 4.0))       # turned away: the muzzle swings round
	await frames(20)
	var pts1: Array = muz.trail_points()
	var same: Array = (muz.trail_bits() as Array).filter(func(b) -> bool: return not b0.is_empty() and is_equal_approx(float(b["born"]), float(b0["born"])))
	var swung := muz.global_position.distance_to(mz0)
	var stayed := (same[0]["at"] as Vector3).distance_to(b0["at"]) if same.size() > 0 else 9.0
	var drawn: Dictionary = muz.trail_drawn()
	var want_strands := int((muz.get("look") as Resource).get("trail_strands"))
	say("trail", "%d bits of smoke trailed after the shot; the muzzle swung %.2f m away and the bit it had just left moved %.2f m (left where it was); drawn as %d sprites in %d strands" % [
		pts1.size(), swung, stayed, int(drawn["sprites"]), int(drawn["strands"])])
	if pts1.size() < 6 or swung < 0.15 or stayed > 0.08:
		bad("the muzzle didn't leave a trail of smoke behind it (%d bits, swung %.2f, moved %.2f)" % [pts1.size(), swung, stayed])
	if int(drawn["strands"]) != want_strands or int(drawn["sprites"]) < want_strands * 6:
		bad("the trail isn't drawn as soft sprites along its strands (%s, %d strands wanted)" % [str(drawn), want_strands])
	await until(func() -> bool: return (muz.trail_points() as Array).is_empty(), 5.0)
	if not (muz.trail_points() as Array).is_empty():
		bad("the trail never cleared (%d bits)" % (muz.trail_points() as Array).size())
	await until(func() -> bool: return not g("busy"), 1.5)

	# 8f2. a still barrel's smoke curls as it rises (docs/research/muzzle_smoke.md): held still after a shot, its bits
	# older than half a second spread across the barrel's line, which only the curl noise does (the rise is up, the
	# shot's push along the barrel)
	await fill()
	look(Vector3(spot.x - 4.0, eye.global_position.y - 0.3, spot.z))
	await frames(5)
	gun.pull()
	await secs(1.3)
	var bside := (-muz.global_basis.z).cross(Vector3.UP).normalized()
	var olds: Array = (muz.trail_bits() as Array).filter(func(b) -> bool: return float(b["age"]) > 0.5)
	var mean_s := 0.0
	for b in olds:
		mean_s += (b["at"] as Vector3).dot(bside) / float(maxi(olds.size(), 1))
	var var_s := 0.0
	for b in olds:
		var_s += pow((b["at"] as Vector3).dot(bside) - mean_s, 2.0) / float(maxi(olds.size(), 1))
	say("curl", "held still 1.3 s after a shot: %d bits older than half a second, spread %.1f cm across the barrel's line" % [olds.size(), sqrt(var_s) * 100.0])
	if olds.size() < 5 or sqrt(var_s) < 0.01:
		bad("a still barrel's smoke doesn't curl as it rises (%d bits, %.1f cm across)" % [olds.size(), sqrt(var_s) * 100.0])
	await until(func() -> bool: return (muz.trail_points() as Array).is_empty(), 5.0)
	await until(func() -> bool: return not g("busy"), 1.5)

	# 8g. what a 12-gauge leaves on a wall (docs/research/shotgun_damage.md), by the muzzle's distance from it (the
	# pattern spreads from the muzzle; the three plaster shots apart on the panel): at an arm's length one hole about the bore's size with the smoke's soot and the
	# powder's grains round it and no wad of its own; across a room a pattern a palm wide, a torn middle with holes round
	# it, the wad's dent, no powder; down a corridor holes apart about a hand wide, the wad's dent; on concrete the lead
	# smeared, no holes. The east end of the corridor, two panels across it facing west: plasterboard and concrete.
	# Seeded, so the same each run (the sizes hold for any)
	var px := float(corr["at"][0]) + float(corr["size"][0]) / 2.0 - 2.4         # the panels' faces, 2.4 m short of the east end
	var plaster := StaticBody3D.new()
	plaster.set_meta("hs_surface", "plaster")
	var concrete := StaticBody3D.new()
	concrete.set_meta("hs_surface", "concrete")
	var pz := [float(corr["at"][2]) - 0.45, float(corr["at"][2]) + 0.45]
	var k := 0
	for pb in [plaster, concrete]:
		var pcs := CollisionShape3D.new()
		var pbox := BoxShape3D.new()
		pbox.size = Vector3(0.1, 1.5, 0.86)
		pcs.shape = pbox
		(pb as StaticBody3D).add_child(pcs)
		main.add_child(pb)
		(pb as StaticBody3D).global_position = Vector3(px + 0.05, fl + 1.25, pz[k])
		k += 1
	await frames(3)
	var ahead := -eye.to_local(gun.muzzle(0).global_position).z            # the right muzzle's way ahead of the eye
	var cases := [["arm", 0.15, 0, 0.1, -0.24, 11], ["room", 2.5, 0, 0.0, 0.22, 23], ["corridor", 4.5, 0, -0.4, -0.05, 37], ["concrete", 2.5, 1, 0.0, 0.0, 41]]
	var res := {}
	for cs in cases:
		var dm: float = cs[1]
		var pzi: float = pz[int(cs[2])]
		await fill()
		player.global_position = Vector3(px - dm - ahead, fl, pzi)
		player.velocity = Vector3.ZERO
		await frames(2)
		look(Vector3(px, eye.global_position.y + float(cs[3]), pzi + float(cs[4])))
		await frames(3)
		var from_c := eye.global_position
		var fwd_c := -eye.global_basis.z
		seed(int(cs[5]))                                                 # (the pellets are the shot's first randoms)
		gun.pull()
		await frames(2)
		var hc: Array = (g("last_hits") as Array).filter(func(h): return h["collider"] == (plaster if int(cs[2]) == 0 else concrete))
		var lsc: Dictionary = impacts().get("last_shot")
		var kinds: Dictionary = {}
		for d in (lsc.get("marks", []) as Array):
			var mk := str((d as Decal).get_meta("hs_mark", ""))
			kinds[mk] = int(kinds.get(mk, 0)) + 1
		var pt := pattern(hc, from_c, fwd_c)
		res[cs[0]] = {"hits": hc.size(), "across": pt.x, "torn": lsc.get("torn", []), "alone": int(lsc.get("alone", 0)), "soot": float(lsc.get("soot", 0.0)),
			"grains": float(lsc.get("grains", 0.0)), "wad": bool(lsc.get("wad", false)), "muzzle": float(lsc.get("muzzle_m", -1.0)), "kinds": kinds}
		say("damage", "%s: the muzzle %.2f m from %s, %d pellets landed %.1f cm across: torn %s, %d alone; soot %.2f, grains %.2f, the wad %s; marks %s" % [
			cs[0], float(lsc.get("muzzle_m", -1.0)), lsc.get("surface", "?"), hc.size(), pt.x * 100.0, str(lsc.get("torn", [])), int(lsc.get("alone", 0)),
			float(lsc.get("soot", 0.0)), float(lsc.get("grains", 0.0)), bool(lsc.get("wad", false)), str(kinds)])
		await until(func() -> bool: return not g("busy"), 1.0)
	var arm: Dictionary = res["arm"]
	var room: Dictionary = res["room"]
	var far: Dictionary = res["corridor"]
	var hard: Dictionary = res["concrete"]
	var arm_torn: Array = arm["torn"]
	if int(arm["hits"]) < 8 or arm_torn.is_empty() or int(arm_torn[0]) < 7 or float(arm["soot"]) < 0.2 or float(arm["grains"]) < 0.5 or bool(arm["wad"]) or float(arm["across"]) > 0.015:
		bad("at an arm's length it isn't one hole with soot and grains round it and no wad apart (%s)" % str(arm))
	if float(room["across"]) < 0.035 or float(room["across"]) > 0.095 or float(room["soot"]) > 0.0 or float(room["grains"]) > 0.0 or not bool(room["wad"]) or (room["torn"] as Array).is_empty() or int(room["alone"]) < 1:
		bad("across a room it isn't a pattern a palm wide, a torn middle with holes round it, the wad's dent and no powder (%s)" % str(room))
	if float(far["across"]) < 0.07 or float(far["across"]) > 0.165 or int(far["alone"]) < 5 or not bool(far["wad"]) or float(far["grains"]) > 0.0:
		bad("down the corridor it isn't holes apart about a hand wide with the wad's dent (%s)" % str(far))
	var hk: Dictionary = hard["kinds"]
	if int(hk.get("smear", 0)) < 1 or int(hk.get("crater", 0)) + int(hk.get("blast", 0)) > 0:
		bad("on concrete the lead didn't smear (or it went in: %s)" % str(hk))
	for pb in [plaster, concrete]:
		pb.queue_free()
	player.global_position = spot
	await frames(2)

	# 8h. the shell kinds: an explosive popped into the right barrel (the only one of its kind in the pocket, T picks
	# it), the left left empty; fired, a single slug from the right barrel's own muzzle with its own bigger flash, and
	# its blast at the floor ahead pushing a crate and telling a dummy within its reach (not one past it), hitting a
	# shootable, a scorch with its embers glowing, a ball of fire laid out as a burst, the view shaken, heard far; T back
	look(eye.global_position + Vector3(-5, -0.3, 0))
	await fill(0)
	var exk = load("res://addons/horrorstudio_weapons/shells/explosive.tres")
	var spare_n := int(g("spare"))
	gun.add_shells(1, exk)
	var pocket_had := int((g("pocket") as Dictionary).get("explosive", 0))
	await press(KEY_T)
	var kind_now := str((g("load_kind") as Resource).get("id"))
	var spare_ex := int(g("spare"))
	gun.reload()
	await frames(2)
	await until(func() -> bool: return not g("busy"), 5.0)
	var kinds_in: Array = (g("barrel_kind") as Array).map(func(kk): return str(kk.get("id")) if kk != null else "none")
	say("kinds", "an explosive shell into the pocket (%d), T: loading %s with %d of them (%d buckshot kept); reloaded: live %s, the chambers' kinds %s" % [
		pocket_had, kind_now, spare_ex, int((g("pocket") as Dictionary).get("buckshot", -1)), str(g("live")), str(kinds_in)])
	if pocket_had != 1 or kind_now != "explosive" or spare_ex != 1 or int((g("pocket") as Dictionary).get("buckshot", -1)) != spare_n:
		bad("T didn't switch the pocket to the explosive shell (%d, %s, %d)" % [pocket_had, kind_now, spare_ex])
	if g("live") != [true, false] or kinds_in[0] != "explosive":
		bad("the explosive shell didn't go into the right chamber alone (%s, %s)" % [str(g("live")), str(kinds_in)])
	var target := Vector3(spot.x - 2.8, fl, spot.z)
	var crate2 := RigidBody3D.new()
	var ccs := CollisionShape3D.new()
	var cbs := BoxShape3D.new()
	cbs.size = Vector3(0.3, 0.3, 0.3)
	ccs.shape = cbs
	crate2.add_child(ccs)
	main.add_child(crate2)
	crate2.global_position = target + Vector3(0.0, 0.16, 0.5)
	var dum2 := StaticBody3D.new()
	dum2.set_script(made("extends StaticBody3D\nvar got: Array = []\nfunc shot(info: Dictionary) -> void:\n\tgot.append(info)\n"))
	var dcs2 := CollisionShape3D.new()
	var dbox2 := BoxShape3D.new()
	dbox2.size = Vector3(0.3, 1.2, 0.3)
	dcs2.shape = dbox2
	dum2.add_child(dcs2)
	main.add_child(dum2)
	dum2.global_position = target + Vector3(-1.0, 0.6, -0.6)
	var far2 := StaticBody3D.new()
	far2.set_script(made("extends StaticBody3D\nvar got: Array = []\nfunc shot(info: Dictionary) -> void:\n\tgot.append(info)\n"))
	var fcs := CollisionShape3D.new()
	var fbox := BoxShape3D.new()
	fbox.size = Vector3(0.3, 1.2, 0.3)
	fcs.shape = fbox
	far2.add_child(fcs)
	main.add_child(far2)
	far2.global_position = target + Vector3(-3.4, 0.6, 0.0)
	var ghost2 := StaticBody3D.new()
	var gcs2 := CollisionShape3D.new()
	var gbox2 := BoxShape3D.new()
	gbox2.size = Vector3(0.3, 1.2, 0.3)
	gcs2.shape = gbox2
	ghost2.add_child(gcs2)
	main.add_child(ghost2)
	ghost2.global_position = target + Vector3(-0.5, 0.6, -0.9)
	var shoot_me := (load("res://addons/horrorstudio_weapons/shootable.gd") as GDScript).new() as Node
	shoot_me.set("hits", 3)
	ghost2.add_child(shoot_me)
	await frames(3)
	look(target)
	await frames(5)
	var m0 = gun.muzzle(0)
	var m1 = gun.muzzle(1)
	var s0 := int(m0.get("shots"))
	var s1 := int(m1.get("shots"))
	var heard0 := (listener.get("got") as Array).size()
	var crate_at := crate2.global_position
	var blasts0 := int(im.get("blasts"))
	var bl_shook := 0.0
	gun.pull()
	await frames(1)
	var rex: Dictionary = m0.report()
	var exhits: Array = g("last_hits")
	var slug_hits := exhits.filter(func(h): return not h.has("blast")).size()
	var blast_hits := exhits.filter(func(h): return h.has("blast"))
	for i in 30:
		bl_shook = maxf(bl_shook, Vector2(eye.h_offset, eye.v_offset).length())
		await process_frame
	var fb: Node = im.get_node_or_null("Fireball")
	var fb_rep: Dictionary = fb.report() if fb != null else {}
	var scorch: Decal = (im.get("marks") as Array).back() as Decal
	var embers := scorch.emission_energy if scorch != null and scorch.texture_emission != null else 0.0
	var told: Array = dum2.get("got")
	var far_told: Array = far2.get("got")
	var heard2: Array = (listener.get("got") as Array).slice(heard0)
	var pushed := crate2.global_position - crate_at
	var away := (crate_at - (target + Vector3(0, 0.08, 0))).normalized()
	await frames(40)
	var bl_settled := Vector2(eye.h_offset, eye.v_offset).length()
	say("explosive", "the right muzzle flashed %d (%s, %d sparks), the left %d; %d slug, %d blast %s; a ball of fire of %d spheres (%s); a scorch with embers at %.1f; the crate pushed %.2f m (%.2f of it away from the blast); the dummy told %s, the one 3.4 m off %d times; the shootable hit %d; heard %s; the view shaken %.3f, back to %.3f" % [
		int(m0.get("shots")) - s0, rex["look"], int(rex["sparks"]), int(m1.get("shots")) - s1, slug_hits, int(im.get("blasts")) - blasts0, str(blast_hits.map(func(h): return str((h["collider"] as Node).name))),
		int(fb_rep.get("spheres", 0)), fb_rep.get("look", "none"), embers, pushed.length(), pushed.normalized().dot(away) if pushed.length() > 0.001 else 0.0,
		str(told.map(func(x): return [x.get("blast", false), snappedf(float(x.get("damage", 0.0)), 0.1)])), far_told.size(),
		int(shoot_me.get("count")), str(heard2.map(func(x): return x[1])), bl_shook, bl_settled])
	if int(m0.get("shots")) - s0 != 1 or int(m1.get("shots")) - s1 != 0 or str(rex["look"]) != "Explosive" or int(rex["sparks"]) < 20 or slug_hits != 1:
		bad("the explosive shell didn't fire a single slug from the right barrel's own muzzle with its own bigger flash (%s, %d slug hits)" % [str(rex), slug_hits])
	if int(im.get("blasts")) - blasts0 != 1 or fb == null or int(fb_rep.get("spheres", 0)) < 20:
		bad("no blast with its ball of fire where the slug landed (%d, %s)" % [int(im.get("blasts")) - blasts0, str(fb_rep)])
	if embers <= 0.0:
		bad("no scorch with its embers glowing where it burst")
	if pushed.length() < 0.05 or pushed.normalized().dot(away) < 0.3:
		bad("the blast didn't push the crate away from it (%.2f m, %.2f)" % [pushed.length(), pushed.normalized().dot(away) if pushed.length() > 0.001 else 0.0])
	if told.is_empty() or not bool(told[0].get("blast", false)) or float(told[0].get("damage", 0.0)) <= 0.0 or not far_told.is_empty():
		bad("the blast didn't tell the dummy in its reach (and only it) with its damage (%s, far %d)" % [str(told), far_told.size()])
	if int(shoot_me.get("count")) != 1:
		bad("the blast didn't count as a hit on the shootable in its reach (%d)" % int(shoot_me.get("count")))
	if heard2.filter(func(x): return float(x[1]) >= 5.0).is_empty():
		bad("the blast wasn't heard as loud as it is (%s)" % str(heard2))
	if bl_shook < 0.002 or bl_settled > 0.0005:
		bad("the view wasn't shaken by the blast and settled after (%.3f, %.3f)" % [bl_shook, bl_settled])
	await press(KEY_T)
	say("kinds back", "T: loading %s again, %d of them" % [str((g("load_kind") as Resource).get("id")), int(g("spare"))])
	if str((g("load_kind") as Resource).get("id")) != "buckshot" or int(g("spare")) != spare_n:
		bad("T didn't go back to the buckshot (%s, %d)" % [str((g("load_kind") as Resource).get("id")), int(g("spare"))])
	for n in [crate2, dum2, far2, ghost2]:
		n.queue_free()
	await until(func() -> bool: return not g("busy"), 2.0)
	player.global_position = spot

	# 8i. things that break when they're shot (HSBlowUp, docs/research/breaking_props.md): a kettle, a b_mug of tea and a
	# b_box of shells on the corridor's floor, their b_kinds guessed, cut when they load; two pellets dent the kettle
	# without breaking it; a close shot breaks each into its own pieces (its own materials and the inside's, smaller near
	# the hit, flying away from the gun, the pellets' holes going with them), the thing gone and its collider with it;
	# the b_box's shells and lid whole, the b_mug's tea a b_pool; at rest on the floor in a few seconds, none through it;
	# a piece kicked walking into it; the explosive's blast breaking a second kettle all to small pieces; put back
	player.global_position = spot
	await fill()
	var bspot := Vector3(spot.x - 2.2, fl, spot.z)
	var bu := {}
	for spec in [["Kettle", "electric_kettle", Vector3(0, 0, -0.3)], ["Mug", "mug_stoneware", Vector3(0.1, 0, 0.12)],
			["Box", "shells_box_5", Vector3(0, 0, 0.45)], ["Kettle2", "electric_kettle", Vector3(5.2, 0, 0.1)]]:
		var th := (load("res://addons/horrorstudio_weapons/models/%s.glb" % spec[1]) as PackedScene).instantiate() as Node3D
		th.name = spec[0]
		main.add_child(th)
		th.global_position = bspot + (spec[2] as Vector3)
		var b := HSBlowUp.new()
		th.add_child(b)
		bu[spec[0]] = b
	var all_cut := false
	var cut_t0 := Time.get_ticks_msec()
	while Time.get_ticks_msec() - cut_t0 < 20000:              # (the wall's clock: headless at a fixed rate, frames race)
		all_cut = true
		for b in bu.values():
			if not (b as HSBlowUp).is_prepared():
				all_cut = false
		if all_cut:
			break
		await frames(1)
	var rk: Dictionary = (bu["Kettle"] as HSBlowUp).report()
	var b_kinds := [str(rk["kind"]), str((bu["Mug"] as HSBlowUp).report()["kind"]), str((bu["Box"] as HSBlowUp).report()["kind"])]
	say("blowup cut", "cut when they loaded: %s; kinds %s; the kettle %s, the mug %s leaves, the box %s whole" % [all_cut, str(b_kinds),
		JSON.stringify(rk["cut"]), (bu["Mug"] as HSBlowUp).report()["leaves"], (bu["Box"] as HSBlowUp).report()["whole"]])
	if not all_cut or b_kinds != ["metal", "ceramic", "cardboard"] or int(rk["leaves"]) < 8:
		bad("the things weren't cut when they loaded or their kinds weren't guessed (%s, %s, %d leaves)" % [all_cut, str(b_kinds), int(rk["leaves"])])
	var kettle: HSBlowUp = bu["Kettle"]
	var khost := kettle.get_parent() as Node3D
	var kmesh := khost.find_children("*", "MeshInstance3D", true, false)[0] as MeshInstance3D
	var kmesh0 := kmesh.mesh
	var kbody := khost.get_node_or_null("BlowUpBody") as CollisionObject3D
	var kmid := khost.global_position + Vector3(0, 0.1, 0)
	# two pellets from afar: dented, not broken
	var bspace := main.get_world_3d().direct_space_state
	var b_kq := PhysicsRayQueryParameters3D.create(kmid + Vector3(2.0, 0.02, 0.0), kmid, 1)
	var b_kh := bspace.intersect_ray(b_kq)
	var b_weak: Array = []
	if not b_kh.is_empty():
		for i in 2:
			b_weak.append({"point": (b_kh["position"] as Vector3) + Vector3(0, 0.025 * i, 0.012 * i), "normal": b_kh["normal"], "collider": b_kh["collider"],
				"dir": Vector3(-1, 0, 0), "damage": 1.0, "pellet": i})
	gun.fired.emit(b_weak)
	await frames(2)
	var dent_mm := 0.0
	if kmesh.mesh != kmesh0 and not b_weak.is_empty():
		var dp0: PackedVector3Array = kmesh0.surface_get_arrays(0)[Mesh.ARRAY_VERTEX]
		var dp1: PackedVector3Array = kmesh.mesh.surface_get_arrays(0)[Mesh.ARRAY_VERTEX]
		var dat_l := kmesh.global_transform.affine_inverse() * (b_weak[0]["point"] as Vector3)
		for i in mini(dp0.size(), dp1.size()):
			if dp0[i].distance_to(dat_l) < 0.03:
				dent_mm = maxf(dent_mm, dp0[i].distance_to(dp1[i]) * 1000.0)
	say("blowup dent", "two pellets from afar on the kettle (%s): broken %s, worn %.1f of %.1f, %d dents, pushed in %.1f mm" % [
		b_kh.get("collider").name if not b_kh.is_empty() else "MISSED", kettle.is_broken, kettle.damage, float(rk["strength"]), int(kettle.report()["dents"]), dent_mm])
	if b_kh.is_empty() or kettle.is_broken or kettle.damage < 1.9 or int(kettle.report()["dents"]) != 2 or dent_mm < 2.0:
		bad("two pellets didn't dent the kettle without breaking it (%s, %.1f worn, %.1f mm)" % [kettle.is_broken, kettle.damage, dent_mm])
	# a close shot: broken into its own pieces
	player.global_position = Vector3(khost.global_position.x + 1.7, player.global_position.y, khost.global_position.z)
	player.velocity = Vector3.ZERO
	await frames(2)
	look(kmid)
	await frames(4)
	var kmats: Array = []
	for s in kmesh.mesh.get_surface_count():
		kmats.append(kmesh.get_active_material(s))
	var b_marks0 := marks()
	gun.pull()
	await frames(3)
	var b_kl: Dictionary = kettle.last
	var b_own := 0
	var b_ins := 0
	var b_vel := 0.0
	var b_nr := 0
	for p in kettle.pieces_out:
		if not is_instance_valid(p):
			continue
		for mi in (p as Node).find_children("*", "MeshInstance3D", true, false):
			var b_m := (mi as MeshInstance3D).mesh
			for s in b_m.get_surface_count():
				var mat := b_m.surface_get_material(s)
				if kmats.has(mat):
					b_own += 1
				elif mat is ShaderMaterial and str((mat as ShaderMaterial).shader.resource_path).ends_with("inside.gdshader"):
					b_ins += 1
		if p is RigidBody3D:
			b_vel += (p as RigidBody3D).linear_velocity.dot(-eye.global_basis.z)
			b_nr += 1
	b_vel /= maxf(float(b_nr), 1.0)
	var b_sizes: Array = (b_kl.get("sizes", []) as Array).duplicate()
	b_sizes.sort_custom(func(a, b_c): return a.y < b_c.y)
	var b_half := b_sizes.size() / 2
	var b_near := 0.0
	var b_far := 0.0
	for i in b_sizes.size():
		if i < b_half:
			b_near += b_sizes[i].x / maxf(b_half, 1)
		else:
			b_far += b_sizes[i].x / maxf(b_sizes.size() - b_half, 1)
	var gone_hit := bspace.intersect_ray(PhysicsRayQueryParameters3D.create(eye.global_position, kmid + (kmid - eye.global_position).normalized() * 0.3, 1))
	var through_body: bool = not gone_hit.is_empty() and gone_hit["collider"] == kbody
	say("blowup kettle", "shot from 1.7 m: broken %s into %d pieces (%d rigid, %d little); %d surfaces its own materials, %d the inside; near the hit %.1f cm, away %.1f cm; flying %.1f m/s away from the gun; %d holes went with them (of %d made); gone %s, its collider %s" % [
		kettle.is_broken, int(b_kl.get("pieces", 0)), int(b_kl.get("rigid", 0)), int(b_kl.get("little", 0)), b_own, b_ins, b_near * 100.0, b_far * 100.0, b_vel,
		int(b_kl.get("marks_moved", 0)), marks() - b_marks0, not khost.visible, "STILL THERE" if through_body else "gone"])
	if not kettle.is_broken or int(b_kl.get("pieces", 0)) < 4 or b_own < 4 or b_ins < 2 or b_near >= b_far or b_vel < 0.4 or int(b_kl.get("marks_moved", 0)) < 1 or khost.visible or through_body:
		bad("the kettle didn't break into its own pieces as it should (%s, %d pieces, %d/%d surfaces, %.3f/%.3f, %.2f m/s, %d holes, shown %s, solid %s)" % [
			kettle.is_broken, int(b_kl.get("pieces", 0)), b_own, b_ins, b_near, b_far, b_vel, int(b_kl.get("marks_moved", 0)), khost.visible, through_body])
	# the b_mug and the b_box
	await fill()
	for nm in ["Mug", "Box"]:
		var b: HSBlowUp = bu[nm]
		var h := b.get_parent() as Node3D
		player.global_position = Vector3(h.global_position.x + 1.6, player.global_position.y, h.global_position.z)
		player.velocity = Vector3.ZERO
		await frames(2)
		look(h.global_position + Vector3(0, 0.05, 0))
		await frames(4)
		gun.pull()
		await frames(3)
		await fill()
	var b_mug: HSBlowUp = bu["Mug"]
	var b_box: HSBlowUp = bu["Box"]
	var b_pool := main.get_node_or_null("Mug_pieces/Pool")
	say("blowup mug and box", "the mug broken %s into %d pieces, its tea a pool %s; the box broken %s into %d pieces, %d of them whole (its shells, its lid)" % [
		b_mug.is_broken, int(b_mug.last.get("pieces", 0)), b_pool != null, b_box.is_broken, int(b_box.last.get("pieces", 0)), int(b_box.last.get("whole", 0))])
	if not b_mug.is_broken or int(b_mug.last.get("pieces", 0)) < 10 or b_pool == null:
		bad("the b_mug didn't shatter with its tea spilled (%s, %d pieces, pool %s)" % [b_mug.is_broken, int(b_mug.last.get("pieces", 0)), b_pool != null])
	if not b_box.is_broken or int(b_box.last.get("whole", 0)) < 2:
		bad("the b_box didn't break with its shells and lid whole (%s, %d whole)" % [b_box.is_broken, int(b_box.last.get("whole", 0))])
	# at rest on the floor, none through it
	await secs(4.5)
	var b_still := 0
	var b_rigid := 0
	var b_low := INF
	for b in [kettle, b_mug, b_box]:
		for p in (b as HSBlowUp).pieces_out:
			if not is_instance_valid(p):
				continue
			if p is RigidBody3D:
				b_rigid += 1
				if (p as RigidBody3D).freeze:
					b_still += 1
			for mi in (p as Node).find_children("*", "MeshInstance3D", true, false):
				var b_m := mi as MeshInstance3D
				for s in b_m.mesh.get_surface_count():
					for q in b_m.global_transform * (b_m.mesh.surface_get_arrays(s)[Mesh.ARRAY_VERTEX] as PackedVector3Array):
						b_low = minf(b_low, q.y)
	var b_fell := 0
	for b in [kettle, b_mug, b_box]:
		b_fell += int((b as HSBlowUp).report().get("fell", 0))
	say("blowup rest", "after 4.5 s: %d of %d rigid pieces at rest, the lowest point of any piece %.1f mm from the floor, %d fallen out of the world" % [b_still, b_rigid, (b_low - fl) * 1000.0, b_fell])
	if b_still < b_rigid or b_low < fl - 0.004 or b_fell > 0:
		bad("the pieces didn't come to rest on the floor (%d of %d, lowest %.1f mm)" % [b_still, b_rigid, (b_low - fl) * 1000.0])
	# walked into: kicked
	var b_kp: RigidBody3D = null
	for p in kettle.pieces_out:
		if is_instance_valid(p) and p is RigidBody3D and (p as RigidBody3D).freeze and (b_kp == null or (p as RigidBody3D).global_position.x > b_kp.global_position.x):
			b_kp = p
	var kick_moved := 0.0
	if b_kp != null:
		var b_kat := b_kp.global_position
		player.global_position = Vector3(b_kat.x + 0.9, player.global_position.y, b_kat.z)
		player.velocity = Vector3.ZERO
		await frames(2)
		look(Vector3(b_kat.x - 1.0, eye.global_position.y, b_kat.z))
		await frames(2)
		var b_wd := InputEventKey.new()
		b_wd.physical_keycode = KEY_W
		b_wd.keycode = KEY_W
		b_wd.pressed = true
		Input.parse_input_event(b_wd)
		await secs(1.0)
		var b_wu := b_wd.duplicate() as InputEventKey
		b_wu.pressed = false
		Input.parse_input_event(b_wu)
		await secs(0.6)
		kick_moved = b_kp.global_position.distance_to(b_kat) if is_instance_valid(b_kp) else 0.0
	say("blowup kick", "walked into a piece of the kettle: it moved %.1f cm" % (kick_moved * 100.0))
	if b_kp == null or kick_moved < 0.03:
		bad("a piece walked into wasn't kicked (%.3f m)" % kick_moved)
	# the explosive's blast: the second kettle all to small pieces, its broken faces scorched
	player.global_position = spot
	player.velocity = Vector3.ZERO
	await fill(0)
	gun.add_shells(1, exk)
	await press(KEY_T)
	gun.reload()
	await frames(2)
	await until(func() -> bool: return not g("busy"), 5.0)
	var k2: HSBlowUp = bu["Kettle2"]
	var k2h := k2.get_parent() as Node3D
	player.global_position = Vector3(k2h.global_position.x - 3.0, player.global_position.y, k2h.global_position.z)   # (east of the mess)
	await frames(2)
	look(k2h.global_position + Vector3(0, 0.1, 0))
	await frames(4)
	gun.pull()
	await frames(4)
	var k2l: Dictionary = k2.last
	var sc_v = (k2.get("_inside") as ShaderMaterial).get_shader_parameter("scorch") if k2.get("_inside") != null else null
	var b_scorch := float(sc_v) if sc_v != null else 0.0
	say("blowup blast", "the explosive at the second kettle: broken %s by its blast %s into %d pieces of %d leaves, its broken faces scorched %.2f" % [
		k2.is_broken, k2l.get("blast", false), int(k2l.get("pieces", 0)), int(k2l.get("leaves", 0)), b_scorch])
	if not k2.is_broken or not bool(k2l.get("blast", false)) or int(k2l.get("pieces", 0)) < int(k2l.get("leaves", 0)) * 0.6 or b_scorch <= 0.0:
		bad("the blast didn't break the second kettle all to small pieces (%s, %s, %d of %d, %.2f)" % [k2.is_broken, k2l.get("blast", false), int(k2l.get("pieces", 0)), int(k2l.get("leaves", 0)), b_scorch])
	await press(KEY_T)
	# put back
	kettle.restore()
	await frames(3)
	var back_ok: bool = khost.visible and kettle.pieces_out.is_empty() and not kettle.is_broken and kmesh.mesh == kmesh0 \
		and kbody != null and kbody.collision_layer != 0
	say("blowup restore", "the kettle put back: shown %s, solid %s, its pieces gone %s, its dents out %s" % [khost.visible,
		kbody != null and kbody.collision_layer != 0, kettle.pieces_out.is_empty(), kmesh.mesh == kmesh0])
	if not back_ok:
		bad("the kettle wasn't put back as it was")
	for b in bu.values():
		(b as HSBlowUp).get_parent().queue_free()
	for nm in ["Kettle_pieces", "Mug_pieces", "Box_pieces", "Kettle2_pieces"]:
		var b_c := main.get_node_or_null(nm)
		if b_c != null:
			b_c.queue_free()
	player.global_position = spot
	player.velocity = Vector3.ZERO
	await until(func() -> bool: return not g("busy"), 2.0)

	# 8j. someone who bleeds black ichor (HSHitReact, docs/research/hit_reactions.md): MHR's body standing down the
	# corridor with its arms down, a script walking her at you (as the chase does) and an HSHitReact under her. Hitboxes
	# on her bones on a layer of their own the player never bumps into; the right barrel into her chest as she comes:
	# her hitboxes hit, no crater on her, a torso hit, staggered, her spine flinching back, held where she is against her
	# walk and shoved back, walking again after; a wound on her riding her bone, ichor round her, black smoke out of the
	# wound a moment later; the left barrel into her head: twice a pellet's damage, her head snapped back; two pellets in
	# her leg not staggering her, five more doing it; a blast reaching three of her hitboxes taken once; shot down: her
	# walk stopped, charring, crumbling, gone into the smoke, hidden, nothing of her solid (a shot goes through where she
	# stood), a pool of ichor where she stood, smoke pouring off her; put back
	await fill()
	player.global_position = spot
	player.velocity = Vector3.ZERO
	var r_at := Vector3(spot.x - 3.0, fl, spot.z)
	var r_her := (load("res://bodies/MHR.fbx") as PackedScene).instantiate() as Node3D
	r_her.name = "Her"
	main.add_child(r_her)
	r_her.global_position = r_at
	r_her.rotation.y = PI / 2.0                                  # (she faces +Z in her own frame: turned to you, east)
	var r_sk := r_her.find_children("*", "Skeleton3D", true, false)[0] as Skeleton3D
	for r_side in [["l_uparm", -1.0], ["r_uparm", 1.0]]:         # (her arms down: the starter's arms_down.gd's way)
		var r_bi := r_sk.find_bone(r_side[0])
		var r_rest := r_sk.get_bone_global_rest(r_bi)
		r_sk.set_bone_global_pose(r_bi, Transform3D(Basis(Vector3(0, 0, 1), deg_to_rad(52.0 * float(r_side[1]))) * r_rest.basis, r_rest.origin))
	var r_walk := Node.new()
	r_walk.name = "Walk"
	r_walk.set_script(made("extends Node\nvar v := Vector3.ZERO\nvar stopped := false\nfunc _process(dt: float) -> void:\n\tif not stopped:\n\t\t(get_parent() as Node3D).global_position += v * dt\nfunc stop(_a = null, _b = null) -> void:\n\tstopped = true\n"))
	r_her.add_child(r_walk)
	var hr := HSHitReact.new()
	hr.health = 60.0
	r_her.add_child(hr)
	var r_ev: Array = []
	hr.staggered.connect(func(_s: float) -> void: r_ev.append("staggered"))
	hr.down.connect(func() -> void: r_ev.append("down"))
	await frames(4)
	var r_rep := hr.report()
	var r_on_layer := 0
	for b in hr._boxes:
		if (b as CollisionObject3D).collision_layer == HSHitReact.HITBOX_LAYER:
			r_on_layer += 1
	var r_bumps := (player.collision_mask & HSHitReact.HITBOX_LAYER) != 0
	say("hitreact set", "%d hitboxes on her bones, %d on layer 11; her parts %s; the player bumps into them %s" % [int(r_rep["boxes"]), r_on_layer,
		str(r_rep["roles"]), r_bumps])
	if int(r_rep["boxes"]) < 15 or r_on_layer != int(r_rep["boxes"]) or r_bumps or not (r_rep["roles"] as Array).has("head") or not (r_rep["roles"] as Array).has("upleg_l"):
		bad("her hitboxes weren't made on her bones on layer 11 (%d boxes, %d on it; the player bumps them %s)" % [int(r_rep["boxes"]), r_on_layer, r_bumps])
	var r_spine: Array = hr._roles["spine"]
	var r_top: int = r_spine[r_spine.size() - 1]
	var r_head: int = hr._roles["head"]
	var r_peak := [0.0, 0.0]
	hr._flinch.modification_processed.connect(func() -> void:
		r_peak[0] = maxf(r_peak[0], r_sk.get_bone_pose_rotation(r_top).angle_to(r_sk.get_bone_rest(r_top).basis.get_rotation_quaternion()))
		r_peak[1] = maxf(r_peak[1], r_sk.get_bone_pose_rotation(r_head).angle_to(r_sk.get_bone_rest(r_head).basis.get_rotation_quaternion())))
	# the right barrel into her chest as she walks at you
	var r_chest := r_sk.global_transform * r_sk.get_bone_global_pose(r_spine[mini(2, r_spine.size() - 1)]).origin
	look(r_chest)
	await frames(4)
	var r_way := ((player.global_position - r_her.global_position) * Vector3(1, 0, 1)).normalized()
	r_walk.set("v", r_way * 0.8)
	await frames(6)
	var r_marks0 := hr.marks.size()
	var r_dist := player.global_position.distance_to(r_her.global_position)
	gun.pull()
	await frames(1)
	var r_from := r_her.global_position
	var r_hits: Array = g("last_hits")
	var r_on := 0
	for h in r_hits:
		var r_hc = h.get("collider")
		if r_hc is Node and is_instance_valid(r_hc) and r_her.is_ancestor_of(r_hc):
			r_on += 1
	var r_ls: Dictionary = impacts().get("last_shot")
	var r_craters := (r_ls.get("marks", []) as Array).size()
	var r_l1: Dictionary = hr.last.duplicate()
	await secs(0.4)
	var r_held := (r_her.global_position - r_from).dot(r_way)
	var r_wounds := 0
	var r_wound_ooze := 0
	for r_at2 in hr._attach.values():
		for r_c in (r_at2 as Node).get_children():
			if r_c is Decal or r_c is HSOoze:
				r_wounds += 1
			if r_c is HSOoze and (r_c as HSOoze).kind == HSOoze.Kind.WOUND:
				r_wound_ooze += 1
	var r_smoke := hr._smoke.filter(func(e) -> bool: return e["kind"] == "wound").size()
	var r_spray := hr.marks.size() - r_marks0
	say("hitreact chest", "the right barrel from %.1f m as she came: %d of %d pellets on her, %d craters on her (the surface %s); a %s hit for %.1f, staggered %s; her spine back %.1f°; held against her walk: %.2f m along it; %d wounds on her, %d marks of ichor round her, %d wounds smoking" % [
		r_dist, r_on, r_hits.size(), r_craters, str(r_ls.get("surface", "")), str(r_l1.get("part", "")), float(r_l1.get("damage", 0.0)),
		r_l1.get("staggered", false), rad_to_deg(r_peak[0]), r_held, r_wounds, r_spray, r_smoke])
	if r_on < maxi(r_hits.size() - 1, 6) or r_craters > 0 or str(r_l1.get("part", "")) != "torso" or not bool(r_l1.get("staggered", false)) \
			or rad_to_deg(r_peak[0]) < 3.0 or r_held > 0.02 or r_wounds < 1 or r_spray < 1 or r_smoke < 1:
		bad("the shot into her chest: %d of %d on her, %d craters, a %s hit, staggered %s, flinched %.1f°, held %.2f, %d wounds, %d marks, %d smoking" % [
			r_on, r_hits.size(), r_craters, str(r_l1.get("part", "")), r_l1.get("staggered", false), rad_to_deg(r_peak[0]), r_held, r_wounds, r_spray, r_smoke])
	await secs(0.9)
	var r_walked := (r_her.global_position - r_from).dot(r_way)
	var r_spray2 := hr.marks.size() - r_marks0
	var r_floor := 0
	var r_oozes := 0
	var r_kinds := {}
	var r_mats := {}
	var r_aged := INF
	for r_m in hr.marks.slice(r_marks0):
		if not is_instance_valid(r_m):
			continue
		if absf((r_m as Node3D).global_position.y - fl) < 0.12:
			r_floor += 1
		if r_m is HSOoze:
			r_oozes += 1
			var r_k := int((r_m as HSOoze).kind)
			r_kinds[r_k] = int(r_kinds.get(r_k, 0)) + 1
			if not r_mats.has(r_k):
				r_mats[r_k] = {}
			r_mats[r_k][(r_m as HSOoze).material_override] = true
			r_aged = minf(r_aged, (r_m as HSOoze).now())
	var r_shared := true
	for r_k in r_mats:
		if (r_mats[r_k] as Dictionary).size() != 1:
			r_shared = false
	say("hitreact walk", "the stagger over, her walk takes her on again: from %.2f to %.2f m along it; the drops landed: %d marks of ichor round her, %d on the floor" % [
		r_held, r_walked, r_spray2, r_floor])
	if r_walked < r_held + 0.2:
		bad("after the stagger she didn't walk on (%.2f to %.2f)" % [r_held, r_walked])
	if r_spray2 < 4 or r_floor < 2:
		bad("the ichor didn't land round her (%d marks, %d on the floor)" % [r_spray2, r_floor])
	# the ichor alive (HSOoze, the user's "black gothic blood that will fit our vhs camhybrid look and look eery and
	# oozy"): every mark an ooze on Forward+, sprays and drops, one material a kind for all of them, aging as they lie;
	# her wound a wound's ooze on her bone
	say("hitreact ooze", "%d of %d marks round her alive (kinds %s: 0 spray, 3 drop), one material a kind %s, the youngest %.2f s old; %d wound oozing on her" % [
		r_oozes, r_spray2, JSON.stringify(r_kinds), r_shared, r_aged, r_wound_ooze])
	if r_oozes != r_spray2 or not r_kinds.has(HSOoze.Kind.SPRAY) or not r_kinds.has(HSOoze.Kind.DROP) or not r_shared or r_aged < 0.25 or r_wound_ooze < 1:
		bad("the ichor isn't alive as it should be (%d of %d oozes, kinds %s, shared %s, aged %.2f, %d wound oozing)" % [r_oozes, r_spray2, JSON.stringify(r_kinds), r_shared, r_aged, r_wound_ooze])
	r_walk.set("v", Vector3.ZERO)
	# the left barrel into her head
	await until(func() -> bool: return not g("busy"), 2.0)
	var r_headp := r_sk.global_transform * r_sk.get_bone_global_pose(r_head).origin + Vector3(0, 0.07, 0)
	look(r_headp)
	await frames(4)
	r_peak[1] = 0.0
	gun.pull()
	await frames(1)
	var r_hh: Array = g("last_hits")
	var r_in_head := 0
	var r_else := 0
	for h in r_hh:
		var r_hc2 = h.get("collider")
		if r_hc2 is Node and is_instance_valid(r_hc2) and r_her.is_ancestor_of(r_hc2):
			if str((r_hc2 as Node).get_meta("hs_part", "")) == "head":
				r_in_head += 1
			else:
				r_else += 1
	var r_l2: Dictionary = hr.last.duplicate()
	await secs(0.3)
	var r_want := 2.0 * r_in_head + float(r_else) * 0.6
	say("hitreact head", "the left barrel: %d pellets in her head (%d elsewhere on her), a %s hit for %.1f (twice a pellet each: %.1f to %.1f), her head snapped back %.1f°" % [
		r_in_head, r_else, str(r_l2.get("part", "")), float(r_l2.get("damage", 0.0)), 2.0 * r_in_head, r_want + float(r_else) * 0.4, rad_to_deg(r_peak[1])])
	if r_in_head < 4 or str(r_l2.get("part", "")) != "head" or float(r_l2.get("damage", 0.0)) < 2.0 * r_in_head - 0.01 or rad_to_deg(r_peak[1]) < 10.0:
		bad("the shot into her head: %d pellets in it, a %s hit for %.1f, snapped %.1f°" % [r_in_head, str(r_l2.get("part", "")), float(r_l2.get("damage", 0.0)), rad_to_deg(r_peak[1])])
	# her leg: two pellets don't stagger her, five more do (the counter builds over hits)
	await secs(1.2)
	var r_leg := (hr._boxes.filter(func(b) -> bool: return str(b.name).ends_with("l_lowleg")) as Array)
	var r_ev_leg := ""
	if not r_leg.is_empty():
		var r_lb := r_leg[0] as Node3D
		var r_pell := func(n: int) -> Array:
			var out: Array = []
			for i in n:
				out.append({"point": r_lb.global_position + Vector3(0, 0.02 * i, 0), "normal": r_way, "collider": r_lb, "dir": -r_way, "damage": 1.0, "pellet": i})
			return out
		r_ev.clear()
		gun.fired.emit(r_pell.call(2))
		await frames(2)
		var r_st1 := r_ev.count("staggered")
		var r_dl := float(hr.last.get("damage", 0.0))
		gun.fired.emit(r_pell.call(5))
		await frames(2)
		var r_st2 := r_ev.count("staggered")
		r_ev_leg = "two pellets: %.1f, a %s hit, staggered %d; five more: staggered %d" % [r_dl, str(hr.last.get("part", "")), r_st1, r_st2]
		if r_st1 != 0 or r_st2 != 1 or absf(r_dl - 1.2) > 0.01:
			bad("her leg: %s" % r_ev_leg)
	else:
		bad("no hitbox on her left lower leg")
	say("hitreact leg", r_ev_leg)
	# a blast reaching three of her hitboxes: taken once, its strongest
	var r_bl: Array = []
	for i in 3:
		r_bl.append({"point": (hr._boxes[i] as Node3D).global_position, "normal": r_way, "collider": hr._boxes[i], "dir": -r_way,
			"damage": [3.0, 5.0, 4.0][i], "blast": true, "from": r_her.global_position + r_way * 1.5 + Vector3(0, 1.0, 0)})
	var r_d0 := hr.damage
	gun.fired.emit(r_bl)
	await frames(2)
	say("hitreact blast", "a blast reaching three of her hitboxes (3, 5 and 4 of harm): %.1f taken, a blast %s" % [hr.damage - r_d0, hr.last.get("blast", false)])
	if absf(hr.damage - r_d0 - 5.0) > 0.01 or not bool(hr.last.get("blast", false)):
		bad("the blast on three hitboxes took %.1f, not its strongest once (5)" % [hr.damage - r_d0])
	# shot down as she walks at you
	await secs(1.0)
	r_walk.set("v", r_way * 0.8)
	r_ev.clear()
	await frames(3)
	hr.shoot(r_her.global_position + Vector3(0, 1.3, 0), -r_way, 60.0)
	await frames(2)
	var r_was_down := hr.is_down
	await secs(0.6)
	var r_char := 0
	for mi in r_her.find_children("*", "MeshInstance3D", true, false):
		if not (mi is HSOoze) and ((mi as MeshInstance3D).material_overlay != null or (mi as MeshInstance3D).material_override != null):
			r_char += 1
	var r_stopped := bool(r_walk.get("stopped"))
	await until(func() -> bool: return not r_her.visible, 4.0)
	await frames(2)
	var r_solid := 0
	for b in hr._boxes:
		if (b as CollisionObject3D).collision_layer != 0:
			r_solid += 1
	var r_aim := r_her.global_position + Vector3(0, 1.2, 0) - r_way * 0.6
	var r_thr := main.get_world_3d().direct_space_state.intersect_ray(PhysicsRayQueryParameters3D.create(eye.global_position, r_aim, HSGun.SHOT_MASK))
	var r_hit_her: bool = not r_thr.is_empty() and r_thr["collider"] is Node and r_her.is_ancestor_of(r_thr["collider"])
	var r_pool := false
	for r_pm in hr.marks:
		if not is_instance_valid(r_pm):
			continue
		var r_ps := float(r_pm.get("size_m")) if r_pm is HSOoze else (r_pm as Decal).size.x
		var r_pp := (r_pm as Node3D).global_position
		if absf(r_pp.y - fl) < 0.12 and r_ps > 0.5 and Vector2(r_pp.x - r_her.global_position.x, r_pp.z - r_her.global_position.z).length() < 0.4 \
				and (not (r_pm is HSOoze) or (r_pm as HSOoze).kind == HSOoze.Kind.POOL):
			r_pool = true
	var r_going := hr._smoke.filter(func(e) -> bool: return e["kind"] == "going").size()
	say("hitreact down", "shot down %s (%s): her walk stopped %s; charring on %d mesh%s; gone %s, hidden for what hunts %s; %d of her hitboxes solid, a shot through where she stood %s; a pool of ichor where she stood %s; %d sources of smoke pouring off her" % [
		r_was_down, str(r_ev), r_stopped, r_char, "" if r_char == 1 else "es", not r_her.visible, r_her.get_meta("hs_hidden", false), r_solid,
		"meets her" if r_hit_her else "goes through", r_pool, r_going])
	if not r_was_down or not r_ev.has("down") or not r_stopped or r_char != 1 or r_her.visible or not bool(r_her.get_meta("hs_hidden", false)) \
			or r_solid > 0 or r_hit_her or not r_pool or r_going < 3:
		bad("shot down she didn't go as she should (down %s, stopped %s, charred %d, shown %s, %d solid, met %s, a pool %s, %d smoking)" % [
			r_was_down, r_stopped, r_char, r_her.visible, r_solid, r_hit_her, r_pool, r_going])
	hr.restore()
	await frames(2)
	var r_back := 0
	for b in hr._boxes:
		if (b as CollisionObject3D).collision_layer == HSHitReact.HITBOX_LAYER:
			r_back += 1
	var r_left := 0
	for mi in r_her.find_children("*", "MeshInstance3D", true, false):
		if not (mi is HSOoze) and ((mi as MeshInstance3D).material_overlay != null or (mi as MeshInstance3D).material_override != null):
			r_left += 1
	say("hitreact restore", "put back: shown %s, %d of %d hitboxes solid, charred meshes %d, damage %.1f, down %s" % [r_her.visible, r_back, hr._boxes.size(), r_left, hr.damage, hr.is_down])
	if not r_her.visible or r_back != hr._boxes.size() or r_left > 0 or hr.damage != 0.0 or hr.is_down:
		bad("she wasn't put back whole")
	if is_instance_valid(hr._root):
		hr._root.queue_free()
	r_her.queue_free()
	# the ooze off (a look's `ooze`, or a renderer without the depth buffer): flat decals of the same ichor
	var r_plain := Node3D.new()
	r_plain.name = "Plain"
	main.add_child(r_plain)
	r_plain.global_position = r_at
	var r_pmesh := MeshInstance3D.new()
	var r_pcm := CapsuleMesh.new()
	r_pcm.radius = 0.22
	r_pcm.height = 1.7
	r_pmesh.mesh = r_pcm
	r_plain.add_child(r_pmesh)
	r_pmesh.position = Vector3(0, 0.85, 0)
	var hr3 := HSHitReact.new()
	var r_lk := (load("res://addons/horrorstudio_weapons/react/looks/demon.tres") as HSWoundLook).duplicate() as HSWoundLook
	r_lk.ooze = false
	hr3.look = r_lk
	r_plain.add_child(hr3)
	await frames(3)
	hr3.shoot(r_at + Vector3(0, 1.2, 0) + r_way * 0.2, -r_way, 6.0)
	await secs(1.2)
	var r_dec := 0
	var r_alive := 0
	for r_m2 in hr3.marks:
		if r_m2 is Decal:
			r_dec += 1
		elif r_m2 is HSOoze:
			r_alive += 1
	say("hitreact plain", "its look's ooze off: %d decals, %d oozes" % [r_dec, r_alive])
	if r_dec < 1 or r_alive > 0:
		bad("with its ooze off the ichor wasn't plain decals (%d decals, %d oozes)" % [r_dec, r_alive])
	if is_instance_valid(hr3._root):
		hr3._root.queue_free()
	r_plain.queue_free()
	# a stand-in (tutorial v2's figures: meshes, no skeleton, nothing solid): a capsule round it, the part by the height,
	# tilted away from the shot and back upright
	var r_st := Node3D.new()
	r_st.name = "StandIn"
	main.add_child(r_st)
	r_st.global_position = r_at
	for r_spec in [[Vector3(0, 0.75, 0), 0.22, 1.5], [Vector3(0, 1.62, 0), 0.12, 0.24]]:
		var r_mi := MeshInstance3D.new()
		var r_cm := CapsuleMesh.new()
		r_cm.radius = r_spec[1]
		r_cm.height = maxf(r_spec[2], r_spec[1] * 2.0)
		r_mi.mesh = r_cm
		r_st.add_child(r_mi)
		r_mi.position = r_spec[0]
	var hr2 := HSHitReact.new()
	r_st.add_child(hr2)
	await frames(3)
	var r_sp := Vector3(r_at.x, fl + 1.65, r_at.z)
	var r_q := main.get_world_3d().direct_space_state.intersect_ray(PhysicsRayQueryParameters3D.create(eye.global_position, r_sp, HSGun.SHOT_MASK))
	var r_tilt := 0.0
	if not r_q.is_empty() and r_st.is_ancestor_of(r_q["collider"]):
		var r_sh: Array = []
		for i in 9:
			r_sh.append({"point": (r_q["position"] as Vector3) + Vector3(0, 0.01 * (i - 4), 0), "normal": r_q["normal"], "collider": r_q["collider"],
				"dir": (r_sp - eye.global_position).normalized(), "damage": 1.0, "pellet": i})
		gun.fired.emit(r_sh)
		for i in 20:
			await frames(1)
			for r_c2 in r_st.get_children():
				if r_c2 is MeshInstance3D and not (r_c2 is HSOoze):   # (her body's, not her wounds')
					r_tilt = maxf(r_tilt, (r_c2 as Node3D).transform.basis.get_rotation_quaternion().get_angle())
	await secs(1.0)
	var r_upright := true
	for r_c3 in r_st.get_children():
		if r_c3 is MeshInstance3D and not (r_c3 is HSOoze) and (r_c3 as Node3D).transform.basis.get_rotation_quaternion().get_angle() > 0.002:
			r_upright = false
	var r_rep2 := hr2.report()
	say("hitreact stand-in", "a figure of meshes: %d hitbox round it, hit %s (a %s hit), tilted %.1f° away and upright again %s, %d wounds smoking" % [
		int(r_rep2["boxes"]), not r_q.is_empty() and r_st.is_ancestor_of(r_q["collider"]), str(hr2.last.get("part", "")), rad_to_deg(r_tilt), r_upright, int(r_rep2["smoking"])])
	if int(r_rep2["boxes"]) != 1 or hr2.hit_count < 1 or str(hr2.last.get("part", "")) != "head" or rad_to_deg(r_tilt) < 5.0 or not r_upright:
		bad("the stand-in didn't react (%d boxes, %d hits, a %s hit, %.1f°, upright %s)" % [int(r_rep2["boxes"]), hr2.hit_count, str(hr2.last.get("part", "")), rad_to_deg(r_tilt), r_upright])
	if is_instance_valid(hr2._root):
		hr2._root.queue_free()
	r_st.queue_free()
	player.global_position = spot
	player.velocity = Vector3.ZERO
	await until(func() -> bool: return not g("busy"), 2.0)

	# 9. lowered: out of view, the flashlight back on the eye, no shot; raised again
	await fill()
	gun.set_raised(false)
	await secs(0.5)
	var rest: Transform3D = g("_light_rest")
	var light_home := torch.position.distance_to(rest.origin)
	var sh2 := int(g("shots"))
	gun.pull()
	await frames(3)
	var no_shot := int(g("shots")) == sh2
	say("lowered", "drawn %s, the flashlight %.1f mm from its place on the eye, a pull %s" % [gun.visible, light_home * 1000.0, "does nothing" if no_shot else "FIRED"])
	if gun.visible or light_home > 0.001 or not no_shot:
		bad("lowered, the gun's still drawn (%s), the flashlight not back (%.1f mm) or it fires (%s)" % [gun.visible, light_home * 1000.0, not no_shot])
	gun.set_raised(true)
	await secs(0.5)
	if not gun.visible or float(g("_lower")) > 0.01:
		bad("raised, the gun isn't back in view")

	# 10. the box of shells taken with E
	var box := main.get_node("Shells") as Node3D
	var sp := int(g("spare"))
	player.global_position = box.global_position + Vector3(0.8, 0, 0)
	player.velocity = Vector3.ZERO
	await frames(2)
	look(box.global_position + Vector3(0, 0.04, 0))
	await frames(3)
	var used: Node = player.call("use")
	var used_name := str(used.name) if used != null else ""
	await frames(2)
	say("shells", "E took %s: spare %d to %d, the box %s" % [used_name if used_name != "" else "nothing", sp, int(g("spare")), "gone" if not is_instance_valid(box) or box.is_queued_for_deletion() else "STILL THERE"])
	if used_name != "Shells" or int(g("spare")) != sp + 5 or (is_instance_valid(box) and not box.is_queued_for_deletion()):
		bad("the box of shells wasn't taken (spare %d to %d)" % [sp, int(g("spare"))])

	# 11. the gun itself found on the floor: not carried until it's taken with E, then drawn up into view
	gun.set("owned", false)
	gun.set("_lower", 1.0)
	gun.set("raised", true)
	await frames(2)
	var pk := Node3D.new()
	pk.set_script(load("res://addons/horrorstudio_weapons/pickup.gd"))
	pk.set("kind", "double")
	pk.set("shells", 4)
	pk.name = "ShotgunOnFloor"
	main.add_child(pk)
	pk.global_position = player.global_position + Vector3(-0.9, 0, 0)
	pk.global_position.y = fl
	await frames(3)
	var hidden_before: bool = not gun.visible
	look(pk.global_position + Vector3(0, 0.03, 0))
	await frames(3)
	var sp3 := int(g("spare"))
	var took_gun: Node = player.call("use")
	var took_name := str(took_gun.name) if took_gun != null else ""
	await secs(0.6)
	say("pickup", "not carried, the gun %s; E took %s: owned %s, drawn %s, spare %d to %d" % ["hidden" if hidden_before else "SHOWN", took_name if took_name != "" else "nothing",
		g("owned"), gun.visible and float(g("_lower")) < 0.01, sp3, int(g("spare"))])
	if not hidden_before or took_name != "ShotgunOnFloor" or not g("owned") or not gun.visible or float(g("_lower")) > 0.01 or int(g("spare")) != sp3 + 4:
		bad("the gun on the floor wasn't taken and drawn into view (hidden first %s, owned %s, lower %.2f, spare %d)" % [hidden_before, g("owned"), float(g("_lower")), int(g("spare"))])

	print("WEAPONS result " + JSON.stringify({"errors": errors}))
	quit()
