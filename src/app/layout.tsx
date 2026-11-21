import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Manrope } from "next/font/google";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

// only the weights the design uses: fewer font files to download
const display = Manrope({ subsets: ["latin"], variable: "--font-display", weight: ["700", "800"], display: "swap" });
const body = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["600", "700"], display: "swap", preload: false });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME}: when does booking open for Tamil Nadu trains?`, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "current availability", "current booking time", "train chart preparation time", "IRCTC current booking",
    "advance reservation 60 days", "Tatkal booking time", "Tamil Nadu trains", "Chennai trains", "Tambaram",
    "Chengalpattu", "Villupuram", "Madurai", "Pongal train booking", "Tamil Nadu holidays 2027", "long weekend trains",
  ],
  category: "travel",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website", locale: "en_IN", url: "/", siteName: SITE_NAME,
    title: `${SITE_NAME}: when does booking open for Tamil Nadu trains?`,
    description: SITE_DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: SITE_NAME, description: SITE_DESCRIPTION },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large" } },
  formatDetection: { telephone: false, address: false, email: false },
  appleWebApp: { capable: true, title: "TN Trains", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#ffd31a",
  colorScheme: "light",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
