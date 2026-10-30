// Stage 2 harness: runs the real public/index.html inline script in Node
// with a stub DOM + stub localStorage/fetch, then asserts the journey
// engine, expanded search, RT per-leg labels, and Stage 1 regressions.
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
    get() { return this._html; },
    set(v) { this._html = v; this.children = []; },
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
let geoMode = "ok";
const navigatorStub = { geolocation: { getCurrentPosition(ok, err) {
  if (geoMode === "ok") ok({ coords: { latitude: 43.4558, longitude: -79.6824 } });
  else err(new Error("denied"));
} } };
const sandbox = {
  console, localStorage, navigator: navigatorStub,
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
const hooks = `
globalThis.__t = {
  data: () => DATA, stopsData: () => STOPS, tt: () => TT, places: () => PLACES,
  journey: () => journeyState,
  trip: () => ({ lang, home, dest, direction, boardStopOverride }),
  saved: () => savedPlaces.map(p => ({ key: p.key, custom: p.custom })),
  setTrip: (h, d, dir) => { home = h; dest = d; direction = dir; boardStopOverride = null; journeyState = null; render(); },
  fns: { showOnboarding, pickLanguage, addSavedPlace, renameSaved, requestDelete, confirmDelete,
    setSavedAsDestination, setSavedAsOrigin, searchResultsFor, applyResultPrimary, applyResultSecondary,
    nearestStops, openSearch, openLocation, useLocation, render, renderSaved, renderBoard, currentPair,
    setJourney, swapJourney, searchJourneys, legLive, placeStopIds, stopNameOf,
    setNavEndpoint, endpointFromOriginTerm },
  setRT: (trips, vehicles) => { RT.trips = new Map(trips); RT.vehicles = new Map(vehicles); RT.ok = true; },
};
`;
vm.runInContext(script + hooks, sandbox);
const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 40 && (!sandbox.__t.data() || !sandbox.__t.tt()); i++) await tick();
const T = sandbox.__t;
const el = (id) => getEl(id);
let failures = 0;
function check(name, cond, extra = "") {
  console.log((cond ? "PASS" : "FAIL") + " " + name + (cond ? "" : " " + extra));
  if (!cond) failures++;
}
// Validate every option of a journey result against the Stage 2 rules.
function validateOptions(label, res) {
  if (!res) { check(label + " has options", false); return; }
  check(label + " returns <= 3 options", res.options.length >= 1 && res.options.length <= 3, "n=" + res.options.length);
  const sorted = [...res.options].sort((a, b) => a.transfers - b.transfers
    || a.legs[a.legs.length - 1].alightArr - b.legs[b.legs.length - 1].alightArr);
  check(label + " options sorted by transfers then arrival",
    JSON.stringify(res.options.map(o => o.transfers)) === JSON.stringify(sorted.map(o => o.transfers)));
  for (const opt of res.options) {
    check(label + " transfers <= 1", opt.transfers <= 1, "transfers=" + opt.transfers);
    if (opt.transfers === 1) {
      const gap = opt.legs[1].boardDep - opt.legs[0].alightArr;
      check(label + " transfer gap >= max(5, walkMin)", gap >= Math.max(5, opt.walkMin),
        `gap=${gap} walkMin=${opt.walkMin} legs=${opt.legs.map(l => l.route).join("+")}`);
      check(label + " walking transfer <= 300 m", opt.walkM <= 300, "walkM=" + opt.walkM);
      check(label + " walkMin matches 0.8 m/s", opt.walkMin === (opt.walkM === 0 ? 0 : Math.ceil(opt.walkM / 48)),
        `walkM=${opt.walkM} walkMin=${opt.walkMin}`);
      check(label + " transfer legs are different trips", opt.legs[0].tripIdx !== opt.legs[1].tripIdx);
    }
  }
}

// 0. Data sanity.
check("timetable meta package ends 20261031", tt.meta.package_end_date === "20261031");
check("timetable has 2779 trips", tt.meta.trips === 2779, "trips=" + tt.meta.trips);
check("places has 230 entries (153 + 74 schools + 1 specialty + 2 supermarket), 7 cross-boundary",
  places.places.length === 230 && places.places.filter(p => p.cross).length === 7,
  "places=" + places.places.length);
check("no place is South Common / Famijoy / United / Nations / Costco Oakville",
  !places.places.some(p => /south common|famijoy|united supermarket|nations|costco.*wyecroft/i.test(p.name + " " + p.address)));

