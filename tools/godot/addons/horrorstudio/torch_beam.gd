## The flashlight's battery and its beam (docs/FLASHLIGHT_PLAN.md §1, DECISIONS 2026-11-07): tools/shared/torchbeam.js
## ported, the same numbers. An item's `torch` with a `battery` (the seconds of light from full) drains while it's on;
## its `kind` gives the beam from the charge: a `bulb` (the default) dimmer and warmer from the start and browning out
## under its `low`; an `led` full and white to `low`, three blinks, a low mode of 35 %, a slow strobe near empty. Its
## reach is the range × √b. Hashed on the clock as flicker.gd is, so the desk and Godot draw the same beam.
extends RefCounted

const KINDS := {"bulb": {"kelvin": 3200.0, "low": 0.2}, "led": {"kelvin": 6000.0, "low": 0.15}}
const WARM := 2100.0
const DEAD_AT := 0.03
const REST_SECS := 30.0
const REST_GAIN := 0.03
const RESTS := 2
const CHANGE_SECS := 2.0


static func hash2(a: int, b: int) -> float:
	var h: int = (a * 374761393 + b * 668265263) & 0xffffffff
	h = ((h ^ (h >> 13)) * 1274126177) & 0xffffffff
	return float((h ^ (h >> 16)) & 0xffffffff) / 4294967296.0


## an item's torch settings with the battery's own: kind, battery (s, 0: it never runs down), low, rest, charge, kelvin
static func battery_of(t) -> Dictionary:
	var o: Dictionary = t if t is Dictionary else {}
	var kind: String = str(o.get("kind", "bulb")) if KINDS.has(str(o.get("kind", "bulb"))) else "bulb"
	var bat: float = float(o.get("battery", 0)) if (o.get("battery") is float or o.get("battery") is int) else 0.0
	return {"kind": kind, "battery": maxf(0.0, bat),
		"low": clampf(float(o["low"]), 0.0, 1.0) if o.has("low") else float(KINDS[kind]["low"]),
		"rest": o.get("rest") is bool and o["rest"] == true and kind == "bulb",
		"charge": clampf(float(o["charge"]), 0.0, 1.0) if o.has("charge") else 1.0,
		"kelvin": float(o["kelvin"]) if o.has("kelvin") else (float(KINDS[kind]["kelvin"]) if bat > 0.0 else 0.0)}


## the beam now: {b: its brightness 0..1, kelvin (0: the torch's own), reach: × its range}; st has kind, charge, low,
## low_at (the clock when it ran under low, or null), kelvin (its colour full)
static func beam(st: Dictionary, T: float) -> Dictionary:
	var c: float = maxf(0.0, float(st["charge"]))
	var low: float = float(st["low"])
	var b := 1.0
	var kelvin: float = float(st.get("kelvin", 0.0))
	if str(st["kind"]) == "led":
		var t: float = (T - float(st["low_at"])) if st.get("low_at") != null else -1.0
		if c >= low:
			b = 1.0
		elif c < 0.05:
			b = 0.35 if fposmod(T, 0.55) < 0.4 else 0.0                     # a slow strobe
		elif t >= 0.0 and t < 0.6:
			b = 0.0 if fmod(t, 0.2) < 0.08 else 1.0                          # three blinks
		else:
			b = 0.35                                                         # its low mode
	else:
		b = sqrt(c)
		if kelvin > 0.0:
			kelvin = kelvin - (kelvin - WARM) * (1.0 - c) * (1.0 - c)
		if c < low and c > 0.0:                                              # brownouts, closer as it empties
			var g: float = 0.4 + (3.0 - 0.4) * clampf((c - DEAD_AT) / maxf(1e-6, low - DEAD_AT), 0.0, 1.0)
			var i: int = int(floor(T / g))
			var at: float = i * g + hash2(i, 4091) * g * 0.6
			var ln: float = 0.06 + 0.14 * hash2(i, 4093)
			if T >= at and T < at + ln:
				b *= 0.4
	return {"b": b, "kelvin": kelvin, "reach": sqrt(maxf(0.0, b))}
