# Sound effects: the Studio's sound shelf

The story's sounds (the `sounds` table, the `sound` command, a scene's sound cues) can come from one shelf of CC0
sound effects that every game shares: doors, steps, knocks, glass, the house, paper, breaths and voices without words,
monsters, uncanny stingers, stings made of metal, and room tones. They're not part of the orchestra. The score room's
instruments are music (docs/MUSIC.md). These are the sounds a beat plays in the world.

## 1. The shelf

`Content/Studio/SFX/<category>/<name>.ogg`, with `Content/Studio/SFX/index.json` listing each sound: its file,
category, tags, length, whether it loops, its credit, its licence and where it came from. It holds 240 sounds in
about 6 MB.

```
python tools/sfx.py list creak                  what's on it (words filter by name, category or tag)
python tools/sfx.py fetch                       fetch and prepare what's missing (--force: all of it again)
python tools/sfx.py add FILE --name my_knock --category knocks --tags "knock, door"     one of our own
python tools/sfx.py check                       SFX ok (also in tools/check_all.py)
```

**Where they come from.** Only CC0 sources, or ours:
- **CC0 packs gathered on GitHub** (`lavenderdotpet/CC0-Public-Domain-Sounds`): Kenney's Impact Sounds and RPG Audio,
  rubberduck's "100 CC0 SFX" packs from OpenGameArt (doors, wood and metal, breaking and falling, creatures, loops,
  weird), and Ben Burnes's packs (fans and drones as room tones, books and paper, toolbox, record fuzz, knives,
  whooshes, NazdyNate's electromagnetic hums).
- **VCSL and VSCO-2 CE** by Versilian Studios: a bowed brake drum (the J-horror screech), cymbal and gong scrapes, a
  gong, chains, stone scrapes, glass breaking.
- **Built here from parts**, all CC0: three knocks (`knock_three`), slow and frantic knocking, steps heard through a
  ceiling (`steps_upstairs`, low-passed), steps coming closer, a floorboard creak, the power humming and cutting out,
  stings (`sting_short`, `sting_big`, `grab_sting`) and a close breath.
- **Made here from nothing** (ours): the answering machine's beep.

`fetch` checks out only the files it lists into `Saved/SFX/sources/` (a sparse clone). For each sound it trims the
leading silence, cuts it to its length with a fade, sets the peak to -1 dBFS and writes mono Ogg. A loop keeps its
start and fades both ends so it loops without a click. Most sites with sound effects (Freesound, OpenGameArt,
itch.io) can't be reached from a cloud session. Anything from them goes in with `add` on your machine.

## 2. In the story

A sound's `file` names the shelf with `sfx/<name>`:

```json
"sounds": { "knock3": {"file": "sfx/knock_three"}, "slam": {"file": "sfx/door_slam_01"} }
```

Any other `file` is the game's own sound under its Audio folder in Unreal (`/Game/Games/<Game>/Audio`), as before.
The story check fails a `sfx/` sound that isn't on the shelf. The Pilot's and the Sample's ten sounds all come from it.

## 3. On the desk

- **The Database's Sounds tab:** ▶ beside the file plays it. **From the shelf…** opens the shelf in a dialog: a
  search (door, creak, breath...), the categories as chips, and one row per sound with its tags and length. A click
  plays a sound, and **Use it** sets the file.
- **Play:** the `sound` command plays a shelf sound placed at its `at` (a thing or a cast member), quieter across the
  room and coming from its side, with the listener at the player's eye. A door's `slam` plays `door_slam_01` at the
  door, and the `knock` trick knocks its count on wood at its `at`. A sound of the game's own is logged, since it plays
  in Unreal.
- **The Watch:** a scene's sound cues play on their clip edges, placed at the cast member they name.
- `tools/director/sfx.js` holds all of this: `shelf()`, `playShelf(name, {pos, camera})`, `playStorySound`,
  `pickShelf`. PLAY checks that every shelf sound the Pilot names is served, decodes and plays.

## 4. Into Unreal (next)

The importer doesn't bring sounds in yet. When it does, a shelf sound goes to `/Game/Studio/SFX/<category>/<name>`
(shared, like the PBR shelf's sets), a game's own stays in its Audio folder, and the runner plays `sound` at its `at`.
