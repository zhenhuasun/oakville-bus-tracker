#!/usr/bin/env python3
"""Geocode the 74 Oakville schools via OSM Nominatim, 1 request/second.

Writes data/generated/schools-geocoded.json (relative to repo root) with, per school:
name, board, research address/postal, lat, lon, geocoder display name,
query used, and verification status. Nothing is guessed: a result is
accepted only if it is inside Oakville (lat 43.35-43.52, lon -79.85--79.65),
its display name mentions Oakville, and (where Nominatim returns a house
number) that number matches the research street number. Otherwise the
school is recorded UNRESOLVED with the reason.
"""
import json, time, urllib.parse, urllib.request
from pathlib import Path
from schools_list import SCHOOLS

DIR = Path(__file__).resolve().parent
ROOT = DIR.parent
OUT = ROOT / "data" / "generated" / "schools-geocoded.json"
UA = "OakvilleBusTracker/1.0 (Oakville newcomer bus tracker research)"
BASE = "https://nominatim.openstreetmap.org/search"

def query(q):
    url = BASE + "?" + urllib.parse.urlencode(
        {"q": q, "format": "jsonv2", "addressdetails": 1, "limit": 5})
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

def acceptable(res, street_number, name):
    try:
        lat, lon = float(res["lat"]), float(res["lon"])
    except Exception:
        return False, "bad coordinates"
    if not (43.35 <= lat <= 43.52 and -79.85 <= lon <= -79.65):
        return False, f"outside Oakville bounds ({lat},{lon})"
    addr = res.get("address", {})
    town = (addr.get("city") or addr.get("town") or addr.get("municipality") or "")
    disp = res.get("display_name", "")
    if "Oakville" not in town and "Oakville" not in disp:
        return False, f"not Oakville: {disp}"
    if street_number and addr.get("house_number") and addr["house_number"] != street_number:
        return False, f"house number {addr['house_number']} != research {street_number}: {disp}"
    return True, ""

def pick(results, street_number, name):
    # Prefer an amenity/school result whose name resembles the school name,
    # otherwise the first acceptable result.
    lname = name.lower().replace("é", "e")
    for res in results:
        ok, _ = acceptable(res, street_number, name)
        if not ok:
            continue
        rname = (res.get("name") or "").lower()
        if rname and (rname in lname or lname.split()[0] in rname or "school" in rname or "college" in rname or "montessori" in rname):
            return res, ""
    for res in results:
        ok, reason = acceptable(res, street_number, name)
        if ok:
            return res, ""
    return None, (results[0].get("display_name", "") if results else "no results")

def main():
    out = []
    for sid, name, board, address, postal in SCHOOLS:
        street_number = address.split()[0]
        full_addr = f"{address}, Oakville, Ontario, Canada"
        res, reason = None, ""
        try:
            results = query(full_addr)
            time.sleep(1.1)
            res, reason = pick(results, street_number, name)
            if res is None:
                results2 = query(f"{name}, Oakville, Ontario, Canada")
                time.sleep(1.1)
                res, reason = pick(results2, street_number, name)
        except Exception as e:
            reason = f"request error: {e}"
        if res is not None:
            a = res.get("address", {})
            out.append({"id": sid, "name": name, "board": board,
                        "research_address": f"{address}, Oakville, ON" + (f" {postal}" if postal else ""),
                        "research_postal": postal, "lat": float(res["lat"]), "lon": float(res["lon"]),
                        "geocoder": "OSM Nominatim", "geocoder_display_name": res.get("display_name", ""),
                        "geocoder_postcode": a.get("postcode"), "status": "verified"})
            print(f"OK   {name} -> {res['lat']},{res['lon']} ({a.get('postcode')})")
        else:
            out.append({"id": sid, "name": name, "board": board,
                        "research_address": f"{address}, Oakville, ON" + (f" {postal}" if postal else ""),
                        "research_postal": postal, "lat": None, "lon": None,
                        "geocoder": "OSM Nominatim", "geocoder_display_name": "",
                        "geocoder_postcode": None, "status": "UNRESOLVED", "reason": reason})
            print(f"MISS {name} :: {reason}")
        OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False))
    ok = sum(1 for o in out if o["status"] == "verified")
    print(f"verified {ok}/{len(out)}")

if __name__ == "__main__":
    main()
