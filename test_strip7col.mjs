// Refined-board harness (2026-10-29): column system generalized from
// fixed 3/4/5 columns to 3-7 columns driven by same-stop vs
// different-stop transfers. Runs the real public/index.html inline
// script in Node with a stub DOM. No browser, no network, no deploy.
import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, "public", "index.html"), "utf8");
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
const css = html.match(/<style>([\s\S]*)<\/style>/)[1];
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
  setJourneyState: (j) => { journeyState = j; },
  setRT: (trips, vehicles) => { RT.trips = new Map(trips); RT.vehicles = new Map(vehicles); RT.ok = true; },
  clearRT: () => { RT.trips = new Map(); RT.vehicles = new Map(); RT.alerts = []; RT.ok = false; },
  fns: { renderJourneyBoard, renderStripColumns, renderStripBranches,
    branchTrackerStates, branchPoint, stripDotState, stripPlan,
    stripFractionAnchors, stripMeasuredAnchors, stripColumnAnchors,
    stopNameOf, stripStopName, stripShortNameText, fmtTime, setLang: (l) => { lang = l; } },
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
const approx = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const approxArr = (a, b, eps = 1e-9) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < eps);
const fmt = (m) => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(Math.floor(m % 60)).padStart(2, "0");
const nameOf = (id) => T.fns.stopNameOf(String(id));

// Synthetic journey builder. Stop ids are real stops.json ids, so
// stopNameOf resolves. Times are minutes-since-midnight.
const leg = (boardStop, boardDep, alightStop, alightArr, route) =>
  ({ route, boardStop: String(boardStop), boardDep, alightStop: String(alightStop),
     alightArr, stops: 5, original: "x", tripIdx: 0 });
const mkOpt = (legs, tss) => ({ transfers: legs.length - 1, legs, transferStops: tss });
const ts = (a, b, walkM, walkMin) => ({ alightStop: String(a), boardStop: String(b), walkM, walkMin });
const same = (s) => ts(s, s, 0, 0);

const cases = {
  // 1. Direct: 3 cols.
  direct: mkOpt([leg("1212", 480, "1550", 500, "1")], []),
  // 2. 1 transfer, same-stop: 4 cols, stacked transfer column.
  oneSame: mkOpt([leg("1212", 480, "994", 500, "1"), leg("994", 510, "1550", 530, "5")], [same("994")]),
  // 3. 1 transfer, different-stop: 5 cols, split alight/board + walk.
  oneDiff: mkOpt([leg("1212", 480, "994", 500, "1"), leg("211", 510, "1550", 530, "28")],
    [ts("994", "211", 250, 6)]),
  // 4. 2 transfers, both same-stop: 5 cols.
  twoSame: mkOpt([leg("1212", 480, "994", 500, "1"), leg("994", 510, "211", 525, "5"),
    leg("211", 535, "1550", 550, "28")], [same("994"), same("211")]),
  // 5. 2 transfers, first different-stop, second same-stop: 6 cols.
  twoFirstDiff: mkOpt([leg("1212", 480, "994", 500, "1"), leg("211", 510, "358", 525, "28"),
    leg("358", 535, "1550", 550, "5")], [ts("994", "211", 250, 6), same("358")]),
  // 6. 2 transfers, first same-stop, second different-stop: 6 cols.
  twoSecondDiff: mkOpt([leg("1212", 480, "994", 500, "1"), leg("994", 510, "211", 525, "5"),
    leg("358", 535, "1550", 550, "28")], [same("994"), ts("211", "358", 300, 7)]),
  // 7. 2 transfers, both different-stop: 7 cols.
  twoDiff: mkOpt([leg("1212", 480, "994", 500, "1"), leg("211", 510, "358", 525, "28"),
    leg("645", 535, "1550", 550, "5")], [ts("994", "211", 250, 6), ts("358", "645", 300, 7)]),
  // 7b. Same-name, different-id pair (stops 150 and 620 share the name
  // "Upper Middle Rd East + Buckingham Rd"): must still split, because
  // same/different is decided by STOP ID, never by name.
  twoDiffSameName: mkOpt([leg("1212", 480, "994", 500, "1"), leg("211", 510, "150", 525, "28"),
    leg("620", 535, "1550", 550, "5")], [ts("994", "211", 250, 6), ts("150", "620", 200, 5)]),
};
const expectedCols = {
  direct: 3, oneSame: 4, oneDiff: 5, twoSame: 5,
  twoFirstDiff: 6, twoSecondDiff: 6, twoDiff: 7, twoDiffSameName: 7,
};
const expectedWeights = {
  3: [20, 40, 40], 4: [15, 85 / 3, 85 / 3, 85 / 3], 5: [12, 22, 22, 22, 22],
  6: [10, 18, 18, 18, 18, 18], 7: [10, 15, 15, 15, 15, 15, 15],
};
const expectedCenters = {
  3: [10, 40, 80], 4: [7.5, 29.166666666666668, 57.5, 85.83333333333333],
  5: [6, 23, 45, 67, 89], 6: [5, 19, 37, 55, 73, 91],
  7: [5, 17.5, 32.5, 47.5, 62.5, 77.5, 92.5],
};
const colsOf = () => (el("stripCols").children || []).map(c => (c.children || []).map(k => k.textContent));
const colWeights = () => (el("stripCols").children || []).map(c => parseFloat(c.style.flexGrow));
const branchKids = () => el("stripBranches").children || [];
const branchPaths = () => branchKids().flatMap(c => (c.children || []).filter(k => k._branchPath));
const trackStub7 = makeEl("stripTrack");
el("stripBus").parentNode = trackStub7;
const trackSegs = () => (trackStub7.children || []).flatMap(c => (c.children || []).filter(k => k._trackSeg));
const walkPaths = () => trackSegs().filter(k => k._walkConnector);
const labelBox = () => el("stripBranchLabels");
const walkLabels = () => (labelBox().children || []).filter(c => c._walkLabel);

