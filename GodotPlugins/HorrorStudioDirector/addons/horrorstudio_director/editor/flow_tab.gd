@tool
extends PanelContainer
## The Story Flow tab (docs/GODOT_DIRECTOR.md §6f; the user, 2026-11-02: "a story flowchart tab… only a flowchart of
## the quests' flow… so I don't have to manually look through them one by one to see the prerequisites"): a main screen
## beside 2D, 3D and Script. The Director file's quests and endings as cards (story/flow.gd, HSFlow), the arrows between
## them as the game plays them, each coloured by its kind (then, if, otherwise, out of time, a desk choice's answer, a
## trigger cutscene's jump). Click a card: what leads to it (its prerequisites, lit on the chart) and where it goes, on
## the right; double-click it: open in the panel's Story tab. Cards dragged where you want them, their places kept in
## the file's `chart` on the editor's undo. It reads and writes the file through the Story tab (its `f` and `change`),
## so the two never disagree.

const Glyphs := preload("res://addons/horrorstudio_director/editor/glyphs.gd")
const BuildTab := preload("res://addons/horrorstudio_director/editor/build_tab.gd")
const FlowGraph := preload("res://addons/horrorstudio_director/editor/flow_graph.gd")

const KIND_COLOR := {
	"then": Color("#6CB4F5"), "else": Color("#7F95AD"), "if": Color("#B79BE8"), "timeout": Color("#F3C27A"),
	"option": Color("#6FD3C7"), "jump": Color("#E8746A"), "during": Color("#C77B72"),
}
const KIND_WORDS := [
	["then", "then: what comes next"],
	["if", "if…: only when that holds (the first that does)"],
	["else", "otherwise: when none of its ifs hold"],
	["timeout", "out of time: its time limit ran out"],
	["option", "a desk choice's answers"],
	["jump", "a trigger cutscene's jump"],
]
const TITLE_BG := {
	"intro": Color("#2A4566"), "quest": Color("#323946"), "round": Color("#3F3358"), "scene": Color("#24403F"),
	"choice": Color("#24403F"), "ending": Color("#3A3E46"), "roam": Color("#2B3036"), "trigger": Color("#4D2A2A"),
}
const ENDING_BG := {"good": Color("#24452F"), "bad": Color("#4D2A2A"), "death": Color("#4D2A2A"), "secret": Color("#3F3358")}
const KIND_NAME := {"intro": "the intro (over once its opening is)", "quest": "a quest", "round": "a round of gameplay",
	"scene": "a desk game's scene", "choice": "a desk game's choice", "ending": "an ending", "roam": "the free roam",
	"trigger": "a trigger cutscene"}
const C_TEXT := Color("#E8EBF0")
const C_MUTED := Color("#A3ACB9")
const C_FAINT := Color("#8A93A1")
const C_BLUE := Color("#6CB4F5")
const C_WARN := Color("#F3C27A")
const C_IN := Color("#6CB4F5")                   # a card's way in: the "then" blue, so an arrow keeps its colour to the end
const C_CARD := Color("#262B33")
const C_LINE := Color("#3B4350")

var plugin: EditorPlugin = null
var panel = null                   # the HorrorStudio panel: its Story tab holds the file
var graph: GraphEdit
var side: VBoxContainer
var counts: Label
var cards := {}                    # id -> its GraphNode
var ports := {}                    # id -> {out index -> its right port; -1 -> its "during" port}
var ch := {}                       # the chart as last drawn (HSFlow.chart)
var picked := ""                   # the card clicked
var _dirty := true
var _poll := 0.0
var _fitted := false
var _hooked = null                 # the Story tab whose `changed` this listens to


