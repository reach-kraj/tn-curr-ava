"use client";

import { useId, useMemo, useState } from "react";
import type { Dataset, Station, TrainStop } from "@/lib/types";
import { onwardCodes } from "@/lib/filters";
import { DOW, MON, addDays, duration, clock, clockAt, dayDiff, dayLabel, departures, istDay, istInstant, istParts, shortName, todayIst } from "@/lib/booking";
import { ARP_DAYS, advanceOpens, breaks, lastBookable, openState, tatkalOpens, type Break, type OpenState } from "@/lib/advance";
import { HOLIDAYS, HOLIDAY_SOURCE } from "@/lib/holidays";
import { downloadIcs, eventGoogleUrl, eventIcs, type EventInput } from "@/lib/reminders";

interface Props {
  data: Dataset;
  sel: Station;
  now: number;
  stationName: (code: string) => string;
  onRoute: (ti: number | null) => void;
  /** optional destination: only trains that go there */
  to: string;
  stopsOf: (ti: number) => TrainStop[];
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

export default function AdvancePlanner({ data, sel, now, stationName, onRoute, to, stopsOf }: Props) {
  const today = todayIst(now);
  const list = useMemo(() => breaks(HOLIDAYS, today), [today]);
  // default: the journey date whose booking opens today
  const [journey, setJourney] = useState(() => lastBookable(today));
  const [ti, setTi] = useState<number | null>(null);
  const formId = useId();

  const trains = useMemo(
    () => departures(data, sel.code, journey, "10", { reservedOnly: true, runningOnly: true, query: "" })
      .filter((d) => !to || onwardCodes(d, stopsOf(d.ti)).includes(to)),
    [data, sel.code, journey, to, stopsOf],
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

  const todayOpened = now >= advanceOpens(lastBookable(today));

  const pickTrain = (v: string) => {
    const n = v === "" ? null : Number(v);
    setTi(n);
    onRoute(n);
  };
  const plan = (day: string) => {
    setJourney(day); setTi(null); onRoute(null);
    document.getElementById(`${formId}-train`)?.focus({ preventScroll: true });
    document.getElementById(`${formId}-result`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  return (
    <div className="adv">
      <section className="today-card" aria-label="Opening today">
        <DateTile day={lastBookable(today)} big />
        <div className="today-text">
          <span className="today-k">Today · {dayLabel(today)}</span>
          <b>Booking opens for journeys on {longDay(lastBookable(today))}</b>
          <span className="today-time">
            8:00 AM IST · <span className={todayOpened ? "open" : "soon"}>{todayOpened ? "open now" : `in ${duration(advanceOpens(lastBookable(today)) - now)}`}</span>
          </span>
          <span className="today-next">Tomorrow 8:00 AM: journeys on {longDay(lastBookable(addDays(today, 1)))}</span>
        </div>
        <button type="button" className="today-plan" onClick={() => plan(lastBookable(today))}>Pick a train</button>
      </section>
      <p className="adv-window">
        Rule: booking opens <b>{ARP_DAYS} days</b> before the journey date (the day the train leaves its first station), at <b>8:00 AM IST</b>.
      </p>

      <section className="planner" aria-labelledby={`${formId}-h`}>
        <h3 id={`${formId}-h`}>When can I book?</h3>
        <div className="planner-form">
          <label htmlFor={`${formId}-date`}>
            <span>Journey date from {shortName(sel.name)}</span>
            <input id={`${formId}-date`} type="date" value={journey} min={today} onChange={(e) => { if (e.target.value) { setJourney(e.target.value); setTi(null); onRoute(null); } }} />
          </label>
          <label htmlFor={`${formId}-train`}>
            <span>Train{to ? ` to ${shortName(stationName(to))}` : ""} (optional)</span>
            <select id={`${formId}-train`} value={ti ?? ""} onChange={(e) => pickTrain(e.target.value)}>
              <option value="">{trains.length ? "Any train starting that day" : to ? `No train to ${shortName(stationName(to))} that day` : "No reserved train that day"}</option>
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

function TripButton({ kind, hint, day, now, today, onPlan }: { kind: string; hint: string; day: string; now: number; today: string; onPlan: (d: string) => void }) {
  const st = stateText(openState(day, now, today));
  const opensOn = istDay(advanceOpens(day));
  return (
    <button type="button" className="trip" onClick={() => onPlan(day)}
      aria-label={`${kind} ${hint} on ${longDay(day)}. ${st.cls === "open" ? "Booking is open" : `Booking opens ${longDay(opensOn)} at 8 AM`}. Plan this.`}>
      <span className="trip-k">{kind} <small>{hint}</small></span>
      <span className="trip-day">{dayLabel(day)}</span>
      <span className={`trip-s ${st.cls}`}>{st.cls === "open" ? "booking open" : `books ${dayLabel(opensOn)}`}</span>
    </button>
  );
}

function FestRow({ b, now, today, onPlan, active }: { b: Break; now: number; today: string; onPlan: (d: string) => void; active: boolean }) {
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
        <div className="fest-trips" role="group" aria-label={`Travel options for ${pub[0]?.name ?? "this holiday"}`}>
          <TripButton kind="Go" hint="day before" day={b.go} now={now} today={today} onPlan={onPlan} />
          <TripButton kind="Return" hint={b.days === 1 ? "same day" : "last day"} day={b.back} now={now} today={today} onPlan={onPlan} />
          <TripButton kind="Return" hint="day after" day={b.after} now={now} today={today} onPlan={onPlan} />
        </div>
        {b.leave.map((l) => (
          <div key={l.day} className="leave-tip">
            <span className="leave-badge">+1 leave</span>
            <span className="leave-text">
              Take <b>{dayLabel(l.day)}</b> off and get <b>{l.days} days</b>: {dayLabel(l.start)} – {dayLabel(l.end)}
            </span>
            <button type="button" className="linkbtn" onClick={() => onPlan(addDays(l.start, -1))}
              aria-label={`Plan going on ${longDay(addDays(l.start, -1))} for the ${l.days}-day break`}>
              Go {dayLabel(addDays(l.start, -1))}
            </button>
          </div>
        ))}
      </div>
    </li>
  );
}
