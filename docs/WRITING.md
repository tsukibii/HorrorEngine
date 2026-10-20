# Writing the games: horror romance in first person

How we write (and Claude reviews) the scripts: obsession and yandere, a conversation that feels like it's with
you, intimacy staged for the player's eye, and gameplay simple enough for anyone. The format words are in
STORY_FORMAT §9; the shapes we borrow are in REFERENCES.md.

## 1. The shape of a 15 to 20 minute game

| Beat | Minutes | What happens |
|---|---|---|
| Sweet | 2 to 3 | She's glad you came. Warm light, small talk, replies that make it feel like you. The player should like her. |
| The first tell | 1 to 2 | She knows something she shouldn't, or a reply comes back wrong ("You said your day was bad... I took care of it."). |
| The game | 3 to 5 | Something playful: hide and seek, a dare, a task for her. Cute the first time. |
| The turn | 2 to 3 | The same staging turns: the hand on your cheek is on your throat; the door you came in by is locked. |
| Run, hide, choose | 4 to 6 | Gameplay with deaths; the last choices that decide who you've been to her. |
| The ending | 1 to 2 | Good (you reached her), neutral (you got out), bad (you stay, for good). |

## 2. Hanging lines and replies: a conversation that's yours

**She talks; you answer in a word or two; she reacts to you.** The player is the quiet guy: replies are short and
natural, never speeches. Her lines carry the scene.

- **A hanging line ends open:** a question, or a statement that wants an answer ("You came all this way just for
  me?"). The take ends on her face waiting (`wait_expr`); she waits 6 s or so, not forever.
- **Two replies, left and right, both believable:** warm or cool, honest or evasive ("Good." / "Bad.", "Of course."
  / "...I guess."). Never a right and a wrong answer; never a joke option that breaks the mood.
- **Her answer shows who she is:** the good-day answer is sweet with a hook ("I waited all day"); the bad-day one is
  tender with a claim ("I'm here now"). Both are her; both are a little too much.
- **Silence is noticed sometimes:** most hanging lines just carry on when you don't answer (her answer is skipped),
  but now and then give the silence its own answer (`timeout`: "Shy? That's all right.") so the player feels
  watched.
- **The next line works after anything:** the line after a reply must follow either answer and silence. Write it
  last and read it after each.
- **Callbacks make it yours:** a reply that sets a flag can come back much later ("You said you didn't have
  anyone... good."). One or two per game is enough; that's when a reply opens a branch.
- **Don't repeat the question in the answer**, and don't have her summarise what you said: react to it.

## 3. Intimate moments in first person

The camera is the player's eye, so intimacy is distance, gaze and touch, and it can turn into threat with the same
staging.

- **Distance:** close-ups are distance (DIRECTING.md §1). Intimate is under 0.45 m (`ecu`, `cu`); bring her in with
  a walk to a closer spot and let the player lean (`push`) a little. Don't cut to close: let her come.
- **Eye contact:** her `look` follows the player (limit 70°, `hold`): she never looks away first. The turn can be her
  head tracking you past where a head should go (a wide `limit`, `past: hold`), once.
- **Touch:** a hand to your face or collar is a `reach` to `player_face` or `player_collar`, eased in. The tender
  and the threatening versions are the same reach with a different speed and expression.
- **Holding:** `camera.mode: held` for an embrace or being pinned; `stance: sit` or `lie` to sit beside her or lie
  down (everything looms).
- **Breath and voice:** `whispers` and `murmurs` at the ear; a closet's acoustics for hiding, a small room's for her
  voice close. The audio sells it more than the picture.
- **Cuts:** a kiss, an embrace or a jump in time hides behind a `blink` or a `dip` seam; nothing explicit, the
  tension is the point.
- **Japanese:** closeness lives in the sentence endings (ね, よ, の), in dropping or adding politeness (a sudden
  switch to keigo is cold; dropping it too early is too close), and in delivery notes: the breath before a word,
  the voice dropping on the last one.

## 4. Gameplay the Roblox generation gets

- **One-line rules,** said by her or shown: "Hide before I count to ten." "Don't let me see you move." "Bring me
  three things that are mine."
- **A warning, then seconds to act:** she starts counting, the lights flicker, footsteps come closer.
- **Three strikes:** being found is cute the first time (she giggles), a tease the second (the smile goes), and the
  third is a death. Count it (`count`) and let her say the number.
- **Ticking boxes:** collect a short list, flip the breakers, close every window: visible progress, no puzzles.
- **Often, and short:** a round every 3 to 5 minutes, 30 to 60 seconds each.
- **She remembers:** a result changes her next lines (a counter or a flag), so the gameplay is part of the story.

## 5. Deaths

- **Each death is a scene:** short, earned, staged close (the payoff of the threat), then the branch map.
- **Send them back a little:** `retry` is the round or the scene just before, never the start.
- **The map shows what they missed:** locked silhouettes invite another go; deaths themselves are endings to find.

## 6. Reviewing a draft (Claude)

1. Is she likeable before the turn? Are the tells small and spaced?
2. Does every reply pair have two believable answers, and does the next line work after both and after silence?
3. Is there at least one callback from a reply?
4. Are intimate beats staged by distance, gaze and touch (not cuts), and does the turn reuse that staging?
5. Is every gameplay rule one line, warned, and short? Do the strikes escalate?
6. Does every death have a scene and a retry close to it?
7. Lines one beat each (12 English words), pauses as clips, bodies simple (KIMODO.md).
