// Diagram-confirmed transfer tracker harness (2026-10-30, user diagram:
// main line green origin -> red transfer -> black destination; one
// approach curve below per transfer leg joining the main line EXACTLY
// at that leg's board dot like a railway turnout, then the bus travels
// ON the main line to its alight dot). Runs the real public/index.html
// inline script in Node with a stub DOM. No browser, no network, no
// deploy. Proves:
// (a) each transfer leg has exactly one below-track branch curve ending
//     EXACTLY at its board dot (same-stop and different-stop cases)
//     with a near-vertical merge tangent, in LTR and RTL (mirrored);
// (b) branch start stagger (leg 2 one step, leg 3 two steps inward);
// (c) two-phase travel: approaching icon on the branch, merged icon on
//     the main line by stop progress, with fixtures for both phases;
// (d) waiting icons on branch starts (legs 2/3) / origin dot (leg 1)
//     with "Not live yet" labels, no moving dot when unmatched;
// (e) disappear rule: vehicle past its alight stop -> no icon and no
//     live text for that leg, other legs unaffected;
// (f) branch and main colours both solid #bbb, passed portions dashed
//     #c8c8c8 only when live;
// (g) zigzag walks, anchors, fonts, short names, pair board unchanged.
// (k) mobile fixes 2026-10-30: svg class dropped by strict-mode
//     className throw (thin displaced main line), merged zigzag
//     teeth, in-diagram label overlap, floating markers.
// BUS MARKERS ARE ICON TILES: every bus marker asserted here must be
// the rounded inline-SVG bus icon tile (innerHTML contains <svg>),
// never a circle/dot. Station dots are the only circles on the strip.
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
    // Strict-mode-faithful SVG stub: like a real browser, className
    // on an SVG element is getter-only, so a direct assignment
    // throws (the site code must use setAttribute("class", ...)).
    createElementNS: (ns, tag) => { const e = makeEl(""); e._ns = ns; e._tag = tag;
      let cls = "";
      Object.defineProperty(e, "className", { get() { return cls; }, configurable: true });
      const setA = e.setAttribute;
      e.setAttribute = function(k, v) { setA.call(this, k, v); if (k === "class") cls = String(v); };
      return e; },
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
    branchTrackerStates, branchPoint, elbowGeo, elbowPointAt, elbowPathD, elbowSplitD,
    renderStripTrack, renderMainLineLegIcons,
    branchMergeGeometry, branchBottomY, mkSvgEl, stripPlan, stripFractionAnchors,
    legStopIndex, vehicleStopProgress, liveVehicleForLeg, legLive,
    legTimeState, legFinishedInfo, leg1DotState,
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
const approx = (a, b, eps = 0.01) => Math.abs(a - b) < eps;
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

const trackStub = makeEl("stripTrack");
el("stripBus").parentNode = trackStub;
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
const branchPaths = () => branchKids().flatMap(c => (c.children || []).filter(k => k._branchPath));
const branchDots = () => branchKids().filter(c => c._branchDot);
const labelBox = () => el("stripBranchLabels");
const branchLabels = () => (labelBox().children || []).filter(c => c._branchLabel);
const trackSegs = () => (trackStub.children || []).flatMap(c => (c.children || []).filter(k => k._trackSeg));
const walkPaths = () => trackSegs().filter(k => k._walkConnector);
const walkLabels = () => (labelBox().children || []).filter(c => c._walkLabel);
const mainLineDots = () => (trackStub.children || []).filter(k => k._mainLineDot);
const mainLineOverlays = () => (trackStub.children || []).filter(k => k._stripPassedLi);
const isIconTile = (dot) => dot && typeof dot.innerHTML === "string" && dot.innerHTML.includes("<svg");
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
const anchorsOf = (opt) => T.fns.stripFractionAnchors(T.fns.stripPlan(opt));

// ---- (a) Exactly one approach curve per transfer leg, merging EXACTLY
// at its board dot, near-vertical tangent at the merge, LTR + RTL.
if (oneOpt) {
  const a1 = anchorsOf(oneOpt);
  T.clearRT();
  render(oneOpt, [], []);
  const p1 = branchPaths().filter(p => p._branchPath.li === 1);
  check("(a) 1-transfer: exactly one below-track approach curve for leg 2",
    p1.length === 1, JSON.stringify(branchPaths().map(p => p._branchPath)));
  check("(a) 1-transfer: approach curve merges EXACTLY at the board column (different-stop fixture)",
    p1.length === 1 && approx(p1[0]._branchPath.mergePct, a1.legBoard[1]) &&
    approx(p1[0]._branchPath.alightPct, a1.legAlight[1]),
    p1.length ? `merge=${p1[0]._branchPath.mergePct} board=${a1.legBoard[1]} alight=${p1[0]._branchPath.alightPct}` : "no path");
  const g1 = T.fns.elbowGeo(p1[0]._branchPath.startPct * 10, p1[0]._branchPath.mergePct * 10, 58);
  const g1End = T.fns.elbowPointAt(g1, g1.total);
  check("(a) elbow merges exactly at the board dot with a vertical final segment (end = merge x, y -16; point just before end shares merge x; start at depth 58; radius 18)",
    approx(g1End[0], p1[0]._branchPath.mergePct * 10) && g1End[1] === -16 &&
    T.fns.elbowPointAt(g1, g1.total - 1)[0] === p1[0]._branchPath.mergePct * 10 &&
    T.fns.elbowPointAt(g1, 0)[1] === 58 && g1.R === 18,
    JSON.stringify(g1));
  const appSvg = branchKids().find(c => c.className === "approach-svg");
  check("(a) approach svg has a fixed 64px height (1 unit = 1 px vertically, so y=-16 truly lands on the dot)",
    !!appSvg && appSvg.style.height === "64px" && appSvg.style.top === "0px",
    appSvg ? JSON.stringify(appSvg.style) : "no approach svg");
}
if (proofOpt) {
  const ap = anchorsOf(proofOpt);
  T.clearRT();
  render(proofOpt, [], []);
  const pp = branchPaths();
  check("(a) 2-transfer: exactly two approach curves, one per transfer leg",
    pp.length === 2 && pp.some(p => p._branchPath.li === 1) && pp.some(p => p._branchPath.li === 2),
    JSON.stringify(pp.map(p => p._branchPath)));
  const p2 = pp.find(p => p._branchPath.li === 1), p3 = pp.find(p => p._branchPath.li === 2);
  check("(a) 2-transfer: both curves merge exactly at their board columns",
    approx(p2._branchPath.mergePct, ap.legBoard[1]) && approx(p3._branchPath.mergePct, ap.legBoard[2]),
    `leg2 merge=${p2._branchPath.mergePct} board=${ap.legBoard[1]}; leg3 merge=${p3._branchPath.mergePct} board=${ap.legBoard[2]}`);
  // RTL: display values mirror, tangent stays vertical on display coords.
  getEl("html").dir = "rtl";
  render(proofOpt, [], []);
  const rp = branchPaths();
  const r2 = rp.find(p => p._branchPath.li === 1), r3 = rp.find(p => p._branchPath.li === 2);
  check("(a) RTL: branch comes from below-right and still merges at the dot (display = 100 - LTR)",
    approx(r2._branchPath.mergePct, 100 - ap.legBoard[1]) && approx(r3._branchPath.mergePct, 100 - ap.legBoard[2]) &&
    approx(r2._branchPath.startPct, 100 - p2._branchPath.startPct) &&
    (() => { const gr = T.fns.elbowGeo(r2._branchPath.startPct * 10, r2._branchPath.mergePct * 10, 58);
      const er = T.fns.elbowPointAt(gr, gr.total);
      return er[0] === r2._branchPath.mergePct * 10 && er[1] === -16; })(),
    `rtl merges=${r2._branchPath.mergePct},${r3._branchPath.mergePct}`);
  const rdots = branchDots();
  check("(i) RTL: waiting dots keep their own depths (leg 2 top 58, leg 3 top 82; only x mirrors)",
    !!rdots.find(d => d._branchDot.li === 1) && parseFloat(rdots.find(d => d._branchDot.li === 1).style.top) === 58 &&
    !!rdots.find(d => d._branchDot.li === 2) && parseFloat(rdots.find(d => d._branchDot.li === 2).style.top) === 82,
    JSON.stringify(rdots.map(d => [d._branchDot.li, d.style.top])));
  getEl("html").dir = "";
}
// Same-stop transfer: leg 3 boards at the same column it alighted at.
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
  const sa = T.fns.stripFractionAnchors(T.fns.stripPlan(syn));
  T.clearRT();
  T.fns.renderStripBranches(syn, sa, true);
  const sp = branchPaths().find(p => p._branchPath.li === 2);
  check("(a) same-stop: leg-3 approach curve merges exactly at the single shared transfer column",
    !!sp && approx(sp._branchPath.mergePct, sa.legBoard[2]) && approx(sp._branchPath.alightPct, sa.legAlight[2]),
    sp ? `merge=${sp._branchPath.mergePct} board=${sa.legBoard[2]}` : "no leg-3 path");
}

