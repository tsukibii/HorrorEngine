"""Kimodo motions into Unreal (docs/ANIMATION.md §1b): FBX on Kimodo's own SOMA skeleton, retargeted to MetaHuman there.

    python tools/retarget.py setup [--home DIR]          Blender's Python module (bpy 4.2, Python 3.11) with uv, all under
                                                         DIR (default vendor/blender); no Blender install needed
    python tools/retarget.py --game G fbx [job]          Saved/Story/G/motion/<job>.npz -> <job>.bvh (Kimodo's kimodo_convert,
                                                         standard T-pose) -> fbx/<job>.fbx (the SOMA armature and its action),
                                                         plus fbx/SK_SOMA.fbx once (Kimodo's skinned SOMA body: Unreal makes its
                                                         Skeleton from a mesh); then the round-trip check on each
    python tools/retarget.py --game G check [job]        the round trip alone: each FBX read back, every joint at four frames
                                                         against the NPZ's own forward kinematics (cm)
    python tools/retarget.py --game G unreal [--cast C ...] [--body /Game/...]
                                                         writes Saved/Story/G/retarget_unreal.py for the editor: imports
                                                         SK_SOMA and the motions, an IK Rig for SOMA, a retargeter to
                                                         MetaHuman, and the batch retarget onto each rigged MetaHuman's
                                                         body (every cast member with a `metahuman`, or --body for one
                                                         already in the project)

The FBX side is tested: 0.00 cm on all 77 joints at every frame checked, centimetres (UnitScaleFactor 1, Unreal's own
kind), the travel on the hips kept; SK_SOMA is Kimodo's skinned body put in the motions' T-pose by Kimodo's own
skinning (its joints 0.00 cm from the rest pose) and deforms cleanly through a walk. The Unreal script is not tested
(no editor here): its VERIFY lines are the first run's job (SETUP S12).
"""
import argparse
import json
import os
import struct
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
sys.path.insert(0, str(ROOT / "Content" / "Python"))
ENV_FILE = ROOT / "setup" / "env.json"
BPY = "bpy==4.2.0"                       # its wheels are built for Python 3.11, the same as Kimodo's environment

# ---- Blender's side (run with the bpy environment's Python) --------------------------------------------------------
BVH2FBX = r'''
import bpy, sys
src, dst = sys.argv[-2], sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
# Kimodo's BVH is in centimetres, Y up: kept as centimetres (a scene unit of 0.01 m), so the FBX is Unreal's own
# kind (UnitScaleFactor 1, centimetre values) and no scale lands on the root bone
bpy.context.scene.unit_settings.scale_length = 0.01
bpy.ops.import_anim.bvh(filepath=src, global_scale=1.0, frame_start=1, use_fps_scale=False, update_scene_fps=True,
                        update_scene_duration=True, rotate_mode='NATIVE', axis_forward='-Z', axis_up='Y')
arm = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE'][0]
arm.name = arm.data.name = 'SOMA'
act = arm.animation_data.action; f0, f1 = (int(round(v)) for v in act.frame_range)
bpy.context.scene.frame_start, bpy.context.scene.frame_end = f0, f1   # the BVH's own length (the scene keeps 250 otherwise)
act.name = bpy.path.display_name_from_filepath(dst)
bpy.ops.object.select_all(action='DESELECT'); arm.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.fbx(filepath=dst, use_selection=True, object_types={'ARMATURE'}, add_leaf_bones=False,
                         bake_anim=True, bake_anim_use_all_actions=False, bake_anim_use_nla_strips=False,
                         bake_anim_force_startend_keying=True, bake_anim_simplify_factor=0.0, armature_nodetype='NULL',
                         primary_bone_axis='Y', secondary_bone_axis='X', axis_forward='-Z', axis_up='Y',
                         apply_unit_scale=True, apply_scale_options='FBX_SCALE_NONE', global_scale=1.0)
print('FBX', dst, len(arm.data.bones), 'bones', f1 - f0 + 1, 'frames')
'''

