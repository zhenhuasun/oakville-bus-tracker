// Search/time fix batch harness (2026-10-29, user decisions): proves
// (a) in searchScreen and pickerScreen the results container is the next
//     element after the search input (no category row between);
// (b) picker typing renders local results SYNCHRONOUSLY on input (no
//     400 ms wait for local rows) while the address lookup stays
//     debounced (address group created empty, filled only by refresh);
// (c) search-screen saved rows have Rename + two-tap Delete, and
//     rename/delete update the homepage grid AND the search list AND
//     the picker saved list in the same pass;
// (d) no pickerLocExplain element or assignment in the picker screens,
//     while the locExplain key and the standalone location screen keep it;
// (e) Depart(future time) -> Arrive applies Arrive at the SAME date+time
//     immediately (panel stays open), and Arrive -> Depart the same way,
//     while Leave-now -> Depart/Arrive still only prefills today + now;
//     the Arrive -> Depart past-time edge clamps Depart to now.
// Runs the real public/index.html inline script in Node with a stub DOM.
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
function loadVM(store0) {
  const els = new Map();
  function getEl(id) { if (!els.has(id)) els.set(id, makeEl(id)); return els.get(id); }
  const store = new Map(store0 || []);
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
  vm.runInContext(script + `\nglobalThis.__t = {
  nav: () => ({ origin: navOrigin, dest: navDest }),
  timeMode: () => timeMode,
  timeDraft: () => timeDraftMode,
  saved: () => savedPlaces.map(p => ({ ...p })),
  i18n: () => I18N,
  fns: { render, renderNavFields, renderSaved, renderTimeControls,
    openSearch, openPicker, renderPickerResults, renderSearchSaved,
    renderPickerSaved, addSavedPlace, renameSaved, requestDelete,
    confirmDelete, refreshSavedLists, refreshPickerAddressResults, pickLanguage },
};\n`, sandbox);
  return { T: sandbox.__t, el: getEl, store };
}
const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
function check(name, cond, extra = "") {
  console.log((cond ? "PASS" : "FAIL") + " " + name + (cond ? "" : " " + extra));
  if (!cond) failures++;
}
function torontoNow() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit",
    minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const g = (t) => parts.find(p => p.type === t).value;
  return { display: `${g("year")}-${g("month")}-${g("day")}`,
    minutes: (+g("hour")) * 60 + (+g("minute")) };
}
const fmtMin = (m) => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
const closeMin = (clockStr, minutes) => {
  const [h, m] = String(clockStr).split(":").map(Number);
  return Math.abs((h * 60 + m) - minutes) <= 2;
};
const tomorrowDisplay = (() => {
  const d = new Date(torontoNow().display + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto",
    year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
})();

// (a) DOM order in both screens: input, then results, then categories, then saved.
const searchBlock = html.slice(html.indexOf('id="searchScreen"'), html.indexOf('id="pickerScreen"'));
const pickerBlock = html.slice(html.indexOf('id="pickerScreen"'), html.indexOf('id="locationScreen"'));
check("(a) searchScreen: input, then results, then categories, then saved",
  searchBlock.indexOf('id="searchInput"') < searchBlock.indexOf('id="searchResults"') &&
  searchBlock.indexOf('id="searchResults"') < searchBlock.indexOf('id="searchCats"') &&
  searchBlock.indexOf('id="searchCats"') < searchBlock.indexOf('id="searchSaved"'),
  "order: input@" + searchBlock.indexOf('id="searchInput"') + " results@" +
  searchBlock.indexOf('id="searchResults"') + " cats@" + searchBlock.indexOf('id="searchCats"') +
  " saved@" + searchBlock.indexOf('id="searchSaved"'));
check("(a) pickerScreen: location buttons above input; input, then results, then categories, then saved",
  pickerBlock.indexOf('id="pickerLocBtn"') < pickerBlock.indexOf('id="pickerInput"') &&
  pickerBlock.indexOf('id="pickerInput"') < pickerBlock.indexOf('id="pickerResults"') &&
  pickerBlock.indexOf('id="pickerResults"') < pickerBlock.indexOf('id="pickerCats"') &&
  pickerBlock.indexOf('id="pickerCats"') < pickerBlock.indexOf('id="pickerSaved"'));

// (d) pickerLocExplain gone from the picker only; locExplain survives elsewhere.
check("(d) no pickerLocExplain element or assignment anywhere in the page",
  !html.includes("pickerLocExplain"));
check("(d) standalone location screen element still present",
  html.includes('id="locExplain"') && html.includes('id="locationScreen"'));

const { T, el } = loadVM();
for (let i = 0; i < 80 && !T.i18n(); i++) await tick();
await tick(300);
T.fns.pickLanguage("en");
check("(d) locExplain i18n key still present in all languages",
  ["en", "fr", "zh", "ar", "hi"].every(l => "locExplain" in T.i18n()[l]));
check("(d) footer privacy key still present",
  ["en", "fr", "zh", "ar", "hi"].every(l => "footerPrivacy" in T.i18n()[l]));

// (b) Picker typing: local rows synchronously, address group empty until refresh.
T.fns.openPicker("dest");
const pInp = el("pickerInput");
pInp.value = "Iqbal";
pInp.oninput(); // must render local rows NOW, with no timer wait
const pRows = el("pickerResults").children.filter(c => c.className === "result");
const pLabels = pRows.map(r => (r.children.find(c => c.className === "main") || {}).textContent || "");
check("(b) picker typing renders local rows synchronously on input",
  pLabels.some(l => l.includes("Iqbal")), JSON.stringify(pLabels));
check("(b) picker shows NO address group right after typing (lookup still debounced)",
  !el("pickerResults").children.some(c => c.textContent === "Address results"),
  JSON.stringify(el("pickerResults").children.map(c => c.textContent)));
// The debounced refresh is what starts the lookup: in this stub the
// Nominatim fetch is unreachable, so the refresh must produce the
// "address search unavailable" note (proving the lookup ran via refresh,
// not via the synchronous typing path).
T.fns.refreshPickerAddressResults("Iqbal");
await tick(200);
check("(b) debounced refresh runs the address lookup (unavailable note appears in stub)",
  el("pickerResults").children.some(c => (c.textContent || "").toLowerCase().includes("unavailable")),
  JSON.stringify(el("pickerResults").children.map(c => c.textContent)));
// Main search screen: same immediacy, address group first under the input.
T.fns.openSearch();
const sInp = el("searchInput");
sInp.value = "Iqbal";
sInp.oninput();
const sBox = el("searchResults");
const sRows = sBox.children.filter(c => c.className === "result");
const sLabels = sRows.map(r => (r.children.find(c => c.className === "main") || {}).textContent || "");
check("(b) main search typing renders local rows synchronously on input",
  sLabels.some(l => l.includes("Iqbal")), JSON.stringify(sLabels));
check("(b) main search address group is the FIRST child under the input",
  sBox.children.length > 0 && sBox.children[0].className === "addrgroup",
  JSON.stringify({ first: sBox.children[0] && sBox.children[0].className }));

// (c) Search-screen saved rows: Rename + two-tap Delete, all lists in sync.
const iqbal = places.places.find(p => p.name === "Iqbal Foods Oakville");
const hospital = places.places.find(p => p.name === "Oakville Trafalgar Memorial Hospital");
T.fns.addSavedPlace({ key: "place:" + iqbal.id, custom: "My Iqbal", kind: "place",
  destId: null, stopId: iqbal.stop.id, stopName: iqbal.stop.name,
  stopCode: iqbal.stop.code, address: iqbal.address, enName: iqbal.name,
  lat: iqbal.lat, lon: iqbal.lon });
T.fns.addSavedPlace({ key: "place:" + hospital.id, custom: "My Hospital", kind: "place",
  destId: null, stopId: hospital.stop.id, stopName: hospital.stop.name,
  stopCode: hospital.stop.code, address: hospital.address, enName: hospital.name,
  lat: hospital.lat, lon: hospital.lon });
T.fns.openSearch();
let sSaved = el("searchSaved").children.filter(c => c.className === "result");
check("(c) search-screen saved rows exist",
  sSaved.length === 2, `rows=${sSaved.length}`);
const sBtns = sSaved[0].children.filter(c => c.textContent).map(c => c.textContent);
check("(c) search saved row has a fill button, Rename and Delete",
  sBtns.includes("My Iqbal") && sBtns.includes("Rename") && sBtns.includes("Delete"),
  sBtns.join(" | "));
sSaved[0].children.find(c => c.textContent === "My Iqbal").onclick();
check("(c) tapping the saved name still fills the destination and closes search",
  T.nav().dest && T.nav().dest.label === "My Iqbal" && el("searchScreen").hidden === true,
  JSON.stringify({ dest: T.nav().dest && T.nav().dest.label, hidden: el("searchScreen").hidden }));
T.fns.openSearch();
sSaved = el("searchSaved").children.filter(c => c.className === "result");
sSaved[0].children.find(c => c.textContent === "Rename").onclick();
sSaved = el("searchSaved").children.filter(c => c.className === "result");
const sRenameInp = sSaved[0].children.find(c => c.id === "searchRenameInput");
check("(c) Rename opens a search-screen rename input prefilled with the name",
  !!sRenameInp && sRenameInp.value === "My Iqbal",
  JSON.stringify({ id: sRenameInp && sRenameInp.id, value: sRenameInp && sRenameInp.value }));
// (Stub DOMs cannot resolve a dynamically created input by id, so the
// Save click itself is exercised via the shared renameSaved function,
// exactly as the homepage rename is tested in test_homefix.mjs.)
T.fns.renameSaved("place:" + iqbal.id, "Renamed Iqbal");
const homeName = el("savedgrid").children
  .map(c => (c.children.find(x => x.className === "name") || {}).textContent);
const searchName = el("searchSaved").children
  .map(c => (c.children.find(x => x.className === "main") || {}).textContent);
const pickerName = el("pickerSaved").children.map(c => c.textContent);
check("(c) rename updates homepage grid AND search list AND picker saved list",
  homeName.includes("Renamed Iqbal") && searchName.includes("Renamed Iqbal") &&
  pickerName.includes("Renamed Iqbal"),
  JSON.stringify({ home: homeName, search: searchName, picker: pickerName }));
// Two-tap delete from the search list.
sSaved = el("searchSaved").children.filter(c => c.className === "result");
const delBtn = sSaved[1].children.find(c => c.textContent === "Delete");
delBtn.onclick(); // first tap arms
sSaved = el("searchSaved").children.filter(c => c.className === "result");
check("(c) first Delete tap arms (button becomes Confirm delete)",
  sSaved[1].children.some(c => (c.textContent || "").toLowerCase().includes("confirm")),
  JSON.stringify(sSaved[1].children.map(c => c.textContent)));
sSaved[1].children.find(c => (c.textContent || "").toLowerCase().includes("confirm")).onclick();
check("(c) second Delete tap deletes from all three lists",
  T.saved().length === 1 &&
  !el("savedgrid").children.map(c => (c.children.find(x => x.className === "name") || {}).textContent).includes("My Hospital") &&
  !el("searchSaved").children.map(c => (c.children.find(x => x.className === "main") || {}).textContent).includes("My Hospital") &&
  !el("pickerSaved").children.map(c => c.textContent).includes("My Hospital"),
  JSON.stringify({ saved: T.saved().map(p => p.custom) }));

// (e) Depart <-> Arrive carry-over.
T.fns.renderTimeControls();
el("timePanel").hidden = true;
el("timeBtn").onclick();
el("timeModeDepart").onclick();
const today = torontoNow();
check("(e) Leave-now -> Depart still only prefills today + now",
  el("timeDate").value === today.display && closeMin(el("timeClock").value, today.minutes),
  JSON.stringify({ date: el("timeDate").value, clock: el("timeClock").value }));
el("timeDate").value = tomorrowDisplay; el("timeClock").value = "09:00";
el("timeDate").onchange();
check("(e) Depart tomorrow 09:00 applied",
  T.timeMode().mode === "depart" && T.timeMode().display === tomorrowDisplay &&
  T.timeMode().timeMin === 540, JSON.stringify(T.timeMode()));
el("timeModeArrive").onclick();
check("(e) Depart -> Arrive switches DIRECTLY to Arrive at the SAME tomorrow 09:00, applied immediately, panel open",
  T.timeMode().mode === "arrive" && T.timeMode().display === tomorrowDisplay &&
  T.timeMode().timeMin === 540 && el("timePanel").hidden === false &&
  el("timeInputs").hidden === false && el("timeDate").value === tomorrowDisplay &&
  el("timeClock").value === "09:00",
  JSON.stringify({ mode: T.timeMode(), date: el("timeDate").value, clock: el("timeClock").value }));
el("timeModeDepart").onclick();
check("(e) Arrive -> Depart switches DIRECTLY to Depart at the SAME tomorrow 09:00",
  T.timeMode().mode === "depart" && T.timeMode().display === tomorrowDisplay &&
  T.timeMode().timeMin === 540 && el("timeDate").value === tomorrowDisplay &&
  el("timeClock").value === "09:00",
  JSON.stringify({ mode: T.timeMode() }));
// Past-time edge: Arrive today at 00:01, then Depart must clamp to now.
el("timeModeArrive").onclick(); // depart tomorrow 09:00 -> arrive tomorrow 09:00
el("timeDate").value = today.display; el("timeClock").value = "00:01";
el("timeClock").onchange();
check("(e) Arrive today 00:01 applied",
  T.timeMode().mode === "arrive" && T.timeMode().display === today.display &&
  T.timeMode().timeMin === 1, JSON.stringify(T.timeMode()));
el("timeModeDepart").onclick();
const now2 = torontoNow();
check("(e) Arrive(past today) -> Depart clamps to now (existing past-departure rule)",
  T.timeMode().mode === "depart" && T.timeMode().display === today.display &&
  closeMin(fmtMin(T.timeMode().timeMin), now2.minutes),
  JSON.stringify({ mode: T.timeMode(), now: now2 }));

console.log(failures === 0 ? "ALL SEARCHTIME TESTS PASSED" : failures + " TEST(S) FAILED");
process.exit(failures === 0 ? 0 : 1);
