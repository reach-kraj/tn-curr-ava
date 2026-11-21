import { FAQS } from "@/lib/faq";

/**
 * FAQ folded into one compact bar. The text stays in the static HTML (and in the FAQPage
 * structured data), so search engines and answer engines still read it while people see one line.
 */
export default function Faq() {
  return (
    <section className="wrap faq" aria-labelledby="faq-h">
      <details className="faq-wrap">
        <summary>
          <span className="faq-ico" aria-hidden="true">?</span>
          <h2 id="faq-h">Questions people ask</h2>
          <span className="faq-n">{FAQS.length}</span>
          <svg className="faq-chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </summary>
        <div className="faq-list">
          {FAQS.map((f) => (
            <details key={f.q} className="faq-item">
              <summary>
                <span>{f.q}</span>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </details>
    </section>
  );
}
