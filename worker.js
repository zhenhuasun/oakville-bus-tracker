/**
 * Oakville newcomer bus tracker — Cloudflare Worker.
 *
 * Serves the static site (public/index.html, public/pairs.json via Workers
 * Static Assets) and proxies Oakville Transit GTFS-Realtime server-side.
 *
 * WHY A PROXY IS REQUIRED (verified 2026-10-27): the Oakville feeds at
 * busfinder.oakvilletransit.ca/gtfsrt/ return NO Access-Control-Allow-Origin
 * header, so a browser cannot fetch them directly. This Worker fetches them
 * server-side, parses the protobuf, and returns JSON with CORS enabled.
 * No secret or API key is used anywhere — the Oakville feeds need none.
 *
 * JOIN RULES (must match derive_pairs.py — do not "simplify" these):
 *   * A static trip_id is plain, or original_trip_id + "_merged_<n>".
 *   * A real-time trip_id equals the original_trip_id (merged trips) or the
 *     plain trip_id (unmerged trips). Match live trips on
 *     (original_trip_id, route_id, current-date service) — route_id is part
 *     of the key because the same original appears under different routes
 *     in the old and new signup.
 *   * Static stop_ids also carry "_merged_<n>" suffixes; strip the suffix
 *     to get the original stop id before matching a real-time stop_id.
 *
 * PROTOBUF FIELD LAYOUT — as observed in the live Oakville feeds
 * (2026-10-27). This is the layout this parser implements, with fallbacks
 * for the textbook layout where it differs:
 *   FeedMessage: header=1, entity=2 (repeated)
 *   FeedEntity: id=1, trip_update=3, vehicle=4, alert=5
 *   VehiclePosition: trip=1, position=2, timestamp=5, vehicle=8
 *     TripDescriptor: trip_id=1, direction_id=4, route_id=5
 *     Position: latitude=1 (float), longitude=2 (float), bearing=3 (float),
 *       speed=5 (float)
 *     VehicleDescriptor: id=1
 *   TripUpdate: trip=1, stop_time_update=2 (repeated), vehicle=3, timestamp=4
 *     StopTimeUpdate (as observed): stop_sequence=1,
 *       arrival event=2 (StopTimeEvent: delay=1, time=2),
 *       stop_id=4 (string), schedule_relationship=5.
 *       Fallback: if field 2 is a printable string it is treated as stop_id,
 *       and field 3 / field 4 length-delimited values are treated as
 *       arrival / departure events (textbook layout).
 *   Alert: informed_entity=5 (repeated; EntitySelector: agency_id=1,
 *     route_id=2), cause=6, effect=7, url=8, header_text=10,
 *     description_text=11. TranslatedString: translation=1 (repeated);
 *     Translation: text=1, language=2.
 *   A VehiclePosition in this feed carries NO current_stop_sequence and
 *   NO stop_id, so the frontend must NOT invent a "bus is at stop X"
 *   position from vehicle data alone. It may only say the bus is on its
 *   way, or that no live position exists.
 */

// ---------------------------------------------------------------------------
// Minimal protobuf wire reader (no dependencies, works in Workers + Node).
// ---------------------------------------------------------------------------
export function readVarint(buf, pos) {
  let result = 0, shift = 0;
  while (pos < buf.length) {
    const b = buf[pos++];
    result += (b & 0x7f) * Math.pow(2, shift);
    if (!(b & 0x80)) return [result, pos];
    shift += 7;
    if (shift > 63) throw new Error("varint too long");
  }
  throw new Error("truncated varint");
}

// Returns [{field, wire, value}] where value is a number (varint/fixed32),
// a Uint8Array (length-delimited), or a float (fixed32, wire 5 is float).
export function readFields(buf) {
  const out = [];
  let pos = 0;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  while (pos < buf.length) {
    const [tag, p1] = readVarint(buf, pos); pos = p1;
    const field = Math.floor(tag / 8), wire = tag % 8;
    if (wire === 0) {
      const [v, p2] = readVarint(buf, pos); pos = p2; out.push({ field, wire, value: v });
    } else if (wire === 2) {
      const [len, p2] = readVarint(buf, pos); pos = p2;
      out.push({ field, wire, value: buf.subarray(pos, pos + len) }); pos += len;
    } else if (wire === 5) {
      out.push({ field, wire, value: view.getFloat32(pos, true) }); pos += 4;
    } else if (wire === 1) {
      out.push({ field, wire, value: view.getFloat64(pos, true) }); pos += 8;
    } else {
      throw new Error("unsupported wire type " + wire);
    }
  }
  return out;
}

