@tool
extends PanelContainer
## The Story Flow tab (docs/GODOT_DIRECTOR.md §6f; the user, 2026-11-02: "a story flowchart tab… only a flowchart of
## the quests' flow… so I don't have to manually look through them one by one to see the prerequisites"): a main screen
## beside 2D, 3D and Script. The Director file's quests and endings as cards (story/flow.gd, HSFlow), the arrows between
## them as the game plays them, each coloured by its kind (then, if, otherwise, out of time, a desk choice's answer, a
## trigger cutscene's jump). Click a card: what leads to it (its prerequisites, lit on the chart) and where it goes, on
## the right; double-click it: open in the panel's Story tab. Cards dragged where you want them, their places kept in
## the file's `chart`. Setting it up (the user: "we should be allowed to set up the quests too in this flow (without the
## detail)… set the branching up in the flowchart"): a right-click (or + Quest, + Ending) makes a card there, its title
## typed on it (F2 again); a way's dot dragged onto a card sends it there, into empty space makes a new card there or
## takes the way away; on the right each way's condition and where it goes, picked, + A way: if… a branch; Delete takes
## a card away (what pointed at it goes on where it went); Number them by the flow puts the list in the order the story
## reaches them, the game playing the same (story/flow.gd does each change). Everything on the editor's undo. It reads
## and writes the file through the Story tab (its `f` and `change`), so the two never disagree.

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
var status: Label                  # what just happened, or why not
var _menu: PopupMenu
var _menu_acts := {}
var _confirm: ConfirmationDialog
var _deleting: Array = []
var _rename_next := ""             # the card made a moment ago: its title typed once it's drawn
var _renaming := ""


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
	status = BuildTab._label("Right-click: a new quest · drag a way's dot onto a card · click a card: what leads to it", 12, C_FAINT)
	status.name = "Status"
	status.clip_text = true
	status.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	status.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	head.add_child(status)
	for spec in [["AddQuest", "+ Quest", "A new quest card (right-click on the chart: one where you click)", "quest"],
			["AddEnding", "+ Ending", "A new ending card", "ending"]]:
		var b := _small(spec[1])
		b.name = spec[0]
		b.tooltip_text = spec[2]
		b.pressed.connect(func(): add_card(spec[3], _view_middle()))
		head.add_child(b)
	var num := _small("Number them by the flow")
	num.name = "Renumber"
	num.tooltip_text = "Put the quests' list in the order the story reaches them (the game plays the same)"
	num.pressed.connect(renumber)
	head.add_child(num)
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
	graph.right_disconnects = true
	graph.connection_request.connect(_on_connect)
	graph.disconnection_request.connect(func(a, ap, b, bp): graph.disconnect_node(a, ap, b, bp))   # the file changes when it's dropped
	graph.connection_to_empty.connect(_on_to_empty)
	graph.connection_drag_ended.connect(func(): _dirty = true)
	graph.popup_request.connect(_on_popup)
	graph.delete_nodes_request.connect(_on_delete)
	graph.gui_input.connect(func(ev: InputEvent):
		if ev is InputEventKey and ev.pressed and ev.keycode == KEY_F2 and picked != "":
			rename(picked)
			graph.accept_event())
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
	_menu = PopupMenu.new()
	_menu.name = "Menu"
	_menu.id_pressed.connect(func(i):
		if _menu_acts.has(i):
			_menu_acts[i].call())
	add_child(_menu)
	_confirm = ConfirmationDialog.new()
	_confirm.name = "ConfirmDelete"
	_confirm.title = "Delete"
	_confirm.confirmed.connect(func(): delete_cards(_deleting))
	add_child(_confirm)
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
	if _rename_next != "" and cards.has(_rename_next):
		rename.call_deferred(_rename_next)
	_rename_next = ""


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
			open_in_story(id)
		elif ev is InputEventMouseButton and ev.pressed and ev.button_index == MOUSE_BUTTON_RIGHT:
			g.selected = true
			pick(id)
			card_menu(id, g.get_screen_position() + ev.position * graph.zoom)
			g.accept_event())
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
	if c.get("editable", false) and c["kind"] in ["intro", "quest", "round"]:
		_ways(c)
	else:
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
	for t in ["Click a card: what leads to it (its prerequisites, lit on the chart) and where it goes, each way's condition and card picked here.",
			"Double-click a card: open it in the Story tab below, for its steps and moments.",
			"Right-click the chart (or + Quest, + Ending): a new card there, its title typed on it (F2 types it again).",
			"Drag a way's dot onto a card: it goes there. Into empty space: a new card there, or the way taken away.",
			"Delete takes a card away. Drag cards where you like. Ctrl+Z undoes any of it."]:
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
	var at := _places()
	st.change("Move a card on the story flow", func(): st.f["chart"] = at)


