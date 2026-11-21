import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-static";
export const alt = `${SITE_NAME}: when booking opens for Tamil Nadu trains`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Share preview (WhatsApp, X, LinkedIn…): the platform nameboard over a railway track. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "70px 80px", background: "linear-gradient(180deg, #eef3fc 0%, #f4f6fb 100%)", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", alignSelf: "flex-start", background: "#ffd31a", border: "8px solid #111", borderRadius: 14, padding: "22px 40px 28px", boxShadow: "0 12px 0 -4px #111" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, fontWeight: 700, letterSpacing: 4, color: "#111" }}>
            <span>TAMIL NADU</span><span style={{ marginLeft: 120 }}>549 STATIONS</span>
          </div>
          <div style={{ fontSize: 96, fontWeight: 800, color: "#111", lineHeight: 1 }}>BOGIEY</div>
        </div>
        <div style={{ marginTop: 56, fontSize: 52, fontWeight: 800, color: "#0f1a2a", lineHeight: 1.15 }}>Train timings and booking times</div>
        <div style={{ marginTop: 18, fontSize: 30, color: "#33404f" }}>When current availability, 60-day booking and Tatkal open, for every Tamil Nadu train</div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 54, height: 22, display: "flex", borderTop: "4px solid #8d99aa", borderBottom: "4px solid #8d99aa", background: "repeating-linear-gradient(90deg, #c5cdd8 0 10px, transparent 10px 30px)" }} />
      </div>
    ),
    size,
  );
}