// ---- (b) Branch start stagger: leg 2 one step in, leg 3 two steps in.
if (proofOpt) {
  const ap = anchorsOf(proofOpt);
  const states = T.fns.branchTrackerStates(proofOpt, ap, true);
  const s2 = states.find(s => s.li === 1), s3 = states.find(s => s.li === 2);
  check("(b) leg-2 branch start sits exactly one step (3 pct) in from the nominal 22-pct run",
    !!s2 && approx(ap.legBoard[1] - s2.startPct, 19) && s2.startPct >= 1 && s2.startPct <= s2.mergePct - 2,
    s2 ? `start=${s2.startPct} board=${ap.legBoard[1]}` : "no state");
  check("(b) leg-3 branch start sits exactly two steps (6 pct) in from the nominal 22-pct run",
    !!s3 && approx(ap.legBoard[2] - s3.startPct, 16) && s3.startPct >= 1 && s3.startPct <= s3.mergePct - 2,
    s3 ? `start=${s3.startPct} board=${ap.legBoard[2]}` : "no state");
  check("(b) branchMergeGeometry formula: start = board - 22 + li*3, clamped to [1, board-2]",
    (() => { const g2 = T.fns.branchMergeGeometry(67, 1), g3 = T.fns.branchMergeGeometry(77.5, 2);
      return g2.startPct === 48 && g2.mergePct === 67 && g3.startPct === 61.5 && g3.mergePct === 77.5; })());
}

// ---- (c) Two-phase travel fixtures: approaching on the branch,
// merged on the main line by stop progress.
if (oneOpt) {
  const leg2 = oneOpt.legs[1];
  const rows = T.tt().trips[leg2.tripIdx][3];
  const bi = T.fns.legStopIndex(leg2, leg2.boardStop, leg2.boardDep, true);
  const ai = T.fns.legStopIndex(leg2, leg2.alightStop, leg2.alightArr, false);
  const a1 = anchorsOf(oneOpt);
  // Approaching: vehicle one stop before boarding.
  render(oneOpt, [tripUpdate(leg2)], [[vehKey(leg2), vehAtRow(leg2, Math.max(0, bi - 1))]]);
  const adot = branchDots().find(d => d._branchDot.li === 1);
  const albl = branchLabels().find(l => l._branchLabel.li === 1);
  check("(c) approaching: icon tile ON the branch at stop-index progress (vehIdx/boardIdx), never a fabricated position",
    !!adot && adot._branchDot.mode === "approaching" && adot._branchDot.phase === "branch" &&
    adot._branchDot.frac === (bi === 0 ? 1 : (bi - 1) / bi) && isIconTile(adot) &&
    mainLineDots().filter(d => d._mainLineDot.li === 1).length === 0,
    adot ? JSON.stringify(adot._branchDot) : "no branch dot");
  check("(c) approaching: live text uses the boarding-stop format (stops away from boarding + est minutes)",
    !!albl && /stops away/.test(albl.textContent) && /min/.test(albl.textContent), albl ? albl.textContent : "no label");
  // Merged: vehicle one stop past boarding.
  const mid = bi + 1 <= ai ? bi + 1 : bi;
  render(oneOpt, [tripUpdate(leg2)], [[vehKey(leg2), vehAtRow(leg2, mid)]]);
  const mdot = mainLineDots().find(d => d._mainLineDot.li === 1);
  const expFrac = ai > bi ? (mid - bi) / (ai - bi) : 1;
  const expPct = a1.legBoard[1] + expFrac * (a1.legAlight[1] - a1.legBoard[1]);
  check("(c) merged: icon tile ON THE MAIN LINE at board + stop-progress * (alight - board), no branch dot",
    !!mdot && mdot._mainLineDot.mode === "merged" && isIconTile(mdot) &&
    approx(mdot._mainLineDot.pct, expPct) &&
    branchDots().filter(d => d._branchDot.li === 1).length === 0,
    mdot ? `pct=${mdot._mainLineDot.pct} expected=${expPct}` : "no main-line dot");
  const mlbl = branchLabels().find(l => l._branchLabel.li === 1);
  check("(c) merged: live text is stops-remaining to alight + predicted minutes",
    !!mlbl && /stops away/.test(mlbl.textContent) && /min/.test(mlbl.textContent),
    mlbl ? mlbl.textContent : "no label");
}