## every card's place now, in the editor's units at scale 1
func _places() -> Dictionary:
	var s := Glyphs.scale()
	var at := {}
	for id in cards:
		var p: Vector2 = cards[id].position_offset / s
		at[id] = [roundi(p.x), roundi(p.y)]
	return at


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


# ---- setting it up ----------------------------------------------------------------------------------------------------
func say(t: String) -> void:
	if status != null:
		status.text = t


## a point of the view on the chart, in the editor's units at scale 1
func _on_chart(local: Vector2) -> Vector2:
	return (local + graph.scroll_offset) / graph.zoom / Glyphs.scale()


func _view_middle() -> Vector2:
	return _on_chart(graph.size * 0.5) if graph != null else Vector2.ZERO


func _id_of(node_name) -> String:
	var n = graph.get_node_or_null(NodePath(str(node_name)))
	return str(n.get_meta("hs_id", "")) if n != null else ""


## the card's way out at that port (-1 its "during" port; -2 none)
func _out_of(id: String, port: int) -> int:
	var pm: Dictionary = ports.get(id, {})
	for k in pm:
		if int(pm[k]) == port:
			return int(k)
	return -2


## a new quest or ending where it's put (a way sent to it when it came from one); its title typed on it next
func add_card(kind: String, at: Vector2, from := "", out := -1) -> String:
	var st = _story()
	if st == null or st.f.has("_error"):
		return ""
	var first: bool = kind == "quest" and (st.f.get("quests", []) as Array).is_empty()
	var id: String = st.fresh_id("q_intro" if first else ("q_quest" if kind == "quest" else "e_ending"))
	var title := "Intro" if first else ("A new quest" if kind == "quest" else "A new ending")
	var places := _places()
	places[id] = [roundi(at.x), roundi(at.y)]
	var why := [""]
	st.change("A new %s on the story flow" % kind, func():
		if kind == "quest":
			HSFlow.add_quest(st.f, id, title)
		else:
			HSFlow.add_ending(st.f, id, title)
		if from != "":
			why[0] = HSFlow.set_way(st.f, from, out, id)
		st.f["chart"] = places)
	picked = id
	_rename_next = id
	say(why[0] if why[0] != "" else "%s made: type its title" % title)
	return id


## the card's title typed on it (Enter keeps it, Esc leaves it)
func rename(id: String) -> void:
	var c := HSFlow.card_of(ch, id)
	var g = cards.get(id)
	var st = _story()
	if g == null or st == null or c.is_empty() or not c.get("editable", false) or c["kind"] == "roam":
		return
	var hb: HBoxContainer = g.get_titlebar_hbox()
	if hb.get_node_or_null("Rename") != null:
		return
	var tl = hb.get_child(0, true) if hb.get_child_count(true) else null
	if tl is Control:
		tl.visible = false
	var le := LineEdit.new()
	le.name = "Rename"
	le.text = str(c["title"])
	le.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	le.add_theme_font_size_override("font_size", int(15 * Glyphs.scale()))
	hb.add_child(le)
	_renaming = id
	var done := func(keep: bool) -> void:
		if _renaming != id:
			return
		_renaming = ""
		var t := le.text.strip_edges()
		if keep and t != "" and t != str(c["title"]):
			st.change("Rename %s" % id, func(): HSFlow.rename(st.f, id, t))
		else:
			_dirty = true
	le.text_submitted.connect(func(_t): done.call(true))
	le.focus_exited.connect(func(): done.call(true))
	le.gui_input.connect(func(ev: InputEvent):
		if ev is InputEventKey and ev.pressed and ev.keycode == KEY_ESCAPE:
			done.call(false)
			le.accept_event())
	le.grab_focus()
	le.select_all()


## the file's own titles typed in the rename box (the checks)
func rename_to(id: String, title: String) -> void:
	var st = _story()
	if st != null:
		st.change("Rename %s" % id, func(): HSFlow.rename(st.f, id, title))


## a way's dot dropped on a card: the way goes there
func _on_connect(from_node, from_port: int, to_node, _to_port: int) -> void:
	connect_way(_id_of(from_node), _out_of(_id_of(from_node), from_port), _id_of(to_node))


