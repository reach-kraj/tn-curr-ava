"use client";

import { useId, useMemo, useState } from "react";
import type { Station } from "@/lib/types";

export interface TrainHit { ti: number; num: string; name: string; from: string; to: string }

type Hit = { kind: "station"; s: Station } | { kind: "train"; t: TrainHit };

/**
 * One search box for stations (name or code) and trains (number or name).
 * Combobox pattern: arrow keys move through options, Enter picks, Escape clears.
 */
export default function StationSearch({ stations, trains, onPick, onPickTrain }: {
  stations: Station[];
  trains: TrainHit[];
  onPick: (s: Station) => void;
  onPickTrain: (ti: number) => void;
}) {
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const listId = useId();

  const hits = useMemo<Hit[]>(() => {
    const v = q.trim().toLowerCase();
    if (!v) return [];
    const isNum = /^\d+$/.test(v);
    const st = isNum ? [] : stations
      .filter((s) => s.name.toLowerCase().includes(v) || s.code.toLowerCase().startsWith(v))
      .sort((a, b) => Number(b.code.toLowerCase() === v) - Number(a.code.toLowerCase() === v) || b.n - a.n)
      .slice(0, 6)
      .map((s) => ({ kind: "station" as const, s }));
    const tr = (isNum
      ? trains.filter((t) => t.num.startsWith(v)).sort((a, b) => Number(b.num === v) - Number(a.num === v) || a.num.localeCompare(b.num))
      : v.length >= 3 ? trains.filter((t) => t.name.toLowerCase().includes(v)) : [])
      .slice(0, isNum ? 8 : 5)
      .map((t) => ({ kind: "train" as const, t }));
    return [...st, ...tr];
  }, [q, stations, trains]);

  const pick = (h: Hit) => {
    setQ(""); setHi(0);
    if (h.kind === "station") onPick(h.s); else onPickTrain(h.t.ti);
  };
  const optId = (i: number) => `${listId}-o${i}`;
  const firstTrain = hits.findIndex((h) => h.kind === "train");

  return (
    <div className="search">
      <svg className="search-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
      </svg>
      <input
        id="station-search"
        type="search"
        value={q}
        placeholder="Station or train number: Tambaram, MDU, 16103…"
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={hits.length > 0}
        aria-controls={listId}
        aria-activedescendant={hits.length ? optId(hi) : undefined}
        aria-label="Search a station or a train number"
        onChange={(e) => { setQ(e.target.value); setHi(0); }}
        onKeyDown={(e) => {
          if (e.key === "Escape") { setQ(""); return; }
          if (!hits.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, hits.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); pick(hits[hi]); }
        }}
      />
      {q.trim() !== "" && (
        <div className="sugg" id={listId} role="listbox" aria-label="Search results">
          {hits.length === 0 && <p className="sugg-empty">No station or train matches “{q.trim()}”.</p>}
          {hits.map((h, i) => (
            <div key={h.kind === "station" ? h.s.code : `t${h.t.ti}`} role="presentation">
              {i === 0 && h.kind === "station" && <p className="sugg-h" role="presentation">Stations</p>}
              {i === firstTrain && <p className="sugg-h" role="presentation">Trains</p>}
              <button type="button" role="option" id={optId(i)} aria-selected={i === hi} tabIndex={-1}
                className={i === hi ? "on" : ""} onClick={() => pick(h)} onMouseEnter={() => setHi(i)}>
                {h.kind === "station" ? (
                  <>
                    <span>{h.s.name}</span>
                    <code>{h.s.code} · {h.s.n} trains</code>
                  </>
                ) : (
                  <>
                    <span className="sugg-train">
                      <span><b className="sugg-num">{h.t.num}</b> {h.t.name}</span>
                      <small>{h.t.from} → {h.t.to}</small>
                    </span>
                    <code>train</code>
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