# Kimodo's environment: its skin is bound in an A-pose, its motions are relative to its standard T-pose (the BVH's
# rest); Kimodo's own LBS (viz/soma_skin.py) with identity local rotations puts the mesh in that T-pose
TPOSE = r'''
import sys, numpy as np, torch
from pathlib import Path
import kimodo, kimodo.skeleton as KS
folder = Path(kimodo.__file__).parent / "assets" / "skeletons" / "somaskel77"
sk = KS.SOMASkeleton77(folder); J = sk.nbjoints
pos, glob = KS.batch_rigid_transform(torch.eye(3)[None, None].repeat(1, J, 1, 1), sk.neutral_joints[None], sk.joint_parents, sk.root_idx)
fk = np.tile(np.eye(4, dtype=np.float32), (J, 1, 1)); fk[:, :3, :3] = glob[0].numpy(); fk[:, :3, 3] = pos[0].numpy()
d = np.load(folder / "skin_standard.npz")
A = (fk @ np.linalg.inv(d["bind_rig_transform"]))[:, :3, :]
V = np.einsum("vwij,vj->vwi", A[d["lbs_indices"]], np.concatenate([d["bind_vertices"], np.ones((len(d["bind_vertices"]), 1))], 1))
V = (V * d["lbs_weights"][..., None]).sum(1)
np.savez(sys.argv[-1], vertices=V.astype(np.float32), joints=pos[0].numpy(), faces=d["faces"], lbs_indices=d["lbs_indices"],
         lbs_weights=d["lbs_weights"], names=np.array([str(n) for n in d["rig_joint_names"]]))
print("TPOSE", sys.argv[-1], len(V), "vertices")
'''

SKIN2FBX = r'''
import bpy, sys, numpy as np
bvh, skin, dst = sys.argv[-3], sys.argv[-2], sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.unit_settings.scale_length = 0.01
bpy.ops.import_anim.bvh(filepath=bvh, global_scale=1.0, frame_start=1, use_fps_scale=False, rotate_mode='NATIVE', axis_forward='-Z', axis_up='Y')
arm = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE'][0]
arm.name = arm.data.name = 'SOMA'
arm.animation_data_clear()                                            # the rest pose only: this file makes the Skeleton
d = np.load(skin)
names = [str(n) for n in d['names']]
heads = {b.name: arm.matrix_world @ b.head_local for b in arm.data.bones}
# the T-posed mesh is in metres about the hips, Y up: centimetres, Blender's Z up, moved onto the armature's hips
J = d['joints'] * 100.0; h = heads['Hips']; off = (h.x - J[0][0], h.y + J[0][2], h.z - J[0][1])
verts = [(float(x) * 100 + off[0], float(-z) * 100 + off[1], float(y) * 100 + off[2]) for x, y, z in d['vertices']]
gap = max(((heads[n].x - J[i][0] - off[0]) ** 2 + (heads[n].y + J[i][2] - off[1]) ** 2 + (heads[n].z - J[i][1] - off[2]) ** 2) ** 0.5 for i, n in enumerate(names) if n in heads)
me = bpy.data.meshes.new('SK_SOMA'); me.from_pydata(verts, [], [tuple(int(i) for i in f) for f in d['faces']]); me.update()
ob = bpy.data.objects.new('SK_SOMA', me); bpy.context.scene.collection.objects.link(ob)
groups = {n: ob.vertex_groups.new(name=n) for n in names}
I, W = d['lbs_indices'], d['lbs_weights']
for v in range(len(verts)):
    for k in range(I.shape[1]):
        w = float(W[v, k])
        if w > 1e-5: groups[names[int(I[v, k])]].add([v], w, 'ADD')
ob.parent = arm; mod = ob.modifiers.new('Armature', 'ARMATURE'); mod.object = arm
bpy.ops.object.select_all(action='DESELECT'); arm.select_set(True); ob.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.fbx(filepath=dst, use_selection=True, object_types={'ARMATURE', 'MESH'}, add_leaf_bones=False, bake_anim=False,
                         armature_nodetype='NULL', primary_bone_axis='Y', secondary_bone_axis='X', axis_forward='-Z', axis_up='Y',
                         apply_unit_scale=True, apply_scale_options='FBX_SCALE_NONE', global_scale=1.0, mesh_smooth_type='FACE')
print(f'SKIN {dst} {len(verts)} vertices, {len(names)} joints; T-posed mesh joints vs the rest pose {gap:.2f} cm')
'''