// 1. Direct pair still returns direct first.
const ogIqbal = T.fns.searchJourneys("1212", "789", new Date());
check("Oakville GO -> Iqbal (789) direct first", ogIqbal && ogIqbal.options[0].transfers === 0,
  JSON.stringify(ogIqbal && ogIqbal.options[0].legs.map(l => l.route)));
validateOptions("Oakville GO -> Iqbal", ogIqbal);

// 2. Bronte GO -> Hospital direct still exists, with return.
const brHosp = T.fns.searchJourneys("645", "1397", new Date());
check("Bronte GO -> Hospital direct", brHosp && brHosp.options[0].transfers === 0);
const hospBr = T.fns.searchJourneys("1397", "645", new Date());
check("Hospital -> Bronte GO return direct", hospBr && hospBr.options[0].transfers === 0);

// 3. PROOF: a previously no-direct pair now returns a valid 1-transfer journey.
// Oakville GO -> Hospital (OTMH West Entrance 1397) had NO direct ride in
// the pair matrix; it must come back as R28 -> walk -> R3.
const ogHosp = T.fns.searchJourneys("1212", "1397", new Date());
check("Oakville GO -> Hospital returns a journey", !!ogHosp && ogHosp.options.length > 0);
const ogHospMorning = T.fns.searchJourneys("1212", "1397", new Date("2026-10-27T12:10:00Z"));
const proof = ogHospMorning && ogHospMorning.options.find(o => o.transfers === 1);
check("Oakville GO -> Hospital proof is 1 transfer", !!proof, JSON.stringify(ogHosp && ogHosp.options.map(o => o.transfers)));
if (proof) {
  check("proof legs are R28 then R3", proof.legs[0].route === "28" && proof.legs[1].route === "3",
    proof.legs.map(l => l.route).join("+"));
  check("proof transfer stop is 986, boarding 327", proof.transferStop === "986" && proof.transferBoardStop === "327",
    `transferStop=${proof.transferStop} board=${proof.transferBoardStop}`);
  check("proof walk is 83 m / 2 min", proof.walkM === 83 && proof.walkMin === 2,
    `walkM=${proof.walkM} walkMin=${proof.walkMin}`);
  const gap = proof.legs[1].boardDep - proof.legs[0].alightArr;
  check("proof transfer gap >= 5 min", gap >= 5, "gap=" + gap);
  console.log("PROOF JOURNEY: Oakville GO (1212) -> Hospital (1397): Route 28 to stop 986, walk "
    + proof.walkM + " m (" + proof.walkMin + " min) to stop 327, Route 3 to 1397; "
    + "depart " + proof.legs[0].boardDep + ", transfer gap " + gap + " min, arrive "
    + proof.legs[1].alightArr);
}
validateOptions("Oakville GO -> Hospital", ogHosp);

// 4. More transfer pairs validate (Uptown -> Oakville Place, Bronte -> OTCC).
validateOptions("Uptown Core -> Oakville Place", T.fns.searchJourneys("1293", "1050", new Date()));
validateOptions("Bronte GO -> OTCC", T.fns.searchJourneys("645", "689", new Date()));
validateOptions("Uptown Core -> Shoppers Cornwall", T.fns.searchJourneys("1293", "714", new Date()));

// 5. Expanded search: beyond the 10 prototypes, cross-boundary, by category.
const costco = T.fns.searchResultsFor("costco");
check("search 'costco' finds the Mississauga Costco place (cross-boundary)",
  costco.some(r => r.kind === "place" && r.place.name.includes("Costco") && r.place.cross === true),
  JSON.stringify(costco.map(r => r.label)));
const dynacare = T.fns.searchResultsFor("dynacare");
check("search 'dynacare' finds a lab place beyond the prototypes",
  dynacare.some(r => r.kind === "place" && r.place.cat === "hospitallab"));
const hospZh = T.fns.searchResultsFor("医院");
check("search '医院' finds the hospital place", hospZh.some(r => r.kind === "place" && r.place.cat === "hospitallab"));
const byCode = T.fns.searchResultsFor("3172");
check("search '3172' still finds stop 1212", byCode.some(r => r.kind === "stop" && r.stop.id === "1212"));
check("search nonsense returns empty", T.fns.searchResultsFor("zzzznope").length === 0);

// 6. Place result as destination opens a journey (hospital place from Oakville GO).
T.setTrip("oakville_go", "iqbal", "out");
// Homefix 2026-10-29: fields no longer derive from the legacy pair on
// load, so the journey's origin must be set explicitly (as a picker
// pick would), not assumed from setTrip.
T.fns.setNavEndpoint("origin", T.fns.endpointFromOriginTerm(pairs.origins.find(o => o.id === "oakville_go")));
const hospPlace = T.fns.searchResultsFor("Oakville Trafalgar Memorial Hospital")
  .find(r => r.kind === "place" && r.place.cat === "hospitallab");
