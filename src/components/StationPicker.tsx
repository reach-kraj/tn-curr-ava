"use client";

import { useId, useMemo, useState } from "react";

export interface PickOption { code: string; name: string; sub?: string }

/**
 * A compact station combobox: shows the chosen station, type to search, arrows + Enter to pick.
 * Used for the From / To journey fields.
 */
export default function StationPicker({ label, value, options, placeholder, onChange, allowClear = false }: {
  label: string;
  value: PickOption | null;
  options: PickOption[];
  placeholder: string;
  onChange: (code: string | null) => void;
  allowClear?: boolean;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const id = useId();

  const hits = useMemo(() => {
    const v = q.trim().toLowerCase();
    if (!v) return [];
    return options
      .filter((o) => o.name.toLowerCase().includes(v) || o.code.toLowerCase().startsWith(v))
      .sort((a, b) => Number(b.code.toLowerCase() === v) - Number(a.code.toLowerCase() === v) || Number(b.name.toLowerCase().startsWith(v)) - Number(a.name.toLowerCase().startsWith(v)))
      .slice(0, 7);
  }, [q, options]);

  const pick = (o: PickOption) => { onChange(o.code); setQ(""); setOpen(false); setHi(0); };
  const showList = open && q.trim() !== "";

  return (
    <div className="picker">
      <label className="picker-k" htmlFor={`${id}-in`}>{label}</label>
      <div className="picker-box">
        <input
          id={`${id}-in`}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={`${id}-list`}
          aria-activedescendant={showList && hits.length ? `${id}-o${hi}` : undefined}
          autoComplete="off"
          value={open ? q : value ? `${value.name}` : ""}
          placeholder={value ? value.name : placeholder}
          onFocus={() => { setOpen(true); setQ(""); }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onChange={(e) => { setQ(e.target.value); setHi(0); }}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setQ(""); (e.target as HTMLInputElement).blur(); return; }
            if (!hits.length) return;
            if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, hits.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
            else if (e.key === "Enter") { e.preventDefault(); pick(hits[hi]); (e.target as HTMLInputElement).blur(); }
          }}
        />
        {value && !open && <code className="picker-code">{value.code}</code>}
        {allowClear && value && !open && (
          <button type="button" className="picker-clear" onClick={() => onChange(null)} aria-label={`Clear ${label}`}>×</button>
        )}
      </div>
      {showList && (
        <div className="sugg" id={`${id}-list`} role="listbox" aria-label={`${label} stations`}>
          {hits.length === 0 && <p className="sugg-empty">No station matches “{q.trim()}”.</p>}
          {hits.map((o, i) => (
            <button key={o.code} type="button" role="option" id={`${id}-o${i}`} aria-selected={i === hi} tabIndex={-1}
              className={i === hi ? "on" : ""} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o)} onMouseEnter={() => setHi(i)}>
              <span>{o.name}</span>
              <code>{o.code}{o.sub ? ` · ${o.sub}` : ""}</code>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
