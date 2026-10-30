#!/usr/bin/env python3
"""
Derive public/shapes/<route>.json for Stage 3 (trip-only map) from the
official Oakville Transit static GTFS package on disk.

Source (Town of Oakville Open Data, Open Government Licence):
  ~/workspace/oakville-gtfs-check/static/ (trips.txt + shapes.txt), the
  same package as public/timetable.json (calendar ends 2026-10-31).

JOIN (verified, not assumed):
  * trips.txt has shape_id + service_id + trip_id + original_trip_id.
    The original is original_trip_id when present, else trip_id — the
    same rule as derive_timetable.py.
  * A timetable trip is keyed (route_id, service_id, original). That key
    maps to EXACTLY ONE shape_id for all 2,779 timetable trips (0 missing,
    0 with >1 shape). The key MUST include service_id: the same
    (route, original) appears with different shapes across services
    (52 such cases), so original+route alone is not a safe shape key.
  * Pair departures use the same (route, service, original) key, so the
    same files serve the pair-board map button. Coverage of pair
    departures is reported below; any uncovered pair departure is listed
    (the frontend hides the map button only if a shape fetch fails).

OUTPUT (one file per route the journey engine can serve — the 35 routes
in timetable.json, lazy-loaded by the frontend only when a map opens):
  {"route": "28",
   "shapes": {"shp-28-01": [[lat, lon], ...], ...},
   "trips": {"<service_id>|<original_trip_id>": "shp-28-01", ...}}
  Shape points are VERBATIM: every shapes.txt point for the shape, in
  shape_pt_sequence order, none dropped, no simplification, no straight
  lines. Coordinates are rounded to 5 decimals (~1 m) only to keep the
  files compact; the point list itself is untouched.

Usage:
  python3 derive_shapes.py [--static DIR] [--out public/shapes]
  Defaults read the on-disk static package and public/timetable.json.
"""
import argparse, csv, json, os, sys
from collections import defaultdict

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--static", default=os.path.expanduser(
        "~/workspace/oakville-gtfs-check/static"))
    ap.add_argument("--out", default=None)
    args = ap.parse_args()
    here = os.path.dirname(os.path.abspath(__file__))
    out_dir = args.out or os.path.join(here, "public", "shapes")

    def read(name):
        with open(os.path.join(args.static, name), encoding="utf-8-sig") as f:
            return list(csv.DictReader(f))

    trips_raw = read("trips.txt")
    shapes_raw = read("shapes.txt")
    tt = json.load(open(os.path.join(here, "public", "timetable.json")))
    pairs = json.load(open(os.path.join(here, "public", "pairs.json")))

    # (route, service, original) -> shape_id; report any ambiguity.
    key_to_shape = {}
    ambiguous = []
    for r in trips_raw:
        orig = r["original_trip_id"] or r["trip_id"]
        k = (r["route_id"], r["service_id"], orig)
        if k in key_to_shape and key_to_shape[k] != r["shape_id"]:
            ambiguous.append(k)
        key_to_shape[k] = r["shape_id"]

    # All shape points, in sequence order.
    by_shape = defaultdict(list)
    for r in shapes_raw:
        by_shape[r["shape_id"]].append(
            (int(r["shape_pt_sequence"]), round(float(r["shape_pt_lat"]), 5),
             round(float(r["shape_pt_lon"]), 5)))
    shapes = {sid: [[lat, lon] for _, lat, lon in sorted(pts)]
              for sid, pts in by_shape.items()}

    # Per-route files, restricted to trips the journey engine can serve.
    per_route = defaultdict(lambda: {"trips": {}, "shapes": {}})
    missing, tt_routes = [], set()
    for tr in tt["trips"]:
        route, service, orig = tr[0], tr[1], tr[2]
        tt_routes.add(route)
        sid = key_to_shape.get((route, service, orig))
        if not sid:
            missing.append((route, service, orig))
            continue
        per_route[route]["trips"][service + "|" + orig] = sid
        per_route[route]["shapes"][sid] = shapes[sid]

    # Pair-departure coverage (same key): the pair-board map button rides
    # on the same files, so report any departure the files cannot map.
    uncovered = []
    for pair in pairs["pairs"].values():
        for dep in pair["departures"] + pair["return_departures"]:
            if (dep["route_id"], dep["service_id"], dep["original_trip_id"]) not in key_to_shape:
                uncovered.append(dep)

    os.makedirs(out_dir, exist_ok=True)
    total_bytes, total_pts = 0, 0
    for route in sorted(per_route):
        data = {"route": route, "shapes": per_route[route]["shapes"],
                "trips": per_route[route]["trips"]}
        path = os.path.join(out_dir, route + ".json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        total_bytes += os.path.getsize(path)
        total_pts += sum(len(p) for p in data["shapes"].values())
        print(f"  route {route}: {len(data['shapes'])} shapes, "
              f"{len(data['trips'])} trips, {os.path.getsize(path)} bytes")
    print(f"routes={len(per_route)} (timetable routes={len(tt_routes)}) "
          f"shapes={sum(len(v['shapes']) for v in per_route.values())} "
          f"points={total_pts} total_bytes={total_bytes}")
    print(f"missing timetable trips={len(missing)} ambiguous keys={len(ambiguous)} "
          f"uncovered pair departures={len(uncovered)}")
    if missing: print("  MISSING:", missing[:10], file=sys.stderr)
    if ambiguous: print("  AMBIGUOUS:", ambiguous[:10], file=sys.stderr)
    if uncovered: print("  UNCOVERED PAIR DEPS:", uncovered[:5], file=sys.stderr)
    return 1 if (missing or ambiguous) else 0

if __name__ == "__main__":
    sys.exit(main())
