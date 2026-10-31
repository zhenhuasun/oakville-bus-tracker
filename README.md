# Oakville Bus Tracker

One screen for elderly newcomers in Oakville, Ontario: pick where you are
and where you are going, and the screen answers — which route, which
stop to wait at (English stop name + stop code, as on the sign), where
the bus is now, and how many minutes away, in very large type — plus the
next bus if this one is missed, and a one-tap return trip.

Local Oakville Transit only. No cross-city planning, no full-city map, no
ticketing, no ads, no popups, no login.

**Live:** https://oakville-bus-tracker.zhenhuasun.workers.dev
(Cloudflare Worker `oakville-bus-tracker`).

## What it does

- **22 languages**, picked on first open (English and French first, then
  2021 Census Oakville mother-tongue order). Place, street, and stop
  names are never translated. Translations are drafts, not
  human-reviewed.
- **Symmetric origin / destination navigation**: each field accepts a
  saved place, any of the 230 preset places, one of 9 hub stations, an
  exact stop code, a map pin, a typed address, or your current location.
  Swap is the only return-trip control. The homepage opens empty; saved
  places (max 8, on your phone only) are the shortcut.
- **Journey search up to 2 transfers**, with a time picker (Leave now /
  Depart at / Arrive by) and four sort modes (shortest total time,
  fewest transfers, least walking, earliest arrival). A direct option is
  never hidden. Walking is measured on the street network
  (OSRM foot routing), at a conservative 0.8 m/s; walking transfers are
  capped at 300 m street distance.
- **A route strip below the countdown** that shows the journey as
  columns (bus, origin, each transfer, destination) with live bus
  positions per leg. Times on the strip are scheduled times; live
  predictions appear only in the countdown label and the
  "(x stops away, est. ~y min)" note.
- **A trip-only map** (one journey at a time, verbatim GTFS shapes),
  opened from the board. It never loads on first render.
- **Lightweight PWA**: home-screen icon + standalone display, no
  offline cache (a cache could serve a timetable past its expiry).

## Quick start

```sh
npx wrangler dev     # local dev: site + /api/rt/* proxy on localhost
npm test             # default test suite (32 offline Node gates)
npm run test:live    # live-network suite, separately (needs live GTFS-RT)
npm run check        # local stale-root gate (not run in CI)
npx wrangler deploy  # needs your Cloudflare API token + account ID;
                     # never put a token in this repo
```

Local-dev note: in a restricted sandbox VM, local `wrangler dev` may
return 502 for `/api/rt/*` (the local workerd runtime cannot complete
TLS to outside hosts there) while the identical handler works under
Node. That is a local-dev egress limitation, not a code bug — the site
still loads and runs in Timetable mode. After a deploy, verify the live
`/api/rt/vehicles` endpoint returns `ok: true` before announcing live
data.

## Layout

| Path | What it is |
|---|---|
| `worker.js` | Cloudflare Worker: serves the static site and proxies GTFS-Realtime server-side (see below). |
| `wrangler.toml` | Worker config. Worker name: `oakville-bus-tracker`. Assets directory: `public/`. |
| `package.json` | `type: module` (all `.mjs` files and `worker.js` are ESM). Scripts: `test`, `test:live`, `check`. |
| `.gitignore` | Python junk, `.wrangler/`, editor files. `public/` data is committed on purpose. |
| `README.md` | This file. |
| `CHANGELOG.md` | Update history: dated changes and decisions, newest first. |
| `HANDOFF.md` | Human action list from the repo cleanup (remote deletions, CI setup). |
| `build_lang22.py` | Stays at root by design (P3): the 22-language draft generator. Its `/tmp/allpacks.json` input is gone, so it cannot rerun as-is. |
| `public/` | Served frontend + data: `index.html`, `manifest.webmanifest`, `icons/`, `places.json` (230 places + 9 stations), `stops.json`, `timetable.json`, `pairs.json`, `shapes/` (35 routes). |
| `data/` | Non-served data: `data/generated/` (regenerable intermediates: `schools-geocoded.json`, `street-audit.json`) and `data/schools-pending-decision.json` (curated decisions, not regenerable). |
| `scripts/` | Manually run data generation / validation scripts (`.py`). See `scripts/README.md`. |
| `tests/` | Automatable regression tests: `tests/node/` (default suite), `tests/node/live/` (live-network tests, excluded from the default suite), `tests/e2e/` (browser tests, none yet). See `tests/README.md`. |
| `archive/` | One-off scripts and historical verification (never run in CI or `npm test`): `archive/tests/`, `archive/scripts/`, `archive/stage2_block.txt`. |
| `research/` | Research notes and preset-destination sources (`.md` only). |
| `lang-drafts/` | Translation sources (outside `public/`, not served). |