CHECK = r'''
import bpy, sys, json, numpy as np
fbx, npz, soma = sys.argv[-3], sys.argv[-2], sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=fbx, automatic_bone_orientation=False, ignore_leaf_bones=False)
arm = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE'][0]
# Blender joins bones on FBX import, and a connected bone can't translate: disconnect them (Unreal has no such rule)
bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='EDIT')
for b in arm.data.edit_bones: b.use_connect = False
bpy.ops.object.mode_set(mode='OBJECT')
P = np.load(npz)['posed_joints']; names = json.load(open(soma))['names']
act = arm.animation_data.action; f0 = int(act.frame_range[0]); n = int(act.frame_range[1] - act.frame_range[0] + 1)
worst, unit = 0.0, None
for f in sorted({0, n // 3, 2 * n // 3, n - 1}):
    bpy.context.scene.frame_set(f0 + f)
    got = np.array([list(arm.matrix_world @ arm.pose.bones[j].head) for j in names])
    want = np.stack([P[f][:, 0], -P[f][:, 2], P[f][:, 1]], 1)
    if unit is None:
        a, b = names.index('HeadEnd'), names.index('LeftFoot')
        unit = np.linalg.norm(got[a] - got[b]) / np.linalg.norm(want[a] - want[b])
    worst = max(worst, float(np.linalg.norm(got / unit - want, axis=1).max()))
print(f"CHECK {n} frames (the NPZ has {len(P)}); worst joint {worst * 100:.2f} cm; Blender units per metre {unit:.3f}")
'''


def fbx_unit_scale(path):
    """the FBX header's UnitScaleFactor (cm per file unit: 1 = centimetres, Unreal's)"""
    data = Path(path).read_bytes()
    i = data.find(b"UnitScaleFactor")
    if i < 0:
        return None
    j = data.find(b"D", i + 15, i + 80)          # the value's type code after the property's type strings
    while j > 0 and j < i + 120:
        try:
            v = struct.unpack("<d", data[j + 1:j + 9])[0]
            if 1e-4 < v < 1e4:
                return v
        except struct.error:
            return None
        j = data.find(b"D", j + 1, i + 120)
    return None


def env():
    return json.loads(ENV_FILE.read_text(encoding="utf-8")) if ENV_FILE.exists() else {}


def blender_home(a=None):
    h = getattr(a, "home", None) or (env().get("blender") or {}).get("home")
    return Path(h) if h else ROOT / "vendor" / "blender"


def bpy_python(home):
    exe = home / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    if not exe.exists():
        sys.exit(f"no Blender module at {home}: python tools/retarget.py setup")
    return exe


def run_bpy(home, script, *args):
    r = subprocess.run([str(bpy_python(home)), "-c", script, "--", *map(str, args)], capture_output=True, text=True, encoding="utf-8", errors="replace")
    lines = [ln for ln in r.stdout.splitlines() if ln.startswith(("FBX ", "SKIN ", "CHECK "))]
    if r.returncode or not lines:
        sys.stderr.write(r.stdout[-1500:] + r.stderr[-1500:])
        sys.exit("Blender's step failed")
    return lines[-1]


def cmd_setup(a):
    home = blender_home(a); home.mkdir(parents=True, exist_ok=True)
    e = dict(os.environ, UV_CACHE_DIR=str(home / "cache" / "uv"), UV_PYTHON_INSTALL_DIR=str(home / "cache" / "python"))
    subprocess.run(["uv", "venv", "-p", "3.11", str(home / ".venv")], env=e, check=True)
    subprocess.run(["uv", "pip", "install", "-p", str(bpy_python(home)), BPY], env=e, check=True)
    cfg = env(); cfg["blender"] = {"home": str(home)}
    ENV_FILE.write_text(json.dumps(cfg, indent=2), encoding="utf-8")
    print(f"Blender's module at {home} (GPL: a tool we run, nothing of it ships)")
    print("RETARGET ok")


def motion_dir(game):
    return ROOT / "Saved" / "Story" / game / "motion"


def jobs_of(a):
    d = motion_dir(a.game)
    npz = sorted(d.glob("*.npz"))
    if a.job:
        npz = [p for p in npz if p.stem == a.job]
    if not npz:
        sys.exit(f"no motions in {d.relative_to(ROOT)}: python tools/motion.py --game {a.game} run")
    return npz


def kimodo_convert(npz, bvh):
    import kimodo as K
    home, k = K.settings()
    p = K.paths(home)
    exe = p["bin"] / ("kimodo_convert.exe" if os.name == "nt" else "kimodo_convert")
    if not exe.exists():
        sys.exit(f"no kimodo_convert in {p['bin']}: python setup/setup.py kimodo")
    if K.run_in(home, k, [str(exe), str(npz), str(bvh), "--bvh_standard_tpose"]) != 0 or not Path(bvh).exists():
        sys.exit(f"kimodo_convert failed on {npz.name}")


def tpose_skin(dst):
    """Kimodo's skinned SOMA body in its standard T-pose (TPOSE, in Kimodo's environment) -> dst (.npz)"""
    import kimodo as K
    home, k = K.settings()
    if K.run_in(home, k, [str(K.paths(home)["python"]), "-c", TPOSE, "--", str(dst)]) != 0 or not Path(dst).exists():
        return None
    return dst


