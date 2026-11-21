"use client";

import { useEffect, useId, useRef, useState } from "react";
import { downloadIcs, eventGoogleUrl, eventIcs, type EventInput } from "@/lib/reminders";

export interface ReminderItem { key: string; label: string; event: EventInput; file: string }

/**
 * "Remind me" disclosure: a small menu with Google Calendar, phone alarm (.ics with two alerts)
 * and share for one or more upcoming moments (e.g. Go and Return booking dates).
 */
export default function ReminderMenu({ items, label = "Remind me", align = "left" }: { items: ReminderItem[]; label?: string; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); root.current?.querySelector<HTMLButtonElement>(".rm-btn")?.focus(); } };
    addEventListener("pointerdown", onDown);
    addEventListener("keydown", onKey);
    return () => { removeEventListener("pointerdown", onDown); removeEventListener("keydown", onKey); };
  }, [open]);

  if (!items.length) return null;

  const share = async (it: ReminderItem) => {
    const text = `${it.event.title}\n${it.event.body}`;
    try {
      if (navigator.share) { await navigator.share({ title: it.event.title, text: it.event.body }); return; }
      await navigator.clipboard.writeText(text);
      setNote("Copied to clipboard");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setNote("Couldn’t share");
    }
    setTimeout(() => setNote(null), 2000);
  };

  return (
    <div className={`rm${open ? " open" : ""}`} ref={root} onClick={(e) => e.stopPropagation()}>
      <button type="button" className="rm-btn" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
        {label}
      </button>
      {open && (
        <div className={`rm-pop ${align}`} id={id} role="group" aria-label="Reminder options">
          {items.map((it) => (
            <div key={it.key} className="rm-item">
              <span className="rm-label">{it.label}</span>
              <div className="rm-actions">
                <a href={eventGoogleUrl(it.event)} target="_blank" rel="noreferrer">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
                  Google Calendar<span className="sr-only"> (opens in a new tab)</span>
                </a>
                <button type="button" onClick={() => downloadIcs(eventIcs(it.event), it.file)}>
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M5 3 2 6M22 6l-3-3" /></svg>
                  Phone alarm
                </button>
                <button type="button" onClick={() => share(it)}>
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v14" /></svg>
                  Share
                </button>
              </div>
            </div>
          ))}
          <p className="rm-note" aria-live="polite">{note ?? "Phone alarm alerts 10 minutes before and at 8:00 AM / the opening time."}</p>
        </div>
      )}
    </div>
  );
}