// ---- (d) Waiting positions: branch starts for legs 2/3, origin dot
// for leg 1; "Not live yet" labels; no moving dot when unmatched.
if (oneOpt) {
  const a1 = anchorsOf(oneOpt);
  render(oneOpt, [], []);
  const wdot = branchDots().find(d => d._branchDot.li === 1);
  const wlbl = branchLabels().find(l => l._branchLabel.li === 1);
  check("(d) waiting leg 2: icon tile rests ON its branch at the branch start (bottom of the approach curve)",
    !!wdot && wdot._branchDot.mode === "waiting" && wdot._branchDot.phase === "branch" &&
    parseFloat(wdot.style.left) === a1.legBoard[1] - 19 && parseFloat(wdot.style.top) === 58 &&
    isIconTile(wdot), wdot ? JSON.stringify([wdot._branchDot, wdot.style.left, wdot.style.top]) : "no dot");
  check("(d) waiting leg 2: short 'Not live yet' label, never a moving dot",
    !!wlbl && wlbl.textContent.includes("Not live yet") &&
    branchDots().every(d => d._branchDot.mode === "waiting"),
    wlbl ? wlbl.textContent : "no label");
  check("(d) waiting leg 1: main dot is a dashed waiting tile at the origin (bus column center)",
    el("stripBus").className.includes("dashed") && parseFloat(el("stripBus").style.left) === a1.start,
    `class=${el("stripBus").className} left=${el("stripBus").style.left} start=${a1.start}`);
}

// ---- (e) Disappear rule: past-alight leg loses icon + text, other
// legs unaffected.
if (oneOpt) {
  const leg1 = oneOpt.legs[0], leg2 = oneOpt.legs[1];
  const rows1 = T.tt().trips[leg1.tripIdx][3], rows2 = T.tt().trips[leg2.tripIdx][3];
  const bi1 = T.fns.legStopIndex(leg1, leg1.boardStop, leg1.boardDep, true);
  const ai1 = T.fns.legStopIndex(leg1, leg1.alightStop, leg1.alightArr, false);
  const ai2 = T.fns.legStopIndex(leg2, leg2.alightStop, leg2.alightArr, false);
  const mid1 = bi1 + 1 <= ai1 ? bi1 + 1 : bi1;
  const past2 = rows2[Math.min(rows2.length - 1, ai2 + 1)][0];
  const c2 = stopCoord(past2);
  render(oneOpt, [tripUpdate(leg1)], [
    [vehKey(leg1), vehAtRow(leg1, mid1)],
    [vehKey(leg2), { latitude: c2[0], longitude: c2[1] }],
  ]);
  const lbl2 = branchLabels().find(l => l._branchLabel.li === 1);
  check("(e) past-alight leg 2: no branch dot, no main-line icon, route-only label (live text cleared)",
    branchDots().filter(d => d._branchDot.li === 1).length === 0 &&
    mainLineDots().filter(d => d._mainLineDot.li === 1).length === 0 &&
    !!lbl2 && lbl2.textContent === "Route " + leg2.route,
    `label=${lbl2 ? lbl2.textContent : "none"} branchDots=${branchDots().length} mainDots=${mainLineDots().length}`);
  check("(e) other leg unaffected: leg-1 main dot still moving on the main line",
    el("stripBus").className === "strip-dot bus" && el("stripBus").hidden === false,
    `class=${el("stripBus").className} hidden=${el("stripBus").hidden}`);
}

// ---- (f) Colours: main + branches solid #bbb, passed dashed #c8c8c8
// only when live; no leg colours anywhere on branches.
check("(f) no leg-colour branch constant remains (BRANCH_COLORS gone)",
  !script.includes("BRANCH_COLORS"));
