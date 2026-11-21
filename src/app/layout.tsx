import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Manrope } from "next/font/google";
import "./globals.css";

const display = Manrope({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600", "700", "800"] });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: "TN Train Booking",
  description: "Tap any Tamil Nadu railway station to see every train departing it and exactly when its current availability opens.",
};

export const viewport: Viewport = {
  themeColor: "#f4f6f9",
  colorScheme: "light",
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <head>
        {/* start downloading the timetable while the app code loads */}
        <link rel="preload" href="/data/tn.json" as="fetch" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
