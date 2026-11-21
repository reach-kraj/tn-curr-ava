import TrainLogo from "./TrainLogo";

/** Loading screen: the engine rolls along the track while the timetable downloads. */
export default function TrainLoader({ label = "Loading the Tamil Nadu timetable…", compact = false }: { label?: string; compact?: boolean }) {
  return (
    <div className={`loader${compact ? " compact" : ""}`} role="status" aria-live="polite">
      <div className="loader-scene" aria-hidden="true">
        <span className="loader-signal"><i /><i /><i /></span>
        <div className="loader-train">
          <span className="puff p1" /><span className="puff p2" /><span className="puff p3" />
          <TrainLogo height={46} />
        </div>
        <div className="loader-track" />
      </div>
      <p className="loader-text">{label}</p>
      {!compact && <p className="loader-sub">Checking 549 stations and 1,700+ trains</p>}
    </div>
  );
}
