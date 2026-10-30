## Kimodo's motions as Godot reads them (docs/GODOT_DIRECTOR.md §6b): an .npz is a zip of numpy arrays (.npy); the
## one we want is `posed_joints` [frames, 77, 3] (or [samples, frames, 77, 3]: the first sample), metres, Y up, +Z
## forward, +X the character's left, the joints in Content/Studio/soma77.json's order (setup/kimodo.json). Also writes
## one (the check makes its motions by hand).
@tool
class_name HSNpz
extends RefCounted


## the arrays of an .npz by name: {name: {"shape": [..], "data": PackedFloat32Array}} (float32 or float64 read)
static func read(path: String) -> Dictionary:
	var out := {}
	var z := ZIPReader.new()
	if z.open(path) != OK:
		push_error("HSNpz: can't open %s" % path)
		return out
	for f in z.get_files():
		if not f.ends_with(".npy"):
			continue
		var arr := parse_npy(z.read_file(f))
		if not arr.is_empty():
			out[f.get_file().get_basename()] = arr
	z.close()
	return out


## one .npy's bytes: {shape, data} (little-endian floats; ints read as floats), {} when it isn't one
static func parse_npy(b: PackedByteArray) -> Dictionary:
	if b.size() < 10 or b[0] != 0x93 or b.slice(1, 6).get_string_from_ascii() != "NUMPY":
		return {}
	var major := b[6]
	var hl := 0
	var start := 0
	if major == 1:
		hl = b.decode_u16(8)
		start = 10
	else:
		hl = b.decode_u32(8)
		start = 12
	var header := b.slice(start, start + hl).get_string_from_ascii()
	var descr := _field(header, "descr")
	var shape_s := _field(header, "shape")
	if _field(header, "fortran_order") == "True":
		push_error("HSNpz: a Fortran-ordered array isn't read")
		return {}
	var shape: Array = []
	for p in shape_s.replace("(", "").replace(")", "").split(",", false):
		if p.strip_edges() != "":
			shape.append(int(p.strip_edges()))
	var body := b.slice(start + hl)
	var data := PackedFloat32Array()
	match descr:
		"<f4", "|f4", "f4":
			data = body.to_float32_array()
		"<f8", "|f8", "f8":
			var d64 := body.to_float64_array()
			data.resize(d64.size())
			for i in d64.size():
				data[i] = d64[i]
		"<i4", "|i4":
			var i32 := body.to_int32_array()
			data.resize(i32.size())
			for i in i32.size():
				data[i] = i32[i]
		"|b1", "<b1", "|u1":
			data.resize(body.size())
			for i in body.size():
				data[i] = body[i]
		_:
			push_error("HSNpz: dtype %s isn't read" % descr)
			return {}
	return {"shape": shape, "data": data}


static func _field(header: String, key: String) -> String:
	var i := header.find("'" + key + "'")
	if i < 0:
		return ""
	var j := header.find(":", i) + 1
	var rest := header.substr(j).strip_edges()
	if rest.begins_with("("):
		return rest.substr(0, rest.find(")") + 1)
	if rest.begins_with("'"):
		return rest.substr(1, rest.find("'", 1) - 1)
	var k := rest.find(",")
	return rest.substr(0, k if k >= 0 else rest.length()).strip_edges()


## a motion's joints: frames of PackedVector3Array (77 a frame), from `posed_joints` (the first sample of several)
static func joints(npz: Dictionary, key: String = "posed_joints") -> Array:
	var a: Dictionary = npz.get(key, {})
	if a.is_empty():
		return []
	var shape: Array = a["shape"]
	var d: PackedFloat32Array = a["data"]
	var frames: int = shape[-3]
	var nj: int = shape[-2]
	var out: Array = []
	for f in frames:
		var fr := PackedVector3Array()
		fr.resize(nj)
		for j in nj:
			var o := (f * nj + j) * 3
			fr[j] = Vector3(d[o], d[o + 1], d[o + 2])
		out.append(fr)
	return out


## an .npz with float32 arrays ({name: [shape, PackedFloat32Array]}), as numpy's savez writes them
static func write(path: String, arrays: Dictionary) -> int:
	var z := ZIPPacker.new()
	var e := z.open(path)
	if e != OK:
		return e
	for name in arrays:
		var shape: Array = arrays[name][0]
		var data: PackedFloat32Array = arrays[name][1]
		var sh := "(" + ", ".join(shape.map(func(x): return str(x))) + ("," if shape.size() == 1 else "") + ")"
		var header := "{'descr': '<f4', 'fortran_order': False, 'shape': %s, }" % sh
		while (10 + header.length() + 1) % 64 != 0:
			header += " "
		header += "\n"
		var b := PackedByteArray([0x93])
		b.append_array("NUMPY".to_ascii_buffer())
		b.append_array(PackedByteArray([1, 0]))
		var hl := PackedByteArray()
		hl.resize(2)
		hl.encode_u16(0, header.length())
		b.append_array(hl)
		b.append_array(header.to_ascii_buffer())
		b.append_array(data.to_byte_array())
		z.start_file(name + ".npy")
		z.write_file(b)
		z.close_file()
	z.close()
	return OK
