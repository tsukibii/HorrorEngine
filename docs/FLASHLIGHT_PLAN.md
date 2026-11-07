# The flashlight on batteries, and characters that feel its light (a plan)

The user (DECISIONS 2026-11-07): "Can you design a flashlight that's battery powered and has flicker mechanics etc,
we also want mechanics where a npc might not like light so backs off (so we need a drag and drop thing for npcs to
basically let them know if someone is flashing a light at them so we can trigger reactions or mechanics off of that)."

HORROR_TODO.md items 11 and 12. **Designed, not built: waiting on the user's yes.** Everything below is on the desk
(Play) and in Godot with the same numbers, as the lamps' flicker curves are (HSFlicker), and in the Director as parts
and cards. A game whose torch has no `battery` plays exactly as it does now.

## 0. What there is now

- **The torch.** An item with `torch` (true, or its settings) is a flashlight. Picked up or given, it's in the pocket,
  not the inventory's row, and **F** switches it (play.gd `torch_switch`, torch.js).
- **The beam:** a hot cone of 26° in a spill of 62°, 18 m, 5200 K. It comes from the right hand 0.09 s behind the
  look and bobs with the steps (play.gd `torch_tick`).
- **The story's words:** `torch` `on`, `off`, `flicker` (a 1.4 s stutter, then on), `dead` (a 1.1 s stutter and out,
  F only clicks) and `works` (new batteries). It hears `{"torch": "on"}` and `{"torch": "off"}`.
- **What's missing:** no charge, no batteries, nothing that runs low. Nothing knows where the beam falls: the cast see
  the player (`sees`: an angle, a range, a ray, a meter) but not the light.

## 1. The flashlight on batteries — built 2026-11-07 (but its props, 1f)

**Built** (DECISIONS 2026-11-07, later): 1a to 1e on the desk and in Godot with the same numbers
(`tools/shared/torchbeam.js`, `tools/godot/addons/horrorstudio/torch_beam.gd`): the charge and its drain, the bulb's
and the LED's beams, the brownouts, `rest`, batteries into the pocket and changed by themselves, the pause menu's
charge and *Change the batteries*, the story's `dim`, `drain` and timed `flicker`, the triggers `low`, `dead`,
`changed` and the condition `{"charge": 0.25}` (a number: forms take one, not an object); the Director's Flashlight
fields and its Batteries card; TestRoom001's station 10. Not built yet: the props (1f), the battery-change sounds (the
switch's clicks stand in), `game.torch_meter`.


### 1a. The charge

- **It drains.** `charge` goes from 1 (full) to 0 and drains only while the torch is on. The item's `battery` is the
  seconds of light from full: 420 is seven minutes of light. A torch with no `battery` never drains.
- **It can start low:** the item's `charge` (a torch found in a drawer at 0.3).
- **Two kinds** (the item's `kind`). Each is a curve of brightness `b` and colour by charge, one table shared by
  torch.js and play.gd.
  - **`bulb`, the default: an old torch with a filament.** It gets dimmer and warmer from the start:
    - b = √charge, and the colour goes from its `kelvin` (3200 K) toward 2100 K as (1 − charge)² (2925 K at half,
      2500 K at a fifth, 2200 K at the end);
    - under `low` (0.2) come brownouts: dips to 40% for 0.06 to 0.2 s. They come every 3 s at `low`, closing to every
      0.4 s near empty, each gap varied by up to 40%;
    - under 0.03 is the dying stutter (today's `dead`), then out.
  - **`led`: a modern torch.** It stays full and white (6000 K) down to `low` (0.15). There it blinks three times
    (off 0.08 s, on 0.12 s: an LED driver's warning) and steps down to 35%, steady. Under 0.05 it strobes slowly (on
    0.4 s, off 0.15 s), then goes out.
- **Its reach goes with its brightness:** range × √b, because light falls with the square of distance. A beam at a
  quarter brightness reaches half as far. What it lights fades with it, and so does what it scares (§2).
- **`rest`** (an option, `bulb` only): real cells recover a little after a rest. A torch that's died, switched off for
  30 s, gives 3% more for one go, at most twice a set. "Give it a rest" is a real trick, and it buys a few seconds.

### 1b. Batteries

- **An item with `"battery"` is batteries** (1 is a full set; 0.5 a used set found in a drawer). Picked up, it goes in
  the pocket with the torch as a count, not into the inventory's row. `container`s hold them as they hold anything.
- **They change themselves** when the torch dies and there's a set in the pocket:
  1. the beam gutters out;
  2. about two seconds of dark, with the sounds of it (the cap unscrewed, the old cells out, the new in, the cap);
  3. full light again.

  It's heard as `{"torch": "changed"}`. No key, no prompt: those two seconds of dark are the story's to use.
- **Early, from the pause menu:** *Change the batteries*, when there's a set and the torch isn't full. A half-used set
  changed early is lost, as in life.
- **Scarcity is the story's choice.** Roughly a set for every 15 to 20 minutes the torch is really needed. They can
  wait in a drawer, a vending machine's tray (HORROR_TODO 8) or the front desk.

### 1c. Flicker

One beam, four reasons to flicker:

1. **Low charge:** the curve's own brownouts or an LED's blinks (1a).
2. **The story's.** `{"torch": "flicker"}` as now, with `secs` (how long) and `mode` (the lamps' modes: `dying`,
   `fluorescent`, `pulse`, `custom` with `letters`). `{"torch": "dim", "to": 0.4, "secs": 5, "over": 1}` dims the
   beam and brings it back: the lights' words from HORROR_TODO 0, the same for the torch.
3. **Near someone.** A cast member's `near` (§2b): within its `radius` the beam flickers (more often and deeper the
   nearer she is), dims or dies, and the lamps near her do the same. She needn't be seen; the light knows. TRICKS.md
   has it: "flicker means danger", "candles gutter when she's close".
