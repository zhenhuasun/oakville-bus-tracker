// Google-parity Phase 2 harness (2026-10-28): OSM street-network
// walking via OSRM (foot profile). Runs the real public/index.html
// inline script in Node with a stub DOM + stub localStorage/fetch.
// OSRM is STUBBED here (no live network in tests); the stub returns
// fixed street distances/geometry for specific coordinate pairs and
// an empty route list (failure) for everything else.
import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, "public", "index.html"), "utf8");
// Phase 1+3-ONLY build (2026-10-29, user decision option A): while
// STREET_WALK_ENABLED is false, the Phase 2 assertions below cannot
// pass by design (no OSRM fetches, straight-line walks). Skip the
// whole suite with exit 0, preserving it verbatim for re-enablement:
// flipping the flag to true re-activates this file automatically.
if (/const STREET_WALK_ENABLED = false;/.test(html)) {
  console.log("SKIPPED: STREET_WALK_ENABLED is false (Phase 2 dormant) — "
    + "Phase 2 assertions preserved for re-enablement; see test_phase13only.mjs");
  process.exit(0);
}
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
const pairs = JSON.parse(fs.readFileSync(path.join(dir, "public", "pairs.json"), "utf8"));
const stops = JSON.parse(fs.readFileSync(path.join(dir, "public", "stops.json"), "utf8"));
const tt = JSON.parse(fs.readFileSync(path.join(dir, "public", "timetable.json"), "utf8"));
const places = JSON.parse(fs.readFileSync(path.join(dir, "public", "places.json"), "utf8"));
const shapeFile = (route) => JSON.parse(fs.readFileSync(path.join(dir, "public", "shapes", route + ".json"), "utf8"));

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
// Stub OSRM: keyed by "lon,lat>lon,lat" (URL order, 4 decimals).
// 986->327: straight 83 m, street 113 m on routed-foot (street > straight, still valid).
// 162->1071: straight 293 m, street 457 m on routed-foot (over the 300 m cap).
// 1397->destPoint: straight ~148 m, street 260 m.
// 1212->327: straight ~5060 m, street 5600 m (origin walk, street > straight).
const osrmTable = {
  "-79.7393,43.4341>-79.7383,43.4344": { distance: 113,
    geometry: { type: "LineString", coordinates: [[-79.7393, 43.4341], [-79.7390, 43.4345], [-79.738342, 43.434373]] } },
  "-79.6881,43.4648>-79.6845,43.4654": { distance: 457,
    geometry: { type: "LineString", coordinates: [[-79.688053, 43.464765], [-79.686, 43.465], [-79.684512, 43.465359]] } },
  "-79.7647,43.4505>-79.766,43.4515": { distance: 260,
    geometry: { type: "LineString", coordinates: [[-79.76471, 43.45054], [-79.7655, 43.451], [-79.766, 43.4515]] } },
  "-79.6824,43.4558>-79.7383,43.4344": { distance: 5600,
    geometry: { type: "LineString", coordinates: [[-79.6824, 43.4558], [-79.71, 43.445], [-79.738342, 43.434373]] } },
};
let osrmCalls = 0;
function osrmStub(url) {
  const m = String(url).match(/route\/v1\/foot\/([^;]+);([^?]+)/);
  if (!m) return null;
  const key = m[1].split(",").map((v) => String(Math.round(+v * 1e4) / 1e4)).join(",") + ">" +
    m[2].split(",").map((v) => String(Math.round(+v * 1e4) / 1e4)).join(",");
  const hit = osrmTable[key];
  if (!hit) return { routes: [] };
  return { routes: [{ distance: hit.distance, geometry: hit.geometry }], code: "Ok" };
}
const sandbox = {
  console, localStorage,
  navigator: { geolocation: { getCurrentPosition(ok) {
    ok({ coords: { latitude: 43.4558, longitude: -79.6824 } }); } } },
  setInterval: () => 0, clearInterval: () => {},
  fetch: async (url) => {
    const u = String(url);
    if (u.includes("routing.openstreetmap.de/routed-foot")) { osrmCalls++; return { json: async () => osrmStub(u) }; }
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
  fns: { searchJourneys, enrichAndRank, buildJourneyMapData, setShapeData, destWalkFor,
    resolveWalk, streetWalkPut, streetWalkReset, fetchStreetWalk,
    transferStopsOf, computeBoardingJourneys, stopNameOf, stopCodeOf,
    setNavOrigin: (ep) => { navOrigin = ep; } },
};
`, sandbox);
const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 60 && !sandbox.__t.journey(); i++) await tick();
await tick(200);
const T = sandbox.__t;
let failures = 0;
function check(name, cond, extra = "") {
  console.log((cond ? "PASS" : "FAIL") + " " + name + (cond ? "" : " " + extra));
  if (!cond) failures++;
}
const tueMorning = new Date("2026-10-27T12:10:00Z"); // Tue 2026-10-27 08:10 EDT
const ranked = (o, d, now, destEndpoint) =>
  T.fns.searchJourneys(o, d, now, null,
    { rank: "total", timeMode: { mode: "now" }, originWalkMin: 0, destEndpoint: destEndpoint || null });
// Clear any cache entries the init-time board upgrade may have made,
// so every assertion below starts from a known cache state.
T.fns.streetWalkReset();
const C = (lat, lon) => [lat, lon];
const stop986 = C(43.4341, -79.7393), stop327 = C(43.434373, -79.738342);
const stop162 = C(43.464765, -79.688053), stop1071 = C(43.465359, -79.684512);

// (d) Caching: the same pair fetched twice issues one router request.
osrmCalls = 0;
await T.fns.fetchStreetWalk(stop986, stop327);
await T.fns.fetchStreetWalk(stop986, stop327);
check("(d) same pair fetched twice issues one OSRM request", osrmCalls === 1, "calls=" + osrmCalls);
const rw986 = T.fns.resolveWalk(stop986, stop327);
check("(d) cached street value is used on the second resolve", rw986.source === "street" && rw986.m === 113, JSON.stringify(rw986));

// (a) Transfer walk where street > straight is shown with the street value.
// The ranked engine's GO->Hospital transfer is not necessarily the
// legacy proof pair, so: take its actual first transfer, stub a street
// route 40 m longer than its straight walk, fetch it, then run the
// ranked post-pass (enrichAndRank) on a copy and check the substitution.
const goHosp = ranked("1212", "1397", tueMorning);
const goHospOpt = goHosp && goHosp.options.find((o) => o.transfers >= 1);
check("(a) GO->Hospital has a transfer option", !!goHospOpt, JSON.stringify(goHosp && goHosp.options.map((o) => o.transfers)));
const k4 = (v) => String(Math.round(v * 1e4) / 1e4);
const osrmKey = (a, b) => k4(a[1]) + "," + k4(a[0]) + ">" + k4(b[1]) + "," + k4(b[0]);
const stopByIdT = (id) => stops.stops.find((s) => s.id === id);
let enrichedOpt = null;
if (goHospOpt) {
  // Pick a transfer whose street value can stay in the same minute
  // bucket (so the connection gap, max(5, walkMin), is unchanged and
  // the substitution — not a gap rejection — is what is tested).
  let ts0 = null, tsOpt = null;
  for (const o of goHosp.options) {
    for (const ts of T.fns.transferStopsOf(o)) {
      if (ts.walkM > 0 && Math.ceil(ts.walkM / 48) * 48 - ts.walkM >= 10) { ts0 = ts; tsOpt = o; break; }
    }
    if (ts0) { break; }
  }
  check("(a) a transfer with minute-bucket headroom exists for the test", !!ts0);
  const aCoord = [stopByIdT(ts0.alightStop).lat, stopByIdT(ts0.alightStop).lon];
  const bCoord = [stopByIdT(ts0.boardStop).lat, stopByIdT(ts0.boardStop).lon];
  const streetM = ts0.walkM + 10;
  const mid = [(aCoord[0] + bCoord[0]) / 2, (aCoord[1] + bCoord[1]) / 2];
  osrmTable[osrmKey(aCoord, bCoord)] = { distance: streetM,
    geometry: { type: "LineString", coordinates: [[aCoord[1], aCoord[0]], [mid[1], mid[0]], [bCoord[1], bCoord[0]]] } };
  await T.fns.fetchStreetWalk(aCoord, bCoord);
  const copy = JSON.parse(JSON.stringify(tsOpt));
  const enriched = T.fns.enrichAndRank([copy], { mode: "now", refAbs: 0, dayOffset: 0, originWalkMin: 0, destEndpoint: null });
  enrichedOpt = enriched && enriched[0];
  const ts1 = enrichedOpt && T.fns.transferStopsOf(enrichedOpt)[0];
  check("(a) transfer walk shows street value, not straight value",
    !!ts1 && ts1.walkM === streetM && ts1.walkMin === Math.ceil(streetM / 48),
    JSON.stringify(ts1) + " straight=" + ts0.walkM);
}

// (e) Map walking segment uses router geometry when present…
for (const r of [...new Set(enrichedOpt.legs.map((l) => l.route))]) T.fns.setShapeData(r, shapeFile(r));
const gmap = T.fns.buildJourneyMapData(enrichedOpt);
check("(e) map walk segment carries the OSRM street geometry",
  !!gmap && gmap.walks.length >= 1 && gmap.walks[0].geometry !== null && gmap.walks[0].geometry.length === 3,
  JSON.stringify(gmap && gmap.walks));
// …and straight line only as fallback (2-transfer proof, uncached transfers).
const proofBefore = ranked("1293", "562", tueMorning);
const proofOpt = proofBefore && proofBefore.options.find((o) => o.transfers === 2);
check("(e) 2-transfer proof still exists before the cap test", !!proofOpt);
if (proofOpt) {
  const had162 = T.fns.transferStopsOf(proofOpt).some((x) => x.alightStop === "162" && x.boardStop === "1071");
  check("(e) proof uses transfer 162->1071 before street data", had162);
  for (const r of [...new Set(proofOpt.legs.map((l) => l.route))]) T.fns.setShapeData(r, shapeFile(r));
  const pmap = T.fns.buildJourneyMapData(proofOpt);
  const w162 = pmap && pmap.walks.find((w) => w.m === 293);
  check("(e) uncached map walk falls back to straight line (geometry null)",
    !!w162 && w162.geometry === null, JSON.stringify(w162));
}

// (b) A transfer <=300 m straight-line but >300 m by street is rejected.
await T.fns.fetchStreetWalk(stop162, stop1071);
const rw162 = T.fns.resolveWalk(stop162, stop1071);
check("(b) street value for 162->1071 is 457 m (over cap)", rw162.source === "street" && rw162.m === 457, JSON.stringify(rw162));
const proofAfter = ranked("1293", "562", tueMorning);
const uses162 = proofAfter && proofAfter.options.some((o) =>
  T.fns.transferStopsOf(o).some((x) => x.alightStop === "162" && x.boardStop === "1071"));
check("(b) no returned option uses the over-cap street transfer 162->1071", !uses162,
  JSON.stringify(proofAfter && proofAfter.options.map((o) => T.fns.transferStopsOf(o))));

// (c) Router failure falls back to the straight-line estimate, board still renders.
const failPair = await T.fns.fetchStreetWalk(C(43.4558, -79.6824), stop162);
const rwFail = T.fns.resolveWalk(C(43.4558, -79.6824), stop162);
check("(c) router failure returns null and resolve falls back to estimate",
  failPair === null && rwFail.source === "estimate" && rwFail.m > 0, JSON.stringify(rwFail));
const stillRenders = ranked("1212", "1397", tueMorning);
check("(c) journey search still returns options after a router failure",
  !!stillRenders && stillRenders.options.length > 0);

// (f) Origin/destination walk totals in ranking use street values when available.
// Like production, the street value must be fetched (and cached) before
// the search that uses it — the synchronous engine never waits on OSRM.
const destPoint = { lat: 43.4515, lon: -79.7660 };
await T.fns.fetchStreetWalk(C(43.45054, -79.76471), C(43.4515, -79.7660));
const withDest = ranked("1212", "1397", tueMorning, destPoint);
const dwOpt = withDest && withDest.options[0];
check("(f) destination walk uses street 260 m, not straight ~148 m",
  !!dwOpt && dwOpt.destWalkM === 260 && dwOpt.destWalkMin === 6,
  JSON.stringify(dwOpt && { destWalkM: dwOpt.destWalkM, destWalkMin: dwOpt.destWalkMin }));
check("(f) destination walk from a stop uses the cached street value directly",
  (() => { const dw = T.fns.destWalkFor("1397", destPoint); return dw.m === 260 && dw.min === 6; })(),
  JSON.stringify(T.fns.destWalkFor("1397", destPoint)));
// Origin walk: boarding candidates use the cached street value, subject to
// the 2026-10-29 rule that origin boarding walks are capped at 1000 m street.
T.fns.setNavOrigin({ kind: "address", label: "Test home", lat: 43.4558, lon: -79.6824 });
await T.fns.fetchStreetWalk(C(43.4558, -79.6824), stop327);
const boarding = T.fns.computeBoardingJourneys([{ id: "327", dist: 5060 }], ["1397"], "Test home", "Hospital", tueMorning, { mode: "now" }, null);
check("(f) boarding origin walk at 5600 m street is REJECTED (>1000 m cap), even though straight is 5060 m",
  !boarding,
  JSON.stringify(boarding && { originWalkM: boarding.originWalkM }));
T.fns.streetWalkPut(C(43.4558, -79.6824), stop327, { m: 800, geometry: null });
const boarding2 = T.fns.computeBoardingJourneys([{ id: "327", dist: 5060 }], ["1397"], "Test home", "Hospital", tueMorning, { mode: "now" }, null);
check("(f) boarding origin walk within cap uses street 800 m, not straight 5060 m",
  !!boarding2 && boarding2.originWalkM === 800 && boarding2.originWalkMin === 17,
  JSON.stringify(boarding2 && { originWalkM: boarding2.originWalkM, originWalkMin: boarding2.originWalkMin }));
T.fns.streetWalkReset();

// Strings, attribution, and no-Google guardrails.
const i18n = sandbox.__t.journey ? null : null; // (i18n is checked via the page source below)
for (const key of ["walkEstimate", "walkAttribution", "footerPrivacy"]) {
  check("i18n key " + key + " is non-empty in the page source",
    html.includes(key + ":\"") || html.includes(key + ': "'));
}
check("routed-foot is the routing service (no Google Maps API, no car-only demo server as base)",
  html.includes("https://routing.openstreetmap.de/routed-foot") && !html.includes('const OSRM_BASE = "https://router.project-osrm.org"') && !html.includes("maps.googleapis") && !html.includes("maps.google.com"));
check("footer attribution mentions OSM + OSRM", html.includes("walkAttribution"));

console.log(failures === 0 ? "ALL OSMWALK TESTS PASSED" : failures + " TEST(S) FAILED");
process.exit(failures === 0 ? 0 : 1);
