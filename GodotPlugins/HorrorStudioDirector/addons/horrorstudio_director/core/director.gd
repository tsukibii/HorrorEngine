## The Director plugin's shared helpers (docs/GODOT_DIRECTOR.md): ids from node names, Godot's axes as the story's
## (x east, y north, z up: Godot's x, -z, y), a node's facing as the story's yaw, the ids a scene holds by kind (the
## Inspector's suggestions and the dock's lists), and the flag the main scene raises while its levels are taken up as
## templates (a level's nodes set themselves up for play only in the copy the runtime enters, never twice).
@tool
class_name HSDirector
extends RefCounted

const RUNTIME_MAIN := "res://addons/horrorstudio/main.tscn"
const INTERACT := 1 << 19           # the clickable areas' collision layer (collide.gd's INTERACT)
const KINDS := ["area", "thing", "door", "item", "note", "flag", "actor", "spot", "light", "room", "path", "sound", "motion",
	"counter", "level", "life"]

## raised by HSGame (and a level played alone) while it takes its levels up as templates: their nodes skip their own
## setup for play until the runtime enters a copy
static var holding := false
static var _cache: Dictionary = {}
static var _cache_at := -10000
static var _cache_root = null


## "Front Door 2" -> "front_door_2", "KitchenDoor" -> "kitchen_door" (Godot's node names are CamelCase)
static func snake(s: String) -> String:
	var out := ""
	var gap := false
	var t := s.strip_edges()
	for i in t.length():
		var ch := t[i]
		var c := ch.to_lower()
		if (c >= "a" and c <= "z") or (c >= "0" and c <= "9"):
			var up := ch != c
			if out != "" and not gap and up and i > 0:
				var prev := t[i - 1]
				var nxt := t[i + 1] if i + 1 < t.length() else ""
				if prev != prev.to_upper() or (prev >= "0" and prev <= "9") or (nxt != "" and nxt != nxt.to_upper() and prev == prev.to_upper() and prev != prev.to_lower()):
					gap = true                                  # a word starts: aB, 2B, or the B of ABc
			if gap and out != "":
				out += "_"
			out += c
			gap = false
		else:
			gap = true
	return out if out != "" else "x"


## a node's id when it first comes in (its name as an id); in the editor it follows the node's renames while it is
## still the name's (an id typed by hand stays): an HSThing added as "HSThing" and renamed "Key" is key
static var _named: Dictionary = {}          # (the editor) a node's instance id -> its name as an id when last seen


static func auto_id(n: Node) -> void:
	if str(n.get("id")) == "":
		n.set("id", snake(str(n.name)))
	var key := n.get_instance_id()
	if Engine.is_editor_hint() and not _named.has(key):
		_named[key] = snake(str(n.name))
		n.renamed.connect(func():
			var was := str(_named.get(key, ""))
			var now := snake(str(n.name))
			if str(n.get("id")) == was or str(n.get("id")) == "":
				n.set("id", now)
			_named[key] = now)
		n.tree_exiting.connect(func(): if n.is_queued_for_deletion(): _named.erase(key))


## a node's id: its own `id`, else its name as an id
static func id_of(n: Node) -> String:
	if n == null:
		return ""
	var v = n.get("id")
	if v is String and v != "":
		return v
	return snake(str(n.name))


## Godot's point as the story's [x east, y north, z up]
static func story_pos(v: Vector3) -> Array:
	return [snappedf(v.x, 0.0001), snappedf(-v.z, 0.0001), snappedf(v.y, 0.0001)]


## a node's facing (its +Z, Godot's front for a model: the way a character placed here looks) as the story's yaw,
## degrees from east toward north (the runtime turns a stand-in's +Z to it: play.gd draw_npcs)
static func story_yaw(n: Node3D) -> float:
	var f: Vector3 = n.global_transform.basis.z
	if Vector2(f.x, f.z).length() < 1e-5:
		return 0.0
	return snappedf(rad_to_deg(atan2(-f.z, f.x)), 0.001)


## the box round a node's visible meshes, in the node's own space (its children's AABBs carried up); empty without any
static func local_aabb(n: Node3D, skip: Array = []) -> AABB:
	var out := AABB()
	var first := true
	var inv := n.global_transform.affine_inverse()
	for c in n.find_children("*", "VisualInstance3D", true, false):
		if not (c is GeometryInstance3D) or skip.has(c):
			continue
		var skipped := false
		for s in skip:
			if s is Node and s.is_ancestor_of(c):
				skipped = true
		if skipped:
			continue
		var a: AABB = c.get_aabb()
		if a.size == Vector3.ZERO:
			continue
		var b: AABB = (inv * c.global_transform) * a
		if first:
			out = b
			first = false
		else:
			out = out.merge(b)
	return out


