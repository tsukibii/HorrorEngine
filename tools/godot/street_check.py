#!/usr/bin/env python3
"""GDSTREET: a street's .glb, exported as the page does, dropped into a Godot 4.7 project of its own and imported headless,
as the user drags it into theirs (docs/STREET_BUILDER.md §5b): its walkable surfaces and walls became colliders (a ray
lands on the road, on the pavement and on a building where the street says they are), its buildings' occluders came
in, its lamps are lights, its colours survived (not all white), and every inside's marker is there with its set.

    python tools/godot/street_check.py [--street shibuya_lane]      (the desk's server running; Godot: $GODOT or godot)

Ends "GDSTREET ok".
"""
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
args = sys.argv[1:]
street = args[args.index("--street") + 1] if "--street" in args else "shibuya_lane"
G = os.environ.get("GODOT") or shutil.which("godot") or shutil.which("godot-mono")
proj = ROOT / "Saved" / "Godot" / "_street_check" / street
errs = []


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


if not G:
    sys.exit("GDSTREET FAILED: no godot (tools/godot_setup.sh on a cloud session; godot-mono on the user's machine)")
node = shutil.which("node")
shutil.rmtree(proj, ignore_errors=True)
proj.mkdir(parents=True)
r = run([node, str(ROOT / "tools/director/streetexport.mjs"), "--street", street, "--out", str(proj / "street.glb")], cwd=ROOT)
if r.returncode or not (proj / "street.glb").exists():
    sys.exit("GDSTREET FAILED: the export: " + (r.stdout + r.stderr)[-600:])
print(r.stdout.strip().splitlines()[-1])
# where the rays go, and what the street says they should hit (street-gen in node: the roads' heights, the buildings)
probe = r'''
import fs from "fs"; import { pathToFileURL } from "url";
const SG = await import(pathToFileURL(process.argv[1] + "/tools/director/street-gen.js").href);
const S = JSON.parse(fs.readFileSync(process.argv[2], "utf8")), T = SG.terrain(S), out = { rays: [], lamps: 0, insides: [], doors: [] };
const g3 = (x, y, z) => [x, z, -y];
for (const r of (S.roads || []).slice(0, 3)) { const f = SG.roadPath(r), s = f.L / 2, c = f.at(s, 0), w = f.at(s, -(f.W / 2 + f.walks[1] / 2));
  out.rays.push({ name: r.id + ":road", at: g3(c[0], c[1], c[2] + 30), want: c[2] + 0.004 });
  if (f.walks[1] > 0.3) out.rays.push({ name: r.id + ":walk", at: g3(w[0], w[1], w[2] + 30), want: w[2] + f.kerb }); }
for (const b of (S.buildings || []).filter(b => !b.inside).slice(0, 3)) { const foot = SG.footing(b, T), h = SG.buildingHeight(b); out.rays.push({ name: b.id + ":roof", at: g3(b.at[0], b.at[1], foot.z + h + 40), want: foot.z + h, tol: 0.2 }); }
// an inside's door: a ray from a metre outside it, level, toward it, must go in (the shell's hole is open); a walkway: to stand on
for (const b of (S.buildings || []).filter(b => b.inside && (b.inside.rooms || []).length).slice(0, 2)) {
  const foot = SG.footing(b, T), fr = SG.insideFrame(b.inside), ol = SG.insideOutline(fr.rooms), rows = Math.max(1, Math.round(+b.inside.rows || 1));
  const e = ol.edges.find(e => (e.holes || []).some(h => !h.window)); if (!e) continue;
  const h = e.holes.find(h => !h.window), mid = (h.a0 + h.a1) / 2, lv = e.axis === "x" ? [mid, e.v] : [e.v, mid];
  const L2 = (x, y) => { const [u, v] = fr.toLocal(x, y); return [u - fr.W * rows / 2 + fr.W / 2, v]; };
  const p0 = L2(...lv), p1 = L2(lv[0] + e.n[0], lv[1] + e.n[1]), z = foot.z + (+b.inside.raise || 0.15) + 1.0;
  const w0 = SG.place([p0[0], p0[1], z], { at: b.at, turn: b.turn }), w1 = SG.place([p1[0], p1[1], z], { at: b.at, turn: b.turn }), d = [w0[0] - w1[0], w0[1] - w1[1]];
  out.rays.push({ name: b.id + ":door", at: g3(w1[0], w1[1], w1[2]), dir: g3(d[0], d[1], 0), farther: 1.4 });
  const door = (h.door || {}).id, M = SG.insideMarkers(b, foot)[0];
  if (door && M) out.doors.push({ building: b.id, set: b.inside.set, level: b.inside.level || b.inside.set, marker: M.name, door, at: g3(w1[0], w1[1], w1[2]), dir: g3(d[0], d[1], 0) });
  const walk = (b.parts || []).find(p => p.kind === "balcony" && p.walkway);
  if (walk) { const fl = SG.insideFloors(b), zf = fl[1] ? fl[1].z0 : fl[0].z0, q = SG.place([0, -b.d / 2 - (+walk.out || 1.3) / 2, 0], { at: b.at, turn: b.turn }); out.rays.push({ name: b.id + ":walkway", at: g3(q[0], q[1], foot.z + zf + 20), want: foot.z + zf, tol: 0.05 }); }
}
const P = SG.build(S); for (const p of P) for (const L of p.lights || []) if (!L.shop) out.lamps++;
out.insides = (S.buildings || []).filter(b => b.inside).map(b => b.id);
console.log(JSON.stringify(out));
'''
r = run([node, "--input-type=module", "-e", probe, str(ROOT), str(ROOT / "Content/Studio/Streets" / street / "street.json")])
if r.returncode:
    sys.exit("GDSTREET FAILED: the expectations: " + r.stderr[-400:])
