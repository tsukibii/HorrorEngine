@tool
extends HBoxContainer
## The panel's Animate tab (docs/GODOT_ANIMATION_PLAN.md §4; the user, 2026-11-02: "an animation and facial animation
## tab to store animations… drag and drop"): the project's library (core/library.gd, HSLibrary) as cards, Body (the
## clips in res://animations/: Kimodo's .npz, Godot animations; a folder named after a character holds hers) and Face
## (the face clips in res://faces/), grouped by what they're for. Select a character and click a card, or drag the card
## onto her in the 3D view or the Scene tree: her idle, her walk, hers for the story to play, or a look at it on her
## (▶, in the editor; ■ stops it and puts her back). A body clip and a face clip play on her at once (her bones, her
## face shapes). The folders are watched: a file dropped in is a card.

const Glyphs := preload("res://addons/horrorstudio_director/editor/glyphs.gd")
const BuildTab := preload("res://addons/horrorstudio_director/editor/build_tab.gd")
const FaceC := preload("res://addons/horrorstudio/face.gd")
const ROOT := "res://addons/horrorstudio_director/"
const ROLE_GLYPH := {"idle": "person", "walk": "motion", "run": "motion", "sit": "chair", "stand": "person", "talk": "whisper",
	"listen": "thought", "look": "search", "react": "scare", "scare": "scare", "other": "motion"}
const C_TEXT := Color("#E8EBF0")
const C_MUTED := Color("#A3ACB9")
const C_FAINT := Color("#8A93A1")
const C_BLUE := Color("#6CB4F5")
const C_CARD := Color("#262B33")
const C_LINE := Color("#353C47")
const C_SIDE := Color("#1A1E23")
const C_FACE := Color("#E6A2C0")

var panel = null
var face_side := false              # Body (false) or Face
var left: VBoxContainer
var mid: VBoxContainer
var right: VBoxContainer
var _menu: PopupMenu
var _acts := {}
var body_clips: Array = []          # HSLibrary.body(), as last read
var face_clips: Array = []
var playing := {}                   # what's being looked at in the editor: {actor, ap, sk} for a body clip
var face_play := {}                 # {actor, mesh, idx, clip, t, was: {blend index: weight}} for a face clip
var _fs_hooked := false
var figs: Array = []                # the cards' figures: [{ctl, fig, t, on}], played while the mouse is over the card
var _sig := ""                      # the folders' files and times as last drawn (Godot's scan skips an .npz: polled here)
var _poll := 0.0


func _ready() -> void:
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	add_theme_constant_override("separation", 0)
	left = _column(200, C_SIDE)
	add_child(VSeparator.new())
	var ms := ScrollContainer.new()
	ms.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	ms.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	var mm := MarginContainer.new()
	mm.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	for k in ["left", "right", "top", "bottom"]:
		mm.add_theme_constant_override("margin_" + k, int(14 * _s()))
	ms.add_child(mm)
	mid = VBoxContainer.new()
	mid.name = "Cards"
	mid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	mid.add_theme_constant_override("separation", int(10 * _s()))
	mm.add_child(mid)
	add_child(ms)
	add_child(VSeparator.new())
	right = _column(280, C_SIDE)
	_menu = PopupMenu.new()
	_menu.name = "Menu"
	_menu.id_pressed.connect(func(i):
		if _acts.has(i):
			_acts[i].call())
	add_child(_menu)
	refresh()


func _column(w: float, bg: Color) -> VBoxContainer:
	var sc := ScrollContainer.new()
	sc.custom_minimum_size = Vector2(w, 0) * _s()
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	sc.add_theme_stylebox_override("panel", BuildTab._box(bg, Color(0, 0, 0, 0), 0, 0, 0))
	var m := MarginContainer.new()
	m.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	for k in ["left", "right", "top", "bottom"]:
		m.add_theme_constant_override("margin_" + k, int(12 * _s()))
	sc.add_child(m)
	var v := VBoxContainer.new()
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	v.add_theme_constant_override("separation", int(6 * _s()))
	m.add_child(v)
	add_child(sc)
	return v


static func _s() -> float:
	return Glyphs.scale()


