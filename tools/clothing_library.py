"""The clothing library: MakeHuman's community clothing packs, catalogued, fetched and credited (DECISIONS 2026-11-11,
last: "Yes Im happy to ship with CC-BY"; then "Can we import the rest of the CC-BY garments into our projects (the
full community packs)").

The packs are zips on MakeHuman's two file servers, about 2.4 GB of wearables. As with the PBR shelf they are too big
for git: **the files go to `assets/clothing/` (not tracked), and what is tracked is the catalogue**,
`Content/Studio/Clothes/library/index.json` (every wearable in every pack: its author, its licence, its own page, its
pack and where the pack is downloaded from), and the credits, `docs/CREDITS.md`.

    python tools/clothing_library.py catalogue [--site DIR]   the pack pages of MakeHuman's website (cloned from GitHub when no DIR) into the index
    python tools/clothing_library.py list [--licence cc0|cc-by] [--group dress] [--author NAME]
    python tools/clothing_library.py sheets [--site DIR] [--out DIR]   numbered pictures of every garment to pick from (Saved/Clothing/sheets; needs Pillow)
    python tools/clothing_library.py pick [number or name ...] [--remove]   the garments wanted, kept in library/picks.json (no words: what's picked)
    python tools/clothing_library.py fetch                   the picked garments only, each cut out of its pack's zip on the server (every pack when nothing is picked, or --all)
    python tools/clothing_library.py fetch --only 12 40 elvs_goddess_dress1   those garments, without picking them
    (fetch --mirror files2 tries that mirror first; --connections N; --again fetches what's there once more)
    python tools/clothing_library.py fetch <pack ...> [--licence cc0|cc-by] [--materials] [--keep-zips]   whole packs, downloaded and unpacked into assets/clothing/<pack>/
    python tools/clothing_library.py scan                    read every garment on disk: what its own file says of its author and licence, beside its page
    python tools/clothing_library.py credits [--block]       docs/CREDITS.md's table made again (the ticks kept); --block: the lines to paste for the ticked ones
    python tools/clothing_library.py check                   CLOTHLIB

**Picking** (DECISIONS 2026-11-11, the last: the servers gave 3 MB in five minutes; "ill just pick wahatever outfits I
want and then youll add to only fetch those ones"): a garment's number is its place in the catalogue, as the sheets
show it. A picked garment is fetched alone: the pack's zip is read on the server by byte ranges (its list of files,
then only that garment's folder), a few connections at a time, so a dress costs its own megabytes and not its pack's
hundreds. A server that won't give ranges gets the whole pack downloaded and only the picked folders unpacked.

`$STUDIO_CLOTHING` puts the files somewhere else. Downloaded archives are only unpacked and read as text, never run.
The fit and the layers that put these garments on our bodies are the prototype in docs/research/clothing_v2/proto
(its `sources.json` can point at `assets/clothing/<pack>/...`).
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "Content" / "Python"))
from storykit.clothcredits import licence_of, norm, tidy  # noqa: E402
INDEX = ROOT / "Content" / "Studio" / "Clothes" / "library" / "index.json"
PICKS = INDEX.with_name("picks.json")          # the garments the user picked: tracked, so any machine fetches the same ones
CREDITS = ROOT / "docs" / "CREDITS.md"
SITE = "https://github.com/makehumancommunity/makehuman-static-website"
MIRRORS = {"primaryFilesUrl": "https://files2.makehumancommunity.org", "secondaryFilesUrl": "https://files.makehumancommunity.org"}
FIRST = "files.makehumancommunity.org"         # the mirror tried first: the pages' second one, far the faster (the user, 2026-11-11: files2 gave 100 KB/s, this one megabytes); --mirror for another
# the packs that hold things to wear, by the start of their name; `makehuman_system_assets` holds the 20 system
# clothes among other things. Body parts, brows, lashes, hair, skins, poses and targets are other packs: not fetched.
GROUPS = ("dress", "pants", "shirts", "skirts", "suits", "underwear", "shoes", "gloves", "hats", "glasses", "jewelry", "masks", "equipment")
MATERIALS = ("clothes_materials01", "system_clothes_materials01")     # other colours for the clothes: fetched with --materials
# what isn't used whatever its licence line says: someone else's character, mark or slogan (a CC tag from the
# uploader doesn't clear those). By name; the catalogue marks them and the credits leave them out.
REFUSE = [(r"sailor[_ ]?moon|sheeta|laputa|harley|wonder[_ ]?woman|superman|batman|spider|catwoman|star[_ ]?trek|star[_ ]?wars|leia|jedi|sith|trooper|marvel|avenger|captain[_ ]america|"
           r"tron|lara|zelda|link_|mario|pikachu|pokemon|naruto|goku|sailor_senshi|power[_ ]?ranger|ghostbuster|bond[_ ]?girl|cosplay|chapulin", "someone else's character or film"),
          (r"maga|trump|biden|slogan|swastika|nazi", "a political slogan or symbol"),
          (r"nike|adidas|converse|puma|reebok|vans_|gucci|chanel|louis|supreme", "a real brand's design")]
BEGIN, END = "<!-- clothing: generated by tools/clothing_library.py credits (ticks in the first column are kept) -->", "<!-- /clothing -->"


def home():
    return Path(os.environ.get("STUDIO_CLOTHING") or ROOT / "assets" / "clothing")


def load():
    if not INDEX.exists():
        raise SystemExit(f"no catalogue yet ({INDEX.relative_to(ROOT)}): python tools/clothing_library.py catalogue")
    return json.loads(INDEX.read_text())


def save(ix):
    INDEX.parent.mkdir(parents=True, exist_ok=True)
    INDEX.write_text(json.dumps(ix, indent=1, ensure_ascii=False) + "\n")


def group_of(pack):
    return next((g for g in GROUPS if pack.startswith(g)), "system" if pack == "makehuman_system_assets" else None)


def refused(name):
    for pat, why in REFUSE:
        if re.search(pat, name, re.I):
            return why
    return None


# ---- the catalogue: MakeHuman's own pack pages

def catalogue(a):
    site = Path(a.site) if a.site else None
    tmp = None
    if site is None:
        tmp = tempfile.mkdtemp(prefix="mh_site_")
        r = subprocess.run(["git", "clone", "-q", "--depth", "1", SITE, tmp], capture_output=True, text=True)
        if r.returncode:
            raise SystemExit(f"couldn't clone {SITE}: {r.stderr[-300:]}")
        site = Path(tmp)
    commit = subprocess.run(["git", "-C", str(site), "rev-parse", "--short", "HEAD"], capture_output=True, text=True).stdout.strip()
    pages = site / "content" / "Assets" / "AssetPacks"
    old = json.loads(INDEX.read_text()) if INDEX.exists() else {}
    seen = {(x["pack"], x["id"]): x for x in old.get("assets", [])}
    packs, assets = {}, []
    for f in sorted(pages.glob("*.md")):
        pack = f.stem
        g = group_of(pack)
        if g is None and pack not in MATERIALS:
            continue
        s = f.read_text(errors="ignore")
        links = re.findall(r"\[mirror\d\]\(\{\{% param \"(\w+)\" %\}\}(/[^)\s]+\.zip)\)", s)
        if not links:
            continue
        size = re.search(r"\(([\d.,]+)\s*([mMgG])[bB]\)", s)
        about = next((l.split(": [mirror")[0].strip() for l in s.splitlines() if "[mirror1]" in l), "")
        rows = [[c.strip() for c in l.strip().strip("|").split("|")] for l in s.splitlines() if l.startswith("|") and "---" not in l and "Asset type" not in l]
        rows = [r for r in rows if len(r) >= 6]
        lic = {"CC0" if "0" in r[5] else "CC-BY" for r in rows}
        packs[pack] = dict(group=g or "materials", about=about, licence=sorted(lic)[0] if len(lic) == 1 else "mixed", zip=links[0][1], mirrors=[MIRRORS[k] for k, _ in links if k in MIRRORS],
                           size_mb=round(float(size.group(1).replace(",", ".")) * (1000 if size.group(2).lower() == "g" else 1), 1) if size else None)
        for kind, thumb, name, author, source, licence in (r[:6] for r in rows):
            if (g == "system" and kind != "clothes") or g is None:
                continue
            page = re.search(r"\((https?://[^)]+)\)", source)
            x = dict(id=name, pack=pack, group=g, author=author, licence="CC0" if "0" in licence else "CC-BY", page=page.group(1) if page else "")
            why = refused(name) or seen.get((pack, name), {}).get("refused")     # (by name, or what a scan found in its file: kept)
            if why:
                x["refused"] = why
            for k in ("file_licence", "file_author", "folder"):                      # what a scan found: kept
                if k in seen.get((pack, name), {}):
                    x[k] = seen[(pack, name)][k]
            assets.append(x)
    ix = dict(about="MakeHuman's community clothing packs, as their own pages list them (tools/clothing_library.py catalogue). The files themselves are fetched into assets/clothing/ and not tracked.",
              source=dict(site=SITE, commit=commit, pages="content/Assets/AssetPacks"), packs=packs, assets=assets)
    save(ix)
    if tmp:
        shutil.rmtree(tmp, ignore_errors=True)
    w = [x for x in assets if not x.get("refused")]
    print(f"catalogue: {len(packs)} packs, {len(assets)} things to wear ({sum(x['licence'] == 'CC0' for x in w)} CC0, {sum(x['licence'] == 'CC-BY' for x in w)} CC-BY, {len(assets) - len(w)} refused by name), "
          f"{sum(p['size_mb'] or 0 for k, p in packs.items() if k not in MATERIALS) / 1000:.1f} GB to fetch -> {INDEX.relative_to(ROOT)}")
    credits(argparse.Namespace(block=False))


def listing(a):
    ix = load()
    n = 0
    mine = set(picked())
    for k, x in enumerate(ix["assets"]):
        if a.picked and x["id"] not in mine:
            continue
        if a.licence and x["licence"].lower().replace("-", "") != a.licence.lower().replace("-", ""):
            continue
        if (a.group and x["group"] != a.group) or (a.author and a.author.lower() not in x["author"].lower()):
            continue
        n += 1
        print(f"#{k + 1:<4d}{'*' if x['id'] in mine else ' '} {x['pack']:12s} {x['id']:48s} {x['author']:22s} {licence_of(x):10s}{' on disk' if x.get('folder') else ''}{'  REFUSED: ' + x['refused'] if x.get('refused') else ''}")
    print(f"{n} of {len(ix['assets'])}" + (f" (* picked: {len(mine)})" if mine else ""))


# ---- picking

def picked():
    return json.loads(PICKS.read_text()).get("wear", []) if PICKS.exists() else []


def named(ix, words):
    """catalogue entries from numbers (12, #12, 12-15: places in the catalogue, as the sheets show them) and names"""
    A = ix["assets"]
    by = {}
    for x in A:
        by.setdefault(norm(x["id"]), x)
    out, bad = [], []
    for w in (v for word in words for v in str(word).replace(",", " ").split()):
        m = re.fullmatch(r"#?(\d+)(?:-#?(\d+))?", w)
        if m:
            lo, hi = int(m.group(1)), int(m.group(2) or m.group(1))
            if not 1 <= lo <= hi <= len(A):
                bad.append(w); continue
            out += A[lo - 1:hi]
        elif norm(w) in by:
            out.append(by[norm(w)])
        else:
            bad.append(w)
    if bad:
        raise SystemExit(f"not in the catalogue (1 to {len(A)}, or a garment's name): {' '.join(bad)}")
    seen = set()
    return [x for x in out if not (x["id"] in seen or seen.add(x["id"]))]


def pick(a):
    ix = load()
    mine = picked()
    if a.words:
        got = named(ix, a.words)
        no = [] if a.remove else [x for x in got if x.get("refused")]
        for x in no:
            print(f"  not picked: {x['id']} ({x['refused']})")
        ids = [x["id"] for x in got if x not in no]
        mine = [i for i in mine if i not in ids] if a.remove else mine + [i for i in ids if i not in mine]
        order = {x["id"]: k for k, x in enumerate(ix["assets"])}
        mine.sort(key=lambda i: order.get(i, 1 << 30))
        PICKS.write_text(json.dumps(dict(about="The garments picked from MakeHuman's packs (tools/clothing_library.py pick): `fetch` gets these and no others.", wear=mine), indent=1) + "\n")
    at = {x["id"]: (k + 1, x) for k, x in enumerate(ix["assets"])}
    for i in mine:
        k, x = at.get(i, (0, None))
        print(f"#{k:<4d} {i:48s} {x['pack']:12s} {x['author']:22s} {x.get('file_licence') or x['licence']:10s}{' on disk' if x.get('folder') else ''}" if x else f"      {i}: no longer in the catalogue")
    print(f"{len(mine)} picked ({sum(1 for i in mine if i in at and at[i][1]['licence'] == 'CC-BY')} CC-BY: their lines are in docs/CREDITS.md) -> {PICKS.relative_to(ROOT)}")
    return 0


# ---- the pictures to pick from

SHEETS = [("Dresses", ["dress"]), ("Suits and outfits", ["suits"]), ("Shirts, tops and jackets", ["shirts"]), ("Trousers and skirts", ["pants", "skirts"]), ("Shoes", ["shoes"]),
          ("Underwear, swimwear, legwear", ["underwear"]), ("Hats", ["hats"]), ("Jewellery", ["jewelry"]), ("Glasses, masks, gloves", ["glasses", "masks", "gloves"]),
          ("Equipment and MakeHuman's own", ["equipment", "system"])]


def sheets(a):
    """every garment's own thumbnail (MakeHuman's website source has one a garment) on numbered sheets: its number its place in the catalogue"""
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        raise SystemExit("the sheets need Pillow: uv run --with pillow python tools/clothing_library.py sheets")
    ix = load()
    A = ix["assets"]
    site, tmp = (Path(a.site), None) if a.site else (None, tempfile.mkdtemp(prefix="mh_site_"))
    if site is None:
        r = subprocess.run(["git", "clone", "-q", "--depth", "1", SITE, tmp], capture_output=True, text=True)
        if r.returncode:
            raise SystemExit(f"couldn't clone {SITE}: {r.stderr[-300:]}")
        site = Path(tmp)
    thumbs = site / ix["source"]["pages"]
    out = Path(a.out) if a.out else ROOT / "Saved" / "Clothing" / "sheets"
    out.mkdir(parents=True, exist_ok=True)
    for f in out.glob("*.jpg"):
        f.unlink()
    mine, base = set(picked()), home()

    def font(size, bold=False):
        for f in (["DejaVuSans-Bold.ttf"] if bold else []) + ["DejaVuSans.ttf"]:
            try:
                return ImageFont.truetype(f, size)
            except OSError:
                pass
        return ImageFont.load_default(size)
    F, FB, FT = font(12), font(15, True), font(24, True)
    COLS, PER, C, LAB, PAD = 8, 40, 200, 58, 8
    made = 0
    for title, groups in SHEETS:
        items = [(k + 1, x) for g in groups for k, x in enumerate(A) if x["group"] == g]
        parts = [items[i:i + PER] for i in range(0, len(items), PER)]
        for k, part in enumerate(parts):
            rows = -(-len(part) // COLS)
            im = Image.new("RGB", (PAD + COLS * (C + PAD), 52 + rows * (C + LAB + PAD) + PAD), (24, 24, 28))
            dr = ImageDraw.Draw(im)
            dr.text((PAD, 12), title + (f"  ({k + 1} of {len(parts)})" if len(parts) > 1 else "") + "    pick by number", font=FT, fill=(235, 235, 235))
            for j, (n, x) in enumerate(part):
                px, py = PAD + (j % COLS) * (C + PAD), 52 + (j // COLS) * (C + LAB + PAD)
                cell = Image.new("RGBA", (C, C), (92, 96, 104, 255))
                f = thumbs / (x["id"] + ".png")
                if f.exists():
                    cell.alpha_composite(Image.open(f).convert("RGBA").resize((C, C), Image.LANCZOS))
                im.paste(cell.convert("RGB"), (px, py))
                if x["id"] in mine:
                    dr.rectangle([px - 3, py - 3, px + C + 2, py + C + 2], outline=(255, 255, 255), width=3)
                tag = f"#{n}" + (" picked" if x["id"] in mine else "") + (" · here" if x.get("folder") and (base / x["folder"]).is_dir() else "")
                dr.rectangle([px, py, px + dr.textlength(tag, font=FB) + 10, py + 22], fill=(0, 0, 0))
                dr.text((px + 5, py + 2), tag, font=FB, fill=(255, 255, 255))
                lic = "NOT TO SHIP" if x.get("refused") else x["licence"]
                lw = dr.textlength(lic, font=F)
                dr.rectangle([px + C - lw - 8, py, px + C, py + 18], fill=(200, 60, 60) if x.get("refused") else (230, 170, 60) if x["licence"] != "CC0" else (90, 190, 120))
                dr.text((px + C - lw - 4, py + 2), lic, font=F, fill=(0, 0, 0))
                name, lines = x["id"], []
                while name and len(lines) < 2:                                # the name on two lines at most, broken where it fits
                    cutat = len(name)
                    while dr.textlength(name[:cutat], font=F) > C and cutat > 1:
                        cutat -= 1
                    lines.append(name[:cutat]); name = name[cutat:]
                for q, l in enumerate(lines):
                    dr.text((px, py + C + 3 + q * 14), l, font=F, fill=(225, 225, 225))
                dr.text((px, py + C + 31), f"{x['author'][:20]} · {x['pack']}", font=F, fill=(150, 150, 160))
            made += 1
            fn = out / f"{made:02d}_{title.split(',')[0].split(' ')[0].lower()}{'_' + str(k + 1) if len(parts) > 1 else ''}.jpg"
            im.save(fn, quality=88)
            print(f"  {fn.name}: #{min(n for n, _ in part)} to #{max(n for n, _ in part)}")
    if tmp:
        shutil.rmtree(tmp, ignore_errors=True)
    print(f"sheets: {len(A)} garments on {made} sheets in {out}  (pick: python tools/clothing_library.py pick 12 40 ...)")
    return 0


# ---- fetching

def urls_of(info, a=None):
    """a pack's addresses, the preferred mirror's first"""
    first = getattr(a, "mirror", "") or FIRST
    return [m + info["zip"] for m in sorted(info["mirrors"], key=lambda m: first not in m)]


def download(urls, to):
    """the first of `urls` that answers, into `to`; the reason each failed otherwise"""
    part = to.with_suffix(to.suffix + ".part")
    why = []
    for u in urls:
        try:
            with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "clothing-library-fetch"}), timeout=60) as r, open(part, "wb") as f:
                total, tick = int(r.headers.get("Content-Length") or 0), Progress(Path(u).name)
                while True:
                    b = r.read(1 << 16)
                    if not b:
                        break
                    f.write(b); tick(len(b), total)
                tick.done()
        except Exception as e:                                       # (a proxy that needs curl's settings, a server that is down: the next way)
            why.append(f"{u}: {e}")
            if shutil.which("curl") and subprocess.run(["curl", "-sS", "-L", "--fail", "-o", str(part), u], capture_output=True).returncode == 0:
                why.pop()
            else:
                continue
        if zipfile.is_zipfile(part):
            part.replace(to)
            return None
        why.append(f"{u}: not a zip")
    part.unlink(missing_ok=True)
    return why


