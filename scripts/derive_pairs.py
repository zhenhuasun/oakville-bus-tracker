#!/usr/bin/env python3
"""
Derive public/pairs.json for the Oakville newcomer bus tracker from the
official Oakville Transit static GTFS package.

Source (Town of Oakville Open Data, Open Government Licence):
  https://www.arcgis.com/sharing/rest/content/items/d78a1c1ad6a940009de8b68839a8f606/data

JOIN RULES (critical — these are the rules the live RT join must also use):
  * A static trip_id is either a plain id, or original_trip_id + "_merged_<n>".
    The trips.txt column original_trip_id holds the original when present.
  * A real-time trip_id equals the original_trip_id (for merged trips) or the
    plain trip_id (for unmerged trips). Never match RT trip_ids against the
    raw static trip_id alone: that drops more than half of all trips.
  * Match a live trip on (original_trip_id, route_id, current-date service).
    The same original can appear under different routes in the old and new
    signup, so route_id is part of the key.
  * Static stop_ids also carry "_merged_<n>" suffixes. Strip the suffix to
    get the original stop id before matching a real-time stop_id, which is
    given as the original. Stop codes are stable across merged variants.

Usage:
  python3 derive_pairs.py [--zip PATH] [--out public/pairs.json]
  Without --zip it downloads the ArcGIS package fresh (recommended, so the
  output always reflects the current published package, not a stale copy).
  The package calendar currently ends 2026-10-31; re-running this script
  after Oakville publishes a new package is how the site gets new times.
  No times are invented: every departure in the output is a real row from
  stop_times.txt on a real trip in trips.txt.
"""
import argparse, csv, io, json, math, os, sys, urllib.request, zipfile
from collections import defaultdict

STATIC_URL = "https://www.arcgis.com/sharing/rest/content/items/d78a1c1ad6a940009de8b68839a8f606/data"

def orig_id(raw):
    return raw.split("_merged_")[0]

# --- Places: id, English display name, address, lat, lon -------------------
# Origins are terminals/stations (exact stop). Destinations are places;
# the script picks the nearest GTFS stops (by original stop id) within 800 m
# and then only keeps trips that actually stop at one of those stops after
# the origin stop. A destination whose nearest stops are never served on a
# trip from an origin simply gets no departures for that pair — never faked.
PLACES = [
    # origins
    {"id": "oakville_go", "kind": "origin", "name": "Oakville GO Station",
     "address": "Oakville GO Station", "lat": 43.4558, "lon": -79.6824,
     "exact_stop": "1212"},
    {"id": "bronte_go", "kind": "origin", "name": "Bronte GO Station",
     "address": "Bronte GO Station", "lat": 43.416332, "lon": -79.724001,
     "exact_stop": "645"},
    {"id": "uptown", "kind": "origin", "name": "Uptown Core Terminal",
     "address": "Uptown Core Terminal", "lat": 43.485887, "lon": -79.719198,
     "exact_stop": "1293"},
    # destinations
    {"id": "iqbal", "kind": "destination", "name": "Iqbal Foods Oakville",
     "address": "125 Cross Ave Unit C2, Trafalgar Village",
     "lat": 43.455464, "lon": -79.687120,
     "note": "South Asian / Middle Eastern supermarket, halal. Grand opening Oct 15, 2026. "
           "This unit was Famijoy, then United Supermarket (Dec 2024); do NOT list "
           "Famijoy or United as current here."},
    {"id": "oakville_place", "kind": "destination", "name": "Oakville Place",
     "address": "240 Leighland Ave", "lat": 43.461647, "lon": -79.686891,
     "note": "Oakville's only enclosed mall. 'Oakville Mall' is not a current place name."},
    {"id": "hospital", "kind": "destination", "name": "Oakville Trafalgar Memorial Hospital",
     "address": "3001 Hospital Gate", "lat": 43.450557, "lon": -79.764683},
    {"id": "oakville_go_dest", "kind": "destination", "name": "Oakville GO Station",
     "address": "Oakville GO Station", "lat": 43.4558, "lon": -79.6824,
     "exact_stop": "1212"},
    {"id": "uptown_dest", "kind": "destination", "name": "Uptown Core Terminal",
     "address": "Uptown Core Terminal", "lat": 43.485887, "lon": -79.719198,
     "exact_stop": "1293"},
    {"id": "shoppers", "kind": "destination", "name": "Shoppers Drug Mart",
     "address": "351 Cornwall Rd", "lat": 43.45756, "lon": -79.67794},
    {"id": "rbc", "kind": "destination", "name": "RBC Royal Bank",
     "address": "361 Cornwall Rd", "lat": 43.45814, "lon": -79.67724},
    # Gladys Speers Public School REMOVED 2026-10-28 (School category deleted
    # for now; schools stay out until the separate 74-school geocoding pass).
    {"id": "otcc", "kind": "destination", "name": "Oakville Trafalgar Community Centre",
     "address": "MacDonald Rd + Reynolds St", "lat": 43.4542, "lon": -79.675,
     "exact_stop": "689",
     # 49 (Reynolds St at the centre, 142 m from the place coordinates;
     # stop 1079, not 49, is the one 14 m away) is where return-direction
     # trips board; forward trips use 689. Without 49 the return ride from
     # the centre to Oakville GO would be falsely reported as missing.
     "also_stops": ["49"]},
    {"id": "glen_abbey_cc", "kind": "destination", "name": "Glen Abbey Community Centre",
     "address": "1415 Third Line", "lat": 43.43588, "lon": -79.73845,
     "note": "Listed by the geocoder as Glen Abbey Recreation Centre, 1415 3rd Line."},
]

