/**
 * App logo: a modern diesel locomotive (WDP-4 / WDG-4 style) in side profile, heading left,
 * in platform yellow and ink. (The favicon, src/app/icon.svg, is an engine seen straight on.)
 */
export default function TrainLogo({ height = 28 }: { height?: number }) {
  return (
    <svg className="train-logo" height={height} width={(height * 68) / 32} viewBox="0 0 68 32" aria-hidden="true" focusable="false">
      {/* roof: exhaust stacks + radiator hump at the rear */}
      <rect x="33" y="5.2" width="2.4" height="2.6" rx="0.6" fill="#111" />
      <rect x="37" y="5.2" width="2.4" height="2.6" rx="0.6" fill="#111" />
      <path d="M46 7.8 47.5 5.6h11l1.5 2.2Z" fill="#1b2230" stroke="#111" strokeWidth="1" strokeLinejoin="round" />
      {/* body: sloped cab nose at the front (left) */}
      <path d="M3.5 23V15.6c0-.7.2-1.4.6-2l3.4-4.9c.6-.8 1.5-1.3 2.5-1.3H61a2.5 2.5 0 0 1 2.5 2.5V23Z" fill="#ffd31a" stroke="#111" strokeWidth="1.8" strokeLinejoin="round" />
      {/* cab windscreen + side window */}
      <path d="M6 15.2 9.3 10.4h3.4v4.8Z" fill="#1b2230" />
      <rect x="14.5" y="10.4" width="5" height="4.8" rx="0.8" fill="#1b2230" />
      <rect x="21.5" y="9.6" width="0.9" height="13" fill="#111" opacity="0.55" />
      {/* hood louvres */}
      <g stroke="#111" strokeWidth="0.9" strokeLinecap="round" opacity="0.75">
        <path d="M25.5 10.8v5.4M27.5 10.8v5.4M29.5 10.8v5.4M31.5 10.8v5.4M33.5 10.8v5.4" />
      </g>
      <rect x="37" y="10.4" width="6" height="6.2" rx="0.8" fill="none" stroke="#111" strokeWidth="1" />
      {/* radiator grille */}
      <rect x="46" y="10" width="14.5" height="6.6" rx="0.8" fill="#1b2230" />
      <path d="M48 10.6v5.4M50.5 10.6v5.4M53 10.6v5.4M55.5 10.6v5.4M58 10.6v5.4" stroke="#ffd31a" strokeWidth="0.7" opacity="0.6" />
      {/* livery stripe, headlight, marker light */}
      <rect x="4.4" y="18.4" width="58.2" height="1.8" fill="#111" />
      <rect x="2.2" y="16.2" width="2.6" height="2" rx="0.6" fill="#fff" stroke="#111" strokeWidth="0.8" />
      <circle cx="6.2" cy="21.6" r="0.8" fill="#e0412f" />
      {/* underframe, fuel tank */}
      <rect x="4" y="23" width="59" height="2" rx="0.8" fill="#111" />
      <rect x="24.5" y="25" width="19" height="3.6" rx="1.6" fill="#1b2230" stroke="#111" strokeWidth="1" />
      {/* two three-axle bogies */}
      <rect x="6" y="25" width="16" height="2" rx="0.8" fill="#111" />
      <rect x="45.5" y="25" width="16" height="2" rx="0.8" fill="#111" />
      {[9, 14, 19, 48.5, 53.5, 58.5].map((x) => (
        <g key={x}>
          <circle cx={x} cy="28.4" r="2.4" fill="#ffd31a" stroke="#111" strokeWidth="1.3" />
          <circle cx={x} cy="28.4" r="0.7" fill="#111" />
        </g>
      ))}
      {/* rail */}
      <rect x="0" y="31" width="68" height="1" rx="0.5" fill="#111" opacity="0.35" />
    </svg>
  );
}