func _ready() -> void:
	var s := Glyphs.scale()
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	add_theme_stylebox_override("panel", BuildTab._box(Color("#1D2127"), Color(0, 0, 0, 0), 0, 0, 0))
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 0)
	add_child(v)
	var hm := MarginContainer.new()
	for k in ["left", "right"]:
		hm.add_theme_constant_override("margin_" + k, int(14 * s))
	for k in ["top", "bottom"]:
		hm.add_theme_constant_override("margin_" + k, int(8 * s))
	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", int(12 * s))
	hm.add_child(head)
	v.add_child(hm)
	var ic := TextureRect.new()
	ic.texture = Glyphs.icon("flow", "#9CCBFA", 20)
	ic.stretch_mode = TextureRect.STRETCH_KEEP_CENTERED
	head.add_child(ic)
	head.add_child(BuildTab._label("Story flow", 15, C_TEXT, true))
	counts = BuildTab._label("", 12, C_MUTED)
	counts.name = "Counts"
	head.add_child(counts)
	var gap := Control.new()
	gap.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(gap)
	head.add_child(BuildTab._label("Drag a card to move it · click one: what leads to it · double-click: open it in the Story tab", 12, C_FAINT))
	var fit_b := _small("Fit the view")
	fit_b.name = "Fit"
	fit_b.pressed.connect(fit)
	head.add_child(fit_b)
	var lay := _small("Lay it out again")
	lay.name = "Relayout"
	lay.tooltip_text = "Forget where the cards were dragged and lay them out by the story again (Ctrl+Z brings it back)"
	lay.pressed.connect(relayout)
	head.add_child(lay)
	var body := HSplitContainer.new()
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	v.add_child(body)
	graph = FlowGraph.new()
	graph.tab = self
	graph.name = "Chart"
	graph.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	graph.size_flags_vertical = Control.SIZE_EXPAND_FILL
	graph.show_arrange_button = false
	graph.minimap_enabled = true
	graph.zoom_min = 0.25
	graph.zoom_max = 1.6
	graph.connection_lines_thickness = 3.0 * s
	graph.connection_lines_curvature = 0.5
	graph.connection_lines_antialiased = true
	graph.node_selected.connect(func(n: Node): pick(str(n.get_meta("hs_id", ""))))
	graph.node_deselected.connect(func(_n: Node): _deselected.call_deferred())
	graph.end_node_move.connect(_moved)
	body.add_child(graph)
	var ss := ScrollContainer.new()
	ss.name = "Side"
	ss.custom_minimum_size = Vector2(310, 0) * s
	ss.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	ss.add_theme_stylebox_override("panel", BuildTab._box(Color("#1A1E23"), Color(0, 0, 0, 0), 0, 0, 0))
	var sm := MarginContainer.new()
	sm.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	for k in ["left", "right", "top", "bottom"]:
		sm.add_theme_constant_override("margin_" + k, int(14 * s))
	ss.add_child(sm)
	side = VBoxContainer.new()
	side.name = "SideBox"
	side.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	side.add_theme_constant_override("separation", int(6 * s))
	sm.add_child(side)
	body.add_child(ss)


func _story():
	return panel.story if panel != null and is_instance_valid(panel) and panel.story != null else null


## the main screen shown (plugin.gd _make_visible): the file read again if it changed, the chart drawn
func shown() -> void:
	_poll = 1.0
	_dirty = true


func _process(dt: float) -> void:
	if not is_visible_in_tree():
		return
	var st = _story()
	if st == null:
		return
	if _hooked != st:
		st.changed.connect(func(): _dirty = true)
		_hooked = st
	_poll += dt
	if _poll >= 0.5:
		_poll = 0.0
		if st._sig_now() != st._sig:               # the Manager saved it, or the running game moved on
			st.refresh()
	if _dirty:
		_dirty = false
		redraw()