check("(f) approach/upcoming branch paths are solid #bbb, passed paths dashed #c8c8c8",
  /mkApproachPath\(elbowPathD\(g\), "#bbb", false, "approach"/.test(script) &&
  /mkApproachPath\(elbowPathD\(g\), "#bbb", false, "upcoming"/.test(script) &&
  /mkApproachPath\(sp\[0\], "#c8c8c8", true, "passed"/.test(script) &&
  /mkApproachPath\(elbowPathD\(g\), "#c8c8c8", true, "passed"/.test(script));
check("(f) main track is segmented, not one full bar (transparent bar + 8px solid rects; bar height still 8px)",
  /\.strip-track\s*\{[^}]*background:transparent/.test(html) &&
  /\.strip-track\s*\{[^}]*height:8px/.test(html));
check("(f) approach lines are exactly main-line thickness (strokeWidth 8 on the path record)",
  branchPaths().length > 0 && branchPaths().every(pp => pp._branchPath.strokeWidth === 8),
  JSON.stringify(branchPaths().map(pp => pp._branchPath.strokeWidth)));
if (oneOpt) {
  render(oneOpt, [], []);
  const parts = branchPaths().filter(p => p._branchPath.li === 1).map(p => p._branchPath.part);
  check("(f) no-vehicle leg: single solid approach path, no passed part invented",
    parts.length === 1 && parts[0] === "approach", JSON.stringify(parts));
}

// ---- (g) Unchanged: zigzag walks, anchors, fonts, short names, pair
// board (direct journey: no branches, no main-line icons).
if (proofOpt) {
  render(proofOpt, [], []);
  const wps = walkPaths();
  check("(g) transfer walks are track-level zigzags (not below-track paths) with minutes labels",
    wps.length > 0 && wps.every(p => p._walkConnector && p._walkConnector.zigzag) &&
    walkLabels().length > 0 && walkLabels().every(l => /min/.test(l.textContent)),
    `walks=${wps.length} labels=${JSON.stringify(walkLabels().map(l => l.textContent))}`);
  const segsG = trackSegs();
  const walkSegsG = segsG.filter(k => k._trackSeg.kind === "walk");
  const solidSegsG = segsG.filter(k => k._trackSeg.kind === "solid");
  check("(g) no straight track element spans a walk interval (solids never overlap walks)",
    walkSegsG.length > 0 && solidSegsG.every(sd => walkSegsG.every(wd =>
      sd._trackSeg.toPct <= wd._trackSeg.fromPct + 0.01 || sd._trackSeg.fromPct >= wd._trackSeg.toPct - 0.01)),
    `segs=${JSON.stringify(segsG.map(k => k._trackSeg))}`);
  check("(g) walk zigzags are main-line thickness with the phone-visible step (32 units, amplitude 6, strokeWidth 8)",
    walkSegsG.length > 0 && walkSegsG.every(wd => wd._trackSeg.stepUnits === 32 && wd._trackSeg.amplitude === 6 && wd._trackSeg.strokeWidth === 8),
    JSON.stringify(walkSegsG.map(k => k._trackSeg)));
  check("(g) no walk connector remains in the below-track branch box (moved to the track)",
    branchKids().flatMap(c => (c.children || []).filter(k => k._walkConnector)).length === 0);
  const ap = anchorsOf(proofOpt);
  check("(g) column anchors still derive from stripPlan (7 columns for both-different-stop 2-transfer)",
    ap.legBoard.length === 3 && ap.legAlight.length === 3,
    `legBoard=${JSON.stringify(ap.legBoard)} legAlight=${JSON.stringify(ap.legAlight)}`);
}
check("(g) strip fonts unchanged (15/14/13/11/11px by column count)",
  /\.strip-cols\.cols-3[^{]*\{[^}]*font-size:15px/.test(html) &&
  /\.strip-cols\.cols-7[^{]*\{[^}]*font-size:11px/.test(html));
check("(g) strip short names unchanged (Appleby GO Station -> Appleby GO)",
  T.fns.stripStopName("Appleby GO Station") === "Appleby GO");
{
  const directR = ranked("1212", "789");
  const direct = directR && directR.options.find(o => o.transfers === 0);
  if (direct) {
    render(direct, [], []);
    check("(g) pair-board-style direct journey untouched: no branch paths, no main-line icons",
      branchPaths().length === 0 && mainLineDots().length === 0,
      `paths=${branchPaths().length} mainDots=${mainLineDots().length}`);
  } else {
    check("(g) pair-board-style direct journey untouched (direct fixture exists)", false, "no direct fixture");
  }
}

// ---- (h) SVG namespace: every strip SVG element is created via
// createElementNS (the 965688c4 live bug: plain createElement made
// unknown HTML elements that render nothing on a real phone, while
// div/span icons and labels did render).
const SVGNS = "http://www.w3.org/2000/svg";
if (proofOpt) {
  render(proofOpt, [], []);
  const appSvgH = branchKids().find(c => c.className === "approach-svg");
  check("(h) approach svg is created in the SVG namespace",
    !!appSvgH && appSvgH._ns === SVGNS && appSvgH._tag === "svg",
    appSvgH ? JSON.stringify([appSvgH._ns, appSvgH._tag]) : "no approach svg");
  check("(h) every approach path is created in the SVG namespace",
    branchPaths().length > 0 && branchPaths().every(p => p._ns === SVGNS && p._tag === "path"),
    JSON.stringify(branchPaths().map(p => [p._ns, p._tag])));
  const trackSvgH = (trackStub.children || []).find(c => c._trackSegsSvg);
  check("(h) track-segments svg is created in the SVG namespace",
    !!trackSvgH && trackSvgH._ns === SVGNS && trackSvgH._tag === "svg" && trackSvgH.className === "strip-tracksegs",
    trackSvgH ? JSON.stringify([trackSvgH._ns, trackSvgH._tag, trackSvgH.className]) : "no track svg");
  check("(h) every walk zigzag path is created in the SVG namespace",
    walkPaths().length > 0 && walkPaths().every(p => p._ns === SVGNS && p._tag === "path"),
    `walks=${walkPaths().length}`);
  check("(h) every solid track rect is created in the SVG namespace",
    trackSegs().filter(k => k._trackSeg.kind === "solid").length > 0 &&
    trackSegs().filter(k => k._trackSeg.kind === "solid").every(p => p._ns === SVGNS && p._tag === "rect"),
    `solids=${trackSegs().filter(k => k._trackSeg.kind === "solid").length}`);
  const savedNS = sandbox.document.createElementNS;
  sandbox.document.createElementNS = undefined;
  const fb = T.fns.mkSvgEl("path");
  check("(h) fallback uses plain createElement only when createElementNS is absent",
    !!fb && fb._ns === undefined,
    JSON.stringify([fb._ns, fb._tag]));
  sandbox.document.createElementNS = savedNS;
  const back = T.fns.mkSvgEl("svg");
  check("(h) namespace path resumes once createElementNS is restored",
    !!back && back._ns === SVGNS && back._tag === "svg");
}

// ---- (i) Leg-3 curve parallel to leg-2's and BELOW it (DROP = 24).
if (proofOpt) {
  const ap = anchorsOf(proofOpt);
  render(proofOpt, [], []);
  const appSvgI = branchKids().find(c => c.className === "approach-svg");
  const boxI = el("stripBranches");
  check("(i) two transfer legs: approach svg and branch box grow by DROP (64 -> 88px), box top unchanged (top 0)",
    !!appSvgI && appSvgI.style.height === "88px" && appSvgI.style.top === "0px" && boxI.style.height === "88px",
    appSvgI ? JSON.stringify([appSvgI.style.height, boxI.style.height]) : "no approach svg");
  const w3 = branchDots().find(d => d._branchDot.li === 2);
  check("(i) waiting leg 3 rests at its own deeper branch start (top 82 = 58 + DROP, left = board - 16)",
    !!w3 && w3._branchDot.mode === "waiting" && parseFloat(w3.style.top) === 82 &&
    parseFloat(w3.style.left) === ap.legBoard[2] - 16 && isIconTile(w3),
    w3 ? JSON.stringify([w3._branchDot, w3.style.left, w3.style.top]) : "no leg-3 dot");
  const w2 = branchDots().find(d => d._branchDot.li === 1);
  check("(i) waiting leg 2 unchanged at its own start (top 58, left = board - 19)",
    !!w2 && parseFloat(w2.style.top) === 58 && parseFloat(w2.style.left) === ap.legBoard[1] - 19,
    w2 ? JSON.stringify([w2.style.left, w2.style.top]) : "no leg-2 dot");
  check("(i) branch labels live below the diagram (in #stripBranchLabels, never in the diagram box)",
    branchKids().every(c => !c._branchLabel && !c._walkLabel) && branchLabels().length === 2,
    JSON.stringify(branchLabels().map(l => l.textContent)));
  // Synthetic close-transfer fixture: boards 10 pct apart, so the
  // curves share an x-range; leg 3 must stay below leg 2 throughout.
  const g2 = T.fns.elbowGeo(310, 500, 58);
  const g3 = T.fns.elbowGeo(440, 600, 82);
  const yAtX = (g, x) => {
    const arcX = g.xb - g.s * g.R;
    if ((g.s === 1 && x <= arcX) || (g.s === -1 && x >= arcX)) return g.bottom;
    const dx = x - arcX;
    return (g.bottom - g.R) + Math.sqrt(Math.max(0, g.R * g.R - dx * dx));
  };
  let minGap = Infinity;
  for (let x = 440; x <= 495; x += 5) minGap = Math.min(minGap, yAtX(g3, x) - yAtX(g2, x));
  check("(i) leg-3 elbow stays below leg-2's across their shared x-range (never crosses; parallel horizontals, vertical merge)",
    g3.bottom === 82 && g2.bottom === 58 && g3.R === 18 && g2.R === 18 &&
    T.fns.elbowPointAt(g3, g3.total)[1] === -16 && T.fns.elbowPointAt(g2, g2.total)[1] === -16 && minGap > 5,
    `minGap=${minGap} g3=${JSON.stringify(g3)}`);
  check("(i) branchBottomY: leg 2 = 58, leg 3 = 82",
    T.fns.branchBottomY(1) === 58 && T.fns.branchBottomY(2) === 82);
}

// ---- (j) Segmented track + stacking (2026-10-30 user changes:
// walk replaces the straight segment at track level; branch lines
// same thickness as the main line; dots cover lines, icons cover
// dots).
{
  getEl("html").dir = "";
  if (proofOpt) {
    const apJ = anchorsOf(proofOpt);
    const planJ = T.fns.stripPlan(proofOpt);
    render(proofOpt, [], []);
    const segs = trackSegs();
    const walkSegs = segs.filter(k => k._trackSeg.kind === "walk");
    const solidSegs = segs.filter(k => k._trackSeg.kind === "solid");
    check("(j) track segments tile [0,100] contiguously (first starts 0, last ends 100, adjacent match)",
      segs.length > 0 && Math.abs(segs[0]._trackSeg.fromPct) < 0.01 &&
      Math.abs(segs[segs.length - 1]._trackSeg.toPct - 100) < 0.01 &&
      segs.every((sg, i) => i === 0 || Math.abs(sg._trackSeg.fromPct - segs[i - 1]._trackSeg.toPct) < 0.01),
      JSON.stringify(segs.map(k => k._trackSeg)));
    check("(j) one walk zigzag per split-pair walk, spanning exactly its interval (display coords)",
      walkSegs.length === planJ.walks.length && planJ.walks.every((w, i) => {
        const a = apJ.stops[w.from], b = apJ.stops[w.to];
        return walkSegs.some(ws => Math.abs(ws._trackSeg.fromPct - Math.min(a, b)) < 0.01 &&
          Math.abs(ws._trackSeg.toPct - Math.max(a, b)) < 0.01);
      }),
      `walks=${JSON.stringify(walkSegs.map(k => k._trackSeg))} plan=${JSON.stringify(planJ.walks)}`);
    check("(j) stacking CSS: track z 2 above branches z 1; lines z 0 < passed z 1 < dots z 2 < icons z 3; labels above lines, dots above labels' box",
      /\.strip-track\s*\{[^}]*z-index:2/.test(html) &&
      /\.strip-branches\s*\{[^}]*z-index:1/.test(html) &&
      /\.strip-tracksegs\s*\{[^}]*z-index:0/.test(html) &&
      /\.strip-passed\s*\{[^}]*z-index:1/.test(html) &&
      /\.strip-dot\s*\{[^}]*z-index:2/.test(html) &&
      /\.strip-dot\.bus\s*\{[^}]*z-index:3/.test(html) &&
      /\.branch-label\s*\{[^}]*z-index:1/.test(html) &&
      /\.branch-dot\s*\{[^}]*z-index:2/.test(html));
    check("(j) track svg paints before overlays and merged icons in the track (so z-order is explicit, not accidental)",
      (() => { const kids = trackStub.children || [];
        const si = kids.findIndex(c => c._trackSegsSvg);
        const oi = kids.findIndex(c => c._stripPassedLi);
        const di = kids.findIndex(c => c._mainLineDot);
        return si !== -1 && (oi === -1 || si < oi) && (di === -1 || si < di); })(),
      JSON.stringify((trackStub.children || []).map(c => c._trackSegsSvg ? "svg" : c._stripPassedLi ? "passed" : c._mainLineDot ? "icon" : "?")));
    check("(j) no plain createElement(\"svg\"|\"path\") remains anywhere in the script (namespace regression)",
      !/createElement\("(svg|path)"\)/.test(script) && !/createElement\('(svg|path)'\)/.test(script));
    // Elbow split/point fixtures (pure geometry).
    const gg = T.fns.elbowGeo(280, 470, 58);
    const half = gg.total / 2;
    const [pd, ud] = T.fns.elbowSplitD(gg, half);
    const arcMid = T.fns.elbowPointAt(gg, gg.horiz + gg.arc / 2);
    check("(j) elbow split: split at 0 gives full upcoming, split at total gives full passed and no upcoming",
      T.fns.elbowSplitD(gg, 0)[1] === T.fns.elbowPathD(gg) &&
      T.fns.elbowSplitD(gg, gg.total)[0] === T.fns.elbowPathD(gg) &&
      T.fns.elbowSplitD(gg, gg.total)[1] === null);
    check("(j) elbow split at half: passed starts at the branch start, upcoming ends at the merge, arc midpoint lies on the R=18 circle",
      pd.startsWith("M 280 58") && ud.endsWith("V -16") &&
      Math.abs(Math.hypot(arcMid[0] - (470 - 18), arcMid[1] - (58 - 18)) - 18) < 0.01,
      `pd=${pd} ud=${ud} arcMid=${JSON.stringify(arcMid)}`);
    check("(j) elbow endpoints: start (280,58), merge (470,-16), vertical just before merge",
      JSON.stringify(T.fns.elbowPointAt(gg, 0)) === JSON.stringify([280, 58]) &&
      JSON.stringify(T.fns.elbowPointAt(gg, gg.total)) === JSON.stringify([470, -16]) &&
      T.fns.elbowPointAt(gg, gg.total - 1)[0] === 470);
  } else {
    check("(j) proof 2-transfer fixture exists", false, "no proofOpt");
  }
}
{
  const directR2 = ranked("1212", "789");
  const direct2 = directR2 && directR2.options.find(o => o.transfers === 0);
  if (direct2) {
    render(direct2, [], []);
    const segs = trackSegs();
    check("(j) direct journey track is all solid (no walk zigzag, still full [0,100] coverage)",
      segs.length > 0 && segs.every(k => k._trackSeg.kind === "solid") &&
      Math.abs(segs[0]._trackSeg.fromPct) < 0.01 &&
      Math.abs(segs[segs.length - 1]._trackSeg.toPct - 100) < 0.01,
      JSON.stringify(segs.map(k => k._trackSeg)));
  }
}

// ---- (k) Mobile fixes 2026-10-30: thin displaced main line (the
// track-segments svg lost its class when strict-mode code assigned
// .className on an SVG element, leaving an unstyled inline svg on
// the text baseline), zigzag teeth merged into a band, labels
// overlapping the diagram, markers floating above the line.
{
  getEl("html").dir = "";
  const leg = (boardStop, boardDep, alightStop, alightArr, route) =>
    ({ route, boardStop: String(boardStop), boardDep, alightStop: String(alightStop),
       alightArr, stops: 5, original: "x", tripIdx: 0 });
  // Screenshot-journey replica: 6 columns, 2 min walk between the
  // two Rebecca columns (transfer 0), then leg 2 / leg 3.
  const syn = { transfers: 2, legs: [
    leg("1212", 373, "994", 401, "14A"),
    leg("211", 408, "358", 433, "3"),
    leg("358", 455, "1550", 480, "6"),
  ], transferStops: [
    { alightStop: "994", boardStop: "211", walkM: 250, walkMin: 2 },
    { alightStop: "358", boardStop: "358", walkM: 0, walkMin: 0 },
  ] };
  const sa = T.fns.stripFractionAnchors(T.fns.stripPlan(syn));
  T.clearRT();
  T.fns.renderStripBranches(syn, sa, true);
  const segsK = trackSegs();
  const walkK = segsK.filter(k => k._trackSeg.kind === "walk");
  const planK = T.fns.stripPlan(syn);
  const wFrom = sa.stops[planK.walks[0].from], wTo = sa.stops[planK.walks[0].to];
  check("(k) screenshot replica: walk zigzag emitted at track level for the Rebecca walk interval (no straight segment spans it)",
    walkK.length === 1 && planK.walks.length === 1 &&
    segsK.every(k => !(k._trackSeg.kind === "solid" &&
      k._trackSeg.fromPct < Math.max(wFrom, wTo) && k._trackSeg.toPct > Math.min(wFrom, wTo))),
    JSON.stringify(segsK.map(k => k._trackSeg)));
  // Phone-visibility arithmetic (conservative 300px track at a 360px
  // phone; the old 10-unit step rendered 3.0px < 8px stroke and merged).
  const stepPt = 32 * 300 / 1000, oldStepPt = 10 * 300 / 1000;
  check("(k) zigzag teeth discernible on a phone: step 32 units renders ~9.6px (> 8px stroke) at 300px track width, amplitude 6px (> half stroke 4px); old 10-unit step rendered 3.0px and merged",
    walkK.length === 1 && walkK[0]._trackSeg.stepUnits === 32 && walkK[0]._trackSeg.amplitude === 6 &&
    walkK[0]._trackSeg.strokeWidth === 8 && stepPt > 8 && 6 > 4 && oldStepPt < 8,
    `stepPt=${stepPt} oldStepPt=${oldStepPt} seg=${JSON.stringify(walkK.map(k => k._trackSeg))}`);
  // Very short walk interval (< 1 step) still gets a midpoint tooth.
  T.fns.renderStripTrack([0, 100], [{ from: 40, to: 42.5, walkM: 30, walkMin: 1, transfer: 0 }]);
  const shortSegs = trackSegs();
  const shortWalk = shortSegs.filter(k => k._trackSeg.kind === "walk");
  check("(k) very short walk interval (2.5% < 1 step) still renders a zigzag with a midpoint tooth, never a straight line",
    shortWalk.length === 1 && shortWalk[0]._trackSeg.teeth >= 1 &&
    shortSegs.every(k => k._trackSeg.kind !== "solid" ||
      k._trackSeg.toPct <= 40.01 || k._trackSeg.fromPct >= 42.49),
    JSON.stringify(shortSegs.map(k => k._trackSeg)));
}
if (proofOpt) {
  render(proofOpt, [], []);
  check("(k) labels live below the diagram: none inside the diagram box; all in #stripBranchLabels (after #stripBranches in source), stacked, with no absolute top inside the diagram",
    branchKids().every(c => !c._branchLabel && !c._walkLabel) &&
    branchLabels().length === 2 &&
    (labelBox().children || []).every(l => l.className === "branch-label" && !l.style.top) &&
    html.indexOf('id="stripBranchLabels"') > html.indexOf('id="stripBranches"'),
    JSON.stringify((labelBox().children || []).map(l => l.textContent)));
  const pathsK = branchPaths();
  const keysK = pathsK.map(p => p._branchPath.li + ":" + p._branchPath.part);
  const segsAllK = trackSegs();
  const segKeysK = segsAllK.map(k => k._trackSeg.kind + ":" + k._trackSeg.fromPct + "-" + k._trackSeg.toPct);
  check("(k) every elbow segment drawn exactly once at 8px (no duplicate path/rect at the same coordinates)",
    new Set(keysK).size === keysK.length && pathsK.every(p => p._branchPath.strokeWidth === 8) &&
    new Set(segKeysK).size === segKeysK.length && segsAllK.every(k => k._trackSeg.strokeWidth === 8),
    JSON.stringify(keysK) + " " + JSON.stringify(segKeysK));
  const tSvg = (trackStub.children || []).find(c => c._trackSegsSvg);
  const rectK = segsAllK.find(k => k._trackSeg.kind === "solid");
  const rectCenter = -8 + (parseFloat(rectK.getAttribute("y")) + parseFloat(rectK.getAttribute("height")) / 2);
  check("(k) track svg carries its class via setAttribute + inline top/height (the strict-mode className-drop fix)",
    !!tSvg && tSvg.getAttribute("class") === "strip-tracksegs" && tSvg.style.top === "-8px" && tSvg.style.height === "24px" && tSvg.getAttribute("viewBox") === "0 0 1000 24",
    tSvg ? JSON.stringify([tSvg.getAttribute("class"), tSvg.style.top, tSvg.style.height, tSvg.getAttribute("viewBox")]) : "no track svg");
  check("(k) station-dot center equals track center (CSS: .strip-track 8px, .strip-dot top 50% + translate(-50%,-50%); rect center = svg top -8 + 12 = 4), tolerance 0.5px",
    /\.strip-track\s*\{[^}]*height:8px/.test(html) &&
    /\.strip-dot\s*\{[^}]*top:50%[^}]*transform:translate\(-50%,\s*-50%\)/.test(html) &&
    Math.abs(rectCenter - 4) <= 0.5,
    `rectCenter=${rectCenter}`);
  const w2k = branchDots().find(d => d._branchDot.li === 1);
  const w3k = branchDots().find(d => d._branchDot.li === 2);
  check("(k) branch icon centers equal their branch line Y (dot top = branchBottomY, CSS translate(-50%,-50%); leg2 58, leg3 82)",
    /\.branch-dot\s*\{[^}]*transform:translate\(-50%,\s*-50%\)/.test(html) &&
    !!w2k && parseFloat(w2k.style.top) === 58 && !!w3k && parseFloat(w3k.style.top) === 82 &&
    branchPaths().every(p => (p._branchPath.li === 1 ? p._branchPath.bottomY === 58 : p._branchPath.bottomY === 82)),
    JSON.stringify([w2k && w2k.style.top, w3k && w3k.style.top]));
} else {
  check("(k) proof 2-transfer fixture exists", false, "no proofOpt");
}
if (oneOpt) {
  const leg2 = oneOpt.legs[1];
  const bi = T.fns.legStopIndex(leg2, leg2.boardStop, leg2.boardDep, true);
  const ai = T.fns.legStopIndex(leg2, leg2.alightStop, leg2.alightArr, false);
  const mid = bi + 1 <= ai ? bi + 1 : bi;
  render(oneOpt, [tripUpdate(leg2)], [[vehKey(leg2), vehAtRow(leg2, mid)]]);
  const mdot = mainLineDots().find(d => d._mainLineDot.li === 1);
  check("(k) merged main-line icon center equals track center (icon carries .strip-dot.bus, CSS top 50% + translate => center 4 = track center); leg-1 dot same class",
    !!mdot && mdot.className.includes("strip-dot") && mdot.className.includes("bus") &&
    el("stripBus").className.includes("strip-dot"),
    mdot ? mdot.className + " / stripBus=" + el("stripBus").className : "no merged dot");
}

// ---- (l) Strip v3 2026-10-30 (user-approved): finished legs
// disappear + travelled road dashed everywhere (main line AND branch);
// walk zigzag unchanged (step 32, amplitude 6, 8px).
{
  getEl("html").dir = "";
  const mkLeg = (boardStop, boardDep, alightStop, alightArr, route) =>
    ({ route, boardStop: String(boardStop), boardDep, alightStop: String(alightStop),
       alightArr, stops: 5, original: "x", tripIdx: 0 });
  // User's Route 14A journey, viewed at 13:29 (nowMin 809): legs 1-2
  // finished (alight 12:35 / 13:04 < 13:29), leg 3 boarded (board 13:20
  // passed, alight 14:05 future), no live vehicles at all.
  const syn3 = { transfers: 2, legs: [
    mkLeg("1212", 727, "994", 755, "14A"),
    mkLeg("211", 773, "358", 784, "3"),
    mkLeg("358", 800, "1550", 845, "6"),
  ], transferStops: [
    { alightStop: "994", boardStop: "211", walkM: 63, walkMin: 2 },
    { alightStop: "358", boardStop: "358", walkM: 0, walkMin: 0 },
  ] };
  const sa3 = T.fns.stripFractionAnchors(T.fns.stripPlan(syn3));
  T.clearRT();
  const states3 = T.fns.branchTrackerStates(syn3, sa3, true, 809, true);
  const s31 = states3.find(s => s.li === 1), s32 = states3.find(s => s.li === 2);
  check("(l) finished leg 2 (alight 13:04 < 13:29, no vehicle) is arrived, not waiting",
    !!s31 && s31.mode === "arrived" && s31.live === false, JSON.stringify(s31));
  check("(l) boarded leg 3 (board 13:20 passed, alight 14:05 future, no vehicle) is boarded, not waiting",
    !!s32 && s32.mode === "boarded" && s32.live === false, JSON.stringify(s32));
  check("(l) legTimeState uses the timetable's continuous minutes past midnight (no overnight adjustment: a 23:50->00:15 leg reads alight 1455, so it is not finished at 23:55 but boarded; an early leg is finished once its alight time passes)",
    (() => { const ov = { boardDep: 1430, alightArr: 1455 };
      const early = { boardDep: 300, alightArr: 320 };
      return T.fns.legTimeState(ov, true, 1435).finishedByTime === false &&
        T.fns.legTimeState(ov, true, 1435).boardPassed === true &&
        T.fns.legTimeState(early, true, 330).finishedByTime === true; })());
  check("(l) legTimeState off without nowMin/timeToday (old callers unchanged)",
    T.fns.legTimeState({ boardDep: 700, alightArr: 755 }, true, undefined).finishedByTime === false &&
    T.fns.legTimeState({ boardDep: 700, alightArr: 755 }, false, 809).finishedByTime === false);
  check("(l) leg1DotState: finished leg 1 (alight 12:35 < 13:29, no vehicle) is arrived; before alighting it is none",
    T.fns.leg1DotState(syn3.legs[0], sa3, true, true, 809).mode === "arrived" &&
    T.fns.leg1DotState(syn3.legs[0], sa3, true, true, 700).mode === "none");
  // Real board flow order: branches first, then main-line icons
  // (which also cleans extras from previous renders, so the
  // main-line dot assertions below reflect this render, not a stale
  // one left in the stub track by an earlier section). The stub DOM
  // has no removeChild, so reset the stub track first, exactly as
  // the render() helper does before every full-board render.
  trackStub.children = [];
  const statesR = T.fns.renderStripBranches(syn3, sa3, true, 809, true);
  T.fns.renderMainLineLegIcons(syn3, sa3, statesR, true);
  const d3 = branchDots();
  check("(l) finished leg 2 has NO tracker icon anywhere (not at its branch start, not on the main line)",
    !d3.some(d => d._branchDot.li === 1) && !mainLineDots().some(d => d._mainLineDot.li === 1),
    JSON.stringify(d3.map(d => d._branchDot)));
  check("(l) boarded leg 3 keeps its waiting icon at its own branch start (top 82, waiting visual)",
    !!d3.find(d => d._branchDot.li === 2 && d._branchDot.mode === "boarded") &&
    d3.find(d => d._branchDot.li === 2).className.includes("waiting") &&
    parseFloat(d3.find(d => d._branchDot.li === 2).style.top) === 82,
    JSON.stringify(d3.map(d => [d._branchDot, d.style.top])));
  const p31 = branchPaths().filter(p => p._branchPath.li === 1);
  const p32 = branchPaths().filter(p => p._branchPath.li === 2);
  check("(l) finished leg 2 branch is fully dashed #c8c8c8 (single passed part, 8px)",
    p31.length === 1 && p31[0]._branchPath.part === "passed" &&
    p31[0].getAttribute("stroke") === "#c8c8c8" &&
    p31[0].getAttribute("stroke-dasharray") === "6 6" &&
    p31[0].getAttribute("stroke-width") === "8",
    JSON.stringify(p31.map(p => [p._branchPath.part, p.getAttribute("stroke"), p.getAttribute("stroke-dasharray")]))); 
  check("(l) boarded leg 3 branch is fully dashed #c8c8c8 (approach complete per timetable)",
    p32.length === 1 && p32[0]._branchPath.part === "passed" &&
    p32[0].getAttribute("stroke") === "#c8c8c8",
    JSON.stringify(p32.map(p => p._branchPath.part)));
  const segs3 = trackSegs();
  const fin3 = segs3.filter(s => s._trackSeg.kind === "finished");
  check("(l) finished legs' main-line segments are dashed (leg1 19->37, leg2 55->73; 8px, dashed)",
    fin3.length === 2 &&
    fin3.some(s => Math.abs(s._trackSeg.fromPct - 19) < 0.01 && Math.abs(s._trackSeg.toPct - 37) < 0.01) &&
    fin3.some(s => Math.abs(s._trackSeg.fromPct - 55) < 0.01 && Math.abs(s._trackSeg.toPct - 73) < 0.01) &&
    fin3.every(s => s._trackSeg.dashed === true && s._trackSeg.strokeWidth === 8),
    JSON.stringify(segs3.map(s => s._trackSeg)));
  check("(l) in-progress leg 3 main segment stays solid (travelled portion within it unknown, never invented)",
    segs3.some(s => s._trackSeg.kind === "solid" &&
      Math.abs(s._trackSeg.fromPct - 73) < 0.01 && Math.abs(s._trackSeg.toPct - 91) < 0.01),
    JSON.stringify(segs3.map(s => s._trackSeg)));
  const wk3 = segs3.filter(s => s._trackSeg.kind === "walk");
  check("(l) walk interval is still zigzag, never dashed (37->55, step 32, amplitude 6, 8px)",
    wk3.length === 1 && Math.abs(wk3[0]._trackSeg.fromPct - 37) < 0.01 &&
    Math.abs(wk3[0]._trackSeg.toPct - 55) < 0.01 && wk3[0]._trackSeg.stepUnits === 32 &&
    wk3[0]._trackSeg.amplitude === 6 && wk3[0]._trackSeg.strokeWidth === 8 && wk3[0]._trackSeg.zigzag === true,
    JSON.stringify(wk3.map(s => s._trackSeg)));
  const lb3 = branchLabels();
  check("(l) below-diagram labels: finished leg route-only, boarded leg keeps not-live-yet, walk label present",
    !!lb3.find(l => l._branchLabel.li === 1) && lb3.find(l => l._branchLabel.li === 1).textContent === "Route 3" &&
    !!lb3.find(l => l._branchLabel.li === 2) && /Not live yet/.test(lb3.find(l => l._branchLabel.li === 2).textContent) &&
    walkLabels().some(l => /2/.test(l.textContent) && /min/.test(l.textContent)),
    JSON.stringify(lb3.map(l => l.textContent)));
  // Live-arrived leg: whole main segment dashed via the track (no
  // second overlay on top), branch fully dashed, no icon.
  if (oneOpt) {
    const leg2 = oneOpt.legs[1];
    const rows2 = T.tt().trips[leg2.tripIdx][3];
    const ai2 = T.fns.legStopIndex(leg2, leg2.alightStop, leg2.alightArr, false);
    const ap2 = anchorsOf(oneOpt);
    render(oneOpt, [tripUpdate(leg2)], [[vehKey(leg2), vehAtRow(leg2, ai2 + 1)]]);
    const st2 = T.fns.branchTrackerStates(oneOpt, ap2, true).find(s => s.li === 1);
    check("(l) live-arrived leg stays arrived with no icon and no main-line overlay (track dashes instead)",
      !!st2 && st2.mode === "arrived" &&
      !branchDots().some(d => d._branchDot.li === 1) &&
      !mainLineDots().some(d => d._mainLineDot.li === 1) &&
      mainLineOverlays().filter(o => o._stripPassedLi.li === 1).length === 0,
      JSON.stringify(st2) + " overlays=" + JSON.stringify(mainLineOverlays().map(o => o._stripPassedLi)));
    const finL = trackSegs().filter(s => s._trackSeg.kind === "finished");
    check("(l) live-arrived leg's main segment is dashed via the track",
      finL.some(s => Math.abs(s._trackSeg.fromPct - Math.min(ap2.legBoard[1], ap2.legAlight[1])) < 0.01 &&
        Math.abs(s._trackSeg.toPct - Math.max(ap2.legBoard[1], ap2.legAlight[1])) < 0.01),
      JSON.stringify(finL.map(s => s._trackSeg)));
  } else {
    check("(l) live-arrived fixture exists", false, "no oneOpt");
  }
  // Full-board wiring: finished leg 1 hides the bus-column icon.
  // Times are built relative to the real Toronto clock so the
  // fixture is finished whenever the test runs in daytime; skipped
  // only in the small hours when "finished" is not well-defined.
  const tParts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const tp = {};
  for (const p of tParts) tp[p.type] = p.value;
  const todayDisplay = tp.year + "-" + tp.month + "-" + tp.day;
  const nowMinB = (parseInt(tp.hour, 10) % 24) * 60 + parseInt(tp.minute, 10);
  if (nowMinB >= 180 && nowMinB <= 1350) {
    const mkLegB = (boardStop, boardDep, alightStop, alightArr, route) =>
      ({ route, boardStop: String(boardStop), boardDep, alightStop: String(alightStop),
         alightArr, stops: 5, original: "x", tripIdx: 0 });
    const synB = { transfers: 2, legs: [
      mkLegB("1212", nowMinB - 90, "994", nowMinB - 60, "14A"),
      mkLegB("211", nowMinB - 40, "358", nowMinB - 10, "3"),
      mkLegB("358", nowMinB - 5, "1550", nowMinB + 55, "6"),
    ], transferStops: [
      { alightStop: "994", boardStop: "211", walkM: 63, walkMin: 2 },
      { alightStop: "358", boardStop: "358", walkM: 0, walkMin: 0 },
    ] };
    trackStub.children = [];
    T.clearRT();
    T.setJourneyState({ o: "x", d: "y", labelO: "Origin", labelD: "Dest",
      options: [synB], selected: 0, dayOffset: 0, dayDate: todayDisplay,
      timeMode: { mode: "now" }, isToday: true, originWalkM: 0, originWalkMin: 0,
      boarding: null });
    T.fns.renderJourneyBoard();
    check("(l) full board: finished leg 1 hides the bus-column icon (hidden + arrived class + opacity 0)",
      el("stripBus").hidden === true && el("stripBus").className.includes("arrived") &&
      el("stripBus").style.opacity === "0",
      "hidden=" + el("stripBus").hidden + " class=" + el("stripBus").className + " opacity=" + el("stripBus").style.opacity);
    const pelB = el("stripPassed");
    check("(l) full board: finished leg 1 gets no passed overlay (track dashes instead)",
      !pelB._stripPassed || pelB.style.display === "none",
      pelB ? JSON.stringify(pelB._stripPassed) + " display=" + pelB.style.display : "no element");
    const finB = trackSegs().filter(s => s._trackSeg.kind === "finished");
    check("(l) full board: finished legs' main segments dashed, boarded leg's main segment solid",
      finB.length === 2 &&
      trackSegs().some(s => s._trackSeg.kind === "solid"),
      JSON.stringify(trackSegs().map(s => s._trackSeg)));
  } else {
    console.log("SKIP (l) full-board finished test: Toronto nowMin " + nowMinB + " outside daytime range");
  }
}

console.log(failures === 0 ? "ALL BRANCHMERGE CHECKS PASSED" : failures + " FAILURES");
process.exit(failures === 0 ? 0 : 1);
