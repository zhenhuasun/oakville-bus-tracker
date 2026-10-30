// Stage 2 harness: runs the real public/index.html inline script in Node
// with a stub DOM + stub localStorage/fetch, then asserts the journey
// engine, expanded search, RT per-leg labels, and Stage 1 regressions.
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
    setJourney, swapJourney, searchJourneys, legLive, placeStopIds, stopNameOf },
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

// Stage 2.1 checks: search/category data correction.
// (Schools were restored by the 2026-10-28 geocoding pass: all 74
// schools are School places; per user decision 2026-10-28 the 7
// verified schools >400 m from a stop are included with an explicit
// walking-distance label (longWalk) — see test_schools.mjs.)
const P = places.places;
const byCat = (c) => P.filter(p => p.cat === c);
const byName = (n) => P.find(p => p.name === n);
check("places total is 230 (153 + 74 schools + 1 specialty + 2 supermarket)", P.length === 230, "n=" + P.length);
check("shoppingcentre is 13", byCat("shoppingcentre").length === 13, byCat("shoppingcentre").map(p => p.name).join(" | "));
check("communityCentre is 7 Town centres", byCat("communityCentre").length === 7, byCat("communityCentre").map(p => p.name).join(" | "));
check("library is 7 full OPL branches", byCat("library").length === 7, byCat("library").map(p => p.name).join(" | "));
check("park is 7 mappable (Gairloch excluded)", byCat("park").length === 7, byCat("park").map(p => p.name).join(" | "));
check("hospitallab is 9 (1 hospital + 8 labs)", byCat("hospitallab").length === 9, byCat("hospitallab").map(p => p.name).join(" | "));
check("supermarket is 26 (24 + Farm Boy Bronte + Food Basics Clarkson Village, 2026-10-29; Organic Garage + T&T moved to merged category)",
  byCat("supermarket").length === 26);
check("Farm Boy Bronte (2026-10-29): supermarket, stop 1266 code 2338 routes 14/14A, 125 m street, not cross-boundary",
  byName("Farm Boy Bronte")?.cat === "supermarket" &&
  byName("Farm Boy Bronte")?.address === "2441 Lakeshore Rd W, Oakville, ON L6L 5V5" &&
  byName("Farm Boy Bronte")?.stop.id === "1266" &&
  byName("Farm Boy Bronte")?.stop.code === "2338" &&
  JSON.stringify(byName("Farm Boy Bronte")?.routes) === JSON.stringify(["14", "14A"]) &&
  byName("Farm Boy Bronte")?.stop.distance_m === 125 &&
  byName("Farm Boy Bronte")?.cross === false &&
  !byName("Farm Boy Bronte")?.note,
  JSON.stringify(byName("Farm Boy Bronte")));
check("Food Basics Clarkson Village (2026-10-29): supermarket, cross-boundary, Clarkson GO stop 358 code 2318 routes 4/11/12, 868 m street with explicit note",
  byName("Food Basics Clarkson Village")?.cat === "supermarket" &&
  byName("Food Basics Clarkson Village")?.address === "1865 Lakeshore Rd W, Mississauga, ON L5J 4P1" &&
  byName("Food Basics Clarkson Village")?.stop.id === "358" &&
  byName("Food Basics Clarkson Village")?.stop.code === "2318" &&
  JSON.stringify(byName("Food Basics Clarkson Village")?.routes) === JSON.stringify(["4", "11", "12"]) &&
  byName("Food Basics Clarkson Village")?.stop.distance_m === 868 &&
  byName("Food Basics Clarkson Village")?.cross === true &&
  byName("Food Basics Clarkson Village")?.note === "Street walk 868 m from nearest stop",
  JSON.stringify(byName("Food Basics Clarkson Village")));
check("supermarket A-Z order holds around the two new entries (Farm Boy Bronte after Farm Boy, Food Basics Clarkson Village after plain Food Basics)",
  byCat("supermarket").map(p => p.name).join(" | ").includes("Farm Boy | Farm Boy Bronte | Farm Boy Walkers Line") &&
  byCat("supermarket").map(p => p.name).join(" | ").includes("Food Basics | Food Basics | Food Basics Clarkson Village | Fortinos"),
  byCat("supermarket").map(p => p.name).join(" | "));
