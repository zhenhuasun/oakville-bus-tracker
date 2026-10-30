#!/usr/bin/env python3
"""Apply the user-decided STREET-based mapping rule (2026-10-29) to
public/places.json. Run AFTER build_stage21.py and build_schools.py
(verified order: stage21 -> schools -> this script), because
build_schools.py re-writes school distance_m / walkFromStop_m from
straight-line haversine on every run, and build_stage21.py's >400 m
refusal for NEW places is also straight-line.

USER DECISION 2026-10-29: "按街道算 但是备注里把距离写上"
(mapping rule is now STREET distance, and the distance is written
in the note). This script is measurement + honesty, NOT exclusion:
no place is excluded, no category/stop/coordinate/name changes.

What it does, from street-audit.json (routed-foot, stop -> place,
1 req/s, coordinates only, 230/230 measured, 0 failures):
  1. Every place's stop.distance_m is replaced with its measured
     STREET distance (positional match: street-audit.json results are
     in places.json order — verified by id + name + old straight
     distance for all 227 rows, which also disambiguates duplicate
     ids such as the two Canadian Tire rows). Aborts on any mismatch
     or missing street value; nothing is guessed or copied from
     straight-line. Stations are untouched (a station IS its stop,
     distance_m 0 by construction).
  2. The 24 places whose street distance is >400 m while their
     straight-line distance was <=400 m get the distance written in
     their NOTE field: "Street walk {m} m from nearest stop"
     (appended with "; " if the place already has a note; none of
     the 24 had one). They deliberately do NOT get longWalk=True:
     placeTags renders longWalk label + note in the same row, so
     setting both would show the same distance twice. The note is
     the single rendering path for these 24 (see test_streetrule).
     (25 before the 2026-10-29 Longo's correction; Longo's 338
     Dundas St E left this list when its placeholder coordinates
     were corrected and it remapped to stop 1657 at 336 m street.)
  3. The 7 longWalk schools keep longWalk=True, but their
     walkFromStop_m is updated from straight-line to street values,
     so their longWalk label (which already resolves via routed-foot
     when cached) falls back to the street value, not the straight one.
  4. meta.note and a new meta.street_rule record the rule: street
     (routed-foot) distance, 400 m threshold, over-400 m street
     places are KEPT with an explicit street walking-distance
     note/label, not excluded.

Longo's 338 Dundas St E (longos-dundas-east) was CORRECTED
2026-10-29, not just noted: its old 43.453, -79.696 coordinates
were a rounded placeholder that wrongly mapped it to Kerr St at
Canadian Tire stop 870 (2,891 m street). Nominatim-verified
coordinates 43.4883376, -79.7175689 (OSM way 27500951) remap it
to Trafalgar + Dundas stop 1657 (151 m straight / 336 m street),
so it is under 400 m and no longer in the over-400 m list.

A few routed-foot values are marginally BELOW the haversine value
(14 places, max 38 m — road-network snapping); they are used as
measured, not clamped up to the straight-line value.
"""
import json, sys
from pathlib import Path

DIR = Path(__file__).resolve().parent
PLACES = DIR / "public" / "places.json"
AUDIT = DIR / "street-audit.json"

def main():
    data = json.loads(PLACES.read_text())
    audit = json.loads(AUDIT.read_text())["results"]
    places = data["places"]
    if len(places) != len(audit):
        raise SystemExit(f"count mismatch: places {len(places)} vs audit {len(audit)}")
    over25, schools = [], []
    for i, (p, r) in enumerate(zip(places, audit)):
        # Idempotency: on a re-run, distance_m is already the street
        # value, not the straight value. Accept that (and only that)
        # as already-applied; anything else is a real mismatch.
        already = False
        if p["id"] != r["id"] or p["name"] != r["name"]:
            raise SystemExit(
                f"audit mismatch at position {i}: place "
                f"{p['id']}/{p['name']} vs audit {r['id']}/{r['name']}")
        if p["stop"]["distance_m"] != r["straight_m"]:
            if p["stop"]["distance_m"] == r["street_m"]:
                already = True
            else:
                raise SystemExit(
                    f"audit mismatch at position {i}: place "
                    f"{p['id']}/{p['name']}/{p['stop']['distance_m']} vs audit "
                    f"straight {r['straight_m']} / street {r['street_m']}")
        street = r["street_m"]
        if street is None:
            raise SystemExit(f"missing street measurement for {p['id']} "
                             f"({p['name']}); measure it with measure_street.py first")
        straight = r["straight_m"]
        p["stop"]["distance_m"] = street
        if p.get("longWalk"):
            # The 7 longWalk schools: keep the flag, street value.
            p["walkFromStop_m"] = street
            schools.append((p["name"], straight, street))
        elif straight <= 400 and street > 400:
            note = f"Street walk {street} m from nearest stop"
            if not already:
                if p.get("note"):
                    if "Street walk" not in p["note"]:
                        p["note"] = p["note"] + "; " + note
                else:
                    p["note"] = note
            over25.append((p["id"], p["name"], p["cat"], straight, street))
    data["meta"]["note"] = (
        "Only places with a name, address, and tool-returned coordinates "
        "in the research file, mapped to a GTFS stop. Mapping rule "
        "(user decision 2026-10-29): STREET (routed-foot) distance, "
        "400 m threshold; places over 400 m street are KEPT with an "
        "explicit street walking-distance note/label, not excluded. "
        "South Common, Famijoy/United at 125 Cross Ave, Costco "
        "Oakville, and Nations Experience are never included. "
        "Cross-boundary places are flagged cross=true.")
    data["meta"]["street_rule"] = (
        "User decision 2026-10-29: mapping rule is STREET (routed-foot) "
        "distance, not straight-line. stop.distance_m in places.json is "
        "the routed-foot street distance from street-audit.json "
        "(230/230 measured, coordinates only). Threshold stays 400 m, "
        "but over-400 m street places are NOT excluded: the 24 places "
        "with street >400 m and straight <=400 m carry the distance in "
        "their note field ('Street walk {m} m from nearest stop'), and "
        "the 7 longWalk schools carry it in walkFromStop_m (longWalk "
        "label). Longo's 338 Dundas St E was CORRECTED 2026-10-29: "
        "its old placeholder coordinates wrongly mapped it to Kerr St "
        "stop 870 (2,891 m street); Nominatim-verified coordinates "
        "43.4883376, -79.7175689 (OSM way 27500951) remap it to "
        "Trafalgar + Dundas stop 1657, 151 m straight / 336 m street. "
        "Re-run order: build_stage21.py -> build_schools.py -> "
        "apply_street_rule.py (this script is idempotent).")
    PLACES.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    print(f"places: {len(places)}; distance_m now street for all")
    print(f"over-400 m street, straight <=400 m, note-bearing: {len(over25)}")
    for x in over25:
        print(f"  NOTE {x[1]} ({x[2]}): straight {x[3]} m -> street {x[4]} m")
    print(f"longWalk schools updated to street: {len(schools)}")
    for name, straight, street in schools:
        print(f"  SCHOOL {name}: straight {straight} m -> street {street} m")

if __name__ == "__main__":
    main()
