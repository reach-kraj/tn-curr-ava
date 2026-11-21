import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { advanceOpens, breaks, lastBookable, openState, tatkalOpens } from "./advance";
import { clockAt, departures, istDay, istInstant } from "./booking";
import { HOLIDAYS } from "./holidays";
import type { Dataset } from "./types";

describe("advance reservation (60 days, journey date excluded, 08:00 IST)", () => {
  test("journey 14 Jan 2027 opens 15 Nov 2026 at 8:00 AM", () => {
    const o = advanceOpens("2027-01-14");
    expect(istDay(o)).toBe("2026-11-15");
    expect(clockAt(o)).toBe("8:00 AM");
  });
  test("journey 18 Oct opens 19 Aug", () => {
    expect(istDay(advanceOpens("2026-10-18"))).toBe("2026-08-19");
  });
  test("tatkal opens the day before: 10 AM AC, 11 AM non-AC", () => {
    expect(istDay(tatkalOpens("2027-01-14", true))).toBe("2027-01-13");
    expect(clockAt(tatkalOpens("2027-01-14", true))).toBe("10:00 AM");
    expect(clockAt(tatkalOpens("2027-01-14", false))).toBe("11:00 AM");
  });
  test("on 21 Nov 2026 you can book up to 20 Jan 2027", () => {
    expect(lastBookable("2026-11-21")).toBe("2027-01-20");
  });
  test("open state", () => {
    const today = "2026-11-21";
    const morning = istInstant(today, 7 * 60), noon = istInstant(today, 12 * 60);
    expect(openState("2027-01-14", noon, today).kind).toBe("open");
    expect(openState("2027-01-20", morning, today).kind).toBe("today-later");
    expect(openState("2027-01-20", noon, today).kind).toBe("open");
    expect(openState("2027-01-26", noon, today)).toEqual({ kind: "future", days: 6 });
    expect(openState("2026-11-20", noon, today).kind).toBe("past");
  });
  test("a train boarded after midnight books by its source date", () => {
    const data = JSON.parse(readFileSync("public/data/tn.json", "utf8")) as Dataset;
    // 16103 leaves Tambaram 6:10 PM on 14 Jan and reaches Karaikudi at 2:35 AM on 15 Jan
    const r = departures(data, "KKDI", "2027-01-15", "10", { reservedOnly: false, runningOnly: false, query: "16103" })[0];
    expect(r.originDay).toBe("2027-01-14");
    expect(istDay(advanceOpens(r.originDay))).toBe("2026-11-15");
  });
});

describe("holiday breaks (TN offices closed Sat + Sun)", () => {
  const list = breaks(HOLIDAYS, "2026-11-21");
  test("Pongal: Fri 15 – Sun 17 Jan 2027, travel Thu 14 Jan (Bhogi)", () => {
    const p = list.find((b) => b.holidays.some((h) => h.name === "Pongal"))!;
    expect([p.start, p.end, p.days]).toEqual(["2027-01-15", "2027-01-17", 3]);
    expect(p.go).toBe("2027-01-14");
    expect(p.holidays.map((h) => h.name)).toContain("Bhogi");
  });
  test("Christmas 2026 (Fri) joins the weekend", () => {
    const c = list[0];
    expect([c.start, c.end, c.days]).toEqual(["2026-12-25", "2026-12-27", 3]);
  });
  test("Republic Day 2027 (Tue) is a single day", () => {
    const r = list.find((b) => b.start === "2027-01-26")!;
    expect(r.days).toBe(1);
  });
  test("Ayutha Pooja + Vijaya Dasami (Fri, Sat) make a 3-day break", () => {
    const a = list.find((b) => b.holidays.some((h) => h.name === "Ayutha Pooja"))!;
    expect([a.start, a.end]).toEqual(["2027-10-08", "2027-10-10"]);
  });
});