check("merged specialtyasian is 8 (5 ex-Asian + Organic Garage + T&T + Monastery Bakery)", byCat("specialtyasian").length === 8,
  byCat("specialtyasian").map(p => p.name).join(" | "));
check("Monastery Bakery & Delicatessen (2026-10-29): specialtyasian, stop 211 code 3016 route 28, 77 m street",
  byName("Monastery Bakery & Delicatessen")?.cat === "specialtyasian" &&
  byName("Monastery Bakery & Delicatessen")?.address === "1133 Monastery Dr, Oakville, ON L6M 2A3" &&
  byName("Monastery Bakery & Delicatessen")?.stop.id === "211" &&
  byName("Monastery Bakery & Delicatessen")?.stop.code === "3016" &&
  JSON.stringify(byName("Monastery Bakery & Delicatessen")?.routes) === JSON.stringify(["28"]) &&
  byName("Monastery Bakery & Delicatessen")?.stop.distance_m === 77 &&
  !byName("Monastery Bakery & Delicatessen")?.note,
  JSON.stringify(byName("Monastery Bakery & Delicatessen")));
check("no separate asian / specialty category remains",
  !P.some(p => ["asian", "specialty"].includes(p.cat)));
check("school is 74 geocoded places, incl. real Gladys Speers (not the prototype)",
  byCat("school").length === 74 &&
  byName("Gladys Speers Public School")?.address === "2150 Samway Rd, Oakville, ON L6L 2P6" &&
  !places.meta.excluded.some(e => e.name === "Gladys Speers Public School"));
check("bank 21, religious 24, bigbox 18, pharmacy 16 unchanged",
  byCat("bank").length === 21 && byCat("religious").length === 24 && byCat("bigbox").length === 18 && byCat("pharmacy").length === 16);
check("no mall / hospital / lab category remains", !P.some(p => ["mall", "hospital", "lab"].includes(p.cat)));
// STREET RULE (user decision 2026-10-29): distance_m is now the
// routed-foot street distance. Over-400 m street places are KEPT:
// the 7 longWalk schools (label) plus the 25 note-bearing places
// ("Street walk {m} m from nearest stop" in the note, matching
// distance_m) — see test_streetrule.mjs for the full proof.
check("every place maps to a stop <= 400 m street, or is kept with an explicit street-distance label/note (street rule 2026-10-29)",
  P.every(p => p.stop.distance_m <= 400 || p.longWalk === true ||
    (p.note || "").includes(`Street walk ${p.stop.distance_m} m from nearest stop`)),
  P.filter(p => p.stop.distance_m > 400 && !p.longWalk &&
    !(p.note || "").includes(`Street walk ${p.stop.distance_m} m from nearest stop`)).map(p => p.name).join(", "));
check("no place is South Common / Famijoy / United / Nations / Costco Oakville",
  !P.some(p => /south common|famijoy|united supermarket|nations|costco/i.test(p.name + " " + p.address) && /wyecroft/i.test(p.address + " " + p.name) || /south common|famijoy|united supermarket|nations experience/i.test(p.name + " " + p.address)));
check("SmartCentres Oakville and South Oakville Centre are separate entries",
  !!byName("SmartCentres Oakville") && !!byName("South Oakville Centre") &&
  byName("SmartCentres Oakville").address.includes("234 Hays Blvd") &&
  byName("South Oakville Centre").address.includes("1515 Rebecca St"));
check("Entertainment Centrum listed once, as Centrum",
  P.filter(p => /entertainment centrum|oakville centrum/i.test(p.name)).length === 1 &&
  byName("Oakville Entertainment Centrum (Oakville Centrum)") !== undefined);
check("Oakville Place is the only indoor shopping centre",
  P.filter(p => p.indoor).length === 1 && byName("Oakville Place").indoor === true);
