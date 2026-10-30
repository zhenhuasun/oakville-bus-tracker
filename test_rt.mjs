// Test the Worker protobuf parser against the LIVE Oakville GTFS-RT feeds.
// Usage: node test_rt.mjs
// This only reads public feeds. It does not deploy anything.
import { parseFeedMessage } from "./worker.js";
import fs from "node:fs";

const BASE = "https://busfinder.oakvilletransit.ca/gtfsrt";
let failures = 0;
function check(name, cond, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"} ${name} ${detail}`);
  if (!cond) failures++;
}

const vehiclesBuf = Buffer.from(await (await fetch(`${BASE}/vehicles`)).arrayBuffer());
const tripsBuf = Buffer.from(await (await fetch(`${BASE}/trips`)).arrayBuffer());
const alertsBuf = Buffer.from(await (await fetch(`${BASE}/alerts`)).arrayBuffer());
const vehicles = parseFeedMessage(new Uint8Array(vehiclesBuf));
const trips = parseFeedMessage(new Uint8Array(tripsBuf));
const alerts = parseFeedMessage(new Uint8Array(alertsBuf));

const vehWithTrip = vehicles.entities.filter((e) => e.vehicle && e.vehicle.trip && e.vehicle.trip.trip_id);
const vehPosOnly = vehicles.entities.filter((e) => e.vehicle && !(e.vehicle.trip && e.vehicle.trip.trip_id));
console.log(`vehicles: ${vehicles.entities.length} entities, ${vehWithTrip.length} with trip, ${vehPosOnly.length} position-only`);
check("vehicles parsed", vehicles.entities.length > 0);
check("vehicle trip has route_id", vehWithTrip.every((e) => e.vehicle.trip.route_id));
check("vehicle position lat/lon present", vehWithTrip.every((e) => e.vehicle.position && typeof e.vehicle.position.latitude === "number"));
console.log("sample vehicle:", JSON.stringify(vehWithTrip[0]?.vehicle));

const tu = trips.entities.filter((e) => e.tripUpdate);
console.log(`trip updates: ${tu.length} entities`);
check("trip updates parsed", tu.length > 0);
const tuWithStops = tu.filter((e) => e.tripUpdate.stops.length > 0);
check("trip updates carry stops", tuWithStops.length > 0, `(${tuWithStops.length}/${tu.length})`);
const tuWithStopId = tu.filter((e) => e.tripUpdate.stops.some((s) => s.stop_id));
check("trip update stops carry stop_id", tuWithStopId.length > 0, `(${tuWithStopId.length}/${tu.length})`);
const tuWithTime = tu.filter((e) => e.tripUpdate.stops.some((s) => (s.arrival && s.arrival.time) || (s.departure && s.departure.time)));
check("trip update stops carry a time", tuWithTime.length > 0, `(${tuWithTime.length}/${tu.length})`);
console.log("sample trip update:", JSON.stringify(tuWithStops[0]?.tripUpdate, null, 1).slice(0, 800));

// Join check against pairs.json: RT trip_id + route_id must match a
// (original_trip_id, route_id) pair in the static derivation.
const pairs = JSON.parse(fs.readFileSync(new URL("./public/pairs.json", import.meta.url), "utf-8"));
const staticKeys = new Set();
for (const pair of Object.values(pairs.pairs)) {
  for (const dep of [...pair.departures, ...pair.return_departures]) {
    staticKeys.add(`${dep.original_trip_id}|${dep.route_id}`);
  }
}
const rtKeys = tu.map((e) => `${e.tripUpdate.trip.trip_id}|${e.tripUpdate.trip.route_id}`);
const matched = rtKeys.filter((k) => staticKeys.has(k));
console.log(`RT trips: ${rtKeys.length}, matched to static (original_trip_id+route) in pairs subset: ${matched.length}`);
console.log("sample RT keys:", rtKeys.slice(0, 5));
console.log("sample matched:", matched.slice(0, 5));

const al = alerts.entities.filter((e) => e.alert);
console.log(`alerts: ${al.length} entities`);
for (const e of al) {
  console.log(` alert routes=${JSON.stringify(e.alert.route_ids)} header=${JSON.stringify(e.alert.header)} desc=${JSON.stringify(e.alert.description).slice(0, 160)}`);
}
check("alerts parsed with header text", al.every((e) => e.alert.header));

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
