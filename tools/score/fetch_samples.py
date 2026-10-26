#!/usr/bin/env python3
"""The score room's added instruments: fetched from the CC0 libraries on GitHub, prepared and written into
Content/Studio/Music/samples/ beside the ones lifted from Woohill (docs/MUSIC.md §7).

    python tools/score/fetch_samples.py            fetch what's missing, prepare it, update instruments.json
    python tools/score/fetch_samples.py --list     what it would add, and what's there
    python tools/score/fetch_samples.py --only viola_sus,glass   just those
    python tools/score/fetch_samples.py --force    prepare them again even if they're there

The sources are VSCO-2 Community Edition and the Versilian Community Sample Library (VCSL), both CC0 1.0 by
Versilian Studios. Only the folders an instrument needs are checked out (a sparse clone in Saved/Score/sources/).
Each sample is found by its file name, its real pitch measured (the libraries name octaves two ways, and a sample
can sit a few cents off), trimmed of its leading silence, cut at `max` seconds with a fade, made mono at 44.1 kHz
and written as Ogg Vorbis. One gain for the whole instrument keeps its velocity layers' levels; `calib_db` matches
its loudness to an instrument already here (`match`), so a swap or a new cue sits where the old ones do.

The instruments lifted from Woohill (piano, strings, trem, pizz...) are never touched. ffmpeg and numpy are needed.
"""
import argparse
import json
import math
import re
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SAMPLES = ROOT / "Content" / "Studio" / "Music" / "samples"
SOURCES = ROOT / "Saved" / "Score" / "sources"
SR = 44100

REPOS = {
    "vsco": ("https://github.com/sgossner/VSCO-2-CE", "VSCO-2 Community Edition by Versilian Studios (github.com/sgossner/VSCO-2-CE), CC0 1.0"),
    "vcsl": ("https://github.com/sgossner/VCSL", "Versilian Community Sample Library by Versilian Studios (github.com/sgossner/VCSL), CC0 1.0"),
}
NOTE = r"([A-G]#?-?\d)"

