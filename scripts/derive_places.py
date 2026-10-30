#!/usr/bin/env python3
"""
Derive public/places.json for Stage 2 expanded search from the verified
preset-place research in ~/workspace/oakville-gtfs-check/PRESET-DESTINATIONS.md.

Rules (from the user's decisions, 2026-10-27/28 — do not relax them here):
  * Only places that have a NAME, an ADDRESS, and COORDINATES in the
    research file are extracted. Places without tool-returned coordinates
    are NOT geocoded by guesswork; they go to the excluded list.
  * NEVER include South Common (user excluded it entirely, 2026-10-27).
  * NEVER list Famijoy or United Supermarket as current at 125 Cross Ave
    (that unit is Iqbal Foods Oakville since Oct 15, 2026).
  * NEVER list Costco Oakville (3471 Wyecroft Rd) as open (under
    construction, expected fall 2027) or Nations Experience as open
    (planned 2027).
  * NEVER list closed / unverified / transfer-only / "do NOT use" entries
    (Bronte Village Mall — permanently closed; St. Paul's United —
    address unresolved; Food Basics Clarkson Village — user decision
    still pending and its nearest stop is ~600 m; Longo's/Walmart
    Fairview St, Burlington — coordinates unreliable; directory-only
    entries such as PetSmart 2501 Hyde Park Gate, TD's 3 flagged
    branches, LifeLabs 581 Argus Rd, Morelli's second site).
  * Cross-boundary Oakville-Transit-direct places are flagged cross=true
    and must be labelled as such in the UI, never mixed into the town list.
  * Each place is mapped to its NEAREST GTFS stop; if no stop is within
    400 m it is excluded (listed in the report with its distance) and
    must NOT appear as a searchable destination.
  * Sections that are explicitly excluded/coming-soon/transfer-only in
    the research file are skipped by heading tracking (see SKIP_HEADINGS).

Hand overrides (verified in the research, stated here so a parser miss
cannot silently drop or misplace them):
  * The 6 cross-boundary direct places, with the research's own coords.
  * T&T Erin Mills uses the CURRENT storefront address 3060 Ridgeway Dr,
    Mississauga (43.518063, -79.689911); 3055 Vega Blvd was the
    announcement address for the same power-centre site.
  * The 4 open Oakville Asian supermarkets (Galleria, Iqbal Foods
    Oakville, Spice Bazaar, Bombay Grocers).

Usage:
  python3 derive_places.py [--stops public/stops.json] [--out public/places.json]
Prints included/excluded counts and the excluded list (with reasons).
"""
import json, math, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.expanduser("~/workspace/oakville-gtfs-check/PRESET-DESTINATIONS.md")

