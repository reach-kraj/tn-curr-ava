"use client";

import { useId, useMemo, useState } from "react";
import type { Dataset, Station } from "@/lib/types";
import { DOW, MON, clock, clockAt, dayDiff, dayLabel, departures, istDay, istInstant, istParts, shortName, todayIst } from "@/lib/booking";
import { ARP_DAYS, advanceOpens, breaks, lastBookable, openState, tatkalOpens, type Break, type OpenState } from "@/lib/advance";
import { HOLIDAYS, HOLIDAY_SOURCE } from "@/lib/holidays";
import { downloadIcs, eventGoogleUrl, eventIcs, type EventInput } from "@/lib/reminders";

interface Props {
  data: Dataset;
  sel: Station;
  now: number;
  stationName: (code: string) => string;
  onRoute: (ti: number | null) => void;
}

const longDay = (day: string) => { const p = istParts(istInstant(day, 0)); return `${DOW[p.dow]} ${p.d} ${MON[p.m - 1]} ${p.y}`; };

function stateText(s: OpenState) {
  if (s.kind === "open") return { cls: "open", text: "Booking is open" };
  if (s.kind === "today-later") return { cls: "soon", text: "Opens today at 8:00 AM" };
  if (s.kind === "past") return { cls: "gone", text: "Journey date has passed" };
  return { cls: "soon", text: s.days === 1 ? "Opens tomorrow" : `Opens in ${s.days} days` };
}

/** A small calendar-page tile for a date. */
function DateTile({ day, big = false }: { day: string; big?: boolean }) {
  const p = istParts(istInstant(day, 0));
  return (
    <span className={`dtile${big ? " big" : ""}`} aria-hidden="true">
      <span className="dtile-m">{MON[p.m - 1]}</span>
      <span className="dtile-d">{p.d}</span>
      <span className="dtile-w">{DOW[p.dow]}</span>
    </span>
  );
}

