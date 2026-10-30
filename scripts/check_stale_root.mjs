#!/usr/bin/env node
// check_stale_root.mjs — local gate: fails if files that were moved out of
// the repo root in the Commit 2/3/4 cleanup reappear at the root.
// Run: npm run check (or: node scripts/check_stale_root.mjs).
// This is a LOCAL gate; it is intentionally not run in CI.
// No dependencies; uses only node:fs / node:path / node:url.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// .py files moved to scripts/ (10) and archive/scripts/ (3) in Commit 3.
// build_lang22.py is deliberately NOT in this list: it stays at root (P3).
const MOVED_PY = [
  "apply_lang22.py",
  "apply_street_rule.py",
  "build_schools.py",
  "build_stage21.py",
  "derive_pairs.py",
  "derive_places.py",
  "derive_shapes.py",
  "derive_stops.py",
  "derive_timetable.py",
  "geocode_schools.py",
  "measure_street.py",
  "patch_stage2.py",
  "schools_list.py",
];

// Root JSONs moved to data/ in Commit 2 (copied) and deleted at root in Commit 4.
const MOVED_JSON = [
  "schools-geocoded.json",
  "schools-pending-decision.json",
  "street-audit.json",
];

// Allowed at root by design (not flagged even if present):
// worker.js, package.json, wrangler.toml, *.md, .gitignore, build_lang22.py.
// Everything else at root is ignored by this check (out of scope).

const entries = fs
  .readdirSync(ROOT, { withFileTypes: true })
  .filter((e) => e.isFile())
  .map((e) => e.name);

const stale = [];
for (const name of entries) {
  if (name.endsWith(".mjs")) stale.push(name); // any .mjs at root (Commit 2 moved all 34)
  else if (MOVED_PY.includes(name)) stale.push(name);
  else if (MOVED_JSON.includes(name)) stale.push(name);
}

if (stale.length > 0) {
  console.log("FAIL: stale files at repo root (moved in Commits 2/3/4, must live elsewhere):");
  for (const name of stale) console.log("  - " + name);
  console.log("Remove them (or move them to their Commit 2/3/4 homes) and re-run npm run check.");
  process.exit(1);
}
console.log("PASS: no stale root files (no root .mjs, no moved .py, no moved root JSON).");
