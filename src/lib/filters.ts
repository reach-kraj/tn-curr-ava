/** Extra board filters, sorting and section grouping (pure, UI-independent). */
import { DAY_MIN, status, type Departure } from "./booking";
import type { TrainStop } from "./types";

export type Kind = "Vande Bharat" | "Shatabdi" | "Superfast" | "Mail" | "Special" | "Express";
export const KINDS: Kind[] = ["Vande Bharat", "Shatabdi", "Superfast", "Mail", "Express", "Special"];

/** Rough train category from the timetable name (e.g. "VAIGAI SF EXP" → Superfast). */
export function trainKind(name: string): Kind {
  const n = name.toUpperCase();
  if (/VANDE/.test(n)) return "Vande Bharat";
  if (/SHATABDI|SHTBDI/.test(n)) return "Shatabdi";
  if (/\bSPL\b|SPECIAL/.test(n)) return "Special";
  if (/\bSF\b|SUPERFAST|S\/F/.test(n)) return "Superfast";
  if (/\bMAIL\b/.test(n)) return "Mail";
  return "Express";
}

export type Daypart = "night-early" | "morning" | "afternoon" | "evening" | "night";
export const DAYPARTS: { id: Daypart; label: string; range: string; from: number; to: number }[] = [
  { id: "night-early", label: "Early morning", range: "12 AM – 6 AM", from: 0, to: 360 },
  { id: "morning", label: "Morning", range: "6 AM – 12 PM", from: 360, to: 720 },
  { id: "afternoon", label: "Afternoon", range: "12 PM – 5 PM", from: 720, to: 1020 },
  { id: "evening", label: "Evening", range: "5 PM – 9 PM", from: 1020, to: 1260 },
  { id: "night", label: "Night", range: "9 PM – 12 AM", from: 1260, to: 1440 },
];
export function daypart(depMin: number): Daypart {
  const m = ((depMin % DAY_MIN) + DAY_MIN) % DAY_MIN;
  return DAYPARTS.find((p) => m >= p.from && m < p.to)!.id;
}

export type StatusFilter = "all" | "upcoming" | "soon" | "open";
export type SortBy = "dep" | "opens";

export interface BoardFilters {
  status: StatusFilter;
  dayparts: Daypart[];
  kinds: Kind[];
  to: string; // station code, "" for any
}
export const NO_FILTERS: BoardFilters = { status: "all", dayparts: [], kinds: [], to: "" };
export const activeCount = (f: BoardFilters) =>
  (f.status !== "all" ? 1 : 0) + (f.dayparts.length ? 1 : 0) + (f.kinds.length ? 1 : 0) + (f.to ? 1 : 0);

/** Station codes reachable after boarding: later Tamil Nadu stops plus the final destination. */
export function onwardCodes(d: Departure, stops: TrainStop[]): string[] {
  const after = stops.filter((s) => (s.arr >= 0 ? s.arr : s.dep) > d.dep).map((s) => s.station.code);
  return [...new Set([...after, d.dest])];
}

export function applyBoardFilters(rows: Departure[], f: BoardFilters, now: number, stopsOf: (ti: number) => TrainStop[]) {
  return rows.filter((d) => {
    if (f.status !== "all") {
      const k = status(d, now).kind;
      if (f.status === "upcoming" && k === "gone") return false;
      if (f.status === "soon" && k !== "soon") return false;
      if (f.status === "open" && k !== "open") return false;
    }
    if (f.dayparts.length && !f.dayparts.includes(daypart(d.dep))) return false;
    if (f.kinds.length && !f.kinds.includes(trainKind(d.name))) return false;
    if (f.to && !onwardCodes(d, stopsOf(d.ti)).includes(f.to)) return false;
    return true;
  });
}

export interface Section { id: string; title: string; sub: string; rows: Departure[] }

/** Split the board into labelled sections: by time of day, or by booking status. */
export function sections(rows: Departure[], sort: SortBy, now: number): Section[] {
  if (sort === "opens") {
    const groups: Record<string, Departure[]> = { soon: [], open: [], gone: [] };
    for (const d of rows) groups[status(d, now).kind].push(d);
    groups.soon.sort((a, b) => a.opens - b.opens);
    groups.open.sort((a, b) => a.hereDep - b.hereDep);
    groups.gone.sort((a, b) => b.hereDep - a.hereDep);
    return [
      { id: "soon", title: "Opening soon", sub: "current availability, soonest first", rows: groups.soon },
      { id: "open", title: "Open now", sub: "book before the train departs", rows: groups.open },
      { id: "gone", title: "Departed", sub: "most recent first", rows: groups.gone },
    ].filter((s) => s.rows.length);
  }
  return DAYPARTS.map((p) => ({ id: p.id, title: p.label, sub: p.range, rows: rows.filter((d) => daypart(d.dep) === p.id) }))
    .filter((s) => s.rows.length);
}
