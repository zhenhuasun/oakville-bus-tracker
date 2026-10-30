// Category + 1 km street-walk harness (user batch 2026-10-29) + street
// distance audit assertions. Runs the real public/index.html inline
// script in Node with a stub DOM + stub localStorage/fetch.
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
  ready: () => !!(DATA && TT && PLACES),
  i18n: () => I18N,
  CAT_LABEL: () => CAT_LABEL, CAT_ORDER: () => CAT_ORDER, DEST_CAT_ID: () => DEST_CAT_ID,
  fns: { searchResultsFor, originBoardingCandidates, originBoardingProbes,
    streetWalkPut, streetWalkReset, resolveWalk, destWalkFor,
    endpointFromAddress, openSearch, openPicker, stopName: stopNameOf },
};
`, sandbox);
  for (let i = 0; i < 80 && !sandbox.__t.ready(); i++) await tick();
  return { T: sandbox.__t, el: getEl };
}

let failures = 0;
function check(name, cond, extra = "") {
  console.log((cond ? "PASS" : "FAIL") + " " + name + (cond ? "" : " " + extra));
  if (!cond) failures++;
}
const fold = (x) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const hav = (a, b, c, d) => {
  const R = 6371000, p1 = a * Math.PI / 180, p2 = c * Math.PI / 180;
  const dp = p2 - p1, dl = (d - b) * Math.PI / 180;
  return 2 * R * Math.asin(Math.sqrt(Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2));
};

const { T, el } = await loadVM();
check("VM data loaded", T.ready());

// (a) Origin boarding: 1000 m STREET, both directions of the proof.
{
  const s228 = stops.stops.find(s => s.id === "228");
  const home = T.fns.endpointFromAddress("Test Home", "Test Home, Oakville", s228.lat, s228.lon);
  // Find a real stop 600-900 m straight-line from the origin.
  const far = stops.stops
    .map(s => ({ s, d: hav(s228.lat, s228.lon, s.lat, s.lon) }))
    .filter(x => x.d >= 600 && x.d <= 900 && x.s.id !== "228")
    .sort((a, b) => a.d - b.d)[0];
  check("proof stop exists 600-900 m straight from origin", !!far, JSON.stringify(far && { id: far.s.id, d: Math.round(far.d) }));
  if (far) {
    T.fns.streetWalkReset();
    T.fns.streetWalkPut([s228.lat, s228.lon], [far.s.lat, far.s.lon], { m: 800, geometry: null });
    const cands = T.fns.originBoardingCandidates(home);
    check("stop at 800 m street IS a boarding candidate (was rejected at 500 m straight)",
      Array.isArray(cands) && cands.some(c => c.id === far.s.id && c.dist === 800),
      JSON.stringify(cands && cands.map(c => [c.id, c.dist])));
    check("candidate cap is 5", Array.isArray(cands) && cands.length <= 5, JSON.stringify(cands && cands.length));
    // Over-cap street: same stop, street 1200 m, straight still < 1000 m.
    T.fns.streetWalkPut([s228.lat, s228.lon], [far.s.lat, far.s.lon], { m: 1200, geometry: null });
    const cands2 = T.fns.originBoardingCandidates(home);
    check("stop at 1200 m street is REJECTED even though straight-line < 1000 m",
      Array.isArray(cands2) && !cands2.some(c => c.id === far.s.id),
      JSON.stringify(cands2 && cands2.map(c => [c.id, c.dist])));
    T.fns.streetWalkReset();
  }
  check("transfer cap still 300 m street (constant unchanged)",
    html.includes("const MAX_WALK_M = 300"));
  check("origin cap constant is 1000 m street",
    html.includes("const ORIGIN_BOARDING_STREET_MAX_M = 1000"));
}

// (b) places.json categories sorted A-Z by English name (accent-folded).
{
  const byCat = {};
  for (const p of places.places) (byCat[p.cat] = byCat[p.cat] || []).push(p.name);
  let allSorted = true;
  for (const [cat, names] of Object.entries(byCat)) {
    const sorted = [...names].sort((a, b) => fold(a) < fold(b) ? -1 : fold(a) > fold(b) ? 1 : 0);
    if (JSON.stringify(names) !== JSON.stringify(sorted)) { allSorted = false; console.log("  unsorted cat:", cat); }
  }
  check("every places.json category sorted A-Z by English name", allSorted);
  check("counts unchanged: 230 places + 9 stations",
    places.places.length === 230 && places.stations.length === 9);
}

// (c) Labels in all 22 languages.
{
  const langs = ["en", "fr", "zh", "ar", "es", "ur", "pt", "pl", "it", "pa", "ko", "hi", "tl", "hr", "ru", "zh-Hant", "fa", "sr", "de", "ro", "uk", "ja"];
  const cats = T.CAT_LABEL();
  check("specialtyasian EN label is Specialty Grocery",
    cats.specialtyasian.en === "Specialty Grocery", cats.specialtyasian.en);
  check("specialtyasian label has no Asian part in any of the 22 languages",
    langs.every(l => cats.specialtyasian[l] && !/asian|asiat|亚洲|آسيو|एशिया|ਏਸ਼ੀਆ|ایشیائی|Азі|Азиат|아시아/i.test(cats.specialtyasian[l])),
    JSON.stringify(cats.specialtyasian));
  check("station EN label is Transit Terminal",
    cats.station.en === "Transit Terminal", cats.station.en);
  check("station label non-empty in all 15 and not the old Station",
    langs.every(l => cats.station[l] && cats.station[l] !== "Station"));
  const i18n = T.i18n();
  check("stationGroup EN is Transit Terminals, non-empty in all 15",
    i18n.en.stationGroup === "Transit Terminals" && langs.every(l => i18n[l].stationGroup));
}

// (d) Iqbal: specialty only, no duplicate; other prototypes dedupe, branches survive.
{
  const spec = T.fns.searchResultsFor(T.CAT_LABEL().specialtyasian.en);
  const iqbalRows = spec.filter(r => (r.label || "").includes("Iqbal"));
  check("Iqbal appears exactly once in Specialty Grocery, as the places.json entry",
    iqbalRows.length === 1 && iqbalRows[0].kind === "place",
    JSON.stringify(iqbalRows.map(r => [r.kind, r.label])));
  const sup = T.fns.searchResultsFor(T.CAT_LABEL().supermarket.en);
  check("Iqbal does NOT appear in Supermarket",
    !sup.some(r => (r.label || "").includes("Iqbal")));
  const shop = T.fns.searchResultsFor(T.CAT_LABEL().shoppingcentre.en);
  check("Oakville Place dedupes to one row in Shopping Centre",
    shop.filter(r => (r.label || "").includes("Oakville Place")).length === 1);
  const hosp = T.fns.searchResultsFor(T.CAT_LABEL().hospitallab.en);
  check("Hospital dedupes to one row in Hospital & Labs",
    hosp.filter(r => (r.label || "").includes("Memorial Hospital")).length === 1);
  const pharm = T.fns.searchResultsFor(T.CAT_LABEL().pharmacy.en);
  check("Shoppers branches are NOT deduped away (place-vs-place kept)",
    pharm.filter(r => r.label === "Shoppers Drug Mart").length >= 2,
    String(pharm.filter(r => r.label === "Shoppers Drug Mart").length));
}

// (e)(f) Library + park notes in places.json.
{
  const lib = places.places.find(p => p.id === "opl-sixteen-mile");
  const cc = places.places.find(p => p.id === "sixteen-mile-cc");
  const park = places.places.find(p => p.id === "bronte-creek-park");
  check("Sixteen Mile library entry has NO replacing-branch note",
    lib && !("note" in lib), JSON.stringify(lib && lib.note));
  check("Sixteen Mile Community Centre note survives",
    cc && (cc.note || "").includes("Sixteen Mile Sports Complex"), cc && cc.note);
  check("Bronte Creek note is 'Provincial park; day-use fee may apply', no Town park phrase",
    park && park.note === "Provincial park; day-use fee may apply", park && park.note);
}

// (g) Category button order on both pages.
{
  const want = ["supermarket", "specialtyasian", "shoppingcentre", "bigbox", "hospitallab", "pharmacy", "station", "communityCentre", "library", "religious", "park", "school", "bank"];
  check("CAT_ORDER is exactly the user-specified 13-code order",
    JSON.stringify(T.CAT_ORDER()) === JSON.stringify(want), JSON.stringify(T.CAT_ORDER()));
  T.fns.openSearch();
  const searchBtns = el("searchCats").children.filter(c => c.textContent && c.textContent !== "Categories: ").map(c => c.textContent);
  const wantLabels = want.map(c => T.CAT_LABEL()[c].en);
  check("search screen category buttons follow CAT_ORDER",
    JSON.stringify(searchBtns) === JSON.stringify(wantLabels),
    JSON.stringify(searchBtns));
  T.fns.openPicker("origin");
  const pickerBtns = el("pickerCats").children.map(c => c.textContent);
  check("picker category buttons follow CAT_ORDER",
    JSON.stringify(pickerBtns) === JSON.stringify(wantLabels),
    JSON.stringify(pickerBtns));
}

// --- Street-distance audit assertions ---
{
  check("destination walk routes through resolveWalk (street when cached)",
    /function destWalkFor[\s\S]{0,600}resolveWalk/.test(html));
  check("transfer enrichment substitutes cached street walks and rejects street > 300 m",
    html.includes("resolveWalk(ac, bc)") && html.includes("if (ts.walkM > MAX_WALK_M) streetRejected = true"));
  check("boarding computation routes through resolveWalk",
    html.includes("resolveWalk([navOrigin.lat, navOrigin.lon], bc)"));
  check("informational distances upgrade via upgradeWalkEl (saved pin, address, my-location, pick pin)",
    html.includes("async function upgradeWalkEl") &&
    (html.match(/upgradeWalkEl\(/g) || []).length >= 5);
  check("map transfer walks use street geometry when cached",
    html.includes('geometry: rw.source === "street" ? rw.geometry : null'));
  check("no journey/board/ranking walk uses straight-line as final: legacy engine is documented as board-unreachable",
    html.includes("this legacy") && html.includes("never a displayed or ranked distance"));
  // Behavioural: cached street value wins over straight-line.
  const s228 = stops.stops.find(s => s.id === "228");
  const s750 = stops.stops.find(s => s.id === "750");
  T.fns.streetWalkReset();
  const before = T.fns.resolveWalk([s228.lat, s228.lon], [s750.lat, s750.lon]);
  check("resolveWalk without cache returns straight-line estimate",
    before.source === "estimate", JSON.stringify(before));
  T.fns.streetWalkPut([s228.lat, s228.lon], [s750.lat, s750.lon], { m: 999, geometry: null });
  const after = T.fns.resolveWalk([s228.lat, s228.lon], [s750.lat, s750.lon]);
  check("resolveWalk with cache returns the street value, not straight-line",
    after.source === "street" && after.m === 999, JSON.stringify(after));
  T.fns.streetWalkReset();
}

console.log(failures === 0 ? "ALL CATWALK TESTS PASSED" : failures + " TEST(S) FAILED");
process.exit(failures === 0 ? 0 : 1);
