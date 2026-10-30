// Google-parity Phase 1 + Phase 3 harness (2026-10-28): multi-transfer
// routing (up to 2 transfers), time picker (Leave now / Depart at /
// Arrive by), and total-time ranking. Runs the real public/index.html
// inline script in Node with a stub DOM + stub localStorage/fetch.
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
vm.runInContext(script + `
globalThis.__t = {
  journey: () => journeyState,
  timeMode: () => timeMode,
  i18n: () => I18N,
  setJourneyState: (j) => { journeyState = j; },
  fns: { searchJourneys, searchJourneysLegacy, setTimeMode, resetTimeMode,
    renderJourneyBoard, buildJourneyMapData, setShapeData, journeyOptionSummary,
    stopNameOf, stopCodeOf, setNavEndpoint, endpointFromStop, endpointFromPlace,
    pickLanguage, renderTimeControls },
};
`, sandbox);
const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 60 && !sandbox.__t.journey(); i++) await tick();
await tick(200);
const T = sandbox.__t;
const el = (id) => getEl(id);
let failures = 0;
function check(name, cond, extra = "") {
  console.log((cond ? "PASS" : "FAIL") + " " + name + (cond ? "" : " " + extra));
  if (!cond) failures++;
}
const fmt = (m) => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(Math.floor(m % 60)).padStart(2, "0");
const ranked = (o, d, now, tm, destEndpoint) =>
  T.fns.searchJourneys(o, d, now, null,
    { rank: "total", timeMode: tm || { mode: "now" }, originWalkMin: 0, destEndpoint: destEndpoint || null });
// Invariants every ranked option must satisfy (Phase 1 guardrails +
// Phase 3 ranking formula). mode "arrive" uses the same penalty formula.
function validateRanked(label, res) {
  if (!res) { check(label + " has options", false); return; }
  check(label + " returns 1-3 options", res.options.length >= 1 && res.options.length <= 3,
    "n=" + res.options.length);
  for (const opt of res.options) {
    check(label + " transfers <= 2, legs = transfers + 1",
      opt.transfers <= 2 && opt.legs.length === opt.transfers + 1,
      "transfers=" + opt.transfers + " legs=" + opt.legs.length);
    check(label + " score = total + 5 * max(0, transfers - 1) (penalty is ranking-only)",
      opt.scoreMin === opt.totalMin + 5 * Math.max(0, opt.transfers - 1),
      "total=" + opt.totalMin + " score=" + opt.scoreMin + " transfers=" + opt.transfers);
    for (let i = 0; i < opt.legs.length - 1; i++) {
      const ts = opt.transferStops[i];
      const gap = opt.legs[i + 1].boardDep - opt.legs[i].alightArr;
      check(label + " transfer " + (i + 1) + " gap >= max(5, walkMin), walk <= 300 m",
        !!ts && gap >= Math.max(5, ts.walkMin) && ts.walkM <= 300,
        "gap=" + gap + " walkM=" + (ts && ts.walkM) + " walkMin=" + (ts && ts.walkMin));
      check(label + " transfer " + (i + 1) + " walkMin matches 0.8 m/s",
        ts.walkMin === (ts.walkM === 0 ? 0 : Math.ceil(ts.walkM / 48)),
        "walkM=" + ts.walkM + " walkMin=" + ts.walkMin);
      check(label + " transfer " + (i + 1) + " legs are different trips",
        opt.legs[i].tripIdx !== opt.legs[i + 1].tripIdx);
    }
  }
}

const tueMorning = new Date("2026-10-27T12:10:00Z"); // Tue 2026-10-27 08:10 EDT
const tueEvening = new Date("2026-10-27T22:00:00Z"); // Tue 2026-10-27 18:00 EDT

// (a) PROOF: a journey that requires 2 transfers and was previously
// "no ride". Uptown Core Terminal (1293) -> Bristol Circle + 2872
// Bristol Circle (562), Tue 08:10: R1 08:10 -> stop 162, walk 293 m to
// 1071, R120 08:39 -> 150, walk 50 m to 620, R12 09:16 -> 562 arr 09:18.
// The legacy (max-1-transfer) engine returns null for the same pair.
const proof = ranked("1293", "562", tueMorning);
check("(a) 2-transfer proof pair returns a valid 3-leg journey",
  !!proof && proof.options[0].transfers === 2 && proof.options[0].legs.length === 3,
  JSON.stringify(proof && proof.options.map(o => o.transfers)));
