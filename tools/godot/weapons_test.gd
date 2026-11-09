## WEAPONS's playthrough (tools/godot/weapons_check.py): the weapons plugin's shotgun under the starter's player's eye
## in the hotel corridor, played headless (--fixed-fps 60). Its place in the view (low on the right, the barrel's line
## on the view's middle), drawn as a view model (no shadow, z-clipped), the flashlight carried under its barrel; a shot
## at a dummy (the pellets in their cone, a hole each, the dummy told, the noise heard, the ears ringing, the kick), the
## pump racked by itself (back to its stop, the bolt's face gone while open, the hull out of the port and onto the
## floor, the next shell in), a crate pushed, the tube fired dry to a click, the reload a shell at a time (each one
## from under the gun into the port and on into the tube, the count, the pump racked), a reload stopped by a shot that
## fires as soon as it can, never faster than the flash limit, the keys (left click, R, Q), the box of shells taken
## with E, lowered and raised, and the gun itself picked up and drawn into view. Prints `WEAPONS <what> <how>` lines
## and `WEAPONS result {errors}`, quits.
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


## a step that never comes back (a script error stops a coroutine where it is): what's known so far, then out
func _watchdog() -> void:
	bad("the playthrough stopped before the end (a script error above?)")
	print("WEAPONS result " + JSON.stringify({"errors": errors}))
	quit()


