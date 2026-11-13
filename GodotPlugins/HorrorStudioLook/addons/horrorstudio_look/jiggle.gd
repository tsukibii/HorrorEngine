## Jiggle for the chains a Character Studio export carries (docs/GODOT_LOOK.md §5n, DECISIONS 2026-11-10, night: animal
## ears "so they flop when the character moves"). Every animal ear in an export is skinned to a chain of bones of its
## own under the head: `jiggle_<name>_0`, `_1`... and `jiggle_<name>_tip` (no skin: where the last one ends; the
## Studio's exportRig). A plain viewer shows them still. HSJiggle puts Godot's own SpringBoneSimulator3D on the
## skeleton, a setting a chain: the ear swings from its root as the head moves and settles back, a long or a hanging ear
## more than a short pricked one (the export's `soft` for the chain, in its mesh's extras; else by the chain's length).
## `HSJiggle.attach(node)` adds one under a character whose skeleton has such chains (HSEye.wear and HSCharacterLook
## do, so every Studio export that wears its look jiggles); dropped under any character by hand it springs every chain
## of bones named so (`prefix`), a tail or a strand of hair as well as an ear.
##
## And her soft tissue (docs/ANIMATOR_V2.md §7, GODOT_LOOK §5w, DECISIONS 2026-11-13, the hands and the jiggle): a
## character baked by the Animator has bones its flesh hangs from (`soft_bust_l`, `soft_belly`...). HSJiggle puts an
## HSSoftJiggle (soft_jiggle.gd) on a skeleton that has them, which swings each one live as JiggleBones swings a
## bone, by the numbers in her bake's record: so she jiggles when the game stops her, turns her or plays a clip of
## your own, not only as her clips were baked. `soft` off leaves them to her clips.
class_name HSJiggle
extends Node

@export var target: Node3D = null                  ## the character; empty: the parent
@export_range(0.0, 2.0) var amount: float = 1.0    ## how lively as a whole: 0 holds them still, 1 as made, 2 very floppy
@export_range(0.0, 1.0) var gravity: float = 0.12  ## how much they hang (times each chain's softness; an ear is made in the shape it hangs in: a little is enough)
@export var prefix: String = "jiggle_"             ## a chain is the bones <prefix><name>_0 ... <prefix><name>_tip
@export var soft := true                           ## her soft tissue too (the Animator's soft_ bones), swung live; off: only what her clips carry
@export var soft_prefix: String = "soft_"          ## the Animator's soft bones are named so
var springs: Array = []                            # the SpringBoneSimulator3D made, one a skeleton
var softs: Array = []                              # the HSSoftJiggle made, one a skeleton that has soft bones
const NAME := "HSJiggleSprings"
const SOFT_NAME := "HSSoftJiggle"


func character() -> Node3D:
	return target if target != null else get_parent() as Node3D


## the jiggler under a node, or null
static func of(node: Node) -> HSJiggle:
	for c in node.get_children():
		if c is HSJiggle:
			return c
	return null


## a jiggler under node when a skeleton under it has chains (or the one already there); null when none has
static func attach(node: Node, settings: Dictionary = {}) -> HSJiggle:
	var j := of(node)
	if j != null:
		return j
	j = HSJiggle.new()
	j.name = "HSJiggle"
	for k in settings:
		j.set(k, settings[k])
	var any := false
	var skels: Array = node.find_children("*", "Skeleton3D", true, false)
	if node is Skeleton3D:
		skels.append(node)
	for item in skels:
		if not chains_of(item as Skeleton3D, j.prefix).is_empty() or (j.soft and not soft_bones_of(item as Skeleton3D, j.soft_prefix).is_empty()):
			any = true
	if not any:
		j.free()
		return null
	node.add_child(j)                              # (its _ready springs them)
	return j


## a skeleton's soft bones (the Animator's): their names
static func soft_bones_of(sk: Skeleton3D, pre: String = "soft_") -> Array:
	var out := []
	for b in sk.get_bone_count():
		if sk.get_bone_name(b).begins_with(pre) and sk.get_bone_parent(b) >= 0:
			out.append(sk.get_bone_name(b))
	return out


## the Animator's record a baked character carries on its skin's node (hsMotion: its soft bones' numbers among it), or {}
static func record_of(node: Node) -> Dictionary:
	for mi in node.find_children("*", "MeshInstance3D", true, false):
		if not mi.has_meta("extras"):
			continue
		var ex = mi.get_meta("extras")
		if ex is Dictionary and ex.get("hsMotion") is Dictionary:
			return ex["hsMotion"]
	return {}


