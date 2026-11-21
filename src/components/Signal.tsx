/**
 * A three-aspect colour-light railway signal used as a status light:
 *   green  = proceed  → booking / current availability is open
 *   yellow = caution  → it opens later
 *   red    = stop     → departed or the date has passed
 * Lamps stacked green / yellow / red from the top, as on Indian Railways colour-light signals.
 * Decorative: the status is always also given in text next to it.
 */
export type Aspect = "open" | "soon" | "gone";

export default function Signal({ aspect, size = "sm" }: { aspect: Aspect; size?: "sm" | "md" }) {
  return (
    <span className={`signal signal-${size} aspect-${aspect}`} aria-hidden="true">
      <i className="lamp g" />
      <i className="lamp y" />
      <i className="lamp r" />
    </span>
  );
}
