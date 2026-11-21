import { DOW, MON, istInstant, istParts } from "@/lib/booking";

/** A small calendar-page tile for a date. */
export default function DateTile({ day, big = false }: { day: string; big?: boolean }) {
  const p = istParts(istInstant(day, 0));
  return (
    <span className={`dtile${big ? " big" : ""}`} aria-hidden="true">
      <span className="dtile-m">{MON[p.m - 1]}</span>
      <span className="dtile-d">{p.d}</span>
      <span className="dtile-w">{DOW[p.dow]}</span>
    </span>
  );
}
