"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WorldMap, { type MapPadding } from "./WorldMap";
import StationSearch from "./StationSearch";
import TrainCard from "./TrainCard";
import FlapTime from "./FlapTime";
import type { Dataset, Station, TrainStop } from "@/lib/types";
import {
  RULES, addDays, clockAt, dayLabel, departures, shortName, status, toStations, todayIst, type Rule,
} from "@/lib/booking";

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
};

export default function App() {
  const [data, setData] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data/tn.json")
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <div className="loading">Couldn’t load the timetable ({error}). Refresh to try again.</div>;
  if (!data) return <div className="loading"><span className="loading-dot" />Loading Tamil Nadu timetable…</div>;
  return <Explorer data={data} />;
}

type Sheet = "peek" | "half" | "full";
const PEEK_PX = 196;
const sheetPx = (s: Sheet, vh: number) => (s === "peek" ? PEEK_PX : s === "half" ? Math.round(vh * 0.56) : Math.round(vh * 0.92));

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = matchMedia("(max-width: 900px)");
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return mobile;
}

function useViewportHeight() {
  const [vh, setVh] = useState(800);
  useEffect(() => {
    const on = () => setVh(window.innerHeight);
    on();
    addEventListener("resize", on);
    return () => removeEventListener("resize", on);
  }, []);
  return vh;
}

