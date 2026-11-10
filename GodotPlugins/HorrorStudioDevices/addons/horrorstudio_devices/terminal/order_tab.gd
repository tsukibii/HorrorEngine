extends Control
## The Order tab (HSTerminal's; the user, 2026-11-10: "a order tab, a player can order items with cash they have"): the
## shop's things a page at a time (the user, later: "create a next page for the buying item (rather than scrolling
## down), should have prev and next page, maybe a number system 1,2,3 where the current page has brackets [2]"): the
## laptop's `page_size` cards a page, three a row, a category never sharing a page (its name the page's heading); under
## them `< PREV`, the pages' numbers with the one shown in brackets, `NEXT >` (the arrow keys and Page Up and Down turn
## them too). Each card is its thing's own model in the terminal's green (HSModelSlot, the HUD's own slot: the things
## themselves, not pictures), its name, its price and how many are left, NEW when it's just been unlocked; a thing not
## unlocked yet is a ? (`???`, LOCKED, its `locked_text` when picked, not to be ordered). The one picked is large on the
## right, turning, its words typed out, how many (- +), the total and ORDER. The order is the laptop's (paid from the
## cash, into the pocket or on its way in a parcel); too dear or sold out, it says so.

const PHOSPHOR := preload("res://addons/horrorstudio_devices/terminal/phosphor.gdshader")

var term: Node
var items: Array = []                               # the shop's HSShopItems, in order
var pages: Array = []                               # [{category, items}]
var page := 0                                       # the page shown
var picked: HSShopItem = null
var qty := 1
var cards := {}                                     # id -> its card on the page shown
var shown_ids := {}                                 # ids whose card was shown unlocked (no longer NEW once the player leaves)
var _store: Label
var _heading: Label
var _page_of: Label
var _grid: GridContainer
var _prev: Button
var _next: Button
var _numbers: HBoxContainer
var _slot_box: Control
var _slot: Control
var _title: Label
var _about: Label
var _about_text := ""
var _about_t := 0.0
var _price: Label
var _left: Label
var _qty: Label
var _total: Label
var _buy: Button
var _note: Label
var _hover: Control = null


func setup(t: Node) -> void:
	term = t
	_build()
	refresh()


func _build() -> void:
	var h := HBoxContainer.new()
	h.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	h.add_theme_constant_override("separation", 14)
	add_child(h)
	var left := VBoxContainer.new()
	left.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	left.size_flags_stretch_ratio = 1.55
	left.add_theme_constant_override("separation", 6)
	h.add_child(left)
	_store = term._label("", term.look.hot)
	left.add_child(_store)
	var head := HBoxContainer.new()
	left.add_child(head)
	_heading = term._label("", term.look.dim)
	_heading.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(_heading)
	_page_of = term._label("", term.look.dim)
	_page_of.add_theme_font_size_override("font_size", int(term.look.text_px * 0.75))
	head.add_child(_page_of)
	_grid = GridContainer.new()
	_grid.name = "Cards"
	_grid.columns = 3
	_grid.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_grid.add_theme_constant_override("h_separation", 8)
	_grid.add_theme_constant_override("v_separation", 8)
	left.add_child(_grid)
	var pager := HBoxContainer.new()
	pager.name = "Pager"
	pager.alignment = BoxContainer.ALIGNMENT_CENTER
	pager.add_theme_constant_override("separation", 6)
	left.add_child(pager)
	_prev = _button(" < PREV ", func() -> void: show_page(page - 1))
	_prev.name = "Prev"
	pager.add_child(_prev)
	_numbers = HBoxContainer.new()
	_numbers.name = "Numbers"
	_numbers.add_theme_constant_override("separation", 2)
	pager.add_child(_numbers)
	_next = _button(" NEXT > ", func() -> void: show_page(page + 1))
	_next.name = "Next"
	pager.add_child(_next)
	var under := Control.new()                         # clear of the foot's rule
	under.custom_minimum_size = Vector2(0, 6)
	left.add_child(under)
	var right := PanelContainer.new()
	right.name = "Picked"
	right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	h.add_child(right)
	var rv := VBoxContainer.new()
	rv.add_theme_constant_override("separation", 4)
	right.add_child(rv)
	_slot_box = CenterContainer.new()
	_slot_box.custom_minimum_size = Vector2(0, 160)
	rv.add_child(_slot_box)
	_title = term._label("", term.look.hot)
	_title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	rv.add_child(_title)
	_about = term._label("", term.look.ink)
	_about.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_about.custom_minimum_size = Vector2(0, 44)     # (room for a two-line note under ORDER)
	_about.add_theme_font_size_override("font_size", int(term.look.text_px * 0.8))
	_about.size_flags_vertical = Control.SIZE_EXPAND_FILL
	rv.add_child(_about)
	_price = term._label("", term.look.ink)
	rv.add_child(_price)
	_left = term._label("", term.look.dim)
	rv.add_child(_left)
	var q := HBoxContainer.new()
	q.add_theme_constant_override("separation", 8)
	rv.add_child(q)
	var minus := _button(" - ", func() -> void: _step(-1))
	minus.name = "Less"
	q.add_child(minus)
	_qty = term._label("1", term.look.hot)
	_qty.custom_minimum_size = Vector2(34, 0)
	_qty.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	q.add_child(_qty)
	var plus := _button(" + ", func() -> void: _step(1))
	plus.name = "More"
	q.add_child(plus)
	var sp := Control.new()
	sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	q.add_child(sp)
	_total = term._label("", term.look.ink)
	q.add_child(_total)
	_buy = _button("  ORDER  ", order_now)
	_buy.name = "Order"
	_buy.custom_minimum_size = Vector2(0, 48)
	rv.add_child(_buy)
	_note = term._label("", term.look.dim)
	_note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_note.add_theme_font_size_override("font_size", int(term.look.text_px * 0.75))
	rv.add_child(_note)


