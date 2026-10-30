// 22-language expansion harness (2026-10-29, user decisions):
// order by estimated Oakville usage (2021 Census mother tongue),
// English/French first; uk (<1,000) and ja (smallest) are estimates.
// New: tl, hr, fa (RTL), sr (Latin), de, ro, zh-Hant (converted from zh).
// Proves via the real public/index.html script in a stub-DOM VM:
// (a) 22 languages in exactly the final order, in onboarding + LANG_NAMES,
// (b) 162 x 22 t() values all non-empty, placeholders preserved,
// (147 original keys + 8 board-clarity keys added 2026-10-29 + arrWord added for the strip redesign),
// (c) fa/ar/ur RTL, the other 19 LTR,
// (d) zh code unchanged, zh-Hant present as a separate pack,
// (e) LANG_NAMES.zh reads Simplified Chinese (native form) in the map,
// (f) draft-translation footer wording present in all 22, naming no count.
// Plus: category/destination labels + alert templates in all 7 new packs.
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
  i18n: () => I18N, cat: () => CAT_LABEL, dest: () => DEST_LABEL,
  names: () => LANG_NAMES, examples: () => LANG_EXAMPLE,
  pick: (l) => pickLanguage(l), t: (k) => t(k), lang: () => lang,
  dir: () => document.documentElement.dir,
  alert: (a, l) => translateAlert(a, l),
};\n`, sandbox);
const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 60 && !sandbox.document; i++) await tick();
await tick(200);
const T = sandbox.__t;
let failures = 0;
function check(name, cond, extra = "") {
  console.log((cond ? "PASS" : "FAIL") + " " + name + (cond ? "" : " " + extra));
  if (!cond) failures++;
}
const ORDER = ["en","fr","zh","ar","es","ur","pt","pl","it","pa","ko","hi","tl","hr","ru","zh-Hant","fa","sr","de","ro","uk","ja"];
const NEW = ["tl","hr","fa","sr","de","ro","zh-Hant"];
const RTL = new Set(["ar","ur","fa"]);
const CATS = ["supermarket","shoppingcentre","hospitallab","library","school","park","specialtyasian","station","pharmacy","bank","communityCentre","religious","bigbox"];
const DESTS = ["iqbal","oakville_place","hospital","oakville_go_dest","uptown_dest","shoppers","rbc","otcc","glen_abbey_cc"];

// (a) exact order: onboarding arrays (both occurrences) + LANG_NAMES key order
const arrLit = JSON.stringify(ORDER);
check("(a) onboarding arrays use exactly the 22-language order (2 occurrences)",
  (html.split(arrLit).length - 1) === 2);
check("(a) LANG_NAMES keys in exactly the 22-language order",
  JSON.stringify(Object.keys(T.names())) === JSON.stringify(ORDER));
const I18N = T.i18n();
check("(a) I18N has all 22 languages", ORDER.every(l => !!I18N[l]));
check("(a) no zh-Hans pack and no other extra language pack",
  Object.keys(I18N).length === 22 && !I18N["zh-Hans"]);
// (b) 162 x 22 values, placeholders preserved vs en
const keys = Object.keys(I18N.en);
check("(b) en has 162 t() keys", keys.length === 162, "got " + keys.length);
let missing = [], phBad = [];
const ph = (s) => (String(s).match(/\{[^}]+\}/g) || []).sort().join(",");
for (const l of ORDER) for (const k of keys) {
  const v = I18N[l] && I18N[l][k];
  if (typeof v !== "string" || !v.trim()) missing.push(l + ":" + k);
  else if (ph(v) !== ph(I18N.en[k])) phBad.push(l + ":" + k);
}
check(`(b) all 162 t() keys non-empty in all 22 languages (${keys.length * 22} values)`,
  missing.length === 0, missing.slice(0, 10).join(","));
check("(b) placeholders preserved in all 22 languages", phBad.length === 0, phBad.slice(0, 10).join(","));
// (c) RTL
let dirBad = [];
for (const l of ORDER) {
  T.pick(l);
  const want = RTL.has(l) ? "rtl" : "ltr";
  if (T.dir() !== want) dirBad.push(l + "->" + T.dir());
}
check("(c) ar + ur + fa RTL, other 19 LTR", dirBad.length === 0, dirBad.join(","));
// (d) zh code unchanged, zh-Hant separate
check("(d) zh pack present and zh-Hant a separate pack with different strings",
  !!I18N.zh && !!I18N["zh-Hant"] && I18N["zh-Hant"].onbTitle !== I18N.zh.onbTitle);
// (e) zh display name = Simplified Chinese (native form 简体中文)
check("(e) LANG_NAMES.zh is Simplified Chinese (native form)",
  T.names().zh === "简体中文");
check("(e) LANG_NAMES.zh-Hant names Traditional Chinese",
  T.names()["zh-Hant"].includes("繁體中文"));
// (f) draft wording in all 22, naming no count
let draftBad = [];
for (const l of ORDER) {
  const d = I18N[l].draft || "";
  if (!d.trim() || /\b22\b|\b15\b/.test(d)) draftBad.push(l);
}
check("(f) draft-translation wording present in all 22, naming no count",
  draftBad.length === 0, draftBad.join(","));
// extras: cat/dest labels + alert templates for the 7 new packs
const CAT = T.cat(), DEST = T.dest();
check("extra: all 13 category labels in the 7 new languages",
  CATS.every(c => NEW.every(l => CAT[c] && typeof CAT[c][l] === "string" && CAT[c][l].trim())));
check("extra: all 9 destination labels in the 7 new languages",
  DESTS.every(d => NEW.every(l => DEST[d] && typeof DEST[d][l] === "string" && DEST[d][l].trim())));
check("extra: LANG_EXAMPLE non-empty in the 7 new languages",
  NEW.every(l => T.examples()[l] && T.examples()[l].trim()));
let alertBad = [];
for (const l of NEW) {
  const a = T.alert({ header: "Route 5 on DETOUR", description: "Main St will be closed between A St and B St from 9am. The route 5 will be on detour along C St in both directions", route_ids: ["5"] }, l);
  if (!a.summary || a.summary === "Route 5 on DETOUR" || !a.detourWord) alertBad.push(l + ":" + a.summary);
}
check("extra: alert templates translated for the 7 new languages",
  alertBad.length === 0, alertBad.join("; "));
console.log(failures === 0 ? "ALL PASS" : failures + " FAILURES");
process.exit(failures === 0 ? 0 : 1);
