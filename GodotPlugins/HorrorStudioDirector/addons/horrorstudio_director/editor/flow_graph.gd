@tool
extends GraphEdit
## The Story Flow's chart (editor/flow_tab.gd): Godot's graph editor, with an arrow that goes back to the left (a long
## story wrapped onto rows like lines of text, or a loop) drawn round the cards as a flowchart's line: out to the right,
## along the gap above the card it goes to, in from the left, its corners rounded. The rest are the usual curves.

var tab = null                     # the flow tab: its cards, to find the one an arrow goes into


func _get_connection_line(from_position: Vector2, to_position: Vector2) -> PackedVector2Array:
	var s := _scale()
	if to_position.x >= from_position.x + 30.0 * s:
		var c := Curve2D.new()
		var off := absf(to_position.x - from_position.x) * connection_lines_curvature
		c.add_point(from_position, Vector2.ZERO, Vector2(off, 0))
		c.add_point(to_position, Vector2(-off, 0), Vector2.ZERO)
		return c.tessellate(5, 2.0)
	var top := to_position.y - 50.0 * s          # along the gap above the card it goes into
	var g = _card_at(to_position)
	if g != null:
		top = (g as GraphNode).position_offset.y - 16.0 * s
	var out_x := from_position.x + 22.0 * s
	var in_x := to_position.x - 22.0 * s
	return _rounded([from_position, Vector2(out_x, from_position.y), Vector2(out_x, top), Vector2(in_x, top),
		Vector2(in_x, to_position.y), to_position], 10.0 * s)


func _scale() -> float:
	return EditorInterface.get_editor_scale() if Engine.is_editor_hint() else 1.0


## the card whose way in is at that point (an input port's place on the chart)
func _card_at(p: Vector2):
	if tab == null:
		return null
	for id in tab.cards:
		var g: GraphNode = tab.cards[id]
		if g.get_input_port_count() and (g.position_offset + g.get_input_port_position(0)).distance_to(p) < 3.0:
			return g
	return null


## a polyline with its corners turned as quarter curves of radius r
static func _rounded(pts: Array, r: float) -> PackedVector2Array:
	var out := PackedVector2Array([pts[0]])
	for i in range(1, pts.size() - 1):
		var a: Vector2 = pts[i - 1]
		var b: Vector2 = pts[i]
		var c: Vector2 = pts[i + 1]
		var rr := minf(r, minf(a.distance_to(b), b.distance_to(c)) * 0.5)
		if rr < 0.5:
			out.append(b)
			continue
		var p1 := b + (a - b).normalized() * rr
		var p2 := b + (c - b).normalized() * rr
		for k in 7:
			var t := k / 6.0
			out.append(p1.lerp(b, t).lerp(b.lerp(p2, t), t))
	out.append(pts.back())
	return out
