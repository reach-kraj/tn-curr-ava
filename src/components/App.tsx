"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import WorldMap, { type MapPadding } from "./WorldMap";
import StationSearch, { type TrainHit } from "./StationSearch";
import TrainCard from "./TrainCard";
import FlapTime from "./FlapTime";
import SyncButton, { DATASET_KEY } from "./SyncButton";
import AdvancePlanner from "./AdvancePlanner";
import StationPicker, { type PickOption } from "./StationPicker";
import type { Dataset, Station, TrainStop } from "@/lib/types";
import {
  RULES, addDays, clock, clockAt, dayLabel, departures, duration, shortName, status, toStations, todayIst, type Rule,
} from "@/lib/booking";
import {
  DAYPARTS, KINDS, NO_FILTERS, activeCount, applyBoardFilters, onwardCodes, sections, trainKind,
  type BoardFilters, type Daypart, type Kind, type SortBy, type StatusFilter,
} from "@/lib/filters";

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
};

export default function App() {
  const [data, setData] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data/tn.json")
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<Dataset>; })
      .then((bundled) => {
        // prefer a timetable synced on this device if it is newer than the one shipped with the site
        let synced: Dataset | null = null;
        try { const raw = localStorage.getItem(DATASET_KEY); synced = raw ? (JSON.parse(raw) as Dataset) : null; } catch { synced = null; }
        setData(synced && synced.feed > bundled.feed && Array.isArray(synced.t) ? synced : bundled);
      })
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <div className="loading">Couldn’t load the timetable ({error}). Refresh to try again.</div>;
  if (!data) return <div className="loading"><span className="loading-dot" />Loading Tamil Nadu timetable…</div>;
  return <Explorer data={data} onData={setData} />;
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

