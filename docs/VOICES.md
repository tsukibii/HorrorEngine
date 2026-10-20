# Voices and expressions for MiniMax (what we ask for, and what's been tested)

The words Claude puts in each take's MiniMax prompt (image to video, MiniMax H3): the **expression** and the
**voice**. The user handles the rest of MiniMax's format. The prompt is
`she makes a <expr> while she <voice> <d>[Japanese] <the line> </d>`; `python tools/story.py --game G minimax`
prints them (`storylib.minimax_prompt`).

**Keep this list honest:** a voice or expression is `tested` only once a take has come back sounding (or looking)
right. Add a row to the log at the bottom when you try one, and Claude moves it up.

## 1. How MiniMax likes them (from prompt guides, 2026-10-20)

None of these guides is MiniMax's own documentation; check against the official model card when it's reachable
([MiniMax-H3 on Hugging Face](https://huggingface.co/MiniMaxAI/MiniMax-H3)).

- **Expressions as visible movement, not feelings.** "eyes wide and lips trembling", not "she feels afraid".
  Abstract emotion words tend to fail; the face needs something to do.
- **A noun phrase after "makes a"**: "a frightened expression, eyes wide and lips trembling", "a slow grin", "a
  blank, unblinking stare". Never a sentence ("eyes widen as she...").
- **One facial beat per take.** A 7 to 8 s take has room for one expression to arrive, peak and settle, not an arc.
  If the face changes twice, it's two takes.
- **Start from neutral.** The image is the first frame; the expression grows from it, or the model opens at full
  intensity. Our takes begin on the anchor frame anyway (TRICKS.md §1).
- **The acting stays outside `<d>`.** Only the language tag and the words go inside; the voice and the expression go
  before it.
- **Short lines.** One sentence per take speaks cleanly; two sentences inside one line is where garbled speech
  starts. Our 7 to 8 s beats keep to this.
- **Lip sync wants the face readable:** front or three-quarter, no heavy shadow over the mouth, a steady camera.
  Horror lighting goes in later, not into the source image.
- **An unseen speaker** is an off-screen voice with nobody's lips moving (`face: false` writes that).
- A voice reference (if used) carries the timbre, not the emotion or the pace: those stay in the prompt.

Sources: [fal.ai, MiniMax H3 prompting guide](https://fal.ai/learn/devs/minimax-h3-prompting-guide),
[Atlas Cloud, 45 official prompts](https://www.atlascloud.ai/blog/tips/minimax-h3-prompt-guide),
[Atlas Cloud, lip sync and audio](https://www.atlascloud.ai/blog/tips/minimax-h3-lip-sync-and-audio),
[Seedance, micro-expression prompts](https://www.seedance.tv/blog/minimax-h3-microexpression-prompts),
[Ambience AI, H3 guide](https://www.ambienceai.com/tutorials/minimax-h3-prompting-guide).

## 2. Voices

`voice` is the verb after "while she". The check warns on one that isn't listed here (`storylib.VOICES`): try it,
then add it.

| Voice | Status | Use for |
|---|---|---|
| says | untested | the default |
| whispers | untested | secrets, close-ups, the line right at your ear |
| says angrily | untested | anger with control |
| screams | untested | terror, the scare's peak (keep it short) |
| murmurs | untested | half to herself, fond or distracted |
| says softly | untested | gentle, tired, coaxing |
| says coldly | untested | contempt, the turn |
| says flatly | untested | shock, dissociation, the uncanny "nothing's wrong" |
| pleads | untested | begging, bargaining |
| sobs | untested | crying through the words |
| says in a trembling voice | untested | fear held back |
| laughs | untested | laughing through the line (the wrong moment for it is the horror) |
| giggles | untested | the childlike and the unhinged |
| hisses | untested | through teeth, a threat |
| gasps | untested | a line broken by shock or pain |
| sings softly | untested | a nursery rhyme in the dark |
| hums | untested | no words: put the melody's syllables in `<d>` |

## 3. Expressions (a starting vocabulary)

| Feeling | Write it as |
|---|---|
| fear | a frightened expression, eyes wide and lips trembling |
| held-back fear | a tight, forced smile, eyes darting to the side |
| relief | a slow, wide-eyed stare that softens into relief |
| sadness | a soft smile, eyes wet |
| grief | a tear-streaked face, looking up at you |
| pleading | a pleading look, eyes glistening and brow pinched |
| uncertainty | an uncertain half-smile, eyes searching yours |
| coldness | a blank, unblinking stare |
| contempt | a slow, one-sided smirk, eyes half closed |
| anger | a desperate grimace, teeth bared and eyes wet |
| menace | a slow grin that grows too wide |
| dissociation | a blank stare, head tilted slightly |
| searching | a searching look, eyes darting side to side |
| teasing | a small smirk that fades |
| the uncanny | a sweet smile that doesn't reach her eyes |

## 4. The log (what's been tried)

| Date | Take | Voice | Expression | Result |
|---|---|---|---|---|
| | | | | |