## the pages again from the shop (a thing added or unlocked, its stock changed): the page shown kept where it can be
func refresh() -> void:
	items = term.laptop.call("items")
	var per: int = maxi(int(term.laptop.get("page_size")), 1)
	pages = []
	for it: HSShopItem in items:
		if pages.is_empty() or pages.back()["category"] != it.category or pages.back()["items"].size() >= per:
			pages.append({"category": it.category, "items": []})
		pages.back()["items"].append(it)
	_store.text = "%s  //  %d ITEMS" % [str(term.laptop.call("store_name")), items.size()]
	if picked != null and not items.has(picked):
		picked = null
	show_page(page, false)
	if picked == null:
		var on_page: Array = pages[page]["items"] if not pages.is_empty() else []
		if not on_page.is_empty():
			select(on_page[0], false)
		else:
			_title.text = ""
			_about_text = ""
			_about.text = ""
			_update()
	else:
		select(picked, false)


## which page a thing is on (-1: not in the shop)
func page_of(id: String) -> int:
	for i in pages.size():
		for it: HSShopItem in pages[i]["items"]:
			if it.id == id:
				return i
	return -1


## a page of cards: its heading, its cards, the pager under them
func show_page(i: int, sound := true) -> void:
	var was := page
	page = clampi(i, 0, maxi(pages.size() - 1, 0))
	for c in _grid.get_children():
		_grid.remove_child(c)
		c.queue_free()
	cards = {}
	_hover = null
	if pages.is_empty():
		_heading.text = "NOTHING FOR SALE."
		_page_of.text = ""
	else:
		var pg: Dictionary = pages[page]
		var cat: String = pg["category"]
		_heading.text = "== %s ==" % (cat.to_upper() if cat != "" else "ALL")
		_page_of.text = "PAGE %d OF %d" % [page + 1, pages.size()]
		for it: HSShopItem in pg["items"]:
			var c := _card(it)
			_grid.add_child(c)
			cards[it.id] = c
			if term.laptop.call("unlocked", it):
				shown_ids[it.id] = true
	_draw_pager()
	if sound and page != was:
		term.laptop.call("sound", "tick")


func _draw_pager() -> void:
	for c in _numbers.get_children():
		_numbers.remove_child(c)
		c.queue_free()
	var n := pages.size()
	_prev.disabled = page <= 0
	_next.disabled = page >= n - 1
	for k in page_numbers(n, page):
		if k < 0:
			_numbers.add_child(term._label("..", term.look.dim))
			continue
		var b := _button(("[%d]" if k == page else " %d ") % (k + 1), func() -> void: show_page(k))
		b.name = "Page%d" % (k + 1)
		b.flat = true
		if k == page:
			b.disabled = true
			b.add_theme_color_override("font_disabled_color", term.look.hot)
		_numbers.add_child(b)


## the numbers the pager shows: all of them up to nine, else the first, the last and two each side of the one shown, a
## gap (-1) between
static func page_numbers(n: int, cur: int) -> Array:
	var out: Array = []
	if n <= 9:
		for k in n:
			out.append(k)
		return out
	var lo := maxi(1, cur - 2)
	var hi := mini(n - 2, cur + 2)
	out.append(0)
	if lo > 1:
		out.append(-1)
	for k in range(lo, hi + 1):
		out.append(k)
	if hi < n - 2:
		out.append(-1)
	out.append(n - 1)
	return out


