/**
 * Turns an Indian Railways GTFS feed into the compact Tamil Nadu dataset.
 * Shared by scripts/build-data.ts (build time) and the in-browser timetable sync (web worker).
 */
import { unzipSync, strFromU8 } from "fflate";
import type { Dataset, Ring, StopRow, TrainRow } from "./types";

export const GTFS_URL = "https://raw.githubusercontent.com/Neo2308/indianrailways-gtfs/main/gtfs/gtfs.zip";

/** Minimal RFC-4180 CSV parser → array of objects keyed by header. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  const h = head.map((x) => x.replace(/^﻿/, ""));
  return body.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ""])));
}

export function inside(x: number, y: number, ring: Ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

const hm = (t: string) => {
  if (!t) return null;
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
};

const title = (s: string) =>
  s.split(/\s+/).filter(Boolean)
    .map((w) => (w.length > 3 || (/^[A-Za-z]+$/.test(w) && w.length > 2) ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
const RENAME: Record<string, string> = { MAS: "Chennai Central (MGR)" };

/** Read only feed_info.txt from the zip (cheap) to learn the feed version. */
export function feedVersionOf(zip: Uint8Array): string {
  const files = unzipSync(zip, { filter: (f) => f.name.endsWith("feed_info.txt") });
  const key = Object.keys(files)[0];
  if (!key) return "";
  return parseCsv(strFromU8(files[key]))[0]?.feed_version ?? "";
}

export interface Geography {
  /** full-detail Tamil Nadu + Puducherry outer rings, used to decide which stations are "in Tamil Nadu" */
  tnRings: Ring[];
  /** simplified outline + neighbouring states, carried into the dataset for drawing */
  outline: Ring[];
  neighbours: { n: string; r: Ring }[];
}

