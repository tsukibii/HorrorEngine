# Scoring horror romance and K-drama action cues with piano, strings and tuned percussion

Research notes for HorrorStudio's procedural orchestrator, the score room (`tools/score/`, docs/MUSIC.md), gathered
2026-10-21 from about 38 web searches (read through their summaries; the unconfirmed points are marked and listed at
the end). The cue catalogue in §4 is the design the score room's cues were checked against: docs/MUSIC.md §4 says
which are built and how they differ. The palette is CC0 samples only: Meta Piano (4 velocity
layers), string sustain (arco), string tremolo, string pizzicato, harp, glockenspiel, xylophone, marimba, tubular
bells, flute (sustain and staccato), one French horn, timpani, drum kit, nylon guitar and steel guitar. WebAudio adds
pitch bends (playbackRate ramps), detune, filters, a WaveShaper for distortion, generated noise buffers and
convolution reverb, and the sampler plays a note reversed (a swell into where its attack was).

All techniques here are described in our own words. Where a source couldn't confirm a detail, the text says so. A few
points come from general film-music knowledge rather than a search result, and those are marked *(general
knowledge)*.

---

## 1. K-drama scoring: how the comedic and romantic underscore works

### 1.1 Two layers: the OST songs and the BGM

A Korean drama's music comes in two separate layers, often handled by different people.

- **The OST (vocal songs).** These are released one by one as the drama airs: "Part 1", "Part 2" and so on, each sung
  by a K-pop or ballad singer. They work like character and couple themes. An OST producer runs this side (Song
  Dong-woon produced the songs for *Descendants of the Sun*, *Goblin* and *Hotel del Luna*), and the songs are written
  to chart. A song's instrumental version later turns into underscore.
- **The BGM (incidental score).** A music director writes or supervises this, and its cues are often never released.
  Nam Hye-seung, for example, has worked on about 77 dramas (*Goblin*, *Crash Landing on You*, *Mr. Sunshine*, *It's
  Okay to Not Be Okay*, *Queen of Tears*). The BGM includes the comedy cues: the sneaking, the falls, the flustering.
  A Korean academic study of *My Love from the Star* found that BGM appeared more often than the sung tracks, and that
  it came in **often but in short bursts**. That is the key fact for our engine: K-drama underscore is a stream of
  short, reusable cues rather than long through-composed pieces.

Nam Hye-seung's route into the work is telling. She started in 1989 by answering an EBS advert for someone to add
"music effects" to programmes. In Korean TV the line between a music cue and a sound effect has always been thin.
Korean variety shows take this furthest, with their dense captions and stacked sound effects. Dramas borrow some of
that punctuation in their comic scenes.

Themes are built from the script. For *Goblin*, Nam and composer Park Jin-ho wrote "Who Are You" first, after reading
the script, as the theme for Kim Shin. A character-linked theme that comes back at every important beat is the norm.
Overuse is a known risk: *Boys Over Flowers*' music director was criticised for playing the songs too often, and
writers say *My Love from the Star*'s "My Destiny" wore out from repetition. **Our engine should cool a theme down
after it plays.**

### 1.2 The romantic layer: the ballad and its devices

- **Form.** A typical shape is intro, verse A (usually 8 bars), B section (pre-chorus), chorus, interlude, B, chorus,
  bridge, last chorus, outro. A rubato piano or guitar intro sets the mood. The verse sits on piano or guitar alone,
  and the strings (and drums, if any) come in at the chorus.
- **Tempo and metre.** About 60 to 80 BPM in 4/4, sometimes a gentle 6/8 or 12/8 (the waltz-like lilt suits
  romance).
- **The key change.** The last chorus often modulates up, usually a semitone or a whole tone, sometimes after a
  bridge that builds or a short break. That lift is the release at the climax.
- **Piano doubles the melody** while strings and guitar accompany. A closing gesture of semitone motion and brief
  rests across the whole band leaves a "longing" ending.
- **Common progressions** *(the first two are general knowledge)*:
  - **I–V–vi–IV** (the four-chord pop loop), and its sad rotation **vi–IV–I–V**.
  - **The canon** (I–V–vi–iii–IV–I–IV–V), named after Pachelbel's Canon. It is everywhere in pop ballads. The search
    found no source tying it to K-drama specifically, but its descending bass is exactly the "tender, walking
    downstairs" feeling these ballads want.
  - **The royal road** (IV△7–V7–iii7–vi), also called the "koakuma" progression in Japan. It is a staple of J-pop and
    anime themes ("Gurenge", "Unravel", "Yoru ni Kakeru"). It starts on the subdominant and lands on the minor vi
    instead of home, which gives a bittersweet lift that never quite resolves. It can continue round the circle of
    fifths (IV△7–V7–iii7–vi–ii7–V7–I). It suits our anime-flavoured romance well. The search found no source on its
    use in K-pop, so treat it as a J-pop device that also fits.
  - **The Marunouchi progression** *(general knowledge)*: IV△7–III7–vi7–(v7–I7), a jazzier J-pop cousin. The III7
    (a secondary dominant of vi) is the "heart squeeze" chord.
  - **Borrowed iv** (IV–iv–I) for wistful tenderness, and **lament basses** (I–V/7–vi–I/5, the bass walking down) for
    flashbacks.

### 1.3 The comedic layer: action scoring

K-drama comedy scoring is close to **mickey-mousing**, the old cartoon practice where the music copies the on-screen
motion and **hit points** (accents) land on the exact frame of an event. Western film composers often call this
condescending. Light K-dramas embrace it on purpose. The shared vocabulary *(assembled from stock-library
descriptions, trope sources and general knowledge; no Korean-language scoring text was found)*:

| Gesture | What it scores | Typical sound |
| --- | --- | --- |
| Tiptoe pizzicato | sneaking, eavesdropping, a scheme | minor-key pizz on beats 1 and 3 (or short-rest patterns), low register, staccato flute or bassoon-like answers. This descends from the old "Mysterioso Pizzicato" villain cue |
| Giggle runs | cute, mischievous, a wink | fast up-and-down xylophone or glockenspiel figures, harp flourishes |
| Sparkle | eye contact, a pretty face, a dawning crush | glockenspiel or celesta shimmer, a harp glissando, a high string chord |
| Slide | a fall, a trip, a deflating ego | a descending slide-whistle, string glissando or chromatic xylophone run |
| Thud | landing, face-plant, a slap | a timpani hit, kick drum or low piano cluster |
| Freeze-frame | the beat after a shock, a stopped moment | a held tremolo string chord, or sudden total silence |
| "Dun dun dun" | dramatic realisation, played for laughs | three short low hits (horn, piano, timpani) on minor or diminished tones, the last held |
| Record scratch | the cue stops dead on an awkward reveal | a tape or record stop, then silence |
| Rimshot | a punchline | snare, kick and cymbal ("ba-dum-tss") |
| Slow-mo swell | love at first sight, the wrist grab | piano arpeggios, then strings, then the couple's OST chorus |

Fan writing describes slow motion as a K-drama fixture: first sightings, the wrist grab ("almost always" with dramatic
music), the umbrella moment. Two things stand out:

1. The genre is aware of its own clichés and parodies them (*Weightlifting Fairy Kim Bok-joo* sends up the slow-mo
   trope). A comic undercut of a romantic swell (the swell builds, then the record scratch) is a recognised joke.
2. One blog notes that a slow-motion happy walk with happy music often warns that something bad is coming. That is
   our "sweet, then wrong" turn.

**Instrumental colours of cute comedy** *(from stock-library descriptions)*: ukulele, a human whistle, glockenspiel,
xylophone, hand claps, pizzicato and harp. For us: whistle becomes a thin flute sustain with gentle vibrato,
ukulele becomes nylon guitar in high voicings, and celesta becomes a soft glockenspiel blended with the piano's top
octave and harp.

### 1.4 The dramas and what each is known for

Composer credits are given only where a search confirmed them. Otherwise the music director is marked as unverified.