class Progress:
    """a line now and then while bytes come in: how much, how fast"""
    def __init__(self, what):
        self.what, self.n, self.t0, self.said, self.lock = what, 0, time.time(), False, threading.Lock()
        self.last = self.t0

    def __call__(self, n, total=0):
        with self.lock:
            self.n += n
            now = time.time()
            if now - self.last >= 5:
                self.last, self.said = now, True
                print(f"    {self.what}: {self.n / 1e6:.1f}" + (f" of {total / 1e6:.1f}" if total else "") + f" MB, {self.n / 1e3 / max(now - self.t0, 1e-3):.0f} KB/s", flush=True)

    def done(self):
        if self.said:
            print(f"    {self.what}: {self.n / 1e6:.1f} MB in {time.time() - self.t0:.0f} s", flush=True)


def unpack(z, to, only=None):
    """a pack's files into `to`: nothing outside it, nothing absurdly large; `only`: the folders in it to take"""
    with zipfile.ZipFile(z) as zf:
        if sum(i.file_size for i in zf.infolist()) > 8 << 30:
            raise SystemExit(f"{Path(str(z)).name}: over 8 GB unpacked: not unpacked")
        for i in zf.infolist():
            if only is not None and not any(i.filename.startswith(f) for f in only):
                continue
            put(zf, i, to)


