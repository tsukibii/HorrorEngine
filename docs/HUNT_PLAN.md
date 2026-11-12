# The hunt: being hunted as a hidden quest (a plan)

DECISIONS 2026-11-12, after the pull request. The user: *"an interesting horror sequence of being hunted e.g. we
trigger a 'hidden' quest called survive the hunt, and select an npc that is hunting you, we can add behaviours
(animations), jump scaring events, paths, have hidden hunt event boxes around the map for certain animations to play
out, have behaviours where it goes invisible, allow it to 'kill' the player if it touches them, they need to be
designed in a way where the player can survive them too but the goal is ultimate creepiness, we don't want the
creatures just running up to you, maybe if it's dark they would, or maybe we would trigger events where we see them run
past you very quickly into another room etc, hunts don't always have to be aggro ones where you can die, there can be
'hunts' that basically act like haunting events, maybe you need to complete a task to get them to stop e.g. turn the
power back on."*

**Built 2026-11-12, the same day** (the user: "I like your plan ... consider how to attach animations to the
behaviours (from kimodo), implement this plan and then update tutorial v2 to have a brief hunting phase before the
final shotgun one"): the starter kit's `hunt.gd`, `hunt_spot.gd`, `moves.gd` (Kimodo clips per behaviour, §8),
`checkpoint.gd`, `sight.gd` and the Story's `die()`; HUNT (`tools/godot/hunt_check.py`); tutorial v2 §31. **Built as
planned:** the hunt node and its three kinds, hidden and revealed, what starts and ends it, stages and their facts,
every kind of spot in §3, the rush rules with a tell, hiding calling it off, death and the checkpoint with the hunt a
stage lower, grace and mercy, hauntings ended by a task, the cloak as a state and a water shell showing her, her
moves. **Not built, still as written below:** navigation (she comes from a spot out of your sight or back down your
trail, and the rush is chase.gd along where she saw you go: §8's test of Godot's navigation hasn't been run), marker
paths (`hunt_path.gd`), the survivability warning in the editor, the Director's cards and the story format's word.
The questions in §9 were answered by the build: the haunting and the lethal half together, death as a card and a
checkpoint, tutorial v2's hotel first, the stand-in sliding until clips are made.

For games built by hand first (the starter kit), as the
ghost events are planned (GHOST_EVENTS_PLAN §1); Director cards after.

## 1. What's already here, and what a hunt lacks

| Have (the starter kit, the plugins) | What it does |
|---|---|
| `searcher.gd`, `noise.gd`, `seat.gd` (hiding, held breath) | she hears you, listens, checks the hiding places near the noise, the close pass, pulls you out |
| `chase.gd` | after you at 0.95 of your run along your own trail, doors hold her 2 s, lost after 6 s unseen, safe rooms |
| `closer.gd`, `glimpse.gd`, `mirror_figure.gd`, `shadow_pass.gd`, `door_feet.gd`, `uncanny.gd` | she moves only while unseen; the corner of the eye; only in the mirror; a shadow; feet under the door; one thing wrong with her |
| `presence.gd`, `fear.gd`, `behind_you.gd` | lights and the flashlight dip near her, static, your heartbeat, steps behind you |
| `dread.gd`, `dread_moment.gd`, `menace.gd` | pacing: build, peak, relax; small moments by weight; she withdraws when she's been near too long |
| `cue.gd`, `scare_area.gd`, `event_area.gd` | a jump scare when where you look, what you're doing and the story are all so |
| `light_shy.gd`, the flashlight | she backs off, freezes or vanishes in the beam |
| `HSCloak`, `HSLookSwitch`, `HSEyeFx` | invisible with a shimmer, flickering on a hit; her looks by a fact or an event |
| `HSHitReact`, `HSShotWith` | shot: staggered, down; shot with water or love: a fact |

**What's missing for a hunt:**

1. **One thing that owns it.** Today each script is wired to the next by hand (tutorial v2 §22 is thirty connections).
   A hunt needs one node that says who hunts, how, when it starts and what ends it.
2. **She can only follow your trail** (no navigation): she can't go ahead of you, cut through another room, or stand
   somewhere you haven't been. Paths and places for her are the gap.
3. **Being caught is only a fright.** A game by hand has no death, no checkpoint, no retry.
4. **No stages.** Nothing gets worse the longer you take.
5. **Her moves.** A by-hand character plays an animation only through a cue; there's no "this clip while she
   stalks, that one when she peeks".

## 2. The hunt: one node, a hidden quest

`starter/hunt.gd` (`Hunt`), dropped anywhere in the level:

| Setting | What |
|---|---|
| **Hunter** | the NPC who hunts (any character: a Studio export, a stand-in) |
| **Kind** | `haunting` (she never touches you: §6), `stalking` (she can catch you, a fright, no death), `lethal` (her touch kills: §5) |
| **Starts** | `needs` (the Story's words) or `fire()` from any signal: an area, a cue, a quest ticked, an HSShotWith |
| **Hidden** | no line on the to-do list (the default). Or **Reveal**: a task added at a moment you pick ("Survive.", "Get the power back on.") — when it starts, at her first sighting, or never |
| **Ends when** | any of: `survive_secs`, a `needs` that comes true (`task:power`), you reach a safe room, she's shot down, `stop()` |
| **Then** | a fact (`survived_hunt_1`), a task ticked, a line, a target's `fire()`; lost (a death): §5 |
| **Stages** | how long each lasts and what each allows (§3); the stage is also a fact (`hunt:<name>:2`) other nodes' `needs` can read |
| **Rushes when** | the list in §4: never / in the dark / your back turned / you ran / you made noise |
| **Safe rooms**, **Hiding places**, **Spots**, **Paths** | found by group when left empty (everything in the level), or a picked list |

The Hunt node drives the pieces that exist (searcher, chase, menace, presence, the director) instead of replacing
them: it arms and stops them, holds the director's own moments back while it runs, and plays its own spots (§3)
through the director's build, peak and relax, so a hunt breathes.

## 3. Hunt spots: the hidden boxes round the map

`starter/hunt_spot.gd`: a Marker3D (where she is) with an optional box (where you must be) and an optional second
marker (where she goes). Dropped all over the map; **the Hunt picks among the ones that are possible right now**, by
weight, never the same twice running, at the director's pace. Each: `kind`, `animation` (a clip of hers), `sound`,
`stage_min`/`stage_max`, `needs`, `once`/`cooldown`, `weight`, `scare` (how strong, for the Fear node).

| Kind | What you see | Rule it plays by |
|---|---|---|
| **watch** | she's standing there, far off, still. Looked at for a second: gone in a lamp's blink | set up only while the marker is out of your sight; 8 m or more |
| **dart** | **she runs across ahead of you into another room**, half a second, her steps after | you in its box, the crossing in view, 5 to 14 m away; A to B both out of sight at their ends (a doorway each side) |
| **peek** | her head and a hand round a corner or over a banister; back when you look straight at it | the corner 4 to 10 m away, at the edge of the view |
| **ambush** | a jump scare: out of a wardrobe, under a bed, down from the ceiling | a cue's rules (where you look, what you're doing); in a `stalking` or `lethal` hunt it can be a real catch chance |
| **follow** | you turn round and she's down the corridor behind you; each time you look away she's nearer (`closer.gd` on marks she picks along your trail) | only where you've walked; ends at `behind_m` or when you reach light |
| **pass** | cloaked: the shimmer crosses the room, a door moves, a chair is bumped, her steps | she has an HSCloak; nothing to see when you stand still and look away |
| **door** | a door ahead opens a hand's width, or shuts behind you | a `door.gd` door, out of reach |
| **decoy** | a noise where she isn't (a `Noises.make` and a sound) so you go the wrong way | never twice toward the same room |
| **wait** | she's stood in the room you need (by the breaker), back to you | the hunt's goal room; turns only at stage 3 |
| **custom** | an `animation` and a `target`'s `fire()`: anything of yours | |

**Stages** (the defaults; each hunt sets its own): 1 *signs* (presence, sounds, decoys, doors: she isn't seen), 2
*sightings* (watch, dart, peek, pass), 3 *close* (follow, wait, ambush; the searcher armed), 4 *the end* (one chosen
finale spot, or the rush). A stage moves on by time, by a fact, or by what you do (ran, shone the light on her, used a
hiding place twice).

## 4. Not just running at you: when she may rush

She keeps her distance by default; a rush is earned and always told first.

- **Aggression** is one number the Hunt keeps (as the Fear node keeps fear): up with the stage, with noise you make,
  with time in the dark, with you looking straight at her for long; down in light, while you hide well, after a rush.
- **She rushes only when a rule you ticked holds**: *dark* (your flashlight off or dead, the room's lights out),
  *back turned* (she's behind you inside 6 m and unseen for 3 s), *ran* (you ran inside her hearing), *noise*, *stared*
  (you held her in the middle of the view 4 s), or *never*.
- **A tell before every rush**, 1.2 s at least: the lights dip (presence), a sound of hers, her look changes
  (HSLookSwitch: her eyes lit), the last half second silent (research/jump_scares.md). Then `chase.gd`.
- **Between rushes** at least 20 s, and the director relaxes after one, as it does after her menace fills.
- **The light**: with `light_shy` she stops at the beam's edge; a dying battery is the hunt's clock.

So in a lit room she watches and darts; turn the light off, or let the battery die, and she comes.

## 5. Her touch kills, and you can survive it

**New for games by hand** (the Director and desk runtime have deaths and checkpoints; the starter doesn't):

- `starter/checkpoint.gd`: an area that saves the Story (tasks, facts, the pocket, cash), where you stand, the doors
  and lights, and each Hunt's stage. One is kept automatically when a lethal hunt starts.
- **Death** (`Story.die(how)`): her catch plays its moment (her face, a clip of hers, a sting, the picture breaking
  up: a `kill` cue on the Hunt), black, a card with one line, back to the checkpoint. The hunt starts again one stage
  lower than it killed you at, so a retry isn't the same thirty seconds.
- **Always a way to live**, and the check holds each one (the user's "designed in a way where the player can survive"):

| What saves you | How |
|---|---|
| hide | `seat.gd` hiding, your breath held at the close pass |
| break her sight | 6 s out of it and she's lost you (searches where she last saw you) |
| a door | shut in her way: 2 s and a bang; a locked one she never passes |
| light | the beam on her (light_shy), a lit room she won't enter (`safe_rooms`) |
| the gun | staggered by a hit (HSHitReact), gone a while when down; water shows a cloaked one (§7) |
| the goal | the task that ends the hunt always reachable by a route with a hiding place every 12 m or so: the Hunt's editor warning says where there's none |

- **Mercy**: after two deaths in one hunt her aggression is capped lower and one more hiding place is safe. A setting.
- **Fair catches only**: no catch without a tell, none in the first seconds after a retry, none through a door, none
  while a card is up.

## 6. Hunts that are hauntings

`kind: haunting`: she can't touch you and nothing can kill you. It's the same node, spots and stages, ending on a task:

- **"Turn the power back on."** The power cuts (the starter's lights out), the hunt starts hidden, `ends_when:
  task:power`. Stage 1 in the dark: static, a door, steps above. Stage 2: a dart across the corridor's end in your
  beam, her watching from the stairs. Stage 3 (you've taken too long): follow, and she waits by the breaker with her
  back to you. Flip it: the lights come on one by one toward you, she's gone at the last, the stage's fact clears.
- Getting **close** to her in a haunting doesn't kill: the lights die for a second and she's somewhere else (a
  `vanish`), the Fear node jumps. Being slow costs dread, not a retry.
- Ghost events (GHOST_EVENTS_PLAN) read the stage (`needs: hunt:power:2`), so a haunting can throw the kitchen about
  while she's upstairs. The haunt level there and the stage here are the same idea at two sizes: the level is the
  game's, the stage is one hunt's.
- Other ends for a haunting: find and burn the doll, say goodnight to the sister, get to the car, wait till 3 am.

## 7. Invisible

Her HSCloak as a state of the hunt, not a switch you wire:

- **Cloaked while she moves, seen when she chooses**: the `pass` spot; standing still she's nearly gone, moving she
  ripples, so a patient player learns to watch for it.
- **What gives her away**: her steps on the floor's own sound and the steps behind you; the lights and the flashlight
  dipping where she is; her breath in a cold room (HSBreath on her); a door she goes through; dust shaken in the
  beam; **a water shell** soaks her and she drips for `soak_s`, visible (HSShotWith's fact can start a stage); the
  flashlight held on the shimmer for a second makes her flicker into view.
- **Seen on purpose**: she uncloaks 10 m down the corridor, looks, cloaks again. Worse than a jump scare.
- A cloaked catch (lethal): only after the shimmer has been in view for a second at least. Never from nothing.

## 8. Under it: her places, her moves, the build

**Where she can go.** Today she only knows your trail. Two ways, to try in this order:
1. **Godot's navigation**, baked when the level loads from the interior export's colliders (doors as links that
   open). She can then go ahead of you, come round the other way, reach any spot. To test first on the hotel floor:
   bake time, doors, stairs.
2. **Marks**: `hunt_path.gd`, a chain of Marker3D she walks (a patrol, a route between two rooms), and the doors'
   own markers as joins. Needed anyway for *dart* and authored patrols; enough alone for a small house.

**Her moves** (`starter/moves.gd` on the hunter): a clip name for each thing she does (idle, walk, run, stalk, peek,
crawl, lunge, stare, the kill), played from an AnimationPlayer under her; with none she slides as the searcher does
now. The Director's Animate tab already retargets Kimodo clips onto a character: bringing those into a by-hand project
is the same library copied in. Looks by state (stalking: default; the tell: eyes lit) through her HSLookSwitch.

**Build order** (each a commit with its check, HUNT, played headless as TUTORIAL2 plays the corridor):
1. `hunt.gd` with `haunting`, stages, `ends_when`, and four spots on marks: watch, dart, peek, door. The power-cut
   haunting in tutorial v2's hotel as the example. No navigation, no death.
2. Rush rules, the tell, `stalking` (the existing searcher and chase under it).
3. `checkpoint.gd`, `Story.die`, `lethal`, mercy, the survivability warning.
4. Navigation tried; follow, wait, decoy, ambush.
5. The cloak's `pass`, what gives her away, the water shell.
6. `moves.gd` and Kimodo clips in a by-hand project.
7. Director cards (a *Hunts* category, the Story tab's THEN "start a hunt"), then the story format's word for desk
   games (the runner, the check and STORY_FORMAT together).

**Rules it keeps**: the flash limit (never three in a second), a hush before a hit, nothing when a card is up, no
scare the same twice running, safe rooms really safe.

## 9. For the user to say

1. **Start with step 1** (the power-cut haunting, no death) and look at it in play before the lethal half? Or the
   lethal hunt first?
2. **Death in a game by hand**: back to a checkpoint with a card, as above? Or caught = thrown back to a room, no
   death screen?
3. **Which game is the first hunt for**: tutorial v2's hotel (it has the corridor, the closet, the power), or Freddy's
   house (the alien, cloaked)?
4. **Her animations**: do you have clips for a hunter yet (crawl, peek, run), or should step 1 be built on the
   stand-in sliding, with Kimodo prompts for the clips listed for you to make?
