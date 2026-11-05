# Uncovering a story through things: documents, books and containers

2026-11-05. The second of three notes for the user's "simple but build up to a story / uncovery / dread" (the others:
research/dread_structure.md, research/simple_loops.md), and the research behind the parts being built with it: a book
that opens page by page with handwriting and a clean-text panel, whose entries progress with the game; suitcases that
hold things; closets with doors. Read as search extracts (about 40): every quote is an extract's wording, not the
page's. Inferences are marked as mine.

## 1. What the designers say

- **Stage the space to be read (Harvey Smith and Matthias Worch, "What Happened Here?", GDC 2010).** Environmental
  storytelling is "staging player-space with environmental properties that can be interpreted as a meaningful whole,
  furthering the narrative of the game": "interpreting (or pulling) information, in opposition to traditional fictional
  exposition". The tools: "props, scripted events, texturing, lighting and scene composition", and systems so the
  environment reacts. The player's own traces (decals, breakables, corpses) are story, and "cleaning these up is a
  design decision with consequences". A later paraphrase (not the talk): put an anchor clue on the player's path,
  corroborate it, and check the player actually reads the scene.
- **Strip everything but exploring and piecing together (Steve Gaynor, Gone Home, GDC 2014).** "Remove everything
  except for exploring the space, and finding stuff that tells a story and lets you piece things together in your
  mind"; connect "the high level structure, in the case of Gone Home the story, with these low level verbs", so an
  object means something once the player has the story. Numbers: 24 journal entries (23 and one hidden) over "a couple
  hours". The game has a toggle "between the object and the PC written text"; one player "couldn't read at all" the
  handwritten letter: the legibility failure, and the reason for the toggle.
- **Notes rough, short and sometimes wrong (Thomas Grip, Amnesia).** "The majority of the notes were only quick
  scribblings at most", the roughness "adds to the realism"; one note "conflicts with Daniel's own account"; players
  who skip notes "are going to lose out on some things"; "a sense of presence might actually be the best storytelling
  device".
- **The facts in the item text (Hidetaka Miyazaki).** He "wrote most of the item descriptions"; "important details of
  the story tend to be found in the descriptions of items in the inventory rather than in dialogue", "to stimulate
  the player's imagination"; Demon's Souls told through "faint clues such as descriptions of discovered items".
- **A log that joins fragments in any order (Outer Wilds, Alex Beachum).** Rumor Mode shows entries "in the way in which
  they relate to each other", laid out differently per player; four "curiosity webs" so the mystery goes in any order.
- **A document that visibly changes state (Lucas Pope, Return of the Obra Dinn).** A fate is a name, a cause and a
  culprit, confirmed only in threes so "you can't quite fudge it"; once three are solved "the handwritten notes in the
  Book will be replaced with type and will no longer be editable".