# ---- drawing ----------------------------------------------------------------------------------------------------------
func redraw() -> void:
	var st = _story()
	if graph == null or st == null:
		return
	var s := Glyphs.scale()
	graph.clear_connections()
	for c in graph.get_children():
		if c is GraphNode:
			graph.remove_child(c)
			c.queue_free()
	cards.clear()
	ports.clear()
	var f: Dictionary = st.f
	if f.has("_error"):
		ch = {}
		counts.text = ""
		_clear_side()
		side.add_child(BuildTab._wrap(BuildTab._label(str(f["_error"]), 13, C_WARN)))
		return
	ch = HSFlow.chart(f, st.talk_ctx())
	var during := {}
	for w in ch["wires"]:
		if int(w["out"]) < 0:
			during[w["from"]] = true
	for c in ch["cards"]:
		var g := _card(c, during.has(c["id"]))
		graph.add_child(g)
		cards[c["id"]] = g
	for w in ch["wires"]:
		if not cards.has(w["from"]) or not cards.has(w["to"]):
			continue
		var fp := int((ports[w["from"]] as Dictionary).get(int(w["out"]), -1))
		if fp >= 0:
			graph.connect_node(cards[w["from"]].name, fp, cards[w["to"]].name, 0)
	var sizes := {}
	for id in cards:
		sizes[id] = (cards[id] as GraphNode).get_combined_minimum_size() / s
	var pos := HSFlow.layout(ch, f.get("chart", {}) if f.get("chart") is Dictionary else {}, sizes, per_row())
	for id in cards:
		cards[id].position_offset = (pos.get(id, Vector2.ZERO) as Vector2) * s
	counts.text = _counts()
	if picked != "" and not cards.has(picked):
		picked = ""
	if picked != "":
		cards[picked].selected = true
	_side()
	_light()
	if not _fitted:
		fit.call_deferred()


## how many columns a row of the chart has before it wraps: as many as the view shows at a readable size
func per_row() -> int:
	var w := graph.size.x / Glyphs.scale() if graph != null else 0.0
	return clampi(int(w / (HSFlow.COL * 0.7)), 3, 12) if w > 200.0 else 5


func _counts() -> String:
	var n := {}
	for c in ch["cards"]:
		n[c["kind"]] = int(n.get(c["kind"], 0)) + 1
	var bits: Array = []
	var q := int(n.get("quest", 0)) + int(n.get("intro", 0)) + int(n.get("round", 0))
	bits.append("%d quest%s" % [q, "" if q == 1 else "s"])
	if n.has("scene") or n.has("choice"):
		bits.append("%d from the desk" % (int(n.get("scene", 0)) + int(n.get("choice", 0))))
	bits.append("%d ending%s" % [int(n.get("ending", 0)), "" if int(n.get("ending", 0)) == 1 else "s"])
	if n.has("trigger"):
		bits.append("%d trigger cutscene%s" % [n["trigger"], "" if n["trigger"] == 1 else "s"])
	return " · ".join(PackedStringArray(bits))


