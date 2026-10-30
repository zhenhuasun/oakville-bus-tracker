// Weather-removal harness (2026-10-29): the header weather widget was
// REMOVED by user decision — the original header holds only the centered
// title and the language button, and the Buy Me a Coffee button lives in
// the footer. This file formerly proved the weather feature; it now
// proves its clean removal from the real public/index.html: no weather
// element, no weather CSS, no Open-Meteo fetch, no weather timer, no
// weather functions, and the header is back | title | language only.
// No browser, no network, no deploy.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, "..", "..", "public", "index.html"), "utf8");

let failures = 0;
function check(name, cond, extra = "") {
  console.log((cond ? "PASS" : "FAIL") + " " + name + (cond ? "" : " " + extra));
  if (!cond) failures++;
}

// (a) Header is back | title | language only — no weather slot anywhere.
const bi = html.indexOf('id="headerBack"'), ti = html.indexOf('id="title"'),
  li = html.indexOf('id="langBtn"');
check("(a) header DOM order is back | title | language",
  bi !== -1 && ti !== -1 && li !== -1 && bi < ti && ti < li);
check("(a) no weather element in the header or anywhere else on the page",
  !html.includes('id="weather"') && !html.includes('class="weather"') &&
  !/\.weather\s*\{/.test(html));

// (b) No weather code left: no fetch URL, no functions, no timer.
check("(b) no Open-Meteo URL, no weather functions, no weather timer",
  !html.includes("open-meteo") && !html.includes("WEATHER_URL") &&
  !html.includes("weatherIconFor") && !html.includes("loadWeather") &&
  !html.includes("renderWeather") && !html.includes("weatherState"));

// (c) No coffee in the header either (it moved to the footer); the only
// buymeacoffee reference is the footer button's script source.
check("(c) no header coffee link; exactly one buymeacoffee reference (the footer button src)",
  !html.includes('id="coffeeLink"') && !html.includes('class="coffee-link"') &&
  (html.match(/buymeacoffee/g) || []).length === 1);

// (d) The footer button attributes are verbatim from the user-supplied
// tag, as a literal parser-inserted script (2026-10-30 fix — the old
// JS-appended node could never render via document.writeln).
for (const [attr, val] of [
  ["data-name", "bmc-button"], ["data-slug", "joshuasun"],
  ["data-color", "#5F7FFF"], ["data-emoji", ""],
  ["data-font", "Poppins"], ["data-text", "Buy me a coffee"],
  ["data-outline-color", "#000000"], ["data-font-color", "#ffffff"],
  ["data-coffee-color", "#FFDD00"]]) {
  check(`(d) footer BMC script tag carries ${attr}="${val}"`,
    html.includes(`${attr}="${val}"`));
}
check("(d) footer BMC script source is the official cdnjs URL, parser-inserted in #bmcFooter after the footer",
  html.includes('<script type="text/javascript" src="https://cdnjs.buymeacoffee.com/1.0.0/button.prod.min.js"') &&
  html.indexOf('<div id="bmcFooter"') > html.indexOf('<footer id="footer">') &&
  !html.includes('bmc.src = "https://cdnjs.buymeacoffee.com'));

// (e) The header's horizontal lock and centered grid are untouched by
// the removal (regression guard, not a weather check).
const style = (html.match(/<style>([\s\S]*)<\/style>/) || [])[1] || "";
check("(e) topbar grid 1fr/auto/1fr, LTR, and html+body overflow-x clip untouched",
  /\.topbar\s*\{[^}]*grid-template-columns:\s*minmax\(0,1fr\)\s+auto\s+minmax\(0,1fr\)/.test(html) &&
  /\.topbar\s*\{[^}]*direction:\s*ltr/.test(html) &&
  /html,\s*body\s*\{[^}]*overflow-x:\s*hidden[^}]*overflow-x:\s*clip/.test(style));

if (failures) { console.log(failures + " FAILURES"); process.exit(1); }
console.log("all weather-removal checks pass");