# Pitched instruments. dir: the folder in the repo; re: the file name with the note as group 1 and, when there is
# one, the velocity layer as group 2 (named by `layers`, quietest first); oct: the octave the library's names are
# off by (VSCO's sections name middle C "C3": +12), a hint the measured pitch can overrule; max: seconds kept.
# best: when it works best (shown in the score room's Instruments list and its string sets); adjust: dB on top of the
# loudness match, set by ear and by the page test's peaks.
PITCHED = {
    # --- the other string sections, for the string sets (docs/MUSIC.md §7.1) ---
    "viola_sus": dict(src="vsco", dir="Strings/Viola Section/susvib", re=NOTE + r"_(v\d)_1\.wav$", layers=["v1", "v2"], oct=12, max=7,
                      name="Viola section sustain (VSCO-2)", match="strings", sustain=True, release=0.8,
                      best="The middle of the string section: thickens chords between the violins and the cellos. In the Full string set."),
    "viola_trem": dict(src="vsco", dir="Strings/Viola Section/trem", re=NOTE + r"_(v\d)_rr1\.wav$", layers=["v1", "v2"], oct=12, max=7,
                       name="Viola section tremolo (VSCO-2)", match="trem", sustain=True, release=0.6,
                       best="A darker, rougher tremolo than the violins: nerves in the middle register. In the Full string set."),
    "viola_pizz": dict(src="vsco", dir="Strings/Viola Section/pizz", re=NOTE + r"_(v\d)_rr\d\.wav$", layers=["v1", "v2"], oct=12, max=3,
                       name="Viola section pizzicato (VSCO-2)", match="pizz", release=0.25,
                       best="A rounder pluck than the violins'. In the Full string set."),
    "cello_sus": dict(src="vsco", dir="Strings/Cello Section/susvib", re=r"susvib_" + NOTE + r"_(v\d)_1\.wav$", layers=["v1", "v3"], oct=12, max=7,
                      name="Cello section sustain (VSCO-2)", match="strings", sustain=True, release=0.8,
                      best="Warm and low with no violins over it: grief, the low bed of a romance, a slow dread. In the Low strings set."),
    "cello_trem": dict(src="vsco", dir="Strings/Cello Section/trem", re=r"trem_" + NOTE + r"_(v\d)_1\.wav$", layers=["v1", "v2"], oct=12, max=7,
                       name="Cello section tremolo (VSCO-2)", match="trem", sustain=True, release=0.6,
                       best="A low tremolo rumble under a chase or a reveal. In the Low strings set."),
    "cello_pizz": dict(src="vsco", dir="Strings/Cello Section/pizzT", re=r"pizzT_" + NOTE + r"_(v\d)_RR\d\.wav$", layers=["v1", "v2"], oct=12, max=3,
                       name="Cello section pizzicato (VSCO-2)", match="pizz", release=0.3,
                       best="Low plucked steps: a creeping walk, a heartbeat in pizzicato. In the Low strings set."),
    "cbass_sus": dict(src="vsco", dir="Strings/Solo Contrabass/SusNV", re=NOTE + r"_(v\d)_rr1\.wav$", layers=["v1", "v3"], oct=12, max=7,
                      name="Double bass sustain, no vibrato (VSCO-2)", match="strings", sustain=True, release=0.8,
                      best="The floor under everything, an octave below the cellos: dread, the basement, something big nearby. Sounds below C2 in the Full, Solo and Low sets; the Expanded cues use it alone."),
    "cbass_trem": dict(src="vsco", dir="Strings/Solo Contrabass/Trem", re=NOTE + r"_(v\d)_rr1\.wav$", layers=["v1", "v2"], oct=12, max=7,
                       name="Double bass tremolo (VSCO-2)", match="trem", sustain=True, release=0.6,
                       best="A growl you feel: under a riser, before the scare."),
    "cbass_pizz": dict(src="vsco", dir="Strings/Solo Contrabass/Pizz", re=NOTE + r"_(v\d)_rr\d\.wav$", layers=["v1", "v3"], oct=12, max=3,
                       name="Double bass pizzicato (VSCO-2)", match="pizz", release=0.35,
                       best="Deep plucks: the stalker's footsteps, a walking bass for the noir trumpet."),
    "vln_solo": dict(src="vsco", dir="Strings/Solo Violin/Arco Vib", re=NOTE + r"_([pf])\.wav$", layers=["p", "f"], oct=0, max=7,
                     name="Solo violin (VSCO-2)", match="strings", sustain=True, release=0.6,
                     best="One player, exposed and close: a lament, her theme when she's alone, the lullaby sung on a string. In the Solo set."),
    "vln_solo_trem": dict(src="vsco", dir="Strings/Solo Violin/Trem", re=NOTE + r"_(v\d)_rr1\.wav$", layers=["v1", "v2"], oct=12, max=7,
                          name="Solo violin tremolo (VSCO-2)", match="trem", sustain=True, release=0.5,
                          best="A thin, nervous shimmer: one string shaking in the dark. In the Solo set."),
    "vln_solo_pizz": dict(src="vsco", dir="Strings/Solo Violin/Pizz", re=NOTE + r"_([pf])(?:_RR\d)?\.wav$", layers=["p", "f"], oct=0, max=2.5,
                          name="Solo violin pizzicato (VSCO-2)", match="pizz", adjust=-4, release=0.2,
                          best="A small, dry pluck: a music box's cousin, tiptoes. In the Solo set."),
    # --- brass and winds ---
    "trombone": dict(src="vsco", dir="Brass/OldTrombone/Sustain", re=NOTE + r"_(v[135])_1\.wav$", layers=["v1", "v3", "v5"], oct=12, max=6,
                     name="Trombone (VSCO-2, an old one)", match="horn", sustain=True, release=0.4,
                     best="Low brass chords: the funeral, the ritual, a dark chorale. Soft, it's a sigh; loud, a threat."),
    "trombone_fall": dict(src="vsco", dir="Brass/OldTrombone/Fall", re=NOTE + r"_(\d)\.wav$", oct=12, max=3,
                          name="Trombone falls (VSCO-2)", match="horn", release=0.3,
                          best="A note that drops away: the floor going out from under you, a sad joke's punchline. Stabs in Brass falls."),
    "trombone_buzz": dict(src="vsco", dir="Brass/OldTrombone/Buzz", re=NOTE + r"_(v\d)_1\.wav$", layers=["v1", "v2"], oct=12, max=4,
                          name="Trombone buzz (VSCO-2)", match="horn", sustain=True, release=0.3,
                          best="A rasping, buzzing note: something growls. Use it low and short."),
    "tuba": dict(src="vsco", dir="Brass/Tuba/sus", re=NOTE + r"_(v\d)_rr1_Mid\.wav$", layers=["v1", "v2", "v3"], oct=12, max=6,
                 name="Tuba (VSCO-2)", match="horn", sustain=True, release=0.4,
                 best="The lowest brass: a pedal under the trombones, heavy steps, a giant's tread."),
    "trumpet_mute": dict(src="vsco", dir="Brass/Trumpet/harmonM-sus", re=NOTE + r"_(v\d)_rr1\.wav$", layers=["v1", "v3"], oct=12, max=6,
                         name="Trumpet, harmon mute (VSCO-2)", match="horn", sustain=True, release=0.35,
                         best="A thin, nasal, far-away horn: noir, a lonely street at night, a memory of a jazz bar."),
    "bassoon": dict(src="vsco", dir="Woodwinds/Bassoon/sus", re=r"PSBassoon_" + NOTE + r"_(v\d)_1\.wav$", layers=["v1", "v2"], oct=12, max=6,
                    name="Bassoon (VSCO-2)", match="flute", sustain=True, release=0.3,
                    best="Low reed, a little comic and a little sinister: the creeping line under a sneak, a sour chord."),
    "clarinet": dict(src="vsco", dir="Woodwinds/Clarinet/susLong", re=NOTE + r"_(v[13])_rr1_sum\.wav$", layers=["v1", "v3"], oct=12, max=7,
                     name="Clarinet (VSCO-2)", match="flute", sustain=True, release=0.3,
                     best="Its low register is hollow and cold: a lullaby on a dark landing, the ghost's breath."),
    # --- the eerie ones (VCSL) ---
    "glass": dict(src="vcsl", dir="Idiophones/Friction Idiophones/Wine Glasses/Sustains/Slow", re=r"glass\d_" + NOTE + r"_Slow", oct=0, max=10,
                  name="Wine glasses, rubbed (VCSL)", match="strings", sustain=True, release=1.2,
                  best="A glass-harmonica ghost tone, pure and unearthly: a presence in the room, a memory. Only four glasses (D#4 to D5): keep it high and slow."),
    "psaltery": dict(src="vcsl", dir="Chordophones/Zithers/Psaltery, Bowed and Plucked/LongBow", re=r"BowedPsaltery_" + NOTE + r"_Main", oct=0, max=7,
                     name="Bowed psaltery (VCSL)", match="strings", sustain=True, release=0.7,
                     best="A thin, wavering bowed tone like a singing saw: the haunted lullaby, a ghost humming. In the Eerie set over A#3 to F#5."),
    "vibes_bowed": dict(src="vcsl", dir="Idiophones/Struck Idiophones/Vibraphone/Bowed", re=r"Vibes_bowed_" + NOTE + r"_rr1", oct=12, max=8,
                        name="Vibraphone, bowed (VCSL)", match="strings", sustain=True, release=1.0,
                        best="A metal bar bowed: a pure, eerie swell with no attack. Behind you, the glass ghost, the moment she appears."),
    "vibes": dict(src="vcsl", dir="Idiophones/Struck Idiophones/Vibraphone/Soft Mallets", re=r"Vibes_soft_" + NOTE + r"_(v\d)_rr\d", layers=["v1", "v2"], oct=12, max=6,
                  name="Vibraphone, soft mallets (VCSL)", match="marimba", release=0.8,
                  best="Soft, round bell chords: a dreamy romance, a lounge gone quiet, a lullaby's chords."),
    "kalimba": dict(src="vcsl", dir="Idiophones/Plucked Idiophones/Kalimba, Kenya", re=r"MainSpirit_" + NOTE + r"_k\d+_", oct=0, max=4,
                    name="Kalimba (VCSL)", match="marimba", release=0.5,
                    best="Plucked metal tongues, a little out of tune: a music box's older cousin, a child's toy, the lullaby."),
    "harpsichord": dict(src="vcsl", dir="Chordophones/Zithers/Harpsichord, Flemish/Sustains/High", re=r"HarpsiRH_High_Far_" + NOTE + r"_rr\d", oct=0, max=5,
                        name="Harpsichord, Flemish (VCSL)", match="piano", release=0.3,
                        best="The old house's instrument: a minuet in the empty ballroom, the mock-baroque strut gone sinister."),
    "organ": dict(src="vcsl", dir="Aerophones/Edge-blown Aerophones/Pipe Organ/Quiet", re=r"Man3Quiet_" + NOTE + r"_rr1", oct=0, max=7,
                  name="Pipe organ, quiet (VCSL)", match="strings", sustain=True, release=0.6,
                  best="A quiet church organ: the funeral, the shrine, the wedding that shouldn't happen."),
    "ocarina": dict(src="vcsl", dir="Aerophones/Edge-blown Aerophones/Ocarina, Typical/Sustains/Sus", re=r"Sus_" + NOTE + r"\.wav$", oct=0, max=5,
                    name="Ocarina (VCSL)", match="flute", sustain=True, release=0.3,
                    best="A clay flute, breathy and childlike: the ghost child's tune, a game in the playground."),
}