func _card(c: Dictionary, has_during: bool) -> GraphNode:
	var s := Glyphs.scale()
	var g := GraphNode.new()
	g.name = "Card_" + str(c["id"]).validate_node_name()
	g.set_meta("hs_id", c["id"])
	g.title = _title(c)
	g.resizable = false
	g.custom_minimum_size = Vector2(280, 0) * s
	var tb: Color = TITLE_BG.get(c["kind"], TITLE_BG["quest"])
	if c["kind"] == "ending":
		tb = ENDING_BG.get(str(c.get("ending", "")), TITLE_BG["ending"])
	g.add_theme_stylebox_override("titlebar", _sb(tb, tb, true, 1))
	g.add_theme_stylebox_override("titlebar_selected", _sb(tb.lightened(0.12), C_BLUE, true, 2))
	g.add_theme_stylebox_override("panel", _sb(C_CARD, C_LINE, false, 1))
	g.add_theme_stylebox_override("panel_selected", _sb(C_CARD, C_BLUE, false, 2))
	var tl = g.get_titlebar_hbox().get_child(0, true) if g.get_titlebar_hbox().get_child_count(true) else null
	if tl is Label:
		tl.add_theme_color_override("font_color", C_TEXT)
		tl.add_theme_font_size_override("font_size", int(16 * s))
		tl.clip_text = true
		tl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var badge := {"intro": "INTRO", "round": "ROUND", "scene": "DESK", "choice": "DESK"}.get(c["kind"], "")
	if badge != "":
		var b := BuildTab._label(badge, 11, C_TEXT.darkened(0.15), true)
		g.get_titlebar_hbox().add_child(b)
	var slot := 0
	var sub := BuildTab._label(str(c.get("sub", "")) if str(c.get("sub", "")) != "" else " ", 14, C_MUTED)
	sub.name = "Sub"
	sub.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	sub.custom_minimum_size = Vector2(256, 0) * s
	g.add_child(sub)
	if c["kind"] == "trigger":
		g.set_slot(slot, true, 1, KIND_COLOR["during"], false, 0, Color.WHITE)
	else:
		g.set_slot(slot, true, 0, C_IN, false, 0, Color.WHITE)
	slot += 1
	if str(c.get("info", "")) != "":
		var info := BuildTab._label(str(c["info"]), 13, C_FAINT)
		info.name = "Info"
		g.add_child(info)
		slot += 1
	var pmap := {}
	var port := 0
	for j in (c["outs"] as Array).size():
		var o: Dictionary = c["outs"][j]
		var col: Color = KIND_COLOR.get(o["kind"], C_BLUE)
		var words := str(o["label"])
		if o.get("missing", false):
			words += "  (%s: not a quest or an ending)" % str(o["to"]) if str(o["to"]) != "" else "  (goes nowhere)"
			col = C_WARN
		var l := BuildTab._label(words, 14, col)
		l.name = "Out_%d" % j
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.custom_minimum_size = Vector2(256, 0) * s
		if o.get("implicit", false):
			l.tooltip_text = "No next of its own: the next quest in the list (else the first ending, else the free roam)"
		g.add_child(l)
		g.set_slot(slot, false, 0, C_IN, true, 0, col)
		pmap[j] = port
		port += 1
		slot += 1
	if has_during:
		var l := BuildTab._label("trigger cutscenes during it", 13, KIND_COLOR["during"])
		l.name = "During"
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		l.custom_minimum_size = Vector2(256, 0) * s
		g.add_child(l)
		g.set_slot(slot, false, 0, C_IN, true, 1, KIND_COLOR["during"])
		pmap[-1] = port
		slot += 1
	ports[c["id"]] = pmap
	var id := str(c["id"])
	g.gui_input.connect(func(ev: InputEvent):
		if ev is InputEventMouseButton and ev.double_click and ev.button_index == MOUSE_BUTTON_LEFT:
			open_in_story(id))
	g.tooltip_text = KIND_NAME.get(c["kind"], "")
	return g


func _title(c: Dictionary) -> String:
	var d = panel.dock if panel != null else null
	var mark := ""
	if d != null:
		if d.running and str(d.run_step) == str(c["id"]):
			mark = "▶ "
		elif (d.run_flags as Dictionary).has("done:" + str(c["id"])) or (d.run_flags as Dictionary).has("ending:" + str(c["id"])):
			mark = "✓ "
	match str(c["kind"]):
		"ending":
			return "%sEnd: %s" % [mark, c["title"]]
		"roam", "trigger":
			return str(c["title"])
		"scene", "choice":
			return "%s%d · ◆ %s" % [mark, c["num"], c["title"]]
		_:
			return "%s%d · %s" % [mark, c["num"], c["title"]]


## a card's box: its title bar's (rounded on top) or its body's (rounded below)
static func _sb(bg: Color, line: Color, top: bool, bw: int) -> StyleBoxFlat:
	var s := Glyphs.scale()
	var b := StyleBoxFlat.new()
	b.bg_color = bg
	b.border_color = line
	b.set_border_width_all(int(round(bw * s)))
	if top:
		b.border_width_bottom = 0
	else:
		b.border_width_top = 0
	var r := int(9 * s)
	b.corner_radius_top_left = r if top else 0
	b.corner_radius_top_right = r if top else 0
	b.corner_radius_bottom_left = 0 if top else r
	b.corner_radius_bottom_right = 0 if top else r
	b.content_margin_left = 12 * s
	b.content_margin_right = 12 * s
	b.content_margin_top = (7 if top else 8) * s
	b.content_margin_bottom = (7 if top else 10) * s
	return b