if (proof) {
  const top = proof.options[0];
  check("(a) proof legs are R1, R120, R12 arriving 09:18",
    top.legs[0].route === "1" && top.legs[1].route === "120" && top.legs[2].route === "12" &&
    Math.round(top.legs[2].alightArr) === 558,
    top.legs.map(l => l.route + " " + fmt(l.boardDep) + "->" + fmt(l.alightArr)).join(" | "));
  check("(a) proof names both transfer stops",
    top.transferStops.length === 2 &&
    top.transferStops.every(ts => T.fns.stopNameOf(ts.alightStop) && T.fns.stopNameOf(ts.alightStop) !== ts.alightStop),
    JSON.stringify(top.transferStops));
  validateRanked("(a) proof", proof);
}
check("(a) legacy max-1 engine returns no ride for the proof pair",
  T.fns.searchJourneysLegacy("1293", "562", tueMorning) === null);

// (b) Depart at: fixed time, same pair — every option departs at/after
// the chosen time; and a future-day depart (Wed 2026-10-28 08:00,
// Oakville GO -> Iqbal stop 789) lands on that date, not today.
const depart = ranked("1293", "562", tueMorning,
  { mode: "depart", dateStr: "20261027", display: "2026-10-27", timeMin: 490 });
check("(b) Depart-at returns journeys departing at/after the chosen time",
  !!depart && depart.options.every(o => o.legs[0].boardDep >= 490),
  JSON.stringify(depart && depart.options.map(o => fmt(o.legs[0].boardDep))));
check("(b) Depart-at top option boards at the chosen time (R1 08:10)",
  !!depart && Math.round(depart.options[0].legs[0].boardDep) === 490);
const departFuture = ranked("1212", "789", tueMorning,
  { mode: "depart", dateStr: "20261028", display: "2026-10-28", timeMin: 480 });
check("(b) Depart-at future day lands on 2026-10-28, not today, timetable (isToday false)",
  !!departFuture && departFuture.dayDate === "2026-10-28" && departFuture.isToday === false &&
  departFuture.options.every(o => o.legs[0].boardDep >= 480),
  JSON.stringify(departFuture && { dayDate: departFuture.dayDate, isToday: departFuture.isToday }));
// UI-level: setTimeMode + nav endpoints re-run the board in depart mode.
{
  const s1293 = stops.stops.find(s => s.id === "1293");
  const s562 = stops.stops.find(s => s.id === "562");
  T.fns.setNavEndpoint("origin", T.fns.endpointFromStop(s1293));
  T.fns.setNavEndpoint("dest", T.fns.endpointFromStop(s562));
  const ok = T.fns.setTimeMode("depart", "2026-10-27", "08:10");
  const j = T.journey();
  check("(b) setTimeMode(depart) re-runs the board in depart mode",
    ok === true && j && j.timeMode && j.timeMode.mode === "depart" &&
    !!j.options && j.options.length > 0,
    JSON.stringify(j && { mode: j.timeMode && j.timeMode.mode, opts: j.options && j.options.length }));
  T.fns.resetTimeMode();
}

// (c) Arrive by: deadline Tue 09:30 — every option arrives by it, and
// the top option arrives by it (09:18, the same 3-leg journey).
const arrive = ranked("1293", "562", tueMorning,
  { mode: "arrive", dateStr: "20261027", display: "2026-10-27", timeMin: 570 });
check("(c) Arrive-by returns journeys arriving by the deadline (all options)",
  !!arrive && arrive.options.every(o => o.legs[o.legs.length - 1].alightArr <= 570),
  JSON.stringify(arrive && arrive.options.map(o => fmt(o.legs[o.legs.length - 1].alightArr))));
check("(c) Arrive-by top option arrives by the deadline (09:18 <= 09:30)",
  !!arrive && Math.round(arrive.options[0].legs[arrive.options[0].legs.length - 1].alightArr) === 558);
if (arrive) validateRanked("(c) arrive-by", arrive);

// (d) Total-time ranking: Uptown Core (1293) -> River Oaks Blvd East +
// Oakmead Blvd (1191), Tue 18:00. The 2-transfer journey (R1 18:00 ->
// 138, walk 93 m to 1296, R190 18:11 -> 201, walk 262 m to 73, R19 18:19
// -> 1191 arr 18:20; total 20, score 20 + 5 penalty = 25) ranks FIRST,
// ahead of the direct R19 18:27 -> 18:50 (total 50, score 50) — and the
// direct option is still present in the list, not hidden.
const ranking = ranked("1293", "1191", tueEvening);
check("(d) 2-transfer option ranks first ahead of the direct option",
  !!ranking && ranking.options[0].transfers === 2,
  JSON.stringify(ranking && ranking.options.map(o => [o.transfers, o.totalMin, o.scoreMin])));
