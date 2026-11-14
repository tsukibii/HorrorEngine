// Animator v2: the page (docs/ANIMATOR_V2.md §9). A character's preview (its file with its soft bones, no clips) shown
// in 3D; the clip on show made here, by the very code the bake runs, each time a slider moves; Bake sends the sliders
// to the server, which writes every clip into the character's file.
import * as THREE from "three";
import { GLTFLoader } from "/vendor/GLTFLoader.js";
import { parseGlb } from "/core/glb.js";
import { attach, makers, makeClip, settingsFor, DEFAULTS, VERSION } from "/core/animate.js";
import { summary } from "/core/measure.js";
import { params } from "/core/gait.js";
import { furniture } from "/core/acts.js";

const $ = s => document.querySelector(s), status = (t, c = "") => { $("#status").textContent = t; $("#status").className = "status " + c; };
const KIND_LABEL = { idle: "Idle", walk: "Walk", run: "Run", sit: "Sit", sleep: "Sleep", open: "Open a door", reach: "Reach",
  sneak: "Sneak", crawl: "Crawl", creature: "Creature", peek: "Peek", scare: "Scare", fight: "Fight", eat: "Eat & drink", acting: "Acting" };   // (the second row: animations v3, docs/ANIMATOR_V3.md)
const CLIP_LABEL = { idle_loop: "standing", walk_loop: "walking", run_loop: "running", sit_down: "sit down", sit_loop: "sitting", stand_up: "stand up", lie_down: "lie down", sleep_loop: "asleep", get_up: "get up",
  lie_down_r: "lie down (head to her right)", sleep_r_loop: "asleep (head to her right)", get_up_r: "get up (head to her right)", open_push: "push", open_pull: "pull", open_slide: "slide",
  open_push_l: "push (left hand)", open_pull_l: "pull (left hand)", open_slide_l: "slide (left hand)", reach_low: "from the floor", reach_mid: "from a table", reach_high: "from a shelf",
  reach_low_l: "floor (left hand)", reach_mid_l: "table (left hand)", reach_high_l: "shelf (left hand)",
  sneak_loop: "sneaking", crouch_loop: "crouched", crawl_loop: "crawling", crawl_idle_loop: "on all fours", creep_loop: "creeping", creep_idle_loop: "hunched", scuttle_loop: "scuttling",
  peek_out: "lean out", peek_loop: "peeking", peek_back: "draw back", peek_out_l: "lean out (to her left)", peek_l_loop: "peeking (to her left)", peek_back_l: "draw back (to her left)",
  scare_lunge: "lunge", scare_loom: "loom", scare_snap: "head snap", scare_claw: "claw (from all fours)", punch: "punch", swing: "swing", hit_react: "hit", punch_l: "punch (left hand)", swing_l: "swing (left hand)",
  eat: "eat", drink: "drink", eat_l: "eat (left hand)", drink_l: "drink (left hand)", look_around: "look round", knock: "knock", cower_loop: "cowering" };
const WHOLE = ["sit", "sleep", "peek"];                        // kinds whose first three clips are one act: into it, held, out of it
const S = { chars: [], name: "", ctx: null, set: { ...DEFAULTS }, auto: 0, kind: "walk", clip: "", made: new Map(), list: [], playing: true, t: 0, seq: true, bones: new Map(), rest: new Map(), touched: new Set(), model: null, dots: [], mhr: null };
window.__anim = S;

// ---- the view ---------------------------------------------------------------------------------------------------------
const box = $("#view"), renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.AgXToneMapping ?? THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.35; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; box.append(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x26282d); scene.fog = new THREE.Fog(0x26282d, 9, 22);
const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 60), orbit = { yaw: -0.6, pitch: 0.08, dist: 5.2, at: new THREE.Vector3(0, 0.9, 0) };
const key = new THREE.DirectionalLight(0xfff2e2, 2.2); key.position.set(2.5, 5, 3.5); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 14 }); key.shadow.bias = -0.0004;
scene.add(key, new THREE.HemisphereLight(0xcfd8ff, 0x3a332c, 0.9)); const rim = new THREE.DirectionalLight(0xbfd0ff, 0.9); rim.position.set(-3, 2.5, -3); scene.add(rim);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x3a3c41, roughness: 0.95 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const grid = new THREE.GridHelper(40, 80, 0x565a63, 0x44474e); grid.position.y = 0.001; scene.add(grid);
function place() { const c = Math.cos(orbit.pitch); camera.position.set(orbit.at.x + Math.sin(orbit.yaw) * c * orbit.dist, orbit.at.y + Math.sin(orbit.pitch) * orbit.dist, orbit.at.z + Math.cos(orbit.yaw) * c * orbit.dist); camera.lookAt(orbit.at); }
function size() { const w = box.clientWidth, h = box.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix(); }
new ResizeObserver(size).observe(box); size(); place();
let drag = null;
renderer.domElement.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY, b: e.button }; renderer.domElement.setPointerCapture(e.pointerId); });
renderer.domElement.addEventListener("pointermove", e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
  if (drag.b === 0) { orbit.yaw -= dx * 0.008; orbit.pitch = Math.min(1.45, Math.max(-0.3, orbit.pitch + dy * 0.006)); }
  else { const r = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), u = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1), k = orbit.dist * 0.0012; orbit.at.addScaledVector(r, -dx * k).addScaledVector(u, dy * k); }
  place(); });
