# Characters that react to being shot: no blood, a demon's ichor and smoke

The user (2026-11-10): "now instead of a breaking items system can you create a reactive system for characters/enemies
to be shot, but dont do blood, instead create some form of demonic dark smoke and dark splatters like black blood".
Not in HSBlowUp's place: "I want both systems" (DECISIONS 2026-11-10, later).

This note is what the weapons plugin's HSHitReact (`react/`) stands on. The sources are tools' documentation, forums,
fan analysis and press; **a quote is the search engine's extract of the page linked**. "(ours)" marks a choice made
here.

## 1. The reaction

- **Additive, on springs, on the bone that was hit**: Unreal's free *Easy Procedural Hit Reactions* layers additive
  motion over the animation, picks the hit bone itself and recovers on springs (damping, stiffness, each bone's limits,
  several hits buffered) ([Unreal forums](https://forums.unrealengine.com/t/kettunen-easy-procedural-hit-reactions/2741781));
  Unity's *Procedural Hit Reactions* offsets single bones by profiles mixing random and the hit's direction, its reactors
  "on parts like the chest and head", ramped in and out and **applied late in the frame**
  ([its docs](https://ironsami-studio.gitbook.io/proceduralhitreactions/modules/bodypartreactor),
  [core concepts](https://ironsami-studio.gitbook.io/proceduralhitreactions/getting-started/core-concepts)).
- **Flinches tight, physics for deaths**: light flinches and staggers read better authored than simulated, physics
  "can look chaotic under small forces" and suits death reactions
  ([MocapOnline on ragdolls](https://mocaponline.com/blogs/mocap-news/ragdoll-physics-animation-guide)); a keyframed
  reaction is tied to one direction and force, which a procedural one isn't ([anim.works](https://anim.works/?p=24611)).
- **Body parts**: Resident Evil 2's zombies have twelve sub-hitboxes, each with its own damage resistance, bosses a weak
  spot (the Tyrant's head) ([re-actor.net](https://re-actor.net/resident-evil-2-weapon-mechanics-zombies-and-bosses));
  limb targeting as a design ([Giant Bomb](https://giantbomb.com/wiki/Concepts/Limb_Targeting)).
- **Staggers**: in GTFO breaking a body part causes "a much heavier stagger animation, generally involving the enemy
  losing their footing" ([GTFO wiki](https://gtfo.fandom.com/wiki/Stagger_Multiplier)); Dragon's Dogma's stagger and
  knockdown are counters that build and reset when they trigger
  ([Dragon's Dogma wiki](https://dragonsdogma.fandom.com/wiki/User_blog:ThatGrizzly/A_Treatise_on_Stagger/Knockdown_Resistance.));
  Resident Evil 4's remake flinches "semi-random", which players find hard to read
  ([Backloggd review](https://www.backloggd.com/u/Durandal/review/812239)) (ours: a stagger by a counter, never by chance).

## 2. Darkness instead of blood

- **Remedy's Taken**: their darkness is burnt off by light before a bullet hurts them, and they "vanish in a bright flash
  of light" ([Giant Bomb](https://giantbomb.com/wiki/Concepts/The_Taken),
  [Wikipedia](https://en.wikipedia.org/wiki/Alan_Wake)). Remedy wasn't satisfied with "just any smoke effect": they
  poured blue and black ink into water and filmed it, after the shadows of the film *Insomnia*
  ([Digital Production](https://digitalproduction.com/2015/07/06/dunkles-erwachen/)). Recreating it: "black smoke
  effect spawned on the mesh itself" and a distorted silhouette
  ([Unreal forums](https://forums.unrealengine.com/t/alan-wake-taken-effect/329288)).
- **Black liquid that reads in the dark**: a wet look through the roughness channel; dark liquid needs a sheen (a fake
  specular from the normal map) and the right exposure ([80.lv, a dark liquid in UE5](https://80.lv/articles/creating-exploding-dark-liquid-effect-in-unreal-engine-5));
  blood "doesn't glow in the dark and is in fact quite dark itself": make it a little emissive or multiply it
  ([Unreal forums](https://forums.unrealengine.com/t/blood-decal-on-floor-is-not-looking-good-when-enemies-get-shot/490117));
  gloss maps so decals reflect a little light ([gamedev.net](https://gamedev.net/forums/topic/290588-advanced-blood-effects/290588/)).

## 3. What we do (ours)

**HSHitReact**, a node put under a character (`react/hit_react.gd`), its look an **HSWoundLook** (`react/looks/demon.tres`):

1. **Hitboxes on her bones** (a skeleton's: MHR's names, a mannequin's, Mixamo's, by their words), capsules on a layer
   of their own the gun's pellets and a blast see and the player never bumps into; a stand-in with no skeleton is hit
   where it's hit, its part by the height. The part decides the damage (the head twice) and the reaction.
2. **The reaction** is additive on springs after her animation (`react/flinch.gd`, a SkeletonModifier3D): the bone hit
   kicked away from the shot, the spine bent, the head whipped a beat later, an arm swung back, a knee buckling; a
   stand-in tilts whole. Hits fill a stagger counter: past it she's held where she is a moment (whatever moves her)
   and shoved back; it resets when it fires.
3. **No blood**: where she's hit, black ichor, glossy so the flashlight catches it, a faint ember glow in it; a wound
   on her that rides her bone, drops flung out of the wound, the spray on the wall or the floor behind her (dripping
   down a wall), drops landing where they fall; and **dark smoke** pouring from each wound and trailing after her as
   she moves (the muzzle's smoke, the trail the user approved, made black: it hides what's behind it, embers in it near
   the wound).
4. **Down**: she chars over from her own skin in, the char's edge glowing, smoke pouring off her, and she's gone into
   it (or gone at once, or a ragdoll if she has one); a pool of ichor where she stood.
5. **Its sound** is made in code: a wet, heavy hit and a hiss; her going a long hiss and a falling rumble.

## 4. Measured (WEAPONS §8j, MHR's body in the hotel corridor)

- The right barrel into her chest from 2.9 m as she walked at you: all nine pellets on her hitboxes (the spine's), no
  crater on her (her surface is `ichor`), a torso hit for 9, staggered; each spine bone thrown back 7.5° at the peak (four
  of them: about 30° at her shoulders), her head after it; held against her 0.8 m/s walk and shoved 0.34 m back, walking
  on once the stagger was over; two wounds on her, fifteen marks of ichor round her within a second and a half (twelve
  on the floor), two wounds smoking a quarter second after the hit.
- The left barrel into her head: nine pellets, 18 of damage, her head snapped back 33°.
- Her leg: two pellets 1.2 of damage and no stagger; five more and she staggers (the counter at 4.2).
- A blast reaching three of her hitboxes (3, 5 and 4 of harm): 5 taken, once.
- Shot down: her walk stopped, charred (0 to 1 in a second), crumbled into the smoke (another 1.3 s), gone with nothing
  of her solid, a pool under where she stood, seven sources of smoke pouring off her; put back whole.
- A stand-in of two capsules: one hitbox round it, a head hit by the height, tilted 32° away and upright again.

Not done: her own animation's hit clips (a stagger played from a library when she has one), limbs lost, the ichor as a
shader of its own that creeps and drips (built since as HSOoze: docs/research/ooze.md), a ragdoll set up for her.
