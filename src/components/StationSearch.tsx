"use client";

import { useId, useMemo, useState } from "react";
import type { Station } from "@/lib/types";

export default function StationSearch({ stations, onPick }: { stations: Station[]; onPick: (s: Station) => void }) {
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const listId = useId();

  const hits = useMemo(() => {
    const v = q.trim().toLowerCase();
    if (!v) return [];
    return stations
      .filter((s) => s.name.toLowerCase().includes(v) || s.code.toLowerCase().startsWith(v))
      .sort((a, b) => Number(b.code.toLowerCase() === v) - Number(a.code.toLowerCase() === v) || b.n - a.n)
      .slice(0, 8);
  }, [q, stations]);

  const pick = (s: Station) => { setQ(""); setHi(0); onPick(s); };

  return (
    <div className="search">
      <svg className="search-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
      </svg>
      <input
        id="station-search"
        type="search"
        value={q}
        placeholder="Search a station: Chengalpattu, MDU, Tambaram…"
        autoComplete="off"
        role="combobox"
        aria-expanded={hits.length > 0}
        aria-controls={listId}
        aria-label="Search station"
        onChange={(e) => { setQ(e.target.value); setHi(0); }}
        onKeyDown={(e) => {
          if (!hits.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, hits.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          else if (e.key === "Enter") pick(hits[hi]);
          else if (e.key === "Escape") setQ("");
        }}
      />
      {hits.length > 0 && (
        <div className="sugg" id={listId} role="listbox">
          {hits.map((s, i) => (
            <button key={s.code} type="button" role="option" aria-selected={i === hi} className={i === hi ? "on" : ""} onClick={() => pick(s)} onMouseEnter={() => setHi(i)}>
              <span>{s.name}</span>
              <code>{s.code} · {s.n} trains</code>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
