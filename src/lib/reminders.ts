/**
 * Reminder links for "current booking opens" — no accounts or APIs needed:
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
  const title = `Current booking opens · ${d.num} ${d.name}`;
  const lines = [
    `Current booking for ${d.num} ${d.name} (${sourceName} → ${destName}) opens at ${clockAt(d.opens)}, ${dayLabel(istDay(d.opens))} (IST).`,
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
    "PRODID:-//TN Current Booking//EN",
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
const d2 = (r: ReminderInput) => `Current booking for ${r.d.num}`;

export const icsFileName = (r: ReminderInput) => `current-booking-${r.d.num}-${istDay(r.d.opens)}.ics`;
