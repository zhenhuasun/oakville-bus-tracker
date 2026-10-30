// Stage 3 harness: runs the real public/index.html inline script in Node
// with a stub DOM + stub localStorage/fetch, then asserts the trip-only
// map (journey map, pair map, tap-to-pick, controls, RTL/large-type,
// lazy loading). No browser, no network, no deploy. Leaflet is absent
// in this harness by design: the map-data builders are pure functions
// over SHAPES_CACHE, and the Leaflet-missing path must degrade to an
// honest note, never a crash or a blank screen.
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
const shapeFile = (route) => JSON.parse(fs.readFileSync(path.join(dir, "..", "..", "public", "shapes", route + ".json"), "utf8"));

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
const navigatorStub = { geolocation: { getCurrentPosition(ok) {
  ok({ coords: { latitude: 43.4558, longitude: -79.6824 } });
} } };
const fetchedUrls = [];
const sandbox = {
  console, localStorage, navigator: navigatorStub,
  setInterval: () => 0, clearInterval: () => {},
  fetch: async (url) => {
    const u = String(url);
    fetchedUrls.push(u);
    if (u.includes("pairs.json")) return { json: async () => pairs };
    if (u.includes("stops.json")) return { json: async () => stops };
    if (u.includes("timetable.json")) return { json: async () => tt };
    if (u.includes("places.json")) return { json: async () => places };
    const m = u.match(/shapes\/([^/]+)\.json$/);
    if (m) { try { return { json: async () => shapeFile(decodeURIComponent(m[1])) }; } catch (e) { return { json: async () => ({}) }; } }
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
  i18n: () => I18N,
  trip: () => ({ lang, home, dest, direction, boardStopOverride }),
  saved: () => savedPlaces.map(p => ({ key: p.key, custom: p.custom, kind: p.kind, lat: p.lat, lon: p.lon, stopId: p.stopId })),
  setTrip: (h, d, dir) => { home = h; dest = d; direction = dir; boardStopOverride = null; journeyState = null; render(); },
  fns: { showOnboarding, pickLanguage, addSavedPlace, render, renderBoard, renderJourneyBoard, currentPair,
    setJourney, searchJourneys, legLive, nearestStops, stopNameOf, setSavedAsDestination, setSavedAsOrigin,
    setNavEndpoint, endpointFromOriginTerm,
    setShapeData, buildJourneyMapData, buildPairMapData, journeyMapAvailable,
    liveVehicleForLeg, pickMapPin, confirmPickedPin, openPickMap, openJourneyMap,
    openPairMap, mapControls, mapState, mapLocTap, requestMapLocation, currentPairNextDep },
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
const initUrls = [...fetchedUrls];

// 0. Lazy loading: init fetched no shapes and no Leaflet.
check("init fetched no shape files and no Leaflet",
  !initUrls.some(u => /shapes\//i.test(u) || /leaflet/i.test(u)), initUrls.join(", "));

// (a) Direct journey map data: verbatim shape, origin+destination only.
const direct = T.fns.searchJourneys("1212", "789", new Date("2026-10-27T12:10:00Z"));
const directOpt = direct && direct.options.find(o => o.transfers === 0);
check("direct journey option exists", !!directOpt);
check("map data is null before any shape file loads (no fake line)",
  T.fns.buildJourneyMapData(directOpt) === null);
for (const r of [...new Set(directOpt.legs.map(l => l.route))]) T.fns.setShapeData(r, shapeFile(r));
const dmap = T.fns.buildJourneyMapData(directOpt);
check("direct map data built after lazy shape load", !!dmap);
if (dmap) {
  const leg = directOpt.legs[0];
  const sf = shapeFile(leg.route);
  const sid = sf.trips[leg.service + "|" + leg.original];
  check("direct shape is verbatim from the route shape file (>2 points, exact match)",
    sid && dmap.legs[0].shape.length > 2 &&
    JSON.stringify(dmap.legs[0].shape) === JSON.stringify(sf.shapes[sid]),
    "shapeId=" + sid + " pts=" + dmap.legs[0].shape.length);
  check("direct map has origin + destination markers, no transfer marker",
    dmap.markers.some(m => m.kind === "origin") && dmap.markers.some(m => m.kind === "destination") &&
    !dmap.markers.some(m => m.kind === "transfer") && dmap.walk === null);
  check("direct map contains only its own legs' routes (no other routes' shapes)",
    dmap.legs.length === directOpt.legs.length &&
    dmap.legs.every(l => directOpt.legs.some(x => x.route === l.route)));
  // Raw GTFS cross-check when the on-disk static package is present.
  // Portable: OAKVILLE_GTFS_STATIC overrides the workspace-relative default.
  // Resolution: env dir first (if its shapes.txt exists), then the relative
  // path, else SKIP with a clear message (suite still passes — CI stays green).
  const gtfsCandidates = [];
  if (process.env.OAKVILLE_GTFS_STATIC) gtfsCandidates.push(path.join(process.env.OAKVILLE_GTFS_STATIC, "shapes.txt"));
  gtfsCandidates.push(path.join(dir, "..", "..", "..", "oakville-gtfs-check", "static", "shapes.txt"));
  const rawPath = gtfsCandidates.find((q) => fs.existsSync(q));
  if (rawPath) {
    const raw = {};
    for (const line of fs.readFileSync(rawPath, "utf8").split("\n").slice(1)) {
      if (!line.trim()) continue;
      const c = line.split(",");
      if (c[0] === sid) raw[Number(c[3])] = [Number(Number(c[1]).toFixed(5)), Number(Number(c[2]).toFixed(5))];
    }
    const rawPts = Object.keys(raw).sort((a, b) => a - b).map(k => raw[k]);
    check("shape file points match raw GTFS shapes.txt (rounded to 5dp, none dropped)",
      JSON.stringify(rawPts) === JSON.stringify(sf.shapes[sid]),
      "raw=" + rawPts.length + " file=" + sf.shapes[sid].length);
  } else {
    console.log("SKIP raw GTFS shapes cross-check (no shapes.txt at " + gtfsCandidates.join(" or ") + "; set OAKVILLE_GTFS_STATIC to a GTFS static dir to enable it — suite still passes)");
  }
}

// Pair map data: same verbatim rule for the pair board's ride.
const pairDep = pairs.pairs["oakville_go->iqbal"].departures[0];
T.fns.setShapeData(pairDep.route_id, shapeFile(pairDep.route_id));
const pmap = T.fns.buildPairMapData(pairDep);
check("pair map data built for Oakville GO -> Iqbal departure", !!pmap);
if (pmap) {
  const sf = shapeFile(pairDep.route_id);
  const sid = sf.trips[pairDep.service_id + "|" + pairDep.original_trip_id];
  check("pair shape is verbatim from the route shape file",
    sid && JSON.stringify(pmap.legs[0].shape) === JSON.stringify(sf.shapes[sid]));
  check("pair map has no walk and no transfer marker", pmap.walk === null && !pmap.markers.some(m => m.kind === "transfer"));
}
check("pair map data is null for an unknown route (button must hide, not fake)",
  T.fns.buildPairMapData({ route_id: "999", service_id: "x", original_trip_id: "y", origin_stop: "1212", destination_stop: "789" }) === null);

// (b) PROOF 1-transfer journey map: both legs, transfer marker, dashed walk <=300 m.
const morning = T.fns.searchJourneys("1212", "1397", new Date("2026-10-27T12:10:00Z"));
const proof = morning && morning.options.find(o => o.transfers === 1);
check("proof 1-transfer option exists (R28 then R3)", !!proof && proof.legs[0].route === "28" && proof.legs[1].route === "3");
for (const r of ["28", "3"]) T.fns.setShapeData(r, shapeFile(r));
const pmap2 = T.fns.buildJourneyMapData(proof);
check("proof map data built", !!pmap2);
if (pmap2) {
  check("proof map has both legs' shapes", pmap2.legs.length === 2 && pmap2.legs[0].route === "28" && pmap2.legs[1].route === "3" &&
    pmap2.legs.every(l => l.shape.length > 2));
  check("proof map has a transfer marker at stop 986",
    pmap2.markers.some(m => m.kind === "transfer" && m.stopId === "986"));
  check("proof map has a dashed walking segment of 83 m (<=300 m)",
    !!pmap2.walk && pmap2.walk.m === 83 && pmap2.walk.m <= 300,
    JSON.stringify(pmap2.walk));
  check("proof map walk connects transfer stop 986 to boarding stop 327",
    !!pmap2.walk && pmap2.walk.from[0] === stops.stops.find(s => s.id === "986").lat &&
    pmap2.walk.to[0] === stops.stops.find(s => s.id === "327").lat);
  check("proof journey is mappable by the no-fetch availability check", T.fns.journeyMapAvailable(proof) === true);
}

// (c) Live dots: exact match, _merged suffix-stripping join, never fabricated.
const pleg = proof.legs[0];
T.setRT([], [[pleg.original + "|" + pleg.route, { trip_id: pleg.original, route_id: pleg.route, latitude: 43.46, longitude: -79.69 }]]);
let live = T.fns.buildJourneyMapData(proof);
check("live dot appears at the exact RT vehicle position",
  live && live.liveDots.some(d => d.route === pleg.route && d.lat === 43.46 && d.lon === -79.69));
check("live leg is labelled live", live && live.legs[0].live === true && live.legs[0].label !== "Timetable");
T.setRT([], [[pleg.original + "_merged_2779999|" + pleg.route, { trip_id: pleg.original + "_merged_2779999", route_id: pleg.route, latitude: 43.47, longitude: -79.70 }]]);
live = T.fns.buildJourneyMapData(proof);
check("_merged-suffixed RT key still matches via suffix stripping",
  live && live.liveDots.some(d => d.route === pleg.route && d.lat === 43.47));
T.setRT([], [["999999|" + pleg.route, { trip_id: "999999", route_id: pleg.route, latitude: 43.0, longitude: -79.0 }]]);
live = T.fns.buildJourneyMapData(proof);
check("vehicle for a different trip never fabricates a dot on this leg",
  live && !live.liveDots.some(d => d.lat === 43.0));
T.setRT([], [[pleg.original + "|" + pleg.route, { trip_id: pleg.original, route_id: pleg.route }]]);
live = T.fns.buildJourneyMapData(proof);
check("vehicle without coordinates yields no dot and a Timetable label",
  live && live.liveDots.length === 0 && live.legs[0].live === false && live.legs[0].label === "Timetable");
T.setRT([], []);

// (d) Tap-to-pick: localStorage only, <=400 m or honest distance.
const beforeFetchCount = fetchedUrls.length;
const pin = T.fns.pickMapPin(43.4558, -79.6824);
check("tap at Oakville GO resolves to stop 1212 at 0 m (within 400 m)",
  pin && pin.nearestStopId === "1212" && pin.nearestDist === 0 && pin.within400 === true);
const savedOk = T.fns.confirmPickedPin();
const savedPin = T.saved().find(p => p.kind === "pin");
check("confirm stores the pin as a saved place (localStorage only)",
  savedOk === true && !!savedPin && savedPin.lat === 43.4558 && savedPin.lon === -79.6824,
  JSON.stringify(savedPin));
// Street audit 2026-10-29: the pin's "m away" note now uses the routed-foot
// street distance, so the pick flow may fetch the router — coordinates only,
// never a name, address, or pin id, and never this site's own API/Nominatim.
const pickFetches = fetchedUrls.slice(beforeFetchCount);
check("pick flow sends coordinates only to routed-foot (no name/address/pin/API)",
  pickFetches.every(u => u.includes("routing.openstreetmap.de/routed-foot") &&
    !u.includes("pin") && !u.includes("nominatim") && !u.includes("/api/")),
  JSON.stringify(pickFetches));
if (savedPin) {
  // A saved pin works as a journey destination like other saved places:
  // from Oakville GO (1212) toward the stops near the pin.
  T.setTrip("oakville_go", "iqbal", "out");
  // Homefix 2026-10-29: fields no longer derive from the legacy pair
  // when setTrip matches the init defaults, so set the origin
  // explicitly (as a picker pick would) before setting the destination.
  T.fns.setNavEndpoint("origin", T.fns.endpointFromOriginTerm(pairs.origins.find(o => o.id === "oakville_go")));
  const destOk = T.fns.setSavedAsDestination(savedPin);
  const nearIds = T.fns.nearestStops(43.4558, -79.6824, 10).filter(n => n.dist <= 300).map(n => n.stop.id);
  check("saved pin as destination resolves to a stop within 300 m of the pin",
    destOk === true && !!T.journey() && T.journey().o === "1212" && nearIds.includes(T.journey().d),
    JSON.stringify(T.journey() && { o: T.journey().o, d: T.journey().d }));
  const originOk = T.fns.setSavedAsOrigin(savedPin);
  // Boarding-stop fix (2026-10-28; radius widened 2026-10-29): a pin origin now tries stops
  // within 1000 m STREET distance and ranks by earliest arrival, so it may board at a
  // nearby stop (e.g. Cross Ave + Argus Rd, 124 m from Oakville GO)
  // instead of the nearest stop — with the nearest stop 1212 still
  // listed as an alternative, never hidden.
  const boardIds = T.fns.nearestStops(43.4558, -79.6824, 10).filter(n => n.dist <= 1000).map(n => n.stop.id);
  check("saved pin as origin opens a journey from a stop within 1000 m street, with nearest stop 1212 as an alternative",
    originOk === true && !!T.journey() && boardIds.includes(T.journey().o) &&
    !!T.journey().boarding && T.journey().boarding.candidates.some(c => c.stopId === "1212"),
    JSON.stringify(T.journey() && { o: T.journey().o, d: T.journey().d, boarding: T.journey().boarding }));
}
const far = T.fns.pickMapPin(43.35, -79.75);
check("far pin (lake) reports a true distance >400 m, not a fake stop",
  far && far.within400 === false && far.nearestDist > 400, JSON.stringify(far));
const farOk = T.fns.confirmPickedPin();
const farPin = T.saved().find(p => p.kind === "pin" && p.lat === 43.35);
check("far pin still stores its true coordinates (distance shown, not hidden)",
  farOk === true && !!farPin && farPin.lon === -79.75);

// (e) Exactly three journey-map controls; no browse/search layer.
check("journey map controls are exactly back/zoom/myloc",
  JSON.stringify(T.fns.mapControls()) === JSON.stringify(["back", "zoom", "myloc"]));
check("map screen HTML has no search box, layers menu, or POI layer",
  !/id="mapSearch"|id="mapLayers"|mapSearchInput/.test(html) &&
  ["headerBack", "mapZoomIn", "mapZoomOut", "mapMyLoc", "mapCanvas"].every(id => html.includes(`id="${id}"`)));
T.setTrip("oakville_go", "iqbal", "out");
// P0 (2026-10-28): the pair board is demoted — a prototype pair trip now
// renders as the single journey board, so its Map button opens the
// JOURNEY map (mode "journey"), not the old pair map. buildPairMapData
// itself is still tested above as the TT-unavailable fallback.
check("journey board for a prototype pair shows the Map button", el("mapBtn").hidden === false);
await el("mapBtn").onclick();
await tick();
check("prototype-pair Map button opens the journey map screen (data built, Leaflet fallback note)",
  el("mapScreen").hidden === false && T.fns.mapState().data !== null && T.fns.mapState().mode === "journey",
  JSON.stringify(T.fns.mapState().mode));
T.setTrip("oakville_go", "hospital", "out");
// P0: Oakville GO -> Hospital has no direct pair departure, but it DOES
// have a 1-transfer journey, so the single journey board shows the Map
// button (the old pair board hid it). One board, one set of results.
check("journey board for a transfer-only pair shows the Map button", el("mapBtn").hidden === false && !!T.journey() && !!T.journey().options,
  JSON.stringify(T.journey() && T.journey().options && T.journey().options.map(o => o.transfers)));
// Journey map open without Leaflet: honest note, screen shown, board intact.
T.fns.setJourney("1212", "1397", null, null);
const jBefore = T.journey();
check("journey board shows the Map button", el("mapBtn").hidden === false);
const opened = await T.fns.openJourneyMap();
check("journey map opens (data built) even without Leaflet", opened === true);
check("map screen shown with an honest unavailable note (never blank, never crash)",
  el("mapScreen").hidden === false && el("mapNote").textContent.length > 0, el("mapNote").textContent);
check("pick-mode Confirm button stays hidden on a journey map", el("mapConfirm").hidden === true);
check("board countdown element still exists after map open", !!el("countdown"));
check("map open did not change the journey (no auto-pick)", T.journey() && T.journey().o === jBefore.o && T.journey().d === jBefore.d);
// Map My location: explanation first, then a dot, never an auto-pick.
const firstTap = T.fns.mapLocTap();
check("first My-location tap only shows the explanation", firstTap === "explain");
const secondTap = T.fns.mapLocTap();
const mst = T.fns.mapState();
check("second My-location tap requests location and stores it browser-side",
  secondTap === "requested" && mst.userLocation && mst.userLocation.lat === 43.4558);
check("My location never auto-picked origin/destination",
  T.journey() && T.journey().o === jBefore.o && T.journey().d === jBefore.d);

// (f) Arabic RTL and large type.
T.fns.pickLanguage("ar");
check("Arabic sets document dir rtl (map screen inherits it)", el("html").dir === "rtl");
check("RTL mirroring CSS exists for map controls", html.includes('[dir="rtl"] .mapcontrols'));
check("map markers use large type (20px)", /\.map-marker \{[^}]*font-size:20px/.test(html));
check("board countdown size unchanged by Stage 3",
  html.includes(".countdown { font-size:clamp(72px,20vw,128px)"));
T.fns.pickLanguage("en");
check("map strings exist, non-empty, in all 5 languages",
  ["mapBtn", "mapBack", "mapMyLoc", "mapUnavailable", "mapShapeMissing", "mapLoading",
   "mapOrigin", "mapDest", "mapTransfer", "mapLiveBus", "pickOnMap", "pickTitle",
   "pickExplain", "pickConfirm", "pickNoPin", "pinnedPlace", "pinDist", "pickSaved", "pickFar"]
    .every(k => ["en", "fr", "zh", "ar", "hi"].every(l =>
      T.i18n()[l] && typeof T.i18n()[l][k] === "string" && T.i18n()[l][k].length > 0)),
  "missing=" + ["mapBtn", "mapBack", "mapMyLoc", "pickOnMap", "pickConfirm", "pinnedPlace"]
    .filter(k => !["en", "fr", "zh", "ar", "hi"].every(l => T.i18n()[l] && T.i18n()[l][k])).join(","));

console.log(failures === 0 ? "ALL STAGE 3 TESTS PASSED" : failures + " TEST(S) FAILED");
process.exit(failures === 0 ? 0 : 1);
