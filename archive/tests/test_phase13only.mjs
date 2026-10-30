// Phase 1+3-ONLY deploy build harness (2026-10-29, user decision option A).
// Phase 2 (OSM street walking) is DISABLED via the single flag
// STREET_WALK_ENABLED = false in public/index.html, with its code
// preserved dormant. This harness proves: zero OSRM requests, the
// Oakville GO -> Hospital proof journey is stable across a simulated
// upgrade pass, and the Phase 1+3 proof journeys still hold.
// Runs the real public/index.html inline script in Node with a stub
// DOM + stub localStorage/fetch. No live network: any OSRM URL fetch
// is counted (and answered with an empty route list) — the count
// itself is the failure signal.
import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, "..", "..", "public", "index.html"), "utf8");
// SUPERSEDED 2026-10-29 (routed-foot fix): Phase 2 is re-enabled, so the
// Phase 1+3-only assertions (flag false, zero routing requests) cannot
// pass by design. Skip with exit 0; test_osmwalk.mjs is now the live
// Phase 2 harness. If the flag ever flips back to false, remove this
// skip to restore the 1+3-only checks.
if (/const STREET_WALK_ENABLED = true;/.test(html)) {
  console.log("SKIPPED: STREET_WALK_ENABLED is true (Phase 2 re-enabled via routed-foot) — "
    + "Phase 1+3-only assertions superseded; see test_osmwalk.mjs");
  process.exit(0);
}
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
let osrmCalls = 0;
const fetchedUrls = [];
const sandbox = {
  console, localStorage,
  navigator: { geolocation: { getCurrentPosition(ok) {
    ok({ coords: { latitude: 43.4558, longitude: -79.6824 } }); } } },
  setInterval: () => 0, clearInterval: () => {},
  fetch: async (url) => {
    const u = String(url);
    fetchedUrls.push(u);
    if (u.includes("routing.openstreetmap.de/routed-foot")) { osrmCalls++; return { json: async () => ({ routes: [], code: "Ok" }) }; }
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
  fns: { searchJourneys, resolveWalk, streetWalkPut, streetWalkReset,
    fetchStreetWalk, upgradeDisplayedWalks, transferStopsOf,
    buildJourneyMapData, setShapeData, renderJourneyBoard, stopNameOf,
    setJourneyState: (j) => { journeyState = j; } },
};
`, sandbox);
const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 60 && !sandbox.__t.journey(); i++) await tick();
await tick(200);
const T = sandbox.__t;
const el = (id) => getEl(id);
let failures = 0;
function check(name, cond, extra = "") {
  console.log((cond ? "PASS" : "FAIL") + " " + name + (cond ? "" : " " + extra));
  if (!cond) failures++;
}
const fmt = (m) => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(Math.floor(m % 60)).padStart(2, "0");
const ranked = (o, d, now, tm, destEndpoint) =>
  T.fns.searchJourneys(o, d, now, null,
    { rank: "total", timeMode: tm || { mode: "now" }, originWalkMin: 0, destEndpoint: destEndpoint || null });
const tueMorning = new Date("2026-10-27T12:10:00Z"); // Tue 2026-10-27 08:10 EDT
const tueEvening = new Date("2026-10-27T22:00:00Z"); // Tue 2026-10-27 18:00 EDT

// (c) The flag is a single constant, and every OSRM code path is gated by it.
const flagMatches = html.match(/const STREET_WALK_ENABLED = false;/g) || [];
check("(c) single flag STREET_WALK_ENABLED = false appears exactly once",
  flagMatches.length === 1, "matches=" + flagMatches.length);
check("(c) resolveWalk gated: flag-off returns straight before any cache lookup",
  html.includes("if (!STREET_WALK_ENABLED) return { m: straight"));
check("(c) fetchStreetWalk gated: flag-off returns null before any fetch",
  html.includes("async function fetchStreetWalk(a, b) {\n  // Phase 2 dormant: never issue an OSRM request in this build.\n  if (!STREET_WALK_ENABLED) return null;"));
check("(c) upgradeDisplayedWalks gated: flag-off returns false immediately",
  html.includes("async function upgradeDisplayedWalks() {\n  // Phase 2 dormant: no upgrade pass runs at all in this build, so a\n  // rendered journey can never change or disappear on re-render.\n  if (!STREET_WALK_ENABLED) return false;"));
const osrmBaseUses = (html.match(/OSRM_BASE/g) || []).length;
check("(c) OSRM_BASE is referenced only in its definition and the gated fetch (2 uses)",
  osrmBaseUses === 2, "uses=" + osrmBaseUses);
check("(c) walk-estimate note is gated on the flag (never shown when dormant)",
  html.includes("const anyEstimate = STREET_WALK_ENABLED &&"));

// (a) Zero OSRM fetches during a full journey render + re-render.
osrmCalls = 0;
const up1 = await T.fns.upgradeDisplayedWalks();
check("(a) upgradeDisplayedWalks() is a no-op when dormant (returns false)",
  up1 === false);
check("(a) zero OSRM fetches from the upgrade pass", osrmCalls === 0, "calls=" + osrmCalls);
const directFetch = await T.fns.fetchStreetWalk([43.4341, -79.7393], [43.434373, -79.738342]);
check("(a) direct fetchStreetWalk returns null when dormant", directFetch === null);
check("(a) zero OSRM fetches from a direct fetch call", osrmCalls === 0, "calls=" + osrmCalls);
// Even a poisoned street cache cannot change a walk when dormant.
T.fns.streetWalkPut([43.4341, -79.7393], [43.434373, -79.738342], { m: 822, geometry: [[43.4341, -79.7393], [43.434373, -79.738342]] });
const rwPoisoned = T.fns.resolveWalk([43.4341, -79.7393], [43.434373, -79.738342]);
check("(a) poisoned street cache is ignored when dormant: 986->327 stays straight 83 m",
  rwPoisoned.source === "straight" && rwPoisoned.m === 83 && rwPoisoned.geometry === null,
  JSON.stringify(rwPoisoned));
T.fns.streetWalkReset();

// (b) GO -> Hospital proof journey is stable across a simulated upgrade pass.
const legacyProof = T.fns.searchJourneys("1212", "1397", tueMorning);
const proofOpt = legacyProof && legacyProof.options.find((o) => o.transfers === 1);
check("(b) GO->Hospital legacy proof exists: 1 transfer", !!proofOpt,
  JSON.stringify(legacyProof && legacyProof.options.map((o) => o.transfers)));
if (proofOpt) {
  check("(b) proof legs are R28 then R3",
    proofOpt.legs[0].route === "28" && proofOpt.legs[1].route === "3",
    proofOpt.legs.map((l) => l.route).join("+"));
  check("(b) proof transfer is 986 -> 327",
    proofOpt.transferStop === "986" && proofOpt.transferBoardStop === "327",
    `transferStop=${proofOpt.transferStop} board=${proofOpt.transferBoardStop}`);
  check("(b) proof walk is 83 m / 2 min (straight-line, not OSRM 822 m)",
    proofOpt.walkM === 83 && proofOpt.walkMin === 2,
    `walkM=${proofOpt.walkM} walkMin=${proofOpt.walkMin}`);
}
const rankedBefore = ranked("1212", "1397", tueMorning);
const snapshotBefore = JSON.stringify(rankedBefore && rankedBefore.options);
const up2 = await T.fns.upgradeDisplayedWalks();
await tick(100);
const rankedAfter = ranked("1212", "1397", tueMorning);
check("(b) ranked GO->Hospital options are identical before and after the upgrade pass",
  snapshotBefore === JSON.stringify(rankedAfter && rankedAfter.options) && up2 === false,
  "before=" + snapshotBefore + " after=" + JSON.stringify(rankedAfter && rankedAfter.options));
check("(b) still zero OSRM fetches after render + re-render", osrmCalls === 0, "calls=" + osrmCalls);
// Board render must not show the walk-estimate note when dormant.
if (rankedBefore) {
  T.fns.setJourneyState({ o: "1212", d: "1397", labelO: "Oakville GO",
    labelD: "Hospital", options: rankedBefore.options, selected: 0,
    dayOffset: 0, dayDate: "2026-10-27", timeMode: { mode: "now" },
    isToday: true, originWalkM: 0, originWalkMin: 0, boarding: null });
  T.fns.renderJourneyBoard();
  await tick(100);
  const anyEstimateText = [...els.values()].some((e) =>
    (e.textContent || "").includes("street route has not loaded yet"));
  check("(b) rendered board shows no walk-estimate note when dormant", !anyEstimateText);
  check("(b) board render issues zero OSRM fetches", osrmCalls === 0, "calls=" + osrmCalls);
  // Map dashed walk uses a straight line when dormant.
  for (const r of [...new Set(rankedBefore.options[0].legs.map((l) => l.route))]) T.fns.setShapeData(r, shapeFile(r));
  const gmap = T.fns.buildJourneyMapData(rankedBefore.options[0]);
  const walkSegs = (gmap && gmap.walks) || [];
  check("(b) map walking segments are straight lines (geometry null) when dormant",
    walkSegs.every((w) => w.geometry === null), JSON.stringify(walkSegs));
}

// Phase 1+3 spot checks (unchanged behaviour, flag-off).
const proof2 = ranked("1293", "562", tueMorning);
check("Phase 1+3: Uptown Core -> Bristol Circle 2-transfer proof still holds",
  !!proof2 && proof2.options[0].transfers === 2 && proof2.options[0].legs.length === 3 &&
  proof2.options[0].legs[0].route === "1" && proof2.options[0].legs[1].route === "120" &&
  proof2.options[0].legs[2].route === "12" &&
  Math.round(proof2.options[0].legs[2].alightArr) === 558,
  JSON.stringify(proof2 && proof2.options[0].legs.map((l) => l.route + " " + fmt(l.boardDep) + "->" + fmt(l.alightArr))));
const ranking = ranked("1293", "1191", tueEvening);
const directOpt = ranking && ranking.options.find((o) => o.transfers === 0);
check("Phase 1+3: Uptown Core -> River Oaks 2-transfer ranks first, direct still present",
  !!ranking && ranking.options[0].transfers === 2 && ranking.options[0].totalMin === 20 &&
  ranking.options[0].scoreMin === 25 && !!directOpt && directOpt.totalMin === 50,
  JSON.stringify(ranking && ranking.options.map((o) => [o.transfers, o.totalMin, o.scoreMin])));
const depart = ranked("1293", "562", tueMorning,
  { mode: "depart", dateStr: "20261027", display: "2026-10-27", timeMin: 490 });
check("Phase 1+3: Depart-at returns journeys departing at/after the chosen time",
  !!depart && depart.options.every((o) => o.legs[0].boardDep >= 490),
  JSON.stringify(depart && depart.options.map((o) => fmt(o.legs[0].boardDep))));
const arrive = ranked("1293", "562", tueMorning,
  { mode: "arrive", dateStr: "20261027", display: "2026-10-27", timeMin: 570 });
check("Phase 1+3: Arrive-by returns journeys arriving by the deadline",
  !!arrive && arrive.options.every((o) => o.legs[o.legs.length - 1].alightArr <= 570),
  JSON.stringify(arrive && arrive.options.map((o) => fmt(o.legs[o.legs.length - 1].alightArr))));

console.log(failures === 0 ? "ALL PHASE 1+3-ONLY TESTS PASSED" : failures + " TEST(S) FAILED");
process.exit(failures === 0 ? 0 : 1);
