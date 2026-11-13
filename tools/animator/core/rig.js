// Animator v2: a Character Studio export's skeleton, read for animating. The export's bones are MHR's by MHR's names
// (docs/ANIMATOR_V2.md §2): unturned (every rest rotation the identity), the character facing +Z, +Y up, her left
// +X, metres. A limb's skin is not on its own bone but on its twist bones, the bone's children, spread along it: a
// turn about a limb's own axis is shared out along them, so a shoulder or a wrist never wrings like a towel.
import { V, Q, M4 } from "./m.js";

export const SIDES = ["l", "r"], SGN = { l: 1, r: -1 };
const FINGERS = ["thumb", "index", "middle", "ring", "pinky"];

/** the rig of a parsed .glb (glb.js). Throws, in words a person can act on, when the file isn't a Studio export. */
export function readRig(glb) {
  const j = glb.json, par = glb.parents(), skins = j.skins || [];
  if (!skins.length) throw new Error("this file has no skeleton: the Animator wants a character exported from the Character Studio (Export for Godot)");
  const nodes = skins[0].joints.slice(), ixOf = new Map(nodes.map((n, i) => [n, i])), W = new Map();
  const world = n => { if (W.has(n)) return W.get(n); const l = glb.local(n), m = M4.trs(l.t, l.q, l.s), o = par[n] >= 0 ? M4.mul(world(par[n]), m) : m; W.set(n, o); return o; };
  const J = nodes.map((n, i) => { const sp = M4.split(world(n)); return { i, node: n, name: j.nodes[n].name || `joint${i}`, parent: ixOf.has(par[n]) ? ixOf.get(par[n]) : -1, at: sp.t, q0: sp.q, kids: [] }; });
  const order = [], seen = new Uint8Array(J.length), visit = i => { if (seen[i]) return; if (J[i].parent >= 0) visit(J[i].parent); seen[i] = 1; order.push(i); };
  J.forEach((_, i) => visit(i)); J.forEach(b => { if (b.parent >= 0) J[b.parent].kids.push(b.i); });
  const ix = new Map(J.map(b => [b.name, b.i])), need = name => { if (!ix.has(name)) throw new Error(`this file's skeleton has no bone "${name}": the Animator animates Character Studio exports (MHR's skeleton)`); return ix.get(name); };
  const at = i => J[i].at, dir = (a, b) => V.norm(V.sub(at(b), at(a))), len = (a, b) => V.dist(at(a), at(b));
  // the twist bones of a limb bone: its children named <bone>_twist<n>_proc, each with how far along the bone it sits
  const twists = (bone, end) => { const a = at(bone), d = V.sub(at(end), a), L2 = V.dot(d, d) || 1;
    return J[bone].kids.filter(k => /_twist\d*(_proc)?$/.test(J[k].name) && J[k].name.startsWith(J[bone].name)).map(k => ({ j: k, f: Math.min(1, Math.max(0, V.dot(V.sub(at(k), a), d) / L2)) })); };
  const R = { glb, J, ix, order, pelvis: need("root"), top: J.findIndex(b => b.parent < 0), spine: ["c_spine0", "c_spine1", "c_spine2", "c_spine3"].map(need), neck: need("c_neck"), head: need("c_head"), headTop: ix.get("c_head_null") ?? -1, jaw: ix.get("c_jaw") ?? -1 };
  R.chest = R.spine[3];
  for (const s of SIDES) {
    const n = b => need(`${s}_${b}`), sg = SGN[s];
    const A = { clav: n("clavicle"), up: n("uparm"), low: n("lowarm"), wtw: n("wrist_twist"), hand: n("wrist") };
    A.du0 = dir(A.up, A.low); A.df0 = dir(A.low, A.hand); A.upper = len(A.up, A.low); A.fore = len(A.low, A.hand);
    // the elbow's hinge: the axis the forearm is already bent about at rest (MHR's rest has the elbow bent some 35
    // degrees); a nearly straight arm falls back on the side-to-side axis, square to the arm
    const c = V.cross(A.du0, A.df0); A.bend0 = Math.atan2(V.len(c), V.dot(A.du0, A.df0));
    A.h0 = A.bend0 > 8 * Math.PI / 180 ? V.norm(c) : V.norm(V.perp([-1, 0, 0], A.du0));
    A.upTw = twists(A.up, A.low); A.lowTw = twists(A.low, A.hand);
    // the hand: its fingers, the palm's own normal (out of the palm) and how far the hand is turned about the
    // forearm at rest (0: the palm faces the body's middle with the arm hanging; rising as it turns to face backward)
    A.fingers = FINGERS.map(f => [0, 1, 2, 3].map(k => ix.get(`${s}_${f}${k}`)).filter(k => k != null));
    const mid = ix.get(`${s}_middle1`), idx = ix.get(`${s}_index1`), pky = ix.get(`${s}_pinky1`), tip = ix.get(`${s}_middle_null`) ?? ix.get(`${s}_middle3`);
    A.handDir = mid != null ? dir(A.hand, mid) : A.df0; A.handLen = tip != null ? len(A.hand, tip) : 0.17;
    let pn = idx != null && pky != null ? V.norm(V.cross(V.sub(at(idx), at(A.hand)), V.sub(at(pky), at(A.hand)))) : V.cross(A.df0, A.h0);
    if (sg > 0) pn = V.mul(pn, -1);                           // (index x pinky points out of the back of the left hand, out of the palm of the right)
    A.palm0 = pn; const b0 = V.cross(A.df0, A.h0);            // (b0: backward, when the arm hangs)
    A.pron0 = Math.atan2(V.dot(pn, b0), sg * V.dot(pn, A.h0));
    R[s === "l" ? "armL" : "armR"] = A;
    const L = { up: n("upleg"), low: n("lowleg"), foot: n("foot"), ball: n("ball") };
    L.dt0 = dir(L.up, L.low); L.ds0 = dir(L.low, L.foot); L.thigh = len(L.up, L.low); L.shank = len(L.low, L.foot);
    L.ht0 = V.norm(V.perp([1, 0, 0], L.dt0)); L.hs0 = V.norm(V.perp([1, 0, 0], L.ds0));     // the knee's hinge: side to side, square to the bone
    L.upTw = twists(L.up, L.low); L.lowTw = twists(L.low, L.foot);
    const fb = V.sub(at(L.ball), at(L.foot)); L.yaw0 = Math.atan2(fb[0], fb[2]);             // the foot's own toe-out at rest (about +Y, toward +X)
    L.hip = V.sub(at(L.up), at(R.pelvis));                                                  // the hip joint from the pelvis joint
    R[s === "l" ? "legL" : "legR"] = L;
  }
  R.arm = s => (s === "l" ? R.armL : R.armR); R.leg = s => (s === "l" ? R.legL : R.legR);
  const maxTurn = Math.max(...J.map(b => Q.angle(b.q0)));
  R.unturned = maxTurn < 1e-3;
  R.names = J.map(b => b.name);
  return R;
}

/** every skinned mesh of the file: { node, name, mesh, skin, prims: [{ prim, POSITION, JOINTS_0, WEIGHTS_0 }] } */
export function skinned(glb) {
  const j = glb.json, out = [];
  (j.nodes || []).forEach((n, i) => { if (n.mesh == null || n.skin == null) return;
    const prims = j.meshes[n.mesh].primitives.filter(p => p.attributes && p.attributes.JOINTS_0 != null && p.attributes.WEIGHTS_0 != null);
    if (prims.length) out.push({ node: i, name: n.name || `mesh${i}`, mesh: n.mesh, skin: n.skin, prims }); });
  return out;
}

// what a skinned part is, by its name in a Studio export: the skin, something that covers the body (a garment), or
// something the body's shape isn't read from and that soft tissue doesn't move (hair, lashes, eyes, the mouth, horns)
const NOT_COVER = /^(hair_|tie_|lashes$|lash_line$|brows$|brow_fill$|tearline_|upper-|lower-|horn_|ear_|glasses|earring|necklace|piercing|sticker|eyepatch|hat_|beret|cap_|beanie)|_eye_[LR]$/i;
export const partKind = name => /_skin$/.test(name) ? "skin" : NOT_COVER.test(name) ? "other" : "cover";