renderer.domElement.addEventListener("pointerup", () => { drag = null; }); renderer.domElement.addEventListener("contextmenu", e => e.preventDefault());
renderer.domElement.addEventListener("wheel", e => { e.preventDefault(); orbit.dist = Math.min(14, Math.max(0.8, orbit.dist * Math.exp(e.deltaY * 0.0012))); place(); }, { passive: false });
for (const b of document.querySelectorAll(".views button")) b.onclick = () => { orbit.yaw = { q: -0.6, front: 0, side: -Math.PI / 2, back: Math.PI }[b.dataset.view]; orbit.pitch = 0.08; place(); };

// ---- a character ------------------------------------------------------------------------------------------------------
async function characters(pick) {
  const r = await (await fetch("/api/characters")).json(); S.chars = r.characters; const sel = $("#who"); sel.innerHTML = "";
  for (const c of S.chars) { const o = document.createElement("option"); o.value = c.name; o.textContent = `${c.name}${c.baked ? "  · baked" : ""}`; sel.append(o); }
  if (!S.chars.length) { status(`No characters yet: export one from the Character Studio (Export for Godot), or open a .glb. Looked in ${r.places.join(", ")}`, "bad"); return; }
  const want = pick || new URLSearchParams(location.search).get("c") || S.name || S.chars[0].name; sel.value = S.chars.some(c => c.name === want) ? want : S.chars[0].name;
  if (sel.value !== S.name || pick) await load(sel.value);
}
async function load(name) {
  status(`Reading ${name}: its body measured, its soft bones put in…`); S.name = name; S.made.clear();
  try {
    S.mhr ||= await (await fetch("/api/mhr_rig")).arrayBuffer().catch(() => null);
    const res = await fetch(`/api/preview/${encodeURIComponent(name)}`); if (!res.ok) throw new Error((await res.json()).error || "the preview failed");
    const bytes = await res.arrayBuffer(), glb = parseGlb(bytes), info = S.chars.find(c => c.name === name) || {};
    S.ctx = attach(glb, { mhrRig: S.mhr }); S.auto = settingsFor(glb, S.ctx.body, {}).style; S.set = settingsFor(glb, S.ctx.body, info.settings || info.last || {});
    const gltf = await new Promise((ok, bad) => new GLTFLoader().parse(bytes, "", ok, bad));
    if (S.model) { scene.remove(S.model); S.model.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    S.model = gltf.scene; S.bones.clear(); S.rest.clear(); S.touched.clear();
    S.model.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = true; o.receiveShadow = false; if (o.material && o.material.transparent) o.castShadow = false; }
      if (o.isBone || S.ctx.rig.ix.has(o.name)) { S.bones.set(o.name, o); S.rest.set(o.name, { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() }); } });
    scene.add(S.model); for (const d of S.dots) scene.remove(d); S.dots = S.ctx.plan.map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffb060, depthTest: false })); m.renderOrder = 9; m.visible = false; scene.add(m); return m; });
    orbit.at.set(0, S.ctx.body.height * 0.52, 0); orbit.dist = S.ctx.body.height * 3.1; place();
    sliders(); readout(); await show(S.kind);
    const stale = info.baked && (info.version || 1) < VERSION;   // (baked before the hands and the jiggle were reworked: what plays here is the new; her file still has the old)
    status(`${name}: ${stale ? `baked by an older Animator (${info.clips.length} clips): Bake again for what you see here` : info.baked ? `baked (${info.clips.length} clips)` : info.last ? "exported again since its bake: Bake to put its clips back" : "not baked yet"} · ${info.where || ""}`, info.baked && !stale ? "good" : "");
  } catch (e) { status(`${name}: ${e.message}`, "bad"); console.error(e); }
}
function sliders() { for (const k of ["style", "strength", "weight", "soft", "bounce"]) $("#" + k).value = S.set[k]; $("#furniture").value = S.set.furniture || "fit"; }
function readout() {
  const b = summary(S.ctx.body), p = params(S.ctx.body, S.set), word = p.build < -0.25 ? "light" : p.build < 0.35 ? "ordinary" : p.build < 1.25 ? "heavy" : "very heavy";
  $("#body").innerHTML = `<div><b>${b.height} cm</b>, about <b>${b.weight} kg</b> <span class="dim">(${b.from === "recipe" ? "from her own unclothed body" : "from her meshes"})</span></div>
    <div>bust ${b.bust} · waist ${b.waist} · hips ${b.hips} cm, thigh ${b.thigh} cm, legs ${b.leg} cm</div>
    <div>Moves as a <b>${word}</b> body <span class="dim">(build ${p.build.toFixed(2)})</span></div>
    <div class="dim">Soft: ${S.ctx.plan.map(x => `${x.name.replace("soft_", "").replace("_", " ")} ${x.amount.toFixed(1)}`).join(", ") || "none"}</div>`;
  // what her clips are made for, and what that is to her: a seat over 1.18 of her own she gets up onto
  const F = furniture(S.ctx.body, S.set), own = furniture(S.ctx.body, { furniture: "own" }), cm = v => Math.round(v * 100), high = F.seat > 1.18 * own.seat + 1e-6;
  $("#furn").innerHTML = `<div>seat <b>${cm(F.seat)}</b> · bed <b>${cm(F.bed)}</b> · handle <b>${cm(F.handle)}</b> · table <b>${cm(F.table)}</b> cm</div>
    <div class="dim">her own size: ${cm(own.seat)}, ${cm(own.bed)}, ${cm(own.handle)}, ${cm(own.table)} cm${high ? ". The seat is high for her: she gets up onto it, her legs hang" : ""}</div>`;
}
// ---- clips --------------------------------------------------------------------------------------------------------------
function clipsOf(kind) {
  const keyOf = JSON.stringify([kind, S.set]); if (S.made.has(keyOf)) return S.made.get(keyOf);
  const { rig, body, X, plan } = S.ctx, out = makers(rig, body, S.set, [kind], X).map(m => { const c = makeClip(rig, body, X, plan, m, S.set); return { ...c.tracks, stats: c.stats, maker: m }; });
  S.made.clear(); S.made.set(keyOf, out); return out;
}
async function show(kind, keep = false) {
  S.kind = kind; const t0 = performance.now(); S.list = clipsOf(kind);
  const kinds = $("#kinds"); kinds.innerHTML = ""; for (const k of Object.keys(KIND_LABEL)) { const b = document.createElement("button"); b.textContent = KIND_LABEL[k]; b.className = k === kind ? "on" : ""; b.onclick = () => show(k); kinds.append(b); }
  if (!keep || !S.list.some(c => c.name === S.clip)) { S.clip = S.list[0].name; S.t = 0; S.seq = WHOLE.includes(kind); }
  chips(); info(performance.now() - t0);
}
// what the clip on show is made for, drawn where it stands: the seat, the bed, the door's post and a bar at its
// handle, the table or the shelf a thing is taken from (the clip's own record: her furniture, acts.js furniture())
const FURN = new THREE.Group(); scene.add(FURN); const furnMat = new THREE.MeshStandardMaterial({ color: 0x6f6b64, roughness: 0.92 });
function furnish() {
  for (const m of [...FURN.children]) { FURN.remove(m); m.geometry.dispose(); }
  const c = S.list.find(x => x.name === S.clip), mt = c && c.maker && c.maker.meta; if (!mt) return;
  const box = (x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), furnMat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; FURN.add(m); };
  if (mt.seat) { const H = mt.seat.height, e = mt.seat.edge; box(0, H / 2, e - 0.24, 0.48, H, 0.48); box(0, H + 0.2, e - 0.46, 0.48, 0.4, 0.04); }
  if (mt.bed) { const H = mt.bed.height, e = mt.bed.edge, hx = mt.bed.head[0], x0 = Math.min(-0.6, hx - 0.4), x1 = Math.max(0.6, hx + 0.4); box((x0 + x1) / 2, H / 2, e - 0.5, x1 - x0, H, 1.0); box(hx > 0 ? x1 + 0.03 : x0 - 0.03, H / 2 + 0.25, e - 0.5, 0.06, H + 0.5, 1.0); }
  if (mt.door) { const h = mt.door.handle, g = h[0] < 0 ? 1 : -1; box(h[0] + g * 0.45, 1.0, h[2] + 0.03, 0.08, 2.0, 0.1); box(h[0] + g * 0.2, h[1], h[2] + 0.012, 0.5, 0.025, 0.03); }
  if (mt.reach && /mid|high/.test(c.name)) { const a = mt.reach.at; box(a[0], a[1] - 0.035, a[2] + 0.12, 0.6, 0.03, 0.45); }
}
function chips() {
  const el = $("#clips"); el.innerHTML = "";
  if (WHOLE.includes(S.kind)) { const b = document.createElement("button"); b.textContent = "the whole of it"; b.className = S.seq ? "on" : ""; b.onclick = () => { S.seq = true; S.clip = S.list[0].name; S.t = 0; chips(); }; el.append(b); }
  for (const c of S.list) { const b = document.createElement("button"); b.textContent = CLIP_LABEL[c.name] || c.name; b.title = c.name; b.className = !S.seq && c.name === S.clip ? "on" : ""; b.onclick = () => { S.seq = false; S.clip = c.name; S.t = 0; S.playing = true; chips(); info(); }; el.append(b); }
}
function info(ms) {
  furnish();
  const c = S.list.find(x => x.name === S.clip); if (!c) return; const st = c.stats || {}, sf = st.soft || {};
  const rows = [`<div><b>${c.name}</b> · ${c.secs.toFixed(2)} s${c.loop ? ", a loop" : ""}${c.speed ? ` · ${c.speed.toFixed(2)} m/s, ${(120 / c.secs).toFixed(0)} steps a minute` : ""}</div>`];
  if (st.arm_l != null) { const turned = Math.max(st.turn_l || 0, st.turn_r || 0);
    rows.push(`<div>${turned >= 1 ? `Forearms turned ${turned.toFixed(0)}° to point ahead past the body, arms` : "Arms"} carried ${Math.max(st.arm_l, st.arm_r).toFixed(0)}° further out to clear it${st.armInside > 0 ? ` <span class="dim">(${st.armInside} mm still inside)</span>` : ""}</div>`); }
  if (sf.thighs && sf.thighs.before > 0) rows.push(`<div>Thighs would overlap ${sf.thighs.before} mm: squashed, ${sf.thighs.after} mm left</div>`);
  const mv = Object.entries(sf).filter(([k]) => k !== "thighs").map(([k, v]) => `${k.replace("soft_", "").replace("_", " ")} ${v}`); if (mv.length) rows.push(`<div class="dim">Soft tissue moves (mm): ${mv.join(", ")}</div>`);
  if (c.events && c.events.length) rows.push(`<div class="dim">Events: ${c.events.map(e => `${e.name} at ${e.t.toFixed(2)} s`).join(", ")}</div>`);
  if (ms != null) rows.push(`<div class="dim">made in ${ms.toFixed(0)} ms</div>`);
  $("#clipInfo").innerHTML = rows.join("");
}
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
function pose(c, t) {
  const f = Math.min(c.keys - 1, Math.max(0, t * c.fps)), i0 = Math.min(c.keys - 2, Math.floor(f)), a = f - i0, i1 = i0 + 1, now = new Set();
  for (const tr of c.tracks) { const name = S.ctx.rig.J[tr.joint].name, b = S.bones.get(name); if (!b) continue; now.add(name);
    if (tr.r) { qa.fromArray(tr.r, i0 * 4); qb.fromArray(tr.r, i1 * 4); b.quaternion.slerpQuaternions(qa, qb, a); }
    if (tr.t) b.position.set(tr.t[i0 * 3] + (tr.t[i1 * 3] - tr.t[i0 * 3]) * a, tr.t[i0 * 3 + 1] + (tr.t[i1 * 3 + 1] - tr.t[i0 * 3 + 1]) * a, tr.t[i0 * 3 + 2] + (tr.t[i1 * 3 + 2] - tr.t[i0 * 3 + 2]) * a); }
  for (const name of S.touched) if (!now.has(name)) { const b = S.bones.get(name), r = S.rest.get(name); b.position.copy(r.p); b.quaternion.copy(r.q); b.scale.copy(r.s); }
  S.touched = now;
}
let last = performance.now(), hold = 0;
function frame(nowT) {
  const dt = Math.min(0.1, (nowT - last) / 1000) * ($("#slow").checked ? 0.25 : 1); last = nowT;
  const c = S.list.find(x => x.name === S.clip);
  if (c && S.model) {
    if (S.playing) { S.t += dt;
      if (S.t >= c.secs) { if (S.seq) { const i = S.list.indexOf(c), loop = c.loop; if (loop && (hold += 1) < 1) S.t -= c.secs; else { hold = 0; S.clip = S.list[(i + 1) % 3].name; S.t = 0; chips(); info(); } }
        else if (c.loop) S.t -= c.secs; else if (S.t > c.secs + 0.9) S.t = 0; } }
    const cc = S.list.find(x => x.name === S.clip); pose(cc, Math.min(S.t, cc.secs)); $("#scrub").value = Math.min(1, S.t / cc.secs); $("#time").textContent = `${Math.min(S.t, cc.secs).toFixed(2)} / ${cc.secs.toFixed(2)} s`;
    grid.position.z = cc.speed ? -((performance.now() / 1000 * cc.speed * ($("#slow").checked ? 0.25 : 1)) % 0.5) : 0;
    const show = $("#softDots").checked; S.model.updateMatrixWorld(true); S.ctx.plan.forEach((b, i) => { const o = S.bones.get(b.name); S.dots[i].visible = show && !!o; if (o && show) o.getWorldPosition(S.dots[i].position); });
  }
  renderer.render(scene, camera); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---- the controls -------------------------------------------------------------------------------------------------------
let wait = 0;
for (const k of ["style", "strength", "weight", "soft", "bounce"]) $("#" + k).addEventListener("input", e => { S.set[k] = +e.target.value; clearTimeout(wait); wait = setTimeout(() => { if (S.ctx) { readout(); show(S.kind, true); } }, 40); });
$("#furniture").onchange = e => { S.set.furniture = e.target.value; if (S.ctx) { readout(); show(S.kind, true); } };
$("#reset").onclick = () => { S.set = { ...DEFAULTS, style: S.auto }; sliders(); readout(); show(S.kind, true); };
$("#play").onclick = () => { S.playing = !S.playing; $("#play").textContent = S.playing ? "❚❚" : "▶"; };
$("#scrub").addEventListener("input", e => { const c = S.list.find(x => x.name === S.clip); if (c) { S.playing = false; $("#play").textContent = "▶"; S.t = +e.target.value * c.secs; } });
addEventListener("keydown", e => { if (e.code === "Space" && e.target.tagName !== "INPUT" && e.target.tagName !== "SELECT") { e.preventDefault(); $("#play").click(); } });
$("#who").onchange = e => load(e.target.value);
$("#helpBtn").onclick = e => { e.preventDefault(); $("#help").showModal(); };
$("#open").onclick = () => $("#file").click();
$("#file").onchange = async e => { const f = e.target.files[0]; if (!f) return; status(`Bringing in ${f.name}…`);
  const r = await fetch(`/api/open?name=${encodeURIComponent(f.name)}`, { method: "POST", body: await f.arrayBuffer() }), j = await r.json(); if (!r.ok) return status(j.error, "bad"); await characters(j.name); e.target.value = ""; };
$("#bake").onclick = async () => {
  const log = $("#log"); log.textContent = ""; $("#bake").disabled = true; status(`Baking ${S.name}…`);
  const j = await (await fetch("/api/bake", { method: "POST", body: JSON.stringify({ name: S.name, settings: S.set }) })).json(); if (j.error) { status(j.error, "bad"); $("#bake").disabled = false; return; }
  let from = 0; for (;;) { await new Promise(r => setTimeout(r, 400)); const s = await (await fetch(`/api/job/${j.job}?from=${from}`)).json(); from = s.lines; if (s.log.length) { log.textContent += s.log.join("\n") + "\n"; log.scrollTop = log.scrollHeight; }
    if (s.state !== "running") { $("#bake").disabled = false; const name = S.name; await characters(); const c = S.chars.find(x => x.name === name);
      status(s.state === "ok" ? `${name}: baked, ${c ? c.clips.length : "its"} clips in ${c ? c.where : "its file"} (${s.secs} s)` : `${name}: the bake failed (its log is on the right)`, s.state === "ok" ? "good" : "bad"); break; } }
};
characters().catch(e => status(e.message, "bad"));
