extends Control
## The code's rain (HSTerminal's): columns of glyphs falling, each column's head the brightest and its tail fading,
## glyphs changing now and then. `amount` 0 hides it; drawn a dozen times a second (a terminal's steps), only while seen.

var font: Font
var px := 22                                        # a glyph's size
var amount := 0.2
var ink := Color(0.25, 1.0, 0.45)
var hot := Color(0.8, 1.0, 0.84)
var glyphs := "0123456789ABCDEF"
var _cols: Array = []                               # {head, speed, len, chars}
var _rows := 0
var _cw := 12.0
var _ch := 20.0
var _acc := 0.0
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_rng.seed = 7
	resized.connect(_layout)
	_layout()


func _layout() -> void:
	if font == null:
		return
	_cw = font.get_char_size("0".unicode_at(0), px).x + 2.0
	_ch = px * 0.95
	var n := int(size.x / _cw) + 1
	_rows = int(size.y / _ch) + 2
	_cols = []
	for i in n:
		_cols.append(_new_col(true))


func _new_col(scatter: bool) -> Dictionary:
	var chars := PackedStringArray()
	for r in _rows:
		chars.append(glyphs[_rng.randi() % glyphs.length()])
	return {"head": _rng.randf_range(-_rows, _rows) if scatter else _rng.randf_range(-_rows * 0.6, 0.0),
			"speed": _rng.randf_range(5.0, 15.0), "len": _rng.randi_range(6, 22), "chars": chars}


func _process(dt: float) -> void:
	if amount <= 0.001 or not is_visible_in_tree() or _cols.is_empty():
		return
	for c in _cols:
		c["head"] += c["speed"] * dt
		if c["head"] - c["len"] > _rows:
			var n := _new_col(false)
			c.merge(n, true)
		if _rng.randf() < dt * 3.0:                   # a glyph changes its mind
			var ch: PackedStringArray = c["chars"]
			ch[_rng.randi() % ch.size()] = glyphs[_rng.randi() % glyphs.length()]
			c["chars"] = ch
	_acc += dt
	if _acc >= 1.0 / 12.0:
		_acc = 0.0
		queue_redraw()


func _draw() -> void:
	if amount <= 0.001 or font == null:
		return
	for i in _cols.size():
		var c: Dictionary = _cols[i]
		var head := int(c["head"])
		var ln: int = c["len"]
		var ch: PackedStringArray = c["chars"]
		for k in ln:
			var r := head - k
			if r < 0 or r >= _rows:
				continue
			var t := 1.0 - float(k) / ln
			var col := hot if k == 0 else ink
			col.a = amount * (1.0 if k == 0 else t * t * 0.8)
			draw_string(font, Vector2(i * _cw, r * _ch + _ch), ch[r % ch.size()], HORIZONTAL_ALIGNMENT_LEFT, -1, px, col)
