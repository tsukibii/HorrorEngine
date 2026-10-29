## The little things' sounds (docs/IMMERSION.md §3; the desk's lifesound.js, ported): no files, each sound made from
## its recipe (noise, filters, tones, little bursts) once, rendered into a short looping wave at 22 kHz (two seconds,
## or the figure's own period) and played placed where its thing is. A state's `sound` plays while the state lasts
## (the kettle's rumble rising, a hob's hum, a clock's tick, a tap running, a phone ringing), its level ramping with
## the state's age as the life says (`level: [from, to]`); its `enter` sounds play once as the state starts (a click,
## a beep, the igniter, the rice cooker's tune). What the desk modulates live (the kettle's low band opening, the
## pour's pitch climbing with the cup) is the player's pitch here. `heard` keeps what started, for the checks.
##   lifesound = LifeSoundC.new(rt); lifesound.update(T) every frame; lifesound.stop()
const RATE := 22050
const LOOPS := ["kettle", "kettle_boil", "whistle", "sing", "hum", "gas", "bubble", "boil", "pour", "crackle", "tick", "ring", "water", "static", "murmur"]
const ONCE := ["click", "switch", "beep", "igniter", "flick", "blow", "pour_once", "tune", "drip"]

var rt
var wavs: Dictionary = {}          # name -> AudioStreamWAV, rendered on first use
var voices: Dictionary = {}        # "id:sound" -> {player, name, def}
var seen: Dictionary = {}          # id -> the history length already heard
var drips: Dictionary = {}         # id -> the last drop's number
var last_T: float = -1.0
var volume: float = 0.8
var heard: Array = []              # [{key, what: "start" | "stop" | "once", T}]
var rng := RandomNumberGenerator.new()
var noise_white: PackedFloat32Array = PackedFloat32Array()
var noise_brown: PackedFloat32Array = PackedFloat32Array()


func _init(rt_) -> void:
	rt = rt_


# ---- the recipes' pieces ------------------------------------------------------------------------------------------
func noise(kind: String) -> PackedFloat32Array:
	if noise_white.is_empty():                   # two seconds of white noise, and brown (integrated) beside it
		var n := RATE * 2
		noise_white.resize(n)
		noise_brown.resize(n)
		var seed := 12345
		var last := 0.0
		for i in n:
			seed = (seed * 1103515245 + 12345) & 0x7fffffff
			var w := float(seed) / float(0x7fffffff) * 2.0 - 1.0
			noise_white[i] = w
			last = (last + 0.02 * w) / 1.02
			noise_brown[i] = last * 3.5
	return noise_brown if kind == "brown" else noise_white


## a stretch of noise, n samples, from a seat in the two seconds (wrapping)
func noise_src(n: int, kind: String = "white", seat: float = -1.0) -> PackedFloat32Array:
	var src := noise(kind)
	var out := PackedFloat32Array()
	out.resize(n)
	var k := int((rng.randf() if seat < 0 else seat) * src.size())
	for i in n:
		out[i] = src[(k + i) % src.size()]
	return out


## an RBJ biquad in place: lowpass, highpass, bandpass, peaking (gain_db)
func biquad(buf: PackedFloat32Array, type: String, f: float, q: float = 0.7, gain_db: float = 0.0) -> PackedFloat32Array:
	var w0: float = TAU * clamp(f, 10.0, RATE * 0.45) / RATE
	var cw := cos(w0)
	var sw := sin(w0)
	var alpha: float = sw / (2.0 * max(q, 0.05))
	var b0 := 0.0
	var b1 := 0.0
	var b2 := 0.0
	var a0 := 1.0
	var a1 := 0.0
	var a2 := 0.0
	match type:
		"lowpass":
			b0 = (1.0 - cw) / 2.0
			b1 = 1.0 - cw
			b2 = (1.0 - cw) / 2.0
			a0 = 1.0 + alpha
			a1 = -2.0 * cw
			a2 = 1.0 - alpha
		"highpass":
			b0 = (1.0 + cw) / 2.0
			b1 = -(1.0 + cw)
			b2 = (1.0 + cw) / 2.0
			a0 = 1.0 + alpha
			a1 = -2.0 * cw
			a2 = 1.0 - alpha
		"bandpass":
			b0 = alpha
			b1 = 0.0
			b2 = -alpha
			a0 = 1.0 + alpha
			a1 = -2.0 * cw
			a2 = 1.0 - alpha
		"peaking":
			var A := pow(10.0, gain_db / 40.0)
			b0 = 1.0 + alpha * A
			b1 = -2.0 * cw
			b2 = 1.0 - alpha * A
			a0 = 1.0 + alpha / A
			a1 = -2.0 * cw
			a2 = 1.0 - alpha / A
	b0 /= a0
	b1 /= a0
	b2 /= a0
	a1 /= a0
	a2 /= a0
	var x1 := 0.0
	var x2 := 0.0
	var y1 := 0.0
	var y2 := 0.0
	for i in buf.size():
		var x := buf[i]
		var y := b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
		x2 = x1
		x1 = x
		y2 = y1
		y1 = y
		buf[i] = y
	return buf


