## A book in the hands (STORY_FORMAT: the `book` use; DECISIONS 2026-11-05, later: "a system for opening up books ...
## writing in the book that looks like handwriting ... an overlay UI on the right with clearer text ... progress the
## text"): the thing taken up as the inspect use takes it (play.gd exam_up), its cover swung open on its part (a made
## prop's: PROPGEN §27), its spread shown with the story's pages written on its page materials in a hand (a SubViewport
## a page, the page's own paper under the words, the fonts in fonts/), a spread at a time, the pages turned by the
## arrows, the wheel or a click on a page, the clean text of the spread on a panel at the right, and the book put back
## closed where it was. Its pages: `pages` (each a page, in order) and then its `entries`, each with an `if` (a flag,
## or a list of them, `!` for not, as a bed's `if`) and its text, appended in order while the condition holds, so
## what's read grows with the game. The story hears `read` (the book, the left page's number) at every spread, and
## `use` when it's put back.
extends RefCounted

const PartsC := preload("res://addons/horrorstudio/parts.gd")
const FONTS := {"hand": "Caveat-Variable.ttf", "hand2": "IndieFlower-Regular.ttf", "hand_jp": "Yomogi-Regular.ttf", "pen_jp": "ZenKurenaido-Regular.ttf"}
const OPEN_SECS := 0.45
const CLOSE_SECS := 0.32

var rt
var cur = null                    # {t, pages, at, rec, views, title, done}
var fonts: Dictionary = {}


func _init(rt_) -> void:
	rt = rt_


func up() -> bool:
	return cur != null


## the pages the book shows now: its own, then every entry whose `if` holds
func pages_of(t: Dictionary) -> Array:
	var d: Dictionary = rt.interactables.d_of(t)
	var out: Array = []
	for p in d.get("pages", []):
		out.append(_text(p))
	for e in d.get("entries", []):
		if e is Dictionary:
			if rt.if_holds(e.get("if")):
				var txt := _text(e)
				for pg in txt.split("\f"):               # an entry of several pages: a form feed between them
					out.append(pg)
		else:
			out.append(str(e))
	if out.is_empty():
		out.append("")
	return out


static func _text(p) -> String:
	if p is Dictionary:
		return str(p.get("text", ""))
	return str(p)


func font_of(hand: String) -> FontFile:
	if not FONTS.has(hand):
		return null
	if fonts.has(hand):
		return fonts[hand]
	var f = load("res://addons/horrorstudio/fonts/" + FONTS[hand])
	fonts[hand] = f
	return f


## the book opened in the hands: its pages drawn, the panel up till it's put back
func open(t: Dictionary, s: Dictionary) -> void:
	if cur != null:
		return
	var d: Dictionary = rt.interactables.d_of(t)
	var pages := pages_of(t)
	rt.examining = t
	var held: bool = rt.exam_small(t) and rt.exam_up(t)
	var id = t["id"]
	var title: String = rt.hud.named(d.get("title", rt.name_of(t)))
	cur = {"t": t, "pages": pages, "at": int(d.get("start", 0)) / 2 * 2, "rec": null, "views": {}, "title": title, "hand": str(d.get("hand", "hand")), "held": held}
	if held:
		rt.exam["lock"] = true                         # no turning it in the hands: it lies flat to be read
		var g: Node3D = rt.exam["turner"].get_child(0)   # the copy of its node (physics.gd copy_of)
		var parts: Array = t.get("parts", [])
		var on: Array = PartsC.on_copy(parts, t["node"], g)
		cur["rec"] = {"parts": on, "open_s": 0.0}
		PartsC.apply(on, 0.0)
		rt.shelf_sound("book_open", id, -4.0)
		rt.parts.go(cur["rec"], 1.0, OPEN_SECS)
		await rt.wait(OPEN_SECS)
		_make_views(g, t)
	_draw()
	rt.emit({"type": "read", "book": id, "page": cur["at"]})
	await rt.modal(func(): return await rt.hud.panel({"title": title, "text": _clean(), "side": true, "hint": s.get("hint", "")}))
	if cur == null:
		return
	if held and cur["rec"] != null:
		rt.shelf_sound("book_close", id, -6.0)
		rt.parts.go(cur["rec"], 0.0, CLOSE_SECS)
		await rt.wait(CLOSE_SECS)
	for k in cur["views"]:
		var v: Dictionary = cur["views"][k]
		if is_instance_valid(v["vp"]):
			v["vp"].queue_free()
	rt.exam_down()
	rt.examining = null
	cur = null


