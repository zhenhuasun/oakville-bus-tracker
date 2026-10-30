#!/usr/bin/env python3
"""Derive public/stops.json from the Oakville static GTFS.

Output: one entry per distinct base stop id (the id a real-time feed uses).
Static stop_ids carry "_merged_<n>" suffixes on a few variants; those are
collapsed by stripping the suffix. The 5 collapsed variants were verified
to share identical stop_name and stop_code, so no information is lost.

Each entry: {id, name, code, lat, lon, routes} where routes is the sorted
list of route_ids serving that stop in the static package (used only to
display "routes serving this stop" in search/location results — it is not
a timetable and must never be presented as one).

Usage:
  python3 derive_stops.py                      # uses ../oakville-gtfs-check/static
  python3 derive_stops.py --static-dir DIR     # any unzipped GTFS directory
  python3 derive_stops.py --zip gtfs.zip       # unzips to a temp dir first
"""
import argparse
import csv
import json
import os
import sys
import tempfile
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def base_id(stop_id):
    return stop_id.split("_merged_")[0]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--static-dir", default=None)
    ap.add_argument("--zip", default=None)
    ap.add_argument("--out", default=os.path.join(ROOT, "public", "stops.json"))
    args = ap.parse_args()

    tmp = None
    if args.zip:
        tmp = tempfile.mkdtemp(prefix="obt-stops-")
        with zipfile.ZipFile(args.zip) as zf:
            zf.extractall(tmp)
        static_dir = tmp
    elif args.static_dir:
        static_dir = args.static_dir
    else:
        static_dir = os.path.join(os.path.dirname(ROOT), "oakville-gtfs-check", "static")
    if not os.path.exists(os.path.join(static_dir, "stops.txt")):
        print(f"stops.txt not found in {static_dir}", file=sys.stderr)
        return 1

    stops = {}
    with open(os.path.join(static_dir, "stops.txt"), newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            bid = base_id(row["stop_id"])
            if bid in stops:
                old = stops[bid]
                if (old["name"], old["code"]) != (row["stop_name"], row["stop_code"]):
                    print(f"WARNING: conflicting name/code for base stop {bid}: "
                          f"{old} vs {row['stop_name']}/{row['stop_code']}", file=sys.stderr)
                continue
            stops[bid] = {
                "id": bid,
                "name": row["stop_name"],
                "code": row["stop_code"],
                "lat": float(row["stop_lat"]),
                "lon": float(row["stop_lon"]),
                "routes": set(),
            }

    trip_route = {}
    with open(os.path.join(static_dir, "trips.txt"), newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            trip_route[row["trip_id"]] = row["route_id"]

    with open(os.path.join(static_dir, "stop_times.txt"), newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            bid = base_id(row["stop_id"])
            route = trip_route.get(row["trip_id"])
            if bid in stops and route:
                stops[bid]["routes"].add(route)

    out = []
    for bid in sorted(stops, key=lambda x: (len(x), x)):
        s = stops[bid]
        out.append({
            "id": s["id"], "name": s["name"], "code": s["code"],
            "lat": s["lat"], "lon": s["lon"],
            "routes": sorted(s["routes"], key=lambda r: (len(r), r)),
        })
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump({"generated_from": "Oakville Transit static GTFS (stops.txt + trips.txt + stop_times.txt)",
                   "note": "Base stop ids only (_merged_ suffix stripped, matching real-time ids). "
                           "routes = routes serving the stop in the static package, not a timetable.",
                   "stops": out}, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Wrote {args.out}: {len(out)} stops, "
          f"{os.path.getsize(args.out)} bytes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