def put(zf, i, to):
    p = (to / i.filename).resolve()
    if i.is_dir() or not str(p).startswith(str(to.resolve()) + os.sep):
        return
    p.parent.mkdir(parents=True, exist_ok=True)
    with zf.open(i) as src, open(p, "wb") as dst:
        shutil.copyfileobj(src, dst, 1 << 20)


# ---- one garment out of a pack's zip, without the pack: the zip read on the server a range at a time

class NoRanges(Exception):
    pass


TAIL, AHEAD, PIECE, GAP = 1 << 18, 1 << 18, 1 << 19, 1 << 16      # the zip's end read first (its list of files is there); a stray read's reach; a request's size; holes this small are fetched with their neighbours


class Ranged:
    """a file on a server as zipfile wants one (seek, read), every read answered from ranges fetched before it"""
    def __init__(self, url, conns=4):
        self.url, self.conns, self.pos, self.got, self.asked = url, max(1, conns), 0, [], 0
        b, self.size = self.get(None, TAIL)
        self.got.append((self.size - len(b), b))

    def get(self, lo, hi):
        """bytes lo..hi-1 (lo None: the last `hi` bytes) and the file's size; NoRanges when the server sends the whole file instead"""
        why = None
        for go in range(4):
            try:
                req = urllib.request.Request(self.url, headers={"User-Agent": "clothing-library-fetch", "Range": f"bytes=-{hi}" if lo is None else f"bytes={lo}-{hi - 1}"})
                with urllib.request.urlopen(req, timeout=60) as r:
                    m = re.match(r"bytes (\d+)-(\d+)/(\d+)", r.headers.get("Content-Range") or "")
                    if r.status != 206 or not m:
                        raise NoRanges(self.url)
                    b = r.read()
                if len(b) != int(m.group(2)) - int(m.group(1)) + 1 or (lo is not None and int(m.group(1)) != lo):
                    raise OSError("a range came back short")
                self.asked += len(b)
                return b, int(m.group(3))
            except NoRanges:
                raise
            except Exception as e:                                   # (a slow server drops connections: again, a little later)
                why = e
                if 400 <= getattr(e, "code", 0) < 500:               # (refused, not there: asking again won't change it)
                    break
                time.sleep(2 * 2 ** go if go < 3 else 0)
        raise OSError(f"{self.url}: {why}")

    def need(self, spans, what=""):
        """fetch these (lo, hi) spans ahead of the reads, a few requests at a time"""
        from concurrent.futures import ThreadPoolExecutor
        spans = sorted((lo, min(hi, self.size)) for lo, hi in spans if not self.have(lo, min(hi, self.size)))
        joined = []
        for lo, hi in spans:
            if joined and lo - joined[-1][1] <= GAP:
                joined[-1][1] = max(joined[-1][1], hi)
            else:
                joined.append([lo, hi])
        pieces = [(lo, min(lo + PIECE, hi)) for a, b in joined for lo in range(a, b, PIECE) for hi in [b]]
        total, tick = sum(h - l for l, h in pieces), Progress(what or "ranges")

        def one(p):
            b = self.get(*p)[0]
            tick(len(b), total)
            return b
        with ThreadPoolExecutor(self.conns) as ex:
            parts = dict(zip(pieces, ex.map(one, pieces)))
        tick.done()
        for a, b in joined:
            self.got.append((a, b"".join(parts[p] for p in pieces if a <= p[0] < b)))
        return total

    def have(self, lo, hi):
        return next((b[lo - s:hi - s] for s, b in self.got if s <= lo and hi <= s + len(b)), None)

    def drop(self):
        self.got = self.got[:1]                                      # (the zip's end is kept: its list of files)

    def seekable(self): return True
    def readable(self): return True
    def tell(self): return self.pos

    def seek(self, n, whence=0):
        self.pos = n if whence == 0 else self.pos + n if whence == 1 else self.size + n
        return self.pos

    def read(self, n=-1):
        lo = self.pos
        hi = self.size if n is None or n < 0 else min(self.size, lo + n)
        if hi <= lo:
            return b""
        b = self.have(lo, hi)
        if b is None:
            more = min(self.size, max(hi, lo + AHEAD))
            self.got.append((lo, self.get(lo, more)[0]))
            b = self.have(lo, hi)
        self.pos = hi
        return b


