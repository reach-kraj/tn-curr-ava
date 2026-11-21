/**
 * Current-booking maths. Everything is computed on Indian Standard Time wall-clock,
 * so results are the same whatever time zone the viewer's device is in.
 * Instants are plain epoch milliseconds; "days" are "YYYY-MM-DD" strings in IST.
 */
import type { Dataset, Station, TrainRow } from "./types";

export const IST_OFFSET_MIN = 330;
export const DAY_MIN = 1440;
const MIN = 60_000;

export type Rule = "10" | "8" | "4";
export const RULES: Record<Rule, { label: string; note: string }> = {
  "10": { label: "10 hrs", note: "Opens 10 hours before the train leaves its source station." },
  "8": { label: "8 hrs", note: "Reported 2025 rule: 8 hours before source departure; trains leaving the source before 2 PM open at 9 PM the previous night." },
  "4": { label: "4 hrs", note: "Older rule: 4 hours before source departure." },
};

/** Epoch ms for an IST calendar day plus minutes after its midnight (minutes may exceed a day). */
export function istInstant(day: string, minutes: number): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d) + (minutes - IST_OFFSET_MIN) * MIN;
}

/** IST wall-clock parts of an instant. */
export function istParts(ms: number) {
  const d = new Date(ms + IST_OFFSET_MIN * MIN);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), dow: d.getUTCDay(), min: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

export const pad = (n: number) => String(n).padStart(2, "0");
export const istDay = (ms: number) => { const p = istParts(ms); return `${p.y}-${pad(p.m)}-${pad(p.d)}`; };
export const todayIst = (now = Date.now()) => istDay(now);

export function addDays(day: string, n: number): string {
  return istDay(istInstant(day, 0) + n * DAY_MIN * MIN);
}

/** Days between two IST days (b − a). */
export const dayDiff = (a: string, b: string) => Math.round((istInstant(b, 0) - istInstant(a, 0)) / (DAY_MIN * MIN));

/** When current booking opens for a train leaving its source at `srcDep`. */
export function openInstant(srcDep: number, rule: Rule): number {
  if (rule === "8") {
    const { min } = istParts(srcDep);
    if (min < 14 * 60) return istInstant(addDays(istDay(srcDep), -1), 21 * 60);
    return srcDep - 8 * 60 * MIN;
  }
  return srcDep - Number(rule) * 60 * MIN;
}

/** EMU (4xxxx), passenger/MEMU (5xxxx, 6xxxx) and DEMU (7xxxx) trains are unreserved. */
export const isReserved = (num: string) => !/^[4567]/.test(num);

/** Does the train leave its origin on this IST day? */
export function runsOn(t: TrainRow, originDay: string): boolean {
  const [, , , , , mask, sd, ed] = t;
  const bit = (istParts(istInstant(originDay, 0)).dow + 6) % 7; // Monday = 0
  const key = originDay.replaceAll("-", "");
  return ((mask >> bit) & 1) === 1 && (!sd || key >= sd) && (!ed || key <= ed);
}

export interface Departure {
  ti: number;
  train: TrainRow;
  num: string;
  name: string;
  orig: string;
  dest: string;
  /** minutes after origin-day midnight */
  arr: number;
  dep: number;
  originDay: string;
  srcDep: number;
  hereDep: number;
  opens: number;
  reach: number | null;
  runs: boolean;
  startsHere: boolean;
}

export interface Filters { reservedOnly: boolean; runningOnly: boolean; query: string }

/** Every train you can board at `code` on IST day `travelDay`, sorted by departure time. */
export function departures(data: Dataset, code: string, travelDay: string, rule: Rule, f: Filters): Departure[] {
  const q = f.query.trim().toLowerCase();
  const out: Departure[] = [];
  for (const [ti, arr, dep] of data.st[code] ?? []) {
    if (dep < 0) continue; // train ends here
    const train = data.t[ti];
    const [num, name, orig, dest, srcMin, , , , destArr] = train;
    if (f.reservedOnly && !isReserved(num)) continue;
    if (q && !num.includes(q) && !name.toLowerCase().includes(q)) continue;
    const originDay = addDays(travelDay, -Math.floor(dep / DAY_MIN));
    const runs = runsOn(train, originDay);
    if (f.runningOnly && !runs) continue;
    const srcDep = istInstant(originDay, srcMin);
    out.push({
      ti, train, num, name, orig, dest, arr, dep, originDay, srcDep,
      hereDep: istInstant(originDay, dep),
      opens: openInstant(srcDep, rule),
      reach: destArr == null ? null : istInstant(originDay, destArr),
      runs, startsHere: arr < 0,
    });
  }
  return out.sort((a, b) => (a.dep % DAY_MIN) - (b.dep % DAY_MIN) || a.num.localeCompare(b.num));
}

export type Status = { kind: "soon" | "open" | "gone"; ms: number };
export function status(d: Departure, now: number): Status {
  if (now < d.opens) return { kind: "soon", ms: d.opens - now };
  if (now < d.hereDep) return { kind: "open", ms: d.hereDep - now };
  return { kind: "gone", ms: now - d.hereDep };
}

/* ---------- formatting ---------- */
export const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "6:10 PM" from minutes (any day offset). */
export function clock(min: number): string {
  const m = ((min % DAY_MIN) + DAY_MIN) % DAY_MIN;
  const h = Math.floor(m / 60);
  return `${h % 12 || 12}:${pad(m % 60)} ${h < 12 ? "AM" : "PM"}`;
}
export const clockAt = (ms: number) => clock(istParts(ms).min);

export function dayLabel(day: string) {
  const p = istParts(istInstant(day, 0));
  return `${DOW[p.dow]} ${p.d} ${MON[p.m - 1]}`;
}

/** "same day" / "day before" / "next day" / "Sat 21 Nov", relative to `base` day. */
export function relDay(ms: number, base: string): string {
  const diff = dayDiff(base, istDay(ms));
  if (diff === 0) return "same day";
  if (diff === -1) return "day before";
  if (diff === 1) return "next day";
  return dayLabel(istDay(ms));
}

export function duration(ms: number): string {
  const m = Math.round(ms / MIN);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ${pad(m % 60)}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
}

export const shortName = (n: string) => n.replace(/\s+JN\.?$/i, "").replace(/\s+Junction$/i, "");

export function toStations(data: Dataset): Station[] {
  return data.s.map(([code, name, lon, lat, n], i) => ({ i, code, name, lon, lat, n }));
}

/** "Today" / "Tomorrow" / "Yesterday" / "Sat 28 Nov" for an instant, relative to `now` (IST). */
export function dayWord(ms: number, now: number): string {
  const diff = dayDiff(istDay(now), istDay(ms));
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return dayLabel(istDay(ms));
}
