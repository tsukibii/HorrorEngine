# What to build next for horror: a motel game's list

The user (DECISIONS 2026-11-07) asked what a horror game set in a motel or a hotel lacks to keep 1 to 2 hours
interesting with our mechanics. Of the answer's ten, 7 (the ear to the wall: there are no voices, DECISIONS
2026-10-30) and 10 (a log of everything read) are dropped; "rest add as a list to implement". Nothing here is built
yet. Each item says what's there now, what to build, the props it needs and what checks it.
- The flashlight and the characters that feel its light are designed in full in docs/FLASHLIGHT_PLAN.md (items 11 and 12).
- Jump scares are researched in docs/research/jump_scares.md (item 13).

The numbers are the answer's, so 7 and 10 are gaps. The lights' fix (0) came from the first half of the answer.

## The prop standard

The user: "anything that doesn't exist like vending machine or whatever needs to conform to the standard of existing
props like logo-able cans etc and need to be easily customizable."

Every new prop below is a **prop generator recipe** (docs/PROPGEN.md) of a family made as the customizable ones are
(§25: the cans, bottles, cups, boxes, paper, books, pills, ware, charms, and the appliances' fake brands):
- **a family module with `CUSTOM = True`**: ✎ on its card, in the gallery's customizable filter;
- **real measurements**, each kind's sizes from real ones written in its module (a drinks machine is about
  1830 × 1000 × 750 mm, a motel room phone about 230 × 190 × 90 mm);
- **the maker's mark is a slot**: `brand` (a name in one of the fonts, `brand_font`, `brand_color`) or `logo` (your
  picture), as the appliance family's `brand_mark` does;
- **every other print is a slot too** (`<island>.<name>`: a front panel's art, a sticker, an instruction plate, a price
  card). Code draws it until your picture replaces it, in the picture editor or by the recipe's `pictures`, with a
  Krita template of each and the size it wants (§15, §17);
- **materials take PBR sets** off the shelf (`pbr`) or colours;
- **parts open where the real thing's do** (§26: a lid, a door, a receiver lifted), as nodes the runtime swings or slides;
- **sockets** for what glows or moves (an LED, a screen, a neon word, the tray a can drops into), named as the kit's
  little things name theirs, so a life's effects play on the prop (as the rice cooker and the kettle do), and
  **enhancers** (§14: glow) so Godot lights them;
