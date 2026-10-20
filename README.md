# HorrorStudio: start here

One Unreal project where all our horror games live, with Claude as co-lead engineer. You write a rough story;
Claude plots it on the director's desk, builds the greybox, plays it through, checks every frame that matters, and
swaps in your takes, faces and art as they arrive.

## What you do (about 10 minutes, plus installs)

1. **Make the project, once, for every game:**
   - Epic Games Launcher → Unreal Engine 5.8 → Launch → Games → **First Person**.
   - Variant **Survival Horror**, **C++**, Starter Content off.
   - Name it something neutral, like `HorrorStudio` (it becomes the `.exe` name). Create.
   - Let it compile shaders once, then close it.
2. **Copy everything inside the zip's `HorrorStudio` folder into the project folder**, next to the `.uproject`
   (say yes to merging `Content`).
3. **Open Claude Code in that folder** and say: *"Read CLAUDE.md and work through SETUP.md."*

Claude checks your machine and tells you what to install, if anything:
- Visual Studio with C++
- Git LFS
- Node.js
- Python

Then it:
- installs **UnrealClaude** with the UE 5.8 fix (pull request 48) and connects to the editor
- sets up the studio
- builds the story runner
- imports the pilot (a haunted-house example with every part of the format)
- sets up body animation from text (NVIDIA's Kimodo)
- tests your face workflow with you
- packages the pilot as its own game

It stops and asks whenever it needs a click or an opinion.

## Try it now

You need Python 3 and `pip install pillow`.

```
python tools/director/serve.py        then open http://127.0.0.1:8780 (the director's desk: Flow, Storyboard, Watch)
python tools/check_all.py             every check on the pilot: STORY, LEVEL, SHOTS
python tools/story.py flow            the pilot's flow: scenes, tasks, choices, endings
python tools/cc0.py props chair       the CC0 library: 900 real-scale props by name (docs/ASSETS.md)
```

**Real bodies in the desk:** drop Manny (exported from your project as FBX), a Mixamo character or a MetaHuman body
into `Content/Studio/Bodies/` and the storyboard plays the blocking on it instead of the capsule figure
(`Content/Studio/Bodies/README.md`; the Bodies page checks one against every pose). Out of the box it's Meta's MHR
body: the **Shape** page designs each cast member's body with sliders and exports it as the base for their
MetaHuman.

## What's inside

| Path | What |
|---|---|
| `CLAUDE.md`, `SETUP.md` | Claude's instructions; the setup phases, ticked as they finish |
| `docs/PIPELINE.md` | how a game gets made: spine first, then the player's tasks, then the polish layers |
| `docs/STORY_FORMAT.md` | the story file: world, scenes (clips, shots, seams, variants, blocked bodies, events), stitches, flow, endings, notes |
| `tools/director/` | the director's desk: plot, block bodies and shots on a 3D stage, check them from the player's eye, storyboard, watch the whole game, export the blocking for Unreal |
| `docs/DIRECTING.md` | shots, moods, scares, quick-time events, unskippable cutscenes, animation judged from the player's eye |
| `docs/TRICKS.md` | hiding the 10-second seams, the soft camera, immersion tricks, stitch templates, the grab |
| `docs/ANIMATION.md` | bodies from text (Kimodo), faces from your takes, the hybrid IK grab |
| `docs/STUDIO.md` | one project, many games, and packaging only one |
| `docs/ASSETS.md`, `tools/cc0.py` | the CC0 library: props by name at real size, textures by real size, fetched and recorded (from the awesome-cc0 list) |
| `Content/Games/Pilot/story.json` | the pilot |
| `tools/` | the checks, the desk, takes intake, placeholder voices, motion jobs, packaging |
