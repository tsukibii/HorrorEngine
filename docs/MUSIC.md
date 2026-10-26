# Music: the score room

The score room (`tools/score/`) writes a game's music cues with the sampled orchestra we lifted from Woohill's living
music: horror piano and strings, K-drama comedy and romance cues that score what the character is doing, and the
romance-horror cues between them. You make variations, listen, and keep your favourites in a palette. The director's
desk and the game will read that palette later (§5).

It's built on research into K-drama and horror scoring (docs/MUSIC_RESEARCH.md). The cue catalogue is generated from
the code in docs/MUSIC_CUES.md.

## 1. Run it

```
python tools/score/serve.py        then open http://127.0.0.1:8791
```

The server uses plain Python, no installs, and listens on 127.0.0.1 only. The samples load from
`Content/Studio/Music/samples/`, one instrument at a time, the first time a cue needs it.

**Checks** (each ends `<NAME> ok`):
- `node tools/score/check.js` (`SCORE ok`). It runs every cue over 12 seeds, every choice, the ends of every number
  and the variations. Notes must sit inside each instrument's samples and the same seed must give the same notes.
  It also checks the palettes on disk and reports any favourite whose notes have changed. `--catalogue` rewrites
  docs/MUSIC_CUES.md.
- `node tools/score/pagetest.js [shot.png]` (`SCOREPAGE ok`) runs the page in headless Chromium: every cue,
  variations, keeping, the sequence, audition, a WAV with sound in it, and MIDI. It needs Playwright
  (`PLAYWRIGHT=<path to the package>` if it isn't installed here).

## 2. Using it

1. **Pick a cue** on the left. The filter searches labels, uses ("her room", "the turn", "cute") and references.
2. **Set it up.** The key and mode, tempo, length and the cue's own settings are on the panel. **Play** (Space)
   plays them. The 🎲 button keeps the settings and changes the seed, which gives other notes.
3. **Make variations** (V). This writes N variations around the settings. **Spread** sets how far they stray: low
   gives new notes with numbers nudged, high gives anything in range. Each card shows what changed, a piano roll
   (instrument colours, red lines on the hit points) and its length, key and tempo.
4. **Listen.** Press 1 to 9 for a card, click a roll to play from that point, or **Audition all** (A) to play every
   card in turn for the number of seconds given.
5. **Keep what you like.** Use ★ Keep, or Shift and the card's number. **More like this** makes the card the new
   settings and varies them again. That's how you home in on a cue.
6. **The favourites** (right) are saved to the palette as you go. Each has a name, stars, what it's for, a note,
   ▶, Open (its settings), Vary, MIDI, WAV, **Bake** and + Seq. Bake renders the WAV and MIDI into the palette's
   `Music/renders/` folder, ready for Unreal.
7. **The sequence strip** chains favourites the way a scene plays them (sneak, then the fall, then flustered). Each
   cue has a gap before it; a negative gap overlaps. Play it, keep it, bake it.
8. **Score a scene** works from what the character does. Write one action a line, a time and what happens:

   ```
   0 sneak
   4.2 trip
   5.4 blush
   9 slow motion romance @scratch
   14 awkward
   ```

   Each action finds a favourite first, by its name and uses (more stars win a tie), then a cue by its id, label or
   uses. The cue's hit lands on the action's time, so the fall's thud falls on 4.2 s.
   - A cue that starts on its action starts there instead. These are the sneak, the waltz, the countdown and the
     ending, whose hits come along the way or at the end.
   - Each part ends where the next begins: cut (trimmed with a short release), `@ring` (it overlaps the next) or
     `@scratch` (a tape stop).
   - The list under the roll shows what each line became and where it starts.
   - Keep the scene in the palette, play it, bake it.

   This is how the desk will score a scene from its clips (§5).

**Palette** (header) chooses the Studio palette, which every game may use, or one game's own palette.
**Played in** chooses the room the music is heard in: bedroom, hallway, basement, closet and the others. It's the
reverb the Woohill engine traces from the room's walls and their materials, and a render uses the same room.

## 3. What every cue shares

- **The notes come from the cue, its settings and a seed.** The same three always write the same notes
  (`writeCue`, seeded). A favourite is just those three, so a palette is a few kilobytes and plays anywhere. Each
  favourite also keeps its notes' fingerprint (`print`). If a generator changes later, the page marks the favourite
  "changed" and check.js lists it.
- **Level (dB).** This is how loud the cue sits against the others, set at the master after the limiter. A dread
  bed is at -14, a sting at 0 and comedy around -4. Horror needs headroom: a scare only lands if the floor under it
  is quiet (research §5.2). For a normalised stem, set the level to 0 before baking.
- **Corruption (0 to 1)** bends any cue towards wrong, applied after the cue writes its notes:
  - 0.2: a slight drift in the tuning, and now and then a note slips a semitone flat.
  - 0.4: a tritone drone underneath, and the tempo sags like a spring running down.
  - 0.6: notes go missing.
  - 0.8 and over: long notes bend apart at their ends.
  This is the research's "corruption ladder" (X2), turned into one knob that works on any cue: her theme, the slow-mo
  romance or the cute walk.
- **She's watching (0 to 1)** adds a high tremolo cluster you feel more than hear, with a faint glockenspiel ping
  now and then. It's for a comedy scene she is secretly watching (research X6).
- **The game's theme (a number, 0 for each cue's own tune).** A K-drama keeps one theme and plays it everywhere
  (research §1.4: Crash Landing on You's piano theme turning into the orchestra, Goblin's song at every big beat).
  The header's **theme** sets it for the palette. 🎲 tries another, ▶ plays it alone (the cue "The game's theme
  (plain)"), and fresh settings of a cue that quotes it take it.
  - **The tune:** 8 bars. Two phrases with a repeated idea, the first ending on the fifth, the second walking down by
    step to home.
  - **The rhythm** fits each meter, so the tune is recognisably the same in 4/4, 3/4 and 6/8.
  - **Seven cues quote it**, each in its own way:
    - Music box: in 3/4, drifting and winding down.
    - Her theme: with its one wrong thing.
    - Slow-motion romance: piano first, the strings take it over half-way.
    - Sad flashback: in minor.
    - Ghost lullaby: on the flute in 6/8.
    - Sweet, then wrong: until the turn.
    - Ending: slowed, and turning minor on the bad ending.
  - Pick one number per game and its whole palette shares a tune.
