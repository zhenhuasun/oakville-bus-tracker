// Save-UI rework harness (2026-10-29, user decisions): (1) main search
// screen shows a live dynamic list as you type, with the Address results
// group FIRST, directly below the search input; (2) privacy sentences
// live ONLY in the footer (full-size paragraph 3 of 4, footer tidy
// 2026-10-29); (3) address rows have
// no "Start here" button; (4) category browsing is pick-to-save (rows
// have only a Save button; tapping a row never navigates); (5) saves
// appear immediately in the same-page saved grid; saved rows have
// exactly Rename + two-tap Delete, no Go/Start buttons; cap 8.
// Runs the real public/index.html inline script in Node with a stub DOM
// + stub localStorage/fetch. No browser, no network, no deploy.
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
function nominatimStub(url) {
  const u = String(url);
  if (u.includes("nominatim.openstreetmap.org/search")) {
    if (u.includes("Far")) return { json: async () => [
      { display_name: "1 Far Rd, Oakville, Ontario, Canada", lat: "43.35", lon: "-79.75" }] };
    return { json: async () => [
      { display_name: "123 Test St, Oakville, Ontario, Canada", lat: "43.4558", lon: "-79.6824" },
      { display_name: "999 Other Rd, Burlington, Ontario, Canada", lat: "43.30", lon: "-79.80" }] };
  }
  if (u.includes("nominatim.openstreetmap.org/reverse")) {
    return { json: async () => ({ display_name: "456 Test Road, Oakville, Ontario, Canada",
      address: { house_number: "456", road: "Test Road", town: "Oakville" } }) };
  }
  return null;
}
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
  fns: { render, renderSaved, renderSearchSaved, addSavedPlace, renameSaved,
    requestDelete, confirmDelete, disarmDelete, openSearch, runSearch,
    saveSearchResult, loadMainAddressResults, nominatimSearch,
    endpointFromAddressResult, openPicker, renderPickerResults,
    loadPickerAddressResults, pickLanguage },
};
`, sandbox);
  for (let i = 0; i < 60 && !sandbox.__t.nav().origin; i++) await tick();
  return { T: sandbox.__t, el: getEl, store };
}

let failures = 0;
function check(name, cond, extra = "") {
  console.log((cond ? "PASS" : "FAIL") + " " + name + (cond ? "" : " " + extra));
  if (!cond) failures++;
}
const collectRows = (box) => box.children.flatMap(c => c.className === "addrgroup" ? c.children.filter(x => x.className === "result") : (c.className === "result" ? [c] : []));
const nodeText = (e) => (e.children && e.children.length ? e.children.map(nodeText).join(" ") : (e.textContent || ""));
const collectText = (box) => box.children.map(nodeText).join(" | ");
const { T, el } = await loadVM();

// (a) Dynamic list as you type + address group FIRST, directly below input.
T.fns.openSearch();
const inp = el("searchInput");
inp.value = "Iqbal";
inp.oninput();
check("(a) typing in the search box updates the list live (no Apply click)",
  collectText(el("searchResults")).includes("Iqbal"));
T.fns.runSearch("123 Test St");
await tick(100);
const boxA = el("searchResults");
const wrapA = boxA.children[0];
check("(a) address container is the FIRST child directly below the search input",
  !!wrapA && wrapA.className === "addrgroup" &&
  !!wrapA.children.find(c => (c.textContent || "") === "Address results"),
  `first child class=${wrapA && wrapA.className}`);
const addrRowA = collectRows(boxA).find(r => (r.children[0].textContent || "").includes("123 Test St"));
check("(a) address row is inside that first group",
  !!addrRowA && wrapA.children.includes(addrRowA));
// Dynamic update: a new query replaces the old list (no stale address row).
T.fns.runSearch("Far");
await tick(100);
const textFar = collectText(el("searchResults"));
check("(a) a new query replaces the list (old address row gone, new one in)",
  textFar.includes("1 Far Rd") && !textFar.includes("123 Test St"), textFar);

// (b) Privacy sentences ONLY in the footer, as a full-size paragraph
// (footer tidy 2026-10-29: 4 paragraphs, no <small>). Note: the approved
// English privacy paragraph names the OSRM foot service without the
// parenthetical URL — the URL itself survives in the footer via the
// paragraph-4 walk attribution, so the rendered-footer check (not the
// key check) asserts routed-foot.
check("(b) no inline search/picker address-note elements remain in the HTML",
  !html.includes('id="searchAddrNote"') && !html.includes('id="pickerAddrNote"'));
check("(b) footer privacy note exists in all 5 languages and mentions Nominatim",
  ["en", "fr", "zh", "ar", "hi"].every(l => T.i18n()[l].footerPrivacy && T.i18n()[l].footerPrivacy.includes("Nominatim")));
check("(b) rendered footer contains the privacy sentences as a paragraph (not small font) plus routed-foot",
  (el("footer").innerHTML || "").includes("Nominatim") && !(el("footer").innerHTML || "").includes("<small>") &&
  (el("footer").innerHTML || "").includes("routing.openstreetmap.de/routed-foot"));

// (c) Address rows have NO "Start here" button (main search + picker).
T.fns.runSearch("123 Test St");
await tick(100);
const addrRowC = collectRows(el("searchResults")).find(r => (r.children[0].textContent || "").includes("123 Test St"));
check("(c) main-screen address row has no 'Start here' button (primary + Save only)",
  !!addrRowC && !addrRowC.children.some(c => (c.textContent || "") === "Start here") && addrRowC.children.length === 3,
  addrRowC && addrRowC.children.map(c => c.textContent).join(" | "));
T.fns.openPicker("dest");
T.fns.renderPickerResults("123 Test St");
await T.fns.loadPickerAddressResults("123 Test St", el("pickerResults"));
const pickRows = el("pickerResults").children.filter(c => c.className === "result");
const pickAddr = pickRows.find(r => (r.children[0].textContent || "").includes("123 Test St"));
check("(c) picker address row has no 'Start here' button either",
  !!pickAddr && !pickAddr.children.some(c => (c.textContent || "") === "Start here"),
  pickAddr && pickAddr.children.map(c => c.textContent).join(" | "));

// (d) Category browsing is pick-to-save: rows have ONLY Save; tapping a row never navigates.
const navBefore = JSON.stringify(T.nav());
T.fns.openSearch();
check("(d) category instruction line tells the user to tap a keyword to pick addresses to save",
  (el("searchCatNote").textContent || "").length > 0, el("searchCatNote").textContent);
T.fns.runSearch("Supermarket");
const catBox = el("searchResults");
const catRows = collectRows(catBox);
check("(d) category results exist", catRows.length > 0, `rows=${catRows.length}`);
const catRow = catRows[0];
check("(d) a category row has ONLY a Save button (label is plain text, no navigation handler)",
  catRow.children.length === 3 && typeof catRow.children[0].onclick !== "function" &&
  !catRow.children.some(c => (c.textContent || "") === "Start here" || (c.textContent || "") === "Go here"),
  catRow.children.map(c => `${c.textContent} onclick=${typeof c.onclick}`).join(" | "));
const savedBefore = T.saved().length;
catRow.children[2].onclick(); // Save button
check("(d) tapping a category row's Save saves it WITHOUT navigating",
  JSON.stringify(T.nav()) === navBefore && T.saved().length === savedBefore + 1,
  `nav changed=${JSON.stringify(T.nav()) !== navBefore} saved=${T.saved().length}`);

// (e) Saving from free-text search appears immediately in the same-page saved grid.
T.fns.openSearch();
T.fns.runSearch("Iqbal");
const iqRow = collectRows(el("searchResults")).find(r => (r.children[0].textContent || "").includes("Iqbal"));
const iqSave = iqRow.children.find(c => (c.textContent || "").startsWith("＋"));
iqSave.onclick();
const gridText = el("savedgrid").children.map(c => c.children.map(x => x.textContent || "").join(" ")).join(" | ");
check("(e) saving from search immediately adds a row to the same-page saved grid (no reload)",
  gridText.includes("Iqbal"), gridText);

// (f) Saved rows (Homefix 2026-10-29, reverses the Save-UI rule for the
// HOMEPAGE grid only): Start here, Go here, Rename, Delete in that
// order; rename/delete still update in place.
const grid = el("savedgrid");
const cards = grid.children.filter(c => c.className === "savedcard");
check("(f) saved rows exist in the homepage grid", cards.length > 0);
const firstCard = cards[0];
check("(f) a homepage saved row has Start here + Go here + Rename + Delete, in that order",
  (() => { const btns = firstCard.children.filter(c => c.textContent).map(c => c.textContent);
    const iS = btns.indexOf("Start here"), iG = btns.indexOf("Go here"),
      iR = btns.indexOf("Rename"), iD = btns.indexOf("Delete");
    return iS >= 0 && iG >= 0 && iR >= 0 && iD >= 0 && iS < iG && iG < iR && iR < iD; })(),
  firstCard.children.map(c => c.textContent).join(" | "));
const savedKey = T.saved()[0].key;
const delBtn = firstCard.children.find(c => (c.textContent || "") === "Delete");
delBtn.onclick(); // first tap arms
const armedCard = el("savedgrid").children.filter(c => c.className === "savedcard")[0];
check("(f) first Delete tap arms 'Confirm delete?' (does not delete yet)",
  armedCard.children.some(c => (c.textContent || "").toLowerCase().includes("confirm")) && T.saved().some(p => p.key === savedKey),
  armedCard.children.map(c => c.textContent).join(" | "));
// Disarm rule: tapping another row's Delete re-arms to that row.
const secondCard = el("savedgrid").children.filter(c => c.className === "savedcard")[1];
if (secondCard) {
  const del2 = secondCard.children.find(c => (c.textContent || "") === "Delete");
  if (del2) del2.onclick();
  const reArmed = el("savedgrid").children.filter(c => c.className === "savedcard");
  check("(f) arming a second row disarms the first (single armed id)",
    !reArmed[0].children.some(c => (c.textContent || "").toLowerCase().includes("confirm")),
    reArmed[0].children.map(c => c.textContent).join(" | "));
}
// Rename in place (via rename path + re-render, same page, no reload).
const renameKey = T.saved()[0].key;
T.fns.renameSaved(renameKey, "Renamed Place");
check("(f) rename updates the displayed name in place on the same page",
  el("savedgrid").children.some(c => c.children.some(x => (x.textContent || "") === "Renamed Place")));
// Delete in place: arm then confirm removes the row.
T.fns.requestDelete(renameKey);
T.fns.confirmDelete(renameKey);
check("(f) second Delete tap removes the row in place on the same page",
  !T.saved().some(p => p.key === renameKey) &&
  !el("savedgrid").children.some(c => c.children.some(x => (x.textContent || "") === "Renamed Place")));

// (g) Cap of 8 still enforced.
const existing = T.saved().map(p => p.key);
let added = 0;
for (const pl of places.places) {
  if (T.saved().length >= 8) break;
  const key = "place:" + pl.id;
  if (existing.includes(key)) continue;
  if (T.fns.addSavedPlace({ key, custom: pl.name, kind: "place", destId: null, stopId: pl.stop.id, stopName: pl.stop.name, stopCode: pl.stop.code, address: pl.address, enName: pl.name, lat: pl.lat, lon: pl.lon })) added++;
}
check("(g) saved places cap at 8", T.saved().length === 8, `saved=${T.saved().length}`);
const ninth = T.fns.addSavedPlace({ key: "place:cap-test-9th", custom: "Ninth", kind: "place", destId: null, stopId: "1212", stopName: "Oakville GO", stopCode: "3172", address: "", enName: "Ninth" });
check("(g) 9th saved place is rejected", ninth === false && T.saved().length === 8);

console.log(failures === 0 ? "ALL SAVEUI TESTS PASSED" : failures + " TEST(S) FAILED");
process.exit(failures === 0 ? 0 : 1);
