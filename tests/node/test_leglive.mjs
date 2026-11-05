// Per-leg live trackers + strip restyle harness (2026-10-30, updated
// for the diagram-confirmed two-phase model): legs 2/3 each have ONE
// approach branch below the main line merging exactly at their board
// dot (near-vertical tangent), then travel ON the main line to their
// alight dot. Approaching legs ride their branch at stop-index
// progress; merged legs ride the main line; unmatched legs show a
// waiting icon tile at the branch start + short "not live yet" label,
// never a fake moving dot; passed legs disappear (no icon, no text).
// BUS MARKERS ARE ICON TILES: every bus marker asserted here must be
// the rounded inline-SVG bus icon tile (innerHTML contains <svg>),
// never a circle/dot. Station dots (green/red/black circles) are the
// only circles on the strip.
import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, "..", "..", "public", "index.html"), "utf8");
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
const pairs = JSON.parse(fs.readFileSync(path.join(dir, "..", "..", "public", "pairs.json"), "utf8"));
const stops = JSON.parse(fs.readFileSync(path.join(dir, "..", "..", "public", "stops.json"), "utf8"));
const tt = JSON.parse(fs.readFileSync(path.join(dir, "..", "..", "public", "timetable.json"), "utf8"));
const places = JSON.parse(fs.readFileSync(path.join(dir, "..", "..", "public", "places.json"), "utf8"));

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
  i18n: () => I18N,
  setJourneyState: (j) => { journeyState = j; },
  setRT: (trips, vehicles) => { RT.trips = new Map(trips); RT.vehicles = new Map(vehicles); RT.ok = true; },
  clearRT: () => { RT.trips = new Map(); RT.vehicles = new Map(); RT.alerts = []; RT.ok = false; },
  fns: { searchJourneys, renderJourneyBoard, renderStripBranches,
    branchTrackerStates, branchPoint, stripPlan, stripFractionAnchors,
    legStopIndex, vehicleStopProgress, liveVehicleForLeg, legLive,
    stopNameOf, stripStopName, fmtTime },
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
const stopCoord = (id) => { const s = stops.stops.find(x => x.id === String(id)); return s ? [s.lat, s.lon] : null; };
const tueMorning = new Date("2026-11-17T13:10:00Z");
const ranked = (o, d) => T.fns.searchJourneys(o, d, tueMorning, null,
  { rank: "total", timeMode: { mode: "now" }, originWalkMin: 0, destEndpoint: null });
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

// (a) Main track grey darkened, and only the track (not the global line var).
check("main track bar is transparent (segments paint the #bbb solids; no single full bar under walks)",
  /\.strip-track\s*\{[^}]*background:transparent/.test(html));
