/** Site identity used by metadata, the sitemap, structured data and share images. */
export const SITE_NAME = "TN Train Booking";
export const SITE_TAGLINE = "When does booking open for Tamil Nadu trains?";
export const SITE_DESCRIPTION =
  "Find exactly when current availability and 60-day advance booking open for every train at any Tamil Nadu station, with Tatkal times, holiday and long-weekend planning, and reminders.";

/**
 * The public address of the site. Set NEXT_PUBLIC_SITE_URL in the Cloudflare build settings
 * (e.g. https://tntrainbooking.in) so canonical links, the sitemap and share previews use it.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://tn-curr-ava.workers.dev").replace(/\/$/, "");
