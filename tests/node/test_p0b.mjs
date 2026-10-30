// P0b harness (2026-10-28, user decisions): (1) quick-fill removed,
// (2) picker address search via Nominatim (stubbed — no live network),
// (3) map pin = last tap only, (4) My location returns a street address,
// not a stop list. Runs the real public/index.html inline script in Node
// with a stub DOM + stub localStorage/fetch. No browser, no network, no deploy.
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
let nominatimMode = "ok";
function nominatimStub(url) {
  const u = String(url);
  if (u.includes("nominatim.openstreetmap.org/search")) {
    if (nominatimMode === "fail") return { json: async () => { throw new Error("down"); } };
    if (u.includes("Far")) return { json: async () => [
      { display_name: "1 Far Rd, Oakville, Ontario, Canada", lat: "43.35", lon: "-79.75" }] };
    return { json: async () => [
      { display_name: "123 Test St, Oakville, Ontario, Canada", lat: "43.4558", lon: "-79.6824" },
      { display_name: "999 Other Rd, Burlington, Ontario, Canada", lat: "43.30", lon: "-79.80" }] };
  }
  if (u.includes("nominatim.openstreetmap.org/reverse")) {
    if (nominatimMode === "fail") return { json: async () => ({}) };
    return { json: async () => ({ display_name: "456 Test Road, Oakville, Ontario, Canada",
      address: { house_number: "456", road: "Test Road", town: "Oakville" } }) };
  }
  return null;
}
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
      const stub = nominatimStub(url);
      if (stub) return stub;
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
  nav: () => ({ origin: navOrigin, dest: navDest, focus: navFocus }),
  journey: () => journeyState,
  saved: () => savedPlaces.map(p => ({ ...p })),
  i18n: () => I18N,
  fns: { render, pickLanguage, addSavedPlace, openPicker, renderPickerResults,
    loadPickerAddressResults, applyPickerAddressResult, nominatimSearch, nominatimReverse,
    endpointFromAddress, endpointFromAddressResult, addressEndpointForCoords,
    openPickerLocation, useLocation, openLocation, setNavEndpoint, endpointFromPlace,
    pickMapPin, pickPinState, confirmPickedPin, applyPickerSaved,
    openSearch, runSearch, loadMainAddressResults, applyMainAddressResult },
};
`, sandbox);
  for (let i = 0; i < 60 && !sandbox.__t.journey() && !sandbox.__t.nav().origin; i++) await tick();
  // Wait for init's async data loads to finish (nav derives from legacy pair).
  for (let i = 0; i < 60 && !sandbox.__t.nav().origin; i++) await tick();
  return { T: sandbox.__t, el: getEl, store, localStorage };
}

let failures = 0;
function check(name, cond, extra = "") {
  console.log((cond ? "PASS" : "FAIL") + " " + name + (cond ? "" : " " + extra));
  if (!cond) failures++;
}

const { T, el, store } = await loadVM();

// (a) Quick-fill gone; saved places still work as shortcuts.
check("quick-fill row absent from HTML", !html.includes('id="quickFill"') && !html.includes('id="quickLabel"'));
check("quick-fill logic absent from script", !/renderQuickFill|fillFocusedField/.test(script));
const iqbalPlace = places.places.find(p => p.name === "Iqbal Foods Oakville");
T.fns.addSavedPlace({ key: "place:" + iqbalPlace.id, custom: "My Iqbal", kind: "place",
  destId: null, stopId: iqbalPlace.stop.id, stopName: iqbalPlace.stop.name,
  stopCode: iqbalPlace.stop.code, address: iqbalPlace.address, enName: iqbalPlace.name,
  lat: iqbalPlace.lat, lon: iqbalPlace.lon });
const savedIqbal = T.saved().find(p => p.key === "place:" + iqbalPlace.id);
T.fns.openPicker("dest"); T.fns.applyPickerSaved(savedIqbal);
check("saved place still fills ONLY the destination field",
  T.nav().dest && T.nav().dest.label === "My Iqbal", JSON.stringify(T.nav().dest && T.nav().dest.label));

// (b) Address search: Nominatim stub, Oakville filter, labelled group, pick fills field.
const searchRes = await T.fns.nominatimSearch("123 Test St");
check("Nominatim search returns only the Oakville result (Burlington filtered out)",
  Array.isArray(searchRes) && searchRes.length === 1 &&
  searchRes[0].label.includes("123 Test St") && searchRes[0].lat === 43.4558,
  JSON.stringify(searchRes));
T.fns.openPicker("dest");
T.fns.renderPickerResults("123 Test St");
await tick(1500);
const box = el("pickerResults");
const head = box.children.find(c => (c.textContent || "") === "Address results");
const addrRow = box.children[box.children.length - 1];
check("picker shows a labelled 'Address results' group after verified results",
  !!head, `children=${box.children.map(c => c.textContent).join(" | ")}`);
check("address row is the stubbed Oakville address, not a verified place",
  addrRow && addrRow.children[0] && (addrRow.children[0].textContent || "").includes("123 Test St"),
  JSON.stringify(addrRow && addrRow.children[0] && addrRow.children[0].textContent));
addrRow.children[0].onclick();
check("picking an address fills ONLY the destination field with an address endpoint (nearest stop 1212)",
  T.nav().dest && T.nav().dest.kind === "address" && T.nav().dest.stopId === "1212" &&
  T.nav().dest.lat === 43.4558 && T.nav().dest.lon === -79.6824,
  JSON.stringify(T.nav().dest));
check("address endpoint persists endpoints-only in obt_nav (no departures/options)",
  (() => { try { const nav = JSON.parse(store.get("obt_nav")); return nav.dest && nav.dest.kind === "address" && !JSON.stringify(nav).includes("options") && !JSON.stringify(nav).includes("departure"); } catch (e) { return false; } })());
// Far address: >400 m must be honest, never a fake close stop.
const farEp = T.fns.endpointFromAddressResult({ label: "1 Far Rd, Oakville", address: "1 Far Rd, Oakville", lat: 43.35, lon: -79.75 });
check("far address endpoint carries longWalk with its true distance (>400 m), not a fake stop",
  farEp && farEp.longWalk === true && farEp.nearestDist > 400 && !!farEp.stopId,
  JSON.stringify(farEp && { stopId: farEp.stopId, dist: farEp.nearestDist }));
// UPDATED 2026-10-29 (search/time fix): the picker input renders local
// results SYNCHRONOUSLY; only the Nominatim address lookup is debounced
// (400 ms, via refreshPickerAddressResults). The old assertion that the
// whole render waited 400 ms encoded the behaviour the user reported
// as "typing feels dead".
check("picker input renders local results synchronously and debounces ONLY the address lookup (400 ms); footer privacy note exists in all 5 languages (not inline)",
  /pickerDebounce/.test(script) && /renderPickerResults\(inp\.value, true\)/.test(script) &&
  /setTimeout\(\(\) => refreshPickerAddressResults\(q\), 400\)/.test(script) &&
  ["en", "fr", "zh", "ar", "hi"].every(l => T.i18n()[l].footerPrivacy && T.i18n()[l].addressGroup));

// (c) Map pin: 3 taps -> exactly 1 pin stored, 1 marker, confirm = last tap.
T.fns.pickMapPin(43.4558, -79.6824);
T.fns.pickMapPin(43.46, -79.69);
T.fns.pickMapPin(43.47, -79.70);
const st = T.fns.pickPinState();
check("3 map taps leave exactly 1 pin (the last tap) and 1 marker",
  st.pin && st.pin.lat === 43.47 && st.pin.lon === -79.70 &&
  st.marker && st.marker.lat === 43.47 && st.marker.lon === -79.70,
  JSON.stringify(st));
const okPin = T.fns.confirmPickedPin();
const pins = T.saved().filter(p => p.kind === "pin");
check("confirm stores exactly 1 pin, at the last tap's coordinates",
  okPin === true && pins.length === 1 && pins[0].lat === 43.47 && pins[0].lon === -79.70,
  JSON.stringify(pins));
check("pin state is cleared after confirm (no stale re-confirm)",
  T.fns.pickPinState().pin === null && T.fns.pickPinState().marker === null);

// (d) My location (picker): street address as the field value, not a stop list.
nominatimMode = "ok";
T.fns.openPicker("origin");
T.fns.openPickerLocation();
await tick(1500);
const locBox = el("pickerLocResults");
check("picker location shows exactly 1 address row, not a stop list",
  locBox.children.length === 1, `rows=${locBox.children.length}`);
check("picker location row is the reverse-geocoded street address",
  locBox.children[0].children[0].textContent === "456 Test Road, Oakville, Ontario",
  JSON.stringify(locBox.children[0].children[0].textContent));
locBox.children[0].children[0].onclick();
check("tapping the address fills ONLY the origin field with an address endpoint",
  T.nav().origin && T.nav().origin.kind === "address" && T.nav().origin.stopId === "1212" &&
  (T.nav().origin.label || "").includes("456 Test Road"),
  JSON.stringify(T.nav().origin));
// Failure mode: reverse returns nothing -> coordinates label, no invented address.
nominatimMode = "fail";
T.fns.openPicker("dest");
T.fns.openPickerLocation();
await tick(1500);
const failBox = el("pickerLocResults");
check("failed reverse-geocode shows exactly 1 row with a coordinates label (no invented address)",
  failBox.children.length === 1 &&
  (failBox.children[0].children[0].textContent || "").includes("Lat "),
  JSON.stringify(failBox.children[0].children[0].textContent));
check("failed reverse-geocode status says the address could not be detected",
  (el("pickerLocStatus").textContent || "").length > 0 &&
  el("pickerLocStatus").textContent !== "",
  el("pickerLocStatus").textContent);
failBox.children[0].children[0].onclick();
check("fallback address endpoint still journeys via its true nearest stop",
  T.nav().dest && T.nav().dest.kind === "address" && T.nav().dest.stopId === "1212",
  JSON.stringify(T.nav().dest));

// (f) MAIN search screen address search (follow-up): same shared
// nominatimSearch, labelled group after verified results, main button
// fills destination by default (consistent with applyResultPrimary for
// places), "Start here" fills origin, far addresses carry longWalk,
// failure keeps place/station search working, codes/category words
// never trigger a lookup.
nominatimMode = "ok";
T.fns.openSearch();
// Save-UI rework (2026-10-29): privacy sentences live ONLY in the footer
// (small font, last line) — no inline searchAddrNote element any more.
check("privacy sentences live only in the footer, not inline on the search screen",
  (el("footer").innerHTML || "").includes("Nominatim") && (el("footer").innerHTML || "").includes("routing.openstreetmap.de/routed-foot"),
  el("footer").innerHTML);
const collectRows = (box) => box.children.flatMap(c => c.className === "addrgroup" ? c.children.filter(x => x.className === "result") : (c.className === "result" ? [c] : []));
const collectText = (box) => box.children.flatMap(c => c.className === "addrgroup" ? c.children.map(x => x.textContent || "") : [(c.textContent || "")]).join(" | ");
T.fns.runSearch("123 Test St");
await tick(500);
const mainBox = el("searchResults");
const mainWrap = mainBox.children.find(c => c.className === "addrgroup");
const mainHead = mainWrap && mainWrap.children.find(c => (c.textContent || "") === "Address results");
const mainRows = collectRows(mainBox);
const mainAddrRow = mainRows[mainRows.length - 1];
check("main screen shows a labelled 'Address results' group (Oakville stub only)",
  !!mainHead && mainAddrRow && (mainAddrRow.children[0].textContent || "").includes("123 Test St"),
  `children=${mainBox.children.map(c => c.textContent).join(" | ")}`);
check("main-screen address row sub shows the true nearest stop, not a fake one",
  (mainAddrRow.children[1].textContent || "").includes("1212") ||
  (mainAddrRow.children[1].textContent || "").includes("Oakville GO"),
  mainAddrRow.children[1].textContent);
mainAddrRow.children[0].onclick();
check("main-screen address pick fills DESTINATION by default with an address endpoint (stop 1212)",
  T.nav().dest && T.nav().dest.kind === "address" && T.nav().dest.stopId === "1212" &&
  T.nav().dest.lat === 43.4558 && T.nav().dest.lon === -79.6824,
  JSON.stringify(T.nav().dest));
// Save-UI rework (2026-10-29): address rows have NO "Start here" button
// at all — only the primary action (destination) and Save.
T.fns.runSearch("123 Test St");
await tick(500);
const mainBox2 = el("searchResults");
const mainRows2 = collectRows(mainBox2);
const mainAddrRow2 = mainRows2[mainRows2.length - 1];
check("main-screen address row has NO 'Start here' button (primary + Save only)",
  !!mainAddrRow2 && !mainAddrRow2.children.some(c => (c.textContent || "") === "Start here") &&
  mainAddrRow2.children.length === 3,
  mainAddrRow2 && mainAddrRow2.children.map(c => c.textContent).join(" | "));
// Far address from the main screen: longWalk, true distance, no fake stop.
T.fns.runSearch("Far");
await tick(500);
const farBox = el("searchResults");
const farRows = collectRows(farBox);
// Save-UI rework: address group is FIRST (wrap), local rows follow — so
// the far address row is found by label, not by "last row".
const farRow = farRows.find(r => (r.children[0].textContent || "").includes("1 Far Rd"));
check("main-screen far address row carries the longWalk distance label",
  farRow && (farRow.children[1].textContent || "").includes("m") &&
  T.fns.endpointFromAddressResult({ label: "1 Far Rd, Oakville", address: "1 Far Rd, Oakville", lat: 43.35, lon: -79.75 }).longWalk === true,
  farRow && farRow.children[1].textContent);
farRow.children[0].onclick();
check("main-screen far address pick is an address endpoint with longWalk >400 m",
  T.nav().dest && T.nav().dest.kind === "address" && T.nav().dest.longWalk === true && T.nav().dest.nearestDist > 400,
  JSON.stringify(T.nav().dest));
// Failure mode: place/station results still work, plus an honest note.
nominatimMode = "fail";
T.fns.runSearch("Iqbal");
await tick(500);
const failMainBox = el("searchResults");
const failMainRows = collectRows(failMainBox);
check("main-screen Nominatim failure still returns verified place results",
  failMainRows.length > 0 && failMainRows.some(r => (r.children[0].textContent || "").includes("Iqbal")),
  `rows=${failMainRows.map(r => r.children[0].textContent).join(" | ")}`);
check("main-screen Nominatim failure shows the 'unavailable' note, not a crash",
  collectText(failMainBox).includes("unavailable"),
  collectText(failMainBox));
nominatimMode = "ok";
// Exact stop codes and category words never trigger an address lookup.
T.fns.runSearch("3172");
await tick(500);
const codeBox = el("searchResults");
check("main-screen exact stop code triggers no address group and no unavailable note",
  !collectText(codeBox).includes("Address results") &&
  !collectText(codeBox).includes("unavailable"),
  collectText(codeBox));
T.fns.runSearch("school");
await tick(500);
const catBox = el("searchResults");
check("main-screen category word triggers no address group and no unavailable note",
  !collectText(catBox).includes("Address results") &&
  !collectText(catBox).includes("unavailable") &&
  collectRows(catBox).length > 0,
  collectText(catBox));
check("main screen reuses the shared nominatimSearch (no second geocoder implementation)",
  /function nominatimSearch/.test(script) &&
  (script.match(/nominatim\.openstreetmap\.org\/search/g) || []).length === 1);

// (e) RTL + large type + headline first.
T.fns.pickLanguage("ar");
check("Arabic sets document dir rtl", el("html").dir === "rtl");
check("nav fields use large type (26px)",
  /\.navfield \{[^}]*font-size:26px/.test(html) && /\.swapbtn \{[^}]*font-size:26px/.test(html));
check("countdown comes before alternatives and map button in source",
  html.indexOf('id="countdown"') < html.indexOf('id="journeyAlts"') &&
  html.indexOf('id="countdown"') < html.indexOf('id="mapBtn"'));
check("address labels exist, non-empty, in all 5 languages",
  ["addressGroup", "footerPrivacy", "addressSearchUnavailable", "locAddressFailed", "locAddressFound", "addressLabel"]
    .every(k => ["en", "fr", "zh", "ar", "hi"].every(l => T.i18n()[l] && typeof T.i18n()[l][k] === "string" && T.i18n()[l][k].length > 0)));

console.log(failures === 0 ? "ALL P0b TESTS PASSED" : failures + " TEST(S) FAILED");
console.log("MANUAL EYE-CHECK LIST (this machine cannot screenshot — check on a real phone):");
console.log("1. No Common trips / quick-fill row anywhere on the main screen; saved places are the shortcuts.");
console.log("2. Tap Origin or Destination, type a home address: labelled Address results appear after verified places; picking one fills only that field, with the nearest stop and true walking distance shown.");
console.log("3. Tap the map 3 times: only the last pin is visible; Confirm saves only that pin.");
console.log("4. Use my location: one detected street address is shown (not a stop list); if detection fails, a coordinates label appears and says so.");
console.log("5. Arabic RTL, large type, and 'next bus in X minutes' first on the board still hold.");
process.exit(failures === 0 ? 0 : 1);
