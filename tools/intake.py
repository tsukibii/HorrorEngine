#!/usr/bin/env python3
"""Brings the user's recorded takes into a game: files named by take id (`story.py clips` lists them), from any folder.

    python tools/intake.py --game Pilot <folder>      copy, measure, report; then import in the editor (below)
    python tools/intake.py --game Pilot --status      what's recorded, what's missing, what's over length

For each take id it finds <id>.wav (the voice) and <id>.mp4 / .mov (the face video): copies them to
Footage/<Game>/ (raw media, kept out of git), writes the voice's length into the clip's `dur` (the scene's cues
follow by themselves), and lists what to look at: takes over game.clip_max, takes more than 40 % off the estimate
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

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def all_clips(story, game):
    for sid, sc in story.get("scenes", {}).items():
        vs = sc.get("variants") or {}
        for k, ver in ([(None, sc)] if not vs else list(vs.items())):
            for c in ver.get("clips", []):
                yield f"{game}_{sid}_{k or 'main'}_{c['id']}", c


def wav_secs(f):
    with wave.open(str(f)) as w:
        return round(w.getnframes() / w.getframerate(), 2)


def main():
    game, args = L.pick_game(sys.argv[1:])
    story, spath = L.load(game)
    game = spath.parent.name
    cmax = story["game"].get("clip_max", 10)
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
    for f in sorted(src.iterdir()):
        if f.suffix.lower() not in (".wav", ".mp4", ".mov", ".mp3"):
            continue
        tid = f.stem
        if tid not in clips and tid not in story.get("lines", {}):
            unknown.append(f.name)
            continue
        shutil.copy2(f, foot / f.name)
        if f.suffix.lower() == ".mp3":
            notes.append(f"{f.name}: mp3 can't be measured here; export the voice as .wav")
        if f.suffix.lower() == ".wav":
            secs = wav_secs(f)
            c = clips.get(tid) or story["lines"][tid]
            est = L.clip_secs(dict(c, dur=None))
            c["dur"] = secs
            found += 1
            if secs > cmax + 0.01:
                notes.append(f"{tid}: {secs:.1f} s, over the {cmax} s a clip can be: split it, or trim the take")
            if abs(secs - est) / est > 0.4:
                notes.append(f"{tid}: {secs:.1f} s against about {est:.1f} s expected (a slower or faster reading: fine if it plays)")
    spath.write_text(json.dumps(story, ensure_ascii=False, indent=1), encoding="utf-8")
    for n in notes:
        print("look:", n)
    if unknown:
        print("unknown files (not a take id):", ", ".join(unknown))
    print(f"INTAKE {found} voice takes measured -> {foot}; now rerun the checks, then storykit.media.import_takes('{game}')")


if __name__ == "__main__":
    main()
