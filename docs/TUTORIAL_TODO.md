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
- [ ] TUTORIAL2 run again after the starter's `player.gd` change (`use()` asks Logic first). It wasn't run on this
      branch: it needs the desk's server. SEATS, MARKERS and LOGIC, which use the same player, pass.

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

## From `advanced-pbrs`: clothing fabric sets and the cloth shader (docs/TAILOR.md §1k, docs/GODOT_LOOK.md §5x)

**Must (or the tutorial is wrong or stale):**
- [ ] §34 *Every system in it*: add a row for the cloth shader (`HSCloth`, the HSCharacterLook node's **Cloth**
      switch, on by default): a character whose garments wear a fabric set in the Character Studio wears it in the
      game with nothing to set up.
- [ ] Her export made again: the tutorial's character was exported before the fabric sets and the collar rule, so her
      file carries no fabric records and her collar is as it was. Dress her in sets (the PBR set picker, or a
      **Fabric sets** outfit) and export again, or say she wears the older fabrics.
- [ ] TUTORIAL2 run again: the look plugin grew (`cloth.gd`, the packs in `textures/cloth/`, 16 MB) and the
      character look node calls `HSCloth.wear`. It wasn't run on this branch (it needs the desk's server).

**Should:**
- [ ] §30 *Her looks* or the character's section: one picture of her knit or her tights close up, and the two
      numbers a player of the editor can turn (`cloth_fuzz`, `cloth_detail`).
- [ ] A line on `HSCloth.dress(mesh, 0, "Leather001", colour)` for a prop of cloth made by hand (a curtain, a sofa)
      whose second UV is in metres, if the tutorial ever dresses one.
