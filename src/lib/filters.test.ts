import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { departures, istInstant, toStations } from "./booking";
import { NO_FILTERS, activeCount, applyBoardFilters, daypart, onwardCodes, sections, trainKind } from "./filters";
import type { Dataset, TrainStop } from "./types";

const data = JSON.parse(readFileSync("public/data/tn.json", "utf8")) as Dataset;
const stations = toStations(data);
const byCode = new Map(stations.map((s) => [s.code, s]));
const stopsOf = (ti: number): TrainStop[] => {
  const out: TrainStop[] = [];
  for (const [code, list] of Object.entries(data.st)) for (const [t, arr, dep] of list) if (t === ti) out.push({ station: byCode.get(code)!, arr, dep });
  return out;
};
const rows = departures(data, "TBM", "2026-11-21", "10", { reservedOnly: true, runningOnly: true, query: "" });
const noon = istInstant("2026-11-21", 12 * 60);

describe("classification", () => {
  test("trainKind", () => {
    expect(trainKind("VAIGAI SF EXP")).toBe("Superfast");
    expect(trainKind("TBM RMM EXP")).toBe("Express");
    expect(trainKind("MAS MDU VANDE BHARAT")).toBe("Vande Bharat");
    expect(trainKind("MAO-VLNK FTR SPL")).toBe("Special");
    expect(trainKind("NILGIRI MAIL")).toBe("Mail");
  });
  test("daypart boundaries", () => {
    expect(daypart(0)).toBe("night-early");
    expect(daypart(359)).toBe("night-early");
    expect(daypart(360)).toBe("morning");
    expect(daypart(1090)).toBe("evening");
    expect(daypart(1440 + 30)).toBe("night-early");
  });
});

describe("filters on real data (Tambaram)", () => {
  test("no filters keeps everything", () => {
    expect(applyBoardFilters(rows, NO_FILTERS, noon, stopsOf)).toHaveLength(rows.length);
    expect(activeCount(NO_FILTERS)).toBe(0);
  });
  test("going to Rameswaram includes 16103", () => {
    const r = applyBoardFilters(rows, { ...NO_FILTERS, to: "RMM" }, noon, stopsOf);
    expect(r.some((d) => d.num === "16103")).toBe(true);
    expect(r.every((d) => onwardCodes(d, stopsOf(d.ti)).includes("RMM"))).toBe(true);
  });
  test("status filters partition correctly", () => {
    const soon = applyBoardFilters(rows, { ...NO_FILTERS, status: "soon" }, noon, stopsOf);
    const open = applyBoardFilters(rows, { ...NO_FILTERS, status: "open" }, noon, stopsOf);
    const upcoming = applyBoardFilters(rows, { ...NO_FILTERS, status: "upcoming" }, noon, stopsOf);
    expect(soon.length + open.length).toBe(upcoming.length);
    expect(soon.every((d) => d.opens > noon)).toBe(true);
  });
  test("sections cover every row exactly once", () => {
    for (const sort of ["dep", "opens"] as const) {
      const s = sections(rows, sort, noon);
      expect(s.reduce((n, x) => n + x.rows.length, 0)).toBe(rows.length);
    }
  });
});
