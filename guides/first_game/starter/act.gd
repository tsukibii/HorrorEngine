## Something a character does, when (DECISIONS 2026-11-13, animation v2: "walk from here to here, pick this up, etc,
## that are synced to quests"). Put it anywhere; it asks a character's Motion node (motion.gd, under her) for one
## thing, by itself when the Story's words come to hold, or when something fires it; and when she's done it can tick
## a task, set a flag, say a line and fire the next one: a row of these is a little routine.
##   who       the character (her Motion node is found under her); empty: this node's parent
##   act       walk_to, run_to, sit, stand_up, sleep, wake_up, open, reach, pick_up, play, face, idle; since animations
##             v3 the low gaits, peek, scare, punch, swing, eat, drink...; and life (one small movement now: `clip`
##             its name, "scratch_head", or empty for one that suits what she's doing), alive / still (small movements
##             by themselves, on and off), hold (the target put in her hand and carried from then on, `carry` how),
##             drop
##   target    where, or what: a Marker3D to walk to, a seat's or a bed's marker, a door's handle marker, a thing
##   also      open: the door itself (its use() as her hand moves it); sleep: where her head goes (a pillow)
##   needs     the Story's words ("task:key", "on:find_key", "item:soda", a flag): does it when they come to hold
##   fire()    does it now: an event area's, a cue's or another act's Then
##   then      another act (anything with fire()) once she's done; tick / flag / say: the Story's
extends Node

signal started
signal finished

@export var who: NodePath                              ## the character; empty: this node's parent
@export_enum("walk_to", "run_to", "sit", "stand_up", "sleep", "wake_up", "open", "reach", "pick_up", "play", "face", "idle",
	"sneak_to", "crawl_to", "creep_to", "scuttle_to", "rise", "peek", "scare", "punch", "swing", "eat", "drink", "look_around", "knock", "cower", "head_follow", "head_free",
	"life", "alive", "still", "hold", "drop") var act := "walk_to"
@export var target: NodePath                           ## where, or what
@export var also: NodePath                             ## open: the door; sleep: the pillow
@export_enum("push", "pull", "slide") var door_opens := "push"
@export var clip := ""                                 ## play: the animation's name; life: the flourish's ("scratch_head", "look_hand"...; empty: one that suits what she's doing)
@export_enum("as its grip says", "side", "front", "chest", "shoulder", "raised") var carry := "as its grip says"   ## hold: how it's carried
@export var loop := false                              ## play: looped until she's asked for something else
@export var left_hand := false
@export var keep_in_hand := false                      ## pick_up: it stays in her hand
@export_enum("lunge", "loom", "snap", "claw") var scare_kind := "lunge"   ## scare: which
@export var then_hide := false                         ## scare: she's hidden when it's been shown
@export var secs := 2.5                                ## peek: how long she holds it
@export_group("When")
@export var needs := ""                                ## the Story's words: by itself when they come to hold
@export var again := false                             ## every time they come to hold (else once)
@export var wait_secs := 0.0                           ## a moment first
@export_group("Then")
@export var then: NodePath                             ## fired when she's done
@export var tick := ""                                 ## a task ticked when she's done
@export var flag := ""                                 ## flags switched when she's done ("+name", "-name")
@export var say := ""                                  ## a line when she's done

var times := 0
var running := false
var _held := false
var _t := 0.0


func _story() -> Node:
	return get_tree().get_first_node_in_group("hs_story")


## her Motion node: `who` itself when it is one, else the motion.gd under her
func motion() -> Node:
	var n: Node = get_node_or_null(who) if not who.is_empty() else get_parent()
	if n == null:
		return null
	if n.has_method("walk_to") and n.has_method("pick_up"):
		return n
	for c in n.get_children():
		if c.has_method("walk_to") and c.has_method("pick_up"):
			return c
	return null


func fire(_a = null, _b = null) -> void:
	if running:
		return
	var m := motion()
	if m == null:
		push_warning("act.gd (%s): no Motion node (motion.gd) under %s" % [name, who])
		return
	running = true
	times += 1
	if wait_secs > 0.0:
		await get_tree().create_timer(wait_secs).timeout
	started.emit()
	var t: Node3D = get_node_or_null(target) as Node3D
	var o: Node = get_node_or_null(also)
	var what := ""
	match act:
		"walk_to":
			m.walk_to(t)
			what = "walk"
		"run_to":
			m.run_to(t)
			what = "walk"
		"sit":
			m.sit(t)
			what = "sit"
		"stand_up":
			m.stand()
			what = "stand"
		"sleep":
			m.sleep(t, o as Node3D)
			what = "sleep"
		"wake_up":
			m.wake()
			what = "wake"
		"open":
			m.open(t, o, door_opens, left_hand)
			what = "open"
		"reach":
			m.reach(t, "", left_hand)
			what = "reach"
		"pick_up":
			m.pick_up(t, keep_in_hand, left_hand)
			what = "pick_up"
		"play":
			m.play(clip, loop)
			what = "play"
		"face":
			m.face(t)
			what = "face"
		"idle":
			m.idle()
		"sneak_to", "crawl_to", "creep_to", "scuttle_to":
			m.go_low(t, act.trim_suffix("_to"))
			what = act.trim_suffix("_to")
		"rise":
			m.rise()
			what = "rise"
		"peek":
			m.peek(t, secs, left_hand)
			what = "peek"
		"scare":
			m.scare(scare_kind, t, then_hide)
			what = "scare"
		"punch", "swing":
			m.call(act, t, left_hand)
			what = act
		"eat", "drink":
			m.call(act, t, left_hand)
			what = act
		"look_around":
			m.look_around()
			what = "look"
		"knock":
			m.knock(t, left_hand)
			what = "knock"
		"cower":
			m.cower(true)
			what = "low"
		"head_follow":
			m.head_follow(true, t)
		"head_free":
			m.head_follow(false)
		"life":                                               # (laid over what she's doing: nothing to wait for)
			m.life(clip, left_hand)
		"alive":
			m.alive_now(true)
		"still":
			m.alive_now(false)
		"hold":
			if t != null:
				m.hold(t, left_hand, "" if carry == "as its grip says" else carry)
		"drop":
			m.drop()
	if what != "":                                        # till she's done it; asked for something else meanwhile, this act is over and nothing follows
		var got := [false]
		var heard := func(w: String) -> void:
			if w == what:
				got[0] = true
		m.done.connect(heard)
		var mine: int = m.serial
		while not got[0] and m.serial == mine and is_instance_valid(m):
			await get_tree().process_frame
		if is_instance_valid(m) and m.done.is_connected(heard):
			m.done.disconnect(heard)
		if not got[0]:
			running = false
			return
	running = false
	var st := _story()
	if st != null:
		if tick != "" and st.has_method("tick"):
			st.tick(tick)
		if flag != "" and st.has_method("switch_flags"):
			st.switch_flags(flag)
		if say != "" and st.has_method("say"):
			st.say(say)
	finished.emit()
	var nx := get_node_or_null(then)
	if nx != null and nx.has_method("fire"):
		nx.fire()


func _process(dt: float) -> void:
	if needs == "":
		return
	_t -= dt
	if _t > 0.0:
		return
	_t = 0.15
	var st := _story()
	if st == null or not st.has_method("holds"):
		return
	var ok: bool = st.holds(needs)
	if ok and not _held and (again or times == 0):
		fire()
	_held = ok
