## DIRECTOR's words (tools/godot_director.py check): every example in story/commands.json (the desk's commands and
## triggers, the conditions, as tools/director_manager/commands_json.mjs read them with commands.js and words.js) read
## the same by story/commands.gd, the panel's Story tab's sentences. Prints WORDSCHECK {...}.
extends SceneTree


func _initialize() -> void:
	var d := HSCommands.data()
	var diff := HSCommands.differences()
	print("WORDSCHECK " + JSON.stringify({"actions": d["actions"].size(), "triggers": d["triggers"].size(), "examples": d["examples"].size(),
		"differences": diff.size(), "first": diff.slice(0, 12)}))
	quit()
