// Street-based mapping rule harness (user decision 2026-10-29:
// "按街道算 但是备注里把距离写上"). Pure-data checks against
// public/places.json + street-audit.json + the pre-change backup
// (/tmp/places_before_streetrule.json is ephemeral, so this harness
// re-derives the "before" straight values from street-audit.json's
// straight_m column instead of depending on the backup file).
//   (a) every place's stop.distance_m equals its street-audit street value
//   (b) the 24 places with street >400 m and straight <=400 m are
//       note-bearing (note = "Street walk {m} m from nearest stop",
//       exactly once) and NOT longWalk, so the distance shows once
//       per search row (placeTags renders longWalk label + note;
//       setting both would duplicate it)
//   (c) counts still 230 + 9, no place excluded, no category/stop/
//       coordinate/name changed (multiset vs street-audit identity:
//       id + name + cat, and stop id/code from places.json itself)
//       EXCEPT Longo's 338 Dundas St E, whose placeholder coordinates
//       were corrected 2026-10-29 (see (f)) — the one intended
//       coordinate/stop change in this batch
//   (d) meta states the street rule
//   (e) the 7 longWalk schools keep longWalk with street walkFromStop_m
//   (f) Longo's 338 Dundas St E is CORRECTED and remapped:
//       Nominatim-verified 43.4883376, -79.7175689 (OSM way 27500951),
//       Trafalgar + Dundas stop 1657 code 2109 routes 1/37,
//       151 m straight / 336 m street, no Street-walk note
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(dir, "public", "places.json"), "utf8"));
const audit = JSON.parse(fs.readFileSync(path.join(dir, "street-audit.json"), "utf8")).results;
const html = fs.readFileSync(path.join(dir, "public", "index.html"), "utf8");

let fail = 0;
const check = (name, ok, extra = "") => {
  console.log((ok ? "PASS " : "FAIL ") + name + (extra ? " — " + extra : ""));
  if (!ok) fail++;
};

const places = data.places, stations = data.stations;
check("(c) 230 places", places.length === 230, String(places.length));
check("(c) 9 stations", stations.length === 9, String(stations.length));
check("(a) audit rows match places count", audit.length === places.length);
let distOk = true, distBad = [];
for (let i = 0; i < places.length; i++) {
  const p = places[i], r = audit[i];
  if (p.id !== r.id || p.name !== r.name) { distOk = false; distBad.push(`pos ${i}: ${p.id} vs ${r.id}`); }
  if (p.stop.distance_m !== r.street_m) { distOk = false; distBad.push(`${p.name}: ${p.stop.distance_m} != ${r.street_m}`); }
  if (r.street_m === null || r.street_m === undefined) { distOk = false; distBad.push(`${p.name}: null street`); }
}
check("(a) every distance_m equals street-audit street value (positional, id+name verified)", distOk, distBad.slice(0, 5).join("; "));

// (b) the 24 (25 before the 2026-10-29 Longo's correction)
const over25 = [];
for (let i = 0; i < places.length; i++) {
  const p = places[i], r = audit[i];
  if (r.straight_m <= 400 && r.street_m > 400 && !p.longWalk) over25.push([p, r]);
}
check("(b) exactly 24 note-bearing over-400 m street places (straight <=400)", over25.length === 24, String(over25.length));
let notesOk = true, notesBad = [];
for (const [p, r] of over25) {
  const want = `Street walk ${r.street_m} m from nearest stop`;
  if (!p.note || !p.note.includes(want)) { notesOk = false; notesBad.push(`${p.name}: note=${JSON.stringify(p.note)}`); }
  if ((p.note.match(/Street walk/g) || []).length !== 1) { notesOk = false; notesBad.push(`${p.name}: Street walk count != 1`); }
  if (p.longWalk) { notesOk = false; notesBad.push(`${p.name}: unexpectedly longWalk`); }
}
check("(b) each of the 24 has its street distance in the note, exactly once, and is not longWalk", notesOk, notesBad.slice(0, 5).join("; "));
// No other non-longWalk place carries a "Street walk" note, except
// Food Basics Clarkson Village (2026-10-29, user decision): its
// straight distance (600 m) is already over 400 m, so it is not
// one of the automatic 24 — its note is the explicit label the
// user asked for, set at entry time, not by apply_street_rule.
const stray = places.filter((p) => !p.longWalk && (p.note || "").includes("Street walk") &&
  !over25.some(([q]) => q === p) && p.id !== "food-basics-clarkson-village");
check("(b) no stray Street-walk notes outside the 24 (except user-decided Food Basics Clarkson Village)", stray.length === 0, stray.map((p) => p.name).join(", "));

// (e) 7 longWalk schools
const schools = places.filter((p) => p.longWalk);
check("(e) exactly 7 longWalk places, all schools", schools.length === 7 && schools.every((p) => p.cat === "school"),
  schools.map((p) => p.name).join(", "));
let schOk = true;
for (const p of schools) {
  const r = audit[places.indexOf(p)];
  if (p.walkFromStop_m !== r.street_m || p.stop.distance_m !== r.street_m) schOk = false;
}
check("(e) longWalk schools' walkFromStop_m and distance_m are street values", schOk);

// (f) Longo's CORRECTED + remapped (2026-10-29, Nominatim OSM way 27500951)
const longo = places.find((p) => p.id === "longos-dundas-east");
const longoAudit = audit[places.indexOf(longo)];
check("(f) Longo's 338 Dundas St E remapped to Trafalgar + Dundas stop 1657, 336 m street, no note",
  !!longo && longo.lat === 43.4883376 && longo.lon === -79.7175689 &&
  longo.stop.id === "1657" && longo.stop.code === "2109" && longo.stop.distance_m === 336 &&
  JSON.stringify(longo.routes) === JSON.stringify(["1", "37"]) &&
  !(longo.note || "").includes("Street walk") &&
  longoAudit && longoAudit.straight_m === 151 && longoAudit.street_m === 336,
  longo ? `${longo.lat},${longo.lon} stop ${longo.stop.id} ${longo.stop.distance_m}m routes ${longo.routes} note=${JSON.stringify(longo.note)} audit ${longoAudit.straight_m}->${longoAudit.street_m}` : "missing");

// (d) meta states the street rule
check("(d) meta.street_rule states street (routed-foot) rule",
  typeof data.meta.street_rule === "string" && data.meta.street_rule.includes("STREET") && data.meta.street_rule.includes("routed-foot"));
check("(d) meta.note states street rule and kept-not-excluded",
  data.meta.note.includes("STREET") && data.meta.note.includes("KEPT"));

// Rendering path: placeTags appends longWalk label only if longWalk,
// then note — so a note-bearing non-longWalk place shows the distance
// exactly once. Verify the code shape, not just the data.
check("rendering: placeTags renders longWalk label conditionally + note",
  html.includes('pl.longWalk ? " · " + t("longWalkLabel")') && html.includes('(pl.note ? " · " + pl.note : "")'));

console.log(fail === 0 ? "ALL PASS" : `${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