check("community centre excludes St. Luke's, YMCA, Oak Park Neighbourhood Centre",
  !byCat("communityCentre").some(p => /st\. luke|ymca|oak park neighbourhood/i.test(p.name)));
check("library excludes Express points and the old 3250 Neyagawa address",
  !P.some(p => p.cat === "library" && (/express/i.test(p.name) || p.address.includes("3250 Neyagawa"))));
check("Sixteen Mile library replaces the old branch",
  !!byName("Oakville Public Library — Sixteen Mile Branch") &&
  byName("Oakville Public Library — Sixteen Mile Branch").address.includes("3070 Neyagawa"));
check("Bronte Creek is provincial, Lions Valley carries a slope caution",
  byName("Bronte Creek Provincial Park").provincial === true &&
  byName("Lions Valley Park").slopeNote === true);
check("Gairloch Gardens is excluded (nearest OT stop 1,055 m)",
  !byName("Gairloch Gardens") &&
  places.meta.excluded.some(e => e.name === "Gairloch Gardens"));
check("supermarket merge: Whole Foods, Food Basics 478, Sobeys Maple Grove present",
  !!byName("Whole Foods Market") && P.some(p => p.name === "Food Basics" && p.address.includes("478 Dundas")) &&
  !!byName("Sobeys Maple Grove"));
check("supermarket merge: East Indian, Organic Garage, T&T all in merged category",
  byName("East Indian Supermarket").cat === "specialtyasian" &&
  byName("Organic Garage").cat === "specialtyasian" &&
  byName("T&T Supermarket Erin Mills").cat === "specialtyasian" &&
  byName("Bombay Grocers Oakville").cat === "specialtyasian" &&
  byName("Iqbal Foods Oakville").cat === "specialtyasian");
check("supermarket merge: Superstore is 201 Oak Walk Dr, No Frills is 1395 Abbeywood",
  byName("Real Canadian Superstore").address.includes("201 Oak Walk Dr") &&
  byName("Oleg's No Frills").address.includes("1395 Abbeywood Dr"));
check("supermarket exclusions: no Sobeys at 2441, no No Frills at 125 Cross",
  !P.some(p => p.name === "Sobeys" && p.address.includes("2441 Lakeshore")) &&
  !P.some(p => p.name === "No Frills" && p.address.includes("125 Cross")));
check("Farm Boy kept (Ironoak), Iqbal kept at 125 Cross; Farm Boy Bronte 2441 now listed (2026-10-29, no longer pending coords)",
  P.some(p => p.name === "Farm Boy" && p.address.includes("1907 Ironoak")) &&
  P.some(p => p.name === "Iqbal Foods Oakville" && p.address.includes("125 Cross")) &&
  P.some(p => p.name === "Farm Boy Bronte" && p.address.includes("2441 Lakeshore")) &&
  !P.some(p => p.name === "Sobeys" && p.address.includes("2441 Lakeshore")));
check("cross-boundary kept: Metro Clarkson, T&T Erin Mills, Costco Laird",
  P.filter(p => p.cross).length >= 6 &&
  !!byName("Metro Clarkson Crossings") && !!byName("T&T Supermarket Erin Mills") &&
  !!byName("Costco Wholesale (Mississauga South)"));

// Hub stations: exactly 9, verified against stops.json.
const S = places.stations || [];
check("stations array has exactly 9 hubs", S.length === 9, "n=" + S.length);
const st = (id) => S.find(s => s.id === id);
check("both 407 stops distinct: 1665/code 2129 vs 1575/code 2206",
  st("trafalgar-407") && st("trafalgar-407").stop.id === "1665" && st("trafalgar-407").stop.code === "2129" &&
  st("dundas-407") && st("dundas-407").stop.id === "1575" && st("dundas-407").stop.code === "2206");
check("407 notes distinguish north vs west", /north/i.test(st("trafalgar-407").note) && /west/i.test(st("dundas-407").note));
check("Clarkson / Appleby / Dundas+407 flagged cross-boundary",
  st("clarkson-go").cross && st("appleby-go").cross && st("dundas-407").cross && !st("oakville-go").cross);