def folders(names, want, every=None):
    """in a pack's file names: each wanted garment's folder, and which were found by a near name only.
    A garment is its .mhclo's folder; found by that folder's or the .mhclo's name, exactly first. What's left is
    matched loosely over the whole pack (`every`: all the pack's catalogued names), best pairs first, a folder to one
    garment: the catalogue says elvs_crochet_baby_doll where an uploader's folder says Elvs_Crochet_Baby_Doll1."""
    import difflib
    every = list(every or want)
    found = {}                                                       # folder -> (its own name, its .mhclo's name), as written
    for n in names:
        f = Path(str(n).replace("\\", "/"))
        if f.suffix.lower() == ".mhclo" and str(f.parent) != ".":
            found.setdefault(f.parent.as_posix() + "/", (norm(f.parent.name), norm(f.stem)))
    by = {norm(i): i for i in every}
    out, loose = {}, set()
    for folder, keys in found.items():
        i = by.get(keys[0]) or by.get(keys[1])
        if i and i not in out:
            out[i] = folder
    free = [f for f in found if f not in out.values()]
    pairs = sorted(((max(difflib.SequenceMatcher(None, norm(i), k).ratio() for k in found[f]), i, f) for i in every if i not in out for f in free), reverse=True)
    for score, i, f in pairs:
        if score < 0.8:
            break
        if i not in out and f not in out.values():
            out[i] = f; loose.add(i)
    return {i: f for i, f in out.items() if i in set(want)}, loose & set(want)


