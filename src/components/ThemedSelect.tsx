"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export interface SelectOption {
  value: string;
  /** main text, e.g. "16103 TBM RMM EXP" */
  label: string;
  /** small leading text, e.g. a departure time or station code */
  meta?: string;
  /** second line, e.g. "Tambaram → Rameswaram" */
  sub?: string;
}

/**
 * A themed replacement for <select>: a button that opens a filterable listbox.
 * ARIA: button (aria-haspopup="listbox") → combobox input with aria-activedescendant → listbox/options.
 * Keys: ↑ ↓ Home End move, Enter picks, Escape closes, typing filters.
 */
export default function ThemedSelect({ id, value, options, onChange, placeholder = "Choose…", filterPlaceholder = "Type to filter", labelledBy }: {
  id: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  filterPlaceholder?: string;
  labelledBy?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const uid = useId();
  const chosen = options.find((o) => o.value === value);

  const shown = useMemo(() => {
    const v = q.trim().toLowerCase();
    if (!v) return options;
    return options.filter((o) => `${o.meta ?? ""} ${o.label} ${o.sub ?? ""}`.toLowerCase().includes(v));
  }, [q, options]);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    addEventListener("pointerdown", onDown);
    return () => removeEventListener("pointerdown", onDown);
  }, [open]);

  // keep the highlighted option in view
  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>(`[data-i="${hi}"]`)?.scrollIntoView({ block: "nearest" });
  }, [hi, open]);

  const openList = () => {
    setQ("");
    setHi(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
    requestAnimationFrame(() => (input.current ?? list.current)?.focus());
  };
  const pick = (o: SelectOption) => {
    onChange(o.value);
    setOpen(false);
    requestAnimationFrame(() => document.getElementById(id)?.focus());
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, shown.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Home") { e.preventDefault(); setHi(0); }
    else if (e.key === "End") { e.preventDefault(); setHi(shown.length - 1); }
    else if (e.key === "Enter") { e.preventDefault(); if (shown[hi]) pick(shown[hi]); }
    else if (e.key === "Escape" || e.key === "Tab") { setOpen(false); if (e.key === "Escape") document.getElementById(id)?.focus(); }
  };

  return (
    <div className={`tsel${open ? " open" : ""}`} ref={root}>
      <button
        type="button" id={id} className="tsel-btn"
        aria-haspopup="listbox" aria-expanded={open} aria-labelledby={labelledBy ? `${labelledBy} ${id}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); openList(); } }}
      >
        {chosen?.meta && <span className="tsel-meta">{chosen.meta}</span>}
        <span className="tsel-val">{chosen ? chosen.label : placeholder}</span>
        <svg className="chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>

      {open && (
        <div className="tsel-pop">
          {options.length > 8 && (
            <div className="tsel-search">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input
                ref={input} type="text" role="combobox" aria-expanded="true" aria-controls={`${uid}-list`} aria-autocomplete="list"
                aria-activedescendant={shown[hi] ? `${uid}-o${hi}` : undefined} aria-label={filterPlaceholder}
                placeholder={filterPlaceholder} value={q} autoComplete="off"
                onChange={(e) => { setQ(e.target.value); setHi(0); }} onKeyDown={onKey}
              />
            </div>
          )}
          <ul className="tsel-list" id={`${uid}-list`} role="listbox" ref={list} tabIndex={options.length > 8 ? -1 : 0}
            aria-activedescendant={options.length > 8 ? undefined : shown[hi] ? `${uid}-o${hi}` : undefined}
            onKeyDown={options.length > 8 ? undefined : onKey}>
            {shown.length === 0 && <li className="tsel-empty" role="presentation">Nothing matches “{q.trim()}”.</li>}
            {shown.map((o, i) => (
              <li key={o.value || "__any"} id={`${uid}-o${i}`} data-i={i} role="option" aria-selected={o.value === value}
                className={`tsel-opt${i === hi ? " hi" : ""}${o.value === value ? " sel" : ""}`}
                onPointerEnter={() => setHi(i)} onClick={() => pick(o)}>
                {o.meta && <span className="tsel-meta">{o.meta}</span>}
                <span className="tsel-text">
                  <span className="tsel-label">{o.label}</span>
                  {o.sub && <span className="tsel-sub">{o.sub}</span>}
                </span>
                {o.value === value && (
                  <svg className="tsel-tick" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