## How it works

### Live data proxy

The Oakville GTFS-Realtime endpoints return no
`Access-Control-Allow-Origin` header, so a browser cannot fetch them
directly. The Worker fetches them server-side, parses the protobuf,
and returns JSON with `Access-Control-Allow-Origin: *`, cached
~30 seconds (the feed's own refresh rate). The feeds need no secret or
API key — none is in the code.

- `GET /api/rt/vehicles` — in-service vehicles + position-only
  vehicles (`has_trip` tells them apart; only `has_trip` vehicles are
  shown as buses)
- `GET /api/rt/trips` — trip updates with per-stop predicted times
- `GET /api/rt/alerts` — service alerts (English originals; the
  frontend translates them by template and always offers the English
  original)
- `GET /api/health` — liveness check

If any live endpoint fails, the frontend labels the board
**Timetable**, never **LIVE**. A bus is labelled LIVE only when a
TripUpdate exists for that trip at the boarding stop.

The static frontend is also published from `public/` via the GitHub
Pages workflow (`.github/workflows/pages.yml`); on that origin the
page calls the Worker as its API backend (cross-origin, CORS `*`).

### Join rules (critical)

- A static `trip_id` is plain, or `original_trip_id + "_merged_<n>"`.
- A real-time `trip_id` equals the **original** trip id (or the plain
  id for unmerged trips). Live trips match on
  **(original_trip_id, route_id, current-date service)** — route_id is
  part of the key because the same original appears under different
  routes in the old and new signup.
- Static `stop_id`s also carry `_merged_<n>` suffixes; the suffix is
  stripped before matching a real-time `stop_id`.
- Only vehicles with a `trip_id` are shown as in-service buses.
- Shape key is `(service_id, original_trip_id)`: exactly one shape for
  every timetable trip. `(route, original)` alone is unsafe
  (52 collisions) and is never used.

### Places and walking

- Every place maps to its true nearest GTFS stop. Place distances are
  **street distances** (routed-foot), not straight-line: places over
  400 m street are kept with an explicit street-distance note, never
  dropped and never mapped to a fake closer stop.
- Category browsing matches a place's category field exactly, never
  stop-name substrings. Stations are the 9 hub stations only.
- Walking uses the FOSSGIS OSRM foot service
  (`routing.openstreetmap.de/routed-foot`), which sends coordinates
  only. Never use `router.project-osrm.org`: that demo server serves
  car routing only, regardless of the profile word in the path.
- The 7 over-400 m schools keep their true nearest stops with an
  explicit walking label; all 74 researched schools are included.

### Data refresh

When Oakville publishes a new static package, in order:

```sh
python3 scripts/derive_pairs.py       # downloads the ArcGIS zip fresh
python3 scripts/derive_stops.py       # regenerates public/stops.json
python3 scripts/derive_timetable.py   # regenerates public/timetable.json
python3 scripts/derive_places.py      # regenerates public/places.json
python3 scripts/build_stage21.py      # preset additions (idempotent)
python3 scripts/build_schools.py      # merge schools into places.json
python3 scripts/derive_shapes.py      # regenerates public/shapes/
```

Then re-measure street distances (`scripts/measure_street.py`,
`archive/scripts/apply_street_rule.py`), check the new package's end
date moved past the old one, and redeploy. Full script notes live in
`scripts/README.md`. The site footer shows the timetable's
valid-through date and warns when it is past.

## Known limits

- **Timetable vs live.** A next bus whose trip is not yet in the RT
  feed is labelled Timetable even while the feed itself is live —
  honest, not a bug.
- **Translations are drafts.** All UI strings and alert translations
  are draft translations, not human-reviewed — stated in the footer.
  Street and stop names stay in English; the English original is
  always one tap away.
- **The strip shows no stops-away number for the bus leg.** The
  VehiclePosition feed carries no `current_stop_sequence` and no stop
  id, so the bus's exact stop position cannot be derived honestly.
- **Deliberately excluded, never listed:** South Common (too far);
  Gairloch Gardens (nearest stop 1,055 m); Famijoy / United
  Supermarket at 125 Cross Ave (that unit is now Iqbal Foods
  Oakville, opened October 15, 2026); Costco Oakville (not open,
  expected fall 2027); Nations Experience at Oakville Place
  (planned 2027). Full exclusion reasons live in
  `places.json`'s `meta.excluded`.

## Data attribution

Data: Oakville Transit, under the Town of Oakville Open Government
Licence. This is an independent project, not official. Static GTFS via
the Town of Oakville Open Data Portal; GTFS-Realtime via
busfinder.oakvilletransit.ca. Walking: © OpenStreetMap contributors,
OSRM foot routing.
