"use client";

import { useEffect, useRef, useState } from "react";

const IRCTC_WEB = "https://www.irctc.co.in/nget/train-search";

/**
 * Official booking apps. Android: an intent link opens the app if installed, otherwise Chrome follows
 * the fallback to the Play Store page. iOS: web pages can't detect installed apps, so we open the
 * App Store page, which shows "Open" if the app is already installed and "Get" if not.
 */
const APPS = [
  {
    id: "railone", name: "RailOne", by: "Indian Railways (CRIS) · official all-in-one app",
    android: "org.cris.aikyam", ios: "https://apps.apple.com/in/app/railone/id6473384334",
  },
  {
    id: "irctc", name: "IRCTC Rail Connect", by: "IRCTC · official booking app",
    android: "cris.org.in.prs.ima", ios: "https://apps.apple.com/in/app/irctc-rail-connect/id1386197253",
  },
];

type Platform = "android" | "ios" | "desktop";
function detect(): Platform {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "android";
  // iPadOS reports itself as a Mac, so also check for touch
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  return "desktop";
}
const playStore = (pkg: string) => `https://play.google.com/store/apps/details?id=${pkg}`;
const androidIntent = (pkg: string) =>
  `intent://#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=${pkg};S.browser_fallback_url=${encodeURIComponent(playStore(pkg))};end`;

export default function BookButton({ label = "Book now", size = "md", className = "" }: { label?: string; size?: "sm" | "md"; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [platform, setPlatform] = useState<Platform>("desktop");
  useEffect(() => { setPlatform(detect()); }, []); // eslint-disable-line react-hooks/set-state-in-effect -- read the device once on the client

  const onClick = () => {
    const p = detect();
    setPlatform(p);
    if (p === "desktop") window.open(IRCTC_WEB, "_blank", "noopener");
    else ref.current?.showModal();
  };

  return (
    <>
      <button type="button" className={`book-btn book-${size} ${className}`} onClick={onClick}
        aria-haspopup={platform === "desktop" ? undefined : "dialog"}>
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9a2 2 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a2 2 0 0 0 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1Z" /><path d="M14 5v2M14 11v2M14 17v2" /></svg>
        {label}
        {platform === "desktop" && <span className="sr-only"> (opens IRCTC in a new tab)</span>}
      </button>

      <dialog ref={ref} className="book-sheet" aria-labelledby="book-title" onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
        <div className="book-in">
          <span className="book-grip" aria-hidden="true" />
          <div className="book-head">
            <h2 id="book-title">Book on…</h2>
            <button type="button" className="coffee-x" onClick={() => ref.current?.close()} aria-label="Close">×</button>
          </div>
          <ul className="book-list">
            {APPS.map((a) => (
              <li key={a.id}>
                <a className="book-opt" href={platform === "android" ? androidIntent(a.android) : a.ios}
                  target={platform === "ios" ? "_blank" : undefined} rel="noreferrer">
                  <span className="book-ico" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M10.5 18.5h3" /></svg>
                  </span>
                  <span className="book-text"><b>{a.name}</b><small>{a.by}</small></span>
                  <span className="book-go">Open app</span>
                </a>
              </li>
            ))}
            <li>
              <a className="book-opt" href={IRCTC_WEB} target="_blank" rel="noreferrer">
                <span className="book-ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>
                </span>
                <span className="book-text"><b>IRCTC website</b><small>Book in the browser, no app needed</small></span>
                <span className="book-go">Open</span>
              </a>
            </li>
          </ul>
          <p className="book-note">
            {platform === "android"
              ? "If the app isn’t installed, Google Play opens so you can install it."
              : "If the app isn’t installed, the App Store page opens: tap Get to install it, or Open if you already have it."}
          </p>
        </div>
      </dialog>
    </>
  );
}