| Drama | Music people (where confirmed) | What's characteristic |
| --- | --- | --- |
| *Crash Landing on You* (2019) | Nam Hye-seung, with Park Sang-hee on the orchestral score | An orchestral and contemporary-classical score. "The Song for My Brother" is a piano theme the hero plays, published in G major and praised for its orchestral clarity. Big vocal OSTs ("Flower", "Give You My Heart"). A useful model: one piano theme that turns into the full orchestra |
| *Goblin / Guardian: The Lonely and Great God* (2016) | Nam Hye-seung (music director), Park Jin-ho; OST producer Song Dong-woon | Fantasy melancholy. Character themes written from the script ("Who Are You" for Kim Shin). "Stay With Me" (Chanyeol and Punch, written by Rocoberry) as the recurring couple song. Pulsing, sweeping strings. Dark cues for the reaper and death |
| *Descendants of the Sun* (2016) | Song Dong-woon and Gaemi credited as composers | The template for the huge-ballad OST ("Always", "This Love", "Everytime"). Military swagger mixed with romance |
| *Hotel del Luna* (2019) | Producer Song Dong-woon; vocals by Taeyeon, Heize, 10cm, Punch, Paul Kim | Horror-fantasy romance, the closest K-drama to our brief: ghosts plus a love story. Lush, melancholy ballads against eerie, lighter-than-horror cues |
| *My Love from the Star* (2013) | OST: Lyn's "My Destiny" | The signature ballad drove the show's global success. Its BGM appeared more often than the songs, in short bursts |
| *Boys Over Flowers* (2009) | Music director Oh Joon-sung | T-Max's "Paradise" as the bouncy hook, SS501's ballad. Criticised for playing the songs too often |
| *Business Proposal* (2022) | Composer not found | Fans describe "playful, quirky" cues for the heroine's antics against "powerful ballads". A good model for alternating comedy and romance |
| *Extraordinary Attorney Woo* (2022) | Noh Young-shim (IMDb; unverified elsewhere) | A whimsical, waltz-heavy score (cues like "Prom Dance", "Dance with the Best Friend") that supports the heroine's "eureka" whale moments |
| *Itaewon Class* (2020) | Park Sung-il (music supervisor; also *My Mister*) | Indie and rock OST ("Start Over", "Sweet Night"). Determined, driving underscore |
| *Strong Woman Do Bong-soon* (2017) | Moon Sung-nam | Superpower slapstick: action-comedy cues timed to impossible feats |
| *Reply 1988* (2015) | — | Nostalgia through covers of 1980s Korean songs (for example "Everyday with You", originally by Deulgukhwa). Music as period and memory |
| *Twenty-Five Twenty-One* (2022) | "Starlight" written by Oh Dong-jun | Bittersweet youth-nostalgia ballads |
| *What's Wrong with Secretary Kim*, *Weightlifting Fairy* | Not found | Bright rom-com: pizz, glockenspiel and guitar cues. *Weightlifting Fairy* parodies the slow-mo swell |

The searches never confirmed Kim Jun-seok as a K-drama composer. Gaemi is confirmed only as a credited composer on
*Descendants of the Sun*.