func _process(dt: float) -> void:
	_poll += dt
	if _poll > 2.0 and is_visible_in_tree():
		_poll = 0.0
		if _signature() != _sig:                    # a file dropped into a folder (or taken out): its card
			refresh()
	for st in figs:
		if st["on"] and is_instance_valid(st["ctl"]):
			st["t"] = float(st["t"]) + dt
			(st["ctl"] as Control).queue_redraw()
	if not face_play.is_empty():                    # a face clip looked at in the editor: its weights on her face shapes
		var mi: MeshInstance3D = face_play["mesh"]
		if not is_instance_valid(mi):
			face_play = {}
			return
		face_play["t"] = float(face_play["t"]) + dt
		var c = face_play["clip"]
		var w := PackedFloat32Array()
		c.at(float(face_play["t"]) if c.loop else fmod(float(face_play["t"]), maxf(float(c.secs), 0.1)), w)
		for i in c.shapes.size():
			var b = (face_play["idx"] as Dictionary).get(str(c.shapes[i]), -1)
			if int(b) >= 0:
				mi.set_blend_shape_value(int(b), w[i])


## the two folders' files with their times, as one string
static func _signature() -> String:
	var out := PackedStringArray()
	var todo: Array = [HSLibrary.BODY, HSLibrary.FACES, HSLibrary.OLD]
	while todo.size():
		var d: String = todo.pop_back()
		var ad := ProjectSettings.globalize_path(d)
		if not DirAccess.dir_exists_absolute(ad):
			continue
		for f in DirAccess.get_files_at(ad):
			out.append("%s/%s@%d" % [d, f, FileAccess.get_modified_time(d.path_join(f))])
		for sub in DirAccess.get_directories_at(ad):
			if sub != HSLibrary.MADE and not sub.begins_with("."):
				todo.append(d.path_join(sub))
	out.sort()
	return "|".join(out)


## a card's drag ended nowhere: it isn't waiting to land any more
func _notification(what: int) -> void:
	if what == NOTIFICATION_DRAG_END and panel != null and panel.plugin != null and not is_drag_successful():
		panel.plugin.pending_anim = null


# ---- drawing ----------------------------------------------------------------------------------------------------------
func refresh() -> void:
	if left == null:
		return
	if not _fs_hooked and Engine.is_editor_hint():
		var fs := EditorInterface.get_resource_filesystem()
		if fs != null:
			fs.filesystem_changed.connect(func(): if is_visible_in_tree(): refresh())
			_fs_hooked = true
	_sig = _signature()
	body_clips = HSLibrary.body()
	face_clips = HSLibrary.faces()
	figs.clear()
	for col in [left, mid, right]:
		for c in col.get_children():
			col.remove_child(c)
			c.queue_free()
	_draw_left()
	_draw_mid()
	_draw_right()


func _draw_left() -> void:
	left.add_child(BuildTab._label("Animations", 12, C_FAINT, true))
	for spec in [["Body", false, "the clips in res://animations/: Kimodo's .npz, Godot animations"], ["Face", true, "the face clips in res://faces/"]]:
		var b := Button.new()
		b.name = "Side_" + spec[0]
		b.toggle_mode = true
		b.button_pressed = face_side == spec[1]
		b.text = "%s   %d" % [spec[0], face_clips.size() if spec[1] else body_clips.size()]
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.tooltip_text = spec[2]
		b.custom_minimum_size = Vector2(0, 36) * _s()
		b.icon = Glyphs.icon("face" if spec[1] else "person", "#9CCBFA", 16)
		b.add_theme_stylebox_override("normal", BuildTab._box(C_CARD, C_LINE, 8, 1, 8))
		b.add_theme_stylebox_override("pressed", BuildTab._box(Color("#22303F"), C_BLUE, 8, 1, 8))
		b.add_theme_stylebox_override("hover_pressed", BuildTab._box(Color("#22303F"), C_BLUE, 8, 1, 8))
		b.pressed.connect(func(): face_side = spec[1]; refresh())
		left.add_child(b)
	left.add_child(BuildTab._wrap(BuildTab._label("Drop files into the folders: they show up here.", 12, C_MUTED)))
	for spec in [["animations/", HSLibrary.BODY], ["faces/", HSLibrary.FACES]]:
		var b := BuildTab._button("Open " + spec[0], false)
		b.tooltip_text = "The project's %s folder in your file manager: drag files into it" % spec[0]
		b.custom_minimum_size = Vector2(0, 32) * _s()
		b.pressed.connect(func():
			DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(spec[1]))
			OS.shell_open(ProjectSettings.globalize_path(spec[1])))
		left.add_child(b)


