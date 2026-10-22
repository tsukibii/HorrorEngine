// The Layers tab (layers.js): select vertices on the body, then pour a fill into a new layer above the base. Our own code.
import * as THREE from "three";
import { SkinLayers, DEFAULT_FILL, fileToPix, loadImage, Pix } from "./layers.js";

// ctx: { el, $, status, api, who(), renderer, camera, mesh, dgeo, viewRect, POS, TRIS, geo, SKU, material, skinLook, lmk, lmkOk(), BASE_UV }
export function mountLayers(ctx) {
  const { el, $, status, renderer, camera, mesh, dgeo, viewRect, POS, TRIS, SKU } = ctx;
  const C = TRIS.length;
  const L = new SkinLayers({ N: POS.length / 3, TRIS, UV: dgeo.attributes.uv.array, getPos: () => POS, getNrm: () => ctx.geo.attributes.normal.array });
  const selAttr = new THREE.BufferAttribute(new Float32Array(C), 1); dgeo.setAttribute("selW", selAttr);
  SKU.uLayOv.value = L.texOv; SKU.uLayPig.value = L.texPig; SKU.uLaySurf.value = L.texSurf;

  const S = { tool: "brush", add: true, radius: 12, angle: 28, dist: 15, bleed: 0, inner: 0, outer: 0, show: true, live: true };
  let F = DEFAULT_FILL(), cur = null, ACTIVE = false, STROKING = false, SAVED = true;
  const target = () => cur || F;

  // ---- the selection, shown on the body ----
  const showSel = () => {
    SKU.uShowSel.value = S.show ? 1 : 0;
    const w = L.weights(S.bleed, S.inner, S.outer), a = selAttr.array;
    for (let c = 0; c < C; c++) a[c] = w[TRIS[c]];
    selAttr.needsUpdate = true; $("#selCount").textContent = `${L.count()} points selected`;
  };
  let selT = 0; const selLater = () => { clearTimeout(selT); selT = setTimeout(showSel, 30); };

  const ray = new THREE.Raycaster();
  const vertexAt = e => {
    const r = renderer.domElement.getBoundingClientRect(), V = viewRect(r.width, r.height), x = e.clientX - r.left - V.x, y = r.bottom - e.clientY - V.y;
    ray.setFromCamera(new THREE.Vector2(x / V.w * 2 - 1, y / V.h * 2 - 1), camera);
    dgeo.computeBoundingSphere();
    const h = ray.intersectObject(mesh, false)[0]; if (!h) return -1;
    const p = mesh.worldToLocal(h.point.clone()); let best = -1, bd = Infinity;
    for (let k = 0; k < 3; k++) { const v = TRIS[h.faceIndex * 3 + k], d = (POS[v * 3] - p.x) ** 2 + (POS[v * 3 + 1] - p.y) ** 2 + (POS[v * 3 + 2] - p.z) ** 2; if (d < bd) { bd = d; best = v; } }
    return best;
  };
  const apply = e => {
    const v = vertexAt(e); if (v < 0) return false;
    if (S.tool === "brush") L.brush(v, S.radius / 1000, S.add); else L.flood(v, S.dist / 100, S.angle, S.add);
    selLater(); return true;
  };
  const api2 = {
    active: () => ACTIVE,
    down: e => { if (!apply(e)) return false; STROKING = S.tool === "brush"; return true; },
    move: e => { if (STROKING) apply(e); },
    up: () => { STROKING = false; },
    layers: L,
  };

  // ---- the panel ----
  const box = $("#layerRows");
  const row = (label, ...kids) => el("div", { className: "row" }, el("span", { textContent: label }), ...kids, el("output"));
  const slider = (parent, label, lo, hi, step, get, set, help) => {
    const inp = el("input", { type: "range", min: lo, max: hi, step }), out = el("output");
    const r = el("div", { className: "row", title: help || "" }, el("span", { textContent: label }), inp, out);
    const show = () => { out.textContent = (+inp.value).toFixed(step < 0.1 ? 2 : step < 1 ? 1 : 0); };
    inp.oninput = () => { set(+inp.value); show(); }; parent.append(r);
    const refresh = () => { inp.value = get(); show(); }; refresh(); return refresh;
  };
  const chips = (parent, items, get, set) => {
    const d = el("div", { className: "chips" });
    const draw = () => d.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.k === String(get())));
    for (const [k, label, help] of items) { const b = el("button", { textContent: label, title: help || "" }); b.dataset.k = k; b.onclick = () => { set(k); draw(); }; d.append(b); }
    parent.append(d); draw(); return draw;
  };
  const refreshers = [];     // everything that shows the target's values

  // selection
  box.append(el("label", { className: "tog" }, Object.assign(el("input", { type: "checkbox", id: "laySelect" }), { onchange: e => { ACTIVE = e.target.checked; renderer.domElement.style.cursor = ACTIVE ? "cell" : ""; } }),
    el("span", {}, "Select on the body", el("small", { textContent: "Dragging on the body picks vertices (the orange tint); Alt-drag still turns the view. A fill pours into the selection: nothing under the layers changes." }))));
  box.append(el("h4", { textContent: "Select" }));
  chips(box, [["brush", "Brush", "Every point within the radius along the surface"], ["flood", "Flood", "Spreads over the surface until it bends more than the angle, or goes as far as the distance"]], () => S.tool, k => { S.tool = k; });
  chips(box, [[true, "Add", "Drag adds"], [false, "Subtract", "Drag takes away"]], () => S.add, k => { S.add = k === "true" || k === true; });
  slider(box, "Brush (mm)", 3, 60, 1, () => S.radius, v => { S.radius = v; }, "The brush's radius along the surface.");
  slider(box, "Flood angle", 5, 90, 1, () => S.angle, v => { S.angle = v; }, "How much the surface may bend from one point to the next before the flood stops.");
  slider(box, "Flood reach (cm)", 1, 60, 1, () => S.dist, v => { S.dist = v; }, "How far the flood may go.");
  const ops = el("div", { className: "chips" });
  const op = (label, fn, help) => { const b = el("button", { textContent: label, title: help || "" }); b.onclick = () => { fn(); selLater(); }; ops.append(b); };
  op("All", () => L.all()); op("None", () => L.clear()); op("Invert", () => L.invert());
  op("Head", () => { prepare(); L.region("head"); }, "From the chin up"); op("Body", () => { prepare(); L.region("body"); }, "Below the chin: the neck, torso, arms, legs");
  op("Grow", () => L.grow(4), "4 mm"); op("Shrink", () => L.shrink(4), "4 mm");
  box.append(ops, el("small", { id: "selCount", className: "note", textContent: "" }));
  box.append(el("h4", { textContent: "Edge" }));
  slider(box, "Bleed (mm)", 0, 30, 0.5, () => S.bleed, v => { S.bleed = v; selLater(); }, "Grows the selection outward by this much, with a hard edge (paint that runs past the line).");
  slider(box, "Soft inner (mm)", 0, 30, 0.5, () => S.inner, v => { S.inner = v; selLater(); }, "Feathers inward: the fill fades in from the edge over this distance.");
  slider(box, "Soft outer (mm)", 0, 30, 0.5, () => S.outer, v => { S.outer = v; selLater(); }, "Feathers outward: the fill fades out past the edge over this distance. (Measured along the surface; the mesh's own point spacing, about 5 mm on the face, is its finest step.)");
  box.append(el("label", { className: "tog" }, Object.assign(el("input", { type: "checkbox", checked: true }), { onchange: e => { S.show = e.target.checked; showSel(); } }), el("span", {}, "Show the selection")));

  // the fill
  box.append(el("h4", { textContent: "Fill" }));
  const typeChips = chips(box, [["colour", "Colour"], ["image", "PNG"], ["pbr", "PBR set"], ["uv", "UV texture", "A picture already in MHR's UV layout (the photo skin, one painted elsewhere)"]], () => target().type, k => { target().type = k; changed(true); showType(); });
  const sec = { colour: el("div"), image: el("div"), pbr: el("div"), uv: el("div") };
  box.append(...Object.values(sec));
  const showType = () => { for (const [k, d] of Object.entries(sec)) d.hidden = k !== target().type; };
  const changed = (rebake = false) => { if (cur) { L.touch(cur, rebake); SAVED = false; } };
  const colour = el("input", { type: "color" }); colour.oninput = () => { target().colour = colour.value; changed(true); };
  sec.colour.append(row("Colour", colour)); refreshers.push(() => { colour.value = target().colour; });
  const filePicker = (parent, label, key, hint) => {
    const f = el("input", { type: "file", accept: "image/*" }), name = el("small", { className: "note" });
    f.onchange = async () => { if (!f.files[0]) return; try { const p = await fileToPix(f.files[0]); target().imgs = target().imgs || {}; target().imgs[key] = p; name.textContent = f.files[0].name; changed(true); } catch (e) { status(e.message, "bad"); } };
    parent.append(el("div", { className: "row", title: hint || "" }, el("span", { textContent: label }), f, el("output")), name);
    refreshers.push(() => { name.textContent = target().imgs?.[key] ? "loaded" : ""; f.value = ""; });
  };
  // image
  filePicker(sec.image, "PNG", "image", "A decal, a tattoo, a texture: its own alpha is kept");
  chips(sec.image, [["front", "Front"], ["side", "Side"], ["top", "Top"], ["tri", "Triplanar"]], () => target().image.mode, k => { target().image.mode = k; changed(true); });
  refreshers.push(slider(sec.image, "Size (cm)", 1, 80, 0.5, () => target().image.size, v => { target().image.size = v; changed(true); }, "How wide the picture lands on the skin."));
  refreshers.push(slider(sec.image, "Rotate", -180, 180, 1, () => target().image.rot, v => { target().image.rot = v; changed(true); }));
  refreshers.push(slider(sec.image, "Move across (cm)", -30, 30, 0.1, () => target().image.ox, v => { target().image.ox = v; changed(true); }));
  refreshers.push(slider(sec.image, "Move up (cm)", -30, 30, 0.1, () => target().image.oy, v => { target().image.oy = v; changed(true); }));
  const tile = el("input", { type: "checkbox" }), rel = el("input", { type: "checkbox" });
  tile.onchange = () => { target().image.tile = tile.checked; changed(true); }; rel.onchange = () => { target().image.relative = rel.checked; changed(true); };
  sec.image.append(el("label", { className: "tog" }, tile, el("span", {}, "Tile it", el("small", { textContent: "On for a texture that repeats; off for a decal (outside the picture stays bare)." }))),
    el("label", { className: "tog" }, rel, el("span", {}, "Relative to its own average", el("small", { textContent: "Divides out the picture's average colour, so a face photo lays its features (brows, lips, shading) onto whatever skin tone is under it. Best with Pigment on." }))));
  refreshers.push(() => { tile.checked = !!target().image.tile; rel.checked = !!target().image.relative; });
  // UV texture
  filePicker(sec.uv, "Texture", "image", "e.g. People/<name>/skin.png");
  const rel2 = el("input", { type: "checkbox" }); rel2.onchange = () => { target().image.relative = rel2.checked; changed(true); };
  sec.uv.append(el("label", { className: "tog" }, rel2, el("span", {}, "Relative to its own average")));
  refreshers.push(() => { rel2.checked = !!target().image.relative; });
  // PBR
  const shelf = el("select"); shelf.append(el("option", { value: "", textContent: "from the PBR shelf…" }));
  sec.pbr.append(row("Shelf", shelf));
  let SHELF = {}; ctx.api("api/pbr").then(r => { SHELF = r.sets || {}; for (const k of Object.keys(SHELF)) shelf.append(el("option", { value: k, textContent: k.replace(/^pbr\//, "") })); }).catch(() => { });
  shelf.onchange = async () => {
    const s = SHELF[shelf.value]; if (!s) return; status(`loading ${shelf.value}…`);
    const rel = shelf.value.replace(/^pbr\//, "");
    try {
      target().imgs = target().imgs || {};
      for (const [k, key] of [["albedo", "albedo"], ["rough", "rough"], ["height", "height"], ["ao", "ao"]]) if (s.maps[k]) { const im = await loadImage(`pbrfile/${rel.split("/").map(encodeURIComponent).join("/")}/${encodeURIComponent(s.maps[k])}`); target().imgs[key] = Object.assign(new Pix(im), { url: null }); }
      if (s.tile_m) target().pbr.size = Math.round(s.tile_m * 100 / 2);
      refreshers.forEach(f => f()); changed(true); status(`${rel}: loaded`, "ok");
    } catch (e) { status(e.message, "bad"); }
  };
  filePicker(sec.pbr, "Albedo", "albedo"); filePicker(sec.pbr, "Roughness", "rough"); filePicker(sec.pbr, "Height", "height", "Bump: becomes relief"); filePicker(sec.pbr, "AO", "ao");
  const tint = el("input", { type: "color" }); tint.oninput = () => { target().pbr.tint = tint.value; changed(true); };
  sec.pbr.append(row("Albedo tint", tint)); refreshers.push(() => { tint.value = target().pbr.tint; });
  refreshers.push(slider(sec.pbr, "Tile size (cm)", 2, 100, 1, () => target().pbr.size, v => { target().pbr.size = v; changed(true); }, "How big one repeat of the set is on the body."));
  refreshers.push(slider(sec.pbr, "Roughness", 0, 1, 0.01, () => target().pbr.rough, v => { target().pbr.rough = v; changed(true); }, "How much of the set's roughness map shows."));
  refreshers.push(slider(sec.pbr, "Relief", 0, 3, 0.05, () => target().pbr.height, v => { target().pbr.height = v; changed(true); }, "How much its height map pushes the surface."));
  refreshers.push(slider(sec.pbr, "AO", 0, 1, 0.01, () => target().pbr.ao, v => { target().pbr.ao = v; changed(true); }));

  // for every fill
  box.append(el("h4", { textContent: "Every fill" }));
  refreshers.push(slider(box, "Opacity", 0, 1, 0.01, () => target().opacity, v => { target().opacity = v; changed(false); }, "How much of the layer shows."));
  const pig = el("input", { type: "checkbox" }); pig.onchange = () => { target().pigment = pig.checked; changed(false); };
  box.append(el("label", { className: "tog" }, pig, el("span", {}, "Pigment", el("small", { textContent: "The fill filters the skin's own colour instead of covering it, and overlapping pigments mix. Off: it covers like paint." }))));
  refreshers.push(() => { pig.checked = !!target().pigment; });
  refreshers.push(slider(box, "Pigment density", 0.2, 6, 0.1, () => target().density, v => { target().density = v; changed(false); }, "How much light the pigment takes out of the skin."));
  refreshers.push(slider(box, "Pigment cover", 0, 1, 0.01, () => target().cover, v => { target().cover = v; changed(false); }, "A little of the pigment hides the base, like paint (lipstick, not a stain)."));
  refreshers.push(slider(box, "Shine", 0, 1, 0.01, () => target().shine, v => { target().shine = v; changed(false); }, "A wet clear coat over the fill: gel, gloss, lipstick."));
  refreshers.push(slider(box, "Oily", 0, 1, 0.01, () => target().oil, v => { target().oil = v; changed(false); }, "Lowers the roughness: broad, soft highlights (oily skin, sweat)."));
  refreshers.push(slider(box, "Gloss tightness", 0, 1, 0.01, () => target().tight, v => { target().tight = v; changed(false); }, "Small hard highlights (1) or a wide soft sheen (0)."));
  const fill = el("button", { textContent: "Fill the selection (new layer)", className: "primary", title: "Pours this into the selection as a new layer, with the edge above" });
  fill.onclick = () => {
    if (!L.count()) return status("select some of the body first (Select on the body)", "bad");
    prepare();
    const f = structuredClone({ ...F, imgs: undefined }); f.imgs = { ...(F.imgs || {}) };
    const n = L.layers.length + 1, lay = L.add(`${{ colour: "Colour", image: "PNG", pbr: "PBR", uv: "UV texture" }[F.type]} ${n}`, L.weights(S.bleed, S.inner, S.outer), f);
    cur = lay; refreshAll(); drawList(); SAVED = false; status(`layer ${n}: ${L.count()} points`, "ok");
  };
  const newFill = el("button", { textContent: "New fill", title: "Stop editing the layer; the controls above go back to the next fill" });
  newFill.onclick = () => { cur = null; refreshAll(); drawList(); };
  box.append(el("div", { className: "row" }, fill, newFill));

  // the layer list
  box.append(el("h4", { textContent: "Layers (top first; delete them all for the base mesh)" }));
  const list = el("div", { className: "laylist" }); box.append(list);
  function drawList() {
    list.replaceChildren(...[...L.layers].reverse().map(lay => {
      const eye = el("input", { type: "checkbox", checked: lay.visible, title: "Show" }); eye.onchange = () => { lay.visible = eye.checked; L.touch(lay, true); SAVED = false; };
      const name = el("span", { textContent: lay.name, className: cur === lay ? "lname on" : "lname" }); name.onclick = () => { cur = lay; refreshAll(); drawList(); };
      name.title = "Edit this layer";
      const b = (t, title, fn) => { const x = el("button", { textContent: t, title }); x.onclick = e => { e.stopPropagation(); fn(); }; return x; };
      return el("div", { className: "layrow" }, eye, name,
        b("↑", "Up", () => { L.move(lay, 1); drawList(); SAVED = false; }), b("↓", "Down", () => { L.move(lay, -1); drawList(); SAVED = false; }),
        b("◎", "Select what this layer covers", () => { for (let i = 0; i < L.N; i++) L.sel[i] = lay.w[i] > 0.5 ? 1 : 0; showSel(); }),
        b("✕", "Delete the layer", () => { if (cur === lay) cur = null; L.remove(lay); refreshAll(); drawList(); SAVED = false; }));
    }));
    if (!L.layers.length) list.append(el("small", { className: "note", textContent: "no layers: the base mesh as it is" }));
  }
  const save = el("button", { textContent: "Save layers" });
  save.onclick = async () => {
    if (!ctx.who()) return status("make or pick a character first", "bad");
    try { await ctx.api(`api/layers/${encodeURIComponent(ctx.who())}`, L.toJSON()); SAVED = true; status("layers saved: People/" + ctx.who() + "/layers.json (PBR sets from the shelf are saved by name only when you re-pick them)", "ok"); } catch (e) { status(e.message, "bad"); }
  };
  api2.save = () => save.onclick();
  const clearAll = el("button", { textContent: "Delete all layers" }); clearAll.onclick = () => { if (!confirm("Delete every layer? The base mesh stays.")) return; L.layers.length = 0; cur = null; L.update(); refreshAll(); drawList(); SAVED = false; };
  box.append(el("div", { className: "row" }, save, clearAll));

  function refreshAll() {
    refreshers.forEach(f => f()); typeChips(); showType(); activate(); }
  const activate = () => { SKU.uHasLay.value = L.layers.some(l => l.visible) ? 1 : 0; ctx.skinLook(); };
  L.onChange = () => { activate(); };
  function prepare() {                                         // the landmarks place the decal's centre and the chin line
    if (!ctx.lmkOk()) return;
    const a = ctx.lmk(4), b = ctx.lmk(10), c = ctx.lmk(152);
    L.anchor = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; L.neckY = c[1] - 0.015;
  }
  refreshAll(); drawList(); showSel();
  api2.load = async () => {
    cur = null; L.layers.length = 0; L.sel.fill(0);
    if (ctx.who()) { try { const j = await ctx.api(`api/layers/${encodeURIComponent(ctx.who())}`); if (j.layers?.length) await L.fromJSON(j); } catch (e) { } }
    L.update(); refreshAll(); drawList(); showSel(); SAVED = true;
  };
  api2.shapeChanged = () => L.shapeChanged();
  api2.saved = () => SAVED;
  return api2;
}
