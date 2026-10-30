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
  T.setJourneyState(Object.assign({ o: "x", d: "y", labelO: "Origin", labelD: "Dest",
    options: [opt], selected: 0, dayOffset: 0, dayDate: "2026-10-27",
    timeMode: { mode: "now" }, isToday: true, originWalkM: 0, originWalkMin: 0,
    boarding: null }, extra));
  T.fns.renderJourneyBoard();
};
const colsOf = () => (el("stripCols").children || []).map(c => (c.children || []).map(k => k.textContent));
const colWeights = () => (el("stripCols").children || []).map(c => parseFloat(c.style.flexGrow));
const dotLeft = (id) => parseFloat(el(id).style.left);
const branchPaths = () => (el("stripBranches").children || [])
  .flatMap(c => (c.children || []).filter(k => k._branchPath));

// ---- (a) Exact weights and column centers for all three transfer counts.
check("(a) direct weights are exactly 20/40/40",
  approxArr(T.fns.stripColumnAnchors(0).weights, [20, 40, 40], 1e-9),
  JSON.stringify(T.fns.stripColumnAnchors(0).weights));
check("(a) 1-transfer weights are exactly 15/28.33 x3",
  approxArr(T.fns.stripColumnAnchors(1).weights, [15, 85 / 3, 85 / 3, 85 / 3], 1e-9),
  JSON.stringify(T.fns.stripColumnAnchors(1).weights));
check("(a) 2-transfer weights are exactly 12/22 x4",
  approxArr(T.fns.stripColumnAnchors(2).weights, [12, 22, 22, 22, 22], 1e-9),
  JSON.stringify(T.fns.stripColumnAnchors(2).weights));
check("(a) direct centers are bus 10 / origin 40 / dest 80",
  approxArr([T.fns.stripColumnAnchors(0).bus, T.fns.stripColumnAnchors(0).board, T.fns.stripColumnAnchors(0).dest], [10, 40, 80]),
  JSON.stringify(T.fns.stripColumnAnchors(0)));
check("(a) 1-transfer centers are 7.5/29.17/57.5/85.83",
  approxArr([T.fns.stripColumnAnchors(1).bus, T.fns.stripColumnAnchors(1).board,
    ...T.fns.stripColumnAnchors(1).transfers, T.fns.stripColumnAnchors(1).dest],
    [7.5, 29.166666666666668, 57.5, 85.83333333333333]),
  JSON.stringify(T.fns.stripColumnAnchors(1)));
check("(a) 2-transfer centers are 6/23/45/67/89",
  approxArr([T.fns.stripColumnAnchors(2).bus, T.fns.stripColumnAnchors(2).board,
    ...T.fns.stripColumnAnchors(2).transfers, T.fns.stripColumnAnchors(2).dest],
    [6, 23, 45, 67, 89]),
  JSON.stringify(T.fns.stripColumnAnchors(2)));

// ---- (b) Rendered dots sit at column centers (stub fallback = fractions).
T.clearRT();
render(directOpt);
check("(b) direct rendered dots at bus 10 / origin 40 / dest 80",
  approx(dotLeft("stripBus"), 10) && approx(dotLeft("stripWait"), 40) && approx(dotLeft("stripDest"), 80),
  "bus=" + el("stripBus").style.left + " wait=" + el("stripWait").style.left + " dest=" + el("stripDest").style.left);
check("(b) direct rendered column weights are 20/40/40",
  approxArr(colWeights(), [20, 40, 40], 1e-9), JSON.stringify(colWeights()));
render(oneOpt);
check("(b) 1-transfer (different-stop fixture) rendered dots at bus 6 / origin 23 / alight 45 / dest 89",
  approx(dotLeft("stripBus"), 6) && approx(dotLeft("stripWait"), 23) &&
  approx(dotLeft("stripTransfer"), 45) && approx(dotLeft("stripDest"), 89),
  "bus=" + el("stripBus").style.left + " wait=" + el("stripWait").style.left +
  " transfer=" + el("stripTransfer").style.left + " dest=" + el("stripDest").style.left);
render(proofOpt);
check("(b) 2-transfer (both different-stop fixture) rendered dots at bus 5 / origin 17.5 / alight1 32.5 / dest 92.5",
  approx(dotLeft("stripBus"), 5) && approx(dotLeft("stripWait"), 17.5) &&
  approx(dotLeft("stripTransfer"), 32.5) && approx(dotLeft("stripDest"), 92.5),
  "bus=" + el("stripBus").style.left + " wait=" + el("stripWait").style.left +
  " transfer=" + el("stripTransfer").style.left + " dest=" + el("stripDest").style.left);
