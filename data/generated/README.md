# data/generated/ — regenerable intermediate data

Files here can be regenerated from source; do not hand-edit them,
regenerate instead.

- schools-geocoded.json — output of scripts/geocode_schools.py
  (OSM Nominatim, slow); input to scripts/build_schools.py and
  tests/node/test_schools.mjs.
- street-audit.json — output of scripts/measure_street.py
  (routed-foot street distances, never served); input to
  tests/node/test_streetrule.mjs (its apply step,
  archive/scripts/apply_street_rule.py, is already applied).