- **variants are recipes made `from` a base**, with only what differs;
- **its kept picture and sticker passes** (`propgen.py thumbs`, §25), so your pictures are previewed on it before it's made;
- **made into the library** (`props/<name>`, a story's `asset props/<name>`) with its Godot `.tscn`;
- **its checks**: PROPGEN, THUMBS, PROPPAGE (a picture laid on it), GDPROPS.

Where the kit already makes the thing (a door, its handle, a bed: docs/KIT.md), the new part is the kit's, with its
`mats` slots and its presets, so the scene builder places it and its Paint paints it.

| New prop | Item | Kinds | Its slots (your pictures) | Parts that open, sockets |
|---|---|---|---|---|
| a landline | 2 | a motel room's push-button phone, a rotary phone, a front desk phone with line buttons, a wall payphone | the maker's mark, the room's card ("Room 108 · Front desk dial 0"), the payphone's instruction plate | the receiver lifted (a part); `bell`, `receiver`, `led` (the message light), `keypad` |
| a CRT monitor, a security camera, a recorder | 3 | a 14-inch monitor, a quad-split one; a box camera on a wall bracket, a dome camera; a tape recorder | the bezel's mark, the camera's sticker, the recorder's mark | `screen` (the CRT shader showing the feed), `led`, `digits` (the recorder's clock, as the rice cooker's LCD) |
| door number plates | 4 | brass digits, an enamel plate, a plastic plate, numbers painted on the door | the number (typed: text in a font), the plate's ground | — |
| a neon sign | 4 | VACANCY and NO VACANCY, the motel's name, OPEN | the words, typed; each word its own group | a light for each word (glow), so NO flickers alone |
| a Do Not Disturb hanger | 4 | card, plastic | both sides' words and pictures | — |
| a room key with a fob | 4 | a plastic diamond fob, a brass tag (the key family's `tag` grown) | the number, the motel's name | — |
| a motel bed on legs | 5 | the kit's `bed` with `legs` and the clear height under it (300 mm or more), a valance or none | its `mats` | the space under it is the hiding place's eye |
| a bathtub and a shower curtain | 5 | a tub with a curtain rail; the curtain family's `shower` kind (rings, vinyl, mould at the hem) | the curtain's print | the rings on the rail, drawn open or shut |
| a door chain | 6 | the kit door's `chain` (a track and a chain, brass or steel) | its `mats` | the hook |
| an envelope | 6 | the sheet family's envelope kind | the address, the stamp | the flap |
| a vending machine | 8 | drinks (cans and bottles behind the glass made from the can and bottle recipes, so they wear your logos), snacks (spiral rows), cigarettes | the front's art, the maker's mark, the price cards, the button labels | the lit panel (glow), the coin slot, the `tray` a bought can drops into, a hum |
| an ice machine | 8 | a top-loading cabinet, a dispenser | the maker's mark, the ICE sign | the bin's lid (a part), the chute (`drop`) |
| a washer and a dryer | 8 | front-loading coin machines | the maker's mark, the dial's print, the coin box's plate | the door (a part), the drum (turning), `led` |
| a housekeeping cart | 8 | shelves, a linen bag, a bin bag | its sign | towels (the clothes family's towel), bottles (the bottle family's labels), the bag (the sack family) |
| an ice bucket | 8 | the ware family's `bucket` kind | the motel's mark | the lid (a part) |
| a flashlight and batteries | 11 | FLASHLIGHT_PLAN §1f | FLASHLIGHT_PLAN §1f | FLASHLIGHT_PLAN §1f |

## 0. Lights that dim and come back (small; first) — built 2026-11-07

**Built** (DECISIONS 2026-11-07, later): as below, with one change: the seconds a change takes are `over`, not `fade`
(`fade` is the screen's own verb, and an action can have only one). TestRoom001's station 4 (the bulb sags to a fifth
and comes back by itself; a lasting dim undone by `on`) and station 5 (the store's lamps die one by one toward the
player, back together, the one that was off staying off), on the desk and in Godot.


**Now**
- `light` sets a light on, off, flickering or dim; it picks one light, or every light in a room.
- **Dim and flicker are for good.** Dim is 35% and a flicker 0.6, and `on` brings neither back (play.gd `light`,
  runtime.js `light`).
- `lights_die` darkens a whole room (`room`) and turns every light in it on after, even one the player had switched off.
- **A Director state's light isn't let go.** When the state's condition stops holding, the light stays as the state
  left it (brain.gd `_states` only visits what some state still sets).

**To build**
- `light` takes:
  - `to`: how bright, 0..1 (dim's 0.35 when left out);
  - `secs`: how long, then back to how it was (left out: it stays);
  - `over`: seconds to dim and to come back (0 snaps; not `fade`, the screen's own verb);
  - with `flicker`, a `mode` (the lamps' own: fluorescent, dying, candle, pulse, custom).
- `on` brings a light back to its own brightness and its own flicker, undoing the story's dim and flicker. `normal`
  does the same without switching it on.
- `lights_die` takes `light` (one light) as well as `room`. It takes `order: "toward"`: the room's lights go out one by
  one toward the player (TRICKS.md's "lights dying, one by one toward the player"). Each light is put back as it was.
- A Director state lets go of a light: a light no state sets any more goes back to how the level has it.
- **The Director:**
  - a Scares card *A light dims* (one light, or the room it's dropped in; how dark; for how long; the fade);
  - *The lights die* with a light picker and *one by one*;
  - the Story tab's Light row with *how bright*, *for (s)* and *fading over (s)*.
- **Where:** the desk (runtime.js, actions.js), Godot (play.gd, actions.gd), STORY_FORMAT §4, story_check, commands.js
  and commands.json (`commands_json.mjs`), TestRoom001's station of lights.
- **Words the palette offers that Godot can't play:**
  - `loop_hall`: item 1.
  - `cut_away`: a forced look at a thing, then a line. The eye is never turned for the player (DIRECTING §1; the
    `glance` and `cutaway` seams were deprecated on 2026-10-29), so it's taken out of the palette, the check pointing
    to `focus` (a soft lock) and `lookat` (a slow turn asked for on purpose).
  - `stalker`: patrols and chases are `behave` and the rounds now. Taken out of the palette, the check pointing to them.

**Checks:** TESTROOM, GDTESTROOM, DIRECTOR, CMDS.

## 1. The walkway that loops (medium)

**Now:** `loop_hall` (`trigger`, `back_to`) is a word (TRICKS.md: "walk through a door and be back at its start, one
thing changed each time"). The story check knows it; both runtimes only log it.

**To build**
- **A seamless step.** Walking through the loop's doorway (an area) carries the player to its twin (`back_to`) with
  their offset, height and look kept, and the flashlight's beam with them: no cut and no fade. Godot moves the
  player's transform by the twin's from the doorway's; the desk does the same.
- **The passes counted** (a `count`), so the story knows the third pass.
- **One change a pass, applied out of sight** (the `swap` rule: only what isn't seen):
  - a list of changes, in order or at random: `show`, `hide`, `state`, `light`, a plate's number;
  - the way out is a condition the loop lets go on: the player turning back on seeing the change, a flag, a pass count.

  Our own rules, not another game's.
- **Where it loops:** a motel walkway of rooms in a row is the twin of itself (the street builder's motel copies,
  `rows`), as is a hotel corridor made in the scene builder.
- **The Director:** a *Loop* card (Scares, or a new Tricks category):
  - dropped on a doorway, its twin picked (a spot);
  - the changes are the Story tab's THEN rows, one a pass;
  - the way out is its ONLY IF.

**Props:** the door number plates (4), so a pass can change a number.

**Checks**
- TESTROOM and GDTESTROOM: a station of three passes, a change each, out on the third.
- The step pictured: the frames either side of it alike, as GDCULL compares two pictures.

## 2. An analogue phone (small)

**Now:** the `phone` life is a mobile's (screen, LED, buzz: `off`, `lit`, `ringing`), and the kit's phones are a
smartphone and a flip phone. The user wants none in the pocket ("if we do use them we will have more analogue
ones", DECISIONS 2026-10-27).

**To build**
- **A landline life**, with these states:
  - `idle`;
  - `ringing`: a bell, the receiver rattling in its cradle (lifefx's rattle);
  - `answered`: the receiver lifted, the call's lines typed out with the caller's name;
  - `hung_up`;
  - `dead`: no tone, "the line's dead".

  A ringing phone left `secs` is missed.
- **Calls as conversations.** In the Director a call is a conversation of the caller's (`talk`), played at the phone
  when it's answered: the first whose `if` holds, `heard:<call>` once it's through. On the desk it's the phone's
  `calls` in order with an `if` each, as a book's entries are. The story rings a phone with its `state`.
- **Dialling** works as the code lock's keypad does (`use: code`): a number dialled sets its flag ("dial 0 for the
  front desk").
- **The message light**: a red LED blinking when a call waits for the player coming in.
- **A payphone** in the car park: the same life, coins as an item (`needs`).
- **The Director:**
  - a *Landline* part (Electronics), its calls typed in This object as a book's text is (`===` between calls,
    `@if` lines);
  - the Story tab's WHEN *the phone is answered / hung up / missed*, THEN *the phone rings*.

**Props:** the landline family (a room phone, a rotary, a front desk phone, a payphone) to the standard.

**Checks:** TESTROOM and GDTESTROOM (a station: the phone rings, is answered, its call plays, it's hung up, a number
is dialled); the story check (the life's states and acts).

## 3. CCTV in the office (medium)

**Now:** none. docs/research/chillas_art.md put CCTV monitors and the anomaly loop aside as "a game of their own
each, when one is built round them", and a motel's night shift is that game. Two pieces exist: the look plugin's mirror draws a second camera into a texture
(mirror.gd), and the CRT shader draws a screen's phosphor and scanlines, a picture or snow (crt.gd).

**To build**
- **Cameras:** a spot with a lens (`use: camera`), its name and its field of view; on the desk, a marker.
- **A monitor** (`use: cctv`):
  - sat at, its screen fills the view in the CRT's look, with the camera's name and the time burned in;
  - ← and → or a click switch cameras, and Esc gets up;
  - only the feed shown is drawn (a SubViewport, one at a time: the budget).
- **Seen only on camera:** a thing or a cast member with `only_on: cameras` is drawn on the cameras' render layer
  alone, which the player's eye doesn't draw. The same layer makes something seen only in a mirror (item 13).
- The story hears `{"watching": camera}` (it holds while that camera is on the screen) and sets the monitor's snow and
  rolling bar by its `state`.
- **The Director:** *Camera* and *Monitor* cards (Electronics), a camera's view previewed in the editor, and *Seen only
  on camera* as a switch on a thing or a character.

**Props:** the CRT monitor, the camera and the recorder, to the standard.

**Checks:** GDTESTROOM (a station: sat at the monitor, cameras switched, someone on camera 3 who isn't in the room);
a lookshot of the monitor.

## 4. Numbers and signs (small)

**Now:** no words on walls (the stair stacks' floor numbers were skipped: "words on a wall need a texture",
DECISIONS 2026-11-06). The street builder's signs are boards that glow. The prop generator writes words in its fonts
(`paint.py` text, `designs.py`).

**To build:** the props below, and the story changing them:
- a plate's number swapped (its states are its numbers, or a `swap` of two plates);
- the sign's words lit by its `state` (VACANCY, NO VACANCY);
- the hanger moved to another door (`move`).

The street builder's motel takes its plates and its sign by the rooms' numbers.

**Props**
- door number plates;
- the neon sign: letters as tubes from the font's outlines, each word a light group of its own, so one word flickers
  alone with the lamps' flicker modes;
- the Do Not Disturb hanger;
- the room key with its fob;
- a room's rules card ("Check out 10 AM": the sheet family).

**Checks:** PROPGEN, THUMBS, GDPROPS (the neon lit and off).

## 5. Hiding under the bed, behind the shower curtain (small to medium)

**Now:** `hide` and `locker`: a wardrobe or a locker, the eye 1.6 m up, looking out through the doors' slit
(`see_through`).

**To build**
- **New hiding kinds:**
  - `under`: lying under the bed, the eye 0.2 m over the floor, the frame above it, the look kept low; the doorway in
    view, her feet passing;
  - `curtain`: standing in the tub behind the curtain, the cloth between the eye and the room, her shadow through it
    (the curtain seen through from inside by `see_through`).
- **A round's seeker checks the hiding places** by her own rules (`rule`), looking under the bed with her
  `look_under` move (KIMODO.md's list has it).
- **The Director:** the Hiding place part's *How*: in a wardrobe, under a bed, behind a curtain.

**Props:** a motel bed on legs; a bathtub with its rail; the shower curtain.

**Checks:** TESTROOM and GDTESTROOM (station 12's hiding gets the two kinds), PLAY.

**Built for games made by hand** (2026-11-08, night): the starter's `seat.gd` with the pose `hiding` (crouched in a
corner, E there and back up) and `searcher.gd` (she hears your noises, `noise.gd`, and checks the places to hide
nearest them from each one's `Approach`, through its `Via`; the close pass; held breath, Space, halving her chance;
a gasp past 8 s; pulled out when found); tutorial v2's linen closet. Not yet the story format's: its `hide` and
`locker` have no breath, no close pass and no noises, and the `under` and `curtain` kinds above are still to build.

## 6. The door tried from outside, its chain, something slid under it (small)

**Now:** a `door` locks, unlocks, opens, closes and slams; there's `knock`, the latch and the peephole. A note can be
shown with a sound.

**To build**
- `door` `rattle`: the handle turning from the other side, the leaf straining against its latch or chain for `secs`,
  the sound off the shelf.
- **A door chain** (a kit door's `chain`): hooked, the door opens 10 cm and stops. A click hooks or unhooks it as the
  latch does; `chained` holds while it's on.
- **Slid under the door**: a note, an envelope or a key card slides in from the gap with paper's sound and is readable
  where it stops (`show` with `slide`).
- **The Director:** Scares cards *Someone tries the door* and *Something under the door*, dropped on a door.

**Props:** the chain (the kit door's), the envelope (the sheet family).

**Checks:** TESTROOM and GDTESTROOM (a station by the motel room's door), DIRECTOR.

## 7. ~~The ear to the wall~~

Dropped: there's no voiced dialogue (DECISIONS 2026-11-07).

## 8. Motel things that come alive (small each)

**Now:** there are lives for the kitchen's things, the TV, the clock, the phone and the fridge. The street builder's
vending machines are street things with no life. The footsteps are the player's and the cast's (steps.js, play.gd).

**To build**
- **New lives:**
  - **the vending machine**: lit, humming; *Buy* with a coin (`needs`) drops a can into the tray, a pickup of the can
    recipe it sells; at night it drops one by itself;
  - **the ice machine**: its hum, ice dropping now and then (`secs` at random), its bin's lid;
  - **the washer and the dryer**: running (the drum turning, the rumble, a beep when done), running with nobody there.
- **The housekeeping cart**: a moveable on wheels, moved between nights by the story.
- **Footsteps with nobody**, above the ceiling or along the walkway: a hidden cast member walking a `path` still
  sounding her steps by the floor, or a `steps` word (a path, a floor, a pace).
- **The Director:** a part for each (Electronics: Vending machine, Ice machine, Washer, Dryer) and *Footsteps pass* in
  Scares (dropped on a path).

**Props:** the vending machine, the ice machine, the washer and the dryer, the cart and the ice bucket, to the
standard; the machine's cans made from the can recipes.

**Checks:** GDTESTROOM (a station: a can bought, the ice dropping, the washer running), the story check (the lives),
PROPGEN, GDPROPS.

## 9. Being heard (medium)

**Now:** the cast only see (`sees`: angle, range, a ray, a meter; play.gd `sees`, `watch`). The runtime keeps every
sound played with its place and loudness (`sounds_heard`).

**To build**
- **`hears` beside `sees`.** She hears the player's own sounds:
  - steps by the floor and the pace (running is loud, crouching quiet);
  - a door slammed, a thing dropped or knocked over;
  - a phone the player left ringing.

  Their loudness falls with distance and halves through a wall or a shut door.
- **What she does:** she comes to look where it was (`behave` `go` to the place, a look round, back to what she was
  doing). The story hears `{"noticed": cast}`; not `heard`, which the Director uses for a conversation heard through.
- **Off unless set**, so a game stays as simple as it is.
- **The Director:** *Hears the player* on the character beside *Sees the player*; the Watcher gets both.

**Checks:** TESTROOM and GDTESTROOM (a station: running past her door brings her out, crouching doesn't).

**Built for games made by hand** (2026-11-08, night): the starter's `noise.gd` (the player's steps, a run, a door, a
gasp, each a loudness; heard by whatever's in the group `hs_listener` as far as its ears reach) and `searcher.gd` (she
listens, then comes to look: the places to hide nearest the noise) with `chase.gd` (seen, she's after you); tutorial
v2's corridor. No crouch in the starter yet, and no falloff through walls: the format's `hears` is still to build.

## 10. ~~A log of everything read~~

Dropped (DECISIONS 2026-11-07).

## 11. The flashlight on batteries — built 2026-11-07 (but its props)

docs/FLASHLIGHT_PLAN.md §1.

## 12. Characters and things that feel the light — built 2026-11-07 (but `avoids`)

docs/FLASHLIGHT_PLAN.md §2.

## 13. Jump scares

docs/research/jump_scares.md §8, from what designers say and the startle's numbers. The rules: variety, timing and
silence count, not volume; the player finds the scare (no forced look); the last half second before a sting is silent.

**Now:**
- ~~`music` only logs on the desk and in Godot, and no room tone plays~~ (built: 1 below);
- `glimpse` isn't kept to the edge of the view;
- `swap` fires after 8 s even in view;
- `seen` ignores walls and size;
- `hud.shake()` is empty;
- nothing is random, and nothing spaces scares in play.

**To build** (each small but the first two):
1. **Sound that can go quiet** (medium). **Built** (DECISIONS 2026-11-07, later; but the stings' attack measured):
   the moods' beds (`tools/score/moods.mjs`) by `music`, a room's `tone` off the shelf (`game.tone`), `hush` (the
   beds down over all but the last 0.5 s, that half second silent, back slowly) and the jumpscare's `quiet`
   (`game.quiet` for every one); Godot's `beds.gd`, the desk's `play/beds.js`; TestRoom001 stations 10, 15 and 16.
   Still to do: the shelf's stings measured for their attack.
2. **A better "seen"** (medium). Bounds, walls and the light on it, through mirrors and peepholes too. An edge test
   for glimpses (25 to 50° off the centre, gone when looked at). A `swap` that never fires in view. Triggers *turned
   round* and *seen, then gone*.
3. **Scares that wait for the eye:** a `jumpscare` held until its spot is looked at, or placed where the player looks.
   **Built for games made by hand** (DECISIONS 2026-11-08, night, later): the starter's `cue.gd`, its spot in a
   region of the frame with a tolerance, on a task, sitting or lying, for so long, then someone for a moment. Still
   to do: the story format's `jumpscare` (the desk and the export).
4. **Figures that move unseen:** mark by mark toward the player while unseen, and while the lights are out.
5. **Chance and variety:** a random wait, a pool of scares drawn without repeats and kept with the save, and the check
   warning at the same trick three times in a night.
6. **Spacing in play** as the check spaces the flow, and a declared fake-out the check lets its real scare follow.
7. **Sound placed by the player** (`at: "behind"`), and footsteps that keep the player's pace from behind and stop
   when they stop.
8. **The flinch:** a 0.1 s, 2° head jolt with the sting (TRICKS.md) and a moment of the tape's glitch; never a turn.
9. **Death that stays scary:** the caught scare varied, short, and back in play fast.
10. **Settings and safety:**
    - a *Scares* setting (Normal or Reduced);
    - a flash limit of three a second on every flicker;
    - an optional content warning at the start;
    - a check counting flashes in the playtests' frames.
11. **A scare log** from the playtests, to read a night's curve off.

**The Director:** Scares cards for the new ones:
- *A glimpse at the edge*;
- *Closer each time you look away*;
- *Closer when the lights come back*;
- *Waits until you look*;
- *Footsteps behind you*;
- *A face at the peephole*.

**Checks:** TESTROOM and GDTESTROOM stations, and the scare log read by them.

## The order (mine)

1. **0** (the lights: small, and it fixes what's wrong).
2. **11 and 12** (the flashlight and the light).
3. **6**, **4**, **2**, **5** and **8** (the small ones).
4. **13** (the jump scares).
5. **1** and **3** (the loop and the CCTV).
6. **9** (being heard).

Each is a commit with its station in TestRoom001, so the desk and Godot are checked the same way.
