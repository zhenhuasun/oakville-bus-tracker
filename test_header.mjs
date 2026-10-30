// Unified header harness (2026-10-29, user decision): one header bar on
// every view, 3-column grid with the title truly centered; back at the far
// left (header only, one control) on sub-views, language button far right.
// ORIGINAL form restored 2026-10-29 (user decision): the bar holds ONLY
// the centered title and the language button — no coffee cup, no weather
// in the bar (the Buy Me a Coffee button lives in the footer). Runs the
// real public/index.html inline script in Node with a stub DOM. No
// browser, no network, no deploy.
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

function makeEl(id) {
  const el = { id, _html: "", textContent: "", className: "", hidden: false,
    disabled: false, title: "", value: "", placeholder: "", lang: "", dir: "",
    children: [], appendChild(c) { this.children.push(c); return c; },
    setAttribute(k, v) { this[k] = v; }, style: {} };
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
  vm.runInContext(script + `\nglobalThis.__t = {
  i18n: () => I18N, names: () => LANG_NAMES,
  fns: { updateHeaderBack, openSearch, openPicker, openLocation,
    showMapScreen, closeMap, pickLanguage, render },
};\n`, sandbox);
  await tick(200);
  return { T: sandbox.__t, el: getEl };
}

let failures = 0;
function check(name, cond, extra = "") {
  console.log((cond ? "PASS" : "FAIL") + " " + name + (cond ? "" : " " + extra));
  if (!cond) failures++;
}
const { T, el } = await loadVM();
// Stub-DOM caveat: makeEl defaults hidden=false, but the real HTML marks
// every overlay hidden. Mirror the real initial state before any check,
// otherwise every unopened overlay reads as "open".
for (const id of ["searchScreen", "pickerScreen", "locationScreen", "mapScreen"]) el(id).hidden = true;
T.fns.pickLanguage("en"); // closes first-run onboarding, runs render()

// (a) 3-column grid, title centered, bar above overlays.
check("(a) topbar is a 3-column grid 1fr/auto/1fr",
  /\.topbar\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*minmax\(0,1fr\)\s+auto\s+minmax\(0,1fr\)/.test(html));
check("(a) topbar z-index (60) sits above overlays (50), so no view covers it",
  /\.topbar\s*\{[^}]*z-index:\s*60/.test(html) && /\.overlay\s*\{[^}]*z-index:\s*50/.test(html));
check("(a) overlay top padding clears the bar height",
  /\.overlay\s*\{[^}]*padding:\s*76px/.test(html));
check("(a) header direction fixed LTR so positions never mirror in RTL",
  /\.topbar\s*\{[^}]*direction:\s*ltr/.test(html));

// (b) DOM order + original form. Header restored 2026-10-29 (user
// decision): back | title | language ONLY. No coffee link, no weather
// element, no weather CSS, no weather fetch/timer anywhere in the page.
const order = ["headerBack", "title", "langBtn"]
  .map((id) => html.indexOf(`id="${id}"`));
check("(b) header DOM order is back | title | language",
  order.every((i) => i !== -1) && order.every((v, i) => i === 0 || order[i - 1] < v),
  JSON.stringify(order));
check("(b) topbar holds only back + title + language: no coffee link, no weather element",
  !html.includes('id="coffeeLink"') && !html.includes('id="weather"') &&
  !html.includes('class="coffee-link"') && !html.includes('class="weather"'));
check("(b) no weather code left running: no Open-Meteo fetch, no weather timer, no weather functions",
  !html.includes("open-meteo") && !html.includes("loadWeather") &&
  !html.includes("renderWeather") && !html.includes("weatherIconFor") &&
  !html.includes("WEATHER_URL"));
check("(b) back in the left cell, language alone in the right cell and far right",
  html.indexOf('id="headerBack"') > html.indexOf('class="topbar-left"') &&
  html.indexOf('id="headerBack"') < html.indexOf('id="title"') &&
  html.indexOf('id="langBtn"') > html.indexOf('class="topbar-right"') &&
  /\.topbar-right \.langbtn\s*\{[^}]*margin-left:\s*auto/.test(html));

