// Lightweight PWA harness (2026-10-29, user-approved scope): proves the
// manifest parses with name/short_name/display standalone/start_url/
// theme_color/icons 192+512, the head wires manifest + theme-color +
// apple-touch-icon + iOS standalone metas, NO service worker is
// registered or referenced anywhere, and the icon files exist at the
// manifest's paths with the correct pixel sizes. No browser, no network,
// no deploy. Static file checks only — no VM needed.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
let failures = 0;
function check(name, cond, extra) {
  if (cond) console.log("PASS " + name);
  else { failures++; console.log("FAIL " + name + (extra ? " — " + extra : "")); }
}

const html = fs.readFileSync(path.join(dir, "..", "..", "public", "index.html"), "utf8");
const manifestPath = path.join(dir, "..", "..", "public", "manifest.webmanifest");
check("manifest file exists", fs.existsSync(manifestPath));
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
check("manifest parses as JSON", !!manifest);
check("manifest name", manifest.name === "Oakville Bus", manifest.name);
check("manifest short_name", manifest.short_name === "Oakville Bus", manifest.short_name);
check("manifest display standalone", manifest.display === "standalone", manifest.display);
check("manifest start_url . (dual-origin: Worker / and Pages subpath)", manifest.start_url === ".", manifest.start_url);
check("manifest scope . (dual-origin: Worker / and Pages subpath)", manifest.scope === ".", manifest.scope);
check("manifest theme_color is site blue", manifest.theme_color === "#0b5cab", manifest.theme_color);
check("manifest background_color", !!manifest.background_color, manifest.background_color);
check("manifest description English only (single string)", typeof manifest.description === "string" && manifest.description.length > 0);
const icons = manifest.icons || [];
const bySize = {};
for (const ic of icons) bySize[ic.sizes] = ic;
check("manifest has 192 icon", !!bySize["192x192"]);
check("manifest has 512 icon", !!bySize["512x512"]);
check("manifest has maskable 512 icon", icons.some((ic) => ic.sizes === "512x512" && (ic.purpose || "").includes("maskable")));

// PNG pixel sizes (parse IHDR, no image library needed).
function pngSize(p) {
  const b = fs.readFileSync(p);
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
for (const ic of icons) {
  const src = (ic.src || "").replace(/^\//, "");
  const p = path.join(dir, "..", "..", "public", src);
  check("icon file exists: " + ic.src, fs.existsSync(p));
  if (fs.existsSync(p)) {
    const sz = pngSize(p);
    const want = parseInt(ic.sizes.split("x")[0], 10);
    check("icon pixel size " + ic.src, sz && sz.w === want && sz.h === want,
      sz ? `${sz.w}x${sz.h} vs ${want}` : "not a PNG");
  }
}

const head = html.split("</head>")[0];
check("head links manifest", /<link rel="manifest" href="manifest\.webmanifest">/.test(head));
check("head theme-color meta", /<meta name="theme-color" content="#0b5cab">/.test(head));
check("head apple-touch-icon link", /<link rel="apple-touch-icon" href="icons\/apple-touch-icon\.png">/.test(head));
check("head iOS standalone capable meta", /<meta name="apple-mobile-web-app-capable" content="yes">/.test(head));
check("head iOS status-bar-style meta", /<meta name="apple-mobile-web-app-status-bar-style" content="default">/.test(head));
const apple = path.join(dir, "..", "..", "public", "icons", "apple-touch-icon.png");
check("apple-touch-icon file exists", fs.existsSync(apple));
if (fs.existsSync(apple)) {
  const sz = pngSize(apple);
  check("apple-touch-icon is 180x180", sz && sz.w === 180 && sz.h === 180, sz ? `${sz.w}x${sz.h}` : "not a PNG");
}
// No service worker, anywhere in the served page or worker.
check("no serviceWorker string in page", !/serviceWorker/i.test(html));
check("no service-worker file in public/", !fs.existsSync(path.join(dir, "..", "..", "public", "sw.js")) && !fs.existsSync(path.join(dir, "..", "..", "public", "service-worker.js")));
const worker = fs.readFileSync(path.join(dir, "..", "..", "worker.js"), "utf8");
check("worker.js has no service-worker handling", !/serviceWorker/i.test(worker));

if (failures) { console.log(failures + " FAIL(s)"); process.exit(1); }
console.log("ALL PWA CHECKS PASS");
