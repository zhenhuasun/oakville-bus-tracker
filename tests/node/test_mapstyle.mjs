// Map-style harness (2026-10-29): red my-location pin, bus dot with a
// white direction arrow, and ridden-only solid leg segments. Runs the real
// public/index.html inline script in Node with a stub DOM + a recording
// stub Leaflet (no browser, no network, no deploy).
import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, "..", "..", "public", "index.html"), "utf8");
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
const pairs = JSON.parse(fs.readFileSync(path.join(dir, "..", "..", "public", "pairs.json"), "utf8"));
const stops = JSON.parse(fs.readFileSync(path.join(dir, "..", "..", "public", "stops.json"), "utf8"));
const tt = JSON.parse(fs.readFileSync(path.join(dir, "..", "..", "public", "timetable.json"), "utf8"));
const places = JSON.parse(fs.readFileSync(path.join(dir, "..", "..", "public", "places.json"), "utf8"));
const shapeFile = (route) => JSON.parse(fs.readFileSync(path.join(dir, "..", "..", "public", "shapes", route + ".json"), "utf8"));

function makeEl(id) {
  const el = { id, _html: "", textContent: "", className: "", hidden: false,
    disabled: false, title: "", value: "", placeholder: "", lang: "", dir: "",
    children: [], appendChild(c) { this.children.push(c); return c; },
    setAttribute() {}, style: {} };
  Object.defineProperty(el, "innerHTML", {
    get() { return this._html; },
    set(v) { this._html = v; this.children = []; },
  });
  return el;
}
const els = new Map();
function getEl(id) { if (!els.has(id)) els.set(id, makeEl(id)); return els.get(id); }
const store = new Map();
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
// Recording stub Leaflet: circleMarker THROWS, so any surviving use of
// the old dot rendering fails the run instead of passing silently.
const maps = [];
function layerObj(kind, extra) {
  return { kind, ...extra, addTo(map) { map.layers.push(this); return this; } };
}
const Lstub = {
  map: () => {
    const m = { layers: [], fitted: null,
      fitBounds(b) { this.fitted = b; },
      remove() {},
      removeLayer(l) { const i = this.layers.indexOf(l); if (i >= 0) this.layers.splice(i, 1); } };
    maps.push(m); return m;
  },
  tileLayer: (url, opts) => layerObj("tile", { url, opts }),
  polyline: (pts, opts) => layerObj("polyline", { pts, opts }),
  marker: (latlon, opts) => layerObj("marker", { latlon, opts }),
  divIcon: (opts) => ({ ...opts, _isDivIcon: true }),
  circleMarker: () => { throw new Error("circleMarker must not be used by map rendering"); },
};
const sandbox = {
  console, localStorage, L: Lstub,
  navigator: { geolocation: { getCurrentPosition(ok) {
    ok({ coords: { latitude: 43.4558, longitude: -79.6824 } }); } } },
  setInterval: () => 0, clearInterval: () => {},
  fetch: async (url) => {
    const u = String(url);
    if (u.includes("pairs.json")) return { json: async () => pairs };
    if (u.includes("stops.json")) return { json: async () => stops };
    if (u.includes("timetable.json")) return { json: async () => tt };
    if (u.includes("places.json")) return { json: async () => places };
    const m = u.match(/shapes\/([^/]+)\.json$/);
    if (m) { try { return { json: async () => shapeFile(decodeURIComponent(m[1])) }; } catch (e) { return { json: async () => ({}) }; } }
    return { json: async () => ({ ok: false, trips: [], vehicles: [], alerts: [] }) };
  },
  document: { getElementById: getEl, createElement: () => makeEl(""),
    documentElement: getEl("html") },
};
vm.createContext(sandbox);
const hooks = `
globalThis.__t = {
  data: () => DATA, tt: () => TT,
  fns: { searchJourneys, setShapeData, buildJourneyMapData, buildPairMapData,
    renderMapLeaflet, requestMapLocation, mapState,
    legShapeSegments, liveDotBearing, liveDotIconHtml, userLocationPinHtml,
    stopNameOf },
  setRT: (trips, vehicles) => { RT.trips = new Map(trips); RT.vehicles = new Map(vehicles); RT.ok = true; },
};
`;
vm.runInContext(script + hooks, sandbox);
const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 40 && (!sandbox.__t.data() || !sandbox.__t.tt()); i++) await tick();
const T = sandbox.__t;
let failures = 0;
function check(name, cond, extra = "") {
  console.log((cond ? "PASS" : "FAIL") + " " + name + (cond ? "" : " " + extra));
  if (!cond) failures++;
}
// Independent compass-bearing reference (duplicated formula, not the
// function under test) for the shape-fallback assertions.
function refBearing(p1, p2) {
  const dLon = (p2[1] - p1[1]) * Math.PI / 180;
  const lat1 = p1[0] * Math.PI / 180, lat2 = p2[0] * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// Static: no circleMarker call survives anywhere in the frontend.
check("no circleMarker call remains in index.html", !html.includes("circleMarker("));

// Fixture: direct journey, then its map data.
const direct = T.fns.searchJourneys("1212", "789", new Date("2026-10-27T12:10:00Z"));
const directOpt = direct && direct.options.find(o => o.transfers === 0);
check("direct journey option exists", !!directOpt);
for (const r of [...new Set(directOpt.legs.map(l => l.route))]) T.fns.setShapeData(r, shapeFile(r));
const dmap = T.fns.buildJourneyMapData(directOpt);
check("direct map data built", !!dmap);

// (a) Red my-location pin, single instance across re-taps and re-renders.
const ok = T.fns.renderMapLeaflet(dmap);
check("renderMapLeaflet succeeds with stub Leaflet", ok === true);
let cur = maps[maps.length - 1];
const pinMarkers = () => cur.layers.filter(l => l.kind === "marker" && l.opts && typeof l.opts.icon.html === "string" && l.opts.icon.html.includes("#d32f2f"));
T.fns.requestMapLocation();
cur = maps[maps.length - 1];
check("my-location renders a red pin divIcon (not a dot)", pinMarkers().length === 1 &&
  pinMarkers()[0].opts.icon.html.includes("36px") && pinMarkers()[0].latlon[0] === 43.4558 && pinMarkers()[0].latlon[1] === -79.6824,
  JSON.stringify(pinMarkers().map(p => p.opts.icon.html).slice(0, 1)));
T.fns.requestMapLocation();
cur = maps[maps.length - 1];
check("re-tapping my-location replaces the pin instead of duplicating it", pinMarkers().length === 1);
T.fns.renderMapLeaflet(dmap);
cur = maps[maps.length - 1];
check("map refresh still shows exactly one red pin", pinMarkers().length === 1);
check("pin html carries a white centre dot", T.fns.userLocationPinHtml().includes("#fff"));

// (b) Bus dot: green circle + white arrow, rotation from bearing, then
// from shape direction when bearing is null.
const pleg = directOpt.legs[0];
const sf = shapeFile(pleg.route);
const sid = sf.trips[pleg.service + "|" + pleg.original];
const shape = sf.shapes[sid];
T.setRT([], [[pleg.original + "|" + pleg.route, { trip_id: pleg.original, route_id: pleg.route, latitude: 43.46, longitude: -79.69, bearing: 90 }]]);
let live = T.fns.buildJourneyMapData(directOpt);
check("RT bearing passes through to the live dot", live && live.liveDots.length === 1 && live.liveDots[0].bearing === 90,
  JSON.stringify(live && live.liveDots));
T.fns.renderMapLeaflet(live);
cur = maps[maps.length - 1];
let bus = cur.layers.filter(l => l.kind === "marker" && l.opts && typeof l.opts.icon.html === "string" && l.opts.icon.html.includes("#1a7a2e"));
check("live dot renders green circle + white arrow rotated to bearing",
  bus.length === 1 && bus[0].opts.icon.html.includes("rotate(90deg)") && bus[0].opts.icon.html.includes("border-bottom:11px solid #fff"),
  bus.map(b => b.opts.icon.html).join(" | ").slice(0, 200));
// Bearing null: vehicle sitting exactly on shape point 10 -> direction
// to shape point 11.
T.setRT([], [[pleg.original + "|" + pleg.route, { trip_id: pleg.original, route_id: pleg.route, latitude: shape[10][0], longitude: shape[10][1] }]]);
live = T.fns.buildJourneyMapData(directOpt);
const expected = refBearing(shape[10], shape[11]);
check("bearing null falls back to shape direction at the vehicle position",
  live && Math.abs(live.liveDots[0].bearing - expected) < 1e-9,
  "got=" + (live && live.liveDots[0].bearing) + " expected=" + expected);
T.fns.renderMapLeaflet(live);
cur = maps[maps.length - 1];
bus = cur.layers.filter(l => l.kind === "marker" && l.opts && typeof l.opts.icon.html === "string" && l.opts.icon.html.includes("#1a7a2e"));
check("shape-fallback arrow rotation matches shape direction",
  bus.length === 1 && bus[0].opts.icon.html.includes("rotate(" + live.liveDots[0].bearing + "deg)"));
// Vehicle on the LAST shape point -> direction from the previous point.
T.setRT([], [[pleg.original + "|" + pleg.route, { trip_id: pleg.original, route_id: pleg.route, latitude: shape[shape.length - 1][0], longitude: shape[shape.length - 1][1] }]]);
live = T.fns.buildJourneyMapData(directOpt);
const expectedLast = refBearing(shape[shape.length - 2], shape[shape.length - 1]);
check("vehicle on last shape point uses previous-point direction",
  live && Math.abs(live.liveDots[0].bearing - expectedLast) < 1e-9);
T.setRT([], []);

// (c) Leg split: solid ridden + dashed transparent unridden.
const leg = dmap.legs[0];
const seg = T.fns.legShapeSegments(leg);
check("leg splits with board index < alight index", !!seg && seg.boardIndex < seg.alightIndex,
  JSON.stringify(seg && { boardIndex: seg.boardIndex, alightIndex: seg.alightIndex }));
check("ridden segment is the exact shape slice board..alight (endpoints shared, no gap)",
  !!seg && JSON.stringify(seg.ridden) === JSON.stringify(leg.shape.slice(seg.boardIndex, seg.alightIndex + 1)) &&
  seg.before[seg.before.length - 1] === seg.ridden[0] && seg.after[0] === seg.ridden[seg.ridden.length - 1]);
T.fns.renderMapLeaflet(dmap);
cur = maps[maps.length - 1];
const legLines = cur.layers.filter(l => l.kind === "polyline" && l.opts.color === "#0b5cab");
const solid = legLines.filter(l => !l.opts.dashArray);
const dashed = legLines.filter(l => l.opts.dashArray === "8 8" && l.opts.opacity === 0.35);
check("rendered leg: exactly one solid ridden line at full opacity",
  solid.length === 1 && JSON.stringify(solid[0].pts) === JSON.stringify(seg.ridden) && solid[0].opts.weight === 5);
check("rendered leg: unridden parts dashed at 0.35 opacity, same colour/weight",
  dashed.length === (seg.before.length > 1 ? 1 : 0) + (seg.after.length > 1 ? 1 : 0) &&
  dashed.every(l => l.opts.weight === 5) &&
  JSON.stringify(dashed.map(l => l.pts)) === JSON.stringify([seg.before, seg.after].filter(s => s.length > 1)));
check("unridden dash pattern matches the existing walk dashes (8 8)",
  dashed.every(l => l.opts.dashArray === "8 8"));
// Fallbacks: swapped board/alight and implausibly far stop -> full solid.
const swapped = { ...leg, boardStop: leg.alightStop, alightStop: leg.boardStop, boardPt: leg.alightPt, alightPt: leg.boardPt };
check("board after alight falls back to null (full solid, never a fake line)",
  T.fns.legShapeSegments(swapped) === null);
const far = { ...leg, boardPt: [0, 0] };
check("stop >500 m from its own shape falls back to null",
  T.fns.legShapeSegments(far) === null);
const noStops = { route: leg.route, shape: leg.shape };
check("leg without board/alight stops falls back to null",
  T.fns.legShapeSegments(noStops) === null);
T.fns.renderMapLeaflet({ ...dmap, legs: [{ ...leg, boardStop: leg.alightStop, alightStop: leg.boardStop, boardPt: leg.alightPt, alightPt: leg.boardPt }] });
cur = maps[maps.length - 1];
const fbLines = cur.layers.filter(l => l.kind === "polyline" && l.opts.color === "#0b5cab");
check("fallback render draws the full shape solid",
  fbLines.length === 1 && !fbLines[0].opts.dashArray && JSON.stringify(fbLines[0].pts) === JSON.stringify(leg.shape));

// (d) Unchanged: markers, transfer walk dashes, bounds, pair map.
check("direct map keeps origin + destination markers, no transfer marker",
  dmap.markers.some(m => m.kind === "origin") && dmap.markers.some(m => m.kind === "destination") && !dmap.markers.some(m => m.kind === "transfer"));
const morning = T.fns.searchJourneys("1212", "1397", new Date("2026-10-27T12:10:00Z"));
const proof = morning && morning.options.find(o => o.transfers === 1);
for (const r of ["28", "3"]) T.fns.setShapeData(r, shapeFile(r));
const pmap2 = T.fns.buildJourneyMapData(proof);
T.fns.renderMapLeaflet(pmap2);
cur = maps[maps.length - 1];
check("1-transfer map keeps transfer marker and red dashed walk",
  pmap2 && pmap2.markers.some(m => m.kind === "transfer") &&
  cur.layers.some(l => l.kind === "polyline" && l.opts.color === "#b00" && l.opts.dashArray === "8 8"));
T.fns.renderMapLeaflet(dmap);
cur = maps[maps.length - 1];
const b = dmap.bounds;
check("bounds still computed from the full shape + stops (framing unchanged)",
  cur.fitted && cur.fitted[0][0] === b.minLat && cur.fitted[0][1] === b.minLon &&
  cur.fitted[1][0] === b.maxLat && cur.fitted[1][1] === b.maxLon,
  JSON.stringify(cur.fitted));
const pairDep = pairs.pairs["oakville_go->iqbal"].departures[0];
T.fns.setShapeData(pairDep.route_id, shapeFile(pairDep.route_id));
const pmap = T.fns.buildPairMapData(pairDep);
check("pair map leg carries board/alight stops for the same split",
  !!pmap && pmap.legs[0].boardStop === pairDep.origin_stop && pmap.legs[0].alightStop === pairDep.destination_stop &&
  !!T.fns.legShapeSegments(pmap.legs[0]));

console.log(failures === 0 ? "ALL MAPSTYLE CHECKS PASSED" : failures + " FAILURES");
process.exit(failures === 0 ? 0 : 1);
