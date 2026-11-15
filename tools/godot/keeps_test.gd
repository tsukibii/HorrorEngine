## HORRORGAME's look at the starter's once-only scares in a save (tools/horror_game.py check, in the made project): a
## glimpse, the closer figure, feet under a door, writing in the steam, a shadow crossing, the figure in the mirror, a
## dread moment and a checkpoint are in the Story's world (the group hs_keeps). A save made after each has happened, or
## been armed by a signal, loaded into the scene as it started: none plays again and the armed ones are still armed;
## dying after the checkpoint they're as they were at it. Prints `HORRORGAME <what> <how>` and `HORRORGAME result {errors}`.
extends SceneTree

var errors: Array = []


func ok(cond: bool, what: String, how := "") -> void:
	print("HORRORGAME keeps: %s %s" % [what, how])
	if not cond:
		errors.append("keeps: " + what + (" (" + how + ")" if how != "" else ""))


func frames(n: int) -> void:
	for i in n:
		await process_frame


func made(script: String, kids := 1, marks := 0) -> Node3D:
	var n := Node3D.new()
	n.name = script.get_basename().capitalize().replace(" ", "")
	for i in kids:
		var f := Node3D.new()
		f.name = "Figure"
		n.add_child(f)
	for i in marks:
		var m := Marker3D.new()
		m.name = "Mark%d" % i
		n.add_child(m)
	n.set_script(load("res://starter/" + script))
	return n


func happen(glimpse, closer, shadow, mirror_fig, moment, steam, cp) -> void:
	glimpse.set("armed", true)
	glimpse.set("count", 1)
	closer.set("_done", true)
	closer.set("armed", false)
	shadow.set("armed", true)
	mirror_fig.set("_done", true)
	moment.set("count", 1)
	steam.set("count", 1)
	cp.set("count", 1)


func _initialize() -> void:
	create_timer(120.0).timeout.connect(func() -> void:
		errors.append("keeps: the test never ended")
		print("HORRORGAME result " + JSON.stringify({"errors": errors}))
		quit())
	change_scene_to_file("res://main.tscn")
	await frames(20)
	var main := current_scene
	var story := main.get_node("Story")
	var glimpse := made("glimpse.gd")
	var closer := made("closer.gd", 1, 2)
	var shadow := made("shadow_pass.gd")
	var mirror_fig := made("mirror_figure.gd")
	var moment := made("dread_moment.gd", 0)
	var steam := made("steam_mirror.gd", 0)
	var cp := Area3D.new()
	cp.name = "Checkpoint2"
	cp.set_script(load("res://starter/checkpoint.gd"))
	var all: Array = [glimpse, closer, shadow, mirror_fig, moment, steam, cp]
	for n in all:
		main.add_child(n)
		n.position = Vector3(0, -30, 0)                   # (out of the way: nothing here should see them)
	await frames(4)
	ok(all.all(func(n): return n.is_in_group("hs_keeps")), "all seven in the Story's world (hs_keeps)")
	# the checkpoint: as the scene starts
	story.call("checkpoint")
	# then they happen, or are armed, and you die: each as it was at the checkpoint
	happen(glimpse, closer, shadow, mirror_fig, moment, steam, cp)
	story.call("die")
	story.call("revive")
	await frames(3)
	ok(not bool(glimpse.get("armed")) and int(glimpse.get("count")) == 0 and not bool(closer.get("_done")) and not bool(shadow.get("armed"))
		and not bool(mirror_fig.get("_done")) and int(moment.get("count")) == 0 and int(steam.get("count")) == 0 and int(cp.get("count")) == 0,
		"died after they happened: each as it was at the checkpoint")
	# they happen again and a save is made (save_game keeps a checkpoint where you stand first); the scene as it started
	happen(glimpse, closer, shadow, mirror_fig, moment, steam, cp)
	var wrote: bool = story.call("save_game", 2)
	for n in all:
		n.call("put_state", {})
	glimpse.set("armed", false)
	glimpse.set("count", 0)
	closer.set("_done", false)
	shadow.set("armed", false)
	mirror_fig.set("_done", false)
	for n in [moment, steam, cp]:
		n.set("count", 0)
	# the save loaded: each as it was when the save was made
	var loaded: bool = story.call("load_game", 2)
	await frames(3)
	ok(wrote and loaded and bool(glimpse.get("armed")) and int(glimpse.get("count")) == 1, "the save loaded: the glimpse armed, once seen", "armed %s count %d" % [glimpse.get("armed"), int(glimpse.get("count"))])
	ok(bool(closer.get("_done")) and not bool(closer.get("armed")), "the closer figure done, not coming again")
	ok(bool(shadow.get("armed")) and not bool(shadow.get("done")), "the shadow pass still armed (by a signal before the save)")
	ok(bool(mirror_fig.get("_done")), "the figure in the mirror done")
	ok(int(moment.get("count")) == 1 and int(steam.get("count")) == 1 and int(cp.get("count")) == 1, "the dread moment, the steam's writing and the checkpoint: once each, kept")
	# something showing when it's put back goes
	glimpse.set("shown", true)
	(glimpse.get("figure") as Node3D).visible = true
	glimpse.call("put_state", {"armed": true, "count": 1})
	ok(not bool(glimpse.get("shown")) and not (glimpse.get("figure") as Node3D).visible, "a glimpse showing when it's put back is gone")
	story.call("delete_save", 2)
	print("HORRORGAME result " + JSON.stringify({"errors": errors}))
	quit()