func connect_way(fid: String, out: int, tid: String) -> void:
	var st = _story()
	var c := HSFlow.card_of(ch, fid)
	var tc := HSFlow.card_of(ch, tid)
	_dirty = true
	if st == null or c.is_empty() or tc.is_empty() or out < 0:
		return
	if not c.get("editable", false):
		say("A desk game's ways are changed in the Director Manager")
		return
	if tc["kind"] in ["roam", "trigger"]:
		say("A way goes to a quest or an ending")
		return
	var why := [""]
	st.change("A way from %s to %s" % [fid, tid], func(): why[0] = HSFlow.set_way(st.f, fid, out, tid))
	say(why[0] if why[0] != "" else "%s now goes to %s" % [_title(c), _title(tc)])


## a way's dot dropped in empty space: a new card there with the way going to it, or the way taken away
func _on_to_empty(from_node, from_port: int, release_position: Vector2) -> void:
	var fid := _id_of(from_node)
	var out := _out_of(fid, from_port)
	var c := HSFlow.card_of(ch, fid)
	_dirty = true
	if c.is_empty() or out < 0 or not c.get("editable", false):
		return
	var at := _on_chart(release_position)
	var items: Array = [["A new quest here", func(): add_card("quest", at, fid, out)], ["A new ending here", func(): add_card("ending", at, fid, out)]]
	if str(c["outs"][out].get("src", "")) in ["next", "timeout"]:
		items.append(["-"])
		items.append(["Take this way away", func(): cut(fid, out)])
	_popup(items, graph.get_screen_position() + release_position)


func cut(fid: String, out: int) -> void:
	var st = _story()
	if st == null:
		return
	var why := [""]
	st.change("Take a way away from %s" % fid, func(): why[0] = HSFlow.cut_way(st.f, fid, out))
	say(why[0] if why[0] != "" else "Taken away")


## a right-click on the chart: a new card there
func _on_popup(at_position: Vector2) -> void:
	var at := _on_chart(at_position)
	_popup([["A new quest here", func(): add_card("quest", at)], ["A new ending here", func(): add_card("ending", at)]],
		graph.get_screen_position() + at_position)


func card_menu(id: String, screen_at: Vector2) -> void:
	var c := HSFlow.card_of(ch, id)
	if c.is_empty():
		return
	if not c.get("editable", false) or c["kind"] == "roam":
		_popup([["Brought in from the desk: it's in the Director Manager", Callable()]], screen_at)
		return
	_popup([["Type its title (F2)", func(): rename(id)], ["Open it in the Story tab", func(): open_in_story(id)], ["-"],
		["Delete it…", func(): _on_delete([cards[id].name])]], screen_at)


func _popup(items: Array, screen_at: Vector2) -> void:
	_menu.clear()
	_menu_acts.clear()
	var i := 0
	for it in items:
		if it[0] == "-":
			_menu.add_separator()
			continue
		_menu.add_item(it[0], i)
		if (it[1] as Callable).is_valid():
			_menu_acts[i] = it[1]
		else:
			_menu.set_item_disabled(_menu.get_item_index(i), true)
		i += 1
	_menu.reset_size()
	_menu.position = Vector2i(screen_at)
	_menu.popup()


## Delete on cards: asked first
func _on_delete(nodes) -> void:
	var ids: Array = []
	for n in nodes:
		var id := _id_of(n)
		var c := HSFlow.card_of(ch, id)
		if not c.is_empty() and c.get("editable", false) and c["kind"] != "roam":
			ids.append(id)
	if ids.is_empty():
		say("Only the file's own quests and endings can be deleted here")
		return
	_deleting = ids
	var names: Array = ids.map(func(x): return _title(HSFlow.card_of(ch, x)))
	_confirm.dialog_text = "Delete %s?\nThe ways into it go on where it went; a quest's own moments go with it. Ctrl+Z brings it back." % ", ".join(PackedStringArray(names))
	_confirm.popup_centered()


func delete_cards(ids: Array) -> void:
	var st = _story()
	if st == null or ids.is_empty():
		return
	st.change("Delete %s from the story flow" % ", ".join(PackedStringArray(ids)), func():
		for id in ids:
			HSFlow.remove(st.f, str(id)))
	if ids.has(picked):
		picked = ""
	say("Deleted")


func renumber() -> void:
	var st = _story()
	if st == null:
		return
	st.change("Number the quests by the story flow", func(): HSFlow.renumber(st.f))
	say("The quests numbered in the order the story reaches them")