- **A quest log people read (Pathologic 2's mind map).** Small atmosphere-only events stay off it; the same node is
  updated in place instead of growing chains; future consequences appear as dashed nodes.
- **Handwriting is characterisation, with a clean fallback (Pentiment).** Six fonts "based on their social status and
  education"; "the Easy Read Fonts option is also available to improve legibility"; the fonts carry "redundant
  information", so the easy mode loses no story; a sloppy hand "can hint that they are an impostor".
- **An unreadable book with a few readable words (Tunic).** "Fill the game with a strange, unreadable language" so
  players feel "in a world that wasn't meant for them", with just enough English "to be basically comprehensible"; the
  booklet folded, ripped, taped, stained and scanned.
- **Ease in, ease out (Ian Dallas, Edith Finch).** "Ease them into it, and then ease them out of it, providing them a
  period of relative calm."
- **The note dump (secondary guides).** Audio logs become "exposition wearing exploration's clothes"; "press X to
  examine" on every detail "trains players not to look", while burying crucial beats makes them missable; keep a log
  "under a minute". No source gives a words-per-note or notes-per-hour rule.
- **Containers: generous storage, strict persistence (Resident Evil).** Six or eight inventory slots; an item box in a
  save room that "exists as a safe haven" and has "so many slots that players will never fill it up"; items staying in
  the one box they were put in was "deemed as being too punishing" (kept as a mode); RE Zero's items left on the
  ground "persist there until the player decides to pick it up again".
- **Placing things is the story (Witch Beam, Unpacking, GDC 2022).** "A little over 1000 different household items"; a
  narrative "inferred from objects"; "the 'right' decision should not shape how the player plays"; the replay recorded
  "each player action".
- **A hiding place must cost something (community essays).** Alien: Isolation's press-and-hold entry "builds tension";
  lockers are "dead ends with slow exit animations" and the alien checks them "the more they are used"; Outlast's
  closets were "godmode". The oshiire's sliding door "masquerades as a normal wall"; "boundary places" are where
  "something dwells"; the oshiire "appears frequently in Japanese horror".
- **Accessibility.** The Game Accessibility Guidelines: decorative fonts are hard for dyslexic players, offer an
  alternative; long text in mixed case, left aligned, 1.5 times line spacing, about 70 characters a line; EA's
  accessibility lead: a minimum of 28 px text height at 1080p, and resizing "should not excuse tiny default text".
- **Fonts.** Open handwriting fonts and their licences (extract-confirmed): Caveat (Impallari, OFL), Indie Flower
  (Geswein, OFL), Homemade Apple (Font Diner, Apache 2.0), Zen Kurenaido (OFL; its repo archived in 2026), Yomogi (OFL:
  Latin, kana, JIS level 1 and 2 kanji). By memory, to verify on their specimen pages: Klee One (Fontworks, OFL), Yuji
  Syuku (Kinuta, OFL), Kaisei (Font-Kai, OFL), Reenie Beanie, Shadows Into Light, Nothing You Could Do (OFL). An OFL
  font ships in a game with its licence text beside it and can't be sold alone. Fetched for the generator and the
  runtime this day: Caveat, Indie Flower, Yomogi, Zen Kurenaido (`tools/propgen/fonts/`, their OFL texts in
  `licences/`).

## 2. Examples

| Game | The object | How it reads | Numbers |
|---|---|---|---|
| Gone Home | letters and notes, journal entries voiced on a trigger object | the object held up, a toggle to typed text | 24 entries in about 2 h |
| Tacoma | AR recordings of the crew | scrubbed, rewound, followed per character | |
| Amnesia | Daniel's diary, others' notes | a journal in the inventory; "quick scribblings"; one note contradicts him | |
| Dark Souls | item descriptions | a paragraph in the inventory | Miyazaki wrote "most" |
| Outer Wilds | the ship's log | a web, per player | four webs |
| Obra Dinn | the book | handwriting replaced by type once three fates confirm, then locked | three parts a fate, three at a time |
| Her Story | a video database | a keyword search, five results a query | 271 clips |
| Pathologic 2 | the mind map | nodes updated in place; dashed future nodes | |
| Pentiment | dialogue in period hands | Easy Read toggle; a font size | six fonts |
| Tunic | the manual's pages | collected; mostly unreadable | 27 languages |
| Signalis | notes, posters, report cards | kept in Memories to re-read | |
| RE2's remake | files | read on pickup, kept in the menu | 58 files |
| Darkest Dungeon | journal pages | items that don't stack | series of six |
| Alan Wake | manuscript pages | out of order; they describe what hasn't happened yet | |
| Anatomy | cassettes | played on the kitchen's player; the house changes between tapes | |
| Unpacking | belongings into rooms | placement, no text | about 1000 items |
| Resident Evil | the item box | safe-room storage that never fills | six or eight slots |
| Alien: Isolation, Outlast | lockers, closets | hold to enter; reuse raises the risk, or none | |

## 3. A system for a 2.5 to 3 hour game (mine, built on the above)

**Counts.** Gone Home runs about twelve spine documents an hour; RE2's remake about seven. For our length: **30 to 36
readable things, about twelve an hour**, in three tiers: 6 to 8 **book entries** (the spine: one a quest or a night),
16 to 20 **notes** (short, rough, some wrong), 8 to 10 **inspect things** with a line or two (Souls' way). At most one
reading per room on the main route, a second only as the corroborating clue under the anchor; never two readings back
to back; nothing a quest needs is missable, only flavour is.

**Lengths** (200 words a minute, "under a minute"): a line of 20 words or fewer; a note of 30 to 80 words (Japanese 60
to 180 characters); a letter of 150 words at most, over a spread; a book entry of 60 to 120 words a spread. Three
registers, each its own hand: a *scribble* (rough, may lie), a *letter* (a clean hand), *print* (a bill, a notice, a
report card: a typeset font).

**The book that writes itself.** One diegetic book with entries gated by what has happened. As the format takes it
(the `book` use built this day, STORY_FORMAT): fixed `pages`, then `entries` each with its `if` (a flag, a to-do done,
a chapter reached) and its text, appended in order while the condition holds. The rules: entries **append, never
replace** (the old ones stay as evidence); a page is written only while the book is closed; the last page shows blank
ruled lines so the player knows more will come (Pathologic's dashed node, made diegetic); when a page appears the prop
shows it (a ribbon moved, a corner folded) and a soft sound plays once; one Alan Wake page a game that tells the next
scene before it happens, for dread; each page unread or read.

**The reading.** The book in the hands as the inspect use holds a thing, a two-page spread flat to the eye, one flip a
spread (about half a second, skippable), the book remembering its page. Beside the spread a **clean-text panel** (Gone
Home's toggle, Pentiment's Easy Read) in the UI's font, left aligned, 70 characters a line, 1.5 leading, 28 px or more
at 1080p, with a size setting; handwriting as a font on a paper texture, never a baked picture, so a language or a
size is free: the Japanese in Yomogi or Zen Kurenaido (a scribble), Klee One (a schoolbook hand), Yuji Syuku (an old
brush); the English in Caveat or Indie Flower as flavour, the clean panel always there. A pause-menu **log** lists
everything read with an unread count (Signalis' Memories, RE's files), never where to find the rest.

**Containers.** Everything placed stays where it was placed (RE Zero; Unpacking records every action): each carried
thing's transform, each container's open state and what it holds, saved. A suitcase is a two-step reveal: the lid,
then the folded clothes as a liftable layer, the journal under them (the anchor, then the corroboration). Lids and
hinged doors show their hinge and open on one verb; a sliding oshiire reads as a wall, so when it matters it needs a
cue: a gap, light under it, a sound. "Safe" is lit, in the sleep room, a latch sound that resolves; "dangerous" is
something changed since the last visit (a door ajar, a thing moved: Anatomy's house), a sound that doesn't resolve,
the state readable from the doorway. Knocked-over chairs and placed things are the player's own trace, and leaving them
there is the story (Smith and Worch); the cast may react to a thing moved. Hiding: Alien's rule, not Outlast's: hold to
enter, a slit view, reuse raises the chance of a check, a slow exit; a closet is never a free win. Sounds off the shelf
for a lid, a drawer, a fusuma, a latch, and one kept for "something new written".

## 4. What it means for the parts built with this note

- The **book** part (STORY_FORMAT: `use: book`, `pages`, `entries` with `if`, `hand`, the panel): §3's shape as data,
  the Director's HSThing taking the same fields, the handwriting fonts above.
- The **suitcase** (`container`): the lid a part on a hinge, what's placed in it kept through close, carry and reopen,
  `placed` and `taken` heard by the story (a to-do "pack the journal"); the folded clothes a thing of their own to lift.
- The **closets** (`open`, and `hide` with doors): the doors parts on hinges or slides; hidden in one the player's view
  is a slit, as the format's `locker`; the oshiire's doors read as a wall, so a cue is the story's job.
- The **moveables**: the player's traces stay (a chair knocked over stays over) unless the story tidies them, and the
  cast can notice (`moved` heard).
- Still open (mine): the pause menu's log of everything read; a "font size" setting; the one page that tells the next
  scene.

## Sources

Extracts of: worch.com (GDC 2010 slides and notes), gamedesign.gg, gamedeveloper.com (Gone Home's design constraints;
"Why is Gone Home a game?"; Pathologic 2's mind map; Unpacking at GDC 2022 and its design pillars; Ethan Carter's
narrative theory; the legible-font piece), gonehome.fandom.com, steamcommunity.com (Gone Home's handwriting thread),
pcgamer.com (Tacoma; Pentiment's fonts), lovecraftzine.com (Grip, 2015), soulslore.wikidot.com and note.com (Miyazaki),
outerwilds.fandom.com and paigecuthbertson.com (the ship's log), wireframe.raspberrypi.com and gamefaqs.gamespot.com
(Obra Dinn), en.wikipedia.org (Her Story, Alan Wake, Anatomy), x.com/obsidian (Easy Read), blog.playstation.com
(Tunic's manual), gamingtrend.com (Dallas), thinkygames.com (Blue Prince), marty64.net (the audio-log critique),
signalis.wiki.gg, darkestdungeon.fandom.com, thegamer.com (Lost Records), giantbomb.com and powerpyx.com (Resident
Evil's box and files), patternsinrandomness.blogspot.com and archive.vgfacts.com (lockers), note.com (the oshiire),
pocketgamer.biz (The Room), gameaccessibilityguidelines.com, fonts.google.com, github.com/googlefonts/zen-kurenaido,
serbyte.net (Yomogi).
