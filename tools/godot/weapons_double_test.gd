## WEAPONS's double-barrel half (tools/godot/weapons_check.py): the weapons plugin's HSDoubleBarrel under the starter's
## player's eye in the hotel corridor, played headless (--fixed-fps 60). Only its barrels in the view (the muzzles in
## it, the action and the stock under it); the right barrel fired, then the left, then a click; R: brought up into the
## view and broken open there (the barrels dropped on the hinge, the chambers in the frame), both hulls flicked out
## and falling into the room, a shell popping into each chamber from behind the breech, shut, back down; one barrel
## fired and reloaded (the live shell left, one popped in); a full gun broken and shut (a look); one shell for two
## chambers; a shot during the reload (the loading stopped, shut, fired); the shells' marks; the gun found and taken.
## Prints `DOUBLE <what> <how>` lines and `DOUBLE result {errors}`, quits.
extends SceneTree

var errors: Array = []
var main: Node3D
var player: CharacterBody3D
var eye: Camera3D
var gun: Node3D
var cfg: Dictionary


func say(what: String, how: String) -> void:
	print("DOUBLE %s %s" % [what, how])


func bad(e: String) -> void:
	errors.append(e)
	print("DOUBLE ERROR %s" % e)


func frames(n: int) -> void:
	for i in n:
		await physics_frame


func secs(t: float) -> void:
	await frames(int(ceil(t * 60.0)))


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


func on_screen(p: Vector3) -> Vector2:
	var t := tan(deg_to_rad(eye.fov) / 2.0)
	return Vector2(0.5 + p.x / -p.z / (2.0 * t * 16.0 / 9.0), 0.5 - p.y / -p.z / (2.0 * t))


func g(prop: String):
	return gun.get(prop)


func sock(nm: String) -> Node3D:
	return (gun.get("_sock") as Dictionary).get(nm) as Node3D


func scr(nm: String) -> Vector2:
	return on_screen(eye.to_local(sock(nm).global_position))


func _watchdog() -> void:
	bad("the playthrough stopped before the end (a script error above?)")
	print("DOUBLE result " + JSON.stringify({"errors": errors}))
	quit()


