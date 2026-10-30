// The pause menu (Esc in Play; docs/GAMEPLAY_PLAN.md §10): the game holds, the lights go out (the frame flickers down
// to nearly black) and the menu is drawn over it in the HUD's theme. The controls on the left (DECISIONS 2026-10-27,
// later; each key or the mouse as the Studio's own symbol with what it does drawn beside it, 2026-10-28), then Resume,
// Save game (slots), Settings (Display & Graphics, Audio), Quit (a footer choice, like any other). The reference for
// Unreal's menu: the same pages and rows, and every setting names what it maps to there (`ue`: a console variable, a
// scalability group, a sound class; a control its Enhanced Input action). Values step with ‹ › (A/D), never a slider;
// levels are ten dashes, the HUD's meter cut in steps.
import { chooser, paintLine } from "./hud.js";
const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const key = k => mk("span", "ph-key", k);
const ONOFF = ["Off", "On"], QUALITY = ["Low", "Medium", "High", "Epic"];

// every setting: a row of `values` (an index is kept) or a level of `steps` (a number is kept), its default and its
// Unreal name. `sg` rows follow the quality preset; changing one makes the preset Custom
export const SETTINGS = [
  { id: "display", title: "Display", groups: [
    { title: "Display", rows: [
      { id: "window", label: "Window mode", values: ["Fullscreen", "Borderless", "Windowed"], def: 1, ue: "r.FullScreenMode" },
      { id: "resolution", label: "Resolution", values: ["1280 × 720", "1600 × 900", "1920 × 1080", "2560 × 1440", "3840 × 2160"], def: 2, ue: "r.SetRes" },
      { id: "vsync", label: "VSync", values: ONOFF, def: 1, ue: "r.VSync" },
      { id: "fps", label: "Frame rate limit", values: ["30", "60", "120", "144", "Unlimited"], def: 1, ue: "t.MaxFPS" },
      { id: "brightness", label: "Brightness", steps: 10, def: 5, ue: "r.TonemapperGamma" },
      { id: "motion_blur", label: "Motion blur", values: ONOFF, def: 0, ue: "r.MotionBlurQuality" },
      { id: "grain", label: "Film grain", values: ONOFF, def: 1, ue: "PostProcess FilmGrainIntensity" },
    ] },
  ] },
  { id: "graphics", title: "Graphics", groups: [
    { title: "Graphics", rows: [
      { id: "quality", label: "Quality", values: [...QUALITY, "Custom"], def: 2, ue: "scalability <0-3>" },
      { id: "scale", label: "Resolution scale", values: ["50 %", "67 %", "75 %", "100 %"], def: 3, ue: "r.ScreenPercentage" },
      { id: "aa", label: "Anti-aliasing", values: ["Off", "FXAA", "TAA", "TSR"], def: 3, ue: "r.AntiAliasingMethod" },
      { id: "shadows", label: "Shadows", values: QUALITY, def: 1, sg: true, ue: "sg.ShadowQuality" },
      { id: "gi", label: "Global illumination", values: QUALITY, def: 2, sg: true, ue: "sg.GlobalIlluminationQuality" },
      { id: "reflections", label: "Reflections", values: QUALITY, def: 2, sg: true, ue: "sg.ReflectionQuality" },
      { id: "textures", label: "Textures", values: QUALITY, def: 2, sg: true, ue: "sg.TextureQuality" },
      { id: "effects", label: "Effects", values: QUALITY, def: 2, sg: true, ue: "sg.EffectsQuality" },
      { id: "post", label: "Post-processing", values: QUALITY, def: 2, sg: true, ue: "sg.PostProcessQuality" },
      { id: "view", label: "View distance", values: QUALITY, def: 2, sg: true, ue: "sg.ViewDistanceQuality" },
    ] },
  ] },
  { id: "audio", title: "Audio", groups: [
    { title: "Volume", rows: [
      { id: "master", label: "Master", steps: 10, def: 8, ue: "SoundClass Master" },
      { id: "music", label: "Music", steps: 10, def: 7, ue: "SoundClass Music" },
      { id: "sfx", label: "Effects", steps: 10, def: 8, ue: "SoundClass SFX" },
      { id: "voices", label: "Voices", steps: 10, def: 9, ue: "SoundClass Voice" },
      { id: "background", label: "In the background", values: ["Mute", "Keep playing"], def: 0, ue: "au.UnfocusedVolumeMultiplier" },
    ] },
    { title: "Subtitles", rows: [
      { id: "subs", label: "Subtitles", values: ONOFF, def: 1, ue: "UI" },
      { id: "sub_size", label: "Size", values: ["Small", "Medium", "Large"], def: 1, ue: "UI" },
    ] },
  ] },
];
const ROWS = SETTINGS.flatMap(p => p.groups.flatMap(g => g.rows));

