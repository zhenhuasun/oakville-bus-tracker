// Board-clarity harness (2026-10-29): countdown label per mode/live state,
// chronological nextLine, "Bus coming" stops-away parenthetical with hard
// fallbacks, strip HH:MM time labels (incl. 2-transfer stagger + RTL),
// and the item-4-step-1 moving strip dot by stop progress. Runs the real
// public/index.html inline script in Node with a stub DOM. No browser,
// no network, no deploy.
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
  tt: () => TT,
  journey: () => journeyState,
  i18n: () => I18N,
  setJourneyState: (j) => { journeyState = j; },
  setRT: (trips, vehicles) => { RT.trips = new Map(trips); RT.vehicles = new Map(vehicles); RT.ok = true; },
  clearRT: () => { RT.trips = new Map(); RT.vehicles = new Map(); RT.alerts = []; RT.ok = false; },
  fns: { searchJourneys, renderJourneyBoard, legStopIndex, vehicleStopProgress,
    stripDotState, busAwayInfo, busAwayParts, stripColumnAnchors, measureStripCenters, measuredAnchors,
    renderStripColumns, branchTrackerStates, branchPoint, stopNameOf, stopCodeOf, stripStopName,
    fmtTime, pickLanguage, legLive },
};
`, sandbox);
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
const tueMorning = new Date("2026-11-17T13:10:00Z"); // Tue 2026-11-17 08:10 EST

// Fixtures: a direct journey and the 2-transfer proof journey (ranked
// search, as in test_google13 — the bare call does not rank by total).
const ranked = (o, d, extra) => T.fns.searchJourneys(o, d, tueMorning, null,
  Object.assign({ rank: "total", timeMode: { mode: "now" }, originWalkMin: 0, destEndpoint: null }, extra || {}));
const direct = ranked("1212", "789");
const directOpt = direct && direct.options.find(o => o.transfers === 0);
check("fixture direct option exists", !!directOpt);
const proof = ranked("1293", "562");
const proofOpt = proof && proof.options.find(o => o.transfers === 2);
check("fixture 2-transfer option exists", !!proofOpt);

// Leg row indices for the direct leg (board/alight in the full trip).
const dLeg = directOpt.legs[0];
const dRows = T.tt().trips[dLeg.tripIdx][3];
const dBi = T.fns.legStopIndex(dLeg, dLeg.boardStop, dLeg.boardDep, true);
const dAi = T.fns.legStopIndex(dLeg, dLeg.alightStop, dLeg.alightArr, false);
check("direct leg board/alight indices resolve and bracket the ride",
  dBi >= 0 && dAi > dBi, "bi=" + dBi + " ai=" + dAi);
const boardCoord = stopCoord(dLeg.boardStop);
const vehAt = (stopId) => { const c = stopCoord(stopId); return { latitude: c[0], longitude: c[1] }; };
const vehKey = (leg) => leg.original + "|" + leg.route;
// Synthetic mid-trip leg (real trip rows) for before-boarding cases:
// 1212 is a trip-start terminal, so no real direct option boards mid-trip.
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
const sBi = T.fns.legStopIndex(synth, synth.boardStop, synth.boardDep, true);
const sAi = T.fns.legStopIndex(synth, synth.alightStop, synth.alightArr, false);
check("synthetic leg board/alight indices are 3 and 5", sBi === 3 && sAi === 5, "bi=" + sBi + " ai=" + sAi);
const setVehicle = (leg, stopId) => T.setRT([], [[vehKey(leg), vehAt(stopId)]]);
const tripUpdateAt = (leg, minutesFromNow) => [[vehKey(leg),
  { stops: [{ stop_id: leg.boardStop, time: Math.floor(Date.now() / 1000) + minutesFromNow * 60 }] }]];
const render = (opt, extra = {}) => {
  T.setJourneyState(Object.assign({ o: "x", d: "y", labelO: "Origin", labelD: "Dest",
    options: [opt], selected: 0, dayOffset: 0, dayDate: "2026-11-17",
    timeMode: { mode: "now" }, isToday: true, originWalkM: 0, originWalkMin: 0,
    boarding: null }, extra));
  T.fns.renderJourneyBoard();
};

// ---- (a) Countdown label per mode / live state, en + one RTL language.
T.clearRT();
render(directOpt);
check("(a) Leave-now + timetable label is 'Next bus leaving in'",
  el("countdownLabel").textContent === "Next bus leaving in", el("countdownLabel").textContent);
render(directOpt, { timeMode: { mode: "depart", display: "2026-11-17", timeMin: 490 } });
check("(a) Depart-at label is 'Departs at' (not a countdown label)",
  el("countdownLabel").textContent === "Departs at", el("countdownLabel").textContent);
render(directOpt, { timeMode: { mode: "arrive", display: "2026-11-17", timeMin: 600 } });
check("(a) Arrive-by label is 'Boarding at'",
  el("countdownLabel").textContent === "Boarding at", el("countdownLabel").textContent);
// Live: trip update 5 min out for the boarding stop.
T.setRT(tripUpdateAt(dLeg, 5), []);
render(directOpt);
check("(a) Leave-now + live label is 'Bus arriving in'",
  el("countdownLabel").textContent === "Bus arriving in", el("countdownLabel").textContent);
// RTL language (Arabic): label follows the language pack, not English.
T.fns.pickLanguage("ar");
T.clearRT();
render(directOpt);
check("(a) RTL (ar) Leave-now label is the Arabic pack string",
  el("countdownLabel").textContent === "الحافلة القادمة بعد", el("countdownLabel").textContent);
T.fns.pickLanguage("en");

// ---- (b) nextLine is a true timeline with transfer alighting times.
T.clearRT();
render(proofOpt);
const nl = el("nextLine").textContent || "";
const iTotal = nl.indexOf("Total journey"), iDepart = nl.indexOf("Depart"),
  iT1 = nl.indexOf(T.fns.stopNameOf(proofOpt.transferStops[0].alightStop)),
  iT2 = nl.indexOf(T.fns.stopNameOf(proofOpt.transferStops[1].alightStop)),
  iArr = nl.indexOf("Arrives");
check("(b) nextLine order is Total -> Depart -> Transfer1 -> Transfer2 -> Arrives",
  iTotal >= 0 && iTotal < iDepart && iDepart < iT1 && iT1 < iT2 && iT2 < iArr, nl);
check("(b) nextLine contains both transfer alighting times",
  nl.includes(fmt(proofOpt.legs[0].alightArr)) && nl.includes(fmt(proofOpt.legs[1].alightArr)), nl);
check("(b) nextLine contains both next-leg board times",
  nl.includes(fmt(proofOpt.legs[1].boardDep)) && nl.includes(fmt(proofOpt.legs[2].boardDep)), nl);
check("(b) nextLine alight precedes its next board for transfer 1",
  nl.indexOf(fmt(proofOpt.legs[0].alightArr)) < nl.indexOf(fmt(proofOpt.legs[1].boardDep)), nl);
// Final walk segment comes after Arrives when a destination endpoint exists.
const destStop = stops.stops.find(s => s.id === String(dLeg.alightStop));
const withWalk = ranked("1212", "789",
  { destEndpoint: { lat: destStop.lat + 0.001, lon: destStop.lon } });
const walkOpt = withWalk && withWalk.options[0];
if (walkOpt && (walkOpt.destWalkMin || 0) > 0) {
  render(walkOpt);
  const nlw = el("nextLine").textContent || "";
  check("(b) final walk segment comes after Arrives",
    nlw.indexOf("Arrives") < nlw.indexOf("Walk") && nlw.includes("to your destination"), nlw);
} else {
  check("(b) walk fixture has a destination walk", false, "destWalkMin=" + (walkOpt && walkOpt.destWalkMin));
}

// ---- (c) "Bus coming" parenthetical: live only, with hard fallbacks.
T.setRT(tripUpdateAt(synth, 5), [[vehKey(synth), vehAt(sRows[1][0])]]);
render(synthOpt);
const busColLines = () => (el("stripCols").children[0] ? (el("stripCols").children[0].children || []).map(k => k.textContent) : []);
const busColText = () => busColLines().join(" ");
const busLabel = busColText();
check("(c) live parenthetical shows 2 stops away + est. ~min",
  busLabel.includes("2 stops away") && /est\. ~\d+ min/.test(busLabel), busLabel);
T.setRT(tripUpdateAt(dLeg, 5), [[vehKey(dLeg), vehAt(dLeg.boardStop)]]);
render(directOpt);
check("(c) vehicle at the boarding stop shows 'at your stop', never '0 stops away'",
  busColText().includes("at your stop") &&
  !busColText().includes("0 stops away"), busColText());
T.setRT(tripUpdateAt(dLeg, 5), [[vehKey(dLeg), vehAt(dRows[dBi + 1][0])]]);
render(directOpt);
check("(c) vehicle past the boarding stop: plain 'Bus coming', no parenthetical",
  busColText() === "Bus coming", busColText());
T.setRT(tripUpdateAt(dLeg, 5), [[vehKey(dLeg), { latitude: 43.0, longitude: -79.0 }]]);
render(directOpt);
check("(c) unsnappable vehicle (>500 m from any stop): plain 'Bus coming'",
  busColText() === "Bus coming", busColText());
T.setRT([], [[vehKey(dLeg), vehAt(dLeg.boardStop)]]);
render(directOpt);
check("(c) vehicle but no trip-update prediction: plain 'Bus coming'",
  busColText() === "Bus coming", busColText());
T.setRT(tripUpdateAt(dLeg, -5), [[vehKey(dLeg), vehAt(dLeg.boardStop)]]);
render(directOpt);
check("(c) negative prediction: plain 'Bus coming'",
  busColText() === "Bus coming", busColText());
T.clearRT();
render(directOpt);
check("(c) timetable mode: bus column has NO 'Timetable' text (pill above is the indicator), no parenthetical",
  busColText() === "", busColText());

// ---- (d) Strip redesign: flex columns ABOVE the track (name + time),
// below-track zone holds no names/times, RTL column order mirrors.
// Direct: 2 columns; origin = Depart + boardDep, dest = Arrive + alightArr.
T.clearRT();
render(directOpt);
const colsOf = (id) => (el(id).children || []).map(c => (c.children || []).map(k => k.textContent));
const dCols = colsOf("stripCols");
check("(d) direct strip has 3 columns above the track (bus, origin, destination)",
  dCols.length === 3, JSON.stringify(dCols));
check("(d) origin column = board stop name + 'Depart HH:MM'",
  dCols[1] && dCols[1][0] === T.fns.stripStopName(dLeg.boardStop) && dCols[1][1] === "Depart " + fmt(dLeg.boardDep),
  JSON.stringify(dCols[1]));
check("(d) destination column = alight stop name + 'Arrive HH:MM'",
  dCols[2] && dCols[2][0] === T.fns.stopNameOf(dLeg.alightStop) && dCols[2][1] === "Arrive " + fmt(dLeg.alightArr),
  JSON.stringify(dCols[2]));
check("(d) no station name is truncated with an ellipsis",
  !JSON.stringify(dCols).includes("\u2026") && !JSON.stringify(dCols).includes("..."), JSON.stringify(dCols));
check("(d) direct journey: below-track branch zone is empty",
  (el("stripBranches").children || []).length === 0, JSON.stringify((el("stripBranches").children || []).length));
render(proofOpt);
const pCols = colsOf("stripCols");
check("(d) 2-transfer (both different-stop fixture): 7 columns (bus, origin, T1a, T1b, T2a, T2b, destination)",
  pCols.length === 7, JSON.stringify(pCols.map(c => c[0])));
check("(d) transfer-1 splits: alight column = Arrive (prev alight) only, board column = Depart (next board) only",
  pCols[2] && pCols[2][0] === T.fns.stripStopName(proofOpt.transferStops[0].alightStop) &&
  pCols[2][1] === "Arrive " + fmt(proofOpt.legs[0].alightArr) && pCols[2].length === 2 &&
  pCols[3] && pCols[3][0] === T.fns.stripStopName(proofOpt.transferStops[0].boardStop) &&
  pCols[3][1] === "Depart " + fmt(proofOpt.legs[1].boardDep) && pCols[3].length === 2,
  JSON.stringify([pCols[2], pCols[3]]));
check("(d) transfer-2 splits: alight column = Arrive (prev alight) only, board column = Depart (next board) only",
  pCols[4] && pCols[4][0] === T.fns.stripStopName(proofOpt.transferStops[1].alightStop) &&
  pCols[4][1] === "Arrive " + fmt(proofOpt.legs[1].alightArr) && pCols[4].length === 2 &&
  pCols[5] && pCols[5][0] === T.fns.stripStopName(proofOpt.transferStops[1].boardStop) &&
  pCols[5][1] === "Depart " + fmt(proofOpt.legs[2].boardDep) && pCols[5].length === 2,
  JSON.stringify([pCols[4], pCols[5]]));
check("(d) no pipe-format transfer time anywhere in the columns",
  !JSON.stringify(pCols).includes(" | "), JSON.stringify(pCols));
// RTL: DOM column order stays origin-first; the flex row mirrors via
// document direction (the track dots mirror the same way), so the
// origin column stays at the origin side. Assert DOM order + dir flag.
getEl("html").dir = "rtl";
render(directOpt);
const rtlCols = colsOf("stripCols");
check("(d) RTL: second DOM column is the origin stop (bus column first; flex mirrors it to the origin side)",
  rtlCols[1] && rtlCols[1][0] === T.fns.stripStopName(dLeg.boardStop) && rtlCols[0][0] === "", JSON.stringify(rtlCols.map(c => c[0])));
getEl("html").dir = "ltr";

// ---- (e) Moving dot by stop progress (unit + integration).
const anchorsD = { start: 10, board: 40, transfers: [], dest: 80 };
const anchors2 = { start: 6, board: 23, transfers: [45, 67], dest: 89 };
const st = (opt, anchors, vehMap) => {
  T.setRT([], vehMap);
  return T.fns.stripDotState(opt, anchors, true);
};
check("(e) no live vehicle: dot state is none at the strip start",
  (() => { const s = st(directOpt, anchorsD, []); return s.mode === "none" && s.pct === 10; })());
check("(e) dot advances as the vehicle approaches the boarding stop",
  (() => {
    const a = st(synthOpt, anchorsD, [[vehKey(synth), vehAt(sRows[1][0])]]);
    const b = st(synthOpt, anchorsD, [[vehKey(synth), vehAt(sRows[2][0])]]);
    return a.mode === "moving" && b.mode === "moving" && a.pct > 10 && a.pct < b.pct && b.pct < 40;
  })());
check("(e) dot at the boarding stop sits exactly on the board anchor",
  (() => { const s = st(directOpt, anchorsD, [[vehKey(dLeg), vehAt(dLeg.boardStop)]]);
    return s.mode === "moving" && s.pct === 40; })());
check("(e) dot mid-ride sits between board and dest anchors",
  (() => {
    const mid = dRows[Math.floor((dBi + dAi) / 2)][0];
    const s = st(directOpt, anchorsD, [[vehKey(dLeg), vehAt(mid)]]);
    return s.mode === "moving" && s.pct > 40 && s.pct < 80;
  })());
check("(e) vehicle past the final alighting stop: arrived at dest, fade",
  (() => { const s = st(directOpt, anchorsD, [[vehKey(dLeg), vehAt(dRows[dAi + 1][0])]]);
    return s.mode === "arrived" && s.pct === 80; })());
// Transfer journey: leg1 passed + leg2 live -> dot on the leg2 segment.
const pLegs = proofOpt.legs;
const pRows1 = T.tt().trips[pLegs[1].tripIdx][3];
const pBi1 = T.fns.legStopIndex(pLegs[1], pLegs[1].boardStop, pLegs[1].boardDep, true);
const pAi1 = T.fns.legStopIndex(pLegs[1], pLegs[1].alightStop, pLegs[1].alightArr, false);
const pRows0 = T.tt().trips[pLegs[0].tripIdx][3];
const pAi0 = T.fns.legStopIndex(pLegs[0], pLegs[0].alightStop, pLegs[0].alightArr, false);
check("(e) transfer: leg1 passed + leg2 mid-ride -> dot between transfer anchors",
  (() => {
    const mid1 = pRows1[Math.floor((pBi1 + pAi1) / 2)][0];
    const s = st(proofOpt, anchors2, [
      [vehKey(pLegs[0]), vehAt(pRows0[pAi0 + 1][0])],
      [vehKey(pLegs[1]), vehAt(mid1)],
    ]);
    return s.mode === "moving" && s.pct > 45 && s.pct < 67;
  })());
check("(e) transfer: leg1 passed + leg2 has no vehicle -> waiting dashed at transfer anchor",
  (() => {
    const s = st(proofOpt, anchors2, [[vehKey(pLegs[0]), vehAt(pRows0[pAi0 + 1][0])]]);
    return s.mode === "waiting" && s.pct === 45;
  })());
// Integration: rendered bus dot moves, fades on arrival, dashed without live.
T.setRT([], [[vehKey(synth), vehAt(sRows[2][0])]]);
render(synthOpt);
const busPct = parseFloat(el("stripBus").style.left);
check("(e) rendered bus dot moves off the bus-column center (10%) toward the board anchor",
  busPct > 10 && busPct < 40, el("stripBus").style.left);
T.setRT([], [[vehKey(dLeg), vehAt(dRows[dAi + 1][0])]]);
render(directOpt);
check("(e) rendered arrived dot carries the arrived class and opacity 0 (fade, not vanish)",
  el("stripBus").className.includes("arrived") && el("stripBus").style.opacity === "0",
  el("stripBus").className + " opacity=" + el("stripBus").style.opacity);
T.clearRT();
render(directOpt);
check("(e) rendered timetable dot is the dashed dot at the bus-column center (10%)",
  el("stripBus").className.includes("dashed") && el("stripBus").style.left === "10%",
  el("stripBus").className + " left=" + el("stripBus").style.left);

console.log(failures === 0 ? "ALL BOARDCLARITY CHECKS PASSED" : failures + " FAILURES");
process.exit(failures === 0 ? 0 : 1);
