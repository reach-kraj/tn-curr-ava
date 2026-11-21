"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import RailMap from "./RailMap";
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

function Explorer({ data }: { data: Dataset }) {
  const stations = useMemo(() => toStations(data), [data]);
  const byCode = useMemo(() => new Map(stations.map((s) => [s.code, s])), [stations]);
  const stationName = useCallback((c: string) => byCode.get(c)?.name ?? data.o[c] ?? c, [byCode, data]);

  /** each train's Tamil Nadu stops in running order */
  const trainStops = useMemo(() => {
    const out: TrainStop[][] = data.t.map(() => []);
    for (const [code, list] of Object.entries(data.st)) for (const [ti, arr, dep] of list) out[ti].push({ station: byCode.get(code)!, arr, dep });
    out.forEach((l) => l.sort((a, b) => (a.arr < 0 ? -1 : a.dep >= 0 ? a.dep : a.arr) - (b.arr < 0 ? -1 : b.dep >= 0 ? b.dep : b.arr)));
    return out;
  }, [data, byCode]);

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

  // restore station from the link (#CGL) or last visit, and rule preference
  useEffect(() => {
    const fromHash = decodeURIComponent(location.hash.slice(1)).toUpperCase();
    const saved = store.get("tn.station");
    const code = byCode.has(fromHash) ? fromHash : saved && byCode.has(saved) ? saved : null;
    const r = store.get("tn.rule");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from URL/localStorage after hydration
    if (code) setSelCode(code);
    if (r && r in RULES) setRule(r as Rule);
    const onHash = () => { const c = decodeURIComponent(location.hash.slice(1)).toUpperCase(); if (byCode.has(c)) { setSelCode(c); setFlyKey((k) => k + 1); } };
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, [byCode]);

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(id); }, []);

  const sel = byCode.get(selCode) ?? stations[0];
  const selectStation = useCallback((s: Station, fly = false) => {
    setSelCode(s.code); setOpenTi(null);
    store.set("tn.station", s.code);
    history.replaceState(null, "", `#${s.code}`);
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
  const toggle = useCallback((ti: number) => setOpenTi((o) => (o === ti ? null : ti)), []);

  // on today's board, scroll the list to the next train still to depart
  const listRef = useRef<HTMLDivElement>(null);
  const firstUpcoming = travelDay === todayIst(now) ? rows.find((r) => r.hereDep > now)?.ti : undefined;
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const card = firstUpcoming == null ? null : list.querySelector<HTMLElement>(`[data-ti="${firstUpcoming}"]`);
    if (list.scrollHeight > list.clientHeight) list.scrollTo({ top: card ? card.offsetTop - list.offsetTop - 34 : 0 });
    // re-run only when the station, day or filters change, not on every clock tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel.code, travelDay, rule, reservedOnly, runningOnly, query]);

  return (
    <div className="app">
      <section className="map" aria-label="Map">
        <RailMap data={data} stations={stations} selected={sel} route={route} flyKey={flyKey} onSelect={(s) => selectStation(s)} />
        <div className="brand">
          <span className="eyebrow-tag"><i />Tamil Nadu · Current booking</span>
          <h1>Pick a station. See when current booking opens for every train.</h1>
          <StationSearch stations={stations} onPick={(s) => selectStation(s, true)} />
        </div>
        <div className="legend" aria-hidden="true">
          <span><svg width="22" height="8"><line x1="2" y1="4" x2="20" y2="4" stroke="#fff" strokeWidth="5" strokeLinecap="round" /><line x1="2" y1="4" x2="20" y2="4" stroke="var(--track)" strokeWidth="1.6" strokeLinecap="round" /></svg>Rail line</span>
          <span><svg width="12" height="12"><circle cx="6" cy="6" r="4.5" fill="#fff" stroke="var(--track)" strokeWidth="1.3" /></svg>Busy station</span>
          <span><svg width="10" height="10"><circle cx="5" cy="5" r="2.6" fill="var(--track)" /></svg>Station</span>
          <span><svg width="22" height="8"><line x1="2" y1="4" x2="20" y2="4" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" /></svg>Train route</span>
        </div>
      </section>

      <aside className="panel" aria-label="Trains at selected station">
        <div className="head">
          <div className="nameboard" aria-live="polite">
            <div className="nameboard-top"><span>{sel.code}</span><span>{sel.n} trains stop</span></div>
            <h2>{shortName(sel.name)}</h2>
          </div>

          <div className="stats">
            <div className="stat"><b>{rows.length}</b><span>trains departing</span></div>
            <div className="stat"><b className="ok">{openNow}</b><span>open right now</span></div>
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
              {(['10', '8', '4'] as Rule[]).map((r) => (
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
          <p className="count">{rows.length} train{rows.length === 1 ? "" : "s"} leaving {shortName(sel.name)} on {dayLabel(travelDay)} · sorted by departure · times in IST{firstUpcoming != null && rows[0]?.ti !== firstUpcoming ? " · scrolled to the next departure" : ""}</p>
          {rows.length === 0 ? (
            <div className="empty">No trains match these filters.<br />Turn off “Reserved only”, or try another date.</div>
          ) : (
            rows.map((d) => (
              <TrainCard key={d.ti} d={d} here={sel} travelDay={travelDay} now={now} open={openTi === d.ti}
                stops={trainStops[d.ti]} stationName={stationName} onToggle={toggle} onHover={setHoverTi} />
            ))
          )}
        </div>

        <footer className="foot">
          Scheduled times from the free, unofficial <a href="https://github.com/Neo2308/indianrailways-gtfs" target="_blank" rel="noreferrer">Indian Railways GTFS feed</a> (version {data.feed}), {stations.length} Tamil Nadu &amp; Puducherry stations. Not live running status. Confirm on IRCTC before you travel. EMU, MEMU, DEMU and passenger trains are unreserved and hidden by “Reserved only”.
        </footer>
      </aside>
    </div>
  );
}
