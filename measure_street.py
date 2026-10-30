#!/usr/bin/env python3
"""One-off audit (2026-10-29): routed-foot street distance from each
place's mapped GTFS stop to the place, for all 227 places in
public/places.json. Direction: stop -> place (the destination-walk
direction). Rate: 1 request/second, coordinates only, no names.
Stations are not measured: a station IS its mapped stop (distance_m 0
by construction, no separate coordinates in places.json).
Output: street-audit.json (NOT under public/, so it is never served).
On HTTP 429/403 the run aborts immediately and keeps partial results.
places.json distance_m is NOT changed by this script (user decision
pending on the discrepancy list)."""
import json, sys, time, urllib.request, urllib.error
from pathlib import Path

DIR = Path(__file__).resolve().parent
BASE = "https://routing.openstreetmap.de/routed-foot/route/v1/foot/{lon1},{lat1};{lon2},{lat2}?overview=false&geometries=geojson"
places = json.load(open(DIR / "public" / "places.json"))["places"]
stops = {s["id"]: s for s in json.load(open(DIR / "public" / "stops.json"))["stops"]}
out_path = DIR / "street-audit.json"
results = []
if out_path.exists():
    try:
        results = json.load(open(out_path))["results"]
    except Exception:
        results = []
done = {r["id"] for r in results}
for pl in places:
    if pl["id"] in done:
        continue
    st = stops[pl["stop"]["id"]]
    url = BASE.format(lon1=st["lon"], lat1=st["lat"], lon2=pl["lon"], lat2=pl["lat"])
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            data = json.load(resp)
    except urllib.error.HTTPError as e:
        print(f"ABORT HTTP {e.code} at {pl['id']}; partial results saved ({len(results)})", flush=True)
        break
    except Exception as e:
        print(f"ERROR {pl['id']}: {e}; recording null", flush=True)
        results.append({"id": pl["id"], "name": pl["name"], "cat": pl["cat"],
                        "straight_m": pl["stop"]["distance_m"], "street_m": None})
        json.dump({"results": results}, open(out_path, "w"), ensure_ascii=False, indent=1)
        time.sleep(1.0)
        continue
    route = (data.get("routes") or [None])[0]
    street = round(route["distance"]) if route and isinstance(route.get("distance"), (int, float)) else None
    results.append({"id": pl["id"], "name": pl["name"], "cat": pl["cat"],
                    "straight_m": pl["stop"]["distance_m"], "street_m": street})
    json.dump({"results": results}, open(out_path, "w"), ensure_ascii=False, indent=1)
    print(f"{len(results)}/{len(places)} {pl['name']}: straight {pl['stop']['distance_m']} m, street {street} m", flush=True)
    time.sleep(1.0)
over = [r for r in results if r["street_m"] is not None and r["street_m"] > 400]
print(f"DONE: measured {len(results)}/{len(places)}; street > 400 m: {len(over)}")
for r in over:
    print(f"  OVER400 {r['name']} ({r['cat']}): straight {r['straight_m']} m, street {r['street_m']} m")