def cmd_fbx(a):
    home = blender_home(a); out = motion_dir(a.game) / "fbx"; out.mkdir(parents=True, exist_ok=True)
    first_bvh = None
    for npz in jobs_of(a):
        bvh = out / f"{npz.stem}.bvh"; fbx = out / f"{npz.stem}.fbx"
        kimodo_convert(npz, bvh); first_bvh = first_bvh or bvh
        print(run_bpy(home, BVH2FBX, bvh, fbx), f"(unit scale {fbx_unit_scale(fbx)})")
        print(run_bpy(home, CHECK, fbx, npz, ROOT / "Content" / "Studio" / "soma77.json"))
    sk = out / "SK_SOMA.fbx"
    if first_bvh and not sk.exists():
        skin = tpose_skin(out / "soma_tpose.npz")
        if skin:
            print(run_bpy(home, SKIN2FBX, first_bvh, skin, sk))
        else:
            print("Kimodo's skin couldn't be posed: Unreal needs a mesh to make the Skeleton (import any SOMA mesh first)")
    print("RETARGET ok")


def cmd_check(a):
    home = blender_home(a); out = motion_dir(a.game) / "fbx"
    for npz in jobs_of(a):
        fbx = out / f"{npz.stem}.fbx"
        if not fbx.exists():
            sys.exit(f"no {fbx.relative_to(ROOT)}: retarget.py fbx first")
        print(npz.stem, run_bpy(home, CHECK, fbx, npz, ROOT / "Content" / "Studio" / "soma77.json"))
    print("RETARGET ok")


UNREAL = r'''# generated by tools/retarget.py for {game!r}: Kimodo's motions (SOMA skeleton) onto a MetaHuman body, by IK Retargeter.
# UNTESTED against an editor: the lines marked VERIFY are the first run's job (SETUP S12); then this is a tool.
import unreal, os
GAME = {game!r}
BODIES = {bodies!r}                                # cast id -> that MetaHuman's body skeletal mesh (VERIFY the paths)
FBX_DIR = r"{fbx_dir}"
STUDIO = "/Game/Studio/Kimodo"                     # shared by every game: the SOMA mesh, its IK Rig, the retargeter
OUT_SOMA = "/Game/Games/%s/Motion/Kimodo" % GAME   # the motions as they came (on SOMA)
OUT_MH = "/Game/Games/%s/Motion/MetaHuman" % GAME  # the same, retargeted
MH_IKRIG = {mh_ikrig!r}                            # Epic's MetaHuman IK Rig (VERIFY: where your MetaHuman plugin keeps IK_Metahuman)
tools = unreal.AssetToolsHelpers.get_asset_tools(); eal = unreal.EditorAssetLibrary

def fbx_task(path, dest, skeleton=None):
    o = unreal.FbxImportUI()
    o.import_mesh = skeleton is None; o.import_as_skeletal = True; o.import_animations = skeleton is not None; o.import_materials = False; o.import_textures = False
    o.mesh_type_to_import = unreal.FBXImportType.FBXIT_SKELETAL_MESH if skeleton is None else unreal.FBXImportType.FBXIT_ANIMATION
    if skeleton: o.skeleton = skeleton
    o.anim_sequence_import_data.import_translation = unreal.Vector(0, 0, 0)
    o.anim_sequence_import_data.animation_length = unreal.FBXAnimationLengthImportType.FBXALIT_EXPORTED_TIME
    o.anim_sequence_import_data.remove_redundant_keys = False      # Kimodo's 30 fps, as generated
    t = unreal.AssetImportTask(); t.filename = path; t.destination_path = dest; t.automated = True; t.replace_existing = True; t.save = True; t.options = o
    return t

# 1. the SOMA mesh (once): Unreal makes the Skeleton from it
mesh_path = STUDIO + "/SK_SOMA"
if not eal.does_asset_exist(mesh_path):
    tools.import_asset_tasks([fbx_task(os.path.join(FBX_DIR, "SK_SOMA.fbx"), STUDIO)])
soma_mesh = eal.load_asset(mesh_path); soma_skel = soma_mesh.skeleton

# 2. the motions, onto that Skeleton
anims = []
for f in sorted(os.listdir(FBX_DIR)):
    if f.endswith(".fbx") and f != "SK_SOMA.fbx":
        tools.import_asset_tasks([fbx_task(os.path.join(FBX_DIR, f), OUT_SOMA, soma_skel)])
        a = eal.load_asset("%s/%s" % (OUT_SOMA, f[:-4]))
        if a: anims.append(a)
unreal.log("imported %d motions on SOMA" % len(anims))

# 3. an IK Rig for SOMA (once): the retarget chains worked out by the editor (a humanoid: spine, neck, head, arms, legs, fingers)
rig_path = STUDIO + "/IK_SOMA"
if not eal.does_asset_exist(rig_path):
    rig = tools.create_asset("IK_SOMA", STUDIO, unreal.IKRigDefinition, unreal.IKRigDefinitionFactory())
    c = unreal.IKRigController.get_controller(rig)
    c.set_skeletal_mesh(soma_mesh)
    c.apply_auto_generated_retarget_definition()  # VERIFY: the chains it made (Hips as the retarget root; LeftLeg is SOMA's thigh, LeftShin its calf)
    c.apply_auto_fbik()                           # IK goals on hands and feet: the retargeter can plant the feet
    eal.save_asset(rig_path)
soma_rig = eal.load_asset(rig_path)

# 4. the retargeter (once): SOMA -> MetaHuman, chains mapped by the editor, poses aligned
rtg_path = STUDIO + "/RTG_SOMA_to_MetaHuman"
if not eal.does_asset_exist(rtg_path):
    rtg = tools.create_asset("RTG_SOMA_to_MetaHuman", STUDIO, unreal.IKRetargeter, unreal.IKRetargetFactory())
    rc = unreal.IKRetargeterController.get_controller(rtg)
    rc.set_ik_rig(unreal.RetargetSourceOrTarget.SOURCE, soma_rig)
    rc.set_ik_rig(unreal.RetargetSourceOrTarget.TARGET, eal.load_asset(MH_IKRIG))
    rc.auto_map_chains(unreal.AutoMapChainType.FUZZY, True)          # VERIFY: names in 5.8 (the retargeter became an op stack in 5.6)
    rc.auto_align_all_bones(unreal.RetargetSourceOrTarget.SOURCE)    # SOMA's T-pose to MetaHuman's A-pose: VERIFY
    eal.save_asset(rtg_path)
rtg = eal.load_asset(rtg_path)

# 5. every motion onto each rigged MetaHuman's body. MetaHumans share one body skeleton, so any of them can play any
# result; one per body keeps the feet and hands right for that body's proportions
for cid, body_path in BODIES.items():
    body = eal.load_asset(body_path) if body_path else None
    if not body or not anims:
        unreal.log_warning("%s: no body at %r (cast.%s.metahuman, or --body)" % (cid, body_path, cid)); continue
    out = unreal.IKRetargetBatchOperation.duplicate_and_retarget(anims, soma_mesh, body, rtg, "", "", "", "_" + cid)   # VERIFY: deprecated for RunBatchRetarget in 5.8
    for o in out:
        eal.rename_asset(o.get_path_name().split(".")[0], "%s/%s/%s" % (OUT_MH, cid, o.get_name()))
    unreal.log("retargeted %d motions onto %s (%s)" % (len(out), body_path, cid))
if not BODIES:
    unreal.log_warning("no MetaHuman bodies: the motions are imported on SOMA only")
'''