// (c2) Footer BMC button, 2026-10-30 fix: the user reported the button
// NEVER appeared after the af8f126c deploy. Root cause: the loader
// renders via document.writeln(), which only works for a PARSER-inserted
// script tag during page load — the old code appended the script as a
// live DOM node from renderFooter(), which can never render that way.
// The tag is now a literal parser-inserted script in its own #bmcFooter
// container AFTER the JS-rendered footer paragraphs, and renderFooter()
// never touches that container (it resets only #footer innerHTML), so
// the button survives language switches and re-renders. Attributes
// verbatim from the user-supplied tag; it is the ONLY coffee element.
{
  const tag = (html.match(/<script type="text\/javascript" src="https:\/\/cdnjs\.buymeacoffee\.com\/1\.0\.0\/button\.prod\.min\.js"[^>]*><\/script>/) || [])[0] || "";
  const attrsOk = tag.includes('data-name="bmc-button"') && tag.includes('data-slug="joshuasun"') &&
    tag.includes('data-color="#5F7FFF"') && tag.includes('data-emoji=""') &&
    tag.includes('data-font="Poppins"') && tag.includes('data-text="Buy me a coffee"') &&
    tag.includes('data-outline-color="#000000"') && tag.includes('data-font-color="#ffffff"') &&
    tag.includes('data-coffee-color="#FFDD00"');
  check("(c2) footer BMC tag is a literal parser-inserted script with all attributes verbatim",
    attrsOk, tag.slice(0, 120));
  const footIdx = html.indexOf('<footer id="footer">');
  const bmcIdx = html.indexOf('<div id="bmcFooter"');
  check("(c2) BMC container sits AFTER the footer element, outside #footer",
    footIdx !== -1 && bmcIdx > footIdx, JSON.stringify({ footIdx, bmcIdx }));
  const rfStart = html.indexOf("function renderFooter()");
  const rfBody = rfStart === -1 ? "" : html.slice(rfStart, rfStart + 3000);
  check("(c2) renderFooter never touches #bmcFooter and no longer appends a BMC script node",
    !rfBody.includes('getElementById("bmcFooter")') && !rfBody.includes('createElement("script")') &&
    !html.includes('bmc.src = "https://cdnjs.buymeacoffee.com'),
    rfBody.includes('getElementById("bmcFooter")') ? "renderFooter references bmcFooter" : "");
  check("(c2) exactly one BMC element on the page, and no other coffee link/button",
    (html.match(/buymeacoffee/g) || []).length === 1 && !html.includes('id="coffeeLink"'));
}
check("(c) coffee.png still on disk but no longer referenced by the page",
  fs.existsSync(path.join(dir, "public", "icons", "coffee.png")) &&
  !html.includes('icons/coffee.png'));

// (d) Exactly one back control, header only; correct action per view.
check("(d) no per-section back buttons remain in the HTML",
  !/id="searchBack"|id="pickerBack"|id="locBack"|id="mapBack"/.test(html));
check("(d) home shows no back button (onboarding open also shows none: pick closes it)",
  el("headerBack").hidden === true);
T.fns.openSearch();
check("(d) search open: header back appears",
  el("searchScreen").hidden === false && el("headerBack").hidden === false);
el("headerBack").onclick();
check("(d) header back closes search and hides itself (old searchBack action)",
  el("searchScreen").hidden === true && el("headerBack").hidden === true);
T.fns.openPicker("dest");
check("(d) picker open: header back appears",
  el("pickerScreen").hidden === false && el("headerBack").hidden === false);
el("headerBack").onclick();
check("(d) header back closes picker and hides itself (old pickerBack action)",
  el("pickerScreen").hidden === true && el("headerBack").hidden === true);
T.fns.openLocation();
check("(d) location open: header back appears",
  el("locationScreen").hidden === false && el("headerBack").hidden === false);
