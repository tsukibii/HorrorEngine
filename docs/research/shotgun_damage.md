# What a 12-gauge leaves on a wall: the double barrel's damage

The user (2026-11-09, last): "Note I don't want the single barely shotgun, only the double barrel one, inspect how it
looks with the muzzle and what kind if wall damage it should have".

This note sets what a shot from the double barrel leaves where it lands, by distance and by surface, and what the
weapons plugin does to match (`impacts/impacts.gd` `play_shot`, `impacts/impact.gd`'s Together group, the maps
`tools/weapon_fx.py` makes, `gun.gd` `_shoot`). WEAPONS checks it (`tools/godot/weapons_test.gd` §8g) and the guide
shows it (`guides/weapons/img/damage_*.jpg`).

**How it was gathered.** Four web searches. Most sources are gun-media pattern tests, forum threads and forensic
references; none is a controlled study of shotgun holes in a painted wall. **A quote is the search engine's extract of
the page linked.** "(ours)" marks a number we chose for the game where the sources give none.

## 1. The pattern: how far apart the pellets land

- **00 buckshot from an open choke spreads less than the old rule of thumb.** The "one inch per yard" rule "has pretty
  much been busted"; one tester found the spread "approximately half of the anecdotal 1″ per yard spread for stock
  barrels" ([Fishgame](https://fishgame.com/2014/07/myth-busting-1%E2%80%B3-per-yard-shotgun-pattern-spreads/)).
