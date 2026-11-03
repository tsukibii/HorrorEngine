// Faces in Play (STORY_FORMAT §4 `expr`, DECISIONS 2026-11-01): an expression from the library on a cast member's face,
// as the Godot runtime's face.gd plays it: what she rests in (a loop running; none: at rest) and what plays over it (a
// capture once, faded in and out, then gone; a loop until another takes over), the newest taking over from the one
// before over its fade in. Sampled by face.js and worn by her figure (the stage's faceOn: MHR's morphs or a Studio
// export's skin); a scene's own face rows win where they have her (stage.js apply).
import { register } from "./parts.js";
import * as FACE from "../../shared/face.js";
import { FACES, loadFaces } from "../stage.js";

const smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
const loops = (l, e) => l.rest || (l.loop ?? !!e.loop);

export class Faces {
  constructor(rt) { this.rt = rt; this.people = {}; }
  // `id` on who's face (o: rest, loop, w, in, out); an empty id: what plays over her fades out (rest: her rest goes)
  play(who, id, o = {}) {
    const p = this.people[who] = this.people[who] || { rest: [], over: [], on: false };
    const list = o.rest ? p.rest : p.over, fin = Math.max(0, +(o.in ?? 0.25));
    for (const l of list) if (!l.going) { const f = Math.max(0.05, id ? fin : +(o.out ?? 0.3)); l.going = true; l.end = Math.min(l.end, l.age + f); l.fout = f; }
    if (!id) return;
    loadFaces([{ expr: id }]);                        // fetched once, sampled once it's there
    list.push({ id, age: 0, w: Math.max(0, Math.min(2, +(o.w ?? 1))), fin, fout: Math.max(0, +(o.out ?? 0.3)), end: Infinity, loop: o.loop, rest: !!o.rest, going: false, sized: false });
  }
  env(l) {
    const ein = l.fin > 0 ? l.age / l.fin : 1, eout = l.fout > 0 && isFinite(l.end) ? (l.end - l.age) / l.fout : 1;
    return smooth(Math.min(ein, eout));
  }
  // a set of layers' ARKit scores summed into acc, scaled by k; their envelopes' sum (at most 1)
  mix(list, acc, k) {
    const envs = list.map(l => this.env(l)), sum = envs.reduce((a, b) => a + b, 0), norm = sum > 1 ? 1 / sum : 1;
    list.forEach((l, i) => {
      const e = FACES.lib[l.id], wt = envs[i] * norm * k * l.w; if (!e || wt <= 0) return;
      const sc = FACE.sample(e, l.age, { loop: loops(l, e) }); for (const n in sc) acc[n] = (acc[n] || 0) + sc[n] * wt;
    });
    return Math.min(sum, 1);
  }
  tick(dt) {
    for (const [who, p] of Object.entries(this.people)) {
      for (const key of ["rest", "over"]) p[key] = p[key].filter(l => {
        l.age += dt; const e = FACES.lib[l.id];
        if (e && !l.sized) { l.sized = true; if (!loops(l, e)) l.end = Math.min(l.end, FACE.lengthOf(e)); }   // a capture plays its own length
        return l.age < l.end;
      });
      const f = this.rt.stage.cast[who]; if (!f || !FACES.M) continue;
      const acc = {}, over = this.mix(p.over, acc, 1); this.mix(p.rest, acc, 1 - over);
      const w72 = Object.keys(acc).length ? FACE.toMHR(acc, FACES.M) : null;
      f._playFace = w72;
      if (w72 || p.on) this.rt.stage.faceOn(f, w72);
      p.on = !!w72;
    }
  }
  state(who) {                                        // for the checks: what she rests in, what plays over it
    const p = this.people[who]; if (!p) return { rest: "", over: "" };
    const live = l => l.filter(x => !x.going);
    return { rest: (live(p.rest).at(-1) || {}).id || "", over: (live(p.over).at(-1) || {}).id || "" };
  }
}

register("action", "expr", { run: (v, a, rt) => { (rt.faces = rt.faces || new Faces(rt)).play(a.who, v, a); } });