for (const [key, opt] of Object.entries(cases)) {
  const n = expectedCols[key];
  T.fns.renderStripColumns(opt, { name: "Timetable", lines: [] });
  const cols = colsOf();
  check(`(${key}) exactly ${n} columns (bus + stops)`,
    cols.length === n, JSON.stringify(cols.map(c => c[0])));
  check(`(${key}) weights ${expectedWeights[n].join("/")}`,
    approxArr(colWeights(), expectedWeights[n], 1e-9), JSON.stringify(colWeights()));
  check(`(${key}) font class cols-${n}`,
    el("stripCols").className.includes("cols-" + n), el("stripCols").className);
  // Column names in order, from the plan.
  const plan = T.fns.stripPlan(opt);
  const wantNames = ["Timetable"].concat(plan.cols.map(c => T.fns.stripStopName(String(c.stop))));
  check(`(${key}) column names in order (bus, origin, transfers, dest)`,
    JSON.stringify(cols.map(c => c[0])) === JSON.stringify(wantNames),
    JSON.stringify(cols.map(c => c[0])) + " vs " + JSON.stringify(wantNames));
  // Times: origin Depart only, dest Arrive only; same-stop stacked,
  // split alight Arrive only / board Depart only.
  const legs = opt.legs;
  check(`(${key}) origin column = Depart only, dest column = Arrive only`,
    cols[1][1] === "Depart " + fmt(legs[0].boardDep) && cols[1].length === 2 &&
    cols[cols.length - 1][1] === "Arrive " + fmt(legs[legs.length - 1].alightArr) &&
    cols[cols.length - 1].length === 2,
    JSON.stringify([cols[1], cols[cols.length - 1]]));
  // Approach elbows: one per leg after leg 0, from the staggered
  // start (board - 22 + li*3, clamped to [1, board-2]) merging
  // exactly at the board column, then the leg continues on the main
  // line to alight (diagram model, 2026-10-30).
  T.clearRT();
  const anchors = T.fns.stripFractionAnchors(plan);
  T.fns.renderStripBranches(opt, anchors, true);
  const paths = branchPaths();
  const wantBranch = [];
  for (let li = 1; li < legs.length; li++) wantBranch.push([
    Math.max(1, Math.min(anchors.legBoard[li] - 22 + li * 3, anchors.legBoard[li] - 2)),
    anchors.legBoard[li], anchors.legAlight[li]]);
  check(`(${key}) ${legs.length - 1} approach elbow(s), each from staggered start merging exactly at its board column`,
    paths.length === wantBranch.length && paths.every((p, i) =>
      approx(p._branchPath.startPct, wantBranch[i][0]) &&
      approx(p._branchPath.mergePct, wantBranch[i][1]) &&
      approx(p._branchPath.endPct, wantBranch[i][1]) &&
      approx(p._branchPath.alightPct, wantBranch[i][2])),
    JSON.stringify(paths.map(p => p._branchPath)));
  // Walk connectors: one per different-stop transfer, dashed, with minutes.
  const walks = walkPaths();
  const labels = walkLabels();
  check(`(${key}) walk connectors = ${plan.walks.length} (one per different-stop transfer), track-level zigzag (no straight segment), with minutes`,
    walks.length === plan.walks.length && walks.every((w, i) =>
      approx(w._walkConnector.fromPct, anchors.stops[plan.walks[i].from]) &&
      approx(w._walkConnector.toPct, anchors.stops[plan.walks[i].to]) &&
      w._walkConnector.walkMin === plan.walks[i].walkMin &&
      w._trackSeg && w._trackSeg.kind === "walk" && w._trackSeg.stepUnits === 32 && w._trackSeg.strokeWidth === 8) &&
    labels.length === plan.walks.filter(w => w.walkMin > 0).length &&
    labels.every((l, i) => l._walkLabel.walkMin === plan.walks.filter(w => w.walkMin > 0)[i].walkMin),
    JSON.stringify(walks.map(w => w._walkConnector)) + " labels=" + JSON.stringify(labels.map(l => l._walkLabel)));
  // Anchors: fraction centers match the weight table.
  check(`(${key}) fraction centers match weight table`,
    approx(anchors.bus, expectedCenters[n][0]) &&
    approxArr([anchors.bus].concat(anchors.stops), expectedCenters[n], 1e-9),
    JSON.stringify([anchors.bus].concat(anchors.stops)));
  // No-live tracker: dot state is none at the bus column center.
  const st = T.fns.stripDotState(opt, anchors, true);
  check(`(${key}) no-live tracker state is none at bus center ${expectedCenters[n][0]}`,
    st.mode === "none" && approx(st.pct, expectedCenters[n][0]), JSON.stringify(st));
}
// Same-stop cases keep the stacked transfer column exactly as before.
{
  const opt = cases.oneSame;
  T.fns.renderStripColumns(opt, { name: "Timetable", lines: [] });
  const cols = colsOf();
  check("(oneSame) same-stop transfer column stacks Arrive over Depart",
    cols[2][1] === "Arrive " + fmt(opt.legs[0].alightArr) &&
    cols[2][2] === "Depart " + fmt(opt.legs[1].boardDep),
    JSON.stringify(cols[2]));
  const opt2 = cases.twoSame;
  T.fns.renderStripColumns(opt2, { name: "Timetable", lines: [] });
  const cols2 = colsOf();
  check("(twoSame) both same-stop transfer columns stack Arrive over Depart",
    cols2[2][1] === "Arrive " + fmt(opt2.legs[0].alightArr) &&
    cols2[2][2] === "Depart " + fmt(opt2.legs[1].boardDep) &&
    cols2[3][1] === "Arrive " + fmt(opt2.legs[1].alightArr) &&
    cols2[3][2] === "Depart " + fmt(opt2.legs[2].boardDep),
    JSON.stringify([cols2[2], cols2[3]]));
}
// Similar-name, different-id pair splits (id-based detection).
{
  const opt = cases.twoDiffSameName;
  const plan = T.fns.stripPlan(opt);
  check("(twoDiffSameName) stops 150 and 620 share a name but form TWO columns (id-based)",
    plan.cols.length === 6 && plan.cols[3].stop === "150" && plan.cols[4].stop === "620" &&
    nameOf("150") === nameOf("620"),
    JSON.stringify(plan.cols.map(c => c.stop)) + " name=" + nameOf("150"));
  T.fns.renderStripColumns(opt, { name: "Timetable", lines: [] });
  const cols = colsOf();
  check("(twoDiffSameName) both same-name columns show the shared (strip-short) name, with split times",
    cols[4][0] === T.fns.stripStopName("150") && cols[5][0] === T.fns.stripStopName("620") &&
    cols[4][1] === "Arrive " + fmt(opt.legs[1].alightArr) &&
    cols[5][1] === "Depart " + fmt(opt.legs[2].boardDep),
    JSON.stringify([cols[4], cols[5]]));
}
// Fonts: 15/14/13 for 3/4/5, 11 for 6 AND 7 (second collision fix
// 2026-10-29: a 6-column strip still collided at 12px on a real phone).
check("(fonts) cols-3 15px, cols-4 14px, cols-5 13px, cols-6 11px, cols-7 11px",
  /\.strip-cols\.cols-3[^{]*\{[^}]*15px/.test(css) &&
  /\.strip-cols\.cols-4[^{]*\{[^}]*14px/.test(css) &&
  /\.strip-cols\.cols-5[^{]*\{[^}]*13px/.test(css) &&
  /\.strip-cols\.cols-6[^{]*\{[^}]*11px/.test(css) &&
  /\.strip-cols\.cols-7[^{]*\{[^}]*11px/.test(css));
// RTL: measured anchors mirror; branch endpoints mirror.
{
  const opt = cases.oneDiff;
  const plan = T.fns.stripPlan(opt);
  const ltr = T.fns.stripFractionAnchors(plan);
  getEl("html").dir = "rtl";
  // Display centers are the mirrored LTR centers (bus, origin, T1a, T1b, dest).
  const display = [ltr.bus].concat(ltr.stops).map(x => 100 - x);
  const m = T.fns.stripMeasuredAnchors(display, plan);
  check("(RTL) measured anchors convert back to LTR centers",
    !!m && approx(m.bus, ltr.bus) && approxArr(m.stops, ltr.stops, 1e-9) &&
    approxArr(m.legBoard, ltr.legBoard, 1e-9) && approxArr(m.legAlight, ltr.legAlight, 1e-9),
    JSON.stringify(m && [m.bus, m.stops]));
  T.clearRT();
  T.fns.renderStripBranches(opt, ltr, true);
  const paths = branchPaths();
  check("(RTL) elbow endpoints mirror (staggered start 48->52, merge 67->33, alight 89->11)",
    paths.length === 1 && approx(paths[0]._branchPath.startPct, 52) && approx(paths[0]._branchPath.mergePct, 33) && approx(paths[0]._branchPath.endPct, 33) && approx(paths[0]._branchPath.alightPct, 11),
    JSON.stringify(paths.map(p => p._branchPath)));
  getEl("html").dir = "ltr";
}
// Full board: 7-column journey renders one dot per stop column,
// including appended intermediate dots at the remaining centers.
{
  const opt = cases.twoDiff;
  const track = makeEl("track");
  const bus = el("stripBus"), wait = el("stripWait"), tr = el("stripTransfer"), dst = el("stripDest");
  // Stub DOM carries no HTML classes; the real page marks these spans
  // "strip-dot ..." (index.html lines 225-228).
  bus.className = "strip-dot bus"; wait.className = "strip-dot wait";
  tr.className = "strip-dot transfer"; dst.className = "strip-dot dest";
  track.children = [bus, wait, tr, dst];
  bus.parentNode = track;
  T.setJourneyState({ o: "x", d: "y", labelO: "Origin", labelD: "Dest",
    options: [opt], selected: 0, dayOffset: 0, dayDate: "2026-10-27",
    timeMode: { mode: "now" }, isToday: true, originWalkM: 0, originWalkMin: 0,
    boarding: null });
  T.fns.renderJourneyBoard();
  const dots = track.children.filter(c => (c.className || "").includes("strip-dot"));
  const lefts = dots.map(d => d.style.left).sort((a, b) => parseFloat(a) - parseFloat(b));
  check("(board 7-col) one dot per stop column: origin 17.5, intermediates 32.5/47.5/62.5/77.5, dest 92.5",
    lefts.includes("17.5%") && lefts.includes("32.5%") && lefts.includes("47.5%") &&
    lefts.includes("62.5%") && lefts.includes("77.5%") && lefts.includes("92.5%"),
    JSON.stringify(lefts));
  check("(board 7-col) transfer dot shown, bus dot dashed at bus center (no live)",
    tr.hidden !== true && bus.style.left === "5%",
    "transferHidden=" + tr.hidden + " busLeft=" + bus.style.left);
  check("(board 7-col) timetable bus column has no 'Timetable' text (pill above is the indicator)",
    colsOf()[0][0] === "",
    JSON.stringify(colsOf()[0]));
}
// Collision fixes (2026-10-29, first fix + second fix): clipped
// columns, strip-only short names, empty timetable bus column,
// single-word walk labels, side padding, branch-label backgrounds.
check("(collision) .strip-col clips overflow and can shrink below content (min-width 0)",
  /\.strip-col\s*\{[^}]*overflow:\s*hidden/.test(css) &&
  /\.strip-col\s*\{[^}]*min-width:\s*0/.test(css));
check("(collision) .strip-col has 3px side padding so adjacent texts never touch (gap 4px + 3px + 3px = 10px separation)",
  /\.strip-col\s*\{[^}]*padding:\s*0\s+3px/.test(css));
check("(collision) .strip-cols keeps 8px side margins so the last column is not clipped by the screen edge",
  /\.strip-cols\s*\{[^}]*margin:\s*0\s+8px\s+8px/.test(css));
check("(collision) strip short names: screenshot stops (Third Line + Rebecca St, South Oakville Centre, Laird + Ridgeway, Appleby GO, Oakville GO)",
  T.fns.stripStopName("1255") === "Third Line + Rebecca" &&
  T.fns.stripStopName("877") === "South Oakville" &&
  T.fns.stripStopName("1550") === "Laird + Ridgeway" &&
  T.fns.stripStopName("1543") === "Appleby GO" &&
  T.fns.stripStopName("1212") === "Oakville GO" &&
  T.fns.stripStopName("211") === "Monastery Dr + Greenbriar",
  [1255, 877, 1550, 1543, 1212, 211].map((id) => T.fns.stripStopName(String(id))).join(" | "));
check("(collision) full names untouched elsewhere (stopNameOf) for the same stops",
  T.fns.stopNameOf("1255") === "Third Line + Rebecca St" &&
  T.fns.stopNameOf("877") === "South Oakville Centre" &&
  T.fns.stopNameOf("211") === "Monastery Dr + Greenbriar Dr" &&
  T.fns.stopNameOf("1543") === "Appleby GO station");
check("(collision) exemption: stops whose shortened form would collide keep their FULL name (Fairview St at Appleby GO Station/station, Sixth Line + Elm Rd/Rd., Sixth Line + Miller Rd/Rd.)",
  T.fns.stripStopName("1541") === "Fairview St at Appleby GO station" &&
  T.fns.stripStopName("1542") === "Fairview St at Appleby GO Station" &&
  T.fns.stripStopName("1072") === "Sixth Line + Elm Rd" &&
  T.fns.stripStopName("23") === "Sixth Line + Elm Rd." &&
  T.fns.stripStopName("168") === "Sixth Line + Miller Rd" &&
  T.fns.stripStopName("976") === "Sixth Line + Miller Rd.",
  [1541, 1542, 1072, 23, 168, 976].map((id) => T.fns.stripStopName(String(id))).join(" | "));
check("(collision) global: no two stops with different full names share a displayed strip name",
  (() => {
    const seen = new Map();
    for (const s of stops.stops) {
      const disp = T.fns.stripStopName(String(s.id));
      if (seen.has(disp) && seen.get(disp) !== s.name) return false;
      seen.set(disp, s.name);
    }
    return true;
  })());
check("(collision) branch labels have a solid background + padding so near labels stay readable",
  /\.branch-label\s*\{[^}]*background:\s*#fff[^}]*padding:\s*2px\s+6px/.test(css));
{
  const opt = cases.oneDiff;
  const plan = T.fns.stripPlan(opt);
  const anchors = T.fns.stripFractionAnchors(plan);
  T.clearRT();
  T.fns.renderStripBranches(opt, anchors, true);
  const labels = walkLabels();
  check("(collision) walk label has no duplicated walk word (en: '6 min walk')",
    labels.length === 1 && labels[0].textContent === "6 min walk",
    JSON.stringify(labels.map(l => l.textContent)));
  T.fns.setLang("fr");
  T.fns.renderStripBranches(opt, anchors, true);
  const frLabels = walkLabels();
  check("(collision) walk label has no duplicated walk word (fr: '6 min de marche')",
    frLabels.length === 1 && frLabels[0].textContent === "6 min de marche",
    JSON.stringify(frLabels.map(l => l.textContent)));
  T.fns.setLang("en");
}
// Legacy pair board path untouched: it still uses stripColumnAnchors(0)
// with 3 columns, and the direct journey board still renders 3 columns.
check("(legacy) pair-board code still calls stripColumnAnchors(0)",
  html.includes("stripColumnAnchors(0)"));
check("(legacy) direct board renders exactly 3 columns",
  (() => { T.fns.renderStripColumns(cases.direct, { name: "Timetable", lines: [] });
    return colsOf().length === 3; })());

console.log(failures === 0 ? "ALL STRIP7COL CHECKS PASSED" : failures + " FAILURES");
