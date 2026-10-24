// Board games in Play (Content/Studio/BoardGames/README.md): a table's game (use: game) is a rules module that decides
// everything and says so through `ctx`: lines, choices floating at the table, and the pieces on it (dice, cards, cups,
// a ball, a revolver), small meshes made here and moved on the game's clock (runtime.anim), so the pause menu holds
// them too. The rules never touch three.js: the same module plays in node's BOARD test on a table that only pretends.
import * as THREE from "three";
import { dieMaterials, DIE_FACES, AXES } from "./physics.js";
import { rng, helpers } from "./boardgames-ctx.js";

const UP = new THREE.Vector3(0, 1, 0);
const ease = k => k * k * (3 - 2 * k), out = k => 1 - (1 - k) ** 3;

// the rules: the game's own BoardGames/<id>.js, else the studio's (the desk's server looks in both)
export const loadRules = (game, id) => import(`/boardgames/${encodeURIComponent(game || "_")}/${encodeURIComponent(id)}.js`);

// the ctx a rules module plays through (README.md has the whole list)
export function boardCtx(rt, table, meta, settings, them, on) {
  const s = Object.assign({}, meta.settings, settings), random = s.seed !== undefined ? rng(+s.seed) : Math.random;
  return Object.assign(helpers(random), {
    settings: s, you: "You", them,
    say: async (text, who) => { const secs = Math.min(4, 1.1 + String(text).length / 16); rt.hud.line(text, who === "them" ? them : "", secs); await rt.wait(secs); },
    wait: secs => rt.wait(+secs || 0),
    score: text => rt.hud.board(text),
    choose: (text, options) => rt.choose({ prompt: text, options, on }),
    table: { die: at => table.die(at), card: (c, at, up) => table.card(c, at, up), cup: (at, o) => table.cup(at, o), ball: at => table.ball(at),
             revolver: at => table.revolver(at), clear: () => table.clear() },
  });
}

