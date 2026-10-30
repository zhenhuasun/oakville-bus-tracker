// Strip-redesign harness (2026-10-29): step A flex columns above the
// track (name + time, never truncated, transfer = stacked Arrive over
// Depart, no pipe format), and step B curved transfer branches below
// the track with per-leg tracker dots. Runs the real public/index.html
// inline script in Node with a stub DOM. No browser, no network, no deploy.
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
    setAttribute(k, v) { (this._attrs || (this._attrs = {}))[k] = String(v); },
    getAttribute(k) { return (this._attrs || {})[k]; }, style: {} };
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
    branchTrackerStates, branchPoint, stripDotState, stripColumnAnchors, legStopIndex, vehicleStopProgress,
    stripPlan, stripFractionAnchors,
    stopNameOf, stripStopName, fmtTime, pickLanguage },
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
// 1-transfer fixture: Oakville GO -> hospital area (R28 + R3 in the old proof).
let oneOpt = null;
for (const dest of ["1397", "986", "327"]) {
  const r = ranked("1212", dest);
  if (!r) continue;
  // Prefer a 1-transfer option whose leg-1 boarding stop is NOT the
  // trip's first row (so the "approaching" fixture has a prior row)
  // AND whose alighting stop is NOT the trip's last row (so the
  // "vehicle passed" fixture has a next row).
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
const mainLineOverlays = () => (trackStub.children || []).filter(k => k._stripPassedLi);
const colsOf = () => (el("stripCols").children || []).map(c => (c.children || []).map(k => k.textContent));
const branchKids = () => el("stripBranches").children || [];
const branchPaths = () => branchKids().flatMap(c => (c.children || []).filter(k => k._branchPath));
const branchDots = () => branchKids().filter(c => c._branchDot);
const labelBox = () => el("stripBranchLabels");
const branchLabels = () => (labelBox().children || []).filter(c => c._branchLabel);
const legRows = (leg) => T.tt().trips[leg.tripIdx][3];
const legIdx = (leg, stop, time, isBoard) => T.fns.legStopIndex(leg, stop, time, isBoard);

// ---- (a) Step A columns: name + time above, nothing below, no truncation, no pipe.
T.clearRT();
render(directOpt);
const dLeg = directOpt.legs[0];
const dCols = colsOf();
check("(a) direct: 3 columns (bus first), origin = name + Depart time, dest = name + Arrive time",
  dCols.length === 3 &&
  dCols[1][0] === T.fns.stripStopName(dLeg.boardStop) && dCols[1][1] === "Depart " + fmt(dLeg.boardDep) &&
  dCols[2][0] === T.fns.stripStopName(dLeg.alightStop) && dCols[2][1] === "Arrive " + fmt(dLeg.alightArr),
  JSON.stringify(dCols));
check("(a) direct: below-track branch zone empty (no branch, no labels below)",
  branchKids().length === 0, JSON.stringify(branchKids().length));
render(proofOpt);
const pCols = colsOf();
check("(a) 2-transfer (both different-stop fixture): 7 columns with split alight/board times",
  pCols.length === 7 &&
  pCols[2][1] === "Arrive " + fmt(proofOpt.legs[0].alightArr) && pCols[2].length === 2 &&
  pCols[3][1] === "Depart " + fmt(proofOpt.legs[1].boardDep) && pCols[3].length === 2 &&
  pCols[4][1] === "Arrive " + fmt(proofOpt.legs[1].alightArr) && pCols[4].length === 2 &&
  pCols[5][1] === "Depart " + fmt(proofOpt.legs[2].boardDep) && pCols[5].length === 2,
  JSON.stringify(pCols));
check("(a) no pipe-format transfer time in any column",
  !JSON.stringify(pCols).includes(" | "), JSON.stringify(pCols));
check("(a) no station name truncated with ellipsis",
  !JSON.stringify(pCols).includes("...") && !JSON.stringify(pCols).includes("\u2026"), JSON.stringify(pCols));
// RTL: Arabic pack words appear, DOM column order stays origin-first
// (the flex row mirrors via document direction, like the track dots).
T.fns.pickLanguage("ar");
getEl("html").dir = "rtl";
T.clearRT();
render(directOpt);
const arCols = colsOf();
const I18N = T.i18n();
check("(a) RTL (ar): bus column first in DOM, origin second, Arabic Depart/Arrive words",
  arCols[1] && arCols[1][0] === T.fns.stripStopName(dLeg.boardStop) && arCols[0][0] === "" &&
  arCols[1][1].startsWith(I18N.ar.departWord) && arCols[2][1].startsWith(I18N.ar.arrWord),
  JSON.stringify(arCols));
T.fns.pickLanguage("en");
getEl("html").dir = "ltr";

// ---- (b) Step B branch counts and merge points.
T.clearRT();
render(directOpt);
check("(b) direct journey has no branch", branchPaths().length === 0 && branchDots().length === 0);
render(oneOpt);
const oPaths = branchPaths();
check("(b) 1-transfer has exactly 1 approach branch, from staggered start (67-22+3=48) merging exactly at the board column (67), alight 89; different-stop fixture",
  oPaths.length === 1 && Math.abs(oPaths[0]._branchPath.startPct - 48) < 0.01 && Math.abs(oPaths[0]._branchPath.mergePct - 67) < 0.01 && Math.abs(oPaths[0]._branchPath.alightPct - 89) < 0.01,
  JSON.stringify(oPaths.map(p => p._branchPath)));
check("(b) branch carries a route label, never a station name below the track",
  branchLabels().length === 1 && branchLabels()[0].textContent.includes(oneOpt.legs[1].route) &&
  !branchLabels()[0].textContent.includes(T.fns.stopNameOf(oneOpt.legs[1].boardStop)),
  JSON.stringify(branchLabels().map(l => l.textContent)));
render(proofOpt);
const pPaths = branchPaths();
check("(b) 2-transfer has exactly 2 approach branches: leg1 start 47.5-22+3=28.5 -> merge 47.5, alight 62.5; leg2 start 77.5-22+6=61.5 -> merge 77.5, alight 92.5; both different-stop fixture",
  pPaths.length === 2 &&
  pPaths[0]._branchPath.startPct === 28.5 && pPaths[0]._branchPath.mergePct === 47.5 && pPaths[0]._branchPath.alightPct === 62.5 &&
  pPaths[1]._branchPath.startPct === 61.5 && pPaths[1]._branchPath.mergePct === 77.5 && pPaths[1]._branchPath.alightPct === 92.5,
  JSON.stringify(pPaths.map(p => p._branchPath)));
// Pure geometry: branchPoint endpoints and midpoint dip.
check("(b) branchPoint(0)=start, branchPoint(1)=end, midpoint dips to y=35",
  (() => { const a = T.fns.branchPoint(0, 30, 68), b = T.fns.branchPoint(1, 30, 68), m = T.fns.branchPoint(0.5, 30, 68);
    return a.xPct === 30 && a.yPx === 6 && b.xPct === 68 && b.yPx === 6 && m.xPct === 49 && m.yPx === 35; })(),
  JSON.stringify([T.fns.branchPoint(0, 30, 68), T.fns.branchPoint(0.5, 30, 68), T.fns.branchPoint(1, 30, 68)]));
// Invalid anchors: no fake line.
{
  const states = T.fns.renderStripBranches(oneOpt, { start: 8, board: 38, transfers: [], dest: 92 }, true);
  const pathsAfter = branchPaths();
  check("(b) invalid anchor pair (missing transfer anchor): no branch path drawn",
    states.length === 1 && states[0].mode === "none" && pathsAfter.length === 0,
    JSON.stringify(states));
}

// ---- (c) Branch trackers: per-leg, stop progress, fallbacks, no duplicates.
const oLeg1 = oneOpt.legs[1];
const oRows1 = legRows(oLeg1);
const oBi1 = legIdx(oLeg1, oLeg1.boardStop, oLeg1.boardDep, true);
const oAi1 = legIdx(oLeg1, oLeg1.alightStop, oLeg1.alightArr, false);
check("(c) 1-transfer leg-1 indices resolve", oBi1 >= 0 && oAi1 > oBi1, "bi=" + oBi1 + " ai=" + oAi1);
// Mid-ride (diagram-confirmed two-phase travel): a transfer leg past
// its boarding stop travels ON THE MAIN LINE -- its icon is a main-line
// tile at stop progress, not a branch dot; the leg-1-only main dot
// (leg 0, no vehicle here) stays visible as a dashed waiting tile.
{
  const mid = oRows1[Math.floor((oBi1 + oAi1) / 2)][0];
  T.setRT([], [[vehKey(oLeg1), vehAt(mid)]]);
  render(oneOpt);
  const mdots = mainLineDots();
  check("(c) leg-1 mid-ride: exactly one merged main-line icon tile, frac strictly between 0 and 1, no branch dot",
    mdots.length === 1 && mdots[0]._mainLineDot.li === 1 && mdots[0]._mainLineDot.mode === "merged" &&
    mdots[0]._mainLineDot.frac > 0 && mdots[0]._mainLineDot.frac < 1 &&
    typeof mdots[0].innerHTML === "string" && mdots[0].innerHTML.includes("<svg") &&
    branchDots().length === 0,
    JSON.stringify(mdots.map(d => d._mainLineDot)) + " branchDots=" + branchDots().length);
  check("(c) leg-0 main dot stays visible (dashed waiting tile) while leg 1 rides the main line",
    el("stripBus").hidden === false && el("stripBus").className.includes("dashed"),
    "hidden=" + el("stripBus").hidden + " class=" + el("stripBus").className);
}
// Approaching: vehicle before the boarding stop -> icon tile ON the
// branch at stop-index progress toward the board stop (never a fake
// precise position, never parked at the start unless vehIdx is 0).
{
  const before = oRows1[Math.max(0, oBi1 - 1)][0];
  T.setRT([], [[vehKey(oLeg1), vehAt(before)]]);
  render(oneOpt);
  const dots = branchDots();
  const rendered = branchPaths()[0]._branchPath;
  const expFrac = oBi1 === 0 ? 1 : (oBi1 - 1) / oBi1;
  check("(c) leg-1 approaching: branch icon tile, stop-progress frac, positioned on the elbow between branch start and merge (horizontal segment at depth 58 counts)",
    dots.length === 1 && dots[0]._branchDot.mode === "approaching" && dots[0]._branchDot.phase === "branch" &&
    dots[0]._branchDot.frac === expFrac && dots[0].className.includes("approaching") &&
    parseFloat(dots[0].style.left) > rendered.startPct && parseFloat(dots[0].style.left) < rendered.mergePct &&
    parseFloat(dots[0].style.top) > -16 && parseFloat(dots[0].style.top) <= 58,
    JSON.stringify(dots.map(d => [d._branchDot, d.className, d.style.left, d.style.top])) + " expFrac=" + expFrac);
}
// Passed: disappear rule -- vehicle past the alighting stop leaves NO
// icon (branch or main-line) for that leg and its live text clears.
{
  const past = oRows1[Math.min(oRows1.length - 1, oAi1 + 1)][0];
  T.setRT([], [[vehKey(oLeg1), vehAt(past)]]);
  render(oneOpt);
  const dots = branchDots();
  const mdots = mainLineDots();
  const lbl = branchLabels().find(l => l._branchLabel.li === 1);
  check("(c) leg-1 passed: no icon anywhere for that leg, label is route-only (live text cleared)",
    dots.length === 0 && mdots.filter(d => d._mainLineDot.li === 1).length === 0 &&
    !!lbl && lbl.textContent === "Route " + oLeg1.route,
    "branchDots=" + dots.length + " mainDots=" + JSON.stringify(mdots.map(d => d._mainLineDot)) + " label=" + (lbl && lbl.textContent));
}
// No vehicle for the leg: branch line drawn muted, waiting icon
// tile at the branch start + "not live yet" label (2026-10-30
// per-leg trackers) — never a moving dot, never a fake position.
{
  T.clearRT();
  render(oneOpt);
  const paths = branchPaths();
  const dots = branchDots();
  check("(c) leg-1 with no vehicle: branch path exists (muted), waiting icon tile only (no moving dot)",
    paths.length === 1 && paths[0]._branchPath.live === false && dots.length === 1 &&
    dots[0]._branchDot.mode === "waiting" && dots[0].className.includes("waiting") &&
    typeof dots[0].innerHTML === "string" && dots[0].innerHTML.includes("<svg"),
    JSON.stringify(paths.map(p => p._branchPath)) + " " + JSON.stringify(dots.map(d => [d._branchDot, d.className])));
}
// Simultaneous buses: leg-0 vehicle on the main track (main dot) +
// leg-1 vehicle merged onto the main line (its own main-line icon tile
// on a different segment -- two icons, no duplicate, no branch dot).
{
  const oLeg0 = oneOpt.legs[0];
  const oRows0 = legRows(oLeg0);
  const oBi0 = legIdx(oLeg0, oLeg0.boardStop, oLeg0.boardDep, true);
  const oAi0 = legIdx(oLeg0, oLeg0.alightStop, oLeg0.alightArr, false);
  const mid0 = oRows0[Math.floor((oBi0 + oAi0) / 2)][0];
  const mid1 = oRows1[Math.floor((oBi1 + oAi1) / 2)][0];
  T.setRT([], [[vehKey(oLeg0), vehAt(mid0)], [vehKey(oLeg1), vehAt(mid1)]]);
  render(oneOpt);
  check("(c) simultaneous buses: main dot moving for leg 0 AND merged main-line icon for leg 1 (different segments, no branch dot)",
    el("stripBus").hidden !== true && el("stripBus").className === "strip-dot bus" &&
    mainLineDots().length === 1 && mainLineDots()[0]._mainLineDot.li === 1 && branchDots().length === 0,
    "mainHidden=" + el("stripBus").hidden + " mainClass=" + el("stripBus").className +
    " mainLineDots=" + JSON.stringify(mainLineDots().map(d => d._mainLineDot)) + " branchDots=" + branchDots().length);
}

// ---- (d) RTL mirroring of branches.
{
  getEl("html").dir = "rtl";
  T.clearRT();
  render(oneOpt);
  const paths = branchPaths();
  check("(d) RTL: approach branch mirrors (start 48->52, merge 67->33, alight 89->11), same leg",
    paths.length === 1 && Math.abs(paths[0]._branchPath.startPct - 52) < 0.01 && Math.abs(paths[0]._branchPath.mergePct - 33) < 0.01 && Math.abs(paths[0]._branchPath.alightPct - 11) < 0.01,
    JSON.stringify(paths.map(p => p._branchPath)));
  getEl("html").dir = "ltr";
}

// ---- (e) Branch-label collision (2026-10-29, second real-phone
// report): the screenshot's 6-column journey has two branches whose
// midpoints sit 18% apart (64 and 82) while "Route 14" / "Route 120"
// are ~72/80px wide — they rendered as "Route 14Route 120".
// Synthetic replica: 6 columns (bus + origin + T1a + T1b + T2 +
// dest), leg 2 board T1b (center 55) -> alight T2 (73), leg 3 board
// T2 (73) -> dest (91). Labels must never share a level when their
// centers are closer than their half-widths + gap. Labels now live
// stacked in the below-diagram row (walk label, then leg labels in
// journey order), so close labels can never overlap the diagram at
// all, and the box height stays the curve base. Approach geometry: each path
// starts below (board - 22 + leg step) and merges exactly at its
// board column, then the leg continues on the main line to alight.
{
  const leg = (boardStop, boardDep, alightStop, alightArr, route) =>
    ({ route, boardStop: String(boardStop), boardDep, alightStop: String(alightStop),
       alightArr, stops: 5, original: "x", tripIdx: 0 });
  const syn = { transfers: 2, legs: [
    leg("1212", 373, "994", 401, "14"),
    leg("211", 408, "358", 433, "14"),
    leg("358", 455, "1550", 480, "120"),
  ], transferStops: [
    { alightStop: "994", boardStop: "211", walkM: 250, walkMin: 6 },
    { alightStop: "358", boardStop: "358", walkM: 0, walkMin: 0 },
  ] };
  const plan = T.fns.stripPlan(syn);
  const anchors = T.fns.stripFractionAnchors(plan);
  T.clearRT();
  T.fns.renderStripBranches(syn, anchors, true);
  const lbls = branchLabels();
  const box = el("stripBranches");
  const allRowLabels = el("stripBranchLabels").children || [];
  check("(e) screenshot replica: 2 branch labels in the below-diagram row (walk label first, journey order), none inside the diagram box",
    lbls.length === 2 && branchKids().every(c => !c._branchLabel && !c._walkLabel) &&
    allRowLabels.length === 3 && allRowLabels[0]._walkLabel && allRowLabels[0].textContent.includes("6") &&
    lbls[0]._branchLabel.li === 1 && lbls[1]._branchLabel.li === 2,
    JSON.stringify(allRowLabels.map(l => l.textContent)));
  check("(e) close branch labels no longer need staggering: box height stays the 2-transfer curve base 88px",
    box.style.height === "88px",
    "height=" + box.style.height);
  check("(e) stagger changes only label placement: approach paths still merge at board columns (36->55->73, 57->73->91)",
    branchPaths().length === 2 &&
    branchPaths()[0]._branchPath.startPct === 36 && branchPaths()[0]._branchPath.mergePct === 55 && branchPaths()[0]._branchPath.alightPct === 73 &&
    branchPaths()[1]._branchPath.startPct === 57 && branchPaths()[1]._branchPath.mergePct === 73 && branchPaths()[1]._branchPath.alightPct === 91,
    JSON.stringify(branchPaths().map(p => p._branchPath)));
  // Far-apart labels stay on one level and the box stays 64px.
  const far = { transfers: 1, legs: [
    leg("1212", 373, "994", 401, "1"),
    leg("211", 408, "1550", 480, "28"),
  ], transferStops: [{ alightStop: "994", boardStop: "211", walkM: 250, walkMin: 6 }] };
  const farPlan = T.fns.stripPlan(far);
  const farAnchors = T.fns.stripFractionAnchors(farPlan);
  T.clearRT();
  T.fns.renderStripBranches(far, farAnchors, true);
  const farLbls = branchLabels();
  check("(e) single branch label in the below-diagram row and the box height is the 1-transfer base 64px (set explicitly, not reset to CSS)",
    farLbls.length === 1 && el("stripBranches").style.height === "64px",
    JSON.stringify(farLbls.map(l => l.textContent)) + " height=" + JSON.stringify(el("stripBranches").style.height));
}

console.log(failures === 0 ? "ALL STRIPBRANCHES CHECKS PASSED" : failures + " FAILURES");
process.exit(failures === 0 ? 0 : 1);