func _draw_mid() -> void:
	var list: Array = face_clips if face_side else body_clips
	var who = _actor()
	if list.is_empty():
		mid.add_child(BuildTab._label("No face clips yet" if face_side else "No animations yet", 16, C_TEXT, true))
		mid.add_child(BuildTab._wrap(BuildTab._label(
			"Make face clips on the Face page and save them for Godot into res://faces/." if face_side else
			"Drop Kimodo's .npz files (or Godot animations) into res://animations/. A folder named after a character's id (res://animations/mari/) holds hers.", 13, C_MUTED)))
		return
	var groups := {}
	for c in list:
		var g := "Faces" if face_side else HSLibrary.ROLE_NAMES.get(str(c["role"]), "Other")
		if face_side and bool(c["loop"]):
			g = "Loops"
		if not groups.has(g):
			groups[g] = []
		groups[g].append(c)
	for g in groups:
		mid.add_child(BuildTab._label(str(g).to_upper(), 11, C_FAINT, true))
		var flow := HFlowContainer.new()
		flow.add_theme_constant_override("h_separation", int(10 * _s()))
		flow.add_theme_constant_override("v_separation", int(10 * _s()))
		for c in groups[g]:
			flow.add_child(_card(c, who))
		mid.add_child(flow)


func _card(c: Dictionary, who) -> Control:
	var s := _s()
	var b := Button.new()
	b.name = ("Face_" if face_side else "Clip_") + str(c["id"]).validate_node_name()
	b.custom_minimum_size = Vector2(240, 86) * s
	b.text = ""
	b.tooltip_text = str(c["path"])
	var mine: bool = who != null and not face_side and HSLibrary.hers(who).has(str(c["id"]))
	b.add_theme_stylebox_override("normal", BuildTab._box(C_CARD, C_BLUE if mine else C_LINE, 10, 1, 8))
	b.add_theme_stylebox_override("hover", BuildTab._box(Color("#2B313B"), C_BLUE, 10, 1, 8))
	b.add_theme_stylebox_override("pressed", BuildTab._box(Color("#22303F"), C_BLUE, 10, 2, 8))
	var h := HBoxContainer.new()
	h.mouse_filter = Control.MOUSE_FILTER_IGNORE
	h.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT, Control.PRESET_MODE_MINSIZE, int(8 * s))
	h.add_theme_constant_override("separation", int(8 * s))
	if not face_side and c["kind"] == "npz":
		h.add_child(_figure(b, c, mine))
	else:
		var tr := TextureRect.new()
		tr.mouse_filter = Control.MOUSE_FILTER_IGNORE
		tr.texture = Glyphs.tile("face" if face_side else str(ROLE_GLYPH.get(c.get("role", "other"), "motion")), "amber" if face_side else "blue", mine, 40)
		tr.stretch_mode = TextureRect.STRETCH_KEEP_CENTERED
		h.add_child(tr)
	var v := VBoxContainer.new()                    # its name, its length and kind, then whose folder it's in and whether she has it
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_theme_constant_override("separation", int(2 * s))
	var t := BuildTab._label(str(c.get("title", c["id"])), 13, C_TEXT, true)
	t.clip_text = true
	t.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	v.add_child(t)
	var bits: Array = ["%.1f s" % float(c["secs"]), "loops" if bool(c["loop"]) else "once"]
	if not face_side:
		bits.append("Kimodo" if c["kind"] == "npz" else "Godot")
	var l := BuildTab._label(" · ".join(PackedStringArray(bits)), 11, C_MUTED)
	l.clip_text = true
	v.add_child(l)
	if not face_side and (mine or str(c["for"]) != ""):
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", int(6 * s))
		if mine:
			row.add_child(BuildTab._label("hers", 11, C_BLUE, true))
		if str(c["for"]) != "":
			row.add_child(BuildTab._label("in %s's folder" % c["for"], 11, C_FAINT))
		v.add_child(row)
	for x in v.find_children("*", "Control", true, false):
		x.mouse_filter = Control.MOUSE_FILTER_IGNORE
	h.add_child(v)
	b.add_child(h)
	b.pressed.connect(func(): pick(c))
	b.set_drag_forwarding(func(_at): return _drag(b, c), func(_a, _d): return false, func(_a, _d): pass)
	return b


