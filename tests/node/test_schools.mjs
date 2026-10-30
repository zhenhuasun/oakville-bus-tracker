// School harness: runs the real public/index.html inline script in Node
// with a stub DOM + stub localStorage/fetch, then asserts the geocoded
// school index. No browser, no network, no deploy.
import fs from "node:fs";
import geo from "../../data/generated/schools-geocoded.json" with { type: "json" };
import pending from "../../data/schools-pending-decision.json" with { type: "json" };
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
    setJourney, swapJourney, searchJourneys, legLive, placeStopIds, stopNameOf, streetWalkPut, stopById },
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

// School geocoding checks (2026-10-28 Nominatim pass), updated for the
// user decision 2026-10-28: ALL 74 schools included, the 7 >400 m ones
// with an explicit walking-distance label (longWalk + walkFromStop_m).
const P = places.places;
const schools = P.filter(p => p.cat === "school");
check("places total is 230", P.length === 230, "n=" + P.length);
check("school places = 74", schools.length === 74, "n=" + schools.length);
check("school counts by board: HDSB 35, HCDSB 20, Private 14, Viamonde 3, MonAvenir 2",
  schools.filter(p => p.board === "HDSB").length === 35 &&
  schools.filter(p => p.board === "HCDSB").length === 20 &&
  schools.filter(p => p.board === "Private").length === 14 &&
  schools.filter(p => p.board === "Viamonde").length === 3 &&
  schools.filter(p => p.board === "MonAvenir").length === 2);
// STREET RULE (user decision 2026-10-29): distances below are the
// routed-foot street distances (was straight-line: 555/530/703/402/
// 446/1087/1117). Stops and codes are unchanged.
const LONGWALK = [
  ["Harvest Oak Public School", 741, "393", "3424"],
  ["Joshua Creek Public School", 704, "710", "3043"],
  ["New Central Public School", 1003, "1006", "2285"],
  ["Pilgrim Wood Public School", 498, "652", "2726"],
  ["St. Vincent Catholic Elementary School", 560, "662", "2607"],
  ["Dearcroft Montessori School", 1275, "1028", "2605"],
  ["Fern Hill School, Oakville Campus", 1225, "468", "2212"],
];
check("exactly 7 long-walk schools, each with its true stop and exact distance",
  schools.filter(p => p.longWalk).length === 7 &&
  LONGWALK.every(([name, d, id, code]) => {
    const p = schools.find(x => x.name === name);
    return p && p.longWalk && p.walkFromStop_m === d && p.stop.distance_m === d &&
      p.stop.id === id && p.stop.code === code;
  }),
  schools.filter(p => p.longWalk).map(p => p.name + ":" + p.walkFromStop_m).join(", "));
// STREET RULE (user decision 2026-10-29): non-longWalk schools over
// 400 m street are KEPT with the distance in their note (see
// test_streetrule.mjs), not dropped and not given a fake closer stop.
check("every non-long-walk school place has a stop <= 400 m street, or its street distance in its note",
  schools.filter(p => !p.longWalk).every(p => p.stop.distance_m <= 400 ||
    (p.note || "").includes(`Street walk ${p.stop.distance_m} m from nearest stop`)),
  schools.filter(p => !p.longWalk && p.stop.distance_m > 400 &&
    !(p.note || "").includes(`Street walk ${p.stop.distance_m} m from nearest stop`)).map(p => p.name).join(", "));
check("no school place remains in meta.excluded",
  !places.meta.excluded.some(e => /school nearest stop|Gladys Speers/.test(e.reason || "") || e.name === "Gladys Speers Public School"));
check("every school place stop id/code/name matches stops.json",
  schools.every(p => {
    const ref = stops.stops.find(x => x.id === p.stop.id);
    return ref && ref.code === p.stop.code && ref.name === p.stop.name;
  }));
check("every school place traces to a verified Nominatim entry at the same coordinates",
  schools.every(p => {
    const g = geo.find(x => x.id === p.id);
    return g && g.status === "verified" && g.lat === p.lat && g.lon === p.lon;
  }));
check("no coordinate was guessed: geocoded file has 74 verified, 0 unresolved",
  geo.length === 74 && geo.every(g => g.status === "verified"));
