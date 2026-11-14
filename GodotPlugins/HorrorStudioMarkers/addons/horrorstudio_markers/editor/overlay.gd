@tool
## The markers in the 3D view (docs/MARKERS.md §8): drawn over it, translucent, and moved there by mouse.
##   draw(control)        every shown character's markers: map pins in her colour, each with its kind's drawing and
##                        its number, its point on the place (the user's mock-up); the path between them with
##                        chevrons the way she walks, an arrow from each pin for the way she faces, small round
##                        badges over a place for what happens where she stands (a wait, a talk, an event, a choice
##                        and its ways), a legend
##   input(camera, event) a click on a pin picks it; a drag moves it over the floor under the mouse; the arrow's tip
##                        dragged round turns it; a bend dragged, the + on a path clicked for a new one; a card armed
##                        in the tab placed by a click; something picked for a field
## Everything it changes goes through the plugin (and the editor's undo). Nothing is added to the scene to draw this.
extends RefCounted

const Glyphs := preload("res://addons/horrorstudio_markers/editor/glyphs.gd")
const PIN := 13.0                          # a pin's head's radius, pixels (times the editor's scale)
const HEAD := 27.0                         # how far its head is over its point
const BADGE := 10.5
const ARROW := 0.6                         # the facing arrow's length, metres

var plugin: EditorPlugin
var hot := {}                              # an overlay control's id -> what can be clicked there: [{kind, node, index, at: Vector2, r}]
var hover := {}
var drag := {}                             # {kind, node, index, was: Transform3D, press: Vector2, moved, cam}
var _tri := {}
var _meshes: Array = []
var _meshes_t := 0


# ---- the view ---------------------------------------------------------------------------------------------------------------
func viewport_of(control: Control) -> SubViewport:
	for i in 4:
		var vp := EditorInterface.get_editor_viewport_3d(i)
		if vp == null or control == null or vp.get_parent() == null:
			continue
		if vp.get_parent() == control.get_parent() or vp.get_parent().get_parent() == control.get_parent():   # (the view's surface sits beside the container that holds its viewport)
			return vp
	return EditorInterface.get_editor_viewport_3d(0)


func _k(control: Control, vp: SubViewport) -> Vector2:
	return control.size / Vector2(vp.size) if vp != null and vp.size.x > 0 and vp.size.y > 0 else Vector2.ONE


func _behind(cam: Camera3D, p: Vector3) -> bool:
	return (cam.global_transform.affine_inverse() * p).z > -0.06


func _to2(cam: Camera3D, k: Vector2, p: Vector3) -> Vector2:
	return cam.unproject_position(p) * k


# a segment clipped where it goes behind the eye: [] when none of it is in front
func _seg(cam: Camera3D, k: Vector2, a: Vector3, b: Vector3) -> Array:
	var inv := cam.global_transform.affine_inverse()
	var za := (inv * a).z
	var zb := (inv * b).z
	if za > -0.06 and zb > -0.06:
		return []
	if za > -0.06:
		a = a.lerp(b, (za + 0.06) / (za - zb))
	elif zb > -0.06:
		b = b.lerp(a, (zb + 0.06) / (zb - za))
	return [_to2(cam, k, a), _to2(cam, k, b)]


func _path(c: Control, cam: Camera3D, k: Vector2, pts: PackedVector3Array, col: Color, w: float, dashed: bool) -> void:
	var run := PackedVector2Array()
	var since := 0.0
	var on := true
	var last_chev := 0.0
	var total := 0.0
	for i in pts.size() - 1:
		var s := _seg(cam, k, pts[i], pts[i + 1])
		var d := pts[i].distance_to(pts[i + 1])
		total += d
		if dashed:
			since += d
			if since > 0.22:
				since = 0.0
				on = not on
		if s.is_empty() or not on:
			if run.size() >= 2:
				c.draw_polyline(run, col, w, true)
			run = PackedVector2Array()
			continue
		if run.is_empty():
			run.append(s[0])
		run.append(s[1])
		if total - last_chev > 1.1 and i + 2 < pts.size():           # a chevron the way she walks
			last_chev = total
			var dir: Vector2 = (s[1] as Vector2) - (s[0] as Vector2)
			if dir.length() > 0.5:
				var u := dir.normalized()
				var n := Vector2(-u.y, u.x)
				var tip: Vector2 = s[1]
				var sz := 6.0 * Glyphs.scale()
				c.draw_polyline(PackedVector2Array([tip - u * sz + n * sz * 0.8, tip, tip - u * sz - n * sz * 0.8]), Color(1, 1, 1, col.a), 1.6, true)
	if run.size() >= 2:
		c.draw_polyline(run, col, w, true)