# The eerie percussion: one kit (docs/MUSIC.md §7.2). piece: (src, file in the repo) or a list of them, quietest first
# (velocity layers).
METALS = {
    "brake_hit": [("vcsl", "Idiophones/Struck Idiophones/Brake Drum/BrakeDrum1_Hammer_v1_rr1_Mid.wav"),
                  ("vcsl", "Idiophones/Struck Idiophones/Brake Drum/BrakeDrum1_Hammer_v2_rr1_Mid.wav"),
                  ("vcsl", "Idiophones/Struck Idiophones/Brake Drum/BrakeDrum1_Hammer_v3_rr1_Mid.wav")],
    "brake_bow": [("vcsl", "Idiophones/Struck Idiophones/Brake Drum/BrakeDrum1_Bowed_rr2_Mid.wav")],
    "brake_bow2": [("vcsl", "Idiophones/Struck Idiophones/Brake Drum/BrakeDrum2_Bowed_rr1_Mid.wav")],
    "gong_scrape": [("vcsl", "Idiophones/Struck Idiophones/Gong 1/gong_scrape_mf.wav")],
    "cym_bowed": [("vcsl", "Idiophones/Struck Idiophones/Suspended Cymbal 1/susCymb1_bow_13.wav")],
    "cym_scrape": [("vcsl", "Idiophones/Struck Idiophones/Suspended Cymbal 1/susCymb1_scrape_1.wav")],
    "cym_cresc": [("vcsl", "Idiophones/Struck Idiophones/Suspended Cymbal 1/susCymb1_cresc_4s.wav")],
    "flexatone": [("vcsl", "Idiophones/Struck Idiophones/Flexatone/flexatone_long.wav")],
    "flex_fast": [("vcsl", "Idiophones/Struck Idiophones/Flexatone/flexatone_fast.wav")],
    "flex_slap": [("vcsl", "Idiophones/Struck Idiophones/Flexatone/flexatone_slap1.wav")],
    "ratchet": [("vcsl", "Idiophones/Struck Idiophones/Ratchet/Ratchet1_Slow_rr1_Mid.wav")],
    "ratchet_fast": [("vcsl", "Idiophones/Struck Idiophones/Ratchet/Ratchet1_Fast_rr1_Mid.wav")],
    "vibraslap": [("vcsl", "Idiophones/Struck Idiophones/Vibraslap/Legacy/vibraslap_rr1.wav")],
    "siren": [("vcsl", "Aerophones/Free Aerophones/Siren/Main_SirenWhistle-002.wav")],
    "windchimes": [("vcsl", "Idiophones/Struck Idiophones/Mark Trees/Legacy/windchimes_slowDesc1.wav")],
    "ocean": [("vcsl", "Membranophones/Other Membranophones/Ocean Drum/OceanDrum_Sus_1_Mid.wav")],
    "belltree": [("vcsl", "Idiophones/Struck Idiophones/Bell Tree/Stroke/BellTree_Stroke_1_Mid.wav")],
    "chain_grind": [("vsco", "Miscellania Raw/Misc 1/chain_grind.wav")],
    "brick_scrape": [("vsco", "Miscellania Raw/Misc 1/brick_scrape.wav")],
    "metal_hit": [("vsco", "Miscellania Raw/Misc 1/metal_hit3.wav")],
    "gong_weird": [("vsco", "Miscellania Raw/Misc 1/cymbgong_weird.wav")],
    "gliss_up": [("vsco", "Miscellania Raw/Misc 2/glock_glisses/glock_fx_up_chromatic_slow_01.wav")],
    "gliss_down": [("vsco", "Miscellania Raw/Misc 2/glock_glisses/glock_fx_down_chromatic_slow_01.wav")],
}
METALS_DEF = dict(name="Eerie metals and noises (VCSL, VSCO-2)", match="drums", adjust=-2, max=8,
                  best="The J-horror screech and its family: a bowed brake drum, a bowed or scraped cymbal, a gong scrape, the flexatone's wobble, a ratchet's croak, a siren, chains. Stings and textures, never a tune.")