if (ranking) {
  const top = ranking.options[0];
  const direct = ranking.options.find(o => o.transfers === 0);
  check("(d) top 2-transfer total 20, score 25 (= total + 5 penalty for the 2nd transfer)",
    top.totalMin === 20 && top.scoreMin === 25,
    "total=" + top.totalMin + " score=" + top.scoreMin);
  check("(d) direct option still present (R19 18:27 -> 18:50, total 50)",
    !!direct && Math.round(direct.legs[0].boardDep) === 1107 &&
    Math.round(direct.legs[0].alightArr) === 1130 && direct.totalMin === 50,
    JSON.stringify(direct && { boardDep: direct.legs[0].boardDep, alightArr: direct.legs[0].alightArr, total: direct.totalMin }));
  check("(d) top score beats the direct score despite the penalty",
    !!direct && top.scoreMin < direct.scoreMin,
    "top score=" + top.scoreMin + " direct score=" + (direct && direct.scoreMin));
  check("(d) first option holds the minimum score in the list",
    top.scoreMin === Math.min(...ranking.options.map(o => o.scoreMin)));
  validateRanked("(d) ranking", ranking);
  // Explanation line: non-best (direct) option states how much slower.
  const summary = T.fns.journeyOptionSummary(direct, 0, ranking.options[0]);
  check("(d) direct option's explanation line states it is slower than the fastest",
    summary.includes("30") && /slower than the fastest|比最快方案慢|plus lent|أبطأ من الأسرع|सबसे तेज़ से/.test(summary),
    summary);
}

// (e) Destination walk is included in displayed total time. Iqbal
// Foods Oakville place (stop 789, 168 m from the stop): the same
// direct journey's total grows by exactly the destination walk when
// the place endpoint (with coordinates) is supplied vs no endpoint.
const iqbal = places.places.find(p => p.id === "iqbal-foods-oakville");
const noDest = ranked("1212", "789", tueMorning);
const withDest = ranked("1212", "789", tueMorning, { mode: "now" },
  { lat: iqbal.lat, lon: iqbal.lon });
check("(e) destination-walk fixture found (Iqbal place, stop 789)",
  !!iqbal && iqbal.stop.id === "789");
if (noDest && withDest) {
  const baseOpt = noDest.options.find(o => o.transfers === 0);
  const match = baseOpt && withDest.options.find(o => o.transfers === 0 &&
    o.legs[0].route === baseOpt.legs[0].route &&
    Math.round(o.legs[0].boardDep) === Math.round(baseOpt.legs[0].boardDep));
  check("(e) destination walk > 0 for the place endpoint (about 168 m)",
    !!match && match.destWalkM >= 100 && match.destWalkM <= 250 && match.destWalkMin > 0,
    JSON.stringify(match && { destWalkM: match.destWalkM, destWalkMin: match.destWalkMin }));
  check("(e) total with destination endpoint exceeds total without by exactly the destination walk",
    !!match && !!baseOpt &&
    Math.round(match.totalMin - baseOpt.totalMin) === match.destWalkMin,
    JSON.stringify(match && baseOpt && { withTotal: match.totalMin, withoutTotal: baseOpt.totalMin, destWalkMin: match.destWalkMin }));
  check("(e) destination walk minutes match 0.8 m/s (ceil of metres / 48)",
    !!match && match.destWalkMin === Math.ceil(match.destWalkM / 48));
}

// (f) Time-picker UI labels exist in all 5 languages (draft), the
// picker is behind one Time button, and Leave-now reset works.
check("(f) time picker is behind one Time button in the HTML",
  html.includes('id="timeBtn"') && html.includes('id="timePanel"'));
for (const lang of ["en", "fr", "zh", "ar", "hi"]) {
  const d = T.i18n()[lang];
  check("(f) time-picker labels exist in " + lang,
    d && d.timeBtn && d.timeTitle && d.timeLeaveNow && d.timeDepartAt &&
    d.timeArriveBy && d.timeDepartLabel && d.timeArriveLabel && d.twoTransfers);
}
// 2026-10-29: the Apply ("Search with this time") and Reset
// ("Back to Leave now") buttons were deleted by user decision; the
// panel is now three mode buttons + date/time inputs that apply on
// change. timeApply/timeBackToNow keys are gone with them.
check("(f) no Apply/Reset buttons or keys remain",
  !html.includes('id="timeApply"') && !html.includes('id="timeReset"') &&
  !html.includes("timeApply") && !html.includes("timeBackToNow") &&
  !html.includes("timeReset"));
