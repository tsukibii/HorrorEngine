## A light's flicker by mode (tools/shared/flicker.js ported, STORY_FORMAT §2 `light`: `flicker` how much, `mode`
## which: fluorescent, dying, candle, pulse, custom with `letters`; `interval`, `rate`), after Light Kit's Flicker
## component. Drawn from the clock and a seed: the same on every run, and the same as the desk's.
class_name HSFlicker

const MODES := ["fluorescent", "dying", "candle", "pulse", "custom"]
const LETTERS := "mmmmmmmmmmmmmmmmmmmmamammmmmmmmmmmmmmmammmmmmmm"


static func hash2(a: int, b: int) -> float:
	var h: int = (a * 374761393 + b * 668265263) & 0xffffffff
	h = ((h ^ (h >> 13)) * 1274126177) & 0xffffffff
	return float((h ^ (h >> 16)) & 0xffffffff) / 4294967296.0


static func noise1(x: float, seed: int = 0) -> float:
	var i := int(floor(x))
	var f := x - i
	var s := f * f * (3.0 - 2.0 * f)
	return (hash2(i, seed) * (1.0 - s) + hash2(i + 1, seed) * s) * 2.0 - 1.0


static func rnd(u: Dictionary, T: float, n: int) -> float:
	return hash2(int(floor(T * 60.0)) + n * 7919, int(u.get("seed", 1)))


## the settings from the story's light (its `d`), kept on the light's state
static func of(d: Dictionary, id: String) -> Dictionary:
	var mode = d.get("mode") if MODES.has(d.get("mode")) else null
	var seed := 1
	for ch in id.to_utf8_buffer():
		seed = (seed * 31 + int(ch)) & 0xffffffff
	var rate: float = float(d.get("rate", 0))
	if rate <= 0.0:
		rate = 0.5 if mode == "pulse" else (10.0 if mode == "custom" else 1.0)
	var letters: String = str(d.get("letters", "")).to_lower()
	return {"flicker": float(d["flicker"]) if d.has("flicker") else (1.0 if mode != null else 0.0), "mode": mode,
		"interval": float(d.get("interval", 0)) if float(d.get("interval", 0)) > 0 else 6.0, "rate": rate,
		"letters": letters if letters != "" else LETTERS, "seed": seed if seed != 0 else 1}


## the tube switched on: a moment of the starter clicking (fluorescent and dying only)
static func on(u: Dictionary, T: float) -> void:
	if u.get("mode") == "fluorescent" or u.get("mode") == "dying":
		u["fl_start"] = T + 0.4 + 0.8 * rnd(u, T, 3)


## the multiplier on the light's energy now
static func k(u: Dictionary, T: float) -> float:
	var amount: float = float(u.get("flicker", 0))
	if u.has("fl_start") and T < float(u["fl_start"]):
		return 0.05 if rnd(u, T, 1) < 0.45 else 0.6 + 0.4 * rnd(u, T, 2)
	var mode = u.get("mode")
	if mode == null:
		return (1.0 - amount * 0.5 * max(0.0, sin(T * 13.7) * sin(T * 7.3))) if amount > 0.0 else 1.0
	var M := 1.0
	if mode == "fluorescent" or mode == "dying":
		var dying: bool = mode == "dying"
		var interval: float = float(u.get("interval", 6.0))
		if not u.has("fl_next"):
			u["fl_next"] = (0.3 + 1.7 * rnd(u, T, 4)) * interval
			u["fl_end"] = -1.0
		if T >= float(u["fl_next"]) and float(u["fl_end"]) < T:
			u["fl_end"] = T + ((0.05 + 0.75 * rnd(u, T, 5)) if dying else (0.12 + 0.28 * rnd(u, T, 5)))
			u["fl_next"] = float(u["fl_end"]) + ((0.1 if dying else 0.5) + (1.9 if dying else 1.5) * rnd(u, T, 6)) * interval * (0.3 if dying else 1.0)
		if T < float(u["fl_end"]):
			M = 0.0 if (dying and rnd(u, T, 7) < 0.6) else (0.15 if rnd(u, T, 8) < 0.5 else 1.0)
		elif dying:
			M = 0.75 + 0.1 * noise1(T * 3.0, int(u["seed"]))
	elif mode == "candle":
		M = 1.0 + 0.14 * noise1(T * 7.0, int(u["seed"])) + 0.06 * noise1(T * 23.0 + 5.0, int(u["seed"]) + 1)
	elif mode == "pulse":
		M = 1.0 - 0.5 * (0.5 - 0.5 * cos(TAU * float(u.get("rate", 0.5)) * T))
	elif mode == "custom":
		var s: String = str(u.get("letters", LETTERS))
		if s.length() > 0:
			var ch: int = s.unicode_at(int(floor(T * float(u.get("rate", 10.0)))) % s.length()) - 97
			M = float(clampi(ch, 0, 25)) / 12.0
	return 1.0 + (M - 1.0) * amount
