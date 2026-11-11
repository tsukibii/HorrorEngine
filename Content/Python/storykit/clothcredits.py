"""Who to credit for what a character wears (the user, 2026-11-11: "When you export the characters ... include a .md
that contains whos cc outfits we used so I can credit just the ones used").

Every character exported for Godot gets a CREDITS.md beside its .glb: the library garments it wears that ask for a
credit (CC-BY: the author, the licence, the garment's page), those that don't (CC0), and what is the Studio's own.
The whole library's credits are docs/CREDITS.md; this is one character's share of them. The catalogue it reads is
Content/Studio/Clothes/library/index.json (tools/clothing_library.py).
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
INDEX = ROOT / "Content" / "Studio" / "Clothes" / "library" / "index.json"
REPO = "http://www.makehumancommunity.org/clothes.html"
LINKS = {"CC BY 4.0": "https://creativecommons.org/licenses/by/4.0/", "CC BY 3.0": "https://creativecommons.org/licenses/by/3.0/", "CC BY": "https://creativecommons.org/licenses/by/4.0/",
         "CC0": "https://creativecommons.org/publicdomain/zero/1.0/"}


def norm(s):
    return re.sub(r"[^a-z0-9]", "", str(s).lower())


def tidy(lic):
    """a licence as a file writes it, in one spelling: 'CC BY 4.0', 'CC BY 3.0', 'CC BY', 'CC0', else as written"""
    s = str(lic).upper().replace("_", " ").replace("-", " ")
    if re.search(r"CC\s*0|CC ZERO|PUBLIC DOMAIN", s):
        return "CC0"
    m = re.search(r"CC\s*BY\s*(\d(?:\.\d)?)?", s)
    if m and not re.search(r"\b(SA|NC|ND)\b", s):
        return "CC BY" + (f" {m.group(1) if '.' in m.group(1) else m.group(1) + '.0'}" if m.group(1) else "")
    return str(lic).strip()


def catalogue():
    return {norm(x["id"]): x for x in json.loads(INDEX.read_text())["assets"]} if INDEX.exists() else {}


def garment(name, author="", licence="", folder="", cat=None):
    """one worn library garment for the credits: what its own file says (author, licence), filled in and given its
    page from the catalogue when a name of it (its own, its folder's) is there"""
    cat = catalogue() if cat is None else cat
    x = cat.get(norm(name)) or cat.get(norm(folder)) or {}
    lic = tidy(licence) if licence else (x.get("file_licence") or ("CC0" if x.get("licence") == "CC0" else "CC BY" if x else ""))
    return dict(name=name, author=author or x.get("file_author") or x.get("author", ""), licence=lic, page=x.get("page", ""), pack=x.get("pack", ""), refused=x.get("refused", ""))


def text(name, worn, ours=()):
    """the CREDITS.md of one export: `worn` the library garments (garment()), `ours` the names of what the Studio made"""
    other = [g for g in worn if g["refused"] or not (g["licence"].startswith("CC BY") or g["licence"] == "CC0")]
    by = [g for g in worn if g["licence"].startswith("CC BY") and g not in other]
    free = [g for g in worn if g["licence"] == "CC0" and g not in other]
    out = [f"# Credits for {name}", "", "What this character wears from the clothing library, and who has to be credited for it. Made with the export;",
           "the whole library's credits are the project's docs/CREDITS.md.", ""]
    if by:
        out += ["## To credit (CC-BY)", "", "| Garment | Author | Licence | Its page |", "|---|---|---|---|"]
        out += [f"| {g['name']} | {g['author'] or '(not named in its file)'} | [{g['licence']}]({LINKS.get(g['licence'], LINKS['CC BY'])}) | {g['page'] or REPO} |" for g in by]
        groups = {}
        for g in by:
            groups.setdefault((g["author"] or "an unnamed author", g["licence"]), []).append(g["name"].replace("_", " "))
        out += ["", "To paste into the game's credits:", "", "```text"] + [f"{', '.join(n)} by {a}, {l}" for (a, l), n in sorted(groups.items())]
        out += ["From the MakeHuman Community asset repository (makehumancommunity.org).", "Changed for this game: refitted to its characters, some given other fabrics.", "```", ""]
    else:
        out += ["## To credit", "", "Nothing: no CC-BY garment is worn.", ""]
    if other:
        out += ["## Not to ship as it is", "", "On the library's refuse list, or with a licence that is neither CC0 nor CC-BY:", ""] + [f"- {g['name']}: {g['refused'] or g['licence'] or 'no licence in its file'}" for g in other] + [""]
    if free:
        out += ["## No credit needed (CC0)", ""] + [f"- {g['name']}" + (f", {g['author']}" if g["author"] else "") for g in free] + [""]
    if ours:
        out += ["## The Studio's own", "", "Cut by the Character Studio's tailor: ours, nothing to credit.", ""] + [f"- {n}" for n in ours] + [""]
    return "\n".join(out)


def write(path, name, worn, ours=()):
    Path(path).write_text(text(name, worn, ours), encoding="utf-8")
    return Path(path)


def of_character(folder):
    """what a Character Studio character wears, from its character.json: (library garments, the tailor's designs).
    A worn garment that came from the library says so with a `library` name; the rest are the tailor's."""
    f = Path(folder) / "character.json"
    clothes = (json.loads(f.read_text()).get("clothes") or []) if f.is_file() else []
    cat = catalogue()
    worn = [garment(c["library"], c.get("author", ""), c.get("licence", ""), cat=cat) for c in clothes if isinstance(c, dict) and c.get("library")]
    ours = [c.get("design", "") for c in clothes if isinstance(c, dict) and not c.get("library") and c.get("design")]
    return worn, ours