// the controls, as the pause menu shows them on its left: the keys (or the mouse), what they do drawn beside them
// (`glyph`, below) and in words; `ue` the Enhanced Input action it is in Unreal; `only`: shown while the player has it
export const CONTROLS = [
  { keys: ["W", "A", "S", "D"], label: "Movement", ue: "IA_Move" },
  { mouse: "click", glyph: "ring", label: "Interact", ue: "IA_Interact" },
  { keys: ["E"], glyph: "row", label: "Inventory", ue: "IA_Inventory" },
  { mouse: "wheel", glyph: "turn", label: "Switch item", ue: "IA_InventoryScroll" },
  { keys: ["G"], glyph: "down", label: "Drop", ue: "IA_Drop" },
  { keys: ["Q"], glyph: "down", label: "Lower / raise", ue: "IA_Lower" },
  { keys: ["Shift"], glyph: "speed", label: "Run", ue: "IA_Run" },
  { keys: ["C"], glyph: "crouch", label: "Crouch", ue: "IA_Crouch" },
  { keys: ["F"], glyph: "beam", label: "Flashlight", ue: "IA_Flashlight", only: "torch" },
];
// the controls' symbols, the Studio's own (DECISIONS 2026-10-28): a key is a frosted tile standing on its lip, the
// legend in its middle; W A S D a pad round the dot that is you, the ways you can go between them; the mouse a pebble
// without a cable, the button or the wheel it means lit. Beside each, in the accent, what it does as the HUD shows it
// (GLYPH). One svg a row, as wide as the column: the key or the mouse round DX, what it does round GX. The colours are
// the theme's (hud.css: .ph-ctl .c-*)
const K = 34, LIP = 3, R = 8, DX = 52, GX = 120, SW = 140;
const svg = (h, body) => `<svg width="${SW}" height="${h}" viewBox="0 0 ${SW} ${h}" aria-hidden="true">${body}</svg>`;
function keyCap(x, y, label, w = K, h = K) {
  const b = y + h;
  return `<path class="c-lip" d="M${x} ${b + LIP - R}a${R} ${R} 0 0 0 ${R} ${R}h${w - 2 * R}a${R} ${R} 0 0 0 ${R} ${-R}v${-LIP}a${R} ${R} 0 0 1 ${-R} ${R}h${2 * R - w}a${R} ${R} 0 0 1 ${-R} ${-R}z"/>` +
    `<rect class="c-face c-edge" x="${x}" y="${y}" width="${w}" height="${h}" rx="${R}"/><path class="c-shine" d="M${x + R} ${y + 2.6}h${w - 2 * R}"/>` +
    `<text class="c-legend" x="${x + w / 2}" y="${y + h / 2}" dy=".36em" font-size="${label.length > 1 ? 11.5 : 14}">${label}</text>`;
}
// what each does, round (x, y): the reticle's ring a click uses; the inventory's row, the one in the hand in the middle
// with its mark under it (E shows it), and turned either way (the wheel); a thing set down on the floor (G); speed lines
// (Shift); your eye coming down from where it was (C); the flashlight's beam (F)
const HELD = (x, y) => `<rect class="c-glyph" x="${x - 5}" y="${y - 6}" width="10" height="10" rx="2.2"/><path class="c-glyph" d="M${x - 3.5} ${y + 8.5}h7"/>`;
const GLYPH = {
  ring: (x, y) => `<circle class="c-glyph" cx="${x}" cy="${y}" r="8.5"/><circle class="c-lit" cx="${x}" cy="${y}" r="2.2"/>`,
  row: (x, y) => `<rect class="c-glyph faint" x="${x - 15}" y="${y - 4.5}" width="7" height="7" rx="1.6"/><rect class="c-glyph faint" x="${x + 8}" y="${y - 4.5}" width="7" height="7" rx="1.6"/>` + HELD(x, y),
  turn: (x, y) => `<path class="c-glyph faint" d="M${x - 10} ${y - 5}l-4 4 4 4M${x + 10} ${y - 5}l4 4-4 4"/>` + HELD(x, y),
  down: (x, y) => `<path class="c-glyph" d="M${x} ${y - 12}v7M${x - 3} ${y - 8}l3 3 3-3"/><rect class="c-glyph" x="${x - 4.5}" y="${y - 1}" width="9" height="9" rx="1.6"/><path class="c-glyph faint" d="M${x - 11} ${y + 10}h22"/>`,
  speed: (x, y) => `<path class="c-glyph faint" d="M${x - 13} ${y - 5}h7M${x - 16} ${y}h10M${x - 13} ${y + 5}h7"/><path class="c-glyph" d="M${x - 2} ${y - 7}l7 7-7 7M${x + 5} ${y - 7}l7 7-7 7"/>`,
  crouch: (x, y) => `<path class="c-glyph dash" d="M${x - 9} ${y - 11}h18"/><path class="c-glyph faint" d="M${x} ${y - 8}v4.5M${x - 2.5} ${y - 6}l2.5 2.5 2.5-2.5"/>` +
    `<circle class="c-glyph" cx="${x}" cy="${y + 2}" r="3"/><path class="c-glyph" d="M${x - 7} ${y + 12.5}c0-4.5 3-6.5 7-6.5s7 2 7 6.5"/>`,
  beam: (x, y) => `<rect class="c-glyph" x="${x - 16}" y="${y - 2.5}" width="8" height="5" rx="1.4"/><path class="c-glyph" d="M${x - 8} ${y - 4}h3v8h-3"/>` +
    `<path class="c-glyph faint" d="M${x - 4} ${y - 4}L${x + 13} ${y - 10}M${x - 4} ${y + 4}L${x + 13} ${y + 10}M${x + 13} ${y - 10}q3.5 10 0 20"/>`,
};
const glyph = (c, y) => GLYPH[c.glyph] ? GLYPH[c.glyph](GX, y) : "";
function keysSvg(c) {
  if (c.keys.length === 4) {                         // the pad: W up, S down, A left, D right, the ways out round you
    const k = 30, s = k + 4, x = DX - s - k / 2, y = 1, cx = DX, cy = y + s + k / 2, [w, a, sk, d] = c.keys;
    const ways = `M${cx - 3} ${cy - 6}l3-3 3 3M${cx - 3} ${cy + 6}l3 3 3-3M${cx - 6} ${cy - 3}l-3 3 3 3M${cx + 6} ${cy - 3}l3 3-3 3`;
    return svg(y + 2 * s + k + LIP + 1, keyCap(x + s, y, w, k, k) + keyCap(x, y + s, a, k, k) + keyCap(x + 2 * s, y + s, d, k, k) + keyCap(x + s, y + 2 * s, sk, k, k) +
      `<path class="c-glyph faint" d="${ways}"/><circle class="c-lit" cx="${cx}" cy="${cy}" r="2.2"/>`);
  }
  const w = c.keys[0].length > 1 ? 58 : K;
  return svg(1 + K + LIP + 1, keyCap(DX - w / 2, 1, c.keys[0], w) + glyph(c, 1 + K / 2));
}
function mouseSvg(c) {                               // "click": its left button lit; "wheel": the wheel
  const x = DX, y = 1, wheel = c.mouse === "wheel";
  const body = `M${x} ${y}C${x + 10} ${y} ${x + 15} ${y + 7} ${x + 15} ${y + 17}V${y + 29}C${x + 15} ${y + 39} ${x + 9} ${y + 44} ${x} ${y + 44}` +
    `C${x - 9} ${y + 44} ${x - 15} ${y + 39} ${x - 15} ${y + 29}V${y + 17}C${x - 15} ${y + 7} ${x - 10} ${y} ${x} ${y}Z`;
  // the left button lit inside its edges, a hair off the outline, the split and the wheel
  const left = `M${x - 3.6} ${y + 17.2}V${y + 2.5}C${x - 9.5} ${y + 2.8} ${x - 12.8} ${y + 8} ${x - 12.8} ${y + 15.3}Q${x - 8} ${y + 17.3} ${x - 3.6} ${y + 17.2}Z`;
  const roller = cls => `<rect class="${cls}" x="${x - 2.2}" y="${y + 5}" width="4.4" height="10" rx="2.2"/>`;
  return svg(y + 44 + 2, `<path class="c-face" d="${body}"/><path class="c-shine" d="M${x - 9.5} ${y + 5}q-2.6 2.6-3.2 6.5"/>` + (wheel ? "" : `<path class="c-lit soft" d="${left}"/>`) +
    `<path class="c-line" d="M${x - 15} ${y + 17}Q${x} ${y + 21} ${x + 15} ${y + 17}M${x} ${y}v5M${x} ${y + 15}v4"/>` +
    (wheel ? roller("c-glow") + roller("c-lit") : roller("c-line")) + `<path class="c-edge" fill="none" d="${body}"/>` + glyph(c, y + 22));
}
export function controlsPanel(has = {}) {
  const box = mk("div", "ph-controls");
  for (const c of CONTROLS.filter(c => !c.only || has[c.only])) {
    const row = mk("div", "ph-ctl"), icon = mk("div", "ph-ctl-icon");
    icon.innerHTML = c.keys ? keysSvg(c) : mouseSvg(c);
    row.title = "Unreal: " + c.ue; row.append(icon, mk("span", "ph-ctl-label", c.label)); box.append(row);
  }
  return box;
}
const SKEY = "horrorstudio.settings", saveKey = game => `horrorstudio.saves.${game}`;
// the autosave slot (a chapter, a checkpoint): where the game was, its time, when
export function autosave(game, where, secs) { const s = read(saveKey(game), {}); s.auto = { where: where || game, secs: secs || 0, at: Date.now() }; write(saveKey(game), s); }
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
export function loadSettings() { const s = read(SKEY, {}); for (const r of ROWS) if (s[r.id] === undefined) s[r.id] = r.def; return s; }

