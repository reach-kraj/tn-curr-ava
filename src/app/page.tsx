import { readFileSync } from "node:fs";
import { join } from "node:path";
import App from "@/components/App";
import Faq from "@/components/Faq";
import Footer from "@/components/Footer";
import { FAQS } from "@/lib/faq";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

// read once at build time so the footer and structured data are in the static HTML
const data = JSON.parse(readFileSync(join(process.cwd(), "public/data/tn.json"), "utf8")) as { feed: string; s: unknown[]; t: unknown[] };

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#app`,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      description: SITE_DESCRIPTION,
      applicationCategory: "TravelApplication",
      operatingSystem: "Any (web browser)",
      inLanguage: "en-IN",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
      areaServed: { "@type": "State", name: "Tamil Nadu", containedInPlace: { "@type": "Country", name: "India" } },
      featureList: [
        "Current availability opening time for every train at a station",
        "60-day advance booking date for any journey",
        "Tatkal opening times",
        "Tamil Nadu holidays and long weekends with booking dates",
        "Google Calendar and phone alarm reminders",
      ],
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ],
};

export default function Page() {
  return (
    <>
      {/* start downloading the timetable while the app code loads */}
      <link rel="preload" href="/data/tn.json" as="fetch" crossOrigin="anonymous" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <h1 className="sr-only">{SITE_NAME}: train timings and when current availability and advance booking open for Tamil Nadu trains</h1>
      <App />
      <Faq />
      <Footer feed={data.feed} stations={data.s.length} />
    </>
  );
}
