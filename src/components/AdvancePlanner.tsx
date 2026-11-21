"use client";

import { useId, useMemo, useState } from "react";
import type { Dataset, Station, TrainStop } from "@/lib/types";
import { onwardCodes } from "@/lib/filters";
import { DOW, MON, addDays, duration, clock, clockAt, dayDiff, dayLabel, departures, istDay, istInstant, istParts, shortName, todayIst } from "@/lib/booking";
import { ARP_DAYS, advanceOpens, breaks, lastBookable, longWeekends, openState, tatkalOpens, type Break, type LongWeekend, type OpenState } from "@/lib/advance";
import { HOLIDAYS, HOLIDAY_SOURCE } from "@/lib/holidays";
import { downloadIcs, eventGoogleUrl, eventIcs, type EventInput } from "@/lib/reminders";
import Signal from "./Signal";
import ThemedSelect from "./ThemedSelect";
import BookButton from "./BookButton";

const longDay = (day: string) => { const p = istParts(istInstant(day, 0)); return `${DOW[p.dow]} ${p.d} ${MON[p.m - 1]} ${p.y}`; };

function stateText(s: OpenState) {
  if (s.kind === "open") return { cls: "open", text: "Booking is open" };
  if (s.kind === "today-later") return { cls: "soon", text: "Opens today at 8:00 AM" };
  if (s.kind === "past") return { cls: "gone", text: "Journey date has passed" };
  return { cls: "soon", text: s.days === 1 ? "Opens tomorrow" : `Opens in ${s.days} days` };
}

/** A small calendar-page tile for a date. */
export function DateTile({ day, big = false }: { day: string; big?: boolean }) {
  const p = istParts(istInstant(day, 0));
  return (
    <span className={`dtile${big ? " big" : ""}`} aria-hidden="true">
      <span className="dtile-m">{MON[p.m - 1]}</span>
      <span className="dtile-d">{p.d}</span>
      <span className="dtile-w">{DOW[p.dow]}</span>
    </span>
  );
}

function CalendarIcon() {
  return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>;
}
function AlarmIcon() {
  return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M5 3 2 6M22 6l-3-3" /></svg>;
}

/* ================= Advance booking ================= */

interface PlannerProps {
  data: Dataset;
  sel: Station;
  now: number;
  stationName: (code: string) => string;
  /** optional destination: only trains that go there */
  to: string;
  stopsOf: (ti: number) => TrainStop[];
  journey: string;
  setJourney: (day: string) => void;
}