function Explorer({ data, onData }: { data: Dataset; onData: (d: Dataset) => void }) {
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

  const trainHits = useMemo<TrainHit[]>(
    () => data.t.map(([num, name, orig, dest], ti) => ({ ti, num, name, from: shortName(stationName(orig)), to: shortName(stationName(dest)) })),
    [data, stationName],
  );

  const fromOptions = useMemo<PickOption[]>(() => stations.map((s) => ({ code: s.code, name: s.name, sub: `${s.n} trains` })), [stations]);
  const toOptions = useMemo<PickOption[]>(
    () => [...fromOptions, ...Object.entries(data.o).map(([code, name]) => ({ code, name, sub: "outside TN" }))],
    [fromOptions, data],
  );

  const mobile = useIsMobile();
  const vh = useViewportHeight();
  const [selCode, setSelCode] = useState("TBM");
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
  const [bf, setBf] = useState<BoardFilters>(NO_FILTERS);
  const [sort, setSort] = useState<SortBy>("dep");
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [tab, setTab] = useState<"now" | "advance">("now");
  const [planTi, setPlanTi] = useState<number | null>(null);
  const [panelFull, setPanelFull] = useState(false);

  useEffect(() => {
    if (!panelFull) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPanelFull(false); };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [panelFull]);

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
    if (store.get("tn.options") === "1") setOptionsOpen(true);
    const onHash = () => { const c = decodeURIComponent(location.hash.slice(1)).toUpperCase(); if (byCode.has(c)) { setSelCode(c); setFlyKey((k) => k + 1); } };
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, [byCode]);

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(id); }, []);

  const sel = byCode.get(selCode) ?? stations[0];
  const selectStation = useCallback((s: Station, fly = true) => {
    setSelCode(s.code); setOpenTi(null);
    setBf((f) => (f.to === s.code ? { ...f, to: "" } : f));
    store.set("tn.station", s.code);
    history.replaceState(null, "", `#${s.code}`);
    setPanelOpen(true);
    setSheet((x) => (x === "peek" ? "half" : x));
    if (fly) setFlyKey((k) => k + 1);
  }, []);

  const allRows = useMemo(
    () => departures(data, sel.code, travelDay, rule, { reservedOnly, runningOnly, query }),
    [data, sel.code, travelDay, rule, reservedOnly, runningOnly, query],
  );
  const rows = useMemo(() => applyBoardFilters(allRows, bf, now, (ti) => trainStops[ti]), [allRows, bf, now, trainStops]);
  const secs = useMemo(() => sections(rows, sort, now), [rows, sort, now]);
  const openNow = allRows.filter((r) => status(r, now).kind === "open").length;
  const next = rows.filter((r) => r.opens > now).sort((a, b) => a.opens - b.opens)[0];
  const destinations = useMemo(() => {
    const count = new Map<string, number>();
    for (const d of allRows) for (const c of onwardCodes(d, trainStops[d.ti])) count.set(c, (count.get(c) ?? 0) + 1);
    return [...count].map(([code, n]) => ({ code, n, name: stationName(code) })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  }, [allRows, trainStops, stationName]);
  const kindsHere = useMemo(() => { const k = new Set(allRows.map((d) => trainKind(d.name))); return KINDS.filter((x) => k.has(x)); }, [allRows]);
  const nFilters = activeCount(bf);
  const nOpt = nFilters + (query.trim() ? 1 : 0);
  const toggleIn = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const routeTi = tab === "advance" ? planTi : hoverTi ?? openTi;
  const route = useMemo(() => (routeTi == null ? null : trainStops[routeTi].map((x) => x.station)), [routeTi, trainStops]);
  const showTrain = (ti: number) => {
    setOpenTi(ti);
    if (mobile) setSheet("full");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      listRef.current?.querySelector<HTMLElement>(`[data-ti="${ti}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" });
    }));
  };
  const pickTrain = (ti: number) => {
    // board where the user already is if the train stops there, else its first boardable Tamil Nadu stop
    const boardable = trainStops[ti].filter((x) => x.dep >= 0);
    const at = boardable.find((x) => x.station.code === sel.code) ?? boardable[0];
    if (!at) return;
    if (at.station.code !== sel.code) selectStation(at.station, true);
    // if the current filters would hide it (e.g. not running that day, unreserved), relax them so it shows
    const onBoard = applyBoardFilters(
      departures(data, at.station.code, travelDay, rule, { reservedOnly, runningOnly, query }),
      { ...bf, to: "" }, now, (t) => trainStops[t],
    ).some((r) => r.ti === ti);
    if (!onBoard) { setBf(NO_FILTERS); setQuery(""); setRunningOnly(false); setReservedOnly(false); }
    showTrain(ti);
  };

  const toggle = useCallback((ti: number) => {
    setOpenTi((o) => (o === ti ? null : ti));
    setHoverTi(null);
  }, []);
  const hover = useCallback((ti: number | null) => { if (!mobile) setHoverTi(ti); }, [mobile]);

  // on today's board, scroll the list to the next train still to depart
  const listRef = useRef<HTMLDivElement>(null);
  const isToday = travelDay === todayIst(now);
  const firstUpcoming = isToday && sort === "dep" ? rows.find((r) => r.hereDep > now)?.ti : undefined;
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    // desktop scrolls the list; phones scroll the whole sheet
    const scroller = mobile ? list.parentElement! : list;
    const target = firstUpcoming == null ? null : list.querySelector<HTMLElement>(".now-line") ?? list.querySelector<HTMLElement>(`[data-ti="${firstUpcoming}"]`);
    // leave room for the sticky section header above the "Now" line
    const top = target ? scroller.scrollTop + target.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 52 : 0;
    scroller.scrollTo({ top: Math.max(0, top) });
    // re-run when the station, day, filters or sheet size change, not on every clock tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel.code, travelDay, rule, reservedOnly, runningOnly, query, mobile, sheet === "full", bf, sort, panelFull]);

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

  const panelState = mobile ? `sheet-${sheet}` : !panelOpen ? "closed" : panelFull ? "open full" : "open";

  return (
    <div className={`app${mobile ? " is-mobile" : ""}`}>
      <WorldMap
        data={data} stations={stations} selected={sel} route={route}
        fitRouteKey={openTi == null ? 0 : openTi + 1} flyKey={flyKey} padding={padding}
        onSelect={(s) => selectStation(s, true)}
      />

      <header className="brand">
        <span className="eyebrow-tag"><i />Tamil Nadu · Current availability</span>
        <h1>Pick a station. See when current availability opens for every train.</h1>
        <StationSearch stations={stations} trains={trainHits} onPick={(s) => selectStation(s, true)} onPickTrain={pickTrain} />
        <div className="journey" role="group" aria-label="Journey">
          <StationPicker label="From" value={{ code: sel.code, name: shortName(sel.name) }} options={fromOptions} placeholder="Boarding station"
            onChange={(c) => { const s = c ? byCode.get(c) : null; if (s) selectStation(s, true); }} />
          <button type="button" className="swap" disabled={!bf.to || !byCode.has(bf.to)}
            onClick={() => { const back = byCode.get(bf.to)!; const from = sel.code; selectStation(back, true); setBf((f) => ({ ...f, to: from })); }}
            aria-label="Swap From and To" title={bf.to && !byCode.has(bf.to) ? "Swap works when To is in Tamil Nadu" : "Swap From and To"}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" /></svg>
          </button>
          <StationPicker label="To" allowClear value={bf.to ? { code: bf.to, name: shortName(stationName(bf.to)) } : null} options={toOptions.filter((o) => o.code !== sel.code)}
            placeholder="Any station" onChange={(c) => setBf((f) => ({ ...f, to: c ?? "" }))} />
        </div>
        <SyncButton data={data} onData={onData} className="sync-brand" />
      </header>

      {!mobile && !panelOpen && (
        <button type="button" className="panel-tab" onClick={() => setPanelOpen(true)} aria-label="Show train list">
          <span className="panel-tab-code">{sel.code}</span>
          <span>{allRows.length} trains</span>
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
          <div className="panel-bar">
            <span className="bar-title"><i aria-hidden="true" />Departures · {clockAt(now)}</span>
            <div className="bar-btns">
              <button type="button" className="bar-btn" onClick={() => setPanelFull((f) => !f)} aria-pressed={panelFull}
                title={panelFull ? "Back to map view (Esc)" : "Show the board full screen"}>
                {panelFull ? (
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
                )}
                <span>{panelFull ? "Exit full screen" : "Expand"}</span>
                {panelFull && <kbd>Esc</kbd>}
              </button>
              {!panelFull && (
                <button type="button" className="bar-btn bar-icon" onClick={() => setPanelOpen(false)} aria-label="Hide train list" title="Hide the board">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
                </button>
              )}
            </div>
          </div>
        )}

        <div className="panel-scroll">
          <div className="head">
            <div className="head-a">
            <div className="nameboard" aria-live="polite" onClick={() => mobile && setSheet((s) => (s === "peek" ? "half" : s))}>
              <div className="nameboard-top">
                <span>{sel.code}</span>
                <span className="nb-counts"><span>{allRows.length} departing</span><span>{openNow} open now</span></span>
              </div>
              <h2>{shortName(sel.name)}</h2>
            </div>

            <div className="tabs" role="tablist" aria-label="What to show">
              <button type="button" role="tab" id="tab-now" aria-selected={tab === "now"} aria-controls="panel-now" tabIndex={tab === "now" ? 0 : -1}
                onClick={() => setTab("now")} onKeyDown={(e) => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { setTab("advance"); document.getElementById("tab-advance")?.focus(); } }}>
                Current availability
              </button>
              <button type="button" role="tab" id="tab-advance" aria-selected={tab === "advance"} aria-controls="panel-advance" tabIndex={tab === "advance" ? 0 : -1}
                onClick={() => setTab("advance")} onKeyDown={(e) => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { setTab("now"); document.getElementById("tab-now")?.focus(); } }}>
                Advance booking &amp; festivals
              </button>
            </div>

            {tab === "now" && (next ? (
              <button type="button" className="next-up" onClick={() => showTrain(next.ti)}
                aria-label={`Next to open: ${next.num} ${next.name}, ${stationName(next.orig)} to ${stationName(next.dest)}. Current availability opens at ${clockAt(next.opens)}, in ${duration(next.opens - now)}. Show details.`}>
                <span className="next-k">Next to open<small>in {duration(next.opens - now)}</small></span>
                <FlapTime value={clockAt(next.opens)} />
                <span className="next-train">
                  <b><span>{next.name}</span><span className="tnum">{next.num}</span></b>
                  <span className="next-route">{shortName(stationName(next.orig))} → {shortName(stationName(next.dest))}</span>
                  <small>departs {shortName(sel.name)} {clock(next.dep)}</small>
                </span>
              </button>
            ) : (
              <p className="next-none">No more trains open for current availability on this date.</p>
            ))}
            </div>

            {tab === "now" && <div className="head-b">
            <div className="ctl-row">
              <div className="datebox">
                <button type="button" aria-label="Previous day" onClick={() => setTravelDay((d) => addDays(d, -1))}>‹</button>
                <input id="travel-day" type="date" aria-label="Travel date at this station" value={travelDay} onChange={(e) => e.target.value && setTravelDay(e.target.value)} />
                <button type="button" aria-label="Next day" onClick={() => setTravelDay((d) => addDays(d, 1))}>›</button>
              </div>
              {travelDay !== todayIst(now) && <button type="button" className="btn" onClick={() => setTravelDay(todayIst())}>Today</button>}
              <button type="button" className={`opt-btn${optionsOpen ? " on" : ""}`} aria-expanded={optionsOpen} aria-controls="board-options"
                onClick={() => setOptionsOpen((o) => { store.set("tn.options", o ? "0" : "1"); return !o; })}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
                <span>Options</span>
                <span className="opt-sub">{RULES[rule].label}{sort === "opens" ? " · by opening" : ""}</span>
                {nOpt > 0 && <b aria-label={`${nOpt} active`}>{nOpt}</b>}
                <svg className="chev" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
              </button>
            </div>

            {optionsOpen && (
              <div className="drawer" id="board-options" role="region" aria-label="Board options">
                <div className="frow">
                  <span className="flabel" id="rule-label">Rule</span>
                  <div className="frow-col">
                    <div className="seg" role="group" aria-labelledby="rule-label">
                      {(["10", "8", "4"] as Rule[]).map((r) => (
                        <button key={r} type="button" aria-pressed={rule === r} onClick={() => { setRule(r); store.set("tn.rule", r); }}>{RULES[r].label}</button>
                      ))}
                    </div>
                    <p className="rulenote">{RULES[rule].note}</p>
                  </div>
                </div>
                <div className="frow">
                  <label className="flabel" htmlFor="train-filter">Train</label>
                  <input id="train-filter" className="fsearch" type="search" placeholder="Number or name, e.g. 16103" value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
                <div className="frow">
                  <span className="flabel" id="sort-label">Sort</span>
                  <div className="seg seg-sm" role="group" aria-labelledby="sort-label">
                    <button type="button" aria-pressed={sort === "dep"} onClick={() => setSort("dep")}>By departure</button>
                    <button type="button" aria-pressed={sort === "opens"} onClick={() => setSort("opens")}>By opening time</button>
                  </div>
                </div>
                <div className="frow">
                  <span className="flabel">Availability</span>
                  <div className="chips">
                    {([["all", "All"], ["upcoming", "Not departed"], ["soon", "Opening soon"], ["open", "Open now"]] as [StatusFilter, string][]).map(([v, l]) => (
                      <button key={v} type="button" className="chip-f" aria-pressed={bf.status === v} onClick={() => setBf((f) => ({ ...f, status: v }))}>{l}</button>
                    ))}
                  </div>
                </div>
                <div className="frow">
                  <span className="flabel">Departs</span>
                  <div className="chips">
                    {DAYPARTS.map((p) => (
                      <button key={p.id} type="button" className="chip-f" aria-pressed={bf.dayparts.includes(p.id)} title={p.range}
                        onClick={() => setBf((f) => ({ ...f, dayparts: toggleIn<Daypart>(f.dayparts, p.id) }))}>{p.label}</button>
                    ))}
                  </div>
                </div>
                <div className="frow">
                  <span className="flabel">Type</span>
                  <div className="chips">
                    {kindsHere.map((k) => (
                      <button key={k} type="button" className="chip-f" aria-pressed={bf.kinds.includes(k)}
                        onClick={() => setBf((f) => ({ ...f, kinds: toggleIn<Kind>(f.kinds, k) }))}>{k}</button>
                    ))}
                  </div>
                </div>
                <div className="frow">
                  <label className="flabel" htmlFor="going-to">Going to</label>
                  <select id="going-to" className="fselect" value={bf.to} onChange={(e) => setBf((f) => ({ ...f, to: e.target.value }))}>
                    <option value="">Any station</option>
                    {destinations.map((d) => <option key={d.code} value={d.code}>{d.name} ({d.code}) · {d.n}</option>)}
                  </select>
                </div>
                <div className="frow">
                  <span className="flabel">Show</span>
                  <div className="chips">
                    <label className="pill"><input type="checkbox" checked={reservedOnly} onChange={(e) => setReservedOnly(e.target.checked)} />Reserved only</label>
                    <label className="pill"><input type="checkbox" checked={runningOnly} onChange={(e) => setRunningOnly(e.target.checked)} />Runs this date</label>
                  </div>
                </div>
                <div className="drawer-foot">
                  <span>{rows.length} of {allRows.length} trains match</span>
                  <button type="button" className="linkbtn" disabled={!nOpt} onClick={() => { setBf(NO_FILTERS); setQuery(""); }}>Clear filters</button>
                </div>
              </div>
            )}

            {!optionsOpen && nOpt > 0 && (
              <div className="active-f" aria-label="Active filters">
                {query && <button type="button" onClick={() => setQuery("")} aria-label={`Remove filter: ${query}`}>“{query}” ×</button>}
                {bf.status !== "all" && <button type="button" onClick={() => setBf((f) => ({ ...f, status: "all" }))}>{{ upcoming: "Not departed", soon: "Opening soon", open: "Open now", all: "" }[bf.status]} ×</button>}
                {bf.dayparts.map((p) => <button key={p} type="button" onClick={() => setBf((f) => ({ ...f, dayparts: f.dayparts.filter((x) => x !== p) }))}>{DAYPARTS.find((x) => x.id === p)!.label} ×</button>)}
                {bf.kinds.map((k) => <button key={k} type="button" onClick={() => setBf((f) => ({ ...f, kinds: f.kinds.filter((x) => x !== k) }))}>{k} ×</button>)}
                {bf.to && <button type="button" onClick={() => setBf((f) => ({ ...f, to: "" }))}>To {shortName(stationName(bf.to))} ×</button>}
              </div>
            )}
            </div>}
          </div>

          {tab === "advance" ? (
            <div className="list" key="panel-advance" id="panel-advance" role="tabpanel" aria-labelledby="tab-advance">
              <AdvancePlanner data={data} sel={sel} now={now} stationName={stationName} onRoute={setPlanTi} to={bf.to} stopsOf={(t) => trainStops[t]} />
            </div>
          ) : (
          <div className="list" key="panel-now" ref={listRef} id="panel-now" role="tabpanel" aria-labelledby="tab-now">
            <p className="count">
              {rows.length === allRows.length ? `${rows.length} trains` : `${rows.length} of ${allRows.length} trains`} · {dayLabel(travelDay)} · times in IST · tap a train for details
            </p>
            {rows.length === 0 ? (
              <div className="empty">No trains match these filters.<br />{nOpt ? <button type="button" className="linkbtn" onClick={() => { setBf(NO_FILTERS); setQuery(""); }}>Clear filters</button> : "Turn off “Reserved only”, or try another date."}</div>
            ) : (
              secs.map((sec) => (
                <section key={sec.id} className="sec" aria-label={`${sec.title}, ${sec.rows.length} trains`}>
                  <h3 className="sec-h"><span>{sec.title}</span><small>{sec.sub}</small><span className="sec-col" aria-hidden="true">Current availability opens</span><b>{sec.rows.length}</b></h3>
                  <div className="sec-grid">
                    {sec.rows.map((d) => (
                      <Fragment key={d.ti}>
                        {d.ti === firstUpcoming && <div className="now-line" role="separator"><span>Now · {clockAt(now)}</span></div>}
                        <div className="sec-item">
                          <TrainCard d={d} here={sel} travelDay={travelDay} now={now} open={openTi === d.ti}
                            stops={trainStops[d.ti]} stationName={stationName} onToggle={toggle} onHover={hover} />
                        </div>
                      </Fragment>
                    ))}
                  </div>
                </section>
              ))
            )}
            <SyncButton data={data} onData={onData} className="sync-foot" />
            <footer className="foot">
              Scheduled times from the free, unofficial <a href="https://github.com/Neo2308/indianrailways-gtfs" target="_blank" rel="noreferrer">Indian Railways GTFS feed</a> (version {data.feed}). Not live running status. Confirm on IRCTC before you travel. EMU, MEMU, DEMU and passenger trains are unreserved and hidden by “Reserved only”. Map © OpenStreetMap contributors, OpenFreeMap; terrain © Mapzen.
            </footer>
          </div>
          )}
        </div>
      </aside>
    </div>
  );
}