## the node's box as the story's size [w along x, d along -z, h up]
static func story_size(a: AABB) -> Array:
	return [snappedf(a.size.x, 0.0001), snappedf(a.size.z, 0.0001), snappedf(a.size.y, 0.0001)]


## a runtime piece stamped on a node (play.gd reads `metadata/piece` and the group hs_piece at any depth)
static func stamp(n: Node3D, piece: Dictionary) -> void:
	n.set_meta("piece", JSON.stringify(piece))
	if not n.is_in_group("hs_piece"):
		n.add_to_group("hs_piece")


## the node's box made the node's origin (the runtime's pieces are boxes about their node), its children kept where
## they are; idempotent (a box already centred moves nothing)
static func recentre(n: Node3D, a: AABB) -> void:
	var c := a.get_center()
	if c.length() < 1e-5:
		return
	n.transform.origin += n.transform.basis * c
	for ch in n.get_children():
		if ch is Node3D:
			ch.position -= c


## a box collider (a StaticBody3D on the world's layer, or a clickable Area3D) round a box of the node's own space
static func box_collider(n: Node3D, size: Vector3, centre: Vector3, area: bool) -> CollisionObject3D:
	var b: CollisionObject3D = Area3D.new() if area else StaticBody3D.new()
	b.name = "_click" if area else "_solid"
	if area:
		b.collision_layer = INTERACT
		b.collision_mask = 0
		(b as Area3D).monitoring = false
	var cs := CollisionShape3D.new()
	var bx := BoxShape3D.new()
	bx.size = Vector3(max(size.x, 0.02), max(size.y, 0.02), max(size.z, 0.02))
	cs.shape = bx
	cs.position = centre
	b.add_child(cs)
	n.add_child(b)
	return b


static func has_collider(n: Node) -> bool:
	for c in n.find_children("*", "CollisionObject3D", true, false):
		if not str(c.name).begins_with("_"):
			return true
	return false


## a plain material (the greybox's): a colour, rough, its UVs from world space so a texture set given later tiles by
## the metre
static func grey(c: Color, rough: float = 0.85) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = rough
	m.uv1_triplanar = true
	m.uv1_world_triplanar = true
	m.uv1_scale = Vector3(0.5, 0.5, 0.5)
	return m