export default function AdvancePlanner({ data, sel, now, stationName, to, stopsOf, journey, setJourney }: PlannerProps) {
  const today = todayIst(now);
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
  const todayJourney = lastBookable(today);
  const todayOpened = now >= advanceOpens(todayJourney);

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

  return (
    <div className="adv">
      <section className="today-card" aria-label="Opening today">
        <DateTile day={todayJourney} big />
        <div className="today-text">
          <span className="today-k">Today · {dayLabel(today)}</span>
          <b>Booking opens for journeys on {longDay(todayJourney)}</b>
          <span className="today-time">
            8:00 AM IST · <span className={todayOpened ? "open" : "soon"}>{todayOpened ? "open now" : `in ${duration(advanceOpens(todayJourney) - now)}`}</span>
          </span>
          <span className="today-next">Tomorrow 8:00 AM: journeys on {longDay(lastBookable(addDays(today, 1)))}</span>
        </div>
        {journey !== todayJourney && (
          <button type="button" className="today-plan" onClick={() => { setJourney(todayJourney); setTi(null); }}>Check this date</button>
        )}
      </section>

      <section className="planner" aria-labelledby={`${formId}-h`}>
        <div className="planner-top">
          <h3 id={`${formId}-h`}>When can I book?</h3>
          <p className="planner-rule">{ARP_DAYS} days before the journey date, 8:00 AM IST</p>
        </div>
        <div className="planner-form">
          <label htmlFor={`${formId}-date`}>
            <span>Journey date from {shortName(sel.name)}</span>
            <input id={`${formId}-date`} type="date" value={journey} min={today} onChange={(e) => { if (e.target.value) { setJourney(e.target.value); setTi(null); } }} />
          </label>
          <div className="pf-field">
            <span id={`${formId}-train-l`}>Train{to ? ` to ${shortName(stationName(to))}` : ""} (optional)</span>
            <ThemedSelect
              id={`${formId}-train`} labelledBy={`${formId}-train-l`} value={ti == null ? "" : String(ti)}
              filterPlaceholder="Filter by number, name or station"
              onChange={(v) => setTi(v === "" ? null : Number(v))}
              options={[
                { value: "", label: trains.length ? "Any train starting that day" : to ? `No train to ${shortName(stationName(to))} that day` : "No reserved train that day" },
                ...trains.map((d) => ({
                  value: String(d.ti), meta: clock(d.dep), label: `${d.num} ${d.name}`,
                  sub: `${shortName(stationName(d.orig))} → ${shortName(stationName(d.dest))}`,
                })),
              ]}
            />
          </div>
        </div>

        <div className="planner-result" aria-live="polite">
          <DateTile day={openDay} big />
          <div className="pr-text">
            <span className="pr-k">Advance booking opens</span>
            <b className="pr-date">{longDay(openDay)}</b>
            <span className="pr-time">8:00 AM IST</span>
            <span className={`pr-state ${st.cls}`}><Signal aspect={st.cls as "open" | "soon" | "gone"} />{st.text}</span>
          </div>
          {state.kind === "open" && <BookButton label={chosen ? `Book ${chosen.num}` : "Book now"} className="pr-book" />}
        </div>

        {chosen && chosen.originDay !== journey ? (
          <p className="pr-note">
            {chosen.num} leaves {shortName(stationName(chosen.orig))} on <b>{dayLabel(chosen.originDay)}</b> at {clockAt(chosen.srcDep)}. Booking follows the day the train starts, so it opens a day earlier than you might expect.
          </p>
        ) : !chosen ? (
          <p className="pr-note">Choose a train to be exact: a train you board after midnight follows the day it left its first station.</p>
        ) : null}

        <dl className="pr-facts">
          <div><dt>Tatkal (AC)</dt><dd>{dayLabel(istDay(tatkalOpens(originDay, true)))} · 10:00 AM</dd></div>
          <div><dt>Tatkal (non-AC)</dt><dd>{dayLabel(istDay(tatkalOpens(originDay, false)))} · 11:00 AM</dd></div>
        </dl>

        {(state.kind === "future" || state.kind === "today-later") && (
          <div className="remind">
            <span className="remind-k">Remind me when booking opens</span>
            <div className="remind-row">
              <a className="rbtn" href={eventGoogleUrl(event())} target="_blank" rel="noreferrer">
                <CalendarIcon />Google Calendar<span className="sr-only"> (opens in a new tab)</span>
              </a>
              <button type="button" className="rbtn" onClick={() => downloadIcs(eventIcs(event()), `advance-booking-${chosen?.num ?? "trip"}-${journey}.ics`)}>
                <AlarmIcon />Phone alarm
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/* ================= Holidays & long weekends ================= */

export function HolidaysView({ now, onPlan, planned }: { now: number; onPlan: (day: string) => void; planned: string }) {
  const today = todayIst(now);
  const list = useMemo(() => breaks(HOLIDAYS, today), [today]);
  const weekends = useMemo(() => longWeekends(list), [list]);
  const id = useId();
  return (
    <div className="hol">
      <p className="hol-intro">Tap <b>Go</b> or <b>Return</b> to see exactly when booking opens for that day and train.</p>

      <section className="lw" aria-labelledby={`${id}-lh`}>
        <h3 className="sec-h" id={`${id}-lh`}><span>Long weekends</span><small>go the day before · return next morning</small><b>{weekends.length}</b></h3>
        <ul className="lw-list">
          {weekends.map((w) => <LongWeekendRow key={`${w.start}|${w.end}`} w={w} now={now} today={today} onPlan={onPlan} active={planned === w.go || planned === w.back} />)}
        </ul>
      </section>

      <section className="fest" aria-labelledby={`${id}-fh`}>
        <h3 className="sec-h" id={`${id}-fh`}><span>Festivals &amp; holidays</span><small>Tamil Nadu</small><b>{list.length}</b></h3>
        <ul className="fest-list">
          {list.map((b) => <FestRow key={b.start} b={b} now={now} today={today} onPlan={onPlan} active={planned === b.go || planned === b.back || planned === b.after} />)}
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
      aria-label={`${kind} ${hint} on ${longDay(day)}. ${st.cls === "open" ? "Booking is open" : `Booking opens ${longDay(opensOn)} at 8 AM`}. Check trains.`}>
      <span className="trip-k">{kind} <small>{hint}</small></span>
      <span className="trip-day">{dayLabel(day)}</span>
      <span className={`trip-s ${st.cls}`}><Signal aspect={st.cls as "open" | "soon" | "gone"} />{st.cls === "open" ? "booking open" : `books ${dayLabel(opensOn)}`}</span>
    </button>
  );
}

function LongWeekendRow({ w, now, today, onPlan, active }: { w: LongWeekend; now: number; today: string; onPlan: (d: string) => void; active: boolean }) {
  const inDays = dayDiff(today, w.start);
  const cells: { day: string; kind: "leave" | "off" }[] = [];
  for (let d = w.start; d <= w.end; d = addDays(d, 1)) cells.push({ day: d, kind: d === w.leaveDay ? "leave" : "off" });
  return (
    <li className={`lw-row${active ? " on" : ""}${w.leaveDay ? " needs-leave" : ""}`}>
      <div className="lw-head">
        <span className="lw-days"><b>{w.days}</b> days</span>
        <div className="lw-title">
          <b>{dayLabel(w.start)} – {dayLabel(w.end)}</b>
          <span>{w.names.join(" · ")} · <span className="fest-in">in {inDays} days</span></span>
        </div>
      </div>
      <ol className="lw-strip" aria-label={`Days off: ${cells.map((c) => `${dayLabel(c.day)}${c.kind === "leave" ? " (take leave)" : ""}`).join(", ")}`}>
        {cells.map((c) => {
          const p = istParts(istInstant(c.day, 0));
          return <li key={c.day} className={c.kind} aria-hidden="true"><span>{DOW[p.dow].slice(0, 2)}</span><b>{p.d}</b></li>;
        })}
      </ol>
      {w.leaveDay && <p className="lw-leave"><span className="leave-badge">+1 leave</span> Take <b>{dayLabel(w.leaveDay)}</b> off to get all {w.days} days.</p>}
      <div className="trips two" role="group" aria-label={`Travel for the ${w.days}-day weekend`}>
        <TripButton kind="Go" hint="day before" day={w.go} now={now} today={today} onPlan={onPlan} />
        <TripButton kind="Return" hint="next morning" day={w.back} now={now} today={today} onPlan={onPlan} />
      </div>
    </li>
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
        <div className="trips" role="group" aria-label={`Travel options for ${pub[0]?.name ?? "this holiday"}`}>
          <TripButton kind="Go" hint="day before" day={b.go} now={now} today={today} onPlan={onPlan} />
          <TripButton kind="Return" hint={b.days === 1 ? "same day" : "last day"} day={b.back} now={now} today={today} onPlan={onPlan} />
          <TripButton kind="Return" hint="day after" day={b.after} now={now} today={today} onPlan={onPlan} />
        </div>
        {b.leave.map((l) => (
          <div key={l.day} className="leave-tip">
            <span className="leave-badge">+1 leave</span>
            <span className="leave-text">Take <b>{dayLabel(l.day)}</b> off and get <b>{l.days} days</b>: {dayLabel(l.start)} – {dayLabel(l.end)}</span>
            <button type="button" className="linkbtn" onClick={() => onPlan(addDays(l.start, -1))}>Go {dayLabel(addDays(l.start, -1))}</button>
          </div>
        ))}
      </div>
    </li>
  );
}
