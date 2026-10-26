#!/usr/bin/env python3
"""Small views of a game's story.json, so nobody has to read the whole file. Every command takes --game <Name>.

    python tools/story.py flow                  the flow graph from the start: scenes, stitches, choices, endings
    python tools/story.py show <id>             one scene, stitch or flow node, compactly
    python tools/story.py rooms [level]         rooms, openings and props, one line each
    python tools/story.py stats                 counts, words, minutes of performance
    python tools/story.py clips [out.csv] [--all]   the takes to record (MiniMax): one row per clip, picked variants (or all)
    python tools/story.py minimax [--scene S] [--csv out.csv] [--all]   each take's MiniMax prompt, ready to paste, with
                                                its take id (the file name), the Japanese, the delivery note and subtitles
    python tools/story.py lines [out.csv]       one-off voice lines (say, whisper) outside scenes
    python tools/story.py cast                  each cast member's clips, lines and scenes
    python tools/story.py art                   every prop still a block, with library meshes named like its tag
    python tools/story.py durations <folder>    reads <take id>.wav lengths into each clip's (and line's) "dur"
    python tools/story.py notes [--all]         open notes from the director's desk (on nodes and the board): read them first
    python tools/story.py new <Name>            a new game folder with a minimal story that passes the checks

A take id is <Game>_<scene>_<variant or main>_<clip>; the user's files come back named by it (.wav, .mp4).
"""
import csv
import json
import sys
import wave
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "Content" / "Python"))
from storykit import storylib as L  # noqa: E402

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def is_block(t):
    """A prop that is still a grey block: a shape, no art, not a library mesh."""
    sh = str(t.d.get("shape", ""))
    return t.kind == "prop" and sh and not sh.startswith(("asset ", "person")) and not t.d.get("art")


def short(d, skip=("id",)):
    return " ".join(f"{k}={json.dumps(v, ensure_ascii=False)}" for k, v in d.items() if k not in skip)


def take_id(game, sid, variant, cid):
    return f"{game}_{sid}_{variant or 'main'}_{cid}"


def versions(sc, every=False):
    vs = sc.get("variants") or {}
    if not vs:
        return [(None, sc)]
    keys = list(vs) if every else [sc.get("pick")]
    return [(k, L.scene_version(dict(sc, pick=k))) for k in keys]


def bookend(prev_seam, next_seam):
    """What the take's first and last frames should be, so its cuts hide well."""
    start = "begin on the anchor frame (face to camera, neutral, mouth closed)"
    end = "end on the anchor frame"
    if prev_seam in ("turn",):
        start = "begin turned away or head down, then come round"
    if next_seam in ("turn",):
        end = "end turning away or head down"
    if next_seam in ("glance", "blink", "flicker", "occlude", "cutaway", "dip", "stumble"):
        end = "end on the anchor frame (the cut is hidden, but matching poses keep it invisible)"
    return start, end


def write_rows(rows, out):
    fh = open(out, "w", newline="", encoding="utf-8-sig") if out else sys.stdout
    w = csv.writer(fh)
    for row in rows:
        w.writerow(row)
    if out:
        fh.close()
        print(f"wrote {out} ({len(rows) - 1} rows)")


TIME_MARK = {"day": "☀ day", "dusk": "◐ dusk", "night": "☾ night"}


def flow_view(story):
    flow, start = story["flow"], story["game"]["start"]
    seen, times = set(), L.flow_times(story)

    def node(nid, depth):
        pad = "  " * depth
        if nid in seen:
            print(f"{pad}-> {nid} (joins above)")
            return
        seen.add(nid)
        n = flow[nid]
        t = n["type"]
        if t in ("scene", "stitch"):
            ref = (story["scenes"] if t == "scene" else story["stitches"]).get(n["ref"], {})
            extra = ""
            if t == "scene":
                ver = L.scene_version(ref)
                secs = sum(L.clip_secs(c) for c in ver.get("clips", []))
                vs = ref.get("variants")
                extra = f"  {len(ver.get('clips', []))} clips, {secs:.0f} s" + (f", variants {list(vs)} pick {ref.get('pick')}" if vs else "")
                ft = times.get(nid)                     # its time of day: set here, or kept from the scene before
                if ft:
                    extra += "  " + (TIME_MARK[ft["time"]] if ft["own"] else " or ".join(ft["paths"]) + " (kept)")
            print(f"{pad}{nid}  [{t}] {ref.get('title', n['ref'])}{extra}")
            if t == "stitch":
                tm = ref.get("timer")
                if tm:
                    print(f"{pad}  ⏱ {tm.get('secs')} s ({tm.get('label', '')}), on timeout:")
                    node(tm["fail"], depth + 2)
                for it in story.get("interrupts", []):
                    if it.get("during") == "all" or n["ref"] in (it.get("during") or []):
                        print(f"{pad}  ☠ {it.get('label', it.get('id'))} (when {json.dumps(it.get('when'))}):")
                        node(it["to"], depth + 2)
            node(n["next"], depth)
        elif t == "choice":
            print(f"{pad}{nid}  [choice by {n['by']}] {n.get('prompt', '')}")
            for o in n["options"]:
                cond = o.get("label") or o.get("result") or (" & ".join(o["if"]) if o.get("if") else "otherwise")
                print(f"{pad}  ? {cond}")
                node(o["to"], depth + 2)
        else:
            print(f"{pad}{nid}  [ending: {n.get('kind')}] {n.get('title', '')}")

    node(start, 0)