el("headerBack").onclick();
check("(d) header back closes location and hides itself (old locBack action)",
  el("locationScreen").hidden === true && el("headerBack").hidden === true);
T.fns.showMapScreen("Test map", "");
check("(d) map open: header back appears",
  el("mapScreen").hidden === false && el("headerBack").hidden === false);
el("headerBack").onclick();
check("(d) header back closes map via closeMap and hides itself (old mapBack action)",
  el("mapScreen").hidden === true && el("headerBack").hidden === true);

// (e) zh-Hant rename, served text only.
check("(e) LANG_NAMES zh-Hant is exactly 繁體中文",
  T.names()["zh-Hant"] === "繁體中文", JSON.stringify(T.names()["zh-Hant"]));
check("(e) no served page text still contains 'Traditional Chinese /'",
  !html.includes("Traditional Chinese /"));
check("(e) zh (简体中文) and other names untouched",
  T.names().zh === "简体中文" && T.names().en === "English" &&
  T.names().fr === "Français" && T.names().ja === "日本語");

// (f) Language button behaviour unchanged, full "A文" form on ALL widths
// (the phone-only short "A" switching is gone with the coffee/weather
// header — with only title + button the width budget fits easily).
check("(f) language button still reads A文 and re-opens onboarding on tap",
  el("langBtn").textContent === "A文" && typeof el("langBtn").onclick === "function" &&
  (el("langBtn").onclick(), el("onboarding").hidden === false));
check("(f) language button is plain full 'A文' text: no long/short spans, no short-form switching CSS",
  html.includes('id="langBtn" class="langbtn" aria-label="Change language">A文</button>') &&
  !html.includes("lang-long") && !html.includes("lang-short"));
T.fns.pickLanguage("en");

// (g) Narrow-phone guard, 2026-10-30 fix (user report: long translated
// titles/back labels pushed the language button off screen): language
// button tightened at every breakpoint (desktop 24px, <=640px 22px,
// <=360px 20px; padding 6px 10px, border 2px, radius 12px) and the back
// label hidden at <=640px (arrow only, full label kept in aria-label),
// so phone widths never depend on translated back-label length. Budget
// uses the LONGEST translated title ("Autobus d'Oakville", 19 chars)
// and back shown (arrow only). At 390px: title 22px ~230 + left ~38 +
// right ~60 + padding 24 + gaps 12 = ~364 < 390, each side under its
// ~62px share; at 360px: title 20px ~209 + left ~34 + right ~56 +
// padding 24 + gaps 12 = ~335 < 360, each side under its ~58px share.
// Factors: Latin bold 0.55em/char, "A" 0.62em, CJK 1.0em.
const narrow = (html.match(/@media \(max-width:360px\) \{([\s\S]*?)\n  \}/) || [])[1] || "";
check("(g) narrow guard at <=360px: title 20px, langbtn 20px tightened, back arrow-only",
  narrow.includes(".topbar h1 { font-size:20px") &&
  narrow.includes(".langbtn { font-size:20px; padding:6px 10px") &&
  narrow.includes(".headerback-label { display:none") &&
  narrow.includes(".topbar { padding:10px 12px 6px"));
const compact = (html.match(/@media \(max-width:640px\) \{([\s\S]*?)\n  \}/) || [])[1] || "";
check("(g) compact 640px block: title 22px, langbtn 22px tightened, back arrow-only",
  compact.includes(".topbar h1 { font-size:22px") &&
  compact.includes(".langbtn { font-size:22px; padding:6px 10px") &&
  compact.includes(".headerback { padding:8px 12px") &&
  compact.includes(".headerback-label { display:none") &&
  compact.includes(".topbar { padding:10px 12px 6px; gap:6px"));
check("(g) desktop langbtn tightened: 24px, padding 6px 10px, border 2px, radius 12px",
  /\.langbtn\s*\{[^}]*font-size:\s*24px[^}]*padding:\s*6px 10px[^}]*border:\s*2px[^}]*border-radius:\s*12px/.test(html));
