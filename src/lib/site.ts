/** Site identity used by metadata, the sitemap, structured data and share images. */
export const SITE_NAME = "Bogiey";
export const SITE_TAGLINE = "Train timings and booking times for Tamil Nadu";
export const SITE_DESCRIPTION =
  "Find exactly when current availability and 60-day advance booking open for every train at any Tamil Nadu station, with Tatkal times, holiday and long-weekend planning, and reminders.";

/**
 * The main public address. The same build is also served from Cloudflare as a mirror; every copy
 * points search engines here (canonical, sitemap, share previews). Override with NEXT_PUBLIC_SITE_URL.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://bogiey.web.app").replace(/\/$/, "");
