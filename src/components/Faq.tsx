import { FAQS } from "@/lib/faq";

/** FAQ, rendered into the static HTML (also published as FAQPage structured data in the layout). */
export default function Faq() {
  return (
    <section className="wrap faq" aria-labelledby="faq-h">
      <div className="faq-head">
        <span className="faq-k">Help</span>
        <h2 id="faq-h">Questions people ask</h2>
      </div>
      <div className="faq-list">
        {FAQS.map((f, i) => (
          <details key={f.q} className="faq-item" open={i === 0}>
            <summary>
              <span>{f.q}</span>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
            </summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