check("hospital place found for journey test", !!hospPlace);
if (hospPlace) {
  T.fns.applyResultPrimary(hospPlace);
  const j = T.journey();
  check("place-as-destination opens a journey with options", !!j && !!j.options && j.options.length > 0,
    JSON.stringify(j && j.options && j.options.map(o => o.transfers)));
  check("journey destination is a hospital stop", j && (j.d === "1397" || j.d === "1577" || j.d === "1632"),
    "d=" + (j && j.d));
  // Return trip for the transfer journey: swap and re-search.
  const before = { o: j.o, d: j.d };
  T.fns.swapJourney();
  const back = T.journey();
  check("return trip swaps origin/destination", back.o === before.d && back.d === before.o,
    JSON.stringify({ o: back.o, d: back.d }));
  if (back.options) validateOptions("Hospital -> Oakville GO return", { options: back.options });
}

// 7. RT per-leg: a fake TripUpdate makes leg 1 live, leg 2 stays timetable.
const direct = T.fns.searchJourneys("1212", "789", new Date());
const leg1 = direct.options[0].legs[0];
const nowSec = Math.floor(Date.now() / 1000);
T.setRT([[leg1.original + "|" + leg1.route,
  { trip_id: leg1.original, route_id: leg1.route,
    stops: [{ stop_id: leg1.boardStop, time: nowSec + 600 }] }]], []);
const lv = T.fns.legLive(leg1, 0);
check("RT TripUpdate makes leg 1 live ~10 min away", lv.live === true && Math.abs(lv.minutesAway - 10) <= 2,
  JSON.stringify(lv));
T.setRT([], []);

// 8. Stage 1 regressions.
check("onboarding shows when no language stored", (() => { store.delete("obt_lang"); T.fns.showOnboarding(); return el("onboarding").hidden === false; })());
T.fns.pickLanguage("zh");
check("language stored after pick", localStorage.getItem("obt_lang") === "zh");
T.setTrip("bronte_go", "hospital", "out");
T.fns.showOnboarding(); T.fns.pickLanguage("ar");
check("trip preserved across language re-pick",
  T.trip().home === "bronte_go" && T.trip().dest === "hospital" && T.trip().direction === "out");
T.fns.pickLanguage("zh");
let added = 0;
for (const id of ["iqbal", "hospital", "oakville_place", "shoppers", "rbc", "otcc", "glen_abbey_cc", "uptown_dest"]) {
  const d = pairs.destinations.find((x) => x.id === id);
  if (T.fns.addSavedPlace({ key: "dest:" + id, custom: d.name, kind: "dest", destId: id, stopId: null, stopName: null, stopCode: null, address: d.address, enName: d.name })) added++;
}
check("8 saved places added", added === 8 && T.saved().length === 8);
check("9th saved place rejected", T.fns.addSavedPlace({ key: "dest:oakville_go_dest", custom: "U", kind: "dest", destId: "uptown_dest", stopId: null, stopName: null, stopCode: null, address: "", enName: "U" }) === false);
T.fns.renameSaved("dest:hospital", "我的医院");
check("rename round-trips", T.saved().find((p) => p.key === "dest:hospital").custom === "我的医院");
T.fns.requestDelete("dest:rbc"); T.fns.confirmDelete("dest:rbc");
check("delete confirmed removes place", !T.saved().some((p) => p.key === "dest:rbc"));
const near = T.fns.nearestStops(43.4558, -79.6824, 3);
check("nearest stop to Oakville GO coords is stop 1212 at 0 m", near[0].stop.id === "1212" && near[0].dist === 0);
geoMode = "ok";
T.setTrip("bronte_go", "hospital", "out");
T.fns.openLocation(); T.fns.useLocation();
await tick(200);
check("location does not auto-pick a stop", T.trip().home === "bronte_go");
check("P0b: location shows exactly 1 address row, not a stop list", el("locResults").children.length === 1, "rows=" + el("locResults").children.length);

// 9. Honesty: same stop is not a journey.
check("same stop returns no journey", T.fns.searchJourneys("1212", "1212", new Date()) === null);

console.log(failures === 0 ? "ALL STAGE 2 TESTS PASSED" : failures + " TEST(S) FAILED");
process.exit(failures === 0 ? 0 : 1);
