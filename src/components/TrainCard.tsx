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

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * A compact one-row summary (a real <button> using the disclosure pattern) that expands into
 * the full details: split-flap time, timeline, running days, stops and reminders.
 */
function TrainCard({ d, here, travelDay, now, open, stops, stationName, onToggle, onHover }: Props) {
  const st = status(d, now);
  const detailsId = `train-${d.ti}`;
  const [shared, setShared] = useState<string | null>(null);
  const tag = (ms: number) => { const r = relDay(ms, travelDay); return r === "same day" ? "" : r; };

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

  const chipText = st.kind === "soon" ? `in ${duration(st.ms)}` : st.kind === "open" ? "Open now" : "Departed";
  const chipLong = st.kind === "soon" ? `Current availability opens in ${duration(st.ms)}` : st.kind === "open" ? "Current availability is open" : "Train has departed";
  const opensTag = tag(d.opens);

  const steps = [
    { cls: "is-open", t: clockAt(d.opens), s: "Current availability opens", sub: [opensTag, dayLabel(istDay(d.opens))].filter(Boolean).join(" · ") },
    ...(d.startsHere ? [] : [{ cls: "", t: clockAt(d.srcDep), s: `Leaves ${shortName(stationName(d.orig))}`, sub: tag(d.srcDep) }]),
    { cls: "is-here", t: clock(d.dep), s: `Departs ${shortName(here.name)}`, sub: "" },
    ...(d.reach != null ? [{ cls: "", t: clockAt(d.reach), s: `Reaches ${shortName(stationName(d.dest))}`, sub: tag(d.reach) }] : []),
  ];

  return (
    <article
      className={`card st-${st.kind}${open ? " on" : ""}${d.runs ? "" : " dim"}`}
      data-ti={d.ti}
      onMouseEnter={() => onHover(d.ti)}
      onMouseLeave={() => onHover(null)}
    >
      <button type="button" className="row" aria-expanded={open} aria-controls={detailsId} onClick={() => onToggle(d.ti)}>
        <span className="row-time">
          <b>{clock(d.dep)}</b>
          <small>{d.startsHere ? "starts here" : "departs"}</small>
        </span>
        <span className="row-main">
          <span className="row-name"><span className="tname">{d.name}</span><span className="tnum">{d.num}</span></span>
          <span className="row-route">
            <span>{shortName(stationName(d.orig))}</span>
            <svg viewBox="0 0 20 8" width="18" height="8" aria-hidden="true"><path d="M1 4h16m-4-3 4 3-4 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span>{shortName(stationName(d.dest))}</span>
            {!d.runs && <em> · not running this date</em>}
          </span>
        </span>
        <span className="row-open">
          <span className="sr-only">Current availability opens at</span>
          <FlapTime value={clockAt(d.opens)} size="sm" />
          <small className={`row-status ${st.kind}`} title={chipLong}>
            <span className="sr-only">{chipLong}{opensTag ? `, opens ${opensTag}` : ""}</span>
            <span aria-hidden="true">{chipText}{opensTag && st.kind !== "gone" ? <span className="row-day"> · {opensTag}</span> : null}</span>
          </small>
        </span>
        <svg className="chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>

      {open && (
        <div className="details" id={detailsId}>
          <ol className="tl" style={{ ["--n" as string]: steps.length }}>
            {steps.map((s, i) => (
              <li key={i} className={s.cls}>
                <span className="tl-t">{s.t}</span>
                <span className="tl-s">{s.s}</span>
                {s.sub && <span className="tl-sub">{s.sub}</span>}
              </li>
            ))}
          </ol>

          <div className="facts">
            <span>{d.startsHere ? "Starts here" : <>Arrives <b>{clock(d.arr)}</b> · halt <b>{Math.max(0, d.dep - d.arr)} min</b></>}</span>
            {d.reach != null && <span>Journey <b>{duration(d.reach - d.srcDep)}</b></span>}
            <span className="days" aria-label={`Runs on ${DAYS.filter((_, i) => (d.train[5] >> i) & 1).join(", ")}`}>
              {DAYS.map((l, i) => <i key={i} aria-hidden="true" className={(d.train[5] >> i) & 1 ? "y" : ""}>{l[0]}</i>)}
            </span>
          </div>

          {st.kind === "soon" ? (
            <div className="remind">
              <span className="remind-k">Remind me when current availability opens</span>
              <div className="remind-row">
                <a className="rbtn" href={googleCalendarUrl(reminder())} target="_blank" rel="noreferrer">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
                  Google Calendar<span className="sr-only"> (opens in a new tab)</span>
                </a>
                <button type="button" className="rbtn" onClick={downloadIcs}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M5 3 2 6M22 6l-3-3" /></svg>
                  Phone alarm
                </button>
                <button type="button" className="rbtn" onClick={share}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v14" /></svg>
                  <span aria-live="polite">{shared ?? "Share"}</span>
                </button>
              </div>
              <span className="remind-note">Phone alarm adds a calendar event that alerts 10 min before and when current availability opens.</span>
            </div>
          ) : (
            <p className="remind-note">{st.kind === "open" ? "Current availability is open now. Book on IRCTC before the train departs." : "This train has left."}</p>
          )}

          <div className="stops" aria-label={`${stops.length} stops in Tamil Nadu`}>
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