check("global --line stays #ddd (borders unchanged)",
  /--line:#ddd/.test(html));

// Helpers for RT fixtures.
const vehAtRow = (leg, rowIdx) => {
  const rows = T.tt().trips[leg.tripIdx][3];
  const c = stopCoord(rows[rowIdx][0]);
  return { latitude: c[0], longitude: c[1] };
};
const vehKey = (leg) => leg.original + "|" + leg.route;
const tripUpdate = (leg, minsFromNow = 5) => {
  const t = Math.floor(Date.now() / 1000) + minsFromNow * 60;
  const tA = Math.floor(Date.now() / 1000) + (minsFromNow + 3) * 60;
  return [vehKey(leg), { stops: [
    { stop_id: leg.boardStop, time: t },
    { stop_id: leg.alightStop, time: tA },
  ] }];
};
const render = (opt, rtTrips = [], rtVehs = []) => {
  trackStub.children = [];
  T.setRT(rtTrips, rtVehs);
  T.setJourneyState({ o: "x", d: "y", labelO: "Origin", labelD: "Dest",
    options: [opt], selected: 0, dayOffset: 0, dayDate: "2026-11-17",
    timeMode: { mode: "now" }, isToday: true, originWalkM: 0, originWalkMin: 0,
    boarding: null });
  T.fns.renderJourneyBoard();
};
const branchKids = () => el("stripBranches").children || [];
const trackStub = makeEl("stripTrack");
el("stripBus").parentNode = trackStub;
const mainLineDots = () => (trackStub.children || []).filter(k => k._mainLineDot);
const mainLineOverlays = () => (trackStub.children || []).filter(k => k._stripPassedLi);
const branchPaths = () => branchKids().flatMap(c => (c.children || []).filter(k => k._branchPath));
const branchDots = () => branchKids().filter(c => c._branchDot);
const labelBox = () => el("stripBranchLabels");
const branchLabels = () => (labelBox().children || []).filter(c => c._branchLabel);
const trackSegs = () => (trackStub.children || []).flatMap(c => (c.children || []).filter(k => k._trackSeg));
const walkPaths = () => trackSegs().filter(k => k._walkConnector);
const walkLabels = () => (labelBox().children || []).filter(c => c._walkLabel);
const isIconTile = (dot) => dot && typeof dot.innerHTML === "string" && dot.innerHTML.includes("<svg");

// (b) Per-leg live: 1-transfer leg 2, vehicle mid-leg -> moving icon
// tile + stops-away/est text; no vehicle -> waiting icon tile + not-live label.
if (oneOpt) {
  const leg2 = oneOpt.legs[1];
  const rows = T.tt().trips[leg2.tripIdx][3];
  const bi = T.fns.legStopIndex(leg2, leg2.boardStop, leg2.boardDep, true);
  const ai = T.fns.legStopIndex(leg2, leg2.alightStop, leg2.alightArr, false);
  const mid = bi + 1 <= ai ? bi + 1 : bi;
  render(oneOpt, [tripUpdate(leg2)], [[vehKey(leg2), vehAtRow(leg2, mid)]]);
  const mdotsLive = mainLineDots().filter(d => d._mainLineDot.li === 1);
  const dotsLive = branchDots().filter(d => d._branchDot.li === 1);
  check("leg2 matched vehicle past boarding -> merged main-line icon tile (two-phase travel), no branch dot",
    mdotsLive.length === 1 && mdotsLive[0]._mainLineDot.mode === "merged" && isIconTile(mdotsLive[0]) &&
    mdotsLive[0]._mainLineDot.frac > 0 && mdotsLive[0]._mainLineDot.frac < 1 && dotsLive.length === 0,
    JSON.stringify(mdotsLive.map(d => d._mainLineDot)) + " branchDots=" + JSON.stringify(dotsLive.map(d => d._branchDot)));
  const lblLive = branchLabels().find(l => l._branchLabel.li === 1);
  check("leg2 moving live label carries stops-remaining/est text (not a fabricated route-only label)",
    !!lblLive && /stops away/.test(lblLive.textContent) && /min/.test(lblLive.textContent),
    lblLive ? lblLive.textContent : "no label");
  render(oneOpt, [], []);
  const dotsNone = branchDots().filter(d => d._branchDot.li === 1);
  check("leg2 no vehicle -> waiting icon tile at branch start (not a circle, not moving)",
    dotsNone.length === 1 && dotsNone[0]._branchDot.mode === "waiting" && isIconTile(dotsNone[0])
    && dotsNone[0].className.includes("waiting"),
    JSON.stringify(dotsNone.map(d => [d._branchDot, d.className])));
  const lblNone = branchLabels().find(l => l._branchLabel.li === 1);
  check("leg2 no vehicle -> short 'not live yet' label by its curve",
    !!lblNone && lblNone.textContent.includes("Not live yet"),
    lblNone ? lblNone.textContent : "no label");
  check("notLiveYet key exists in English pack",
    T.i18n().en.notLiveYet === "Not live yet");
}

// (c) Branch merge columns + stagger, LTR and RTL.
if (proofOpt) {
  const plan = T.fns.stripPlan(proofOpt);
  const anchors = T.fns.stripFractionAnchors(plan);
  const states = T.fns.branchTrackerStates(proofOpt, anchors, true);
  const s2 = states.find(s => s.li === 1), s3 = states.find(s => s.li === 2);
  check("leg2 approach branch starts one step in from the nominal run (board - 22 + 3 = board - 19)",
    !!s2 && Math.abs(s2.startPct - (anchors.legBoard[1] - 19)) < 0.01
    || !!s2 && anchors.legBoard[1] - 19 < 1 && s2.startPct === 1,
    s2 ? `start=${s2.startPct} board=${anchors.legBoard[1]}` : "no state");
  check("leg3 approach branch starts two steps in from the nominal run (board - 22 + 6 = board - 16)",
    !!s3 && (Math.abs(s3.startPct - (anchors.legBoard[2] - 16)) < 0.01
    || anchors.legBoard[2] - 16 < 1 && s3.startPct === 1),
    s3 ? `start=${s3.startPct} board=${anchors.legBoard[2]}` : "no state");
  check("leg2/leg3 inward offsets differ by exactly one step (19 vs 16 pct) when the legs are long enough",
    !!s2 && !!s3 && anchors.legBoard[1] > 20 && anchors.legBoard[2] > 20
    && Math.abs((anchors.legBoard[1] - s2.startPct) - 19) < 0.01
    && Math.abs((anchors.legBoard[2] - s3.startPct) - 16) < 0.01,
    s2 && s3 ? `leg2off=${anchors.legBoard[1] - s2.startPct} leg3off=${anchors.legBoard[2] - s3.startPct}` : "no state");
  // RTL: render and check the displayed branch start mirrors.
  getEl("html").dir = "rtl";
  render(proofOpt, [], []);
  const p2 = branchPaths().find(p => p._branchPath.li === 1);
  const dispStart = p2 ? p2._branchPath.startPct : null;
  const expectDisp = s2 ? 100 - s2.startPct : null;
  check("RTL mirrors the staggered branch start (100 - LTR start)",
    dispStart != null && expectDisp != null && Math.abs(dispStart - expectDisp) < 0.01,
    `display=${dispStart} expected=${expectDisp}`);
  getEl("html").dir = "";
}

// (d) Zigzag walk segments with minutes still shown.
if (proofOpt) {
  render(proofOpt, [], []);
  const wps = walkPaths();
  const wls = walkLabels();
  const zig = wps.filter(p => p._walkConnector && p._walkConnector.zigzag &&
    p._trackSeg && p._trackSeg.stepUnits === 32 && p._trackSeg.strokeWidth === 8 && p._trackSeg.kind === "walk");
  // The stub path element stores d via setAttribute (noop), so check
  // the zigzag flag plus at least one walk label with minutes.
  check("walk connectors are track-level zigzags (not straight lines): 32-unit step, main-line thickness 8",
    wps.length > 0 && zig.length === wps.length,
    `walks=${wps.length} zigzag=${zig.length}`);
  check("walk minutes label still shown beside zigzag",
    wls.length > 0 && wls.every(l => /min/.test(l.textContent)),
    JSON.stringify(wls.map(l => l.textContent)));
}

// (e) Passed portions: dashed light grey only with a live vehicle.
if (oneOpt) {
  const leg2 = oneOpt.legs[1];
  const rows = T.tt().trips[leg2.tripIdx][3];
  const bi = T.fns.legStopIndex(leg2, leg2.boardStop, leg2.boardDep, true);
  const ai = T.fns.legStopIndex(leg2, leg2.alightStop, leg2.alightArr, false);
  const mid = bi + 1 <= ai ? bi + 1 : bi;
  render(oneOpt, [tripUpdate(leg2)], [[vehKey(leg2), vehAtRow(leg2, mid)]]);
  const ps = branchPaths().filter(p => p._branchPath.li === 1);
  const passed = ps.find(p => p._branchPath.part === "passed");
  const upcoming = ps.find(p => p._branchPath.part === "upcoming");
  check("merged leg: whole approach branch is passed (dashed), upcoming lives on the main line as an overlay",
    !!passed && !upcoming && ps.length === 1 &&
    mainLineOverlays().filter(o => o._stripPassedLi.li === 1).length === 1,
    JSON.stringify(ps.map(p => p._branchPath.part)) + " mainOverlays=" + JSON.stringify(mainLineOverlays().map(o => o._stripPassedLi)));
  render(oneOpt, [], []);
  const ps2 = branchPaths().filter(p => p._branchPath.li === 1);
  check("no-vehicle leg branch renders unchanged (single solid #bbb approach path, no passed part)",
    ps2.length === 1 && ps2[0]._branchPath.part === "approach" && !ps2.some(p => p._branchPath.part === "passed"),
    JSON.stringify(ps2.map(p => p._branchPath.part)));
  // Main-track passed overlay for leg 1.
  const leg1 = oneOpt.legs[0];
  const rows1 = T.tt().trips[leg1.tripIdx][3];
  const bi1 = T.fns.legStopIndex(leg1, leg1.boardStop, leg1.boardDep, true);
  const ai1 = T.fns.legStopIndex(leg1, leg1.alightStop, leg1.alightArr, false);
  const mid1 = bi1 + 1 <= ai1 ? bi1 + 1 : bi1;
  render(oneOpt, [tripUpdate(leg1)], [[vehKey(leg1), vehAtRow(leg1, mid1)]]);
  const pel = el("stripPassed");
  check("main-track passed overlay shown with a live leg-1 vehicle",
    pel && pel._stripPassed && pel.style.display !== "none" && !!pel.style.width,
    pel ? JSON.stringify(pel._stripPassed) + " display=" + pel.style.display : "no element");
  render(oneOpt, [], []);
  const pel2 = el("stripPassed");
  check("main-track passed overlay hidden with no live vehicle",
    !pel2._stripPassed || pel2.style.display === "none",
    pel2 ? JSON.stringify(pel2._stripPassed) : "no element");
}

// (f) Spot-checks: anchors, fonts, short names unchanged; pair board untouched.
check("strip CSS still has 15/14/13/11/11px fonts",
  /\.cols-3[^}]*font-size:15px/.test(html) && /\.cols-6[^}]*font-size:11px/.test(html)
  && /\.cols-7[^}]*font-size:11px/.test(html));
check("strip short names still applied (Appleby GO Station -> Appleby GO)",
  T.fns.stripStopName("1543") === "Appleby GO");
check("full stop names preserved outside the strip",
  T.fns.stopNameOf("1543") === "Appleby GO station");

console.log(failures === 0 ? "ALL LEG LIVE CHECKS PASSED" : failures + " LEG LIVE CHECKS FAILED");
process.exit(failures === 0 ? 0 : 1);