## a Kimodo clip's picture: its figure (core/library.gd figure) at its start, middle and end; played while the mouse is
## over its card
func _figure(card: Button, c: Dictionary, mine: bool) -> Control:
	var ctl := Control.new()
	ctl.name = "Figure"
	ctl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ctl.custom_minimum_size = Vector2(46, 66) * _s()
	var st := {"ctl": ctl, "fig": HSLibrary.figure(str(c["path"])), "t": 0.0, "on": false, "mine": mine}
	ctl.draw.connect(func(): _draw_figure(st))
	card.mouse_entered.connect(func(): st["on"] = true)
	card.mouse_exited.connect(func():
		st["on"] = false
		st["t"] = 0.0
		ctl.queue_redraw())
	figs.append(st)
	return ctl


func _draw_figure(st: Dictionary) -> void:
	var ctl: Control = st["ctl"]
	var fig: Dictionary = st["fig"]
	var frames: Array = fig["frames"]
	var s := _s()
	ctl.draw_rect(Rect2(Vector2.ZERO, ctl.size), Color("#1E2A38") if st["mine"] else Color("#20252C"))
	if frames.is_empty():
		return
	var box := Rect2(Vector2(4, 4) * s, ctl.size - Vector2(8, 8) * s)
	var k := minf(box.size.y, box.size.x / maxf(float(fig["w"]), 0.05))
	var at := box.position + Vector2((box.size.x - float(fig["w"]) * k) / 2.0, (box.size.y - k) / 2.0)
	var n := frames.size()
	var picks: Array
	if st["on"]:
		var secs := maxf(float(fig["secs"]), 0.1)
		picks = [[int(fmod(float(st["t"]), secs) / secs * n) % n, 1.0]]
	else:
		picks = [[0, 0.28], [n / 2, 0.5], [n - 1, 1.0]] if n > 2 else [[n - 1, 1.0]]
	var up: Array = fig["up"]
	for p in picks:
		var pts: PackedVector2Array = frames[p[0]]
		var col := Color(C_BLUE, float(p[1]))
		for i in pts.size():
			if int(up[i]) >= 0:
				ctl.draw_line(at + pts[int(up[i])] * k, at + pts[i] * k, col, 1.6 * s, true)
		var hd := (pts[6] + pts[7]) / 2.0                   # the head: round the head's joint and its top
		ctl.draw_arc(at + hd * k, maxf(2.0 * s, (pts[7] - pts[6]).length() * k * 0.6), 0.0, TAU, 16, col, 1.4 * s, true)


func _draw_right() -> void:
	var a = _actor()
	right.add_child(BuildTab._label("This character", 12, C_FAINT, true))
	if a == null:
		for t in ["Select a character (in the Scene tree or the 3D view), then click a card: her idle, her walk, hers, or a look at it on her.",
				"Or drag a card onto her in the 3D view or the Scene tree.",
				"A body clip and a face clip play on her at once."]:
			right.add_child(BuildTab._wrap(BuildTab._label(t, 13, C_MUTED)))
	else:
		right.add_child(BuildTab._label(str(a.name), 16, C_TEXT, true))
		for spec in [["Idle", "idle_motion"], ["Walk", "walk_motion"], ["Resting face", "expression"]]:
			var v := str(a.get(spec[1]))
			right.add_child(BuildTab._wrap(BuildTab._label("%s: %s" % [spec[0], v if v != "" else "none yet"], 13, C_TEXT if v != "" else C_FAINT)))
		var hers := HSLibrary.hers(a)
		right.add_child(BuildTab._wrap(BuildTab._label("Hers: " + (", ".join(PackedStringArray(hers)) if hers.size() else "none yet"), 12, C_MUTED)))
	if not playing.is_empty() or not face_play.is_empty():
		var st := BuildTab._button("■ Stop the preview", true)
		st.name = "StopPreview"
		st.pressed.connect(stop)
		right.add_child(st)


## the character selected (an HSActor, or a model inside one)
func _actor():
	var sel = panel.dock.selected() if panel != null and panel.dock != null else null
	var n = sel
	while n != null and is_instance_valid(n):
		if HSDirector.is_a(n, "HSActor"):
			return n
		n = n.get_parent()
	return null


# ---- a card clicked or dropped --------------------------------------------------------------------------------------
func pick(c: Dictionary) -> void:
	var a = _actor()
	if a == null:
		panel.say("Select a character first (or drag the card onto her)")
		return
	menu_for(a, c, DisplayServer.mouse_get_position())