check("(f) Leave-now note and pairNote are deleted entirely",
  !html.includes("Leave now: the next bus from now.") &&
  !html.includes("Common trips (shortcuts only)") &&
  !html.includes('id="pairNote"') && !html.includes("pairNote"));
T.fns.pickLanguage("en");
T.fns.setTimeMode("depart", "2026-10-27", "08:10");
check("(f) time mode is depart after setTimeMode",
  T.timeMode().mode === "depart");
T.fns.resetTimeMode();
check("(f) Leave now reset restores Leave-now mode and hides the panel",
  T.timeMode().mode === "now" && el("timePanel").hidden === true);
check("(f) Time button shows Leave now after reset",
  (el("timeBtn").textContent || "").includes(T.i18n().en.timeLeaveNow));

// (g) 2-transfer board / strip / map data contain 3 legs and
// 2 transfer markers. Render the proof journey's board in the stub
// DOM, then build its map data with stubbed verbatim shapes.
{
  const top = proof.options[0];
  T.setJourneyState({ o: "1293", d: "562", labelO: "Uptown Core Terminal",
    labelD: "Bristol Circle", options: proof.options, selected: 0,
    dayOffset: 0, dayDate: "2026-10-27", timeMode: { mode: "now" },
    isToday: true, originWalkM: 0, originWalkMin: 0, boarding: null });
  T.fns.renderJourneyBoard();
  const stripText = el("stripLegs").textContent || "";
  check("(g) board strip lists all 3 legs (R1, R120, R12)",
    stripText.includes("1") && stripText.includes("120") && stripText.includes("12"),
    stripText);
  check("(g) board strip names both transfer stops",
    top.transferStops.every(ts => stripText.includes(T.fns.stopNameOf(ts.alightStop))),
    stripText);
  check("(g) board pills label the journey 2 transfers",
    (el("pills").innerHTML || "").includes("2 transfers"));
  check("(g) board next line names both transfer stops",
    top.transferStops.every(ts => (el("nextLine").textContent || "").includes(T.fns.stopNameOf(ts.alightStop))),
    el("nextLine").textContent);
  // Stub shapes: one shape id per route, keyed service|original.
  for (const leg of top.legs) {
    const sid = "shape-" + leg.route;
    const shape = [[43.45, -79.68], [43.46, -79.67], [43.47, -79.66], [43.48, -79.65]];
    const trips = {};
    trips[leg.service + "|" + leg.original] = sid;
    T.fns.setShapeData(leg.route, { shapes: { [sid]: shape }, trips });
  }
  const mapData = T.fns.buildJourneyMapData(top);
  check("(g) map data contains 3 legs with verbatim shapes",
    !!mapData && mapData.legs.length === 3 && mapData.legs.every(l => l.shape && l.shape.length > 2),
    JSON.stringify(mapData && mapData.legs.map(l => l.route)));
  check("(g) map data contains 2 transfer markers (+ origin + destination)",
    !!mapData && mapData.markers.filter(m => m.kind === "transfer").length === 2 &&
    mapData.markers.some(m => m.kind === "origin") && mapData.markers.some(m => m.kind === "destination"),
    JSON.stringify(mapData && mapData.markers.map(m => m.kind + ":" + m.stopId)));
  check("(g) map data routes are R1, R120, R12",
    !!mapData && JSON.stringify(mapData.routes) === JSON.stringify(["1", "120", "12"]));
}

// (h) Timing: the multi-transfer search on representative pairs stays
// in the ~1-2 s ballpark on this machine (assert < 2000 ms, report ms).
function timed(label, fn) {
  const t0 = Date.now();
  const res = fn();
  const ms = Date.now() - t0;
  console.log("TIMING " + label + ": " + ms + " ms");
  check("(h) " + label + " multi-transfer search under 2000 ms", ms < 2000, ms + " ms");
  return res;
}
timed("1293 -> 562 (2-transfer proof)", () => ranked("1293", "562", tueMorning));
timed("1212 -> 252 (ranking pair)", () => ranked("1212", "252", tueMorning));
timed("1293 -> 1191 (ranking pair, evening)", () => ranked("1293", "1191", tueEvening));

console.log(failures === 0 ? "ALL GOOGLE 1+3 TESTS PASSED" : failures + " TEST(S) FAILED");
process.exit(failures === 0 ? 0 : 1);
