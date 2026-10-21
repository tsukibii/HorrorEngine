#!/usr/bin/env python3
"""Body animation from text (NVIDIA Kimodo), driven from the story: one job per clip that has a `body`, sized to the
clip's real length, pinned to the scene's marks (docs/ANIMATION.md).

    python tools/motion.py --game Pilot jobs            write Saved/Story/<Game>/motion/jobs.json (+ a constraints file each)
    python tools/motion.py --game Pilot constrain [job] blocking and paths -> Kimodo constraint files (in Kimodo's environment)
    python tools/motion.py --game Pilot run [job]       generate with the local Kimodo (setup.py kimodo; command in setup/kimodo.json)
    python tools/motion.py --game Pilot check           compare what came back with what the job asked for
    python tools/motion.py --game Pilot preview [job]   turn results into director files (Content/Games/<Game>/Motion/<take>.json)
                                                        and point each clip's body.file at them (the director plays them)
    python tools/motion.py --game Pilot shotlist        (format 3) every Kimodo motion to make, by its save name: the
                                                        prompt, seconds and frames, constraints, done or not
    python tools/motion.py --game Pilot import [folder ...]   (format 3) every shot-list motion: the motions you saved from Kimodo's demo (.npz,
                                                        named by the shot list): from Saved/Story/<Game>/kimodo/, the
                                                        project folder and any folder given; each becomes a director
                                                        file and its segment's `file`, so the desk plays them chained
    python tools/motion.py --game Pilot import <file.npz> <name> [--clip <scene>:<clip>]
                                                        a motion made by hand in Kimodo's demo (Exports, NPZ) as a director
                                                        file, Motion/<name>.json; --clip points that clip's body.file at it
                                                        (in every variant of the scene; a bare clip id must be unique)

Blocking keys (body.block, posed in the director) go into each job as full-body pose keyframes, so the generated
motion follows the staging the director approved; a clip with `bridge` also gets an in-between job from the
previous clip's last pose to its first, for joins too far apart to blend.

A clip's body spec (STORY_FORMAT.md §4):
    "body": {"prompt": "lunges forward and grabs with the right hand", "start": "idle", "end": "idle",
             "path": ["cellar_mari_spot", "cellar_grab_spot"], "reach": {"hand": "right", "to": "player_collar", "at": 0.6}}
`secs` defaults to the clip's length (its take's `dur` once recorded), so a longer take means a longer motion.
Positions go into the job in metres, relative to where the character starts, story axes (x east, y north, z up);
`constrain` turns them into Kimodo's axes and skeleton (tools/kimodo_constrain.py, run inside Kimodo's environment).
"""
import json
import math
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "Content" / "Python"))
from storykit import storylib as L  # noqa: E402

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

FPS = 30
COLLAR_DROP = 0.25    # the player's collar sits this far under the eye


def targets(story, things, sc, who):
    """Named reach targets: player_collar / player_face (from the scene's view spot), or any placed thing."""
    view = things.get(sc.get("view"))
    out = {}
    if view:
        z = things[view.room].pos[2] + L.EYE
        out["player_face"] = (view.pos[0], view.pos[1], z)
        out["player_collar"] = (view.pos[0], view.pos[1], z - COLLAR_DROP)
    return out


def key_frames(lib, keys, secs, height):
    out = []
    for k in keys or []:
        t = float(k["s"]) if "s" in k else float(k.get("at", 0)) * secs
        pos = L.pose_positions(lib, k["pose"], height)
        out.append({"frame": int(round(t * FPS)), "pose": k["pose"], "joints": {n: [round(v, 3) for v in p] for n, p in pos.items()}})
    return out


def segments(story):
    """Every Kimodo segment in a format 3 story: (scene, variant, clip, index, segment), plus the motions table's."""
    for sid, sc in story.get("scenes", {}).items():
        for k, ver in ([(None, sc)] if not sc.get("variants") else list(sc["variants"].items())):
            for c in ver.get("clips", []):
                for i, g in enumerate((c.get("body") or {}).get("segments") or []):
                    yield sid, k, c, i, g
    for mid, m in story.get("motions", {}).items():
        if m.get("name"):
            yield None, None, None, mid, m


