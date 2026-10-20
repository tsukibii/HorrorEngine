#!/usr/bin/env python3
"""Brings the user's recorded takes into a game: files named by take id (`story.py clips` lists them), from any folder.

    python tools/intake.py --game Pilot <folder>      copy, measure, report; then import in the editor (below)
    python tools/intake.py --game Pilot --status      what's recorded, what's missing, what's over length
    python tools/intake.py --game Pilot <folder> --keep-trim   measure again, keeping trims you set by hand

For each take id it finds <id>.mp4 / .mov (MiniMax's video, with its voice) and/or <id>.wav: copies them to
Footage/<Game>/ (raw media, kept out of git), measures the take (the video when there is one) and **auto-cleans**
it: the clip's `dur` is the take's length and its `trim` cuts the dead air at either end, leaving a breath (the
scene's subtitles, body and cues follow by themselves; `--keep-trim` keeps trims set by hand in the desk). Videos
and mp3s need ffmpeg on the PATH (Windows: `winget install ffmpeg`). Then it lists what to look at: takes over game.clip_max, takes more than 40 % off the estimate
(a different reading than the script expects: worth a look), unknown files. Then in the editor:
`import storykit.media as m; m.import_takes("Pilot")` makes the SoundWaves (/Game/Games/<Game>/Audio/VO/<id>) and
queues the face videos for MetaHuman Animator (SETUP S11 writes storykit.media).
"""
import json
import shutil
import sys
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "Content" / "Python"))
from storykit import storylib as L  # noqa: E402
from storykit import takes as TK  # noqa: E402

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def all_clips(story, game):
    for sid, sc in story.get("scenes", {}).items():
        vs = sc.get("variants") or {}
        for k, ver in ([(None, sc)] if not vs else list(vs.items())):
            for c in ver.get("clips", []):
                yield f"{game}_{sid}_{k or 'main'}_{c['id']}", c
                for oid, _ in L.reply_clips(c):           # her answers to a reply: their own takes, measured onto the option's `then`
                    o = next(x for x in c["reply"]["options"] if x["id"] == oid)
                    yield f"{game}_{sid}_{k or 'main'}_{c['id']}_{oid}", o["then"]


def wav_secs(f):
    with wave.open(str(f)) as w:
        return round(w.getnframes() / w.getframerate(), 2)


def main():
    game, args = L.pick_game(sys.argv[1:])
    story, spath = L.load(game)
    game = spath.parent.name
    cmax = story["game"].get("clip_max", 8 if story.get("format", 2) >= 3 else 10)
    keep = "--keep-trim" in args
    args = [a for a in args if a != "--keep-trim"]
    foot = ROOT / "Footage" / game
    clips = dict(all_clips(story, game))
    if args and args[0] == "--status":
        have = [k for k, c in clips.items() if c.get("dur")]
        print(f"{len(have)}/{len(clips)} takes recorded")
        for k, c in clips.items():
            if not c.get("dur"):
                print(f"  missing {k}: {c.get('en', '')[:60]}")
        return
    if not args:
        print(__doc__)
        return
    src = Path(args[0])
    foot.mkdir(parents=True, exist_ok=True)
    found, notes, unknown = 0, [], []
    files = {}
    for f in sorted(src.iterdir()):
        if f.suffix.lower() not in TK.AUDIO:
            continue
        if f.stem not in clips and f.stem not in story.get("lines", {}):
            unknown.append(f.name)
            continue
        shutil.copy2(f, foot / f.name)
        files.setdefault(f.stem, []).append(f)
    for tid, fs in files.items():
        f = sorted(fs, key=lambda x: x.suffix.lower() not in (".mp4", ".mov"))[0]      # the video's length rules
        c = clips.get(tid) or story["lines"][tid]
        est = L.clip_secs(dict(c, dur=None, trim=None))
        try:
            m = TK.measure(f)
        except RuntimeError as e:
            notes.append(f"{f.name}: {e}")
            continue
        TK.clean(c, m, keep_trim=keep)
        secs = L.clip_secs(c)
        found += 1
        cut = c.get("trim") or {}
        if cut:
            notes.append(f"{tid}: {m['dur']:.1f} s, trimmed {cut.get('in', 0):.2f} s in and {cut.get('out', 0):.2f} s out of dead air -> {secs:.1f} s")
        if secs > cmax + 0.01:
            notes.append(f"{tid}: {secs:.1f} s, over the {cmax} s a clip can be: split it, or trim the take")
        if est and abs(secs - est) / est > 0.4:
            notes.append(f"{tid}: {secs:.1f} s against about {est:.1f} s expected (a slower or faster reading: fine if it plays)")
    spath.write_text(json.dumps(story, ensure_ascii=False, indent=1), encoding="utf-8")
    for n in notes:
        print("look:", n)
    if unknown:
        print("unknown files (not a take id):", ", ".join(unknown))
    print(f"INTAKE {found} takes measured and cleaned -> {foot}; now rerun the checks, then storykit.media.import_takes('{game}')")


if __name__ == "__main__":
    main()