# (section number, category key) — category keys are translated in index.html.
SECTION_CAT = {
    "1": "supermarket", "2": "mall", "3": "religious", "4": "school",
    "5": "bigbox", "6": "cross", "7": "bank", "8": "hospitallab",
    "9": "asian", "10": "pharmacy",
}
# Headings whose content must be skipped (excluded / coming-soon /
# transfer-only / unverified subsections). Matched case-insensitively as
# substrings of a ## heading line.
SKIP_HEADINGS = [
    "不在本次在营清单内", "未核实、未计入", "未核实", "excluded",
    "do not use", "do not add", "not counted", "coming soon",
    "仅换乘可达", "未核实 — 不得列入", "no oakville branch",
    "separately labelled", "cross-boundary candidates",
    "web only", "web/directory only", "no places coords",
    "unverified / excluded", "excluded / flagged",
    "transfer-only", "仅换乘", "not an oakville store",
    "buddhist", "counts", "汇总",
]
# Subsections that are INCLUDED even though a nearby heading looks like a
# skip (the cross-boundary direct list and the open Asian list). These are
# matched before SKIP_HEADINGS.
INCLUDE_HEADINGS = [
    "oakville transit 直达 — 近镇界",  # section 6 (a)
    "oakville — open asian",           # section 9 (a)
    "border — cross-boundary",         # section 9 (c)
]
BLOCK_NAMES = [
    "famijoy", "united supermarket", "nations", "south common",
    "bronte village mall", "st. paul's united", "st paul's united",
    "colangelo", "btrust", "masjid noor", "wellwise", "tangerine",
    "hsbc", "wood gundy", "private banking", "food basics clarkson",
    "metro erin mills", "metro millcroft", "ikea", "rona+",
    "fairview", "costco burlington", "costco mississauga",
    "lifelabs 581 argus", "petsmart 2501", "ethnic supermarket",
    "oakville mall",  # not a current place; Oakville Place is the mall
]
# Hand overrides: name -> (address, category, cross, lat, lon). Applied
# after parsing; an override replaces any parsed entry with the same name.
OVERRIDES = {
    "Costco Wholesale (Mississauga South)": (
        "3180 Laird Rd, Mississauga, ON L6L 6A5", "supermarket", True,
        43.52076, -79.689209),
    "T&T Supermarket Erin Mills": (
        "3060 Ridgeway Dr, Mississauga, ON L5L 0C2", "supermarket", True,
        43.518063, -79.689911),
    "Metro Clarkson Crossings": (
        "920 Southdown Rd, Mississauga, ON L5J 2Y4", "supermarket", True,
        43.50944, -79.62892),
    "Farm Boy Walkers Line": (
        "3061 Walkers Line, Burlington, ON", "supermarket", True,
        43.393405, -79.8246),
    "Longo's Walkers Line": (
        "2900 Walkers Line, Burlington, ON", "supermarket", True,
        43.390238, -79.822681),
    "Fortinos Appleby Line": (
        "2515 Appleby Line, Burlington, ON", "supermarket", True,
        43.407351, -79.805018),
    "Galleria Supermarket": (
        "2501 Hampshire Gate, Oakville, ON L6H 6C8", "asian", False,
        43.520199, -79.682219),
    "Iqbal Foods Oakville": (
        "125 Cross Ave Unit C2, Oakville, ON L6J 2W8", "asian", False,
        43.455464, -79.687120),
    "Spice Bazaar": (
        "105 Cross Ave A5, Oakville", "asian", False,
        43.4555, -79.6875),  # placeholder replaced below if parsed entry exists
    "Bombay Grocers Oakville": (
        "2333 Taunton Rd, Oakville", "asian", False,
        43.4875, -79.7000),  # placeholder replaced below if parsed entry exists
}
# Spice Bazaar / Bombay Grocers coords are NOT asserted here: the parser
# must find them in the research file; if it does not, these overrides are
# dropped (see main). Only the 8 entries above the placeholder comment
# carry asserted coords.
ASSERTED_OVERRIDES = {k: v for k, v in OVERRIDES.items()
                      if k not in ("Spice Bazaar", "Bombay Grocers Oakville")}

COORD_RE = re.compile(r"(-?\d{2,3}\.\d+)\s*,\s*(-\d{2,3}\.\d+)")
# Top-level sections only: "## 1. 超市…" etc. Numbered English sub-headings
# inside a section ("## 1. Hospitals", "## 2. Medical labs") must NOT reset
# the section — that bug once filed the hospital under "supermarket".
SECTION_RE = re.compile(r"^##\s+(\d+)\.\s+[\u4e00-\u9fff]")
SUBSECTION_RE = re.compile(r"^##+\s+(.*)$")
BANK_BRAND_SHORT = {
    "RBC Royal Bank": "RBC", "TD Canada Trust": "TD", "Scotiabank": "Scotiabank",
    "BMO Bank of Montreal": "BMO", "CIBC": "CIBC",
    "National Bank of Canada": "National Bank",
    "FirstOntario Credit Union": "FirstOntario",
}

def haversine_m(lat1, lon1, lat2, lon2):
    return math.hypot((lat1 - lat2) * 111000,
                      (lon1 - lon2) * 111000 * math.cos(math.radians(lat1)))

def clean(s):
    s = re.sub(r"\*\*", "", s).strip()
    s = re.sub(r"^[\d]+\.\s*", "", s)      # "1. "
    s = re.sub(r"^[-•]\s*", "", s)         # "- "
    return s.strip()

