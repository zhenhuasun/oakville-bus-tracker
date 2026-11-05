#!/usr/bin/env python3
"""Stage 2.1: search/category data correction for the Oakville bus tracker.

Idempotent: re-running skips places/stations already present by id.
Applies, on top of public/places.json (Stage 2):
 - mall -> shoppingcentre, hospital/lab -> hospitallab
 - 9 hub stations (in places.json "stations", never small stops)
 - Shopping Centre (13), Community Centre (7 Town centres), Library (7 OPL
   full branches), Large Parks (7 mappable of the 8 named; Gairloch Gardens
   is excluded — nearest OT stop is 1,055 m, over the 400 m mapping rule)
 - Supermarket merge (adds + address fixes, no replacements)
Coordinates: search-verified where available (see README Stage 2.1 notes);
a few are intersection-area coordinates, validated by the nearest-stop
distance printed below. Never invent a stop: nearest stop is computed from
public/stops.json (haversine, straight-line) and stored with distance_m.
STREET RULE (user decision 2026-10-29): places.json distance_m is the
routed-foot STREET distance, not straight-line — apply_street_rule.py
(from street-audit.json) must run AFTER this script and build_schools.py
(order: stage21 -> schools -> apply_street_rule.py), because this
script skips existing places by id (their distance_m is preserved) but
any NEW place added here gets a straight-line distance_m and the >400 m
refusal below is straight-line. A new place must be measured with
measure_street.py and passed through apply_street_rule.py before it
counts as street-rule compliant; over-400 m street places are KEPT
with a street-distance note/label, never excluded by this rule.
NEVER INCLUDE: South Common, Famijoy/United at 125 Cross Ave, Costco
Oakville (under construction, expected fall 2027), Nations Experience
(planned 2027), Sobeys at 2441 Lakeshore Rd W (that address is Farm Boy),
No Frills at 125 Cross Ave (that unit is Iqbal Foods), Desi Mandi at
579 Kerr St (unconfirmed in Oakville; 579 Kerr St is Organic Garage),
Denninger's (conflicting open/closed sources), golf courses.
"""
import json, math, sys
from pathlib import Path

DIR = Path(__file__).resolve().parent
ROOT = DIR.parent
PLACES = ROOT / "public" / "places.json"
STOPS = ROOT / "public" / "stops.json"

def haversine_m(lat1, lon1, lat2, lon2):
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(2 * R * math.asin(math.sqrt(h)))

