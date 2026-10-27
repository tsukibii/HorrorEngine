"""An expression captured from a video of a face, for the expression library (docs/EXPRESSIONS_PLAN.md §1): MediaPipe's
Face Landmarker in video mode (Apache-2.0, local, no account: the environment `face_mesh.py setup` makes) scores the
52 ARKit blendshapes on every frame: brows, lids, gaze, cheeks, jaw, lips. The head's own movement is left out (Kimodo
moves the head). Each channel is smoothed without lag (a one-pole filter run forward and back), the blinks lightly, and
kept as MediaPipe's raw scores: the neutral (the first frame, the clip's quietest, none) and the strength are the
library's choices, made when it plays (tools/shared/face.js), not baked here.

    python tools/face_capture.py solve <video> --out DIR   DIR/expression.json (the curves) and clip.mp4 (the face
                                                           cropped square, no sound: shown beside the character in the
                                                           desk's preview; the library's cards are the character itself)
    python tools/face_capture.py check                     the filter and the file on made-up curves; every expression
                                                           in Content/Studio/Expressions read and in range (FACECAP ok)

The desk's server runs `solve` for its Import (tools/director/serve.py, /api/expressions/import).
"""
import argparse
import json
import math
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
LIBRARY = ROOT / "Content" / "Studio" / "Expressions"
VERSION = 1
CUTOFF = 6.0                     # Hz: the smoothing of every channel...
FAST = {"eyeBlinkLeft": 14.0, "eyeBlinkRight": 14.0}   # ...but the blinks, which stay snappy
MOVES = 0.02                     # a channel that never strays further than this from its quietest is left out
CROP = 480                       # the face's square in clip.mp4, in pixels


def smooth(v, fps, cutoff):
    """a one-pole low-pass run forward and then back: no lag, no overshoot"""
    if len(v) < 3:
        return list(v)
    a = 1 - math.exp(-2 * math.pi * cutoff / fps)
    out = list(v)
    for rng in (range(1, len(out)), range(len(out) - 2, -1, -1)):
        prev = out[rng[0] - 1] if rng.step > 0 else out[rng[0] + 1]
        for i in rng:
            prev = out[i] = prev + a * (out[i] - prev)
    return out


def fill(rows):
    """frames where no face was found take the nearest found ones' scores (blended between two)"""
    found = [i for i, r in enumerate(rows) if r is not None]
    if not found:
        return None
    out = []
    for i, r in enumerate(rows):
        if r is not None:
            out.append(r); continue
        a = max((j for j in found if j < i), default=None)
        b = min((j for j in found if j > i), default=None)
        if a is None or b is None:
            out.append(rows[a if b is None else b]); continue
        t = (i - a) / (b - a)
        out.append({k: rows[a][k] + t * (rows[b][k] - rows[a][k]) for k in rows[a]})
    return out


def curves_of(rows, fps):
    """{channel: [score a frame]} smoothed, the still channels left out, three decimals"""
    names = list(rows[0].keys())
    out = {}
    for k in names:
        if k == "_neutral":
            continue
        v = smooth([r[k] for r in rows], fps, FAST.get(k, CUTOFF))
        if max(v) - min(v) < MOVES:
            continue
        out[k] = [round(min(1.0, max(0.0, x)), 3) for x in v]
    return out


