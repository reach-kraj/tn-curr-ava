/** A departure-board style split-flap readout. Each character re-flips when it changes. */
export default function FlapTime({ value, size = "md" }: { value: string; size?: "md" | "lg" }) {
  return (
    <span className={`flap flap-${size}`} aria-label={value}>
      {value.split("").map((ch, i) =>
        ch === " " ? (
          <span key={i} className="flap-gap" aria-hidden="true" />
        ) : (
          <span key={`${i}-${ch}`} className={`flap-cell${/[0-9]/.test(ch) ? "" : " flap-sym"}`} aria-hidden="true">
            {ch}
          </span>
        ),
      )}
    </span>
  );
}
