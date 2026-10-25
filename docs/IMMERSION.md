# Immersion: the little things

A house feels lived in because of things nobody looks at: a kettle rumbling to the boil and clicking off, steam off a
mug, a hob's rings glowing and its digits counting down, a clock ticking in a quiet room, a cigarette left burning in
an ashtray. They're also the horror's best tools: the same things, wrong. A kettle that's just boiled in an empty
house. A cigarette still smouldering: someone was here a minute ago. The TV on by itself, all static. The clock
stopped at 2:47.

This is the plan for them (asked 2026-10-25): **little things you put in a scene**, each made from numbers like the
rest of the kit, with **a life of its own**: states it moves through, the steam, smoke, glow and LEDs each state
shows, its sounds, and what the player can do to it. The story drives them with one new word, `state`.

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
{"id": "hall_cig", "kit": "cigarette_resting", "on": "hall_ashtray", "at": [3.0, 5.2], "state": "lit"}
```

- `life`: the life it has (the kit type's own when it has one). `state`: where it starts (the life's first state).
- The life's own settings, where it has some: `liquid` (a cup: `tea`, `green_tea`, `coffee`, `water`, `milk`),
  `from` (a cup: the kettle or teapot it's filled from), `rings` (a hob: which are on), `time` (a clock: `"02:47"`),
  `secs` (any: how long its states last, `{"heating": 20}`), `acts: false` (the player can't touch it).
- **The action** `{"state": "kitchen_kettle", "to": "heating"}`: in a beat, a cue on a clip's edge, an act's
  choice. "The kettle: heating."
- **The trigger** `{"state": "kitchen_kettle", "is": "boiled"}`: when it gets there (by itself, by the story, or the
  player). "When the kettle is boiled: Mari: お茶、入れるね。"
- What the player does to it (switch it on, put it out, pour) is `{"use": id}` to the beats, like any use, and the
  state it leaves it in is heard by the trigger.

States carry on: a kettle put on in a task is still boiling in the scene after it. A scene's cues change them on
clip edges, never at a time of their own; a state that times out (the kettle boils after its `heating` seconds)
counts from its cue.

## 3. On the desk

- **Add one from the stage:** right-click a counter, a table or the floor, *Add a little thing here*, pick it from
  pictures; it lands on what you clicked, facing you, alive.
- **The scene view** shows them as the scene stands at that moment: scrub, and the kettle boils on its cue.
- **The Watch and Play** run them: a kettle you switch on boils, clicks and steams; a cup you pour fills.
- **The palette:** *Set a thing's state* and *When a thing is …*; quick beats: *The kettle boils*, *A cigarette
  still burning*, *The phone rings*, *The TV comes on by itself*, *The clock stops*.
- **Sounds** are made in the browser (no files), placed where the thing is and quieter with distance. In Unreal they
  become the game's own (§5).

## 4. Under the hood

| File | What |
|---|---|
| `tools/director/kit.js` | the things' shapes: new types with **sockets** (named points: `spout`, `tip`, `rim`, `ring_1`, `led`, `lcd`...) |
| `Content/Studio/Life/lives.json` | the lives as data: each one's states (`secs`, `next`, `follows`), effects, sounds, acts, settings, sockets for a prop that isn't a kit thing |
| `tools/director/life.js` | the lives' logic, plain: a thing's state at a moment (the start, the story's changes, the timers, what it follows); no DOM, no three.js; DESK tests it |
| `tools/director/lifefx.js` | the effects in three.js: steam, smoke, ember, LED, digits, glow, fill, pour, flame, drip, hands, rattle, screen, buzz; each a function of time, so a scrubbed scene shows the right frame |
| `tools/director/lifesound.js` | the sounds, made with Web Audio |
| `tools/story_check.py`, `storylib` | `life`, `state` and the settings checked; the action and the trigger; the walker reaches a state by acting or waiting |

## 5. Into Unreal

The kit's meshes go across as they do now. Each prop with a life is tagged `life:<name>` and `state:<state>`, and
`Content/Studio/class_map.json`'s `life` table (empty until they're made) names the Blueprint that brings it alive
there (Niagara steam and smoke, the materials' glow and digits, the sounds as the game's own). Until then it's a still
mesh, as a carried plushie is. Docs/RUNNER_SPEC.md has the `state` word for the StoryRunner.
