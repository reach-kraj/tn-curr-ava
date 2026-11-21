"use client";

import { memo, useState } from "react";
import FlapTime from "./FlapTime";
import { googleCalendarUrl, icsFile, icsFileName, reminderText, type ReminderInput } from "@/lib/reminders";
import type { Station, TrainStop } from "@/lib/types";
import {
  clock, clockAt, dayLabel, duration, istDay, relDay, shortName, status, type Departure,
} from "@/lib/booking";

interface Props {
  d: Departure;
  here: Station;
  travelDay: string;
  now: number;
  open: boolean;
  stops: TrainStop[];
  stationName: (code: string) => string;
  onToggle: (ti: number) => void;
  onHover: (ti: number | null) => void;
}

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

function TrainCard({ d, here, travelDay, now, open, stops, stationName, onToggle, onHover }: Props) {
  const st = status(d, now);
  const [shared, setShared] = useState<string | null>(null);
  const reminder = (): ReminderInput => ({
    d, boardAt: here.name, sourceName: stationName(d.orig), destName: stationName(d.dest),
    url: `${location.origin}/#${here.code}`,
  });
  const downloadIcs = () => {
    const r = reminder();
    const blob = new Blob([icsFile(r)], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = icsFileName(r);
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  };
  const share = async () => {
    const { title, body } = reminderText(reminder());
    try {
      if (navigator.share) { await navigator.share({ title, text: body }); return; }
      await navigator.clipboard.writeText(`${title}\n${body}`);
      setShared("Copied");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setShared("Couldn’t share");
    }
    setTimeout(() => setShared(null), 2000);
  };
  const upcoming = st.kind === "soon";
  const tag = (ms: number) => { const r = relDay(ms, travelDay); return r === "same day" ? "" : r; };
  const steps = [
    { cls: "is-open", t: clockAt(d.opens), s: "Booking opens", sub: tag(d.opens) },
    ...(d.startsHere ? [] : [{ cls: "", t: clockAt(d.srcDep), s: `Leaves ${shortName(stationName(d.orig))}`, sub: tag(d.srcDep) }]),
    { cls: "is-here", t: clock(d.dep), s: `Departs ${shortName(here.name)}`, sub: "" },
    ...(d.reach != null ? [{ cls: "", t: clockAt(d.reach), s: `Reaches ${shortName(stationName(d.dest))}`, sub: tag(d.reach) }] : []),
  ];

  return (
    <article
      className={`card${open ? " on" : ""}${d.runs ? "" : " dim"}`}
      data-ti={d.ti}
      onMouseEnter={() => onHover(d.ti)}
      onMouseLeave={() => onHover(null)}
    >
      <button type="button" className="card-hit" aria-expanded={open} onClick={() => onToggle(d.ti)}>
        <span className="sr-only">{open ? "Hide" : "Show"} details for {d.num} {d.name}</span>
      </button>

      <header className="card-top">
        <div className="when">
          <span className="when-t">{clock(d.dep)}</span>
          <span className="when-l">{d.startsHere ? "starts here" : "departs"}</span>
        </div>
        <div className="ident">
          <div className="ident-row">
            <span className="num">{d.num}</span>
            <span className="tname">{d.name}</span>
          </div>
          <div className="route">
            {stationName(d.orig)} <span aria-hidden="true">→</span> {stationName(d.dest)}
            {!d.runs && <em> · not running this date</em>}
          </div>
          <div className="days" aria-label="Runs on">
            {DAYS.map((l, i) => <i key={i} className={(d.train[5] >> i) & 1 ? "y" : ""}>{l}</i>)}
          </div>
        </div>
        <span className={`chip ${st.kind}`}>
          {st.kind === "soon" ? `Opens in ${duration(st.ms)}` : st.kind === "open" ? "Open now" : "Departed"}
        </span>
      </header>

      <div className="board">
        <div>
          <div className="board-k">Current booking opens</div>
          <div className="board-sub">{relDay(d.opens, travelDay)} · {dayLabel(istDay(d.opens))}</div>
        </div>
        <div className="board-r">
          <FlapTime value={clockAt(d.opens)} />
          {upcoming && !open && (
            <button type="button" className="bell" onClick={() => onToggle(d.ti)} aria-label={`Set a reminder for ${d.num}`}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
            </button>
          )}
        </div>
      </div>

      <ol className="tl" style={{ ["--n" as string]: steps.length }}>
        {steps.map((s, i) => (
          <li key={i} className={s.cls}>
            <span className="tl-t">{s.t}</span>
            <span className="tl-s">{s.s}</span>
            {s.sub && <span className="tl-sub">{s.sub}</span>}
          </li>
        ))}
      </ol>

      {open && (
        <div className="more">
          <div className="facts">
            <span>{d.startsHere ? "Starts here" : <>Arrives <b>{clock(d.arr)}</b> · halt <b>{Math.max(0, d.dep - d.arr)} min</b></>}</span>
            {d.reach != null && <span>Journey <b>{duration(d.reach - d.srcDep)}</b></span>}
            <span><b>{stops.length}</b> stops in Tamil Nadu</span>
          </div>
          {upcoming ? (
            <div className="remind">
              <span className="remind-k">Remind me when booking opens</span>
              <div className="remind-row">
                <a className="rbtn" href={googleCalendarUrl(reminder())} target="_blank" rel="noreferrer">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
                  Google Calendar
                </a>
                <button type="button" className="rbtn" onClick={downloadIcs}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M5 3 2 6M22 6l-3-3" /></svg>
                  Phone alarm
                </button>
                <button type="button" className="rbtn" onClick={share}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v14" /></svg>
                  {shared ?? "Share"}
                </button>
              </div>
              <span className="remind-note">Phone alarm adds a calendar event that alerts 10 min before and when booking opens.</span>
            </div>
          ) : (
            <p className="remind-note">{st.kind === "open" ? "Current booking is open now. Book on IRCTC." : "This train has left."}</p>
          )}
          <div className="stops">
            {stops.map((x) => (
              <span key={x.station.code} className={x.station.code === here.code ? "me" : ""}>
                {shortName(x.station.name)}<code>{clock(x.dep >= 0 ? x.dep : x.arr)}</code>
              </span>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

export default memo(TrainCard);
