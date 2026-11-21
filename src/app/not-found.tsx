import type { Metadata } from "next";
import Link from "next/link";
import TrainLogo from "@/components/TrainLogo";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

/** 404: the train waits at a red signal, puffing smoke. */
export default function NotFound() {
  return (
    <main className="nf">
      <div className="nf-scene" aria-hidden="true">
        <div className="nf-signal">
          <span className="nf-head"><i className="g" /><i className="y" /><i className="r" /></span>
          <span className="nf-post" />
        </div>
        <div className="nf-train">
          <span className="puff p1" /><span className="puff p2" /><span className="puff p3" /><span className="puff p4" />
          <TrainLogo height={64} />
        </div>
        <div className="nf-track" />
      </div>
      <p className="nf-code">404 · Signal at danger</p>
      <h1>This page isn’t on our line</h1>
      <p className="nf-text">The link may be old or mistyped. The train is waiting at the signal; head back to the departures board.</p>
      <Link className="go-btn nf-btn" href="/">Back to departures</Link>
    </main>
  );
}