NEW = {
    "format": 3,
    "game": {"id": "", "title": "", "start": "n_start", "target_min": 0, "voice": "ja", "text": "en", "clip_max": 8,
             "subtitles": ["en", "zh"]},
    "cast": {"someone": {"name": "Someone", "metahuman": None, "height": 1.7}},
    "items": {}, "notes": {}, "lines": {}, "sounds": {},
    "levels": {"main": {"start": "start", "rooms": [
        {"id": "room_a", "at": [0, 0, 0], "size": [5, 5, 2.8], "floor": "wood", "light": "dim", "props": [
            {"id": "start", "use": "spot", "at": [2.5, 1], "rot": 90},
            {"id": "someone_spot", "use": "spot", "at": [2.5, 4], "rot": 270},
            {"id": "room_a_lamp", "use": "light", "kind": "bulb", "lit": True, "at": [2.5, 2.5], "z": 2.6}]}],
        "links": []}},
    "scenes": {"s_first": {"title": "First words", "level": "main", "stage": {"someone": "someone_spot"},
                           "view": "start", "camera": {"mode": "soft", "look": "someone", "cone": [30, 18]},
                           "clips": [{"id": "c1", "who": "someone", "ja": "……", "en": "...", "act": "looks up"}]}},
    "stitches": {"t_start": {"title": "Start", "level": "main", "beats": [
        {"id": "b_start", "when": {"start": True}, "do": [{"fade": "in", "secs": 2}, {"done": True}]}]}},
    "flow": {"n_start": {"type": "stitch", "ref": "t_start", "next": "n_first"},
             "n_first": {"type": "scene", "ref": "s_first", "next": "e_end", "final": True},
             "e_end": {"type": "ending", "kind": "good", "title": "The end"}},
    "secrets": {},
}