DRY_METALS = []

NAMES = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def midi_of(name):
    m = re.match(r"([A-G])(#?)(-?\d)$", name)
    return 12 * (int(m.group(3)) + 1) + NAMES[m.group(1)] + (1 if m.group(2) else 0)


def file_name(midi):
    n = ["C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs", "A", "As", "B"][midi % 12]
    return "%s%d" % (n, midi // 12 - 1)


def run(cmd, **kw):
    return subprocess.run(cmd, check=True, capture_output=True, **kw)


def checkout(src, paths):
    """A sparse, blobless clone of one library with just these folders and files."""
    url = REPOS[src][0]
    repo = SOURCES / src
    if not (repo / ".git").is_dir():
        SOURCES.mkdir(parents=True, exist_ok=True)
        print("cloning", url, "(only what's needed)")
        run(["git", "clone", "-q", "--filter=blob:none", "--no-checkout", "--depth", "1", url, str(repo)])
    run(["git", "-C", str(repo), "sparse-checkout", "set", "--no-cone"] + ["/" + p for p in sorted(set(paths))])
    run(["git", "-C", str(repo), "checkout", "-q"])
    return repo


def commit_of(src):
    return run(["git", "-C", str(SOURCES / src), "rev-parse", "--short", "HEAD"]).stdout.decode().strip()


def load(path):
    """A file as mono float32 at 44.1 kHz."""
    raw = run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"]).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def trim(x, max_s):
    """The leading silence off (5 ms kept before the first sound), cut at max_s with a fade to nothing."""
    peak = float(np.max(np.abs(x))) if len(x) else 0.0
    if peak <= 0:
        return x
    over = np.nonzero(np.abs(x) > peak * 10 ** (-50 / 20))[0]
    x = x[max(0, over[0] - int(0.005 * SR)):]
    # the tail: past the last moment above -60 dB, nothing worth keeping
    over = np.nonzero(np.abs(x) > peak * 10 ** (-60 / 20))[0]
    x = x[:over[-1] + int(0.05 * SR)]
    n = int(max_s * SR)
    if len(x) > n:
        x = x[:n].copy()
        f = int(min(0.4, max_s * 0.15) * SR)
        x[-f:] *= np.linspace(1, 0, f) ** 2
    f = int(0.004 * SR)
    x[-f:] *= np.linspace(1, 0, f)
    return x


def f0_of(x):
    """The pitch (Hz) of a sustained part of a note, by YIN; None when it has none."""
    start = int(min(0.25, len(x) / SR * 0.2) * SR)
    w = x[start:start + int(0.5 * SR)]
    if len(w) < 4096:
        w = x[:int(0.5 * SR)]
    if len(w) < 2048:
        return None
    w = w - w.mean()
    tmin, tmax = int(SR / 2200), int(SR / 25)
    n = len(w) - tmax
    if n < 512:
        return None
    # the difference function by FFT-free running sums (small windows: fine in numpy)
    d = np.array([np.sum((w[:n] - w[t:t + n]) ** 2) for t in range(tmax + 1)])
    cmnd = np.ones_like(d)
    cs = np.cumsum(d[1:])
    cmnd[1:] = d[1:] * np.arange(1, len(d)) / np.maximum(cs, 1e-12)
    below = np.nonzero(cmnd[tmin:] < 0.15)[0]
    if len(below):
        t = tmin + below[0]
        while t + 1 < len(cmnd) and cmnd[t + 1] < cmnd[t]:
            t += 1
    else:
        t = tmin + int(np.argmin(cmnd[tmin:]))
        if cmnd[t] > 0.4:
            return None
    # parabolic refinement
    if 1 <= t < len(cmnd) - 1:
        a, b, c = cmnd[t - 1], cmnd[t], cmnd[t + 1]
        den = a - 2 * b + c
        t = t + (0.5 * (a - c) / den if den else 0)
    return SR / t


def octave_move(name_midi, oct_hint, f0):
    """How many octaves the measured pitch puts a sample away from its name and the hint (None: no clear answer)."""
    if not f0:
        return None
    m = 69 + 12 * math.log2(f0 / 440)
    guess = name_midi + oct_hint
    best = min((guess + k for k in (-24, -12, 0, 12, 24)), key=lambda c: abs(m - c))
    return best - guess if abs(m - best) <= 0.6 else None


def place(name_midi, octave, f0):
    """The sample's MIDI note (its name moved by the instrument's octave) and its tune: the cents the sampler adds to
    bring it to that note, from the measured pitch when it's within 60 cents of it (else 0)."""
    note = name_midi + octave
    if not f0:
        return note, 0.0
    off = (69 + 12 * math.log2(f0 / 440) - note) * 100
    return note, (round(-off, 1) if abs(off) <= 60 else 0.0)


def rms_db(x):
    return 20 * math.log10(max(1e-9, float(np.sqrt(np.mean(x[:int(1.5 * SR)] ** 2)))))


def write_ogg(x, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    p = subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-c:a", "libvorbis", "-q:a", "4", str(path)],
                       input=x.astype(np.float32).tobytes(), capture_output=True)
    if p.returncode:
        raise RuntimeError(p.stderr.decode())


def ref_loudness(index, key):
    """The mean loudness of an instrument already here (its middle layer), to match a new one to."""
    d = index.get(key)
    if not d:
        return None
    if d.get("kind") == "kit":
        files = [p["layers"][len(p["layers"]) // 2]["file"] for p in d["pieces"].values()][:12]
    else:
        L = len(d.get("layers") or [[1, 127]])
        files = [z["file"] for z in d["zones"] if z["layer"] == L // 2][::2][:12]
    vals = [rms_db(load(SAMPLES / f)) for f in files if (SAMPLES / f).is_file()]
    # as it's heard: its files' loudness plus the gain and calibration the sampler gives it
    return sum(vals) / len(vals) + (d.get("gain_db") or 0) + (d.get("calib_db") or 0) if vals else None


def layer_ranges(n):
    """n velocity layers split evenly over 1..127."""
    edges = [round(1 + i * 127 / n) for i in range(n + 1)]
    return [[edges[i], (edges[i + 1] - 1) if i + 1 < n else 127] for i in range(n)]


def prepare_pitched(key, spec, repo, index, report):
    folder = repo / spec["dir"]
    rx = re.compile(spec["re"])
    found = []
    for f in sorted(folder.glob("*.wav")) + sorted(folder.glob("*.mp3")):
        m = rx.search(f.name)
        if not m:
            continue
        layer = spec["layers"].index(m.group(2)) if spec.get("layers") and m.lastindex >= 2 else 0
        found.append((f, midi_of(m.group(1)), layer))
    if not found:
        raise SystemExit("%s: nothing in %s matches %s" % (key, spec["dir"], spec["re"]))
    # the instrument's octave by vote: short plucks and buzzes fool the pitch now and then, a whole set rarely does
    measured = []
    for f, nm, layer in found:
        x = trim(load(f), spec["max"])
        measured.append((f, nm, layer, x, f0_of(x)))
    votes = [v for v in (octave_move(nm, spec["oct"], f0) for _, nm, _, _, f0 in measured) if v is not None]
    move = max(set(votes), key=votes.count) if votes else 0
    if votes.count(move) * 2 <= len(measured):                      # not most of the samples: keep the hint
        move = 0
    if move:
        report.append("%s: the names are %+d semitones off the hint (%d of %d samples agree)" % (key, move, votes.count(move), len(measured)))
    sounds = []
    for f, nm, layer, x, f0 in measured:
        note, tune = place(nm, spec["oct"] + move, f0)
        sounds.append(dict(x=x, note=note, tune=tune, layer=layer))
    peak = max(float(np.max(np.abs(s["x"]))) for s in sounds)
    gain = 10 ** (-1 / 20) / peak                                    # the loudest sample at -1 dBFS
    out_dir = SAMPLES / key
    if out_dir.exists():
        shutil.rmtree(out_dir)
    zones, counts = [], {}
    for s in sorted(sounds, key=lambda s: (s["note"], s["layer"])):
        k = (s["note"], s["layer"])
        counts[k] = counts.get(k, 0) + 1
        rel = "%s/%s_v%d%s.ogg" % (key, file_name(s["note"]), s["layer"] + 1, "" if counts[k] == 1 else "_rr%d" % counts[k])
        x = s["x"] * gain
        write_ogg(x, SAMPLES / rel)
        zones.append(dict(note=s["note"], layer=s["layer"], file=rel, tune=s["tune"], len=round(len(x) / SR, 2)))
    nl = len(spec.get("layers") or [0])
    mid = [z for z in zones if z["layer"] == nl // 2] or zones
    loud = sum(rms_db(load(SAMPLES / z["file"])) for z in mid[::2][:12]) / len(mid[::2][:12])
    ref = ref_loudness(index, spec["match"])
    notes = [z["note"] for z in zones]
    return dict(name=spec["name"], kind="pitched", credit=REPOS[spec["src"]][1], license="CC0-1.0",
                source="%s@%s %s" % (REPOS[spec["src"]][0].split("github.com/")[1], commit_of(spec["src"]), spec["dir"]),
                layers=layer_ranges(nl), release=spec.get("release", 0.3), gain_db=0, calib_db=round(ref - loud + spec.get("adjust", 0), 1) if ref is not None else 0,
                sustain=bool(spec.get("sustain")), range=[min(notes), max(notes)], added=True, best=spec["best"], zones=zones)


def prepare_metals(index, report):
    pieces, sounds = {}, []
    for piece, files in METALS.items():
        for i, (src, rel) in enumerate(files):
            x = trim(load(SOURCES / src / rel), METALS_DEF["max"])
            sounds.append((piece, i, len(files), x))
    peak = max(float(np.max(np.abs(x))) for *_, x in sounds)
    gain = 10 ** (-1 / 20) / peak
    out_dir = SAMPLES / "metals"
    if out_dir.exists():
        shutil.rmtree(out_dir)
    louds = []
    for piece, i, n, x in sounds:
        rel = "metals/%s_v%d.ogg" % (piece, i + 1)
        write_ogg(x * gain, SAMPLES / rel)
        lr = layer_ranges(n)[i]
        pieces.setdefault(piece, {"layers": []})["layers"].append(dict(file=rel, vel=lr, len=round(len(x) / SR, 2)))
        louds.append(rms_db(x * gain))
    ref = ref_loudness(index, METALS_DEF["match"])
    loud = sum(louds) / len(louds)
    return dict(name=METALS_DEF["name"], kind="kit", credit=REPOS["vcsl"][1] + "; " + REPOS["vsco"][1], license="CC0-1.0",
                source="VCSL@%s, VSCO-2-CE@%s" % (commit_of("vcsl"), commit_of("vsco")),
                release=0.4, gain_db=0, calib_db=round(ref - loud + METALS_DEF["adjust"], 1) if ref is not None else 0, added=True, best=METALS_DEF["best"], pieces=pieces)


def write_licenses(index):
    """LICENSES.md's table of what came from where, the added instruments listed by key."""
    f = SAMPLES / "LICENSES.md"
    text = f.read_text("utf-8")
    added = sorted(k for k, d in index.items() if d.get("added"))
    by = {}
    for k in added:
        by.setdefault(index[k]["credit"], []).append(k)
    block = ["", "## Added for the score room (tools/score/fetch_samples.py)", "",
             "| Instruments | Source |", "| --- | --- |"]
    for credit, keys in by.items():
        block.append("| %s | %s |" % (", ".join(keys), credit))
    block.append("")
    text = text.split("\n## Added for the score room")[0].rstrip("\n") + "\n" + "\n".join(block)
    f.write_text(text, "utf-8")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--only", help="comma-separated instrument keys (metals for the eerie kit)")
    ap.add_argument("--force", action="store_true", help="prepare them again even if they're there")
    ap.add_argument("--list", action="store_true")
    a = ap.parse_args()
    for tool in ("ffmpeg", "git"):
        if not shutil.which(tool):
            sys.exit("needs %s on the PATH" % tool)
    index_f = SAMPLES / "instruments.json"
    index = json.loads(index_f.read_text("utf-8"))
    keys = list(PITCHED) + ["metals"]
    if a.only:
        keys = [k for k in a.only.split(",") if k]
        bad = [k for k in keys if k not in PITCHED and k != "metals"]
        if bad:
            sys.exit("unknown: " + ", ".join(bad) + " (known: " + ", ".join(list(PITCHED) + ["metals"]) + ")")
    if a.list:
        for k in list(PITCHED) + ["metals"]:
            d = index.get(k)
            print("%-14s %-6s %s" % (k, "here" if d else "-", (PITCHED.get(k) or METALS_DEF)["name"]))
        return
    clash = [k for k in keys if k in index and not index[k].get("added")]
    if clash:
        sys.exit("these are Woohill's instruments and stay as they are: " + ", ".join(clash))
    todo = [k for k in keys if a.force or k not in index]
    if not todo:
        print("all there (--force to prepare them again)")
        return
    # every folder any instrument needs (a sparse checkout keeps only what it's given)
    need = {}
    for files in METALS.values():
        for src, rel in files:
            need.setdefault(src, []).append(rel)
    for spec in PITCHED.values():
        need.setdefault(spec["src"], []).append(spec["dir"] + "/")
    for src, paths in need.items():
        checkout(src, paths)
    report = []
    for k in todo:
        print("preparing", k)
        index[k] = prepare_metals(index, report) if k == "metals" else prepare_pitched(k, PITCHED[k], SOURCES / PITCHED[k]["src"], index, report)
        index_f.write_text(json.dumps(index, indent=1, ensure_ascii=False), "utf-8")
    write_licenses(index)
    for line in report:
        print("  note:", line)
    size = sum(p.stat().st_size for k in todo for p in (SAMPLES / k).rglob("*.ogg"))
    print("added %d instruments, %.1f MB" % (len(todo), size / 1e6))


if __name__ == "__main__":
    main()
