# Changelog — Oakville Bus Tracker

Update history: dated changes and decisions, newest first. The README
describes the current state; this file is the record of how it got
there. Implementation detail lives in the code, the tests, and
`scripts/README.md` — this file keeps the decisions and the
user-visible changes.

## Unreleased / pending (not built, not decided)

- GitHub Pages verification: confirm Pages source is GitHub Actions,
  the first deployment ran, and the Pages origin serves with live data
  from the Worker. Also open: whether workers.dev should be synced to
  the dual-origin frontend now or at the next deploy.
- User eye-check of the strip v3 board and of the Buy Me a Coffee
  footer button on a real phone (this machine cannot screenshot).
- Timetable expiry decision: what the site does if no new static
  package arrives — warning-only vs disabling timetable use. The
  footer already warns past the valid-through date.
- Step-by-step mode (one-action cards for a journey): approved to build
  only after the board was accepted. Not built; three open questions
  (manual paging vs GPS auto-advance, card count for 2-transfer
  journeys, board-only entry vs straight into step mode).

## 2026-10-30 — Repo cleanup, strip v3, dual-origin

- **Repo cleanup (Commits 1–5, then A–F).** Tests moved to
  `tests/node/` (32-file default suite) + `tests/node/live/` (live
  suite, excluded from `npm test`); scripts to `scripts/` and
  `archive/scripts/`; data to `data/` and `data/generated/`;
  `archive/` holds one-off history; `package.json` gained
  `type: module`, `test` / `test:live` / `check` scripts; a
  stale-root guard (`npm run check`) fails if old root files
  reappear; CI YAML delivered for manual web-UI creation (the push
  tool cannot write `.github/workflows/`); `HANDOFF.md` lists the
  human actions (51 stale remote root files to `git rm`, CI file to
  create). No test logic changed; `public/` untouched.
- **Strip v3 (live).** Transfer legs keep a branch below the main
  line that merges into it at the board dot like a railway turnout,
  then travel the main line to their terminus; finished legs'
  tracker icons disappear (including the bus-column icon when leg 1
  is finished) and travelled road goes dashed; no-live in-progress
  legs get a "boarded" mode (waiting icon stays, branch dashed, main
  segment solid). Walk zigzag unchanged. The strip bus marker is the
  rounded-corner icon tile, never a blue dot.
- **Dual-origin frontend.** On `*.github.io` the page calls the
  Worker as its API backend; manifest and asset references made
  relative so one build serves both origins. Worker unchanged (CORS
  `*` on `/api/*` already). GitHub repo created and all text files
  pushed; icon PNGs uploaded via web UI (push tool corrupts binaries).
- **Header + Buy Me a Coffee (live).** Header is back button +
  centred "Oakville Bus" title + "A文" language button only; coffee
  link and weather widget removed. The Buy Me a Coffee button is a
  literal parser-inserted script tag in the footer (a JS-appended tag
  can never render — the loader uses `document.writeln()`).
- **Languages: 162 keys × 22.** The `notLiveYet` key completed the
  set. New i18n keys must be placed after the wholesale-replacement
  merges or they are silently wiped for 6 languages.
- **Known, documented, deferred:** `test_google13.mjs` is
  time-of-day dependent (a past-date depart input is clamped to
  today+now, so evening runs may find no departures). Daytime runs
  are green. Fixing it is a test-design change, not a logic change,
  and is out of scope for the cleanup.

## 2026-10-29 — 22 languages, street walking, sort, 230 places

- **22 languages live** (English and French first, then 2021 Census
  Oakville mother-tongue order; zh-Hant machine-converted draft,
  human review outstanding). First-open language onboarding.
- **Street rule (user decision: "按街道算 但是备注里把距离写上").**
  Every place's distance is a routed-foot street distance; places
  over 400 m street are kept with an explicit note (24 note-bearing).
  Origin boarding walk capped at 1000 m street; transfer walks at
  300 m street; destination walks uncapped.
- **Routed-foot correction (user-caught).** `router.project-osrm.org`
  serves car routing only — the 822 m "Third Line crossing blocker"
  was a car artifact. Correct service:
  `routing.openstreetmap.de/routed-foot` (986 → 327 = 112.9 m, so
  the Oakville GO → Hospital proof journey survives; 162 → 1071 =
  456.5 m, so that transfer is correctly rejected). Elderly speed
  0.8 m/s.
- **Multi-transfer (up to 2 transfers), time picker (Leave now /
  Depart at / Arrive by), four sort modes** (total time, fewest
  transfers, least walking, earliest arrival). Direct options never
  hidden. Sort re-ranks the full candidate pool; state is
  session-only.
- **Lightweight PWA**: home-screen icon + standalone, no offline
  cache (a cache could serve a timetable past expiry).