// the table's top as a frame: x to the player's right, y away from them (metres from its middle), turned to the seat
export class Table {
  constructor(rt, block, yaw) {
    const g = block.geometry.parameters || {}, top = block.getWorldPosition(new THREE.Vector3());
    top.y += (g.height || 0.75) / 2;
    this.rt = rt; this.g = new THREE.Group(); this.g.position.copy(top); this.g.rotation.y = (yaw - 90) * Math.PI / 180;
    rt.stage.world.add(this.g); this.n = 0;
  }
  at([x, y], h = 0) { return new THREE.Vector3(x, h, -y); }
  add(o, at, h) { o.position.copy(this.at(at, h)); o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; } }); this.g.add(o); this.n++; return o; }
  clear() { this.g.removeFromParent(); this.g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  anim(secs, fn) { return this.rt.anim(secs, fn); }
  slide(o, to, secs = 0.35, { arc = 0, lift = 0 } = {}) {      // along the table (arc: off to the far side midway), lifted midway
    const a = o.position.clone();
    return this.anim(secs, k => { o.position.lerpVectors(a, to, ease(k)); const b = Math.sin(Math.PI * k); o.position.y += lift * b; o.position.z -= arc * b; });
  }
  sound(what) { this.rt.hud.log(`♪ ${what}`); }

  die(at) {                                          // tumbles onto a face; set() turns it there unseen (under a cup)
    const s = 0.028, m = this.add(new THREE.Mesh(new THREE.BoxGeometry(s, s, s), dieMaterials()), at, s / 2), T = this, rest = m.position.clone();
    const facing = f => new THREE.Quaternion().setFromAxisAngle(UP, Math.random() * Math.PI * 2).multiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(...AXES[DIE_FACES.indexOf(f)]), UP));
    return {
      mesh: m,
      async roll(face) {
        const q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3)), q1 = facing(face);
        T.sound("dice");
        await T.anim(0.8, k => { m.quaternion.slerpQuaternions(q0, q1, out(k)); m.position.copy(rest); m.position.y += 0.11 * (1 - k) ** 2 + 0.02 * Math.abs(Math.sin(k * Math.PI * 3)) * (1 - k); });
      },
      async set(face) { m.quaternion.copy(facing(face)); m.position.copy(rest); },
    };
  }

  card(c, at, up) {                                  // its face on +y: face down is turned over on its long side
    const m = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.063, 0.0008, 0.088), [EDGE(), EDGE(), cardFace(c), cardBack(), EDGE(), EDGE()]), at, 0.0006 + this.n * 0.0004), T = this;
    if (!up) m.rotation.z = Math.PI;
    return {
      mesh: m,
      async move(to) { await T.slide(m, T.at(to, m.position.y), 0.35, { lift: 0.03 }); },
      async flip() { const a = m.rotation.z, y0 = m.position.y; T.sound("card"); await T.anim(0.3, k => { m.rotation.z = a + Math.PI * ease(k); m.position.y = y0 + 0.035 * Math.sin(Math.PI * k); }); },
    };
  }

  cup(at, { side = false } = {}) {                   // upside down over the table (cover, lift, shake, move); `side`: lying on its side to spin
    const r0 = 0.038, r1 = 0.03, h = 0.085, mat = new THREE.MeshStandardMaterial({ color: 0x3a1e16, roughness: 0.45, side: THREE.DoubleSide });
    const inner = new THREE.Group(), body = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h, 28, 1, true), mat), base = new THREE.Mesh(new THREE.CircleGeometry(r1, 28), mat);
    base.rotation.x = -Math.PI / 2; base.position.y = h / 2; inner.add(body, base);
    const o = new THREE.Group(); o.add(inner); this.add(o, at, side ? r0 : h / 2);
    if (side) inner.rotation.x = -Math.PI / 2;        // its mouth toward the player: a spin's angle 0
    const T = this, down = o.position.y, upY = down + 0.11;
    if (!side) o.position.y = upY;                    // it starts lifted, mouth down: cover() puts it over what's under it
    return {
      mesh: o,
      async cover() { await T.anim(0.22, k => { o.position.y = upY + (down - upY) * k * k; inner.rotation.z = 0; }); T.sound("the cup comes down"); },
      async lift() { const y = o.position.y; await T.anim(0.35, k => { o.position.y = y + (upY - y) * ease(k); inner.rotation.z = 0.35 * ease(k); }); },
      async shake() { T.sound("dice rattle in the cup"); const x = o.position.x; await T.anim(0.9, k => { o.position.x = x + 0.018 * Math.sin(k * Math.PI * 14) * (1 - k * 0.3); }); o.position.x = x; },
      async move(to, { secs = 0.35, arc = 0 } = {}) { await T.slide(o, T.at(to, o.position.y), secs, { arc }); },
      async spin(deg) {                              // spins several times and stops pointing at deg (0 you, 180 them)
        const a = o.rotation.y, b = a + Math.PI * 2 * (3 + Math.floor(Math.random() * 2)) + (((deg * Math.PI / 180 - a) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        T.sound("the cup spins");
        await T.anim(2.4, k => { o.rotation.y = a + (b - a) * out(k); o.position.y = down + 0.003 * Math.abs(Math.sin(k * 40)) * (1 - k); });
      },
    };
  }

  ball(at) {
    const m = this.add(new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 12), new THREE.MeshStandardMaterial({ color: 0xe9e2d0, roughness: 0.4 })), at, 0.012), T = this;
    return { mesh: m, hide() { m.visible = false; }, show() { m.visible = true; }, place(to) { m.position.copy(T.at(to, 0.012)); } };
  }

  revolver(at) {                                     // lies on the table; spin() turns the cylinder, aim() lifts it at you or them, fire()
    const steel = new THREE.MeshStandardMaterial({ color: 0x34363a, metalness: 0.85, roughness: 0.32 }), wood = new THREE.MeshStandardMaterial({ color: 0x4a2a18, roughness: 0.55 });
    const gun = new THREE.Group(), drum = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.036, 14), steel);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 0.11, 12), steel), frame = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.028, 0.016), steel);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.075, 0.022), wood);
    drum.rotation.z = barrel.rotation.z = Math.PI / 2; barrel.position.set(0.075, 0.008, 0); frame.position.set(0.012, 0.004, 0); grip.position.set(-0.038, -0.03, 0); grip.rotation.z = -0.35;
    gun.add(drum, barrel, frame, grip);              // the muzzle along +x
    const o = new THREE.Group(); o.add(gun); this.add(o, at, 0.02);
    const T = this, rest = { p: o.position.clone(), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0.4)) };
    o.quaternion.copy(rest.q);
    const pose = (p, q, secs) => { const p0 = o.position.clone(), q0 = o.quaternion.clone(); return T.anim(secs, k => { o.position.lerpVectors(p0, p, ease(k)); o.quaternion.slerpQuaternions(q0, q, ease(k)); }); };
    return {
      mesh: o,
      async spin() { T.sound("the cylinder spins"); const a = drum.rotation.x; await T.anim(0.9, k => { drum.rotation.x = a + Math.PI * 2 * 3 * out(k); }); },
      async aim(who) {                               // in front of your eye, at your temple; or at theirs across the table
        const cam = T.rt.stage.camera, local = v => T.g.worldToLocal(cam.localToWorld(v)); cam.updateMatrixWorld();
        const head = who === "you" ? local(new THREE.Vector3(0.07, 0, 0)) : new THREE.Vector3(0, 0.45, -0.55);
        const from = who === "you" ? local(new THREE.Vector3(0.1, -0.05, -0.32)) : new THREE.Vector3(0.14, 0.45, -0.5);
        await pose(from, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), head.clone().sub(from).normalize()), 0.7);
        await T.rt.wait(0.6);
      },
      async fire(live, who) {
        const p = o.position.clone();
        if (live) {
          T.rt.hud.flash(); T.sound("BANG");
          if (who === "you") { await T.rt.fade(1, 0.2); await T.rt.wait(1.2); await T.rt.fade(0, 0.8); }
        } else T.sound("click");
        await T.anim(0.12, k => { o.position.copy(p).addScaledVector(new THREE.Vector3(-1, 0, 0).applyQuaternion(o.quaternion), 0.012 * Math.sin(Math.PI * k)); });
        await pose(rest.p, rest.q, 0.6);
      },
    };
  }
}

