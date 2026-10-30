// Time-picker interaction harness (2026-10-29): proves the reported bug
// is fixed — Depart/Arrive taps reveal the date+time inputs in the same
// render pass, changing an input applies immediately with no Apply
// button, Leave now resets + closes the panel, and reopening shows the
// applied mode + date/time. Also proves the deleted texts are gone:
// no timeApply/timeReset buttons or keys, no Leave-now note, no
// pairNote element or key. Runs the real public/index.html inline
// script in Node with a stub DOM + stub localStorage/fetch.
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
vm.runInContext(script + `\nglobalThis.__t = {
  journey: () => journeyState,
  timeMode: () => timeMode,
  timeDraft: () => timeDraftMode,
  i18n: () => I18N,
  fns: { setTimeMode, resetTimeMode, renderTimeControls, pickLanguage },
};\n`, sandbox);
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
// Tomorrow in Toronto time (so no past-departure clamping can fire),
// computed dynamically so this test stays valid on any run date.
const torontoDay = (d) => new Intl.DateTimeFormat("en-CA",
  { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const tomorrow = (() => {
  const d = new Date(torontoDay(new Date()) + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return torontoDay(d);
})();
const tomorrowStr = tomorrow.replace(/-/g, "");
T.fns.pickLanguage("en");
T.fns.renderTimeControls();
// Stub elements start unhidden; the real HTML starts with the panel
// hidden, so simulate that initial state before testing the toggle.
el("timePanel").hidden = true;

// (e) No Apply/Reset buttons exist, in HTML or in script wiring.
check("(e) no timeApply/timeReset button in the HTML",
  !html.includes('id="timeApply"') && !html.includes('id="timeReset"'));
check("(e) no timeApply/timeBackToNow/timeReset references in the page script",
  !script.includes("timeApply") && !script.includes("timeBackToNow") &&
  !script.includes("timeReset") && !script.includes("applyTimePanel"));
for (const lang of ["en", "fr", "zh", "ar", "hi"]) {
  const d = T.i18n()[lang];
  check("(e) no Apply/Reset/Leave-now-note/pairNote keys in " + lang,
    d && !d.timeApply && !d.timeBackToNow && !d.timeNoteNow && !d.pairNote);
}
check("(e) deleted note strings appear nowhere in the page",
  !html.includes("Leave now: the next bus from now.") &&
  !html.includes("Common trips (shortcuts only)") &&
  !html.includes('id="pairNote"'));

// Open the panel via the Time button (applied mode is Leave now).
el("timeBtn").onclick();
check("panel opens via the Time button",
  el("timePanel").hidden === false);
check("inputs hidden on open while mode is Leave now",
  el("timeInputs").hidden === true);

// (a) THE REPORTED BUG: tapping Depart at must reveal the inputs in
// the same render pass (previously renderTimeControls re-hid them
// because it read the still-applied Leave-now mode).
el("timeModeDepart").onclick();
check("(a) tapping Depart at makes date+time inputs VISIBLE in the same pass",
  el("timeInputs").hidden === false,
  "inputs.hidden=" + el("timeInputs").hidden);
check("(a) Depart tap prefills date+time defaults (non-empty)",
  !!el("timeDate").value && !!el("timeClock").value,
  JSON.stringify({ date: el("timeDate").value, clock: el("timeClock").value }));

// (b) Changing date+time applies Depart at with NO Apply click.
el("timeDate").value = tomorrow;
el("timeClock").value = "09:00";
el("timeDate").onchange();
check("(b) changing the date input applies Depart at immediately",
  T.timeMode().mode === "depart" && T.timeMode().dateStr === tomorrowStr &&
  T.timeMode().timeMin === 540,
  JSON.stringify(T.timeMode()));
el("timeClock").onchange(); // same triple: must not error or re-run
check("(b) changing the clock to the same triple is a safe no-op",
  T.timeMode().mode === "depart" && T.timeMode().timeMin === 540);

// (c) Arrive by works the same way.
el("timeModeArrive").onclick();
check("(c) tapping Arrive by keeps inputs visible",
  el("timeInputs").hidden === false);
el("timeDate").value = tomorrow;
el("timeClock").value = "12:00";
el("timeClock").onchange();
check("(c) changing the clock input applies Arrive by immediately",
  T.timeMode().mode === "arrive" && T.timeMode().dateStr === tomorrowStr &&
  T.timeMode().timeMin === 720,
  JSON.stringify(T.timeMode()));

// (d) Leave now resets, re-runs, and closes the panel.
el("timeModeNow").onclick();
check("(d) tapping Leave now resets mode, closes the panel",
  T.timeMode().mode === "now" && el("timePanel").hidden === true);
check("(d) time note is empty in Leave-now mode (note deleted, not replaced)",
  el("timeNote").textContent === "",
  JSON.stringify(el("timeNote").textContent));

// (f) Reopening after a Depart search shows that mode + date/time.
el("timeModeDepart").onclick();
el("timeDate").value = tomorrow;
el("timeClock").value = "09:00";
el("timeDate").onchange();
check("(f) Depart search applied before reopen test",
  T.timeMode().mode === "depart" && T.timeMode().dateStr === tomorrowStr);
el("timeBtn").onclick(); // close
check("(f) Time button closes the panel",
  el("timePanel").hidden === true);
el("timeBtn").onclick(); // reopen
check("(f) reopening shows the applied Depart mode with its date/time pre-filled",
  el("timePanel").hidden === false && el("timeInputs").hidden === false &&
  el("timeDate").value === tomorrow && el("timeClock").value === "09:00",
  JSON.stringify({ panelHidden: el("timePanel").hidden,
    inputsHidden: el("timeInputs").hidden,
    date: el("timeDate").value, clock: el("timeClock").value,
    draft: T.timeDraft(), mode: T.timeMode().mode }));

console.log(failures === 0 ? "ALL TIMEPICKER TESTS PASSED" : failures + " TEST(S) FAILED");
process.exit(failures === 0 ? 0 : 1);
