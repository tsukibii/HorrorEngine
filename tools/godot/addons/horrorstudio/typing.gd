## A thought that types itself out (STORY_FORMAT §9.15; the desk's play/typing.js, ported): `breaks` (a memory
## flicker: it types out, its last letters glitch, and it's gone) and `retype` (typed, then erased back to where the two
## part and typed again as these words). What shows t seconds in, as plain functions; storylib.typed_secs counts the
## same time. A thought with neither shows whole.
extends RefCounted

const TYPE_CPS := 28.0
const ERASE_CPS := 70.0
const HOLD := 0.6
const GLITCH := 0.45
const BROKEN := "▓▒░█▚▞"


static func pause(ch: String) -> float:
	if ch == "," or ch == ";":
		return 0.12
	if ch == "." or ch == "!" or ch == "?":
		return 0.3
	if ch == "…" or ch == "—":
		return 0.35
	return 0.0


## the time to type s, letter by letter, with a pause after punctuation (none after the last)
static func type_secs(s: String) -> float:
	var t := 0.0
	var n := s.length()
	for i in n:
		t += 1.0 / TYPE_CPS
		if i < n - 1:
			t += pause(s[i])
	return t


## how many letters of s are typed t seconds in
static func letters_at(s: String, t: float) -> int:
	var u := 0.0
	var n := s.length()
	for i in n:
		u += 1.0 / TYPE_CPS
		if u > t:
			return i
		if i < n - 1:
			u += pause(s[i])
	return n


static func common(a: String, b: String) -> int:
	var i := 0
	while i < a.length() and i < b.length() and a[i] == b[i]:
		i += 1
	return i


## the whole of it: typing, holding, erasing, retyping or breaking up (its hold to read after is the caller's)
static func typed_secs(text: String, retype = null, breaks: bool = false) -> float:
	var again: String = str(retype) if retype != null else ""
	if again == "" and not breaks:
		return 0.0
	var t := type_secs(text)
	if again != "":
		var k := common(text, again)
		t += HOLD + (text.length() - k) / ERASE_CPS + type_secs(again.substr(k))
	if breaks:
		t += GLITCH
	return t


## what shows t seconds in: {shown, glitch (0..1 while it breaks up, else 0), done}
static func typed_at(text: String, retype, breaks: bool, t: float) -> Dictionary:
	var again: String = str(retype) if retype != null else ""
	if again == "" and not breaks:
		return {"shown": text, "glitch": 0.0, "done": true}
	var t1 := type_secs(text)
	if t < t1:
		return {"shown": text.substr(0, letters_at(text, t)), "glitch": 0.0, "done": false}
	var u := t - t1
	var cur := text
	if again != "":
		var k := common(text, again)
		var erase := (text.length() - k) / ERASE_CPS
		var rest := again.substr(k)
		if u < HOLD:
			return {"shown": text, "glitch": 0.0, "done": false}
		u -= HOLD
		if u < erase:
			return {"shown": text.substr(0, text.length() - int(floor(u * ERASE_CPS))), "glitch": 0.0, "done": false}
		u -= erase
		var tr := type_secs(rest)
		if u < tr:
			return {"shown": again.substr(0, k + letters_at(rest, u)), "glitch": 0.0, "done": false}
		u -= tr
		cur = again
	if breaks:
		if u < GLITCH:
			return {"shown": cur, "glitch": min(1.0, u / GLITCH), "done": false}
		return {"shown": "", "glitch": 0.0, "done": true}
	return {"shown": cur, "glitch": 0.0, "done": true}


## a glitching line's look: its last letters swapped for broken ones, more of them as it breaks (seeded by the time)
static func glitched(s: String, g: float, seed: int = 0) -> String:
	var a := s
	var n: int = min(a.length(), 1 + int(round(g * 6)))
	var out := a.substr(0, a.length() - n)
	for i in range(a.length() - n, a.length()):
		var ch := a[i]
		if ch != " ":
			var v := absf(floor(sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453))
			ch = BROKEN[int(fmod(v, BROKEN.length()))]
		out += ch
	return out