## the clicked quest's ways out, set here: each if's condition (the Story tab's chips) and the card it goes to, moved
## up or down, taken away; its then's card; its time limit's; + A way: if…
func _ways(c: Dictionary) -> void:
	var st = _story()
	var s := Glyphs.scale()
	var id := str(c["id"])
	for j in (c["outs"] as Array).size():
		var o: Dictionary = c["outs"][j]
		var col: Color = KIND_COLOR.get(o["kind"], C_BLUE)
		var h := HBoxContainer.new()
		h.name = "Way_%d" % j
		h.add_theme_constant_override("separation", int(8 * s))
		var bar := ColorRect.new()
		bar.color = col
		bar.custom_minimum_size = Vector2(4, 0) * s
		h.add_child(bar)
		var v := VBoxContainer.new()
		v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		h.add_child(v)
		if o["kind"] == "if":
			var k := int(o["k"])
			var entry: Dictionary = st.quest_of(id)["next"][k]
			var r := HFlowContainer.new()
			r.add_child(BuildTab._label("if", 13, col, true))
			r.add_child(st._cond_chips(entry, "if", func(fn): st.change("A way's condition", func(): fn.call(st.quest_of(id)["next"][k]))))
			v.add_child(r)
		else:
			v.add_child(BuildTab._label(str(o["label"]), 13, col, true))
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", int(4 * s))
		row.add_child(BuildTab._label("→", 13, col))
		row.add_child(_target_pick(c, j))
		if o["kind"] == "if":
			for spec in [["↑", "Asked earlier (the first that holds wins)", -1], ["↓", "Asked later", 1]]:
				var mb := Button.new()
				mb.text = spec[0]
				mb.flat = true
				mb.tooltip_text = spec[1]
				mb.pressed.connect(func(): st.change("Move a way of %s" % id, func(): HSFlow.move_branch(st.f, id, int(o["k"]), int(spec[2]))))
				row.add_child(mb)
		if str(o.get("src", "")) in ["next", "timeout"]:
			var rm := Button.new()
			rm.name = "Cut"
			rm.text = "✕"
			rm.flat = true
			rm.tooltip_text = "Back to the list's order" if o["kind"] == "then" else "Take this way away"
			rm.pressed.connect(cut.bind(id, j))
			row.add_child(rm)
		v.add_child(row)
		side.add_child(h)
	var add := MenuButton.new()
	add.name = "AddWay"
	add.text = "+ A way: if…"
	add.flat = false
	add.tooltip_text = "A way taken only when something holds (asked before its then)"
	var pop := add.get_popup()
	var choices: Array = st.clause_choices()
	var n := 0
	for grp in choices:
		var sub := PopupMenu.new()
		sub.name = "Sub%d" % n
		for j in (grp[1] as Array).size():
			sub.add_item(str(grp[1][j][1]), j)
		var g_items: Array = grp[1]
		sub.id_pressed.connect(func(j): add_way(id, g_items[j][0]))
		pop.add_submenu_node_item(str(grp[0]), sub)
		n += 1
	add.disabled = choices.is_empty()
	side.add_child(add)


## a branch on the quest when the clause holds (its card picked next, or its dot dragged onto one)
func add_way(id: String, clause: Dictionary, to := "") -> void:
	var st = _story()
	if st == null:
		return
	var cond = HSCommands.build_cond("all", [clause])
	st.change("A new way out of %s" % id, func(): HSFlow.add_branch(st.f, id, cond, to))
	say("A new way: pick where it goes (or drag its dot onto a card)")


## where a way goes, picked from the cards (quests and endings)
func _target_pick(c: Dictionary, j: int) -> OptionButton:
	var st = _story()
	var o: Dictionary = c["outs"][j]
	var ob := OptionButton.new()
	ob.name = "To"
	ob.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	ob.clip_text = true
	var ids: Array = []
	if str(o["to"]) == "" or o.get("missing", false):
		ob.add_item("pick where it goes…")
		ids.append("")
	elif str(o["to"]) == HSFlow.ROAM:
		ob.add_item("the free roam (no ending yet)")
		ids.append(HSFlow.ROAM)
	for x in ch.get("cards", []):
		if x["kind"] in ["roam", "trigger"]:
			continue
		ob.add_item(_title(x))
		ids.append(str(x["id"]))
	ob.select(maxi(0, ids.find(str(o["to"]))))
	var id := str(c["id"])
	ob.item_selected.connect(func(ix):
		if str(ids[ix]) != "" and str(ids[ix]) != HSFlow.ROAM:
			connect_way(id, j, str(ids[ix])))
	return ob