// the cards' faces and back, drawn once each
const TEX = new Map();
const EDGE = () => TEX.get("edge") || TEX.set("edge", new THREE.MeshStandardMaterial({ color: 0xe9e5dc, roughness: 0.7 })).get("edge");
function canvasMat(key, draw) {
  if (TEX.has(key)) return TEX.get(key);
  const c = document.createElement("canvas"); c.width = 128; c.height = 180; draw(c.getContext("2d"));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.55 }); TEX.set(key, m); return m;
}
function cardFace(c) {
  return canvasMat(`${c.rank}${c.suit}`, g => {
    g.fillStyle = "#f4f1ea"; g.fillRect(0, 0, 128, 180);
    g.fillStyle = c.suit === "♥" || c.suit === "♦" ? "#b3202a" : "#1d1d22";
    g.font = "bold 30px serif"; g.textAlign = "left"; g.textBaseline = "top"; g.fillText(c.rank, 9, 8); g.font = "26px serif"; g.fillText(c.suit, 10, 40);
    g.font = "64px serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(c.suit, 64, 100);
    g.save(); g.translate(128, 180); g.rotate(Math.PI); g.font = "bold 30px serif"; g.textAlign = "left"; g.textBaseline = "top"; g.fillText(c.rank, 9, 8); g.restore();
  });
}
function cardBack() {
  return canvasMat("back", g => {
    g.fillStyle = "#5a1218"; g.fillRect(0, 0, 128, 180); g.strokeStyle = "#e6d3b0"; g.lineWidth = 3; g.strokeRect(7, 7, 114, 166);
    g.lineWidth = 1.2; for (let i = -180; i < 180; i += 12) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 180, 180); g.moveTo(i + 180, 0); g.lineTo(i, 180); g.stroke(); }
  });
}
