# Running the browser checks on the user's machine (for Claude there)

The cloud sessions have no graphics card: the browser checks draw WebGL in SwiftShader on four CPU cores, where one
frame of the Character Studio takes about a second (measured 2026-10-28: 0.97 to 1.05 s for the 900 × 743 view), so
STUDIO alone takes about 50 minutes and TESTROOM most of half an hour. The user's RTX 3090 draws that frame in a few
milliseconds; what's left is CPU work (the clothes hanging, MediaPipe, the checks' own waits), so a run should take a
fraction of the time (STUDIO perhaps 5 to 10 minutes: an estimate, never timed). So when the user is at the machine,
the cloud session doesn't wait (DECISIONS 2026-10-28, later night): it pushes once the offline checks pass and asks
for a local run. When the user is away, it runs the checks itself, slowly.

## What the cloud session asks

One line, for the user to give Claude on their machine, for example:

> Run docs/RUN_LOCALLY.md on `dev-002`: STUDIO, PLAY, TESTROOM.

## Doing the run

1. **The branch.** In the project folder: `git status` first; if the user has changes of their own, ask before
   anything else. Then `git fetch origin <branch> && git checkout <branch> && git pull --ff-only`.
2. **Once per machine:** Playwright and its Chromium (`npm install -g playwright`, then `npx playwright install
   chromium`), found by the checks through `export NODE_PATH="$(npm root -g)"` (or `PLAYWRIGHT=<path to the
   playwright package>`); MediaPipe for the Studio's face fit (`python3 tools/face_mesh.py setup`).
3. **The servers**, started fresh after the pull (a server already running keeps the Python it started with), each
   in its own terminal or in the background, from the project folder; both are plain Python (no packages):
   - the Character Studio, port 8793: `python3 tools/character/serve.py`;
   - the desk, port 8780: `python3 tools/director/serve.py`.
   `python3 dashboard.py` starts and stops them too.
4. **Each check on the card**, one browser check at a time, `GPU=1` in front:

   | Check | Command | Server |
   |---|---|---|
   | STUDIO | `GPU=1 node tools/character/studiotest.js` | Studio |
   | SALON | `GPU=1 node tools/character/salontest.js` | Studio |
   | UEEYE | `GPU=1 node tools/character/ueeye.mjs` | none |
   | PLAY | `GPU=1 node tools/director/playtest.js` | desk |
   | TESTROOM | `GPU=1 node tools/director/testroom.mjs` | desk |
   | EXPRESSIONS | `GPU=1 node tools/director/exprtest.mjs` | desk |
   | TIMES, MODELS | `GPU=1 node tools/director/timetest.js`, `modelstest.js` | desk |
   | PEOPLE | `GPU=1 node tools/director/peopletest.js` | desk (and a Studio export: STUDIO makes one) |
   | FACEPAGE, BUILDER, GUIDE | `GPU=1 node tools/director/facetest.js`, `buildertest.js`, `guide_shots.mjs` | desk |

   A check's first line is `GL:` and the renderer WebGL got (`tools/browser.cjs`). It should name the NVIDIA card.
   If it says SwiftShader or llvmpipe, stop that check and run it again with `GPU=egl`, then `GPU=headed` (a window
   opens: always the card). Without `GPU` a check runs as in the cloud, on the CPU.
5. **The report**, for the user to paste back into the cloud session: for each check its last line (`<NAME> ok`, or
   its `FAIL` lines whole), how long it took, the `GL:` line, and the picture a failure leaves (STUDIO's
   `studiotest_fail.png` in the folder it ran from). Fix nothing unless the user asks: the change belongs to the cloud
   session, which fixes it and asks for the run again.

The offline checks (CHECKS, DESK, CMDS, REFS, KIT, TAILOR, POSE, SCORE, WRITERS...) need no card and stay in the
cloud.