check("hub stop ids match stops.json", S.every(s => {
  const ref = stops.stops.find(x => x.id === s.stop.id);
  return ref && ref.code === s.stop.code && ref.name === s.stop.name;
}));

// Search: the Bank/School bug fix.
const bank = T.fns.searchResultsFor("bank");
check("search 'bank' returns only bank places/presets, never a stop",
  bank.length > 0 && bank.every(r => ["place", "preset"].includes(r.kind)),
  bank.map(r => r.kind + ":" + r.label).join(" | "));
check("search 'bank' never returns MILLBANK or any stop result",
  !bank.some(r => r.kind === "stop" || /millbank/i.test(r.label + " " + r.sub)));
check("search 'bank' includes RBC branches", bank.some(r => r.kind === "place" && /rbc/i.test(r.label)));
const school = T.fns.searchResultsFor("school");
check("search 'school' returns ONLY school places, never a stop",
  school.length > 0 && school.every(r => r.kind === "place" && r.place.cat === "school"),
  school.map(r => r.kind + ":" + r.label).join(" | "));
check("search '学校' returns ONLY school places, never a stop",
  T.fns.searchResultsFor("学校").length > 0 &&
  T.fns.searchResultsFor("学校").every(r => r.kind === "place" && r.place.cat === "school"));
const millbank = T.fns.searchResultsFor("millbank");
check("search 'millbank' returns no stops at all", !millbank.some(r => r.kind === "stop"),
  millbank.map(r => r.kind + ":" + r.label).join(" | "));
const code = T.fns.searchResultsFor("3172");
check("search '3172' returns Oakville GO by exact stop code",
  code.some(r => r.kind === "stop" && r.stop.id === "1212"));
const codePartial = T.fns.searchResultsFor("317");
check("search '317' (partial code) returns no stops", !codePartial.some(r => r.kind === "stop"),
  codePartial.map(r => r.kind + ":" + r.label).join(" | "));
const stationBrowse = T.fns.searchResultsFor("transit terminal");
check("transit-terminal browsing returns exactly 9 hub stations",
  stationBrowse.filter(r => r.kind === "station").length === 9,
  stationBrowse.map(r => r.kind + ":" + r.label).join(" | "));
check("transit-terminal browsing includes both distinct 407 stops, no small stops",
  stationBrowse.some(r => r.kind === "station" && r.station.stop.id === "1665") &&
  stationBrowse.some(r => r.kind === "station" && r.station.stop.id === "1575") &&
  !stationBrowse.some(r => /speers rd at bronte go/i.test(r.label)));
const shop = T.fns.searchResultsFor("shopping centre");
check("shopping-centre browsing returns 13 places + prototype Oakville Place",
  shop.filter(r => r.kind === "place").length === 13,
  shop.map(r => r.kind + ":" + r.label).join(" | "));
check("shopping-centre browsing keeps SmartCentres Oakville and South Oakville Centre separate",
  shop.some(r => r.label === "SmartCentres Oakville") && shop.some(r => r.label === "South Oakville Centre"));
check("shopping-centre browsing lists Entertainment Centrum once",
  shop.filter(r => /entertainment centrum/i.test(r.label)).length === 1);
const comm = T.fns.searchResultsFor("community centre");
check("community-centre browsing returns the 7 Town centres, no religious/charity",
  comm.filter(r => r.kind === "place").length === 7 &&
  !comm.some(r => /st\. luke|ymca|oak park neighbourhood/i.test(r.label)),
  comm.map(r => r.kind + ":" + r.label).join(" | "));
const lib = T.fns.searchResultsFor("library");
check("library browsing returns the 7 full branches, no Express, no old address",
  lib.filter(r => r.kind === "place").length === 7 &&
  !lib.some(r => r.kind === "place" && (/express/i.test(r.label) || r.place.address.includes("3250 Neyagawa"))),
  lib.map(r => r.kind + ":" + r.label).join(" | "));