def main():
    data = json.loads(PLACES.read_text())
    stops = json.loads(STOPS.read_text())["stops"]
    by_id = {s["id"]: s for s in stops}
    places = data["places"]
    by_place_id = {p["id"]: p for p in places}

    def nearest(lat, lon, override=None):
        if override:
            s = by_id[override]
            return {"id": s["id"], "name": s["name"], "code": s["code"],
                    "distance_m": haversine_m(lat, lon, s["lat"], s["lon"])}
        best = min(stops, key=lambda s: haversine_m(lat, lon, s["lat"], s["lon"]))
        return {"id": best["id"], "name": best["name"], "code": best["code"],
                "distance_m": haversine_m(lat, lon, best["lat"], best["lon"])}

    def add(pid, name, address, cat, lat, lon, cross=False, override=None,
            subcat=None, indoor=False, provincial=False, slope=False, note=None):
        if pid in by_place_id:
            return by_place_id[pid], True
        st = nearest(lat, lon, override)
        if st["distance_m"] > 400 and not override:
            raise SystemExit(f"REFUSED >400m: {name} -> {st}")
        p = {"id": pid, "name": name, "address": address, "cat": cat,
             "cross": cross, "lat": lat, "lon": lon, "stop": st,
             "routes": by_id[st["id"]]["routes"]}
        if subcat: p["subcat"] = subcat
        if indoor: p["indoor"] = True
        if provincial: p["provincial"] = True
        if slope: p["slopeNote"] = True
        if note: p["note"] = note
        places.append(p); by_place_id[pid] = p
        return p, False

    # --- Renames / category merges on existing entries -------------------
    # Follow-up (2026-10-28): Asian Supermarket + Specialty Grocery are ONE
    # category now ("specialtyasian"). Organic Garage (was supermarket with
    # subcat "specialty") and T&T Erin Mills (was supermarket; it is an Asian
    # supermarket) move into it. School is deleted for now (see below).
    for p in places:
        if p["cat"] == "asian":
            p["cat"] = "specialtyasian"
        if p.get("subcat") == "specialty":
            p["cat"] = "specialtyasian"; p.pop("subcat", None)
        if p["id"] == "t-t-supermarket-erin-mills":
            p["cat"] = "specialtyasian"
    # Schools are NOT deleted here anymore: the 2026-10-28 geocoding pass
    # (build_schools.py, schools-geocoded.json) restored School as a real
    # category. build_stage21 must preserve school places on re-runs.
    for p in places:
        if p["id"] == "smartcentres-south-oakville-centre" or (
                p["name"] == "SmartCentres South Oakville Centre"):
            p["name"] = "South Oakville Centre"
        if p["name"] == "Oakville Entertainment Centrum":
            p["name"] = "Oakville Entertainment Centrum (Oakville Centrum)"
        if p["cat"] == "mall":
            p["cat"] = "shoppingcentre"
        if p["cat"] in ("hospital", "lab"):
            p["cat"] = "hospitallab"
    # Existing Oakville Place is the only enclosed mall.
    for p in places:
        if p["id"] == "oakville-place" or p["name"] == "Oakville Place":
            p["indoor"] = True

    # --- Shopping Centre additions (13 total after these) ---------------
    add("smartcentres-oakville", "SmartCentres Oakville",
        "234 Hays Blvd, Oakville, ON L6H 6M4", "shoppingcentre",
        43.4840, -79.7180)
    add("riocentre", "RioCentre",
        "478-502 Dundas St W, Oakville, ON L6H 6Y3", "shoppingcentre",
        43.464538, -79.743024)
    add("dorval-crossing", "Dorval Crossing",
        "240 North Service Rd W, Oakville, ON L6M 2Y3", "shoppingcentre",
        43.450314, -79.701442)
    add("abbey-plaza", "Abbey Plaza",
        "1500 Upper Middle Rd, Oakville, ON L6M 3G3", "shoppingcentre",
        43.4380, -79.7420)
    add("oakwoods-centre", "Oakwoods Centre",
        "1915 Ironoak Wy, Oakville, ON L6H 0N1", "shoppingcentre",
        43.492591, -79.680499)

    # --- Community Centre: Town of Oakville ONLY -------------------------
    add("otcc", "Oakville Trafalgar Community Centre",
        "Reynolds St, Oakville, ON (former hospital site)", "communityCentre",
        43.4545, -79.6825)
    add("glen-abbey-cc", "Glen Abbey Community Centre",
        "1415 Third Line, Oakville, ON L6M 3G2", "communityCentre",
        43.435585, -79.739023)
    add("iroquois-ridge-cc", "Iroquois Ridge Community Centre",
        "1051 Glenashton Dr, Oakville, ON L6H 6Z4", "communityCentre",
        43.48803, -79.700909)
    add("river-oaks-cc", "River Oaks Community Centre",
        "2400 6th Line, Oakville, ON", "communityCentre",
        43.470875, -79.723872, override="707")
    add("qepccc", "Queen Elizabeth Park Community and Cultural Centre",
        "2302 Bridge Rd, Oakville, ON", "communityCentre",
        43.404229, -79.719225)
    add("trafalgar-park-cc", "Trafalgar Park Community Centre",
        "133 Rebecca St, Oakville, ON", "communityCentre",
        43.439616, -79.678057)
    add("sixteen-mile-cc", "Sixteen Mile Community Centre",
        "3070 Neyagawa Blvd, Oakville, ON L6M 4L6", "communityCentre",
        43.46592, -79.749336,
        note="Opened Mar 31, 2026, Sixteen Mile Sports Complex")

    # --- Library: OPL full branches ONLY (Express points excluded) -------
    add("opl-central", "Oakville Public Library — Central Branch",
        "120 Navy St, Oakville, ON L6J 2Z4", "library",
        43.443754, -79.671186)
    add("opl-clearview", "Oakville Public Library — Clearview Branch",
        "2860 Kingsway Dr, Oakville, ON L6J 6R3", "library",
        43.501384, -79.661372)
    add("opl-glen-abbey", "Oakville Public Library — Glen Abbey Branch",
        "1415 Third Line, Oakville, ON L6M 3G2", "library",
        43.43573, -79.739196)
    add("opl-iroquois-ridge", "Oakville Public Library — Iroquois Ridge Branch",
        "1051 Glenashton Dr, Oakville, ON L6H 6Z4", "library",
        43.48803, -79.700909)
    add("opl-white-oaks", "Oakville Public Library — White Oaks Branch",
        "1070 McCraney St E, Oakville, ON L6H 2R6", "library",
        43.463718, -79.702365)
    add("opl-woodside", "Oakville Public Library — Woodside Branch",
        "1274 Rebecca St, Oakville, ON L6L 1Z2", "library",
        43.417246, -79.698347)
    add("opl-sixteen-mile", "Oakville Public Library — Sixteen Mile Branch",
        "3070 Neyagawa Blvd, Oakville, ON L6M 4L6", "library",
        43.46592, -79.749336)

    # --- Large Parks: main entrance only, never the park centroid --------
    add("bronte-creek-park", "Bronte Creek Provincial Park",
        "1219 Burloak Dr, Oakville, ON L6M 4J7", "park",
        43.390, -79.752, provincial=True,
        note="Provincial park; day-use fee may apply")
    add("coronation-park", "Coronation Park",
        "1426 Lakeshore Rd W, Oakville, ON L6L 1G2", "park",
        43.4045, -79.7025)
    add("shell-park", "Shell Park",
        "3307 Lakeshore Rd W, Oakville, ON", "park",
        43.3798, -79.7173, override="309")
    add("lakeside-park", "Lakeside Park",
        "144 Front St, Oakville, ON L6J 2Y5", "park",
        43.443, -79.672)
    add("bronte-heritage-park", "Bronte Heritage Waterfront Park",
        "2340 Ontario St, Oakville, ON L6L 6P7", "park",
        43.418, -79.724)
    add("lions-valley-park", "Lions Valley Park",
        "1227 Lions Valley Park Rd, Oakville, ON L6H 6W8", "park",
        43.435, -79.780, slope=True,
        note="Valley trails are steep in places — use caution")
    add("north-park", "North Park",
        "3250 Neyagawa Blvd, Oakville, ON", "park",
        43.469, -79.751, override="1777")
    # Gairloch Gardens (1308 Lakeshore Rd E, 43.462029, -79.650081) is
    # deliberately NOT added: nearest OT stop is 1,055 m away (route 11,
    # Devon Rd + Cairncroft Rd), over the 400 m mapping rule. See excluded.

    # --- Supermarket merge (adds + fixes, never a replacement) -----------
    add("whole-foods-oakville", "Whole Foods Market",
        "301 Cornwall Rd, Oakville, ON L6J 7Z5", "supermarket",
        43.456585, -79.679243)
    add("food-basics-dundas", "Food Basics",
        "478 Dundas St W, Oakville, ON L6H 6Y3", "supermarket",
        43.464, -79.743)
    # Food Basics Clarkson Village added 2026-10-29 (user decision:
    # include WITH an explicit walking-distance label). Nominatim
    # shop node 14140618197 "Food Basics", 1865 Lakeshore Road
    # West, Clarkson, Mississauga, 43.5153326, -79.6263684 (agrees
    # with the foodbasics.ca listing point within ~12 m; Metro
    # newsroom confirms the Jul 9, 2026 opening at Clarkson
    # Village Shopping Centre, 1865 Lakeshore Rd W). Nearest OT
    # stop is Clarkson GO Station (358, code 2318, routes 4/11/12):
    # 600 m straight / 868 m routed-foot street. Over 400 m, so
    # it is KEPT with the explicit note below per the street
    # rule; override pins the stop so a rebuild never refuses
    # it for distance. Cross-boundary: in Mississauga, directly
    # reached by Oakville Transit routes 4/11/12 at Clarkson GO
    # (same precedent as Metro Clarkson Crossings).
    add("food-basics-clarkson-village", "Food Basics Clarkson Village",
        "1865 Lakeshore Rd W, Mississauga, ON L5J 4P1", "supermarket",
        43.5153326, -79.6263684, cross=True, override="358",
        note="Street walk 868 m from nearest stop")
    add("sobeys-maple-grove", "Sobeys Maple Grove",
        "511 Maple Grove Dr, Oakville, ON L6J 4W3", "supermarket",
        43.480363, -79.65577)
    add("east-indian-supermarket", "East Indian Supermarket",
        "2427 Trafalgar Rd, Oakville, ON", "specialtyasian",
        43.48638, -79.715268)
    # Monastery Bakery & Delicatessen added 2026-10-29 (user-supplied
    # address): Nominatim shop node 1601772832 "Monastery Bakery",
    # Monastery Drive, Oakville, 43.4451267, -79.7276188 (the full
    # "Bakery & Delicatessen" name query returns no OSM hit; the shop
    # node and the 1133 Monastery Drive house-number hit agree within
    # ~90 m, and web listings give the same point). Nearest GTFS stop
    # Monastery Dr + Greenbriar Dr (211, code 3016, route 28):
    # 59 m straight / 77 m routed-foot street, under 400 m.
    add("monastery-bakery-delicatessen", "Monastery Bakery & Delicatessen",
        "1133 Monastery Dr, Oakville, ON L6M 2A3", "specialtyasian",
        43.4451267, -79.7276188)
    add("organic-garage", "Organic Garage",
        "579 Kerr St, Oakville, ON L6K 3E1", "specialtyasian",
        43.448, -79.689)
    add("real-canadian-superstore", "Real Canadian Superstore",
        "201 Oak Walk Dr, Oakville, ON L6H 6M3", "supermarket",
        43.475, -79.715)
    # Longo's 338 Dundas St E: NO add() here. derive_places.py already
    # emits this store from the research doc's Nominatim-verified
    # coordinates (43.4883376, -79.7175689; stop 1657, 151 m straight).
    # An add() under a second id ("longos-dundas-east") duplicated the
    # store in places.json (found on the 2026-11-05 GTFS refresh).
    add("sobeys-glen-abbey", "Sobeys Glen Abbey",
        "1500 Upper Middle Rd W, Oakville, ON L6M 3G3", "supermarket",
        43.438, -79.742)
    # No Frills at 125 Cross Ave is absent from Stage 2 data and
    # stays absent (Iqbal only). Sobeys at 2441 Lakeshore Rd W
    # stays absent — that address is Farm Boy Bronte, added
    # 2026-10-29 (see below).
    # Farm Boy Bronte added 2026-10-29 (user decision: enter
    # using this address's tool-verified coordinates). Nominatim
    # shop node 385027447 "Farm Boy", Jones St, Bronte Village,
    # 43.3958128, -79.7113725 (agrees with the farmboy.ca
    # "Farm Boy Bronte, 2441 Lakeshore Road West" listing point
    # within ~11 m and with the 2441 house-number hit within
    # ~72 m; farmboy.ca confirms Farm Boy, not Sobeys, at this
    # address). Nearest OT stop Lakeshore Rd West + Jones St
    # (1266, code 2338, routes 14/14A): 95 m straight / 125 m
    # routed-foot street, under 400 m.
    add("farm-boy-bronte", "Farm Boy Bronte",
        "2441 Lakeshore Rd W, Oakville, ON L6L 5V5", "supermarket",
        43.3958128, -79.7113725)

    # --- Hub stations (exactly 9; verified against stops.json) -----------
    hub_defs = [
        ("oakville-go", "Oakville GO", "1212", False, ""),
        ("uptown-core", "Uptown Core Terminal", "1293", False, ""),
        ("clarkson-go", "Clarkson GO", "358", True, "Cross-boundary"),
        ("bronte-go", "Bronte GO", "645", False, ""),
        ("appleby-go", "Appleby GO", "1543", True, "Cross-boundary"),
        ("trafalgar-407", "Trafalgar Rd + Highway 407 GO Carpool", "1665",
         False, "North Oakville, route 1 — NOT the Dundas + 407 lot"),
        ("dundas-407", "Dundas St. @ Hwy. 407 Park & Ride", "1575",
         True, "West Burlington, route 5 — NOT the Trafalgar + 407 lot"),
        ("laird-ridgeway", "Laird Rd + Ridgeway Dr", "1550", False, ""),
        ("sheridan-college", "Sheridan College", "905", False, ""),
    ]
    stations = []
    for sid, name, stop_id, cross, note in hub_defs:
        s = by_id[stop_id]
        stations.append({"id": sid, "name": name,
                         "stop": {"id": s["id"], "name": s["name"],
                                  "code": s["code"], "distance_m": 0},
                         "routes": s["routes"], "cross": cross, "note": note})
    data["stations"] = stations

    # --- Excluded additions (Stage 2.1) ----------------------------------
    new_excluded = [
        {"name": "Gairloch Gardens", "address": "1308 Lakeshore Rd E, Oakville, ON",
         "reason": "Nearest OT stop 1,055 m (route 11, Devon Rd + Cairncroft Rd), over the 400 m mapping rule"},
        {"name": "Sobeys", "address": "2441 Lakeshore Rd W, Oakville, ON",
         "reason": "User-confirmed: that address is Farm Boy Bronte, not Sobeys"},
        {"name": "No Frills", "address": "125 Cross Ave, Oakville, ON",
         "reason": "That unit is Iqbal Foods Oakville"},
        {"name": "Desi Mandi", "address": "579 Kerr St (claimed), Oakville, ON",
         "reason": "Unconfirmed in Oakville; verified Desi Mandi is in Burlington and 579 Kerr St is Organic Garage"},
        {"name": "Denninger's Foods of the World",
         "address": "2400 Lakeshore Rd W, Oakville, ON",
         "reason": "Conflicting open/permanently-closed sources"},
        {"name": "Food Basics", "address": "3535 Rebecca St, Oakville, ON",
         "reason": "Appears in one flyer list only; needs a second check against the Shoppers at the same address"},
        {"name": "Azores Market / Nostalgia Latin Market / Jubilee Fruit Market / Halton African West Indian Superstore",
         "address": "Oakville, ON",
         "reason": "Single-source or no verified Oakville address — pending"},
        {"name": "M&M Food Market",
         "address": "Oakville, ON",
         "reason": "Frozen-food specialty, not Major supermarkets; no verified Oakville address in this pass"},
        {"name": "St. Luke's Community Centre", "address": "3114 Dundas St W, Oakville, ON",
         "reason": "Anglican — religious, excluded from Town community-centre category"},
        {"name": "YMCA of Oakville", "address": "410 Rebecca St, Oakville, ON",
         "reason": "Charity, not a Town of Oakville community centre"},
        {"name": "Oak Park Neighbourhood Centre", "address": "2200 Sawgrass Dr, Oakville, ON",
         "reason": "Charity, not a Town of Oakville community centre"},
        {"name": "OPL Express pickup points",
         "address": "Queen Elizabeth Park; St. Luke's Community Centre",
         "reason": "Pickup points, not full OPL branches"},
        {"name": "Oakville Public Library — Sixteen Mile Branch (old)",
         "address": "3250 Neyagawa Blvd, Oakville, ON",
         "reason": "Closed Mar 13, 2026; replaced by 3070 Neyagawa Blvd branch"},
        {"name": "Golf courses", "address": "Oakville, ON",
         "reason": "Excluded from Large Parks in Stage 2.1"},
    ]
    # Monastery Bakery split 2026-10-29: the old combined entry is
    # replaced by the M&M-only entry below plus the new listed place.
    # Drop the legacy combined entry first, or a re-run would re-add
    # the stale "address unverified" claim (dedupe is by name+address).
    data["meta"]["excluded"] = [e for e in data["meta"].get("excluded", [])
                                if e["name"] != "M&M Food Market / Monastery Bakery"]
    # Farm Boy Bronte split 2026-10-29: the old pending entry
    # ("no tool-verified coordinates in this pass") is dropped
    # now that the place is listed with verified coordinates,
    # or a re-run would re-add the stale claim.
    data["meta"]["excluded"] = [e for e in data["meta"].get("excluded", [])
                                if e["name"] != "Farm Boy Bronte (second Farm Boy location)"]
    have = {(e["name"], e["address"]) for e in data["meta"].get("excluded", [])}
    for e in new_excluded:
        if (e["name"], e["address"]) not in have:
            data["meta"].setdefault("excluded", []).append(e)
    data["meta"]["stage21_followup"] = (
        "2026-10-28 follow-up: Asian Supermarket and Specialty Grocery merged "
        "into one category 'specialtyasian' (Asian & Specialty Grocery). "
        "School category was deleted for now at that time (the single Gladys "
        "Speers prototype destination was removed; prototype list 10 -> 9), "
        "then RESTORED by the 2026-10-28 Nominatim geocoding pass "
        "(build_schools.py): all 74 geocoded schools are School places. "
        "User decision 2026-10-28: the 7 verified schools >400 m from a "
        "stop are INCLUDED with an explicit walking-distance label "
        "(longWalk=True, walkFromStop_m = true distance) and must never "
        "be dropped by a re-run; 0 unresolved.")
    data["meta"]["stage21_note"] = (
        "Stage 2.1: category results come from the place category field only, "
        "never from substring-matching stop names. Station browsing is the 9 "
        "hub stations only. Shopping Centre is 13 entries (SmartCentres Oakville "
        "and South Oakville Centre separate; Entertainment Centrum = Centrum, "
        "listed once). Community Centre is Town centres only. Library is OPL "
        "full branches only. Schools are in search since the 2026-10-28 "
        "geocoding pass (74 places; the 7 verified schools >400 m are "
        "included with a walking-distance label per user decision "
        "2026-10-28). Large Parks are main-entrance mapped; Gairloch "
        "Gardens is excluded (nearest OT stop 1,055 m). Static package still ends "
        "2026-10-31 (ArcGIS zip MD5 unchanged 2026-10-28).")

    import unicodedata
    def _sortkey(p):
        # A-Z by English name, case-insensitive, accents stripped
        # (École -> Ecole) so French school names sort with the rest.
        folded = unicodedata.normalize("NFKD", p["name"]).encode("ascii", "ignore").decode()
        return (p["cat"], folded.lower())
    places.sort(key=_sortkey)
    PLACES.write_text(json.dumps(data, ensure_ascii=False, indent=1))
    from collections import Counter
    print("places:", len(places), Counter(p["cat"] for p in places))
    print("stations:", [(s["name"], s["stop"]["id"], s["stop"]["code"]) for s in stations])
    for p in places:
        if p["id"] in ("smartcentres-oakville", "riocentre", "dorval-crossing",
                       "abbey-plaza", "oakwoods-centre", "otcc",
                       "river-oaks-cc", "bronte-creek-park", "shell-park",
                       "north-park", "whole-foods-oakville",
                       "real-canadian-superstore",
                       "sobeys-glen-abbey"):
            print(f"  {p['name']} | {p['address']} | stop {p['stop']['id']} "
                  f"{p['stop']['name']} code {p['stop']['code']} {p['stop']['distance_m']}m")
    bad = [p for p in places if p["stop"]["distance_m"] > 400]
    print("over-400m places:", [(p["name"], p["stop"]["distance_m"]) for p in bad])

if __name__ == "__main__":
    main()
