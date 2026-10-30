// UI batch harness (2026-10-29, user decisions): (1) category highlight —
// the selected category button is highlighted in both the main search
// screen and the picker, always matching the actual query; (2) footer
// tidy — exactly 4 paragraphs in all 22 languages, duplicates merged,
// attributions intact; (3) header restored to the ORIGINAL form
// 2026-10-29 (user decision) — back | title | language only, no coffee
// and no weather in the bar; the Buy Me a Coffee button is the footer's
// last line instead. Runs the real public/index.html inline script in
// Node with a stub DOM. No browser, no network, no deploy.
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

function makeEl(tag) {
  const el = { tagName: String(tag || "").toUpperCase(), id: "", _html: "",
    textContent: "", className: "", hidden: false, disabled: false, title: "",
    value: "", placeholder: "", lang: "", dir: "", children: [], dataset: {},
    appendChild(c) { this.children.push(c); return c; },
    querySelectorAll(sel) {
      if (sel === "button") return this.children.filter((c) => c.tagName === "BUTTON");
      return [];
    },
    setAttribute(k, v) {
      if (k === "data-catlabel") this.dataset.catLabel = v;
      else this["attr_" + k] = v;
    },
    getAttribute(k) {
      if (k === "data-catlabel") return this.dataset.catLabel;
      return this["attr_" + k];
    },
    style: {} };
  const cls = {
    add(c) { el.className = [...new Set(el.className.split(/\s+/).filter(Boolean).concat([c]))].join(" "); },
    remove(c) { el.className = el.className.split(/\s+/).filter((x) => x && x !== c).join(" "); },
    toggle(c, f) {
      if (f === undefined) f = !cls.contains(c);
      if (f) cls.add(c); else cls.remove(c);
      return f;
    },
    contains(c) { return el.className.split(/\s+/).includes(c); },
  };
  el.classList = cls;
  Object.defineProperty(el, "innerHTML", {
    get() { return this._html; },
    set(v) { this._html = v; this.children = []; },
  });
  return el;
}
const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));
async function loadVM() {
  const els = new Map();
  function getEl(id) {
    if (!els.has(id)) { const e = makeEl(""); e.id = id; els.set(id, e); }
    return els.get(id);
  }
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
    setTimeout, clearTimeout,
    fetch: async (url) => {
      const u = String(url);
      if (u.includes("pairs.json")) return { json: async () => pairs };
      if (u.includes("stops.json")) return { json: async () => stops };
      if (u.includes("timetable.json")) return { json: async () => tt };
      if (u.includes("places.json")) return { json: async () => places };
      if (u.includes("nominatim")) return { json: async () => [] };
      return { json: async () => ({ ok: false, trips: [], vehicles: [], alerts: [] }) };
    },
    document: { getElementById: getEl, createElement: (t) => makeEl(t),
      documentElement: getEl("html") },
  };
  vm.createContext(sandbox);
  vm.runInContext(script + `\nglobalThis.__t = {
  i18n: () => I18N, names: () => LANG_NAMES, data: () => DATA,
  fns: { openSearch, openPicker, runSearch, renderPickerResults,
    renderFooter, pickLanguage, render, updateHeaderBack },
};\n`, sandbox);
  await tick(300);
  return { T: sandbox.__t, el: getEl };
}

let failures = 0;
function check(name, cond, extra = "") {
  console.log((cond ? "PASS" : "FAIL") + " " + name + (cond ? "" : " " + extra));
  if (!cond) failures++;
}
const { T, el } = await loadVM();
for (const id of ["searchScreen", "pickerScreen", "locationScreen", "mapScreen"]) el(id).hidden = true;
T.fns.pickLanguage("en");
const catButtons = (containerId) =>
  el(containerId).children.filter((c) => c.tagName === "BUTTON");
const highlighted = (containerId) =>
  catButtons(containerId).filter((b) => b.classList.contains("on"));