static func glow(c: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	m.no_depth_test = false
	return m


## the edited scene's root in the editor (null in a game)
static func edited_root() -> Node:
	if not Engine.is_editor_hint():
		return null
	var ei = Engine.get_singleton("EditorInterface")
	return ei.get_edited_scene_root() if ei != null else null


## the nodes under a root by their script's class (class_name), depth first, in tree order
static func nodes_of(root: Node, cls: String, out: Array = []) -> Array:
	if root == null:
		return out
	for c in root.get_children():
		if class_of(c) == cls:
			out.append(c)
		nodes_of(c, cls, out)
	return out


static func class_of(n: Node) -> String:
	var s = n.get_script()
	while s != null:
		var g: String = s.get_global_name()
		if g != "":
			return g
		s = s.get_base_script()
	return ""


## the ids a scene holds, by kind (the Inspector's suggestions, the dock's lists); the edited scene's, with the
## index of the project's other scenes (the dock keeps it, index.json) under them; cached for a second
static func ids(kind: String, root: Node = null) -> PackedStringArray:
	var r: Node = root if root != null else edited_root()
	var now := Time.get_ticks_msec()
	if r != _cache_root or now - _cache_at > 1000:
		_cache = scan(r)
		var idx := read_index()
		for k in idx:
			if not _cache.has(k):
				_cache[k] = []
			for v in idx[k]:
				if not _cache[k].has(v):
					_cache[k].append(v)
		_cache_root = r
		_cache_at = now
	var out := PackedStringArray()
	for v in _cache.get(kind, []):
		out.append(str(v))
	out.sort()
	return out


static func suggest(kind: String) -> String:
	return ",".join(ids(kind))


const INDEX := "res://.hsdirector/index.json"


static func read_index() -> Dictionary:
	if not FileAccess.file_exists(INDEX):
		return {}
	var j = JSON.parse_string(FileAccess.get_file_as_string(INDEX))
	return j if j is Dictionary else {}


## a scene's ids by kind: what the Inspector suggests and what the dock lists

## the expressions brought into the project (tools/face_export.mjs): the loops in res://faces/loops/, the captures in
## res://faces/ (unless loops_only), by id
static func faces(loops_only: bool = false) -> Array:
	var out: Array = []
	for dir in (["res://faces/loops"] if loops_only else ["res://faces/loops", "res://faces"]):
		var d := DirAccess.open(dir)
		if d == null:
			continue
		for f in d.get_files():
			if f.ends_with(".tres") and not out.has(f.get_basename()):
				out.append(f.get_basename())
	out.sort()
	return out

static func scan(root: Node) -> Dictionary:
	var out := {}
	for k in KINDS:
		out[k] = []
	if root == null:
		return out
	var add := func(k: String, v) -> void:
		var s := str(v)
		if not out.has(k):                           # a kind of its own (life:<which>): made as it comes
			out[k] = []
		if s != "" and not out[k].has(s):
			out[k].append(s)
	_scan(root, out, add)
	out["sound"] = sounds()
	return out


static func _scan(n: Node, out: Dictionary, add: Callable) -> void:
	for c in n.get_children():
		var cls := class_of(c)
		var id := id_of(c)
		match cls:
			"HSTrigger":
				add.call("area", id)
			"HSRoom":
				add.call("area", id)
				add.call("room", id)
			"HSDoor":
				add.call("door", id)
				add.call("thing", id)
			"HSThing":
				add.call("thing", id)
				if c.use in ["pickup", "carry"] and c.item != "":
					add.call("item", c.item)
				if c.use == "note":
					add.call("note", c.note if c.note != "" else id)   # its note's id (a desk game's letter on a table: letter_mari)
				if c.use in ["code", "use_item"] and c.opens_flag != "":
					add.call("flag", c.opens_flag)
				if c.use == "use_item" and c.needs_item != "":
					add.call("item", c.needs_item)
				if c.use == "life":
					add.call("life", id)
					add.call("life:" + c.life, id)        # which life it lives (the Manager offers its states)
			"HSActor":
				add.call("actor", id)
				add.call("thing", id)
				if c.cast_id() != id:
					add.call("actor", c.cast_id())     # the story's name for her (a desk game's cast member placed more than once)
				for m in c.motion_names():
					add.call("motion", m)
			"HSSpot":
				add.call("spot", id)
			"HSPath":
				add.call("path", id)
			"HSLevel":
				add.call("level", id)
			"HSGame":
				for k in c.counters:
					add.call("counter", k)
		if c is Light3D and not (c is DirectionalLight3D):
			add.call("light", snake(str(c.name)))
		_scan(c, out, add)


## a scene's ids by kind into the project's index (res://.hsdirector/index.json: every saved scene's, merged), which the
## Inspector's suggestions and the Director Manager read; the plugin writes it on every save, the sample maker once
static func write_index(path: String, root: Node) -> void:
	var idx := read_index()
	var scenes: Dictionary = idx.get("_scenes", {})
	var sc := scan(root)
	sc.erase("sound")
	scenes[path] = sc
	var merged := {"_scenes": scenes}
	for p in scenes:
		for k in scenes[p]:
			if not merged.has(k):
				merged[k] = []
			for v in scenes[p][k]:
				if not merged[k].has(v):
					merged[k].append(v)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://.hsdirector"))
	var f := FileAccess.open(INDEX, FileAccess.WRITE)
	if f != null:
		f.store_string(JSON.stringify(merged, " "))
	_cache_at = -10000


## the sound shelf's names (game/sfx/index.json, copied in by tools/godot_director.py), for the Play sound action
static func sounds() -> Array:
	var p := "res://game/sfx/index.json"
	if not FileAccess.file_exists(p):
		return []
	var j = JSON.parse_string(FileAccess.get_file_as_string(p))
	if not (j is Dictionary):
		return []
	var out: Array = (j.get("sounds", {}) as Dictionary).keys()
	out.sort()
	return out


## the Inspector's hint for an id field: a text box with the scene's ids of that kind to pick from
static func hint(p: Dictionary, kind: String) -> void:
	p["hint"] = PROPERTY_HINT_ENUM_SUGGESTION
	p["hint_string"] = suggest(kind)
