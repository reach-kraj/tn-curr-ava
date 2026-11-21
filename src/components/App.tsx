"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import StationSearch, { type TrainHit } from "./StationSearch";
import StationPicker, { type PickOption } from "./StationPicker";
import TrainCard from "./TrainCard";
import FlapTime from "./FlapTime";
import TrainLogo from "./TrainLogo";
import Footer from "./Footer";
import Signal from "./Signal";
import SyncButton, { DATASET_KEY } from "./SyncButton";
import AdvancePlanner, { DateTile, HolidaysView } from "./AdvancePlanner";
import type { Dataset, Station, TrainStop } from "@/lib/types";
import {
  RULES, addDays, clock, clockAt, dayLabel, dayWord, departures, duration, shortName, status, toStations, todayIst, type Rule,
} from "@/lib/booking";
import {
  DAYPARTS, KINDS, NO_FILTERS, activeCount, applyBoardFilters, onwardCodes, sections, trainKind,
  type BoardFilters, type Daypart, type Kind, type SortBy, type StatusFilter,
} from "@/lib/filters";
import { advanceOpens, breaks, lastBookable, longWeekends } from "@/lib/advance";
import { HOLIDAYS } from "@/lib/holidays";

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

  if (error) {
    return (
      <div className="state-msg" role="alert">
        <b>Couldn’t load the timetable.</b>
        <span>Check your connection and refresh the page. ({error})</span>
      </div>
    );
  }
  if (!data) return <Skeleton />;
  return <Explorer data={data} onData={setData} />;
}

function Skeleton() {
  return (
    <div className="skeleton" aria-busy="true" aria-label="Loading the Tamil Nadu timetable">
      <div className="topbar"><div className="wrap topbar-in"><span className="brand"><TrainLogo />TN Train Booking</span></div></div>
      <div className="wrap sk-body">
        <div className="sk sk-bar" />
        <div className="layout">
          <div className="sk sk-side" />
          <div className="sk-list">{Array.from({ length: 6 }, (_, i) => <div key={i} className="sk sk-row" />)}</div>
        </div>
      </div>
    </div>
  );
}

