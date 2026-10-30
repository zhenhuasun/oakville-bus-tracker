// Weighted-column strip alignment harness (2026-10-29): after a real-phone
// screenshot showed strip columns misaligned with strip dots (equal-width
// columns vs fixed-percentage dots, plus mid-word breaks like "Ridgewa y").
// Columns now define dot positions: bus column (narrow) + one column per
// stop, dots at measured column centers (fraction formula as fallback).
// Runs the real public/index.html inline script in Node with a stub DOM.
// No browser, no network, no deploy.
import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, "public", "index.html"), "utf8");
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
const pairs = JSON.parse(fs.readFileSync(path.join(dir, "public", "pairs.json"), "utf8"));
const stops = JSON.parse(fs.readFileSync(path.join(dir, "public", "stops.json"), "utf8"));
const tt = JSON.parse(fs.readFileSync(path.join(dir, "public", "timetable.json"), "utf8"));
const places = JSON.parse(fs.readFileSync(path.join(dir, "public", "places.json"), "utf8"));

function makeEl(id) {
  const el = { id, _html: "", textContent: "", className: "", hidden: false,
    disabled: false, title: "", value: "", placeholder: "", lang: "", dir: "",
    children: [], appendChild(c) { this.children.push(c); return c; },
    setAttribute() {}, style: {} };
  Object.defineProperty(el, "innerHTML", {
    get() { return this._html; }, set(v) { this._html = v; this.children = []; },
  });
  return el;
}
const els = new Map();
function getEl(id) { if (!els.has(id)) els.set(id, makeEl(id)); return els.get(id); }
const store = new Map();
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const sandbox = {
  console, localStorage,
  navigator: { geolocation: { getCurrentPosition(ok) {
    ok({ coords: { latitude: 43.4558, longitude: -79.6824 } }); } } },
  setInterval: () => 0, clearInterval: () => {},
  fetch: async (url) => {
    const u = String(url);
    if (u.includes("pairs.json")) return { json: async () => pairs };
    if (u.includes("stops.json")) return { json: async () => stops };
    if (u.includes("timetable.json")) return { json: async () => tt };
    if (u.includes("places.json")) return { json: async () => places };
    return { json: async () => ({ ok: false, trips: [], vehicles: [], alerts: [] }) };
  },
  document: { getElementById: getEl, createElement: () => makeEl(""),
    documentElement: getEl("html") },
};
vm.createContext(sandbox);
vm.runInContext(script + `\nglobalThis.__t = {
  tt: () => TT,
  journey: () => journeyState,
  i18n: () => I18N,
  setJourneyState: (j) => { journeyState = j; },
  setRT: (trips, vehicles) => { RT.trips = new Map(trips); RT.vehicles = new Map(vehicles); RT.ok = true; },
  clearRT: () => { RT.trips = new Map(); RT.vehicles = new Map(); RT.alerts = []; RT.ok = false; },
  fns: { searchJourneys, renderJourneyBoard, renderStripColumns, renderStripBranches,
    branchTrackerStates, branchPoint, stripDotState, stripColumnAnchors,
    measureStripCenters, measuredAnchors, busAwayParts, legStopIndex, vehicleStopProgress,
    stopNameOf, fmtTime, pickLanguage },
};\n`, sandbox);
const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 60 && !sandbox.__t.tt(); i++) await tick();
await tick(200);
const T = sandbox.__t;
const el = (id) => getEl(id);
let failures = 0;
function check(name, cond, extra = "") {
  console.log((cond ? "PASS" : "FAIL") + " " + name + (cond ? "" : " " + extra));
  if (!cond) failures++;
}
const approx = (a, b, eps = 0.01) => Math.abs(a - b) < eps;
const approxArr = (a, b, eps = 0.01) => a.length === b.length && a.every((v, i) => approx(v, b[i], eps));
const fmt = (m) => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(Math.floor(m % 60)).padStart(2, "0");
const stopCoord = (id) => { const s = stops.stops.find(x => x.id === String(id)); return s ? [s.lat, s.lon] : null; };
const tueMorning = new Date("2026-10-27T12:10:00Z"); // Tue 2026-10-27 08:10 EDT
const ranked = (o, d) => T.fns.searchJourneys(o, d, tueMorning, null,
  { rank: "total", timeMode: { mode: "now" }, originWalkMin: 0, destEndpoint: null });
