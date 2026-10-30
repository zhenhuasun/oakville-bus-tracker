#!/usr/bin/env python3
"""Add verified schools from schools-geocoded.json to places.json.

USER DECISION 2026-10-28: ALL 74 schools are included, including the 7
whose nearest GTFS stop is >400 m. Those 7 carry longWalk=True and
walkFromStop_m (their true straight-line distance) so the UI shows an
explicit walking-distance label in all 5 languages; they are NEVER
dropped, and NEVER given a closer fake stop. UNRESOLVED schools are
still NOT added (none in the 2026-10-28 pass).

Idempotent: re-running skips school ids already present (updating their
stop/distance/longWalk fields in place) and never re-adds a removed
prototype. Any stale >400 m excluded entries for these schools are
removed from meta.excluded on every run.
STREET RULE (user decision 2026-10-29): this script writes
straight-line haversine distances, so apply_street_rule.py MUST run
after it (order: build_stage21.py -> build_schools.py ->
apply_street_rule.py), or school distance_m / walkFromStop_m revert
to straight-line. Over-400 m street schools/places are KEPT with a
street-distance note/label, never excluded.
"""
import json, math
from pathlib import Path

DIR = Path(__file__).resolve().parent
ROOT = DIR.parent
PLACES = ROOT / "public" / "places.json"
STOPS = ROOT / "public" / "stops.json"
GEO = ROOT / "data" / "generated" / "schools-geocoded.json"
PENDING = ROOT / "data" / "schools-pending-decision.json"

def hav(lat1, lon1, lat2, lon2):
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(2 * R * math.asin(math.sqrt(h)))

def main():
    data = json.loads(PLACES.read_text())
    stops = json.loads(STOPS.read_text())["stops"]
    by_id = {s["id"]: s for s in stops}
    geo = json.loads(GEO.read_text())
    places = data["places"]
    by_place_id = {p["id"]: p for p in places}
    # Drop the stale Gladys Speers excluded note; it is superseded below.
    # Also drop any stale >400 m excluded entries: user decision
    # 2026-10-28 includes those schools with a walking-distance label.
    # Dedupe excluded by name so re-runs never duplicate entries.
    seen, deduped = set(), []
    for e in data["meta"]["excluded"]:
        if e.get("name") == "Gladys Speers Public School":
            continue
        if "school nearest stop" in str(e.get("reason", "")) and "(>400 m)" in str(e.get("reason", "")):
            continue
        if e.get("name") in seen:
            continue
        seen.add(e.get("name")); deduped.append(e)
    data["meta"]["excluded"] = deduped
    excluded_names = seen
    added, over, unresolved = [], [], []
    for g in geo:
        if g["status"] != "verified":
            unresolved.append(g)
            if g["name"] not in excluded_names:
                excluded_names.add(g["name"])
                data["meta"]["excluded"].append({
                    "name": g["name"], "address": g["research_address"],
                    "reason": "school geocoding UNRESOLVED: " + g.get("reason", "")})
            continue
        best = min(stops, key=lambda s: hav(g["lat"], g["lon"], s["lat"], s["lon"]))
        d = hav(g["lat"], g["lon"], best["lat"], best["lon"])
        rec = {"id": g["id"], "name": g["name"], "board": g["board"],
               "research_address": g["research_address"],
               "lat": g["lat"], "lon": g["lon"],
               "nearest_stop": {"id": best["id"], "name": best["name"],
                                "code": best["code"], "distance_m": d}}
        long_walk = d > 400
        if long_walk:
            over.append(rec)  # now "included with walking label", not pending
        if g["id"] in by_place_id:
            # Update in place so re-runs never duplicate or drop it.
            p = by_place_id[g["id"]]
            p["stop"] = {"id": best["id"], "name": best["name"], "code": best["code"],
                         "distance_m": d}
            p["routes"] = by_id[best["id"]]["routes"]
            if long_walk:
                p["longWalk"] = True; p["walkFromStop_m"] = d
            else:
                p.pop("longWalk", None); p.pop("walkFromStop_m", None)
            continue
        p = {"id": g["id"], "name": g["name"], "address": g["research_address"],
             "cat": "school", "board": g["board"], "cross": False,
             "lat": g["lat"], "lon": g["lon"],
             "stop": {"id": best["id"], "name": best["name"], "code": best["code"],
                      "distance_m": d},
             "routes": by_id[best["id"]]["routes"]}
        if long_walk:
            p["longWalk"] = True; p["walkFromStop_m"] = d
        places.append(p); by_place_id[p["id"]] = p
        added.append(p)
    PENDING.write_text(json.dumps(
        {"over_400m": [], "included_with_walking_label": over,
         "unresolved": unresolved,
         "decision": "User 2026-10-28: all schools included, >400 m schools carry an explicit walking-distance label"},
        indent=2, ensure_ascii=False))
    total_schools = sum(1 for p in places if p["cat"] == "school")
    data["meta"]["schools_note"] = (
        f"Schools geocoded via OSM Nominatim (see schools-geocoded.json): "
        f"{total_schools} School places in total (all 74 research schools; "
        f"{len(over)} with nearest stop >400 m are included with an explicit "
        f"walking-distance label per user decision 2026-10-28; "
        f"{len(added)} added by this run), "
        f"{len(unresolved)} unresolved (not added, never guessed).")
    import unicodedata
    def _sortkey(p):
        folded = unicodedata.normalize("NFKD", p["name"]).encode("ascii", "ignore").decode()
        return (p["cat"], folded.lower())
    places.sort(key=_sortkey)
    PLACES.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    print(f"added {len(added)} schools; >400m included with walking label {len(over)}; unresolved {len(unresolved)}; total places {len(places)}")
    for r in over:
        print(f"  LONGWALK {r['name']} ({r['board']}): {r['nearest_stop']['distance_m']} m to {r['nearest_stop']['name']} ({r['nearest_stop']['code']})")
    for r in unresolved:
        print(f"  MISS {r['name']} ({r['board']}): {r.get('reason','')}")

if __name__ == "__main__":
    main()
