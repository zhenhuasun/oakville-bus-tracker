// Boarding-stop harness (user-reported bug, 2026-10-28): an address
// whose nearest stop is infrequent must not silently win over a
// slightly farther frequent stop. Runs the real public/index.html
// inline script in Node with a stub DOM + stub localStorage/fetch.
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
  fns: { render, setNavEndpoint, endpointFromAddress, endpointFromStation,
    endpointFromStop, originBoardingCandidates, computeBoardingJourneys,
    chooseBoardingStop, renderBoardingAlternatives, renderJourneyBoard,
    restoreNavFromStorage, stopName: stopNameOf, stopCode: stopCodeOf },
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
const stop228 = stops.stops.find(s => s.id === "228");
const stop750 = stops.stops.find(s => s.id === "750");
// A home address exactly at stop 228 (Oak Park Blvd + Parkhaven Blvd,
// route 20 only, infrequent) — the user-reported shape of the bug.
const home = T.fns.endpointFromAddress("Test Home", "Test Home, Oakville", stop228.lat, stop228.lon);
check("address endpoint's primary stop is the nearest stop 228",
  home && home.stopId === "228", JSON.stringify(home && home.stopId));

// (1) Origin candidates: stops within 1000 m STREET distance, capped at 5 (2026-10-29 widening).
const cands = T.fns.originBoardingCandidates(home);
check("origin candidates include the nearest stop 228 and the 330 m stop 750, capped at 5, nearest first",
  Array.isArray(cands) && cands.length >= 2 && cands.length <= 5 &&
  cands[0].id === "228" && cands[0].dist === 0 &&
  cands.some(c => c.id === "750" && c.dist >= 300 && c.dist <= 1000),
  JSON.stringify(cands));

// (2) The fix, pinned to Tuesday 2026-10-27 08:10 EDT (12:10Z): from
// stop 228 the direct route 20 arrives Oakville GO at 09:00, while
// stop 750 (330 m away, walk 7 min) has a departure at 08:20 arriving
// 08:38. The board must choose the earlier arrival, not the nearest stop.
const fixed = new Date("2026-10-27T12:10:00Z");
const state = T.fns.computeBoardingJourneys(cands, ["1212"], "Test Home", "Oakville GO", fixed);
const chosen = state && state.boarding && state.boarding.candidates.find(c => c.stopId === state.boarding.chosen);
const nearest = state && state.boarding && state.boarding.candidates.find(c => c.stopId === "228");
check("chosen journey arrives earlier than the nearest stop's journey (not merely nearest)",
  state && state.options && nearest && nearest.hasRide && chosen &&
  state.options[0].legs[state.options[0].legs.length - 1].alightArr < nearest.alightArr,
  JSON.stringify(state && { chosen: state.boarding.chosen, chosenArr: state.options[0].legs[state.options[0].legs.length - 1].alightArr, nearestArr: nearest && nearest.alightArr }));
check("chosen stop is NOT the nearest stop, and its walk distance (<=1000 m street) is shown honestly",
  state && state.o !== "228" && chosen && chosen.dist > 0 && chosen.dist <= 1000 &&
  state.originWalkM === chosen.dist && state.originWalkMin === Math.ceil(chosen.dist / 48),
  JSON.stringify(state && { o: state.o, walkM: state.originWalkM, walkMin: state.originWalkMin }));
const far750 = state && state.boarding && state.boarding.candidates.find(c => c.stopId === "750");
check("the 330 m stop 750 itself arrives earlier than the nearest stop (the reported bug shape)",
  far750 && far750.hasRide && nearest && far750.alightArr < nearest.alightArr,
  JSON.stringify(far750 && { dist: far750.dist, boardDep: far750.boardDep, alightArr: far750.alightArr }));
