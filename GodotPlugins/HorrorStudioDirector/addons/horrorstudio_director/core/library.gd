@tool
class_name HSLibrary
extends RefCounted
## The project's animation library (docs/GODOT_ANIMATION_PLAN.md §3; the user, 2026-11-02: "an animation and facial
## animation tab to store animations, these can be project specific… ideally I can just drag animations into the
## folders"): body clips dropped into res://animations/ (Kimodo's .npz, Godot animations; a folder named after a
## character's id holds hers), face clips into res://faces/ (HSFaceClip .tres: the Face page's, tools/face_export.mjs).
## Both folders start empty in a new project (the user: "I'll just manually move over what I need"). The panel's Animate
## tab shows them as cards; a body clip is made a character's (`make_for`: an .npz retargeted onto her own skeleton by
## kimodo/retarget.gd, kept under res://animations/_made/<her id>/) in her AnimationPlayer's library `anims`, where the
## runtime plays it by name (play.gd player_with), her face clips on her face shapes beside it (face.gd).

const BODY := "res://animations"
const FACES := "res://faces"
const OLD := "res://motions"                 # the Kimodo tab's imports before the library (still read)
const MADE := "_made"
const LIB := "anims"                        # her AnimationPlayer's library of the clips made for her
const FPS := 30.0                           # Kimodo's frames a second
const ROLES := [                            # in this order: stand_up before idle's stand, scared before scare
	["stand", ["stand_up", "standup", "get_up", "getup", "rise", "rising"]], ["idle", ["idle", "stand", "breath", "wait"]],
	["walk", ["walk", "stroll", "pace", "step", "sneak"]], ["run", ["run", "sprint", "jog", "chase", "flee"]],
	["sit", ["sit", "seat", "chair", "sofa", "kneel"]], ["talk", ["talk", "speak", "gesture", "explain", "argue"]],
	["listen", ["listen", "nod"]], ["look", ["look", "search", "peek", "check", "turn", "glance"]],
	["react", ["scared", "flinch", "shock", "startle", "scream", "react", "cry", "fall", "faint", "dead", "caught"]],
	["scare", ["lunge", "attack", "grab", "crawl", "jumpscare", "charge"]],
]
const ORDER := ["idle", "walk", "run", "sit", "stand", "talk", "listen", "look", "react", "scare"]   # as the tab shows them
const ROLE_NAMES := {"idle": "Idle", "walk": "Walk", "run": "Run", "sit": "Sit", "stand": "Stand up", "talk": "Talk",
	"listen": "Listen", "look": "Look & search", "react": "Reactions", "scare": "Scares", "other": "Other"}
const LOOPS := ["idle", "walk", "run", "sit", "talk", "listen"]   # roles that loop unless the clip says otherwise

const INDEX := "res://.hsdirector/library.json"
## the joints a clip's figure is drawn with (SOMA's body), their places in soma77 and each one's parent among them
const FIG_AT := [0, 1, 2, 3, 4, 5, 6, 7, 11, 12, 13, 14, 39, 40, 41, 42, 67, 68, 69, 70, 72, 73, 74, 75]
const FIG_UP := [-1, 0, 1, 2, 3, 4, 5, 6, 3, 8, 9, 10, 3, 12, 13, 14, 0, 16, 17, 18, 0, 20, 21, 22]
const FIG_N := 48                           # the moments a figure keeps
const SLANT := 0.5                          # radians round from the front it's seen at

static var _figs := {}                      # an .npz's path|mtime -> its figure (read once)


## every body clip, by name: [{id, path, kind ("npz" | "anim"), for (a character's id; "" anyone's), role, secs, loop}]
static func body() -> Array:
	var out: Array = []
	var seen := {}
	for root in [BODY, OLD]:
		_walk(root, "", out, seen)
	out.sort_custom(func(a, b): return str(a["id"]) < str(b["id"]) if a["role"] == b["role"] else _rank(str(a["role"])) < _rank(str(b["role"])))
	return out


