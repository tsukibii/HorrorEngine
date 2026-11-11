"""An outfit worn in layers on the Studio's bodies: library garments (MakeHuman's) and the tailor's own together.

    python wear.py <work dir> <outfit.json> [--no-layers] [--glb]

  <work dir>     reg.npz (register.py), bodies/ (bodies.mjs), sources.json: {"<prefix>": "<folder of garment folders>"}
  <outfit.json>  {"name": "skirt_sweater", "bodies": ["feminine", "anime_full"], "tuck": false,
                  "wear": [{"mh": "glam:Maria_Skirt"}, {"mh": "glam:Knitted_Sweater_01", "layer": 40}, {"mh": "sys:shoes04", "drop_above": 0.2},
                           {"tailor": "tights"}, {"tailor": "knee-socks", "color": "#f2f2f2"}],
                  "looks": {"<garment name>": {...}}}        (looks: render.mjs's)
                 a line of "wear" may also say "layer" (a number) or "kind" (layers.LAYER's) when the name misleads,
                 and "drop_above" (metres): without the garment's pieces that reach above it (a shoe's built-in sock)
  writes <work dir>/<name>/<body>.bin and index.json, which render.mjs draws.

Each garment is put on the body (fit.py), then all of them are ordered, set outside one another and what's covered is
marked (layers.py). `--no-layers` leaves that out and hides the skin by the authors' own lists: the fit as it was.
`--glb` also writes <body>.glb for Godot (glb.py): what each band of layers hides in every mesh's vertex colours.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from scipy.spatial import cKDTree

import fit
import glb
import layers
import lib

HERE = Path(__file__).resolve().parent
SHEER = ("sheer", "fishnet", "lace", "net", "web", "mesh")


def pieces(n, faces):
    """which connected piece of a mesh each point belongs to"""
    import scipy.sparse as sp
    from scipy.sparse.csgraph import connected_components
    i = [f[a] for f in faces for a in range(len(f))]; j = [f[(a + 1) % len(f)] for f in faces for a in range(len(f))]
    return connected_components(sp.coo_matrix((np.ones(len(i)), (i, j)), shape=(n, n)), directed=False)[1]


def tailor_parts(work, body, wear):
    """the tailor's garments for this body (node): [{design, slot, sheer, parts: [{..., P, T, N, UV, PART, S, CRZ}]}]"""
    if not wear:
        return []
    import hashlib
    key = body + "_" + hashlib.md5(json.dumps(wear, sort_keys=True).encode()).hexdigest()[:10]
    pre = work / "tailor" / key
    pre.parent.mkdir(parents=True, exist_ok=True)
    lst = Path(str(pre) + "_list.json")
    lst.write_text(json.dumps([[w["tailor"], w.get("color"), w.get("look"), w.get("edit")] for w in wear]))
    r = subprocess.run(["node", str(HERE / "tailor_parts.mjs"), str(work / "bodies"), body, str(pre), str(lst)], capture_output=True, text=True)
    if r.returncode:
        raise SystemExit("tailor_parts: " + r.stderr[-600:])
    head = json.loads(Path(str(pre) + ".json").read_text())
    data = Path(str(pre) + ".bin").read_bytes()
    at = 0
    for g in head:
        for q in g["parts"]:
            for k in ("P", "T", "N", "UV", "PART", "S", "CRZ"):
                n = q["n"][k]
                q[k] = np.frombuffer(data, np.uint32 if k == "T" else np.float32, n, at).copy(); at += n * 4
    return head


