# Tutorial v2: what to update, branch by branch

The tutorial (`guides/tutorial_v2/index.html`, built and played by `tools/godot/tutorial_v2.py`: TUTORIAL2) is brought
up to date in one go, on a branch of its own, once the parallel branches are in (the user, 2026-11-14: "I have other
parallel branches that will need updated for tutorial so will leave that to do in a bulk new branch later"). Until
then each branch leaves a section here saying what it changes for the tutorial. Nothing below is done yet.

## From `claude/trusting-cray-2v2ntr`: flags and things (docs/FLAGS.md, guides/flags)

**Must (or the tutorial is wrong or stale):**
- [ ] §34 *Every system in it*: add rows for the Logic node, the Flags tab, the Things tab, the Inspector's pickers
      and F7's flag board; take "an interactable can't ask for a flag" (and the like) out of what a game by hand
      can't do yet.
- [ ] §35 *Where to go next* and the page's links: point at `guides/flags/index.html` (and `guides/markers/`, which
      the tutorial doesn't name either).
- [ ] §9 *The project*: a project made before this needs `python tools/godot_byhand.py install <folder> --starter`
      once (the player asks a thing's Logic); say so beside the install line.
- [x] TUTORIAL2 run again after the starter's `player.gd` change (`use()` asks Logic first). It wasn't run on this
      branch: it needs the desk's server. SEATS, MARKERS and LOGIC, which use the same player, pass. (Run on
      `enhancements`, 2026-11-15, with this merged: TUTORIAL2 ok.)

**Should (the tutorial done the fast way, which is the point of the tabs):**
- [ ] §10 *The scene*: the player, the Story, the HUD and Sound added by the Things tab's **Set up the scene**
      instead of four steps by hand.
- [ ] §16 *A note, a key, batteries*: made with the **Pickup** and **Note** cards on the selected model; their
      fields filled in the Things form (the pickers list the tasks).
- [ ] §5 / §16 room 304's lock: shown in the door's form (*Locked by*, with the picker) rather than typed in the
      Inspector; the hotel floor's doors are the export's (`doors/door_<id>`), which the Things list knows.
- [ ] §17 *Moments* and §18 *Scares*: areas placed by the **Area** and **Scare** cards (a click on the floor); their
      Needs set by chips.
- [ ] §23 *Cues* (the slippers, `checked_in`, the Story's Task Flags) and every other place a flag is typed (§30 her
      looks' Needs, §31 the hunt's needs and `armed`): say the name is picked from the chips' **+**, and show the Flags
      tab once with the tutorial's own flags, both ends of each.
- [ ] One thing gated the new way, so the Logic node is in the game: e.g. the linen closet's door or the vending
      table's radio *works only when* the corridor has gone dark; and one plain mesh made a button (a light switch in
      304 that flips a flag a lamp's Show / hide reads).
- [ ] §33 *Play it*: F7 (what she waits for, and the flag board) as the way to see why something doesn't happen.
- [ ] The Flags tab's **Problems** run on the finished tutorial scene: fix or explain whatever it lists (it will be
      the first real scene it reads: expect flags the kit sets by itself that it doesn't know yet, and add them to
      what `HSLogicScan` takes as the kit's).

**Could (a bigger rewrite: decide in the bulk branch):**
- [ ] Her parts (§20, §22's closer and searcher, §31's hunt) stay the starter's scripted nodes. One of them done
      again with NPC markers (CONTINUE's open item from the marker system) would show markers and things tied in a
      real game: a marker that waits for 304's door (*A thing… click it*), a door that waits for her marker.

**For the build and its check (`tools/godot/tutorial_v2.py`, `tutorial_v2_test.gd`):**
- [ ] whatever the steps above add to `main.tscn` is written by the builder as the tabs would save it (an `HSLogic`
      child, `res://flags.json` if notes are kept), and played in the test: the gate refused then allowed, the
      button's flag, F7's board listing the tutorial's flags.
- [ ] new pictures for the changed sections (`--pictures`); the two tabs' own pictures can be taken from the
      tutorial's scene with `logic_editor_test.gd`'s `shot()` way rather than the test room's.

## From `even-more-animations-v3`: animations v3, short NPCs, life and carrying (docs/ANIMATOR_V3.md, docs/ANIMATION_RULES.md, guides/animator, guides/sequences)

**Must (or the tutorial is wrong or stale):**
- [ ] Her characters are **baked again** by the Animator (its `VERSION` is 5: 96 clips; the tutorial's were baked at
      2 or not at all). Say so where a character is first dropped in, and in §31 (*the hunt*).
- [ ] §34 *Every system in it*: add rows for a head that follows you (HSHeadTrack), a grip on a prop (HSGrip), small
      movements and carrying (HSGesture), the low gaits, the peek and the jump scares as her own clips; take
      "moves" out of what a game by hand can't do yet (her own creep, crawl, peek and lunge are baked now), and
      "faces" if the markers' Face row is used.
- [ ] §35 *Where to go next*: point at `guides/animator/index.html` and `guides/sequences/index.html`.
- [x] TUTORIAL2 run again after the starter's `motion.gd`, `act.gd` and `player.gd` changes (`struck`, the life
      layer's calls). It wasn't run on this branch: it needs the desk's server. (Run on `enhancements`, 2026-11-15,
      with this merged: TUTORIAL2 ok.)

**Should (what the new animations are for):**
- [ ] §31 *the hunt*: her `moves.gd` is given Kimodo clips with prompts. With a baked character it can be left
      empty: `stalk` is her creep, `crawl`, `peek` and `lunge` her own. Say which the tutorial uses and why.
- [ ] §20 her at 308's door, §22's closer: `head_follow` on her (she watches you past the corner) and `uncanny.gd`'s
      head tilt still on top.
- [ ] The first, harmless her in the corridor: *Alive* on her Motion node (or her HSNpc's *Small movements*), switched
      to none where the night turns: the contrast is the scare.
- [ ] One thing she carries (the room's key on its fob, a candle from the bath): `hold()` or a Grab's Keep in hand,
      and its HSGrip's Carry.
- [ ] The hotel floor against the modelling rules (docs/ANIMATION_RULES.md): run ANIMRULES' ranges on the set's own
      seats, beds and doors where she uses them; 304's desk chair 0.35 m from the desk; the standing room where she
      waits alive.

**Could:**
- [ ] One of her parts as a sequence from `guides/sequences` (the hand-over at 304's door, the peek at the corridor's
      corner) in place of a scripted node, tied to a door or a pickup by the Things tab.
- [ ] The markers' new cards where the tutorial has their scripted twins: **Peek** for her at 308's door,
      **Take from you** / **Hand to you** for anything that changes hands (the shop's parcel is the laptop's own),
      **Look at it** on whoever carries something. `guides/sequences` section 9 (*nearer each time you look away*)
      is `closer.gd`'s idea made of Start here markers: say which the tutorial uses and why.

## From `advanced-pbrs`: clothing fabric sets and the cloth shader (docs/TAILOR.md §1k, docs/GODOT_LOOK.md §5aa)

**Must (or the tutorial is wrong or stale):**
- [ ] §34 *Every system in it*: add a row for the cloth shader (`HSCloth`, the HSCharacterLook node's **Cloth**
      switch, on by default): a character whose garments wear a fabric set in the Character Studio wears it in the
      game with nothing to set up.
- [ ] Her export made again: the tutorial's character was exported before the fabric sets and the collar rule, so her
      file carries no fabric records and her collar is as it was. Dress her in sets (the PBR set picker, or a
      **Fabric sets** outfit) and export again, or say she wears the older fabrics.
- [x] TUTORIAL2 run again: the look plugin grew (`cloth.gd`, the packs in `textures/cloth/`, 16 MB) and the
      character look node calls `HSCloth.wear`. It wasn't run on this branch (it needs the desk's server). (Run on
      `enhancements`, 2026-11-15, with this merged: TUTORIAL2 ok, with her as a stand-in capsule: no Studio export
      on that machine.)

**Should:**
- [ ] §30 *Her looks* or the character's section: one picture of her knit or her tights close up, and the two
      numbers a player of the editor can turn (`cloth_fuzz`, `cloth_detail`).
- [ ] A line on `HSCloth.dress(mesh, 0, "Leather001", colour)` for a prop of cloth made by hand (a curtain, a sofa)
      whose second UV is in metres, if the tutorial ever dresses one.

## From `enhancements`: the tools reviewed (docs/TOOLS_REVIEW.md)

**Must (or the tutorial is wrong or stale):**
- [ ] §34 *Every system in it*: E's prompt is built now (the starter's player puts Open, Take, Read, Sit, Lie down,
      Hide, Use, or Locked in red, on the scene's HSHud for whatever it's aimed at): take "E's prompt" out of what a
      game by hand can't do yet, and say a script of your own gives its words with `use_prompt(by)`.
- [ ] §31 *the hunt*, dying and checkpoints: dying now puts the world back as the checkpoint had it (a pickup taken
      since lies where it was again, a once-only area or cue fires again: the group `hs_keeps`). Say so where dying is
      explained; the slippers (`shown.gd`) come back to where they were at the checkpoint too, and so do the laptop's
      shop and the parcels (an order on its way comes again, a parcel opened since is there again shut).
- [ ] If the user turns the Story's **`use_hud`** on by default (built off, E34): the tutorial's objective, list and
      lines are on the HSHud's corners and footer, and every picture with them wants retaking.
- [ ] §34 *Every system in it*: a game by hand has **the pause menu** now (a Node called Pause with
      `starter/pause.gd` beside the HUD: Esc holds the game; Save game and Load game are the Story's saves): add it to
      the tutorial's scene and take "the pause menu" out of what a game by hand can't do yet.
- [ ] §31 or §34: the night can be **saved** now (the Story's Saving group: *Autosave* at each checkpoint, *Continue
      Saved* at the start, F5 and F9 with *Save Keys*; `save_game`, `load_game`). Say so where dying and checkpoints are
      explained, and take saving out of what a game by hand can't do yet if it's listed. Not in a save yet: the double
      once it came in a parcel, the laptop's orders, a parcel, the hunt's stage: a save made before the gun comes is the
      honest one to show.
- [ ] §9 *The project*: `godot_byhand.py install` now leaves a plugin you switched off off, and says when the
      project's `starter/` differs from the studio's (then `install --starter`).
- [x] TUTORIAL2 run again after the starter's `player.gd` (the prompt, a blow as a scare), `story.gd` (the world kept
      with a checkpoint, saves) and `reach.gd` (a pickup's or a note's reach on layer 2), the laptop and its parcels kept
      at a checkpoint, scares added late heard: TUTORIAL2 ok on this branch (2026-11-15, with the desk's server here).
      Its ready-made floor's comparison now leaves out the made sets' names, which hash their sets' file times: a
      fresh checkout's differ from the machine the floor was made on, though what it holds is alike.

**Should:**
- [ ] The pictures with a prompt in them: aimed at 304's door the HUD now says *Locked* in red until the key's in the
      pocket, then *Open*; at the note *Read*; at the key *Take*. §16 and §5's pictures want retaking.
- [ ] 304's bath door is 0.70 m wide, under the 0.75 m the animation rules want for a door a character walks through
      (`level_check` now warns): widen it in the set (and make the ready-made export again) if she ever walks in.
