# Continue: the next session

Written 2026-10-21 at the end of a session. Read this after CLAUDE.md's start list (DECISIONS, notes, SETUP), then
**ask the user what they're doing now**; §4 is the menu, not an order. Overwrite this file at the end of the next
session.

## 1. Where we are

The director's desk has **Play mode** (`tools/director/play/`, docs/GAMEPLAY_PLAN.md): the Watch's tasks walked from
the player's eye. Steps 1 to 4 of GAMEPLAY_PLAN §8 are built **on the desk**; nothing of steps 2 to 4 is in Unreal yet.

Built and pushed this session (newest last):

| Commit | What |
|---|---|
| `cd645af` | **Hiding works.** `use: locker`: E gets in (its `inside` spot, else its middle facing its `rot`), hiding eye height, the look held to a cone, no walking; E gets out. From inside, the walls are slats (`stage.seeThrough`; `see_through` on the locker, else `game.see_through`, else 0.6), also for scenes' `camera.through`. `{"hidden": true \| locker}` trigger. A scene played from inside keeps you hidden (`placeFromCamera`). **The grab's struggle is mashed** (E, Space, left click), not dragged. |
| `c4d5e3a` | **NPC behaviours.** The `behave` action: `idle` (at, pose, face), `sit`, `path` (route, mode, speed, from), `patrol` (routes, pick), `off`. Routes: `levels.<id>.routes`, spots with `wait` and `pose`, `loop` / `pingpong` / `once`. A new part kind, `behaviour` (`play/behaviours.js`); the runtime draws the cast with the pose library and the walk overlay. |
| `e5a71d1` | **Stealth.** `behave` `sees` (cone, a reach that's shorter crouched, line of sight against the level's blocks) fills a suspicion meter under the cursor (`SIGHT` in runtime.js: 1.2 s to fill, 1.5 s to drain, 3 s calm after a catch); full, `caught` fires (`{"caught": true \| cast id}`). Unseen when hidden or in a safe zone (trigger `safe: true`), unless a route point `check`s that locker. |

The user's decisions from this session are in DECISIONS (2026-10-21, "buttons, not dragging"): every interactable is a
button (E or a click), no dragging and no sliders; the struggle is mashed; the Play UI gets its touch-ups much later.

## 2. Where things are

- `play/runtime.js`: the player, collision, triggers, doors, hiding (`hide`, `unhide`, `leaveHiding`), the cast
  (`route`, `behave`, `drawNpcs`), sight (`sees`, `watch`, `caught`), the cursor, stitches and act choices.
- `play/behaviours.js` (new), `actions.js` (`behave`), `conditions.js` (`hidden`, `caught` by whom),
  `interactables.js` (`hide`, with `locker` as the format's word), `abilities.js` (the look's cone, `p.limit`),
  `hud.js` + `ui/hud.css` (the hidden vignette, the meter `.ph-seen`; colours from the themes' `--ph-hidden`,
  `--ph-bad`).
- `stage.js`: `seeThrough`, `seeThroughOf`, `SEE_THROUGH`, the slat texture; `apply` uses a scene's `camera.through`.
- `motion.js`: `walkOverlay` is exported now.
- `app.js` `runEvent`: the struggle's mashing.
- `tools/story_check.py`: routes, `behave` (`BEHAVE`, `SIGHT`), `hidden`, `caught`, a locker's `inside` and
  `see_through`, a trigger's `safe`, `game.see_through`; the walker can fire `hidden`.
- Docs: STORY_FORMAT (§2 routes, uses table, triggers, actions), GAMEPLAY_PLAN §3, §8, §10, §11, TRICKS §5,
  DIRECTING, ANIMATION (the struggle), LESSONS (slats).

## 3. Testing

- `python tools/check_all.py`: CHECKS ok.
- `node tools/director/playtest.js`: PLAY ok. It walks the Pilot to its good ending and, **in memory only**, adds a
  route (`r_hall`), Mari's `behave` path, a safe zone (`hall_safe`), hiding, and being seen. The Pilot's story.json has
  none of these, so on the desk Mari doesn't walk or watch until a story gives her a `behave` beat.
- Run a test desk beside the user's: `DESK_PORT=8781 python tools/director/serve.py` in the background and
  `DESK_URL=http://127.0.0.1:8781/`. Playwright was installed in an old scratchpad
  (`/tmp/claude-1000/-run-media-hal-Derick-Unreal-HorrorEngine/c845f1b2-fe12-4864-92ba-55aa33ece5a8/scratchpad/pw/node_modules/playwright`,
  passed as `PLAYWRIGHT=`). If /tmp was cleared, run `npm i playwright` in the new scratchpad; the browsers are in
  `~/.cache/ms-playwright`.
- Stop only the 8781 server: find its PID, check `/proc/<pid>/environ` for `DESK_PORT=8781`, then kill that PID in a
  separate command. The user's server on 8780 stays.
- A probe: copy playtest.js to `tools/director/_probe.js` with a step inserted, screenshot into the scratchpad, then
  delete the probe. This is how hiding and the meter were looked at.

## 4. What's next (ask which)

1. **Draw routes and safe zones in the scene builder** (GAMEPLAY_PLAN §6). They're typed into story.json for now. The
   builder keeps unknown level keys in `model.levelExtra`, so routes survive a builder save already; spots are placed
   on the desk.
2. **Talk lines** (GAMEPLAY_PLAN §2): use a cast member for the first line, then again, then a reminder of the task, or
   a scene or a choice.
3. **Interactive cinematics** (§1, §8 step 2): you walk while she talks; if you leave, she waits and calls you back.
4. **The blend when a scene takes an NPC** and hands them back (they jump to the scene's stage spot now).
5. Smaller things: footstep noise (crouch quieter), the `gaze` part (§11), the Florence-like tracker (§11),
   the old `stalker` action (`spawn despawn patrol hunt chase`), which overlaps `behave` and could become an alias of it.
6. **Unreal's side** (§8 step 6): hiding, behaviours, sight and the mashed struggle in the StoryRunner, with the
   desk as the reference. Nothing of the struggle is in `Source/` yet.

## 5. The user's machine (from this session, outside the repo)

- `ue` now starts Unreal on **native Wayland** by default (`~/.config/unreal-omarchy/wayland` = 1; the template is
  `unreal-omarchy/scripts/04-integrate.sh`). A dialog that opens blank is 5.8.3's SDL bug: run `UE_WAYLAND=0 ue` for
  XWayland once. Not yet checked: whether the Hyprland rules for `UnrealEditor` (no fade-in, no blur) still match
  that class on native Wayland.
- MetaHuman Creator crashed (a SIGSEGV in its mesh import tool) when the target mesh changed while the tool was open.
  Close the conform tool before editing a mesh. The PC froze because systemd wrote a 3.4 GB core dump. The user was
  given a command to turn those dumps off, but hadn't run it at the time of writing.
- `MHR_feminine.fbx` in the repo root: a one-off export of Mari's MHR body for an Unreal test. Not committed.
- `test.json` in the repo root is not ours: leave it.
