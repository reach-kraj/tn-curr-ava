/**
 * Advance reservation (ARP) maths, in IST.
 *
 * Indian Railways opens reservations 60 days before the date of journey, not counting the journey
 * date itself (in force since 1 Nov 2024), at 08:00 IST. The "date of journey" is the day the train
 * leaves its SOURCE station, so a train you board after midnight follows the previous day.
 * Tatkal opens the day before that date: 10:00 for AC classes, 11:00 for non-AC.
 */
import { addDays, dayDiff, istInstant, istParts } from "./booking";
import type { Holiday } from "./holidays";

export const ARP_DAYS = 60;
export const ARP_OPEN_MIN = 8 * 60;

/** When advance booking opens for a train whose source departure is on `originDay`. */
export const advanceOpens = (originDay: string) => istInstant(addDays(originDay, -ARP_DAYS), ARP_OPEN_MIN);
export const tatkalOpens = (originDay: string, ac: boolean) => istInstant(addDays(originDay, -1), ac ? 10 * 60 : 11 * 60);
/** The furthest journey date (source departure day) that can be booked today. */
export const lastBookable = (today: string) => addDays(today, ARP_DAYS);

export type OpenState = { kind: "future"; days: number } | { kind: "today-later" } | { kind: "open" } | { kind: "past" };
export function openState(originDay: string, now: number, today: string): OpenState {
  if (dayDiff(today, originDay) < 0) return { kind: "past" };
  const opens = advanceOpens(originDay);
  if (now >= opens) return { kind: "open" };
  const days = dayDiff(today, addDays(originDay, -ARP_DAYS));
  return days === 0 ? { kind: "today-later" } : { kind: "future", days };
}

const isWeekend = (day: string) => { const d = istParts(istInstant(day, 0)).dow; return d === 0 || d === 6; };

export interface Break {
  start: string; end: string; days: number;
  holidays: Holiday[];
  /** suggested travel: leave the evening before the break, come back on its last day */
  go: string; back: string;
}

/**
 * Group public holidays with adjoining weekends into breaks (Tamil Nadu government offices close on
 * all Saturdays and Sundays). Festival-only days are attached to the break they touch.
 */
export function breaks(list: Holiday[], from: string): Break[] {
  const pub = new Set(list.filter((h) => h.kind === "public").map((h) => h.date));
  const off = (d: string) => pub.has(d) || isWeekend(d);
  const out: Break[] = [];
  const seen = new Set<string>();
  for (const h of [...list].sort((a, b) => a.date.localeCompare(b.date))) {
    if (h.kind !== "public" || seen.has(h.date) || h.date < from) continue;
    let start = h.date, end = h.date;
    while (off(addDays(start, -1))) start = addDays(start, -1);
    while (off(addDays(end, 1))) end = addDays(end, 1);
    for (let d = start; d <= end; d = addDays(d, 1)) seen.add(d);
    const inRange = (d: string) => d >= addDays(start, -1) && d <= end;
    out.push({
      start, end, days: dayDiff(start, end) + 1,
      holidays: list.filter((x) => inRange(x.date)),
      go: addDays(start, -1), back: end,
    });
  }
  return out;
}