function Explorer({ data }: { data: Dataset }) {
  const stations = useMemo(() => toStations(data), [data]);
  const byCode = useMemo(() => new Map(stations.map((s) => [s.code, s])), [stations]);
  const stationName = useCallback((c: string) => byCode.get(c)?.name ?? data.o[c] ?? c, [byCode, data]);

  /** each train's Tamil Nadu stops in running order */
  const trainStops = useMemo(() => {
    const out: TrainStop[][] = data.t.map(() => []);
    for (const [code, list] of Object.entries(data.st)) for (const [ti, arr, dep] of list) out[ti].push({ station: byCode.get(code)!, arr, dep });
    const key = (x: TrainStop) => (x.arr < 0 ? -1 : x.dep >= 0 ? x.dep : x.arr);
    out.forEach((l) => l.sort((a, b) => key(a) - key(b)));
    return out;
  }, [data, byCode]);

  const mobile = useIsMobile();
  const vh = useViewportHeight();
  const [selCode, setSelCode] = useState("CGL");
  const [travelDay, setTravelDay] = useState(() => todayIst());
  const [rule, setRule] = useState<Rule>("10");
  const [query, setQuery] = useState("");
  const [reservedOnly, setReservedOnly] = useState(true);
  const [runningOnly, setRunningOnly] = useState(true);
  const [openTi, setOpenTi] = useState<number | null>(null);
  const [hoverTi, setHoverTi] = useState<number | null>(null);
  const [flyKey, setFlyKey] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [panelOpen, setPanelOpen] = useState(true);
  const [sheet, setSheet] = useState<Sheet>("peek");
  const [dragPx, setDragPx] = useState<number | null>(null);

  // restore station from the link (#CGL) or last visit, and rule preference
  useEffect(() => {
    const fromHash = decodeURIComponent(location.hash.slice(1)).toUpperCase();
    const saved = store.get("tn.station");
    const code = byCode.has(fromHash) ? fromHash : saved && byCode.has(saved) ? saved : null;
    const r = store.get("tn.rule");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from URL/localStorage after hydration
    if (code) setSelCode(code);
    if (byCode.has(fromHash)) setFlyKey((k) => k + 1);
    if (r && r in RULES) setRule(r as Rule);
    const onHash = () => { const c = decodeURIComponent(location.hash.slice(1)).toUpperCase(); if (byCode.has(c)) { setSelCode(c); setFlyKey((k) => k + 1); } };
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, [byCode]);

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(id); }, []);

  const sel = byCode.get(selCode) ?? stations[0];
  const selectStation = useCallback((s: Station, fly = true) => {
    setSelCode(s.code); setOpenTi(null);
    store.set("tn.station", s.code);
    history.replaceState(null, "", `#${s.code}`);
    setPanelOpen(true);
    setSheet((x) => (x === "peek" ? "half" : x));
    if (fly) setFlyKey((k) => k + 1);
  }, []);

  const rows = useMemo(
    () => departures(data, sel.code, travelDay, rule, { reservedOnly, runningOnly, query }),
    [data, sel.code, travelDay, rule, reservedOnly, runningOnly, query],
  );
  const openNow = rows.filter((r) => status(r, now).kind === "open").length;
  const next = rows.filter((r) => r.opens > now).sort((a, b) => a.opens - b.opens)[0];
  const routeTi = hoverTi ?? openTi;
  const route = useMemo(() => (routeTi == null ? null : trainStops[routeTi].map((x) => x.station)), [routeTi, trainStops]);
  const [fitKey, setFitKey] = useState(0);
  const openRef = useRef<number | null>(null);
  const toggle = useCallback((ti: number) => {
    const opening = openRef.current !== ti;
    openRef.current = opening ? ti : null;
    setOpenTi(openRef.current);
    setHoverTi(null);
    if (opening) setFitKey((k) => k + 1);
  }, []);
  const hover = useCallback((ti: number | null) => { if (!mobile) setHoverTi(ti); }, [mobile]);

  // on today's board, scroll the list to the next train still to depart
  const listRef = useRef<HTMLDivElement>(null);
  const firstUpcoming = travelDay === todayIst(now) ? rows.find((r) => r.hereDep > now)?.ti : undefined;
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    // desktop scrolls the list; phones scroll the whole sheet
    const scroller = mobile ? list.parentElement! : list;
    const card = firstUpcoming == null ? null : list.querySelector<HTMLElement>(`[data-ti="${firstUpcoming}"]`);
    const top = card ? scroller.scrollTop + card.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 40 : 0;
    scroller.scrollTo({ top: Math.max(0, top) });
    // re-run when the station, day, filters or sheet size change, not on every clock tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel.code, travelDay, rule, reservedOnly, runningOnly, query, mobile, sheet === "full"]);

  /* ---------- panel / bottom sheet ---------- */
  const sheetH = dragPx ?? sheetPx(sheet, vh);
  const padding: MapPadding = useMemo(() => (mobile
    ? { top: 72, right: 0, bottom: sheet === "full" ? sheetPx("half", vh) : sheetPx(sheet, vh), left: 0 }
    : { top: 0, right: panelOpen ? 520 : 0, bottom: 0, left: 0 }), [mobile, sheet, vh, panelOpen]);

  const drag = useRef<{ y: number; h: number; moved: boolean } | null>(null);
  const onGripDown = (e: React.PointerEvent) => {
    if (!mobile) return;
    drag.current = { y: e.clientY, h: sheetPx(sheet, vh), moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onGripMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dy = d.y - e.clientY;
    if (Math.abs(dy) > 4) d.moved = true;
    if (d.moved) setDragPx(Math.max(PEEK_PX - 40, Math.min(vh * 0.95, d.h + dy)));
  };
  const onGripUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) { setSheet((s) => (s === "peek" ? "half" : s === "half" ? "full" : "peek")); return; }
    const h = d.h + (d.y - e.clientY);
    const snaps: Sheet[] = ["peek", "half", "full"];
    setSheet(snaps.reduce((best, s) => (Math.abs(sheetPx(s, vh) - h) < Math.abs(sheetPx(best, vh) - h) ? s : best), "peek"));
    setDragPx(null);
  };

  const panelState = mobile ? `sheet-${sheet}` : panelOpen ? "open" : "closed";

  return (
    <div className={`app${mobile ? " is-mobile" : ""}`}>
      <WorldMap
        data={data} stations={stations} selected={sel} route={route}
        fitRouteKey={fitKey} flyKey={flyKey} padding={padding}
        onSelect={(s) => selectStation(s, true)}
      />

      <header className="brand">
        <span className="eyebrow-tag"><i />Tamil Nadu · Current booking</span>
        <h1>Pick a station. See when current booking opens for every train.</h1>
        <StationSearch stations={stations} onPick={(s) => selectStation(s, true)} />
      </header>

      {!mobile && !panelOpen && (
        <button type="button" className="panel-tab" onClick={() => setPanelOpen(true)} aria-label="Show train list">
          <span className="panel-tab-code">{sel.code}</span>
          <span>{rows.length} trains</span>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m15 6-6 6 6 6" /></svg>
        </button>
      )}

      <aside
        className={`panel ${panelState}${dragPx != null ? " dragging" : ""}`}
        style={mobile ? { height: sheetH } : undefined}
        aria-label="Trains at selected station"
        aria-hidden={!mobile && !panelOpen}
      >
        {mobile ? (
          <div className="grip" onPointerDown={onGripDown} onPointerMove={onGripMove} onPointerUp={onGripUp} onPointerCancel={onGripUp}
            role="button" tabIndex={0} aria-label={`Train list: ${sheet === "full" ? "collapse" : "expand"}`}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSheet((s) => (s === "full" ? "peek" : s === "peek" ? "half" : "full")); } }}>
            <span />
          </div>
        ) : (
          <button type="button" className="panel-close" onClick={() => setPanelOpen(false)} aria-label="Hide train list">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m9 6 6 6-6 6" /></svg>
          </button>
        )}

        <div className="panel-scroll">
          <div className="head">
            <div className="nameboard" aria-live="polite" onClick={() => mobile && setSheet((s) => (s === "peek" ? "half" : s))}>
              <div className="nameboard-top"><span>{sel.code}</span><span>{sel.n} trains stop</span></div>
              <h2>{shortName(sel.name)}</h2>
            </div>

            <div className="stats">
              <div className="stat"><b>{rows.length}</b><span>departing</span></div>
              <div className="stat"><b className="ok">{openNow}</b><span>open now</span></div>
              <div className="stat stat-next">
                {next ? <FlapTime value={clockAt(next.opens)} /> : <b>—</b>}
                <span>{next ? `next opens · ${next.num}` : "nothing left to open"}</span>
              </div>
            </div>

            <div className="ctl">
              <div className="datebox">
                <button type="button" aria-label="Previous day" onClick={() => setTravelDay((d) => addDays(d, -1))}>‹</button>
                <input id="travel-day" type="date" aria-label="Travel date at this station" value={travelDay} onChange={(e) => e.target.value && setTravelDay(e.target.value)} />
                <button type="button" aria-label="Next day" onClick={() => setTravelDay((d) => addDays(d, 1))}>›</button>
              </div>
              <button type="button" className="btn" onClick={() => setTravelDay(todayIst())}>Today</button>
              <div className="seg" role="group" aria-label="Booking rule">
                {(["10", "8", "4"] as Rule[]).map((r) => (
                  <button key={r} type="button" aria-pressed={rule === r} onClick={() => { setRule(r); store.set("tn.rule", r); }}>{RULES[r].label}</button>
                ))}
              </div>
            </div>
            <p className="rulenote">{RULES[rule].note}</p>

            <div className="filters">
              <input id="train-filter" type="search" placeholder="Filter by train number or name" aria-label="Filter trains" value={query} onChange={(e) => setQuery(e.target.value)} />
              <label className="pill"><input type="checkbox" checked={reservedOnly} onChange={(e) => setReservedOnly(e.target.checked)} />Reserved only</label>
              <label className="pill"><input type="checkbox" checked={runningOnly} onChange={(e) => setRunningOnly(e.target.checked)} />Runs this date</label>
            </div>
          </div>

          <div className="list" ref={listRef}>
            <p className="count">{rows.length} train{rows.length === 1 ? "" : "s"} leaving {shortName(sel.name)} on {dayLabel(travelDay)} · times in IST{firstUpcoming != null && rows[0]?.ti !== firstUpcoming ? " · scrolled to the next departure" : ""}</p>
            {rows.length === 0 ? (
              <div className="empty">No trains match these filters.<br />Turn off “Reserved only”, or try another date.</div>
            ) : (
              rows.map((d) => (
                <TrainCard key={d.ti} d={d} here={sel} travelDay={travelDay} now={now} open={openTi === d.ti}
                  stops={trainStops[d.ti]} stationName={stationName} onToggle={toggle} onHover={hover} />
              ))
            )}
            <footer className="foot">
              Scheduled times from the free, unofficial <a href="https://github.com/Neo2308/indianrailways-gtfs" target="_blank" rel="noreferrer">Indian Railways GTFS feed</a> (version {data.feed}). Not live running status. Confirm on IRCTC before you travel. EMU, MEMU, DEMU and passenger trains are unreserved and hidden by “Reserved only”. Map © OpenStreetMap contributors, OpenFreeMap; terrain © Mapzen.
            </footer>
          </div>
        </div>
      </aside>
    </div>
  );
}