static func _small(t: String) -> Button:
	var s := Glyphs.scale()
	var b := Button.new()
	b.text = t
	b.custom_minimum_size = Vector2(0, 30) * s
	b.add_theme_stylebox_override("normal", BuildTab._box(Color(0, 0, 0, 0), Color("#45658A"), 7, 1, 8))
	b.add_theme_stylebox_override("hover", BuildTab._box(C_CARD, C_BLUE, 7, 1, 8))
	b.add_theme_stylebox_override("pressed", BuildTab._box(Color("#22303F"), C_BLUE, 7, 1, 8))
	return b


# ---- the card clicked: what leads to it, where it goes -----------------------------------------------------------------
func pick(id: String) -> void:
	picked = id
	_side()
	_light()


func _deselected() -> void:
	for id in cards:
		if cards[id].selected:
			return
	picked = ""
	_side()
	_light()


## the ways into the card clicked lit on the chart (its prerequisites), the rest plain
func _light() -> void:
	for w in ch.get("wires", []):
		if not cards.has(w["from"]) or not cards.has(w["to"]):
			continue
		var fp := int((ports[w["from"]] as Dictionary).get(int(w["out"]), -1))
		if fp >= 0:
			graph.set_connection_activity(cards[w["from"]].name, fp, cards[w["to"]].name, 0, 1.0 if (picked != "" and (w["to"] == picked or w["from"] == picked)) else 0.0)


func _clear_side() -> void:
	for c in side.get_children():
		side.remove_child(c)
		c.queue_free()


func _side() -> void:
	if side == null:
		return
	_clear_side()
	var c := HSFlow.card_of(ch, picked) if picked != "" else {}
	if c.is_empty():
		_legend()
		return
	side.add_child(BuildTab._wrap(BuildTab._label(_title(c), 15, C_TEXT, true)))
	side.add_child(BuildTab._wrap(BuildTab._label(KIND_NAME.get(c["kind"], ""), 12, C_FAINT)))
	if str(c.get("sub", "")) != "":
		side.add_child(BuildTab._wrap(BuildTab._label(str(c["sub"]), 13, C_MUTED)))
	side.add_child(_head("How the player gets here"))
	var ins := HSFlow.incoming(ch, picked)
	if picked == str(ch.get("start", "")):
		side.add_child(BuildTab._wrap(BuildTab._label("The game starts here.", 13, C_TEXT)))
	for x in ins:
		var from := HSFlow.card_of(ch, x["from"])
		var row := _way("after " + (_title(from) if not from.is_empty() else str(x["from"])), str(x["label"]), KIND_COLOR.get(x["kind"], C_BLUE))
		row.name = "In_" + str(x["from"]).validate_node_name()
		side.add_child(row)
	if ins.is_empty() and picked != str(ch.get("start", "")):
		side.add_child(BuildTab._wrap(BuildTab._label("Nothing leads here: the player never gets here.", 13, C_WARN)))
	side.add_child(_head("Where it goes"))
	for o in c["outs"]:
		var to := HSFlow.card_of(ch, str(o["to"]))
		var target := _title(to) if not to.is_empty() else ("%s (not a quest or an ending)" % str(o["to"]) if str(o["to"]) != "" else "nowhere yet")
		side.add_child(_way(str(o["label"]), "→ " + target, KIND_COLOR.get(o["kind"], C_BLUE)))
	if (c["outs"] as Array).is_empty():
		side.add_child(BuildTab._wrap(BuildTab._label("The game ends here." if c["kind"] == "ending" else "Nowhere: the story stops here.", 13, C_TEXT)))
	if c.get("editable", false) and c["kind"] != "roam":
		var b := BuildTab._button("Open it in the Story tab", false)
		b.name = "OpenInStory"
		b.pressed.connect(open_in_story.bind(picked))
		side.add_child(b)
	elif c["kind"] in ["scene", "choice", "trigger"] or (c["kind"] == "ending" and not c.get("editable", false)):
		side.add_child(BuildTab._wrap(BuildTab._label("Brought in from the desk as it was: it's in the Director Manager.", 12, C_FAINT)))


