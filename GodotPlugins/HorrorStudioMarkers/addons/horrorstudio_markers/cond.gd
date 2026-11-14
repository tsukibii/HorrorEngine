@tool
## The words a condition is written in (docs/MARKERS.md §5): a marker's Starts when, a quest's, a way's, a Repeat's
## until, a face's rule, a conversation's. Words apart by commas, all of them must be so; "!" in front for not.
##     name          the flag `name` is on            task:id   that task is ticked
##     on:id         that task is on the list, open   item:x    you carry x
##     @wait:3       she's been ready for 3 seconds   @near:2   you're within 2 m      @far:6   further than 6 m
##     @seen         you can see her                  @unseen   you can't
##     @shot         she's been hit                   @down     she's been shot down
## The first four are the starter kit's Story's own words (its `holds`): with a Story in the scene (the group
## hs_story) they're asked of it, so a flag anything sets is heard here and a flag set here is heard by everything.
## Without one the flags are kept here (`flags`) and tasks and items are never so. The words with an @ are about her
## and you, right now: they're asked of whoever passes itself as `ctx` (the runner: its `local(word, arg)`).
class_name HSNpcCond
extends RefCounted

const LOCAL := ["wait", "near", "far", "seen", "unseen", "shot", "down"]

static var flags := {}                     ## the flags when no Story keeps them


static func story(tree: SceneTree) -> Node:
	return tree.get_first_node_in_group("hs_story") if tree != null else null


## a condition's words, trimmed, the empty ones left out
static func words(text: String) -> PackedStringArray:
	var out := PackedStringArray()
	for part in text.split(",", false):
		var w := part.strip_edges()
		if w != "" and w != "!":
			out.append(w)
	return out


## one word read: {neg, kind, arg}: kind "flag", "task", "on", "item" or one of LOCAL
static func parse(word: String) -> Dictionary:
	var w := word.strip_edges()
	var neg := w.begins_with("!")
	if neg:
		w = w.substr(1).strip_edges()
	if w.begins_with("@"):
		var body := w.substr(1)
		var at := body.find(":")
		var k := body.substr(0, at) if at >= 0 else body
		return {"neg": neg, "kind": k if k in LOCAL else "flag", "arg": body.substr(at + 1).strip_edges() if at >= 0 else "", "word": w}
	for pre in ["task:", "on:", "item:"]:
		if w.begins_with(pre):
			return {"neg": neg, "kind": pre.trim_suffix(":"), "arg": w.substr(pre.length()).strip_edges(), "word": w}
	return {"neg": neg, "kind": "flag", "arg": w, "word": w}


static func is_local(word: String) -> bool:
	return parse(word)["kind"] in LOCAL


## is it so? `tree`: the scene's; `ctx`: who answers the @ words (an object with local(kind, arg) -> bool), or null:
## then they're never so (and their "not" always is)
static func holds(text: String, tree: SceneTree, ctx: Object = null) -> bool:
	if text.strip_edges() == "":
		return true
	var st := story(tree)
	for w in words(text):
		var p := parse(w)
		var ok := false
		match String(p["kind"]):
			"flag":
				ok = is_set(tree, String(p["arg"]), st)
			"task":
				ok = st != null and st.has_method("done") and bool(st.done(String(p["arg"])))
			"on":
				ok = st != null and st.has_method("has_task") and bool(st.has_task(String(p["arg"]))) and not bool(st.done(String(p["arg"])))
			"item":
				ok = st != null and st.has_method("has") and bool(st.has(String(p["arg"])))
			_:
				ok = ctx != null and ctx.has_method("local") and bool(ctx.local(String(p["kind"]), String(p["arg"])))
		if ok == bool(p["neg"]):
			return false
	return true


static func is_set(tree: SceneTree, flag: String, st: Node = null) -> bool:
	if st == null:
		st = story(tree)
	if st != null and st.has_method("is_set"):
		return bool(st.is_set(flag))
	return bool(flags.get(flag, false))


static func set_flag(tree: SceneTree, flag: String, on := true) -> void:
	if flag == "":
		return
	var st := story(tree)
	if st != null and st.has_method("set_flag"):
		st.set_flag(flag, on)
	elif on:
		flags[flag] = true
	else:
		flags.erase(flag)


## "+name" or "name" on, "-name" off, "~name" flipped; several apart by commas (the Story's switch_flags)
static func switch_flags(tree: SceneTree, text: String) -> void:
	for part in text.split(",", false):
		var w := part.strip_edges()
		if w == "":
			continue
		var op := w[0]
		var nm := w.substr(1).strip_edges() if op in ["+", "-", "~"] else w
		if nm == "":
			continue
		if op == "-":
			set_flag(tree, nm, false)
		elif op == "~":
			set_flag(tree, nm, not is_set(tree, nm))
		else:
			set_flag(tree, nm, true)


## the flags a switch_flags text names: [{name, op}]
static func switched(text: String) -> Array:
	var out := []
	for part in text.split(",", false):
		var w := part.strip_edges()
		if w == "":
			continue
		var op := w[0] if w[0] in ["+", "-", "~"] else "+"
		var nm := w.substr(1).strip_edges() if w[0] in ["+", "-", "~"] else w
		if nm != "":
			out.append({"name": nm, "op": op})
	return out


## one word in plain words: "flag alex_kitchen", "not seen", "after 3 s"
static func says_word(word: String) -> String:
	var p := parse(word)
	var a := String(p["arg"])
	var neg := bool(p["neg"])
	match String(p["kind"]):
		"flag":
			return ("not %s" if neg else "%s") % a
		"task":
			return ("quest %s not done" if neg else "quest %s done") % a
		"on":
			return ("quest %s not open" if neg else "quest %s open") % a
		"item":
			return ("without %s" if neg else "carrying %s") % a
		"wait":
			return "after %s s" % a
		"near":
			return ("you're not within %s m" if neg else "you're within %s m") % a
		"far":
			return ("you're within %s m" if neg else "you're over %s m away") % a
		"seen":
			return "out of your sight" if neg else "in your sight"
		"unseen":
			return "in your sight" if neg else "out of your sight"
		"shot":
			return "not shot yet" if neg else "has been shot"
		"down":
			return "not shot down" if neg else "shot down"
	return word


## a whole condition in plain words ("" for none)
static func says(text: String) -> String:
	var parts := PackedStringArray()
	for w in words(text):
		parts.append(says_word(w))
	return ", ".join(parts)


## a condition with one word added (once), taken out, or its "not" flipped
static func with_word(text: String, word: String) -> String:
	var ws := words(text)
	var k: String = parse(word)["word"]
	for w in ws:
		if String(parse(w)["word"]) == k:
			return text
	ws.append(word)
	return ", ".join(ws)


static func without_word(text: String, index: int) -> String:
	var ws := words(text)
	if index >= 0 and index < ws.size():
		ws.remove_at(index)
	return ", ".join(ws)


static func flipped(text: String, index: int) -> String:
	var ws := words(text)
	if index >= 0 and index < ws.size():
		var w := ws[index]
		ws[index] = w.substr(1).strip_edges() if w.begins_with("!") else "!" + w
	return ", ".join(ws)


## a name made safe for a flag: small letters, digits and underscores
static func slug(text: String) -> String:
	var out := ""
	for ch in text.strip_edges().to_lower():
		if (ch >= "a" and ch <= "z") or (ch >= "0" and ch <= "9"):
			out += ch
		elif out != "" and not out.ends_with("_"):
			out += "_"
	return out.trim_suffix("_")