// (a) Category highlight — main search screen.
T.fns.openSearch();
let sBtns = catButtons("searchCats");
check("(a) search screen renders one button per category", sBtns.length === 13,
  "got " + sBtns.length);
const sLabel = sBtns[0].textContent;
sBtns[0].onclick();
check("(a) tapping a search category highlights exactly that button",
  highlighted("searchCats").length === 1 && highlighted("searchCats")[0] === sBtns[0] &&
  sBtns[0].getAttribute("aria-pressed") === "true" &&
  sBtns.slice(1).every((b) => b.getAttribute("aria-pressed") === "false"),
  highlighted("searchCats").map((b) => b.textContent).join(","));
const sRows = el("searchResults").children;
check("(a) category rows stay Save-only (label is plain text, never navigates)",
  sRows.length > 0 && sRows[0].children[0].tagName !== "BUTTON",
  "first row child tag: " + (sRows[0] && sRows[0].children[0] && sRows[0].children[0].tagName));
T.fns.runSearch("hello world");
check("(a) free-text query clears the search highlight",
  highlighted("searchCats").length === 0);
T.fns.runSearch(sLabel);
check("(a) typing the category label re-highlights it",
  highlighted("searchCats").length === 1 && highlighted("searchCats")[0].textContent === sLabel);
T.fns.runSearch("");
check("(a) clearing the input clears the search highlight",
  highlighted("searchCats").length === 0);

// (a) Category highlight — picker.
T.fns.openPicker("dest");
let pBtns = catButtons("pickerCats");
check("(a) picker renders one button per category", pBtns.length === 13,
  "got " + pBtns.length);
const pLabel = pBtns[2].textContent;
pBtns[2].onclick();
check("(a) tapping a picker category highlights exactly that button and fills the field",
  highlighted("pickerCats").length === 1 && highlighted("pickerCats")[0] === pBtns[2] &&
  el("pickerInput").value === pLabel,
  "input=" + el("pickerInput").value);
T.fns.renderPickerResults("somewhere else");
check("(a) free-text picker query clears the picker highlight",
  highlighted("pickerCats").length === 0);
T.fns.renderPickerResults(pLabel);
check("(a) picker category label re-highlights it",
  highlighted("pickerCats").length === 1 && highlighted("pickerCats")[0].textContent === pLabel);

// (b) Footer — English, exactly 4 paragraphs, duplicates merged.
T.fns.pickLanguage("en");
T.fns.renderFooter();
let fh = el("footer").innerHTML;
const paras = (fh.match(/<p>/g) || []).length;
check("(b) footer renders exactly 4 paragraphs, no <br> chain, no <small>",
  paras === 4 && !fh.includes("<br>") && !fh.includes("<small>"), fh.slice(0, 200));
check("(b) footer paragraph 1 is the timetable validity line",
  fh.includes("Timetable valid to 2026-10-31"));
check("(b) footer keeps the draft-translation disclosure",
  fh.includes("drafts, not yet reviewed by a human translator"));
check("(b) footer keeps the privacy promise, Nominatim disclosure, and coordinates-only walking",
  fh.includes("stay on this phone only") && fh.includes("never sent to a server") &&
  fh.includes("OpenStreetMap Nominatim") && fh.includes("routing.openstreetmap.de/routed-foot"));
check("(b) saved-places-phone-only sentence appears exactly once (duplicate merged)",
  (fh.match(/stay on this phone only/g) || []).length === 1);
check("(b) footer keeps OGL attribution and OSM © attribution",
  fh.includes("Open Government Licence") && fh.includes("© OpenStreetMap") &&
  fh.includes("Independent project, not official"));
check("(b) footer font is not shrunk (15px footer rule, paragraph margins)",
  /footer\s*\{[^}]*font-size:\s*15px/.test(html) &&
  /footer p\s*\{[^}]*margin:\s*0 0 12px/.test(html));