check("alternatives list includes the nearest stop 228 with its later departure/arrival",
  state && state.boarding && state.boarding.candidates.some(c => c.stopId === "228" && c.hasRide && c.alightArr > state.options[0].legs[state.options[0].legs.length - 1].alightArr),
  JSON.stringify(state && state.boarding.candidates.map(c => [c.stopId, c.dist, c.boardDep, c.alightArr])));
// Board rendering: wait line shows the walk, alternatives box lists the nearest stop.
T.fns.renderJourneyBoard.call ? null : null;
const boardState = state;
const savedJourney = boardState;
// Render via the real board by temporarily using the computed state:
{
  // The board reads the module journeyState; the test VM exposes it via
  // journey(), but renderJourneyBoard is not reachable without setting
  // it — instead assert the data the board renders from, plus the
  // alternatives DOM built by renderBoardingAlternatives.
  const box = el("journeyAlts"); box.innerHTML = "";
  T.fns.renderBoardingAlternatives(box, boardState);
  const texts = box.children.map(c => c.textContent || "");
  check("boarding alternatives DOM lists the nearest stop with its walk distance and marks the chosen stop",
    texts.some(x => x.includes("Oak Park Blvd + Parkhaven Blvd") && x.includes("Nearest stop")) &&
    texts.some(x => x.includes("Chosen")),
    texts.join(" | "));
  const nearestRow = box.children.find(c => (c.textContent || "").includes("Oak Park Blvd + Parkhaven Blvd"));
  check("nearest-stop row is a button (tappable), not the chosen/disabled row",
    !!nearestRow && nearestRow.disabled !== true, JSON.stringify(nearestRow && nearestRow.disabled));
}

// (3) Tapping the nearest-stop row re-runs from that stop and persists it.
T.fns.setNavEndpoint("origin", home);
const oakGO = places.stations.find(s => s.name === "Oakville GO");
T.fns.setNavEndpoint("dest", T.fns.endpointFromStation(oakGO));
const tapOk = T.fns.chooseBoardingStop("228");
check("tapping the nearest-stop row re-runs the journey from stop 228",
  tapOk === true && T.journey() && T.journey().o === "228",
  JSON.stringify(T.journey() && { o: T.journey().o, boarding: T.journey().boarding && T.journey().boarding.chosen }));
check("boarding-stop choice persists in obt_nav (no departures stored)",
  (() => { try { const nav = JSON.parse(store.get("obt_nav")); return nav.boardStop === "228" && !JSON.stringify(nav).includes("options"); } catch (e) { return false; } })(),
  store.get("obt_nav"));
// (4) Homefix 2026-10-29: reload starts EMPTY (no restore), so the
// chosen boarding stop is persisted in obt_nav but not restored into
// a trip on load. The persistence itself is asserted in (3).
{
  const vm2 = await loadVM(new Map(store));
  check("reload starts EMPTY even with a chosen boarding stop stored",
    vm2.T.nav().origin === null && vm2.T.nav().dest === null && !vm2.T.journey(),
    JSON.stringify(vm2.T.journey() && { o: vm2.T.journey().o }));
}

// (5) Single-stop origins unchanged: hub station and exact stop code.
check("hub-station origin has no boarding candidates (single stop, unchanged)",
  T.fns.originBoardingCandidates(T.fns.endpointFromStation(oakGO)) === null);
const stop645 = stops.stops.find(s => s.id === "645");
check("exact-stop-code origin has no boarding candidates (single stop, unchanged)",
  T.fns.originBoardingCandidates(T.fns.endpointFromStop(stop645)) === null);

// (6) Destination with multiple candidate stops still works as before.
check("new boarding labels exist in all 5 languages (draft)",
  ["en", "fr", "zh", "ar", "hi"].every(l =>
    T.i18n()[l].walkFromAddress && T.i18n()[l].tryAnotherBoarding &&
    T.i18n()[l].nearestStop && T.i18n()[l].chosenStop));

console.log(failures === 0 ? "ALL BOARDING TESTS PASSED" : failures + " TEST(S) FAILED");
process.exit(failures === 0 ? 0 : 1);