check("no school place is a duplicate id or name",
  new Set(schools.map(p => p.id)).size === schools.length &&
  new Set(schools.map(p => p.name)).size === schools.length);
check("Gladys Speers is the real geocoded entry (2150 Samway Rd, stop 2619, 309 m street; was 264 m straight)",
  (() => { const g = schools.find(p => p.id === "gladys-speers-ps");
    return g && g.address === "2150 Samway Rd, Oakville, ON L6L 2P6" && g.stop.code === "2619" && g.stop.distance_m === 309; })());
check("pending file: over_400m empty; the 7 are recorded as included with a walking label and present in places.json",
  pending.over_400m.length === 0 &&
  pending.included_with_walking_label.length === 7 &&
  pending.included_with_walking_label.every(r => schools.some(p => p.id === r.id)));
check("no unresolved schools", pending.unresolved.length === 0);
check("407 hub stations unchanged (1665/2129 north, 1575/2206 west)",
  places.stations.length === 9 &&
  places.stations.some(s => s.stop.id === "1665") && places.stations.some(s => s.stop.id === "1575"));
check("Stage 2.1 category counts unchanged apart from School and specialtyasian (+Monastery Bakery 2026-10-29, +2 supermarket 2026-10-29)",
  P.filter(p => p.cat === "supermarket").length === 26 &&
  P.filter(p => p.cat === "specialtyasian").length === 8 &&
  P.filter(p => p.cat === "shoppingcentre").length === 13 &&
  P.filter(p => p.cat === "communityCentre").length === 7 &&
  P.filter(p => p.cat === "library").length === 7 &&
  P.filter(p => p.cat === "park").length === 7 &&
  P.filter(p => p.cat === "hospitallab").length === 9 &&
  P.filter(p => p.cat === "bank").length === 21 &&
  P.filter(p => p.cat === "religious").length === 24 &&
  P.filter(p => p.cat === "bigbox").length === 18 &&
  P.filter(p => p.cat === "pharmacy").length === 16);
// STREET RULE: seed the routed-foot cache for the 7 longWalk schools,
// exactly as the real browser's upgradeSearchWalks does after fetching
// the street value. Without a cache entry, streetWalkForPlace returns
// the labelled straight-line estimate — which is why the label check
// below asserts the STREET value only after seeding.
for (const [name, d] of LONGWALK) {
  const pl = places.places.find(x => x.name === name);
  const st = stops.stops.find(x => x.id === pl.stop.id);
  T.fns.streetWalkPut([st.lat, st.lon], [pl.lat, pl.lon], { m: d, geometry: null });
}
const sEn = T.fns.searchResultsFor("school");
check("search 'school' returns all 74 school places, no stops",
  sEn.length === 74 && sEn.every(r => r.kind === "place" && r.place.cat === "school"),
  "n=" + sEn.length);
check("long-walk schools show their walking-distance label in search results",
  LONGWALK.every(([name, d]) => {
    const r = sEn.find(x => x.place && x.place.name === name);
    return r && r.sub.includes("Walk " + d + " m from the nearest stop");
  }));
const sZh = T.fns.searchResultsFor("学校");
check("search '学校' returns only school places, no stops",
  sZh.length === 74 && sZh.every(r => r.kind === "place" && r.place.cat === "school"),
  "n=" + sZh.length);
const sFr = T.fns.searchResultsFor("école");
check("search 'école' returns only school places, no stops",
  sFr.length === 74 && sFr.every(r => r.kind === "place" && r.place.cat === "school"),
  "n=" + sFr.length);
check("search 'millbank' still returns no stops (Bank/School rule intact)",
  !T.fns.searchResultsFor("millbank").some(r => r.kind === "stop"));
check("a school journey works: Oakville GO -> Gladys Speers stop 2619 has options",
  (() => { const res = T.fns.searchJourneys("1212", "14", new Date("2026-10-27T12:10:00Z"));
    return res && res.options && res.options.length >= 1; })());

console.log(failures === 0 ? "ALL SCHOOL CHECKS PASSED" : failures + " FAILURES");
process.exit(failures === 0 ? 0 : 1);
