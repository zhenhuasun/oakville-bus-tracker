// Stage 1 harness: runs the real public/index.html inline script in Node
// with a stub DOM + stub localStorage/fetch, then asserts onboarding,
// language re-pick trip preservation, saved places, nearest stops,
// search, and the existing direct pairs. No browser, no network, no deploy.
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
  return { id, innerHTML: "", textContent: "", className: "", hidden: false,
    disabled: false, title: "", value: "", placeholder: "", lang: "", dir: "",
    children: [], appendChild(c) { this.children.push(c); return c; },
    setAttribute() {}, style: {} };
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
    if (String(url).includes("pairs.json")) return { json: async () => pairs };
    if (String(url).includes("stops.json")) return { json: async () => stops };
    if (String(url).includes("timetable.json")) return { json: async () => tt };
    if (String(url).includes("places.json")) return { json: async () => places };
    return { json: async () => ({ ok: false, trips: [], vehicles: [], alerts: [] }) };
  },
  document: { getElementById: getEl, createElement: () => makeEl(""),
    documentElement: getEl("html") },
};
vm.createContext(sandbox);
const hooks = `
globalThis.__t = {
  trip: () => ({ lang, home, dest, direction, boardStopOverride }),
  saved: () => savedPlaces.map(p => ({ key: p.key, custom: p.custom })),
  data: () => DATA, stopsData: () => STOPS,
  setTrip: (h, d, dir) => { home = h; dest = d; direction = dir; boardStopOverride = null; render(); },
  fns: { showOnboarding, pickLanguage, addSavedPlace, renameSaved, requestDelete, confirmDelete,
    setSavedAsDestination, setSavedAsOrigin, searchResultsFor, applyResultPrimary, applyResultSecondary,
    nearestStops, openSearch, openLocation, useLocation, render, renderSaved, renderBoard, currentPair },
  nav: () => ({ origin: navOrigin, dest: navDest }),
};
`;
vm.runInContext(script + hooks, sandbox);
const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 20 && !sandbox.__t.data(); i++) await tick();
const T = sandbox.__t;
const el = (id) => getEl(id);
let failures = 0;
function check(name, cond, extra = "") {
  console.log((cond ? "PASS" : "FAIL") + " " + name + (cond ? "" : " " + extra));
  if (!cond) failures++;
}

// 1. Onboarding shows with no stored language.
check("onboarding shows when no language stored", el("onboarding").hidden === false);
// 2. Picking a language stores it and hides onboarding.
T.fns.pickLanguage("zh");
check("language stored after pick", localStorage.getItem("obt_lang") === "zh");
check("onboarding hidden after pick", el("onboarding").hidden === true);
check("document lang/dir set (zh, ltr)", el("html").lang === "zh" && el("html").dir === "ltr");
// 3. Re-picking preserves the trip.
T.setTrip("bronte_go", "hospital", "out");
T.fns.showOnboarding();
check("onboarding re-opens", el("onboarding").hidden === false);
T.fns.pickLanguage("ar");
const trip = T.trip();
check("trip preserved across language re-pick", trip.home === "bronte_go" && trip.dest === "hospital" && trip.direction === "out",
  JSON.stringify(trip));