func menu_for(a: Node3D, c: Dictionary, at: Vector2) -> void:
	_menu.clear()
	_acts.clear()
	var items: Array
	if face_side or c.has("title"):
		items = [["Her resting face", func(): set_face(a, c)], ["Look at it on her face (▶)", func(): preview_face(a, c)]]
	else:
		items = [["Her idle", func(): set_move(a, c, "idle")], ["Her walk", func(): set_move(a, c, "walk")],
			["Hers, for the story to play", func(): set_move(a, c, "")], ["Look at it on her (▶)", func(): preview(a, c)]]
	for i in items.size():
		_menu.add_item(items[i][0], i)
		_acts[i] = items[i][1]
	_menu.reset_size()
	_menu.position = Vector2i(at)
	_menu.popup()


func _drag(b: Button, c: Dictionary):
	panel.plugin.pending_anim = {"clip": c, "face": face_side, "at": Time.get_ticks_msec()}
	var pv := PanelContainer.new()
	pv.add_theme_stylebox_override("panel", BuildTab._box(C_CARD, C_BLUE, 12, 2, 10))
	pv.add_child(BuildTab._label(str(c.get("title", c["id"])), 14, C_TEXT, true))
	b.set_drag_preview(pv)
	return {"type": "files", "files": [ROOT + "presets/spot.tscn"], "from": b}


## a card dropped into the 3D view or the Scene tree (plugin.gd _unlink): the character it fell on (in the 3D view
## the one under the mouse, else the nearest within a metre and a half; in the Scene tree the one it was dropped on),
## the drop taken back, the menu for her
func landed(token: Node, pa: Dictionary) -> void:
	var a = null
	if _mouse_in_view():
		a = _actor_under_mouse()
		if a == null:
			var best := 1.5
			for x in HSDirector.nodes_of(panel.dock.root(), "HSActor"):
				var d: float = (x.global_position - token.global_position).length()
				if d < best:
					best = d
					a = x
	else:
		var n = token.get_parent()
		while n != null and a == null:
			if HSDirector.is_a(n, "HSActor"):
				a = n
			n = n.get_parent()
	var r = panel.dock.root()
	var ur = panel.plugin.get_undo_redo()
	ur.get_history_undo_redo(ur.get_object_history_id(r)).undo()   # the drop's spot, taken back
	if a == null:
		panel.say("Drop it on a character")
		return
	face_side = bool(pa.get("face", false))
	panel.show_page("animate")
	panel.dock.select(a)
	menu_for(a, pa["clip"], DisplayServer.mouse_get_position())


func _view() -> SubViewport:
	return EditorInterface.get_editor_viewport_3d(0)


func _mouse_in_view() -> bool:
	var vp := _view()
	return vp != null and Rect2(Vector2.ZERO, vp.get_visible_rect().size).has_point(vp.get_mouse_position())


## the character under the mouse in the 3D view: the nearest whose meshes' boxes (her model's, the stand-in's) the
## mouse's ray meets (the panel's model picking leaves characters out: plugin.gd _target)
func _actor_under_mouse():
	var vp := _view()
	var cam: Camera3D = vp.get_camera_3d() if vp != null else null
	if cam == null or not _mouse_in_view():
		return null
	var mp := vp.get_mouse_position()
	return actor_on_ray(panel.dock.root(), cam.project_ray_origin(mp), cam.project_ray_normal(mp))


static func actor_on_ray(root: Node, from: Vector3, dir: Vector3):
	var best = null
	var best_t := INF
	for a in HSDirector.nodes_of(root, "HSActor"):
		for mi in a.find_children("*", "MeshInstance3D", true, false):
			if mi.mesh == null or not mi.is_visible_in_tree():
				continue
			var inv: Transform3D = mi.global_transform.affine_inverse()
			var hit = mi.get_aabb().intersects_ray(inv * from, inv.basis * dir)
			if hit == null:
				continue
			var t: float = from.distance_to(mi.global_transform * (hit as Vector3))
			if t < best_t:
				best_t = t
				best = a
	return best