expect = json.loads(r.stdout)
(proj / "expect.json").write_text(json.dumps(expect))
(proj / "project.godot").write_text('config_version=5\n\n[application]\nconfig/name="street_check"\n')
shutil.copy(ROOT / "tools/godot/street_probe.gd", proj / "probe.gd")
run([G, "--headless", "--path", str(proj), "--import"], timeout=600)
r = run([G, "--headless", "--path", str(proj), "-s", "probe.gd"], timeout=300)
lines = [ln for ln in r.stdout.splitlines() if ln.startswith("GDPROBE")]
if not lines:
    sys.exit("GDSTREET FAILED: Godot said nothing: " + (r.stdout + r.stderr)[-600:])
counts = json.loads(next(ln for ln in lines if ln.startswith("GDPROBE counts")).split(" ", 2)[2])
cl = next(ln for ln in lines if ln.startswith("GDPROBE colours")).split()
markers = json.loads(next(ln for ln in lines if ln.startswith("GDPROBE markers")).split(" ", 2)[2])
print(f"Godot made: {counts.get('MeshInstance3D', 0)} meshes, {counts.get('StaticBody3D', 0)} static bodies, {counts.get('OccluderInstance3D', 0)} occluders, "
      f"{counts.get('OmniLight3D', 0)} lamps, {cl[2]} colours, {len(markers)} insides")
if counts.get("StaticBody3D", 0) < 1 or counts.get("CollisionShape3D", 0) < counts.get("StaticBody3D", 0):
    errs.append("no colliders came in (the -colonly meshes)")
if any(not b.get("inside") for b in json.loads((ROOT / "Content/Studio/Streets" / street / "street.json").read_text()).get("buildings", [])) and counts.get("OccluderInstance3D", 0) < 1:
    errs.append("no occluders came in (the -occonly meshes)")
if counts.get("OmniLight3D", 0) != expect["lamps"]:
    errs.append(f"{counts.get('OmniLight3D', 0)} lamps came in, the street has {expect['lamps']}")
if int(cl[2]) < 5 or int(cl[4]) > 0:
    errs.append(f"the colours didn't survive: {cl[2]} colours, {cl[4]} materials asking for vertex colours")
for want in expect["insides"]:
    if not any(m["name"].startswith("inside_" + want) and (m["meta"] or {}).get("set") for m in markers):
        errs.append(f"the inside of {want} has no marker with its set")
for ray in expect["rays"]:
    ln = next((x for x in lines if x.startswith(f"GDPROBE ray {ray['name']} ")), None)
    got = float(ln.split()[-1]) if ln else None
    if "farther" in ray:                                              # a ray through a door: it hits nothing before it's inside
        if got is None or got < ray["farther"]:
            errs.append(f"a ray through {ray['name']} stopped {got} m in: the shell closes the door")
        else:
            print(f"  a ray through {ray['name']}: nothing for {got:.2f} m (it's open)")
        continue
    if got is None or abs(got - ray["want"]) > ray.get("tol", 0.06):
        errs.append(f"a ray onto {ray['name']} landed at {got}, the street says {ray['want']:.3f}")
    else:
        print(f"  a ray onto {ray['name']}: {got:.3f} (the street: {ray['want']:.3f})")
# the door test (with a set inside): the set exported as its own Godot project (the game's export takes a set), the
# street's .glb dropped into it, the set's level put at the street's marker, a ray from outside through the doorway
if "--no-sets" not in args:
    for dt in {d["set"]: d for d in expect["doors"]}.values():
        sp = ROOT / "Saved" / "Godot" / "_check" / ("set:" + dt["set"])
        r = run([sys.executable, str(ROOT / "tools/godot_export.py"), "--check", "--game", "set:" + dt["set"]], cwd=ROOT, timeout=900)
        if "GDEXPORT ok" not in r.stdout:
            errs.append(f"the set {dt['set']} didn't export for the door test: " + (r.stdout + r.stderr)[-300:]); continue
        shutil.copy(proj / "street.glb", sp / "street_check.glb")
        (sp / "street_door.json").write_text(json.dumps(dict(dt, level=f"res://game/levels/{dt['level']}.tscn")))
        shutil.copy(ROOT / "tools/godot/street_door_probe.gd", sp / "street_door_probe.gd")
        run([G, "--headless", "--path", str(sp), "--import"], timeout=600)
        r = run([G, "--headless", "--path", str(sp), "-s", "street_door_probe.gd"], timeout=300)
        ln = next((x for x in r.stdout.splitlines() if x.startswith("GDDOOR")), "")
        for f in ("street_check.glb", "street_check.glb.import", "street_door.json", "street_door_probe.gd"):
            (sp / f).unlink(missing_ok=True)
        parts = ln.split()
        if len(parts) < 5 or parts[1] != "hit":
            errs.append(f"the door test for {dt['building']} said: {ln or (r.stdout + r.stderr)[-300:]}"); continue
        dist, who = float(parts[2]), parts[3]
        if who != dt["door"] or not 0.8 <= dist <= 1.3:
            errs.append(f"through {dt['building']}'s doorway the ray met {who} at {dist:.2f} m, not the set's door {dt['door']} (about 1 m in)")
        else:
            print(f"  the set {dt['set']} at {dt['marker']}: through the street's doorway a ray meets its door {who} {dist:.2f} m in")
for e in errs:
    print("ERROR: " + e)
print("GDSTREET ok" if not errs else f"GDSTREET FAILED ({len(errs)})")
sys.exit(1 if errs else 0)
