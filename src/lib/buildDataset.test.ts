import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { buildDataset, feedVersionOf, parseCsv } from "./buildDataset";
import type { Dataset } from "./types";

test("parseCsv handles quotes, escaped quotes and CRLF", () => {
  const rows = parseCsv('a,b\r\n"x, y","say ""hi"""\r\n1,2\n');
  expect(rows).toEqual([{ a: "x, y", b: 'say "hi"' }, { a: "1", b: "2" }]);
});

// Uses the feed cached by `bun run data`; skipped on a fresh checkout.
const ZIP = ".cache/gtfs.zip";
test.skipIf(!existsSync(ZIP))("in-browser sync (simplified outline) rebuilds the same timetable", () => {
  const zip = new Uint8Array(readFileSync(ZIP));
  const bundled = JSON.parse(readFileSync("public/data/tn.json", "utf8")) as Dataset;
  expect(feedVersionOf(zip)).toBe(bundled.feed);
  // the sync worker only has the simplified outline from the dataset, not the full-detail boundary
  const rebuilt = buildDataset(zip, { tnRings: bundled.b, outline: bundled.b, neighbours: bundled.nb });
  expect(rebuilt.t.length).toBe(bundled.t.length);
  const a = new Set(rebuilt.s.map((s) => s[0])), b = new Set(bundled.s.map((s) => s[0]));
  const diff = [...a].filter((c) => !b.has(c)).length + [...b].filter((c) => !a.has(c)).length;
  expect(diff).toBeLessThanOrEqual(5);
}, 30_000);
