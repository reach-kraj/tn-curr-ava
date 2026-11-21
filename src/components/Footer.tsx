import TrainLogo from "./TrainLogo";
import CoffeeDialog from "./CoffeeDialog";
import { HOLIDAY_SOURCE } from "@/lib/holidays";

/** A passenger coach in side profile, matching the locomotive logo. */
function Coach() {
  return (
    <svg className="coach" height="22" viewBox="0 0 54 26" aria-hidden="true" focusable="false">
      <rect x="1" y="3" width="52" height="15" rx="3" fill="#fff" stroke="#111" strokeWidth="1.6" />
      <rect x="1.8" y="11.5" width="50.4" height="2" fill="#ffd31a" />
      {[6, 15, 24, 33, 42].map((x) => <rect key={x} x={x} y="6" width="6" height="4.2" rx="0.8" fill="#1b2230" />)}
      <rect x="2" y="18" width="50" height="1.8" fill="#111" />
      {[8, 14, 40, 46].map((x) => <circle key={x} cx={x} cy="22" r="2.3" fill="#ffd31a" stroke="#111" strokeWidth="1.2" />)}
    </svg>
  );
}

export default function Footer({ feed, stations }: { feed: string; stations: number }) {
  return (
    <footer className="site-foot">
      {/* as you scroll down, the train runs in from the right and stops at the buffer stop */}
      <div className="foot-track" aria-hidden="true">
        <div className="wrap foot-train">
          <span className="buffer-stop" />
          <span className="foot-consist">
            <TrainLogo height={30} />
            <Coach /><Coach />
          </span>
        </div>
      </div>

      <div className="wrap foot-grid">
        <div className="foot-about">
          <span className="foot-brand"><TrainLogo height={22} /> TN Train Booking</span>
          <p>Know exactly when booking opens for Tamil Nadu trains: current availability, the 60-day advance booking window, Tatkal, and holidays worth travelling for.</p>
          <div className="foot-coffee">
            <span>Saved you a queue at the counter?</span>
            <CoffeeDialog />
          </div>
        </div>

        <nav className="foot-col" aria-label="Book and track">
          <h2>Book &amp; track</h2>
          <ul>
            <li><a href="https://www.irctc.co.in/nget/train-search" target="_blank" rel="noreferrer">Book on IRCTC</a></li>
            <li><a href="https://enquiry.indianrail.gov.in/mntes/" target="_blank" rel="noreferrer">Live running status (NTES)</a></li>
            <li><a href="https://www.indianrail.gov.in/enquiry/PNR/PnrEnquiry.html" target="_blank" rel="noreferrer">PNR status</a></li>
            <li><a href="https://railmadad.indianrailways.gov.in/" target="_blank" rel="noreferrer">Rail Madad (help &amp; complaints)</a></li>
            <li>Rail helpline <a href="tel:139">139</a></li>
          </ul>
        </nav>

        <div className="foot-col">
          <h2>About the data</h2>
          <ul>
            <li>Timetable: <a href="https://github.com/Neo2308/indianrailways-gtfs" target="_blank" rel="noreferrer">Indian Railways GTFS feed</a> (unofficial), version {feed}</li>
            <li>{stations} Tamil Nadu &amp; Puducherry stations</li>
            <li>Holidays: {HOLIDAY_SOURCE}</li>
            <li>Scheduled times, not live. EMU, MEMU, DEMU and passenger trains are unreserved.</li>
          </ul>
        </div>
      </div>

      <div className="wrap foot-bottom">
        <span>Not affiliated with Indian Railways, CRIS or IRCTC. Always confirm on IRCTC before you travel.</span>
        <span className="foot-made">Made in Tamil Nadu</span>
      </div>
    </footer>
  );
}
