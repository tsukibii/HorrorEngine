## A noise (the starter's hearing, docs/research/intensity.md §4): what makes one calls Noises.make(tree, where, how
## loud), 0..1 (a step 0.35, a run 1.0, a door 0.5, a gasp 0.9); everything in the group hs_listener hears it through
## its heard(at, loud) (searcher.gd). How far it carries is each listener's own: its hear_m times the loudness.
extends RefCounted

const STEP := 0.35
const RUN := 1.0
const DOOR := 0.5
const GASP := 0.9


static func make(tree: SceneTree, at: Vector3, loud: float) -> void:
	if tree != null:
		tree.call_group("hs_listener", "heard", at, loud)
