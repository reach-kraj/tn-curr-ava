import type { Metadata } from "next";
import Link from "next/link";
import TrainLogo from "@/components/TrainLogo";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

/** 404: the signal ahead has blown out and is smoking; the train brakes and stops short of it. */
export default function NotFound() {
  return (
    <main className="nf">
      <div className="nf-scene" aria-hidden="true">
        <div className="nf-signal">
          <span className="nf-smoke s1" /><span className="nf-smoke s2" /><span className="nf-smoke s3" /><span className="nf-smoke s4" />
          <span className="nf-spark k1" /><span className="nf-spark k2" /><span className="nf-spark k3" />
          <span className="nf-head"><i className="g" /><i className="y" /><i className="r" /></span>
          <span className="nf-post" />
        </div>
        <div className="nf-train">
          <TrainLogo height={64} />
        </div>
        <div className="nf-track" />
      </div>
      <p className="nf-code">404 · Signal failure</p>
      <h1>This page isn’t on our line</h1>
      <p className="nf-text">The signal ahead has blown out, so the train has stopped. The link may be old or mistyped; head back to the departures board.</p>
      <Link className="go-btn nf-btn" href="/">Back to departures</Link>
    </main>
  );
}