// Expired-timetable warning still switches.
const savedEnd = T.data().meta.package_end_date;
T.data().meta.package_end_date = "20200101";
T.fns.renderFooter();
fh = el("footer").innerHTML;
check("(b) expired timetable still shows the warning inside paragraph 1",
  fh.includes('class="warn"') && fh.includes(T.i18n().en.expired));
T.data().meta.package_end_date = savedEnd;
T.fns.renderFooter();
// RTL language: Arabic.
T.fns.pickLanguage("ar");
T.fns.renderFooter();
fh = el("footer").innerHTML;
check("(b) Arabic footer is 4 paragraphs with untranslated service names/URL",
  (fh.match(/<p>/g) || []).length === 4 && fh.includes("Nominatim") &&
  fh.includes("routing.openstreetmap.de/routed-foot") &&
  fh.includes(T.i18n().ar.draft), fh.slice(0, 160));
// All 22 languages: 4 non-empty paragraphs each.
let langOk = true, langBad = [];
for (const l of Object.keys(T.names())) {
  T.fns.pickLanguage(l);
  T.fns.renderFooter();
  const h = el("footer").innerHTML;
  const ps = [...h.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => m[1].replace(/<[^>]+>/g, "").trim());
  if (ps.length !== 4 || ps.some((p) => p.length === 0)) { langOk = false; langBad.push(l); }
}
check("(b) all 22 languages render 4 non-empty footer paragraphs", langOk,
  "bad: " + langBad.join(","));
T.fns.pickLanguage("en");

// (c) Header restored to the ORIGINAL form 2026-10-29 (user decision):
// back | title | language only — no coffee, no weather in the bar.
const order = ["headerBack", "title", "langBtn"]
  .map((id) => html.indexOf(`id="${id}"`));
check("(c) header DOM order is back | title | language",
  order.every((i) => i !== -1) && order.every((v, i) => i === 0 || order[i - 1] < v),
  JSON.stringify(order));
check("(c) no coffee link and no weather element in the header",
  !html.includes('id="coffeeLink"') && !html.includes('id="weather"') &&
  !html.includes('class="coffee-link"') && !html.includes('class="weather"'));
check("(c) footer BMC button present (official cdnjs src, slug joshuasun) as the only coffee element",
  html.includes('<script type="text/javascript" src="https://cdnjs.buymeacoffee.com/1.0.0/button.prod.min.js"') &&
  html.includes('data-slug="joshuasun"') &&
  html.indexOf('<div id="bmcFooter"') > html.indexOf('<footer id="footer">') &&
  (html.match(/buymeacoffee/g) || []).length === 1);
check("(c) title still centered (equal 1fr cells) and header back is hidden on home",
  /\.topbar\s*\{[^}]*grid-template-columns:\s*minmax\(0,1fr\)\s+auto\s+minmax\(0,1fr\)/.test(html) &&
  html.includes('id="headerBack" class="headerback" hidden'));
check("(c) language button is plain full 'A文' (no short-form spans) and narrow guard still present",
  html.includes('id="langBtn" class="langbtn" aria-label="Change language">A文</button>') &&
  !html.includes("lang-short") &&
  /@media \(max-width:360px\)[\s\S]*?\.topbar h1\s*\{\s*font-size:\s*20px/.test(html));

// (d) Untouched: sort keys, strip bus icon, map live dot.
check("(d) sort toggle keys intact",
  ["sortLabel", "sortTotal", "sortTransfers", "sortWalk", "sortArrival"]
    .every((k) => T.i18n().en[k]));
check("(d) strip bus icon and map live-dot code untouched",
  html.includes("STRIP_BUS_ICON_SVG") && html.includes("liveDotIconHtml"));

console.log(failures === 0 ? "ALL UIBATCH CHECKS PASSED" : failures + " FAILURES");
process.exit(failures === 0 ? 0 : 1);