## a role's place on the Animate tab (ORDER's, Other last; ROLES is the order names are matched in)
static func _rank(role: String) -> int:
	var i := ORDER.find(role)
	return i if i >= 0 else 99


static func _walk(dir: String, who: String, out: Array, seen: Dictionary) -> void:
	var abs_dir := ProjectSettings.globalize_path(dir)
	if not DirAccess.dir_exists_absolute(abs_dir):
		return
	for f in DirAccess.get_files_at(abs_dir):
		var path := dir.path_join(f)
		var ext := f.get_extension().to_lower()
		var id := f.get_basename()
		if seen.has(who + "/" + id):
			continue
		if ext == "npz":
			out.append({"id": id, "path": path, "kind": "npz", "for": who, "role": role_of(id), "secs": npz_secs(path), "loop": loops(id)})
			seen[who + "/" + id] = true
		elif ext in ["res", "tres", "anim"]:
			var a = load(path)
			if a is Animation:
				out.append({"id": id, "path": path, "kind": "anim", "for": who, "role": role_of(id), "secs": (a as Animation).length,
					"loop": (a as Animation).loop_mode != Animation.LOOP_NONE})
				seen[who + "/" + id] = true
	for d in DirAccess.get_directories_at(abs_dir):
		if d == MADE or d.begins_with("."):
			continue
		_walk(dir.path_join(d), d if who == "" else who, out, seen)


## an .npz's length (its posed_joints' frames at Kimodo's 30 a second), read once
static func npz_secs(path: String) -> float:
	return float(figure(path)["secs"])


## the library's clip ids by their files' names alone (nothing read: a quick look-up, as compile.gd's at play)
static func ids() -> Dictionary:
	var out := {}
	for root in [BODY, OLD]:
		_names(root, out)
	return out


static func _names(dir: String, out: Dictionary) -> void:
	var abs_dir := ProjectSettings.globalize_path(dir)
	if not DirAccess.dir_exists_absolute(abs_dir):
		return
	for f in DirAccess.get_files_at(abs_dir):
		if f.get_extension().to_lower() in ["npz", "res", "tres", "anim"]:
			out[f.get_basename()] = true
	for d in DirAccess.get_directories_at(abs_dir):
		if d != MADE and not d.begins_with("."):
			_names(dir.path_join(d), out)


## the figure a Kimodo clip is drawn as on its card: its body's joints (FIG: no fingers, eyes or jaw) at up to FIG_N
## moments, the hips kept over one spot, seen from the front turned SLANT, fitted to a height of 1 (y down):
## {secs, frames: [PackedVector2Array], w: its width over its height, up: each joint's parent in FIG, travel: metres
## the hips go from its start to its end}; read once a file (by its time)
static func figure(path: String) -> Dictionary:
	var key := "%s|%d" % [path, FileAccess.get_modified_time(path)]
	if _figs.has(key):
		return _figs[key]
	var frames := HSNpz.joints(HSNpz.read(ProjectSettings.globalize_path(path)))
	var out := {"secs": frames.size() / FPS, "frames": [], "w": 0.5, "up": FIG_UP, "travel": 0.0}
	_figs[key] = out
	if frames.is_empty() or (frames[0] as PackedVector3Array).size() < 77:
		return out
	var a: Vector3 = (frames[0] as PackedVector3Array)[0]
	var b: Vector3 = (frames[frames.size() - 1] as PackedVector3Array)[0]
	out["travel"] = Vector2(b.x - a.x, b.z - a.z).length()
	var step := maxi(1, int(ceil(frames.size() / float(FIG_N))))
	var cs := cos(SLANT)
	var sn := sin(SLANT)
	var raw: Array = []
	var lo := Vector2(INF, INF)
	var hi := Vector2(-INF, -INF)
	for f in range(0, frames.size(), step):
		var j: PackedVector3Array = frames[f]
		var hip: Vector3 = j[0]
		var pts := PackedVector2Array()
		for i in FIG_AT:
			var q := Vector2((j[i].x - hip.x) * cs + (j[i].z - hip.z) * sn, -j[i].y)
			pts.append(q)
			lo = lo.min(q)
			hi = hi.max(q)
		raw.append(pts)
	var h := maxf(hi.y - lo.y, 0.01)
	for pts in raw:
		for k in pts.size():
			pts[k] = (pts[k] - lo) / h
		(out["frames"] as Array).append(pts)
	out["w"] = (hi.x - lo.x) / h
	return out


