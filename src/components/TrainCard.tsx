"use client";

import { memo } from "react";
import FlapTime from "./FlapTime";
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
        <FlapTime value={clockAt(d.opens)} />
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
