// Node's side of the hair editor v2.0: bodies to grow hair on (MHR as the Character Studio makes it: the base, the
// tailor's test bodies, children, creatures), the pores' file, and a head's skin as a mesh for a picture.
import { readFileSync } from "fs";
import { join } from "path";
import { loadMhr, mhrBody, grownBody, namedBody, ROOT } from "../tailor/node.mjs";
import { MONSTERS, V2FEMALE, BODYV2, HEADS, LIPS } from "../grow.js";
import { localBody } from "./body.js";
import { readPores } from "./pores.js";

export { ROOT };
export const PORES_FILE = join(ROOT, "Content", "Studio", "Hair2", "pores.bin");
let MHR = null;
export const mhr = () => MHR || (MHR = loadMhr());

// a body by name: base (MHR's own, 1.70 m), fem, masc, v2female (grow.js V2FEMALE: the proportions of the user's own
// Daz3D characters, what their hair pictures are matched on), v2base (the same head on the feminine base's plain body),
// bodyv2, child8, child12, teen15,
// a creature (goblin, ogre...), or one of the tailor's (tailor/bodies.json)
export function bodyByName(name = "base") {
  const m = mhr();
  const made = name === "base" ? mhrBody(m, [], 1.7)
    : name === "fem" ? grownBody(m, { base: -1 })
    : name === "masc" ? grownBody(m, { base: 1 })
    : name === "v2female" || name === "doll" ? grownBody(m, { base: -1, ...V2FEMALE })
    : name === "v2base" ? grownBody(m, { base: -1, v2: 1, height: 1.62 })                                   // (the Studio's v2female base as its button gives it: that head and neck on the feminine base's own body, no bust added; what the women's styles' cards are pictured on)
    : name === "bodyv2" ? grownBody(m, { base: -1, ...BODYV2 })                                              // (v2female's head on the bodyv2 body: the user's T-pose reference)
    : name.startsWith("head:") ? grownBody(m, { base: -1, head: name.slice(5), body: "bodyv2", height: 1.63, sculpt: (LIPS[(HEADS[name.slice(5)] || {}).lips] || {}).sculpt || {} })  // (a head card on the bodyv2 body with the card's lip shape, as a new character has it: head:v2fox, head:v2pixie... what a head's own hairstyle is matched on; the lids' shape is the page's alone)
    : /^child(\d+)$/.test(name) ? grownBody(m, { age: +name.slice(5), base: -0.3 })
    : /^teen(\d+)$/.test(name) ? grownBody(m, { age: +name.slice(4), base: 0.3 })
    : MONSTERS[name] ? grownBody(m, { base: MONSTERS[name].base, height: MONSTERS[name].height, monster: true, sculpt: MONSTERS[name].sculpt })   // a creature (grow.js: goblin, ogre...)
    : namedBody(m, name, 1.7);
  return Object.assign(localBody(made.P, m.T), { name, P: made.P });
}
// a character's own body (People/<name>/body.bin: the Studio's neutral body, 3 floats a point)
export function bodyFromFile(file) {
  const b = readFileSync(file), P = new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  if (P.length !== mhr().T.reduce((a, v) => Math.max(a, v), 0) * 3 + 3) throw new Error(`${file} isn't a body of MHR's (${P.length / 3} points)`);
  return Object.assign(localBody(P, mhr().T), { name: file, P });
}
export function loadPores(file = PORES_FILE) { const b = readFileSync(file); return readPores(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); }

// the head, neck, shoulders and chest of a body as a mesh of its own (local metres): what a picture shows under the hair
export function headSkin(body, low = -0.44, wide = 0.34) {
  const { L, T, VN } = body, map = new Int32Array(L.length / 3).fill(-1), pos = [], nrm = [], idx = [];
  const ok = i => L[i * 3 + 1] > low && Math.abs(L[i * 3]) < wide;
  for (let t = 0; t < T.length; t += 3) {
    if (!ok(T[t]) || !ok(T[t + 1]) || !ok(T[t + 2])) continue;
    for (let k = 0; k < 3; k++) { const v = T[t + k]; if (map[v] < 0) { map[v] = pos.length / 3; pos.push(L[v * 3], L[v * 3 + 1], L[v * 3 + 2]); nrm.push(VN[v * 3], VN[v * 3 + 1], VN[v * 3 + 2]); } idx.push(map[v]); }
  }
  return { position: new Float32Array(pos), normal: new Float32Array(nrm), index: new Uint32Array(idx) };
}