check("(g) langbtn touch height stays >= 40px at the smallest size (20px font + 12px padding + 4px border = 40px)",
  20 * 1.2 + 12 + 4 >= 40);
{
  const budget = (vp, titlePx, langPx, langPad, backShown, backPad) => {
    const title = titlePx * 0.55 * 19;
    const lang = langPx * (0.62 + 1.0) + langPad * 2 + 4;
    const back = backShown ? (10 + backPad * 2 + 4) : 0;
    const pad = 24, gaps = 12;
    const share = (vp - pad - gaps - title) / 2;
    return { title, back, lang, share, total: pad + gaps + title + back + lang };
  };
  for (const [vp, t, l, lp, shown, bp] of [
    [390, 22, 22, 10, true, 12], [390, 22, 22, 10, false, 12],
    [360, 20, 20, 10, true, 10], [360, 20, 20, 10, false, 10]]) {
    const b = budget(vp, t, l, lp, shown, bp);
    check(`(g) header fits ${vp}px, back ${shown ? "shown" : "hidden"}: back ${b.back.toFixed(0)} and lang ${b.lang.toFixed(0)} each under share ${b.share.toFixed(0)}, total ${b.total.toFixed(0)} <= ${vp}`,
      b.back <= b.share && b.lang <= b.share && b.total <= vp, JSON.stringify(b));
  }
  // Desktop (>640px): longest title at 32px, longest back label
  // ("Indietro", 8 chars) shown in full, langbtn 24px.
  const dTitle = 32 * 0.55 * 19, dBack = 10 + 8 * 0.55 * 19 + 24 + 4,
    dLang = 24 * (0.62 + 1.0) + 20 + 4, dTotal = 32 + 16 + dTitle + dBack + dLang;
  check(`(g) desktop header fits 800px with longest title + longest back label: total ${dTotal.toFixed(0)} <= 800`,
    dTotal <= 800, JSON.stringify({ dTitle, dBack, dLang, dTotal }));
}

// (h) No horizontal movement (2026-10-29, user hard requirement): the page
// must never scroll/pan/bounce left-right in any view. clip (not hidden)
// on html+body so the sticky topbar keeps working; hidden is only the
// fallback line. No touch-action change, no viewport scaling change.
const style = (html.match(/<style>([\s\S]*)<\/style>/) || [])[1] || "";
check("(h) html AND body carry overflow-x clip with hidden as fallback",
  /html,\s*body\s*\{[^}]*overflow-x:\s*hidden[^}]*overflow-x:\s*clip/.test(style));
check("(h) overlay also clips horizontally (fixed inset-0 views included)",
  /\.overlay\s*\{[^}]*overflow-x:\s*clip/.test(style));
check("(h) vertical scrolling and zoom untouched: no touch-action:none, no user-scalable/maximum-scale",
  !/touch-action:\s*none/.test(style) &&
  !/user-scalable|maximum-scale/.test(html));
const wideFixed = [...style.replace(/@media[^{]+\{/g, "").matchAll(/(?:width|min-width):\s*(\d+)px/g)]
  .map((m) => Number(m[1])).filter((v) => v >= 340);
check("(h) overflow audit: no fixed px width/min-width >= 340px in the stylesheet",
  wideFixed.length === 0, JSON.stringify(wideFixed));
check("(h) flex/grid children that could force overflow have min-width:0",
  /\.topbar-left\s*\{[^}]*min-width:\s*0/.test(style) &&
  /\.topbar-right\s*\{[^}]*min-width:\s*0/.test(style) &&
  /\.strip-col\s*\{[^}]*min-width:\s*0[^}]*overflow:\s*hidden/.test(style));

console.log(failures === 0 ? "ALL HEADER CHECKS PASSED" : failures + " CHECK(S) FAILED");
process.exit(failures === 0 ? 0 : 1);