export default function AdvancePlanner({ data, sel, now, stationName, onRoute }: Props) {
  const today = todayIst(now);
  const list = useMemo(() => breaks(HOLIDAYS, today), [today]);
  const [journey, setJourney] = useState(() => list.find((b) => b.go >= today)?.go ?? lastBookable(today));
  const [ti, setTi] = useState<number | null>(null);
  const formId = useId();

  const trains = useMemo(
    () => departures(data, sel.code, journey, "10", { reservedOnly: true, runningOnly: true, query: "" }),
    [data, sel.code, journey],
  );
  const chosen = trains.find((d) => d.ti === ti) ?? null;
  const originDay = chosen ? chosen.originDay : journey;
  const opens = advanceOpens(originDay);
  const state = openState(originDay, now, today);
  const st = stateText(state);
  const openDay = istDay(opens);

  const event = (): EventInput => ({
    uid: `arp-${chosen?.num ?? "any"}-${originDay}`,
    title: `Advance booking opens${chosen ? ` · ${chosen.num} ${chosen.name}` : ""} · journey ${dayLabel(journey)}`,
    body: [
      `Advance reservation for journey on ${longDay(journey)}${chosen ? ` by ${chosen.num} ${chosen.name} (${stationName(chosen.orig)} → ${stationName(chosen.dest)}), boarding at ${shortName(sel.name)} ${clock(chosen.dep)}` : ` from ${shortName(sel.name)}`} opens at 8:00 AM IST on ${longDay(openDay)}.`,
      `Book: https://www.irctc.co.in/nget/train-search`,
    ].join("\n"),
    start: opens,
    location: `${shortName(sel.name)} railway station`,
    alarm: `Advance booking${chosen ? ` for ${chosen.num}` : ""} opens`,
  });

  const pickTrain = (v: string) => {
    const n = v === "" ? null : Number(v);
    setTi(n);
    onRoute(n);
  };
  const plan = (day: string) => {
    setJourney(day); setTi(null); onRoute(null);
    document.getElementById(`${formId}-result`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  return (
    <div className="adv">
      <p className="adv-window">
        Booking opens <b>{ARP_DAYS} days</b> before the journey date at <b>8:00 AM IST</b>. Today you can book journeys up to <b>{longDay(lastBookable(today))}</b>.
      </p>

      <section className="planner" aria-labelledby={`${formId}-h`}>
        <h3 id={`${formId}-h`}>When can I book?</h3>
        <div className="planner-form">
          <label htmlFor={`${formId}-date`}>
            <span>Journey date from {shortName(sel.name)}</span>
            <input id={`${formId}-date`} type="date" value={journey} min={today} onChange={(e) => { if (e.target.value) { setJourney(e.target.value); setTi(null); onRoute(null); } }} />
          </label>
          <label htmlFor={`${formId}-train`}>
            <span>Train (optional)</span>
            <select id={`${formId}-train`} value={ti ?? ""} onChange={(e) => pickTrain(e.target.value)}>
              <option value="">Any train starting that day</option>
              {trains.map((d) => (
                <option key={d.ti} value={d.ti}>{clock(d.dep)} · {d.num} {d.name} · {shortName(stationName(d.orig))} → {shortName(stationName(d.dest))}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="planner-result" id={`${formId}-result`} aria-live="polite">
          <DateTile day={openDay} big />
          <div className="pr-text">
            <span className="pr-k">Advance booking opens</span>
            <b className="pr-date">{longDay(openDay)}</b>
            <span className="pr-time">8:00 AM IST</span>
            <span className={`pr-state ${st.cls}`}>{st.text}</span>
          </div>
        </div>

        {chosen && chosen.originDay !== journey && (
          <p className="pr-note">
            {chosen.num} leaves {shortName(stationName(chosen.orig))} on <b>{dayLabel(chosen.originDay)}</b> at {clockAt(chosen.srcDep)}. Booking follows the day the train starts, so it opens a day earlier than you might expect.
          </p>
        )}
        {!chosen && <p className="pr-note">Choose a train to be exact: a train you board after midnight follows the day it left its first station.</p>}

        <dl className="pr-facts">
          <div><dt>Tatkal (AC)</dt><dd>{dayLabel(istDay(tatkalOpens(originDay, true)))} · 10:00 AM</dd></div>
          <div><dt>Tatkal (non-AC)</dt><dd>{dayLabel(istDay(tatkalOpens(originDay, false)))} · 11:00 AM</dd></div>
        </dl>

        {(state.kind === "future" || state.kind === "today-later") && (
          <div className="remind">
            <span className="remind-k">Remind me when booking opens</span>
            <div className="remind-row">
              <a className="rbtn" href={eventGoogleUrl(event())} target="_blank" rel="noreferrer">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
                Google Calendar<span className="sr-only"> (opens in a new tab)</span>
              </a>
              <button type="button" className="rbtn" onClick={() => downloadIcs(eventIcs(event()), `advance-booking-${chosen?.num ?? "trip"}-${journey}.ics`)}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M5 3 2 6M22 6l-3-3" /></svg>
                Phone alarm
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="fest" aria-labelledby={`${formId}-fh`}>
        <h3 className="sec-h" id={`${formId}-fh`}><span>Festivals &amp; holidays</span><small>Tamil Nadu · long weekends</small><b>{list.length}</b></h3>
        <ul className="fest-list">
          {list.map((b) => <FestRow key={b.start} b={b} now={now} today={today} onPlan={plan} active={journey === b.go || journey === b.back} />)}
        </ul>
        <p className="fest-src">Dates: {HOLIDAY_SOURCE}. Weekends count as days off (state offices close on all Saturdays and Sundays). Islamic festival dates depend on the moon. Bhogi is a travel day, not a public holiday.</p>
      </section>
    </div>
  );
}

function FestRow({ b, now, today, onPlan, active }: { b: Break; now: number; today: string; onPlan: (d: string) => void; active: boolean }) {
  const go = stateText(openState(b.go, now, today));
  const back = stateText(openState(b.back, now, today));
  const pub = b.holidays.filter((h) => h.kind === "public");
  const extra = b.holidays.filter((h) => h.kind === "festival");
  const span = b.days === 1 ? dayLabel(b.start) : `${dayLabel(b.start)} – ${dayLabel(b.end)}`;
  const inDays = dayDiff(today, b.start);
  return (
    <li className={`fest-row${active ? " on" : ""}`}>
      <DateTile day={pub[0]?.date ?? b.start} />
      <div className="fest-main">
        <b>{pub.map((h) => h.name).join(" · ")}</b>
        <span className="fest-span">
          {span}
          {b.days > 1 && <em className="fest-long">{b.days}-day break</em>}
          <span className="fest-in">{inDays === 0 ? "today" : `in ${inDays} days`}</span>
        </span>
        {extra.length > 0 && <span className="fest-extra">{extra.map((h) => `${h.name} ${dayLabel(h.date)}`).join(" · ")}</span>}
        <div className="fest-trips">
          <button type="button" className="trip" onClick={() => onPlan(b.go)} aria-label={`Plan going on ${longDay(b.go)}: ${go.text}, booking opens ${longDay(istDay(advanceOpens(b.go)))}`}>
            <span className="trip-top"><span className="trip-k">Go</span>{dayLabel(b.go)}</span>
            <span className={`trip-s ${go.cls}`}>{go.cls === "open" ? "booking open" : `books ${dayLabel(istDay(advanceOpens(b.go)))}`}</span>
          </button>
          <button type="button" className="trip" onClick={() => onPlan(b.back)} aria-label={`Plan returning on ${longDay(b.back)}: ${back.text}, booking opens ${longDay(istDay(advanceOpens(b.back)))}`}>
            <span className="trip-top"><span className="trip-k">Return</span>{dayLabel(b.back)}</span>
            <span className={`trip-s ${back.cls}`}>{back.cls === "open" ? "booking open" : `books ${dayLabel(istDay(advanceOpens(b.back)))}`}</span>
          </button>
        </div>
      </div>
    </li>
  );
}
