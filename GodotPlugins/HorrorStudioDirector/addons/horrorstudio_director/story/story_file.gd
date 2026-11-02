@tool
class_name HSStoryFile
extends RefCounted
## The Director file (docs/GODOT_DIRECTOR.md §2): the story as data, `director/director.json` in the project, written
## by the Director Manager (tools/director_manager, a page) or by hand; the scene is the world, this is the story.
##
##   {"format": 1,
##    "quests":  [{id, title, objective, map, start_at, card: {title, sub, time}, checkpoint, list, steps: [{id, text,
##                done, fail, secs, hidden, who, guide, wrong: {say, who, fail}}], finish: steps|any|opening|never, on_start, on_done,
##                time_limit, on_timeout, round: {type, secs, rule, warn, spots, seeker, loops, barks, on}, next: [{if, go}],
##                stage: {<person>: {do, at, to, then, path, paths, motion, expr, talk, walk, leave, arrive, face}}}],
##    "states":  [{while, set: {<id>: {at, do, to, path, paths, sees, shown, motion, locked, open, light, state}}}],
##    "moments": [{id, when, if, do, once, every, during: [quest ids], cutscene: {target, push, zoom, walk, max}}],
##    "talk":    {<person>: [{id, if, once, title, lines: [{who, text, if, do, answers: [{id, label, think, if, sets,
##                karma, reply: [..], go}]}]}]},
##    "endings": [{id, kind, title, text}],
##    "achievements": [{id, title, text, hidden, when}],
##    "facts":   {<name>: {about, hidden}}}
## `when`, `done`, `fail` are the story format's triggers and `do`, `on_start`, `on_done` its actions (STORY_FORMAT §4);
## every `if`, `while` and `when` of an achievement is a condition (core/cond.gd). A quest's `round` is a round of
## gameplay, the story format's `play` (§9.8: hide and seek, a chase...): the game plays it instead of the steps, its
## result ends the quest and is the fact `result:<quest>:<result>` its `next` can ask for.
## Not every quest is a to-do list (the user, 2026-11-02): `list: false` keeps its steps unseen (a marker can show the
## way: a step's `guide`), and `finish: "opening"` ends it once what happens as it starts (`on_start`) is over: an
## intro. Every game starts with one (INTRO: a new file's first quest).
## An easter egg (the user, 2026-11-02: "special hidden quests that might just be jump scares or certain animations… if
## you find the easter egg you can skip a bunch of quests and jump straight to another one"): a quest with `egg: true`,
## out of the quests' order, found by its `found` (a WHEN) while one of its `during` quests is on (none: any of them),
## when its `if` holds, once a playthrough; it plays its `on_start`, the fact done:<egg> is set, and its `next` (if it
## has one) jumps the story there, else the game goes on where it was.
## A quest's `stage` is **On stage** (docs/GODOT_ANIMATION_PLAN.md §6): each person's line while it's on, carried on
## down the flow until a later quest has a line of its own for her (story_compile.gd stage_cover): `do` idle, sit, go
## (`then` idle or sit), path, patrol or off, its place (`at`, `to`, `path`, `paths`), what she plays there (`motion`),
## her face (`expr`), the conversation she offers in that quest alone (`talk`; "" none), the in-between's own clips
## (`walk`, `leave`, `arrive`) and `face: "player"`.
## A moment's `cutscene` plays it as a cutscene in the level (docs/GODOT_ANIMATION_PLAN.md step 7; no black bars, no
## skip): the view held on its `target` (a person, a spot, a thing) in a cone the player looks round in, `push` and
## `zoom` closer (a lean in, a held focus), `walk` slow, held or free; let go when its `do` is over, or after `max`
## seconds (20) whatever happens: story_compile.gd cutscene_do, the runtime's `focus`.
## `chart`: where each card sits in the Story Flow tab ({id: [x, y]}, editor/flow_tab.gd), the editor's alone: the game
## never reads it.

const DEFAULT := "res://director/director.json"
## the first quest of every game (the user: "it always starts with a quest1 which is intro"): what happens as the game
## opens (a chapter card, a thought, a look round), then the next quest; no list
const INTRO := {"id": "q_intro", "title": "Intro", "objective": "", "list": false, "finish": "opening", "on_start": []}
const EMPTY := {"format": 1, "quests": [INTRO], "states": [], "moments": [], "talk": {}, "endings": [], "achievements": [], "facts": {}}


## the file as data: an empty story when there's none; {"_error": why} when it can't be read
static func read(path: String = DEFAULT) -> Dictionary:
	if path == "" or not FileAccess.file_exists(path):
		return EMPTY.duplicate(true)
	var j = JSON.parse_string(FileAccess.get_file_as_string(path))
	if not (j is Dictionary):
		return {"_error": "%s isn't a JSON object (open it in the Director Manager, or fix it by hand)" % path}
	for k in EMPTY:
		if not j.has(k):
			j[k] = EMPTY[k].duplicate(true) if EMPTY[k] is Dictionary or EMPTY[k] is Array else EMPTY[k]
	return j


static func write(data: Dictionary, path: String = DEFAULT) -> int:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(path.get_base_dir()))
	var f := FileAccess.open(path, FileAccess.WRITE)
	if f == null:
		return FileAccess.get_open_error()
	f.store_string(JSON.stringify(tidy(data), " ", false))
	return OK


## whole numbers written whole: Godot reads every JSON number as a float, and a file read and written back (the panel's
## Story tab) would turn 1 into 1.0 all through
static func tidy(v):
	if v is float and not is_nan(v) and not is_inf(v) and v == floorf(v) and absf(v) < 1e15:
		return int(v)
	if v is Array:
		return (v as Array).map(func(x): return tidy(x))
	if v is Dictionary:
		var o := {}
		for k in v:
			o[k] = tidy(v[k])
		return o
	return v