## the page materials on the copy (the glb's `<prop>_page_l` and `_page_r`): each gets a viewport of its own, the page's
## paper under the words, as its albedo
func _make_views(copy: Node3D, t: Dictionary) -> void:
	var pages_info = t.get("pages")
	var hand: String = cur["hand"]
	var font := font_of(hand)
	for mi in copy.find_children("*", "MeshInstance3D", true, false):
		if mi.mesh == null:
			continue
		for i in mi.mesh.get_surface_count():
			var m = mi.get_surface_override_material(i)
			if m == null:
				m = mi.get_active_material(i)
			if not (m is BaseMaterial3D):
				continue
			var nm := str(m.resource_name)
			var side := ""
			if nm.ends_with("_page_l") or nm == "page_l":
				side = "page_l"
			elif nm.ends_with("_page_r") or nm == "page_r":
				side = "page_r"
			if side == "" or cur["views"].has(side):
				continue
			var tex: Texture2D = m.albedo_texture
			var sz := Vector2i(1024, 1024)
			if tex != null:
				sz = Vector2i(int(tex.get_width()), int(tex.get_height()))
			var vp := SubViewport.new()
			vp.size = sz
			vp.transparent_bg = false
			vp.disable_3d = true
			vp.render_target_update_mode = SubViewport.UPDATE_ONCE
			var paper := TextureRect.new()
			paper.texture = tex
			paper.set_anchors_preset(Control.PRESET_FULL_RECT)
			paper.stretch_mode = TextureRect.STRETCH_SCALE
			if tex == null:
				var bg := ColorRect.new()
				bg.color = Color(0.95, 0.93, 0.87)
				bg.set_anchors_preset(Control.PRESET_FULL_RECT)
				vp.add_child(bg)
			else:
				vp.add_child(paper)
			# the page's own place on the texture (the island's rect, v up) and its size in mm, from the prop's extras
			var rect := [0.0, 0.0, 1.0, 1.0]
			var mm := [148.0, 210.0]
			if pages_info is Dictionary and pages_info.has(side):
				rect = pages_info[side].get("rect", rect)
				mm = pages_info[side].get("mm", mm)
			var x0 := float(rect[0]) * sz.x
			var x1 := float(rect[2]) * sz.x
			var y0 := (1.0 - float(rect[3])) * sz.y
			var y1 := (1.0 - float(rect[1])) * sz.y
			var pxmm: float = (x1 - x0) / max(1.0, float(mm[0]))
			var lab := Label.new()
			lab.position = Vector2(x0 + 8.0 * pxmm, y0 + 14.0 * pxmm)
			lab.size = Vector2((x1 - x0) - 16.0 * pxmm, (y1 - y0) - 22.0 * pxmm)
			lab.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			lab.clip_text = true
			lab.add_theme_color_override("font_color", Color(0.12, 0.14, 0.25))
			var fs: int = int(round(6.4 * pxmm * float(rt.interactables.d_of(t).get("font_size", 1.0))))
			if font != null:
				lab.add_theme_font_override("font", font)
			lab.add_theme_font_size_override("font_size", fs)
			lab.add_theme_constant_override("line_spacing", int(round(max(0.0, 9.0 * pxmm - fs * 1.25))))
			vp.add_child(lab)
			rt.exam["pivot"].add_child(vp)
			var mat: BaseMaterial3D = m
			mat.albedo_texture = vp.get_texture()
			mat.albedo_color = Color.WHITE
			cur["views"][side] = {"vp": vp, "label": lab}


func _draw() -> void:
	if cur == null:
		return
	var pages: Array = cur["pages"]
	var at: int = cur["at"]
	for side in ["page_l", "page_r"]:
		if not cur["views"].has(side):
			continue
		var i: int = at + (0 if side == "page_l" else 1)
		var v: Dictionary = cur["views"][side]
		v["label"].text = pages[i] if i < pages.size() else ""
		v["vp"].render_target_update_mode = SubViewport.UPDATE_ONCE


## the spread's words, plain, for the panel at the right
func _clean() -> String:
	if cur == null:
		return ""
	var pages: Array = cur["pages"]
	var at: int = cur["at"]
	var n := pages.size()
	var parts: Array = []
	for i in [at, at + 1]:
		if i < n and str(pages[i]).strip_edges() != "":
			parts.append(str(pages[i]))
	var spread := int(at / 2) + 1
	var total := int((n + 1) / 2)
	return "\n\n".join(parts) + ("\n\n— %d / %d —" % [spread, total] if total > 1 else "")


## the next spread (dir 1) or the one before (-1); true when it turned
func turn(dir: int) -> bool:
	if cur == null:
		return false
	var n: int = cur["pages"].size()
	var last: int = max(0, int((n - 1) / 2) * 2)
	var to: int = clamp(int(cur["at"]) + 2 * dir, 0, last)
	if to == int(cur["at"]):
		return false
	cur["at"] = to
	rt.shelf_sound(["page_turn_01", "page_turn_02", "page_turn_03"][randi() % 3], cur["t"]["id"], -8.0)
	_draw()
	rt.hud.panel_text(_clean())
	rt.emit({"type": "read", "book": cur["t"]["id"], "page": to})
	return true
