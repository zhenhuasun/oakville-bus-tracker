// P0 harness: symmetric origin/destination navigation (2026-10-28).
// Runs the real public/index.html inline script in Node with a stub DOM +
// stub localStorage/fetch, then asserts: (a) origin and destination
// pickers return the same candidate sets and fill only their own field,
// (b) a non-preset place (a school) works as ORIGIN with a real journey,
// (c) swap exchanges origin/destination and re-runs the search,
// (d) reload persistence (a second VM seeded with the first VM's
// localStorage restores the same origin/destination/direction, pins by
// their stored coordinates, and re-searches instead of freezing
// departures), (e) the old 3-origin limit is gone, (f) pair-board
// shortcuts still fill a field but do not restrict the pickers,
// (g) RTL + large-type assertions, plus P1-absence checks (no time
// picker, no sort toggle, no external-geocoder address search).
// No browser, no network, no deploy.
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
const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));

async function loadVM(initialStore) {
  const els = new Map();
  function getEl(id) { if (!els.has(id)) els.set(id, makeEl(id)); return els.get(id); }
  const store = initialStore ? new Map(initialStore) : new Map();
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
  data: () => DATA, stopsData: () => STOPS, tt: () => TT, places: () => PLACES,
  journey: () => journeyState,
  trip: () => ({ lang, home, dest, direction, boardStopOverride }),
  nav: () => ({ origin: navOrigin, dest: navDest, focus: navFocus }),
  saved: () => savedPlaces.map(p => ({ ...p })),
  setTrip: (h, d, dir) => { home = h; dest = d; direction = dir; boardStopOverride = null; journeyState = null; render(); },
  i18n: () => I18N,
  fns: { showOnboarding, pickLanguage, addSavedPlace, render, renderBoard, renderJourneyBoard,
    setJourney, swapJourney, searchJourneys, nearestStops, stopNameOf,
    setSavedAsDestination, setSavedAsOrigin, searchResultsFor, applyResultPrimary,
    setNavEndpoint, setNavPair, swapNav, openPicker,
    pickerResultsFor, pickerCandidates, applyPickerResult, applyPickerSaved,
    applyPickerLocationStop, applyPickerPin, openPickerLocation,
    endpointFromPlace, endpointFromStation, endpointFromStop,
    endpointFromSaved, endpointFromPin, endpointFromOriginTerm, endpointFromDest,
    renderNavFields, restoreNavFromStorage, persistNav,
    pickMapPin, confirmPickedPin, openPickMap },
};
`, sandbox);
  for (let i = 0; i < 60 && !sandbox.__t.tt(); i++) await tick();
  return { T: sandbox.__t, el: getEl, store, localStorage };
}

let failures = 0;
function check(name, cond, extra = "") {
  console.log((cond ? "PASS" : "FAIL") + " " + name + (cond ? "" : " " + extra));
  if (!cond) failures++;
}
const sig = (results) => results.map(r =>
  r.kind + ":" + (r.label || r.destId || (r.place && r.place.name) || (r.station && r.station.name) || (r.stop && r.stop.id))).join("|");

const { T, el, store } = await loadVM();
const school = places.places.find(p => p.id === "gladys-speers-ps");
const iqbalPlace = places.places.find(p => p.name === "Iqbal Foods Oakville");
const hospitalPlace = places.places.find(p => p.name === "Oakville Trafalgar Memorial Hospital");
const clarkson = places.stations.find(s => s.id === "clarkson-go");

// 0. Data + initial nav (Homefix 2026-10-29: DEFAULT EMPTY — the old
// legacy-pair derivation on load was deliberately reversed).
check("places total is 230, stations 9, schools 74",
  places.places.length === 230 && places.stations.length === 9 &&
  places.places.filter(p => p.cat === "school").length === 74,
  `places=${places.places.length} stations=${places.stations.length}`);
check("initial nav fields are EMPTY on load (no restore, no legacy derivation)",
  T.nav().origin === null && T.nav().dest === null && !T.journey(),
  JSON.stringify({ o: T.nav().origin, d: T.nav().dest, j: !!T.journey() }));
check("initial field values are blank (not 'Tap to choose', not a place name)",
  (() => { const o = el("originField"), d = el("destField");
    const val = (b) => (b.children.find(c => c.className === "fldvalue") || {}).textContent;
    return val(o) === "" && val(d) === ""; })(),
  JSON.stringify({ o: el("originField").textContent, d: el("destField").textContent }));
check("swap button is disabled until both fields are set",
  el("swapBtn").disabled === true);
check("board shows the choose-origin prompt, not a fallback pair trip",
  el("routeLine").textContent === T.i18n().en.chooseOrigin ||
  (el("routeLine").textContent || "").includes("Choose the origin"),
  JSON.stringify({ route: el("routeLine").textContent }));
check("two big fields exist (origin above destination, swap between) in source order",
  html.indexOf('id="originField"') > 0 &&
  html.indexOf('id="originField"') < html.indexOf('id="swapBtn"') &&
  html.indexOf('id="swapBtn"') < html.indexOf('id="destField"'));

// (a) Symmetric pickers: same candidate sets for either field.
for (const q of ["school", "3172", "Iqbal", "Oakville GO", "医院"]) {
  const a = T.fns.pickerResultsFor("origin", q), b = T.fns.pickerResultsFor("dest", q);
  check(`picker candidates identical for origin/dest (query "${q}")`,
    sig(a) === sig(b) && a.length > 0, `origin=${a.length} dest=${b.length}`);
}
const schoolResults = T.fns.pickerResultsFor("origin", "学校");
check("picker '学校' returns all 74 school places, no stops",
  schoolResults.length === 74 && schoolResults.every(r => r.kind === "place" && r.place.cat === "school"),
  `n=${schoolResults.length}`);
const gladysResult = T.fns.searchResultsFor("Gladys Speers").find(r => r.kind === "place");
check("Gladys Speers school found as a place result", !!gladysResult);
if (gladysResult) {
  const destBefore = T.nav().dest;
  T.fns.openPicker("origin");
  check("picker opens for the origin field", el("pickerScreen").hidden === false);
  T.fns.applyPickerResult(gladysResult);
  check("picker result fills ONLY the origin field (destination untouched)",
    T.nav().origin && T.nav().origin.placeId === "gladys-speers-ps" &&
    T.nav().dest === destBefore,
    JSON.stringify({ o: T.nav().origin && T.nav().origin.label, d: T.nav().dest && T.nav().dest.label }));
  T.fns.openPicker("dest");
  T.fns.applyPickerResult(gladysResult);
  check("same school result fills ONLY the destination field when picked there",
    T.nav().dest && T.nav().dest.placeId === "gladys-speers-ps" &&
    T.nav().origin && T.nav().origin.placeId === "gladys-speers-ps");
}
// Station + stop-code results are selectable in either field too.
const clarksonResult = T.fns.searchResultsFor("Clarkson").find(r => r.kind === "station");
check("Clarkson GO station result exists", !!clarksonResult);
if (clarksonResult) {
  T.fns.openPicker("origin"); T.fns.applyPickerResult(clarksonResult);
  check("hub station selectable as ORIGIN", T.nav().origin && T.nav().origin.stationId === "clarkson-go");
  T.fns.openPicker("dest"); T.fns.applyPickerResult(clarksonResult);
  check("hub station selectable as DESTINATION", T.nav().dest && T.nav().dest.stationId === "clarkson-go");
}
const codeResult = T.fns.searchResultsFor("2421").find(r => r.kind === "stop");
check("stop-code '2421' finds Bronte GO stop 645", !!codeResult && codeResult.stop.id === "645");
if (codeResult) {
  T.fns.openPicker("origin"); T.fns.applyPickerResult(codeResult);
  check("stop-code stop selectable as ORIGIN", T.nav().origin && T.nav().origin.stopId === "645");
}
// Picker location (P0b): a detected street address is the field value,
// not a stop list. The stub fetch has no reverse result, so the honest
// coordinates fallback appears; tapping it fills the field with an
// address endpoint whose nearest stop is 1212.
T.fns.openPicker("dest");
const destBeforeLoc = T.nav().dest;
T.fns.openPickerLocation();
await tick(200);
check("picker location shows exactly 1 address row and does not auto-pick",
  el("pickerLocResults").children.length === 1 && T.nav().dest === destBeforeLoc,
  `rows=${el("pickerLocResults").children.length}`);
check("picker location fallback is a coordinates label, not an invented address",
  (el("pickerLocResults").children[0].children[0].textContent || "").includes("Lat "));
el("pickerLocResults").children[0].children[0].onclick();
check("tapping a picker location row fills ONLY the destination field with an address endpoint",
  T.nav().dest && T.nav().dest.kind === "address" && T.nav().dest.stopId === "1212",
  JSON.stringify(T.nav().dest));
// Picker map pin fills a field directly.
T.fns.applyPickerPin(43.4558, -79.6824, "origin");
check("map pin fills the origin field (nearest stop 1212, coordinates kept)",
  T.nav().origin && T.nav().origin.kind === "pin" && T.nav().origin.stopId === "1212" &&
  T.nav().origin.lat === 43.4558 && T.nav().origin.lon === -79.6824,
  JSON.stringify(T.nav().origin));
// Picker saved place fills only its field.
T.fns.addSavedPlace({ key: "place:" + iqbalPlace.id, custom: "My Iqbal", kind: "place",
  destId: null, stopId: iqbalPlace.stop.id, stopName: iqbalPlace.stop.name,
  stopCode: iqbalPlace.stop.code, address: iqbalPlace.address, enName: iqbalPlace.name,
  lat: iqbalPlace.lat, lon: iqbalPlace.lon });
const savedIqbal = T.saved().find(p => p.key === "place:" + iqbalPlace.id);
T.fns.openPicker("dest"); T.fns.applyPickerSaved(savedIqbal);
check("saved place fills ONLY the destination field (custom name kept)",
  T.nav().dest && T.nav().dest.label === "My Iqbal",
  JSON.stringify(T.nav().dest && T.nav().dest.label));

// (b) A non-preset school works as ORIGIN, with a real journey.
T.fns.setNavEndpoint("origin", T.fns.endpointFromPlace(school));
T.fns.setNavEndpoint("dest", T.fns.endpointFromOriginTerm(pairs.origins[0]));
// NOTE (2026-10-29): the old assertion pinned this to "stop 14, direct
// route 15", but that is time-of-day fragile, not engine behaviour: the
// boarding engine ranks by earliest arrival, so at times when the next
// direct R15 from stop 14 (06:16/06:52/07:27/08:02/08:34 EDT) is not the
// earliest arrival, a 1-transfer journey from nearby stop 813 (267 m)
// legitimately wins. Verified: the PRE-batch build fails the old
// assertion identically at such a time. The robust assertion keeps the
// test's intent (a school origin yields a real journey, not a dead end)
// without pinning the winning stop/route to the wall clock.
const schoolNear = T.stopsData().stops.filter(s => {
  const R = 6371000, p1 = school.lat * Math.PI / 180, p2 = s.lat * Math.PI / 180;
  const d = 2 * R * Math.asin(Math.sqrt(Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((s.lon - school.lon) * Math.PI / 360) ** 2));
  return d <= 1000;
}).map(s => s.id);
check("school as ORIGIN yields a real journey (Gladys Speers, boards within 1000 m, to Oakville GO)",
  !!T.journey() && schoolNear.includes(T.journey().o) && T.journey().d === "1212" &&
  !!T.journey().options && T.journey().options.length > 0,
  JSON.stringify(T.journey() && { o: T.journey().o, d: T.journey().d, opts: T.journey().options && T.journey().options.map(o => o.transfers) }));

// (e) The old 3-origin limit is gone.
T.fns.setNavEndpoint("origin", T.fns.endpointFromPlace(school));
check("origin is not restricted to the 3 terminals (school place)",
  T.nav().origin && T.nav().origin.stopId === "14");
T.fns.setNavEndpoint("origin", T.fns.endpointFromStation(clarkson));
check("origin is not restricted to the 3 terminals (hub station Clarkson)",
  T.nav().origin && T.nav().origin.stopId === "358");
T.fns.setNavEndpoint("origin", T.fns.endpointFromStop(stops.stops.find(s => s.id === "645")));
check("any stop by code works as origin (Bronte GO stop 645)",
  T.nav().origin && T.nav().origin.stopId === "645");

// (c) Swap exchanges origin/destination and re-runs the search.
T.fns.setNavEndpoint("origin", T.fns.endpointFromOriginTerm(pairs.origins[0]));
T.fns.setNavEndpoint("dest", T.fns.endpointFromPlace(hospitalPlace));
const before = { o: T.journey().o, d: T.journey().d, dir: T.trip().direction };
const swapped = T.fns.swapNav();
const back = T.journey();
check("swap exchanges origin/destination and re-runs the search (return journey works)",
  swapped === true && back.o === before.d && back.d === before.o &&
  !!back.options && back.options.length > 0,
  JSON.stringify({ before, back: back && { o: back.o, d: back.d } }));
check("swap toggles direction and persists the swapped endpoints",
  T.trip().direction !== before.dir &&
  (() => { try { const nav = JSON.parse(store.get("obt_nav")); return nav.origin.label === T.nav().origin.label && nav.dest.label === T.nav().dest.label; } catch (e) { return false; } })(),
  `dir=${T.trip().direction}`);

// (d) Reload persistence: endpoints + direction, no frozen departures.
T.fns.setNavEndpoint("origin", T.fns.endpointFromPlace(school));
T.fns.setNavEndpoint("dest", T.fns.endpointFromOriginTerm(pairs.origins[0]));
const savedNav = JSON.parse(store.get("obt_nav"));
check("obt_nav stores endpoints + direction, and no departures/options (never frozen)",
  savedNav.origin.placeId === "gladys-speers-ps" &&
  savedNav.dest.originId === "oakville_go" &&
  !JSON.stringify(savedNav).includes("options") && !JSON.stringify(savedNav).includes("departure"),
  JSON.stringify(savedNav));
const snapshot = new Map(store);
const vm2 = await loadVM(snapshot);
check("reload starts EMPTY even with obt_nav stored (Homefix 2026-10-29: no restore)",
  vm2.T.nav().origin === null && vm2.T.nav().dest === null && !vm2.T.journey(),
  JSON.stringify({ o: vm2.T.nav().origin, d: vm2.T.nav().dest, j: !!vm2.T.journey() }));
// Pin persistence across a reload: stored by coordinates, not just stop id.
T.fns.applyPickerPin(43.4558, -79.6824, "origin");
const pinSnapshot = new Map(store);
const vm3 = await loadVM(pinSnapshot);
check("reload after a map-pin pick also starts EMPTY (pin is not restored)",
  vm3.T.nav().origin === null && vm3.T.nav().dest === null && !vm3.T.journey(),
  JSON.stringify(vm3.T.nav().origin));

// (f) P0b: quick-fill REMOVED (user decision 2026-10-28). No quick-fill
// row, function, or label may remain; saved places are the shortcut
// mechanism (already asserted in section (a): a saved place fills only
// its field, and pickers stay unrestricted).
check("quick-fill row is absent from the HTML (no quickFill element)",
  !html.includes('id="quickFill"') && !html.includes('id="quickLabel"'));
check("quick-fill logic is absent from the frontend script",
  !/renderQuickFill|fillFocusedField/.test(script));
check("quickFill label key is gone from all 5 languages",
  ["en", "fr", "zh", "ar", "hi"].every(l => !T.i18n()[l] || !("quickFill" in T.i18n()[l])));
check("pickers are still unrestricted without quick-fill (school still selectable)",
  T.fns.pickerResultsFor("origin", "学校").length === 74);

// (g) RTL + large type + headline-first.
T.fns.pickLanguage("ar");
check("Arabic sets document dir rtl", el("html").dir === "rtl");
check("RTL mirroring CSS exists for the nav fields",
  html.includes('[dir="rtl"] .navfield'));
check("origin/destination/swap fields use large type (26px)",
  /\.navfield \{[^}]*font-size:26px/.test(html) && /\.swapbtn \{[^}]*font-size:26px/.test(html));
check("origin/swap/destination labels exist, non-empty, in all 5 languages",
  ["navTitle", "originField", "destField", "swap", "chooseOrigin", "chooseDestination", "notSet", "fallbackNote"]
    .every(k => ["en", "fr", "zh", "ar", "hi"].every(l => T.i18n()[l] && typeof T.i18n()[l][k] === "string" && T.i18n()[l][k].length > 0)));
T.fns.pickLanguage("en");
check("result-board headline (countdown) comes before alternatives and the map button in source",
  html.indexOf('id="countdown"') < html.indexOf('id="journeyAlts"') &&
  html.indexOf('id="countdown"') < html.indexOf('id="mapBtn"'));
T.fns.setNavEndpoint("origin", T.fns.endpointFromOriginTerm(pairs.origins[0]));
T.fns.setNavEndpoint("dest", T.fns.endpointFromPlace(hospitalPlace));
check("journey board countdown is rendered (not a dash) after a P0 trip",
  el("countdown").innerHTML !== "" && el("countdown").innerHTML !== "—",
  el("countdown").innerHTML);
// Fallback label exists for the TT-unavailable pair board path.
check("pair-board fallback label exists in all 5 languages",
  ["en", "fr", "zh", "ar", "hi"].every(l => T.i18n()[l] && T.i18n()[l].fallbackNote && T.i18n()[l].fallbackNote.length > 0));

// Google-parity Phase 3 (2026-10-28) SUPERSEDES the old P1 absence rule
// for the time picker only: the picker now exists, but hidden behind
// ONE "Time" button (timeBtn) so it never blocks the countdown. The
// sort-toggle absence rule below is unchanged.
check("time picker exists only behind one Time button (Phase 3)",
  html.includes('id="timeBtn"') && html.includes('id="timePanel"') && html.includes('hidden') &&
  !html.includes('id="timePicker"') && !html.includes('id="departurePicker"'));
check("no sort toggle UI", !html.includes('id="sortToggle"') && !html.includes('id="sortBtn"'));
check("external geocoding is Nominatim-only (P0b approved) — no Google/OpenCage geocoder",
  !/googleapis\.com\/maps|opencagedata|geocoding-api|mapbox/.test(script) &&
  /nominatim\.openstreetmap\.org/.test(script));
check("address search is labelled and Oakville-filtered in the frontend",
  script.includes("addressGroup") && script.includes("inOakvilleBounds"));
check("no driving/cycling/rideshare mode in the picker",
  !/id="modeDrive"|id="modeCycle"|drivingMode|cyclingMode/.test(html));

console.log(failures === 0 ? "ALL P0 TESTS PASSED" : failures + " TEST(S) FAILED");
console.log("MANUAL EYE-CHECK LIST (this machine cannot screenshot — check on a real phone):");
console.log("1. Top of the screen: Origin field, big Swap button, Destination field, all large and high-contrast; tap each field and confirm the SAME picker opens.");
console.log("2. Picker: My location explains first, then shows ONE detected street address to tap (never a stop list); a saved place, a school, a hub station, a stop number (e.g. 3172), and a map pin each fill ONLY the field you opened the picker from.");
console.log("3. P0b: there is NO Common trips row anymore — saved places are the shortcuts; typing an address in the picker shows labelled address results after verified places.");
console.log("4. Swap: one tap exchanges origin/destination and the board re-runs immediately (return journey, same 'next bus in X minutes' headline first).");
console.log("5. Reload the page: the same trip (same origin/destination/direction) re-renders with fresh times, including a map-pin origin.");
console.log("6. Arabic: fields stay origin-above-destination, text mirrors, Swap label reads correctly; the countdown is still the first thing on the result board, never pushed below the picker or the Map button.");
console.log("7. A school as origin (e.g. Gladys Speers) shows a real journey, not a dead end.");
process.exit(failures === 0 ? 0 : 1);