// what the desk can show of the settings (the rest wait for Unreal): subtitles, their size, brightness
export function applySettings(root, s = loadSettings()) {
  root.classList.toggle("no-subs", !s.subs);
  root.style.setProperty("--ph-sub-scale", [0.85, 1, 1.2][s.sub_size] ?? 1);
  const cv = root.parentElement && root.parentElement.querySelector("canvas");
  if (cv) cv.style.filter = s.brightness === 5 ? "" : `brightness(${(0.6 + s.brightness * 0.08).toFixed(2)})`;
}

const clock = secs => `${Math.floor(secs / 3600)}:${String(Math.floor(secs / 60) % 60).padStart(2, "0")}:${String(Math.floor(secs) % 60).padStart(2, "0")}`;

// open it over `hud`; ctx {game, where, secs}. Resolves "resume", "escaped" (Esc closed it: the browser takes that same
// Esc as leaving a pointer lock, so the game mustn't ask for one back) or "quit" ({quit: "title" | "desktop"})
export function pauseMenu(hud, ctx) {
  return new Promise(done => {
    const s = loadSettings(), saves = read(saveKey(ctx.game), {});
    const m = mk("div", "ph-menu"), dark = mk("div", "ph-dark"), nav = mk("div", "ph-nav"), page = mk("section", "ph-page"), legend = mk("div", "ph-legend");
    m.append(dark, controlsPanel(ctx), nav, page, legend);
    let at = "root", col = "nav", idx = 0, items = { nav: [], page: [] }, quit = null, confirm = null;

    const focus = (c, i) => {
      col = c; idx = Math.max(0, Math.min(items[c].length - 1, i));
      for (const k of ["nav", "page"]) items[k].forEach((e, j) => e.classList.toggle("on", k === col && j === idx));
      if (items[c][idx]) items[c][idx].scrollIntoView({ block: "nearest" });
    };
    const item = (c, el, act, change) => {           // something the keys and the pointer can land on
      el.onmouseenter = () => focus(c, items[c].indexOf(el));
      el.onclick = e => { if (!e.target.closest(".ph-arrow, .ph-steps")) act && act(); };
      el.act = act; el.change = change; items[c].push(el); return el;
    };
    const legendFor = () => {
      const pairs = quit ? [["A D", "choose"], ["Enter", "select"], ["Esc", "back"]]
        : [["W S", "move"], ...(col === "page" && at.startsWith("set:") ? [["A D", "change"]] : [["Enter", "select"]]), ["Esc", at === "root" && col === "nav" ? "resume" : "back"]];
      legend.replaceChildren(...pairs.map(([k, w]) => { const p = mk("span", "ph-pair"); p.append(key(k), mk("span", "", w)); return p; }));
    };

    // the left column: where you are, then the list
    const showNav = () => {
      items.nav = []; nav.replaceChildren();
      const settings = at.startsWith("set:") || at === "settings";
      nav.append(mk("div", "ph-crumb", settings ? "Settings" : "Paused"));
      if (!settings) nav.append(mk("div", "ph-where", `${ctx.where || ctx.game} · ${clock(ctx.secs || 0)}`));
      const list = settings ? SETTINGS.map(p => [p.title, () => open("set:" + p.id), "set:" + p.id])
        : [["Resume", () => close("resume")], ["Save game", () => open("save"), "save"], ["Settings", () => open("set:" + SETTINGS[0].id), "settings"], ["Quit", () => open("quit"), "quit"]];
      for (const [t, act, page] of list) {
        const b = mk("button", "ph-item"); b.append(mk("span", "ph-mark"), mk("span", "", t));
        b.classList.toggle("open", page === at || (page === "settings" && settings)); nav.append(item("nav", b, act));
      }
    };
    // the right: a glass panel with the page's rows
    const showPage = () => {
      items.page = []; page.replaceChildren(); page.classList.toggle("on", at === "save" || at.startsWith("set:"));
      if (at === "save") {
        page.append(mk("div", "ph-group", "Save game"));
        const auto = saves.auto;
        page.append(slotEl("Autosave", auto, true));
        for (const n of [1, 2, 3]) page.append(item("page", slotEl(`Slot ${n}`, saves[n], false, n), () => saveTo(n)));
      }
      if (at.startsWith("set:")) {
        const p = SETTINGS.find(x => "set:" + x.id === at);
        for (const g of p.groups) {
          page.append(mk("div", "ph-group", g.title));
          for (const r of g.rows) page.append(item("page", rowEl(r), () => step(r, 1), d => step(r, d)));
        }
      }
    };
    const slotEl = (name, sv, auto, n) => {
      const e = mk("div", "ph-slot" + (auto ? " auto" : "")), meta = mk("div", "ph-meta");
      e.append(mk("div", "ph-slot-name", name), mk("div", "ph-slot-where", sv ? sv.where : auto ? "None yet" : "Empty"), meta);
      meta.textContent = sv ? `${clock(sv.secs)} played · ${new Date(sv.at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}` : "";
      if (confirm === n) { meta.replaceChildren(mk("span", "ph-ask-inline", "Overwrite?"), key("Enter"), mk("span", "", "yes"), key("Esc"), mk("span", "", "no")); e.classList.add("asking"); }
      return e;
    };
    const saveTo = n => {
      if (saves[n] && confirm !== n) { confirm = n; const i = idx; showPage(); focus("page", i); return; }
      saves[n] = { where: ctx.where || ctx.game, secs: ctx.secs || 0, at: Date.now() }; write(saveKey(ctx.game), saves);
      confirm = null; const i = idx; showPage(); focus("page", i); items.page[i].classList.add("saved");
    };
    const rowEl = r => {
      const e = mk("div", "ph-row"), val = mk("div", "ph-val");
      e.title = "Unreal: " + r.ue; e.append(mk("span", "ph-row-label", r.label), val);
      const left = mk("button", "ph-arrow", "‹"), right = mk("button", "ph-arrow", "›");
      left.onclick = () => step(r, -1); right.onclick = () => step(r, 1);
      if (r.steps) {
        const st = mk("div", "ph-steps");
        for (let i = 1; i <= r.steps; i++) { const d = mk("i"); d.classList.toggle("on", i <= s[r.id]); d.onclick = () => set(r, i); st.append(d); }
        val.append(left, st, mk("span", "ph-num", String(s[r.id])), right);
      } else val.append(left, mk("span", "ph-vtext", r.values[s[r.id]]), right);
      return e;
    };
    const set = (r, v) => {
      s[r.id] = v;
      if (r.id === "quality" && v < QUALITY.length) for (const x of ROWS) if (x.sg) s[x.id] = v;
      if (r.sg) s.quality = ROWS.filter(x => x.sg).every(x => s[x.id] === v) ? v : QUALITY.length;
      write(SKEY, s); for (const r of hud.root.parentElement.querySelectorAll(".play-hud")) applySettings(r, s);
      const i = idx; showPage(); focus("page", i);
    };
    const step = (r, d) => set(r, r.steps ? Math.max(0, Math.min(r.steps, s[r.id] + d)) : (s[r.id] + d + r.values.length) % r.values.length);

    // Quit: a footer choice like any other, the question as the line
    const askQuit = () => {
      const f = mk("div", "ph-footer"), line = mk("div", "ph-line");
      paintLine(line, "Leave the game? Anything since your last save is lost.");
      quit = chooser({ options: ["Stay", "Quit to title", "Quit to desktop"] }, i => (i === 0 ? back() : close({ quit: i === 1 ? "title" : "desktop" })));
      f.append(line, quit.el); m.append(f); quit.footer = f;
    };
    const open = p => {
      if (quit) { quit.footer.remove(); quit = null; }
      at = p; confirm = null; showNav(); showPage();
      m.classList.toggle("root", p === "root" || p === "quit");   // the controls on the left, until a page opens
      if (p === "quit") { askQuit(); focus("nav", 3); }
      else if (items.page.length) focus("page", 0);
      else focus("nav", 0);
      legendFor();
    };
    const back = key => {
      if (confirm) { confirm = null; const i = idx; showPage(); focus("page", i); return; }
      if (at === "quit") return open("root");
      if (col === "page" && at === "save") { open("root"); return focus("nav", 1); }
      if (at.startsWith("set:") && col === "page") { const i = SETTINGS.findIndex(x => "set:" + x.id === at); col = "nav"; focus("nav", i); legendFor(); return; }
      if (at.startsWith("set:")) { open("root"); return focus("nav", 2); }
      close(key === "escape" ? "escaped" : "resume");
    };
    const kd = e => {
      e.stopPropagation();
      if (quit && e.key !== "Escape" && e.key !== "Backspace") return quit.keys(e);
      const k = e.key.toLowerCase(), cur = items[col][idx];
      if (k === "escape" || k === "backspace") back(k);
      else if (k === "w" || k === "arrowup") focus(col, idx - 1);
      else if (k === "s" || k === "arrowdown") focus(col, idx + 1);
      else if ((k === "a" || k === "arrowleft") && cur && cur.change) cur.change(-1);
      else if ((k === "d" || k === "arrowright") && cur && cur.change) cur.change(1);
      else if ((k === "enter" || k === " ") && cur && cur.act) cur.act();
      else return;
      e.preventDefault(); legendFor();
    };
    const close = v => {
      window.removeEventListener("keydown", kd, true);
      m.classList.add("out"); setTimeout(() => m.remove(), 180);
      hud.root.classList.remove("paused"); done(v);
    };
    window.addEventListener("keydown", kd, true);
    hud.root.classList.add("paused"); hud.root.append(m);
    open("root");
  });
}