# a marker's words beside its pin: its title, and its note after it, on a dark chip the room shows through
func _chip(c: Control, at: Vector2, title: String, note: String, a: float, font: Font, bold: Font, strong: bool) -> void:
	var s := Glyphs.scale()
	var fs := int(11 * s)
	var tw := bold.get_string_size(title, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
	var nw := font.get_string_size("  " + note, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x if note != "" else 0.0
	var rect := Rect2(at, Vector2(tw + nw + 12 * s, 18 * s))
	c.draw_style_box(Glyphs.box(Color(0.06, 0.07, 0.09, (0.84 if strong else 0.68) * a), 5, 0), rect)
	c.draw_string(bold, rect.position + Vector2(6 * s, 13 * s), title, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color(1, 1, 1, 0.97 * a))
	if note != "":
		c.draw_string(font, rect.position + Vector2(6 * s + tw, 13 * s), "  " + note, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color(1, 1, 1, 0.66 * a))


# a marker's number on a small dark disc at the corner of its pin or badge
func _number(c: Control, at: Vector2, label: String, a: float, bold: Font) -> void:
	if label == "":
		return
	var s := Glyphs.scale()
	var fs := int((9 if label.length() <= 2 else 8) * s)
	var tw := bold.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
	var half := Vector2(maxf(7.5 * s, tw * 0.5 + 3.5 * s), 7.5 * s)
	var box := Glyphs.box(Color(0.07, 0.08, 0.1, 0.96 * a), 8, 0, Color(1, 1, 1, 0.9 * a), 1)
	c.draw_style_box(box, Rect2(at - half, half * 2.0))
	c.draw_string(bold, at + Vector2(-tw * 0.5, fs * 0.36), label, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color(1, 1, 1, 0.98 * a))


# a map pin: its point on the place, its head over it with the kind's drawing in it, its number at its corner; -> its head's middle
func _pin(c: Control, tip: Vector2, col: Color, icon: String, label: String, bold: Font, picked: bool, hovered: bool) -> Vector2:
	var s := Glyphs.scale()
	var r := PIN * s
	var head := tip + Vector2(0, -HEAD * s)
	var a := col.a
	var rim := Color(1, 1, 1, (1.0 if picked or hovered else 0.82) * a)
	c.draw_set_transform(tip, 0.0, Vector2(1.0, 0.42))
	c.draw_circle(Vector2.ZERO, 6.5 * s, Color(0, 0, 0, 0.38 * a))             # (its shadow on the floor)
	c.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	var w := r * 0.66
	var e := (2.6 if picked else 1.6) * s
	c.draw_colored_polygon(PackedVector2Array([head + Vector2(-w - e, r * 0.7), head + Vector2(w + e, r * 0.7), tip + Vector2(0, e * 1.6)]), rim)
	c.draw_circle(head, r + e, rim)
	c.draw_colored_polygon(PackedVector2Array([head + Vector2(-w, r * 0.7), head + Vector2(w, r * 0.7), tip]), Color(col.r, col.g, col.b, 1.0) if a > 0.9 else col)
	c.draw_circle(head, r, Color(col.r, col.g, col.b, 1.0) if a > 0.9 else col)
	if picked:
		c.draw_arc(head, r + 6.0 * s, 0, TAU, 36, Color(1, 1, 1, 0.9), 1.6 * s, true)
	var dark := col.get_luminance() > 0.62
	var tex := Glyphs.icon(icon, Color(0.05, 0.06, 0.08) if dark else Color.WHITE, 17)
	c.draw_texture(tex, head - Vector2(tex.get_size()) * 0.5, Color(1, 1, 1, a))
	_number(c, head + Vector2(r * 0.82, -r * 0.82), label, a, bold)
	return head


# a round badge: something that happens where she stands
func _dot(c: Control, at: Vector2, r: float, col: Color, icon: String, label: String, bold: Font, picked: bool, hovered: bool) -> void:
	var s := Glyphs.scale()
	var a := col.a
	c.draw_circle(at, r + (2.6 if picked else 1.5) * s, Color(1, 1, 1, (1.0 if picked or hovered else 0.8) * a))
	c.draw_circle(at, r, Color(col.r, col.g, col.b, 1.0) if a > 0.9 else col)
	if picked:
		c.draw_arc(at, r + 5.5 * s, 0, TAU, 32, Color(1, 1, 1, 0.9), 1.6 * s, true)
	var dark := col.get_luminance() > 0.62
	var tex := Glyphs.icon(icon, Color(0.05, 0.06, 0.08) if dark else Color.WHITE, 13)
	c.draw_texture(tex, at - Vector2(tex.get_size()) * 0.5, Color(1, 1, 1, a))
	_number(c, at + Vector2(r * 0.86, -r * 0.86), label, a, bold)


func draw(c: Control) -> void:
	var list: Array = []
	hot[c.get_instance_id()] = list
	if plugin == null or plugin.scene_root() == null:
		return
	var vp := viewport_of(c)
	var cam := vp.get_camera_3d() if vp != null else null
	if cam == null:
		return
	var k := _k(c, vp)
	var s := Glyphs.scale()
	var font := c.get_theme_default_font()
	var bold := EditorInterface.get_editor_theme().get_font("bold", "EditorFonts") if EditorInterface.get_editor_theme().has_font("bold", "EditorFonts") else font
	var legend: Array = []
	for n in plugin.npcs():
		var npc := n as HSNpc
		if not plugin.is_shown(npc):
			continue
		var shown: Array = plugin.quests_shown(npc)
		var record: Dictionary = npc.record()
		var home := HSNpcFlow.home_of(npc)
		legend.append([npc, shown])
		for q in shown:
			var here: bool = npc == plugin.cur_npc and (q == plugin.cur_quest or plugin.cur_quest == null)
			var a := 1.0 if here else 0.5
			var col := Color(npc.color.r, npc.color.g, npc.color.b, 0.92 * a)
			var stacks := {}
			for row in HSNpcFlow.board(q):
				var node: Node = row["node"]
				var picked: bool = node == plugin.cur
				var hov: bool = hover.get("node") == node and hover.get("kind") in ["pin", "badge"]
				var starts: Array = HSNpcFlow.starts_of(node, home, record)
				var from: Dictionary = starts[0]
				var depth := int(row["depth"])
				if node is HSNpcWay:
					_badge(c, cam, k, list, stacks, from["pos"], node, String(row["label"]), (node as HSNpcWay).title(), "", "way", col, a, font, bold, picked, hov)
					continue
				var m := node as HSNpcMarker
				if m.is_placed():
					var pin := m.place()
					if m.kind == "walk":
						for st in starts:
							_path(c, cam, k, HSNpcFlow.walk_points(m, st["pos"]), Color(col.r, col.g, col.b, 0.85 * a), (3.2 if picked else 2.4) * s, depth > 0)
					else:
						var stand: Dictionary = HSNpcFlow.stand_for(m, record, (from["pos"] as Vector3).y)
						var foot := Vector3(stand["pos"].x, (from["pos"] as Vector3).y, stand["pos"].z)
						_path(c, cam, k, HSNpcFlow.sampled(PackedVector3Array([from["pos"], foot]), false), Color(col.r, col.g, col.b, 0.6 * a), 1.6 * s, true)
						if m.kind != "appear" and not _behind(cam, foot):
							c.draw_arc(_to2(cam, k, foot), 5.0 * s, 0, TAU, 20, Color(1, 1, 1, 0.8 * a), 1.4 * s, true)
							var seg := _seg(cam, k, foot, pin)
							if not seg.is_empty():
								c.draw_dashed_line(seg[0], seg[1], Color(1, 1, 1, 0.45 * a), 1.2 * s, 4.0 * s)
					if _behind(cam, pin):
						continue
					var p2 := _to2(cam, k, pin)
					var tip3 := pin + m.front() * ARROW
					if not _behind(cam, tip3) and (m.kind != "walk" or m.face_arrow):
						var t2 := _to2(cam, k, tip3)
						var u := (t2 - p2)
						if u.length() > 4.0:
							var un := u.normalized()
							var nn := Vector2(-un.y, un.x)
							c.draw_line(p2, t2, Color(0, 0, 0, 0.5 * a), 5.5 * s, true)
							c.draw_line(p2, t2, Color(1, 1, 1, 0.95 * a), 2.6 * s, true)
							c.draw_colored_polygon(PackedVector2Array([t2 + un * 7 * s, t2 - un * 3 * s + nn * 6 * s, t2 - un * 3 * s - nn * 6 * s]), Color(1, 1, 1, 0.95 * a))
							if picked:
								var hot_tip: bool = hover.get("node") == node and hover.get("kind") == "arrow"
								c.draw_circle(t2 + un * 2 * s, (8.0 if hot_tip else 6.5) * s, Color(col.r, col.g, col.b, 1.0))
								c.draw_arc(t2 + un * 2 * s, (8.0 if hot_tip else 6.5) * s, 0, TAU, 20, Color.WHITE, 1.5 * s, true)
								list.append({"kind": "arrow", "node": node, "index": 0, "at": t2 + un * 2 * s, "r": 11.0 * s})
					var head := _pin(c, p2, col, Glyphs.of_marker(m), String(row["label"]), bold, picked, hov)
					list.append({"kind": "pin", "node": node, "index": 0, "at": head, "r": (PIN + 4.0) * s})
					list.append({"kind": "pin", "node": node, "index": 0, "at": p2, "r": 7.0 * s})
					stacks[_key(pin)] = maxf(float(stacks.get(_key(pin), 0.0)), HEAD + PIN)
					if here or picked:
						_chip(c, head + Vector2((PIN + 11) * s, -9 * s), m.title(), m.note, a, font, bold, picked)
					if m.kind == "walk" and picked:
						_bends(c, cam, k, list, m, from["pos"], col)
				else:
					_badge(c, cam, k, list, stacks, from["pos"], node, String(row["label"]), m.title(), m.note, Glyphs.of_marker(m), col, a, font, bold, picked, hov)
	_uses(c, cam, k, list, font)
	_legend(c, legend, font, bold)


# where a node is in the room, for a mark over it (null: nowhere, a node with no place)
func _where(node: Node):
	if node is HSNpcMarker:
		var m := node as HSNpcMarker
		return m.place() if m.is_placed() else (HSNpcFlow.starts_of(m)[0]["pos"] as Vector3)
	if node is HSNpcWay or node is HSNpcQuest or node is HSNpc:
		var npc := HSNpcFlow.npc_of(node) as HSNpc
		var her := npc.character_node() if npc != null else null
		return her.global_position if her != null else null
	if node is HSLogic:
		var t := (node as HSLogic).thing_node()
		return (t as Node3D).global_position if t is Node3D else null
	return (node as Node3D).global_position if node is Node3D else null


# the flag picked in the Flags tab: a small chip over every node that uses it, green where it's switched, amber
# where it's asked for; a click on one goes there (docs/FLAGS.md §4)
func _uses(c: Control, cam: Camera3D, k: Vector2, list: Array, font: Font) -> void:
	if plugin.cur_name.size() != 2 or plugin.wiring == null:
		return
	var s := Glyphs.scale()
	var kind := String(plugin.cur_name[0])
	var stack := {}
	for u in plugin.wiring.uses(kind, String(plugin.cur_name[1])):
		var node := u["node"] as Node
		if not is_instance_valid(node) or not node.is_inside_tree():
			continue
		var at3 = _where(node)
		if at3 == null or _behind(cam, at3):
			continue
		var sets: bool = String(u["role"]) in HSLogicScan.SETS
		var col := Color("#81C784") if sets else Color("#FFB74D")
		var base := _to2(cam, k, at3)
		var key := Vector2i(base / (8.0 * s))
		var n := int(stack.get(key, 0))
		stack[key] = n + 1
		var who := "" if node is HSNpcMarker else (String((node as HSLogic).thing_node().name) if node is HSLogic and (node as HSLogic).thing_node() != null else String(node.name)) + ": "
		var text := who + HSLogicScan.role_says(String(u["role"]), kind)
		var fs := int(11 * s)
		var w := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x + 30 * s
		var at := base + Vector2(0, -(46 + 24 * n) * s)
		var hov: bool = hover.get("kind") == "use" and hover.get("node") == node
		c.draw_line(base, at + Vector2(0, 10 * s), Color(col.r, col.g, col.b, 0.7), 1.4 * s, true)
		c.draw_circle(base, 3.2 * s, col)
		var rect := Rect2(at - Vector2(12 * s, 10 * s), Vector2(w, 20 * s))
		c.draw_style_box(Glyphs.box(Color(0.07, 0.08, 0.1, 0.92 if hov else 0.82), 10, 0, col, 1), rect)
		var tex := Glyphs.icon({"flag": "flag", "task": "task", "item": "carry"}.get(kind, "flag"), col, 12)
		c.draw_texture(tex, rect.position + Vector2(6 * s, (rect.size.y - tex.get_size().y) * 0.5))
		c.draw_string(font, rect.position + Vector2(22 * s, 14 * s), text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color(1, 1, 1, 0.95))
		list.append({"kind": "use", "node": node, "index": 0, "at": rect.get_center(), "r": maxf(rect.size.x * 0.5, 12.0 * s)})


func _key(p: Vector3) -> Vector3i:
	return Vector3i(roundi(p.x * 4.0), roundi(p.y * 4.0), roundi(p.z * 4.0))


# something that happens where she stands: a round badge over that place, stacked over what's already there (its pin,
# other badges); `stacks`: how high each place is already built, pixels over its point
func _badge(c: Control, cam: Camera3D, k: Vector2, list: Array, stacks: Dictionary, where: Vector3, node: Node, label: String, title: String, note: String, icon: String,
		col: Color, a: float, font: Font, bold: Font, picked: bool, hov: bool) -> void:
	if _behind(cam, where):
		return
	var s := Glyphs.scale()
	var r := (BADGE - (1.5 if node is HSNpcWay else 0.0)) * s
	var top := float(stacks.get(_key(where), 0.0))
	var up := top + 4.0 + r / s if top > 0.0 else 13.0
	stacks[_key(where)] = up + r / s
	var at := _to2(cam, k, where) + Vector2(0, -up * s)
	_dot(c, at, r, Color(col.r * 0.6, col.g * 0.6, col.b * 0.6, col.a) if node is HSNpcWay else col, icon, label, bold, picked, hov)
	list.append({"kind": "badge", "node": node, "index": 0, "at": at, "r": r + 3.0 * s})
	if a >= 1.0 or picked:
		_chip(c, at + Vector2(r + 11 * s, -9 * s), title, note, a, font, bold, picked)


# a picked Walk's handles: its bends, and a + on each stretch of its path for a new one
func _bends(c: Control, cam: Camera3D, k: Vector2, list: Array, m: HSNpcMarker, from: Vector3, col: Color) -> void:
	var s := Glyphs.scale()
	var ctrl := HSNpcFlow.walk_control(m, from)
	var bends := m.bends()
	for i in ctrl.size() - 1:
		var mid := ctrl[i].lerp(ctrl[i + 1], 0.5)
		if ctrl[i].distance_to(ctrl[i + 1]) > 0.5 and not _behind(cam, mid):
			var p := _to2(cam, k, mid)
			var hv: bool = hover.get("kind") == "plus" and hover.get("index") == i and hover.get("node") == m
			c.draw_circle(p, (8.0 if hv else 6.5) * s, Color(0.08, 0.09, 0.11, 0.85))
			c.draw_arc(p, (8.0 if hv else 6.5) * s, 0, TAU, 20, Color(col.r, col.g, col.b, 1.0), 1.5 * s, true)
			c.draw_line(p - Vector2(3.5 * s, 0), p + Vector2(3.5 * s, 0), Color.WHITE, 1.6 * s)
			c.draw_line(p - Vector2(0, 3.5 * s), p + Vector2(0, 3.5 * s), Color.WHITE, 1.6 * s)
			list.append({"kind": "plus", "node": m, "index": i, "at": p, "r": 10.0 * s, "where": mid})
	for i in bends.size():
		var b := bends[i] as Node3D
		if _behind(cam, b.global_position):
			continue
		var p := _to2(cam, k, b.global_position)
		var on: bool = plugin.cur == b or (hover.get("kind") == "bend" and hover.get("node") == b)
		var r := (8.5 if on else 7.0) * s
		c.draw_colored_polygon(PackedVector2Array([p + Vector2(0, -r), p + Vector2(r, 0), p + Vector2(0, r), p + Vector2(-r, 0)]), Color(col.r, col.g, col.b, 1.0))
		c.draw_polyline(PackedVector2Array([p + Vector2(0, -r), p + Vector2(r, 0), p + Vector2(0, r), p + Vector2(-r, 0), p + Vector2(0, -r)]), Color.WHITE, 1.5 * s, true)
		list.append({"kind": "bend", "node": b, "index": i, "at": p, "r": 11.0 * s})


func _legend(c: Control, legend: Array, font: Font, bold: Font) -> void:
	var s := Glyphs.scale()
	var fs := int(12 * s)
	var lines: Array = []
	for row in legend:
		var npc := row[0] as HSNpc
		var names := PackedStringArray()
		for q in row[1]:
			names.append((q as HSNpcQuest).label())
		lines.append([npc.color, npc.display_name(), ", ".join(names) if not names.is_empty() else "no quest yet"])
	var hint := ""
	if not plugin.armed.is_empty():
		hint = "Click to place '%s'   ·   Shift keeps placing   ·   Esc cancels" % plugin.armed.get("title", "")
	elif plugin.picking.is_valid():
		hint = "Click %s   ·   Esc cancels" % plugin.picking_what
	elif plugin.tester.playing():
		hint = "Testing…   " + "   ·   ".join(PackedStringArray(plugin.tester.notes.slice(maxi(0, plugin.tester.notes.size() - 3))))
	if lines.is_empty() and hint == "":
		return
	var w := 0.0
	for l in lines:
		w = maxf(w, bold.get_string_size(l[1], HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x + font.get_string_size("  " + l[2], HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x)
	if not lines.is_empty():
		var rect := Rect2(Vector2(10, 34) * s, Vector2(w + 34 * s, (lines.size() * 19 + 9) * s))
		c.draw_style_box(Glyphs.box(Color(0.06, 0.07, 0.09, 0.7), 7, 0), rect)       # (not opaque: the room shows through)
		var y := rect.position.y + 18 * s
		for l in lines:
			c.draw_circle(Vector2(rect.position.x + 12 * s, y - 4 * s), 5 * s, l[0])
			c.draw_string(bold, Vector2(rect.position.x + 23 * s, y), l[1], HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color(1, 1, 1, 0.96))
			var nx := bold.get_string_size(l[1], HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
			c.draw_string(font, Vector2(rect.position.x + 23 * s + nx, y), "  " + l[2], HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color(1, 1, 1, 0.6))
			y += 19 * s
	if hint != "":
		var hw := font.get_string_size(hint, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
		var hr := Rect2(Vector2((c.size.x - hw) * 0.5 - 12 * s, c.size.y - 40 * s), Vector2(hw + 24 * s, 26 * s))
		c.draw_style_box(Glyphs.box(Color(0.06, 0.07, 0.09, 0.78), 8, 0), hr)
		c.draw_string(font, hr.position + Vector2(12 * s, 18 * s), hint, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color(1, 1, 1, 0.95))


# ---- the mouse ------------------------------------------------------------------------------------------------------------
func _control_of(cam: Camera3D) -> Control:
	var vp := cam.get_viewport()
	for id in hot:
		var c = instance_from_id(id)
		if c is Control and is_instance_valid(c) and viewport_of(c) == vp:
			return c
	return null


func hit(cam: Camera3D, pos: Vector2) -> Dictionary:
	var c := _control_of(cam)
	if c == null:
		return {}
	var best := {}
	var best_d := INF
	for h in hot.get(c.get_instance_id(), []):
		var d: float = (h["at"] as Vector2).distance_to(pos)
		var rank := 0.0 if h["kind"] in ["arrow", "bend", "plus"] else 4.0      # (a handle over a pin wins)
		if d <= float(h["r"]) and d + rank < best_d:
			best_d = d + rank
			best = h
	return best


func _ray(cam: Camera3D, pos: Vector2) -> Array:
	var c := _control_of(cam)
	var vp := cam.get_viewport() as SubViewport
	var k := _k(c, vp) if c != null and vp != null else Vector2.ONE
	var p := pos / k
	return [cam.project_ray_origin(p), cam.project_ray_normal(p)]


func _mesh_list() -> Array:
	if Time.get_ticks_msec() - _meshes_t < 1500 and not _meshes.is_empty():
		return _meshes
	_meshes_t = Time.get_ticks_msec()
	_meshes = []
	var r: Node = plugin.scene_root()
	if r == null:
		return _meshes
	var skip: Array = []
	for n in plugin.npcs():
		var her: Node = (n as HSNpc).character_node()
		if her != null:
			skip.append(her)
	for mi in r.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		if m.mesh == null or not m.is_visible_in_tree() or m.skin != null:
			continue
		var under := false
		var p: Node = m
		while p != null and p != r:
			if String(p.name).begins_with("_") or p in skip:
				under = true
				break
			p = p.get_parent()
		if not under:
			_meshes.append(m)
	return _meshes


## what the mouse is over in the scene: {pos, normal, node} ({} when nothing): the nearer of a collider and a mesh
func under_mouse(cam: Camera3D, pos: Vector2) -> Dictionary:
	var ray := _ray(cam, pos)
	var from: Vector3 = ray[0]
	var dir: Vector3 = ray[1]
	var best := {}
	var best_t := INF
	var w := cam.get_world_3d()
	var space := w.direct_space_state if w != null else null
	if space != null:
		var q := PhysicsRayQueryParameters3D.create(from, from + dir * 400.0)
		var h := space.intersect_ray(q)
		if not h.is_empty() and not _in_ghost(h.get("collider")):
			best_t = from.distance_to(h["position"])
			best = {"pos": h["position"], "normal": h["normal"], "node": h.get("collider")}
	for mi in _mesh_list():
		var m := mi as MeshInstance3D
		if not is_instance_valid(m):
			continue
		var inv := m.global_transform.affine_inverse()
		var lf := inv * from
		var ld := (inv.basis * dir).normalized()
		if m.get_aabb().grow(0.01).intersects_ray(lf, ld) == null:
			continue
		var key := m.mesh.get_instance_id()
		if not _tri.has(key):
			_tri[key] = m.mesh.generate_triangle_mesh()
		var tm: TriangleMesh = _tri[key]
		var hh: Dictionary = tm.intersect_ray(lf, ld) if tm != null else {}
		if hh.is_empty():
			continue
		var wp: Vector3 = m.global_transform * (hh["position"] as Vector3)
		var t := from.distance_to(wp)
		if t < best_t - 0.002:
			best_t = t
			best = {"pos": wp, "normal": (m.global_transform.basis * (hh["normal"] as Vector3)).normalized(), "node": m}
	return best


func _in_ghost(n) -> bool:
	var p: Node = n as Node
	while p != null:
		if String(p.name).begins_with("_Ghost"):
			return true
		p = p.get_parent()
	return false


## where a click puts a pin: on what's under the mouse, else on the level at `y`
func point_at(cam: Camera3D, pos: Vector2, y := 0.0) -> Vector3:
	var u := under_mouse(cam, pos)
	if not u.is_empty():
		return u["pos"]
	return on_level(cam, pos, y)


func on_level(cam: Camera3D, pos: Vector2, y: float) -> Vector3:
	var ray := _ray(cam, pos)
	var hit_p = Plane(Vector3.UP, y).intersects_ray(ray[0], ray[1])
	return hit_p if hit_p != null else (ray[0] as Vector3) + (ray[1] as Vector3) * 5.0


# a node of the scene the user can name: the nearest one the scene itself owns
func _named(n: Node) -> Node:
	var r: Node = plugin.scene_root()
	var p := n
	while p != null and p != r and p.owner != r:
		p = p.get_parent()
	return p if p != null and p != r else n


func input(cam: Camera3D, e: InputEvent) -> int:
	if plugin == null or plugin.scene_root() == null:
		return EditorPlugin.AFTER_GUI_INPUT_PASS
	if e is InputEventKey and e.pressed and (e as InputEventKey).keycode == KEY_ESCAPE and (not plugin.armed.is_empty() or plugin.picking.is_valid() or plugin.picking_pin.is_valid()):
		plugin.arm({})
		plugin.picking = Callable()
		plugin.picking_pin = Callable()
		plugin.update_overlays()
		return EditorPlugin.AFTER_GUI_INPUT_STOP
	if e is InputEventMouseMotion:
		var mm := e as InputEventMouseMotion
		if not drag.is_empty():
			if not bool(drag["moved"]) and mm.position.distance_to(drag["press"]) < 4.0:
				return EditorPlugin.AFTER_GUI_INPUT_STOP
			drag["moved"] = true
			_drag_to(cam, mm.position)
			plugin.update_overlays()
			return EditorPlugin.AFTER_GUI_INPUT_STOP
		var h := hit(cam, mm.position)
		if h.get("node") != hover.get("node") or h.get("kind") != hover.get("kind") or h.get("index") != hover.get("index"):
			hover = h
			plugin.update_overlays()
		return EditorPlugin.AFTER_GUI_INPUT_PASS
	if not (e is InputEventMouseButton):
		return EditorPlugin.AFTER_GUI_INPUT_PASS
	var mb := e as InputEventMouseButton
	if mb.button_index == MOUSE_BUTTON_RIGHT and mb.pressed:
		var hr := hit(cam, mb.position)
		if hr.get("kind") == "bend":
			plugin.delete_node(hr["node"], "delete a bend")
			return EditorPlugin.AFTER_GUI_INPUT_STOP
		if not plugin.armed.is_empty() or plugin.picking.is_valid() or plugin.picking_pin.is_valid():
			plugin.arm({})
			plugin.picking = Callable()
			plugin.picking_pin = Callable()
			return EditorPlugin.AFTER_GUI_INPUT_STOP
		return EditorPlugin.AFTER_GUI_INPUT_PASS
	if mb.button_index != MOUSE_BUTTON_LEFT:
		return EditorPlugin.AFTER_GUI_INPUT_PASS
	if mb.pressed:
		if plugin.picking.is_valid():
			var u := under_mouse(cam, mb.position)
			var to: Callable = plugin.picking
			plugin.picking = Callable()
			plugin.say("")
			if not u.is_empty() and u.get("node") is Node:
				to.call(_named(u["node"]), u["pos"])
			plugin.update_overlays()
			return EditorPlugin.AFTER_GUI_INPUT_STOP
		if plugin.picking_pin.is_valid():                      # a marker's pin (or its badge) for whoever asked
			var hp := hit(cam, mb.position)
			if hp.get("kind") in ["pin", "badge"] and hp.get("node") is HSNpcMarker:
				var to2: Callable = plugin.picking_pin
				plugin.picking_pin = Callable()
				plugin.say("")
				to2.call(hp["node"])
				plugin.update_overlays()
			return EditorPlugin.AFTER_GUI_INPUT_STOP
		if not plugin.armed.is_empty() and plugin.armed.has("how"):   # a card of the Things tab: put where it's clicked
			var tc: Dictionary = plugin.armed
			var where := point_at(cam, mb.position)
			if not mb.shift_pressed:
				plugin.arm({})
			var made: Node = plugin.wiring.make(tc, null, where)
			if made != null and plugin.things_dock != null:
				plugin.things_dock.made_thing(made, tc)
			return EditorPlugin.AFTER_GUI_INPUT_STOP
		if not plugin.armed.is_empty():
			var card: Dictionary = plugin.armed
			var at := point_at(cam, mb.position)
			var facing = null
			if String(card.get("kind")) != "walk":                 # (anything but a walk starts facing whoever placed it: turn it by its arrow)
				var to_cam := cam.global_position - at
				facing = atan2(to_cam.x, to_cam.z)
			if not mb.shift_pressed:
				plugin.arm({})
			plugin.add_marker(card, at, facing)
			return EditorPlugin.AFTER_GUI_INPUT_STOP
		var h2 := hit(cam, mb.position)
		if h2.is_empty():
			return EditorPlugin.AFTER_GUI_INPUT_PASS
		if h2["kind"] == "plus":
			var b: HSNpcBend = plugin.add_bend(h2["node"], h2["where"], int(h2["index"]))
			drag = {"kind": "bend", "node": b, "index": 0, "was": b.global_transform, "press": mb.position, "moved": false, "fresh": true}
			return EditorPlugin.AFTER_GUI_INPUT_STOP
		if h2["kind"] == "use":                                # a flag's mark over who uses it: go there
			plugin.go_to(h2["node"])
			return EditorPlugin.AFTER_GUI_INPUT_STOP
		var node: Node3D = h2["node"] as Node3D
		if h2["kind"] in ["pin", "badge"]:
			plugin.pick_node(node)
		if h2["kind"] == "badge" or node == null:
			return EditorPlugin.AFTER_GUI_INPUT_STOP
		var grab := Vector2.ZERO
		var ctl := _control_of(cam)
		if h2["kind"] == "pin" and ctl != null:                # (picked up by its head: its point stays as far from the mouse as it was)
			grab = _to2(cam, _k(ctl, cam.get_viewport() as SubViewport), node.global_position) - mb.position
		drag = {"kind": h2["kind"], "node": node, "index": int(h2["index"]), "was": node.global_transform, "press": mb.position, "moved": false, "grab": grab}
		return EditorPlugin.AFTER_GUI_INPUT_STOP
	if not drag.is_empty():                                    # let go: one undo step from where it was
		var d := drag
		drag = {}
		var n3 := d["node"] as Node3D
		if is_instance_valid(n3) and bool(d["moved"]) and not bool(d.get("fresh", false)):
			var now := n3.global_transform
			n3.global_transform = d["was"]
			plugin.place_node(n3, now, d["was"], "turn " + String(n3.name) if d["kind"] == "arrow" else "move " + String(n3.name))
		plugin.update_overlays()
		if plugin.dock != null:
			plugin.dock.refresh_board()
			plugin.dock.refresh_form()
		return EditorPlugin.AFTER_GUI_INPUT_STOP
	return EditorPlugin.AFTER_GUI_INPUT_PASS


func _drag_to(cam: Camera3D, pos: Vector2) -> void:
	var n := drag["node"] as Node3D
	if not is_instance_valid(n):
		drag = {}
		return
	if drag["kind"] == "arrow":
		var p := on_level(cam, pos, n.global_position.y)
		var d := p - n.global_position
		if Vector2(d.x, d.z).length() > 0.05:
			n.global_transform = Transform3D(Basis(Vector3.UP, atan2(d.x, d.z)), n.global_position)
		return
	var at := point_at(cam, pos + (drag.get("grab", Vector2.ZERO) as Vector2), n.global_position.y)
	n.global_transform = Transform3D(n.global_transform.basis, at)
