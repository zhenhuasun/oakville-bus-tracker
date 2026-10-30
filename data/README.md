(File layout described here is the target state; files arrive in Commits 2/4/5.)

# data/ — canonical non-served data

Files here are inputs to the pipeline, not web assets. Served data
(timetable.json, places.json, stops.json, pairs.json, shapes/, icons)
stays in public/ — the Worker serves it ([assets] directory) and the
Pages workflow publishes it. Do not move served files here.

- schools-pending-decision.json — curated human decisions on
  single-source places (NOT regenerable; preserve byte-for-byte).
  Read by scripts/build_schools.py and tests/node/test_schools.mjs.

generated/ holds regenerable intermediates (see generated/README.md).