def build_jobs(story, game):
    things, _ = L.index(story)
    lib = L.poses()
    jobs = []
    for sid, sc in story.get("scenes", {}).items():
        vs = sc.get("variants") or {}
        for var, ver in ([(None, sc)] if not vs else [(k, L.scene_version(dict(sc, pick=k))) for k in vs]):
            stage = ver.get("stage", {})
            last_by = {}
            here = {w: things[sp].pos for w, sp in stage.items() if sp in things}    # where each actor is (moves carry over)
            for c in ver.get("clips", []):
                body = c.get("body")
                prev = last_by.get(c.get("who"))
                last_by[c.get("who")] = c
                if not body or not body.get("prompt"):
                    continue
                height = float((story.get("cast", {}).get(c.get("who")) or {}).get("height", 1.7))
                who = c.get("who")
                start = things.get(stage.get(who))
                job = {"id": f"{game}_{sid}_{var or 'main'}_{c['id']}", "scene": sid, "variant": var or "main", "clip": c["id"],
                       "who": who, "prompt": body["prompt"], "secs": round(float(body.get("secs") or L.clip_secs(c)), 2),
                       "fps": FPS, "constraints": {}, "notes": []}
                if not start:
                    job["notes"].append(f"{who} isn't staged in this version: positions are left out")
                o = here.get(who) or (start.pos if start else (0.0, 0.0, 0.0))   # this clip starts where the last left them
                yaw = math.radians(start.yaw) if start else 0.0                  # facing: the stage spot's, as in the desk

                def rel(p):                       # world -> the character's own frame (x forward, y left, z up)
                    dx, dy = p[0] - o[0], p[1] - o[1]
                    return [round(dx * math.cos(-yaw) - dy * math.sin(-yaw), 3),
                            round(dx * math.sin(-yaw) + dy * math.cos(-yaw), 3), round(p[2] - o[2], 3)]
                for edge in ("start", "end"):
                    if body.get(edge):
                        job["constraints"][f"{edge}_pose"] = {"pose": body[edge], "frame": 0 if edge == "start" else
                                                              int(job["secs"] * FPS) - 1}
                if body.get("block"):
                    job["constraints"]["pose_keys"] = key_frames(lib, body["block"], job["secs"], height)
                    moves = [k for k in body["block"] if k.get("move") in things]
                    if moves and start:                   # blocked walks: the root's path, keyed when each move lands
                        job["constraints"]["root_keys"] = [{"frame": 0, "pos": [0.0, 0.0]}] + [
                            {"frame": int(round((float(k["s"]) if "s" in k else float(k.get("at", 1)) * job["secs"]) * FPS)),
                             "pos": rel(things[k["move"]].pos)[:2]} for k in moves]
                        here[who] = things[moves[-1]["move"]].pos
                if body.get("bridge") and prev and (prev.get("body") or {}).get("block") and body.get("block"):
                    bsecs = float((body["bridge"] if isinstance(body["bridge"], dict) else {}).get("secs", 0.6))
                    a, b = prev["body"]["block"][-1]["pose"], body["block"][0]["pose"]
                    jobs.append({"id": job["id"] + "_bridge", "scene": sid, "variant": var or "main", "clip": c["id"] + "_bridge",
                                 "who": who, "prompt": f"moves smoothly from {a.replace('_', ' ')} to {b.replace('_', ' ')}",
                                 "secs": bsecs, "fps": FPS, "notes": [],
                                 "constraints": {"pose_keys": key_frames(lib, [{"s": 0, "pose": a}, {"s": bsecs, "pose": b}], bsecs, height)}})
                if body.get("path") and start:
                    pts = [things[s] for s in body["path"] if s in things]
                    job["constraints"]["root_path"] = [rel(t.pos)[:2] for t in pts]
                reach = body.get("reach")
                if reach and start:
                    tg = targets(story, things, sc, who).get(reach["to"]) or (things[reach["to"]].centre if reach["to"] in things else None)
                    if tg:
                        job["constraints"]["end_effector"] = {"joint": f"{reach.get('hand', 'right')}_hand",
                                                              "frame": int(float(reach.get("at", 0.5)) * job["secs"] * FPS),
                                                              "position": rel(tg)}
                    else:
                        job["notes"].append(f"reach target {reach['to']!r} unknown")
                jobs.append(job)
    for name, m in story.get("motions", {}).items():     # reusable clips: idles, walks, gestures (anim actions use them)
        jobs.append({"id": f"{game}_motion_{name}", "scene": None, "clip": name, "who": m.get("who"), "prompt": m["prompt"],
                     "secs": float(m.get("secs", 4)), "fps": FPS, "loop": bool(m.get("loop")), "constraints": {}, "notes": []})
    return jobs