func _card(it: HSShopItem) -> Control:
	var locked := not bool(term.laptop.call("unlocked", it))
	var card := PanelContainer.new()
	card.name = "Card_" + it.id
	card.custom_minimum_size = Vector2(176, 0)
	card.mouse_filter = Control.MOUSE_FILTER_STOP
	var v := VBoxContainer.new()
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_theme_constant_override("separation", 0)
	card.add_child(v)
	var slot: Control = mystery(Vector2i(160, 100)) if locked else slot_of(it, Vector2i(160, 100), false)
	v.add_child(slot)
	var nm: Label = term._label("???" if locked else it.name_of().to_upper(), term.look.dim if locked else term.look.ink)
	nm.clip_text = true
	nm.custom_minimum_size = Vector2(150, 0)
	nm.add_theme_font_size_override("font_size", int(term.look.text_px * 0.78))
	v.add_child(nm)
	var pr: Label = term._label("", term.look.dim)
	pr.add_theme_font_size_override("font_size", int(term.look.text_px * 0.72))
	v.add_child(pr)
	card.set_meta("price", pr)
	card.set_meta("slot", slot)
	card.set_meta("item", it)
	card.set_meta("locked", locked)
	card.gui_input.connect(func(e: InputEvent) -> void:
		if e is InputEventMouseButton and e.pressed and e.button_index == MOUSE_BUTTON_LEFT:
			select(it))
	card.mouse_entered.connect(func() -> void: _hovered(card, true))
	card.mouse_exited.connect(func() -> void: _hovered(card, false))
	_card_text(card)
	_card_style(card)
	return card


func _card_text(card: Control) -> void:
	var it: HSShopItem = card.get_meta("item")
	var pr := card.get_meta("price") as Label
	if card.get_meta("locked"):
		pr.text = "LOCKED"
		return
	var left: int = term.laptop.call("left_of", it)
	var stock := "" if left < 0 else ("  SOLD OUT" if left == 0 else "  %d LEFT" % left)
	pr.text = term.money(it.price) + stock + ("  NEW" if term.laptop.call("is_new", it) else "")
	pr.add_theme_color_override("font_color", term.look.hot if term.laptop.call("is_new", it) else term.look.dim)


func _card_style(card: Control) -> void:
	var it: HSShopItem = card.get_meta("item")
	var on := it == picked
	var over := card == _hover
	var lk: HSTerminalLook = term.look
	card.add_theme_stylebox_override("panel", term.box(lk.faint if (on or over) else Color(0, 0, 0, 0), lk.hot if on else (lk.ink if over else lk.dim), 2, 6))


func _hovered(card: Control, on: bool) -> void:
	_hover = card if on else (null if _hover == card else _hover)
	var slot: Control = card.get_meta("slot")
	if slot.has_meta("viewport"):                      # the one under the pointer turns
		(slot.get_meta("viewport") as SubViewport).render_target_update_mode = SubViewport.UPDATE_ALWAYS if on else SubViewport.UPDATE_ONCE
	if on:
		term.laptop.call("sound", "tick")
	_card_style(card)


## a thing's own model in a slot, in the terminal's green (or its own colours: the look's models_in_ink off)
func slot_of(it: HSShopItem, px: Vector2i, live: bool) -> TextureRect:
	var model: Node3D = HSModelSlot.of_scene(it.model) if it.model != null else null
	if model == null:
		var mi := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(0.2, 0.2, 0.2)
		mi.mesh = bm
		model = mi
	var f := HSModelSlot.make(model, px, live, it.model_turn)
	f.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if term.look.models_in_ink:
		var m := ShaderMaterial.new()
		m.shader = PHOSPHOR
		m.set_shader_parameter("ink", term.look.ink)
		m.set_shader_parameter("hot", term.look.hot)
		m.set_shader_parameter("paper", term.look.paper)
		m.set_shader_parameter("rows", float(px.y) * 0.5)
		f.material = m
	return f


## a locked thing's slot: a ? where its model would be
func mystery(px: Vector2i) -> Control:
	var c := CenterContainer.new()
	c.name = "Mystery"
	c.custom_minimum_size = Vector2(px)
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var q: Label = term._label("?", term.look.dim)
	q.add_theme_font_size_override("font_size", int(px.y * 0.8))
	q.mouse_filter = Control.MOUSE_FILTER_IGNORE
	c.add_child(q)
	return c