def cut(urls, want, to, conns=4, every=None):
    """the wanted garments' folders out of a pack's zip at one of `urls`, into `to`: {id: MB fetched}; NoRanges, or OSError with why"""
    why, plain = [], False
    for u in urls:
        try:
            r = Ranged(u, conns)
            zf = zipfile.ZipFile(r)
        except NoRanges:
            plain = True; continue                                   # (the other mirror may give them)
        except Exception as e:
            why.append(f"{u}: {e}"); continue
        infos = sorted(zf.infolist(), key=lambda i: i.header_offset)
        end = {i.filename: (infos[k + 1].header_offset if k + 1 < len(infos) else zf.start_dir) for k, i in enumerate(infos)}
        where, loose = folders([i.filename for i in infos], want, every)
        done = {}
        for i, f in where.items():
            if i in loose:
                print(f"    {i}: taken as {f.rstrip('/').split('/')[-1]} (the nearest name in {Path(u).name})")
            mine = [x for x in infos if x.filename.startswith(f)]
            if sum(x.file_size for x in mine) > 2 << 30:
                raise OSError(f"{i}: over 2 GB unpacked: not fetched")
            n = r.need([(x.header_offset, end[x.filename]) for x in mine], i)
            for x in mine:
                put(zf, x, to)
            r.drop()
            done[i] = n / 1e6
        if set(want) - set(where):                                   # said with what the zip does call its garments, so a name can be put right
            import difflib
            theirs = sorted({Path(n).parent.name for n in end if n.lower().endswith(".mhclo")})
            for i in sorted(set(want) - set(where)):
                near = difflib.get_close_matches(norm(i), [norm(n) for n in theirs], 3, 0.6)
                print(f"    {i}: no folder of that name in {Path(u).name}" + (f" (near it: {', '.join(n for n in theirs if norm(n) in near)})" if near else ""))
        return done
    if plain:
        raise NoRanges()
    raise OSError("; ".join(why))


def fetch_garments(ix, got, a):
    base = home()
    here = [x for x in got if x.get("folder") and any((base / x["folder"]).glob("*.mhclo")) and not a.again]
    todo = [x for x in got if x not in here]
    by = {}
    for x in todo:
        by.setdefault(x["pack"], []).append(x["id"])
    print(f"fetching {len(todo)} garments from {len(by)} packs into {base}" + (f" ({len(here)} there already)" if here else ""))
    failed = []
    for p, ids in by.items():
        info = ix["packs"][p]
        urls = urls_of(info, a)
        try:
            done = cut(urls, ids, base / p, a.connections, [x["id"] for x in ix["assets"] if x["pack"] == p])
        except NoRanges:                                             # the whole pack then, and only the picked folders out of it
            print(f"  {p}: the server gives no ranges: the whole pack ({info['size_mb']:.0f} MB) for {len(ids)} of its garments")
            z = base / "_zips" / Path(info["zip"]).name
            z.parent.mkdir(parents=True, exist_ok=True)
            why = None if (z.exists() and zipfile.is_zipfile(z)) else download(urls, z)
            if why:
                failed += ids; print(f"  {p}: NOT fetched\n    " + "\n    ".join(why)); continue
            with zipfile.ZipFile(z) as zf:
                where, _ = folders(zf.namelist(), ids, [x["id"] for x in ix["assets"] if x["pack"] == p])
            unpack(z, base / p, list(where.values()))
            done = {i: 0 for i in where}
            if not a.keep_zips:
                z.unlink()
        except OSError as e:
            failed += ids; print(f"  {p}: NOT fetched\n    {e}"); continue
        for i in ids:
            print(f"  {i}: {done[i]:.1f} MB" if i in done else f"  {i}: NOT in {Path(info['zip']).name} under that name")
        failed += [i for i in ids if i not in done]
    scan(a)
    if failed:
        print(f"FETCH: {len(failed)} of {len(todo)} garments not fetched: {' '.join(failed)}")
        return 1
    print(f"FETCH ok: {len(got)} garments in {base}")
    return 0


def fetch(a):
    ix = load()
    if a.only or (picked() and not a.packs and not a.all):
        mine = picked()
        if not a.only:
            print(f"the picked garments only ({len(mine)}: {PICKS.relative_to(ROOT)}); --all for every pack")
        return fetch_garments(ix, [x for x in named(ix, a.only or mine) if not x.get("refused")], a)
    want = [p for p in ix["packs"] if (p in a.packs if a.packs else (p not in MATERIALS or a.materials))]
    if a.licence:
        want = [p for p in want if ix["packs"][p]["licence"].lower().replace("-", "") == a.licence.lower().replace("-", "")]
    if a.packs and set(a.packs) - set(ix["packs"]):
        raise SystemExit(f"not in the catalogue: {sorted(set(a.packs) - set(ix['packs']))}")
    base = home(); zips = base / "_zips"; zips.mkdir(parents=True, exist_ok=True)
    print(f"fetching {len(want)} packs, {sum(ix['packs'][p]['size_mb'] or 0 for p in want) / 1000:.1f} GB, into {base}")
    failed = []
    for p in want:
        info = ix["packs"][p]
        if (base / p).is_dir() and any((base / p).rglob("*.mhclo")) and not a.again:
            print(f"  {p}: there already"); continue
        z = zips / Path(info["zip"]).name
        if not (z.exists() and zipfile.is_zipfile(z)):
            why = download(urls_of(info, a), z)
            if why:
                failed.append(p); print(f"  {p}: NOT fetched\n    " + "\n    ".join(why)); continue
        unpack(z, base / p)
        print(f"  {p}: {z.stat().st_size / 1e6:.0f} MB, {sum(1 for _ in (base / p).rglob('*.mhclo'))} garments")
        if not a.keep_zips:
            z.unlink()
    scan(a)
    if failed:
        print(f"FETCH: {len(failed)} of {len(want)} packs not fetched: {' '.join(failed)}")
        return 1
    print(f"FETCH ok: {len(want)} packs in {base}")
    return 0


# ---- what is on disk