- **Measured:** "a modern 00 buckshot load from a cylinder choke will typically spread out just 8 to 10 inches at 10
  yards", "more like 8 inches at 10 yards and 15 inches at 20" ([GunMag Warehouse](https://gunmagwarehouse.com/blog/whats-the-effective-range-of-buckshot/)).
  In one home-defence test "all of our patterns at ten yards were between three and seven inches"
  ([Active Response Training](https://www.activeresponsetraining.net/patterning-three-common-buckshot-loads)).
- **The load matters more than the choke:** "what made a much bigger difference was the quality of the buckshot load
  itself"; shot cups (Flite Control and the like) "will shoot the tightest pattern", buffered loads larger ones
  ([Lucky Gunner](https://www.luckygunner.com/lounge/choke-tubes-for-home-defense-shotguns/),
  [American Hunter](https://www.americanhunter.org/content/improving-buckshot-performance/)). Chokes tighten the
  pattern with distance ([Shooting Illustrated](https://www.shootingillustrated.com/content/the-beginner-s-guide-to-shotgun-chokes/),
  [hunter-ed](https://www.hunter-ed.com/muzzleloader/studyGuide/Shotgun-Choke-and-Shot-String/222099_88885/)); pattern your
  own gun at the distances you'll use it ([Field & Stream](https://fieldandstream.com/stories/guns/shotguns/what-distance-should-be-used-to-pattern-a-shotgun),
  [Pew Pew Tactical](https://www.pewpewtactical.com/shotgun-patterning/)).

**What the double does.** A field double's barrels are choked differently. The right (the first shot, the front trigger)
is improved cylinder, the left modified: `chokes` (0.9°, 0.7°) as each barrel's cone's half angle. The pattern spreads
from the **muzzle**: its apex is the muzzle's point on the view's line, so the shot goes where you look and its size is
the muzzle's distance's. Spread from the eye, a metre behind the muzzle, it landed 40% wider at room range (LESSONS).
Nine 00 pellets land denser in the middle (`cone * sqrt(u) * lerp(0.55, 1, v)`). Simulated over 20,000 shots, the right
barrel's pattern measures (from the muzzle):

| Muzzle to wall | Across (5th to 95th percentile) | What the sources give |
|---|---|---|
| 0.3 m | under 1 cm | one hole about the bore's size |
| 1.4 m | 3.5 cm (2.7 to 4.4) | |
| 2.5 m | 6 cm (4.8 to 7.8) | 2 to 3 in at 3 yd |
| 4.5 m | 11 cm (8.5 to 14) | |
| 9 m | 22 cm (17 to 28) | 8 to 10 in at 10 yd; 3 to 7 in with the best loads |

The left barrel's pattern is about four fifths as wide.

## 2. What the pellets do to a wall, by distance

The forensic books describe the same sequence on skin and on a target.

- **Contact to about an arm's length: one hole.** The charge hasn't opened yet.
- **Intermediate:** "a central hole surrounded by independent satellite holes created by dispersing pellets".
- **Distant:** "No central hole; the lead shots are completely dispersed, with each pellet creating an independent
  wound" ([AMBOSS](https://www.amboss.com/us/knowledge/forensic-ballistics)).
- **What's measured together:** the central hole, the satellite pattern, soot, powder tattooing and the wad's abrasion
  ([forensicmed.co.uk](https://www.forensicmed.co.uk/wounds/firearms/gunshot-wounds-smooth-bore-weapons/),
  [Utah WebPath](https://webpath.med.utah.edu/TUTORIAL/GUNS/GUNINJ.html)).

**Through plasterboard:** "buckshot passes through standard interior drywall at close range and the wad can leave its own
hole"; "00 buck went through both layers of drywall, but surprisingly not through the stud". In one test the wad "stuck
in the second wall, leaving a nasty wound in both walls one and two"
([Athlon Outdoors](https://athlonoutdoors.com/article/home-defense-shotgun-ammo-test/),
[AR15.com](https://www.ar15.com/forums/general/Sheetrock_Walls___Facts_not_Opinions/5-218312/),
[Loadout Room](https://loadoutroom.com/pdx1-defender-ammunition-2/),
[USCCA](https://www.usconcealedcarry.com/blog/what-happens-if-you-miss-home-defense-caliber-comparison/)).

**What the plugin does** (`HSImpacts.play_shot`):
- **Pellets that land together tear one hole.** Pellets within `merge_m` (1.6 cm, ours: a 00 pellet's hole is about
  8 mm, so nearer than that the bridge between two tears breaks) join, each to the next, into one group. A group of
  `merge_min` (3) or more is one torn hole (`fx/blast_*`). Its hole is the group's width plus a pellet's, and round it the
  paper is torn back in flaps, the plaster broken out and cracked.
- **The rest are craters of their own** (`fx/crater_*`): an 8 mm hole in a ring of chipped paint.
- **Simulated with this rule:**
  - at 0.3 m, every pellet in one hole;
  - at 1.4 m, one torn hole of seven or more 96 times in 100;
  - at 2.5 m, a torn middle 97 times in 100 (holes round it most of those times);
  - at 4.5 m, six or more pellets alone 83 times in 100;
  - at 9 m, a torn group only 5 times in 100.

## 3. The powder and the wad

**Soot and grains** are measured in forensics on skin, and the figures differ by source:
- Soot "tails off with increasing distance (20 – 40 cm)", absent "at about 40 cm"; powder tattooing "is not usually seen
  beyond 1 metre" ([forensicmed.co.uk](https://www.forensicmed.co.uk/wounds/firearms/gunshot-wounds-smooth-bore-weapons/)).
- For shotguns: smoke "up to 45 cm", unburnt powder "60–90 cm" ([AMBOSS](https://www.amboss.com/us/knowledge/forensic-ballistics)).
- On fabric, a 2019 study saw soot "from a muzzle distance of contact to 1 foot (30.5 cm)" and none at 9 ft
  ([J Forensic Sci 64(5), 2019](https://doi.org/10.1111/1556-4029.14055); [NCJRS](https://www.ncjrs.gov/App/Publications/abstract.aspx?ID=235664)).

**What the plugin does:**
- `soot_m` 0.4 m: within it, the smoke's black starburst (`fx/soot_0`), darker and smaller the nearer.
- `powder_m` 0.9 m: within it, the grains peppered round the hole (`fx/grains_0`: burnt specks and a few paler unburnt
  ones, thick in the middle and thinning out), wider and fainter the farther.
- Both are colour only: the wall's own relief stays under them.

**The wad.** It "initially travels with the central pellet mass ... Beyond 1.5-1.8 metres, the wad may not follow the
pellet mass, and consequently strikes the body separately, giving rise to a separate area of abraded skin"
([forensicmed.co.uk](https://www.forensicmed.co.uk/wounds/firearms/gunshot-wounds-smooth-bore-weapons/)).

**What the plugin does:** `wad_m` (1.5 m, 5 m). From 1.5 m the wad leaves a dent of its own (`fx/wad_0`: a shallow dish, a
scuffed ring, its petals' marks) near the pattern's middle, drifting off the line the farther it flew. Nearer, it went
into the hole. The 5 m end is ours: a plastic wad slows fast, and the sources give no distance where it stops reaching.

## 4. Hard surfaces: concrete, stone and steel

- "Pellets of soft lead striking hard unyielding surfaces deform in the manner expected of soft pliable materials. The
  angle of ricochet is low" ([AFTE](https://afte.org/?p=15465)).
- 12-gauge buckshot against tiles on concrete leaves ricochet marks that "can imply their impact angles"
  ([University of Kent](https://kar.kent.ac.uk/id/document/3442291)).
- Lead balls against a steel plate splash into petals and fragments, by speed
  ([Pyramyd Air](https://www.pyramydair.com/blog/2009/09/splatology)).
- Buckshot ricochets readily, but small shot's ricochet range is short ([Wikipedia](https://en.wikipedia.org/wiki/Ricochet)).

**What the plugin does:**
- On a surface marked `hard` (concrete, stone, metal in `SURFACES`), a pellet's crater or a torn hole becomes a lead smear
  (`fx/smear_*`): a grey metallic splash over a shallow dent, chips round it, the ORM's blue its metal.
- The surface's chips and dust still fly, and sparks off metal.
- The soot, the grains and the wad's dent are left as on a soft wall.

## 5. What WEAPONS checks, and what isn't built

**WEAPONS §8g**, the right barrel at two panels across the corridor's east end, seeded so it's the same each run (the
sizes hold for any seed):

| Case | Muzzle to wall | What the check wants |
|---|---|---|
| Arm's length | 0.15 m | one hole holding at least 7 of the 9 pellets, under 1.5 cm across; soot and grains; no wad of its own |
| Across a room | 2.5 m | 3.5 to 9.5 cm across; a torn middle with holes round it; the wad's dent; no powder |
| Down a corridor | 4.5 m | 7 to 16.5 cm across; at least 5 pellets alone; the wad's dent; no powder |
| Concrete | 2.5 m | smears only, no holes |

Each barrel's pellets also stay inside its own choke's cone (§2, §3).

**Not built:**
- **Pellets through a wall.** Plasterboard doesn't stop buckshot. A pellet that holes a thin wall could carry on into the
  next room (and its hole show on the far side). Doors and partitions would need a thickness.
- **Ricochets** off concrete and steel at a low angle.
- **The wad as a thing:** it could lie on the floor after a shot from a few metres.