4. **When the story drains it:** `{"torch": "drain", "to": 0.05}` before the corridor, and the dying is the scare. The
   jump scares' *flashlight dying at the worst moment* is this, with the charge as its alibi.

No shaking or mashing brings it back (quick-time events are out: DECISIONS 2026-10-27). Switching it off and on again
is how a person tries, and with `rest` it gives a few seconds.

### 1d. What the player sees and hears

- **The beam is the meter.** Its colour and reach say how much is left; there's no bar on the screen.
- **`game.torch_meter: true`** (off by default) shows a small battery glyph (the Studio's symbols, the theme's glass)
  beside the F hint: for two seconds after the torch is switched on, and while it's low.
- **The pause menu** shows the charge and the sets in the pocket either way (menu.gd's `has`).
- **Sounds:**
  - the clicks on and off, which are on the shelf now (`flashlight_01`, `_02`);
  - the change, which is new for the shelf (a cap unscrewing, cells dropping, the cap screwed: CC0 or built,
    `sfx.py add`);
  - a bulb's faint tick at a brownout, optionally.

### 1e. The story's words (STORY_FORMAT §2 items, §4)

```json
"items": {
  "torch":    {"name": "Flashlight", "torch": {"kind": "bulb", "battery": 420, "charge": 0.6, "low": 0.2, "rest": true, "kelvin": 3200}},
  "aa_cells": {"name": "AA batteries", "battery": 1}
}
```

- **Actions.** `torch` takes:
  - `on` and `off`;
  - `flicker` (+ `secs`, `mode`);
  - `dim` (+ `to`, `secs`, `over`);
  - `dead`: the charge to 0, out;
  - `works`: full, as new batteries;
  - `drain` (+ `to`: the charge).
- **Triggers.**
  - `{"torch": "on" | "off" | "low" | "dead" | "changed"}`. The last three are new: it ran under its `low`, it died,
    its batteries were changed.
  - `{"charge": 0.25}` holds while the charge is under that.
- **The check:**
  - a `battery` item in a game with no flashlight: a warning;
  - a torch that runs out with no batteries the player can reach, before a room that needs it: a warning, from the
    walker's reach;
  - `rest` on an LED: ignored, with a warning.
- **The Director.**
  - The *Flashlight* part gets *Battery* (minutes of light; none never runs down), *Starts at*, *Kind* (an old bulb,
    an LED) and *Low at*.
  - A *Batteries* part (Lights: how full).
  - The Player start's *starts with* takes batteries.
  - The Story tab:
    - WHEN *the flashlight runs low / dies / gets new batteries*;
    - ONLY IF *the flashlight is under … %*;
    - THEN *the flashlight dims / flickers for … / dies / is charged to …*.
  - Ready-made moments: *The flashlight flickers*, now with its length, and *The flashlight dies*, until new batteries.

### 1f. The props (HORROR_TODO's prop standard)

**The flashlight family** (`torch`, `CUSTOM = True`):
- `kind`:
  - `metal`: an aluminium torch with a knurled grip and D cells, anodised colours or a PBR set;
  - `plastic`: a cheap torch with a slide switch and a coloured body;
  - `lantern`: a square 6 V lantern with a carry handle;
  - `pen`: a penlight.
- **Slots:** the maker's mark (`brand`, `logo`) and a sticker (a price sticker, a name in marker: the last owner's).
- **Wear:** scratches, paint worn off the grip.
- **Parts:** the tail cap, unscrewing on a slide (examined, the cells inside), and the switch.
- **Sockets:**
  - `lens`: a lit torch lying on the floor shines from it, its beam across the floor. A found torch still on: a story
    light at the prop's socket, as a light with a fitting is;
  - `switch`.

