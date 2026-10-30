# scripts/ — manually run data generation / validation scripts (.py)

Reusable pipeline scripts. Run from the repository root, e.g.
python3 scripts/derive_pairs.py --help. Every script resolves the
repo root from its own location (ROOT = parent of scripts/), so
--out defaults always land in public/ regardless of the caller's
working directory.

- derive_pairs.py — ArcGIS zip (or --zip) -> public/pairs.json.
  Holds the _merged trip-id join logic (see README.md, Join rules).
- derive_timetable.py — ArcGIS zip (or --zip) -> public/timetable.json
  (current services only).
- derive_stops.py — unzipped GTFS dir -> public/stops.json.
  --static-dir defaults to ../oakville-gtfs-check/static relative to
  the workspace (NOT the repo); --zip unpacks to a temp dir instead.
- derive_shapes.py — static shapes.txt + public/timetable.json ->
  public/shapes/<route>.json. Its --static default is still the
  absolute ~/workspace/oakville-gtfs-check/static (TODO: same
  repo-relative cleanup as the derive_places SRC note above).
- derive_places.py — preset research -> public/places.json. Reads
  the research doc at ~/workspace/oakville-gtfs-check/PRESET-
  DESTINATIONS.md (absolute path; the same text is mirrored at
  research/PRESET-DESTINATIONS.md in this repo).
- build_schools.py — data/generated/schools-geocoded.json +
  data/schools-pending-decision.json -> merge into public/places.json.
- build_stage21.py — Stage-21 preset additions -> public/places.json
  (idempotent add() calls). Run order with build_schools.py is
  schools -> stage21 -> schools -> stage21 (see README.md).
- geocode_schools.py (+ schools_list.py, a data module, not a
  script) — OSM Nominatim geocoding of the 74-school research list
  -> data/generated/schools-geocoded.json. schools_list.py must stay
  beside its importer; it has no __main__ guard by design.
- measure_street.py — routed-foot street distances for every place
  -> data/generated/street-audit.json (never served). Has a
  __main__ guard; importing it runs nothing.

One-off apply/patch scripts live in archive/scripts/, not here.
build_lang22.py stays at the repo root (P3, see audit Finding 2):
its /tmp/allpacks.json input is gone, so it cannot rerun as-is.
Python dependencies: standard library only, except build_lang22.py
(needs zhconv).