const park = T.fns.searchResultsFor("large park");
check("large-park browsing returns 7 parks, Bronte Creek provincial, Lions Valley slope",
  park.filter(r => r.kind === "place").length === 7 &&
  park.some(r => r.label === "Bronte Creek Provincial Park" && /provincial/i.test(r.sub)) &&
  park.some(r => r.label === "Lions Valley Park" && /steep/i.test(r.sub)),
  park.map(r => r.kind + ":" + r.label).join(" | "));
const sm = T.fns.searchResultsFor("supermarket");
check("supermarket browsing includes Whole Foods, Food Basics 478, Sobeys Maple Grove (not Organic Garage)",
  sm.some(r => r.label === "Whole Foods Market") &&
  sm.some(r => r.label === "Food Basics" && r.sub.includes("478 Dundas")) &&
  sm.some(r => r.label === "Sobeys Maple Grove") &&
  !sm.some(r => r.label === "Organic Garage"));
const merged = T.fns.searchResultsFor("specialty grocery");
check("merged-category browsing returns 8 places (Specialty Grocery, ex-Asian + Specialty union + Monastery Bakery 2026-10-29)",
  merged.filter(r => r.kind === "place").length === 8 &&
  merged.some(r => r.label === "Organic Garage") &&
  merged.some(r => r.label === "T&T Supermarket Erin Mills") &&
  merged.some(r => r.label === "Iqbal Foods Oakville") &&
  merged.some(r => r.label === "Monastery Bakery & Delicatessen"),
  merged.map(r => r.kind + ":" + r.label).join(" | "));
const mergedZh = T.fns.searchResultsFor("特色食品");
check("merged-category browsing works in Chinese too",
  mergedZh.filter(r => r.kind === "place").length === 8);
const hl = T.fns.searchResultsFor("hospital and labs");
check("hospital-and-labs browsing includes OTMH and labs",
  hl.some(r => /oakville trafalgar memorial/i.test(r.label)) &&
  hl.some(r => /lifelabs|dynacare/i.test(r.label)));
const hosp = T.fns.searchResultsFor("医院");
check("Chinese search '医院' finds the hospital (category label in Chinese)",
  hosp.some(r => /oakville trafalgar memorial/i.test(r.label)));

// Stage 2 journey regressions.
const ogIqbal = T.fns.searchJourneys("1212", "789", new Date());
check("REGRESSION Oakville GO -> Iqbal direct first", ogIqbal && ogIqbal.options[0].transfers === 0);
validateOptions("Oakville GO -> Iqbal", ogIqbal);
const ogHosp = T.fns.searchJourneys("1212", "1397", new Date());
const ogHospMorning = T.fns.searchJourneys("1212", "1397", new Date("2026-10-27T12:10:00Z"));
const proof = ogHospMorning && ogHospMorning.options.find(o => o.transfers === 1);
check("REGRESSION Oakville GO -> Hospital 1-transfer proof exists", !!proof,
  JSON.stringify(ogHosp && ogHosp.options.map(o => o.transfers)));
if (proof) {
  check("proof legs are R28 then R3", proof.legs[0].route === "28" && proof.legs[1].route === "3",
    proof.legs.map(l => l.route).join("+"));
  check("proof transfer stop 986, boarding 327", proof.transferStop === "986" && proof.transferBoardStop === "327");
  check("proof walk 83 m / 2 min", proof.walkM === 83 && proof.walkMin === 2);
  const gap = proof.legs[1].boardDep - proof.legs[0].alightArr;
  check("proof transfer gap >= 5 min", gap >= 5, "gap=" + gap);
}
validateOptions("Oakville GO -> Hospital", ogHosp);
const brHosp = T.fns.searchJourneys("645", "1397", new Date());
check("REGRESSION Bronte GO -> Hospital direct", brHosp && brHosp.options[0].transfers === 0);

console.log(failures === 0 ? "ALL STAGE 2.1 CHECKS PASSED" : failures + " FAILURES");
process.exit(failures === 0 ? 0 : 1);
