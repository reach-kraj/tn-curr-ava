"use client";

import { useEffect, useRef, useState } from "react";
import type { Dataset } from "@/lib/types";
import type { SyncMessage, SyncRequest } from "@/workers/sync.worker";
import { MON } from "@/lib/booking";

export const DATASET_KEY = "tn.dataset";

/** "2026-08-30-02-22-43" → "30 Aug 2026" */
export function feedDate(v: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? `${Number(m[3])} ${MON[Number(m[2]) - 1]} ${m[1]}` : v || "unknown";
}

type State =
  | { kind: "idle" }
  | { kind: "busy"; step: string; pct?: number }
  | { kind: "ok"; text: string }
  | { kind: "err"; text: string };

export default function SyncButton({ data, onData, className = "" }: { data: Dataset; onData: (d: Dataset) => void; className?: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const worker = useRef<Worker | null>(null);
  useEffect(() => () => worker.current?.terminate(), []);

  const sync = () => {
    if (state.kind === "busy") return;
    worker.current?.terminate();
    const w = new Worker(new URL("../workers/sync.worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    setState({ kind: "busy", step: "Checking for a newer timetable" });
    w.onmessage = (e: MessageEvent<SyncMessage>) => {
      const m = e.data;
      if (m.type === "progress") setState({ kind: "busy", step: m.step, pct: m.pct });
      else if (m.type === "same") { setState({ kind: "ok", text: `Up to date (${feedDate(m.version)})` }); w.terminate(); }
      else if (m.type === "error") { setState({ kind: "err", text: m.message }); w.terminate(); }
      else if (m.type === "done") {
        const { e, nb, ...slim } = m.data; void e; void nb;
        try { localStorage.setItem(DATASET_KEY, JSON.stringify(slim)); } catch { /* storage full or blocked: still use it for this visit */ }
        onData(m.data);
        setState({ kind: "ok", text: `Updated to ${feedDate(m.data.feed)} · ${m.data.t.length} trains` });
        w.terminate();
      }
    };
    w.onerror = () => { setState({ kind: "err", text: "Sync stopped unexpectedly. Try again." }); w.terminate(); };
    const req: SyncRequest = { current: data.feed, geo: { tnRings: data.b, outline: data.b } };
    w.postMessage(req);
  };

  useEffect(() => {
    if (state.kind !== "ok") return;
    const id = setTimeout(() => setState({ kind: "idle" }), 6000);
    return () => clearTimeout(id);
  }, [state]);

  const busy = state.kind === "busy";
  return (
    <div className={`sync ${className}`}>
      <span className="sync-label" aria-live="polite">
        {state.kind === "idle" && <span className="sync-idle">Timetable · <b>{feedDate(data.feed)}</b></span>}
        {state.kind === "busy" && <>{state.step}{state.pct != null ? ` · ${state.pct}%` : "…"}</>}
        {state.kind === "ok" && <span className="sync-ok">{state.text}</span>}
        {state.kind === "err" && <span className="sync-err">{state.text}</span>}
      </span>
      <button type="button" className="sync-btn" onClick={sync} disabled={busy} aria-label={`Sync with the latest train timetable (current: ${feedDate(data.feed)})`} title={`Timetable: ${feedDate(data.feed)}. Check for a newer one`}>
        <svg className={busy ? "spin" : ""} viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 0 1-15.5 6.2M3 12A9 9 0 0 1 18.5 5.8" /><path d="M21 4v5h-5M3 20v-5h5" />
        </svg>
        {busy ? "Syncing" : "Sync"}
      </button>
    </div>
  );
}
