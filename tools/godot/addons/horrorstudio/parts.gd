## Parts that open (docs/PROPGEN.md §26; DECISIONS 2026-11-05, later): a made prop's lid, its doors, a book's cover,
## spread and block, each a node of its own in the glb with `propgen_part` extras: its kind (`hinge`: the axis the
## hinge line, open and shut in degrees; `slide`: the axis the way it slides, open and shut in metres; `show`: seen
## only while open, a book's spread; `hide`: seen only while shut, the closed book's block), and `built`, the state the
## glb holds it in. The runtime keeps each thing's state s, 0 shut to 1 open, and moves its parts between them over a
## moment: the `open`, `container`, `hide` and `book` uses (play.gd), the story's `open` action.
extends RefCounted

var rt
var moving: Array = []            # {rec, from, to, t, secs, done}: a thing (or a book's copy) between its states


func _init(rt_) -> void:
	rt = rt_


## every part under a node: {node, name, kind, axis, pivot, open, shut, built, hide_open, base (its transform as imported)}
static func scan(node: Node) -> Array:
	var out: Array = []
	_scan(node, out)
	return out


static func _extras(n: Node) -> Dictionary:
	if not n.has_meta("extras"):
		return {}
	var ex = n.get_meta("extras")
	return ex if ex is Dictionary else {}


static func _val(v):
	if v is String:
		var p = JSON.parse_string(v)
		return p if p != null else v
	return v


static func _scan(n: Node, out: Array) -> void:
	var ex := _extras(n)
	if ex.has("propgen_part") and n is Node3D:
		var p = _val(ex["propgen_part"])
		if p is Dictionary:
			var ax: Array = p.get("axis", [0, 1, 0])
			var pv: Array = p.get("pivot", [0, 0, 0])
			out.append({"node": n, "name": str(p.get("name", n.name)), "kind": str(p.get("kind", "hinge")),
				"axis": Vector3(float(ax[0]), float(ax[1]), float(ax[2])).normalized(), "pivot": Vector3(float(pv[0]), float(pv[1]), float(pv[2])),
				"open": float(p.get("open", 1.0)), "shut": float(p.get("shut", 0.0)), "built": float(p.get("built", 0.0)),
				"hide_open": bool(p.get("hide_open", false)), "base": n.transform})
	for c in n.get_children():
		_scan(c, out)


## what the prop's root says: a container's inside box (`inside`: [lo, hi] in that root's space), a book's page
## materials (`pages`) and binding (`book`); `root` the node that carries them (null without)
static func info(node: Node) -> Dictionary:
	var out := {"root": null, "inside": null, "pages": null, "book": null}
	_info(node, out)
	return out


static func _info(n: Node, out: Dictionary) -> void:
	var ex := _extras(n)
	for k in ["propgen_inside", "propgen_pages", "propgen_book"]:
		if ex.has(k):
			out["root"] = n
			out[k.substr(8)] = _val(ex[k])
	if out["root"] == null:
		for c in n.get_children():
			_info(c, out)


## the same parts on a copy of the thing's node (the examine's, the hand's: the structure duplicated, the paths the same)
static func on_copy(parts: Array, from: Node, to: Node) -> Array:
	var out: Array = []
	for p in parts:
		var rel: NodePath = from.get_path_to(p["node"])
		var n = to.get_node_or_null(rel)
		if n == null:
			continue
		var q: Dictionary = p.duplicate()
		q["node"] = n
		q["base"] = n.transform
		out.append(q)
	return out


## every part at state s (0 shut, 1 open): a hinge turned about its axis, a slide moved along it, a show or a hide part shown or not
static func apply(parts: Array, s: float) -> void:
	for p in parts:
		var n = p["node"]
		if not is_instance_valid(n):
			continue
		var v: float = float(p["shut"]) + s * (float(p["open"]) - float(p["shut"]))
		var b: Transform3D = p["base"]
		match str(p["kind"]):
			"hinge":
				n.transform = Transform3D(Basis(p["axis"], deg_to_rad(v - float(p["built"]))) * b.basis, b.origin)
				if p["hide_open"]:
					n.visible = s < 0.999
			"slide":
				n.transform = Transform3D(b.basis, b.origin + p["axis"] * (v - float(p["built"])))
			"show":
				n.visible = s > 0.5
			"hide":
				n.visible = s < 0.5


## a thing's (or a copy's) record {parts, open_s} moved to `to` over secs (at once with secs 0); done called at the end
func go(rec: Dictionary, to: float, secs: float, done = null) -> void:
	for i in range(moving.size() - 1, -1, -1):
		if moving[i]["rec"] == rec:
			moving.remove_at(i)
	var from: float = float(rec.get("open_s", 0.0))
	if secs <= 0.0 or abs(to - from) < 1e-4:
		rec["open_s"] = to
		apply(rec["parts"], to)
		if done != null and done is Callable and done.is_valid():
			done.call()
		return
	moving.append({"rec": rec, "from": from, "to": to, "t": 0.0, "secs": secs, "done": done})


func busy(rec: Dictionary) -> bool:
	for m in moving:
		if m["rec"] == rec:
			return true
	return false


func tick(dt: float) -> void:
	var done: Array = []
	for m in moving:
		m["t"] = float(m["t"]) + dt
		var u: float = min(1.0, float(m["t"]) / max(0.01, float(m["secs"])))
		var k: float = 1.0 - (1.0 - u) * (1.0 - u)
		var s: float = float(m["from"]) + (float(m["to"]) - float(m["from"])) * k
		m["rec"]["open_s"] = s
		apply(m["rec"]["parts"], s)
		if u >= 1.0:
			done.append(m)
	for m in done:
		moving.erase(m)
		if m["done"] != null and m["done"] is Callable and m["done"].is_valid():
			m["done"].call()


## the hinges' and slides' sounds off the shelf: {open, close} by what the parts are
static func sounds(parts: Array, kind_hint: String = "") -> Dictionary:
	var hinge := false
	var slide := false
	for p in parts:
		hinge = hinge or p["kind"] == "hinge"
		slide = slide or p["kind"] == "slide"
	if kind_hint == "book":
		return {"open": "book_open", "close": "book_close"}
	if kind_hint == "container":
		return {"open": "hinge_metal_01", "close": "latch"}
	if slide and not hinge:
		return {"open": "drawer_01", "close": "drawer_02"}
	return {"open": "door_creak_02", "close": "door_close_02"}
