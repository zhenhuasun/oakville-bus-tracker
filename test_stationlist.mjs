// Transit Terminal list fix harness (2026-10-29, user report): the
// category list showed 11 rows — 2 legacy preset duplicates on top of
// the 9 hub stations — and the 9 were in hub order, not alphabetical.
// Fix is render-time only in searchResultsFor: drop a preset row when a
// station row in the same list has the same stop name (case-insensitive),
// and sort station rows A–Z by displayed English name (accent-folded).
// Runs the real public/index.html inline script in Node with a stub DOM
// + stub localStorage/fetch. No browser, no network, no deploy.
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
const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));
async function loadVM() {
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
  nav: () => ({ origin: navOrigin, dest: navDest, focus: navFocus }),
  saved: () => savedPlaces.map(p => ({ ...p })),
  CAT_LABEL: () => CAT_LABEL, DEST_CAT_ID: () => DEST_CAT_ID,
  fns: { searchResultsFor, endpointFromStation, applyResultPrimary,
    openSearch, runSearch, saveSearchResult },
};
`, sandbox);
  for (let i = 0; i < 60 && !sandbox.__t.nav().origin; i++) await tick();
  return { T: sandbox.__t, el: getEl };
}

let failures = 0;
function check(name, cond, extra = "") {
  console.log((cond ? "PASS" : "FAIL") + " " + name + (cond ? "" : " " + extra));
  if (!cond) failures++;
}
const { T, el } = await loadVM();
const catWord = T.CAT_LABEL().station.en; // "Transit Terminal"
const EXPECTED = ["Appleby GO", "Bronte GO", "Clarkson GO",
  "Dundas St. @ Hwy. 407 Park & Ride", "Laird Rd + Ridgeway Dr", "Oakville GO",
  "Sheridan College", "Trafalgar Rd + Highway 407 GO Carpool", "Uptown Core Terminal"];

// (a) Transit Terminal category: exactly the 9 stations, A–Z, no presets.
{
  const res = T.fns.searchResultsFor(catWord);
  const labels = res.map(r => r.label);
  check("(a) Transit Terminal category returns exactly 9 rows",
    res.length === 9, JSON.stringify(labels));
  check("(a) all 9 rows are station rows (no preset rows)",
    res.every(r => r.kind === "station"), res.map(r => r.kind + ":" + r.label).join(" | "));
  check("(a) station rows are A–Z by displayed English name",
    JSON.stringify(labels) === JSON.stringify(EXPECTED), JSON.stringify(labels));
  check("(a) no oakville_go_dest / uptown_dest preset row survives",
    !res.some(r => r.destId === "oakville_go_dest" || r.destId === "uptown_dest"));
  // Rendered category rows: pick-to-save — plain-text label (no click),
  // ONLY a Save button; tapping Save saves without navigating.
  const navBefore = JSON.stringify(T.nav());
  const savedBefore = T.saved().length;
  T.fns.openSearch();
  T.fns.runSearch(catWord);
  const rows = el("searchResults").children.filter(c => c.className === "result");
  check("(a) rendered category list has 9 rows", rows.length === 9,
    `rows=${rows.length}`);
  const first = rows[0];
  check("(a) rendered category row: label is plain text (no navigation handler) + Save only",
    !!first && typeof first.children[0].onclick !== "function" &&
    first.children.length === 3 && (first.children[2].textContent || "").startsWith("＋"),
    first && first.children.map(c => `${c.textContent} onclick=${typeof c.onclick}`).join(" | "));
  if (first) first.children[2].onclick(); // Save
  check("(a) tapping a category station row's Save saves WITHOUT navigating",
    JSON.stringify(T.nav()) === navBefore && T.saved().length === savedBefore + 1,
    `saved=${T.saved().length} (was ${savedBefore})`);
}

// (b) Free-text: station row wins, preset row dropped, stations A–Z.
{
  const res = T.fns.searchResultsFor("Oakville GO");
  check("(b) free-text 'Oakville GO' returns the station row",
    res.some(r => r.kind === "station" && r.label === "Oakville GO"),
    res.map(r => r.kind + ":" + r.label).join(" | "));
  check("(b) free-text 'Oakville GO' does NOT return the oakville_go_dest preset row",
    !res.some(r => r.destId === "oakville_go_dest"));
  const resU = T.fns.searchResultsFor("Uptown Core");
  check("(b) free-text 'Uptown Core' returns the station row, not the uptown preset",
    resU.some(r => r.kind === "station" && r.label === "Uptown Core Terminal") &&
    !resU.some(r => r.destId === "uptown_dest"),
    resU.map(r => r.kind + ":" + r.label).join(" | "));
  const resGo = T.fns.searchResultsFor("GO").filter(r => r.kind === "station").map(r => r.label);
  const sortedGo = [...resGo].sort((a, b) => a.localeCompare(b));
  check("(b) free-text station rows are A–Z (query 'GO')",
    resGo.length > 1 && JSON.stringify(resGo) === JSON.stringify(sortedGo),
    JSON.stringify(resGo));
}

// (c) No other preset is lost — correctly stated: category browsing
// already (pre-existing 2026-10-29 place dedupe, unchanged here) drops a
// preset when a places.json entry in the SAME category has the same
// name/address, and the place row wins. So for shopping centre /
// community centre the category list must still contain the place rows
// with those names (once each, no duplicate), and free-text search —
// which has no place dedupe — must still return the legacy presets.
// Proof the station dedupe cannot be the cause: in these categories
// stationRows is empty (station rows are only pushed when
// catMatch === "station"), so the new station clause is vacuously true.
{
  const shop = T.fns.searchResultsFor(T.CAT_LABEL().shoppingcentre.en);
  check("(c) shopping centre category still lists Oakville Place (place row wins over preset, pre-existing rule)",
    shop.filter(r => r.label === "Oakville Place").length === 1 &&
    shop.some(r => r.kind === "place" && r.label === "Oakville Place"),
    shop.map(r => r.kind + ":" + r.label).join(" | "));
  const cc = T.fns.searchResultsFor(T.CAT_LABEL().communityCentre.en);
  check("(c) community centre category still lists OTCC + Glen Abbey (place rows, pre-existing rule)",
    cc.some(r => r.kind === "place" && r.label === "Oakville Trafalgar Community Centre") &&
    cc.some(r => r.kind === "place" && r.label === "Glen Abbey Community Centre"),
    cc.map(r => r.kind + ":" + r.label).join(" | "));
  const spec = T.fns.searchResultsFor(T.CAT_LABEL().specialtyasian.en);
  check("(c) specialty grocery category still has Iqbal",
    spec.some(r => (r.label || "").includes("Iqbal")));
  const freePlace = T.fns.searchResultsFor("Oakville Place");
  check("(c) free-text 'Oakville Place' still returns its preset row",
    freePlace.some(r => r.destId === "oakville_place"));
  const freeOtcc = T.fns.searchResultsFor("Oakville Trafalgar Community Centre");
  check("(c) free-text OTCC still returns its preset row (free-text has no place dedupe)",
    freeOtcc.some(r => r.destId === "otcc"));
}

// (d) Station lookup by id + navigation from a station row still work,
// and places.json stations array itself was NOT reordered (hub order).
{
  check("(d) places.json stations array still in hub order (Oakville GO first, not A–Z)",
    places.stations[0].name === "Oakville GO" && places.stations[1].name === "Uptown Core Terminal",
    places.stations.map(s => s.name).join(" | "));
  const byId = places.stations.find(s => s.id === "oakville-go");
  check("(d) station lookup by id still finds Oakville GO (stop 3172)",
    !!byId && byId.stop.code === "3172" && byId.stop.id === "1212");
  const row = T.fns.searchResultsFor(catWord).find(r => r.label === "Oakville GO");
  const ep = T.fns.endpointFromStation(row.station);
  check("(d) endpointFromStation on the category station row gives stop 1212",
    !!ep && ep.stopId === "1212" && ep.stationId === "oakville-go", JSON.stringify(ep));
  T.fns.applyResultPrimary(row);
  check("(d) tapping a station row still navigates (dest stop 1212)",
    T.nav().dest && T.nav().dest.stopId === "1212",
    JSON.stringify(T.nav().dest));
}

if (failures) { console.log(failures + " FAILURES"); process.exit(1); }
console.log("ALL STATIONLIST CHECKS PASSED");