def desk_motion(npz, fps):
    """A Kimodo NPZ as a director file: the previs joints (setup/kimodo.json's joint_map), then all 77 of SOMA's."""
    import numpy as np
    conf = json.loads((ROOT / "setup" / "kimodo.json").read_text(encoding="utf-8"))["npz"]
    soma = json.loads((ROOT / conf.get("skeleton", "Content/Studio/soma77.json")).read_text(encoding="utf-8"))
    names77 = soma["names"]
    jmap = {k: (names77.index(v) if isinstance(v, str) else v) for k, v in (conf.get("joint_map") or {}).items()}
    if not jmap or any(v is None for v in jmap.values()):
        sys.exit("setup/kimodo.json npz.joint_map needs a SOMA joint for every previs joint")
    axes, sign = conf.get("axes", [0, 1, 2]), conf.get("signs", [1, 1, 1])
    joints = np.load(npz)[conf["joints"]]
    if joints.ndim == 4:                         # several samples: the first
        joints = joints[0]
    cols = list(jmap.values()) + list(range(len(names77)))     # the previs joints, then all of SOMA's
    names = list(jmap) + ["soma:" + nm for nm in names77]
    frames = [[[round(float(joints[fi, c, axes[a]]) * sign[a], 4) for a in range(3)] for c in cols]
              for fi in range(joints.shape[0])]
    return {"fps": fps, "height": soma["rest"][names77.index("HeadEnd")][1], "joints": names, "pos": frames}


def clips_of(story):
    for sid, sc in story.get("scenes", {}).items():
        for k, ver in ([(None, sc)] if not sc.get("variants") else list(sc["variants"].items())):
            for c in ver.get("clips", []):
                yield sid, k, c


