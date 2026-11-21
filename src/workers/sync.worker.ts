/// <reference lib="webworker" />
/**
 * Timetable sync, off the main thread: download the latest GTFS feed, check its version,
 * and rebuild the Tamil Nadu dataset if it is newer than the one the page has.
 */
import { GTFS_URL, buildDataset, feedVersionOf, type Geography } from "@/lib/buildDataset";
import type { Dataset } from "@/lib/types";

export type SyncRequest = { current: string; geo: Geography; force?: boolean };
export type SyncMessage =
  | { type: "progress"; step: string; pct?: number }
  | { type: "same"; version: string }
  | { type: "done"; data: Dataset }
  | { type: "error"; message: string };

const post = (m: SyncMessage) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m);

self.onmessage = async (e: MessageEvent<SyncRequest>) => {
  const { current, geo, force } = e.data;
  try {
    post({ type: "progress", step: "Downloading latest timetable", pct: 0 });
    const res = await fetch(`${GTFS_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok || !res.body) throw new Error(`Download failed (HTTP ${res.status})`);
    const total = Number(res.headers.get("content-length")) || 0;
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      got += value.length;
      if (total) post({ type: "progress", step: "Downloading latest timetable", pct: Math.round((got / total) * 100) });
    }
    const zip = new Uint8Array(got);
    let o = 0;
    for (const c of chunks) { zip.set(c, o); o += c.length; }

    const version = feedVersionOf(zip);
    if (!version) throw new Error("The download is not a timetable feed");
    if (!force && version <= current) { post({ type: "same", version }); return; }

    const data = buildDataset(zip, geo, (step) => post({ type: "progress", step }));
    if (data.t.length < 100 || data.s.length < 100) throw new Error("The new timetable looks incomplete, so it was not used");
    post({ type: "done", data });
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