def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--stops", default=os.path.join(ROOT, "public", "stops.json"))
    ap.add_argument("--out", default=os.path.join(ROOT, "public", "places.json"))
    args = ap.parse_args()

    stops_data = json.load(open(args.stops, encoding="utf-8"))
    stops = stops_data["stops"]
    text = open(SRC, encoding="utf-8").read().splitlines()

    section = None
    skip = False
    brand = ""
    advice = False
    raw = []  # (name, address, cat, cross, lat, lon, source_line)
    for line in text:
        m = SECTION_RE.match(line)
        if m:
            section = m.group(1)
            skip = False
            brand = ""
            advice = False
            continue
        sm = SUBSECTION_RE.match(line)
        if sm:
            advice = False
            head = sm.group(1)
            # Brand/group headings (e.g. "RBC Royal Bank", "Shoppers Drug
            # Mart") are content groupings, not skip toggles; they also
            # supply the name for address-only lines (TD branches).
            if " — " in head:
                brand = head.split(" — ")[0].strip()
            if any(h.lower() in head.lower() for h in INCLUDE_HEADINGS):
                skip = False
            elif any(h.lower() in head.lower() for h in SKIP_HEADINGS):
                skip = True
            else:
                skip = False
            continue
        if section is None or skip:
            continue
        # CIBC Client Advice Centres (staffed advice, cash at ATM only —
        # CIBC's own label, NOT full-service) are listed separately below
        # this plain-text line in the research; flag following entries.
        if section == "7" and "client advice centres" in line.lower():
            advice = True
            continue
        # Indented lines are detail bullets (nearest-stop notes, evidence
        # notes, address-discrepancy notes), not place entries. Main
        # entries start at column 0.
        if line[:1] in (" ", "\t"):
            continue
        # Lines whose coords are a GTFS stop reference ("GTFS 358
        # 43.5125, ...") are transit nodes, not preset destinations.
        if "GTFS" in line[:line.find(",")] or " GTFS " in line:
            continue
        cm = COORD_RE.search(line)
        if not cm:
            continue
        lat, lon = float(cm.group(1)), float(cm.group(2))
        if not (43.2 < lat < 43.7 and -79.95 < lon < -79.5):
            continue
        # Split "Name — address — coords..." on em dashes.
        head = line[:cm.start()].strip()
        parts = [clean(p) for p in head.split("—")]
        if len(parts) < 2:
            # Address-only line (e.g. TD branches): the brand heading
            # supplies the name, the line itself is the address.
            if brand and (", Oakville" in head or "Oakville" in head):
                name, address = brand, head
            else:
                continue
        else:
            name, address = parts[0], " — ".join(parts[1:])
            if not address.strip():
                if brand:
                    name, address = brand, name
                else:
                    continue
        # Name cleanup: drop an unbalanced parenthetical tail, e.g.
        # "SmartCentres ... (formerly Hopedale Mall" where the em dash
        # inside the parenthesis split the line.
        if name.count("(") > name.count(")"):
            name = name.split(" (")[0].strip()
        # Address selection: pick the first segment that looks like a
        # street address (street number + street name). This drops format
        # descriptors that sit between name and address ("ENCLOSED",
        # "OPEN-AIR plaza") instead of leaking them into the address.
        addr_parts = [p.strip() for p in address.split(" — ")]
        picked = None
        for p in addr_parts:
            if re.search(r"\d+\s+[A-Za-z]", p):
                picked = p
                break
        if picked is not None:
            address = picked
        # Strip trailing parenthetical notes from the address.
        address = re.sub(r"\s*\([^)]*\)\s*$", "", address).strip(" ,—")
        # Strip a trailing "coords" label.
        address = re.sub(r"\s*coords?\s*$", "", address, flags=re.I).strip(" ,")
        if not name or not address:
            continue
        # Bank branches: prefix the brand, so "Glen Abbey" becomes
        # "Scotiabank Glen Abbey" and is findable by bank name.
        if section == "7" and brand in BANK_BRAND_SHORT:
            short = BANK_BRAND_SHORT[brand]
            if not name.lower().startswith(short.lower()):
                name = f"{short} {name}"
            if advice:
                name += " (Client Advice Centre — advice only, ATM cash)"
        cat = SECTION_CAT.get(section, "place")
        cross = False
        if section == "6":
            cross = True
        if section == "9":
            # Section 9 (c) border entries are cross; (a) town entries are not.
            # The parser cannot see subsection letters reliably here, so
            # cross is decided by city: Mississauga/Burlington = cross.
            cross = ("Mississauga" in address or "Burlington" in address)
        if section == "8":
            cat = "hospital" if "hospital" in name.lower() else "lab"
        raw.append((name, address, cat, cross, lat, lon, line.strip()[:120]))

    # Blocklist + dedupe (same normalised name + coords within ~100 m).
    places = {}
    excluded = []
    for name, address, cat, cross, lat, lon, src in raw:
        lname = name.lower()
        if any(b in lname for b in BLOCK_NAMES):
            excluded.append((name, address, "blocklisted (closed/unverified/coming-soon/not-current)"))
            continue
        if "3471 wyecroft" in address.lower() and "costco" in lname:
            excluded.append((name, address, "Costco Oakville under construction, not open"))
            continue
        if "2059 cornwall" in address.lower():
            excluded.append((name, address, "TD flagged branch, status not re-verified"))
            continue
        # Dedupe on name + street address: the same chain name at different
        # addresses (11 Shoppers, 9 RBC branches, ...) are distinct places;
        # the same place repeated across sections is one place.
        street = address.split(",")[0].strip().lower()
        key = re.sub(r"[^a-z0-9]", "", lname) + "|" + re.sub(r"[^a-z0-9]", "", street)
        if key in places:
            # Keep the first (usually the main-list entry, not a repeat).
            continue
        places[key] = {"name": name, "address": address, "cat": cat,
                       "cross": cross, "lat": lat, "lon": lon}
    # Hand overrides (asserted coords only; unasserted placeholders dropped).
    for name, (address, cat, cross, lat, lon) in ASSERTED_OVERRIDES.items():
        street = address.split(",")[0].strip().lower()
        key = re.sub(r"[^a-z0-9]", "", name.lower()) + "|" + re.sub(r"[^a-z0-9]", "", street)
        places[key] = {"name": name, "address": address, "cat": cat,
                       "cross": cross, "lat": lat, "lon": lon, "_ov": True}
    # Final dedupe by name + coordinates: the same place repeated across
    # sections (Galleria, Iqbal in both the supermarket and Asian lists)
    # must appear once. Override entries win over parsed repeats.
    deduped = []
    for p in places.values():
        norm = re.sub(r"[^a-z0-9]", "", p["name"].lower())
        clash = None
        for q in deduped:
            if (re.sub(r"[^a-z0-9]", "", q["name"].lower()) == norm
                    and haversine_m(p["lat"], p["lon"], q["lat"], q["lon"]) < 150):
                clash = q
                break
        if clash is None:
            deduped.append(p)
        elif p.get("_ov") and not clash.get("_ov"):
            deduped[deduped.index(clash)] = p
    places = deduped
    # Nearest-stop mapping (<= 400 m) + routes from stops.json.
    included, too_far = [], []
    for p in places:
        best = None
        for s in stops:
            d = haversine_m(p["lat"], p["lon"], s["lat"], s["lon"])
            if best is None or d < best[0]:
                best = (d, s)
        if best is None or best[0] > 400:
            too_far.append((p["name"], p["address"],
                            f"nearest stop {best[0]:.0f} m (>400 m)" if best else "no stops"))
            continue
        d, s = best
        included.append({
            "id": re.sub(r"[^a-z0-9]+", "-", p["name"].lower()).strip("-"),
            "name": p["name"], "address": p["address"], "cat": p["cat"],
            "cross": p["cross"], "lat": p["lat"], "lon": p["lon"],
            "stop": {"id": s["id"], "name": s["name"], "code": s["code"],
                     "distance_m": round(d)},
            "routes": s["routes"],
        })
    included.sort(key=lambda x: (x["cat"], x["name"].lower()))
    out = {"meta": {
        "source": "Verified preset-place research, ~/workspace/oakville-gtfs-check/PRESET-DESTINATIONS.md",
        "note": "Only places with a name, address, and tool-returned coordinates in "
                "the research file, mapped to a GTFS stop within 400 m. "
                "South Common, Famijoy/United at 125 Cross Ave, Costco "
                "Oakville, and Nations Experience are never included. "
                "Cross-boundary places are flagged cross=true.",
        "excluded": [{"name": n, "address": a, "reason": r}
                      for n, a, r in excluded + too_far],
    }, "places": included}
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f"parsed raw={len(raw)} unique={len(places)} included={len(included)} "
          f"excluded={len(excluded) + len(too_far)}")
    print(f"wrote {args.out} ({os.path.getsize(args.out)} bytes)")
    print("--- excluded ---")
    for n, a, r in excluded + too_far:
        print(f"  {n} | {a} | {r}")
    print("--- included by category ---")
    from collections import Counter
    print(Counter(x["cat"] for x in included))
    print(f"cross-boundary included: {sum(1 for x in included if x['cross'])}")

if __name__ == "__main__":
    main()