func scale(buf: PackedFloat32Array, g: float) -> PackedFloat32Array:
	for i in buf.size():
		buf[i] *= g
	return buf


## amplitude modulation: buf *= base + depth * sin(2 pi rate t)
func am(buf: PackedFloat32Array, rate: float, base: float, depth: float) -> PackedFloat32Array:
	for i in buf.size():
		buf[i] *= base + depth * sin(TAU * rate * float(i) / RATE)
	return buf


func add(into: PackedFloat32Array, what: PackedFloat32Array, at: float = 0.0, g: float = 1.0) -> void:
	var k := int(at * RATE)
	for i in what.size():
		var j := k + i
		if j >= 0 and j < into.size():
			into[j] += what[i] * g


func silence(secs: float) -> PackedFloat32Array:
	var out := PackedFloat32Array()
	out.resize(int(secs * RATE))
	out.fill(0.0)
	return out


## a tone: sine, square or triangle, with a vibrato (depth Hz at rate Hz)
func tone(secs: float, f: float, type: String = "sine", vib_rate: float = 0.0, vib_depth: float = 0.0) -> PackedFloat32Array:
	var n := int(secs * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var ph := 0.0
	for i in n:
		var fr := f + vib_depth * sin(TAU * vib_rate * float(i) / RATE)
		ph += fr / RATE
		var u := fmod(ph, 1.0)
		match type:
			"square":
				out[i] = 1.0 if u < 0.5 else -1.0
			"triangle":
				out[i] = 4.0 * abs(u - 0.5) - 1.0
			_:
				out[i] = sin(TAU * u)
	return out


## a short tone that slides (a bubble, a plink, a beep): f0 to f1 over dur, an 8 ms attack, a decay to nothing
func blip(into: PackedFloat32Array, t: float, f0: float, f1: float, dur: float, g: float, type: String = "sine") -> void:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var ph := 0.0
	var atk: float = min(0.008, dur / 4.0)
	for i in n:
		var u: float = float(i) / float(max(n - 1, 1))
		var fr: float = f0 * pow(max(20.0, f1) / f0, u)
		ph += fr / RATE
		var uu := fmod(ph, 1.0)
		var v: float = sin(TAU * uu) if type == "sine" else ((1.0 if uu < 0.5 else -1.0) if type == "square" else 4.0 * abs(uu - 0.5) - 1.0)
		var tt := float(i) / RATE
		var env: float = (tt / atk) if tt < atk else pow(0.0001, (tt - atk) / max(dur - atk, 0.001))
		out[i] = v * env * g
	add(into, out, t)


## a short noise (a click, a tick, a breath): filtered, decaying
func burst(into: PackedFloat32Array, t: float, dur: float, f: float, g: float, type: String = "bandpass", q: float = 1.0) -> void:
	var n := int((dur + 0.02) * RATE)
	var out := noise_src(n, "white")
	biquad(out, type, f, q)
	for i in n:
		var tt := float(i) / RATE
		out[i] *= g * pow(0.0001, tt / max(dur, 0.001))
	add(into, out, t)


func wav_of(buf: PackedFloat32Array, loop: bool) -> AudioStreamWAV:
	var w := AudioStreamWAV.new()
	w.format = AudioStreamWAV.FORMAT_16_BITS
	w.mix_rate = RATE
	w.stereo = false
	var bytes := PackedByteArray()
	bytes.resize(buf.size() * 2)
	for i in buf.size():
		var v := int(clamp(buf[i], -1.0, 1.0) * 32767.0)
		bytes.encode_s16(i * 2, v)
	w.data = bytes
	if loop:
		w.loop_mode = AudioStreamWAV.LOOP_FORWARD
		w.loop_begin = 0
		w.loop_end = buf.size()
	return w


# ---- the recipes (lifesound.js's LOOP and ONCE, rendered) ----------------------------------------------------------
func render(name: String) -> AudioStreamWAV:
	if wavs.has(name):
		return wavs[name]
	rng.seed = hash(name)
	var b: PackedFloat32Array
	var loop := true
	match name:
		"kettle":                                  # the rumble as it heats: brown noise, its low band (opening with the level: the pitch)
			b = noise_src(RATE * 2, "brown", 0.1)
			biquad(b, "lowpass", 600, 0.8)
			biquad(b, "peaking", 250, 1.2, 8.0)
			scale(b, 0.5)
		"kettle_boil":                             # the roar at the boil: a bright band, fluttering with bubbles
			b = noise_src(RATE * 2, "white", 0.2)
			biquad(b, "bandpass", 1300, 0.6)
			biquad(b, "lowpass", 3500)
			am(b, 17.0, 0.5, 0.25)
			scale(b, 0.55)
		"whistle":                                 # two pipes beating, a breath under them
			b = tone(2.0, 2050, "sine", 5.5, 18.0)
			add(b, tone(2.0, 2310, "sine", 5.5, 18.0))
			scale(b, 0.09)
			var br := noise_src(RATE * 2, "white", 0.3)
			biquad(br, "bandpass", 2300, 4.0)
			add(b, br, 0.0, 0.09 * 0.15)
		"sing":                                    # a tetsubin's song: a soft breathy hiss, swelling slowly
			b = noise_src(RATE * 2, "white", 0.4)
			biquad(b, "bandpass", 2800, 2.0)
			am(b, 0.5, 0.6, 0.35)
			scale(b, 0.22)
		"hum":                                     # mains hum: 100 Hz and its harmonic
			b = tone(2.0, 100)
			add(b, tone(2.0, 200), 0.0, 0.4)
			scale(b, 0.035)
		"gas":                                     # a gas ring: the hiss and a soft low roar
			b = noise_src(RATE * 2, "white", 0.5)
			biquad(b, "highpass", 1800)
			scale(b, 0.25)
			var lo := noise_src(RATE * 2, "brown", 0.6)
			biquad(lo, "lowpass", 260)
			add(b, lo, 0.0, 0.6)
			scale(b, 0.4)
		"bubble", "boil":                          # simmering: bloops over a low wash; a rolling boil adds the lid's clinks
			b = noise_src(RATE * 2, "brown", 0.7)
			biquad(b, "lowpass", 500)
			scale(b, 0.25)
			var l := 0.5 if name == "bubble" else 1.0
			var t := 0.0
			while t < 2.0:
				t += (0.04 + rng.randf() * 0.4) / (0.3 + l)
				if t < 2.0:
					blip(b, t, 380 + rng.randf() * 500, 160 + rng.randf() * 120, 0.05 + rng.randf() * 0.05, 0.18 * l)
			if name == "boil":
				t = 0.0
				while t < 2.0:
					t += 0.15 + rng.randf() * 0.5
					if t < 2.0:
						blip(b, t, 3200 + rng.randf() * 900, 2800, 0.04, 0.05, "triangle")
		"pour":                                    # pouring: a band of noise (its pitch climbs with the cup: the player's pitch)
			b = noise_src(RATE * 2, "white", 0.8)
			biquad(b, "bandpass", 800, 3.0)
			am(b, 11.0, 0.7, 0.3)
			scale(b, 0.5)
		"crackle":                                 # paper burning: tiny clicks
			b = silence(2.0)
			var t := 0.0
			while t < 2.0:
				t += 0.05 + rng.randf() * 0.6
				if t < 2.0:
					burst(b, t, 0.006, 4000, 0.4, "highpass")
		"tick":                                    # a clock: tick, tock, every second
			b = silence(2.0)
			burst(b, 0.0, 0.014, 3000, 1.4, "bandpass", 6.0)
			burst(b, 1.0, 0.014, 2400, 1.4, "bandpass", 6.0)
		"ring":                                    # a phone: a marimba figure, a pause, again; the buzz under it
			b = silence(2.2)
			var notes := [659.3, 784.0, 987.8, 1318.5, 987.8, 784.0]
			for i in notes.size():
				var f: float = notes[i]
				blip(b, i * 0.13, f, f * 0.995, 0.22, 0.12)
				blip(b, i * 0.13, f * 4.0, f * 4.0, 0.05, 0.02)
			var buzz := tone(0.9, 160, "square")
			biquad(buzz, "lowpass", 400)
			add(b, buzz, 0.0, 0.025)
		"water":                                   # a tap running into a sink
			b = noise_src(RATE * 2, "white", 0.9)
			biquad(b, "bandpass", 1500, 0.5)
			biquad(b, "lowpass", 5000)
			am(b, 7.0, 0.8, 0.15)
			scale(b, 0.45)
		"static":                                  # a TV's snow: hiss
			b = noise_src(RATE * 2, "white", 0.15)
			biquad(b, "highpass", 900)
			scale(b, 0.16)
		"murmur":                                  # a programme from across the room: voices you can't make out
			b = noise_src(RATE * 2, "white", 0.25)
			biquad(b, "bandpass", 420, 1.5)
			biquad(b, "peaking", 1100, 2.0, 5.0)
			var t := 0.0
			var i0 := 0
			while t < 2.0:
				var d := 0.1 + rng.randf() * 0.25
				var g: float = 0.0 if rng.randf() < 0.2 else 0.5 + rng.randf() * 0.5
				var i1: int = min(b.size(), int((t + d) * RATE))
				for i in range(i0, i1):
					b[i] *= g
				i0 = i1
				t += d
			scale(b, 0.4)
		"click":
			loop = false
			b = silence(0.1)
			burst(b, 0.0, 0.008, 3000, 0.7, "highpass")
			blip(b, 0.0, 140, 70, 0.05, 0.3)
		"switch":
			loop = false
			b = silence(0.1)
			burst(b, 0.0, 0.006, 2500, 0.45, "highpass")
			blip(b, 0.01, 120, 80, 0.03, 0.15)
		"beep":
			loop = false
			b = silence(0.2)
			blip(b, 0.0, 2800, 2790, 0.12, 0.12)
		"igniter":
			loop = false
			b = silence(1.2)
			for i in 6:
				burst(b, i * 0.12, 0.01, 3500, 0.5, "highpass")
			burst(b, 0.75, 0.35, 300, 0.4, "lowpass")
		"flick":
			loop = false
			b = silence(0.3)
			burst(b, 0.0, 0.01, 3200, 0.6, "highpass")
			burst(b, 0.02, 0.18, 900, 0.25, "bandpass", 0.8)
		"blow":
			loop = false
			b = silence(0.45)
			burst(b, 0.0, 0.35, 650, 0.5, "bandpass", 0.7)
		"pour_once":
			loop = false
			b = silence(1.3)
			burst(b, 0.0, 1.2, 800, 0.3, "bandpass", 2.0)
		"tune":                                    # the rice cooker's little done tune (ours: up and back down)
			loop = false
			b = silence(1.4)
			for pair in [[784.0, 0.0], [988.0, 0.18], [1175.0, 0.36], [1568.0, 0.54], [1175.0, 0.8], [1568.0, 0.98]]:
				blip(b, pair[1], pair[0], pair[0], 0.24, 0.09, "square")
		"drip":                                    # a drop landing: a plink
			loop = false
			b = silence(0.15)
			blip(b, 0.0, 1900, 850, 0.09, 0.22)
		_:
			return null
	wavs[name] = wav_of(b, loop)
	return wavs[name]


# ---- playing them where the things are ----------------------------------------------------------------------------
static func lvl(v, age: float, secs) -> float:
	if v is Array and v.size() >= 2:
		var u: float = clamp(age / float(secs), 0.0, 1.0) if (secs != null and float(secs) > 0) else 0.0
		return float(v[0]) + (float(v[1]) - float(v[0])) * u
	return float(v) if (v is float or v is int) else 1.0


func player_at(pos: Vector3) -> AudioStreamPlayer3D:
	var p := AudioStreamPlayer3D.new()
	p.unit_size = 0.7
	p.max_distance = 24.0
	p.attenuation_model = AudioStreamPlayer3D.ATTENUATION_INVERSE_DISTANCE
	if AudioServer.get_bus_index("SFX") >= 0:
		p.bus = "SFX"
	rt.game.world.add_child(p)
	p.global_position = pos
	return p


func once(id: String, name: String, pos: Vector3, T: float) -> void:
	var w := render("pour_once" if name == "pour" else name)
	if w == null:
		return
	var p := player_at(pos)
	p.stream = w
	p.volume_db = linear_to_db(volume)
	p.finished.connect(p.queue_free)
	p.play()
	heard.append({"key": id + ":" + name, "what": "once", "T": T})
	if heard.size() > 300:
		heard.pop_front()


## every frame: the loops of the states the things are in, their levels; the enter sounds of the states just entered
func update(T: float) -> void:
	if rt.lifefx == null:
		return
	var back: bool = last_T >= 0 and T < last_T - 0.25
	last_T = T
	var want := {}
	for id in rt.lifefx.items:
		var it: Dictionary = rt.lifefx.items[id]
		var st = rt.lives.at(id, T)
		if st == null or st["def"] == null:
			continue
		var pos: Vector3 = it["node"].global_position
		for s in st["def"].get("sound", []):
			var name := str(s.get("sound"))
			if name == "drip":                        # a drop every so often: the plink when it lands (the desk's drop)
				var every: float = float(s.get("every", 2.6))
				var n := int(floor((T - 1.05) / every)) + 1
				if n >= 1 and drips.get(id, -1) != n and n * every + 1.05 - T < 0.15:
					drips[id] = n
					once(id, "drip", pos, T)
				continue
			if not LOOPS.has(name):
				continue
			var key: String = str(id) + ":" + name
			want[key] = true
			var v = voices.get(key)
			if v == null:
				var w := render(name)
				if w == null:
					continue
				var p := player_at(pos)
				p.stream = w
				p.play()
				v = {"player": p, "name": name}
				voices[key] = v
				heard.append({"key": key, "what": "start", "T": T})
				if heard.size() > 300:
					heard.pop_front()
			var p: AudioStreamPlayer3D = v["player"]
			p.global_position = pos
			var l := lvl(s.get("level"), float(st["age"]), s.get("secs", st["secs"]))
			p.volume_db = linear_to_db(max(0.0001, volume * l))
			match name:
				"kettle":
					p.pitch_scale = 0.75 + 0.5 * l
				"pour":
					p.pitch_scale = (480.0 + 1100.0 * float(st["p"])) / 800.0
				"whistle":
					p.pitch_scale = 1.0 + 0.1 * min(1.0, float(st["age"]) / 6.0)
		# what started since the last frame: its `enter` sounds, once (not when the playhead goes back)
		var hist: Array = rt.lives.history(id)
		var n0: int = int(seen.get(id, hist.size()))
		if not back:
			for h in hist.slice(n0):
				if T - float(h["t"]) < 1.0:
					for sd in it["def"].get("states", []):
						if sd.get("id") == h["state"]:
							for e in sd.get("enter", []):
								if ONCE.has(str(e.get("sound"))) or str(e.get("sound")) == "pour":
									once(id, str(e.get("sound")), pos, T)
		seen[id] = hist.size()
	for key in voices.keys():
		if not want.has(key):
			var v: Dictionary = voices[key]
			if is_instance_valid(v["player"]):
				v["player"].queue_free()
			voices.erase(key)
			heard.append({"key": key, "what": "stop", "T": T})


func stop() -> void:
	for key in voices:
		if is_instance_valid(voices[key]["player"]):
			voices[key]["player"].queue_free()
	voices = {}
	seen = {}
	drips = {}
	last_T = -1.0


## for the checks: the sounds playing now, by key
func playing() -> Array:
	return voices.keys()