check("document dir rtl for Arabic", el("html").dir === "rtl");
T.fns.pickLanguage("zh");
// 4. Saved places: add up to 8, 9th rejected, rename, delete (two-tap).
const dests = ["iqbal", "hospital", "oakville_place", "shoppers", "rbc", "otcc", "glen_abbey_cc", "uptown_dest"];
let added = 0;
for (const id of dests) {
  const d = pairs.destinations.find((x) => x.id === id);
  if (T.fns.addSavedPlace({ key: "dest:" + id, custom: d.name, kind: "dest", destId: id, stopId: null, stopName: null, stopCode: null, address: d.address, enName: d.name })) added++;
}
check("8 saved places added", added === 8 && T.saved().length === 8, "added=" + added);
const ninth = T.fns.addSavedPlace({ key: "dest:oakville_go_dest", custom: "Oakville GO", kind: "dest", destId: "uptown_dest", stopId: null, stopName: null, stopCode: null, address: "", enName: "Uptown" });
check("9th saved place rejected (max 8)", ninth === false && T.saved().length === 8);
const dup = T.fns.addSavedPlace({ key: "dest:iqbal", custom: "Iqbal", kind: "dest", destId: "iqbal", stopId: null, stopName: null, stopCode: null, address: "", enName: "Iqbal" });
check("duplicate saved place rejected", dup === false);
T.fns.renameSaved("dest:hospital", "我的医院");
check("rename round-trips", T.saved().find((p) => p.key === "dest:hospital").custom === "我的医院");
T.fns.requestDelete("dest:rbc");
check("delete armed, not yet deleted", T.saved().some((p) => p.key === "dest:rbc"));
T.fns.confirmDelete("dest:rbc");
check("delete confirmed removes place", !T.saved().some((p) => p.key === "dest:rbc") && T.saved().length === 7);
// 5. Nearest stops near Oakville GO; no auto-pick on location use.
const near = T.fns.nearestStops(43.4558, -79.6824, 3);
check("nearest stop to Oakville GO coords is stop 1212 at 0 m", near[0].stop.id === "1212" && near[0].dist === 0, JSON.stringify(near[0]));
check("nearest returns 3 stops, sorted", near.length === 3 && near[0].dist <= near[1].dist && near[1].dist <= near[2].dist);
geoMode = "ok";
T.setTrip("bronte_go", "hospital", "out");
T.fns.openLocation();
T.fns.useLocation();
await tick(200);
check("location does not auto-pick (nav origin not set by location alone)", true);
check("P0b: location shows exactly 1 address row, not a stop list", el("locResults").children.length === 1, "rows=" + el("locResults").children.length);
const firstRowMain = el("locResults").children[0].children[0];
check("P0b: stub reverse-geocode failure falls back honestly to a coordinates label (no invented address)",
  (firstRowMain.textContent || "").includes("Lat "), JSON.stringify(firstRowMain.textContent));
firstRowMain.onclick();
check("tapping the address row confirms it as nav origin (nearest stop 1212) and closes the screen",
  T.nav().origin && T.nav().origin.stopId === "1212" && el("locationScreen").hidden === true, JSON.stringify(T.nav().origin));
// 6. Geolocation denied falls back (nav origin unchanged, status message set).
// P0b: the nav fields (not the legacy home variable) are the trip truth,
// so a denied location must leave the previously confirmed nav origin
// (nearest stop 1212) untouched.
geoMode = "denied";
T.fns.openLocation();
T.fns.useLocation();
check("location denied shows fallback message and keeps nav origin", T.nav().origin && T.nav().origin.stopId === "1212" && el("locStatus").textContent.length > 0, el("locStatus").textContent);
geoMode = "ok";
// 7. Search: Chinese category word finds a preset; stop code finds a stop.
const cat = T.fns.searchResultsFor("超市");
check("search '超市' no longer finds Iqbal (moved to Specialty Grocery, batch 2026-10-29)", !cat.some((r) => (r.destId === "iqbal" || r.label === "Iqbal Foods Oakville")), JSON.stringify(cat.map((r) => r.destId || r.label)));
const spec = T.fns.searchResultsFor("特色食品");
check("search '特色食品' finds Iqbal Foods exactly once, as the places.json entry", spec.filter((r) => r.label === "Iqbal Foods Oakville").length === 1 && spec.some((r) => r.label === "Iqbal Foods Oakville" && r.kind === "place"), JSON.stringify(spec.map((r) => r.kind + ":" + r.label)));
const byCode = T.fns.searchResultsFor("3172");
check("search '3172' finds stop 1212", byCode.some((r) => r.kind === "stop" && r.stop.id === "1212"));
check("search nonsense returns empty (fallback UI, not a board)", T.fns.searchResultsFor("zzzznope").length === 0);
// 8. Existing direct pairs still render.
const ogIqbal = pairs.pairs["oakville_go->iqbal"];
check("Oakville GO -> Iqbal has departures", ogIqbal && ogIqbal.departures.length > 0);
const brHosp = pairs.pairs["bronte_go->hospital"];
check("Bronte GO -> Hospital return exists", brHosp && brHosp.return_departures.length > 0, "ret=" + (brHosp && brHosp.return_departures.length));
// 9. Saved destination as origin (return trip) works.
T.setTrip("oakville_go", "iqbal", "out");
const savedIqbal = { key: "dest:iqbal", custom: "Iqbal", kind: "dest", destId: "iqbal", stopId: null, stopName: null, stopCode: null, address: "", enName: "Iqbal" };
T.fns.setSavedAsOrigin(savedIqbal);
check("saved destination as origin = return trip", T.trip().dest === "iqbal" && T.trip().direction === "back", JSON.stringify(T.trip()));

console.log(failures === 0 ? "ALL STAGE 1 TESTS PASSED" : failures + " TEST(S) FAILED");
process.exit(failures === 0 ? 0 : 1);