- **Places 230 + 9 stations.** Added: Monastery Bakery &
  Delicatessen, Food Basics Clarkson Village (cross-boundary, 868 m
  street note), Farm Boy Bronte (2441 Lakeshore Rd W — resolving the
  "Sobeys at 2441" question). Longo's 338 Dundas St E corrected
  from a placeholder coordinate to Nominatim-verified
  43.4883376, −79.7175689 (stop 1657, 336 m street).
- **Save-UI, homepage, and search/time batches (user decisions).**
  Homepage opens empty (no restore on load); Swap disabled until
  both fields are set; Swap is the sole return-trip control;
  quick-fill removed entirely; saved places (max 8, localStorage)
  are the only shortcut; search results directly below the input;
  picker local results render synchronously (only Nominatim stays
  debounced).
- **Board frozen, then changed only on request.** "棋盘先这样"
  (2026-10-29): the board was frozen as of collision-fix round 2;
  later strip changes were each explicitly requested.

## 2026-10-28 — Stages 1–3, schools, P0, boarding-stop choice

- **Stage 1.** Language onboarding (5 languages at the time), top
  language button, saved places + custom names, browser-only current
  location (never auto-picked), search over saved places / prototype
  destinations / stops.
- **Stage 2.** Journey engine for any origin/destination stop:
  direct first, then at most one transfer (5-minute minimum, 300 m
  walking cap, 0.8 m/s). Full timetable (`timetable.json`: 2,779
  trips, 80,837 stop-times) and `places.json` (120 places at the
  time). Real-time applied per leg; future-day legs always
  timetable.
- **Stage 2.1.** Category results come only from the place category
  field (fixed the bank/school substring bug); 9 hub stations only;
  Shopping Centre (13), Community Centre (Town municipal only, 7),
  Library (7 full OPL branches only), hospital + labs merged (9),
  Asian + Specialty merged. Places 153 + 9 stations.
- **Stage 3.** Trip-only Leaflet map: verbatim GTFS shapes per leg
  (35 routes, 111 shapes, 89,510 points), origin/transfer/
  destination markers, street walking segments, live bus dots
  matched by original_trip_id + route_id. Map never loads on first
  render; board works if tiles fail.
- **P0 symmetric navigation + P0b.** Two symmetric fields, one
  picker, Swap; address search via Nominatim (single implementation,
  1 req/s, Oakville-bounds filter); map pin = last tap only; My
  location returns an address (reverse-geocoded), never a stop list,
  and never an invented address on failure.
- **Boarding-stop choice (user-reported bug).** Origins with
  coordinates now try all stops within 500 m (max 5), ranked by
  door-to-door outcome; the board shows the chosen stop and a "Try
  another boarding stop" list. Proof: home at stop 228 arrives
  Oakville GO 09:00, stop 750 (330 m) arrives 08:38.
- **Schools geocoded: 74/74, 0 guessed** (OSM Nominatim, bounds +
  town + street-number checks). All schools included (user
  decision), including 7 over-400 m with true nearest stops and
  walking labels. Build order: build_schools → build_stage21
  (repeatable, stable).
- **Phase 1+3-only deploy option, then Phase 2 re-enabled.**
  Phase 2 (street walking) was held behind a flag while the OSRM
  car-routing artifact was investigated, then re-enabled once
  routed-foot was confirmed.
- **Corrections recorded.** Bronte GO → Hospital DOES have a direct
  return (82 departures, route 3) — the earlier "no return" claim
  was a lookup artifact. Timetable stores minutes past midnight
  (max 1459); plain time comparison is correct across midnight.

## 2026-10-27 — First board, data clearance, join rules

- **Conceived (2026-10-26).** Multilingual, simple, ad-free LOCAL
  transit tracker for Oakville/GTHA newcomers, especially elderly
  newcomers. Subtraction first: no full-city browsing, no
  driving/cycling/rideshare modes, no popups.
- **Data clearance (email, Transit Customer Service).** Static GTFS
  via ArcGIS + GTFS-Realtime at busfinder.oakvilletransit.ca/gtfsrt/
  may be used together for transit apps, under the Town of Oakville
  Open Government Licence with attribution.
- **Join rules measured.** Correct key: original_trip_id + route_id
  + current-date service (static ids carry `_merged_<n>` suffixes).
  Trip joins 100%; stop joins 753/753. Only vehicles with a trip_id
  shown as in-service.
- **First live board.** Direct-pair board with countdown, strip,
  and RT proxy. Prototype pairs: 18 of 28 origin × destination
  pairs have a direct ride (2 same-place pairs skipped).
- **CORS finding.** GTFS-RT endpoints return no
  `Access-Control-Allow-Origin`, so the site proxies them via the
  Worker (`/api/rt/*`).
- **Scope decisions.** Local transit only; directly-reached
  Burlington/Mississauga places included as cross-boundary direct,
  transfer-only places excluded. South Common excluded (too far).
  No place called "Oakville Mall" — Oakville Place is the only
  enclosed mall. Famijoy closed; its Trafalgar Village unit is now
  Iqbal Foods Oakville (opened Oct 15, 2026).
