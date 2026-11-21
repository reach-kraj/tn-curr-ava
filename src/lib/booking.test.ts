import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  addDays, clock, clockAt, departures, istInstant, isReserved, openInstant, relDay, runsOn, status,
} from "./booking";
import type { Dataset, TrainRow } from "./types";

const data = JSON.parse(readFileSync("public/data/tn.json", "utf8")) as Dataset;
const all = { reservedOnly: false, runningOnly: false, query: "" };

describe("openInstant", () => {
  const src = istInstant("2026-11-21", 18 * 60 + 10); // 6:10 PM IST

  test("10-hour rule: 6:10 PM source → 8:10 AM same day", () => {
    expect(clockAt(openInstant(src, "10"))).toBe("8:10 AM");
    expect(relDay(openInstant(src, "10"), "2026-11-21")).toBe("same day");
  });

  test("8-hour rule after 2 PM: departure minus 8 hours", () => {
    expect(clockAt(openInstant(src, "8"))).toBe("10:10 AM");
  });

  test("8-hour rule before 2 PM: 9 PM the previous night", () => {
    const morning = istInstant("2026-11-21", 6 * 60 + 30);
    const o = openInstant(morning, "8");
    expect(clockAt(o)).toBe("9:00 PM");
    expect(relDay(o, "2026-11-21")).toBe("day before");
  });

  test("crosses midnight backwards for early trains", () => {
    const early = istInstant("2026-11-21", 5 * 60);
    const o = openInstant(early, "10");
    expect(clockAt(o)).toBe("7:00 PM");
    expect(relDay(o, "2026-11-21")).toBe("day before");
  });
});

describe("helpers", () => {
  test("clock handles day offsets", () => {
    expect(clock(1118)).toBe("6:38 PM");
    expect(clock(1440 + 30)).toBe("12:30 AM");
    expect(clock(720)).toBe("12:00 PM");
  });
  test("addDays across month end", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  test("reserved detection", () => {
    expect(isReserved("16103")).toBe(true);
    expect(isReserved("40524")).toBe(false);
    expect(isReserved("66045")).toBe(false);
  });
  test("runsOn respects weekday mask and date range", () => {
    const sat: TrainRow = ["1", "x", "A", "B", 0, 1 << 5, "20260101", "20261231", null];
    expect(runsOn(sat, "2026-11-21")).toBe(true); // Saturday
    expect(runsOn(sat, "2026-11-22")).toBe(false);
    expect(runsOn(sat, "2027-01-02")).toBe(false); // outside range
  });
});

describe("departures (real data)", () => {
  test("16103 at Chengalpattu: leaves Tambaram 6:10 PM, current availability opens 8:10 AM", () => {
    const rows = departures(data, "CGL", "2026-11-21", "10", { ...all, query: "16103" });
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.orig).toBe("TBM");
    expect(clockAt(r.srcDep)).toBe("6:10 PM");
    expect(clock(r.dep)).toBe("6:40 PM");
    expect(clockAt(r.opens)).toBe("8:10 AM");
    expect(r.originDay).toBe("2026-11-21");
  });

  test("next-day stop shifts origin day back", () => {
    const rows = departures(data, "RMM", "2026-11-22", "10", { ...all, query: "16103" });
    // 16103 terminates at Rameswaram, so it is not boardable there
    expect(rows).toHaveLength(0);
    // Karaikudi: 16103 departs 2:35 AM the morning after it leaves Tambaram
    const kkdi = departures(data, "KKDI", "2026-11-22", "10", { ...all, query: "16103" });
    expect(kkdi).toHaveLength(1);
    expect(clock(kkdi[0].dep)).toBe("2:35 AM");
    expect(kkdi[0].originDay).toBe("2026-11-21");
    expect(clockAt(kkdi[0].opens)).toBe("8:10 AM");
    expect(relDay(kkdi[0].opens, "2026-11-22")).toBe("day before");
  });

  test("terminating trains are excluded and results sorted by time", () => {
    const rows = departures(data, "MS", "2026-11-21", "10", all);
    expect(rows.length).toBeGreaterThan(20);
    for (let i = 1; i < rows.length; i++) expect(rows[i].dep % 1440).toBeGreaterThanOrEqual(rows[i - 1].dep % 1440);
    expect(rows.every((r) => r.dep >= 0)).toBe(true);
  });

  test("status transitions", () => {
    const r = departures(data, "CGL", "2026-11-21", "10", { ...all, query: "16103" })[0];
    expect(status(r, istInstant("2026-11-21", 7 * 60)).kind).toBe("soon");
    expect(status(r, istInstant("2026-11-21", 12 * 60)).kind).toBe("open");
    expect(status(r, istInstant("2026-11-21", 19 * 60)).kind).toBe("gone");
  });
});
