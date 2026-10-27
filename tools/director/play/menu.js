// The pause menu (Esc in Play; docs/GAMEPLAY_PLAN.md §10): the game holds, the lights go out (the frame flickers down
// to nearly black) and the menu is drawn over it in the HUD's theme. Resume, Save game (slots), Settings (Display &
// Graphics, Audio), Quit (a footer choice, like any other). The reference for Unreal's menu: the same pages and rows,
// and every setting names what it maps to there (`ue`: a console variable, a scalability group, a sound class).
// Values step with ‹ › (A/D), never a slider; levels are ten dashes, the HUD's meter cut in steps.
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
      { id: "shadows", label: "Shadows", values: QUALITY, def: 2, sg: true, ue: "sg.ShadowQuality" },
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
    m.append(dark, nav, page, legend);
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