// Measured centers: fake layout rects (cols box 0..1000, columns at the
// weighted fractions) — measurement must reproduce the centers exactly,
// and RTL must mirror them back to the same LTR anchors.
{
  T.clearRT();
  render(directOpt);
  const box = el("stripCols");
  const kids = box.children || [];
  const bounds = [[0, 200], [200, 600], [600, 1000]]; // direct: 20/40/40
  box.getBoundingClientRect = () => ({ left: 0, width: 1000 });
  kids.forEach((k, i) => {
    const [l, r] = bounds[i];
    k.getBoundingClientRect = () => ({ left: l, width: r - l });
  });
  const measured = T.fns.measureStripCenters();
  check("(b) measured centers from fake layout are 10/40/80",
    !!measured && approxArr(measured, [10, 40, 80]), JSON.stringify(measured));
  const la = T.fns.measuredAnchors(measured, 0);
  check("(b) measured LTR anchors match the fraction anchors",
    !!la && approx(la.bus, 10) && approx(la.board, 40) && approx(la.dest, 80), JSON.stringify(la));
  // RTL render: the same columns mirrored — bus column (first in DOM)
  // sits at the right: rects [800,1000]/[400,800]/[0,400].
  getEl("html").dir = "rtl";
  const mirrored = [[800, 1000], [400, 800], [0, 400]];
  kids.forEach((k, i) => {
    const [l, r] = mirrored[i];
    k.getBoundingClientRect = () => ({ left: l, width: r - l });
  });
  const ra = T.fns.measuredAnchors(T.fns.measureStripCenters(), 0);
  check("(b) RTL: mirrored measured centers convert back to the same LTR anchors",
    !!ra && approx(ra.bus, 10) && approx(ra.board, 40) && approx(ra.dest, 80), JSON.stringify(ra));
  getEl("html").dir = "ltr";
  check("(b) measuredAnchors rejects a wrong-length center list",
    T.fns.measuredAnchors([10, 40], 0) === null);
}

// ---- (c) Bus column: stacked short lines, at-stop, fallbacks, no long sentence.
const dLeg = directOpt.legs[0];
T.setRT(tripUpdateAt(synth, 5), [[vehKey(synth), vehAt(sRows[1][0])]]);
render(synthOpt);
{
  const bc = colsOf()[0];
  check("(c) live bus column is stacked short lines: Bus coming / 2 stops away / est. ~min",
    bc[0] === "Bus coming" && bc[1] === "2 stops away" && /est\. ~\d+ min/.test(bc[2] || "") &&
    bc.every(l => l.length <= 30), JSON.stringify(bc));
}
T.setRT(tripUpdateAt(synth, 5), [[vehKey(synth), vehAt(synth.boardStop)]]);
render(synthOpt);
check("(c) vehicle at the boarding stop: bus column shows 'at your stop', never '0 stops away'",
  colsOf()[0].includes("at your stop") && !colsOf()[0].join(" ").includes("0 stops away"),
  JSON.stringify(colsOf()[0]));
T.setRT(tripUpdateAt(synth, 5), [[vehKey(synth), vehAt(sRows[6][0])]]);
render(synthOpt);
check("(c) vehicle past the boarding stop: bus column is plain 'Bus coming' only",
  JSON.stringify(colsOf()[0]) === JSON.stringify(["Bus coming"]), JSON.stringify(colsOf()[0]));
T.setRT(tripUpdateAt(synth, -5), [[vehKey(synth), vehAt(synth.boardStop)]]);
render(synthOpt);
check("(c) negative prediction: bus column is plain 'Bus coming' only",
  JSON.stringify(colsOf()[0]) === JSON.stringify(["Bus coming"]), JSON.stringify(colsOf()[0]));
T.clearRT();
render(directOpt);
check("(c) timetable mode: bus column is EMPTY (no 'Timetable' text; the pill above is the indicator)",
  JSON.stringify(colsOf()[0]) === JSON.stringify([""]), JSON.stringify(colsOf()[0]));
check("(c) the long 'Bus position not live yet' sentence never appears in the bus column",
  !colsOf()[0].join(" ").includes("Bus position not live yet"), JSON.stringify(colsOf()[0]));
check("(c) no full-width bus-status line element remains in the source",
  !html.includes("stripBusLine") && !html.includes("strip-busline"));