## the library as a file (res://.hsdirector/library.json, beside the ids' index: plugin.gd writes both on a save):
## each clip's id, file, kind, who it's for, role, seconds, whether it loops and how far it walks on its own
static func write_index() -> void:
	var b: Array = []
	for c in body():
		var e: Dictionary = c.duplicate()
		e["travel"] = snappedf(float(figure(str(c["path"]))["travel"]), 0.01) if c["kind"] == "npz" else 0.0
		e["secs"] = snappedf(float(c["secs"]), 0.01)
		b.append(e)
	var f: Array = []
	for c in faces():
		var e: Dictionary = c.duplicate()
		e["secs"] = snappedf(float(c["secs"]), 0.01)
		f.append(e)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://.hsdirector"))
	var fa := FileAccess.open(INDEX, FileAccess.WRITE)
	if fa != null:
		fa.store_string(JSON.stringify({"body": b, "faces": f}, "\t"))


## a clip's role from its name (mari_sit_reading: sit; MariWalking: walk): its words (HSDirector.snake's), each
## one begun by a role's word, or two words together (stand_up); what it's for, as the Animate tab groups it
static func role_of(id: String) -> String:
	var n := HSDirector.snake(id)
	var words := n.split("_", false)
	for r in ROLES:
		for w in r[1]:
			if w.contains("_"):
				if ("_" + n + "_").contains("_" + w + "_"):
					return r[0]
				continue
			for x in words:
				if x.begins_with(w):
					return r[0]
	return "other"


## whether a clip loops, by its name: its role's (an idle, a walk, sitting...), but not a way in or out of one (sit_down,
## stand_up, get_into_bed: played once)
static func loops(id: String) -> bool:
	if not (role_of(id) in LOOPS):
		return false
	for w in HSDirector.snake(id).split("_", false):
		if w in ["down", "up", "into", "out", "onto", "off"]:
			return false
	return true


## the clips that suit one of a character's moves (level/actor.gd MOVES: its role, and for sitting down or sitting
## what the name says), the ones in her own folder first
static func for_move(move: String, who: String) -> Array:
	var role := ""
	for m in HSActor.MOVES:
		if m[0] == move:
			role = m[2]
	var mine: Array = []
	var others: Array = []
	for c in body():
		var words := HSDirector.snake(str(c["id"])).split("_", false)
		if str(c["for"]) != "" and str(c["for"]) != who:
			continue
		if move == "caught":                         # a clip named for it (caught, catch, grab, found): a reaction's or a scare's
			if not Array(words).any(func(w): return w.begins_with("caught") or w.begins_with("catch") or w.begins_with("grab") or w == "found"):
				continue
		elif c["role"] != role:
			continue
		if move == "sit_down" and not words.has("down"):
			continue
		if move == "sitting" and words.has("down"):
			continue
		(mine if str(c["for"]) == who else others).append(c)
	return mine + others


## every face clip: [{id, path, loop, secs, title}] (the loops in res://faces/loops/)
static func faces() -> Array:
	var out: Array = []
	for dir in [FACES, FACES.path_join("loops")]:
		var abs_dir := ProjectSettings.globalize_path(dir)
		if not DirAccess.dir_exists_absolute(abs_dir):
			continue
		for f in DirAccess.get_files_at(abs_dir):
			if f.get_extension() != "tres":
				continue
			var c = load(dir.path_join(f))
			if c == null or not ("weights" in c):
				continue
			out.append({"id": f.get_basename(), "path": dir.path_join(f), "loop": bool(c.loop), "secs": float(c.secs),
				"title": str(c.title) if str(c.title) != "" else f.get_basename()})
	out.sort_custom(func(a, b): return a["id"] < b["id"])
	return out