const textDecoder = new TextDecoder("utf-8");
function asString(bytes) { return textDecoder.decode(bytes); }
function isPrintableAscii(bytes) {
  if (bytes.length === 0 || bytes.length > 16) return false;
  for (const b of bytes) if (b < 0x20 || b > 0x7e) return false;
  return true;
}
function parseEvent(bytes) {
  const ev = {};
  for (const f of readFields(bytes)) {
    if (f.field === 1) ev.delay = f.value;
    if (f.field === 2) ev.time = f.value;
  }
  return ev;
}
function parseTripDescriptor(bytes) {
  const t = {};
  for (const f of readFields(bytes)) {
    if (f.field === 1) t.trip_id = asString(f.value);
    if (f.field === 4) t.direction_id = f.value;
    if (f.field === 5) t.route_id = asString(f.value);
  }
  return t;
}
function parseTranslatedString(bytes) {
  // Returns the English translation if present, else the first one.
  let first = null;
  for (const f of readFields(bytes)) {
    if (f.field !== 1) continue;
    let text = null, lang = null;
    for (const g of readFields(f.value)) {
      if (g.field === 1) text = asString(g.value);
      if (g.field === 2) lang = asString(g.value);
    }
    if (text !== null) {
      if (!first) first = { text, language: lang };
      if (lang === "en") return { text, language: lang };
    }
  }
  return first || { text: "", language: null };
}

export function parseFeedMessage(bytes) {
  const feed = { header: {}, entities: [] };
  for (const f of readFields(bytes)) {
    if (f.field === 1) {
      for (const g of readFields(f.value)) {
        if (g.field === 1) feed.header.gtfs_realtime_version = asString(g.value);
        if (g.field === 3) feed.header.timestamp = g.value;
      }
    }
    if (f.field !== 2) continue;
    const entity = { id: null, vehicle: null, tripUpdate: null, alert: null };
    for (const g of readFields(f.value)) {
      if (g.field === 1) entity.id = asString(g.value);
      if (g.field === 4) {
        const v = { trip: null, position: null, timestamp: null, vehicle_id: null };
        for (const h of readFields(g.value)) {
          if (h.field === 1) v.trip = parseTripDescriptor(h.value);
          if (h.field === 2) {
            v.position = {};
            for (const p of readFields(h.value)) {
              if (p.field === 1) v.position.latitude = p.value;
              if (p.field === 2) v.position.longitude = p.value;
              if (p.field === 3) v.position.bearing = p.value;
              if (p.field === 5) v.position.speed = p.value;
            }
          }
          if (h.field === 5) v.timestamp = h.value;
          if (h.field === 8) {
            for (const d of readFields(h.value)) if (d.field === 1) v.vehicle_id = asString(d.value);
          }
        }
        entity.vehicle = v;
      }
      if (g.field === 3) {
        const tu = { trip: null, stops: [], vehicle_id: null, timestamp: null };
        for (const h of readFields(g.value)) {
          if (h.field === 1) tu.trip = parseTripDescriptor(h.value);
          if (h.field === 3) {
            for (const d of readFields(h.value)) if (d.field === 1) tu.vehicle_id = asString(d.value);
          }
          if (h.field === 4) tu.timestamp = h.value;
          if (h.field === 2) {
            const stu = { stop_sequence: null, stop_id: null, arrival: null, departure: null };
            for (const s of readFields(h.value)) {
              if (s.field === 1) stu.stop_sequence = s.value;
              if (s.field === 5) stu.schedule_relationship = s.value;
              if (s.wire === 2) {
                if (s.field === 4 && isPrintableAscii(s.value)) {
                  stu.stop_id = asString(s.value);
                } else if (s.field === 2 && isPrintableAscii(s.value)) {
                  // Textbook layout: field 2 is the stop_id string.
                  stu.stop_id = asString(s.value);
                } else if (s.field === 2) {
                  stu.arrival = parseEvent(s.value);
                } else if (s.field === 3) {
                  stu.arrival = parseEvent(s.value);
                } else if (s.field === 4) {
                  stu.departure = parseEvent(s.value);
                }
              }
            }
            tu.stops.push(stu);
          }
        }
        entity.tripUpdate = tu;
      }
      if (g.field === 5) {
        const al = { route_ids: [], header: "", description: "", cause: null, effect: null };
        for (const h of readFields(g.value)) {
          if (h.field === 5) {
            for (const s of readFields(h.value)) if (s.field === 2) al.route_ids.push(asString(s.value));
          }
          if (h.field === 6) al.cause = h.value;
          if (h.field === 7) al.effect = h.value;
          if (h.field === 10) al.header = parseTranslatedString(h.value).text;
          if (h.field === 11) al.description = parseTranslatedString(h.value).text;
        }
        entity.alert = al;
      }
    }
    feed.entities.push(entity);
  }
  return feed;
}