## the clip made hers (core/library.gd make_for) and, for a slot, her idle or her walk (on the scene's undo)
func set_move(a: Node3D, c: Dictionary, slot: String) -> void:
	var why := [""]
	var nm := HSLibrary.make_for(a, c, why)
	if nm == "":
		panel.say(why[0])
		return
	if slot != "":
		var key := slot + "_motion"
		var ur = panel.plugin.get_undo_redo()
		ur.create_action("%s's %s: %s" % [a.name, slot, nm])
		ur.add_do_property(a, key, nm)
		ur.add_undo_property(a, key, a.get(key))
		ur.commit_action()
	EditorInterface.mark_scene_as_unsaved()
	panel.say("%s is %s's %s now" % [nm, a.name, slot] if slot != "" else "%s is %s's: the story can play it (Animate %s)" % [nm, a.name, a.name])
	refresh()


func set_face(a: Node3D, c: Dictionary) -> void:
	var ur = panel.plugin.get_undo_redo()
	ur.create_action("%s's resting face: %s" % [a.name, c["id"]])
	ur.add_do_property(a, "expression", str(c["id"]))
	ur.add_undo_property(a, "expression", a.get("expression"))
	ur.commit_action()
	panel.say("%s rests in %s now" % [a.name, c["id"]])
	refresh()


# ---- a look at it on her, in the editor ---------------------------------------------------------------------------------
## the clip played on her in the 3D view, nothing saved: made in memory (core/library.gd animation_for) on a player of
## its own beside her (`_Preview`: a name with "_" and no owner, never saved), her pose put back by ■ and before a save
## (plugin.gd _apply_changes)
func preview(a: Node3D, c: Dictionary) -> void:
	_stop_body()
	var ap := AnimationPlayer.new()
	ap.name = "_Preview"
	a.add_child(ap)
	ap.root_node = NodePath("..")
	var why := [""]
	var anim := HSLibrary.animation_for(a, c, a, why)
	if anim == null:
		ap.queue_free()
		panel.say(why[0])
		return
	var lib := AnimationLibrary.new()
	var shown := anim.duplicate() as Animation
	shown.loop_mode = Animation.LOOP_LINEAR                 # a look goes round till it's stopped
	lib.add_animation("clip", shown)
	ap.add_animation_library("p", lib)
	var sk := HSRetarget.skeleton_of(a)
	var was: Array = []                                     # her pose as it was, put back by ■
	if sk != null:
		for i in sk.get_bone_count():
			was.append([sk.get_bone_pose_position(i), sk.get_bone_pose_rotation(i), sk.get_bone_pose_scale(i)])
	ap.play("p/clip")
	playing = {"actor": a, "ap": ap, "sk": sk, "was": was}
	panel.say("%s on %s (■ Stop puts her back)" % [c["id"], a.name])
	refresh()


func preview_face(a: Node3D, c: Dictionary) -> void:
	var fc = load(str(c["path"]))
	var fo := FaceC.face_of(a)
	if fc == null or fo.is_empty():
		panel.say("%s has no face shapes to play it on (a Character Studio export, or MHR)" % a.name)
		return
	_stop_face()
	var mi: MeshInstance3D = fo["mesh"]
	var was := {}
	for i in mi.get_blend_shape_count():
		was[i] = mi.get_blend_shape_value(i)
	face_play = {"actor": a, "mesh": mi, "idx": fo["idx"], "clip": fc, "t": 0.0, "was": was}
	panel.say("%s on %s's face (■ Stop puts it back)" % [c["id"], a.name])
	refresh()


func stop() -> void:
	if playing.is_empty() and face_play.is_empty():
		return
	_stop_body()
	_stop_face()
	refresh()


func _stop_body() -> void:
	if playing.is_empty():
		return
	var ap = playing.get("ap")
	if is_instance_valid(ap):
		ap.stop()
		ap.get_parent().remove_child(ap)
		ap.queue_free()
	var sk = playing.get("sk")
	if is_instance_valid(sk):
		var was: Array = playing.get("was", [])
		for i in mini(was.size(), sk.get_bone_count()):
			sk.set_bone_pose_position(i, was[i][0])
			sk.set_bone_pose_rotation(i, was[i][1])
			sk.set_bone_pose_scale(i, was[i][2])
	playing = {}


func _stop_face() -> void:
	if face_play.is_empty():
		return
	var mi = face_play.get("mesh")
	if is_instance_valid(mi):
		for i in face_play["was"]:
			mi.set_blend_shape_value(int(i), float(face_play["was"][i]))
	face_play = {}
