## An expression from the studio's library baked for Godot (tools/face_export.mjs; STORY_FORMAT §4 `expr`): the MHR
## face shapes it moves, by Meta's names, frame by frame (`weights`: frames × shapes); a loop runs round (its last frame
## into its first), a capture holds its ends. res://faces/<id>.tres, the loops in res://faces/loops/<id>.tres; played by
## face.gd on a cast member's face.
@tool
class_name HSFaceClip
extends Resource

@export var id := ""
@export var title := ""
@export var loop := false
@export var secs := 0.0
@export var fps := 30.0
@export var frames := 0
@export var shapes := PackedStringArray()
@export var weights := PackedFloat32Array()


## its shapes' weights at t seconds into `out` (one per shape): between frames a straight line, a loop wrapped, a
## capture held at its ends
func at(t: float, out: PackedFloat32Array) -> void:
	var S := shapes.size()
	if out.size() != S:
		out.resize(S)
	if frames <= 0 or S == 0:
		out.fill(0.0)
		return
	var f := t * fps
	var i0: int
	var i1: int
	var u: float
	if loop:
		f = fposmod(f, float(frames))
		i0 = int(floor(f))
		i1 = (i0 + 1) % frames
		u = f - i0
	else:
		f = clamp(f, 0.0, float(frames - 1))
		i0 = int(floor(f))
		i1 = min(i0 + 1, frames - 1)
		u = f - i0
	for j in S:
		out[j] = lerp(weights[i0 * S + j], weights[i1 * S + j], u)