type Tab = "now" | "advance" | "holidays";
const TABS: { id: Tab; label: string; short: string }[] = [
  { id: "now", label: "Current availability", short: "Current" },
  { id: "advance", label: "Advance booking", short: "Advance" },
  { id: "holidays", label: "Holidays & long weekends", short: "Holidays" },
];

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
  const stopsOf = useCallback((ti: number) => trainStops[ti], [trainStops]);

  const trainHits = useMemo<TrainHit[]>(
    () => data.t.map(([num, name, orig, dest], ti) => ({ ti, num, name, from: shortName(stationName(orig)), to: shortName(stationName(dest)) })),
    [data, stationName],
  );
  const fromOptions = useMemo<PickOption[]>(() => stations.map((s) => ({ code: s.code, name: s.name, sub: `${s.n} trains` })), [stations]);
  const toOptions = useMemo<PickOption[]>(
    () => [...fromOptions, ...Object.entries(data.o).map(([code, name]) => ({ code, name, sub: "outside TN" }))],
    [fromOptions, data],
  );
  // major long-distance stations (ranking by stop count would favour suburban EMU halts)
  const popular = useMemo(
    () => ["MS", "TBM", "CGL", "VM", "MAS", "TPJ", "MDU"].map((c) => byCode.get(c)).filter((s): s is Station => !!s),
    [byCode],
  );

  const [selCode, setSelCode] = useState("TBM");
  const [travelDay, setTravelDay] = useState(() => todayIst());
  const [rule, setRule] = useState<Rule>("10");
  const [query, setQuery] = useState("");
  const [reservedOnly, setReservedOnly] = useState(true);
  const [runningOnly, setRunningOnly] = useState(true);
  const [openTi, setOpenTi] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [bf, setBf] = useState<BoardFilters>(NO_FILTERS);
  const [sort, setSort] = useState<SortBy>("dep");
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("now");
  const [planDay, setPlanDay] = useState(() => lastBookable(todayIst()));
  const [recent, setRecent] = useState<string[]>([]);
  const [geo, setGeo] = useState<{ busy: boolean; msg: string | null }>({ busy: false, msg: null });
  const [showLeft, setShowLeft] = useState(false);

  // restore station from the link (#CGL) or last visit, plus preferences
  useEffect(() => {
    const fromHash = decodeURIComponent(location.hash.slice(1)).toUpperCase();
    const saved = store.get("tn.station");
    const code = byCode.has(fromHash) ? fromHash : saved && byCode.has(saved) ? saved : null;
    const r = store.get("tn.rule");
    let rec: string[] = [];
    try { rec = JSON.parse(store.get("tn.recent") ?? "[]"); } catch { rec = []; }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from URL/localStorage after hydration
    if (code) setSelCode(code);
    if (r && r in RULES) setRule(r as Rule);
    setRecent(rec.filter((c) => byCode.has(c)).slice(0, 5));
    const onHash = () => { const c = decodeURIComponent(location.hash.slice(1)).toUpperCase(); if (byCode.has(c)) setSelCode(c); };
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, [byCode]);

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(id); }, []);

  // "/" focuses the search, as on most transport sites
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        document.getElementById("station-search")?.focus();
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  const sel = byCode.get(selCode) ?? stations[0];
  const selectStation = useCallback((s: Station) => {
    setSelCode(s.code); setOpenTi(null);
    setBf((f) => (f.to === s.code ? { ...f, to: "" } : f));
    store.set("tn.station", s.code);
    history.replaceState(null, "", `#${s.code}`);
    setRecent((r) => {
      const next = [s.code, ...r.filter((c) => c !== s.code)].slice(0, 5);
      store.set("tn.recent", JSON.stringify(next));
      return next;
    });
  }, []);

  const nearMe = () => {
    if (!("geolocation" in navigator)) { setGeo({ busy: false, msg: "Location isn’t available in this browser." }); return; }
    setGeo({ busy: true, msg: "Finding the nearest station…" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: la, longitude: lo } = pos.coords;
        const rad = Math.PI / 180;
        const km = (s: Station) => 6371 * 2 * Math.asin(Math.sqrt(Math.sin(((s.lat - la) * rad) / 2) ** 2 + Math.cos(la * rad) * Math.cos(s.lat * rad) * Math.sin(((s.lon - lo) * rad) / 2) ** 2));
        const best = [...stations].sort((a, b) => km(a) - km(b))[0];
        const d = km(best);
        if (d > 120) { setGeo({ busy: false, msg: "You seem to be outside Tamil Nadu. Pick a station instead." }); return; }
        selectStation(best);
        setGeo({ busy: false, msg: `Nearest station: ${best.name} (${d < 1 ? "under 1" : Math.round(d)} km)` });
      },
      (err) => setGeo({ busy: false, msg: err.code === err.PERMISSION_DENIED ? "Location permission was refused. Pick a station instead." : "Couldn’t get your location. Pick a station instead." }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  };

  const allRows = useMemo(
    () => departures(data, sel.code, travelDay, rule, { reservedOnly, runningOnly, query }),
    [data, sel.code, travelDay, rule, reservedOnly, runningOnly, query],
  );
  const rows = useMemo(() => applyBoardFilters(allRows, bf, now, stopsOf), [allRows, bf, now, stopsOf]);
  // on today's board, trains that already left are folded away unless asked for
  const foldLeft = travelDay === todayIst(now) && sort === "dep" && bf.status === "all";
  const left = foldLeft ? rows.filter((r) => status(r, now).kind === "gone") : [];
  const shown = foldLeft && !showLeft ? rows.filter((r) => status(r, now).kind !== "gone") : rows;
  const secs = useMemo(() => sections(shown, sort, now), [shown, sort, now]);
  const openNow = allRows.filter((r) => status(r, now).kind === "open").length;
  // next train whose current availability opens: today's board first, else tomorrow's
  const next = useMemo(() => {
    const pick = (list: typeof rows) => list.filter((r) => r.opens > now).sort((a, b) => a.opens - b.opens)[0];
    const here = pick(rows);
    if (here) return { d: here, day: travelDay };
    if (travelDay !== todayIst(now)) return null;
    const tmr = addDays(travelDay, 1);
    const t = pick(applyBoardFilters(departures(data, sel.code, tmr, rule, { reservedOnly, runningOnly, query }), bf, now, stopsOf));
    return t ? { d: t, day: tmr } : null;
  }, [rows, now, travelDay, data, sel.code, rule, reservedOnly, runningOnly, query, bf, stopsOf]);
  const destinations = useMemo(() => {
    const count = new Map<string, number>();
    for (const d of allRows) for (const c of onwardCodes(d, stopsOf(d.ti))) count.set(c, (count.get(c) ?? 0) + 1);
    return [...count].map(([code, n]) => ({ code, n, name: stationName(code) })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  }, [allRows, stopsOf, stationName]);
  const kindsHere = useMemo(() => { const k = new Set(allRows.map((d) => trainKind(d.name))); return KINDS.filter((x) => k.has(x)); }, [allRows]);
  const nFilters = activeCount(bf);
  const nOpt = nFilters + (query.trim() ? 1 : 0);
  const toggleIn = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const today = todayIst(now);
  const firstUpcoming = travelDay === today && sort === "dep" && (showLeft || !foldLeft) ? rows.find((r) => r.hereDep > now)?.ti : undefined;
  const nextWeekend = useMemo(() => longWeekends(breaks(HOLIDAYS, today)).find((w) => w.go >= today), [today]);

  const showTrain = (ti: number) => {
    setTab("now");
    setOpenTi(ti);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-ti="${ti}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" });
    }));
  };
  const searchTrains = () => {
    setTab("now");
    setOptionsOpen(false);
    requestAnimationFrame(() => {
      const board = document.getElementById("board");
      board?.scrollIntoView({ block: "start", behavior: "smooth" });
      board?.focus({ preventScroll: true });
    });
  };
  const jumpToNow = () => document.querySelector<HTMLElement>(".now-line")?.scrollIntoView({ block: "center", behavior: "smooth" });
  const pickTrain = (ti: number) => {
    // board where the user already is if the train stops there, else its first boardable Tamil Nadu stop
    const boardable = trainStops[ti].filter((x) => x.dep >= 0);
    const at = boardable.find((x) => x.station.code === sel.code) ?? boardable[0];
    if (!at) return;
    if (at.station.code !== sel.code) selectStation(at.station);
    // if the current filters would hide it (e.g. not running that day, unreserved), relax them so it shows
    const onBoard = applyBoardFilters(
      departures(data, at.station.code, travelDay, rule, { reservedOnly, runningOnly, query }),
      { ...bf, to: "" }, now, stopsOf,
    ).some((r) => r.ti === ti);
    if (!onBoard) { setBf(NO_FILTERS); setQuery(""); setRunningOnly(false); setReservedOnly(false); }
    showTrain(ti);
  };
  const toggle = useCallback((ti: number) => setOpenTi((o) => (o === ti ? null : ti)), []);
  const planFor = (day: string) => {
    setPlanDay(day);
    setTab("advance");
    requestAnimationFrame(() => document.getElementById("tabs")?.scrollIntoView({ block: "start", behavior: "smooth" }));
  };
  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    const n = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!n && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const j = e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : (i + n + TABS.length) % TABS.length;
    setTab(TABS[j].id);
    document.getElementById(`tab-${TABS[j].id}`)?.focus();
  };
  const weekendOpen = nextWeekend ? now >= advanceOpens(nextWeekend.go) : false;

  return (
    <div className="app">
      <a className="skip" href="#board">Skip to trains</a>

      <header className="topbar">
        <div className="wrap topbar-in">
          <a className="brand" href="#top" onClick={(e) => { e.preventDefault(); scrollTo({ top: 0, behavior: "smooth" }); }}>
            <TrainLogo />TN Train Booking
          </a>
          <div className="topbar-search">
            <StationSearch stations={stations} trains={trainHits} onPick={selectStation} onPickTrain={pickTrain} />
            <kbd className="kbd-hint" aria-hidden="true">/</kbd>
          </div>
          <SyncButton data={data} onData={onData} className="topbar-sync" />
        </div>
      </header>

      <section className="journey-bar" aria-label="Your journey">
        <div className="wrap">
          <div className="jb-row">
            <div className="jb-route">
              <StationPicker label="From" value={{ code: sel.code, name: shortName(sel.name) }} options={fromOptions} placeholder="Boarding station"
                onChange={(c) => { const s = c ? byCode.get(c) : null; if (s) selectStation(s); }} />
              <button type="button" className="swap" disabled={!bf.to || !byCode.has(bf.to)}
                onClick={() => { const back = byCode.get(bf.to)!; const from = sel.code; selectStation(back); setBf((f) => ({ ...f, to: from })); }}
                aria-label="Swap From and To" title={bf.to && !byCode.has(bf.to) ? "Swap works when To is in Tamil Nadu" : "Swap From and To"}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" /></svg>
              </button>
              <StationPicker label="To" allowClear value={bf.to ? { code: bf.to, name: shortName(stationName(bf.to)) } : null} options={toOptions.filter((o) => o.code !== sel.code)}
                placeholder="Any station" onChange={(c) => setBf((f) => ({ ...f, to: c ?? "" }))} />
              <button type="button" className="go-btn" onClick={searchTrains}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                Search trains
              </button>
            </div>
            <div className="jb-date" role="group" aria-labelledby="jb-date-k">
              <span className="jb-k" id="jb-date-k">Travel date</span>
              <div className="jb-date-row">
                <button type="button" className="chip-d" aria-pressed={travelDay === today} onClick={() => setTravelDay(today)}>Today</button>
                <button type="button" className="chip-d" aria-pressed={travelDay === addDays(today, 1)} onClick={() => setTravelDay(addDays(today, 1))}>Tomorrow</button>
                <input id="travel-day" type="date" aria-label="Pick a travel date" value={travelDay} onChange={(e) => e.target.value && setTravelDay(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="jb-quick">
            <button type="button" className="near" onClick={nearMe} disabled={geo.busy} aria-describedby="geo-msg">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="7" /></svg>
              {geo.busy ? "Locating…" : "Near me"}
            </button>
            {recent.some((c) => c !== sel.code) && (
              <div className="qchips" role="group" aria-label="Recent stations">
                <span className="qk" aria-hidden="true">Recent</span>
                {recent.filter((c) => c !== sel.code).map((c) => (
                  <button key={c} type="button" className="qchip" onClick={() => selectStation(byCode.get(c)!)}>{shortName(stationName(c))}</button>
                ))}
              </div>
            )}
            <div className="qchips" role="group" aria-label="Major stations">
              <span className="qk" aria-hidden="true">Major</span>
              {popular.filter((s) => s.code !== sel.code).slice(0, 5).map((s) => (
                <button key={s.code} type="button" className="qchip" onClick={() => selectStation(s)}>{shortName(s.name)}</button>
              ))}
            </div>
            <p id="geo-msg" className="geo-msg" aria-live="polite">{geo.msg}</p>
          </div>
        </div>
      </section>

      <main className="wrap layout" id="main">
        <aside className="side" aria-label={`${sel.name} summary`}>
          <div className="nameboard">
            <div className="nameboard-top"><span>{sel.code}</span><span>{sel.n} trains stop</span></div>
            <h1>{shortName(sel.name)}</h1>
          </div>
          <dl className="counts">
            <div><dt>Departing</dt><dd>{allRows.length}</dd></div>
            <div><dt>Open now</dt><dd className="ok">{openNow}</dd></div>
            <div><dt>Date</dt><dd className="d">{dayLabel(travelDay)}</dd></div>
          </dl>

          {next ? (
            <button type="button" className="next-up" onClick={() => { if (next.day !== travelDay) setTravelDay(next.day); showTrain(next.d.ti); }}
              aria-label={`Next to open${next.day !== travelDay ? ` (tomorrow's train)` : ""}: ${next.d.num} ${next.d.name}, ${stationName(next.d.orig)} to ${stationName(next.d.dest)}. Current availability opens at ${clockAt(next.d.opens)}, in ${duration(next.d.opens - now)}. Show this train.`}>
              <span className="next-k"><span className="next-k-row"><Signal aspect="soon" />Next to open</span><small>{dayWord(next.d.opens, now)} · in {duration(next.d.opens - now)}</small></span>
              <FlapTime value={clockAt(next.d.opens)} />
              <span className="next-train">
                <b><span>{next.d.name}</span><span className="tnum">{next.d.num}</span></b>
                <span className="next-route">{shortName(stationName(next.d.orig))} → {shortName(stationName(next.d.dest))}</span>
                <small>departs {shortName(sel.name)} {clock(next.d.dep)}{next.day !== travelDay ? ` · ${dayLabel(next.day)}` : ""}</small>
              </span>
            </button>
          ) : (
            <p className="side-note">No more trains open for current availability on {dayLabel(travelDay)}.</p>
          )}

          {nextWeekend && (
            <button type="button" className="teaser" onClick={() => setTab("holidays")}>
              <DateTile day={nextWeekend.start} />
              <span className="teaser-text">
                <span className="teaser-k">Next long weekend</span>
                <b>{nextWeekend.names.join(" · ")}</b>
                <span>{dayLabel(nextWeekend.start)} – {dayLabel(nextWeekend.end)} · {nextWeekend.days} days{nextWeekend.leaveDay ? " with 1 leave" : ""}</span>
                <span className={weekendOpen ? "ok" : "soon"}>
                  Go {dayLabel(nextWeekend.go)}: {weekendOpen ? "booking open" : `books ${dayLabel(addDays(nextWeekend.go, -60))}`}
                </span>
              </span>
            </button>
          )}
        </aside>

        <section className="content" id="board" aria-label="Trains and booking" tabIndex={-1}>
          <div className="tabs" id="tabs" role="tablist" aria-label="What to show">
            {TABS.map((t, i) => (
              <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-label={t.label} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`}
                tabIndex={tab === t.id ? 0 : -1} onClick={() => setTab(t.id)} onKeyDown={(e) => onTabKey(e, i)}>
                <span className="tab-long">{t.label}</span><span className="tab-short" aria-hidden="true">{t.short}</span>
              </button>
            ))}
          </div>

          {tab === "now" && (
            <div id="panel-now" role="tabpanel" aria-labelledby="tab-now" className="panel-now">
              <div className="toolbar">
                <div className="seg" role="group" aria-label="Current availability rule">
                  {(["10", "8", "4"] as Rule[]).map((r) => (
                    <button key={r} type="button" aria-pressed={rule === r} onClick={() => { setRule(r); store.set("tn.rule", r); }}>{RULES[r].label}</button>
                  ))}
                </div>
                <button type="button" className={`opt-btn${optionsOpen ? " on" : ""}`} aria-expanded={optionsOpen} aria-controls="board-options" onClick={() => setOptionsOpen((o) => !o)}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
                  Filters{nOpt > 0 && <b aria-label={`${nOpt} active`}>{nOpt}</b>}
                </button>
                <div className="seg seg-sm" role="group" aria-label="Sort trains">
                  <button type="button" aria-pressed={sort === "dep"} onClick={() => setSort("dep")}>By departure</button>
                  <button type="button" aria-pressed={sort === "opens"} onClick={() => setSort("opens")}>By opening</button>
                </div>
                {firstUpcoming != null && <button type="button" className="jump" onClick={jumpToNow}>Jump to now</button>}
              </div>
              <div className="rulerow">
                <p className="rulenote">{RULES[rule].note}</p>
                <p className="sig-key" aria-label="Signal key: green open now, yellow opens later, red departed">
                  <span><Signal aspect="open" />Open now</span>
                  <span><Signal aspect="soon" />Opens later</span>
                  <span><Signal aspect="gone" />Departed</span>
                </p>
              </div>

              {optionsOpen && (
                <div className="drawer" id="board-options" role="region" aria-label="Filters">
                  <div className="frow">
                    <label className="flabel" htmlFor="train-filter">Train</label>
                    <input id="train-filter" className="fsearch" type="search" placeholder="Number or name, e.g. 16103" value={query} onChange={(e) => setQuery(e.target.value)} />
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
                        <button key={k} type="button" className="chip-f" aria-pressed={bf.kinds.includes(k)} onClick={() => setBf((f) => ({ ...f, kinds: toggleIn<Kind>(f.kinds, k) }))}>{k}</button>
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
                  {query && <button type="button" onClick={() => setQuery("")}>“{query}” ×</button>}
                  {bf.status !== "all" && <button type="button" onClick={() => setBf((f) => ({ ...f, status: "all" }))}>{{ upcoming: "Not departed", soon: "Opening soon", open: "Open now", all: "" }[bf.status]} ×</button>}
                  {bf.dayparts.map((p) => <button key={p} type="button" onClick={() => setBf((f) => ({ ...f, dayparts: f.dayparts.filter((x) => x !== p) }))}>{DAYPARTS.find((x) => x.id === p)!.label} ×</button>)}
                  {bf.kinds.map((k) => <button key={k} type="button" onClick={() => setBf((f) => ({ ...f, kinds: f.kinds.filter((x) => x !== k) }))}>{k} ×</button>)}
                  {bf.to && <button type="button" onClick={() => setBf((f) => ({ ...f, to: "" }))}>To {shortName(stationName(bf.to))} ×</button>}
                </div>
              )}

              <div className="list">
                <p className="count" aria-live="polite">
                  {rows.length === allRows.length ? `${rows.length} trains` : `${rows.length} of ${allRows.length} trains`} from {shortName(sel.name)}{bf.to ? ` to ${shortName(stationName(bf.to))}` : ""} · {dayLabel(travelDay)} · times in IST
                </p>
                {left.length > 0 && (
                  <button type="button" className="left-toggle" aria-expanded={showLeft} onClick={() => setShowLeft((v) => !v)}>
                    <span><b>{left.length}</b> {left.length === 1 ? "train" : "trains"} already left today</span>
                    <span className="left-act">{showLeft ? "Hide" : "Show"}</span>
                  </button>
                )}
                {rows.length === 0 ? (
                  <div className="empty">
                    <b>No trains match.</b>
                    {nOpt ? <button type="button" className="linkbtn" onClick={() => { setBf(NO_FILTERS); setQuery(""); }}>Clear filters</button> : <span>Turn off “Reserved only” in Filters, or try another date.</span>}
                  </div>
                ) : (
                  secs.map((sec) => (
                    <section key={sec.id} className="sec" aria-label={`${sec.title}, ${sec.rows.length} trains`}>
                      <h2 className="sec-h"><span>{sec.title}</span><small>{sec.sub}</small><span className="sec-col" aria-hidden="true">Current availability opens</span><b>{sec.rows.length}</b></h2>
                      <div className="sec-grid">
                        {sec.rows.map((d) => (
                          <Fragment key={d.ti}>
                            {d.ti === firstUpcoming && <div className="now-line" role="separator" aria-label={`Now, ${clockAt(now)}`}><span><TrainLogo height={14} />Now · {clockAt(now)}</span></div>}
                            <div className="sec-item">
                              <TrainCard d={d} here={sel} travelDay={travelDay} now={now} open={openTi === d.ti}
                                stops={trainStops[d.ti]} stationName={stationName} onToggle={toggle} />
                            </div>
                          </Fragment>
                        ))}
                      </div>
                    </section>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === "advance" && (
            <div id="panel-advance" role="tabpanel" aria-labelledby="tab-advance">
              <AdvancePlanner data={data} sel={sel} now={now} stationName={stationName} to={bf.to} stopsOf={stopsOf} journey={planDay} setJourney={setPlanDay} />
            </div>
          )}

          {tab === "holidays" && (
            <div id="panel-holidays" role="tabpanel" aria-labelledby="tab-holidays">
              <HolidaysView now={now} onPlan={planFor} planned={planDay} />
            </div>
          )}
        </section>
      </main>

      <Footer feed={data.feed} stations={stations.length} />
    </div>
  );
}