def main():
    game, args = L.pick_game(sys.argv[1:])
    if not args:
        print(__doc__)
        return
    cmd, args = args[0], args[1:]
    if cmd == "new":
        name = args[0]
        d = L.GAMES / name
        if (d / "story.json").exists():
            sys.exit(f"{d} already has a story")
        d.mkdir(parents=True, exist_ok=True)
        s = json.loads(json.dumps(NEW))
        s["game"].update(id=name, title=name, built_with={"engine": L.engine_version(), "format": 3})
        (d / "story.json").write_text(json.dumps(s, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"made {d / 'story.json'}: check it with python tools/check_all.py --game {name}")
        return
    story, path = L.load(game)
    game = path.parent.name
    things, _ = L.index(story)
    if cmd == "flow":
        flow_view(story)
    elif cmd == "show":
        tid = args[0]
        for table in ("flow", "scenes", "stitches"):
            if tid in story.get(table, {}):
                obj = story[table][tid]
                if table == "stitches":
                    print(f"stitch {tid}: {obj.get('title', '')} (level {L.level_of(story, obj)})")
                    for b in obj["beats"]:
                        print(f"  {b['id']}: when {json.dumps(b['when'])}{' if ' + ','.join(b['if']) if b.get('if') else ''}"
                              f"{' (optional)' if b.get('optional') else ''}{' (secret)' if b.get('secret') else ''}")
                        for a in b.get("do", []):
                            print(f"      {json.dumps(a, ensure_ascii=False)}")
                elif table == "scenes":
                    print(f"scene {tid}: {obj.get('title', '')} (level {L.level_of(story, obj)}, camera {json.dumps(obj.get('camera'))})")
                    for k, ver in versions(obj, every=True):
                        print(f"  version {k or 'main'}{' (picked)' if k and k == obj.get('pick') else ''}: stage {ver.get('stage')}")
                        for c in ver.get("clips", []):
                            seam = c.get("seam", {}).get("kind", "-")
                            print(f"    {c['id']} [{seam:>8}] {c.get('who')}: {c.get('en')}  ({L.clip_secs(c):.1f} s{'' if c.get('dur') else ' est'})"
                                  f"{'  [' + c['shot'] + ']' if c.get('shot') else ''}{'  EVENT ' + json.dumps({k: v for k, v in c['event'].items() if k != 'on'}) if c.get('event') else ''}")
                        for cue in ver.get("cues", []):
                            print(f"    cue {json.dumps(cue['at'])}: {json.dumps(cue['do'], ensure_ascii=False)}")
                    for a in obj.get("sets", []):
                        print(f"  sets {json.dumps(a, ensure_ascii=False)}")
                else:
                    print(f"flow {tid}: {json.dumps(obj, ensure_ascii=False)}")
                return
        sys.exit(f"no scene, stitch or flow node {tid!r}")
    elif cmd == "notes":
        every = "--all" in args
        found = 0
        hosts = [(nid, (story["scenes"].get(n.get("ref")) if n["type"] == "scene" else
                        story["stitches"].get(n.get("ref")) if n["type"] == "stitch" else n) or {})
                 for nid, n in story["flow"].items()]
        hosts.append(("board", {"notes": story.get("board", [])}))
        for nid, h in hosts:
            for x in h.get("notes", []):
                if x.get("done") and not every:
                    continue
                found += 1
                print(f"[{nid}] {x.get('by', '?')} {x.get('at', '')}{' (done)' if x.get('done') else ''}: {x.get('text')}")
        print(f"{found} note(s){'' if every else ' open'}. Answer with a note of your own (by: claude) and set done on what's handled.")
    elif cmd == "rooms":
        for lid, lvl in story["levels"].items():
            if args and lid != args[0]:
                continue
            print(f"level {lid} (start {lvl.get('start')})")
            for rm in lvl["rooms"]:
                print(f"  {rm['id']} at {rm['at']} size {rm['size']} skip {rm.get('skip', [])}")
                for op in rm.get("openings", []):
                    print(f"    opening {short(op)}")
                for p in rm.get("props", []):
                    print(f"    {p['id']}: {short(p)}")
            for ln in lvl.get("links", []):
                print(f"  link {ln['a']} <-> {ln['b']} via {ln.get('via')}")
    elif cmd == "stats":
        scenes = story.get("scenes", {})
        clips = [c for sc in scenes.values() for _, v in versions(sc) for c in v.get("clips", [])]
        all_clips = [c for sc in scenes.values() for _, v in versions(sc, True) for c in v.get("clips", [])]
        perf = sum(L.clip_secs(c) for c in clips)
        beats = sum(len(st["beats"]) for st in story.get("stitches", {}).values())
        rooms = sum(len(lv["rooms"]) for lv in story["levels"].values())
        blocks = sum(1 for t in things.values() if is_block(t))
        ends = [n.get("kind") for n in story["flow"].values() if n["type"] == "ending"]
        print(f"{game}: {len(scenes)} scenes ({len(clips)} clips playing, {len(all_clips)} with variants; "
              f"{perf / 60:.1f} min of performance), {len(story.get('stitches', {}))} stitches ({beats} beats), "
              f"{len(story['flow'])} flow nodes, endings {ends}")
        print(f"rooms {rooms}, props {len(things) - rooms}, blocks without art {blocks}, notes {len(story.get('notes', {}))}, "
              f"cast {len(story.get('cast', {}))}, takes recorded {sum(1 for c in all_clips if c.get('dur'))}/{len(all_clips)}")
    elif cmd == "clips":
        every = "--all" in args
        args = [a for a in args if a != "--all"]
        rows = [["take", "scene", "variant", "clip", "speaker", "ja", "en", "act", "est_secs", "max_secs",
                 "seam_in", "start_frame", "end_frame", "face"]]
        cmax = story["game"].get("clip_max", 10)
        for sid, sc in story.get("scenes", {}).items():
            for k, ver in versions(sc, every):
                clips = ver.get("clips", [])
                for i, c in enumerate(clips):
                    prev_seam = (c.get("seam") or {}).get("kind", "") if i else ""
                    next_seam = (clips[i + 1].get("seam") or {}).get("kind", "") if i + 1 < len(clips) else ""
                    start, end = bookend(prev_seam, next_seam)
                    rows.append([take_id(game, sid, k, c["id"]), sid, k or "main", c["id"], c.get("who"), c.get("ja", ""),
                                 c.get("en", ""), c.get("act", ""), f"{L.clip_secs(c):.1f}", cmax, prev_seam or "-",
                                 start, end, "no" if c.get("face") is False else "yes"])
        write_rows(rows, args[0] if args else None)
    elif cmd == "minimax":
        every = "--all" in args
        only = args[args.index("--scene") + 1] if "--scene" in args else None
        out = args[args.index("--csv") + 1] if "--csv" in args else None
        cmax = story["game"].get("clip_max", 8 if story.get("format", 2) >= 3 else 10)
        rows = [["take", "scene", "clip", "speaker", "est_secs", "expr", "voice", "ja", "ja_note", "en", "zh", "prompt"]]
        for sid, sc in story.get("scenes", {}).items():
            if only and sid != only:
                continue
            for k, ver in versions(sc, every):
                for c in [x for c0 in ver.get("clips", []) for x in [c0] + [rc for _, rc in L.reply_clips(c0)]]:
                    tid, secs = take_id(game, sid, k, c["id"]), L.clip_secs(c)
                    prompt = L.minimax_prompt(c, story.get("cast"))
                    rows.append([tid, sid, c["id"], c.get("who"), f"{secs:.1f}", c.get("expr", ""), c.get("voice", ""), c.get("ja", ""),
                                 c.get("ja_note", ""), c.get("en", ""), c.get("zh", ""), prompt])
                    if not out:
                        flag = f"  SPLIT IT: over {cmax} s" if secs > cmax else ""
                        missing = [f for f in ("expr", "voice") if not c.get(f) and c.get("face") is not False]
                        print(f"{tid}.mp4  ({secs:.1f} s{'' if c.get('dur') else ' est'}){flag}"
                              f"{'  (no ' + ', '.join(missing) + ')' if missing else ''}")
                        if c.get("ja_note"):
                            print(f"  delivery: {c['ja_note']}")
                        print(f"  en: {c.get('en', '')}" + (f"   zh: {c['zh']}" if c.get("zh") else ""))
                        print(f"  {prompt}\n")
        if not only:                                   # the lines outside scenes: gameplay barks and one-off voice lines
            for lid, ln in story.get("lines", {}).items():
                prompt = L.minimax_prompt(ln, story.get("cast"))
                rows.append([lid, "(line)", "", ln.get("who"), f"{L.line_secs(ln):.1f}", ln.get("expr", ""), ln.get("voice", ""), ln.get("ja", ""),
                             ln.get("ja_note", ""), ln.get("en", ""), ln.get("zh", ""), prompt])
                if not out:
                    print(f"{lid}.mp4  (line{', heard not seen' if ln.get('face') is False else ''})")
                    if ln.get("ja_note"):
                        print(f"  delivery: {ln['ja_note']}")
                    print(f"  en: {ln.get('en', '')}" + (f"   zh: {ln['zh']}" if ln.get("zh") else ""))
                    print(f"  {prompt}\n")
        if out:
            write_rows(rows, out)
        else:
            print(f"{len(rows) - 1} takes. Save each MiniMax video as its take id (.mp4) in one folder for the timeline.")
    elif cmd == "lines":
        rows = [["id", "speaker", "mood", "ja", "en"]]
        for k, ln in story.get("lines", {}).items():
            rows.append([k, ln.get("who"), ln.get("mood", ""), ln.get("ja", ""), ln.get("en", "")])
        write_rows(rows, args[0] if args else None)
    elif cmd == "cast":
        for cid, c in story.get("cast", {}).items():
            n = [(sid, c2["id"]) for sid, sc in story.get("scenes", {}).items() for _, v in versions(sc, True)
                 for c2 in v.get("clips", []) if c2.get("who") == cid]
            mine = [k for k, ln in story.get("lines", {}).items() if ln.get("who") == cid]
            print(f"{cid} ({c.get('name')}, {c.get('height', 1.7)} m, metahuman {c.get('metahuman')}): "
                  f"{len(n)} clips in {sorted({s for s, _ in n})}, {len(mine)} lines {mine}")
    elif cmd == "art":
        from storykit import library as LIB
        index = LIB.mesh_index("basemesh")
        for t in things.values():
            if is_block(t):
                w, d, h = t.size
                tag = t.d.get("tag", "")
                # library meshes named like its tag, closest in size first: candidates for `art` or `shape: asset`
                near = sorted((n for n in index if tag and tag in n),
                              key=lambda n: sum(abs(a - b) for a, b in zip(LIB.mesh_size(f"basemesh/{n}"), t.size)))[:3]
                print(f"{t.room:<16}{t.id:<24}{tag:<10}{w:.2f} x {d:.2f} x {h:.2f} m  {' '.join(near)}")
    elif cmd == "durations":
        folder, n = Path(args[0]), 0

        def length(f):
            with wave.open(str(f)) as wv:
                return round(wv.getnframes() / wv.getframerate(), 2)
        for sid, sc in story.get("scenes", {}).items():
            vs = sc.get("variants") or {}
            for k, ver in ([(None, sc)] if not vs else list(vs.items())):
                for c in ver.get("clips", []):
                    f = folder / f"{take_id(game, sid, k, c['id'])}.wav"
                    if f.exists():
                        c["dur"] = length(f)
                        n += 1
        for k, ln in story.get("lines", {}).items():
            f = folder / f"{k}.wav"
            if f.exists():
                ln["dur"] = length(f)
                n += 1
        path.write_text(json.dumps(story, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"set dur on {n} takes (now rerun the checks: longer takes push the scene's cues along by themselves)")
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
