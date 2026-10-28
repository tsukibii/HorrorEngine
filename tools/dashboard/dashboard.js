// The dashboard's page: the launcher's tools as rows and tiles, what's running beside them, and the output of the one
// you're looking at (dashboard.py serves it and runs everything; this only draws and asks).
const $ = s => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "on") for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn);
    else if (k === "class") e.className = v;
    else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
};
const api = async (path, body) => {
  const r = await fetch("/api/" + path, body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
};
const WHISPERS = ["the lights are off. pick a door.", "something is breathing in the build folder.", "every take is ten seconds or less. she isn't.",
  "don't look behind the locker slats.", "the desk remembers what you left on it.", "she was in the hallway a second ago."];
let TOOLS = [], SECTIONS = [], STATUS = { pages: [], jobs: [], recent: [] }, VALUES = {}, OUT = null, FOLD = {}, LAST = "";
try { FOLD = JSON.parse(localStorage.getItem("dash.fold") || "{}"); VALUES = JSON.parse(localStorage.getItem("dash.values") || "{}"); } catch (e) { }

function toast(text, bad = false) {
  const t = $("#toast"); t.textContent = text; t.classList.toggle("bad", bad); t.classList.add("on");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), bad ? 6000 : 2600);
}
const short = label => label.replace(/\s*\(.*\)\s*$/, "");
const desc = label => (label.match(/\((.*)\)\s*$/) || [])[1] || "";
const pageOf = label => STATUS.pages.find(p => p.labels.includes(label));
const serverUp = t => t.url && STATUS.pages.find(p => Object.keys(p.urls).some(l => (TOOLS.find(x => x.label === l) || {}).server === t.server));
const jobsOf = t => STATUS.jobs.filter(j => j.i === t.i);
const runningJob = t => jobsOf(t).find(j => j.status === "running");
const ago = secs => { const s = Math.max(0, Date.now() / 1000 - secs); return s < 60 ? `${Math.round(s)} s` : s < 3600 ? `${Math.round(s / 60)} min` : `${(s / 3600).toFixed(1)} h`; };

// ---- the tools ---------------------------------------------------------------------------------------------------
function fieldInputs(t) {
  const v = VALUES[t.i] = VALUES[t.i] || {};
  return t.fields.filter(f => f.kind !== "game").map(f => el("input", { placeholder: f.prompt + (f.kind === "opt" ? " (optional)" : ""), title: f.prompt, value: v[f.key] || "",
    on: { input: e => { v[f.key] = e.target.value; try { localStorage.setItem("dash.values", JSON.stringify(VALUES)); } catch (_) { } }, keydown: e => { if (e.key === "Enter") run(t); } } }));
}
function buttons(t) {
  if (t.url) {
    const up = pageOf(t.label), srv = serverUp(t);
    return [up || srv ? el("button", { class: up ? "" : "go", on: { click: () => (up ? openUrl(t.url) : run(t)) } }, "Open") : el("button", { class: "go", on: { click: () => run(t) } }, "Start"),
      up ? el("button", { class: "danger", title: up.labels.length > 1 ? "stops its server, and with it: " + up.labels.map(short).join(", ") : "stop its server", on: { click: () => stopPage(up) } }, "Stop") : null];
  }
  const j = runningJob(t);
  return [j ? el("button", { class: "danger", on: { click: () => stopJob(j.id) } }, "Stop") : el("button", { class: "go", on: { click: () => run(t) } }, "Run")];
}
function status(t) {
  if (t.url) return el("span", { class: "dot" + (pageOf(t.label) ? " up" : ""), title: pageOf(t.label) ? "running" : "not running" });
  const j = jobsOf(t)[0];
  return el("span", { class: "dot " + (j ? (j.status === "running" ? "run" : j.status) : ""), title: j ? j.status : "" });
}
function drawTools() {
  const words = $("#filter").value.toLowerCase().split(/\s+/).filter(Boolean);
  const hit = t => words.every(w => (t.section + " " + t.label + " " + t.cmd).toLowerCase().includes(w));
  const start = $("#start"); start.replaceChildren();
  if (!words.length) for (const t of TOOLS.filter(t => t.start)) {
    const up = pageOf(t.label);
    start.append(el("div", { class: "tile" + (up ? " up" : "") }, el("div", { class: "h" }, status(t), short(t.label)), el("div", { class: "d" }, desc(t.label) || t.url),
      el("div", { class: "b" }, ...buttons(t), up ? el("button", { class: "ghost", title: "its server's output", on: { click: () => showPage(up) } }, "log") : null)));
  }
  const list = $("#list"); list.replaceChildren();
  for (const s of SECTIONS) {
    const ts = TOOLS.filter(t => t.section === s && hit(t)); if (!ts.length) continue;
    const sec = el("div", { class: "sec" + (FOLD[s] && !words.length ? " fold" : "") },
      el("div", { class: "sec-h", on: { click: () => { FOLD[s] = !FOLD[s]; try { localStorage.setItem("dash.fold", JSON.stringify(FOLD)); } catch (_) { } drawTools(); } } }, (FOLD[s] && !words.length ? "▸ " : "▾ ") + s, el("span", { class: "n" }, ts.length)));
    for (const t of ts) {
      const up = t.url && pageOf(t.label);
      sec.append(el("div", { class: "row" + (up ? " up" : ""), on: { click: e => { if (e.target.closest("button,input")) return; const j = jobsOf(t)[0]; if (j) showJob(j); else if (up) showPage(up); } } },
        status(t), el("div", { class: "t" }, el("div", { class: "label" }, t.label), el("div", { class: "cmd", title: t.cmd }, t.cmd + (t.url ? "  →  " + t.url : ""))),
        el("div", { class: "f" }, ...fieldInputs(t)), el("div", { class: "b" }, ...buttons(t))));
    }
    list.append(sec);
  }
}

