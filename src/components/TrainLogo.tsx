/**
 * App logo: an old steam locomotive in side profile, heading left, in ink and platform yellow.
 * (The favicon, src/app/icon.svg, is an engine seen straight on, which reads better at 16px.)
 */
export default function TrainLogo({ height = 30 }: { height?: number }) {
  return (
    <svg className="train-logo" height={height} width={(height * 66) / 36} viewBox="0 0 66 36" aria-hidden="true" focusable="false">
      {/* smoke */}
      <g className="smoke" fill="#c9d1dc">
        <circle cx="17" cy="4.5" r="2.6" />
        <circle cx="21.5" cy="2.8" r="2" opacity="0.8" />
        <circle cx="25.5" cy="2" r="1.5" opacity="0.6" />
      </g>
      {/* chimney (flared top) */}
      <path d="M12.5 7.5h6l-1 2h-0.8v5h-2.4v-5h-0.8Z" fill="#111" />
      {/* boiler */}
      <rect x="8" y="13.5" width="33" height="10" rx="5" fill="#1b2230" stroke="#111" strokeWidth="1.2" />
      <rect x="9" y="13.5" width="3" height="10" rx="1.5" fill="#111" />
      {/* steam dome + sand dome */}
      <path d="M25 13.6v-2.4a2.6 2.6 0 0 1 5.2 0v2.4Z" fill="#ffd31a" stroke="#111" strokeWidth="1.1" />
      <path d="M33.5 13.6v-1.6a1.9 1.9 0 0 1 3.8 0v1.6Z" fill="#1b2230" stroke="#111" strokeWidth="1" />
      {/* brass boiler bands */}
      <rect x="18" y="13.6" width="1.4" height="9.8" fill="#ffd31a" />
      <rect x="31" y="13.6" width="1.4" height="9.8" fill="#ffd31a" />
      {/* headlamp at the front (left) */}
      <rect x="5" y="11.5" width="3.6" height="3.2" rx="0.8" fill="#ffd31a" stroke="#111" strokeWidth="1" />
      <circle cx="5.6" cy="13.1" r="0.9" fill="#fff" />
      {/* cab */}
      <path d="M41 9h14v15H41Z" fill="#ffd31a" stroke="#111" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M39.5 8.2h17l-1 2h-15Z" fill="#111" />
      <rect x="44" y="11.5" width="7.5" height="5.5" rx="1" fill="#1b2230" />
      <rect x="41" y="19.5" width="14" height="1.3" fill="#111" />
      {/* footplate + cow-catcher */}
      <rect x="6" y="23.5" width="52" height="2.2" rx="1" fill="#111" />
      <path d="M6.5 23.5 1.5 30.5h7l1.5-7Z" fill="#111" />
      <path d="M3.4 28.2h4.6M4.8 26h3.6" stroke="#ffd31a" strokeWidth="0.8" />
      {/* wheels: leading, two big drivers, trailing */}
      <circle cx="12.5" cy="30" r="3" fill="#ffd31a" stroke="#111" strokeWidth="1.5" />
      <circle cx="12.5" cy="30" r="0.9" fill="#111" />
      <g className="drivers">
        <circle cx="24" cy="29" r="5" fill="#ffd31a" stroke="#111" strokeWidth="1.7" />
        <circle cx="35.5" cy="29" r="5" fill="#ffd31a" stroke="#111" strokeWidth="1.7" />
        <path d="M24 24.5v9M19.5 29h9M35.5 24.5v9M31 29h9" stroke="#111" strokeWidth="0.8" opacity="0.7" />
        <circle cx="24" cy="29" r="1.3" fill="#111" />
        <circle cx="35.5" cy="29" r="1.3" fill="#111" />
      </g>
      {/* connecting rod + piston */}
      <rect x="22.5" y="30.4" width="15" height="1.6" rx="0.8" fill="#111" />
      <rect x="14" y="26" width="7" height="2.6" rx="0.6" fill="#111" />
      <circle cx="49" cy="30" r="3.4" fill="#ffd31a" stroke="#111" strokeWidth="1.5" />
      <circle cx="49" cy="30" r="1" fill="#111" />
      {/* rail */}
      <rect x="0" y="34.6" width="66" height="1.2" rx="0.6" fill="#111" opacity="0.35" />
    </svg>
  );
}
