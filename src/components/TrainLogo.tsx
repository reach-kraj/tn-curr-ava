/**
 * App logo: an electric locomotive in side profile, in the platform-board yellow.
 * (The favicon, src/app/icon.svg, is the same engine seen straight on, which reads better at 16px.)
 */
export default function TrainLogo({ height = 26 }: { height?: number }) {
  return (
    <svg className="train-logo" height={height} width={(height * 56) / 30} viewBox="0 0 56 30" aria-hidden="true" focusable="false">
      {/* pantograph */}
      <path d="M22 5.5 27 1.5h7M27 1.5 31 5.5" fill="none" stroke="#111" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="19" y="5" width="16" height="2" rx="1" fill="#111" />
      {/* body with a sloped cab nose at the front (right) */}
      <path d="M4 8.5a2 2 0 0 1 2-2h38.5c1.6 0 3 .9 3.7 2.3l3.6 7.4c.4.8.7 1.7.7 2.6V21a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" fill="#ffd31a" stroke="#111" strokeWidth="2" strokeLinejoin="round" />
      {/* cab windscreen + side windows */}
      <path d="M43.5 9.5h1.4c.7 0 1.3.4 1.6 1l2.4 5h-5.4Z" fill="#1b2230" />
      <rect x="8" y="10" width="6" height="4.5" rx="1" fill="#1b2230" />
      <rect x="16.5" y="10" width="6" height="4.5" rx="1" fill="#1b2230" />
      <rect x="25" y="10" width="6" height="4.5" rx="1" fill="#1b2230" />
      <rect x="34.5" y="9.5" width="5.5" height="9" rx="1" fill="none" stroke="#111" strokeWidth="1.3" />
      {/* livery stripe + headlight */}
      <rect x="4.8" y="17" width="29" height="1.6" fill="#111" />
      <circle cx="50.6" cy="19.2" r="1.3" fill="#fff" stroke="#111" strokeWidth="1" />
      {/* bogies and wheels */}
      <rect x="7" y="23" width="14" height="2.2" rx="1.1" fill="#111" />
      <rect x="33" y="23" width="14" height="2.2" rx="1.1" fill="#111" />
      <circle cx="10.5" cy="26.5" r="2.6" fill="#fff" stroke="#111" strokeWidth="1.6" />
      <circle cx="17.5" cy="26.5" r="2.6" fill="#fff" stroke="#111" strokeWidth="1.6" />
      <circle cx="36.5" cy="26.5" r="2.6" fill="#fff" stroke="#111" strokeWidth="1.6" />
      <circle cx="43.5" cy="26.5" r="2.6" fill="#fff" stroke="#111" strokeWidth="1.6" />
      {/* rail */}
      <rect x="1" y="29" width="54" height="1" rx="0.5" fill="#111" opacity="0.35" />
    </svg>
  );
}