// ---- running and recent ----------------------------------------------------------------------------------------
function drawActivity() {
  const box = $("#activity"); box.replaceChildren();
  for (const p of STATUS.pages) box.append(el("div", { class: "act" + (OUT && OUT.page === p.key ? " on" : ""), on: { click: e => { if (!e.target.closest("button")) showPage(p); } } },
    el("span", { class: "dot up" }), el("div", { class: "t" }, el("div", {}, p.labels.map(short).join(" · ")), el("div", { class: "sub" }, `${p.key} · pid ${p.pid}${p.since ? " · " + ago(p.since) : ""}`)),
    el("button", { class: "ghost", on: { click: () => openUrl(Object.values(p.urls)[0]) } }, "Open"), el("button", { class: "danger", on: { click: () => stopPage(p) } }, "Stop")));
  for (const j of STATUS.jobs.slice(0, 14)) box.append(el("div", { class: "act" + (OUT && OUT.job === j.id ? " on" : ""), on: { click: e => { if (!e.target.closest("button")) showJob(j); } } },
    el("span", { class: "dot " + (j.status === "running" ? "run" : j.status) }), el("div", { class: "t" }, el("div", {}, short(j.label)), el("div", { class: "sub" }, j.result || j.shown)),
    el("span", { class: "chip " + j.status }, j.status === "running" ? "running " + ago(j.started) : j.status), j.status === "running" ? el("button", { class: "danger", on: { click: () => stopJob(j.id) } }, "Stop") : null));
  if (!STATUS.pages.length && !STATUS.jobs.length) box.append(el("div", { class: "act muted" }, "Nothing running. Start a page or run a check."));
  const n = STATUS.pages.length + STATUS.jobs.filter(j => j.status === "running").length;
  $("#running").textContent = n ? `● ${n} running` : "";
}

// ---- the output panel: a job's log or a page server's, followed while it grows ---------------------------------------
function paintLines(text) {
  const frag = document.createDocumentFragment();
  for (const line of text.split(/(?<=\n)/)) {
    const cls = /^❯ /.test(line) ? "cmdl" : /\b[A-Z][A-Z0-9 _]{1,30} ok\b|^\s*ok\s/.test(line) ? "okl" : /FAILED|ERROR|Traceback|^\s*FAIL\b|Error:/.test(line) ? "badl" : null;
    frag.append(cls ? el("span", { class: cls }, line) : document.createTextNode(line));
  }
  return frag;
}
function showJob(j) { OUT = { job: j.id, from: 0, title: short(j.label), shown: j.shown, i: j.i }; startOut(); }
function showPage(p) { OUT = { page: p.key, from: 0, title: p.labels.map(short).join(" · ") + " (its server)", shown: p.key }; startOut(); }
function startOut() {
  $("#out").replaceChildren(); $("#outTitle").textContent = OUT.title;
  const j = OUT.job && STATUS.jobs.find(x => x.id === OUT.job);
  $("#outTools").replaceChildren(
    el("button", { class: "ghost", title: "copy the command, to run it in a terminal yourself", on: { click: () => { navigator.clipboard.writeText(OUT.shown).then(() => toast("copied: " + OUT.shown)); } } }, "copy command"),
    j && j.status !== "running" ? el("button", { class: "ghost", on: { click: () => { const t = TOOLS.find(x => x.i === j.i); if (t) run(t); } } }, "run again") : null);
  pollOut(); drawActivity();
}
async function pollOut() {
  if (!OUT) return;
  const o = OUT;
  try {
    const r = await api(`log?${o.job ? "job=" + encodeURIComponent(o.job) : "page=" + encodeURIComponent(o.page)}&from=${o.from}`);
    if (o !== OUT) return;
    const box = $("#out"), atEnd = box.scrollTop + box.clientHeight >= box.scrollHeight - 30;
    if (r.text) { box.append(paintLines(r.text)); if (atEnd || !o.from) box.scrollTop = box.scrollHeight; }
    o.from = r.size;
  } catch (e) { }
}