func _legend() -> void:
	side.add_child(BuildTab._label("How to read it", 15, C_TEXT, true))
	side.add_child(BuildTab._wrap(BuildTab._label("Each card is a quest or an ending, numbered as the Story tab lists them; the arrows are what comes next, as the game plays it.", 13, C_MUTED)))
	var used := {}
	for c in ch.get("cards", []):
		for o in c["outs"]:
			used[o["kind"]] = true
	for k in KIND_WORDS:
		if k[0] == "then" or used.has(k[0]):
			side.add_child(_way(k[1], "", KIND_COLOR[k[0]]))
	side.add_child(_head("Using it"))
	for t in ["Click a card: what leads to it (its prerequisites, lit on the chart) and where it goes.",
			"Double-click a card: open it in the Story tab below, for its steps and moments.",
			"Drag cards where you like: their places are kept with the story (Ctrl+Z puts one back)."]:
		side.add_child(BuildTab._wrap(BuildTab._label(t, 12, C_MUTED)))


func _head(t: String) -> Label:
	var l := BuildTab._label(t.to_upper(), 11, C_FAINT, true)
	l.custom_minimum_size = Vector2(0, 26) * Glyphs.scale()
	l.vertical_alignment = VERTICAL_ALIGNMENT_BOTTOM
	return l


## a way in or out: a short stroke in its colour, its words, a second line under them
func _way(t: String, t2: String, col: Color) -> Control:
	var s := Glyphs.scale()
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", int(8 * s))
	var bar := ColorRect.new()
	bar.color = col
	bar.custom_minimum_size = Vector2(4, 0) * s
	h.add_child(bar)
	var v := VBoxContainer.new()
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	v.add_theme_constant_override("separation", 0)
	v.add_child(BuildTab._wrap(BuildTab._label(t, 13, C_TEXT)))
	if t2 != "":
		v.add_child(BuildTab._wrap(BuildTab._label(t2, 12, col)))
	h.add_child(v)
	return h


## the card in the panel's Story tab (a quest or an ending of the file's own)
func open_in_story(id: String) -> void:
	var st = _story()
	var c := HSFlow.card_of(ch, id)
	if st == null or c.is_empty() or not c.get("editable", false) or c["kind"] == "roam":
		return
	if c["kind"] == "ending":
		st.ending = id
		st.quest = ""
	else:
		st.quest = id
		st.ending = ""
	st.opened = ""
	panel.show_page("story")
	if panel.has_method("make_visible"):
		panel.make_visible()
	st.refresh(false)


# ---- places -----------------------------------------------------------------------------------------------------------
## cards dragged: every card's place kept (so nothing else moves as the story grows), on the editor's undo
func _moved() -> void:
	var st = _story()
	if st == null or cards.is_empty():
		return
	var s := Glyphs.scale()
	var at := {}
	for id in cards:
		var p: Vector2 = cards[id].position_offset / s
		at[id] = [roundi(p.x), roundi(p.y)]
	st.change("Move a card on the story flow", func(): st.f["chart"] = at)


func relayout() -> void:
	var st = _story()
	if st == null or not st.f.has("chart"):
		return
	_fitted = false
	st.change("Lay the story flow out again", func(): st.f.erase("chart"))


## the whole chart in view
func fit() -> void:
	if cards.is_empty() or graph == null or graph.size.x < 10.0:
		return
	var r := Rect2()
	var first := true
	for id in cards:
		var g: GraphNode = cards[id]
		var rr := Rect2(g.position_offset, g.get_combined_minimum_size())
		r = rr if first else r.merge(rr)
		first = false
	var m := 40.0 * Glyphs.scale()
	var room := graph.size - Vector2(m, m) * 2.0
	graph.zoom = clampf(minf(room.x / maxf(r.size.x, 1.0), room.y / maxf(r.size.y, 1.0)), 0.55, 1.0)   # never smaller than readable: the start in view then
	graph.scroll_offset = r.position * graph.zoom - Vector2(m, m)
	_fitted = true
