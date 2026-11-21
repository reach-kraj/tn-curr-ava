import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { departures } from "./booking";
import { googleCalendarUrl, icsFile, icsStamp, reminderText } from "./reminders";
import type { Dataset } from "./types";

const data = JSON.parse(readFileSync("public/data/tn.json", "utf8")) as Dataset;
const d = departures(data, "CGL", "2026-11-21", "10", { reservedOnly: false, runningOnly: false, query: "16103" })[0];
const input = { d, boardAt: "Chengalpattu JN.", sourceName: "Tambaram", destName: "Rameswaram", url: "https://example.test/#CGL" };

test("8:10 AM IST is 02:40 UTC", () => {
  expect(icsStamp(d.opens)).toBe("20261121T024000Z");
});

test("reminder text names train, times and station", () => {
  const { title, body } = reminderText(input);
  expect(title).toBe("Current booking opens · 16103 TBM RMM EXP");
  expect(body).toContain("opens at 8:10 AM, Sat 21 Nov (IST)");
  expect(body).toContain("Boarding at Chengalpattu: departs 6:40 PM");
});

test("Google Calendar link carries start/end in UTC", () => {
  const u = new URL(googleCalendarUrl(input));
  expect(u.hostname).toBe("calendar.google.com");
  expect(u.searchParams.get("action")).toBe("TEMPLATE");
  expect(u.searchParams.get("dates")).toBe("20261121T024000Z/20261121T025500Z");
});

test("ics has two alarms, CRLF lines and none over 75 octets", () => {
  const ics = icsFile(input, Date.UTC(2026, 10, 20));
  expect(ics).toContain("DTSTART:20261121T024000Z");
  expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(2);
  expect(ics).toContain("TRIGGER:-PT10M");
  const lines = ics.split("\r\n");
  expect(lines.every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  expect(ics.includes("\n") && !/[^\r]\n/.test(ics)).toBe(true);
});