// ---- acting ------------------------------------------------------------------------------------------------------
function openUrl(url) { window.open(url, "_blank"); }
async function run(t) {
  const values = Object.assign({ game: $("#game").value }, VALUES[t.i] || {});
  const w = t.url ? window.open("", "_blank") : null;             // opened now, while the click still counts; pointed at the page once it answers
  if (w) w.document.write(`<body style="background:#0b0909;color:#8d827a;font:16px system-ui;padding:40px">Starting ${short(t.label)}…</body>`);
  try {
    const r = await api("run", { i: t.i, values });
    if (r.error) throw Object.assign(new Error(r.error), { tail: r.tail });
    if (r.kind === "page") {
      if (w) w.location.href = r.url;
      toast(r.already ? `${short(t.label)}: its server is already up` : r.answering === false ? `${short(t.label)} is starting (slowly): reload its page in a moment` : `${short(t.label)} is up`);
    } else { toast(`running: ${short(t.label)}`); await refresh(); const j = STATUS.jobs.find(x => x.id === r.job); if (j) showJob(j); }
  } catch (e) {
    if (w) w.close();
    toast(e.message, true);
    if (e.tail) { OUT = null; $("#outTitle").textContent = short(t.label) + ": its output"; $("#out").replaceChildren(paintLines(e.tail)); }
  }
  refresh();
}
async function stopPage(p) {
  if (p.labels.length > 1 && !confirm(`Stop the server behind ${p.labels.map(short).join(", ")}?`)) return;
  try { await api("stop", { page: p.key }); toast("stopped: " + p.labels.map(short).join(", ")); } catch (e) { toast(e.message, true); }
  refresh();
}
async function stopJob(id) { try { await api("stop", { job: id }); } catch (e) { toast(e.message, true); } refresh(); }

async function refresh() {
  try { STATUS = await api("status"); } catch (e) { $("#running").textContent = "the dashboard isn't answering"; return; }
  const sig = JSON.stringify([STATUS.pages.map(p => [p.key, p.labels]), STATUS.jobs.map(j => [j.id, j.status])]);
  drawActivity();
  if (sig !== LAST && !(document.activeElement && document.activeElement.closest && document.activeElement.closest("#list input"))) { LAST = sig; drawTools(); }   // only when something changed (and not while typing)
  if (OUT && OUT.job) { const j = STATUS.jobs.find(x => x.id === OUT.job); if (j && OUT.status !== j.status) { OUT.status = j.status; startOutTools(j); } }
}
function startOutTools(j) {
  const t = $("#outTools");
  if (j.status !== "running" && !t.textContent.includes("run again")) t.append(el("button", { class: "ghost", on: { click: () => { const x = TOOLS.find(y => y.i === j.i); if (x) run(x); } } }, "run again"));
}

async function init() {
  $("#whisper").textContent = WHISPERS[Math.floor(Date.now() / 1000) % WHISPERS.length];
  const r = await api("tools");
  TOOLS = r.tools; SECTIONS = r.sections;
  const g = $("#game"); g.replaceChildren(...r.games.map(x => el("option", { value: x, selected: x === r.game }, x)));
  g.addEventListener("change", () => api("game", { game: g.value }).then(() => toast("game: " + g.value)).catch(e => toast(e.message, true)));
  $("#filter").addEventListener("input", () => drawTools());
  $("#stopAll").addEventListener("click", async () => {
    if (!confirm("Stop every page server and every running job?")) return;
    const x = await api("stop_all", {}); toast(`stopped ${x.pages} page server(s) and ${x.jobs} job(s)`); refresh();
  });
  document.addEventListener("keydown", e => { if (e.key === "/" && !e.target.closest("input,select,textarea")) { e.preventDefault(); $("#filter").focus(); } });
  await refresh();
  setInterval(refresh, 1500);
  setInterval(pollOut, 1000);
}
init();
window.__dash = { get status() { return STATUS; }, get tools() { return TOOLS; }, run, refresh };