## the thing picked: its card lit, its model large and turning, its words typed out (a locked one: its ?, what it
## takes to unlock it)
func select(it: HSShopItem, sound := true) -> void:
	picked = it
	qty = 1
	var locked := not bool(term.laptop.call("unlocked", it))
	for id in cards:
		_card_style(cards[id])
	if _slot != null:
		_slot.queue_free()
	_slot = mystery(Vector2i(320, 160)) if locked else slot_of(it, Vector2i(320, 160), true)
	_slot.name = "PickedModel"
	_slot_box.add_child(_slot)
	_title.text = "???" if locked else it.name_of().to_upper()
	_about_text = ((it.locked_text if it.locked_text != "" else "LOCKED.") if locked else it.about)
	_about_t = 0.0
	_about.text = ""
	_note.text = ""
	if sound:
		term.laptop.call("sound", "error" if locked else "blip")
		if not locked:
			term.laptop.get("seen")[it.id] = true       # picked: not NEW any more
			if cards.has(it.id):
				_card_text(cards[it.id])
	_update()


func _step(d: int) -> void:
	qty += d
	term.laptop.call("sound", "tick")
	_update()


## how many, the total, ORDER: by what's left, the cash, and whether it's unlocked
func _update() -> void:
	if picked == null:
		_buy.disabled = true
		_price.text = ""
		_left.text = ""
		_total.text = ""
		return
	if not term.laptop.call("unlocked", picked):
		_price.text = "PRICE ???"
		_left.text = "LOCKED"
		_qty.text = "-"
		_total.text = ""
		_buy.disabled = true
		_buy.text = "  LOCKED  "
		return
	var left: int = term.laptop.call("left_of", picked)
	var most := picked.max_per_order if left < 0 else mini(picked.max_per_order, left)
	qty = clampi(qty, 1, maxi(most, 1))
	var total := picked.price * qty
	var cash: float = term.laptop.call("cash_now")
	_price.text = "PRICE  %s%s" % [term.money(picked.price), ("   (%d IN EACH)" % picked.count) if picked.count > 1 else ""]
	_left.text = "IN STOCK" if left < 0 else ("SOLD OUT" if left == 0 else "%d LEFT" % left)
	_qty.text = str(qty)
	_total.text = "TOTAL " + term.money(total)
	_total.add_theme_color_override("font_color", term.look.ink if cash + 0.0001 >= total else term.look.dim)
	_buy.disabled = left == 0
	_buy.text = "  SOLD OUT  " if left == 0 else "  ORDER  "


func cash_changed(_v: float) -> void:
	_update()


## ORDER: the laptop pays and puts it in the pocket (or sends it), or says why not
func order_now() -> void:
	if picked == null:
		return
	var r: Dictionary = term.laptop.call("place_order", picked, qty)
	if r.get("ok", false):
		var n := int(r["number"])
		var what := picked.name_of().to_upper()
		if str(r.get("where", "pocket")) == "pocket":
			_note.text = "ORDER #%04d PLACED: IN YOUR POCKET." % n
			term.say("ORDER #%04d  %dx %s  %s. IN YOUR POCKET." % [n, qty, what, term.money(float(r["total"]))])
		else:                                          # (the status line one row: the place and when, not the price)
			var eta := float(r.get("eta", 0.0))
			var place := str(r["where"])
			_note.text = "ORDER #%04d PLACED. ON ITS WAY TO %s: %s." % [n, place, "ARRIVING NOW" if eta < 1.0 else "IN " + str(term.laptop.call("eta_text", eta))]
			term.say("ORDER #%04d  %dx %s  TO %s: %s." % [n, qty, what, place, str(term.laptop.call("eta_text", eta))])
	else:
		_note.text = "DECLINED: " + str(r.get("why", ""))
		term.say("DECLINED: " + str(r.get("why", "")))
	for id in cards:
		_card_text(cards[id])
	_update()


func _button(text: String, f: Callable) -> Button:
	var b := Button.new()
	b.text = text
	b.focus_mode = Control.FOCUS_NONE
	b.pressed.connect(f)
	return b


func _unhandled_input(e: InputEvent) -> void:
	if not is_visible_in_tree() or not e is InputEventKey or not (e as InputEventKey).pressed:
		return
	var k := (e as InputEventKey).physical_keycode
	if k in [KEY_LEFT, KEY_PAGEUP] and page > 0:
		show_page(page - 1)
		get_viewport().set_input_as_handled()
	elif k in [KEY_RIGHT, KEY_PAGEDOWN] and page < pages.size() - 1:
		show_page(page + 1)
		get_viewport().set_input_as_handled()


func _process(dt: float) -> void:
	if not is_visible_in_tree():
		return
	if _about.text.length() < _about_text.length():  # its words typed out
		_about_t += dt
		_about.text = _about_text.left(int(_about_t * 90.0))
	if _slot != null and _slot.has_meta("turn"):
		(_slot.get_meta("turn") as Node3D).rotation.y += dt * 0.6
	if _hover != null and is_instance_valid(_hover):
		var s: Control = _hover.get_meta("slot")
		if s.has_meta("turn"):
			(s.get_meta("turn") as Node3D).rotation.y += dt * 0.9
