// Sort-toggle harness (2026-10-29, user decision: four modes — total
// time (default), fewest transfers, least walking, earliest arrival).
// Proves via the real public/index.html script in a stub-DOM VM:
// (a) each mode orders a known trade-off fixture as defined, with
//     tie-breakers and the direct-preservation rule (direct replaces
//     the last slot, never the first; at most 3 rows);
// (b) sortMode defaults to "total" on load (fresh VM) and is in-memory
//     only (no localStorage write mentions sortMode; swapNav never
//     assigns sortMode, so it survives swap — reload resets it because
//     the module-level initialiser runs again);
// (c) switching modes via the sort-row buttons reorders without
//     re-running a search (no runNavSearch call) and without changing
//     any option's times, and makes the new first option the main card;
// (d) a direct option is never hidden under any mode;
// (e) all 22 languages have non-empty labels for all 5 sort keys.
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
    _attrs: {}, setAttribute(k, v) { this._attrs[k] = v; },
    getAttribute(k) { return this._attrs[k]; },
    children: [], appendChild(c) { this.children.push(c); return c; },
    style: {} };
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
const sandbox = {
  console, localStorage,
  navigator: { geolocation: {} },
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
let renderCalls = 0, searchCalls = 0;
vm.runInContext(script + `
globalThis.__t = {
  sortMode: () => sortMode,
  setSortMode: (m) => { sortMode = m; },
  applySort: (pool, mode, tm, d) => applySortToPool(pool, mode, tm, d),
  applyBoardSort: (j) => applyBoardSort(j),
  renderSortRow: (j) => renderSortRow(j),
  setJourneyState: (j) => { journeyState = j; },
  journey: () => journeyState,
  pick: (l) => pickLanguage(l), t: (k) => t(k),
  setLang: (l) => { lang = l; },
  i18n: () => I18N,
};
renderJourneyBoard = () => { globalThis.__renderCalls = (globalThis.__renderCalls || 0) + 1; };
runNavSearch = () => { globalThis.__searchCalls = (globalThis.__searchCalls || 0) + 1; return true; };
`, sandbox);
const T = sandbox.__t;
let failures = 0;
function check(name, cond, extra = "") {
  console.log((cond ? "PASS" : "FAIL") + " " + name + (cond ? "" : " " + extra));
  if (!cond) failures++;
}
const leg = (boardDep, alightArr) => ({ boardDep, alightArr });
const opt = (id, transfers, totalMin, scoreMin, walkTotalMin, boardDep, alightArr, destWalkMin) =>
  ({ id, transfers, totalMin, scoreMin, walkTotalMin, destWalkMin,
     legs: [leg(boardDep, alightArr)] });
// Known trade-offs: A fast 2-transfer, B direct but slow, C 1-transfer
// low-walk, D 1-transfer mid. Total ranking: A(25, arr 500), D(25, arr
// 505), C(30), B(50). Direct B is 4th by total time.
const A = opt("A", 2, 20, 25, 12, 480, 500, 5);
const B = opt("B", 0, 50, 50, 8, 470, 515, 5);
const C = opt("C", 1, 30, 30, 4, 490, 515, 2);
const D = opt("D", 1, 25, 25, 20, 485, 505, 3);
const pool = [A, D, C, B]; // already in total-time order
const ids = (list) => list.map(o => o.id).join(",");
const timesUnchanged = (list) => list.every(o =>
  (o.id === "A" && o.totalMin === 20 && o.walkTotalMin === 12) ||
  (o.id === "B" && o.totalMin === 50 && o.walkTotalMin === 8) ||
  (o.id === "C" && o.totalMin === 30 && o.walkTotalMin === 4) ||
  (o.id === "D" && o.totalMin === 25 && o.walkTotalMin === 20));

// (b) default on load
check("(b) sortMode defaults to total on load", T.sortMode() === "total", T.sortMode());

// (a) total: scoreMin, then alightArr, then transfers; direct swapped in
check("(a) total order is A,D,B (direct swapped into last slot)",
  ids(T.applySort(pool, "total", "now", 0)) === "A,D,B",
  ids(T.applySort(pool, "total", "now", 0)));
check("(a) total shows at most 3 rows", T.applySort(pool, "total", "now", 0).length === 3);
// (a) transfers: transfers asc, then totalMin
check("(a) transfers order is B,D,C",
  ids(T.applySort(pool, "transfers", "now", 0)) === "B,D,C",
  ids(T.applySort(pool, "transfers", "now", 0)));
// (a) walk: walkTotalMin asc, then totalMin
check("(a) walk order is C,B,A",
  ids(T.applySort(pool, "walk", "now", 0)) === "C,B,A",
  ids(T.applySort(pool, "walk", "now", 0)));
// (a) arrival: door arrival (dayOffset*1440 + alightArr + destWalkMin) asc
check("(a) arrival order is A,D,B (door 505,508,520; direct swapped in)",
  ids(T.applySort(pool, "arrival", "now", 0)) === "A,D,B",
  ids(T.applySort(pool, "arrival", "now", 0)));
// (a) arrive-mode total keeps the native latest-first ranking
check("(a) arrive total keeps latest-first ranking C,B,D",
  ids(T.applySort(pool, "total", "arrive", 0)) === "C,B,D",
  ids(T.applySort(pool, "total", "arrive", 0)));
// (a) arrive-mode earliest arrival still applies (reverse of native)
check("(a) arrive earliest-arrival order is A,D,B",
  ids(T.applySort(pool, "arrival", "arrive", 0)) === "A,D,B",
  ids(T.applySort(pool, "arrival", "arrive", 0)));
// (a) tie-break: same transfers + same totalMin keeps insertion order
// (stable sort) — D and a twin with equal keys stay in pool order.
const twin = opt("T", 1, 25, 25, 20, 485, 505, 3);
check("(a) equal-key options keep pool order (stable)",
  ids(T.applySort([D, twin], "transfers", "now", 0)) === "D,T");

// (d) direct never hidden under any mode
for (const mode of ["total", "transfers", "walk", "arrival"])
  check("(d) direct present under " + mode,
    T.applySort(pool, mode, "now", 0).some(o => o.transfers === 0));
// (c) switching never changes an option's times
for (const mode of ["total", "transfers", "walk", "arrival"])
  check("(c) times unchanged under " + mode, timesUnchanged(T.applySort(pool, mode, "now", 0)));

// (c) sort-row buttons: labels visible, current mode pressed, tap
// reorders + resets selection to the new first option, no new search.
T.setJourneyState({ options: T.applySort(pool, "total", "now", 0),
  allOptions: pool, selected: 1, dayOffset: 0, timeMode: { mode: "now" } });
T.setSortMode("total");
T.renderSortRow(T.journey());
const row = getEl("sortRow");
check("(c) sort row visible with label + 4 buttons",
  !row.hidden && row.children.length === 5, "children=" + row.children.length);
check("(c) sort label is non-empty", !!row.children[0].textContent);
const btns = row.children.slice(1);
check("(c) four mode buttons labelled",
  btns.map(b => b.textContent).every(s => !!s) && btns.length === 4,
  btns.map(b => b.textContent).join(" | "));
check("(c) total button pressed, others not",
  btns[0].getAttribute("aria-pressed") === "true" &&
  btns.slice(1).every(b => b.getAttribute("aria-pressed") === "false"));
sandbox.__searchCalls = 0; sandbox.__renderCalls = 0;
const walkBtn = btns.find(b => b.textContent === T.t("sortWalk")) || btns[2];
walkBtn.onclick();
check("(c) tapping walk sets sortMode=walk", T.sortMode() === "walk", T.sortMode());
check("(c) tapping walk reorders to C,B,A with selected=0",
  ids(T.journey().options) === "C,B,A" && T.journey().selected === 0,
  ids(T.journey().options) + " sel=" + T.journey().selected);
check("(c) tapping walk does not re-run a search", (sandbox.__searchCalls || 0) === 0);
check("(c) tapping walk re-renders the board", (sandbox.__renderCalls || 0) === 1);

// Selection preservation on automatic re-render: pick the 2nd option,
// re-apply the board sort, and it must stay selected by identity.
T.setSortMode("walk");
const j = T.journey();
j.selected = 1; // B in C,B,A
T.applyBoardSort(j);
check("(c) re-render preserves selected option by identity",
  j.selected === 1 && j.options[1].id === "B", "sel=" + j.selected);
// Selection fallback: selected option falls out of the top 3 under a
// new sort -> selection resets to the new first row.
T.setSortMode("arrival");
const j2 = { options: T.applySort(pool, "walk", "now", 0), allOptions: pool,
  selected: 0, dayOffset: 0, timeMode: { mode: "now" } }; // C first
T.applyBoardSort(j2); // arrival top = A,D,B; C falls out
check("(c) fallen-out selection falls back to new first row",
  j2.selected === 0 && j2.options[0].id === "A",
  "sel=" + j2.selected + " first=" + (j2.options[0] && j2.options[0].id));
// No-pool fallback: state built without allOptions still sorts in place.
const j3 = { options: [B, A], selected: 0, dayOffset: 0, timeMode: { mode: "now" } };
T.setSortMode("transfers");
T.applyBoardSort(j3);
check("(c) no-pool state still sorts in place (B first, direct kept)",
  ids(j3.options) === "B,A", ids(j3.options));

// (b) state rules, statically: sortMode is never written to storage and
// swapNav never assigns it (reload resets it via the initialiser).
check("(b) no localStorage write mentions sortMode",
  !/localStorage\.setItem\([^)]*sort/i.test(script) && !/obt_nav[^;]*sortMode/.test(script));
const swapSrc = script.slice(script.indexOf("function swapNav()"), script.indexOf("function navFieldText"));
check("(b) swapNav never assigns sortMode (sort survives swap)",
  !/sortMode\s*=/.test(swapSrc));
// (e) all 22 languages, all 5 keys, non-empty
const ORDER = ["en","fr","zh","ar","es","ur","pt","pl","it","pa","ko","hi","tl","hr","ru","zh-Hant","fa","sr","de","ro","uk","ja"];
const SKEYS = ["sortLabel","sortTotal","sortTransfers","sortWalk","sortArrival"];
// NOTE: check I18N directly, NOT via t() — t() falls back to English
// and would pass vacuously for a language missing the key (this caught
// a real bug: I18N_LANG22 wholesale-replaces 6 packs, so a sort block
// merged before it loses those languages' keys).
let missing = [];
const I18Nall = T.i18n();
for (const l of ORDER) {
  for (const k of SKEYS) { const v = I18Nall[l] && I18Nall[l][k]; if (typeof v !== "string" || !v.trim()) missing.push(l + ":" + k); }
}
check("(e) 5 sort keys non-empty in all 22 languages", missing.length === 0, missing.join(","));
check("(e) sort labels differ per mode in English",
  new Set(SKEYS.slice(1).map(k => T.i18n().en[k])).size === 4);

if (failures) { console.log(failures + " FAILURES"); process.exit(1); }
console.log("ALL SORT CHECKS PASSED");