def cmd_unreal(a):
    from storykit import storylib as L
    story, _ = L.load(a.game)
    cast = story.get("cast", {})
    cids = a.cast or [c for c in cast if (cast[c] or {}).get("metahuman")]
    bodies = {}
    for cid in cids:
        mh = (cast.get(cid) or {}).get("metahuman") or ""
        bodies[cid] = a.body or ((mh.rsplit("/", 1)[0] + "/Body/SKM_Body") if mh else "")   # VERIFY: the assembled body's name
    if a.body and not cids:
        bodies["metahuman"] = a.body
    out = ROOT / "Saved" / "Story" / a.game / "retarget_unreal.py"; out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(UNREAL.format(game=a.game, bodies=bodies, fbx_dir=str(motion_dir(a.game) / "fbx"),
                                 mh_ikrig="/MetaHuman/IK/IK_Metahuman"), encoding="utf-8")
    print(f"wrote {out.relative_to(ROOT)} (bodies {bodies or 'none yet'}); run it in the editor (UnrealClaude: unreal_execute_script)")
    print("RETARGET ok")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--game"); ap.add_argument("--home")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("setup")
    for name in ("fbx", "check"):
        p = sub.add_parser(name); p.add_argument("job", nargs="?")
    u = sub.add_parser("unreal"); u.add_argument("--cast", nargs="*"); u.add_argument("--body")
    a = ap.parse_args(argv)
    if a.cmd != "setup" and not a.game:
        sys.exit("--game is needed")
    {"setup": cmd_setup, "fbx": cmd_fbx, "check": cmd_check, "unreal": cmd_unreal}[a.cmd](a)


if __name__ == "__main__":
    main()