// ---- (d) Bottom-aligned columns, no mid-word breaks, no truncation, font scale.
{
  const css = html.split("<style>")[1].split("</style>")[0];
  check("(d) strip columns are bottom-aligned (align-items:flex-end)",
    /\.strip-cols\s*\{[^}]*align-items:\s*flex-end/.test(css));
  check("(d) station names break only at spaces (word-break:keep-all, overflow-wrap:normal)",
    /\.sc-name\s*\{[^}]*word-break:\s*keep-all/.test(css) && /\.sc-name\s*\{[^}]*overflow-wrap:\s*normal/.test(css));
  check("(d) no ellipsis truncation anywhere in the strip column rules",
    !/\.strip-col[^{]*\{[^}]*text-overflow:\s*ellipsis/.test(css));
  check("(d) font scale by column count: cols-3 15px, cols-4 14px, cols-5 13px",
    css.includes(".strip-cols.cols-3") && css.includes("15px") &&
    css.includes(".strip-cols.cols-4") && css.includes(".strip-cols.cols-5") && css.includes("13px"));
  check("(d) old fixed dot percentages are gone from the source",
    !html.includes("left:8%") && !html.includes("left:92%"));
  // Long names render in full through renderStripColumns (synthetic opt).
  const synthOpt = { transfers: 1,
    transferStops: [{ alightStop: "994", boardStop: "994", walkM: 0, walkMin: 0 }],
    legs: [
      { boardStop: "1550", boardDep: 630, alightStop: "994", alightArr: 656 },
      { boardStop: "994", boardDep: 677, alightStop: "1212", alightArr: 680 },
    ] };
  T.fns.renderStripColumns(synthOpt, { name: "Timetable", lines: [] });
  const sc = colsOf();
  check("(d) long names render in full, never truncated: 'Laird + Ridgeway' and 'Trafalgar Rd north of South Service Rd East'",
    sc[1][0] === "Laird + Ridgeway" && sc[2][0] === "Trafalgar Rd north of South Service Rd East",
    JSON.stringify(sc.map(c => c[0])));
  check("(d) synthetic 1-transfer columns carry the weighted flex-grow values",
    approxArr((el("stripCols").children || []).map(c => parseFloat(c.style.flexGrow)),
      [15, 85 / 3, 85 / 3, 85 / 3], 1e-9));
}

// ---- (e) Tracker and branch anchors equal column centers, all transfer counts.
{
  const a0 = T.fns.stripColumnAnchors(0);
  const s0 = T.fns.stripDotState(directOpt, a0, true);
  check("(e) direct tracker home (no live) is the bus column center (10)",
    s0.mode === "none" && s0.pct === 10, JSON.stringify(s0));
  const a1 = T.fns.stripColumnAnchors(1);
  T.clearRT();
  render(oneOpt);
  const op = branchPaths();
  check("(e) 1-transfer approach branch merges exactly at its board column (start 67-22+3=48 -> merge 67, alight 89; different-stop fixture)",
    op.length === 1 && approx(op[0]._branchPath.startPct, 48) && approx(op[0]._branchPath.mergePct, 67) && approx(op[0]._branchPath.alightPct, 89),
    JSON.stringify(op.map(p => p._branchPath)));
  const a2 = T.fns.stripColumnAnchors(2);
  render(proofOpt);
  const pp = branchPaths();
  check("(e) 2-transfer approach branches merge exactly at their board columns (leg1 start 47.5-22+3=28.5 -> merge 47.5, alight 62.5; leg2 start 77.5-22+6=61.5 -> merge 77.5, alight 92.5; both different-stop fixture)",
    pp.length === 2 && pp[0]._branchPath.startPct === 28.5 && pp[0]._branchPath.mergePct === 47.5 && pp[0]._branchPath.alightPct === 62.5 &&
    pp[1]._branchPath.startPct === 61.5 && pp[1]._branchPath.mergePct === 77.5 && pp[1]._branchPath.alightPct === 92.5,
    JSON.stringify(pp.map(p => p._branchPath)));
  check("(e) branchTrackerStates anchors follow the same centers, staggered start (57.5-22+3=38.5 -> merge 57.5, alight 85.83)",
    (() => { const st = T.fns.branchTrackerStates(oneOpt, a1, true);
      return st.length === 1 && approx(st[0].startPct, 38.5) && approx(st[0].mergePct, 57.5) && approx(st[0].alightPct, 85.83333333333333); })());
}

// ---- (f) Direct journey: no branch; exactly 3 columns, stop columns
// non-empty, bus column intentionally empty in timetable mode.
T.clearRT();
render(directOpt);
check("(f) direct journey has no branch and exactly 3 columns (bus column empty in timetable mode)",
  branchPaths().length === 0 && colsOf().length === 3 &&
  colsOf()[0].join("") === "" && colsOf()[1][0] && colsOf()[2][0], JSON.stringify(colsOf()));

console.log(failures === 0 ? "ALL STRIPALIGN CHECKS PASSED" : failures + " FAILURES");
process.exit(failures === 0 ? 0 : 1);