const direct = ranked("1212", "789");
const directOpt = direct && direct.options.find(o => o.transfers === 0);
check("fixture direct option exists", !!directOpt);
const proof = ranked("1293", "562");
const proofOpt = proof && proof.options.find(o => o.transfers === 2);
check("fixture 2-transfer option exists", !!proofOpt);
let oneOpt = null;
for (const dest of ["1397", "986", "327"]) {
  const r = ranked("1212", dest);
  if (!r) continue;
  for (const o of r.options.filter(x => x.transfers === 1)) {
    const leg = o.legs[1];
    const rows = T.tt().trips[leg.tripIdx][3];
    const bi = T.fns.legStopIndex(leg, leg.boardStop, leg.boardDep, true);
    const ai = T.fns.legStopIndex(leg, leg.alightStop, leg.alightArr, false);
    if (bi >= 1 && ai >= 0 && ai + 1 < rows.length) { oneOpt = o; break; }
  }
  if (oneOpt) break;
  if (!oneOpt) oneOpt = r.options.find(o => o.transfers === 1) || oneOpt;
}
check("fixture 1-transfer option exists", !!oneOpt);
const vehAt = (stopId) => { const c = stopCoord(stopId); return { latitude: c[0], longitude: c[1] }; };
const vehKey = (leg) => leg.original + "|" + leg.route;
const tripUpdateAt = (leg, minutesFromNow) => [[vehKey(leg),
  { stops: [{ stop_id: leg.boardStop, time: Math.floor(Date.now() / 1000) + minutesFromNow * 60 }] }]];
// Synthetic mid-trip leg (real trip rows): the direct fixture boards at a
// trip-start terminal (index 0), so "N stops before boarding" fixtures
// need a leg that boards mid-trip. Board index 3, alight index 5.
let synth = null;
for (let ti = 0; ti < T.tt().trips.length && !synth; ti++) {
  const tr = T.tt().trips[ti];
  if (tr[3].length >= 8) {
    synth = { route: tr[0], service: tr[1], original: tr[2], tripIdx: ti,
      boardStop: tr[3][3][0], boardDep: tr[3][3][2],
      alightStop: tr[3][5][0], alightArr: tr[3][5][1], stops: 2 };
  }
}
check("synthetic mid-trip leg fixture exists", !!synth);
const synthOpt = { legs: [synth], transfers: 0 };
const sRows = T.tt().trips[synth.tripIdx][3];
const render = (opt, extra = {}) => {
  trackStub.children = [];
  T.setJourneyState(Object.assign({ o: "x", d: "y", labelO: "Origin", labelD: "Dest",
    options: [opt], selected: 0, dayOffset: 0, dayDate: "2026-10-27",
    timeMode: { mode: "now" }, isToday: true, originWalkM: 0, originWalkMin: 0,
    boarding: null }, extra));
  T.fns.renderJourneyBoard();
};
const trackStub = makeEl("stripTrack");
el("stripBus").parentNode = trackStub;
const mainLineDots = () => (trackStub.children || []).filter(k => k._mainLineDot);
const colsOf = () => (el("stripCols").children || []).map(c => (c.children || []).map(k => k.textContent));
const colWeights = () => (el("stripCols").children || []).map(c => parseFloat(c.style.flexGrow));
const dotLeft = (id) => parseFloat(el(id).style.left);
const branchPaths = () => (el("stripBranches").children || [])
  .flatMap(c => (c.children || []).filter(k => k._branchPath));

// ---- Bus icon checks (2026-10-29): strip tracker is a blue bus icon,
// not a circle and not an emoji; map live dot is untouched.
const hasBusSvg = (s) => typeof s === "string" && s.includes("<svg") && s.includes("<circle") && !s.includes("🚌");
const css = html.match(/<style>([\s\S]*?)<\/style>/) ? html.match(/<style>([\s\S]*?)<\/style>/)[1] : html;
check("(a) main strip bus tile is 32px blue rounded tile in CSS",
  /\.strip-dot\.bus\s*\{[^}]*width:32px[^}]*border-radius:9px[^}]*background:var\(--blue\)/.test(css),
  "css block not found");
check("(a) branch tracker tile is 30px blue rounded tile in CSS",
  /\.branch-dot\s*\{[^}]*width:30px[^}]*border-radius:8px[^}]*background:var\(--blue\)/.test(css),
  "branch css block not found");
const iconConst = (script.match(/STRIP_BUS_ICON_SVG = '([^']*)'/) || [])[1] || "";
check("(a) bus icon is inline SVG in the script (STRIP_BUS_ICON_SVG), no emoji in the icon itself",
  script.includes("STRIP_BUS_ICON_SVG") && iconConst.includes('viewBox="0 0 32 32"') && !iconConst.includes("🚌"),
  "icon constant missing or contains emoji");
