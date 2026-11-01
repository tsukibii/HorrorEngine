@tool
class_name HSStoryFile
extends RefCounted
## The Director file (docs/GODOT_DIRECTOR.md §2): the story as data, `director/director.json` in the project, written
## by the Director Manager (tools/director_manager, a page) or by hand; the scene is the world, this is the story.
##
##   {"format": 1,
##    "quests":  [{id, title, objective, map, start_at, card: {title, sub, time}, checkpoint, steps: [{id, text, done,
##                fail, secs, hidden, who, wrong: {say, who, fail}}], finish: steps|any|never, on_start, on_done,
##                time_limit, on_timeout, next: [{if, go}]}],
##    "states":  [{while, set: {<id>: {at, do, to, path, paths, sees, shown, motion, locked, open, light, state}}}],
##    "moments": [{id, when, if, do, once, every, during: [quest ids]}],
##    "talk":    {<person>: [{id, if, once, title, lines: [{who, text, if, do, answers: [{id, label, think, if, sets,
##                karma, reply: [..], go}]}]}]},
##    "endings": [{id, kind, title, text}],
##    "achievements": [{id, title, text, hidden, when}],
##    "facts":   {<name>: {about, hidden}}}
## `when`, `done`, `fail` are the story format's triggers and `do`, `on_start`, `on_done` its actions (STORY_FORMAT §4);
## every `if`, `while` and `when` of an achievement is a condition (core/cond.gd).

const DEFAULT := "res://director/director.json"
const EMPTY := {"format": 1, "quests": [], "states": [], "moments": [], "talk": {}, "endings": [], "achievements": [], "facts": {}}


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
	f.store_string(JSON.stringify(data, " ", false))
	return OK
