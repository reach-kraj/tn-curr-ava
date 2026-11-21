/**
 * Reminder links for "current availability opens" — no accounts or APIs needed:
 *  - Google Calendar: pre-filled event via the public TEMPLATE URL
 *  - .ics file: opens in the phone's calendar with two alarms (10 min before, and at opening)
 *  - plain text for the share sheet
 */
import { clock, clockAt, dayLabel, istDay, shortName, type Departure } from "./booking";

export interface ReminderInput {
  d: Departure;
  boardAt: string; // station name where the user boards
  sourceName: string;
  destName: string;
  url: string; // link back to this station on the site
}

const IRCTC = "https://www.irctc.co.in/nget/train-search";
const EVENT_MIN = 15;

/** UTC "YYYYMMDDTHHMMSSZ" */
export function icsStamp(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function reminderText({ d, boardAt, sourceName, destName, url }: ReminderInput) {
  const title = `Current availability opens · ${d.num} ${d.name}`;
  const lines = [
    `Current availability for ${d.num} ${d.name} (${sourceName} → ${destName}) opens at ${clockAt(d.opens)}, ${dayLabel(istDay(d.opens))} (IST).`,
    `Boarding at ${shortName(boardAt)}: departs ${clock(d.dep)}, ${dayLabel(istDay(d.hereDep))}.`,
    `Train leaves ${shortName(sourceName)} at ${clockAt(d.srcDep)}.`,
    `Book: ${IRCTC}`,
    `Details: ${url}`,
  ];
  return { title, body: lines.join("\n") };
}

export function googleCalendarUrl(r: ReminderInput): string {
  const { title, body } = reminderText(r);
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${icsStamp(r.d.opens)}/${icsStamp(r.d.opens + EVENT_MIN * 60_000)}`,
    details: body,
    location: shortName(r.boardAt) + " railway station",
    ctz: "Asia/Kolkata",
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

/** RFC 5545 text escaping + 75-octet line folding. */
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
function fold(line: string): string {
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (new TextEncoder().encode(cur + ch).length > 74) { out.push(cur); cur = " " + ch; } else cur += ch;
  }
  out.push(cur);
  return out.join("\r\n");
}

export function icsFile(r: ReminderInput, now = Date.now()): string {
  const { title, body } = reminderText(r);
  const uid = `${r.d.num}-${icsStamp(r.d.opens)}@tn-curr-ava`;
  const alarm = (trigger: string, what: string) => ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(what)}`, `TRIGGER:${trigger}`, "END:VALARM"];
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TN Train Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${icsStamp(now)}`,
    `DTSTART:${icsStamp(r.d.opens)}`,
    `DTEND:${icsStamp(r.d.opens + EVENT_MIN * 60_000)}`,
    `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc(body)}`,
    `LOCATION:${esc(shortName(r.boardAt) + " railway station")}`,
    `URL:${IRCTC}`,
    ...alarm("-PT10M", `${d2(r)} opens in 10 minutes`),
    ...alarm("PT0M", `${d2(r)} is open now`),
    "END:VEVENT",
    "END:VCALENDAR",
  ].map(fold).join("\r\n") + "\r\n";
}
const d2 = (r: ReminderInput) => `Current availability for ${r.d.num}`;

export const icsFileName = (r: ReminderInput) => `current-availability-${r.d.num}-${istDay(r.d.opens)}.ics`;

/* ---------- generic events (used by the advance-booking planner) ---------- */
export interface EventInput { uid: string; title: string; body: string; start: number; location?: string; alarm: string }

export function eventGoogleUrl(e: EventInput): string {
  const p = new URLSearchParams({
    action: "TEMPLATE", text: e.title,
    dates: `${icsStamp(e.start)}/${icsStamp(e.start + EVENT_MIN * 60_000)}`,
    details: e.body, ctz: "Asia/Kolkata",
  });
  if (e.location) p.set("location", e.location);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export function eventIcs(e: EventInput, now = Date.now()): string {
  const alarm = (trigger: string, what: string) => ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(what)}`, `TRIGGER:${trigger}`, "END:VALARM"];
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TN Train Booking//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid}@tn-curr-ava`,
    `DTSTAMP:${icsStamp(now)}`,
    `DTSTART:${icsStamp(e.start)}`,
    `DTEND:${icsStamp(e.start + EVENT_MIN * 60_000)}`,
    `SUMMARY:${esc(e.title)}`,
    `DESCRIPTION:${esc(e.body)}`,
    ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
    `URL:${IRCTC}`,
    ...alarm("-PT10M", `${e.alarm} in 10 minutes`),
    ...alarm("PT0M", `${e.alarm} now`),
    "END:VEVENT", "END:VCALENDAR",
  ].map(fold).join("\r\n") + "\r\n";
}

/** Save a calendar file (opens in the phone's calendar app). */
export function downloadIcs(ics: string, name: string) {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