def main():
    argv = [a for a in sys.argv[1:] if not a.startswith("--")]
    plain = "--no-layers" in sys.argv
    work, spec = Path(argv[0]), json.loads(Path(argv[1]).read_text())
    src = json.loads((work / "sources.json").read_text())
    reg = dict(np.load(work / "reg.npz"))
    rig = lib.load_rig()
    T = reg["mhr_T"]
    P_avg = reg["mhr_rest"]
    _, _, _, lo = lib.mhr_body()
    rig_at = rig["at"] - np.array([0, lo, 0])
    H_avg = float(P_avg[:, 1].max())
    out = work / (spec["name"] + ("_plain" if plain else "")); out.mkdir(parents=True, exist_ok=True)

    # the library garments, once: on MHR's average at rest
    w_hm = fit.Warp(reg["hm_p"], reg["hm_X"], reg["hm_T"], keep=reg["hm_ok"])
    lib_g = []
    for w in spec["wear"]:
        if "mh" not in w:
            continue
        pre, name = w["mh"].split(":")
        c, o, mat, folder, meta = fit.load_garment(Path(src[pre]) / name, reg["hm_all"])
        rest, _ = fit.unpose(w_hm(o["V"]), o["faces"], reg, rig)
        if w.get("drop_above"):                                     # a garment without its pieces that reach above this height (m, on the average body): a shoe without the sock modelled into it
            lab = pieces(len(rest), o["faces"])
            top = np.full(lab.max() + 1, -np.inf); np.maximum.at(top, lab, rest[:, 1])
            keep = [k for k, f in enumerate(o["faces"]) if top[lab[f[0]]] < w["drop_above"]]
            used = sorted({v for k in keep for v in o["faces"][k]}); to = {v: i for i, v in enumerate(used)}
            o["faces"] = [[to[v] for v in o["faces"][k]] for k in keep]; o["fuv"] = [o["fuv"][k] for k in keep]
            o["V"] = o["V"][used]; rest = rest[used]
        srci, uv, tris = fit.corners(o)
        uv2, islands = fit.uv_metres(rest[srci], uv, tris)
        gname = c.get("name", folder.name)
        kind = w.get("kind") or layers.kind_of(gname + " " + folder.name, rest, H_avg, rig_at, rig["names"])
        lib_g.append(dict(spec=w, name=gname, rest=rest, faces=o["faces"], T=lib.tris_of(o["faces"])[0], src=srci, uv=uv, uv2=uv2, tris=tris, mat=mat,
                          folder=folder, delete=np.array(c["delete"], np.int64), meta=meta, kind=kind,
                          opaque=not any(s in gname.lower() for s in SHEER)))
    tree = cKDTree(reg["hm_X"])
    hm_of_mhr = reg["body_idx"][tree.query(reg["mhr_posed"])[1]]

    index = dict(name=spec["name"], layers=not plain, bodies=[], looks=spec.get("looks", {}),
                 garments=[dict(name=g["name"], kind=g["kind"], tex=str(g["folder"] / g["mat"]["diffuseTexture"]) if g["mat"].get("diffuseTexture") else None,
                                normal=str(g["folder"] / g["mat"]["normalmapTexture"]) if g["mat"].get("normalmapTexture") else None,
                                credit=g["meta"].get("credit", []), islands=None) for g in lib_g])
    for g, gi in zip(lib_g, index["garments"]):
        if gi["tex"] and Path(gi["tex"]).exists():
            gi["detail"] = str(out / (Path(gi["tex"]).stem + "_detail.png"))
            if not Path(gi["detail"]).exists():
                fit.detail_map(gi["tex"], gi["detail"])

    report = []
    for name in spec["bodies"]:
        P = np.fromfile(work / "bodies" / f"{name}.f32", np.float32).reshape(-1, 3).astype(np.float64)
        formf = work / "bodies" / f"{name}_form.f32"
        Pf = np.fromfile(formf, np.float32).reshape(-1, 3).astype(np.float64) if formf.exists() else P      # what cloth lies on
        warp = fit.Warp(P_avg, Pf, T, K=16, eps=0.004)
        body = layers.Body(Pf, T)
        worn, recs = [], []
        for k, g in enumerate(lib_g):
            G, moved = fit.push_out(warp(g["rest"]), g["faces"], Pf, T)
            L = layers.Garment(g["name"], G, g["T"], g["kind"], g["spec"].get("layer"), g["opaque"])
            worn.append(L); recs.append(("lib", k, L))
        for tg in tailor_parts(work, name, [w for w in spec["wear"] if "tailor" in w]):
            d = tg["design"]
            kind = ("socks" if "sock" in d else "shoes") if tg["slot"] == "feet" else ("skirt" if tg["slot"] == "bottom" and "skirt" in d else layers.SLOTS[tg["slot"]])
            Pn, Tn, at = [], [], 0
            for q in tg["parts"]:
                Pn.append(q["P"].reshape(-1, 3).astype(np.float64)); Tn.append(q["T"].reshape(-1, 3).astype(np.int64) + at); at += len(Pn[-1])
            wspec = next(w for w in spec["wear"] if w.get("tailor") == d)
            L = layers.Garment(d, np.vstack(Pn), np.vstack(Tn), wspec.get("kind", kind), wspec.get("layer"),
                               opaque=not (tg.get("sheer") or any(s in (tg.get("surface") or "") + d for s in SHEER)), dense=True, group="tailor")
            worn.append(L); recs.append(("tailor", tg, L))
        ordered = layers.order(worn, spec.get("tuck", False))
        if plain:
            hidden = np.zeros(len(P), bool)
            for g in lib_g:
                hidden |= np.isin(hm_of_mhr, g["delete"])
            skin = hidden.astype(float)
        else:
            layers.resolve(body, ordered)
            skin = layers.hide(body, ordered)
        cross = {n: (c, w, by) for n, c, w, by in layers.crossings(body, ordered)}
        print(f"{name}: " + "; ".join(f"{g.name} [{g.kind} {g.layer}{'' if g.opaque else ' sheer'}] in {g.moved['inward']} out {g.moved['outward']} hidden {int((g.cover >= 1).sum())}/{len(g.P)}"
                                      f" through {cross[g.name][0]}" + (f" ({cross[g.name][1] * 1000:.0f} mm: {cross[g.name][2]})" if cross[g.name][0] else "") for g in ordered if g.name in cross)
              + f"; skin hidden {int((skin >= 1).sum())}/{len(P)}")
        report.append(dict(body=name, garments=[dict(name=g.name, kind=g.kind, layer=g.layer, points=len(g.P), moved_in=g.moved["inward"], moved_out=g.moved["outward"], moved_most_mm=round(g.moved.get("most", 0.0) * 1000, 1), opaque=bool(g.opaque), group=g.group,
                                                     hidden=int((g.cover >= 1).sum()), through=cross.get(g.name, (0, 0, {}))[0], through_mm=round(cross.get(g.name, (0, 0, {}))[1] * 1000, 1), through_what=cross.get(g.name, (0, 0, {}))[2]) for g in ordered],
                           skin_hidden=int((skin >= 1).sum())))

        head = dict(body=dict(P=len(P) * 3, T=T.size, C=len(P)), garments=[], tailor=[])
        blobs = [P.astype(np.float32).tobytes(), T.astype(np.uint32).tobytes(), skin.astype(np.float32).tobytes()]
        later = []                                                   # (the library's garments first in the file, then the tailor's parts)
        for what, ref, L in sorted(recs, key=lambda r: r[2].layer):
            if what == "lib":
                g = lib_g[ref]
                Pc = L.P[g["src"]].astype(np.float32)
                Nc = lib.vnormals(L.P, g["T"])[g["src"]].astype(np.float32)
                Cc = L.cover[g["src"]].astype(np.float32)
                head["garments"].append(dict(name=g["name"], m=ref, kind=L.kind, layer=L.layer, P=Pc.size, N=Nc.size, UV=g["uv"].size, UV2=g["uv2"].size, C=Cc.size, T=g["tris"].size))
                blobs += [Pc.tobytes(), Nc.tobytes(), g["uv"].astype(np.float32).tobytes(), g["uv2"].astype(np.float32).tobytes(), Cc.tobytes(), g["tris"].astype(np.uint32).tobytes()]
            else:
                at = 0
                for q in ref["parts"]:
                    n = len(q["P"]) // 3
                    Pq = L.P[at:at + n].astype(np.float32); Cq = L.cover[at:at + n].astype(np.float32); at += n
                    head["tailor"].append(dict(name=q["name"], design=ref["design"], color=q.get("color"), fabric=q.get("fabric"), surface=q.get("surface"), look=ref.get("look"), kind=L.kind, layer=L.layer,
                                               n=dict(P=Pq.size, T=len(q["T"]), N=len(q["N"]), UV=len(q["UV"]), PART=len(q["PART"]), S=len(q["S"]), CRZ=len(q["CRZ"]), C=Cq.size)))
                    later += [Pq.tobytes(), q["T"].astype(np.uint32).tobytes(), q["N"].astype(np.float32).tobytes(), q["UV"].astype(np.float32).tobytes(),
                              q["PART"].astype(np.float32).tobytes(), q["S"].astype(np.float32).tobytes(), q["CRZ"].astype(np.float32).tobytes(), Cq.tobytes()]
        blobs += later
        if "--glb" in sys.argv:                                     # the same, for Godot (glb.py): what each band of layers hides in the vertex colours
            hexc = lambda c, a=1.0: tuple(int((c or "#888888").lstrip("#")[i:i + 2], 16) / 255 for i in (0, 2, 4)) + (a,)
            ms = [dict(name="body", P=P, N=lib.vnormals(P, T), T=T, COVER=body.covers if not plain else None, color=(0.78, 0.63, 0.54, 1.0), extras=dict(hs_part="skin"))]
            for what, ref, L in sorted(recs, key=lambda r: r[2].layer):
                ex = dict(hs_kind=L.kind, hs_layer=int(L.layer), hs_band=layers.BANDS[layers.band(L.layer)])
                if what == "lib":
                    g = lib_g[ref]; tex = index["garments"][ref]["tex"]
                    ms.append(dict(name=g["name"].replace(" ", "_"), P=L.P[g["src"]], N=lib.vnormals(L.P, g["T"])[g["src"]], T=g["tris"], UV=g["uv"], UV2=g["uv2"],
                                   COVER=None if plain else L.covers[:, g["src"]], texture=tex, alpha="mask" if tex and tex.lower().endswith(".png") else None, extras=ex))
                else:
                    at = 0
                    for q in ref["parts"]:
                        n = len(q["P"]) // 3
                        ms.append(dict(name=ref["design"] + "_" + q["name"].replace(" ", "_"), P=L.P[at:at + n], N=q["N"].reshape(-1, 3), T=q["T"].reshape(-1, 3), UV=q["UV"].reshape(-1, 2),
                                       COVER=None if plain else L.covers[:, at:at + n], color=hexc(q.get("color"), 1.0 if L.opaque else 0.55), alpha=None if L.opaque else "blend", extras=dict(ex, hs_sheer=not L.opaque)))
                        at += n
            glb.write(out / f"{name}.glb", ms)
        hb = json.dumps(head).encode(); hb += b" " * ((4 - len(hb) % 4) % 4)
        with open(out / f"{name}.bin", "wb") as fh:
            fh.write(np.array([len(hb)], np.uint32).tobytes()); fh.write(hb)
            for bl in blobs:
                fh.write(bl)
        index["bodies"].append(dict(name=name, file=f"{name}.bin"))
    index["report"] = report
    (out / "index.json").write_text(json.dumps(index, indent=1))
    print("WEAR ok ->", out)


if __name__ == "__main__":
    main()
