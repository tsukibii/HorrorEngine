# Immersion: the little things

A house feels lived in because of things nobody looks at: a kettle rumbling to the boil and clicking off, steam off a
mug, a hob's rings glowing and its digits counting down, a clock ticking in a quiet room, a cigarette left burning in
an ashtray. They're also the horror's best tools: the same things, wrong. A kettle that's just boiled in an empty
house. A cigarette still smouldering: someone was here a minute ago. The TV on by itself, all static. The clock
stopped at 2:47.

Asked for on 2026-10-25 and built on the desk the same day (the stage, the Watch, Play and the story check; Unreal
is §5): **little things you put in a scene**, each made from numbers like the rest of the kit, with **a life of its
own**: states it moves through, the steam, smoke, glow and LEDs each state shows, its sounds, and what the player can
do to it. The story drives them with one new word, `state`. The desk's guide shows them (`guide.html` §11).

## 1. The catalogue

Each thing is a kit type (its look, docs/KIT.md) and a **life** (what it does). A life works on any prop: a kit thing
knows where its spout or its tip is, anything else gets the life's own guess from its box.

| Thing | Kit | Life: its states | What you see and hear | The player |
|---|---|---|---|---|
| **Electric kettle** | `kettle` (jug, as in most Japanese kitchens) | `off`, `heating`, `boiling`, `boiled` | heating: a blue LED, a rumble that rises, wisps from the spout at the end; boiling: steam pouring from the spout and lid, the roar; boiled: the click, the LED out, the steam thinning for a minute | switches it on (and off) |
| **Stovetop kettle** | `kettle` (whistling, enamel; or a tetsubin, cast iron) | follows the hob or burner it stands on: `off`, `heating`, `whistling` | steam from the spout, the whistle climbing | turns the hob on |
| **Electric hob** | `hob` (ceramic: black glass, printed rings, a touch strip with red digits) | `off`, `on`, `hot` | on: the rings glow red over a few seconds, the digit shows the level, a beep; off: the digit reads **H** while it cools, the glow fades | turns it on and off |
| **Gas hob** | `hob` (gas: a Japanese konro, two burners and the grill) | `off`, `on` | the igniter's ticks, a ring of blue flames, the hiss | turns it on and off |
| **Pot** | `pot` (a saucepan with its lid) | follows the hob: `cold`, `heating`, `simmering`, `boiling` | steam from under the lid, bubbling, the lid rattling as it boils | (the hob) |
| **Cup** | `cup` (a mug, a teacup on its saucer, a yunomi, a glass) | `empty`, `filling`, `full`, `cold`, `drunk` | filling: a stream from above (from the kettle or teapot, lifted over it), the level rising, the pour's pitch rising; full: thin steam curling off it for a few minutes | pours (when its kettle or teapot is ready), drinks |
| **Teapot** | `teapot` (a kyusu with its side handle; a round western one) | `empty`, `full` | a little steam at the spout and the lid | (cups pour from it) |
| **Cigarette** | `cigarette` (filter and paper; lying, or resting at an angle) | `unlit`, `lit`, `out` | lit: the ember glowing, brighter now and then, the paper burning back, a thin blue line of smoke that breaks into curls; out: a last wisp | puts it out |
| **Ashtray** | `ashtray` (glass, metal, ceramic; with butts in it) | | | |
| **Lighter** | `lighter` | `off`, `lit` | the flick, the flame | |
| **Incense, a mosquito coil** | `incense` (a stick in its holder), `coil` (the spiral on its stand) | `lit`, `out` | an ember, one thin line of smoke | |
| **Wall clock** | `clock` | `running`, `stopped` | the hands turning from its `time`, the tick | |
| **Rice cooker** | `rice_cooker` | `off`, `cooking`, `warm` | cooking: steam from the vent, an orange LED, the LCD counting down; done: the little tune, then the warm light | starts it |
| **TV, a screen** | any prop with a screen (the kit's TV panel) | `off`, `static`, `on` | static: grey snow and its cold flicker on the room; on: a programme's colours flickering | |
| **Phone** | `phone` | `off`, `lit`, `ringing` | ringing: the screen lit, the buzz, the phone shivering on the table | |
| **Dripping tap** | `tap` | `off`, `dripping`, `running` | a drop every few seconds and its plink in the sink; running: a stream | turns it off (or on) |
| **Fridge** | the kit's fridge | `on`, `off` | the hum, the compressor's click | |
| **Candle** | `candle` | `lit`, `out` | a flame that sways, its light on the room | |

Later, the same way: an electric fan turning its head, a kerosene heater's glowing ring, a kotatsu's red glow, a
wind chime on the engawa, a microwave, a washing machine's spin, a butsudan's bell and incense.

## 2. In a story

A prop gets a `life` (or its kit's own: a kit kettle is a kettle) and the `state` it starts in:

```json
{"id": "kitchen_kettle", "kit": "kettle_jug", "on": "kitchen_counter", "at": [1.4, 0.35], "rot": 180, "state": "off"},
{"id": "kitchen_mug", "kit": "mug", "on": "kitchen_table", "at": [2.1, 1.9], "state": "full", "liquid": "tea", "from": "kitchen_kettle"},
{"id": "hall_ash", "kit": "ashtray_burning", "on": "hall_table", "at": [2.75, 5.15], "state": "lit"}
```

- `life`: the life it has (the kit type's own when it has one). `state`: where it starts (the life's first state).
- The life's own settings, where it has some: `liquid` (a cup: `tea`, `green_tea`, `coffee`, `water`, `milk`,
  `barley_tea`, `soup`), `from` (a cup or a teapot: the kettle or teapot it's filled from), `rings` (a hob: which are
  on), `level` (a hob: its digits), `light` (a candle: the light it lights), `secs` (any: how long its states last,
  `{"heating": 20}`), `acts: false` (the player can't touch it). A clock shows its kit's `time`:
  `"kit": {"preset": "wall_clock", "time": "02:47"}`.
- **The action** `{"state": "kitchen_kettle", "to": "heating"}`: in a beat, a cue on a clip's edge, an act's
  choice. "The kettle: heating."
- **The trigger** `{"state": "kitchen_kettle", "is": "boiled"}`: when it gets there (by itself, by the story, or the
  player). "When the kettle is boiled: Mari: お茶、入れるね。"
- What the player does to it (switch it on, put it out, pour) is `{"use": id}` to the beats, like any use, and the
  state it leaves it in is heard by the trigger.

States carry on: a kettle put on in a task is still boiling in the scene after it. A scene's cues change them on
clip edges, never at a time of their own; a state that times out (the kettle boils after its `heating` seconds)
counts from its cue.

**Time skipped** (`{"skip": 5400}`, STORY_FORMAT §4): missing time. Every little thing lives through it at once (the
wall clock's hands jump on an hour and a half, the tea poured before it is cold, the cigarette burnt out), and the
player notices only by them. `life.js` `States.skip` moves every one's clock back by it and lets the timers run.

## 3. On the desk

- **Add one from the stage:** right-click a counter, a table or the floor, *Add a little thing here…*, pick it from
  pictures; it lands on what you clicked, facing the player, alive.
- **Right-click one:** *It starts …* for each of its states (the tick on the one it starts in).
- **The scene view** shows them as the scene stands at that moment: scrub, and the kettle boils on its cue.
- **The Watch and Play** run them: a kettle you switch on boils, clicks and steams; a cup you pour fills.
- **The palette:** the command *Set a thing's state* and the trigger *A thing is in a state*, the thing picked by
  its picture, then one of its states; quick beats: *A kettle put on (it boils by itself)*, *A cigarette still
  burning*, *The phone rings*, *The TV comes on by itself*, *The clock stops*.
- **Sounds** are made in the browser (no files), placed where the thing is and quieter with distance; the Watch's
  *things' sounds* turns them off. In Unreal they become the game's own (§5).
- **The Sample** has a kettle on the kitchen stove, a cup of green tea poured from it on the table, a wall clock
  at 2:47, an ashtray with a cigarette burning in the hall, a flip phone and a TV in the study.

## 4. Under the hood

| File | What |
|---|---|
| `tools/director/kit.js` | the things' shapes: new types with **sockets** (named points: `spout`, `tip`, `rim`, `ring_1`, `led`, `lcd`...) |
| `Content/Studio/Life/lives.json` | the lives as data: which kit things have which (`by_kit`, `by_preset`), each one's states in order (`secs`, `next`, `keep`, `ready`, `acts`, `fx`, `sound`, `enter`), what it `follows`, its settings, the liquids' colours |
| `tools/director/life.js` | the lives' logic, plain: a prop's life, where it starts, and `States`, a run's little things on its clock (the story's changes, the timers, a follower moved by its leader, the time a burning thing has burnt kept across visits, the player's acts); no DOM, no three.js; DESK tests it |
| `Content/Python/storykit/life.py` | the same for the check: a prop's life (node and python agree on every preset: DESK), its states, `reach` (how a state is got to: waiting, acts, the leader), for the walker |
| `tools/director/lifefx.js` | the effects in three.js: steam, smoke, ember, LED, digits, glow, fill, pour, flame, drip, hands, rattle, screen, buzz; each a function of time, so a scrubbed scene shows the right frame |
| `tools/director/lifesound.js` | the sounds, made with Web Audio |
| `tools/story_check.py` | `life`, `state` and the settings checked; the action and the trigger; the walker reaches a state by acting (it goes there and uses it) or waiting, and counts the time |
| `tools/director/play/` | Play: the `state` action and condition, the `life` interactable (E does the state's act, its label the prompt), the states ticking on the run's clock |

## 5. Into Unreal

**In Godot (2026-10-29) all of this is built** (docs/GODOT_EXPORT.md §8): `lifefx.gd` the effects at the kit's
sockets, `lifesound.gd` the sounds from these same recipes rendered into loops at run time, `life.gd` the lives.

**What goes across now:** the kit's meshes, as for every kit prop (`tools/kit/build.mjs`), and on each prop with a
life the tags `life:<name>` and `state:<state>` (where it starts; `storykit/plan.py`). RUNNER_SPEC.md has the `state`
word for the StoryRunner. In Unreal a little thing is a still mesh for now, as a carried plushie is.

**What brings them alive there** needs the editor, so it's not built yet; each is its own step, PLAYTHROUGH after:

1. **A Blueprint per life**, `BP_Life_<Name>` in `/Game/Studio/Life/`: its states set by `SetState`, the timers on the
   game's clock from the same `lives.json` (read at runtime, so the desk and the game agree), and the kit's sockets
   (the spout, the tip, the rim, the rings) as scene components where its effects come from.
2. **The effects** at the sockets: steam as a soft sprite plume in Niagara, its rate from the state's `rate`; a
   cigarette's smoke as a ribbon; embers, LEDs, a hob's rings and digits as material parameters; the fill as a plane
   moved by a parameter, the pour as a spline mesh, the burn back as a material mask. The desk's numbers
   (`lifefx.js`) are the reference: the same rates, sizes and colours.
3. **The sounds** as the game's own (MetaSounds after `lifesound.js`'s recipes, or recordings), on the actor,
   attenuated as on the desk.
4. **The import:** `Content/Studio/class_map.json` gets a `life` table (a life's name: its Blueprint class), and
   `storykit.importer.spawn` puts that Blueprint on a prop tagged `life:*`, with its `state`, keeping the kit's mesh.

Until then, the desk is where they're seen and heard.
