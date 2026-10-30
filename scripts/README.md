# scripts/ — manually run data generation / validation scripts (.py)

Reusable pipeline scripts. Run from the repository root, e.g.
python3 scripts/derive_pairs.py --help. Scripts resolve the repo root
from their own location, so they work regardless of the caller's
working directory.

- derive_*.py — derive served public/*.json from the Oakville static
  GTFS package (ArcGIS download or a local --zip / --static dir).
- build_*.py — merge steps that build public/places.json
  (build_schools.py, then build_stage21.py, in the documented order).
- geocode_schools.py (+ schools_list.py data module) — Nominatim
  geocoding of the 74-school research list.
- measure_street.py — routed-foot street distances into
  data/generated/street-audit.json.

One-off apply/patch scripts live in archive/scripts/, not here.
Python dependencies: standard library only, except the P3 script
build_lang22.py (needs zhconv), which stays at the repo root
pending human review and is not part of this directory.