def header(f):
    out = {}
    for l in f.read_text(errors="ignore").splitlines()[:80]:
        m = re.match(r"^#?\s*(author|license|licence|homepage|name|uuid)\b\s*:?\s*(.*)$", l.strip(), re.I)
        if m and m.group(1).lower() not in out:
            out[m.group(1).lower().replace("licence", "license")] = m.group(2).strip()
    return out


def scan(a):
    ix = load()
    base = home()
    by = {}
    for x in ix["assets"]:
        by.setdefault(x["pack"], {})[x["id"]] = x
        for k in ("file_licence", "file_author", "folder"):
            x.pop(k, None)
    found = odd = strays = 0
    for pack in sorted(by):
        files = sorted((base / pack).rglob("*.mhclo")) if (base / pack).is_dir() else []
        where, _ = folders([f.relative_to(base / pack).as_posix() for f in files], list(by[pack]))
        whose = {f: i for i, f in where.items()}
        for f in files:
            x = by[pack].get(whose.get(f.parent.relative_to(base / pack).as_posix() + "/"))
            if x is None:
                strays += 1; continue
            if "folder" in x:                                        # (a garment with several .mhclo, one a body kind: the first stands for it)
                continue
            h = header(f)
            x["folder"] = str(f.parent.relative_to(base))
            found += 1
            if h.get("license"):
                x["file_licence"] = tidy(h["license"])
                if (x["file_licence"] == "CC0") != (x["licence"] == "CC0") or not x["file_licence"].startswith("CC"):
                    odd += 1
                    x.setdefault("refused", f"its file says \"{h['license']}\", its page {x['licence']}") if not x["file_licence"].startswith("CC") else None
            if h.get("author") and norm(h["author"]) != norm(x["author"]):
                x["file_author"] = h["author"]
    save(ix)
    print(f"scan: {found} of {len(ix['assets'])} catalogued garments on disk in {base}" + (f"; {odd} whose file and page disagree on the licence (python tools/clothing_library.py list)" if odd else "")
          + (f"; {strays} files not in the catalogue" if strays else ""))
    if found:
        credits(argparse.Namespace(block=False))
    return 0


# ---- the credits

def credits(a):
    ix = load()
    text = CREDITS.read_text() if CREDITS.exists() else ""
    ticks = {m.group(2): m.group(1).strip() for m in re.finditer(r"^\|([^|]*)\|\s*`([^`]+)`", text, re.M) if m.group(1).strip()}
    rows = sorted((x for x in ix["assets"] if licence_of(x).startswith("CC BY") and not x.get("refused")), key=lambda x: (x["author"].lower(), x["group"], x["id"]))
    if a.block:
        used = [x for x in rows if x["id"] in ticks]
        by = {}
        for x in used:
            by.setdefault((x.get("file_author") or x["author"], licence_of(x)), []).append(x["id"].replace("_", " "))
        print("CLOTHING\n")
        for (author, lic), names in sorted(by.items()):
            print(f"{', '.join(names)} by {author}, {lic}")
        print("\nFrom the MakeHuman Community asset repository (makehumancommunity.org).\nAll were changed for this game: refitted to its characters, some given other fabrics.\n"
              "Licences: creativecommons.org/licenses/by/4.0 and creativecommons.org/licenses/by/3.0")
        print(f"\n({len(used)} ticked of {len(rows)})", file=sys.stderr)
        return 0
    table = [BEGIN, "", "| In the game | Garment (its name in the pack) | Kind | Author | Licence | Its page | Pack |", "|---|---|---|---|---|---|---|"]
    for x in rows:
        lic = licence_of(x)
        lic = lic if lic != "CC BY" else "CC-BY (its page; its file says CC0)" if x.get("file_licence") == "CC0" else "CC-BY (version: in its file)"
        lic += " (its page says CC0)" if x["licence"] == "CC0" else ""
        table.append(f"| {ticks.get(x['id'], '')} | `{x['id']}` | {x['group']} | {x.get('file_author') or x['author']} | {lic} | {('[page](' + x['page'] + ')') if x['page'] else ''} | {x['pack']} |")
    table += ["", END]
    block = "\n".join(table)
    if BEGIN in text and END in text:
        text = text[:text.index(BEGIN)] + block + text[text.index(END) + len(END):]
    else:
        raise SystemExit(f"{CREDITS.relative_to(ROOT)} has no clothing table to fill (the two marker lines)")
    CREDITS.write_text(text)
    print(f"credits: {len(rows)} CC-BY garments in {CREDITS.relative_to(ROOT)} ({len(ticks)} ticked)")
    return 0


# ---- CLOTHLIB