func _initialize() -> void:
	create_timer(200.0).timeout.connect(_watchdog)
	cfg = JSON.parse_string(FileAccess.get_file_as_string("res://weapons.json"))
	var ms := load("res://double.tscn") as PackedScene
	if ms == null:
		bad("double.tscn doesn't load")
		print("DOUBLE result " + JSON.stringify({"errors": errors}))
		quit()
		return
	main = ms.instantiate() as Node3D
	root.add_child(main)
	await frames(10)
	player = main.get_node("Player") as CharacterBody3D
	eye = player.get_node("Eye") as Camera3D
	gun = player.get_node("Eye/Double") as Node3D
	var fl := float(cfg["floor"])
	if gun == null or g("_barrels") == null or g("_lever") == null or g("_trigger2") == null:
		bad("the double or its parts (barrels, lever, rear trigger) not found: the glb's propgen_part extras")
		print("DOUBLE result " + JSON.stringify({"errors": errors}))
		quit()
		return
	var fired_n := [0]
	var shell_log: Array = []
	var opens := [0]
	var shuts := [0]
	var empties := [0]
	gun.fired.connect(func(_h: Array) -> void: fired_n[0] += 1)
	gun.shell_in.connect(func(n: int) -> void: shell_log.append(n))
	gun.broke_open.connect(func() -> void: opens[0] += 1)
	gun.closed.connect(func() -> void: shuts[0] += 1)
	gun.empty.connect(func() -> void: empties[0] += 1)

	# 1. only the barrels in the view: the muzzles in it, the breech and the hinge under it, the stock behind the eye
	look(eye.global_position + Vector3(-1, 0, 0))
	await frames(30)
	var mr := scr("muzzle_r")
	var ml := scr("muzzle_l")
	var br := scr("breech")
	var bh := eye.to_local(sock("breech").global_position)
	var hg := scr("hinge")
	var sh := eye.to_local(sock("shoulder").global_position)
	say("held", "the muzzles at (%.2f, %.2f) and (%.2f, %.2f) of the view, the breech at (%.2f, %.2f), the hinge at (%.2f, %.2f), the butt %.2f m behind the eye" % [
		mr.x, mr.y, ml.x, ml.y, br.x, br.y, hg.x, hg.y, sh.z])
	for m in [mr, ml]:
		if m.x < 0.4 or m.x > 0.75 or m.y < 0.45 or m.y > 0.85:
			bad("a muzzle isn't in the view toward its middle (%.2f, %.2f)" % [m.x, m.y])
	if not (br.y > 1.0 or bh.z > -0.03) or not (hg.y > 0.95):
		bad("more than the barrels in the view: the breech at (%.2f, %.2f), the hinge at (%.2f, %.2f)" % [br.x, br.y, hg.x, hg.y])
	if g("_hud_ctl") == null:
		bad("no shells drawn low on the right")

	# 2. the right barrel, then the left, then a click
	look(eye.global_position + Vector3(-5, -0.4, 0))
	await frames(3)
	gun.pull()
	await frames(2)
	var after1: Array = (g("live") as Array).duplicate()
	var t1: float = (g("_trigger") as Node3D).rotation.distance_to(g("_trig0"))
	await until(func() -> bool: return not g("busy"), 1.0)
	gun.pull()
	await frames(2)
	var t2: float = (g("_trigger2") as Node3D).rotation.distance_to(g("_trig2_0"))
	var after2: Array = (g("live") as Array).duplicate()
	await until(func() -> bool: return not g("busy"), 1.0)
	gun.pull()
	await frames(3)
	say("fire", "first the right %s (its trigger back %s), then the left %s (the rear trigger %s), then %d click; %d shots, spent %s" % [
		str(after1), t1 > 0.01, str(after2), t2 > 0.01, empties[0], int(g("shots")), str(g("spent"))])
	if after1 != [false, true] or after2 != [false, false] or empties[0] != 1 or int(g("shots")) != 2 or fired_n[0] != 2:
		bad("the barrels didn't fire right then left then click (%s, %s, %d clicks, %d shots)" % [str(after1), str(after2), empties[0], int(g("shots"))])
	if t1 < 0.01 or t2 < 0.01:
		bad("the triggers didn't move (front %s, rear %s)" % [t1 > 0.01, t2 > 0.01])

	# 3. the reload: up into the view, broken open there, the hulls flicked out, two shells popped in, shut, down
	var spare0 := int(g("spare"))
	shell_log.clear()
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
	var ang := rad_to_deg((g("_barrels") as Node3D).transform.basis.get_rotation_quaternion().angle_to((g("_barrels0") as Transform3D).basis.get_rotation_quaternion()))
	say("reload", "broken open %d time%s (%.2f of the way, the lever over %.2f), the chambers in the view at (%.2f, %.2f) and (%.2f, %.2f): %s; %d hulls flicked, %s shells popped in, spare %d to %d, shut %d, the barrels %.1f° from shut after; live %s" % [
		opens[0], "" if opens[0] == 1 else "s", most_open[0], lever_most[0], chambers_at[0].x, chambers_at[0].y, chambers_at[1].x, chambers_at[1].y,
		"in frame" if chambers_in[0] else "OUT OF FRAME", int(g("flicked")), str(shell_log), spare0, int(g("spare")), shuts[0], ang, str(g("live"))])
	if opens[0] != 1 or most_open[0] < 0.99 or lever_most[0] < 0.99 or shuts[0] != 1 or ang > 0.5:
		bad("the gun didn't break open on its hinge and shut again (opens %d, %.2f, lever %.2f, shuts %d, %.1f°)" % [opens[0], most_open[0], lever_most[0], shuts[0], ang])
	if not chambers_in[0]:
		bad("broken open, the chambers aren't in the view (%s, %s)" % [str(chambers_at[0]), str(chambers_at[1])])
	if int(g("flicked")) != 2 or shell_log != [1, 2] or g("live") != [true, true] or int(g("spare")) != spare0 - 2:
		bad("the reload didn't throw two hulls out and pop two shells in (flicked %d, %s, live %s, spare %d)" % [int(g("flicked")), str(shell_log), str(g("live")), int(g("spare"))])
	var fell := await until(func() -> bool: return (g("_falling") as Array).is_empty() and (g("_flying") as Array).is_empty(), 4.0)
	var hl: Array = (g("_hulls") as Array).filter(func(h): return is_instance_valid(h))
	var on_floor := hl.filter(func(h): return absf((h as Node3D).global_position.y - fl) < 0.06).size()
	say("hulls", "%d of %d flicked hulls lying on the floor%s; the reload took %.2f s" % [on_floor, hl.size(), "" if fell else " (STILL FALLING)", took])
	if hl.size() < 2 or on_floor < 2:
		bad("the flicked hulls didn't come down on the floor (%d of %d)" % [on_floor, hl.size()])
	if took > 2.2:
		bad("the reload's too slow (%.2f s)" % took)

	# 4. one barrel fired and reloaded: the live one left where it is, one popped in
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

	# 5. full: broken open and shut, a look, nothing thrown out or put in
	shell_log.clear()
	fl0 = int(g("flicked"))
	var opens0: int = opens[0]
	gun.reload()
	await until(func() -> bool: return not g("busy"), 4.0)
	say("look", "a full gun broken open %d time and shut: %d flicked, %d popped in" % [opens[0] - opens0, int(g("flicked")) - fl0, shell_log.size()])
	if opens[0] - opens0 != 1 or int(g("flicked")) != fl0 or not shell_log.is_empty():
		bad("a full gun's look did more than open and shut")

	# 6. one shell for two empty chambers: the right one loaded, the left left empty
	gun.pull()
	await until(func() -> bool: return not g("busy"), 1.0)
	gun.pull()
	await until(func() -> bool: return not g("busy"), 1.0)
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
	gun.set("spare", 6)
	shell_log.clear()
	var shots0 := int(g("shots"))
	gun.reload()
	await until(func() -> bool: return shell_log.size() >= 1, 3.0)
	gun.pull()
	var fired_ok := await until(func() -> bool: return int(g("shots")) == shots0 + 1, 3.0)
	await until(func() -> bool: return not g("busy"), 2.0)
	say("stopped", "%d shell in, then shut and fired %s, open %.2f" % [shell_log.size(), "at once" if fired_ok else "NEVER", float(g("opened"))])
	if shell_log.size() != 1 or not fired_ok or float(g("opened")) > 0.01 or g("reloading"):
		bad("a shot during the reload didn't stop it, shut it and fire (%d in, fired %s)" % [shell_log.size(), fired_ok])

	# 7b. a shell of another kind in one barrel: the explosive popped into the right one (the only one of its kind in
	# the pocket), the left left empty; fired, the right barrel's muzzle flashes its own way, the left's doesn't
	for i in 3:
		gun.pull()
		await until(func() -> bool: return not g("busy"), 1.0)
	var exk = load("res://addons/horrorstudio_weapons/shells/explosive.tres")
	var normal = gun.normal_kind()
	gun.add_shells(1, exk)
	gun.set_load_kind(exk)
	var buck_kept := int((g("pocket") as Dictionary).get("buckshot", -1))
	gun.reload()
	await until(func() -> bool: return not g("busy"), 4.0)
	var kinds_in: Array = (g("barrel_kind") as Array).map(func(k): return str(k.get("id")) if k != null else "none")
	var m0 = gun.muzzle(0)
	var m1 = gun.muzzle(1)
	var s0 := int(m0.get("shots"))
	var s1 := int(m1.get("shots"))
	var im := get_first_node_in_group("hs_impacts")
	var blasts0 := int(im.get("blasts")) if im != null else 0
	gun.pull()
	await frames(1)
	var r0: Dictionary = m0.report()
	im = get_first_node_in_group("hs_impacts")
	var blasted := (int(im.get("blasts")) if im != null else 0) - blasts0
	await until(func() -> bool: return not g("busy"), 2.0)
	say("kinds", "live %s, the chambers' kinds %s; fired: the right muzzle flashed %d (%s), the left %d; %d blast" % [
		str(g("live")), str(kinds_in), int(m0.get("shots")) - s0, r0["look"], int(m1.get("shots")) - s1, blasted])
	if g("live") != [false, false] or kinds_in[0] != "explosive" or int(m0.get("shots")) - s0 != 1 or int(m1.get("shots")) - s1 != 0 or str(r0["look"]) != "Explosive" or blasted != 1:
		bad("the explosive shell in the right barrel didn't fire from its own muzzle with its own flash and blast (%s, %s, %s)" % [str(kinds_in), str(r0), blasted])
	gun.set_load_kind(normal)
	if int(g("spare")) != buck_kept:
		bad("the buckshot kept in the pocket didn't come back with T (%d, %d)" % [int(g("spare")), buck_kept])

	# 8. the double found lying in the room and taken: carried and drawn up
	gun.set("owned", false)
	gun.set("_lower", 1.0)
	gun.set("raised", true)
	await frames(2)
	var pk := Node3D.new()
	pk.set_script(load("res://addons/horrorstudio_weapons/pickup.gd"))
	pk.set("kind", "double")
	pk.set("shells", 2)
	pk.name = "DoubleOnFloor"
	main.add_child(pk)
	pk.global_position = Vector3(player.global_position.x - 0.9, fl, player.global_position.z)
	await frames(3)
	look(pk.global_position + Vector3(0, 0.03, 0))
	await frames(3)
	var sp := int(g("spare"))
	var took_it: Node = player.call("use")
	var took_name := str(took_it.name) if took_it != null else ""
	await secs(0.6)
	say("pickup", "E took %s: owned %s, drawn %s, spare %d to %d" % [took_name if took_name != "" else "nothing", g("owned"), gun.visible and float(g("_lower")) < 0.01, sp, int(g("spare"))])
	if took_name != "DoubleOnFloor" or not g("owned") or not gun.visible or int(g("spare")) != sp + 2:
		bad("the double on the floor wasn't taken and drawn")

	print("DOUBLE result " + JSON.stringify({"errors": errors}))
	quit()