check("(a) station dots keep their circle CSS (26px, radius 50%)",
  /\.strip-dot\s*\{[^}]*width:26px[^}]*border-radius:50%/.test(css),
  "station dot css changed");

// Waiting (timetable, no live vehicle): dashed class + icon present.
T.clearRT();
render(directOpt);
check("(b) waiting main tracker: dashed class + SVG bus icon present",
  el("stripBus").className.includes("dashed") && hasBusSvg(el("stripBus").innerHTML),
  el("stripBus").className + " innerHTML=" + el("stripBus").innerHTML);
check("(b) waiting main tracker keeps its column-center anchor (direct bus 10)",
  approx(dotLeft("stripBus"), 10), el("stripBus").style.left);

// Moving: live vehicle at the boarding stop of the direct leg.
{
  const leg = directOpt.legs[0];
  const c = stopCoord(leg.boardStop);
  T.setRT([], [[vehKey(leg), { latitude: c[0], longitude: c[1] }]]);
  render(directOpt);
  check("(b) moving main tracker: solid bus class + SVG icon, still at anchor",
    el("stripBus").className === "strip-dot bus" && hasBusSvg(el("stripBus").innerHTML),
    el("stripBus").className + " left=" + el("stripBus").style.left);
}

// Arrived: live vehicle past the alighting stop (use last stop of the trip).
{
  const leg = directOpt.legs[0];
  const rows = T.tt().trips[leg.tripIdx][3];
  const last = rows[rows.length - 1];
  const c = stopCoord(last[0]);
  T.setRT([], [[vehKey(leg), { latitude: c[0], longitude: c[1] }]]);
  render(directOpt);
  check("(b) arrived main tracker: arrived class + opacity 0 + SVG icon kept",
    el("stripBus").className.includes("arrived") && el("stripBus").style.opacity === "0" && hasBusSvg(el("stripBus").innerHTML),
    el("stripBus").className + " opacity=" + el("stripBus").style.opacity);
}

// Merged transfer trackers (2-transfer proof, diagram-confirmed
// two-phase model): live vehicles AT each transfer leg's boarding stop
// count as merged, so both icons ride the MAIN LINE (not the branch
// box) as SVG bus tiles; the branch box holds no moving dots.
{
  const legs = proofOpt.legs;
  const vehs = [];
  for (let li = 1; li < legs.length; li++) {
    const c = stopCoord(legs[li].boardStop);
    vehs.push([vehKey(legs[li]), { latitude: c[0], longitude: c[1] }]);
  }
  T.setRT([], vehs);
  render(proofOpt);
  const mdots = mainLineDots();
  const bdots = (el("stripBranches").children || []).filter(k => k._branchDot);
  check("(d) merged transfer trackers exist for legs 1 and 2 on the main line and carry the SVG bus icon",
    mdots.length === 2 && mdots.every(d => hasBusSvg(d.innerHTML)) && bdots.length === 0,
    "mainDots=" + JSON.stringify(mdots.map(d => d._mainLineDot)) + " branchDots=" + bdots.length);
  check("(d) merged tracker tiles are not circles (class strip-dot bus tile CSS, SVG icon)",
    mdots.every(d => d.className === "strip-dot bus" && hasBusSvg(d.innerHTML)),
    mdots.map(d => d.className).join(","));
}

// RTL: direct journey, bus anchor mirrors to 90.
{
  T.clearRT();
  getEl("html").dir = "rtl";
  render(directOpt);
  check("(c) RTL: main tracker anchor mirrors (direct bus 90) and icon stays",
    approx(dotLeft("stripBus"), 90) && hasBusSvg(el("stripBus").innerHTML),
    el("stripBus").style.left);
  getEl("html").dir = "ltr";
}

// (e) Map live dot untouched: green circle + white arrowhead divIcon code.
check("(e) map live dot still green circle + white arrowhead (untouched)",
  script.includes("liveDotIconHtml") && script.includes("#1a7a2e") &&
  /for \(const d of data\.liveDots\)/.test(script),
  "map live-dot code changed or missing");
check("(e) map code has no bus-icon SVG (STRIP_BUS_ICON_SVG used only by strip)",
  !/renderMapLeaflet[\s\S]{0,4000}STRIP_BUS_ICON_SVG/.test(script) &&
  script.indexOf("STRIP_BUS_ICON_SVG") < script.indexOf("function renderMapLeaflet"),
  "icon constant leaked into map code");

if (failures) { console.log("FAILURES: " + failures); process.exit(1); }
console.log("ALL BUSICON CHECKS PASSED");