func _initialize() -> void:
	create_timer(240.0).timeout.connect(_watchdog)
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
	if gun == null or g("_pump") == null or g("_bolt") == null or g("_trigger") == null:
		bad("the gun or its parts (pump, bolt, trigger) not found: the glb's propgen_part extras")
		print("WEAPONS result " + JSON.stringify({"errors": errors}))
		quit()
		return
	var listener := Node.new()
	listener.set_script(made("extends Node\nvar got: Array = []\nfunc _ready() -> void:\n\tadd_to_group(\"hs_listener\")\nfunc heard(at: Vector3, loud: float) -> void:\n\tgot.append([at, loud])\n"))
	main.add_child(listener)
	var fired_n := [0]
	var racked_log: Array = []
	var shell_log: Array = []
	var empties := [0]
	var t_now := [0.0]
	process_frame.connect(func() -> void: t_now[0] += 1.0 / 60.0)
	gun.fired.connect(func(_h: Array) -> void: fired_n[0] += 1)
	gun.racked.connect(func(spent: bool) -> void: racked_log.append(spent))
	gun.shell_in.connect(func(n: int) -> void: shell_log.append([n, t_now[0]]))
	gun.empty.connect(func() -> void: empties[0] += 1)

	# 1. where it's held: low on the right, its barrel's line meeting the view's middle aim_at_m ahead
	look(eye.global_position + Vector3(-1, 0, 0))
	await frames(30)
	var mz: Vector3 = gun.call("_at", "muzzle")
	var ch: Vector3 = gun.call("_at", "chamber")
	var c := eye.to_local(ch)
	var m := eye.to_local(mz)
	var smz := on_screen(m)
	var sch := on_screen(c)
	var bore := (m - c).normalized()
	var aim := float(g("aim_at_m"))
	var meet := c + bore * ((-aim - c.z) / bore.z)
	say("held", "the muzzle at (%.2f, %.2f) of the view, the chamber at (%.2f, %.2f), the bore's line %.1f cm off the middle %.1f m ahead" % [
		smz.x, smz.y, sch.x, sch.y, Vector2(meet.x, meet.y).length() * 100.0, aim])
	if smz.x < 0.5 or smz.x > 0.66 or smz.y < 0.48 or smz.y > 0.72:
		bad("the muzzle isn't toward the view's middle (%.2f, %.2f)" % [smz.x, smz.y])
	var bt := eye.to_local(gun.call("_at", "shoulder"))
	var sbt := on_screen(bt)
	if sch.x < 0.62 or sch.y < 0.7 or (bt.z < -0.05 and sbt.x < 1.0 and sbt.y < 1.0):
		bad("the receiver isn't low on the right with the stock out of the view (the chamber at %.2f, %.2f; the butt %.2f, %.2f)" % [sch.x, sch.y, sbt.x, sbt.y])
	if Vector2(meet.x, meet.y).length() > 0.04:
		bad("the barrel's line misses the view's middle by %.1f cm" % (Vector2(meet.x, meet.y).length() * 100.0))
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
	var ls := gun.get("_sock")["light"] as Node3D
	var off := eye.to_local(torch.global_position).distance_to(eye.to_local(ls.global_position))
	var ang := rad_to_deg((-torch.global_basis.z).angle_to(ls.global_basis.y))
	say("flashlight", "carried %.1f cm from the barrel's light socket, its beam %.1f° off the socket's way" % [off * 100.0, ang])
	if off > 0.01 or ang > 3.0:
		bad("the flashlight isn't under the barrel while it's raised (%.1f cm, %.1f°)" % [off * 100.0, ang])
	var mode_ok := Input.mouse_mode == Input.MOUSE_MODE_CAPTURED

	# 2. a shot at a dummy that knows it's shot
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
	var p0: float = player.get("pitch")
	var fwd0 := -eye.global_basis.z
	var from0 := eye.global_position
	gun.pull()
	await frames(1)
	var hits: Array = g("last_hits")
	var on_dummy := hits.filter(func(h): return h["collider"] == dummy).size()
	var spread := 0.0
	for h in hits:
		var d: Vector3 = (h["point"] as Vector3) - from0
		spread = maxf(spread, rad_to_deg(d.angle_to(fwd0)))
	var kick := rad_to_deg(float(player.get("pitch")) - p0)
	var hud_ctl := gun.find_child("Shells", true, false) as Control
	var heard: Array = listener.get("got")
	say("shot", "%d pellets hit (%d on the dummy, told %d times), the widest %.1f° off the middle, %d holes, heard %s, the ears ringing %.1f s, the view kicked %.1f°, the flash %.1f" % [
		hits.size(), on_dummy, (dummy.get("got") as Array).size(), spread, (g("_holes") as Array).size(),
		str(heard.map(func(x): return x[1])), float(fear.get("_ring")), kick, (g("_flash_light") as Light3D).light_energy])
	if int(g("shots")) != 1 or g("chambered"):
		bad("the shot didn't use the chambered shell (shots %d, chambered %s)" % [int(g("shots")), g("chambered")])
	if on_dummy < int(g("pellets")) - 1 or (dummy.get("got") as Array).size() != on_dummy:
		bad("the pellets missed the dummy 2.5 m ahead or it wasn't told (%d of %d hit, told %d)" % [on_dummy, int(g("pellets")), (dummy.get("got") as Array).size()])
	if spread > float(g("spread_deg")) + 0.6:
		bad("a pellet left the cone (%.1f° > %.1f°)" % [spread, float(g("spread_deg"))])
	if (g("_holes") as Array).size() != hits.size():
		bad("not a hole for each pellet (%d holes, %d hits)" % [(g("_holes") as Array).size(), hits.size()])
	if heard.size() != 1 or absf(float(heard[0][1]) - float(g("noise"))) > 0.01:
		bad("the listeners didn't hear the shot as loud as it is (%s)" % str(heard))
	if float(fear.get("_ring")) < 1.0:
		bad("the ears aren't ringing after the shot (the Fear node's ring)")
	if kick < float(g("recoil_deg")) - 0.5 or kick > float(g("recoil_deg")) + 0.1:
		bad("the view wasn't kicked up by the recoil (%.2f°)" % kick)
	if hud_ctl == null:
		bad("no shells drawn low on the right (the HUD's Shells)")
	if (g("_flash_light") as Light3D).light_energy < 1.0 or not (g("_flash") as Node3D).visible:
		bad("no muzzle flash at the shot")

	# 3. the pump racked by itself: back to its stop (the bolt's face gone), the hull out, forward, the next shell in
	var pump := g("_pump") as Node3D
	var pump0: Vector3 = g("_pump0")
	var travel := (g("_travel") as Vector3).length()
	var most := 0.0
	var bolt_gone := false
	var t_back := -1.0
	var t0: float = t_now[0]
	for i in 60:
		await process_frame
		var dd := pump.position.distance_to(pump0)
		if dd > most:
			most = dd
		if dd > travel * 0.97 and t_back < 0.0:
			t_back = t_now[0] - t0
		if not (g("_bolt") as Node3D).visible:
			bolt_gone = true
	await until(func() -> bool: return not g("busy"), 1.0)
	var settled := rad_to_deg(float(player.get("pitch")) - p0)
	var want_settle := float(g("recoil_deg")) * (1.0 - float(g("recover")))
	say("recoil", "the view kicked %.1f° and settled back to %.1f° above where it was (%.1f wanted)" % [kick, settled, want_settle])
	if absf(settled - want_settle) > 0.35:
		bad("the view didn't settle back after the kick (%.2f°, want %.2f°)" % [settled, want_settle])
	say("rack", "the pump %.1f of %.1f cm back after %.2f s, the bolt's face %s, %d hull out, %s; back home %.1f mm off, loaded %d, chambered %s" % [
		most * 100.0, travel * 100.0, t_back, "gone while open" if bolt_gone else "NEVER GONE", int(g("ejected")), str(racked_log),
		pump.position.distance_to(pump0) * 1000.0, int(g("loaded")), g("chambered")])
	if most < travel * 0.97 or pump.position.distance_to(pump0) > 0.001:
		bad("the pump didn't run back to its stop and home again (%.1f of %.1f cm)" % [most * 100.0, travel * 100.0])
	if not bolt_gone:
		bad("the bolt's face never left the port while the action was open")
	if racked_log != [true] or int(g("ejected")) != 1 or int(g("loaded")) != 3 or not g("chambered"):
		bad("the rack after the shot: racked %s, ejected %d, loaded %d, chambered %s (want [true], 1, 3, true)" % [str(racked_log), int(g("ejected")), int(g("loaded")), g("chambered")])
	var hull_ok := await until(func() -> bool:
		var hs: Array = g("_hulls")
		return hs.size() == 1 and is_instance_valid(hs[0]) and (g("_falling") as Array).is_empty(), 4.0)
	var hulls: Array = g("_hulls")
	if not hull_ok or hulls.is_empty():
		bad("the spent hull never came to rest on the floor (%s)" % (str((hulls[0] as Node3D).global_position) if hulls.size() > 0 else "no hull"))
	else:
		var hn := hulls[0] as Node3D
		var hp := hn.global_position
		var side := eye.global_basis.x.dot(hp - player.global_position)
		var lying := rad_to_deg(asin(clampf(absf(hn.global_basis.y.normalized().y), 0.0, 1.0)))
		var up := (hn.global_transform * Vector3(0, 0.033, 0)).y - fl
		say("hull", "lying %.2f m from the player's feet, %.2f m to the right, its middle %.1f cm over the floor, its axis %.0f° off flat" % [
			Vector2(hp.x - player.global_position.x, hp.z - player.global_position.z).length(), side, up * 100.0, lying])
		if side < 0.05:
			bad("the hull didn't fly out to the right (%.2f m)" % side)
		if up < 0.006 or up > 0.02 or lying > 5.0:
			bad("the hull isn't lying on the floor on its side (its middle %.1f cm up, its axis %.0f° off flat)" % [up * 100.0, lying])

	# 3b. aimed (the right button): the barrel straight ahead under the eye, the lens narrower, the cone tighter
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
	var aspread := 0.0
	for h in (g("last_hits") as Array):
		aspread = maxf(aspread, rad_to_deg(((h["point"] as Vector3) - afrom).angle_to(afwd)))
	await until(func() -> bool: return not g("busy"), 1.5)
	gun.set_aim(false)
	await secs(0.5)
	say("aim", "aimed: the muzzle at (%.2f, %.2f) of the view, the bore %.1f° off straight ahead, the lens %.0f° (from %.0f), the widest pellet %.1f° off; let go: the lens %.0f°, at the hip %s" % [
		asm.x, asm.y, abore, afov, fov0, aspread, eye.fov, float(g("_aim")) < 0.001])
	if absf(asm.x - 0.5) > 0.03 or asm.y < 0.5 or asm.y > 0.6 or abore > 1.0:
		bad("aimed, the barrel isn't straight ahead under the view's middle (%.2f, %.2f; %.1f°)" % [asm.x, asm.y, abore])
	if absf(afov - float(g("aim_fov"))) > 0.5 or absf(eye.fov - fov0) > 0.01:
		bad("the lens didn't narrow while aimed and come back (%.1f, then %.1f from %.1f)" % [afov, eye.fov, fov0])
	if aspread > float(g("spread_deg")) * float(g("aim_spread")) + 0.25:
		bad("aimed, the cone isn't tighter (%.1f°)" % aspread)

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

	# 4. a crate shoved by the shot
	var crate := main.get_node("Crate0") as RigidBody3D
	var cp := crate.global_position
	look(cp)
	await frames(5)
	gun.pull()
	await secs(1.0)
	var moved := crate.global_position.distance_to(cp)
	var carried := crate.get_children().filter(func(c): return c is Decal).size()
	say("crate", "moved %.2f m by the shot, %d holes in it carried with it" % [moved, carried])
	if moved < 0.05:
		bad("the crate didn't move when it was shot (%.3f m)" % moved)
	if carried < 1:
		bad("the holes in the crate stayed where it was (none of its own)")
	await until(func() -> bool: return not g("busy"), 1.0)

	# 5. fired dry: the rest of the tube, then a click; never faster than the flash limit
	look(eye.global_position + Vector3(-5, -0.3, 0))
	var t_first := -1.0
	var first_n: int = fired_n[0]
	for i in 240:
		if not g("busy") and (int(g("loaded")) > 0 or g("chambered")):
			gun.pull()
			if t_first < 0.0:
				t_first = t_now[0]
		await frames(1)
		if int(g("loaded")) == 0 and not g("chambered") and not g("busy"):
			break
	var rate := float(fired_n[0] - first_n - 1) / maxf(0.01, t_now[0] - t_first)
	gun.pull()
	await frames(5)
	say("dry", "%d shots in all, %d hulls out, %.1f shots a second at most, then %d click" % [int(g("shots")), int(g("ejected")), rate, empties[0]])
	if int(g("shots")) != 5 or int(g("ejected")) != 5 or empties[0] != 1:
		bad("the tube didn't fire dry to a click (shots %d, hulls %d, clicks %d; want 5, 5, 1)" % [int(g("shots")), int(g("ejected")), empties[0]])
	if rate > 3.0:
		bad("the gun fires faster than the flash limit (%.1f a second)" % rate)

	# 6. the reload: a shell at a time from under the gun into the port and on into the tube, then the pump racked
	var port: Vector3 = gun.call("_sock_at", "port")
	var tube := pump0.y - port.y
	var paths: Array = [[]]
	var pose_most := [0.0]
	var watch := func() -> void:
		pose_most[0] = maxf(pose_most[0], float(g("_pose")))
		for n in (g("_gun") as Node3D).get_children():
			if str(n.name).begins_with("shell_12ga") and not n.is_queued_for_deletion():
				(paths[paths.size() - 1] as Array).append((n as Node3D).position)
	process_frame.connect(watch)
	gun.shell_in.connect(func(_n: int) -> void: paths.append([]))
	racked_log.clear()
	var spare0 := int(g("spare"))
	var r0: float = t_now[0]
	gun.reload()
	await until(func() -> bool: return not g("busy"), 6.0)
	var took: float = t_now[0] - r0
	process_frame.disconnect(watch)
	var gaps: Array = []
	for i in range(1, shell_log.size()):
		gaps.append(snappedf(float(shell_log[i][1]) - float(shell_log[i - 1][1]), 0.01))
	var bad_paths := 0
	for i in shell_log.size():
		var pth: Array = paths[i] if i < paths.size() else []
		if pth.size() < 4:
			bad_paths += 1
			continue
		var a: Vector3 = pth[0]
		var b: Vector3 = pth[pth.size() - 1]
		if a.y > port.y - 0.08 or b.x < port.x + 0.01 or absf(b.y - (port.y + tube)) > 0.012:
			bad_paths += 1
	say("reload", "%s shells in (%s s apart), spare %d to %d, the gun turned %.2f, %d path%s from under the gun into the tube, racked %s, %.2f s; loaded %d, chambered %s" % [
		str(shell_log.map(func(x): return x[0])), str(gaps), spare0, int(g("spare")), pose_most[0], shell_log.size() - bad_paths,
		"" if shell_log.size() - bad_paths == 1 else "s", str(racked_log), took, int(g("loaded")), g("chambered")])
	if shell_log.map(func(x): return x[0]) != [1, 2, 3, 4] or int(g("spare")) != spare0 - 4:
		bad("the reload didn't put four shells in one at a time (%s, spare %d)" % [str(shell_log.map(func(x): return x[0])), int(g("spare"))])
	for gp in gaps:
		if float(gp) < 0.3 or float(gp) > 0.8:
			bad("a shell went in %.2f s after the last (0.3 to 0.8)" % float(gp))
	if bad_paths > 0:
		bad("%d shell%s didn't rise from under the gun into the port and on into the tube" % [bad_paths, "" if bad_paths == 1 else "s"])
	if pose_most[0] < 0.95:
		bad("the gun wasn't turned to bare its loading port (%.2f)" % pose_most[0])
	if racked_log != [false] or int(g("loaded")) != 3 or not g("chambered") or int(g("ejected")) != 5:
		bad("after the reload: racked %s, loaded %d, chambered %s, hulls %d (want [false], 3, true, 5)" % [str(racked_log), int(g("loaded")), g("chambered"), int(g("ejected"))])

	# 7. a reload stopped by a shot: the shell going in finished, the pump racked, and it fires
	gun.set("loaded", 0)
	gun.set("chambered", false)
	shell_log.clear()
	racked_log.clear()
	var shots0 := int(g("shots"))
	gun.reload()
	await until(func() -> bool: return shell_log.size() >= 1, 2.0)
	gun.pull()
	var fired_ok := await until(func() -> bool: return int(g("shots")) == shots0 + 1, 3.0)
	await until(func() -> bool: return not g("busy"), 2.0)
	say("stopped", "%d shell%s in, then racked %s and fired %s, reloading %s" % [shell_log.size(), "" if shell_log.size() == 1 else "s",
		str(racked_log), "at once" if fired_ok else "NEVER", g("reloading")])
	if shell_log.size() > 2 or not fired_ok or g("reloading") or racked_log.size() < 1 or racked_log[0] != false:
		bad("a shot during a reload didn't stop it and fire (%d shells, racked %s, fired %s)" % [shell_log.size(), str(racked_log), fired_ok])

	# 8. the keys: R reloads, Q lowers and raises; a left click fires (with the mouse captured, as the starter's player has it)
	gun.set("loaded", 2)
	gun.set("chambered", true)
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
		var sh := int(g("shots"))
		await click()
		await until(func() -> bool: return not g("busy"), 1.5)
		clicked = "fired %d" % (int(g("shots")) - sh)
		if int(g("shots")) != sh + 1:
			bad("a left click didn't fire")
	say("keys", "R put %d in, Q lowered it %s and raised it %s; a click %s" % [shell_log.size(), down, up, clicked])
	if shell_log.is_empty() or not down or not up:
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
	gun.set("loaded", 3)
	gun.set("chambered", true)
	await frames(30)
	look(ghost.global_position + Vector3(0, 1.1, 0))
	await frames(3)
	gun.pull()
	await frames(2)
	var gone1: bool = not ghost.visible and ghost.process_mode == Node.PROCESS_MODE_DISABLED
	await secs(0.7)
	var back: bool = ghost.visible and ghost.process_mode != Node.PROCESS_MODE_DISABLED
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

	# 9. lowered: out of view, the flashlight back on the eye, no shot; raised again
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
	pk.set("kind", "shotgun")
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
	if not hidden_before or took_name == "" or not g("owned") or not gun.visible or float(g("_lower")) > 0.01 or int(g("spare")) != sp3 + 4:
		bad("the gun on the floor wasn't taken and drawn into view (hidden first %s, owned %s, lower %.2f, spare %d)" % [hidden_before, g("owned"), float(g("_lower")), int(g("spare"))])

	print("WEAPONS result " + JSON.stringify({"errors": errors}))
	quit()