def check(a):
    faults = []
    ix = load()
    packs, assets = ix["packs"], ix["assets"]
    if len(packs) < 30 or len(assets) < 400:
        faults.append(f"the catalogue is thin: {len(packs)} packs, {len(assets)} garments")
    for p, info in packs.items():
        if info["licence"] not in ("CC0", "CC-BY"):
            faults.append(f"{p}: a pack of mixed licences")
        if not re.match(r"^/asset_packs/[\w.-]+/[\w.-]+\.zip$", info["zip"]) or not info["mirrors"] or not all(m.startswith("https://") for m in info["mirrors"]):
            faults.append(f"{p}: where it's fetched from isn't a zip on an https mirror ({info['zip']})")
        if "cc0" not in info["zip"] and info["licence"] == "CC0":   # (the other way happens upstream: underwear02's zip is named cc0 and its page lists CC-BY garments. The page's stricter word is kept: they're credited)
            faults.append(f"{p}: a CC-BY zip catalogued as CC0")
        if not info["size_mb"]:
            faults.append(f"{p}: no size")
    seen = set()
    for x in assets:
        if x["pack"] not in packs:
            faults.append(f"{x['id']}: its pack {x['pack']} isn't in the catalogue")
            continue
        if (x["pack"], x["id"]) in seen:
            faults.append(f"{x['id']}: twice in {x['pack']}")
        seen.add((x["pack"], x["id"]))
        if x["licence"] != packs[x["pack"]]["licence"]:
            faults.append(f"{x['id']}: {x['licence']} in a {packs[x['pack']]['licence']} pack")
        if x["licence"] == "CC-BY" and not (x["author"] and x["page"].startswith("http")):
            faults.append(f"{x['id']}: CC-BY with no author or page to credit")
        if refused(x["id"]) and not x.get("refused"):
            faults.append(f"{x['id']}: a name the refuse list knows, not marked")
    # every CC-BY garment that may be used has its line in the credits, and no refused one does
    text = CREDITS.read_text() if CREDITS.exists() else ""
    listed = set(re.findall(r"^\|[^|]*\|\s*`([^`]+)`", text, re.M))
    need = {x["id"] for x in assets if licence_of(x).startswith("CC BY") and not x.get("refused")}
    for a_, b_ in ((dict(licence="CC0", file_licence="CC BY 4.0"), "CC BY 4.0"), (dict(licence="CC-BY", file_licence="CC0"), "CC BY"), (dict(licence="CC-BY"), "CC BY"), (dict(licence="CC0", file_licence="CC0"), "CC0"),
                   (dict(licence="CC0", file_licence="AGPL3"), "AGPL3")):
        if licence_of(a_) != b_:
            faults.append(f"the stricter licence of {a_} read as {licence_of(a_)}")
    if need - listed:
        faults.append(f"docs/CREDITS.md lacks {len(need - listed)} CC-BY garments (python tools/clothing_library.py credits): {sorted(need - listed)[:4]}")
    if {x["id"] for x in assets if x.get("refused")} & listed - need:
        faults.append("docs/CREDITS.md lists a refused garment")
    # the fetch's own handling of an archive: a made-up zip with a file that tries to leave its folder
    with tempfile.TemporaryDirectory() as t:
        z = Path(t) / "p.zip"
        with zipfile.ZipFile(z, "w") as zf:
            zf.writestr("clothes/a_dress/a_dress.mhclo", "# author Somebody\n# license CC_by 4.0\nname a_dress\n")
            zf.writestr("../outside.txt", "no")
        unpack(z, Path(t) / "out")
        if (Path(t) / "outside.txt").exists() or not (Path(t) / "out" / "clothes" / "a_dress" / "a_dress.mhclo").exists():
            faults.append("unpacking let a file out of its folder, or lost one")
        h = header(Path(t) / "out" / "clothes" / "a_dress" / "a_dress.mhclo")
        if h.get("author") != "Somebody" or tidy(h.get("license", "")) != "CC BY 4.0":
            faults.append(f"a garment's header misread: {h}")
    faults += ranged_check()
    # a garment's folder by name: exactly, else the nearest in its pack, best pairs first and a folder to one garment
    names = ["clothes/Elvs_Crochet_Baby_Doll1/babydoll_elvruff1a.mhclo", "clothes/Goddess_Dress_1/gd1.mhclo", "clothes/Goddess_Dress_2/gd2.mhclo", "clothes/toigo_shift_dress/toigo_shift_dress.mhclo",
             "clothes/toigo_shift_dress/toigo_shift_dress_b.mhclo", "loose.mhclo", "clothes/Something_Else/else.mhclo"]
    pack = ["elvs_crochet_baby_doll", "elvs_goddess_dress1", "elvs_goddess_dress2", "toigo_shift_dress", "wdg_mycenaean_tunic"]
    where, loose = folders(names, ["elvs_goddess_dress2", "toigo_shift_dress", "elvs_crochet_baby_doll", "wdg_mycenaean_tunic"], pack)
    if where != {"elvs_goddess_dress2": "clothes/Goddess_Dress_2/", "toigo_shift_dress": "clothes/toigo_shift_dress/", "elvs_crochet_baby_doll": "clothes/Elvs_Crochet_Baby_Doll1/"} \
            or loose != {"elvs_goddess_dress2", "elvs_crochet_baby_doll"}:
        faults.append(f"garments' folders found by name wrongly: {where}, loosely {sorted(loose)}")
    # picking: numbers are places in the catalogue, names found whatever their case; what isn't there is said
    got = named(ix, ["#2", "4-5", assets[9]["id"].upper(), "2"])
    if [x["id"] for x in got] != [assets[k]["id"] for k in (1, 3, 4, 9)]:
        faults.append(f"picking by number and name read wrong: {[x['id'] for x in got]}")
    try:
        named(ix, [str(len(assets) + 1)]); faults.append("a number past the catalogue's end was taken")
    except SystemExit:
        pass
    if set(picked()) - {x["id"] for x in assets}:
        faults.append(f"picks.json names garments the catalogue doesn't have: {sorted(set(picked()) - {x['id'] for x in assets})[:4]}")
    if {x["id"] for x in assets if x.get("refused")} & set(picked()):
        faults.append("picks.json has a refused garment")
    for w, t in (("CC-BY", "CC BY"), ("cc by 3.0", "CC BY 3.0"), ("CC_by", "CC BY"), ("CC0", "CC0"), ("AGPL3", "AGPL3"), ("CC BY 4", "CC BY 4.0")):
        if tidy(w) != t:
            faults.append(f"the licence \"{w}\" read as \"{tidy(w)}\"")
    # a character's own credits (storykit/clothcredits.py): only what it wears, a refused garment flagged, the tailor's as ours
    from storykit import clothcredits
    with tempfile.TemporaryDirectory() as t:
        by = next(x["id"] for x in assets if x["licence"] == "CC-BY" and not x.get("refused"))
        no = next((x["id"] for x in assets if x.get("refused")), None)
        (Path(t) / "character.json").write_text(json.dumps(dict(clothes=[dict(design="tights"), dict(library=by)] + ([dict(library=no)] if no else []))))
        md = clothcredits.text("someone", *clothcredits.of_character(t))
        one = next(x for x in assets if x["id"] == by)
        if f"| {by} | {one['author']} |" not in md or one["page"] not in md or "- tights" not in md.split("## The Studio's own")[-1]:
            faults.append("a character's credits don't name its CC-BY garment with its author and page, or its tailor's clothes as ours")
        if no and (no not in md.split("## Not to ship as it is")[-1] or f"| {no} |" in md):
            faults.append("a character's credits don't flag a refused garment")
        if sum(1 for x in assets if x["licence"] == "CC-BY" and f"| {x['id']} |" in md) != 1:
            faults.append("a character's credits list garments it doesn't wear")
        if "Nothing: no CC-BY garment is worn." not in clothcredits.text("plain", *clothcredits.of_character(Path(t) / "nobody")):
            faults.append("a character with no library clothes doesn't say there is nothing to credit")
    base = home()
    on = sum(1 for x in assets if x.get("folder") and (base / x["folder"]).is_dir())
    for f in faults:
        print("CLOTHLIB FAIL:", f)
    if not faults:
        w = [x for x in assets if not x.get("refused")]
        print(f"CLOTHLIB ok ({len(packs)} packs, {len(w)} garments: {sum(x['licence'] == 'CC0' for x in w)} CC0, {sum(x['licence'] == 'CC-BY' for x in w)} CC-BY credited; {len(assets) - len(w)} refused; {on} on disk)")
    return 1 if faults else 0