static func clip(id: String) -> Dictionary:
	for c in body():
		if c["id"] == id:
			return c
	return {}


## the clip as an Animation for a character, made in memory: an .npz retargeted onto her own skeleton
## (kimodo/retarget.gd; `opts` the retarget's own: fps, in_place, loop, else by its role), its tracks from `anim_root`
## (her player's root); a Godot animation as it is. null with why in `why[0]`
static func animation_for(actor: Node3D, c: Dictionary, anim_root: Node, why: Array = [""], opts: Dictionary = {}) -> Animation:
	if actor == null or c.is_empty():
		why[0] = "no character or no clip"
		return null
	if c.get("kind") != "npz":
		var a = load(str(c["path"]))
		if not (a is Animation):
			why[0] = "%s isn't an animation" % str(c["path"])
			return null
		return a
	var sk := HSRetarget.skeleton_of(actor)
	if sk == null:
		why[0] = "%s has no skeleton: put her rigged model (a Character Studio export, MHR) in her first" % actor.name
		return null
	if HSRetarget.detect(sk) == "":
		why[0] = "%s's skeleton isn't one the retarget knows (MHR, SOMA, Mixamo, Godot's humanoid)" % actor.name
		return null
	var frames := HSNpz.joints(HSNpz.read(ProjectSettings.globalize_path(str(c["path"]))))
	if frames.is_empty():
		why[0] = "%s has no posed_joints (a Kimodo .npz?)" % str(c["path"]).get_file()
		return null
	var role := str(c.get("role", "other"))
	var anim := HSRetarget.animation(frames, sk, actor, anim_root, {"fps": float(opts.get("fps", FPS)),
		"in_place": bool(opts.get("in_place", role in ["walk", "run"])), "loop": bool(opts.get("loop", c.get("loop", false)))})
	if anim == null:
		why[0] = "the retarget failed (see the Output)"
	return anim


## the clip made a character's: on her AnimationPlayer, in its library `anims` (an .npz retargeted onto her own
## skeleton first, kept as res://animations/_made/<her id>/<clip>.res: animation_for). The name the runtime plays it
## by; "" with why in `why[0]`. The scene changes (her player's library), so the caller saves or marks it
static func make_for(actor: Node3D, c: Dictionary, why: Array = [""], opts: Dictionary = {}) -> String:
	if actor == null or c.is_empty():
		why[0] = "no character or no clip"
		return ""
	var aid := HSDirector.id_of(actor)
	var id := str(c["id"])
	var made_dir := BODY.path_join(MADE).path_join(aid)
	var ap := HSRetarget.player_of(actor)
	var r := actor.get_tree().edited_scene_root if Engine.is_editor_hint() and actor.is_inside_tree() else actor.owner
	if ap.owner == null and r != null:
		ap.owner = r
	var anim := animation_for(actor, c, ap.get_node(ap.root_node), why, opts)
	if anim == null:
		return ""
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(made_dir))
	if c.get("kind") == "npz":
		var p := made_dir.path_join(id + ".res")
		anim.take_over_path(p)                       # made again: this one is the file's now (not the cached one before it)
		ResourceSaver.save(anim, p)
	var lib: AnimationLibrary
	var lib_path := made_dir.path_join(LIB + ".tres")
	if ap.has_animation_library(LIB):
		lib = ap.get_animation_library(LIB)
	else:
		lib = load(lib_path) if ResourceLoader.exists(lib_path) else null
		if lib == null:
			lib = AnimationLibrary.new()
			lib.take_over_path(lib_path)
			ResourceSaver.save(lib, lib_path)
		ap.add_animation_library(LIB, lib)
	if lib.has_animation(id):
		lib.remove_animation(id)
	lib.add_animation(id, anim)
	if lib.resource_path != "":
		ResourceSaver.save(lib, lib.resource_path)
	return id


## the clips a character has on her players now (made for her, her model's own, the Kimodo tab's)
static func hers(actor: Node) -> Array:
	return actor.motion_names() if actor != null and actor.has_method("motion_names") else []
