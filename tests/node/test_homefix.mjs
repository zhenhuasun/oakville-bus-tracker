// Homepage fix batch harness (2026-10-29, user decisions): proves
// (a) load starts EMPTY (both fields blank, swap disabled, choose
// prompt, no fallback pair trip, no obt_nav restore);
// (b) Depart/Arrive switch freely — UPDATED 2026-10-29 (carry-over):
// tapping Arrive after a Depart search switches directly to Arrive at
// the SAME date+time and applies immediately, and vice versa; input
// changes still apply with no Apply button;
// (c) homepage saved rows are Start here, Go here, Rename, Delete (in
// that order) and Start/Go fill origin/destination;
// (d) a successful save shows NO "Saved." note (error notes still work);
// (e) no actionNote element/key/text in any language;
// (f) no saveDestBtn and no returnBtn in the journey board;
// (g) the Map button appears in the DOM before the Other options list.
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
  journey: () => journeyState,
  timeMode: () => timeMode,
  timeDraft: () => timeDraftMode,
  saved: () => savedPlaces.map(p => ({ ...p })),
  savedNote: () => document.getElementById("savedNote").textContent,
  i18n: () => I18N,
  fns: { render, renderNavFields, renderSaved, renderTimeControls, renderBoard,
    setNavEndpoint, endpointFromPlace, endpointFromStation, addSavedPlace,
    setSavedAsOrigin, setSavedAsDestination, swapNav, pickLanguage },
};\n`, sandbox);
  return { T: sandbox.__t, el: getEl, store };
}
const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
function check(name, cond, extra = "") {
  console.log((cond ? "PASS" : "FAIL") + " " + name + (cond ? "" : " " + extra));
  if (!cond) failures++;
}
// Toronto today + current minutes (for prefill assertions, ±2 min tolerance).
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

const { T, el, store } = loadVM();
for (let i = 0; i < 80 && !T.i18n(); i++) await tick();
await tick(300);
T.fns.pickLanguage("en");

// (a) Initial load: empty fields, blank values, swap disabled, choose prompt.
check("(a) initial nav fields are null (no restore, no legacy derivation)",
  T.nav().origin === null && T.nav().dest === null && !T.journey(),
  JSON.stringify({ o: T.nav().origin, d: T.nav().dest }));
const fldVal = (b) => (b.children.find(c => c.className === "fldvalue") || {}).textContent;
check("(a) field value areas are blank (not 'Tap to choose', not a place name)",
  fldVal(el("originField")) === "" && fldVal(el("destField")) === "",
  JSON.stringify({ o: fldVal(el("originField")), d: fldVal(el("destField")) }));
check("(a) swap button is disabled until both fields are set",
  el("swapBtn").disabled === true);
check("(a) board shows the choose-origin prompt, not a fallback pair trip",
  (el("routeLine").textContent || "") === "Choose the origin",
  JSON.stringify({ route: el("routeLine").textContent }));
// Stored obt_nav must NOT restore on a fresh load.
T.fns.setNavEndpoint("origin", T.fns.endpointFromStation(places.stations.find(s => s.id === "oakville-go")));
T.fns.setNavEndpoint("dest", T.fns.endpointFromPlace(places.places.find(p => p.name === "Iqbal Foods Oakville")));
const storedNav = store.get("obt_nav");
check("(a) within-session picks still persist obt_nav (for the record, not for restore)",
  !!storedNav && JSON.parse(storedNav).origin && JSON.parse(storedNav).dest);
const vm2 = loadVM(new Map(store));
for (let i = 0; i < 80; i++) await tick();
vm2.T.fns.pickLanguage("en");
check("(a) a fresh load with obt_nav stored still starts EMPTY",
  vm2.T.nav().origin === null && vm2.T.nav().dest === null && !vm2.T.journey(),
  JSON.stringify({ o: vm2.T.nav().origin, d: vm2.T.nav().dest }));

// (b) Depart/Arrive free switching.
T.fns.renderTimeControls();
// Stub DOMs default hidden=false, unlike a real browser where the panel
// starts hidden — set the real initial state before tapping Time.
el("timePanel").hidden = true;
el("timeBtn").onclick(); // open panel
check("(b) time panel opens", el("timePanel").hidden === false);
el("timeModeDepart").onclick(); // pickDraft depart
const today = torontoNow();
check("(b) Depart tap reveals inputs with today + now prefilled",
  el("timeInputs").hidden === false && el("timeDate").value === today.display &&
  closeMin(el("timeClock").value, today.minutes),
  JSON.stringify({ date: el("timeDate").value, clock: el("timeClock").value, today }));
el("timeDate").value = tomorrowDisplay; el("timeClock").value = "09:00";
el("timeDate").onchange(); // applies Depart tomorrow 09:00, no Apply button
check("(b) changing date applies Depart at immediately (no Apply click)",
  T.timeMode().mode === "depart" && T.timeMode().display === tomorrowDisplay &&
  T.timeMode().timeMin === 540,
  JSON.stringify(T.timeMode()));
// Search/time fix 2026-10-29 — CARRY-OVER (reverses the old prefill
// rule): tapping Arrive after a Depart search switches DIRECTLY to
// Arrive at the SAME date+time and applies immediately, panel open.
el("timeModeArrive").onclick();
check("(b) Arrive tap after a Depart search carries over to Arrive at the SAME tomorrow 09:00, applied immediately, panel open",
  T.timeMode().mode === "arrive" && T.timeMode().display === tomorrowDisplay &&
  T.timeMode().timeMin === 540 && el("timePanel").hidden === false &&
  el("timeInputs").hidden === false && el("timeDate").value === tomorrowDisplay &&
  el("timeClock").value === "09:00",
  JSON.stringify({ mode: T.timeMode(), date: el("timeDate").value, clock: el("timeClock").value }));
el("timeClock").value = "18:00";
el("timeClock").onchange(); // applies Arrive tomorrow 18:00
check("(b) changing clock applies Arrive by immediately",
  T.timeMode().mode === "arrive" && T.timeMode().display === tomorrowDisplay &&
  T.timeMode().timeMin === 1080,
  JSON.stringify(T.timeMode()));
el("timeModeDepart").onclick(); // back to Depart — carries tomorrow 18:00 over
check("(b) Depart tap again carries over to Depart at the SAME tomorrow 18:00",
  T.timeMode().mode === "depart" && T.timeMode().display === tomorrowDisplay &&
  T.timeMode().timeMin === 1080 && el("timeDate").value === tomorrowDisplay &&
  el("timeClock").value === "18:00",
  JSON.stringify({ mode: T.timeMode(), date: el("timeDate").value, clock: el("timeClock").value }));
el("timeModeNow").onclick(); // Leave now
check("(b) Leave now resets the mode and closes the panel",
  T.timeMode().mode === "now" && el("timePanel").hidden === true);

// (c) Homepage saved rows: Start here, Go here, Rename, Delete in order.
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
const cards = el("savedgrid").children.filter(c => c.className === "savedcard");
check("(c) homepage saved rows exist", cards.length === 2, `cards=${cards.length}`);
const btns = cards[0].children.filter(c => c.textContent).map(c => c.textContent);
check("(c) saved row buttons are Start here, Go here, Rename, Delete in that order",
  btns.indexOf("Start here") >= 0 && btns.indexOf("Go here") >= 0 &&
  btns.indexOf("Rename") >= 0 && btns.indexOf("Delete") >= 0 &&
  btns.indexOf("Start here") < btns.indexOf("Go here") &&
  btns.indexOf("Go here") < btns.indexOf("Rename") &&
  btns.indexOf("Rename") < btns.indexOf("Delete"),
  btns.join(" | "));
cards[0].children.find(c => c.textContent === "Start here").onclick();
check("(c) Start here fills the ORIGIN field with the saved place",
  T.nav().origin && T.nav().origin.label === "My Iqbal",
  JSON.stringify(T.nav().origin && T.nav().origin.label));
cards[1].children.find(c => c.textContent === "Go here").onclick();
check("(c) Go here fills the DESTINATION field with the saved place",
  T.nav().dest && T.nav().dest.label === "My Hospital",
  JSON.stringify(T.nav().dest && T.nav().dest.label));
check("(c) swap is enabled once both fields are set",
  el("swapBtn").disabled === false);

// (d) No "Saved." note on success; error notes still work.
check("(d) successful saves show NO 'Saved.' note",
  T.savedNote() === "" || !T.savedNote().includes("Saved"),
  JSON.stringify({ note: T.savedNote() }));
T.fns.addSavedPlace({ key: "place:" + iqbal.id, custom: "My Iqbal", kind: "place",
  destId: null, stopId: iqbal.stop.id, stopName: iqbal.stop.name,
  stopCode: iqbal.stop.code, address: iqbal.address, enName: iqbal.name,
  lat: iqbal.lat, lon: iqbal.lon });
check("(d) duplicate save still shows the already-saved error note",
  (T.savedNote() || "").length > 0 && T.savedNote() !== "Saved." && !T.savedNote().includes("Saved."),
  JSON.stringify({ note: T.savedNote() }));

// (e) actionNote gone everywhere.
check("(e) no actionNote element in the HTML",
  !html.includes('id="actionNote"'));
check("(e) no actionNote key in any language",
  ["en", "fr", "zh", "ar", "hi"].every(l => !("actionNote" in T.i18n()[l])));
check("(e) no actionNote sentence text in the HTML",
  !html.includes("Search finds saved places") && !html.includes("Category results come from the place category only"));

// (f) No journey-card Save / Return buttons.
check("(f) no saveDestBtn element in the HTML", !html.includes('id="saveDestBtn"'));
check("(f) no returnBtn element in the HTML", !html.includes('id="returnBtn"'));
check("(f) no saveDestBtn/returnBtn references in the frontend script",
  !/saveDestBtn|returnBtn/.test(script));
// (g) Map button before the Other options list in the board DOM.
check("(g) mapBtn appears in the DOM before journeyAlts",
  html.indexOf('id="mapBtn"') > 0 && html.indexOf('id="mapBtn"') < html.indexOf('id="journeyAlts"'),
  `mapBtn@${html.indexOf('id="mapBtn"')} journeyAlts@${html.indexOf('id="journeyAlts"')}`);
// Swap remains the sole return control: swapping exchanges the fields.
const beforeSwap = { o: T.nav().origin.label, d: T.nav().dest.label };
T.fns.swapNav();
check("(g) Swap exchanges origin/destination (sole return-trip control)",
  T.nav().origin.label === beforeSwap.d && T.nav().dest.label === beforeSwap.o,
  JSON.stringify({ o: T.nav().origin.label, d: T.nav().dest.label }));

console.log(failures === 0 ? "ALL HOMEFIX TESTS PASSED" : failures + " TEST(S) FAILED");
process.exit(failures === 0 ? 0 : 1);
