"use client";

import { useEffect, useRef, useState } from "react";

const UPI_ID = "kraj280597@oksbi";
const PAYEE = "Karthickraj Gangadharan";
// encodeURIComponent (not URLSearchParams) so spaces become %20: some UPI apps show "+" literally
const UPI_LINK = `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(PAYEE)}&cu=INR&tn=${encodeURIComponent("Coffee for TN Train Booking")}`;

/** "Buy me a coffee": a modal with the UPI QR code, a deep link to UPI apps and a copyable UPI ID. */
export default function CoffeeDialog({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onClose = () => setOpen(false);
    d.addEventListener("close", onClose);
    return () => d.removeEventListener("close", onClose);
  }, []);

  const show = () => { setOpen(true); ref.current?.showModal(); };
  const copy = async () => {
    try { await navigator.clipboard.writeText(UPI_ID); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); }
  };

  return (
    <>
      <button type="button" className={`coffee-btn ${className}`} onClick={show} aria-haspopup="dialog">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z" /><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17M8 2.5c-.6.9.6 1.6 0 2.5M12 2.5c-.6.9.6 1.6 0 2.5" /></svg>
        Buy me a coffee
      </button>

      <dialog ref={ref} className="coffee" aria-labelledby="coffee-title" onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
        <div className="coffee-in">
          <button type="button" className="coffee-x" onClick={() => ref.current?.close()} aria-label="Close">×</button>
          <span className="coffee-k">Enjoying the ride?</span>
          <h2 id="coffee-title">Buy me a coffee</h2>
          <p className="coffee-sub">Scan with any UPI app: Google Pay, PhonePe, Paytm or your bank app.</p>
          {open && (
            // eslint-disable-next-line @next/next/no-img-element -- static export; plain image is fine here
            <img className="coffee-qr" src="/coffee-qr.png" width={720} height={1000} alt={`UPI QR code to pay ${PAYEE}, UPI ID ${UPI_ID}`} />
          )}
          <a className="coffee-pay" href={UPI_LINK}>
            Open UPI app
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </a>
          <p className="coffee-note">On a phone this opens your UPI app with the details filled in. On a computer, scan the QR code instead.</p>
          <div className="coffee-id">
            <span>UPI ID</span>
            <code>{UPI_ID}</code>
            <button type="button" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
          </div>
          <span className="sr-only" aria-live="polite">{copied ? "UPI ID copied" : ""}</span>
        </div>
      </dialog>
    </>
  );
}