**The batteries** (the can family's lathe and print, or a family of their own, `cell`):
- AA, C, D and a 9 V, each cell's wrapper a slot (the brand, its colours);
- a blister pack (a card and a bubble, the card's print a slot) and a box of four.

Both go in the library and Godot as every prop does. The torch lives in the pocket, so its picture shows only in the
pause menu.

## 2. Characters and things that feel the light — built 2026-11-07 (but `avoids`)

**Built** (DECISIONS 2026-11-07, later): 2a, 2b, 2d and 2e on the desk and in Godot (play.gd `beam_watch`, `beam_at`,
`beam_hold`, `torch_seen`; runtime.js the same): the beam tested against every cast member and every thing a `lit` or
`flashed` trigger names; the cast's `beam` (`does`, `after`, `bright`, `dist`, `speed`, `keep`, `clip`, `face`,
`sound`, `flee`, and `near`, `near_torch`, `near_lamps` flat on it: a form takes fields, not an object) and the `beam`
action over it; the triggers `lit` and `flashed`; the sight's `torch`; the Director's character fields (Feels light,
Sees torch, Near lights), the People cards *Feels the light*, *Backs off from the light*, *Freezes in the light* and
*Drawn to the light* (a card of a new kind, `actor`: clicked with her selected or dragged onto her), a Reactions card
dropped on a character making a moment *when the flashlight is on her*, her *In the light* move. TestRoom001's station
10: Aoi backs off, two flashes heard, the flashlight flickering by her, on the desk and in Godot. **Not built yet**:
`in_light` and `avoids` (2c: lamps she won't walk into, the walks between rooms closed while lit), and the
`shows_in_beam` extra.


### 2a. What feels the beam

**Who is tested.** While the torch is on (not peeping, not dead), every frame the beam is tested against each cast
member with a `beam` (2b), and each thing a `lit` trigger names (a painting, a doll, the mirror's writing).

**What counts as lit.**
- **The reach:** the target is within the beam's reach now (the range by the charge, 1a).
- **The cone:** inside the hot cone counts whole, and the spill alone a fifth.
- **Distance:** whole within a third of the reach, falling to nothing at its end.
- **Nothing in between:** no wall or shut door. A ray goes from the torch to her chest and one to her head; either
  reaching her counts.
- **Her body is shown.**

**What it gives.**
- `lit` (0..1): how strongly, the cone × the distance × the beam's brightness (1a).
- `lit_for`: the seconds she's been lit at least as strongly as her `bright`.
- `flashed`: the beam landing on her when it wasn't, either switched on at her or swung onto her in under a quarter
  second; counted in a short window (`times`, `within`).

Two rays a cast member, only while the torch is on: cheap.

**Lamps too:** `in_light` holds while she stands where an electric light is on and powered (her room's lights, or
inside a light's `radius`). This is for "she won't come into the light" (2c).

**An extra: things shown only in the beam.** A thing with `shows_in_beam` fades in while the beam's on it and out
after: writing on a wall, a figure only the torch finds. One of the jump-scare tools (HORROR_TODO 13).

### 2b. What she does: her `beam`

A cast member's setting. Changed in play by the action `{"beam": "maid", "does": "comes"}`, from a beat, a scene's cue
or an answer's `do`. In the Director, a state changes it (`set: {"maid": {"beam": "freezes"}}`).

```json
"cast": {"maid": {"beam": {"does": "backs_off", "after": 0.4, "bright": 0.3, "dist": 2.5, "speed": 1.6, "keep": 4,
                          "clip": "shield_eyes", "face": "wince", "sound": "hiss_01"}}}
```

**`does`**
- `nothing`: only the triggers, and the story decides.
- `backs_off`: she steps back from the light along the line from the player, facing them, `dist` metres at `speed`,
  stopping at a wall (a ray). She plays `clip` (her move "in the light") and keeps away while lit and `keep` seconds
  after. Then she goes back to what she was doing: her patrol, her chase, her spot.
- `freezes`: she stops dead while lit and moves again once it's off her. What hunts in the dark: the battery is the
  clock.
- `flees`: she goes to her `flee` spot, out of sight, and stays `keep` seconds; then she's back.
- `vanishes`: she's gone the moment it's on her. She's hidden, and shown again by the story or after `keep` at
  another of her spots: the glimpse in the beam.
- `covers`: her move and her face only, held `keep` seconds (she covers her eyes). Her behaviour waits, as it does for
  a reaction (play.gd `react`).
- `comes`: she's drawn to it and walks toward the light while it's on. Switch it off to hide.
- `charges`: it angers her and her chase starts (a round's seeker, or `behave` `go` to the player).

**When she does it**
- `after`: the seconds in the beam before she does it.
- `bright`: how strong the light must be. The spill alone (0.2) never moves her at the default 0.3; a dying torch's
  short reach moves her only close up. The battery is the stakes.
- `times` + `within`: flashed that many times in that long, instead of `after`. Flash her twice and she goes.

**The light gives you away.** Her `sees` takes `torch`: how much faster her meter fills while the player's torch is
on within her range, from any side, because she sees the light. It's 0 unless set; the Watcher card sets 2. In a
hiding or sneaking round the player chooses between the light and being unseen.

**Near her.** `"near": {"radius": 6, "torch": "flicker", "lamps": "flicker"}`: the flashlight and the lamps within
reach of her flicker (or `dim`, or `die`), more as she's nearer (1c's third reason).

### 2c. Her rules with lamps

- **`avoids: "light"`.** She won't walk into a lit room or a lamp's reach. Her `go` and her patrol stop at its doorway
  and wait or turn back, and a chase stops there.
- **How:** the walks between rooms already go door by door (the Director's `way`, compile.gd's room map). A lit room is
  closed to her while it's lit.
- **What it gives a motel:** lamps are safe places. The power cut, the lights dying and a dimmed bulb (HORROR_TODO 0)
  take them away, and the torch is the light you carry, with few batteries.

### 2d. The story's words

- **Triggers:**
  - `{"lit": "maid", "secs": 0.5}`: held in the beam that long; it holds while she's lit after that;
  - `{"lit": "doll_01"}`: a thing in the beam;
  - `{"flashed": "maid", "times": 2, "within": 3}`;
  - `{"in_light": "maid"}`: she's in a lit room or a lamp's reach.
- **Actions:** `beam` (2b).
- **The Director's facts:** `lit:<id>` (the first time she was lit, kept) and `flashed:<id>`.
- **The check:**
  - a `beam` on a cast member in a game with no flashlight: a warning;
  - a `lit` naming no one: it fails;
  - a `flee` spot that isn't there: it fails;
  - `avoids` on someone a round's seeker has to reach a lit room for: a warning.

### 2e. In the Director: drag and drop

- **Build → People: *Feels the light*** (a card with the beam's drawing). Drop it onto a character (in the 3D view or
  the Scene tree), or click it with her selected, and she feels the flashlight. This object shows her **Light** rows:
  - *What she does*: nothing, backs off, freezes, flees, vanishes, covers her eyes, comes toward it, charges;
  - *After* (s), *How bright it must be*, *How far*, *Keeps away* (s);
  - *Her move*: a card from the Animate tab dropped on it, a new slot in her moves, `lit` ("In the light");
  - *Her face*, *A sound*, *Flee to* (a spot);
  - *Near her: the flashlight flickers* and *Near her: the lamps flicker*;
  - *Stays out of the light* (`avoids`).
- **Ready-made cards** in the same category for the common ones: *Backs off from the light*, *Freezes in the light*,
  *Drawn to the light*. Each is *Feels the light* with its choice already made.
- **Reactions dropped onto a character** (Turns to look at you, Flinches, Screams, Points at you, Waves) make the
  moment *when the flashlight is on her*; dropped on an area they're "when the player walks in", as now. Drop
  *Screams* on the maid and she screams when lit.
- **The Story tab:**
  - WHEN *the flashlight is on … (for … s)*, *… is flashed (… times)*, *… is in the light*;
  - ONLY IF: the same, as conditions;
  - THEN *… feels the light: …*, her reaction changed (she comes toward it on night 3).
- **The Watcher:** its *Sees the player* gets *Sees the flashlight* (how much faster).
- **Story Flow and Check** warn about a character who feels the light in a quest where the player has no flashlight.

### 2f. Checks

- **A TestRoom001 station**, on the desk and in Godot (TESTROOM, GDTESTROOM):
  - a flashlight with 20 s of battery dims, runs low, flickers, dies, and changes its batteries by itself from a set
    picked up;
  - the story's dim with a length comes back;
  - a cast member lit for half a second backs off, keeps away 4 s, and goes back to her spot;
  - a moment fires on `lit`, and one on `flashed` twice;
  - a watcher sees the torch from behind and catches the player;
  - the lamps near her flicker.
- **The Director (DIRECTOR):** the card driven onto a character, her rows, the Story tab's WHEN.
- **The props:** PROPGEN, THUMBS, GDPROPS (a torch lying on the floor, its lens lit).

## 3. The order

1. HORROR_TODO 0 (lights that dim and come back): the torch's dim and flicker use the same words.
2. The charge, the curves, batteries and the change (1a to 1e), on the desk and in Godot, the format and the check;
   the station's first half.
3. The beam on people and things: `lit`, `flashed`, the `beam` reactions, the light giving you away, `near` (2a, 2b,
   2d); the station's second half.
4. The lamps: `in_light`, `avoids` (2c).
5. The Director's parts, cards and words (1e, 2e), DIRECTOR.
6. The props (1f) and the sounds.

Each step is a commit with its checks.