def solve(video, out):
    import face_mesh as FM
    FM.no_metrics()
    import cv2
    import mediapipe as mp
    from mediapipe.tasks.python import BaseOptions, vision
    home = Path(os.environ.get("FACE_MESH_HOME", ROOT / "vendor" / "face_mesh"))
    model = home / "face_landmarker.task"
    if not model.exists():
        sys.exit(f"no Face Landmarker model at {model}: python tools/face_mesh.py setup")
    opts = vision.FaceLandmarkerOptions(base_options=BaseOptions(model_asset_path=str(model)), num_faces=1,
                                        output_face_blendshapes=True, running_mode=vision.RunningMode.VIDEO)
    lm = vision.FaceLandmarker.create_from_options(opts)
    cap = cv2.VideoCapture(str(video))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    W, H = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    rows, box, i = [], None, 0
    while True:
        ok, img = cap.read()
        if not ok:
            break
        res = lm.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)), int(i * 1000 / fps))
        if res.face_blendshapes and res.face_landmarks:
            rows.append({c.category_name: c.score for c in res.face_blendshapes[0]})
            xs = [p.x * W for p in res.face_landmarks[0]]; ys = [p.y * H for p in res.face_landmarks[0]]
            b = (min(xs), min(ys), max(xs), max(ys))
            box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
        else:
            rows.append(None)
        i += 1
    cap.release()
    lm.close()
    found = sum(r is not None for r in rows)
    if not found:
        sys.exit("no face found in the video")
    rows = fill(rows)
    curves = curves_of(rows, fps)
    n = len(rows)
    out.mkdir(parents=True, exist_ok=True)
    # the face's square: round the face's extent over the whole clip, a little more above (the brows, the forehead)
    cx, cy, size = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2 - 0.05 * (box[3] - box[1]), 1.5 * max(box[2] - box[0], box[3] - box[1])
    size = min(size, W, H); x0 = int(min(max(0, cx - size / 2), W - size)); y0 = int(min(max(0, cy - size / 2), H - size)); size = int(size) // 2 * 2
    crop = f"crop={size}:{size}:{x0}:{y0},scale={CROP}:{CROP}"
    ff = shutil.which("ffmpeg")
    if ff:
        subprocess.run([ff, "-v", "error", "-y", "-i", str(video), "-vf", crop + ",format=yuv420p", "-an", "-c:v", "libx264", "-preset", "veryfast",
                        "-crf", "26", "-movflags", "+faststart", str(out / "clip.mp4")], check=True)
    else:
        print("no ffmpeg: no clip (the curves are kept)")
    expr = {"about": "an expression captured from a video (tools/face_capture.py): MediaPipe's 52 ARKit scores a frame, raw, "
                     "smoothed without lag, the head left out; played onto MHR's 72 shapes through arkit_mhr.json (tools/shared/face.js)",
            "version": VERSION, "fps": round(fps, 3), "frames": n, "secs": round(n / fps, 3),
            "source": {"file": Path(video).name, "width": W, "height": H, "found": found, "crop": [x0, y0, size]},
            "neutral": "first", "strength": 1.0, "curves": curves}
    (out / "expression.json").write_text(json.dumps(expr, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({"ok": True, "frames": n, "found": found, "fps": round(fps, 3), "channels": len(curves)}))


def cmd_check(a):
    fails = []
    # the filter: a step comes out without lag (symmetric about where it steps) and a spike is damped, both ways equally
    step = [0.0] * 30 + [1.0] * 30
    s = smooth(step, 30, CUTOFF)
    if not (abs(s[29] + s[30] - 1) < 0.02 and s[29] < 0.5 < s[30]): fails.append(f"the filter lags: {s[28:32]}")   # symmetric about the step
    spike = [0.0] * 20 + [1.0] + [0.0] * 20
    s = smooth(spike, 30, CUTOFF)
    if not (s[20] < 0.6 and abs(s[19] - s[21]) < 1e-9): fails.append(f"the filter on a spike: {s[18:23]}")
    rows = fill([None, {"a": 0.0}, None, {"a": 1.0}, None])
    if [r["a"] for r in rows] != [0.0, 0.0, 0.5, 1.0, 1.0]: fails.append(f"the gaps: {rows}")
    c = curves_of([{"still": 0.3, "moves": 0.1 * i} for i in range(10)], 30)
    if "still" in c or "moves" not in c: fails.append(f"still channels kept: {list(c)}")
    arkit = set(json.loads((ROOT / "tools" / "character" / "arkit_mhr.json").read_text())["map"]) | {"tongueOut"}
    n = 0
    for d in sorted(LIBRARY.iterdir()) if LIBRARY.is_dir() else []:
        f = d / "expression.json"
        if not f.is_file():
            continue
        n += 1
        e = json.loads(f.read_text())
        bad = [k for k, v in e["curves"].items() if k not in arkit or len(v) != e["frames"] or min(v) < 0 or max(v) > 1]
        if not e.get("name") or bad or e["frames"] < 1 or abs(e["secs"] - e["frames"] / e["fps"]) > 0.01 or not 0.05 < float(e.get("length", e["secs"])) <= 600:
            fails.append(f"{d.name}: name {e.get('name')!r}, bad channels {bad}")
    for x in fails:
        print("  FAIL " + x)
    if fails:
        sys.exit("FACECAP FAIL")
    print(f"FACECAP ok (the filter, the gaps, {n} expressions in the library)")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--home", default=None, help="MediaPipe's environment (default vendor/face_mesh)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("solve"); s.add_argument("video"); s.add_argument("--out", required=True)
    sub.add_parser("check")
    a = ap.parse_args()
    if a.home:
        os.environ["FACE_MESH_HOME"] = a.home
    if a.cmd == "check":
        return cmd_check(a)
    try:                                                 # solve runs in MediaPipe's environment
        import mediapipe  # noqa: F401
    except ImportError:
        import face_mesh as FM
        py = FM.py_of(Path(os.environ.get("FACE_MESH_HOME", ROOT / "vendor" / "face_mesh")))
        if not py.exists():
            sys.exit(f"no MediaPipe environment at {py.parent.parent}: python tools/face_mesh.py setup")
        sys.exit(subprocess.run([str(py), *sys.argv]).returncode)
    t0 = time.time()
    solve(Path(a.video), Path(a.out))
    print(f"solved in {time.time() - t0:.1f} s", file=sys.stderr)


if __name__ == "__main__":
    main()
