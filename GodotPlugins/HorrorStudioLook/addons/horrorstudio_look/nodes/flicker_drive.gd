## What drives a flickering light (HSFlickerLight, HSFlickerSpot): HSFlicker's curves (the desk's and Light Kit's) on
## the light's energy. The Energy you set in the inspector is the light at full; the flicker multiplies it each
## frame, and before a save the light is put back at full.
@tool
class_name HSFlickerDrive
extends RefCounted

var u: Dictionary = {}
var base := 1.0
var last := -1.0
var T := 0.0
var key := 0


func setup(light: Light3D, mode: String, amount: float, interval: float, rate: float, letters: String, seed: int) -> void:
	var k := [mode, amount, interval, rate, letters, seed].hash()
	if k == key:
		return
	key = k
	u = HSFlicker.of({"flicker": amount, "mode": null if mode == "wobble" else mode, "interval": interval, "rate": rate, "letters": letters}, str(light.name))
	if seed != 0:
		u["seed"] = seed
	HSFlicker.on(u, T)                                 # a tube's starter clicks as it comes on


func tick(light: Light3D, dt: float, run: bool) -> void:
	if absf(light.light_energy - last) > 0.0001:       # the inspector's Energy changed by hand: that's the full light now
		base = light.light_energy
	T += dt
	var e: float = base * (HSFlicker.k(u, T) if run else 1.0)
	light.light_energy = e
	last = e


func rest(light: Light3D) -> void:
	if last >= 0.0:
		light.light_energy = base
		last = base


## switched on again (the power back): the starter clicks
func restart() -> void:
	HSFlicker.on(u, T)
