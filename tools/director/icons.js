// The desk's icons: plain line drawings on a 24 px grid, drawn for the desk (ours, no icon set), stroked in the
// text's colour so they follow the theme. icon(name, size) -> an <svg>.
const P = {
  // commands
  target: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8zM12 11.5v1",
  say: "M4 5h16v11H9l-5 4z",
  think: "M7 15a4 4 0 0 1-.5-8a5 5 0 0 1 9.5-1a4 4 0 0 1 1 9zM6 19.5a1 1 0 1 0 0 .1M3.5 21.5v.1",
  ask: "M4 5h16v11H9l-5 4zM9.5 9a2.5 2.5 0 1 1 3.3 2.4c-.5.2-.8.6-.8 1.1M12 14.5v.1",
  scene: "M3 6h18v12H3zM3 10h18M7 6l2 4M12 6l2 4M17 6l2 4",
  flag: "M5 21V4M5 4h11l-2 4l2 4H5",
  unflag: "M5 21V4M5 4h11l-2 4l2 4H5M3 3l18 18",
  item: "M4 8l8-4l8 4v8l-8 4l-8-4zM4 8l8 4l8-4M12 12v8",
  count: "M5 9h6M8 6v6M13 16h6M4 20L20 4",
  heart: "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z",
  door: "M6 3h12v18H6zM14.5 12v.1M3 21h18",
  light: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.5.4.5 1.1.5 1.6V16h6v-.5c0-.5 0-1.2.5-1.6A6 6 0 0 0 12 3z",
  show: "M2 12s4-7 10-7s10 7 10 7s-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z",
  hide: "M2 12s4-7 10-7c2 0 3.8.8 5.3 1.8M22 12s-4 7-10 7c-2 0-3.8-.8-5.3-1.8M3 3l18 18",
  move: "M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3",
  sound: "M4 9h4l5-4v14l-5-4H4zM16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11",
  music: "M9 18V5l11-2v13M9 18a3 3 0 1 1-3-3h3M20 16a3 3 0 1 1-3-3h3",
  trick: "M13 2L5 13h6l-1 9l8-11h-6z",
  person: "M12 3a4 4 0 1 0 0 8a4 4 0 1 0 0-8zM4 21a8 8 0 0 1 16 0",
  motion: "M13 4a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3zM7 21l3-6l3 2v5M10 15l1-6l4 3l3 1M11 9l-4 2l-1 3",
  camera: "M3 7h4l2-3h6l2 3h4v12H3zM12 10a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7z",
  clock: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 7v5l3 2",
  fade: "M12 3a9 9 0 1 0 0 18zM12 3a9 9 0 0 1 0 18",
  eye: "M2 12s4-7 10-7s10 7 10 7s-4 7-10 7S2 12 2 12zM12 10a2 2 0 1 0 0 4a2 2 0 1 0 0-4z",
  save: "M5 3h11l3 3v15H5zM8 3v5h7V3M8 21v-7h8v7",
  done: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM8 12l3 3l5-6",
  play: "M7 4l13 8l-13 8z",
  enter: "M14 4h5v16h-5M3 12h11M10 8l4 4l-4 4",
  exit: "M10 4H5v16h5M9 12h12M17 8l4 4l-4 4",
  hand: "M8 12V5a1.5 1.5 0 0 1 3 0v6M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7a6 6 0 0 1-5-3l-2-4a1.5 1.5 0 0 1 2.5-1.5L8 15",
  note: "M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7",
  dice: "M4 4h16v16H4zM8.5 8.5v.1M15.5 15.5v.1M15.5 8.5v.1M8.5 15.5v.1M12 12v.1",
  all: "M6 19l6-14l6 14",
  any: "M6 5l6 14l6-14",
  // the desk
  plus: "M12 5v14M5 12h14",
  x: "M6 6l12 12M18 6L6 18",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  grip: "M9 6v.1M15 6v.1M9 12v.1M15 12v.1M9 18v.1M15 18v.1",
  edit: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  search: "M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14zM16 16l5 5",
  undo: "M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
  redo: "M15 14l5-5l-5-5M20 9H9a5 5 0 0 0 0 10h3",
  check: "M5 12l4 4l10-10",
  upload: "M12 16V4M7 9l5-5l5 5M4 20h16",
  gear: "M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1",
  help: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM9.5 9.5a2.5 2.5 0 1 1 3.3 2.3c-.5.2-.8.7-.8 1.2v.5M12 16.5v.1",
  task: "M4 6h2M4 12h2M4 18h2M9 6h11M9 12h11M9 18h11",
  choice: "M12 21v-7l-6-6M12 14l6-6M6 8V4M6 4L4 6M6 4l2 2M18 8V4M18 4l-2 2M18 4l2 2",
  ending: "M5 21V4h14l-3 5l3 5H5",
  chevron: "M9 6l6 6l-6 6",
  down: "M6 9l6 6l6-6",
  stop: "M6 6h12v12H6z",
  box: "M3 7h18v13H3zM3 7l2-4h14l2 4M10 11h4",
  wand: "M4 20L16 8M14 4v2M18 8h2M17 5l1.5-1.5M19 3l-1.5 1.5M12 6l1-1",
  build: "M3 21h18M5 21V10l7-6l7 6v11M10 21v-6h4v6",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  fit: "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5",
  zoomin: "M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14zM16 16l5 5M8 11h6M11 8v6",
  zoomout: "M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14zM16 16l5 5M8 11h6",
  tree: "M4 5h6M4 12h6M4 19h6M14 5h6M14 12h6M14 19h6M10 5v14",
  film: "M4 4h16v16H4zM8 4v16M16 4v16M4 8h4M4 12h4M4 16h4M16 8h4M16 12h4M16 16h4",
};
export const ICONS = Object.keys(P);
export function icon(name, size = 16, cls = "") {
  const ns = "http://www.w3.org/2000/svg", s = document.createElementNS(ns, "svg");
  s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("width", size); s.setAttribute("height", size);
  s.setAttribute("fill", "none"); s.setAttribute("stroke", "currentColor"); s.setAttribute("stroke-width", "1.8");
  s.setAttribute("stroke-linecap", "round"); s.setAttribute("stroke-linejoin", "round"); s.setAttribute("aria-hidden", "true");
  s.setAttribute("class", "ic" + (cls ? " " + cls : ""));
  const p = document.createElementNS(ns, "path"); p.setAttribute("d", P[name] || P.box); s.append(p);
  return s;
}