## a skeleton's chains: [{name, root, tip, bones: [names, the tip last], length}], each from <prefix><name>_0 down its
## first children to <prefix><name>_tip (or, without one, to the last bone of the run)
static func chains_of(sk: Skeleton3D, pre: String = "jiggle_") -> Array:
	var out := []
	for b in sk.get_bone_count():
		var nm := sk.get_bone_name(b)
		if not (nm.begins_with(pre) and nm.ends_with("_0")):
			continue
		var base := nm.substr(0, nm.length() - 2)
		var names := [nm]
		var at := b
		var length := 0.0
		while true:
			var next := -1
			for c in sk.get_bone_children(at):
				if sk.get_bone_name(c).begins_with(base + "_"):
					next = c
					break
			if next < 0:
				break
			length += sk.get_bone_rest(next).origin.length()
			names.append(sk.get_bone_name(next))
			at = next
		if names.size() >= 2:
			out.append({"name": base.substr(pre.length()), "root": nm, "tip": names[-1], "bones": names, "length": length})
	return out


## each chain's softness as the export gives it (a mesh's extras: {jiggle: {chain, soft}}), by the chain's first bones' name
static func softness(node: Node) -> Dictionary:
	var out := {}
	for mi in node.find_children("*", "MeshInstance3D", true, false):
		if not mi.has_meta("extras"):                 # (get_meta with a null default complains when there's none)
			continue
		var ex = mi.get_meta("extras")
		if ex is Dictionary and ex.get("jiggle") is Dictionary and ex["jiggle"].has("chain"):
			out[String(ex["jiggle"]["chain"])] = float(ex["jiggle"].get("soft", 0.5))
	return out


func _ready() -> void:
	if not Engine.is_editor_hint():
		wear.call_deferred()


## the springs on every skeleton under the character (made again: what was there goes)
func wear() -> void:
	for s in springs + softs:
		if is_instance_valid(s):
			s.queue_free()
	springs.clear()
	softs.clear()
	var t := character()
	if t == null:
		return
	var soft_of := softness(t)
	var skels: Array = t.find_children("*", "Skeleton3D", true, false)
	if t is Skeleton3D:
		skels.append(t)
	var rec := record_of(t)
	for item in skels:
		var sk := item as Skeleton3D
		if soft and not soft_bones_of(sk, soft_prefix).is_empty():   # her soft tissue: one modifier a skeleton, each bone by her bake's numbers
			var was: Node = sk.get_node_or_null(SOFT_NAME)
			if was != null:
				sk.remove_child(was)
				was.queue_free()
			var sj := HSSoftJiggle.new()
			sj.name = SOFT_NAME
			sj.prefix = soft_prefix
			sj.amount = amount
			sk.add_child(sj)
			sj.setup(rec)
			softs.append(sj)
		var chains := chains_of(sk, prefix)
		if chains.is_empty():
			continue
		var old: Node = sk.get_node_or_null(NAME)
		if old != null:
			sk.remove_child(old)
			old.queue_free()
		var sim := SpringBoneSimulator3D.new()
		sim.name = NAME
		sk.add_child(sim)
		sim.setting_count = chains.size()
		for i in chains.size():
			var c: Dictionary = chains[i]
			# how floppy: the export's word for the chain, else from its length (a 4 cm ear stiff, a 12 cm one soft)
			var s: float = soft_of.get(prefix + c["name"], clampf(c["length"] / 0.13, 0.2, 1.0))
			sim.set_root_bone_name(i, c["root"])
			sim.set_end_bone_name(i, c["tip"])
			sim.set_stiffness(i, lerpf(4.0, 1.2, s) / maxf(0.15, amount))    # (stiff enough that an upright ear stands as it was made, soft enough that a hanging one swings)
			sim.set_drag(i, lerpf(0.5, 0.3, s))
			sim.set_gravity(i, gravity * s * amount)
			sim.set_gravity_direction(i, Vector3.DOWN)
			sim.set_radius(i, 0.01)
		sim.active = amount > 0.0
		springs.append(sim)


## how lively, changed while the game runs
func set_amount(v: float) -> void:
	amount = v
	wear()


## back to rest at once (after a teleport: a chain flung across the level settles slowly otherwise)
func reset() -> void:
	for s in springs + softs:
		if is_instance_valid(s):
			s.reset()


func report() -> Dictionary:
	var out := {"springs": springs.size(), "chains": [], "soft": []}
	for s in springs:
		if is_instance_valid(s):
			for i in s.setting_count:
				out["chains"].append({"root": s.get_root_bone_name(i), "tip": s.get_end_bone_name(i), "stiffness": s.get_stiffness(i), "drag": s.get_drag(i), "gravity": s.get_gravity(i)})
	for s in softs:
		if is_instance_valid(s):
			out["soft"].append_array(s.report())
	return out