export function buildDataset(zip: Uint8Array, geo: Geography, log: (msg: string) => void = () => {}): Dataset {
  log("Unpacking timetable");
  const files = unzipSync(zip);
  const csv = (name: string) => {
    const key = Object.keys(files).find((k) => k.endsWith(name));
    if (!key) throw new Error(`${name} missing from GTFS zip`);
    return parseCsv(strFromU8(files[key]));
  };

  log("Finding Tamil Nadu stations");
  const stops = new Map(csv("stops.txt").map((r) => [r.stop_id, r]));
  const xy = (c: string): [number, number] => { const r = stops.get(c)!; return [Number(r.stop_lon), Number(r.stop_lat)]; };
  const tn = new Set<string>();
  for (const [code, r] of stops) {
    if (!r.stop_lat) continue;
    const [x, y] = xy(code);
    if (x < 76 || x > 80.5 || y < 8 || y > 13.6) continue;
    if (geo.tnRings.some((ring) => inside(x, y, ring))) tn.add(code);
  }

  log("Reading train schedules");
  const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const cal = new Map(csv("calendar.txt").map((r) => [
    r.service_id,
    { mask: DAYS.reduce((m, d, i) => (r[d] === "1" ? m | (1 << i) : m), 0), sd: r.start_date, ed: r.end_date },
  ]));
  const routes = new Map(csv("routes.txt").map((r) => [r.route_id, r]));
  const trips = new Map(csv("trips.txt").map((r) => [r.trip_id, r]));
  const seq = new Map<string, { n: number; c: string; a: number | null; d: number | null }[]>();
  for (const r of csv("stop_times.txt")) {
    let l = seq.get(r.trip_id);
    if (!l) seq.set(r.trip_id, (l = []));
    l.push({ n: Number(r.stop_sequence), c: r.stop_id, a: hm(r.arrival_time), d: hm(r.departure_time) });
  }

  const trains: TrainRow[] = [];
  const stationStops = new Map<string, StopRow[]>();
  const edges = new Set<string>();
  const far: Record<string, string> = {};
  for (const [tid, ss] of seq) {
    ss.sort((x, y) => x.n - y.n);
    if (!ss.some((s) => tn.has(s.c))) continue;
    const tr = trips.get(tid), rt = tr && routes.get(tr.route_id);
    if (!tr || !rt) continue;
    const { mask, sd, ed } = cal.get(tr.service_id) ?? { mask: 127, sd: "", ed: "" };
    const o = ss[0], d = ss[ss.length - 1];
    const ti = trains.length;
    trains.push([rt.route_short_name || tid, rt.route_long_name, o.c, d.c, o.d ?? 0, mask, sd, ed, d.a]);
    for (const c of [o.c, d.c]) if (!tn.has(c)) far[c] = title(stops.get(c)?.stop_name ?? c);
    ss.forEach((s, k) => {
      if (!tn.has(s.c)) return;
      if (!stationStops.has(s.c)) stationStops.set(s.c, []);
      stationStops.get(s.c)!.push([ti, k === 0 ? -1 : (s.a ?? -1), k === ss.length - 1 ? -1 : (s.d ?? -1)]);
    });
    for (let k = 0; k < ss.length - 1; k++) {
      const a = ss[k].c, b = ss[k + 1].c;
      if (a !== b && tn.has(a) && tn.has(b)) edges.add([a, b].sort().join("|"));
    }
  }

  log("Drawing the rail network");
  const cosLat = Math.cos((11 * Math.PI) / 180);
  const dist = (a: string, b: string) => { const [x1, y1] = xy(a), [x2, y2] = xy(b); return Math.hypot((x1 - x2) * cosLat, y1 - y2); };
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => { if (!adj.has(a)) adj.set(a, new Set()); adj.get(a)!.add(b); };
  const edgeList = [...edges].map((e) => e.split("|") as [string, string]);
  edgeList.forEach(([a, b]) => { link(a, b); link(b, a); });
  edgeList.sort((p, q) => dist(...q) - dist(...p));
  // drop long chords already covered by a path via 1–2 stations
  for (const [a, b] of edgeList) {
    const dab = dist(a, b) * 1.12, na = adj.get(a)!, nb = adj.get(b)!;
    let covered = [...na].some((c) => nb.has(c) && dist(a, c) + dist(c, b) <= dab);
    if (!covered) {
      outer: for (const c of na) {
        if (c === b) continue;
        for (const e of adj.get(c)!) if (e !== a && nb.has(e) && dist(a, c) + dist(c, e) + dist(e, b) <= dab) { covered = true; break outer; }
      }
    }
    if (covered) { na.delete(b); nb.delete(a); }
  }
  // express trains skipping many stations draw straight chords; drop any link the network already
  // connects by a route at most 1.4× as long
  const detour = (a: string, b: string, limit: number) => {
    const best = new Map<string, number>([[a, 0]]);
    const queue: [string, number][] = [[a, 0]];
    while (queue.length) {
      queue.sort((p, q) => p[1] - q[1]);
      const [u, du] = queue.shift()!;
      if (u === b) return true;
      if (du > (best.get(u) ?? Infinity)) continue;
      for (const v of adj.get(u) ?? []) {
        if ((u === a && v === b) || (u === b && v === a)) continue;
        const dv = du + dist(u, v);
        if (dv <= limit && dv < (best.get(v) ?? Infinity)) { best.set(v, dv); queue.push([v, dv]); }
      }
    }
    return false;
  };
  for (const [a, b] of edgeList) {
    if (!adj.get(a)?.has(b)) continue;
    const d = dist(a, b);
    if (d > 0.25 && detour(a, b, d * 1.4)) { adj.get(a)!.delete(b); adj.get(b)!.delete(a); }
  }

  const used = [...tn].filter((c) => stationStops.has(c)).sort();
  const idx = new Map(used.map((c, i) => [c, i]));
  const kept = new Set<string>();
  for (const [a, set] of adj) for (const b of set) if (idx.has(a) && idx.has(b)) kept.add([idx.get(a)!, idx.get(b)!].sort((x, y) => x - y).join("|"));

  const feedInfo = csv("feed_info.txt")[0];
  return {
    feed: feedInfo?.feed_version ?? "",
    s: used.map((c) => [c, RENAME[c] ?? title(stops.get(c)!.stop_name), +xy(c)[0].toFixed(4), +xy(c)[1].toFixed(4), stationStops.get(c)!.length]),
    o: far,
    t: trains,
    st: Object.fromEntries(used.map((c) => [c, stationStops.get(c)!])),
    e: [...kept].sort().map((k) => k.split("|").map(Number) as [number, number]),
    b: geo.outline,
    nb: geo.neighbours,
  };
}