def ranged_check():
    """one garment cut out of a pack on a server of our own (this machine, a made-up zip): with ranges only its bytes
    cross the wire; from a server with none the whole pack comes and still only its folder is unpacked"""
    import http.server
    faults = []
    for k in ("no_proxy", "NO_PROXY"):
        os.environ[k] = ",".join(filter(None, [os.environ.get(k, ""), "127.0.0.1"]))
    with tempfile.TemporaryDirectory() as t:
        t = Path(t)
        big, other = os.urandom(1_300_000), os.urandom(2_000_000)      # (over two requests' worth; noise doesn't compress)
        with zipfile.ZipFile(t / "p.zip", "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("clothes/b_coat/b_coat.mhclo", "name b_coat\n"); zf.writestr("clothes/b_coat/b_coat.png", other)
            zf.writestr("clothes/a_dress/a_dress.mhclo", "# author Somebody\n# license CC_by 4.0\nname a_dress\n")
            zf.writestr("clothes/a_dress/a_dress.obj", "v 0 0 0\n" * 3000); zf.writestr("clothes/a_dress/textures/a_dress.png", big)
            zf.writestr("clothes/a_dress/../../../outside.txt", "no")
            zf.writestr("clothes/c_Hat-01/hat.mhclo", "name c hat 01\n"); zf.writestr("clothes/c_Hat-01/hat.png", other)
        data = (t / "p.zip").read_bytes()
        sent = [0]

        class H(http.server.BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def do_GET(self):
                m = re.match(r"bytes=(\d*)-(\d*)", self.headers.get("Range") or "")
                if m and self.path.startswith("/ranges/"):
                    lo, hi = (max(0, len(data) - int(m.group(2))), len(data) - 1) if not m.group(1) else (int(m.group(1)), min(int(m.group(2) or len(data) - 1), len(data) - 1))
                    b = data[lo:hi + 1]
                    self.send_response(206); self.send_header("Content-Range", f"bytes {lo}-{hi}/{len(data)}")
                else:
                    b = data
                    self.send_response(200)
                sent[0] += len(b)
                self.send_header("Content-Length", str(len(b))); self.end_headers()
                try:
                    self.wfile.write(b)
                except OSError:                                      # (the fetch hangs up on a server with no ranges: as it should)
                    pass
        srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), H)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        url = f"http://127.0.0.1:{srv.server_address[1]}"
        try:
            done = cut([url + "/ranges/p.zip"], ["a_dress", "c_hat_01", "not_there"], t / "cut")
            got = sorted(str(f.relative_to(t / "cut")).replace(os.sep, "/") for f in (t / "cut").rglob("*") if f.is_file())
            if sorted(done) != ["a_dress", "c_hat_01"]:
                faults.append(f"a ranged fetch found {sorted(done)} in the pack, not the dress and the hat")
            if got != ["clothes/a_dress/a_dress.mhclo", "clothes/a_dress/a_dress.obj", "clothes/a_dress/textures/a_dress.png", "clothes/c_Hat-01/hat.mhclo", "clothes/c_Hat-01/hat.png"]:
                faults.append(f"a ranged fetch unpacked {got}")
            elif (t / "cut/clothes/a_dress/textures/a_dress.png").read_bytes() != big or (t / "cut/clothes/c_Hat-01/hat.png").read_bytes() != other:
                faults.append("a ranged fetch's files aren't the pack's")
            if (t / "outside.txt").exists() or (t / "cut" / "outside.txt").exists():
                faults.append("a ranged fetch let a file out of its folder")
            if sent[0] > len(data) - 1_500_000:
                faults.append(f"a ranged fetch of two garments pulled {sent[0]} of the pack's {len(data)} bytes: the coat's too")
            sent[0] = 0
            cut([url + "/ranges/p.zip"], ["a_dress"], t / "one")
            if sent[0] > 1_300_000 + TAIL + 100_000:
                faults.append(f"a ranged fetch of the dress alone (1.3 MB) pulled {sent[0]} bytes")
            try:
                cut([url + "/plain/p.zip"], ["a_dress"], t / "no"); faults.append("a server with no ranges wasn't noticed")
            except NoRanges:
                pass
            if cut([url + "/plain/p.zip", url + "/ranges/p.zip"], ["a_dress"], t / "two").keys() != {"a_dress"}:
                faults.append("the second mirror's ranges weren't used when the first gave none")
            why = download([url + "/plain/p.zip"], t / "whole.zip")
            with zipfile.ZipFile(t / "whole.zip") as zf:
                where, _ = folders(zf.namelist(), ["a_dress"])
            unpack(t / "whole.zip", t / "plain", list(where.values()))
            if why or sorted(f.name for f in (t / "plain").rglob("*") if f.is_file()) != ["a_dress.mhclo", "a_dress.obj", "a_dress.png"] or (t / "outside.txt").exists():
                faults.append(f"from a whole pack, more or less than the picked garment's folder was unpacked ({why})")
        except Exception as e:
            faults.append(f"the ranged fetch broke on a server of our own: {type(e).__name__}: {e}")
        finally:
            srv.shutdown(); srv.server_close()
    return faults


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("catalogue"); s.add_argument("--site", default="")
    s = sub.add_parser("list"); s.add_argument("--licence", default=""); s.add_argument("--group", default=""); s.add_argument("--author", default=""); s.add_argument("--picked", action="store_true")
    s = sub.add_parser("pick"); s.add_argument("words", nargs="*"); s.add_argument("--remove", action="store_true")
    s = sub.add_parser("sheets"); s.add_argument("--site", default=""); s.add_argument("--out", default="")
    s = sub.add_parser("fetch"); s.add_argument("packs", nargs="*"); s.add_argument("--licence", default=""); s.add_argument("--materials", action="store_true")
    s.add_argument("--keep-zips", action="store_true"); s.add_argument("--again", action="store_true"); s.add_argument("--all", action="store_true")
    s.add_argument("--only", nargs="+", default=[]); s.add_argument("--connections", type=int, default=4); s.add_argument("--mirror", default="")
    sub.add_parser("scan")
    s = sub.add_parser("credits"); s.add_argument("--block", action="store_true")
    sub.add_parser("check")
    a = ap.parse_args()
    return dict(catalogue=catalogue, list=listing, pick=pick, sheets=sheets, fetch=fetch, scan=scan, credits=credits, check=check)[a.cmd](a) or 0


if __name__ == "__main__":
    sys.exit(main())
