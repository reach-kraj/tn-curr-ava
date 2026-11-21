/**
 * Builds public/data/tn.json: Tamil Nadu (+ Puducherry) stations, the trains that stop there,
 * a simplified rail network and state outlines.
 *
 * Sources (downloaded into .cache/ on first run):
 *  - Unofficial Indian Railways GTFS feed: https://github.com/Neo2308/indianrailways-gtfs
 *  - India state boundaries: https://github.com/geohacker/india
 *
 * Run: bun run data            (add --refresh to re-download)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { strFromU8 } from "fflate";
import { GTFS_URL, buildDataset } from "../src/lib/buildDataset";
import type { Ring } from "../src/lib/types";

const GEO_URL = "https://raw.githubusercontent.com/geohacker/india/master/state/india_state.geojson";
const CACHE = ".cache";
const OUT = "public/data/tn.json";
const refresh = process.argv.includes("--refresh");

async function cached(url: string, file: string): Promise<Uint8Array> {
  const path = join(CACHE, file);
  if (!refresh && existsSync(path)) return new Uint8Array(readFileSync(path));
  console.log(`Downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(path, buf);
  return buf;
}

const area = (r: Ring) => {
  let s = 0;
  for (let i = 0; i < r.length - 1; i++) s += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
  return Math.abs(s) / 2;
};

/** Douglas–Peucker, iterative to avoid deep recursion on long coastlines. */
function dp(pts: Ring, eps: number): Ring {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    const [ax, ay] = pts[s], [bx, by] = pts[e];
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-12;
    let idx = -1, dm = 0;
    for (let i = s + 1; i < e; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / L;
      if (d > dm) { dm = d; idx = i; }
    }
    if (dm > eps && idx > 0) { keep[idx] = 1; stack.push([s, idx], [idx, e]); }
  }
  return pts.filter((_, i) => keep[i]);
}

/** Simplify a closed ring by splitting it at the point farthest from its start. */
function simplifyRing(r: Ring, eps: number, digits: number): Ring {
  let fi = 0, fd = -1;
  r.forEach(([x, y], i) => { const d = (x - r[0][0]) ** 2 + (y - r[0][1]) ** 2; if (d > fd) { fd = d; fi = i; } });
  const s = [...dp(r.slice(0, fi + 1), eps).slice(0, -1), ...dp(r.slice(fi), eps)];
  const f = 10 ** digits;
  return s.map(([x, y]) => [Math.round(x * f) / f, Math.round(y * f) / f]);
}

async function main() {
  const [zip, geoBuf] = await Promise.all([cached(GTFS_URL, "gtfs.zip"), cached(GEO_URL, "india_state.geojson")]);

  type Feature = { properties: { NAME_1: string }; geometry: { type: string; coordinates: unknown } };
  const geo = JSON.parse(strFromU8(geoBuf)) as { features: Feature[] };
  const outerRings = (f: Feature): Ring[] => {
    const polys = (f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [f.geometry.coordinates]) as Ring[][];
    return polys.map((p) => p[0]);
  };
  const tnRings = geo.features.filter((f) => ["Tamil Nadu", "Puducherry"].includes(f.properties.NAME_1)).flatMap(outerRings);
  const outline = tnRings.filter((r) => area(r) >= 0.0004).map((r) => simplifyRing(r, 0.006, 3)).filter((r) => r.length >= 4);
  const neighbours = geo.features
    .filter((f) => ["Kerala", "Karnataka", "Andhra Pradesh"].includes(f.properties.NAME_1))
    .flatMap((f) => outerRings(f).filter((r) => area(r) >= 0.01).map((r) => ({ n: f.properties.NAME_1, r: simplifyRing(r, 0.012, 2) })));

  const data = buildDataset(zip, { tnRings, outline, neighbours }, (m) => console.log(`· ${m}`));
  // the site has no map: leave out rail links and neighbouring states (≈5 KB compressed)
  const { e, nb, ...shipped } = data;
  void nb;
  mkdirSync("public/data", { recursive: true });
  writeFileSync(OUT, JSON.stringify(shipped));
  console.log(`Wrote ${OUT}: ${data.s.length} stations, ${data.t.length} trains (${e?.length ?? 0} rail links not shipped), feed ${data.feed}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