def haversine_m(lat1, lon1, lat2, lon2):
    return math.hypot((lat1 - lat2) * 111000,
                      (lon1 - lon2) * 111000 * math.cos(math.radians(lat1)))

def minutes(t):
    # GTFS times may exceed 24:00 for after-midnight service.
    h, m, s = (int(x) for x in t.split(":"))
    return h * 60 + m + s / 60.0

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--zip", default=None)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(here)
    out_path = args.out or os.path.join(root, "public", "pairs.json")

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

    stops_raw = read("stops.txt")
    trips_raw = read("trips.txt")
    stop_times_raw = read("stop_times.txt")
    calendar = read("calendar.txt")
    try:
        calendar_dates = read("calendar_dates.txt")
    except KeyError:
        calendar_dates = []

    # Original stop -> first record (merged variants share name/code).
    stops = {}
    for r in stops_raw:
        o = orig_id(r["stop_id"])
        if o not in stops:
            stops[o] = {"id": o, "name": r["stop_name"], "code": r["stop_code"],
                        "lat": float(r["stop_lat"]), "lon": float(r["stop_lon"])}

    # Trip metadata keyed by static trip_id.
    trips = {}
    for r in trips_raw:
        original = r["original_trip_id"] or r["trip_id"]
        trips[r["trip_id"]] = {
            "static_trip_id": r["trip_id"], "original_trip_id": original,
            "route_id": r["route_id"], "service_id": r["service_id"],
            "headsign": r["trip_headsign"], "direction_id": r["direction_id"],
        }

    # Stop times grouped by trip, sorted by sequence, with original stop ids.
    by_trip = defaultdict(list)
    for r in stop_times_raw:
        by_trip[r["trip_id"]].append({
            "stop": orig_id(r["stop_id"]), "seq": int(r["stop_sequence"]),
            "dep": r["departure_time"], "arr": r["arrival_time"],
        })
    for t in by_trip.values():
        t.sort(key=lambda x: x["seq"])

    # Candidate destination stops: exact stop, or nearest stops within 800 m.
    # Terminal stops (Oakville GO, Bronte GO, Uptown Core) are excluded from
    # non-terminal destinations: otherwise a trip that merely passes through
    # Oakville GO would be reported as "arriving at Iqbal Foods" just because
    # the terminal is geographically near Trafalgar Village.
    TERMINALS = {"1212", "645", "1293"}
    place_info = {}
    for p in PLACES:
        if p.get("exact_stop"):
            cands = [{"id": p["exact_stop"], "name": stops[p["exact_stop"]]["name"],
                      "code": stops[p["exact_stop"]]["code"], "distance_m": 0}]
            for extra in p.get("also_stops", []):
                s = stops[extra]
                cands.append({"id": extra, "name": s["name"], "code": s["code"],
                              "distance_m": round(haversine_m(p["lat"], p["lon"],
                                                             s["lat"], s["lon"]))})
        else:
            scored = []
            for s in stops.values():
                if s["id"] in TERMINALS:
                    continue
                d = haversine_m(p["lat"], p["lon"], s["lat"], s["lon"])
                if d <= 800:
                    scored.append((d, s))
            scored.sort(key=lambda x: x[0])
            cands = [{"id": s["id"], "name": s["name"], "code": s["code"],
                      "distance_m": round(d)} for d, s in scored[:5]]
        place_info[p["id"]] = {**p, "candidate_stops": cands}

    # Drop services that already ended before today (Toronto date): the old
    # signup is history, not a ride anyone can take. This also keeps
    # pairs.json small. Future runs after a new package is published will
    # automatically include that package's services.
    try:
        from zoneinfo import ZoneInfo
        from datetime import datetime as _dt
        today_str = _dt.now(ZoneInfo("America/Toronto")).strftime("%Y%m%d")
    except Exception:
        from datetime import date as _date
        today_str = _date.today().strftime("%Y%m%d")
    active_service_ids = {c["service_id"] for c in calendar if c["end_date"] >= today_str}
    by_trip = {tid: sts for tid, sts in by_trip.items()
               if trips.get(tid, {}).get("service_id") in active_service_ids}
    trips = {tid: m for tid, m in trips.items() if m["service_id"] in active_service_ids}

    origins = [p for p in PLACES if p["kind"] == "origin"]
    dests = [p for p in PLACES if p["kind"] == "destination"]

    pairs = {}
    for o in origins:
        for d in dests:
            # Same place both ends is not a ride (e.g. Oakville GO -> Oakville GO).
            # Skip those keys; the frontend treats a missing pair as unavailable.
            if (o["id"], d["id"]) in {("oakville_go", "oakville_go_dest"),
                                      ("uptown", "uptown_dest")}:
                continue
            cand_dist = {c["id"]: c["distance_m"]
                         for c in place_info[d["id"]]["candidate_stops"]}
            dest_stop_ids = set(cand_dist)
            deps = []
            for trip_id, sts in by_trip.items():
                meta = trips.get(trip_id)
                if not meta:
                    continue
                origin_rows = [s for s in sts if s["stop"] == o["exact_stop"]]
                if not origin_rows:
                    continue
                o_row = origin_rows[0]
                # Among candidate stops this trip actually serves after the
                # origin, pick the one CLOSEST TO THE PLACE — not the first
                # in sequence. First-in-sequence would report e.g. a Trafalgar
                # Rd stop as "Oakville Place" when the trip later stops at the
                # mall's own stop.
                dest_rows = [s for s in sts if s["stop"] in dest_stop_ids and s["seq"] > o_row["seq"]]
                if not dest_rows:
                    continue
                d_row = min(dest_rows, key=lambda s: cand_dist[s["stop"]])
                deps.append({
                    "service_id": meta["service_id"], "route_id": meta["route_id"],
                    "headsign": meta["headsign"], "direction_id": meta["direction_id"],
                    "original_trip_id": meta["original_trip_id"],
                    "static_trip_id": meta["static_trip_id"],
                    "origin_stop": o["exact_stop"],
                    "destination_stop": d_row["stop"],
                    "departure_time": o_row["dep"], "arrival_time": d_row["arr"],
                    "departure_minutes": minutes(o_row["dep"]),
                    "arrival_minutes": minutes(d_row["arr"]),
                    "stops_on_ride": d_row["seq"] - o_row["seq"],
                })
            deps.sort(key=lambda x: (x["service_id"], x["departure_minutes"]))
            key = f"{o['id']}->{d['id']}"
            dest_stop_used = None
            if deps:
                # Most common destination stop for this pair (stable display stop).
                counts = defaultdict(int)
                for dep in deps:
                    counts[dep["destination_stop"]] += 1
                best = max(counts, key=counts.get)
                dest_stop_used = {"id": best, "name": stops[best]["name"],
                                  "code": stops[best]["code"]}
            # Return ride: from the destination place back to this origin.
            # Use ALL candidate stops of the destination place (not just the
            # single most-common forward stop): a return trip may board at
            # Hospital Gate even if the forward trip alighted at the OTMH
            # West Entrance, and both are the same place for the rider.
            # If no trip runs from any candidate stop to the origin stop,
            # return_departures is empty and the UI must hide the return
            # button for this pair — never invent a return ride.
            return_deps = []
            if deps:
                for trip_id, sts in by_trip.items():
                    meta = trips.get(trip_id)
                    if not meta:
                        continue
                    dest_rows = [s for s in sts if s["stop"] in dest_stop_ids]
                    if not dest_rows:
                        continue
                    # Board at the candidate stop closest to the place.
                    r_row = min(dest_rows, key=lambda s: cand_dist[s["stop"]])
                    o_rows = [s for s in sts if s["stop"] == o["exact_stop"]
                              and s["seq"] > r_row["seq"]]
                    if not o_rows:
                        continue
                    o_row2 = o_rows[0]
                    return_deps.append({
                        "service_id": meta["service_id"], "route_id": meta["route_id"],
                        "headsign": meta["headsign"], "direction_id": meta["direction_id"],
                        "original_trip_id": meta["original_trip_id"],
                        "static_trip_id": meta["static_trip_id"],
                        "origin_stop": r_row["stop"],
                        "destination_stop": o["exact_stop"],
                        "departure_time": r_row["dep"], "arrival_time": o_row2["arr"],
                        "departure_minutes": minutes(r_row["dep"]),
                        "arrival_minutes": minutes(o_row2["arr"]),
                        "stops_on_ride": o_row2["seq"] - r_row["seq"],
                    })
                return_deps.sort(key=lambda x: (x["service_id"], x["departure_minutes"]))
            pairs[key] = {
                "origin": o["id"], "destination": d["id"],
                "destination_stop": dest_stop_used,
                "departures": deps,
                "return_departures": return_deps,
            }

    package_end = max((c["end_date"] for c in calendar), default="")
    result = {
        "meta": {
            "source": "Oakville Transit static GTFS, Town of Oakville Open Data",
            "static_url": STATIC_URL,
            "package_end_date": package_end,
            "generated_note": "Regenerate with derive_pairs.py after Oakville publishes a new package. "
                              "Current package calendar ends 2026-10-31 in the package "
                              "downloaded for this build; the date above is read from "
                              "calendar.txt, not typed in.",
            "services": calendar,
            "calendar_dates": calendar_dates,
            "join_note": "RT trip_id = original_trip_id (merged) or plain trip_id (unmerged); "
                         "match on original_trip_id + route_id + current-date service; "
                         "strip _merged_ suffixes from static stop_ids.",
        },
        "origins": [{**{k: p[k] for k in ("id", "name", "address", "lat", "lon")},
                      "stop_id": p["exact_stop"],
                      "stop_code": stops[p["exact_stop"]]["code"],
                      "stop_name": stops[p["exact_stop"]]["name"]}
                    for p in origins],
        "destinations": [{**{k: p[k] for k in ("id", "name", "address", "lat", "lon")
                              if k in p},
                           "candidate_stops": place_info[p["id"]]["candidate_stops"],
                           **({"note": p["note"]} if "note" in p else {})}
                          for p in dests],
        "pairs": pairs,
    }
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=1)

    # Matrix report (stdout) — the honest verification output.
    print(f"stops(original)={len(stops)} trips={len(trips)} "
          f"services={len(calendar)} package_end={package_end}")
    for o in origins:
        for d in dests:
            key = f"{o['id']}->{d['id']}"
            if key not in pairs:
                print(f"  {key}: skipped (same place)")
                continue
            n = len(pairs[key]["departures"])
            routes = sorted({dep["route_id"] for dep in pairs[key]["departures"]})
            print(f"  {key}: {n} departures routes={routes} "
                  f"dest_stop={pairs[key]['destination_stop']}")
    print(f"wrote {out_path} ({os.path.getsize(out_path)} bytes)")

if __name__ == "__main__":
    main()