**Sources (section 1):**
[Nam Hye-seung (Wikipedia)](https://en.wikipedia.org/wiki/Nam_Hye-seung) ·
[Bandwagon interview with Nam Hye-seung](https://www.bandwagon.asia/articles/music-director-nam-hye-seung-kdrama-korean-drama-record-of-youth-its-okay-to-not-be-okay-soundtrack-ost-bgm-interview-2020) ·
[Korea Herald on Goblin's music](https://m.koreaherald.com/article/3402585) ·
[Crash Landing on You (Wikipedia)](https://en.wikipedia.org/wiki/Crash_Landing_on_You) ·
[Here & Now Recordings on the CLOY soundtrack](https://hereandnowrecordings.com/blog/2020/5/4/crash-landing-on-you-original-soundtrack?format=amp) ·
[Musicnotes, The Song for My Brother](https://www.musicnotes.com/l/zGdhW) ·
[Descendants of the Sun (Wikipedia)](https://en.wikipedia.org/wiki/Descendants_of_the_Sun) ·
[Little Garden (Wikipedia, Gaemi)](https://en.wikipedia.org/wiki/Little_Garden) ·
[Stay with Me (Wikipedia)](https://en.wikipedia.org/wiki/Stay_with_Me_(Chanyeol_and_Punch_song)) ·
[Soompi on the Hotel del Luna OST](https://www.soompi.com/article/1337370wpp/girls-generations-taeyeon-heize-and-more-to-sing-ost-for-hotel-del-luna) ·
[Boys Over Flowers (Wikipedia)](https://en.wikipedia.org/wiki/Boys_Over_Flowers_(2009_TV_series)) ·
[t2online on OSTs as catalysts](https://t2online.in/screen/k-drama/the-invisible-lead-actor--how-osts-become-the-catalyst-for-k-dramas/2000653) ·
[My Love from the Star OST study (koreascience)](https://koreascience.kr/article/CFKO201816363645410.pdf) ·
[Seoulbeats on instrumental OSTs](https://seoulbeats.com/2013/04/the-instrumental-side-of-the-original-sound-track/) ·
[Extraordinary Attorney Woo OST (fandom)](https://kpop.fandom.com/wiki/Extraordinary_Attorney_Woo_OST) ·
[IMDb FAQ, Attorney Woo composer](https://IMDB.de/title/tt20869502/faq/) ·
[TenAsia on Park Sung-il](https://www.tenasia.com/tv/2025120164654) ·
[Strong Girl Bong-soon (Wikipedia)](https://en.wikipedia.org/wiki/Strong_Girl_Bong-soon) ·
[Business Proposal OST (Review Geek)](https://www.thereviewgeek.com/businessproposal-ost/) ·
[Royal road progression (Wikipedia)](https://en.wikipedia.org/wiki/Royal_road_progression) ·
[Flat.io on J-pop progressions](https://blog.flat.io/jpop-anime-chord-progressions/) ·
[Pianote on the canon progression](https://www.pianote.com/blog/wp-json/wp/v2/posts/8763) ·
[Korean ballad (Melodigging)](https://www.melodigging.com/genre/korean-ballad) ·
[KDR-OST analysis (Studocu)](https://www.studocu.com/en-au/document/western-sydney-university/the-musical/music-of-korea-kdrama-ost/28847192) ·
[Mickey Mousing (Wikipedia)](https://en.wikipedia.org/wiki/Mickey_Mousing) ·
[StudioBinder on mickey mousing](https://www.studiobinder.com/blog/mickey-mousing/) ·
[Mysterioso Pizzicato (Wikipedia)](https://en.wikipedia.org/wiki/Mysterioso_Pizzicato) ·
[VI-Control: comedy scoring techniques](https://vi-control.net/community/threads/comedy-scoring-techniques.65423/) ·
[Sting (Wikipedia)](https://en.wikipedia.org/wiki/Sting_(musical_phrase)) ·
[Gulf News, K-drama clichés](https://gulfnews.com/entertainment/if-youve-watched-k-dramas-youve-seen-these-8-clich%C3%A9s-a-hundred-times-umbrellas-to-ceos-renting-out-playgrounds-1.500572682) ·
[Screen Rant, love-at-first-sight scenes](https://screenrant.com/best-k-dramas-love-first-sight-scenes/) ·
[Korea Herald on variety captions](https://www.koreaherald.com/article/10410946) ·
[Ukulele and whistle stock cue (Monsterone)](https://monsterone.com/stock-music/happy-ukulele-and-whistle-stock-music-audio-track-o181877/)

---

## 2. Horror music theory for piano and strings, built from our instruments

### 2.1 Dissonance: what is wrong, and by how much

- **The minor second (semitone)** is the basic horror interval. *Jaws* runs on an E–F semitone rocking back and
  forth. The two notes are so close that the ear can't settle on a key, and that ambiguity reads as threat. The
  Phrygian ♭2 (the semitone above the tonic) carries the same friction even over a static drone.
  - *Build:* a low string sustain or piano ostinato rocking between root and ♭2. Speed is the dial: slow means
    distant, fast means close.
- **The tritone** ("diabolus in musica") is maximum instability. Use it as a dyad over a pedal, or as root to ♯4.
- **Clusters**: three or more adjacent semitones together. On piano, a low-register cluster at velocity layer 4 gives
  the "thud of doom". Spread through the strings, they give a Penderecki wall.
- **Quarter-tone clusters**: Penderecki's *Threnody* (52 solo strings, timed in seconds) packs notes a quarter tone
  apart.
  - *Build:* 6 to 12 string-sustain voices on adjacent semitones, each detuned by a random ±25 to 50 cents, entering
    one by one over 2 to 6 s and then bending apart (playbackRate ramps of ±1 to 3 semitones over 4 to 8 s).
- **Tonal but wrong** usually beats full atonality for our genre. Write a sweet, functional tune and corrupt one thing:
  one note a semitone flat, a chord with a ♭2 or ♯4 added, a cadence that lands on a chromatic mediant (C major to
  A♭ minor), or a voice detuned 20 to 40 cents. Listeners hear "almost right", the uncanny valley of music. Tropedia
  says exactly this about ominous music-box tunes: the small part that is off is what makes it feel wrong.
- **Useful chords** *(general knowledge)*: the minor-major seventh (C–E♭–G–B, the noir and Hitchcock chord), the
  augmented triad (unreal, floating), the diminished seventh (old-fashioned peril, usable for comedy), and a minor
  triad with an added ♭2 or ♭6.

### 2.2 Modes and scales

| Mode | Horror use |
| --- | --- |
| Phrygian (♭2) | Heavy, ritual, stalking; the ♭2–1 "sigh" as a motif |
| Locrian (♭2, ♭5) | Has no stable tonic triad at all. Use it for "nothing is safe" drones |
| Harmonic minor and Hungarian minor | Gothic, a music-box-in-the-attic feel |
| Whole tone | Dreamlike disorientation, memory loss |
| Lydian (♯4) | The "uncanny" Lydian: film scoring links it to wonder, flight and magic (Williams), and its raised fourth floats. Over a held tonic in a slow, quiet context, the same ♯4 is the tritone, so it reads as too sweet, heavenly-wrong. This is ideal for a yandere's "perfect" world: dreamy Lydian that, held too long, starts to sound like something false |
| Major with one flattened note | Our default "sweet but wrong" |

### 2.3 Pedal tones and drones

A held low note under changing harmony creates pressure the ear wants released.
*Build:* a low string sustain (C2 or lower) with a slow lowpass sweep (200 to 800 Hz) and a slow 0.1 to 0.3 Hz
amplitude swell. A soft timpani roll (fast repeated soft hits, randomised velocity) gives a rumbling pedal. A piano's
lowest notes re-struck every 4 to 8 bars give a "tolling" pedal. Two drones a few cents apart create beating, a slow
wobble that suggests sickness.

### 2.4 Chromatic descent

A bass line walking down by semitones (the old lament bass) gives both grief and doom. Slow, it is a sad flashback.
In tremolo, it is dread. Herrmann-style descending string lines are the classic "descending into madness".

### 2.5 Extended string techniques and how we fake them

| Technique | Real sound | Our approximation |
| --- | --- | --- |
| Tremolo | Fast bowing: nervous shimmer | Native sample. Ride its volume for swells |
| Sul ponticello (bowing near the bridge) | Glassy, brittle, harmonics-rich, ghostly | Tremolo plus a highpass at about 600 Hz plus a resonant peak at 3 to 6 kHz plus slight detune chorus (two copies ±8 cents). The *Insidious* opening violin is described as ponticello tremolo: "screechy and haunting" |
| Sul tasto (over the fingerboard) | Breathy, flute-like, veiled | Strings sustain with a lowpass at 1.5 to 2 kHz, blended with a quiet flute sustain |
| Harmonics (flageolet) | Glassy, whistling, pure | Strings sustain one to two octaves up, highpassed, low gain, no vibrato, plus a faint flute sustain in unison. Glockenspiel at very low velocity for "ice" |
| Col legno battuto (bouncing the wood of the bow) | Dry, skeletal ticking | Pizzicato with a 40 ms envelope, a highpass at 800 Hz, layered with a damped xylophone or marimba at low velocity, or a drum-kit sidestick. A clock-like col legno ostinato is a good "hiding" pulse |
| Glissando | Sliding pitch, rising tension, wailing | playbackRate ramps on sustain or tremolo. A cluster glissando: several voices bending in different directions and at different speeds |
| Scratch tone (heavy bow pressure) | A grinding growl | Low tremolo through a WaveShaper (mild distortion) plus a bandpass at 200 to 1000 Hz, optionally mixed with a bandpassed noise buffer |
| Bartók snap pizzicato | A slapping crack | Pizzicato at the top velocity plus a drum-kit rim click on the same frame |
| Aleatoric swarm (players repeating figures at their own speed) | Insect-like chaos | 6 to 10 voices, each looping a 3 to 5-note cell at its own random tempo (±15%) and detune |

Herrmann's *Psycho* is the proof that strings alone are enough. Most of the score is muted (con sordino), while the
shower cue drops the mutes and uses repeated, scraping, percussive bow attacks as both the knife and a screeching
bird. Strings span the lowest double-bass notes to the highest violin harmonics, plucked or bowed, and so give the
widest range of any single section.

### 2.6 The stinger and the silence before it

- **The silence sets up the scare.** Sound designers interviewed about horror say the calm before the scare decides
  how strong it is. The hit itself needn't be very loud. It has to contrast with what came before and reach full
  level within milliseconds.
- **Don't make silence predictable.** If every silence ends in a bang, the audience learns the pattern. Vary the
  length of the lull, and put false scares in it. The classic example is *Cat People*'s bus hiss: a long build, then
  a harmless sound.
- **Constant loudness kills the scare.** Keep the floor quiet so the sting has headroom.
- *Build a stinger:* on frame 0, a piano low cluster at the top layer, string tremolo cluster stabs (4 to 6 voices in
  semitones at high and low extremes), a timpani hit and a horn stopped-sounding blat (horn at full velocity with a
  bandpass at 1 to 2 kHz and mild drive). Tail: tremolo cluster decaying over 1.5 to 3 s, plus a 2 to 3 s reverb.
  Add an upward string glissando "shriek" (playbackRate ramp +5 to +12 semitones over 300 ms) on the top voice.

### 2.7 Building tension

- **Ostinato.** A repeated figure, often two notes (*Jaws*), whose speed and loudness carry the threat. Spielberg was
  convinced when he heard the same two notes at different speeds. Tempo is the expressive parameter.
- **Accelerando and crescendo.** Raise tempo and level together toward the hit point, then cut.
- **Shepard-like rise.** Stacked octaves that seem to climb forever. Zimmer used three of them at different speeds for
  *Dunkirk* to make tension feel always rising.
  - *Build:* three copies of a string-sustain glissando in octaves, each sweeping up one octave over N seconds, with
    an amplitude window by pitch (quiet at the bottom and top, loud in the middle) and crossfading round-robin.
- **Thinning.** Remove instruments one by one until a single high note remains, then silence.
- **Register spread.** Move the outer voices apart (bass down, top up) as tension rises.

### 2.8 Music-box and lullaby horror

The effect comes from a childhood sound against menace, plus an "almost right" near-miss: slowed tempo, slightly out of
tune, one wrong note.

*Build:* glockenspiel at low velocity in octave 5 or 6, with harp harmonics an octave below and the piano's top
octave for body. Use a 3/4 waltz or simple lullaby in a major key.
Corruption controls:
1. **Wind-down:** lower playbackRate and tempo together (pitch falls with speed, like a dying spring), 1.0 to 0.85
   over 8 bars.
2. **Wrong note:** one melody note a semitone off, or 30 to 50 cents off.
3. **Detune drift:** each note randomly ±5 to 25 cents.
4. **Missing teeth:** randomly drop 5 to 15% of notes.
5. **Reharmonise underneath:** a low string drone a tritone away from the tune's key.

### 2.9 "Sweet but wrong" for yandere characters

Her theme should be genuinely lovely: a waltz or ballad, a royal-road progression, flute and harp. Then it gets
corrupted by degrees as her obsession shows. Composers do exactly this with a familiar childhood melody in a thriller
context, and Jung Jae-il's *Squid Game* recorder theme is the model. It uses a childish instrument and a playground
rhythm (the Korean 3-3-7 sports-day clap), and keeps a wrong note (a D♯ that should have been a D) because it was
"scary in a bizarre way". *Doki Doki Literature Club* shows the late stage: the cheerful main theme returns warped and
broken-tape, fragments of other tracks smeared together.

### 2.10 Heartbeat rhythms

A low pulse in a "lub-dub" short-long pattern, starting steady and speeding up, is a common horror device. A student
analysis of *Hereditary* describes a deep heartbeat-like pattern that starts steady and then speeds up. A study of an
adaptive horror-game soundtrack found that music changed both heart rate and felt tension, but the two didn't track
each other closely. So don't rely on literal entrainment: the gesture is narrative.
*Build:* timpani (low, soft, with a short low-shelf boost) on "lub", kick drum on "dub" about 120 to 180 ms later.
Resting at 60 to 72 BPM, panic at 130 to 160. Pair it with a lowpass on the rest of the mix ("hearing your own
blood").

### 2.11 Prepared and inside-the-piano sounds

Joseph Bishara played a string quartet against a piano worked with hammers, files and homemade tools for
*Insidious*. Approximations:
- **Damped piano:** a low note with a 150 ms envelope and a lowpass at 900 Hz, layered with a soft marimba one octave
  up. That gives a "muted thunk".
- **Metallic piano:** a piano note plus a tubular bell or glockenspiel a minor ninth or tritone away at low level,
  for bolt-on-string clangs.
- **Slackening string:** a low piano note whose playbackRate sags 30 to 80 cents over its decay.
- **Honky-tonk or abandoned piano:** each note doubled with a copy detuned 15 to 35 cents (one sharp, one flat). This
  is the haunted-house upright.
- **Scraped strings:** a low harp note plus a fast downward playbackRate ramp plus a bandpass. This gives a nail
  dragged along a bass string.
- **Thrown-down lid:** a piano cluster at full velocity plus a timpani hit plus a kick drum, with a short room reverb.

**Sources (section 2):**
[Jaws soundtrack (Wikipedia)](https://en.wikipedia.org/wiki/Jaws_(soundtrack)) ·
[Empire: Zimmer on the Jaws theme](https://www.empireonline.com/movies/features/jaws-theme-explained-by-hans-zimmer) ·
[The Take on the Jaws score](https://the-take.com/read/ask-the-professor-why-is-the-score-of-ajawsa-so-iconic) ·
[Classic FM: what's creepy about a semitone](https://www.classicfm.com/discover-music/music-theory/why-semitones-are-creepy/) ·
[Sarha Moore on the Phrygian second](https://ojs.meccsa.org.uk/index.php/netknow/article/view/67) ·
[Composer Code on the Phrygian mode](https://composercode.com/the-phrygian-mode-flamenco-and-gravitas/) ·
[Mark Slater on the Lydian mode](https://markslater.net/unlocking-the-power-of-the-lydian-mode/) ·
[Richard Coyne on modes and moods](https://richardcoyne.com/2021/09/12/modes-and-moods/) ·
[Penderecki's Threnody (Sin80)](https://sin80.com/en/work/penderecki-threnody-victims-hiroshima) ·
[Heavy Blog on Threnody](https://www.heavyblogisheavy.com/2017/01/20/heavy-vanguard-episode-9-krzysztof-penderecki-threnody-to-the-victims-of-hiroshima/) ·
[Yamaha: eight spooky string techniques](https://hub.yamaha.com/strings/s-how-to/eight-spooky-string-techniques) ·
[Toby Rush on extended techniques](https://tobyrush.com/book/text/twc/twc03.html) ·
[Orchestral Tools Special Bows](https://www.orchestraltools.com/store/collections/special-bows-1) ·
[Col legno (Wikipedia)](https://en.wikipedia.org/wiki/Col_legno) ·
[Insidious main theme analysis (Bradford College)](https://digitalspace.bradfordcollege.ac.uk/10626277/?p=5369) ·
[BAFTA: music in Psycho](https://www.bafta.org/?p=370698) ·
[Royal Holloway teaching hub on Herrmann](https://royalholloway.ac.uk/research-and-teaching/departments-and-schools/music/about-us/teacherhubmusic/bernard-herrmanns-film-music-psycho-and-others) ·
[The Jump Scare Lives (AUB)](https://graduateschool.aub.ac.uk/top-news/the-jump-scare-lives.html) ·
[LBB: horror sound design secrets](https://lbbonline.com/news/horror-sound-designs-secrets-how-audio-experts-craft-bone-chilling-scares/) ·
[Epidemic Sound on jump-scare sounds](https://www.epidemicsound.com/filmmaking/jumpscare-sound-effects/) ·
[CBC: Zimmer on Dunkirk's Shepard tone](https://www.cbc.ca/radio/q/blog/hans-zimmer-explains-the-audio-trickery-that-made-dunkirk-audiences-nauseous-1.4311684) ·
[Kottke on Dunkirk's three Shepard scales](https://kottke.org/18/05/hans-zimmers-clever-use-of-the-shepard-scale-in-dunkirk) ·
[Tropedia: Ominous Music Box Tune](https://tropedia.fandom.com/wiki/Ominous_Music_Box_Tune) ·
[Tropedia: Ironic Nursery Tune](https://tropedia.fandom.com/wiki/Ironic_Nursery_Tune) ·
[Daily Mail / Radio 4: Tiny Tinkles](https://www.pressreader.com/uk/daily-mail/20220921/282419878112944) ·
[UAL blog on a childhood-melody leitmotif](https://thickerthanblood.myblog.arts.ac.uk/?p=92) ·
[Hereditary heartbeat analysis (NCSU)](https://classapps.chass.ncsu.edu/com304/?p=239) ·
[Open University: musical heartbeats](https://oro.open.ac.uk/29643) ·
[Lisbon adaptive horror soundtrack study](https://fenix.tecnico.ulisboa.pt/downloadFile/844820067127510/87693-pedro-soares-resumo.pdf) ·
[Joseph Bishara (Wikipedia)](https://en.wikipedia.org/wiki/Joseph_Bishara)

---

## 3. Reference works and what to take from each

| Work | Technique (in our words) | Informs |
| --- | --- | --- |
| **Psycho** (Herrmann, 1960) | Strings only, as "black-and-white sound". Muted strings for unease, then unmuted, repeated scraping stabs used as percussion and as a scream. The shower cue is mickey-mousing at its most violent | jump-scare stinger, death cue, stalker ostinato (the restless driving figure of the main title) |
| **Jaws** (Williams, 1975) | Two notes a semitone apart, low, with tempo carrying distance and danger | stalker ostinato, hunt approach |
| **The Shining** (Kubrick's temp choices: Penderecki, Ligeti, Bartók) | Quarter-tone clusters, glissandi, tailpiece and behind-the-bridge sounds. Music timed in seconds instead of bars. Ligeti-style clouds of slowly shifting held notes | dread drone, she's-behind-you whispers, cluster swell |
| **Ringu** (Kenji Kawai, 1998) | J-horror relies on timbral change and long silences (*ma*), linked to kabuki ghost practice. A grating "ripping" metallic screech announces the ghost, and the score blurs into sound design. Minimal, with well-timed small fillips | dread drone, ghost-presence sting, silence rules |
| **Ju-On** (Shiro Sato) | Same J-horror grammar: timbral transformation, substantial silence, the metallic screech. Its famous croak is sound design, not score | presence cue, silence as an instrument |
| **Higurashi** (game music largely by dai, including "you"; Kawai scored the anime) | "you" exists in a music-box version: a tender lullaby carried through a village that turns murderous. The cute front stays while the story rots | music box gone wrong, the turn |
| **Silent Hill** (Akira Yamaoka) | Industrial and ambient noise used as percussion, few melodies in the first game. From *Silent Hill 2* on, lyrical, sad melodies for loneliness and grief ("expressing loneliness, sadness, anxiety" rather than scary music). The opening uses mandolin tremolo over arpeggios | sad horror theme, grief flashback, death cue (melancholy rather than shock) |
| **Fatal Frame** series (later games: Masafumi Takada) | Laid-back sound that stays out of the way, a slow-boil creep, then a jarring bolt | hiding-tension pulse, found-you sting |
| **Hereditary** (Colin Stetson) | Continuous, breathless lines (circular breathing, split tones, growls through a throat mic). The one instruction was "make it feel evil". A heartbeat-like pulse speeds up | dread drone (endless unbroken string sustains), heartbeat chase |
| **Insidious** (Joseph Bishara) | Loud, stringy jabs. A string quartet against a piano abused with hammers and files. Ponticello tremolo screech | jump-scare stinger, prepared-piano dread |
| **The Conjuring** (Bishara) | Atonal, shrieking strings, wobbling pitches. Scare cues woven into the score so they can't be anticipated | stinger placement (don't telegraph), cluster swells |
| **It Follows** (Disasterpeace) | Synths (we can't copy the timbre), but the strategy carries: one palette for scary and quiet moments alike so the score stays cohesive, a slow thrumming pulse, a Morricone-like theme. The temp track included Penderecki and Cage | the "relentless approach" pulse; one palette for all cues |
| **Train to Busan** (Jang Young-gyu) | Big-action K-horror with a Korean sensibility. Jang's work explores Korean musical heritage. Use it for the chase register | heartbeat chase, panic flight |
| **Kingdom** (credited to Mowg; unverified here) | Period zombie horror: low, driving percussion and drones | chase, dread |
| **The Wailing** (Jang Young-gyu and Dalpalan) | Rural Korean dread. Dalpalan's metal and electronic background meets ritual intensity. The shaman rite builds through relentless percussion | ritual crescendo, possession cue (drum kit toms plus timpani) |
| **Squid Game** (Jung Jae-il) | **Most relevant.** Childish instruments (recorder, snare, claps) for a serious score. A playground rhythm. A kept wrong note. Avoiding the "epic" route. Humour balanced against massacre | yandere sweet theme, cute-over-horror, music box gone wrong, the turn |
| **Parasite** (Jung Jae-il) | Self-taught "pseudo-baroque": noble, beautiful baroque that becomes funny when the poor family plays at being rich. Jung improvises at the instrument while watching the picture | smug or scheming cue (baroque pizz and harp), romance-horror irony |
| **Doki Doki Literature Club** (Dan Salvato) | A cheerful dating-sim theme, then its warped versions: broken-tape openings, a distorted xylophone-like instrument and piano, smeared fragments of other cues. The earworm makes the corruption land | the turn, sweet-then-wrong, glitch variant |
| **Danganronpa** (Masafumi Takada) | "Psycho-pop": horror with a pop feel, catchy beats under suspense, tension during exploration, momentum during trials | comic chase under menace, the "cheerful killer" cue |
| **Mirai Nikki / Future Diary** (Tatsuya Katou) | Yandere anime: the score swings between schoolroom sweetness and frenzy. No dedicated Yuno theme was confirmed | yandere waltz, frenzy reprise |
| **Yandere Simulator** | Bright schoolday loops that persist while the player murders. Ironic continuity | sweet-but-wrong (music that doesn't react) |
| **Phantom Thread** (Jonny Greenwood) | Lush, classical romantic strings with an "obsessively modern edge". Gould-style Bach piano, abrasive even in the romantic passages. Music under about 90 of 130 minutes | obsession romance: a beautiful string waltz that's slightly too intense |
| **Hotel del Luna / Goblin** dark cues | Fantasy-melancholy K-drama: sweeping strings and piano for the death-and-fate side of a romance | sad flashback, fated-love swell, ghost-romance crossover |

**Sources (section 3):**
[BAFTA: Psycho](https://www.bafta.org/?p=370698) ·
[Shmoop: Psycho's score](https://shmoop.com/study-guides/psycho/music.html) ·
[Jaws soundtrack (Wikipedia)](https://en.wikipedia.org/wiki/Jaws_(soundtrack)) ·
[Penderecki's Threnody (Sin80)](https://sin80.com/en/work/penderecki-threnody-victims-hiroshima) ·
[Terror Tracks chapter on J-horror](https://www.equinoxpub.com/home/view-chapter/?id=19136) ·
[Ringu soundtrack review (KQEK)](https://www.kqek.com/cd_lp_reviews/p2r/CD_0013_Ringu.htm) ·
[Higurashi soundtracks (Wikipedia)](https://en.wikipedia.org/wiki/List_of_Higurashi_When_They_Cry_soundtracks) ·
[MusicRadar: Yamaoka interview](https://www.musicradar.com/artists/rather-than-simply-writing-scary-music-i-wanted-to-express-loneliness-sadness-anxiety-and-the-psychological-aspects-of-fear-we-speak-to-video-game-horror-soundtrack-godfather-akira-yamaoka-about-the-legacy-of-silent-hill) ·
[VGMO: Silent Hill soundtracks](https://vgmonline.net/silenthill/) ·
[Yamaoka (Music 4 Games)](https://www.silenthillmemories.net/creators/interviews/2009.01.26_yamaoka_music4games_en.htm) ·
[Dread Central on Fatal Frame II](https://www.dreadcentral.com/news/477380/dissonant-voices-the-unsettling-sounds-of-fatal-frame-ii-2/) ·
[Bloody Disgusting: chilling survival-horror soundtracks](https://bloody-disgusting.com/news/121206/the-10-most-chilling-survival-horror-soundtracks/) ·
[Tor.com on Hereditary](https://tor.com/2021/10/19/hereditary-soundtrack-is-a-masterpiece-of-dread-by-composer-colin-stetson) ·
[Insidious soundtrack (Wikipedia)](https://en.wikipedia.org/wiki/Insidious_(soundtrack)) ·
[The Conjuring soundtrack (Wikipedia)](https://en.wikipedia.org/wiki/The_Conjuring_(soundtrack)) ·
[Sputnik on The Conjuring](https://www.sputnikmusic.com/review/58097/Joseph) ·
[Bloody Disgusting: Disasterpeace on It Follows](https://bloody-disgusting.com/news/3340014/disasterpeace-discusses-incredible-music-behind-follows-interview/) ·
[Vice: Disasterpeace interview](https://www.vice.com/en/article/it-follows-disasterpeace-interview/) ·
[Young-gyu Jang bio](https://terosaarinen.com/en/?p=17451) ·
[The Wailing (Wikipedia)](https://en.wikipedia.org/wiki/The_Wailing_(2016_film)) ·
[Dalpalan (Wikipedia)](https://Www.Wikipedia.org/wiki/Dalpalan) ·
[Squid Game soundtrack (Wikipedia)](https://en.wikipedia.org/wiki/Squid_Game_(soundtrack)) ·
[Sound On Sound: Jung Jae-il](https://www.soundonsound.com/people/jung-jae-il-squid-game-parasite-soundtracks) ·
[Headliner: Jung Jae-il's secrets](https://headlinerhub.com/jung-jaeil-composer-squid-game-parasite-secrets.html) ·
[Deadline: Jung Jae-il interview](https://deadline.com/2025/05/squid-game-jung-jaeil-season-3-interview-1236389527/) ·
[Parasite soundtrack (Wikipedia)](https://en.wikipedia.org/wiki/Parasite_(soundtrack)) ·
[Classic FM on Parasite](https://classicfm.com/discover-music/periods-genres/film-tv/parasite-music-soundtrack-italian-song-jung-jae-il) ·
[DDLC (Wikipedia)](https://en.wikipedia.org/wiki/Doki_Doki_Literature_Club!) ·
[WXTJ on DDLC's soundtrack](https://www.wxtj.fm/wxtj-writes-by-meredith-hunsader-the-genius-behind-doki-doki-literature-clubs-soundtrack/) ·
[RPGFan: DDLC OST](https://rpgfan.com/music-review/doki-doki-literature-club-official-soundtrack) ·
[Music of Danganronpa (Wikipedia)](https://en.wikipedia.org/wiki/Music_of_the_Danganronpa_series) ·
[ANN: Mirai Nikki staff](https://wwwezo.animenewsnetwork.com/interest/2011-09-07/mirai-nikki-staff-cast-premiere-date-songs-revealed) ·
[TV Tropes: Yandere Simulator music](https://www.tvtropes.org/pmwiki/pmwiki.php/AwesomeMusic/YandereSimulator) ·
[Filmtracks: Phantom Thread](https://www.filmtracks.com/titles/phantom_thread.html) ·
[LA Review of Books: Greenwood's new baroque](https://lareviewofbooks.org/blog/reviews/jonny-greenwood-new-baroque/)

---

## 4. Cue catalogue for the engine

**Shared parameters.** Every cue accepts: `tempo`, `root`, `mode`, `intensity` (0 to 1: density, velocity layer,
register spread), `wrongness` (0 to 1: detune, wrong-note probability, dropped notes), `length` (bars, or seconds for
free-time cues), `hitAt` (seconds to an action frame, for stings), `reverb` (send), `seed`.

Instrument abbreviations: Pno = piano, StrS = strings sustain, StrT = tremolo, StrP = pizzicato, Hp = harp,
Glk = glockenspiel, Xyl = xylophone, Mar = marimba, TBell = tubular bells, Fl = flute (sus or stacc), Hn = horn,
Timp = timpani, Kit = drum kit, NGtr = nylon guitar, SGtr = steel guitar.

### 4.1 Horror

**H1. Dread drone**
- **Purpose:** an ambient bed for exploring a wrong place.
- **Tempo:** free (pulse less than 40).
- **Mode:** Locrian or Phrygian on a low pedal.
- **Harmony:** pedal root plus a ♭2 or tritone dyad high above. Every 8 to 20 s, one voice shifts by a semitone.
- **Gesture:** slow swells (0.05 to 0.2 Hz), no attacks.
- **Instruments:** low StrS (lowpass sweep), high StrS as harmonics (highpassed, very quiet), an occasional Timp
  roll, rare low Pno tolls.
- **Length:** loops 30 to 120 s.
- **Varies with:** pedal note, interval set, beating detune (2 to 8 cents), swell rate, lowpass range, toll
  probability.
- **Echoes:** *Ringu*, *Hereditary*, Ligeti in *The Shining*.

**H2. Stalker ostinato**
- **Purpose:** something is moving toward you.
- **Tempo:** 50 to 140, mapped to the threat's distance.
- **Mode:** Phrygian.
- **Harmony:** root–♭2 rocking, optional tritone pedal.
- **Gesture:** a two-note or four-note low figure with an accelerando as the threat nears.
- **Instruments:** low Pno (velocity rises with closeness), StrP doubling, StrS pedal, Timp on downbeats when close.
- **Length:** open-ended, cut on a hit.
- **Varies with:** tempo from distance, interval (♭2 or tritone), figure (2, 3 or 4 notes), register.
- **Echoes:** *Jaws*, the *Psycho* main title's restless drive.

**H3. Music box gone wrong**
- **Purpose:** a toy, a child's room, her keepsake, a memory.
- **Tempo:** 60 to 90 in 3/4.
- **Mode:** major, or Lydian for "too sweet".
- **Harmony:** I–IV–V–I or royal-road fragments in the tune. Under it, an optional drone a tritone away.
- **Gesture:** a simple lullaby in the high register.
- **Instruments:** Glk (low velocity), Hp, top-octave Pno.
- **Length:** 16 to 32 bars.
- **Varies with:** wrongness drives the wind-down rate (playbackRate 1 to 0.85), wrong-note probability (0 to 0.3),
  cents drift (0 to 30), dropped notes (0 to 20%), tritone drone level.
- **Echoes:** Higurashi's "you" (music-box version), *Squid Game*'s childish timbres.

**H4. Jump-scare stinger**
- **Purpose:** the scare.
- **Tempo:** none.
- **Harmony:** a cluster across extremes (low Pno cluster, StrT semitone stabs high and low).
- **Gesture:** attack at `hitAt` exactly, peaking within 10 to 20 ms. An upward string shriek glissando. A 1.5 to 3 s
  tail.
- **Instruments:** Pno at the top layer, StrT, Timp, Hn blat, Kit kick plus crash (optional).
- **Pre-roll:** must follow 0.6 to 2.5 s of near-silence (randomised, see H12).
- **Varies with:** cluster width, shriek interval, tail length, whether a crash is included.
- **Echoes:** *Insidious*, *The Conjuring*, *Psycho*'s shower stabs.

**H5. Heartbeat chase**
- **Purpose:** running, being hunted.
- **Tempo:** heartbeat 90 to 160 (rises over the chase), music runs at double time.
- **Mode:** harmonic minor or Phrygian.
- **Harmony:** an i–♭II alternation, or a chromatic bass climbing every 4 bars.
- **Gesture:** "lub-dub" on Timp plus kick, StrT stabs in 16ths, a rising Shepard layer.
- **Instruments:** Timp, Kit (kick, toms), StrT, StrS riser, Hn on climaxes.
- **Length:** loopable 8-bar blocks, plus an ending sting.
- **Varies with:** heart rate, riser speed, tom density, key raised a semitone every N loops.
- **Echoes:** *Train to Busan*, the *Hereditary* pulse.

**H6. Rising tension riser**
- **Purpose:** the build into a reveal.
- **Tempo:** free, 4 to 20 s.
- **Harmony:** a cluster that widens, or a Shepard octave stack.
- **Gesture:** crescendo plus upward glissandi plus accelerating StrP or col-legno ticks, then a hard cut (into H4, or
  into silence for a false scare).
- **Instruments:** StrS, StrT, simulated col legno, Timp roll crescendo.
- **Varies with:** duration, end type (hit, cut or fade), cluster density.
- **Echoes:** *Dunkirk*'s Shepard rise, Penderecki.

**H7. She's behind you (whisper strings)**
- **Purpose:** a presence close by, unseen.
- **Tempo:** free.
- **Harmony:** a high quarter-tone cluster (Penderecki-style), very quiet.
- **Gesture:** sul ponticello tremolo fading in from nothing, voices sliding apart.
- **Instruments:** StrT with the ponticello filter chain, a faint Fl sustain flutter, an optional single Glk ping.
- **Length:** 4 to 15 s.
- **Varies with:** cluster centre pitch, spread, bend speed, ping probability.
- **Echoes:** *Threnody*, the J-horror metallic screech.

**H8. Hiding pulse**
- **Purpose:** in a closet, holding your breath.
- **Tempo:** 60 to 80.
- **Mode:** static, root plus ♭2.
- **Gesture:** quiet clock-like col-legno ticks or muted Pno repeated notes. Every 4 to 8 bars, a "near miss" swell.
  It drops out entirely when the stalker is closest.
- **Instruments:** StrP with the col-legno chain, damped Pno, a very soft StrS pedal, soft Mar.
- **Varies with:** tick density, swell chance, dropout on threat distance.
- **Echoes:** *Fatal Frame*'s laid-back creep.

**H9. Found you (sting)**
- **Purpose:** the hider is discovered (shorter than H4, can be gentler or comedic-sinister).
- **Gesture:** two notes, a falling minor second, low Pno plus StrP Bartók snap, then silence or H5.
- **Length:** 0.5 to 1.5 s.
- **Varies with:** interval (♭2 or tritone), whether it leads into a chase.
- **Echoes:** the J-horror fillip, the *Jaws* semitone.

**H10. Death cue**
- **Purpose:** the player or a character dies.
- **Tempo:** 40 to 60, rubato.
- **Mode:** minor with a lament bass.
- **Harmony:** i–v/♭7–♭VI–V, or held chords decaying.
- **Gesture:** after the impact, a single tubular bell, then slow descending StrS and a sparse Pno melody.
- **Instruments:** TBell, StrS, Pno, a Hn sigh.
- **Length:** 8 to 20 s.
- **Varies with:** bell pitch, melody fragment (from the victim's theme), length.
- **Echoes:** *Silent Hill 2*'s melancholy, *Psycho*'s aftermath.

**H11. Ritual or possession build**
- **Purpose:** she reveals the shrine, a rite.
- **Tempo:** 70 rising to 140.
- **Mode:** Phrygian.
- **Gesture:** repeated low toms and Timp, StrP ostinato, horn calls on the ♭2.
- **Instruments:** Kit toms, Timp, StrP, Hn, StrT.
- **Varies with:** accelerando curve, density, horn interval.
- **Echoes:** *The Wailing*'s rite.

**H12. Silence (a cue in its own right)**
- **Purpose:** the lull before a scare, or after one.
- **Behaviour:** fade everything to a −40 dB room tone (or a bare whisper of H1) over 0.3 to 1.0 s, hold for a random
  0.6 to 4 s. Then either H4 (scare), H9, nothing (a false lull), or a harmless sound (a false scare).
- **Varies with:** hold length, outcome weights, fade length.
- **Echoes:** *Ringu*'s *ma*, *Cat People*'s bus hiss.

### 4.2 K-drama action cues

**K1. Sneak / tiptoe**
- **Purpose:** sneaking, eavesdropping, stealing a look.
- **Tempo:** 92 to 112, so each step can land on a beat.
- **Mode:** natural or harmonic minor (Dorian for "cheeky").
- **Harmony:** i–iv–V, chromatic neighbour notes.
- **Gesture:** staccato steps on beats 1 and 3 (or every eighth with rests), a sudden stop on a freeze.
- **Instruments:** StrP (low and mid), Fl stacc answers, Mar or soft Xyl, a Kit brush on 2 and 4 (optional).
- **Length:** loop, stops on a hit.
- **Varies with:** step rate locked to footstep events, mode, an "almost caught" freeze (all stop plus a held StrT
  dissonant chord).
- **Echoes:** the Mysterioso Pizzicato tradition, rom-com sneaking cues.

**K2. Flustered**
- **Purpose:** blushing, babbling, caught out.
- **Tempo:** 140 to 170.
- **Mode:** major with chromatic slips.
- **Harmony:** I–♭VI–♭VII–I or fast I–V shuffles.
- **Gesture:** running Xyl and Fl stacc 16ths, a wobbling pitch (playbackRate wobble ±30 cents at 6 Hz on Fl
  sustain), a scramble that ends on a blurted cadence.
- **Instruments:** Xyl, Fl, StrP, Glk accents, Kit shuffle.
- **Length:** 4 to 10 s.
- **Varies with:** speed, wobble depth, and whether it ends on a "blurt" (a Hn honk or a single Timp plus a cymbal
  choke).

**K3. Slapstick fall**
- **Purpose:** a trip, a fall, a crash.
- **Gesture:** a slide down, then a thud on the landing frame, optionally a debris tinkle, then a beat of silence.
- **Instruments:** slide on Fl sustain (playbackRate 2 to 0.5 over 0.4 to 0.8 s: a slide whistle) or a descending
  chromatic Xyl run. Thud on Timp plus Kit kick plus low Pno cluster. Tinkle on Glk.
- **Length:** 1 to 2 s.
- **Varies with:** slide length matched to the airtime, thud weight, tinkle on or off.

**K4. Cute / eating**
- **Purpose:** eating something delicious, a pet, a cute pout.
- **Tempo:** 100 to 120, a bouncy swing.
- **Mode:** major (Lydian sparkle allowed).
- **Harmony:** I–vi–IV–V or I–iii–IV–V.
- **Gesture:** chewing-synced staccato on Glk and Mar, a "yum" upward Hp glissando at the bite.
- **Instruments:** Glk, Mar, NGtr (ukulele role: high voicings), StrP, Fl (whistle role).
- **Length:** 4 to 16 bars.
- **Varies with:** bite events, swing amount, sparkle level.

**K5. Smug / scheming**
- **Purpose:** a plan forming, a sly grin.
- **Tempo:** 84 to 100.
- **Mode:** minor, in a mock-baroque style.
- **Harmony:** i–iv–V7–i over a walking bass, a Neapolitan for "devious".
- **Gesture:** a strutting pizz bass, a harpsichord-like Hp plus StrP counterpoint, a sly Fl or Hn line.
- **Instruments:** StrP, Hp, Fl, Hn, a light Kit.
- **Length:** 8 to 16 bars.
- **Varies with:** strut swing, ornament density.
- **Echoes:** *Parasite*'s pseudo-baroque.

**K6. Shocked realisation ("dun dun dun")**
- **Purpose:** the penny drops, played big.
- **Gesture:** three short hits (short, short, long) on minor or diminished tones, falling. Then a held StrT chord
  (the freeze).
- **Instruments:** Hn, low Pno (octaves), Timp, StrT.
- **Length:** 1.5 to 3 s.
- **Varies with:** one hit or three, serious (minor) or comic (diminished plus a cymbal choke).

**K7. Slow-mo romance**
- **Purpose:** first sight, a wrist grab, the moment time stops.
- **Tempo:** 60 to 72.
- **Mode:** major.
- **Harmony:** IV△7–V7–iii7–vi (royal road) or I–V/7–vi–IV. The final chorus rises a step.
- **Gesture:** a Hp glissando and Glk sparkle open it. Pno arpeggios, then StrS with the melody (couple theme), a Hn
  countermelody at the peak.
- **Instruments:** Pno, StrS, Hp, Glk, Hn, a soft Timp swell.
- **Length:** 8 to 32 bars, with the swell timed to the slow-mo segment.
- **Varies with:** time to the peak (the engine schedules the climax at `hitAt`), the key-change toggle, density.
- **Echoes:** *Goblin*, *Crash Landing on You*, *My Love from the Star* swells.

**K8. Heart flutter**
- **Purpose:** a touch, a close-up, the heart skipping.
- **Gesture:** a quick rising Glk or Hp arpeggio, a soft Timp "ba-dump" (a doubled heartbeat), a sustained high StrS
  chord.
- **Length:** 1 to 3 s.
- **Varies with:** chord colour (add9 or maj7), whether the heartbeat doubles.

**K9. Sad flashback piano**
- **Purpose:** memory, loss, regret.
- **Tempo:** 56 to 72, rubato.
- **Mode:** minor or major with borrowed iv.
- **Harmony:** a lament bass (i–v/7–iv/6–V) or vi–IV–I–V.
- **Gesture:** solo Pno, sustain pedal, StrS entering in the second phrase, optional Fl.
- **Instruments:** Pno, StrS, Hp, Fl.
- **Length:** 16 to 32 bars.
- **Varies with:** strings entry bar, rubato depth, reverb (more for "further in the past").
- **Echoes:** the ballad tradition, *Silent Hill 2*.

**K10. Comic chase**
- **Purpose:** running after someone in a playful way.
- **Tempo:** 150 to 180.
- **Mode:** major or Mixolydian.
- **Harmony:** I–IV–V circles.
- **Gesture:** galloping Kit, StrP, Xyl runs, Hn whoops, and hit points for near-misses.
- **Instruments:** Kit, StrP, Xyl, Hn, SGtr strums.
- **Varies with:** tempo, the near-miss stings (K3 slide or K6 hit).
- **Echoes:** Danganronpa's momentum (minus the menace).

**K11. Triumphant**
- **Purpose:** a win, a comeback.
- **Tempo:** 110 to 130.
- **Mode:** major.
- **Harmony:** I–V–vi–IV, ending ♭VI–♭VII–I.
- **Instruments:** Hn melody, StrS, Timp, Kit, Pno.
- **Length:** 8 to 16 bars.
- **Varies with:** the key lift, density.

**K12. Awkward silence**
- **Purpose:** the deadpan beat after a gaffe.
- **Behaviour:** a tape stop on whatever is playing (every source's playbackRate ramps to 0.3 over 150 to 250 ms,
  with a lowpass sweep to 300 Hz), then silence. Optionally, one lonely StrP or Glk note after 1.5 s.
- **Varies with:** stop speed, whether the lonely note plays.

**K13. Eye-contact sparkle**
- **Purpose:** a held look.
- **Gesture:** a Glk plus Hp shimmer on a maj7 or add9 chord, a high StrS sustain swell.
- **Length:** 1 to 4 s.
- **Varies with:** chord colour, shimmer density. Can roll straight into K7.

**K14. Rimshot / punchline**
- **Purpose:** a punchline.
- **Gesture:** "ba-dum-tss" on the Kit, or a two-note comic tag (Xyl "ta-da", StrP "bonk").
- **Length:** under 1 s.

### 4.3 Romance-horror crossover

**X1. Yandere sweet waltz**
- **Purpose:** her theme, in its innocent form.
- **Tempo:** 84 to 100 in 3/4.
- **Mode:** major or Lydian.
- **Harmony:** I–iii–IV–V or royal road, rich and lovely.
- **Gesture:** a lilting Fl melody, Hp and Pno oompah, a StrS cushion.
- **Instruments:** Fl, Hp, Pno, StrS, Glk sparkle on the phrase ends.
- **Varies with:** wrongness (0 here, rising later in X2), melody seed, density.
- **Echoes:** *Phantom Thread*'s too-intense romance, the Attorney Woo waltzes.

**X2. Sweet then wrong (the corruption ladder)**
- **Purpose:** the same theme as X1, degraded by `wrongness` as her obsession shows.

| Stage | wrongness | What changes |
| --- | --- | --- |
| 1 | 0.2 | One wrong note per phrase, a slight detune |
| 2 | 0.4 | Lydian ♯4 held too long, a tritone drone underneath, tempo drifting slower |
| 3 | 0.6 | Notes dropped, the music-box wind-down, chromatic-mediant cadences (I to ♭vi) |
| 4 | 0.8 | The melody on StrT ponticello, a stalker ostinato under it |
| 5 | 1.0 | A smeared cluster of the theme's notes, broken off by silence |

- **Echoes:** *DDLC*, *Squid Game*'s wrong note.

**X3. The turn**
- **Purpose:** the instant sweetness becomes threat (she smiles, and the knife shows).
- **Gesture:** mid-phrase, every instrument but one stops (or a tape stop). One beat of silence. Then the same melody's
  next note arrives a semitone lower on low Pno with a StrT cluster bloom.
- **Length:** 2 to 4 s, then H2 or H5.
- **Varies with:** stop type (cut or tape stop), length of the silence, which note bends.

**X4. Obsession confession**
- **Purpose:** she declares her love, and it's too much.
- **Tempo:** 66 to 76.
- **Harmony:** a royal-road ballad with a minor-major 7th chord and ♭2 suspensions.
- **Gesture:** a K7-style swell that keeps rising past where it should stop. The key goes up a step, then again, then
  again (one key change too many). Strings move into tremolo.
- **Instruments:** Pno, StrS, StrT, Hn, Hp.
- **Varies with:** number of modulations, tremolo onset.
- **Echoes:** the K-drama key-change climax, made sinister.

**X5. Ghost lover lullaby**
- **Purpose:** a tender scene with something dead.
- **Tempo:** 60 in 6/8.
- **Mode:** Aeolian.
- **Gesture:** NGtr arpeggios, a Fl melody, StrS harmonics. Every few bars, a TBell note too low and too long.
- **Varies with:** bell probability, detune.
- **Echoes:** *Hotel del Luna*, the *Goblin* dark cues.

**X6. Cute but watched**
- **Purpose:** a K-drama comedy scene that she is secretly watching.
- **Behaviour:** play K1, K2 or K4 normally, but add an almost inaudible H7 layer (−30 dB). The player feels it before
  they hear it.
- **Varies with:** the level of the hidden layer.
- **Echoes:** *Yandere Simulator*, *Danganronpa*'s psycho-pop.

That makes 32 cues.

**Sources (section 4):** the cue designs are syntheses of the sources in sections 1 to 3, especially
[Sound On Sound: Jung Jae-il](https://www.soundonsound.com/people/jung-jae-il-squid-game-parasite-soundtracks),
[WXTJ on DDLC](https://www.wxtj.fm/wxtj-writes-by-meredith-hunsader-the-genius-behind-doki-doki-literature-clubs-soundtrack/),
[Royal road progression (Wikipedia)](https://en.wikipedia.org/wiki/Royal_road_progression),
[Tropedia: Ominous Music Box Tune](https://tropedia.fandom.com/wiki/Ominous_Music_Box_Tune),
[Yamaha: spooky string techniques](https://hub.yamaha.com/strings/s-how-to/eight-spooky-string-techniques) and
[Epidemic Sound on jump-scare sounds](https://www.epidemicsound.com/filmmaking/jumpscare-sound-effects/).

---

## 5. Practical rules

### 5.1 Orchestration and registers

- **Clear the voice.** The Japanese dialogue sits at roughly 150 to 400 Hz fundamentals, with intelligibility at 1 to
  4 kHz. Under lines, keep the pads below about 250 Hz or above about 4 kHz, or duck the music 6 to 10 dB. K-drama BGM
  sits under dialogue and swells in the gaps.
- **Piano:** the low register (A0 to C3) is for doom and pedals, the middle (C3 to C5) for ballad accompaniment
  (watch the voice), and the top octave for music box and sparkle. The 4 velocity layers are the main colour control:
  use layer 1 for tender, layer 4 only for hits.
- **Strings:** the sustain carries the romance in the middle and upper register. Very high and quiet means harmonics
  (eerie). Very low means drones. Tremolo means unease at low level and terror at high level. Pizzicato means comedy
  at mid register and fast tempo, and menace at low register and slow tempo. *The articulation you choose sets the
  genre.*
- **The one horn** is a soloist, not a section: romantic countermelodies, the "dun" of comic shock, a stopped or
  distorted blat in stingers. Don't let it play long chords that expose it as one player.
- **Mallets:** Glk means cute or sparkle (or music box when slow). Xyl means comedy or giggles (but distorted, a horror
  colour, as in DDLC). Mar means warm, soft, wooden ticks. TBell means fate, death or church; use it rarely so it
  stays meaningful.
- **Timpani:** thuds, heartbeats, rolls for swells. A short pitch bend down (playbackRate 1 to 0.85 over the decay)
  gives a comic "boing" thud.
- **Flute:** whistle stand-in, slide-whistle stand-in (bent sustain), breathy horror air (sul tasto blend).
- **Guitars:** NGtr for tender lullaby or ukulele-like cute. SGtr for bright comedy strums or a lonely detuned
  arpeggio in horror.
- **Substitutions:** celesta becomes soft Glk plus top-octave Pno. Ukulele becomes high NGtr voicings. Whistle becomes
  Fl sustain with 5 Hz vibrato. Choir "aah" becomes very soft StrS in close voicing with a slow filter. Woodwind
  answers (bassoon) become low StrP or low Mar.

### 5.2 Levels

- Horror must have **headroom**. Keep the drone floor at about −30 to −24 LUFS short-term so a stinger can jump 18 to
  24 dB. A constantly loud score drains the scare.
- Comedy cues sit higher and drier (less reverb) so their punctuation reads. Romance gets more reverb and a wider
  stereo image. Horror whisper layers get long, dark reverb.
- Stingers should be fast-attack samples (Pno, Timp, Kit, StrP). A slow-attack string sustain can't land on a frame
  unless pre-triggered (see 5.4).

### 5.3 When to use silence

- **Before a scare:** always, at a randomised length (H12). Sometimes nothing follows.
- **After a scare:** 1 to 3 s of tail, then silence or a low drone. Don't rush back into music.
- **In the comedy:** the deadpan beat (K12) is often funnier than any sting. Pros on scoring forums warn that if a
  joke already works, the music needn't sell it.
- **In romance:** cut the music out just before the kiss, or the confession's key line, and bring it back on the
  reaction. The return lands harder than a continuous swell.
- **Stealth:** drop music as the threat gets closest (H8), so the player hears footsteps and their own heartbeat.

### 5.4 Cutting music to action (K-drama editing habits and hit points)

- **The hit lands on the action frame.** A hit point is an accent that lands on the exact frame of an event (the
  slap, the landing, the door). For percussive samples, trigger at the frame. For strings and horn, pre-trigger by
  the sample's attack time (sustain strings about 80 to 200 ms, horn 50 to 100 ms), so the perceived onset meets the
  frame. **Implement `hitAt` as "perceived onset", with an onset-offset table per sample.**
- **Pre-hits for anticipation.** Comic falls get the slide during the airtime and the thud on impact. Scares get the
  silence before them. Romance swells reach their peak *on* the look, not after it.
- **Phrase-aware cutting.** K-drama editors start and end cues at phrase boundaries where possible. When a scene
  cuts mid-phrase, the cue either stops dead (a joke: tape stop or record scratch) or resolves quickly on a 1 to
  2-beat tag. The engine should be able to (a) end at the next bar line, (b) end within a beat with a cadence tag, and
  (c) stop now with a tape stop.
- **Short bursts, often.** As in the *My Love from the Star* study, prefer many short cues (4 to 20 s) that react to
  beats over long through-composed beds, and give each motif a cooldown so it doesn't wear out.
- **The OST moment.** A couple's theme (K7) is a reward: save the full swell for the main romantic beats and the
  end-of-chapter cliffhanger, where it plays over the freeze. Use fragments of it (two bars on solo Pno) elsewhere.
- **Stingers come in families.** Keep a few distinct shock types (comic K6, sinister H9, full H4) so the player learns
  the tone of the moment from the sting.
- **Mickey-mouse comedy, not horror.** Tight sync is right for K-drama comedy. In horror, exact sync on every footstep
  turns it into comedy. Horror sync should be sparse: only the scare, the reveal, the death.
- **Tempo locking.** For sneaking and chewing cues, set the tempo from the animation (step interval to beat), or
  quantise the events to the beat grid, so each step or bite lands on a note.

**Sources (section 5):**
[StudioBinder on mickey mousing](https://www.studiobinder.com/blog/mickey-mousing/) ·
[Mickey Mousing (Wikipedia)](https://en.wikipedia.org/wiki/Mickey_Mousing) ·
[Filmdaft on mickey mousing](https://filmdaft.com/what-is-mickey-mousing-in-film-meaning-and-examples/) ·
[The Jump Scare Lives (AUB)](https://graduateschool.aub.ac.uk/top-news/the-jump-scare-lives.html) ·
[LBB: horror sound design secrets](https://lbbonline.com/news/horror-sound-designs-secrets-how-audio-experts-craft-bone-chilling-scares/) ·
[Epidemic Sound on jump-scare sounds](https://www.epidemicsound.com/filmmaking/jumpscare-sound-effects/) ·
[VI-Control: comedy scoring techniques](https://vi-control.net/community/threads/comedy-scoring-techniques.65423/) ·
[My Love from the Star OST study (koreascience)](https://koreascience.kr/article/CFKO201816363645410.pdf) ·
[t2online on OST overuse](https://t2online.in/screen/k-drama/the-invisible-lead-actor--how-osts-become-the-catalyst-for-k-dramas/2000653) ·
[BAFTA: Psycho](https://www.bafta.org/?p=370698)

---

### Verification notes

- The searches couldn't confirm a composer for *Business Proposal*, *Hotel del Luna*'s underscore, *Secretary Kim* or
  *Weightlifting Fairy*. Kim Jun-seok's K-drama credits were not found. Gaemi is confirmed only on *Descendants of the
  Sun*.
- Kingdom's composer (Mowg) is from general knowledge and was not confirmed by a search.
- Higurashi's "you" belongs to the original game's music (by dai). Kenji Kawai scored the anime adaptations.
- The K-drama comedic gesture vocabulary in 1.3 is assembled from stock-library descriptions, trope sources and
  general knowledge. No Korean-language scoring text was found. Worth checking against a few clips from *Business
  Proposal* and *Strong Woman Do Bong-soon* before locking the cue designs.
