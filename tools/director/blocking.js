// Blocking on the stage by mouse, like setting marks on a set: drag a cast member across the floor to put them on a spot
// (an existing one when you let go near it, else a new mark there, facing the player); from the free camera, drag the
// player's marker to choose where the scene is seen from; right-click for the rest (put someone here, the player stands
// here, a new mark, who the camera follows, someone off the stage). Every change is in the story's own words: the
// scene's stage and view, its camera's look, and the level's spots (props with use "spot"); nothing rides a time.
//   wireStageDrag(stage, D): D: scene() -> {sc, ver, sid, lvl} or null, story(), things(), name(cid), touch(world),
//     status(text), menu(x, y, items, head), busy() (true while the scene plays), placed(id, thing) (a new spot shown
//   at once, before the level is planned again)
import * as THREE from "three";
import { facingRot, roomAt, newSpot } from "./marks.js";

const SNAP = 0.45;                                 // metres: let go this close to a spot and it's that spot
const r2 = v => Math.round(v * 100) / 100;

export function wireStageDrag(stage, D) {
  const cv = stage.renderer.domElement;
  const tip = document.createElement("div"); tip.className = "stagetip";
  const rings = new THREE.Group(); rings.renderOrder = 5; stage.scene.add(rings);
  const ringGeo = new THREE.RingGeometry(0.17, 0.23, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x6fb3d9, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthTest: false });
  const hotMat = new THREE.MeshBasicMaterial({ color: 0xd39a45, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthTest: false });
  const showRings = (lvl, hot) => {
    rings.clear();
    if (lvl === null) return;
    for (const [id, t] of Object.entries(D.things())) if (t.use === "spot" && t.level === lvl) {
      const m = new THREE.Mesh(ringGeo, id === hot ? hotMat : ringMat); m.rotation.x = -Math.PI / 2; m.position.set(t.pos[0], (t.pos[2] || 0) + 0.02, -t.pos[1]); m.renderOrder = 5; rings.add(m);
    }
  };
  const nearest = (lvl, x, y, z) => {
    let best = null;
    for (const [id, t] of Object.entries(D.things())) {
      if (t.use !== "spot" || t.level !== lvl || Math.abs((t.pos[2] || 0) - z) > 0.6) continue;
      const d = Math.hypot(t.pos[0] - x, t.pos[1] - y); if (d < SNAP && (!best || d < best.d)) best = { id, d };
    }
    return best ? best.id : null;
  };
  const say = (e, text) => { if (!text) { tip.remove(); return; } tip.textContent = text; tip.style.left = e.clientX + 14 + "px"; tip.style.top = e.clientY + 12 + "px"; if (!tip.isConnected) document.body.append(tip); };
  const viewPos = sc => { const t = D.things()[(sc.ver.view !== undefined ? sc.ver : sc.sc).view]; return t ? t.pos : null; };
  const lookPos = sc => { const cam = (sc.ver.camera || sc.sc.camera || {}), id = cam.look, st = (sc.ver.stage || sc.sc.stage || {}); const t = D.things()[st[id] || id] || D.things()[Object.values(st)[0]]; return t ? t.pos : null; };
  // where someone (or the player) goes: the spot let go near, else a new mark there facing the player (or, for the
  // player, facing who the camera follows); null outside the rooms
  const spotFor = (sc, who, [x, y, z]) => {
    const hit = nearest(sc.lvl, x, y, z); if (hit) return { id: hit, made: false };
    const S = D.story(), level = (S.levels || {})[sc.lvl], room = roomAt(level, x, y, z); if (!room) return null;
    const rot = who === "player" ? (lookPos(sc) ? facingRot([x, y], lookPos(sc)) : ((D.things()[(sc.ver.view !== undefined ? sc.ver : sc.sc).view] || {}).yaw || 0)) : facingRot([x, y], viewPos(sc));
    const id = newSpot(S, sc.lvl, room, x, y, rot, `${room.id}_${who === "player" ? "view" : who}_spot`);
    D.placed(id, { kind: "prop", use: "spot", level: sc.lvl, room: room.id, pos: [r2(x), r2(y), (room.at || [0, 0, 0])[2] || 0], size: [0, 0, 0], yaw: rot });
    return { id, made: true };
  };
  const put = (sc, who, p) => {
    const s = spotFor(sc, who, p); if (!s) { D.status("that's outside the rooms: nothing changed"); D.touch(false); return null; }
    if (who === "player") (sc.ver.view !== undefined ? sc.ver : sc.sc).view = s.id;
    else (sc.ver.stage = sc.ver.stage || {})[who] = s.id;
    D.touch(s.made); D.status(`${who === "player" ? "the player" : D.name(who)} on ${s.id}${s.made ? " (a new mark)" : ""}`);
    return s.id;
  };
  const setLook = (sc, id) => { const tgt = sc.ver.camera ? sc.ver : sc.sc, cam = tgt.camera = tgt.camera || {}; if (id) cam.look = id; else delete cam.look; D.touch(false); D.status(id ? `the camera follows ${id}` : "the camera follows no one"); };

  cv.addEventListener("mousedown", e => {            // capture: a body grabbed is dragged, not the free camera turned
    if (e.button !== 0 || D.busy()) return;
    const sc = D.scene(); if (!sc) return;
    const hit = stage.pickAt(e.clientX, e.clientY); if (!hit || (hit.kind !== "cast" && hit.kind !== "player")) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const who = hit.kind === "cast" ? hit.id : "player", f = hit.kind === "cast" ? stage.cast[hit.id] : null;
    const z = hit.point[2], sx = e.clientX, sy = e.clientY, eyeUp = stage._me ? stage._me.position.y - stage._meRing.position.y : 1.6;
    let at = null, moved = false;
    cv.style.cursor = "grabbing";
    const move = ev => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return; moved = true;
      const p = stage.floorAt(ev.clientX, ev.clientY, z); if (!p) return;
      const snap = nearest(sc.lvl, p[0], p[1], z), t = snap ? D.things()[snap].pos : p;
      at = [p[0], p[1], z];
      if (f) f.group.position.set(t[0], z, -t[1]);
      else { stage._me.position.set(t[0], z + eyeUp, -t[1]); stage._meRing.position.set(t[0], z + 0.012, -t[1]); }
      showRings(sc.lvl, snap); stage.render();
      say(ev, `${who === "player" ? "the player" : D.name(who)} → ${snap || (roomAt((D.story().levels || {})[sc.lvl], p[0], p[1], z) ? "a new mark here" : "outside the rooms")}`);
    };
    const up = ev => {
      window.removeEventListener("mousemove", move, true); window.removeEventListener("mouseup", up, true);
      cv.style.cursor = ""; showRings(null); say(ev, null);
      if (!moved) { D.status(`drag ${who === "player" ? "the player's marker" : D.name(who)} across the floor to move them · right-click for more`); return; }
      if (at) put(sc, who, at); else D.touch(false);
    };
    window.addEventListener("mousemove", move, true); window.addEventListener("mouseup", up, true);
  }, true);
  let hoverQ = false;
  cv.addEventListener("mousemove", e => {            // a body under the mouse: it can be grabbed
    if (hoverQ || D.busy() || e.buttons) return; hoverQ = true;
    requestAnimationFrame(() => { hoverQ = false; if (!D.scene()) { cv.style.cursor = ""; return; } const h = stage.pickAt(e.clientX, e.clientY, { bodies: true }); cv.style.cursor = h && (h.kind === "cast" || h.kind === "player") ? "grab" : ""; });
  });
  cv.addEventListener("contextmenu", e => {
    const sc = D.scene(), lvl = sc ? sc.lvl : D.level ? D.level() : null; if (!lvl || D.busy()) return;
    e.preventDefault();
    const hit = stage.pickAt(e.clientX, e.clientY); if (!hit) return;
    const S = D.story(), cast = Object.keys(S.cast || {}), items = [], p = hit.point;
    const face = sc && viewPos(sc) ? viewPos(sc) : [stage.camera.position.x, -stage.camera.position.z];
    if (sc && hit.kind === "floor") {
      for (const cid of cast) items.push({ label: `Put ${D.name(cid)} here`, icon: "person", on: () => put(sc, cid, p) });
      items.push({ label: "The player stands here", icon: "eye", on: () => put(sc, "player", p) }, "-",
        { label: "A new mark here", icon: "plus", hint: "a spot to put someone on later", on: () => { const room = roomAt((S.levels || {})[sc.lvl], p[0], p[1], p[2]); if (!room) { D.status("that's outside the rooms"); return; } const id = newSpot(S, sc.lvl, room, p[0], p[1], facingRot([p[0], p[1]], viewPos(sc)), `${room.id}_mark`); D.placed(id, { kind: "prop", use: "spot", level: sc.lvl, room: room.id, pos: [r2(p[0]), r2(p[1]), (room.at || [0, 0, 0])[2] || 0], size: [0, 0, 0], yaw: facingRot([p[0], p[1]], viewPos(sc)) }); D.touch(true); D.status("a new mark: " + id); } });
    }
    if (sc && hit.kind === "cast") {
      const nm = D.name(hit.id);
      items.push({ label: `The camera follows ${nm}`, icon: "eye", on: () => setLook(sc, hit.id) },
        { label: `Take ${nm} off the stage`, icon: "x", on: () => { if (sc.ver.stage) delete sc.ver.stage[hit.id]; D.touch(false); D.status(`${nm} is off the stage`); } });
    }
    if (hit.kind === "thing") {
      const t = D.things()[hit.id], v = sc ? viewPos(sc) : null;
      if (sc) items.push({ label: `The camera follows ${hit.id}`, icon: "eye", on: () => setLook(sc, hit.id) });
      if (t && v) {                                   // beside it, on the player's side
        const dx = v[0] - t.pos[0], dy = v[1] - t.pos[1], l = Math.hypot(dx, dy) || 1, k = Math.max((t.size || [0, 0])[0], (t.size || [0, 0])[1]) / 2 + 0.45;
        const b = [t.pos[0] + dx / l * k, t.pos[1] + dy / l * k, v[2]];
        for (const cid of cast) items.push({ label: `Put ${D.name(cid)} beside it`, icon: "person", on: () => put(sc, cid, b) });
      }
      const L = t && t.life && D.lives ? (D.lives().lives || {})[t.life] : null;     // a little thing: the state it starts in
      if (L) { if (items.length) items.push("-"); for (const s of L.states) items.push({ label: `It starts ${s.id}${(t.state || L.states[0].id) === s.id ? "  ✓" : ""}`, icon: "life", on: () => D.setStart(hit.id, s.id) }); }
    }
    if ((hit.kind === "floor" || hit.kind === "thing") && D.addThing) {
      if (items.length) items.push("-");
      items.push({ label: "Add a little thing here…", icon: "life", hint: "a kettle, a cup of tea, an ashtray with a cigarette burning, a phone: alive (docs/IMMERSION.md)", on: () => D.addThing(lvl, p, hit, e, face) });
    }
    if (sc && hit.kind === "player") items.push({ label: "The camera follows no one", icon: "eye", on: () => setLook(sc, null) });
    if (items.length) D.menu(e.clientX, e.clientY, items, hit.kind === "floor" ? "the floor here" : hit.kind === "cast" ? D.name(hit.id) : hit.kind === "player" ? "the player" : hit.id);
  });
}