- **Hit points.** Each cue marks where the picture's action lands (the fall's thud, the sting, the turn, her
  answer). The desk will line them up with clip edges (§5).

## 4. The cues (54)

The full list, with settings, is in docs/MUSIC_CUES.md. Research §4 designed 32 cues; this is what was built and how
it differs. The twelve Expanded orchestra cues, written for the added instruments, are in §7.2.

**Horror (16):**
- Dread drone (H1)
- Stalker ostinato (H2: odd metres, a climbing pedal)
- Music box gone wrong (H3: drift, wrong note, wind-down)
- Riser (H6: ends in a cut or a sting)
- Jump-scare sting (H4)
- Heartbeat (H5's lub-dub)
- Hiding (H8)
- Chase (H5)
- Death (H10)
- Behind you (H7: a reversed piano swell)
- The turn (X3: the smile drops)
- The house settles (creaks and knocks as music)
- Found you (H9)
- The lull (H12: scare, nothing or a harmless knock, at an unpredictable time)
- Ritual (H11)
- Endless rise (§2.7: a Shepard-like climb of staggered string glides, ending in a cut, a sting or nothing)

**K-drama (14):**
- Sneak (K1, with freezes)
- Flustered (K2)
- Slapstick fall (K3: harp run, slide whistle or xylophone; thud, bonk or crash)
- Cute (K4)
- Smug (K5: the mock-baroque strut)
- Shock (K6: dun dun dun)
- Slow-motion romance (K7: royal road, pop, canon or doo-wop; the step up at the end)
- Heart flutter (K8, standing in for K13)
- Sad flashback (K9)
- Comic chase (K10)
- Awkward (K12)
- Triumph (K11)
- Womp womp
- Punchline (K14: ba-dum-tss, ta-da, bonk, boing)

**Romance horror (12):**
- The game's theme (plain): the tune alone over plain chords, to choose one by.
- Her theme: a love theme with one wrong thing in it (an augmented chord, a flat note or a cluster) that comes
  back every phrase.
- Sweet, then wrong: it slides down, bends, stops dead or turns into a music box.
- Yandere waltz (X1, with the dread under the floor).
- Pounding heart: love or fear, a major 7th against a minor 9th.
- Timed choice: the clock under a 30-second reply.
- Her answer: warm, cold, uncanny or hurt, after the player's reply.
- Close moment: almost nothing, room for a whisper.
- Ending: good, neutral or bad.
- Confession (X4): one key change too many.
- Ghost lover's lullaby (X5).
- Playground game: Squid Game's childish tune with a kept wrong note.

**String colours and the tape stop** (research §2.5 and §1.3). A note can carry a `tone`, a filter chain on that
one note:
- `ponticello`: glassy, brittle; the tremolo high-passed with a resonant peak.
- `tasto`: veiled.
- `harmonic`: only the top; pure and thin.
- `legno`: the wood of the bow; a dry click on a short pizzicato.

The hiding cue's tremolo is ponticello (its "glassy" setting), its clock is col legno, and it drops out when she is
closest. Behind you uses harmonics and ponticello. The dread drone's top rub turns to harmonics when the dissonance
is high, and the "she's watching" layer is ponticello.

`t.tapeStop(at, dur)` makes every voice sounding then sag to a quarter of its pitch and fade, like a record dragged
to a stop. It's the record scratch in Awkward ("record scratch"), the parody ending of Slow-motion romance
(Weightlifting Fairy's joke: the swell at its height, then the needle comes off) and a "tape stop" turn in Sweet,
then wrong.

**Not built yet** (from the research):
- Pre-triggering strings and horn by their attack time, so the perceived onset meets the hit point (§5.4). Today a
  string note starts on the frame and swells after it. Stings use fast-attack instruments (piano, timpani, drums,
  pizzicato), as the research advises.

## 5. Plugging it into the director (later)

The page is built to be lifted into the desk. The engine is plain scripts with no build step:

| Files | What they are |
| --- | --- |
| `00` to `40` | Woohill's core |
| `50-kit` | Cues, `writeCue`, variations |
| `6x` | The cue families |
| `70-player` | `Engine.play`, `renderWav`, `midi`, `chainTakes` |

The desk loads the same scripts and the same palette. The plan:

1. **The desk scores a scene the way the scene panel does** (`sceneTake(actions, favourites)` in `70-player.js`).
   Its actions come from the clips: a clip's motion name or a stitch's mechanic ("hide", "found", "trip", "her
   answer") at the clip's start, so nothing is anchored to an absolute time.
2. **story.json names favourites.** A scene, a stitch, a reply or an ending gets a `music` cue that names a
   favourite by id (`{fav: "f…", at: "clip:<id>:start" | "hit:<label>", level}`). Cues ride on clip edges, never on
   absolute times (CLAUDE.md, "timing is elastic"). A hit point lines up with a clip edge: the fall's thud on the
   landing clip's start, the sting on the scare's first frame. The format word and its check come in one commit
   with STORY_FORMAT.md.
3. **The desk's animatic plays them** with the same engine and the room's acoustics (the story's `acoustics` field
   maps to a hall: bedroom to `room`, corridor to `corridor`).
4. **Unreal plays baked stems.** Bake writes WAV and MIDI into `Content/Games/<G>/Music/renders/`, and the importer
   brings them in as Sound Waves. Live procedural music in Unreal (MetaSounds playing the cue generators) is a later
   choice; baked variations already sound different each time if a cue keeps two or three favourites and the game
   picks one.
5. **The game's rules come from the research** (§5):
   - Short cues often, each with a cooldown so a theme doesn't wear out.
   - Silence before a scare, of an unpredictable length.
   - Comedy synced tight and horror synced sparse.
   - Music ducked 6 to 10 dB under the Japanese lines.
   - The full romance swell saved for the big beats.

**The palette format**, from `Content/Studio/Music/palette.json` or `Content/Games/<G>/Music/palette.json`:

```json
{ "format": "horrorstudio-score-palette", "version": 1, "scope": "studio", "saved": "2026-10-21T08:00:00",
  "favourites": [ { "id": "fmh0x2a1", "name": "Her theme 1", "cue": "her_theme", "family": "crossover",
      "params": { "key": {"tonic": 7, "mode": "ionian"}, "tempo": 70, "len": 24, "wrongness": "augmented chord",
                  "amount": 0.4, "strings": 0.4, "gain": -8, "corrupt": 0, "watched": 0 },
      "seed": 1, "secs": 27.1, "hits": [], "print": "8c1f02aa", "space": "room",
      "uses": ["her theme", "romance"], "stars": 3, "note": "", "made": "2026-10-21" } ],
  "sequences": [ { "id": "s…", "name": "trip and blush", "items": [ {"fav": "f…", "gap": 0}, {"fav": "f…", "gap": -0.3} ] } ],
  "scenes": [ { "id": "c…", "name": "the cafe trip", "text": "0 sneak\n4.2 trip\n5.4 blush", "made": "2026-10-21" } ] }
```

Every palette save keeps the previous file in `Saved/Score/<scope>/history/` (the last 30).

## 6. A listening list

These are works whose music fits our instruments, to listen to with the score room open. Research §1.4 and §3 have
more, with sources. Titles are given only where we're sure of them.

| For | Listen to |
| --- | --- |
| The yandere's sweetness gone wrong | *Squid Game* (Jung Jae-il): "Way Back Then" (recorder, snare and claps, the kept wrong note). *Doki Doki Literature Club* (Dan Salvato): "Your Reality", and how its cheerful themes come back warped |
| Music box and lullaby | *Higurashi*'s "you". *Pan's Labyrinth* (Javier Navarrete): the lullaby, "Long, Long Time Ago" |
| Strings alone as horror | *Psycho* (Bernard Herrmann): the main title and the shower cue. Penderecki's *Threnody* (the clusters under *The Shining*) |
| The stalker's two notes | *Jaws* (John Williams), main title |
| Grief in horror | *Silent Hill 2* (Akira Yamaoka): "Theme of Laura" and "Promise (Reprise)" |
| Irony and class: noble music that turns funny or sinister | *Parasite* (Jung Jae-il): "Belt of Faith" |
| The K-drama ballad underscore | *Crash Landing on You*: "The Song for My Brother" (a piano theme that becomes the orchestra). *Goblin*: "Stay With Me" (the couple song in every big beat). *Descendants of the Sun*: "Always" |
| K-drama comedy | *Strong Woman Do Bong-soon* and *Business Proposal* scenes. Watch how the pizzicato sneak, the slide and thud and the freeze land on the frame (research §1.3 notes this vocabulary is pieced together, not from a Korean source) |
| Quiet intimacy | *Your Name* (RADWIMPS): the piano pieces. *To the Moon* (Kan Gao): "For River" |

## 7. The added instruments

Woohill's orchestra is still what every cue above was written and mixed with. Beside it are 28 more instruments from
the same CC0 libraries, VSCO-2 Community Edition and the Versilian Community Sample Library (VCSL), both by Versilian
Studios. `python tools/score/fetch_samples.py` fetches them (`--list` shows what's there, `--only KEY`, `--force`). It
checks out only the folders it needs into `Saved/Score/sources/`. It measures each sample's pitch, decides the
octave by a vote over the whole set (the libraries name octaves two ways), trims the sample, makes it mono Ogg and
matches each instrument's loudness to one of Woohill's (`calib_db`). Woohill's instruments are never touched. Every
added instrument carries a `best` in `instruments.json`: when it works best.

### 7.1 The string sets: which strings play

Every cue writes its strings as three parts: `strings` (sustain), `trem` (tremolo) and `pizz` (pizzicato). The
header's **strings** picker chooses which samples play them. The notes stay the same and only the players change, so
a favourite keeps its fingerprint. A favourite remembers the set it was kept with and has its own picker. Open and
Vary bring that set back to the header. Changing the set while a cue plays restarts it from where it was, so you hear
the swap at once.

| Set | What plays | Works best for |
| --- | --- | --- |
| Section (the original) | Woohill's VSCO-2 violin and cello sections | anywhere; everything was mixed with it |
| Full section | the section, violas in the middle (C3 to G5), a double bass under C3 | dread beds, the chase, death, the ritual, the big romance swell (muddy in a small room) |
| Low strings | cellos, violas over A5, the double bass under C3; no violins | hiding, grief, the house at night, a sad flashback |
| Solo | one violin from G3 up, one double bass below | a lament, the lullaby, her theme alone, the close moment |
| Eerie | a bowed psaltery from A#4 up, one shaking violin for the tremolo; the rest the section | ghost cues: the lullaby, behind you, the music box |
| Glass | a bowed vibraphone from A3 up, wine glasses from D#5; the rest the section | a long held chord under a ghost, the moment before she appears |

The cue panel shows the set's note. When the cue suits another set, it says which and why ("Suits this cue: Low
strings (muffled, as if heard through the wardrobe door)"), and **Use it** switches to it. That's `STRING_ADVICE` in
`js/32-strings.js`. A set's members each play the notes inside their own range. Where they overlap they stack (the
full section's violins, violas and basses together), about 2 dB a member quieter so the mix stays put. Notes
outside every member's range go to the set's fallback, or else the nearest member.

### 7.2 The Expanded orchestra: cues for the new instruments

The original 42 cues keep their instruments: Woohill's orchestra, with the string sets to change who plays the
strings. The new instruments have twelve cues of their own, the **Expanded orchestra** family (`js/66-expanded.js`).
Each has the shared settings: level, corruption, she's watching, and the game's theme where it quotes it.

- **Glass ghost**: rubbed wine glasses high up, a bowed vibraphone chord shifting under them, a faint double bass.
  The glasses gather into a cluster where she's closest (hit: she's here).
- **Psaltery haunting** (theme): a slow, wavering tune on the bowed psaltery, its long notes sagging at their ends,
  over bowed vibraphone chords and a double bass drone. A ghost humming.
- **Double-bass dread**: a double bass pedal with tremolo swells, the tuba under it, a bassoon and a low clarinet
  creeping by semitones, a bowed brake drum now and then. Something big below you.
- **Brass falls**: a low trombone chorale swells, then falls away (one big fall, three, or a cascade) over a tuba
  pedal, a buzzing growl under the biggest one (hit: the drop).
- **Metal screech (J-horror)**: a bowed cymbal, a bowed brake drum and a gong scrape rising into a struck hit with
  a low bass pluck (hit: the screech). The tail is silence, the flexatone's wobble, a ratchet's croak or a siren.
  It's Ringu's sound, for the frame she appears.
- **Rattles and wobbles**: an uneven pulse of a ratchet, a vibraslap, a flexatone and a bell tree, an ocean drum's
  rush, a stray kalimba note. It gets closer (hit: right behind you). Ju-On's croak.
- **Funeral organ** (theme): a quiet pipe organ chorale in four parts with a soft trombone on the bass. On the last
  phrase one chord comes out wrong.
- **Haunted harpsichord** (theme): a minuet in minor in the empty ballroom, with a bassoon on the bass, a wrong note
  at the cadences, slowing at the end.
- **Kalimba lullaby** (theme): a slightly out-of-tune kalimba over soft vibraphone chords, an ocarina answering, wine
  glasses at the end.
- **Muted trumpet noir**: a harmon-muted trumpet over a walking double bass and vibraphone, a slow minor blues.
- **Solo violin lament** (theme): one violin sighing over held cello chords and a double bass root.
- **Siren and chimes**: a toy siren far off, wind chimes, glockenspiel glissandi, a cymbal swell into nothing.

### 7.3 The Instruments list

Under the cues, **Instruments** lists every instrument, Woohill's and the added ones, each with its `best`: what
it's for. ▶ plays it alone: a climb through its range and a chord, or every piece of a kit in turn. The filter
searches it too, so "funeral" or "ghost" finds the instruments as well as the cues. A new instrument goes into
`fetch_samples.py` with a `best`. SCORE fails on an added instrument without one, and SCOREPAGE renders every
instrument and every Expanded cue, checking that each has sound and doesn't clip.
