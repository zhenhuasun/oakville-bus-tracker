#!/usr/bin/env python3
"""Apply Stage 2 edits to public/index.html. Fails loudly if an anchor is missing."""
import sys

P = "public/index.html"

def rep(old, new, count=1):
    global html
    assert old in html, "ANCHOR NOT FOUND: " + old[:120]
    html = html.replace(old, new, count)



def main():
    global html
    html = open(P, encoding="utf-8").read()
    # 1. CSS: transfer dot on the strip.
    rep(""".strip-dot.dest { background:#fff; border-width:4px; }""",
    """.strip-dot.dest { background:#fff; border-width:4px; }
  .strip-dot.transfer { background:#fff; border-width:4px; border-color:#b00; }""")

    # 2. HTML: transfer dot + label, alternatives container inside the board.
    rep("""      <span class="strip-dot bus" id="stripBus" title=""></span>
      <span class="strip-dot wait" title=""></span>
      <span class="strip-dot dest" title=""></span>""",
    """      <span class="strip-dot bus" id="stripBus" title=""></span>
      <span class="strip-dot wait" title=""></span>
      <span class="strip-dot transfer" id="stripTransfer" title="" hidden></span>
      <span class="strip-dot dest" title=""></span>""")
    rep("""    <div class="strip-labels">
      <span id="stripBusLabel"></span>
      <span id="stripWaitLabel"></span>
      <span id="stripDestLabel"></span>
    </div>""",
    """    <div class="strip-labels">
      <span id="stripBusLabel"></span>
      <span id="stripWaitLabel"></span>
      <span id="stripTransferLabel"></span>
      <span id="stripDestLabel"></span>
    </div>""")
    rep("""  <button class="returnbtn" id="returnBtn"></button>""",
    """  <div id="journeyAlts"></div>
  <button class="returnbtn" id="returnBtn"></button>""")

    # 3. pairNote: no-direct destinations are no longer greyed out — they now
    # show the best one-transfer journey.
    rep('pairNote:"Prototype pairs: 3 starting points. Destinations with no direct bus are greyed out."',
        'pairNote:"Prototype pairs: 3 starting points. A destination with no direct bus now shows the best one-transfer journey instead of being greyed out."')
    rep('pairNote:"Paires du prototype : 3 points de départ. Les destinations sans autobus direct sont grisées."',
        'pairNote:"Paires du prototype : 3 points de départ. Les destinations sans autobus direct affichent désormais le meilleur trajet avec une correspondance, au lieu d\'être grisées."')
    rep('pairNote:"原型行程：3 个出发点。没有直达车的目的地会变灰。"',
        'pairNote:"原型行程：3 个出发点。没有直达车的目的地现在会显示最好的一次换乘方案，不再变灰。"')
    rep('pairNote:"أزواج النموذج: 3 نقاط انطلاق. الوجهات بلا حافلة مباشرة تظهر باللون الرمادي."',
        'pairNote:"أزواج النموذج: 3 نقاط انطلاق. الوجهات بلا حافلة مباشرة تعرض الآن أفضل رحلة بتبديل واحد بدلًا من أن تظهر باللون الرمادي."')
    rep('pairNote:"प्रोटोटाइप जोड़े: 3 प्रारंभिक बिंदु। बिना सीधी बस वाले गंतव्य धूसर दिखेंगे।"',
        'pairNote:"प्रोटोटाइप जोड़े: 3 प्रारंभिक बिंदु। बिना सीधी बस वाले गंतव्य अब धूसर होने के बजाय सर्वोत्तम एक-बदलाव वाली यात्रा दिखाते हैं।"')

    # 4. Home bar: switching the origin clears journey mode.
    rep("""    b.onclick = () => { home = o.id; localStorage.setItem("obt_home", o.id); direction = "out"; boardStopOverride = null; persistTrip(); render(); };""",
    """    b.onclick = () => { home = o.id; localStorage.setItem("obt_home", o.id); direction = "out"; boardStopOverride = null; journeyState = null; persistTrip(); render(); };""")

    # 5. Destination grid: only same-place pairs stay disabled. A pair with no
    # direct departures opens the journey search (direct or one transfer)
    # instead of a greyed-out button.
    rep("""    if (!pair || pair.departures.length === 0) { b.disabled = true; b.title = t("noDirect"); }
    if (dst.id === dest) b.className = "on";
    b.onclick = () => { dest = dst.id; direction = "out"; boardStopOverride = null; persistTrip(); render(); };""",
    """    if (!pair) { b.disabled = true; b.title = t("noDirect"); }
    if (dst.id === dest) b.className = "on";
    b.onclick = () => {
      dest = dst.id; direction = "out"; boardStopOverride = null; journeyState = null;
      if (pair && pair.departures.length > 0) { persistTrip(); render(); return; }
      // No direct departures in the pair matrix: run the full journey
      // search from the home terminal to this destination's nearest stop.
      const o = DATA.origins.find(x => x.id === home);
      const cand = dst.candidate_stops && dst.candidate_stops[0];
      if (o && cand) { setJourney(o.stop_id, cand.id, o.name, dst.name); return; }
      persistTrip(); render();
    };""")

    # 6. renderBoard: journey mode renders its own board.
    rep("""function renderBoard() {
  const pair = currentPair();""",
    """function renderBoard() {
  if (journeyState) { renderJourneyBoard(); return; }
  const pair = currentPair();""")

    # 7. renderAlerts: journey mode renders its own (leg-route) alerts.
    rep("""function renderAlerts() {
  const pair = currentPair();""",
    """function renderAlerts() {
  if (journeyState) return; // renderJourneyBoard renders leg-route alerts
  const pair = currentPair();""")

    # 8. init: also load timetable.json + places.json (tolerate failure).
    rep("""  try { const sres = await fetch("stops.json"); STOPS = await sres.json(); } catch (e) { STOPS = null; }""",
    """  try { const sres = await fetch("stops.json"); STOPS = await sres.json(); } catch (e) { STOPS = null; }
  try { const tres = await fetch("timetable.json"); TT = await tres.json(); } catch (e) { TT = null; }
  try { const pres = await fetch("places.json"); PLACES = await pres.json(); } catch (e) { PLACES = null; }""")

    # 9. Search: add full preset places (places.json) after the prototype loop.
    rep("""  if (STOPS) {
    const isDigits = /^\\d+$/.test(query);""",
    """  if (PLACES) {
    const catNames = (c) => (CAT_LABEL[c] ? Object.values(CAT_LABEL[c]) : []).join(" ");
    let places = PLACES.places.filter(p => {
      const hay = [p.name, p.address, p.stop.name, catNames(p.cat)].join(" ").toLowerCase();
      return hay.includes(query);
    });
    places = places.slice(0, 12);
    for (const p of places)
      out.push({ kind: "place", place: p, label: p.name,
                 sub: p.address + " · " + p.stop.name + " (" + t("stopCode") + " " + p.stop.code + ") · " +
                      t("routesLabel") + " " + p.routes.slice(0, 8).join(", ") +
                      (p.cross ? " · " + t("crossLabel") : "") +
                      " · " + (CAT_LABEL[p.cat] ? (CAT_LABEL[p.cat][lang] || p.cat) : p.cat) });
  }
  if (STOPS) {
    const isDigits = /^\\d+$/.test(query);""")

    # 10. applyResultPrimary: place results + stop fallback go to journey mode.
    rep("""  if (r.kind === "saved") { setSavedAsDestination(r.place); return; }
  if (r.kind === "preset") { dest = r.destId; direction = "out"; boardStopOverride = null; persistTrip(); render(); return; }
  // Stop result: origin stops start here; a destination's candidate stop
  // goes to that destination (the board shows the pair's served stop);
  // any other stop can only be saved — never a fabricated board.
  if (originByStopId(r.stop.id)) { home = originByStopId(r.stop.id).id; try { localStorage.setItem("obt_home", home); } catch (e) {} direction = "out"; boardStopOverride = null; persistTrip(); render(); return; }
  const d = destByCandidateStop(r.stop.id);
  if (d) { dest = d.id; direction = "out"; boardStopOverride = null; persistTrip(); render(); return; }
  setSavedNote(t("cantStart"));""",
    """  if (r.kind === "saved") { setSavedAsDestination(r.place); return; }
  if (r.kind === "preset") { dest = r.destId; direction = "out"; boardStopOverride = null; journeyState = null; persistTrip(); render(); return; }
  if (r.kind === "place") { setJourney(currentOriginStopId(), r.place.stop.id, null, r.place.name); return; }
  // Stop result: origin stops start here; a destination's candidate stop
  // goes to that destination (the board shows the pair's served stop);
  // any other stop now opens the journey search — never a fabricated
  // board, and never the Stage 1 dead end.
  if (originByStopId(r.stop.id)) { home = originByStopId(r.stop.id).id; try { localStorage.setItem("obt_home", home); } catch (e) {} direction = "out"; boardStopOverride = null; journeyState = null; persistTrip(); render(); return; }
  const d = destByCandidateStop(r.stop.id);
  if (d) { dest = d.id; direction = "out"; boardStopOverride = null; journeyState = null; persistTrip(); render(); return; }
  setJourney(currentOriginStopId(), r.stop.id, null, r.stop.name);""")

    rep("""  if (r.kind === "saved") { setSavedAsOrigin(r.place); return; }
  if (r.kind === "preset") { setSavedAsOrigin({ kind: "dest", destId: r.destId }); return; }
  setSavedAsOrigin({ kind: "stop", stopId: r.stop.id, stopName: r.stop.name, stopCode: r.stop.code, enName: r.stop.name });""",
    """  if (r.kind === "saved") { setSavedAsOrigin(r.place); return; }
  if (r.kind === "preset") { setSavedAsOrigin({ kind: "dest", destId: r.destId }); return; }
  if (r.kind === "place") { setJourney(r.place.stop.id, currentDestStopId(), r.place.name, null); return; }
  setSavedAsOrigin({ kind: "stop", stopId: r.stop.id, stopName: r.stop.name, stopCode: r.stop.code, enName: r.stop.name });""")

    # 11. Saved-place handling: place kind + stop fallbacks go to journey mode.
    rep("""// Set a saved place as the DESTINATION. Returns true if a board can show it.
function setSavedAsDestination(p) {
  if (p.kind === "dest") {""",
    """// Set a saved place as the DESTINATION. Returns true if a board can show it.
function setSavedAsDestination(p) {
  if (p.kind === "place") { setJourney(currentOriginStopId(), p.stopId, null, p.custom); return true; }
  if (p.kind === "dest") {""")
    rep("""  if (p.kind === "stop") {
    const o = originByStopId(p.stopId);
    if (o) { setSavedNote(t("cantStart")); return false; }
    const d = destByCandidateStop(p.stopId);
    if (d) { dest = d.id; direction = "out"; boardStopOverride = null; persistTrip(); render(); return true; }
  }
  setSavedNote(t("cantStart")); return false;
}""",
    """  if (p.kind === "stop") {
    const o = originByStopId(p.stopId);
    if (o) { setJourney(currentOriginStopId(), p.stopId, null, p.custom); return true; }
    const d = destByCandidateStop(p.stopId);
    if (d) { dest = d.id; direction = "out"; boardStopOverride = null; journeyState = null; persistTrip(); render(); return true; }
    setJourney(currentOriginStopId(), p.stopId, null, p.custom); return true;
  }
  setSavedNote(t("cantStart")); return false;
}""")
    rep("""function setSavedAsOrigin(p) {
  if (p.kind === "dest") {""",
    """function setSavedAsOrigin(p) {
  if (p.kind === "place") { setJourney(p.stopId, currentDestStopId(), p.custom, null); return true; }
  if (p.kind === "dest") {""")
    rep("""    const d = destByCandidateStop(p.stopId);
    if (d) {
      const order = DATA.origins.slice().sort((a, b) => (a.id === home ? -1 : b.id === home ? 1 : 0));
      const oo = order.find(x => { const pr = DATA.pairs[x.id + "->" + d.id]; return pr && pr.return_departures.length > 0; });
      if (oo) { home = oo.id; try { localStorage.setItem("obt_home", oo.id); } catch (e) {} dest = d.id; direction = "back"; boardStopOverride = p.stopId; persistTrip(); render(); return true; }
    }
  }
  setSavedNote(t("cantStart")); return false;
}""",
    """    const d = destByCandidateStop(p.stopId);
    if (d) {
      const order = DATA.origins.slice().sort((a, b) => (a.id === home ? -1 : b.id === home ? 1 : 0));
      const oo = order.find(x => { const pr = DATA.pairs[x.id + "->" + d.id]; return pr && pr.return_departures.length > 0; });
      if (oo) { home = oo.id; try { localStorage.setItem("obt_home", oo.id); } catch (e) {} dest = d.id; direction = "back"; boardStopOverride = p.stopId; journeyState = null; persistTrip(); render(); return true; }
    }
    setJourney(p.stopId, currentDestStopId(), p.custom, null); return true;
  }
  setSavedNote(t("cantStart")); return false;
}""")

    # 12. Saved cards: unmatched stops can now be a journey destination/origin.
    rep("""    if (isUnmatchedStop) {
      primary.textContent = t("cantStart"); primary.disabled = true;
    } else if (isOriginStop) {""",
    """    if (isUnmatchedStop) {
      primary.textContent = t("setAsDest"); primary.onclick = () => setSavedAsDestination(p);
    } else if (isOriginStop) {""")
    rep("""    if (!isOriginStop && !isUnmatchedStop) {
      const start = document.createElement("button"); start.className = "smallbtn";
      start.textContent = t("setAsOrigin"); start.onclick = () => setSavedAsOrigin(p);
      card.appendChild(start);
    }""",
    """    if (!isOriginStop) {
      const start = document.createElement("button"); start.className = "smallbtn";
      start.textContent = t("setAsOrigin"); start.onclick = () => setSavedAsOrigin(p);
      card.appendChild(start);
    }""")

    # 13. Location confirmation fallback: any stop can now start a journey.
    rep("""function applyStopAsOrigin(stop) {
  // Shared by location confirmation and search/stop "Start here".
  const o = originByStopId(stop.id);
  if (o) { home = o.id; try { localStorage.setItem("obt_home", o.id); } catch (e) {} direction = "out"; boardStopOverride = null; persistTrip(); render(); return true; }
  const d = destByCandidateStop(stop.id);
  if (d) {
    const order = DATA.origins.slice().sort((a, b) => (a.id === home ? -1 : b.id === home ? 1 : 0));
    const oo = order.find(x => { const pr = DATA.pairs[x.id + "->" + d.id]; return pr && pr.return_departures.length > 0; });
    if (oo) { home = oo.id; try { localStorage.setItem("obt_home", oo.id); } catch (e) {} dest = d.id; direction = "back"; boardStopOverride = stop.id; persistTrip(); render(); return true; }
  }
  setSavedNote(t("cantStart")); render(); return false;
}""",
    """function applyStopAsOrigin(stop) {
  // Shared by location confirmation and search/stop "Start here".
  const o = originByStopId(stop.id);
  if (o) { home = o.id; try { localStorage.setItem("obt_home", o.id); } catch (e) {} direction = "out"; boardStopOverride = null; journeyState = null; persistTrip(); render(); return true; }
  const d = destByCandidateStop(stop.id);
  if (d) {
    const order = DATA.origins.slice().sort((a, b) => (a.id === home ? -1 : b.id === home ? 1 : 0));
    const oo = order.find(x => { const pr = DATA.pairs[x.id + "->" + d.id]; return pr && pr.return_departures.length > 0; });
    if (oo) { home = oo.id; try { localStorage.setItem("obt_home", oo.id); } catch (e) {} dest = d.id; direction = "back"; boardStopOverride = stop.id; journeyState = null; persistTrip(); render(); return true; }
  }
  // Stage 2: any other stop starts a journey from that stop.
  setJourney(stop.id, currentDestStopId(), stop.name, null); return true;
}""")

    # 14. Save-from-search for place results.
    rep("""      if (r.kind === "preset") { const d = DATA.destinations.find(x => x.id === r.destId); addSavedPlace({ key: "dest:" + d.id, custom: d.name, kind: "dest", destId: d.id, stopId: null, stopName: null, stopCode: null, address: d.address, enName: d.name }); }""",
    """      if (r.kind === "preset") { const d = DATA.destinations.find(x => x.id === r.destId); addSavedPlace({ key: "dest:" + d.id, custom: d.name, kind: "dest", destId: d.id, stopId: null, stopName: null, stopCode: null, address: d.address, enName: d.name }); }
      else if (r.kind === "place") { addSavedPlace({ key: "place:" + r.place.id, custom: r.place.name, kind: "place", destId: null, stopId: r.place.stop.id, stopName: r.place.stop.name, stopCode: r.place.stop.code, address: r.place.address, enName: r.place.name }); }""")

    open(P, "w", encoding="utf-8").write(html)
    print("patch ok")

if __name__ == "__main__":
    main()
