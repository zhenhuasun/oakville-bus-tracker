#!/usr/bin/env python3
"""
Derive public/timetable.json for Stage 2 (full-stop journey search) from
the official Oakville Transit static GTFS package.

Source (Town of Oakville Open Data, Open Government Licence):
  https://www.arcgis.com/sharing/rest/content/items/d78a1c1ad6a940009de8b68839a8f606/data

Rules (same join rules as derive_pairs.py):
  * Static trip_id is plain, or original_trip_id + "_merged_<n>".
  * A real-time trip_id equals the original_trip_id (merged) or the plain
    trip_id (unmerged). The frontend matches RT on original_trip_id +
    route_id + current-date service.
  * Static stop_ids carry "_merged_<n>" suffixes; the suffix is stripped
    here so timetable stop ids already match real-time stop ids.
  * Direction labels must NEVER use the package's trip_headsign: this
    package's headsigns are auto-generated labels like "Auto Generated-05",
    meaningless to a rider. The frontend labels a trip's direction by its
    terminal stop (the last stop on that trip), looked up in stops.json.
  * Only services whose calendar end_date is >= today (Toronto date) are
    kept. In the package downloaded for Stage 2 (calendar ends 2026-10-31)
    that is the weekday service 1_merged_2779034, Saturday
    2_merged_2779036, and Sunday 3_merged_2779035. The old signup (ended
    2026-09-05) is history, not a ride anyone can take, and is dropped —
    this is also what keeps the file compact.

Output format (compact arrays, short keys, no duplicate stop names):
  {"meta": {"package_end_date": "20261031", "services": [...],
            "trips": N, "stop_times": N},
   "trips": [[route_id, service_id, original_trip_id,
              [[stop_id, arr_minutes, dep_minutes], ...]], ...]}
  Stop times are minutes after midnight (GTFS times may exceed 24:00 for
  after-midnight service; they are kept as-is, e.g. 1445 = 00:45 next day).
  arr/dep are equal on almost every row; both are kept because the
  journey search boards on departure and alights on arrival.

Usage:
  python3 derive_timetable.py [--zip PATH] [--out public/timetable.json]
  Without --zip it downloads the ArcGIS package fresh.
  No times are invented: every row is a real stop_times.txt row on a real
  trip in trips.txt.
"""
import argparse, csv, io, json, os, sys, urllib.request, zipfile
from collections import defaultdict

STATIC_URL = "https://www.arcgis.com/sharing/rest/content/items/d78a1c1ad6a940009de8b68839a8f606/data"

def orig_id(raw):
    return raw.split("_merged_")[0]

def minutes(t):
    h, m, s = (int(x) for x in t.split(":"))
    return h * 60 + m + s / 60.0

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--zip", default=None)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()
    here = os.path.dirname(os.path.abspath(__file__))
    out_path = args.out or os.path.join(here, "public", "timetable.json")

    if args.zip:
        data = open(args.zip, "rb").read()
    else:
        print("Downloading static GTFS from ArcGIS ...", file=sys.stderr)
        with urllib.request.urlopen(STATIC_URL, timeout=60) as r:
            data = r.read()
    zf = zipfile.ZipFile(io.BytesIO(data))
    def read(name):
        with zf.open(name) as f:
            return list(csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig")))

    trips_raw = read("trips.txt")
    stop_times_raw = read("stop_times.txt")
    calendar = read("calendar.txt")

    try:
        from zoneinfo import ZoneInfo
        from datetime import datetime as _dt
        today_str = _dt.now(ZoneInfo("America/Toronto")).strftime("%Y%m%d")
    except Exception:
        from datetime import date as _date
        today_str = _date.today().strftime("%Y%m%d")
    current_services = {c["service_id"] for c in calendar if c["end_date"] >= today_str}
    print(f"today={today_str} current_services={sorted(current_services)}", file=sys.stderr)

    trips = {}
    for r in trips_raw:
        if r["service_id"] not in current_services:
            continue
        original = r["original_trip_id"] or r["trip_id"]
        trips[r["trip_id"]] = {
            "route": r["route_id"], "service": r["service_id"],
            "original": original,
        }
    by_trip = defaultdict(list)
    for r in stop_times_raw:
        if r["trip_id"] not in trips:
            continue
        by_trip[r["trip_id"]].append(
            (int(r["stop_sequence"]), orig_id(r["stop_id"]),
             minutes(r["arrival_time"]), minutes(r["departure_time"])))
    out_trips = []
    n_rows = 0
    for trip_id, meta in trips.items():
        rows = sorted(by_trip.get(trip_id, []))
        if not rows:
            continue
        n_rows += len(rows)
        out_trips.append([meta["route"], meta["service"], meta["original"],
                          [[s, a, d] for _, s, a, d in rows]])
    out_trips.sort(key=lambda t: (t[0], t[1], t[3][0][1]))
    package_end = max((c["end_date"] for c in calendar), default="")
    result = {
        "meta": {"source": "Oakville Transit static GTFS, Town of Oakville Open Data",
                 "static_url": STATIC_URL,
                 "package_end_date": package_end,
                 "services": sorted(current_services),
                 "trips": len(out_trips), "stop_times": n_rows,
                 "join_note": "RT trip_id = original_trip_id; match on original_trip_id + "
                              "route_id + current-date service; stop ids have "
                              "_merged_ suffixes stripped."},
        "trips": out_trips,
    }
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, separators=(",", ":"))
    print(f"trips={len(out_trips)} stop_times={n_rows} package_end={package_end}")
    print(f"wrote {out_path} ({os.path.getsize(out_path)} bytes)")

if __name__ == "__main__":
    main()