// ---------------------------------------------------------------------------
// Server-side GTFS-Realtime proxy, cached ~30 s (the feed's own refresh).
// ---------------------------------------------------------------------------
const RT_BASE = "https://busfinder.oakvilletransit.ca/gtfsrt";
const CACHE_TTL_MS = 30 * 1000;
const cache = new Map(); // kind -> {at, body}

async function fetchFeed(kind) {
  const now = Date.now();
  const hit = cache.get(kind);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.body;
  const res = await fetch(`${RT_BASE}/${kind}`, {
    headers: { Accept: "application/x-protobuf" },
  });
  if (!res.ok) throw new Error(`upstream ${kind} HTTP ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  const feed = parseFeedMessage(buf);
  const body = { ok: true, timestamp: feed.header.timestamp || null, feed: feed.entities };
  cache.set(kind, { at: now, body });
  return body;
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=30",
    },
  });
}

function toVehicles(feed) {
  return feed.filter((e) => e.vehicle).map((e) => ({
    trip_id: e.vehicle.trip ? e.vehicle.trip.trip_id : null,
    route_id: e.vehicle.trip ? e.vehicle.trip.route_id : null,
    direction_id: e.vehicle.trip ? e.vehicle.trip.direction_id : null,
    latitude: e.vehicle.position ? e.vehicle.position.latitude : null,
    longitude: e.vehicle.position ? e.vehicle.position.longitude : null,
    bearing: e.vehicle.position ? e.vehicle.position.bearing : null,
    speed: e.vehicle.position ? e.vehicle.position.speed : null,
    vehicle_id: e.vehicle.vehicle_id,
    timestamp: e.vehicle.timestamp || null,
    has_trip: !!(e.vehicle.trip && e.vehicle.trip.trip_id),
  }));
}
function toTrips(feed) {
  return feed.filter((e) => e.tripUpdate).map((e) => ({
    trip_id: e.tripUpdate.trip ? e.tripUpdate.trip.trip_id : null,
    route_id: e.tripUpdate.trip ? e.tripUpdate.trip.route_id : null,
    direction_id: e.tripUpdate.trip ? e.tripUpdate.trip.direction_id : null,
    vehicle_id: e.tripUpdate.vehicle_id,
    timestamp: e.tripUpdate.timestamp || null,
    stops: e.tripUpdate.stops.map((s) => ({
      stop_id: s.stop_id, stop_sequence: s.stop_sequence,
      // Prefer the arrival event time; fall back to departure. This feed
      // publishes one event per stop (observed field 2); either one is the
      // time at that stop and is what the board uses.
      time: s.arrival && s.arrival.time ? s.arrival.time
        : s.departure && s.departure.time ? s.departure.time : null,
      delay: s.arrival && typeof s.arrival.delay === "number" ? s.arrival.delay : null,
    })),
  }));
}
function toAlerts(feed) {
  return feed.filter((e) => e.alert).map((e) => ({
    route_ids: e.alert.route_ids, header: e.alert.header,
    description: e.alert.description, cause: e.alert.cause, effect: e.alert.effect,
  }));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === "/api/rt/vehicles") {
        const b = await fetchFeed("vehicles");
        return jsonResponse({ ok: true, timestamp: b.timestamp, vehicles: toVehicles(b.feed) });
      }
      if (path === "/api/rt/trips") {
        const b = await fetchFeed("trips");
        return jsonResponse({ ok: true, timestamp: b.timestamp, trips: toTrips(b.feed) });
      }
      if (path === "/api/rt/alerts") {
        const b = await fetchFeed("alerts");
        return jsonResponse({ ok: true, timestamp: b.timestamp, alerts: toAlerts(b.feed) });
      }
      if (path === "/api/health") {
        return jsonResponse({ ok: true, service: "oakville-bus-tracker" });
      }
    } catch (err) {
      // The frontend treats any non-ok API response as "timetable mode"
      // and must label the board as scheduled, never as live.
      return jsonResponse({ ok: false, error: String(err && err.message ? err.message : err) }, 502);
    }
    // Everything else: the static site (index.html, pairs.json, ...).
    if (env && env.ASSETS && typeof env.ASSETS.fetch === "function") {
      return env.ASSETS.fetch(request);
    }
    return new Response("Static assets are not configured. Deploy with wrangler (see README.md).", {
      status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  },
};
