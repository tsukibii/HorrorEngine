extends Control
## The Order tab (HSTerminal's; the user, 2026-11-10: "a order tab, a player can order items with cash they have"): the
## catalog's things as cards in a grid under their headings, each its own model in the terminal's green (HSModelSlot,
## the HUD's own slot: the things themselves, not pictures), its name, its price and how many are left; the one picked
## large on the right, turning, its words typed out, how many (- +), the total and ORDER. The order is the laptop's
## (paid from the cash, into the pocket); too dear or sold out, it says so.

const PHOSPHOR := preload("res://addons/horrorstudio_devices/terminal/phosphor.gdshader")

var term: Node
var items: Array = []                               # the catalog's HSShopItems
var picked: HSShopItem = null
var qty := 1
var cards := {}                                     # id -> its card
var _list: VBoxContainer
var _store: Label
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
	var sc := ScrollContainer.new()
	sc.name = "Scroll"
	sc.size_flags_vertical = Control.SIZE_EXPAND_FILL
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	left.add_child(sc)
	_list = VBoxContainer.new()
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_list.add_theme_constant_override("separation", 8)
	sc.add_child(_list)
	var right := PanelContainer.new()
	right.name = "Picked"
	right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	h.add_child(right)
	var rv := VBoxContainer.new()
	rv.add_theme_constant_override("separation", 4)
	right.add_child(rv)
	_slot_box = CenterContainer.new()
	_slot_box.custom_minimum_size = Vector2(0, 168)
	rv.add_child(_slot_box)
	_title = term._label("", term.look.hot)
	_title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	rv.add_child(_title)
	_about = term._label("", term.look.ink)
	_about.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_about.custom_minimum_size = Vector2(0, 70)
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
	_note.add_theme_font_size_override("font_size", int(term.look.text_px * 0.75))
	rv.add_child(_note)


## the cards again from the catalog (a thing added, its stock changed)
func refresh() -> void:
	items = term.laptop.call("items")
	for c in _list.get_children():
		_list.remove_child(c)
		c.queue_free()
	cards = {}
	_store.text = "%s  //  %d ITEMS" % [str(term.laptop.call("store_name")), items.size()]
	var heading := "\u0001"
	var grid: GridContainer = null
	for it: HSShopItem in items:
		if it.category != heading or grid == null:
			heading = it.category
			if heading != "":
				var hl: Label = term._label("== %s ==" % heading.to_upper(), term.look.dim)
				_list.add_child(hl)
			grid = GridContainer.new()
			grid.columns = 3
			grid.add_theme_constant_override("h_separation", 8)
			grid.add_theme_constant_override("v_separation", 8)
			_list.add_child(grid)
		var c := _card(it)
		grid.add_child(c)
		cards[it.id] = c
	if items.is_empty():
		_list.add_child(term._label("NOTHING FOR SALE.", term.look.dim))
	if picked == null or not items.has(picked):
		picked = null
		if not items.is_empty():
			select(items[0], false)
	else:
		select(picked, false)


func _card(it: HSShopItem) -> Control:
	var card := PanelContainer.new()
	card.name = "Card_" + it.id
	card.custom_minimum_size = Vector2(176, 0)
	card.mouse_filter = Control.MOUSE_FILTER_STOP
	var v := VBoxContainer.new()
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_theme_constant_override("separation", 0)
	card.add_child(v)
	var slot := slot_of(it, Vector2i(160, 100), false)
	v.add_child(slot)
	var nm: Label = term._label(it.name_of().to_upper(), term.look.ink)
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
	var left: int = term.laptop.call("left_of", it)
	var stock := "" if left < 0 else ("  SOLD OUT" if left == 0 else "  %d LEFT" % left)
	(card.get_meta("price") as Label).text = term.money(it.price) + stock


func _card_style(card: Control) -> void:
	var it: HSShopItem = card.get_meta("item")
	var on := it == picked
	var over := card == _hover
	var lk: HSTerminalLook = term.look
	card.add_theme_stylebox_override("panel", term.box(lk.faint if (on or over) else Color(0, 0, 0, 0), lk.hot if on else (lk.ink if over else lk.dim), 2, 6))


func _hovered(card: Control, on: bool) -> void:
	_hover = card if on else (null if _hover == card else _hover)
	var slot: TextureRect = card.get_meta("slot")
	var vp := slot.get_meta("viewport") as SubViewport
	if vp != null:                                     # the one under the pointer turns
		vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS if on else SubViewport.UPDATE_ONCE
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


## the thing picked: its card lit, its model large and turning, its words typed out
func select(it: HSShopItem, sound := true) -> void:
	picked = it
	qty = 1
	for id in cards:
		_card_style(cards[id])
	if _slot != null:
		_slot.queue_free()
	_slot = slot_of(it, Vector2i(320, 160), true)
	_slot.name = "PickedModel"
	_slot_box.add_child(_slot)
	_title.text = it.name_of().to_upper()
	_about_text = it.about
	_about_t = 0.0
	_about.text = ""
	_note.text = ""
	if sound:
		term.laptop.call("sound", "blip")
	_update()


func _step(d: int) -> void:
	qty += d
	term.laptop.call("sound", "tick")
	_update()


## how many, the total, ORDER: by what's left and the cash
func _update() -> void:
	if picked == null:
		_buy.disabled = true
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


## ORDER: the laptop pays and puts it in the pocket, or says why not
func order_now() -> void:
	if picked == null:
		return
	var r: Dictionary = term.laptop.call("place_order", picked, qty)
	if r.get("ok", false):
		_note.text = "ORDER #%04d PLACED: IN YOUR POCKET." % int(r["number"])
		term.say("ORDER #%04d  %dx %s  %s. IN YOUR POCKET." % [int(r["number"]), qty, picked.name_of().to_upper(), term.money(float(r["total"]))])
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


func _process(dt: float) -> void:
	if not is_visible_in_tree():
		return
	if _about.text.length() < _about_text.length():  # its words typed out
		_about_t += dt
		_about.text = _about_text.left(int(_about_t * 90.0))
	if _slot != null:
		(_slot.get_meta("turn") as Node3D).rotation.y += dt * 0.6
	if _hover != null and is_instance_valid(_hover):
		var s: TextureRect = _hover.get_meta("slot")
		(s.get_meta("turn") as Node3D).rotation.y += dt * 0.9
