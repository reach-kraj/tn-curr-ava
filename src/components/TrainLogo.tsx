/** Front view of a locomotive in the platform-board yellow — the app's logo. */
export default function TrainLogo({ size = 30 }: { size?: number }) {
  return (
    <svg className="train-logo" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      {/* roof light */}
      <rect x="13" y="1.5" width="6" height="3" rx="1.5" fill="#111" />
      {/* body */}
      <path d="M8 5.5h16a3.5 3.5 0 0 1 3.5 3.5v14a2.5 2.5 0 0 1-2.5 2.5H7A2.5 2.5 0 0 1 4.5 23V9A3.5 3.5 0 0 1 8 5.5Z" fill="#ffd31a" stroke="#111" strokeWidth="2" strokeLinejoin="round" />
      {/* windscreen */}
      <path d="M8.5 9h15a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1Z" fill="#1b2230" />
      <path d="M10 10.5 13 10.5 11 14.5 9.5 14.5Z" fill="#fff" opacity="0.35" />
      {/* stripe and headlights */}
      <rect x="7.5" y="18" width="17" height="1.6" rx="0.8" fill="#111" />
      <circle cx="10" cy="22.2" r="1.7" fill="#fff" stroke="#111" strokeWidth="1.2" />
      <circle cx="22" cy="22.2" r="1.7" fill="#fff" stroke="#111" strokeWidth="1.2" />
      {/* cow-catcher */}
      <path d="M6 26.5h20l-2.5 3.5h-15Z" fill="#111" />
    </svg>
  );
}