def main():
    game, args = L.pick_game(sys.argv[1:])
    story, spath = L.load(game)
    game = spath.parent.name
    out = ROOT / "Saved" / "Story" / game / "motion"
    cmd = args[0] if args else "jobs"
    if cmd == "jobs":
        jobs = build_jobs(story, game)
        out.mkdir(parents=True, exist_ok=True)
        (out / "jobs.json").write_text(json.dumps(jobs, indent=1, ensure_ascii=False), encoding="utf-8")
        for j in jobs:
            (out / f"{j['id']}.constraints.json").write_text(json.dumps(j["constraints"], indent=1), encoding="utf-8")
            print(f"{j['id']:<34}{j['secs']:>5.1f} s  {j['prompt'][:60]}  {', '.join(j['constraints']) or '-'}"
                  f"{'  NOTE ' + '; '.join(j['notes']) if j['notes'] else ''}")
        print(f"MOTION jobs: {len(jobs)} -> {out / 'jobs.json'}")
    elif cmd == "run":
        conf = json.loads((ROOT / "setup" / "kimodo.json").read_text(encoding="utf-8"))
        jobs = json.loads((out / "jobs.json").read_text(encoding="utf-8"))
        for j in jobs:
            if len(args) > 1 and j["id"] != args[1]:
                continue
            argv = [a.format(py=sys.executable, prompt=j["prompt"], model=conf.get("model", ""), secs=j["secs"],
                             out=out / j["id"], seed=j.get("seed", 1)) for a in conf["cmd"]]
            kc = out / f"{j['id']}.kimodo.json"           # Kimodo-format constraints (`motion.py constrain`), when made
            if kc.exists():
                argv += [conf.get("constraints_arg", "--constraints"), str(kc)]
            print(" ".join(map(str, argv)))
            r = subprocess.run(argv, cwd=ROOT)
            print(f"{'ok  ' if r.returncode == 0 else 'FAIL'}  {j['id']}")
    elif cmd == "constrain":
        # blocking keys and paths -> Kimodo's own constraint files, solved on its skeleton inside its environment
        r = subprocess.run([sys.executable, str(ROOT / "tools" / "kimodo.py"), "py", "-P", str(ROOT / "tools" / "kimodo_constrain.py"),   # -P: tools/kimodo.py mustn't shadow the package
                            str(out / "jobs.json"), *args[1:]], cwd=ROOT)
        sys.exit(r.returncode)
    elif cmd == "preview":
        try:
            import numpy as np
        except ImportError:
            sys.exit("pip install numpy")
        jobs = json.loads((out / "jobs.json").read_text(encoding="utf-8"))
        mdir = spath.parent / "Motion"
        mdir.mkdir(exist_ok=True)
        n = 0
        for j in jobs:
            if len(args) > 1 and j["id"] != args[1]:
                continue
            f = out / f"{j['id']}.npz"
            if not f.exists():
                continue
            (mdir / f"{j['id']}.json").write_text(json.dumps(desk_motion(f, j["fps"]), separators=(",", ":")), encoding="utf-8")
            for sid, k, c in clips_of(story):
                if f"{game}_{sid}_{k or 'main'}_{c['id']}" == j["id"] and c.get("body"):
                    c["body"]["file"] = f"{j['id']}.json"
            n += 1
        spath.write_text(json.dumps(story, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"MOTION preview: {n} files -> {mdir}; clips point at them (fit them in the director if the take is longer)")
    elif cmd == "shotlist":
        mdir = spath.parent / "Motion"
        rows = list(segments(story))
        if not rows:
            sys.exit("no Kimodo segments: format 3 bodies carry `segments` (docs/STORY_FORMAT.md §9.5)")
        made = 0
        for sid, k, c, i, g in rows:
            done = (mdir / f"{g['name']}.json").exists()
            made += done
            secs = float(g.get("secs", 0))
            where = (f"{sid}/{k + '/' if k else ''}{c['id']}") if sid else f"motions.{i}"
            extra = [f"path {' > '.join(g['path'])}"] if g.get("path") else []
            extra += [f"keys {', '.join(kk['pose'] + '@' + str(kk.get('at', 0)) for kk in g['keys'])}"] if g.get("keys") else []
            extra += ["Loop"] if g.get("loop") else []
            extra += ["In place (the game moves it)"] if g.get("in_place") else []
            roles = [f"{st.get('title', tid)}: {role}" for tid, st in story.get("stitches", {}).items()
                     for role, mid in ((st.get("play") or {}).get("loops") or {}).items() if c is None and mid == i]
            extra += [f"gameplay ({'; '.join(sorted(set(roles))[:2])})"] if roles else []
            print(f"{'done' if done else '    '}  {g['name']:<40}{secs:>5.1f} s (frames 0-{int(round(secs * FPS)) - 1})  {where}")
            print(f"      {g.get('prompt', '')}{'   [' + '; '.join(extra) + ']' if extra else ''}")
        print(f"MOTION shotlist: {made}/{len(rows)} made. Save each from the demo as its name (NPZ), then: motion.py --game {game} import")
    elif cmd == "import":
        if len(args) > 1 and args[1].lower().endswith(".npz"):        # one motion, named by hand (optionally on a clip)
            if len(args) < 3 or not Path(args[1]).exists():
                sys.exit("motion.py --game G import <file.npz> <name> [--clip <scene>:<clip>]")
            try:
                import numpy as np  # noqa: F401
            except ImportError:
                sys.exit("pip install numpy")
            name = args[2].removesuffix(".json")
            mdir = spath.parent / "Motion"
            mdir.mkdir(exist_ok=True)
            (mdir / f"{name}.json").write_text(json.dumps(desk_motion(args[1], FPS), separators=(",", ":")), encoding="utf-8")
            msg = f"MOTION import: {mdir / name}.json"
            if "--clip" in args:
                clip = args[args.index("--clip") + 1]
                scene, _, cid = clip.rpartition(":")
                found = [(sid, c) for sid, _, c in clips_of(story) if c["id"] == cid and scene in ("", sid)]
                scenes = sorted({sid for sid, _ in found})
                if not found:
                    sys.exit(f"{msg}, but no clip {clip!r}")
                if len(scenes) > 1:
                    sys.exit(f"{msg}, but {cid!r} is in several scenes: say which, " + ", ".join(f"{sid}:{cid}" for sid in scenes))
                hit = [c for _, c in found]
                for c in hit:
                    c.setdefault("body", {})["file"] = f"{name}.json"
                spath.write_text(json.dumps(story, ensure_ascii=False, indent=1), encoding="utf-8")
                msg += f"; clip {clip} plays it ({len(hit)} version{'s' if len(hit) > 1 else ''})"
            print(msg)
        else:                                                          # every shot-list name (format 3 segments)
            try:
                import numpy  # noqa: F401
            except ImportError:
                sys.exit("pip install numpy")
            inbox = ROOT / "Saved" / "Story" / game / "kimodo"
            inbox.mkdir(parents=True, exist_ok=True)
            dirs = [inbox, ROOT] + [Path(a) for a in args[1:]]
            mdir = spath.parent / "Motion"
            mdir.mkdir(exist_ok=True)
            rows = list(segments(story))
            found, missing = 0, []
            for sid, k, c, i, g in rows:
                src = next((d / f"{g['name']}.npz" for d in dirs if (d / f"{g['name']}.npz").exists()), None)
                if not src:
                    if not (mdir / f"{g['name']}.json").exists():
                        missing.append(g["name"])
                    continue
                if src.parent != inbox:                      # keep the raw NPZ with the game's other Kimodo files
                    dst = inbox / src.name
                    src.replace(dst) if src.parent == ROOT else dst.write_bytes(src.read_bytes())
                    src = dst
                dm = desk_motion(src, FPS)
                (mdir / f"{g['name']}.json").write_text(json.dumps(dm, separators=(",", ":")), encoding="utf-8")
                n = len(dm["pos"])
                g["file"] = f"{g['name']}.json"
                if c is None:
                    g["file"] = f"{g['name']}.json"          # a motions-table entry (an idle)
                want = float(g.get("secs", 0)) * FPS
                note = f"  ({n / FPS:.1f} s, the shot list says {g.get('secs')} s)" if want and abs(n - want) > 0.2 * FPS else ""
                print(f"ok    {g['name']}  {n} frames{note}")
                found += 1
            spath.write_text(json.dumps(story, ensure_ascii=False, indent=1), encoding="utf-8")
            if missing:
                print(f"not made yet ({len(missing)}): {', '.join(missing[:12])}{' ...' if len(missing) > 12 else ''}")
            print(f"MOTION import: {found} motions -> {mdir} (the desk chains each clip's segments)")
    elif cmd == "check":
        try:
            import numpy as np
        except ImportError:
            sys.exit("pip install numpy")
        conf = json.loads((ROOT / "setup" / "kimodo.json").read_text(encoding="utf-8"))["npz"]
        names77 = json.loads((ROOT / conf.get("skeleton", "Content/Studio/soma77.json")).read_text(encoding="utf-8"))["names"]
        idx = {"left_hand": names77.index("LeftHand"), "right_hand": names77.index("RightHand"),
               "left_foot": names77.index("LeftToeBase"), "right_foot": names77.index("RightToeBase")}
        jobs = json.loads((out / "jobs.json").read_text(encoding="utf-8"))
        bad = 0
        for j in jobs:
            f = out / f"{j['id']}.npz"
            if not f.exists():
                print(f"MISS  {j['id']}: no result yet")
                continue
            d = np.load(f)
            joints = d[conf["joints"]]                        # frames x joints x 3 (Kimodo: x left, y up, z forward)
            if joints.ndim == 4:
                joints = joints[0]
            secs = joints.shape[0] / j["fps"]
            errs = []
            if abs(secs - j["secs"]) > 0.15:
                errs.append(f"{secs:.2f} s, wanted {j['secs']:.2f}")
            ee = j["constraints"].get("end_effector")
            if ee:                                            # job positions: x forward, y left, z up
                p = joints[min(ee["frame"], joints.shape[0] - 1), idx[ee["joint"]]]
                want = np.array([ee["position"][1], ee["position"][2], ee["position"][0]])
                miss = float(np.linalg.norm(want - p))
                if miss > 0.12:
                    errs.append(f"{ee['joint']} misses its target by {miss * 100:.0f} cm")
            if conf.get("contacts") in d:
                c = d[conf["contacts"]]
                c = c[0] if c.ndim == 3 else c
                skate = 0.0
                for k, jf in ((1, idx["left_foot"]), (3, idx["right_foot"])):     # [l heel, l toe, r heel, r toe]
                    v = np.linalg.norm(np.diff(joints[:, jf][:, [0, 2]], axis=0), axis=1)
                    skate = max(skate, float((v * c[1:, k]).sum()))
                if skate > 0.15:
                    errs.append(f"feet slide {skate * 100:.0f} cm while planted")
            print(f"{'ok  ' if not errs else 'FAIL'}  {j['id']}  {'; '.join(errs)}")
            bad += bool(errs)
        print("MOTION ok" if not bad else f"MOTION FAILED ({bad})")
        sys.exit(1 if bad else 0)
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
